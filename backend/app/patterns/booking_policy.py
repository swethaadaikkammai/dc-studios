from abc import ABC, abstractmethod
from datetime import datetime
from typing import Tuple
from sqlalchemy.orm import Session
from app.models.booking import Booking
from app.core.time_utils import ensure_campus_timezone


class BookingPolicy(ABC):
    """
    Strategy Pattern: BookingPolicy Interface
    
    Defines interchangeable algorithmic booking validation strategies.
    Injected into BookingService to govern booking acceptance criteria.
    """

    @abstractmethod
    def validate_booking_eligibility(
        self,
        db: Session,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        server_now: datetime
    ) -> Tuple[bool, str]:
        """Validates whether the requested booking complies with the active policy."""
        pass


class FirstComeFirstServedPolicy(BookingPolicy):
    """
    Default Strategy: First-Come, First-Served (FCFS) Policy.
    Any valid slot is available to the first requester whose transaction commits.
    Does not restrict cumulative team booking hours.
    """

    def validate_booking_eligibility(
        self,
        db: Session,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        server_now: datetime
    ) -> Tuple[bool, str]:
        # Under pure FCFS, any well-formed request is eligible to compete for database reservation
        return True, ""


class TeamQuotaPolicy(BookingPolicy):
    """
    Alternative Strategy: Team Quota Policy.
    Limits the total duration a team can reserve across all rooms within a single local calendar day.
    """

    def __init__(self, max_daily_minutes_per_team: int = 120):
        self.max_daily_minutes = max_daily_minutes_per_team

    def validate_booking_eligibility(
        self,
        db: Session,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        server_now: datetime
    ) -> Tuple[bool, str]:
        if self.max_daily_minutes <= 0:
            return True, ""

        start_tz = ensure_campus_timezone(start_at)
        end_tz = ensure_campus_timezone(end_at)
        booking_date = start_tz.date()

        # Requested duration in minutes
        requested_minutes = int((end_tz - start_tz).total_seconds() / 60)

        # Query all existing confirmed bookings for this team on the same local date
        existing_bookings = db.query(Booking).filter(
            Booking.team_id == team_id,
            Booking.status == "CONFIRMED"
        ).all()

        daily_total_minutes = 0
        for b in existing_bookings:
            b_start = ensure_campus_timezone(b.start_at)
            b_end = ensure_campus_timezone(b.end_at)
            if b_start.date() == booking_date:
                daily_total_minutes += int((b_end - b_start).total_seconds() / 60)

        if daily_total_minutes + requested_minutes > self.max_daily_minutes:
            return False, (
                f"Team quota exceeded for {booking_date}. Team already has {daily_total_minutes} mins booked; "
                f"adding {requested_minutes} mins exceeds daily limit of {self.max_daily_minutes} mins."
            )

        return True, ""
