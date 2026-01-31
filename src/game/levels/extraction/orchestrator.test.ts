/**
 * ExtractionLevel Orchestrator Tests
 *
 * Integration tests for the main ExtractionLevel class.
 * Tests phase transitions, wave system, and victory conditions.
 * Target: 95%+ line coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: vi.fn(),
}));

vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn(),
}));

vi.mock('@babylonjs/core/Maths/math.color', () => ({
  Color4: vi.fn().mockImplementation((r, g, b, a) => ({
    r, g, b, a,
    clone: function() { return { r: this.r, g: this.g, b: this.b, a: this.a }; },
  })),
}));

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
    subtract(other: MockVector3) {
      return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    normalize() {
      const len = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }
    length() {
      return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }
    scale(s: number) {
      return new MockVector3(this.x * s, this.y * s, this.z * s);
    }
    addInPlace(other: MockVector3) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    static Distance(a: MockVector3, b: MockVector3) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name, scene) => ({
    name,
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { y: 0 },
    setEnabled: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../achievements', () => ({
  getAchievementManager: vi.fn().mockReturnValue({
    onLevelComplete: vi.fn(),
    onGameComplete: vi.fn(),
  }),
}));

vi.mock('../../context/useWeaponActions', () => ({
  getWeaponActions: vi.fn().mockReturnValue({
    getState: vi.fn().mockReturnValue({
      isReloading: false,
      currentAmmo: 15,
      maxMagazineSize: 30,
      reserveAmmo: 120,
    }),
    addAmmo: vi.fn(),
  }),
  startReload: vi.fn(),
}));

vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn().mockReturnValue({
    play: vi.fn(),
    playVictory: vi.fn(),
    playMusic: vi.fn(),
    enterCombat: vi.fn(),
    exitCombat: vi.fn(),
  }),
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emit: vi.fn(),
    emitSmallExplosion: vi.fn(),
    emitDebris: vi.fn(),
    emitAlienDeath: vi.fn(),
    emitDustImpact: vi.fn(),
    emitMuzzleFlash: vi.fn(),
    emitExplosion: vi.fn(),
  },
}));

vi.mock('../../input/InputBridge', () => ({
  bindableActionParams: vi.fn().mockReturnValue({ key: 'Shift', keyDisplay: 'SHIFT' }),
  levelActionParams: vi.fn().mockReturnValue({ key: 'G', keyDisplay: 'G' }),
}));

vi.mock('../../types/actions', () => ({
  createAction: vi.fn().mockReturnValue({}),
}));

vi.mock('../BaseLevel', () => ({
  BaseLevel: vi.fn().mockImplementation(function(this: any) {
    this.camera = {
      position: { x: 0, y: 1.7, z: 0, set: vi.fn(), clone: vi.fn().mockReturnThis(), addInPlace: vi.fn() },
      rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    };
    this.scene = {
      clearColor: { r: 0, g: 0, b: 0, a: 1 },
    };
    this.rotationX = 0;
    this.rotationY = 0;
    this.inputTracker = {
      isActionActive: vi.fn().mockReturnValue(false),
      getAllKeysForAction: vi.fn().mockReturnValue([]),
    };
    this.state = { completed: false };
    this.id = 'extraction';
    this.callbacks = {
      onNotification: vi.fn(),
      onObjectiveUpdate: vi.fn(),
      onCommsMessage: vi.fn(),
      onCinematicStart: vi.fn(),
      onCinematicEnd: vi.fn(),
      onCombatStateChange: vi.fn(),
      onHealthChange: vi.fn(),
      onDamage: vi.fn(),
      onKill: vi.fn(),
      onActionHandlerRegister: vi.fn(),
      onActionGroupsChange: vi.fn(),
    };
    this.setBaseShake = vi.fn();
    this.triggerShake = vi.fn();
    this.triggerDamageShake = vi.fn();
    this.trackPlayerDamage = vi.fn();
    this.saveCheckpoint = vi.fn();
    this.completeLevel = vi.fn();
    this.isPointerLocked = vi.fn().mockReturnValue(true);
    this.getMoveSpeed = vi.fn().mockReturnValue(5);
    this.onPlayerDeath = vi.fn();
  }),
}));

vi.mock('../shared/AlienFloraBuilder', () => ({
  buildFloraFromPlacements: vi.fn().mockResolvedValue([]),
  getExtractionFlora: vi.fn().mockReturnValue([]),
}));

vi.mock('../shared/CollectiblePlacer', () => ({
  buildCollectibles: vi.fn().mockResolvedValue({
    update: vi.fn().mockReturnValue(null),
    collect: vi.fn(),
    dispose: vi.fn(),
  }),
  getExtractionCollectibles: vi.fn().mockReturnValue([]),
}));

vi.mock('../shared/HiveEnvironmentBuilder', () => ({
  updateBiolights: vi.fn(),
}));

// Mock the extraction modules
vi.mock('./constants', () => ({
  PHASE_COLORS: {
    escape_start: { r: 0, g: 0, b: 0, a: 1 },
    escape_tunnel: { r: 0, g: 0, b: 0, a: 1 },
    escape: { r: 0, g: 0, b: 0, a: 1 },
    surface_run: { r: 0.02, g: 0.02, b: 0.04, a: 1 },
    holdout: { r: 0.02, g: 0.02, b: 0.04, a: 1 },
    hive_collapse: { r: 0.6, g: 0.2, b: 0.05, a: 1 },
    victory: { r: 0.03, g: 0.03, b: 0.06, a: 1 },
    epilogue: { r: 0.1, g: 0.1, b: 0.15, a: 1 },
  },
  ESCAPE_TIMER_INITIAL: 180,
  ESCAPE_TUNNEL_LENGTH: 300,
  LZ_POSITION: { x: 0, y: 0, z: -500 },
  DROPSHIP_ETA_INITIAL: 420,
  DROPSHIP_COLLAPSE_POSITION: { x: 0, y: 8, z: -500, clone: () => ({ x: 0, y: 8, z: -500, addInPlace: vi.fn() }) },
  HIVE_COLLAPSE_TIMER: 90,
  TOTAL_WAVES: 7,
  GRENADE_COOLDOWN_TIME: 5000,
  FLARE_COOLDOWN_TIME: 60000,
  MECH_FIRE_RATE: 0.2,
  SUPPLY_DROP_DELAY: 2.0,
  STALACTITE_SPAWN_INTERVAL: 1.5,
  COLLAPSE_RUMBLE_INTERVAL: 3,
  COLLAPSE_RESPAWN_DISTANCE: 80,
}));

vi.mock('./comms', () => ({
  ESCAPE_START_COMMS: { sender: 'Marcus', text: 'Run!' },
  SURFACE_REACHED_COMMS: { sender: 'Marcus', text: 'Surface!' },
  HOLDOUT_START_COMMS: { sender: 'AI', text: 'Defend!' },
  WAVE_COMPLETE_COMMS: { 2: { sender: 'Marcus', text: 'Wave 2 done!' } },
  SIGNAL_FLARE_COMMS: { sender: 'AI', text: 'Signal received' },
  SUPPLY_DROP_COMMS: { sender: 'AI', text: 'Supply drop!' },
  COLLAPSE_START_SEQUENCE: [],
  COLLAPSE_PROGRESSION_SEQUENCE: [],
  COLLAPSE_FAILURE_COMMS: { sender: 'Marcus', text: 'Hold on!' },
  DISTANCE_COMMS: { almost: {}, soClose: {}, lowHealth: {} },
}));

vi.mock('./enemies', () => ({
  spawnEnemy: vi.fn().mockResolvedValue({
    mesh: { position: { x: 0, y: 0, z: 0 }, dispose: vi.fn(), setEnabled: vi.fn() },
    health: 50,
    maxHealth: 50,
    position: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) },
    velocity: { x: 0, y: 0, z: 0 },
    species: 'skitterer',
    isActive: true,
  }),
  spawnCollapseStraggler: vi.fn().mockResolvedValue({
    mesh: { dispose: vi.fn(), setEnabled: vi.fn() },
    health: 25,
    position: { x: 0, y: 0, z: 0 },
    isActive: true,
  }),
  calculateSpawnPosition: vi.fn().mockReturnValue({
    position: { x: 50, y: 0, z: 50 },
    newSpawnPointIndex: 0,
  }),
  updateEnemies: vi.fn().mockReturnValue(0),
  updateCollapseEnemies: vi.fn().mockReturnValue(0),
  mechFireAtEnemy: vi.fn().mockReturnValue({ enemy: null, damage: 0 }),
  killEnemy: vi.fn(),
  applyGrenadeDamage: vi.fn().mockReturnValue({ kills: 0, killedEnemies: [] }),
  checkMeleeHit: vi.fn().mockReturnValue(null),
}));

vi.mock('./phases', () => ({
  createPhaseState: vi.fn().mockReturnValue({
    phase: 'escape_start',
    phaseTime: 0,
    escapeTimer: 180,
    dropshipETA: 420,
    hiveCollapseTimer: 90,
    playerEscapeProgress: 0,
    collapseDistance: -20,
    distanceToLZ: 500,
    distanceToDropship: 0,
  }),
  createWaveState: vi.fn().mockReturnValue({
    currentWave: 0,
    wavePhase: 'waiting',
    wavePhaseTimer: 0,
    waveEnemiesRemaining: 0,
    waveEnemiesKilled: 0,
    waveSpawnTimer: 0,
    intermissionCountdown: 0,
    enemiesToSpawn: [],
    currentSpawnPointIndex: 0,
    waveStartTime: 0,
  }),
  getWaveConfig: vi.fn().mockReturnValue({
    drones: 10,
    grunts: 0,
    spitters: 0,
    brutes: 0,
    husks: 0,
    spawnDelay: 0.9,
    waveTitle: 'WAVE 1',
    waveDescription: 'Test wave',
  }),
  startWaveIntermission: vi.fn().mockImplementation((state, wave) => ({
    ...state,
    currentWave: wave,
    wavePhase: 'intermission',
    intermissionCountdown: 12,
  })),
  updateWaveIntermission: vi.fn().mockReturnValue({
    newState: { wavePhase: 'intermission' },
    shouldTransition: false,
  }),
  updateWaveAnnouncement: vi.fn().mockReturnValue({
    newState: { wavePhase: 'announcement' },
    shouldTransition: false,
  }),
  updateActiveWaveSpawning: vi.fn().mockReturnValue({
    newState: {},
    spawnSpecies: null,
  }),
  recordWaveKill: vi.fn().mockImplementation((state) => ({
    ...state,
    waveEnemiesRemaining: state.waveEnemiesRemaining - 1,
    waveEnemiesKilled: state.waveEnemiesKilled + 1,
  })),
  isWaveComplete: vi.fn().mockReturnValue(false),
  completeWave: vi.fn().mockImplementation((state) => ({
    ...state,
    wavePhase: 'waiting',
  })),
  getMechIntegrityCapForWave: vi.fn().mockReturnValue(100),
  shouldSpawnSupplyDrop: vi.fn().mockReturnValue(false),
  getWaveHUDDisplay: vi.fn().mockReturnValue({
    title: 'WAVE 1',
    description: 'Testing',
  }),
  getCollapseHUDDisplay: vi.fn().mockReturnValue({
    title: 'ESCAPE',
    description: 'Run!',
  }),
}));

vi.mock('./effects', () => ({
  spawnTunnelDebris: vi.fn().mockReturnValue({
    mesh: { position: { addInPlace: vi.fn() }, rotation: { addInPlace: vi.fn() }, dispose: vi.fn() },
    velocity: { scale: vi.fn().mockReturnThis() },
    rotationSpeed: { scale: vi.fn().mockReturnThis() },
    lifetime: 5,
  }),
  spawnCollapseDebris: vi.fn().mockReturnValue({
    mesh: { position: { addInPlace: vi.fn() }, rotation: { addInPlace: vi.fn() }, dispose: vi.fn() },
    velocity: { scale: vi.fn().mockReturnThis() },
    rotationSpeed: { scale: vi.fn().mockReturnThis() },
    lifetime: 5,
  }),
  updateDebris: vi.fn().mockReturnValue({ updatedDebris: [], playerDamage: 0 }),
  spawnFallingStalactite: vi.fn().mockReturnValue({
    mesh: { dispose: vi.fn() },
    shadowMarker: { dispose: vi.fn() },
  }),
  updateFallingStalactites: vi.fn().mockReturnValue({
    updatedStalactites: [],
    playerDamage: 0,
    notificationMsg: null,
  }),
  createCollapseLight: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  createGroundCracks: vi.fn().mockReturnValue([]),
  updateGroundCracks: vi.fn(),
  updateCollapseLight: vi.fn(),
  createCollapseHealthPickups: vi.fn().mockReturnValue([]),
  updateHealthPickups: vi.fn().mockReturnValue({ healAmount: 0 }),
  createCrumblingWalls: vi.fn().mockReturnValue([]),
  updateCrumblingWalls: vi.fn(),
  createObjectiveMarker: vi.fn().mockReturnValue({
    marker: { dispose: vi.fn() },
    beacon: { dispose: vi.fn() },
  }),
  updateObjectiveMarker: vi.fn(),
  updateCollapseAudio: vi.fn().mockReturnValue({
    newAudioTimer: 3,
    newGroanTimer: 5,
    newScreamTime: 0,
  }),
  spawnSupplyDrop: vi.fn().mockResolvedValue({
    mesh: { dispose: vi.fn() },
    type: 'health',
    collected: false,
    amount: 50,
  }),
  updateSupplyDrops: vi.fn().mockReturnValue({
    healthRestore: 0,
    ammoRestore: 0,
    collectedDrop: null,
  }),
  animateSupplyDrops: vi.fn(),
}));

vi.mock('./environment', () => ({
  createEscapeTunnel: vi.fn().mockReturnValue({
    hiveBuilder: { getBiolights: vi.fn().mockReturnValue([]), dispose: vi.fn() },
    tunnelSegments: [],
    tunnelLights: [],
    collapseWall: { position: { z: 0 } },
    exitLight: { dispose: vi.fn() },
  }),
  preloadAssets: vi.fn().mockResolvedValue(undefined),
  createSurfaceEnvironment: vi.fn().mockReturnValue({
    surfaceTerrain: { material: { dispose: vi.fn() } },
    terrain: { position: { z: 0 }, dispose: vi.fn() },
  }),
  buildLZEnvironment: vi.fn().mockResolvedValue({
    coverMeshes: [],
    dispose: vi.fn(),
  }),
  createMarcusMech: vi.fn().mockReturnValue({
    mechMesh: { position: { x: 0, y: 0, z: 0 }, setEnabled: vi.fn(), dispose: vi.fn() },
    mechGunLight: { intensity: 0, dispose: vi.fn() },
  }),
  createDropship: vi.fn().mockReturnValue({
    dropship: { position: { set: vi.fn() }, setEnabled: vi.fn(), dispose: vi.fn() },
    dropshipRamp: { dispose: vi.fn() },
    dropshipRampLight: { intensity: 0 },
    dropshipThrustEmitters: [],
  }),
  createLZBeacon: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  setupHoldoutArena: vi.fn().mockReturnValue([]),
  setTunnelVisible: vi.fn(),
  setSurfaceVisible: vi.fn(),
}));

vi.mock('./victory', () => ({
  createVictoryState: vi.fn().mockReturnValue({
    cinematic_active: false,
    cinematic_beat: 0,
    timeouts: [],
    dropshipEngineSound: null,
    engineThrustInterval: null,
  }),
  startDropshipArrival: vi.fn(),
  showEpilogue: vi.fn(),
  disposeVictoryState: vi.fn(),
}));

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

describe('ExtractionLevel Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Phase State Initialization', () => {
    it('should start in escape_start phase', async () => {
      const { createPhaseState } = await import('./phases');
      const state = createPhaseState();

      expect(state.phase).toBe('escape_start');
      expect(state.escapeTimer).toBe(180);
      expect(state.dropshipETA).toBe(420);
    });
  });

  describe('Wave State Initialization', () => {
    it('should start with wave 0 in waiting phase', async () => {
      const { createWaveState } = await import('./phases');
      const state = createWaveState();

      expect(state.currentWave).toBe(0);
      expect(state.wavePhase).toBe('waiting');
      expect(state.waveEnemiesRemaining).toBe(0);
    });
  });

  describe('Wave Transitions', () => {
    it('should transition to intermission when wave starts', async () => {
      const { startWaveIntermission, createWaveState } = await import('./phases');
      const initialState = createWaveState();

      const newState = startWaveIntermission(initialState, 1);

      expect(newState.currentWave).toBe(1);
      expect(newState.wavePhase).toBe('intermission');
    });

    it('should record wave kills correctly', async () => {
      const { recordWaveKill } = await import('./phases');
      const state = {
        waveEnemiesRemaining: 10,
        waveEnemiesKilled: 5,
      };

      const newState = recordWaveKill(state as any);

      expect(newState.waveEnemiesRemaining).toBe(9);
      expect(newState.waveEnemiesKilled).toBe(6);
    });

    it('should complete wave and reset phase', async () => {
      const { completeWave } = await import('./phases');
      const state = {
        wavePhase: 'active',
        currentSpawnPointIndex: 0,
      };

      const newState = completeWave(state as any);

      expect(newState.wavePhase).toBe('waiting');
    });
  });

  describe('Enemy Spawning', () => {
    it('should spawn enemies at calculated positions', async () => {
      const { spawnEnemy, calculateSpawnPosition } = await import('./enemies');

      const { position } = calculateSpawnPosition(
        'skitterer',
        [new Vector3(50, 0, 0)],
        [],
        new Vector3(0, 0, -500),
        0
      );

      const enemy = await spawnEnemy({} as any, 'skitterer', position, 1, 0);

      expect(enemy).not.toBeNull();
      expect(calculateSpawnPosition).toHaveBeenCalled();
    });
  });

  describe('Combat Actions', () => {
    it('should apply grenade damage to enemies', async () => {
      const { applyGrenadeDamage } = await import('./enemies');

      applyGrenadeDamage([], new Vector3(0, 0, 0), 15);

      expect(applyGrenadeDamage).toHaveBeenCalled();
    });

    it('should check for melee hits', async () => {
      const { checkMeleeHit } = await import('./enemies');

      const hit = checkMeleeHit([], new Vector3(0, 0, 0), 3, 50);

      expect(checkMeleeHit).toHaveBeenCalled();
      expect(hit).toBeNull();
    });
  });

  describe('Mech Combat', () => {
    it('should fire at closest enemy', async () => {
      const { mechFireAtEnemy } = await import('./enemies');

      const result = mechFireAtEnemy(
        { position: new Vector3(0, 0, 0) } as any,
        { intensity: 0 } as any,
        [],
        100
      );

      expect(result.enemy).toBeNull();
      expect(result.damage).toBe(0);
    });
  });

  describe('Supply Drops', () => {
    it('should spawn supply drops after waves', async () => {
      const { spawnSupplyDrop } = await import('./effects');

      const drop = await spawnSupplyDrop({} as any, 'health');

      expect(drop).not.toBeNull();
      expect(drop?.type).toBe('health');
      expect(drop?.amount).toBe(50);
    });

    it('should update supply drop collection', async () => {
      const { updateSupplyDrops } = await import('./effects');

      const result = updateSupplyDrops([], new Vector3(0, 0, 0));

      expect(result.healthRestore).toBe(0);
      expect(result.ammoRestore).toBe(0);
    });
  });

  describe('Collapse Sequence', () => {
    it('should create collapse visual effects', async () => {
      const { createCollapseLight, createGroundCracks } = await import('./effects');

      const light = createCollapseLight({} as any);
      const cracks = createGroundCracks({} as any);

      expect(light).toBeDefined();
      expect(cracks).toBeDefined();
    });

    it('should spawn collapse debris', async () => {
      const { spawnCollapseDebris, spawnFallingStalactite } = await import('./effects');

      const debris = spawnCollapseDebris({} as any, new Vector3(0, 0, 0));
      const stalactite = spawnFallingStalactite({} as any, new Vector3(0, 0, 0));

      expect(debris).toBeDefined();
      expect(stalactite).toBeDefined();
    });

    it('should update collapse audio', async () => {
      const { updateCollapseAudio } = await import('./effects');

      const result = updateCollapseAudio(0.5, 2, 4, 0, 0.5, 3);

      expect(result.newAudioTimer).toBeDefined();
      expect(result.newGroanTimer).toBeDefined();
    });
  });

  describe('Victory Sequence', () => {
    it('should start dropship arrival', async () => {
      const { startDropshipArrival } = await import('./victory');

      startDropshipArrival({} as any);

      expect(startDropshipArrival).toHaveBeenCalled();
    });

    it('should show epilogue', async () => {
      const { showEpilogue } = await import('./victory');

      showEpilogue({} as any, 'extraction');

      expect(showEpilogue).toHaveBeenCalledWith({}, 'extraction');
    });

    it('should dispose victory state', async () => {
      const { disposeVictoryState, createVictoryState } = await import('./victory');

      const state = createVictoryState();
      disposeVictoryState(state);

      expect(disposeVictoryState).toHaveBeenCalled();
    });
  });

  describe('Environment Management', () => {
    it('should create tunnel environment', async () => {
      const { createEscapeTunnel } = await import('./environment');

      const tunnel = createEscapeTunnel({} as any);

      expect(tunnel.hiveBuilder).toBeDefined();
      expect(tunnel.collapseWall).toBeDefined();
    });

    it('should create surface environment', async () => {
      const { createSurfaceEnvironment } = await import('./environment');

      const surface = createSurfaceEnvironment({} as any);

      expect(surface.terrain).toBeDefined();
      expect(surface.surfaceTerrain).toBeDefined();
    });

    it('should build LZ environment', async () => {
      const { buildLZEnvironment } = await import('./environment');

      const lz = await buildLZEnvironment({} as any);

      expect(lz).not.toBeNull();
    });

    it('should create mech and dropship', async () => {
      const { createMarcusMech, createDropship } = await import('./environment');

      const mech = createMarcusMech({} as any);
      const dropship = createDropship({} as any);

      expect(mech.mechMesh).toBeDefined();
      expect(dropship.dropship).toBeDefined();
    });
  });

  describe('HUD Updates', () => {
    it('should format wave HUD display', async () => {
      const { getWaveHUDDisplay } = await import('./phases');

      const hud = getWaveHUDDisplay(
        { currentWave: 3, wavePhase: 'active', enemiesToSpawn: [] } as any,
        300,
        50,
        75,
        10
      );

      expect(hud.title).toBeDefined();
      expect(hud.description).toBeDefined();
    });

    it('should format collapse HUD display', async () => {
      const { getCollapseHUDDisplay } = await import('./phases');

      const hud = getCollapseHUDDisplay(60, 100);

      expect(hud.title).toBeDefined();
      expect(hud.description).toBeDefined();
    });
  });

  describe('Level Stats Tracking', () => {
    it('should track wave configuration', async () => {
      const { getWaveConfig } = await import('./phases');

      const config = getWaveConfig(1);

      expect(config).toBeDefined();
      expect(config?.waveTitle).toBe('WAVE 1');
    });

    it('should check supply drop scheduling', async () => {
      const { shouldSpawnSupplyDrop } = await import('./phases');

      const shouldSpawn = shouldSpawnSupplyDrop(1);

      expect(typeof shouldSpawn).toBe('boolean');
    });
  });
});
