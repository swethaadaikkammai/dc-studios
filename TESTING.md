# VIT Dance Club — Automated Testing & Verification Guide

## 1. Overview & Test Execution Summary

The test suite covers backend authentication, authorization proxies, domain validation rules, the rolling 72-hour window boundary conditions, all six Gang of Four design patterns, and live concurrency tests against PostgreSQL.

```bash
# Command to execute tests:
cd backend
.venv\Scripts\pytest -v
```

### Actual Execution Output
```text
============================= test session starts =============================
platform win32 -- Python 3.14.6, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\srira\.gemini\antigravity\scratch\vit-dance-studio-booking\backend
collected 28 items

tests/test_auth.py::test_valid_login PASSED                              [  3%]
tests/test_auth.py::test_invalid_password_login PASSED                   [  7%]
tests/test_auth.py::test_deactivated_account_login PASSED                [ 10%]
tests/test_auth.py::test_unauthenticated_request PASSED                  [ 14%]
tests/test_auth.py::test_logout_clears_cookie PASSED                     [ 17%]
tests/test_auth.py::test_authenticated_me_endpoint PASSED                [ 21%]
tests/test_booking_rules.py::test_opening_hours_valid_and_invalid PASSED [ 25%]
tests/test_booking_rules.py::test_slot_interval_and_duration_limits PASSED [ 28%]
tests/test_booking_rules.py::test_back_to_back_and_overlapping_bookings PASSED [ 32%]
tests/test_booking_rules.py::test_cancelled_booking_releases_room PASSED [ 35%]
tests/test_concurrency.py::test_concurrent_overlapping_bookings_against_postgresql PASSED [ 39%]
tests/test_design_patterns.py::test_singleton_club_config PASSED         [ 42%]
tests/test_design_patterns.py::test_state_pattern_transitions PASSED     [ 46%]
tests/test_design_patterns.py::test_factory_method_pattern PASSED        [ 50%]
tests/test_design_patterns.py::test_strategy_pattern_policies PASSED     [ 53%]
tests/test_design_patterns.py::test_observer_pattern_publishes_event PASSED [ 57%]
tests/test_design_patterns.py::test_authorization_proxy_pattern PASSED   [ 60%]
tests/test_permissions.py::test_board_member_can_book_for_assigned_team PASSED [ 64%]
tests/test_permissions.py::test_board_member_cannot_book_for_unauthorized_team PASSED [ 67%]
tests/test_permissions.py::test_team_head_cannot_create_booking PASSED   [ 71%]
tests/test_permissions.py::test_team_head_can_view_shared_calendar PASSED [ 75%]
tests/test_permissions.py::test_team_head_can_cancel_own_team_booking PASSED [ 78%]
tests/test_permissions.py::test_team_head_cannot_cancel_another_team_booking PASSED [ 82%]
tests/test_permissions.py::test_non_admin_cannot_change_settings PASSED  [ 85%]
tests/test_rolling_72hr.py::test_window_validation_helper_boundaries PASSED [ 89%]
tests/test_rolling_72hr.py::test_booking_factory_enforces_72h_window PASSED [ 92%]
tests/test_rolling_72hr.py::test_api_rejects_beyond_72_hours PASSED      [ 96%]
tests/test_rolling_72hr.py::test_api_rejects_past_slot PASSED            [100%]

======================= 28 passed in 2.09s =======================
```

---

## 2. Test Suites Breakdown

### A. Authentication & Session Management (`test_auth.py`)
- **`test_valid_login`**: Authenticates valid credentials, checks token creation and HTTP-only session cookie issuance.
- **`test_invalid_password_login`**: Tests rejection of incorrect password with generic error message.
- **`test_deactivated_account_login`**: Verifies that deactivated member accounts are blocked with `HTTP 403 Forbidden`.
- **`test_unauthenticated_request`**: Proves unauthenticated API calls receive `HTTP 401 Unauthorized`.
- **`test_logout_clears_cookie`**: Validates session cookie invalidation on logout.

### B. Role-Based Permissions & Authorization Proxy (`test_permissions.py`)
- **`test_board_member_can_book_for_assigned_team`**: Confirms that Board Members can create bookings for delegated teams.
- **`test_board_member_cannot_book_for_unauthorized_team`**: Proves Board Members cannot book for teams they lack explicit permissions for (`HTTP 403`).
- **`test_team_head_cannot_create_booking`**: Proves Team Heads cannot create studio bookings under any circumstances (`HTTP 403`).
- **`test_team_head_can_view_shared_calendar`**: Confirms all roles have read access to the master timetable.
- **`test_team_head_can_cancel_own_team_booking`**: Validates cancellation ownership based on server-side user record.
- **`test_team_head_cannot_cancel_another_team_booking`**: Proves a Team Head cannot cancel another team's reservation (`HTTP 403`).
- **`test_non_admin_cannot_change_settings`**: Verifies administrative protection on settings and account endpoints.

### C. Booking Invariants & Operating Hours (`test_booking_rules.py`)
- **`test_opening_hours_valid_and_invalid`**: Verifies 09:00 AM start and 07:00 PM end are accepted; bookings before 09:00 AM or ending after 07:00 PM are rejected with `HTTP 422`.
- **`test_slot_interval_and_duration_limits`**: Enforces 30-minute intervals and maximum 120-minute cap.
- **`test_back_to_back_and_overlapping_bookings`**: Verifies that back-to-back bookings (`09:00-10:00` and `10:00-11:00`) succeed in the same room, but overlapping intervals (`09:30-10:30`) trigger `HTTP 409 Conflict`.
- **`test_cancelled_booking_releases_room`**: Demonstrates that cancelling an active booking releases the slot for re-booking immediately.

### D. Rolling 72-Hour Boundary Conditions (`test_rolling_72hr.py`)
- **`test_window_validation_helper_boundaries`**: Evaluates boundary conditions with deterministic injected clock:
  - Past slots -> Rejected.
  - Slots within next 72 hours -> Accepted.
  - Slot at EXACT 72.0 hour boundary -> **Rejected** (exclusive boundary rule).
  - Slots beyond 72 hours -> Rejected (`HTTP 422`).
- **`test_booking_factory_enforces_72h_window`**: Proves domain model construction rejects out-of-window requests at the factory level.
- **`test_api_rejects_beyond_72_hours`**: Proves direct API requests attempting to book 5 days in advance fail with `HTTP 422`.

### E. Design Patterns Verification (`test_design_patterns.py`)
- **`test_singleton_club_config`**: Validates process-level identity and database cache reload.
- **`test_state_pattern_transitions`**: Validates legal and illegal state transitions.
- **`test_factory_method_pattern`**: Validates encapsulation of domain constraints.
- **`test_strategy_pattern_policies`**: Tests interchangeable FCFS and Quota strategies.
- **`test_observer_pattern_publishes_event`**: Verifies transactional audit logging.
- **`test_authorization_proxy_pattern`**: Tests proxy security interception.

### F. PostgreSQL Live Concurrency Verification (`test_concurrency.py`)
- **`test_concurrent_overlapping_bookings_against_postgresql`**:
  - Uses `concurrent.futures.ThreadPoolExecutor` to issue parallel requests from separate threads targeting the exact same room and time slot against PostgreSQL.
  - Verifies that exactly one thread succeeds (`HTTP 201 Created`), while the competing thread receives `HTTP 409 Conflict`.
  - Verifies via SQL query that exactly one record exists in PostgreSQL for that room and time.
