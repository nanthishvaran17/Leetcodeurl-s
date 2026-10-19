import os
import subprocess
import shutil
import time

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE_DIR, "output_apple_60s")
os.makedirs(OUT_DIR, exist_ok=True)

SCENES = [
    {"script": "render_scene_01.js", "seg": "seg_01_hero.mp4", "dur": 6.5},
    {"script": "render_scene_02_exploded.js", "seg": "seg_02_exploded.mp4", "dur": 8.0},
    {"script": "render_scene_03_dashboard_counter.js", "seg": "seg_03_dashboard.mp4", "dur": 7.5},
    {"script": "render_scene_04_growth_timemachine.js", "seg": "seg_04_growth.mp4", "dur": 7.5},
    {"script": "render_scene_05_student_radar.js", "seg": "seg_05_radar.mp4", "dur": 7.5},
    {"script": "render_scene_06_contest_anticheat.js", "seg": "seg_06_contest.mp4", "dur": 7.5},
    {"script": "render_scene_07_auditorium_kiosk.js", "seg": "seg_07_kiosk.mp4", "dur": 7.5},
    {"script": "render_scene_08_team_credits.js", "seg": "seg_08_team.mp4", "dur": 8.0},
]

def render_scenes():
    for sc in SCENES:
        seg_path = os.path.join(OUT_DIR, sc["seg"])
        if not os.path.exists(seg_path) or os.path.getsize(seg_path) < 10000:
            script_path = os.path.join(BASE_DIR, sc["script"])
            print(f"\n==================================================")
            print(f"[RENDER] {sc['script']} -> {sc['seg']}")
            print(f"==================================================")
            subprocess.run(["node", script_path], cwd=BASE_DIR, check=True)
        else:
            print(f"[OK] Already rendered: {sc['seg']} ({(os.path.getsize(seg_path)/1024/1024):.2f} MB)")

def get_exact_duration(filepath):
    cmd = [FFMPEG, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            part = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = part.split(":")
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 7.5

def assemble_master():
    print("\n" + "=" * 60)
    print("  NANDHA LEETCODE INTELLIGENCE - 60s APPLE PRODUCT FILM")
    print("  1920x1080 | 30 FPS | H.264 | Completely Silent (-an)")
    print("=" * 60)

    render_scenes()

    seg_paths = [os.path.join(OUT_DIR, sc["seg"]) for sc in SCENES]
    durs = [get_exact_duration(p) for p in seg_paths]

    print("\n[SEGMENT DURATIONS]")
    for i, (p, d) in enumerate(zip(seg_paths, durs)):
        print(f"  Scene {i+1:02d}: {d:.3f}s  <- {os.path.basename(p)}")

    trans_dur = 0.25  # smooth 0.25s cinematic crossfade
    cmd = [FFMPEG, "-y"]
    for sp in seg_paths:
        cmd.extend(["-i", sp])

    filter_parts = []
    running_len = durs[0]
    last_v = "0:v"

    for i in range(len(SCENES) - 1):
        cur_offset = running_len - trans_dur
        running_len = cur_offset + durs[i + 1]
        out_v = f"v{i+1}"
        filter_parts.append(
            f"[{last_v}][{i+1}:v]xfade=transition=fade:duration={trans_dur:.2f}:offset={cur_offset:.2f}[{out_v}]"
        )
        last_v = out_v

    print(f"\n[TIMELINE] Master Film Duration: {running_len:.2f}s (~{running_len/60:.2f} min)")
    final_v_filter = ";".join(filter_parts)

    master_output = os.path.join(OUT_DIR, "nandha_leetcode_intelligence_apple_showcase_2026.mp4")

    cmd.extend([
        "-filter_complex", final_v_filter,
        "-map", f"[{last_v}]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "16",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",  # Completely silent, no audio track
        master_output
    ])

    print(f"\n[RENDER] Exporting Final Film -> {master_output} ...")
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(master_output) / (1024 * 1024)
    print(f"\n[SUCCESS] {master_output}")
    print(f"          Size  : {size_mb:.2f} MB")
    print(f"          Length: {running_len:.2f}s (~1 minute)")
    print(f"          Audio : Silent (-an)")
    print(f"          Format: 1920x1080 30FPS H.264")

    # Also save to root / output for user convenience
    root_output = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "output"))
    os.makedirs(root_output, exist_ok=True)
    shutil.copyfile(master_output, os.path.join(root_output, "nandha_leetcode_intelligence_showcase_2026.mp4"))
    shutil.copyfile(master_output, os.path.join(root_output, "nandha_tracker_marketing.mp4"))
    print(f"          Copied to: {os.path.join(root_output, 'nandha_leetcode_intelligence_showcase_2026.mp4')}")

if __name__ == "__main__":
    assemble_master()
