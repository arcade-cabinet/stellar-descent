/**
 * PlayerVoice - Procedural Player Character Voice Reactions
 *
 * Generates non-verbal vocal reactions for the player character (Sgt. James Cole)
 * using the Web Audio API. These are grunts, breathing, and effort sounds --
 * no dialogue text, purely audio feedback.
 *
 * Sound categories:
 * - Damage grunts (short noise bursts, varying intensity)
 * - Pain sounds (longer, higher-pitched, for heavy hits)
 * - Heavy breathing (when health is low)
 * - Jump / sprint effort sounds
 * - Death scream
 * - Landing impact grunt
 *
 * All sounds are procedurally generated with no external samples required.
 * The system respects AudioManager volume settings.
 */

import { getAudioManager } from '../core/AudioManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerVoiceEvent =
  | 'damage_light'
  | 'damage_medium'
  | 'damage_heavy'
  | 'damage_critical'
  | 'pain'
  | 'jump'
  | 'sprint_breath'
  | 'land_heavy'
  | 'death'
  | 'near_death_gasp'
  | 'heal_relief';

interface ActiveBreathingState {
  intervalId: ReturnType<typeof setInterval>;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// PlayerVoiceManager
// ---------------------------------------------------------------------------

/**
 * Manages procedural voice reactions for the player character.
 * All synthesis uses raw Web Audio API nodes.
 */
export class PlayerVoiceManager {
  private audioContext: AudioContext | null = null;
  private isDisposed = false;
  private breathingState: ActiveBreathingState | null = null;
  private lastEventTime: Map<PlayerVoiceEvent, number> = new Map();

  /** Minimum milliseconds between the same event type */
  private readonly eventCooldowns: Record<PlayerVoiceEvent, number> = {
    damage_light: 200,
    damage_medium: 300,
    damage_heavy: 500,
    damage_critical: 800,
    pain: 600,
    jump: 250,
    sprint_breath: 400,
    land_heavy: 300,
    death: 5000,
    near_death_gasp: 2000,
    heal_relief: 3000,
  };

  private getContext(): AudioContext {
    if (this.isDisposed) throw new Error('PlayerVoiceManager disposed');
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private getVolume(): number {
    return getAudioManager().getVoiceVolume();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Play a vocal reaction for the given event.
   * Returns false if the event was suppressed due to cooldown.
   */
  play(event: PlayerVoiceEvent): boolean {
    if (this.isDisposed) return false;

    // Cooldown check
    const now = Date.now();
    const last = this.lastEventTime.get(event) ?? 0;
    if (now - last < this.eventCooldowns[event]) return false;
    this.lastEventTime.set(event, now);

    const vol = this.getVolume();
    if (vol <= 0) return false;

    try {
      switch (event) {
        case 'damage_light':
          this.generateDamageGrunt(vol * 0.3, 0.08, 180);
          break;
        case 'damage_medium':
          this.generateDamageGrunt(vol * 0.45, 0.12, 150);
          break;
        case 'damage_heavy':
          this.generateDamageGrunt(vol * 0.6, 0.18, 120);
          break;
        case 'damage_critical':
          this.generateDamageGrunt(vol * 0.7, 0.25, 100);
          this.generatePainOvertone(vol * 0.3, 0.3);
          break;
        case 'pain':
          this.generatePainSound(vol * 0.55);
          break;
        case 'jump':
          this.generateEffortGrunt(vol * 0.25, 0.1, 160);
          break;
        case 'sprint_breath':
          this.generateBreathSound(vol * 0.15);
          break;
        case 'land_heavy':
          this.generateEffortGrunt(vol * 0.35, 0.15, 100);
          break;
        case 'death':
          this.generateDeathScream(vol * 0.65);
          break;
        case 'near_death_gasp':
          this.generateGasp(vol * 0.4);
          break;
        case 'heal_relief':
          this.generateHealRelief(vol * 0.25);
          break;
      }
    } catch {
      // AudioContext not ready
      return false;
    }

    return true;
  }

  /**
   * Start continuous heavy breathing loop (when health is low).
   * Call stopHeavyBreathing() when health recovers.
   */
  startHeavyBreathing(): void {
    if (this.breathingState?.isActive) return;

    const breathInterval = setInterval(() => {
      if (this.isDisposed) {
        this.stopHeavyBreathing();
        return;
      }
      const vol = this.getVolume();
      if (vol > 0) {
        this.generateHeavyBreath(vol * 0.2);
      }
    }, 1200 + Math.random() * 400);

    this.breathingState = {
      intervalId: breathInterval,
      isActive: true,
    };

    // Play immediate first breath
    const vol = this.getVolume();
    if (vol > 0) {
      this.generateHeavyBreath(vol * 0.2);
    }
  }

  /**
   * Stop the heavy breathing loop.
   */
  stopHeavyBreathing(): void {
    if (this.breathingState) {
      clearInterval(this.breathingState.intervalId);
      this.breathingState.isActive = false;
      this.breathingState = null;
    }
  }

  /**
   * Convenience: call with current health ratio to auto-manage breathing.
   */
  updateHealthState(healthRatio: number): void {
    if (healthRatio <= 0.25 && !this.breathingState?.isActive) {
      this.startHeavyBreathing();
    } else if (healthRatio > 0.25 && this.breathingState?.isActive) {
      this.stopHeavyBreathing();
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.isDisposed = true;
    this.stopHeavyBreathing();
    this.lastEventTime.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }

  // -----------------------------------------------------------------------
  // Sound generators
  // -----------------------------------------------------------------------

  /**
   * Short noise burst grunt -- the core damage reaction.
   * @param volume    Output volume
   * @param duration  Duration in seconds
   * @param pitch     Base frequency for the tonal component
   */
  private generateDamageGrunt(volume: number, duration: number, pitch: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Tonal component -- low voiced grunt
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, now + duration);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 600;
    oscFilter.Q.value = 2;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);

    // Noise burst -- the consonant / breath part
    const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Schedule
    osc.start(now);
    osc.stop(now + duration + 0.02);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  /**
   * Higher-pitched overtone layered on top of critical damage grunts.
   */
  private generatePainOvertone(volume: number, duration: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Extended pain sound -- for sustained heavy damage.
   */
  private generatePainSound(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const duration = 0.35;

    // Voiced component
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(140, now + duration);

    // Formant filter for "aah" quality
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 700;
    formant.Q.value = 5;

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.04);
    gain.gain.setValueAtTime(volume * 0.8, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(formant);
    formant.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
    lfo.start(now);
    lfo.stop(now + duration + 0.02);
  }

  /**
   * Short effort grunt for jumps / landings.
   */
  private generateEffortGrunt(volume: number, duration: number, pitch: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Quick sprint breath -- filtered noise puff.
   */
  private generateBreathSound(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const duration = 0.15;

    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.02);
  }

  /**
   * Heavy breathing cycle -- inhale + exhale with vocal fry.
   */
  private generateHeavyBreath(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Inhale: rising filtered noise
    const inhaleDur = 0.4;
    const exhaleDur = 0.5;

    const inhaleBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * inhaleDur), ctx.sampleRate);
    const inhaleData = inhaleBuffer.getChannelData(0);
    for (let i = 0; i < inhaleData.length; i++) {
      inhaleData[i] = Math.random() * 2 - 1;
    }
    const inhale = ctx.createBufferSource();
    inhale.buffer = inhaleBuffer;

    const inhaleFilter = ctx.createBiquadFilter();
    inhaleFilter.type = 'bandpass';
    inhaleFilter.frequency.setValueAtTime(800, now);
    inhaleFilter.frequency.linearRampToValueAtTime(1500, now + inhaleDur);
    inhaleFilter.Q.value = 2;

    const inhaleGain = ctx.createGain();
    inhaleGain.gain.setValueAtTime(0, now);
    inhaleGain.gain.linearRampToValueAtTime(volume * 0.7, now + inhaleDur * 0.4);
    inhaleGain.gain.exponentialRampToValueAtTime(0.001, now + inhaleDur);

    inhale.connect(inhaleFilter);
    inhaleFilter.connect(inhaleGain);
    inhaleGain.connect(ctx.destination);

    // Exhale: descending noise + light vocal oscillator
    const exhaleStart = now + inhaleDur + 0.1;
    const exhaleBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * exhaleDur), ctx.sampleRate);
    const exhaleData = exhaleBuffer.getChannelData(0);
    for (let i = 0; i < exhaleData.length; i++) {
      exhaleData[i] = Math.random() * 2 - 1;
    }
    const exhale = ctx.createBufferSource();
    exhale.buffer = exhaleBuffer;

    const exhaleFilter = ctx.createBiquadFilter();
    exhaleFilter.type = 'bandpass';
    exhaleFilter.frequency.setValueAtTime(1200, exhaleStart);
    exhaleFilter.frequency.linearRampToValueAtTime(600, exhaleStart + exhaleDur);
    exhaleFilter.Q.value = 1.5;

    const exhaleGain = ctx.createGain();
    exhaleGain.gain.setValueAtTime(volume * 0.6, exhaleStart);
    exhaleGain.gain.exponentialRampToValueAtTime(0.001, exhaleStart + exhaleDur);

    // Light vocal fry on exhale
    const vocalFry = ctx.createOscillator();
    vocalFry.type = 'sawtooth';
    vocalFry.frequency.value = 70 + Math.random() * 20;

    const fryFilter = ctx.createBiquadFilter();
    fryFilter.type = 'lowpass';
    fryFilter.frequency.value = 300;

    const fryGain = ctx.createGain();
    fryGain.gain.setValueAtTime(volume * 0.15, exhaleStart);
    fryGain.gain.exponentialRampToValueAtTime(0.001, exhaleStart + exhaleDur * 0.7);

    exhale.connect(exhaleFilter);
    exhaleFilter.connect(exhaleGain);
    exhaleGain.connect(ctx.destination);

    vocalFry.connect(fryFilter);
    fryFilter.connect(fryGain);
    fryGain.connect(ctx.destination);

    // Schedule
    inhale.start(now);
    inhale.stop(now + inhaleDur + 0.02);
    exhale.start(exhaleStart);
    exhale.stop(exhaleStart + exhaleDur + 0.02);
    vocalFry.start(exhaleStart);
    vocalFry.stop(exhaleStart + exhaleDur + 0.02);
  }

  /**
   * Death scream -- dramatic descending cry.
   */
  private generateDeathScream(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const duration = 0.8;

    // Primary vocal
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    // Second harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(450, now);
    osc2.frequency.exponentialRampToValueAtTime(120, now + duration * 0.8);

    // Formant for "aaah" quality
    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.setValueAtTime(800, now);
    formant1.frequency.linearRampToValueAtTime(400, now + duration);
    formant1.Q.value = 6;

    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.frequency.value = 1400;
    formant2.Q.value = 4;

    // Vibrato (gets faster as life fades)
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5, now);
    lfo.frequency.linearRampToValueAtTime(12, now + duration);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Noise for breath
    const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;
    noiseFilter.Q.value = 1;

    // Gains
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    mainGain.gain.setValueAtTime(volume * 0.9, now + 0.3);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.2, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

    // Connect
    osc.connect(formant1);
    osc.connect(formant2);
    formant1.connect(mainGain);
    formant2.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Schedule
    osc.start(now);
    osc.stop(now + duration + 0.05);
    osc2.start(now);
    osc2.stop(now + duration + 0.05);
    lfo.start(now);
    lfo.stop(now + duration + 0.05);
    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  /**
   * Near-death gasp -- sharp intake of breath.
   */
  private generateGasp(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const duration = 0.25;

    // Sharp inhale noise
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.linearRampToValueAtTime(2000, now + duration * 0.3);
    filter.frequency.linearRampToValueAtTime(1200, now + duration);
    filter.Q.value = 3;

    // Light vocal quality
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(350, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(180, now + duration);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.02);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Heal relief -- soft exhale with slight vocal tone.
   */
  private generateHealRelief(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const duration = 0.4;

    // Soft exhale noise
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Gentle vocal hum underneath
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 160;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.02);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let playerVoiceInstance: PlayerVoiceManager | null = null;

export function getPlayerVoiceManager(): PlayerVoiceManager {
  if (!playerVoiceInstance) {
    playerVoiceInstance = new PlayerVoiceManager();
  }
  return playerVoiceInstance;
}

export function disposePlayerVoiceManager(): void {
  if (playerVoiceInstance) {
    playerVoiceInstance.dispose();
    playerVoiceInstance = null;
  }
}
