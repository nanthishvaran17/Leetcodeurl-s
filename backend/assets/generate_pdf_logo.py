import os
from PIL import Image, ImageDraw, ImageFont

def generate_nandha_college_logo():
    assets_dir = os.path.dirname(__file__)
    os.makedirs(assets_dir, exist_ok=True)
    target_path = os.path.join(assets_dir, "nandha_emblem.png")

    # Create high-res 800x520 image with white background
    width, height = 800, 520
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 1. Outer Octagonal Double Frame
    # Outer Octagon
    outer_poly = [(120, 20), (680, 20), (780, 120), (780, 400), (680, 500), (120, 500), (20, 400), (20, 120)]
    draw.polygon(outer_poly, stroke=(15, 23, 42), width=8)

    # Inner Octagon
    inner_poly = [(130, 30), (670, 30), (770, 130), (770, 390), (670, 490), (130, 490), (30, 390), (30, 130)]
    draw.polygon(inner_poly, stroke=(15, 23, 42), width=3)

    # 2. Horizontal Divider Bars
    draw.rectangle([(30, 220), (770, 226)], fill=(15, 23, 42))
    draw.rectangle([(30, 300), (770, 306)], fill=(15, 23, 42))

    # 3. Center Diamond NEC Crest & Bird Motif
    # Bird head facing left above crest
    draw.arc([360, 70, 440, 140], start=180, end=360, fill=(15, 23, 42), width=6)
    draw.polygon([(360, 105), (330, 100), (360, 115)], fill=(15, 23, 42)) # Beak
    draw.ellipse([385, 90, 395, 100], fill=(15, 23, 42)) # Eye

    # Diamond NEC Box
    draw.polygon([(400, 120), (450, 170), (400, 220), (350, 170)], fill=(15, 23, 42))

    # Feathered Wings (Left & Right)
    for i in range(7):
        # Left wing
        draw.polygon([(100 + i*35, 200 - i*5), (340, 140 + i*8), (340, 150 + i*8), (90 + i*35, 208 - i*5)], fill=(15, 23, 42))
        # Right wing
        draw.polygon([(700 - i*35, 200 - i*5), (460, 140 + i*8), (460, 150 + i*8), (710 - i*35, 208 - i*5)], fill=(15, 23, 42))

    # 4. Middle Section Banner: NANDHA ENGINEERING COLLEGE
    # Drawing heavy text font if default font
    try:
        font_large = ImageFont.truetype("arial.ttf", 34)
        font_motto = ImageFont.truetype("arial.ttf", 26)
    except Exception:
        font_large = ImageFont.load_default()
        font_motto = ImageFont.load_default()

    draw.text((65, 240), "NANDHA ENGINEERING COLLEGE", fill=(15, 23, 42), font=font_large)

    # 5. Lower Section: Pulse Waveform
    # Digital Square Waveform |_|--|_|--|_|
    wave_pts = [
        (200, 340), (250, 340), (250, 400), (310, 400), (310, 340),
        (370, 340), (370, 400), (430, 400), (430, 340),
        (490, 340), (490, 400), (550, 400), (550, 340), (600, 340)
    ]
    draw.line(wave_pts, fill=(15, 23, 42), width=8)

    # Lower Divider Frame
    draw.polygon([(100, 320), (700, 320), (550, 430), (250, 430)], stroke=(15, 23, 42), width=5)

    # 6. Motto Text: LEARN (lower-left), SERVE (bottom-center), SUCCEED (lower-right)
    draw.text((80, 360), "LEARN", fill=(15, 23, 42), font=font_motto)
    draw.text((340, 445), "SERVE", fill=(15, 23, 42), font=font_motto)
    draw.text((580, 360), "SUCCEED", fill=(15, 23, 42), font=font_motto)

    img.save(target_path, "PNG")
    print(f"Successfully generated official Nandha Emblem logo image at {target_path}")
    return target_path

if __name__ == "__main__":
    generate_nandha_college_logo()
