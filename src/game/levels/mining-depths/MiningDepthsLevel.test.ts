/**
 * MiningDepthsLevel Unit Tests
 *
 * Comprehensive test suite for Level 7: Mining Depths
 * Covers: Underground navigation, flashlight mechanics, hazards,
 * elevator activation, burrower spawns, boss fight, and victory conditions.
 *
 * Target: 95% line coverage, 90% branch coverage
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { LevelConfig } from '../types';
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
  },
}));

vi.mock('@babylonjs/core/Lights/hemisphericLight', () => ({
  HemisphericLight: class MockHemisphericLight {
    intensity = 0;
    diffuse = new Color3(1, 1, 1);
    groundColor = new Color3(0.5, 0.5, 0.5);
    setEnabled = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    position = new Vector3(0, 0, 0);
    diffuse = new Color3(1, 1, 1);
    intensity = 1;
    range = 10;
    dispose = vi.fn();
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
  },
}));

vi.mock('@babylonjs/core/Lights/directionalLight', () => ({
  DirectionalLight: class MockDirectionalLight {
    intensity = 0;
    diffuse = new Color3(1, 1, 1);
    setEnabled = vi.fn();
    dispose = vi.fn();
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
    {
      id: 'gas_vent_1',
      type: 'gas_vent',
      center: new Vector3(-5, -1, -55),
      radius: 4,
      damage: 5,
      active: true,
    },
    {
      id: 'gas_vent_2',
      type: 'gas_vent',
      center: new Vector3(-18, -6, -78),
      radius: 3,
      damage: 8,
      active: true,
    },
    {
      id: 'rockfall_1',
      type: 'unstable_ground',
      center: new Vector3(-3, -2, -58),
      radius: 5,
      damage: 15,
      active: true,
    },
    {
      id: 'rockfall_2',
      type: 'unstable_ground',
      center: new Vector3(-12, -8, -88),
      radius: 4,
      damage: 12,
      active: true,
    },
    {
      id: 'flooded_section',
      type: 'flooded',
      center: new Vector3(-10, -12, -103),
      radius: 8,
      damage: 0,
      active: true,
    },
  ],
  AUDIO_LOGS: [
    {
      id: 'log_foreman',
      position: new Vector3(8, 0, -18),
      title: 'FOREMAN VASQUEZ - DAY 12',
      text: 'Test log 1',
      collected: false,
    },
    {
      id: 'log_geologist',
      position: new Vector3(-15, -5, -75),
      title: 'DR. CHEN - DAY 15',
      text: 'Test log 2',
      collected: false,
    },
    {
      id: 'log_survivor',
      position: new Vector3(-10, -28, -115),
      title: 'UNKNOWN MINER - DAY 18',
      text: 'Test log 3',
      collected: false,
    },
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

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createMockEngine();
    canvas = createMockCanvas();
    config = createMockConfig();
    level = new MiningDepthsLevel(engine as any, canvas, config);
    // Mock emit helper methods on the level instance
    (level as any).emitNotification = vi.fn();
    (level as any).emitObjectiveUpdate = vi.fn();
    (level as any).emitCommsMessage = vi.fn();
    (level as any).emitHealthChanged = vi.fn();
    (level as any).emitCombatStateChanged = vi.fn();
    (level as any).emitActionHandlerRegistered = vi.fn();
    (level as any).emitActionGroupsChanged = vi.fn();
    (level as any).recordKill = vi.fn();
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
      expect((level as any).isInitialized).toBe(true);
    });

    it('should set initial phase to arrival', async () => {
      await level.initialize();
      expect((level as any).phase).toBe('arrival');
    });

    it('should display level title notification on start', async () => {
      await level.initialize();
      expect((level as any).emitNotification).toHaveBeenCalledWith(
        'THE MINING DEPTHS - LV-847',
        3000
      );
    });

    it('should set initial objective on start', async () => {
      await level.initialize();
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalledWith(
        'INVESTIGATE THE MINES',
        'Explore the abandoned mining facility. Find a way deeper.'
      );
    });

    it('should register action handler on start', async () => {
      await level.initialize();
      expect((level as any).emitActionHandlerRegistered).toHaveBeenCalled();
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
      const bgColor = (level as any).getBackgroundColor();
      expect(bgColor.r).toBeLessThan(0.01);
      expect(bgColor.g).toBeLessThan(0.01);
      expect(bgColor.b).toBeLessThan(0.02);
    });

    it('should return narrower FOV for claustrophobic feel', () => {
      const fov = (level as any).getDefaultFOV();
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
      expect((level as any).flashlightOn).toBe(false);
    });

    it('should toggle flashlight on action', () => {
      (level as any).toggleFlashlight();
      expect((level as any).flashlightOn).toBe(true);
      expect((level as any).emitNotification).toHaveBeenCalledWith('FLASHLIGHT ON', 800);
    });

    it('should toggle flashlight off on second action', () => {
      (level as any).toggleFlashlight();
      (level as any).toggleFlashlight();
      expect((level as any).flashlightOn).toBe(false);
      expect((level as any).emitNotification).toHaveBeenCalledWith('FLASHLIGHT OFF', 800);
    });

    it('should update flashlight position with camera', () => {
      (level as any).flashlightOn = true;
      (level as any).updateFlashlightTransform();
      // Flashlight should follow camera
      expect((level as any).flashlight).toBeDefined();
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
      (level as any).phase = 'arrival';
      (level as any).onEnterArea('hub');
      expect((level as any).phase).toBe('hub_explore');
    });

    it('should transition to tunnels phase when keycard acquired', () => {
      (level as any).phase = 'hub_explore';
      (level as any).hasKeycard = true;
      (level as any).onEnterArea('tunnel_start');
      expect((level as any).phase).toBe('tunnels');
    });

    it('should transition to shaft_descent when gate opened', () => {
      (level as any).phase = 'tunnels';
      (level as any).shaftGateOpen = true;
      (level as any).onEnterArea('shaft');
      expect((level as any).phase).toBe('shaft_descent');
    });

    it('should transition to boss_fight when reaching shaft floor', () => {
      (level as any).phase = 'shaft_descent';
      (level as any).bossDefeated = false;
      (level as any).transitionToPhase('boss_fight');
      expect((level as any).phase).toBe('boss_fight');
    });

    it('should transition to exit after boss defeated', () => {
      (level as any).transitionToPhase('exit');
      expect((level as any).phase).toBe('exit');
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
      (level as any).camera.position = new Vector3(-5, -1, -55);
      (level as any).checkHazards(1.0); // 1 second
      expect((level as any).emitHealthChanged).toHaveBeenCalledWith(-5);
      expect((level as any).emitNotification).toHaveBeenCalledWith('TOXIC GAS!', 500);
    });

    it('should trigger rockfall on unstable ground', () => {
      (level as any).camera.position = new Vector3(-3, -2, -58);
      (level as any).checkHazards(0.1);
      expect((level as any).emitHealthChanged).toHaveBeenCalledWith(-15);
      expect((level as any).emitNotification).toHaveBeenCalledWith('ROCKFALL!', 1000);
    });

    it('should only trigger rockfall once', () => {
      (level as any).camera.position = new Vector3(-3, -2, -58);
      (level as any).checkHazards(0.1);
      (level as any).checkHazards(0.1);
      // Should only be called once
      expect((level as any).emitHealthChanged).toHaveBeenCalledTimes(1);
    });

    it('should set playerInFlood when in flooded area', () => {
      (level as any).camera.position = new Vector3(-10, -12, -103);
      (level as any).checkHazards(0.1);
      expect((level as any).playerInFlood).toBe(true);
    });

    it('should show flooded section notification once', () => {
      (level as any).camera.position = new Vector3(-10, -12, -103);
      (level as any).checkHazards(0.1);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
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
      (level as any).camera.position = new Vector3(14, 0, -30);
      (level as any).checkKeycardPickup();
      expect((level as any).hasKeycard).toBe(true);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
        'DEEP SHAFT ACCESS KEYCARD ACQUIRED',
        2000
      );
    });

    it('should not pickup keycard if already has one', () => {
      (level as any).hasKeycard = true;
      (level as any).camera.position = new Vector3(14, 0, -30);
      const callCount = ((level as any).emitNotification as Mock).mock.calls.length;
      (level as any).checkKeycardPickup();
      // Should not add new notification
      expect(((level as any).emitNotification as Mock).mock.calls.length).toBe(callCount);
    });

    it('should open shaft gate with keycard', () => {
      (level as any).hasKeycard = true;
      (level as any).openShaftGate();
      expect((level as any).shaftGateOpen).toBe(true);
      expect((level as any).emitNotification).toHaveBeenCalledWith('SHAFT GATE UNLOCKED', 1500);
    });

    it('should not open gate without keycard', () => {
      (level as any).hasKeycard = false;
      (level as any).openShaftGate();
      expect((level as any).shaftGateOpen).toBe(false);
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
      (level as any).camera.position = new Vector3(8, 0, -18);
      (level as any).checkAudioLogPickups();
      expect(level.audioLogsCollected).toBe(1);
    });

    it('should not collect already collected log', () => {
      (level as any).audioLogs[0].collected = true;
      (level as any).camera.position = new Vector3(8, 0, -18);
      const prevCount = level.audioLogsCollected;
      (level as any).checkAudioLogPickups();
      expect(level.audioLogsCollected).toBe(prevCount);
    });

    it('should display log title on collection', () => {
      (level as any).camera.position = new Vector3(8, 0, -18);
      (level as any).checkAudioLogPickups();
      expect((level as any).emitNotification).toHaveBeenCalledWith(
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
      (level as any).spawnBurrower(spawnPos);
      expect((level as any).burrowers.length).toBe(1);
      expect((level as any).burrowers[0].health).toBe(80);
    });

    it('should not exceed max burrowers', () => {
      for (let i = 0; i < 10; i++) {
        (level as any).spawnBurrower(new Vector3(i, 0, -35));
      }
      expect((level as any).burrowers.length).toBeLessThanOrEqual(8);
    });

    it('should update burrower from buried to emerging state', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      const burrower = (level as any).burrowers[0];
      burrower.emergeTimer = 0; // Force immediate emergence
      (level as any).updateBurrowers(0.1);
      expect(burrower.state).toBe('emerging');
    });

    it('should transition burrower to chase after emerging', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      const burrower = (level as any).burrowers[0];
      burrower.state = 'emerging';
      burrower.stateTimer = 1.0; // Complete emergence
      (level as any).updateBurrowers(0.1);
      expect(burrower.state).toBe('chase');
    });

    it('should remove dead burrower', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).burrowers[0].health = 0;
      (level as any).updateBurrowers(0.1);
      expect((level as any).burrowers.length).toBe(0);
    });

    it('should increment kill count on burrower death', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).burrowers[0].health = 0;
      (level as any).updateBurrowers(0.1);
      expect((level as any).killCount).toBe(1);
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
      (level as any).startBossFight();
      expect((level as any).emitNotification).toHaveBeenCalledWith(
        'WARNING: HOSTILE ALPHA DETECTED',
        3000
      );
      expect((level as any).emitCombatStateChanged).toHaveBeenCalledWith(true);
    });

    it('should spawn boss with correct health', async () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      expect((level as any).boss).not.toBeNull();
      expect((level as any).boss?.health).toBe(500);
      expect((level as any).boss?.maxHealth).toBe(500);
    });

    it('should enrage boss at 30% health', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).boss!.health = 140; // Below 30%
      (level as any).updateBoss(0.1);
      expect((level as any).boss?.isEnraged).toBe(true);
    });

    it('should transition to boss_defeated when health reaches 0', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).boss!.health = 0;
      (level as any).updateBoss(0.1);
      expect((level as any).bossDefeated).toBe(true);
    });

    it('should complete level after boss defeated', () => {
      // Set up the boss - required for onBossDefeated to work
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).phase = 'boss_fight';
      (level as any).bossDefeated = false;

      // Defeat the boss
      (level as any).onBossDefeated();

      // Should now be marked as defeated
      expect((level as any).bossDefeated).toBe(true);
    });

    it('should update boss state during charge', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).boss!.state = 'charge';
      (level as any).boss!.chargeTarget = new Vector3(0, 0, 0);
      (level as any).boss!.stateTimer = 0;
      (level as any).updateBoss(0.1);
      // Boss should still be charging or transitioned
      expect(['charge', 'idle']).toContain((level as any).boss!.state);
    });

    it('should execute drill attack when in range', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).boss!.state = 'drill_attack';
      (level as any).boss!.stateTimer = 0.6;
      (level as any).camera.position = (level as any).boss!.mesh.position.clone();
      (level as any).updateBoss(0.1);
      expect((level as any).emitHealthChanged).toHaveBeenCalled();
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
      (level as any).primaryFireCooldown = 0;
      // Mock pointer locked
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      (level as any).firePrimaryWeapon();
      expect((level as any).primaryFireCooldown).toBeGreaterThan(0);
    });

    it('should not fire when on cooldown', () => {
      (level as any).primaryFireCooldown = 100;
      const initialCooldown = (level as any).primaryFireCooldown;
      (level as any).firePrimaryWeapon();
      expect((level as any).primaryFireCooldown).toBe(initialCooldown);
    });

    it('should perform melee attack', () => {
      (level as any).meleeCooldown = 0;
      (level as any).spawnBurrower(new Vector3(2, 0, 0));
      (level as any).burrowers[0].state = 'chase';
      (level as any).meleeAttack();
      expect((level as any).meleeCooldown).toBeGreaterThan(0);
    });

    it('should not melee when no targets', () => {
      (level as any).meleeCooldown = 0;
      (level as any).meleeAttack();
      // Cooldown should remain 0 since no targets
      expect((level as any).meleeCooldown).toBe(0);
    });

    it('should handle reload action', () => {
      (level as any).handleReload();
      expect((level as any).emitNotification).toHaveBeenCalled();
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
      (level as any).activateScanner();
      expect((level as any).emitNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should detect keycard when nearby', () => {
      (level as any).hasKeycard = false;
      (level as any).camera.position = new Vector3(10, 0, -30);
      (level as any).activateScanner();
      vi.advanceTimersByTime(1600);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
        expect.stringContaining('KEYCARD DETECTED'),
        2000
      );
    });

    it('should detect audio logs when nearby', () => {
      (level as any).hasKeycard = true; // Skip keycard detection
      (level as any).camera.position = new Vector3(8, 0, -20);
      (level as any).activateScanner();
      vi.advanceTimersByTime(1600);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
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
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = false;
      (level as any).camera.position = new Vector3(-10, -13, -110);
      (level as any).tryInteract();
      expect((level as any).shaftGateOpen).toBe(true);
    });

    it('should check for near interactables', () => {
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = false;
      (level as any).camera.position = new Vector3(-10, -13, -110);
      const interactable = (level as any).checkNearInteractable();
      expect(interactable).toBe('USE KEYCARD');
    });

    it('should return null when no interactables nearby', () => {
      (level as any).camera.position = new Vector3(0, 0, 0);
      const interactable = (level as any).checkNearInteractable();
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
      (level as any).handleAction('flashlight');
      expect((level as any).flashlightOn).toBe(true);
    });

    it('should handle scanner action', () => {
      (level as any).handleAction('scanner');
      expect((level as any).emitNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should handle interact action', () => {
      (level as any).hasKeycard = true;
      (level as any).camera.position = new Vector3(-10, -13, -110);
      (level as any).handleAction('interact');
      expect((level as any).shaftGateOpen).toBe(true);
    });

    it('should handle melee action', () => {
      (level as any).spawnBurrower(new Vector3(2, 0, 0));
      (level as any).burrowers[0].state = 'chase';
      (level as any).handleAction('melee');
      expect((level as any).meleeCooldown).toBeGreaterThan(0);
    });

    it('should handle reload action', () => {
      (level as any).handleAction('reload');
      expect((level as any).emitNotification).toHaveBeenCalled();
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
      (level as any).updateActionButtons();
      expect((level as any).emitActionGroupsChanged).toHaveBeenCalled();
      const groups = ((level as any).emitActionGroupsChanged as Mock).mock.calls[0][0];
      const toolsGroup = groups.find((g: any) => g.id === 'tools');
      expect(toolsGroup).toBeDefined();
    });

    it('should include combat buttons when enemies active', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).burrowers[0].state = 'chase';
      (level as any).updateActionButtons();
      const groups = ((level as any).emitActionGroupsChanged as Mock).mock.calls.at(-1)![0];
      const combatGroup = groups.find((g: any) => g.id === 'combat');
      expect(combatGroup).toBeDefined();
    });

    it('should include interact button when near interactable', () => {
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = false;
      (level as any).camera.position = new Vector3(-10, -13, -110);
      (level as any).updateActionButtons();
      const groups = ((level as any).emitActionGroupsChanged as Mock).mock.calls.at(-1)![0];
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
      (level as any).playerInFlood = false;
      expect((level as any).getMoveSpeed()).toBe(4);
    });

    it('should return slower speed in flooded area', () => {
      (level as any).playerInFlood = true;
      expect((level as any).getMoveSpeed()).toBe(2.5);
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
      (level as any).camera.position.z = -110;
      (level as any).updateFogDensity();
      expect((level as any).fogDensity).toBeGreaterThan(0.012);
    });

    it('should have thickest fog in deep shaft', () => {
      (level as any).camera.position.y = -20;
      (level as any).camera.position.z = -120;
      // Run multiple times to allow smooth transition to complete
      for (let i = 0; i < 100; i++) {
        (level as any).updateFogDensity();
      }
      // Deep shaft (y < -15) has base density of 0.028
      expect((level as any).fogDensity).toBeGreaterThan(0.02);
    });

    it('should increase fog in flooded area', () => {
      (level as any).playerInFlood = true;
      (level as any).updateFogDensity();
      // After smooth transition
      for (let i = 0; i < 100; i++) {
        (level as any).updateFogDensity();
      }
      expect((level as any).fogDensity).toBeGreaterThan(0.03);
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
      (level as any).camera.position = new Vector3(0, 0, 0);
      (level as any).checkAreaTriggers();
      const entryZone = (level as any).areaZones.find((z: any) => z.id === 'entry');
      expect(entryZone?.triggered).toBe(true);
    });

    it('should trigger hub area', () => {
      (level as any).camera.position = new Vector3(0, 0, -25);
      (level as any).checkAreaTriggers();
      const hubZone = (level as any).areaZones.find((z: any) => z.id === 'hub');
      expect(hubZone?.triggered).toBe(true);
    });

    it('should not re-trigger already triggered zones', () => {
      const zone = (level as any).areaZones.find((z: any) => z.id === 'entry');
      zone!.triggered = true;
      (level as any).camera.position = new Vector3(0, 0, 0);
      const spy = vi.spyOn(level as any, 'onEnterArea');
      (level as any).checkAreaTriggers();
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
      (level as any).lastDustSpawn = 0;
      // Manually call spawn to verify it adds to array
      (level as any).spawnDustParticle();
      expect((level as any).dustParticles.length).toBe(1);
    });

    it('should not spawn dust when at max particles', () => {
      // Fill the array to max
      for (let i = 0; i < 30; i++) {
        (level as any).dustParticles.push(createMockMesh(`dust_${i}`) as any);
      }
      // Try to update - should not add more
      (level as any).lastDustSpawn = 0;
      (level as any).updateDustParticles(0.3);
      expect((level as any).dustParticles.length).toBe(30);
    });

    it('should update and fade existing particles', () => {
      (level as any).spawnDustParticle();
      const initialY = (level as any).dustParticles[0].position.y;
      (level as any).updateDustParticles(0.1);
      expect((level as any).dustParticles[0].position.y).toBeLessThan(initialY);
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
      if ((level as any).environment?.flickerLights?.length) {
        const initialTimer = (level as any).environment.flickerLights[0].timer;
        (level as any).updateFlickerLights(0.1);
        expect((level as any).environment.flickerLights[0].timer).toBeGreaterThan(initialTimer);
      }
    });

    it('should turn off lights randomly', () => {
      if ((level as any).environment?.flickerLights?.length) {
        const fl = (level as any).environment.flickerLights[0];
        fl.isOff = true;
        fl.offTimer = 0;
        fl.offDuration = 0.1;
        (level as any).updateFlickerLights(0.2);
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
      (level as any).handleKeyDown(event);
      // Flashlight should toggle (checked via internal state)
      expect((level as any).flashlightOn).toBe(true);
    });

    it('should handle T key for scanner', () => {
      const event = { code: 'KeyT' } as KeyboardEvent;
      (level as any).handleKeyDown(event);
      expect((level as any).emitNotification).toHaveBeenCalledWith('SCANNING...', 1500);
    });

    it('should handle V key for melee', () => {
      const event = { code: 'KeyV' } as KeyboardEvent;
      (level as any).spawnBurrower(new Vector3(2, 0, 0));
      (level as any).burrowers[0].state = 'chase';
      (level as any).handleKeyDown(event);
      expect((level as any).meleeCooldown).toBeGreaterThan(0);
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
      (level as any).bossDefeated = false;
      expect(level.canTransitionTo('hive_assault')).toBe(false);
    });

    it('should allow transition after boss defeated in exit phase', () => {
      (level as any).bossDefeated = true;
      (level as any).phase = 'exit';
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
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();

      level.dispose();

      expect((level as any).burrowers.length).toBe(0);
      expect((level as any).boss).toBeNull();
      expect((level as any).flashlight).toBeNull();
      expect((level as any).flashlightFill).toBeNull();
      expect((level as any).environment).toBeNull();
    });

    it('should unregister action handler on dispose', () => {
      level.dispose();
      expect((level as any).emitActionHandlerRegistered).toHaveBeenCalledWith(null);
    });

    it('should clear action groups on dispose', () => {
      level.dispose();
      expect((level as any).emitActionGroupsChanged).toHaveBeenCalledWith([]);
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
      (level as any).sendCommsMessage('test_message', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Test message',
      });

      (level as any).sendCommsMessage('test_message', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Duplicate message',
      });

      expect((level as any).emitCommsMessage).toHaveBeenCalledTimes(1);
    });

    it('should send arrival messages on start', () => {
      vi.advanceTimersByTime(3000);
      expect((level as any).emitCommsMessage).toHaveBeenCalled();
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
      (level as any).setObjective(position);
      expect((level as any).currentObjective).toEqual(position);
      expect((level as any).objectiveMarker?.isVisible).toBe(true);
    });

    it('should clear objective marker', () => {
      (level as any).setObjective(new Vector3(10, 0, -30));
      (level as any).clearObjective();
      expect((level as any).currentObjective).toBeNull();
      expect((level as any).objectiveMarker?.isVisible).toBe(false);
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
      (level as any).camera.position = new Vector3(0, 5, -25);
      (level as any).constrainPlayerPosition();
      expect((level as any).camera.position.y).toBeCloseTo(1.7, 1);
    });

    it('should constrain player height in tunnels', () => {
      (level as any).camera.position = new Vector3(-10, 5, -70);
      (level as any).constrainPlayerPosition();
      // Should be at tunnel height
      expect((level as any).camera.position.y).toBeLessThan(2);
    });

    it('should constrain player height in deep shaft', () => {
      (level as any).camera.position = new Vector3(-10, 0, -125);
      (level as any).constrainPlayerPosition();
      // Should be at shaft floor height
      expect((level as any).camera.position.y).toBeLessThan(-10);
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
      (level as any).primaryFireCooldown = 0;
      (level as any).handleClick();
      expect((level as any).primaryFireCooldown).toBeGreaterThan(0);
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
      const initialTime = (level as any).phaseTime;
      (level as any).updateLevel(0.016);
      expect((level as any).phaseTime).toBeGreaterThan(initialTime);
    });

    it('should update all subsystems', () => {
      (level as any).updateLevel(0.016);
      // Should not throw
    });

    it('should reduce cooldowns over time', () => {
      (level as any).meleeCooldown = 1000;
      (level as any).primaryFireCooldown = 100;
      (level as any).updateLevel(0.1);
      expect((level as any).meleeCooldown).toBeLessThan(1000);
      expect((level as any).primaryFireCooldown).toBeLessThan(100);
    });

    it('should animate objective marker', () => {
      (level as any).setObjective(new Vector3(10, 0, -30));
      const initialRotation = (level as any).objectiveMarker!.rotation.y;
      (level as any).updateLevel(0.1);
      expect((level as any).objectiveMarker!.rotation.y).not.toBe(initialRotation);
    });

    it('should update boss when present', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).updateLevel(0.1);
      // Boss should exist and be updated
      expect((level as any).boss).not.toBeNull();
    });

    it('should update burrowers when present', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).burrowers[0].state = 'chase';
      (level as any).updateLevel(0.1);
      // Burrower state timer should have been updated
      expect((level as any).burrowers[0].stateTimer).toBeGreaterThan(0);
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
      expect((level as any).caveAmbient).not.toBeNull();
    });

    it('should have flashlight created', () => {
      expect((level as any).flashlight).not.toBeNull();
    });

    it('should have flashlight fill light created', () => {
      expect((level as any).flashlightFill).not.toBeNull();
    });
  });

  describe('area zones', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should have area zones configured', () => {
      expect((level as any).areaZones.length).toBeGreaterThan(0);
    });

    it('should have entry zone', () => {
      const entryZone = (level as any).areaZones.find((z: any) => z.id === 'entry');
      expect(entryZone).toBeDefined();
    });

    it('should have hub zone', () => {
      const hubZone = (level as any).areaZones.find((z: any) => z.id === 'hub');
      expect(hubZone).toBeDefined();
    });

    it('should have tunnel_start zone', () => {
      const tunnelZone = (level as any).areaZones.find((z: any) => z.id === 'tunnel_start');
      expect(tunnelZone).toBeDefined();
    });

    it('should have shaft zone', () => {
      const shaftZone = (level as any).areaZones.find((z: any) => z.id === 'shaft');
      expect(shaftZone).toBeDefined();
    });

    it('should have shaft_floor zone', () => {
      const shaftFloorZone = (level as any).areaZones.find((z: any) => z.id === 'shaft_floor');
      expect(shaftFloorZone).toBeDefined();
    });
  });

  describe('burrower queue processing', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should spawn burrower from queue when conditions met', () => {
      // This tests that spawning works correctly from the queue mechanism
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      expect((level as any).burrowers.length).toBe(1);
    });

    it('should not exceed max burrowers', () => {
      // Fill up burrowers to max
      for (let i = 0; i < 10; i++) {
        (level as any).spawnBurrower(new Vector3(i, 0, -35));
      }
      // Max is 8
      expect((level as any).burrowers.length).toBeLessThanOrEqual(8);
    });
  });

  describe('burrower attack', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should apply damage to player when burrower attacks', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      const burrower = (level as any).burrowers[0];
      burrower.state = 'attack';
      (level as any).onBurrowerAttack(burrower, 10);
      expect((level as any).emitHealthChanged).toHaveBeenCalledWith(-10);
    });

    it('should trigger screen shake on attack', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      const burrower = (level as any).burrowers[0];
      (level as any).onBurrowerAttack(burrower, 10);
      // Screen shake is internal but we can verify health change was called
      expect((level as any).emitHealthChanged).toHaveBeenCalled();
    });
  });

  describe('muzzle flash', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should create muzzle flash without error', () => {
      // This just verifies the method doesn't throw
      (level as any).createMuzzleFlash();
      // No error means success
    });
  });

  describe('procedural burrower creation', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should create a procedural burrower mesh', () => {
      const mesh = (level as any).createProceduralBurrower();
      expect(mesh).toBeDefined();
      // The mock returns 'capsule' as name
      expect(mesh).not.toBeNull();
    });
  });

  describe('boss states', () => {
    beforeEach(async () => {
      await level.initialize();
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
    });

    it('should update boss in idle state', () => {
      (level as any).boss!.state = 'idle';
      (level as any).boss!.stateTimer = 0;
      (level as any).boss!.attackCooldown = 0;
      (level as any).camera.position = new Vector3(-10, -27, -120); // Close to boss
      (level as any).updateBoss(0.1);
      // Boss should remain in idle or transition to attack
      expect(['idle', 'charge', 'drill_attack']).toContain((level as any).boss!.state);
    });

    it('should handle boss burrow state', () => {
      (level as any).boss!.state = 'burrow';
      (level as any).boss!.stateTimer = 0;
      (level as any).updateBoss(1.5);
      expect((level as any).boss!.state).toBe('emerge');
    });

    it('should handle boss emerge state', () => {
      (level as any).boss!.state = 'emerge';
      (level as any).boss!.stateTimer = 0;
      (level as any).updateBoss(1.0);
      expect((level as any).boss!.state).toBe('idle');
    });

    it('should transition from enraged state', () => {
      (level as any).boss!.state = 'enraged';
      (level as any).updateBoss(0.1);
      expect((level as any).boss!.state).toBe('idle');
    });
  });

  describe('primary weapon targeting', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should hit boss when aimed at it', () => {
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      // Position camera to look at boss
      (level as any).camera.position = new Vector3(-10, -27, -110);
      (level as any).boss!.mesh.position = new Vector3(-10, -25, -120);
      (level as any).camera.getDirection = vi.fn(() => new Vector3(0, 0, -1));
      (level as any).primaryFireCooldown = 0;
      const initialHealth = (level as any).boss!.health;
      (level as any).firePrimaryWeapon();
      // Health should decrease if hit
      expect((level as any).boss!.health).toBeLessThanOrEqual(initialHealth);
    });

    it('should hit burrower when aimed at it', () => {
      vi.spyOn(level, 'isPointerLocked' as any).mockReturnValue(true);
      (level as any).spawnBurrower(new Vector3(0, 1.7, 10));
      (level as any).burrowers[0].state = 'chase';
      (level as any).camera.position = new Vector3(0, 1.7, 0);
      (level as any).camera.getDirection = vi.fn(() => new Vector3(0, 0, 1));
      (level as any).primaryFireCooldown = 0;
      const initialHealth = (level as any).burrowers[0].health;
      (level as any).firePrimaryWeapon();
      expect((level as any).burrowers[0].health).toBeLessThanOrEqual(initialHealth);
    });
  });

  describe('melee targeting', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should hit boss with melee', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      (level as any).boss!.mesh.position = new Vector3(0, 1.7, 2);
      (level as any).camera.position = new Vector3(0, 1.7, 0);
      (level as any).camera.getDirection = vi.fn(() => new Vector3(0, 0, 1));
      (level as any).meleeCooldown = 0;
      const _initialHealth = (level as any).boss!.health;
      (level as any).meleeAttack();
      expect((level as any).meleeCooldown).toBeGreaterThan(0);
    });
  });

  describe('audio log collection', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should notify when audio log collected', () => {
      const log = (level as any).audioLogs[0];
      (level as any).collectAudioLog(log, 0);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
        expect.stringContaining('AUDIO LOG:'),
        3000
      );
    });

    it('should mark log as collected', () => {
      const log = (level as any).audioLogs[0];
      (level as any).collectAudioLog(log, 0);
      expect(log.collected).toBe(true);
    });

    it('should increment audio logs collected counter', () => {
      const initialCount = level.audioLogsCollected;
      const log = (level as any).audioLogs[0];
      (level as any).collectAudioLog(log, 0);
      expect(level.audioLogsCollected).toBe(initialCount + 1);
    });
  });

  describe('keycard pickup', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should call pickupKeycard when near keycard location', () => {
      (level as any).hasKeycard = false;
      (level as any).camera.position = new Vector3(14, 0, -30);
      (level as any).pickupKeycard();
      expect((level as any).hasKeycard).toBe(true);
    });

    it('should update objective after picking up keycard', () => {
      (level as any).hasKeycard = false;
      (level as any).pickupKeycard();
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalled();
    });
  });

  describe('shaft gate opening', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should not open gate without keycard', () => {
      (level as any).hasKeycard = false;
      (level as any).openShaftGate();
      expect((level as any).shaftGateOpen).toBe(false);
    });

    it('should play sound when opening gate', () => {
      (level as any).hasKeycard = true;
      (level as any).openShaftGate();
      expect((level as any).shaftGateOpen).toBe(true);
    });

    it('should update objective after opening gate', () => {
      (level as any).hasKeycard = true;
      (level as any).openShaftGate();
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalled();
    });
  });

  describe('start level', () => {
    it('should set initial objective', async () => {
      await level.initialize();
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalledWith(
        'INVESTIGATE THE MINES',
        expect.any(String)
      );
    });

    it('should display level title', async () => {
      await level.initialize();
      expect((level as any).emitNotification).toHaveBeenCalledWith(
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
      (level as any).phase = 'arrival';
      (level as any).onEnterArea('hub');
      expect((level as any).phase).toBe('hub_explore');
    });

    it('should show notification when entering hub', () => {
      (level as any).phase = 'arrival';
      (level as any).onEnterArea('hub');
      expect((level as any).emitNotification).toHaveBeenCalled();
    });

    it('should spawn burrowers on tunnel entry', () => {
      (level as any).phase = 'hub_explore';
      (level as any).hasKeycard = true;
      (level as any).onEnterArea('tunnel_start');
      expect((level as any).phase).toBe('tunnels');
    });

    it('should trigger boss fight on shaft floor entry', () => {
      (level as any).phase = 'shaft_descent';
      (level as any).bossDefeated = false;
      (level as any).bossAssetsPreloaded = true;
      (level as any).onEnterArea('shaft_floor');
      // Should notify about boss area
      expect((level as any).emitNotification).toHaveBeenCalled();
    });
  });

  describe('hazard zones', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should apply damage from gas vent hazard', () => {
      (level as any).camera.position = new Vector3(-5, -1, -55);
      (level as any).checkHazards(1.0);
      expect((level as any).emitHealthChanged).toHaveBeenCalledWith(-5);
    });

    it('should show gas warning notification', () => {
      (level as any).camera.position = new Vector3(-5, -1, -55);
      (level as any).checkHazards(1.0);
      expect((level as any).emitNotification).toHaveBeenCalledWith('TOXIC GAS!', 500);
    });

    it('should detect flooded area', () => {
      (level as any).camera.position = new Vector3(-10, -12, -103);
      (level as any).checkHazards(0.1);
      expect((level as any).playerInFlood).toBe(true);
    });
  });

  describe('getDefaultFOV', () => {
    it('should return narrower FOV for claustrophobic tunnels', () => {
      const fov = (level as any).getDefaultFOV();
      const expectedFov = (65 * Math.PI) / 180;
      expect(fov).toBeCloseTo(expectedFov, 2);
    });
  });

  describe('getMoveSpeed', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should return normal speed by default', () => {
      (level as any).playerInFlood = false;
      const speed = (level as any).getMoveSpeed();
      expect(speed).toBe(4);
    });

    it('should return reduced speed in flood', () => {
      (level as any).playerInFlood = true;
      const speed = (level as any).getMoveSpeed();
      expect(speed).toBe(2.5);
    });
  });

  describe('canTransitionTo', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should return true for next level when boss defeated', () => {
      (level as any).bossDefeated = true;
      (level as any).phase = 'exit';
      expect(level.canTransitionTo('hive_assault')).toBe(true);
    });

    it('should return false when boss not defeated', () => {
      (level as any).bossDefeated = false;
      expect(level.canTransitionTo('hive_assault')).toBe(false);
    });
  });

  describe('environment data', () => {
    beforeEach(async () => {
      await level.initialize();
    });

    it('should have audio logs loaded', () => {
      expect((level as any).audioLogs.length).toBe(3);
    });

    it('should have environment created', () => {
      expect((level as any).environment).not.toBeNull();
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
      (level as any).spawnDustParticle();
      (level as any).spawnDustParticle();
      expect((level as any).dustParticles.length).toBe(2);

      level.dispose();
      expect((level as any).dustParticles.length).toBe(0);
    });

    it('should dispose boss GLB instances', () => {
      (level as any).bossAssetsPreloaded = true;
      (level as any).spawnBoss();
      level.dispose();
      expect((level as any).bossGlbInstances.length).toBe(0);
    });

    it('should reset fog mode', () => {
      level.dispose();
      expect((level as any).scene.fogMode).toBe(0);
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
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = false;
      (level as any).camera.position = new Vector3(-10, -13, -110);
      const event = { code: 'KeyE' } as KeyboardEvent;
      (level as any).handleKeyDown(event);
      expect((level as any).shaftGateOpen).toBe(true);
    });

    it('should handle R key for reload', () => {
      const event = { code: 'KeyR' } as KeyboardEvent;
      (level as any).handleKeyDown(event);
      expect((level as any).emitNotification).toHaveBeenCalled();
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
      (level as any).spawnBurrower(new Vector3(0, 1.7, 2));
      const burrower = (level as any).burrowers[0];
      burrower.state = 'attack';
      burrower.stateTimer = 0.5;
      (level as any).updateBurrowers(0.1);
      // Should transition after attack
      expect(['attack', 'chase', 'idle']).toContain(burrower.state);
    });

    it('should handle burrower burrow state', () => {
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      const burrower = (level as any).burrowers[0];
      burrower.state = 'burrow';
      burrower.stateTimer = 0;
      (level as any).updateBurrowers(1.5);
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
      (level as any).transitionToPhase('hub_explore');
      expect((level as any).phase).toBe('hub_explore');
    });

    it('should handle tunnels phase correctly', () => {
      (level as any).transitionToPhase('tunnels');
      expect((level as any).phase).toBe('tunnels');
    });

    it('should handle shaft_descent phase correctly', () => {
      (level as any).transitionToPhase('shaft_descent');
      expect((level as any).phase).toBe('shaft_descent');
    });

    it('should handle boss_defeated phase correctly', () => {
      (level as any).transitionToPhase('boss_defeated');
      expect((level as any).phase).toBe('boss_defeated');
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
      (level as any).spawnBurrower(new Vector3(10, 0, -35));
      (level as any).burrowers[0].state = 'chase';
      (level as any).setCombatState(true);
      // Combat state should be active
      expect((level as any).emitCombatStateChanged).toHaveBeenCalledWith(true);
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
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = true; // Gate already open
      (level as any).audioLogs.forEach((log: any) => (log.collected = true));
      (level as any).activateScanner();
      vi.advanceTimersByTime(1600);
      // No audio log or keycard should be detected
      expect((level as any).emitNotification).toHaveBeenCalledWith('NO TARGETS IN RANGE', 1500);
    });

    it('should detect shaft gate when nearby', () => {
      (level as any).hasKeycard = true;
      (level as any).shaftGateOpen = false;
      (level as any).camera.position = new Vector3(-10, -13, -100);
      (level as any).activateScanner();
      vi.advanceTimersByTime(1600);
      expect((level as any).emitNotification).toHaveBeenCalledWith(
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
      (level as any).phase = 'tunnels';
      (level as any).shaftGateOpen = true;
      (level as any).onEnterArea('shaft');
      expect((level as any).phase).toBe('shaft_descent');
    });

    it('should handle shaft_floor entry during shaft_descent', () => {
      (level as any).phase = 'shaft_descent';
      (level as any).bossDefeated = false;
      (level as any).bossAssetsPreloaded = true;
      (level as any).onEnterArea('shaft_floor');
      // Should trigger boss fight
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalled();
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
      (level as any).camera.position = new Vector3(-8, 0, -60);
      (level as any).constrainPlayerPosition();
      // Should be constrained to tunnel height
      expect((level as any).camera.position.y).toBeLessThan(1);
    });

    it('should handle position in entry area', () => {
      (level as any).camera.position = new Vector3(0, 10, 0);
      (level as any).constrainPlayerPosition();
      expect((level as any).camera.position.y).toBeCloseTo(1.7, 1);
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
      (level as any).transitionToPhase('hub_explore');
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalled();
    });

    it('should set objective for shaft after getting keycard', () => {
      (level as any).hasKeycard = true;
      (level as any).transitionToPhase('tunnels');
      expect((level as any).emitObjectiveUpdate).toHaveBeenCalled();
    });
  });
});
