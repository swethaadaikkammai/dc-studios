import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  User,
  Team,
  Room,
  ClubSettings,
  AuditLog,
  BoardPermission
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
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'settings' | 'rooms' | 'audit'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [permissions, setPermissions] = useState<BoardPermission[]>([]);

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
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('BOARD_MEMBER');
  const [editTeamId, setEditTeamId] = useState<string>('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Delete User State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Settings Edit State
  const [settingsForm, setSettingsForm] = useState<Partial<ClubSettings>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);
  const [settingsErrorMsg, setSettingsErrorMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [u, t, r, s, a, p] = await Promise.all([
        api.getUsers(),
        api.getTeams(),
        api.getRooms(),
        api.getSettings(),
        api.getAuditLogs(100),
        api.getBoardPermissions(),
      ]);
      setUsers(u);
      setTeams(t);
      setRooms(r);
      setSettings(s);
      setSettingsForm(s);
      setAuditLogs(a);
      setPermissions(p);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load administrator data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        team_id: newTeamId ? Number(newTeamId) : null,
        whatsapp_number: newWhatsApp.trim() || undefined,
      });
      setMessage(`User @${newUsername} provisioned successfully with WhatsApp ${newWhatsApp || 'not set'}.`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewWhatsApp('');
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
    setEditEmail(u.email);
    setEditPassword('');
    setEditRole(u.role);
    setEditTeamId(u.team_id ? String(u.team_id) : '');
    setEditWhatsApp(u.whatsapp_number || '');
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
        email: editEmail.trim(),
        role: editRole,
        team_id: editTeamId ? Number(editTeamId) : null,
        whatsapp_number: editWhatsApp.trim() || undefined,
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
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit text-xs font-bold">
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
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Audit Trail ({auditLogs.length})
        </button>
      </div>

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
                  type="email"
                  required
                  placeholder="Official Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
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
                  placeholder="WhatsApp Contact (e.g. +91 98765 43210)"
                  value={newWhatsApp}
                  onChange={(e) => setNewWhatsApp(e.target.value)}
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
                  <th className="py-3 px-4">Email</th>
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
                    <td className="py-3 px-4">{u.email}</td>
                    <td className="py-3 px-4 font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">{u.team?.name || '—'}</td>
                    <td className="py-3 px-4">
                      {u.whatsapp_number ? (
                        <div className="inline-flex items-center gap-1.5 text-slate-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{u.whatsapp_number}</span>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Contact Number
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={editWhatsApp}
                  onChange={(e) => setEditWhatsApp(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Used for automated digital booking pass dispatch</p>
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
              ⏰ {settings.opening_time} - {settings.closing_time} IST
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold">
              ⏱️ Max {settings.maximum_duration_minutes || 240} mins ({((settings.maximum_duration_minutes || 240) / 60).toFixed(0)} hrs)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
              ⏳ {settings.advance_booking_hours}h advance window
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

      {/* Tab 5: Audit Trail */}
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
    </div>
  );
};
