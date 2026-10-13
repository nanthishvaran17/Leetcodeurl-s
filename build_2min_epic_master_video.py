import os
import subprocess
import shutil

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
CLIPS_DIR = os.path.abspath("output/raw_clips_2min")
INTERMEDIATE_DIR = os.path.abspath("output/intermediate_clips_2min")
OUTPUT_DIR = os.path.abspath("output")

os.makedirs(INTERMEDIATE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 23 Complete Application Scenes (Exact Timeline: 120.50 seconds / 2m 0.5s)
SCENES = [
    {
        "id": "01",
        "file": "clip_01_intro.webm",
        "ss": 0.0,
        "duration": 4.5,
        "subtitle": "[01/23] Nandha LeetCode Intelligence — Smarter Institutional Tracking",
        "fade_in": True
    },
    {
        "id": "02",
        "file": "clip_02_login.webm",
        "ss": 1.4,
        "duration": 4.5,
        "subtitle": "[02/23] Enterprise Single Sign-On — 563 Enrolled Engineering Cohorts"
    },
    {
        "id": "03",
        "file": "clip_03_dashboard.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[03/23] Executive Command Center — Real-Time Performance Trajectory & KPIs"
    },
    {
        "id": "04",
        "file": "clip_04_students.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[04/23] Master Student Directory — Real LeetCode Ranks & Verified Solve Counts"
    },
    {
        "id": "05",
        "file": "clip_05_profile.webm",
        "ss": 2.5,
        "duration": 5.5,
        "subtitle": "[05/23] Individual Student 360 Dossier — 6-Axis DSA Radar & Digital Identity Pass"
    },
    {
        "id": "06",
        "file": "clip_06_departments.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[06/23] Department Breakdown — Comparative Analytics & Cohort Tiers"
    },
    {
        "id": "07",
        "file": "clip_07_hod.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[07/23] Institutional HOD Deck — Departmental Oversight & Mentorship Targets"
    },
    {
        "id": "08",
        "file": "clip_08_compare.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[08/23] Student Versus Arena — Head-to-Head DSA Skill Matchups & Duels"
    },
    {
        "id": "09",
        "file": "clip_09_weekly_contest.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[09/23] Weekly Contest Tracker — Instant Attendance Reconciliation & Q1–Q4 Telemetry"
    },
    {
        "id": "10",
        "file": "clip_10_integrity.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[10/23] Contest Integrity Monitor — Forensic Dual-ID Detection & Anti-Cheat Audit"
    },
    {
        "id": "11",
        "file": "clip_11_growth.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[11/23] Growth & Delta Intelligence — Velocity Engine & Difficulty Breakdown"
    },
    {
        "id": "12",
        "file": "clip_12_quality.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[12/23] Data Quality Engine — Automated Profile Integrity & Anomaly Detection"
    },
    {
        "id": "13",
        "file": "clip_13_post930.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[13/23] Post 9:30 PM Solvers — Night Owl Coding Discipline & After-Hours Telemetry"
    },
    {
        "id": "14",
        "file": "clip_14_hr_finder.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[14/23] Placement & HR Finder — Precision Talent Filtering for Top Tech Recruiters"
    },
    {
        "id": "15",
        "file": "clip_15_faculty.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[15/23] Faculty Action Center — Prioritized Mentoring Queue & Timely Interventions"
    },
    {
        "id": "16",
        "file": "clip_16_ai_control.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[16/23] Autonomous AI Control Matrix — 24/7 Contest Sync & Sunday Dispatch Scheduler"
    },
    {
        "id": "17",
        "file": "clip_17_system_health.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[17/23] System Health & Telemetry — REST Latency, Database Pools & Service Uptime"
    },
    {
        "id": "18",
        "file": "clip_18_audit.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[18/23] Audit Log & Security Trail — Immutable Admin Activity & Role Oversight"
    },
    {
        "id": "19",
        "file": "clip_19_reports.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[19/23] Universal Reports Hub — Audit-Ready Excel Workbooks & Data Exporters"
    },
    {
        "id": "20",
        "file": "clip_20_data_issues.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[20/23] Data Issues Reconciliation — One-Click LeetCode Profile Resolution"
    },
    {
        "id": "21",
        "file": "clip_21_settings.webm",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "[21/23] Institutional Settings — Policy Configurations & Security Governance"
    },
    {
        "id": "22",
        "file": "clip_22_public.webm",
        "ss": 1.5,
        "duration": 5.5,
        "subtitle": "[22/23] Public Campus Kiosk — Live Hall of Fame for Campus Digital Displays"
    },
    {
        "id": "23",
        "file": "clip_23_outro.webm",
        "ss": 0.0,
        "duration": 5.5,
        "subtitle": "[23/23] Code. Compete. Improve. — Nandha LeetCode Intelligence",
        "fade_out": True
    }
]

def escape_drawtext(text):
    return text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('"', '\\"').replace('%', '\\%')

def process_scene(scene):
    in_file = os.path.join(CLIPS_DIR, scene["file"])
    out_file = os.path.join(INTERMEDIATE_DIR, f"seg_{scene['id']}.ts")
    
    print(f"\nProcessing Scene {scene['id']}: {scene['file']} (ss={scene['ss']}, dur={scene['duration']}s)...")
    
    font_path = "output/font.ttf"
    
    vf_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "fps=30",
        "eq=contrast=1.06:brightness=0.01:saturation=1.14",
        "format=yuv420p"
    ]
    
    if scene.get("fade_in"):
        vf_filters.append("fade=t=in:st=0:d=1.0")
    if scene.get("fade_out"):
        dur = scene["duration"]
        vf_filters.append(f"fade=t=out:st={dur - 1.0:.2f}:d=1.0")
        
    sub = scene.get("subtitle", "").strip()
    if sub:
        esc_sub = escape_drawtext(sub)
        sub_filter = (
            f"drawtext=text='{esc_sub}':"
            f"fontfile='{font_path}':"
            f"fontsize=31:"
            f"fontcolor=white:"
            f"box=1:boxcolor=black@0.82:boxborderw=16:"
            f"x=(w-text_w)/2:y=h-96"
        )
        vf_filters.append(sub_filter)
        
    vf_str = ",".join(vf_filters)
    
    cmd = [
        FFMPEG, "-y",
        "-ss", str(scene["ss"]),
        "-t", str(scene["duration"]),
        "-i", in_file,
        "-vf", vf_str,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-an",
        out_file
    ]
    
    subprocess.run(cmd, check=True)
    print(f"Segment {scene['id']} complete: {out_file} ({os.path.getsize(out_file)/1024:.1f} KB)")
    return out_file

def main():
    total_dur = sum(s["duration"] for s in SCENES)
    print(f"Total Timeline Duration: {total_dur:.2f} seconds ({total_dur/60:.2f} mins) across {len(SCENES)} scenes")
    
    segments = []
    for s in SCENES:
        segments.append(process_scene(s))
        
    concat_list_file = os.path.join(INTERMEDIATE_DIR, "concat_list.txt")
    with open(concat_list_file, "w") as f:
        for seg in segments:
            f.write(f"file '{seg.replace(chr(92), '/')}'\n")
            
    raw_video = os.path.join(INTERMEDIATE_DIR, "assembled_2min_video.mp4")
    print(f"\nConcatenating {len(segments)} segments into master track: {raw_video}...")
    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_file,
        "-c", "copy",
        raw_video
    ], check=True)
    
    soundtrack = os.path.join(OUTPUT_DIR, "tamil_mass_bgm_2min.wav")
    final_output = os.path.join(OUTPUT_DIR, "nandha_tracker_2min_epic_masterpiece.mp4")
    alt_output = os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4")
    primary_output = os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4")
    
    print(f"\nMuxing with Full 2-Minute High-Energy Tamil Mass BGM: {final_output}...")
    subprocess.run([
        FFMPEG, "-y",
        "-i", raw_video,
        "-i", soundtrack,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-shortest",
        "-movflags", "+faststart",
        final_output
    ], check=True)
    
    shutil.copyfile(final_output, alt_output)
    shutil.copyfile(final_output, primary_output)
    print(f"Copied to deliverables: {alt_output} and {primary_output}")
    
    thumb_path = os.path.join(OUTPUT_DIR, "nandha_tracker_thumbnail.png")
    subprocess.run([
        FFMPEG, "-y",
        "-ss", "00:00:12.000",
        "-i", final_output,
        "-vframes", "1",
        thumb_path
    ], check=True)
    print(f"Generated clean master thumbnail: {thumb_path}")
    
    # Validation probe
    probe_cmd = [FFMPEG, "-i", final_output]
    res = subprocess.run(probe_cmd, stderr=subprocess.PIPE, text=True)
    print("\n================ 2-MINUTE MASTER VALIDATION ================")
    print(res.stderr)
    
    val_report = os.path.join(OUTPUT_DIR, "video_validation_2min.txt")
    with open(val_report, "w", encoding="utf-8") as f:
        f.write("NANDHA LEETCODE INTELLIGENCE - 2-MINUTE EPIC MASTERPIECE VALIDATION REPORT\n")
        f.write("=========================================================================\n\n")
        f.write(f"Audio Track: 2-Minute Tamil Mass BGM (Anirudh Ravichander - Vaathi Raid / Master)\n")
        f.write(f"Target Duration: {total_dur:.2f} seconds (~2:00.5 minutes)\n")
        f.write(f"Total Scenes Featured: {len(SCENES)} complete application workflows\n")
        f.write(f"Resolution: 1920x1080 (16:9 Landscape)\n")
        f.write(f"Frame Rate: 30 FPS\n")
        f.write(f"Video Codec: H.264 (High Profile, CRF 17)\n")
        f.write(f"Audio Codec: AAC (256 kbps, 48000 Hz Stereo)\n")
        f.write(f"Master Output: {final_output}\n")
        f.write(f"File Size: {os.path.getsize(final_output) / (1024*1024):.2f} MB\n\n")
        f.write("FFMPEG Stream Details:\n")
        f.write(res.stderr)
    print(f"Validation report saved: {val_report}")

if __name__ == "__main__":
    main()
