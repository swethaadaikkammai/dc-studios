import pytest
from datetime import datetime, timedelta
import pytz
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.db.session import Base, get_db
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.board_permission import BoardTeamPermission
from app.models.club_settings import ClubSettings
from app.models.booking import Booking
from app.models.audit_log import AuditLog
from app.core.security import hash_password, create_access_token
from app.patterns.club_config_singleton import ClubConfig

TEST_DATABASE_URL = "postgresql+psycopg2://postgres@localhost:5433/vit_dance_booking_test"
test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Ensure tables exist in isolated test database
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    # Ensure settings exist and are reset to default
    s = db.query(ClubSettings).first()
    if not s:
        s = ClubSettings(
            timezone="Asia/Kolkata",
            opening_time="09:00",
            closing_time="19:00",
            slot_interval_minutes=30,
            maximum_duration_minutes=240,
            advance_booking_hours=72,
            cancellation_cutoff_minutes=0,
            daily_team_quota_minutes=0
        )
        db.add(s)
    else:
        s.timezone = "Asia/Kolkata"
        s.opening_time = "09:00"
        s.closing_time = "19:00"
        s.slot_interval_minutes = 30
        s.maximum_duration_minutes = 240
        s.advance_booking_hours = 72
        s.cancellation_cutoff_minutes = 0
        s.daily_team_quota_minutes = 0
    mirage_head = db.query(User).filter(User.username == "mirage_head").first()
    if mirage_head and not mirage_head.whatsapp_number:
        mirage_head.whatsapp_number = "+91 7010734009"
    db.commit()
    ClubConfig.get_instance().reload(db)
    db.close()
    yield


@pytest.fixture
def db_session():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def clean_bookings(db_session: Session):
    # Ensure a clean slate for bookings and reset club settings before each test
    db_session.query(Booking).delete()
    s = db_session.query(ClubSettings).first()
    if s:
        s.opening_time = "09:00"
        s.closing_time = "19:00"
        s.slot_interval_minutes = 30
        s.maximum_duration_minutes = 240
        s.advance_booking_hours = 72
        s.cancellation_cutoff_minutes = 0
        s.daily_team_quota_minutes = 0
    db_session.commit()
    ClubConfig.get_instance().reload(db_session)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def get_token_headers(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
    return {"Authorization": f"Bearer {token}"}
