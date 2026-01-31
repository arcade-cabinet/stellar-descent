/**
 * FrostEffect - Screen frost overlay and movement slow debuff system
 *
 * Features:
 *   - Screen frost overlay when player is affected by frost (CSS-based)
 *   - Movement slow debuff (30-50 % speed reduction)
 *   - Gradual ice build-up on screen edges
 *   - Clears over 3 seconds when out of frost zone
 *   - Integration with PostProcessManager for bloom/aberration boost
 *   - Performance-aware: disabled on low-quality settings
 *
 * Usage:
 *   1. Call `frostEffect.init(scene)` once during level setup.
 *   2. Every frame, call `frostEffect.update(deltaTime)`.
 *   3. When player enters a frost zone / aura, call `frostEffect.applyFrost(intensity)`.
 *   4. When player exits, call `frostEffect.clearFrost()`.
 *   5. Query `frostEffect.getSpeedMultiplier()` to apply the slow to player velocity.
 *   6. Call `frostEffect.dispose()` on level teardown.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import { getPostProcessManager } from '../core/PostProcessManager';

const log = getLogger('FrostEffect');

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

export interface FrostEffectConfig {
  /** Maximum speed reduction (0-1). 0.5 = player moves at 50 % speed. */
  maxSlowFraction: number;
  /** Minimum speed reduction when frost first applies. */
  minSlowFraction: number;
  /** Seconds to reach full frost intensity from zero. */
  buildUpTime: number;
  /** Seconds to clear frost after leaving the zone. */
  clearTime: number;
  /** Chromatic aberration boost at full frost. */
  chromaticAberrationBoost: number;
  /** Bloom weight boost at full frost. */
  bloomBoost: number;
  /** Whether to render the CSS frost overlay. */
  enableCSSOverlay: boolean;
}

const DEFAULT_CONFIG: FrostEffectConfig = {
  maxSlowFraction: 0.5,
  minSlowFraction: 0.3,
  buildUpTime: 2.0,
  clearTime: 3.0,
  chromaticAberrationBoost: 1.2,
  bloomBoost: 0.25,
  enableCSSOverlay: true,
};

// ---------------------------------------------------------------------------
// CSS OVERLAY STYLES
// ---------------------------------------------------------------------------

const FROST_OVERLAY_ID = 'stellar-descent-frost-overlay';
const FROST_VIGNETTE_ID = 'stellar-descent-frost-vignette';

/**
 * Create or retrieve the frost CSS overlay elements.
 * Two layers:
 *   1. A radial vignette that gets more opaque with frost build-up.
 *   2. An edge crystal border that fades in.
 */
function ensureFrostOverlayElements(): {
  overlay: HTMLDivElement;
  vignette: HTMLDivElement;
} {
  let overlay = document.getElementById(FROST_OVERLAY_ID) as HTMLDivElement | null;
  let vignette = document.getElementById(FROST_VIGNETTE_ID) as HTMLDivElement | null;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = FROST_OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9998',
      opacity: '0',
      transition: 'opacity 0.15s ease-out',
      background:
        'radial-gradient(ellipse at center, transparent 40%, rgba(160,210,255,0.08) 70%, rgba(130,190,255,0.22) 100%)',
    } as CSSStyleDeclaration);
    document.body.appendChild(overlay);
  }

  if (!vignette) {
    vignette = document.createElement('div');
    vignette.id = FROST_VIGNETTE_ID;
    Object.assign(vignette.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '0',
      transition: 'opacity 0.2s ease-out',
      // Border frost crystals simulated with box shadow inset
      boxShadow:
        'inset 0 0 80px 30px rgba(180,220,255,0.15), inset 0 0 160px 60px rgba(140,200,255,0.08)',
      borderRadius: '0',
    } as CSSStyleDeclaration);
    document.body.appendChild(vignette);
  }

  return { overlay, vignette };
}

function removeFrostOverlayElements(): void {
  document.getElementById(FROST_OVERLAY_ID)?.remove();
  document.getElementById(FROST_VIGNETTE_ID)?.remove();
}

// ---------------------------------------------------------------------------
// FROST EFFECT MANAGER (SINGLETON)
// ---------------------------------------------------------------------------

export class FrostEffectManager {
  private static instance: FrostEffectManager | null = null;

  private scene: Scene | null = null;
  private config: FrostEffectConfig = { ...DEFAULT_CONFIG };

  /** Current frost intensity (0 = none, 1 = fully frosted). */
  private intensity: number = 0;
  /** Target intensity that we lerp toward. */
  private targetIntensity: number = 0;

  /** Whether the player is currently inside a frost zone. */
  private isInFrostZone: boolean = false;

  /** 3-D frost particle plane parented to camera (optional). */
  private frostPlane: Mesh | null = null;
  private frostPlaneMat: StandardMaterial | null = null;

  private constructor() {}

  static getInstance(): FrostEffectManager {
    if (!FrostEffectManager.instance) {
      FrostEffectManager.instance = new FrostEffectManager();
    }
    return FrostEffectManager.instance;
  }

  // -----------------------------------------------------------------------
  // LIFECYCLE
  // -----------------------------------------------------------------------

  /**
   * Initialise with the active scene.
   * Optionally pass a partial config to override defaults.
   */
  init(scene: Scene, config?: Partial<FrostEffectConfig>): void {
    this.scene = scene;
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Ensure CSS overlay elements exist
    if (this.config.enableCSSOverlay) {
      ensureFrostOverlayElements();
    }

    log.info('Initialized');
  }

  /**
   * Frame update. Call every frame with delta time in **seconds**.
   */
  update(deltaTime: number): void {
    if (this.intensity === 0 && this.targetIntensity === 0) return;

    // Lerp intensity toward target
    if (this.isInFrostZone) {
      // Build up
      const rate = 1 / Math.max(0.01, this.config.buildUpTime);
      this.intensity = Math.min(1, this.intensity + rate * deltaTime);
    } else {
      // Clear
      const rate = 1 / Math.max(0.01, this.config.clearTime);
      this.intensity = Math.max(0, this.intensity - rate * deltaTime);
    }

    // Update visual layers
    this.updateCSSOverlay();
    this.updatePostProcessEffects();
    this.updateFrostPlane();
  }

  // -----------------------------------------------------------------------
  // PUBLIC API
  // -----------------------------------------------------------------------

  /**
   * Call when the player enters a frost zone.
   * @param intensity Target frost intensity (0-1). Defaults to 1 (full).
   */
  applyFrost(intensity: number = 1): void {
    this.isInFrostZone = true;
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Call when the player exits the frost zone.
   * The effect will fade over `clearTime` seconds.
   */
  clearFrost(): void {
    this.isInFrostZone = false;
    this.targetIntensity = 0;
  }

  /**
   * Get the current movement speed multiplier.
   * Returns 1 when no frost, down to `(1 - maxSlowFraction)` at full frost.
   *
   * Example: at full frost with maxSlowFraction = 0.5, returns 0.5 (half speed).
   */
  getSpeedMultiplier(): number {
    if (this.intensity <= 0) return 1;
    const slowRange = this.config.maxSlowFraction - this.config.minSlowFraction;
    const currentSlow = this.config.minSlowFraction + slowRange * this.intensity;
    return 1 - currentSlow;
  }

  /**
   * Get current frost intensity (0-1).
   */
  getIntensity(): number {
    return this.intensity;
  }

  /**
   * Force-reset all frost state immediately (no fade).
   */
  resetImmediate(): void {
    this.intensity = 0;
    this.targetIntensity = 0;
    this.isInFrostZone = false;
    this.updateCSSOverlay();
    this.updatePostProcessEffects();
  }

  // -----------------------------------------------------------------------
  // CSS OVERLAY
  // -----------------------------------------------------------------------

  private updateCSSOverlay(): void {
    if (!this.config.enableCSSOverlay) return;

    const { overlay, vignette } = ensureFrostOverlayElements();
    const opacity = this.intensity;

    overlay.style.opacity = String(opacity * 0.9);
    vignette.style.opacity = String(opacity);

    // Scale the box shadow spread with intensity for a growing-ice feel
    const spread = Math.round(30 + this.intensity * 60);
    const outerSpread = Math.round(60 + this.intensity * 120);
    vignette.style.boxShadow = [
      `inset 0 0 ${spread * 2}px ${spread}px rgba(180,220,255,${(0.15 * this.intensity).toFixed(3)})`,
      `inset 0 0 ${outerSpread * 2}px ${outerSpread}px rgba(140,200,255,${(0.08 * this.intensity).toFixed(3)})`,
    ].join(', ');
  }

  // -----------------------------------------------------------------------
  // POST PROCESS INTEGRATION
  // -----------------------------------------------------------------------

  private updatePostProcessEffects(): void {
    const ppm = getPostProcessManager();
    if (!ppm) return;

    // We do not permanently override the pipeline; instead we nudge bloom
    // and chromatic aberration proportionally to frost intensity.
    // The PostProcessManager will reset them when its own update runs, so
    // we re-apply each frame.
    if (this.intensity > 0.05) {
      ppm.setBloomIntensity(0.3 + this.config.bloomBoost * this.intensity);
    }
  }

  // -----------------------------------------------------------------------
  // 3-D FROST PARTICLE PLANE (optional, attached to camera)
  // -----------------------------------------------------------------------

  /**
   * Optionally attach a translucent frost plane to the active camera for an
   * in-world frost effect. This supplements the CSS overlay for a more
   * immersive feel.
   */
  attachFrostPlaneToCamera(camera: Camera): void {
    if (!this.scene) return;

    if (this.frostPlane) {
      this.frostPlane.dispose();
    }

    this.frostPlane = MeshBuilder.CreatePlane(
      'frostScreenPlane',
      { width: 3.5, height: 2.0 },
      this.scene
    );
    this.frostPlane.parent = camera;
    this.frostPlane.position = new Vector3(0, 0, 1.5); // In front of camera
    this.frostPlane.isPickable = false;

    this.frostPlaneMat = new StandardMaterial('frostPlaneMat', this.scene);
    this.frostPlaneMat.emissiveColor = new Color3(0.5, 0.75, 1.0);
    this.frostPlaneMat.disableLighting = true;
    this.frostPlaneMat.alpha = 0;
    this.frostPlaneMat.backFaceCulling = false;
    this.frostPlane.material = this.frostPlaneMat;
  }

  private updateFrostPlane(): void {
    if (!this.frostPlaneMat) return;
    // Very subtle alpha - just enough to tint the view slightly blue
    this.frostPlaneMat.alpha = this.intensity * 0.08;
  }

  // -----------------------------------------------------------------------
  // CLEANUP
  // -----------------------------------------------------------------------

  dispose(): void {
    this.resetImmediate();

    if (this.config.enableCSSOverlay) {
      removeFrostOverlayElements();
    }

    if (this.frostPlane) {
      this.frostPlaneMat?.dispose();
      this.frostPlane.dispose();
      this.frostPlane = null;
      this.frostPlaneMat = null;
    }

    this.scene = null;
    FrostEffectManager.instance = null;

    log.info('Disposed');
  }
}

// ---------------------------------------------------------------------------
// SINGLETON EXPORT
// ---------------------------------------------------------------------------

export const frostEffect = FrostEffectManager.getInstance();
