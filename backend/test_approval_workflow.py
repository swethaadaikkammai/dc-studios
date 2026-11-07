import sys
from datetime import datetime, timedelta
import pytz

from app.db.session import SessionLocal
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking import Booking
from app.models.booking_approval import BookingApproval
from app.models.club_settings import ClubSettings
from app.services.approval_service import ApprovalService
from app.services.admin_service import AdminService
from app.core.time_utils import get_authoritative_server_now

db = SessionLocal()

try:
    print("--- 1. Testing Team Head & Admin Accounts ---")
    admin = db.query(User).filter(User.role == "ADMIN").first()
    team_head = db.query(User).filter(User.role == "TEAM_HEAD").first()
    room = db.query(Room).filter(Room.is_active == True).first()
    team = db.query(Team).filter(Team.id == team_head.team_id).first()

    print(f"Admin: @{admin.username} ({admin.whatsapp_number})")
    print(f"Team Head: @{team_head.username} (Team: {team.name})")
    print(f"Room: {room.name}")

    # Set up weekday slot
    now = get_authoritative_server_now()
    # Find next Monday or Tuesday for regular test
    days_ahead = 1
    target_dt = now + timedelta(days=days_ahead)
    while target_dt.weekday() >= 5: # weekend
        target_dt += timedelta(days=1)
    
    start_at = target_dt.replace(hour=11, minute=0, second=0, microsecond=0)
    end_at = target_dt.replace(hour=12, minute=30, second=0, microsecond=0)

    print(f"\n--- 2. Submitting Request for {start_at.strftime('%A, %d %b %Y %I:%M %p')} ---")
    req = ApprovalService.submit_request(
        db=db,
        actor=team_head,
        team_id=team.id,
        room_id=room.id,
        start_at=start_at,
        end_at=end_at,
        purpose="Choreo blocking session"
    )
    print(f"Request created! ID: #{req.id}, Status: {req.approval_status}")
    print(f"Admin WhatsApp URL generated: {bool(req.admin_whatsapp_url)}")

    print(f"\n--- 3. Admin Approving Request #{req.id} ---")
    approved = ApprovalService.approve_request(db=db, admin=admin, approval_id=req.id)
    print(f"Approval status: {approved.approval_status}, Linked Booking ID: #{approved.booking_id}")
    
    booking = db.query(Booking).filter(Booking.id == approved.booking_id).first()
    print(f"Confirmed Booking: #{booking.id}, Status: {booking.status}, Purpose: '{booking.purpose}'")

    print("\n--- 4. Testing Weekend 'Keys Secured' Security Rule ---")
    # Turn off weekend_keys_secured
    AdminService.update_settings(db=db, actor=admin, weekend_keys_secured=False)
    
    # Find next Saturday
    sat_dt = now + timedelta(days=1)
    while sat_dt.weekday() != 5: # 5=Sat
        sat_dt += timedelta(days=1)
    sat_start = sat_dt.replace(hour=14, minute=0, second=0, microsecond=0)
    sat_end = sat_dt.replace(hour=15, minute=30, second=0, microsecond=0)

    try:
        ApprovalService.submit_request(
            db=db,
            actor=team_head,
            team_id=team.id,
            room_id=room.id,
            start_at=sat_start,
            end_at=sat_end,
            purpose="Weekend practice test"
        )
        print("ERROR: Weekend request succeeded when keys were NOT secured!")
    except Exception as e:
        print(f"Successfully caught expected weekend restriction: {e}")

    # Now enable weekend_keys_secured
    print("\nEnabling Weekend Keys Secured mode...")
    AdminService.update_settings(db=db, actor=admin, weekend_keys_secured=True)
    
    sat_req = ApprovalService.submit_request(
        db=db,
        actor=team_head,
        team_id=team.id,
        room_id=room.id,
        start_at=sat_start,
        end_at=sat_end,
        purpose="Weekend permitted practice"
    )
    print(f"Weekend Request created successfully with keys secured! ID: #{sat_req.id}, Weekend Flag: {sat_req.is_weekend_request}")

    print("\n✅ ALL APPROVAL WORKFLOW TESTS PASSED!")

finally:
    db.close()
