"""
Add confirmation_whatsapp_url column to booking_approvals if missing.
"""
import sqlite3, sys
DB_PATH = r"C:\\Users\\srira\\.gemini\\antigravity\\scratch\\vit-dance-studio-booking\\backend\\vit_dance_booking.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("PRAGMA table_info(booking_approvals)")
cols = {row[1] for row in cur.fetchall()}
if "confirmation_whatsapp_url" not in cols:
    print("Adding column...")
    cur.execute("ALTER TABLE booking_approvals ADD COLUMN confirmation_whatsapp_url TEXT")
    conn.commit()
    print("Added.")
else:
    print("Column already exists.")
conn.close()