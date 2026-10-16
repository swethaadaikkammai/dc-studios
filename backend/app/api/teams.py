from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.team import Team
from app.models.user import User
from app.schemas.team import TeamRead

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.get("", response_model=List[TeamRead])
def list_teams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lists all active dance teams in the club."""
    return db.query(Team).filter(Team.is_active.is_(True)).order_by(Team.name.asc()).all()
