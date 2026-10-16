import re
import json
import urllib.parse
from typing import Optional
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.outbox_event import OutboxEvent
from app.schemas.booking import WhatsAppPassInfo
from app.core.time_utils import ensure_campus_timezone


class WhatsAppService:
    """
    Automated WhatsApp Studio Pass Dispatch Engine.
    
    Generates structured digital studio passes and dispatches them
    to the designated Team Head's WhatsApp contact whenever reservations
    are created or queried.
    """

    @classmethod
    def format_pass_text(cls, booking: Booking, team_head: Optional[User] = None) -> str:
        start_tz = ensure_campus_timezone(booking.start_at)
        end_tz = ensure_campus_timezone(booking.end_at)

        start_str = start_tz.strftime("%I:%M %p")
        end_str = end_tz.strftime("%I:%M %p")
        date_str = start_tz.strftime("%A, %d %B %Y")
        duration_mins = int((end_tz - start_tz).total_seconds() / 60)

        team_name = booking.team.name if booking.team else f"Team #{booking.team_id}"
        room_name = booking.room.name if booking.room else f"Room #{booking.room_id}"
        creator_name = booking.creator.username if booking.creator else "Club Member"
        head_name = team_head.username if team_head else "Team Leader"
        pass_image_url = f"http://127.0.0.1:8000/api/bookings/{booking.id}/pass.png"

        return (
            f"*DC STUDIOS — OFFICIAL STUDIO BOOKING PASS*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"*Pass ID:* #{booking.id}\n"
            f"*Dance Team:* {team_name}\n"
            f"*Studio Venue:* {room_name}\n"
            f"*Session Date:* {date_str}\n"
            f"*Slot Timing:* {start_str} - {end_str} IST ({duration_mins} mins)\n"
            f"*Authorized By:* @{creator_name}\n"
            f"*Team Head:* @{head_name}\n"
            f"*Routine / Purpose:* {booking.purpose or 'Fest Practice'}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"*Mandatory Studio Entry Rules:*\n"
            f"1. Every member must present their physical VIT Student ID card.\n"
            f"2. Eating is strictly prohibited inside the dance studio.\n"
            f"3. Vacate the dance room promptly at {end_str} IST.\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_Automated Dispatch • DC Studios Management System_"
        )

    @classmethod
    def build_whatsapp_url(cls, phone_number: Optional[str], text: Optional[str] = None) -> Optional[str]:
        if not phone_number:
            return None
        # Normalize phone: extract only digits
        clean_phone = re.sub(r"[^\d]", "", str(phone_number))
        if not clean_phone:
            return None
        # Default to India +91 if 10-digit number is provided
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
        if text:
            encoded_text = urllib.parse.quote(text)
            return f"https://api.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"
        return f"https://api.whatsapp.com/send?phone={clean_phone}"

    @classmethod
    def get_pass_info(cls, booking: Booking, db: Session) -> Optional[WhatsAppPassInfo]:
        # Identify Team Head for this booking's team
        team_head = db.query(User).filter(
            User.team_id == booking.team_id,
            User.role == "TEAM_HEAD",
            User.is_active.is_(True)
        ).first()

        pass_text = cls.format_pass_text(booking, team_head)
        phone = team_head.whatsapp_number if team_head else None
        whatsapp_url = cls.build_whatsapp_url(phone, pass_text)
        whatsapp_chat_url = cls.build_whatsapp_url(phone, None)
        pass_image_url = f"/api/bookings/{booking.id}/pass.png"

        status_text = "DISPATCHED" if phone else "PENDING_PHONE"

        return WhatsAppPassInfo(
            team_head_name=team_head.username if team_head else None,
            whatsapp_number=phone,
            pass_text=pass_text,
            whatsapp_url=whatsapp_url,
            whatsapp_chat_url=whatsapp_chat_url,
            pass_image_url=pass_image_url,
            status=status_text
        )

    @classmethod
    def dispatch_booking_pass(
        cls,
        booking: Booking,
        db: Session,
        actor: Optional[User] = None
    ) -> WhatsAppPassInfo:
        pass_info = cls.get_pass_info(booking, db)

        # 1. Transactional Outbox Event for async WhatsApp gateway
        outbox = OutboxEvent(
            event_type="WHATSAPP_PASS_DISPATCHED",
            payload=json.dumps({
                "booking_id": booking.id,
                "team_id": booking.team_id,
                "team_head": pass_info.team_head_name,
                "whatsapp_number": pass_info.whatsapp_number,
                "message_type": "image",
                "media_url": pass_info.pass_image_url,
                "pass_text": pass_info.pass_text,
                "whatsapp_url": pass_info.whatsapp_url,
                "status": pass_info.status
            }, default=str)
        )
        db.add(outbox)

        # 2. Immutable Audit Log
        audit_details = (
            f"Studio booking pass #{booking.id} dispatched to Team Head "
            f"@{pass_info.team_head_name or 'Unassigned'} ({pass_info.whatsapp_number or 'No WhatsApp set'})"
        )
        audit = AuditLog(
            actor_id=actor.id if actor else booking.created_by,
            action="WHATSAPP_DISPATCH",
            entity_type="BOOKING",
            entity_id=booking.id,
            details=audit_details
        )
        db.add(audit)
        db.commit()

        return pass_info
