/**
 * HitAudioManager - Combat Audio Feedback System
 *
 * Provides satisfying audio feedback for combat events:
 * - Hit confirmation sounds (distinct from miss)
 * - Headshot/critical audio cues (higher pitched)
 * - Kill confirmation sounds (satisfying audio feedback)
 * - Low ammo warning sounds (warning tone)
 * - Empty magazine click sounds
 *
 * Inspired by:
 * - Halo: Iconic headshot "ding"
 * - DOOM: Aggressive, satisfying hit feedback
 * - CoD: Crisp hitmarkers and kill sounds
 */

import { getLogger } from './Logger';

const log = getLogger('HitAudioManager');

/**
 * Configuration for hit sound variations
 */
interface HitSoundConfig {
  /** Base frequency for the hit sound */
  baseFrequency: number;
  /** Duration of the hit sound in seconds */
  duration: number;
  /** Volume multiplier */
  volumeMultiplier: number;
}

/**
 * Hit types for different audio feedback
 */
export type HitType = 'normal' | 'critical' | 'kill' | 'headshot';

/**
 * HitAudioManager - Singleton for combat audio feedback
 */
export class HitAudioManager {
  private static instance: HitAudioManager | null = null;

  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.7;
  private isMuted = false;

  // Cooldowns to prevent sound spam
  private lastHitTime = 0;
  private lastLowAmmoWarningTime = 0;
  private readonly HIT_COOLDOWN_MS = 50;
  private readonly LOW_AMMO_WARNING_COOLDOWN_MS = 500;

  // Hit streak tracking for combo sounds
  private hitStreak = 0;
  private lastHitStreakTime = 0;
  private readonly HIT_STREAK_TIMEOUT_MS = 1000;

  private constructor() {}

  static getInstance(): HitAudioManager {
    if (!HitAudioManager.instance) {
      HitAudioManager.instance = new HitAudioManager();
    }
    return HitAudioManager.instance;
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupMasterGain();
    }
    return this.audioContext;
  }

  private setupMasterGain(): void {
    const ctx = this.audioContext!;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(ctx.destination);
  }

  private getOutputNode(): GainNode {
    if (!this.masterGain) {
      this.getContext();
    }
    return this.masterGain!;
  }

  // ============================================================================
  // HIT CONFIRMATION SOUNDS
  // ============================================================================

  /**
   * Play a hit sound based on damage dealt and whether it was critical
   * Scales pitch and intensity based on damage amount
   *
   * @param damage - Amount of damage dealt
   * @param isCritical - Whether this was a critical/headshot hit
   */
  playHitSound(damage: number, isCritical: boolean = false): void {
    if (this.isMuted) return;

    const now = performance.now();
    if (now - this.lastHitTime < this.HIT_COOLDOWN_MS) return;
    this.lastHitTime = now;

    // Update hit streak
    if (now - this.lastHitStreakTime < this.HIT_STREAK_TIMEOUT_MS) {
      this.hitStreak++;
    } else {
      this.hitStreak = 1;
    }
    this.lastHitStreakTime = now;

    const ctx = this.getContext();
    const audioNow = ctx.currentTime;

    if (isCritical) {
      this.playCriticalHitSound(damage, audioNow);
    } else {
      this.playNormalHitSound(damage, audioNow);
    }
  }

  /**
   * Normal hit sound - double-tick with damage scaling
   */
  private playNormalHitSound(damage: number, time: number): void {
    const ctx = this.getContext();
    const output = this.getOutputNode();

    // Scale intensity based on damage (0.5 to 1.2)
    const intensity = Math.min(1.2, 0.5 + damage / 50);
    const vol = 0.25 * intensity;

    // First tick - sharp attack
    const tick1 = ctx.createOscillator();
    tick1.type = 'sine';
    tick1.frequency.value = 1100 + damage * 2; // Higher pitch for more damage

    const tick1Gain = ctx.createGain();
    tick1Gain.gain.setValueAtTime(vol, time);
    tick1Gain.gain.exponentialRampToValueAtTime(0.01, time + 0.035);

    tick1.connect(tick1Gain);
    tick1Gain.connect(output);

    tick1.start(time);
    tick1.stop(time + 0.04);

    // Second tick - confirmation
    const tick2 = ctx.createOscillator();
    tick2.type = 'sine';
    tick2.frequency.value = 1400 + damage * 3;

    const tick2Gain = ctx.createGain();
    tick2Gain.gain.setValueAtTime(vol * 0.7, time + 0.025);
    tick2Gain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);

    tick2.connect(tick2Gain);
    tick2Gain.connect(output);

    tick2.start(time + 0.025);
    tick2.stop(time + 0.07);

    // Add subtle low-end thump for satisfying feel
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(200, time);
    thump.frequency.exponentialRampToValueAtTime(100, time + 0.04);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(vol * 0.4, time);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    thump.connect(thumpGain);
    thumpGain.connect(output);

    thump.start(time);
    thump.stop(time + 0.06);
  }

  /**
   * Critical/headshot hit sound - ascending ding with extra satisfaction
   */
  private playCriticalHitSound(_damage: number, time: number): void {
    const ctx = this.getContext();
    const output = this.getOutputNode();

    const vol = 0.35;

    // Ascending triple-ding for maximum satisfaction
    const frequencies = [1500, 2000, 2500];
    const timings = [0, 0.025, 0.05];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const t = time + timings[i];
      gain.gain.setValueAtTime(vol * (1 - i * 0.15), t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      osc.connect(gain);
      gain.connect(output);

      osc.start(t);
      osc.stop(t + 0.1);
    });

    // Add crispy high-end sparkle
    const sparkle = ctx.createOscillator();
    sparkle.type = 'triangle';
    sparkle.frequency.value = 4000;

    const sparkleGain = ctx.createGain();
    sparkleGain.gain.setValueAtTime(vol * 0.25, time);
    sparkleGain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    sparkle.connect(sparkleGain);
    sparkleGain.connect(output);

    sparkle.start(time);
    sparkle.stop(time + 0.05);

    // Subtle reverb tail for premium feel
    const reverbOsc = ctx.createOscillator();
    reverbOsc.type = 'sine';
    reverbOsc.frequency.value = 2200;

    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(vol * 0.15, time + 0.06);
    reverbGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    reverbOsc.connect(reverbGain);
    reverbGain.connect(output);

    reverbOsc.start(time + 0.06);
    reverbOsc.stop(time + 0.22);
  }

  // ============================================================================
  // KILL CONFIRMATION SOUND
  // ============================================================================

  /**
   * Play a satisfying kill confirmation sound
   * Deep, resonant "donk" with high accent - the "money sound"
   */
  playKillSound(): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;
    const vol = 0.4;

    // Deep satisfying bass "donk"
    const donk = ctx.createOscillator();
    donk.type = 'sine';
    donk.frequency.setValueAtTime(450, now);
    donk.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    const donkGain = ctx.createGain();
    donkGain.gain.setValueAtTime(vol, now);
    donkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    donk.connect(donkGain);
    donkGain.connect(output);

    donk.start(now);
    donk.stop(now + 0.2);

    // Sub-bass layer for chest impact
    const subBass = ctx.createOscillator();
    subBass.type = 'sine';
    subBass.frequency.setValueAtTime(80, now);
    subBass.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(vol * 0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    subBass.connect(subGain);
    subGain.connect(output);

    subBass.start(now);
    subBass.stop(now + 0.22);

    // High accent for clarity
    const accent = ctx.createOscillator();
    accent.type = 'sine';
    accent.frequency.setValueAtTime(1800, now);
    accent.frequency.setValueAtTime(1400, now + 0.04);

    const accentGain = ctx.createGain();
    accentGain.gain.setValueAtTime(vol * 0.45, now);
    accentGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    accent.connect(accentGain);
    accentGain.connect(output);

    accent.start(now);
    accent.stop(now + 0.12);

    // Completion chime
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.value = 2400;

    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(vol * 0.2, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    chime.connect(chimeGain);
    chimeGain.connect(output);

    chime.start(now + 0.05);
    chime.stop(now + 0.17);

    log.debug('Kill sound played');
  }

  // ============================================================================
  // LOW AMMO WARNING
  // ============================================================================

  /**
   * Play a low ammo warning sound
   * Subtle but noticeable warning tone that doesn't distract from combat
   */
  playLowAmmoWarning(): void {
    if (this.isMuted) return;

    // Prevent spam
    const now = performance.now();
    if (now - this.lastLowAmmoWarningTime < this.LOW_AMMO_WARNING_COOLDOWN_MS) return;
    this.lastLowAmmoWarningTime = now;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const audioNow = ctx.currentTime;
    const vol = 0.2;

    // Warning beep - slightly dissonant to draw attention
    const beep1 = ctx.createOscillator();
    beep1.type = 'sine';
    beep1.frequency.value = 880; // A5

    const beep1Gain = ctx.createGain();
    beep1Gain.gain.setValueAtTime(vol, audioNow);
    beep1Gain.gain.exponentialRampToValueAtTime(0.01, audioNow + 0.08);

    beep1.connect(beep1Gain);
    beep1Gain.connect(output);

    beep1.start(audioNow);
    beep1.stop(audioNow + 0.1);

    // Second beep for urgency
    const beep2 = ctx.createOscillator();
    beep2.type = 'sine';
    beep2.frequency.value = 784; // G5 - creates tension with A5

    const beep2Gain = ctx.createGain();
    beep2Gain.gain.setValueAtTime(vol * 0.8, audioNow + 0.12);
    beep2Gain.gain.exponentialRampToValueAtTime(0.01, audioNow + 0.2);

    beep2.connect(beep2Gain);
    beep2Gain.connect(output);

    beep2.start(audioNow + 0.12);
    beep2.stop(audioNow + 0.22);

    log.debug('Low ammo warning played');
  }

  // ============================================================================
  // EMPTY CLICK
  // ============================================================================

  /**
   * Play an empty magazine click sound
   * Distinct mechanical click indicating no ammo remaining
   */
  playEmptyClick(): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;
    const vol = 0.3;

    // Sharp mechanical click
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(1500, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.02);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(vol, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);

    // High-pass filter for metallic character
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 600;

    click.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(output);

    click.start(now);
    click.stop(now + 0.04);

    // Metal resonance
    const resonance = ctx.createOscillator();
    resonance.type = 'triangle';
    resonance.frequency.setValueAtTime(700, now + 0.01);
    resonance.frequency.exponentialRampToValueAtTime(250, now + 0.06);

    const resGain = ctx.createGain();
    resGain.gain.setValueAtTime(vol * 0.25, now + 0.01);
    resGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    resonance.connect(resGain);
    resGain.connect(output);

    resonance.start(now + 0.01);
    resonance.stop(now + 0.1);
  }

  // ============================================================================
  // MULTI-KILL SOUNDS
  // ============================================================================

  /**
   * Play multi-kill sound for rapid consecutive kills
   * More intense sound that builds with kill streak
   *
   * @param killCount - Number of kills in the streak
   */
  playMultiKillSound(killCount: number): void {
    if (this.isMuted) return;
    if (killCount < 2) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // Scale intensity with kill count (max at 5+)
    const intensity = Math.min(1.5, 0.8 + killCount * 0.15);
    const vol = 0.35 * intensity;

    // Rising power chord
    const baseFreq = 300 + killCount * 50;
    const chord = [baseFreq, baseFreq * 1.5, baseFreq * 2];

    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * (1 - i * 0.2), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(output);

      osc.start(now);
      osc.stop(now + 0.3);
    });

    // Triumphant high note
    const triumph = ctx.createOscillator();
    triumph.type = 'sine';
    triumph.frequency.setValueAtTime(2000 + killCount * 200, now + 0.1);

    const triumphGain = ctx.createGain();
    triumphGain.gain.setValueAtTime(vol * 0.5, now + 0.1);
    triumphGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    triumph.connect(triumphGain);
    triumphGain.connect(output);

    triumph.start(now + 0.1);
    triumph.stop(now + 0.35);

    log.debug(`Multi-kill sound played: ${killCount} kills`);
  }

  // ============================================================================
  // ARMOR/SHIELD FEEDBACK
  // ============================================================================

  /**
   * Play armor break sound when enemy armor is depleted
   */
  playArmorBreakSound(): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;
    const vol = 0.35;

    // Shattering crack
    const crack = ctx.createOscillator();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(3000, now);
    crack.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(vol, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    crack.connect(crackGain);
    crackGain.connect(output);

    crack.start(now);
    crack.stop(now + 0.12);

    // Noise burst for debris
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);

    noise.start(now);
    noise.stop(now + 0.1);

    // Satisfying "pop"
    const pop = ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(600, now);
    pop.frequency.exponentialRampToValueAtTime(150, now + 0.05);

    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(vol * 0.6, now);
    popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    pop.connect(popGain);
    popGain.connect(output);

    pop.start(now);
    pop.stop(now + 0.1);
  }

  // ============================================================================
  // VOLUME CONTROLS
  // ============================================================================

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  mute(): void {
    this.isMuted = true;
  }

  unmute(): void {
    this.isMuted = false;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // ============================================================================
  // HIT STREAK TRACKING
  // ============================================================================

  /**
   * Get the current hit streak count
   */
  getHitStreak(): number {
    const now = performance.now();
    if (now - this.lastHitStreakTime > this.HIT_STREAK_TIMEOUT_MS) {
      this.hitStreak = 0;
    }
    return this.hitStreak;
  }

  /**
   * Reset hit streak (e.g., on death or level change)
   */
  resetHitStreak(): void {
    this.hitStreak = 0;
    this.lastHitStreakTime = 0;
  }

  // ============================================================================
  // PLAYER DAMAGE FEEDBACK
  // ============================================================================

  /**
   * Play player hit sound - dull thud indicating player took damage
   * @param damage - Amount of damage taken
   */
  playPlayerHitSound(damage: number): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // Scale intensity based on damage (higher damage = more intense)
    const intensity = Math.min(1.5, 0.6 + damage / 40);
    const vol = 0.4 * intensity;

    // Dull impact thud - body hit feel
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(100, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(vol, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Distortion for impact feel
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    distortion.curve = curve;

    // Muffled noise for flesh impact
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    // Pain grunt component - subtle vocalization
    const grunt = ctx.createOscillator();
    grunt.type = 'sawtooth';
    grunt.frequency.setValueAtTime(150 + Math.random() * 50, now);
    grunt.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    const gruntFilter = ctx.createBiquadFilter();
    gruntFilter.type = 'bandpass';
    gruntFilter.frequency.value = 200;
    gruntFilter.Q.value = 3;

    const gruntGain = ctx.createGain();
    gruntGain.gain.setValueAtTime(vol * 0.25, now);
    gruntGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Connect
    thud.connect(distortion);
    distortion.connect(thudGain);
    thudGain.connect(output);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);

    grunt.connect(gruntFilter);
    gruntFilter.connect(gruntGain);
    gruntGain.connect(output);

    // Play
    thud.start(now);
    thud.stop(now + 0.25);
    noise.start(now);
    noise.stop(now + 0.15);
    grunt.start(now);
    grunt.stop(now + 0.12);
  }

  /**
   * Play heartbeat sound for low health warning
   * Creates tension when player health is critical
   */
  playHeartbeat(volume = 0.3): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // First beat (lub)
    const lub = ctx.createOscillator();
    lub.type = 'sine';
    lub.frequency.setValueAtTime(80, now);
    lub.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    const lubGain = ctx.createGain();
    lubGain.gain.setValueAtTime(volume, now);
    lubGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    // Second beat (dub) - slightly quieter and higher
    const dub = ctx.createOscillator();
    dub.type = 'sine';
    dub.frequency.setValueAtTime(70, now + 0.15);
    dub.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    const dubGain = ctx.createGain();
    dubGain.gain.setValueAtTime(volume * 0.7, now + 0.15);
    dubGain.gain.exponentialRampToValueAtTime(0.01, now + 0.27);

    // Sub-bass pulse for chest feel
    const subPulse = ctx.createOscillator();
    subPulse.type = 'sine';
    subPulse.frequency.value = 30;

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    // Connect
    lub.connect(lubGain);
    lubGain.connect(output);

    dub.connect(dubGain);
    dubGain.connect(output);

    subPulse.connect(subGain);
    subGain.connect(output);

    // Play
    lub.start(now);
    lub.stop(now + 0.15);
    dub.start(now + 0.15);
    dub.stop(now + 0.3);
    subPulse.start(now);
    subPulse.stop(now + 0.2);
  }

  /**
   * Play heavy breathing sound for low health / exhaustion
   */
  playHeavyBreathing(volume = 0.25): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // Inhale - filtered noise rising
    const inhaleBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const inhaleData = inhaleBuffer.getChannelData(0);
    for (let i = 0; i < inhaleData.length; i++) {
      inhaleData[i] = Math.random() * 2 - 1;
    }
    const inhale = ctx.createBufferSource();
    inhale.buffer = inhaleBuffer;

    const inhaleFilter = ctx.createBiquadFilter();
    inhaleFilter.type = 'bandpass';
    inhaleFilter.frequency.setValueAtTime(400, now);
    inhaleFilter.frequency.linearRampToValueAtTime(800, now + 0.4);
    inhaleFilter.Q.value = 2;

    const inhaleGain = ctx.createGain();
    inhaleGain.gain.setValueAtTime(0, now);
    inhaleGain.gain.linearRampToValueAtTime(volume, now + 0.15);
    inhaleGain.gain.setValueAtTime(volume * 0.8, now + 0.35);
    inhaleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    // Exhale - filtered noise falling
    const exhaleBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
    const exhaleData = exhaleBuffer.getChannelData(0);
    for (let i = 0; i < exhaleData.length; i++) {
      exhaleData[i] = Math.random() * 2 - 1;
    }
    const exhale = ctx.createBufferSource();
    exhale.buffer = exhaleBuffer;

    const exhaleFilter = ctx.createBiquadFilter();
    exhaleFilter.type = 'bandpass';
    exhaleFilter.frequency.setValueAtTime(700, now + 0.6);
    exhaleFilter.frequency.linearRampToValueAtTime(300, now + 1.1);
    exhaleFilter.Q.value = 2;

    const exhaleGain = ctx.createGain();
    exhaleGain.gain.setValueAtTime(0, now + 0.6);
    exhaleGain.gain.linearRampToValueAtTime(volume * 0.8, now + 0.75);
    exhaleGain.gain.setValueAtTime(volume * 0.6, now + 1);
    exhaleGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    // Subtle wheeze undertone
    const wheeze = ctx.createOscillator();
    wheeze.type = 'sawtooth';
    wheeze.frequency.setValueAtTime(150, now);
    wheeze.frequency.linearRampToValueAtTime(200, now + 0.4);

    const wheezeFilter = ctx.createBiquadFilter();
    wheezeFilter.type = 'bandpass';
    wheezeFilter.frequency.value = 250;
    wheezeFilter.Q.value = 8;

    const wheezeGain = ctx.createGain();
    wheezeGain.gain.setValueAtTime(0, now);
    wheezeGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.2);
    wheezeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    // Connect
    inhale.connect(inhaleFilter);
    inhaleFilter.connect(inhaleGain);
    inhaleGain.connect(output);

    exhale.connect(exhaleFilter);
    exhaleFilter.connect(exhaleGain);
    exhaleGain.connect(output);

    wheeze.connect(wheezeFilter);
    wheezeFilter.connect(wheezeGain);
    wheezeGain.connect(output);

    // Play
    inhale.start(now);
    inhale.stop(now + 0.55);
    exhale.start(now + 0.6);
    exhale.stop(now + 1.25);
    wheeze.start(now);
    wheeze.stop(now + 0.5);
  }

  /**
   * Play shield break sound - energy shield depleted
   */
  playShieldBreak(volume = 0.45): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // Energy crackle
    const crackle = ctx.createOscillator();
    crackle.type = 'sawtooth';
    crackle.frequency.setValueAtTime(2500, now);
    crackle.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(volume * 0.6, now);
    crackleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    // Electric zap
    const zap = ctx.createOscillator();
    zap.type = 'square';
    zap.frequency.setValueAtTime(1500, now);
    zap.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    const zapGain = ctx.createGain();
    zapGain.gain.setValueAtTime(volume * 0.4, now);
    zapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Descending power-down tone
    const powerDown = ctx.createOscillator();
    powerDown.type = 'sine';
    powerDown.frequency.setValueAtTime(800, now);
    powerDown.frequency.exponentialRampToValueAtTime(150, now + 0.3);

    const powerDownGain = ctx.createGain();
    powerDownGain.gain.setValueAtTime(volume * 0.5, now);
    powerDownGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    // Noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    // Connect
    crackle.connect(crackleGain);
    crackleGain.connect(output);

    zap.connect(zapGain);
    zapGain.connect(output);

    powerDown.connect(powerDownGain);
    powerDownGain.connect(output);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);

    // Play
    crackle.start(now);
    crackle.stop(now + 0.2);
    zap.start(now);
    zap.stop(now + 0.12);
    powerDown.start(now);
    powerDown.stop(now + 0.4);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  /**
   * Play critical health warning - urgent alarm
   */
  playCriticalHealthWarning(volume = 0.3): void {
    if (this.isMuted) return;

    const ctx = this.getContext();
    const output = this.getOutputNode();
    const now = ctx.currentTime;

    // Two-tone alarm
    const alarm1 = ctx.createOscillator();
    alarm1.type = 'sine';
    alarm1.frequency.value = 600;

    const alarm2 = ctx.createOscillator();
    alarm2.type = 'sine';
    alarm2.frequency.value = 450;

    const alarm1Gain = ctx.createGain();
    alarm1Gain.gain.setValueAtTime(volume, now);
    alarm1Gain.gain.setValueAtTime(0, now + 0.15);
    alarm1Gain.gain.setValueAtTime(volume, now + 0.3);
    alarm1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const alarm2Gain = ctx.createGain();
    alarm2Gain.gain.setValueAtTime(0, now);
    alarm2Gain.gain.setValueAtTime(volume * 0.8, now + 0.15);
    alarm2Gain.gain.setValueAtTime(0, now + 0.3);
    alarm2Gain.gain.setValueAtTime(volume * 0.8, now + 0.45);
    alarm2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    // Connect
    alarm1.connect(alarm1Gain);
    alarm1Gain.connect(output);

    alarm2.connect(alarm2Gain);
    alarm2Gain.connect(output);

    // Play
    alarm1.start(now);
    alarm1.stop(now + 0.5);
    alarm2.start(now);
    alarm2.stop(now + 0.65);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.masterGain = null;
    this.hitStreak = 0;
    this.lastHitTime = 0;
    this.lastLowAmmoWarningTime = 0;
    HitAudioManager.instance = null;
    log.info('HitAudioManager disposed');
  }
}

// Singleton accessor
export const hitAudioManager = HitAudioManager.getInstance();

// Convenience function exports for easy access
export function playHitSound(damage: number, isCritical: boolean = false): void {
  hitAudioManager.playHitSound(damage, isCritical);
}

export function playKillSound(): void {
  hitAudioManager.playKillSound();
}

export function playLowAmmoWarning(): void {
  hitAudioManager.playLowAmmoWarning();
}

export function playEmptyClick(): void {
  hitAudioManager.playEmptyClick();
}

export function playMultiKillSound(killCount: number): void {
  hitAudioManager.playMultiKillSound(killCount);
}

export function playArmorBreakSound(): void {
  hitAudioManager.playArmorBreakSound();
}

export function playPlayerHitSound(damage: number): void {
  hitAudioManager.playPlayerHitSound(damage);
}

export function playHeartbeat(volume?: number): void {
  hitAudioManager.playHeartbeat(volume);
}

export function playHeavyBreathing(volume?: number): void {
  hitAudioManager.playHeavyBreathing(volume);
}

export function playShieldBreak(volume?: number): void {
  hitAudioManager.playShieldBreak(volume);
}

export function playCriticalHealthWarning(volume?: number): void {
  hitAudioManager.playCriticalHealthWarning(volume);
}
