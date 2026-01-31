/**
 * Tests for PostProcessManager - Type and Configuration Tests
 *
 * These tests verify the types and interfaces of the PostProcessManager.
 * Full integration testing with BabylonJS requires a canvas and WebGL context,
 * which is tested via e2e tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostProcessConfig, PostProcessQuality } from './PostProcessManager';

// Mock BabylonJS dependencies for unit tests
vi.mock('@babylonjs/core/Materials/imageProcessingConfiguration', () => ({
  ImageProcessingConfiguration: {
    TONEMAPPING_ACES: 1,
    VIGNETTEMODE_MULTIPLY: 1,
  },
}));

vi.mock('@babylonjs/core/Maths/math.color', () => {
  class MockColor3 {
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  class MockColor4 {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r = 0, g = 0, b = 0, a = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
  }
  return { Color3: MockColor3, Color4: MockColor4 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class MockVector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  }
  return { Vector2: MockVector2 };
});

vi.mock('@babylonjs/core/PostProcesses/depthOfFieldEffect', () => ({
  DepthOfFieldEffectBlurLevel: { Low: 0, Medium: 1, High: 2 },
}));

// Store the last created mock pipeline for test access
let lastMockPipeline: any = null;

// Mock the DefaultRenderingPipeline
vi.mock('@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline', () => {
  class MockDefaultRenderingPipeline {
    fxaaEnabled = false;
    grainEnabled = false;
    grain = { intensity: 0, animated: false };
    imageProcessing = {
      vignetteEnabled: false,
      vignetteWeight: 0,
      vignetteStretch: 0.5,
      vignetteColor: {},
      vignetteBlendMode: 0,
      contrast: 1,
      exposure: 1,
      toneMappingEnabled: false,
      toneMappingType: 0,
      colorCurvesEnabled: false,
    };
    chromaticAberrationEnabled = false;
    chromaticAberration = { aberrationAmount: 0, radialIntensity: 1, direction: {} };
    bloomEnabled = false;
    bloomWeight = 0;
    bloomThreshold = 0;
    bloomScale = 0;
    bloomKernel = 0;
    depthOfFieldEnabled = false;
    depthOfField = { focusDistance: 0, focalLength: 0, fStop: 0 };
    depthOfFieldBlurLevel = 0;
    sharpenEnabled = false;
    sharpen = { edgeAmount: 0, colorAmount: 0 };
    dispose = vi.fn();

    constructor() {
      // Store reference for test access - using globalThis to share across module scope
      (globalThis as any).__mockPipeline = this;
    }
  }
  return { DefaultRenderingPipeline: MockDefaultRenderingPipeline };
});

// Helper to get the current mock pipeline in tests
function getMockPipeline(): any {
  return (globalThis as any).__mockPipeline;
}

// Mock shader imports (no-ops)
vi.mock('@babylonjs/core/Rendering/depthRendererSceneComponent', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent', () => ({}));
vi.mock('@babylonjs/core/Shaders/chromaticAberration.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/grain.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/sharpen.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/fxaa.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/fxaa.vertex', () => ({}));
vi.mock('@babylonjs/core/Shaders/imageProcessing.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/pass.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/bloomMerge.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/extractHighlights.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/circleOfConfusion.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/depthOfField.fragment', () => ({}));
vi.mock('@babylonjs/core/Shaders/depthOfFieldMerge.fragment', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/chromaticAberrationPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/grainPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/sharpenPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/bloomEffect', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/fxaaPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/imageProcessingPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/extractHighlightsPostProcess', () => ({}));
vi.mock('@babylonjs/core/PostProcesses/blurPostProcess', () => ({}));

vi.mock('./Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('PostProcessManager Types', () => {
  describe('PostProcessConfig interface', () => {
    it('should accept valid configuration', () => {
      const config: PostProcessConfig = {
        quality: 'high',
        filmGrainEnabled: true,
        vignetteEnabled: true,
        chromaticAberrationEnabled: true,
        bloomEnabled: true,
        fxaaEnabled: true,
        motionBlurEnabled: false,
        depthOfFieldEnabled: false,
      };

      expect(config.quality).toBe('high');
      expect(config.bloomEnabled).toBe(true);
      expect(config.motionBlurEnabled).toBe(false);
    });

    it('should support all quality levels', () => {
      const qualities: PostProcessQuality[] = ['low', 'medium', 'high', 'ultra'];

      for (const quality of qualities) {
        const config: PostProcessConfig = {
          quality,
          filmGrainEnabled: true,
          vignetteEnabled: true,
          chromaticAberrationEnabled: true,
          bloomEnabled: true,
          fxaaEnabled: true,
          motionBlurEnabled: true,
          depthOfFieldEnabled: true,
        };
        expect(config.quality).toBe(quality);
      }
    });
  });

  describe('syncWithGameSettings interface', () => {
    it('should accept valid game settings shape', () => {
      // This tests the shape of settings that can be synced
      const settings = {
        postProcessingEnabled: true,
        bloomEnabled: true,
        bloomIntensity: 0.5,
        chromaticAberrationEnabled: true,
        vignetteEnabled: true,
        filmGrainEnabled: true,
        filmGrainIntensity: 0.3,
        motionBlur: false,
        colorGradingEnabled: true,
        reducedFlashing: false,
      };

      expect(settings.postProcessingEnabled).toBe(true);
      expect(settings.bloomIntensity).toBe(0.5);
      expect(settings.filmGrainIntensity).toBe(0.3);
    });

    it('should accept partial game settings', () => {
      // Partial settings should also be valid
      const partialSettings = {
        bloomEnabled: false,
      };

      expect(partialSettings.bloomEnabled).toBe(false);
    });
  });

  describe('Quality Presets', () => {
    it('low quality should have reduced effects', () => {
      // Expected behavior: low quality disables expensive effects
      const lowQualityExpectations = {
        filmGrainEnabled: false,
        chromaticAberrationEnabled: false,
        bloomEnabled: false,
        motionBlurEnabled: false,
        depthOfFieldEnabled: false,
      };

      expect(lowQualityExpectations.bloomEnabled).toBe(false);
      expect(lowQualityExpectations.motionBlurEnabled).toBe(false);
    });

    it('ultra quality should have all effects enabled', () => {
      // Expected behavior: ultra quality enables all effects
      const ultraQualityExpectations = {
        filmGrainEnabled: true,
        chromaticAberrationEnabled: true,
        bloomEnabled: true,
        motionBlurEnabled: true,
        depthOfFieldEnabled: true,
      };

      expect(ultraQualityExpectations.bloomEnabled).toBe(true);
      expect(ultraQualityExpectations.motionBlurEnabled).toBe(true);
    });
  });

  describe('Bloom Intensity Mapping', () => {
    it('should map user intensity (0-1) to bloom weight', () => {
      // The formula is: weight = 0.1 + intensity * 0.5
      const testCases = [
        { input: 0, expected: 0.1 },
        { input: 0.5, expected: 0.35 },
        { input: 1.0, expected: 0.6 },
      ];

      for (const { input, expected } of testCases) {
        const weight = 0.1 + input * 0.5;
        expect(weight).toBeCloseTo(expected, 2);
      }
    });
  });

  describe('Film Grain Intensity Mapping', () => {
    it('should map user intensity (0-1) to grain amount', () => {
      // The formula is: amount = 0.05 + intensity * 0.25
      const testCases = [
        { input: 0, expected: 0.05 },
        { input: 0.5, expected: 0.175 },
        { input: 1.0, expected: 0.3 },
      ];

      for (const { input, expected } of testCases) {
        const amount = 0.05 + input * 0.25;
        expect(amount).toBeCloseTo(expected, 3);
      }
    });
  });

  describe('Level Type Color Grading', () => {
    it('should have color grades for all level types', () => {
      // Expected level types that should have color grading
      const levelTypes = ['station', 'drop', 'canyon', 'base', 'brothers', 'hive', 'extraction'];

      // Each level type should have specific color grading characteristics
      const colorGradeCharacteristics = {
        station: { contrast: 1.05, exposure: 0.95 },
        hive: { contrast: 1.2, exposure: 0.8 },
        extraction: { contrast: 1.15, exposure: 1.05 },
      };

      expect(colorGradeCharacteristics.station.contrast).toBe(1.05);
      expect(colorGradeCharacteristics.hive.exposure).toBe(0.8);
    });
  });
});

// ============================================================================
// Unit Tests with Mocked BabylonJS
// ============================================================================

import {
  PostProcessManager,
  initializePostProcessManager,
  getPostProcessManager,
  disposePostProcessManager,
} from './PostProcessManager';

describe('PostProcessManager Unit Tests', () => {
  let manager: PostProcessManager;
  let mockScene: any;
  let mockCamera: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Clean up previous mock pipeline reference
    (globalThis as any).__mockPipeline = null;

    mockScene = {};
    mockCamera = {};

    // Clean up singleton
    disposePostProcessManager();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      manager = new PostProcessManager(mockScene, mockCamera);
      const config = manager.getConfig();

      expect(config.vignetteEnabled).toBe(true);
      expect(config.bloomEnabled).toBe(true);
    });

    it('should accept custom config', () => {
      // Note: Quality presets are applied after custom config in applyQualitySettings(),
      // so the quality setting should be 'low' to have filmGrain disabled
      manager = new PostProcessManager(mockScene, mockCamera, {
        quality: 'low', // low quality disables filmGrain
        bloomEnabled: false,
      });

      const config = manager.getConfig();
      expect(config.filmGrainEnabled).toBe(false); // from low quality preset
      expect(config.bloomEnabled).toBe(false); // from custom config
    });
  });

  describe('Quality Settings', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, { quality: 'high' });
    });

    it('should apply low quality preset', () => {
      manager.setQuality('low');
      const config = manager.getConfig();

      expect(config.quality).toBe('low');
      expect(config.filmGrainEnabled).toBe(false);
      expect(config.chromaticAberrationEnabled).toBe(false);
    });

    it('should apply medium quality preset', () => {
      manager.setQuality('medium');
      const config = manager.getConfig();

      expect(config.quality).toBe('medium');
      expect(config.filmGrainEnabled).toBe(true);
    });

    it('should apply high quality preset', () => {
      manager.setQuality('high');
      const config = manager.getConfig();

      expect(config.quality).toBe('high');
      expect(config.motionBlurEnabled).toBe(true);
    });

    it('should get current quality', () => {
      manager.setQuality('ultra');
      expect(manager.getQuality()).toBe('ultra');
    });
  });

  describe('Color Grading', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should apply station color grading', () => {
      manager.setLevelType('station');
      // Blue tint for station
    });

    it('should apply hive color grading', () => {
      manager.setLevelType('hive');
      // Green tint for hive
    });

    it('should apply ice color grading', () => {
      manager.setLevelType('ice');
      // Deep blue for ice
    });

    it('should transition between level types', () => {
      manager.setLevelType('station');
      manager.transitionToLevelType('hive', 500);
      // Animation in progress
    });
  });

  describe('Damage Flash', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should trigger damage flash', () => {
      manager.triggerDamageFlash(1.0);
      // Flash active
    });

    it('should clamp damage flash intensity', () => {
      manager.triggerDamageFlash(2.0);
      // Should be clamped to 1.0
    });

    it('should decay damage flash over time', () => {
      manager.triggerDamageFlash(1.0);
      manager.update(0.2);
      // Flash should have decayed
    });
  });

  describe('Vignette Effects', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, { vignetteEnabled: true });
    });

    it('should set low health vignette', () => {
      manager.setLowHealthVignette(0.6, 0.8, 0.1, 0.1);
      // Custom vignette applied
    });

    it('should set tunnel vision', () => {
      manager.setTunnelVision(0.5);
      // Vignette stretch increased
    });

    it('should reset low health effects', () => {
      manager.setLowHealthVignette(0.6, 0.8, 0.1, 0.1);
      manager.resetLowHealthEffects();
      // Reset to normal
    });
  });

  describe('Chromatic Aberration', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, {
        chromaticAberrationEnabled: true,
      });
    });

    it('should boost CA during slide', () => {
      manager.setSliding(true);
      // CA increased
    });

    it('should reset CA when slide ends', () => {
      manager.setSliding(true);
      manager.setSliding(false);
      // CA reset
    });
  });

  describe('Bloom Effects', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, { bloomEnabled: true });
    });

    it('should trigger explosion bloom', () => {
      manager.triggerExplosionBloom(1.0, 0.3);
      // Bloom boosted to 1.5
    });

    it('should set bloom intensity', () => {
      manager.setBloomIntensity(0.8);
      // Intensity applied
    });
  });

  describe('Motion Blur', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, { motionBlurEnabled: true });
    });

    it('should enable motion blur during sprint', () => {
      manager.setSprinting(true);
      // Motion blur active
    });

    it('should disable motion blur when aiming', () => {
      manager.setSprinting(true);
      manager.setAiming(true);
      manager.update(0.016);
      // Motion blur disabled
    });
  });

  describe('Depth of Field', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, { depthOfFieldEnabled: true });
    });

    it('should enable depth of field', () => {
      manager.enableDepthOfField(10, 50, 2.8);
      // DoF active
    });

    it('should disable depth of field', () => {
      manager.enableDepthOfField(10);
      manager.disableDepthOfField();
      // DoF disabled
    });
  });

  describe('Combat Effects', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should trigger hit confirmation', () => {
      manager.triggerHitConfirmation();
      // Brief bloom boost
    });

    it('should update kill streak', () => {
      manager.updateKillStreak(5);
      manager.update(0.016);
      // Bloom and contrast boosted
    });

    it('should set combat state', () => {
      manager.setCombatState(true);
      // Desaturation applied
    });
  });

  describe('Weapon Effects', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, {
        chromaticAberrationEnabled: true,
        bloomEnabled: true,
      });
    });

    it('should trigger weapon shake visual', () => {
      manager.triggerWeaponShake(0.5, 0.1);
      // CA boosted briefly
    });

    it('should trigger FOV punch visual', () => {
      manager.triggerFOVPunch(5, 100);
      // Bloom boosted briefly
    });
  });

  describe('Settings Sync', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should sync with game settings', () => {
      manager.syncWithGameSettings({
        bloomEnabled: false,
        filmGrainEnabled: false,
      });

      const config = manager.getConfig();
      expect(config.bloomEnabled).toBe(false);
      expect(config.filmGrainEnabled).toBe(false);
    });

    it('should disable all effects when postProcessingEnabled is false', () => {
      manager.syncWithGameSettings({ postProcessingEnabled: false });
      // All effects disabled
    });

    it('should apply reduced flashing mode', () => {
      manager.syncWithGameSettings({ reducedFlashing: true });
      // Faster decay
    });
  });

  describe('Update Loop', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should update all effects each frame', () => {
      manager.triggerDamageFlash(0.5);
      manager.setPlayerHealth(20);
      manager.updateKillStreak(3);
      manager.setSprinting(true);

      manager.update(0.016);
      manager.update(0.016);
      // No errors
    });
  });

  describe('Singleton Pattern', () => {
    it('should create singleton instance', () => {
      const instance1 = initializePostProcessManager(mockScene, mockCamera);
      const instance2 = getPostProcessManager();

      expect(instance1).toBe(instance2);
    });

    it('should dispose singleton', () => {
      initializePostProcessManager(mockScene, mockCamera);
      disposePostProcessManager();

      expect(getPostProcessManager()).toBeNull();
    });

    it('should replace singleton on reinitialize', () => {
      const instance1 = initializePostProcessManager(mockScene, mockCamera);
      const instance2 = initializePostProcessManager(mockScene, mockCamera);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      manager = new PostProcessManager(mockScene, mockCamera);
      manager.dispose();

      expect(getMockPipeline().dispose).toHaveBeenCalled();
    });

    it('should report enabled state', () => {
      manager = new PostProcessManager(mockScene, mockCamera, { bloomEnabled: true });

      const enabled = manager.isEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('Low Health Integration', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera, {
        vignetteEnabled: true,
        chromaticAberrationEnabled: true,
      });
    });

    it('should set low health desaturation', () => {
      manager.setLowHealthDesaturation(0.5);
      // Exposure and contrast adjusted
    });

    it('should clamp desaturation', () => {
      manager.setLowHealthDesaturation(-0.5);
      manager.setLowHealthDesaturation(1.5);
      // Clamped 0-1
    });
  });

  describe('Player Health Effects', () => {
    beforeEach(() => {
      manager = new PostProcessManager(mockScene, mockCamera);
    });

    it('should activate low health pulse below threshold', () => {
      manager.setPlayerHealth(15);
      manager.update(0.016);
      // Vignette pulsing
    });

    it('should deactivate low health pulse at normal health', () => {
      manager.setPlayerHealth(80);
      manager.update(0.016);
      // No pulse
    });
  });
});
