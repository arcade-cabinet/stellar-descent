/**
 * BossMusicManager - Procedural Boss Fight Music Generator using Tone.js
 *
 * Creates dramatic, multi-phase boss battle music for the Queen encounter.
 * Three phases matching the Queen fight phases:
 * - Phase 1: Menacing introduction, building tension
 * - Phase 2: Intensified combat, faster tempo
 * - Phase 3: Desperate finale, maximum intensity
 *
 * Also includes victory stinger for when the Queen is defeated.
 */

import * as Tone from 'tone';

// Musical constants
const BPM_PHASE_1 = 100; // Ominous, building
const BPM_PHASE_2 = 130; // Intense combat
const BPM_PHASE_3 = 160; // Frantic finale

// Key: D minor (dark, dramatic)
const SCALE_D_MINOR = ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'];
const BASS_NOTES_PHASE_1 = ['D1', 'A1', 'F1', 'G1'];
const BASS_NOTES_PHASE_2 = ['D1', 'D2', 'A1', 'Bb1', 'G1', 'F1'];
const BASS_NOTES_PHASE_3 = ['D1', 'D2', 'A1', 'A2', 'F1', 'E1', 'D1', 'C1'];

// Chord progressions (minor key, dark)
const CHORDS_PHASE_1 = [
  ['D3', 'F3', 'A3'], // Dm
  ['A2', 'C3', 'E3'], // Am
  ['Bb2', 'D3', 'F3'], // Bb
  ['G2', 'Bb2', 'D3'], // Gm
];

const CHORDS_PHASE_2 = [
  ['D3', 'F3', 'A3'], // Dm
  ['C3', 'E3', 'G3'], // C
  ['Bb2', 'D3', 'F3'], // Bb
  ['A2', 'C#3', 'E3'], // A (dominant)
];

const CHORDS_PHASE_3 = [
  ['D3', 'F3', 'A3', 'C4'], // Dm7
  ['F3', 'A3', 'C4', 'E4'], // Fmaj7
  ['G3', 'Bb3', 'D4', 'F4'], // Gm7
  ['A3', 'C#4', 'E4', 'G4'], // A7 (tension)
];

// Melodic fragments for lead synth
const MELODY_FRAGMENTS_PHASE_1 = [
  ['D4', 'F4', 'A4', 'G4', 'F4'],
  ['A4', 'G4', 'F4', 'E4', 'D4'],
  ['D4', 'E4', 'F4', 'G4', 'A4'],
  ['F4', 'E4', 'D4', 'C4', 'D4'],
];

const MELODY_FRAGMENTS_PHASE_2 = [
  ['D5', 'A4', 'F4', 'D4', 'A4', 'D5'],
  ['A4', 'Bb4', 'A4', 'G4', 'F4', 'E4'],
  ['D4', 'F4', 'A4', 'C5', 'A4', 'F4'],
  ['G4', 'A4', 'Bb4', 'A4', 'G4', 'F4'],
];

const MELODY_FRAGMENTS_PHASE_3 = [
  ['D5', 'D5', 'A4', 'A4', 'F4', 'F4', 'D4', 'D4'],
  ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'Bb4', 'A4'],
  ['D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'A5', 'G5'],
  ['F5', 'E5', 'D5', 'C5', 'Bb4', 'A4', 'G4', 'F4'],
];

export type BossPhase = 1 | 2 | 3;

/**
 * BossMusicManager handles procedural generation of boss fight music
 * using Tone.js synthesizers and sequencers.
 */
export class BossMusicManager {
  private isPlaying = false;
  private currentPhase: BossPhase = 1;
  private volume = 0.6;

  // Synths
  private bassSynth: Tone.MonoSynth | null = null;
  private padSynth: Tone.PolySynth | null = null;
  private leadSynth: Tone.MonoSynth | null = null;
  private percSynth: Tone.MembraneSynth | null = null;
  private hihatSynth: Tone.NoiseSynth | null = null;
  private arpSynth: Tone.MonoSynth | null = null;
  private subBass: Tone.Oscillator | null = null;

  // Effects
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private distortion: Tone.Distortion | null = null;
  private filter: Tone.Filter | null = null;
  private compressor: Tone.Compressor | null = null;
  private masterGain: Tone.Gain | null = null;

  // Sequencers/Loops
  private bassLoop: Tone.Loop | null = null;
  private chordLoop: Tone.Loop | null = null;
  private melodyLoop: Tone.Loop | null = null;
  private kickLoop: Tone.Loop | null = null;
  private hihatLoop: Tone.Loop | null = null;
  private arpLoop: Tone.Loop | null = null;
  private subBassLoop: Tone.Loop | null = null;

  // State tracking
  private bassIndex = 0;
  private chordIndex = 0;
  private melodyIndex = 0;
  private melodyNoteIndex = 0;
  private arpIndex = 0;

  constructor() {
    // Synths are created on demand to avoid blocking
  }

  /**
   * Initialize all synthesizers and effects
   */
  private async initSynths(): Promise<void> {
    if (this.bassSynth) return; // Already initialized

    // Start Tone.js context
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Master output chain
    this.compressor = new Tone.Compressor(-24, 4);
    this.masterGain = new Tone.Gain(this.volume);
    this.compressor.connect(this.masterGain);
    this.masterGain.toDestination();

    // Reverb for atmosphere
    this.reverb = new Tone.Reverb({
      decay: 3,
      wet: 0.3,
    });
    this.reverb.connect(this.compressor);

    // Delay for epic feel
    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.2,
      wet: 0.15,
    });
    this.delay.connect(this.reverb);

    // Distortion for aggression
    this.distortion = new Tone.Distortion({
      distortion: 0.3,
      wet: 0.2,
    });
    this.distortion.connect(this.compressor);

    // Filter for sweeps
    this.filter = new Tone.Filter({
      frequency: 2000,
      type: 'lowpass',
      rolloff: -24,
    });
    this.filter.connect(this.reverb);

    // Bass synth - deep, growling
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.2 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.2,
        baseFrequency: 100,
        octaves: 2,
      },
    });
    this.bassSynth.volume.value = -6;
    this.bassSynth.connect(this.distortion);

    // Pad synth - dark, atmospheric chords
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1 },
    });
    this.padSynth.volume.value = -12;
    this.padSynth.connect(this.filter);

    // Lead synth - piercing, aggressive
    this.leadSynth = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1,
        baseFrequency: 500,
        octaves: 3,
      },
    });
    this.leadSynth.volume.value = -8;
    this.leadSynth.connect(this.delay);

    // Kick drum
    this.percSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    });
    this.percSynth.volume.value = -4;
    this.percSynth.connect(this.compressor);

    // Hi-hat
    this.hihatSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
    });
    this.hihatSynth.volume.value = -18;
    this.hihatSynth.connect(this.compressor);

    // Arpeggiator synth
    this.arpSynth = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.05 },
    });
    this.arpSynth.volume.value = -14;
    this.arpSynth.connect(this.delay);

    // Sub bass oscillator for rumble
    this.subBass = new Tone.Oscillator({
      frequency: 36.71, // D1
      type: 'sine',
    });
    const subGain = new Tone.Gain(0.15);
    this.subBass.connect(subGain);
    subGain.connect(this.compressor);
  }

  /**
   * Start boss music at the specified phase
   */
  async start(phase: BossPhase = 1): Promise<void> {
    if (this.isPlaying) {
      // Transition to new phase
      await this.transitionToPhase(phase);
      return;
    }

    await this.initSynths();
    this.currentPhase = phase;
    this.isPlaying = true;

    // Reset indices
    this.bassIndex = 0;
    this.chordIndex = 0;
    this.melodyIndex = 0;
    this.melodyNoteIndex = 0;
    this.arpIndex = 0;

    // Set initial BPM
    this.setBPMForPhase(phase);

    // Create and start loops
    this.createLoops();

    // Start transport
    Tone.getTransport().start();

    // Start sub bass
    this.subBass?.start();
  }

  /**
   * Stop boss music
   */
  stop(fadeDuration = 1): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Fade out
    if (this.masterGain) {
      this.masterGain.gain.rampTo(0, fadeDuration);
    }

    // Stop after fade
    setTimeout(
      () => {
        this.disposeLoops();
        Tone.getTransport().stop();
        this.subBass?.stop();

        // Restore volume for next time
        if (this.masterGain) {
          this.masterGain.gain.value = this.volume;
        }
      },
      fadeDuration * 1000 + 100
    );
  }

  /**
   * Transition to a new phase with musical build
   */
  async transitionToPhase(newPhase: BossPhase): Promise<void> {
    if (newPhase === this.currentPhase) return;

    const previousPhase = this.currentPhase;
    this.currentPhase = newPhase;

    // Musical transition: filter sweep + tempo ramp
    const transitionTime = 2;

    // Filter sweep down then up
    if (this.filter) {
      this.filter.frequency.rampTo(500, transitionTime / 2);
      setTimeout(
        () => {
          this.filter?.frequency.rampTo(this.getFilterFrequency(newPhase), transitionTime / 2);
        },
        (transitionTime / 2) * 1000
      );
    }

    // Gradual tempo change
    const targetBPM = this.getBPMForPhase(newPhase);
    Tone.getTransport().bpm.rampTo(targetBPM, transitionTime);

    // Update loop patterns (happens immediately, will sound on next iteration)
    this.updateLoopPatterns();

    // Increase distortion in later phases
    if (this.distortion) {
      const distortionAmount = newPhase === 1 ? 0.2 : newPhase === 2 ? 0.4 : 0.6;
      this.distortion.distortion = distortionAmount;
    }

    // Console log for debugging
    console.log(`Boss music: Phase ${previousPhase} -> Phase ${newPhase}`);
  }

  /**
   * Play victory stinger when boss is defeated
   */
  async playVictoryStinger(): Promise<void> {
    // Stop the boss music
    this.stop(0.5);

    // Wait for fade
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Initialize if needed
    await this.initSynths();

    // Create victory chord progression
    const victorySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0.7, release: 2 },
    });
    victorySynth.volume.value = -8;
    victorySynth.connect(this.reverb!);

    const victoryBass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1 },
    });
    victoryBass.volume.value = -6;
    victoryBass.connect(this.compressor!);

    // Triumphant D major resolution after all that D minor
    const now = Tone.now();

    // Bass note
    victoryBass.triggerAttackRelease('D2', 3, now);

    // Chord progression: Dm -> F -> G -> D (major resolution)
    victorySynth.triggerAttackRelease(['D3', 'F3', 'A3'], 0.8, now);
    victorySynth.triggerAttackRelease(['F3', 'A3', 'C4'], 0.8, now + 0.8);
    victorySynth.triggerAttackRelease(['G3', 'B3', 'D4'], 0.8, now + 1.6);
    // Final D major chord (the triumphant resolution)
    victorySynth.triggerAttackRelease(['D3', 'F#3', 'A3', 'D4'], 2.5, now + 2.4);

    // Rising arpeggio
    const arpNotes = ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'];
    arpNotes.forEach((note, i) => {
      this.arpSynth?.triggerAttackRelease(note, 0.2, now + 2.4 + i * 0.1);
    });

    // Cleanup after stinger
    setTimeout(() => {
      victorySynth.dispose();
      victoryBass.dispose();
    }, 6000);
  }

  /**
   * Set the volume
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  /**
   * Get current phase
   */
  getPhase(): BossPhase {
    return this.currentPhase;
  }

  /**
   * Check if music is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stop(0);

    // Dispose synths
    this.bassSynth?.dispose();
    this.padSynth?.dispose();
    this.leadSynth?.dispose();
    this.percSynth?.dispose();
    this.hihatSynth?.dispose();
    this.arpSynth?.dispose();
    this.subBass?.dispose();

    // Dispose effects
    this.reverb?.dispose();
    this.delay?.dispose();
    this.distortion?.dispose();
    this.filter?.dispose();
    this.compressor?.dispose();
    this.masterGain?.dispose();

    // Null everything
    this.bassSynth = null;
    this.padSynth = null;
    this.leadSynth = null;
    this.percSynth = null;
    this.hihatSynth = null;
    this.arpSynth = null;
    this.subBass = null;
    this.reverb = null;
    this.delay = null;
    this.distortion = null;
    this.filter = null;
    this.compressor = null;
    this.masterGain = null;
  }

  // ==================== Private Methods ====================

  private getBPMForPhase(phase: BossPhase): number {
    switch (phase) {
      case 1:
        return BPM_PHASE_1;
      case 2:
        return BPM_PHASE_2;
      case 3:
        return BPM_PHASE_3;
      default:
        return BPM_PHASE_1;
    }
  }

  private setBPMForPhase(phase: BossPhase): void {
    Tone.getTransport().bpm.value = this.getBPMForPhase(phase);
  }

  private getFilterFrequency(phase: BossPhase): number {
    switch (phase) {
      case 1:
        return 2000;
      case 2:
        return 4000;
      case 3:
        return 8000;
      default:
        return 2000;
    }
  }

  private getBassNotes(): string[] {
    switch (this.currentPhase) {
      case 1:
        return BASS_NOTES_PHASE_1;
      case 2:
        return BASS_NOTES_PHASE_2;
      case 3:
        return BASS_NOTES_PHASE_3;
      default:
        return BASS_NOTES_PHASE_1;
    }
  }

  private getChords(): string[][] {
    switch (this.currentPhase) {
      case 1:
        return CHORDS_PHASE_1;
      case 2:
        return CHORDS_PHASE_2;
      case 3:
        return CHORDS_PHASE_3;
      default:
        return CHORDS_PHASE_1;
    }
  }

  private getMelodyFragments(): string[][] {
    switch (this.currentPhase) {
      case 1:
        return MELODY_FRAGMENTS_PHASE_1;
      case 2:
        return MELODY_FRAGMENTS_PHASE_2;
      case 3:
        return MELODY_FRAGMENTS_PHASE_3;
      default:
        return MELODY_FRAGMENTS_PHASE_1;
    }
  }

  private getArpNotes(): string[] {
    const chord = this.getChords()[this.chordIndex];
    // Extend chord notes up an octave for arpeggio
    const extended = [...chord];
    chord.forEach((note) => {
      const match = note.match(/([A-G][b#]?)(\d)/);
      if (match) {
        extended.push(`${match[1]}${parseInt(match[2]) + 1}`);
      }
    });
    return extended;
  }

  private createLoops(): void {
    // Bass loop - plays on beats
    this.bassLoop = new Tone.Loop(
      (time) => {
        const notes = this.getBassNotes();
        const note = notes[this.bassIndex % notes.length];
        const duration = this.currentPhase === 3 ? '8n' : '4n';
        this.bassSynth?.triggerAttackRelease(note, duration, time);
        this.bassIndex++;
      },
      this.currentPhase === 3 ? '8n' : '4n'
    );
    this.bassLoop.start(0);

    // Chord loop - plays every measure
    this.chordLoop = new Tone.Loop(
      (time) => {
        const chords = this.getChords();
        const chord = chords[this.chordIndex % chords.length];
        const duration = this.currentPhase === 3 ? '2n' : '1n';
        this.padSynth?.triggerAttackRelease(chord, duration, time);
        this.chordIndex++;
      },
      this.currentPhase === 3 ? '2n' : '1n'
    );
    this.chordLoop.start(0);

    // Melody loop - plays fragments
    this.melodyLoop = new Tone.Loop(
      (time) => {
        const fragments = this.getMelodyFragments();
        const fragment = fragments[this.melodyIndex % fragments.length];
        const note = fragment[this.melodyNoteIndex % fragment.length];

        // Vary note duration by phase
        const duration = this.currentPhase === 3 ? '16n' : this.currentPhase === 2 ? '8n' : '4n';
        this.leadSynth?.triggerAttackRelease(note, duration, time);

        this.melodyNoteIndex++;
        if (this.melodyNoteIndex >= fragment.length) {
          this.melodyNoteIndex = 0;
          this.melodyIndex++;
        }
      },
      this.currentPhase === 3 ? '8n' : this.currentPhase === 2 ? '8n' : '4n'
    );
    this.melodyLoop.start('1m'); // Start after one measure

    // Kick drum loop
    const kickPattern =
      this.currentPhase === 3
        ? [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] // 8th notes
        : this.currentPhase === 2
          ? [0, 0.25, 0.5, 0.75] // Quarter notes
          : [0, 0.5]; // Half notes

    this.kickLoop = new Tone.Loop((time) => {
      this.percSynth?.triggerAttackRelease('C1', '8n', time);
    }, '4n');
    this.kickLoop.start(0);

    // Hi-hat loop - 16th notes in phase 2/3
    if (this.currentPhase >= 2) {
      this.hihatLoop = new Tone.Loop(
        (time) => {
          this.hihatSynth?.triggerAttackRelease('16n', time);
        },
        this.currentPhase === 3 ? '16n' : '8n'
      );
      this.hihatLoop.start(0);
    }

    // Arpeggiator - phase 2 and 3 only
    if (this.currentPhase >= 2) {
      this.arpLoop = new Tone.Loop((time) => {
        const arpNotes = this.getArpNotes();
        const note = arpNotes[this.arpIndex % arpNotes.length];
        this.arpSynth?.triggerAttackRelease(note, '16n', time);
        this.arpIndex++;
      }, '16n');
      this.arpLoop.start('2m'); // Start after 2 measures
    }

    // Sub bass pulse - more frequent in later phases
    this.subBassLoop = new Tone.Loop(
      (time) => {
        if (this.subBass) {
          // Pulse the sub bass
          const freq = this.currentPhase === 3 ? 48.99 : this.currentPhase === 2 ? 41.2 : 36.71; // D1, E1, D1
          this.subBass.frequency.setValueAtTime(freq, time);
          this.subBass.frequency.exponentialRampToValueAtTime(freq * 0.8, time + 0.2);
        }
      },
      this.currentPhase === 3 ? '4n' : '2n'
    );
    this.subBassLoop.start(0);

    // Set filter frequency for phase
    if (this.filter) {
      this.filter.frequency.value = this.getFilterFrequency(this.currentPhase);
    }
  }

  private disposeLoops(): void {
    this.bassLoop?.dispose();
    this.chordLoop?.dispose();
    this.melodyLoop?.dispose();
    this.kickLoop?.dispose();
    this.hihatLoop?.dispose();
    this.arpLoop?.dispose();
    this.subBassLoop?.dispose();

    this.bassLoop = null;
    this.chordLoop = null;
    this.melodyLoop = null;
    this.kickLoop = null;
    this.hihatLoop = null;
    this.arpLoop = null;
    this.subBassLoop = null;
  }

  private updateLoopPatterns(): void {
    // Dispose and recreate loops for new phase
    this.disposeLoops();
    this.createLoops();
  }
}

// Singleton instance
let bossMusicManager: BossMusicManager | null = null;

/**
 * Get the singleton BossMusicManager instance
 */
export function getBossMusicManager(): BossMusicManager {
  if (!bossMusicManager) {
    bossMusicManager = new BossMusicManager();
  }
  return bossMusicManager;
}

/**
 * Dispose the singleton instance
 */
export function disposeBossMusicManager(): void {
  if (bossMusicManager) {
    bossMusicManager.dispose();
    bossMusicManager = null;
  }
}
