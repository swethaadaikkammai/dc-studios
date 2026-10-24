import pytest
from datetime import datetime, timedelta
import pytz
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.core.time_utils import (
    campus_tz,
    get_authoritative_server_now,
    is_within_rolling_72h_window,
    validate_weekend_advance_booking,
    validate_slot_operating_hours
)
from app.patterns.booking_factory import BookingFactory
from app.core.exceptions import WindowViolationException
from tests.conftest import get_token_headers


def test_window_validation_helper_boundaries():
    # Base server time: Monday at 14:00 (2:00 PM)
    mock_now = campus_tz.localize(datetime(2026, 10, 19, 14, 0, 0))
    advance_hours = 72

    # 1. Slot in past (Monday 13:30): INVALID
    past_slot = campus_tz.localize(datetime(2026, 10, 19, 13, 30, 0))
    valid, err = is_within_rolling_72h_window(past_slot, mock_now, advance_hours)
    assert not valid
    assert "past" in err.lower()

    # 2. Slot inside window (Tuesday 10:00): VALID
    inside_slot = campus_tz.localize(datetime(2026, 10, 20, 10, 0, 0))
    valid, err = is_within_rolling_72h_window(inside_slot, mock_now, advance_hours)
    assert valid

    # 3. Slot inside window near upper limit (Thursday 13:30): VALID
    near_limit = campus_tz.localize(datetime(2026, 10, 22, 13, 30, 0))
    valid, err = is_within_rolling_72h_window(near_limit, mock_now, advance_hours)
    assert valid

    # 4. Slot EXACTLY at 72.0 hours (Thursday 14:00): MUST BE REJECTED (exclusive boundary!)
    exact_72h = campus_tz.localize(datetime(2026, 10, 22, 14, 0, 0))
    valid, err = is_within_rolling_72h_window(exact_72h, mock_now, advance_hours)
    assert not valid
    assert "limit" in err.lower() or "beyond" in err.lower()

    # 5. Slot beyond 72 hours (Thursday 14:30): MUST BE REJECTED
    beyond_72h = campus_tz.localize(datetime(2026, 10, 22, 14, 30, 0))
    valid, err = is_within_rolling_72h_window(beyond_72h, mock_now, advance_hours)
    assert not valid
    assert "limit" in err.lower() or "beyond" in err.lower()


def test_booking_factory_enforces_72h_window():
    mock_now = campus_tz.localize(datetime(2026, 10, 19, 14, 0, 0))
    
    # Attempting to construct booking at exact 72h limit via Factory
    exact_72h_start = campus_tz.localize(datetime(2026, 10, 22, 14, 0, 0))
    exact_72h_end = campus_tz.localize(datetime(2026, 10, 22, 15, 0, 0))

    with pytest.raises(WindowViolationException) as exc_info:
        BookingFactory.create_booking(
            team_id=1,
            room_id=1,
            created_by=1,
            start_at=exact_72h_start,
            end_at=exact_72h_end,
            server_now=mock_now
        )
    assert "72-hour" in str(exc_info.value.message)


def test_api_rejects_beyond_72_hours(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    # 5 days in the future (120 hours)
    future_day = server_now.date() + timedelta(days=5)
    start_future = campus_tz.localize(datetime.combine(future_day, datetime.strptime("10:00", "%H:%M").time()))
    end_future = campus_tz.localize(datetime.combine(future_day, datetime.strptime("11:00", "%H:%M").time()))

    resp = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_future.isoformat(),
        "end_at": end_future.isoformat()
    })
    assert resp.status_code == 422
    assert "72-hour" in resp.json()["detail"]


def test_api_rejects_past_slot(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    # Yesterday
    past_day = server_now.date() - timedelta(days=1)
    start_past = campus_tz.localize(datetime.combine(past_day, datetime.strptime("10:00", "%H:%M").time()))
    end_past = campus_tz.localize(datetime.combine(past_day, datetime.strptime("11:00", "%H:%M").time()))

    resp = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_past.isoformat(),
        "end_at": end_past.isoformat()
    })
    assert resp.status_code == 422
    assert "past" in resp.json()["detail"].lower()


def test_weekend_advance_booking_rule():
    # Base server time: Friday 2026-10-23 at 14:00 (2:00 PM)
    mock_friday_2pm = campus_tz.localize(datetime(2026, 10, 23, 14, 0, 0))

    # 1. Saturday 10:00 AM (20 hours notice): MUST BE REJECTED (< 24h)
    sat_10am = campus_tz.localize(datetime(2026, 10, 24, 10, 0, 0))
    valid, err = validate_weekend_advance_booking(sat_10am, mock_friday_2pm, min_advance_hours=24)
    assert not valid
    assert "24 hours" in err
    assert "Saturday" in err

    # 2. Saturday 15:00 PM (25 hours notice): VALID (>= 24h and within 72h)
    sat_3pm = campus_tz.localize(datetime(2026, 10, 24, 15, 0, 0))
    valid, err = validate_weekend_advance_booking(sat_3pm, mock_friday_2pm, min_advance_hours=24)
    assert valid
    assert err == ""

    # 3. Sunday 11:00 AM (45 hours notice): VALID (>= 24h)
    sun_11am = campus_tz.localize(datetime(2026, 10, 25, 11, 0, 0))
    valid, err = validate_weekend_advance_booking(sun_11am, mock_friday_2pm, min_advance_hours=24)
    assert valid
    assert err == ""

    # 4. Weekday same lead time: Tuesday 14:00 for Wednesday 10:00 (20h lead time) is VALID (weekend rule doesn't apply to weekdays)
    tue_2pm = campus_tz.localize(datetime(2026, 10, 20, 14, 0, 0))
    wed_10am = campus_tz.localize(datetime(2026, 10, 21, 10, 0, 0))
    valid, err = validate_weekend_advance_booking(wed_10am, tue_2pm, min_advance_hours=24)
    assert valid
    assert err == ""


def test_booking_factory_enforces_weekend_advance_rule():
    # Base server time: Friday at 16:00
    mock_friday_4pm = campus_tz.localize(datetime(2026, 10, 23, 16, 0, 0))
    # Booking attempt for Saturday at 11:00 (19h notice < 24h)
    sat_11am = campus_tz.localize(datetime(2026, 10, 24, 11, 0, 0))
    sat_12pm = campus_tz.localize(datetime(2026, 10, 24, 12, 0, 0))

    with pytest.raises(WindowViolationException) as exc_info:
        BookingFactory.create_booking(
            team_id=1,
            room_id=1,
            created_by=1,
            start_at=sat_11am,
            end_at=sat_12pm,
            server_now=mock_friday_4pm
        )
    assert "24 hours" in str(exc_info.value.message)
    assert "Weekend" in str(exc_info.value.message)
