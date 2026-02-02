/**
 * Weapon Sound Generators
 * Procedural audio for weapons (laser shots, impacts, mechs, explosions)
 *
 * This module provides comprehensive procedural audio for all weapon types:
 * - Pistol: Punchy transient with short decay
 * - Assault Rifle: Rapid pops with pitch variation
 * - Shotgun: Low boom + high crack, wide stereo
 * - Sniper: Supersonic crack with reverb tail
 * - Plasma: Sci-fi FM synthesis with frequency modulation
 * - Rocket: Launch rumble + doppler effect
 * - Melee: Whoosh + impact thud
 */

import { FREQUENCIES } from '../constants';

/**
 * Weapon Sound Generator class
 * Generates procedural sounds for weapon-related effects
 */
export class WeaponSoundGenerator {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Generate a laser/plasma shot sound
   */
  generateLaserShot(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Oscillator for the main tone
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(FREQUENCIES.laserBase, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    // High frequency component for "zap" effect
    const oscHigh = ctx.createOscillator();
    oscHigh.type = 'square';
    oscHigh.frequency.setValueAtTime(FREQUENCIES.laserHigh, now);
    oscHigh.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    // Noise for texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Filter for noise
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 2;

    // Gain envelopes
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    const highGain = ctx.createGain();
    highGain.gain.setValueAtTime(volume * 0.4, now);
    highGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    // Connect
    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    oscHigh.connect(highGain);
    highGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Play
    osc.start(now);
    osc.stop(now + 0.2);
    oscHigh.start(now);
    oscHigh.stop(now + 0.1);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  /**
   * Generate hit marker sound
   */
  generateHitMarker(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1800, now + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Generate damage/hurt sound
   */
  generateDamage(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    // Distortion
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    distortion.curve = curve;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Generate footstep sound
   */
  generateFootstep(volume = 0.15): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100 + Math.random() * 30, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

    // Noise component
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  /**
   * Generate mech footstep
   */
  generateMechStep(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Heavy impact
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIES.mechStepBase, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    // Metal clang
    const clang = ctx.createOscillator();
    clang.type = 'triangle';
    clang.frequency.setValueAtTime(200, now);
    clang.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    // Noise for debris
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const clangGain = ctx.createGain();
    clangGain.gain.setValueAtTime(volume * 0.3, now);
    clangGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    clang.connect(clangGain);
    clangGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
    clang.start(now);
    clang.stop(now + 0.2);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  /**
   * Generate mech autocannon fire
   */
  generateMechFire(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Heavy thump
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(FREQUENCIES.mechFireBase, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    // High crack
    const crack = ctx.createOscillator();
    crack.type = 'square';
    crack.frequency.setValueAtTime(1500, now);
    crack.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    // Noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(volume * 0.4, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    crack.connect(crackGain);
    crackGain.connect(ctx.destination);

    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
    crack.start(now);
    crack.stop(now + 0.08);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  /**
   * Generate explosion
   */
  generateExplosion(volume = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low boom
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(FREQUENCIES.explosionBass, now);
    boom.frequency.exponentialRampToValueAtTime(20, now + 0.4);

    // Mid rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(FREQUENCIES.explosionRumble, now);
    rumble.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    // Noise for debris
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(4000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.5);

    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(volume, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(volume * 0.5, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    boom.connect(boomGain);
    boomGain.connect(ctx.destination);

    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    boom.start(now);
    boom.stop(now + 0.6);
    rumble.start(now);
    rumble.stop(now + 0.5);
    noise.start(now);
    noise.stop(now + 0.55);
  }

  /**
   * Generate melee swing whoosh sound
   */
  generateMeleeSwing(volume = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Whoosh noise - filtered noise sweep
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for whoosh character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    filter.Q.value = 1.5;

    // Low frequency component for weight
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    // Gain envelopes
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    // Connect
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.2);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Generate melee impact thud sound
   */
  generateMeleeImpact(volume = 0.7): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Heavy thud - low frequency impact
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    // Mid punch for body
    const punch = ctx.createOscillator();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(200, now);
    punch.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    // Noise burst for impact texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Lowpass filter for meaty sound
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    // Distortion for punch
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2);
    }
    distortion.curve = curve;

    // Gain envelopes
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(volume * 0.6, now);
    punchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    // Connect
    thud.connect(distortion);
    distortion.connect(thudGain);
    thudGain.connect(ctx.destination);

    punch.connect(punchGain);
    punchGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Play
    thud.start(now);
    thud.stop(now + 0.25);
    punch.start(now);
    punch.stop(now + 0.12);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  // ============================================================================
  // ENHANCED WEAPON SOUNDS - Individual weapon type audio
  // ============================================================================

  /**
   * Generate pistol fire - punchy transient, short decay
   */
  generatePistolFire(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Sharp noise transient
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    // Low body thump
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(120, now);
    body.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(volume * 0.4, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Connect
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.08);
    body.start(now);
    body.stop(now + 0.12);
  }

  /**
   * Generate assault rifle fire - rapid pops with pitch variation
   */
  generateAssaultRifleFire(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.1;

    // Sharp pop
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 4000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    // Low punch
    const punch = ctx.createOscillator();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(150 * pitchVariation, now);
    punch.frequency.exponentialRampToValueAtTime(60, now + 0.05);

    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(volume * 0.3, now);
    punchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    // Connect
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    punch.connect(punchGain);
    punchGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.05);
    punch.start(now);
    punch.stop(now + 0.07);
  }

  /**
   * Generate shotgun fire - low boom + high crack, wide stereo
   */
  generateShotgunFire(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep boom
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(60, now);
    boom.frequency.exponentialRampToValueAtTime(20, now + 0.3);

    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(volume, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    // High crack noise
    const crackBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = Math.random() * 2 - 1;
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuffer;

    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 5000;

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(volume * 0.6, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Stereo spread layers
    const leftBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const leftData = leftBuffer.getChannelData(0);
    for (let i = 0; i < leftData.length; i++) {
      leftData[i] = Math.random() * 2 - 1;
    }
    const leftNoise = ctx.createBufferSource();
    leftNoise.buffer = leftBuffer;

    const leftPanner = ctx.createStereoPanner();
    leftPanner.pan.value = -0.7;

    const leftGain = ctx.createGain();
    leftGain.gain.setValueAtTime(volume * 0.25, now);
    leftGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    const rightBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const rightData = rightBuffer.getChannelData(0);
    for (let i = 0; i < rightData.length; i++) {
      rightData[i] = Math.random() * 2 - 1;
    }
    const rightNoise = ctx.createBufferSource();
    rightNoise.buffer = rightBuffer;

    const rightPanner = ctx.createStereoPanner();
    rightPanner.pan.value = 0.7;

    const rightGain = ctx.createGain();
    rightGain.gain.setValueAtTime(volume * 0.25, now);
    rightGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Connect
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);

    leftNoise.connect(leftGain);
    leftGain.connect(leftPanner);
    leftPanner.connect(ctx.destination);

    rightNoise.connect(rightGain);
    rightGain.connect(rightPanner);
    rightPanner.connect(ctx.destination);

    // Play
    boom.start(now);
    boom.stop(now + 0.4);
    crack.start(now);
    crack.stop(now + 0.12);
    leftNoise.start(now + 0.01);
    leftNoise.stop(now + 0.15);
    rightNoise.start(now + 0.01);
    rightNoise.stop(now + 0.15);
  }

  /**
   * Generate sniper fire - supersonic crack with long reverb tail
   */
  generateSniperFire(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Supersonic crack
    const crackBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = Math.random() * 2 - 1;
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuffer;

    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 8000;

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(volume * 0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    // Low thump
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(80, now);
    thump.frequency.exponentialRampToValueAtTime(25, now + 0.15);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(volume * 0.5, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Tail/reverb simulation (decaying noise)
    const tailBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const tailData = tailBuffer.getChannelData(0);
    for (let i = 0; i < tailData.length; i++) {
      const decay = Math.exp(-i / (ctx.sampleRate * 0.2));
      tailData[i] = (Math.random() * 2 - 1) * decay;
    }
    const tail = ctx.createBufferSource();
    tail.buffer = tailBuffer;

    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.setValueAtTime(4000, now);
    tailFilter.frequency.exponentialRampToValueAtTime(500, now + 0.6);

    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(volume * 0.3, now);
    tailGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    // High-frequency "zing"
    const zing = ctx.createOscillator();
    zing.type = 'sine';
    zing.frequency.setValueAtTime(3000, now + 0.01);
    zing.frequency.exponentialRampToValueAtTime(2000, now + 0.1);

    const zingGain = ctx.createGain();
    zingGain.gain.setValueAtTime(volume * 0.15, now + 0.01);
    zingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Connect
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);

    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);

    tail.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);

    zing.connect(zingGain);
    zingGain.connect(ctx.destination);

    // Play
    crack.start(now);
    crack.stop(now + 0.05);
    thump.start(now);
    thump.stop(now + 0.25);
    tail.start(now);
    tail.stop(now + 0.9);
    zing.start(now + 0.01);
    zing.stop(now + 0.12);
  }

  /**
   * Generate plasma fire - sci-fi whoosh with frequency modulation
   */
  generatePlasmaFire(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Main carrier oscillator
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(300, now);
    carrier.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    carrier.frequency.exponentialRampToValueAtTime(200, now + 0.25);

    // Modulator for FM effect
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = 200;

    const modGain = ctx.createGain();
    modGain.gain.value = 100;

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Filter sweep
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    filter.Q.value = 3;

    const carrierGain = ctx.createGain();
    carrierGain.gain.setValueAtTime(0, now);
    carrierGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);
    carrierGain.gain.setValueAtTime(volume * 0.35, now + 0.15);
    carrierGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    // Sizzle noise
    const sizzleBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const sizzleData = sizzleBuffer.getChannelData(0);
    for (let i = 0; i < sizzleData.length; i++) {
      sizzleData[i] = Math.random() * 2 - 1;
    }
    const sizzle = ctx.createBufferSource();
    sizzle.buffer = sizzleBuffer;

    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'bandpass';
    sizzleFilter.frequency.value = 3000;
    sizzleFilter.Q.value = 3;

    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(volume * 0.2, now);
    sizzleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Connect
    carrier.connect(filter);
    filter.connect(carrierGain);
    carrierGain.connect(ctx.destination);

    sizzle.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(ctx.destination);

    // Play
    modulator.start(now);
    modulator.stop(now + 0.35);
    carrier.start(now);
    carrier.stop(now + 0.35);
    sizzle.start(now);
    sizzle.stop(now + 0.25);
  }

  /**
   * Generate rocket launch - rumble + doppler
   */
  generateRocketLaunch(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Ignition whoosh
    const ignitionBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const ignitionData = ignitionBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < ignitionData.length; i++) {
      const white = Math.random() * 2 - 1;
      ignitionData[i] = (lastOut + 0.02 * white) / 1.02; // Brown noise
      lastOut = ignitionData[i];
      ignitionData[i] *= 3.5;
    }
    const ignition = ctx.createBufferSource();
    ignition.buffer = ignitionBuffer;

    const ignitionFilter = ctx.createBiquadFilter();
    ignitionFilter.type = 'lowpass';
    ignitionFilter.frequency.value = 800;

    const ignitionGain = ctx.createGain();
    ignitionGain.gain.setValueAtTime(0, now);
    ignitionGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.05);
    ignitionGain.gain.setValueAtTime(volume * 0.45, now + 0.25);
    ignitionGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Motor rumble with doppler (descending pitch)
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(65, now);
    motor.frequency.exponentialRampToValueAtTime(45, now + 0.3);

    const motor2 = ctx.createOscillator();
    motor2.type = 'sawtooth';
    motor2.frequency.setValueAtTime(67, now);
    motor2.frequency.exponentialRampToValueAtTime(47, now + 0.3);

    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 200;

    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(volume * 0.3, now);
    motorGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    // Connect
    ignition.connect(ignitionFilter);
    ignitionFilter.connect(ignitionGain);
    ignitionGain.connect(ctx.destination);

    motor.connect(motorFilter);
    motor2.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    // Play
    ignition.start(now);
    ignition.stop(now + 0.45);
    motor.start(now);
    motor.stop(now + 0.4);
    motor2.start(now);
    motor2.stop(now + 0.4);
  }

  /**
   * Generate grenade throw whoosh
   */
  generateGrenadeThrow(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Whoosh
    const whooshBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const whooshData = whooshBuffer.getChannelData(0);
    for (let i = 0; i < whooshData.length; i++) {
      whooshData[i] = Math.random() * 2 - 1;
    }
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = whooshBuffer;

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(500, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
    whooshFilter.frequency.exponentialRampToValueAtTime(800, now + 0.18);
    whooshFilter.Q.value = 2;

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.01, now);
    whooshGain.gain.linearRampToValueAtTime(volume, now + 0.03);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    // Connect
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);

    // Play
    whoosh.start(now);
    whoosh.stop(now + 0.22);
  }

  /**
   * Generate grenade explosion
   */
  generateGrenadeExplosion(volume = 0.55): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep bass impact
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(70, now);
    boom.frequency.exponentialRampToValueAtTime(25, now + 0.35);

    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(volume, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Mid rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(120, now);
    rumble.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 200;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(volume * 0.4, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    // Debris noise
    const debrisBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const debrisData = debrisBuffer.getChannelData(0);
    for (let i = 0; i < debrisData.length; i++) {
      debrisData[i] = Math.random() * 2 - 1;
    }
    const debris = ctx.createBufferSource();
    debris.buffer = debrisBuffer;

    const debrisFilter = ctx.createBiquadFilter();
    debrisFilter.type = 'lowpass';
    debrisFilter.frequency.setValueAtTime(4000, now);
    debrisFilter.frequency.exponentialRampToValueAtTime(300, now + 0.45);

    const debrisGain = ctx.createGain();
    debrisGain.gain.setValueAtTime(volume * 0.6, now);
    debrisGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    // Connect
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    debris.connect(debrisFilter);
    debrisFilter.connect(debrisGain);
    debrisGain.connect(ctx.destination);

    // Play
    boom.start(now);
    boom.stop(now + 0.45);
    rumble.start(now);
    rumble.stop(now + 0.4);
    debris.start(now);
    debris.stop(now + 0.55);
  }

  /**
   * Generate reload sound - mechanical clicks and clatter
   */
  generateReloadSound(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Magazine release click
    const click1 = ctx.createOscillator();
    click1.type = 'square';
    click1.frequency.setValueAtTime(2000, now);
    click1.frequency.exponentialRampToValueAtTime(500, now + 0.02);

    const click1Gain = ctx.createGain();
    click1Gain.gain.setValueAtTime(volume, now);
    click1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    // Magazine clatter
    const clatterBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const clatterData = clatterBuffer.getChannelData(0);
    for (let i = 0; i < clatterData.length; i++) {
      clatterData[i] = Math.random() * 2 - 1;
    }
    const clatter = ctx.createBufferSource();
    clatter.buffer = clatterBuffer;

    const clatterFilter = ctx.createBiquadFilter();
    clatterFilter.type = 'bandpass';
    clatterFilter.frequency.value = 1500;
    clatterFilter.Q.value = 2;

    const clatterGain = ctx.createGain();
    clatterGain.gain.setValueAtTime(volume * 0.4, now + 0.15);
    clatterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    // Magazine insert click
    const click2 = ctx.createOscillator();
    click2.type = 'square';
    click2.frequency.setValueAtTime(1500, now + 0.35);
    click2.frequency.exponentialRampToValueAtTime(600, now + 0.37);

    const click2Gain = ctx.createGain();
    click2Gain.gain.setValueAtTime(volume * 0.8, now + 0.35);
    click2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    // Slide/bolt sound
    const slideBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const slideData = slideBuffer.getChannelData(0);
    for (let i = 0; i < slideData.length; i++) {
      slideData[i] = Math.random() * 2 - 1;
    }
    const slide = ctx.createBufferSource();
    slide.buffer = slideBuffer;

    const slideFilter = ctx.createBiquadFilter();
    slideFilter.type = 'bandpass';
    slideFilter.frequency.value = 2000;
    slideFilter.Q.value = 3;

    const slideGain = ctx.createGain();
    slideGain.gain.setValueAtTime(volume * 0.5, now + 0.5);
    slideGain.gain.exponentialRampToValueAtTime(0.01, now + 0.58);

    // Connect
    click1.connect(click1Gain);
    click1Gain.connect(ctx.destination);

    clatter.connect(clatterFilter);
    clatterFilter.connect(clatterGain);
    clatterGain.connect(ctx.destination);

    click2.connect(click2Gain);
    click2Gain.connect(ctx.destination);

    slide.connect(slideFilter);
    slideFilter.connect(slideGain);
    slideGain.connect(ctx.destination);

    // Play
    click1.start(now);
    click1.stop(now + 0.05);
    clatter.start(now + 0.15);
    clatter.stop(now + 0.25);
    click2.start(now + 0.35);
    click2.stop(now + 0.4);
    slide.start(now + 0.5);
    slide.stop(now + 0.6);
  }

  /**
   * Generate weapon switch sound
   */
  generateWeaponSwitch(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Holster sound
    const holster = ctx.createOscillator();
    holster.type = 'triangle';
    holster.frequency.setValueAtTime(400, now);
    holster.frequency.exponentialRampToValueAtTime(150, now + 0.05);

    const holsterGain = ctx.createGain();
    holsterGain.gain.setValueAtTime(volume * 0.6, now);
    holsterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Draw sound
    const draw = ctx.createOscillator();
    draw.type = 'triangle';
    draw.frequency.setValueAtTime(200, now + 0.12);
    draw.frequency.exponentialRampToValueAtTime(500, now + 0.17);

    const drawGain = ctx.createGain();
    drawGain.gain.setValueAtTime(0, now + 0.12);
    drawGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.14);
    drawGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Metal clatter
    const clatterBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const clatterData = clatterBuffer.getChannelData(0);
    for (let i = 0; i < clatterData.length; i++) {
      clatterData[i] = Math.random() * 2 - 1;
    }
    const clatter = ctx.createBufferSource();
    clatter.buffer = clatterBuffer;

    const clatterFilter = ctx.createBiquadFilter();
    clatterFilter.type = 'highpass';
    clatterFilter.frequency.value = 2000;

    const clatterGain = ctx.createGain();
    clatterGain.gain.setValueAtTime(volume * 0.3, now + 0.15);
    clatterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.19);

    // Connect
    holster.connect(holsterGain);
    holsterGain.connect(ctx.destination);

    draw.connect(drawGain);
    drawGain.connect(ctx.destination);

    clatter.connect(clatterFilter);
    clatterFilter.connect(clatterGain);
    clatterGain.connect(ctx.destination);

    // Play
    holster.start(now);
    holster.stop(now + 0.1);
    draw.start(now + 0.12);
    draw.stop(now + 0.22);
    clatter.start(now + 0.15);
    clatter.stop(now + 0.2);
  }

  /**
   * Generate empty click sound
   */
  generateEmptyClick(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(1000, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.02);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    click.connect(clickGain);
    clickGain.connect(ctx.destination);

    click.start(now);
    click.stop(now + 0.05);
  }

  /**
   * Dispose of audio context
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
