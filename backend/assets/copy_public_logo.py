import os
import shutil

source_logo = r"C:\Users\Nanth\.gemini\antigravity-ide\brain\c359f76e-577f-48b8-9306-ec7d344b7d1e\media__1786377642990.png"
public_dir = r"e:\Leetcode Web\frontend\public"
os.makedirs(public_dir, exist_ok=True)

target_logo = os.path.join(public_dir, "nandha_logo.png")

if os.path.exists(source_logo):
    shutil.copy(source_logo, target_logo)
    print(f"Successfully copied official logo to {target_logo}")
else:
    print(f"Source logo not found at {source_logo}")
