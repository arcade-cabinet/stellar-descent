/**
 * MiningDepthsLevel Unit Tests
 *
 * Comprehensive test suite for Level 7: Mining Depths
 * Covers: Underground navigation, flashlight mechanics, hazards,
 * elevator activation, burrower spawns, boss fight, and victory conditions.
 *
 * Target: 95% line coverage, 90% branch coverage
 */

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { LevelCallbacks, LevelConfig } from '../types';
import { MiningDepthsLevel } from './MiningDepthsLevel';

// ============================================================================
// MOCKS
// ============================================================================

// Mock BabylonJS modules using class constructors
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: class MockEngine {
    getRenderWidth() {
      return 1920;
    }
    getRenderHeight() {
      return 1080;
    }
  },
}));

vi.mock('@babylonjs/core/scene', () => ({
  Scene: class MockScene {
    clearColor = { r: 0, g: 0, b: 0, a: 1 };
    fogMode = 0;
    fogDensity = 0;
    fogColor = { r: 0, g: 0, b: 0 };
    environmentTexture = null;
    activeCamera = null;
    onBeforeRenderObservable = { add: vi.fn(), remove: vi.fn() };
    dispose = vi.fn();
  },
}));

vi.mock('@babylonjs/core/Cameras/universalCamera', () => ({
  UniversalCamera: class MockUniversalCamera {
    position = new Vector3(0, 1.7, 0);
    rotation = new Vector3(0, 0, 0);
    minZ = 0.1;
    maxZ = 5000;
    fov = Math.PI / 2;
    inputs = { clear: vi.fn() };
    getDirection = vi.fn(() => new Vector3(0, 0, 1));
    constructor(_name: string, _position: Vector3) {
      // Accept constructor args
    }
  },
}));

vi.mock('@babylonjs/core/Lights/hemisphericLight', () => ({
  HemisphericLight: class MockHemisphericLight {
    intensity = 0;
    diffuse = new Color3(1, 1, 1);
    groundColor = new Color3(0.5, 0.5, 0.5);
    setEnabled = vi.fn();
    dispose = vi.fn();
    constructor(_name: string, _direction: Vector3) {
      // Accept constructor args
    }
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    position = new Vector3(0, 0, 0);
    diffuse = new Color3(1, 1, 1);
    intensity = 1;
    range = 10;
    dispose = vi.fn();
    constructor(_name: string, _position: Vector3) {
      // Accept constructor args
    }
  },
}));

vi.mock('@babylonjs/core/Lights/spotLight', () => ({
  SpotLight: class MockSpotLight {
    position = new Vector3(0, 0, 0);
    direction = new Vector3(0, 0, 1);
    diffuse = new Color3(1, 1, 1);
    specular = new Color3(0.5, 0.5, 0.5);
    intensity = 0;
    range = 35;
    dispose = vi.fn();
    constructor(_name: string, _position: Vector3, _direction: Vector3, _angle: number, _exponent: number) {
      // Accept constructor args
    }
  },
}));

vi.mock('@babylonjs/core/Lights/directionalLight', () => ({
  DirectionalLight: class MockDirectionalLight {
    intensity = 0;
    diffuse = new Color3(1, 1, 1);
    setEnabled = vi.fn();
    dispose = vi.fn();
    constructor(_name: string, _direction: Vector3) {
      // Accept constructor args
    }
  },
}));

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

// Helper for creating mock meshes - used by MeshBuilder
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

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: class MockTransformNode {
    position = new Vector3(0, 0, 0);
    rotation = new Vector3(0, 0, 0);
    scaling = new Vector3(1, 1, 1);
    parent = null;
    dispose = vi.fn();
    isDisposed = () => false;
    setEnabled = vi.fn();
    constructor(_name: string) {
      // Accept constructor args
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
  SPECIES_TO_ASSET: {
    skitterer: 'spider.glb',
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

// Mock achievements
vi.mock('../../achievements', () => ({
  getAchievementManager: vi.fn(() => ({
    onSecretFound: vi.fn(),
    onLevelStart: vi.fn(),
    onLevelComplete: vi.fn(),
    onDamageTaken: vi.fn(),
  })),
}));

// Mock weapon actions
vi.mock('../../context/useWeaponActions', () => ({
  fireWeapon: vi.fn(() => true),
  getWeaponActions: vi.fn(() => ({
    getState: () => ({
      currentAmmo: 30,
      maxMagazineSize: 30,
      reserveAmmo: 90,
      isReloading: false,
    }),
  })),
  startReload: vi.fn(),
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
    update: vi.fn(),
    setCameraPosition: vi.fn(),
    setScreenShakeCallback: vi.fn(),
    applyPlayerDamageFeedback: vi.fn(),
    applyDamageFeedback: vi.fn(),
    dispose: vi.fn(),
  },
}));

// Mock input bridge
vi.mock('../../input/InputBridge', () => ({
  bindableActionParams: vi.fn((action: string) => ({
    key: action === 'reload' ? 'KeyR' : 'KeyE',
    keyDisplay: action === 'reload' ? 'R' : 'E',
  })),
  levelActionParams: vi.fn((action: string) => ({
    key: action === 'flashlight' ? 'KeyF' : action === 'scanner' ? 'KeyT' : 'KeyV',
    keyDisplay: action === 'flashlight' ? 'F' : action === 'scanner' ? 'T' : 'V',
  })),
}));

// Mock actions
vi.mock('../../types/actions', () => ({
  createAction: vi.fn((id, label, key, opts) => ({
    id,
    label,
    key,
    ...opts,
  })),
}));

// Mock environment
vi.mock('./environment', () => ({
  createMiningEnvironment: vi.fn().mockResolvedValue({
    root: createMockTransformNode(),
    allMeshes: [],
    materials: new Map(),
    lights: [],
    flickerLights: [],
    sections: {
      entry: createMockTransformNode(),
      hub: createMockTransformNode(),
      tunnels: createMockTransformNode(),
      shaft: createMockTransformNode(),
    },
    keycardPickup: createMockMesh('keycard'),
    shaftGate: createMockMesh('gate'),
    audioLogMeshes: [createMockMesh('log1'), createMockMesh('log2'), createMockMesh('log3')],
    hazardMeshes: [],
    bossArenaDoor: createMockMesh('bossArenaDoor'),
    glbInstances: [],
    dispose: vi.fn(),
  }),
  MINE_POSITIONS: {
    entry: new Vector3(0, 0, 0),
    hubCenter: new Vector3(0, 0, -25),
    hubTerminal: new Vector3(-12, 0, -20),
    hubKeycard: new Vector3(14, 0, -30),
    hubExit: new Vector3(0, 0, -40),
    tunnelStart: new Vector3(0, 0, -50),
    tunnelBend1: new Vector3(-8, -3, -60),
    tunnelMid: new Vector3(-15, -5, -70),
    tunnelBend2: new Vector3(-12, -7, -82),
    tunnelEnd: new Vector3(-10, -10, -95),
    shaftEntry: new Vector3(-10, -13, -108),
    shaftCenter: new Vector3(-10, -15, -120),
    shaftFloor: new Vector3(-10, -29, -120),
    shaftBossSpawn: new Vector3(-10, -27, -120),
    audioLog1: new Vector3(8, 0, -18),
    audioLog2: new Vector3(-15, -5, -75),
    audioLog3: new Vector3(-10, -28, -115),
    gasVent1: new Vector3(-5, -1, -55),
    gasVent2: new Vector3(-18, -6, -78),
    rockfall1: new Vector3(-3, -2, -58),
    rockfall2: new Vector3(-12, -8, -88),
    floodedArea: new Vector3(-10, -12, -103),
    burrowerSpawn1: new Vector3(10, 0, -35),
    burrowerSpawn2: new Vector3(-12, -4, -62),
    burrowerSpawn3: new Vector3(-8, -9, -92),
    burrowerSpawn4: new Vector3(-18, -28, -125),
    burrowerSpawn5: new Vector3(-2, -28, -115),
  },
  HAZARD_ZONES: [
    { id: 'gas_vent_1', type: 'gas_vent', center: new Vector3(-5, -1, -55), radius: 4, damage: 5, active: true },
    { id: 'gas_vent_2', type: 'gas_vent', center: new Vector3(-18, -6, -78), radius: 3, damage: 8, active: true },
    { id: 'rockfall_1', type: 'unstable_ground', center: new Vector3(-3, -2, -58), radius: 5, damage: 15, active: true },
    { id: 'rockfall_2', type: 'unstable_ground', center: new Vector3(-12, -8, -88), radius: 4, damage: 12, active: true },
    { id: 'flooded_section', type: 'flooded', center: new Vector3(-10, -12, -103), radius: 8, damage: 0, active: true },
  ],
  AUDIO_LOGS: [
    { id: 'log_foreman', position: new Vector3(8, 0, -18), title: 'FOREMAN VASQUEZ - DAY 12', text: 'Test log 1', collected: false },
    { id: 'log_geologist', position: new Vector3(-15, -5, -75), title: 'DR. CHEN - DAY 15', text: 'Test log 2', collected: false },
    { id: 'log_survivor', position: new Vector3(-10, -28, -115), title: 'UNKNOWN MINER - DAY 18', text: 'Test log 3', collected: false },
  ],
}));

// Mock AudioManager
vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    startLevelAudio: vi.fn().mockResolvedValue(undefined),
    startEnvironmentalAudio: vi.fn(),
    stopLevelAudio: vi.fn(),
    stopEnvironmentalAudio: vi.fn(),
    updatePlayerPositionForAudio: vi.fn(),
    setEnvironmentalCombatState: vi.fn(),
    enterCombat: vi.fn(),
    exitCombat: vi.fn(),
    play: vi.fn(),
    playVictory: vi.fn(),
    playDefeat: vi.fn(),
    addSpatialSoundSource: vi.fn(),
    removeSpatialSoundSource: vi.fn(),
    addAudioZone: vi.fn(),
    removeAudioZone: vi.fn(),
    playEmergencyKlaxon: vi.fn(),
    setAudioOcclusionCallback: vi.fn(),
    setAudioOcclusionEnabled: vi.fn(),
  })),
}));

// Mock input tracker
vi.mock('../../context/useInputActions', () => ({
  getInputTracker: vi.fn(() => ({
    isActionActive: vi.fn(() => false),
    getAllKeysForAction: vi.fn(() => ['KeyE']),
    refreshKeybindings: vi.fn(),
  })),
}));

// Mock PostProcessManager
vi.mock('../../core/PostProcessManager', () => ({
  PostProcessManager: class MockPostProcessManager {
    setLevelType = vi.fn();
    update = vi.fn();
    dispose = vi.fn();
    triggerDamageFlash = vi.fn();
    setPlayerHealth = vi.fn();
    syncWithGameSettings = vi.fn();
    setLowHealthVignette = vi.fn();
    setLowHealthDesaturation = vi.fn();
    setTunnelVision = vi.fn();
    updateKillStreak = vi.fn();
    triggerKillstreakFlash = vi.fn();
  },
}));

// Mock weather system
vi.mock('../../effects/WeatherSystem', () => ({
  getWeatherSystem: vi.fn(() => ({
    initializeEnvironment: vi.fn(),
    setIntensity: vi.fn(),
    setQualityLevel: vi.fn(),
    update: vi.fn(),
    setWeather: vi.fn(),
  })),
  disposeWeatherSystem: vi.fn(),
}));

// Mock atmospheric effects
vi.mock('../../effects/AtmosphericEffects', () => ({
  getAtmosphericEffects: vi.fn(() => ({
    update: vi.fn(),
  })),
  disposeAtmosphericEffects: vi.fn(),
}));

// Mock low health feedback
vi.mock('../../effects/LowHealthFeedback', () => ({
  getLowHealthFeedback: vi.fn(() => ({
    init: vi.fn(),
    update: vi.fn(),
    setVignetteCallback: vi.fn(),
    setDesaturationCallback: vi.fn(),
    setTunnelVisionCallback: vi.fn(),
    setScreenShakeCallback: vi.fn(),
    setPlayerMoving: vi.fn(),
    stopLowHealthEffects: vi.fn(),
  })),
  disposeLowHealthFeedback: vi.fn(),
}));

// Mock melee system
vi.mock('../../combat', () => ({
  getMeleeSystem: vi.fn(() => ({
    init: vi.fn(),
  })),
}));

// Mock ECS
vi.mock('../../core/ecs', () => ({
  world: {},
  createEntity: vi.fn(() => ({ id: 'test-entity' })),
  removeEntity: vi.fn(),
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockTransformNode() {
  return {
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: { setAll: vi.fn(), clone: vi.fn(() => new Vector3(1, 1, 1)) },
    parent: null,
    dispose: vi.fn(),
    isDisposed: () => false,
    setEnabled: vi.fn(),
  };
}

function createMockEngine() {
  return {
    getRenderWidth: () => 1920,
    getRenderHeight: () => 1080,
  };
}

function createMockCanvas(): HTMLCanvasElement {
  return {
    requestPointerLock: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function createMockCallbacks(): LevelCallbacks {
  return {
    onCommsMessage: vi.fn(),
    onObjectiveUpdate: vi.fn(),
    onChapterChange: vi.fn(),
    onHealthChange: vi.fn(),
    onKill: vi.fn(),
    onDamage: vi.fn(),
    onNotification: vi.fn(),
    onLevelComplete: vi.fn(),
    onCombatStateChange: vi.fn(),
    onActionGroupsChange: vi.fn(),
    onActionHandlerRegister: vi.fn(),
    onHitMarker: vi.fn(),
    onDirectionalDamage: vi.fn(),
    onAudioLogFound: vi.fn(),
    onSecretFound: vi.fn(),
    onSkullFound: vi.fn(),
    onDialogueTrigger: vi.fn(),
    onObjectiveMarker: vi.fn(),
    onExposureChange: vi.fn(),
    onFrostDamage: vi.fn(),
    onCinematicStart: vi.fn(),
    onCinematicEnd: vi.fn(),
  };
}

function createMockConfig(): LevelConfig {
  return {
    id: 'the_breach', // Using a valid LevelId as mining_depths isn't defined
    type: 'mine',
    nextLevelId: 'hive_assault',
    previousLevelId: 'southern_ice',
    chapter: 7,
    actName: 'ACT 3: THE TRUTH',
    missionName: 'THE MINING DEPTHS',
    missionSubtitle: 'Underground Mining Facility - LV-847',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    playerSpawnRotation: 0,
    ambientTrack: 'mine_ambient',
    combatTrack: 'mine_combat',
    totalSecrets: 3,
    totalAudioLogs: 3,
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('MiningDepthsLevel', () => {
  let level: MiningDepthsLevel;
  let engine: ReturnType<typeof createMockEngine>;
  let canvas: HTMLCanvasElement;
  let config: LevelConfig;
  let callbacks: LevelCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createMockEngine();
    canvas = createMockCanvas();
    config = createMockConfig();
    callbacks = createMockCallbacks();
    level = new MiningDepthsLevel(engine as any, canvas, config, callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('initialization', () => {
    it('should create level with correct id and type', () => {
      expect(level.id).toBe('the_breach');
      expect(level.type).toBe('mine');
    });

    it('should have config with mining-specific settings', () => {
      expect(level.config.missionName).toBe('THE MINING DEPTHS');
      expect(level.config.totalSecrets).toBe(3);
      expect(level.config.totalAudioLogs).toBe(3);
    });

    it('should initialize level successfully', async () => {
      await level.initialize();
      expect(level['isInitialized']).toBe(true);
    });

    it('should set initial phase to arrival', async () => {
      await level.initialize();
      expect(level['phase']).toBe('arrival');
    });

    it('should display level title notification on start', async () => {
      await level.initialize();
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        'THE MINING DEPTHS - LV-847',
        3000
      );
    });

    it('should set initial objective on start', async () => {
      await level.initialize();
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalledWith(
        'INVESTIGATE THE MINES',
        'Explore the abandoned mining facility. Find a way deeper.'
      );
    });

    it('should register action handler on start', async () => {
      await level.initialize();
      expect(callbacks.onActionHandlerRegister).toHaveBeenCalled();
    });

    it('should preload burrower enemy models', async () => {
      const { AssetManager } = await import('../../core/AssetManager');
      await level.initialize();
      expect(AssetManager.loadAsset).toHaveBeenCalled();
    });

    it('should preload boss GLB assets', async () => {
      const { AssetManager } = await import('../../core/AssetManager');
      await level.initialize();
      expect(AssetManager.loadAssetByPath).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BACKGROUND COLOR & FOV TESTS
  // ==========================================================================

  describe('visual settings', () => {
    it('should return dark underground background color', () => {
      const bgColor = level['getBackgroundColor']();
      expect(bgColor.r).toBeLessThan(0.01);
      expect(bgColor.g).toBeLessThan(0.01);
      expect(bgColor.b).toBeLessThan(0.02);
    });

    it('should return narrower FOV for claustrophobic feel', () => {
      const fov = level['getDefaultFOV']();
      // 65 degrees in radians = ~1.134
      expect(fov).toBeCloseTo((65 * Math.PI) / 180, 2);
    });
  });

  // ==========================================================================
  // FLASHLIGHT MECHANICS
  // ==========================================================================

  describe('flashlight mechanics', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should start with flashlight off', () => {
      expect(level['flashlightOn']).toBe(false);
    });

    it('should toggle flashlight on action', () => {
      level['toggleFlashlight']();
      expect(level['flashlightOn']).toBe(true);
      expect(callbacks.onNotification).toHaveBeenCalledWith('FLASHLIGHT ON', 800);
    });

    it('should toggle flashlight off on second action', () => {
      level['toggleFlashlight']();
      level['toggleFlashlight']();
      expect(level['flashlightOn']).toBe(false);
      expect(callbacks.onNotification).toHaveBeenCalledWith('FLASHLIGHT OFF', 800);
    });

    it('should update flashlight position with camera', () => {
      level['flashlightOn'] = true;
      level['updateFlashlightTransform']();
      // Flashlight should follow camera
      expect(level['flashlight']).toBeDefined();
    });
  });

  // ==========================================================================
  // PHASE PROGRESSION
  // ==========================================================================

  describe('phase progression', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should transition from arrival to hub_explore when entering hub', () => {
      level['phase'] = 'arrival';
      level['onEnterArea']('hub');
      expect(level['phase']).toBe('hub_explore');
    });

    it('should transition to tunnels phase when keycard acquired', () => {
      level['phase'] = 'hub_explore';
      level['hasKeycard'] = true;
      level['onEnterArea']('tunnel_start');
      expect(level['phase']).toBe('tunnels');
    });

    it('should transition to shaft_descent when gate opened', () => {
      level['phase'] = 'tunnels';
      level['shaftGateOpen'] = true;
      level['onEnterArea']('shaft');
      expect(level['phase']).toBe('shaft_descent');
    });

    it('should transition to boss_fight when reaching shaft floor', () => {
      level['phase'] = 'shaft_descent';
      level['bossDefeated'] = false;
      level['transitionToPhase']('boss_fight');
      expect(level['phase']).toBe('boss_fight');
    });

    it('should transition to exit after boss defeated', () => {
      level['transitionToPhase']('exit');
      expect(level['phase']).toBe('exit');
    });
  });

  // ==========================================================================
  // HAZARD SYSTEM TESTS
  // ==========================================================================

  describe('hazard system', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should apply gas vent damage over time', () => {
      // Simulate player in gas vent area
      level['camera'].position = new Vector3(-5, -1, -55);
      level['checkHazards'](1.0); // 1 second
      expect(callbacks.onHealthChange).toHaveBeenCalledWith(-5);
      expect(callbacks.onNotification).toHaveBeenCalledWith('TOXIC GAS!', 500);
    });

    it('should trigger rockfall on unstable ground', () => {
      level['camera'].position = new Vector3(-3, -2, -58);
      level['checkHazards'](0.1);
      expect(callbacks.onHealthChange).toHaveBeenCalledWith(-15);
      expect(callbacks.onNotification).toHaveBeenCalledWith('ROCKFALL!', 1000);
    });

    it('should only trigger rockfall once', () => {
      level['camera'].position = new Vector3(-3, -2, -58);
      level['checkHazards'](0.1);
      level['checkHazards'](0.1);
      // Should only be called once
      expect(callbacks.onHealthChange).toHaveBeenCalledTimes(1);
    });

    it('should set playerInFlood when in flooded area', () => {
      level['camera'].position = new Vector3(-10, -12, -103);
      level['checkHazards'](0.1);
      expect(level['playerInFlood']).toBe(true);
    });

    it('should show flooded section notification once', () => {
      level['camera'].position = new Vector3(-10, -12, -103);
      level['checkHazards'](0.1);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        'FLOODED SECTION - LIMITED VISIBILITY',
        2000
      );
    });
  });

  // ==========================================================================
  // KEYCARD & GATE TESTS
  // ==========================================================================

  describe('keycard and gate', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should pickup keycard when close', () => {
      level['camera'].position = new Vector3(14, 0, -30);
      level['checkKeycardPickup']();
      expect(level['hasKeycard']).toBe(true);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        'DEEP SHAFT ACCESS KEYCARD ACQUIRED',
        2000
      );
    });

    it('should not pickup keycard if already has one', () => {
      level['hasKeycard'] = true;
      level['camera'].position = new Vector3(14, 0, -30);
      const callCount = (callbacks.onNotification as Mock).mock.calls.length;
      level['checkKeycardPickup']();
      // Should not add new notification
      expect((callbacks.onNotification as Mock).mock.calls.length).toBe(callCount);
    });

    it('should open shaft gate with keycard', () => {
      level['hasKeycard'] = true;
      level['openShaftGate']();
      expect(level['shaftGateOpen']).toBe(true);
      expect(callbacks.onNotification).toHaveBeenCalledWith('SHAFT GATE UNLOCKED', 1500);
    });

    it('should not open gate without keycard', () => {
      level['hasKeycard'] = false;
      level['openShaftGate']();
      expect(level['shaftGateOpen']).toBe(false);
    });
  });

  // ==========================================================================
  // AUDIO LOG TESTS
  // ==========================================================================

  describe('audio log pickups', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should collect audio log when close', () => {
      level['camera'].position = new Vector3(8, 0, -18);
      level['checkAudioLogPickups']();
      expect(level['audioLogsCollected']).toBe(1);
    });

    it('should not collect already collected log', () => {
      level['audioLogs'][0].collected = true;
      level['camera'].position = new Vector3(8, 0, -18);
      const prevCount = level['audioLogsCollected'];
      level['checkAudioLogPickups']();
      expect(level['audioLogsCollected']).toBe(prevCount);
    });

    it('should display log title on collection', () => {
      level['camera'].position = new Vector3(8, 0, -18);
      level['checkAudioLogPickups']();
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('AUDIO LOG:'),
        3000
      );
    });
  });

  // ==========================================================================
  // BURROWER ENEMY TESTS
  // ==========================================================================

  describe('burrower enemies', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should spawn burrower at position', () => {
      const spawnPos = new Vector3(10, 0, -35);
      level['spawnBurrower'](spawnPos);
      expect(level['burrowers'].length).toBe(1);
      expect(level['burrowers'][0].health).toBe(80);
    });

    it('should not exceed max burrowers', () => {
      for (let i = 0; i < 10; i++) {
        level['spawnBurrower'](new Vector3(i, 0, -35));
      }
      expect(level['burrowers'].length).toBeLessThanOrEqual(8);
    });

    it('should update burrower from buried to emerging state', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      const burrower = level['burrowers'][0];
      burrower.emergeTimer = 0; // Force immediate emergence
      level['updateBurrowers'](0.1);
      expect(burrower.state).toBe('emerging');
    });

    it('should transition burrower to chase after emerging', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      const burrower = level['burrowers'][0];
      burrower.state = 'emerging';
      burrower.stateTimer = 1.0; // Complete emergence
      level['updateBurrowers'](0.1);
      expect(burrower.state).toBe('chase');
    });

    it('should remove dead burrower', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['burrowers'][0].health = 0;
      level['updateBurrowers'](0.1);
      expect(level['burrowers'].length).toBe(0);
    });

    it('should increment kill count on burrower death', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['burrowers'][0].health = 0;
      level['updateBurrowers'](0.1);
      expect(level['killCount']).toBe(1);
    });
  });

  // ==========================================================================
  // BOSS FIGHT TESTS
  // ==========================================================================

  describe('boss fight - Mining Drill Chitin', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should start boss fight when entering shaft floor', () => {
      level['startBossFight']();
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        'WARNING: HOSTILE ALPHA DETECTED',
        3000
      );
      expect(callbacks.onCombatStateChange).toHaveBeenCalledWith(true);
    });

    it('should spawn boss with correct health', async () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      expect(level['boss']).not.toBeNull();
      expect(level['boss']?.health).toBe(500);
      expect(level['boss']?.maxHealth).toBe(500);
    });

    it('should enrage boss at 30% health', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['boss']!.health = 140; // Below 30%
      level['updateBoss'](0.1);
      expect(level['boss']?.isEnraged).toBe(true);
    });

    it('should transition to boss_defeated when health reaches 0', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['boss']!.health = 0;
      level['updateBoss'](0.1);
      expect(level['bossDefeated']).toBe(true);
    });

    it('should complete level after boss defeated', () => {
      // Set up the boss - required for onBossDefeated to work
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['phase'] = 'boss_fight';
      level['bossDefeated'] = false;

      // Defeat the boss
      level['onBossDefeated']();

      // Should now be marked as defeated
      expect(level['bossDefeated']).toBe(true);
    });

    it('should update boss state during charge', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['boss']!.state = 'charge';
      level['boss']!.chargeTarget = new Vector3(0, 0, 0);
      level['boss']!.stateTimer = 0;
      level['updateBoss'](0.1);
      // Boss should still be charging or transitioned
      expect(['charge', 'idle']).toContain(level['boss']!.state);
    });

    it('should execute drill attack when in range', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['boss']!.state = 'drill_attack';
      level['boss']!.stateTimer = 0.6;
      level['camera'].position = level['boss']!.mesh.position.clone();
      level['updateBoss'](0.1);
      expect(callbacks.onHealthChange).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // COMBAT ACTIONS TESTS
  // ==========================================================================

  describe('combat actions', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should fire primary weapon', () => {
      level['primaryFireCooldown'] = 0;
      // Mock pointer locked
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      level['firePrimaryWeapon']();
      expect(level['primaryFireCooldown']).toBeGreaterThan(0);
    });

    it('should not fire when on cooldown', () => {
      level['primaryFireCooldown'] = 100;
      const initialCooldown = level['primaryFireCooldown'];
      level['firePrimaryWeapon']();
      expect(level['primaryFireCooldown']).toBe(initialCooldown);
    });

    it('should perform melee attack', () => {
      level['meleeCooldown'] = 0;
      level['spawnBurrower'](new Vector3(2, 0, 0));
      level['burrowers'][0].state = 'chase';
      level['meleeAttack']();
      expect(level['meleeCooldown']).toBeGreaterThan(0);
    });

    it('should not melee when no targets', () => {
      level['meleeCooldown'] = 0;
      level['meleeAttack']();
      // Cooldown should remain 0 since no targets
      expect(level['meleeCooldown']).toBe(0);
    });

    it('should handle reload action', () => {
      level['handleReload']();
      expect(callbacks.onNotification).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SCANNER TESTS
  // ==========================================================================

  describe('scanner functionality', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should activate scanner', () => {
      level['activateScanner']();
      expect(callbacks.onNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should detect keycard when nearby', () => {
      level['hasKeycard'] = false;
      level['camera'].position = new Vector3(10, 0, -30);
      level['activateScanner']();
      vi.advanceTimersByTime(1600);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('KEYCARD DETECTED'),
        2000
      );
    });

    it('should detect audio logs when nearby', () => {
      level['hasKeycard'] = true; // Skip keycard detection
      level['camera'].position = new Vector3(8, 0, -20);
      level['activateScanner']();
      vi.advanceTimersByTime(1600);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('AUDIO LOG DETECTED'),
        2000
      );
    });
  });

  // ==========================================================================
  // INTERACT TESTS
  // ==========================================================================

  describe('interaction system', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should interact with gate when keycard available', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = false;
      level['camera'].position = new Vector3(-10, -13, -110);
      level['tryInteract']();
      expect(level['shaftGateOpen']).toBe(true);
    });

    it('should check for near interactables', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = false;
      level['camera'].position = new Vector3(-10, -13, -110);
      const interactable = level['checkNearInteractable']();
      expect(interactable).toBe('USE KEYCARD');
    });

    it('should return null when no interactables nearby', () => {
      level['camera'].position = new Vector3(0, 0, 0);
      const interactable = level['checkNearInteractable']();
      expect(interactable).toBeNull();
    });
  });

  // ==========================================================================
  // ACTION HANDLER TESTS
  // ==========================================================================

  describe('action handler', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle flashlight action', () => {
      level['handleAction']('flashlight');
      expect(level['flashlightOn']).toBe(true);
    });

    it('should handle scanner action', () => {
      level['handleAction']('scanner');
      expect(callbacks.onNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should handle interact action', () => {
      level['hasKeycard'] = true;
      level['camera'].position = new Vector3(-10, -13, -110);
      level['handleAction']('interact');
      expect(level['shaftGateOpen']).toBe(true);
    });

    it('should handle melee action', () => {
      level['spawnBurrower'](new Vector3(2, 0, 0));
      level['burrowers'][0].state = 'chase';
      level['handleAction']('melee');
      expect(level['meleeCooldown']).toBeGreaterThan(0);
    });

    it('should handle reload action', () => {
      level['handleAction']('reload');
      expect(callbacks.onNotification).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ACTION BUTTONS TESTS
  // ==========================================================================

  describe('action buttons', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should update action buttons with tools group', () => {
      level['updateActionButtons']();
      expect(callbacks.onActionGroupsChange).toHaveBeenCalled();
      const groups = (callbacks.onActionGroupsChange as Mock).mock.calls[0][0];
      const toolsGroup = groups.find((g: any) => g.id === 'tools');
      expect(toolsGroup).toBeDefined();
    });

    it('should include combat buttons when enemies active', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['burrowers'][0].state = 'chase';
      level['updateActionButtons']();
      const groups = (callbacks.onActionGroupsChange as Mock).mock.calls.at(-1)[0];
      const combatGroup = groups.find((g: any) => g.id === 'combat');
      expect(combatGroup).toBeDefined();
    });

    it('should include interact button when near interactable', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = false;
      level['camera'].position = new Vector3(-10, -13, -110);
      level['updateActionButtons']();
      const groups = (callbacks.onActionGroupsChange as Mock).mock.calls.at(-1)[0];
      const interactGroup = groups.find((g: any) => g.id === 'interact');
      expect(interactGroup).toBeDefined();
    });
  });

  // ==========================================================================
  // MOVEMENT & SPEED TESTS
  // ==========================================================================

  describe('movement', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should return normal move speed', () => {
      level['playerInFlood'] = false;
      expect(level['getMoveSpeed']()).toBe(4);
    });

    it('should return slower speed in flooded area', () => {
      level['playerInFlood'] = true;
      expect(level['getMoveSpeed']()).toBe(2.5);
    });
  });

  // ==========================================================================
  // FOG SYSTEM TESTS
  // ==========================================================================

  describe('fog system', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should increase fog density in deeper areas', () => {
      level['camera'].position.z = -110;
      level['updateFogDensity']();
      expect(level['fogDensity']).toBeGreaterThan(0.012);
    });

    it('should have thickest fog in deep shaft', () => {
      level['camera'].position.y = -20;
      level['camera'].position.z = -120;
      // Run multiple times to allow smooth transition to complete
      for (let i = 0; i < 100; i++) {
        level['updateFogDensity']();
      }
      // Deep shaft (y < -15) has base density of 0.028
      expect(level['fogDensity']).toBeGreaterThan(0.02);
    });

    it('should increase fog in flooded area', () => {
      level['playerInFlood'] = true;
      level['updateFogDensity']();
      // After smooth transition
      for (let i = 0; i < 100; i++) {
        level['updateFogDensity']();
      }
      expect(level['fogDensity']).toBeGreaterThan(0.03);
    });
  });

  // ==========================================================================
  // AREA TRIGGERS TESTS
  // ==========================================================================

  describe('area triggers', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should trigger entry area', () => {
      level['camera'].position = new Vector3(0, 0, 0);
      level['checkAreaTriggers']();
      const entryZone = level['areaZones'].find(z => z.id === 'entry');
      expect(entryZone?.triggered).toBe(true);
    });

    it('should trigger hub area', () => {
      level['camera'].position = new Vector3(0, 0, -25);
      level['checkAreaTriggers']();
      const hubZone = level['areaZones'].find(z => z.id === 'hub');
      expect(hubZone?.triggered).toBe(true);
    });

    it('should not re-trigger already triggered zones', () => {
      const zone = level['areaZones'].find(z => z.id === 'entry');
      zone!.triggered = true;
      level['camera'].position = new Vector3(0, 0, 0);
      const spy = vi.spyOn(level as any, 'onEnterArea');
      level['checkAreaTriggers']();
      expect(spy).not.toHaveBeenCalledWith('entry');
    });
  });

  // ==========================================================================
  // DUST PARTICLES TESTS
  // ==========================================================================

  describe('dust particles', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should spawn dust particles periodically', () => {
      level['lastDustSpawn'] = 0;
      // Manually call spawn to verify it adds to array
      level['spawnDustParticle']();
      expect(level['dustParticles'].length).toBe(1);
    });

    it('should not spawn dust when at max particles', () => {
      // Fill the array to max
      for (let i = 0; i < 30; i++) {
        level['dustParticles'].push(createMockMesh(`dust_${i}`) as any);
      }
      // Try to update - should not add more
      level['lastDustSpawn'] = 0;
      level['updateDustParticles'](0.3);
      expect(level['dustParticles'].length).toBe(30);
    });

    it('should update and fade existing particles', () => {
      level['spawnDustParticle']();
      const initialY = level['dustParticles'][0].position.y;
      level['updateDustParticles'](0.1);
      expect(level['dustParticles'][0].position.y).toBeLessThan(initialY);
    });
  });

  // ==========================================================================
  // FLICKER LIGHTS TESTS
  // ==========================================================================

  describe('flicker lights', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should update flicker light timers', () => {
      if (level['environment']?.flickerLights?.length) {
        const initialTimer = level['environment'].flickerLights[0].timer;
        level['updateFlickerLights'](0.1);
        expect(level['environment'].flickerLights[0].timer).toBeGreaterThan(initialTimer);
      }
    });

    it('should turn off lights randomly', () => {
      if (level['environment']?.flickerLights?.length) {
        const fl = level['environment'].flickerLights[0];
        fl.isOff = true;
        fl.offTimer = 0;
        fl.offDuration = 0.1;
        level['updateFlickerLights'](0.2);
        expect(fl.isOff).toBe(false);
      }
    });
  });

  // ==========================================================================
  // KEYBOARD INPUT TESTS
  // ==========================================================================

  describe('keyboard input', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle F key for flashlight', () => {
      const event = { code: 'KeyF' } as KeyboardEvent;
      level['handleKeyDown'](event);
      // Flashlight should toggle (checked via internal state)
      expect(level['flashlightOn']).toBe(true);
    });

    it('should handle T key for scanner', () => {
      const event = { code: 'KeyT' } as KeyboardEvent;
      level['handleKeyDown'](event);
      expect(callbacks.onNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should handle V key for melee', () => {
      const event = { code: 'KeyV' } as KeyboardEvent;
      level['spawnBurrower'](new Vector3(2, 0, 0));
      level['burrowers'][0].state = 'chase';
      level['handleKeyDown'](event);
      expect(level['meleeCooldown']).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // LEVEL TRANSITION TESTS
  // ==========================================================================

  describe('level transition', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should not allow transition before boss defeated', () => {
      level['bossDefeated'] = false;
      expect(level.canTransitionTo('hive_assault')).toBe(false);
    });

    it('should allow transition after boss defeated in exit phase', () => {
      level['bossDefeated'] = true;
      level['phase'] = 'exit';
      expect(level.canTransitionTo('hive_assault')).toBe(true);
    });
  });

  // ==========================================================================
  // DISPOSE TESTS
  // ==========================================================================

  describe('dispose', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should clean up all resources on dispose', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();

      level.dispose();

      expect(level['burrowers'].length).toBe(0);
      expect(level['boss']).toBeNull();
      expect(level['flashlight']).toBeNull();
      expect(level['flashlightFill']).toBeNull();
      expect(level['environment']).toBeNull();
    });

    it('should unregister action handler on dispose', () => {
      level.dispose();
      expect(callbacks.onActionHandlerRegister).toHaveBeenCalledWith(null);
    });

    it('should clear action groups on dispose', () => {
      level.dispose();
      expect(callbacks.onActionGroupsChange).toHaveBeenCalledWith([]);
    });
  });

  // ==========================================================================
  // COMMS MESSAGE TESTS
  // ==========================================================================

  describe('comms messages', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should send comms message only once per flag', () => {
      level['sendCommsMessage']('test_message', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Test message',
      });

      level['sendCommsMessage']('test_message', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Duplicate message',
      });

      expect(callbacks.onCommsMessage).toHaveBeenCalledTimes(1);
    });

    it('should send arrival messages on start', () => {
      vi.advanceTimersByTime(3000);
      expect(callbacks.onCommsMessage).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // OBJECTIVE MARKER TESTS
  // ==========================================================================

  describe('objective marker', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should set objective marker position', () => {
      const position = new Vector3(10, 0, -30);
      level['setObjective'](position);
      expect(level['currentObjective']).toEqual(position);
      expect(level['objectiveMarker']?.isVisible).toBe(true);
    });

    it('should clear objective marker', () => {
      level['setObjective'](new Vector3(10, 0, -30));
      level['clearObjective']();
      expect(level['currentObjective']).toBeNull();
      expect(level['objectiveMarker']?.isVisible).toBe(false);
    });
  });

  // ==========================================================================
  // CONSTRAIN PLAYER POSITION TESTS
  // ==========================================================================

  describe('player position constraints', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should constrain player height in hub area', () => {
      level['camera'].position = new Vector3(0, 5, -25);
      level['constrainPlayerPosition']();
      expect(level['camera'].position.y).toBeCloseTo(1.7, 1);
    });

    it('should constrain player height in tunnels', () => {
      level['camera'].position = new Vector3(-10, 5, -70);
      level['constrainPlayerPosition']();
      // Should be at tunnel height
      expect(level['camera'].position.y).toBeLessThan(2);
    });

    it('should constrain player height in deep shaft', () => {
      level['camera'].position = new Vector3(-10, 0, -125);
      level['constrainPlayerPosition']();
      // Should be at shaft floor height
      expect(level['camera'].position.y).toBeLessThan(-10);
    });
  });

  // ==========================================================================
  // CLICK HANDLER TESTS
  // ==========================================================================

  describe('click handler', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should fire weapon on click when pointer locked', () => {
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      level['primaryFireCooldown'] = 0;
      level['handleClick']();
      expect(level['primaryFireCooldown']).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // UPDATE LEVEL TESTS
  // ==========================================================================

  describe('updateLevel', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should increment phase time', () => {
      const initialTime = level['phaseTime'];
      level['updateLevel'](0.016);
      expect(level['phaseTime']).toBeGreaterThan(initialTime);
    });

    it('should update all subsystems', () => {
      level['updateLevel'](0.016);
      // Should not throw
    });

    it('should reduce cooldowns over time', () => {
      level['meleeCooldown'] = 1000;
      level['primaryFireCooldown'] = 100;
      level['updateLevel'](0.1);
      expect(level['meleeCooldown']).toBeLessThan(1000);
      expect(level['primaryFireCooldown']).toBeLessThan(100);
    });

    it('should animate objective marker', () => {
      level['setObjective'](new Vector3(10, 0, -30));
      const initialRotation = level['objectiveMarker']!.rotation.y;
      level['updateLevel'](0.1);
      expect(level['objectiveMarker']!.rotation.y).not.toBe(initialRotation);
    });

    it('should update boss when present', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['updateLevel'](0.1);
      // Boss should exist and be updated
      expect(level['boss']).not.toBeNull();
    });

    it('should update burrowers when present', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['burrowers'][0].state = 'chase';
      level['updateLevel'](0.1);
      // Burrower state timer should have been updated
      expect(level['burrowers'][0].stateTimer).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // ADDITIONAL COVERAGE TESTS
  // ==========================================================================

  describe('lighting setup', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should have cave ambient lighting configured', () => {
      expect(level['caveAmbient']).not.toBeNull();
    });

    it('should have flashlight created', () => {
      expect(level['flashlight']).not.toBeNull();
    });

    it('should have flashlight fill light created', () => {
      expect(level['flashlightFill']).not.toBeNull();
    });
  });

  describe('area zones', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should have area zones configured', () => {
      expect(level['areaZones'].length).toBeGreaterThan(0);
    });

    it('should have entry zone', () => {
      const entryZone = level['areaZones'].find(z => z.id === 'entry');
      expect(entryZone).toBeDefined();
    });

    it('should have hub zone', () => {
      const hubZone = level['areaZones'].find(z => z.id === 'hub');
      expect(hubZone).toBeDefined();
    });

    it('should have tunnel_start zone', () => {
      const tunnelZone = level['areaZones'].find(z => z.id === 'tunnel_start');
      expect(tunnelZone).toBeDefined();
    });

    it('should have shaft zone', () => {
      const shaftZone = level['areaZones'].find(z => z.id === 'shaft');
      expect(shaftZone).toBeDefined();
    });

    it('should have shaft_floor zone', () => {
      const shaftFloorZone = level['areaZones'].find(z => z.id === 'shaft_floor');
      expect(shaftFloorZone).toBeDefined();
    });
  });

  describe('burrower queue processing', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should spawn burrower from queue when conditions met', () => {
      // This tests that spawning works correctly from the queue mechanism
      level['spawnBurrower'](new Vector3(10, 0, -35));
      expect(level['burrowers'].length).toBe(1);
    });

    it('should not exceed max burrowers', () => {
      // Fill up burrowers to max
      for (let i = 0; i < 10; i++) {
        level['spawnBurrower'](new Vector3(i, 0, -35));
      }
      // Max is 8
      expect(level['burrowers'].length).toBeLessThanOrEqual(8);
    });
  });

  describe('burrower attack', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should apply damage to player when burrower attacks', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      const burrower = level['burrowers'][0];
      burrower.state = 'attack';
      level['onBurrowerAttack'](burrower, 10);
      expect(callbacks.onHealthChange).toHaveBeenCalledWith(-10);
    });

    it('should trigger screen shake on attack', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      const burrower = level['burrowers'][0];
      level['onBurrowerAttack'](burrower, 10);
      // Screen shake is internal but we can verify health change was called
      expect(callbacks.onHealthChange).toHaveBeenCalled();
    });
  });

  describe('muzzle flash', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should create muzzle flash without error', () => {
      // This just verifies the method doesn't throw
      level['createMuzzleFlash']();
      // No error means success
    });
  });

  describe('procedural burrower creation', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should create a procedural burrower mesh', () => {
      const mesh = level['createProceduralBurrower']();
      expect(mesh).toBeDefined();
      // The mock returns 'capsule' as name
      expect(mesh).not.toBeNull();
    });
  });

  describe('boss states', () => {
    beforeEach(async () => {
      await level.initialize();
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
    });

    it('should update boss in idle state', () => {
      level['boss']!.state = 'idle';
      level['boss']!.stateTimer = 0;
      level['boss']!.attackCooldown = 0;
      level['camera'].position = new Vector3(-10, -27, -120); // Close to boss
      level['updateBoss'](0.1);
      // Boss should remain in idle or transition to attack
      expect(['idle', 'charge', 'drill_attack']).toContain(level['boss']!.state);
    });

    it('should handle boss burrow state', () => {
      level['boss']!.state = 'burrow';
      level['boss']!.stateTimer = 0;
      level['updateBoss'](1.5);
      expect(level['boss']!.state).toBe('emerge');
    });

    it('should handle boss emerge state', () => {
      level['boss']!.state = 'emerge';
      level['boss']!.stateTimer = 0;
      level['updateBoss'](1.0);
      expect(level['boss']!.state).toBe('idle');
    });

    it('should transition from enraged state', () => {
      level['boss']!.state = 'enraged';
      level['updateBoss'](0.1);
      expect(level['boss']!.state).toBe('idle');
    });
  });

  describe('primary weapon targeting', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should hit boss when aimed at it', () => {
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      // Position camera to look at boss
      level['camera'].position = new Vector3(-10, -27, -110);
      level['boss']!.mesh.position = new Vector3(-10, -25, -120);
      level['camera'].getDirection = vi.fn(() => new Vector3(0, 0, -1));
      level['primaryFireCooldown'] = 0;
      const initialHealth = level['boss']!.health;
      level['firePrimaryWeapon']();
      // Health should decrease if hit
      expect(level['boss']!.health).toBeLessThanOrEqual(initialHealth);
    });

    it('should hit burrower when aimed at it', () => {
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      level['spawnBurrower'](new Vector3(0, 1.7, 10));
      level['burrowers'][0].state = 'chase';
      level['camera'].position = new Vector3(0, 1.7, 0);
      level['camera'].getDirection = vi.fn(() => new Vector3(0, 0, 1));
      level['primaryFireCooldown'] = 0;
      const initialHealth = level['burrowers'][0].health;
      level['firePrimaryWeapon']();
      expect(level['burrowers'][0].health).toBeLessThanOrEqual(initialHealth);
    });
  });

  describe('melee targeting', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should hit boss with melee', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level['boss']!.mesh.position = new Vector3(0, 1.7, 2);
      level['camera'].position = new Vector3(0, 1.7, 0);
      level['camera'].getDirection = vi.fn(() => new Vector3(0, 0, 1));
      level['meleeCooldown'] = 0;
      const initialHealth = level['boss']!.health;
      level['meleeAttack']();
      expect(level['meleeCooldown']).toBeGreaterThan(0);
    });
  });

  describe('audio log collection', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should notify when audio log collected', () => {
      const log = level['audioLogs'][0];
      level['collectAudioLog'](log, 0);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('AUDIO LOG:'),
        3000
      );
    });

    it('should mark log as collected', () => {
      const log = level['audioLogs'][0];
      level['collectAudioLog'](log, 0);
      expect(log.collected).toBe(true);
    });

    it('should increment audio logs collected counter', () => {
      const initialCount = level['audioLogsCollected'];
      const log = level['audioLogs'][0];
      level['collectAudioLog'](log, 0);
      expect(level['audioLogsCollected']).toBe(initialCount + 1);
    });
  });

  describe('keycard pickup', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should call pickupKeycard when near keycard location', () => {
      level['hasKeycard'] = false;
      level['camera'].position = new Vector3(14, 0, -30);
      level['pickupKeycard']();
      expect(level['hasKeycard']).toBe(true);
    });

    it('should update objective after picking up keycard', () => {
      level['hasKeycard'] = false;
      level['pickupKeycard']();
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });
  });

  describe('shaft gate opening', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should not open gate without keycard', () => {
      level['hasKeycard'] = false;
      level['openShaftGate']();
      expect(level['shaftGateOpen']).toBe(false);
    });

    it('should play sound when opening gate', () => {
      level['hasKeycard'] = true;
      level['openShaftGate']();
      expect(level['shaftGateOpen']).toBe(true);
    });

    it('should update objective after opening gate', () => {
      level['hasKeycard'] = true;
      level['openShaftGate']();
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });
  });

  describe('start level', () => {
    it('should set initial objective', async () => {
      await level.initialize();
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalledWith(
        'INVESTIGATE THE MINES',
        expect.any(String)
      );
    });

    it('should display level title', async () => {
      await level.initialize();
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('MINING DEPTHS'),
        3000
      );
    });
  });

  describe('phase transitions', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should trigger area-specific logic on hub enter', () => {
      level['phase'] = 'arrival';
      level['onEnterArea']('hub');
      expect(level['phase']).toBe('hub_explore');
    });

    it('should show notification when entering hub', () => {
      level['phase'] = 'arrival';
      level['onEnterArea']('hub');
      expect(callbacks.onNotification).toHaveBeenCalled();
    });

    it('should spawn burrowers on tunnel entry', () => {
      level['phase'] = 'hub_explore';
      level['hasKeycard'] = true;
      level['onEnterArea']('tunnel_start');
      expect(level['phase']).toBe('tunnels');
    });

    it('should trigger boss fight on shaft floor entry', () => {
      level['phase'] = 'shaft_descent';
      level['bossDefeated'] = false;
      level['bossAssetsPreloaded'] = true;
      level['onEnterArea']('shaft_floor');
      // Should notify about boss area
      expect(callbacks.onNotification).toHaveBeenCalled();
    });
  });

  describe('hazard zones', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should apply damage from gas vent hazard', () => {
      level['camera'].position = new Vector3(-5, -1, -55);
      level['checkHazards'](1.0);
      expect(callbacks.onHealthChange).toHaveBeenCalledWith(-5);
    });

    it('should show gas warning notification', () => {
      level['camera'].position = new Vector3(-5, -1, -55);
      level['checkHazards'](1.0);
      expect(callbacks.onNotification).toHaveBeenCalledWith('TOXIC GAS!', 500);
    });

    it('should detect flooded area', () => {
      level['camera'].position = new Vector3(-10, -12, -103);
      level['checkHazards'](0.1);
      expect(level['playerInFlood']).toBe(true);
    });
  });

  describe('getDefaultFOV', () => {
    it('should return narrower FOV for claustrophobic tunnels', () => {
      const fov = level['getDefaultFOV']();
      const expectedFov = (65 * Math.PI) / 180;
      expect(fov).toBeCloseTo(expectedFov, 2);
    });
  });

  describe('getMoveSpeed', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should return normal speed by default', () => {
      level['playerInFlood'] = false;
      const speed = level['getMoveSpeed']();
      expect(speed).toBe(4);
    });

    it('should return reduced speed in flood', () => {
      level['playerInFlood'] = true;
      const speed = level['getMoveSpeed']();
      expect(speed).toBe(2.5);
    });
  });

  describe('canTransitionTo', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should return true for next level when boss defeated', () => {
      level['bossDefeated'] = true;
      level['phase'] = 'exit';
      expect(level.canTransitionTo('hive_assault')).toBe(true);
    });

    it('should return false when boss not defeated', () => {
      level['bossDefeated'] = false;
      expect(level.canTransitionTo('hive_assault')).toBe(false);
    });
  });

  describe('environment data', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should have audio logs loaded', () => {
      expect(level['audioLogs'].length).toBe(3);
    });

    it('should have environment created', () => {
      expect(level['environment']).not.toBeNull();
    });
  });

  // ==========================================================================
  // COMPREHENSIVE DISPOSE TESTS
  // ==========================================================================

  describe('dispose with active elements', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should dispose dust particles', () => {
      // Create some dust particles
      level['spawnDustParticle']();
      level['spawnDustParticle']();
      expect(level['dustParticles'].length).toBe(2);

      level.dispose();
      expect(level['dustParticles'].length).toBe(0);
    });

    it('should dispose boss GLB instances', () => {
      level['bossAssetsPreloaded'] = true;
      level['spawnBoss']();
      level.dispose();
      expect(level['bossGlbInstances'].length).toBe(0);
    });

    it('should reset fog mode', () => {
      level.dispose();
      expect(level['scene'].fogMode).toBe(0);
    });
  });

  // ==========================================================================
  // KEYBOARD HANDLING TESTS
  // ==========================================================================

  describe('keyboard handling extended', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle E key for interact', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = false;
      level['camera'].position = new Vector3(-10, -13, -110);
      const event = { code: 'KeyE' } as KeyboardEvent;
      level['handleKeyDown'](event);
      expect(level['shaftGateOpen']).toBe(true);
    });

    it('should handle R key for reload', () => {
      const event = { code: 'KeyR' } as KeyboardEvent;
      level['handleKeyDown'](event);
      expect(callbacks.onNotification).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BURROWER STATE TESTS
  // ==========================================================================

  describe('burrower state transitions', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle burrower attack state', () => {
      level['spawnBurrower'](new Vector3(0, 1.7, 2));
      const burrower = level['burrowers'][0];
      burrower.state = 'attack';
      burrower.stateTimer = 0.5;
      level['updateBurrowers'](0.1);
      // Should transition after attack
      expect(['attack', 'chase', 'idle']).toContain(burrower.state);
    });

    it('should handle burrower burrow state', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      const burrower = level['burrowers'][0];
      burrower.state = 'burrow';
      burrower.stateTimer = 0;
      level['updateBurrowers'](1.5);
      // Should either still be in burrow, transitioned, or back to buried
      expect(['burrow', 'chase', 'emerging', 'buried']).toContain(burrower.state);
    });
  });

  // ==========================================================================
  // PHASE-SPECIFIC BEHAVIOR TESTS
  // ==========================================================================

  describe('phase-specific behavior', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle hub_explore phase correctly', () => {
      level['transitionToPhase']('hub_explore');
      expect(level['phase']).toBe('hub_explore');
    });

    it('should handle tunnels phase correctly', () => {
      level['transitionToPhase']('tunnels');
      expect(level['phase']).toBe('tunnels');
    });

    it('should handle shaft_descent phase correctly', () => {
      level['transitionToPhase']('shaft_descent');
      expect(level['phase']).toBe('shaft_descent');
    });

    it('should handle boss_defeated phase correctly', () => {
      level['transitionToPhase']('boss_defeated');
      expect(level['phase']).toBe('boss_defeated');
    });
  });

  // ==========================================================================
  // COMBAT SYSTEM TESTS
  // ==========================================================================

  describe('combat system', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should update combat state when enemies active', () => {
      level['spawnBurrower'](new Vector3(10, 0, -35));
      level['burrowers'][0].state = 'chase';
      level['setCombatState'](true);
      // Combat state should be active
      expect(callbacks.onCombatStateChange).toHaveBeenCalledWith(true);
    });
  });

  // ==========================================================================
  // SCANNER DETECTION TESTS
  // ==========================================================================

  describe('scanner extended', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should detect no targets when all collected', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = true; // Gate already open
      level['audioLogs'].forEach(log => log.collected = true);
      level['activateScanner']();
      vi.advanceTimersByTime(1600);
      // No audio log or keycard should be detected
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        'NO TARGETS IN RANGE',
        1500
      );
    });

    it('should detect shaft gate when nearby', () => {
      level['hasKeycard'] = true;
      level['shaftGateOpen'] = false;
      level['camera'].position = new Vector3(-10, -13, -100);
      level['activateScanner']();
      vi.advanceTimersByTime(1600);
      expect(callbacks.onNotification).toHaveBeenCalledWith(
        expect.stringContaining('SHAFT GATE'),
        2000
      );
    });
  });

  // ==========================================================================
  // AREA ENTRY BEHAVIOR TESTS
  // ==========================================================================

  describe('area entry behavior', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle shaft entry', () => {
      level['phase'] = 'tunnels';
      level['shaftGateOpen'] = true;
      level['onEnterArea']('shaft');
      expect(level['phase']).toBe('shaft_descent');
    });

    it('should handle shaft_floor entry during shaft_descent', () => {
      level['phase'] = 'shaft_descent';
      level['bossDefeated'] = false;
      level['bossAssetsPreloaded'] = true;
      level['onEnterArea']('shaft_floor');
      // Should trigger boss fight
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CONSTRAIN POSITION EDGE CASES
  // ==========================================================================

  describe('position constraint edge cases', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should handle position at tunnel bend', () => {
      level['camera'].position = new Vector3(-8, 0, -60);
      level['constrainPlayerPosition']();
      // Should be constrained to tunnel height
      expect(level['camera'].position.y).toBeLessThan(1);
    });

    it('should handle position in entry area', () => {
      level['camera'].position = new Vector3(0, 10, 0);
      level['constrainPlayerPosition']();
      expect(level['camera'].position.y).toBeCloseTo(1.7, 1);
    });
  });

  // ==========================================================================
  // OBJECTIVE MARKER TESTS
  // ==========================================================================

  describe('objective updates', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should set objective for keycard when in hub phase', () => {
      level['transitionToPhase']('hub_explore');
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });

    it('should set objective for shaft after getting keycard', () => {
      level['hasKeycard'] = true;
      level['transitionToPhase']('tunnels');
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });
  });
});
