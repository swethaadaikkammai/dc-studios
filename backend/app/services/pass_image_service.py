import io
import os
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

from app.models.booking import Booking
from app.models.user import User
from app.core.time_utils import ensure_campus_timezone


class PassImageService:
    """
    Renders high-resolution digital studio booking passes as PNG images.
    Used for downloading pass cards and sending pass images via WhatsApp.
    """

    @classmethod
    def _get_font(cls, size: int, bold: bool = False) -> ImageFont.ImageFont:
        candidates = [
            "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for p in candidates:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    @classmethod
    def generate_pass_image(cls, booking: Booking, team_head: Optional[User] = None) -> bytes:
        start_tz = ensure_campus_timezone(booking.start_at)
        end_tz = ensure_campus_timezone(booking.end_at)

        start_str = start_tz.strftime("%I:%M %p")
        end_str = end_tz.strftime("%I:%M %p")
        date_str = start_tz.strftime("%a, %d %b %Y")
        duration_mins = int((end_tz - start_tz).total_seconds() / 60)

        team_name = booking.team.name if booking.team else f"Team #{booking.team_id}"
        room_name = booking.room.name if booking.room else f"Room #{booking.room_id}"
        creator_name = booking.creator.username if booking.creator else "admin"
        head_name = team_head.username if team_head else "team_head"
        purpose = booking.purpose or "Dance Practice Routine"
        status_label = "Active & Confirmed" if booking.status == "CONFIRMED" else booking.status

        # Canvas Dimensions
        W, H = 800, 980
        img = Image.new("RGB", (W, H), color="#F1F5F9")
        draw = ImageDraw.Draw(img)

        # Card Bounds
        cx0, cy0, cx1, cy1 = 40, 40, 760, 940
        draw.rounded_rectangle([(cx0, cy0), (cx1, cy1)], radius=24, fill="#FFFFFF", outline="#E2E8F0", width=2)

        # Header Block
        header_h = 210
        draw.rounded_rectangle([(cx0, cy0), (cx1, cy0 + header_h)], radius=24, fill="#14213D")
        draw.rectangle([(cx0, cy0 + header_h - 24), (cx1, cy0 + header_h)], fill="#14213D")
        # Blue accent line
        draw.rectangle([(cx0, cy0 + header_h - 4), (cx1, cy0 + header_h)], fill="#356AE6")

        f_pill = cls._get_font(12, bold=True)
        f_team = cls._get_font(34, bold=True)
        f_sub = cls._get_font(15, bold=False)

        # Pill badge
        draw.rounded_rectangle([(cx0 + 36, cy0 + 28), (cx0 + 260, cy0 + 58)], radius=15, fill="#1E293B", outline="#356AE6", width=1)
        draw.text((cx0 + 50, cy0 + 36), "STUDIO RESERVATION PASS", fill="#93C5FD", font=f_pill)

        # Team name and sub
        draw.text((cx0 + 36, cy0 + 78), team_name, fill="#FFFFFF", font=f_team)
        draw.text((cx0 + 36, cy0 + 132), "DC Studios Official Studio Booking", fill="#94A3B8", font=f_sub)

        # Status row
        curr_y = cy0 + header_h + 18
        f_lbl = cls._get_font(13, bold=False)
        f_val = cls._get_font(13, bold=True)

        draw.text((cx0 + 36, curr_y + 4), "Reservation Status", fill="#64748B", font=f_lbl)
        if booking.status == "CONFIRMED":
            draw.rounded_rectangle([(cx1 - 220, curr_y), (cx1 - 36, curr_y + 30)], radius=15, fill="#ECFDF5", outline="#A7F3D0", width=1)
            draw.text((cx1 - 200, curr_y + 6), f"[ {status_label} ]", fill="#065F46", font=f_val)
        else:
            draw.rounded_rectangle([(cx1 - 200, curr_y), (cx1 - 36, curr_y + 30)], radius=15, fill="#F1F5F9", outline="#CBD5E1", width=1)
            draw.text((cx1 - 180, curr_y + 6), f"[ {status_label} ]", fill="#475569", font=f_val)

        curr_y += 42
        draw.line([(cx0 + 36, curr_y), (cx1 - 36, curr_y)], fill="#F1F5F9", width=2)
        curr_y += 18

        # 2-Column Info Grid
        col1_x = cx0 + 36
        col2_x = cx0 + 380

        f_grid_lbl = cls._get_font(11, bold=True)
        f_grid_val = cls._get_font(15, bold=True)

        # Row 1: Date & Time
        draw.text((col1_x, curr_y), "DATE", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col1_x, curr_y + 18), date_str, fill="#0F172A", font=f_grid_val)

        draw.text((col2_x, curr_y), "TIME & DURATION", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col2_x, curr_y + 18), f"{start_str} - {end_str} ({duration_mins}m)", fill="#0F172A", font=f_grid_val)

        curr_y += 62

        # Row 2: Venue & Booked By
        draw.text((col1_x, curr_y), "STUDIO VENUE", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col1_x, curr_y + 18), room_name, fill="#0F172A", font=f_grid_val)

        draw.text((col2_x, curr_y), "BOOKED BY", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col2_x, curr_y + 18), f"@{creator_name}", fill="#0F172A", font=f_grid_val)

        curr_y += 62

        # Row 3: Pass ID & Team Head
        draw.text((col1_x, curr_y), "PASS ID", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col1_x, curr_y + 18), f"#{booking.id}", fill="#356AE6", font=f_grid_val)

        draw.text((col2_x, curr_y), "TEAM HEAD", fill="#94A3B8", font=f_grid_lbl)
        draw.text((col2_x, curr_y + 18), f"@{head_name}", fill="#0F172A", font=f_grid_val)

        curr_y += 62

        # Practice Purpose Box
        draw.rounded_rectangle([(cx0 + 36, curr_y), (cx1 - 36, curr_y + 64)], radius=14, fill="#F8FAFC", outline="#E2E8F0", width=1)
        draw.text((cx0 + 50, curr_y + 10), "PRACTICE PURPOSE", fill="#94A3B8", font=cls._get_font(10, bold=True))
        draw.text((cx0 + 50, curr_y + 28), purpose, fill="#334155", font=cls._get_font(13, bold=False))

        curr_y += 86

        # Visual Barcode Pattern
        draw.text((W // 2 - 80, curr_y), f"REF-STUDIO-{booking.id:06d}", fill="#94A3B8", font=cls._get_font(11, bold=True))
        curr_y += 20

        # Barcode stripes
        barcode_x = cx0 + 100
        barcode_y = curr_y
        barcode_h = 42
        pattern = [4, 2, 6, 3, 2, 8, 3, 5, 2, 7, 4, 3, 6, 2, 4, 8, 3, 2, 5, 4, 7, 2, 3, 6, 4, 2, 8, 3, 5, 2, 6, 4, 3, 7, 2, 4]
        for w in pattern:
            draw.rectangle([(barcode_x, barcode_y), (barcode_x + w, barcode_y + barcode_h)], fill="#1E293B")
            barcode_x += w + 6

        curr_y += barcode_h + 16

        # Footer note
        draw.text((W // 2 - 160, curr_y), "Automated Dispatch • DC Studios Management System", fill="#94A3B8", font=cls._get_font(11, bold=False))

        # Output PNG bytes
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
