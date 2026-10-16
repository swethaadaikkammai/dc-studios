import pytest
import concurrent.futures
from datetime import datetime, timedelta
import pytz
from fastapi.testclient import TestClient

from tests.conftest import TestSessionLocal as SessionLocal, get_token_headers
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.core.time_utils import campus_tz, get_authoritative_server_now
from app.main import app


def test_concurrent_overlapping_bookings_against_postgresql():
    """
    Concurrency Test:
    Spawns concurrent worker threads submitting simultaneous overlapping booking requests
    for the exact same studio room and time slot against the live PostgreSQL database.
    
    Verifies that:
    1. Exactly one transaction succeeds (HTTP 201).
    2. The competing transaction receives HTTP 409 Conflict.
    3. The PostgreSQL database contains exactly one active booking for that interval.
    """
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    team1 = db.query(Team).filter(Team.name == "Mirage").first()
    team2 = db.query(Team).filter(Team.name == "Unitrix").first()
    room = db.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()

    server_now = get_authoritative_server_now()
    # Distinct date 3 days in future to avoid collisions with other tests
    target_day = server_now.date() + timedelta(days=2)
    start_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("17:30", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("18:30", "%H:%M").time()))

    headers = get_token_headers(admin)
    db.close()

    payload1 = {
        "team_id": team1.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Concurrent Request Team 1"
    }

    payload2 = {
        "team_id": team2.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Concurrent Request Team 2"
    }

    def make_booking_request(payload):
        client = TestClient(app)
        return client.post("/api/bookings", headers=headers, json=payload)

    # Launch parallel requests concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(make_booking_request, payload1)
        future2 = executor.submit(make_booking_request, payload2)
        resp1 = future1.result()
        resp2 = future2.result()

    status_codes = [resp1.status_code, resp2.status_code]
    print(f"Concurrent response status codes: {status_codes}")

    # Exactly one request must succeed with 201 and the other must be rejected with 409 Conflict
    assert 201 in status_codes, f"Neither request succeeded: {resp1.text}, {resp2.text}"
    assert 409 in status_codes, f"Both requests succeeded or unexpected error: {status_codes}"

    # Verify directly in PostgreSQL that exactly ONE confirmed booking exists for that room and time
    verify_db = SessionLocal()
    active_bookings = verify_db.query(Booking).filter(
        Booking.room_id == room.id,
        Booking.start_at == start_dt,
        Booking.end_at == end_dt,
        Booking.status == "CONFIRMED"
    ).all()
    verify_db.close()

    assert len(active_bookings) == 1, f"Expected exactly 1 booking in database, found {len(active_bookings)}"
