import pytest
from datetime import datetime, timedelta
import pytz
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.models.board_permission import BoardTeamPermission
from app.core.time_utils import campus_tz, get_authoritative_server_now
from tests.conftest import get_token_headers


def test_board_member_can_book_for_assigned_team(client: TestClient, db_session: Session):
    board_user = db_session.query(User).filter(User.username == "board_lead").first()
    mirage_team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()

    server_now = get_authoritative_server_now()
    # Tomorrow at 10:00 AM
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("10:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:00", "%H:%M").time()))

    headers = get_token_headers(board_user)
    response = client.post("/api/bookings", headers=headers, json={
        "team_id": mirage_team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Mirage Choreography"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["team_id"] == mirage_team.id
    assert data["status"] == "CONFIRMED"


def test_board_member_cannot_book_for_unauthorized_team(client: TestClient, db_session: Session):
    board_user = db_session.query(User).filter(User.username == "board_lead").first()
    # Team JnJ was not delegated to board_lead in seed (ensure it's clean)
    jnj_team = db_session.query(Team).filter(Team.name == "JnJ").first()
    db_session.query(BoardTeamPermission).filter(
        BoardTeamPermission.user_id == board_user.id,
        BoardTeamPermission.team_id == jnj_team.id
    ).delete()
    db_session.commit()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:30", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("12:30", "%H:%M").time()))

    headers = get_token_headers(board_user)
    response = client.post("/api/bookings", headers=headers, json={
        "team_id": jnj_team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Unauthorized booking"
    })
    assert response.status_code == 403
    assert "not authorized to create bookings for Team ID" in response.json()["detail"]


def test_team_head_cannot_create_booking(client: TestClient, db_session: Session):
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    mirage_team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("14:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("15:00", "%H:%M").time()))

    headers = get_token_headers(mirage_head)
    response = client.post("/api/bookings", headers=headers, json={
        "team_id": mirage_team.id,
        "room_id": room.id,
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "purpose": "Head attempting booking"
    })
    assert response.status_code == 403
    assert "Team Heads are not authorized to create studio bookings" in response.json()["detail"]


def test_team_head_can_view_shared_calendar(client: TestClient, db_session: Session):
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    headers = get_token_headers(mirage_head)
    response = client.get("/api/bookings", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_team_head_can_cancel_own_team_booking(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    mirage_team = db_session.query(Team).filter(Team.name == "Mirage").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("16:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("17:00", "%H:%M").time()))

    # Create a booking for Mirage
    b = Booking(
        team_id=mirage_team.id,
        room_id=room.id,
        created_by=admin.id,
        start_at=start_dt,
        end_at=end_dt,
        status="CONFIRMED"
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)

    # Mirage head cancels their own team booking
    headers = get_token_headers(mirage_head)
    cancel_resp = client.post(f"/api/bookings/{b.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["booking"]["status"] == "CANCELLED"


def test_team_head_cannot_cancel_another_team_booking(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    unitrix_team = db_session.query(Team).filter(Team.name == "Unitrix").first()
    room = db_session.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()

    server_now = get_authoritative_server_now()
    tomorrow = server_now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("17:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("18:00", "%H:%M").time()))

    # Create a booking for Unitrix
    b = Booking(
        team_id=unitrix_team.id,
        room_id=room.id,
        created_by=admin.id,
        start_at=start_dt,
        end_at=end_dt,
        status="CONFIRMED"
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)

    # Mirage head attempts to cancel Unitrix's booking
    headers = get_token_headers(mirage_head)
    cancel_resp = client.post(f"/api/bookings/{b.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 403
    assert "Team Heads can only cancel bookings belonging to their assigned team" in cancel_resp.json()["detail"]


def test_non_admin_cannot_change_settings(client: TestClient, db_session: Session):
    mirage_head = db_session.query(User).filter(User.username == "mirage_head").first()
    headers = get_token_headers(mirage_head)
    resp = client.patch("/api/admin/settings", headers=headers, json={"opening_time": "08:00"})
    assert resp.status_code == 403


def test_admin_can_update_user_username_and_password(client: TestClient, db_session: Session):
    # Pre-clean any leftover users from previous runs
    db_session.query(User).filter(User.username.in_(["temp_user_test", "updated_user_test"])).delete()
    db_session.commit()

    admin = db_session.query(User).filter(User.username == "admin").first()
    headers = get_token_headers(admin)

    # 1. Create a dummy user
    create_resp = client.post("/api/admin/users", headers=headers, json={
        "username": "temp_user_test",
        "email": "temp_user@vitdance.club",
        "password": "InitialPassword@123",
        "role": "BOARD_MEMBER"
    })
    assert create_resp.status_code == 201
    created_id = create_resp.json()["id"]

    # 2. Update username and password
    update_resp = client.patch(f"/api/admin/users/{created_id}", headers=headers, json={
        "username": "updated_user_test",
        "password": "NewUpdatedPassword@123"
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["username"] == "updated_user_test"

    # 3. Verify login works with the new credentials
    login_resp = client.post("/api/auth/login", json={
        "username_or_email": "updated_user_test",
        "password": "NewUpdatedPassword@123"
    })
    assert login_resp.status_code == 200

    # Cleanup
    db_session.query(User).filter(User.id == created_id).delete()
    db_session.commit()


def test_admin_delete_user_and_self_protection(client: TestClient, db_session: Session):
    # Pre-clean
    db_session.query(User).filter(User.username == "to_be_deleted").delete()
    db_session.commit()

    admin = db_session.query(User).filter(User.username == "admin").first()
    headers = get_token_headers(admin)

    # Cannot delete self
    self_delete_resp = client.delete(f"/api/admin/users/{admin.id}", headers=headers)
    assert self_delete_resp.status_code == 400
    assert "Cannot delete your own administrator account" in self_delete_resp.json()["detail"]

    # Create and delete a target user
    create_resp = client.post("/api/admin/users", headers=headers, json={
        "username": "to_be_deleted",
        "email": "delete_me@vitdance.club",
        "password": "Password@123",
        "role": "BOARD_MEMBER"
    })
    assert create_resp.status_code == 201
    target_id = create_resp.json()["id"]

    # Delete target user
    del_resp = client.delete(f"/api/admin/users/{target_id}", headers=headers)
    assert del_resp.status_code == 200
    assert "deleted successfully" in del_resp.json()["message"]

    # Verify user no longer exists
    deleted_check = db_session.query(User).filter(User.id == target_id).first()
    assert deleted_check is None
