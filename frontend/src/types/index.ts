export type UserRole = "ADMIN" | "BOARD_MEMBER" | "TEAM_HEAD" | "EVENTS_HEAD";

export interface Team {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Room {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface BoardPermission {
  id?: number;
  user_id?: number;
  team_id: number;
  can_create_booking: boolean;
  can_cancel_any_booking: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  team_id: number | null;
  team?: { id: number; name: string } | null;
  whatsapp_number?: string | null;
  whatsapp_number_2?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  board_permissions: BoardPermission[];
}

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface WhatsAppPassInfo {
  team_head_name?: string | null;
  whatsapp_number?: string | null;
  pass_text: string;
  whatsapp_url?: string | null;
  whatsapp_chat_url?: string | null;
  pass_image_url?: string | null;
  status: string;
}

export interface Booking {
  id: number;
  team_id: number;
  room_id: number;
  created_by: number;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  purpose: string | null;
  created_at: string;
  updated_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: number | null;
  team?: Team | null;
  room?: Room | null;
  creator?: { id: number; username: string } | null;
  canceller?: { id: number; username: string } | null;
  whatsapp_pass?: WhatsAppPassInfo | null;
}

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  is_available: boolean;
  reason: string;
  can_admin_override?: boolean;
}

export interface AvailabilityResponse {
  room_id: number;
  room_name: string;
  date: string;
  server_now: string;
  window_end: string;
  time_remaining_seconds: number;
  operating_hours: string;
  slot_interval_minutes: number;
  maximum_duration_minutes: number;
  slots: AvailabilitySlot[];
}

export interface ClubSettings {
  id: number;
  timezone: string;
  opening_time: string;
  closing_time: string;
  slot_interval_minutes: number;
  maximum_duration_minutes: number;
  advance_booking_hours: number;
  cancellation_cutoff_minutes: number;
  daily_team_quota_minutes: number;
  weekend_keys_secured: boolean;
}

export interface CompetingConflictInfo {
  rival_approval_id: number;
  rival_team_name: string;
  rival_requester_username: string;
  rival_requested_at: string;
  rival_created_at_ms: number;
  time_difference_ms: number;
  is_earlier: boolean;
  overlap_start_at: string;
  overlap_end_at: string;
}

export interface BookingApproval {
  id: number;
  requested_by: number;
  team_id: number;
  room_id: number;
  start_at: string;
  end_at: string;
  purpose: string | null;
  is_weekend_request: string;
  approval_status: ApprovalStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  booking_id: number | null;
  created_at: string;
  created_at_ms?: number | null;
  updated_at: string | null;
  admin_notified_at: string | null;
  admin_whatsapp_url: string | null;
  admin_whatsapp_url_2?: string | null;
  confirmation_whatsapp_url?: string | null;
  whatsapp_confirmation_url?: string | null;
  requester_username: string | null;
  team_name: string | null;
  room_name: string | null;
  has_conflict?: boolean;
  is_first_requester?: boolean | null;
  conflict_delta_ms?: number | null;
  competing_request?: CompetingConflictInfo | null;
}

export interface AuditLog {
  id: number;
  actor_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  timestamp: string;
  details: string | null;
  actor?: User | null;
}

export interface AdminPhoneInfo {
  id: number;
  username: string;
  email: string;
  whatsapp_number?: string | null;
  whatsapp_number_2?: string | null;
}

export interface ReminderRuleInfo {
  milestone: string;
  hours_prior: number;
  description: string;
}

export interface UpcomingBookingReminderInfo {
  booking_id: number;
  team_id: number;
  team_name: string;
  room_id: number;
  room_name: string;
  start_at: string;
  end_at: string;
  time_until_start_minutes: number;
  reminder_5h_sent: boolean;
  reminder_1h_sent: boolean;
  reminder_5h_sent_at?: string | null;
  reminder_1h_sent_at?: string | null;
  next_reminder?: string | null;
}

export interface ReminderDispatchRecord {
  booking_id: number;
  milestone: string;
  recipient_phone?: string | null;
  recipient_username: string;
  sent_at: string;
  reminder_text: string;
  whatsapp_url?: string | null;
}

export interface ReminderStatusResponse {
  admin_phone_numbers: AdminPhoneInfo[];
  reminder_rules: ReminderRuleInfo[];
  upcoming_bookings: UpcomingBookingReminderInfo[];
  recent_dispatches: ReminderDispatchRecord[];
}
