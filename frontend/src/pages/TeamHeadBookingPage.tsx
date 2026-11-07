import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Team, Room, ClubSettings, BookingApproval } from '../types';
import { CreateBookingModal } from '../components/CreateBookingModal';
import {
  CalendarPlus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const TeamHeadBookingPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [myRequests, setMyRequests] = useState<BookingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(true); // Open the interactive modal immediately

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [s, req] = await Promise.all([
        api.getPublicSettings(),
        api.getMyApprovalRequests(),
      ]);
      setSettings(s);
      setMyRequests(req);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      PENDING:  { cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200', label: 'Pending Approval' },
      APPROVED: { cls: 'bg-green-100 text-green-800 border border-green-200', label: 'Approved' },
      REJECTED: { cls: 'bg-red-100 text-red-800 border border-red-200', label: 'Rejected' },
      CANCELLED:{ cls: 'bg-slate-100 text-slate-600 border border-slate-200', label: 'Cancelled' },
    };
    const s = map[status] || { cls: 'bg-slate-100 text-slate-600', label: status };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.cls}`}>{s.label}</span>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const weekendMode = settings?.weekend_keys_secured ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <CalendarPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Request Studio Booking
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive 72-hour slot selector for {user?.team?.name || 'your dance team'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#356AE6] hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all transform active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Book DC Studios
        </button>
      </div>

      {/* Weekend notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <span>
          <b>Weekend Booking Policy:</b> Studio keys must be secured for weekend practice. Weekend requests submitted by Team Heads are forwarded directly to Administrators for key verification and clearance.
        </span>
      </div>

      {/* My Requests List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            My Booking Requests ({myRequests.length})
          </h2>
          <button
            onClick={loadAll}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
        </div>

        {myRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-3">
            <p>You have not submitted any studio booking requests yet.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create First Booking Request
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="border border-slate-200/90 rounded-2xl p-4 hover:border-slate-300 transition-all bg-slate-50/50 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Request #{req.id}</span>
                    <span className="text-xs text-slate-500">· {req.team_name} · {req.room_name}</span>
                    {req.is_weekend_request === 'true' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        Weekend
                      </span>
                    )}
                  </div>
                  {statusBadge(req.approval_status)}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {format(parseISO(req.start_at), 'EEE, dd MMM yyyy · hh:mm a')} –{' '}
                      {format(parseISO(req.end_at), 'hh:mm a')} IST
                    </span>
                  </div>
                  {req.purpose && (
                    <div className="text-slate-500 text-[11px]">
                      <span className="text-slate-400">Purpose:</span> {req.purpose}
                    </div>
                  )}
                  {req.rejection_reason && (
                    <div className="text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center gap-1.5 mt-1 text-[11px]">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Admin feedback: {req.rejection_reason}</span>
                    </div>
                  )}
                  {req.booking_id && (
                    <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Officially Confirmed! Booking #{req.booking_id}</span>
                    </div>
                  )}
                  {req.approval_status === 'PENDING' && (
                    <div className="pt-1 flex flex-wrap gap-2">
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
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Follow up with Admin {req.admin_whatsapp_url_2 ? '(Primary)' : 'on WhatsApp'}
                      </a>

                      {req.admin_whatsapp_url_2 && (
                        <a
                          href={req.admin_whatsapp_url_2}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Follow up with Admin (Secondary)
                        </a>
                      )}
                    </div>
                  )}
                  {req.confirmation_whatsapp_url && req.approval_status === 'APPROVED' && (
                    <div className="pt-1">
                      <a
                        href={req.confirmation_whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Confirmation WhatsApp Pass
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The EXACT same CreateBookingModal as in the image */}
      <CreateBookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBookingCreated={() => {
          loadAll();
        }}
      />
    </div>
  );
};
