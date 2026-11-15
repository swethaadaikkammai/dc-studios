from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.db.session import Base


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, index=True)
    team_name = Column(String(100), nullable=True)
    whatsapp_number = Column(String(30), nullable=True)
    status = Column(String(20), default="PENDING", nullable=False, index=True)  # "PENDING", "RESOLVED"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_notes = Column(String(255), nullable=True)
