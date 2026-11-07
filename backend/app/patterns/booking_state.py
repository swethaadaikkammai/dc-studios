from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Tuple, TYPE_CHECKING
from app.core.exceptions import InvalidStateTransitionException
from app.core.time_utils import ensure_campus_timezone

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


class BookingState(ABC):
    """
    State Pattern: BookingState interface
    
    Controls permissible transitions and domain validations across the booking lifecycle:
    CONFIRMED -> CANCELLED
    CONFIRMED -> COMPLETED
    Disallows invalid transitions (e.g., CANCELLED -> CANCELLED, COMPLETED -> CANCELLED).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def can_cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> Tuple[bool, str]:
        pass

    @abstractmethod
    def cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> 'BookingState':
        pass

    @abstractmethod
    def can_complete(self, booking: 'Booking', server_now: datetime) -> Tuple[bool, str]:
        pass

    @abstractmethod
    def complete(self, booking: 'Booking', server_now: datetime) -> 'BookingState':
        pass


class ConfirmedState(BookingState):
    @property
    def name(self) -> str:
        return "CONFIRMED"

    def can_cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> Tuple[bool, str]:
        now_tz = ensure_campus_timezone(server_now)
        end_tz = ensure_campus_timezone(booking.end_at)
        start_tz = ensure_campus_timezone(booking.start_at)

        # Check if booking is already in the past
        if now_tz >= end_tz:
            return False, "Cannot cancel a booking that has already concluded."

        # Check configured cancellation cutoff
        if cutoff_minutes > 0:
            cutoff_threshold = start_tz - timedelta(minutes=cutoff_minutes)
            if now_tz > cutoff_threshold:
                return False, f"Cancellation cutoff window ({cutoff_minutes} minutes prior to start) has passed."

        return True, ""

    def cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> 'BookingState':
        allowed, reason = self.can_cancel(booking, user, server_now, cutoff_minutes)
        if not allowed:
            raise InvalidStateTransitionException(f"Cancellation rejected: {reason}")

        booking.status = "CANCELLED"
        booking.cancelled_at = ensure_campus_timezone(server_now)
        booking.cancelled_by = user.id
        return CancelledState()

    def can_complete(self, booking: 'Booking', server_now: datetime) -> Tuple[bool, str]:
        now_tz = ensure_campus_timezone(server_now)
        end_tz = ensure_campus_timezone(booking.end_at)
        if now_tz < end_tz:
            return False, "Cannot complete a booking before its scheduled end time."
        return True, ""

    def complete(self, booking: 'Booking', server_now: datetime) -> 'BookingState':
        allowed, reason = self.can_complete(booking, server_now)
        if not allowed:
            raise InvalidStateTransitionException(f"Completion rejected: {reason}")

        booking.status = "COMPLETED"
        return CompletedState()


class CancelledState(BookingState):
    @property
    def name(self) -> str:
        return "CANCELLED"

    def can_cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> Tuple[bool, str]:
        return False, "Booking is already cancelled."

    def cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> 'BookingState':
        raise InvalidStateTransitionException("Cannot cancel an already cancelled booking.")

    def can_complete(self, booking: 'Booking', server_now: datetime) -> Tuple[bool, str]:
        return False, "Cannot complete a cancelled booking."

    def complete(self, booking: 'Booking', server_now: datetime) -> 'BookingState':
        raise InvalidStateTransitionException("Cannot complete a cancelled booking.")


class CompletedState(BookingState):
    @property
    def name(self) -> str:
        return "COMPLETED"

    def can_cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> Tuple[bool, str]:
        return False, "Cannot cancel a completed booking."

    def cancel(self, booking: 'Booking', user: 'User', server_now: datetime, cutoff_minutes: int = 0) -> 'BookingState':
        raise InvalidStateTransitionException("Cannot cancel a completed booking.")

    def can_complete(self, booking: 'Booking', server_now: datetime) -> Tuple[bool, str]:
        return False, "Booking is already completed."

    def complete(self, booking: 'Booking', server_now: datetime) -> 'BookingState':
        raise InvalidStateTransitionException("Booking is already completed.")


def get_booking_state(status: str) -> BookingState:
    """Factory helper to obtain the state instance based on string status."""
    upper = (status or "").upper()
    if upper == "CONFIRMED":
        return ConfirmedState()
    elif upper == "CANCELLED":
        return CancelledState()
    elif upper == "COMPLETED":
        return CompletedState()
    raise ValueError(f"Unknown booking status: '{status}'")
