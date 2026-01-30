/**
 * VoiceSynthesizer - Procedural Radio Voice Synthesis
 *
 * Generates stylized, abstract "radio comm" voice audio using the Web Audio API.
 * This is not realistic text-to-speech. Instead it creates an evocative soundscape
 * that conveys the feeling of someone speaking over military comms:
 *
 * - Formant-filtered oscillators simulate vocal resonances
 * - Noise layers add breath and radio texture
 * - Volume modulation creates speech-like cadence
 * - Bandpass filtering produces the "radio comm" band-limited feel
 * - Static/crackle overlay reinforces the military radio aesthetic
 * - Morse-code beep bookends each transmission
 *
 * Each character has a distinct voice profile (pitch, formants, cadence speed)
 * allowing the player to distinguish speakers even without reading subtitles.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Voice profile defining the tonal character of a speaker */
export interface VoiceProfile {
  /** Display name for debugging */
  name: string;
  /** Base pitch of the primary oscillator (Hz) */
  basePitch: number;
  /** Formant center frequencies -- first 3 vowel formants */
  formants: [number, number, number];
  /** Formant Q (resonance) values */
  formantQ: [number, number, number];
  /** Oscillator waveform for the tonal core */
  waveform: OscillatorType;
  /** Speech cadence rate -- syllables per second */
  cadenceRate: number;
  /** Cadence depth (0-1) -- how much volume modulates during speech */
  cadenceDepth: number;
  /** Amount of noise / breathiness (0-1) */
  breathiness: number;
  /** Radio filter bandwidth (Hz). Lower = more filtered. */
  radioBandwidth: number;
  /** Radio filter center frequency (Hz) */
  radioCenterFreq: number;
  /** Static overlay volume multiplier (0-1) */
  staticLevel: number;
  /** Pitch wobble depth in Hz (simulates vocal pitch variation) */
  pitchWobble: number;
  /** Pitch wobble rate (Hz) */
  pitchWobbleRate: number;
}

/** Handle returned by speak() allowing the caller to stop playback early */
export interface VoicePlaybackHandle {
  /** Promise that resolves when playback finishes naturally */
  finished: Promise<void>;
  /** Stop playback immediately (with short fade-out) */
  stop: () => void;
  /** Whether playback has completed or been stopped */
  readonly isPlaying: boolean;
}

// ---------------------------------------------------------------------------
// Pre-defined voice profiles
// ---------------------------------------------------------------------------

/** Commander Reyes -- authoritative female, mid-high pitch */
export const REYES_VOICE: VoiceProfile = {
  name: 'CDR. Vasquez',
  basePitch: 195,
  formants: [800, 1400, 2800],
  formantQ: [12, 10, 8],
  waveform: 'sawtooth',
  cadenceRate: 4.2,
  cadenceDepth: 0.55,
  breathiness: 0.2,
  radioBandwidth: 2800,
  radioCenterFreq: 1800,
  staticLevel: 0.12,
  pitchWobble: 8,
  pitchWobbleRate: 5,
};

/** Marcus Cole -- deep male, confident but youthful energy */
export const MARCUS_VOICE: VoiceProfile = {
  name: 'SGT. Marcus Cole',
  basePitch: 110,
  formants: [500, 1100, 2400],
  formantQ: [10, 8, 6],
  waveform: 'sawtooth',
  cadenceRate: 5.0,
  cadenceDepth: 0.5,
  breathiness: 0.25,
  radioBandwidth: 2500,
  radioCenterFreq: 1500,
  staticLevel: 0.18,
  pitchWobble: 5,
  pitchWobbleRate: 3.5,
};

/** Ship AI -- synthetic, precise, slightly higher than Reyes */
export const AI_VOICE: VoiceProfile = {
  name: 'SHIP AI',
  basePitch: 260,
  formants: [900, 1600, 3200],
  formantQ: [18, 15, 12],
  waveform: 'sine',
  cadenceRate: 6.0,
  cadenceDepth: 0.35,
  breathiness: 0.05,
  radioBandwidth: 3500,
  radioCenterFreq: 2000,
  staticLevel: 0.04,
  pitchWobble: 1,
  pitchWobbleRate: 8,
};

/** Player character -- mid male, calm */
export const PLAYER_VOICE: VoiceProfile = {
  name: 'CPL. Chen',
  basePitch: 140,
  formants: [600, 1200, 2600],
  formantQ: [10, 9, 7],
  waveform: 'sawtooth',
  cadenceRate: 3.8,
  cadenceDepth: 0.45,
  breathiness: 0.22,
  radioBandwidth: 2600,
  radioCenterFreq: 1600,
  staticLevel: 0.15,
  pitchWobble: 6,
  pitchWobbleRate: 4,
};

/** Gunny Kowalski -- gruff, low, gravelly */
export const ARMORY_VOICE: VoiceProfile = {
  name: 'GNY. Kowalski',
  basePitch: 95,
  formants: [450, 1000, 2200],
  formantQ: [8, 7, 5],
  waveform: 'sawtooth',
  cadenceRate: 3.5,
  cadenceDepth: 0.6,
  breathiness: 0.35,
  radioBandwidth: 2200,
  radioCenterFreq: 1400,
  staticLevel: 0.2,
  pitchWobble: 4,
  pitchWobbleRate: 3,
};

// ---------------------------------------------------------------------------
// VoiceSynthesizer class
// ---------------------------------------------------------------------------

/**
 * Procedural voice synthesizer that generates abstract radio-comm voice
 * audio entirely through the Web Audio API. No samples required.
 */
export class VoiceSynthesizer {
  private audioContext: AudioContext | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private isDisposed = false;

  /**
   * Lazily initialize or return the shared AudioContext.
   * Handles Safari's webkitAudioContext prefix.
   */
  private getContext(): AudioContext {
    if (this.isDisposed) {
      throw new Error('VoiceSynthesizer has been disposed');
    }
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Synthesize a voice transmission for a given text line.
   *
   * @param text       The dialogue text (used to estimate duration)
   * @param profile    Voice profile for the speaker
   * @param volume     Master volume for this transmission (0-1)
   * @returns          Playback handle with stop() and finished promise
   */
  speak(text: string, profile: VoiceProfile, volume = 0.3): VoicePlaybackHandle {
    const ctx = this.getContext();
    const duration = this.estimateDuration(text);
    const now = ctx.currentTime;

    // Transmission timeline:
    // [beep-in 0.15s] [static-fade-in 0.2s] [voice body] [static-fade-out 0.2s] [beep-out 0.15s]
    const beepDuration = 0.15;
    const fadeTime = 0.2;
    const voiceStart = now + beepDuration + 0.05;
    const voiceEnd = voiceStart + duration;
    const totalEnd = voiceEnd + fadeTime + beepDuration + 0.1;

    // Master output gain (voice volume channel)
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    this.activeNodes.add(masterGain);

    // 1. Transmission beeps
    this.createTransmissionBeep(ctx, now, beepDuration, volume * 0.6, masterGain);
    this.createTransmissionBeep(
      ctx,
      voiceEnd + fadeTime,
      beepDuration,
      volume * 0.5,
      masterGain,
      true
    );

    // 2. Radio static layer (entire duration)
    this.createRadioStatic(
      ctx,
      now + beepDuration,
      voiceEnd + fadeTime - (now + beepDuration),
      profile,
      volume,
      masterGain
    );

    // 3. Voice body
    this.createVoiceBody(ctx, voiceStart, duration, profile, volume, masterGain);

    // Playback state
    let playing = true;
    let stopFn: (() => void) | null = null;

    const finished = new Promise<void>((resolve) => {
      const timeout = setTimeout(
        () => {
          playing = false;
          this.activeNodes.delete(masterGain);
          resolve();
        },
        (totalEnd - now) * 1000 + 50
      );

      stopFn = () => {
        if (!playing) return;
        playing = false;
        clearTimeout(timeout);
        // Quick fade-out
        try {
          masterGain.gain.cancelScheduledValues(ctx.currentTime);
          masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
        } catch {
          // Context may be closed
        }
        this.activeNodes.delete(masterGain);
        resolve();
      };
    });

    return {
      finished,
      stop: () => stopFn?.(),
      get isPlaying() {
        return playing;
      },
    };
  }

  /**
   * Play a standalone radio static burst (for ambient comms atmosphere).
   */
  playStaticBurst(duration = 0.3, volume = 0.15): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const noiseBuffer = this.createNoiseBuffer(ctx, duration);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.05);
  }

  /**
   * Play a comms open/close beep.
   */
  playCommsBeep(volume = 0.2, descending = false): void {
    const ctx = this.getContext();
    this.createTransmissionBeep(ctx, ctx.currentTime, 0.15, volume, ctx.destination, descending);
  }

  /**
   * Stop all active voice synthesis and release resources.
   */
  dispose(): void {
    this.isDisposed = true;
    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    }
    this.activeNodes.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }

  // -----------------------------------------------------------------------
  // Voice body synthesis
  // -----------------------------------------------------------------------

  /**
   * Creates the main voice body: oscillators through formant filters
   * with cadence-modulated volume.
   */
  private createVoiceBody(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    profile: VoiceProfile,
    volume: number,
    destination: AudioNode
  ): void {
    // --- Primary tonal oscillator ---
    const osc = ctx.createOscillator();
    osc.type = profile.waveform;
    osc.frequency.setValueAtTime(profile.basePitch, startTime);

    // Pitch wobble LFO (simulates vocal intonation)
    const wobbleLfo = ctx.createOscillator();
    wobbleLfo.frequency.value = profile.pitchWobbleRate;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = profile.pitchWobble;
    wobbleLfo.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);

    // Slow pitch contour -- slight rise at beginning, drop at end (declarative phrasing)
    osc.frequency.linearRampToValueAtTime(profile.basePitch * 1.04, startTime + duration * 0.3);
    osc.frequency.linearRampToValueAtTime(profile.basePitch * 0.96, startTime + duration * 0.9);
    osc.frequency.linearRampToValueAtTime(profile.basePitch * 0.92, startTime + duration);

    // --- Secondary harmonic oscillator (adds richness) ---
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(profile.basePitch * 1.5, startTime);
    osc2.frequency.linearRampToValueAtTime(profile.basePitch * 1.48, startTime + duration);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.15;

    // --- Noise layer for breathiness ---
    const breathDuration = duration + 0.1;
    const breathBuffer = this.createNoiseBuffer(ctx, breathDuration);
    const breathSource = ctx.createBufferSource();
    breathSource.buffer = breathBuffer;

    const breathGain = ctx.createGain();
    breathGain.gain.value = profile.breathiness * 0.5;

    // --- Formant filter bank ---
    // Each formant is a bandpass filter tuned to a vocal resonance frequency
    const formantNodes: BiquadFilterNode[] = [];
    for (let i = 0; i < 3; i++) {
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = profile.formants[i];
      formant.Q.value = profile.formantQ[i];
      formantNodes.push(formant);
    }

    // Summing gain for formant outputs
    const formantSum = ctx.createGain();
    formantSum.gain.value = 0.45;

    // Connect tonal oscillators through each formant filter in parallel
    for (const formant of formantNodes) {
      osc.connect(formant);
      osc2.connect(osc2Gain);
      osc2Gain.connect(formant);
      breathSource.connect(formant);
      formant.connect(formantSum);
    }

    // Also route breath noise directly (for sibilant quality)
    breathSource.connect(breathGain);
    breathGain.connect(formantSum);

    // --- Radio bandpass filter (simulates comms bandwidth limitation) ---
    const radioFilter = ctx.createBiquadFilter();
    radioFilter.type = 'bandpass';
    radioFilter.frequency.value = profile.radioCenterFreq;
    radioFilter.Q.value = profile.radioBandwidth / profile.radioCenterFreq;

    formantSum.connect(radioFilter);

    // --- Cadence modulation (speech rhythm) ---
    // An LFO modulates the output gain to create rhythmic volume pulses
    // that simulate syllable boundaries
    const cadenceLfo = ctx.createOscillator();
    cadenceLfo.frequency.value = profile.cadenceRate;

    const cadenceShaper = ctx.createGain();
    cadenceShaper.gain.value = profile.cadenceDepth * volume * 0.5;

    const voiceEnvelope = ctx.createGain();
    // Base level that the cadence oscillates around
    voiceEnvelope.gain.setValueAtTime(0, startTime);
    voiceEnvelope.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.08);
    voiceEnvelope.gain.setValueAtTime(volume * 0.7, startTime + duration - 0.15);
    voiceEnvelope.gain.linearRampToValueAtTime(0, startTime + duration);

    cadenceLfo.connect(cadenceShaper);
    cadenceShaper.connect(voiceEnvelope.gain);

    radioFilter.connect(voiceEnvelope);
    voiceEnvelope.connect(destination);

    // --- Light distortion for radio crunch ---
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    distortion.curve = curve;
    distortion.oversample = '2x';

    // Insert distortion between radio filter and envelope
    radioFilter.disconnect();
    radioFilter.connect(distortion);
    distortion.connect(voiceEnvelope);

    // --- Schedule start/stop ---
    const endTime = startTime + duration + 0.05;
    osc.start(startTime);
    osc.stop(endTime);
    osc2.start(startTime);
    osc2.stop(endTime);
    wobbleLfo.start(startTime);
    wobbleLfo.stop(endTime);
    cadenceLfo.start(startTime);
    cadenceLfo.stop(endTime);
    breathSource.start(startTime);
    breathSource.stop(endTime);

    // Track nodes for cleanup
    this.activeNodes.add(osc);
    this.activeNodes.add(osc2);
    this.activeNodes.add(voiceEnvelope);
  }

  // -----------------------------------------------------------------------
  // Radio static layer
  // -----------------------------------------------------------------------

  /**
   * Creates background radio static that fades in/out around the voice.
   */
  private createRadioStatic(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    profile: VoiceProfile,
    volume: number,
    destination: AudioNode
  ): void {
    const staticBuffer = this.createNoiseBuffer(ctx, duration + 0.1);
    const staticSource = ctx.createBufferSource();
    staticSource.buffer = staticBuffer;

    // Band-limit the static to radio frequencies
    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 2500;
    staticFilter.Q.value = 0.5;

    // Crackling: rapid volume modulation of noise
    const crackleBuffer = this.createCrackleBuffer(ctx, duration + 0.1);
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackleBuffer;

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.value = 3000;

    const staticGain = ctx.createGain();
    const staticVol = volume * profile.staticLevel;
    staticGain.gain.setValueAtTime(0, startTime);
    staticGain.gain.linearRampToValueAtTime(staticVol, startTime + 0.1);
    staticGain.gain.setValueAtTime(staticVol, startTime + duration - 0.1);
    staticGain.gain.linearRampToValueAtTime(0, startTime + duration);

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = staticVol * 0.4;

    staticSource.connect(staticFilter);
    staticFilter.connect(staticGain);
    staticGain.connect(destination);

    crackleSource.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(destination);

    staticSource.start(startTime);
    staticSource.stop(startTime + duration + 0.05);
    crackleSource.start(startTime);
    crackleSource.stop(startTime + duration + 0.05);
  }

  // -----------------------------------------------------------------------
  // Transmission beep (morse-code-style)
  // -----------------------------------------------------------------------

  /**
   * Creates a short beep that bookends radio transmissions.
   * Ascending beep at start, descending at end.
   */
  private createTransmissionBeep(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    descending = false
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';

    if (descending) {
      // End-of-transmission: descending two-tone
      osc.frequency.setValueAtTime(1200, startTime);
      osc.frequency.setValueAtTime(900, startTime + duration * 0.5);
    } else {
      // Start-of-transmission: ascending two-tone
      osc.frequency.setValueAtTime(900, startTime);
      osc.frequency.setValueAtTime(1200, startTime + duration * 0.5);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    // Slight gap between the two tones
    gain.gain.setValueAtTime(volume, startTime + duration * 0.45);
    gain.gain.linearRampToValueAtTime(0, startTime + duration * 0.48);
    gain.gain.linearRampToValueAtTime(volume * 0.8, startTime + duration * 0.52);
    gain.gain.setValueAtTime(volume * 0.8, startTime + duration * 0.9);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // -----------------------------------------------------------------------
  // Utility: noise buffer creation
  // -----------------------------------------------------------------------

  /** Create a white noise AudioBuffer of a given duration */
  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleCount = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Create a crackle buffer -- intermittent bursts of noise */
  private createCrackleBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleCount = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let isCrackle = false;
    let nextToggle = Math.floor(Math.random() * 400) + 100;
    let counter = 0;
    for (let i = 0; i < sampleCount; i++) {
      counter++;
      if (counter >= nextToggle) {
        isCrackle = !isCrackle;
        nextToggle = isCrackle
          ? Math.floor(Math.random() * 200) + 50
          : Math.floor(Math.random() * 800) + 200;
        counter = 0;
      }
      data[i] = isCrackle ? (Math.random() * 2 - 1) * 0.8 : 0;
    }
    return buffer;
  }

  // -----------------------------------------------------------------------
  // Duration estimation
  // -----------------------------------------------------------------------

  /**
   * Estimate how long a line of dialogue should play based on text length.
   * Uses approximate speaking rate of ~3 words/second for radio comms
   * with minimum and maximum bounds.
   */
  private estimateDuration(text: string): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const wordsPerSecond = 3;
    const baseDuration = wordCount / wordsPerSecond;
    // Clamp between 0.8s and 8s
    return Math.max(0.8, Math.min(8, baseDuration));
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: VoiceSynthesizer | null = null;

/** Get the shared VoiceSynthesizer instance */
export function getVoiceSynthesizer(): VoiceSynthesizer {
  if (!instance) {
    instance = new VoiceSynthesizer();
  }
  return instance;
}

/** Dispose the shared instance */
export function disposeVoiceSynthesizer(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
