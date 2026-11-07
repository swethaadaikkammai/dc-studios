from datetime import datetime
from typing import List, Optional, Any, Tuple
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.booking import Booking
from app.models.board_permission import BoardTeamPermission
from app.core.exceptions import AuthorizationException, AuthenticationException


class IBookingService:
    """Interface implemented by the core BookingService and wrapped by BookingAuthorizationProxy."""
    def create_booking(
        self,
        db: Session,
        actor: User,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        purpose: Optional[str] = None,
        clock: Optional[datetime] = None,
        keys_secured: bool = False
    ) -> Booking:
        pass

    def cancel_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int,
        clock: Optional[datetime] = None
    ) -> Booking:
        pass

    def get_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int
    ) -> Optional[Booking]:
        pass

    def list_bookings(
        self,
        db: Session,
        actor: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        room_id: Optional[int] = None,
        team_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[Booking]:
        pass


class BookingAuthorizationProxy(IBookingService):
    """
    Proxy Pattern: BookingAuthorizationProxy
    
    Wraps the real BookingService to enforce server-side role-based authorization,
    active account validation, and team-level delegation policies before forwarding
    execution to the concrete service layer.
    """

    def __init__(self, real_service: IBookingService):
        self._real_service = real_service

    def _verify_active_user(self, actor: Optional[User]) -> None:
        if not actor:
            raise AuthenticationException("Authentication required to access booking operations.")
        if not actor.is_active:
            raise AuthorizationException("Account is deactivated. Access denied.")

    def create_booking(
        self,
        db: Session,
        actor: User,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        purpose: Optional[str] = None,
        clock: Optional[datetime] = None,
        keys_secured: bool = False
    ) -> Booking:
        self._verify_active_user(actor)

        # Enforce that only Administrators can bend rules when keys are secured
        if keys_secured:
            if actor.role != "ADMIN":
                raise AuthorizationException("Only administrators can bend weekend booking rules when keys are secured.")

        # Team Heads submit approval requests (handled via /bookings/request endpoint, not here)
        if actor.role == "TEAM_HEAD":
            raise AuthorizationException(
                "Team Heads must submit booking requests for admin approval. "
                "Use the booking request form — once approved the booking will be confirmed."
            )

        # Board Members must have explicit permission for the requested team
        if actor.role == "BOARD_MEMBER":
            permission = db.query(BoardTeamPermission).filter(
                BoardTeamPermission.user_id == actor.id,
                BoardTeamPermission.team_id == team_id,
                BoardTeamPermission.can_create_booking.is_(True)
            ).first()

            if not permission:
                raise AuthorizationException(
                    f"Board Member '{actor.username}' is not authorized to create bookings for Team ID {team_id}. "
                    "Permission must be explicitly granted by an Administrator."
                )

        # Administrators and Events Head are allowed to create bookings
        elif actor.role in ("ADMIN", "EVENTS_HEAD"):
            pass
        else:
            raise AuthorizationException("Role does not permit booking creation.")

        # Forward permitted request to actual BookingService
        return self._real_service.create_booking(
            db=db,
            actor=actor,
            team_id=team_id,
            room_id=room_id,
            start_at=start_at,
            end_at=end_at,
            purpose=purpose,
            clock=clock,
            keys_secured=keys_secured
        )

    def cancel_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int,
        clock: Optional[datetime] = None
    ) -> Booking:
        self._verify_active_user(actor)

        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise AuthorizationException(f"Booking with ID {booking_id} not found.")

        # Check role-based cancellation permissions
        if actor.role == "TEAM_HEAD":
            # Must own the booking through team affiliation (server-side user record!)
            if not actor.team_id or actor.team_id != booking.team_id:
                raise AuthorizationException(
                    "Team Heads can only cancel bookings belonging to their assigned team. "
                    "You cannot cancel another team's booking."
                )

        elif actor.role == "BOARD_MEMBER":
            # Board members can cancel bookings they personally created or where board permission allows
            if booking.created_by != actor.id:
                # Check if board member has can_cancel_any_booking on this team
                perm = db.query(BoardTeamPermission).filter(
                    BoardTeamPermission.user_id == actor.id,
                    BoardTeamPermission.team_id == booking.team_id,
                    BoardTeamPermission.can_cancel_any_booking.is_(True)
                ).first()
                if not perm:
                    raise AuthorizationException(
                        "Board members can only cancel bookings they personally created, "
                        "unless explicitly granted team-wide cancellation rights."
                    )

        elif actor.role in ("ADMIN", "EVENTS_HEAD"):
            # Administrators and Events Head can cancel any booking
            pass
        else:
            raise AuthorizationException("Unauthorized role for booking cancellation.")

        # Forward permitted operation to real service
        return self._real_service.cancel_booking(
            db=db,
            actor=actor,
            booking_id=booking_id,
            clock=clock
        )

    def get_booking(
        self,
        db: Session,
        actor: User,
        booking_id: int
    ) -> Optional[Booking]:
        self._verify_active_user(actor)
        return self._real_service.get_booking(db=db, actor=actor, booking_id=booking_id)

    def list_bookings(
        self,
        db: Session,
        actor: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        room_id: Optional[int] = None,
        team_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[Booking]:
        self._verify_active_user(actor)
        # All authenticated active users (Admin, Board Members, Team Heads) can view shared calendar
        return self._real_service.list_bookings(
            db=db,
            actor=actor,
            start_date=start_date,
            end_date=end_date,
            room_id=room_id,
            team_id=team_id,
            status=status
        )
