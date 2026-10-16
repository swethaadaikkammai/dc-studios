import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Booking, Room } from '../types';
import { BookingCard } from '../components/BookingCard';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { CreateBookingModal } from '../components/CreateBookingModal';
import {
  Calendar,
  Clock,
  Sparkles,
  Plus,
  Hourglass,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [roomsData, bookingsData] = await Promise.all([
        api.getRooms(),
        api.getBookings({ status: 'CONFIRMED' }),
      ]);
      setRooms(roomsData);

      const now = new Date();
      const todayList = bookingsData.filter((b) => isToday(parseISO(b.start_at)));
      const upcomingList = bookingsData
        .filter((b) => parseISO(b.end_at) > now)
        .slice(0, 6);

      setTodayBookings(todayList);
      setUpcomingBookings(upcomingList);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const canCreateBooking = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-8 animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl bg-[#14213D] text-white p-6 sm:p-8 overflow-hidden shadow-xl shadow-slate-900/10 border border-slate-800/40">
        {/* Studio Opaque Background with Preserved Color Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          {/* Studio Interior Photo */}
          <img
            src="/studio_bg.jpg"
            alt="DC Studios Dance Rehearsal Space"
            className="w-full h-full object-cover object-center scale-105 opacity-35 mix-blend-luminosity filter contrast-125 brightness-95"
          />
          {/* Preserved Color Gradients: Deep Navy via Slate to Vibrant Royal Blue */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#14213D] via-[#1E293B]/85 to-[#356AE6]/75 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#14213D]/90 via-[#1E293B]/60 to-[#356AE6]/65"></div>

          {/* Studio Stage Spotlight Glows */}
          <div className="absolute -top-12 -right-12 w-80 h-80 rounded-full bg-blue-400/25 blur-3xl"></div>
          <div className="absolute -bottom-12 left-1/3 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              DC Studios
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.username}!
            </h1>
            <p className="mt-1 text-sm text-blue-100 max-w-xl">
              Centralized booking engine for studios <span className="font-semibold text-white">PRP201</span> and{' '}
              <span className="font-semibold text-white">PRP202</span>. Operating strictly under first-come-first-served rules and rolling 72-hour limits.
            </p>
          </div>

          {canCreateBooking && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white text-[#14213D] font-bold text-sm shadow-lg shadow-black/10 hover:bg-blue-50 transition-all transform active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#356AE6]" />
              Book Dance Studio
            </button>
          )}
        </div>
      </div>

      {/* 72-Hour Rolling Advance Notice Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-950 text-xs">
        <div className="flex items-center gap-2.5">
          <Hourglass className="w-4 h-4 text-[#356AE6] shrink-0" />
          <div>
            <span className="font-bold">Rolling 72-Hour Rule in Effect: </span>
            Reservations open in a continuous rolling 72-hour window. Slots beyond the exclusive boundary are strictly blocked by the database engine.
          </div>
        </div>
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1 font-bold text-[#356AE6] hover:text-blue-800 shrink-0"
        >
          View Full Timetable <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Studio Room Status Cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#356AE6]" />
          Studio Venues & Operational Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const roomBookingsToday = todayBookings.filter((b) => b.room_id === room.id);
            const isRoom1 = room.name.includes('PRP201');

            return (
              <div
                key={room.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider mb-2 ${
                        isRoom1
                          ? 'bg-blue-50 text-[#356AE6] border border-blue-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {isRoom1 ? 'Studio A' : 'Studio B'}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900">{room.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Operating Hours: 09:00 AM – 07:00 PM IST</p>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Operational
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-slate-400 font-medium block mb-0.5">Today's Sessions</span>
                    <span className="text-base font-bold text-slate-800">
                      {roomBookingsToday.length} Booked
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-slate-400 font-medium block mb-0.5">Booking Limits</span>
                    <span className="text-base font-bold text-slate-800">Max 240 mins</span>
                  </div>
                </div>

                {canCreateBooking && (
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(true);
                    }}
                    className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 hover:border-[#356AE6] text-xs font-bold text-slate-700 hover:text-[#356AE6] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Book {room.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Rehearsals Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#356AE6]" />
            Upcoming Studio Sessions
          </h2>
          <Link
            to="/calendar"
            className="text-xs font-bold text-[#356AE6] hover:text-blue-800 flex items-center gap-1"
          >
            All Bookings <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading studio schedule...</div>
        ) : upcomingBookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 p-8 text-slate-400 text-sm">
            No upcoming bookings found. Studios are fully available within the 72-hour window.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                showDate={true}
                onClick={() => setSelectedBooking(booking)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onBookingCreated={() => {
          loadDashboardData();
        }}
      />

      <BookingDetailsModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBookingCancelled={() => {
          loadDashboardData();
        }}
      />
    </div>
  );
};
