/**
 * WeaponSoundManager - Per-weapon procedural sound effects
 *
 * Provides polished, distinct audio for each weapon type:
 * - Assault Rifle: Punchy single shots with mechanical punch
 * - SMG: Rapid fire, lighter sound with high-frequency snap
 * - Plasma Cannon: Energy charge, bass-heavy discharge
 *
 * Features:
 * - Multiple fire samples per weapon (4 variations to avoid repetition)
 * - Random pitch variation for natural feel
 * - Distance-based falloff with inverse square law
 * - Environmental reverb (station, surface, hive)
 * - Feedback sounds (hit markers, headshots, kill confirmations)
 * - Complete sound set: fire, reload, empty click, equip, switch
 * - Low frequency impact for satisfying weapon feel
 */

import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';

/**
 * Environment types for reverb configuration
 */
export type EnvironmentType = 'station' | 'surface' | 'hive' | 'default';

/**
 * Impact surface types for material-specific sounds
 */
export type ImpactSurface = 'metal' | 'concrete' | 'organic' | 'energy' | 'default';

/**
 * Reverb settings per environment
 */
interface ReverbConfig {
  /** Reverb decay time in seconds */
  decay: number;
  /** Wet/dry mix (0-1) */
  wetMix: number;
  /** Pre-delay in ms */
  preDelay: number;
  /** High frequency damping (0-1) */
  damping: number;
}

const ENVIRONMENT_REVERB: Record<EnvironmentType, ReverbConfig> = {
  station: {
    decay: 1.2,
    wetMix: 0.35,
    preDelay: 15,
    damping: 0.4,
  },
  surface: {
    decay: 0.6,
    wetMix: 0.15,
    preDelay: 30,
    damping: 0.7, // Outdoor echo - less reverb, more delay
  },
  hive: {
    decay: 2.0,
    wetMix: 0.5,
    preDelay: 10,
    damping: 0.6, // Muffled, organic absorption
  },
  default: {
    decay: 0.8,
    wetMix: 0.2,
    preDelay: 10,
    damping: 0.5,
  },
};

/**
 * Map level IDs to environment types
 */
const LEVEL_ENVIRONMENTS: Partial<Record<LevelId, EnvironmentType>> = {
  anchor_station: 'station',
  landfall: 'surface',
  fob_delta: 'station',
  brothers_in_arms: 'surface',
  the_breach: 'hive',
  extraction: 'surface',
};

/**
 * WeaponSoundManager - Singleton for weapon audio management
 */
export class WeaponSoundManager {
  private static instance: WeaponSoundManager | null = null;

  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;

  private currentEnvironment: EnvironmentType = 'default';
  private masterVolume = 0.7;
  private isMuted = false;

  // Last fire times for rapid fire management
  private lastFireTimes: Map<WeaponId, number> = new Map();

  // Variation tracking to avoid repetition
  private variationIndex: Map<WeaponId, number> = new Map();
  private readonly VARIATIONS_PER_WEAPON = 4;

  private constructor() {}

  static getInstance(): WeaponSoundManager {
    if (!WeaponSoundManager.instance) {
      WeaponSoundManager.instance = new WeaponSoundManager();
    }
    return WeaponSoundManager.instance;
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioGraph();
    }
    return this.audioContext;
  }

  private setupAudioGraph(): void {
    const ctx = this.audioContext!;

    // Master gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(ctx.destination);

    // Dry path (direct sound)
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1 - ENVIRONMENT_REVERB[this.currentEnvironment].wetMix;
    this.dryGain.connect(this.masterGain);

    // Wet path (reverb)
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = ENVIRONMENT_REVERB[this.currentEnvironment].wetMix;
    this.wetGain.connect(this.masterGain);

    // Create impulse response for reverb
    this.createReverbNode();
  }

  private createReverbNode(): void {
    const ctx = this.getContext();
    const config = ENVIRONMENT_REVERB[this.currentEnvironment];

    // Generate synthetic impulse response
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * config.decay;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with damping
        const decay = Math.exp(-3 * (i / length));
        const damping = Math.exp(-config.damping * 3 * (i / length));
        // Add some noise for natural reverb tail
        channelData[i] = (Math.random() * 2 - 1) * decay * damping;
      }
    }

    if (this.reverbNode) {
      this.reverbNode.disconnect();
    }

    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbNode.connect(this.wetGain!);
  }

  /**
   * Set the current environment for reverb
   */
  setEnvironment(environment: EnvironmentType): void {
    if (environment === this.currentEnvironment) return;

    this.currentEnvironment = environment;
    const config = ENVIRONMENT_REVERB[environment];

    // Update wet/dry mix
    if (this.dryGain && this.wetGain) {
      this.dryGain.gain.value = 1 - config.wetMix;
      this.wetGain.gain.value = config.wetMix;
    }

    // Recreate reverb with new settings
    this.createReverbNode();
  }

  /**
   * Set environment from level ID
   */
  setEnvironmentFromLevel(levelId: LevelId): void {
    const env = LEVEL_ENVIRONMENTS[levelId] || 'default';
    this.setEnvironment(env);
  }

  /**
   * Get random pitch variation
   */
  private getPitchVariation(baseVariance = 0.05): number {
    return 1 + (Math.random() * 2 - 1) * baseVariance;
  }

  /**
   * Get next variation index for weapon
   */
  private getNextVariation(weaponId: WeaponId): number {
    const current = this.variationIndex.get(weaponId) || 0;
    const next = (current + 1) % this.VARIATIONS_PER_WEAPON;
    this.variationIndex.set(weaponId, next);
    return current;
  }

  /**
   * Apply distance falloff to volume
   */
  private applyDistanceFalloff(baseVolume: number, distance: number): number {
    if (distance <= 0) return baseVolume;
    // Simple inverse square falloff with minimum
    const falloff = 1 / Math.max(1, distance * 0.1);
    return baseVolume * Math.max(0.1, falloff);
  }

  // ============================================================================
  // ASSAULT RIFLE SOUNDS
  // ============================================================================

  /**
   * Assault Rifle fire - Punchy single shots with mechanical punch
   * Inspired by military rifles - sharp attack, meaty mid, controlled decay
   */
  playAssaultRifleFire(volume = 0.5, distance = 0): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const variation = this.getNextVariation('assault_rifle');
    const pitch = this.getPitchVariation(0.04);
    const vol = this.applyDistanceFalloff(volume, distance);

    // Variation-specific frequency offsets for distinct shots
    const freqOffset = [0, 80, -60, 120][variation];
    const attackDecay = [0.025, 0.028, 0.022, 0.03][variation];

    // Sharp transient attack - the "crack"
    const attack = ctx.createOscillator();
    attack.type = 'sawtooth';
    attack.frequency.setValueAtTime((2000 + freqOffset) * pitch, now);
    attack.frequency.exponentialRampToValueAtTime(350, now + attackDecay);

    // Low-frequency thump for punch/impact feel
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime((100 + variation * 8) * pitch, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.06);

    // Body of the shot - mid-range presence
    const body = ctx.createOscillator();
    body.type = 'square';
    body.frequency.setValueAtTime((180 + variation * 25) * pitch, now);
    body.frequency.exponentialRampToValueAtTime(55, now + 0.09);

    // High-frequency noise burst for supersonic crack
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.07, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3500 + variation * 400;
    noiseFilter.Q.value = 1.8;

    // Gain envelopes with tight attack
    const attackGain = ctx.createGain();
    attackGain.gain.setValueAtTime(vol * 0.75, now);
    attackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(vol * 0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(vol * 0.45, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    // Compression for punch and loudness
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 4;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.04;

    // Connect through dry and wet paths
    attack.connect(attackGain);
    attackGain.connect(compressor);

    thump.connect(thumpGain);
    thumpGain.connect(compressor);

    body.connect(bodyGain);
    bodyGain.connect(compressor);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(compressor);

    compressor.connect(this.dryGain!);
    compressor.connect(this.reverbNode!);

    // Play all components
    attack.start(now);
    attack.stop(now + 0.045);
    thump.start(now);
    thump.stop(now + 0.1);
    body.start(now);
    body.stop(now + 0.13);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  // ============================================================================
  // SMG SOUNDS
  // ============================================================================

  /**
   * SMG fire - Rapid, snappy sound with electronic pulse character
   * Futuristic feel - tight attack, clean release, buzzy undertone
   */
  playSMGFire(volume = 0.4, distance = 0): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const variation = this.getNextVariation('pulse_smg');
    const pitch = this.getPitchVariation(0.05);
    const vol = this.applyDistanceFalloff(volume, distance);

    // Variation-specific timings for rapid fire variety
    const attackSpeed = [0.012, 0.015, 0.011, 0.014][variation];
    const freqBase = [2400, 2200, 2600, 2300][variation];

    // Very sharp high-frequency attack - the "snap"
    const attack = ctx.createOscillator();
    attack.type = 'sawtooth';
    attack.frequency.setValueAtTime(freqBase * pitch, now);
    attack.frequency.exponentialRampToValueAtTime(500, now + attackSpeed);

    // Electronic pulse undertone
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.setValueAtTime((800 + variation * 100) * pitch, now);
    pulse.frequency.exponentialRampToValueAtTime(200, now + 0.025);

    // Light body - keeps it from being too thin
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime((220 + variation * 35) * pitch, now);
    body.frequency.exponentialRampToValueAtTime(70, now + 0.035);

    // Quick, crisp noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 4500;

    // Very short, snappy envelopes for rapid fire feel
    const attackGain = ctx.createGain();
    attackGain.gain.setValueAtTime(vol * 0.65, now);
    attackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.018);

    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(vol * 0.25, now);
    pulseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(vol * 0.3, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);

    // Connect with minimal reverb for tight sound
    attack.connect(attackGain);
    attackGain.connect(this.dryGain!);

    pulse.connect(pulseGain);
    pulseGain.connect(this.dryGain!);

    body.connect(bodyGain);
    bodyGain.connect(this.dryGain!);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.dryGain!);
    noiseGain.connect(this.reverbNode!);

    // Play - all very short for rapid fire capability
    attack.start(now);
    attack.stop(now + 0.022);
    pulse.start(now);
    pulse.stop(now + 0.035);
    body.start(now);
    body.stop(now + 0.05);
    noise.start(now);
    noise.stop(now + 0.028);
  }

  // ============================================================================
  // PLASMA CANNON SOUNDS
  // ============================================================================

  /**
   * Plasma Cannon fire - Heavy energy weapon with satisfying bass impact
   * Sci-fi energy weapon - quick charge whine, massive bass thump, electric crackle
   */
  playPlasmaCannonFire(volume = 0.6, distance = 0): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const variation = this.getNextVariation('plasma_cannon');
    const pitch = this.getPitchVariation(0.025);
    const vol = this.applyDistanceFalloff(volume, distance);

    // Variation-specific characteristics
    const chargeSpeed = [0.045, 0.05, 0.04, 0.055][variation];
    const bassDepth = [95, 105, 90, 110][variation];

    // Quick charge-up whine - builds anticipation
    const charge = ctx.createOscillator();
    charge.type = 'sine';
    charge.frequency.setValueAtTime((350 + variation * 60) * pitch, now);
    charge.frequency.exponentialRampToValueAtTime(1400, now + chargeSpeed);

    // Secondary charge harmonic for richness
    const charge2 = ctx.createOscillator();
    charge2.type = 'triangle';
    charge2.frequency.setValueAtTime((700 + variation * 80) * pitch, now);
    charge2.frequency.exponentialRampToValueAtTime(2000, now + chargeSpeed * 0.8);

    // MASSIVE bass discharge - the "thump" that makes it satisfying
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(bassDepth * pitch, now + 0.035);
    bass.frequency.exponentialRampToValueAtTime(25, now + 0.35);

    // Sub-bass layer for chest-thumping impact
    const subBass = ctx.createOscillator();
    subBass.type = 'sine';
    subBass.frequency.setValueAtTime(50, now + 0.035);
    subBass.frequency.exponentialRampToValueAtTime(18, now + 0.4);

    // Mid-range energy crackle
    const energy = ctx.createOscillator();
    energy.type = 'sawtooth';
    energy.frequency.setValueAtTime((650 + variation * 90) * pitch, now + 0.035);
    energy.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    // High frequency electric zap
    const zap = ctx.createOscillator();
    zap.type = 'square';
    zap.frequency.setValueAtTime((1800 + variation * 250) * pitch, now + 0.035);
    zap.frequency.exponentialRampToValueAtTime(350, now + 0.09);

    // Crackling noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 2.5;

    // Distortion for energy crackle character
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    distortion.curve = curve;

    // Envelope gains
    const chargeGain = ctx.createGain();
    chargeGain.gain.setValueAtTime(vol * 0.35, now);
    chargeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.055);

    const charge2Gain = ctx.createGain();
    charge2Gain.gain.setValueAtTime(vol * 0.15, now);
    charge2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.setValueAtTime(vol * 0.9, now + 0.035);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const subBassGain = ctx.createGain();
    subBassGain.gain.setValueAtTime(0, now);
    subBassGain.gain.setValueAtTime(vol * 0.7, now + 0.035);
    subBassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const energyGain = ctx.createGain();
    energyGain.gain.setValueAtTime(0, now);
    energyGain.gain.setValueAtTime(vol * 0.55, now + 0.035);
    energyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    const zapGain = ctx.createGain();
    zapGain.gain.setValueAtTime(0, now);
    zapGain.gain.setValueAtTime(vol * 0.4, now + 0.035);
    zapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.setValueAtTime(vol * 0.3, now + 0.035);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    // Connect charge sounds
    charge.connect(chargeGain);
    chargeGain.connect(this.dryGain!);

    charge2.connect(charge2Gain);
    charge2Gain.connect(this.dryGain!);

    // Connect bass layers with reverb
    bass.connect(bassGain);
    bassGain.connect(this.dryGain!);
    bassGain.connect(this.reverbNode!);

    subBass.connect(subBassGain);
    subBassGain.connect(this.dryGain!);

    // Connect energy/crackle through distortion
    energy.connect(distortion);
    distortion.connect(energyGain);
    energyGain.connect(this.dryGain!);
    energyGain.connect(this.reverbNode!);

    zap.connect(zapGain);
    zapGain.connect(this.dryGain!);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.dryGain!);

    // Play all components
    charge.start(now);
    charge.stop(now + 0.06);
    charge2.start(now);
    charge2.stop(now + 0.05);
    bass.start(now + 0.035);
    bass.stop(now + 0.45);
    subBass.start(now + 0.035);
    subBass.stop(now + 0.5);
    energy.start(now + 0.035);
    energy.stop(now + 0.22);
    zap.start(now + 0.035);
    zap.stop(now + 0.13);
    noise.start(now + 0.035);
    noise.stop(now + 0.18);
  }

  // ============================================================================
  // UNIFIED FIRE SOUND
  // ============================================================================

  /**
   * Play fire sound for specified weapon
   */
  playWeaponFire(weaponId: WeaponId, volume = 0.5, distance = 0): void {
    switch (weaponId) {
      case 'assault_rifle':
        this.playAssaultRifleFire(volume, distance);
        break;
      case 'pulse_smg':
        this.playSMGFire(volume, distance);
        break;
      case 'plasma_cannon':
        this.playPlasmaCannonFire(volume, distance);
        break;
    }
  }

  // ============================================================================
  // RELOAD SOUNDS
  // ============================================================================

  /**
   * Assault Rifle reload - Magazine eject and insert
   */
  playAssaultRifleReload(volume = 0.4): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Magazine eject click
    this.playMechanicalClick(vol * 0.7, now);

    // Magazine slide out
    this.playMetallicSlide(vol * 0.5, now + 0.15, 0.2, 800, 400);

    // New magazine insertion
    this.playMetallicSlide(vol * 0.6, now + 0.8, 0.15, 400, 900);

    // Magazine lock click
    this.playMechanicalClick(vol * 0.8, now + 1.0);

    // Bolt release
    this.playBoltRelease(vol * 0.6, now + 1.4);
  }

  /**
   * SMG reload - Quick magazine swap
   */
  playSMGReload(volume = 0.35): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Fast eject
    this.playMechanicalClick(vol * 0.6, now);
    this.playMetallicSlide(vol * 0.4, now + 0.08, 0.12, 1000, 500);

    // Quick insert
    this.playMetallicSlide(vol * 0.5, now + 0.5, 0.1, 500, 1100);
    this.playMechanicalClick(vol * 0.7, now + 0.65);

    // Charging handle
    this.playBoltRelease(vol * 0.5, now + 0.9);
  }

  /**
   * Plasma Cannon reload - Energy cell swap with power-up
   */
  playPlasmaCannonReload(volume = 0.5): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Cell ejection with power-down whine
    const powerDown = ctx.createOscillator();
    powerDown.type = 'sine';
    powerDown.frequency.setValueAtTime(600, now);
    powerDown.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    const powerDownGain = ctx.createGain();
    powerDownGain.gain.setValueAtTime(vol * 0.3, now);
    powerDownGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    powerDown.connect(powerDownGain);
    powerDownGain.connect(this.dryGain!);
    powerDown.start(now);
    powerDown.stop(now + 0.55);

    // Mechanical clunk for cell removal
    this.playMechanicalClick(vol * 0.5, now + 0.3);

    // New cell insertion
    this.playMetallicSlide(vol * 0.4, now + 1.5, 0.2, 300, 600);
    this.playMechanicalClick(vol * 0.6, now + 1.75);

    // Power-up sequence
    const powerUp = ctx.createOscillator();
    powerUp.type = 'sine';
    powerUp.frequency.setValueAtTime(80, now + 2.0);
    powerUp.frequency.exponentialRampToValueAtTime(400, now + 2.8);

    const powerUpGain = ctx.createGain();
    powerUpGain.gain.setValueAtTime(vol * 0.2, now + 2.0);
    powerUpGain.gain.linearRampToValueAtTime(vol * 0.4, now + 2.5);
    powerUpGain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

    powerUp.connect(powerUpGain);
    powerUpGain.connect(this.dryGain!);
    powerUp.start(now + 2.0);
    powerUp.stop(now + 3.1);

    // Ready beep
    this.playReadyBeep(vol * 0.4, now + 2.9);
  }

  /**
   * Play reload sound for specified weapon
   */
  playWeaponReload(weaponId: WeaponId, volume = 0.4): void {
    switch (weaponId) {
      case 'assault_rifle':
        this.playAssaultRifleReload(volume);
        break;
      case 'pulse_smg':
        this.playSMGReload(volume);
        break;
      case 'plasma_cannon':
        this.playPlasmaCannonReload(volume);
        break;
    }
  }

  /**
   * Play reload start sound (beginning of reload animation)
   */
  playReloadStart(weaponId: WeaponId, volume = 0.3): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Generic start sound - magazine release
    this.playMechanicalClick(vol, now);
  }

  /**
   * Play reload complete sound
   */
  playReloadComplete(weaponId: WeaponId, volume = 0.4): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Weapon-specific completion sounds
    if (weaponId === 'plasma_cannon') {
      this.playReadyBeep(vol, now);
    } else {
      this.playBoltRelease(vol, now);
    }
  }

  // ============================================================================
  // HELPER SOUND GENERATORS
  // ============================================================================

  private playMechanicalClick(volume: number, time: number): void {
    const ctx = this.getContext();

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, time);
    osc.frequency.exponentialRampToValueAtTime(500, time + 0.015);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);

    osc.connect(gain);
    gain.connect(this.dryGain!);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  private playMetallicSlide(
    volume: number,
    time: number,
    duration: number,
    startFreq: number,
    endFreq: number
  ): void {
    const ctx = this.getContext();

    // Filtered noise for metallic scrape
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq, time);
    filter.frequency.linearRampToValueAtTime(endFreq, time + duration);
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.setValueAtTime(volume, time + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain!);

    noise.start(time);
    noise.stop(time + duration + 0.01);
  }

  private playBoltRelease(volume: number, time: number): void {
    const ctx = this.getContext();

    // Metal clank
    const clank = ctx.createOscillator();
    clank.type = 'triangle';
    clank.frequency.setValueAtTime(400, time);
    clank.frequency.exponentialRampToValueAtTime(150, time + 0.05);

    const clankGain = ctx.createGain();
    clankGain.gain.setValueAtTime(volume, time);
    clankGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    // Spring sound
    const spring = ctx.createOscillator();
    spring.type = 'sine';
    spring.frequency.setValueAtTime(800, time);
    spring.frequency.exponentialRampToValueAtTime(300, time + 0.03);

    const springGain = ctx.createGain();
    springGain.gain.setValueAtTime(volume * 0.4, time);
    springGain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    clank.connect(clankGain);
    clankGain.connect(this.dryGain!);

    spring.connect(springGain);
    springGain.connect(this.dryGain!);

    clank.start(time);
    clank.stop(time + 0.1);
    spring.start(time);
    spring.stop(time + 0.05);
  }

  private playReadyBeep(volume: number, time: number): void {
    const ctx = this.getContext();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.setValueAtTime(1000, time + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.setValueAtTime(volume, time + 0.05);
    gain.gain.linearRampToValueAtTime(volume * 0.8, time + 0.06);
    gain.gain.setValueAtTime(volume * 0.8, time + 0.11);
    gain.gain.linearRampToValueAtTime(0, time + 0.15);

    osc.connect(gain);
    gain.connect(this.dryGain!);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  // ============================================================================
  // EMPTY CLICK / NO AMMO
  // ============================================================================

  /**
   * Empty click when trying to fire with no ammo
   * Weapon-specific sounds for distinct feel
   */
  playEmptyClick(weaponId: WeaponId, volume = 0.3): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    switch (weaponId) {
      case 'assault_rifle':
        // Heavy mechanical click with metal resonance
        this.playAssaultRifleEmptyClick(vol, now);
        break;
      case 'pulse_smg':
        // Light, quick electronic click
        this.playSMGEmptyClick(vol, now);
        break;
      case 'plasma_cannon':
        // Energy cell depleted - electronic failure beep
        this.playPlasmaCannonEmptyClick(vol, now);
        break;
      default:
        this.playGenericEmptyClick(vol, now);
    }
  }

  private playAssaultRifleEmptyClick(volume: number, time: number): void {
    const ctx = this.getContext();

    // Heavy bolt click
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(1400, time);
    click.frequency.exponentialRampToValueAtTime(350, time + 0.025);

    // Metal resonance
    const resonance = ctx.createOscillator();
    resonance.type = 'triangle';
    resonance.frequency.setValueAtTime(600, time + 0.01);
    resonance.frequency.exponentialRampToValueAtTime(200, time + 0.05);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume, time);
    clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    const resGain = ctx.createGain();
    resGain.gain.setValueAtTime(volume * 0.3, time + 0.01);
    resGain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 700;

    click.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(this.dryGain!);

    resonance.connect(resGain);
    resGain.connect(this.dryGain!);

    click.start(time);
    click.stop(time + 0.05);
    resonance.start(time + 0.01);
    resonance.stop(time + 0.07);
  }

  private playSMGEmptyClick(volume: number, time: number): void {
    const ctx = this.getContext();

    // Quick, light electronic click
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(2000, time);
    click.frequency.exponentialRampToValueAtTime(600, time + 0.012);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.025);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;

    click.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain!);

    click.start(time);
    click.stop(time + 0.03);
  }

  private playPlasmaCannonEmptyClick(volume: number, time: number): void {
    const ctx = this.getContext();

    // Low power failure tone
    const failTone = ctx.createOscillator();
    failTone.type = 'sine';
    failTone.frequency.setValueAtTime(400, time);
    failTone.frequency.exponentialRampToValueAtTime(150, time + 0.1);

    // Electronic buzz
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(100, time);
    buzz.frequency.exponentialRampToValueAtTime(60, time + 0.08);

    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(volume * 0.5, time);
    toneGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    const buzzGain = ctx.createGain();
    buzzGain.gain.setValueAtTime(volume * 0.3, time);
    buzzGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    failTone.connect(toneGain);
    toneGain.connect(this.dryGain!);

    buzz.connect(buzzGain);
    buzzGain.connect(this.dryGain!);

    failTone.start(time);
    failTone.stop(time + 0.15);
    buzz.start(time);
    buzz.stop(time + 0.12);
  }

  private playGenericEmptyClick(volume: number, time: number): void {
    const ctx = this.getContext();

    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(1200, time);
    click.frequency.exponentialRampToValueAtTime(400, time + 0.02);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    click.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain!);

    click.start(time);
    click.stop(time + 0.05);
  }

  // ============================================================================
  // WEAPON SWITCH
  // ============================================================================

  /**
   * Weapon switch sound - holster and draw sequence
   */
  playWeaponSwitch(volume = 0.35): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Holster current weapon - descending slide
    this.playMetallicSlide(vol * 0.4, now, 0.12, 700, 250);

    // Draw new weapon - ascending slide
    this.playMetallicSlide(vol * 0.5, now + 0.18, 0.1, 250, 800);

    // Weapon ready click
    this.playMechanicalClick(vol * 0.65, now + 0.32);
  }

  // ============================================================================
  // WEAPON EQUIP (Distinct from switch - when weapon becomes ready)
  // ============================================================================

  /**
   * Weapon equip sound - weapon-specific ready sounds
   */
  playWeaponEquip(weaponId: WeaponId, volume = 0.4): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    switch (weaponId) {
      case 'assault_rifle':
        this.playAssaultRifleEquip(vol, now);
        break;
      case 'pulse_smg':
        this.playSMGEquip(vol, now);
        break;
      case 'plasma_cannon':
        this.playPlasmaCannonEquip(vol, now);
        break;
    }
  }

  private playAssaultRifleEquip(volume: number, time: number): void {
    const ctx = this.getContext();

    // Bolt chamber sound
    this.playMetallicSlide(volume * 0.5, time, 0.1, 300, 700);

    // Heavy bolt slam
    const slam = ctx.createOscillator();
    slam.type = 'triangle';
    slam.frequency.setValueAtTime(300, time + 0.12);
    slam.frequency.exponentialRampToValueAtTime(100, time + 0.18);

    const slamGain = ctx.createGain();
    slamGain.gain.setValueAtTime(volume * 0.6, time + 0.12);
    slamGain.gain.exponentialRampToValueAtTime(0.01, time + 0.22);

    slam.connect(slamGain);
    slamGain.connect(this.dryGain!);

    slam.start(time + 0.12);
    slam.stop(time + 0.25);

    // Ready click
    this.playMechanicalClick(volume * 0.5, time + 0.2);
  }

  private playSMGEquip(volume: number, time: number): void {
    const ctx = this.getContext();

    // Quick slide
    this.playMetallicSlide(volume * 0.45, time, 0.08, 400, 900);

    // Light electronic chirp
    const chirp = ctx.createOscillator();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(600, time + 0.1);
    chirp.frequency.setValueAtTime(900, time + 0.13);

    const chirpGain = ctx.createGain();
    chirpGain.gain.setValueAtTime(volume * 0.3, time + 0.1);
    chirpGain.gain.exponentialRampToValueAtTime(0.01, time + 0.16);

    chirp.connect(chirpGain);
    chirpGain.connect(this.dryGain!);

    chirp.start(time + 0.1);
    chirp.stop(time + 0.18);

    // Quick click
    this.playMechanicalClick(volume * 0.4, time + 0.12);
  }

  private playPlasmaCannonEquip(volume: number, time: number): void {
    const ctx = this.getContext();

    // Heavy weapon handling sound
    this.playMetallicSlide(volume * 0.4, time, 0.15, 200, 500);

    // Power-up sequence
    const powerUp = ctx.createOscillator();
    powerUp.type = 'sine';
    powerUp.frequency.setValueAtTime(80, time + 0.2);
    powerUp.frequency.exponentialRampToValueAtTime(350, time + 0.6);

    const powerUpGain = ctx.createGain();
    powerUpGain.gain.setValueAtTime(0, time + 0.2);
    powerUpGain.gain.linearRampToValueAtTime(volume * 0.35, time + 0.4);
    powerUpGain.gain.exponentialRampToValueAtTime(0.01, time + 0.7);

    powerUp.connect(powerUpGain);
    powerUpGain.connect(this.dryGain!);

    powerUp.start(time + 0.2);
    powerUp.stop(time + 0.75);

    // Ready beep
    this.playReadyBeep(volume * 0.45, time + 0.65);
  }

  // ============================================================================
  // IMPACT SOUNDS
  // ============================================================================

  /**
   * Bullet impact on different surfaces
   */
  playImpact(surface: ImpactSurface = 'default', volume = 0.3, distance = 0): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = this.applyDistanceFalloff(volume * this.masterVolume, distance);

    switch (surface) {
      case 'metal':
        this.playMetalImpact(vol, now);
        break;
      case 'concrete':
        this.playConcreteImpact(vol, now);
        break;
      case 'organic':
        this.playOrganicImpact(vol, now);
        break;
      case 'energy':
        this.playEnergyImpact(vol, now);
        break;
      default:
        this.playDefaultImpact(vol, now);
    }
  }

  private playMetalImpact(volume: number, time: number): void {
    const ctx = this.getContext();

    // Sharp ping
    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(3000 + Math.random() * 1000, time);
    ping.frequency.exponentialRampToValueAtTime(800, time + 0.08);

    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(volume * 0.6, time);
    pingGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    // Ricochet whine
    const ricochet = ctx.createOscillator();
    ricochet.type = 'sine';
    ricochet.frequency.setValueAtTime(1500, time);
    ricochet.frequency.exponentialRampToValueAtTime(4000, time + 0.05);
    ricochet.frequency.exponentialRampToValueAtTime(500, time + 0.15);

    const ricochetGain = ctx.createGain();
    ricochetGain.gain.setValueAtTime(volume * 0.3, time);
    ricochetGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    ping.connect(pingGain);
    pingGain.connect(this.dryGain!);
    pingGain.connect(this.reverbNode!);

    ricochet.connect(ricochetGain);
    ricochetGain.connect(this.dryGain!);

    ping.start(time);
    ping.stop(time + 0.12);
    ricochet.start(time);
    ricochet.stop(time + 0.17);
  }

  private playConcreteImpact(volume: number, time: number): void {
    const ctx = this.getContext();

    // Thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(200, time);
    thud.frequency.exponentialRampToValueAtTime(60, time + 0.08);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume * 0.7, time);
    thudGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    // Debris noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    thud.connect(thudGain);
    thudGain.connect(this.dryGain!);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.dryGain!);

    thud.start(time);
    thud.stop(time + 0.12);
    noise.start(time);
    noise.stop(time + 0.1);
  }

  private playOrganicImpact(volume: number, time: number): void {
    const ctx = this.getContext();

    // Wet splat
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + 0.1);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain!);

    noise.start(time);
    noise.stop(time + 0.13);
  }

  private playEnergyImpact(volume: number, time: number): void {
    const ctx = this.getContext();

    // Energy crackle
    const crackle = ctx.createOscillator();
    crackle.type = 'sawtooth';
    crackle.frequency.setValueAtTime(2000, time);
    crackle.frequency.exponentialRampToValueAtTime(500, time + 0.05);

    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(volume * 0.5, time);
    crackleGain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);

    // Bass thump
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(150, time);
    bass.frequency.exponentialRampToValueAtTime(50, time + 0.1);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(volume * 0.6, time);
    bassGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    crackle.connect(crackleGain);
    crackleGain.connect(this.dryGain!);

    bass.connect(bassGain);
    bassGain.connect(this.dryGain!);

    crackle.start(time);
    crackle.stop(time + 0.08);
    bass.start(time);
    bass.stop(time + 0.14);
  }

  private playDefaultImpact(volume: number, time: number): void {
    const ctx = this.getContext();

    // Generic thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    osc.connect(gain);
    gain.connect(this.dryGain!);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  // ============================================================================
  // FEEDBACK SOUNDS
  // ============================================================================

  /**
   * Hit marker sound - confirms damage dealt
   */
  playHitMarker(volume = 0.25): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Sharp double-tick
    const tick1 = ctx.createOscillator();
    tick1.type = 'sine';
    tick1.frequency.value = 1200;

    const tick1Gain = ctx.createGain();
    tick1Gain.gain.setValueAtTime(vol, now);
    tick1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    const tick2 = ctx.createOscillator();
    tick2.type = 'sine';
    tick2.frequency.value = 1600;

    const tick2Gain = ctx.createGain();
    tick2Gain.gain.setValueAtTime(vol * 0.8, now + 0.025);
    tick2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.055);

    tick1.connect(tick1Gain);
    tick1Gain.connect(this.dryGain!);

    tick2.connect(tick2Gain);
    tick2Gain.connect(this.dryGain!);

    tick1.start(now);
    tick1.stop(now + 0.04);
    tick2.start(now + 0.025);
    tick2.stop(now + 0.065);
  }

  /**
   * Headshot indicator - higher pitched, more satisfying
   */
  playHeadshot(volume = 0.35): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Ascending ding
    const ding = ctx.createOscillator();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(1500, now);
    ding.frequency.setValueAtTime(2000, now + 0.03);
    ding.frequency.setValueAtTime(2400, now + 0.06);

    const dingGain = ctx.createGain();
    dingGain.gain.setValueAtTime(vol, now);
    dingGain.gain.linearRampToValueAtTime(vol * 0.8, now + 0.05);
    dingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    // Crispy high end
    const crisp = ctx.createOscillator();
    crisp.type = 'triangle';
    crisp.frequency.value = 4000;

    const crispGain = ctx.createGain();
    crispGain.gain.setValueAtTime(vol * 0.3, now);
    crispGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    ding.connect(dingGain);
    dingGain.connect(this.dryGain!);

    crisp.connect(crispGain);
    crispGain.connect(this.dryGain!);

    ding.start(now);
    ding.stop(now + 0.17);
    crisp.start(now);
    crisp.stop(now + 0.06);
  }

  /**
   * Kill confirmation - satisfying "ding" or "clunk"
   */
  playKillConfirmation(volume = 0.4): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const vol = volume * this.masterVolume;

    // Deep satisfying "donk"
    const donk = ctx.createOscillator();
    donk.type = 'sine';
    donk.frequency.setValueAtTime(400, now);
    donk.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const donkGain = ctx.createGain();
    donkGain.gain.setValueAtTime(vol, now);
    donkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    // High accent
    const accent = ctx.createOscillator();
    accent.type = 'sine';
    accent.frequency.setValueAtTime(1800, now);
    accent.frequency.setValueAtTime(1400, now + 0.03);

    const accentGain = ctx.createGain();
    accentGain.gain.setValueAtTime(vol * 0.5, now);
    accentGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    donk.connect(donkGain);
    donkGain.connect(this.dryGain!);

    accent.connect(accentGain);
    accentGain.connect(this.dryGain!);

    donk.start(now);
    donk.stop(now + 0.18);
    accent.start(now);
    accent.stop(now + 0.1);
  }

  /**
   * Damage dealt feedback - subtle confirmation of damage
   */
  playDamageDealt(damage: number, volume = 0.2): void {
    if (this.isMuted) return;

    // Scale feedback based on damage
    const intensity = Math.min(1, damage / 50);

    if (intensity > 0.8) {
      // High damage - play more prominent feedback
      this.playHitMarker(volume * 1.2);
    } else if (intensity > 0.5) {
      this.playHitMarker(volume);
    } else {
      this.playHitMarker(volume * 0.7);
    }
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
  // CLEANUP
  // ============================================================================

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.masterGain = null;
    this.reverbNode = null;
    this.dryGain = null;
    this.wetGain = null;
    this.lastFireTimes.clear();
    this.variationIndex.clear();
    WeaponSoundManager.instance = null;
  }
}

// Singleton accessor
export const weaponSoundManager = WeaponSoundManager.getInstance();
