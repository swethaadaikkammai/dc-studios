import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Booking } from '../types';
import { BookingCard } from '../components/BookingCard';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { Users, Clock, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

export const MyTeamBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [isLoading, setIsLoading] = useState(true);

  const loadTeamBookings = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (user?.role === 'TEAM_HEAD' && user.team_id) {
        params.team_id = user.team_id;
      }
      const data = await api.getBookings(params);
      setBookings(data);
    } catch (e) {
      console.error('Failed to load team bookings', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamBookings();
  }, [user]);

  const now = new Date();

  const upcomingBookings = bookings.filter(
    (b) => b.status === 'CONFIRMED' && isAfter(parseISO(b.end_at), now)
  );
  const pastBookings = bookings.filter(
    (b) => b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && !isAfter(parseISO(b.end_at), now))
  );
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  const getDisplayedBookings = () => {
    switch (activeTab) {
      case 'upcoming':
        return upcomingBookings;
      case 'past':
        return pastBookings;
      case 'cancelled':
        return cancelledBookings;
      default:
        return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {user?.role === 'TEAM_HEAD' ? `${user.team?.name || 'My Team'} Bookings` : 'Team Reservations'}
            </h1>
            {user?.team && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {user.team.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review practice history and manage upcoming studio time.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Upcoming ({upcomingBookings.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'past'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Past Sessions ({pastBookings.length})
        </button>
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'cancelled'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cancelled ({cancelledBookings.length})
        </button>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading team reservations...</div>
      ) : getDisplayedBookings().length === 0 ? (
        <div className="py-16 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
          No {activeTab} bookings found for this team.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getDisplayedBookings().map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              showDate={true}
              onClick={() => setSelectedBooking(booking)}
            />
          ))}
        </div>
      )}

      <BookingDetailsModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBookingCancelled={() => {
          loadTeamBookings();
        }}
      />
    </div>
  );
};
