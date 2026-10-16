from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="CONFIRMED", index=True)  # "CONFIRMED", "CANCELLED", "COMPLETED"
    purpose = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        ExcludeConstraint(
            ("room_id", "="),
            (func.tstzrange(text("start_at"), text("end_at"), text("'[)'")), "&&"),
            where=text("status = 'CONFIRMED'"),
            name="uq_no_overlapping_active_bookings"
        ),
    )

    # Relationships
    team = relationship("Team", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")
    creator = relationship("User", foreign_keys=[created_by], back_populates="bookings_created")
    canceller = relationship("User", foreign_keys=[cancelled_by])
