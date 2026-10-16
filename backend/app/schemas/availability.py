from typing import List, Optional
from pydantic import BaseModel


class AvailabilitySlot(BaseModel):
    start_time: str
    end_time: str
    start_at: str
    end_at: str
    is_available: bool
    reason: str


class AvailabilityResponse(BaseModel):
    room_id: int
    room_name: str
    date: str
    server_now: str
    window_end: str
    time_remaining_seconds: int
    operating_hours: str
    slot_interval_minutes: int
    maximum_duration_minutes: int
    slots: List[AvailabilitySlot]
