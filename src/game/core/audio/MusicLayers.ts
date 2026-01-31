/**
 * MusicLayers - Adaptive Music Layer System for Stellar Descent
 *
 * Defines a 5-layer music system that syncs with gameplay state:
 * - Layer 0: Ambient pad (always playing, low volume)
 * - Layer 1: Percussion (combat detected)
 * - Layer 2: Bass line (enemies nearby)
 * - Layer 3: Synth stabs (taking/dealing damage)
 * - Layer 4: Lead melody (intense combat)
 *
 * Features:
 * - Smooth crossfade transitions (2 seconds)
 * - Quantized to musical bars (4 beats)
 * - Level-specific music themes
 * - Boss music override support
 * - Combat exit handling with gradual de-escalation
 */

import * as Tone from 'tone';
import type { LevelId } from '../../levels/types';

// ============================================================================
// TYPES
// ============================================================================

/** Combat state for intensity calculation */
export interface CombatState {
  nearbyEnemies: number;
  recentDamageDealt: number;
  recentDamageTaken: number;
  playerHealthPercent: number;
  bossActive: boolean;
}

/** Layer definitions */
export enum MusicLayerType {
  AMBIENT_PAD = 0,
  PERCUSSION = 1,
  BASS_LINE = 2,
  SYNTH_STABS = 3,
  LEAD_MELODY = 4,
}

/** Layer state */
export interface LayerState {
  type: MusicLayerType;
  isActive: boolean;
  targetVolume: number;
  currentVolume: number;
  fadeStartTime: number;
  fadeDuration: number;
}

/** Level music theme configuration */
export interface LevelMusicTheme {
  levelId: LevelId;
  key: string;
  tempo: number;
  ambientVolume: number;
  combatVolume: number;
  style: 'industrial' | 'desolate' | 'organic' | 'urgent' | 'horror' | 'frozen';
}

/** Boss music configuration */
export interface BossMusicConfig {
  key: string;
  tempo: number;
  phases: number;
  victoryStingDuration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Transition timing constants */
export const TRANSITION_TIMING = {
  CROSSFADE_DURATION: 2, // 2 seconds for smooth crossfade
  BAR_QUANTIZATION: 4, // 4 beats per bar
  COMBAT_EXIT_DELAY: 5000, // Wait 5 seconds after last enemy
  LAYER_REMOVAL_INTERVAL: 2000, // Remove one layer per 2 seconds
  AMBIENT_RETURN_DURATION: 10, // 10 seconds to return to ambient
} as const;

/** Layer volume ranges */
export const LAYER_VOLUMES = {
  [MusicLayerType.AMBIENT_PAD]: { min: 0.2, max: 0.4 },
  [MusicLayerType.PERCUSSION]: { min: 0, max: 0.6 },
  [MusicLayerType.BASS_LINE]: { min: 0, max: 0.5 },
  [MusicLayerType.SYNTH_STABS]: { min: 0, max: 0.45 },
  [MusicLayerType.LEAD_MELODY]: { min: 0, max: 0.5 },
} as const;

/** Level music themes */
export const LEVEL_MUSIC_THEMES: Record<LevelId, LevelMusicTheme> = {
  anchor_station: {
    levelId: 'anchor_station',
    key: 'Dm',
    tempo: 90,
    ambientVolume: 0.35,
    combatVolume: 0.55,
    style: 'industrial',
  },
  landfall: {
    levelId: 'landfall',
    key: 'Em',
    tempo: 110,
    ambientVolume: 0.4,
    combatVolume: 0.65,
    style: 'desolate',
  },
  canyon_run: {
    levelId: 'canyon_run',
    key: 'Gm',
    tempo: 130,
    ambientVolume: 0.45,
    combatVolume: 0.75,
    style: 'urgent',
  },
  fob_delta: {
    levelId: 'fob_delta',
    key: 'Am',
    tempo: 85,
    ambientVolume: 0.3,
    combatVolume: 0.6,
    style: 'horror',
  },
  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    key: 'Gm',
    tempo: 125,
    ambientVolume: 0.45,
    combatVolume: 0.8,
    style: 'urgent',
  },
  southern_ice: {
    levelId: 'southern_ice',
    key: 'Bm',
    tempo: 100,
    ambientVolume: 0.35,
    combatVolume: 0.65,
    style: 'frozen',
  },
  the_breach: {
    levelId: 'the_breach',
    key: 'Bm',
    tempo: 95,
    ambientVolume: 0.4,
    combatVolume: 0.75,
    style: 'organic',
  },
  hive_assault: {
    levelId: 'hive_assault',
    key: 'Dm',
    tempo: 135,
    ambientVolume: 0.5,
    combatVolume: 0.85,
    style: 'organic',
  },
  extraction: {
    levelId: 'extraction',
    key: 'Dm',
    tempo: 140,
    ambientVolume: 0.5,
    combatVolume: 0.9,
    style: 'urgent',
  },
  final_escape: {
    levelId: 'final_escape',
    key: 'Em',
    tempo: 150,
    ambientVolume: 0.55,
    combatVolume: 0.95,
    style: 'urgent',
  },
};

/** Musical scales by key */
export const SCALES: Record<string, number[]> = {
  Dm: [62, 64, 65, 67, 69, 70, 72], // D minor
  Em: [64, 66, 67, 69, 71, 72, 74], // E minor
  Am: [69, 71, 72, 74, 76, 77, 79], // A minor
  Gm: [67, 69, 70, 72, 74, 75, 77], // G minor
  Bm: [71, 73, 74, 76, 78, 79, 81], // B minor
};

/** Bass notes for each key (one octave lower) */
export const BASS_NOTES: Record<string, number[]> = {
  Dm: [38, 41, 43, 45, 50],
  Em: [40, 43, 45, 47, 52],
  Am: [45, 48, 50, 52, 57],
  Gm: [43, 46, 48, 50, 55],
  Bm: [47, 50, 52, 54, 59],
};

/** Chord progressions by key */
export const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  Dm: [
    [62, 65, 69], // Dm
    [60, 64, 67], // C
    [65, 69, 72], // F
    [67, 70, 74], // Gm
  ],
  Em: [
    [64, 67, 71], // Em
    [62, 66, 69], // D
    [67, 71, 74], // G
    [69, 72, 76], // Am
  ],
  Am: [
    [69, 72, 76], // Am
    [67, 71, 74], // G
    [65, 69, 72], // F
    [64, 67, 71], // Em
  ],
  Gm: [
    [67, 70, 74], // Gm
    [65, 69, 72], // F
    [63, 67, 70], // Eb
    [62, 65, 69], // Dm
  ],
  Bm: [
    [71, 74, 78], // Bm
    [69, 73, 76], // A
    [67, 71, 74], // G
    [66, 69, 73], // F#m
  ],
};

// ============================================================================
// MUSIC LAYER CLASS
// ============================================================================

/**
 * Individual music layer with its own synth and pattern
 */
export class MusicLayer {
  readonly type: MusicLayerType;
  private gain: Tone.Gain;
  private nodes: Tone.ToneAudioNode[] = [];
  private patterns: (Tone.Loop | Tone.Sequence<unknown>)[] = [];
  private isActive = false;
  private targetVolume = 0;

  constructor(type: MusicLayerType, destination: Tone.InputNode) {
    this.type = type;
    this.gain = new Tone.Gain(0);
    this.gain.connect(destination);
  }

  /**
   * Get the gain node for connecting instruments
   */
  getGain(): Tone.Gain {
    return this.gain;
  }

  /**
   * Add a node to be managed by this layer
   */
  addNode(node: Tone.ToneAudioNode): void {
    this.nodes.push(node);
  }

  /**
   * Add a pattern to be managed by this layer
   */
  addPattern(pattern: Tone.Loop | Tone.Sequence<unknown>): void {
    this.patterns.push(pattern);
  }

  /**
   * Start all patterns
   */
  startPatterns(): void {
    for (const pattern of this.patterns) {
      pattern.start(0);
    }
  }

  /**
   * Stop all patterns
   */
  stopPatterns(): void {
    for (const pattern of this.patterns) {
      pattern.stop();
    }
  }

  /**
   * Activate layer with crossfade
   */
  activate(duration: number = TRANSITION_TIMING.CROSSFADE_DURATION): void {
    if (this.isActive) return;
    this.isActive = true;

    const volumeRange = LAYER_VOLUMES[this.type];
    this.targetVolume = volumeRange.max;
    this.gain.gain.rampTo(this.targetVolume, duration);
  }

  /**
   * Deactivate layer with crossfade
   */
  deactivate(duration: number = TRANSITION_TIMING.CROSSFADE_DURATION): void {
    if (!this.isActive) return;
    this.isActive = false;

    const volumeRange = LAYER_VOLUMES[this.type];
    this.targetVolume = this.type === MusicLayerType.AMBIENT_PAD ? volumeRange.min : 0;
    this.gain.gain.rampTo(this.targetVolume, duration);
  }

  /**
   * Set layer volume directly
   */
  setVolume(volume: number, duration: number = 0.1): void {
    this.targetVolume = volume;
    this.gain.gain.rampTo(volume, duration);
  }

  /**
   * Check if layer is currently active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopPatterns();

    for (const pattern of this.patterns) {
      pattern.dispose();
    }
    this.patterns = [];

    for (const node of this.nodes) {
      try {
        node.dispose();
      } catch {
        // Node may already be disposed
      }
    }
    this.nodes = [];

    this.gain.dispose();
  }
}

// ============================================================================
// INTENSITY CALCULATOR
// ============================================================================

/**
 * Calculate combat intensity from game state
 * Returns a value from 0 (peaceful) to 1 (maximum intensity)
 */
export function calculateCombatIntensity(state: CombatState): number {
  if (state.bossActive) {
    return 1.0;
  }

  // Base intensity from nearby enemies (0 enemies = 0, 5+ enemies = 0.5)
  const enemyIntensity = Math.min(state.nearbyEnemies / 5, 0.5);

  // Damage intensity (recent combat activity)
  const damageIntensity = Math.min((state.recentDamageDealt + state.recentDamageTaken) / 100, 0.3);

  // Health urgency (low health increases intensity)
  const healthUrgency = state.playerHealthPercent < 0.3 ? 0.2 : state.playerHealthPercent < 0.5 ? 0.1 : 0;

  return Math.min(enemyIntensity + damageIntensity + healthUrgency, 1.0);
}

/**
 * Determine which layers should be active based on intensity
 */
export function getActiveLayersForIntensity(intensity: number): MusicLayerType[] {
  const layers: MusicLayerType[] = [MusicLayerType.AMBIENT_PAD]; // Always active

  if (intensity >= 0.1) {
    layers.push(MusicLayerType.PERCUSSION);
  }
  if (intensity >= 0.25) {
    layers.push(MusicLayerType.BASS_LINE);
  }
  if (intensity >= 0.5) {
    layers.push(MusicLayerType.SYNTH_STABS);
  }
  if (intensity >= 0.75) {
    layers.push(MusicLayerType.LEAD_MELODY);
  }

  return layers;
}

// ============================================================================
// QUANTIZATION UTILITIES
// ============================================================================

/**
 * Get the next bar boundary time for quantized transitions
 */
export function getNextBarTime(tempo: number): number {
  const secondsPerBeat = 60 / tempo;
  const secondsPerBar = secondsPerBeat * TRANSITION_TIMING.BAR_QUANTIZATION;
  const now = Tone.getTransport().seconds;

  // Calculate the next bar boundary
  const currentBar = Math.floor(now / secondsPerBar);
  const nextBarTime = (currentBar + 1) * secondsPerBar;

  return nextBarTime;
}

/**
 * Schedule a callback at the next bar boundary
 */
export function scheduleAtNextBar(tempo: number, callback: () => void): number {
  const nextBarTime = getNextBarTime(tempo);
  return Tone.getTransport().schedule(callback, nextBarTime);
}

// ============================================================================
// SYNTH FACTORIES FOR EACH STYLE
// ============================================================================

export interface LayerSynthSet {
  ambient: Tone.PolySynth | null;
  percussion: Tone.MembraneSynth | null;
  hihat: Tone.MetalSynth | null;
  bass: Tone.MonoSynth | null;
  stabs: Tone.PolySynth | null;
  lead: Tone.MonoSynth | null;
}

/**
 * Create synths for industrial style (station levels)
 */
export function createIndustrialSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.5, decay: 1, sustain: 0.8, release: 2 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.3,
        baseFrequency: 100,
        octaves: 2.5,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.2,
        baseFrequency: 500,
        octaves: 3,
      },
    }),
  };
}

/**
 * Create synths for desolate style (surface/landfall levels)
 */
export function createDesolateSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 2, decay: 1.5, sustain: 0.7, release: 3 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.02, release: 0.4 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.02 },
      harmonicity: 3,
      modulationIndex: 20,
      resonance: 3000,
      octaves: 1,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.4 },
      filterEnvelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 80,
        octaves: 2,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.2, release: 0.5 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.5 },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 400,
        octaves: 2,
      },
    }),
  };
}

/**
 * Create synths for organic style (hive levels)
 */
export function createOrganicSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2.5, decay: 2, sustain: 0.9, release: 3 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.12,
      octaves: 3,
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.5 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.2, release: 0.03 },
      harmonicity: 8,
      modulationIndex: 40,
      resonance: 2000,
      octaves: 2,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0.6, release: 0.5 },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.4,
        sustain: 0.5,
        release: 0.4,
        baseFrequency: 60,
        octaves: 2,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.2, release: 0.6 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.3, release: 0.6 },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.3,
        release: 0.4,
        baseFrequency: 300,
        octaves: 2,
      },
    }),
  };
}

/**
 * Create synths for urgent style (chase/extraction levels)
 */
export function createUrgentSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.7, release: 1 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0.01, release: 0.2 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
      harmonicity: 4,
      modulationIndex: 18,
      resonance: 6000,
      octaves: 1,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 20 },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.2 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.4,
        release: 0.2,
        baseFrequency: 150,
        octaves: 3,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', spread: 25 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.3 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.08,
        sustain: 0.4,
        release: 0.2,
        baseFrequency: 600,
        octaves: 3.5,
      },
    }),
  };
}

/**
 * Create synths for horror style (FOB Delta)
 */
export function createHorrorSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 3, decay: 2, sustain: 0.9, release: 4 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.15,
      octaves: 2,
      envelope: { attack: 0.05, decay: 0.6, sustain: 0.2, release: 0.6 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.002, decay: 0.25, release: 0.05 },
      harmonicity: 12,
      modulationIndex: 50,
      resonance: 1500,
      octaves: 2.5,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.6, sustain: 0.7, release: 0.6 },
      filterEnvelope: {
        attack: 0.2,
        decay: 0.5,
        sustain: 0.5,
        release: 0.5,
        baseFrequency: 50,
        octaves: 1.5,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.4, sustain: 0.1, release: 0.8 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.2, decay: 0.5, sustain: 0.2, release: 0.8 },
      filterEnvelope: {
        attack: 0.2,
        decay: 0.4,
        sustain: 0.2,
        release: 0.5,
        baseFrequency: 200,
        octaves: 1.5,
      },
    }),
  };
}

/**
 * Create synths for frozen style (Southern Ice)
 */
export function createFrozenSynths(): LayerSynthSet {
  return {
    ambient: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1.5, sustain: 0.85, release: 3 },
    }),
    percussion: new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5,
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.02, release: 0.35 },
    }),
    hihat: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.12, release: 0.02 },
      harmonicity: 6,
      modulationIndex: 28,
      resonance: 5000,
      octaves: 1.2,
    }),
    bass: new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.08, decay: 0.4, sustain: 0.5, release: 0.4 },
      filterEnvelope: {
        attack: 0.08,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 90,
        octaves: 2,
      },
    }),
    stabs: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.25, release: 0.5 },
    }),
    lead: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.35, sustain: 0.45, release: 0.5 },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.25,
        sustain: 0.4,
        release: 0.35,
        baseFrequency: 450,
        octaves: 2.2,
      },
    }),
  };
}

/**
 * Get synth factory for a given style
 */
export function getSynthFactoryForStyle(
  style: LevelMusicTheme['style']
): () => LayerSynthSet {
  switch (style) {
    case 'industrial':
      return createIndustrialSynths;
    case 'desolate':
      return createDesolateSynths;
    case 'organic':
      return createOrganicSynths;
    case 'urgent':
      return createUrgentSynths;
    case 'horror':
      return createHorrorSynths;
    case 'frozen':
      return createFrozenSynths;
    default:
      return createDesolateSynths;
  }
}

// ============================================================================
// PATTERN GENERATORS
// ============================================================================

/**
 * Generate ambient pad chord pattern
 */
export function generateAmbientPattern(
  synth: Tone.PolySynth,
  key: string,
  _tempo: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Tone.Sequence<any> {
  const chords = CHORD_PROGRESSIONS[key] || CHORD_PROGRESSIONS['Dm'];
  const pattern: (number[] | null)[] = [];

  // Create slow chord progression (one chord every 4 bars)
  for (const chord of chords) {
    pattern.push(chord);
    pattern.push(null);
    pattern.push(null);
    pattern.push(null);
  }

  return new Tone.Sequence(
    (time, chord) => {
      if (chord && Array.isArray(chord)) {
        const frequencies = (chord as number[]).map((n) => Tone.Frequency(n, 'midi').toFrequency());
        synth.triggerAttackRelease(frequencies, '2n', time, 0.3);
      }
    },
    pattern,
    '1n'
  );
}

/**
 * Generate percussion pattern based on style
 */
export function generatePercussionPattern(
  kick: Tone.MembraneSynth,
  hihat: Tone.MetalSynth,
  style: LevelMusicTheme['style'],
  _tempo: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { kickPattern: Tone.Sequence<any>; hihatPattern: Tone.Sequence<any> } {
  let kickHits: boolean[];
  let hihatVelocities: number[];

  switch (style) {
    case 'industrial':
      kickHits = [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false];
      hihatVelocities = [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4];
      break;
    case 'urgent':
      kickHits = [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false];
      hihatVelocities = [1, 0.3, 0.5, 0.3, 1, 0.3, 0.5, 0.3, 1, 0.3, 0.5, 0.3, 1, 0.3, 0.7, 0.5];
      break;
    case 'organic':
      kickHits = [true, false, false, false, false, false, true, false, false, false, false, false, true, false, false, false];
      hihatVelocities = [0, 0.5, 0, 0.3, 0.7, 0, 0.4, 0, 0, 0.6, 0, 0.3, 0.5, 0, 0.4, 0];
      break;
    case 'horror':
      kickHits = [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false];
      hihatVelocities = [0, 0, 0.3, 0, 0, 0.2, 0, 0.4, 0, 0, 0.3, 0, 0, 0.2, 0, 0.5];
      break;
    case 'frozen':
    case 'desolate':
    default:
      kickHits = [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false];
      hihatVelocities = [0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3];
      break;
  }

  const kickPattern = new Tone.Sequence(
    (time, hit) => {
      if (hit) {
        kick.triggerAttackRelease('C1', '8n', time);
      }
    },
    kickHits,
    '16n'
  );

  const hihatPattern = new Tone.Sequence(
    (time, velocity) => {
      if (typeof velocity === 'number' && velocity > 0) {
        hihat.triggerAttackRelease('16n', time, velocity * 0.5);
      }
    },
    hihatVelocities,
    '16n'
  );

  return { kickPattern, hihatPattern };
}

/**
 * Generate bass line pattern
 */
export function generateBassPattern(
  synth: Tone.MonoSynth,
  key: string,
  style: LevelMusicTheme['style']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Tone.Sequence<any> {
  const bassNotes = BASS_NOTES[key] || BASS_NOTES['Dm'];
  let pattern: (number | null)[];

  switch (style) {
    case 'industrial':
      pattern = [bassNotes[0], null, bassNotes[0], null, bassNotes[1], null, null, bassNotes[0], null, bassNotes[2], null, null, bassNotes[0], null, bassNotes[1], null];
      break;
    case 'urgent':
      pattern = [bassNotes[0], null, bassNotes[0], bassNotes[0], null, bassNotes[1], null, bassNotes[0], bassNotes[2], null, bassNotes[0], null, bassNotes[1], null, bassNotes[0], null];
      break;
    case 'organic':
      pattern = [bassNotes[0], null, null, null, bassNotes[1], null, null, null, bassNotes[0], null, null, bassNotes[2], null, null, null, null];
      break;
    case 'horror':
      pattern = [bassNotes[0], null, null, null, null, null, null, null, bassNotes[1], null, null, null, null, null, null, null];
      break;
    case 'frozen':
    case 'desolate':
    default:
      pattern = [bassNotes[0], null, null, null, bassNotes[1], null, null, null, bassNotes[0], null, null, null, bassNotes[2], null, null, null];
      break;
  }

  return new Tone.Sequence(
    (time, note) => {
      if (note !== null && typeof note === 'number') {
        synth.triggerAttackRelease(Tone.Frequency(note, 'midi').toFrequency(), '8n', time);
      }
    },
    pattern,
    '8n'
  );
}

/**
 * Generate synth stab pattern (triggered by combat events)
 */
export function generateStabPattern(
  synth: Tone.PolySynth,
  key: string,
  style: LevelMusicTheme['style']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Tone.Sequence<any> {
  const chords = CHORD_PROGRESSIONS[key] || CHORD_PROGRESSIONS['Dm'];
  let pattern: (number[] | null)[];

  switch (style) {
    case 'urgent':
      pattern = [
        chords[0], null, chords[0], null,
        null, chords[1], null, chords[1],
        chords[2], null, null, chords[2],
        null, chords[3], chords[3], null,
      ];
      break;
    case 'industrial':
      pattern = [
        chords[0], null, null, null,
        null, null, chords[1], null,
        null, chords[0], null, null,
        null, null, null, chords[2],
      ];
      break;
    case 'organic':
    case 'horror':
      pattern = [
        chords[0], null, null, null,
        null, null, null, null,
        null, null, chords[1], null,
        null, null, null, null,
      ];
      break;
    default:
      pattern = [
        chords[0], null, null, null,
        null, chords[1], null, null,
        null, null, chords[2], null,
        null, null, null, chords[3],
      ];
      break;
  }

  return new Tone.Sequence(
    (time, chord) => {
      if (chord && Array.isArray(chord)) {
        const frequencies = (chord as number[]).map((n) => Tone.Frequency(n + 12, 'midi').toFrequency()); // One octave up
        synth.triggerAttackRelease(frequencies, '16n', time, 0.6);
      }
    },
    pattern,
    '8n'
  );
}

/**
 * Generate lead melody pattern
 */
export function generateLeadPattern(
  synth: Tone.MonoSynth,
  key: string,
  style: LevelMusicTheme['style']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Tone.Sequence<any> {
  const scale = SCALES[key] || SCALES['Dm'];
  let pattern: (number | null)[];

  switch (style) {
    case 'urgent':
      pattern = [
        scale[4], null, scale[3], null,
        scale[2], null, scale[0], null,
        scale[4], scale[5], null, scale[3],
        null, scale[2], null, scale[0],
      ];
      break;
    case 'industrial':
      pattern = [
        scale[0], null, null, null,
        scale[2], null, scale[1], null,
        null, null, null, null,
        scale[4], null, null, null,
      ];
      break;
    case 'organic':
      pattern = [
        scale[0], null, null, scale[1],
        null, null, null, scale[0] - 1, // chromatic
        null, scale[0], null, null,
        scale[2], null, null, null,
      ];
      break;
    case 'horror':
      pattern = [
        scale[0], null, null, null,
        null, null, scale[1], null,
        null, null, null, null,
        scale[0] - 1, null, null, null, // chromatic tension
      ];
      break;
    case 'frozen':
      pattern = [
        scale[4], null, null, scale[2],
        null, null, scale[0], null,
        null, scale[2], null, null,
        scale[4], null, scale[5], null,
      ];
      break;
    case 'desolate':
    default:
      pattern = [
        scale[0], null, null, null,
        scale[2], null, null, null,
        scale[4], null, null, null,
        scale[2], null, null, null,
      ];
      break;
  }

  return new Tone.Sequence(
    (time, note) => {
      if (note !== null && typeof note === 'number') {
        synth.triggerAttackRelease(Tone.Frequency(note + 12, 'midi').toFrequency(), '8n', time, 0.7);
      }
    },
    pattern,
    '16n'
  );
}
