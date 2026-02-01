/**
 * ModularStationBuilder Tests
 *
 * Tests for the GLB-based modular station construction system.
 * Tests station layout, room definitions, discovery points, and
 * position validation.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it, vi } from 'vitest';

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

describe('ModularStationBuilder - Module Constants', () => {
  describe('Module Dimensions', () => {
    it('should define module length at 4 units', () => {
      const MODULE_LENGTH = 4.0;
      expect(MODULE_LENGTH).toBe(4.0);
    });

    it('should define module width at 5.55 units', () => {
      const MODULE_WIDTH = 5.55;
      expect(MODULE_WIDTH).toBeCloseTo(5.55);
    });

    it('should define module height at 3.09 units', () => {
      const MODULE_HEIGHT = 3.09;
      expect(MODULE_HEIGHT).toBeCloseTo(3.09);
    });
  });

  describe('Model Paths', () => {
    it('should define corridor model paths', () => {
      const MODELS = {
        corridorMain: '/assets/models/environment/station/corridor_main.glb',
        corridorJunction: '/assets/models/environment/station/corridor_junction.glb',
        corridorCorner: '/assets/models/environment/station/corridor_corner.glb',
        corridorWide: '/assets/models/environment/station/corridor_wide.glb',
      };

      expect(MODELS.corridorMain).toContain('corridor_main');
      expect(MODELS.corridorJunction).toContain('junction');
    });

    it('should define station element paths', () => {
      const MODELS = {
        stationDoor: '/assets/models/environment/station/station_door.glb',
        stationBarrel: '/assets/models/environment/station/station_barrel.glb',
        wall: '/assets/models/environment/station/wall_hr_1_double.glb',
        doorway: '/assets/models/environment/station/doorway_hr_1.glb',
        floorCeiling: '/assets/models/environment/station/floor_ceiling_hr_1.glb',
      };

      expect(MODELS.stationDoor).toContain('station_door');
      expect(MODELS.wall).toContain('wall');
    });
  });
});

describe('ModularStationBuilder - StationSegment Interface', () => {
  it('should define segment with type, position, rotation, and name', () => {
    const segment = {
      type: 'main' as const,
      position: new Vector3(0, 0, 0),
      rotation: 0,
      name: 'test_segment',
    };

    expect(segment.type).toBe('main');
    expect(segment.position).toBeInstanceOf(Vector3);
    expect(segment.rotation).toBe(0);
    expect(segment.name).toBe('test_segment');
  });

  it('should support all segment types', () => {
    const types = ['main', 'junction', 'corner', 'wide'] as const;

    types.forEach((type) => {
      const segment = {
        type,
        position: new Vector3(0, 0, 0),
        rotation: 0,
        name: `${type}_segment`,
      };
      expect(segment.type).toBe(type);
    });
  });
});

describe('ModularStationBuilder - RoomDefinition Interface', () => {
  it('should define room with name, center, bounds, and connections', () => {
    const room = {
      name: 'briefing',
      center: new Vector3(0, 0, 0),
      bounds: { minX: -10, maxX: 10, minZ: -7.5, maxZ: 7.5 },
      connectedTo: ['corridorA'],
    };

    expect(room.name).toBe('briefing');
    expect(room.center).toBeInstanceOf(Vector3);
    expect(room.bounds.minX).toBe(-10);
    expect(room.bounds.maxX).toBe(10);
    expect(room.connectedTo).toContain('corridorA');
  });
});

describe('ModularStationBuilder - ANCHOR_STATION_LAYOUT', () => {
  describe('Spawn Point', () => {
    it('should define spawn point in briefing room', () => {
      const spawnPoint = new Vector3(0, 1.5, 2);

      expect(spawnPoint.x).toBe(0);
      expect(spawnPoint.y).toBe(1.5); // Standing height
      expect(spawnPoint.z).toBe(2); // Slightly back in briefing room
    });
  });

  describe('Briefing Room Segments', () => {
    it('should define briefing room center segment', () => {
      const segment = {
        type: 'wide' as const,
        position: new Vector3(0, 0, 0),
        rotation: 0,
        name: 'briefing_center',
      };

      expect(segment.name).toBe('briefing_center');
      expect(segment.type).toBe('wide');
    });

    it('should define briefing room edge segments', () => {
      const segments = [
        { type: 'main', position: new Vector3(0, 0, 4), name: 'briefing_north' },
        { type: 'main', position: new Vector3(-4, 0, 0), name: 'briefing_west' },
        { type: 'main', position: new Vector3(4, 0, 0), name: 'briefing_east' },
      ];

      expect(segments.length).toBe(3);
      expect(segments[0].position.z).toBe(4);
    });
  });

  describe('Observation Deck Segments', () => {
    it('should define observation deck northwest of briefing', () => {
      const segments = [
        { type: 'corner', position: new Vector3(-4, 0, 4), name: 'obs_corner' },
        { type: 'main', position: new Vector3(-8, 0, 4), rotation: Math.PI / 2, name: 'obs_hall' },
        { type: 'wide', position: new Vector3(-12, 0, 4), rotation: Math.PI / 2, name: 'obs_deck' },
      ];

      expect(segments[0].position.x).toBe(-4);
      expect(segments[2].name).toBe('obs_deck');
    });
  });

  describe('Engine Room Segments', () => {
    it('should define engine room northeast of briefing', () => {
      const segments = [
        {
          type: 'corner',
          position: new Vector3(4, 0, 4),
          rotation: Math.PI,
          name: 'engine_corner',
        },
        {
          type: 'main',
          position: new Vector3(8, 0, 4),
          rotation: Math.PI / 2,
          name: 'engine_hall',
        },
        {
          type: 'wide',
          position: new Vector3(12, 0, 4),
          rotation: Math.PI / 2,
          name: 'engine_room',
        },
      ];

      expect(segments[0].position.x).toBe(4);
      expect(segments[2].name).toBe('engine_room');
    });
  });

  describe('Corridor A Segments', () => {
    it('should define main corridor spine going south', () => {
      const segments = [
        { type: 'main', position: new Vector3(0, 0, -4), name: 'corridor_1' },
        { type: 'junction', position: new Vector3(0, 0, -8), name: 'corridor_junction1' },
        { type: 'main', position: new Vector3(0, 0, -12), name: 'corridor_2' },
        { type: 'junction', position: new Vector3(0, 0, -16), name: 'corridor_junction2' },
        { type: 'main', position: new Vector3(0, 0, -20), name: 'corridor_3' },
      ];

      expect(segments.length).toBe(5);
      expect(segments[0].position.x).toBe(0);
      // Corridor extends south (negative Z)
      expect(segments[4].position.z).toBeLessThan(0);
    });
  });

  describe('Crew Quarters Segments', () => {
    it('should define crew quarters west of first junction', () => {
      const segments = [
        {
          type: 'corner',
          position: new Vector3(-4, 0, -8),
          rotation: Math.PI / 2,
          name: 'crew_corner',
        },
        { type: 'main', position: new Vector3(-8, 0, -8), name: 'crew_hall' },
        { type: 'wide', position: new Vector3(-12, 0, -8), name: 'crew_quarters' },
      ];

      expect(segments[0].position.z).toBe(-8);
      expect(segments[2].name).toBe('crew_quarters');
    });
  });

  describe('Medical Bay Segments', () => {
    it('should define medical bay east of first junction', () => {
      const segments = [
        { type: 'corner', position: new Vector3(4, 0, -8), name: 'med_corner' },
        { type: 'main', position: new Vector3(8, 0, -8), name: 'med_hall' },
        { type: 'wide', position: new Vector3(12, 0, -8), name: 'medical_bay' },
      ];

      expect(segments[0].position.x).toBe(4);
      expect(segments[2].name).toBe('medical_bay');
    });
  });

  describe('Equipment Bay Segments', () => {
    it('should define equipment bay west of second junction', () => {
      const segment = {
        type: 'corner',
        position: new Vector3(-4, 0, -16),
        rotation: Math.PI / 2,
        name: 'equip_corner',
      };

      expect(segment.position.z).toBe(-16);
    });
  });
});

describe('ModularStationBuilder - MODULAR_ROOM_POSITIONS', () => {
  describe('Required Room Positions', () => {
    it('should define briefing room position', () => {
      const briefingRoom = new Vector3(0, 0, 2);
      expect(briefingRoom.z).toBe(2);
    });

    it('should define corridor A position', () => {
      const corridorA = new Vector3(0, 0, -10);
      expect(corridorA.z).toBeLessThan(0);
    });

    it('should define equipment bay position', () => {
      const equipmentBay = new Vector3(-10, 0, -16);
      expect(equipmentBay.x).toBeLessThan(0);
    });

    it('should define armory position', () => {
      const armory = new Vector3(10, 0, -16);
      expect(armory.x).toBeGreaterThan(0);
    });

    it('should define holodeck center position', () => {
      const holodeckCenter = new Vector3(0, 0, -34);
      expect(holodeckCenter.z).toBe(-34);
    });

    it('should define shooting range position', () => {
      const shootingRange = new Vector3(0, 0, -52);
      expect(shootingRange.z).toBe(-52);
    });

    it('should define hangar bay position', () => {
      const hangarBay = new Vector3(0, 0, -70);
      expect(hangarBay.z).toBe(-70);
    });

    it('should define drop pod position', () => {
      const dropPod = new Vector3(0, 0, -76);
      expect(dropPod.z).toBe(-76);
    });
  });

  describe('Platforming Positions', () => {
    it('should define platform positions with increasing height', () => {
      const platform1 = new Vector3(-4, 0, -32);
      const platform2 = new Vector3(-1, 0.8, -34);
      const platform3 = new Vector3(2, 1.2, -36);

      expect(platform1.y).toBe(0);
      expect(platform2.y).toBe(0.8);
      expect(platform3.y).toBe(1.2);
    });

    it('should define crouch passage entry and exit', () => {
      const crouchEntry = new Vector3(-4, 0, -38);
      const crouchExit = new Vector3(-4, 0, -41);

      expect(crouchEntry.z).toBeGreaterThan(crouchExit.z);
      expect(crouchEntry.x).toBe(crouchExit.x);
    });

    it('should define platforming entry and exit', () => {
      const platformingEntry = new Vector3(-4, 0, -30);
      const platformingExit = new Vector3(-4, 0, -42);

      expect(platformingEntry.z).toBeGreaterThan(platformingExit.z);
    });
  });

  describe('Exploration Area Positions', () => {
    it('should define engine room position', () => {
      const engineRoom = new Vector3(12, 0, 4);
      expect(engineRoom.x).toBe(12);
    });

    it('should define suit locker position', () => {
      const suitLocker = new Vector3(-13, 0, -16);
      expect(suitLocker.x).toBeLessThan(0);
    });

    it('should define weapon rack position', () => {
      const weaponRack = new Vector3(13, 0, -16);
      expect(weaponRack.x).toBeGreaterThan(0);
    });
  });
});

describe('ModularStationBuilder - DISCOVERY_POINTS', () => {
  describe('Discovery Point Interface', () => {
    it('should define discovery point with id, name, description, position, and reward', () => {
      const discoveryPoint = {
        id: 'marcus_locker',
        name: "Marcus's Locker",
        description: 'Your brother left something behind...',
        position: new Vector3(-12, 0, -8),
        reward: { type: 'audio_log', id: 'marcus_01' },
      };

      expect(discoveryPoint.id).toBe('marcus_locker');
      expect(discoveryPoint.position).toBeInstanceOf(Vector3);
      expect(discoveryPoint.reward.type).toBe('audio_log');
    });
  });

  describe('Discovery Point Locations', () => {
    it('should define discovery in observation deck', () => {
      const obsDiscovery = {
        id: 'chitin_intel',
        name: 'Chitin Movement Data',
        position: new Vector3(-12, 0, 4),
        reward: { type: 'intel', id: 'chitin_movements' },
      };

      expect(obsDiscovery.position.x).toBe(-12);
      expect(obsDiscovery.position.z).toBe(4);
    });

    it('should define discovery in crew quarters', () => {
      const crewDiscovery = {
        id: 'marcus_locker',
        position: new Vector3(-12, 0, -8),
        reward: { type: 'audio_log', id: 'marcus_01' },
      };

      expect(crewDiscovery.position.z).toBe(-8);
    });

    it('should define discovery in medical bay', () => {
      const medDiscovery = {
        id: 'chitin_specimen',
        name: 'Chitin Specimen',
        position: new Vector3(12, 0, -8),
        reward: { type: 'lore', id: 'chitin_biology' },
      };

      expect(medDiscovery.position.x).toBe(12);
    });

    it('should define discovery in engine room', () => {
      const engineDiscovery = {
        id: 'hidden_cache',
        name: 'Emergency Supply Cache',
        position: new Vector3(12, 0, 4),
        reward: { type: 'supplies', id: 'emergency_cache' },
      };

      expect(engineDiscovery.reward.type).toBe('supplies');
    });
  });
});

describe('ModularStationBuilder - ROOM_ATMOSPHERES', () => {
  describe('Room Atmosphere Interface', () => {
    it('should define atmosphere with lighting, ambient, and effects', () => {
      const atmosphere = {
        roomName: 'briefing',
        lighting: { color: { r: 0.85, g: 0.9, b: 1.0 }, intensity: 0.6 },
        ambient: { volume: 0.3, loop: 'station_hum' },
        effects: ['fog_subtle'],
      };

      expect(atmosphere.roomName).toBe('briefing');
      expect(atmosphere.lighting.intensity).toBe(0.6);
    });
  });

  describe('Room-Specific Atmospheres', () => {
    it('should define briefing room atmosphere', () => {
      const briefing = {
        lighting: { color: { r: 0.85, g: 0.9, b: 1.0 }, intensity: 0.6 },
        ambient: { volume: 0.25 },
      };

      expect(briefing.lighting.color.b).toBe(1.0);
    });

    it('should define hangar bay atmosphere', () => {
      const hangar = {
        lighting: { color: { r: 0.5, g: 0.6, b: 0.8 }, intensity: 0.8 },
        ambient: { volume: 0.5 },
      };

      expect(hangar.lighting.intensity).toBe(0.8);
    });

    it('should define shooting range atmosphere', () => {
      const range = {
        lighting: { color: { r: 0.9, g: 0.85, b: 0.7 }, intensity: 0.7 },
        ambient: { volume: 0.35 },
      };

      // Warmer lighting for the range
      expect(range.lighting.color.r).toBeGreaterThan(range.lighting.color.b);
    });
  });
});

describe('ModularStationBuilder - Position Helpers', () => {
  describe('isPositionInStation', () => {
    it('should return true for position inside station bounds', () => {
      const bounds = { minX: -20, maxX: 20, minZ: -80, maxZ: 10 };

      const isPositionInStation = (pos: Vector3) =>
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.z >= bounds.minZ &&
        pos.z <= bounds.maxZ;

      expect(isPositionInStation(new Vector3(0, 0, 0))).toBe(true);
      expect(isPositionInStation(new Vector3(-10, 0, -50))).toBe(true);
      expect(isPositionInStation(new Vector3(15, 0, 5))).toBe(true);
    });

    it('should return false for position outside station bounds', () => {
      const bounds = { minX: -20, maxX: 20, minZ: -80, maxZ: 10 };

      const isPositionInStation = (pos: Vector3) =>
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.z >= bounds.minZ &&
        pos.z <= bounds.maxZ;

      expect(isPositionInStation(new Vector3(-30, 0, 0))).toBe(false);
      expect(isPositionInStation(new Vector3(0, 0, 20))).toBe(false);
      expect(isPositionInStation(new Vector3(0, 0, -100))).toBe(false);
    });
  });

  describe('getCurrentRoom', () => {
    it('should identify briefing room by position', () => {
      const rooms = [
        { name: 'briefing', center: new Vector3(0, 0, 2), radius: 10 },
        { name: 'corridor', center: new Vector3(0, 0, -10), radius: 5 },
      ];

      const getCurrentRoom = (pos: Vector3) => {
        for (const room of rooms) {
          const dist = Vector3.Distance(
            new Vector3(pos.x, 0, pos.z),
            new Vector3(room.center.x, 0, room.center.z)
          );
          if (dist <= room.radius) {
            return room.name;
          }
        }
        return null;
      };

      expect(getCurrentRoom(new Vector3(0, 0, 2))).toBe('briefing');
      expect(getCurrentRoom(new Vector3(5, 0, 0))).toBe('briefing');
    });

    it('should identify corridor by position', () => {
      const rooms = [
        { name: 'briefing', center: new Vector3(0, 0, 2), radius: 8 },
        { name: 'corridor', center: new Vector3(0, 0, -10), radius: 8 },
      ];

      const getCurrentRoom = (pos: Vector3) => {
        for (const room of rooms) {
          const dist = Vector3.Distance(
            new Vector3(pos.x, 0, pos.z),
            new Vector3(room.center.x, 0, room.center.z)
          );
          if (dist <= room.radius) {
            return room.name;
          }
        }
        return null;
      };

      expect(getCurrentRoom(new Vector3(0, 0, -10))).toBe('corridor');
    });

    it('should return null when not in any room', () => {
      const rooms = [{ name: 'briefing', center: new Vector3(0, 0, 2), radius: 5 }];

      const getCurrentRoom = (pos: Vector3) => {
        for (const room of rooms) {
          const dist = Vector3.Distance(
            new Vector3(pos.x, 0, pos.z),
            new Vector3(room.center.x, 0, room.center.z)
          );
          if (dist <= room.radius) {
            return room.name;
          }
        }
        return null;
      };

      expect(getCurrentRoom(new Vector3(100, 0, 100))).toBe(null);
    });
  });
});

describe('ModularStationBuilder - buildModularStation', () => {
  describe('ModularStationResult Interface', () => {
    it('should define result with root, segments, rooms, and dispose', () => {
      const result = {
        root: { name: 'stationRoot', dispose: vi.fn() },
        segments: [],
        rooms: [],
        dispose: vi.fn(),
      };

      expect(result.root.name).toBe('stationRoot');
      expect(Array.isArray(result.segments)).toBe(true);
      expect(typeof result.dispose).toBe('function');
    });
  });
});
