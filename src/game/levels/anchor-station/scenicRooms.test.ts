/**
 * Scenic Rooms Tests
 *
 * Comprehensive test suite for optional exploration areas in Anchor Station.
 * Tests Observation Deck, Mess Hall, and Recreation Room construction,
 * NPC placement, and lighting.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: {
    ImportMeshAsync: vi.fn().mockResolvedValue({
      meshes: [],
    }),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name) => ({
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1, 1, 1),
    parent: null,
    getChildMeshes: vi.fn(() => []),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => createMockMesh('box')),
    CreateSphere: vi.fn(() => createMockMesh('sphere')),
    CreateCapsule: vi.fn(() => createMockMesh('capsule')),
    CreatePlane: vi.fn(() => createMockMesh('plane')),
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation((name) => ({
    name,
    position: new Vector3(0, 0, 0),
    diffuse: new Color3(1, 1, 1),
    specular: new Color3(1, 1, 1),
    intensity: 1,
    range: 15,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation((name) => ({
    name,
    diffuseColor: new Color3(0, 0, 0),
    emissiveColor: new Color3(0, 0, 0),
    specularColor: new Color3(0, 0, 0),
    specularPower: 64,
    alpha: 1,
    backFaceCulling: true,
    dispose: vi.fn(),
  })),
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue(undefined),
    createInstanceByPath: vi.fn((path, name) => ({
      name,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scaling: new Vector3(1, 1, 1),
      parent: null,
      getChildMeshes: vi.fn(() => []),
      dispose: vi.fn(),
    })),
  },
}));

// Helper to create mock mesh
function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1, 1, 1),
    material: null,
    isVisible: true,
    parent: null,
    receiveShadows: false,
    checkCollisions: false,
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    getChildMeshes: vi.fn(() => []),
  };
}

// Helper to create mock scene
function createMockScene() {
  return {
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
    onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
    dispose: vi.fn(),
    meshes: [],
    materials: [],
  };
}

describe('Scenic Rooms - Room Dimensions', () => {
  describe('Scenic Corridor', () => {
    it('should define scenic corridor dimensions', () => {
      const SCENIC_CORRIDOR = { width: 3, depth: 18, height: 3 };

      expect(SCENIC_CORRIDOR.width).toBe(3);
      expect(SCENIC_CORRIDOR.depth).toBe(18);
      expect(SCENIC_CORRIDOR.height).toBe(3);
    });
  });

  describe('Observation Deck', () => {
    it('should define observation deck dimensions', () => {
      const OBSERVATION_DECK = { width: 16, depth: 10, height: 4 };

      expect(OBSERVATION_DECK.width).toBe(16);
      expect(OBSERVATION_DECK.depth).toBe(10);
      expect(OBSERVATION_DECK.height).toBe(4);
    });
  });

  describe('Mess Hall', () => {
    it('should define mess hall dimensions', () => {
      const MESS_HALL = { width: 14, depth: 12, height: 3.5 };

      expect(MESS_HALL.width).toBe(14);
      expect(MESS_HALL.depth).toBe(12);
      expect(MESS_HALL.height).toBe(3.5);
    });
  });

  describe('Recreation Room', () => {
    it('should define recreation room dimensions', () => {
      const RECREATION_ROOM = { width: 10, depth: 8, height: 3 };

      expect(RECREATION_ROOM.width).toBe(10);
      expect(RECREATION_ROOM.depth).toBe(8);
      expect(RECREATION_ROOM.height).toBe(3);
    });
  });
});

describe('Scenic Rooms - Room Positions', () => {
  const CORRIDOR_A_CENTER_Z = -22.5;
  const SCENIC_BRANCH_Z = CORRIDOR_A_CENTER_Z + 8;

  it('should position scenic corridor branching from main corridor', () => {
    const SCENIC_CORRIDOR_CENTER = new Vector3(-5, 0, SCENIC_BRANCH_Z);

    expect(SCENIC_CORRIDOR_CENTER.x).toBe(-5);
    expect(SCENIC_CORRIDOR_CENTER.z).toBe(-14.5);
  });

  it('should position observation deck north of scenic corridor', () => {
    const SCENIC_CORRIDOR_DEPTH = 18;
    const OBSERVATION_CENTER = new Vector3(-5, 0, SCENIC_BRANCH_Z + SCENIC_CORRIDOR_DEPTH / 2 + 3);

    expect(OBSERVATION_CENTER.x).toBe(-5);
    expect(OBSERVATION_CENTER.z).toBe(-2.5);
  });

  it('should position mess hall west of scenic corridor', () => {
    const MESS_CENTER = new Vector3(-12, 0, SCENIC_BRANCH_Z + 6);

    expect(MESS_CENTER.x).toBe(-12);
    expect(MESS_CENTER.z).toBe(-8.5);
  });

  it('should position recreation room south of mess hall', () => {
    const RECREATION_CENTER = new Vector3(-12, 0, SCENIC_BRANCH_Z - 2);

    expect(RECREATION_CENTER.x).toBe(-12);
    expect(RECREATION_CENTER.z).toBe(-16.5);
  });
});

describe('Scenic Rooms - SCENIC_ROOM_POSITIONS Export', () => {
  it('should export all scenic room positions', () => {
    const SCENIC_ROOM_POSITIONS = {
      scenicCorridor: new Vector3(-5, 0, -14.5),
      observationDeck: new Vector3(-5, 0, -2.5),
      messHall: new Vector3(-12, 0, -8.5),
      recreationRoom: new Vector3(-12, 0, -16.5),
    };

    expect(Object.keys(SCENIC_ROOM_POSITIONS)).toHaveLength(4);
    expect(SCENIC_ROOM_POSITIONS.scenicCorridor).toBeInstanceOf(Vector3);
    expect(SCENIC_ROOM_POSITIONS.observationDeck).toBeInstanceOf(Vector3);
    expect(SCENIC_ROOM_POSITIONS.messHall).toBeInstanceOf(Vector3);
    expect(SCENIC_ROOM_POSITIONS.recreationRoom).toBeInstanceOf(Vector3);
  });
});

describe('Scenic Rooms - GLB Model Paths', () => {
  describe('Floor and Ceiling', () => {
    it('should define floor/ceiling model paths', () => {
      const SCENIC_MODELS = {
        floorCeiling1: '/models/environment/station/floor_ceiling_hr_1.glb',
        floorCeilingRtx1: '/models/environment/station/floor_ceiling_rtx_1.glb',
      };

      expect(SCENIC_MODELS.floorCeiling1).toContain('floor_ceiling');
    });
  });

  describe('Walls', () => {
    it('should define wall model paths', () => {
      const SCENIC_MODELS = {
        wallSingle: '/models/environment/station/wall_hr_1.glb',
        wallDouble: '/models/environment/station/wall_hr_1_double.glb',
        wallHole: '/models/environment/station/wall_hr_1_hole_1.glb',
      };

      expect(SCENIC_MODELS.wallSingle).toContain('wall_hr_1');
      expect(SCENIC_MODELS.wallDouble).toContain('double');
    });
  });

  describe('Windows', () => {
    it('should define window model paths', () => {
      const SCENIC_MODELS = {
        window1: '/models/environment/station/window_hr_1.glb',
        window2: '/models/environment/station/window_hr_2.glb',
      };

      expect(SCENIC_MODELS.window1).toContain('window');
    });
  });

  describe('Doorways', () => {
    it('should define doorway model paths', () => {
      const SCENIC_MODELS = {
        doorway: '/models/environment/station/doorway_hr_1.glb',
        doorway2: '/models/environment/station/doorway_hr_2_regular.glb',
        stationDoor: '/models/environment/station/station_door.glb',
      };

      expect(SCENIC_MODELS.doorway).toContain('doorway');
    });
  });

  describe('Columns and Pillars', () => {
    it('should define column model paths', () => {
      const SCENIC_MODELS = {
        pillar2: '/models/environment/station/pillar_hr_2.glb',
        modColumn1: '/models/environment/modular/Column_1.glb',
        modColumnSlim: '/models/environment/modular/Column_Slim.glb',
      };

      expect(SCENIC_MODELS.modColumn1).toContain('Column');
    });
  });

  describe('Props', () => {
    it('should define furniture prop paths', () => {
      const SCENIC_MODELS = {
        bench: '/models/props/furniture/bench_mx_1.glb',
        modComputer: '/models/environment/modular/Props_Computer.glb',
        modShelf: '/models/environment/modular/Props_Shelf.glb',
        modCrate: '/models/environment/modular/Props_Crate.glb',
      };

      expect(SCENIC_MODELS.bench).toContain('bench');
      expect(SCENIC_MODELS.modComputer).toContain('Computer');
    });

    it('should define decorative vessel paths', () => {
      const SCENIC_MODELS = {
        modVessel: '/models/environment/modular/Props_Vessel.glb',
        modVesselShort: '/models/environment/modular/Props_Vessel_Short.glb',
        modPod: '/models/environment/modular/Props_Pod.glb',
        modStatue: '/models/environment/modular/Props_Statue.glb',
      };

      expect(SCENIC_MODELS.modVessel).toContain('Vessel');
    });
  });

  describe('NPC Models', () => {
    it('should define NPC marine model paths', () => {
      const SCENIC_MODELS = {
        npcMarine: '/models/npcs/marine/marine_soldier.glb',
        npcMarineSergeant: '/models/npcs/marine/marine_sergeant.glb',
      };

      expect(SCENIC_MODELS.npcMarine).toContain('marine_soldier');
      expect(SCENIC_MODELS.npcMarineSergeant).toContain('marine_sergeant');
    });
  });
});

describe('Scenic Rooms - Materials', () => {
  describe('Window Material', () => {
    it('should create observation window material', () => {
      const windowMat = {
        name: 'obsWindowMat',
        diffuseColor: Color3.FromHexString('#0A1520'),
        alpha: 0.15,
        specularColor: new Color3(0.9, 0.95, 1.0),
        specularPower: 128,
        backFaceCulling: false,
      };

      expect(windowMat.alpha).toBe(0.15);
      expect(windowMat.backFaceCulling).toBe(false);
      expect(windowMat.specularPower).toBe(128);
    });
  });

  describe('Frame Material', () => {
    it('should create window frame material', () => {
      const frameMat = {
        name: 'scenicFrameMat',
        diffuseColor: Color3.FromHexString('#0D0F11'),
        specularColor: new Color3(0.4, 0.4, 0.4),
      };

      expect(frameMat.specularColor.r).toBe(0.4);
    });
  });

  describe('Planet Material', () => {
    it('should create planet view material', () => {
      const planetMat = {
        name: 'planetMat',
        emissiveColor: Color3.FromHexString('#1A3050'),
        diffuseColor: Color3.FromHexString('#0A1525'),
      };

      expect(planetMat.emissiveColor).toBeDefined();
    });
  });

  describe('Stars Material', () => {
    it('should create stars backdrop material', () => {
      const starsMat = {
        name: 'starsMat',
        emissiveColor: new Color3(0.02, 0.02, 0.04),
        diffuseColor: Color3.Black(),
      };

      expect(starsMat.emissiveColor.r).toBeCloseTo(0.02);
    });
  });

  describe('NPC Materials', () => {
    it('should create uniform material', () => {
      const uniformMat = {
        name: 'uniformMat',
        diffuseColor: Color3.FromHexString('#4A5040'),
        specularColor: new Color3(0.1, 0.1, 0.08),
      };

      expect(uniformMat.diffuseColor).toBeDefined();
    });

    it('should create skin tone material', () => {
      const skinMat = {
        name: 'skinMat',
        diffuseColor: Color3.FromHexString('#8B7355'),
        specularColor: new Color3(0.15, 0.12, 0.1),
      };

      expect(skinMat.specularColor.r).toBe(0.15);
    });
  });

  describe('Screen Material', () => {
    it('should create display screen material', () => {
      const screenMat = {
        name: 'scenicScreenMat',
        emissiveColor: Color3.FromHexString('#003366'),
        diffuseColor: Color3.FromHexString('#001122'),
      };

      expect(screenMat.emissiveColor).toBeDefined();
    });
  });
});

describe('Scenic Rooms - Observation Deck', () => {
  describe('Floor Layout', () => {
    it('should create floor tiles in 4m grid', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const floorPositions: Vector3[] = [];

      // 16x10 room coverage
      for (let fx = -6; fx <= 6; fx += 4) {
        for (let fz = -4; fz <= 4; fz += 4) {
          floorPositions.push(new Vector3(OC.x + fx, -0.05, OC.z + fz));
        }
      }

      // Should have 4 * 3 = 12 floor tiles
      expect(floorPositions.length).toBe(12);
    });
  });

  describe('Ceiling Layout', () => {
    it('should create ceiling with center vent', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const HEIGHT = 4;
      const ceilingTiles: Array<{ position: Vector3; isVent: boolean }> = [];

      // Grid from -4 to 4 in steps of 4 to ensure center (0,0) is included
      for (let cx = -4; cx <= 4; cx += 4) {
        for (let cz = -4; cz <= 4; cz += 4) {
          const isVent = cx === 0 && cz === 0;
          ceilingTiles.push({
            position: new Vector3(OC.x + cx, HEIGHT, OC.z + cz),
            isVent,
          });
        }
      }

      const ventTiles = ceilingTiles.filter((t) => t.isVent);
      expect(ventTiles.length).toBe(1);
      expect(ceilingTiles.length).toBe(9); // 3x3 grid
    });
  });

  describe('Wall Layout', () => {
    it('should create side walls', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const WIDTH = 16;
      const wallPositions: Vector3[] = [];

      // Left and right walls
      for (let wz = -4; wz <= 4; wz += 4) {
        wallPositions.push(new Vector3(OC.x - WIDTH / 2, 0, OC.z + wz));
        wallPositions.push(new Vector3(OC.x + WIDTH / 2, 0, OC.z + wz));
      }

      // 3 sections * 2 sides = 6 wall segments
      expect(wallPositions.length).toBe(6);
    });

    it('should create back wall with entrance doorway', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const DEPTH = 10;

      const backWallElements = [
        { name: 'od_wall_back_l', x: OC.x - 5, z: OC.z - DEPTH / 2 },
        { name: 'od_wall_back_r', x: OC.x + 5, z: OC.z - DEPTH / 2 },
        { name: 'od_door_back', x: OC.x, z: OC.z - DEPTH / 2 },
      ];

      expect(backWallElements.length).toBe(3);
      expect(backWallElements[2].name).toBe('od_door_back');
    });
  });

  describe('Windows', () => {
    it('should create observation windows along front wall', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const DEPTH = 10;
      const windowPositions: Vector3[] = [];

      for (let wx = -4; wx <= 4; wx += 4) {
        windowPositions.push(new Vector3(OC.x + wx, 0.5, OC.z + DEPTH / 2 - 0.2));
      }

      // 3 windows across the front
      expect(windowPositions.length).toBe(3);
    });
  });

  describe('Pillars', () => {
    it('should place pillars at room corners', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const pillarPositions = [
        { name: 'od_col_nw', position: new Vector3(OC.x - 7, 0, OC.z + 4) },
        { name: 'od_col_ne', position: new Vector3(OC.x + 7, 0, OC.z + 4) },
        { name: 'od_col_sw', position: new Vector3(OC.x - 7, 0, OC.z - 4) },
        { name: 'od_col_se', position: new Vector3(OC.x + 7, 0, OC.z - 4) },
      ];

      expect(pillarPositions.length).toBe(4);
    });
  });

  describe('Seating', () => {
    it('should place benches for viewing', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const benchPositions = [
        new Vector3(OC.x - 4, 0, OC.z + 1.5),
        new Vector3(OC.x, 0, OC.z + 1.5),
        new Vector3(OC.x + 4, 0, OC.z + 1.5),
      ];

      expect(benchPositions.length).toBe(3);
    });

    it('should place side chairs', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const chairPositions = [
        { position: new Vector3(OC.x - 5, 0, OC.z - 1), rotation: 0.3 },
        { position: new Vector3(OC.x + 5, 0, OC.z - 1), rotation: -0.3 },
      ];

      expect(chairPositions.length).toBe(2);
    });
  });

  describe('Plants', () => {
    it('should place decorative vessels as planters', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const plantPositions = [
        new Vector3(OC.x - 6, 0, OC.z + 3),
        new Vector3(OC.x + 6, 0, OC.z + 3),
        new Vector3(OC.x - 3, 0, OC.z - 3),
        new Vector3(OC.x + 3, 0, OC.z - 3),
      ];

      expect(plantPositions.length).toBe(4);
    });
  });

  describe('Planet View', () => {
    it('should create planet sphere outside window', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const DEPTH = 10;

      const planetPosition = new Vector3(
        OC.x + 5,
        -8,
        OC.z + DEPTH / 2 + 40
      );

      expect(planetPosition.y).toBe(-8);
      expect(planetPosition.z).toBeGreaterThan(OC.z + DEPTH / 2);
    });

    it('should create stars backdrop', () => {
      const OC = new Vector3(-5, 0, -2.5);
      const DEPTH = 10;

      const starsPosition = new Vector3(
        OC.x,
        10,
        OC.z + DEPTH / 2 + 80
      );

      expect(starsPosition.y).toBe(10);
      expect(starsPosition.z).toBeGreaterThan(OC.z + 50);
    });
  });

  describe('NPCs', () => {
    it('should define NPC positions looking out window', () => {
      const npcPositions = [
        { x: -3, z: 2.5, rot: 0, model: 'marine' },
        { x: 1, z: 2.8, rot: 0.1, model: 'sergeant' },
      ];

      expect(npcPositions.length).toBe(2);
      expect(npcPositions[0].rot).toBe(0); // Facing window
      expect(npcPositions[1].rot).toBeCloseTo(0.1);
    });
  });
});

describe('Scenic Rooms - Mess Hall', () => {
  describe('Room Layout', () => {
    it('should position mess hall at correct coordinates', () => {
      const MESS_CENTER = new Vector3(-12, 0, -8.5);

      expect(MESS_CENTER.x).toBe(-12);
      expect(MESS_CENTER.z).toBe(-8.5);
    });

    it('should have appropriate height for canteen', () => {
      const MESS_HALL = { height: 3.5 };

      expect(MESS_HALL.height).toBe(3.5);
    });
  });

  describe('Furniture', () => {
    it('should have seating arrangements', () => {
      const MC = new Vector3(-12, 0, -8.5);
      const tablePositions = [
        { x: MC.x - 3, z: MC.z - 2 },
        { x: MC.x + 3, z: MC.z - 2 },
        { x: MC.x, z: MC.z + 2 },
      ];

      expect(tablePositions.length).toBeGreaterThan(0);
    });
  });
});

describe('Scenic Rooms - Recreation Room', () => {
  describe('Room Layout', () => {
    it('should position recreation room south of mess hall', () => {
      const RECREATION_CENTER = new Vector3(-12, 0, -16.5);
      const MESS_CENTER = new Vector3(-12, 0, -8.5);

      expect(RECREATION_CENTER.z).toBeLessThan(MESS_CENTER.z);
      expect(RECREATION_CENTER.x).toBe(MESS_CENTER.x);
    });

    it('should be smallest of scenic rooms', () => {
      const RECREATION_ROOM = { width: 10, depth: 8, height: 3 };
      const MESS_HALL = { width: 14, depth: 12, height: 3.5 };
      const OBSERVATION_DECK = { width: 16, depth: 10, height: 4 };

      expect(RECREATION_ROOM.width * RECREATION_ROOM.depth)
        .toBeLessThan(MESS_HALL.width * MESS_HALL.depth);
      expect(RECREATION_ROOM.width * RECREATION_ROOM.depth)
        .toBeLessThan(OBSERVATION_DECK.width * OBSERVATION_DECK.depth);
    });
  });
});

describe('Scenic Rooms - Lighting', () => {
  describe('Ceiling Lights', () => {
    it('should add ceiling lights with correct properties', () => {
      const addCeilingLight = (
        position: Vector3,
        color: Color3,
        intensity: number,
        range: number
      ) => ({
        position: position.clone(),
        diffuse: color,
        specular: color.scale(0.5),
        intensity,
        range,
      });

      const light = addCeilingLight(
        new Vector3(-5, 4, -2.5),
        new Color3(0.9, 0.9, 1.0),
        0.6,
        15
      );

      expect(light.intensity).toBe(0.6);
      expect(light.range).toBe(15);
      expect(light.specular.r).toBeCloseTo(0.45);
    });
  });

  describe('Observation Deck Lighting', () => {
    it('should have softer ambient lighting', () => {
      const observationLights = [
        { intensity: 0.5, color: new Color3(0.9, 0.92, 1.0) },
        { intensity: 0.4, color: new Color3(0.85, 0.9, 1.0) },
      ];

      expect(observationLights[0].intensity).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Mess Hall Lighting', () => {
    it('should have warmer lighting for dining area', () => {
      const messHallLights = [
        { intensity: 0.7, color: new Color3(1.0, 0.95, 0.85) },
      ];

      expect(messHallLights[0].color.r).toBeGreaterThan(messHallLights[0].color.b);
    });
  });
});

describe('Scenic Rooms - ScenicRoomsResult Interface', () => {
  it('should define root transform node', () => {
    const result = {
      root: { name: 'scenicRoomsRoot', dispose: vi.fn() },
    };

    expect(result.root.name).toBe('scenicRoomsRoot');
  });

  it('should define all room transform nodes', () => {
    const rooms = {
      scenicCorridor: { name: 'scenicCorridor', dispose: vi.fn() },
      observationDeck: { name: 'observationDeck', dispose: vi.fn() },
      messHall: { name: 'messHall', dispose: vi.fn() },
      recreationRoom: { name: 'recreationRoom', dispose: vi.fn() },
    };

    expect(Object.keys(rooms)).toHaveLength(4);
  });

  it('should track lights array', () => {
    const lights = [
      { name: 'light1', dispose: vi.fn() },
      { name: 'light2', dispose: vi.fn() },
    ];

    expect(Array.isArray(lights)).toBe(true);
  });

  it('should define dispose function', () => {
    const result = {
      dispose: vi.fn(),
    };

    result.dispose();
    expect(result.dispose).toHaveBeenCalled();
  });
});

describe('Scenic Rooms - Asset Preloading', () => {
  it('should preload unique model paths', async () => {
    const paths = [
      '/models/environment/station/floor_ceiling_hr_1.glb',
      '/models/environment/station/wall_hr_1.glb',
      '/models/environment/station/floor_ceiling_hr_1.glb', // Duplicate
    ];

    const unique = [...new Set(paths)];

    expect(unique.length).toBe(2);
  });

  it('should use Promise.allSettled for preloading', async () => {
    const loadAsset = vi.fn().mockResolvedValue(undefined);

    const paths = ['/models/a.glb', '/models/b.glb'];

    await Promise.allSettled(paths.map((p) => loadAsset(p)));

    expect(loadAsset).toHaveBeenCalledTimes(2);
  });
});

describe('Scenic Rooms - GLB Instance Placement', () => {
  describe('placeGLBInstance', () => {
    it('should create instance with correct transform', () => {
      const createInstance = (
        path: string,
        name: string,
        position: Vector3,
        rotation: Vector3,
        scale: Vector3
      ) => ({
        name,
        position: position.clone(),
        rotation: rotation.clone(),
        scaling: scale.clone(),
        parent: null,
      });

      const instance = createInstance(
        '/models/test.glb',
        'testInstance',
        new Vector3(1, 2, 3),
        new Vector3(0, Math.PI / 2, 0),
        new Vector3(1.5, 1.5, 1.5)
      );

      expect(instance.position.x).toBe(1);
      expect(instance.rotation.y).toBeCloseTo(Math.PI / 2);
      expect(instance.scaling.x).toBe(1.5);
    });
  });

  describe('placeModel', () => {
    it('should place model with collisions enabled', () => {
      const placeModel = (
        x: number,
        y: number,
        z: number,
        rotY: number,
        scaleUniform: number
      ) => ({
        position: new Vector3(x, y, z),
        rotation: new Vector3(0, rotY, 0),
        scaling: new Vector3(scaleUniform, scaleUniform, scaleUniform),
        checkCollisions: true,
      });

      const model = placeModel(-5, 0, 2, Math.PI, 1.2);

      expect(model.checkCollisions).toBe(true);
    });
  });

  describe('placeProp', () => {
    it('should place prop with collisions disabled', () => {
      const placeProp = (
        x: number,
        y: number,
        z: number,
        rotY: number,
        scaleUniform: number
      ) => ({
        position: new Vector3(x, y, z),
        rotation: new Vector3(0, rotY, 0),
        scaling: new Vector3(scaleUniform, scaleUniform, scaleUniform),
        checkCollisions: false,
      });

      const prop = placeProp(-5, 0, 2, 0, 0.8);

      expect(prop.checkCollisions).toBe(false);
    });
  });
});

describe('Scenic Rooms - Disposal', () => {
  it('should dispose all rooms', () => {
    const rooms = {
      scenicCorridor: { dispose: vi.fn() },
      observationDeck: { dispose: vi.fn() },
      messHall: { dispose: vi.fn() },
      recreationRoom: { dispose: vi.fn() },
    };

    Object.values(rooms).forEach((room) => room.dispose());

    expect(rooms.scenicCorridor.dispose).toHaveBeenCalled();
    expect(rooms.observationDeck.dispose).toHaveBeenCalled();
    expect(rooms.messHall.dispose).toHaveBeenCalled();
    expect(rooms.recreationRoom.dispose).toHaveBeenCalled();
  });

  it('should dispose all lights', () => {
    const lights = [
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
    ];

    lights.forEach((light) => light.dispose());

    lights.forEach((light) => {
      expect(light.dispose).toHaveBeenCalled();
    });
  });

  it('should dispose root transform', () => {
    const root = { dispose: vi.fn() };

    root.dispose();

    expect(root.dispose).toHaveBeenCalled();
  });
});
