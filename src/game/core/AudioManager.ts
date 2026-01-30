import * as Tone from 'tone';
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

// Music tracks - mapped to actual audio files
export type MusicTrack = 'menu' | 'ambient' | 'combat' | 'exploration' | 'boss' | 'victory' | 'defeat';

// Music file paths (relative to public/)
const MUSIC_PATHS: Record<MusicTrack, string> = {
  menu: '/audio/music/menu.ogg',
  ambient: '/audio/music/ambient.ogg',
  combat: '/audio/music/combat.ogg',
  exploration: '/audio/music/exploration.ogg',
  boss: '/audio/music/boss.ogg',
  victory: '/audio/music/victory.ogg',
  defeat: '/audio/music/combat.ogg', // Reuse combat for defeat tension
};

// Track characteristics for intelligent blending
const TRACK_INFO: Record<MusicTrack, { intensity: number; bpm?: number }> = {
  menu: { intensity: 0.2, bpm: 80 },
  ambient: { intensity: 0.3, bpm: 70 },
  exploration: { intensity: 0.4, bpm: 90 },
  combat: { intensity: 0.8, bpm: 140 },
  boss: { intensity: 1.0, bpm: 160 },
  victory: { intensity: 0.5, bpm: 100 },
  defeat: { intensity: 0.7, bpm: 120 },
};

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

// Tone.js-based Music Player with crossfading
class MusicPlayer {
  private playerA: Tone.Player | null = null;
  private playerB: Tone.Player | null = null;
  private crossFade: Tone.CrossFade;
  private masterGain: Tone.Gain;
  private reverb: Tone.Reverb;
  private lowpassFilter: Tone.Filter;

  private currentPlayer: 'A' | 'B' = 'A';
  private currentTrack: MusicTrack | null = null;
  private isLoading = false;
  private volume = 0.5;

  constructor() {
    // Create effects chain for atmospheric sound
    this.reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.3,
    });

    this.lowpassFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
    });

    // Crossfade between two players for smooth transitions
    this.crossFade = new Tone.CrossFade(0);

    // Master output
    this.masterGain = new Tone.Gain(this.volume);

    // Connect: crossfade -> filter -> reverb -> master -> destination
    this.crossFade.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  async play(track: MusicTrack, crossfadeDuration = 2): Promise<void> {
    if (this.currentTrack === track || this.isLoading) return;

    this.isLoading = true;
    const path = MUSIC_PATHS[track];

    try {
      // Start Tone.js context if not started (requires user interaction)
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }

      // Create new player for the incoming track
      const newPlayer = new Tone.Player({
        url: path,
        loop: true,
        fadeIn: 0.1,
        fadeOut: 0.1,
      });

      // Wait for the audio to load
      await Tone.loaded();

      // Determine which player slot to use
      const targetPlayer = this.currentPlayer === 'A' ? 'B' : 'A';

      if (targetPlayer === 'A') {
        // Dispose old player if exists
        if (this.playerA) {
          this.playerA.stop();
          this.playerA.dispose();
        }
        this.playerA = newPlayer;
        this.playerA.connect(this.crossFade.a);
        this.playerA.start();
      } else {
        if (this.playerB) {
          this.playerB.stop();
          this.playerB.dispose();
        }
        this.playerB = newPlayer;
        this.playerB.connect(this.crossFade.b);
        this.playerB.start();
      }

      // Perform crossfade
      const targetFade = targetPlayer === 'A' ? 0 : 1;
      this.crossFade.fade.rampTo(targetFade, crossfadeDuration);

      // Adjust effects based on track intensity
      const info = TRACK_INFO[track];
      const reverbWet = 0.2 + (1 - info.intensity) * 0.3; // More reverb for calmer tracks
      this.reverb.wet.rampTo(reverbWet, crossfadeDuration);

      // Update state
      this.currentPlayer = targetPlayer;
      this.currentTrack = track;

      // Clean up the old player after crossfade
      setTimeout(() => {
        const oldPlayer = targetPlayer === 'A' ? this.playerB : this.playerA;
        if (oldPlayer) {
          oldPlayer.stop();
        }
      }, crossfadeDuration * 1000 + 100);

    } catch (error) {
      console.warn('Music playback failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  stop(fadeDuration = 1): void {
    this.masterGain.gain.rampTo(0, fadeDuration);
    setTimeout(() => {
      this.playerA?.stop();
      this.playerB?.stop();
      this.currentTrack = null;
      this.masterGain.gain.value = this.volume;
    }, fadeDuration * 1000 + 100);
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.masterGain.gain.rampTo(this.volume, 0.1);
  }

  getVolume(): number {
    return this.volume;
  }

  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  // Apply a lowpass filter effect (useful for underwater, muffled, etc.)
  setFilterCutoff(frequency: number, rampTime = 0.5): void {
    this.lowpassFilter.frequency.rampTo(frequency, rampTime);
  }

  // Reset filter to normal
  resetFilter(): void {
    this.lowpassFilter.frequency.rampTo(20000, 0.5);
  }

  dispose(): void {
    this.playerA?.dispose();
    this.playerB?.dispose();
    this.crossFade.dispose();
    this.masterGain.dispose();
    this.reverb.dispose();
    this.lowpassFilter.dispose();
  }
}

// Main Audio Manager class
export class AudioManager {
  private scene: Scene | null = null;
  private sounds: Map<string, Sound> = new Map();
  private proceduralAudio: ProceduralAudio;
  private musicPlayer: MusicPlayer;

  private masterVolume = 1.0;
  private sfxVolume = 0.7;
  private musicVolume = 0.5;

  private isMuted = false;
  private currentMusic: Sound | null = null;
  private activeLoops: Map<string, { stop: () => void }> = new Map();

  constructor() {
    this.proceduralAudio = new ProceduralAudio();
    this.musicPlayer = new MusicPlayer();
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  initialize(scene: Scene): void {
    this.scene = scene;
  }

  // Play a music track with smooth crossfade
  async playMusic(track: MusicTrack, crossfadeDuration = 2): Promise<void> {
    if (this.isMuted) return;
    await this.musicPlayer.play(track, crossfadeDuration);
  }

  stopMusic(fadeDuration = 1): void {
    this.musicPlayer.stop(fadeDuration);
  }

  getCurrentMusicTrack(): MusicTrack | null {
    return this.musicPlayer.getCurrentTrack();
  }

  // Apply muffled/underwater effect to music
  setMusicMuffled(muffled: boolean): void {
    if (muffled) {
      this.musicPlayer.setFilterCutoff(800);
    } else {
      this.musicPlayer.resetFilter();
    }
  }

  // Play a sound effect
  play(effect: SoundEffect, options?: { volume?: number; position?: Vector3 }): void {
    if (this.isMuted) return;

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
    for (const [, loop] of this.activeLoops) {
      loop.stop();
    }
    this.activeLoops.clear();
  }

  // Volume controls
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  mute(): void {
    this.isMuted = true;
    this.stopAllLoops();
    this.musicPlayer.setVolume(0);
  }

  unmute(): void {
    this.isMuted = false;
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
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
    this.musicPlayer.dispose();
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
