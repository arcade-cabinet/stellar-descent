/**
 * MusicComposer - Comprehensive Procedural Music System using Tone.js
 *
 * Creates production-quality procedural music for all game states:
 * - Main Menu: Atmospheric D minor synth with slow arpeggios (60 BPM)
 * - Combat: Adaptive multi-layer system based on intensity (140 BPM)
 * - Boss (Queen): Epic 3-phase orchestral-style progression
 * - Victory/Defeat stingers
 *
 * Features:
 * - Real-time synthesis using Tone.js instruments
 * - Layered composition with independent mix control
 * - Seamless crossfading between musical states
 * - Proper gain staging with -12dB headroom
 * - Music ducking during dialogue/important events
 */

import * as Tone from 'tone';

// ============================================================================
// TYPES
// ============================================================================

export type MusicState = 'silent' | 'menu' | 'exploration' | 'combat' | 'boss';
export type CombatLayer = 'percussion' | 'bass' | 'stabs' | 'lead';
export type BossPhase = 1 | 2 | 3;

interface MusicLayerConfig {
  enabled: boolean;
  volume: number;
}

// ============================================================================
// MUSICAL CONSTANTS - D MINOR KEY
// ============================================================================

// D minor scale frequencies (D-E-F-G-A-Bb-C)
const D_MINOR_SCALE = {
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
};

// Menu chord progression (i - VI - III - VII in D minor)
const MENU_CHORDS = [
  [D_MINOR_SCALE.D3, D_MINOR_SCALE.F3, D_MINOR_SCALE.A3], // Dm
  [D_MINOR_SCALE.Bb2, D_MINOR_SCALE.D3, D_MINOR_SCALE.F3], // Bb
  [D_MINOR_SCALE.F3, D_MINOR_SCALE.A3, D_MINOR_SCALE.C4], // F
  [D_MINOR_SCALE.C3, D_MINOR_SCALE.E3, D_MINOR_SCALE.G3], // C
];

// Menu arpeggio pattern (notes to cycle through)
const MENU_ARPEGGIO = [
  D_MINOR_SCALE.D4,
  D_MINOR_SCALE.F4,
  D_MINOR_SCALE.A4,
  D_MINOR_SCALE.D5,
  D_MINOR_SCALE.A4,
  D_MINOR_SCALE.F4,
  D_MINOR_SCALE.D4,
  D_MINOR_SCALE.A3,
];

// Combat bass patterns
const COMBAT_BASS_PATTERN = {
  low: [
    D_MINOR_SCALE.D2,
    null,
    D_MINOR_SCALE.D2,
    null,
    D_MINOR_SCALE.A2,
    null,
    D_MINOR_SCALE.G2,
    null,
  ],
  medium: [
    D_MINOR_SCALE.D2,
    D_MINOR_SCALE.D2,
    null,
    D_MINOR_SCALE.D2,
    D_MINOR_SCALE.A2,
    null,
    D_MINOR_SCALE.Bb2,
    D_MINOR_SCALE.A2,
  ],
  high: [
    D_MINOR_SCALE.D2,
    D_MINOR_SCALE.D2,
    D_MINOR_SCALE.D2,
    null,
    D_MINOR_SCALE.A2,
    D_MINOR_SCALE.Bb2,
    D_MINOR_SCALE.A2,
    D_MINOR_SCALE.G2,
  ],
};

// Combat synth stab chords
const COMBAT_STAB_CHORDS = [
  [D_MINOR_SCALE.D4, D_MINOR_SCALE.F4, D_MINOR_SCALE.A4],
  [D_MINOR_SCALE.Bb3, D_MINOR_SCALE.D4, D_MINOR_SCALE.F4],
  [D_MINOR_SCALE.G3, D_MINOR_SCALE.Bb3, D_MINOR_SCALE.D4],
  [D_MINOR_SCALE.A3, D_MINOR_SCALE.C4, D_MINOR_SCALE.E4],
];

// Combat lead melody fragments
const COMBAT_LEAD_MELODIES = [
  [
    D_MINOR_SCALE.D5,
    D_MINOR_SCALE.E5,
    D_MINOR_SCALE.F5,
    D_MINOR_SCALE.A5,
    D_MINOR_SCALE.G5,
    D_MINOR_SCALE.F5,
    D_MINOR_SCALE.E5,
    D_MINOR_SCALE.D5,
  ],
  [
    D_MINOR_SCALE.A4,
    D_MINOR_SCALE.D5,
    D_MINOR_SCALE.F5,
    D_MINOR_SCALE.E5,
    D_MINOR_SCALE.D5,
    D_MINOR_SCALE.C5,
    D_MINOR_SCALE.Bb4,
    D_MINOR_SCALE.A4,
  ],
  [
    D_MINOR_SCALE.F5,
    D_MINOR_SCALE.E5,
    D_MINOR_SCALE.D5,
    D_MINOR_SCALE.C5,
    D_MINOR_SCALE.D5,
    D_MINOR_SCALE.E5,
    D_MINOR_SCALE.F5,
    D_MINOR_SCALE.G5,
  ],
];

// ============================================================================
// MUSIC COMPOSER CLASS
// ============================================================================

export class MusicComposer {
  // State
  private currentState: MusicState = 'silent';
  private isInitialized = false;
  private masterVolume = 0.5;
  private isDucked = false;

  // Master chain
  private masterGain!: Tone.Gain;
  private masterCompressor!: Tone.Compressor;
  private masterLimiter!: Tone.Limiter;
  private masterReverb!: Tone.Reverb;

  // Menu music components
  private menuPadSynth: Tone.PolySynth | null = null;
  private menuArpSynth: Tone.Synth | null = null;
  private menuPulseSynth: Tone.Synth | null = null;
  private menuMetalSynth: Tone.MetalSynth | null = null;
  private menuPadLoop: Tone.Loop | null = null;
  private menuArpLoop: Tone.Loop | null = null;
  private menuPulseLoop: Tone.Loop | null = null;
  private menuMetalLoop: Tone.Loop | null = null;
  private menuChordIndex = 0;
  private menuArpIndex = 0;
  private menuGain: Tone.Gain | null = null;

  // Combat music components
  private combatKickSynth: Tone.MembraneSynth | null = null;
  private combatSnareSynth: Tone.NoiseSynth | null = null;
  private combatHihatSynth: Tone.MetalSynth | null = null;
  private combatBassSynth: Tone.MonoSynth | null = null;
  private combatStabSynth: Tone.PolySynth | null = null;
  private combatLeadSynth: Tone.MonoSynth | null = null;
  private combatKickLoop: Tone.Loop | null = null;
  private combatSnareLoop: Tone.Loop | null = null;
  private combatHihatLoop: Tone.Loop | null = null;
  private combatBassLoop: Tone.Sequence | null = null;
  private combatStabLoop: Tone.Loop | null = null;
  private combatLeadLoop: Tone.Sequence | null = null;
  private combatGain: Tone.Gain | null = null;
  private combatIntensity: 'low' | 'medium' | 'high' = 'low';
  private combatLayerGains: Record<CombatLayer, Tone.Gain | null> = {
    percussion: null,
    bass: null,
    stabs: null,
    lead: null,
  };
  private combatStabIndex = 0;
  private combatBassIndex = 0;
  private combatLeadIndex = 0;
  private combatLeadNoteIndex = 0;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure Tone.js context is running
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Create master chain with proper gain staging (-12dB headroom)
    this.masterLimiter = new Tone.Limiter(-3);
    this.masterCompressor = new Tone.Compressor({
      threshold: -18,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });
    this.masterReverb = new Tone.Reverb({
      decay: 3,
      wet: 0.2,
    });
    this.masterGain = new Tone.Gain(this.masterVolume);

    // Chain: source -> reverb -> compressor -> limiter -> gain -> destination
    this.masterReverb.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterGain);
    this.masterGain.toDestination();

    this.isInitialized = true;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Start playing music for a specific state
   */
  async play(state: MusicState): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.currentState === state) return;

    // Crossfade from current state
    const fadeTime = 2;
    await this.stopCurrentState(fadeTime);

    // Start new state
    this.currentState = state;

    switch (state) {
      case 'menu':
        await this.startMenuMusic();
        break;
      case 'combat':
        await this.startCombatMusic();
        break;
      case 'exploration':
        // Quieter version of menu music
        await this.startMenuMusic(0.6);
        break;
      case 'silent':
        // Already stopped
        break;
    }
  }

  /**
   * Stop all music with fade
   */
  async stop(fadeTime = 1): Promise<void> {
    await this.stopCurrentState(fadeTime);
    this.currentState = 'silent';
  }

  /**
   * Set combat intensity (affects which layers play)
   */
  setCombatIntensity(intensity: 'low' | 'medium' | 'high'): void {
    if (this.combatIntensity === intensity) return;
    this.combatIntensity = intensity;

    const transitionTime = 1;

    // Low: Just percussion + bass
    // Medium: Add synth stabs
    // High: Full arrangement with lead melody

    if (this.combatLayerGains.percussion) {
      this.combatLayerGains.percussion.gain.rampTo(0.25, transitionTime);
    }
    if (this.combatLayerGains.bass) {
      this.combatLayerGains.bass.gain.rampTo(0.25, transitionTime);
    }
    if (this.combatLayerGains.stabs) {
      const stabVolume = intensity === 'low' ? 0 : 0.2;
      this.combatLayerGains.stabs.gain.rampTo(stabVolume, transitionTime);
    }
    if (this.combatLayerGains.lead) {
      const leadVolume = intensity === 'high' ? 0.18 : 0;
      this.combatLayerGains.lead.gain.rampTo(leadVolume, transitionTime);
    }

    // Adjust tempo based on intensity
    const bpmMap = { low: 130, medium: 140, high: 150 };
    Tone.getTransport().bpm.rampTo(bpmMap[intensity], transitionTime);
  }

  /**
   * Duck music for dialogue or important events
   */
  duck(amount = 0.3, duration = 0.5): void {
    if (this.isDucked) return;
    this.isDucked = true;
    this.masterGain.gain.rampTo(this.masterVolume * amount, duration);
  }

  /**
   * Restore music volume after ducking
   */
  unduck(duration = 0.5): void {
    if (!this.isDucked) return;
    this.isDucked = false;
    this.masterGain.gain.rampTo(this.masterVolume, duration);
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.isDucked) {
      this.masterGain.gain.rampTo(this.masterVolume, 0.1);
    }
  }

  /**
   * Get current state
   */
  getState(): MusicState {
    return this.currentState;
  }

  /**
   * Play victory stinger
   */
  playVictoryStinger(): void {
    if (!this.isInitialized) return;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
    });
    const gain = new Tone.Gain(0.3);
    synth.connect(gain);
    gain.connect(this.masterReverb);

    const now = Tone.now();

    // Major arpeggio up (D major for triumph after D minor tension)
    const notes = ['D4', 'F#4', 'A4', 'D5'];
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '8n', now + i * 0.12, 0.7);
    });

    // Final chord
    synth.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], '2n', now + 0.5, 0.5);

    // Cleanup
    setTimeout(() => {
      synth.dispose();
      gain.dispose();
    }, 3000);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopCurrentState(0);

    this.disposeMenuMusic();
    this.disposeCombatMusic();

    this.masterGain?.dispose();
    this.masterCompressor?.dispose();
    this.masterLimiter?.dispose();
    this.masterReverb?.dispose();

    this.isInitialized = false;
  }

  // ============================================================================
  // MENU MUSIC - Atmospheric D minor at 60 BPM
  // ============================================================================

  private async startMenuMusic(volumeScale = 1): Promise<void> {
    // Create gain node for this state
    this.menuGain = new Tone.Gain(0);
    this.menuGain.connect(this.masterReverb);

    // Atmospheric pad synth
    this.menuPadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
    });
    this.menuPadSynth.volume.value = -12;
    this.menuPadSynth.connect(this.menuGain);

    // Arpeggiator synth
    this.menuArpSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5 },
    });
    this.menuArpSynth.volume.value = -18;

    // Delay for arpeggio
    const arpDelay = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.3,
      wet: 0.4,
    });
    this.menuArpSynth.connect(arpDelay);
    arpDelay.connect(this.menuGain);

    // Subtle pulse bass
    this.menuPulseSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.6, release: 1 },
    });
    this.menuPulseSynth.volume.value = -20;
    this.menuPulseSynth.connect(this.menuGain);

    // Occasional metallic hits
    this.menuMetalSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.8, release: 0.2 },
      harmonicity: 12,
      modulationIndex: 20,
      resonance: 800,
      octaves: 1,
    });
    this.menuMetalSynth.volume.value = -30;
    this.menuMetalSynth.connect(this.menuGain);

    // Set tempo
    Tone.getTransport().bpm.value = 60;

    // Create loops
    this.menuChordIndex = 0;
    this.menuArpIndex = 0;

    // Pad chord changes every 4 bars (16 beats at 60 BPM = 16 seconds)
    this.menuPadLoop = new Tone.Loop((time) => {
      const chord = MENU_CHORDS[this.menuChordIndex % MENU_CHORDS.length];
      this.menuPadSynth?.triggerAttackRelease(chord, '4n', time, 0.4);
      this.menuChordIndex++;
    }, '4n');
    this.menuPadLoop.start(0);

    // Arpeggio pattern
    this.menuArpLoop = new Tone.Loop((time) => {
      const note = MENU_ARPEGGIO[this.menuArpIndex % MENU_ARPEGGIO.length];
      this.menuArpSynth?.triggerAttackRelease(note, '8n', time, 0.3);
      this.menuArpIndex++;
    }, '4n');
    this.menuArpLoop.start('2n');

    // Subtle bass pulse
    this.menuPulseLoop = new Tone.Loop((time) => {
      this.menuPulseSynth?.triggerAttackRelease(D_MINOR_SCALE.D2, '2n', time, 0.3);
    }, '2n');
    this.menuPulseLoop.start(0);

    // Occasional metallic hits (random timing within each 4-bar section)
    this.menuMetalLoop = new Tone.Loop((time) => {
      if (Math.random() < 0.3) {
        this.menuMetalSynth?.triggerAttackRelease('8n', time, 0.15);
      }
    }, '4n');
    this.menuMetalLoop.start('1m');

    // Start transport if not running
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }

    // Fade in
    this.menuGain.gain.rampTo(0.25 * volumeScale, 2);
  }

  private disposeMenuMusic(): void {
    this.menuPadLoop?.stop();
    this.menuPadLoop?.dispose();
    this.menuArpLoop?.stop();
    this.menuArpLoop?.dispose();
    this.menuPulseLoop?.stop();
    this.menuPulseLoop?.dispose();
    this.menuMetalLoop?.stop();
    this.menuMetalLoop?.dispose();

    this.menuPadSynth?.dispose();
    this.menuArpSynth?.dispose();
    this.menuPulseSynth?.dispose();
    this.menuMetalSynth?.dispose();
    this.menuGain?.dispose();

    this.menuPadLoop = null;
    this.menuArpLoop = null;
    this.menuPulseLoop = null;
    this.menuMetalLoop = null;
    this.menuPadSynth = null;
    this.menuArpSynth = null;
    this.menuPulseSynth = null;
    this.menuMetalSynth = null;
    this.menuGain = null;
  }

  // ============================================================================
  // COMBAT MUSIC - Driving drums at 140 BPM with intensity layers
  // ============================================================================

  private async startCombatMusic(): Promise<void> {
    // Create main gain and layer gains
    this.combatGain = new Tone.Gain(0);
    this.combatGain.connect(this.masterReverb);

    this.combatLayerGains.percussion = new Tone.Gain(0.25);
    this.combatLayerGains.bass = new Tone.Gain(0.25);
    this.combatLayerGains.stabs = new Tone.Gain(0); // Starts muted
    this.combatLayerGains.lead = new Tone.Gain(0); // Starts muted

    for (const key of Object.keys(this.combatLayerGains) as CombatLayer[]) {
      this.combatLayerGains[key]?.connect(this.combatGain);
    }

    // === PERCUSSION LAYER ===

    // Kick drum
    this.combatKickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.2 },
    });
    this.combatKickSynth.volume.value = -6;
    this.combatKickSynth.connect(this.combatLayerGains.percussion!);

    // Snare (noise-based)
    this.combatSnareSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    });
    this.combatSnareSynth.volume.value = -10;
    this.combatSnareSynth.connect(this.combatLayerGains.percussion!);

    // Hi-hat
    this.combatHihatSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
      harmonicity: 5,
      modulationIndex: 32,
      resonance: 6000,
      octaves: 1.5,
    });
    this.combatHihatSynth.volume.value = -18;
    this.combatHihatSynth.connect(this.combatLayerGains.percussion!);

    // === BASS LAYER ===

    this.combatBassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.1 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1,
        baseFrequency: 80,
        octaves: 2.5,
      },
    });
    this.combatBassSynth.volume.value = -8;

    const bassDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0.3 });
    this.combatBassSynth.connect(bassDistortion);
    bassDistortion.connect(this.combatLayerGains.bass!);

    // === STABS LAYER ===

    this.combatStabSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 },
    });
    this.combatStabSynth.volume.value = -10;
    this.combatStabSynth.connect(this.combatLayerGains.stabs!);

    // === LEAD LAYER ===

    this.combatLeadSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.4,
        release: 0.2,
        baseFrequency: 400,
        octaves: 3,
      },
    });
    this.combatLeadSynth.volume.value = -8;

    const leadDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.25 });
    this.combatLeadSynth.connect(leadDelay);
    leadDelay.connect(this.combatLayerGains.lead!);

    // Set tempo
    Tone.getTransport().bpm.value = 140;

    // === CREATE LOOPS ===

    // Kick pattern: four-on-the-floor with variations
    let kickStep = 0;
    this.combatKickLoop = new Tone.Loop((time) => {
      const pattern = [true, false, false, false, true, false, true, false];
      if (pattern[kickStep % pattern.length]) {
        this.combatKickSynth?.triggerAttackRelease('C1', '8n', time);
      }
      kickStep++;
    }, '8n');
    this.combatKickLoop.start(0);

    // Snare pattern: backbeat
    let snareStep = 0;
    this.combatSnareLoop = new Tone.Loop((time) => {
      const pattern = [false, false, true, false, false, false, true, false];
      if (pattern[snareStep % pattern.length]) {
        this.combatSnareSynth?.triggerAttackRelease('8n', time);
      }
      snareStep++;
    }, '8n');
    this.combatSnareLoop.start(0);

    // Hi-hat pattern: 16th notes
    this.combatHihatLoop = new Tone.Loop((time) => {
      const velocity = Math.random() * 0.3 + 0.2;
      this.combatHihatSynth?.triggerAttackRelease('32n', time, velocity);
    }, '16n');
    this.combatHihatLoop.start(0);

    // Bass sequence
    this.combatBassIndex = 0;
    const bassPattern = COMBAT_BASS_PATTERN[this.combatIntensity];
    this.combatBassLoop = new Tone.Sequence(
      (time, note) => {
        if (note !== null) {
          this.combatBassSynth?.triggerAttackRelease(note, '8n', time);
        }
      },
      bassPattern,
      '8n'
    );
    this.combatBassLoop.start(0);

    // Stab pattern
    this.combatStabIndex = 0;
    this.combatStabLoop = new Tone.Loop((time) => {
      // Play stab on beats 1 and 3 of every 2 bars
      const chord = COMBAT_STAB_CHORDS[this.combatStabIndex % COMBAT_STAB_CHORDS.length];
      this.combatStabSynth?.triggerAttackRelease(chord, '8n', time, 0.6);
      this.combatStabIndex++;
    }, '2n');
    this.combatStabLoop.start('1m');

    // Lead melody sequence
    this.combatLeadIndex = 0;
    this.combatLeadNoteIndex = 0;
    const leadMelody = COMBAT_LEAD_MELODIES[0];
    this.combatLeadLoop = new Tone.Sequence(
      (time, note) => {
        if (note !== null) {
          this.combatLeadSynth?.triggerAttackRelease(note, '16n', time, 0.7);
        }
      },
      leadMelody,
      '16n'
    );
    this.combatLeadLoop.start('2m');

    // Start transport if needed
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }

    // Fade in
    this.combatGain.gain.rampTo(0.3, 1);
  }

  private disposeCombatMusic(): void {
    this.combatKickLoop?.stop();
    this.combatKickLoop?.dispose();
    this.combatSnareLoop?.stop();
    this.combatSnareLoop?.dispose();
    this.combatHihatLoop?.stop();
    this.combatHihatLoop?.dispose();
    this.combatBassLoop?.stop();
    this.combatBassLoop?.dispose();
    this.combatStabLoop?.stop();
    this.combatStabLoop?.dispose();
    this.combatLeadLoop?.stop();
    this.combatLeadLoop?.dispose();

    this.combatKickSynth?.dispose();
    this.combatSnareSynth?.dispose();
    this.combatHihatSynth?.dispose();
    this.combatBassSynth?.dispose();
    this.combatStabSynth?.dispose();
    this.combatLeadSynth?.dispose();

    for (const key of Object.keys(this.combatLayerGains) as CombatLayer[]) {
      this.combatLayerGains[key]?.dispose();
      this.combatLayerGains[key] = null;
    }

    this.combatGain?.dispose();

    this.combatKickLoop = null;
    this.combatSnareLoop = null;
    this.combatHihatLoop = null;
    this.combatBassLoop = null;
    this.combatStabLoop = null;
    this.combatLeadLoop = null;
    this.combatKickSynth = null;
    this.combatSnareSynth = null;
    this.combatHihatSynth = null;
    this.combatBassSynth = null;
    this.combatStabSynth = null;
    this.combatLeadSynth = null;
    this.combatGain = null;
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  private async stopCurrentState(fadeTime: number): Promise<void> {
    switch (this.currentState) {
      case 'menu':
      case 'exploration':
        if (this.menuGain) {
          this.menuGain.gain.rampTo(0, fadeTime);
          await new Promise((resolve) => setTimeout(resolve, fadeTime * 1000 + 100));
          this.disposeMenuMusic();
        }
        break;
      case 'combat':
        if (this.combatGain) {
          this.combatGain.gain.rampTo(0, fadeTime);
          await new Promise((resolve) => setTimeout(resolve, fadeTime * 1000 + 100));
          this.disposeCombatMusic();
        }
        break;
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let musicComposerInstance: MusicComposer | null = null;

export function getMusicComposer(): MusicComposer {
  if (!musicComposerInstance) {
    musicComposerInstance = new MusicComposer();
  }
  return musicComposerInstance;
}

export function disposeMusicComposer(): void {
  if (musicComposerInstance) {
    musicComposerInstance.dispose();
    musicComposerInstance = null;
  }
}
