/**
 * CombatMusicManager - Adaptive combat music system for Stellar Descent
 *
 * Features:
 * - Procedural Tone.js-based combat music that layers over ambient
 * - Dynamic intensity based on enemy count and threat level
 * - Smooth crossfade transitions in/out of combat
 * - Act-specific musical themes (station, surface, hive)
 * - Victory/clear jingle when combat ends
 *
 * Musical Design:
 * - Station: Tense industrial synths, metallic percussion
 * - Surface: Driving drums, aggressive bass, wind elements
 * - Hive: Organic pulses, dissonant horror tones, alien rhythms
 * - Boss: All elements intensified with added urgency
 */

import * as Tone from 'tone';
import type { LevelId } from '../levels/types';
import { getLogger } from './Logger';

const log = getLogger('CombatMusicManager');

// Combat intensity levels (0-1 scale, maps to enemy threat)
export type CombatIntensity = 'none' | 'low' | 'medium' | 'high' | 'boss';

// Act-specific combat themes
export type CombatTheme = 'station' | 'surface' | 'hive' | 'boss';

// Combat music configuration per level
interface CombatMusicConfig {
  theme: CombatTheme;
  baseBpm: number;
  key: string; // Musical key for harmonic coherence
  intensity: number; // Base intensity modifier (0-1)
}

// Map levels to combat music configurations
const LEVEL_COMBAT_CONFIGS: Record<LevelId, CombatMusicConfig> = {
  anchor_station: {
    theme: 'station',
    baseBpm: 120,
    key: 'Dm',
    intensity: 0.3, // Tutorial level, lower intensity
  },
  landfall: {
    theme: 'surface',
    baseBpm: 135,
    key: 'Em',
    intensity: 0.7,
  },
  canyon_run: {
    theme: 'surface',
    baseBpm: 140,
    key: 'Gm',
    intensity: 0.8, // Vehicle chase, driving energy
  },
  fob_delta: {
    theme: 'station',
    baseBpm: 110,
    key: 'Am',
    intensity: 0.8, // Horror atmosphere
  },
  brothers_in_arms: {
    theme: 'surface',
    baseBpm: 145,
    key: 'Gm',
    intensity: 0.9, // Intense mech combat
  },
  southern_ice: {
    theme: 'surface',
    baseBpm: 130,
    key: 'Bm',
    intensity: 0.85, // Frozen wasteland, tense
  },
  the_breach: {
    theme: 'hive',
    baseBpm: 125,
    key: 'Bm',
    intensity: 1.0, // Boss level
  },
  hive_assault: {
    theme: 'boss',
    baseBpm: 150,
    key: 'Dm',
    intensity: 1.0, // Combined arms assault
  },
  extraction: {
    theme: 'surface',
    baseBpm: 150,
    key: 'Dm',
    intensity: 1.0, // Finale urgency
  },
  final_escape: {
    theme: 'boss',
    baseBpm: 160,
    key: 'Em',
    intensity: 1.0, // Maximum intensity vehicle escape
  },
};

// Musical scales for procedural composition
const SCALES: Record<string, number[]> = {
  Dm: [62, 64, 65, 67, 69, 70, 72, 74], // D minor
  Em: [64, 66, 67, 69, 71, 72, 74, 76], // E minor
  Am: [69, 71, 72, 74, 76, 77, 79, 81], // A minor
  Gm: [67, 69, 70, 72, 74, 75, 77, 79], // G minor
  Bm: [71, 73, 74, 76, 78, 79, 81, 83], // B minor
};

// Bass notes for each key (one octave lower)
const BASS_NOTES: Record<string, number[]> = {
  Dm: [38, 41, 43, 45],
  Em: [40, 43, 45, 47],
  Am: [45, 48, 50, 52],
  Gm: [43, 46, 48, 50],
  Bm: [47, 50, 52, 54],
};

export class CombatMusicManager {
  // Audio chain
  private masterGain: Tone.Gain;
  private compressor: Tone.Compressor;
  private lowpassFilter: Tone.Filter;
  private reverb: Tone.Reverb;
  private distortion: Tone.Distortion;

  // Instrument layers
  private bassSynth: Tone.MonoSynth | null = null;
  private leadSynth: Tone.PolySynth | null = null;
  private padSynth: Tone.PolySynth | null = null;
  private drumSampler: Tone.MembraneSynth | null = null;
  private hihatSynth: Tone.MetalSynth | null = null;
  private noiseSynth: Tone.NoiseSynth | null = null;

  // Sequencers for each layer
  private bassSequence: Tone.Sequence | null = null;
  private drumSequence: Tone.Sequence | null = null;
  private hihatSequence: Tone.Sequence | null = null;
  private padSequence: Tone.Sequence | null = null;
  private leadSequence: Tone.Sequence | null = null;

  // State
  private isPlaying = false;
  private currentTheme: CombatTheme = 'surface';
  private currentConfig: CombatMusicConfig | null = null;
  private currentIntensity: CombatIntensity = 'none';
  private intensityValue = 0; // 0-1 continuous value
  private volume = 0.6;
  private isMuted = false;

  // Transition state
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Create effects chain
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });

    this.lowpassFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
      rolloff: -24,
    });

    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.15,
    });

    this.distortion = new Tone.Distortion({
      distortion: 0,
      wet: 0,
    });

    // Master output
    this.masterGain = new Tone.Gain(0);

    // Chain: instruments -> distortion -> compressor -> filter -> reverb -> master -> destination
    this.distortion.connect(this.compressor);
    this.compressor.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  /**
   * Initialize instruments for a specific theme
   */
  private initializeInstruments(theme: CombatTheme): void {
    // Dispose existing instruments
    this.disposeInstruments();

    // Create theme-specific instruments
    switch (theme) {
      case 'station':
        this.createStationInstruments();
        break;
      case 'surface':
        this.createSurfaceInstruments();
        break;
      case 'hive':
        this.createHiveInstruments();
        break;
      case 'boss':
        this.createBossInstruments();
        break;
    }
  }

  /**
   * Station theme: Industrial synths, metallic percussion
   */
  private createStationInstruments(): void {
    // Dark, industrial bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3,
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.3,
        baseFrequency: 100,
        octaves: 2.5,
      },
    }).connect(this.distortion);
    this.bassSynth.volume.value = -8;

    // Metallic lead synth
    this.leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 0.4,
      },
    }).connect(this.distortion);
    this.leadSynth.volume.value = -12;

    // Dark pad for atmosphere
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.5,
        decay: 0.5,
        sustain: 0.8,
        release: 1,
      },
    }).connect(this.distortion);
    this.padSynth.volume.value = -16;

    // Industrial kick
    this.drumSampler = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0.01,
        release: 0.3,
      },
    }).connect(this.distortion);
    this.drumSampler.volume.value = -4;

    // Metallic hi-hat
    this.hihatSynth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.1,
        release: 0.01,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.distortion);
    this.hihatSynth.volume.value = -18;

    // Noise for industrial texture
    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
      },
    }).connect(this.distortion);
    this.noiseSynth.volume.value = -20;
  }

  /**
   * Surface theme: Driving drums, aggressive bass
   */
  private createSurfaceInstruments(): void {
    // Aggressive bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 20 },
      envelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.5,
        release: 0.2,
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.2,
        baseFrequency: 150,
        octaves: 3,
      },
    }).connect(this.distortion);
    this.bassSynth.volume.value = -6;

    // Bright, aggressive lead
    this.leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
      },
    }).connect(this.distortion);
    this.leadSynth.volume.value = -10;

    // Power pad
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.3,
        decay: 0.3,
        sustain: 0.7,
        release: 0.8,
      },
    }).connect(this.distortion);
    this.padSynth.volume.value = -14;

    // Punchy kick drum
    this.drumSampler = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.2,
      },
    }).connect(this.distortion);
    this.drumSampler.volume.value = -2;

    // Crisp hi-hat
    this.hihatSynth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.08,
        release: 0.01,
      },
      harmonicity: 4,
      modulationIndex: 20,
      resonance: 6000,
      octaves: 1,
    }).connect(this.distortion);
    this.hihatSynth.volume.value = -16;

    // White noise for impact
    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
      },
    }).connect(this.distortion);
    this.noiseSynth.volume.value = -22;
  }

  /**
   * Hive theme: Organic pulses, dissonant horror tones
   */
  private createHiveInstruments(): void {
    // Deep, organic bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.1,
        decay: 0.4,
        sustain: 0.6,
        release: 0.5,
      },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.4,
        release: 0.4,
        baseFrequency: 80,
        octaves: 2,
      },
    }).connect(this.distortion);
    this.bassSynth.volume.value = -10;

    // Dissonant, eerie lead
    this.leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.2,
        release: 0.5,
      },
    }).connect(this.distortion);
    this.leadSynth.volume.value = -14;

    // Dark, swelling pad
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 1,
        decay: 0.5,
        sustain: 0.9,
        release: 2,
      },
    }).connect(this.distortion);
    this.padSynth.volume.value = -12;

    // Organic pulse drum
    this.drumSampler = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.01,
        decay: 0.5,
        sustain: 0.1,
        release: 0.4,
      },
    }).connect(this.distortion);
    this.drumSampler.volume.value = -6;

    // Clicking/chittering hi-hat
    this.hihatSynth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.15,
        release: 0.02,
      },
      harmonicity: 8,
      modulationIndex: 40,
      resonance: 2000,
      octaves: 2,
    }).connect(this.distortion);
    this.hihatSynth.volume.value = -20;

    // Organic noise texture
    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.1,
        release: 0.3,
      },
    }).connect(this.distortion);
    this.noiseSynth.volume.value = -18;
  }

  /**
   * Boss theme: All elements intensified
   */
  private createBossInstruments(): void {
    // Heavy, distorted bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 40 },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.6,
        release: 0.3,
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.15,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 120,
        octaves: 4,
      },
    }).connect(this.distortion);
    this.bassSynth.volume.value = -4;

    // Aggressive, screaming lead
    this.leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsquare', spread: 50 },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.5,
        release: 0.3,
      },
    }).connect(this.distortion);
    this.leadSynth.volume.value = -8;

    // Epic pad
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: {
        attack: 0.2,
        decay: 0.4,
        sustain: 0.8,
        release: 1,
      },
    }).connect(this.distortion);
    this.padSynth.volume.value = -10;

    // Massive kick
    this.drumSampler = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 10,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.5,
        sustain: 0.01,
        release: 0.3,
      },
    }).connect(this.distortion);
    this.drumSampler.volume.value = 0;

    // Aggressive hi-hat
    this.hihatSynth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.06,
        release: 0.01,
      },
      harmonicity: 3,
      modulationIndex: 16,
      resonance: 8000,
      octaves: 1,
    }).connect(this.distortion);
    this.hihatSynth.volume.value = -14;

    // Intense noise bursts
    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.08,
      },
    }).connect(this.distortion);
    this.noiseSynth.volume.value = -18;
  }

  /**
   * Create sequences based on intensity level
   */
  private createSequences(config: CombatMusicConfig): void {
    this.disposeSequences();

    const scale = SCALES[config.key] || SCALES.Dm;
    const bassNotes = BASS_NOTES[config.key] || BASS_NOTES.Dm;

    // Set tempo
    Tone.getTransport().bpm.value = config.baseBpm;

    // Bass sequence - plays root notes with rhythmic pattern
    const bassPattern = this.generateBassPattern(config.theme);
    this.bassSequence = new Tone.Sequence(
      (time, note) => {
        if (note !== null && this.bassSynth && this.intensityValue > 0.1) {
          const midiNote = bassNotes[note % bassNotes.length];
          this.bassSynth.triggerAttackRelease(
            Tone.Frequency(midiNote, 'midi').toFrequency(),
            '8n',
            time
          );
        }
      },
      bassPattern,
      '8n'
    );

    // Drum sequence - kick drum pattern based on intensity
    const drumPattern = this.generateDrumPattern(config.theme);
    this.drumSequence = new Tone.Sequence(
      (time, hit) => {
        if (hit && this.drumSampler && this.intensityValue > 0.2) {
          this.drumSampler.triggerAttackRelease('C1', '8n', time);
        }
      },
      drumPattern,
      '16n'
    );

    // Hi-hat sequence - 16th note pattern
    const hihatPattern = this.generateHihatPattern(config.theme);
    this.hihatSequence = new Tone.Sequence(
      (time, velocity) => {
        if (velocity > 0 && this.hihatSynth && this.intensityValue > 0.3) {
          this.hihatSynth.triggerAttackRelease('16n', time, velocity * 0.5);
        }
      },
      hihatPattern,
      '16n'
    );

    // Pad sequence - sustained chords
    const padPattern = this.generatePadPattern(scale);
    this.padSequence = new Tone.Sequence(
      (time, chord) => {
        if (chord && Array.isArray(chord) && this.padSynth && this.intensityValue > 0.1) {
          const frequencies = chord.map((n: number) => Tone.Frequency(n, 'midi').toFrequency());
          this.padSynth.triggerAttackRelease(frequencies, '2n', time, 0.3);
        }
      },
      padPattern,
      '1n'
    );

    // Lead sequence - melodic riffs (only at higher intensity)
    const leadPattern = this.generateLeadPattern(scale, config.theme);
    this.leadSequence = new Tone.Sequence(
      (time, note) => {
        if (note !== null && this.leadSynth && this.intensityValue > 0.5) {
          this.leadSynth.triggerAttackRelease(
            Tone.Frequency(note, 'midi').toFrequency(),
            '16n',
            time,
            0.7
          );
        }
      },
      leadPattern,
      '16n'
    );
  }

  /**
   * Generate bass pattern based on theme
   */
  private generateBassPattern(theme: CombatTheme): (number | null)[] {
    switch (theme) {
      case 'station':
        // Industrial, syncopated
        return [0, null, 0, null, 1, null, null, 0, null, 2, null, null, 0, null, 1, null];
      case 'surface':
        // Driving, aggressive
        return [0, null, 0, 0, null, 1, null, 0, 2, null, 0, null, 1, null, 0, null];
      case 'hive':
        // Organic, pulsing
        return [0, null, null, null, 1, null, null, null, 0, null, null, 2, null, null, null, null];
      case 'boss':
        // Intense, relentless
        return [0, 0, null, 0, 1, null, 0, null, 2, null, 0, 0, 1, null, 0, null];
      default:
        return [0, null, null, null, 1, null, null, null, 0, null, null, null, 1, null, null, null];
    }
  }

  /**
   * Generate drum pattern based on theme
   */
  private generateDrumPattern(theme: CombatTheme): boolean[] {
    switch (theme) {
      case 'station':
        // Industrial 4/4 with ghost notes
        return [
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
        ];
      case 'surface':
        // Driving double-time feel
        return [
          true,
          false,
          false,
          true,
          false,
          false,
          true,
          false,
          true,
          false,
          false,
          true,
          false,
          false,
          true,
          false,
        ];
      case 'hive':
        // Organic pulse
        return [
          true,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
        ];
      case 'boss':
        // Relentless
        return [
          true,
          false,
          true,
          false,
          true,
          false,
          false,
          true,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
        ];
      default:
        return [
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ];
    }
  }

  /**
   * Generate hi-hat pattern based on theme
   */
  private generateHihatPattern(theme: CombatTheme): number[] {
    switch (theme) {
      case 'station':
        // Mechanical, steady
        return [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4];
      case 'surface':
        // Aggressive, accented
        return [1, 0.3, 0.5, 0.3, 1, 0.3, 0.5, 0.3, 1, 0.3, 0.5, 0.3, 1, 0.3, 0.7, 0.5];
      case 'hive':
        // Clicking, irregular
        return [0, 0.5, 0, 0.3, 0.7, 0, 0.4, 0, 0, 0.6, 0, 0.3, 0.5, 0, 0.4, 0];
      case 'boss':
        // Intense, continuous
        return [1, 0.5, 0.7, 0.5, 1, 0.5, 0.8, 0.6, 1, 0.5, 0.7, 0.5, 1, 0.6, 0.9, 0.7];
      default:
        return [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4];
    }
  }

  /**
   * Generate pad chord pattern
   */
  private generatePadPattern(scale: number[]): (number[] | null)[] {
    // Create chord voicings from scale
    const i = [scale[0], scale[2], scale[4]]; // i chord
    const iv = [scale[3], scale[5], scale[0] + 12]; // iv chord
    const v = [scale[4], scale[6], scale[1] + 12]; // v chord
    const vi = [scale[5], scale[0] + 12, scale[2] + 12]; // vi chord

    return [i, null, iv, null, v, null, i, null];
  }

  /**
   * Generate lead melody pattern
   */
  private generateLeadPattern(scale: number[], theme: CombatTheme): (number | null)[] {
    // Different melodic patterns per theme
    switch (theme) {
      case 'station':
        // Minimal, tension-building
        return [
          scale[0],
          null,
          null,
          null,
          scale[2],
          null,
          scale[1],
          null,
          null,
          null,
          null,
          null,
          scale[4],
          null,
          null,
          null,
        ];
      case 'surface':
        // Aggressive, driving
        return [
          scale[4],
          null,
          scale[3],
          null,
          scale[2],
          null,
          scale[0],
          null,
          scale[4],
          scale[5],
          null,
          scale[3],
          null,
          scale[2],
          null,
          scale[0],
        ];
      case 'hive':
        // Eerie, chromatic touches
        return [
          scale[0],
          null,
          null,
          scale[1],
          null,
          null,
          null,
          scale[0] - 1, // chromatic
          null,
          scale[0],
          null,
          null,
          scale[2],
          null,
          null,
          null,
        ];
      case 'boss':
        // Intense, heroic
        return [
          scale[0],
          scale[2],
          null,
          scale[4],
          null,
          scale[5],
          scale[4],
          null,
          scale[7],
          null,
          scale[5],
          null,
          scale[4],
          null,
          scale[2],
          scale[0],
        ];
      default:
        return [
          scale[0],
          null,
          null,
          null,
          scale[2],
          null,
          null,
          null,
          scale[4],
          null,
          null,
          null,
          scale[2],
          null,
          null,
          null,
        ];
    }
  }

  /**
   * Start combat music for a level
   */
  async startCombat(levelId: LevelId, initialIntensity: CombatIntensity = 'low'): Promise<void> {
    if (this.isMuted) return;

    const config = LEVEL_COMBAT_CONFIGS[levelId];
    if (!config) {
      log.warn(`No combat config for level: ${levelId}`);
      return;
    }

    // Start Tone.js if needed
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    this.currentConfig = config;
    this.currentTheme = config.theme;

    // Initialize instruments for this theme
    this.initializeInstruments(config.theme);

    // Create sequences
    this.createSequences(config);

    // Set initial intensity
    this.setIntensityLevel(initialIntensity);

    // Fade in
    this.isPlaying = true;
    this.masterGain.gain.rampTo(this.volume, 1);

    // Apply theme-specific effects
    this.applyThemeEffects(config.theme);

    // Start all sequences
    this.bassSequence?.start(0);
    this.drumSequence?.start(0);
    this.hihatSequence?.start(0);
    this.padSequence?.start(0);
    this.leadSequence?.start(0);

    // Start transport
    Tone.getTransport().start();

    log.info(
      `Started combat music: ${config.theme} theme @ ${config.baseBpm} BPM`
    );
  }

  /**
   * Apply theme-specific audio effects
   */
  private applyThemeEffects(theme: CombatTheme): void {
    switch (theme) {
      case 'station':
        this.distortion.distortion = 0.2;
        this.distortion.wet.value = 0.3;
        this.reverb.decay = 3;
        this.reverb.wet.value = 0.2;
        break;
      case 'surface':
        this.distortion.distortion = 0.3;
        this.distortion.wet.value = 0.4;
        this.reverb.decay = 1.5;
        this.reverb.wet.value = 0.1;
        break;
      case 'hive':
        this.distortion.distortion = 0.15;
        this.distortion.wet.value = 0.2;
        this.reverb.decay = 4;
        this.reverb.wet.value = 0.3;
        break;
      case 'boss':
        this.distortion.distortion = 0.4;
        this.distortion.wet.value = 0.5;
        this.reverb.decay = 2;
        this.reverb.wet.value = 0.15;
        break;
    }
  }

  /**
   * Stop combat music with fade
   */
  stopCombat(fadeDuration = 2): void {
    if (!this.isPlaying) return;

    // Clear any pending transitions
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }

    // Fade out
    this.masterGain.gain.rampTo(0, fadeDuration);

    // Stop after fade
    this.transitionTimeout = setTimeout(
      () => {
        this.isPlaying = false;
        Tone.getTransport().stop();

        this.disposeSequences();
        this.disposeInstruments();

        this.currentIntensity = 'none';
        this.intensityValue = 0;

        log.info('Combat music stopped');
      },
      fadeDuration * 1000 + 100
    );
  }

  /**
   * Set combat intensity level (affects which layers play)
   */
  setIntensityLevel(intensity: CombatIntensity): void {
    if (this.currentIntensity === intensity) return;

    this.currentIntensity = intensity;

    // Map intensity to continuous value
    switch (intensity) {
      case 'none':
        this.intensityValue = 0;
        break;
      case 'low':
        this.intensityValue = 0.3;
        break;
      case 'medium':
        this.intensityValue = 0.6;
        break;
      case 'high':
        this.intensityValue = 0.85;
        break;
      case 'boss':
        this.intensityValue = 1.0;
        break;
    }

    // Adjust effects based on intensity
    this.updateIntensityEffects();

    log.info(`Intensity set to: ${intensity} (${this.intensityValue})`);
  }

  /**
   * Set continuous intensity value (0-1)
   */
  setIntensityValue(value: number): void {
    this.intensityValue = Math.max(0, Math.min(1, value));

    // Map to discrete level for logging
    if (this.intensityValue < 0.1) {
      this.currentIntensity = 'none';
    } else if (this.intensityValue < 0.4) {
      this.currentIntensity = 'low';
    } else if (this.intensityValue < 0.7) {
      this.currentIntensity = 'medium';
    } else if (this.intensityValue < 0.9) {
      this.currentIntensity = 'high';
    } else {
      this.currentIntensity = 'boss';
    }

    this.updateIntensityEffects();
  }

  /**
   * Update effects based on current intensity
   */
  private updateIntensityEffects(): void {
    if (!this.isPlaying || !this.currentConfig) return;

    // Scale BPM slightly with intensity
    const bpmBoost = this.intensityValue * 15;
    Tone.getTransport().bpm.rampTo(this.currentConfig.baseBpm + bpmBoost, 2);

    // Increase distortion with intensity
    this.distortion.wet.rampTo(this.intensityValue * 0.5, 1);

    // Open filter as intensity increases
    const filterFreq = 2000 + this.intensityValue * 18000;
    this.lowpassFilter.frequency.rampTo(filterFreq, 1);

    // Adjust reverb (less reverb at high intensity for clarity)
    this.reverb.wet.rampTo(0.3 - this.intensityValue * 0.2, 1);
  }

  /**
   * Calculate intensity from enemy count and threat
   * Call this from combat system to dynamically adjust music
   */
  calculateIntensityFromEnemies(
    enemyCount: number,
    maxExpectedEnemies: number,
    hasActiveBoss = false,
    playerHealthPercent = 1.0
  ): CombatIntensity {
    if (hasActiveBoss) return 'boss';
    if (enemyCount === 0) return 'none';

    // Base intensity from enemy count
    const countRatio = Math.min(enemyCount / maxExpectedEnemies, 1);

    // Increase intensity if player health is low
    const healthModifier = playerHealthPercent < 0.3 ? 0.2 : playerHealthPercent < 0.5 ? 0.1 : 0;

    const totalIntensity = countRatio + healthModifier;

    if (totalIntensity >= 0.8) return 'high';
    if (totalIntensity >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Play victory fanfare when combat ends
   */
  playVictoryJingle(): void {
    if (this.isMuted) return;

    // Create a quick victory synth
    const victorySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.2,
        release: 0.5,
      },
    });

    const victoryGain = new Tone.Gain(0.4);
    const victoryReverb = new Tone.Reverb({ decay: 2, wet: 0.3 });

    victorySynth.connect(victoryGain);
    victoryGain.connect(victoryReverb);
    victoryReverb.toDestination();

    // Play a triumphant arpeggio
    const now = Tone.now();
    const notes = ['C4', 'E4', 'G4', 'C5'];

    notes.forEach((note, i) => {
      victorySynth.triggerAttackRelease(note, '8n', now + i * 0.12, 0.8);
    });

    // Final chord
    victorySynth.triggerAttackRelease(['C5', 'E5', 'G5'], '2n', now + 0.5, 0.6);

    // Clean up after
    setTimeout(() => {
      victorySynth.dispose();
      victoryGain.dispose();
      victoryReverb.dispose();
    }, 3000);

    log.info('Victory jingle played');
  }

  /**
   * Play combat clear stinger (brief fanfare when area is cleared)
   */
  playClearStinger(): void {
    if (this.isMuted) return;

    const stingerSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.1,
        release: 0.3,
      },
    });

    const stingerGain = new Tone.Gain(0.3);
    stingerSynth.connect(stingerGain);
    stingerGain.toDestination();

    // Quick ascending notes
    const now = Tone.now();
    stingerSynth.triggerAttackRelease('E4', '16n', now);
    stingerSynth.triggerAttackRelease('G4', '16n', now + 0.08);
    stingerSynth.triggerAttackRelease('B4', '8n', now + 0.16);

    setTimeout(() => {
      stingerSynth.dispose();
      stingerGain.dispose();
    }, 1000);

    log.info('Clear stinger played');
  }

  /**
   * Set master volume
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.isPlaying && !this.isMuted) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  /**
   * Mute combat music
   */
  mute(): void {
    this.isMuted = true;
    this.masterGain.gain.rampTo(0, 0.1);
  }

  /**
   * Unmute combat music
   */
  unmute(): void {
    this.isMuted = false;
    if (this.isPlaying) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  /**
   * Check if combat music is currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current intensity
   */
  getIntensity(): CombatIntensity {
    return this.currentIntensity;
  }

  /**
   * Get current theme
   */
  getTheme(): CombatTheme {
    return this.currentTheme;
  }

  /**
   * Dispose sequences
   */
  private disposeSequences(): void {
    this.bassSequence?.stop();
    this.bassSequence?.dispose();
    this.bassSequence = null;

    this.drumSequence?.stop();
    this.drumSequence?.dispose();
    this.drumSequence = null;

    this.hihatSequence?.stop();
    this.hihatSequence?.dispose();
    this.hihatSequence = null;

    this.padSequence?.stop();
    this.padSequence?.dispose();
    this.padSequence = null;

    this.leadSequence?.stop();
    this.leadSequence?.dispose();
    this.leadSequence = null;
  }

  /**
   * Dispose instruments
   */
  private disposeInstruments(): void {
    this.bassSynth?.dispose();
    this.bassSynth = null;

    this.leadSynth?.dispose();
    this.leadSynth = null;

    this.padSynth?.dispose();
    this.padSynth = null;

    this.drumSampler?.dispose();
    this.drumSampler = null;

    this.hihatSynth?.dispose();
    this.hihatSynth = null;

    this.noiseSynth?.dispose();
    this.noiseSynth = null;
  }

  /**
   * Full cleanup
   */
  dispose(): void {
    // Clear timeouts
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }

    // Stop playback
    if (this.isPlaying) {
      Tone.getTransport().stop();
    }

    // Dispose all
    this.disposeSequences();
    this.disposeInstruments();

    this.masterGain.dispose();
    this.compressor.dispose();
    this.lowpassFilter.dispose();
    this.reverb.dispose();
    this.distortion.dispose();

    this.isPlaying = false;
  }
}

// Singleton instance
let combatMusicManagerInstance: CombatMusicManager | null = null;

export function getCombatMusicManager(): CombatMusicManager {
  if (!combatMusicManagerInstance) {
    combatMusicManagerInstance = new CombatMusicManager();
  }
  return combatMusicManagerInstance;
}

export function disposeCombatMusicManager(): void {
  if (combatMusicManagerInstance) {
    combatMusicManagerInstance.dispose();
    combatMusicManagerInstance = null;
  }
}
