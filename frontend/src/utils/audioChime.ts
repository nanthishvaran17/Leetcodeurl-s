/**
 * audioChime.ts — Native Web Audio API Studio Chime Engine
 * =====================================================================
 * Zero-dependency, offline-ready, 0ms-latency synthetic acoustic chimes.
 * Works seamlessly across desktop and mobile browsers.
 */

class AudioChimeEngine {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return null;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Ultra-Premium Acoustic Glass Chime (Soft Warm F5 -> Crystal C6 -> Shimmer F6)
   * High-end studio harmonic timbre, zero harshness, accompanied by subtle tactile haptic.
   */
  public playNotificationChime(): void {
    // 1. Gentle tactile haptic pulse on mobile devices
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([15, 30, 20]);
      } catch {
        // Haptic safety
      }
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Soft master lowpass filter to produce an organic, velvety acoustic timbre (eliminates synthetic sharpness)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, now);
      filter.Q.setValueAtTime(1.2, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.24, now);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Acoustic Glass Tri-Tone Chord: Warm Foundation (F5: 698.46Hz) + Sweet Bell (C6: 1046.5Hz) + Shimmer (F6: 1396.9Hz)
      const tones = [
        { freq: 698.46, start: now, dur: 0.28, vol: 0.18, type: 'sine' as OscillatorType },
        { freq: 1046.50, start: now + 0.05, dur: 0.36, vol: 0.24, type: 'sine' as OscillatorType },
        { freq: 1396.91, start: now + 0.09, dur: 0.44, vol: 0.26, type: 'triangle' as OscillatorType }
      ];

      tones.forEach(({ freq, start, dur, vol, type }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);

        // Smooth anti-click curved attack followed by gentle exponential bell decay
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Audio safety
    }
  }

  /**
   * Triumphant 4-note celebration fanfare (C5 -> E5 -> G5 -> C6) with shimmer
   */
  public playCelebrationChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: now, dur: 0.18, vol: 0.2 },       // C5
        { freq: 659.25, time: now + 0.12, dur: 0.18, vol: 0.22 }, // E5
        { freq: 783.99, time: now + 0.24, dur: 0.22, vol: 0.24 }, // G5
        { freq: 1046.50, time: now + 0.38, dur: 0.65, vol: 0.3 }  // C6 (high shimmer)
      ];

      notes.forEach(({ freq, time, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // Richer harmonics for celebration
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      });
    } catch {
      // Audio safety
    }
  }

  /**
   * Urgent contest alert ping (830Hz -> 620Hz double alert pulse)
   */
  public playContestAlertChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.14].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(830.6, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.28, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    } catch {
      // Audio safety
    }
  }

  /**
   * Smooth, satisfying download completed chime (G5 784Hz -> C6 1046.5Hz) with mobile haptic
   */
  public playDownloadSuccessChime(): void {
    // 1. Mobile tactile haptic vibration (Android & supporting devices)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([35, 50, 45]);
      } catch {
        // Haptic safety
      }
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: 783.99 Hz (G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: 1046.50 Hz (C6) bright affirmative chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle'; // Crisp harmonic
      osc2.frequency.setValueAtTime(1046.50, now + 0.1);
      gain2.gain.setValueAtTime(0.0001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.28, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);
    } catch {
      // Audio safety
    }
  }
}

export const audioChime = new AudioChimeEngine();
export const playNotificationChime = () => audioChime.playNotificationChime();
export const playCelebrationChime = () => audioChime.playCelebrationChime();
export const playContestAlertChime = () => audioChime.playContestAlertChime();
export const playDownloadSuccessChime = () => audioChime.playDownloadSuccessChime();
