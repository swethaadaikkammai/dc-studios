import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.room import Room
from app.models.team import Team
from app.models.club_settings import ClubSettings
from app.models.user import User
from app.models.board_permission import BoardTeamPermission
from app.core.security import hash_password


TEAMS_TO_SEED = [
    "Mirage",
    "Unitrix",
    "Riwayaat",
    "Chargers",
    "Bollywood Badmash Company (BBC)",
    "Maya",
    "JnJ",
    "Heritage Sanchaya",
    "The Freestylers",
]

ROOMS_TO_SEED = [
    "Dance Room 1 - PRP201",
    "Dance Room 2 - PRP202",
]


def seed_database():
    db = SessionLocal()
    try:
        print("Seeding database (idempotent)...")

        # 1. Seed Rooms (Exactly 2 active dance rooms)
        rooms_dict = {}
        for room_name in ROOMS_TO_SEED:
            room = db.query(Room).filter(Room.name == room_name).first()
            if not room:
                room = Room(name=room_name, is_active=True)
                db.add(room)
                db.flush()
                print(f"Created Room: {room.name}")
            else:
                print(f"Room exists: {room.name}")
            rooms_dict[room.name] = room

        # 2. Seed Teams (9 teams)
        teams_dict = {}
        for team_name in TEAMS_TO_SEED:
            team = db.query(Team).filter(Team.name == team_name).first()
            if not team:
                team = Team(name=team_name, is_active=True)
                db.add(team)
                db.flush()
                print(f"Created Team: {team.name}")
            else:
                print(f"Team exists: {team.name}")
            teams_dict[team.name] = team

        # 3. Seed Club Settings
        settings_record = db.query(ClubSettings).first()
        if not settings_record:
            settings_record = ClubSettings(
                timezone="Asia/Kolkata",
                opening_time="09:00",
                closing_time="19:00",
                slot_interval_minutes=30,
                maximum_duration_minutes=120,
                advance_booking_hours=72,
                cancellation_cutoff_minutes=0,
                daily_team_quota_minutes=0
            )
            db.add(settings_record)
            print("Initialized Club Settings.")
        else:
            print("Club Settings already initialized.")

        # 4. Seed Default Users for Testing & Demonstration
        # Administrator
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@vitdance.ac.in",
                password_hash=hash_password("Admin@12345"),
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)
            db.flush()
            print("Created Admin user: admin (password: Admin@12345)")

        # Board Member
        board_user = db.query(User).filter(User.username == "board_lead").first()
        if not board_user:
            board_user = User(
                username="board_lead",
                email="board.lead@vitdance.ac.in",
                password_hash=hash_password("Board@12345"),
                role="BOARD_MEMBER",
                is_active=True
            )
            db.add(board_user)
            db.flush()
            print("Created Board Member: board_lead (password: Board@12345)")

            # Assign permissions to book for Mirage, Unitrix, Riwayaat, Chargers
            for team_name in ["Mirage", "Unitrix", "Riwayaat", "Chargers"]:
                team = teams_dict.get(team_name)
                if team:
                    perm = BoardTeamPermission(
                        user_id=board_user.id,
                        team_id=team.id,
                        can_create_booking=True,
                        can_cancel_any_booking=False
                    )
                    db.add(perm)
            print("Configured Board Member team permissions for Mirage, Unitrix, Riwayaat, Chargers.")

        # Team Heads
        head_configs = [
            ("mirage_head", "mirage.head@vitdance.ac.in", "Mirage@12345", "Mirage"),
            ("unitrix_head", "unitrix.head@vitdance.ac.in", "Unitrix@12345", "Unitrix"),
            ("bbc_head", "bbc.head@vitdance.ac.in", "Bbc@12345", "Bollywood Badmash Company (BBC)"),
        ]

        for username, email, pwd, team_name in head_configs:
            u = db.query(User).filter(User.username == username).first()
            if not u:
                team = teams_dict.get(team_name)
                u = User(
                    username=username,
                    email=email,
                    password_hash=hash_password(pwd),
                    role="TEAM_HEAD",
                    team_id=team.id if team else None,
                    is_active=True
                )
                db.add(u)
                print(f"Created Team Head: {username} for team {team_name}")

        db.commit()
        print("Database seeding completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
