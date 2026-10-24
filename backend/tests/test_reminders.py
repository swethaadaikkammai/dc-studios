import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.models.outbox_event import OutboxEvent
from app.models.audit_log import AuditLog
from app.core.time_utils import campus_tz, get_authoritative_server_now
from app.services.reminder_service import ReminderService
from tests.conftest import get_token_headers


def test_format_reminder_text(db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).first()
    room = db_session.query(Room).first()

    server_now = get_authoritative_server_now()
    start_dt = server_now + timedelta(hours=4)
    end_dt = start_dt + timedelta(hours=1)

    booking = Booking(
        id=999,
        team_id=team.id,
        room_id=room.id,
        created_by=admin.id,
        start_at=start_dt,
        end_at=end_dt,
        status="CONFIRMED",
        purpose="National Dance Competition Rehearsal",
        team=team,
        room=room
    )

    text_5h = ReminderService.format_reminder_text(booking, "5H", admin)
    assert "5-HOUR SESSION REMINDER" in text_5h
    assert f"#{booking.id}" in text_5h
    assert team.name in text_5h
    assert room.name in text_5h
    assert "keys" in text_5h.lower()

    text_1h = ReminderService.format_reminder_text(booking, "1H", admin)
    assert "1-HOUR FINAL SESSION REMINDER" in text_1h
    assert "doors/keys are unlocked" in text_1h


def test_reminder_dispatch_and_deduplication(db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).first()
    room = db_session.query(Room).first()

    admin.whatsapp_number = "+91 91234 56789"
    db_session.commit()

    server_now = get_authoritative_server_now()
    start_dt = server_now + timedelta(hours=3)
    end_dt = start_dt + timedelta(hours=1)

    test_booking = Booking(
        team_id=team.id,
        room_id=room.id,
        created_by=admin.id,
        start_at=start_dt,
        end_at=end_dt,
        status="CONFIRMED",
        purpose="Test Rehearsal for Reminder"
    )
    db_session.add(test_booking)
    db_session.commit()
    db_session.refresh(test_booking)

    # 1. First check: session is 3 hours away -> eligible for 5H reminder
    dispatches = ReminderService.check_and_dispatch_reminders(db=db_session)
    booking_dispatches = [d for d in dispatches if d.booking_id == test_booking.id]
    assert len(booking_dispatches) >= 1
    assert booking_dispatches[0].milestone == "5H"

    # Verify OutboxEvent and AuditLog were created
    outbox = db_session.query(OutboxEvent).filter(
        OutboxEvent.event_type == "ADMIN_REMINDER_5H"
    ).order_by(OutboxEvent.id.desc()).first()
    assert outbox is not None
    assert str(test_booking.id) in outbox.payload

    # 2. Second check immediately: deduplication must prevent duplicate dispatch!
    dispatches_second = ReminderService.check_and_dispatch_reminders(db=db_session)
    duplicate_dispatches = [d for d in dispatches_second if d.booking_id == test_booking.id]
    assert len(duplicate_dispatches) == 0  # Deduplicated!

    # Clean up
    db_session.delete(test_booking)
    db_session.commit()


def test_admin_reminders_api(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    board_user = db_session.query(User).filter(User.username == "board_lead").first()
    admin_headers = get_token_headers(admin)
    board_headers = get_token_headers(board_user)

    # 1. Non-admin is rejected with 403
    resp_forbidden = client.get("/api/admin/reminders/status", headers=board_headers)
    assert resp_forbidden.status_code == 403

    # 2. Admin gets reminder status (200 OK)
    resp_status = client.get("/api/admin/reminders/status", headers=admin_headers)
    assert resp_status.status_code == 200
    data = resp_status.json()
    assert "admin_phone_numbers" in data
    assert "reminder_rules" in data
    assert "upcoming_bookings" in data
    assert "recent_dispatches" in data

    # 3. Admin updates reminder alert phone number
    new_phone = "+91 99988 77766"
    resp_phone = client.patch("/api/admin/reminders/phone", headers=admin_headers, json={
        "phone_number": new_phone
    })
    assert resp_phone.status_code == 200
    assert resp_phone.json()["whatsapp_number"] == new_phone

    # 4. Admin triggers manual reminder scan
    resp_check = client.post("/api/admin/reminders/check", headers=admin_headers)
    assert resp_check.status_code == 200
    assert "total_dispatched" in resp_check.json()
    assert "message" in resp_check.json()
