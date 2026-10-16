# VIT Dance Club — Studio Booking Portal

> **Official Studio Reservation & Scheduling Portal for Dance Studios PRP201 & PRP202**  
> Built as an advanced Design Patterns full-stack web application featuring PostgreSQL transaction-atomic conflict protection, server-authoritative rolling 72-hour windowing, role-based access control, and complete Gang of Four (GoF) design patterns.

---

## 🌟 Key Capabilities

1. **Mandatory Rolling 72-Hour Advance Booking Rule**:
   - Dance studios may be booked only within the next 72 hours from authoritative server time: `[server_now, server_now + 72h)`.
   - The exact 72-hour boundary is strictly exclusive and rejected.
   - Re-validated immediately before database transaction commit.
2. **Database-Enforced Conflict Prevention (FCFS)**:
   - Utilizes PostgreSQL `EXCLUSION` constraints via `btree_gist` and `tstzrange(start_at, end_at, '[)')` where `status = 'CONFIRMED'`.
   - Guaranteed atomic protection against concurrent overlapping requests. Back-to-back bookings (e.g. `10:00-11:00` and `11:00-12:00`) are fully supported.
3. **Role-Based Access Control (RBAC)**:
   - **Club Administrator**: Complete account governance, team delegation configuration, studio rules, and immutable audit logs. Enforces a maximum of 2 active dance rooms.
   - **Board Member**: Views master schedule, creates bookings for assigned teams, manages created bookings.
   - **Team Head**: Views master timetable, views own team's bookings, cancels eligible team bookings. Cannot create bookings.
4. **All Six Required Design Patterns Implemented**:
   - **Proxy**: `BookingAuthorizationProxy`
   - **Strategy**: `BookingPolicy` (`FirstComeFirstServedPolicy`, `TeamQuotaPolicy`)
   - **Factory Method**: `BookingFactory`
   - **State**: `BookingState` (`ConfirmedState`, `CancelledState`, `CompletedState`)
   - **Observer**: `BookingEventPublisher` (with transactional audit persistence)
   - **Singleton**: `ClubConfig` (thread-safe with database cache sync)
5. **Mobile & Desktop Responsive UI**:
   - Deep Navy (`#14213D`), Electric Primary Blue (`#356AE6`), ticket pass reservation designs, 2-lane timetable view on desktop, and agenda card timeline with mobile bottom navigation.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, React Router, TanStack Query, React Hook Form, Zod, date-fns.
- **Backend**: Python 3.14, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, PostgreSQL 18, Argon2id (`argon2-cffi`), python-jose.
- **Testing**: pytest, HTTPX / TestClient, concurrent ThreadPoolExecutor for PostgreSQL race conditions.
- **Deployment**: Vercel (Frontend), Render (FastAPI Backend), Neon / Managed PostgreSQL.

---

## 🏛️ Seeded Studios & Teams

### Exactly Two Active Dance Studios
1. **Dance Room 1 - PRP201**
2. **Dance Room 2 - PRP202**

### Nine Configured Dance Teams
1. Mirage
2. Unitrix
3. Riwayaat
4. Chargers
5. Bollywood Badmash Company (BBC)
6. Maya
7. JnJ
8. Heritage Sanchaya
9. The Freestylers

---

## 👥 Seeded Demonstration Accounts

For local evaluation, the following pre-configured accounts are ready to sign in immediately:

| Role | Username | Password | Email | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@12345` | `admin@vitdance.ac.in` | Full system control, user provisioning, audit trail |
| **Board Member** | `board_lead` | `Board@12345` | `board.lead@vitdance.ac.in` | Permitted to book for Mirage, Unitrix, Riwayaat, Chargers |
| **Team Head** | `mirage_head` | `Mirage@12345` | `mirage.head@vitdance.ac.in` | Assigned to **Mirage** |
| **Team Head** | `unitrix_head` | `Unitrix@12345` | `unitrix.head@vitdance.ac.in` | Assigned to **Unitrix** |
| **Team Head** | `bbc_head` | `Bbc@12345` | `bbc.head@vitdance.ac.in` | Assigned to **Bollywood Badmash Company (BBC)** |

---

## 🚀 Local Quickstart Guide

### 1. Database Setup
Ensure PostgreSQL is running on port 5433 with database `vit_dance_booking` and extension `btree_gist`:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup_local_pg.ps1
```

### 2. Backend Startup
```bash
cd backend
# Create virtual environment and install dependencies:
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# Run migrations and seed data:
.venv\Scripts\alembic upgrade head
.venv\Scripts\python scripts/seed.py
.venv\Scripts\python scripts/seed_sample_bookings.py

# Launch FastAPI ASGI server:
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Startup
```bash
cd frontend
npm install
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 🧪 Running Automated Tests

Run the full pytest suite (including PostgreSQL live concurrency and race tests):
```bash
cd backend
.venv\Scripts\pytest -v
```
**Results**: 28 passed, 0 failed.

---

## 📚 Architectural & Design Pattern Documentation

- [ARCHITECTURE.md](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/ARCHITECTURE.md): Complete system architecture, sequence diagrams, ER schema, role matrix, and deployment topology.
- [DESIGN_PATTERNS.md](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/DESIGN_PATTERNS.md): In-depth walkthrough of all 6 design patterns, classes, methods, and tests.
- [TESTING.md](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/TESTING.md): Detailed automated test results, boundary condition checks, and concurrency verification.
- [DEPLOYMENT.md](file:///C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/DEPLOYMENT.md): Step-by-step production deployment on Vercel, Render, and Neon Managed PostgreSQL.
