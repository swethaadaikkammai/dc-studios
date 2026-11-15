import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDeviceNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import {
  User,
  Team,
  Room,
  ClubSettings,
  AuditLog,
  BoardPermission,
  ReminderStatusResponse,
  BookingApproval,
  Booking,
  PasswordResetRequest
} from '../types';
import {
  ShieldAlert,
  Users,
  Settings,
  Layers,
  History,
  Key,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  Lock,
  X,
  Bell,
  Phone,
  Clock,
  MessageSquare,
  Send,
  RefreshCw,
  Check,
  CalendarPlus,
  ExternalLink,
  Zap,
  Trophy
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'settings' | 'rooms' | 'reminders' | 'audit' | 'approvals' | 'bookings' | 'events' | 'todo' | 'custom-reminders' | 'event-reminders'>('approvals');

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [permissions, setPermissions] = useState<BoardPermission[]>([]);

  // Studio Bookings Management State
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('ALL');
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState<string>('');
  const [cancellationResult, setCancellationResult] = useState<{ message: string; whatsappUrl?: string } | null>(null);

  // Password Reset Requests State
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [resolvingReset, setResolvingReset] = useState<PasswordResetRequest | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [isResolvingReset, setIsResolvingReset] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('BOARD_MEMBER');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newWhatsApp, setNewWhatsApp] = useState('');
  const [newWhatsApp2, setNewWhatsApp2] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('BOARD_MEMBER');
  const [editTeamId, setEditTeamId] = useState<string>('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editWhatsApp2, setEditWhatsApp2] = useState('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Delete User State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Settings Edit State
  const [settingsForm, setSettingsForm] = useState<Partial<ClubSettings>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);
  const [settingsErrorMsg, setSettingsErrorMsg] = useState<string | null>(null);

  // Reminder System State
  const [reminderData, setReminderData] = useState<ReminderStatusResponse | null>(null);
  const [adminPhoneInput, setAdminPhoneInput] = useState('');
  const [adminPhoneInput2, setAdminPhoneInput2] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [isCheckingReminders, setIsCheckingReminders] = useState(false);
  const [reminderCheckMessage, setReminderCheckMessage] = useState<string | null>(null);

  const {
    notificationsEnabled: appNotificationsEnabled,
    requestPermission: requestAppNotificationPermission,
    playNotificationSound,
    testNotification,
  } = useDeviceNotifications();

  // Approval Requests State - DEFAULT TO 'PENDING' ONLY
  const [approvals, setApprovals] = useState<BookingApproval[]>([]);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('PENDING');
  const [actioningApprovalId, setActioningApprovalId] = useState<number | null>(null);
  const [rejectingApprovalId, setRejectingApprovalId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [id: number]: string }>({});
  const [isRefreshingApprovals, setIsRefreshingApprovals] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<{ id: number; message: string; whatsappUrl?: string } | null>(null);

  const loadApprovals = async () => {
    setIsRefreshingApprovals(true);
    try {
      const apprv = await api.getAllApprovalRequests();
      setApprovals(apprv);
    } catch (e: any) {
      console.error('Failed to load approval requests:', e);
    } finally {
      setIsRefreshingApprovals(false);
    }
  };

  const handleApprove = async (id: number) => {
    setActioningApprovalId(id);
    setMessage(null);
    setErrorMessage(null);
    setApprovalFeedback(null);
    try {
      const res = await api.approveRequest(id);
      const confUrl = res.whatsapp_confirmation_url || res.confirmation_whatsapp_url;

      // Automatically trigger opening WhatsApp in a new tab
      if (confUrl) {
        window.open(confUrl, '_blank');
      }

      setMessage(`Booking request #${id} approved successfully! Confirmed studio booking created.`);
      setApprovalFeedback({
        id,
        message: `Booking request #${id} approved! Confirmed studio booking created.`,
        whatsappUrl: confUrl || undefined,
      });
      await loadApprovals();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to approve booking request.');
    } finally {
      setActioningApprovalId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActioningApprovalId(id);
    setMessage(null);
    setErrorMessage(null);
    try {
      const reason = rejectReason[id]?.trim() || 'Slot rejected by Administrator';
      await api.rejectRequest(id, reason);
      setMessage(`Booking request #${id} has been rejected.`);
      setRejectingApprovalId(null);
      await loadApprovals();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to reject booking request.');
    } finally {
      setActioningApprovalId(null);
    }
  };

  const loadReminderData = async () => {
    try {
      const res = await api.getRemindersStatus();
      setReminderData(res);
      const currentAdmin = res.admin_phone_numbers.find((a) => a.id === user?.id) || res.admin_phone_numbers[0];
      if (currentAdmin) {
        if (currentAdmin.whatsapp_number) {
          setAdminPhoneInput(currentAdmin.whatsapp_number);
        }
        if (currentAdmin.whatsapp_number_2) {
          setAdminPhoneInput2(currentAdmin.whatsapp_number_2);
        }
      }
    } catch (err: any) {
      console.error('Failed to load reminder status:', err);
    }
  };

  const handleTriggerCheck = async () => {
    setIsCheckingReminders(true);
    setReminderCheckMessage(null);
    try {
      const res = await api.triggerRemindersCheck();
      setReminderCheckMessage(res.message);
      await loadReminderData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to check reminders.');
    } finally {
      setIsCheckingReminders(false);
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPhoneInput.trim()) return;
    setIsUpdatingPhone(true);
    try {
      await api.updateAdminReminderPhone(adminPhoneInput.trim(), adminPhoneInput2.trim() || undefined);
      setMessage('Admin reminder phone numbers updated successfully.');
      await loadReminderData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update reminder phone.');
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [u, t, r, s, a, p, apprv, bList, pResets] = await Promise.all([
        api.getUsers(),
        api.getTeams(),
        api.getRooms(),
        api.getSettings(),
        api.getAuditLogs(100),
        api.getBoardPermissions(),
        api.getAllApprovalRequests(),
        api.getBookings().catch(() => []),
        api.getPasswordResetRequests('PENDING').catch(() => []),
      ]);
      setUsers(u);
      setTeams(t);
      setRooms(r);
      setSettings(s);
      setSettingsForm(s);
      setAuditLogs(a);
      setPermissions(p);
      setApprovals(apprv);
      setBookingsList(bList);
      setPasswordResetRequests(pResets);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load administrator data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.deleteBookingAdmin(bookingId);
      setMessage(`Booking #${bookingId} was permanently deleted and the studio slot has been released.`);
      setDeletingBooking(null);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete booking.');
    }
  };

  const handleAdminCancelBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.cancelBooking(cancellingBooking.id, adminCancelReason.trim() || undefined);
      setMessage(`Booking #${cancellingBooking.id} has been cancelled.`);
      setCancellationResult({
        message: `Booking #${cancellingBooking.id} cancelled successfully.`,
        whatsappUrl: res.cancellation_whatsapp_url,
      });
      setCancellingBooking(null);
      setAdminCancelReason('');
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel booking.');
    }
  };

  const handleResolveReset = async (requestId: number) => {
    setIsResolvingReset(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.resolvePasswordResetRequest(requestId, {
        new_password: newPasswordInput.trim() || undefined,
        notes: 'Resolved by Administrator in Admin Console',
      });
      setMessage(res.message);
      setResolvingReset(null);
      setNewPasswordInput('');
      const updated = await api.getPasswordResetRequests('PENDING');
      setPasswordResetRequests(updated);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resolve password reset request.');
    } finally {
      setIsResolvingReset(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === 'reminders') {
      loadReminderData();
    }
  }, [activeTab]);

  // Real-time automatic background polling
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        if (activeTab === 'reminders') {
          const res = await api.getRemindersStatus();
          setReminderData(res);
        }
      } catch (e) {
        // silent polling
      }
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(pollInterval);
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim() || undefined,
        password: newPassword,
        role: newRole,
        team_id: newTeamId ? Number(newTeamId) : null,
        whatsapp_number: newWhatsApp.trim() || undefined,
        whatsapp_number_2: newWhatsApp2.trim() || undefined,
      });
      setMessage(`User @${newUsername} provisioned successfully with WhatsApp ${newWhatsApp || 'not set'}.`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewWhatsApp('');
      setNewWhatsApp2('');
      setIsCreatingUser(false);
      loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create user.');
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update user.');
    }
  };

  const startEditUser = (u: User) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email || '');
    setEditPassword('');
    setEditRole(u.role);
    setEditTeamId(u.team_id ? String(u.team_id) : '');
    setEditWhatsApp(u.whatsapp_number || '');
    setEditWhatsApp2(u.whatsapp_number_2 || '');
    setEditIsActive(u.is_active);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      const payload: any = {
        username: editUsername.trim(),
        email: editEmail.trim() || undefined,
        role: editRole,
        team_id: editTeamId ? Number(editTeamId) : null,
        whatsapp_number: editWhatsApp.trim() || undefined,
        whatsapp_number_2: editWhatsApp2.trim() || undefined,
        is_active: editIsActive,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await api.updateUser(editingUser.id, payload);
      setMessage(`Account @${editUsername} updated successfully.`);
      setEditingUser(null);
      loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update user account.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.deleteUser(deletingUser.id);
      setMessage(res.message || `Account @${deletingUser.username} deleted successfully.`);
      setDeletingUser(null);
      loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete user account.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setSettingsSuccessMsg(null);
    setSettingsErrorMsg(null);
    setIsSavingSettings(true);
    try {
      const payload: Partial<ClubSettings> = {
        opening_time: settingsForm.opening_time,
        closing_time: settingsForm.closing_time,
        slot_interval_minutes: Number(settingsForm.slot_interval_minutes),
        maximum_duration_minutes: Number(settingsForm.maximum_duration_minutes),
        advance_booking_hours: Number(settingsForm.advance_booking_hours),
        cancellation_cutoff_minutes: Number(settingsForm.cancellation_cutoff_minutes || 0),
        daily_team_quota_minutes: Number(settingsForm.daily_team_quota_minutes || 0),
      };
      const updated = await api.updateSettings(payload);
      setSettings(updated);
      setSettingsForm(updated);
      setSettingsSuccessMsg(`Operational rules updated successfully! Studio Max Duration: ${updated.maximum_duration_minutes} mins.`);
      setMessage('Club operational settings updated successfully.');
    } catch (err: any) {
      setSettingsErrorMsg(err?.message || 'Failed to update settings.');
      setErrorMessage(err?.message || 'Failed to update settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTogglePermission = async (userId: number, teamId: number, currentCanCreate: boolean) => {
    try {
      await api.setBoardPermission({
        user_id: userId,
        team_id: teamId,
        can_create_booking: !currentCanCreate,
      });
      loadAdminData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update permission.');
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-1">This console is restricted to Club Administrators.</p>
      </div>
    );
  }

  const boardUsers = users.filter((u) => u.role === 'BOARD_MEMBER' || u.role === 'EVENTS_HEAD');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Console</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Governance, member accounts, board permissions, studio configuration, and audit trails.
        </p>
      </div>

      {message && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          {approvalFeedback?.whatsappUrl && (
            <a
              href={approvalFeedback.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm animate-pulse"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send Confirmation on WhatsApp
            </a>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Password Reset Requests Banner */}
      {passwordResetRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-xs text-amber-950 space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Password Reset Requests ({passwordResetRequests.length} Pending)
                </h4>
                <p className="text-[11px] text-amber-800">
                  Team Heads/Members requested password updates via the login screen.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {passwordResetRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white/95 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">@{req.username}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                      {req.team_name || 'Member'}
                    </span>
                    {req.whatsapp_number && (
                      <span className="text-[11px] text-slate-600 font-medium">· Phone: {req.whatsapp_number}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Requested on {format(parseISO(req.created_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setResolvingReset(req);
                      setNewPasswordInput('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#356AE6] hover:bg-blue-600 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleResolveReset(req.id)}
                    disabled={isResolvingReset}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit text-xs font-bold">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'approvals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
          <span>Booking Approvals</span>
          {approvals.filter(a => a.approval_status === 'PENDING').length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
              {approvals.filter(a => a.approval_status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Studio Bookings ({bookingsList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Members ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'permissions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" /> Board Permissions
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Operational Rules
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Studios ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'reminders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-blue-600" /> Session Reminders (5h & 1h)
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Audit Trail ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'events' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Event Planning
        </button>
        <button
          onClick={() => setActiveTab('event-reminders')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'event-reminders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          Event Reminders
        </button>
        <button
          onClick={() => setActiveTab('custom-reminders')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'custom-reminders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Custom Reminders
        </button>
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'todo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Club Activities
        </button>
      </div>

      {/* Tab 0: Booking Approvals (Team Head Requests) */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-blue-600" />
                Team Head Booking Requests
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Review, approve, or reject studio requests submitted by Team Heads. Approving immediately converts the request into a confirmed booking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadApprovals}
                disabled={isRefreshingApprovals}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApprovals ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((filter) => {
              const count =
                filter === 'ALL'
                  ? approvals.length
                  : approvals.filter((a) => a.approval_status === filter).length;
              return (
                <button
                  key={filter}
                  onClick={() => setApprovalStatusFilter(filter)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    approvalStatusFilter === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>

          {/* Active Slot Race & Millisecond Conflict Alert Banner */}
          {approvals.some((a) => a.approval_status === 'PENDING' && a.has_conflict) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-xs text-amber-950 space-y-2 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Race Condition Detected: Competing Slot Requests
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      Two or more Team Heads requested the same studio room for overlapping times.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-amber-200/90 text-amber-900 border border-amber-300 uppercase tracking-wider">
                  Millisecond Precision Active
                </span>
              </div>
              <p className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-200/60 leading-relaxed">
                VIT DC Studios operates on an authoritative <strong>First-Come, First-Served (FCFS)</strong> engine. 
                The system audits arrival timestamps down to the millisecond. The <strong>Priority #1 (FCFS Winner)</strong> badge marks the earliest submission.
              </p>
            </div>
          )}

          {/* Requests List */}
          {approvals.filter((a) => approvalStatusFilter === 'ALL' || a.approval_status === approvalStatusFilter).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No booking requests found under status "{approvalStatusFilter}".
            </div>
          ) : (
            <div className="space-y-4">
              {approvals
                .filter((a) => approvalStatusFilter === 'ALL' || a.approval_status === approvalStatusFilter)
                .map((req) => (
                  <div
                    key={req.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 shadow-sm ${
                      req.has_conflict && req.approval_status === 'PENDING'
                        ? req.is_first_requester
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">Request #{req.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            {req.team_name || `Team #${req.team_id}`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {req.room_name || `Room #${req.room_id}`}
                          </span>
                          {req.is_weekend_request === 'true' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Weekend Request
                            </span>
                          )}
                          {req.has_conflict && req.approval_status === 'PENDING' && (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                                req.is_first_requester
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              <Zap className="w-3 h-3 fill-current" />
                              {req.is_first_requester
                                ? `Priority #1: Earliest (${Math.abs(req.conflict_delta_ms || 0)}ms lead)`
                                : `Priority #2: Later (+${Math.abs(req.conflict_delta_ms || 0)}ms lag)`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>Requested by <strong className="text-slate-800">@{req.requester_username}</strong> on</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDetailedMs(req.created_at, req.created_at_ms)}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          req.approval_status === 'PENDING'
                            ? req.has_conflict
                              ? req.is_first_requester
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                            : req.approval_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {req.approval_status}
                      </span>
                    </div>

                    {/* Competing Millisecond Conflict Box */}
                    {req.has_conflict && req.competing_request && req.approval_status === 'PENDING' && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                          req.is_first_requester
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : 'bg-amber-50/90 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {req.is_first_requester ? (
                              <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <span className="font-extrabold text-xs uppercase tracking-wide">
                              {req.is_first_requester
                                ? 'First-Come, First-Served Priority Winner'
                                : `Competing Slot Conflict with Request #${req.competing_request.rival_approval_id}`}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-full bg-white shadow-xs border border-slate-200">
                            {req.is_first_requester
                              ? `-${Math.abs(req.conflict_delta_ms || 0)} ms earlier`
                              : `+${Math.abs(req.conflict_delta_ms || 0)} ms later`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 bg-white/95 rounded-lg border border-slate-200 space-y-0.5">
                            <span className="text-slate-400 block font-semibold">
                              This Request ({req.team_name}):
                            </span>
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatDetailedMs(req.created_at, req.created_at_ms)}
                            </span>
                          </div>
                          <div className="p-2 bg-white/95 rounded-lg border border-slate-200 space-y-0.5">
                            <span className="text-slate-400 block font-semibold">
                              Rival Request ({req.competing_request.rival_team_name}):
                            </span>
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatDetailedMs(
                                req.competing_request.rival_requested_at,
                                req.competing_request.rival_created_at_ms
                              )}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] opacity-90 leading-relaxed">
                          {req.is_first_requester ? (
                            <span>
                              This team submitted <strong>{Math.abs(req.conflict_delta_ms || 0)} milliseconds</strong> prior to{' '}
                              <strong>{req.competing_request.rival_team_name}</strong> (@{req.competing_request.rival_requester_username}). 
                              Approving this request guarantees fairness under the FCFS booking policy.
                            </span>
                          ) : (
                            <span>
                              This team submitted <strong>{Math.abs(req.conflict_delta_ms || 0)} milliseconds</strong> AFTER{' '}
                              <strong>{req.competing_request.rival_team_name}</strong> (@{req.competing_request.rival_requester_username}). 
                              Approving the earlier request will automatically reject this slot due to room overlap.
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Timing & Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 block">Requested Slot:</span>
                        <span className="font-bold text-slate-800">
                          {format(parseISO(req.start_at), 'EEE, dd MMM yyyy')} · {format(parseISO(req.start_at), 'hh:mm a')} - {format(parseISO(req.end_at), 'hh:mm a')} IST
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Purpose / Rehearsal Focus:</span>
                        <span className="font-medium text-slate-700">
                          {req.purpose || 'Routine rehearsal'}
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp notification action */}
                    {req.admin_whatsapp_url && (
                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={req.admin_whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Pre-Filled WhatsApp Chat with Admin
                        </a>
                      </div>
                    )}

                    {/* Review Info if Approved or Rejected */}
                    {req.approval_status === 'APPROVED' && req.booking_id && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Approved and confirmed as Booking #{req.booking_id}
                      </div>
                    )}

                    {req.approval_status === 'REJECTED' && req.rejection_reason && (
                      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Rejection reason: {req.rejection_reason}
                      </div>
                    )}

                    {/* Admin Actions if PENDING */}
                    {req.approval_status === 'PENDING' && (
                      <div className="pt-3 border-t border-slate-200">
                        {rejectingApprovalId === req.id ? (
                          <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 text-rose-600" />
                                Rejection Reason:
                              </label>
                              <button
                                type="button"
                                onClick={() => setRejectingApprovalId(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                            <input
                              type="text"
                              autoFocus
                              placeholder="Enter reason for rejection (e.g., Slot already reserved, maintenance, etc.)..."
                              value={rejectReason[req.id] || ''}
                              onChange={(e) =>
                                setRejectReason({ ...rejectReason, [req.id]: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleReject(req.id);
                                }
                              }}
                              className="w-full px-3 py-2 text-xs rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setRejectingApprovalId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(req.id)}
                                disabled={actioningApprovalId === req.id}
                                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
                              >
                                {actioningApprovalId === req.id ? 'Rejecting...' : 'Confirm Rejection'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setRejectingApprovalId(req.id)}
                              disabled={actioningApprovalId === req.id}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-colors"
                            >
                              Reject Request
                            </button>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={actioningApprovalId === req.id}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve & Reserve Slot
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Studio Bookings Management */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                All Studio Bookings & Reservations
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                View, cancel, or permanently delete studio bookings. Cancelling notifies the Team Head via in-app alert & WhatsApp with your cancellation reason.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors w-fit"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const).map((filter) => {
              const count =
                filter === 'ALL'
                  ? bookingsList.length
                  : bookingsList.filter((b) => b.status === filter).length;
              return (
                <button
                  key={filter}
                  onClick={() => setBookingFilterStatus(filter)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingFilterStatus === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>

          {/* Bookings Table */}
          {bookingsList.filter((b) => bookingFilterStatus === 'ALL' || b.status === bookingFilterStatus).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No studio bookings found under status "{bookingFilterStatus}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-y border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Booking</th>
                    <th className="py-3 px-4">Studio</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Slot Timing</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Notes / Reason</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookingsList
                    .filter((b) => bookingFilterStatus === 'ALL' || b.status === bookingFilterStatus)
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">#{b.id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{b.room?.name || `Room #${b.room_id}`}</td>
                        <td className="py-3 px-4 font-bold text-blue-700">{b.team?.name || `Team #${b.team_id}`}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {format(parseISO(b.start_at), 'dd MMM yyyy')}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {format(parseISO(b.start_at), 'hh:mm a')} – {format(parseISO(b.end_at), 'hh:mm a')} IST
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          {b.cancellation_reason ? (
                            <div className="text-rose-700 font-medium text-[11px]">
                              Cancellation: {b.cancellation_reason}
                            </div>
                          ) : b.purpose ? (
                            <div className="text-slate-600 text-[11px] truncate">
                              {b.purpose}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {b.status === 'CONFIRMED' && (
                              <button
                                onClick={() => {
                                  setCancellingBooking(b);
                                  setAdminCancelReason('');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                                title="Cancel booking and enter reason for Team Head"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingBooking(b)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Permanently delete booking from database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Member Accounts */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Registered Club Accounts</h3>
            <button
              onClick={() => setIsCreatingUser(!isCreatingUser)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#356AE6] text-white text-xs font-bold hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Provision Account
            </button>
          </div>

          {/* Provision Form */}
          {isCreatingUser && (
            <form onSubmit={handleCreateUser} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Member Credentials</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                />

                <input
                  type="password"
                  required
                  placeholder="Temporary Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                >
                  <option value="BOARD_MEMBER">Board Member</option>
                  <option value="TEAM_HEAD">Team Head</option>
                  <option value="EVENTS_HEAD">Events Head</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                <input
                  type="text"
                  placeholder="Primary WhatsApp (+91 ...)"
                  value={newWhatsApp}
                  onChange={(e) => setNewWhatsApp(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                />
                <input
                  type="text"
                  placeholder="Secondary WhatsApp (Optional)"
                  value={newWhatsApp2}
                  onChange={(e) => setNewWhatsApp2(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                />
                {newRole === 'TEAM_HEAD' && (
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    required
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2"
                  >
                    <option value="">Select Team Assignment</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#356AE6]"
                >
                  Save Account
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.username}</td>
                    <td className="py-3 px-4 font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">{u.team?.name || '—'}</td>
                    <td className="py-3 px-4">
                      {u.whatsapp_number ? (
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 text-slate-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>{u.whatsapp_number}</span>
                          </div>
                          {u.whatsapp_number_2 && (
                            <div className="inline-flex items-center gap-1.5 text-slate-700 font-medium bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                              <span>{u.whatsapp_number_2}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Not set</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => startEditUser(u)}
                          title="Edit user details and reset password"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            u.is_active
                              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          disabled={u.id === user?.id}
                          title={u.id === user?.id ? 'Cannot delete own account' : 'Delete user account'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.id === user?.id
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-[#14213D] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Member Account</h3>
                <p className="text-xs text-slate-300">@{editingUser.username}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                />
              </div>



              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  >
                    <option value="BOARD_MEMBER">Board Member</option>
                    <option value="TEAM_HEAD">Team Head</option>
                    <option value="EVENTS_HEAD">Events Head</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Team Affiliation
                  </label>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  >
                    <option value="">No Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Primary WhatsApp Contact Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 7010734009"
                    value={editWhatsApp}
                    onChange={(e) => setEditWhatsApp(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Primary contact for notifications and studio pass dispatch</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Secondary WhatsApp Contact Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={editWhatsApp2}
                    onChange={(e) => setEditWhatsApp2(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Second phone number for admin alerts and team follow-ups</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reset Password <span className="text-[11px] text-slate-400 font-normal lowercase">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#356AE6] focus:ring-[#356AE6]"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-700">
                  Account is Active
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Member Account</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete account{' '}
                <span className="font-bold text-slate-800">@{deletingUser.username}</span>?
              </p>
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-xl mt-2 border border-amber-200">
                Any studio reservations previously created by this user will be preserved for the dance club schedule.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Booking Confirmation Modal */}
      {deletingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Permanently Delete Booking #{deletingBooking.id}</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this booking for{' '}
                <span className="font-bold text-slate-800">{deletingBooking.team?.name || `Team #${deletingBooking.team_id}`}</span>?
              </p>
              <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl mt-2 border border-rose-200">
                This will delete the booking row from the database and immediately free up the studio slot.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBooking(deletingBooking.id)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Cancel Booking Modal with Mandatory Reason */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Cancel Booking #{cancellingBooking.id}
              </h3>
              <button
                onClick={() => setCancellingBooking(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div><strong>Team:</strong> {cancellingBooking.team?.name || `Team #${cancellingBooking.team_id}`}</div>
              <div><strong>Studio:</strong> {cancellingBooking.room?.name || `Room #${cancellingBooking.room_id}`}</div>
              <div><strong>Slot:</strong> {format(parseISO(cancellingBooking.start_at), 'dd MMM yyyy, hh:mm a')} – {format(parseISO(cancellingBooking.end_at), 'hh:mm a')}</div>
            </div>

            <form onSubmit={handleAdminCancelBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cancellation Reason (Sent in-app & WhatsApp)
                </label>
                <textarea
                  required
                  rows={3}
                  value={adminCancelReason}
                  onChange={(e) => setAdminCancelReason(e.target.value)}
                  placeholder="e.g., Studio maintenance scheduled, urgent club event conflict, emergency keys unavailability..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Result & WhatsApp Dispatch Dialog */}
      {cancellationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Booking Cancelled Successfully</h3>
              <p className="text-xs text-slate-500 mt-1">{cancellationResult.message}</p>
            </div>

            {cancellationResult.whatsappUrl && (
              <a
                href={cancellationResult.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                Send Cancellation on WhatsApp to Team Head
              </a>
            )}

            <button
              onClick={() => setCancellationResult(null)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resolvingReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Key className="w-4 h-4 text-amber-500" />
                Reset Password for @{resolvingReset.username}
              </div>
              <button
                onClick={() => setResolvingReset(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Set a new temporary password for <strong>@{resolvingReset.username}</strong> ({resolvingReset.team_name || 'Member'}).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="e.g., DanceClub@2026"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingReset(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isResolvingReset || !newPasswordInput.trim()}
                  onClick={() => handleResolveReset(resolvingReset.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isResolvingReset ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Board Permissions Delegation Matrix */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Board Member Team Booking Delegations</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure which Dance Teams each Board Member is authorized to create studio reservations for.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">Board Member</th>
                  {teams.map((t) => (
                    <th key={t.id} className="py-3 px-2 text-center text-[10px]">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boardUsers.map((bUser) => (
                  <tr key={bUser.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">{bUser.username}</td>
                    {teams.map((team) => {
                      const hasPerm = permissions.some(
                        (p) => p.user_id === bUser.id && p.team_id === team.id && p.can_create_booking
                      );
                      return (
                        <td key={team.id} className="py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={hasPerm}
                            onChange={() => handleTogglePermission(bUser.id, team.id, hasPerm)}
                            className="w-4 h-4 text-[#356AE6] rounded border-slate-300 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Operational Rules */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Studio Operational Settings</h3>
            <p className="text-xs text-slate-500 mt-1">
              Changes update PostgreSQL immediately and reload the in-memory Singleton configuration for all studio bookings.
            </p>
          </div>

          {settingsSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{settingsSuccessMsg}</span>
            </div>
          )}

          {settingsErrorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{settingsErrorMsg}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">Active Campus Policy:</span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold">
              {settings.opening_time} - {settings.closing_time} IST
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold">
              Max {settings.maximum_duration_minutes || 240} mins ({((settings.maximum_duration_minutes || 240) / 60).toFixed(0)} hrs)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
              {settings.advance_booking_hours}h advance window
            </span>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Studio Opening Time (IST)
              </label>
              <input
                type="text"
                value={settingsForm.opening_time || '09:00'}
                onChange={(e) => setSettingsForm({ ...settingsForm, opening_time: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Studio Closing Time (IST)
              </label>
              <input
                type="text"
                value={settingsForm.closing_time || '19:00'}
                onChange={(e) => setSettingsForm({ ...settingsForm, closing_time: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Slot Interval (Minutes)
              </label>
              <input
                type="number"
                value={settingsForm.slot_interval_minutes || 30}
                onChange={(e) => setSettingsForm({ ...settingsForm, slot_interval_minutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Standard booking interval (default 30 mins)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Maximum Duration (Minutes)
              </label>
              <input
                type="number"
                step="30"
                min="30"
                max="600"
                value={settingsForm.maximum_duration_minutes || 240}
                onChange={(e) => setSettingsForm({ ...settingsForm, maximum_duration_minutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              />
              <p className="text-[10px] text-blue-600 font-semibold mt-1">Configured: {settingsForm.maximum_duration_minutes || 240} mins ({((settingsForm.maximum_duration_minutes || 240) / 60).toFixed(1)} hrs). Supports up to 240 mins.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Advance Booking Window (Hours)
              </label>
              <input
                type="number"
                value={settingsForm.advance_booking_hours || 72}
                onChange={(e) => setSettingsForm({ ...settingsForm, advance_booking_hours: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Rolling advance window boundary (default 72 hrs)</p>
            </div>

            <div className="sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSavingSettings ? 'Saving Operational Rules...' : 'Save Operational Rules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Studio Rooms */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Dance Studio Rooms</h3>
            <p className="text-xs text-slate-500 mt-1">
              Active Studio Limit: Enforced at strictly 2 active rooms max.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((r) => (
              <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{r.name}</span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Campus Venue: Physical Dance Studio with mirror wall and sound system.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Automated Session Reminders (5h & 1h Prior) */}
      {activeTab === 'reminders' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#356AE6]">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Session Reminder System (5h & 1h Prior)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Monitors confirmed bookings and automatically notifies Administrators on WhatsApp and device notifications at 5 hours prior (studio keys & room prep) and 1 hour prior (final entry clearance).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={requestAppNotificationPermission}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  appNotificationsEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
                title="Toggle Real-Time Native App Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {appNotificationsEnabled ? 'App Alerts: Active' : 'Enable App Notifications'}
              </button>
              <button
                onClick={loadReminderData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={handleTriggerCheck}
                disabled={isCheckingReminders}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14213D] hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                title="Manually verify reminders immediately"
              >
                {isCheckingReminders ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Trigger Test Scan Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time automated background worker status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950">
            <div className="flex items-start sm:items-center gap-3">
              <span className="relative flex h-3 w-3 mt-1 sm:mt-0 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="font-extrabold text-emerald-900 flex items-center gap-2">
                  Automated Real-Time Background Daemon Active
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 uppercase tracking-wider">
                    24/7 Automated
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  The backend background worker continuously reads studio bookings and dispatches 5h &amp; 1h notifications in real time. No manual triggers required.
                </p>
              </div>
            </div>
          </div>

          {reminderCheckMessage && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold">{reminderCheckMessage}</span>
            </div>
          )}

          {/* Admin Phone Number Setting & Rules Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Phone Configuration Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#356AE6]" />
                <h4 className="text-sm font-bold text-slate-900">Admin Alert Phone Number</h4>
              </div>
              <p className="text-xs text-slate-500">
                Reminders for upcoming studio sessions will be sent to this WhatsApp contact.
              </p>

              <form onSubmit={handleSavePhone} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Primary WhatsApp Phone Number
                  </label>
                  <input
                    type="text"
                    value={adminPhoneInput}
                    onChange={(e) => setAdminPhoneInput(e.target.value)}
                    placeholder="+91 7010734009"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Include country code (e.g. +91)</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Secondary WhatsApp Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={adminPhoneInput2}
                    onChange={(e) => setAdminPhoneInput2(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Optional backup admin contact for alerts</p>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPhone}
                  className="w-full py-2.5 rounded-xl bg-[#14213D] hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isUpdatingPhone ? 'Saving...' : 'Save Phone Numbers'}
                </button>
              </form>

              {reminderData?.admin_phone_numbers && reminderData.admin_phone_numbers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Active Admin Contacts
                  </span>
                  <div className="space-y-1.5">
                    {reminderData.admin_phone_numbers.map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">@{a.username}</span>
                          <span className="font-mono text-emerald-700 text-[11px] font-semibold">{a.whatsapp_number || 'No primary set'}</span>
                        </div>
                        {a.whatsapp_number_2 && (
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
                            <span>Backup:</span>
                            <span className="font-mono text-blue-700 font-semibold">{a.whatsapp_number_2}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reminder Rules Card */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#356AE6]" />
                <h4 className="text-sm font-bold text-slate-900">Configured Automated Reminder Rules</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900">
                      Milestone 1
                    </span>
                    <span className="text-xs font-bold text-amber-900">T - 5 Hours</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">5 Hours Prior Notice</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Dispatched exactly 5 hours before rehearsal starts. Alerts the admin to verify studio readiness, key arrangement, and equipment preparation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-blue-200 text-blue-900">
                      Milestone 2
                    </span>
                    <span className="text-xs font-bold text-blue-900">T - 1 Hour</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">1 Hour Prior Final Notice</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Dispatched 1 hour before rehearsal begins. Final security and door clearance notice to ensure studio doors are unlocked for dancers.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Key className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">Deduplication Protection: </span>
                  Reminders are transactionally tracked in the audit trail. Each booking receives exactly one 5-hour reminder and one 1-hour reminder, avoiding duplicate messages.
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Sessions & Live Reminder Tracking Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">Upcoming Sessions & Live Reminder Tracking</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time status of 5-hour and 1-hour alerts for upcoming studio reservations.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {reminderData?.upcoming_bookings?.length || 0} Upcoming Sessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Booking</th>
                    <th className="py-3 px-4">Dance Team</th>
                    <th className="py-3 px-4">Studio Venue</th>
                    <th className="py-3 px-4">Session Timing</th>
                    <th className="py-3 px-4">5h Reminder</th>
                    <th className="py-3 px-4">1h Reminder</th>
                    <th className="py-3 px-4">Next Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {reminderData?.upcoming_bookings && reminderData.upcoming_bookings.length > 0 ? (
                    reminderData.upcoming_bookings.map((b) => (
                      <tr key={b.booking_id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">#{b.booking_id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{b.team_name}</td>
                        <td className="py-3 px-4 text-slate-600">{b.room_name}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {format(parseISO(b.start_at), 'dd MMM, hh:mm a')}
                        </td>
                        <td className="py-3 px-4">
                          {b.reminder_5h_sent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sent
                            </span>
                          ) : b.time_until_start_minutes <= 300 && b.time_until_start_minutes > 60 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" /> Due Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {b.reminder_1h_sent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sent
                            </span>
                          ) : b.time_until_start_minutes <= 60 && b.time_until_start_minutes > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" /> Due Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {b.next_reminder}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No upcoming sessions found in the rolling window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dispatched Reminders Log */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">Recent Reminder Dispatches Log</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit log of reminder events dispatched to admin contacts.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider sticky top-0 border-y border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Sent At</th>
                    <th className="py-3 px-4">Booking</th>
                    <th className="py-3 px-4">Milestone</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">WhatsApp Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reminderData?.recent_dispatches && reminderData.recent_dispatches.length > 0 ? (
                    reminderData.recent_dispatches.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {r.sent_at ? format(parseISO(r.sent_at), 'dd MMM, HH:mm:ss') : 'Just now'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">#{r.booking_id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.milestone === '5H' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {r.milestone === '5H' ? '5 Hours Prior' : '1 Hour Prior'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                          @{r.recipient_username} ({r.recipient_phone || 'No phone'})
                        </td>
                        <td className="py-3 px-4">
                          {r.whatsapp_url ? (
                            <a
                              href={r.whatsapp_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] border border-emerald-200 transition-colors"
                            >
                              <MessageSquare className="w-3 h-3 fill-current" /> Open in WhatsApp
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No reminders dispatched yet. Reminders trigger automatically 5 hours and 1 hour before each booking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Immutable Audit Logs</h3>
            <p className="text-xs text-slate-500 mt-1">
              All booking lifecycle and administrator actions recorded transactionally.
            </p>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider sticky top-0 border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {format(parseISO(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {log.actor?.username || `ID #${log.actor_id || 'System'}`}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600 font-mono text-[11px]">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== NEW ADMIN TABS ===================== */}

      {/* Events Planning Tab */}
      {activeTab === 'events' && (
        <EventsPlanningTab />
      )}

      {/* Event Reminders Tab */}
      {activeTab === 'event-reminders' && (
        <EventRemindersTab />
      )}

      {/* Custom Reminders Tab */}
      {activeTab === 'custom-reminders' && (
        <CustomRemindersTab />
      )}

      {/* Club Activities / Todo Tab */}
      {activeTab === 'todo' && (
        <ClubTodoTab />
      )}

      {/* Developer Credit */}
      <div className="mt-6 py-4 border-t border-slate-100 flex items-center justify-center">
        <p className="text-[11px] text-slate-400 font-medium tracking-wide">
          Designed &amp; Developed by{' '}
          <span className="font-bold text-slate-600">Swetha Adaikkammai</span>
        </p>
      </div>
    </div>
  );
};

/* =========================================================
   INLINE SUB-COMPONENTS FOR NEW ADMIN TABS
   ========================================================= */

const EventsPlanningTab: React.FC = () => {
  const [events, setEvents] = React.useState<{ id: number; title: string; date: string; venue: string; description: string; status: 'upcoming' | 'completed' | 'cancelled' }[]>(() => {
    try { return JSON.parse(localStorage.getItem('dc_events') || '[]'); } catch { return []; }
  });
  const [form, setForm] = React.useState({ title: '', date: '', venue: '', description: '' });
  const [editing, setEditing] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const save = (list: typeof events) => { localStorage.setItem('dc_events', JSON.stringify(list)); setEvents(list); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing !== null) {
      save(events.map(ev => ev.id === editing ? { ...ev, ...form } : ev));
      setEditing(null);
    } else {
      save([...events, { id: Date.now(), ...form, status: 'upcoming' as const }]);
    }
    setForm({ title: '', date: '', venue: '', description: '' });
    setShowForm(false);
  };

  const cycleStatus = (id: number) => {
    save(events.map(ev => {
      if (ev.id !== id) return ev;
      const next: Record<string, 'upcoming' | 'completed' | 'cancelled'> = { upcoming: 'completed', completed: 'cancelled', cancelled: 'upcoming' };
      return { ...ev, status: next[ev.status] };
    }));
  };

  const deleteEvent = (id: number) => save(events.filter(ev => ev.id !== id));

  const startEdit = (ev: typeof events[0]) => {
    setForm({ title: ev.title, date: ev.date, venue: ev.venue, description: ev.description });
    setEditing(ev.id);
    setShowForm(true);
  };

  const statusColor: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Event Planning</h3>
          <p className="text-xs text-slate-500 mt-0.5">Manage DC Studios club events, performances, and activities.</p>
        </div>
        <button
          onClick={() => { setForm({ title: '', date: '', venue: '', description: '' }); setEditing(null); setShowForm(s => !s); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#356AE6] text-white text-xs font-bold shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Add Event
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{editing !== null ? 'Edit Event' : 'New Event'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Event Title" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2" />
            <input required type="date" placeholder="Date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium" />
            <input placeholder="Venue / Location" value={form.venue} onChange={e => setForm(f => ({...f, venue: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium" />
            <textarea placeholder="Description / Notes" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200">Cancel</button>
            <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#356AE6]">{editing !== null ? 'Save Changes' : 'Create Event'}</button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">No events planned yet. Click "Add Event" to get started.</div>
      ) : (
        <div className="space-y-3">
          {events.sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
            <div key={ev.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">{ev.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[ev.status]}`}>{ev.status}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {ev.date && <span>📅 {ev.date}</span>}
                  {ev.venue && <span>📍 {ev.venue}</span>}
                </div>
                {ev.description && <p className="mt-1.5 text-xs text-slate-600">{ev.description}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => cycleStatus(ev.id)} title="Cycle Status" className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">Status ↻</button>
                <button onClick={() => startEdit(ev)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EventRemindersTab: React.FC = () => {
  const [reminders, setReminders] = React.useState<{ id: number; eventName: string; reminderDate: string; message: string; sent: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem('dc_event_reminders') || '[]'); } catch { return []; }
  });
  const [form, setForm] = React.useState({ eventName: '', reminderDate: '', message: '' });
  const [showForm, setShowForm] = React.useState(false);

  const save = (list: typeof reminders) => { localStorage.setItem('dc_event_reminders', JSON.stringify(list)); setReminders(list); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save([...reminders, { id: Date.now(), ...form, sent: false }]);
    setForm({ eventName: '', reminderDate: '', message: '' });
    setShowForm(false);
  };

  const markSent = (id: number) => save(reminders.map(r => r.id === id ? { ...r, sent: !r.sent } : r));
  const deleteReminder = (id: number) => save(reminders.filter(r => r.id !== id));

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Event Reminders</h3>
          <p className="text-xs text-slate-500 mt-0.5">Set reminders for upcoming DC Studios events and performances.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#356AE6] text-white text-xs font-bold shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Add Reminder
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Event Reminder</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Event Name" value={form.eventName} onChange={e => setForm(f => ({...f, eventName: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium" />
            <input required type="datetime-local" value={form.reminderDate} onChange={e => setForm(f => ({...f, reminderDate: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium" />
            <textarea required placeholder="Reminder message to send..." value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} rows={2} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200">Cancel</button>
            <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#356AE6]">Save Reminder</button>
          </div>
        </form>
      )}

      {reminders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">No event reminders set.</div>
      ) : (
        <div className="space-y-3">
          {reminders.sort((a, b) => a.reminderDate.localeCompare(b.reminderDate)).map(r => (
            <div key={r.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start gap-3 ${r.sent ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">{r.eventName}</span>
                  {r.sent && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Sent ✓</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">🔔 {r.reminderDate}</p>
                <p className="text-xs text-slate-700 mt-1">{r.message}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => markSent(r.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${r.sent ? 'bg-white border-slate-200 text-slate-700' : 'bg-emerald-100 border-emerald-200 text-emerald-800'}`}>{r.sent ? 'Mark Unsent' : 'Mark Sent'}</button>
                <button onClick={() => deleteReminder(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomRemindersTab: React.FC = () => {
  const [reminders, setReminders] = React.useState<{ id: number; title: string; date: string; repeat: 'none' | 'daily' | 'weekly' | 'monthly'; note: string; done: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem('dc_custom_reminders') || '[]'); } catch { return []; }
  });
  const [form, setForm] = React.useState({ title: '', date: '', repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly', note: '' });
  const [showForm, setShowForm] = React.useState(false);

  const save = (list: typeof reminders) => { localStorage.setItem('dc_custom_reminders', JSON.stringify(list)); setReminders(list); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save([...reminders, { id: Date.now(), ...form, done: false }]);
    setForm({ title: '', date: '', repeat: 'none', note: '' });
    setShowForm(false);
  };

  const toggle = (id: number) => save(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r));
  const del = (id: number) => save(reminders.filter(r => r.id !== id));

  const repeatColors: Record<string, string> = {
    none: 'bg-slate-100 text-slate-700',
    daily: 'bg-yellow-100 text-yellow-800',
    weekly: 'bg-blue-100 text-blue-800',
    monthly: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Custom Reminders</h3>
          <p className="text-xs text-slate-500 mt-0.5">Set recurring or one-time custom reminders for club admin tasks.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#356AE6] text-white text-xs font-bold shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          New Reminder
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Custom Reminder</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Reminder Title" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2" />
            <input required type="datetime-local" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium" />
            <select value={form.repeat} onChange={e => setForm(f => ({...f, repeat: e.target.value as typeof form.repeat}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium">
              <option value="none">No Repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <textarea placeholder="Notes (optional)" value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} rows={2} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200">Cancel</button>
            <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#356AE6]">Create</button>
          </div>
        </form>
      )}

      {reminders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">No custom reminders. Add one above.</div>
      ) : (
        <div className="space-y-3">
          {reminders.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
            <div key={r.id} className={`p-4 rounded-2xl border flex items-start gap-3 ${r.done ? 'opacity-60 bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
              <button onClick={() => toggle(r.id)} className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${r.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                {r.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm text-slate-900 ${r.done ? 'line-through' : ''}`}>{r.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${repeatColors[r.repeat]}`}>{r.repeat}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">🔔 {r.date}</p>
                {r.note && <p className="text-xs text-slate-600 mt-1">{r.note}</p>}
              </div>
              <button onClick={() => del(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ClubTodoTab: React.FC = () => {
  type Priority = 'low' | 'medium' | 'high';
  type Category = 'finance' | 'outreach' | 'pr' | 'editorial' | 'design';
  type TodoItem = { id: number; text: string; priority: Priority; category: Category; done: boolean; note: string; createdAt: string };

  const [items, setItems] = React.useState<TodoItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('dc_todos') || '[]'); } catch { return []; }
  });
  const [form, setForm] = React.useState({ text: '', priority: 'medium' as Priority, category: 'finance' as Category, note: '' });
  const [showForm, setShowForm] = React.useState(false);
  const [filterCat, setFilterCat] = React.useState<string>('all');
  const [filterDone, setFilterDone] = React.useState<string>('all');

  const save = (list: TodoItem[]) => { localStorage.setItem('dc_todos', JSON.stringify(list)); setItems(list); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save([{ id: Date.now(), ...form, done: false, createdAt: new Date().toISOString() }, ...items]);
    setForm({ text: '', priority: 'medium', category: 'finance', note: '' });
    setShowForm(false);
  };

  const toggle = (id: number) => save(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const del = (id: number) => save(items.filter(i => i.id !== id));

  const priorityColors: Record<Priority, string> = {
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    high: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  const categoryEmoji: Record<Category, string> = {
    finance: '💰', outreach: '📢', pr: '📣', editorial: '✏️', design: '🎨'
  };

  const filtered = items.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    if (filterDone === 'pending' && i.done) return false;
    if (filterDone === 'done' && !i.done) return false;
    return true;
  });

  const stats = { total: items.length, done: items.filter(i => i.done).length, pending: items.filter(i => !i.done).length };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Club Activities &amp; To-Do</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track club tasks, practice activities, and administrative action items.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#356AE6] text-white text-xs font-bold shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'Total', value: stats.total, color: 'bg-slate-50 border-slate-200 text-slate-700' },
          { label: 'Pending', value: stats.pending, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: 'Done', value: stats.done, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' }].map(s => (
          <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Task</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Task description..." value={form.text} onChange={e => setForm(f => ({...f, text: e.target.value}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2" />
            <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value as Priority}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium">
              <option value="low">🟢 Low Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="high">🔴 High Priority</option>
            </select>
            <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value as Category}))} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium">
              <option value="finance">💰 Finance</option>
              <option value="outreach">📢 Outreach</option>
              <option value="pr">📣 PR</option>
              <option value="editorial">✏️ Editorial</option>
              <option value="design">🎨 Design</option>
            </select>
            <textarea placeholder="Notes (optional)" value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} rows={2} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium sm:col-span-2 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200">Cancel</button>
            <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#356AE6]">Add Task</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700">
          <option value="all">All Categories</option>
          <option value="finance">💰 Finance</option>
          <option value="outreach">📢 Outreach</option>
          <option value="pr">📣 PR</option>
          <option value="editorial">✏️ Editorial</option>
          <option value="design">🎨 Design</option>
        </select>
        <select value={filterDone} onChange={e => setFilterDone(e.target.value)} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="done">Completed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">No tasks here. Add a task above!</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${item.done ? 'opacity-60 bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
              <button onClick={() => toggle(item.id)} className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                {item.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm text-slate-900 ${item.done ? 'line-through' : ''}`}>{item.text}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColors[item.priority]}`}>{item.priority}</span>
                  <span className="text-[11px] text-slate-500">{categoryEmoji[item.category]} {item.category}</span>
                </div>
                {item.note && <p className="text-xs text-slate-500 mt-1">{item.note}</p>}
              </div>
              <button onClick={() => del(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
