import os
import subprocess

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
SRC_AUDIO = r"E:\Music\Master_-_Vaathi_Raid_Lyric___Thalapathy_Vijay___Anirudh_Ravichander___Lokesh_Kanagaraj(256k).mp3"
DST_AUDIO = os.path.abspath("output/tamil_mass_bgm.wav")

def extract_tamil_bgm():
    print(f"Mastering Tamil Mass BGM from {SRC_AUDIO}...")
    cmd = [
        FFMPEG, "-y",
        "-ss", "20.0",
        "-t", "57.0",
        "-i", SRC_AUDIO,
        "-af", "afade=t=in:ss=0:d=0.8,afade=t=out:st=55.0:d=2.0,loudnorm=I=-14:TP=-1.0:LRA=10",
        "-ar", "48000",
        "-ac", "2",
        DST_AUDIO
    ]
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(DST_AUDIO) / (1024 * 1024)
    print(f"Extracted high-energy 57s Tamil BGM: {DST_AUDIO} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    extract_tamil_bgm()
