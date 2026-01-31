/**
 * PerformanceManager - Mobile frame rate optimization system
 *
 * Features:
 * - FPS tracking with P50/P95 latency metrics
 * - Dynamic resolution scaling based on frame rate
 * - Platform-aware quality presets (mobile/tablet/desktop)
 * - Particle count reduction for mobile
 * - LOD distance management
 * - Shadow quality adjustment
 * - Performance budget warnings
 * - Battery-aware optimizations
 * - Automatic quality tier adjustment based on sustained FPS
 * - GPU performance benchmarking for initial tier detection
 *
 * Usage:
 *   const perfManager = getPerformanceManager();
 *   perfManager.initialize(engine, scene);
 *   // In render loop:
 *   perfManager.update();
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { IShadowLight } from '@babylonjs/core/Lights/shadowLight';
import type { Scene } from '@babylonjs/core/scene';
import type { DeviceType, ScreenInfo } from '../types';
import { getScreenInfo } from '../utils/responsive';
import { getLogger } from './Logger';

const log = getLogger('PerformanceManager');

// Import shadow generator components for BabylonJS tree-shaking
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// ============================================================================
// TYPES
// ============================================================================

export type QualityLevel = 'ultra' | 'high' | 'medium' | 'low' | 'potato';

export interface QualitySettings {
  /** Resolution scale (0.5 = half resolution, 1.0 = native) */
  resolutionScale: number;
  /** Maximum particle count multiplier (0.5 = half particles) */
  particleMultiplier: number;
  /** Shadow map size (0 = disabled, 512/1024/2048/4096) */
  shadowMapSize: number;
  /** Enable shadow casting */
  shadowsEnabled: boolean;
  /** LOD distance multiplier (lower = closer LOD switch) */
  lodDistanceMultiplier: number;
  /** Maximum concurrent particle systems */
  maxParticleSystems: number;
  /** Enable post-processing effects */
  postProcessingEnabled: boolean;
  /** Texture quality multiplier */
  textureQuality: number;
  /** Anti-aliasing samples (0, 2, 4, 8) */
  antiAliasSamples: number;
  /** Maximum draw calls before warning */
  drawCallBudget: number;
  /** Target FPS */
  targetFPS: number;
}

export interface PerformanceMetrics {
  /** Current frames per second */
  fps: number;
  /** Frame time in milliseconds */
  frameTime: number;
  /** 50th percentile frame time (median) */
  p50FrameTime: number;
  /** 95th percentile frame time (worst 5%) */
  p95FrameTime: number;
  /** Number of draw calls */
  drawCalls: number;
  /** Number of active meshes */
  activeMeshes: number;
  /** Number of active particle systems */
  activeParticles: number;
  /** Total triangles rendered */
  totalTriangles: number;
  /** GPU memory usage estimate (if available) */
  gpuMemory: number;
  /** Current quality level */
  qualityLevel: QualityLevel;
  /** Whether dynamic scaling is active */
  dynamicScalingActive: boolean;
  /** Current resolution scale */
  currentResolutionScale: number;
}

export interface PerformanceConfig {
  /** Enable dynamic resolution scaling */
  dynamicResolution: boolean;
  /** Minimum resolution scale (floor for dynamic scaling) */
  minResolutionScale: number;
  /** Maximum resolution scale (ceiling for dynamic scaling) */
  maxResolutionScale: number;
  /** FPS threshold below which to reduce quality */
  lowFPSThreshold: number;
  /** FPS threshold above which to increase quality */
  highFPSThreshold: number;
  /** How aggressively to scale resolution (0.1 = slow, 0.5 = aggressive) */
  scalingAggressiveness: number;
  /** Frame history length for averaging */
  frameHistoryLength: number;
  /** Enable performance warnings in console */
  showWarnings: boolean;
  /** Enable debug overlay (FPS counter, etc.) */
  debugOverlay: boolean;
  /** Enable automatic quality tier adjustment based on sustained FPS */
  autoQualityAdjustment: boolean;
  /** Minimum FPS target (mobile = 30, desktop = 60) */
  minTargetFPS: number;
  /** How long (ms) to sustain low FPS before degrading quality */
  qualityDegradeDelay: number;
  /** How long (ms) to sustain high FPS before upgrading quality */
  qualityUpgradeDelay: number;
}

/**
 * Performance tier detected via GPU benchmark
 */
export type PerformanceTier = 'low' | 'medium' | 'high';

/**
 * GPU benchmark results
 */
export interface GPUBenchmarkResult {
  tier: PerformanceTier;
  drawCallsPerFrame: number;
  averageFrameTime: number;
  supportsGPUParticles: boolean;
  maxTextureSize: number;
  estimatedVRAM: number;
}

// ============================================================================
// QUALITY PRESETS
// ============================================================================

const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  ultra: {
    resolutionScale: 1.0,
    particleMultiplier: 1.0,
    shadowMapSize: 4096,
    shadowsEnabled: true,
    lodDistanceMultiplier: 1.5,
    maxParticleSystems: 100,
    postProcessingEnabled: true,
    textureQuality: 1.0,
    antiAliasSamples: 8,
    drawCallBudget: 3000,
    targetFPS: 60,
  },
  high: {
    resolutionScale: 1.0,
    particleMultiplier: 0.8,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    lodDistanceMultiplier: 1.0,
    maxParticleSystems: 75,
    postProcessingEnabled: true,
    textureQuality: 1.0,
    antiAliasSamples: 4,
    drawCallBudget: 2000,
    targetFPS: 60,
  },
  medium: {
    resolutionScale: 0.9,
    particleMultiplier: 0.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    lodDistanceMultiplier: 0.8,
    maxParticleSystems: 50,
    postProcessingEnabled: false,
    textureQuality: 0.75,
    antiAliasSamples: 2,
    drawCallBudget: 1500,
    targetFPS: 60,
  },
  low: {
    resolutionScale: 0.75,
    particleMultiplier: 0.3,
    shadowMapSize: 512,
    shadowsEnabled: false,
    lodDistanceMultiplier: 0.6,
    maxParticleSystems: 30,
    postProcessingEnabled: false,
    textureQuality: 0.5,
    antiAliasSamples: 0,
    drawCallBudget: 1000,
    targetFPS: 30,
  },
  potato: {
    resolutionScale: 0.5,
    particleMultiplier: 0.15,
    shadowMapSize: 0,
    shadowsEnabled: false,
    lodDistanceMultiplier: 0.4,
    maxParticleSystems: 15,
    postProcessingEnabled: false,
    textureQuality: 0.25,
    antiAliasSamples: 0,
    drawCallBudget: 500,
    targetFPS: 30,
  },
};

/** Map device types to default quality levels */
const DEVICE_QUALITY_MAP: Record<DeviceType, QualityLevel> = {
  desktop: 'high',
  tablet: 'medium',
  foldable: 'medium',
  mobile: 'low',
};

const DEFAULT_CONFIG: PerformanceConfig = {
  dynamicResolution: true,
  minResolutionScale: 0.5,
  maxResolutionScale: 1.0,
  lowFPSThreshold: 25,
  highFPSThreshold: 55,
  scalingAggressiveness: 0.15,
  frameHistoryLength: 60,
  showWarnings: true,
  debugOverlay: false,
  autoQualityAdjustment: true,
  minTargetFPS: 30, // Will be set based on device
  qualityDegradeDelay: 3000, // 3 seconds of sustained low FPS
  qualityUpgradeDelay: 10000, // 10 seconds of sustained high FPS
};

// ============================================================================
// PERFORMANCE MANAGER
// ============================================================================

class PerformanceManager {
  private static instance: PerformanceManager | null = null;

  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private config: PerformanceConfig = { ...DEFAULT_CONFIG };
  private settings: QualitySettings;
  private qualityLevel: QualityLevel;

  // Frame timing history
  private frameHistory: number[] = [];
  private lastFrameTime = 0;

  // Dynamic scaling state
  private currentResolutionScale = 1.0;
  private dynamicScalingActive = false;
  private scalingCooldown = 0;
  private readonly SCALING_COOLDOWN_FRAMES = 30;

  // Battery state
  private batteryLevel: number | null = null;
  private isCharging = true;
  private lowBatteryMode = false;

  // Screen info
  private screenInfo: ScreenInfo;

  // Debug overlay element
  private debugOverlayElement: HTMLDivElement | null = null;

  // Auto quality adjustment state
  private performanceTier: PerformanceTier = 'medium';
  private lowFPSStartTime: number | null = null;
  private highFPSStartTime: number | null = null;
  private qualityLocked = false; // User manually set quality
  private lastQualityAdjustTime = 0;
  private readonly QUALITY_ADJUST_COOLDOWN = 5000; // 5s between adjustments

  // Shadow management
  private shadowGenerators: Map<string, ShadowGenerator> = new Map();

  // GPU benchmark result
  private gpuBenchmark: GPUBenchmarkResult | null = null;

  private constructor() {
    this.screenInfo = getScreenInfo();
    this.qualityLevel = DEVICE_QUALITY_MAP[this.screenInfo.deviceType];
    this.settings = { ...QUALITY_PRESETS[this.qualityLevel] };

    // Set minimum target FPS based on device
    this.config.minTargetFPS = this.screenInfo.deviceType === 'desktop' ? 60 : 30;

    // Initialize battery monitoring
    this.initBatteryMonitoring();
  }

  static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the performance manager with engine and scene
   */
  initialize(engine: Engine, scene: Scene): void {
    this.engine = engine;
    this.scene = scene;

    // Refresh screen info
    this.screenInfo = getScreenInfo();

    // Run GPU benchmark to determine performance tier
    this.runGPUBenchmark();

    // Select initial quality based on device and benchmark
    this.autoSelectQuality();

    // Apply initial settings
    this.applySettings();

    // Set up hardware scaling
    this.currentResolutionScale = this.settings.resolutionScale;
    this.engine.setHardwareScalingLevel(1 / this.currentResolutionScale);

    log.info(
      `Initialized: ${this.qualityLevel} quality for ${this.screenInfo.deviceType} (tier: ${this.performanceTier})`
    );
  }

  /**
   * Run a quick GPU benchmark to determine performance tier
   */
  private runGPUBenchmark(): void {
    if (!this.engine) return;

    const gl = this.engine._gl;
    if (!gl) {
      this.performanceTier = 'medium';
      return;
    }

    // Check WebGL capabilities
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) as number;
    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;

    // Check for WebGL2 features
    const isWebGL2 = gl instanceof WebGL2RenderingContext;

    // Estimate VRAM (rough heuristic based on max texture size)
    const estimatedVRAM = maxTextureSize >= 16384 ? 8192 : maxTextureSize >= 8192 ? 4096 : 2048;

    // Check GPU particle support
    const supportsGPUParticles = isWebGL2 && maxTextureUnits >= 16;

    // Determine tier based on capabilities
    let tier: PerformanceTier;
    if (maxTextureSize >= 16384 && isWebGL2 && maxVertexAttribs >= 16) {
      tier = 'high';
    } else if (maxTextureSize >= 4096 && maxVertexAttribs >= 12) {
      tier = 'medium';
    } else {
      tier = 'low';
    }

    // On mobile, cap tier at medium unless explicitly high-end
    if (this.screenInfo.deviceType === 'mobile') {
      const cores = navigator.hardwareConcurrency ?? 4;
      // @ts-expect-error - deviceMemory is experimental
      const memory = navigator.deviceMemory ?? 4;

      if (cores < 4 || memory < 4) {
        tier = 'low';
      } else if (tier === 'high') {
        tier = 'medium'; // Cap mobile at medium unless proven otherwise
      }
    }

    this.gpuBenchmark = {
      tier,
      drawCallsPerFrame: tier === 'high' ? 3000 : tier === 'medium' ? 1500 : 750,
      averageFrameTime: 0, // Will be calculated during runtime
      supportsGPUParticles,
      maxTextureSize,
      estimatedVRAM,
    };

    this.performanceTier = tier;

    if (this.config.showWarnings) {
      log.info(`GPU Benchmark:`, {
        tier,
        maxTextureSize,
        isWebGL2,
        supportsGPUParticles,
        estimatedVRAM: `${estimatedVRAM}MB`,
      });
    }
  }

  /**
   * Auto-select quality based on device characteristics and GPU benchmark
   */
  private autoSelectQuality(): void {
    const { deviceType, pixelRatio } = this.screenInfo;

    // Start with device-based preset
    let quality = DEVICE_QUALITY_MAP[deviceType];

    // Adjust based on GPU benchmark tier
    if (this.performanceTier === 'low') {
      quality = deviceType === 'mobile' ? 'potato' : 'low';
    } else if (this.performanceTier === 'medium' && quality === 'high') {
      quality = 'medium';
    }

    // Adjust for high-DPI displays on mobile (more GPU load)
    if (deviceType === 'mobile' && pixelRatio > 2.5) {
      quality = 'potato';
    }

    // Adjust for low battery
    if (this.lowBatteryMode) {
      quality = this.lowerQuality(quality);
    }

    this.qualityLevel = quality;
    this.settings = { ...QUALITY_PRESETS[quality] };

    // Adjust resolution scale for high-DPI
    if (pixelRatio > 2 && deviceType !== 'desktop') {
      this.settings.resolutionScale = Math.min(
        this.settings.resolutionScale,
        (1.0 / pixelRatio) * 2
      );
    }

    // Set minimum target FPS based on quality
    this.config.minTargetFPS = this.settings.targetFPS;
  }

  /**
   * Initialize battery monitoring (if available)
   */
  private async initBatteryMonitoring(): Promise<void> {
    if (!('getBattery' in navigator)) return;

    try {
      const battery = await (navigator as NavigatorWithBattery).getBattery();
      this.batteryLevel = battery.level;
      this.isCharging = battery.charging;
      this.updateLowBatteryMode();

      battery.addEventListener('levelchange', () => {
        this.batteryLevel = battery.level;
        this.updateLowBatteryMode();
      });

      battery.addEventListener('chargingchange', () => {
        this.isCharging = battery.charging;
        this.updateLowBatteryMode();
      });
    } catch (e) {
      // Battery API not available or failed
      log.info('Battery monitoring not available');
    }
  }

  private updateLowBatteryMode(): void {
    const wasLowBattery = this.lowBatteryMode;

    // Enable low battery mode when not charging and below 20%
    this.lowBatteryMode = !this.isCharging && this.batteryLevel !== null && this.batteryLevel < 0.2;

    // If entering low battery mode, reduce quality
    if (this.lowBatteryMode && !wasLowBattery) {
      log.info('Entering low battery mode');
      this.setQuality(this.lowerQuality(this.qualityLevel));
    }
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update performance monitoring - call once per frame
   */
  update(): void {
    if (!this.engine) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Skip first frame or unreasonable frame times
    if (frameTime <= 0 || frameTime > 500) return;

    // Add to history
    this.frameHistory.push(frameTime);
    if (this.frameHistory.length > this.config.frameHistoryLength) {
      this.frameHistory.shift();
    }

    // Scaling cooldown
    if (this.scalingCooldown > 0) {
      this.scalingCooldown--;
    }

    // Dynamic resolution scaling
    if (this.config.dynamicResolution && this.scalingCooldown === 0) {
      this.updateDynamicScaling();
    }

    // Auto quality tier adjustment
    if (this.config.autoQualityAdjustment && !this.qualityLocked) {
      this.updateAutoQualityAdjustment(now);
    }

    // Performance warnings
    if (this.config.showWarnings) {
      this.checkPerformanceBudget();
    }

    // Update debug overlay
    if (this.config.debugOverlay) {
      this.updateDebugOverlay();
    }
  }

  /**
   * Monitor FPS over time and automatically adjust quality tier
   */
  private updateAutoQualityAdjustment(now: number): void {
    // Skip if recently adjusted
    if (now - this.lastQualityAdjustTime < this.QUALITY_ADJUST_COOLDOWN) {
      return;
    }

    // Need enough frame history to make decisions
    if (this.frameHistory.length < 30) {
      return;
    }

    const fps = this.calculateFPS();
    const targetFPS = this.config.minTargetFPS;

    // Check for sustained low FPS (below 80% of target)
    if (fps < targetFPS * 0.8) {
      if (this.lowFPSStartTime === null) {
        this.lowFPSStartTime = now;
      } else if (now - this.lowFPSStartTime > this.config.qualityDegradeDelay) {
        // Sustained low FPS - degrade quality
        this.degradeQuality();
        this.lowFPSStartTime = null;
        this.highFPSStartTime = null;
        this.lastQualityAdjustTime = now;
      }
      // Reset high FPS counter
      this.highFPSStartTime = null;
    }
    // Check for sustained high FPS (above 90% of target)
    else if (fps > targetFPS * 0.9) {
      if (this.highFPSStartTime === null) {
        this.highFPSStartTime = now;
      } else if (now - this.highFPSStartTime > this.config.qualityUpgradeDelay) {
        // Sustained high FPS - consider upgrading
        this.attemptQualityUpgrade();
        this.highFPSStartTime = null;
        this.lastQualityAdjustTime = now;
      }
      // Reset low FPS counter
      this.lowFPSStartTime = null;
    } else {
      // FPS in acceptable range - reset both counters
      this.lowFPSStartTime = null;
      this.highFPSStartTime = null;
    }
  }

  /**
   * Degrade quality one step to improve FPS
   */
  private degradeQuality(): void {
    const currentLevel = this.qualityLevel;
    const newLevel = this.lowerQuality(currentLevel);

    if (newLevel !== currentLevel) {
      log.info(
        `Degrading quality: ${currentLevel} -> ${newLevel} (FPS: ${this.calculateFPS().toFixed(1)})`
      );
      this.setQuality(newLevel);
    } else {
      // Already at lowest quality - try more aggressive resolution scaling
      if (this.currentResolutionScale > this.config.minResolutionScale) {
        const newScale = Math.max(
          this.config.minResolutionScale,
          this.currentResolutionScale - 0.1
        );
        this.currentResolutionScale = newScale;
        this.engine?.setHardwareScalingLevel(1 / newScale);
        this.dynamicScalingActive = true;
        log.info(`Reducing resolution to ${Math.round(newScale * 100)}%`);
      }
    }
  }

  /**
   * Attempt to upgrade quality if FPS allows
   */
  private attemptQualityUpgrade(): void {
    // Only upgrade if we have a lot of headroom
    const fps = this.calculateFPS();
    const targetFPS = this.config.minTargetFPS;

    // Need at least 110% of target FPS to consider upgrading
    if (fps < targetFPS * 1.1) {
      return;
    }

    // First, try to restore resolution if it was lowered
    if (this.dynamicScalingActive && this.currentResolutionScale < this.settings.resolutionScale) {
      const newScale = Math.min(this.settings.resolutionScale, this.currentResolutionScale + 0.05);
      this.currentResolutionScale = newScale;
      this.engine?.setHardwareScalingLevel(1 / newScale);

      if (newScale >= this.settings.resolutionScale - 0.01) {
        this.dynamicScalingActive = false;
      }
      log.info(`Restoring resolution to ${Math.round(newScale * 100)}%`);
      return;
    }

    // Then consider quality upgrade
    const newLevel = this.raiseQuality(this.qualityLevel);
    if (newLevel !== this.qualityLevel) {
      // Don't upgrade beyond initial recommended quality
      const maxQuality = DEVICE_QUALITY_MAP[this.screenInfo.deviceType];
      const levels: QualityLevel[] = ['potato', 'low', 'medium', 'high', 'ultra'];
      if (levels.indexOf(newLevel) <= levels.indexOf(maxQuality)) {
        log.info(`Upgrading quality: ${this.qualityLevel} -> ${newLevel}`);
        this.setQuality(newLevel);
      }
    }
  }

  /**
   * Raise quality by one level
   */
  private raiseQuality(current: QualityLevel): QualityLevel {
    const levels: QualityLevel[] = ['potato', 'low', 'medium', 'high', 'ultra'];
    const idx = levels.indexOf(current);
    return levels[Math.min(idx + 1, levels.length - 1)];
  }

  /**
   * Dynamic resolution scaling based on frame rate
   */
  private updateDynamicScaling(): void {
    if (!this.engine || this.frameHistory.length < 10) return;

    const fps = this.calculateFPS();
    const targetFPS = this.settings.targetFPS;

    // Below low threshold - reduce resolution
    if (fps < this.config.lowFPSThreshold) {
      const reduction = this.config.scalingAggressiveness;
      const newScale = Math.max(
        this.config.minResolutionScale,
        this.currentResolutionScale - reduction
      );

      if (newScale < this.currentResolutionScale) {
        this.currentResolutionScale = newScale;
        this.engine.setHardwareScalingLevel(1 / newScale);
        this.dynamicScalingActive = true;
        this.scalingCooldown = this.SCALING_COOLDOWN_FRAMES;

        if (this.config.showWarnings) {
          log.info(
            `Reduced resolution to ${Math.round(newScale * 100)}% (FPS: ${fps.toFixed(1)})`
          );
        }
      }
    }
    // Above high threshold - increase resolution
    else if (fps > this.config.highFPSThreshold && this.dynamicScalingActive) {
      const increase = this.config.scalingAggressiveness * 0.5; // Recover slower
      const maxScale = Math.min(this.config.maxResolutionScale, this.settings.resolutionScale);
      const newScale = Math.min(maxScale, this.currentResolutionScale + increase);

      if (newScale > this.currentResolutionScale) {
        this.currentResolutionScale = newScale;
        this.engine.setHardwareScalingLevel(1 / newScale);
        this.scalingCooldown = this.SCALING_COOLDOWN_FRAMES;

        // Check if we're back to target scale
        if (newScale >= maxScale - 0.01) {
          this.dynamicScalingActive = false;
        }
      }
    }
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const fps = this.calculateFPS();
    const frameTime =
      this.frameHistory.length > 0 ? this.frameHistory[this.frameHistory.length - 1] : 0;

    // Calculate percentiles
    const sorted = [...this.frameHistory].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      fps,
      frameTime,
      p50FrameTime: sorted[p50Index] ?? 0,
      p95FrameTime: sorted[p95Index] ?? 0,
      drawCalls: this.scene?.getEngine()._drawCalls?.current ?? 0,
      activeMeshes: this.scene?.getActiveMeshes().length ?? 0,
      activeParticles: this.scene?.particleSystems?.length ?? 0,
      totalTriangles:
        this.scene?.meshes?.reduce((total, mesh) => total + (mesh.getTotalVertices?.() ?? 0), 0) ??
        0,
      gpuMemory: 0, // Not reliably available cross-browser
      qualityLevel: this.qualityLevel,
      dynamicScalingActive: this.dynamicScalingActive,
      currentResolutionScale: this.currentResolutionScale,
    };
  }

  private calculateFPS(): number {
    if (this.frameHistory.length === 0) return 60;
    const avgFrameTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
  }

  // ============================================================================
  // QUALITY MANAGEMENT
  // ============================================================================

  /**
   * Get current quality settings
   */
  getSettings(): Readonly<QualitySettings> {
    return this.settings;
  }

  /**
   * Get current quality level
   */
  getQuality(): QualityLevel {
    return this.qualityLevel;
  }

  /**
   * Set quality level
   * @param level Quality level to set
   * @param userInitiated Whether this was explicitly set by the user (locks auto-adjustment)
   */
  setQuality(level: QualityLevel, userInitiated = false): void {
    if (level === this.qualityLevel) return;

    this.qualityLevel = level;
    this.settings = { ...QUALITY_PRESETS[level] };

    // Lock quality if user explicitly set it
    if (userInitiated) {
      this.qualityLocked = true;
    }

    // Adjust for device pixel ratio
    if (this.screenInfo.pixelRatio > 2 && this.screenInfo.deviceType !== 'desktop') {
      this.settings.resolutionScale = Math.min(
        this.settings.resolutionScale,
        (1.0 / this.screenInfo.pixelRatio) * 2
      );
    }

    // Update minimum target FPS
    this.config.minTargetFPS = this.settings.targetFPS;

    this.applySettings();

    // Update shadow generators
    this.updateShadowGenerators();

    log.info(`Quality set to: ${level}${userInitiated ? ' (user)' : ''}`);
  }

  /**
   * Unlock automatic quality adjustment (after user manually set quality)
   */
  unlockQuality(): void {
    this.qualityLocked = false;
    log.info('Quality auto-adjustment unlocked');
  }

  /**
   * Check if quality is locked by user
   */
  isQualityLocked(): boolean {
    return this.qualityLocked;
  }

  /**
   * Lower quality by one level
   */
  private lowerQuality(current: QualityLevel): QualityLevel {
    const levels: QualityLevel[] = ['ultra', 'high', 'medium', 'low', 'potato'];
    const idx = levels.indexOf(current);
    return levels[Math.min(idx + 1, levels.length - 1)];
  }

  /**
   * Apply current quality settings to engine and scene
   */
  private applySettings(): void {
    if (!this.engine || !this.scene) return;

    // Resolution
    this.currentResolutionScale = this.settings.resolutionScale;
    this.engine.setHardwareScalingLevel(1 / this.currentResolutionScale);

    // Shadows
    if (!this.settings.shadowsEnabled) {
      this.scene.shadowsEnabled = false;
    } else {
      this.scene.shadowsEnabled = true;
      // Shadow generator settings would be applied per-light in level code
    }

    // Anti-aliasing (requires engine recreation for MSAA, so we use FXAA fallback)
    // The actual AA sample count is set at engine creation
    // We can enable/disable scene-level effects

    // Scene optimizations for mobile
    if (this.settings.targetFPS === 30) {
      // Lower target = less demanding, can skip octree updates more
      this.scene.autoClear = true;
      this.scene.autoClearDepthAndStencil = true;
    }
  }

  // ============================================================================
  // PARTICLE OPTIMIZATION
  // ============================================================================

  /**
   * Get adjusted particle count for current quality settings
   */
  getAdjustedParticleCount(baseCount: number): number {
    return Math.max(1, Math.floor(baseCount * this.settings.particleMultiplier));
  }

  /**
   * Check if we can create more particle systems
   */
  canCreateParticleSystem(): boolean {
    const currentCount = this.scene?.particleSystems?.length ?? 0;
    return currentCount < this.settings.maxParticleSystems;
  }

  /**
   * Get particle emission rate multiplier
   */
  getParticleEmissionMultiplier(): number {
    return this.settings.particleMultiplier;
  }

  // ============================================================================
  // LOD MANAGEMENT
  // ============================================================================

  /**
   * Get adjusted LOD distance for current quality settings
   */
  getAdjustedLODDistance(baseDistance: number): number {
    return baseDistance * this.settings.lodDistanceMultiplier;
  }

  // ============================================================================
  // SHADOW MANAGEMENT
  // ============================================================================

  /**
   * Register a shadow generator for quality management
   */
  registerShadowGenerator(name: string, light: IShadowLight): ShadowGenerator {
    // Create shadow generator with quality-appropriate settings
    const mapSize = this.settings.shadowMapSize || 1024;
    const generator = new ShadowGenerator(mapSize, light);

    // Apply quality-based settings
    this.applyShadowQualitySettings(generator);

    this.shadowGenerators.set(name, generator);
    return generator;
  }

  /**
   * Unregister and dispose a shadow generator
   */
  unregisterShadowGenerator(name: string): void {
    const generator = this.shadowGenerators.get(name);
    if (generator) {
      generator.dispose();
      this.shadowGenerators.delete(name);
    }
  }

  /**
   * Get a registered shadow generator
   */
  getShadowGenerator(name: string): ShadowGenerator | undefined {
    return this.shadowGenerators.get(name);
  }

  /**
   * Apply shadow quality settings to a generator
   */
  private applyShadowQualitySettings(generator: ShadowGenerator): void {
    const quality = this.qualityLevel;

    switch (quality) {
      case 'ultra':
        generator.useBlurExponentialShadowMap = true;
        generator.blurKernel = 32;
        generator.useKernelBlur = true;
        generator.depthScale = 50;
        generator.bias = 0.0005;
        break;
      case 'high':
        generator.useBlurExponentialShadowMap = true;
        generator.blurKernel = 16;
        generator.useKernelBlur = true;
        generator.depthScale = 50;
        generator.bias = 0.001;
        break;
      case 'medium':
        generator.useExponentialShadowMap = true;
        generator.depthScale = 50;
        generator.bias = 0.001;
        break;
      case 'low':
        generator.usePoissonSampling = false;
        generator.bias = 0.002;
        break;
      case 'potato':
        // No shadows on potato - handled by shadowsEnabled = false
        break;
    }
  }

  /**
   * Update all shadow generators with current quality settings
   */
  private updateShadowGenerators(): void {
    if (!this.settings.shadowsEnabled) {
      // Disable all shadow generators
      for (const generator of this.shadowGenerators.values()) {
        generator.getShadowMap()!.renderList = [];
      }
      return;
    }

    // Update map sizes if quality changed significantly
    for (const generator of this.shadowGenerators.values()) {
      this.applyShadowQualitySettings(generator);

      // Note: Changing shadow map size requires recreating the generator
      // For now we just update the quality settings
    }
  }

  /**
   * Get recommended shadow map size for current quality
   */
  getShadowMapSize(): number {
    return this.settings.shadowMapSize;
  }

  /**
   * Check if shadows should be enabled
   */
  areShadowsEnabled(): boolean {
    return this.settings.shadowsEnabled && this.settings.shadowMapSize > 0;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Configure performance manager options
   */
  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };

    // Handle debug overlay toggle
    if (config.debugOverlay !== undefined) {
      if (config.debugOverlay) {
        this.createDebugOverlay();
      } else {
        this.removeDebugOverlay();
      }
    }
  }

  /**
   * Sync with game settings from SettingsContext
   * Call this when user changes settings in the UI
   */
  syncWithGameSettings(settings: {
    graphicsQuality?: 'low' | 'medium' | 'high' | 'ultra';
    shadowsEnabled?: boolean;
    shadowQuality?: 'off' | 'low' | 'medium' | 'high';
    particlesEnabled?: boolean;
    particleDensity?: 'off' | 'low' | 'medium' | 'high';
    postProcessingEnabled?: boolean;
    resolutionScale?: number;
    fpsLimit?: number;
    showFPS?: boolean;
  }): void {
    // Map graphics quality to our quality levels
    if (settings.graphicsQuality) {
      const qualityMap: Record<string, QualityLevel> = {
        low: 'low',
        medium: 'medium',
        high: 'high',
        ultra: 'ultra',
      };
      this.setQuality(qualityMap[settings.graphicsQuality] ?? 'medium', true);
    }

    // Shadow settings override
    if (settings.shadowsEnabled !== undefined) {
      this.settings.shadowsEnabled = settings.shadowsEnabled;
      if (this.scene) {
        this.scene.shadowsEnabled = settings.shadowsEnabled;
      }
    }

    if (settings.shadowQuality !== undefined) {
      const shadowMapSizes: Record<string, number> = {
        off: 0,
        low: 512,
        medium: 1024,
        high: 2048,
      };
      this.settings.shadowMapSize = shadowMapSizes[settings.shadowQuality] ?? 1024;
      this.settings.shadowsEnabled = settings.shadowQuality !== 'off';
      this.updateShadowGenerators();
    }

    // Particle settings
    if (settings.particlesEnabled !== undefined) {
      this.settings.particleMultiplier = settings.particlesEnabled
        ? this.settings.particleMultiplier
        : 0;
    }

    if (settings.particleDensity !== undefined) {
      const densityMap: Record<string, number> = {
        off: 0,
        low: 0.25,
        medium: 0.5,
        high: 1.0,
      };
      this.settings.particleMultiplier = densityMap[settings.particleDensity] ?? 0.5;
    }

    // Post-processing
    if (settings.postProcessingEnabled !== undefined) {
      this.settings.postProcessingEnabled = settings.postProcessingEnabled;
    }

    // Resolution scale
    if (settings.resolutionScale !== undefined) {
      this.settings.resolutionScale = settings.resolutionScale;
      this.currentResolutionScale = settings.resolutionScale;
      this.engine?.setHardwareScalingLevel(1 / settings.resolutionScale);
    }

    // FPS limit
    if (settings.fpsLimit !== undefined && this.engine) {
      // Note: Babylon.js doesn't have built-in FPS limiting in the engine
      // This would need to be implemented via requestAnimationFrame throttling
      // For now, we just store the setting
      this.settings.targetFPS = settings.fpsLimit === 0 ? 120 : settings.fpsLimit;
    }

    // Debug overlay (FPS display)
    if (settings.showFPS !== undefined) {
      this.configure({ debugOverlay: settings.showFPS });
    }
  }

  /**
   * Get the detected performance tier
   */
  getPerformanceTier(): PerformanceTier {
    return this.performanceTier;
  }

  /**
   * Get GPU benchmark results
   */
  getGPUBenchmark(): GPUBenchmarkResult | null {
    return this.gpuBenchmark;
  }

  /**
   * Check if the device supports GPU particles
   */
  supportsGPUParticles(): boolean {
    return this.gpuBenchmark?.supportsGPUParticles ?? false;
  }

  /**
   * Check if we're on a mobile device
   */
  isMobile(): boolean {
    return this.screenInfo.deviceType === 'mobile';
  }

  /**
   * Check if we're on a touch device
   */
  isTouchDevice(): boolean {
    return this.screenInfo.isTouchDevice;
  }

  /**
   * Get screen information
   */
  getScreenInfo(): ScreenInfo {
    return this.screenInfo;
  }

  // ============================================================================
  // PERFORMANCE WARNINGS
  // ============================================================================

  private checkPerformanceBudget(): void {
    if (!this.scene) return;

    const metrics = this.getMetrics();

    // Draw call warning
    if (metrics.drawCalls > this.settings.drawCallBudget) {
      log.warn(
        `Draw calls (${metrics.drawCalls}) exceed budget (${this.settings.drawCallBudget})`
      );
    }

    // Particle system warning
    if (metrics.activeParticles > this.settings.maxParticleSystems) {
      log.warn(
        `Particle systems (${metrics.activeParticles}) exceed limit (${this.settings.maxParticleSystems})`
      );
    }

    // P95 frame time warning (targeting 60fps = 16.67ms, 30fps = 33.33ms)
    const targetFrameTime = 1000 / this.settings.targetFPS;
    if (metrics.p95FrameTime > targetFrameTime * 2) {
      log.warn(
        `P95 frame time (${metrics.p95FrameTime.toFixed(1)}ms) exceeds budget (${(targetFrameTime * 2).toFixed(1)}ms)`
      );
    }
  }

  // ============================================================================
  // DEBUG OVERLAY
  // ============================================================================

  private createDebugOverlay(): void {
    if (this.debugOverlayElement) return;

    this.debugOverlayElement = document.createElement('div');
    this.debugOverlayElement.id = 'perf-debug-overlay';
    this.debugOverlayElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 4px;
      z-index: 99999;
      pointer-events: none;
      line-height: 1.4;
    `;
    document.body.appendChild(this.debugOverlayElement);
  }

  private removeDebugOverlay(): void {
    if (this.debugOverlayElement) {
      this.debugOverlayElement.remove();
      this.debugOverlayElement = null;
    }
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlayElement) return;

    const m = this.getMetrics();
    const targetFPS = this.config.minTargetFPS;
    const fpsColor =
      m.fps >= targetFPS * 0.9 ? '#00ff00' : m.fps >= targetFPS * 0.6 ? '#ffff00' : '#ff0000';

    // Calculate auto-quality status
    let autoQualityStatus = '';
    if (this.qualityLocked) {
      autoQualityStatus = 'LOCKED';
    } else if (this.lowFPSStartTime) {
      const elapsed = Math.round((performance.now() - this.lowFPSStartTime) / 1000);
      autoQualityStatus = `DEGRADING in ${Math.max(0, Math.round(this.config.qualityDegradeDelay / 1000) - elapsed)}s`;
    } else if (this.highFPSStartTime) {
      const elapsed = Math.round((performance.now() - this.highFPSStartTime) / 1000);
      autoQualityStatus = `UPGRADING in ${Math.max(0, Math.round(this.config.qualityUpgradeDelay / 1000) - elapsed)}s`;
    } else {
      autoQualityStatus = 'STABLE';
    }

    this.debugOverlayElement.innerHTML = `
      <div style="color: ${fpsColor}; font-size: 16px; font-weight: bold;">
        FPS: ${m.fps.toFixed(0)} / ${targetFPS}
      </div>
      <div>Frame: ${m.frameTime.toFixed(1)}ms</div>
      <div>P50: ${m.p50FrameTime.toFixed(1)}ms | P95: ${m.p95FrameTime.toFixed(1)}ms</div>
      <div>Quality: ${m.qualityLevel.toUpperCase()} (${this.performanceTier})</div>
      <div>Auto: ${autoQualityStatus}</div>
      <div>Resolution: ${Math.round(m.currentResolutionScale * 100)}%${m.dynamicScalingActive ? ' (scaling)' : ''}</div>
      <div>Shadows: ${this.settings.shadowsEnabled ? this.settings.shadowMapSize + 'px' : 'OFF'}</div>
      <div>Meshes: ${m.activeMeshes} | Draw: ${m.drawCalls}</div>
      <div>Particles: ${m.activeParticles}/${this.settings.maxParticleSystems} (x${this.settings.particleMultiplier.toFixed(2)})</div>
      ${this.batteryLevel !== null ? `<div>Battery: ${Math.round(this.batteryLevel * 100)}%${this.lowBatteryMode ? ' (SAVING)' : ''}</div>` : ''}
    `;
  }

  /**
   * Toggle debug overlay visibility
   */
  toggleDebugOverlay(): void {
    this.configure({ debugOverlay: !this.config.debugOverlay });
  }

  // ============================================================================
  // DISPOSAL
  // ============================================================================

  dispose(): void {
    this.removeDebugOverlay();

    // Dispose shadow generators
    for (const [name, generator] of this.shadowGenerators) {
      generator.dispose();
    }
    this.shadowGenerators.clear();

    this.engine = null;
    this.scene = null;
    this.frameHistory = [];
    this.gpuBenchmark = null;
    this.lowFPSStartTime = null;
    this.highFPSStartTime = null;
    PerformanceManager.instance = null;
  }
}

// ============================================================================
// TYPES FOR BATTERY API
// ============================================================================

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getPerformanceManager = PerformanceManager.getInstance.bind(PerformanceManager);

// Export a convenience function to check if we're on mobile
export function isMobileDevice(): boolean {
  return getPerformanceManager().isMobile();
}

// Export function to get particle multiplier
export function getParticleMultiplier(): number {
  return getPerformanceManager().getParticleEmissionMultiplier();
}

// Export function to get adjusted particle count
export function getAdjustedParticleCount(baseCount: number): number {
  return getPerformanceManager().getAdjustedParticleCount(baseCount);
}

// Export function to get performance tier
export function getPerformanceTier(): PerformanceTier {
  return getPerformanceManager().getPerformanceTier();
}

// Export function to check shadow support
export function areShadowsEnabled(): boolean {
  return getPerformanceManager().areShadowsEnabled();
}

// Export function to check GPU particle support
export function supportsGPUParticles(): boolean {
  return getPerformanceManager().supportsGPUParticles();
}

// Export function to get recommended shadow map size
export function getShadowMapSize(): number {
  return getPerformanceManager().getShadowMapSize();
}
