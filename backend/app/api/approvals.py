"""
Booking Approval API
====================
Endpoints for the Team Head → Admin booking approval workflow.

Team Heads:
  POST /api/approvals/request          — submit a new booking request
  GET  /api/approvals/my-requests      — view status of own requests

Admins:
  GET  /api/approvals                  — list all requests (filter by status)
  POST /api/approvals/{id}/approve     — approve a pending request
  POST /api/approvals/{id}/reject      — reject a pending request
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.booking_approval import BookingApproval
from app.schemas.booking_approval import (
    BookingApprovalCreate,
    BookingApprovalReview,
    BookingApprovalRead,
    CompetingConflictInfo,
)
from app.services.approval_service import ApprovalService
from app.services.whatsapp_service import WhatsAppService
from app.core.exceptions import BookingException, AuthorizationException
from app.core.time_utils import ensure_campus_timezone

router = APIRouter(prefix="/approvals", tags=["Booking Approvals"])


def compute_competing_conflicts(approvals: List[BookingApproval]) -> dict:
    """
    Detects when multiple Team Heads submit requests for the same studio room
    and overlapping time slots, computing millisecond-level arrival timing differences.
    """
    pending = [a for a in approvals if a.approval_status == "PENDING"]
    conflicts: dict = {}

    for i, a1 in enumerate(pending):
        a1_ms = a1.created_at_ms
        if not a1_ms and a1.created_at:
            a1_ms = int(ensure_campus_timezone(a1.created_at).timestamp() * 1000)
        a1_start = ensure_campus_timezone(a1.start_at)
        a1_end = ensure_campus_timezone(a1.end_at)

        best_rival = None
        min_abs_diff = None

        for j, a2 in enumerate(pending):
            if a1.id == a2.id or a1.room_id != a2.room_id:
                continue
            a2_start = ensure_campus_timezone(a2.start_at)
            a2_end = ensure_campus_timezone(a2.end_at)

            # Overlapping intervals check: max(start1, start2) < min(end1, end2)
            if max(a1_start, a2_start) < min(a1_end, a2_end):
                a2_ms = a2.created_at_ms
                if not a2_ms and a2.created_at:
                    a2_ms = int(ensure_campus_timezone(a2.created_at).timestamp() * 1000)

                # diff: positive if a1 arrived earlier than a2, negative if later
                diff = (a2_ms or 0) - (a1_ms or 0)
                abs_diff = abs(diff)

                if min_abs_diff is None or abs_diff < min_abs_diff:
                    min_abs_diff = abs_diff
                    best_rival = CompetingConflictInfo(
                        rival_approval_id=a2.id,
                        rival_team_name=a2.team.name if a2.team else f"Team #{a2.team_id}",
                        rival_requester_username=a2.requester.username if a2.requester else "Unknown",
                        rival_requested_at=ensure_campus_timezone(a2.created_at),
                        rival_created_at_ms=a2_ms or 0,
                        time_difference_ms=diff,
                        is_earlier=(a1_ms or 0) <= (a2_ms or 0),
                        overlap_start_at=max(a1_start, a2_start),
                        overlap_end_at=min(a1_end, a2_end),
                    )

        if best_rival:
            conflicts[a1.id] = best_rival

    return conflicts


def _enrich(approval, conflicts: Optional[dict] = None) -> BookingApprovalRead:
    """Flatten relational fields into the flat response schema with conflict race analysis."""
    out = BookingApprovalRead.model_validate(approval)
    out.requester_username = approval.requester.username if approval.requester else None
    out.team_name = approval.team.name if approval.team else None
    out.room_name = approval.room.name if approval.room else None

    # Compute or retrieve WhatsApp confirmation URL
    conf_url = getattr(approval, "confirmation_whatsapp_url", None)
    if not conf_url and approval.approval_status == "APPROVED" and approval.booking:
        team_head = approval.requester
        phone = team_head.whatsapp_number if team_head else None
        reviewer = approval.reviewer
        conf_text = WhatsAppService.format_approval_confirmation_text(
            booking=approval.booking,
            team_head=team_head,
            admin=reviewer,
            approval_id=approval.id
        )
        conf_url = WhatsAppService.build_whatsapp_url(phone, conf_text)

    out.confirmation_whatsapp_url = conf_url
    out.whatsapp_confirmation_url = conf_url

    # Always ensure admin_whatsapp_url is populated so Team Heads can follow up with Admin on WhatsApp
    admin_wa = getattr(approval, "admin_whatsapp_url", None)
    if not admin_wa:
        admin_phone = "+91 7010734009"
        if hasattr(approval, "_sa_instance_state") and approval._sa_instance_state.session:
            db_session = approval._sa_instance_state.session
            first_admin = db_session.query(User).filter(
                User.role == "ADMIN",
                User.is_active.is_(True),
                User.whatsapp_number.isnot(None)
            ).first()
            if first_admin and first_admin.whatsapp_number:
                admin_phone = first_admin.whatsapp_number.strip()

        start_str = ensure_campus_timezone(approval.start_at).strftime("%d %b %Y %I:%M %p")
        end_str = ensure_campus_timezone(approval.end_at).strftime("%I:%M %p")
        team_name = approval.team.name if approval.team else f"Team #{approval.team_id}"
        room_name = approval.room.name if approval.room else f"Room #{approval.room_id}"
        req_by = approval.requester.username if approval.requester else "team_head"
        wa_text = (
            f"*DC STUDIOS — BOOKING REQUEST (#{approval.id})*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"*Team:* {team_name}\n"
            f"*Room:* {room_name}\n"
            f"*Slot:* {start_str} – {end_str} IST\n"
            f"*Purpose:* {approval.purpose or 'Practice'}\n"
            f"*Requested by:* @{req_by}\n"
            f"{'*WEEKEND REQUEST*' if approval.is_weekend_request == 'true' else ''}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Follow-up message for studio booking request."
        )
        admin_wa = WhatsAppService.build_whatsapp_url(admin_phone, wa_text)

    out.admin_whatsapp_url = admin_wa

    # Ensure admin_whatsapp_url_2 is populated if secondary admin phone exists
    admin_wa_2 = getattr(approval, "admin_whatsapp_url_2", None)
    if not admin_wa_2 and hasattr(approval, "_sa_instance_state") and approval._sa_instance_state.session:
        db_session = approval._sa_instance_state.session
        admin_with_p2 = db_session.query(User).filter(
            User.role == "ADMIN",
            User.is_active.is_(True),
            User.whatsapp_number_2.isnot(None)
        ).first()
        if admin_with_p2 and admin_with_p2.whatsapp_number_2 and admin_with_p2.whatsapp_number_2.strip():
            start_str = ensure_campus_timezone(approval.start_at).strftime("%d %b %Y %I:%M %p")
            end_str = ensure_campus_timezone(approval.end_at).strftime("%I:%M %p")
            team_name = approval.team.name if approval.team else f"Team #{approval.team_id}"
            room_name = approval.room.name if approval.room else f"Room #{approval.room_id}"
            req_by = approval.requester.username if approval.requester else "team_head"
            wa_text = (
                f"*DC STUDIOS — BOOKING REQUEST (#{approval.id})*\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"*Team:* {team_name}\n"
                f"*Room:* {room_name}\n"
                f"*Slot:* {start_str} – {end_str} IST\n"
                f"*Purpose:* {approval.purpose or 'Practice'}\n"
                f"*Requested by:* @{req_by}\n"
                f"{'*WEEKEND REQUEST*' if approval.is_weekend_request == 'true' else ''}\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"Follow-up message for studio booking request."
            )
            admin_wa_2 = WhatsAppService.build_whatsapp_url(admin_with_p2.whatsapp_number_2.strip(), wa_text)
    out.admin_whatsapp_url_2 = admin_wa_2

    # Populate millisecond epoch
    if not out.created_at_ms and approval.created_at:
        out.created_at_ms = int(ensure_campus_timezone(approval.created_at).timestamp() * 1000)

    # Attach conflict & millisecond race details
    if conflicts and approval.id in conflicts:
        c = conflicts[approval.id]
        out.has_conflict = True
        out.is_first_requester = c.is_earlier
        out.conflict_delta_ms = -c.time_difference_ms
        out.competing_request = c
    else:
        out.has_conflict = False
        out.is_first_requester = None
        out.conflict_delta_ms = None
        out.competing_request = None

    return out


# ---------------------------------------------------------------------- #
#  Team Head: Submit Request                                               #
# ---------------------------------------------------------------------- #
@router.post("/request", response_model=BookingApprovalRead, status_code=status.HTTP_201_CREATED)
def submit_booking_request(
    payload: BookingApprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Team Heads (and Admins) can submit a room booking request.
    Creates a PENDING approval that is forwarded to the administrator for review.
    WhatsApp notification is dispatched to all admins automatically.
    """
    if current_user.role not in ("TEAM_HEAD", "ADMIN", "EVENTS_HEAD", "BOARD_MEMBER"):
        raise HTTPException(status_code=403, detail="Not authorized to submit booking requests.")
    try:
        approval = ApprovalService.submit_request(
            db=db,
            actor=current_user,
            team_id=payload.team_id,
            room_id=payload.room_id,
            start_at=payload.start_at,
            end_at=payload.end_at,
            purpose=payload.purpose,
            keys_secured=payload.keys_secured or False,
        )
        return _enrich(approval)
    except (BookingException, AuthorizationException) as e:
        code = getattr(e, "status_code", 400)
        msg = getattr(e, "message", str(e))
        raise HTTPException(status_code=code, detail=msg)


# ---------------------------------------------------------------------- #
#  Team Head: My Requests                                                  #
# ---------------------------------------------------------------------- #
@router.get("/my-requests", response_model=List[BookingApprovalRead])
def my_booking_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the current user's booking approval requests and their status."""
    approvals = ApprovalService.list_my_requests(db=db, actor=current_user)
    return [_enrich(a) for a in approvals]


# ---------------------------------------------------------------------- #
#  Admin: List All Requests                                                #
# ---------------------------------------------------------------------- #
@router.get("", response_model=List[BookingApprovalRead])
def list_approval_requests(
    approval_status: Optional[str] = Query(None, description="Filter: PENDING, APPROVED, REJECTED"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"])),
):
    """Admin-only: list all booking approval requests with millisecond race conflict analysis."""
    approvals = ApprovalService.list_requests(db=db, status_filter=approval_status)
    conflicts = compute_competing_conflicts(approvals)
    return [_enrich(a, conflicts=conflicts) for a in approvals]


# ---------------------------------------------------------------------- #
#  Admin: Approve                                                          #
# ---------------------------------------------------------------------- #
@router.post("/{approval_id}/approve", response_model=BookingApprovalRead)
def approve_request(
    approval_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"])),
):
    """
    Admin approves a pending booking request.
    Creates a confirmed Booking record atomically and links it to the approval.
    """
    try:
        approval = ApprovalService.approve_request(db=db, admin=admin_user, approval_id=approval_id)
        return _enrich(approval)
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# ---------------------------------------------------------------------- #
#  Admin: Reject                                                           #
# ---------------------------------------------------------------------- #
@router.post("/{approval_id}/reject", response_model=BookingApprovalRead)
def reject_request(
    approval_id: int,
    payload: BookingApprovalReview,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["ADMIN"])),
):
    """Admin rejects a pending booking request with an optional reason."""
    try:
        approval = ApprovalService.reject_request(
            db=db,
            admin=admin_user,
            approval_id=approval_id,
            reason=payload.rejection_reason
        )
        return _enrich(approval)
    except BookingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
