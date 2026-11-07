from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.board_permission import BoardTeamPermission
from app.models.club_settings import ClubSettings
from app.schemas.user import UserRead, UserCreate, UserUpdate
from app.schemas.room import RoomRead, RoomUpdate
from app.schemas.team import TeamRead, TeamUpdate
from app.schemas.club_settings import ClubSettingsRead, ClubSettingsUpdate
from app.schemas.board_permission import BoardPermissionRead, BoardPermissionUpdate
from app.schemas.audit_log import AuditLogRead
from app.schemas.reminder import (
    ReminderStatusResponse,
    CheckRemindersResponse,
    AdminPhoneUpdate
)
from app.services.admin_service import AdminService
from app.services.reminder_service import ReminderService
from app.core.exceptions import BookingException, RoomLimitExceededException

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/users", response_model=List[UserRead])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Lists all registered member accounts and their roles."""
    return AdminService.list_users(db=db)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Provisions a new club member account."""
    try:
        return AdminService.create_user(
            db=db,
            actor=admin_user,
            username=payload.username,
            email=payload.email,
            password=payload.password,
            role=payload.role,
            team_id=payload.team_id,
            whatsapp_number=payload.whatsapp_number,
            whatsapp_number_2=payload.whatsapp_number_2,
            is_active=payload.is_active
        )
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates account username, email, role, active status, team assignment, or resets password."""
    try:
        return AdminService.update_user(
            db=db,
            actor=admin_user,
            user_id=user_id,
            username=payload.username,
            email=payload.email,
            role=payload.role,
            team_id=payload.team_id,
            whatsapp_number=payload.whatsapp_number,
            whatsapp_number_2=payload.whatsapp_number_2,
            is_active=payload.is_active,
            password=payload.password
        )
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Permanently deletes a member account."""
    try:
        return AdminService.delete_user(db=db, actor=admin_user, user_id=user_id)
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/settings", response_model=ClubSettingsRead)
def get_settings(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Retrieves operational club settings."""
    settings_record = db.query(ClubSettings).first()
    if not settings_record:
        raise HTTPException(status_code=404, detail="Club settings not found.")
    return settings_record


@router.patch("/settings", response_model=ClubSettingsRead)
def update_settings(
    payload: ClubSettingsUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates operational hours, booking intervals, and cancellation rules."""
    return AdminService.update_settings(
        db=db,
        actor=admin_user,
        opening_time=payload.opening_time,
        closing_time=payload.closing_time,
        slot_interval_minutes=payload.slot_interval_minutes,
        maximum_duration_minutes=payload.maximum_duration_minutes,
        advance_booking_hours=payload.advance_booking_hours,
        cancellation_cutoff_minutes=payload.cancellation_cutoff_minutes,
        daily_team_quota_minutes=payload.daily_team_quota_minutes,
        weekend_keys_secured=payload.weekend_keys_secured
    )


@router.get("/audit-logs", response_model=List[AuditLogRead])
def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Retrieves immutable audit trail of privileged and booking actions."""
    return AdminService.list_audit_logs(db=db, limit=limit, offset=offset)


@router.get("/board-permissions", response_model=List[BoardPermissionRead])
def list_board_permissions(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Lists board-member booking delegations across teams."""
    return db.query(BoardTeamPermission).all()


@router.put("/board-permissions", response_model=BoardPermissionRead)
def set_board_permission(
    payload: BoardPermissionUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Assigns or updates team booking permissions for a Board Member."""
    return AdminService.set_board_permission(
        db=db,
        actor=admin_user,
        user_id=payload.user_id,
        team_id=payload.team_id,
        can_create=payload.can_create_booking,
        can_cancel=payload.can_cancel_any_booking
    )


@router.patch("/rooms/{room_id}", response_model=RoomRead)
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates room configuration, enforcing maximum 2 active studios."""
    try:
        return AdminService.update_room(
            db=db,
            actor=admin_user,
            room_id=room_id,
            name=payload.name,
            is_active=payload.is_active
        )
    except RoomLimitExceededException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.message)
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.patch("/teams/{team_id}", response_model=TeamRead)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates dance team name or active status."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    if payload.name is not None:
        team.name = payload.name
    if payload.is_active is not None:
        team.is_active = payload.is_active
    db.commit()
    db.refresh(team)
    return team


@router.get("/reminders/status", response_model=ReminderStatusResponse)
def get_reminders_status(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """
    Returns live reminder module status:
    - Configured admin alert phone numbers
    - 5-hour and 1-hour reminder rules
    - Upcoming bookings and their reminder dispatch flags
    - Recent dispatched reminder log with direct WhatsApp URLs
    """
    return ReminderService.get_reminders_status(db=db)


@router.post("/reminders/check", response_model=CheckRemindersResponse)
def trigger_reminders_check(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """
    Manually triggers an immediate scan of all upcoming sessions to evaluate
    and dispatch due 5-hour and 1-hour reminders to the administrator.
    """
    dispatches = ReminderService.check_and_dispatch_reminders(db=db)
    now = ReminderService.get_reminders_status(db=db).admin_phone_numbers
    return CheckRemindersResponse(
        checked_at=ReminderService.format_reminder_text.__name__,
        total_dispatched=len(dispatches),
        dispatches=dispatches,
        message=f"Scan complete. Dispatched {len(dispatches)} reminder(s) to administrator contact(s)."
    )


@router.patch("/reminders/phone")
def update_admin_reminder_phone(
    payload: AdminPhoneUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"]))
):
    """
    Updates the logged-in administrator's alert phone numbers for receiving
    session reminders (5 hours prior & 1 hour prior).
    """
    admin_user.whatsapp_number = payload.phone_number.strip() if payload.phone_number else None
    if payload.phone_number_2 is not None:
        admin_user.whatsapp_number_2 = payload.phone_number_2.strip() if payload.phone_number_2.strip() else None
    db.commit()
    db.refresh(admin_user)
    return {
        "message": "Admin reminder phone numbers updated successfully.",
        "admin_id": admin_user.id,
        "username": admin_user.username,
        "whatsapp_number": admin_user.whatsapp_number,
        "whatsapp_number_2": admin_user.whatsapp_number_2
    }
