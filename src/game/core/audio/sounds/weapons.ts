/**
 * Weapon Sound Generators
 * Procedural audio for weapons (laser shots, impacts, mechs, explosions)
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
   * Dispose of audio context
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
