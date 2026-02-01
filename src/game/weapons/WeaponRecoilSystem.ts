/**
 * WeaponRecoilSystem - Comprehensive weapon recoil, screen shake, and camera effects
 *
 * Implements all aspects of "weapon juice" for visceral shooting feedback:
 * - Visual camera recoil (vertical + horizontal kick per weapon)
 * - Screen shake on firing (intensity varies by weapon type)
 * - Recovery animation back to center
 * - FOV punch on heavy weapons (shotgun, rocket, plasma)
 *
 * Inspired by: DOOM Eternal (aggressive), Halo (measured), CoD (snappy)
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import type { WeaponCategory, WeaponId } from '../entities/weapons';
import { WEAPONS } from '../entities/weapons';

const log = getLogger('WeaponRecoilSystem');

// ---------------------------------------------------------------------------
// Recoil Profile Configuration
// ---------------------------------------------------------------------------

/**
 * Per-weapon recoil and camera effects configuration.
 * These values create the "feel" of each weapon.
 */
export interface WeaponRecoilProfile {
  /** Vertical camera kick in degrees (upward) */
  recoilVertical: number;
  /** Maximum horizontal camera spread in degrees (random left/right) */
  recoilHorizontal: number;
  /** Speed of recovery back to center (degrees per second) */
  recoilRecovery: number;
  /** Screen shake intensity (0-1 scale, affects camera position jitter) */
  screenShakeIntensity: number;
  /** Screen shake duration in seconds */
  screenShakeDuration: number;
  /** FOV change on fire in degrees (positive = wider, creates impact feel) */
  fovPunch: number;
  /** FOV recovery speed (degrees per second) */
  fovRecovery: number;
  /** Chromatic aberration pulse on fire (0-1) */
  chromaticPulse: number;
}

// ---------------------------------------------------------------------------
// Category-based recoil defaults
// ---------------------------------------------------------------------------

const CATEGORY_RECOIL: Record<WeaponCategory, WeaponRecoilProfile> = {
  melee: {
    recoilVertical: 0, // No recoil for melee
    recoilHorizontal: 0,
    recoilRecovery: 10,
    screenShakeIntensity: 0.2, // Impact shake when hitting
    screenShakeDuration: 0.1,
    fovPunch: 0,
    fovRecovery: 30,
    chromaticPulse: 0,
  },
  sidearm: {
    recoilVertical: 2.5,
    recoilHorizontal: 0.8,
    recoilRecovery: 15,
    screenShakeIntensity: 0.15,
    screenShakeDuration: 0.08,
    fovPunch: 0,
    fovRecovery: 30,
    chromaticPulse: 0.05,
  },
  smg: {
    recoilVertical: 1.5,
    recoilHorizontal: 0.6,
    recoilRecovery: 20,
    screenShakeIntensity: 0.12,
    screenShakeDuration: 0.05,
    fovPunch: 0,
    fovRecovery: 30,
    chromaticPulse: 0.03,
  },
  rifle: {
    recoilVertical: 3.0,
    recoilHorizontal: 1.0,
    recoilRecovery: 12,
    screenShakeIntensity: 0.25,
    screenShakeDuration: 0.1,
    fovPunch: 1.5,
    fovRecovery: 25,
    chromaticPulse: 0.08,
  },
  marksman: {
    recoilVertical: 5.0,
    recoilHorizontal: 1.5,
    recoilRecovery: 8,
    screenShakeIntensity: 0.35,
    screenShakeDuration: 0.15,
    fovPunch: 3.0,
    fovRecovery: 20,
    chromaticPulse: 0.15,
  },
  shotgun: {
    recoilVertical: 6.0,
    recoilHorizontal: 2.0,
    recoilRecovery: 6,
    screenShakeIntensity: 0.5,
    screenShakeDuration: 0.18,
    fovPunch: 5.0,
    fovRecovery: 15,
    chromaticPulse: 0.2,
  },
  heavy: {
    recoilVertical: 4.0,
    recoilHorizontal: 1.8,
    recoilRecovery: 5,
    screenShakeIntensity: 0.6,
    screenShakeDuration: 0.2,
    fovPunch: 6.0,
    fovRecovery: 12,
    chromaticPulse: 0.25,
  },
  vehicle: {
    recoilVertical: 0, // No recoil for vehicle yoke
    recoilHorizontal: 0,
    recoilRecovery: 10,
    screenShakeIntensity: 0, // Vehicles handle their own shake
    screenShakeDuration: 0,
    fovPunch: 0,
    fovRecovery: 30,
    chromaticPulse: 0,
  },
};

// ---------------------------------------------------------------------------
// Per-weapon overrides for distinctive feel
// ---------------------------------------------------------------------------

const WEAPON_RECOIL_OVERRIDES: Partial<Record<WeaponId, Partial<WeaponRecoilProfile>>> = {
  // Revolver: heavy kick for a sidearm
  revolver: {
    recoilVertical: 5.0,
    recoilHorizontal: 1.5,
    recoilRecovery: 8,
    screenShakeIntensity: 0.35,
    fovPunch: 2.0,
  },

  // Heavy pistol: more punch than standard sidearm
  heavy_pistol: {
    recoilVertical: 3.5,
    recoilHorizontal: 1.0,
    recoilRecovery: 12,
    screenShakeIntensity: 0.2,
    fovPunch: 0.5,
  },

  // Pulse SMG: very low recoil, futuristic feel
  pulse_smg: {
    recoilVertical: 1.0,
    recoilHorizontal: 0.4,
    recoilRecovery: 25,
    screenShakeIntensity: 0.08,
  },

  // Battle rifle: heavier than assault rifle
  battle_rifle: {
    recoilVertical: 4.0,
    recoilHorizontal: 1.2,
    recoilRecovery: 10,
    screenShakeIntensity: 0.3,
    fovPunch: 2.0,
  },

  // Sniper: massive single-shot recoil
  sniper_rifle: {
    recoilVertical: 8.0,
    recoilHorizontal: 2.0,
    recoilRecovery: 5,
    screenShakeIntensity: 0.45,
    screenShakeDuration: 0.2,
    fovPunch: 4.0,
    chromaticPulse: 0.2,
  },

  // DMR: balanced precision recoil
  dmr: {
    recoilVertical: 4.5,
    recoilHorizontal: 1.0,
    recoilRecovery: 10,
    screenShakeIntensity: 0.3,
    fovPunch: 2.0,
  },

  // Double barrel: extreme close-range impact
  double_barrel: {
    recoilVertical: 9.0,
    recoilHorizontal: 3.0,
    recoilRecovery: 4,
    screenShakeIntensity: 0.7,
    screenShakeDuration: 0.25,
    fovPunch: 8.0,
    chromaticPulse: 0.35,
  },

  // Auto shotgun: less per-shot than double barrel
  auto_shotgun: {
    recoilVertical: 5.0,
    recoilHorizontal: 1.5,
    recoilRecovery: 8,
    screenShakeIntensity: 0.4,
    fovPunch: 4.0,
  },

  // Plasma cannon: unique energy weapon feel
  plasma_cannon: {
    recoilVertical: 3.5,
    recoilHorizontal: 1.0,
    recoilRecovery: 7,
    screenShakeIntensity: 0.55,
    screenShakeDuration: 0.22,
    fovPunch: 7.0,
    chromaticPulse: 0.4, // Energy weapons get more chromatic aberration
  },

  // SAW LMG: sustained fire, low per-shot recoil
  saw_lmg: {
    recoilVertical: 1.8,
    recoilHorizontal: 0.8,
    recoilRecovery: 18,
    screenShakeIntensity: 0.2,
    fovPunch: 0.5,
  },

  // Heavy LMG: more recoil than SAW
  heavy_lmg: {
    recoilVertical: 2.5,
    recoilHorizontal: 1.2,
    recoilRecovery: 12,
    screenShakeIntensity: 0.3,
    fovPunch: 1.5,
  },
};

// ---------------------------------------------------------------------------
// Profile resolution
// ---------------------------------------------------------------------------

/**
 * Get the recoil profile for a weapon.
 * Merges category defaults with any per-weapon overrides.
 */
export function getRecoilProfile(weaponId: WeaponId): WeaponRecoilProfile {
  const def = WEAPONS[weaponId];
  const base = CATEGORY_RECOIL[def?.category ?? 'rifle'];
  const overrides = WEAPON_RECOIL_OVERRIDES[weaponId];
  if (!overrides) return { ...base };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Active recoil state
// ---------------------------------------------------------------------------

interface RecoilState {
  /** Current vertical recoil offset in degrees */
  verticalOffset: number;
  /** Current horizontal recoil offset in degrees */
  horizontalOffset: number;
  /** Target vertical offset (for recovery) */
  targetVertical: number;
  /** Target horizontal offset (for recovery) */
  targetHorizontal: number;
}

interface ScreenShakeState {
  /** Remaining shake duration */
  duration: number;
  /** Current shake intensity */
  intensity: number;
  /** Current offset vector */
  offset: Vector3;
  /** Shake frequency (Hz) */
  frequency: number;
  /** Phase accumulator */
  phase: number;
}

interface FOVPunchState {
  /** Current FOV offset in degrees */
  currentOffset: number;
  /** Target FOV offset (for recovery) */
  targetOffset: number;
  /** Recovery speed */
  recoverySpeed: number;
}

interface ChromaticState {
  /** Current chromatic aberration intensity */
  current: number;
  /** Target intensity (usually 0) */
  target: number;
  /** Decay speed */
  decay: number;
}

// ---------------------------------------------------------------------------
// Main Recoil System
// ---------------------------------------------------------------------------

/**
 * WeaponRecoilSystem - Manages camera recoil, screen shake, and FOV effects.
 *
 * Singleton that coordinates all weapon-fired camera effects.
 * Must be updated every frame via `update()`.
 */
export class WeaponRecoilSystem {
  private static instance: WeaponRecoilSystem | null = null;
  private camera: FreeCamera | null = null;

  // State
  private recoilState: RecoilState = {
    verticalOffset: 0,
    horizontalOffset: 0,
    targetVertical: 0,
    targetHorizontal: 0,
  };

  private shakeState: ScreenShakeState = {
    duration: 0,
    intensity: 0,
    offset: Vector3.Zero(),
    frequency: 30,
    phase: 0,
  };

  private fovState: FOVPunchState = {
    currentOffset: 0,
    targetOffset: 0,
    recoverySpeed: 30,
  };

  private chromaticState: ChromaticState = {
    current: 0,
    target: 0,
    decay: 10,
  };

  // Original camera values for restoration
  private baseFOV: number = 1.0; // radians

  // Current profile
  private currentProfile: WeaponRecoilProfile | null = null;

  // ADS reduces recoil
  private adsBlend: number = 0;

  private constructor() {}

  static getInstance(): WeaponRecoilSystem {
    if (!WeaponRecoilSystem.instance) {
      WeaponRecoilSystem.instance = new WeaponRecoilSystem();
    }
    return WeaponRecoilSystem.instance;
  }

  // -- Lifecycle --------------------------------------------------------------

  /**
   * Initialize the system with scene and camera.
   */
  init(scene: Scene, camera: Camera): void {
    this.scene = scene;
    this.camera = camera as FreeCamera;

    // Store base FOV
    if ('fov' in camera) {
      this.baseFOV = (camera as FreeCamera).fov;
    }

    log.info('Initialized');
  }

  /**
   * Set the current weapon for recoil profile.
   */
  setWeapon(weaponId: WeaponId): void {
    this.currentWeaponId = weaponId;
    this.currentProfile = getRecoilProfile(weaponId);
  }

  /**
   * Set ADS blend for recoil reduction.
   * @param blend 0 = hip fire, 1 = fully aimed
   */
  setADSBlend(blend: number): void {
    this.adsBlend = Math.max(0, Math.min(1, blend));
  }

  // -- Fire Events ------------------------------------------------------------

  /**
   * Trigger all weapon fire effects (recoil, shake, FOV punch).
   * Call this when the weapon fires.
   */
  triggerFire(): void {
    if (!this.currentProfile) return;

    const profile = this.currentProfile;

    // ADS reduces recoil by 50%
    const adsReduction = 1.0 - this.adsBlend * 0.5;

    // Apply vertical recoil (always upward)
    const verticalKick = profile.recoilVertical * adsReduction;
    this.recoilState.verticalOffset += verticalKick;
    this.recoilState.targetVertical = 0; // Will recover to center

    // Apply horizontal recoil (random left/right)
    const horizontalKick = (Math.random() - 0.5) * 2 * profile.recoilHorizontal * adsReduction;
    this.recoilState.horizontalOffset += horizontalKick;
    this.recoilState.targetHorizontal = 0;

    // Trigger screen shake
    this.triggerScreenShake(
      profile.screenShakeIntensity * adsReduction,
      profile.screenShakeDuration
    );

    // Trigger FOV punch (only for heavy weapons or if significant)
    if (profile.fovPunch > 0) {
      this.triggerFOVPunch(profile.fovPunch * adsReduction, profile.fovRecovery);
    }

    // Trigger chromatic aberration pulse
    if (profile.chromaticPulse > 0) {
      this.chromaticState.current = Math.max(
        this.chromaticState.current,
        profile.chromaticPulse * adsReduction
      );
    }
  }

  /**
   * Trigger screen shake (can also be called externally for explosions, etc.)
   */
  triggerScreenShake(intensity: number, duration: number): void {
    // Stack with existing shake
    this.shakeState.intensity = Math.max(this.shakeState.intensity, intensity);
    this.shakeState.duration = Math.max(this.shakeState.duration, duration);
    this.shakeState.phase = 0;
  }

  /**
   * Trigger FOV punch effect.
   */
  private triggerFOVPunch(punch: number, recoverySpeed: number): void {
    // Add to current FOV offset (allows stacking for rapid fire)
    this.fovState.currentOffset = Math.min(
      this.fovState.currentOffset + punch,
      15 // Cap at 15 degrees max FOV change
    );
    this.fovState.targetOffset = 0;
    this.fovState.recoverySpeed = recoverySpeed;
  }

  // -- Frame Update -----------------------------------------------------------

  /**
   * Update all effects - call every frame.
   * Returns current chromatic aberration intensity for PostProcessManager.
   */
  update(deltaTime: number): { chromaticIntensity: number } {
    if (!this.camera || !this.currentProfile) {
      return { chromaticIntensity: 0 };
    }

    // Update each effect system
    this.updateRecoil(deltaTime);
    this.updateScreenShake(deltaTime);
    this.updateFOVPunch(deltaTime);
    this.updateChromatic(deltaTime);

    // Apply effects to camera
    this.applyCameraEffects();

    return { chromaticIntensity: this.chromaticState.current };
  }

  private updateRecoil(dt: number): void {
    const profile = this.currentProfile!;
    const recoveryRate = profile.recoilRecovery * dt;

    // Recover vertical recoil toward target
    if (Math.abs(this.recoilState.verticalOffset - this.recoilState.targetVertical) > 0.01) {
      const diff = this.recoilState.targetVertical - this.recoilState.verticalOffset;
      const recovery = Math.sign(diff) * Math.min(Math.abs(diff), recoveryRate);
      this.recoilState.verticalOffset += recovery;
    } else {
      this.recoilState.verticalOffset = this.recoilState.targetVertical;
    }

    // Recover horizontal recoil toward target
    if (Math.abs(this.recoilState.horizontalOffset - this.recoilState.targetHorizontal) > 0.01) {
      const diff = this.recoilState.targetHorizontal - this.recoilState.horizontalOffset;
      const recovery = Math.sign(diff) * Math.min(Math.abs(diff), recoveryRate * 1.5); // Horizontal recovers faster
      this.recoilState.horizontalOffset += recovery;
    } else {
      this.recoilState.horizontalOffset = this.recoilState.targetHorizontal;
    }
  }

  private updateScreenShake(dt: number): void {
    if (this.shakeState.duration <= 0) {
      this.shakeState.offset.set(0, 0, 0);
      this.shakeState.intensity = 0;
      return;
    }

    // Decrease duration
    this.shakeState.duration -= dt;

    // Update phase
    this.shakeState.phase += dt * this.shakeState.frequency * Math.PI * 2;

    // Calculate shake offset using Perlin-like noise simulation
    const decayFactor = Math.min(1, this.shakeState.duration * 5); // Quick decay at end
    const intensity = this.shakeState.intensity * decayFactor;

    // Use multiple sine waves for more organic feel
    const offsetX =
      Math.sin(this.shakeState.phase) * 0.7 + Math.sin(this.shakeState.phase * 2.3) * 0.3;

    const offsetY =
      Math.cos(this.shakeState.phase * 1.1) * 0.6 + Math.sin(this.shakeState.phase * 1.7) * 0.4;

    const offsetZ = Math.sin(this.shakeState.phase * 0.7) * 0.3;

    // Scale offset by intensity (intensity 1.0 = 0.02 units max displacement)
    const scale = intensity * 0.02;
    this.shakeState.offset.set(offsetX * scale, offsetY * scale, offsetZ * scale * 0.5);
  }

  private updateFOVPunch(dt: number): void {
    if (Math.abs(this.fovState.currentOffset - this.fovState.targetOffset) > 0.1) {
      // Ease back to target
      const diff = this.fovState.targetOffset - this.fovState.currentOffset;
      const recovery = diff * Math.min(1, dt * this.fovState.recoverySpeed);
      this.fovState.currentOffset += recovery;
    } else {
      this.fovState.currentOffset = this.fovState.targetOffset;
    }
  }

  private updateChromatic(dt: number): void {
    // Decay chromatic aberration
    if (this.chromaticState.current > this.chromaticState.target) {
      this.chromaticState.current = Math.max(
        this.chromaticState.target,
        this.chromaticState.current - this.chromaticState.decay * dt
      );
    }
  }

  private applyCameraEffects(): void {
    if (!this.camera) return;

    // Convert degrees to radians for camera rotation
    const DEG_TO_RAD = Math.PI / 180;

    // Apply recoil to camera rotation
    // Note: We modify the camera's rotation directly
    // In a more sophisticated system, this would be layered on top of player input
    const verticalRad = this.recoilState.verticalOffset * DEG_TO_RAD;
    const horizontalRad = this.recoilState.horizontalOffset * DEG_TO_RAD;

    // Store as output for external systems to read
    // The actual camera modification should be done by the player controller
    // to avoid fighting with input handling
    this._currentRecoilOutput.x = -verticalRad; // Negative = look up in Babylon
    this._currentRecoilOutput.y = horizontalRad;

    // Apply screen shake offset to camera position
    // This is additive and doesn't affect the camera's actual position permanently
    this._currentShakeOutput.copyFrom(this.shakeState.offset);

    // Apply FOV punch
    if ('fov' in this.camera) {
      const fovRad = this.fovState.currentOffset * DEG_TO_RAD;
      (this.camera as FreeCamera).fov = this.baseFOV + fovRad;
    }
  }

  // -- Output for external systems --------------------------------------------

  private _currentRecoilOutput = new Vector3();
  private _currentShakeOutput = new Vector3();

  /**
   * Get current recoil rotation offset (radians).
   * X = pitch (vertical), Y = yaw (horizontal)
   */
  get recoilRotation(): Vector3 {
    return this._currentRecoilOutput;
  }

  /**
   * Get current screen shake position offset.
   */
  get shakeOffset(): Vector3 {
    return this._currentShakeOutput;
  }

  /**
   * Get current FOV offset in radians.
   */
  get fovOffset(): number {
    return this.fovState.currentOffset * (Math.PI / 180);
  }

  /**
   * Get current chromatic aberration intensity (0-1).
   */
  get chromaticAberration(): number {
    return this.chromaticState.current;
  }

  /**
   * Get whether any effects are currently active.
   */
  get isActive(): boolean {
    return (
      Math.abs(this.recoilState.verticalOffset) > 0.01 ||
      Math.abs(this.recoilState.horizontalOffset) > 0.01 ||
      this.shakeState.duration > 0 ||
      Math.abs(this.fovState.currentOffset) > 0.1 ||
      this.chromaticState.current > 0.01
    );
  }

  // -- Cleanup ----------------------------------------------------------------

  /**
   * Reset all effects to neutral.
   */
  reset(): void {
    this.recoilState = {
      verticalOffset: 0,
      horizontalOffset: 0,
      targetVertical: 0,
      targetHorizontal: 0,
    };

    this.shakeState = {
      duration: 0,
      intensity: 0,
      offset: Vector3.Zero(),
      frequency: 30,
      phase: 0,
    };

    this.fovState = {
      currentOffset: 0,
      targetOffset: 0,
      recoverySpeed: 30,
    };

    this.chromaticState = {
      current: 0,
      target: 0,
      decay: 10,
    };

    // Restore base FOV
    if (this.camera && 'fov' in this.camera) {
      (this.camera as FreeCamera).fov = this.baseFOV;
    }
  }

  dispose(): void {
    this.reset();
    this.scene = null;
    this.camera = null;
    this.currentProfile = null;
    this.currentWeaponId = null;
    WeaponRecoilSystem.instance = null;
    log.info('Disposed');
  }
}

// Export singleton accessor
export const weaponRecoilSystem = WeaponRecoilSystem.getInstance();
