from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class BookingApprovalCreate(BaseModel):
    """Submitted by a Team Head to request a room booking."""
    team_id: int
    room_id: int
    start_at: datetime
    end_at: datetime
    purpose: Optional[str] = None
    keys_secured: Optional[bool] = False


class BookingApprovalReview(BaseModel):
    """Admin action: approve or reject a pending request."""
    action: str           # "APPROVE" or "REJECT"
    rejection_reason: Optional[str] = None


class CompetingConflictInfo(BaseModel):
    rival_approval_id: int
    rival_team_name: str
    rival_requester_username: str
    rival_requested_at: datetime
    rival_created_at_ms: int
    time_difference_ms: int        # positive if rival is later, negative if rival was earlier
    is_earlier: bool               # True if current approval arrived before rival
    overlap_start_at: datetime
    overlap_end_at: datetime


class BookingApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    requested_by: int
    team_id: int
    room_id: int
    start_at: datetime
    end_at: datetime
    purpose: Optional[str] = None
    is_weekend_request: str
    approval_status: str
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    booking_id: Optional[int] = None
    created_at: datetime
    created_at_ms: Optional[int] = None
    updated_at: Optional[datetime] = None
    admin_notified_at: Optional[datetime] = None
    admin_whatsapp_url: Optional[str] = None
    admin_whatsapp_url_2: Optional[str] = None
    confirmation_whatsapp_url: Optional[str] = None
    whatsapp_confirmation_url: Optional[str] = None

    # Flattened display fields (populated manually in the endpoint)
    requester_username: Optional[str] = None
    team_name: Optional[str] = None
    room_name: Optional[str] = None

    # Millisecond Conflict & Race Resolution fields
    has_conflict: bool = False
    is_first_requester: Optional[bool] = None
    conflict_delta_ms: Optional[int] = None
    competing_request: Optional[CompetingConflictInfo] = None
