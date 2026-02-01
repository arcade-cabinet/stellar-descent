/**
 * EnvironmentalAudioManager - Comprehensive ambient environmental audio system
 *
 * Implements:
 * - Level-specific ambient soundscapes (station, surface, hive)
 * - Smooth transitions between audio zones
 * - Multiple layered ambient sounds
 * - Spatial audio with world-positioned sound sources
 * - Distance attenuation and reverb zones
 * - Dynamic audio based on combat state
 *
 * Each environment type has multiple layers that can be independently controlled:
 * - Base layer: Continuous low ambient (e.g., air circulation, wind base)
 * - Detail layer: Periodic random sounds (e.g., machinery clicks, distant thunder)
 * - Event layer: Triggered sounds (e.g., PA announcements, alien shrieks)
 */

import type { LevelId } from '../levels/types';
import { getLogger } from './Logger';

const log = getLogger('EnvironmentalAudioManager');

// ============================================================================
// TYPES
// ============================================================================

/** Environment types for audio profiles */
export type EnvironmentType =
  | 'station' // Interior station (air circulation, machinery, electrical)
  | 'surface' // Outdoor surface (wind, thunder, wildlife)
  | 'hive' // Underground hive (organic pulsing, alien sounds, moisture)
  | 'base' // Abandoned base (horror ambient, creaks, echoes)
  | 'extraction'; // Extraction zone (urgent rumbles, distant explosions)

/** Audio zone configuration */
export interface AudioZone {
  id: string;
  type: EnvironmentType;
  position: { x: number; y: number; z: number };
  radius: number;
  /** Indoor spaces have more reverb */
  isIndoor: boolean;
  /** Custom intensity modifier (0-1) */
  intensity?: number;
  /** Radiation zone adds geiger counter sounds */
  hasRadiation?: boolean;
  /** High threat areas add more tension sounds */
  highThreat?: boolean;
}

/** Spatial sound source in the world */
export interface SpatialSoundSource {
  id: string;
  type: SpatialSoundType;
  position: { x: number; y: number; z: number };
  /** Max distance for sound to be audible */
  maxDistance: number;
  /** Volume at source position */
  volume: number;
  /** Optional loop interval for periodic sounds (ms) */
  interval?: number;
  /** Is currently active */
  active: boolean;
  /** If true, sound can be occluded by walls (default: true) */
  occludable?: boolean;
  /** Current occlusion level (0 = clear, 1 = fully blocked) - set internally */
  occlusionLevel?: number;
}

/** Types of spatial sound sources */
export type SpatialSoundType =
  | 'machinery' // Station machinery
  | 'electrical_panel' // Buzzing electrical
  | 'vent' // Air vent
  | 'dripping' // Water/moisture dripping
  | 'alien_nest' // Alien sounds
  | 'organic_growth' // Pulsing organic matter
  | 'fire' // Burning/flames
  | 'steam' // Steam vents
  | 'terminal' // Computer beeps
  | 'generator' // Power generator hum
  | 'wind_howl' // Wind whistling through gaps
  | 'hive_heartbeat' // Deep organic pulsing
  | 'acid_bubbling' // Acid pool sounds
  | 'radio_static' // Distant radio chatter
  | 'debris_settling'; // Occasional creaks and settling

/** Audio occlusion configuration for wall blocking */
export interface OcclusionConfig {
  /** If true, sounds behind walls will be muffled */
  enabled: boolean;
  /** Lowpass filter cutoff when fully occluded (Hz) */
  occludedCutoff: number;
  /** Volume reduction when occluded (0-1 multiplier) */
  occludedVolume: number;
}

/** Audio layer state */
interface AudioLayer {
  nodes: AudioNode[];
  oscillators: OscillatorNode[];
  sources: AudioBufferSourceNode[];
  gain: GainNode;
  isActive: boolean;
}

/** Reverb zone configuration */
interface ReverbConfig {
  wetLevel: number;
  decayTime: number;
  /** Filter cutoff for muffled indoor sound */
  lowpassCutoff: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Reverb presets for different environment types */
const REVERB_PRESETS: Record<EnvironmentType, ReverbConfig> = {
  station: { wetLevel: 0.4, decayTime: 1.5, lowpassCutoff: 8000 },
  surface: { wetLevel: 0.1, decayTime: 0.3, lowpassCutoff: 20000 },
  hive: { wetLevel: 0.5, decayTime: 2.0, lowpassCutoff: 6000 },
  base: { wetLevel: 0.6, decayTime: 2.5, lowpassCutoff: 5000 },
  extraction: { wetLevel: 0.2, decayTime: 0.5, lowpassCutoff: 12000 },
};

/** Level to environment type mapping */
const LEVEL_ENVIRONMENT_MAP: Record<LevelId, EnvironmentType> = {
  anchor_station: 'station',
  landfall: 'surface',
  canyon_run: 'surface',
  fob_delta: 'base',
  brothers_in_arms: 'surface',
  southern_ice: 'surface',
  the_breach: 'hive',
  hive_assault: 'hive',
  extraction: 'extraction',
  final_escape: 'surface',
};

// ============================================================================
// ENVIRONMENTAL AUDIO MANAGER
// ============================================================================

export class EnvironmentalAudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbGain: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;

  // Active audio layers
  private baseLayers: Map<string, AudioLayer> = new Map();
  private detailLayers: Map<string, AudioLayer> = new Map();
  private eventLayers: Map<string, AudioLayer> = new Map();

  // Spatial sound sources
  private spatialSources: Map<string, SpatialSoundSource> = new Map();
  private spatialNodes: Map<
    string,
    { gain: GainNode; panner: PannerNode; layer: AudioLayer; occlusionFilter?: BiquadFilterNode }
  > = new Map();

  // Audio occlusion system
  private occlusionConfig: OcclusionConfig = {
    enabled: true,
    occludedCutoff: 400, // Heavy lowpass when blocked
    occludedVolume: 0.3, // 30% volume when blocked
  };

  // Occlusion callback - set by the level to check line-of-sight
  private occlusionCallback:
    | ((
        sourcePos: { x: number; y: number; z: number },
        listenerPos: { x: number; y: number; z: number }
      ) => number)
    | null = null;

  // Audio zones
  private zones: Map<string, AudioZone> = new Map();
  private activeZone: AudioZone | null = null;

  // State
  private currentEnvironment: EnvironmentType | null = null;
  private isPlaying = false;
  private masterVolume = 0.5;
  private isInCombat = false;
  private playerPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  // Timers and intervals
  private intervalIds: ReturnType<typeof setInterval>[] = [];
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private animationFrameId: number | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioGraph();
    }
    return this.audioContext;
  }

  private setupAudioGraph(): void {
    const ctx = this.audioContext!;

    // Master output gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(ctx.destination);

    // Lowpass filter for indoor muffling
    this.lowpassFilter = ctx.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 20000;
    this.lowpassFilter.connect(this.masterGain);

    // Reverb wet/dry mix
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbGain.connect(this.masterGain);

    // Create convolver for reverb
    this.convolverNode = ctx.createConvolver();
    this.convolverNode.connect(this.reverbGain);

    // Generate impulse response for reverb
    this.generateImpulseResponse(2.0);
  }

  private generateImpulseResponse(decayTime: number): void {
    const ctx = this.audioContext!;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * decayTime;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with noise
        channelData[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
      }
    }

    if (this.convolverNode) {
      this.convolverNode.buffer = impulse;
    }
  }

  // ============================================================================
  // ENVIRONMENT CONTROL
  // ============================================================================

  /**
   * Start environmental audio for a level
   */
  startEnvironment(levelId: LevelId, intensity = 1.0): void {
    const environmentType = LEVEL_ENVIRONMENT_MAP[levelId];
    if (!environmentType) {
      log.warn(`No environment mapping for level: ${levelId}`);
      return;
    }

    this.transitionToEnvironment(environmentType, intensity);
  }

  /**
   * Transition to a new environment type with crossfade
   */
  transitionToEnvironment(type: EnvironmentType, intensity = 1.0, transitionDuration = 2.0): void {
    if (this.currentEnvironment === type) return;

    // Fade out current environment
    if (this.currentEnvironment) {
      this.fadeOutAllLayers(transitionDuration * 0.5);
    }

    // Start new environment after half transition
    const timeoutId = setTimeout(() => {
      this.stopAllLayers();
      this.currentEnvironment = type;
      this.startEnvironmentLayers(type, intensity);
      this.applyReverbPreset(type);
    }, transitionDuration * 500);
    this.timeoutIds.push(timeoutId);

    this.isPlaying = true;
    this.startUpdateLoop();
  }

  /**
   * Stop all environmental audio
   */
  stopEnvironment(fadeDuration = 1.0): void {
    this.fadeOutAllLayers(fadeDuration);

    const timeoutId = setTimeout(() => {
      this.stopAllLayers();
      this.isPlaying = false;
      this.currentEnvironment = null;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }, fadeDuration * 1000);
    this.timeoutIds.push(timeoutId);
  }

  // ============================================================================
  // ENVIRONMENT-SPECIFIC AUDIO LAYERS
  // ============================================================================

  private startEnvironmentLayers(type: EnvironmentType, intensity: number): void {
    const ctx = this.getContext();

    switch (type) {
      case 'station':
        this.createStationEnvironment(ctx, intensity);
        break;
      case 'surface':
        this.createSurfaceEnvironment(ctx, intensity);
        break;
      case 'hive':
        this.createHiveEnvironment(ctx, intensity);
        break;
      case 'base':
        this.createBaseEnvironment(ctx, intensity);
        break;
      case 'extraction':
        this.createExtractionEnvironment(ctx, intensity);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // STATION ENVIRONMENT
  // -------------------------------------------------------------------------

  private createStationEnvironment(ctx: AudioContext, intensity: number): void {
    // Layer 1: Air circulation hum (continuous low frequency)
    const airLayer = this.createLayer('station_air');
    const airHum = ctx.createOscillator();
    airHum.type = 'sine';
    airHum.frequency.value = 55; // Low B

    const airHum2 = ctx.createOscillator();
    airHum2.type = 'sine';
    airHum2.frequency.value = 110; // Harmonic

    const airGain = ctx.createGain();
    airGain.gain.value = intensity * 0.08;

    // Add subtle wobble
    const airLfo = ctx.createOscillator();
    airLfo.frequency.value = 0.1;
    const airLfoGain = ctx.createGain();
    airLfoGain.gain.value = 0.01;
    airLfo.connect(airLfoGain);
    airLfoGain.connect(airGain.gain);

    airHum.connect(airGain);
    airHum2.connect(airGain);
    airGain.connect(this.lowpassFilter!);

    airHum.start();
    airHum2.start();
    airLfo.start();

    airLayer.oscillators.push(airHum, airHum2, airLfo);
    airLayer.gain = airGain;
    airLayer.isActive = true;
    this.baseLayers.set('station_air', airLayer);

    // Layer 2: Distant machinery (rhythmic pulsing)
    const machineryLayer = this.createLayer('station_machinery');
    const machineOsc = ctx.createOscillator();
    machineOsc.type = 'sawtooth';
    machineOsc.frequency.value = 30;

    const machineFilter = ctx.createBiquadFilter();
    machineFilter.type = 'lowpass';
    machineFilter.frequency.value = 80;
    machineFilter.Q.value = 5;

    const machineGain = ctx.createGain();
    machineGain.gain.value = intensity * 0.04;

    // Rhythmic pulse
    const pulseLfo = ctx.createOscillator();
    pulseLfo.frequency.value = 0.5; // Slow pulse
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = intensity * 0.02;
    pulseLfo.connect(pulseGain);
    pulseGain.connect(machineGain.gain);

    machineOsc.connect(machineFilter);
    machineFilter.connect(machineGain);
    machineGain.connect(this.lowpassFilter!);

    machineOsc.start();
    pulseLfo.start();

    machineryLayer.oscillators.push(machineOsc, pulseLfo);
    machineryLayer.gain = machineGain;
    machineryLayer.isActive = true;
    this.baseLayers.set('station_machinery', machineryLayer);

    // Layer 3: Electrical buzzing (high frequency component)
    const electricLayer = this.createLayer('station_electric');
    const elecOsc = ctx.createOscillator();
    elecOsc.type = 'sawtooth';
    elecOsc.frequency.value = 120; // 120Hz hum (electrical frequency)

    const elecOsc2 = ctx.createOscillator();
    elecOsc2.type = 'sawtooth';
    elecOsc2.frequency.value = 240; // Harmonic

    const elecFilter = ctx.createBiquadFilter();
    elecFilter.type = 'bandpass';
    elecFilter.frequency.value = 180;
    elecFilter.Q.value = 3;

    const elecGain = ctx.createGain();
    elecGain.gain.value = intensity * 0.02;

    elecOsc.connect(elecFilter);
    elecOsc2.connect(elecFilter);
    elecFilter.connect(elecGain);
    elecGain.connect(this.lowpassFilter!);

    elecOsc.start();
    elecOsc2.start();

    electricLayer.oscillators.push(elecOsc, elecOsc2);
    electricLayer.gain = elecGain;
    electricLayer.isActive = true;
    this.baseLayers.set('station_electric', electricLayer);

    // Detail layer: Occasional beeps and clicks
    const detailInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'station') return;
      if (Math.random() < 0.2) {
        this.playStationBeep(intensity);
      }
    }, 4000);
    this.intervalIds.push(detailInterval);

    // Event layer: Occasional PA announcements (very distant)
    const paInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'station') return;
      if (Math.random() < 0.05) {
        this.playDistantPA(intensity);
      }
    }, 15000);
    this.intervalIds.push(paInterval);
  }

  private playStationBeep(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800 + Math.random() * 600;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.lowpassFilter!);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playDistantPA(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    // Simulate distant garbled announcement with filtered noise
    const bufferSize = ctx.sampleRate * 1.5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    // Modulated noise to simulate speech patterns
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      const speechMod = Math.sin(t * 8) * 0.5 + 0.5; // Speech rhythm
      data[i] = (Math.random() * 2 - 1) * speechMod * 0.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 5;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.02, now + 0.1);
    gain.gain.setValueAtTime(intensity * 0.02, now + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.convolverNode!); // Heavy reverb for distance

    noise.start(now);
    noise.stop(now + 1.6);
  }

  // -------------------------------------------------------------------------
  // SURFACE ENVIRONMENT
  // -------------------------------------------------------------------------

  private createSurfaceEnvironment(ctx: AudioContext, intensity: number): void {
    // Layer 1: Wind base (brown noise filtered)
    const windLayer = this.createLayer('surface_wind');
    const windBuffer = this.createBrownNoiseBuffer(ctx, 4);
    const windNoise = ctx.createBufferSource();
    windNoise.buffer = windBuffer;
    windNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 1;

    // Wind intensity modulation
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.15;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 200;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = intensity * 0.15;

    // Volume modulation for gusts
    const gustLfo = ctx.createOscillator();
    gustLfo.frequency.value = 0.08;
    const gustGain = ctx.createGain();
    gustGain.gain.value = intensity * 0.05;
    gustLfo.connect(gustGain);
    gustGain.connect(windGain.gain);

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.lowpassFilter!);

    windNoise.start();
    windLfo.start();
    gustLfo.start();

    windLayer.sources.push(windNoise);
    windLayer.oscillators.push(windLfo, gustLfo);
    windLayer.gain = windGain;
    windLayer.isActive = true;
    this.baseLayers.set('surface_wind', windLayer);

    // Layer 2: Wind whistling (high resonant component)
    const whistleLayer = this.createLayer('surface_whistle');
    const whistleOsc = ctx.createOscillator();
    whistleOsc.type = 'sine';
    whistleOsc.frequency.value = 800;

    const whistleOsc2 = ctx.createOscillator();
    whistleOsc2.type = 'sine';
    whistleOsc2.frequency.value = 1200;

    // Frequency modulation for eerie whistle
    const whistleLfo = ctx.createOscillator();
    whistleLfo.frequency.value = 0.3;
    const whistleLfoGain = ctx.createGain();
    whistleLfoGain.gain.value = 100;
    whistleLfo.connect(whistleLfoGain);
    whistleLfoGain.connect(whistleOsc.frequency);

    const whistleGain = ctx.createGain();
    whistleGain.gain.value = intensity * 0.015;

    whistleOsc.connect(whistleGain);
    whistleOsc2.connect(whistleGain);
    whistleGain.connect(this.lowpassFilter!);

    whistleOsc.start();
    whistleOsc2.start();
    whistleLfo.start();

    whistleLayer.oscillators.push(whistleOsc, whistleOsc2, whistleLfo);
    whistleLayer.gain = whistleGain;
    whistleLayer.isActive = true;
    this.baseLayers.set('surface_whistle', whistleLayer);

    // Detail layer: Distant thunder/explosions
    const thunderInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'surface') return;
      if (Math.random() < 0.15) {
        this.playDistantThunder(intensity);
      }
    }, 8000);
    this.intervalIds.push(thunderInterval);

    // Detail layer: Alien wildlife sounds
    const wildlifeInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'surface') return;
      if (Math.random() < 0.1) {
        this.playAlienWildlife(intensity);
      }
    }, 12000);
    this.intervalIds.push(wildlifeInterval);
  }

  private playDistantThunder(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(40 + Math.random() * 20, now);
    rumble.frequency.exponentialRampToValueAtTime(20, now + 2);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 100;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(intensity * 0.08, now + 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.convolverNode!); // Reverb for distance

    rumble.start(now);
    rumble.stop(now + 3);
  }

  private playAlienWildlife(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const type = Math.random();

    if (type < 0.5) {
      // Distant howl
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.3);
      osc.frequency.linearRampToValueAtTime(200, now + 0.8);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 300;
      filter.Q.value = 5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(intensity * 0.03, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.convolverNode!);

      osc.start(now);
      osc.stop(now + 1.1);
    } else {
      // Chittering clicks
      for (let i = 0; i < 5; i++) {
        const click = ctx.createOscillator();
        click.type = 'square';
        click.frequency.value = 1000 + Math.random() * 500;

        const clickGain = ctx.createGain();
        const clickTime = now + i * 0.08;
        clickGain.gain.setValueAtTime(0, clickTime);
        clickGain.gain.linearRampToValueAtTime(intensity * 0.02, clickTime + 0.01);
        clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.05);

        click.connect(clickGain);
        clickGain.connect(this.convolverNode!);

        click.start(clickTime);
        click.stop(clickTime + 0.06);
      }
    }
  }

  // -------------------------------------------------------------------------
  // HIVE ENVIRONMENT
  // -------------------------------------------------------------------------

  private createHiveEnvironment(ctx: AudioContext, intensity: number): void {
    // Layer 1: Organic pulsing base (heartbeat-like rhythm)
    const pulseLayer = this.createLayer('hive_pulse');
    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = 25; // Very low

    const pulseOsc2 = ctx.createOscillator();
    pulseOsc2.type = 'sine';
    pulseOsc2.frequency.value = 50;

    // Heartbeat rhythm LFO
    const heartbeatLfo = ctx.createOscillator();
    heartbeatLfo.frequency.value = 0.8; // ~50 bpm
    const heartbeatGain = ctx.createGain();
    heartbeatGain.gain.value = intensity * 0.1;
    heartbeatLfo.connect(heartbeatGain);

    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    heartbeatGain.connect(pulseGain.gain);

    pulseOsc.connect(pulseGain);
    pulseOsc2.connect(pulseGain);
    pulseGain.connect(this.lowpassFilter!);

    pulseOsc.start();
    pulseOsc2.start();
    heartbeatLfo.start();

    pulseLayer.oscillators.push(pulseOsc, pulseOsc2, heartbeatLfo);
    pulseLayer.gain = pulseGain;
    pulseLayer.isActive = true;
    this.baseLayers.set('hive_pulse', pulseLayer);

    // Layer 2: Wet, squelching ambience
    const squelchLayer = this.createLayer('hive_squelch');
    const squelchBuffer = this.createPinkNoiseBuffer(ctx, 3);
    const squelchNoise = ctx.createBufferSource();
    squelchNoise.buffer = squelchBuffer;
    squelchNoise.loop = true;

    const squelchFilter = ctx.createBiquadFilter();
    squelchFilter.type = 'lowpass';
    squelchFilter.frequency.value = 300;
    squelchFilter.Q.value = 3;

    // Modulate filter for organic movement
    const squelchLfo = ctx.createOscillator();
    squelchLfo.frequency.value = 0.2;
    const squelchLfoGain = ctx.createGain();
    squelchLfoGain.gain.value = 100;
    squelchLfo.connect(squelchLfoGain);
    squelchLfoGain.connect(squelchFilter.frequency);

    const squelchGain = ctx.createGain();
    squelchGain.gain.value = intensity * 0.05;

    squelchNoise.connect(squelchFilter);
    squelchFilter.connect(squelchGain);
    squelchGain.connect(this.lowpassFilter!);

    squelchNoise.start();
    squelchLfo.start();

    squelchLayer.sources.push(squelchNoise);
    squelchLayer.oscillators.push(squelchLfo);
    squelchLayer.gain = squelchGain;
    squelchLayer.isActive = true;
    this.baseLayers.set('hive_squelch', squelchLayer);

    // Layer 3: Low sub-bass drone
    const droneLayer = this.createLayer('hive_drone');
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 35;

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 60;

    const droneGain = ctx.createGain();
    droneGain.gain.value = intensity * 0.06;

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.lowpassFilter!);

    droneOsc.start();

    droneLayer.oscillators.push(droneOsc);
    droneLayer.gain = droneGain;
    droneLayer.isActive = true;
    this.baseLayers.set('hive_drone', droneLayer);

    // Detail layer: Dripping moisture
    const dripInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.25) {
        this.playDrip(intensity);
      }
    }, 2000);
    this.intervalIds.push(dripInterval);

    // Detail layer: Distant alien shrieks
    const shriekInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.1) {
        this.playDistantAlienShriek(intensity);
      }
    }, 10000);
    this.intervalIds.push(shriekInterval);

    // Detail layer: Chittering (closer aliens)
    const chitterInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.15) {
        this.playAlienChitter(intensity);
      }
    }, 5000);
    this.intervalIds.push(chitterInterval);
  }

  private playDrip(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const delay = Math.random() * 0.5;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000 + Math.random() * 1000, now + delay);
    osc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.1);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(intensity * 0.04, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.convolverNode!); // Reverb for cave echo

    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  }

  private playDistantAlienShriek(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.8);

    // Vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 30;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.04, now + 0.1);
    gain.gain.setValueAtTime(intensity * 0.04, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.convolverNode!);

    osc.start(now);
    osc.stop(now + 1.1);
    lfo.start(now);
    lfo.stop(now + 1.1);
  }

  private playAlienChitter(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const count = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 300 + Math.random() * 400;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(intensity * 0.02, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(this.lowpassFilter!);

      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  // -------------------------------------------------------------------------
  // BASE (ABANDONED/HORROR) ENVIRONMENT
  // -------------------------------------------------------------------------

  private createBaseEnvironment(ctx: AudioContext, intensity: number): void {
    // Layer 1: Eerie low drone
    const droneLayer = this.createLayer('base_drone');
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 40;

    const droneOsc2 = ctx.createOscillator();
    droneOsc2.type = 'sine';
    droneOsc2.frequency.value = 42; // Slight detune for unease

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 100;

    const droneGain = ctx.createGain();
    droneGain.gain.value = intensity * 0.06;

    droneOsc.connect(droneFilter);
    droneOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.lowpassFilter!);

    droneOsc.start();
    droneOsc2.start();

    droneLayer.oscillators.push(droneOsc, droneOsc2);
    droneLayer.gain = droneGain;
    droneLayer.isActive = true;
    this.baseLayers.set('base_drone', droneLayer);

    // Layer 2: Subtle wind through broken structures
    const windLayer = this.createLayer('base_wind');
    const windBuffer = this.createBrownNoiseBuffer(ctx, 3);
    const windNoise = ctx.createBufferSource();
    windNoise.buffer = windBuffer;
    windNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 5;

    // Slow modulation
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.08;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 300;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = intensity * 0.04;

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.lowpassFilter!);

    windNoise.start();
    windLfo.start();

    windLayer.sources.push(windNoise);
    windLayer.oscillators.push(windLfo);
    windLayer.gain = windGain;
    windLayer.isActive = true;
    this.baseLayers.set('base_wind', windLayer);

    // Detail layer: Metal creaks
    const creakInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'base') return;
      if (Math.random() < 0.12) {
        this.playMetalCreak(intensity);
      }
    }, 6000);
    this.intervalIds.push(creakInterval);

    // Detail layer: Distant footsteps/movement
    const footstepInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'base') return;
      if (Math.random() < 0.08) {
        this.playDistantMovement(intensity);
      }
    }, 10000);
    this.intervalIds.push(footstepInterval);

    // Detail layer: Electrical shorts
    const electricInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'base') return;
      if (Math.random() < 0.1) {
        this.playElectricalShort(intensity);
      }
    }, 8000);
    this.intervalIds.push(electricInterval);
  }

  private playMetalCreak(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100 + Math.random() * 50, now);
    osc.frequency.linearRampToValueAtTime(70 + Math.random() * 30, now + 0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.04, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.convolverNode!);

    osc.start(now);
    osc.stop(now + 0.7);
  }

  private playDistantMovement(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const steps = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < steps; i++) {
      const t = now + i * 0.6;
      const buffer = this.createWhiteNoiseBuffer(ctx, 0.1);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(intensity * 0.02, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.convolverNode!);

      noise.start(t);
      noise.stop(t + 0.1);
    }
  }

  private playElectricalShort(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const bursts = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < bursts; i++) {
      const t = now + i * 0.1 + Math.random() * 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 120 + Math.random() * 60;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(intensity * 0.05, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.lowpassFilter!);

      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  // -------------------------------------------------------------------------
  // EXTRACTION ENVIRONMENT
  // -------------------------------------------------------------------------

  private createExtractionEnvironment(ctx: AudioContext, intensity: number): void {
    // Layer 1: Urgent low rumble
    const rumbleLayer = this.createLayer('extraction_rumble');
    const rumbleOsc1 = ctx.createOscillator();
    rumbleOsc1.type = 'sawtooth';
    rumbleOsc1.frequency.value = 45;

    const rumbleOsc2 = ctx.createOscillator();
    rumbleOsc2.type = 'sawtooth';
    rumbleOsc2.frequency.value = 48;

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = intensity * 0.08;

    rumbleOsc1.connect(rumbleFilter);
    rumbleOsc2.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.lowpassFilter!);

    rumbleOsc1.start();
    rumbleOsc2.start();

    rumbleLayer.oscillators.push(rumbleOsc1, rumbleOsc2);
    rumbleLayer.gain = rumbleGain;
    rumbleLayer.isActive = true;
    this.baseLayers.set('extraction_rumble', rumbleLayer);

    // Layer 2: Wind with urgency
    const windLayer = this.createLayer('extraction_wind');
    const windBuffer = this.createBrownNoiseBuffer(ctx, 4);
    const windNoise = ctx.createBufferSource();
    windNoise.buffer = windBuffer;
    windNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 2;

    const windGain = ctx.createGain();
    windGain.gain.value = intensity * 0.1;

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.lowpassFilter!);

    windNoise.start();

    windLayer.sources.push(windNoise);
    windLayer.gain = windGain;
    windLayer.isActive = true;
    this.baseLayers.set('extraction_wind', windLayer);

    // Detail layer: Distant explosions
    const explosionInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'extraction') return;
      if (Math.random() < 0.2) {
        this.playDistantExplosion(intensity);
      }
    }, 4000);
    this.intervalIds.push(explosionInterval);

    // Detail layer: Gunfire echoes
    const gunfireInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'extraction') return;
      if (Math.random() < 0.15) {
        this.playDistantGunfire(intensity);
      }
    }, 6000);
    this.intervalIds.push(gunfireInterval);

    // Detail layer: Radio chatter
    const radioInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'extraction') return;
      if (Math.random() < 0.1) {
        this.playRadioChatter(intensity);
      }
    }, 10000);
    this.intervalIds.push(radioInterval);
  }

  private playDistantExplosion(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const delay = Math.random() * 0.5;

    // Impact
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(60, now + delay);
    boom.frequency.exponentialRampToValueAtTime(20, now + delay + 0.3);

    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0, now + delay);
    boomGain.gain.linearRampToValueAtTime(intensity * 0.1, now + delay + 0.05);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

    boom.connect(boomGain);
    boomGain.connect(this.convolverNode!);

    boom.start(now + delay);
    boom.stop(now + delay + 0.6);

    // Debris noise
    const noiseBuffer = this.createWhiteNoiseBuffer(ctx, 0.5);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, now + delay);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + delay + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now + delay);
    noiseGain.gain.linearRampToValueAtTime(intensity * 0.06, now + delay + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.convolverNode!);

    noise.start(now + delay);
    noise.stop(now + delay + 0.6);
  }

  private playDistantGunfire(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const shots = 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < shots; i++) {
      const t = now + i * 0.15 + Math.random() * 0.05;
      const buffer = this.createWhiteNoiseBuffer(ctx, 0.05);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + Math.random() * 500;
      filter.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(intensity * 0.03, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.convolverNode!);

      noise.start(t);
      noise.stop(t + 0.06);
    }
  }

  private playRadioChatter(intensity: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.8 + Math.random() * 0.5;

    // Static noise
    const staticBuffer = this.createWhiteNoiseBuffer(ctx, duration);
    const staticNoise = ctx.createBufferSource();
    staticNoise.buffer = staticBuffer;

    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 2000;
    staticFilter.Q.value = 2;

    const staticGain = ctx.createGain();
    staticGain.gain.value = intensity * 0.015;

    staticNoise.connect(staticFilter);
    staticFilter.connect(staticGain);
    staticGain.connect(this.lowpassFilter!);

    staticNoise.start(now);
    staticNoise.stop(now + duration);

    // Simulated voice (modulated tone)
    const voiceOsc = ctx.createOscillator();
    voiceOsc.type = 'sawtooth';
    voiceOsc.frequency.value = 150;

    const voiceFilter = ctx.createBiquadFilter();
    voiceFilter.type = 'bandpass';
    voiceFilter.frequency.value = 800;
    voiceFilter.Q.value = 5;

    // Speech modulation
    const voiceLfo = ctx.createOscillator();
    voiceLfo.frequency.value = 8;
    const voiceLfoGain = ctx.createGain();
    voiceLfoGain.gain.value = 50;
    voiceLfo.connect(voiceLfoGain);
    voiceLfoGain.connect(voiceOsc.frequency);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(intensity * 0.02, now + 0.05);
    voiceGain.gain.setValueAtTime(intensity * 0.02, now + duration - 0.1);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    voiceOsc.connect(voiceFilter);
    voiceFilter.connect(voiceGain);
    voiceGain.connect(this.lowpassFilter!);

    voiceOsc.start(now);
    voiceOsc.stop(now + duration);
    voiceLfo.start(now);
    voiceLfo.stop(now + duration);
  }

  // ============================================================================
  // SPATIAL AUDIO
  // ============================================================================

  /**
   * Add a spatial sound source at a world position
   */
  addSpatialSource(source: SpatialSoundSource): void {
    this.spatialSources.set(source.id, source);

    if (source.active) {
      this.startSpatialSource(source);
    }
  }

  /**
   * Remove a spatial sound source
   */
  removeSpatialSource(id: string): void {
    this.stopSpatialSource(id);
    this.spatialSources.delete(id);
  }

  /**
   * Update player position for spatial audio calculations
   */
  updatePlayerPosition(position: { x: number; y: number; z: number }): void {
    this.playerPosition = position;
    this.updateSpatialAudio();
  }

  private startSpatialSource(source: SpatialSoundSource): void {
    const ctx = this.getContext();
    const layer = this.createLayer(source.id);

    // Create panner for 3D positioning
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = source.maxDistance;
    panner.rolloffFactor = 1.5;
    panner.setPosition(source.position.x, source.position.y, source.position.z);

    const gain = ctx.createGain();
    gain.gain.value = source.volume;

    // Create occlusion filter (lowpass for muffling when behind walls)
    const occlusionFilter = ctx.createBiquadFilter();
    occlusionFilter.type = 'lowpass';
    occlusionFilter.frequency.value = 20000; // Start fully open
    occlusionFilter.Q.value = 0.7;

    // Create appropriate sound for the source type
    this.createSpatialSoundNodes(source.type, ctx, layer, panner);

    // Connect: panner -> occlusion filter -> gain -> master lowpass
    panner.connect(occlusionFilter);
    occlusionFilter.connect(gain);
    gain.connect(this.lowpassFilter!);

    this.spatialNodes.set(source.id, { gain, panner, layer, occlusionFilter });

    // Set up interval for periodic sounds
    if (source.interval) {
      const intervalId = setInterval(() => {
        if (!source.active) return;
        this.triggerSpatialEvent(source);
      }, source.interval);
      this.intervalIds.push(intervalId);
    }
  }

  private createSpatialSoundNodes(
    type: SpatialSoundType,
    ctx: AudioContext,
    layer: AudioLayer,
    panner: PannerNode
  ): void {
    switch (type) {
      case 'machinery': {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;

        osc.connect(filter);
        filter.connect(panner);
        osc.start();
        layer.oscillators.push(osc);
        break;
      }
      case 'electrical_panel': {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        osc.connect(panner);
        osc.start();
        layer.oscillators.push(osc);
        break;
      }
      case 'vent': {
        const noise = ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer(ctx, 2);
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 2;

        noise.connect(filter);
        filter.connect(panner);
        noise.start();
        layer.sources.push(noise);
        break;
      }
      case 'dripping':
        // Periodic sound, handled by interval
        break;
      case 'organic_growth': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 30;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);

        const outGain = ctx.createGain();
        outGain.gain.value = 0;
        lfoGain.connect(outGain.gain);

        osc.connect(outGain);
        outGain.connect(panner);

        osc.start();
        lfo.start();
        layer.oscillators.push(osc, lfo);
        break;
      }
      case 'generator': {
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.value = 55;

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = 57;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 100;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(panner);

        osc1.start();
        osc2.start();
        layer.oscillators.push(osc1, osc2);
        break;
      }
      case 'wind_howl': {
        // Eerie wind whistling through gaps
        const noise = ctx.createBufferSource();
        noise.buffer = this.createBrownNoiseBuffer(ctx, 3);
        noise.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 600;
        windFilter.Q.value = 5;

        // Modulate filter frequency for whistling effect
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.2;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(windFilter.frequency);

        noise.connect(windFilter);
        windFilter.connect(panner);

        noise.start();
        lfo.start();
        layer.sources.push(noise);
        layer.oscillators.push(lfo);
        break;
      }
      case 'hive_heartbeat': {
        // Deep organic pulsing
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 25;

        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.value = 50;

        // Heartbeat LFO (slower pulse)
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.6; // ~36 bpm heartbeat
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 1;

        const outGain = ctx.createGain();
        outGain.gain.value = 0;
        lfo.connect(lfoGain);
        lfoGain.connect(outGain.gain);

        osc.connect(outGain);
        subOsc.connect(outGain);
        outGain.connect(panner);

        osc.start();
        subOsc.start();
        lfo.start();
        layer.oscillators.push(osc, subOsc, lfo);
        break;
      }
      case 'acid_bubbling': {
        // Bubbling liquid sounds
        const noise = ctx.createBufferSource();
        noise.buffer = this.createPinkNoiseBuffer(ctx, 2);
        noise.loop = true;

        const bubbleFilter = ctx.createBiquadFilter();
        bubbleFilter.type = 'bandpass';
        bubbleFilter.frequency.value = 400;
        bubbleFilter.Q.value = 8;

        // Random modulation for bubble effect
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 3;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(bubbleFilter.frequency);

        noise.connect(bubbleFilter);
        bubbleFilter.connect(panner);

        noise.start();
        lfo.start();
        layer.sources.push(noise);
        layer.oscillators.push(lfo);
        break;
      }
      case 'radio_static': {
        // Distant radio/comms chatter
        const noise = ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer(ctx, 2);
        noise.loop = true;

        const radioFilter = ctx.createBiquadFilter();
        radioFilter.type = 'bandpass';
        radioFilter.frequency.value = 2000;
        radioFilter.Q.value = 3;

        // Volume modulation for speech-like patterns
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;

        const outGain = ctx.createGain();
        outGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(outGain.gain);

        noise.connect(radioFilter);
        radioFilter.connect(outGain);
        outGain.connect(panner);

        noise.start();
        lfo.start();
        layer.sources.push(noise);
        layer.oscillators.push(lfo);
        break;
      }
      case 'debris_settling':
        // Periodic sound, handled by interval - occasional creaks
        break;
      case 'fire': {
        // Crackling fire
        const noise = ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer(ctx, 2);
        noise.loop = true;

        const fireFilter = ctx.createBiquadFilter();
        fireFilter.type = 'bandpass';
        fireFilter.frequency.value = 1000;
        fireFilter.Q.value = 1;

        // Crackling modulation
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.4;

        const outGain = ctx.createGain();
        outGain.gain.value = 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(outGain.gain);

        noise.connect(fireFilter);
        fireFilter.connect(outGain);
        outGain.connect(panner);

        noise.start();
        lfo.start();
        layer.sources.push(noise);
        layer.oscillators.push(lfo);
        break;
      }
      case 'steam': {
        // Steam vent hissing
        const noise = ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer(ctx, 2);
        noise.loop = true;

        const steamFilter = ctx.createBiquadFilter();
        steamFilter.type = 'highpass';
        steamFilter.frequency.value = 3000;
        steamFilter.Q.value = 0.5;

        noise.connect(steamFilter);
        steamFilter.connect(panner);

        noise.start();
        layer.sources.push(noise);
        break;
      }
      case 'terminal': {
        // Computer beeps - handled by interval
        break;
      }
      case 'alien_nest': {
        // Wet, organic sounds with occasional chittering
        const noise = ctx.createBufferSource();
        noise.buffer = this.createPinkNoiseBuffer(ctx, 2);
        noise.loop = true;

        const nestFilter = ctx.createBiquadFilter();
        nestFilter.type = 'lowpass';
        nestFilter.frequency.value = 300;
        nestFilter.Q.value = 2;

        // Slow modulation for organic movement
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.3;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 100;
        lfo.connect(lfoGain);
        lfoGain.connect(nestFilter.frequency);

        noise.connect(nestFilter);
        nestFilter.connect(panner);

        noise.start();
        lfo.start();
        layer.sources.push(noise);
        layer.oscillators.push(lfo);
        break;
      }
      default:
        break;
    }

    layer.isActive = true;
  }

  private triggerSpatialEvent(source: SpatialSoundSource): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const nodeInfo = this.spatialNodes.get(source.id);
    if (!nodeInfo) return;

    // Distance check
    const dx = source.position.x - this.playerPosition.x;
    const dy = source.position.y - this.playerPosition.y;
    const dz = source.position.z - this.playerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > source.maxDistance) return;

    // Apply occlusion to the volume
    const occlusionMod =
      this.occlusionConfig.enabled && source.occlusionLevel
        ? 1 - source.occlusionLevel * (1 - this.occlusionConfig.occludedVolume)
        : 1;
    const effectiveVolume = source.volume * occlusionMod;

    // Play event sound based on type
    switch (source.type) {
      case 'dripping':
        this.playSpatialDrip(nodeInfo.panner, effectiveVolume);
        break;
      case 'debris_settling':
        this.playSpatialCreak(nodeInfo.panner, effectiveVolume);
        break;
      case 'terminal':
        this.playSpatialBeep(nodeInfo.panner, effectiveVolume);
        break;
    }
  }

  private playSpatialCreak(panner: PannerNode, volume: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Metal creak sound
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 40, now);
    osc.frequency.linearRampToValueAtTime(60 + Math.random() * 20, now + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 150 + Math.random() * 100;
    filter.Q.value = 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  private playSpatialBeep(panner: PannerNode, volume: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Computer beep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800 + Math.random() * 400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(panner);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playSpatialDrip(panner: PannerNode, volume: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(panner);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private stopSpatialSource(id: string): void {
    const nodeInfo = this.spatialNodes.get(id);
    if (!nodeInfo) return;

    const layer = nodeInfo.layer;
    for (const osc of layer.oscillators) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const src of layer.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }

    nodeInfo.gain.disconnect();
    nodeInfo.panner.disconnect();
    this.spatialNodes.delete(id);
  }

  private updateSpatialAudio(): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    // Update listener position
    const listener = ctx.listener;
    if (listener.positionX) {
      listener.positionX.value = this.playerPosition.x;
      listener.positionY.value = this.playerPosition.y;
      listener.positionZ.value = this.playerPosition.z;
    } else {
      listener.setPosition(this.playerPosition.x, this.playerPosition.y, this.playerPosition.z);
    }

    // Update volume of spatial sources based on distance and occlusion
    for (const [id, nodeInfo] of this.spatialNodes) {
      const source = this.spatialSources.get(id);
      if (!source) continue;

      // Apply occlusion effect (muffles sound when behind walls)
      this.applyOcclusion(source, nodeInfo);

      // If occlusion is disabled or not applicable, just apply combat modifier
      if (!this.occlusionConfig.enabled || source.occludable === false) {
        const combatMod = this.isInCombat ? 0.5 : 1.0;
        nodeInfo.gain.gain.value = source.volume * combatMod;
      }
    }
  }

  // ============================================================================
  // AUDIO ZONES
  // ============================================================================

  /**
   * Add an audio zone to the level
   */
  addZone(zone: AudioZone): void {
    this.zones.set(zone.id, zone);
  }

  /**
   * Remove an audio zone
   */
  removeZone(id: string): void {
    this.zones.delete(id);
    if (this.activeZone?.id === id) {
      this.activeZone = null;
    }
  }

  /**
   * Check which zone the player is in and update audio accordingly
   */
  updateZoneCheck(): void {
    let closestZone: AudioZone | null = null;
    let closestDistance = Infinity;

    for (const zone of this.zones.values()) {
      const dx = zone.position.x - this.playerPosition.x;
      const dy = zone.position.y - this.playerPosition.y;
      const dz = zone.position.z - this.playerPosition.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < zone.radius && distance < closestDistance) {
        closestZone = zone;
        closestDistance = distance;
      }
    }

    if (closestZone !== this.activeZone) {
      this.onZoneChange(closestZone);
    }
  }

  private onZoneChange(newZone: AudioZone | null): void {
    const oldZone = this.activeZone;
    this.activeZone = newZone;

    if (newZone) {
      // Apply zone-specific audio modifications
      if (newZone.type !== this.currentEnvironment) {
        this.transitionToEnvironment(newZone.type, newZone.intensity ?? 1.0, 1.5);
      }

      // Apply reverb based on indoor/outdoor
      if (newZone.isIndoor) {
        this.setReverbWetLevel(0.5);
        this.setLowpassCutoff(6000);
      } else {
        this.setReverbWetLevel(0.15);
        this.setLowpassCutoff(20000);
      }

      // Radiation zone adds geiger counter
      if (newZone.hasRadiation) {
        this.startGeigerCounter();
      } else if (oldZone?.hasRadiation) {
        this.stopGeigerCounter();
      }
    }
  }

  // ============================================================================
  // SPECIAL EFFECTS
  // ============================================================================

  private geigerIntervalId: ReturnType<typeof setInterval> | null = null;

  private startGeigerCounter(): void {
    if (this.geigerIntervalId) return;

    this.geigerIntervalId = setInterval(
      () => {
        if (!this.isPlaying) return;
        this.playGeigerClick();
      },
      50 + Math.random() * 200
    );
    this.intervalIds.push(this.geigerIntervalId);
  }

  private stopGeigerCounter(): void {
    if (this.geigerIntervalId) {
      clearInterval(this.geigerIntervalId);
      this.geigerIntervalId = null;
    }
  }

  private playGeigerClick(): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1000 + Math.random() * 500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

    osc.connect(gain);
    gain.connect(this.lowpassFilter!);

    osc.start(now);
    osc.stop(now + 0.015);
  }

  /**
   * Play emergency klaxon (for station alerts)
   */
  playEmergencyKlaxon(duration = 3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-tone klaxon
    for (let i = 0; i < duration * 2; i++) {
      const t = now + i * 0.5;
      const freq = i % 2 === 0 ? 440 : 554; // A4 and C#5

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.setValueAtTime(0.15, t + 0.4);
      gain.gain.linearRampToValueAtTime(0, t + 0.5);

      osc.connect(gain);
      gain.connect(this.lowpassFilter!);

      osc.start(t);
      osc.stop(t + 0.5);
    }
  }

  // ============================================================================
  // AUDIO OCCLUSION
  // ============================================================================

  /**
   * Set the occlusion callback function.
   * The level should provide a callback that returns an occlusion level (0-1)
   * based on whether there are walls between the source and listener.
   *
   * @param callback - Function that returns 0 (clear) to 1 (fully blocked)
   */
  setOcclusionCallback(
    callback:
      | ((
          sourcePos: { x: number; y: number; z: number },
          listenerPos: { x: number; y: number; z: number }
        ) => number)
      | null
  ): void {
    this.occlusionCallback = callback;
  }

  /**
   * Configure audio occlusion settings.
   */
  setOcclusionConfig(config: Partial<OcclusionConfig>): void {
    this.occlusionConfig = { ...this.occlusionConfig, ...config };
  }

  /**
   * Enable or disable audio occlusion.
   */
  setOcclusionEnabled(enabled: boolean): void {
    this.occlusionConfig.enabled = enabled;
  }

  /**
   * Apply occlusion to a spatial sound source.
   * Called during updateSpatialAudio() for each source.
   */
  private applyOcclusion(
    source: SpatialSoundSource,
    nodeInfo: {
      gain: GainNode;
      panner: PannerNode;
      layer: AudioLayer;
      occlusionFilter?: BiquadFilterNode;
    }
  ): void {
    if (!this.occlusionConfig.enabled || source.occludable === false) {
      // No occlusion - ensure filter is at max frequency
      if (nodeInfo.occlusionFilter) {
        nodeInfo.occlusionFilter.frequency.value = 20000;
      }
      return;
    }

    // Calculate occlusion level
    let occlusionLevel = 0;
    if (this.occlusionCallback) {
      occlusionLevel = this.occlusionCallback(source.position, this.playerPosition);
    }

    // Store occlusion level on source for external reference
    source.occlusionLevel = occlusionLevel;

    // Apply occlusion effect
    if (nodeInfo.occlusionFilter && occlusionLevel > 0) {
      const ctx = this.audioContext;
      if (ctx) {
        // Interpolate filter cutoff based on occlusion level
        const minCutoff = this.occlusionConfig.occludedCutoff;
        const maxCutoff = 20000;
        const targetCutoff = maxCutoff - (maxCutoff - minCutoff) * occlusionLevel;

        // Smooth transition
        nodeInfo.occlusionFilter.frequency.linearRampToValueAtTime(
          targetCutoff,
          ctx.currentTime + 0.1
        );

        // Also reduce volume based on occlusion
        const baseVolume = source.volume * (this.isInCombat ? 0.5 : 1.0);
        const volumeMod = 1 - occlusionLevel * (1 - this.occlusionConfig.occludedVolume);
        nodeInfo.gain.gain.linearRampToValueAtTime(baseVolume * volumeMod, ctx.currentTime + 0.1);
      }
    }
  }

  // ============================================================================
  // COMBAT STATE
  // ============================================================================

  /**
   * Set combat state (reduces ambient audio intensity)
   */
  setCombatState(inCombat: boolean): void {
    if (this.isInCombat === inCombat) return;
    this.isInCombat = inCombat;

    const targetVolume = inCombat ? 0.3 : 1.0;
    this.fadeAllLayersTo(targetVolume, 1.0);
  }

  // ============================================================================
  // VOLUME AND EFFECTS CONTROL
  // ============================================================================

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  private setReverbWetLevel(level: number): void {
    if (this.reverbGain) {
      const ctx = this.audioContext;
      if (ctx) {
        this.reverbGain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.5);
      }
    }
  }

  private setLowpassCutoff(frequency: number): void {
    if (this.lowpassFilter) {
      const ctx = this.audioContext;
      if (ctx) {
        this.lowpassFilter.frequency.linearRampToValueAtTime(frequency, ctx.currentTime + 0.5);
      }
    }
  }

  private applyReverbPreset(type: EnvironmentType): void {
    const preset = REVERB_PRESETS[type];
    this.setReverbWetLevel(preset.wetLevel);
    this.setLowpassCutoff(preset.lowpassCutoff);
    this.generateImpulseResponse(preset.decayTime);
  }

  // ============================================================================
  // LAYER MANAGEMENT
  // ============================================================================

  private createLayer(_id: string): AudioLayer {
    const ctx = this.getContext();
    return {
      nodes: [],
      oscillators: [],
      sources: [],
      gain: ctx.createGain(),
      isActive: false,
    };
  }

  private fadeOutAllLayers(duration: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    for (const layer of this.baseLayers.values()) {
      if (layer.isActive && layer.gain) {
        layer.gain.gain.linearRampToValueAtTime(0, now + duration);
      }
    }
    for (const layer of this.detailLayers.values()) {
      if (layer.isActive && layer.gain) {
        layer.gain.gain.linearRampToValueAtTime(0, now + duration);
      }
    }
  }

  private fadeAllLayersTo(targetVolume: number, duration: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    for (const layer of this.baseLayers.values()) {
      if (layer.isActive && layer.gain) {
        const current = layer.gain.gain.value;
        layer.gain.gain.linearRampToValueAtTime(current * targetVolume, now + duration);
      }
    }
  }

  private stopAllLayers(): void {
    // Stop base layers
    for (const layer of this.baseLayers.values()) {
      for (const osc of layer.oscillators) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const src of layer.sources) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.baseLayers.clear();

    // Stop detail layers
    for (const layer of this.detailLayers.values()) {
      for (const osc of layer.oscillators) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const src of layer.sources) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.detailLayers.clear();

    // Stop event layers
    for (const layer of this.eventLayers.values()) {
      for (const osc of layer.oscillators) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const src of layer.sources) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.eventLayers.clear();

    // Clear intervals
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds = [];

    // Clear timeouts
    for (const id of this.timeoutIds) {
      clearTimeout(id);
    }
    this.timeoutIds = [];
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  private startUpdateLoop(): void {
    if (this.animationFrameId !== null) return;

    const update = (timestamp: number) => {
      if (!this.isPlaying) return;

      this.time = timestamp * 0.001;
      this.updateZoneCheck();
      this.updateSpatialAudio();

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  // ============================================================================
  // NOISE BUFFER GENERATION
  // ============================================================================

  private createWhiteNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private createBrownNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Compensate for volume loss
    }

    return buffer;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // Normalize
      b6 = white * 0.115926;
    }

    return buffer;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.stopEnvironment(0);
    this.stopGeigerCounter();

    // Stop all spatial sources
    for (const id of this.spatialSources.keys()) {
      this.stopSpatialSource(id);
    }
    this.spatialSources.clear();

    // Clear zones
    this.zones.clear();

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.masterGain = null;
    this.reverbGain = null;
    this.convolverNode = null;
    this.lowpassFilter = null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let environmentalAudioInstance: EnvironmentalAudioManager | null = null;

export function getEnvironmentalAudioManager(): EnvironmentalAudioManager {
  if (!environmentalAudioInstance) {
    environmentalAudioInstance = new EnvironmentalAudioManager();
  }
  return environmentalAudioInstance;
}

export function disposeEnvironmentalAudioManager(): void {
  if (environmentalAudioInstance) {
    environmentalAudioInstance.dispose();
    environmentalAudioInstance = null;
  }
}
