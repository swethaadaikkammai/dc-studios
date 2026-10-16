import pytest
from datetime import datetime, timedelta
import pytz
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.models.audit_log import AuditLog
from app.core.time_utils import campus_tz, get_authoritative_server_now
from app.core.exceptions import (
    InvalidStateTransitionException,
    AuthorizationException,
    WindowViolationException
)
from app.patterns.club_config_singleton import ClubConfig
from app.patterns.booking_state import ConfirmedState, CancelledState, CompletedState, get_booking_state
from app.patterns.booking_factory import BookingFactory
from app.patterns.booking_policy import FirstComeFirstServedPolicy, TeamQuotaPolicy
from app.patterns.booking_observer import BookingEventPublisher, BookingObserver, BookingEvent, AuditEventSubscriber
from app.patterns.authorization_proxy import BookingAuthorizationProxy
from app.services.booking_service import BookingService


# 1. Singleton Pattern Test
def test_singleton_club_config(db_session: Session):
    c1 = ClubConfig.get_instance()
    c2 = ClubConfig.get_instance()
    assert c1 is c2
    assert c1.timezone == "Asia/Kolkata"
    
    # Test reload
    c1.reload(db_session)
    assert c1.advance_booking_hours == 72


# 2. State Pattern Test
def test_state_pattern_transitions(db_session: Session):
    now = get_authoritative_server_now()
    user = db_session.query(User).filter(User.username == "admin").first()

    booking = Booking(
        id=999,
        team_id=1,
        room_id=1,
        created_by=user.id,
        start_at=now + timedelta(hours=5),
        end_at=now + timedelta(hours=6),
        status="CONFIRMED"
    )

    state = get_booking_state(booking.status)
    assert isinstance(state, ConfirmedState)
    assert state.name == "CONFIRMED"

    # Valid Transition: CONFIRMED -> CANCELLED
    new_state = state.cancel(booking, user, now)
    assert isinstance(new_state, CancelledState)
    assert booking.status == "CANCELLED"
    assert booking.cancelled_by == user.id

    # Invalid Transition: CANCELLED -> CANCELLED must raise exception
    with pytest.raises(InvalidStateTransitionException):
        new_state.cancel(booking, user, now)

    # Invalid Transition: CANCELLED -> COMPLETED must raise exception
    with pytest.raises(InvalidStateTransitionException):
        new_state.complete(booking, now)


# 3. Factory Method Pattern Test
def test_factory_method_pattern():
    server_now = campus_tz.localize(datetime(2026, 10, 19, 10, 0, 0))
    valid_start = campus_tz.localize(datetime(2026, 10, 20, 10, 0, 0))
    valid_end = campus_tz.localize(datetime(2026, 10, 20, 11, 0, 0))

    booking = BookingFactory.create_booking(
        team_id=1,
        room_id=1,
        created_by=2,
        start_at=valid_start,
        end_at=valid_end,
        server_now=server_now,
        purpose="Factory Test"
    )

    assert booking.team_id == 1
    assert booking.room_id == 1
    assert booking.status == "CONFIRMED"
    assert booking.purpose == "Factory Test"


# 4. Strategy Pattern Test (FCFS vs Team Quota)
def test_strategy_pattern_policies(db_session: Session):
    server_now = get_authoritative_server_now()
    target_day = server_now.date() + timedelta(days=2)
    start_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("10:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("12:00", "%H:%M").time()))

    # Strategy A: FCFS allows request
    fcfs = FirstComeFirstServedPolicy()
    eligible, _ = fcfs.validate_booking_eligibility(
        db=db_session, team_id=1, room_id=1, start_at=start_dt, end_at=end_dt, server_now=server_now
    )
    assert eligible is True

    # Strategy B: Team Quota Policy with 60 min limit should reject a 120 min request!
    quota_policy = TeamQuotaPolicy(max_daily_minutes_per_team=60)
    eligible_quota, reason = quota_policy.validate_booking_eligibility(
        db=db_session, team_id=1, room_id=1, start_at=start_dt, end_at=end_dt, server_now=server_now
    )
    assert eligible_quota is False
    assert "exceeded" in reason.lower()


# 5. Observer Pattern Test
def test_observer_pattern_publishes_event(db_session: Session):
    publisher = BookingEventPublisher()
    audit_sub = AuditEventSubscriber()
    publisher.attach(audit_sub)

    event = BookingEvent(
        event_type="BOOKING_CREATED",
        booking_id=888,
        actor_id=1,
        team_id=1,
        room_id=1,
        timestamp=get_authoritative_server_now(),
        details={"note": "Observer Unit Test"}
    )

    initial_audit_count = db_session.query(AuditLog).filter(AuditLog.entity_id == 888).count()
    publisher.notify(event, db_session)
    db_session.commit()

    updated_audit_count = db_session.query(AuditLog).filter(AuditLog.entity_id == 888).count()
    assert updated_audit_count == initial_audit_count + 1


# 6. Proxy Pattern Test
def test_authorization_proxy_pattern(db_session: Session):
    real_service = BookingService()
    proxy = BookingAuthorizationProxy(real_service)

    team_head = db_session.query(User).filter(User.username == "mirage_head").first()
    now = get_authoritative_server_now()
    target_day = now.date() + timedelta(days=1)
    start_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("10:00", "%H:%M").time()))
    end_dt = campus_tz.localize(datetime.combine(target_day, datetime.strptime("11:00", "%H:%M").time()))

    # Proxy intercepts and blocks unauthorized Team Head booking attempt
    with pytest.raises(AuthorizationException) as exc:
        proxy.create_booking(
            db=db_session,
            actor=team_head,
            team_id=1,
            room_id=1,
            start_at=start_dt,
            end_at=end_dt
        )
    assert "not authorized to create studio bookings" in str(exc.value.message)
