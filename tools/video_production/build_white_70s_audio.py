import os
import wave
import struct
import numpy as np

OUTPUT_DIR = os.path.abspath("output_white_70s")
os.makedirs(OUTPUT_DIR, exist_ok=True)
MASTER_AUDIO_WAV = os.path.join(OUTPUT_DIR, "audio_master_70s.wav")

SAMPLE_RATE = 48000
TOTAL_DUR = 70.000  # Exactly 70.000 seconds
TOTAL_SAMPLES = int(SAMPLE_RATE * TOTAL_DUR)

def synthesize_audio_track():
    print(f"[AUDIO] Synthesizing 70.000s Premium Technology Product Score & SFX Bed @ 48kHz...")
    
    left = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    right = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    def add_sound(snd_l, snd_r, start_sec, gain=1.0):
        start_idx = int(start_sec * SAMPLE_RATE)
        if start_idx >= TOTAL_SAMPLES:
            return
        end_idx = min(start_idx + len(snd_l), TOTAL_SAMPLES)
        length = end_idx - start_idx
        left[start_idx:end_idx] += snd_l[:length] * gain
        right[start_idx:end_idx] += snd_r[:length] * gain

    t_full = np.linspace(0, TOTAL_DUR, TOTAL_SAMPLES, False)

    # 1. Modern Understated Ambient Tech Harmony Bed (Cmaj7 -> G -> Am7 -> F)
    # 4 bars per cycle (approx 8 seconds per progression)
    chords = [
        # (root, notes, dur)
        (261.63, [261.63, 329.63, 392.00, 493.88]), # Cmaj7
        (196.00, [196.00, 246.94, 293.66, 392.00]), # G
        (220.00, [220.00, 261.63, 329.63, 440.00]), # Am7
        (174.61, [174.61, 220.00, 261.63, 349.23]), # Fmaj7
    ]
    prog_len = 8.0 # seconds per cycle
    chord_len = prog_len / 4.0 # 2.0s per chord

    total_cycles = int(np.ceil(TOTAL_DUR / prog_len))

    for cycle in range(total_cycles):
        for c_idx, (root, notes) in enumerate(chords):
            c_start = cycle * prog_len + c_idx * chord_len
            if c_start >= TOTAL_DUR:
                break
            cur_dur = min(chord_len, TOTAL_DUR - c_start)
            c_samples = int(cur_dur * SAMPLE_RATE)
            t_c = np.linspace(0, cur_dur, c_samples, False)

            # Soft attack and release envelope
            env = np.ones(c_samples, dtype=np.float32)
            att_samples = int(SAMPLE_RATE * 0.25)
            rel_samples = int(SAMPLE_RATE * 0.35)
            env[:att_samples] = np.linspace(0, 1, att_samples)
            env[-rel_samples:] = np.linspace(1, 0, rel_samples)

            # Progressive dynamics: builds subtle energy from 0s to 63s
            prog_gain = 0.12 + 0.14 * (c_start / 63.0)
            if c_start >= 63.0: # Finale climax and resolution
                prog_gain = 0.22 * (1.0 - (c_start - 63.0) / 7.0)

            # Synth pad tones
            pad_l = np.zeros(c_samples, dtype=np.float32)
            pad_r = np.zeros(c_samples, dtype=np.float32)

            for n_idx, freq in enumerate(notes):
                # Gentle sine wave with subtle octave shimmer
                s1 = np.sin(2 * np.pi * freq * t_c)
                s2 = np.sin(2 * np.pi * (freq * 2.0) * t_c + 0.5) * 0.25
                s3 = np.sin(2 * np.pi * (freq * 0.5) * t_c) * 0.3
                pan = (n_idx / (len(notes) - 1)) * 0.4 + 0.3 # 0.3 to 0.7 stereo spread
                pad_l += (s1 + s2 + s3) * (1.0 - pan)
                pad_r += (s1 + s2 + s3) * pan

            pad_l = pad_l * env * prog_gain * 0.25
            pad_r = pad_r * env * prog_gain * 0.25
            add_sound(pad_l, pad_r, c_start, gain=1.0)

    # 2. Delicate Acoustic Chime / Bell Generator
    def create_bell(freq, dur=1.8, decay=3.5):
        samples = int(SAMPLE_RATE * dur)
        t_b = np.linspace(0, dur, samples, False)
        env_b = np.exp(-t_b * decay)
        tone = (
            np.sin(2 * np.pi * freq * t_b) * 0.6 +
            np.sin(2 * np.pi * freq * 2.756 * t_b) * 0.25 +
            np.sin(2 * np.pi * freq * 5.404 * t_b) * 0.15
        ) * env_b
        return tone * 0.45, tone * 0.45

    # 3. Soft Airy Transition Whoosh
    def create_whoosh(dur=0.7):
        samples = int(SAMPLE_RATE * dur)
        t_w = np.linspace(0, dur, samples, False)
        noise = np.random.normal(0, 0.2, samples)
        # Parabolic volume envelope
        env_w = np.sin(np.pi * t_w / dur) ** 2.0
        # Gentle bandpass frequency sweep
        sweep = np.sin(2 * np.pi * (300 + 400 * t_w / dur) * t_w) * 0.3
        snd = (noise * 0.7 + sweep * 0.3) * env_w * 0.25
        return snd, np.roll(snd, 120)

    # 4. Tactile Micro-Click
    def create_click():
        dur = 0.04
        samples = int(SAMPLE_RATE * dur)
        t_k = np.linspace(0, dur, samples, False)
        env_k = np.exp(-t_k * 120.0)
        click = np.sin(2 * np.pi * 1800.0 * t_k) * env_k * 0.35
        return click, click

    # 5. Place Sound Effects Aligned with the 9-Scene Timeline
    print("  -> Placing subtle sound effects across the 70s timeline...")

    # Scene 01: 0.0 - 4.0s (Opening Reveal)
    chime_l, chime_r = create_bell(880.0, dur=2.2, decay=2.5) # A5 chime
    add_sound(chime_l, chime_r, 1.0, gain=0.85)

    # Scene 02: 4.0 - 10.0s (Secure Login)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 3.8, gain=0.6)
    clk_l, clk_r = create_click()
    add_sound(clk_l, clk_r, 6.9, gain=0.9) # Click on Sign In

    # Scene 03: 10.0 - 18.0s (Dashboard Overview)
    wh_l, wh_r = create_whoosh(0.7)
    add_sound(wh_l, wh_r, 9.8, gain=0.7)
    dash_bell_l, dash_bell_r = create_bell(523.25, dur=2.5, decay=2.0) # C5 bell
    add_sound(dash_bell_l, dash_bell_r, 12.0, gain=0.75) # Metric emphasis

    # Scene 04: 18.0 - 28.0s (Leaderboard Experience)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 17.8, gain=0.65)
    # Search typing micro-ticks
    for tk in [21.2, 21.4, 21.6, 21.8, 22.0, 22.2]:
        add_sound(clk_l, clk_r, tk, gain=0.3)
    lb_bell_l, lb_bell_r = create_bell(659.25, dur=2.0, decay=2.5) # E5 bell
    add_sound(lb_bell_l, lb_bell_r, 24.0, gain=0.7)

    # Scene 05: 28.0 - 37.0s (Individual Student Intelligence)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 27.8, gain=0.65)
    prof_bell_l, prof_bell_r = create_bell(783.99, dur=2.5, decay=2.2) # G5 bell
    add_sound(prof_bell_l, prof_bell_r, 30.5, gain=0.8) # Radar emphasis

    # Scene 06: 37.0 - 46.0s (Contest Analytics)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 36.8, gain=0.65)
    pod_bell_l, pod_bell_r = create_bell(1046.50, dur=2.8, decay=2.0) # C6 bell
    add_sound(pod_bell_l, pod_bell_r, 40.5, gain=0.85) # Top 3 podium

    # Scene 07: 46.0 - 55.0s (Reporting & Evidence)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 45.8, gain=0.65)
    add_sound(clk_l, clk_r, 48.8, gain=0.9) # Click Generate Preview
    rep_bell_l, rep_bell_r = create_bell(587.33, dur=2.5, decay=2.2) # D5 bell
    add_sound(rep_bell_l, rep_bell_r, 49.2, gain=0.75) # Preview reveal

    # Scene 08: 55.0 - 63.0s (System Status & Sync Engine)
    wh_l, wh_r = create_whoosh(0.6)
    add_sound(wh_l, wh_r, 54.8, gain=0.65)
    sync_bell_l, sync_bell_r = create_bell(880.0, dur=2.6, decay=2.0) # 100% sync status
    add_sound(sync_bell_l, sync_bell_r, 57.5, gain=0.8)

    # Scene 09: 63.0 - 70.0s (Grand Finale)
    wh_l, wh_r = create_whoosh(0.8)
    add_sound(wh_l, wh_r, 62.8, gain=0.75)
    # Warm resonant closing chord (C major: C4 + E4 + G4 + C5)
    fin_dur = 6.0
    fin_samples = int(SAMPLE_RATE * fin_dur)
    t_fin = np.linspace(0, fin_dur, fin_samples, False)
    env_fin = np.exp(-t_fin * 0.7) * (1.0 - (t_fin / fin_dur) ** 2.0)
    chord_fin = (
        np.sin(2 * np.pi * 261.63 * t_fin) * 0.35 +
        np.sin(2 * np.pi * 329.63 * t_fin) * 0.30 +
        np.sin(2 * np.pi * 392.00 * t_fin) * 0.25 +
        np.sin(2 * np.pi * 523.25 * t_fin) * 0.20
    ) * env_fin * 0.5
    add_sound(chord_fin, chord_fin, 63.2, gain=1.0)

    # Master Fade-In (0.0s -> 0.8s) and Master Fade-Out (68.0s -> 70.0s)
    fade_in_s = int(SAMPLE_RATE * 0.8)
    fade_out_s = int(SAMPLE_RATE * 2.0)

    left[:fade_in_s] *= np.linspace(0, 1, fade_in_s)
    right[:fade_in_s] *= np.linspace(0, 1, fade_in_s)

    left[-fade_out_s:] *= np.linspace(1, 0, fade_out_s)
    right[-fade_out_s:] *= np.linspace(1, 0, fade_out_s)

    # Peak normalization to -1.5 dBFS
    max_peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
    if max_peak > 0:
        target_peak = 10 ** (-1.5 / 20.0) # ~0.841
        scaling = target_peak / max_peak
        left *= scaling
        right *= scaling

    # Convert to 16-bit integer PCM
    left_16 = np.int16(np.clip(left * 32767.0, -32768, 32767))
    right_16 = np.int16(np.clip(right * 32767.0, -32768, 32767))

    # Interleave stereo
    interleaved = np.empty((TOTAL_SAMPLES * 2,), dtype=np.int16)
    interleaved[0::2] = left_16
    interleaved[1::2] = right_16

    with wave.open(MASTER_AUDIO_WAV, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(interleaved.tobytes())

    size_mb = os.path.getsize(MASTER_AUDIO_WAV) / (1024 * 1024)
    print(f"[SUCCESS] Master Audio Track Rendered: {MASTER_AUDIO_WAV}")
    print(f"          Duration: {TOTAL_DUR:.3f}s exact | Size: {size_mb:.2f} MB | Rate: {SAMPLE_RATE} Hz")

if __name__ == "__main__":
    synthesize_audio_track()
