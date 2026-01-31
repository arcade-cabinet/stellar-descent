/**
 * AmbientSoundscapes - Procedural Environmental Audio using Tone.js
 *
 * Creates immersive, location-specific ambient audio:
 * - Station: Low hum + occasional beeps + distant machinery
 * - Surface: Wind (filtered noise) + alien atmosphere
 * - Hive: Organic pulses + dripping + distant screeches
 * - Ice: Howling wind + cracking + crystalline shimmer
 * - Mining: Rumbles + dripping + echoes
 *
 * Features:
 * - Layered procedural synthesis
 * - Dynamic random events for organic feel
 * - Seamless crossfading between environments
 * - Performance-optimized with shared resources
 */

import * as Tone from 'tone';

// ============================================================================
// TYPES
// ============================================================================

export type EnvironmentType = 'station' | 'surface' | 'hive' | 'ice' | 'mining';

interface AmbientLayer {
  id: string;
  nodes: Tone.ToneAudioNode[];
  loops: Tone.Loop[];
  intervals: ReturnType<typeof setInterval>[];
  gain: Tone.Gain;
}

// ============================================================================
// AMBIENT SOUNDSCAPES CLASS
// ============================================================================

export class AmbientSoundscapes {
  private isInitialized = false;
  private currentEnvironment: EnvironmentType | null = null;
  private isPlaying = false;
  private volume = 0.5;

  // Master chain
  private masterGain!: Tone.Gain;
  private masterReverb!: Tone.Reverb;
  private masterFilter!: Tone.Filter;
  private masterLimiter!: Tone.Limiter;

  // Active layers
  private layers: Map<string, AmbientLayer> = new Map();

  constructor() {
    // Deferred initialization
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Create master chain
    this.masterLimiter = new Tone.Limiter(-6);
    this.masterFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
    });
    this.masterReverb = new Tone.Reverb({
      decay: 4,
      wet: 0.3,
    });
    this.masterGain = new Tone.Gain(this.volume);

    // Chain: layers -> filter -> reverb -> limiter -> gain -> destination
    this.masterFilter.connect(this.masterReverb);
    this.masterReverb.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterGain);
    this.masterGain.toDestination();

    this.isInitialized = true;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Start ambient soundscape for an environment
   */
  async start(environment: EnvironmentType): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Crossfade if already playing
    if (this.isPlaying && this.currentEnvironment !== environment) {
      await this.crossfadeTo(environment);
      return;
    }

    if (this.currentEnvironment === environment && this.isPlaying) return;

    this.currentEnvironment = environment;
    this.isPlaying = true;

    // Create environment-specific layers
    switch (environment) {
      case 'station':
        this.createStationAmbient();
        break;
      case 'surface':
        this.createSurfaceAmbient();
        break;
      case 'hive':
        this.createHiveAmbient();
        break;
      case 'ice':
        this.createIceAmbient();
        break;
      case 'mining':
        this.createMiningAmbient();
        break;
    }

    // Start transport if needed
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }

    // Fade in master
    this.masterGain.gain.rampTo(this.volume, 2);
  }

  /**
   * Stop ambient soundscape
   */
  async stop(fadeTime = 2): Promise<void> {
    if (!this.isPlaying) return;

    this.masterGain.gain.rampTo(0, fadeTime);
    await new Promise((resolve) => setTimeout(resolve, fadeTime * 1000 + 100));

    this.disposeAllLayers();
    this.isPlaying = false;
    this.currentEnvironment = null;

    // Restore volume for next play
    this.masterGain.gain.value = this.volume;
  }

  /**
   * Crossfade to a new environment
   */
  private async crossfadeTo(newEnvironment: EnvironmentType): Promise<void> {
    // Fade out current
    this.masterGain.gain.rampTo(0, 1.5);
    await new Promise((resolve) => setTimeout(resolve, 1600));

    // Dispose current layers
    this.disposeAllLayers();

    // Start new environment
    this.currentEnvironment = newEnvironment;

    switch (newEnvironment) {
      case 'station':
        this.createStationAmbient();
        break;
      case 'surface':
        this.createSurfaceAmbient();
        break;
      case 'hive':
        this.createHiveAmbient();
        break;
      case 'ice':
        this.createIceAmbient();
        break;
      case 'mining':
        this.createMiningAmbient();
        break;
    }

    // Fade in
    this.masterGain.gain.rampTo(this.volume, 2);
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.isPlaying) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  /**
   * Get current environment
   */
  getCurrentEnvironment(): EnvironmentType | null {
    return this.currentEnvironment;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stop(0);
    this.disposeAllLayers();

    this.masterGain?.dispose();
    this.masterReverb?.dispose();
    this.masterFilter?.dispose();
    this.masterLimiter?.dispose();

    this.isInitialized = false;
  }

  // ============================================================================
  // STATION AMBIENT - Low hum + beeps + distant machinery
  // ============================================================================

  private createStationAmbient(): void {
    const layerGain = new Tone.Gain(0.3);
    layerGain.connect(this.masterFilter);

    const layer: AmbientLayer = {
      id: 'station',
      nodes: [],
      loops: [],
      intervals: [],
      gain: layerGain,
    };

    // === Electrical Hum (60Hz + harmonics) ===
    const hum60 = new Tone.Oscillator({ frequency: 60, type: 'sine' });
    hum60.volume.value = -18;
    hum60.connect(layerGain);
    hum60.start();
    layer.nodes.push(hum60);

    const hum120 = new Tone.Oscillator({ frequency: 120, type: 'sine' });
    hum120.volume.value = -22;
    hum120.connect(layerGain);
    hum120.start();
    layer.nodes.push(hum120);

    const hum180 = new Tone.Oscillator({ frequency: 180, type: 'sine' });
    hum180.volume.value = -26;
    hum180.connect(layerGain);
    hum180.start();
    layer.nodes.push(hum180);

    // === Occasional beeps (random timing) ===
    const beepInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'station') return;
      if (Math.random() < 0.3) {
        this.playStationBeep(layerGain);
      }
    }, 2500);
    layer.intervals.push(beepInterval);

    // === Distant machinery rumble ===
    const machineryInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'station') return;
      if (Math.random() < 0.2) {
        this.playDistantMachinery(layerGain);
      }
    }, 5000);
    layer.intervals.push(machineryInterval);

    // === Subtle air circulation noise ===
    const airNoise = new Tone.Noise({ type: 'pink' });
    const airFilter = new Tone.Filter({ frequency: 400, type: 'lowpass' });
    const airGain = new Tone.Gain(0.08);
    airNoise.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(layerGain);
    airNoise.start();
    layer.nodes.push(airNoise, airFilter, airGain);

    this.layers.set('station', layer);
  }

  private playStationBeep(destination: Tone.Gain): void {
    const now = Tone.now();
    const beep = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.1 },
    });
    beep.volume.value = -20 + Math.random() * 6;
    beep.connect(destination);

    const freq = [800, 1000, 1200, 1500][Math.floor(Math.random() * 4)];
    beep.triggerAttackRelease(freq, '8n', now);

    setTimeout(() => beep.dispose(), 300);
  }

  private playDistantMachinery(destination: Tone.Gain): void {
    const now = Tone.now();
    const machine = new Tone.Noise({ type: 'brown' });
    const machineFilter = new Tone.Filter({ frequency: 150, type: 'lowpass' });
    const machineGain = new Tone.Gain(0);
    machineGain.gain.setValueAtTime(0, now);
    machineGain.gain.linearRampToValueAtTime(0.1, now + 0.5);
    machineGain.gain.setValueAtTime(0.1, now + 1.5);
    machineGain.gain.linearRampToValueAtTime(0, now + 2.5);

    machine.connect(machineFilter);
    machineFilter.connect(machineGain);
    machineGain.connect(destination);

    machine.start(now);
    machine.stop(now + 3);

    setTimeout(() => {
      machine.dispose();
      machineFilter.dispose();
      machineGain.dispose();
    }, 3500);
  }

  // ============================================================================
  // SURFACE AMBIENT - Wind + alien atmosphere
  // ============================================================================

  private createSurfaceAmbient(): void {
    const layerGain = new Tone.Gain(0.4);
    layerGain.connect(this.masterFilter);

    const layer: AmbientLayer = {
      id: 'surface',
      nodes: [],
      loops: [],
      intervals: [],
      gain: layerGain,
    };

    // === Wind (brown noise with filter LFO) ===
    const wind = new Tone.Noise({ type: 'brown' });
    const windFilter = new Tone.Filter({ frequency: 600, type: 'bandpass', Q: 2 });
    const windLfo = new Tone.LFO({ frequency: 0.1, min: 300, max: 900 });
    windLfo.connect(windFilter.frequency);
    const windGain = new Tone.Gain(0.3);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(layerGain);
    wind.start();
    windLfo.start();
    layer.nodes.push(wind, windFilter, windLfo, windGain);

    // === Higher whistle layer ===
    const whistle = new Tone.Noise({ type: 'white' });
    const whistleFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 8 });
    const whistleLfo = new Tone.LFO({ frequency: 0.15, min: 1500, max: 2500 });
    whistleLfo.connect(whistleFilter.frequency);
    const whistleGain = new Tone.Gain(0.1);
    whistle.connect(whistleFilter);
    whistleFilter.connect(whistleGain);
    whistleGain.connect(layerGain);
    whistle.start();
    whistleLfo.start();
    layer.nodes.push(whistle, whistleFilter, whistleLfo, whistleGain);

    // === Alien atmosphere (low drone) ===
    const drone = new Tone.Oscillator({ frequency: 45, type: 'sawtooth' });
    const droneFilter = new Tone.Filter({ frequency: 80, type: 'lowpass' });
    const droneGain = new Tone.Gain(0.15);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(layerGain);
    drone.start();
    layer.nodes.push(drone, droneFilter, droneGain);

    // === Wind gusts ===
    const gustInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'surface') return;
      if (Math.random() < 0.3) {
        this.playWindGust(layerGain);
      }
    }, 4000);
    layer.intervals.push(gustInterval);

    this.layers.set('surface', layer);
  }

  private playWindGust(destination: Tone.Gain): void {
    const now = Tone.now();
    const gust = new Tone.Noise({ type: 'brown' });
    const gustFilter = new Tone.Filter({ frequency: 400, type: 'lowpass' });
    gustFilter.frequency.setValueAtTime(400, now);
    gustFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
    gustFilter.frequency.exponentialRampToValueAtTime(400, now + 2);

    const gustGain = new Tone.Gain(0);
    gustGain.gain.setValueAtTime(0, now);
    gustGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    gustGain.gain.setValueAtTime(0.25, now + 1);
    gustGain.gain.linearRampToValueAtTime(0, now + 2.5);

    gust.connect(gustFilter);
    gustFilter.connect(gustGain);
    gustGain.connect(destination);

    gust.start(now);
    gust.stop(now + 3);

    setTimeout(() => {
      gust.dispose();
      gustFilter.dispose();
      gustGain.dispose();
    }, 3500);
  }

  // ============================================================================
  // HIVE AMBIENT - Organic pulses + dripping + distant screeches
  // ============================================================================

  private createHiveAmbient(): void {
    const layerGain = new Tone.Gain(0.35);
    layerGain.connect(this.masterFilter);

    const layer: AmbientLayer = {
      id: 'hive',
      nodes: [],
      loops: [],
      intervals: [],
      gain: layerGain,
    };

    // === Organic pulsing (heartbeat-like) ===
    const pulse = new Tone.Oscillator({ frequency: 30, type: 'sine' });
    const pulseLfo = new Tone.LFO({ frequency: 0.5, min: 0, max: 0.2 });
    const pulseGain = new Tone.Gain(0);
    pulseLfo.connect(pulseGain.gain);
    pulse.connect(pulseGain);
    pulseGain.connect(layerGain);
    pulse.start();
    pulseLfo.start();
    layer.nodes.push(pulse, pulseLfo, pulseGain);

    // === Sub bass rumble ===
    const subBass = new Tone.Oscillator({ frequency: 25, type: 'sine' });
    const subGain = new Tone.Gain(0.15);
    subBass.connect(subGain);
    subGain.connect(layerGain);
    subBass.start();
    layer.nodes.push(subBass, subGain);

    // === Wet/organic ambient noise ===
    const organic = new Tone.Noise({ type: 'pink' });
    const organicFilter = new Tone.Filter({ frequency: 300, type: 'lowpass', Q: 2 });
    const organicGain = new Tone.Gain(0.1);
    organic.connect(organicFilter);
    organicFilter.connect(organicGain);
    organicGain.connect(layerGain);
    organic.start();
    layer.nodes.push(organic, organicFilter, organicGain);

    // === Dripping sounds ===
    const dripInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.4) {
        this.playDrip(layerGain);
      }
    }, 2000);
    layer.intervals.push(dripInterval);

    // === Distant screeches ===
    const screechInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.15) {
        this.playDistantScreech(layerGain);
      }
    }, 6000);
    layer.intervals.push(screechInterval);

    // === Chittering ===
    const chitterInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'hive') return;
      if (Math.random() < 0.2) {
        this.playDistantChittering(layerGain);
      }
    }, 4000);
    layer.intervals.push(chitterInterval);

    this.layers.set('hive', layer);
  }

  private playDrip(destination: Tone.Gain): void {
    const now = Tone.now();
    const drip = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    });
    drip.volume.value = -20 + Math.random() * 6;
    drip.connect(destination);

    const freq = 800 + Math.random() * 400;
    drip.triggerAttackRelease(freq, '32n', now);

    // Optional second drip
    if (Math.random() < 0.5) {
      drip.triggerAttackRelease(freq * 0.9, '32n', now + 0.1);
    }

    setTimeout(() => drip.dispose(), 300);
  }

  private playDistantScreech(destination: Tone.Gain): void {
    const now = Tone.now();
    const screech = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.4 },
    });
    screech.volume.value = -24;

    const screechFilter = new Tone.Filter({ frequency: 600, type: 'bandpass', Q: 3 });
    const screechLfo = new Tone.LFO({ frequency: 20, min: 300, max: 500 });
    screechLfo.connect(screech.frequency);

    screech.connect(screechFilter);
    screechFilter.connect(destination);

    screechLfo.start(now);
    screech.triggerAttackRelease(400, '4n', now);

    setTimeout(() => {
      screech.dispose();
      screechFilter.dispose();
      screechLfo.dispose();
    }, 1000);
  }

  private playDistantChittering(destination: Tone.Gain): void {
    const now = Tone.now();
    const clickCount = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < clickCount; i++) {
      const clickTime = now + i * 0.04 + Math.random() * 0.02;
      const click = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
      });
      click.volume.value = -28 + Math.random() * 4;
      click.connect(destination);
      click.triggerAttackRelease(500 + Math.random() * 300, '64n', clickTime);
      setTimeout(() => click.dispose(), 200);
    }
  }

  // ============================================================================
  // ICE AMBIENT - Howling wind + cracking + crystalline shimmer
  // ============================================================================

  private createIceAmbient(): void {
    const layerGain = new Tone.Gain(0.4);
    layerGain.connect(this.masterFilter);

    const layer: AmbientLayer = {
      id: 'ice',
      nodes: [],
      loops: [],
      intervals: [],
      gain: layerGain,
    };

    // === Howling wind (higher pitched than surface) ===
    const wind = new Tone.Noise({ type: 'brown' });
    const windFilter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 4 });
    const windLfo = new Tone.LFO({ frequency: 0.08, min: 500, max: 1200 });
    windLfo.connect(windFilter.frequency);
    const windGain = new Tone.Gain(0.35);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(layerGain);
    wind.start();
    windLfo.start();
    layer.nodes.push(wind, windFilter, windLfo, windGain);

    // === High whistle (ice wind) ===
    const whistle = new Tone.Noise({ type: 'white' });
    const whistleFilter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 10 });
    const whistleLfo = new Tone.LFO({ frequency: 0.12, min: 2500, max: 4000 });
    whistleLfo.connect(whistleFilter.frequency);
    const whistleGain = new Tone.Gain(0.12);
    whistle.connect(whistleFilter);
    whistleFilter.connect(whistleGain);
    whistleGain.connect(layerGain);
    whistle.start();
    whistleLfo.start();
    layer.nodes.push(whistle, whistleFilter, whistleLfo, whistleGain);

    // === Deep ice groan ===
    const groan = new Tone.Oscillator({ frequency: 45, type: 'sawtooth' });
    const groanFilter = new Tone.Filter({ frequency: 100, type: 'lowpass' });
    const groanGain = new Tone.Gain(0.12);
    groan.connect(groanFilter);
    groanFilter.connect(groanGain);
    groanGain.connect(layerGain);
    groan.start();
    layer.nodes.push(groan, groanFilter, groanGain);

    // === Ice cracking ===
    const crackInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'ice') return;
      if (Math.random() < 0.25) {
        this.playIceCrack(layerGain);
      }
    }, 4000);
    layer.intervals.push(crackInterval);

    // === Crystalline shimmer ===
    const shimmerInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'ice') return;
      if (Math.random() < 0.2) {
        this.playIceShimmer(layerGain);
      }
    }, 6000);
    layer.intervals.push(shimmerInterval);

    // === Deep groans ===
    const groanInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'ice') return;
      if (Math.random() < 0.15) {
        this.playIceGroan(layerGain);
      }
    }, 8000);
    layer.intervals.push(groanInterval);

    this.layers.set('ice', layer);
  }

  private playIceCrack(destination: Tone.Gain): void {
    const now = Tone.now();

    // Sharp crack
    const crack = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    });
    crack.volume.value = -16 + Math.random() * 4;
    crack.connect(destination);
    crack.triggerAttackRelease(2500 + Math.random() * 1500, '64n', now);

    // Secondary crack
    const crack2 = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    });
    crack2.volume.value = -18;
    crack2.connect(destination);
    crack2.triggerAttackRelease(1500 + Math.random() * 800, '64n', now + 0.02);

    // Low rumble
    const rumble = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.02, release: 0.1 },
    });
    rumble.volume.value = -20;
    rumble.connect(destination);
    rumble.triggerAttackRelease(60, '16n', now + 0.03);

    setTimeout(() => {
      crack.dispose();
      crack2.dispose();
      rumble.dispose();
    }, 400);
  }

  private playIceShimmer(destination: Tone.Gain): void {
    const now = Tone.now();
    const freqs = [2400, 3200, 4000].map((f) => f + Math.random() * 600);

    freqs.forEach((freq, i) => {
      const shimmer = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.2 },
      });
      shimmer.volume.value = -26;
      shimmer.connect(destination);
      shimmer.triggerAttackRelease(freq, '8n', now + i * 0.08);
      setTimeout(() => shimmer.dispose(), 600);
    });
  }

  private playIceGroan(destination: Tone.Gain): void {
    const now = Tone.now();
    const groan = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.3, decay: 0.5, sustain: 0.3, release: 0.5 },
    });
    groan.volume.value = -22;

    const groanFilter = new Tone.Filter({ frequency: 120, type: 'bandpass', Q: 4 });
    const groanLfo = new Tone.LFO({ frequency: 2, min: 50, max: 70 });
    groanLfo.connect(groan.frequency);

    groan.connect(groanFilter);
    groanFilter.connect(destination);

    groanLfo.start(now);
    groan.triggerAttackRelease(55, '1n', now);

    setTimeout(() => {
      groan.dispose();
      groanFilter.dispose();
      groanLfo.dispose();
    }, 2000);
  }

  // ============================================================================
  // MINING AMBIENT - Rumbles + dripping + echoes
  // ============================================================================

  private createMiningAmbient(): void {
    const layerGain = new Tone.Gain(0.35);
    layerGain.connect(this.masterFilter);

    const layer: AmbientLayer = {
      id: 'mining',
      nodes: [],
      loops: [],
      intervals: [],
      gain: layerGain,
    };

    // === Deep industrial rumble ===
    const rumble1 = new Tone.Oscillator({ frequency: 50, type: 'sawtooth' });
    const rumble2 = new Tone.Oscillator({ frequency: 52, type: 'sawtooth' });
    const rumbleFilter = new Tone.Filter({ frequency: 120, type: 'lowpass' });
    const rumbleGain = new Tone.Gain(0.15);
    rumble1.connect(rumbleFilter);
    rumble2.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(layerGain);
    rumble1.start();
    rumble2.start();
    layer.nodes.push(rumble1, rumble2, rumbleFilter, rumbleGain);

    // === Ambient cave noise ===
    const cave = new Tone.Noise({ type: 'brown' });
    const caveFilter = new Tone.Filter({ frequency: 200, type: 'lowpass' });
    const caveGain = new Tone.Gain(0.1);
    cave.connect(caveFilter);
    caveFilter.connect(caveGain);
    caveGain.connect(layerGain);
    cave.start();
    layer.nodes.push(cave, caveFilter, caveGain);

    // === Dripping (echo effect) ===
    const dripInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'mining') return;
      if (Math.random() < 0.35) {
        this.playMiningDrip(layerGain);
      }
    }, 2500);
    layer.intervals.push(dripInterval);

    // === Distant mining sounds ===
    const miningInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'mining') return;
      if (Math.random() < 0.2) {
        this.playDistantMining(layerGain);
      }
    }, 5000);
    layer.intervals.push(miningInterval);

    // === Rock settling ===
    const settleInterval = setInterval(() => {
      if (!this.isPlaying || this.currentEnvironment !== 'mining') return;
      if (Math.random() < 0.15) {
        this.playRockSettle(layerGain);
      }
    }, 7000);
    layer.intervals.push(settleInterval);

    this.layers.set('mining', layer);
  }

  private playMiningDrip(destination: Tone.Gain): void {
    const now = Tone.now();

    const drip = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
    });
    drip.volume.value = -18;

    // Add echo/reverb
    const dripReverb = new Tone.Reverb({ decay: 2, wet: 0.6 });
    drip.connect(dripReverb);
    dripReverb.connect(destination);

    const freq = 600 + Math.random() * 400;
    drip.triggerAttackRelease(freq, '32n', now);

    // Echo drips
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        drip.volume.value = -18 - i * 6;
        drip.triggerAttackRelease(freq * (1 - i * 0.02), '32n');
      }, i * 200);
    }

    setTimeout(() => {
      drip.dispose();
      dripReverb.dispose();
    }, 1500);
  }

  private playDistantMining(destination: Tone.Gain): void {
    const now = Tone.now();

    // Impact sound
    const impact = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.02, release: 0.15 },
    });
    impact.volume.value = -22;
    impact.connect(destination);
    impact.triggerAttackRelease(80, '16n', now);

    // Metallic ring
    const ring = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
      harmonicity: 6,
      modulationIndex: 15,
      resonance: 1500,
      octaves: 1,
    });
    ring.volume.value = -26;
    ring.connect(destination);
    ring.triggerAttackRelease('16n', now + 0.02);

    setTimeout(() => {
      impact.dispose();
      ring.dispose();
    }, 500);
  }

  private playRockSettle(destination: Tone.Gain): void {
    const now = Tone.now();

    const settle = new Tone.Noise({ type: 'brown' });
    const settleFilter = new Tone.Filter({ frequency: 300, type: 'lowpass' });
    settleFilter.frequency.setValueAtTime(300, now);
    settleFilter.frequency.exponentialRampToValueAtTime(100, now + 0.5);

    const settleGain = new Tone.Gain(0);
    settleGain.gain.setValueAtTime(0, now);
    settleGain.gain.linearRampToValueAtTime(0.12, now + 0.1);
    settleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    settle.connect(settleFilter);
    settleFilter.connect(settleGain);
    settleGain.connect(destination);

    settle.start(now);
    settle.stop(now + 1);

    setTimeout(() => {
      settle.dispose();
      settleFilter.dispose();
      settleGain.dispose();
    }, 1200);
  }

  // ============================================================================
  // LAYER MANAGEMENT
  // ============================================================================

  private disposeAllLayers(): void {
    for (const layer of this.layers.values()) {
      // Clear intervals
      for (const interval of layer.intervals) {
        clearInterval(interval);
      }

      // Stop and dispose loops
      for (const loop of layer.loops) {
        loop.stop();
        loop.dispose();
      }

      // Dispose nodes
      for (const node of layer.nodes) {
        try {
          node.dispose();
        } catch {
          // Already disposed
        }
      }

      // Dispose gain
      layer.gain.dispose();
    }

    this.layers.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let ambientSoundscapesInstance: AmbientSoundscapes | null = null;

export function getAmbientSoundscapes(): AmbientSoundscapes {
  if (!ambientSoundscapesInstance) {
    ambientSoundscapesInstance = new AmbientSoundscapes();
  }
  return ambientSoundscapesInstance;
}

export function disposeAmbientSoundscapes(): void {
  if (ambientSoundscapesInstance) {
    ambientSoundscapesInstance.dispose();
    ambientSoundscapesInstance = null;
  }
}
