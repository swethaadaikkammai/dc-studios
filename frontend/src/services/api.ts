import {
  User,
  Booking,
  Team,
  Room,
  ClubSettings,
  AvailabilityResponse,
  AuditLog,
  BoardPermission,
  ReminderStatusResponse,
  ReminderDispatchRecord,
  BookingApproval
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Includes HTTP-only session cookies
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || 'An unexpected error occurred.';
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (username_or_email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email, password }),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request<{ user: User }>('/auth/me'),

  // Teams & Rooms
  getTeams: () => request<Team[]>('/teams'),
  getRooms: () => request<Room[]>('/rooms'),

  // Bookings
  getBookings: (params?: { start_date?: string; end_date?: string; room_id?: number; team_id?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.room_id) query.append('room_id', String(params.room_id));
    if (params?.team_id) query.append('team_id', String(params.team_id));
    if (params?.status) query.append('status', params.status);
    const qs = query.toString();
    return request<Booking[]>(`/bookings${qs ? `?${qs}` : ''}`);
  },

  getBooking: (id: number) => request<Booking>(`/bookings/${id}`),

  createBooking: (payload: { team_id: number; room_id: number; start_at: string; end_at: string; purpose?: string; keys_secured?: boolean }) =>
    request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelBooking: (id: number) =>
    request<{ message: string; booking: Booking }>(`/bookings/${id}/cancel`, {
      method: 'POST',
    }),

  // Availability & Settings
  getAvailability: (roomId: number, targetDate: string) =>
    request<AvailabilityResponse>(`/bookings/availability?room_id=${roomId}&target_date=${targetDate}`),

  getPublicSettings: () => request<ClubSettings>('/bookings/settings'),

  dispatchWhatsAppPass: (bookingId: number) =>
    request<any>(`/bookings/${bookingId}/dispatch-whatsapp`, {
      method: 'POST',
    }),

  // Administration
  getUsers: () => request<User[]>('/admin/users'),

  createUser: (payload: { username: string; email: string; password: string; role: string; team_id?: number | null; whatsapp_number?: string; whatsapp_number_2?: string; is_active?: boolean }) =>
    request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: number,
    payload: {
      username?: string;
      email?: string;
      role?: string;
      team_id?: number | null;
      whatsapp_number?: string;
      whatsapp_number_2?: string;
      is_active?: boolean;
      password?: string;
    }
  ) =>
    request<User>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  getSettings: () => request<ClubSettings>('/admin/settings'),

  updateSettings: (payload: Partial<ClubSettings>) =>
    request<ClubSettings>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getAuditLogs: (limit = 100, offset = 0) =>
    request<AuditLog[]>(`/admin/audit-logs?limit=${limit}&offset=${offset}`),

  getBoardPermissions: () => request<BoardPermission[]>('/admin/board-permissions'),

  setBoardPermission: (payload: { user_id: number; team_id: number; can_create_booking: boolean; can_cancel_any_booking?: boolean }) =>
    request<BoardPermission>('/admin/board-permissions', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateRoom: (id: number, payload: { name?: string; is_active?: boolean }) =>
    request<Room>(`/admin/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateTeam: (id: number, payload: { name?: string; is_active?: boolean }) =>
    request<Team>(`/admin/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Reminder System
  getRemindersStatus: () => request<ReminderStatusResponse>('/admin/reminders/status'),

  triggerRemindersCheck: () =>
    request<{ checked_at: string; total_dispatched: number; dispatches: ReminderDispatchRecord[]; message: string }>(
      '/admin/reminders/check',
      { method: 'POST' }
    ),

  updateAdminReminderPhone: (phoneNumber: string, phoneNumber2?: string) =>
    request<{ message: string; admin_id: number; username: string; whatsapp_number: string; whatsapp_number_2?: string }>(
      '/admin/reminders/phone',
      {
        method: 'PATCH',
        body: JSON.stringify({ phone_number: phoneNumber, phone_number_2: phoneNumber2 }),
      }
    ),

  // ── Booking Approvals (Team Head ↔ Admin workflow) ──
  submitBookingRequest: (payload: { team_id: number; room_id: number; start_at: string; end_at: string; purpose?: string; keys_secured?: boolean }) =>
    request<BookingApproval>('/approvals/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMyApprovalRequests: () => request<BookingApproval[]>('/approvals/my-requests'),

  getAllApprovalRequests: (status?: string) => {
    const qs = status ? `?approval_status=${status}` : '';
    return request<BookingApproval[]>(`/approvals${qs}`);
  },

  approveRequest: (approvalId: number) =>
    request<BookingApproval>(`/approvals/${approvalId}/approve`, { method: 'POST' }),

  rejectRequest: (approvalId: number, reason?: string) =>
    request<BookingApproval>(`/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', rejection_reason: reason }),
    }),
};

export { ApiError };
