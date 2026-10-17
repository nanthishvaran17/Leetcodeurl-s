import os
import subprocess
import shutil

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
CLIPS_DIR = os.path.abspath("output/raw_clips")
INTERMEDIATE_DIR = os.path.abspath("output/intermediate_clips_v2")
OUTPUT_DIR = os.path.abspath("output")

os.makedirs(INTERMEDIATE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 15 Scenes Configuration (Sum = 57.00 seconds)
SCENES = [
    {
        "id": "01",
        "file": "clip_01_intro.webm",
        "ss": 0.0,
        "duration": 3.5,
        "hud": "SYSTEM INITIALIZATION // NANDHA INSTITUTIONAL INTELLIGENCE",
        "subtitle": "Nandha LeetCode Intelligence — Smarter Institutional Tracking",
        "fade_in": True
    },
    {
        "id": "02",
        "file": "clip_02_login.webm",
        "ss": 1.5,
        "duration": 3.5,
        "hud": "SECURE ACCESS // ZERO-TRUST AUTHENTICATION",
        "subtitle": "Enterprise SSO & Real-Time Security — 563 Enrolled Cohorts"
    },
    {
        "id": "03",
        "file": "clip_03_dashboard.webm",
        "ss": 2.0,
        "duration": 4.0,
        "hud": "EXECUTIVE COMMAND // COHORT PERFORMANCE TELEMETRY",
        "subtitle": "Unified Executive Deck — Real-Time Trajectory & Key Metric Cards"
    },
    {
        "id": "04",
        "file": "clip_04_students.webm",
        "ss": 2.5,
        "duration": 4.0,
        "hud": "MASTER DIRECTORY // 563 VERIFIED LEETCODE ENROLLMENTS",
        "subtitle": "Master Student Directory — Real LeetCode Ranks & Verified Solve Counts"
    },
    {
        "id": "05",
        "file": "clip_05_profile.webm",
        "ss": 4.0,
        "duration": 4.0,
        "hud": "STUDENT PROFILE DOSSIER // DSA RADAR & EVIDENCE AUDIT",
        "subtitle": "Individual Student Dossier — 6-Axis DSA Skill Radar & Contest History"
    },
    {
        "id": "06",
        "file": "clip_new_departments.webm",
        "ss": 2.0,
        "duration": 3.5,
        "hud": "DEPARTMENT INTELLIGENCE // CROSS-BRANCH BENCHMARKING",
        "subtitle": "Department Analytics — Inter-Branch Participation & Milestone Benchmarks"
    },
    {
        "id": "07",
        "file": "clip_new_compare.webm",
        "ss": 2.0,
        "duration": 3.5,
        "hud": "HEAD-TO-HEAD BATTLE // ALGORITHM DUEL MATRIX",
        "subtitle": "Student Comparison Tool — Direct Head-to-Head DSA Skill Matchups"
    },
    {
        "id": "08",
        "file": "clip_06_weekly_contest.webm",
        "ss": 2.5,
        "duration": 4.0,
        "hud": "WEEKLY CONTEST 523 // LIVE ATTENDANCE RECONCILIATION",
        "subtitle": "Weekly Contest Tracker — Instant Attendance Reconciliation & Q1–Q4 Telemetry"
    },
    {
        "id": "09",
        "file": "clip_new_integrity.webm",
        "ss": 2.0,
        "duration": 3.5,
        "hud": "CONTEST INTEGRITY // FORENSIC DUAL-ID AUDIT ENGINE",
        "subtitle": "Contest Integrity Monitor — Forensic Dual-ID Conflict Detection & Fraud Prevention"
    },
    {
        "id": "10",
        "file": "clip_07_growth.webm",
        "ss": 3.0,
        "duration": 4.0,
        "hud": "GROWTH ENGINE // VELOCITY & DELTA TRACKING",
        "subtitle": "Growth & Delta Intelligence — Verified Improvement & Problem Difficulty Breakdown"
    },
    {
        "id": "11",
        "file": "clip_new_hr_finder.webm",
        "ss": 2.0,
        "duration": 3.5,
        "hud": "PLACEMENT SUITE // TIER-1 HR CANDIDATE FINDER",
        "subtitle": "Placement Talent Portal — Multi-Filter Shortlisting for Top Campus Recruiters"
    },
    {
        "id": "12",
        "file": "clip_08_reports.webm",
        "ss": 2.5,
        "duration": 3.5,
        "hud": "REPORTS CENTER // AUDIT-READY EXCEL & PDF EXPORTERS",
        "subtitle": "Universal Reports Hub — Formatted Excel Workbooks & Executive PDF Summaries"
    },
    {
        "id": "13",
        "file": "clip_09_faculty.webm",
        "ss": 2.5,
        "duration": 4.0,
        "hud": "FACULTY ACTION // REAL-TIME MENTORSHIP TRIAGE QUEUE",
        "subtitle": "Faculty Action Center — Prioritized Mentoring Queue & Timely Interventions"
    },
    {
        "id": "14",
        "file": "clip_10_ai_control.webm",
        "ss": 2.5,
        "duration": 3.5,
        "hud": "24/7 AUTOMATION // AUTONOMOUS AI SYSTEM MATRIX",
        "subtitle": "Autonomous AI Matrix — 24/7 Live Monitoring & Automated Weekly Sync Engine"
    },
    {
        "id": "15",
        "file": "clip_11_outro.webm",
        "ss": 0.0,
        "duration": 4.5,
        "hud": "NANDHA EDUCATIONAL TRUST // INSTITUTIONAL EXCELLENCE",
        "subtitle": "Code. Compete. Improve. — Nandha LeetCode Intelligence",
        "fade_out": True
    }
]

def escape_drawtext(text):
    return text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('"', '\\"').replace('%', '\\%')

def process_scene(scene):
    in_file = os.path.join(CLIPS_DIR, scene["file"])
    out_file = os.path.join(INTERMEDIATE_DIR, f"seg_{scene['id']}.ts")
    
    print(f"\nRendering Scene {scene['id']}: {scene['file']} ({scene['duration']}s)...")
    
    font_path = "output/font.ttf"
    
    # Visual effects: High-contrast color grade, pad/scale, 30fps
    vf_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "fps=30",
        "eq=contrast=1.05:brightness=0.01:saturation=1.12",
        "format=yuv420p"
    ]
    
    if scene.get("fade_in"):
        vf_filters.append("fade=t=in:st=0:d=0.8")
    if scene.get("fade_out"):
        dur = scene["duration"]
        vf_filters.append(f"fade=t=out:st={dur - 0.8:.2f}:d=0.8")
        
    # Top-Left Futuristic HUD Module Badge
    hud = scene.get("hud", "").strip()
    if hud:
        esc_hud = escape_drawtext(hud)
        hud_filter = (
            f"drawtext=text='{esc_hud}':"
            f"fontfile='{font_path}':"
            f"fontsize=18:"
            f"fontcolor=0x38BDF8:"  # Cyan accent color
            f"box=1:boxcolor=0x0F172A@0.85:boxborderw=10:"
            f"x=45:y=40"
        )
        vf_filters.append(hud_filter)
        
    # Lower-Third Kinetic Subtitle Pill
    sub = scene.get("subtitle", "").strip()
    if sub:
        esc_sub = escape_drawtext(sub)
        sub_filter = (
            f"drawtext=text='{esc_sub}':"
            f"fontfile='{font_path}':"
            f"fontsize=31:"
            f"fontcolor=white:"
            f"box=1:boxcolor=black@0.84:boxborderw=18:"
            f"x=(w-text_w)/2:y=h-110"
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
    print(f"Total Master Timeline Duration: {total_dur:.2f} seconds across {len(SCENES)} scenes")
    
    segments = []
    for s in SCENES:
        segments.append(process_scene(s))
        
    concat_list_file = os.path.join(INTERMEDIATE_DIR, "concat_list.txt")
    with open(concat_list_file, "w") as f:
        for seg in segments:
            f.write(f"file '{seg.replace(chr(92), '/')}'\n")
            
    raw_video = os.path.join(INTERMEDIATE_DIR, "assembled_master_video.mp4")
    print(f"\nConcatenating {len(segments)} scenes into master track: {raw_video}...")
    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_file,
        "-c", "copy",
        raw_video
    ], check=True)
    
    # Tamil Mass BGM
    soundtrack = os.path.join(OUTPUT_DIR, "tamil_mass_bgm.wav")
    final_output = os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4")
    alt_output = os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4")
    
    print(f"\nMuxing with High-Energy Tamil Mass BGM: {final_output}...")
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
    print(f"Copied to deliverable: {alt_output}")
    
    # Refresh thumbnail
    thumb_path = os.path.join(OUTPUT_DIR, "nandha_tracker_thumbnail.png")
    subprocess.run([
        FFMPEG, "-y",
        "-ss", "00:00:10.000",
        "-i", final_output,
        "-vframes", "1",
        thumb_path
    ], check=True)
    print(f"Generated master thumbnail: {thumb_path}")
    
    # Validation probe
    probe_cmd = [FFMPEG, "-i", final_output]
    res = subprocess.run(probe_cmd, stderr=subprocess.PIPE, text=True)
    print("\n================ MASTER PROBE VALIDATION ================")
    print(res.stderr)
    
    val_report = os.path.join(OUTPUT_DIR, "video_validation.txt")
    with open(val_report, "w", encoding="utf-8") as f:
        f.write("NANDHA LEETCODE INTELLIGENCE - WORLD-CLASS REMASTER VALIDATION REPORT\n")
        f.write("======================================================================\n\n")
        f.write(f"Audio Track: Tamil Mass BGM (Anirudh Ravichander - Vaathi Raid / Master)\n")
        f.write(f"Target Duration: {total_dur:.2f} seconds\n")
        f.write(f"Total Scenes Featured: {len(SCENES)} distinct application workflows\n")
        f.write(f"Resolution: 1920x1080 (16:9 Landscape)\n")
        f.write(f"Frame Rate: 30 FPS\n")
        f.write(f"Video Codec: H.264 (High Profile, CRF 17)\n")
        f.write(f"Audio Codec: AAC (256 kbps, 48000 Hz Stereo)\n")
        f.write(f"Primary Output: {final_output}\n")
        f.write(f"Deliverable Output: {alt_output}\n")
        f.write(f"File Size: {os.path.getsize(final_output) / (1024*1024):.2f} MB\n\n")
        f.write("FFMPEG Stream Details:\n")
        f.write(res.stderr)
    print(f"Validation report saved: {val_report}")

if __name__ == "__main__":
    main()
