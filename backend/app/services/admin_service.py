from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.models.board_permission import BoardTeamPermission
from app.models.club_settings import ClubSettings
from app.models.audit_log import AuditLog
from app.core.security import hash_password
from app.core.exceptions import RoomLimitExceededException, BookingException
from app.patterns.club_config_singleton import ClubConfig


class AdminService:
    """Service layer for Club Administrator capabilities and system management."""

    @classmethod
    def list_users(cls, db: Session) -> List[User]:
        return db.query(User).order_by(User.id.asc()).all()

    @classmethod
    def create_user(
        cls,
        db: Session,
        actor: User,
        username: str,
        email: str,
        password: str,
        role: str,
        team_id: Optional[int] = None,
        whatsapp_number: Optional[str] = None,
        is_active: bool = True
    ) -> User:
        existing = db.query(User).filter((User.username == username) | (User.email == email)).first()
        if existing:
            raise BookingException("Username or email already exists.", status_code=400)

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role=role.upper(),
            team_id=team_id,
            whatsapp_number=whatsapp_number.strip() if whatsapp_number else None,
            is_active=is_active
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Audit log
        db.add(AuditLog(
            actor_id=actor.id,
            action="CREATE_USER",
            entity_type="USER",
            entity_id=user.id,
            details=f"Created user {user.username} with role {user.role}"
        ))
        db.commit()
        return user

    @classmethod
    def update_user(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        username: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[str] = None,
        team_id: Optional[int] = None,
        whatsapp_number: Optional[str] = None,
        is_active: Optional[bool] = None,
        password: Optional[str] = None
    ) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise BookingException(f"User with ID {user_id} not found.", status_code=404)

        changes = []
        if username is not None and username.strip():
            uname = username.strip()
            conflict = db.query(User).filter(User.username == uname, User.id != user_id).first()
            if conflict:
                raise BookingException(f"Username '{uname}' is already taken.", status_code=400)
            if user.username != uname:
                changes.append(f"username: {user.username} -> {uname}")
                user.username = uname

        if email is not None and email.strip():
            em = str(email).strip()
            conflict = db.query(User).filter(User.email == em, User.id != user_id).first()
            if conflict:
                raise BookingException(f"Email '{em}' is already in use.", status_code=400)
            if user.email != em:
                changes.append(f"email: {user.email} -> {em}")
                user.email = em

        if role is not None:
            new_role = role.upper()
            if user.role != new_role:
                changes.append(f"role: {user.role} -> {new_role}")
                user.role = new_role

        if team_id is not None:
            new_team = team_id if team_id > 0 else None
            if user.team_id != new_team:
                changes.append(f"team_id: {user.team_id} -> {new_team}")
                user.team_id = new_team

        if whatsapp_number is not None:
            wn = whatsapp_number.strip() if whatsapp_number.strip() else None
            if user.whatsapp_number != wn:
                changes.append(f"whatsapp: {user.whatsapp_number} -> {wn}")
                user.whatsapp_number = wn

        if is_active is not None:
            if user.is_active != is_active:
                changes.append(f"is_active: {user.is_active} -> {is_active}")
                user.is_active = is_active

        if password is not None and len(password.strip()) > 0:
            user.password_hash = hash_password(password.strip())
            changes.append("password reset")

        db.commit()
        db.refresh(user)

        # Audit log
        details_str = ", ".join(changes) if changes else "No fields changed"
        db.add(AuditLog(
            actor_id=actor.id,
            action="UPDATE_USER",
            entity_type="USER",
            entity_id=user.id,
            details=f"Updated user {user.username}: {details_str}"
        ))
        db.commit()
        return user

    @classmethod
    def delete_user(cls, db: Session, actor: User, user_id: int) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise BookingException(f"User with ID {user_id} not found.", status_code=404)

        if user.id == actor.id:
            raise BookingException("Cannot delete your own administrator account.", status_code=400)

        # Reassign created bookings to avoid foreign key RESTRICT violation while preserving records
        db.query(Booking).filter(Booking.created_by == user_id).update({"created_by": actor.id})
        db.query(Booking).filter(Booking.cancelled_by == user_id).update({"cancelled_by": actor.id})

        # Remove board permissions
        db.query(BoardTeamPermission).filter(BoardTeamPermission.user_id == user_id).delete()

        username = user.username
        db.delete(user)
        db.commit()

        # Audit log
        db.add(AuditLog(
            actor_id=actor.id,
            action="DELETE_USER",
            entity_type="USER",
            entity_id=user_id,
            details=f"Deleted account @{username} (ID: {user_id})"
        ))
        db.commit()
        return {"message": f"User account '@{username}' has been deleted successfully."}

    @classmethod
    def update_room(
        cls,
        db: Session,
        actor: User,
        room_id: int,
        name: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Room:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise BookingException(f"Room with ID {room_id} not found.", status_code=404)

        # Enforce strict ceiling: At most 2 active rooms permitted!
        if is_active is True and not room.is_active:
            active_count = db.query(Room).filter(Room.is_active.is_(True), Room.id != room_id).count()
            if active_count >= 2:
                raise RoomLimitExceededException("The club cannot configure more than two active dance studios.")

        if name is not None:
            room.name = name
        if is_active is not None:
            room.is_active = is_active

        db.commit()
        db.refresh(room)

        # Audit log
        db.add(AuditLog(
            actor_id=actor.id,
            action="UPDATE_ROOM",
            entity_type="ROOM",
            entity_id=room.id,
            details=f"Updated room {room.name}: is_active={room.is_active}"
        ))
        db.commit()
        return room

    @classmethod
    def update_settings(
        cls,
        db: Session,
        actor: User,
        opening_time: Optional[str] = None,
        closing_time: Optional[str] = None,
        slot_interval_minutes: Optional[int] = None,
        maximum_duration_minutes: Optional[int] = None,
        advance_booking_hours: Optional[int] = None,
        cancellation_cutoff_minutes: Optional[int] = None,
        daily_team_quota_minutes: Optional[int] = None
    ) -> ClubSettings:
        settings_record = db.query(ClubSettings).first()
        if not settings_record:
            settings_record = ClubSettings()
            db.add(settings_record)

        if opening_time is not None:
            settings_record.opening_time = opening_time
        if closing_time is not None:
            settings_record.closing_time = closing_time
        if slot_interval_minutes is not None:
            settings_record.slot_interval_minutes = slot_interval_minutes
        if maximum_duration_minutes is not None:
            settings_record.maximum_duration_minutes = maximum_duration_minutes
        if advance_booking_hours is not None:
            settings_record.advance_booking_hours = advance_booking_hours
        if cancellation_cutoff_minutes is not None:
            settings_record.cancellation_cutoff_minutes = cancellation_cutoff_minutes
        if daily_team_quota_minutes is not None:
            settings_record.daily_team_quota_minutes = daily_team_quota_minutes

        db.commit()
        db.refresh(settings_record)

        # Invalidate / reload ClubConfig Singleton cache
        ClubConfig.get_instance().reload(db)

        # Audit log
        db.add(AuditLog(
            actor_id=actor.id,
            action="UPDATE_SETTINGS",
            entity_type="CLUB_SETTINGS",
            entity_id=settings_record.id,
            details=f"Updated settings: hours={settings_record.opening_time}-{settings_record.closing_time}, advance={settings_record.advance_booking_hours}h"
        ))
        db.commit()
        return settings_record

    @classmethod
    def set_board_permission(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        team_id: int,
        can_create: bool,
        can_cancel: bool = False
    ) -> BoardTeamPermission:
        perm = db.query(BoardTeamPermission).filter(
            BoardTeamPermission.user_id == user_id,
            BoardTeamPermission.team_id == team_id
        ).first()

        if not perm:
            perm = BoardTeamPermission(
                user_id=user_id,
                team_id=team_id,
                can_create_booking=can_create,
                can_cancel_any_booking=can_cancel
            )
            db.add(perm)
        else:
            perm.can_create_booking = can_create
            perm.can_cancel_any_booking = can_cancel

        db.commit()
        db.refresh(perm)

        # Audit log
        db.add(AuditLog(
            actor_id=actor.id,
            action="SET_BOARD_PERMISSION",
            entity_type="BOARD_PERMISSION",
            entity_id=perm.id,
            details=f"User {user_id} on Team {team_id}: can_create={can_create}, can_cancel={can_cancel}"
        ))
        db.commit()
        return perm

    @classmethod
    def list_audit_logs(cls, db: Session, limit: int = 100, offset: int = 0) -> List[AuditLog]:
        return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
