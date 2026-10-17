import os
import subprocess
import json
import shutil

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
CLIPS_DIR = os.path.abspath("output/raw_clips")
INTERMEDIATE_DIR = os.path.abspath("output/intermediate_clips")
OUTPUT_DIR = os.path.abspath("output")

os.makedirs(INTERMEDIATE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 11 Scenes configuration with exact timestamps and durations (Sum = 57.00s)
SCENES = [
    {
        "id": "01",
        "name": "clip_01_intro",
        "ss": 0.0,
        "duration": 4.0,
        "fade_in": True,
        "subtitle": ""  # Visual title card
    },
    {
        "id": "02",
        "name": "clip_02_login",
        "ss": 1.5,
        "duration": 5.0,
        "subtitle": "Introducing Nandha LeetCode Intelligence — smarter institutional coding progress tracking."
    },
    {
        "id": "03",
        "name": "clip_03_dashboard",
        "ss": 2.0,
        "duration": 6.0,
        "subtitle": "One unified platform to monitor coding activity and student performance."
    },
    {
        "id": "04",
        "name": "clip_04_students",
        "ss": 2.5,
        "duration": 6.0,
        "subtitle": "Manage student profiles and explore coding progress across the institution."
    },
    {
        "id": "05",
        "name": "clip_05_profile",
        "ss": 4.0,
        "duration": 6.0,
        "subtitle": "Discover top performers and celebrate competitive programming achievements."
    },
    {
        "id": "06",
        "name": "clip_06_weekly_contest",
        "ss": 2.5,
        "duration": 6.0,
        "subtitle": "Track weekly contest participation with evidence-based attendance verification."
    },
    {
        "id": "07",
        "name": "clip_07_growth",
        "ss": 3.0,
        "duration": 6.0,
        "subtitle": "Measure verified progress and identify meaningful student improvements."
    },
    {
        "id": "08",
        "name": "clip_08_reports",
        "ss": 2.5,
        "duration": 5.0,
        "subtitle": "Turn reliable performance data into actionable insights and reports."
    },
    {
        "id": "09",
        "name": "clip_09_faculty",
        "ss": 2.5,
        "duration": 5.0,
        "subtitle": "Support student development with timely insights and focused mentorship."
    },
    {
        "id": "10",
        "name": "clip_10_ai_control",
        "ss": 2.5,
        "duration": 4.5,
        "subtitle": "Explore intelligent assistance and connected academic workflows."
    },
    {
        "id": "11",
        "name": "clip_11_outro",
        "ss": 0.0,
        "duration": 3.5,
        "fade_out": True,
        "subtitle": "Code. Compete. Improve. Nandha LeetCode Intelligence."
    }
]

def escape_drawtext(text):
    # Escape special characters for ffmpeg drawtext filter
    return text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('"', '\\"').replace('%', '\\%')

def process_scene(scene):
    in_file = os.path.join(CLIPS_DIR, f"{scene['name']}.webm")
    out_file = os.path.join(INTERMEDIATE_DIR, f"seg_{scene['id']}.ts")
    
    print(f"\nProcessing Scene {scene['id']}: {scene['name']} (duration: {scene['duration']}s)...")
    
    vf_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "fps=30",
        "format=yuv420p"
    ]
    
    if scene.get("fade_in"):
        vf_filters.append("fade=t=in:st=0:d=0.8")
    if scene.get("fade_out"):
        dur = scene["duration"]
        vf_filters.append(f"fade=t=out:st={dur - 0.8:.2f}:d=0.8")
        
    sub = scene.get("subtitle", "").strip()
    if sub:
        esc_text = escape_drawtext(sub)
        # Professional enterprise lower-third subtitle styling with modern Segoe UI bold
        font_path = "output/font.ttf"
        drawtext_filter = (
            f"drawtext=text='{esc_text}':"
            f"fontfile='{font_path}':"
            f"fontsize=32:"
            f"fontcolor=white:"
            f"box=1:boxcolor=black@0.78:boxborderw=18:"
            f"x=(w-text_w)/2:y=h-110"
        )
        vf_filters.append(drawtext_filter)
        
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
    print(f"Segment {scene['id']} rendered: {out_file} ({os.path.getsize(out_file)/1024:.1f} KB)")
    return out_file

def main():
    total_dur = sum(s["duration"] for s in SCENES)
    print(f"Total configured timeline duration: {total_dur:.2f} seconds")
    
    segments = []
    for s in SCENES:
        segments.append(process_scene(s))
        
    # Create concat file
    concat_list_file = os.path.join(INTERMEDIATE_DIR, "concat_list.txt")
    with open(concat_list_file, "w") as f:
        for seg in segments:
            f.write(f"file '{seg.replace(chr(92), '/')}'\n")
            
    raw_video = os.path.join(INTERMEDIATE_DIR, "assembled_video.mp4")
    print(f"\nConcatenating segments into {raw_video}...")
    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_file,
        "-c", "copy",
        raw_video
    ], check=True)
    
    # Final mux with audio soundtrack
    soundtrack = os.path.join(OUTPUT_DIR, "soundtrack.wav")
    final_output = os.path.join(OUTPUT_DIR, "nandha_tracker_worldclass_marketing.mp4")
    alt_output = os.path.join(OUTPUT_DIR, "nandha_tracker_marketing.mp4")
    
    print(f"\nMuxing final video with ambient soundtrack: {final_output}...")
    subprocess.run([
        FFMPEG, "-y",
        "-i", raw_video,
        "-i", soundtrack,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-shortest",
        "-movflags", "+faststart",
        final_output
    ], check=True)
    
    # Copy to alt path required in prompt
    shutil.copyfile(final_output, alt_output)
    print(f"[OK] Copied to primary deliverable: {alt_output}")
    
    # Extract premium thumbnail from dashboard showcase (second 11.5)
    thumb_path = os.path.join(OUTPUT_DIR, "nandha_tracker_thumbnail.png")
    subprocess.run([
        FFMPEG, "-y",
        "-ss", "00:00:11.500",
        "-i", final_output,
        "-vframes", "1",
        thumb_path
    ], check=True)
    print(f"[OK] Generated thumbnail: {thumb_path}")
    
    # Run ffprobe validation
    probe_cmd = [
        FFMPEG, "-i", final_output
    ]
    res = subprocess.run(probe_cmd, stderr=subprocess.PIPE, text=True)
    print("\n================ FINAL VALIDATION ================")
    print(res.stderr)
    
    val_report = os.path.join(OUTPUT_DIR, "video_validation.txt")
    with open(val_report, "w", encoding="utf-8") as f:
        f.write("NANDHA LEETCODE INTELLIGENCE - VIDEO VALIDATION REPORT\n")
        f.write("=====================================================\n\n")
        f.write(f"Target Duration: 57.0 seconds\n")
        f.write(f"Resolution: 1920x1080 (16:9 Landscape)\n")
        f.write(f"Frame Rate: 30 FPS\n")
        f.write(f"Video Codec: H.264 (High Profile)\n")
        f.write(f"Audio Codec: AAC (192 kbps, 48000 Hz Stereo)\n")
        f.write(f"Primary Output: {final_output}\n")
        f.write(f"Deliverable Output: {alt_output}\n")
        f.write(f"File Size: {os.path.getsize(final_output) / (1024*1024):.2f} MB\n\n")
        f.write("FFMPEG Stream Details:\n")
        f.write(res.stderr)
    print(f"[OK] Validation written to {val_report}")

if __name__ == "__main__":
    main()
