from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user, get_booking_proxy
from app.models.user import User
from app.models.booking import Booking
from app.models.club_settings import ClubSettings
from app.schemas.booking import BookingCreate, BookingRead, BookingCancelResponse, WhatsAppPassInfo
from app.schemas.availability import AvailabilityResponse
from app.schemas.club_settings import ClubSettingsRead
from app.patterns.authorization_proxy import BookingAuthorizationProxy
from app.services.availability_service import AvailabilityService
from app.services.whatsapp_service import WhatsAppService
from app.services.pass_image_service import PassImageService
from app.core.exceptions import BookingException, BookingConflictException, WindowViolationException

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("/settings", response_model=ClubSettingsRead)
def get_public_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves operational club settings (opening/closing hours, slot intervals, max duration)
    accessible to all authenticated club members.
    """
    settings_record = db.query(ClubSettings).first()
    if not settings_record:
        raise HTTPException(status_code=404, detail="Club settings not found.")
    return settings_record


@router.get("/availability", response_model=AvailabilityResponse)
def get_availability(
    room_id: int = Query(..., description="ID of the studio room"),
    target_date: date = Query(..., description="Local date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Informational availability endpoint returning slot status for a room and date.
    Respects rolling 72-hour window, operating hours, intervals, max duration, and active bookings.
    """
    availability = AvailabilityService.get_room_availability(
        db=db,
        room_id=room_id,
        target_date=target_date
    )
    if "error" in availability:
        raise HTTPException(status_code=404, detail=availability["error"])
    return availability


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    proxy: BookingAuthorizationProxy = Depends(get_booking_proxy)
):
    """
    Submits a booking request through the BookingAuthorizationProxy.
    Enforces role authorization, team delegation, rolling 72-hour window,
    operating hours, intervals, and PostgreSQL atomic exclusion conflict checks.
    Automatically formats and dispatches a digital studio pass to the Team Head's WhatsApp.
    """
    try:
        booking = proxy.create_booking(
            db=db,
            actor=current_user,
            team_id=payload.team_id,
            room_id=payload.room_id,
            start_at=payload.start_at,
            end_at=payload.end_at,
            purpose=payload.purpose,
            keys_secured=payload.keys_secured or False
        )
        # Automated WhatsApp Pass generation and transactional dispatch
        pass_info = WhatsAppService.dispatch_booking_pass(booking=booking, db=db, actor=current_user)
        booking_read = BookingRead.model_validate(booking)
        if is_admin_or_events_head(current_user):
            booking_read.whatsapp_pass = pass_info
        else:
            booking_read.whatsapp_pass = None
        return booking_read
    except BookingConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except WindowViolationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.message)
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


def is_admin_or_events_head(user: Optional[User]) -> bool:
    """Restricts WhatsApp pass message access to Administrators and the Events Head."""
    if not user or not user.is_active:
        return False
    if user.role in ("ADMIN", "EVENTS_HEAD"):
        return True
    if user.username and user.username.lower() in ("events_head", "admin"):
        return True
    return False


@router.post("/{booking_id}/cancel", response_model=BookingCancelResponse)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    proxy: BookingAuthorizationProxy = Depends(get_booking_proxy)
):
    """
    Cancels an existing booking through the BookingAuthorizationProxy and State pattern.
    Team Heads can only cancel bookings of their own team.
    """
    try:
        booking = proxy.cancel_booking(
            db=db,
            actor=current_user,
            booking_id=booking_id
        )
        return BookingCancelResponse(
            message="Booking successfully cancelled. The studio slot has been released.",
            booking=BookingRead.model_validate(booking)
        )
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{booking_id}/dispatch-whatsapp", response_model=WhatsAppPassInfo)
def dispatch_whatsapp_pass(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    proxy: BookingAuthorizationProxy = Depends(get_booking_proxy)
):
    """
    Triggers or re-sends the automated WhatsApp digital studio booking pass
    to the designated Team Head for this booking.
    Restricted strictly to Administrators and the Events Head.
    """
    if not is_admin_or_events_head(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only Administrators and the Events Head can access and dispatch booking passes."
        )
    booking = proxy.get_booking(db=db, actor=current_user, booking_id=booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return WhatsAppService.dispatch_booking_pass(booking=booking, db=db, actor=current_user)


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking_details(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    proxy: BookingAuthorizationProxy = Depends(get_booking_proxy)
):
    """Retrieves full details of a specific studio booking, including Team Head WhatsApp pass info (restricted)."""
    booking = proxy.get_booking(db=db, actor=current_user, booking_id=booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking_read = BookingRead.model_validate(booking)
    if is_admin_or_events_head(current_user):
        booking_read.whatsapp_pass = WhatsAppService.get_pass_info(booking=booking, db=db)
    else:
        booking_read.whatsapp_pass = None
    return booking_read


@router.get("/{booking_id}/pass.png")
@router.get("/{booking_id}/pass-image")
def get_booking_pass_image(
    booking_id: int,
    db: Session = Depends(get_db)
):
    """
    Renders and serves the high-resolution digital studio booking pass PNG image.
    Publicly accessible so WhatsApp links and downloaded cards render seamlessly.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    team_head = db.query(User).filter(
        User.team_id == booking.team_id,
        User.role == "TEAM_HEAD",
        User.is_active.is_(True)
    ).first()

    image_bytes = PassImageService.generate_pass_image(booking=booking, team_head=team_head)
    return Response(content=image_bytes, media_type="image/png")


@router.get("", response_model=List[BookingRead])
def list_bookings(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    room_id: Optional[int] = None,
    team_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    proxy: BookingAuthorizationProxy = Depends(get_booking_proxy)
):
    """
    Lists studio bookings across both rooms with optional filters.
    Accessible to all authenticated active club members.
    Pass message details are restricted to Administrators and the Events Head.
    """
    bookings = proxy.list_bookings(
        db=db,
        actor=current_user,
        start_date=start_date,
        end_date=end_date,
        room_id=room_id,
        team_id=team_id,
        status=status
    )
    can_view_wa = is_admin_or_events_head(current_user)
    results = []
    for b in bookings:
        br = BookingRead.model_validate(b)
        if can_view_wa:
            br.whatsapp_pass = WhatsAppService.get_pass_info(booking=b, db=db)
        else:
            br.whatsapp_pass = None
        results.append(br)
    return results
