import type { Sound } from '@babylonjs/core/Audio/sound';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

// Sound effect types
export type SoundEffect =
  | 'weapon_fire'
  | 'weapon_reload'
  | 'hit_marker'
  | 'enemy_death'
  | 'player_damage'
  | 'footstep'
  | 'jump'
  | 'land'
  | 'ambient_wind'
  | 'ui_click'
  | 'ui_hover'
  | 'notification'
  | 'drop_wind'
  | 'drop_thrust'
  | 'drop_impact'
  | 'comms_open'
  | 'comms_close'
  | 'door_open'
  | 'airlock';

// Music tracks
export type MusicTrack = 'menu' | 'ambient' | 'combat' | 'drop_sequence' | 'victory' | 'defeat';

interface SoundConfig {
  url: string;
  volume: number;
  loop?: boolean;
  spatialSound?: boolean;
  maxDistance?: number;
}

// Procedural sound generation for effects that don't need external files
class ProceduralAudio {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Generate a laser/plasma shot sound
  generateLaserShot(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Oscillator for the main tone
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    // High frequency component for "zap" effect
    const oscHigh = ctx.createOscillator();
    oscHigh.type = 'square';
    oscHigh.frequency.setValueAtTime(2000, now);
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

  // Generate hit marker sound
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

  // Generate damage/hurt sound
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

  // Generate footstep sound
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

  // Generate UI click sound
  generateUIClick(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.02);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Generate wind/atmospheric sound for drop sequence
  generateDropWind(duration = 1, volume = 0.3): { stop: () => void } {
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

  // Generate thrust/engine sound
  generateThrustSound(volume = 0.25): { stop: () => void } {
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
    lfo.frequency.value = 8;
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

  // Notification/comms beep
  generateNotificationBeep(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-tone beep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1100, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + 0.07);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.08);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.15);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Main Audio Manager class
export class AudioManager {
  private scene: Scene | null = null;
  private sounds: Map<string, Sound> = new Map();
  private proceduralAudio: ProceduralAudio;

  private masterVolume = 1.0;
  private sfxVolume = 0.7;
  private musicVolume = 0.5;

  private isMuted = false;
  private currentMusic: Sound | null = null;
  private activeLoops: Map<string, { stop: () => void }> = new Map();

  constructor() {
    this.proceduralAudio = new ProceduralAudio();
  }

  initialize(scene: Scene): void {
    this.scene = scene;
  }

  // Play a sound effect
  play(effect: SoundEffect, options?: { volume?: number; position?: Vector3 }): void {
    if (this.isMuted) return;
    
    // Check if audio context is available
    if (!this.proceduralAudio || !this.proceduralAudio['audioContext']) {
        // Fallback or ignore if audio not supported/initialized
        // Ideally we would check `this.proceduralAudio.getContext()` but it's private
        // For now, we assume it's safe if not muted, but let's add a try-catch for safety
    }

    const volume = (options?.volume ?? 1) * this.sfxVolume * this.masterVolume;

    try {
      // Use procedural audio for most effects (no external files needed)
      switch (effect) {
        case 'weapon_fire':
          this.proceduralAudio.generateLaserShot(volume);
          break;
        case 'hit_marker':
          this.proceduralAudio.generateHitMarker(volume);
          break;
        case 'player_damage':
          this.proceduralAudio.generateDamage(volume);
          break;
        case 'footstep':
          this.proceduralAudio.generateFootstep(volume);
          break;
        case 'ui_click':
          this.proceduralAudio.generateUIClick(volume);
          break;
        case 'notification':
        case 'comms_open':
          this.proceduralAudio.generateNotificationBeep(volume);
          break;
        case 'weapon_reload':
        case 'enemy_death':
        case 'jump':
        case 'land':
        case 'ambient_wind':
        case 'ui_hover':
        case 'drop_impact':
        case 'comms_close':
        case 'door_open':
        case 'airlock':
        case 'drop_wind':
        case 'drop_thrust':
          // Placeholder for effects not yet implemented procedurally
          // In a full implementation, these would have their own generators
          // or load from files. For now, silence is better than a crash.
          break;
      }
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  // Start a looping sound
  startLoop(effect: 'drop_wind' | 'drop_thrust', volume = 1): void {
    if (this.isMuted) return;
    if (this.activeLoops.has(effect)) return;

    try {
      const vol = volume * this.sfxVolume * this.masterVolume;

      let loop: { stop: () => void };
      switch (effect) {
        case 'drop_wind':
          loop = this.proceduralAudio.generateDropWind(5, vol);
          break;
        case 'drop_thrust':
          loop = this.proceduralAudio.generateThrustSound(vol);
          break;
        default:
          return;
      }

      this.activeLoops.set(effect, loop);
    } catch (e) {
        console.warn('Audio loop failed', e);
    }
  }

  // Stop a looping sound
  stopLoop(effect: string): void {
    const loop = this.activeLoops.get(effect);
    if (loop) {
      loop.stop();
      this.activeLoops.delete(effect);
    }
  }

  // Stop all loops
  stopAllLoops(): void {
    for (const [key, loop] of this.activeLoops) {
      loop.stop();
    }
    this.activeLoops.clear();
  }

  // Volume controls
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.currentMusic) {
      this.currentMusic.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  mute(): void {
    this.isMuted = true;
    this.stopAllLoops();
    if (this.currentMusic) {
      this.currentMusic.pause();
    }
  }

  unmute(): void {
    this.isMuted = false;
    if (this.currentMusic) {
      this.currentMusic.play();
    }
  }

  toggleMute(): boolean {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  dispose(): void {
    this.stopAllLoops();

    for (const sound of this.sounds.values()) {
      sound.dispose();
    }
    this.sounds.clear();

    if (this.currentMusic) {
      this.currentMusic.dispose();
      this.currentMusic = null;
    }

    this.proceduralAudio.dispose();
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

export function disposeAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
    audioManagerInstance = null;
  }
}
