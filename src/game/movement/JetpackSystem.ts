/**
 * JetpackSystem - Short Vertical Boost Mechanics
 *
 * Provides Halo/Destiny-style jetpack boost:
 * - Short vertical thrust (not sustained flight)
 * - Cooldown-based (5 second cooldown, 0.5s boost duration)
 * - Fuel gauge for HUD display
 * - Particle effects for thrusters
 * - Works in conjunction with jump
 *
 * The jetpack provides tactical vertical mobility without
 * making the player overpowered in combat scenarios.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem';
import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';
import { particleManager } from '../effects/ParticleManager';

const log = getLogger('JetpackSystem');

/**
 * Configuration for the jetpack system
 */
export interface JetpackConfig {
  /** Maximum fuel capacity (0-1) */
  maxFuel: number;
  /** Fuel consumption rate per second while boosting */
  fuelConsumptionRate: number;
  /** Fuel regeneration rate per second when not boosting */
  fuelRegenRate: number;
  /** Minimum fuel required to activate boost */
  minFuelToActivate: number;
  /** Cooldown duration after fuel depletes (seconds) */
  cooldownDuration: number;
  /** Boost duration when holding the button (seconds) */
  maxBoostDuration: number;
  /** Vertical thrust force */
  thrustForce: number;
  /** Horizontal thrust force (for directional boost) */
  horizontalThrustForce: number;
  /** Camera shake intensity during boost */
  cameraShakeIntensity: number;
  /** Time between thruster particle bursts */
  particleInterval: number;
  /** Delay before fuel starts regenerating after boost ends */
  regenDelay: number;
}

/**
 * Default jetpack configuration
 */
export const DEFAULT_JETPACK_CONFIG: JetpackConfig = {
  maxFuel: 1.0,
  fuelConsumptionRate: 2.0, // Full fuel lasts 0.5 seconds
  fuelRegenRate: 0.2, // Full regen in 5 seconds
  minFuelToActivate: 0.3,
  cooldownDuration: 5.0,
  maxBoostDuration: 0.5,
  thrustForce: 25.0,
  horizontalThrustForce: 8.0,
  cameraShakeIntensity: 0.03,
  particleInterval: 0.05,
  regenDelay: 1.0,
};

/**
 * Jetpack state
 */
export type JetpackState = 'ready' | 'boosting' | 'cooldown' | 'recharging';

/**
 * Thruster visual effect data
 */
interface ThrusterEffect {
  position: Vector3;
  direction: Vector3;
  intensity: number;
}

/**
 * JetpackSystem - Handles short vertical boost mechanics
 */
export class JetpackSystem {
  private config: JetpackConfig;
  private state: JetpackState = 'ready';

  // Fuel tracking
  private currentFuel: number;
  private cooldownRemaining = 0;
  private regenDelayRemaining = 0;
  private boostDuration = 0;

  // Particle systems for thruster effects
  private leftThrusterParticles: ParticleSystem | GPUParticleSystem | null = null;
  private rightThrusterParticles: ParticleSystem | GPUParticleSystem | null = null;
  private lastParticleTime = 0;

  // Audio loop handle
  private thrustLoopActive = false;

  // Callbacks
  private onBoostStart: (() => void) | null = null;
  private onBoostEnd: (() => void) | null = null;
  private onFuelChange: ((fuel: number, maxFuel: number) => void) | null = null;
  private onStateChange: ((state: JetpackState) => void) | null = null;

  // Movement input for directional boost
  private movementInput: Vector3 = Vector3.Zero();

  constructor(config: Partial<JetpackConfig> = {}) {
    this.config = { ...DEFAULT_JETPACK_CONFIG, ...config };
    this.currentFuel = this.config.maxFuel;
  }

  /**
   * Initialize the jetpack system with a scene
   */
  init(scene: Scene): void {
    this.scene = scene;
    log.info('Jetpack system initialized');
  }

  /**
   * Set the emitter node for thruster particles
   */
  setThrusterEmitter(emitter: TransformNode): void {
    this.thrusterEmitter = emitter;
  }

  /**
   * Set callback for when boost starts
   */
  setOnBoostStart(callback: () => void): void {
    this.onBoostStart = callback;
  }

  /**
   * Set callback for when boost ends
   */
  setOnBoostEnd(callback: () => void): void {
    this.onBoostEnd = callback;
  }

  /**
   * Set callback for fuel changes
   */
  setOnFuelChange(callback: (fuel: number, maxFuel: number) => void): void {
    this.onFuelChange = callback;
  }

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: JetpackState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Set current movement input direction
   */
  setMovementInput(input: Vector3): void {
    this.movementInput = input.clone();
  }

  /**
   * Check if jetpack is currently boosting
   */
  isBoosting(): boolean {
    return this.state === 'boosting';
  }

  /**
   * Check if jetpack is ready to use
   */
  isReady(): boolean {
    return this.state === 'ready' && this.currentFuel >= this.config.minFuelToActivate;
  }

  /**
   * Check if jetpack is on cooldown
   */
  isOnCooldown(): boolean {
    return this.state === 'cooldown';
  }

  /**
   * Get current state
   */
  getState(): JetpackState {
    return this.state;
  }

  /**
   * Get current fuel level (0-1)
   */
  getFuel(): number {
    return this.currentFuel / this.config.maxFuel;
  }

  /**
   * Get current fuel as absolute value
   */
  getFuelAbsolute(): number {
    return this.currentFuel;
  }

  /**
   * Get cooldown remaining (0-1)
   */
  getCooldownProgress(): number {
    if (this.state !== 'cooldown') return 0;
    return this.cooldownRemaining / this.config.cooldownDuration;
  }

  /**
   * Attempt to start boosting
   */
  tryBoost(): boolean {
    // Check if boost is possible
    if (this.state !== 'ready' && this.state !== 'recharging') {
      return false;
    }

    if (this.currentFuel < this.config.minFuelToActivate) {
      return false;
    }

    // Start boost
    this.setState('boosting');
    this.boostDuration = 0;

    // Play boost sound
    const audio = getAudioManager();
    audio.play('jump', { volume: 0.7 }); // Use jump sound for initial burst

    // Start thrust loop sound
    this.startThrustSound();

    // Trigger callback
    this.onBoostStart?.();

    log.info('Jetpack boost started');
    return true;
  }

  /**
   * Stop boosting (release button)
   */
  stopBoost(): void {
    if (this.state !== 'boosting') return;

    this.endBoost();
  }

  /**
   * Internal boost end handling
   */
  private endBoost(): void {
    // Stop thrust sound
    this.stopThrustSound();

    // Stop particle effects
    this.stopThrusterParticles();

    // Determine next state based on fuel
    if (this.currentFuel <= 0) {
      this.setState('cooldown');
      this.cooldownRemaining = this.config.cooldownDuration;
    } else {
      this.setState('recharging');
      this.regenDelayRemaining = this.config.regenDelay;
    }

    // Trigger callback
    this.onBoostEnd?.();

    log.info('Jetpack boost ended');
  }

  /**
   * Update the jetpack system
   * Returns thrust vector to apply to player velocity
   */
  update(deltaTime: number, playerPosition: Vector3): Vector3 {
    const thrustVector = Vector3.Zero();

    // Handle boosting state
    if (this.state === 'boosting') {
      // Consume fuel
      this.currentFuel -= this.config.fuelConsumptionRate * deltaTime;
      this.boostDuration += deltaTime;

      // Notify fuel change
      this.onFuelChange?.(this.currentFuel, this.config.maxFuel);

      // Check for boost end conditions
      if (this.currentFuel <= 0 || this.boostDuration >= this.config.maxBoostDuration) {
        this.currentFuel = Math.max(0, this.currentFuel);
        this.endBoost();
      } else {
        // Calculate thrust vector
        // Vertical thrust is always present
        thrustVector.y = this.config.thrustForce;

        // Add horizontal component based on movement input
        if (this.movementInput.length() > 0.1) {
          const horizontal = this.movementInput.clone();
          horizontal.y = 0;
          horizontal.normalize();
          horizontal.scaleInPlace(this.config.horizontalThrustForce);
          thrustVector.addInPlace(horizontal);
        }

        // Emit thruster particles
        this.emitThrusterParticles(playerPosition, deltaTime);
      }
    }

    // Handle cooldown state
    if (this.state === 'cooldown') {
      this.cooldownRemaining -= deltaTime;

      if (this.cooldownRemaining <= 0) {
        this.cooldownRemaining = 0;
        this.setState('recharging');
        this.regenDelayRemaining = this.config.regenDelay;
      }
    }

    // Handle recharging state
    if (this.state === 'recharging') {
      // Apply regen delay
      if (this.regenDelayRemaining > 0) {
        this.regenDelayRemaining -= deltaTime;
      } else {
        // Regenerate fuel
        this.currentFuel += this.config.fuelRegenRate * deltaTime;

        if (this.currentFuel >= this.config.maxFuel) {
          this.currentFuel = this.config.maxFuel;
          this.setState('ready');
        }

        // Notify fuel change
        this.onFuelChange?.(this.currentFuel, this.config.maxFuel);
      }
    }

    return thrustVector;
  }

  /**
   * Get camera shake intensity for current boost state
   */
  getCameraShake(): { x: number; y: number } {
    if (this.state !== 'boosting') {
      return { x: 0, y: 0 };
    }

    const intensity = this.config.cameraShakeIntensity;
    const time = performance.now() * 0.02;

    return {
      x: (Math.sin(time * 1.3) + Math.sin(time * 2.1) * 0.5) * intensity,
      y: (Math.cos(time * 1.7) + Math.cos(time * 2.9) * 0.5) * intensity,
    };
  }

  /**
   * Get thruster visual effect data
   */
  getThrusterEffects(): ThrusterEffect[] {
    if (this.state !== 'boosting') {
      return [];
    }

    // Return two thrusters (left and right of player)
    const intensity = this.currentFuel / this.config.maxFuel;

    return [
      {
        position: new Vector3(-0.3, -0.5, -0.2),
        direction: Vector3.Down(),
        intensity,
      },
      {
        position: new Vector3(0.3, -0.5, -0.2),
        direction: Vector3.Down(),
        intensity,
      },
    ];
  }

  /**
   * Emit thruster particle effects
   */
  private emitThrusterParticles(playerPosition: Vector3, deltaTime: number): void {
    this.lastParticleTime += deltaTime;

    if (this.lastParticleTime < this.config.particleInterval) {
      return;
    }

    this.lastParticleTime = 0;

    // Emit particles at thruster positions
    const leftThruster = playerPosition.clone();
    leftThruster.x -= 0.3;
    leftThruster.y -= 0.5;

    const rightThruster = playerPosition.clone();
    rightThruster.x += 0.3;
    rightThruster.y -= 0.5;

    // Use the particle manager to emit thruster effects
    // Custom effect for jetpack thrust
    particleManager.emit('muzzle_flash_core', leftThruster, {
      direction: Vector3.Down(),
      scale: 0.4,
    });

    particleManager.emit('muzzle_flash_core', rightThruster, {
      direction: Vector3.Down(),
      scale: 0.4,
    });
  }

  /**
   * Start thruster sound loop
   */
  private startThrustSound(): void {
    if (this.thrustLoopActive) return;

    const audio = getAudioManager();
    audio.startLoop('drop_thrust', 0.4);
    this.thrustLoopActive = true;
  }

  /**
   * Stop thruster sound loop
   */
  private stopThrustSound(): void {
    if (!this.thrustLoopActive) return;

    const audio = getAudioManager();
    audio.stopLoop('drop_thrust');
    this.thrustLoopActive = false;
  }

  /**
   * Stop thruster particle effects
   */
  private stopThrusterParticles(): void {
    if (this.leftThrusterParticles) {
      this.leftThrusterParticles.stop();
    }
    if (this.rightThrusterParticles) {
      this.rightThrusterParticles.stop();
    }
  }

  /**
   * Set state and trigger callback
   */
  private setState(newState: JetpackState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  /**
   * Force refuel to full (e.g., for pickup or respawn)
   */
  refuel(): void {
    this.currentFuel = this.config.maxFuel;
    this.cooldownRemaining = 0;
    this.regenDelayRemaining = 0;

    if (this.state === 'cooldown' || this.state === 'recharging') {
      this.setState('ready');
    }

    this.onFuelChange?.(this.currentFuel, this.config.maxFuel);
    log.info('Jetpack refueled');
  }

  /**
   * Reset the jetpack system state
   */
  reset(): void {
    this.stopBoost();
    this.currentFuel = this.config.maxFuel;
    this.cooldownRemaining = 0;
    this.regenDelayRemaining = 0;
    this.boostDuration = 0;
    this.setState('ready');
    this.onFuelChange?.(this.currentFuel, this.config.maxFuel);
  }

  /**
   * Dispose of the jetpack system
   */
  dispose(): void {
    this.stopBoost();
    this.stopThrusterParticles();

    if (this.leftThrusterParticles) {
      this.leftThrusterParticles.dispose();
      this.leftThrusterParticles = null;
    }

    if (this.rightThrusterParticles) {
      this.rightThrusterParticles.dispose();
      this.rightThrusterParticles = null;
    }

    this.scene = null;
    this.thrusterEmitter = null;
    this.onBoostStart = null;
    this.onBoostEnd = null;
    this.onFuelChange = null;
    this.onStateChange = null;

    log.info('Jetpack system disposed');
  }
}

// Singleton instance
let jetpackSystemInstance: JetpackSystem | null = null;

/**
 * Get the singleton jetpack system instance
 */
export function getJetpackSystem(): JetpackSystem {
  if (!jetpackSystemInstance) {
    jetpackSystemInstance = new JetpackSystem();
  }
  return jetpackSystemInstance;
}

/**
 * Dispose of the singleton jetpack system
 */
export function disposeJetpackSystem(): void {
  if (jetpackSystemInstance) {
    jetpackSystemInstance.dispose();
    jetpackSystemInstance = null;
  }
}
