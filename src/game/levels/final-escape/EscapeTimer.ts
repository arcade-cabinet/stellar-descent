/**
 * EscapeTimer - Escape Countdown System
 *
 * Manages the 4-minute countdown for the Final Escape level.
 *
 * Features:
 * - 4-minute countdown with visual urgency
 * - Music tempo increases as timer decreases
 * - Screen effects intensify (shake, color shift)
 * - Checkpoint system (reaching sections adds time)
 * - Death/respawn costs time penalty
 * - Integration with HUD for timer display
 *
 * Timer stages:
 * - NORMAL (>120s):  Standard pace, green timer
 * - WARNING (60-120s): Orange timer, slight screen tint
 * - CRITICAL (<60s):  Red pulsing timer, intense screen shake, heartbeat
 * - FINAL (<20s):     Rapid pulse, maximum urgency, alarm klaxon
 */

import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../../core/AudioManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('EscapeTimer');

// ============================================================================
// TYPES
// ============================================================================

export type TimerUrgency = 'normal' | 'warning' | 'critical' | 'final';

export interface EscapeTimerConfig {
  /** Total time in seconds (default: 240 = 4 minutes) */
  totalTime: number;
  /** Time bonus for reaching a checkpoint in seconds */
  checkpointBonus: number;
  /** Time penalty for death/respawn in seconds */
  deathPenalty: number;
  /** Threshold for 'warning' urgency in seconds */
  warningThreshold: number;
  /** Threshold for 'critical' urgency in seconds */
  criticalThreshold: number;
  /** Threshold for 'final' urgency in seconds */
  finalThreshold: number;
}

export interface TimerState {
  /** Current remaining time in seconds */
  remaining: number;
  /** Total elapsed time in seconds */
  elapsed: number;
  /** Current urgency level */
  urgency: TimerUrgency;
  /** Whether the timer has expired */
  expired: boolean;
  /** Whether the timer is paused (cutscenes, transitions) */
  paused: boolean;
  /** Formatted time string (e.g., "3:42") */
  displayTime: string;
  /** Progress 0-1 (1 = full time remaining, 0 = expired) */
  progress: number;
  /** Number of checkpoints reached */
  checkpointsReached: number;
  /** Number of deaths */
  deaths: number;
  /** Pulse intensity for UI effects (0-1, oscillates faster at lower time) */
  pulseIntensity: number;
  /** Camera shake intensity recommendation based on urgency */
  shakeIntensity: number;
  /** Color shift intensity for post-processing (0-1) */
  colorShiftIntensity: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: EscapeTimerConfig = {
  totalTime: 240, // 4 minutes
  checkpointBonus: 15, // +15 seconds per checkpoint
  deathPenalty: 10, // -10 seconds per death
  warningThreshold: 120, // 2 minutes
  criticalThreshold: 60, // 1 minute
  finalThreshold: 20, // 20 seconds
};

/** Base shake intensities per urgency level */
const SHAKE_INTENSITIES: Record<TimerUrgency, number> = {
  normal: 0.5,
  warning: 1.0,
  critical: 2.0,
  final: 3.5,
};

/** Pulse speed multipliers per urgency level (Hz) */
const PULSE_SPEEDS: Record<TimerUrgency, number> = {
  normal: 0.5,
  warning: 1.0,
  critical: 2.0,
  final: 4.0,
};

// ============================================================================
// ESCAPE TIMER
// ============================================================================

export class EscapeTimer {
  private config: EscapeTimerConfig;

  // Scene reference
  private scene: Scene;

  // Timer state
  private remaining: number;
  private elapsed = 0;
  private paused = false;
  private expired = false;

  // Stats
  private checkpointsReached = 0;
  private deaths = 0;

  // Internal animation state
  private pulseAccumulator = 0;
  private previousUrgency: TimerUrgency = 'normal';

  // Audio state tracking
  private warningAudioPlayed = false;
  private criticalAudioPlayed = false;
  private finalAudioPlayed = false;
  private heartbeatActive = false;

  // Callbacks
  private onExpired: (() => void) | null = null;
  private onUrgencyChange: ((urgency: TimerUrgency) => void) | null = null;
  private onCheckpoint: ((bonusTime: number, total: number) => void) | null = null;

  constructor(scene: Scene, config: Partial<EscapeTimerConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.remaining = this.config.totalTime;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Update the timer. Call every frame.
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (this.paused || this.expired) return;

    // Decrement timer
    this.remaining -= deltaTime;
    this.elapsed += deltaTime;

    // Update pulse animation
    const urgency = this.getUrgency();
    const pulseSpeed = PULSE_SPEEDS[urgency];
    this.pulseAccumulator += deltaTime * pulseSpeed * Math.PI * 2;

    // Detect urgency transitions
    if (urgency !== this.previousUrgency) {
      this.handleUrgencyTransition(urgency);
      this.previousUrgency = urgency;
    }

    // Check expiration
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.expired = true;
      this.onExpired?.();
    }
  }

  /**
   * Dispose timer resources.
   */
  dispose(): void {
    this.onExpired = null;
    this.onUrgencyChange = null;
    this.onCheckpoint = null;
  }

  // ============================================================================
  // TIMER CONTROL
  // ============================================================================

  /**
   * Pause the timer (for cutscenes, transitions, etc.)
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume the timer.
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Add a checkpoint bonus.
   * @param sectionName - Name of the section reached (for logging)
   */
  reachCheckpoint(sectionName: string): void {
    if (this.expired) return;

    this.checkpointsReached++;
    const bonus = this.config.checkpointBonus;
    this.remaining += bonus;

    // Cap at max time (cannot exceed original + all bonuses)
    const maxTime = this.config.totalTime + this.config.checkpointBonus * 4;
    this.remaining = Math.min(this.remaining, maxTime);

    log.info(
      `Checkpoint "${sectionName}" reached: +${bonus}s (${this.formatTime(this.remaining)} remaining)`
    );

    // Play checkpoint sound
    getAudioManager().play('notification');

    this.onCheckpoint?.(bonus, this.checkpointsReached);
  }

  /**
   * Apply death penalty to timer.
   */
  applyDeathPenalty(): void {
    if (this.expired) return;

    this.deaths++;
    this.remaining -= this.config.deathPenalty;

    log.info(
      `Death penalty: -${this.config.deathPenalty}s (${this.formatTime(this.remaining)} remaining)`
    );

    // Do not expire from death penalty alone - minimum 5 seconds
    if (this.remaining < 5) {
      this.remaining = 5;
    }
  }

  /**
   * Add arbitrary time (e.g., from bonus pickups).
   * @param seconds - Time to add
   */
  addTime(seconds: number): void {
    if (this.expired) return;
    this.remaining += seconds;
  }

  /**
   * Force-expire the timer (e.g., player fell into lava).
   */
  forceExpire(): void {
    this.remaining = 0;
    this.expired = true;
    this.onExpired?.();
  }

  // ============================================================================
  // EVENT CALLBACKS
  // ============================================================================

  /**
   * Set callback for when timer expires.
   */
  setOnExpired(callback: () => void): void {
    this.onExpired = callback;
  }

  /**
   * Set callback for urgency level changes.
   */
  setOnUrgencyChange(callback: (urgency: TimerUrgency) => void): void {
    this.onUrgencyChange = callback;
  }

  /**
   * Set callback for checkpoint reached.
   */
  setOnCheckpoint(callback: (bonusTime: number, total: number) => void): void {
    this.onCheckpoint = callback;
  }

  // ============================================================================
  // STATE QUERY
  // ============================================================================

  /**
   * Get the full timer state for HUD/effects integration.
   */
  getState(): TimerState {
    const urgency = this.getUrgency();
    return {
      remaining: this.remaining,
      elapsed: this.elapsed,
      urgency,
      expired: this.expired,
      paused: this.paused,
      displayTime: this.formatTime(this.remaining),
      progress: Math.max(0, this.remaining / this.config.totalTime),
      checkpointsReached: this.checkpointsReached,
      deaths: this.deaths,
      pulseIntensity: this.getPulseIntensity(),
      shakeIntensity: this.getShakeIntensity(),
      colorShiftIntensity: this.getColorShiftIntensity(),
    };
  }

  /**
   * Get current urgency level.
   */
  getUrgency(): TimerUrgency {
    if (this.remaining <= this.config.finalThreshold) return 'final';
    if (this.remaining <= this.config.criticalThreshold) return 'critical';
    if (this.remaining <= this.config.warningThreshold) return 'warning';
    return 'normal';
  }

  /**
   * Get remaining time in seconds.
   */
  getRemaining(): number {
    return this.remaining;
  }

  /**
   * Get whether timer has expired.
   */
  isExpired(): boolean {
    return this.expired;
  }

  /**
   * Get whether timer is paused.
   */
  isPaused(): boolean {
    return this.paused;
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Format seconds into M:SS or MM:SS display string.
   * Uses consistent formatting for timer readability.
   */
  private formatTime(seconds: number): string {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    // Show tenths when under 10 seconds for extra urgency
    if (clamped < 10) {
      const tenths = Math.floor((clamped % 1) * 10);
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate the current pulse intensity (0-1, sinusoidal).
   * Faster oscillation at higher urgency.
   */
  private getPulseIntensity(): number {
    const urgency = this.getUrgency();
    if (urgency === 'normal') return 0;

    // Sinusoidal pulse, amplitude scales with urgency
    const base = (Math.sin(this.pulseAccumulator) + 1) * 0.5; // 0-1

    switch (urgency) {
      case 'warning':
        return base * 0.3;
      case 'critical':
        return base * 0.6;
      case 'final':
        return base * 1.0;
      default:
        return 0;
    }
  }

  /**
   * Get recommended camera shake intensity based on urgency.
   */
  private getShakeIntensity(): number {
    const urgency = this.getUrgency();
    const base = SHAKE_INTENSITIES[urgency];

    // Add random variation for organic feel
    const variation = Math.sin(this.pulseAccumulator * 2.7) * 0.2;
    return Math.max(0, base + variation);
  }

  /**
   * Get color shift intensity for post-processing (0-1).
   * Higher values shift scene toward red/orange danger tones.
   */
  private getColorShiftIntensity(): number {
    const urgency = this.getUrgency();
    switch (urgency) {
      case 'normal':
        return 0;
      case 'warning':
        return 0.15;
      case 'critical':
        return 0.35;
      case 'final':
        return 0.6 + this.getPulseIntensity() * 0.2;
      default:
        return 0;
    }
  }

  /**
   * Handle transitions between urgency levels.
   * Triggers audio cues and visual transitions.
   */
  private handleUrgencyTransition(newUrgency: TimerUrgency): void {
    log.info(`Urgency transition: ${this.previousUrgency} -> ${newUrgency}`);

    this.onUrgencyChange?.(newUrgency);

    switch (newUrgency) {
      case 'warning':
        if (!this.warningAudioPlayed) {
          this.warningAudioPlayed = true;
          getAudioManager().play('alien_alert');
        }
        break;

      case 'critical':
        if (!this.criticalAudioPlayed) {
          this.criticalAudioPlayed = true;
          getAudioManager().playEmergencyKlaxon(2);
          this.heartbeatActive = true;
          // Heartbeat audio would play here if available
          // getAudioManager().playHeartbeat();
        }
        break;

      case 'final':
        if (!this.finalAudioPlayed) {
          this.finalAudioPlayed = true;
          getAudioManager().playEmergencyKlaxon(3);
        }
        break;
    }
  }
}
