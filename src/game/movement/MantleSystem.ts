/**
 * MantleSystem - Ledge Detection and Climbing Mechanics
 *
 * Provides Halo/Destiny-style ledge climbing:
 * - Automatic ledge detection when near climbable surfaces
 * - Smooth pull-up animation with camera transition
 * - Height threshold (can mantle up to 2 meters)
 * - Integration with first-person camera
 * - Sound effects for climbing
 *
 * The system uses raycasting to detect valid mantling surfaces
 * and handles the smooth transition from jumping to climbing.
 */

import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';

const log = getLogger('MantleSystem');

/**
 * Configuration for the mantle system
 */
export interface MantleConfig {
  /** Maximum height the player can mantle (meters) */
  maxMantleHeight: number;
  /** Minimum height required for mantling (meters) */
  minMantleHeight: number;
  /** Forward reach for ledge detection (meters) */
  forwardReach: number;
  /** Duration of the mantle animation (seconds) */
  mantleDuration: number;
  /** Cooldown between mantle attempts (seconds) */
  mantleCooldown: number;
  /** Vertical offset for camera during mantle */
  cameraLiftOffset: number;
  /** Required airborne time before mantling is allowed (seconds) */
  minAirborneTime: number;
  /** Minimum ledge height for ledge grab (higher ledges trigger grab instead of mantle) */
  ledgeGrabMinHeight: number;
  /** Maximum ledge height for ledge grab */
  ledgeGrabMaxHeight: number;
  /** Duration of ledge grab pull-up animation (seconds) */
  ledgeGrabPullUpDuration: number;
}

/**
 * Default mantle configuration
 */
export const DEFAULT_MANTLE_CONFIG: MantleConfig = {
  maxMantleHeight: 1.2,
  minMantleHeight: 0.3,
  forwardReach: 1.0,
  mantleDuration: 0.4,
  mantleCooldown: 0.2,
  cameraLiftOffset: 0.5,
  minAirborneTime: 0.05,
  ledgeGrabMinHeight: 1.5,
  ledgeGrabMaxHeight: 2.8,
  ledgeGrabPullUpDuration: 0.5,
};

/**
 * Ledge detection result
 */
export interface LedgeInfo {
  /** Whether a valid ledge was detected */
  found: boolean;
  /** World position of the ledge surface */
  position: Vector3;
  /** Normal of the ledge surface */
  normal: Vector3;
  /** Height from player to ledge */
  height: number;
  /** The mesh that was hit */
  mesh: AbstractMesh | null;
  /** Whether this ledge is for grabbing (higher) or mantling (lower) */
  isLedgeGrab: boolean;
}

/**
 * Mantle state tracking
 */
export type MantleState = 'idle' | 'detecting' | 'mantling' | 'cooldown' | 'ledge_grabbing' | 'pulling_up';

/**
 * Mantle animation phase
 */
export type MantlePhase = 'reach' | 'pull' | 'vault' | 'complete' | 'hanging' | 'pullup';

/**
 * MantleSystem - Handles ledge detection and climbing mechanics
 */
export class MantleSystem {
  private scene: Scene | null = null;
  private config: MantleConfig;
  private state: MantleState = 'idle';
  private phase: MantlePhase = 'complete';

  // Animation state
  private mantleProgress = 0;
  private mantleStartPos: Vector3 = Vector3.Zero();
  private mantleTargetPos: Vector3 = Vector3.Zero();
  private ledgeInfo: LedgeInfo | null = null;

  // Cooldown tracking
  private cooldownRemaining = 0;
  private airborneTime = 0;

  // Ledge grab state
  private ledgeGrabProgress = 0;
  private hangPosition: Vector3 = Vector3.Zero();

  // Callbacks
  private onMantleStart: (() => void) | null = null;
  private onMantleComplete: (() => void) | null = null;
  private onMantleProgress: ((progress: number, phase: MantlePhase) => void) | null = null;
  private onLedgeGrab: (() => void) | null = null;
  private onLedgePullUp: (() => void) | null = null;

  // Meshes to ignore (player, projectiles, etc.)
  private ignoredMeshes: Set<AbstractMesh> = new Set();

  constructor(config: Partial<MantleConfig> = {}) {
    this.config = { ...DEFAULT_MANTLE_CONFIG, ...config };
  }

  /**
   * Initialize the mantle system with a scene
   */
  init(scene: Scene): void {
    this.scene = scene;
    log.info('Mantle system initialized');
  }

  /**
   * Set callback for when mantling starts
   */
  setOnMantleStart(callback: () => void): void {
    this.onMantleStart = callback;
  }

  /**
   * Set callback for when mantling completes
   */
  setOnMantleComplete(callback: () => void): void {
    this.onMantleComplete = callback;
  }

  /**
   * Set callback for mantle progress updates
   */
  setOnMantleProgress(callback: (progress: number, phase: MantlePhase) => void): void {
    this.onMantleProgress = callback;
  }

  /**
   * Set callback for ledge grab
   */
  setOnLedgeGrab(callback: () => void): void {
    this.onLedgeGrab = callback;
  }

  /**
   * Set callback for ledge pull-up
   */
  setOnLedgePullUp(callback: () => void): void {
    this.onLedgePullUp = callback;
  }

  /**
   * Add a mesh to be ignored during ledge detection
   */
  addIgnoredMesh(mesh: AbstractMesh): void {
    this.ignoredMeshes.add(mesh);
  }

  /**
   * Remove a mesh from the ignored list
   */
  removeIgnoredMesh(mesh: AbstractMesh): void {
    this.ignoredMeshes.delete(mesh);
  }

  /**
   * Check if currently mantling
   */
  isMantling(): boolean {
    return this.state === 'mantling' || this.state === 'pulling_up';
  }

  /**
   * Check if currently grabbing a ledge
   */
  isLedgeGrabbing(): boolean {
    return this.state === 'ledge_grabbing';
  }

  /**
   * Check if currently pulling up from ledge grab
   */
  isPullingUp(): boolean {
    return this.state === 'pulling_up';
  }

  /**
   * Check if mantle is on cooldown
   */
  isOnCooldown(): boolean {
    return this.state === 'cooldown';
  }

  /**
   * Get current mantle state
   */
  getState(): MantleState {
    return this.state;
  }

  /**
   * Get current mantle phase (if mantling)
   */
  getPhase(): MantlePhase {
    return this.phase;
  }

  /**
   * Get current mantle progress (0-1)
   */
  getProgress(): number {
    return this.mantleProgress;
  }

  /**
   * Detect if there's a valid ledge in front of the player
   * Returns ledge info with isLedgeGrab flag indicating if it's a grab or mantle
   */
  detectLedge(
    playerPosition: Vector3,
    playerForward: Vector3,
    isGrounded: boolean
  ): LedgeInfo {
    const noLedge: LedgeInfo = {
      found: false,
      position: Vector3.Zero(),
      normal: Vector3.Zero(),
      height: 0,
      mesh: null,
      isLedgeGrab: false,
    };

    if (!this.scene) return noLedge;

    // Normalize forward direction (horizontal only)
    const forward = playerForward.clone();
    forward.y = 0;
    forward.normalize();

    // Cast ray forward at chest height to find wall
    const chestHeight = playerPosition.y + 0.5;
    const chestRayOrigin = new Vector3(playerPosition.x, chestHeight, playerPosition.z);
    const chestRay = new Ray(chestRayOrigin, forward, this.config.forwardReach + 0.5);

    const wallHit = this.scene.pickWithRay(chestRay, (mesh) => {
      return mesh.isPickable && !this.ignoredMeshes.has(mesh);
    });

    if (!wallHit?.hit || !wallHit.pickedMesh) return noLedge;

    // Found a wall - now cast downward from above to find the top edge
    // Check for both mantle height and ledge grab height
    const wallDistance = wallHit.distance;
    const maxCheckHeight = playerPosition.y + this.config.ledgeGrabMaxHeight + 0.3;
    const topRayOrigin = new Vector3(
      playerPosition.x + forward.x * (wallDistance + 0.2),
      maxCheckHeight,
      playerPosition.z + forward.z * (wallDistance + 0.2)
    );

    const downRay = new Ray(topRayOrigin, Vector3.Down(), this.config.ledgeGrabMaxHeight + 0.5);

    const ledgeHit = this.scene.pickWithRay(downRay, (mesh) => {
      return mesh.isPickable && !this.ignoredMeshes.has(mesh);
    });

    if (!ledgeHit?.hit || !ledgeHit.pickedPoint) return noLedge;

    // Calculate ledge height relative to player feet
    const playerFeetY = playerPosition.y - 0.9; // Approximate feet position
    const ledgeHeight = ledgeHit.pickedPoint.y - playerFeetY;

    // Determine if this is a mantle or ledge grab based on height
    let isLedgeGrab = false;

    if (ledgeHeight >= this.config.ledgeGrabMinHeight && ledgeHeight <= this.config.ledgeGrabMaxHeight) {
      // Higher ledge - this is a ledge grab
      isLedgeGrab = true;
    } else if (ledgeHeight >= this.config.minMantleHeight && ledgeHeight <= this.config.maxMantleHeight) {
      // Lower ledge - this is a mantle
      isLedgeGrab = false;
    } else {
      // Height doesn't match either category
      return noLedge;
    }

    // Verify there's space above the ledge (no ceiling)
    const ceilingCheckOrigin = new Vector3(
      ledgeHit.pickedPoint.x,
      ledgeHit.pickedPoint.y + 0.1,
      ledgeHit.pickedPoint.z
    );
    const ceilingRay = new Ray(ceilingCheckOrigin, Vector3.Up(), 2.0);
    const ceilingHit = this.scene.pickWithRay(ceilingRay, (mesh) => {
      return mesh.isPickable && !this.ignoredMeshes.has(mesh);
    });

    // If there's a ceiling within 2 meters, not enough room to mantle/climb
    if (ceilingHit?.hit && ceilingHit.distance < 2.0) {
      return noLedge;
    }

    return {
      found: true,
      position: ledgeHit.pickedPoint.clone(),
      normal: ledgeHit.getNormal(true) ?? Vector3.Up(),
      height: ledgeHeight,
      mesh: ledgeHit.pickedMesh,
      isLedgeGrab,
    };
  }

  /**
   * Attempt to start mantling
   */
  tryMantle(
    playerPosition: Vector3,
    playerForward: Vector3,
    isGrounded: boolean
  ): boolean {
    // Check if mantling is possible
    if (this.state !== 'idle' && this.state !== 'detecting') {
      return false;
    }

    if (this.cooldownRemaining > 0) {
      return false;
    }

    // Detect ledge
    const ledge = this.detectLedge(playerPosition, playerForward, isGrounded);

    if (!ledge.found) {
      return false;
    }

    // Start mantling
    this.state = 'mantling';
    this.phase = 'reach';
    this.mantleProgress = 0;
    this.mantleStartPos = playerPosition.clone();
    this.ledgeInfo = ledge;

    // Calculate target position (on top of ledge, slightly back from edge)
    const forward = playerForward.clone();
    forward.y = 0;
    forward.normalize();

    this.mantleTargetPos = ledge.position.clone();
    this.mantleTargetPos.y += 0.5; // Camera height offset
    this.mantleTargetPos.addInPlace(forward.scale(-0.3)); // Slightly back from edge

    // Play mantle start sound
    const audio = getAudioManager();
    audio.play('footstep', { volume: 0.6 }); // Use footstep as climbing sound

    // Trigger callback
    this.onMantleStart?.();

    log.info(`Mantling to height ${ledge.height.toFixed(2)}m`);
    return true;
  }

  /**
   * Attempt to grab a high ledge
   */
  tryLedgeGrab(
    playerPosition: Vector3,
    playerForward: Vector3,
    isGrounded: boolean
  ): boolean {
    // Check if ledge grab is possible
    if (this.state !== 'idle' && this.state !== 'detecting') {
      return false;
    }

    if (this.cooldownRemaining > 0) {
      return false;
    }

    // Detect ledge
    const ledge = this.detectLedge(playerPosition, playerForward, isGrounded);

    if (!ledge.found || !ledge.isLedgeGrab) {
      return false;
    }

    // Start ledge grab
    this.state = 'ledge_grabbing';
    this.phase = 'hanging';
    this.ledgeGrabProgress = 0;
    this.mantleStartPos = playerPosition.clone();
    this.ledgeInfo = ledge;

    // Calculate hang position (hands at ledge level, body hanging below)
    this.hangPosition = ledge.position.clone();
    this.hangPosition.y -= 1.0; // Hang with hands at ledge

    // Calculate target position (on top of ledge)
    const forward = playerForward.clone();
    forward.y = 0;
    forward.normalize();

    this.mantleTargetPos = ledge.position.clone();
    this.mantleTargetPos.y += 0.5; // Camera height offset
    this.mantleTargetPos.addInPlace(forward.scale(-0.3)); // Slightly back from edge

    // Play grab sound
    const audio = getAudioManager();
    audio.play('footstep', { volume: 0.5 });

    // Trigger callback
    this.onLedgeGrab?.();

    log.info(`Ledge grab at height ${ledge.height.toFixed(2)}m`);
    return true;
  }

  /**
   * Start pulling up from ledge grab
   */
  pullUp(): boolean {
    if (this.state !== 'ledge_grabbing') {
      return false;
    }

    this.state = 'pulling_up';
    this.phase = 'pullup';
    this.ledgeGrabProgress = 0;

    // Play pull-up sound
    const audio = getAudioManager();
    audio.play('footstep', { volume: 0.6 });

    // Trigger callback
    this.onLedgePullUp?.();

    log.info('Pulling up from ledge');
    return true;
  }

  /**
   * Drop from ledge grab
   */
  dropFromLedge(): void {
    if (this.state !== 'ledge_grabbing') {
      return;
    }

    this.state = 'cooldown';
    this.cooldownRemaining = this.config.mantleCooldown * 0.5;
    this.phase = 'complete';
    this.ledgeInfo = null;

    log.info('Dropped from ledge');
  }

  /**
   * Update the mantle system
   * Returns the player's interpolated position during mantling/ledge grab, or null if not active
   */
  update(deltaTime: number, isGrounded: boolean): Vector3 | null {
    // Update airborne time
    if (!isGrounded) {
      this.airborneTime += deltaTime;
    } else {
      this.airborneTime = 0;
    }

    // Update cooldown
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= deltaTime;
      if (this.cooldownRemaining <= 0) {
        this.cooldownRemaining = 0;
        if (this.state === 'cooldown') {
          this.state = 'idle';
        }
      }
    }

    // Process ledge grab state
    if (this.state === 'ledge_grabbing' && this.ledgeInfo) {
      // Player is hanging - return hang position
      return this.hangPosition.clone();
    }

    // Process pull-up animation
    if (this.state === 'pulling_up' && this.ledgeInfo) {
      this.ledgeGrabProgress += deltaTime / this.config.ledgeGrabPullUpDuration;

      if (this.ledgeGrabProgress >= 1.0) {
        // Pull-up complete
        this.ledgeGrabProgress = 1.0;
        this.state = 'cooldown';
        this.cooldownRemaining = this.config.mantleCooldown;
        this.phase = 'complete';

        // Play landing sound
        const audio = getAudioManager();
        audio.play('footstep', { volume: 0.5 });

        // Trigger callback
        this.onMantleComplete?.();

        log.info('Pull-up complete');
        return this.mantleTargetPos.clone();
      }

      // Smooth interpolation for pull-up
      const t = this.ledgeGrabProgress;
      const eased = 1 - Math.pow(1 - t, 2); // Ease out

      return Vector3.Lerp(this.hangPosition, this.mantleTargetPos, eased);
    }

    // Process mantling animation
    if (this.state !== 'mantling' || !this.ledgeInfo) {
      return null;
    }

    // Advance progress
    this.mantleProgress += deltaTime / this.config.mantleDuration;

    // Determine phase based on progress
    if (this.mantleProgress < 0.3) {
      this.phase = 'reach';
    } else if (this.mantleProgress < 0.7) {
      this.phase = 'pull';
    } else if (this.mantleProgress < 1.0) {
      this.phase = 'vault';
    } else {
      this.phase = 'complete';
    }

    // Trigger progress callback
    this.onMantleProgress?.(this.mantleProgress, this.phase);

    // Check completion
    if (this.mantleProgress >= 1.0) {
      this.mantleProgress = 1.0;
      this.state = 'cooldown';
      this.cooldownRemaining = this.config.mantleCooldown;

      // Play landing sound
      const audio = getAudioManager();
      audio.play('footstep', { volume: 0.5 });

      // Trigger callback
      this.onMantleComplete?.();

      log.info('Mantle complete');

      return this.mantleTargetPos.clone();
    }

    // Calculate interpolated position with easing
    // Use a smooth step curve for natural movement
    const t = this.mantleProgress;
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Three-phase movement:
    // 1. Reach phase (0-30%): Move forward and slightly up
    // 2. Pull phase (30-70%): Move mostly up, attach to wall
    // 3. Vault phase (70-100%): Move up and over the edge

    let position: Vector3;

    if (t < 0.3) {
      // Reach phase - move toward wall
      const phaseT = t / 0.3;
      const easedPhase = Math.sin(phaseT * Math.PI * 0.5);

      position = Vector3.Lerp(
        this.mantleStartPos,
        new Vector3(
          this.ledgeInfo.position.x,
          this.mantleStartPos.y + this.ledgeInfo.height * 0.2,
          this.ledgeInfo.position.z
        ),
        easedPhase * 0.5
      );
    } else if (t < 0.7) {
      // Pull phase - move up along the wall
      const phaseT = (t - 0.3) / 0.4;
      const easedPhase = Math.sin(phaseT * Math.PI * 0.5);

      const startY = this.mantleStartPos.y + this.ledgeInfo.height * 0.2;
      const targetY = this.ledgeInfo.position.y + 0.3;

      position = new Vector3(
        this.ledgeInfo.position.x,
        startY + (targetY - startY) * easedPhase,
        this.ledgeInfo.position.z
      );
    } else {
      // Vault phase - move over the edge
      const phaseT = (t - 0.7) / 0.3;
      const easedPhase = Math.sin(phaseT * Math.PI * 0.5);

      position = Vector3.Lerp(
        new Vector3(
          this.ledgeInfo.position.x,
          this.ledgeInfo.position.y + 0.3,
          this.ledgeInfo.position.z
        ),
        this.mantleTargetPos,
        easedPhase
      );
    }

    return position;
  }

  /**
   * Cancel an in-progress mantle or ledge grab (e.g., if player takes damage)
   */
  cancelMantle(): void {
    if (this.state === 'mantling' || this.state === 'ledge_grabbing' || this.state === 'pulling_up') {
      this.state = 'cooldown';
      this.cooldownRemaining = this.config.mantleCooldown * 0.5;
      this.mantleProgress = 0;
      this.ledgeGrabProgress = 0;
      this.phase = 'complete';
      log.info('Mantle/ledge grab cancelled');
    }
  }

  /**
   * Get camera animation data for the current mantle state
   * Returns rotation offsets for first-person camera effect
   */
  getCameraAnimation(): { pitchOffset: number; rollOffset: number } {
    if (this.state !== 'mantling') {
      return { pitchOffset: 0, rollOffset: 0 };
    }

    const t = this.mantleProgress;

    // During reach phase, look up slightly
    if (t < 0.3) {
      const phaseT = t / 0.3;
      return {
        pitchOffset: -0.2 * Math.sin(phaseT * Math.PI),
        rollOffset: 0,
      };
    }

    // During pull phase, tilt head forward
    if (t < 0.7) {
      const phaseT = (t - 0.3) / 0.4;
      return {
        pitchOffset: -0.15 + 0.3 * phaseT,
        rollOffset: 0.02 * Math.sin(phaseT * Math.PI),
      };
    }

    // During vault phase, level out
    const phaseT = (t - 0.7) / 0.3;
    return {
      pitchOffset: 0.15 * (1 - phaseT),
      rollOffset: 0.02 * Math.sin(phaseT * Math.PI * 0.5) * (1 - phaseT),
    };
  }

  /**
   * Get the ledge info for the current mantle attempt
   */
  getLedgeInfo(): LedgeInfo | null {
    return this.ledgeInfo;
  }

  /**
   * Reset the mantle system state
   */
  reset(): void {
    this.state = 'idle';
    this.phase = 'complete';
    this.mantleProgress = 0;
    this.ledgeGrabProgress = 0;
    this.cooldownRemaining = 0;
    this.airborneTime = 0;
    this.ledgeInfo = null;
  }

  /**
   * Dispose of the mantle system
   */
  dispose(): void {
    this.reset();
    this.ignoredMeshes.clear();
    this.scene = null;
    this.onMantleStart = null;
    this.onMantleComplete = null;
    this.onMantleProgress = null;
    this.onLedgeGrab = null;
    this.onLedgePullUp = null;
    log.info('Mantle system disposed');
  }
}

// Singleton instance
let mantleSystemInstance: MantleSystem | null = null;

/**
 * Get the singleton mantle system instance
 */
export function getMantleSystem(): MantleSystem {
  if (!mantleSystemInstance) {
    mantleSystemInstance = new MantleSystem();
  }
  return mantleSystemInstance;
}

/**
 * Dispose of the singleton mantle system
 */
export function disposeMantleSystem(): void {
  if (mantleSystemInstance) {
    mantleSystemInstance.dispose();
    mantleSystemInstance = null;
  }
}
