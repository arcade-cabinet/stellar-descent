/**
 * ProceduralSFX - Production-quality procedural sound effects using Tone.js
 *
 * Generates complete weapon, enemy, UI, and environmental sounds entirely
 * through synthesis - no audio samples required.
 *
 * Features:
 * - Weapon sounds with proper attack transients and decay tails
 * - Enemy vocalizations with organic modulation
 * - UI feedback sounds with satisfying tonal qualities
 * - Instrument pooling for performance
 * - Proper gain staging and limiting
 */

import * as Tone from 'tone';

// ============================================================================
// TYPES
// ============================================================================

export type WeaponType =
  | 'pistol'
  | 'assault_rifle'
  | 'shotgun'
  | 'sniper'
  | 'plasma'
  | 'rocket'
  | 'melee';

export type EnemyType = 'skitterer' | 'spitter' | 'warrior' | 'heavy' | 'queen';

export type UISoundType =
  | 'hover'
  | 'select'
  | 'objective_complete'
  | 'pickup'
  | 'low_health'
  | 'shield_break';

// ============================================================================
// PROCEDURAL SFX ENGINE
// ============================================================================

export class ProceduralSFX {
  private isInitialized = false;
  private masterGain!: Tone.Gain;
  private limiter!: Tone.Limiter;
  private sfxVolume = 0.7;

  // Synth pools for performance
  private noisePool: Tone.NoiseSynth[] = [];
  private metalPool: Tone.MetalSynth[] = [];
  private membranePool: Tone.MembraneSynth[] = [];
  private synthPool: Tone.Synth[] = [];
  private readonly POOL_SIZE = 4;

  // Low health heartbeat state
  private heartbeatLoop: Tone.Loop | null = null;
  private heartbeatGain: Tone.Gain | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Master output with limiting
    this.limiter = new Tone.Limiter(-3);
    this.masterGain = new Tone.Gain(this.sfxVolume);
    this.limiter.connect(this.masterGain);
    this.masterGain.toDestination();

    // Create synth pools
    for (let i = 0; i < this.POOL_SIZE; i++) {
      // Noise synths for impacts, explosions
      const noise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      });
      noise.connect(this.limiter);
      this.noisePool.push(noise);

      // Metal synths for shell casings, metallic hits
      const metal = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
        harmonicity: 5,
        modulationIndex: 20,
        resonance: 4000,
        octaves: 1.5,
      });
      metal.connect(this.limiter);
      this.metalPool.push(metal);

      // Membrane synths for bass impacts
      const membrane = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 },
      });
      membrane.connect(this.limiter);
      this.membranePool.push(membrane);

      // Regular synths for tonal sounds
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 },
      });
      synth.connect(this.limiter);
      this.synthPool.push(synth);
    }

    this.isInitialized = true;
  }

  // ============================================================================
  // WEAPON SOUNDS
  // ============================================================================

  /**
   * Play weapon fire sound
   */
  playWeaponFire(weapon: WeaponType): void {
    if (!this.isInitialized) return;

    switch (weapon) {
      case 'pistol':
        this.playPistolFire();
        break;
      case 'assault_rifle':
        this.playAssaultRifleFire();
        break;
      case 'shotgun':
        this.playShotgunFire();
        break;
      case 'sniper':
        this.playSniperFire();
        break;
      case 'plasma':
        this.playPlasmaFire();
        break;
      case 'rocket':
        this.playRocketFire();
        break;
      case 'melee':
        this.playMeleeSwing();
        break;
    }
  }

  /**
   * Pistol: Punchy transient, short decay using noise + sine
   */
  private playPistolFire(): void {
    const now = Tone.now();

    // Noise transient
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    });
    const noiseFilter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 2 });
    const noiseGain = new Tone.Gain(0.4);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.limiter);

    // Low body
    const body = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    });
    body.volume.value = -8;
    body.connect(this.limiter);

    noise.triggerAttackRelease('16n', now);
    body.triggerAttackRelease(120, '16n', now);

    // Cleanup
    setTimeout(() => {
      noise.dispose();
      noiseFilter.dispose();
      noiseGain.dispose();
      body.dispose();
    }, 200);
  }

  /**
   * Assault Rifle: Rapid pops with subtle pitch variation
   */
  private playAssaultRifleFire(): void {
    const now = Tone.now();
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.1;

    // Sharp pop
    const pop = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    });
    const popFilter = new Tone.Filter({ frequency: 4000, type: 'highpass' });
    const popGain = new Tone.Gain(0.35);
    pop.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.limiter);

    // Low punch
    const punch = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    });
    punch.volume.value = -10;
    punch.connect(this.limiter);

    pop.triggerAttackRelease('32n', now);
    punch.triggerAttackRelease(150 * pitchVariation, '32n', now);

    setTimeout(() => {
      pop.dispose();
      popFilter.dispose();
      popGain.dispose();
      punch.dispose();
    }, 150);
  }

  /**
   * Shotgun: Low boom + high crack, wide stereo
   */
  private playShotgunFire(): void {
    const now = Tone.now();

    // Low boom
    const boom = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.02, release: 0.15 },
    });
    boom.volume.value = -4;
    boom.connect(this.limiter);

    // High crack (noise burst)
    const crack = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    });
    const crackFilter = new Tone.Filter({ frequency: 5000, type: 'highpass' });
    const crackGain = new Tone.Gain(0.5);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.limiter);

    // Stereo spread using panner
    const leftNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 },
    });
    const leftPanner = new Tone.Panner(-0.7);
    const leftGain = new Tone.Gain(0.2);
    leftNoise.connect(leftPanner);
    leftPanner.connect(leftGain);
    leftGain.connect(this.limiter);

    const rightNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 },
    });
    const rightPanner = new Tone.Panner(0.7);
    const rightGain = new Tone.Gain(0.2);
    rightNoise.connect(rightPanner);
    rightPanner.connect(rightGain);
    rightGain.connect(this.limiter);

    boom.triggerAttackRelease(60, '8n', now);
    crack.triggerAttackRelease('16n', now);
    leftNoise.triggerAttackRelease('16n', now + 0.01);
    rightNoise.triggerAttackRelease('16n', now + 0.01);

    setTimeout(() => {
      boom.dispose();
      crack.dispose();
      crackFilter.dispose();
      crackGain.dispose();
      leftNoise.dispose();
      leftPanner.dispose();
      leftGain.dispose();
      rightNoise.dispose();
      rightPanner.dispose();
      rightGain.dispose();
    }, 400);
  }

  /**
   * Sniper: Supersonic crack with long reverb tail
   */
  private playSniperFire(): void {
    const now = Tone.now();

    // Sharp supersonic crack
    const crack = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    });
    const crackFilter = new Tone.Filter({ frequency: 8000, type: 'highpass' });
    const crackGain = new Tone.Gain(0.6);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);

    // Long reverb tail
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.7 });
    crackGain.connect(reverb);
    reverb.connect(this.limiter);

    // Low thump
    const thump = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0.01, release: 0.1 },
    });
    thump.volume.value = -6;
    thump.connect(this.limiter);

    // High-frequency "zing" for bullet passing
    const zing = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });
    zing.volume.value = -12;
    zing.connect(reverb);

    crack.triggerAttackRelease('32n', now);
    thump.triggerAttackRelease(80, '8n', now);
    zing.triggerAttackRelease(3000, '16n', now + 0.01);

    setTimeout(() => {
      crack.dispose();
      crackFilter.dispose();
      crackGain.dispose();
      reverb.dispose();
      thump.dispose();
      zing.dispose();
    }, 4000);
  }

  /**
   * Plasma: Sci-fi whoosh with frequency modulation
   */
  private playPlasmaFire(): void {
    const now = Tone.now();

    // FM synth for that sci-fi sound
    const plasma = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.3, release: 0.2 },
    });
    plasma.volume.value = -8;

    // Filter sweep
    const filter = new Tone.Filter({ frequency: 2000, type: 'lowpass' });
    plasma.connect(filter);
    filter.connect(this.limiter);

    // Sweep the filter
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.2);

    // Rising pitch for energy feel
    plasma.triggerAttack(300, now);
    plasma.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    plasma.triggerRelease(now + 0.25);

    // Sizzle noise
    const sizzle = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.1 },
    });
    const sizzleFilter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 3 });
    const sizzleGain = new Tone.Gain(0.2);
    sizzle.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(this.limiter);
    sizzle.triggerAttackRelease('8n', now);

    setTimeout(() => {
      plasma.dispose();
      filter.dispose();
      sizzle.dispose();
      sizzleFilter.dispose();
      sizzleGain.dispose();
    }, 500);
  }

  /**
   * Rocket: Launch rumble + doppler + explosion
   */
  playRocketFire(): void {
    const now = Tone.now();

    // Initial whoosh/ignition
    const ignition = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 },
    });
    const ignitionFilter = new Tone.Filter({ frequency: 800, type: 'lowpass' });
    const ignitionGain = new Tone.Gain(0.4);
    ignition.connect(ignitionFilter);
    ignitionFilter.connect(ignitionGain);
    ignitionGain.connect(this.limiter);

    // Rocket motor rumble
    const motor = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5 },
    });
    motor.volume.value = -10;

    // LFO for rumble
    const motorLfo = new Tone.LFO({ frequency: 15, min: 50, max: 80 });
    motorLfo.connect(motor.frequency);
    motor.connect(this.limiter);
    motorLfo.start(now);

    ignition.triggerAttackRelease('4n', now);
    motor.triggerAttackRelease(65, '4n', now);

    // Rising pitch for doppler effect
    motor.frequency.setValueAtTime(65, now);
    motor.frequency.exponentialRampToValueAtTime(45, now + 0.3);

    setTimeout(() => {
      ignition.dispose();
      ignitionFilter.dispose();
      ignitionGain.dispose();
      motor.dispose();
      motorLfo.dispose();
    }, 800);
  }

  /**
   * Rocket explosion (called on impact)
   */
  playExplosion(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Deep bass boom
    const boom = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.02, release: 0.3 },
    });
    boom.volume.value = -2;
    boom.connect(this.limiter);

    // Mid rumble
    const rumble = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 },
    });
    rumble.volume.value = -8;
    const rumbleFilter = new Tone.Filter({ frequency: 200, type: 'lowpass' });
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(this.limiter);

    // Debris noise
    const debris = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 0.3 },
    });
    const debrisFilter = new Tone.Filter({ frequency: 3000, type: 'lowpass' });
    debrisFilter.frequency.setValueAtTime(3000, now);
    debrisFilter.frequency.exponentialRampToValueAtTime(500, now + 0.5);
    const debrisGain = new Tone.Gain(0.4);
    debris.connect(debrisFilter);
    debrisFilter.connect(debrisGain);
    debrisGain.connect(this.limiter);

    boom.triggerAttackRelease(50, '4n', now);
    rumble.triggerAttackRelease(80, '4n', now);
    debris.triggerAttackRelease('4n', now);

    setTimeout(() => {
      boom.dispose();
      rumble.dispose();
      rumbleFilter.dispose();
      debris.dispose();
      debrisFilter.dispose();
      debrisGain.dispose();
    }, 1000);
  }

  /**
   * Melee: Whoosh + impact thud
   */
  private playMeleeSwing(): void {
    const now = Tone.now();

    // Whoosh (filtered noise sweep)
    const whoosh = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.05 },
    });
    const whooshFilter = new Tone.Filter({ frequency: 400, type: 'bandpass', Q: 2 });
    whooshFilter.frequency.setValueAtTime(400, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
    whooshFilter.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    const whooshGain = new Tone.Gain(0.35);
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(this.limiter);

    // Low weight component
    const weight = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
    });
    weight.volume.value = -10;
    weight.connect(this.limiter);

    whoosh.triggerAttackRelease('8n', now);
    weight.triggerAttackRelease(80, '8n', now);

    setTimeout(() => {
      whoosh.dispose();
      whooshFilter.dispose();
      whooshGain.dispose();
      weight.dispose();
    }, 300);
  }

  /**
   * Melee impact sound
   */
  playMeleeImpact(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Heavy thud
    const thud = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 },
    });
    thud.volume.value = -4;
    thud.connect(this.limiter);

    // Impact noise
    const impact = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
    });
    const impactFilter = new Tone.Filter({ frequency: 1500, type: 'lowpass' });
    const impactGain = new Tone.Gain(0.3);
    impact.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(this.limiter);

    thud.triggerAttackRelease(100, '8n', now);
    impact.triggerAttackRelease('16n', now);

    setTimeout(() => {
      thud.dispose();
      impact.dispose();
      impactFilter.dispose();
      impactGain.dispose();
    }, 300);
  }

  // ============================================================================
  // ENEMY SOUNDS
  // ============================================================================

  /**
   * Skitterer: Chittering using granular synthesis on noise
   */
  playSkittererChitter(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Rapid clicking
    const clickCount = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < clickCount; i++) {
      const clickTime = now + i * 0.025 + Math.random() * 0.01;
      const click = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
      });
      click.volume.value = -14 + Math.random() * 4;
      click.connect(this.limiter);
      click.triggerAttackRelease(600 + Math.random() * 400, '64n', clickTime);
      setTimeout(() => click.dispose(), 200);
    }
  }

  /**
   * Spitter: Wet gurgle using filtered noise + formants
   */
  playSpitterGurgle(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Wet bubbling noise
    const gurgle = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.2 },
    });
    const gurgleFilter = new Tone.Filter({ frequency: 800, type: 'lowpass', Q: 4 });
    const gurgleLfo = new Tone.LFO({ frequency: 12, min: 400, max: 1000 });
    gurgleLfo.connect(gurgleFilter.frequency);
    const gurgleGain = new Tone.Gain(0.3);
    gurgle.connect(gurgleFilter);
    gurgleFilter.connect(gurgleGain);
    gurgleGain.connect(this.limiter);

    // Low growl
    const growl = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.3, release: 0.2 },
    });
    growl.volume.value = -12;
    const growlFilter = new Tone.Filter({ frequency: 200, type: 'lowpass' });
    growl.connect(growlFilter);
    growlFilter.connect(this.limiter);

    gurgleLfo.start(now);
    gurgle.triggerAttackRelease('4n', now);
    growl.triggerAttackRelease(70, '4n', now);

    setTimeout(() => {
      gurgle.dispose();
      gurgleFilter.dispose();
      gurgleLfo.dispose();
      gurgleGain.dispose();
      growl.dispose();
      growlFilter.dispose();
    }, 600);
  }

  /**
   * Warrior: Deep growl using low oscillators + distortion
   */
  playWarriorGrowl(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Deep growl oscillator
    const growl = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.3 },
    });
    growl.volume.value = -6;

    // Distortion for aggression
    const distortion = new Tone.Distortion({ distortion: 0.4, wet: 0.5 });

    // Formant filter
    const formant = new Tone.Filter({ frequency: 250, type: 'bandpass', Q: 4 });

    // LFO for organic warble
    const lfo = new Tone.LFO({ frequency: 8, min: 70, max: 90 });
    lfo.connect(growl.frequency);

    growl.connect(distortion);
    distortion.connect(formant);
    formant.connect(this.limiter);

    lfo.start(now);
    growl.triggerAttackRelease(80, '4n', now);

    setTimeout(() => {
      growl.dispose();
      distortion.dispose();
      formant.dispose();
      lfo.dispose();
    }, 500);
  }

  /**
   * Heavy: Mechanical rhythmic pulses + metal
   */
  playHeavyMechanical(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Motor whine
    const motor = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.3 },
    });
    motor.volume.value = -12;

    // Second motor (slightly detuned)
    const motor2 = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.3 },
    });
    motor2.volume.value = -12;

    const motorFilter = new Tone.Filter({ frequency: 500, type: 'lowpass' });
    motor.connect(motorFilter);
    motor2.connect(motorFilter);
    motorFilter.connect(this.limiter);

    motor.triggerAttackRelease(150, '4n', now);
    motor2.triggerAttackRelease(153, '4n', now);

    // Metallic clank
    const clank = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
      harmonicity: 8,
      modulationIndex: 15,
      resonance: 2000,
      octaves: 1,
    });
    clank.volume.value = -10;
    clank.connect(this.limiter);
    clank.triggerAttackRelease('16n', now + 0.05);

    setTimeout(() => {
      motor.dispose();
      motor2.dispose();
      motorFilter.dispose();
      clank.dispose();
    }, 500);
  }

  /**
   * Queen: Reverberant roar with layered oscillators
   */
  playQueenRoar(): void {
    if (!this.isInitialized) return;
    const now = Tone.now();

    // Massive low roar
    const roar = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.15, decay: 0.5, sustain: 0.7, release: 0.8 },
    });
    roar.volume.value = -4;

    // Sub bass
    const subBass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.8, release: 0.6 },
    });
    subBass.volume.value = -6;

    // Mid harmonic
    const mid = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.5, release: 0.5 },
    });
    mid.volume.value = -12;

    // Formant filter
    const formant = new Tone.Filter({ frequency: 250, type: 'bandpass', Q: 5 });
    formant.frequency.setValueAtTime(200, now);
    formant.frequency.linearRampToValueAtTime(350, now + 0.4);
    formant.frequency.linearRampToValueAtTime(180, now + 1);

    // Large reverb
    const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 });

    // LFO for organic vibrato
    const lfo = new Tone.LFO({ frequency: 5, min: 55, max: 65 });
    lfo.connect(roar.frequency);

    roar.connect(formant);
    formant.connect(reverb);
    subBass.connect(reverb);
    mid.connect(reverb);
    reverb.connect(this.limiter);

    lfo.start(now);
    roar.triggerAttackRelease(60, '1n', now);
    subBass.triggerAttackRelease(30, '1n', now);
    mid.triggerAttackRelease(120, '2n', now);

    setTimeout(() => {
      roar.dispose();
      subBass.dispose();
      mid.dispose();
      formant.dispose();
      reverb.dispose();
      lfo.dispose();
    }, 2000);
  }

  // ============================================================================
  // UI SOUNDS
  // ============================================================================

  /**
   * Play UI sound effect
   */
  playUISound(type: UISoundType): void {
    if (!this.isInitialized) return;

    switch (type) {
      case 'hover':
        this.playHover();
        break;
      case 'select':
        this.playSelect();
        break;
      case 'objective_complete':
        this.playObjectiveComplete();
        break;
      case 'pickup':
        this.playPickup();
        break;
      case 'low_health':
        this.startHeartbeat();
        break;
      case 'shield_break':
        this.playShieldBreak();
        break;
    }
  }

  /**
   * Menu hover: Soft click (short sine)
   */
  private playHover(): void {
    const now = Tone.now();
    const click = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    });
    click.volume.value = -16;
    click.connect(this.limiter);
    click.triggerAttackRelease(1200, '64n', now);
    setTimeout(() => click.dispose(), 100);
  }

  /**
   * Menu select: Confirmation beep (rising tone)
   */
  private playSelect(): void {
    const now = Tone.now();
    const beep = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 },
    });
    beep.volume.value = -10;
    beep.connect(this.limiter);

    beep.triggerAttack(600, now);
    beep.frequency.exponentialRampToValueAtTime(900, now + 0.08);
    beep.triggerRelease(now + 0.15);

    setTimeout(() => beep.dispose(), 300);
  }

  /**
   * Objective complete: Achievement jingle (major chord arpeggio)
   */
  private playObjectiveComplete(): void {
    const now = Tone.now();

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
    });
    synth.volume.value = -8;
    synth.connect(this.limiter);

    // C major arpeggio
    const notes = ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '8n', now + i * 0.1, 0.6);
    });

    // Final chord
    synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '4n', now + 0.5, 0.4);

    setTimeout(() => synth.dispose(), 1500);
  }

  /**
   * Pickup: Satisfying collect sound (sparkle + bass)
   */
  private playPickup(): void {
    const now = Tone.now();

    // Sparkle (high sine)
    const sparkle = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
    });
    sparkle.volume.value = -10;
    sparkle.connect(this.limiter);

    // Bass thump
    const bass = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.01, release: 0.05 },
    });
    bass.volume.value = -12;
    bass.connect(this.limiter);

    sparkle.triggerAttackRelease(1500, '16n', now);
    sparkle.triggerAttackRelease(2000, '16n', now + 0.05);
    sparkle.triggerAttackRelease(2500, '16n', now + 0.1);
    bass.triggerAttackRelease(200, '16n', now);

    setTimeout(() => {
      sparkle.dispose();
      bass.dispose();
    }, 300);
  }

  /**
   * Low health: Start heartbeat (LFO-modulated bass)
   */
  private startHeartbeat(): void {
    if (this.heartbeatLoop) return;

    this.heartbeatGain = new Tone.Gain(0.3);
    this.heartbeatGain.connect(this.limiter);

    const heart = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 3,
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.1 },
    });
    heart.volume.value = -8;
    heart.connect(this.heartbeatGain);

    // Double beat pattern
    let beatPhase = 0;
    this.heartbeatLoop = new Tone.Loop((time) => {
      if (beatPhase === 0) {
        heart.triggerAttackRelease(60, '16n', time);
      } else if (beatPhase === 1) {
        heart.triggerAttackRelease(50, '16n', time + 0.15);
      }
      beatPhase = (beatPhase + 1) % 4;
    }, '4n');

    this.heartbeatLoop.start();

    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * Stop heartbeat sound
   */
  stopHeartbeat(): void {
    if (this.heartbeatLoop) {
      this.heartbeatLoop.stop();
      this.heartbeatLoop.dispose();
      this.heartbeatLoop = null;
    }
    if (this.heartbeatGain) {
      this.heartbeatGain.dispose();
      this.heartbeatGain = null;
    }
  }

  /**
   * Shield break: Glass shatter (noise burst + resonance)
   */
  private playShieldBreak(): void {
    const now = Tone.now();

    // Shatter noise
    const shatter = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    });
    const shatterFilter = new Tone.Filter({ frequency: 4000, type: 'highpass' });
    shatterFilter.frequency.setValueAtTime(4000, now);
    shatterFilter.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    const shatterGain = new Tone.Gain(0.4);
    shatter.connect(shatterFilter);
    shatterFilter.connect(shatterGain);
    shatterGain.connect(this.limiter);

    // Resonant ring
    const ring = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
      harmonicity: 12,
      modulationIndex: 30,
      resonance: 3000,
      octaves: 1,
    });
    ring.volume.value = -12;
    ring.connect(this.limiter);

    // Low impact
    const impact = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0.01, release: 0.1 },
    });
    impact.volume.value = -10;
    impact.connect(this.limiter);

    shatter.triggerAttackRelease('8n', now);
    ring.triggerAttackRelease('8n', now);
    impact.triggerAttackRelease(150, '8n', now);

    setTimeout(() => {
      shatter.dispose();
      shatterFilter.dispose();
      shatterGain.dispose();
      ring.dispose();
      impact.dispose();
    }, 500);
  }

  // ============================================================================
  // VOLUME CONTROL
  // ============================================================================

  setVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(this.sfxVolume, 0.1);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.stopHeartbeat();

    for (const synth of this.noisePool) synth.dispose();
    for (const synth of this.metalPool) synth.dispose();
    for (const synth of this.membranePool) synth.dispose();
    for (const synth of this.synthPool) synth.dispose();

    this.noisePool = [];
    this.metalPool = [];
    this.membranePool = [];
    this.synthPool = [];

    this.masterGain?.dispose();
    this.limiter?.dispose();

    this.isInitialized = false;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let proceduralSFXInstance: ProceduralSFX | null = null;

export function getProceduralSFX(): ProceduralSFX {
  if (!proceduralSFXInstance) {
    proceduralSFXInstance = new ProceduralSFX();
  }
  return proceduralSFXInstance;
}

export function disposeProceduralSFX(): void {
  if (proceduralSFXInstance) {
    proceduralSFXInstance.dispose();
    proceduralSFXInstance = null;
  }
}
