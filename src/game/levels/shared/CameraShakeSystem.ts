/**
 * CameraShakeSystem - Composable camera shake for FPS levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Provides screen shake effects for explosions, damage, footsteps, etc.
 *
 * Usage:
 *   const shakeSystem = new CameraShakeSystem(camera);
 *   shakeSystem.addShake(5.0); // explosion
 *   shakeSystem.update(deltaTime); // call each frame
 */

import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';

/**
 * Configuration for camera shake effects.
 * Intensity values are approximate:
 * - 1-2: Light (minor damage, footsteps)
 * - 3-4: Medium (taking damage, nearby impacts)
 * - 5-6: Heavy (explosions, grenades)
 * - 7-10: Extreme (boss attacks, massive explosions)
 */
export interface CameraShakeConfig {
  /** Current shake intensity (decays over time) */
  intensity: number;
  /** Decay rate per frame (0.9 = fast decay, 0.95 = slow decay) */
  decayRate: number;
  /** Minimum intensity before shake stops */
  minIntensity: number;
  /** Base/ambient shake (doesn't decay, useful for rumbles) */
  baseShake: number;
  /** Shake translation multiplier (how much camera moves in X/Y) */
  translationScale: number;
  /** Shake rotation multiplier (how much camera rotates) */
  rotationScale: number;
}

const DEFAULT_CONFIG: CameraShakeConfig = {
  intensity: 0,
  decayRate: 0.9,
  minIntensity: 0.1,
  baseShake: 0,
  translationScale: 0.02,
  rotationScale: 0.015,
};

export class CameraShakeSystem {
  private camera: UniversalCamera;
  private config: CameraShakeConfig;
  private enabled = true;
  private intensityMultiplier = 1.0;

  // Store original camera values to restore
  private baseRotationX = 0;
  private baseRotationY = 0;

  constructor(camera: UniversalCamera, config: Partial<CameraShakeConfig> = {}) {
    this.camera = camera;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the base rotation values (from player look input).
   * Shake is applied on top of these values.
   */
  setBaseRotation(rotationX: number, rotationY: number): void {
    this.baseRotationX = rotationX;
    this.baseRotationY = rotationY;
  }

  /**
   * Add shake intensity (additive with current shake)
   */
  addShake(intensity: number): void {
    if (!this.enabled) return;
    this.config.intensity = Math.min(10, this.config.intensity + intensity * this.intensityMultiplier);
  }

  /**
   * Set base/ambient shake (doesn't decay)
   */
  setBaseShake(intensity: number): void {
    this.config.baseShake = intensity;
  }

  /**
   * Enable/disable shake effects
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.config.intensity = 0;
      this.config.baseShake = 0;
    }
  }

  /**
   * Set intensity multiplier (e.g., from settings)
   */
  setIntensityMultiplier(multiplier: number): void {
    this.intensityMultiplier = Math.max(0, Math.min(2, multiplier));
  }

  /**
   * Update shake and apply to camera. Call each frame.
   */
  update(_deltaTime: number): void {
    if (!this.enabled) return;

    const totalShake = this.config.intensity + this.config.baseShake;

    if (totalShake > this.config.minIntensity) {
      // Random shake offsets
      const shakeX = (Math.random() - 0.5) * totalShake * this.config.translationScale;
      const shakeY = (Math.random() - 0.5) * totalShake * this.config.translationScale;
      const shakeRotX = (Math.random() - 0.5) * totalShake * this.config.rotationScale;
      const shakeRotY = (Math.random() - 0.5) * totalShake * this.config.rotationScale;

      // Apply shake on top of base rotation
      this.camera.rotation.x = this.baseRotationX + shakeRotX;
      this.camera.rotation.y = this.baseRotationY + shakeRotY;

      // Apply position shake
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
    }

    // Decay intensity
    if (this.config.intensity > this.config.minIntensity) {
      this.config.intensity *= this.config.decayRate;
      if (this.config.intensity < this.config.minIntensity) {
        this.config.intensity = 0;
      }
    }
  }

  /**
   * Get current effective shake intensity
   */
  getIntensity(): number {
    return this.config.intensity + this.config.baseShake;
  }

  /**
   * Reset all shake
   */
  reset(): void {
    this.config.intensity = 0;
    this.config.baseShake = 0;
  }

  dispose(): void {
    this.reset();
  }
}
