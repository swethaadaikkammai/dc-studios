from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class AdminPhoneInfo(BaseModel):
    id: int
    username: str
    email: str
    whatsapp_number: Optional[str] = None
    whatsapp_number_2: Optional[str] = None


class ReminderRuleInfo(BaseModel):
    milestone: str
    hours_prior: int
    description: str


class UpcomingBookingReminderInfo(BaseModel):
    booking_id: int
    team_id: int
    team_name: str
    room_id: int
    room_name: str
    start_at: str
    end_at: str
    time_until_start_minutes: int
    reminder_5h_sent: bool
    reminder_1h_sent: bool
    reminder_5h_sent_at: Optional[str] = None
    reminder_1h_sent_at: Optional[str] = None
    next_reminder: Optional[str] = None


class ReminderDispatchRecord(BaseModel):
    booking_id: int
    milestone: str
    recipient_phone: Optional[str] = None
    recipient_username: str
    sent_at: str
    reminder_text: str
    whatsapp_url: Optional[str] = None


class ReminderStatusResponse(BaseModel):
    admin_phone_numbers: List[AdminPhoneInfo]
    reminder_rules: List[ReminderRuleInfo]
    upcoming_bookings: List[UpcomingBookingReminderInfo]
    recent_dispatches: List[ReminderDispatchRecord]


class CheckRemindersResponse(BaseModel):
    checked_at: str
    total_dispatched: int
    dispatches: List[ReminderDispatchRecord]
    message: str


class AdminPhoneUpdate(BaseModel):
    phone_number: str
    phone_number_2: Optional[str] = None
