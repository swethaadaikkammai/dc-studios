"""
Booking Approval Service
========================
Handles the full Team Head → Admin approval workflow:

1. Team Head submits a booking request  → BookingApproval(PENDING)
2. WhatsApp notification dispatched to all admins
3. Admin approves  → BookingApproval(APPROVED) + Booking(CONFIRMED) created atomically
   Admin rejects   → BookingApproval(REJECTED) + reason stored
4. Team Head sees live status in their dashboard
"""
import json
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.booking_approval import BookingApproval
from app.models.booking import Booking
from app.models.club_settings import ClubSettings
from app.models.user import User
from app.models.room import Room
from app.models.team import Team
from app.models.audit_log import AuditLog
from app.models.outbox_event import OutboxEvent
from app.core.time_utils import get_authoritative_server_now, ensure_campus_timezone
from app.core.exceptions import BookingException, AuthorizationException
from app.patterns.booking_factory import BookingFactory
from app.patterns.club_config_singleton import ClubConfig
from app.services.whatsapp_service import WhatsAppService


class ApprovalService:
    """Manages the Team Head booking request & admin approval lifecycle."""

    # ------------------------------------------------------------------ #
    #  Team Head: Submit Request                                           #
    # ------------------------------------------------------------------ #
    @classmethod
    def submit_request(
        cls,
        db: Session,
        actor: User,
        team_id: int,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        purpose: Optional[str] = None,
        keys_secured: bool = False,
    ) -> BookingApproval:
        server_now = get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        # Validate room exists
        room = db.query(Room).filter(Room.id == room_id, Room.is_active.is_(True)).first()
        if not room:
            raise BookingException("Studio room not found or inactive.", status_code=400)

        # Validate team
        team = db.query(Team).filter(Team.id == team_id, Team.is_active.is_(True)).first()
        if not team:
            raise BookingException("Dance team not found or inactive.", status_code=400)

        # Team Heads can only request for their own team
        if actor.role == "TEAM_HEAD" and actor.team_id != team_id:
            raise AuthorizationException("You may only submit requests for your own team.")

        # Determine if this is a weekend request
        start_local = ensure_campus_timezone(start_at)
        is_weekend = start_local.weekday() >= 5  # 5=Sat, 6=Sun

        # Basic time sanity check
        end_local = ensure_campus_timezone(end_at)
        if start_local >= end_local:
            raise BookingException("Start time must be before end time.", status_code=400)
        if start_local < server_now:
            raise BookingException("Cannot request a slot in the past.", status_code=422)

        epoch_ms = int(server_now.timestamp() * 1000)

        approval = BookingApproval(
            requested_by=actor.id,
            team_id=team_id,
            room_id=room_id,
            start_at=start_at,
            end_at=end_at,
            purpose=purpose,
            is_weekend_request="true" if is_weekend else "false",
            approval_status="PENDING",
            created_at=server_now,
            created_at_ms=epoch_ms,
        )
        db.add(approval)
        db.flush()

        # Dispatch WhatsApp notification to all admins
        admins = db.query(User).filter(
            User.role == "ADMIN",
            User.is_active.is_(True)
        ).all()

        start_str = ensure_campus_timezone(start_at).strftime("%d %b %Y %I:%M %p")
        end_str = ensure_campus_timezone(end_at).strftime("%I:%M %p")
        wa_text = (
            f"*DC STUDIOS — BOOKING REQUEST (#{approval.id})*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"*Team:* {team.name}\n"
            f"*Room:* {room.name}\n"
            f"*Slot:* {start_str} – {end_str} IST\n"
            f"*Purpose:* {purpose or 'Practice'}\n"
            f"*Requested by:* @{actor.username}\n"
            f"{'*WEEKEND REQUEST*' if is_weekend else ''}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Log in to the admin portal to approve or reject this request."
        )

        admin_phones = []
        for admin in admins:
            for p in [admin.whatsapp_number, admin.whatsapp_number_2]:
                if p and p.strip() and p.strip() not in admin_phones:
                    admin_phones.append(p.strip())

        first_wa_url = None
        second_wa_url = None
        if admin_phones:
            first_wa_url = WhatsAppService.build_whatsapp_url(admin_phones[0], wa_text)
            if len(admin_phones) > 1:
                second_wa_url = WhatsAppService.build_whatsapp_url(admin_phones[1], wa_text)

        for phone in admin_phones:
            wa_url = WhatsAppService.build_whatsapp_url(phone, wa_text)
            # Store outbox event per admin phone
            outbox = OutboxEvent(
                event_type="BOOKING_REQUEST_NOTIFICATION",
                payload=json.dumps({
                    "approval_id": approval.id,
                    "admin_phone": phone,
                    "whatsapp_url": wa_url,
                    "team": team.name,
                    "room": room.name,
                    "start_at": start_at.isoformat(),
                    "end_at": end_at.isoformat(),
                }, default=str)
            )
            db.add(outbox)

        # Ensure fallback WhatsApp URL is always valid if admins list was empty or lacked phone
        if not first_wa_url:
            first_wa_url = WhatsAppService.build_whatsapp_url("+91 7010734009", wa_text)

        approval.admin_whatsapp_url = first_wa_url
        approval.admin_whatsapp_url_2 = second_wa_url
        approval.admin_notified_at = server_now

        # Audit
        audit = AuditLog(
            actor_id=actor.id,
            action="BOOKING_REQUEST_SUBMITTED",
            entity_type="BOOKING_APPROVAL",
            entity_id=approval.id,
            details=(
                f"@{actor.username} submitted booking request for {team.name} "
                f"in {room.name} at {start_str}"
            )
        )
        db.add(audit)
        db.commit()
        db.refresh(approval)
        return approval

    # ------------------------------------------------------------------ #
    #  Admin: List All Pending / All Requests                              #
    # ------------------------------------------------------------------ #
    @classmethod
    def list_requests(
        cls,
        db: Session,
        status_filter: Optional[str] = None
    ) -> List[BookingApproval]:
        q = db.query(BookingApproval)
        if status_filter:
            q = q.filter(BookingApproval.approval_status == status_filter.upper())
        return q.order_by(BookingApproval.created_at.desc()).all()

    # ------------------------------------------------------------------ #
    #  Team Head: List Their Own Requests                                  #
    # ------------------------------------------------------------------ #
    @classmethod
    def list_my_requests(
        cls,
        db: Session,
        actor: User
    ) -> List[BookingApproval]:
        return db.query(BookingApproval).filter(
            BookingApproval.requested_by == actor.id
        ).order_by(BookingApproval.created_at.desc()).all()

    # ------------------------------------------------------------------ #
    #  Admin: Approve Request                                              #
    # ------------------------------------------------------------------ #
    @classmethod
    def approve_request(
        cls,
        db: Session,
        admin: User,
        approval_id: int
    ) -> BookingApproval:
        approval = db.query(BookingApproval).filter(
            BookingApproval.id == approval_id
        ).first()
        if not approval:
            raise BookingException("Approval request not found.", status_code=404)
        if approval.approval_status != "PENDING":
            raise BookingException(
                f"Request is already {approval.approval_status}.", status_code=409
            )

        server_now = get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        # Check no overlap with existing CONFIRMED bookings
        overlap = db.query(Booking).filter(
            Booking.room_id == approval.room_id,
            Booking.status == "CONFIRMED",
            Booking.start_at < approval.end_at,
            Booking.end_at > approval.start_at
        ).first()
        if overlap:
            # Reject automatically due to conflict
            approval.approval_status = "REJECTED"
            approval.reviewed_by = admin.id
            approval.reviewed_at = server_now
            approval.rejection_reason = (
                f"Slot conflict with existing Booking #{overlap.id}. "
                "Another booking already occupies this time slot."
            )
            db.commit()
            raise BookingException(
                "Cannot approve: the slot is already booked. "
                "The request has been automatically rejected.",
                status_code=409
            )

        # Create the actual confirmed booking
        cfg = ClubConfig.get_instance()
        booking = BookingFactory.create_booking(
            team_id=approval.team_id,
            room_id=approval.room_id,
            created_by=approval.requested_by,
            start_at=approval.start_at,
            end_at=approval.end_at,
            server_now=server_now,
            purpose=approval.purpose,
            config=cfg,
            keys_secured=approval.is_weekend_request == "true"
        )
        db.add(booking)
        db.flush()

        # Dispatch official booking pass outbox event
        WhatsAppService.dispatch_booking_pass(booking=booking, db=db, actor=admin)

        # Build WhatsApp confirmation message for the Team Head / Requester
        team_head = db.query(User).filter(User.id == approval.requested_by).first()
        if not team_head:
            team_head = db.query(User).filter(
                User.team_id == approval.team_id,
                User.role == "TEAM_HEAD"
            ).first()

        phone = team_head.whatsapp_number if team_head else None
        conf_text = WhatsAppService.format_approval_confirmation_text(
            booking=booking,
            team_head=team_head,
            admin=admin,
            approval_id=approval.id
        )
        conf_url = WhatsAppService.build_whatsapp_url(phone, conf_text)

        # Update approval record
        approval.approval_status = "APPROVED"
        approval.reviewed_by = admin.id
        approval.reviewed_at = server_now
        approval.booking_id = booking.id
        approval.confirmation_whatsapp_url = conf_url

        # Store outbox event for confirmation dispatch
        outbox = OutboxEvent(
            event_type="BOOKING_APPROVAL_CONFIRMATION",
            payload=json.dumps({
                "approval_id": approval.id,
                "booking_id": booking.id,
                "team_id": approval.team_id,
                "team_head": team_head.username if team_head else None,
                "whatsapp_number": phone,
                "confirmation_whatsapp_url": conf_url,
                "status": "APPROVED",
            }, default=str)
        )
        db.add(outbox)

        # Audit
        audit = AuditLog(
            actor_id=admin.id,
            action="BOOKING_REQUEST_APPROVED",
            entity_type="BOOKING_APPROVAL",
            entity_id=approval.id,
            details=(
                f"Admin @{admin.username} approved request #{approval.id} → "
                f"Booking #{booking.id} confirmed."
            )
        )
        db.add(audit)
        db.commit()
        db.refresh(approval)
        return approval

    # ------------------------------------------------------------------ #
    #  Admin: Reject Request                                               #
    # ------------------------------------------------------------------ #
    @classmethod
    def reject_request(
        cls,
        db: Session,
        admin: User,
        approval_id: int,
        reason: Optional[str] = None
    ) -> BookingApproval:
        approval = db.query(BookingApproval).filter(
            BookingApproval.id == approval_id
        ).first()
        if not approval:
            raise BookingException("Approval request not found.", status_code=404)
        if approval.approval_status != "PENDING":
            raise BookingException(
                f"Request is already {approval.approval_status}.", status_code=409
            )

        server_now = get_authoritative_server_now()
        approval.approval_status = "REJECTED"
        approval.reviewed_by = admin.id
        approval.reviewed_at = server_now
        approval.rejection_reason = reason or "Rejected by administrator."

        audit = AuditLog(
            actor_id=admin.id,
            action="BOOKING_REQUEST_REJECTED",
            entity_type="BOOKING_APPROVAL",
            entity_id=approval.id,
            details=(
                f"Admin @{admin.username} rejected request #{approval.id}. "
                f"Reason: {approval.rejection_reason}"
            )
        )
        db.add(audit)
        db.commit()
        db.refresh(approval)
        return approval
