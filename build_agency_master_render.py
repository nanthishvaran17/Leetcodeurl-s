import os
import subprocess
import shutil
import time

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
CLIPS_DIR = os.path.abspath("output/raw_clips_2min")
OVERLAYS_DIR = os.path.abspath("output/overlays_2min")
SEGMENTS_DIR = os.path.abspath("output/intermediate_agency_segments")
OUTPUT_DIR = os.path.abspath("output")

os.makedirs(SEGMENTS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 23 Precise Application Scenes
# Note: Duration for clips 0-21 has +0.4s padding for seamless 0.4s xfade transitions.
SCENES = [
    {"id": "01", "file": "clip_01_intro.webm", "ss": 0.0, "target_dur": 4.5, "pad": 0.4, "trans": "slideleft"},
    {"id": "02", "file": "clip_02_login.webm", "ss": 2.0, "target_dur": 4.5, "pad": 0.4, "trans": "zoomin"},
    {"id": "03", "file": "clip_03_dashboard.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "smoothleft"},
    {"id": "04", "file": "clip_04_students.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "fadewhite"},
    {"id": "05", "file": "clip_05_profile.webm", "ss": 7.0, "target_dur": 5.5, "pad": 0.4, "trans": "pixelize"},
    {"id": "06", "file": "clip_06_departments.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "wipeleft"},
    {"id": "07", "file": "clip_07_hod.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "squeezev"},
    {"id": "08", "file": "clip_08_compare.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "circleopen"},
    {"id": "09", "file": "clip_09_weekly_contest.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "diagtr"},
    {"id": "10", "file": "clip_10_integrity.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "hblur"},
    {"id": "11", "file": "clip_11_growth.webm", "ss": 5.0, "target_dur": 5.0, "pad": 0.4, "trans": "radial"},
    {"id": "12", "file": "clip_12_quality.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "fadeblack"},
    {"id": "13", "file": "clip_13_post930.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "vertopen"},
    {"id": "14", "file": "clip_14_hr_finder.webm", "ss": 9.0, "target_dur": 5.5, "pad": 0.4, "trans": "smoothright"},
    {"id": "15", "file": "clip_15_faculty.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "pixelize"},
    {"id": "16", "file": "clip_16_ai_control.webm", "ss": 3.5, "target_dur": 5.0, "pad": 0.4, "trans": "horzopen"},
    {"id": "17", "file": "clip_17_system_health.webm", "ss": 3.5, "target_dur": 5.0, "pad": 0.4, "trans": "coverleft"},
    {"id": "18", "file": "clip_18_audit.webm", "ss": 3.5, "target_dur": 5.0, "pad": 0.4, "trans": "dissolve"},
    {"id": "19", "file": "clip_19_reports.webm", "ss": 3.5, "target_dur": 5.0, "pad": 0.4, "trans": "hlwind"},
    {"id": "20", "file": "clip_20_data_issues.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "squeezeh"},
    {"id": "21", "file": "clip_21_settings.webm", "ss": 4.0, "target_dur": 5.0, "pad": 0.4, "trans": "zoomin"},
    {"id": "22", "file": "clip_22_public.webm", "ss": 4.0, "target_dur": 5.5, "pad": 0.4, "trans": "fadewhite"},
    {"id": "23", "file": "clip_23_outro.webm", "ss": 0.0, "target_dur": 5.0, "pad": 0.0, "trans": None}
]

def render_segment(scene):
    in_video = os.path.join(CLIPS_DIR, scene["file"])
    in_overlay = os.path.join(OVERLAYS_DIR, f"overlay_{scene['id']}.png")
    out_seg = os.path.join(SEGMENTS_DIR, f"seg_{scene['id']}.mp4")
    
    total_dur = scene["target_dur"] + scene["pad"]
    
    base_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "fps=30",
        "eq=contrast=1.08:brightness=0.01:saturation=1.16",
        "vignette=PI/4",
        "format=yuva420p"
    ]
    base_chain = ",".join(base_filters)
    
    post_overlay = [",format=yuv420p"]
    if scene["id"] == "01":
        post_overlay.append(",fade=t=in:st=0:d=0.8")
    if scene["id"] == "23":
        post_overlay.append(f",fade=t=out:st={total_dur - 1.0:.2f}:d=1.0")
        
    post_str = "".join(post_overlay)
    filter_complex = f"[0:v]{base_chain}[base];[1:v]scale=1920:1080,format=yuva420p[ovl];[base][ovl]overlay=0:0:format=auto{post_str}"
    
    if os.path.exists(out_seg) and os.path.getsize(out_seg) > 50000:
        print(f"[CACHE] Reusing Segment {scene['id']}/23: {out_seg} ({os.path.getsize(out_seg)/1024:.1f} KB)")
        return out_seg
        
    cmd = [
        FFMPEG, "-y",
        "-ss", str(scene["ss"]),
        "-t", str(total_dur),
        "-i", in_video,
        "-i", in_overlay,
        "-filter_complex", filter_complex,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "16",
        "-an",
        out_seg
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[SEGMENT {scene['id']}/23] Rendered: {out_seg} ({os.path.getsize(out_seg)/1024:.1f} KB)")
    return out_seg

def get_exact_duration(filepath):
    cmd = [FFMPEG, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            part = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = part.split(":")
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 5.0

def build_visual_track():
    print("[RENDER] Pre-rendering 23 Graded UI Segments with Cyber Overlays...")
    seg_paths = []
    for s in SCENES:
        seg_paths.append(render_segment(s))
        
    durs = [get_exact_duration(p) for p in seg_paths]
    trans_dur = 0.35 # crisp 0.35s cinematic transition
    
    print("\n[RENDER] Building 22-Scene Beat-Synced Cinematic Transition Graph (xfade)...")
    
    cmd = [FFMPEG, "-y"]
    for sp in seg_paths:
        cmd.extend(["-i", sp])
        
    filter_parts = []
    running_len = durs[0]
    last_v = "0:v"
    
    for i in range(len(SCENES) - 1):
        s = SCENES[i]
        trans = s["trans"]
        cur_offset = running_len - trans_dur
        running_len = cur_offset + durs[i + 1]
        out_v = f"v{i+1}"
        filter_parts.append(
            f"[{last_v}][{i+1}:v]xfade=transition={trans}:duration={trans_dur:.2f}:offset={cur_offset:.2f}[{out_v}]"
        )
        last_v = out_v
        
    print(f"[TIMELINE] Computed Total Output Video Duration: {running_len:.2f} seconds ({running_len/60:.2f} mins)")
    final_v_filter = ";".join(filter_parts)
    visual_master = os.path.join(OUTPUT_DIR, "intermediate_agency_visual.mp4")
    
    cmd.extend([
        "-filter_complex", final_v_filter,
        "-map", f"[{last_v}]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "16",
        visual_master
    ])
    
    print(f"[RENDER] Executing xfade master render: {visual_master}...")
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Visual Track Rendered: {visual_master} ({os.path.getsize(visual_master)/(1024*1024):.2f} MB)")
    return visual_master

def mux_final_master(visual_track):
    audio_master = os.path.join(OUTPUT_DIR, "cinematic_audio_master.wav")
    final_1080p = os.path.join(OUTPUT_DIR, "nandha_tracker_cinematic_master_1080p.mp4")
    
    print(f"\n[MUX] Muxing 1080p Visual Master with -14 LUFS Tamil Mass Audio Track...")
    cmd = [
        FFMPEG, "-y",
        "-i", visual_track,
        "-i", audio_master,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-shortest",
        "-movflags", "+faststart",
        final_1080p
    ]
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(final_1080p) / (1024 * 1024)
    print(f"[MASTER 1080P COMPLETE] {final_1080p} ({size_mb:.2f} MB)")
    
    # Mirror to alternative deliverable names for backwards compatibility
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_2min_epic_masterpiece.mp4"))
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4"))
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4"))
    return final_1080p

if __name__ == "__main__":
    t0 = time.time()
    v_track = build_visual_track()
    final_vid = mux_final_master(v_track)
    print(f"[TOTAL PIPELINE TIME] {time.time() - t0:.1f} seconds")
