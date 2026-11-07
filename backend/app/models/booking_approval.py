from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class BookingApproval(Base):
    """
    Tracks approval workflow for Team Head booking requests.
    When a Team Head submits a booking it starts as PENDING here;
    Admin approves/rejects, which then creates/discards the actual Booking.
    """
    __tablename__ = "booking_approvals"

    id = Column(Integer, primary_key=True, index=True)
    # Who requested it
    requested_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False, index=True)
    purpose = Column(Text, nullable=True)
    is_weekend_request = Column(String(5), nullable=False, default="false")  # "true"/"false"

    # Approval lifecycle
    # PENDING | APPROVED | REJECTED | CANCELLED
    approval_status = Column(String(20), nullable=False, default="PENDING", index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Once approved, the actual booking ID is linked here
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at_ms = Column(BigInteger, nullable=True, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # WhatsApp notification tracking
    admin_notified_at = Column(DateTime(timezone=True), nullable=True)
    admin_whatsapp_url = Column(Text, nullable=True)
    admin_whatsapp_url_2 = Column(Text, nullable=True)
    confirmation_whatsapp_url = Column(Text, nullable=True)

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    team = relationship("Team")
    room = relationship("Room")
    booking = relationship("Booking", foreign_keys=[booking_id])
