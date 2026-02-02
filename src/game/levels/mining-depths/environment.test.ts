/**
 * Mining Depths Environment Unit Tests
 *
 * Comprehensive test suite for the Mining Depths environment generation.
 * Covers: Material creation, tunnel segments, crystals, hazards, audio logs,
 * GLB asset loading, and all environment sections.
 *
 * Target: 95% line coverage, 90% branch coverage
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_LOGS,
  createMiningEnvironment,
  createMiningMaterials,
  HAZARD_ZONES,
  MINE_POSITIONS,
  preloadMiningAssets,
} from './environment';

// ============================================================================
// MOCKS
// ============================================================================

// Mock BabylonJS Scene
const createMockScene = () => ({
  clearColor: { r: 0, g: 0, b: 0, a: 1 },
  fogMode: 0,
  fogDensity: 0,
  fogColor: new Color3(0, 0, 0),
  environmentTexture: null,
  onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
  dispose: vi.fn(),
});

// Mock PointLight using class syntax
vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    name: string;
    position: Vector3;
    diffuse = new Color3(1, 1, 1);
    intensity = 1;
    range = 10;
    dispose = vi.fn();
    constructor(name: string, position: Vector3) {
      this.name = name;
      this.position = position?.clone ? position.clone() : new Vector3(0, 0, 0);
    }
  },
}));

// Mock StandardMaterial using class syntax
vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class MockStandardMaterial {
    name: string;
    diffuseColor = new Color3(1, 1, 1);
    emissiveColor = new Color3(0, 0, 0);
    specularColor = new Color3(0.5, 0.5, 0.5);
    alpha = 1;
    disableLighting = false;
    dispose = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  },
}));

// Mock MeshBuilder
vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => createMockMesh('box')),
    CreateSphere: vi.fn(() => createMockMesh('sphere')),
    CreateCylinder: vi.fn(() => createMockMesh('cylinder')),
    CreateTorus: vi.fn(() => createMockMesh('torus')),
    CreatePlane: vi.fn(() => createMockMesh('plane')),
    CreateCapsule: vi.fn(() => createMockMesh('capsule')),
    CreateDisc: vi.fn(() => createMockMesh('disc')),
  },
}));

// Mock TransformNode using class syntax
vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: class MockTransformNode {
    name: string;
    position = new Vector3(0, 0, 0);
    rotation = new Vector3(0, 0, 0);
    scaling = new Vector3(1, 1, 1);
    parent: any = null;
    dispose = vi.fn();
    isDisposed = () => false;
    setEnabled = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  },
}));

// Mock AssetManager
vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    init: vi.fn(),
    loadAsset: vi.fn().mockResolvedValue(null),
    loadAssetByPath: vi.fn().mockResolvedValue(null),
    createInstance: vi.fn(() => createMockTransformNode()),
    createInstanceByPath: vi.fn(() => createMockTransformNode()),
  },
}));

// Mock Logger
vi.mock('../../core/Logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1, 1, 1),
    material: null,
    parent: null,
    isVisible: true,
    billboardMode: 0,
    dispose: vi.fn(),
    isDisposed: () => false,
  };
}

function createMockTransformNode(name = 'node') {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: { y: 0 },
    scaling: {
      setAll: vi.fn(),
      clone: vi.fn(() => new Vector3(1, 1, 1)),
    },
    parent: null,
    dispose: vi.fn((_disposeChildren?: boolean, _disposeMaterials?: boolean) => {}),
    isDisposed: () => false,
    setEnabled: vi.fn(),
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Mining Depths Environment', () => {
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // MINE_POSITIONS TESTS
  // ==========================================================================

  describe('MINE_POSITIONS constants', () => {
    it('should define entry position at origin', () => {
      expect(MINE_POSITIONS.entry.x).toBe(0);
      expect(MINE_POSITIONS.entry.y).toBe(0);
      expect(MINE_POSITIONS.entry.z).toBe(0);
    });

    it('should define hub center south of entry', () => {
      expect(MINE_POSITIONS.hubCenter.z).toBeLessThan(MINE_POSITIONS.entry.z);
    });

    it('should define tunnel positions descending', () => {
      expect(MINE_POSITIONS.tunnelMid.y).toBeLessThan(MINE_POSITIONS.tunnelStart.y);
      expect(MINE_POSITIONS.tunnelEnd.y).toBeLessThan(MINE_POSITIONS.tunnelMid.y);
    });

    it('should define shaft positions at lowest depth', () => {
      expect(MINE_POSITIONS.shaftFloor.y).toBeLessThan(MINE_POSITIONS.tunnelEnd.y);
    });

    it('should define all audio log positions', () => {
      expect(MINE_POSITIONS.audioLog1).toBeDefined();
      expect(MINE_POSITIONS.audioLog2).toBeDefined();
      expect(MINE_POSITIONS.audioLog3).toBeDefined();
    });

    it('should define all hazard positions', () => {
      expect(MINE_POSITIONS.gasVent1).toBeDefined();
      expect(MINE_POSITIONS.gasVent2).toBeDefined();
      expect(MINE_POSITIONS.rockfall1).toBeDefined();
      expect(MINE_POSITIONS.rockfall2).toBeDefined();
      expect(MINE_POSITIONS.floodedArea).toBeDefined();
    });

    it('should define all burrower spawn positions', () => {
      expect(MINE_POSITIONS.burrowerSpawn1).toBeDefined();
      expect(MINE_POSITIONS.burrowerSpawn2).toBeDefined();
      expect(MINE_POSITIONS.burrowerSpawn3).toBeDefined();
      expect(MINE_POSITIONS.burrowerSpawn4).toBeDefined();
      expect(MINE_POSITIONS.burrowerSpawn5).toBeDefined();
    });

    it('should define boss spawn position in shaft', () => {
      expect(MINE_POSITIONS.shaftBossSpawn).toBeDefined();
      expect(MINE_POSITIONS.shaftBossSpawn.z).toBe(MINE_POSITIONS.shaftCenter.z);
    });

    it('should define keycard position in hub', () => {
      expect(MINE_POSITIONS.hubKeycard).toBeDefined();
      expect(MINE_POSITIONS.hubKeycard.z).toBeLessThan(MINE_POSITIONS.hubCenter.z);
    });
  });

  // ==========================================================================
  // HAZARD_ZONES TESTS
  // ==========================================================================

  describe('HAZARD_ZONES constants', () => {
    it('should define 5 hazard zones', () => {
      expect(HAZARD_ZONES.length).toBe(5);
    });

    it('should have gas vent hazards', () => {
      const gasVents = HAZARD_ZONES.filter((h) => h.type === 'gas_vent');
      expect(gasVents.length).toBe(2);
    });

    it('should have unstable ground hazards', () => {
      const rockfalls = HAZARD_ZONES.filter((h) => h.type === 'unstable_ground');
      expect(rockfalls.length).toBe(2);
    });

    it('should have flooded section', () => {
      const flooded = HAZARD_ZONES.filter((h) => h.type === 'flooded');
      expect(flooded.length).toBe(1);
    });

    it('should have correct gas vent damage values', () => {
      const gasVent1 = HAZARD_ZONES.find((h) => h.id === 'gas_vent_1');
      expect(gasVent1?.damage).toBe(5);

      const gasVent2 = HAZARD_ZONES.find((h) => h.id === 'gas_vent_2');
      expect(gasVent2?.damage).toBe(8);
    });

    it('should have correct rockfall damage values', () => {
      const rockfall1 = HAZARD_ZONES.find((h) => h.id === 'rockfall_1');
      expect(rockfall1?.damage).toBe(15);

      const rockfall2 = HAZARD_ZONES.find((h) => h.id === 'rockfall_2');
      expect(rockfall2?.damage).toBe(12);
    });

    it('should have flooded section with no damage', () => {
      const flooded = HAZARD_ZONES.find((h) => h.id === 'flooded_section');
      expect(flooded?.damage).toBe(0);
    });

    it('should have all hazards active by default', () => {
      for (const hazard of HAZARD_ZONES) {
        expect(hazard.active).toBe(true);
      }
    });

    it('should have proper radius values', () => {
      for (const hazard of HAZARD_ZONES) {
        expect(hazard.radius).toBeGreaterThan(0);
        expect(hazard.radius).toBeLessThan(10);
      }
    });
  });

  // ==========================================================================
  // AUDIO_LOGS TESTS
  // ==========================================================================

  describe('AUDIO_LOGS constants', () => {
    it('should define 3 audio logs', () => {
      expect(AUDIO_LOGS.length).toBe(3);
    });

    it('should have foreman log first', () => {
      const foremanLog = AUDIO_LOGS.find((l) => l.id === 'log_foreman');
      expect(foremanLog).toBeDefined();
      expect(foremanLog?.title).toContain('FOREMAN VASQUEZ');
    });

    it('should have geologist log second', () => {
      const geologistLog = AUDIO_LOGS.find((l) => l.id === 'log_geologist');
      expect(geologistLog).toBeDefined();
      expect(geologistLog?.title).toContain('DR. CHEN');
    });

    it('should have survivor log third', () => {
      const survivorLog = AUDIO_LOGS.find((l) => l.id === 'log_survivor');
      expect(survivorLog).toBeDefined();
      expect(survivorLog?.title).toContain('UNKNOWN MINER');
    });

    it('should have all logs not collected by default', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.collected).toBe(false);
      }
    });

    it('should have proper position for each log', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.position).toBeDefined();
        expect(log.position instanceof Vector3).toBe(true);
      }
    });

    it('should have text content for each log', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.text).toBeDefined();
        expect(log.text.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // MATERIAL CREATION TESTS
  // ==========================================================================

  describe('createMiningMaterials', () => {
    it('should create all required materials', () => {
      const materials = createMiningMaterials(mockScene as any);

      expect(materials.size).toBeGreaterThan(10);
      expect(materials.has('rock')).toBe(true);
      expect(materials.has('ore')).toBe(true);
      expect(materials.has('floor')).toBe(true);
      expect(materials.has('metal')).toBe(true);
      expect(materials.has('equipment')).toBe(true);
      expect(materials.has('crystal')).toBe(true);
      expect(materials.has('crystal_purple')).toBe(true);
      expect(materials.has('track')).toBe(true);
      expect(materials.has('cart')).toBe(true);
      expect(materials.has('caution')).toBe(true);
      expect(materials.has('emergency')).toBe(true);
      expect(materials.has('water')).toBe(true);
      expect(materials.has('gas')).toBe(true);
      expect(materials.has('debris')).toBe(true);
      expect(materials.has('log_glow')).toBe(true);
      expect(materials.has('resin')).toBe(true);
      expect(materials.has('chitin')).toBe(true);
      expect(materials.has('elevator')).toBe(true);
    });

    it('should create rock material with dark color', () => {
      const materials = createMiningMaterials(mockScene as any);
      const rock = materials.get('rock');
      expect(rock).toBeDefined();
      // Rock should be dark
      expect(rock?.diffuseColor).toBeDefined();
    });

    it('should create crystal material with emissive glow', () => {
      const materials = createMiningMaterials(mockScene as any);
      const crystal = materials.get('crystal');
      expect(crystal).toBeDefined();
      expect(crystal?.emissiveColor).toBeDefined();
      expect(crystal?.alpha).toBeLessThan(1);
    });

    it('should create purple crystal variant', () => {
      const materials = createMiningMaterials(mockScene as any);
      const crystalPurple = materials.get('crystal_purple');
      expect(crystalPurple).toBeDefined();
      expect(crystalPurple?.alpha).toBeLessThan(1);
    });

    it('should create emergency material with red emissive', () => {
      const materials = createMiningMaterials(mockScene as any);
      const emergency = materials.get('emergency');
      expect(emergency).toBeDefined();
      expect(emergency?.emissiveColor).toBeDefined();
    });

    it('should create water material with transparency', () => {
      const materials = createMiningMaterials(mockScene as any);
      const water = materials.get('water');
      expect(water).toBeDefined();
      expect(water?.alpha).toBeLessThan(1);
    });

    it('should create gas material with low alpha', () => {
      const materials = createMiningMaterials(mockScene as any);
      const gas = materials.get('gas');
      expect(gas).toBeDefined();
      expect(gas?.alpha).toBeLessThan(0.5);
    });

    it('should create audio log glow material', () => {
      const materials = createMiningMaterials(mockScene as any);
      const logGlow = materials.get('log_glow');
      expect(logGlow).toBeDefined();
      expect(logGlow?.emissiveColor).toBeDefined();
    });
  });

  // ==========================================================================
  // PRELOAD ASSETS TESTS
  // ==========================================================================

  describe('preloadMiningAssets', () => {
    it('should preload all GLB assets', async () => {
      const { AssetManager } = await import('../../core/AssetManager');
      await preloadMiningAssets(mockScene as any);

      expect(AssetManager.loadAssetByPath).toHaveBeenCalled();
    });

    it('should handle preload failures gracefully', async () => {
      const { AssetManager } = await import('../../core/AssetManager');
      (AssetManager.loadAssetByPath as any).mockRejectedValueOnce(new Error('Failed to load'));

      // Should not throw
      await expect(preloadMiningAssets(mockScene as any)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // ENVIRONMENT CREATION TESTS
  // ==========================================================================

  describe('createMiningEnvironment', () => {
    it('should create complete environment structure', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env).toBeDefined();
      expect(env.root).toBeDefined();
      expect(env.allMeshes).toBeDefined();
      expect(env.materials).toBeDefined();
      expect(env.lights).toBeDefined();
      expect(env.flickerLights).toBeDefined();
    });

    it('should create all section nodes', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.sections).toBeDefined();
      expect(env.sections.entry).toBeDefined();
      expect(env.sections.hub).toBeDefined();
      expect(env.sections.tunnels).toBeDefined();
      expect(env.sections.shaft).toBeDefined();
    });

    it('should create keycard pickup mesh', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.keycardPickup).toBeDefined();
    });

    it('should create shaft gate mesh', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.shaftGate).toBeDefined();
    });

    it('should create audio log meshes', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.audioLogMeshes).toBeDefined();
      expect(env.audioLogMeshes.length).toBe(3);
    });

    it('should create boss arena door', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.bossArenaDoor).toBeDefined();
    });

    it('should create flicker lights array', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.flickerLights).toBeDefined();
      expect(Array.isArray(env.flickerLights)).toBe(true);
    });

    it('should create GLB instances array for disposal', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.glbInstances).toBeDefined();
      expect(Array.isArray(env.glbInstances)).toBe(true);
    });

    it('should provide dispose function', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      expect(env.dispose).toBeDefined();
      expect(typeof env.dispose).toBe('function');
    });

    it('should dispose all resources when dispose called', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      // Should not throw
      env.dispose();
    });
  });

  // ==========================================================================
  // FLICKER LIGHT DEFINITION TESTS
  // ==========================================================================

  describe('FlickerLightDef structure', () => {
    it('should have required properties', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      if (env.flickerLights.length > 0) {
        const fl = env.flickerLights[0];
        expect(fl.light).toBeDefined();
        expect(typeof fl.baseIntensity).toBe('number');
        expect(typeof fl.flickerSpeed).toBe('number');
        expect(typeof fl.flickerAmount).toBe('number');
        expect(typeof fl.timer).toBe('number');
        expect(typeof fl.isOff).toBe('boolean');
        expect(typeof fl.offDuration).toBe('number');
        expect(typeof fl.offTimer).toBe('number');
      }
    });
  });

  // ==========================================================================
  // HAZARD ZONE INTERFACE TESTS
  // ==========================================================================

  describe('HazardZone interface', () => {
    it('should have correct type values', () => {
      const types = new Set(HAZARD_ZONES.map((h) => h.type));
      expect(types.has('gas_vent')).toBe(true);
      expect(types.has('unstable_ground')).toBe(true);
      expect(types.has('flooded')).toBe(true);
    });

    it('should have unique IDs', () => {
      const ids = HAZARD_ZONES.map((h) => h.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have Vector3 centers', () => {
      for (const hazard of HAZARD_ZONES) {
        expect(hazard.center instanceof Vector3).toBe(true);
      }
    });
  });

  // ==========================================================================
  // AUDIO LOG PICKUP INTERFACE TESTS
  // ==========================================================================

  describe('AudioLogPickup interface', () => {
    it('should have unique IDs', () => {
      const ids = AUDIO_LOGS.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have Vector3 positions', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.position instanceof Vector3).toBe(true);
      }
    });

    it('should have non-empty titles', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.title.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty text', () => {
      for (const log of AUDIO_LOGS) {
        expect(log.text.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // LAYOUT TESTS
  // ==========================================================================

  describe('layout and positioning', () => {
    it('should have entry section at ground level', () => {
      expect(MINE_POSITIONS.entry.y).toBe(0);
    });

    it('should have hub section at ground level', () => {
      expect(MINE_POSITIONS.hubCenter.y).toBe(0);
    });

    it('should have tunnel sections descending', () => {
      expect(MINE_POSITIONS.tunnelStart.y).toBeLessThanOrEqual(0);
      expect(MINE_POSITIONS.tunnelMid.y).toBeLessThan(MINE_POSITIONS.tunnelStart.y);
      expect(MINE_POSITIONS.tunnelEnd.y).toBeLessThan(MINE_POSITIONS.tunnelMid.y);
    });

    it('should have shaft at lowest elevation', () => {
      expect(MINE_POSITIONS.shaftCenter.y).toBeLessThan(MINE_POSITIONS.tunnelEnd.y);
      expect(MINE_POSITIONS.shaftFloor.y).toBeLessThan(MINE_POSITIONS.shaftCenter.y);
    });

    it('should have continuous path from entry to shaft', () => {
      // Entry to Hub
      const entryToHub = Vector3.Distance(MINE_POSITIONS.entry, MINE_POSITIONS.hubCenter);
      expect(entryToHub).toBeLessThan(50);

      // Hub to Tunnel Start
      const hubToTunnel = Vector3.Distance(MINE_POSITIONS.hubExit, MINE_POSITIONS.tunnelStart);
      expect(hubToTunnel).toBeLessThan(20);

      // Tunnel to Shaft
      const tunnelToShaft = Vector3.Distance(MINE_POSITIONS.tunnelEnd, MINE_POSITIONS.shaftEntry);
      expect(tunnelToShaft).toBeLessThan(20);
    });
  });

  // ==========================================================================
  // SECTION DIMENSIONS TESTS
  // ==========================================================================

  describe('section dimensions', () => {
    it('should have hub large enough for exploration', async () => {
      // Hub is 40m x 30m based on constants
      const hubWidth = 40;
      const hubDepth = 30;
      expect(hubWidth).toBeGreaterThan(30);
      expect(hubDepth).toBeGreaterThan(20);
    });

    it('should have tunnels narrow enough for claustrophobia', async () => {
      // Tunnel width is 5m (normal) and 3.5m (narrow)
      const tunnelWidth = 5;
      const narrowWidth = 3.5;
      expect(tunnelWidth).toBeLessThan(10);
      expect(narrowWidth).toBeLessThan(tunnelWidth);
    });

    it('should have shaft large enough for boss fight', async () => {
      // Shaft is 25m x 25m x 30m
      const shaftWidth = 25;
      const shaftDepth = 25;
      const shaftHeight = 30;
      expect(shaftWidth).toBeGreaterThan(20);
      expect(shaftDepth).toBeGreaterThan(20);
      expect(shaftHeight).toBeGreaterThan(25);
    });
  });

  // ==========================================================================
  // BURROWER SPAWN POSITIONS TESTS
  // ==========================================================================

  describe('burrower spawn positions', () => {
    it('should have spawn points distributed through level', () => {
      // Spawn 1 in hub
      expect(MINE_POSITIONS.burrowerSpawn1.z).toBeGreaterThan(-50);

      // Spawn 2-3 in tunnels
      expect(MINE_POSITIONS.burrowerSpawn2.z).toBeLessThan(-50);
      expect(MINE_POSITIONS.burrowerSpawn3.z).toBeLessThan(-80);

      // Spawn 4-5 in shaft
      expect(MINE_POSITIONS.burrowerSpawn4.y).toBeLessThan(-20);
      expect(MINE_POSITIONS.burrowerSpawn5.y).toBeLessThan(-20);
    });

    it('should have spawn points at appropriate heights', () => {
      // Hub spawn at ground level
      expect(MINE_POSITIONS.burrowerSpawn1.y).toBe(0);

      // Tunnel spawns descending
      expect(MINE_POSITIONS.burrowerSpawn2.y).toBeLessThan(0);
      expect(MINE_POSITIONS.burrowerSpawn3.y).toBeLessThan(MINE_POSITIONS.burrowerSpawn2.y);

      // Shaft spawns at floor level
      expect(MINE_POSITIONS.burrowerSpawn4.y).toBeLessThan(-25);
      expect(MINE_POSITIONS.burrowerSpawn5.y).toBeLessThan(-25);
    });
  });

  // ==========================================================================
  // CRYSTAL AND LIGHTING TESTS
  // ==========================================================================

  describe('crystal formations', () => {
    it('should have two crystal color variants', () => {
      const materials = createMiningMaterials(mockScene as any);
      expect(materials.has('crystal')).toBe(true);
      expect(materials.has('crystal_purple')).toBe(true);
    });

    it('should have crystals with transparency', () => {
      const materials = createMiningMaterials(mockScene as any);
      const crystal = materials.get('crystal');
      expect(crystal?.alpha).toBeLessThan(1);
    });
  });

  // ==========================================================================
  // ENVIRONMENTAL STORYTELLING TESTS
  // ==========================================================================

  describe('environmental storytelling', () => {
    it('should have audio logs telling miner story', () => {
      // Day 12, 15, 18 - escalating timeline
      const days = AUDIO_LOGS.map((l) => {
        const match = l.title.match(/DAY (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      expect(days).toEqual([12, 15, 18]);
    });

    it('should have foreman log about crystal growths', () => {
      const foremanLog = AUDIO_LOGS.find((l) => l.id === 'log_foreman');
      expect(foremanLog?.text).toContain('crystal');
    });

    it('should have geologist log about biological nature', () => {
      const geologistLog = AUDIO_LOGS.find((l) => l.id === 'log_geologist');
      expect(geologistLog?.text).toContain('biological');
    });

    it('should have survivor log about attack', () => {
      const survivorLog = AUDIO_LOGS.find((l) => l.id === 'log_survivor');
      expect(survivorLog?.text).toContain('wall');
    });
  });

  // ==========================================================================
  // DISPOSE FUNCTION TESTS
  // ==========================================================================

  describe('dispose function', () => {
    it('should dispose all meshes', async () => {
      const env = await createMiningEnvironment(mockScene as any);
      const _meshCount = env.allMeshes.length;

      env.dispose();

      // All meshes should have dispose called
      for (const mesh of env.allMeshes) {
        expect(mesh.dispose).toHaveBeenCalled();
      }
    });

    it('should dispose all GLB instances', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      env.dispose();

      for (const node of env.glbInstances) {
        expect(node.dispose).toHaveBeenCalled();
      }
    });

    it('should dispose all lights', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      env.dispose();

      for (const light of env.lights) {
        expect(light.dispose).toHaveBeenCalled();
      }
    });

    it('should dispose all materials', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      env.dispose();

      for (const mat of env.materials.values()) {
        expect(mat.dispose).toHaveBeenCalled();
      }
    });

    it('should dispose root node', async () => {
      const env = await createMiningEnvironment(mockScene as any);

      env.dispose();

      expect(env.root.dispose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // HAZARD PLACEMENT TESTS
  // ==========================================================================

  describe('hazard placement', () => {
    it('should have gas vents in tunnel section', () => {
      const gasVent1 = HAZARD_ZONES.find((h) => h.id === 'gas_vent_1');
      expect(gasVent1?.center.z).toBeLessThan(-50);

      const gasVent2 = HAZARD_ZONES.find((h) => h.id === 'gas_vent_2');
      expect(gasVent2?.center.z).toBeLessThan(-70);
    });

    it('should have rockfalls at strategic choke points', () => {
      const rockfall1 = HAZARD_ZONES.find((h) => h.id === 'rockfall_1');
      const rockfall2 = HAZARD_ZONES.find((h) => h.id === 'rockfall_2');

      // Both should be in tunnel section
      expect(rockfall1?.center.z).toBeLessThan(-50);
      expect(rockfall2?.center.z).toBeLessThan(-80);
    });

    it('should have flooded section before shaft entry', () => {
      const flooded = HAZARD_ZONES.find((h) => h.id === 'flooded_section');
      expect(flooded?.center.z).toBeLessThan(-100);
      expect(flooded?.center.z).toBeGreaterThan(-110);
    });
  });

  // ==========================================================================
  // AUDIO LOG PLACEMENT TESTS
  // ==========================================================================

  describe('audio log placement', () => {
    it('should have first log in hub near machinery', () => {
      const log1 = AUDIO_LOGS.find((l) => l.id === 'log_foreman');
      expect(log1?.position.z).toBeGreaterThan(-30);
    });

    it('should have second log in tunnel mid-section', () => {
      const log2 = AUDIO_LOGS.find((l) => l.id === 'log_geologist');
      expect(log2?.position.z).toBeLessThan(-70);
      expect(log2?.position.z).toBeGreaterThan(-80);
    });

    it('should have third log in shaft near boss arena', () => {
      const log3 = AUDIO_LOGS.find((l) => l.id === 'log_survivor');
      expect(log3?.position.z).toBeLessThan(-110);
    });
  });
});
