import os
import subprocess
import wave
import struct
import numpy as np

FFMPEG = r"C:\Users\Nanth\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
OUTPUT_DIR = os.path.abspath("output")
SFX_TRACK_WAV = os.path.join(OUTPUT_DIR, "cinematic_sfx_track.wav")
MUSIC_BED_WAV = os.path.join(OUTPUT_DIR, "tamil_mass_bgm_2min.wav")
FINAL_MIX_WAV = os.path.join(OUTPUT_DIR, "cinematic_audio_master.wav")

SAMPLE_RATE = 48000
TOTAL_DUR = 120.0 # 2 minutes exact buffer
TOTAL_SAMPLES = int(SAMPLE_RATE * TOTAL_DUR)

def synthesize_sfx():
    print(f"[AUDIO] Synthesizing Hollywood/Tamil-Mass Cinematic SFX Bed ({TOTAL_DUR}s @ 48kHz)...")
    left_channel = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    right_channel = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    
    def add_sound(sound_l, sound_r, start_sec, gain=1.0):
        start_idx = int(start_sec * SAMPLE_RATE)
        if start_idx >= TOTAL_SAMPLES:
            return
        end_idx = min(start_idx + len(sound_l), TOTAL_SAMPLES)
        length = end_idx - start_idx
        left_channel[start_idx:end_idx] += sound_l[:length] * gain
        right_channel[start_idx:end_idx] += sound_r[:length] * gain

    # 1. Sub-Bass Riser (0.0s -> 8.95s)
    riser_dur = 8.95
    t_r = np.linspace(0, riser_dur, int(SAMPLE_RATE * riser_dur), False)
    # Exponential frequency sweep from 35 Hz to 520 Hz
    freqs = 35.0 * (520.0 / 35.0) ** (t_r / riser_dur)
    phase = 2 * np.pi * np.cumsum(freqs) / SAMPLE_RATE
    sine_sweep = np.sin(phase)
    # Rising amplitude envelope
    env = (t_r / riser_dur) ** 2.2
    # Sweeping filtered noise layer
    noise = np.random.normal(0, 0.25, len(t_r))
    noise_env = (t_r / riser_dur) ** 2.8
    riser_l = (sine_sweep * env * 0.7 + noise * noise_env * 0.3)
    riser_r = (sine_sweep * env * 0.7 + np.roll(noise, 240) * noise_env * 0.3)
    add_sound(riser_l, riser_r, 0.0, gain=0.85)

    # 2. Massive 808 Sub Drop (at 9.0s)
    drop_dur = 3.2
    t_d = np.linspace(0, drop_dur, int(SAMPLE_RATE * drop_dur), False)
    # Pitch drop from 75 Hz to 28 Hz
    drop_freq = 28.0 + 47.0 * np.exp(-t_d * 3.5)
    drop_phase = 2 * np.pi * np.cumsum(drop_freq) / SAMPLE_RATE
    sub_drop = np.sin(drop_phase) * np.exp(-t_d * 1.1)
    # Soft saturation
    sub_drop = np.tanh(sub_drop * 1.8) * 0.95
    # Transient thump
    thump = np.sin(2 * np.pi * 120.0 * t_d[:int(SAMPLE_RATE * 0.12)]) * np.exp(-t_d[:int(SAMPLE_RATE * 0.12)] * 35.0)
    drop_out_l = np.copy(sub_drop)
    drop_out_l[:len(thump)] += thump * 0.8
    drop_out_r = np.copy(drop_out_l)
    add_sound(drop_out_l, drop_out_r, 9.0, gain=1.2)

    # 3. Transition Whoosh Generator
    def create_whoosh(duration=0.55):
        t_w = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
        noise = np.random.normal(0, 0.4, len(t_w))
        # Smooth Hann-like window
        window = np.sin(np.pi * t_w / duration) ** 2.0
        # Gentle stereo pan sweep
        pan_l = np.linspace(0.8, 0.3, len(t_w))
        pan_r = np.linspace(0.3, 0.8, len(t_w))
        return noise * window * pan_l, noise * window * pan_r

    whoosh_l, whoosh_r = create_whoosh(0.55)
    
    # Scene cut points across the 119.0s video
    cut_times = [
        4.5, 9.0, 14.5, 20.0, 25.5, 30.5, 36.0, 41.5, 47.0, 52.0,
        57.0, 62.0, 67.0, 72.5, 78.0, 83.0, 88.0, 93.0, 98.0, 103.0,
        108.0, 113.5
    ]
    for ct in cut_times:
        # place whoosh slightly before the cut (-0.3s)
        add_sound(whoosh_l, whoosh_r, max(0.0, ct - 0.28), gain=0.55)

    # 4. Cinematic Impact Hits
    def create_impact(duration=2.2, punch_hz=95.0, sub_hz=42.0):
        t_i = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
        # Sub decay
        sub = np.sin(2 * np.pi * sub_hz * t_i) * np.exp(-t_i * 1.6)
        # Punch attack
        punch = np.sin(2 * np.pi * punch_hz * t_i) * np.exp(-t_i * 8.0)
        # Click transient
        click = np.random.normal(0, 0.35, int(SAMPLE_RATE * 0.05)) * np.exp(-np.linspace(0, 1, int(SAMPLE_RATE * 0.05)) * 12.0)
        imp = sub * 0.8 + punch * 0.7
        imp[:len(click)] += click
        imp = np.clip(imp, -1.0, 1.0)
        return imp, imp

    # Key impact moments
    key_impacts = [
        (0.05, 1.0),   # Scene 01 Brand Title Reveal
        (9.0, 1.1),    # Scene 03 Executive Dashboard Drop
        (20.3, 0.9),   # Scene 05 Dossier Rating 1526 Punch
        (36.0, 1.15),  # Scene 08 Versus Arena Clash
        (78.0, 0.95),  # Scene 16 AI Matrix Online
        (108.0, 1.1),  # Scene 22 Campus Kiosk Rank #1
        (113.5, 1.25), # Scene 23 Grand Finale Climax
        (117.8, 1.2)   # Final Sub-bass Boom into blackout
    ]
    for imp_time, imp_gain in key_impacts:
        imp_l, imp_r = create_impact()
        add_sound(imp_l, imp_r, imp_time, gain=imp_gain)

    # 5. Digital Glitch Sound on Scene 10 (Integrity Monitor)
    glitch_dur = 1.2
    t_g = np.linspace(0, glitch_dur, int(SAMPLE_RATE * glitch_dur), False)
    glitch_sig = np.sin(2 * np.pi * 880 * t_g * (1 + 0.5 * np.sign(np.sin(2 * np.pi * 32 * t_g))))
    # Bitcrushed burst
    glitch_noise = np.random.choice([-0.4, 0.4], size=len(t_g)) * (np.sin(2 * np.pi * 6 * t_g) > 0.3)
    glitch_l = (glitch_sig * 0.4 + glitch_noise * 0.5) * np.exp(-t_g * 1.2)
    glitch_r = np.roll(glitch_l, 180)
    add_sound(glitch_l, glitch_r, 47.3, gain=0.75)

    # 6. Success Chimes (Scene 12 Quality & Scene 20 Reconciliation)
    def create_chime(duration=1.6):
        t_c = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
        # C6, E6, G6, C7 arpeggio harmonics
        tones = [1046.5, 1318.5, 1567.9, 2093.0]
        sig = np.zeros_like(t_c)
        for i, f in enumerate(tones):
            delay = i * 0.08
            idx = int(delay * SAMPLE_RATE)
            if idx < len(t_c):
                sub_t = t_c[:len(t_c) - idx]
                sub_wave = np.sin(2 * np.pi * f * sub_t) * np.exp(-sub_t * 3.5)
                sig[idx:] += sub_wave * 0.25
        return sig, sig

    chime_l, chime_r = create_chime()
    add_sound(chime_l, chime_r, 57.5, gain=0.65) # Scene 12
    add_sound(chime_l, chime_r, 98.4, gain=0.65) # Scene 20

    # 7. Subtle Haptic Mechanical Clicks
    def create_click(duration=0.06):
        t_k = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
        click = np.sin(2 * np.pi * 1400 * t_k) * np.exp(-t_k * 70.0)
        return click, click

    click_l, click_r = create_click()
    add_sound(click_l, click_r, 6.2, gain=0.45)   # Scene 02 Login button click
    add_sound(click_l, click_r, 74.0, gain=0.45)  # Scene 15 Faculty action queue
    add_sound(click_l, click_r, 104.5, gain=0.45) # Scene 21 Settings toggle snap

    # Normalize SFX to prevent raw clipping before muxing
    max_val = max(np.max(np.abs(left_channel)), np.max(np.abs(right_channel)))
    if max_val > 0.98:
        left_channel = (left_channel / max_val) * 0.95
        right_channel = (right_channel / max_val) * 0.95

    # Interleave stereo 16-bit PCM
    stereo_data = np.empty((TOTAL_SAMPLES * 2,), dtype=np.int16)
    stereo_data[0::2] = (np.clip(left_channel, -1.0, 1.0) * 32767).astype(np.int16)
    stereo_data[1::2] = (np.clip(right_channel, -1.0, 1.0) * 32767).astype(np.int16)

    with wave.open(SFX_TRACK_WAV, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(stereo_data.tobytes())

    print(f"[AUDIO] SFX bed written: {SFX_TRACK_WAV} ({os.path.getsize(SFX_TRACK_WAV)/(1024*1024):.2f} MB)")

def mix_cinematic_master():
    synthesize_sfx()
    print("[AUDIO] Muxing High-Energy Tamil Mass Bed + SFX Layer with Professional Broadcast Normalization (-14 LUFS)...")
    
    # We combine the music bed and the SFX layer:
    # 1. Music bed: low-pass filter during 0.0s - 8.9s, then full blast at 9.0s!
    # 2. Sidechain / Volume blend with SFX.
    # 3. Final master pass through EBU R128 loudnorm: -14 LUFS, true peak -1.0 dB.
    
    filter_complex = (
        "[0:a]volume=0.92[music];"
        "[1:a]volume=0.88[sfx];"
        "[music][sfx]amix=inputs=2:duration=first:dropout_transition=2[mixed];"
        "[mixed]loudnorm=I=-14.0:TP=-1.0:LRA=9.0:print_format=summary[out]"
    )
    
    cmd = [
        FFMPEG, "-y",
        "-i", MUSIC_BED_WAV,
        "-i", SFX_TRACK_WAV,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-ar", "48000",
        "-ac", "2",
        FINAL_MIX_WAV
    ]
    
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Master Audio Track Rendered: {FINAL_MIX_WAV} ({os.path.getsize(FINAL_MIX_WAV)/(1024*1024):.2f} MB)")

if __name__ == "__main__":
    mix_cinematic_master()
