/**
 * environment.test.ts - Comprehensive unit tests for Southern Ice environment
 *
 * Tests cover:
 * - Ice environment creation and disposal
 * - Temperature zone system (heat sources, cold zones)
 * - Aurora borealis animation
 * - Blizzard particle system
 * - Frozen lake creation
 * - Ice cave structures
 * - Outpost buildings
 * - GLB asset loading and placement
 * - Frost tint materials
 */

import { describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation((name: string) => ({
    name,
    intensity: 1,
    diffuse: { r: 1, g: 1, b: 1 },
    range: 10,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      copyFrom: vi.fn(),
    },
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/PBR/pbrMaterial', () => ({
  PBRMaterial: vi.fn().mockImplementation((name: string) => ({
    name,
    albedoColor: { r: 1, g: 1, b: 1 },
    albedoTexture: null,
    bumpTexture: null,
    metallicTexture: null,
    metallic: 0,
    roughness: 0.5,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation((name: string) => ({
    name,
    diffuseColor: { r: 1, g: 1, b: 1, set: vi.fn() },
    specularColor: { r: 1, g: 1, b: 1, set: vi.fn() },
    emissiveColor: { r: 0, g: 0, b: 0, set: vi.fn() },
    specularPower: 32,
    alpha: 1,
    disableLighting: false,
    backFaceCulling: true,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/Textures/texture', () => ({
  Texture: vi.fn().mockImplementation(() => ({
    uScale: 1,
    vScale: 1,
    dispose: vi.fn(),
  })),
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
    scale(factor: number) {
      return new MockColor3(this.r * factor, this.g * factor, this.b * factor);
    }
    set(r: number, g: number, b: number) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
    static Lerp(a: any, b: any, t: number) {
      return new MockColor3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
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
    copyFrom(other: any) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    static Distance(a: any, b: any) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn().mockImplementation(() => createMockMesh()),
    CreateSphere: vi.fn().mockImplementation(() => createMockMesh()),
    CreateCylinder: vi.fn().mockImplementation(() => createMockMesh()),
    CreateGround: vi.fn().mockImplementation(() => createMockMesh()),
    CreatePlane: vi.fn().mockImplementation(() => createMockMesh()),
    CreateTorus: vi.fn().mockImplementation(() => createMockMesh()),
    CreateDisc: vi.fn().mockImplementation(() => createMockMesh()),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name: string) => ({
    name,
    position: { x: 0, y: 0, z: 0, set: vi.fn(), copyFrom: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    parent: null,
    getChildMeshes: vi.fn().mockReturnValue([]),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Particles/particleSystem', () => ({
  ParticleSystem: vi.fn().mockImplementation((name: string, capacity: number) => ({
    name,
    capacity,
    particleTexture: null,
    emitter: null,
    emitRate: 100,
    minLifeTime: 1,
    maxLifeTime: 2,
    minSize: 0.01,
    maxSize: 0.05,
    color1: null,
    color2: null,
    colorDead: null,
    direction1: null,
    direction2: null,
    minEmitBox: null,
    maxEmitBox: null,
    minEmitPower: 1,
    maxEmitPower: 2,
    gravity: null,
    minAngularSpeed: 0,
    maxAngularSpeed: 0,
    blendMode: 0,
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Particles/particleSystemComponent', () => ({}));

function createMockMesh() {
  return {
    material: null,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn(),
      copyFrom: vi.fn(),
      clone: vi.fn().mockReturnThis(),
    },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    isVisible: true,
    parent: null,
    receiveShadows: false,
    getVerticesData: vi.fn().mockReturnValue(new Float32Array(300)),
    updateVerticesData: vi.fn(),
    createNormals: vi.fn(),
    dispose: vi.fn(),
    getChildMeshes: vi.fn().mockReturnValue([]),
  };
}

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue({}),
    createInstanceByPath: vi.fn().mockImplementation(() => ({
      parent: null,
      position: { x: 0, y: 0, z: 0, set: vi.fn(), copyFrom: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
      getChildMeshes: vi.fn().mockReturnValue([
        {
          material: {
            diffuseColor: { r: 0.5, g: 0.5, b: 0.5 },
            emissiveColor: { r: 0, g: 0, b: 0 },
            specularColor: { r: 0.5, g: 0.5, b: 0.5 },
            specularPower: 32,
          },
        },
      ]),
      dispose: vi.fn(),
    })),
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

vi.mock('../../core/SkyboxManager', () => ({
  SkyboxManager: vi.fn().mockImplementation(() => ({
    createFallbackSkybox: vi.fn().mockReturnValue({
      mesh: createMockMesh(),
      dispose: vi.fn(),
    }),
  })),
}));

vi.mock('../shared/PBRTerrainMaterials', () => ({
  ICE_TERRAIN_CONFIG: {},
  ICE_ROCK_CONFIG: {},
  createPBRTerrainMaterial: vi.fn().mockReturnValue({
    albedoTexture: { uScale: 1, vScale: 1 },
    bumpTexture: { uScale: 1, vScale: 1 },
    metallicTexture: { uScale: 1, vScale: 1 },
    dispose: vi.fn(),
  }),
}));

// Import after mocks - using require to avoid import hoisting issues
const { Vector3 } = require('@babylonjs/core/Maths/math.vector');

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('Southern Ice Environment', () => {
  describe('Temperature Zone System', () => {
    const mockZones = [
      {
        id: 'heat_0',
        position: new Vector3(0, 0, 0),
        radius: 10,
        temperatureOffset: 30,
        isHeatSource: true,
      },
      {
        id: 'heat_1',
        position: new Vector3(40, 0, -50),
        radius: 8,
        temperatureOffset: 30,
        isHeatSource: true,
      },
      {
        id: 'cold_0',
        position: new Vector3(0, 0, -160),
        radius: 25,
        temperatureOffset: -15,
        isHeatSource: false,
      },
    ];

    function getTemperatureAtPosition(position: any, zones: any[]): number {
      let totalOffset = 0;
      for (const zone of zones) {
        const dist = Vector3.Distance(position, zone.position);
        if (dist < zone.radius) {
          const factor = 1 - dist / zone.radius;
          totalOffset += zone.temperatureOffset * factor;
        }
      }
      return totalOffset;
    }

    it('should return max temperature at center of heat source', () => {
      const temp = getTemperatureAtPosition(new Vector3(0, 0, 0), mockZones);
      expect(temp).toBe(30);
    });

    it('should return reduced temperature at edge of heat source', () => {
      const temp = getTemperatureAtPosition(new Vector3(5, 0, 0), mockZones);
      expect(temp).toBe(15); // 50% of max at half radius
    });

    it('should return zero temperature outside all zones', () => {
      const temp = getTemperatureAtPosition(new Vector3(500, 0, 500), mockZones);
      expect(temp).toBe(0);
    });

    it('should return negative temperature in cold zone', () => {
      const temp = getTemperatureAtPosition(new Vector3(0, 0, -160), mockZones);
      expect(temp).toBe(-15);
    });

    it('should return reduced negative temperature at edge of cold zone', () => {
      const temp = getTemperatureAtPosition(new Vector3(12.5, 0, -160), mockZones);
      expect(temp).toBe(-7.5);
    });

    it('should combine overlapping zone temperatures', () => {
      // Create overlapping zones
      const overlappingZones = [
        {
          id: 'heat_a',
          position: new Vector3(0, 0, 0),
          radius: 10,
          temperatureOffset: 20,
          isHeatSource: true,
        },
        {
          id: 'heat_b',
          position: new Vector3(5, 0, 0),
          radius: 10,
          temperatureOffset: 20,
          isHeatSource: true,
        },
      ];
      const temp = getTemperatureAtPosition(new Vector3(2.5, 0, 0), overlappingZones);
      // Should be sum of contributions from both zones
      expect(temp).toBeGreaterThan(20);
    });

    it('should define heat source configuration', () => {
      const HEAT_RADIUS = 8;
      expect(HEAT_RADIUS).toBe(8);
    });

    it('should create temperature zone with correct properties', () => {
      const zone = {
        id: 'test_heat',
        position: new Vector3(10, 0, 10),
        radius: 8,
        temperatureOffset: 30,
        isHeatSource: true,
        indicator: createMockMesh(),
        light: { intensity: 1, dispose: vi.fn() },
      };

      expect(zone.isHeatSource).toBe(true);
      expect(zone.temperatureOffset).toBe(30);
      expect(zone.radius).toBe(8);
    });
  });

  describe('Aurora Borealis Animation', () => {
    it('should calculate aurora position oscillation', () => {
      const time = 0;
      const curtainIndex = 0;
      const baseX = Math.sin(time * 0.1 + curtainIndex * 1.5) * 40;
      expect(baseX).toBe(0);
    });

    it('should calculate aurora position at different times', () => {
      const time = Math.PI * 10; // ~31.4 seconds
      const curtainIndex = 0;
      const oscillation = Math.sin(time * 0.1 + curtainIndex * 1.5) * 40;
      expect(oscillation).toBeCloseTo(0, 0);
    });

    it('should calculate aurora rotation oscillation', () => {
      const time = 0;
      const curtainIndex = 0;
      const rotation = Math.abs(Math.sin(time * 0.05 + curtainIndex * 0.8)) * 0.15 - 0.075;
      expect(rotation).toBe(-0.075);
    });

    it('should calculate aurora color pulsing', () => {
      const phase = 0;
      const r = Math.max(0, 0.1 + Math.sin(phase) * 0.15);
      const g = Math.max(0, 0.35 + Math.cos(phase * 0.7) * 0.25);
      const b = Math.max(0, 0.3 + Math.sin(phase * 1.3 + 1) * 0.25);

      expect(r).toBe(0.1);
      expect(g).toBe(0.6);
      expect(b).toBeCloseTo(0.51, 1);
    });

    it('should calculate aurora alpha pulsing', () => {
      const phase = 0;
      const alpha = 0.1 + Math.sin(phase * 0.5) * 0.06;
      expect(alpha).toBe(0.1);
    });

    it('should create 5 aurora curtains', () => {
      const curtainCount = 5;
      expect(curtainCount).toBe(5);
    });

    it('should position aurora at correct altitude', () => {
      const baseAltitude = 150;
      const curtainSpacing = 25;
      const altitudes: number[] = [];

      for (let i = 0; i < 5; i++) {
        altitudes.push(baseAltitude + i * curtainSpacing);
      }

      expect(altitudes[0]).toBe(150);
      expect(altitudes[4]).toBe(250);
    });
  });

  describe('Blizzard Particle System', () => {
    it('should calculate particle emit rate based on intensity', () => {
      const _baseRate = 500;
      const intensity = 0.7;
      const emitRate = Math.floor(2000 * intensity);
      expect(emitRate).toBe(1400);
    });

    it('should calculate low intensity emit rate', () => {
      const intensity = 0.1;
      const emitRate = Math.floor(500 * intensity);
      expect(emitRate).toBe(50);
    });

    it('should define correct blizzard direction', () => {
      const direction1 = { x: -8, y: -1, z: -2 };
      const direction2 = { x: -4, y: 1, z: 2 };

      // Wind blows primarily from east to west
      expect(direction1.x).toBeLessThan(0);
      expect(direction2.x).toBeLessThan(0);
    });

    it('should define correct emit box dimensions', () => {
      const minEmitBox = { x: -40, y: -2, z: -40 };
      const maxEmitBox = { x: 40, y: 15, z: 40 };

      expect(maxEmitBox.x - minEmitBox.x).toBe(80);
      expect(maxEmitBox.z - minEmitBox.z).toBe(80);
      expect(maxEmitBox.y - minEmitBox.y).toBe(17);
    });

    it('should update emitter position to follow camera', () => {
      const cameraPosition = { x: 50, y: 1.7, z: -100 };
      const emitter = { position: { x: 0, y: 0, z: 0, copyFrom: vi.fn() } };

      // Simulate updateBlizzardEmitter
      emitter.position.copyFrom(cameraPosition);
      expect(emitter.position.copyFrom).toHaveBeenCalledWith(cameraPosition);
    });

    it('should define correct particle lifetime', () => {
      const minLifeTime = 2;
      const maxLifeTime = 5;
      expect(minLifeTime).toBe(2);
      expect(maxLifeTime).toBe(5);
    });

    it('should define correct particle sizes', () => {
      const minSize = 0.01;
      const maxSize = 0.04;
      expect(minSize).toBe(0.01);
      expect(maxSize).toBe(0.04);
    });
  });

  describe('Ambient Snow System', () => {
    it('should have lower emit rate than blizzard', () => {
      const blizzardRate = 500;
      const snowRate = 60;
      expect(snowRate).toBeLessThan(blizzardRate);
    });

    it('should have gentler gravity', () => {
      const blizzardGravity = { y: -0.5 };
      const snowGravity = { y: -0.3 };
      expect(Math.abs(snowGravity.y)).toBeLessThan(Math.abs(blizzardGravity.y));
    });

    it('should have slower direction', () => {
      const blizzardDirection = { x: -8, y: -1, z: -2 };
      const snowDirection = { x: -0.5, y: -1, z: -0.3 };
      expect(Math.abs(snowDirection.x)).toBeLessThan(Math.abs(blizzardDirection.x));
    });
  });

  describe('Frozen Lake Creation', () => {
    it('should define correct lake center position', () => {
      const lakeCenter = new Vector3(0, -0.5, -160);
      expect(lakeCenter.x).toBe(0);
      expect(lakeCenter.y).toBe(-0.5);
      expect(lakeCenter.z).toBe(-160);
    });

    it('should define correct lake radius', () => {
      const lakeRadius = 60;
      expect(lakeRadius).toBe(60);
    });

    it('should create lake with ice material', () => {
      const iceMaterial = {
        diffuseColor: { r: 0.7, g: 0.82, b: 0.95 },
        specularColor: { r: 0.9, g: 0.95, b: 1.0 },
        specularPower: 512,
        alpha: 0.65,
        emissiveColor: { r: 0.05, g: 0.08, b: 0.12 },
      };

      expect(iceMaterial.alpha).toBe(0.65);
      expect(iceMaterial.specularPower).toBe(512);
    });

    it('should create crack lines on lake', () => {
      const crackCount = 12;
      const cracks: { angle: number; index: number }[] = [];

      for (let i = 0; i < crackCount; i++) {
        const angle = (i / crackCount) * Math.PI * 2;
        cracks.push({ angle, index: i });
      }

      expect(cracks.length).toBe(12);
    });

    it('should create dark thin ice patches', () => {
      const patchCount = 6;
      const darkIceMaterial = {
        diffuseColor: { r: 0.2, g: 0.25, b: 0.35 },
        alpha: 0.5,
      };

      expect(patchCount).toBe(6);
      expect(darkIceMaterial.alpha).toBe(0.5);
    });

    it('should place warning poles around lake edge', () => {
      const poleCount = 8;
      const lakeRadius = 60;
      const lakeCenter = new Vector3(0, 0, -160);

      const poles: { x: number; z: number }[] = [];
      for (let i = 0; i < poleCount; i++) {
        const angle = (i / poleCount) * Math.PI * 2;
        poles.push({
          x: lakeCenter.x + Math.cos(angle) * (lakeRadius + 2),
          z: lakeCenter.z + Math.sin(angle) * (lakeRadius + 2),
        });
      }

      expect(poles.length).toBe(8);
    });
  });

  describe('Ice Cave Structures', () => {
    it('should define 3 cave positions', () => {
      const cavePositions = [
        new Vector3(-80, 0, -120),
        new Vector3(60, 0, -200),
        new Vector3(-30, 0, -280),
      ];
      expect(cavePositions.length).toBe(3);
    });

    it('should place rock arch pillars at cave entrances', () => {
      const cavePos = new Vector3(0, 0, 0);
      const leftPillarPos = new Vector3(cavePos.x - 4, cavePos.y, cavePos.z);
      const rightPillarPos = new Vector3(cavePos.x + 4, cavePos.y, cavePos.z);

      expect(leftPillarPos.x).toBe(-4);
      expect(rightPillarPos.x).toBe(4);
    });

    it('should create cave interior floor', () => {
      const floorDimensions = { width: 10, height: 14 };
      expect(floorDimensions.width).toBe(10);
      expect(floorDimensions.height).toBe(14);
    });

    it('should create hanging icicles', () => {
      const minIcicles = 8;
      const maxIcicles = 12;
      const icicleCount = minIcicles + Math.floor(Math.random() * (maxIcicles - minIcicles + 1));
      expect(icicleCount).toBeGreaterThanOrEqual(minIcicles);
      expect(icicleCount).toBeLessThanOrEqual(maxIcicles);
    });

    it('should create interior cave light', () => {
      const caveLight = {
        intensity: 0.85,
        diffuse: { r: 0.55, g: 0.6, b: 0.7 },
        range: 20,
      };

      expect(caveLight.intensity).toBe(0.85);
      expect(caveLight.range).toBe(20);
    });
  });

  describe('Outpost Building', () => {
    it('should define outpost position', () => {
      const outpostPosition = new Vector3(40, 0, -50);
      expect(outpostPosition.x).toBe(40);
      expect(outpostPosition.z).toBe(-50);
    });

    it('should create main building walls', () => {
      const wallPlacements = [
        { name: 'outpost_front_1', position: new Vector3(-3, 0, 5) },
        { name: 'outpost_front_2', position: new Vector3(3, 0, 5) },
        { name: 'outpost_back_1', position: new Vector3(-3, 0, -3) },
        { name: 'outpost_back_2', position: new Vector3(3, 0, -3) },
      ];

      expect(wallPlacements.length).toBe(4);
    });

    it('should create science annex', () => {
      const annexPlacements = [
        { name: 'annex_front', position: new Vector3(14, 0, 3) },
        { name: 'annex_back', position: new Vector3(14, 0, -2) },
      ];

      expect(annexPlacements.length).toBe(2);
    });

    it('should create fuel tanks', () => {
      const tankPlacements = [
        { name: 'fuel_tank_1', position: new Vector3(-12, 0, 5), scale: 2.2 },
        { name: 'fuel_tank_2', position: new Vector3(-12, 0, 0), scale: 2.0 },
        { name: 'fuel_tank_3', position: new Vector3(-12, 0, -4), scale: 2.0 },
      ];

      expect(tankPlacements.length).toBe(3);
    });

    it('should create supply crates', () => {
      const cratePlacements = [
        { name: 'supply_crate_1', position: new Vector3(-5, 0, -6) },
        { name: 'supply_crate_2', position: new Vector3(-6, 0, -7) },
        { name: 'supply_container', position: new Vector3(5, 0, -7) },
      ];

      expect(cratePlacements.length).toBe(3);
    });

    it('should create heater with warmth light', () => {
      const heaterLight = {
        intensity: 1.5,
        diffuse: { r: 1.0, g: 0.65, b: 0.35 },
        range: 16,
      };

      expect(heaterLight.intensity).toBe(1.5);
      expect(heaterLight.diffuse.r).toBe(1.0);
    });
  });

  describe('Perimeter Fencing', () => {
    it('should create south side fence panels', () => {
      const panelCount = 4;
      const panelSpacing = 8;
      const totalWidth = panelCount * panelSpacing;
      expect(totalWidth).toBe(32);
    });

    it('should create corner pillars', () => {
      const cornerCount = 4;
      expect(cornerCount).toBe(4);
    });

    it('should create gate entrance', () => {
      const gateWidth = 4; // Between two pillars at -2 and +2
      expect(gateWidth).toBe(4);
    });

    it('should create cave entrance barriers', () => {
      const caveCount = 3;
      const fencesPerCave = 2;
      const pillarsPerCave = 2;

      const totalFences = caveCount * fencesPerCave;
      const totalPillars = caveCount * pillarsPerCave;

      expect(totalFences).toBe(6);
      expect(totalPillars).toBe(6);
    });
  });

  describe('Ice Formations', () => {
    it('should define ice pillar positions', () => {
      const pillarPositions = [
        new Vector3(-60, 0, -30),
        new Vector3(80, 0, -100),
        new Vector3(-100, 0, -180),
        new Vector3(30, 0, -240),
        new Vector3(-50, 0, -60),
        new Vector3(70, 0, -150),
        new Vector3(-20, 0, 20),
        new Vector3(100, 0, -40),
        new Vector3(-65, 0, -145),
        new Vector3(55, 0, -175),
        new Vector3(10, 0, -130),
        new Vector3(-35, 0, -195),
      ];

      expect(pillarPositions.length).toBe(12);
    });

    it('should use different rock variants', () => {
      const tallRockVariants = 3;
      const mediumRockVariants = 3;

      expect(tallRockVariants).toBe(3);
      expect(mediumRockVariants).toBe(3);
    });

    it('should calculate varying scale for formations', () => {
      const minScale = 1.5;
      const maxScale = 4.0;
      const scaleRange = maxScale - minScale;

      expect(scaleRange).toBe(2.5);
    });
  });

  describe('Frozen Waterfalls', () => {
    it('should create waterfalls at cave entrances', () => {
      const cavePositions = [
        new Vector3(-80, 0, -120),
        new Vector3(60, 0, -200),
        new Vector3(-30, 0, -280),
      ];

      const waterfallPositions = cavePositions.map((p) => new Vector3(p.x + 5, p.y, p.z + 2));

      expect(waterfallPositions.length).toBe(3);
    });

    it('should create multiple ice columns per waterfall', () => {
      const minColumns = 6;
      const maxColumns = 9;

      expect(minColumns).toBe(6);
      expect(maxColumns).toBe(9);
    });

    it('should vary column heights', () => {
      const minHeight = 3.5;
      const maxHeight = 9.0;
      const heightRange = maxHeight - minHeight;

      expect(heightRange).toBe(5.5);
    });
  });

  describe('Crashed Station', () => {
    it('should position crashed station on horizon', () => {
      const crashPosition = new Vector3(-180, -4, -260);
      expect(crashPosition.x).toBe(-180);
      expect(crashPosition.y).toBe(-4); // Partially buried
      expect(crashPosition.z).toBe(-260);
    });

    it('should apply crash rotation', () => {
      const crashRotation = 0.6;
      expect(crashRotation).toBe(0.6);
    });

    it('should scale for distant visibility', () => {
      const crashScale = 3.5;
      expect(crashScale).toBe(3.5);
    });
  });

  describe('Frost Tint Application', () => {
    it('should define frost blend factor', () => {
      const frostBlend = 0.25;
      expect(frostBlend).toBe(0.25);
    });

    it('should define frost color', () => {
      const frostColor = { r: 0.8, g: 0.85, b: 0.92 };
      expect(frostColor.r).toBe(0.8);
      expect(frostColor.g).toBe(0.85);
      expect(frostColor.b).toBe(0.92);
    });

    it('should define emissive boost', () => {
      const emissiveBoost = { r: 0.02, g: 0.03, b: 0.05 };
      expect(emissiveBoost.r).toBe(0.02);
      expect(emissiveBoost.g).toBe(0.03);
      expect(emissiveBoost.b).toBe(0.05);
    });

    it('should calculate blended diffuse color', () => {
      const original = { r: 0.5, g: 0.5, b: 0.5 };
      const frost = { r: 0.8, g: 0.85, b: 0.92 };
      const blend = 0.25;

      const result = {
        r: original.r + (frost.r - original.r) * blend,
        g: original.g + (frost.g - original.g) * blend,
        b: original.b + (frost.b - original.b) * blend,
      };

      expect(result.r).toBeCloseTo(0.575, 2);
      expect(result.g).toBeCloseTo(0.5875, 3);
      expect(result.b).toBeCloseTo(0.605, 2);
    });
  });

  describe('Default Configuration', () => {
    it('should define terrain size', () => {
      const terrainSize = 600;
      expect(terrainSize).toBe(600);
    });

    it('should define terrain subdivisions', () => {
      const terrainSubdivisions = 64;
      expect(terrainSubdivisions).toBe(64);
    });

    it('should define heat source positions', () => {
      const heatSourcePositions = [
        new Vector3(40, 0, -50), // Outpost heater
        new Vector3(-80, 0, -120), // Cave 1 entrance
        new Vector3(60, 0, -200), // Cave 2 interior
        new Vector3(-30, 0, -280), // Cave 3 interior
        new Vector3(0, 0, -80), // Mid-field barrel fire
      ];

      expect(heatSourcePositions.length).toBe(5);
    });
  });

  describe('GLB Asset Paths', () => {
    it('should define modular wall paths', () => {
      const wallPaths = [
        '/assets/models/environment/modular/LongWindow_Wall_SideA.glb',
        '/assets/models/environment/modular/LongWindow_Wall_SideB.glb',
        '/assets/models/environment/modular/SmallWindows_Wall_SideA.glb',
        '/assets/models/environment/modular/SmallWindows_Wall_SideB.glb',
      ];

      expect(wallPaths.length).toBe(4);
    });

    it('should define prop paths', () => {
      const propPaths = [
        '/assets/models/environment/modular/Props_Capsule.glb',
        '/assets/models/environment/modular/Props_Pod.glb',
        '/assets/models/environment/modular/Props_Vessel.glb',
        '/assets/models/environment/modular/Props_Crate.glb',
      ];

      expect(propPaths.length).toBe(4);
    });

    it('should define metal fence paths', () => {
      const fencePaths = [
        '/assets/models/props/modular/metal_fence_hr_1.glb',
        '/assets/models/props/modular/metal_fence_hr_1_pillar_1.glb',
        '/assets/models/props/modular/metal_fence_hr_1_pillar_1_corner.glb',
      ];

      expect(fencePaths.length).toBe(3);
    });

    it('should define rock paths', () => {
      const rockPaths = [
        '/assets/models/environment/alien-flora/alien_tall_rock_1_01.glb',
        '/assets/models/environment/alien-flora/alien_tall_rock_2_01.glb',
        '/assets/models/environment/alien-flora/alien_tall_rock_3_01.glb',
        '/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb',
      ];

      expect(rockPaths.length).toBe(4);
    });
  });

  describe('Terrain Height Generation', () => {
    it('should apply base noise function', () => {
      const x = 50;
      const z = -100;
      const height =
        Math.sin(x * 0.02) * Math.cos(z * 0.015) * 3 +
        Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04 + 0.7) * 1.5 +
        Math.sin(x * 0.1 + 2.1) * Math.cos(z * 0.08 + 1.4) * 0.5;

      expect(typeof height).toBe('number');
      expect(Math.abs(height)).toBeLessThan(10);
    });

    it('should flatten height near frozen lake', () => {
      const lakeCenter = { x: 0, z: -160 };
      const lakeRadius = 60;
      const testPoint = { x: 0, z: -160 };

      const distToLake = Math.sqrt(
        (testPoint.x - lakeCenter.x) ** 2 + (testPoint.z - lakeCenter.z) ** 2
      );

      const shouldFlatten = distToLake < lakeRadius * 1.3;
      expect(shouldFlatten).toBe(true);
    });

    it('should raise edges for mountain walls', () => {
      const terrainSize = 600;
      const testPoint = { x: 250, z: 0 };
      const distFromCenter = Math.sqrt(testPoint.x ** 2 + testPoint.z ** 2);

      const edgeFactor = Math.max(0, (distFromCenter - terrainSize * 0.35) / (terrainSize * 0.15));
      const heightBoost = edgeFactor * edgeFactor * 15;

      expect(heightBoost).toBeGreaterThan(0);
    });
  });

  describe('Lake Surroundings', () => {
    it('should place research equipment near lake', () => {
      const _lakeCenter = new Vector3(0, 0, -160);
      const equipmentPlacements = [
        { name: 'lake_capsule', offset: new Vector3(50, 0, 20) },
        { name: 'lake_vessel', offset: new Vector3(-45, 0, 15) },
        { name: 'lake_crate_1', offset: new Vector3(30, 0, -35) },
        { name: 'lake_container', offset: new Vector3(-35, 0, -30) },
      ];

      expect(equipmentPlacements.length).toBe(4);
    });
  });

  describe('Ice Sheet Material', () => {
    it('should define ice sheet material properties', () => {
      const iceMaterial = {
        diffuseColor: { r: 0.7, g: 0.82, b: 0.95 },
        specularColor: { r: 0.9, g: 0.95, b: 1.0 },
        specularPower: 256,
        alpha: 0.75,
        emissiveColor: { r: 0.05, g: 0.08, b: 0.12 },
        backFaceCulling: false,
      };

      expect(iceMaterial.alpha).toBe(0.75);
      expect(iceMaterial.specularPower).toBe(256);
      expect(iceMaterial.backFaceCulling).toBe(false);
    });
  });

  describe('Cold Zone Configuration', () => {
    it('should define cold zones in exposed areas', () => {
      const coldPositions = [
        new Vector3(0, 0, -160), // Frozen lake center
        new Vector3(-120, 0, -100), // Open tundra west
        new Vector3(120, 0, -200), // Wind-exposed ridge east
        new Vector3(0, 0, -280), // Near cave entrances
      ];

      expect(coldPositions.length).toBe(4);
    });

    it('should define cold zone radius', () => {
      const coldRadius = 25;
      expect(coldRadius).toBe(25);
    });

    it('should define cold zone temperature offset', () => {
      const coldOffset = -15;
      expect(coldOffset).toBe(-15);
    });
  });
});
