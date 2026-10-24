import pytest
from datetime import datetime, timedelta
import pytz
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.core.time_utils import campus_tz, get_authoritative_server_now
from tests.conftest import get_token_headers


def test_opening_hours_valid_and_invalid(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    target_date = server_now.date() + timedelta(days=2)

    # 1. 09:00 AM start is valid
    start_9am = campus_tz.localize(datetime.combine(target_date, datetime.strptime("09:00", "%H:%M").time()))
    end_10am = campus_tz.localize(datetime.combine(target_date, datetime.strptime("10:00", "%H:%M").time()))
    resp_9am = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_9am.isoformat(),
        "end_at": end_10am.isoformat()
    })
    # If not previously booked, should be 201
    assert resp_9am.status_code in (201, 409)

    # 2. Before 09:00 AM (08:30 AM) is REJECTED
    start_early = campus_tz.localize(datetime.combine(target_date, datetime.strptime("08:30", "%H:%M").time()))
    end_early = campus_tz.localize(datetime.combine(target_date, datetime.strptime("09:30", "%H:%M").time()))
    resp_early = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_early.isoformat(),
        "end_at": end_early.isoformat()
    })
    assert resp_early.status_code == 422
    assert "before opening time" in resp_early.json()["detail"].lower()

    # 3. After 07:00 PM (19:30) is REJECTED
    start_late = campus_tz.localize(datetime.combine(target_date, datetime.strptime("18:30", "%H:%M").time()))
    end_late = campus_tz.localize(datetime.combine(target_date, datetime.strptime("19:30", "%H:%M").time()))
    resp_late = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_late.isoformat(),
        "end_at": end_late.isoformat()
    })
    assert resp_late.status_code == 422
    assert "after closing time" in resp_late.json()["detail"].lower()


def test_slot_interval_and_duration_limits(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=2)

    # 1. Invalid interval: 10:15 to 11:00 (not aligned with 30 mins)
    start_unaligned = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("10:15", "%H:%M").time()))
    end_unaligned = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:00", "%H:%M").time()))
    resp_unaligned = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_unaligned.isoformat(),
        "end_at": end_unaligned.isoformat()
    })
    assert resp_unaligned.status_code == 422
    detail_msg = resp_unaligned.json()["detail"].lower()
    assert "multiple of" in detail_msg or "interval" in detail_msg

    # 2. Maximum duration exceeded (> 240 mins e.g. 270 mins)
    start_long = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("10:00", "%H:%M").time()))
    end_long = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("14:30", "%H:%M").time()))
    resp_long = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_long.isoformat(),
        "end_at": end_long.isoformat()
    })
    assert resp_long.status_code == 422
    assert "exceeds maximum allowed duration" in resp_long.json()["detail"].lower()


def test_back_to_back_and_overlapping_bookings(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team1 = db_session.query(Team).filter(Team.name == "Unitrix").first()
    team2 = db_session.query(Team).filter(Team.name == "Riwayaat").first()
    room1 = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    room2 = db_session.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    target_day = server_now.date() + timedelta(days=2)

    # Booking A in Room 1: 13:00 to 14:00
    start_a = campus_tz.localize(datetime.combine(target_day, datetime.strptime("13:00", "%H:%M").time()))
    end_a = campus_tz.localize(datetime.combine(target_day, datetime.strptime("14:00", "%H:%M").time()))
    resp_a = client.post("/api/bookings", headers=headers, json={
        "team_id": team1.id,
        "room_id": room1.id,
        "start_at": start_a.isoformat(),
        "end_at": end_a.isoformat()
    })
    assert resp_a.status_code == 201

    # Back-to-back Booking B in Room 1: 14:00 to 15:00 (MUST SUCCEED)
    start_b = campus_tz.localize(datetime.combine(target_day, datetime.strptime("14:00", "%H:%M").time()))
    end_b = campus_tz.localize(datetime.combine(target_day, datetime.strptime("15:00", "%H:%M").time()))
    resp_b = client.post("/api/bookings", headers=headers, json={
        "team_id": team2.id,
        "room_id": room1.id,
        "start_at": start_b.isoformat(),
        "end_at": end_b.isoformat()
    })
    assert resp_b.status_code == 201, f"Back-to-back booking failed: {resp_b.text}"

    # Overlapping Booking in Room 1: 13:30 to 14:30 (MUST FAIL WITH 409 CONFLICT)
    start_overlap = campus_tz.localize(datetime.combine(target_day, datetime.strptime("13:30", "%H:%M").time()))
    end_overlap = campus_tz.localize(datetime.combine(target_day, datetime.strptime("14:30", "%H:%M").time()))
    resp_overlap = client.post("/api/bookings", headers=headers, json={
        "team_id": team2.id,
        "room_id": room1.id,
        "start_at": start_overlap.isoformat(),
        "end_at": end_overlap.isoformat()
    })
    assert resp_overlap.status_code == 409
    assert "already been booked" in resp_overlap.json()["detail"].lower()

    # Same time in DIFFERENT room (Room 2: 13:00 to 14:00) MUST SUCCEED
    resp_diff_room = client.post("/api/bookings", headers=headers, json={
        "team_id": team2.id,
        "room_id": room2.id,
        "start_at": start_a.isoformat(),
        "end_at": end_a.isoformat()
    })
    assert resp_diff_room.status_code == 201


def test_cancelled_booking_releases_room(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Chargers").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    target_day = server_now.date() + timedelta(days=2)

    start_t = campus_tz.localize(datetime.combine(target_day, datetime.strptime("15:00", "%H:%M").time()))
    end_t = campus_tz.localize(datetime.combine(target_day, datetime.strptime("16:00", "%H:%M").time()))

    # Create booking
    resp_create = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_t.isoformat(),
        "end_at": end_t.isoformat()
    })
    assert resp_create.status_code == 201
    booking_id = resp_create.json()["id"]

    # Cancel booking
    resp_cancel = client.post(f"/api/bookings/{booking_id}/cancel", headers=headers)
    assert resp_cancel.status_code == 200

    # New booking at the EXACT SAME slot should now SUCCEED!
    resp_rebook = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_t.isoformat(),
        "end_at": end_t.isoformat()
    })
    assert resp_rebook.status_code == 201
