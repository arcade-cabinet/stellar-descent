/**
 * VerticalMovement - Unified Vertical Movement Controller
 *
 * Integrates all vertical movement mechanics:
 * - Basic jumping with gravity
 * - Mantling/ledge climbing
 * - Jetpack boost
 * - Ground detection
 *
 * This controller coordinates between the different systems
 * and handles the physics of vertical movement.
 */

import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';
import { getJetpackSystem, type JetpackState, type JetpackSystem } from './JetpackSystem';
import {
  getMantleSystem,
  type MantlePhase,
  type MantleState,
  type MantleSystem,
} from './MantleSystem';

const log = getLogger('VerticalMovement');

/**
 * Configuration for vertical movement
 */
export interface VerticalMovementConfig {
  /** Gravity acceleration (m/s^2) */
  gravity: number;
  /** Initial jump velocity (m/s) */
  jumpVelocity: number;
  /** Maximum fall speed (m/s) */
  terminalVelocity: number;
  /** Ground detection ray length */
  groundCheckDistance: number;
  /** Player height for ground detection */
  playerHeight: number;
  /** Coyote time - grace period for jumping after leaving ground (seconds) */
  coyoteTime: number;
  /** Jump buffer time - how early a jump input is registered (seconds) */
  jumpBufferTime: number;
  /** Air control multiplier (0-1) */
  airControlMultiplier: number;
}

/**
 * Default vertical movement configuration
 */
export const DEFAULT_VERTICAL_CONFIG: VerticalMovementConfig = {
  gravity: 25.0,
  jumpVelocity: 12.0,
  terminalVelocity: 50.0,
  groundCheckDistance: 0.3,
  playerHeight: 1.8,
  coyoteTime: 0.15,
  jumpBufferTime: 0.12,
  airControlMultiplier: 0.6,
};

/**
 * Surface type detected by ground check
 */
export type SurfaceType = 'default' | 'metal' | 'organic' | 'ice' | 'rock';

/**
 * Ground information from raycast
 */
export interface GroundInfo {
  isGrounded: boolean;
  groundHeight: number;
  groundNormal: Vector3;
  slopeAngle: number;
  isWalkable: boolean;
  surfaceType: SurfaceType;
}

/**
 * Fall damage threshold (m/s) - velocity below which fall damage applies
 */
const FALL_DAMAGE_VELOCITY_THRESHOLD = 20;

/**
 * Fall damage multiplier (damage = excess velocity * multiplier)
 */
const FALL_DAMAGE_MULTIPLIER = 2.5;

/**
 * Maximum walkable slope angle (degrees)
 */
const MAX_WALKABLE_SLOPE = 45;

/**
 * Vertical movement state
 */
export interface VerticalState {
  /** Current Y velocity */
  velocityY: number;
  /** Whether player is on the ground */
  isGrounded: boolean;
  /** Time since last grounded */
  timeSinceGrounded: number;
  /** Whether currently in a jump */
  isJumping: boolean;
  /** Whether mantling is in progress */
  isMantling: boolean;
  /** Whether jetpack is boosting */
  isJetpacking: boolean;
  /** Current mantle state */
  mantleState: MantleState;
  /** Current mantle phase */
  mantlePhase: MantlePhase;
  /** Current jetpack state */
  jetpackState: JetpackState;
  /** Jetpack fuel (0-1) */
  jetpackFuel: number;
  /** Ground information */
  groundInfo: GroundInfo;
  /** Peak fall velocity (for fall damage) */
  peakFallVelocity: number;
  /** Whether currently in landing recovery */
  isLanding: boolean;
  /** Landing impact velocity (for effects) */
  landingImpactVelocity: number;
}

/**
 * VerticalMovement - Unified vertical movement controller
 */
export class VerticalMovement {
  private scene: Scene | null = null;
  private config: VerticalMovementConfig;
  private mantleSystem: MantleSystem;
  private jetpackSystem: JetpackSystem;

  // Physics state
  private velocityY = 0;
  private isGrounded = true;
  private wasGrounded = true;
  private timeSinceGrounded = 0;
  private isJumping = false;

  // Jump buffering
  private jumpBufferTime = 0;
  private jumpRequested = false;
  private ignoredMeshes: Set<AbstractMesh> = new Set();

  // Ground mesh reference
  private groundMesh: AbstractMesh | null = null;

  // Ground info
  private groundInfo: GroundInfo = {
    isGrounded: true,
    groundHeight: 0,
    groundNormal: Vector3.Up(),
    slopeAngle: 0,
    isWalkable: true,
    surfaceType: 'default',
  };

  // Fall tracking
  private peakFallVelocity = 0;
  private isLanding = false;
  private landingProgress = 0;
  private landingImpactVelocity = 0;
  private readonly landingDuration = 0.2; // seconds

  // Callbacks
  private onLand: ((velocity: number, surfaceType: SurfaceType) => void) | null = null;
  private onJump: (() => void) | null = null;
  private onFallDamage: ((damage: number) => void) | null = null;

  constructor(config: Partial<VerticalMovementConfig> = {}) {
    this.config = { ...DEFAULT_VERTICAL_CONFIG, ...config };
    this.mantleSystem = getMantleSystem();
    this.jetpackSystem = getJetpackSystem();
  }

  /**
   * Initialize the vertical movement system
   */
  init(scene: Scene): void {
    this.scene = scene;
    this.mantleSystem.init(scene);
    this.jetpackSystem.init(scene);
    log.info('Vertical movement system initialized');
  }

  /**
   * Set callback for landing
   */
  setOnLand(callback: (velocity: number, surfaceType: SurfaceType) => void): void {
    this.onLand = callback;
  }

  /**
   * Set callback for jumping
   */
  setOnJump(callback: () => void): void {
    this.onJump = callback;
  }

  /**
   * Set callback for fall damage
   */
  setOnFallDamage(callback: (damage: number) => void): void {
    this.onFallDamage = callback;
  }

  /**
   * Add a mesh to be ignored during ground detection
   */
  addIgnoredMesh(mesh: AbstractMesh): void {
    this.ignoredMeshes.add(mesh);
    this.mantleSystem.addIgnoredMesh(mesh);
  }

  /**
   * Remove a mesh from the ignored list
   */
  removeIgnoredMesh(mesh: AbstractMesh): void {
    this.ignoredMeshes.delete(mesh);
    this.mantleSystem.removeIgnoredMesh(mesh);
  }

  /**
   * Get current vertical state
   */
  getState(): VerticalState {
    return {
      velocityY: this.velocityY,
      isGrounded: this.isGrounded,
      timeSinceGrounded: this.timeSinceGrounded,
      isJumping: this.isJumping,
      isMantling: this.mantleSystem.isMantling(),
      isJetpacking: this.jetpackSystem.isBoosting(),
      mantleState: this.mantleSystem.getState(),
      mantlePhase: this.mantleSystem.getPhase(),
      jetpackState: this.jetpackSystem.getState(),
      jetpackFuel: this.jetpackSystem.getFuel(),
      groundInfo: { ...this.groundInfo },
      peakFallVelocity: this.peakFallVelocity,
      isLanding: this.isLanding,
      landingImpactVelocity: this.landingImpactVelocity,
    };
  }

  /**
   * Get ground information
   */
  getGroundInfo(): GroundInfo {
    return { ...this.groundInfo };
  }

  /**
   * Get landing bob offset for camera/weapon effects (0 to 1)
   */
  getLandingBobOffset(): number {
    if (!this.isLanding) return 0;
    // Smooth landing bob curve - dip down then recover
    const t = this.landingProgress;
    const intensity = Math.min(0.15, Math.abs(this.landingImpactVelocity) / 100);
    return -Math.sin(t * Math.PI) * intensity;
  }

  /**
   * Check if player is grounded
   */
  isPlayerGrounded(): boolean {
    return this.isGrounded;
  }

  /**
   * Get current Y velocity
   */
  getVelocityY(): number {
    return this.velocityY;
  }

  /**
   * Check if player can jump (grounded or within coyote time)
   */
  canJump(): boolean {
    // Can't jump while mantling or jetpacking
    if (this.mantleSystem.isMantling() || this.jetpackSystem.isBoosting()) {
      return false;
    }

    // Can jump if grounded or within coyote time
    return this.isGrounded || this.timeSinceGrounded < this.config.coyoteTime;
  }

  /**
   * Request a jump (will be buffered if not possible yet)
   */
  requestJump(): void {
    this.jumpRequested = true;
    this.jumpBufferTime = this.config.jumpBufferTime;
  }

  /**
   * Attempt to mantle (called when near a ledge)
   */
  tryMantle(playerPosition: Vector3, playerForward: Vector3): boolean {
    // Can't mantle while jetpacking or jumping upward
    if (this.jetpackSystem.isBoosting() || this.velocityY > 0) {
      return false;
    }

    return this.mantleSystem.tryMantle(playerPosition, playerForward, this.isGrounded);
  }

  /**
   * Start jetpack boost
   */
  tryJetpack(): boolean {
    // Can't jetpack while mantling
    if (this.mantleSystem.isMantling()) {
      return false;
    }

    return this.jetpackSystem.tryBoost();
  }

  /**
   * Stop jetpack boost
   */
  stopJetpack(): void {
    this.jetpackSystem.stopBoost();
  }

  /**
   * Set movement input for directional jetpack boost
   */
  setMovementInput(input: Vector3): void {
    this.jetpackSystem.setMovementInput(input);
  }

  /**
   * Check ground beneath player
   */
  private checkGround(playerPosition: Vector3): boolean {
    if (!this.scene) return false;

    // Cast ray downward from player position
    const rayOrigin = playerPosition.clone();
    rayOrigin.y += 0.1; // Slightly above feet

    const ray = new Ray(rayOrigin, Vector3.Down(), this.config.groundCheckDistance + 0.2);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && !this.ignoredMeshes.has(mesh);
    });

    if (hit?.hit && hit.distance <= this.config.groundCheckDistance + 0.1 && hit.pickedPoint) {
      this.groundMesh = hit.pickedMesh;

      // Update ground info
      this.groundInfo.isGrounded = true;
      this.groundInfo.groundHeight = hit.pickedPoint.y;

      // Get surface normal for slope detection
      if (hit.getNormal) {
        const normal = hit.getNormal(true);
        if (normal) {
          this.groundInfo.groundNormal = normal;
          // Calculate slope angle from normal
          const slopeAngle =
            Math.acos(Math.abs(Vector3.Dot(normal, Vector3.Up()))) * (180 / Math.PI);
          this.groundInfo.slopeAngle = slopeAngle;
          this.groundInfo.isWalkable = slopeAngle <= MAX_WALKABLE_SLOPE;
        }
      }

      // Detect surface type from mesh name/material
      this.groundInfo.surfaceType = this.detectSurfaceType(hit.pickedMesh);

      return true;
    }

    this.groundMesh = null;
    this.groundInfo.isGrounded = false;
    return false;
  }

  /**
   * Detect surface type from mesh
   */
  private detectSurfaceType(mesh: AbstractMesh | null): SurfaceType {
    if (!mesh) return 'default';

    const name = mesh.name.toLowerCase();
    if (
      name.includes('metal') ||
      name.includes('steel') ||
      name.includes('grate') ||
      name.includes('floor')
    ) {
      return 'metal';
    }
    if (
      name.includes('organic') ||
      name.includes('flesh') ||
      name.includes('hive') ||
      name.includes('alien')
    ) {
      return 'organic';
    }
    if (name.includes('ice') || name.includes('snow') || name.includes('frozen')) {
      return 'ice';
    }
    if (
      name.includes('rock') ||
      name.includes('stone') ||
      name.includes('terrain') ||
      name.includes('ground')
    ) {
      return 'rock';
    }
    return 'default';
  }

  /**
   * Get slope-adjusted movement vector
   */
  getSlopeAdjustedMovement(movement: Vector3): Vector3 {
    if (!this.isGrounded || !this.groundInfo.isWalkable) {
      return movement;
    }

    if (this.groundInfo.slopeAngle < 5) {
      return movement;
    }

    // Project movement onto the ground plane
    const normal = this.groundInfo.groundNormal;
    const tangent = movement.subtract(normal.scale(Vector3.Dot(movement, normal)));

    return tangent;
  }

  /**
   * Get slope slide velocity (for unwalkable slopes)
   */
  getSlopeSlideVelocity(): Vector3 {
    if (this.isGrounded && !this.groundInfo.isWalkable) {
      // On unwalkable slope - slide down
      const normal = this.groundInfo.groundNormal;
      const slideDir = new Vector3(normal.x, 0, normal.z).normalize();
      const slideSpeed = (this.groundInfo.slopeAngle - MAX_WALKABLE_SLOPE) * 0.3;
      return slideDir.scale(slideSpeed);
    }
    return Vector3.Zero();
  }

  /**
   * Update vertical movement physics
   * Returns the vertical position delta to apply
   */
  update(deltaTime: number, playerPosition: Vector3, playerForward: Vector3): number {
    let positionDelta = 0;

    // Store previous grounded state
    this.wasGrounded = this.isGrounded;

    // Check ground
    this.isGrounded = this.checkGround(playerPosition);

    // Update time since grounded
    if (this.isGrounded) {
      this.timeSinceGrounded = 0;
    } else {
      this.timeSinceGrounded += deltaTime;
    }

    // Handle landing
    if (this.isGrounded && !this.wasGrounded) {
      this.handleLanding();
    }

    // Handle leaving ground (without jumping)
    if (!this.isGrounded && this.wasGrounded && !this.isJumping) {
      // Started falling - set small negative velocity
      this.velocityY = -0.1;
    }

    // Update jump buffer
    if (this.jumpBufferTime > 0) {
      this.jumpBufferTime -= deltaTime;
    }

    // Handle mantling - this takes priority over normal movement
    if (this.mantleSystem.isMantling()) {
      const mantlePos = this.mantleSystem.update(deltaTime, this.isGrounded);

      if (mantlePos) {
        // Return the delta to move to mantle position
        positionDelta = mantlePos.y - playerPosition.y;
        this.velocityY = 0;
        this.isJumping = false;
        return positionDelta;
      }
    }

    // Check for buffered jump
    if (this.jumpRequested || this.jumpBufferTime > 0) {
      if (this.canJump()) {
        this.performJump();
        this.jumpRequested = false;
        this.jumpBufferTime = 0;
      }
    }

    // Handle jetpack boost
    const jetpackThrust = this.jetpackSystem.update(deltaTime, playerPosition);
    if (jetpackThrust.length() > 0) {
      // Apply jetpack thrust to velocity
      this.velocityY += jetpackThrust.y * deltaTime;

      // Limit upward velocity during boost
      if (this.velocityY > 20) {
        this.velocityY = 20;
      }
    }

    // Apply gravity when not grounded and not boosting
    if (!this.isGrounded && !this.jetpackSystem.isBoosting()) {
      this.velocityY -= this.config.gravity * deltaTime;

      // Clamp to terminal velocity
      if (this.velocityY < -this.config.terminalVelocity) {
        this.velocityY = -this.config.terminalVelocity;
      }

      // Track peak fall velocity for fall damage calculation
      if (this.velocityY < this.peakFallVelocity) {
        this.peakFallVelocity = this.velocityY;
      }
    }

    // Reset velocity when grounded
    if (this.isGrounded && this.velocityY < 0) {
      this.velocityY = 0;
      this.isJumping = false;
    }

    // Update landing recovery animation
    this.updateLandingRecovery(deltaTime);

    // Calculate position delta
    positionDelta = this.velocityY * deltaTime;

    // Auto-detect mantle opportunities when in air and moving toward a ledge
    if (!this.isGrounded && !this.mantleSystem.isMantling() && this.velocityY < 5) {
      const ledgeInfo = this.mantleSystem.detectLedge(
        playerPosition,
        playerForward,
        this.isGrounded
      );

      if (ledgeInfo.found) {
        // Try to auto-mantle if we're close to a ledge and falling
        if (this.velocityY < 0 && ledgeInfo.height < 1.5) {
          this.mantleSystem.tryMantle(playerPosition, playerForward, this.isGrounded);
        }
      }
    }

    return positionDelta;
  }

  /**
   * Perform a jump
   */
  private performJump(): void {
    this.velocityY = this.config.jumpVelocity;
    this.isJumping = true;
    this.isGrounded = false;

    // Play jump sound
    const audio = getAudioManager();
    audio.play('jump', { volume: 0.5 });

    // Trigger callback
    this.onJump?.();

    log.info('Jump performed');
  }

  /**
   * Handle landing
   */
  private handleLanding(): void {
    const landingVelocity = Math.abs(this.peakFallVelocity);
    this.landingImpactVelocity = this.peakFallVelocity;

    // Start landing recovery animation
    if (landingVelocity > 5) {
      this.isLanding = true;
      this.landingProgress = 0;
    }

    // Play landing sound based on impact force and surface type
    const audio = getAudioManager();
    const surfaceType = this.groundInfo.surfaceType;

    if (landingVelocity > 15) {
      // Heavy landing
      const soundName = surfaceType === 'metal' ? 'footstep' : 'footstep';
      audio.play(soundName, { volume: Math.min(0.9, landingVelocity / 30) });
    } else if (landingVelocity > 5) {
      audio.play('footstep', { volume: Math.min(0.6, landingVelocity / 20) });
    }

    // Check for fall damage
    if (landingVelocity > FALL_DAMAGE_VELOCITY_THRESHOLD) {
      const excessVelocity = landingVelocity - FALL_DAMAGE_VELOCITY_THRESHOLD;
      const damage = Math.round(excessVelocity * FALL_DAMAGE_MULTIPLIER);

      if (damage > 0) {
        log.info(`Fall damage: ${damage} (impact velocity: ${landingVelocity.toFixed(1)})`);
        this.onFallDamage?.(damage);
      }
    }

    // Trigger landing callback
    this.onLand?.(landingVelocity, surfaceType);

    // Reset state
    this.velocityY = 0;
    this.isJumping = false;
    this.peakFallVelocity = 0;
  }

  /**
   * Update landing recovery animation
   */
  private updateLandingRecovery(deltaTime: number): void {
    if (!this.isLanding) return;

    this.landingProgress += deltaTime / this.landingDuration;

    if (this.landingProgress >= 1) {
      this.isLanding = false;
      this.landingProgress = 0;
      this.landingImpactVelocity = 0;
    }
  }

  /**
   * Get camera animation offsets
   */
  getCameraAnimation(): {
    pitchOffset: number;
    rollOffset: number;
    shakeX: number;
    shakeY: number;
  } {
    // Combine mantle and jetpack camera effects
    const mantleAnim = this.mantleSystem.getCameraAnimation();
    const jetpackShake = this.jetpackSystem.getCameraShake();

    return {
      pitchOffset: mantleAnim.pitchOffset,
      rollOffset: mantleAnim.rollOffset,
      shakeX: jetpackShake.x,
      shakeY: jetpackShake.y,
    };
  }

  /**
   * Get air control multiplier for horizontal movement
   */
  getAirControlMultiplier(): number {
    if (this.isGrounded) return 1.0;
    if (this.jetpackSystem.isBoosting()) return 0.6;
    if (this.mantleSystem.isMantling()) return 0.0;
    return this.config.airControlMultiplier;
  }

  /**
   * Cancel any in-progress vertical movement (e.g., on damage)
   */
  cancelMovement(): void {
    this.mantleSystem.cancelMantle();
    this.jetpackSystem.stopBoost();
  }

  /**
   * Force player to ground (e.g., for teleporting)
   */
  forceGround(): void {
    this.isGrounded = true;
    this.velocityY = 0;
    this.isJumping = false;
    this.timeSinceGrounded = 0;
  }

  /**
   * Reset the vertical movement system
   */
  reset(): void {
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this.timeSinceGrounded = 0;
    this.isJumping = false;
    this.jumpBufferTime = 0;
    this.jumpRequested = false;
    this.groundMesh = null;
    this.peakFallVelocity = 0;
    this.isLanding = false;
    this.landingProgress = 0;
    this.landingImpactVelocity = 0;
    this.groundInfo = {
      isGrounded: true,
      groundHeight: 0,
      groundNormal: Vector3.Up(),
      slopeAngle: 0,
      isWalkable: true,
      surfaceType: 'default',
    };

    this.mantleSystem.reset();
    this.jetpackSystem.reset();
  }

  /**
   * Dispose of the vertical movement system
   */
  dispose(): void {
    this.reset();
    this.ignoredMeshes.clear();
    this.scene = null;
    this.onLand = null;
    this.onJump = null;

    // Note: Don't dispose mantle/jetpack systems here as they're singletons
    log.info('Vertical movement system disposed');
  }
}

// Singleton instance
let verticalMovementInstance: VerticalMovement | null = null;

/**
 * Get the singleton vertical movement instance
 */
export function getVerticalMovement(): VerticalMovement {
  if (!verticalMovementInstance) {
    verticalMovementInstance = new VerticalMovement();
  }
  return verticalMovementInstance;
}

/**
 * Dispose of the singleton vertical movement instance
 */
export function disposeVerticalMovement(): void {
  if (verticalMovementInstance) {
    verticalMovementInstance.dispose();
    verticalMovementInstance = null;
  }
}
