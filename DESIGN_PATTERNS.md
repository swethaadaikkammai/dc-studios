# Gang of Four (GoF) Design Patterns Implementation Documentation

This document details the functional design pattern implementations powering the **VIT Dance Club Studio Booking System**. Each pattern is implemented in operational production code, utilized in core business logic, and verified with automated test suites.

---

## 1. Proxy Pattern: `BookingAuthorizationProxy`

- **Source File**: [`app/patterns/authorization_proxy.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/authorization_proxy.py)
- **Interface**: `IBookingService`
- **Wrapping**: Core `BookingService`
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py), [`tests/test_permissions.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_permissions.py)

### Architectural Intent & Role
The proxy implements `IBookingService` and serves as a strict security barrier between FastAPI API endpoints and the concrete booking engine. It intercepts requests before any business logic or database queries run:
1. **Authentication Check**: Verifies that the requester is authenticated and active.
2. **Role Verification**: Blocks `TEAM_HEAD` accounts from creating reservations (returning `HTTP 403 Forbidden`).
3. **Team-Level Delegation**: Confirms that a `BOARD_MEMBER` has an explicit database grant (`BoardTeamPermission.can_create_booking = True`) for the requested team.
4. **Cancellation Ownership**: Enforces that `TEAM_HEAD` accounts can only cancel bookings associated with their assigned team (`booking.team_id == actor.team_id`), determined solely by server-side user records.
5. **Execution Dispatch**: Forwards authorized requests to `self._real_service.create_booking(...)`.

---

## 2. Strategy Pattern: `BookingPolicy`

- **Source File**: [`app/patterns/booking_policy.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/booking_policy.py)
- **Interface**: `BookingPolicy` (Abstract Base Class)
- **Concrete Strategies**:
  - `FirstComeFirstServedPolicy` (Default)
  - `TeamQuotaPolicy` (Configurable Daily Quota)
- **Injected Into**: `BookingService`
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py)

### Architectural Intent & Role
The strategy pattern decouples the validation algorithm governing team booking eligibility from the database booking transaction:
- **`FirstComeFirstServedPolicy`**: Pure FCFS scheduling where all well-formed requests enter the database transaction queue. The first transaction to commit secures the time range via the PostgreSQL GiST exclusion lock.
- **`TeamQuotaPolicy`**: Enforces a configurable cap on total booking duration (e.g. max 120 minutes per team per local calendar day). It queries existing confirmed bookings for that team on that date and rejects requests exceeding the daily quota.
- Can be switched at runtime by calling `booking_service.set_policy(new_policy)` or via dependency injection.

---

## 3. Factory Method Pattern: `BookingFactory`

- **Source File**: [`app/patterns/booking_factory.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/booking_factory.py)
- **Constructs**: `Booking` domain models
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py), [`tests/test_rolling_72hr.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_rolling_72hr.py)

### Architectural Intent & Role
Encapsulates domain invariant validation and guarantees that invalid booking objects cannot be instantiated in memory:
1. **Rolling 72-Hour Window**: Ensures `server_now <= start_at < server_now + 72 hours`. Start times at or beyond the 72-hour boundary are immediately rejected.
2. **Operating Hours**: Validates that start and end times fall strictly within `09:00` and `19:00` in `Asia/Kolkata` time on the same calendar day.
3. **Slot Intervals**: Verifies that duration and slot start minutes align with 30-minute intervals.
4. **Duration Cap**: Restricts booking duration to the configured maximum (120 minutes).
5. **Initial State**: Initializes the model with `status = "CONFIRMED"`.

---

## 4. State Pattern: `BookingState`

- **Source File**: [`app/patterns/booking_state.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/booking_state.py)
- **Interface**: `BookingState`
- **Concrete States**:
  - `ConfirmedState`
  - `CancelledState`
  - `CompletedState`
- **Helper**: `get_booking_state(status_str)`
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py), [`tests/test_booking_rules.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_booking_rules.py)

### Architectural Intent & Role
Controls lifecycle state transitions and prevents illegal status changes through polymorphic state classes rather than scattered string checks:
- **`ConfirmedState`**: Permits transition to `CancelledState` via `.cancel()` (recording `cancelled_at` and `cancelled_by`) and to `CompletedState` via `.complete()` once the booking end time has elapsed.
- **`CancelledState`**: Disallows further transitions (`.cancel()` and `.complete()` raise `InvalidStateTransitionException`).
- **`CompletedState`**: Disallows retrospective cancellation (`.cancel()` raises `InvalidStateTransitionException`).

---

## 5. Observer Pattern: `BookingEventPublisher`

- **Source File**: [`app/patterns/booking_observer.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/booking_observer.py)
- **Publisher**: `BookingEventPublisher`
- **Events**: `BookingEvent` (`BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED`)
- **Subscribers**:
  - `AuditEventSubscriber` (Transactional audit persistence)
  - `AvailabilitySubscriber` (Cache invalidation / real-time updates)
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py)

### Architectural Intent & Role
Enables loose coupling for side effects following booking lifecycle events:
- **Transactional Audit Persistence**: When `publisher.notify(event, db)` is called within `BookingService`, the attached `AuditEventSubscriber` writes an immutable record to the `audit_logs` table and inserts a corresponding event into `outbox_events` within the **exact same database transaction**. If the booking fails or rolls back, the audit record is atomically rolled back as well.
- **Availability Cache Invalidation**: Notifies the availability subsystem which room has changed so real-time slots refresh immediately.

---

## 6. Singleton Pattern: `ClubConfig`

- **Source File**: [`app/patterns/club_config_singleton.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/app/patterns/club_config_singleton.py)
- **Class**: `ClubConfig`
- **Tests**: [`tests/test_design_patterns.py`](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend/tests/test_design_patterns.py)

### Architectural Intent & Role
Provides process-wide, thread-safe access to non-secret operational parameters:
- **Thread Safety**: Implements a double-checked locking mechanism with `threading.Lock` across `__new__`.
- **Database Synchronization**: Maintains default values in memory, but provides `.reload(db: Session)` to synchronize with the `club_settings` PostgreSQL table whenever an Administrator modifies settings via the API.
- **Multi-Worker Note**: Documents that in multi-worker ASGI environments (e.g. Gunicorn/Uvicorn workers), each worker process maintains its local singleton. When settings are updated, `reload()` is called locally and persisted to PostgreSQL.
