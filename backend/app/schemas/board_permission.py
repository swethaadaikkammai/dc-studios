from pydantic import BaseModel, ConfigDict
from typing import Optional


class BoardPermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    team_id: int
    can_create_booking: bool
    can_cancel_any_booking: bool


class BoardPermissionUpdate(BaseModel):
    user_id: int
    team_id: int
    can_create_booking: bool
    can_cancel_any_booking: bool = False
