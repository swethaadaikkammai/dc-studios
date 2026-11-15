from datetime import datetime, timezone
import re
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.password_reset_request import PasswordResetRequest
from app.schemas.auth import LoginRequest, TokenResponse, AuthMeResponse
from app.schemas.user import UserRead
from app.schemas.password_reset import ForgotPasswordRequest, ForgotPasswordResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate user via username or email and password.
    Issues JWT access token and sets secure HTTP-only session cookie.
    """
    identifier = payload.username_or_email.strip()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is deactivated. Please contact the administrator."
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})

    # Set HTTP-only Cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user)
    )


@router.post("/logout")
def logout(response: Response):
    """Logs out user by clearing the session cookie."""
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "Successfully logged out."}


@router.get("/me", response_model=AuthMeResponse)
def get_current_authenticated_user(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user profile, role, and active permissions."""
    return AuthMeResponse(user=UserRead.model_validate(current_user))


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Public endpoint: Team Head submits a password reset request to notify Administrators.
    """
    identifier = payload.username.strip()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account '{identifier}' not found. Please verify your username."
        )

    team_name = user.team.name if user.team else None
    phone = payload.contact_phone.strip() if payload.contact_phone else user.whatsapp_number

    # Save password reset request
    reset_req = PasswordResetRequest(
        username=user.username,
        team_name=team_name,
        whatsapp_number=phone,
        status="PENDING",
        admin_notes=payload.note
    )
    db.add(reset_req)

    # Log to audit trail
    db.add(AuditLog(
        actor_id=user.id,
        action="PASSWORD_RESET_REQUESTED",
        entity_type="USER",
        entity_id=user.id,
        details=f"User @{user.username} ({team_name or 'No Team'}) requested password reset. Phone: {phone or 'None'}"
    ))
    db.commit()
    db.refresh(reset_req)

    # Generate admin WhatsApp URL for follow-up
    admins = db.query(User).filter(User.role == "ADMIN", User.is_active.is_(True)).all()
    primary_admin = admins[0] if admins else None
    admin_phone = primary_admin.whatsapp_number if primary_admin and primary_admin.whatsapp_number else "917010734009"
    admin_phone_2 = primary_admin.whatsapp_number_2 if primary_admin and primary_admin.whatsapp_number_2 else None

    clean_p1 = re.sub(r'[^0-9]', '', str(admin_phone))
    if len(clean_p1) == 10:
        clean_p1 = "91" + clean_p1

    msg = (
        f"*DC STUDIOS — PASSWORD RESET REQUEST (# {reset_req.id})*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"*Username:* @{user.username}\n"
        f"*Team:* {team_name or 'Authorized Member'}\n"
        f"*Contact Phone:* {phone or 'Not provided'}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Team Head requested a password reset in DC Studios."
    )
    admin_whatsapp_url = f"https://api.whatsapp.com/send?phone={clean_p1}&text={quote(msg)}"

    admin_whatsapp_url_2 = None
    if admin_phone_2:
        clean_p2 = re.sub(r'[^0-9]', '', str(admin_phone_2))
        if len(clean_p2) == 10:
            clean_p2 = "91" + clean_p2
        admin_whatsapp_url_2 = f"https://api.whatsapp.com/send?phone={clean_p2}&text={quote(msg)}"

    return ForgotPasswordResponse(
        message=f"Password reset request registered for @{user.username}. Administrators have been notified.",
        request_id=reset_req.id,
        admin_whatsapp_url=admin_whatsapp_url,
        admin_whatsapp_url_2=admin_whatsapp_url_2
    )
