from sqlalchemy import Column, Integer, String
from app.db.session import Base


class ClubSettings(Base):
    __tablename__ = "club_settings"

    id = Column(Integer, primary_key=True, index=True)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    opening_time = Column(String(10), default="09:00", nullable=False)
    closing_time = Column(String(10), default="19:00", nullable=False)
    slot_interval_minutes = Column(Integer, default=30, nullable=False)
    maximum_duration_minutes = Column(Integer, default=240, nullable=False)
    advance_booking_hours = Column(Integer, default=72, nullable=False)
    cancellation_cutoff_minutes = Column(Integer, default=0, nullable=False)
    daily_team_quota_minutes = Column(Integer, default=0, nullable=False)  # 0 means unlimited
