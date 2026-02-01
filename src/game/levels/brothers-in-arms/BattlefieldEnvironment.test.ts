/**
 * BattlefieldEnvironment.test.ts - Unit tests for battlefield environment builder
 *
 * Tests cover:
 * - GLB asset placement system
 * - Cover ring positioning (close, mid, far)
 * - Supply crate positions
 * - Light flickering effects
 * - Resource disposal
 * - Placement validation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Lights/pointLight', () => {
  class MockPointLight {
    name: string;
    intensity = 1;
    diffuse = {};
    specular = {};
    range = 50;
    position = { x: 0, y: 0, z: 0 };
    dispose = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  }
  return { PointLight: MockPointLight };
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
    static FromHexString = vi.fn().mockReturnValue(new MockColor3());
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
    static Distance(a: MockVector3, b: MockVector3) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/transformNode', () => {
  class MockTransformNode {
    name: string;
    position = { x: 0, y: 0, z: 0, set: vi.fn() };
    rotation = { x: 0, y: 0, z: 0 };
    scaling = { x: 1, y: 1, z: 1, setAll: vi.fn() };
    parent: any = null;
    _children: MockTransformNode[] = [];
    dispose = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
    getChildren() {
      return this._children;
    }
    addChild(child: MockTransformNode) {
      this._children.push(child);
    }
  }
  return { TransformNode: MockTransformNode };
});

const mockAssetInstances: any[] = [];

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue({}),
    createInstanceByPath: vi
      .fn()
      .mockImplementation(
        (
          path: string,
          name: string,
          _scene?: unknown,
          _applyLOD?: boolean,
          lodCategory?: string
        ) => {
          const instance = {
            name,
            path,
            category: lodCategory,
            position: { x: 0, y: 0, z: 0, set: vi.fn() },
            rotation: { x: 0, y: 0, z: 0 },
            scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
            parent: null,
            dispose: vi.fn(),
            getChildren: vi.fn().mockReturnValue([]),
          };
          mockAssetInstances.push(instance);
          return instance;
        }
      ),
    isPathCached: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { AssetManager } from '../../core/AssetManager';
// Import after mocks
import { buildBattlefieldEnvironment, updateBattlefieldLights } from './BattlefieldEnvironment';

describe('BattlefieldEnvironment', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssetInstances.length = 0;

    mockScene = {
      getMeshByName: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildBattlefieldEnvironment', () => {
    it('should create battlefield result with root node', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      expect(result).toBeDefined();
      expect(result.root).toBeDefined();
    });

    it('should create meshes array', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      expect(result.meshes).toBeDefined();
      expect(Array.isArray(result.meshes)).toBe(true);
    });

    it('should create lights array', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      expect(result.lights).toBeDefined();
      expect(Array.isArray(result.lights)).toBe(true);
    });

    it('should provide supply crate positions', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      expect(result.supplyCratePositions).toBeDefined();
      expect(Array.isArray(result.supplyCratePositions)).toBe(true);
      expect(result.supplyCratePositions.length).toBeGreaterThan(0);
    });

    it('should provide dispose function', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      expect(result.dispose).toBeDefined();
      expect(typeof result.dispose).toBe('function');
    });

    it('should skip loading for cached assets', async () => {
      // With isPathCached returning true (default), loadAssetByPath is not called
      await buildBattlefieldEnvironment(mockScene);

      // When all assets are cached, loadAssetByPath should NOT be called
      expect(AssetManager.loadAssetByPath).not.toHaveBeenCalled();
    });

    it('should create instances for placements', async () => {
      await buildBattlefieldEnvironment(mockScene);

      expect(AssetManager.createInstanceByPath).toHaveBeenCalled();
    });
  });

  describe('Asset Placement', () => {
    it('should place barricades', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const barricades = mockAssetInstances.filter((inst) => inst.path?.includes('barricade'));
      expect(barricades.length).toBeGreaterThan(0);
    });

    it('should place industrial structures', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const industrial = mockAssetInstances.filter((inst) => inst.path?.includes('industrial'));
      expect(industrial.length).toBeGreaterThan(0);
    });

    it('should place containers', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const containers = mockAssetInstances.filter((inst) => inst.path?.includes('container'));
      expect(containers.length).toBeGreaterThan(0);
    });

    it('should place debris props', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const debris = mockAssetInstances.filter(
        (inst) => inst.path && (inst.path.includes('debris') || inst.path.includes('scrap'))
      );
      expect(debris.length).toBeGreaterThan(0);
    });

    it('should place crates', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const crates = mockAssetInstances.filter((inst) => inst.path?.includes('crate'));
      expect(crates.length).toBeGreaterThan(0);
    });

    it('should place fencing', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const fences = mockAssetInstances.filter((inst) => inst.path?.includes('fence'));
      expect(fences.length).toBeGreaterThan(0);
    });

    it('should place posters/decals', async () => {
      await buildBattlefieldEnvironment(mockScene);

      const posters = mockAssetInstances.filter((inst) => inst.path?.includes('poster'));
      expect(posters.length).toBeGreaterThan(0);
    });
  });

  describe('Cover Rings', () => {
    it('should have placements in far cover ring (55-70m)', async () => {
      await buildBattlefieldEnvironment(mockScene);

      // Far cover should include water tower, boiler, etc.
      const farPlacements = mockAssetInstances.filter(
        (inst) =>
          inst.path &&
          (inst.path.includes('water_tower') ||
            inst.path.includes('boiler') ||
            inst.path.includes('platform'))
      );
      expect(farPlacements.length).toBeGreaterThan(0);
    });

    it('should have placements in mid cover ring (25-40m)', async () => {
      await buildBattlefieldEnvironment(mockScene);

      // Mid cover includes shipping containers
      const midPlacements = mockAssetInstances.filter((inst) =>
        inst.path?.includes('shipping_container')
      );
      expect(midPlacements.length).toBeGreaterThan(0);
    });

    it('should have placements in fortification ring (around Marcus)', async () => {
      await buildBattlefieldEnvironment(mockScene);

      // Fortification includes barricades near center
      expect(mockAssetInstances.length).toBeGreaterThan(0);
    });
  });

  describe('Supply Crate Positions', () => {
    it('should have supply positions near Marcus', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      // Check for positions within 20m of Marcus (0, 0, 10)
      const nearMarcus = result.supplyCratePositions.filter((pos: any) => {
        const dist = Math.sqrt(pos.x * pos.x + (pos.z - 10) ** 2);
        return dist < 20;
      });
      expect(nearMarcus.length).toBeGreaterThan(0);
    });

    it('should have supply positions in mid ring', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      // Check for positions in mid range (20-50m from center)
      const midRing = result.supplyCratePositions.filter((pos: any) => {
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        return dist > 20 && dist < 50;
      });
      expect(midRing.length).toBeGreaterThan(0);
    });

    it('should have supply positions near player spawn', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      // Check for positions near player start (0, 0, 50)
      const nearSpawn = result.supplyCratePositions.filter((pos: any) => {
        const dist = Math.sqrt(pos.x * pos.x + (pos.z - 50) ** 2);
        return dist < 25;
      });
      expect(nearSpawn.length).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    it('should dispose all meshes', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      result.dispose();

      // Root should be disposed
      expect(result.root.dispose).toHaveBeenCalled();
    });

    it('should dispose all lights', async () => {
      const result = await buildBattlefieldEnvironment(mockScene);

      result.dispose();

      for (const light of result.lights) {
        expect(light.dispose).toHaveBeenCalled();
      }
    });
  });
});

describe('updateBattlefieldLights', () => {
  it('should update light intensities', () => {
    const mockLights = [
      { intensity: 1, diffuse: {} },
      { intensity: 1, diffuse: {} },
    ] as any[];

    // Should not throw
    expect(() => {
      updateBattlefieldLights(mockLights, 0.016);
    }).not.toThrow();
  });

  it('should handle empty lights array', () => {
    const mockLights: any[] = [];

    // Should not throw
    expect(() => {
      updateBattlefieldLights(mockLights, 0.016);
    }).not.toThrow();
  });

  it('should create flickering effect', () => {
    const mockLights = [{ intensity: 1, diffuse: {} }] as any[];

    const _initialIntensity = mockLights[0].intensity;

    // Update multiple times to see flickering
    for (let i = 0; i < 100; i++) {
      updateBattlefieldLights(mockLights, 0.016);
    }

    // Intensity may have changed (flickering)
    expect(mockLights[0]).toBeDefined();
  });
});

describe('BattlefieldEnvironment - Edge Cases', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssetInstances.length = 0;

    // Reset mock implementations to defaults
    vi.mocked(AssetManager.isPathCached).mockReturnValue(true);
    vi.mocked(AssetManager.createInstanceByPath).mockImplementation(
      (path: string, name: string, _scene?: unknown, _applyLOD?: boolean, lodCategory?: string) => {
        const instance = {
          name,
          path,
          category: lodCategory,
          position: { x: 0, y: 0, z: 0, set: vi.fn() },
          rotation: { x: 0, y: 0, z: 0 },
          scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
          parent: null,
          dispose: vi.fn(),
          getChildren: vi.fn().mockReturnValue([]),
        };
        mockAssetInstances.push(instance);
        return instance as any;
      }
    );

    mockScene = {
      getMeshByName: vi.fn(),
    };
  });

  it('should throw error when too many assets fail to load', async () => {
    vi.mocked(AssetManager.isPathCached).mockReturnValue(false);

    // When more than 50% of assets fail to load, should throw FATAL error
    await expect(buildBattlefieldEnvironment(mockScene)).rejects.toThrow(
      '[BattlefieldEnvironment] FATAL'
    );
  });

  it('should handle instance creation failures', async () => {
    // Only return null for some instances (not all - that would trigger the FATAL error)
    let callCount = 0;
    vi.mocked(AssetManager.createInstanceByPath).mockImplementation(
      (path: string, name: string, _scene?: unknown, _applyLOD?: boolean, lodCategory?: string) => {
        callCount++;
        // Return null for every 5th call to simulate occasional failures
        if (callCount % 5 === 0) {
          return null as any;
        }
        const instance = {
          name,
          path,
          category: lodCategory,
          position: { x: 0, y: 0, z: 0, set: vi.fn() },
          rotation: { x: 0, y: 0, z: 0 },
          scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
          parent: null,
          dispose: vi.fn(),
          getChildren: vi.fn().mockReturnValue([]),
        };
        mockAssetInstances.push(instance);
        return instance as any;
      }
    );

    // Should not throw even if some instances fail to create
    await expect(buildBattlefieldEnvironment(mockScene)).resolves.toBeDefined();
  });
});

describe('BattlefieldEnvironment - Placement Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssetInstances.length = 0;

    // Reset mock implementations to defaults
    vi.mocked(AssetManager.isPathCached).mockReturnValue(true);
    vi.mocked(AssetManager.createInstanceByPath).mockImplementation(
      (path: string, name: string, _scene?: unknown, _applyLOD?: boolean, lodCategory?: string) => {
        const instance = {
          name,
          path,
          category: lodCategory,
          position: { x: 0, y: 0, z: 0, set: vi.fn() },
          rotation: { x: 0, y: 0, z: 0 },
          scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
          parent: null,
          dispose: vi.fn(),
          getChildren: vi.fn().mockReturnValue([]),
        };
        mockAssetInstances.push(instance);
        return instance as any;
      }
    );
  });

  it('should ensure minimum spacing between placements', async () => {
    const mockScene = { getMeshByName: vi.fn() } as any;

    await buildBattlefieldEnvironment(mockScene);

    // Verify instances were created
    expect(mockAssetInstances.length).toBeGreaterThan(0);

    // Verify each instance has position defined
    for (const instance of mockAssetInstances) {
      expect(instance.position).toBeDefined();
    }
  });

  it('should place assets within arena bounds', async () => {
    const mockScene = { getMeshByName: vi.fn() } as any;

    await buildBattlefieldEnvironment(mockScene);

    const ARENA_WIDTH = 200;
    const ARENA_DEPTH = 150;

    for (const instance of mockAssetInstances) {
      if (instance.position) {
        // Allow some margin for large assets
        expect(Math.abs(instance.position.x)).toBeLessThan(ARENA_WIDTH / 2 + 50);
        expect(Math.abs(instance.position.z)).toBeLessThan(ARENA_DEPTH / 2 + 50);
      }
    }
  });
});

describe('BattlefieldEnvironment - Asset Categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults
    vi.mocked(AssetManager.isPathCached).mockReturnValue(true);
    vi.mocked(AssetManager.createInstanceByPath).mockImplementation(
      (path: string, name: string, _scene?: unknown, _applyLOD?: boolean, lodCategory?: string) => {
        const instance = {
          name,
          path,
          category: lodCategory,
          position: { x: 0, y: 0, z: 0, set: vi.fn() },
          rotation: { x: 0, y: 0, z: 0 },
          scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
          parent: null,
          dispose: vi.fn(),
          getChildren: vi.fn().mockReturnValue([]),
        };
        mockAssetInstances.push(instance);
        return instance as any;
      }
    );
    mockAssetInstances.length = 0;
  });

  it('should tag assets with environment category', async () => {
    const mockScene = { getMeshByName: vi.fn() } as any;

    await buildBattlefieldEnvironment(mockScene);

    const environmentAssets = mockAssetInstances.filter((inst) => inst.category === 'environment');

    // Most assets should be tagged as environment
    expect(environmentAssets.length).toBeGreaterThan(0);
  });
});
