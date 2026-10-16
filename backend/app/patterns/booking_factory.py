from datetime import datetime
from typing import Optional
from app.models.booking import Booking
from app.core.time_utils import (
    ensure_campus_timezone,
    is_within_rolling_72h_window,
    validate_slot_operating_hours
)
from app.core.exceptions import (
    WindowViolationException,
    OperatingHoursException,
    BookingException
)
from app.patterns.club_config_singleton import ClubConfig


class BookingFactory:
    """
    Factory Method Pattern: BookingFactory
    
    Encapsulates creation and preliminary domain validation of Booking domain objects.
    Enforces that every instantiated Booking is well-formed, satisfies operating hours,
    adheres to 30-min slot intervals, does not exceed maximum duration, and strictly
    falls within the rolling 72-hour advance booking window based on server time.
    """

    @classmethod
    def create_booking(
        cls,
        team_id: int,
        room_id: int,
        created_by: int,
        start_at: datetime,
        end_at: datetime,
        server_now: datetime,
        purpose: Optional[str] = None,
        config: Optional[ClubConfig] = None
    ) -> Booking:
        if not team_id or not room_id or not created_by:
            raise BookingException("Team ID, Room ID, and Creator ID are required.", status_code=400)

        cfg = config or ClubConfig.get_instance()

        start_tz = ensure_campus_timezone(start_at)
        end_tz = ensure_campus_timezone(end_at)
        now_tz = ensure_campus_timezone(server_now)

        # 1. Enforce Mandatory Rolling 72-Hour Advance Booking Rule
        in_window, window_error = is_within_rolling_72h_window(
            start_at=start_tz,
            server_now=now_tz,
            advance_hours=cfg.advance_booking_hours
        )
        if not in_window:
            raise WindowViolationException(window_error)

        # 2. Enforce Operating Hours, Interval, and Max Duration Constraints
        valid_hours, hours_error = validate_slot_operating_hours(
            start_at=start_tz,
            end_at=end_tz,
            opening_time_str=cfg.opening_time,
            closing_time_str=cfg.closing_time,
            slot_interval_minutes=cfg.slot_interval_minutes,
            max_duration_minutes=cfg.maximum_duration_minutes
        )
        if not valid_hours:
            raise OperatingHoursException(hours_error)

        # 3. Construct and return initialized Booking domain model in CONFIRMED state
        return Booking(
            team_id=team_id,
            room_id=room_id,
            created_by=created_by,
            start_at=start_tz,
            end_at=end_tz,
            status="CONFIRMED",
            purpose=purpose.strip() if purpose else None
        )
