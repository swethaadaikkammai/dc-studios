from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserRead


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actor_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    timestamp: datetime
    details: Optional[str] = None
    actor: Optional[UserRead] = None
