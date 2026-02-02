/**
 * PostProcessManager - Handles all visual post-processing effects
 *
 * Features:
 * - Bloom effect with HDR-like glow (threshold 0.8, intensity 0.5 default, 1.5 during explosions)
 * - Chromatic aberration (subtle 0.002 at edges, 0.01 during damage, pulse on low health)
 * - Vignette (default 0.3 darkening, red tinted on damage, pulsing on low health)
 * - Film grain (0.05 intensity for grit, disable option in settings)
 * - Level-specific color grading (station=blue, surface=orange, hive=green, ice=deep blue)
 * - Motion blur (0.3 samples, only during fast movement, disabled when aiming)
 * - Damage flash (red screen edge, 0.15s duration, intensity based on damage)
 * - Screen shake integration (weapon fire, explosions, boss attacks)
 * - Combat desaturation for intense moments
 * - Performance-aware quality settings with mobile optimization
 * - Depth of field for dramatic moments
 *
 * Uses BabylonJS DefaultRenderingPipeline for optimal performance.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { DepthOfFieldEffectBlurLevel } from '@babylonjs/core/PostProcesses/depthOfFieldEffect';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import type { Scene } from '@babylonjs/core/scene';
import type { LevelType } from '../levels/types';
import { getLogger } from './Logger';

const log = getLogger('PostProcessManager');

// Side effect imports for post-processing pipeline
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';

// Side effect imports for individual post-process shaders
// These must be imported to ensure shaders are bundled and registered in Effect.ShadersStore
// Without these, BabylonJS attempts dynamic imports which may fail with SPA routing

// Core shaders used by DefaultRenderingPipeline
import '@babylonjs/core/Shaders/chromaticAberration.fragment';
import '@babylonjs/core/Shaders/grain.fragment';
import '@babylonjs/core/Shaders/sharpen.fragment';
import '@babylonjs/core/Shaders/fxaa.fragment';
import '@babylonjs/core/Shaders/fxaa.vertex';
import '@babylonjs/core/Shaders/imageProcessing.fragment';
import '@babylonjs/core/Shaders/pass.fragment';

// Bloom effect shaders
import '@babylonjs/core/Shaders/bloomMerge.fragment';
import '@babylonjs/core/Shaders/extractHighlights.fragment';

// Blur shaders (used by bloom and DOF internally via BlurPostProcess)
// Without these, BabylonJS attempts to fetch kernelBlur.vertex.fx / .fragment.fx
// via HTTP, which Vite's SPA fallback intercepts and returns index.html instead
import '@babylonjs/core/Shaders/kernelBlur.fragment';
import '@babylonjs/core/Shaders/kernelBlur.vertex';

// Environment texture decoding (used by skybox / IBL / CubeTexture)
import '@babylonjs/core/Shaders/rgbdDecode.fragment';
import '@babylonjs/core/Shaders/rgbdEncode.fragment';

// Depth of field shaders
import '@babylonjs/core/Shaders/circleOfConfusion.fragment';
import '@babylonjs/core/Shaders/depthOfField.fragment';
import '@babylonjs/core/Shaders/depthOfFieldMerge.fragment';

// Post-process classes (import to trigger shader registration)
import '@babylonjs/core/PostProcesses/chromaticAberrationPostProcess';
import '@babylonjs/core/PostProcesses/grainPostProcess';
import '@babylonjs/core/PostProcesses/sharpenPostProcess';
import '@babylonjs/core/PostProcesses/bloomEffect';
import '@babylonjs/core/PostProcesses/fxaaPostProcess';
import '@babylonjs/core/PostProcesses/imageProcessingPostProcess';
import '@babylonjs/core/PostProcesses/depthOfFieldEffect';
import '@babylonjs/core/PostProcesses/extractHighlightsPostProcess';
import '@babylonjs/core/PostProcesses/blurPostProcess';

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

/**
 * Quality presets for post-processing
 */
export type PostProcessQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Color grading configuration for different level types
 */
interface ColorGradeConfig {
  contrast: number;
  exposure: number;
  saturation: number;
  colorCurvesEnabled: boolean;
  vignetteColor: Color4;
  // Tone mapping adjustments
  toneMappingEnabled: boolean;
  toneMappingType: number;
}

/**
 * Dynamic effect state for combat feedback
 */
interface DynamicEffectState {
  // Damage flash
  damageFlashIntensity: number;
  damageFlashDecay: number;
  damageFlashDuration: number; // 0.15 seconds per spec

  // Hit confirmation
  hitFlashIntensity: number;
  hitFlashDecay: number;

  // Kill streak feedback
  killStreakLevel: number;
  killStreakDecay: number;

  // Low health warning
  lowHealthPulse: number;
  lowHealthThreshold: number;
  lowHealthPulseSpeed: number;

  // Motion blur during sprint
  motionBlurEnabled: boolean;
  currentMotionBlur: number;
  targetMotionBlur: number;
  motionBlurSamples: number; // 0.3 per spec

  // Depth of field for dramatic moments
  dofEnabled: boolean;
  dofFocusDistance: number;
  dofFocalLength: number;
  dofFStop: number;

  // Explosion bloom boost
  explosionBloomActive: boolean;
  explosionBloomIntensity: number;
  explosionBloomDecay: number;

  // Combat state for desaturation
  inCombat: boolean;
  combatDesaturation: number;
  targetCombatDesaturation: number;

  // Aiming state (disables motion blur)
  isAiming: boolean;
}

/**
 * Configuration for post-processing manager
 */
export interface PostProcessConfig {
  quality: PostProcessQuality;
  filmGrainEnabled: boolean;
  vignetteEnabled: boolean;
  chromaticAberrationEnabled: boolean;
  bloomEnabled: boolean;
  fxaaEnabled: boolean;
  motionBlurEnabled: boolean;
  depthOfFieldEnabled: boolean;
}

// ============================================================================
// COLOR GRADING PRESETS
// ============================================================================

const COLOR_GRADES: Record<LevelType, ColorGradeConfig> = {
  // Station levels - cool blue tint, sterile feeling (per spec: Cool blue tint)
  station: {
    contrast: 1.05,
    exposure: 0.95,
    saturation: 0.9,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.08, 0.12, 0.22, 0.0), // Blue tint
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Drop sequence - high contrast, dramatic
  drop: {
    contrast: 1.2,
    exposure: 1.1,
    saturation: 1.1,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.2, 0.1, 0.05, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Canyon/surface - warm orange/amber (per spec: Warm orange/amber for surface)
  canyon: {
    contrast: 1.1,
    exposure: 1.0,
    saturation: 1.05,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.28, 0.18, 0.08, 0.0), // Warm orange/amber
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Abandoned base - desaturated, tense atmosphere
  base: {
    contrast: 1.15,
    exposure: 0.85,
    saturation: 0.75,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.15, 0.1, 0.1, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Brothers in arms - warmer, hopeful but still tense
  brothers: {
    contrast: 1.08,
    exposure: 1.0,
    saturation: 0.95,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.2, 0.12, 0.08, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Hive - sickly green, organic horror (per spec: Sickly green for hive)
  hive: {
    contrast: 1.2,
    exposure: 0.8,
    saturation: 0.85,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.08, 0.22, 0.08, 0.0), // Sickly green
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Boss fight (Queen's Lair) - deeper purple/green horror, intense
  boss: {
    contrast: 1.3,
    exposure: 0.75,
    saturation: 0.8,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.15, 0.18, 0.12, 0.0), // Purple-green horror
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Extraction - high intensity, urgent feeling
  extraction: {
    contrast: 1.15,
    exposure: 1.05,
    saturation: 1.0,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.2, 0.1, 0.05, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Vehicle chase - warm dusty tones, high contrast
  vehicle: {
    contrast: 1.12,
    exposure: 1.05,
    saturation: 1.05,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.25, 0.15, 0.08, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Ice - deep blue with high contrast (per spec: Deep blue with high contrast for ice)
  ice: {
    contrast: 1.25, // Higher contrast per spec
    exposure: 0.9,
    saturation: 0.75, // More desaturated for frozen feel
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.05, 0.1, 0.28, 0.0), // Deep blue
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Assault (Hive Assault) - intense, red-tinted urgency
  assault: {
    contrast: 1.2,
    exposure: 0.9,
    saturation: 0.9,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.2, 0.08, 0.1, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Combined arms - intense, red-tinted urgency
  combined_arms: {
    contrast: 1.2,
    exposure: 0.9,
    saturation: 0.9,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.2, 0.08, 0.1, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Escape (timed escape sequence) - maximum intensity, fiery collapse
  escape: {
    contrast: 1.25,
    exposure: 1.1,
    saturation: 1.1,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.3, 0.1, 0.05, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Finale - maximum intensity, fiery collapse
  finale: {
    contrast: 1.25,
    exposure: 1.1,
    saturation: 1.1,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.3, 0.1, 0.05, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },

  // Mining depths - dark, claustrophobic, slightly yellow
  mine: {
    contrast: 1.15,
    exposure: 0.8,
    saturation: 0.8,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.15, 0.12, 0.08, 0.0),
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_ACES,
  },
};

// ============================================================================
// QUALITY PRESETS
// ============================================================================

const QUALITY_PRESETS: Record<PostProcessQuality, Partial<PostProcessConfig>> = {
  low: {
    filmGrainEnabled: false,
    vignetteEnabled: true,
    chromaticAberrationEnabled: false,
    bloomEnabled: false,
    fxaaEnabled: true,
    motionBlurEnabled: false,
    depthOfFieldEnabled: false,
  },
  medium: {
    filmGrainEnabled: true,
    vignetteEnabled: true,
    chromaticAberrationEnabled: true,
    bloomEnabled: true,
    fxaaEnabled: true,
    motionBlurEnabled: false,
    depthOfFieldEnabled: false,
  },
  high: {
    filmGrainEnabled: true,
    vignetteEnabled: true,
    chromaticAberrationEnabled: true,
    bloomEnabled: true,
    fxaaEnabled: true,
    motionBlurEnabled: true,
    depthOfFieldEnabled: true,
  },
  ultra: {
    filmGrainEnabled: true,
    vignetteEnabled: true,
    chromaticAberrationEnabled: true,
    bloomEnabled: true,
    fxaaEnabled: true,
    motionBlurEnabled: true,
    depthOfFieldEnabled: true,
  },
};

// ============================================================================
// POST PROCESS MANAGER
// ============================================================================

export class PostProcessManager {
  private scene: Scene;
  private camera: Camera;
  private pipeline: DefaultRenderingPipeline | null = null;

  // Configuration
  private config: PostProcessConfig;
  private currentLevelType: LevelType = 'station';

  // Dynamic effect state - configured per requirements spec
  private effectState: DynamicEffectState = {
    // Damage flash: 0.15 second duration per spec
    damageFlashIntensity: 0,
    damageFlashDecay: 1 / 0.15, // ~6.67 for 0.15s duration
    damageFlashDuration: 0.15,

    // Hit confirmation
    hitFlashIntensity: 0,
    hitFlashDecay: 15,

    // Kill streak
    killStreakLevel: 0,
    killStreakDecay: 0.5,

    // Low health: Pulsing dark vignette per spec
    lowHealthPulse: 0,
    lowHealthThreshold: 30,
    lowHealthPulseSpeed: 3, // Pulse frequency for low health effect

    // Motion blur: 0.3 samples per spec, only during fast movement
    motionBlurEnabled: false,
    currentMotionBlur: 0,
    targetMotionBlur: 0,
    motionBlurSamples: 0.3,

    // Depth of field
    dofEnabled: false,
    dofFocusDistance: 10,
    dofFocalLength: 50,
    dofFStop: 2.8,

    // Explosion bloom: intensity 1.5 during explosions per spec
    explosionBloomActive: false,
    explosionBloomIntensity: 0,
    explosionBloomDecay: 5,

    // Combat state: slightly desaturated per spec
    inCombat: false,
    combatDesaturation: 0,
    targetCombatDesaturation: 0,

    // Aiming state: disables motion blur per spec
    isAiming: false,
  };

  // Base values for effects (before dynamic modifications) - per spec values
  private baseVignetteWeight = 0.3; // Default: Subtle darkening at edges (0.3) per spec
  private baseChromaticAberration = 0.002; // Subtle at edges (0.002 offset) per spec
  private baseFilmGrain = 0.05; // Very subtle (0.05 intensity) per spec
  private baseBloomIntensity = 0.5; // Intensity: 0.5 default per spec
  private baseBloomThreshold = 0.8; // Threshold: 0.8 for HDR-like glow per spec

  // Performance tracking for adaptive quality
  private fpsHistory: number[] = [];
  private readonly fpsHistoryLength = 60;
  private lastAdaptiveCheck = 0;
  private readonly adaptiveCheckInterval = 2000; // 2 seconds

  constructor(scene: Scene, camera: Camera, config?: Partial<PostProcessConfig>) {
    this.scene = scene;
    this.camera = camera;

    // Detect mobile and set appropriate defaults
    const isMobile = this.detectMobile();
    const defaultQuality: PostProcessQuality = isMobile ? 'low' : 'high';

    this.config = {
      quality: defaultQuality,
      filmGrainEnabled: true,
      vignetteEnabled: true,
      chromaticAberrationEnabled: true,
      bloomEnabled: true,
      fxaaEnabled: true,
      motionBlurEnabled: !isMobile,
      depthOfFieldEnabled: !isMobile,
      ...QUALITY_PRESETS[defaultQuality],
      ...config,
    };

    this.initializePipeline();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private detectMobile(): boolean {
    // Check for touch device and screen size
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is IE-specific
      navigator.msMaxTouchPoints > 0;

    const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 600;
    const isLowMemory =
      // @ts-expect-error - deviceMemory is experimental
      (navigator.deviceMemory && navigator.deviceMemory < 4) || navigator.hardwareConcurrency < 4;

    return isTouchDevice || isSmallScreen || isLowMemory;
  }

  private initializePipeline(): void {
    // Dispose existing pipeline if any
    this.pipeline?.dispose();

    // Create new pipeline
    this.pipeline = new DefaultRenderingPipeline(
      'postProcessPipeline',
      true, // HDR
      this.scene,
      [this.camera]
    );

    // Apply quality preset
    this.applyQualitySettings();

    // Apply initial level color grading
    this.applyColorGrading(this.currentLevelType);
  }

  private applyQualitySettings(): void {
    if (!this.pipeline) return;

    const preset = QUALITY_PRESETS[this.config.quality];
    Object.assign(this.config, preset);

    // FXAA anti-aliasing
    this.pipeline.fxaaEnabled = this.config.fxaaEnabled;

    // Film grain: Very subtle (0.05 intensity) per spec - adds grit and reduces banding
    this.pipeline.grainEnabled = this.config.filmGrainEnabled;
    if (this.pipeline.grainEnabled) {
      this.pipeline.grain.intensity = this.baseFilmGrain; // 0.05 per spec
      this.pipeline.grain.animated = true;
    }

    // Vignette: Default subtle darkening at edges (0.3) per spec
    this.pipeline.imageProcessing.vignetteEnabled = this.config.vignetteEnabled;
    if (this.pipeline.imageProcessing.vignetteEnabled) {
      this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight; // 0.3 per spec
      this.pipeline.imageProcessing.vignetteStretch = 0.5;
      this.pipeline.imageProcessing.vignetteBlendMode =
        ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    }

    // Chromatic aberration: Subtle at edges (0.002 offset) per spec
    this.pipeline.chromaticAberrationEnabled = this.config.chromaticAberrationEnabled;
    if (this.pipeline.chromaticAberrationEnabled) {
      this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration; // 0.002 per spec
      this.pipeline.chromaticAberration.radialIntensity = 1.0; // Focus on edges
      this.pipeline.chromaticAberration.direction = new Vector2(0.5, 0.5);
    }

    // Bloom: Threshold 0.8 for HDR-like glow, intensity 0.5 default per spec
    // Apply to: Muzzle flashes, plasma, explosions, alien glow
    this.pipeline.bloomEnabled = this.config.bloomEnabled;
    if (this.pipeline.bloomEnabled) {
      this.pipeline.bloomWeight = this.baseBloomIntensity; // 0.5 per spec
      this.pipeline.bloomThreshold = this.baseBloomThreshold; // 0.8 per spec
      this.pipeline.bloomScale = 0.5;
      this.pipeline.bloomKernel = this.config.quality === 'ultra' ? 64 : 32;
    }

    // Depth of field (for dramatic moments)
    this.pipeline.depthOfFieldEnabled = false; // Start disabled, enable on demand
    if (this.config.depthOfFieldEnabled) {
      this.pipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.Medium;
    }

    // Image processing configuration
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

    // Sharpen for crisp visuals
    this.pipeline.sharpenEnabled = this.config.quality !== 'low';
    if (this.pipeline.sharpenEnabled) {
      this.pipeline.sharpen.edgeAmount = 0.2;
      this.pipeline.sharpen.colorAmount = 0.8;
    }
  }

  // ============================================================================
  // COLOR GRADING
  // ============================================================================

  /**
   * Set the level type and apply corresponding color grading
   */
  setLevelType(levelType: LevelType): void {
    this.currentLevelType = levelType;
    this.applyColorGrading(levelType);
  }

  private applyColorGrading(levelType: LevelType): void {
    if (!this.pipeline) return;

    const grade = COLOR_GRADES[levelType];
    const imageProcessing = this.pipeline.imageProcessing;

    // Apply contrast and exposure
    imageProcessing.contrast = grade.contrast;
    imageProcessing.exposure = grade.exposure;

    // Apply vignette color
    if (this.config.vignetteEnabled) {
      imageProcessing.vignetteColor = grade.vignetteColor;
    }

    // Apply tone mapping
    imageProcessing.toneMappingEnabled = grade.toneMappingEnabled;
    imageProcessing.toneMappingType = grade.toneMappingType;

    // Saturation is applied via color curves
    if (grade.colorCurvesEnabled) {
      imageProcessing.colorCurvesEnabled = true;
      // Adjust saturation through color curves
      // BabylonJS doesn't have direct saturation control in the pipeline,
      // but we can simulate it through exposure and contrast adjustments
    }
  }

  /**
   * Transition between level color grades smoothly
   */
  transitionToLevelType(levelType: LevelType, duration: number = 1000): void {
    const startTime = performance.now();
    const startGrade = COLOR_GRADES[this.currentLevelType];
    const endGrade = COLOR_GRADES[levelType];

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const eased = 1 - (1 - progress) ** 3;

      if (this.pipeline) {
        const imageProcessing = this.pipeline.imageProcessing;
        imageProcessing.contrast =
          startGrade.contrast + (endGrade.contrast - startGrade.contrast) * eased;
        imageProcessing.exposure =
          startGrade.exposure + (endGrade.exposure - startGrade.exposure) * eased;

        // Interpolate vignette color
        if (this.config.vignetteEnabled) {
          const r =
            startGrade.vignetteColor.r +
            (endGrade.vignetteColor.r - startGrade.vignetteColor.r) * eased;
          const g =
            startGrade.vignetteColor.g +
            (endGrade.vignetteColor.g - startGrade.vignetteColor.g) * eased;
          const b =
            startGrade.vignetteColor.b +
            (endGrade.vignetteColor.b - startGrade.vignetteColor.b) * eased;
          imageProcessing.vignetteColor = new Color4(r, g, b, 0);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.currentLevelType = levelType;
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // DYNAMIC COMBAT EFFECTS
  // ============================================================================

  /**
   * Trigger red flash when player takes damage
   * Integrates with existing damageFlash system in GameContext
   */
  triggerDamageFlash(intensity: number = 1.0): void {
    this.effectState.damageFlashIntensity = Math.min(1, intensity);
  }

  /**
   * Trigger brief flash for hit confirmation
   */
  triggerHitConfirmation(): void {
    this.effectState.hitFlashIntensity = 0.3;
  }

  /**
   * Trigger weapon fire screen shake effect.
   * Integrates with WeaponRecoilSystem for camera feedback.
   *
   * @param intensity - Shake intensity (0-1)
   * @param duration - Shake duration in seconds
   */
  triggerWeaponShake(intensity: number, duration: number): void {
    // The actual camera shake is handled by WeaponRecoilSystem
    // This method provides visual feedback through chromatic aberration
    if (!this.pipeline || !this.config.chromaticAberrationEnabled) return;

    // Brief chromatic aberration pulse scaled to intensity
    const caBoost = intensity * 0.8;
    this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration + caBoost;

    // Schedule decay
    const decayTime = duration * 1000;
    setTimeout(() => {
      if (this.pipeline && this.effectState.damageFlashIntensity === 0) {
        this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration;
      }
    }, decayTime);
  }

  /**
   * Trigger FOV punch effect for heavy weapons.
   * This creates a brief widening of the field of view.
   *
   * @param punchDegrees - FOV change in degrees (positive = wider)
   * @param recoverySpeed - Recovery speed (higher = faster return to normal)
   */
  triggerFOVPunch(punchDegrees: number, recoverySpeed: number): void {
    // FOV punch is handled by WeaponRecoilSystem directly on the camera
    // This method is provided for external systems that may want to trigger it
    // For now, we just boost bloom slightly for the visual "impact" feel
    if (!this.pipeline || !this.config.bloomEnabled) return;

    const bloomBoost = Math.min(punchDegrees / 10, 0.3);
    this.pipeline.bloomWeight = 0.3 + bloomBoost;

    // Schedule decay
    const decayTime = (punchDegrees / recoverySpeed) * 1000;
    setTimeout(() => {
      if (this.pipeline) {
        this.pipeline.bloomWeight = 0.3;
      }
    }, decayTime);
  }

  /**
   * Update kill streak level for visual feedback
   */
  updateKillStreak(kills: number): void {
    this.effectState.killStreakLevel = Math.min(10, kills);
  }

  /**
   * Set player health for low health warning effect
   */
  setPlayerHealth(health: number): void {
    // Low health warning activates below threshold
    if (health < this.effectState.lowHealthThreshold && health > 0) {
      // Pulse intensity based on how low health is
      const severity = 1 - health / this.effectState.lowHealthThreshold;
      this.effectState.lowHealthPulse = severity;
    } else {
      this.effectState.lowHealthPulse = 0;
    }
  }

  /**
   * Enable/disable sprint motion blur
   */
  setSprinting(isSprinting: boolean): void {
    if (!this.config.motionBlurEnabled) return;
    this.effectState.targetMotionBlur = isSprinting ? 0.4 : 0;
    this.effectState.motionBlurEnabled = isSprinting;
  }

  /**
   * Enable/disable slide visual effects.
   * Slide has stronger motion blur and chromatic aberration than sprint.
   */
  setSliding(isSliding: boolean): void {
    if (!this.pipeline) return;

    if (isSliding) {
      // Slide has higher motion blur than sprint
      if (this.config.motionBlurEnabled) {
        this.effectState.targetMotionBlur = 0.6;
        this.effectState.motionBlurEnabled = true;
      }

      // Boost chromatic aberration during slide for speed feel
      // Use relative boost from base (0.002 + 0.008 = 0.01, same as damage max)
      if (this.config.chromaticAberrationEnabled) {
        this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration + 0.008;
      }
    } else {
      // Reset chromatic aberration when slide ends
      if (this.config.chromaticAberrationEnabled) {
        this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration;
      }
      // Let setSprinting handle motion blur state when slide ends
    }
  }

  /**
   * Enable depth of field for dramatic moments (cutscenes, etc.)
   */
  enableDepthOfField(focusDistance: number, focalLength: number = 50, fStop: number = 2.8): void {
    if (!this.config.depthOfFieldEnabled || !this.pipeline) return;

    this.effectState.dofEnabled = true;
    this.effectState.dofFocusDistance = focusDistance;
    this.effectState.dofFocalLength = focalLength;
    this.effectState.dofFStop = fStop;

    this.pipeline.depthOfFieldEnabled = true;
    this.pipeline.depthOfField.focusDistance = focusDistance * 1000; // Convert to mm
    this.pipeline.depthOfField.focalLength = focalLength;
    this.pipeline.depthOfField.fStop = fStop;
  }

  /**
   * Disable depth of field
   */
  disableDepthOfField(): void {
    this.effectState.dofEnabled = false;
    if (this.pipeline) {
      this.pipeline.depthOfFieldEnabled = false;
    }
  }

  /**
   * Trigger explosion bloom effect.
   * Per spec: Bloom intensity 1.5 during explosions.
   * Applies to: Muzzle flashes, plasma, explosions, alien glow.
   *
   * @param intensity - Explosion intensity multiplier (1.0 = standard, higher for bigger explosions)
   * @param duration - Effect duration in seconds
   */
  triggerExplosionBloom(intensity: number = 1.0, duration: number = 0.3): void {
    if (!this.pipeline || !this.config.bloomEnabled) return;

    // Per spec: intensity 1.5 during explosions (scaled by intensity param)
    const explosionBloomIntensity = 1.5 * intensity;
    this.effectState.explosionBloomActive = true;
    this.effectState.explosionBloomIntensity = Math.max(
      this.effectState.explosionBloomIntensity,
      explosionBloomIntensity
    );

    // Calculate decay rate to reach base intensity over duration
    this.effectState.explosionBloomDecay =
      (explosionBloomIntensity - this.baseBloomIntensity) / duration;
  }

  /**
   * Set aiming state. Disables motion blur when aiming per spec.
   *
   * @param isAiming - Whether the player is currently aiming down sights
   */
  setAiming(isAiming: boolean): void {
    this.effectState.isAiming = isAiming;
  }

  /**
   * Set combat state for desaturation effect.
   * Per spec: Combat slightly desaturated.
   *
   * @param inCombat - Whether the player is in combat
   */
  setCombatState(inCombat: boolean): void {
    this.effectState.inCombat = inCombat;
    // Target desaturation: 0.1 (10% desaturation during combat)
    this.effectState.targetCombatDesaturation = inCombat ? 0.1 : 0;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update dynamic effects - call this every frame
   */
  update(deltaTime: number): void {
    if (!this.pipeline) return;

    // Track FPS for adaptive quality
    this.updateFPSTracking(deltaTime);

    // Update damage flash effect
    this.updateDamageFlash(deltaTime);

    // Update hit confirmation effect
    this.updateHitConfirmation(deltaTime);

    // Update low health warning
    this.updateLowHealthWarning(deltaTime);

    // Update kill streak visual
    this.updateKillStreakVisual(deltaTime);

    // Update motion blur (disabled during aiming per spec)
    this.updateMotionBlur(deltaTime);

    // Update explosion bloom decay
    this.updateExplosionBloom(deltaTime);

    // Update combat desaturation
    this.updateCombatDesaturation(deltaTime);

    // Check for adaptive quality adjustment
    this.checkAdaptiveQuality();
  }

  /**
   * Update explosion bloom effect decay.
   * Per spec: Bloom intensity 1.5 during explosions, applies to muzzle flashes, plasma, explosions.
   */
  private updateExplosionBloom(deltaTime: number): void {
    if (!this.effectState.explosionBloomActive || !this.pipeline || !this.config.bloomEnabled)
      return;

    // Decay bloom back to base intensity
    if (this.effectState.explosionBloomIntensity > this.baseBloomIntensity) {
      this.effectState.explosionBloomIntensity -= this.effectState.explosionBloomDecay * deltaTime;

      if (this.effectState.explosionBloomIntensity <= this.baseBloomIntensity) {
        this.effectState.explosionBloomIntensity = this.baseBloomIntensity;
        this.effectState.explosionBloomActive = false;
      }

      this.pipeline.bloomWeight = this.effectState.explosionBloomIntensity;
    } else {
      this.effectState.explosionBloomActive = false;
    }
  }

  /**
   * Update combat desaturation effect.
   * Per spec: Combat slightly desaturated.
   */
  private updateCombatDesaturation(deltaTime: number): void {
    if (!this.pipeline) return;

    // Smooth interpolation toward target desaturation
    const diff = this.effectState.targetCombatDesaturation - this.effectState.combatDesaturation;
    if (Math.abs(diff) > 0.001) {
      // Ramp up fast (2x speed), ramp down slow (0.5x speed)
      const speed = diff > 0 ? 2.0 : 0.5;
      this.effectState.combatDesaturation += diff * Math.min(1, deltaTime * speed);

      // Apply desaturation through exposure reduction (simulates saturation decrease)
      const baseGrade = COLOR_GRADES[this.currentLevelType];
      const desatExposure = baseGrade.exposure * (1.0 - this.effectState.combatDesaturation * 0.1);
      const desatContrast = baseGrade.contrast * (1.0 + this.effectState.combatDesaturation * 0.05);

      // Only apply if not overridden by other effects
      if (this.effectState.damageFlashIntensity === 0 && this.effectState.lowHealthPulse === 0) {
        this.pipeline.imageProcessing.exposure = desatExposure;
        this.pipeline.imageProcessing.contrast = desatContrast;
      }
    }
  }

  private updateDamageFlash(deltaTime: number): void {
    if (this.effectState.damageFlashIntensity > 0) {
      // Damage flash per spec:
      // - Red screen edge flash on hit
      // - Duration: 0.15 seconds
      // - Intensity based on damage percentage
      const intensity = this.effectState.damageFlashIntensity;

      if (this.pipeline) {
        // Red tinted vignette per spec - intensity based on damage
        const vignetteBoost = intensity * 0.6;
        this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight + vignetteBoost;
        this.pipeline.imageProcessing.vignetteColor = new Color4(0.9, 0.1, 0.05, 0); // Bright red

        // Chromatic aberration: increase during damage (0.01) per spec
        if (this.config.chromaticAberrationEnabled) {
          const caBoost = intensity * (0.01 - this.baseChromaticAberration);
          this.pipeline.chromaticAberration.aberrationAmount =
            this.baseChromaticAberration + caBoost;
        }
      }

      // Decay the effect over 0.15 seconds per spec
      this.effectState.damageFlashIntensity -= this.effectState.damageFlashDecay * deltaTime;
      if (this.effectState.damageFlashIntensity < 0) {
        this.effectState.damageFlashIntensity = 0;
        // Reset to base values
        if (this.pipeline) {
          this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight;
          this.applyColorGrading(this.currentLevelType);
          if (this.config.chromaticAberrationEnabled) {
            this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration;
          }
        }
      }
    }
  }

  private updateHitConfirmation(deltaTime: number): void {
    if (this.effectState.hitFlashIntensity > 0) {
      // Brief boost to bloom and brightness
      if (this.pipeline && this.config.bloomEnabled) {
        this.pipeline.bloomWeight = 0.3 + this.effectState.hitFlashIntensity * 0.4;
      }

      // Decay
      this.effectState.hitFlashIntensity -= this.effectState.hitFlashDecay * deltaTime;
      if (this.effectState.hitFlashIntensity < 0) {
        this.effectState.hitFlashIntensity = 0;
        if (this.pipeline && this.config.bloomEnabled) {
          this.pipeline.bloomWeight = 0.3;
        }
      }
    }
  }

  private updateLowHealthWarning(_deltaTime: number): void {
    if (this.effectState.lowHealthPulse > 0 && this.pipeline) {
      // Low health per spec:
      // - Pulsing dark vignette
      // - Chromatic aberration pulse effect on low health
      const time = performance.now() * 0.001; // Convert to seconds
      const pulseSpeed = this.effectState.lowHealthPulseSpeed;
      const pulse = Math.sin(time * pulseSpeed) * 0.5 + 0.5;
      const severity = this.effectState.lowHealthPulse; // 0-1 based on health
      const intensity = severity * pulse;

      // Don't override damage flash
      if (this.effectState.damageFlashIntensity === 0) {
        // Pulsing dark vignette per spec
        const vignetteBoost = intensity * 0.5;
        this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight + vignetteBoost;
        // Dark red/black vignette for "pulsing dark" effect
        const redAmount = 0.4 + intensity * 0.3;
        this.pipeline.imageProcessing.vignetteColor = new Color4(redAmount, 0.05, 0.05, 0);

        // Chromatic aberration pulse on low health per spec
        if (this.config.chromaticAberrationEnabled) {
          const caPulse = pulse * severity * 0.008; // Subtle pulse up to 0.01
          this.pipeline.chromaticAberration.aberrationAmount =
            this.baseChromaticAberration + caPulse;
        }

        // Slight desaturation as health drops
        const desaturation = severity * 0.15;
        this.pipeline.imageProcessing.exposure =
          COLOR_GRADES[this.currentLevelType].exposure * (1.0 - desaturation);
      }
    }
  }

  private updateKillStreakVisual(deltaTime: number): void {
    if (this.effectState.killStreakLevel > 0 && this.pipeline) {
      // Slight golden tint and bloom boost for kill streaks
      const level = this.effectState.killStreakLevel;
      const streakIntensity = Math.min(level / 10, 1) * 0.15;

      if (this.config.bloomEnabled) {
        // Boost bloom for streaks (additive with other effects)
        const baseBloom =
          this.effectState.hitFlashIntensity > 0
            ? 0.3 + this.effectState.hitFlashIntensity * 0.4
            : 0.3;
        this.pipeline.bloomWeight = baseBloom + streakIntensity;
      }

      // Very subtle saturation boost
      this.pipeline.imageProcessing.contrast =
        COLOR_GRADES[this.currentLevelType].contrast + streakIntensity * 0.1;

      // Decay kill streak over time
      this.effectState.killStreakLevel -= this.effectState.killStreakDecay * deltaTime;
      if (this.effectState.killStreakLevel < 0) {
        this.effectState.killStreakLevel = 0;
      }
    }
  }

  private updateMotionBlur(deltaTime: number): void {
    if (!this.config.motionBlurEnabled) return;

    // Motion blur per spec:
    // - Subtle (0.3 samples)
    // - Only during fast movement
    // - Disable during aiming
    const targetBlur = this.effectState.isAiming ? 0 : this.effectState.targetMotionBlur;

    // Smoothly interpolate motion blur
    const diff = targetBlur - this.effectState.currentMotionBlur;
    if (Math.abs(diff) > 0.01) {
      this.effectState.currentMotionBlur += diff * Math.min(1, deltaTime * 5);
    } else {
      this.effectState.currentMotionBlur = targetBlur;
    }

    // Note: BabylonJS DefaultRenderingPipeline doesn't include motion blur by default
    // We simulate the effect with slight chromatic aberration increase + blur feel
    // The 0.3 samples value translates to subtle CA and slight image softening
    if (this.pipeline && this.config.chromaticAberrationEnabled) {
      const motionBlurCA = this.effectState.currentMotionBlur * this.effectState.motionBlurSamples;
      // Only apply if not in damage flash or low health pulse
      if (this.effectState.damageFlashIntensity === 0 && this.effectState.lowHealthPulse === 0) {
        this.pipeline.chromaticAberration.aberrationAmount =
          this.baseChromaticAberration + motionBlurCA * 0.01;
      }
    }
  }

  // ============================================================================
  // PERFORMANCE AND ADAPTIVE QUALITY
  // ============================================================================

  private updateFPSTracking(deltaTime: number): void {
    const fps = 1 / deltaTime;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.fpsHistoryLength) {
      this.fpsHistory.shift();
    }
  }

  private getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  private checkAdaptiveQuality(): void {
    const now = performance.now();
    if (now - this.lastAdaptiveCheck < this.adaptiveCheckInterval) return;
    this.lastAdaptiveCheck = now;

    const avgFPS = this.getAverageFPS();

    // If FPS is too low, reduce quality
    if (avgFPS < 30 && this.config.quality !== 'low') {
      log.info(`Reducing quality due to low FPS (${avgFPS.toFixed(1)})`);
      this.setQuality(this.getPreviousQuality());
    }
    // If FPS is high and stable, could increase quality (optional)
    else if (avgFPS > 55 && this.config.quality !== 'ultra') {
      // Don't auto-upgrade quality - let user control this
    }
  }

  private getPreviousQuality(): PostProcessQuality {
    const levels: PostProcessQuality[] = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = levels.indexOf(this.config.quality);
    return levels[Math.max(0, currentIndex - 1)];
  }

  /**
   * Set quality level
   */
  setQuality(quality: PostProcessQuality): void {
    if (quality === this.config.quality) return;

    log.info(`Setting quality to ${quality}`);
    this.config.quality = quality;
    this.applyQualitySettings();
    this.applyColorGrading(this.currentLevelType);
  }

  /**
   * Get current quality level
   */
  getQuality(): PostProcessQuality {
    return this.config.quality;
  }

  /**
   * Get current configuration (for settings UI)
   */
  getConfig(): PostProcessConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PostProcessConfig>): void {
    Object.assign(this.config, config);
    this.applyQualitySettings();
    this.applyColorGrading(this.currentLevelType);
  }

  /**
   * Sync with game settings from SettingsContext.
   * Call this when settings change to apply them to post-processing.
   *
   * @param settings - Partial game settings object
   */
  syncWithGameSettings(settings: {
    postProcessingEnabled?: boolean;
    bloomEnabled?: boolean;
    bloomIntensity?: number;
    chromaticAberrationEnabled?: boolean;
    vignetteEnabled?: boolean;
    filmGrainEnabled?: boolean;
    filmGrainIntensity?: number;
    motionBlur?: boolean;
    colorGradingEnabled?: boolean;
    reducedFlashing?: boolean;
  }): void {
    if (!this.pipeline) return;

    // Master post-processing toggle
    if (settings.postProcessingEnabled === false) {
      // Disable all effects but keep pipeline for potential re-enable
      this.pipeline.bloomEnabled = false;
      this.pipeline.chromaticAberrationEnabled = false;
      this.pipeline.imageProcessing.vignetteEnabled = false;
      this.pipeline.grainEnabled = false;
      this.pipeline.sharpenEnabled = false;
      return;
    }

    // Bloom
    if (settings.bloomEnabled !== undefined) {
      this.config.bloomEnabled = settings.bloomEnabled;
      this.pipeline.bloomEnabled = settings.bloomEnabled;
    }
    if (settings.bloomIntensity !== undefined && this.pipeline.bloomEnabled) {
      // Map 0-1 intensity to bloom weight (0.1 - 0.6)
      this.pipeline.bloomWeight = 0.1 + settings.bloomIntensity * 0.5;
    }

    // Chromatic aberration
    if (settings.chromaticAberrationEnabled !== undefined) {
      this.config.chromaticAberrationEnabled = settings.chromaticAberrationEnabled;
      this.pipeline.chromaticAberrationEnabled = settings.chromaticAberrationEnabled;
    }

    // Vignette
    if (settings.vignetteEnabled !== undefined) {
      this.config.vignetteEnabled = settings.vignetteEnabled;
      this.pipeline.imageProcessing.vignetteEnabled = settings.vignetteEnabled;
    }

    // Film grain
    if (settings.filmGrainEnabled !== undefined) {
      this.config.filmGrainEnabled = settings.filmGrainEnabled;
      this.pipeline.grainEnabled = settings.filmGrainEnabled;
    }
    if (settings.filmGrainIntensity !== undefined && this.pipeline.grainEnabled) {
      // Map 0-1 intensity to grain amount (0.05 - 0.3)
      this.pipeline.grain.intensity = 0.05 + settings.filmGrainIntensity * 0.25;
      this.baseFilmGrain = this.pipeline.grain.intensity;
    }

    // Motion blur
    if (settings.motionBlur !== undefined) {
      this.config.motionBlurEnabled = settings.motionBlur;
    }

    // Color grading toggle (affects level-based color adjustments)
    if (settings.colorGradingEnabled === false) {
      // Reset to neutral color grading
      this.pipeline.imageProcessing.contrast = 1.0;
      this.pipeline.imageProcessing.exposure = 1.0;
      this.pipeline.imageProcessing.colorCurvesEnabled = false;
    } else if (settings.colorGradingEnabled === true) {
      // Reapply level color grading
      this.applyColorGrading(this.currentLevelType);
    }

    // Reduced flashing - reduce intensity of dynamic effects
    if (settings.reducedFlashing === true) {
      // Lower the damage flash intensity decay to be less jarring
      this.effectState.damageFlashDecay = 15; // Faster decay
      this.effectState.hitFlashDecay = 20;
    } else if (settings.reducedFlashing === false) {
      // Restore normal values
      this.effectState.damageFlashDecay = 8;
      this.effectState.hitFlashDecay = 15;
    }
  }

  /**
   * Set bloom intensity directly (0-1)
   */
  setBloomIntensity(intensity: number): void {
    if (!this.pipeline || !this.config.bloomEnabled) return;
    this.pipeline.bloomWeight = 0.1 + Math.max(0, Math.min(1, intensity)) * 0.5;
  }

  /**
   * Get whether post-processing is currently enabled
   */
  isEnabled(): boolean {
    return this.pipeline !== null && this.config.bloomEnabled;
  }

  // ============================================================================
  // LOW HEALTH FEEDBACK INTEGRATION
  // ============================================================================

  // Track low health effect state to avoid conflicts with other effects
  private lowHealthVignetteActive = false;
  private lowHealthDesaturation = 0;
  private lowHealthTunnelVision = 0;

  /**
   * Set the vignette for low health feedback.
   * This temporarily overrides the base vignette when active.
   *
   * @param weight - Vignette weight (0 = none, 1 = full)
   * @param r - Red component (0-1)
   * @param g - Green component (0-1)
   * @param b - Blue component (0-1)
   */
  setLowHealthVignette(weight: number, r: number, g: number, b: number): void {
    if (!this.pipeline || !this.config.vignetteEnabled) return;

    // Only apply if not overridden by damage flash
    if (this.effectState.damageFlashIntensity > 0.1) return;

    if (weight > 0.01) {
      this.lowHealthVignetteActive = true;
      this.pipeline.imageProcessing.vignetteWeight = weight;
      this.pipeline.imageProcessing.vignetteColor = new Color4(r, g, b, 0);
    } else if (this.lowHealthVignetteActive) {
      // Reset to base when effect ends
      this.lowHealthVignetteActive = false;
      this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight;
      this.applyColorGrading(this.currentLevelType);
    }
  }

  /**
   * Set the desaturation level for low health feedback.
   * Reduces color saturation as health drops.
   *
   * @param amount - Desaturation amount (0 = none, 1 = grayscale)
   */
  setLowHealthDesaturation(amount: number): void {
    if (!this.pipeline) return;

    this.lowHealthDesaturation = Math.max(0, Math.min(1, amount));

    // Apply desaturation through exposure reduction and contrast increase
    // BabylonJS doesn't have direct saturation control, so we simulate it
    const baseGrade = COLOR_GRADES[this.currentLevelType];

    // Reduce exposure slightly and increase contrast to simulate desaturation
    const desatExposure = baseGrade.exposure * (1 - this.lowHealthDesaturation * 0.15);
    const desatContrast = baseGrade.contrast * (1 + this.lowHealthDesaturation * 0.1);

    this.pipeline.imageProcessing.exposure = desatExposure;
    this.pipeline.imageProcessing.contrast = desatContrast;
  }

  /**
   * Set the tunnel vision effect for critical health.
   * Creates a stronger vignette that narrows the field of view.
   *
   * @param amount - Tunnel vision amount (0 = none, 1 = severe)
   */
  setTunnelVision(amount: number): void {
    if (!this.pipeline || !this.config.vignetteEnabled) return;

    this.lowHealthTunnelVision = Math.max(0, Math.min(1, amount));

    // Tunnel vision increases vignette stretch to narrow the visible area
    if (this.lowHealthTunnelVision > 0) {
      // Increase vignette stretch to create tunnel effect
      this.pipeline.imageProcessing.vignetteStretch = 0.5 + this.lowHealthTunnelVision * 1.5;
    } else {
      // Reset to normal
      this.pipeline.imageProcessing.vignetteStretch = 0.5;
    }
  }

  /**
   * Reset all low health effects
   */
  resetLowHealthEffects(): void {
    this.lowHealthVignetteActive = false;
    this.lowHealthDesaturation = 0;
    this.lowHealthTunnelVision = 0;

    if (this.pipeline) {
      this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight;
      this.pipeline.imageProcessing.vignetteStretch = 0.5;
      this.applyColorGrading(this.currentLevelType);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose of all post-processing resources
   */
  dispose(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
    this.fpsHistory = [];
  }
}

// ============================================================================
// SINGLETON ACCESS (Optional - for global access)
// ============================================================================

let postProcessManagerInstance: PostProcessManager | null = null;

/**
 * Initialize the global post-process manager
 */
export function initializePostProcessManager(
  scene: Scene,
  camera: Camera,
  config?: Partial<PostProcessConfig>
): PostProcessManager {
  if (postProcessManagerInstance) {
    postProcessManagerInstance.dispose();
  }
  postProcessManagerInstance = new PostProcessManager(scene, camera, config);
  return postProcessManagerInstance;
}

/**
 * Get the global post-process manager instance
 * @throws Error if not initialized - call initializePostProcessManager first
 */
export function getPostProcessManager(): PostProcessManager {
  if (!postProcessManagerInstance) {
    throw new Error(
      'PostProcessManager not initialized. Call initializePostProcessManager(scene, camera) first.'
    );
  }
  return postProcessManagerInstance;
}

/**
 * Check if post-process manager is initialized (use for optional access)
 */
export function isPostProcessManagerInitialized(): boolean {
  return postProcessManagerInstance !== null;
}

/**
 * Dispose the global post-process manager
 */
export function disposePostProcessManager(): void {
  if (postProcessManagerInstance) {
    postProcessManagerInstance.dispose();
    postProcessManagerInstance = null;
  }
}
