from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import pytz

from app.models.room import Room
from app.models.booking import Booking
from app.core.time_utils import (
    get_authoritative_server_now,
    ensure_campus_timezone,
    campus_tz,
    parse_time_str
)
from app.patterns.club_config_singleton import ClubConfig


class AvailabilityService:
    """
    Computes real-time studio availability factoring in:
    - Server authoritative rolling 72-hour window
    - Opening and closing operating hours
    - 30-minute slot intervals
    - Existing active CONFIRMED room reservations
    """

    @classmethod
    def get_room_availability(
        cls,
        db: Session,
        room_id: int,
        target_date: date,
        clock: Optional[datetime] = None
    ) -> Dict[str, Any]:
        server_now = clock or get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        cfg = ClubConfig.get_instance()
        window_end = server_now + timedelta(hours=cfg.advance_booking_hours)

        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            return {"error": f"Room ID {room_id} not found."}

        opening_time = parse_time_str(cfg.opening_time)
        closing_time = parse_time_str(cfg.closing_time)
        slot_interval = timedelta(minutes=cfg.slot_interval_minutes)

        day_start = campus_tz.localize(datetime.combine(target_date, opening_time))
        day_end = campus_tz.localize(datetime.combine(target_date, closing_time))

        # Query confirmed bookings for this room that intersect this local day
        existing_bookings = db.query(Booking).filter(
            Booking.room_id == room_id,
            Booking.status == "CONFIRMED",
            Booking.end_at > day_start,
            Booking.start_at < day_end
        ).all()

        slots = []
        current_slot_start = day_start

        while current_slot_start < day_end:
            current_slot_end = current_slot_start + slot_interval

            is_available = True
            reason = "Available"

            # 1. Past check
            if current_slot_start < server_now:
                is_available = False
                reason = "Past slot"

            # 2. Rolling 72-hour boundary check (exclusive)
            elif current_slot_start >= window_end:
                is_available = False
                reason = "Outside 72-hour window"

            # 3. Weekend advance booking check (must be booked at least 24 hours prior)
            elif current_slot_start.weekday() in (5, 6) and (current_slot_start - server_now) < timedelta(hours=24):
                is_available = False
                reason = "Weekend bookings require 24h prior notice"

            # 4. Collision with confirmed booking in the same room
            else:
                for b in existing_bookings:
                    b_start = ensure_campus_timezone(b.start_at)
                    b_end = ensure_campus_timezone(b.end_at)
                    # Check half-open overlap: [current_slot_start, current_slot_end) overlaps [b_start, b_end)
                    if max(current_slot_start, b_start) < min(current_slot_end, b_end):
                        is_available = False
                        reason = f"Already reserved ({b.team.name if b.team else 'Reserved'})"
                        break

            slots.append({
                "start_time": current_slot_start.strftime("%H:%M"),
                "end_time": current_slot_end.strftime("%H:%M"),
                "start_at": current_slot_start.isoformat(),
                "end_at": current_slot_end.isoformat(),
                "is_available": is_available,
                "reason": reason
            })

            current_slot_start = current_slot_end

        seconds_remaining = max(0, int((window_end - server_now).total_seconds()))

        return {
            "room_id": room.id,
            "room_name": room.name,
            "date": target_date.isoformat(),
            "server_now": server_now.isoformat(),
            "window_end": window_end.isoformat(),
            "time_remaining_seconds": seconds_remaining,
            "operating_hours": f"{cfg.opening_time} - {cfg.closing_time} IST",
            "slot_interval_minutes": cfg.slot_interval_minutes,
            "maximum_duration_minutes": cfg.maximum_duration_minutes,
            "slots": slots
        }
