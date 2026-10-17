import os
import subprocess

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
SRC_AUDIO = r"E:\Music\Master_-_Vaathi_Raid_Lyric___Thalapathy_Vijay___Anirudh_Ravichander___Lokesh_Kanagaraj(256k).mp3"
DST_AUDIO = os.path.abspath("output/tamil_mass_bgm_2min.wav")

def extract_2min_bgm():
    print(f"Mastering 2-Minute High-Energy Tamil Mass BGM from {SRC_AUDIO}...")
    cmd = [
        FFMPEG, "-y",
        "-ss", "16.0",
        "-t", "120.5",
        "-i", SRC_AUDIO,
        "-af", "afade=t=in:ss=0:d=1.2,afade=t=out:st=117.5:d=3.0,loudnorm=I=-14:TP=-1.0:LRA=10",
        "-ar", "48000",
        "-ac", "2",
        DST_AUDIO
    ]
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(DST_AUDIO) / (1024 * 1024)
    print(f"✅ Generated 120.5s High-Energy Master BGM: {DST_AUDIO} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    extract_2min_bgm()
