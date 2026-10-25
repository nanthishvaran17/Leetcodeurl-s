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
   * Crisp, elegant notification chime (Bell chime: D5 587Hz -> A5 880Hz)
   */
  public playNotificationChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5) - soft warm bell
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2: 880 Hz (A5) - bright chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.09);
      gain2.gain.setValueAtTime(0.0001, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.45);
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
}

export const audioChime = new AudioChimeEngine();
export const playNotificationChime = () => audioChime.playNotificationChime();
export const playCelebrationChime = () => audioChime.playCelebrationChime();
export const playContestAlertChime = () => audioChime.playContestAlertChime();
