from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_active: bool
    created_at: datetime


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
