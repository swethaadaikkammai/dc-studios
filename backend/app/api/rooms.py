from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.room import Room
from app.models.user import User
from app.schemas.room import RoomRead

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomRead])
def list_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lists the active dance studios (PRP201 and PRP202)."""
    return db.query(Room).filter(Room.is_active.is_(True)).order_by(Room.name.asc()).all()
