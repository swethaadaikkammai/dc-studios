import sys
sys.path.insert(0, 'C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend')

from datetime import datetime, timedelta
import pytz
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.user import User
from app.core.time_utils import get_authoritative_server_now, ensure_campus_timezone

IST = pytz.timezone("Asia/Kolkata")
db = SessionLocal()

try:
    server_now = get_authoritative_server_now()
    server_now = ensure_campus_timezone(server_now)
    max_lookahead = server_now + timedelta(hours=24)

    print(f"Server now    : {server_now.strftime('%d %b %Y %I:%M %p IST')}")
    print(f"Lookahead end : {max_lookahead.strftime('%d %b %Y %I:%M %p IST')}")
    print()

    # Check admins
    admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
    print(f"Admin users found: {len(admins)}")
    for a in admins:
        print(f"  - {a.username} | phone: {getattr(a, 'phone', 'NO PHONE FIELD')}")
    print()

    # Check upcoming bookings
    bookings = db.query(Booking).filter(
        Booking.status == "CONFIRMED",
        Booking.start_at >= server_now,
        Booking.start_at <= max_lookahead
    ).all()
    print(f"Bookings in window: {len(bookings)}")
    for b in bookings:
        start_tz = ensure_campus_timezone(b.start_at)
        time_until = start_tz - server_now
        hours_until = time_until.total_seconds() / 3600
        print(f"  Booking #{b.id}: {start_tz.strftime('%d %b %I:%M %p')} | {hours_until:.1f}h away | team_id={b.team_id}")
        print(f"    1h < {hours_until:.1f}h <= 24h ? {1 < hours_until <= 24}")
        print(f"    0m < {hours_until:.1f}h <= 1h  ? {0 < hours_until <= 1}")

    # Check audit log deduplication
    from app.models.audit_log import AuditLog
    existing = db.query(AuditLog).filter(
        AuditLog.action.in_(["ADMIN_REMINDER_5H", "ADMIN_REMINDER_1H"])
    ).all()
    print(f"\nExisting reminder audit logs: {len(existing)}")
    for e in existing:
        print(f"  {e.action} | booking_id in details: {e.details}")

finally:
    db.close()
