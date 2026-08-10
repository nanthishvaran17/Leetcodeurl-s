import os
import glob
import shutil
from PIL import Image

artifacts_dir = r"C:\Users\Nanth\.gemini\antigravity-ide\brain\c359f76e-577f-48b8-9306-ec7d344b7d1e"
backend_assets = os.path.join(os.path.dirname(__file__))
frontend_public = r"e:\Leetcode Web\frontend\public"

os.makedirs(backend_assets, exist_ok=True)
os.makedirs(frontend_public, exist_ok=True)

# Find all PNG files in artifacts
pngs = glob.glob(os.path.join(artifacts_dir, "*.png"))
print(f"Found {len(pngs)} PNG artifacts.")

target_emblem = None
for p in sorted(pngs, key=os.path.getmtime, reverse=True):
    try:
        with Image.open(p) as img:
            w, h = img.size
            # Check aspect ratio around 1.2 to 1.6 (octagonal emblem shape)
            ratio = w / float(h)
            print(f"Checking {p}: size={w}x{h}, ratio={ratio:.2f}")
            if 1.1 <= ratio <= 1.7 and w > 200 and h > 150:
                target_emblem = p
                print(f"SELECTED EMBLEM: {p}")
                break
    except Exception as e:
        print(f"Error checking {p}: {e}")

if not target_emblem and pngs:
    target_emblem = sorted(pngs, key=os.path.getmtime, reverse=True)[0]

if target_emblem:
    # Copy to backend assets
    dest_b1 = os.path.join(backend_assets, "nandha_emblem.png")
    dest_b2 = os.path.join(backend_assets, "nandha_logo.png")
    dest_f1 = os.path.join(frontend_public, "nec_official_logo.png")
    dest_f2 = os.path.join(frontend_public, "logo.png")

    shutil.copy(target_emblem, dest_b1)
    shutil.copy(target_emblem, dest_b2)
    shutil.copy(target_emblem, dest_f1)
    shutil.copy(target_emblem, dest_f2)

    print("SUCCESS: Copied official logo to backend/assets and frontend/public!")
else:
    print("No PNG artifact found.")
