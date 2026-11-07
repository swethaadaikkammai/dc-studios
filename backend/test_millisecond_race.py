"""
Test millisecond race condition and conflict detection between two competing team heads.
"""
import sys
import time
from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.models.user import User
from app.models.team import Team
from app.models.room import Room
from app.models.booking_approval import BookingApproval
from app.services.approval_service import ApprovalService
from app.core.time_utils import get_authoritative_server_now
from app.api.approvals import compute_competing_conflicts, _enrich

db = SessionLocal()

try:
    print("=== Testing Millisecond Conflict Mechanism ===")
    admin = db.query(User).filter(User.role == "ADMIN").first()
    heads = db.query(User).filter(User.role == "TEAM_HEAD").all()
    room = db.query(Room).filter(Room.is_active == True).first()

    head1 = heads[0]
    head2 = heads[1] if len(heads) > 1 else heads[0]

    team1 = db.query(Team).filter(Team.id == head1.team_id).first()
    team2 = db.query(Team).filter(Team.id == head2.team_id).first()

    print(f"Team 1: {team1.name} (Head: @{head1.username})")
    print(f"Team 2: {team2.name} (Head: @{head2.username})")
    print(f"Room: {room.name}")

    # Set up future slot within 72h window
    now = get_authoritative_server_now()
    target_dt = now + timedelta(days=2)
    start_at = target_dt.replace(hour=14, minute=0, second=0, microsecond=0)
    end_at = target_dt.replace(hour=16, minute=0, second=0, microsecond=0)

    # 1. Team Head 1 submits first
    print("\n--- Team Head 1 Submitting Request ---")
    req1 = ApprovalService.submit_request(
        db=db,
        actor=head1,
        team_id=team1.id,
        room_id=room.id,
        start_at=start_at,
        end_at=end_at,
        purpose="Production blocking"
    )
    print(f"Req #1 created! ID: #{req1.id}, Time MS: {req1.created_at_ms}")

    # Short delay of ~150 milliseconds to simulate near-instantaneous race
    time.sleep(0.15)

    # 2. Team Head 2 submits second for the overlapping slot
    print("\n--- Team Head 2 Submitting Competing Request (~150ms later) ---")
    req2 = ApprovalService.submit_request(
        db=db,
        actor=head2,
        team_id=team2.id,
        room_id=room.id,
        start_at=start_at,
        end_at=end_at,
        purpose="Final rehearsal"
    )
    print(f"Req #2 created! ID: #{req2.id}, Time MS: {req2.created_at_ms}")

    # 3. Test conflict detection engine
    all_pending = [req1, req2]
    conflicts = compute_competing_conflicts(all_pending)

    print(f"\n--- Conflict Detection Analysis ---")
    print(f"Total conflicts detected: {len(conflicts)}")
    assert req1.id in conflicts, "Request #1 must be flagged with a conflict"
    assert req2.id in conflicts, "Request #2 must be flagged with a conflict"

    c1 = conflicts[req1.id]
    c2 = conflicts[req2.id]

    delta = (req2.created_at_ms or 0) - (req1.created_at_ms or 0)
    print(f"Delta: {delta} milliseconds between submissions")
    assert delta > 0, "Req 1 must have arrived prior to Req 2"

    assert c1.is_earlier == True, "Req 1 must be marked as the earlier requester"
    assert c2.is_earlier == False, "Req 2 must be marked as the later requester"

    enriched1 = _enrich(req1, conflicts=conflicts)
    enriched2 = _enrich(req2, conflicts=conflicts)

    print("\n--- Enriched Output for Admin Dashboard ---")
    print(f"Req #1 ({team1.name}):")
    print(f"  has_conflict: {enriched1.has_conflict}")
    print(f"  is_first_requester: {enriched1.is_first_requester}")
    print(f"  conflict_delta_ms: {enriched1.conflict_delta_ms} ms (lead)")
    print(f"  rival: {enriched1.competing_request.rival_team_name}")

    print(f"\nReq #2 ({team2.name}):")
    print(f"  has_conflict: {enriched2.has_conflict}")
    print(f"  is_first_requester: {enriched2.is_first_requester}")
    print(f"  conflict_delta_ms: {enriched2.conflict_delta_ms} ms (lag)")
    print(f"  rival: {enriched2.competing_request.rival_team_name}")

    print("\n>>> ALL TESTS PASSED! Millisecond conflict tracking works with high precision. <<<")

    # Clean up test records
    db.delete(req1)
    db.delete(req2)
    db.commit()
    print("Cleaned up test approval rows.")

finally:
    db.close()
