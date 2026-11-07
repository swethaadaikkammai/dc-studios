import sys
sys.path.insert(0, 'C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend')

from datetime import datetime, timedelta
import pytz
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.user import User
from app.models.team import Team
from app.models.room import Room

IST = pytz.timezone("Asia/Kolkata")
now_ist = datetime.now(IST)

db = SessionLocal()
try:
    # Delete all previous test bookings
    deleted = db.query(Booking).filter(Booking.purpose == "Test Reminder Booking").delete()
    db.commit()
    print(f"Removed {deleted} old test booking(s)")

    # Create booking for tomorrow at 10:00 AM IST (valid operating hours)
    tomorrow = (now_ist + timedelta(days=1)).date()
    start_at = IST.localize(datetime(tomorrow.year, tomorrow.month, tomorrow.day, 10, 0, 0))
    end_at   = start_at + timedelta(hours=1)

    admin = db.query(User).filter(User.username == "admin").first()
    team  = db.query(Team).filter(Team.is_active == True).first()
    room  = db.query(Room).filter(Room.is_active == True).first()

    booking = Booking(
        team_id    = team.id,
        room_id    = room.id,
        created_by = admin.id,
        start_at   = start_at,
        end_at     = end_at,
        status     = "CONFIRMED",
        purpose    = "Test Reminder Booking"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    print(f"\nTest booking created!")
    print(f"  ID      : {booking.id}")
    print(f"  Room    : {room.name}")
    print(f"  Team    : {team.name}")
    print(f"  Start   : {start_at.strftime('%d %b %Y %I:%M %p IST')}")
    print(f"  End     : {end_at.strftime('%d %b %Y %I:%M %p IST')}")
    print(f"\nReminder window expanded to 24h for testing.")
    print(f"Go to: Admin Console -> Session Reminders -> Set phone -> click 'Scan Now'")
finally:
    db.close()
