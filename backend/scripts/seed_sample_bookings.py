import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.room import Room
from app.models.team import Team
from app.models.user import User
from app.models.booking import Booking
from app.core.time_utils import get_authoritative_server_now, campus_tz

def seed_sample_bookings():
    db = SessionLocal()
    try:
        now = get_authoritative_server_now()
        admin = db.query(User).filter(User.username == "admin").first()
        r1 = db.query(Room).filter(Room.name == "Dance Room 1 - PRP201").first()
        r2 = db.query(Room).filter(Room.name == "Dance Room 2 - PRP202").first()
        
        teams = {t.name: t for t in db.query(Team).all()}
        
        # Tomorrow (within 24-48h)
        tomorrow = now.date() + timedelta(days=1)
        day_after = now.date() + timedelta(days=2)
        
        samples = [
            # Room 1, Tomorrow 10:00 - 11:30 (Mirage)
            (
                r1.id,
                teams["Mirage"].id,
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("10:00", "%H:%M").time())),
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:30", "%H:%M").time())),
                "Vibrance Group Dance Routine"
            ),
            # Room 1, Tomorrow 14:00 - 15:30 (Riwayaat)
            (
                r1.id,
                teams["Riwayaat"].id,
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("14:00", "%H:%M").time())),
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("15:30", "%H:%M").time())),
                "Classical Fusion Rehearsal"
            ),
            # Room 2, Tomorrow 11:00 - 12:30 (Unitrix)
            (
                r2.id,
                teams["Unitrix"].id,
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("11:00", "%H:%M").time())),
                campus_tz.localize(datetime.combine(tomorrow, datetime.strptime("12:30", "%H:%M").time())),
                "Hip-Hop Stunt & Formations"
            ),
            # Room 2, Day after 15:00 - 16:30 (BBC)
            (
                r2.id,
                teams["Bollywood Badmash Company (BBC)"].id,
                campus_tz.localize(datetime.combine(day_after, datetime.strptime("15:00", "%H:%M").time())),
                campus_tz.localize(datetime.combine(day_after, datetime.strptime("16:30", "%H:%M").time())),
                "Bollywood Megamix Practice"
            ),
        ]
        
        for room_id, team_id, start_at, end_at, purpose in samples:
            existing = db.query(Booking).filter(
                Booking.room_id == room_id,
                Booking.start_at == start_at,
                Booking.status == "CONFIRMED"
            ).first()
            if not existing:
                b = Booking(
                    room_id=room_id,
                    team_id=team_id,
                    created_by=admin.id,
                    start_at=start_at,
                    end_at=end_at,
                    status="CONFIRMED",
                    purpose=purpose
                )
                db.add(b)
                print(f"Seeded booking for Team ID {team_id} in Room ID {room_id} on {start_at.strftime('%Y-%m-%d %H:%M')}")
        
        db.commit()
        print("Sample bookings seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_sample_bookings()
