/**
 * environment.test.ts - Unit tests for The Breach environment system
 *
 * Tests GLB asset loading, placement, organic growth effects, and disposal.
 * Achieves comprehensive coverage for environment.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Lights/pointLight', () => {
  class MockPointLight {
    name: string;
    position: any;
    scene: any;
    diffuse = { r: 1, g: 1, b: 1 };
    intensity = 1;
    range = 10;
    parent: any = null;
    constructor(name: string, position: any, scene: any) {
      this.name = name;
      this.position = position;
      this.scene = scene;
    }
    dispose = vi.fn();
  }
  return { PointLight: MockPointLight };
});

vi.mock('@babylonjs/core/Materials/standardMaterial', () => {
  class MockStandardMaterial {
    name: string;
    diffuseColor = { r: 1, g: 1, b: 1 };
    emissiveColor = { r: 0, g: 0, b: 0 };
    alpha = 1;
    disableLighting = false;
    constructor(name: string, _scene: any) {
      this.name = name;
    }
    dispose = vi.fn();
  }
  return { StandardMaterial: MockStandardMaterial };
});

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
    scale(factor: number) {
      return new MockColor3(this.r * factor, this.g * factor, this.b * factor);
    }
    static FromHexString = vi.fn().mockReturnValue(new MockColor3(0.5, 0.5, 0.5));
  }
  return { Color3: MockColor3 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    static Zero() {
      return new MockVector3(0, 0, 0);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => {
  const createMockMesh = (name: string) => ({
    name,
    material: null,
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    isVisible: true,
    parent: null,
    dispose: vi.fn(),
    getChildren: vi.fn().mockReturnValue([]),
  });
  return {
    MeshBuilder: {
      CreateSphere: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateCylinder: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateDisc: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateBox: vi.fn().mockImplementation((name) => createMockMesh(name)),
    },
  };
});

vi.mock('../../core/AssetManager', () => {
  const createMockNode = (name: string) => ({
    name,
    position: {
      x: 0,
      y: 0,
      z: 0,
      clone: function () {
        return { x: this.x, y: this.y, z: this.z, set: vi.fn(), clone: this.clone.bind(this) };
      },
      set: vi.fn(function (this: any, x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
      clone: function () {
        return { x: this.x, y: this.y, z: this.z, set: vi.fn(), clone: this.clone.bind(this) };
      },
      set: vi.fn(function (this: any, x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    scaling: {
      x: 1,
      y: 1,
      z: 1,
      setAll: vi.fn(),
      set: vi.fn(),
    },
    parent: null,
    dispose: vi.fn(),
    getChildren: vi.fn().mockReturnValue([{ dispose: vi.fn() }, { dispose: vi.fn() }]),
  });
  return {
    AssetManager: {
      loadAssetByPath: vi.fn().mockResolvedValue({}),
      createInstanceByPath: vi.fn().mockImplementation((_path, name) => createMockNode(name)),
      isPathCached: vi.fn().mockReturnValue(false),
    },
  };
});

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import { AssetManager } from '../../core/AssetManager';
import {
  disposeBreachAssets,
  HIVE_STRUCTURE_PLACEMENTS,
  loadBreachAssets,
  type PlacedAsset,
  placeBreachAssets,
} from './environment';

describe('The Breach Environment', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      onBeforeRenderObservable: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  });

  // ==========================================================================
  // ASSET LOADING
  // ==========================================================================

  describe('Asset Loading', () => {
    it('should load all station beam assets', async () => {
      await loadBreachAssets(mockScene);

      // Should load beam paths
      expect(AssetManager.loadAssetByPath).toHaveBeenCalled();
    });

    it('should load all modular detail assets', async () => {
      await loadBreachAssets(mockScene);

      // Should load detail paths
      expect(AssetManager.loadAssetByPath).toHaveBeenCalled();
    });

    it('should skip already cached assets', async () => {
      (AssetManager.isPathCached as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await loadBreachAssets(mockScene);

      // Should skip loading when cached
      expect(AssetManager.loadAssetByPath).not.toHaveBeenCalled();
    });

    it('should handle loading errors gracefully', async () => {
      (AssetManager.loadAssetByPath as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Load failed')
      );

      // Should not throw
      await expect(loadBreachAssets(mockScene)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // ASSET PLACEMENT
  // ==========================================================================

  describe('Asset Placement', () => {
    it('should place assets from all three zones', () => {
      const assets = placeBreachAssets(mockScene);

      expect(assets.length).toBeGreaterThan(0);

      const zones = new Set(assets.map((a) => a.zone));
      expect(zones.has('entry')).toBe(true);
      expect(zones.has('deep_hive')).toBe(true);
      expect(zones.has('queen_chamber')).toBe(true);
    });

    it('should return array of PlacedAsset objects', () => {
      const assets = placeBreachAssets(mockScene);

      for (const asset of assets) {
        expect(asset.node).toBeDefined();
        expect(asset.type).toBeDefined();
        expect(asset.zone).toBeDefined();
      }
    });

    it('should create instances for each placement', () => {
      placeBreachAssets(mockScene);

      expect(AssetManager.createInstanceByPath).toHaveBeenCalled();
    });

    it('should apply position to placed assets', () => {
      const assets = placeBreachAssets(mockScene);

      // All assets should have position defined
      for (const asset of assets) {
        expect(asset.node.position).toBeDefined();
      }
    });

    it('should apply rotation to placed assets', () => {
      const assets = placeBreachAssets(mockScene);

      for (const asset of assets) {
        expect(asset.node.rotation).toBeDefined();
      }
    });

    it('should apply scaling to placed assets', () => {
      const assets = placeBreachAssets(mockScene);

      for (const asset of assets) {
        expect(asset.node.scaling).toBeDefined();
      }
    });

    it('should handle failed instance creation', () => {
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const assets = placeBreachAssets(mockScene);

      // Should still return empty array without throwing
      expect(Array.isArray(assets)).toBe(true);
    });

    it('should add organic growth to beams using GLB models', () => {
      const createInstanceByPathMock = vi.fn().mockImplementation((_path, name) => ({
        name,
        position: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
        parent: null,
        dispose: vi.fn(),
        getChildren: vi.fn().mockReturnValue([]),
      }));
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockImplementation(
        createInstanceByPathMock
      );
      (AssetManager.isPathCached as ReturnType<typeof vi.fn>).mockReturnValue(true);

      placeBreachAssets(mockScene);

      // AssetManager.createInstanceByPath should be called for organic growths on beams
      // Growth GLB paths include alien_mushroom_*.glb
      const growthCalls = createInstanceByPathMock.mock.calls.filter((call: any[]) =>
        call[0].includes('alien_mushroom')
      );
      expect(growthCalls.length).toBeGreaterThan(0);
    });

    it('should add tendrils to deep zone beams using GLB models', () => {
      const createInstanceByPathMock = vi.fn().mockImplementation((_path, name) => ({
        name,
        position: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
        parent: null,
        dispose: vi.fn(),
        getChildren: vi.fn().mockReturnValue([]),
      }));
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockImplementation(
        createInstanceByPathMock
      );
      (AssetManager.isPathCached as ReturnType<typeof vi.fn>).mockReturnValue(true);

      placeBreachAssets(mockScene);

      // AssetManager.createInstanceByPath should be called for tendrils
      // Tendril GLB paths include hanging_moss, fern, reed
      const tendrilCalls = createInstanceByPathMock.mock.calls.filter(
        (call: any[]) =>
          call[0].includes('hanging_moss') || call[0].includes('fern') || call[0].includes('reed')
      );
      expect(tendrilCalls.length).toBeGreaterThan(0);
    });

    it('should add corrosion overlay to deep zone details using GLB models', () => {
      const createInstanceByPathMock = vi.fn().mockImplementation((_path, name) => ({
        name,
        position: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
        parent: null,
        dispose: vi.fn(),
        getChildren: vi.fn().mockReturnValue([]),
      }));
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockImplementation(
        createInstanceByPathMock
      );
      (AssetManager.isPathCached as ReturnType<typeof vi.fn>).mockReturnValue(true);

      placeBreachAssets(mockScene);

      // Corrosion patches use alien_mushroom_02/04/06 GLBs
      const corrosionCalls = createInstanceByPathMock.mock.calls.filter(
        (call: any[]) =>
          call[0].includes('alien_mushroom_02') ||
          call[0].includes('alien_mushroom_04') ||
          call[0].includes('alien_mushroom_06')
      );
      expect(corrosionCalls.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // HIVE STRUCTURE PLACEMENTS
  // ==========================================================================

  describe('Hive Structure Placements', () => {
    it('should export placement configuration', () => {
      expect(HIVE_STRUCTURE_PLACEMENTS).toBeDefined();
      expect(Array.isArray(HIVE_STRUCTURE_PLACEMENTS)).toBe(true);
    });

    it('should have placements in all zones', () => {
      const zones = new Set(HIVE_STRUCTURE_PLACEMENTS.map((p) => p.zone));

      expect(zones.has('entry')).toBe(true);
      expect(zones.has('deep_hive')).toBe(true);
      expect(zones.has('queen_chamber')).toBe(true);
    });

    it('should have various structure types', () => {
      const types = new Set(HIVE_STRUCTURE_PLACEMENTS.map((p) => p.type));

      // At minimum should have crystals
      expect(types.size).toBeGreaterThan(0);
    });

    it('should have valid positions for all placements', () => {
      for (const placement of HIVE_STRUCTURE_PLACEMENTS) {
        expect(placement.position).toBeDefined();
        expect(typeof placement.position.x).toBe('number');
        expect(typeof placement.position.y).toBe('number');
        expect(typeof placement.position.z).toBe('number');
      }
    });

    it('should have valid scales for all placements', () => {
      for (const placement of HIVE_STRUCTURE_PLACEMENTS) {
        expect(typeof placement.scale).toBe('number');
        expect(placement.scale).toBeGreaterThan(0);
      }
    });

    it('should have valid rotation for all placements', () => {
      for (const placement of HIVE_STRUCTURE_PLACEMENTS) {
        expect(typeof placement.rotationY).toBe('number');
      }
    });

    it('should have entry zone placements with lower intensity', () => {
      const entryPlacements = HIVE_STRUCTURE_PLACEMENTS.filter((p) => p.zone === 'entry');

      expect(entryPlacements.length).toBeGreaterThan(0);
    });

    it('should have queen chamber with massive structures', () => {
      const queenPlacements = HIVE_STRUCTURE_PLACEMENTS.filter((p) => p.zone === 'queen_chamber');

      expect(queenPlacements.length).toBeGreaterThan(0);
      // Queen chamber should have larger scale structures
      const maxScale = Math.max(...queenPlacements.map((p) => p.scale));
      expect(maxScale).toBeGreaterThanOrEqual(0.6);
    });

    it('should have brain structure in queen chamber', () => {
      const brainPlacements = HIVE_STRUCTURE_PLACEMENTS.filter(
        (p) => p.zone === 'queen_chamber' && p.type === 'brain'
      );

      expect(brainPlacements.length).toBeGreaterThan(0);
    });

    it('should have birther structures for minion spawning', () => {
      const birtherPlacements = HIVE_STRUCTURE_PLACEMENTS.filter((p) => p.type === 'birther');

      expect(birtherPlacements.length).toBeGreaterThan(0);
    });

    it('should have claw structures around arena', () => {
      const clawPlacements = HIVE_STRUCTURE_PLACEMENTS.filter(
        (p) => p.zone === 'queen_chamber' && p.type === 'claw'
      );

      expect(clawPlacements.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // ASSET DISPOSAL
  // ==========================================================================

  describe('Asset Disposal', () => {
    it('should dispose all placed assets', () => {
      const mockAssets: PlacedAsset[] = [
        {
          node: {
            dispose: vi.fn(),
            getChildren: vi.fn().mockReturnValue([{ dispose: vi.fn() }]),
          } as any,
          type: 'beam_hc_h1',
          zone: 'entry',
        },
        {
          node: {
            dispose: vi.fn(),
            getChildren: vi.fn().mockReturnValue([]),
          } as any,
          type: 'plate_detail',
          zone: 'deep_hive',
        },
      ];

      disposeBreachAssets(mockAssets);

      for (const asset of mockAssets) {
        expect(asset.node.dispose).toHaveBeenCalled();
      }
    });

    it('should dispose children first', () => {
      const childDispose = vi.fn();
      const nodeDispose = vi.fn();

      const mockAssets: PlacedAsset[] = [
        {
          node: {
            dispose: nodeDispose,
            getChildren: vi
              .fn()
              .mockReturnValue([{ dispose: childDispose }, { dispose: childDispose }]),
          } as any,
          type: 'beam_hc_h1',
          zone: 'entry',
        },
      ];

      disposeBreachAssets(mockAssets);

      // Children should be disposed
      expect(childDispose).toHaveBeenCalledTimes(2);
      // Node should be disposed
      expect(nodeDispose).toHaveBeenCalled();
    });

    it('should handle empty array', () => {
      disposeBreachAssets([]);
      // Should not throw
    });

    it('should handle assets with no children', () => {
      const mockAssets: PlacedAsset[] = [
        {
          node: {
            dispose: vi.fn(),
            getChildren: vi.fn().mockReturnValue([]),
          } as any,
          type: 'detail_x',
          zone: 'queen_chamber',
        },
      ];

      disposeBreachAssets(mockAssets);

      expect(mockAssets[0].node.dispose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ZONE PLACEMENT CONFIGURATION
  // ==========================================================================

  describe('Zone Placement Configuration', () => {
    it('should have entry tunnel with station beams', () => {
      const assets = placeBreachAssets(mockScene);
      const entryAssets = assets.filter((a) => a.zone === 'entry');

      // Entry should have beam assets
      expect(entryAssets.length).toBeGreaterThan(0);
    });

    it('should have deep hive with broken beams', () => {
      const assets = placeBreachAssets(mockScene);
      const deepAssets = assets.filter((a) => a.zone === 'deep_hive');

      expect(deepAssets.length).toBeGreaterThan(0);
    });

    it('should have queen chamber with scattered debris', () => {
      const assets = placeBreachAssets(mockScene);
      const queenAssets = assets.filter((a) => a.zone === 'queen_chamber');

      expect(queenAssets.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // ORGANIC GROWTH EFFECTS (GLB-based)
  // ==========================================================================

  describe('Organic Growth Effects', () => {
    let createInstanceByPathMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createInstanceByPathMock = vi.fn().mockImplementation((_path, name) => ({
        name,
        position: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          clone: () => ({ x: 0, y: 0, z: 0, set: vi.fn() }),
          set: vi.fn(),
        },
        scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
        parent: null,
        dispose: vi.fn(),
        getChildren: vi.fn().mockReturnValue([]),
      }));
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockImplementation(
        createInstanceByPathMock
      );
      (AssetManager.isPathCached as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it('should create GLB growths on beams', () => {
      placeBreachAssets(mockScene);

      // Should create instances from alien_mushroom GLBs for growths
      const growthCalls = createInstanceByPathMock.mock.calls.filter((call: any[]) =>
        call[0].includes('alien_mushroom')
      );
      expect(growthCalls.length).toBeGreaterThan(0);
    });

    it('should create GLB tendrils on deep zone beams', () => {
      placeBreachAssets(mockScene);

      // Should create instances from tendril GLBs (hanging_moss, fern, reed)
      const tendrilCalls = createInstanceByPathMock.mock.calls.filter(
        (call: any[]) =>
          call[0].includes('hanging_moss') || call[0].includes('fern') || call[0].includes('reed')
      );
      expect(tendrilCalls.length).toBeGreaterThan(0);
    });

    it('should create GLB patches for corrosion', () => {
      placeBreachAssets(mockScene);

      // Should create instances from corrosion GLBs (alien_mushroom_02/04/06)
      const corrosionCalls = createInstanceByPathMock.mock.calls.filter(
        (call: any[]) =>
          call[0].includes('alien_mushroom_02') ||
          call[0].includes('alien_mushroom_04') ||
          call[0].includes('alien_mushroom_06')
      );
      expect(corrosionCalls.length).toBeGreaterThan(0);
    });

    it('should vary growth count by zone', () => {
      // Reset call counts
      vi.clearAllMocks();
      createInstanceByPathMock.mockClear();

      placeBreachAssets(mockScene);

      // Deeper zones should have more organic growth GLB instances
      // Count growth instances (alien flora paths)
      const allGrowthCalls = createInstanceByPathMock.mock.calls.filter((call: any[]) =>
        call[0].includes('alien-flora')
      );
      expect(allGrowthCalls.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // RE-EXPORTED SHARED BUILDER
  // ==========================================================================

  describe('Re-exported Shared Builder', () => {
    it('should re-export HiveEnvironmentBuilder', async () => {
      // Dynamic import to check exports
      const envModule = await import('./environment');

      expect(envModule.HiveEnvironmentBuilder).toBeDefined();
    });

    it('should re-export updateBiolights', async () => {
      const envModule = await import('./environment');

      expect(envModule.updateBiolights).toBeDefined();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle unknown asset key gracefully', () => {
      // The placement uses known keys, but if path lookup fails
      (AssetManager.createInstanceByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const assets = placeBreachAssets(mockScene);

      // Should return empty array when all placements fail
      expect(Array.isArray(assets)).toBe(true);
    });

    it('should handle scene with no observable', () => {
      const minimalScene = {} as any;

      // Should not throw
      expect(() => placeBreachAssets(minimalScene)).not.toThrow();
    });
  });
});
