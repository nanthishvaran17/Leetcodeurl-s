/**
 * audioChime.ts — Native Web Audio API Studio Chime Engine
 * =====================================================================
 * Zero-dependency, offline-ready, 0ms-latency synthetic acoustic chimes.
 * Top 5 World-Best Professional Notification Timbres.
 * Works seamlessly across desktop and mobile browsers.
 */

export type NotificationSoundTone = 
  | 'galaxy'    // Samsung Galaxy Celestial Breeze
  | 'apple'     // Apple Aurora Crystal Glass
  | 'pixel'     // Google Pixel Velvet Pop
  | 'tech'      // Slack / Discord Studio Knock & Ding
  | 'neon'      // Cyberpunk Neon Shimmer
  | 'whatsapp'  // WhatsApp Bubbly Pop (legacy)
  | 'none';     // Silent / Mute

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

  private triggerHaptic(pattern: number[] = [25, 30]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Haptic safety
      }
    }
  }

  /**
   * 1. APPLE AURORA CRYSTAL GLASS (iOS / macOS Inspired)
   * High-end studio harmonic timbre: F5 (698Hz) -> C6 (1046Hz) -> F6 (1397Hz)
   * Warm lowpass acoustic filter, velvety decay, zero harshness.
   */
  public playAppleGlassChime(): void {
    this.triggerHaptic([15, 30, 20]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, now);
      filter.Q.setValueAtTime(1.2, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.26, now);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      const tones = [
        { freq: 698.46, start: now, dur: 0.28, vol: 0.20, type: 'sine' as OscillatorType },
        { freq: 1046.50, start: now + 0.05, dur: 0.36, vol: 0.25, type: 'sine' as OscillatorType },
        { freq: 1396.91, start: now + 0.09, dur: 0.44, vol: 0.28, type: 'triangle' as OscillatorType }
      ];

      tones.forEach(({ freq, start, dur, vol, type }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);

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
   * 2. SAMSUNG GALAXY CELESTIAL BREEZE (Ascending Pentatonic Harp)
   * Luxurious 4-note ascending chord: C#5 (554Hz) -> F#5 (740Hz) -> G#5 (830Hz) -> C#6 (1108Hz)
   * Rich harmonic resonance, deeply satisfying and executive.
   */
  public playGalaxyCelestialChime(): void {
    this.triggerHaptic([20, 25, 35]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(4200, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.28, now);
      masterFilter.connect(masterGain);
      masterGain.connect(ctx.destination);

      const notes = [
        { freq: 554.37, start: now, dur: 0.35, vol: 0.22 },        // C#5
        { freq: 739.99, start: now + 0.07, dur: 0.38, vol: 0.24 }, // F#5
        { freq: 830.61, start: now + 0.14, dur: 0.42, vol: 0.26 }, // G#5
        { freq: 1108.73, start: now + 0.21, dur: 0.65, vol: 0.30 } // C#6 (high shimmer)
      ];

      notes.forEach(({ freq, start, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(masterFilter);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Audio safety
    }
  }

  /**
   * 3. GOOGLE PIXEL VELVET POP (Material You Marimba & Warm Kalimba)
   * Organic warm glissando: 587Hz (D5) -> 880Hz (A5) -> 1175Hz (D6)
   * Gentle, friendly, bubbly, modern, and non-fatiguing.
   */
  public playPixelVelvetChime(): void {
    this.triggerHaptic([30, 20]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Note 1: Warm low marimba transient
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.04);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.32, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);

      // Note 2: Sweet high velvet bell ping
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.05);
      gain2.gain.setValueAtTime(0.0001, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.42);
    } catch {
      // Audio safety
    }
  }

  /**
   * 4. SLACK / DISCORD STUDIO KNOCK & DING (Silicon Valley Tech)
   * Snappy acoustic wood transient punch (220Hz) + High crystal bell (E6: 1318Hz + overtone).
   * Crisp, punchy, energetic, highly recognizable executive productivity tone.
   */
  public playTechKnockDing(): void {
    this.triggerHaptic([30, 40, 30]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // 1. Acoustic low knock transient
      const oscKnock = ctx.createOscillator();
      const gainKnock = ctx.createGain();
      oscKnock.type = 'triangle';
      oscKnock.frequency.setValueAtTime(320, now);
      oscKnock.frequency.exponentialRampToValueAtTime(160, now + 0.04);
      gainKnock.gain.setValueAtTime(0.30, now);
      gainKnock.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      oscKnock.connect(gainKnock);
      gainKnock.connect(ctx.destination);
      oscKnock.start(now);
      oscKnock.stop(now + 0.06);

      // 2. High tech bell ding (E6: 1318.51Hz)
      const oscDing = ctx.createOscillator();
      const gainDing = ctx.createGain();
      oscDing.type = 'sine';
      oscDing.frequency.setValueAtTime(1318.51, now + 0.03);
      gainDing.gain.setValueAtTime(0.0001, now + 0.03);
      gainDing.gain.exponentialRampToValueAtTime(0.34, now + 0.05);
      gainDing.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      oscDing.connect(gainDing);
      gainDing.connect(ctx.destination);
      oscDing.start(now + 0.03);
      oscDing.stop(now + 0.45);

      // 3. Subtle shimmer harmonic overtone (B6: 1975.53Hz)
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(1975.53, now + 0.035);
      gainHarmonic.gain.setValueAtTime(0.0001, now + 0.035);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.12, now + 0.055);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);
      oscHarmonic.start(now + 0.035);
      oscHarmonic.stop(now + 0.28);
    } catch {
      // Audio safety
    }
  }

  /**
   * 5. CYBERPUNK NEON SHIMMER (Future Kinetic Chime)
   * High-energy futuristic dual-frequency chime: Bb5 (932Hz) -> Eb6 (1244Hz)
   * Bright, metallic, modern, victorious, and impressive ("bayangaramaana" sound).
   */
  public playNeonKineticChime(): void {
    this.triggerHaptic([35, 25, 40]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'bandpass';
      masterFilter.frequency.setValueAtTime(1800, now);
      masterFilter.Q.setValueAtTime(0.8, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.32, now);
      masterFilter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Dual kinetic ping
      const pings = [
        { freq: 932.33, start: now, dur: 0.28, vol: 0.26 },        // Bb5
        { freq: 1244.51, start: now + 0.06, dur: 0.55, vol: 0.32 }, // Eb6
        { freq: 1864.66, start: now + 0.07, dur: 0.35, vol: 0.16 }  // Bb6 shimmer
      ];

      pings.forEach(({ freq, start, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(masterFilter);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Audio safety
    }
  }

  /**
   * WhatsApp Style Bubbly Water Pop (Legacy)
   */
  public playWhatsAppPop(): void {
    this.triggerHaptic([25, 20]);
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(1450, now + 0.04);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.38, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
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
        { freq: 523.25, time: now, dur: 0.18, vol: 0.2 },
        { freq: 659.25, time: now + 0.12, dur: 0.18, vol: 0.22 },
        { freq: 783.99, time: now + 0.24, dur: 0.22, vol: 0.24 },
        { freq: 1046.50, time: now + 0.38, dur: 0.65, vol: 0.3 }
      ];

      notes.forEach(({ freq, time, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
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
   * Play any tone by string key
   */
  public playTone(tone: string): void {
    if (tone === 'none' || tone === 'silent' || tone === 'mute') return;
    switch (tone) {
      case 'galaxy':
        this.playGalaxyCelestialChime();
        break;
      case 'apple':
        this.playAppleGlassChime();
        break;
      case 'pixel':
        this.playPixelVelvetChime();
        break;
      case 'tech':
        this.playTechKnockDing();
        break;
      case 'neon':
        this.playNeonKineticChime();
        break;
      case 'whatsapp':
        this.playWhatsAppPop();
        break;
      default:
        this.playGalaxyCelestialChime();
    }
  }

  /**
   * Plays the tone currently selected in user preferences (galaxy | apple | pixel | tech | neon)
   */
  public playSelectedNotificationChime(): void {
    let tone = 'galaxy';
    try {
      tone = localStorage.getItem('notification_sound_tone') || 'galaxy';
    } catch {}

    this.playTone(tone);
  }

  /**
   * Download completed sound: respects user's selected tone preference with tactile haptic
   */
  public playDownloadSuccessChime(): void {
    this.triggerHaptic([35, 50, 45]);
    this.playSelectedNotificationChime();
  }
}

export const audioChime = new AudioChimeEngine();
export const playSelectedNotificationChime = () => audioChime.playSelectedNotificationChime();
export const playNotificationChime = () => audioChime.playSelectedNotificationChime();
export const playAppleGlassChime = () => audioChime.playAppleGlassChime();
export const playGalaxyCelestialChime = () => audioChime.playGalaxyCelestialChime();
export const playPixelVelvetChime = () => audioChime.playPixelVelvetChime();
export const playTechKnockDing = () => audioChime.playTechKnockDing();
export const playNeonKineticChime = () => audioChime.playNeonKineticChime();
export const playWhatsAppPop = () => audioChime.playWhatsAppPop();
export const playCelebrationChime = () => audioChime.playCelebrationChime();
export const playContestAlertChime = () => audioChime.playContestAlertChime();
export const playDownloadSuccessChime = () => audioChime.playDownloadSuccessChime();
export const playTone = (tone: string) => audioChime.playTone(tone);
