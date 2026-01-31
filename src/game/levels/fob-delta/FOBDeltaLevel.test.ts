/**
 * FOBDeltaLevel.test.ts - Comprehensive unit tests for Level 4: FOB Delta
 *
 * Target: 95% line coverage, 90% branch coverage
 *
 * Tests cover:
 * - Level initialization and environment creation
 * - Phase progression (approach -> courtyard -> investigation -> ambush -> discovery -> exit)
 * - Area zone triggers
 * - Horror lighting and flicker system
 * - Supply pickup system (ammo, health, armor)
 * - Terminal interaction and log access
 * - Ambush enemy spawning and AI
 * - Combat system (melee, primary fire, damage)
 * - Underground hatch mechanics
 * - Fortification and defense positions
 * - Mining outpost bonus level access
 * - Level completion and disposal
 */

import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest';

// ============================================================================
// MOCKS - Must be defined before imports
// ============================================================================

// Mock BabylonJS core dependencies
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: vi.fn().mockImplementation(() => ({
    runRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Lights/hemisphericLight', () => ({
  HemisphericLight: vi.fn().mockImplementation(() => ({
    intensity: 0,
    diffuse: {},
    groundColor: {},
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => {
  class MockPointLight {
    name: string;
    position: any;
    diffuse: any;
    intensity: number;
    range: number;
    dispose: () => void;
    constructor(name: string, position?: any, scene?: any) {
      this.name = name;
      this.position = position || { x: 0, y: 0, z: 0 };
      this.diffuse = { r: 1, g: 1, b: 1 };
      this.intensity = 1;
      this.range = 10;
      this.dispose = vi.fn();
    }
  }
  return { PointLight: MockPointLight };
});

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation((name) => ({
    name,
    diffuseColor: { r: 0, g: 0, b: 0 },
    specularColor: { r: 0, g: 0, b: 0 },
    emissiveColor: { r: 0, g: 0, b: 0 },
    alpha: 1,
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
    clone() {
      return new MockColor3(this.r, this.g, this.b);
    }
    static FromHexString = vi.fn().mockImplementation(() => new MockColor3());
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
      this.x = other?.x || 0;
      this.y = other?.y || 0;
      this.z = other?.z || 0;
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    add(other: any) {
      return new MockVector3(
        this.x + (other?.x || 0),
        this.y + (other?.y || 0),
        this.z + (other?.z || 0)
      );
    }
    subtract(other: any) {
      return new MockVector3(
        this.x - (other?.x || 0),
        this.y - (other?.y || 0),
        this.z - (other?.z || 0)
      );
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      return new MockVector3(this.x / len, this.y / len, this.z / len);
    }
    scale(factor: number) {
      return new MockVector3(this.x * factor, this.y * factor, this.z * factor);
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    static Distance(a: any, b: any) {
      const dx = (a?.x || 0) - (b?.x || 0);
      const dy = (a?.y || 0) - (b?.y || 0);
      const dz = (a?.z || 0) - (b?.z || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    static Dot(a: any, b: any) {
      return (a?.x || 0) * (b?.x || 0) + (a?.y || 0) * (b?.y || 0) + (a?.z || 0) * (b?.z || 0);
    }
    static Forward() {
      return new MockVector3(0, 0, 1);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/mesh', () => ({
  Mesh: vi.fn(),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => {
  const createMockMesh = (name: string) => ({
    name,
    material: null,
    position: { x: 0, y: 0, z: 0, set: vi.fn(), clone: vi.fn().mockReturnThis(), copyFrom: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), clone: vi.fn().mockReturnThis() },
    isVisible: true,
    parent: null,
    isDisposed: vi.fn().mockReturnValue(false),
    dispose: vi.fn(),
    getChildMeshes: vi.fn().mockReturnValue([]),
    getBoundingInfo: vi.fn().mockReturnValue({
      boundingBox: { extendSize: { x: 0.5, y: 0.5, z: 0.5 } },
    }),
    getAbsolutePosition: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
  });
  return {
    MeshBuilder: {
      CreateGround: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateBox: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateSphere: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateCylinder: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreatePlane: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateTorus: vi.fn().mockImplementation((name) => createMockMesh(name)),
      CreateDisc: vi.fn().mockImplementation((name) => createMockMesh(name)),
    },
  };
});

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name) => ({
    name,
    position: { x: 0, y: 0, z: 0, set: vi.fn(), clone: vi.fn().mockReturnThis() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    parent: null,
    dispose: vi.fn(),
    getChildMeshes: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@babylonjs/core/Animations/animatable', () => ({}));

// Mock AssetManager
vi.mock('../../core/AssetManager', () => {
  const createMockNode = (name?: string) => ({
    name: name || 'mockNode',
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      copyFrom: vi.fn(),
      subtract: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
      scale: vi.fn().mockReturnThis(),
      addInPlace: vi.fn(),
    },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, set: vi.fn(), setAll: vi.fn(), clone: vi.fn().mockReturnThis() },
    parent: null,
    dispose: vi.fn(),
    isDisposed: vi.fn().mockReturnValue(false),
    getChildMeshes: vi.fn().mockReturnValue([]),
  });
  return {
    AssetManager: {
      init: vi.fn(),
      loadAssetByPath: vi.fn().mockResolvedValue({}),
      loadAsset: vi.fn().mockResolvedValue({}),
      createInstanceByPath: vi.fn().mockImplementation((path, name) => createMockNode(name)),
      createInstance: vi.fn().mockImplementation((category, type, name) => createMockNode(name)),
      isPathCached: vi.fn().mockReturnValue(true),
    },
    SPECIES_TO_ASSET: {
      lurker: 'scout',
      skitterer: 'drone',
      spewer: 'spitter',
      husk: 'soldier',
    },
  };
});

// Mock Logger
vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock particle manager
vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emitAlienDeath: vi.fn(),
    emitAlienSplatter: vi.fn(),
    emitMuzzleFlash: vi.fn(),
    dispose: vi.fn(),
  },
}));

// Mock damage feedback
vi.mock('../../effects/DamageFeedback', () => ({
  damageFeedback: {
    init: vi.fn(),
    setScreenShakeCallback: vi.fn(),
    update: vi.fn(),
    setCameraPosition: vi.fn(),
    applyDamageFeedback: vi.fn(),
    applyPlayerDamageFeedback: vi.fn(),
    dispose: vi.fn(),
  },
}));

// Mock weapon actions
vi.mock('../../context/useWeaponActions', () => ({
  fireWeapon: vi.fn().mockReturnValue(true),
  startReload: vi.fn(),
  getWeaponActions: vi.fn().mockReturnValue({
    getState: vi.fn().mockReturnValue({
      currentAmmo: 30,
      maxMagazineSize: 30,
      reserveAmmo: 120,
      isReloading: false,
    }),
    addAmmo: vi.fn(),
  }),
}));

// Mock achievements
vi.mock('../../achievements', () => ({
  getAchievementManager: vi.fn().mockReturnValue({
    unlock: vi.fn(),
    incrementProgress: vi.fn(),
  }),
}));

// Mock input bridge
vi.mock('../../input/InputBridge', () => ({
  bindableActionParams: vi.fn().mockReturnValue({ key: 'KeyE', keyDisplay: 'E' }),
  levelActionParams: vi.fn().mockReturnValue({ key: 'KeyF', keyDisplay: 'F' }),
}));

// Mock action types
vi.mock('../../types/actions', () => ({
  createAction: vi.fn().mockImplementation((id, label, key, opts) => ({
    id,
    label,
    key,
    ...opts,
  })),
}));

// Mock ModularBaseBuilder
vi.mock('../shared/ModularBaseBuilder', () => ({
  buildModularBase: vi.fn().mockResolvedValue({
    root: {
      parent: null,
      dispose: vi.fn(),
    },
    lights: [],
    dispose: vi.fn(),
  }),
  updateFlickerLights: vi.fn(),
}));

// Mock BaseLevel
vi.mock('../BaseLevel', () => {
  return {
    BaseLevel: vi.fn().mockImplementation(function (
      this: any,
      engine: any,
      canvas: any,
      config: any,
      callbacks: any
    ) {
      this.engine = engine;
      this.canvas = canvas;
      this.config = config;
      this.callbacks = callbacks;
      this.scene = {
        clearColor: null,
        onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
        dispose: vi.fn(),
      };
      this.camera = {
        position: { x: 0, y: 1.7, z: 0, copyFrom: vi.fn(), clone: vi.fn().mockReturnThis() },
        getDirection: vi.fn().mockReturnValue({ x: 0, y: 0, z: 1, normalize: vi.fn().mockReturnThis(), scale: vi.fn().mockReturnThis() }),
      };
      this.sunLight = { intensity: 1 };
      this.ambientLight = { intensity: 1 };
      this.rotationY = 0;
      this.inputTracker = {
        getAllKeysForAction: vi.fn().mockReturnValue(['KeyE']),
      };
      this.isPointerLocked = vi.fn().mockReturnValue(true);
      this.triggerShake = vi.fn();
      this.addSpatialSound = vi.fn();
      this.addAudioZone = vi.fn();
      this.completeLevel = vi.fn();
      this.handleKeyDown = vi.fn();
      this.handleClick = vi.fn();
    }),
  };
});

// ============================================================================
// IMPORTS - After mocks
// ============================================================================

import { FOBDeltaLevel } from './FOBDeltaLevel';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fireWeapon, startReload, getWeaponActions } from '../../context/useWeaponActions';
import { particleManager } from '../../effects/ParticleManager';
import { damageFeedback } from '../../effects/DamageFeedback';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockEngine() {
  return {
    runRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  } as any;
}

function createMockCanvas() {
  return {
    width: 1920,
    height: 1080,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestPointerLock: vi.fn(),
  } as any;
}

function createMockConfig() {
  return {
    id: 'fob_delta' as const,
    type: 'base' as const,
    nextLevelId: 'brothers_in_arms' as const,
    previousLevelId: 'canyon_run' as const,
    chapter: 4,
    actName: 'ACT 2: THE SEARCH',
    missionName: 'FOB DELTA',
    missionSubtitle: 'Forward Operating Base - Abandoned',
    playerSpawnPosition: { x: 0, y: 1.7, z: -5 },
    hasCinematicIntro: true,
    ambientTrack: 'horror_ambient',
    combatTrack: 'combat_interior',
  };
}

function createMockCallbacks() {
  return {
    onNotification: vi.fn(),
    onObjectiveUpdate: vi.fn(),
    onCommsMessage: vi.fn(),
    onChapterChange: vi.fn(),
    onHealthChange: vi.fn(),
    onDamage: vi.fn(),
    onActionHandlerRegister: vi.fn(),
    onActionGroupsChange: vi.fn(),
    onCombatStateChange: vi.fn(),
    onKill: vi.fn(),
    onLevelComplete: vi.fn(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('FOBDeltaLevel', () => {
  let level: FOBDeltaLevel;
  let mockEngine: any;
  let mockCanvas: any;
  let mockConfig: any;
  let mockCallbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockEngine = createMockEngine();
    mockCanvas = createMockCanvas();
    mockConfig = createMockConfig();
    mockCallbacks = createMockCallbacks();

    level = new FOBDeltaLevel(mockEngine, mockCanvas, mockConfig, mockCallbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Level Initialization', () => {
    it('should create FOBDeltaLevel instance', () => {
      expect(level).toBeDefined();
      expect(level).toBeInstanceOf(FOBDeltaLevel);
    });

    it('should have correct level config', () => {
      expect((level as any).config.id).toBe('fob_delta');
    });

    it('should initialize with approach phase', async () => {
      // Access private phase via type assertion
      const privateLevel = level as any;

      // The level initializes with 'approach' phase
      expect(privateLevel.phase).toBe('approach');
    });

    it('should store callbacks', () => {
      const privateLevel = level as any;
      expect(privateLevel.callbacks).toBe(mockCallbacks);
    });
  });

  describe('Background Color', () => {
    it('should return dark horror atmosphere color', () => {
      const privateLevel = level as any;
      const color = privateLevel.getBackgroundColor();

      // Should be very dark (horror atmosphere)
      expect(color.r).toBeLessThan(0.02);
      expect(color.g).toBeLessThan(0.02);
      expect(color.b).toBeLessThan(0.02);
      expect(color.a).toBe(1);
    });
  });

  describe('Phase Transitions', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.phase = 'approach';
      privateLevel.phaseTime = 0;
      privateLevel.messageFlags = new Set();
      privateLevel.currentObjective = null;
      privateLevel.objectiveMarker = {
        position: { set: vi.fn() },
        isVisible: false,
      };
    });

    it('should transition from approach to courtyard', () => {
      const privateLevel = level as any;
      privateLevel.transitionToPhase('courtyard');

      expect(privateLevel.phase).toBe('courtyard');
      expect(privateLevel.phaseTime).toBe(0);
    });

    it('should transition to investigation phase', () => {
      const privateLevel = level as any;
      privateLevel.transitionToPhase('investigation');

      expect(privateLevel.phase).toBe('investigation');
      expect(mockCallbacks.onObjectiveUpdate).toHaveBeenCalledWith(
        'ACCESS COMMAND LOGS',
        'Find the terminal in the Command Center.'
      );
    });

    it('should trigger ambush on ambush phase transition', () => {
      const privateLevel = level as any;
      privateLevel.ambushTriggered = false;
      privateLevel.ambushEnemiesPreloaded = true;
      privateLevel.enemies = [];
      privateLevel.maxEnemies = 5;
      privateLevel.fobRoot = { parent: null };

      privateLevel.transitionToPhase('ambush');

      expect(privateLevel.phase).toBe('ambush');
    });

    it('should transition to discovery phase', () => {
      const privateLevel = level as any;
      privateLevel.transitionToPhase('discovery');

      expect(privateLevel.phase).toBe('discovery');
    });

    it('should clear objective on exit phase', () => {
      const privateLevel = level as any;
      privateLevel.transitionToPhase('exit');

      expect(privateLevel.phase).toBe('exit');
      expect(privateLevel.objectiveMarker.isVisible).toBe(false);
    });
  });

  describe('Area Zone Triggers', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.phase = 'approach';
      privateLevel.areaZones = [
        { id: 'perimeter', name: 'Perimeter', center: new Vector3(0, 0, -35), radius: 15, triggered: false },
        { id: 'courtyard', name: 'Courtyard', center: new Vector3(0, 0, 0), radius: 20, triggered: false },
        { id: 'barracks', name: 'Barracks', center: new Vector3(-25, 0, 0), radius: 12, triggered: false },
        { id: 'command', name: 'Command Center', center: new Vector3(0, 0, 25), radius: 12, triggered: false },
        { id: 'vehiclebay', name: 'Vehicle Bay', center: new Vector3(25, 0, 0), radius: 15, triggered: false },
        { id: 'hatch', name: 'Underground Access', center: new Vector3(30, 0, 10), radius: 5, triggered: false },
      ];
      privateLevel.messageFlags = new Set();
      privateLevel.logsAccessed = false;
      privateLevel.ambushTriggered = false;
      privateLevel.hatchOpen = false;
    });

    it('should trigger courtyard zone and transition phase', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 5 } };
      privateLevel.objectiveMarker = { position: { set: vi.fn() }, isVisible: false };

      privateLevel.checkAreaTriggers();

      const courtyardZone = privateLevel.areaZones.find((z: any) => z.id === 'courtyard');
      expect(courtyardZone.triggered).toBe(true);
    });

    it('should trigger barracks zone and send comms message', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: -25, y: 1.7, z: 0 } };

      privateLevel.checkAreaTriggers();
      privateLevel.onEnterArea('barracks');

      // Should have triggered barracks zone
      const barracksZone = privateLevel.areaZones.find((z: any) => z.id === 'barracks');
      expect(barracksZone.triggered).toBe(true);
    });

    it('should trigger command zone in courtyard phase', () => {
      const privateLevel = level as any;
      privateLevel.phase = 'courtyard';
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 25 } };

      privateLevel.onEnterArea('command');

      expect(privateLevel.phase).toBe('investigation');
    });

    it('should trigger vehicle bay and ambush when logs accessed', () => {
      const privateLevel = level as any;
      privateLevel.logsAccessed = true;
      privateLevel.ambushTriggered = false;

      privateLevel.onEnterArea('vehiclebay');

      // Message should be sent
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalled();
    });

    it('should show notification when near open hatch', () => {
      const privateLevel = level as any;
      privateLevel.phase = 'exit';
      privateLevel.hatchOpen = true;

      privateLevel.onEnterArea('hatch');

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('PRESS E TO ENTER TUNNELS', 2000);
    });
  });

  describe('Flashlight System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.flashlightOn = false;
      privateLevel.flashlight = { intensity: 0 };
    });

    it('should toggle flashlight on', () => {
      const privateLevel = level as any;
      privateLevel.toggleFlashlight();

      expect(privateLevel.flashlightOn).toBe(true);
      expect(privateLevel.flashlight.intensity).toBe(1.5);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('FLASHLIGHT ON', 800);
    });

    it('should toggle flashlight off', () => {
      const privateLevel = level as any;
      privateLevel.flashlightOn = true;
      privateLevel.flashlight.intensity = 1.5;

      privateLevel.toggleFlashlight();

      expect(privateLevel.flashlightOn).toBe(false);
      expect(privateLevel.flashlight.intensity).toBe(0);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('FLASHLIGHT OFF', 800);
    });
  });

  describe('Scanner System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.terminal = { position: { x: 0, y: 1.5, z: 27 } };
      privateLevel.mechMesh = { position: { x: 27, y: 7.5, z: 0 } };
      privateLevel.undergroundHatch = { position: { x: 30, y: 0.15, z: 10 } };
      privateLevel.logsAccessed = false;
      privateLevel.hatchOpen = false;
      privateLevel.objectiveMarker = { position: { set: vi.fn() }, isVisible: false };
    });

    it('should show scanning notification', () => {
      const privateLevel = level as any;
      privateLevel.activateScanner();

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should detect nearby terminal', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 20 } };

      privateLevel.activateScanner();

      // After timeout, should detect terminal
      vi.advanceTimersByTime(1500);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('TERMINAL DETECTED - 12M', 2000);
    });

    it('should detect mech signature when near', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 15, y: 1.7, z: 0 } };

      privateLevel.activateScanner();

      vi.advanceTimersByTime(1500);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('MECH SIGNATURE DETECTED', 2000);
    });

    it('should detect underground access when logs accessed', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 25, y: 1.7, z: 10 } };
      privateLevel.logsAccessed = true;

      privateLevel.activateScanner();

      vi.advanceTimersByTime(1500);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('UNDERGROUND ACCESS DETECTED', 2000);
    });
  });

  describe('Supply Pickup System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.supplyPickups = [
        {
          mesh: { isVisible: true, dispose: vi.fn() },
          type: 'ammo',
          amount: 30,
          position: new Vector3(0, 0.5, 5),
          collected: false,
          glowLight: { intensity: 0.25, dispose: vi.fn() },
        },
        {
          mesh: { isVisible: true, dispose: vi.fn() },
          type: 'health',
          amount: 25,
          position: new Vector3(5, 0.5, 0),
          collected: false,
          glowLight: { intensity: 0.25, dispose: vi.fn() },
        },
        {
          mesh: { isVisible: true, dispose: vi.fn() },
          type: 'armor',
          amount: 40,
          position: new Vector3(-5, 0.5, 0),
          collected: false,
          glowLight: { intensity: 0.25, dispose: vi.fn() },
        },
      ];
      privateLevel.addSpatialSound = vi.fn();
    });

    it('should find nearby ammo supply', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 6 } };

      const supply = privateLevel.getNearbySupply();

      expect(supply).toBeDefined();
      expect(supply.type).toBe('ammo');
    });

    it('should collect ammo and add to reserve', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 6 } };

      const supply = privateLevel.getNearbySupply();
      privateLevel.collectSupply(supply);

      expect(supply.collected).toBe(true);
      expect(supply.mesh.isVisible).toBe(false);
      expect(supply.glowLight.intensity).toBe(0);
      expect(getWeaponActions()?.addAmmo).toHaveBeenCalledWith(30);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('+30 AMMO', 1500);
    });

    it('should collect health and update player health', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 6, y: 1.7, z: 0 } };

      const supply = privateLevel.supplyPickups[1];
      privateLevel.collectSupply(supply);

      expect(supply.collected).toBe(true);
      expect(mockCallbacks.onHealthChange).toHaveBeenCalledWith(25);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('+25 HEALTH', 1500);
    });

    it('should collect armor and apply to player', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: -4, y: 1.7, z: 0 } };

      const supply = privateLevel.supplyPickups[2];
      privateLevel.collectSupply(supply);

      expect(supply.collected).toBe(true);
      expect(mockCallbacks.onHealthChange).toHaveBeenCalledWith(20); // armor / 2
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('+40 ARMOR', 1500);
    });

    it('should not return already collected supplies', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 6 } };

      // Collect first
      const supply = privateLevel.getNearbySupply();
      privateLevel.collectSupply(supply);

      // Try to get again
      const supplyAgain = privateLevel.getNearbySupply();
      expect(supplyAgain).toBeNull();
    });

    it('should play pickup sound effect', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 6 } };

      const supply = privateLevel.getNearbySupply();
      privateLevel.collectSupply(supply);

      expect(privateLevel.addSpatialSound).toHaveBeenCalled();
    });
  });

  describe('Terminal Interaction', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.terminal = { position: { x: 0, y: 1.5, z: 27 } };
      privateLevel.logsAccessed = false;
      privateLevel.messageFlags = new Set();
      privateLevel.objectiveMarker = { position: { set: vi.fn() }, isVisible: false };
    });

    it('should access logs when near terminal', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 25 } };

      privateLevel.accessLogs();

      expect(privateLevel.logsAccessed).toBe(true);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('ACCESSING MISSION LOGS...', 2000);
    });

    it('should send multiple log messages over time', () => {
      const privateLevel = level as any;
      privateLevel.accessLogs();

      // First log message
      vi.advanceTimersByTime(2500);
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalled();

      // Second log message
      vi.advanceTimersByTime(5500);
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalledTimes(2);

      // Third log message
      vi.advanceTimersByTime(6000);
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalledTimes(3);

      // Transition to discovery phase
      vi.advanceTimersByTime(6000);
      expect(mockCallbacks.onObjectiveUpdate).toHaveBeenCalledWith(
        'LOCATE UNDERGROUND ACCESS',
        'Find the tunnel entrance in the Vehicle Bay.'
      );
    });
  });

  describe('Mining Outpost Access', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.miningTerminal = { position: { x: -28, y: 0.75, z: 8 } };
      privateLevel.miningTerminalAccessed = false;
      privateLevel.logsAccessed = true;
      privateLevel.messageFlags = new Set();
    });

    it('should access mining outpost and show notification', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: -27, y: 1.7, z: 8 } };

      privateLevel.accessMiningOutpost();

      expect(privateLevel.miningTerminalAccessed).toBe(true);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith(
        'MINING OUTPOST GAMMA-7 ACCESS GRANTED',
        2000
      );
    });

    it('should trigger bonus level entry after delay', () => {
      const privateLevel = level as any;
      privateLevel.accessMiningOutpost();

      vi.advanceTimersByTime(4000);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('ENTERING MINING DEPTHS...', 2000);
      expect(mockCallbacks.onLevelComplete).toHaveBeenCalledWith(null);
    });
  });

  describe('Underground Hatch', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.undergroundHatch = { position: { x: 30, y: 0.15, z: 10, set: vi.fn() } };
      privateLevel.hatchOpen = false;
      privateLevel.logsAccessed = true;
      privateLevel.messageFlags = new Set();
      privateLevel.objectiveMarker = { position: { set: vi.fn() }, isVisible: false };
    });

    it('should open hatch and show notification', () => {
      const privateLevel = level as any;
      privateLevel.openHatch();

      expect(privateLevel.hatchOpen).toBe(true);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('HATCH OPENED', 1500);
      expect(privateLevel.undergroundHatch.position.y).toBe(-0.5);
    });

    it('should send comms about Marcus being alive', () => {
      const privateLevel = level as any;
      privateLevel.openHatch();

      vi.advanceTimersByTime(1500);
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalled();
    });

    it('should update objective to descend into breach', () => {
      const privateLevel = level as any;
      privateLevel.openHatch();

      vi.advanceTimersByTime(6000);
      expect(mockCallbacks.onObjectiveUpdate).toHaveBeenCalledWith(
        'DESCEND INTO THE BREACH',
        'Enter the underground tunnels to find Marcus.'
      );
    });
  });

  describe('Ambush System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.ambushTriggered = false;
      privateLevel.ambushEnemiesPreloaded = true;
      privateLevel.enemies = [];
      privateLevel.maxEnemies = 5;
      privateLevel.enemyCount = 0;
      privateLevel.fobRoot = { parent: null };
      privateLevel.messageFlags = new Set();
    });

    it('should trigger ambush and spawn enemies', () => {
      const privateLevel = level as any;
      privateLevel.triggerAmbush();

      expect(privateLevel.ambushTriggered).toBe(true);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('HOSTILES DETECTED!', 2000);
      expect(mockCallbacks.onCombatStateChange).toHaveBeenCalledWith(true);
    });

    it('should not trigger ambush twice', () => {
      const privateLevel = level as any;
      privateLevel.triggerAmbush();
      const initialCallCount = mockCallbacks.onNotification.mock.calls.length;

      privateLevel.triggerAmbush();

      // No additional notification
      expect(mockCallbacks.onNotification.mock.calls.length).toBe(initialCallCount);
    });

    it('should create enemies with correct initial state', () => {
      const privateLevel = level as any;
      privateLevel.triggerAmbush();

      expect(privateLevel.enemies.length).toBe(5);
      privateLevel.enemies.forEach((enemy: any) => {
        expect(enemy.health).toBe(60);
        expect(enemy.state).toBe('chase');
        expect(enemy.attackCooldown).toBe(0);
      });
    });
  });

  describe('Enemy AI', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.enemies = [
        {
          mesh: {
            position: {
              x: 10, y: 1, z: 10,
              clone: vi.fn().mockReturnValue(new Vector3(10, 1, 10)),
            },
            rotation: { y: 0 },
            scaling: { setAll: vi.fn() },
            isDisposed: vi.fn().mockReturnValue(false),
            dispose: vi.fn(),
          },
          health: 60,
          position: new Vector3(10, 1, 10),
          state: 'chase',
          attackCooldown: 0,
        },
      ];
      privateLevel.killCount = 0;
      privateLevel.enemyCount = 1;
      privateLevel.ambushTriggered = true;
    });

    it('should chase player when far', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 0 } };

      privateLevel.updateEnemies(0.016);

      expect(privateLevel.enemies[0].state).toBe('chase');
    });

    it('should attack when in range', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 10, y: 1.7, z: 11 } };

      privateLevel.enemies[0].attackCooldown = 0;
      privateLevel.updateEnemies(0.016);

      expect(privateLevel.enemies[0].state).toBe('attack');
    });

    it('should deal damage on attack', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 10, y: 1.7, z: 11 } };
      privateLevel.enemies[0].attackCooldown = 0;

      privateLevel.onEnemyAttack(privateLevel.enemies[0], 8);

      expect(mockCallbacks.onHealthChange).toHaveBeenCalledWith(-8);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('TAKING DAMAGE!', 500);
    });

    it('should remove enemy on death', () => {
      const privateLevel = level as any;
      privateLevel.enemies[0].health = 0;

      privateLevel.onEnemyKilled(privateLevel.enemies[0], 0);

      expect(privateLevel.killCount).toBe(1);
      expect(privateLevel.enemyCount).toBe(0);
      expect(particleManager.emitAlienDeath).toHaveBeenCalled();
    });

    it('should clear ambush when all enemies killed', () => {
      const privateLevel = level as any;
      privateLevel.enemies = [];

      privateLevel.onAmbushCleared();

      expect(mockCallbacks.onCombatStateChange).toHaveBeenCalledWith(false);
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('AREA CLEAR', 2000);
    });
  });

  describe('Combat - Melee Attack', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.meleeCooldown = 0;
      privateLevel.phase = 'ambush';
      privateLevel.rotationY = 0;
      privateLevel.enemies = [
        {
          mesh: {
            position: new Vector3(0, 1, 2),
            rotation: { y: 0 },
            scaling: { setAll: vi.fn() },
            isDisposed: vi.fn().mockReturnValue(false),
            dispose: vi.fn(),
            getChildMeshes: vi.fn().mockReturnValue([]),
          },
          health: 60,
          position: new Vector3(0, 1, 2),
          state: 'chase',
          attackCooldown: 0,
        },
      ];
    });

    it('should perform melee attack and damage enemies', () => {
      const privateLevel = level as any;
      privateLevel.camera = {
        position: {
          x: 0, y: 1.7, z: 0,
          add: vi.fn().mockReturnValue(new Vector3(0, 1.7, 0)),
          clone: vi.fn().mockReturnValue(new Vector3(0, 1.7, 0)),
        },
      };

      privateLevel.meleeAttack();

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('MELEE!', 500);
      expect(privateLevel.meleeCooldown).toBe(800);
    });

    it('should not melee when on cooldown', () => {
      const privateLevel = level as any;
      privateLevel.meleeCooldown = 500;

      privateLevel.meleeAttack();

      expect(mockCallbacks.onNotification).not.toHaveBeenCalled();
    });

    it('should not melee outside ambush phase', () => {
      const privateLevel = level as any;
      privateLevel.phase = 'courtyard';

      privateLevel.meleeAttack();

      expect(mockCallbacks.onNotification).not.toHaveBeenCalled();
    });
  });

  describe('Combat - Primary Fire', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.primaryFireCooldown = 0;
      privateLevel.phase = 'ambush';
      privateLevel.camera = {
        position: {
          x: 0, y: 1.7, z: 0,
          add: vi.fn().mockReturnValue(new Vector3(0, 1.7, 0)),
          clone: vi.fn().mockReturnValue(new Vector3(0, 1.7, 0)),
        },
        getDirection: vi.fn().mockReturnValue(new Vector3(0, 0, 1)),
      };
      privateLevel.enemies = [
        {
          mesh: {
            position: new Vector3(0, 1, 5),
            rotation: { y: 0 },
            scaling: { setAll: vi.fn() },
            isDisposed: vi.fn().mockReturnValue(false),
            dispose: vi.fn(),
            getChildMeshes: vi.fn().mockReturnValue([]),
          },
          health: 60,
          position: new Vector3(0, 1, 5),
          state: 'chase',
          attackCooldown: 0,
        },
      ];
      privateLevel.isPointerLocked = vi.fn().mockReturnValue(true);
      privateLevel.scene = {};
    });

    it('should fire weapon and create muzzle flash', () => {
      const privateLevel = level as any;
      privateLevel.firePrimaryWeapon();

      expect(fireWeapon).toHaveBeenCalled();
      expect(privateLevel.primaryFireCooldown).toBe(150);
    });

    it('should not fire when on cooldown', () => {
      const privateLevel = level as any;
      privateLevel.primaryFireCooldown = 100;

      privateLevel.firePrimaryWeapon();

      expect(fireWeapon).not.toHaveBeenCalled();
    });

    it('should not fire when pointer not locked', () => {
      const privateLevel = level as any;
      privateLevel.isPointerLocked = vi.fn().mockReturnValue(false);

      privateLevel.firePrimaryWeapon();

      expect(fireWeapon).not.toHaveBeenCalled();
    });

    it('should trigger reload when out of ammo', () => {
      (fireWeapon as Mock).mockReturnValueOnce(false);
      const privateLevel = level as any;

      privateLevel.firePrimaryWeapon();

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('NO AMMO - RELOADING', 800);
      expect(startReload).toHaveBeenCalled();
    });
  });

  describe('Reload System', () => {
    it('should start reload when magazine not full', () => {
      const mockGetState = vi.fn().mockReturnValue({
        currentAmmo: 15,
        maxMagazineSize: 30,
        reserveAmmo: 60,
        isReloading: false,
      });
      (getWeaponActions as any).mockReturnValueOnce({
        getState: mockGetState,
        addAmmo: vi.fn(),
      });

      const privateLevel = level as any;
      privateLevel.handleReload();

      expect(startReload).toHaveBeenCalled();
      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('RELOADING...', 1500);
    });

    it('should not reload when magazine is full', () => {
      const mockGetState = vi.fn().mockReturnValue({
        currentAmmo: 30,
        maxMagazineSize: 30,
        reserveAmmo: 60,
        isReloading: false,
      });
      (getWeaponActions as any).mockReturnValueOnce({
        getState: mockGetState,
        addAmmo: vi.fn(),
      });

      const privateLevel = level as any;
      privateLevel.handleReload();

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('MAGAZINE FULL', 800);
      expect(startReload).not.toHaveBeenCalled();
    });

    it('should not reload when no reserve ammo', () => {
      const mockGetState = vi.fn().mockReturnValue({
        currentAmmo: 15,
        maxMagazineSize: 30,
        reserveAmmo: 0,
        isReloading: false,
      });
      (getWeaponActions as any).mockReturnValueOnce({
        getState: mockGetState,
        addAmmo: vi.fn(),
      });

      const privateLevel = level as any;
      privateLevel.handleReload();

      expect(mockCallbacks.onNotification).toHaveBeenCalledWith('NO RESERVE AMMO', 800);
      expect(startReload).not.toHaveBeenCalled();
    });

    it('should not reload when already reloading', () => {
      const mockGetState = vi.fn().mockReturnValue({
        currentAmmo: 15,
        maxMagazineSize: 30,
        reserveAmmo: 60,
        isReloading: true,
      });
      (getWeaponActions as any).mockReturnValueOnce({
        getState: mockGetState,
        addAmmo: vi.fn(),
      });

      const privateLevel = level as any;
      privateLevel.handleReload();

      expect(startReload).not.toHaveBeenCalled();
    });
  });

  describe('Damage System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.enemies = [
        {
          mesh: {
            position: new Vector3(5, 1, 5),
            rotation: { y: 0 },
            scaling: { setAll: vi.fn() },
            isDisposed: vi.fn().mockReturnValue(false),
            dispose: vi.fn(),
            getChildMeshes: vi.fn().mockReturnValue([]),
          },
          health: 60,
          position: new Vector3(5, 1, 5),
          state: 'chase',
          attackCooldown: 0,
        },
      ];
    });

    it('should damage enemies at position', () => {
      const privateLevel = level as any;
      const hitPos = new Vector3(5, 1, 5);

      const hit = privateLevel.damageEnemyAtPosition(hitPos, 25, 3);

      expect(hit).toBe(true);
      expect(privateLevel.enemies[0].health).toBe(35);
      expect(damageFeedback.applyDamageFeedback).toHaveBeenCalled();
      expect(particleManager.emitAlienSplatter).toHaveBeenCalled();
    });

    it('should not damage enemies outside radius', () => {
      const privateLevel = level as any;
      const hitPos = new Vector3(0, 1, 0);

      const hit = privateLevel.damageEnemyAtPosition(hitPos, 25, 2);

      expect(hit).toBe(false);
      expect(privateLevel.enemies[0].health).toBe(60);
    });
  });

  describe('Flicker Lights System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.flickerLights = [
        {
          light: { intensity: 0.5 },
          baseIntensity: 0.5,
          flickerSpeed: 10,
          flickerAmount: 0.4,
          timer: 0,
          isOff: false,
          offDuration: 0,
          offTimer: 0,
        },
        {
          light: { intensity: 0 },
          baseIntensity: 0.3,
          flickerSpeed: 15,
          flickerAmount: 0.8,
          timer: 1,
          isOff: true,
          offDuration: 0.5,
          offTimer: 0.2,
        },
      ];
    });

    it('should update flicker light timers', () => {
      const privateLevel = level as any;
      const initialTimer = privateLevel.flickerLights[0].timer;

      privateLevel.updateFlickerLights(0.1);

      expect(privateLevel.flickerLights[0].timer).toBeGreaterThan(initialTimer);
    });

    it('should handle off state and recovery', () => {
      const privateLevel = level as any;

      // Advance off timer past duration
      privateLevel.flickerLights[1].offTimer = 0.4;
      privateLevel.updateFlickerLights(0.2);

      expect(privateLevel.flickerLights[1].isOff).toBe(false);
      expect(privateLevel.flickerLights[1].offTimer).toBe(0);
    });

    it('should keep light off when off duration not met', () => {
      const privateLevel = level as any;

      privateLevel.updateFlickerLights(0.1);

      expect(privateLevel.flickerLights[1].isOff).toBe(true);
      expect(privateLevel.flickerLights[1].light.intensity).toBe(0);
    });
  });

  describe('Action Button System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.phase = 'courtyard';
      privateLevel.enemies = [];
      privateLevel.terminal = { position: { x: 0, y: 1.5, z: 27 } };
      privateLevel.logsAccessed = false;
      privateLevel.supplyPickups = [];
    });

    it('should show interact button when near terminal', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 25 } };

      const interactLabel = privateLevel.checkNearInteractable();

      expect(interactLabel).toBe('ACCESS TERMINAL');
    });

    it('should show collect button when near supply', () => {
      const privateLevel = level as any;
      privateLevel.supplyPickups = [
        {
          mesh: { isVisible: true },
          type: 'ammo',
          amount: 30,
          position: new Vector3(0, 0.5, 5),
          collected: false,
          glowLight: { intensity: 0.25 },
        },
      ];
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 6 } };

      const interactLabel = privateLevel.checkNearInteractable();

      expect(interactLabel).toBe('COLLECT AMMO CRATE (+30)');
    });

    it('should show mining outpost button when near terminal after logs', () => {
      const privateLevel = level as any;
      privateLevel.miningTerminal = { position: { x: -28, y: 0.75, z: 8 } };
      privateLevel.miningTerminalAccessed = false;
      privateLevel.logsAccessed = true;
      privateLevel.camera = { position: { x: -27, y: 1.7, z: 8 } };

      const interactLabel = privateLevel.checkNearInteractable();

      expect(interactLabel).toBe('ACCESS MINING OUTPOST GAMMA-7');
    });

    it('should show hatch button when logs accessed', () => {
      const privateLevel = level as any;
      privateLevel.undergroundHatch = { position: { x: 30, y: 0.15, z: 10 } };
      privateLevel.logsAccessed = true;
      privateLevel.hatchOpen = false;
      privateLevel.camera = { position: { x: 29, y: 1.7, z: 10 } };

      const interactLabel = privateLevel.checkNearInteractable();

      expect(interactLabel).toBe('OPEN HATCH');
    });

    it('should show enter tunnels button when hatch open', () => {
      const privateLevel = level as any;
      privateLevel.undergroundHatch = { position: { x: 30, y: -0.5, z: 10 } };
      privateLevel.hatchOpen = true;
      privateLevel.camera = { position: { x: 30, y: 1.7, z: 10 } };

      const interactLabel = privateLevel.checkNearInteractable();

      expect(interactLabel).toBe('ENTER TUNNELS');
    });

    it('should add combat buttons during ambush with enemies', () => {
      const privateLevel = level as any;
      privateLevel.phase = 'ambush';
      privateLevel.enemies = [{ health: 60 }];

      privateLevel.updateActionButtons();

      const actionGroupsCall = mockCallbacks.onActionGroupsChange.mock.calls[0][0];
      const combatGroup = actionGroupsCall.find((g: any) => g.id === 'combat');
      expect(combatGroup).toBeDefined();
    });
  });

  describe('Level Update Loop', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.phase = 'courtyard';
      privateLevel.phaseTime = 0;
      privateLevel.flashlight = { position: { copyFrom: vi.fn() } };
      privateLevel.flickerLights = [];
      privateLevel.modularBaseResult = null;
      privateLevel.areaZones = [];
      privateLevel.enemies = [];
      privateLevel.meleeCooldown = 500;
      privateLevel.primaryFireCooldown = 100;
      privateLevel.objectiveMarker = {
        isVisible: true,
        rotation: { y: 0 },
        material: { alpha: 0.5 },
      };
      privateLevel.mechEyeLight = { intensity: 0.25 };
      privateLevel.supplyPickups = [];
      privateLevel.spotlights = [];
    });

    it('should update phase time', () => {
      const privateLevel = level as any;
      privateLevel.updateLevel(0.016);

      expect(privateLevel.phaseTime).toBe(0.016);
    });

    it('should update damage feedback system', () => {
      const privateLevel = level as any;
      privateLevel.updateLevel(0.016);

      expect(damageFeedback.update).toHaveBeenCalledWith(0.016);
      expect(damageFeedback.setCameraPosition).toHaveBeenCalled();
    });

    it('should update flashlight position to camera', () => {
      const privateLevel = level as any;
      privateLevel.updateLevel(0.016);

      expect(privateLevel.flashlight.position.copyFrom).toHaveBeenCalled();
    });

    it('should decrement combat cooldowns', () => {
      const privateLevel = level as any;
      privateLevel.updateLevel(0.1);

      expect(privateLevel.meleeCooldown).toBe(400);
      expect(privateLevel.primaryFireCooldown).toBe(0);
    });

    it('should animate objective marker when visible', () => {
      const privateLevel = level as any;
      const initialRotation = privateLevel.objectiveMarker.rotation.y;

      privateLevel.updateLevel(0.5);

      expect(privateLevel.objectiveMarker.rotation.y).toBeGreaterThan(initialRotation);
    });

    it('should constrain player to bounds', () => {
      const privateLevel = level as any;
      privateLevel.camera = { position: { x: 50, y: 1.7, z: 50 } };

      privateLevel.updateLevel(0.016);

      expect(privateLevel.camera.position.x).toBeLessThanOrEqual(38);
      expect(privateLevel.camera.position.z).toBeLessThanOrEqual(38);
      expect(privateLevel.camera.position.y).toBe(1.7);
    });
  });

  describe('Level Completion', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.phase = 'exit';
      privateLevel.hatchOpen = true;
    });

    it('should allow transition to brothers_in_arms when ready', () => {
      const privateLevel = level as any;

      const canTransition = privateLevel.canTransitionTo('brothers_in_arms');

      expect(canTransition).toBe(true);
    });

    it('should not allow transition to other levels', () => {
      const privateLevel = level as any;

      const canTransition = privateLevel.canTransitionTo('anchor_station');

      expect(canTransition).toBe(false);
    });

    it('should not allow transition when hatch not open', () => {
      const privateLevel = level as any;
      privateLevel.hatchOpen = false;

      const canTransition = privateLevel.canTransitionTo('brothers_in_arms');

      expect(canTransition).toBe(false);
    });
  });

  describe('Level Disposal', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.modularBaseResult = {
        root: { dispose: vi.fn() },
        lights: [],
        dispose: vi.fn(),
      };
      privateLevel.flickerLights = [
        { light: { dispose: vi.fn() } },
        { light: { dispose: vi.fn() } },
      ];
      privateLevel.enemies = [
        { mesh: { dispose: vi.fn() } },
      ];
      privateLevel.alienVehicles = [
        { dispose: vi.fn() },
      ];
      privateLevel.terminalLight = { dispose: vi.fn() };
      privateLevel.mechEyeLight = { dispose: vi.fn() };
      privateLevel.flashlight = { dispose: vi.fn() };
      privateLevel.horrorAmbient = { dispose: vi.fn() };
      privateLevel.miningTerminalLight = { dispose: vi.fn() };
      privateLevel.supplyPickups = [
        { mesh: { dispose: vi.fn() }, glowLight: { dispose: vi.fn() } },
      ];
      privateLevel.fortificationMeshes = [
        { dispose: vi.fn() },
      ];
      privateLevel.turretPositions = [
        { light: { dispose: vi.fn() } },
      ];
      privateLevel.spotlights = [
        { light: { dispose: vi.fn() } },
      ];
      privateLevel.materials = new Map([
        ['concrete', { dispose: vi.fn() }],
        ['metal', { dispose: vi.fn() }],
      ]);
      privateLevel.allMeshes = [
        { dispose: vi.fn() },
        { dispose: vi.fn() },
      ];
      privateLevel.fobRoot = { dispose: vi.fn() };
      privateLevel.terminal = {};
      privateLevel.mechMesh = {};
      privateLevel.undergroundHatch = {};
      privateLevel.objectiveMarker = {};
      privateLevel.miningTerminal = {};
    });

    it('should dispose modular base result', () => {
      const privateLevel = level as any;
      privateLevel.disposeLevel();

      expect(privateLevel.modularBaseResult).toBeNull();
    });

    it('should dispose all flicker lights', () => {
      const privateLevel = level as any;
      const lights = [...privateLevel.flickerLights];

      privateLevel.disposeLevel();

      lights.forEach((fl: any) => {
        expect(fl.light.dispose).toHaveBeenCalled();
      });
      expect(privateLevel.flickerLights).toHaveLength(0);
    });

    it('should dispose all enemies', () => {
      const privateLevel = level as any;
      const enemies = [...privateLevel.enemies];

      privateLevel.disposeLevel();

      enemies.forEach((e: any) => {
        expect(e.mesh.dispose).toHaveBeenCalled();
      });
      expect(privateLevel.enemies).toHaveLength(0);
    });

    it('should dispose alien vehicle wrecks', () => {
      const privateLevel = level as any;
      const vehicles = [...privateLevel.alienVehicles];

      privateLevel.disposeLevel();

      vehicles.forEach((v: any) => {
        expect(v.dispose).toHaveBeenCalled();
      });
      expect(privateLevel.alienVehicles).toHaveLength(0);
    });

    it('should dispose supply pickups and lights', () => {
      const privateLevel = level as any;
      const supplies = [...privateLevel.supplyPickups];

      privateLevel.disposeLevel();

      supplies.forEach((s: any) => {
        expect(s.mesh.dispose).toHaveBeenCalled();
        expect(s.glowLight.dispose).toHaveBeenCalled();
      });
      expect(privateLevel.supplyPickups).toHaveLength(0);
    });

    it('should dispose all materials', () => {
      const privateLevel = level as any;
      const materials = [...privateLevel.materials.values()];

      privateLevel.disposeLevel();

      materials.forEach((m: any) => {
        expect(m.dispose).toHaveBeenCalled();
      });
      expect(privateLevel.materials.size).toBe(0);
    });

    it('should clear all references', () => {
      const privateLevel = level as any;
      privateLevel.disposeLevel();

      expect(privateLevel.terminal).toBeNull();
      expect(privateLevel.mechMesh).toBeNull();
      expect(privateLevel.undergroundHatch).toBeNull();
      expect(privateLevel.objectiveMarker).toBeNull();
      expect(privateLevel.miningTerminal).toBeNull();
      expect(privateLevel.fobRoot).toBeNull();
    });

    it('should unregister action handler', () => {
      const privateLevel = level as any;
      privateLevel.disposeLevel();

      expect(mockCallbacks.onActionHandlerRegister).toHaveBeenCalledWith(null);
      expect(mockCallbacks.onActionGroupsChange).toHaveBeenCalledWith([]);
    });

    it('should dispose damage feedback system', () => {
      const privateLevel = level as any;
      privateLevel.disposeLevel();

      expect(damageFeedback.dispose).toHaveBeenCalled();
    });
  });

  describe('Comms Message System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.messageFlags = new Set();
    });

    it('should send comms message once per flag', () => {
      const privateLevel = level as any;

      privateLevel.sendCommsMessage('test_flag', {
        sender: 'Test',
        callsign: 'TST',
        portrait: 'ai',
        text: 'Test message',
      });

      expect(mockCallbacks.onCommsMessage).toHaveBeenCalledTimes(1);

      // Try to send same message again
      privateLevel.sendCommsMessage('test_flag', {
        sender: 'Test',
        callsign: 'TST',
        portrait: 'ai',
        text: 'Test message 2',
      });

      // Should not have been called again
      expect(mockCallbacks.onCommsMessage).toHaveBeenCalledTimes(1);
    });

    it('should send different messages for different flags', () => {
      const privateLevel = level as any;

      privateLevel.sendCommsMessage('flag_1', {
        sender: 'Test',
        callsign: 'TST',
        portrait: 'ai',
        text: 'Message 1',
      });

      privateLevel.sendCommsMessage('flag_2', {
        sender: 'Test',
        callsign: 'TST',
        portrait: 'ai',
        text: 'Message 2',
      });

      expect(mockCallbacks.onCommsMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Objective Marker', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.objectiveMarker = {
        position: { set: vi.fn() },
        isVisible: false,
      };
      privateLevel.currentObjective = null;
    });

    it('should set objective and show marker', () => {
      const privateLevel = level as any;
      const position = new Vector3(10, 0, 20);

      privateLevel.setObjective(position);

      expect(privateLevel.currentObjective).toEqual(position);
      expect(privateLevel.objectiveMarker.position.set).toHaveBeenCalledWith(10, 0.5, 20);
      expect(privateLevel.objectiveMarker.isVisible).toBe(true);
    });

    it('should clear objective and hide marker', () => {
      const privateLevel = level as any;
      privateLevel.currentObjective = new Vector3(10, 0, 20);
      privateLevel.objectiveMarker.isVisible = true;

      privateLevel.clearObjective();

      expect(privateLevel.currentObjective).toBeNull();
      expect(privateLevel.objectiveMarker.isVisible).toBe(false);
    });
  });

  describe('Spotlight System', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.spotlights = [
        {
          light: { intensity: 0.6 },
          baseRotation: 0,
          sweepSpeed: 0.3,
          active: true,
        },
        {
          light: { intensity: 0 },
          baseRotation: Math.PI / 2,
          sweepSpeed: 0,
          active: false,
        },
      ];
    });

    it('should update active spotlight intensity', () => {
      const privateLevel = level as any;

      privateLevel.updateSpotlights(0.5);

      // Active spotlight should have modulated intensity
      expect(privateLevel.spotlights[0].light.intensity).toBeGreaterThan(0);
    });

    it('should not update inactive spotlights', () => {
      const privateLevel = level as any;
      const initialIntensity = privateLevel.spotlights[1].light.intensity;

      privateLevel.updateSpotlights(0.5);

      expect(privateLevel.spotlights[1].light.intensity).toBe(initialIntensity);
    });
  });

  describe('Supply Pickup Animation', () => {
    beforeEach(() => {
      const privateLevel = level as any;
      privateLevel.supplyPickups = [
        {
          mesh: { position: { y: 0.5 }, rotation: { y: 0 } },
          type: 'ammo',
          amount: 30,
          position: { x: 0, y: 0.5, z: 5 },
          collected: false,
          glowLight: { intensity: 0.25 },
        },
      ];
    });

    it('should animate supply pickups with bob and rotation', () => {
      const privateLevel = level as any;
      const initialRotation = privateLevel.supplyPickups[0].mesh.rotation.y;

      privateLevel.updateSupplyPickups(0.5);

      // Should have rotated
      expect(privateLevel.supplyPickups[0].mesh.rotation.y).toBeGreaterThan(initialRotation);
    });

    it('should not animate collected supplies', () => {
      const privateLevel = level as any;
      privateLevel.supplyPickups[0].collected = true;
      const initialRotation = privateLevel.supplyPickups[0].mesh.rotation.y;

      privateLevel.updateSupplyPickups(0.5);

      expect(privateLevel.supplyPickups[0].mesh.rotation.y).toBe(initialRotation);
    });
  });
});

describe('FOBDeltaLevel Integration', () => {
  describe('Full Level Flow', () => {
    it('should complete level flow from start to exit', async () => {
      const mockEngine = createMockEngine();
      const mockCanvas = createMockCanvas();
      const mockConfig = createMockConfig();
      const mockCallbacks = createMockCallbacks();

      const level = new FOBDeltaLevel(mockEngine, mockCanvas, mockConfig, mockCallbacks);
      const privateLevel = level as any;

      // Initialize level state
      privateLevel.phase = 'approach';
      privateLevel.areaZones = [
        { id: 'courtyard', center: { x: 0, y: 0, z: 0 }, radius: 20, triggered: false },
        { id: 'command', center: { x: 0, y: 0, z: 25 }, radius: 12, triggered: false },
      ];
      privateLevel.messageFlags = new Set();
      privateLevel.objectiveMarker = { position: { set: vi.fn() }, isVisible: false };
      privateLevel.terminal = { position: { x: 0, y: 1.5, z: 27 } };
      privateLevel.undergroundHatch = { position: { x: 30, y: 0.15, z: 10, set: vi.fn() } };
      privateLevel.logsAccessed = false;
      privateLevel.hatchOpen = false;

      // 1. Enter courtyard
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 5 } };
      privateLevel.checkAreaTriggers();
      expect(privateLevel.areaZones[0].triggered).toBe(true);

      // 2. Transition to investigation
      privateLevel.phase = 'courtyard';
      privateLevel.onEnterArea('command');
      expect(privateLevel.phase).toBe('investigation');

      // 3. Access terminal
      privateLevel.camera = { position: { x: 0, y: 1.7, z: 25 } };
      privateLevel.accessLogs();
      expect(privateLevel.logsAccessed).toBe(true);

      // 4. Open hatch
      privateLevel.openHatch();
      expect(privateLevel.hatchOpen).toBe(true);

      // 5. Exit should be allowed
      privateLevel.phase = 'exit';
      expect(privateLevel.canTransitionTo('brothers_in_arms')).toBe(true);
    });
  });

  describe('Combat Encounter Flow', () => {
    it('should handle complete combat encounter', () => {
      const mockEngine = createMockEngine();
      const mockCanvas = createMockCanvas();
      const mockConfig = createMockConfig();
      const mockCallbacks = createMockCallbacks();

      const level = new FOBDeltaLevel(mockEngine, mockCanvas, mockConfig, mockCallbacks);
      const privateLevel = level as any;

      // Setup combat
      privateLevel.phase = 'ambush';
      privateLevel.ambushTriggered = true;
      privateLevel.ambushEnemiesPreloaded = true;
      privateLevel.enemies = [];
      privateLevel.maxEnemies = 3;
      privateLevel.enemyCount = 0;
      privateLevel.killCount = 0;
      privateLevel.fobRoot = { parent: null };
      privateLevel.messageFlags = new Set();

      // Spawn enemies manually (simulating triggerAmbush)
      for (let i = 0; i < 3; i++) {
        privateLevel.enemies.push({
          mesh: {
            position: {
              x: 10 + i * 5, y: 1, z: 10,
              clone: vi.fn().mockReturnValue(new Vector3(10 + i * 5, 1, 10)),
            },
            rotation: { y: 0 },
            scaling: { setAll: vi.fn() },
            isDisposed: vi.fn().mockReturnValue(false),
            dispose: vi.fn(),
          },
          health: 60,
          position: {
            x: 10 + i * 5, y: 1, z: 10,
            clone: vi.fn().mockReturnValue(new Vector3(10 + i * 5, 1, 10)),
          },
          state: 'chase',
          attackCooldown: 0,
        });
      }
      privateLevel.enemyCount = 3;

      // Kill enemies one by one
      while (privateLevel.enemies.length > 0) {
        const enemy = privateLevel.enemies[0];
        enemy.health = 0;
        privateLevel.onEnemyKilled(enemy, 0);
      }

      expect(privateLevel.killCount).toBe(3);
      expect(privateLevel.enemyCount).toBe(0);
      expect(mockCallbacks.onCombatStateChange).toHaveBeenCalledWith(false);
    });
  });
});
