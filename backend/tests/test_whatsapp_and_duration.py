import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.outbox_event import OutboxEvent
from app.models.club_settings import ClubSettings
from app.core.time_utils import get_authoritative_server_now, campus_tz
from tests.conftest import get_token_headers


def test_whatsapp_number_crud(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    headers = get_token_headers(admin)

    # 1. Provision user with WhatsApp number
    username = f"wa_test_{int(datetime.now().timestamp())}"
    resp_create = client.post("/api/admin/users", headers=headers, json={
        "username": username,
        "email": f"{username}@vitdance.ac.in",
        "password": "Password@123",
        "role": "TEAM_HEAD",
        "whatsapp_number": "+91 99887 76655",
        "is_active": True
    })
    assert resp_create.status_code == 201
    user_data = resp_create.json()
    assert user_data["whatsapp_number"] == "+91 99887 76655"
    user_id = user_data["id"]

    # 2. Update WhatsApp number
    resp_update = client.patch(f"/api/admin/users/{user_id}", headers=headers, json={
        "whatsapp_number": "+91 91234 56789"
    })
    assert resp_update.status_code == 200
    assert resp_update.json()["whatsapp_number"] == "+91 91234 56789"

    # Clean up
    client.delete(f"/api/admin/users/{user_id}", headers=headers)


def test_booking_creation_dispatches_whatsapp_pass(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:30", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("13:30", "%H:%M").time()))

    resp = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Mirage Hip-Hop State Finals Routine"
    })
    assert resp.status_code == 201
    data = resp.json()

    # Verify WhatsApp Pass structure
    assert "whatsapp_pass" in data
    wa_pass = data["whatsapp_pass"]
    assert wa_pass is not None
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    assert wa_pass["whatsapp_number"] == mirage_head.whatsapp_number
    assert "api.whatsapp.com/send" in wa_pass["whatsapp_url"]
    assert "DC STUDIOS" in wa_pass["pass_text"]
    assert "Mirage" in wa_pass["pass_text"]
    assert wa_pass["status"] == "DISPATCHED"
    assert "Eating is strictly prohibited inside the dance studio." in wa_pass["pass_text"]
    assert "Vacate the dance room promptly at" in wa_pass["pass_text"]
    assert "non-marking" not in wa_pass["pass_text"]
    assert "pass.png" not in wa_pass["pass_text"]  # Image is dispatched as image, not link in message
    assert wa_pass["pass_image_url"] == f"/api/bookings/{data['id']}/pass.png"

    # Verify pass image endpoint returns valid PNG
    resp_img = client.get(f"/api/bookings/{data['id']}/pass.png")
    assert resp_img.status_code == 200
    assert resp_img.headers["content-type"] == "image/png"
    assert len(resp_img.content) > 5000

    # Verify OutboxEvent recorded with message_type image
    outbox = db_session.query(OutboxEvent).filter(
        OutboxEvent.event_type == "WHATSAPP_PASS_DISPATCHED"
    ).order_by(OutboxEvent.id.desc()).first()
    assert outbox is not None
    payload = json.loads(outbox.payload)
    assert payload["booking_id"] == data["id"]
    assert payload["team_id"] == team.id
    assert payload["message_type"] == "image"
    assert payload["media_url"] == f"/api/bookings/{data['id']}/pass.png"


def test_duration_up_to_240_minutes(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "Bollywood Badmash Company (BBC)").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    day_3 = server_now.date() + timedelta(days=2)
    start_dt = campus_tz.localize(datetime.combine(day_3, datetime.strptime("09:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(day_3, datetime.strptime("13:00", "%H:%M").time()))  # 240 minutes (4 hours)

    resp = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "BBC 4-Hour Megamix Production"
    })
    assert resp.status_code == 201
    assert resp.json()["status"] == "CONFIRMED"


def test_cancelled_booking_frees_availability_and_excluded_from_confirmed_list(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    team = db_session.query(Team).filter(Team.name == "JnJ").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
    headers = get_token_headers(admin)

    server_now = get_authoritative_server_now()
    target_day = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("15:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("16:00", "%H:%M").time()))

    # 1. Create booking
    resp_create = client.post("/api/bookings", headers=headers, json={
        "team_id": team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "JnJ Practice to Cancel"
    })
    assert resp_create.status_code == 201
    booking_id = resp_create.json()["id"]

    # 2. Cancel booking
    resp_cancel = client.post(f"/api/bookings/{booking_id}/cancel", headers=headers)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["booking"]["status"] == "CANCELLED"

    # 3. Query confirmed bookings: must NOT include this cancelled booking
    resp_confirmed = client.get("/api/bookings?status=CONFIRMED", headers=headers)
    assert resp_confirmed.status_code == 200
    confirmed_ids = [b["id"] for b in resp_confirmed.json()]
    assert booking_id not in confirmed_ids

    # 4. Check availability: the 15:00-15:30 slot must now be is_available == True
    resp_avail = client.get(
        f"/api/bookings/availability?room_id={room.id}&target_date={target_day.isoformat()}",
        headers=headers
    )
    assert resp_avail.status_code == 200
    avail_data = resp_avail.json()
    slot_1500 = next((s for s in avail_data["slots"] if s["start_time"] == "15:00"), None)
    assert slot_1500 is not None
    assert slot_1500["is_available"] is True

