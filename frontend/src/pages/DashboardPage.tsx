import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Booking, Room, BookingApproval } from '../types';
import { BookingCard } from '../components/BookingCard';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { CreateBookingModal } from '../components/CreateBookingModal';
import {
  Calendar,
  Clock,
  Plus,
  Hourglass,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CalendarPlus,
  Check,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Zap,
  Trophy
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { Link } from 'react-router-dom';

const formatDetailedMs = (isoStr: string, epochMs?: number | null) => {
  try {
    const d = epochMs ? new Date(epochMs) : new Date(isoStr);
    const dateFormatted = format(d, 'dd MMM yyyy, hh:mm:ss');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    const ampm = format(d, 'a');
    return `${dateFormatted}.${ms} ${ampm} IST`;
  } catch {
    return isoStr;
  }
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [approvals, setApprovals] = useState<BookingApproval[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningApprovalId, setActioningApprovalId] = useState<number | null>(null);
  const [approvalFeedbackMsg, setApprovalFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
    whatsappUrl?: string | null;
  } | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const calls: Promise<any>[] = [
        api.getRooms(),
        api.getBookings({ status: 'CONFIRMED' }),
      ];

      if (user?.role === 'ADMIN') {
        calls.push(api.getAllApprovalRequests('PENDING'));
      } else if (user?.role === 'TEAM_HEAD') {
        calls.push(api.getMyApprovalRequests());
      }

      const results = await Promise.all(calls);
      const roomsData = results[0];
      const bookingsData = results[1];
      const approvalsData = results[2] || [];

      setRooms(roomsData);
      setApprovals(approvalsData);

      const now = new Date();
      const todayList = bookingsData.filter((b: Booking) => isToday(parseISO(b.start_at)));
      const upcomingList = bookingsData
        .filter((b: Booking) => parseISO(b.end_at) > now)
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
  }, [user]);

  const handleApprove = async (id: number) => {
    setActioningApprovalId(id);
    setApprovalFeedbackMsg(null);
    try {
      const res = await api.approveRequest(id);
      const confUrl = res.whatsapp_confirmation_url || res.confirmation_whatsapp_url;

      // Automatically trigger sending WhatsApp confirmation in a new tab
      if (confUrl) {
        window.open(confUrl, '_blank');
      }

      setApprovalFeedbackMsg({
        type: 'success',
        text: `Booking Request #${id} approved! Confirmed slot created.`,
        whatsappUrl: confUrl,
      });
      await loadDashboardData();
    } catch (err: any) {
      setApprovalFeedbackMsg({ type: 'error', text: err?.message || 'Failed to approve booking request.' });
    } finally {
      setActioningApprovalId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActioningApprovalId(id);
    setApprovalFeedbackMsg(null);
    try {
      await api.rejectRequest(id, 'Slot unavailable or rejected by Administrator');
      setApprovalFeedbackMsg({ type: 'success', text: `Booking Request #${id} has been rejected.` });
      await loadDashboardData();
    } catch (err: any) {
      setApprovalFeedbackMsg({ type: 'error', text: err?.message || 'Failed to reject booking request.' });
    } finally {
      setActioningApprovalId(null);
    }
  };

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
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
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

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white text-[#14213D] font-bold text-sm shadow-lg shadow-black/10 hover:bg-blue-50 transition-all transform active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#356AE6]" />
            {user?.role === 'TEAM_HEAD' ? 'Request Studio Booking' : 'Book Dance Studio'}
          </button>
        </div>
      </div>

      {/* 72-Hour Rolling Advance Notice Banner & Weekend Rule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-950 text-xs">
        <div className="flex items-start gap-2.5">
          <Hourglass className="w-4 h-4 text-[#356AE6] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>
              <span className="font-bold">Rolling 72-Hour Rule in Effect: </span>
              Reservations open in a continuous rolling 72-hour window. Slots beyond the exclusive boundary are strictly blocked by the database engine.
            </div>
            <div>
              <span className="font-bold text-blue-950">Weekend Booking Rule: </span>
              Weekend bookings (Saturday & Sunday) must be made at least 1 day (24 hours) prior to the time slot needed.
            </div>
          </div>
        </div>
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1 font-bold text-[#356AE6] hover:text-blue-800 shrink-0 self-start sm:self-center"
        >
          View Full Timetable <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Action feedback message */}
      {approvalFeedbackMsg && (
        <div
          className={`p-4 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border shadow-sm ${
            approvalFeedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {approvalFeedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{approvalFeedbackMsg.text}</span>
            {approvalFeedbackMsg.whatsappUrl && (
              <a
                href={approvalFeedbackMsg.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all animate-pulse"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send Confirmation on WhatsApp
              </a>
            )}
          </div>
          <button
            onClick={() => setApprovalFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 font-bold self-end sm:self-center"
          >
            ✕
          </button>
        </div>
      )}

      {/* ADMIN: Pending Booking Approvals Queue */}
      {user?.role === 'ADMIN' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Pending Booking Requests
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    {approvals.length} Pending
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and approve studio reservations submitted by Team Heads.
                </p>
              </div>
            </div>

            <Link
              to="/admin"
              className="text-xs font-bold text-[#356AE6] hover:text-blue-800 flex items-center gap-1 self-start sm:self-center"
            >
              Open Admin Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {approvals.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>All clear! No pending booking requests at this time.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {approvals.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-sm ${
                    req.has_conflict
                      ? req.is_first_requester
                        ? 'border-emerald-300 bg-emerald-50/25'
                        : 'border-amber-300 bg-amber-50/30'
                      : 'border-amber-200/80 bg-amber-50/30 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">Request #{req.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {req.team_name || `Team #${req.team_id}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {req.room_name || `Room #${req.room_id}`}
                        </span>
                        {req.is_weekend_request === 'true' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Weekend
                          </span>
                        )}
                        {req.has_conflict && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-0.5 ${
                              req.is_first_requester
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            <Zap className="w-3 h-3 fill-current" />
                            {req.is_first_requester
                              ? `Priority #1 (${Math.abs(req.conflict_delta_ms || 0)}ms lead)`
                              : `Priority #2 (+${Math.abs(req.conflict_delta_ms || 0)}ms lag)`}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                        <span>Requested by <strong className="text-slate-700">@{req.requester_username}</strong> on</span>
                        <span className="font-mono text-[10px] font-bold text-slate-800 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200">
                          {formatDetailedMs(req.created_at, req.created_at_ms)}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                      Pending
                    </span>
                  </div>

                  {/* Conflict Notice if competing requests exist */}
                  {req.has_conflict && req.competing_request && (
                    <div
                      className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                        req.is_first_requester
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1">
                          {req.is_first_requester ? (
                            <Trophy className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Zap className="w-3 h-3 text-amber-600" />
                          )}
                          {req.is_first_requester ? 'FCFS Winner' : 'Later Submission'}
                        </span>
                        <span className="font-mono font-extrabold text-[10px]">
                          {req.is_first_requester
                            ? `-${Math.abs(req.conflict_delta_ms || 0)}ms earlier`
                            : `+${Math.abs(req.conflict_delta_ms || 0)}ms later`}
                        </span>
                      </div>
                      <p className="text-[10px] leading-tight opacity-90">
                        {req.is_first_requester
                          ? `Arrived ${Math.abs(req.conflict_delta_ms || 0)}ms before ${req.competing_request.rival_team_name}. Prioritize this request.`
                          : `Arrived ${Math.abs(req.conflict_delta_ms || 0)}ms after ${req.competing_request.rival_team_name}.`}
                      </p>
                    </div>
                  )}

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-[#356AE6]" />
                      <span>
                        {format(parseISO(req.start_at), 'EEE, dd MMM yyyy')} · {format(parseISO(req.start_at), 'hh:mm a')} – {format(parseISO(req.end_at), 'hh:mm a')}
                      </span>
                    </div>
                    {req.purpose && (
                      <div className="text-[11px] text-slate-600">
                        <span className="text-slate-400">Purpose: </span>
                        {req.purpose}
                      </div>
                    )}
                  </div>

                  {req.admin_whatsapp_url && (
                    <a
                      href={req.admin_whatsapp_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Chat with Team Head on WhatsApp
                    </a>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actioningApprovalId === req.id}
                      className="flex-1 py-2 px-3 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actioningApprovalId === req.id}
                      className="flex-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Confirm
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAM HEAD: My Booking Requests Status */}
      {user?.role === 'TEAM_HEAD' && approvals.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  My Booking Requests
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track status of requests submitted to the administrator.
                </p>
              </div>
            </div>

            <Link
              to="/book-request"
              className="text-xs font-bold text-[#356AE6] hover:text-blue-800 flex items-center gap-1"
            >
              All Requests <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {approvals.slice(0, 4).map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    {req.room_name} · {req.team_name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.approval_status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : req.approval_status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {req.approval_status}
                  </span>
                </div>

                <div className="text-slate-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {format(parseISO(req.start_at), 'EEE, dd MMM · hh:mm a')} – {format(parseISO(req.end_at), 'hh:mm a')}
                  </span>
                </div>

                {req.approval_status === 'PENDING' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    Awaiting Admin Approval. An alert was sent to the administrator.
                  </p>
                )}

                {req.approval_status === 'APPROVED' && req.booking_id && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirmed as Booking #{req.booking_id}!
                    </p>
                    {(req.whatsapp_confirmation_url || req.confirmation_whatsapp_url) && (
                      <a
                        href={(req.whatsapp_confirmation_url || req.confirmation_whatsapp_url)!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View / Share Approved WhatsApp Pass
                      </a>
                    )}
                  </div>
                )}

                {req.approval_status === 'REJECTED' && req.rejection_reason && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
                    Reason: {req.rejection_reason}
                  </p>
                )}

                {req.approval_status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2 mt-1">
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
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold"
                    >
                      <ExternalLink className="w-3 h-3" /> Follow up with Admin {req.admin_whatsapp_url_2 ? '(Primary)' : 'on WhatsApp'}
                    </a>

                    {req.admin_whatsapp_url_2 && (
                      <a
                        href={req.admin_whatsapp_url_2}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-bold"
                      >
                        <ExternalLink className="w-3 h-3" /> Secondary Admin
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
