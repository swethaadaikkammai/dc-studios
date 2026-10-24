import React, { useState } from 'react';
import { Booking } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Check
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StudioPassCardProps {
  booking: Booking;
  onClose: () => void;
  onBookingCancelled?: () => void;
  isNewBooking?: boolean;
}

export const StudioPassCard: React.FC<StudioPassCardProps> = ({
  booking,
  onClose,
  onBookingCancelled,
  isNewBooking = false,
}) => {
  const { user } = useAuth();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const startDate = parseISO(booking.start_at);
  const endDate = parseISO(booking.end_at);
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  const waPass = booking.whatsapp_pass;

  const canAccessPassMessage = (): boolean => {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'EVENTS_HEAD') return true;
    const username = (user.username || '').toLowerCase();
    return username === 'events_head' || username === 'admin';
  };

  const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const getCleanPhone = (): string => {
    if (!waPass?.whatsapp_number) return '';
    const digits = waPass.whatsapp_number.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const handleSendPass = async () => {
    setIsSharing(true);
    setCopyStatus(null);
    try {
      // 1. Fetch pass image and put on clipboard
      const imgRes = await fetch(`/api/bookings/${booking.id}/pass.png`);
      const blob = await imgRes.blob();
      const file = new File([blob], `dc_studios_pass_${booking.id}.png`, { type: 'image/png' });

      // If mobile native share is available, share image + message directly
      if (isMobileDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `DC Studios Booking Pass #${booking.id}`,
          text: waPass?.pass_text || '',
        });
        setCopyStatus('Pass shared to WhatsApp!');
        return;
      }

      // Write pass image to clipboard
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
              'text/plain': new Blob([waPass?.pass_text || ''], { type: 'text/plain' })
            })
          ]);
        } catch {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch {}
        }
      }

      // Trigger backend outbox / audit log
      try {
        await api.dispatchWhatsAppPass(booking.id);
      } catch {}

      // 2. Directly open WhatsApp app to the person's number
      const cleanPhone = getCleanPhone();
      const encodedText = encodeURIComponent(waPass?.pass_text || '');
      const whatsappAppUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
      const whatsappWebUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

      // Open native WhatsApp application directly
      window.location.href = whatsappAppUrl;

      // Fallback to web link if desktop app isn't active
      setTimeout(() => {
        window.open(whatsappWebUrl, '_blank', 'noopener,noreferrer');
      }, 500);

      setCopyStatus('WhatsApp opened! Press Ctrl+V in the chat to attach the pass image.');
    } catch (err) {
      console.warn('Send pass error:', err);
      const cleanPhone = getCleanPhone();
      const encodedText = encodeURIComponent(waPass?.pass_text || '');
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank', 'noopener,noreferrer');
    } finally {
      setIsSharing(false);
      setTimeout(() => setCopyStatus(null), 5000);
    }
  };

  // Check if current user can cancel this booking
  const canCancel = (): boolean => {
    if (isNewBooking) return false;
    if (!user || booking.status !== 'CONFIRMED') return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEAM_HEAD') {
      return user.team_id === booking.team_id;
    }
    if (user.role === 'BOARD_MEMBER') {
      return booking.created_by === user.id;
    }
    return false;
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelBooking(booking.id);
      setShowConfirmCancel(false);
      if (onBookingCancelled) onBookingCancelled();
      onClose();
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-auto max-h-[92vh] flex flex-col">
      {/* Studio Pass Header */}
      <div className="relative bg-[#14213D] p-5 sm:p-6 text-white overflow-hidden shrink-0">
        {/* Studio Opaque Background with Preserved Color Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <img
            src="/studio_bg.jpg"
            alt="DC Studios Dance Rehearsal Space"
            className="w-full h-full object-cover object-center scale-105 opacity-25 mix-blend-luminosity filter contrast-125 brightness-95"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#14213D] via-[#1E293B]/90 to-[#356AE6]/80 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-[#14213D]/90 via-transparent to-[#356AE6]/50"></div>
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none"></div>
        </div>

        {/* Floating Close Button in Top-Right Corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-colors cursor-pointer border border-white/10"
          title="Close Pass"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10 flex items-center justify-between mb-3 pr-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider">
            Studio Reservation Pass
          </div>
          <div className="w-7 h-7 rounded-full overflow-hidden border border-white/30 shadow-sm shrink-0">
            <img src="/logo.png" alt="DC Studios Logo" className="w-full h-full object-cover" />
          </div>
        </div>

        <h3 className="relative z-10 text-2xl font-bold tracking-tight text-white mb-1">
          {booking.team?.name || `Team #${booking.team_id}`}
        </h3>
        <p className="relative z-10 text-blue-200 text-xs font-medium">
          DC Studios Official Studio Booking
        </p>
      </div>

      {/* Ticket Body - Smooth Scrollable */}
      <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
        {/* Status Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500">Reservation Status</span>
          {booking.status === 'CONFIRMED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Active & Confirmed
            </span>
          )}
          {booking.status === 'CANCELLED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Cancelled
            </span>
          )}
          {booking.status === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              Completed
            </span>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Date
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-[#356AE6]" />
              {format(startDate, 'EEE, dd MMM yyyy')}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Time & Duration
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Clock className="w-4 h-4 text-[#356AE6]" />
              {format(startDate, 'hh:mm a')} ({durationMinutes}m)
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Venue
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <MapPin className="w-4 h-4 text-rose-500" />
              {booking.room?.name || 'Studio Room'}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Booked By
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <UserIcon className="w-4 h-4 text-indigo-500" />
              {booking.creator?.username || 'Club Official'}
            </div>
          </div>
        </div>

        {booking.purpose && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Practice Purpose
            </span>
            <p className="text-xs text-slate-700">{booking.purpose}</p>
          </div>
        )}

        {/* WhatsApp Pass Dispatch - Strictly restricted to Admin and Events Head */}
        {canAccessPassMessage() && (
          <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50 rounded-2xl border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MessageSquare className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Team Head WhatsApp Pass</h4>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    {waPass?.whatsapp_number
                      ? `Recipient: @${waPass.team_head_name || 'Team Head'} (${waPass.whatsapp_number})`
                      : 'Team Head contact not set in admin console'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                {waPass?.status || 'DISPATCHED'}
              </span>
            </div>

            {copyStatus && (
              <div className="p-2.5 bg-emerald-100/95 text-emerald-950 border border-emerald-300 rounded-xl text-[11px] font-semibold flex items-center gap-2 animate-fade-in shadow-xs">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{copyStatus}</span>
              </div>
            )}

            {/* Single Direct Action Button: Send Pass */}
            <button
              type="button"
              onClick={handleSendPass}
              disabled={isSharing}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>{isSharing ? 'Opening WhatsApp...' : 'Send Pass'}</span>
            </button>
          </div>
        )}

        {/* Barcode Ticket Stamp Section */}
        <div className="pt-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-mono tracking-widest uppercase">
            <span>REF-STUDIO-{booking.id.toString().padStart(6, '0')}</span>
          </div>
          {/* Visual Barcode Pattern */}
          <div className="mt-2 h-9 w-4/5 mx-auto flex items-center justify-center gap-1 px-4 py-1 bg-slate-50 rounded border border-slate-200">
            <div className="w-1.5 h-full bg-slate-800"></div>
            <div className="w-0.5 h-full bg-slate-800"></div>
            <div className="w-2 h-full bg-slate-800"></div>
            <div className="w-1 h-full bg-slate-800"></div>
            <div className="w-0.5 h-full bg-slate-800"></div>
            <div className="w-2.5 h-full bg-slate-800"></div>
            <div className="w-1 h-full bg-slate-800"></div>
            <div className="w-0.5 h-full bg-slate-800"></div>
            <div className="w-1.5 h-full bg-slate-800"></div>
            <div className="w-2 h-full bg-slate-800"></div>
            <div className="w-0.5 h-full bg-slate-800"></div>
            <div className="w-1.5 h-full bg-slate-800"></div>
          </div>
        </div>

        {cancelError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{cancelError}</span>
          </div>
        )}

        {/* Actions */}
        {isNewBooking ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors shadow-sm mt-1 cursor-pointer"
          >
            Done & Return to Schedule
          </button>
        ) : (
          <div className="pt-1">
            {canCancel() && !showConfirmCancel && (
              <button
                type="button"
                onClick={() => setShowConfirmCancel(true)}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                Cancel This Booking
              </button>
            )}

            {showConfirmCancel && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                <p className="text-xs text-amber-800 font-medium">
                  Are you sure you want to cancel this booking? This will immediately release the studio slot for other teams.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={handleCancel}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmCancel(false)}
                    className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
