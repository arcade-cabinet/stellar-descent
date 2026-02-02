/**
 * LowHealthFeedback - Comprehensive low health player feedback system
 *
 * Provides multi-sensory feedback when player health is critically low:
 *
 * When health < 25%:
 * - Red vignette around screen edges (pulsing)
 * - Slight desaturation
 * - Pulse effect synced to heartbeat
 * - Heartbeat sound loop
 * - Breathing sounds
 *
 * When health < 10%:
 * - More intense vignette
 * - Screen shake on movement
 * - Tunnel vision effect
 *
 * Integrates with PostProcessManager for visuals and AudioManager for sound.
 */

import { getLogger } from '../core/Logger';

const log = getLogger('LowHealthFeedback');

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

/**
 * Configuration for low health feedback effects
 */
export interface LowHealthFeedbackConfig {
  /** Health threshold for low health effects (default: 25) */
  lowHealthThreshold: number;
  /** Health threshold for critical health effects (default: 10) */
  criticalHealthThreshold: number;
  /** Base heartbeat rate in BPM (increases as health drops) */
  baseHeartbeatBPM: number;
  /** Maximum heartbeat rate in BPM at critical health */
  maxHeartbeatBPM: number;
  /** Enable visual effects */
  enableVisualEffects: boolean;
  /** Enable audio effects */
  enableAudioEffects: boolean;
  /** Enable screen shake at critical health */
  enableCriticalShake: boolean;
  /** Vignette intensity multiplier */
  vignetteIntensity: number;
  /** Desaturation intensity multiplier */
  desaturationIntensity: number;
  /** Heartbeat volume (0-1) */
  heartbeatVolume: number;
  /** Breathing volume (0-1) */
  breathingVolume: number;
}

const DEFAULT_CONFIG: LowHealthFeedbackConfig = {
  lowHealthThreshold: 25,
  criticalHealthThreshold: 10,
  baseHeartbeatBPM: 80,
  maxHeartbeatBPM: 140,
  enableVisualEffects: true,
  enableAudioEffects: true,
  enableCriticalShake: true,
  vignetteIntensity: 1.0,
  desaturationIntensity: 1.0,
  heartbeatVolume: 0.5,
  breathingVolume: 0.3,
};

/**
 * State tracking for low health effects
 */
interface LowHealthState {
  /** Current health value */
  currentHealth: number;
  /** Maximum health value */
  maxHealth: number;
  /** Whether low health effects are active */
  isLowHealth: boolean;
  /** Whether critical health effects are active */
  isCriticalHealth: boolean;
  /** Current pulse phase (0-1, for heartbeat sync) */
  pulsePhase: number;
  /** Time of last update */
  lastUpdateTime: number;
  /** Whether player is moving (for critical shake) */
  isPlayerMoving: boolean;
}

/**
 * Audio handles for looping sounds
 */
interface AudioLoopHandle {
  stop: () => void;
  setVolume?: (volume: number) => void;
}

// ============================================================================
// LOW HEALTH FEEDBACK MANAGER
// ============================================================================

/**
 * Singleton manager for low health feedback effects
 */
export class LowHealthFeedbackManager {
  private static instance: LowHealthFeedbackManager | null = null;

  private config: LowHealthFeedbackConfig = { ...DEFAULT_CONFIG };
  private state: LowHealthState = {
    currentHealth: 100,
    maxHealth: 100,
    isLowHealth: false,
    isCriticalHealth: false,
    pulsePhase: 0,
    lastUpdateTime: 0,
    isPlayerMoving: false,
  };

  // Audio context and nodes
  private audioContext: AudioContext | null = null;
  private heartbeatLoop: AudioLoopHandle | null = null;
  private breathingLoop: AudioLoopHandle | null = null;
  private masterGain: GainNode | null = null;

  // Callbacks for external integration
  private vignetteCallback: ((weight: number, r: number, g: number, b: number) => void) | null =
    null;
  private desaturationCallback: ((amount: number) => void) | null = null;
  private screenShakeCallback: ((intensity: number) => void) | null = null;
  private tunnelVisionCallback: ((amount: number) => void) | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): LowHealthFeedbackManager {
    if (!LowHealthFeedbackManager.instance) {
      LowHealthFeedbackManager.instance = new LowHealthFeedbackManager();
    }
    return LowHealthFeedbackManager.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the low health feedback system
   */
  init(config?: Partial<LowHealthFeedbackConfig>): void {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
    this.initAudioContext();
    log.info('Initialized');
  }

  /**
   * Initialize the Web Audio context for procedural sounds
   */
  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 1.0;
    } catch (e) {
      log.warn('Failed to initialize audio context:', e);
    }
  }

  /**
   * Set callback for vignette effect control
   */
  setVignetteCallback(callback: (weight: number, r: number, g: number, b: number) => void): void {
    this.vignetteCallback = callback;
  }

  /**
   * Set callback for desaturation effect control
   */
  setDesaturationCallback(callback: (amount: number) => void): void {
    this.desaturationCallback = callback;
  }

  /**
   * Set callback for screen shake effect
   */
  setScreenShakeCallback(callback: (intensity: number) => void): void {
    this.screenShakeCallback = callback;
  }

  /**
   * Set callback for tunnel vision effect (at critical health)
   */
  setTunnelVisionCallback(callback: (amount: number) => void): void {
    this.tunnelVisionCallback = callback;
  }

  /**
   * Configure the feedback system
   */
  configure(config: Partial<LowHealthFeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // HEALTH STATE MANAGEMENT
  // ============================================================================

  /**
   * Start low health effects based on current health
   * @param health - Current player health
   * @param maxHealth - Maximum player health (default: 100)
   */
  startLowHealthEffects(health: number, maxHealth: number = 100): void {
    this.state.currentHealth = health;
    this.state.maxHealth = maxHealth;

    const healthPercent = (health / maxHealth) * 100;
    const wasLowHealth = this.state.isLowHealth;
    const wasCritical = this.state.isCriticalHealth;

    this.state.isLowHealth = healthPercent < this.config.lowHealthThreshold && health > 0;
    this.state.isCriticalHealth = healthPercent < this.config.criticalHealthThreshold && health > 0;

    // Start effects if entering low health state
    if (this.state.isLowHealth && !wasLowHealth) {
      this.startAudioEffects();
      log.info('Low health effects started');
    }

    // Intensify effects if entering critical state
    if (this.state.isCriticalHealth && !wasCritical) {
      this.intensifyCriticalEffects();
      log.info('Critical health effects activated');
    }

    // Stop effects if recovering
    if (!this.state.isLowHealth && wasLowHealth) {
      this.stopLowHealthEffects();
    }
  }

  /**
   * Stop all low health effects
   */
  stopLowHealthEffects(): void {
    this.state.isLowHealth = false;
    this.state.isCriticalHealth = false;
    this.state.pulsePhase = 0;

    this.stopAudioEffects();
    this.resetVisualEffects();

    log.info('Low health effects stopped');
  }

  /**
   * Set whether the player is currently moving (for critical shake)
   */
  setPlayerMoving(isMoving: boolean): void {
    this.state.isPlayerMoving = isMoving;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update low health effects - call this every frame
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.state.isLowHealth) return;

    const now = performance.now();
    this.state.lastUpdateTime = now;

    // Calculate health severity (0 = at threshold, 1 = at 0 health)
    const healthPercent = (this.state.currentHealth / this.state.maxHealth) * 100;
    const severity = 1 - healthPercent / this.config.lowHealthThreshold;
    const clampedSeverity = Math.max(0, Math.min(1, severity));

    // Update pulse phase based on heartbeat rate
    const heartbeatBPM = this.calculateHeartbeatBPM(clampedSeverity);
    const beatDuration = 60 / heartbeatBPM; // seconds per beat
    this.state.pulsePhase = (this.state.pulsePhase + deltaTime / beatDuration) % 1;

    // Update visual effects
    if (this.config.enableVisualEffects) {
      this.updateVisualEffects(clampedSeverity);
    }

    // Update screen shake at critical health when moving
    if (
      this.config.enableCriticalShake &&
      this.state.isCriticalHealth &&
      this.state.isPlayerMoving
    ) {
      this.applyCriticalShake(clampedSeverity);
    }
  }

  // ============================================================================
  // VISUAL EFFECTS
  // ============================================================================

  /**
   * Update visual effects based on severity
   */
  private updateVisualEffects(severity: number): void {
    // Calculate pulse value (0-1, peaks at heartbeat)
    // Use a smooth heartbeat curve: double peak per beat
    const pulseRaw = this.calculateHeartbeatPulse(this.state.pulsePhase);

    // Vignette effect - red tint pulsing with heartbeat
    if (this.vignetteCallback) {
      // Base vignette weight increases with severity
      const baseWeight = 0.3 + severity * 0.4 * this.config.vignetteIntensity;
      // Pulse adds additional weight
      const pulseWeight = pulseRaw * 0.2 * severity * this.config.vignetteIntensity;
      const totalWeight = baseWeight + pulseWeight;

      // More intense red at critical health
      const redIntensity = this.state.isCriticalHealth ? 0.8 : 0.6;
      this.vignetteCallback(totalWeight, redIntensity, 0.1, 0.1);
    }

    // Desaturation effect - world becomes grayer as health drops
    if (this.desaturationCallback) {
      const desatAmount = severity * 0.3 * this.config.desaturationIntensity;
      this.desaturationCallback(desatAmount);
    }

    // Tunnel vision at critical health
    if (this.tunnelVisionCallback && this.state.isCriticalHealth) {
      // Critical severity (0 = at critical threshold, 1 = at 0 health)
      const criticalSeverity =
        1 -
        ((this.state.currentHealth / this.state.maxHealth) * 100) /
          this.config.criticalHealthThreshold;
      const tunnelAmount = Math.max(0, Math.min(1, criticalSeverity)) * 0.4;
      this.tunnelVisionCallback(tunnelAmount);
    }
  }

  /**
   * Calculate heartbeat pulse curve (double bump like real heartbeat)
   * @param phase - 0-1 phase through the beat
   * @returns 0-1 pulse intensity
   */
  private calculateHeartbeatPulse(phase: number): number {
    // Create a double-bump heartbeat pattern (lub-dub)
    // First bump at 0-0.15, second bump at 0.2-0.35
    if (phase < 0.15) {
      // First beat (lub) - sharp rise
      return Math.sin((phase / 0.15) * Math.PI);
    } else if (phase < 0.2) {
      // Between beats
      return 0;
    } else if (phase < 0.35) {
      // Second beat (dub) - smaller
      return Math.sin(((phase - 0.2) / 0.15) * Math.PI) * 0.6;
    } else {
      // Rest of cycle
      return 0;
    }
  }

  /**
   * Calculate heartbeat BPM based on severity
   */
  private calculateHeartbeatBPM(severity: number): number {
    const bpmRange = this.config.maxHeartbeatBPM - this.config.baseHeartbeatBPM;
    return this.config.baseHeartbeatBPM + bpmRange * severity;
  }

  /**
   * Reset visual effects to normal
   */
  private resetVisualEffects(): void {
    // Reset vignette
    if (this.vignetteCallback) {
      this.vignetteCallback(0.3, 0.1, 0.1, 0.1); // Back to default
    }

    // Reset desaturation
    if (this.desaturationCallback) {
      this.desaturationCallback(0);
    }

    // Reset tunnel vision
    if (this.tunnelVisionCallback) {
      this.tunnelVisionCallback(0);
    }
  }

  // ============================================================================
  // SCREEN SHAKE
  // ============================================================================

  /**
   * Apply screen shake at critical health when moving
   */
  private applyCriticalShake(severity: number): void {
    if (!this.screenShakeCallback) return;

    // Random micro-shakes when moving at critical health
    // Intensity based on severity and randomness
    if (Math.random() < 0.15) {
      // 15% chance each frame
      const shakeIntensity = 0.5 + severity * 1.5;
      this.screenShakeCallback(shakeIntensity);
    }
  }

  // ============================================================================
  // AUDIO EFFECTS
  // ============================================================================

  /**
   * Start audio effects for low health
   */
  private startAudioEffects(): void {
    if (!this.config.enableAudioEffects || !this.audioContext) return;

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.startHeartbeatLoop();
    this.startBreathingLoop();
  }

  /**
   * Stop all audio effects
   */
  private stopAudioEffects(): void {
    if (this.heartbeatLoop) {
      this.heartbeatLoop.stop();
      this.heartbeatLoop = null;
    }
    if (this.breathingLoop) {
      this.breathingLoop.stop();
      this.breathingLoop = null;
    }
  }

  /**
   * Intensify effects when entering critical state
   */
  private intensifyCriticalEffects(): void {
    // Audio will be updated in the update loop based on severity
    // This is called when first entering critical state
  }

  /**
   * Start the heartbeat sound loop
   */
  private startHeartbeatLoop(): void {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;

    // Create a scheduled heartbeat that updates based on BPM
    let isRunning = true;
    let currentBPM = this.config.baseHeartbeatBPM;
    let nextBeatTime = ctx.currentTime;

    const scheduleBeat = () => {
      if (!isRunning || !this.audioContext) return;

      const now = this.audioContext.currentTime;

      // Schedule beats ahead of time
      while (nextBeatTime < now + 0.1) {
        this.playHeartbeatSound(nextBeatTime);
        nextBeatTime += 60 / currentBPM;
      }

      // Update BPM based on current health severity
      const healthPercent = (this.state.currentHealth / this.state.maxHealth) * 100;
      const severity = Math.max(0, Math.min(1, 1 - healthPercent / this.config.lowHealthThreshold));
      currentBPM = this.calculateHeartbeatBPM(severity);

      // Schedule next check
      setTimeout(scheduleBeat, 50);
    };

    scheduleBeat();

    this.heartbeatLoop = {
      stop: () => {
        isRunning = false;
      },
    };
  }

  /**
   * Play a single heartbeat sound (lub-dub)
   */
  private playHeartbeatSound(startTime: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const volume = this.config.heartbeatVolume;

    // LUB sound (first beat - deeper, louder)
    const lubOsc = ctx.createOscillator();
    lubOsc.type = 'sine';
    lubOsc.frequency.setValueAtTime(60, startTime);
    lubOsc.frequency.exponentialRampToValueAtTime(40, startTime + 0.08);

    const lubGain = ctx.createGain();
    lubGain.gain.setValueAtTime(0, startTime);
    lubGain.gain.linearRampToValueAtTime(volume * 0.8, startTime + 0.02);
    lubGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    // Low-pass filter for thump
    const lubFilter = ctx.createBiquadFilter();
    lubFilter.type = 'lowpass';
    lubFilter.frequency.value = 100;
    lubFilter.Q.value = 1;

    lubOsc.connect(lubFilter);
    lubFilter.connect(lubGain);
    lubGain.connect(this.masterGain);

    lubOsc.start(startTime);
    lubOsc.stop(startTime + 0.15);

    // DUB sound (second beat - higher, quieter)
    const dubTime = startTime + 0.15;
    const dubOsc = ctx.createOscillator();
    dubOsc.type = 'sine';
    dubOsc.frequency.setValueAtTime(80, dubTime);
    dubOsc.frequency.exponentialRampToValueAtTime(50, dubTime + 0.06);

    const dubGain = ctx.createGain();
    dubGain.gain.setValueAtTime(0, dubTime);
    dubGain.gain.linearRampToValueAtTime(volume * 0.5, dubTime + 0.015);
    dubGain.gain.exponentialRampToValueAtTime(0.01, dubTime + 0.1);

    const dubFilter = ctx.createBiquadFilter();
    dubFilter.type = 'lowpass';
    dubFilter.frequency.value = 120;
    dubFilter.Q.value = 1;

    dubOsc.connect(dubFilter);
    dubFilter.connect(dubGain);
    dubGain.connect(this.masterGain);

    dubOsc.start(dubTime);
    dubOsc.stop(dubTime + 0.1);
  }

  /**
   * Start the breathing sound loop
   */
  private startBreathingLoop(): void {
    if (!this.audioContext || !this.masterGain) return;

    const _ctx = this.audioContext;
    let isRunning = true;

    // Create continuous breathing using filtered noise
    const breathCycle = () => {
      if (!isRunning || !this.audioContext) return;

      const now = this.audioContext.currentTime;

      // Calculate breath rate based on severity (faster when more critical)
      const healthPercent = (this.state.currentHealth / this.state.maxHealth) * 100;
      const severity = Math.max(0, Math.min(1, 1 - healthPercent / this.config.lowHealthThreshold));

      // Breath cycle: 2-4 seconds based on severity (faster when critical)
      const breathDuration = 4 - severity * 2;

      this.playBreathSound(now, breathDuration / 2, true); // Inhale
      this.playBreathSound(now + breathDuration / 2, breathDuration / 2, false); // Exhale

      // Schedule next breath
      setTimeout(breathCycle, breathDuration * 1000);
    };

    // Start first breath after short delay
    setTimeout(breathCycle, 500);

    this.breathingLoop = {
      stop: () => {
        isRunning = false;
      },
    };
  }

  /**
   * Play a single breath sound (inhale or exhale)
   */
  private playBreathSound(startTime: number, duration: number, isInhale: boolean): void {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const volume = this.config.breathingVolume;

    // Create noise buffer for breath
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    // Pink noise for breath
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      noiseData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for breath character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Inhale is slightly higher pitched
    filter.frequency.value = isInhale ? 600 : 400;
    filter.Q.value = 2;

    // Envelope for breath shape
    const gain = ctx.createGain();
    if (isInhale) {
      // Inhale: gradual rise
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + duration * 0.4);
      gain.gain.linearRampToValueAtTime(volume * 0.8, startTime + duration * 0.8);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
    } else {
      // Exhale: quick start, gradual fade
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.7, startTime + duration * 0.1);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + duration * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Set master volume for all low health audio
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Mute all low health audio
   */
  mute(): void {
    this.setMasterVolume(0);
  }

  /**
   * Unmute low health audio
   */
  unmute(): void {
    this.setMasterVolume(1);
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.stopLowHealthEffects();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.masterGain = null;

    this.vignetteCallback = null;
    this.desaturationCallback = null;
    this.screenShakeCallback = null;
    this.tunnelVisionCallback = null;

    LowHealthFeedbackManager.instance = null;

    log.info('Disposed');
  }
}

// ============================================================================
// SINGLETON EXPORTS
// ============================================================================

/**
 * Get the singleton low health feedback manager instance
 */
export function getLowHealthFeedback(): LowHealthFeedbackManager {
  return LowHealthFeedbackManager.getInstance();
}

/**
 * Singleton accessor for convenience
 */
export const lowHealthFeedback = LowHealthFeedbackManager.getInstance();

/**
 * Dispose the low health feedback system
 */
export function disposeLowHealthFeedback(): void {
  LowHealthFeedbackManager.getInstance().dispose();
}
