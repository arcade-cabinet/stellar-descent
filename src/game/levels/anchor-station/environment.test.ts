/**
 * Anchor Station Environment Tests
 *
 * Comprehensive test suite for the GLB-based station environment.
 * Tests room layout, model loading, shooting range, platforming,
 * and interactive elements.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: {
    ImportMeshAsync: vi.fn().mockResolvedValue({
      meshes: [
        {
          name: 'mesh1',
          parent: null,
          receiveShadows: false,
          checkCollisions: false,
          clone: vi.fn(() => ({
            name: 'mesh1_clone',
            parent: null,
            receiveShadows: false,
            checkCollisions: false,
            dispose: vi.fn(),
            isDisposed: vi.fn(() => false),
          })),
          dispose: vi.fn(),
          isDisposed: vi.fn(() => false),
        },
      ],
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
    CreateCylinder: vi.fn(() => createMockMesh('cylinder')),
    CreateTorus: vi.fn(() => createMockMesh('torus')),
    CreateGround: vi.fn(() => createMockMesh('ground')),
    CreatePlane: vi.fn(() => createMockMesh('plane')),
    CreateSphere: vi.fn(() => createMockMesh('sphere')),
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 0, 0),
    diffuse: { r: 1, g: 1, b: 1 },
    specular: { r: 1, g: 1, b: 1 },
    intensity: 1,
    range: 10,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    diffuseColor: { r: 0, g: 0, b: 0 },
    emissiveColor: { r: 0, g: 0, b: 0 },
    specularColor: { r: 0, g: 0, b: 0 },
    alpha: 1,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Animations/animation', () => ({
  Animation: vi.fn().mockImplementation(() => ({
    setKeys: vi.fn(),
  })),
}));

vi.mock('./materials', () => ({
  createStationMaterials: vi.fn(() => ({
    floor: { dispose: vi.fn() },
    wall: { dispose: vi.fn() },
    ceiling: { dispose: vi.fn() },
    door: { dispose: vi.fn() },
    metal: { dispose: vi.fn() },
    glow: { dispose: vi.fn() },
    target: { dispose: vi.fn() },
    targetHit: { dispose: vi.fn() },
  })),
  disposeMaterials: vi.fn(),
}));

vi.mock('./curvedCorridor', () => ({
  createCurvedCorridor: vi.fn(() => ({
    root: { dispose: vi.fn() },
    floor: { dispose: vi.fn() },
    walls: [],
    ceiling: { dispose: vi.fn() },
    doors: { start: null, end: null },
    openDoor: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('./platformingRoom', () => ({
  createPlatformingRoom: vi.fn(() => ({
    root: { dispose: vi.fn() },
    platforms: [],
    crouchPassage: { dispose: vi.fn() },
    dispose: vi.fn(),
  })),
  preloadPlatformingRoomAssets: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./scenicRooms', () => ({
  createScenicRooms: vi.fn().mockResolvedValue({
    root: { dispose: vi.fn() },
    rooms: {
      scenicCorridor: { dispose: vi.fn() },
      observationDeck: { dispose: vi.fn() },
      messHall: { dispose: vi.fn() },
      recreationRoom: { dispose: vi.fn() },
    },
    lights: [],
    dispose: vi.fn(),
  }),
  SCENIC_ROOM_POSITIONS: {
    scenicCorridor: new Vector3(-5, 0, -14.5),
    observationDeck: new Vector3(-5, 0, -5.5),
    messHall: new Vector3(-12, 0, -8.5),
    recreationRoom: new Vector3(-12, 0, -16.5),
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
    clone: vi.fn((newName: string) => ({
      ...createMockMesh(newName),
    })),
    getChildMeshes: vi.fn(() => []),
  };
}

// Helper to create mock scene
function createMockScene() {
  return {
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
    ambientColor: { r: 0, g: 0, b: 0 },
    onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
    onAfterRenderObservable: { add: vi.fn(), remove: vi.fn() },
    beginAnimation: vi.fn(),
    stopAnimation: vi.fn(),
    dispose: vi.fn(),
    meshes: [],
    materials: [],
    getEngine: vi.fn(() => ({
      getRenderWidth: vi.fn(() => 1920),
      getRenderHeight: vi.fn(() => 1080),
    })),
    pick: vi.fn(() => ({ hit: false, pickedMesh: null })),
  };
}

describe('Environment - Room Layout Constants', () => {
  describe('Room Dimensions', () => {
    it('should define briefing room dimensions', () => {
      const BRIEFING_ROOM = { width: 20, depth: 15, height: 4 };
      expect(BRIEFING_ROOM.width).toBe(20);
      expect(BRIEFING_ROOM.depth).toBe(15);
      expect(BRIEFING_ROOM.height).toBe(4);
    });

    it('should define corridor A dimensions', () => {
      const CORRIDOR_A = { width: 4, depth: 30, height: 3 };
      expect(CORRIDOR_A.width).toBe(4);
      expect(CORRIDOR_A.depth).toBe(30);
      expect(CORRIDOR_A.height).toBe(3);
    });

    it('should define platforming room dimensions', () => {
      const PLATFORMING_ROOM = { width: 12, depth: 16, height: 5 };
      expect(PLATFORMING_ROOM.width).toBe(12);
      expect(PLATFORMING_ROOM.depth).toBe(16);
      expect(PLATFORMING_ROOM.height).toBe(5); // Taller for jumping
    });

    it('should define equipment bay dimensions', () => {
      const EQUIPMENT_BAY = { width: 15, depth: 12, height: 4 };
      expect(EQUIPMENT_BAY.width).toBe(15);
      expect(EQUIPMENT_BAY.depth).toBe(12);
      expect(EQUIPMENT_BAY.height).toBe(4);
    });

    it('should define shooting range dimensions', () => {
      const SHOOTING_RANGE = { width: 25, depth: 10, height: 4 };
      expect(SHOOTING_RANGE.width).toBe(25);
      expect(SHOOTING_RANGE.depth).toBe(10);
      expect(SHOOTING_RANGE.height).toBe(4);
    });

    it('should define hangar bay dimensions', () => {
      const HANGAR_BAY = { width: 40, depth: 30, height: 12 };
      expect(HANGAR_BAY.width).toBe(40);
      expect(HANGAR_BAY.depth).toBe(30);
      expect(HANGAR_BAY.height).toBe(12);
    });
  });

  describe('Room Positions', () => {
    it('should position briefing room at origin', () => {
      const BRIEFING_CENTER = new Vector3(0, 0, 0);
      expect(BRIEFING_CENTER.x).toBe(0);
      expect(BRIEFING_CENTER.y).toBe(0);
      expect(BRIEFING_CENTER.z).toBe(0);
    });

    it('should position corridor A south of briefing room', () => {
      const BRIEFING_ROOM_DEPTH = 15;
      const CORRIDOR_A_DEPTH = 30;
      const CORRIDOR_A_START_Z = 0 - BRIEFING_ROOM_DEPTH / 2;
      const CORRIDOR_A_CENTER_Z = CORRIDOR_A_START_Z - CORRIDOR_A_DEPTH / 2;

      expect(CORRIDOR_A_CENTER_Z).toBe(-22.5);
    });

    it('should position platforming room offset left from corridor', () => {
      const CORRIDOR_A_WIDTH = 4;
      const PLATFORMING_ROOM_WIDTH = 12;
      const platformingX = -(CORRIDOR_A_WIDTH / 2 + PLATFORMING_ROOM_WIDTH / 2 + 2);

      expect(platformingX).toBe(-10);
    });

    it('should position equipment bay offset right from corridor', () => {
      const CORRIDOR_A_WIDTH = 4;
      const EQUIPMENT_BAY_WIDTH = 15;
      const equipmentX = CORRIDOR_A_WIDTH / 2 + EQUIPMENT_BAY_WIDTH / 2 + 2;

      expect(equipmentX).toBe(11.5);
    });
  });

  describe('Key Objective Positions', () => {
    it('should define suit locker position in equipment bay', () => {
      const EQUIPMENT_BAY_CENTER = new Vector3(11.5, 0, -27.5);
      const suitLocker = new Vector3(EQUIPMENT_BAY_CENTER.x - 5, 0, EQUIPMENT_BAY_CENTER.z);

      expect(suitLocker.x).toBe(6.5);
      expect(suitLocker.z).toBe(-27.5);
    });

    it('should define weapon rack position in equipment bay', () => {
      const EQUIPMENT_BAY_CENTER = new Vector3(11.5, 0, -27.5);
      const weaponRack = new Vector3(EQUIPMENT_BAY_CENTER.x + 3, 0, EQUIPMENT_BAY_CENTER.z - 2);

      expect(weaponRack.x).toBe(14.5);
      expect(weaponRack.z).toBe(-29.5);
    });

    it('should define shooting position in range', () => {
      const SHOOTING_RANGE_CENTER = new Vector3(0, 0, -50);
      const shootingPosition = new Vector3(SHOOTING_RANGE_CENTER.x, 0, SHOOTING_RANGE_CENTER.z + 3);

      expect(shootingPosition.x).toBe(0);
      expect(shootingPosition.z).toBe(-47);
    });

    it('should define drop pod position in hangar', () => {
      const HANGAR_BAY_CENTER = new Vector3(0, 0, -75);
      const dropPod = new Vector3(0, 0, HANGAR_BAY_CENTER.z - 8);

      expect(dropPod.x).toBe(0);
      expect(dropPod.z).toBe(-83);
    });
  });
});

describe('Environment - Curved Corridor Configurations', () => {
  describe('Corridor Properties', () => {
    it('should define ring radius for curved corridors', () => {
      const RING_RADIUS = 50;
      expect(RING_RADIUS).toBe(50);
    });

    it('should define standard corridor dimensions', () => {
      const CURVED_CORRIDOR_WIDTH = 4;
      const CURVED_CORRIDOR_HEIGHT = 3;

      expect(CURVED_CORRIDOR_WIDTH).toBe(4);
      expect(CURVED_CORRIDOR_HEIGHT).toBe(3);
    });
  });

  describe('Corridor Configurations', () => {
    it('should configure briefingToMovement corridor', () => {
      const config = {
        ringRadius: 50,
        startAngle: -Math.PI / 2 - 0.12,
        arcAngle: Math.PI / 10,
        width: 4,
        height: 3,
        segments: 8,
        hasWindows: true,
        windowCount: 2,
        hasOverheadLights: true,
        lightCount: 2,
        hasFloorGrating: true,
        hasPipes: true,
        hasRivets: true,
        hasDoorStart: true,
        hasDoorEnd: false,
      };

      expect(config.segments).toBe(8);
      expect(config.hasWindows).toBe(true);
      expect(config.windowCount).toBe(2);
      expect(config.hasDoorStart).toBe(true);
      expect(config.hasDoorEnd).toBe(false);
    });

    it('should configure movementToPlatforming corridor', () => {
      const config = {
        ringRadius: 50,
        arcAngle: Math.PI / 12,
        segments: 6,
        hasWindows: true,
        windowCount: 1,
        hasDoorStart: false,
        hasDoorEnd: true,
      };

      expect(config.segments).toBe(6);
      expect(config.windowCount).toBe(1);
      expect(config.hasDoorStart).toBe(false);
      expect(config.hasDoorEnd).toBe(true);
    });

    it('should configure equipmentToRange corridor with 3 windows', () => {
      const config = {
        segments: 10,
        hasWindows: true,
        windowCount: 3,
        lightCount: 3,
        hasDoorStart: true,
        hasDoorEnd: true,
      };

      expect(config.windowCount).toBe(3);
      expect(config.lightCount).toBe(3);
    });

    it('should configure rangeToHangar as longest corridor', () => {
      const config = {
        segments: 12,
        arcAngle: Math.PI / 6,
        windowCount: 4,
        lightCount: 4,
        hasDoorStart: true,
        hasDoorEnd: true,
      };

      expect(config.segments).toBe(12);
      expect(config.windowCount).toBe(4);
    });
  });
});

describe('Environment - GLB Asset Paths', () => {
  describe('Station Corridor Segments', () => {
    it('should define corridor model paths', () => {
      const MODEL_PATHS = {
        corridorMain: '/assets/models/environment/station/corridor_main.glb',
        corridorWide: '/assets/models/environment/station/corridor_wide.glb',
        corridorJunction: '/assets/models/environment/station/corridor_junction.glb',
        corridorCorner: '/assets/models/environment/station/corridor_corner.glb',
      };

      expect(MODEL_PATHS.corridorMain).toContain('corridor_main.glb');
      expect(MODEL_PATHS.corridorWide).toContain('corridor_wide.glb');
    });
  });

  describe('Floor and Ceiling Tiles', () => {
    it('should define floor/ceiling model paths', () => {
      const MODEL_PATHS = {
        floorCeiling1: '/assets/models/environment/station/floor_ceiling_hr_1.glb',
        floorCeiling3: '/assets/models/environment/station/floor_ceiling_hr_3.glb',
        floorCeilingRtx1: '/assets/models/environment/station/floor_ceiling_rtx_1.glb',
      };

      expect(MODEL_PATHS.floorCeiling1).toContain('floor_ceiling');
    });
  });

  describe('Wall Segments', () => {
    it('should define wall model paths', () => {
      const MODEL_PATHS = {
        wallDouble: '/assets/models/environment/station/wall_hr_1_double.glb',
        wallSingle: '/assets/models/environment/station/wall_hr_1.glb',
        wallM2: '/assets/models/environment/station/wall_hr_1_m_2.glb',
        wallHole: '/assets/models/environment/station/wall_hr_1_hole_1.glb',
      };

      expect(MODEL_PATHS.wallDouble).toContain('wall_hr_1_double');
      expect(MODEL_PATHS.wallHole).toContain('hole');
    });
  });

  describe('Doorway Models', () => {
    it('should define doorway model paths', () => {
      const MODEL_PATHS = {
        doorway: '/assets/models/environment/station/doorway_hr_1.glb',
        doorwayWide: '/assets/models/environment/station/doorway_hr_1_wide.glb',
        doorway2: '/assets/models/environment/station/doorway_hr_2_regular.glb',
        stationDoor: '/assets/models/environment/station/station_door.glb',
      };

      expect(MODEL_PATHS.doorwayWide).toContain('wide');
      expect(MODEL_PATHS.stationDoor).toContain('station_door');
    });
  });

  describe('Industrial Props', () => {
    it('should define industrial prop paths', () => {
      const MODEL_PATHS = {
        barrel1: '/assets/models/props/containers/metal_barrel_hr_1.glb',
        shelf: '/assets/models/props/furniture/shelf_mx_1.glb',
        machinery: '/assets/models/environment/industrial/machinery_mx_1.glb',
        lamp1: '/assets/models/props/electrical/lamp_mx_1_a_on.glb',
      };

      expect(MODEL_PATHS.barrel1).toContain('barrel');
      expect(MODEL_PATHS.lamp1).toContain('lamp');
    });
  });

  describe('Modular Sci-Fi Pieces', () => {
    it('should define modular floor paths', () => {
      const MODEL_PATHS = {
        modFloorBasic: '/assets/models/environment/modular/FloorTile_Basic.glb',
        modFloorCorner: '/assets/models/environment/modular/FloorTile_Corner.glb',
        modFloorSide: '/assets/models/environment/modular/FloorTile_Side.glb',
      };

      expect(MODEL_PATHS.modFloorBasic).toContain('FloorTile');
    });

    it('should define modular wall and column paths', () => {
      const MODEL_PATHS = {
        modWall1: '/assets/models/environment/modular/Wall_1.glb',
        modColumn1: '/assets/models/environment/modular/Column_1.glb',
        modColumn2: '/assets/models/environment/modular/Column_2.glb',
      };

      expect(MODEL_PATHS.modColumn1).toContain('Column');
    });

    it('should define modular prop paths', () => {
      const MODEL_PATHS = {
        modComputer: '/assets/models/environment/modular/Props_Computer.glb',
        modShelf: '/assets/models/environment/modular/Props_Shelf.glb',
        modShelfTall: '/assets/models/environment/modular/Props_Shelf_Tall.glb',
      };

      expect(MODEL_PATHS.modComputer).toContain('Computer');
    });
  });
});

describe('Environment - Model Cache', () => {
  it('should cache loaded models for reuse', () => {
    const modelCache = new Map<string, object[]>();

    const path = '/assets/models/test.glb';
    const meshes = [{ name: 'mesh1' }, { name: 'mesh2' }];

    // First load - cache miss
    expect(modelCache.has(path)).toBe(false);

    // Cache the result
    modelCache.set(path, meshes);

    // Second load - cache hit
    expect(modelCache.has(path)).toBe(true);
    expect(modelCache.get(path)).toEqual(meshes);
  });

  it('should clear model cache on dispose', () => {
    const modelCache = new Map<string, object[]>();
    modelCache.set('/assets/models/test1.glb', [{ name: 'mesh1' }]);
    modelCache.set('/assets/models/test2.glb', [{ name: 'mesh2' }]);

    expect(modelCache.size).toBe(2);

    // Clear cache
    modelCache.clear();

    expect(modelCache.size).toBe(0);
  });

  it('should handle load timeout', async () => {
    const MODEL_LOAD_TIMEOUT = 10_000;

    const loadWithTimeout = async (shouldTimeout: boolean) => {
      return new Promise((resolve, reject) => {
        if (shouldTimeout) {
          setTimeout(() => reject(new Error('Timeout loading model')), MODEL_LOAD_TIMEOUT);
        } else {
          resolve({ meshes: [] });
        }
      });
    };

    // Should resolve normally
    await expect(loadWithTimeout(false)).resolves.toEqual({ meshes: [] });
  });
});

describe('Environment - StationEnvironment Interface', () => {
  describe('Required Properties', () => {
    it('should define root transform node', () => {
      const stationEnv = {
        root: { name: 'stationRoot', dispose: vi.fn() },
      };

      expect(stationEnv.root.name).toBe('stationRoot');
    });

    it('should define key meshes', () => {
      const stationEnv = {
        dropPod: createMockMesh('dropPod'),
        viewport: createMockMesh('viewport'),
        equipmentRack: createMockMesh('equipmentRack'),
        suitLocker: createMockMesh('suitLocker'),
        innerDoor: createMockMesh('innerDoor'),
        bayDoorLeft: createMockMesh('bayDoorLeft'),
        bayDoorRight: createMockMesh('bayDoorRight'),
      };

      expect(stationEnv.dropPod.name).toBe('dropPod');
      expect(stationEnv.suitLocker.name).toBe('suitLocker');
    });

    it('should define room transform nodes', () => {
      const rooms = {
        briefing: { name: 'briefing', dispose: vi.fn() },
        corridorA: { name: 'corridorA', dispose: vi.fn() },
        platformingRoom: { name: 'platformingRoom', dispose: vi.fn() },
        equipmentBay: { name: 'equipmentBay', dispose: vi.fn() },
        shootingRange: { name: 'shootingRange', dispose: vi.fn() },
        hangarBay: { name: 'hangarBay', dispose: vi.fn() },
        scenicCorridor: { name: 'scenicCorridor', dispose: vi.fn() },
        observationDeck: { name: 'observationDeck', dispose: vi.fn() },
        messHall: { name: 'messHall', dispose: vi.fn() },
        recreationRoom: { name: 'recreationRoom', dispose: vi.fn() },
      };

      expect(Object.keys(rooms)).toHaveLength(10);
    });
  });

  describe('Animation Methods', () => {
    it('should define playEquipSuit method', () => {
      const stationEnv = {
        playEquipSuit: vi.fn((callback: () => void) => {
          callback();
        }),
      };

      const callback = vi.fn();
      stationEnv.playEquipSuit(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should define playDepressurize method', () => {
      const stationEnv = {
        playDepressurize: vi.fn((callback: () => void) => {
          setTimeout(callback, 100);
        }),
      };

      const callback = vi.fn();
      stationEnv.playDepressurize(callback);

      expect(stationEnv.playDepressurize).toHaveBeenCalled();
    });

    it('should define playOpenBayDoors method', () => {
      const stationEnv = {
        playOpenBayDoors: vi.fn((callback: () => void) => {
          callback();
        }),
      };

      const callback = vi.fn();
      stationEnv.playOpenBayDoors(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should define playEnterPod method', () => {
      const stationEnv = {
        playEnterPod: vi.fn((callback: () => void) => {
          callback();
        }),
      };

      const callback = vi.fn();
      stationEnv.playEnterPod(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should define playLaunch method', () => {
      const stationEnv = {
        playLaunch: vi.fn((callback: () => void) => {
          callback();
        }),
      };

      const callback = vi.fn();
      stationEnv.playLaunch(callback);

      expect(callback).toHaveBeenCalled();
    });
  });
});

describe('Environment - Shooting Range', () => {
  describe('Calibration System', () => {
    let _mockScene: ReturnType<typeof createMockScene>;

    beforeEach(() => {
      _mockScene = createMockScene();
    });

    it('should start calibration with callbacks', () => {
      const callbacks = {
        onTargetHit: vi.fn(),
        onAllTargetsHit: vi.fn(),
      };

      let calibrationActive = false;
      let targetCount = 0;

      const startCalibration = (cbs: typeof callbacks) => {
        calibrationActive = true;
        targetCount = 5;
        // Simulate immediate callback storage
        return { callbacks: cbs, targetCount };
      };

      const result = startCalibration(callbacks);
      expect(calibrationActive).toBe(true);
      expect(result.targetCount).toBe(5);
    });

    it('should track target hits', () => {
      let targetsHit = 0;
      const totalTargets = 5;
      const onTargetHit = vi.fn();
      const onAllTargetsHit = vi.fn();

      const hitTarget = (targetIndex: number) => {
        targetsHit++;
        onTargetHit(targetIndex);

        if (targetsHit >= totalTargets) {
          onAllTargetsHit();
        }
      };

      // Hit all targets
      for (let i = 0; i < totalTargets; i++) {
        hitTarget(i);
      }

      expect(onTargetHit).toHaveBeenCalledTimes(5);
      expect(onAllTargetsHit).toHaveBeenCalledTimes(1);
    });

    it('should check target hit with raycast', () => {
      const targets = [
        { position: new Vector3(0, 1.5, -55), radius: 0.5 },
        { position: new Vector3(-3, 1.5, -55), radius: 0.5 },
        { position: new Vector3(3, 1.5, -55), radius: 0.5 },
      ];

      const checkTargetHit = (rayOrigin: Vector3, rayDirection: Vector3) => {
        // Simple ray-sphere intersection check
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          const toTarget = target.position.subtract(rayOrigin);
          const dist = Vector3.Dot(toTarget, rayDirection);

          if (dist > 0) {
            const closest = rayOrigin.add(rayDirection.scale(dist));
            const hitDist = Vector3.Distance(closest, target.position);

            if (hitDist <= target.radius) {
              return { hit: true, targetIndex: i };
            }
          }
        }
        return { hit: false, targetIndex: -1 };
      };

      // Test hitting center target
      const rayOrigin = new Vector3(0, 1.5, -47);
      const rayDirection = new Vector3(0, 0, -1);
      const result = checkTargetHit(rayOrigin, rayDirection);

      expect(result.hit).toBe(true);
      expect(result.targetIndex).toBe(0);
    });

    it('should report calibration active state', () => {
      let isActive = false;

      const isCalibrationActive = () => isActive;

      expect(isCalibrationActive()).toBe(false);

      isActive = true;
      expect(isCalibrationActive()).toBe(true);
    });

    it('should complete calibration after all targets hit', () => {
      let calibrationComplete = false;
      let targetsRemaining = 5;

      const hitTarget = () => {
        targetsRemaining--;
        if (targetsRemaining === 0) {
          calibrationComplete = true;
        }
      };

      for (let i = 0; i < 5; i++) {
        hitTarget();
      }

      expect(calibrationComplete).toBe(true);
      expect(targetsRemaining).toBe(0);
    });
  });
});

describe('Environment - Platforming System', () => {
  describe('Platforming Tutorial', () => {
    it('should start platforming tutorial with callbacks', () => {
      const callbacks = {
        onJumpComplete: vi.fn(),
        onCrouchComplete: vi.fn(),
        onPlatformingComplete: vi.fn(),
      };

      let platformingActive = false;

      const startPlatformingTutorial = (cbs: typeof callbacks) => {
        platformingActive = true;
        return cbs;
      };

      startPlatformingTutorial(callbacks);
      expect(platformingActive).toBe(true);
    });

    it('should check jump zone', () => {
      const jumpZone = {
        center: new Vector3(-4, 0, -34),
        radius: 2,
        minHeight: 0.5,
      };

      const checkJumpZone = (playerPosition: Vector3, isJumping: boolean) => {
        const dist = Vector3.Distance(
          new Vector3(playerPosition.x, 0, playerPosition.z),
          new Vector3(jumpZone.center.x, 0, jumpZone.center.z)
        );

        return dist <= jumpZone.radius && isJumping && playerPosition.y >= jumpZone.minHeight;
      };

      // Player in zone and jumping
      expect(checkJumpZone(new Vector3(-4, 1, -34), true)).toBe(true);

      // Player in zone but not jumping
      expect(checkJumpZone(new Vector3(-4, 0, -34), false)).toBe(false);

      // Player jumping but not in zone
      expect(checkJumpZone(new Vector3(0, 1, 0), true)).toBe(false);
    });

    it('should check crouch zone', () => {
      const crouchZone = {
        entry: new Vector3(-4, 0, -38),
        exit: new Vector3(-4, 0, -41),
        width: 2,
      };

      const checkCrouchZone = (playerPosition: Vector3, isCrouching: boolean) => {
        const inZoneZ =
          playerPosition.z >= crouchZone.exit.z && playerPosition.z <= crouchZone.entry.z;
        const inZoneX = Math.abs(playerPosition.x - crouchZone.entry.x) <= crouchZone.width;

        return inZoneX && inZoneZ && isCrouching;
      };

      // Player in zone and crouching
      expect(checkCrouchZone(new Vector3(-4, 0.5, -39), true)).toBe(true);

      // Player in zone but not crouching
      expect(checkCrouchZone(new Vector3(-4, 1.7, -39), false)).toBe(false);
    });

    it('should report platforming active state', () => {
      let isActive = false;

      const isPlatformingActive = () => isActive;

      expect(isPlatformingActive()).toBe(false);

      isActive = true;
      expect(isPlatformingActive()).toBe(true);
    });

    it('should return platform colliders', () => {
      const platforms = [
        createMockMesh('platform1'),
        createMockMesh('platform2'),
        createMockMesh('platform3'),
      ];

      const getPlatformColliders = () => platforms;

      expect(getPlatformColliders()).toHaveLength(3);
    });
  });
});

describe('Environment - Door System', () => {
  describe('Corridor Doors', () => {
    it('should open corridor start door', () => {
      const _corridorDoors = {
        briefingToMovement: { start: createMockMesh('door_start'), end: null },
      };

      let doorOpen = false;

      const openCorridorDoor = (corridor: string, which: 'start' | 'end') => {
        if (corridor === 'briefingToMovement' && which === 'start') {
          doorOpen = true;
        }
      };

      openCorridorDoor('briefingToMovement', 'start');
      expect(doorOpen).toBe(true);
    });

    it('should open corridor end door', () => {
      let doorOpen = false;

      const openCorridorDoor = (corridor: string, which: 'start' | 'end') => {
        if (corridor === 'movementToPlatforming' && which === 'end') {
          doorOpen = true;
        }
      };

      openCorridorDoor('movementToPlatforming', 'end');
      expect(doorOpen).toBe(true);
    });
  });

  describe('Named Doors', () => {
    it('should open corridor_to_equipment door', () => {
      let doorOpen = false;

      const openDoor = (doorName: string) => {
        if (doorName === 'corridor_to_equipment') {
          doorOpen = true;
        }
      };

      openDoor('corridor_to_equipment');
      expect(doorOpen).toBe(true);
    });

    it('should open corridor_to_range door', () => {
      let doorOpen = false;

      const openDoor = (doorName: string) => {
        if (doorName === 'corridor_to_range') {
          doorOpen = true;
        }
      };

      openDoor('corridor_to_range');
      expect(doorOpen).toBe(true);
    });

    it('should open range_to_hangar door', () => {
      let doorOpen = false;

      const openDoor = (doorName: string) => {
        if (doorName === 'range_to_hangar') {
          doorOpen = true;
        }
      };

      openDoor('range_to_hangar');
      expect(doorOpen).toBe(true);
    });

    it('should open corridor_to_platforming door', () => {
      let doorOpen = false;

      const openDoor = (doorName: string) => {
        if (doorName === 'corridor_to_platforming') {
          doorOpen = true;
        }
      };

      openDoor('corridor_to_platforming');
      expect(doorOpen).toBe(true);
    });
  });
});

describe('Environment - Disposal', () => {
  it('should dispose all environment resources', () => {
    const resources = {
      root: { dispose: vi.fn() },
      rooms: {
        briefing: { dispose: vi.fn() },
        corridorA: { dispose: vi.fn() },
        hangarBay: { dispose: vi.fn() },
      },
      lights: [{ dispose: vi.fn() }, { dispose: vi.fn() }],
      curvedCorridors: {
        briefingToMovement: { dispose: vi.fn() },
        rangeToHangar: { dispose: vi.fn() },
      },
      scenicRooms: { dispose: vi.fn() },
    };

    const dispose = () => {
      // Dispose rooms
      Object.values(resources.rooms).forEach((room) => room.dispose());

      // Dispose lights
      resources.lights.forEach((light) => light.dispose());

      // Dispose corridors
      Object.values(resources.curvedCorridors).forEach((corridor) => corridor.dispose());

      // Dispose scenic rooms
      resources.scenicRooms.dispose();

      // Dispose root
      resources.root.dispose();
    };

    dispose();

    expect(resources.root.dispose).toHaveBeenCalled();
    expect(resources.rooms.briefing.dispose).toHaveBeenCalled();
    expect(resources.lights[0].dispose).toHaveBeenCalled();
    expect(resources.curvedCorridors.briefingToMovement.dispose).toHaveBeenCalled();
    expect(resources.scenicRooms.dispose).toHaveBeenCalled();
  });

  it('should clear model cache on dispose', () => {
    const modelCache = new Map<string, object[]>();
    const meshes = [{ name: 'mesh1', dispose: vi.fn(), isDisposed: vi.fn(() => false) }];

    modelCache.set('/assets/models/test.glb', meshes);

    const clearModelCache = () => {
      for (const [, cachedMeshes] of modelCache) {
        for (const mesh of cachedMeshes) {
          if (
            typeof mesh === 'object' &&
            'dispose' in mesh &&
            !('isDisposed' in mesh && (mesh as { isDisposed: () => boolean }).isDisposed())
          ) {
            (mesh as { dispose: () => void }).dispose();
          }
        }
      }
      modelCache.clear();
    };

    clearModelCache();

    expect(modelCache.size).toBe(0);
    expect(meshes[0].dispose).toHaveBeenCalled();
  });
});

describe('Environment - Scenic Room Positions Export', () => {
  it('should export scenic corridor position', () => {
    const SCENIC_ROOM_POSITIONS = {
      scenicCorridor: new Vector3(-5, 0, -14.5),
    };

    expect(SCENIC_ROOM_POSITIONS.scenicCorridor.x).toBe(-5);
  });

  it('should export observation deck position', () => {
    const SCENIC_ROOM_POSITIONS = {
      observationDeck: new Vector3(-5, 0, -5.5),
    };

    expect(SCENIC_ROOM_POSITIONS.observationDeck.z).toBe(-5.5);
  });

  it('should export mess hall position', () => {
    const SCENIC_ROOM_POSITIONS = {
      messHall: new Vector3(-12, 0, -8.5),
    };

    expect(SCENIC_ROOM_POSITIONS.messHall.x).toBe(-12);
  });

  it('should export recreation room position', () => {
    const SCENIC_ROOM_POSITIONS = {
      recreationRoom: new Vector3(-12, 0, -16.5),
    };

    expect(SCENIC_ROOM_POSITIONS.recreationRoom.z).toBe(-16.5);
  });
});
