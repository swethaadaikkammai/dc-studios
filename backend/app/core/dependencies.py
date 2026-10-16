from typing import Optional, List
from fastapi import Depends, Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import decode_access_token
from app.models.user import User
from app.core.exceptions import AuthenticationException, AuthorizationException
from app.services.booking_service import BookingService
from app.patterns.authorization_proxy import BookingAuthorizationProxy

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    token: Optional[str] = None

    # 1. Check Bearer Authorization Header
    if auth_header and auth_header.credentials:
        token = auth_header.credentials

    # 2. Check HTTP-only session cookie
    if not token and settings.COOKIE_NAME in request.cookies:
        token = request.cookies.get(settings.COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthenticated: Please log in to access this resource."
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again."
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims."
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact the administrator."
        )

    return user


def require_role(allowed_roles: List[str]):
    """Role-based authorization dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Access requires one of the following roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


def get_booking_proxy() -> BookingAuthorizationProxy:
    """Dependency injecting the BookingAuthorizationProxy wrapping the real BookingService."""
    real_service = BookingService()
    return BookingAuthorizationProxy(real_service)
