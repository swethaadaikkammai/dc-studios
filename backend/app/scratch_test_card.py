import os
import io
import math
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

def get_font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_calendar_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 18, color: str = "#2563EB"):
    w, h = size, size
    draw.rounded_rectangle([(x, y + 2), (x + w, y + h)], radius=3, outline=color, width=2)
    draw.rounded_rectangle([(x, y + 2), (x + w, y + 6)], radius=2, fill=color)
    draw.line([(x + 4, y - 1), (x + 4, y + 3)], fill=color, width=2)
    draw.line([(x + w - 4, y - 1), (x + w - 4, y + 3)], fill=color, width=2)
    # Dots
    draw.rectangle([(x + 4, y + 9), (x + 6, y + 11)], fill=color)
    draw.rectangle([(x + 8, y + 9), (x + 10, y + 11)], fill=color)
    draw.rectangle([(x + 12, y + 9), (x + 14, y + 11)], fill=color)

def draw_clock_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 18, color: str = "#2563EB"):
    draw.ellipse([(x, y), (x + size, y + size)], outline=color, width=2)
    cx, cy = x + size / 2, y + size / 2
    draw.line([(cx, cy), (cx, cy - size * 0.32)], fill=color, width=2)
    draw.line([(cx, cy), (cx + size * 0.25, cy - size * 0.12)], fill=color, width=2)
    draw.ellipse([(cx - 1.5, cy - 1.5), (cx + 1.5, cy + 1.5)], fill=color)

def draw_mappin_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 18, color: str = "#F43F5E"):
    w = size
    h = size + 2
    cx = x + w / 2
    r = w / 2
    draw.ellipse([(x, y), (x + w, y + w)], outline=color, width=2)
    draw.ellipse([(cx - 2.5, y + r - 2.5), (cx + 2.5, y + r + 2.5)], fill=color)
    draw.polygon([(x + 2, y + r + 2), (x + w - 2, y + r + 2), (cx, y + h)], fill=color)

def draw_user_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 18, color: str = "#6366F1"):
    cx = x + size / 2
    head_r = size * 0.28
    head_y = y + head_r
    draw.ellipse([(cx - head_r, head_y - head_r), (cx + head_r, head_y + head_r)], outline=color, width=2)
    body_top = y + size * 0.58
    draw.arc([(x + 1, body_top), (x + size - 1, y + size + 6)], start=180, end=360, fill=color, width=2)

def draw_check_icon(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 16, color: str = "#059669"):
    draw.ellipse([(x, y), (x + size, y + size)], outline=color, width=1)
    pts = [(x + size * 0.28, y + size * 0.50), (x + size * 0.44, y + size * 0.68), (x + size * 0.74, y + size * 0.32)]
    draw.line(pts, fill=color, width=2)

def draw_sparkle(draw: ImageDraw.ImageDraw, cx: float, cy: float, size: float = 8, color: str = "#93C5FD"):
    pts = [
        (cx, cy - size),
        (cx + size * 0.25, cy - size * 0.25),
        (cx + size, cy),
        (cx + size * 0.25, cy + size * 0.25),
        (cx, cy + size),
        (cx - size * 0.25, cy + size * 0.25),
        (cx - size, cy),
        (cx - size * 0.25, cy - size * 0.25),
    ]
    draw.polygon(pts, fill=color)

def generate_card():
    # Card Dimensions
    W, H = 720, 890
    card_r = 32
    header_h = 230

    # 1. Base card with white fill and rounded corners
    card = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    
    # 2. Header background: Load studio_bg.jpg and apply dark blue gradient
    bg_path = "app/assets/studio_bg.jpg"
    if os.path.exists(bg_path):
        bg_raw = Image.open(bg_path).convert("RGBA")
        # Crop & resize to fit header
        bg_aspect = bg_raw.width / bg_raw.height
        header_aspect = W / header_h
        if bg_aspect > header_aspect:
            new_h = header_h
            new_w = int(header_h * bg_aspect)
        else:
            new_w = W
            new_h = int(W / bg_aspect)
        bg_resized = bg_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
        # Center crop
        left = (new_w - W) // 2
        top = (new_h - header_h) // 2
        header_img = bg_resized.crop((left, top, left + W, top + header_h))
    else:
        header_img = Image.new("RGBA", (W, header_h), (15, 23, 42, 255))

    # Gradient overlay for header (deep slate/blue with opacity)
    gradient = Image.new("RGBA", (W, header_h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gradient)
    for y in range(header_h):
        alpha_factor = y / float(header_h)
        # Interpolate from deep dark navy to richer dance studio blue
        r = int(10 + (20 - 10) * alpha_factor)
        g = int(20 + (50 - 20) * alpha_factor)
        b = int(45 + (160 - 45) * alpha_factor)
        a = int(190 + (235 - 190) * alpha_factor)  # ~75% to 92% opacity
        g_draw.line([(0, y), (W, y)], fill=(r, g, b, a))

    header_composite = Image.alpha_composite(header_img, gradient)

    # Paste header onto card
    card.paste(header_composite, (0, 0))

    # 3. Mask card to rounded rectangle (radius 32)
    mask = Image.new("L", (W, H), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([(0, 0), (W, H)], radius=card_r, fill=255)

    # 4. Now draw all elements onto card
    draw = ImageDraw.Draw(card)

    # Header elements
    # Sparkle Pill: [✦ STUDIO RESERVATION PASS]
    pill_x0, pill_y0 = 36, 32
    pill_w, pill_h = 245, 34
    draw.rounded_rectangle([(pill_x0, pill_y0), (pill_x0 + pill_w, pill_y0 + pill_h)], radius=17, fill=(255, 255, 255, 38), outline=(255, 255, 255, 80), width=1)
    draw_sparkle(draw, pill_x0 + 20, pill_y0 + 17, size=7, color="#BAE6FD")
    f_pill = get_font(12, bold=True)
    draw.text((pill_x0 + 35, pill_y0 + 9), "STUDIO RESERVATION PASS", fill="#FFFFFF", font=f_pill)

    # Top right: Club Logo Box
    logo_path = "app/assets/logo.png"
    logo_size = 40
    logo_x = W - 36 - logo_size
    logo_y = 29
    draw.rounded_rectangle([(logo_x, logo_y), (logo_x + logo_size, logo_y + logo_size)], radius=12, fill=(255, 255, 255, 38), outline=(255, 255, 255, 70), width=1)
    if os.path.exists(logo_path):
        logo_img = Image.open(logo_path).convert("RGBA")
        logo_img = logo_img.resize((26, 26), Image.Resampling.LANCZOS)
        card.paste(logo_img, (logo_x + 7, logo_y + 7), logo_img)

    # Team Name (Mirage)
    f_team = get_font(36, bold=True)
    draw.text((36, 92), "Mirage", fill="#FFFFFF", font=f_team)

    # Subtitle
    f_sub = get_font(15, bold=False)
    draw.text((36, 145), "DC Studios Official Studio Booking", fill="#93C5FD", font=f_sub)

    # --- White Body Section ---
    curr_y = header_h + 24

    # Reservation Status Row
    f_stat_lbl = get_font(15, bold=False)
    draw.text((36, curr_y + 4), "Reservation Status", fill="#64748B", font=f_stat_lbl)

    # Status Pill: [✓ Active & Confirmed]
    status_w = 175
    status_h = 32
    stat_x0 = W - 36 - status_w
    draw.rounded_rectangle([(stat_x0, curr_y), (stat_x0 + status_w, curr_y + status_h)], radius=16, fill="#ECFDF5", outline="#A7F3D0", width=1)
    draw_check_icon(draw, stat_x0 + 12, curr_y + 8, size=15, color="#059669")
    f_stat_val = get_font(13, bold=True)
    draw.text((stat_x0 + 34, curr_y + 7), "Active & Confirmed", fill="#065F46", font=f_stat_val)

    curr_y += 48

    # Subtle divider line
    draw.line([(36, curr_y), (W - 36, curr_y)], fill="#F1F5F9", width=2)
    curr_y += 24

    # 2-Column Info Grid
    col1_x = 36
    col2_x = 380

    f_lbl = get_font(11, bold=True)
    f_val = get_font(16, bold=True)

    # Row 1: DATE & TIME
    # Col 1: DATE
    draw.text((col1_x, curr_y), "DATE", fill="#94A3B8", font=f_lbl)
    draw_calendar_icon(draw, col1_x, curr_y + 22, size=18, color="#2563EB")
    draw.text((col1_x + 26, curr_y + 20), "Sat, 17 Oct 2026", fill="#0F172A", font=f_val)

    # Col 2: TIME & DURATION
    draw.text((col2_x, curr_y), "TIME & DURATION", fill="#94A3B8", font=f_lbl)
    draw_clock_icon(draw, col2_x, curr_y + 22, size=18, color="#2563EB")
    draw.text((col2_x + 26, curr_y + 20), "02:00 PM (240m)", fill="#0F172A", font=f_val)

    curr_y += 68

    # Row 2: VENUE & BOOKED BY
    # Col 1: VENUE
    draw.text((col1_x, curr_y), "VENUE", fill="#94A3B8", font=f_lbl)
    draw_mappin_icon(draw, col1_x, curr_y + 22, size=18, color="#F43F5E")
    draw.text((col1_x + 26, curr_y + 20), "Dance Room 1 - PRP201", fill="#0F172A", font=f_val)

    # Col 2: BOOKED BY
    draw.text((col2_x, curr_y), "BOOKED BY", fill="#94A3B8", font=f_lbl)
    draw_user_icon(draw, col2_x, curr_y + 22, size=18, color="#6366F1")
    draw.text((col2_x + 26, curr_y + 20), "admin", fill="#0F172A", font=f_val)

    curr_y += 72

    # Practice Purpose Box
    purpose = "Hip-Hop Choreography & Mega-Crew Practice"
    draw.rounded_rectangle([(36, curr_y), (W - 36, curr_y + 68)], radius=14, fill="#F8FAFC", outline="#E2E8F0", width=1)
    draw.text((50, curr_y + 12), "PRACTICE PURPOSE", fill="#94A3B8", font=get_font(10, bold=True))
    draw.text((50, curr_y + 32), purpose, fill="#334155", font=get_font(13, bold=False))

    curr_y += 94

    # Barcode Section
    f_ref = get_font(11, bold=True)
    ref_text = "REF-STUDIO-000303"
    ref_bbox = draw.textbbox((0, 0), ref_text, font=f_ref)
    ref_w = ref_bbox[2] - ref_bbox[0]
    draw.text(((W - ref_w) // 2, curr_y), ref_text, fill="#94A3B8", font=f_ref)

    curr_y += 24

    # Barcode Box Container
    box_w = int(W * 0.72)
    box_h = 48
    box_x = (W - box_w) // 2
    draw.rounded_rectangle([(box_x, curr_y), (box_x + box_w, curr_y + box_h)], radius=10, fill="#F8FAFC", outline="#E2E8F0", width=1)

    # Clean vertical barcode pattern inside container
    bar_y = curr_y + 8
    bar_h = box_h - 16
    bars = [4, 2, 6, 3, 2, 8, 3, 5, 2, 7, 4, 3, 6, 2, 4, 8, 3, 2, 5, 4, 7, 2, 3, 6, 4, 2, 8, 3, 5, 2, 6, 4, 3, 7, 2, 4]
    total_bar_w = sum(bars) + (len(bars) - 1) * 5
    bar_start_x = (W - total_bar_w) // 2
    for b_w in bars:
        draw.rectangle([(bar_start_x, bar_y), (bar_start_x + b_w, bar_y + bar_h)], fill="#1E293B")
        bar_start_x += b_w + 5

    curr_y += box_h + 24

    # Subtle footer watermark
    f_ft = get_font(10, bold=False)
    ft_text = "Official DC Studios Digital Studio Pass • Verified Reservation"
    ft_bbox = draw.textbbox((0, 0), ft_text, font=f_ft)
    ft_w = ft_bbox[2] - ft_bbox[0]
    draw.text(((W - ft_w) // 2, curr_y), ft_text, fill="#CBD5E1", font=f_ft)

    # 5. Apply rounded mask to card and thin outer border
    final_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    final_img.paste(card, (0, 0), mask=mask)

    # Outer border outline
    draw_final = ImageDraw.Draw(final_img)
    draw_final.rounded_rectangle([(0, 0), (W - 1, H - 1)], radius=card_r, outline="#E2E8F0", width=1)

    final_img.save("app/test_pass_result.png", "PNG")
    print("Pass generated successfully! Saved to app/test_pass_result.png")

generate_card()
