from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class BoardTeamPermission(Base):
    __tablename__ = "board_team_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    can_create_booking = Column(Boolean, default=True, nullable=False)
    can_cancel_any_booking = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "team_id", name="uq_user_team_permission"),
    )

    # Relationships
    user = relationship("User", back_populates="board_permissions")
    team = relationship("Team", back_populates="board_permissions")
