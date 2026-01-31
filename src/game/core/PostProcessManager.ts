/**
 * PostProcessManager - Handles all visual post-processing effects
 *
 * Features:
 * - Default rendering pipeline with film grain, vignette, chromatic aberration
 * - Level-specific color grading (station=blue, surface=orange, hive=green)
 * - Dynamic combat effects (damage flash, hit confirmation, low health warning)
 * - Screen shake integration (works with BaseLevel shake system)
 * - Performance-aware quality settings with mobile optimization
 * - Depth of field for dramatic moments
 * - Motion blur during sprint (optional)
 *
 * Uses BabylonJS DefaultRenderingPipeline for optimal performance.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { DepthOfFieldEffectBlurLevel } from '@babylonjs/core/PostProcesses/depthOfFieldEffect';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import type { Scene } from '@babylonjs/core/scene';
import type { LevelType } from '../levels/types';

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

  // Hit confirmation
  hitFlashIntensity: number;
  hitFlashDecay: number;

  // Kill streak feedback
  killStreakLevel: number;
  killStreakDecay: number;

  // Low health warning
  lowHealthPulse: number;
  lowHealthThreshold: number;

  // Motion blur during sprint
  motionBlurEnabled: boolean;
  currentMotionBlur: number;
  targetMotionBlur: number;

  // Depth of field for dramatic moments
  dofEnabled: boolean;
  dofFocusDistance: number;
  dofFocalLength: number;
  dofFStop: number;
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
  // Station levels - cool blue tint, sterile feeling
  station: {
    contrast: 1.05,
    exposure: 0.95,
    saturation: 0.9,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.1, 0.15, 0.25, 0.0),
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

  // Canyon/surface - warm orange, dusty atmosphere
  canyon: {
    contrast: 1.1,
    exposure: 1.0,
    saturation: 1.05,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.25, 0.15, 0.1, 0.0),
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

  // Hive - sickly green, organic horror
  hive: {
    contrast: 1.2,
    exposure: 0.8,
    saturation: 0.85,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.1, 0.2, 0.1, 0.0),
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

  // Ice - cold blue desaturation, high contrast
  ice: {
    contrast: 1.15,
    exposure: 0.95,
    saturation: 0.8,
    colorCurvesEnabled: true,
    vignetteColor: new Color4(0.1, 0.15, 0.25, 0.0),
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

  // Dynamic effect state
  private effectState: DynamicEffectState = {
    damageFlashIntensity: 0,
    damageFlashDecay: 8,
    hitFlashIntensity: 0,
    hitFlashDecay: 15,
    killStreakLevel: 0,
    killStreakDecay: 0.5,
    lowHealthPulse: 0,
    lowHealthThreshold: 30,
    motionBlurEnabled: false,
    currentMotionBlur: 0,
    targetMotionBlur: 0,
    dofEnabled: false,
    dofFocusDistance: 10,
    dofFocalLength: 50,
    dofFStop: 2.8,
  };

  // Base values for effects (before dynamic modifications)
  private baseVignetteWeight = 0.3;
  private baseChromaticAberration = 0.5;
  private baseFilmGrain = 0.15;

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

    // Film grain for gritty military feel
    this.pipeline.grainEnabled = this.config.filmGrainEnabled;
    if (this.pipeline.grainEnabled) {
      this.pipeline.grain.intensity = this.baseFilmGrain;
      this.pipeline.grain.animated = true;
    }

    // Vignette (darken edges)
    this.pipeline.imageProcessing.vignetteEnabled = this.config.vignetteEnabled;
    if (this.pipeline.imageProcessing.vignetteEnabled) {
      this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight;
      this.pipeline.imageProcessing.vignetteStretch = 0.5;
      this.pipeline.imageProcessing.vignetteBlendMode =
        ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    }

    // Chromatic aberration (subtle)
    this.pipeline.chromaticAberrationEnabled = this.config.chromaticAberrationEnabled;
    if (this.pipeline.chromaticAberrationEnabled) {
      this.pipeline.chromaticAberration.aberrationAmount = this.baseChromaticAberration;
      this.pipeline.chromaticAberration.radialIntensity = 0.8;
      this.pipeline.chromaticAberration.direction = new Vector2(0.5, 0.5);
    }

    // Bloom for glowing effects
    this.pipeline.bloomEnabled = this.config.bloomEnabled;
    if (this.pipeline.bloomEnabled) {
      this.pipeline.bloomWeight = 0.3;
      this.pipeline.bloomThreshold = 0.8;
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

    // Update motion blur
    this.updateMotionBlur(deltaTime);

    // Check for adaptive quality adjustment
    this.checkAdaptiveQuality();
  }

  private updateDamageFlash(deltaTime: number): void {
    if (this.effectState.damageFlashIntensity > 0) {
      // Apply red vignette tint
      const intensity = this.effectState.damageFlashIntensity;

      if (this.pipeline) {
        // Increase vignette and tint it red
        const vignetteBoost = intensity * 0.5;
        this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight + vignetteBoost;
        this.pipeline.imageProcessing.vignetteColor = new Color4(0.8, 0.1, 0.1, 0);

        // Increase chromatic aberration for disorientation effect
        if (this.config.chromaticAberrationEnabled) {
          this.pipeline.chromaticAberration.aberrationAmount =
            this.baseChromaticAberration + intensity * 1.5;
        }
      }

      // Decay the effect
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

  private updateLowHealthWarning(deltaTime: number): void {
    if (this.effectState.lowHealthPulse > 0 && this.pipeline) {
      // Pulsing red vignette
      const time = performance.now() * 0.004;
      const pulse = Math.sin(time * this.effectState.lowHealthPulse * 2) * 0.5 + 0.5;
      const intensity = this.effectState.lowHealthPulse * pulse;

      // Don't override damage flash
      if (this.effectState.damageFlashIntensity === 0) {
        const vignetteBoost = intensity * 0.4;
        this.pipeline.imageProcessing.vignetteWeight = this.baseVignetteWeight + vignetteBoost;
        this.pipeline.imageProcessing.vignetteColor = new Color4(0.6, 0.1, 0.1, 0);

        // Desaturate slightly as health drops
        const desaturation = intensity * 0.2;
        this.pipeline.imageProcessing.exposure = 1.0 - desaturation;
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

    // Smoothly interpolate motion blur
    const diff = this.effectState.targetMotionBlur - this.effectState.currentMotionBlur;
    if (Math.abs(diff) > 0.01) {
      this.effectState.currentMotionBlur += diff * Math.min(1, deltaTime * 5);
    } else {
      this.effectState.currentMotionBlur = this.effectState.targetMotionBlur;
    }

    // Note: BabylonJS DefaultRenderingPipeline doesn't include motion blur by default
    // This would require a custom post-process or using MotionBlurPostProcess
    // For now, we simulate the effect with slight chromatic aberration increase
    if (this.pipeline && this.config.chromaticAberrationEnabled) {
      const motionBlurCA = this.effectState.currentMotionBlur * 1.0;
      // Only apply if not in damage flash
      if (this.effectState.damageFlashIntensity === 0) {
        this.pipeline.chromaticAberration.aberrationAmount =
          this.baseChromaticAberration + motionBlurCA;
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
      console.log(`[PostProcess] Reducing quality due to low FPS (${avgFPS.toFixed(1)})`);
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

    console.log(`[PostProcess] Setting quality to ${quality}`);
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
 */
export function getPostProcessManager(): PostProcessManager | null {
  return postProcessManagerInstance;
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
