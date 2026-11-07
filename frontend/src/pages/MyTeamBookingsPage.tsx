import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Booking, BookingApproval } from '../types';
import { BookingCard } from '../components/BookingCard';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { CreateBookingModal } from '../components/CreateBookingModal';
import { Users, Clock, Calendar, CheckCircle2, XCircle, Plus, ExternalLink, CalendarPlus } from 'lucide-react';
import { parseISO, isAfter, format } from 'date-fns';

export const MyTeamBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [approvals, setApprovals] = useState<BookingApproval[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [isLoading, setIsLoading] = useState(true);

  const loadTeamBookings = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (user?.role === 'TEAM_HEAD' && user.team_id) {
        params.team_id = user.team_id;
      }
      const [bookingsData, approvalsData] = await Promise.all([
        api.getBookings(params),
        api.getMyApprovalRequests().catch(() => []),
      ]);
      setBookings(bookingsData);
      setApprovals(approvalsData);
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
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#356AE6] hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all transform active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Request Studio Slot
        </button>
      </div>

      {/* Team Head: Submitted Booking Requests & WhatsApp Follow-up */}
      {approvals.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Submitted Studio Requests & WhatsApp Actions
              </h2>
              <p className="text-xs text-slate-500">
                Live status of requests submitted to the administrator.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {approvals.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    {req.room_name || `Room #${req.room_id}`}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.approval_status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.approval_status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.approval_status === 'PENDING' ? 'Pending Admin Review' : req.approval_status}
                  </span>
                </div>

                <div className="text-slate-600 font-medium">
                  {format(parseISO(req.start_at), 'dd MMM yyyy, hh:mm a')} – {format(parseISO(req.end_at), 'hh:mm a')}
                </div>

                {req.purpose && (
                  <div className="text-slate-500 text-[11px] truncate">
                    <span className="text-slate-400">Purpose: </span>{req.purpose}
                  </div>
                )}

                {req.approval_status === 'PENDING' && (
                  <div className="pt-1 border-t border-slate-200/60 mt-2 flex flex-wrap gap-2">
                    <a
                      href={
                        req.admin_whatsapp_url ||
                        `https://api.whatsapp.com/send?phone=917010734009&text=${encodeURIComponent(
                          `*DC STUDIOS — BOOKING REQUEST (#${req.id})*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Team:* ${
                            req.team_name || 'Dance Team'
                          }\n*Room:* ${req.room_name || 'Dance Studio'}\n*Slot:* ${format(
                            parseISO(req.start_at),
                            'dd MMM yyyy, hh:mm a'
                          )} – ${format(
                            parseISO(req.end_at),
                            'hh:mm a'
                          )} IST\n*Purpose:* ${
                            req.purpose || 'Practice'
                          }\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFollow-up message for pending booking approval.`
                        )}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Follow up with Admin {req.admin_whatsapp_url_2 ? '(Primary)' : 'on WhatsApp'}
                    </a>

                    {req.admin_whatsapp_url_2 && (
                      <a
                        href={req.admin_whatsapp_url_2}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Secondary Admin
                      </a>
                    )}
                  </div>
                )}

                {req.approval_status === 'APPROVED' && (req.whatsapp_confirmation_url || req.confirmation_whatsapp_url) && (
                  <div className="pt-1 border-t border-slate-200/60 mt-2">
                    <a
                      href={(req.whatsapp_confirmation_url || req.confirmation_whatsapp_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg border border-emerald-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Confirmation Pass
                    </a>
                  </div>
                )}

                {req.approval_status === 'REJECTED' && req.rejection_reason && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200 mt-2">
                    Reason: {req.rejection_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onBookingCreated={() => {
          loadTeamBookings();
        }}
      />
    </div>
  );
};
