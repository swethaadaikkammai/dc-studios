import React from 'react';
import { Booking } from '../types';
import { useAuth } from '../context/AuthContext';
import { Clock, MapPin, CheckCircle2, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BookingCardProps {
  booking: Booking;
  onClick?: () => void;
  showDate?: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onClick, showDate = false }) => {
  const { user } = useAuth();
  const canAccessPassMessage = Boolean(
    user && (
      user.role === 'ADMIN' ||
      user.role === 'EVENTS_HEAD' ||
      ['events_head', 'admin'].includes((user.username || '').toLowerCase())
    )
  );
  const startDate = parseISO(booking.start_at);
  const endDate = parseISO(booking.end_at);
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const isRoom1 = booking.room?.name.includes('PRP201');

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white rounded-2xl p-4 border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
        booking.status === 'CANCELLED'
          ? 'opacity-65 border-slate-200 bg-slate-50/50'
          : 'border-slate-200/80 hover:border-[#356AE6]/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${
              isRoom1
                ? 'bg-blue-50 text-[#356AE6] border border-blue-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
          >
            {isRoom1 ? 'PRP201' : 'PRP202'}
          </span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {durationMinutes} min
          </span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="mb-2">
        <h4 className="font-bold text-slate-900 text-base group-hover:text-[#356AE6] transition-colors">
          {booking.team?.name || `Team ID #${booking.team_id}`}
        </h4>
        {booking.purpose && (
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{booking.purpose}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
        {showDate && (
          <div className="flex items-center gap-1 font-medium text-slate-700">
            <span>{format(startDate, 'EEE, dd MMM')}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {format(startDate, 'hh:mm a')} – {format(endDate, 'hh:mm a')}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <MapPin className="w-3.5 h-3.5" />
          <span>{booking.room?.name || 'Studio Room'}</span>
        </div>
        {canAccessPassMessage && booking.whatsapp_pass?.whatsapp_number && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <MessageSquare className="w-3 h-3 text-emerald-600" />
            <span>WhatsApp Pass</span>
          </div>
        )}
      </div>
    </div>
  );
};
