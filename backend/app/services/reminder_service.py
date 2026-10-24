import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.booking import Booking
from app.models.user import User
from app.models.outbox_event import OutboxEvent
from app.models.audit_log import AuditLog
from app.core.time_utils import get_authoritative_server_now, ensure_campus_timezone
from app.services.whatsapp_service import WhatsAppService
from app.schemas.reminder import (
    AdminPhoneInfo,
    ReminderRuleInfo,
    UpcomingBookingReminderInfo,
    ReminderDispatchRecord,
    ReminderStatusResponse
)


class ReminderService:
    """
    Automated Administrator Session Reminder Service.
    
    Monitors upcoming confirmed studio bookings and dispatches structured WhatsApp reminders
    to administrator contacts at:
      - 5 hours prior to session start
      - 1 hour prior to session start
    """
    DEFAULT_FALLBACK_PHONE = "+91 98765 43210"

    @classmethod
    def get_admin_recipients(cls, db: Session) -> List[User]:
        """Returns all active users with the ADMIN role."""
        return db.query(User).filter(
            User.role == "ADMIN",
            User.is_active.is_(True)
        ).all()

    @classmethod
    def format_reminder_text(cls, booking: Booking, milestone: str, admin: User) -> str:
        start_tz = ensure_campus_timezone(booking.start_at)
        end_tz = ensure_campus_timezone(booking.end_at)
        date_str = start_tz.strftime("%A, %d %B %Y")
        start_str = start_tz.strftime("%I:%M %p")
        end_str = end_tz.strftime("%I:%M %p")
        duration_mins = int((end_tz - start_tz).total_seconds() / 60)
        team_name = booking.team.name if booking.team else f"Team #{booking.team_id}"
        room_name = booking.room.name if booking.room else f"Room #{booking.room_id}"
        purpose = booking.purpose or "Routine / Fest Practice"

        if milestone == "5H":
            header = "⏰ *DC STUDIOS — 5-HOUR SESSION REMINDER*"
            notice_lead = "starts in approximately 5 hours"
            action_desc = "Please verify room availability, ensure studio keys are in place, and check equipment readiness."
        else:
            header = "🚨 *DC STUDIOS — 1-HOUR FINAL SESSION REMINDER*"
            notice_lead = "starts in 1 hour"
            action_desc = "Please ensure the studio doors/keys are unlocked and dancers have clear access."

        return (
            f"{header}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"*Hello Administrator (@{admin.username}),*\n"
            f"An official studio session {notice_lead}:\n\n"
            f"*Booking ID:* #{booking.id}\n"
            f"*Dance Team:* {team_name}\n"
            f"*Studio Venue:* {room_name}\n"
            f"*Session Date:* {date_str}\n"
            f"*Slot Timing:* {start_str} - {end_str} IST ({duration_mins} mins)\n"
            f"*Purpose:* {purpose}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"ℹ️ *Admin Action:*\n"
            f"{action_desc}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_Automated Reminder Engine • DC Studios Portal_"
        )

    @classmethod
    def has_reminder_been_sent(cls, db: Session, booking_id: int, milestone: str) -> bool:
        """Checks if a reminder for this booking and milestone was already recorded in AuditLog."""
        return db.query(AuditLog).filter(
            AuditLog.entity_type == "BOOKING",
            AuditLog.entity_id == booking_id,
            AuditLog.action == f"ADMIN_REMINDER_{milestone}"
        ).first() is not None

    @classmethod
    def dispatch_reminder_for_booking(
        cls,
        db: Session,
        booking: Booking,
        milestone: str,
        admin: User
    ) -> ReminderDispatchRecord:
        text = cls.format_reminder_text(booking, milestone, admin)
        phone = admin.whatsapp_number or cls.DEFAULT_FALLBACK_PHONE
        whatsapp_url = WhatsAppService.build_whatsapp_url(phone, text)
        now = get_authoritative_server_now()

        # 1. Transactional Outbox Event
        outbox = OutboxEvent(
            event_type=f"ADMIN_REMINDER_{milestone}",
            payload=json.dumps({
                "booking_id": booking.id,
                "milestone": milestone,
                "team_id": booking.team_id,
                "recipient_admin_id": admin.id,
                "recipient_username": admin.username,
                "recipient_phone": phone,
                "reminder_text": text,
                "whatsapp_url": whatsapp_url,
                "status": "DISPATCHED" if phone else "PENDING_PHONE"
            }, default=str)
        )
        db.add(outbox)

        # 2. Immutable Audit Log (used for deduplication)
        team_name = booking.team.name if booking.team else f"Team #{booking.team_id}"
        room_name = booking.room.name if booking.room else f"Room #{booking.room_id}"
        audit = AuditLog(
            actor_id=admin.id,
            action=f"ADMIN_REMINDER_{milestone}",
            entity_type="BOOKING",
            entity_id=booking.id,
            details=(
                f"Admin {milestone} prior reminder dispatched to @{admin.username} "
                f"({phone}) for Booking #{booking.id} ({team_name} in {room_name})"
            )
        )
        db.add(audit)
        db.commit()

        return ReminderDispatchRecord(
            booking_id=booking.id,
            milestone=milestone,
            recipient_phone=phone,
            recipient_username=admin.username,
            sent_at=now.isoformat(),
            reminder_text=text,
            whatsapp_url=whatsapp_url
        )

    @classmethod
    def check_and_dispatch_reminders(
        cls,
        db: Session,
        clock: Optional[datetime] = None
    ) -> List[ReminderDispatchRecord]:
        server_now = clock or get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        admins = cls.get_admin_recipients(db)
        if not admins:
            return []

        # Find active confirmed bookings starting in the future
        max_lookahead = server_now + timedelta(hours=6)
        upcoming_bookings = db.query(Booking).filter(
            Booking.status == "CONFIRMED",
            Booking.start_at > server_now,
            Booking.start_at <= max_lookahead
        ).order_by(Booking.start_at.asc()).all()

        dispatches: List[ReminderDispatchRecord] = []

        for b in upcoming_bookings:
            start_tz = ensure_campus_timezone(b.start_at)
            time_until_start = start_tz - server_now

            # Check 5-Hour Reminder: 1h < lead_time <= 5h
            if timedelta(hours=1) < time_until_start <= timedelta(hours=5):
                if not cls.has_reminder_been_sent(db, b.id, "5H"):
                    for admin in admins:
                        rec = cls.dispatch_reminder_for_booking(db, b, "5H", admin)
                        dispatches.append(rec)

            # Check 1-Hour Reminder: 0m < lead_time <= 1h
            elif timedelta(minutes=0) < time_until_start <= timedelta(hours=1):
                if not cls.has_reminder_been_sent(db, b.id, "1H"):
                    for admin in admins:
                        rec = cls.dispatch_reminder_for_booking(db, b, "1H", admin)
                        dispatches.append(rec)

        return dispatches

    @classmethod
    def get_reminders_status(
        cls,
        db: Session,
        clock: Optional[datetime] = None
    ) -> ReminderStatusResponse:
        server_now = clock or get_authoritative_server_now()
        server_now = ensure_campus_timezone(server_now)

        admins = cls.get_admin_recipients(db)
        admin_phones = [
            AdminPhoneInfo(
                id=a.id,
                username=a.username,
                email=a.email,
                whatsapp_number=a.whatsapp_number
            )
            for a in admins
        ]

        rules = [
            ReminderRuleInfo(
                milestone="5H",
                hours_prior=5,
                description="Sent 5 hours prior to session start (key preparation & room readiness)"
            ),
            ReminderRuleInfo(
                milestone="1H",
                hours_prior=1,
                description="Sent 1 hour prior to session start (final entry clearance & unlocking)"
            )
        ]

        # Upcoming bookings in the next 72 hours
        window_end = server_now + timedelta(hours=72)
        bookings = db.query(Booking).filter(
            Booking.status == "CONFIRMED",
            Booking.start_at > server_now,
            Booking.start_at <= window_end
        ).order_by(Booking.start_at.asc()).all()

        upcoming_info: List[UpcomingBookingReminderInfo] = []
        for b in bookings:
            start_tz = ensure_campus_timezone(b.start_at)
            mins_until = int((start_tz - server_now).total_seconds() / 60)

            # Query audit logs for this booking's reminders
            log_5h = db.query(AuditLog).filter(
                AuditLog.entity_type == "BOOKING",
                AuditLog.entity_id == b.id,
                AuditLog.action == "ADMIN_REMINDER_5H"
            ).first()

            log_1h = db.query(AuditLog).filter(
                AuditLog.entity_type == "BOOKING",
                AuditLog.entity_id == b.id,
                AuditLog.action == "ADMIN_REMINDER_1H"
            ).first()

            reminder_5h_sent = log_5h is not None
            reminder_1h_sent = log_1h is not None

            # Next reminder estimation
            if not reminder_5h_sent and mins_until > 300:
                mins_to_5h = mins_until - 300
                next_rem = f"5H reminder in {mins_to_5h // 60}h {mins_to_5h % 60}m"
            elif not reminder_5h_sent and mins_until <= 300 and mins_until > 60:
                next_rem = "5H reminder due now"
            elif not reminder_1h_sent and mins_until > 60:
                mins_to_1h = mins_until - 60
                next_rem = f"1H reminder in {mins_to_1h // 60}h {mins_to_1h % 60}m"
            elif not reminder_1h_sent and mins_until <= 60:
                next_rem = "1H reminder due now"
            else:
                next_rem = "All reminders dispatched"

            upcoming_info.append(UpcomingBookingReminderInfo(
                booking_id=b.id,
                team_id=b.team_id,
                team_name=b.team.name if b.team else f"Team #{b.team_id}",
                room_id=b.room_id,
                room_name=b.room.name if b.room else f"Room #{b.room_id}",
                start_at=start_tz.isoformat(),
                end_at=ensure_campus_timezone(b.end_at).isoformat(),
                time_until_start_minutes=mins_until,
                reminder_5h_sent=reminder_5h_sent,
                reminder_1h_sent=reminder_1h_sent,
                reminder_5h_sent_at=log_5h.timestamp.isoformat() if log_5h else None,
                reminder_1h_sent_at=log_1h.timestamp.isoformat() if log_1h else None,
                next_reminder=next_rem
            ))

        # Recent outbox events for reminders
        recent_events = db.query(OutboxEvent).filter(
            OutboxEvent.event_type.in_(["ADMIN_REMINDER_5H", "ADMIN_REMINDER_1H"])
        ).order_by(desc(OutboxEvent.created_at)).limit(20).all()

        recent_dispatches: List[ReminderDispatchRecord] = []
        for ev in recent_events:
            try:
                payload = json.loads(ev.payload)
                recent_dispatches.append(ReminderDispatchRecord(
                    booking_id=payload.get("booking_id", 0),
                    milestone=payload.get("milestone", "REMINDER"),
                    recipient_phone=payload.get("recipient_phone"),
                    recipient_username=payload.get("recipient_username", "admin"),
                    sent_at=ev.created_at.isoformat() if ev.created_at else "",
                    reminder_text=payload.get("reminder_text", ""),
                    whatsapp_url=payload.get("whatsapp_url")
                ))
            except Exception:
                continue

        return ReminderStatusResponse(
            admin_phone_numbers=admin_phones,
            reminder_rules=rules,
            upcoming_bookings=upcoming_info,
            recent_dispatches=recent_dispatches
        )
