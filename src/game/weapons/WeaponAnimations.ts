/**
 * WeaponAnimations - First-person weapon animation system
 *
 * Manages all procedural weapon animations for the view model:
 * - Idle breathing sway
 * - Walk bob (sinusoidal)
 * - Sprint (lowered weapon + heavy bob)
 * - Fire recoil with recovery
 * - Reload drop-and-return
 * - Switch weapon lower/raise
 * - ADS transition (center + zoom)
 *
 * All animations are frame-rate-independent using delta time.
 * Outputs are position/rotation offsets that the view model system applies.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponId } from '../entities/weapons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Cumulative output applied each frame to the weapon transform. */
export interface WeaponAnimationOutput {
  positionOffset: Vector3;
  rotationOffset: Vector3;
  /** 0 = hip, 1 = fully aimed down sights */
  adsBlend: number;
}

/** Movement state fed into the animation system every frame. */
export interface WeaponMovementInput {
  isMoving: boolean;
  isSprinting: boolean;
  /** Horizontal speed magnitude (m/s). */
  speed: number;
  /** Vertical velocity (positive = up). */
  verticalVelocity: number;
  deltaTime: number;
}

/** Per-weapon tuning knobs. */
export interface WeaponAnimationProfile {
  /** Recoil kick distance (backward along local Z). */
  recoilKickBack: number;
  /** Recoil pitch (upward rotation in radians). */
  recoilPitchUp: number;
  /** Recoil recovery speed (units/s). */
  recoilRecoverySpeed: number;
  /** Seconds for reload drop/return animation. */
  reloadDuration: number;
  /** Seconds for weapon switch lower/raise half. */
  switchHalfDuration: number;
  /** Walk bob amplitude. */
  bobAmplitude: number;
  /** Walk bob frequency multiplier. */
  bobFrequency: number;
}

// ---------------------------------------------------------------------------
// Per-weapon profiles
// ---------------------------------------------------------------------------

const PROFILES: Record<WeaponId, WeaponAnimationProfile> = {
  assault_rifle: {
    recoilKickBack: 0.04,
    recoilPitchUp: 0.035,
    recoilRecoverySpeed: 6.0,
    reloadDuration: 2.0,
    switchHalfDuration: 0.25,
    bobAmplitude: 0.012,
    bobFrequency: 1.0,
  },
  pulse_smg: {
    recoilKickBack: 0.02,
    recoilPitchUp: 0.02,
    recoilRecoverySpeed: 10.0,
    reloadDuration: 1.5,
    switchHalfDuration: 0.2,
    bobAmplitude: 0.015,
    bobFrequency: 1.15,
  },
  plasma_cannon: {
    recoilKickBack: 0.08,
    recoilPitchUp: 0.06,
    recoilRecoverySpeed: 3.0,
    reloadDuration: 3.5,
    switchHalfDuration: 0.35,
    bobAmplitude: 0.008,
    bobFrequency: 0.85,
  },
};

export function getAnimationProfile(weaponId: WeaponId): WeaponAnimationProfile {
  return PROFILES[weaponId];
}

// ---------------------------------------------------------------------------
// Animation state machine
// ---------------------------------------------------------------------------

export type WeaponAnimState =
  | 'idle'
  | 'walking'
  | 'sprinting'
  | 'firing'
  | 'reloading'
  | 'switching'
  | 'ads_in'
  | 'ads_hold'
  | 'ads_out';

/**
 * Core animation controller.
 *
 * Call `update()` every frame with movement input; read `output` for
 * the resulting position/rotation offsets to apply to the view model.
 */
export class WeaponAnimationController {
  // Current output (mutated in-place each frame to avoid allocations).
  readonly output: WeaponAnimationOutput = {
    positionOffset: Vector3.Zero(),
    rotationOffset: Vector3.Zero(),
    adsBlend: 0,
  };

  private profile: WeaponAnimationProfile;

  // -- Idle / bob accumulators ------------------------------------------------
  private idleTime = 0;
  private bobTime = 0;

  // -- Recoil -----------------------------------------------------------------
  private recoilAmount = 0; // Current recoil magnitude [0..1]
  private recoilActive = false;

  // -- Reload -----------------------------------------------------------------
  private reloadTimer = 0;
  private reloadDuration = 0;
  private isReloading = false;
  private reloadCallback: (() => void) | null = null;

  // -- Switch -----------------------------------------------------------------
  private switchTimer = 0;
  private switchPhase: 'lower' | 'raise' | 'none' = 'none';
  private switchTotalHalf = 0;
  private switchCallback: (() => void) | null = null;

  // -- ADS --------------------------------------------------------------------
  private adsTarget = 0; // 0 or 1
  private adsCurrent = 0;
  private readonly adsSpeed = 6.0;

  constructor(weaponId: WeaponId) {
    this.profile = PROFILES[weaponId];
  }

  // -- Public API -------------------------------------------------------------

  /** Switch to a new weapon profile (e.g. after weapon switch completes). */
  setWeapon(weaponId: WeaponId): void {
    this.profile = PROFILES[weaponId];
  }

  /** Trigger a single fire recoil impulse. */
  triggerFire(): void {
    this.recoilAmount = 1.0;
    this.recoilActive = true;
  }

  /** Start the reload animation. `onComplete` fires when the animation finishes. */
  triggerReload(onComplete?: () => void): void {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadTimer = 0;
    this.reloadDuration = this.profile.reloadDuration;
    this.reloadCallback = onComplete ?? null;
    // Exit ADS when reloading
    this.setADS(false);
  }

  /** Cancel an in-progress reload animation. */
  cancelReload(): void {
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadCallback = null;
  }

  /**
   * Start weapon switch animation.
   * `onMidpoint` fires when the old weapon is fully lowered (swap mesh here).
   */
  triggerSwitch(onMidpoint?: () => void): void {
    this.switchPhase = 'lower';
    this.switchTimer = 0;
    this.switchTotalHalf = this.profile.switchHalfDuration;
    this.switchCallback = onMidpoint ?? null;
    // Exit ADS when switching
    this.setADS(false);
  }

  /** Set ADS state. */
  setADS(aiming: boolean): void {
    this.adsTarget = aiming ? 1 : 0;
  }

  /** True while a switch animation is playing. */
  get isSwitching(): boolean {
    return this.switchPhase !== 'none';
  }

  /** True while reload animation is playing. */
  get isReloadPlaying(): boolean {
    return this.isReloading;
  }

  // -- Frame update -----------------------------------------------------------

  update(input: WeaponMovementInput): void {
    const dt = input.deltaTime;
    const pos = this.output.positionOffset;
    const rot = this.output.rotationOffset;

    // Reset each frame
    pos.set(0, 0, 0);
    rot.set(0, 0, 0);

    // 1. Idle breathing sway (always active at low amplitude)
    this.updateIdle(dt, pos, rot);

    // 2. Walk / sprint bob
    if (input.isMoving) {
      this.updateBob(dt, input, pos, rot);
    } else {
      // Decay bob timer so the motion doesn't jump when stopping
      this.bobTime *= 0.9;
    }

    // 3. Sprint overlay (weapon drops down + extra tilt)
    if (input.isSprinting) {
      this.updateSprint(dt, pos, rot);
    }

    // 4. Fire recoil
    this.updateRecoil(dt, pos, rot);

    // 5. Reload animation
    if (this.isReloading) {
      this.updateReload(dt, pos, rot);
    }

    // 6. Switch animation
    if (this.switchPhase !== 'none') {
      this.updateSwitch(dt, pos, rot);
    }

    // 7. ADS blend
    this.updateADS(dt);
  }

  // -- Private animation layers -----------------------------------------------

  private updateIdle(dt: number, pos: Vector3, rot: Vector3): void {
    this.idleTime += dt;
    const t = this.idleTime;

    // Subtle breathing sway
    const breathX = Math.sin(t * 1.2) * 0.001;
    const breathY = Math.sin(t * 0.8) * 0.0015;
    const breathRotZ = Math.sin(t * 1.0) * 0.002;

    pos.x += breathX;
    pos.y += breathY;
    rot.z += breathRotZ;
  }

  private updateBob(dt: number, input: WeaponMovementInput, pos: Vector3, rot: Vector3): void {
    const freq = this.profile.bobFrequency;
    const amp = this.profile.bobAmplitude;
    const speedFactor = Math.min(input.speed / 5.0, 1.0);

    this.bobTime += dt * 8.0 * freq * speedFactor;
    const t = this.bobTime;

    // Horizontal bob (figure-8 pattern: x uses double frequency)
    const bobX = Math.sin(t * 2) * amp * 0.6 * speedFactor;
    // Vertical bob
    const bobY = Math.abs(Math.sin(t)) * amp * speedFactor;
    // Slight roll
    const bobRoll = Math.sin(t * 2) * 0.008 * speedFactor;

    pos.x += bobX;
    pos.y += bobY;
    rot.z += bobRoll;
  }

  private updateSprint(_dt: number, pos: Vector3, rot: Vector3): void {
    // Lower weapon and tilt forward during sprint
    pos.y -= 0.06;
    pos.z += 0.03;
    rot.x += 0.15; // Tilt barrel down

    // Intensify bob
    pos.x *= 1.8;
    pos.y *= 2.0;
    rot.z *= 2.5;
  }

  private updateRecoil(dt: number, pos: Vector3, rot: Vector3): void {
    if (!this.recoilActive && this.recoilAmount <= 0) return;

    if (this.recoilActive) {
      // Instant kick is applied in triggerFire via recoilAmount = 1
      this.recoilActive = false;
    }

    // Apply current recoil
    pos.z -= this.recoilAmount * this.profile.recoilKickBack;
    rot.x -= this.recoilAmount * this.profile.recoilPitchUp;

    // Small random horizontal jitter
    const jitter = (Math.random() - 0.5) * 0.005 * this.recoilAmount;
    rot.y += jitter;

    // Recover
    this.recoilAmount = Math.max(0, this.recoilAmount - dt * this.profile.recoilRecoverySpeed);
  }

  private updateReload(dt: number, pos: Vector3, rot: Vector3): void {
    this.reloadTimer += dt;
    const progress = Math.min(this.reloadTimer / this.reloadDuration, 1.0);

    // Animation curve: drop down (0-0.3), stay (0.3-0.7), rise (0.7-1.0)
    let dropAmount: number;
    if (progress < 0.3) {
      // Drop phase - ease out
      const t = progress / 0.3;
      dropAmount = t * t;
    } else if (progress < 0.7) {
      // Hold phase
      dropAmount = 1.0;
    } else {
      // Rise phase - ease in
      const t = (progress - 0.7) / 0.3;
      dropAmount = 1.0 - t * t;
    }

    pos.y -= dropAmount * 0.25;
    rot.x += dropAmount * 0.3;

    // Small tilt during magazine swap
    if (progress > 0.35 && progress < 0.65) {
      const swapT = (progress - 0.35) / 0.3;
      rot.z += Math.sin(swapT * Math.PI) * 0.1;
    }

    if (progress >= 1.0) {
      this.isReloading = false;
      this.reloadTimer = 0;
      this.reloadCallback?.();
      this.reloadCallback = null;
    }
  }

  private updateSwitch(dt: number, pos: Vector3, rot: Vector3): void {
    this.switchTimer += dt;

    if (this.switchPhase === 'lower') {
      const progress = Math.min(this.switchTimer / this.switchTotalHalf, 1.0);
      // Ease-in for lowering
      const ease = progress * progress;
      pos.y -= ease * 0.4;
      rot.x += ease * 0.5;

      if (progress >= 1.0) {
        // Midpoint: swap to new weapon mesh
        this.switchCallback?.();
        this.switchCallback = null;
        this.switchPhase = 'raise';
        this.switchTimer = 0;
      }
    } else if (this.switchPhase === 'raise') {
      const progress = Math.min(this.switchTimer / this.switchTotalHalf, 1.0);
      // Ease-out for raising
      const ease = 1.0 - (1.0 - progress) * (1.0 - progress);
      pos.y -= (1.0 - ease) * 0.4;
      rot.x += (1.0 - ease) * 0.5;

      if (progress >= 1.0) {
        this.switchPhase = 'none';
        this.switchTimer = 0;
      }
    }
  }

  private updateADS(dt: number): void {
    if (this.adsCurrent === this.adsTarget) {
      this.output.adsBlend = this.adsCurrent;
      return;
    }

    // Smooth interpolation toward target
    const direction = this.adsTarget > this.adsCurrent ? 1 : -1;
    this.adsCurrent += direction * this.adsSpeed * dt;
    this.adsCurrent = Math.max(0, Math.min(1, this.adsCurrent));

    // Snap when close enough
    if (Math.abs(this.adsCurrent - this.adsTarget) < 0.01) {
      this.adsCurrent = this.adsTarget;
    }

    this.output.adsBlend = this.adsCurrent;
  }

  // -- Cleanup ----------------------------------------------------------------

  dispose(): void {
    this.reloadCallback = null;
    this.switchCallback = null;
  }
}
