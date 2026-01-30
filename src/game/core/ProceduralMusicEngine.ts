/**
 * ProceduralMusicEngine - Tone.js-based procedural ambient music generation
 *
 * Generates dynamic, environment-specific ambient music tracks that adapt to gameplay.
 * Each environment type has distinct musical characteristics:
 *
 * - Station: Industrial hum, electronic processing, calm but tense
 * - Surface: Desolate, wind-driven, alien isolation
 * - Hive: Organic, pulsing, threatening
 * - Base: Horror ambient, dissonant, creepy
 * - Extraction: Urgent, intense, action-driven
 *
 * Features:
 * - Layered procedural synthesis using Tone.js
 * - Combat intensity transitions (smooth crossfade)
 * - Generative melodic fragments and chord progressions
 * - Dynamic parameter modulation based on game state
 */

import * as Tone from 'tone';

// ============================================================================
// TYPES
// ============================================================================

/** Environment types for music generation */
export type MusicEnvironment = 'station' | 'surface' | 'hive' | 'base' | 'extraction';

/** Combat intensity levels for music adaptation */
export type CombatIntensity = 'ambient' | 'alert' | 'combat' | 'boss';

/** Musical scale definitions (semitone intervals from root) */
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], // Natural minor
  phrygian: [0, 1, 3, 5, 7, 8, 10], // Phrygian (dark, tense)
  locrian: [0, 1, 3, 5, 6, 8, 10], // Locrian (very unstable, horror)
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // Harmonic minor (exotic tension)
  pentatonicMinor: [0, 3, 5, 7, 10], // Minor pentatonic (sparse, alien)
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Chromatic (dissonant)
};

/** Music layer configuration */
interface MusicLayer {
  id: string;
  nodes: Tone.ToneAudioNode[];
  patterns: (Tone.Loop | Tone.Sequence<any>)[];
  isActive: boolean;
  volume: Tone.Gain;
}

/** Environment music profile */
interface EnvironmentProfile {
  baseNote: string; // Root note (e.g., "C2")
  scale: number[];
  tempo: number;
  layers: {
    drone: boolean;
    pad: boolean;
    pulse: boolean;
    melody: boolean;
    percussion: boolean;
  };
  reverb: number; // 0-1 wet level
  filterCutoff: number; // Hz
  ambientVolume: number;
  combatVolume: number;
}

// ============================================================================
// ENVIRONMENT PROFILES
// ============================================================================

const ENVIRONMENT_PROFILES: Record<MusicEnvironment, EnvironmentProfile> = {
  station: {
    baseNote: 'D1',
    scale: SCALES.minor,
    tempo: 70,
    layers: { drone: true, pad: true, pulse: true, melody: true, percussion: false },
    reverb: 0.4,
    filterCutoff: 4000,
    ambientVolume: 0.4,
    combatVolume: 0.6,
  },
  surface: {
    baseNote: 'A1',
    scale: SCALES.phrygian,
    tempo: 60,
    layers: { drone: true, pad: true, pulse: false, melody: true, percussion: false },
    reverb: 0.6,
    filterCutoff: 3000,
    ambientVolume: 0.35,
    combatVolume: 0.55,
  },
  hive: {
    baseNote: 'E1',
    scale: SCALES.locrian,
    tempo: 55,
    layers: { drone: true, pad: true, pulse: true, melody: false, percussion: true },
    reverb: 0.5,
    filterCutoff: 2500,
    ambientVolume: 0.45,
    combatVolume: 0.7,
  },
  base: {
    baseNote: 'C1',
    scale: SCALES.harmonicMinor,
    tempo: 50,
    layers: { drone: true, pad: true, pulse: false, melody: true, percussion: false },
    reverb: 0.7,
    filterCutoff: 2000,
    ambientVolume: 0.35,
    combatVolume: 0.6,
  },
  extraction: {
    baseNote: 'G1',
    scale: SCALES.pentatonicMinor,
    tempo: 100,
    layers: { drone: true, pad: true, pulse: true, melody: true, percussion: true },
    reverb: 0.3,
    filterCutoff: 6000,
    ambientVolume: 0.5,
    combatVolume: 0.8,
  },
};

// ============================================================================
// PROCEDURAL MUSIC ENGINE
// ============================================================================

export class ProceduralMusicEngine {
  // Audio graph
  private masterGain: Tone.Gain;
  private reverbSend: Tone.Reverb;
  private filter: Tone.Filter;
  private limiter: Tone.Limiter;
  private compressor: Tone.Compressor;

  // State
  private isPlaying = false;
  private currentEnvironment: MusicEnvironment | null = null;
  private currentIntensity: CombatIntensity = 'ambient';
  private layers: Map<string, MusicLayer> = new Map();
  private baseVolume = 0.5;

  // Timing
  private scheduledIds: number[] = [];

  constructor() {
    // Create audio chain: layers -> filter -> compressor -> limiter -> reverb send -> master -> destination
    this.limiter = new Tone.Limiter(-3);
    this.compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });

    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 8000,
      rolloff: -12,
    });

    this.reverbSend = new Tone.Reverb({
      decay: 4,
      wet: 0.3,
    });

    this.masterGain = new Tone.Gain(this.baseVolume);

    // Connect chain
    this.filter.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.reverbSend);
    this.reverbSend.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Start procedural music for an environment
   */
  async start(environment: MusicEnvironment, intensity: CombatIntensity = 'ambient'): Promise<void> {
    // Ensure Tone.js is started
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Stop existing music if playing
    if (this.isPlaying) {
      this.stop(1);
      // Wait for fade out
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    this.isPlaying = true;
    this.currentEnvironment = environment;
    this.currentIntensity = intensity;

    const profile = ENVIRONMENT_PROFILES[environment];

    // Configure global effects
    Tone.getTransport().bpm.value = profile.tempo;
    this.reverbSend.wet.rampTo(profile.reverb, 0.5);
    this.filter.frequency.rampTo(profile.filterCutoff, 0.5);

    // Set initial volume based on intensity
    const targetVolume = intensity === 'ambient' ? profile.ambientVolume : profile.combatVolume;
    this.masterGain.gain.rampTo(targetVolume * this.baseVolume, 2);

    // Create layers based on environment profile
    this.createEnvironmentLayers(environment, profile);

    // Start transport
    Tone.getTransport().start();
  }

  /**
   * Stop all procedural music
   */
  stop(fadeDuration = 1): void {
    if (!this.isPlaying) return;

    // Fade out
    this.masterGain.gain.rampTo(0, fadeDuration);

    // Schedule cleanup
    const cleanupTime = Tone.now() + fadeDuration + 0.1;
    Tone.getTransport().scheduleOnce(() => {
      this.cleanup();
    }, cleanupTime);

    this.isPlaying = false;
    this.currentEnvironment = null;
    this.currentIntensity = 'ambient';
  }

  /**
   * Transition to a different environment
   */
  async transitionTo(environment: MusicEnvironment, crossfadeDuration = 2): Promise<void> {
    if (this.currentEnvironment === environment) return;

    // Fade out current
    this.masterGain.gain.rampTo(0, crossfadeDuration * 0.5);

    // Wait for fade out
    await new Promise((resolve) => setTimeout(resolve, crossfadeDuration * 500 + 100));

    // Start new environment
    await this.start(environment, this.currentIntensity);
  }

  /**
   * Set combat intensity level
   * This smoothly transitions the music to match combat state
   */
  setIntensity(intensity: CombatIntensity, transitionDuration = 1.5): void {
    if (!this.isPlaying || !this.currentEnvironment) return;
    if (this.currentIntensity === intensity) return;

    this.currentIntensity = intensity;
    const profile = ENVIRONMENT_PROFILES[this.currentEnvironment];

    // Adjust volume based on intensity
    let targetVolume: number;
    let tempoMultiplier: number;
    let filterMultiplier: number;

    switch (intensity) {
      case 'ambient':
        targetVolume = profile.ambientVolume;
        tempoMultiplier = 1.0;
        filterMultiplier = 1.0;
        break;
      case 'alert':
        targetVolume = (profile.ambientVolume + profile.combatVolume) / 2;
        tempoMultiplier = 1.1;
        filterMultiplier = 1.2;
        break;
      case 'combat':
        targetVolume = profile.combatVolume;
        tempoMultiplier = 1.25;
        filterMultiplier = 1.5;
        break;
      case 'boss':
        targetVolume = profile.combatVolume * 1.2;
        tempoMultiplier = 1.4;
        filterMultiplier = 2.0;
        break;
    }

    // Apply transitions
    this.masterGain.gain.rampTo(targetVolume * this.baseVolume, transitionDuration);
    Tone.getTransport().bpm.rampTo(profile.tempo * tempoMultiplier, transitionDuration);
    this.filter.frequency.rampTo(
      Math.min(profile.filterCutoff * filterMultiplier, 20000),
      transitionDuration
    );

    // Update layer intensities
    this.updateLayerIntensities(intensity, transitionDuration);
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    if (this.isPlaying && this.currentEnvironment) {
      const profile = ENVIRONMENT_PROFILES[this.currentEnvironment];
      const targetVolume =
        this.currentIntensity === 'ambient' ? profile.ambientVolume : profile.combatVolume;
      this.masterGain.gain.rampTo(targetVolume * this.baseVolume, 0.1);
    }
  }

  /**
   * Get current playback state
   */
  getState(): { isPlaying: boolean; environment: MusicEnvironment | null; intensity: CombatIntensity } {
    return {
      isPlaying: this.isPlaying,
      environment: this.currentEnvironment,
      intensity: this.currentIntensity,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop(0);
    this.cleanup();

    this.masterGain.dispose();
    this.reverbSend.dispose();
    this.filter.dispose();
    this.limiter.dispose();
    this.compressor.dispose();
  }

  // ============================================================================
  // LAYER CREATION
  // ============================================================================

  private createEnvironmentLayers(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    if (profile.layers.drone) {
      this.createDroneLayer(environment, profile);
    }
    if (profile.layers.pad) {
      this.createPadLayer(environment, profile);
    }
    if (profile.layers.pulse) {
      this.createPulseLayer(environment, profile);
    }
    if (profile.layers.melody) {
      this.createMelodyLayer(environment, profile);
    }
    if (profile.layers.percussion) {
      this.createPercussionLayer(environment, profile);
    }
  }

  /**
   * Create bass drone layer - continuous low-frequency foundation
   */
  private createDroneLayer(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    const layerId = 'drone';
    const volume = new Tone.Gain(0.4);
    volume.connect(this.filter);

    // Multiple detuned oscillators for rich drone
    const synth1 = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 4, decay: 2, sustain: 1, release: 4 },
    });

    const synth2 = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 5, decay: 2, sustain: 1, release: 5 },
    });

    // Subharmonic layer
    const subSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 3, decay: 1, sustain: 1, release: 3 },
    });

    // Filter for warmth
    const droneFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 400,
      rolloff: -24,
    });

    // LFO for subtle pitch drift
    const pitchLfo = new Tone.LFO({
      frequency: 0.05,
      min: -5,
      max: 5,
    });

    // Connect
    synth1.connect(droneFilter);
    synth2.connect(droneFilter);
    subSynth.connect(volume);
    droneFilter.connect(volume);
    pitchLfo.connect(synth1.detune);
    pitchLfo.connect(synth2.detune);

    // Start drone
    synth1.triggerAttack(profile.baseNote);
    const baseFreq = Tone.Frequency(profile.baseNote).toFrequency();
    synth2.triggerAttack(Tone.Frequency(baseFreq * 1.005).toNote()); // Slight detune
    subSynth.triggerAttack(Tone.Frequency(baseFreq / 2).toNote()); // Octave below
    pitchLfo.start();

    this.layers.set(layerId, {
      id: layerId,
      nodes: [synth1, synth2, subSynth, droneFilter, pitchLfo, volume],
      patterns: [],
      isActive: true,
      volume,
    });
  }

  /**
   * Create atmospheric pad layer - slow-evolving chords
   */
  private createPadLayer(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    const layerId = 'pad';
    const volume = new Tone.Gain(0.25);
    volume.connect(this.filter);

    // Create polyphonic synth for chords
    const padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 3, decay: 2, sustain: 0.8, release: 4 },
    });

    // Chorus effect for width
    const chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.5,
    });

    // Tremolo for movement
    const tremolo = new Tone.Tremolo({
      frequency: 0.1,
      depth: 0.3,
    });

    // Connect
    padSynth.connect(chorus);
    chorus.connect(tremolo);
    tremolo.connect(volume);
    tremolo.start();

    // Generate chord progression
    const chordProgression = this.generateChordProgression(profile);
    let chordIndex = 0;

    // Create pattern for chord changes
    const chordPattern = new Tone.Loop((time) => {
      const chord = chordProgression[chordIndex % chordProgression.length];
      padSynth.triggerAttackRelease(chord, '4n', time);
      chordIndex++;
    }, '4m'); // Change chord every 4 measures

    chordPattern.start(0);

    this.layers.set(layerId, {
      id: layerId,
      nodes: [padSynth, chorus, tremolo, volume],
      patterns: [chordPattern],
      isActive: true,
      volume,
    });
  }

  /**
   * Create rhythmic pulse layer - adds tension and movement
   */
  private createPulseLayer(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    const layerId = 'pulse';
    const volume = new Tone.Gain(environment === 'hive' ? 0.35 : 0.2);
    volume.connect(this.filter);

    // Bass pulse synth
    const pulseSynth = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
      filter: { type: 'lowpass', frequency: 200, Q: 2 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3, baseFrequency: 100, octaves: 2 },
    });

    pulseSynth.connect(volume);

    // Create pulse pattern based on environment
    let pattern: Tone.Sequence<any>;

    if (environment === 'hive') {
      // Organic heartbeat-like pulse
      pattern = new Tone.Sequence(
        (time, note) => {
          if (note) {
            pulseSynth.triggerAttackRelease(note, '8n', time);
          }
        },
        [profile.baseNote, null, null, profile.baseNote, null, null, null, null],
        '8n'
      );
    } else if (environment === 'extraction') {
      // Urgent, driving pulse
      pattern = new Tone.Sequence(
        (time, note) => {
          if (note) {
            pulseSynth.triggerAttackRelease(note, '16n', time);
          }
        },
        [
          profile.baseNote,
          null,
          profile.baseNote,
          profile.baseNote,
          null,
          profile.baseNote,
          null,
          profile.baseNote,
        ],
        '8n'
      );
    } else {
      // Station - steady electronic pulse
      pattern = new Tone.Sequence(
        (time, note) => {
          if (note) {
            pulseSynth.triggerAttackRelease(note, '16n', time);
          }
        },
        [profile.baseNote, null, null, null],
        '4n'
      );
    }

    pattern.start(0);

    this.layers.set(layerId, {
      id: layerId,
      nodes: [pulseSynth, volume],
      patterns: [pattern],
      isActive: true,
      volume,
    });
  }

  /**
   * Create melodic fragment layer - sparse melodic elements
   */
  private createMelodyLayer(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    const layerId = 'melody';
    const volume = new Tone.Gain(0.15);
    volume.connect(this.filter);

    // Lead synth with subtle character
    const melodySynth = new Tone.MonoSynth({
      oscillator: { type: environment === 'surface' ? 'sine' : 'triangle' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1.5 },
      filter: { type: 'lowpass', frequency: 2000 },
    });

    // Delay for atmosphere
    const delay = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.3,
      wet: 0.4,
    });

    melodySynth.connect(delay);
    delay.connect(volume);

    // Generate sparse melodic notes
    const melodyNotes = this.generateMelodyNotes(profile);

    // Probabilistic melody pattern - not every beat plays
    const melodyPattern = new Tone.Loop((time) => {
      // Only play occasionally for sparse feeling
      if (Math.random() < 0.3) {
        const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        const duration = ['4n', '8n', '2n'][Math.floor(Math.random() * 3)];
        melodySynth.triggerAttackRelease(note, duration, time);
      }
    }, '2n');

    melodyPattern.start('1m'); // Start after 1 measure

    this.layers.set(layerId, {
      id: layerId,
      nodes: [melodySynth, delay, volume],
      patterns: [melodyPattern],
      isActive: true,
      volume,
    });
  }

  /**
   * Create percussion layer - subtle rhythmic texture
   */
  private createPercussionLayer(environment: MusicEnvironment, profile: EnvironmentProfile): void {
    const layerId = 'percussion';
    const volume = new Tone.Gain(0.2);
    volume.connect(this.filter);

    // Noise-based percussion
    const noiseSynth = new Tone.NoiseSynth({
      noise: { type: environment === 'hive' ? 'pink' : 'white' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
    });

    // Filter for shaping
    const percFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: environment === 'hive' ? 400 : 2000,
      Q: 2,
    });

    noiseSynth.connect(percFilter);
    percFilter.connect(volume);

    // Create pattern
    let pattern: Tone.Sequence<any>;

    if (environment === 'hive') {
      // Organic skittering sounds
      pattern = new Tone.Sequence(
        (time, velocity) => {
          if (velocity && Math.random() < 0.5) {
            noiseSynth.triggerAttackRelease('32n', time);
          }
        },
        [0.3, null, 0.2, null, null, 0.4, null, 0.2, null, null, 0.3, null, null, null, 0.2, null],
        '16n'
      );
    } else {
      // Extraction - metallic hits
      pattern = new Tone.Sequence(
        (time, velocity) => {
          if (velocity) {
            noiseSynth.triggerAttackRelease('16n', time);
          }
        },
        [0.5, null, null, 0.3, null, 0.4, null, null],
        '8n'
      );
    }

    pattern.start(0);

    this.layers.set(layerId, {
      id: layerId,
      nodes: [noiseSynth, percFilter, volume],
      patterns: [pattern],
      isActive: true,
      volume,
    });
  }

  // ============================================================================
  // MUSIC GENERATION HELPERS
  // ============================================================================

  /**
   * Generate chord progression from scale
   */
  private generateChordProgression(profile: EnvironmentProfile): string[][] {
    const rootFreq = Tone.Frequency(profile.baseNote).toFrequency();
    const scale = profile.scale;

    // Generate 4 chords from scale
    const chords: string[][] = [];

    // Root chord (i)
    chords.push(this.buildChord(rootFreq, scale, 0, 3));

    // Second chord (varies by environment)
    const secondDegree = scale.length > 4 ? 3 : 2; // iv or III
    chords.push(this.buildChord(rootFreq, scale, secondDegree, 3));

    // Third chord (varies)
    const thirdDegree = scale.length > 5 ? 4 : 3; // v or iv
    chords.push(this.buildChord(rootFreq, scale, thirdDegree, 3));

    // Fourth chord - return to tonic or passing chord
    chords.push(this.buildChord(rootFreq, scale, 0, 3));

    return chords;
  }

  /**
   * Build a chord from scale degree
   */
  private buildChord(rootFreq: number, scale: number[], degree: number, noteCount: number): string[] {
    const notes: string[] = [];
    const baseOctave = 2; // Start in low octave

    for (let i = 0; i < noteCount; i++) {
      const scaleIndex = (degree + i * 2) % scale.length;
      const octaveOffset = Math.floor((degree + i * 2) / scale.length);
      const semitones = scale[scaleIndex];
      const freq = rootFreq * Math.pow(2, (semitones + (baseOctave + octaveOffset) * 12 - 12) / 12);
      notes.push(Tone.Frequency(freq).toNote());
    }

    return notes;
  }

  /**
   * Generate melody notes from scale
   */
  private generateMelodyNotes(profile: EnvironmentProfile): string[] {
    const rootFreq = Tone.Frequency(profile.baseNote).toFrequency();
    const scale = profile.scale;
    const notes: string[] = [];

    // Generate notes across 2 octaves
    for (let octave = 3; octave <= 4; octave++) {
      for (const semitone of scale) {
        const freq = rootFreq * Math.pow(2, octave - 1 + semitone / 12);
        notes.push(Tone.Frequency(freq).toNote());
      }
    }

    return notes;
  }

  // ============================================================================
  // INTENSITY MANAGEMENT
  // ============================================================================

  private updateLayerIntensities(intensity: CombatIntensity, duration: number): void {
    // Adjust individual layer volumes based on intensity
    for (const [layerId, layer] of this.layers) {
      let targetVolume: number;

      switch (layerId) {
        case 'drone':
          // Drone stays relatively constant, slightly louder in combat
          targetVolume = intensity === 'ambient' ? 0.4 : 0.5;
          break;
        case 'pad':
          // Pad quieter in intense combat
          targetVolume = intensity === 'combat' || intensity === 'boss' ? 0.15 : 0.25;
          break;
        case 'pulse':
          // Pulse much louder in combat
          targetVolume = intensity === 'ambient' ? 0.2 : intensity === 'boss' ? 0.5 : 0.4;
          break;
        case 'melody':
          // Melody quieter in intense combat
          targetVolume = intensity === 'combat' || intensity === 'boss' ? 0.08 : 0.15;
          break;
        case 'percussion':
          // Percussion louder in combat
          targetVolume = intensity === 'ambient' ? 0.15 : intensity === 'boss' ? 0.4 : 0.3;
          break;
        default:
          targetVolume = 0.3;
      }

      layer.volume.gain.rampTo(targetVolume, duration);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  private cleanup(): void {
    // Stop transport
    Tone.getTransport().stop();

    // Clean up all layers
    for (const layer of this.layers.values()) {
      // Stop and dispose patterns
      for (const pattern of layer.patterns) {
        pattern.stop();
        pattern.dispose();
      }

      // Dispose nodes
      for (const node of layer.nodes) {
        try {
          node.dispose();
        } catch {
          // Node may already be disposed
        }
      }
    }

    this.layers.clear();

    // Clear scheduled events
    for (const id of this.scheduledIds) {
      Tone.getTransport().clear(id);
    }
    this.scheduledIds = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let proceduralMusicInstance: ProceduralMusicEngine | null = null;

export function getProceduralMusicEngine(): ProceduralMusicEngine {
  if (!proceduralMusicInstance) {
    proceduralMusicInstance = new ProceduralMusicEngine();
  }
  return proceduralMusicInstance;
}

export function disposeProceduralMusicEngine(): void {
  if (proceduralMusicInstance) {
    proceduralMusicInstance.dispose();
    proceduralMusicInstance = null;
  }
}
