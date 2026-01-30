/**
 * Tests for PerformanceManager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdjustedParticleCount,
  getParticleMultiplier,
  getPerformanceManager,
  isMobileDevice,
  type QualityLevel,
} from './PerformanceManager';

// Mock getScreenInfo to control device detection
vi.mock('../utils/responsive', () => ({
  getScreenInfo: vi.fn(() => ({
    width: 1920,
    height: 1080,
    deviceType: 'desktop',
    orientation: 'landscape',
    pixelRatio: 1,
    isTouchDevice: false,
    isFoldable: false,
    isMobile: false,
  })),
}));

describe('PerformanceManager', () => {
  let perfManager: ReturnType<typeof getPerformanceManager>;

  beforeEach(() => {
    // Get fresh instance - note: singleton pattern means state persists
    perfManager = getPerformanceManager();
  });

  afterEach(() => {
    // Clean up
    perfManager.dispose();
  });

  describe('Quality Settings', () => {
    it('should have quality settings for each level', () => {
      const levels: QualityLevel[] = ['ultra', 'high', 'medium', 'low', 'potato'];

      for (const level of levels) {
        perfManager.setQuality(level);
        const settings = perfManager.getSettings();

        expect(settings.resolutionScale).toBeGreaterThan(0);
        expect(settings.resolutionScale).toBeLessThanOrEqual(1);
        expect(settings.particleMultiplier).toBeGreaterThan(0);
        expect(settings.maxParticleSystems).toBeGreaterThan(0);
        expect(settings.targetFPS).toBeGreaterThan(0);
      }
    });

    it('should decrease quality settings as level decreases', () => {
      // Get settings for each level
      perfManager.setQuality('ultra');
      const ultraSettings = perfManager.getSettings();

      perfManager.setQuality('low');
      const lowSettings = perfManager.getSettings();

      perfManager.setQuality('potato');
      const potatoSettings = perfManager.getSettings();

      // Particle multiplier should decrease
      expect(ultraSettings.particleMultiplier).toBeGreaterThan(lowSettings.particleMultiplier);
      expect(lowSettings.particleMultiplier).toBeGreaterThan(potatoSettings.particleMultiplier);

      // Max particle systems should decrease
      expect(ultraSettings.maxParticleSystems).toBeGreaterThan(lowSettings.maxParticleSystems);
      expect(lowSettings.maxParticleSystems).toBeGreaterThan(potatoSettings.maxParticleSystems);
    });
  });

  describe('Particle Count Adjustment', () => {
    it('should return adjusted particle count based on quality', () => {
      const baseCount = 100;

      perfManager.setQuality('ultra');
      const ultraCount = getAdjustedParticleCount(baseCount);

      perfManager.setQuality('low');
      const lowCount = getAdjustedParticleCount(baseCount);

      expect(ultraCount).toBeGreaterThan(lowCount);
    });

    it('should never return less than 1 particle', () => {
      perfManager.setQuality('potato');
      const count = getAdjustedParticleCount(1);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should return particle multiplier between 0 and 1', () => {
      const levels: QualityLevel[] = ['ultra', 'high', 'medium', 'low', 'potato'];

      for (const level of levels) {
        perfManager.setQuality(level);
        const multiplier = getParticleMultiplier();

        expect(multiplier).toBeGreaterThan(0);
        expect(multiplier).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Performance Configuration', () => {
    it('should allow configuration changes', () => {
      perfManager.configure({
        dynamicResolution: false,
        showWarnings: false,
        debugOverlay: false,
      });

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should toggle debug overlay', () => {
      // Start without overlay
      perfManager.configure({ debugOverlay: false });

      // Toggle on
      perfManager.toggleDebugOverlay();

      // Toggle off
      perfManager.toggleDebugOverlay();

      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should return valid metrics structure', () => {
      const metrics = perfManager.getMetrics();

      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('p50FrameTime');
      expect(metrics).toHaveProperty('p95FrameTime');
      expect(metrics).toHaveProperty('qualityLevel');
      expect(metrics).toHaveProperty('currentResolutionScale');
    });

    it('should report current quality level in metrics', () => {
      perfManager.setQuality('medium');
      const metrics = perfManager.getMetrics();

      expect(metrics.qualityLevel).toBe('medium');
    });
  });

  describe('Device Detection Helpers', () => {
    it('should provide isMobile helper', () => {
      // With our mock, should return false (desktop)
      const result = isMobileDevice();
      expect(typeof result).toBe('boolean');
    });

    it('should provide isTouchDevice method', () => {
      const result = perfManager.isTouchDevice();
      expect(typeof result).toBe('boolean');
    });

    it('should provide screen info', () => {
      const screenInfo = perfManager.getScreenInfo();

      expect(screenInfo).toHaveProperty('width');
      expect(screenInfo).toHaveProperty('height');
      expect(screenInfo).toHaveProperty('deviceType');
      expect(screenInfo).toHaveProperty('pixelRatio');
    });
  });

  describe('LOD Distance Multiplier', () => {
    it('should decrease LOD multiplier for lower quality levels', () => {
      perfManager.setQuality('ultra');
      const ultraMultiplier = perfManager.getSettings().lodDistanceMultiplier;

      perfManager.setQuality('low');
      const lowMultiplier = perfManager.getSettings().lodDistanceMultiplier;

      expect(ultraMultiplier).toBeGreaterThan(lowMultiplier);
    });
  });

  describe('Particle System Budget', () => {
    it('should track if particle systems can be created', () => {
      // Without scene initialized, should still work
      const canCreate = perfManager.canCreateParticleSystem();
      expect(typeof canCreate).toBe('boolean');
    });

    it('should respect max particle systems setting', () => {
      perfManager.setQuality('ultra');
      const ultraMax = perfManager.getSettings().maxParticleSystems;

      perfManager.setQuality('potato');
      const potatoMax = perfManager.getSettings().maxParticleSystems;

      expect(ultraMax).toBeGreaterThan(potatoMax);
    });
  });
});
