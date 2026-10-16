from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class TeamBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class BoardPermissionBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    team_id: int
    can_create_booking: bool
    can_cancel_any_booking: bool


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    role: str
    team_id: Optional[int] = None
    team: Optional[TeamBrief] = None
    whatsapp_number: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    board_permissions: List[BoardPermissionBrief] = []


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str
    team_id: Optional[int] = None
    whatsapp_number: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    team_id: Optional[int] = None
    whatsapp_number: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
