from datetime import datetime
from typing import List, Optional
import re
from urllib.parse import quote
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import pytz

from app.models.booking import Booking
from app.models.booking_approval import BookingApproval
from app.models.room import Room
from app.models.team import Team
from app.models.user import User
from app.core.time_utils import get_authoritative_server_now, ensure_campus_timezone
from app.core.exceptions import (
    BookingConflictException,
    BookingException,
    WindowViolationException
)
from app.patterns.authorization_proxy import IBookingService
from app.patterns.booking_factory import BookingFactory
from app.patterns.booking_policy import BookingPolicy, FirstComeFirstServedPolicy, TeamQuotaPolicy
from app.patterns.booking_state import get_booking_state
from app.patterns.booking_observer import booking_publisher, BookingEvent
from app.patterns.club_config_singleton import ClubConfig


class BookingService(IBookingService):
    """
    Core BookingService implementing business logic, FCFS booking engine,
    and PostgreSQL transaction management.
    """

    def __init__(self, policy: Optional[BookingPolicy] = None):
        self.policy: BookingPolicy = policy or FirstComeFirstServedPolicy()

    def set_policy(self, policy: BookingPolicy):
        self.policy = policy

    def create_booking(
        self,
        db: Session,
        actor: User,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        purpose: Optional[str] = None,
        clock: Optional[datetime] = None,
        keys_secured: bool = False
    ) -> Booking:
        # Step 1: Capture authoritative server timestamp (or deterministic clock for testing)
        server_now = clock or get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        # Step 2: Validate Room exists and is active
        room = db.query(Room).filter(Room.id == room_id, Room.is_active.is_(True)).first()
        if not room:
            raise BookingException(f"Studio room with ID {room_id} is inactive or does not exist.", status_code=400)

        # Step 3: Validate Team exists and is active
        team = db.query(Team).filter(Team.id == team_id, Team.is_active.is_(True)).first()
        if not team:
            raise BookingException(f"Dance team with ID {team_id} is inactive or does not exist.", status_code=400)

        # Step 4: Validate Strategy Policy (e.g. FCFS or Team Quotas)
        eligible, policy_reason = self.policy.validate_booking_eligibility(
            db=db,
            team_id=team_id,
            room_id=room_id,
            start_at=start_at,
            end_at=end_at,
            server_now=server_now
        )
        if not eligible:
            raise BookingException(policy_reason, status_code=422)

        # Step 5: Factory Method validation (72h window, operating hours, interval, max duration)
        cfg = ClubConfig.get_instance()
        booking = BookingFactory.create_booking(
            team_id=team_id,
            room_id=room_id,
            created_by=actor.id,
            start_at=start_at,
            end_at=end_at,
            server_now=server_now,
            purpose=purpose,
            config=cfg,
            keys_secured=keys_secured
        )

        # Step 6: Database Transaction with Re-Validation and Atomic Conflict Protection
        try:
            # Recheck 72h window immediately before committing
            recheck_now = ensure_campus_timezone(clock or get_authoritative_server_now())
            if ensure_campus_timezone(booking.start_at) < recheck_now:
                raise WindowViolationException("Slot expired between submission and database transaction.")

            # SQLite-compatible overlap check (replaces PostgreSQL GiST exclusion constraint)
            overlap = db.query(Booking).filter(
                Booking.room_id == room_id,
                Booking.status == "CONFIRMED",
                Booking.start_at < end_at,
                Booking.end_at > start_at
            ).first()
            if overlap:
                raise BookingConflictException(
                    f"Room '{room.name}' has already been booked for an overlapping time slot by another member. "
                    "Studio slots are reserved on a first-come, first-served basis."
                )

            db.add(booking)
            db.flush()

            # Publish BookingCreated event to transactional observers
            event = BookingEvent(
                event_type="BOOKING_CREATED",
                booking_id=booking.id,
                actor_id=actor.id,
                team_id=team.id,
                room_id=room.id,
                timestamp=server_now,
                details={
                    "start_at": booking.start_at.isoformat(),
                    "end_at": booking.end_at.isoformat(),
                    "room_name": room.name,
                    "team_name": team.name,
                    "purpose": booking.purpose
                }
            )
            booking_publisher.notify(event, db)

            db.commit()
            db.refresh(booking)
            return booking

        except IntegrityError as e:
            db.rollback()
            raise BookingException(f"Database constraint error: {e}", status_code=409)
        except Exception as e:
            db.rollback()
            raise e

    def cancel_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int,
        clock: Optional[datetime] = None,
        reason: Optional[str] = None
    ) -> Booking:
        server_now = clock or get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise BookingException(f"Booking with ID {booking_id} does not exist.", status_code=404)

        # Use State Pattern to transition from CONFIRMED -> CANCELLED
        cfg = ClubConfig.get_instance()
        current_state = get_booking_state(booking.status)
        
        # State pattern handles validity and updates booking model
        new_state = current_state.cancel(
            booking=booking,
            user=actor,
            server_now=server_now,
            cutoff_minutes=cfg.cancellation_cutoff_minutes
        )

        booking.cancellation_reason = reason
        booking.cancelled_by = actor.id

        # Cleanly update linked approval if any exists
        approval = db.query(BookingApproval).filter(BookingApproval.booking_id == booking.id).first()
        if approval:
            approval.approval_status = "CANCELLED"
            approval.rejection_reason = reason or "Cancelled by Administrator"

        # Generate WhatsApp dispatch URL addressed to Team Head if cancelled by Admin
        if actor.role == "ADMIN":
            team_head = (
                db.query(User).filter(User.team_id == booking.team_id, User.role == "TEAM_HEAD").first() or
                (db.query(User).filter(User.id == booking.created_by).first() if booking.created_by != actor.id else None)
            )
            phone = team_head.whatsapp_number if team_head and team_head.whatsapp_number else None
            # Fallback to any active phone or default admin notification contact if none
            if not phone and team_head and team_head.whatsapp_number_2:
                phone = team_head.whatsapp_number_2
            if not phone:
                phone = "917010734009"  # Default contact if team head has no phone on record
            if phone:
                clean_digits = re.sub(r'[^0-9]', '', str(phone))
                if len(clean_digits) == 10:
                    clean_digits = "91" + clean_digits
                team_title = booking.team.name if booking.team else f"Team #{booking.team_id}"
                room_title = booking.room.name if booking.room else f"Room #{booking.room_id}"
                start_str = booking.start_at.strftime("%d %b %Y, %I:%M %p")
                end_str = booking.end_at.strftime("%I:%M %p")
                reason_str = reason or "Administrative slot adjustment"
                msg = (
                    f"*DC STUDIOS — BOOKING CANCELLED*\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"*Booking ID:* #{booking.id}\n"
                    f"*Team:* {team_title}\n"
                    f"*Studio:* {room_title}\n"
                    f"*Slot:* {start_str} – {end_str} IST\n"
                    f"*Cancellation Reason:* {reason_str}\n"
                    f"*Cancelled By:* Administrator (@{actor.username})\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"This studio slot has been released back to availability."
                )
                booking.cancellation_whatsapp_url = f"https://api.whatsapp.com/send?phone={clean_digits}&text={quote(msg)}"

        # Transactionally notify observers (Audit and Availability refresh)
        event = BookingEvent(
            event_type="BOOKING_CANCELLED",
            booking_id=booking.id,
            actor_id=actor.id,
            team_id=booking.team_id,
            room_id=booking.room_id,
            timestamp=server_now,
            details={
                "cancelled_by": actor.username,
                "cancelled_at": server_now.isoformat(),
                "start_at": booking.start_at.isoformat(),
                "end_at": booking.end_at.isoformat(),
                "reason": reason
            }
        )
        booking_publisher.notify(event, db)

        db.commit()
        db.refresh(booking)
        return booking

    def get_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int
    ) -> Optional[Booking]:
        return db.query(Booking).filter(Booking.id == booking_id).first()

    def list_bookings(
        self,
        db: Session,
        actor: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        room_id: Optional[int] = None,
        team_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[Booking]:
        query = db.query(Booking)

        if start_date:
            query = query.filter(Booking.end_at >= start_date)
        if end_date:
            query = query.filter(Booking.start_at <= end_date)
        if room_id:
            query = query.filter(Booking.room_id == room_id)
        if team_id:
            query = query.filter(Booking.team_id == team_id)
        if status:
            query = query.filter(Booking.status == status.upper())

        return query.order_by(Booking.start_at.asc()).all()
