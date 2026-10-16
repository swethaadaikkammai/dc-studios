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
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  board_permissions: BoardPermission[];
}

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

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
