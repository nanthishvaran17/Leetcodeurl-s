import os
import subprocess
import shutil
import time

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
OUTPUT_DIR = os.path.abspath("output")
RAW_CLIPS_DIR = os.path.join(OUTPUT_DIR, "raw_clips_2min")
OVERLAYS_DIR = os.path.join(OUTPUT_DIR, "overlays_2026")
BRANDS_DIR = os.path.join(OUTPUT_DIR, "brand_scenes_2026")
SEGS_DIR = os.path.join(OUTPUT_DIR, "intermediate_showcase_2026")

os.makedirs(SEGS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 10 Professional Scenes for the 49.0s Master Film
# trans_dur = 0.25s crossfade between scenes
# For scenes 0-8, pad by 0.25s so crossfade does not steal scene time.
SCENE_SPECS = [
    # Scene 01: Institutional Brand Opening (3.0s)
    {
        "id": "01",
        "type": "image",
        "file": os.path.join(BRANDS_DIR, "scene_01_intro.png"),
        "target_dur": 3.0,
        "pad": 0.25,
        "fade_in": True
    },
    # Scene 02: Login Page (3.0s)
    {
        "id": "02",
        "type": "single_video",
        "file": os.path.join(RAW_CLIPS_DIR, "clip_02_login.webm"),
        "ss": 2.0,
        "target_dur": 3.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_02.png")
    },
    # Scene 03: Executive Dashboard (4.0s)
    {
        "id": "03",
        "type": "single_video",
        "file": os.path.join(RAW_CLIPS_DIR, "clip_03_dashboard.webm"),
        "ss": 4.0,
        "target_dur": 4.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_03.png")
    },
    # Scene 04: Student Directory & Individual Analytics (5.0s = 2.5s directory + 2.5s radar)
    {
        "id": "04",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_04_students.webm"),
        "ss_a": 4.0,
        "dur_a": 2.5,
        "file_b": os.path.join(RAW_CLIPS_DIR, "clip_05_profile.webm"),
        "ss_b": 7.0,
        "dur_b": 2.75, # 2.5s + 0.25s pad
        "target_dur": 5.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_04.png")
    },
    # Scene 05: Departments & Weekly Contest (5.0s = 2.5s institutional cohort + 2.5s weekly contest)
    {
        "id": "05",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_07_hod.webm"),
        "ss_a": 10.0,
        "dur_a": 2.5,
        "file_b": os.path.join(RAW_CLIPS_DIR, "clip_09_weekly_contest.webm"),
        "ss_b": 7.5,
        "dur_b": 2.75,
        "target_dur": 5.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_05.png")
    },
    # Scene 06: Integrity, Growth & Data Quality (6.0s = 3.0s integrity + 3.0s growth)
    {
        "id": "06",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_10_integrity.webm"),
        "ss_a": 7.5,
        "dur_a": 3.0,
        "file_b": os.path.join(RAW_CLIPS_DIR, "clip_11_growth.webm"),
        "ss_b": 13.0,
        "dur_b": 3.25,
        "target_dur": 6.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_06.png")
    },
    # Scene 07: Faculty, Mentorship & Recruitment (6.0s = 3.0s faculty + 3.0s hr finder)
    {
        "id": "07",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_15_faculty.webm"),
        "ss_a": 4.0,
        "dur_a": 3.0,
        "file_b": os.path.join(RAW_CLIPS_DIR, "clip_14_hr_finder.webm"),
        "ss_b": 9.0,
        "dur_b": 3.25,
        "target_dur": 6.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_07.png")
    },
    # Scene 08: AI, System Health & Audit (6.0s = 3.0s operations + 3.0s data quality)
    {
        "id": "08",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_16_ai_control.webm"),
        "ss_a": 3.5,
        "dur_a": 3.0,
        "file_b": os.path.join(RAW_CLIPS_DIR, "clip_12_quality.webm"),
        "ss_b": 7.0,
        "dur_b": 3.25,
        "target_dur": 6.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_08.png")
    },
    # Scene 09: Reports & Public Leaderboard (6.0s = 3.0s reports + 3.0s public auditorium kiosk)
    {
        "id": "09",
        "type": "dual_video",
        "file_a": os.path.join(RAW_CLIPS_DIR, "clip_19_reports.webm"),
        "ss_a": 3.5,
        "dur_a": 3.0,
        "file_b": os.path.join(BRANDS_DIR, "kiosk_public.png"),
        "ss_b": 0.0,
        "dur_b": 3.25,
        "target_dur": 6.0,
        "pad": 0.25,
        "caption": os.path.join(OVERLAYS_DIR, "caption_scene_09.png")
    },
    # Scene 10: Team Credits & Closing (5.0s, English only)
    {
        "id": "10",
        "type": "image",
        "file": os.path.join(BRANDS_DIR, "scene_10_closing_credits.png"),
        "target_dur": 5.0,
        "pad": 0.0,
        "fade_out": True
    }
]

def render_segment(spec):
    out_file = os.path.join(SEGS_DIR, f"seg_{spec['id']}.mp4")
    total_dur = spec["target_dur"] + spec["pad"]
    print(f"\n[BUILD SEGMENT {spec['id']}/10] Duration={total_dur}s...")

    if spec["type"] == "image":
        # Professional restrained camera push-in
        fade_chain = []
        if spec.get("fade_in"):
            fade_chain.append("fade=t=in:st=0:d=0.6")
        if spec.get("fade_out"):
            fade_chain.append(f"fade=t=out:st={total_dur - 0.8:.2f}:d=0.8")
        
        post_vf = ("," + ",".join(fade_chain)) if fade_chain else ""
        vf = (
            f"loop=loop={int(total_dur*30)}:size=1:start=0,"
            "scale=1920:1080,"
            "zoompan=z='min(zoom+0.0006,1.03)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,"
            f"format=yuv420p{post_vf}"
        )
        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-i", spec["file"],
            "-t", str(total_dur),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-an",
            out_file
        ]
        subprocess.run(cmd, check=True)
        print(f"Segment {spec['id']} Complete: {out_file}")
        return out_file

    elif spec["type"] == "single_video":
        # Natural website brightness & contrast, zero dark vignette
        vf_base = (
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,"
            "fps=30,"
            "eq=contrast=1.01:brightness=0.03:saturation=1.08,"
            "format=yuva420p"
        )
        filter_complex = f"[0:v]{vf_base}[base];[1:v]scale=1920:1080,format=yuva420p[ovl];[base][ovl]overlay=0:0:format=auto,format=yuv420p"
        
        cmd = [
            FFMPEG, "-y",
            "-ss", str(spec["ss"]),
            "-t", str(total_dur),
            "-i", spec["file"],
            "-i", spec["caption"],
            "-filter_complex", filter_complex,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-an",
            out_file
        ]
        subprocess.run(cmd, check=True)
        print(f"Segment {spec['id']} Complete: {out_file}")
        return out_file

    elif spec["type"] == "dual_video":
        # Connect sub-clip A and sub-clip B seamlessly
        sub_a = os.path.join(SEGS_DIR, f"sub_{spec['id']}_a.mp4")
        sub_b = os.path.join(SEGS_DIR, f"sub_{spec['id']}_b.mp4")
        
        vf_base = (
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,"
            "fps=30,"
            "eq=contrast=1.01:brightness=0.03:saturation=1.08,"
            "format=yuv420p"
        )
        # render sub A
        subprocess.run([
            FFMPEG, "-y",
            "-ss", str(spec["ss_a"]), "-t", str(spec["dur_a"]),
            "-i", spec["file_a"],
            "-vf", vf_base,
            "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-an",
            sub_a
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # render sub B
        if spec["file_b"].endswith((".png", ".jpg", ".jpeg")):
            subprocess.run([
                FFMPEG, "-y",
                "-loop", "1",
                "-i", spec["file_b"],
                "-t", str(spec["dur_b"]),
                "-vf", vf_base,
                "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-an",
                sub_b
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.run([
                FFMPEG, "-y",
                "-ss", str(spec["ss_b"]), "-t", str(spec["dur_b"]),
                "-i", spec["file_b"],
                "-vf", vf_base,
                "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-an",
                sub_b
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Concat A & B and overlay the unified module caption
        concat_txt = os.path.join(SEGS_DIR, f"concat_{spec['id']}.txt")
        with open(concat_txt, "w") as f:
            f.write(f"file '{sub_a.replace(chr(92), '/')}'\n")
            f.write(f"file '{sub_b.replace(chr(92), '/')}'\n")

        raw_joined = os.path.join(SEGS_DIR, f"raw_join_{spec['id']}.mp4")
        subprocess.run([
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_txt,
            "-c", "copy",
            raw_joined
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Apply caption overlay
        fc = "[0:v]format=yuva420p[base];[1:v]scale=1920:1080,format=yuva420p[ovl];[base][ovl]overlay=0:0:format=auto,format=yuv420p"
        subprocess.run([
            FFMPEG, "-y",
            "-i", raw_joined,
            "-i", spec["caption"],
            "-filter_complex", fc,
            "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-an",
            out_file
        ], check=True)
        print(f"Segment {spec['id']} Complete: {out_file}")
        return out_file

def get_exact_duration(filepath):
    cmd = [FFMPEG, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            part = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = part.split(":")
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 5.0

def assemble_master():
    print("\n[ASSEMBLY] Rendering all 10 Scenes for 2026 Master Film...")
    seg_paths = []
    for spec in SCENE_SPECS:
        seg_paths.append(render_segment(spec))

    durs = [get_exact_duration(p) for p in seg_paths]
    print("\n[SEGMENT DURATIONS]")
    for i, (p, d) in enumerate(zip(seg_paths, durs)):
        print(f"Scene {i+1:02d}: {d:.2f}s ({p})")

    trans_dur = 0.25 # subtle 0.25s cinematic dissolve between scenes
    cmd = [FFMPEG, "-y"]
    for sp in seg_paths:
        cmd.extend(["-i", sp])

    filter_parts = []
    running_len = durs[0]
    last_v = "0:v"

    for i in range(len(SCENE_SPECS) - 1):
        cur_offset = running_len - trans_dur
        running_len = cur_offset + durs[i + 1]
        out_v = f"v{i+1}"
        filter_parts.append(
            f"[{last_v}][{i+1}:v]xfade=transition=fade:duration={trans_dur:.2f}:offset={cur_offset:.2f}[{out_v}]"
        )
        last_v = out_v

    print(f"\n[TIMELINE] Total Master Film Duration: {running_len:.2f}s (~{running_len/60:.2f} mins)")
    final_v_filter = ";".join(filter_parts)
    
    # Primary Deliverable: nandha_leetcode_intelligence_showcase_2026.mp4
    # Audio Policy: COMPLETELY SILENT (-an, no audio stream)
    master_output = os.path.join(OUTPUT_DIR, "nandha_leetcode_intelligence_showcase_2026.mp4")

    cmd.extend([
        "-filter_complex", final_v_filter,
        "-map", f"[{last_v}]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "16",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an", # ABSOLUTELY NO AUDIO TRACK
        master_output
    ])

    print(f"\n[RENDER] Exporting Final Master: {master_output}...")
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(master_output) / (1024 * 1024)
    print(f"[COMPLETE] Master Showcase Film: {master_output} ({size_mb:.2f} MB)")

    # Also mirror to marketing deliverables for easy access
    shutil.copyfile(master_output, os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4"))
    shutil.copyfile(master_output, os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4"))
    return master_output, running_len

if __name__ == "__main__":
    t0 = time.time()
    out_video, total_time = assemble_master()
    print(f"\n[SUCCESS] 2026 Enterprise Film Assembled in {time.time() - t0:.1f}s")
    print(f"File: {out_video}")
    print(f"Duration: {total_time:.2f} seconds (Target: 45-50s)")
    print(f"Audio: Strictly None (Silent Master)")
    print(f"Language: 100% English Only")
