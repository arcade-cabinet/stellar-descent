/**
 * LODManager Tests
 *
 * Tests for the Level of Detail system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js SimplificationQueue before importing LODManager
vi.mock('@babylonjs/core/Meshes/meshSimplification', () => {
  return {
    SimplificationQueue: class {
      addTask = vi.fn();
    },
    SimplificationType: {
      QUADRATIC: 0,
    },
  };
});

// Mock the side-effect import
vi.mock('@babylonjs/core/Meshes/meshSimplificationSceneComponent', () => ({}));

// Mock PerformanceManager
vi.mock('./PerformanceManager', () => ({
  getPerformanceManager: () => ({
    getSettings: () => ({
      lodDistanceMultiplier: 1.0,
    }),
    isMobile: () => false,
  }),
}));

// Import after mocks are set up
import { DEFAULT_LOD_CONFIGS, LODManager } from './LODManager';

describe('LODManager', () => {
  beforeEach(() => {
    // Reset the LODManager state before each test
    LODManager.dispose();
  });

  afterEach(() => {
    LODManager.dispose();
  });

  describe('DEFAULT_LOD_CONFIGS', () => {
    it('should have enemy config with aggressive LOD distances', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      expect(config.distances).toEqual([20, 50, 100]);
      expect(config.quality).toEqual([0.5, 0.25]);
      expect(config.skip).toBe(false);
    });

    it('should have player config marked to skip LOD', () => {
      const config = DEFAULT_LOD_CONFIGS.player;
      expect(config.skip).toBe(true);
      expect(config.distances).toEqual([0, 0, 0]);
    });

    it('should have prop config with billboard support', () => {
      const config = DEFAULT_LOD_CONFIGS.prop;
      expect(config.useBillboard).toBe(true);
    });

    it('should have environment config with conservative distances', () => {
      const config = DEFAULT_LOD_CONFIGS.environment;
      expect(config.distances[0]).toBeGreaterThan(DEFAULT_LOD_CONFIGS.enemy.distances[0]);
      expect(config.distances[1]).toBeGreaterThan(DEFAULT_LOD_CONFIGS.enemy.distances[1]);
    });
  });

  describe('getConfig', () => {
    it('should return default prop config for unknown categories', () => {
      const config = LODManager.getConfig('unknown_category');
      expect(config.distances).toEqual(DEFAULT_LOD_CONFIGS.prop.distances);
    });

    it('should return correct config for known categories', () => {
      // Initialize with mock scene/camera
      const mockScene = { activeCamera: { position: { x: 0, y: 0, z: 0 } } } as any;
      const mockCamera = { position: { x: 0, y: 0, z: 0 } } as any;
      LODManager.init(mockScene, mockCamera);

      const enemyConfig = LODManager.getConfig('enemy');
      expect(enemyConfig.distances[0]).toBe(20);
    });
  });

  describe('setCategoryConfig', () => {
    it('should allow overriding category configs', () => {
      const mockScene = { activeCamera: { position: { x: 0, y: 0, z: 0 } } } as any;
      const mockCamera = { position: { x: 0, y: 0, z: 0 } } as any;
      LODManager.init(mockScene, mockCamera);

      LODManager.setCategoryConfig('enemy', {
        distances: [10, 25, 50],
      });

      const config = LODManager.getConfig('enemy');
      expect(config.distances).toEqual([10, 25, 50]);
      // Other properties should remain unchanged
      expect(config.quality).toEqual([0.5, 0.25]);
    });
  });

  describe('metrics', () => {
    it('should return initial metrics with zero values', () => {
      const metrics = LODManager.getMetrics();
      expect(metrics.totalTrackedMeshes).toBe(0);
      expect(metrics.meshesPerLOD).toEqual([0, 0, 0, 0, 0]);
      expect(metrics.triangleSavings).toBe(0);
    });
  });

  describe('isRegistered', () => {
    it('should return false for unregistered meshes', () => {
      expect(LODManager.isRegistered('some_mesh_id')).toBe(false);
    });
  });

  describe('getLODLevel', () => {
    it('should return -1 for unregistered meshes', () => {
      expect(LODManager.getLODLevel('unknown_id')).toBe(-1);
    });
  });

  describe('dispose', () => {
    it('should clean up all state', () => {
      const mockScene = { activeCamera: { position: { x: 0, y: 0, z: 0 } } } as any;
      const mockCamera = { position: { x: 0, y: 0, z: 0 } } as any;
      LODManager.init(mockScene, mockCamera);

      LODManager.dispose();

      // After dispose, getMetrics should return fresh state
      const metrics = LODManager.getMetrics();
      expect(metrics.totalTrackedMeshes).toBe(0);
    });
  });

  describe('distance thresholds', () => {
    it('should define LOD0 range as 0-20 meters for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      // LOD0 is from 0 to distances[0]
      expect(config.distances[0]).toBe(20);
    });

    it('should define LOD1 range as 20-50 meters for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      // LOD1 is from distances[0] to distances[1]
      expect(config.distances[0]).toBe(20);
      expect(config.distances[1]).toBe(50);
    });

    it('should define LOD2 range as 50-100 meters for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      // LOD2 is from distances[1] to distances[2]
      expect(config.distances[1]).toBe(50);
      expect(config.distances[2]).toBe(100);
    });

    it('should cull objects beyond 100 meters for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      // Cull distance is distances[2]
      expect(config.distances[2]).toBe(100);
    });
  });

  describe('quality ratios', () => {
    it('should reduce to 50% quality at LOD1 for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      expect(config.quality[0]).toBe(0.5);
    });

    it('should reduce to 25% quality at LOD2 for enemies', () => {
      const config = DEFAULT_LOD_CONFIGS.enemy;
      expect(config.quality[1]).toBe(0.25);
    });
  });
});
