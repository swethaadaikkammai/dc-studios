class BookingException(Exception):
    """Base domain exception for booking operations."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BookingConflictException(BookingException):
    """Raised when a room is already reserved for the requested interval (HTTP 409)."""
    def __init__(self, message: str = "The selected studio slot is no longer available. Please select another time or room."):
        super().__init__(message=message, status_code=409)


class WindowViolationException(BookingException):
    """Raised when a booking start time is outside the rolling 72-hour window (HTTP 422)."""
    def __init__(self, message: str = "Bookings are permitted only within the next 72 hours from the authoritative server time."):
        super().__init__(message=message, status_code=422)


class OperatingHoursException(BookingException):
    """Raised when requested slot violates studio hours, interval, or duration (HTTP 422)."""
    def __init__(self, message: str):
        super().__init__(message=message, status_code=422)


class AuthorizationException(BookingException):
    """Raised when user lacks permission for the requested action (HTTP 403)."""
    def __init__(self, message: str = "You do not have permission to perform this action."):
        super().__init__(message=message, status_code=403)


class AuthenticationException(BookingException):
    """Raised when authentication fails or is missing (HTTP 401)."""
    def __init__(self, message: str = "Invalid credentials or unauthenticated session."):
        super().__init__(message=message, status_code=401)


class RoomLimitExceededException(BookingException):
    """Raised when attempting to activate more than 2 dance rooms (HTTP 422)."""
    def __init__(self, message: str = "The club cannot configure more than two active dance studios."):
        super().__init__(message=message, status_code=422)


class InvalidStateTransitionException(BookingException):
    """Raised when attempting an invalid booking lifecycle transition (HTTP 400)."""
    def __init__(self, message: str):
        super().__init__(message=message, status_code=400)
