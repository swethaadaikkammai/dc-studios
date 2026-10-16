from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.team import TeamRead
from app.schemas.room import RoomRead


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str


class BookingCreate(BaseModel):
    team_id: int
    room_id: int
    start_at: datetime
    end_at: datetime
    purpose: Optional[str] = None


class WhatsAppPassInfo(BaseModel):
    team_head_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    pass_text: str
    whatsapp_url: Optional[str] = None
    whatsapp_chat_url: Optional[str] = None
    pass_image_url: Optional[str] = None
    status: str = "DISPATCHED"


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    team_id: int
    room_id: int
    created_by: int
    start_at: datetime
    end_at: datetime
    status: str
    purpose: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[int] = None
    team: Optional[TeamRead] = None
    room: Optional[RoomRead] = None
    creator: Optional[UserBrief] = None
    canceller: Optional[UserBrief] = None
    whatsapp_pass: Optional[WhatsAppPassInfo] = None


class BookingCancelResponse(BaseModel):
    message: str
    booking: BookingRead
