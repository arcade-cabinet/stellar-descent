import type { Sound } from '@babylonjs/core/Audio/sound';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import * as Tone from 'tone';
import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';
import {
  type AudioZone,
  disposeEnvironmentalAudioManager,
  type EnvironmentType as EnvAudioType,
  getEnvironmentalAudioManager,
  type SpatialSoundSource,
} from './EnvironmentalAudioManager';
import {
  type CombatIntensity,
  disposeProceduralMusicEngine,
  getProceduralMusicEngine,
  type MusicEnvironment,
} from './ProceduralMusicEngine';
import { type EnvironmentType, type ImpactSurface, weaponSoundManager } from './WeaponSoundManager';

// Sound effect types
export type SoundEffect =
  | 'weapon_fire'
  | 'weapon_reload'
  | 'weapon_reload_start'
  | 'weapon_reload_complete'
  | 'weapon_empty_click'
  | 'weapon_switch'
  | 'hit_marker'
  | 'headshot'
  | 'kill_confirm'
  | 'enemy_death'
  | 'player_damage'
  | 'footstep'
  | 'jump'
  | 'land'
  | 'ambient_wind'
  | 'ui_click'
  | 'ui_hover'
  | 'notification'
  | 'achievement_unlock'
  | 'drop_wind'
  | 'drop_thrust'
  | 'drop_impact'
  | 'comms_open'
  | 'comms_close'
  | 'door_open'
  | 'airlock'
  | 'alien_screech'
  | 'alien_growl'
  | 'hive_pulse'
  | 'organic_squish'
  | 'mech_step'
  | 'mech_fire'
  | 'explosion'
  | 'dropship_engine'
  // Enemy-specific sounds
  | 'alien_footstep'
  | 'alien_attack'
  | 'alien_spawn'
  | 'alien_alert'
  | 'alien_chittering'
  | 'alien_heavy_step'
  | 'alien_acid_spit'
  | 'alien_roar'
  | 'alien_hiss'
  // Collectible sounds
  | 'audio_log_pickup'
  | 'secret_found'
  // HALO drop near-miss sounds
  | 'near_miss_whoosh'
  | 'near_miss_ice'
  | 'near_miss_metal'
  // Hive collapse sounds
  | 'collapse_rumble'
  | 'collapse_crack'
  | 'structure_groan'
  | 'debris_impact'
  | 'alien_death_scream'
  | 'ground_crack'
  // Timer / checkpoint sounds
  | 'shield_recharge'
  | 'alert';

// Music tracks - mapped to actual audio files
export type MusicTrack =
  | 'menu'
  | 'ambient'
  | 'combat'
  | 'exploration'
  | 'boss'
  | 'victory'
  | 'defeat';

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

// Level-specific audio configuration
export interface LevelAudioConfig {
  ambientTrack: MusicTrack;
  combatTrack: MusicTrack;
  ambientVolume: number;
  combatVolume: number;
  // Procedural ambient settings (sound effects layer)
  proceduralAmbient?: {
    type: 'station' | 'wind' | 'horror' | 'hive' | 'extraction';
    intensity: number;
  };
  // Procedural music settings (Tone.js generated music)
  proceduralMusic?: {
    enabled: boolean;
    environment: MusicEnvironment;
    volume: number;
  };
}

// Level audio configurations
const LEVEL_AUDIO_CONFIGS: Partial<Record<LevelId, LevelAudioConfig>> = {
  anchor_station: {
    ambientTrack: 'ambient',
    combatTrack: 'combat',
    ambientVolume: 0.4,
    combatVolume: 0.6,
    proceduralAmbient: {
      type: 'station',
      intensity: 0.3,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'station',
      volume: 0.45,
    },
  },
  landfall: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.5,
    combatVolume: 0.7,
    proceduralAmbient: {
      type: 'wind',
      intensity: 0.6,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.4,
    },
  },
  fob_delta: {
    ambientTrack: 'ambient',
    combatTrack: 'combat',
    ambientVolume: 0.3,
    combatVolume: 0.65,
    proceduralAmbient: {
      type: 'horror',
      intensity: 0.5,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'base',
      volume: 0.4,
    },
  },
  brothers_in_arms: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.45,
    combatVolume: 0.75,
    proceduralAmbient: {
      type: 'wind',
      intensity: 0.4,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.45,
    },
  },
  the_breach: {
    ambientTrack: 'ambient',
    combatTrack: 'boss',
    ambientVolume: 0.35,
    combatVolume: 0.8,
    proceduralAmbient: {
      type: 'hive',
      intensity: 0.6,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'hive',
      volume: 0.5,
    },
  },
  extraction: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.5,
    combatVolume: 0.85,
    proceduralAmbient: {
      type: 'extraction',
      intensity: 0.7,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'extraction',
      volume: 0.55,
    },
  },
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

  // Audio log pickup - ethereal data collection sound
  generateAudioLogPickup(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Rising tone sequence to indicate discovery
    const tones = [440, 554, 659, 880]; // A4 -> C#5 -> E5 -> A5 (A major arpeggio)

    for (let i = 0; i < tones.length; i++) {
      const startTime = now + i * 0.08;

      // Main sine tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = tones[i];

      // Envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * (0.5 + i * 0.15), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }

    // Add a shimmering overtone
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1760; // A6

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.15);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    shimmer.start(now);
    shimmer.stop(now + 0.55);
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

  // Achievement unlock fanfare - triumphant ascending arpeggio
  generateAchievementUnlock(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Create a triumphant ascending arpeggio (C major -> E -> G -> High C)
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteLength = 0.12;
    const totalLength = notes.length * noteLength + 0.3;

    // Shimmer/sparkle effect with high harmonics
    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = 2093; // C7 high shimmer

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + totalLength);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now);
    shimmerOsc.stop(now + totalLength);

    // Play the ascending arpeggio
    for (let i = 0; i < notes.length; i++) {
      const noteStart = now + i * noteLength;

      // Main tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      // Second oscillator for richness (detuned slightly)
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = notes[i] * 1.002; // Slight detune for chorus effect

      // Envelope for each note
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(volume * 0.6, noteStart + 0.02);
      noteGain.gain.setValueAtTime(volume * 0.5, noteStart + noteLength * 0.7);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteLength + 0.15);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.3;

      osc.connect(noteGain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(noteGain);
      noteGain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteLength + 0.2);
      osc2.start(noteStart);
      osc2.stop(noteStart + noteLength + 0.2);
    }

    // Final chord sustain for the last note
    const finalChordStart = now + notes.length * noteLength - 0.05;
    const chordOsc1 = ctx.createOscillator();
    const chordOsc2 = ctx.createOscillator();
    const chordOsc3 = ctx.createOscillator();

    chordOsc1.type = 'sine';
    chordOsc2.type = 'sine';
    chordOsc3.type = 'sine';

    // C major chord (C, E, G)
    chordOsc1.frequency.value = 1046.5; // C6
    chordOsc2.frequency.value = 1318.51; // E6
    chordOsc3.frequency.value = 1567.98; // G6

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0, finalChordStart);
    chordGain.gain.linearRampToValueAtTime(volume * 0.4, finalChordStart + 0.05);
    chordGain.gain.exponentialRampToValueAtTime(0.001, finalChordStart + 0.5);

    chordOsc1.connect(chordGain);
    chordOsc2.connect(chordGain);
    chordOsc3.connect(chordGain);
    chordGain.connect(ctx.destination);

    chordOsc1.start(finalChordStart);
    chordOsc2.start(finalChordStart);
    chordOsc3.start(finalChordStart);
    chordOsc1.stop(finalChordStart + 0.6);
    chordOsc2.stop(finalChordStart + 0.6);
    chordOsc3.stop(finalChordStart + 0.6);
  }

  // Generate secret area discovery sound
  generateSecretFound(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Mysterious discovery chord - minor key with shimmering overtones
    const notes = [329.63, 392.0, 493.88, 659.25]; // E4, G4, B4, E5

    for (let i = 0; i < notes.length; i++) {
      const startTime = now + i * 0.1;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = notes[i] * 2; // Octave above for shimmer

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.2;

      osc.connect(gain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.7);
      osc2.start(startTime);
      osc2.stop(startTime + 0.7);
    }
  }

  // Generate enemy death screech
  generateEnemyDeath(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Descending pitch screech
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    // Second oscillator for texture
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(400 + Math.random() * 100, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    // Noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1;

    // Gains
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Connect
    osc.connect(mainGain);
    osc2.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Play
    osc.start(now);
    osc.stop(now + 0.4);
    osc2.start(now);
    osc2.stop(now + 0.35);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  // Generate alien screech (hostile alert)
  generateAlienScreech(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Ascending then descending pitch
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.4);

    // Modulation for organic feel
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 30 + Math.random() * 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.setValueAtTime(volume, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    lfo.start(now);
    lfo.stop(now + 0.55);
  }

  // Generate alien growl (ambient threat)
  generateAlienGrowl(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumbling growl
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 40, now);
    osc.frequency.linearRampToValueAtTime(60 + Math.random() * 20, now + 0.8);

    // Formant filter for throat-like sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 3;

    // LFO for tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6 + Math.random() * 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.1);
    gain.gain.setValueAtTime(volume, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.1);
    lfo.start(now);
    lfo.stop(now + 1.1);
  }

  // Generate hive pulse (organic ambient)
  generateHivePulse(volume = 0.15): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Slow pulsing bass
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 40;

    // Sub bass
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 25;

    // Pulse LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = volume;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    lfo.start(now);

    const duration = 2 + Math.random();
    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      setTimeout(() => {
        osc.stop();
        subOsc.stop();
        lfo.stop();
      }, 600);
    }, duration * 1000);
  }

  // Generate organic squish sound
  generateOrganicSquish(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Filtered noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.25);
  }

  // ===== Enemy-Specific Sound Generation =====

  // Generate alien footstep - light skittering sound
  generateAlienFootstep(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Quick click/tap sound
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

    // Noise for texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
    noise.start(now);
    noise.stop(now + 0.04);
  }

  // Generate alien attack sound - aggressive hiss/screech
  generateAlienAttack(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Sharp attack screech
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300 + Math.random() * 100, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    // Modulation for organic texture
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 40 + Math.random() * 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Noise burst for "spit" effect
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 2;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
    lfo.start(now);
    lfo.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  // Generate alien spawn sound - wet emergence
  generateAlienSpawn(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumble for emergence
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    // Wet squelch noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    noiseFilter.Q.value = 3;

    // Rising "emergence" tone
    const riseOsc = ctx.createOscillator();
    riseOsc.type = 'sawtooth';
    riseOsc.frequency.setValueAtTime(80, now + 0.1);
    riseOsc.frequency.exponentialRampToValueAtTime(200, now + 0.4);

    const riseFilter = ctx.createBiquadFilter();
    riseFilter.type = 'bandpass';
    riseFilter.frequency.value = 150;
    riseFilter.Q.value = 2;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume * 0.6, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const riseGain = ctx.createGain();
    riseGain.gain.setValueAtTime(0, now);
    riseGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.2);
    riseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    riseOsc.connect(riseFilter);
    riseFilter.connect(riseGain);
    riseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    noise.start(now);
    noise.stop(now + 0.45);
    riseOsc.start(now + 0.1);
    riseOsc.stop(now + 0.5);
  }

  // Generate alien alert sound - sharp warning screech
  generateAlienAlert(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-part alert: quick rise then sustained
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
    osc.frequency.setValueAtTime(500, now + 0.15);
    osc.frequency.linearRampToValueAtTime(400, now + 0.4);

    // Harmonic layer
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(200, now);
    osc2.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    osc2.frequency.setValueAtTime(700, now + 0.15);

    // LFO for tremolo effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25 + Math.random() * 15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    mainGain.gain.setValueAtTime(volume * 0.8, now + 0.15);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.3, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
    osc2.start(now);
    osc2.stop(now + 0.3);
    lfo.start(now);
    lfo.stop(now + 0.5);
  }

  // Generate alien chittering - rapid clicking sounds (for skitterer type)
  generateAlienChittering(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Rapid series of clicks
    const clickCount = 4 + Math.floor(Math.random() * 4);
    const clickDuration = 0.02;
    const totalDuration = clickCount * clickDuration * 1.5;

    for (let i = 0; i < clickCount; i++) {
      const clickStart = now + i * clickDuration * 1.5 + Math.random() * 0.01;

      const click = ctx.createOscillator();
      click.type = 'square';
      click.frequency.setValueAtTime(800 + Math.random() * 600, clickStart);
      click.frequency.exponentialRampToValueAtTime(300, clickStart + clickDuration);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(volume * (0.7 + Math.random() * 0.3), clickStart);
      clickGain.gain.exponentialRampToValueAtTime(0.01, clickStart + clickDuration);

      click.connect(clickGain);
      clickGain.connect(ctx.destination);

      click.start(clickStart);
      click.stop(clickStart + clickDuration + 0.01);
    }
  }

  // Generate heavy alien step - for broodmother/large enemies
  generateAlienHeavyStep(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep impact thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(40, now);
    thud.frequency.exponentialRampToValueAtTime(20, now + 0.3);

    // Secondary rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(25, now + 0.25);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 100;

    // Ground shake noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200;
    noiseFilter.Q.value = 1;

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(volume * 0.5, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    thud.start(now);
    thud.stop(now + 0.45);
    rumble.start(now);
    rumble.stop(now + 0.35);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  // Generate acid spit sound - for spewer type
  generateAlienAcidSpit(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Wet spray sound
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    noiseFilter.Q.value = 4;

    // Hissing undertone
    const hiss = ctx.createOscillator();
    hiss.type = 'sawtooth';
    hiss.frequency.setValueAtTime(150, now);
    hiss.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 200;
    hissFilter.Q.value = 2;

    // "Splat" at end
    const splat = ctx.createOscillator();
    splat.type = 'sine';
    splat.frequency.setValueAtTime(300, now + 0.15);
    splat.frequency.exponentialRampToValueAtTime(100, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(volume * 0.4, now);
    hissGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const splatGain = ctx.createGain();
    splatGain.gain.setValueAtTime(0, now + 0.15);
    splatGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.18);
    splatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(ctx.destination);

    splat.connect(splatGain);
    splatGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.3);
    hiss.start(now);
    hiss.stop(now + 0.35);
    splat.start(now + 0.15);
    splat.stop(now + 0.3);
  }

  // Generate alien roar - for large enemies like broodmother
  generateAlienRoar(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep rumbling roar
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    osc.frequency.linearRampToValueAtTime(70, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1);

    // Higher harmonic for presence
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(120, now);
    osc2.frequency.linearRampToValueAtTime(180, now + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    // Formant filter for throat-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.linearRampToValueAtTime(350, now + 0.3);
    filter.frequency.linearRampToValueAtTime(180, now + 0.8);
    filter.Q.value = 4;

    // LFO for tremolo/vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Noise for breath
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.1);
    mainGain.gain.setValueAtTime(volume, now + 0.7);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.25, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    osc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
    osc2.start(now);
    osc2.stop(now + 1);
    lfo.start(now);
    lfo.stop(now + 1.2);
    noise.start(now);
    noise.stop(now + 1);
  }

  // Generate alien hiss - short threatening sound
  generateAlienHiss(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // White noise filtered to sound like hissing
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
    noiseFilter.Q.value = 3;

    // Low undertone
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    noiseGain.gain.setValueAtTime(volume, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.35);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Generate mech footstep
  generateMechStep(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Heavy impact
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
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

  // Generate mech autocannon fire
  generateMechFire(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Heavy thump
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
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

  // Generate explosion
  generateExplosion(volume = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low boom
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now);
    boom.frequency.exponentialRampToValueAtTime(20, now + 0.4);

    // Mid rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(150, now);
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

  // Generate dropship engine sound (looping)
  generateDropshipEngine(volume = 0.35): { stop: () => void } {
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

  // Generate asteroid near-miss whoosh sound
  // Creates a dramatic doppler-like effect when debris narrowly misses the player
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

  // Generate ice asteroid near-miss with crystalline undertone
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

  // Generate metal asteroid near-miss with metallic ring
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

  // Generate deep rumbling for hive collapse - continuous low-frequency rumble
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

  // Generate cracking/splitting sound for structural failure
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

  // Generate structural groaning sound - building stress before collapse
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
    lfo.frequency.value = 2 + Math.random() * 3;
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

  // Generate heavy debris impact - chunks hitting ground
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

  // Generate alien death scream - agonized screech as hive dies
  generateAlienDeathScream(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Main screech - descending pitch
    const screech = ctx.createOscillator();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(800 + Math.random() * 400, now);
    screech.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    screech.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    // Harmonic for alien quality
    const harmonic = ctx.createOscillator();
    harmonic.type = 'square';
    harmonic.frequency.setValueAtTime(1200 + Math.random() * 300, now);
    harmonic.frequency.exponentialRampToValueAtTime(400, now + 0.4);
    harmonic.frequency.exponentialRampToValueAtTime(150, now + 0.9);

    // Modulation for organic warble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 20 + Math.random() * 15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(screech.frequency);
    lfoGain.connect(harmonic.frequency);

    // Formant filter for throat-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    mainGain.gain.setValueAtTime(volume * 0.7, now + 0.5);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 1);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.3;

    screech.connect(filter);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    screech.start(now);
    screech.stop(now + 1.1);
    harmonic.start(now);
    harmonic.stop(now + 1);
    lfo.start(now);
    lfo.stop(now + 1.1);
  }

  // Generate ground cracking sound - earth splitting apart
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

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Procedural Ambient Sound Generator for level-specific atmospheres
class ProceduralAmbientGenerator {
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

  start(type: NonNullable<LevelAudioConfig['proceduralAmbient']>['type'], intensity: number): void {
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
    lfo.frequency.value = 0.1;
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
    pulseLfo.frequency.value = 0.3;
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
      setTimeout(
        () => {
          const oldPlayer = targetPlayer === 'A' ? this.playerB : this.playerA;
          if (oldPlayer) {
            oldPlayer.stop();
          }
        },
        crossfadeDuration * 1000 + 100
      );
    } catch (error) {
      console.warn('Music playback failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  stop(fadeDuration = 1): void {
    this.masterGain.gain.rampTo(0, fadeDuration);
    setTimeout(
      () => {
        this.playerA?.stop();
        this.playerB?.stop();
        this.currentTrack = null;
        this.masterGain.gain.value = this.volume;
      },
      fadeDuration * 1000 + 100
    );
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
  private ambientGenerator: ProceduralAmbientGenerator;

  private masterVolume = 1.0;
  private sfxVolume = 0.7;
  private musicVolume = 0.5;
  private voiceVolume = 0.8;
  private ambientVolume = 0.5;

  private isMuted = false;
  private currentMusic: Sound | null = null;
  private activeLoops: Map<string, { stop: () => void }> = new Map();

  // Level audio state
  private currentLevelId: LevelId | null = null;
  private currentLevelConfig: LevelAudioConfig | null = null;
  private isInCombat = false;
  private combatTransitionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Procedural music state
  private useProceduralMusic = true; // Enable procedural music by default

  constructor() {
    this.proceduralAudio = new ProceduralAudio();
    this.musicPlayer = new MusicPlayer();
    this.ambientGenerator = new ProceduralAmbientGenerator();
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
          // Legacy weapon fire - use playWeaponFire() for per-weapon sounds
          this.proceduralAudio.generateLaserShot(volume);
          break;
        case 'hit_marker':
          // Use new weapon sound manager for polished hit feedback
          weaponSoundManager.playHitMarker(volume);
          break;
        case 'headshot':
          weaponSoundManager.playHeadshot(volume);
          break;
        case 'kill_confirm':
          weaponSoundManager.playKillConfirmation(volume);
          break;
        case 'weapon_reload':
          // Legacy - use playWeaponReload() for per-weapon sounds
          break;
        case 'weapon_reload_start':
        case 'weapon_reload_complete':
        case 'weapon_empty_click':
          // Handled by specific weapon methods below
          break;
        case 'weapon_switch':
          weaponSoundManager.playWeaponSwitch(volume);
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
        case 'achievement_unlock':
          this.proceduralAudio.generateAchievementUnlock(volume);
          break;
        case 'audio_log_pickup':
          this.proceduralAudio.generateAudioLogPickup(volume);
          break;
        case 'secret_found':
          this.proceduralAudio.generateSecretFound(volume);
          break;
        case 'enemy_death':
          this.proceduralAudio.generateEnemyDeath(volume);
          break;
        case 'alien_screech':
          this.proceduralAudio.generateAlienScreech(volume);
          break;
        case 'alien_growl':
          this.proceduralAudio.generateAlienGrowl(volume);
          break;
        case 'hive_pulse':
          this.proceduralAudio.generateHivePulse(volume);
          break;
        case 'organic_squish':
          this.proceduralAudio.generateOrganicSquish(volume);
          break;
        case 'mech_step':
          this.proceduralAudio.generateMechStep(volume);
          break;
        case 'mech_fire':
          this.proceduralAudio.generateMechFire(volume);
          break;
        case 'explosion':
          this.proceduralAudio.generateExplosion(volume);
          break;
        // Enemy-specific sounds
        case 'alien_footstep':
          this.proceduralAudio.generateAlienFootstep(volume);
          break;
        case 'alien_attack':
          this.proceduralAudio.generateAlienAttack(volume);
          break;
        case 'alien_spawn':
          this.proceduralAudio.generateAlienSpawn(volume);
          break;
        case 'alien_alert':
          this.proceduralAudio.generateAlienAlert(volume);
          break;
        case 'alien_chittering':
          this.proceduralAudio.generateAlienChittering(volume);
          break;
        case 'alien_heavy_step':
          this.proceduralAudio.generateAlienHeavyStep(volume);
          break;
        case 'alien_acid_spit':
          this.proceduralAudio.generateAlienAcidSpit(volume);
          break;
        case 'alien_roar':
          this.proceduralAudio.generateAlienRoar(volume);
          break;
        case 'alien_hiss':
          this.proceduralAudio.generateAlienHiss(volume);
          break;
        // HALO drop near-miss sounds
        case 'near_miss_whoosh':
          this.proceduralAudio.generateNearMissWhoosh(volume);
          break;
        case 'near_miss_ice':
          this.proceduralAudio.generateIceNearMissWhoosh(volume);
          break;
        case 'near_miss_metal':
          this.proceduralAudio.generateMetalNearMissWhoosh(volume);
          break;
        // Hive collapse sounds
        case 'collapse_rumble':
          this.proceduralAudio.generateCollapseRumble(volume);
          break;
        case 'collapse_crack':
          this.proceduralAudio.generateCollapseCrack(volume);
          break;
        case 'structure_groan':
          this.proceduralAudio.generateStructureGroan(volume);
          break;
        case 'debris_impact':
          this.proceduralAudio.generateDebrisImpact(volume);
          break;
        case 'alien_death_scream':
          this.proceduralAudio.generateAlienDeathScream(volume);
          break;
        case 'ground_crack':
          this.proceduralAudio.generateGroundCrack(volume);
          break;
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
        case 'dropship_engine':
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
    this.ambientGenerator.setVolume(0);
    weaponSoundManager.mute();
  }

  unmute(): void {
    this.isMuted = false;
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
    weaponSoundManager.unmute();

    // Restore ambient generator volume if we have a level config
    if (this.currentLevelConfig?.proceduralAmbient) {
      const intensity = this.isInCombat ? 0.3 : 1;
      this.ambientGenerator.setVolume(
        this.currentLevelConfig.proceduralAmbient.intensity *
          intensity *
          this.ambientVolume *
          this.masterVolume
      );
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

  // ===== Level-Specific Audio Management =====

  /**
   * Start level-specific audio (music and procedural ambient)
   * Call this when a level loads
   */
  async startLevelAudio(levelId: LevelId): Promise<void> {
    const config = LEVEL_AUDIO_CONFIGS[levelId];
    if (!config) {
      console.warn(`No audio config for level: ${levelId}`);
      return;
    }

    this.currentLevelId = levelId;
    this.currentLevelConfig = config;
    this.isInCombat = false;

    // Set weapon sound environment for proper reverb
    weaponSoundManager.setEnvironmentFromLevel(levelId);

    // Start music (procedural or file-based)
    if (!this.isMuted) {
      // Check if procedural music is enabled for this level
      if (this.useProceduralMusic && config.proceduralMusic?.enabled) {
        // Use procedural Tone.js music
        const procMusic = getProceduralMusicEngine();
        procMusic.setVolume(config.proceduralMusic.volume * this.musicVolume * this.masterVolume);
        await procMusic.start(config.proceduralMusic.environment, 'ambient');
        // Mute the file-based player when using procedural music
        this.musicPlayer.setVolume(0);
      } else {
        // Use file-based music
        await this.musicPlayer.play(config.ambientTrack, 2);
        this.musicPlayer.setVolume(config.ambientVolume * this.musicVolume * this.masterVolume);
      }

      // Start procedural ambient sound effects if configured
      if (config.proceduralAmbient) {
        this.ambientGenerator.start(
          config.proceduralAmbient.type,
          config.proceduralAmbient.intensity * this.ambientVolume * this.masterVolume
        );
      }
    }
  }

  /**
   * Stop level audio (call when level ends or transitions)
   */
  stopLevelAudio(fadeDuration = 1): void {
    // Clear combat state
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }
    this.isInCombat = false;

    // Stop file-based music with fade
    this.musicPlayer.stop(fadeDuration);

    // Stop procedural music
    const procMusic = getProceduralMusicEngine();
    procMusic.stop(fadeDuration);

    // Stop procedural ambient sound effects
    this.ambientGenerator.stop();

    // Clear level state
    this.currentLevelId = null;
    this.currentLevelConfig = null;
  }

  /**
   * Transition to a new level (crossfade between levels)
   */
  async transitionToLevel(newLevelId: LevelId, crossfadeDuration = 2): Promise<void> {
    const newConfig = LEVEL_AUDIO_CONFIGS[newLevelId];
    if (!newConfig) {
      console.warn(`No audio config for level: ${newLevelId}`);
      return;
    }

    // Stop current procedural ambient
    this.ambientGenerator.stop();

    // Update state
    this.currentLevelId = newLevelId;
    this.currentLevelConfig = newConfig;
    this.isInCombat = false;

    if (!this.isMuted) {
      // Crossfade to new ambient track
      await this.musicPlayer.play(newConfig.ambientTrack, crossfadeDuration);
      this.musicPlayer.setVolume(newConfig.ambientVolume * this.musicVolume * this.masterVolume);

      // Start new procedural ambient after a short delay
      if (newConfig.proceduralAmbient) {
        setTimeout(() => {
          if (this.currentLevelId === newLevelId && !this.isMuted) {
            this.ambientGenerator.start(
              newConfig.proceduralAmbient!.type,
              newConfig.proceduralAmbient!.intensity * this.ambientVolume * this.masterVolume
            );
          }
        }, crossfadeDuration * 500); // Start halfway through crossfade
      }
    }
  }

  // ===== Combat State Management =====

  /**
   * Enter combat mode - switch to combat music
   * Call this when enemies are engaged
   */
  async enterCombat(): Promise<void> {
    if (this.isInCombat || !this.currentLevelConfig) return;

    // Clear any pending exit transition
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }

    this.isInCombat = true;

    if (!this.isMuted) {
      // Fade out procedural ambient slightly during combat
      this.ambientGenerator.setVolume(
        (this.currentLevelConfig.proceduralAmbient?.intensity ?? 0.5) *
          0.3 *
          this.ambientVolume *
          this.masterVolume
      );

      // Switch to combat music with quick crossfade
      await this.musicPlayer.play(this.currentLevelConfig.combatTrack, 1);
      this.musicPlayer.setVolume(
        this.currentLevelConfig.combatVolume * this.musicVolume * this.masterVolume
      );
    }
  }

  /**
   * Exit combat mode - return to ambient music
   * Call this when combat ends (no enemies in range)
   * Has a delay to prevent rapid switching
   */
  exitCombat(delayMs = 3000): void {
    if (!this.isInCombat || !this.currentLevelConfig) return;

    // Clear any pending exit transition
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
    }

    // Delay the transition to prevent rapid switching
    this.combatTransitionTimeout = setTimeout(async () => {
      this.isInCombat = false;
      this.combatTransitionTimeout = null;

      if (!this.isMuted && this.currentLevelConfig) {
        // Restore procedural ambient volume
        if (this.currentLevelConfig.proceduralAmbient) {
          this.ambientGenerator.setVolume(
            this.currentLevelConfig.proceduralAmbient.intensity *
              this.ambientVolume *
              this.masterVolume
          );
        }

        // Switch back to ambient music with slower crossfade
        await this.musicPlayer.play(this.currentLevelConfig.ambientTrack, 2);
        this.musicPlayer.setVolume(
          this.currentLevelConfig.ambientVolume * this.musicVolume * this.masterVolume
        );
      }
    }, delayMs);
  }

  /**
   * Check if currently in combat mode
   */
  isInCombatMode(): boolean {
    return this.isInCombat;
  }

  /**
   * Get the current level ID
   */
  getCurrentLevelId(): LevelId | null {
    return this.currentLevelId;
  }

  // ===== Ambient Volume Control =====

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    if (this.currentLevelConfig?.proceduralAmbient) {
      const intensity = this.isInCombat ? 0.3 : 1;
      this.ambientGenerator.setVolume(
        this.currentLevelConfig.proceduralAmbient.intensity *
          intensity *
          this.ambientVolume *
          this.masterVolume
      );
    }
  }

  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
  }

  getVoiceVolume(): number {
    return this.voiceVolume;
  }

  // ===== Victory/Defeat Audio =====

  /**
   * Play victory music (level complete)
   */
  async playVictory(): Promise<void> {
    this.isInCombat = false;
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }

    // Fade out procedural ambient
    this.ambientGenerator.stop();

    if (!this.isMuted) {
      await this.musicPlayer.play('victory', 1.5);
      this.musicPlayer.setVolume(0.7 * this.musicVolume * this.masterVolume);
    }
  }

  /**
   * Play defeat music (player died)
   */
  async playDefeat(): Promise<void> {
    this.isInCombat = false;
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }

    // Fade out procedural ambient
    this.ambientGenerator.stop();

    if (!this.isMuted) {
      await this.musicPlayer.play('defeat', 1);
      this.musicPlayer.setVolume(0.6 * this.musicVolume * this.masterVolume);
    }
  }

  // ===== Dropship Engine (Looping) =====

  /**
   * Start dropship engine sound (for extraction level)
   */
  startDropshipEngine(volume = 0.35): void {
    if (this.isMuted) return;
    if (this.activeLoops.has('dropship_engine')) return;

    try {
      const vol = volume * this.sfxVolume * this.masterVolume;
      const loop = this.proceduralAudio.generateDropshipEngine(vol);
      this.activeLoops.set('dropship_engine', loop);
    } catch (e) {
      console.warn('Dropship engine audio failed', e);
    }
  }

  /**
   * Stop dropship engine sound
   */
  stopDropshipEngine(): void {
    this.stopLoop('dropship_engine');
  }

  // ===== Per-Weapon Sound Effects (Polished) =====

  /**
   * Play weapon fire sound for a specific weapon type
   * Provides distinct, polished sounds per weapon with variation
   */
  playWeaponFire(weaponId: WeaponId, volume = 0.5, distance = 0): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playWeaponFire(weaponId, vol, distance);
  }

  /**
   * Play full weapon reload sequence for a specific weapon
   * Each weapon has unique reload sounds
   */
  playWeaponReload(weaponId: WeaponId, volume = 0.4): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playWeaponReload(weaponId, vol);
  }

  /**
   * Play reload start sound (beginning of reload animation)
   */
  playReloadStart(weaponId: WeaponId, volume = 0.3): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playReloadStart(weaponId, vol);
  }

  /**
   * Play reload complete sound (end of reload animation)
   */
  playReloadComplete(weaponId: WeaponId, volume = 0.4): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playReloadComplete(weaponId, vol);
  }

  /**
   * Play empty click sound when trying to fire with no ammo
   */
  playEmptyClick(weaponId: WeaponId, volume = 0.3): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playEmptyClick(weaponId, vol);
  }

  /**
   * Play weapon switch sound
   */
  playWeaponSwitch(volume = 0.35): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playWeaponSwitch(vol);
  }

  /**
   * Play weapon equip sound - weapon-specific ready sounds
   * Call this when a weapon becomes active/ready after switching
   */
  playWeaponEquip(weaponId: WeaponId, volume = 0.4): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playWeaponEquip(weaponId, vol);
  }

  // ===== Impact Sound Effects =====

  /**
   * Play bullet impact sound based on surface type
   */
  playImpact(surface: ImpactSurface = 'default', volume = 0.3, distance = 0): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playImpact(surface, vol, distance);
  }

  // ===== Feedback Sound Effects =====

  /**
   * Play hit marker sound (confirms damage dealt)
   */
  playHitMarker(volume = 0.25): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playHitMarker(vol);
  }

  /**
   * Play headshot indicator sound
   */
  playHeadshot(volume = 0.35): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playHeadshot(vol);
  }

  /**
   * Play kill confirmation sound
   */
  playKillConfirmation(volume = 0.4): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playKillConfirmation(vol);
  }

  /**
   * Play damage dealt feedback - scales with damage amount
   */
  playDamageDealt(damage: number, volume = 0.2): void {
    if (this.isMuted) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    weaponSoundManager.playDamageDealt(damage, vol);
  }

  // ===== Environmental Audio =====

  /**
   * Set weapon sound environment for reverb (station, surface, hive)
   * Call this when entering a new level or area
   */
  setWeaponSoundEnvironment(environment: EnvironmentType): void {
    weaponSoundManager.setEnvironment(environment);
  }

  /**
   * Set weapon sound environment from level ID
   */
  setWeaponSoundEnvironmentFromLevel(levelId: LevelId): void {
    weaponSoundManager.setEnvironmentFromLevel(levelId);
  }

  // ===== Advanced Environmental Audio (EnvironmentalAudioManager integration) =====

  /**
   * Start environmental audio for a level (uses EnvironmentalAudioManager)
   * This provides rich, layered ambient soundscapes with spatial audio support
   */
  startEnvironmentalAudio(levelId: LevelId, intensity = 1.0): void {
    if (this.isMuted) return;
    const envAudio = getEnvironmentalAudioManager();
    envAudio.setMasterVolume(this.ambientVolume * this.masterVolume);
    envAudio.startEnvironment(levelId, intensity);
  }

  /**
   * Stop environmental audio with fade
   */
  stopEnvironmentalAudio(fadeDuration = 1.0): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.stopEnvironment(fadeDuration);
  }

  /**
   * Update player position for spatial audio calculations
   * Call this every frame from the level update loop
   */
  updatePlayerPositionForAudio(position: { x: number; y: number; z: number }): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.updatePlayerPosition(position);
  }

  /**
   * Add an audio zone to the level (for zone-based audio transitions)
   */
  addAudioZone(zone: AudioZone): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.addZone(zone);
  }

  /**
   * Remove an audio zone
   */
  removeAudioZone(id: string): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.removeZone(id);
  }

  /**
   * Add a spatial sound source at a world position
   * Sound will attenuate based on player distance
   */
  addSpatialSoundSource(source: SpatialSoundSource): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.addSpatialSource(source);
  }

  /**
   * Remove a spatial sound source
   */
  removeSpatialSoundSource(id: string): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.removeSpatialSource(id);
  }

  /**
   * Play emergency klaxon (for station alerts)
   */
  playEmergencyKlaxon(duration = 3): void {
    if (this.isMuted) return;
    const envAudio = getEnvironmentalAudioManager();
    envAudio.playEmergencyKlaxon(duration);
  }

  /**
   * Set environmental audio combat state
   * Reduces ambient intensity during combat
   */
  setEnvironmentalCombatState(inCombat: boolean): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.setCombatState(inCombat);
  }

  /**
   * Set up audio occlusion callback for spatial sounds.
   * The callback should return a value from 0 (clear line of sight) to 1 (fully blocked).
   * When a sound is blocked, it will be muffled (lowpass filtered) and quieter.
   *
   * @param callback - Function that checks line-of-sight and returns occlusion level
   */
  setAudioOcclusionCallback(
    callback:
      | ((
          sourcePos: { x: number; y: number; z: number },
          listenerPos: { x: number; y: number; z: number }
        ) => number)
      | null
  ): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.setOcclusionCallback(callback);
  }

  /**
   * Enable or disable audio occlusion for spatial sounds
   */
  setAudioOcclusionEnabled(enabled: boolean): void {
    const envAudio = getEnvironmentalAudioManager();
    envAudio.setOcclusionEnabled(enabled);
  }

  dispose(): void {
    // Clear combat transition timeout
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }

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
    this.ambientGenerator.dispose();
    weaponSoundManager.dispose();

    // Dispose environmental audio manager
    disposeEnvironmentalAudioManager();

    // Reset state
    this.currentLevelId = null;
    this.currentLevelConfig = null;
    this.isInCombat = false;
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

// Re-export boss music manager for direct access
export { type BossPhase, disposeBossMusicManager, getBossMusicManager } from './BossMusicManager';
// Re-export environmental audio types for external use
export type {
  AudioZone,
  EnvironmentType as EnvironmentalAudioType,
  OcclusionConfig,
  SpatialSoundSource,
  SpatialSoundType,
} from './EnvironmentalAudioManager';
