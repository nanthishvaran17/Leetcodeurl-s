import subprocess
import os
import shutil

ffmpeg = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
video = r"output\nandha_tracker_2min_epic_masterpiece.mp4"
out_dir = r"output\preview_snapshots_2min"
os.makedirs(out_dir, exist_ok=True)
brain_dir = r"C:\Users\Nanth\.gemini\antigravity-ide\brain\06725063-a452-4074-ae09-530cb5750391"

snapshots = [
    ("00:00:12.000", "snap_01_dashboard.png"),
    ("00:00:23.000", "snap_02_radar_profile.png"),
    ("00:00:43.000", "snap_03_compare_arena.png"),
    ("00:01:10.000", "snap_04_hr_candidate_finder.png"),
    ("00:01:22.000", "snap_05_ai_control_matrix.png"),
    ("00:01:45.000", "snap_06_campus_kiosk.png"),
]

for ts, filename in snapshots:
    out_path = os.path.join(out_dir, filename)
    cmd = [ffmpeg, "-y", "-ss", ts, "-i", video, "-vframes", "1", out_path]
    subprocess.run(cmd, check=True)
    brain_path = os.path.join(brain_dir, filename)
    shutil.copyfile(out_path, brain_path)
    print(f"Extracted {filename} at {ts}")
