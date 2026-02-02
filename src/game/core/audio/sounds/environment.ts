/**
 * Environment Sound Generators
 * Procedural audio for ambient sounds, drop sequences, and level atmospheres
 */

import { LFO_RATES } from '../constants';
import type { AudioLoopHandle, ProceduralAmbientType } from '../types';

/**
 * Environment Sound Generator class
 * Generates procedural sounds for environmental effects
 */
export class EnvironmentSoundGenerator {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Generate wind/atmospheric sound for drop sequence
   */
  generateDropWind(duration = 1, volume = 0.3): AudioLoopHandle {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Brown noise for wind
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      noiseData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = noiseData[i];
      noiseData[i] *= 3.5; // Compensate for volume drop
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Resonant filter for whistling effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);

    return {
      stop: () => {
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        setTimeout(() => noise.stop(), 600);
      },
    };
  }

  /**
   * Generate thrust/engine sound
   */
  generateThrustSound(volume = 0.25): AudioLoopHandle {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumble oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 60;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 62;

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    // LFO for wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.thrusterWobble;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.3);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    return {
      stop: () => {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        setTimeout(() => {
          osc1.stop();
          osc2.stop();
          lfo.stop();
        }, 600);
      },
    };
  }

  /**
   * Generate dropship engine sound (looping)
   */
  generateDropshipEngine(volume = 0.35): AudioLoopHandle {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low thruster rumble
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 80;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 83;

    // High whine
    const whine = ctx.createOscillator();
    whine.type = 'sine';
    whine.frequency.value = 800;

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    // LFO for thruster pulse
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.5);

    const whineGain = ctx.createGain();
    whineGain.gain.value = volume * 0.1;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(mainGain);
    whine.connect(whineGain);
    whineGain.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    whine.start(now);
    lfo.start(now);

    return {
      stop: () => {
        mainGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        setTimeout(() => {
          osc1.stop();
          osc2.stop();
          whine.stop();
          lfo.stop();
        }, 1100);
      },
    };
  }

  /**
   * Generate asteroid near-miss whoosh sound
   */
  generateNearMissWhoosh(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Main whoosh - filtered noise with pitch sweep (doppler effect)
    const bufferSize = ctx.sampleRate * 0.4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter that sweeps for doppler effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.35);
    filter.Q.value = 4;

    // Low rumble component for mass/weight feel
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(80, now);
    rumble.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    // High whistle component for air displacement
    const whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(800, now);
    whistle.frequency.exponentialRampToValueAtTime(2000, now + 0.08);
    whistle.frequency.exponentialRampToValueAtTime(400, now + 0.25);

    // Envelope gains
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.05);
    noiseGain.gain.linearRampToValueAtTime(volume, now + 0.12);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    const whistleGain = ctx.createGain();
    whistleGain.gain.setValueAtTime(0, now);
    whistleGain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.03);
    whistleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    // Stereo panning for spatial feel (random left or right)
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() > 0.5 ? -0.7 : 0.7;

    // Connect
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(panner);

    rumble.connect(rumbleGain);
    rumbleGain.connect(panner);

    whistle.connect(whistleGain);
    whistleGain.connect(panner);

    panner.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.45);
    rumble.start(now);
    rumble.stop(now + 0.4);
    whistle.start(now);
    whistle.stop(now + 0.3);
  }

  /**
   * Generate ice asteroid near-miss with crystalline undertone
   */
  generateIceNearMissWhoosh(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Base whoosh
    this.generateNearMissWhoosh(volume * 0.8);

    // Add crystalline shimmer
    const shimmer1 = ctx.createOscillator();
    shimmer1.type = 'sine';
    shimmer1.frequency.value = 2400 + Math.random() * 600;

    const shimmer2 = ctx.createOscillator();
    shimmer2.type = 'sine';
    shimmer2.frequency.value = 3200 + Math.random() * 800;

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.05);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    shimmer1.connect(shimmerGain);
    shimmer2.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    shimmer1.start(now);
    shimmer1.stop(now + 0.35);
    shimmer2.start(now);
    shimmer2.stop(now + 0.35);
  }

  /**
   * Generate metal asteroid near-miss with metallic ring
   */
  generateMetalNearMissWhoosh(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Base whoosh
    this.generateNearMissWhoosh(volume * 0.8);

    // Add metallic ping/ring
    const metal1 = ctx.createOscillator();
    metal1.type = 'triangle';
    metal1.frequency.value = 1200 + Math.random() * 400;

    const metal2 = ctx.createOscillator();
    metal2.type = 'square';
    metal2.frequency.value = metal1.frequency.value * 2.5;

    const metalFilter = ctx.createBiquadFilter();
    metalFilter.type = 'bandpass';
    metalFilter.frequency.value = 1800;
    metalFilter.Q.value = 8;

    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(volume * 0.2, now);
    metalGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    metal1.connect(metalFilter);
    metal2.connect(metalFilter);
    metalFilter.connect(metalGain);
    metalGain.connect(ctx.destination);

    metal1.start(now);
    metal1.stop(now + 0.25);
    metal2.start(now);
    metal2.stop(now + 0.25);
  }

  // ===== Hive Collapse Sound Effects =====

  /**
   * Generate deep rumbling for hive collapse
   */
  generateCollapseRumble(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep bass rumble
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(30 + Math.random() * 10, now);
    bass.frequency.linearRampToValueAtTime(20 + Math.random() * 10, now + 1.5);

    // Secondary rumble for texture
    const rumble2 = ctx.createOscillator();
    rumble2.type = 'sawtooth';
    rumble2.frequency.setValueAtTime(45, now);
    rumble2.frequency.linearRampToValueAtTime(35, now + 1.2);

    // LFO for tremor effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4 + Math.random() * 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(bass.frequency);

    // Lowpass filter for deep rumble
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 80;

    // Envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.2);
    gain.gain.setValueAtTime(volume * 0.8, now + 1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    bass.connect(filter);
    rumble2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    bass.start(now);
    bass.stop(now + 2);
    rumble2.start(now);
    rumble2.stop(now + 2);
    lfo.start(now);
    lfo.stop(now + 2);
  }

  /**
   * Generate cracking/splitting sound for structural failure
   */
  generateCollapseCrack(volume = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Sharp crack
    const crack = ctx.createOscillator();
    crack.type = 'square';
    crack.frequency.setValueAtTime(2000 + Math.random() * 1000, now);
    crack.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    // Low thud following crack
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(100, now + 0.03);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    // Noise burst for texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 1;

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(volume, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.05);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    crack.connect(crackGain);
    crackGain.connect(ctx.destination);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    crack.start(now);
    crack.stop(now + 0.15);
    thud.start(now + 0.03);
    thud.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  /**
   * Generate structural groaning sound
   */
  generateStructureGroan(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low metallic groan
    const groan = ctx.createOscillator();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(60 + Math.random() * 20, now);
    groan.frequency.linearRampToValueAtTime(80 + Math.random() * 30, now + 0.5);
    groan.frequency.linearRampToValueAtTime(50 + Math.random() * 20, now + 1.5);

    // Resonant filter for metallic quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 150 + Math.random() * 100;
    filter.Q.value = 5;

    // LFO for wavering
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.structureWaver + Math.random() * 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(groan.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.3);
    gain.gain.setValueAtTime(volume * 0.8, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2);

    groan.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    groan.start(now);
    groan.stop(now + 2.2);
    lfo.start(now);
    lfo.stop(now + 2.2);
  }

  /**
   * Generate heavy debris impact
   */
  generateDebrisImpact(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Impact thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(80 + Math.random() * 40, now);
    thud.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    // Crunch/crumble noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.25);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    thud.start(now);
    thud.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.35);
  }

  /**
   * Generate ground cracking sound
   */
  generateGroundCrack(volume = 0.55): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep rumble for earth moving
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, now);
    rumble.frequency.linearRampToValueAtTime(25, now + 0.6);

    // Cracking sound
    const crack = ctx.createOscillator();
    crack.type = 'square';
    crack.frequency.setValueAtTime(1200 + Math.random() * 500, now);
    crack.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    // Secondary crack for layered effect
    const crack2 = ctx.createOscillator();
    crack2.type = 'sawtooth';
    crack2.frequency.setValueAtTime(800 + Math.random() * 400, now + 0.05);
    crack2.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    // Noise for debris
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1500, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.35);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(volume * 0.6, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(volume, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    const crack2Gain = ctx.createGain();
    crack2Gain.gain.setValueAtTime(volume * 0.6, now + 0.05);
    crack2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    crack.connect(crackGain);
    crackGain.connect(ctx.destination);

    crack2.connect(crack2Gain);
    crack2Gain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    rumble.start(now);
    rumble.stop(now + 0.8);
    crack.start(now);
    crack.stop(now + 0.2);
    crack2.start(now + 0.05);
    crack2.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.45);
  }

  // ===== Vehicle/Door Sound Effects =====

  /**
   * Generate door opening sound - mechanical sliding door
   */
  generateDoorOpen(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Mechanical servo sound
    const servo = ctx.createOscillator();
    servo.type = 'sawtooth';
    servo.frequency.setValueAtTime(80, now);
    servo.frequency.linearRampToValueAtTime(200, now + 0.15);
    servo.frequency.linearRampToValueAtTime(120, now + 0.4);

    const servoFilter = ctx.createBiquadFilter();
    servoFilter.type = 'lowpass';
    servoFilter.frequency.value = 800;
    servoFilter.Q.value = 2;

    // Hydraulic hiss
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    // Clunk at start
    const clunk = ctx.createOscillator();
    clunk.type = 'sine';
    clunk.frequency.setValueAtTime(150, now);
    clunk.frequency.exponentialRampToValueAtTime(50, now + 0.05);

    // Envelopes
    const servoGain = ctx.createGain();
    servoGain.gain.setValueAtTime(0, now);
    servoGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
    servoGain.gain.setValueAtTime(volume * 0.25, now + 0.35);
    servoGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.15, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const clunkGain = ctx.createGain();
    clunkGain.gain.setValueAtTime(volume * 0.5, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Connect
    servo.connect(servoFilter);
    servoFilter.connect(servoGain);
    servoGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    clunk.connect(clunkGain);
    clunkGain.connect(ctx.destination);

    // Play
    servo.start(now);
    servo.stop(now + 0.55);
    noise.start(now);
    noise.stop(now + 0.5);
    clunk.start(now);
    clunk.stop(now + 0.1);
  }

  /**
   * Generate airlock cycling sound
   */
  generateAirlockCycle(volume = 0.45): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Pressure release hiss
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.linearRampToValueAtTime(1500, now + 1.5);
    noiseFilter.Q.value = 3;

    // Deep mechanical clunk
    const clunk = ctx.createOscillator();
    clunk.type = 'sine';
    clunk.frequency.setValueAtTime(80, now);
    clunk.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    // Seal engaging sound
    const seal = ctx.createOscillator();
    seal.type = 'sawtooth';
    seal.frequency.setValueAtTime(200, now + 1.3);
    seal.frequency.linearRampToValueAtTime(100, now + 1.6);

    // Envelopes
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.2);
    noiseGain.gain.setValueAtTime(volume * 0.35, now + 1.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    const clunkGain = ctx.createGain();
    clunkGain.gain.setValueAtTime(volume * 0.6, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    const sealGain = ctx.createGain();
    sealGain.gain.setValueAtTime(0, now + 1.3);
    sealGain.gain.linearRampToValueAtTime(volume * 0.3, now + 1.4);
    sealGain.gain.exponentialRampToValueAtTime(0.01, now + 1.7);

    // Connect
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    clunk.connect(clunkGain);
    clunkGain.connect(ctx.destination);

    seal.connect(sealGain);
    sealGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 2);
    clunk.start(now);
    clunk.stop(now + 0.25);
    seal.start(now + 1.3);
    seal.stop(now + 1.8);
  }

  /**
   * Generate drop pod impact sound
   */
  generateDropImpact(volume = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep impact thud
    const impact = ctx.createOscillator();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(100, now);
    impact.frequency.exponentialRampToValueAtTime(25, now + 0.3);

    // Sub-bass rumble
    const subBass = ctx.createOscillator();
    subBass.type = 'sine';
    subBass.frequency.value = 35;

    // Metal stress/creaking
    const metalStress = ctx.createOscillator();
    metalStress.type = 'sawtooth';
    metalStress.frequency.setValueAtTime(300, now + 0.1);
    metalStress.frequency.linearRampToValueAtTime(150, now + 0.4);

    const metalFilter = ctx.createBiquadFilter();
    metalFilter.type = 'bandpass';
    metalFilter.frequency.value = 400;
    metalFilter.Q.value = 6;

    // Debris noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.5);

    // Envelopes
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(volume, now);
    impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(volume * 0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(0, now + 0.1);
    metalGain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.15);
    metalGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    // Connect
    impact.connect(impactGain);
    impactGain.connect(ctx.destination);

    subBass.connect(subGain);
    subGain.connect(ctx.destination);

    metalStress.connect(metalFilter);
    metalFilter.connect(metalGain);
    metalGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Play
    impact.start(now);
    impact.stop(now + 0.45);
    subBass.start(now);
    subBass.stop(now + 0.7);
    metalStress.start(now + 0.1);
    metalStress.stop(now + 0.55);
    noise.start(now);
    noise.stop(now + 0.6);
  }

  // ===== Movement Sound Effects =====

  /**
   * Generate slide sound - metallic scraping with momentum feel
   */
  generateSlideSound(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Filtered noise for scraping/sliding
    const bufferSize = ctx.sampleRate * 0.6;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for metallic scraping quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.1);
    filter.frequency.linearRampToValueAtTime(600, now + 0.5);
    filter.Q.value = 2;

    // Low rumble for ground contact feel
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(80, now);
    rumble.frequency.linearRampToValueAtTime(60, now + 0.4);

    // Whoosh component for speed feel
    const whoosh = ctx.createOscillator();
    whoosh.type = 'sawtooth';
    whoosh.frequency.setValueAtTime(200, now);
    whoosh.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'lowpass';
    whooshFilter.frequency.value = 400;

    // Envelopes
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
    noiseGain.gain.setValueAtTime(volume * 0.35, now + 0.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.03);
    rumbleGain.gain.setValueAtTime(volume * 0.25, now + 0.35);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0, now);
    whooshGain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.05);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    // Connect
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.6);
    rumble.start(now);
    rumble.stop(now + 0.55);
    whoosh.start(now);
    whoosh.stop(now + 0.5);
  }

  /**
   * Generate slide end sound - deceleration and recovery
   */
  generateSlideEndSound(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Quick scrape ending
    const bufferSize = ctx.sampleRate * 0.2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    filter.Q.value = 3;

    // Footstep-like thud for recovery
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(60, now + 0.1);

    // Envelopes
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume * 0.4, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    // Connect
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);

    // Play
    noise.start(now);
    noise.stop(now + 0.2);
    thud.start(now);
    thud.stop(now + 0.15);
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

/**
 * Procedural Ambient Sound Generator for level-specific atmospheres
 */
export class ProceduralAmbientGenerator {
  private audioContext: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private activeOscillators: OscillatorNode[] = [];
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private intervalIds: ReturnType<typeof setInterval>[] = [];

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  start(type: ProceduralAmbientType, intensity: number): void {
    if (this.isPlaying) this.stop();
    this.isPlaying = true;

    const ctx = this.getContext();
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = intensity * 0.5;
    this.masterGain.connect(ctx.destination);

    switch (type) {
      case 'station':
        this.createStationAmbient(ctx, intensity);
        break;
      case 'wind':
        this.createWindAmbient(ctx, intensity);
        break;
      case 'horror':
        this.createHorrorAmbient(ctx, intensity);
        break;
      case 'hive':
        this.createHiveAmbient(ctx, intensity);
        break;
      case 'extraction':
        this.createExtractionAmbient(ctx, intensity);
        break;
      case 'ice':
        this.createIceAmbient(ctx, intensity);
        break;
    }
  }

  private createStationAmbient(ctx: AudioContext, intensity: number): void {
    // Low electrical hum
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 60;

    const hum2 = ctx.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 120;

    const humGain = ctx.createGain();
    humGain.gain.value = intensity * 0.15;

    hum.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(this.masterGain!);

    hum.start();
    hum2.start();
    this.activeOscillators.push(hum, hum2);

    // Occasional beeps and clicks
    const beepInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.3) {
        const beep = ctx.createOscillator();
        beep.type = 'sine';
        beep.frequency.value = 800 + Math.random() * 400;

        const beepGain = ctx.createGain();
        beepGain.gain.setValueAtTime(0, ctx.currentTime);
        beepGain.gain.linearRampToValueAtTime(intensity * 0.1, ctx.currentTime + 0.02);
        beepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        beep.connect(beepGain);
        beepGain.connect(this.masterGain!);

        beep.start();
        beep.stop(ctx.currentTime + 0.15);
      }
    }, 3000);
    this.intervalIds.push(beepInterval);
  }

  private createWindAmbient(ctx: AudioContext, intensity: number): void {
    // Brown noise for wind
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      noiseData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = noiseData[i];
      noiseData[i] *= 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Resonant filter for whistling
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;

    // LFO to modulate filter frequency for gusts
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.windGust;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = intensity * 0.4;

    noise.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain!);

    noise.start();
    lfo.start();
    this.activeOscillators.push(lfo);
    this.activeNodes.push(noise);
  }

  private createHorrorAmbient(ctx: AudioContext, intensity: number): void {
    // Very low drone
    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 35;

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 100;

    const droneGain = ctx.createGain();
    droneGain.gain.value = intensity * 0.2;

    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain!);

    drone.start();
    this.activeOscillators.push(drone);

    // Occasional creaks and distant sounds
    const creakInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.2) {
        const creak = ctx.createOscillator();
        creak.type = 'sawtooth';
        creak.frequency.setValueAtTime(100 + Math.random() * 50, ctx.currentTime);
        creak.frequency.linearRampToValueAtTime(80 + Math.random() * 30, ctx.currentTime + 0.5);

        const creakFilter = ctx.createBiquadFilter();
        creakFilter.type = 'bandpass';
        creakFilter.frequency.value = 300;
        creakFilter.Q.value = 5;

        const creakGain = ctx.createGain();
        creakGain.gain.setValueAtTime(0, ctx.currentTime);
        creakGain.gain.linearRampToValueAtTime(intensity * 0.15, ctx.currentTime + 0.1);
        creakGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        creak.connect(creakFilter);
        creakFilter.connect(creakGain);
        creakGain.connect(this.masterGain!);

        creak.start();
        creak.stop(ctx.currentTime + 0.7);
      }
    }, 4000);
    this.intervalIds.push(creakInterval);
  }

  private createHiveAmbient(ctx: AudioContext, intensity: number): void {
    // Organic pulsing
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 30;

    const pulseLfo = ctx.createOscillator();
    pulseLfo.frequency.value = LFO_RATES.hivePulse;
    const pulseLfoGain = ctx.createGain();
    pulseLfoGain.gain.value = intensity * 0.3;
    pulseLfo.connect(pulseLfoGain);

    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    pulseLfoGain.connect(pulseGain.gain);

    pulse.connect(pulseGain);
    pulseGain.connect(this.masterGain!);

    pulse.start();
    pulseLfo.start();
    this.activeOscillators.push(pulse, pulseLfo);

    // Chittering sounds
    const chitterInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.4) {
        const chitter = ctx.createOscillator();
        chitter.type = 'square';
        chitter.frequency.value = 200 + Math.random() * 300;

        const chitterLfo = ctx.createOscillator();
        chitterLfo.frequency.value = 30 + Math.random() * 20;
        const chitterLfoGain = ctx.createGain();
        chitterLfoGain.gain.value = 100;
        chitterLfo.connect(chitterLfoGain);
        chitterLfoGain.connect(chitter.frequency);

        const chitterGain = ctx.createGain();
        chitterGain.gain.setValueAtTime(0, ctx.currentTime);
        chitterGain.gain.linearRampToValueAtTime(intensity * 0.1, ctx.currentTime + 0.02);
        chitterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        chitter.connect(chitterGain);
        chitterGain.connect(this.masterGain!);

        chitter.start();
        chitterLfo.start();
        chitter.stop(ctx.currentTime + 0.25);
        chitterLfo.stop(ctx.currentTime + 0.25);
      }
    }, 2000);
    this.intervalIds.push(chitterInterval);
  }

  private createExtractionAmbient(ctx: AudioContext, intensity: number): void {
    // Urgent rumbling
    const rumble1 = ctx.createOscillator();
    rumble1.type = 'sawtooth';
    rumble1.frequency.value = 50;

    const rumble2 = ctx.createOscillator();
    rumble2.type = 'sawtooth';
    rumble2.frequency.value = 52;

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 150;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = intensity * 0.25;

    rumble1.connect(rumbleFilter);
    rumble2.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain!);

    rumble1.start();
    rumble2.start();
    this.activeOscillators.push(rumble1, rumble2);

    // Distant explosions
    const explosionInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.3) {
        const boom = ctx.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(80, ctx.currentTime);
        boom.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.3);

        const boomGain = ctx.createGain();
        boomGain.gain.setValueAtTime(0, ctx.currentTime);
        boomGain.gain.linearRampToValueAtTime(intensity * 0.2, ctx.currentTime + 0.05);
        boomGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        boom.connect(boomGain);
        boomGain.connect(this.masterGain!);

        boom.start();
        boom.stop(ctx.currentTime + 0.5);
      }
    }, 3500);
    this.intervalIds.push(explosionInterval);
  }

  private createIceAmbient(ctx: AudioContext, intensity: number): void {
    // Frozen wind - higher frequency, more whistling than regular wind
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      noiseData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = noiseData[i];
      noiseData[i] *= 3.5;
    }

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    // Higher resonant filter for icy whistle
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 4;

    // LFO for gusting
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.15;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 300;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = intensity * 0.35;

    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain!);

    wind.start();
    windLfo.start();
    this.activeOscillators.push(windLfo);
    this.activeNodes.push(wind);

    // Low ice groan/stress - deep creaking of frozen structures
    const iceGroan = ctx.createOscillator();
    iceGroan.type = 'sawtooth';
    iceGroan.frequency.value = 45;

    const iceGroanFilter = ctx.createBiquadFilter();
    iceGroanFilter.type = 'lowpass';
    iceGroanFilter.frequency.value = 100;

    const iceGroanGain = ctx.createGain();
    iceGroanGain.gain.value = intensity * 0.15;

    iceGroan.connect(iceGroanFilter);
    iceGroanFilter.connect(iceGroanGain);
    iceGroanGain.connect(this.masterGain!);

    iceGroan.start();
    this.activeOscillators.push(iceGroan);

    // Occasional ice cracking sounds
    const crackInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.35) {
        this.playIceCrack(ctx, intensity);
      }
    }, 4000);
    this.intervalIds.push(crackInterval);

    // Crystalline shimmer ambience
    const shimmerInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.25) {
        this.playIceShimmer(ctx, intensity);
      }
    }, 6000);
    this.intervalIds.push(shimmerInterval);

    // Distant ice groans/shifts
    const shiftInterval = setInterval(() => {
      if (!this.isPlaying) return;
      if (Math.random() < 0.2) {
        this.playIceShift(ctx, intensity);
      }
    }, 8000);
    this.intervalIds.push(shiftInterval);
  }

  private playIceCrack(ctx: AudioContext, intensity: number): void {
    const now = ctx.currentTime;

    // Sharp crack - high frequency snap
    const crack = ctx.createOscillator();
    crack.type = 'square';
    crack.frequency.setValueAtTime(3000 + Math.random() * 1500, now);
    crack.frequency.exponentialRampToValueAtTime(500, now + 0.04);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(intensity * 0.4, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    // Secondary crack for layered effect
    const crack2 = ctx.createOscillator();
    crack2.type = 'sawtooth';
    crack2.frequency.setValueAtTime(2000 + Math.random() * 1000, now + 0.02);
    crack2.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    const crack2Gain = ctx.createGain();
    crack2Gain.gain.setValueAtTime(intensity * 0.25, now + 0.02);
    crack2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    // Low rumble following crack
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(80, now + 0.03);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(intensity * 0.2, now + 0.03);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    // Connect
    crack.connect(crackGain);
    crackGain.connect(this.masterGain!);

    crack2.connect(crack2Gain);
    crack2Gain.connect(this.masterGain!);

    rumble.connect(rumbleGain);
    rumbleGain.connect(this.masterGain!);

    // Play
    crack.start(now);
    crack.stop(now + 0.08);
    crack2.start(now + 0.02);
    crack2.stop(now + 0.12);
    rumble.start(now + 0.03);
    rumble.stop(now + 0.3);
  }

  private playIceShimmer(ctx: AudioContext, intensity: number): void {
    const now = ctx.currentTime;

    // High crystalline tones
    const shimmerFreqs = [
      2400 + Math.random() * 600,
      3200 + Math.random() * 800,
      4000 + Math.random() * 1000,
    ];

    shimmerFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(intensity * 0.08, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }

  private playIceShift(ctx: AudioContext, intensity: number): void {
    const now = ctx.currentTime;

    // Deep groaning shift
    const groan = ctx.createOscillator();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(50 + Math.random() * 20, now);
    groan.frequency.linearRampToValueAtTime(70 + Math.random() * 30, now + 0.4);
    groan.frequency.linearRampToValueAtTime(40 + Math.random() * 15, now + 1.2);

    const groanFilter = ctx.createBiquadFilter();
    groanFilter.type = 'bandpass';
    groanFilter.frequency.value = 100 + Math.random() * 50;
    groanFilter.Q.value = 4;

    // LFO for wavering
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2 + Math.random() * 2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(groan.frequency);

    const groanGain = ctx.createGain();
    groanGain.gain.setValueAtTime(0, now);
    groanGain.gain.linearRampToValueAtTime(intensity * 0.25, now + 0.2);
    groanGain.gain.setValueAtTime(intensity * 0.2, now + 0.9);
    groanGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    groan.connect(groanFilter);
    groanFilter.connect(groanGain);
    groanGain.connect(this.masterGain!);

    groan.start(now);
    groan.stop(now + 1.6);
    lfo.start(now);
    lfo.stop(now + 1.6);
  }

  stop(): void {
    this.isPlaying = false;

    // Clear intervals
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds = [];

    // Stop oscillators
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeOscillators = [];

    // Disconnect nodes
    for (const node of this.activeNodes) {
      try {
        (node as AudioBufferSourceNode).stop();
      } catch {
        // Already stopped
      }
    }
    this.activeNodes = [];

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
  }

  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
