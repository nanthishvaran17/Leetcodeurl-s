import os
import glob
import shutil

artifacts_dir = r"C:\Users\Nanth\.gemini\antigravity-ide\brain\c359f76e-577f-48b8-9306-ec7d344b7d1e"
public_dir = r"e:\Leetcode Web\frontend\public"
os.makedirs(public_dir, exist_ok=True)

# Find most recent PNG file in artifacts directory
png_files = glob.glob(os.path.join(artifacts_dir, "*.png"))
if png_files:
    # Sort by modification time (most recent first)
    png_files.sort(key=os.path.getmtime, reverse=True)
    latest_logo = png_files[0]
    print(f"Latest logo image found: {latest_logo}")

    target_logo1 = os.path.join(public_dir, "logo.png")
    target_logo2 = os.path.join(public_dir, "nec_25_logo.png")

    shutil.copy(latest_logo, target_logo1)
    shutil.copy(latest_logo, target_logo2)
    print("Successfully updated logo.png and nec_25_logo.png in frontend/public!")
else:
    print("No PNG files found in artifacts directory.")
