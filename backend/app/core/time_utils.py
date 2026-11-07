from datetime import datetime, time, timedelta
from typing import Tuple
import pytz

CAMPUS_TZ_NAME = "Asia/Kolkata"
campus_tz = pytz.timezone(CAMPUS_TZ_NAME)


def get_campus_timezone() -> pytz.BaseTzInfo:
    return campus_tz


def get_authoritative_server_now() -> datetime:
    """Returns the authoritative server time, timezone-aware in Asia/Kolkata."""
    return datetime.now(pytz.utc).astimezone(campus_tz)


def ensure_campus_timezone(dt: datetime) -> datetime:
    """Ensures a datetime object is localized to Asia/Kolkata."""
    if isinstance(dt, str):
        # Handle string ISO format if passed
        clean_str = dt.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean_str)
        except Exception:
            import dateutil.parser
            dt = dateutil.parser.parse(dt)
    if dt.tzinfo is None:
        # If naive, assume it's in campus local time
        return campus_tz.localize(dt)
    return dt.astimezone(campus_tz)


def parse_time_str(t_str: str) -> time:
    """Parses 'HH:MM' string to time object."""
    parts = [int(p) for p in t_str.split(":")]
    return time(hour=parts[0], minute=parts[1])


def is_within_rolling_72h_window(start_at: datetime, server_now: datetime, advance_hours: int = 72) -> Tuple[bool, str]:
    """
    Validates rolling 72-hour advance booking rule.
    Condition: server_now <= booking_start < window_end (exclusive boundary).
    """
    start_campus = ensure_campus_timezone(start_at)
    now_campus = ensure_campus_timezone(server_now)
    window_end = now_campus + timedelta(hours=advance_hours)

    if start_campus < now_campus:
        return False, "Cannot book slots in the past."

    # Upper boundary is strictly exclusive: booking at exactly +72h is rejected
    if start_campus >= window_end:
        return False, f"Booking start time ({start_campus.strftime('%Y-%m-%d %H:%M')}) is beyond or exactly at the 72-hour advance booking window limit ({window_end.strftime('%Y-%m-%d %H:%M')})."

    return True, ""


def validate_weekend_advance_booking(
    start_at: datetime,
    server_now: datetime,
    min_advance_hours: int = 24
) -> Tuple[bool, str]:
    """
    Validates weekend advance booking rule.
    Weekend reservations (Saturday & Sunday) must be made at least 1 day (24 hours)
    prior to the time slot needed.
    """
    start_campus = ensure_campus_timezone(start_at)
    now_campus = ensure_campus_timezone(server_now)

    # In Python datetime.weekday(): Monday=0 ... Saturday=5, Sunday=6
    if start_campus.weekday() in (5, 6):
        lead_time = start_campus - now_campus
        min_lead = timedelta(hours=min_advance_hours)
        if lead_time < min_lead:
            day_name = "Saturday" if start_campus.weekday() == 5 else "Sunday"
            diff_h = lead_time.total_seconds() / 3600
            return (
                False,
                f"Weekend reservations ({day_name}) must be made at least 1 day (24 hours) prior to the time slot needed. "
                f"(Current lead time: {max(0.0, diff_h):.1f}h)"
            )
    return True, ""


def validate_slot_operating_hours(
    start_at: datetime,
    end_at: datetime,
    opening_time_str: str = "09:00",
    closing_time_str: str = "19:00",
    slot_interval_minutes: int = 30,
    max_duration_minutes: int = 120,
) -> Tuple[bool, str]:
    """
    Validates operating hours and duration constraints in local campus time.
    """
    start_campus = ensure_campus_timezone(start_at)
    end_campus = ensure_campus_timezone(end_at)

    if end_campus <= start_campus:
        return False, "End time must be strictly after start time."

    # Start and finish on the same local calendar day
    if start_campus.date() != end_campus.date():
        return False, "Booking must start and end on the same calendar day."

    duration_minutes = int((end_campus - start_campus).total_seconds() / 60)

    if duration_minutes <= 0:
        return False, "Booking duration must be positive."

    if duration_minutes > max_duration_minutes:
        return False, f"Booking duration ({duration_minutes} mins) exceeds maximum allowed duration of {max_duration_minutes} minutes."

    if duration_minutes % slot_interval_minutes != 0:
        return False, f"Booking duration must be a multiple of {slot_interval_minutes} minutes."

    if start_campus.minute % slot_interval_minutes != 0 or end_campus.minute % slot_interval_minutes != 0:
        return False, f"Booking start and end minutes must align with {slot_interval_minutes}-minute intervals."

    opening_time = parse_time_str(opening_time_str)
    closing_time = parse_time_str(closing_time_str)

    booking_date = start_campus.date()
    open_dt = campus_tz.localize(datetime.combine(booking_date, opening_time))
    close_dt = campus_tz.localize(datetime.combine(booking_date, closing_time))

    if start_campus < open_dt:
        return False, f"Booking cannot start before opening time ({opening_time_str} IST)."

    if end_campus > close_dt:
        return False, f"Booking cannot end after closing time ({closing_time_str} IST)."

    return True, ""
