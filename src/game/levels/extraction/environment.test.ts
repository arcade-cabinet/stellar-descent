/**
 * ExtractionLevel - Environment Tests
 *
 * Unit tests for tunnel, surface, LZ, mech, and dropship environment creation.
 * Target: 95%+ line coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn(),
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    name: string;
    position: { x: number; y: number; z: number };
    diffuse = { r: 1, g: 1, b: 1 };
    intensity = 1;
    range = 10;
    parent: unknown = null;
    dispose = vi.fn();
    setEnabled = vi.fn();
    constructor(name: string, pos: { x: number; y: number; z: number } | undefined, _scene: unknown) {
      this.name = name;
      this.position = pos ?? { x: 0, y: 0, z: 0 };
    }
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class MockStandardMaterial {
    name: string;
    diffuseColor = { r: 1, g: 1, b: 1 };
    specularColor = { r: 0, g: 0, b: 0 };
    emissiveColor = { r: 0, g: 0, b: 0 };
    alpha = 1;
    dispose = vi.fn();
    constructor(name: string, _scene: unknown) {
      this.name = name;
    }
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
    static FromHexString(_hex: string) {
      return new MockColor3(1, 1, 1);
    }
  }
  class MockColor4 {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r = 0, g = 0, b = 0, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
  }
  return { Color3: MockColor3, Color4: MockColor4 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => ({
  Vector3: class MockVector3 {
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
  },
}));

const mockCylinder = () => ({
  position: { x: 0, y: 0, z: 0, set: vi.fn() },
  rotation: { x: 0, y: 0 },
  scaling: { set: vi.fn() },
  material: null,
  dispose: vi.fn(),
  isVisible: true,
  setEnabled: vi.fn(),
  setPivotPoint: vi.fn(),
  parent: null,
});
const mockBox = () => ({
  position: { x: 0, y: 0, z: 0, set: vi.fn() },
  rotation: { x: 0, y: 0 },
  scaling: { set: vi.fn() },
  material: null,
  dispose: vi.fn(),
  isVisible: true,
  setEnabled: vi.fn(),
  setPivotPoint: vi.fn(),
  parent: null,
});
vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateCylinder: vi.fn(() => mockCylinder()),
    CreateBox: vi.fn(() => mockBox()),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: class MockTransformNode {
    name: string;
    position = { x: 0, y: 0, z: 0, set: vi.fn() };
    rotation = { y: 0 };
    setEnabled = vi.fn();
    dispose = vi.fn();
    constructor(name: string, _scene: unknown) {
      this.name = name;
    }
  },
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue({}),
    createInstanceByPath: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { y: 0 },
      setEnabled: vi.fn(),
      dispose: vi.fn(),
    }),
  },
}));

vi.mock('../../core/Logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../shared/HiveEnvironmentBuilder', () => ({
  HiveEnvironmentBuilder: class MockHiveEnvironmentBuilder {
    setupGlowLayer = vi.fn();
    createTunnelSegment = vi.fn().mockReturnValue({ node: {} });
    createBiolight = vi.fn();
    createChamber = vi.fn();
    getBiolights = vi.fn().mockReturnValue([]);
    dispose = vi.fn();
    constructor(_scene: unknown, _options?: unknown) {}
  },
}));

vi.mock('../shared/SurfaceTerrainFactory', () => ({
  createDynamicTerrain: vi.fn().mockReturnValue({
    mesh: {
      position: { z: 0 },
      dispose: vi.fn(),
      isVisible: true,
    },
    material: { dispose: vi.fn() },
  }),
  SAND_TERRAIN: { baseColor: '#c2a87d' },
}));

vi.mock('./ExtractionEnvironmentBuilder', () => ({
  buildExtractionEnvironment: vi.fn().mockResolvedValue({
    root: { setEnabled: vi.fn() },
    meshes: [],
    lights: [{ setEnabled: vi.fn() }],
    coverMeshes: [],
    dispose: vi.fn(),
  }),
}));

vi.mock('./constants', () => ({
  ESCAPE_TUNNEL_LENGTH: 300,
  LZ_POSITION: { x: 0, y: 0, z: -500 },
  GLB_MECH: '/models/vehicles/mech.glb',
  GLB_DROPSHIP: '/models/vehicles/dropship.glb',
  GLB_SUPPLY_DROP: '/models/props/supply_drop.glb',
  GLB_AMMO_BOX: '/models/props/ammo_box.glb',
  GLB_CRUMBLING_WALL: '/models/props/crumbling_wall.glb',
  GLB_DEBRIS_VARIANTS: ['/models/props/debris1.glb'],
}));

import {
  createEscapeTunnel,
  createSurfaceEnvironment,
  buildLZEnvironment,
  createLZBeacon,
  setupHoldoutArena,
  createMarcusMech,
  createDropship,
  setTunnelVisible,
  setSurfaceVisible,
  preloadAssets,
  type TunnelEnvironment,
} from './environment';

describe('Environment Creation', () => {
  const mockScene = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEscapeTunnel', () => {
    it('should create tunnel environment with all components', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.hiveBuilder).toBeDefined();
      expect(tunnel.tunnelSegments).toBeDefined();
      expect(tunnel.tunnelLights).toBeDefined();
      expect(tunnel.collapseWall).toBeDefined();
      expect(tunnel.exitLight).toBeDefined();
    });

    it('should setup glow layer', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.hiveBuilder.setupGlowLayer).toHaveBeenCalled();
    });

    it('should create tunnel segments', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.hiveBuilder.createTunnelSegment).toHaveBeenCalled();
    });

    it('should create biolights', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.hiveBuilder.createBiolight).toHaveBeenCalled();
    });

    it('should create starting chamber', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.hiveBuilder.createChamber).toHaveBeenCalled();
    });

    it('should create collapse wall mesh', async () => {
      const MeshBuilderModule = await import('@babylonjs/core/Meshes/meshBuilder');
      createEscapeTunnel(mockScene);

      expect(MeshBuilderModule.MeshBuilder.CreateCylinder).toHaveBeenCalled();
    });

    it('should create exit light with high intensity', () => {
      const tunnel = createEscapeTunnel(mockScene);

      expect(tunnel.exitLight.intensity).toBe(120);
      expect(tunnel.exitLight.range).toBe(120);
    });
  });

  describe('createSurfaceEnvironment', () => {
    it('should create surface terrain', async () => {
      const SurfaceTerrainModule = await import('../shared/SurfaceTerrainFactory');
      const surface = createSurfaceEnvironment(mockScene);

      expect(SurfaceTerrainModule.createDynamicTerrain).toHaveBeenCalled();
      expect(surface.surfaceTerrain).toBeDefined();
      expect(surface.terrain).toBeDefined();
    });

    it('should position terrain correctly', () => {
      const surface = createSurfaceEnvironment(mockScene);

      expect(surface.terrain.position.z).toBe(-400);
    });
  });

  describe('buildLZEnvironment', () => {
    it('should build extraction environment', async () => {
      const ExtractionEnvModule = await import('./ExtractionEnvironmentBuilder');
      const env = await buildLZEnvironment(mockScene);

      expect(ExtractionEnvModule.buildExtractionEnvironment).toHaveBeenCalledWith(mockScene);
      expect(env).not.toBeNull();
    });

    it('should return null on error', async () => {
      const ExtractionEnvModule = await import('./ExtractionEnvironmentBuilder');
      vi.mocked(ExtractionEnvModule.buildExtractionEnvironment).mockRejectedValueOnce(new Error('Build failed'));

      const env = await buildLZEnvironment(mockScene);

      expect(env).toBeNull();
    });
  });

  describe('createLZBeacon', () => {
    it('should create beacon mesh', async () => {
      const MeshBuilderModule = await import('@babylonjs/core/Meshes/meshBuilder');
      createLZBeacon(mockScene);

      expect(MeshBuilderModule.MeshBuilder.CreateCylinder).toHaveBeenCalledWith(
        'beacon',
        expect.objectContaining({ height: 40, diameter: 3 }),
        mockScene
      );
    });

    it('should set beacon material to green glow', () => {
      const beacon = createLZBeacon(mockScene);

      expect(beacon.material).toBeDefined();
    });
  });

  describe('setupHoldoutArena', () => {
    it('should return array of spawn points', () => {
      const spawnPoints = setupHoldoutArena();

      expect(Array.isArray(spawnPoints)).toBe(true);
      expect(spawnPoints.length).toBeGreaterThan(0);
    });

    it('should create perimeter spawn points', () => {
      const spawnPoints = setupHoldoutArena();

      // Should have 8 perimeter points
      expect(spawnPoints.length).toBeGreaterThanOrEqual(8);
    });

    it('should include north gap spawn points', () => {
      const spawnPoints = setupHoldoutArena();

      // Should have 3 north gap points
      expect(spawnPoints.length).toBeGreaterThanOrEqual(11);
    });

    it('should include breach hole spawn points', () => {
      const spawnPoints = setupHoldoutArena();

      // Should have 4 breach points
      expect(spawnPoints.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('createMarcusMech', () => {
    it('should create mech mesh', async () => {
      const AssetManagerModule = await import('../../core/AssetManager');
      createMarcusMech(mockScene);

      expect(AssetManagerModule.AssetManager.createInstanceByPath).toHaveBeenCalled();
    });

    it('should return mech assets', () => {
      const assets = createMarcusMech(mockScene);

      expect(assets.mechMesh).toBeDefined();
      expect(assets.mechGunLight).toBeDefined();
    });

    it('should position mech near LZ', () => {
      const assets = createMarcusMech(mockScene);

      expect(assets.mechMesh.position.set).toHaveBeenCalled();
    });

    it('should start mech disabled', () => {
      const assets = createMarcusMech(mockScene);

      expect(assets.mechMesh.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should fallback to TransformNode if asset fails', async () => {
      const AssetManagerModule = await import('../../core/AssetManager');
      vi.mocked(AssetManagerModule.AssetManager.createInstanceByPath).mockReturnValueOnce(null);

      const assets = createMarcusMech(mockScene);

      expect(assets.mechMesh).toBeDefined();
    });
  });

  describe('createDropship', () => {
    it('should create dropship with all components', () => {
      const assets = createDropship(mockScene);

      expect(assets.dropship).toBeDefined();
      expect(assets.dropshipRamp).toBeDefined();
      expect(assets.dropshipLight).toBeDefined();
      expect(assets.dropshipRampLight).toBeDefined();
      expect(assets.dropshipThrustEmitters).toBeDefined();
    });

    it('should create thrust emitters', () => {
      const assets = createDropship(mockScene);

      // 2 side emitters + 1 main
      expect(assets.dropshipThrustEmitters.length).toBe(3);
    });

    it('should start dropship disabled and offscreen', () => {
      const assets = createDropship(mockScene);

      expect(assets.dropship.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should load hull GLB', async () => {
      const AssetManagerModule = await import('../../core/AssetManager');
      createDropship(mockScene);

      expect(AssetManagerModule.AssetManager.createInstanceByPath).toHaveBeenCalled();
    });
  });

  describe('Visibility Helpers', () => {
    describe('setTunnelVisible', () => {
      it('should toggle tunnel component visibility', () => {
        const tunnel: TunnelEnvironment = {
          hiveBuilder: {} as any,
          tunnelSegments: [{ setEnabled: vi.fn() } as any],
          tunnelLights: [{ setEnabled: vi.fn() } as any],
          collapseWall: { isVisible: true } as any,
          exitLight: { setEnabled: vi.fn() } as any,
        };

        setTunnelVisible(tunnel, false);

        expect(tunnel.tunnelSegments[0].setEnabled).toHaveBeenCalledWith(false);
        expect(tunnel.tunnelLights[0].setEnabled).toHaveBeenCalledWith(false);
        expect(tunnel.collapseWall.isVisible).toBe(false);
        expect(tunnel.exitLight.setEnabled).toHaveBeenCalledWith(false);
      });

      it('should handle visible = true', () => {
        const tunnel: TunnelEnvironment = {
          hiveBuilder: {} as any,
          tunnelSegments: [{ setEnabled: vi.fn() } as any],
          tunnelLights: [],
          collapseWall: { isVisible: false } as any,
          exitLight: { setEnabled: vi.fn() } as any,
        };

        setTunnelVisible(tunnel, true);

        expect(tunnel.collapseWall.isVisible).toBe(true);
      });
    });

    describe('setSurfaceVisible', () => {
      it('should toggle all surface components', () => {
        const terrain = { isVisible: true } as any;
        const extractionEnv = {
          root: { setEnabled: vi.fn() },
          lights: [{ setEnabled: vi.fn() }],
        } as any;
        const skyDome = { isVisible: true } as any;
        const lzPad = { isVisible: true } as any;
        const lzBeacon = { isVisible: true } as any;
        const breachHoles = [{ isVisible: true } as any];
        const canyonWalls = [{ isVisible: true } as any];
        const barrierWalls = [{ isVisible: true } as any];
        const coverObjects = [{ isVisible: true } as any];
        const mechMesh = { setEnabled: vi.fn() } as any;

        setSurfaceVisible(
          terrain,
          extractionEnv,
          skyDome,
          lzPad,
          lzBeacon,
          breachHoles,
          canyonWalls,
          barrierWalls,
          coverObjects,
          mechMesh,
          false
        );

        expect(terrain.isVisible).toBe(false);
        expect(extractionEnv.root.setEnabled).toHaveBeenCalledWith(false);
        expect(extractionEnv.lights[0].setEnabled).toHaveBeenCalledWith(false);
        expect(skyDome.isVisible).toBe(false);
        expect(lzPad.isVisible).toBe(false);
        expect(lzBeacon.isVisible).toBe(false);
        expect(breachHoles[0].isVisible).toBe(false);
        expect(canyonWalls[0].isVisible).toBe(false);
        expect(barrierWalls[0].isVisible).toBe(false);
        expect(coverObjects[0].isVisible).toBe(false);
        expect(mechMesh.setEnabled).toHaveBeenCalledWith(false);
      });

      it('should handle null values', () => {
        expect(() => {
          setSurfaceVisible(null, null, null, null, null, [], [], [], [], null, false);
        }).not.toThrow();
      });
    });
  });

  describe('preloadAssets', () => {
    it('should preload all required assets', async () => {
      const AssetManagerModule = await import('../../core/AssetManager');

      await preloadAssets(mockScene);

      // Should load mech, dropship, supply drop, ammo box, crumbling wall, debris
      expect(AssetManagerModule.AssetManager.loadAssetByPath).toHaveBeenCalled();
    });
  });
});
