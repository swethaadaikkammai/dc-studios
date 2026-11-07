"""
Migration v4: Adds created_at_ms to booking_approvals for millisecond-level conflict analysis.
"""
import sqlite3
from datetime import datetime
import pytz

DB_PATH = r"C:\Users\srira\.gemini\antigravity\scratch\vit-dance-studio-booking\backend\vit_dance_booking.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(booking_approvals)")
cols = {row[1] for row in cur.fetchall()}

if "created_at_ms" not in cols:
    print("Adding created_at_ms column to booking_approvals...")
    cur.execute("ALTER TABLE booking_approvals ADD COLUMN created_at_ms BIGINT")
    conn.commit()
    print("  Column created_at_ms added.")
else:
    print("created_at_ms already exists.")

# Backfill any existing approvals
cur.execute("SELECT id, created_at FROM booking_approvals WHERE created_at_ms IS NULL")
rows = cur.fetchall()
tz = pytz.timezone("Asia/Kolkata")

for row_id, created_at_str in rows:
    try:
        # SQLite created_at strings: '2026-11-07 14:00:00' or ISO format
        if "." in created_at_str:
            dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        else:
            clean_str = created_at_str.split("+")[0]
            dt = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        epoch_ms = int(dt.timestamp() * 1000)
        cur.execute("UPDATE booking_approvals SET created_at_ms = ? WHERE id = ?", (epoch_ms, row_id))
    except Exception as e:
        print(f"Skipping backfill for row #{row_id}: {e}")

conn.commit()
conn.close()
print("Migration v4 completed successfully.")
