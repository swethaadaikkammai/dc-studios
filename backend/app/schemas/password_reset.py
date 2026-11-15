from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ForgotPasswordRequest(BaseModel):
    username: str
    contact_phone: Optional[str] = None
    note: Optional[str] = None


class ForgotPasswordResponse(BaseModel):
    message: str
    request_id: Optional[int] = None
    admin_whatsapp_url: Optional[str] = None
    admin_whatsapp_url_2: Optional[str] = None


class PasswordResetRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    team_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    admin_notes: Optional[str] = None


class ResolvePasswordResetRequest(BaseModel):
    new_password: Optional[str] = None
    notes: Optional[str] = None
