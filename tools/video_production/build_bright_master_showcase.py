import os
import subprocess
import shutil
import time
import json

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
OUTPUT_DIR = os.path.abspath("output")
CLIPS_DIR = os.path.join(OUTPUT_DIR, "raw_clips_2min")
OVERLAYS_DIR = os.path.join(OUTPUT_DIR, "overlays_2min")
BRIGHT_SEGS_DIR = os.path.join(OUTPUT_DIR, "intermediate_bright_segments")

os.makedirs(BRIGHT_SEGS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 23 Complete Scenes (Scene 23 is the Grand Faculty Advisor & Engineering Team Showcase)
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
    {"id": "23", "type": "team_credits", "target_dur": 6.0, "pad": 0.0, "trans": None}
]

def render_bright_segment(scene):
    out_seg = os.path.join(BRIGHT_SEGS_DIR, f"seg_{scene['id']}.mp4")
    total_dur = scene["target_dur"] + scene["pad"]
    
    if os.path.exists(out_seg) and os.path.getsize(out_seg) > 50000:
        print(f"[CACHE] Reusing Bright Segment {scene['id']}/23: {out_seg}")
        return out_seg
        
    if scene.get("type") == "team_credits":
        # Render high-impact animated Credits Slide (Dr. Prabhu, Nanthish S, Affan, Kavin)
        credits_img = os.path.join(OUTPUT_DIR, "brand_scenes", "scene_team_credits.png")
        print(f"[SEGMENT 23/23] Rendering Faculty & Team Credits Motion Climax ({total_dur}s)...")
        
        # Slow 3D push-in zoompan + subtle fade-out into black at end
        vf = (
            f"loop=loop={int(total_dur*30)}:size=1:start=0,"
            "scale=1920:1080,"
            "zoompan=z='min(zoom+0.0006,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,"
            "format=yuv420p,"
            f"fade=t=out:st={total_dur - 1.2:.2f}:d=1.2"
        )
        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-i", credits_img,
            "-t", str(total_dur),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-an",
            out_seg
        ]
        subprocess.run(cmd, check=True)
        print(f"[SEGMENT 23/23] Complete: {out_seg}")
        return out_seg

    # For UI scenes 01-22: BRIGHT, VIVID, ZERO-DARK-VIGNETTE
    in_video = os.path.join(CLIPS_DIR, scene["file"])
    in_overlay = os.path.join(OVERLAYS_DIR, f"overlay_{scene['id']}.png")
    
    # Notice: eq=contrast=1.02:brightness=0.05:saturation=1.12 lifts darks and gives punchy crisp brightness!
    base_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "fps=30",
        "eq=contrast=1.02:brightness=0.05:saturation=1.12",
        "format=yuva420p"
    ]
    base_chain = ",".join(base_filters)
    
    post_overlay = [",format=yuv420p"]
    if scene["id"] == "01":
        post_overlay.append(",fade=t=in:st=0:d=0.8")
        
    post_str = "".join(post_overlay)
    filter_complex = f"[0:v]{base_chain}[base];[1:v]scale=1920:1080,format=yuva420p[ovl];[base][ovl]overlay=0:0:format=auto{post_str}"
    
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
        "-pix_fmt", "yuv420p",
        "-an",
        out_seg
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[SEGMENT {scene['id']}/23] Bright Rendered: {out_seg} ({os.path.getsize(out_seg)/1024:.1f} KB)")
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

def build_bright_visual_track():
    print("\n[RENDER] Building 23 Bright & Vibrant UI Segments (No Dark Vignette)...")
    seg_paths = []
    for s in SCENES:
        seg_paths.append(render_bright_segment(s))
        
    durs = [get_exact_duration(p) for p in seg_paths]
    trans_dur = 0.35 # 0.35s cinematic transition
    
    print("\n[RENDER] Chaining 22 Beat-Synced Cinematic Transitions (xfade)...")
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
        
    print(f"[TIMELINE] Total Master Video Duration: {running_len:.2f} seconds ({running_len/60:.2f} mins)")
    final_v_filter = ";".join(filter_parts)
    visual_master = os.path.join(OUTPUT_DIR, "intermediate_bright_visual.mp4")
    
    cmd.extend([
        "-filter_complex", final_v_filter,
        "-map", f"[{last_v}]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "16",
        "-pix_fmt", "yuv420p",
        visual_master
    ])
    
    print(f"[RENDER] Rendering Visual Track to {visual_master}...")
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Visual Track Rendered: {visual_master} ({os.path.getsize(visual_master)/(1024*1024):.2f} MB)")
    return visual_master, running_len

def mux_final_master(visual_track):
    audio_master = os.path.join(OUTPUT_DIR, "cinematic_audio_master.wav")
    final_1080p = os.path.join(OUTPUT_DIR, "nandha_tracker_cinematic_master_1080p.mp4")
    
    print(f"\n[MUX] Muxing Bright Visual Master with Loud, Clean Tamil Mass BGM...")
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
    
    # Mirror files for compatibility
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_2min_epic_masterpiece.mp4"))
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4"))
    shutil.copyfile(final_1080p, os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4"))
    return final_1080p

def render_vertical_teaser(master_1080p):
    reels_9x16 = os.path.join(OUTPUT_DIR, "nandha_tracker_reels_9x16_teaser.mp4")
    print(f"\n[EXPORT] Rendering 45-Second Vertical 9:16 Teaser: {reels_9x16}...")
    
    vf_chain = (
        "split[main][bg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:5,eq=brightness=-0.12:contrast=1.05[blur_bg];"
        "[main]scale=1080:-1[fg];"
        "[blur_bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
        "[comp]drawtext=text='NANDHA LEETCODE INTELLIGENCE':fontfile='output/font.ttf':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=14:x=(w-text_w)/2:y=180,"
        "drawtext=text='563 MINDS • 19 LIVE ROUTES • AUTONOMOUS AI':fontfile='output/font.ttf':fontsize=20:fontcolor='#38bdf8':box=1:boxcolor=black@0.75:boxborderw=10:x=(w-text_w)/2:y=240,"
        "drawtext=text='DEPT OF CSE (CYBER SECURITY)':fontfile='output/font.ttf':fontsize=18:fontcolor='#fbbf24':box=1:boxcolor=black@0.75:boxborderw=10:x=(w-text_w)/2:y=h-220,"
        "format=yuv420p"
    )
    
    cmd = [
        FFMPEG, "-y",
        "-ss", "0.0",
        "-t", "45.0",
        "-i", master_1080p,
        "-filter_complex", vf_chain,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-movflags", "+faststart",
        reels_9x16
    ]
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Vertical Reels Teaser Rendered: {reels_9x16} ({os.path.getsize(reels_9x16)/(1024*1024):.2f} MB)")

def render_premium_4k(master_1080p):
    master_4k = os.path.join(OUTPUT_DIR, "nandha_tracker_cinematic_master_4k.mp4")
    print(f"\n[EXPORT] Rendering Premium 4K 60fps Master: {master_4k}...")
    
    vf = "scale=3840:2160:flags=lanczos,fps=60,format=yuv420p"
    cmd = [
        FFMPEG, "-y",
        "-i", master_1080p,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        master_4k
    ]
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Premium 4K 60fps Master Rendered: {master_4k} ({os.path.getsize(master_4k)/(1024*1024):.2f} MB)")

if __name__ == "__main__":
    t0 = time.time()
    v_track, final_dur = build_bright_visual_track()
    master = mux_final_master(v_track)
    render_vertical_teaser(master)
    render_premium_4k(master)
    print(f"\n[ALL EXPORTS COMPLETE] Total Pipeline Time: {time.time() - t0:.1f}s")
