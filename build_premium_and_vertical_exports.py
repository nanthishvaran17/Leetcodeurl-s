import subprocess
import os

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
OUTPUT_DIR = os.path.abspath("output")

MASTER_1080P = os.path.join(OUTPUT_DIR, "nandha_tracker_cinematic_master_1080p.mp4")
REELS_9X16 = os.path.join(OUTPUT_DIR, "nandha_tracker_reels_9x16_teaser.mp4")
MASTER_4K = os.path.join(OUTPUT_DIR, "nandha_tracker_cinematic_master_4k.mp4")

def render_vertical_teaser():
    print(f"\n[EXPORT] Rendering 45-Second Vertical 9:16 Teaser for Reels/Shorts: {REELS_9X16}...")
    
    # 45-second high-octane cut:
    # 0:00 - 0:45 of the cinematic master video (captures intro riser, 808 drop, Command Center, Radar 360, Versus Arena, Integrity Glitch)
    # Filter: 1080x1920 vertical canvas, blurred backdrop + floating 16:9 cinematic frame with drop shadow + cyber badges!
    vf_chain = (
        "split[main][bg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:5,eq=brightness=-0.18:contrast=1.1[blur_bg];"
        "[main]scale=1080:-1[fg];"
        "[blur_bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
        "[comp]drawtext=text='NANDHA LEETCODE INTELLIGENCE':fontfile='output/font.ttf':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=14:x=(w-text_w)/2:y=180,"
        "drawtext=text='563 MINDS • 19 LIVE ROUTES • AUTONOMOUS AI':fontfile='output/font.ttf':fontsize=20:fontcolor='#38bdf8':box=1:boxcolor=black@0.75:boxborderw=10:x=(w-text_w)/2:y=240,"
        "drawtext=text='CAMPUS CODING ANALYTICS // ERODE':fontfile='output/font.ttf':fontsize=18:fontcolor='#fbbf24':box=1:boxcolor=black@0.75:boxborderw=10:x=(w-text_w)/2:y=h-220,"
        "format=yuv420p"
    )
    
    cmd = [
        FFMPEG, "-y",
        "-ss", "0.0",
        "-t", "45.0",
        "-i", MASTER_1080P,
        "-filter_complex", vf_chain,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-movflags", "+faststart",
        REELS_9X16
    ]
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Vertical Reels Teaser Rendered: {REELS_9X16} ({os.path.getsize(REELS_9X16)/(1024*1024):.2f} MB)")

def render_premium_4k():
    print(f"\n[EXPORT] Rendering Premium 4K 60fps Master (3840x2160): {MASTER_4K}...")
    
    vf = "scale=3840:2160:flags=lanczos,fps=60,format=yuv420p"
    
    cmd = [
        FFMPEG, "-y",
        "-i", MASTER_1080P,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        MASTER_4K
    ]
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Premium 4K 60fps Master Rendered: {MASTER_4K} ({os.path.getsize(MASTER_4K)/(1024*1024):.2f} MB)")

if __name__ == "__main__":
    render_vertical_teaser()
    render_premium_4k()
