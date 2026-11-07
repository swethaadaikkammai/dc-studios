"""
Migration script: adds booking_approvals table and weekend_keys_secured column to club_settings.
Safe to run multiple times (checks before altering).
"""
import sqlite3
import sys

DB_PATH = r"C:\Users\srira\.gemini\antigravity\scratch\vit-dance-studio-booking\backend\vit_dance_booking.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 1. Add weekend_keys_secured column to club_settings if missing
cur.execute("PRAGMA table_info(club_settings)")
cols = {row[1] for row in cur.fetchall()}
if "weekend_keys_secured" not in cols:
    print("Adding weekend_keys_secured to club_settings...")
    cur.execute("ALTER TABLE club_settings ADD COLUMN weekend_keys_secured INTEGER NOT NULL DEFAULT 0")
    print("  Done.")
else:
    print("weekend_keys_secured already exists.")

# 2. Create booking_approvals table if missing
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='booking_approvals'")
if not cur.fetchone():
    print("Creating booking_approvals table...")
    cur.execute("""
        CREATE TABLE booking_approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requested_by INTEGER NOT NULL REFERENCES users(id),
            team_id INTEGER NOT NULL REFERENCES teams(id),
            room_id INTEGER NOT NULL REFERENCES rooms(id),
            start_at DATETIME NOT NULL,
            end_at DATETIME NOT NULL,
            purpose TEXT,
            is_weekend_request VARCHAR(5) NOT NULL DEFAULT 'false',
            approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            reviewed_by INTEGER REFERENCES users(id),
            reviewed_at DATETIME,
            rejection_reason TEXT,
            booking_id INTEGER REFERENCES bookings(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            admin_notified_at DATETIME,
            admin_whatsapp_url TEXT
        )
    """)
    cur.execute("CREATE INDEX idx_ba_status ON booking_approvals(approval_status)")
    cur.execute("CREATE INDEX idx_ba_requested_by ON booking_approvals(requested_by)")
    print("  Done.")
else:
    print("booking_approvals table already exists.")

conn.commit()
conn.close()
print("\nMigration complete.")
