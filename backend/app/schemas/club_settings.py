from typing import Optional
from pydantic import BaseModel, ConfigDict


class ClubSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timezone: str
    opening_time: str
    closing_time: str
    slot_interval_minutes: int
    maximum_duration_minutes: int
    advance_booking_hours: int
    cancellation_cutoff_minutes: int
    daily_team_quota_minutes: int
    weekend_keys_secured: bool = False


class ClubSettingsUpdate(BaseModel):
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    slot_interval_minutes: Optional[int] = None
    maximum_duration_minutes: Optional[int] = None
    advance_booking_hours: Optional[int] = None
    cancellation_cutoff_minutes: Optional[int] = None
    daily_team_quota_minutes: Optional[int] = None
    weekend_keys_secured: Optional[bool] = None
