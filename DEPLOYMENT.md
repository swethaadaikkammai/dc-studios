# VIT Dance Club — Production Deployment Guide

This guide details the deployment pipeline for deploying the application to:
1. **Frontend**: [Vercel](https://vercel.com) (React 19 Vite SPA)
2. **Backend**: [Render](https://render.com) (FastAPI ASGI Web Service)
3. **Database**: [Neon](https://neon.tech) or [Render Managed PostgreSQL](https://render.com/docs/databases)

---

## 1. Managed PostgreSQL Setup (Neon / Render Postgres)

1. Provision a PostgreSQL 15+ database instance (e.g. on [Neon](https://neon.tech) or Render).
2. Connect using `psql` or the web SQL editor and enable the `btree_gist` extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```
3. Copy the pooled connection string, formatted for SQLAlchemy:
   ```text
   postgresql+psycopg2://<user>:<password>@<host>/<database>?sslmode=require
   ```

---

## 2. Backend Deployment on Render

### Using Blueprint (`render.yaml`)
1. In the Render Dashboard, click **New +** -> **Blueprint**.
2. Connect your GitHub repository.
3. Render reads `render.yaml` automatically to spin up:
   - A Managed PostgreSQL instance (`vit-dance-postgres`).
   - A Python Web Service (`vit-dance-booking-api`).
4. Render executes the build command:
   ```bash
   pip install -r requirements.txt
   alembic upgrade head
   python scripts/seed.py
   ```
5. Render launches the web server via:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

### Manual Configuration on Render (Alternative)
- **Environment**: Python
- **Build Command**: `pip install -r requirements.txt && alembic upgrade head && python scripts/seed.py`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root Directory**: `backend`
- **Environment Variables**:
  - `DATABASE_URL`: Your PostgreSQL connection string with `postgresql+psycopg2://`
  - `SECRET_KEY`: High-entropy 64-char string (e.g. `openssl rand -hex 32`)
  - `ENVIRONMENT`: `production`
  - `CORS_ORIGINS`: `["https://your-vercel-domain.vercel.app"]`
  - `COOKIE_SECURE`: `true`
  - `COOKIE_SAMESITE`: `lax`
  - `TIMEZONE`: `Asia/Kolkata`
  - `ADVANCE_BOOKING_HOURS`: `72`

---

## 3. Frontend Deployment on Vercel

1. Log into [Vercel](https://vercel.com) and click **Add New** -> **Project**.
2. Select your repository.
3. Set the **Root Directory** to `frontend`.
4. Framework Preset will auto-detect as **Vite**.
5. Add Environment Variables:
   - `VITE_API_URL`: Your live Render backend URL (e.g. `https://vit-dance-booking-api.onrender.com/api`).
6. Click **Deploy**.
7. Vercel automatically applies `vercel.json` for SPA route handling and security headers.

---

## 4. Production Administrator Bootstrap

After initial deployment, provision the production administrator securely without putting passwords in source control or Git:

```bash
# Run via Render Shell / SSH:
python scripts/bootstrap_admin.py
```
Or set environment variables in Render before deployment:
- `BOOTSTRAP_ADMIN_USERNAME`: `admin`
- `BOOTSTRAP_ADMIN_EMAIL`: `admin@vitdance.ac.in`
- `BOOTSTRAP_ADMIN_PASSWORD`: `<your-secure-password>`

---

## 5. Security Checklist Before Going Live

- [x] Secrets excluded from git (`.env` in `.gitignore`).
- [x] Passwords hashed using Argon2id (`argon2-cffi`).
- [x] Production database protected by password & TLS.
- [x] `COOKIE_SECURE=true` configured in production.
- [x] Exact CORS origin allowlisted (no `*` wildcard with credentials).
- [x] PostgreSQL `EXCLUSION` constraint active for atomic conflict prevention.
- [x] Rolling 72-hour window enforced on the server.
