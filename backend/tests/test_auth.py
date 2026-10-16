import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password
from tests.conftest import get_token_headers


def test_valid_login(client: TestClient, db_session: Session):
    # admin user seeded in db
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "Admin@12345"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["username"] == "admin"
    assert "vit_dance_session" in response.cookies


def test_invalid_password_login(client: TestClient):
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "WrongPassword!999"
    })
    assert response.status_code == 401
    assert "Invalid username/email or password" in response.json()["detail"]


def test_deactivated_account_login(client: TestClient, db_session: Session):
    # Create deactivated test user
    deactivated = db_session.query(User).filter(User.username == "test_deactivated").first()
    if not deactivated:
        deactivated = User(
            username="test_deactivated",
            email="deactivated@vitdance.ac.in",
            password_hash=hash_password("Pass@12345"),
            role="TEAM_HEAD",
            is_active=False
        )
        db_session.add(deactivated)
        db_session.commit()

    response = client.post("/api/auth/login", json={
        "username_or_email": "test_deactivated",
        "password": "Pass@12345"
    })
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]


def test_unauthenticated_request(client: TestClient):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_logout_clears_cookie(client: TestClient):
    # Login first
    login_resp = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "Admin@12345"
    })
    assert login_resp.status_code == 200

    # Logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
    # Cookie should be expired or empty
    cookie_header = logout_resp.headers.get("set-cookie", "")
    assert "vit_dance_session=" in cookie_header


def test_authenticated_me_endpoint(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    headers = get_token_headers(admin)
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "ADMIN"
