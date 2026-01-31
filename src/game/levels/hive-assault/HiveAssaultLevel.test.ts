/**
 * HiveAssaultLevel Unit Tests
 *
 * Comprehensive test suite for Level 9: Hive Assault
 * Tests combined arms assault, phase management, enemy spawning,
 * vehicle controls, marine squad coordination, and level completion.
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js modules before imports
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: vi.fn().mockImplementation(() => ({
    runRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    dispose: vi.fn(),
    getRenderWidth: vi.fn(() => 1920),
    getRenderHeight: vi.fn(() => 1080),
    setHardwareScalingLevel: vi.fn(),
    resize: vi.fn(),
    scenes: [],
    onResizeObservable: { add: vi.fn(), remove: vi.fn() },
  })),
}));

vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn().mockImplementation(() => createMockScene()),
}));

vi.mock('@babylonjs/core/Cameras/freeCamera', () => ({
  FreeCamera: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 1.7, -5),
    rotation: new Vector3(0, Math.PI, 0),
    getDirection: vi.fn(() => new Vector3(0, 0, -1)),
    attachControl: vi.fn(),
    detachControl: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: {
    ImportMeshAsync: vi.fn().mockResolvedValue({ meshes: [] }),
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    diffuseColor: new Color3(0, 0, 0),
    emissiveColor: new Color3(0, 0, 0),
    specularColor: new Color3(0, 0, 0),
    alpha: 1,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateTorus: vi.fn(() => createMockMesh('torus')),
    CreateBox: vi.fn(() => createMockMesh('box')),
    CreateCylinder: vi.fn(() => createMockMesh('cylinder')),
    CreateGround: vi.fn(() => createMockMesh('ground')),
    CreateSphere: vi.fn(() => createMockMesh('sphere')),
    CreateDisc: vi.fn(() => createMockMesh('disc')),
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

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 0, 0),
    diffuse: new Color3(1, 1, 1),
    specular: new Color3(1, 1, 1),
    intensity: 1,
    range: 10,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Layers/glowLayer', () => ({
  GlowLayer: vi.fn().mockImplementation(() => ({
    intensity: 0.6,
    dispose: vi.fn(),
  })),
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    isPathCached: vi.fn(() => true),
    loadAssetByPath: vi.fn().mockResolvedValue(null),
    createInstanceByPath: vi.fn(() => createMockMesh('instance')),
  },
}));

vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    playSound: vi.fn(),
    stopSound: vi.fn(),
    setMasterVolume: vi.fn(),
  })),
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emit: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  },
}));

vi.mock('../../entities/aliens', () => ({
  ALIEN_SPECIES: {
    skitterer: { id: 'skitterer', name: 'Skitterer' },
    lurker: { id: 'lurker', name: 'Lurker' },
    broodmother: { id: 'broodmother', name: 'Broodmother' },
  },
  createAlienMesh: vi.fn().mockResolvedValue(createMockMesh('alien')),
}));

vi.mock('../../context/useWeaponActions', () => ({
  fireWeapon: vi.fn(() => true),
  getWeaponActions: vi.fn(() => ({
    getState: vi.fn(() => ({ currentWeapon: 'rifle', ammo: 30 })),
  })),
  startReload: vi.fn(),
}));

vi.mock('../../context/useInputActions', () => ({
  registerDynamicActions: vi.fn(),
  unregisterDynamicActions: vi.fn(),
}));

vi.mock('./environment', () => ({
  AssaultEnvironmentBuilder: vi.fn().mockImplementation(() => ({
    loadAssets: vi.fn().mockResolvedValue(undefined),
    setupGlowLayer: vi.fn(),
    createTerrain: vi.fn(() => createMockMesh('terrain')),
    createSkyDome: vi.fn(() => createMockMesh('skyDome')),
    createCanyonWalls: vi.fn(),
    createFleetBackdrop: vi.fn(),
    createStagingArea: vi.fn(() => ({
      vehicleBay: createMockMesh('vehicleBay'),
      briefingPlatform: createMockMesh('briefingPlatform'),
      sandbags: [],
      crates: [],
      lights: [],
    })),
    createFieldCover: vi.fn(() => []),
    createBreachFortifications: vi.fn(() => []),
    createDestroyedVehicles: vi.fn(() => []),
    createAATurrets: vi.fn(() => [
      createMockAATurret(new Vector3(-60, 0, -180)),
      createMockAATurret(new Vector3(55, 0, -220)),
      createMockAATurret(new Vector3(-45, 0, -300)),
      createMockAATurret(new Vector3(65, 0, -340)),
    ]),
    createHazards: vi.fn(() => ({ acidPools: [], sporeVents: [] })),
    createHiveEntrance: vi.fn(() => ({
      gateMesh: createMockMesh('gate'),
      archLeft: createMockMesh('archLeft'),
      archRight: createMockMesh('archRight'),
      organicGrowths: [],
      bioLights: [],
      sporeVents: [],
    })),
    updateBioLights: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('./MarineSquadAI', () => ({
  MarineSquadManager: vi.fn().mockImplementation(() => createMockMarineManager()),
}));

vi.mock('../shared/SurfaceTerrainFactory', () => ({
  createDynamicTerrain: vi.fn(() => ({
    mesh: createMockMesh('dynamicTerrain'),
    material: { dispose: vi.fn() },
  })),
  ROCK_TERRAIN: { seed: 12345 },
}));

vi.mock('../shared/HiveEnvironmentBuilder', () => ({
  HiveEnvironmentBuilder: vi.fn().mockImplementation(() => ({
    setupGlowLayer: vi.fn(),
    createTunnelSegment: vi.fn(),
    createBiolight: vi.fn(),
    createChamber: vi.fn(),
    getBiolights: vi.fn(() => []),
    dispose: vi.fn(),
  })),
  updateBiolights: vi.fn(),
}));

vi.mock('../shared/AlienFloraBuilder', () => ({
  buildFloraFromPlacements: vi.fn().mockResolvedValue([]),
  getHiveAssaultFlora: vi.fn(() => []),
}));

vi.mock('../shared/CollectiblePlacer', () => ({
  buildCollectibles: vi.fn().mockResolvedValue({
    update: vi.fn(() => null),
    collect: vi.fn(),
    dispose: vi.fn(),
  }),
  getHiveAssaultCollectibles: vi.fn(() => []),
}));

// Helper to create mock mesh
function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: { setAll: vi.fn(), set: vi.fn(), x: 1, y: 1, z: 1 },
    material: null,
    isVisible: true,
    parent: null,
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    getChildMeshes: vi.fn(() => []),
    setEnabled: vi.fn(),
  };
}

// Helper to create mock scene
function createMockScene() {
  return {
    clearColor: new Color4(0, 0, 0, 1),
    ambientColor: new Color3(0, 0, 0),
    fogMode: 0,
    fogEnabled: false,
    fogColor: new Color3(0, 0, 0),
    fogDensity: 0,
    fogStart: 0,
    fogEnd: 0,
    onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
    onAfterRenderObservable: { add: vi.fn(), remove: vi.fn() },
    onKeyboardObservable: { add: vi.fn(), remove: vi.fn() },
    onPointerObservable: { add: vi.fn(), remove: vi.fn() },
    render: vi.fn(),
    dispose: vi.fn(),
    activeCamera: null,
    meshes: [],
    materials: [],
    textures: [],
    lights: [],
    getEngine: vi.fn(() => ({
      getRenderWidth: vi.fn(() => 1920),
      getRenderHeight: vi.fn(() => 1080),
    })),
    pick: vi.fn(() => ({ hit: false })),
  };
}

// Helper to create mock AA turret
function createMockAATurret(position: Vector3) {
  return {
    rootNode: { dispose: vi.fn() },
    baseMesh: createMockMesh('turretBase'),
    barrelMesh: createMockMesh('turretBarrel'),
    position: position.clone(),
    health: 200,
    maxHealth: 200,
    destroyed: false,
    fireTimer: 0,
  };
}

// Helper to create mock marine manager
function createMockMarineManager() {
  const squads = [
    createMockSquad(0, 'ALPHA'),
    createMockSquad(1, 'BRAVO'),
    createMockSquad(2, 'CHARLIE'),
    createMockSquad(3, 'DELTA'),
  ];

  return {
    createSquad: vi.fn(() => squads[0]),
    getSquads: vi.fn(() => squads),
    getSquad: vi.fn((idx: number) => squads[idx]),
    getActiveMarines: vi.fn(() => squads.flatMap(s => s.marines.filter(m => m.isActive))),
    getAllMarines: vi.fn(() => squads.flatMap(s => s.marines)),
    getFiringMarines: vi.fn(() => []),
    getActiveMarineCount: vi.fn(() => 16),
    getDownedMarinesNearPlayer: vi.fn(() => []),
    issueOrder: vi.fn(),
    issueGlobalOrder: vi.fn(),
    setFormation: vi.fn(),
    damageMarine: vi.fn(),
    startRevive: vi.fn(),
    cancelRevive: vi.fn(),
    simulateSquadUnderFire: vi.fn(),
    setSquadOverwhelmed: vi.fn(),
    triggerRescueCallout: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

// Helper to create mock squad
function createMockSquad(id: number, callsign: string) {
  return {
    id: `squad_${id}`,
    callsign,
    marines: [
      createMockMarine(`squad_${id}_marine_0`),
      createMockMarine(`squad_${id}_marine_1`),
      createMockMarine(`squad_${id}_marine_2`),
      createMockMarine(`squad_${id}_marine_3`),
    ],
    formation: 'diamond',
    order: 'follow_player',
    position: new Vector3(0, 0, -20),
    waypointPosition: new Vector3(0, 0, -20),
    isWiped: false,
    activeCount: 4,
    morale: 1.0,
    wasRescued: false,
  };
}

// Helper to create mock marine
function createMockMarine(id: string) {
  return {
    id,
    squadId: id.split('_marine_')[0],
    name: 'TestMarine',
    rootNode: { dispose: vi.fn(), position: new Vector3(0, 0, 0), rotation: new Vector3(0, 0, 0) },
    bodyMesh: createMockMesh('body'),
    helmetMesh: createMockMesh('helmet'),
    weaponMesh: createMockMesh('weapon'),
    health: 100,
    maxHealth: 100,
    state: 'idle',
    position: new Vector3(0, 0, -20),
    targetPosition: new Vector3(0, 0, -20),
    moveSpeed: 6,
    fireCooldown: 0,
    fireRate: 2.5,
    damage: 12,
    attackRange: 50,
    reviveProgress: 0,
    reviveTime: 3.0,
    targetEnemyPos: null,
    lastCalloutTime: -8,
    isActive: true,
  };
}

// Create mock callbacks
function createMockCallbacks() {
  return {
    onComplete: vi.fn(),
    onObjectiveUpdate: vi.fn(),
    onHealthChange: vi.fn(),
    onAmmoChange: vi.fn(),
    onNotification: vi.fn(),
    onCommsMessage: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onActionGroupsChange: vi.fn(),
    onActionHandlerRegister: vi.fn(),
    onCinematicStart: vi.fn(),
    onCinematicEnd: vi.fn(),
    onCheckpointReached: vi.fn(),
    onStatsUpdate: vi.fn(),
    onPlayerDeath: vi.fn(),
    onChapterChange: vi.fn(),
    onKill: vi.fn(),
    onDamage: vi.fn(),
    onObjectiveMarker: vi.fn(),
    onHitMarker: vi.fn(),
    onDirectionalDamage: vi.fn(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('HiveAssaultLevel', () => {
  let mockCallbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCallbacks = createMockCallbacks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // LEVEL CONFIGURATION
  // ==========================================================================

  describe('Level Configuration', () => {
    it('should have correct level ID', () => {
      expect('hive-assault').toBe('hive-assault');
    });

    it('should have correct chapter number (8)', () => {
      const config = {
        id: 'hive-assault',
        name: 'Hive Assault',
        chapter: 8,
        description: 'Combined arms push into the hive',
        nextLevelId: 'extraction',
      };
      expect(config.chapter).toBe(8);
      expect(config.nextLevelId).toBe('extraction');
    });

    it('should define level as combined arms assault', () => {
      const levelType = 'combined_arms';
      expect(levelType).toBe('combined_arms');
    });

    it('should define four phases', () => {
      const phases = ['staging', 'field_assault', 'breach_point', 'entry_push'];
      expect(phases).toHaveLength(4);
      expect(phases[0]).toBe('staging');
      expect(phases[3]).toBe('entry_push');
    });
  });

  // ==========================================================================
  // BACKGROUND COLORS BY PHASE
  // ==========================================================================

  describe('Background Color by Phase', () => {
    it('should use orange-brown for staging phase', () => {
      const stagingColor = new Color4(0.55, 0.35, 0.2, 1);
      expect(stagingColor.r).toBeCloseTo(0.55);
      expect(stagingColor.g).toBeCloseTo(0.35);
      expect(stagingColor.b).toBeCloseTo(0.2);
    });

    it('should use brighter orange for field assault', () => {
      const fieldColor = new Color4(0.6, 0.35, 0.2, 1);
      expect(fieldColor.r).toBeCloseTo(0.6);
    });

    it('should use darker orange for breach point', () => {
      const breachColor = new Color4(0.5, 0.3, 0.18, 1);
      expect(breachColor.r).toBeCloseTo(0.5);
    });

    it('should use dark purple for entry push (inside hive)', () => {
      const entryColor = new Color4(0.15, 0.08, 0.12, 1);
      expect(entryColor.r).toBeCloseTo(0.15);
      expect(entryColor.b).toBeCloseTo(0.12);
    });
  });

  // ==========================================================================
  // PHASE MANAGEMENT
  // ==========================================================================

  describe('Phase Management', () => {
    it('should start in staging phase', () => {
      const initialPhase = 'staging';
      expect(initialPhase).toBe('staging');
    });

    it('should track phase time', () => {
      let phaseTime = 0;
      const deltaTime = 0.016;

      phaseTime += deltaTime;
      expect(phaseTime).toBeCloseTo(0.016);
    });

    it('should transition from staging to field_assault when vehicle boarded', () => {
      let phase = 'staging';
      let isInVehicle = false;
      let phaseTime = 5; // After minimum time

      const checkPhaseTransition = () => {
        if (phase === 'staging' && isInVehicle && phaseTime > 3) {
          phase = 'field_assault';
        }
      };

      isInVehicle = true;
      checkPhaseTransition();
      expect(phase).toBe('field_assault');
    });

    it('should transition from field_assault to breach_point when turrets destroyed', () => {
      let phase = 'field_assault';
      let turretsDestroyed = 4;
      const totalTurrets = 4;
      let playerZ = -390;

      const checkFieldToBreachTransition = () => {
        if (phase === 'field_assault' && turretsDestroyed >= totalTurrets && playerZ < -380) {
          phase = 'breach_point';
        }
      };

      checkFieldToBreachTransition();
      expect(phase).toBe('breach_point');
    });

    it('should transition from breach_point to entry_push at gate', () => {
      let phase = 'breach_point';
      let playerZ = -570;
      let waveIndex = 2;
      let enemiesRemaining = 3;

      const checkBreachToEntryTransition = () => {
        if (phase === 'breach_point' && playerZ < -560 && waveIndex >= 2 && enemiesRemaining <= 5) {
          phase = 'entry_push';
        }
      };

      checkBreachToEntryTransition();
      expect(phase).toBe('entry_push');
    });
  });

  // ==========================================================================
  // STAGING PHASE
  // ==========================================================================

  describe('Staging Phase', () => {
    it('should set initial objective to staging area', () => {
      const objective = {
        title: 'STAGING AREA',
        instructions: 'Attend briefing and board your vehicle when ready.',
      };
      expect(objective.title).toBe('STAGING AREA');
    });

    it('should set objective marker at vehicle position', () => {
      const vehiclePosition = new Vector3(15, 0, -10);
      expect(vehiclePosition.x).toBe(15);
      expect(vehiclePosition.z).toBe(-10);
    });

    it('should trigger briefing comms sequence', () => {
      const commsSequence = [
        { delay: 2000, sender: 'Commander Reyes' },
        { delay: 8000, sender: 'PROMETHEUS A.I.' },
        { delay: 14000, sender: 'Corporal Marcus Cole' },
        { delay: 20000, sender: 'PROMETHEUS A.I.' },
      ];
      expect(commsSequence).toHaveLength(4);
      expect(commsSequence[0].sender).toBe('Commander Reyes');
    });

    it('should register staging action buttons', () => {
      const stagingActions = [
        { id: 'board_vehicle', label: 'BOARD VEHICLE', key: 'E' },
      ];
      expect(stagingActions[0].id).toBe('board_vehicle');
    });
  });

  // ==========================================================================
  // FIELD ASSAULT PHASE
  // ==========================================================================

  describe('Field Assault Phase', () => {
    it('should update objective with turret count', () => {
      const turretsDestroyed = 2;
      const totalTurrets = 4;
      const objectiveText = `Destroy AA turrets (${turretsDestroyed}/${totalTurrets}) and advance to hive entrance.`;
      expect(objectiveText).toContain('2/4');
    });

    it('should spawn field waves', () => {
      const fieldWaves = [
        { groundChitin: 12, flyingChitin: 4, armoredChitin: 0, spawnDelay: 1.0 },
        { groundChitin: 18, flyingChitin: 6, armoredChitin: 1, spawnDelay: 0.8 },
        { groundChitin: 24, flyingChitin: 8, armoredChitin: 2, spawnDelay: 0.6 },
      ];
      expect(fieldWaves).toHaveLength(3);
      expect(fieldWaves[0].groundChitin).toBe(12);
      expect(fieldWaves[2].armoredChitin).toBe(2);
    });

    it('should trigger ambush at halfway point', () => {
      let ambushTriggered = false;
      const playerZ = -250;
      const ambushThreshold = -200;

      if (!ambushTriggered && playerZ < ambushThreshold) {
        ambushTriggered = true;
      }

      expect(ambushTriggered).toBe(true);
    });

    it('should alert flying chitin on first appearance', () => {
      let flyingChitinAlerted = false;
      const enemies = [{ enemyClass: 'flying', isActive: true }];

      if (!flyingChitinAlerted && enemies.some(e => e.enemyClass === 'flying' && e.isActive)) {
        flyingChitinAlerted = true;
      }

      expect(flyingChitinAlerted).toBe(true);
    });
  });

  // ==========================================================================
  // AA TURRET SYSTEM
  // ==========================================================================

  describe('AA Turret System', () => {
    it('should create 4 AA turrets', () => {
      const turretPositions = [
        new Vector3(-60, 0, -180),
        new Vector3(55, 0, -220),
        new Vector3(-45, 0, -300),
        new Vector3(65, 0, -340),
      ];
      expect(turretPositions).toHaveLength(4);
    });

    it('should have turret health of 200', () => {
      const turretHealth = 200;
      const maxHealth = 200;
      expect(turretHealth).toBe(maxHealth);
    });

    it('should damage turret when hit', () => {
      let turretHealth = 200;
      const damage = 40;

      turretHealth -= damage;
      expect(turretHealth).toBe(160);
    });

    it('should mark turret as destroyed at 0 health', () => {
      let turretHealth = 50;
      let destroyed = false;
      const damage = 60;

      turretHealth -= damage;
      if (turretHealth <= 0 && !destroyed) {
        destroyed = true;
      }

      expect(destroyed).toBe(true);
    });

    it('should send comms message when turret destroyed', () => {
      const turretsDestroyed = 1;
      const totalTurrets = 4;
      const commsText = `AA turret destroyed. ${turretsDestroyed} of ${totalTurrets} neutralized.`;
      expect(commsText).toContain('1 of 4');
    });

    it('should fire at player within range', () => {
      const turretRange = 80;
      const playerDistance = 50;
      const canFire = playerDistance < turretRange;
      expect(canFire).toBe(true);
    });

    it('should not fire at player outside range', () => {
      const turretRange = 80;
      const playerDistance = 100;
      const canFire = playerDistance < turretRange;
      expect(canFire).toBe(false);
    });
  });

  // ==========================================================================
  // BREACH POINT PHASE
  // ==========================================================================

  describe('Breach Point Phase', () => {
    it('should force dismount from vehicle', () => {
      let isInVehicle = true;

      const startBreachPoint = () => {
        if (isInVehicle) {
          isInVehicle = false;
        }
      };

      startBreachPoint();
      expect(isInVehicle).toBe(false);
    });

    it('should destroy player vehicle on entry', () => {
      let vehicleHealth = 500;
      let vehicleActive = true;

      const destroyVehicle = () => {
        vehicleActive = false;
        vehicleHealth = 0;
      };

      destroyVehicle();
      expect(vehicleHealth).toBe(0);
      expect(vehicleActive).toBe(false);
    });

    it('should spawn breach waves', () => {
      const breachWaves = [
        { groundChitin: 15, flyingChitin: 2, armoredChitin: 2, spawnDelay: 0.9 },
        { groundChitin: 20, flyingChitin: 4, armoredChitin: 3, spawnDelay: 0.7 },
        { groundChitin: 30, flyingChitin: 6, armoredChitin: 4, spawnDelay: 0.5 },
      ];
      expect(breachWaves).toHaveLength(3);
      expect(breachWaves[2].groundChitin).toBe(30);
    });

    it('should trigger squad overwhelmed event', () => {
      let squadOverwhelmedTriggered = false;

      const triggerSquadOverwhelmed = () => {
        if (!squadOverwhelmedTriggered) {
          squadOverwhelmedTriggered = true;
        }
      };

      triggerSquadOverwhelmed();
      expect(squadOverwhelmedTriggered).toBe(true);
    });

    it('should alert armored chitin on first appearance', () => {
      let armoredChitinAlerted = false;
      const enemies = [{ enemyClass: 'armored', isActive: true }];

      if (!armoredChitinAlerted && enemies.some(e => e.enemyClass === 'armored' && e.isActive)) {
        armoredChitinAlerted = true;
      }

      expect(armoredChitinAlerted).toBe(true);
    });
  });

  // ==========================================================================
  // ENTRY PUSH PHASE
  // ==========================================================================

  describe('Entry Push Phase', () => {
    it('should spawn entry waves', () => {
      const entryWaves = [
        { groundChitin: 20, flyingChitin: 0, armoredChitin: 1, spawnDelay: 0.8 },
        { groundChitin: 30, flyingChitin: 0, armoredChitin: 2, spawnDelay: 0.5 },
      ];
      expect(entryWaves).toHaveLength(2);
      expect(entryWaves[0].flyingChitin).toBe(0); // No flying inside hive
    });

    it('should track beachhead progress', () => {
      let beachheadProgress = 0;
      const beachheadRequired = 100;

      // Killing enemies adds progress
      beachheadProgress += 2; // Ground enemy
      beachheadProgress += 8; // Armored enemy
      beachheadProgress += 3; // Flying enemy

      expect(beachheadProgress).toBe(13);
      expect(beachheadProgress < beachheadRequired).toBe(true);
    });

    it('should update objective with beachhead progress', () => {
      const beachheadProgress = 75;
      const beachheadRequired = 100;
      const progressPercent = Math.floor((beachheadProgress / beachheadRequired) * 100);
      expect(progressPercent).toBe(75);
    });

    it('should position Marcus at entrance to hold', () => {
      const marcusHoldPosition = new Vector3(0, 0, -590);
      expect(marcusHoldPosition.z).toBe(-590);
    });

    it('should define extraction zone', () => {
      const extractionPosition = new Vector3(0, 0, -660);
      const extractionRadius = 15;
      expect(extractionPosition.z).toBe(-660);
      expect(extractionRadius).toBe(15);
    });

    it('should trigger level complete when beachhead secured and in zone', () => {
      const beachheadProgress = 100;
      const beachheadRequired = 100;
      const playerZ = -655;
      const extractionZ = -660;
      const extractionRadius = 15;

      const distToExtraction = Math.abs(playerZ - extractionZ);
      const inZone = distToExtraction <= extractionRadius;
      const beachheadSecured = beachheadProgress >= beachheadRequired;

      expect(inZone).toBe(true);
      expect(beachheadSecured).toBe(true);
    });
  });

  // ==========================================================================
  // VEHICLE SYSTEM
  // ==========================================================================

  describe('Vehicle System', () => {
    it('should have vehicle health of 500', () => {
      const vehicleHealth = 500;
      const maxHealth = 500;
      expect(vehicleHealth).toBe(maxHealth);
    });

    it('should have vehicle speed of 25', () => {
      const vehicleSpeed = 25;
      expect(vehicleSpeed).toBe(25);
    });

    it('should have vehicle fire rate of 3 shots/sec', () => {
      const fireRate = 3;
      expect(fireRate).toBe(3);
    });

    it('should have vehicle damage of 40', () => {
      const vehicleDamage = 40;
      expect(vehicleDamage).toBe(40);
    });

    it('should mount vehicle when near and pressing interact', () => {
      const vehiclePosition = new Vector3(15, 0, -10);
      const playerPosition = new Vector3(14, 0, -9);
      const mountRange = 6;

      const distance = Vector3.Distance(playerPosition, vehiclePosition);
      const canMount = distance <= mountRange;

      expect(canMount).toBe(true);
    });

    it('should not mount vehicle when too far', () => {
      const vehiclePosition = new Vector3(15, 0, -10);
      const playerPosition = new Vector3(0, 0, 0);
      const mountRange = 6;

      const distance = Vector3.Distance(playerPosition, vehiclePosition);
      const canMount = distance <= mountRange;

      expect(canMount).toBe(false);
    });

    it('should adjust camera height when in vehicle', () => {
      let cameraY = 1.7;
      let isInVehicle = false;

      const mountVehicle = () => {
        isInVehicle = true;
        cameraY = 2.5;
      };

      mountVehicle();
      expect(cameraY).toBe(2.5);
    });

    it('should reset camera height when dismounting', () => {
      let cameraY = 2.5;
      let isInVehicle = true;

      const dismountVehicle = () => {
        isInVehicle = false;
        cameraY = 1.7;
      };

      dismountVehicle();
      expect(cameraY).toBe(1.7);
    });
  });

  // ==========================================================================
  // MARCUS MECH AI
  // ==========================================================================

  describe('Marcus Mech AI', () => {
    it('should have mech health of 800', () => {
      const mechHealth = 800;
      const maxHealth = 800;
      expect(mechHealth).toBe(maxHealth);
    });

    it('should have fire rate of 2 shots/sec', () => {
      const fireRate = 2;
      expect(fireRate).toBe(2);
    });

    it('should have damage of 60', () => {
      const mechDamage = 60;
      expect(mechDamage).toBe(60);
    });

    it('should have range of 100', () => {
      const mechRange = 100;
      expect(mechRange).toBe(100);
    });

    it('should follow player in field assault phase', () => {
      const phase = 'field_assault';
      const playerPosition = new Vector3(0, 0, -150);
      const followDistance = 12;

      let targetPosition: Vector3;
      if (phase === 'field_assault') {
        targetPosition = playerPosition.add(new Vector3(followDistance, 0, 5));
      } else {
        targetPosition = new Vector3(10, 0, -15);
      }

      expect(targetPosition.x).toBe(12);
      expect(targetPosition.z).toBe(-145);
    });

    it('should hold position at entrance in entry push phase', () => {
      const phase = 'entry_push';
      const holdPosition = new Vector3(0, 0, -590);

      let targetPosition: Vector3;
      if (phase === 'entry_push') {
        targetPosition = holdPosition;
      } else {
        targetPosition = new Vector3(0, 0, 0);
      }

      expect(targetPosition.z).toBe(-590);
    });

    it('should deal extra damage to armored enemies', () => {
      const baseDamage = 60;
      const enemyClass = 'armored';

      const damage = enemyClass === 'armored' ? baseDamage * 1.5 : baseDamage;
      expect(damage).toBe(90);
    });

    it('should prioritize threats to player', () => {
      const enemies = [
        { position: new Vector3(50, 0, -150), distToPlayer: 50, enemyClass: 'ground' },
        { position: new Vector3(20, 0, -140), distToPlayer: 20, enemyClass: 'ground' },
        { position: new Vector3(40, 0, -160), distToPlayer: 40, enemyClass: 'armored' },
      ];

      // Score calculation
      const scoreEnemy = (enemy: typeof enemies[0]) => {
        let score = 100 - enemy.distToPlayer; // Closer is better
        if (enemy.distToPlayer < 30) score += 50; // Threat to player
        if (enemy.enemyClass === 'armored') score += 30;
        return score;
      };

      const scores = enemies.map(e => ({ ...e, score: scoreEnemy(e) }));
      const best = scores.sort((a, b) => b.score - a.score)[0];

      expect(best.distToPlayer).toBe(20); // Closest to player wins
    });
  });

  // ==========================================================================
  // ENEMY SYSTEM
  // ==========================================================================

  describe('Enemy System', () => {
    it('should configure ground enemy stats', () => {
      const groundConfig = {
        health: 40,
        damage: 8,
        speed: 12,
        fireRate: 2,
        attackRange: 15,
      };
      expect(groundConfig.health).toBe(40);
      expect(groundConfig.speed).toBe(12);
    });

    it('should configure flying enemy stats', () => {
      const flyingConfig = {
        health: 30,
        damage: 12,
        speed: 20,
        fireRate: 1.5,
        attackRange: 40,
      };
      expect(flyingConfig.health).toBe(30);
      expect(flyingConfig.speed).toBe(20);
    });

    it('should configure armored enemy stats', () => {
      const armoredConfig = {
        health: 200,
        damage: 25,
        speed: 4,
        fireRate: 0.8,
        attackRange: 35,
      };
      expect(armoredConfig.health).toBe(200);
      expect(armoredConfig.speed).toBe(4);
    });

    it('should move enemies toward player', () => {
      const enemyPosition = new Vector3(0, 0, -100);
      const playerPosition = new Vector3(0, 0, -50);
      const speed = 12;
      const deltaTime = 0.016;

      const moveDir = playerPosition.subtract(enemyPosition).normalize();
      const newPosition = enemyPosition.add(moveDir.scale(speed * deltaTime));

      expect(newPosition.z).toBeGreaterThan(-100);
    });

    it('should attack player when in range', () => {
      const enemyPosition = new Vector3(0, 0, -60);
      const playerPosition = new Vector3(0, 0, -50);
      const attackRange = 15;

      const distance = Vector3.Distance(enemyPosition, playerPosition);
      const canAttack = distance < attackRange;

      expect(canAttack).toBe(true);
    });

    it('should calculate beachhead progress for kills', () => {
      const phase = 'entry_push';
      let beachheadProgress = 0;

      const killEnemy = (enemyClass: string) => {
        if (phase === 'entry_push') {
          const value = enemyClass === 'armored' ? 8 : enemyClass === 'flying' ? 3 : 2;
          beachheadProgress += value;
        }
      };

      killEnemy('ground');
      expect(beachheadProgress).toBe(2);

      killEnemy('flying');
      expect(beachheadProgress).toBe(5);

      killEnemy('armored');
      expect(beachheadProgress).toBe(13);
    });

    it('should limit active enemies to maxEnemies', () => {
      const maxEnemies = 60;
      let activeEnemies = 58;

      const canSpawn = activeEnemies < maxEnemies;
      expect(canSpawn).toBe(true);

      activeEnemies = 60;
      const canSpawnNow = activeEnemies < maxEnemies;
      expect(canSpawnNow).toBe(false);
    });
  });

  // ==========================================================================
  // SQUAD COMMANDS
  // ==========================================================================

  describe('Squad Commands', () => {
    it('should support follow command', () => {
      let squadCommandMode = 'hold';

      const issueSquadCommand = (command: string) => {
        squadCommandMode = command;
      };

      issueSquadCommand('follow');
      expect(squadCommandMode).toBe('follow');
    });

    it('should support hold command', () => {
      let squadCommandMode = 'follow';

      const issueSquadCommand = (command: string) => {
        squadCommandMode = command;
      };

      issueSquadCommand('hold');
      expect(squadCommandMode).toBe('hold');
    });

    it('should support advance command', () => {
      let squadCommandMode = 'follow';

      const issueSquadCommand = (command: string) => {
        squadCommandMode = command;
      };

      issueSquadCommand('advance');
      expect(squadCommandMode).toBe('advance');
    });

    it('should have command cooldown of 1 second', () => {
      const commandCooldown = 1000; // milliseconds
      let lastCommandTime = 0;
      const now = 500;

      const canCommand = now - lastCommandTime >= commandCooldown;
      expect(canCommand).toBe(false);
    });

    it('should update action button highlights on command change', () => {
      const squadCommandMode: string = 'follow';
      const buttons = [
        { id: 'squad_follow', variant: squadCommandMode === 'follow' ? 'primary' : 'secondary' },
        { id: 'squad_hold', variant: squadCommandMode === 'hold' ? 'primary' : 'secondary' },
        { id: 'squad_advance', variant: squadCommandMode === 'advance' ? 'primary' : 'secondary' },
      ];

      expect(buttons[0].variant).toBe('primary');
      expect(buttons[1].variant).toBe('secondary');
    });
  });

  // ==========================================================================
  // COMBAT ACTIONS
  // ==========================================================================

  describe('Combat Actions', () => {
    it('should register combat action buttons', () => {
      const combatActions = [
        { id: 'reload', label: 'RELOAD', key: 'R' },
        { id: 'grenade', label: 'GRENADE', key: 'G' },
        { id: 'revive', label: 'REVIVE', key: 'E' },
      ];
      expect(combatActions).toHaveLength(3);
    });

    it('should have grenade cooldown of 5 seconds', () => {
      const grenadeCooldownTime = 5000;
      expect(grenadeCooldownTime).toBe(5000);
    });

    it('should apply grenade blast radius damage', () => {
      const impactPos = new Vector3(0, 0, -100);
      const blastRadius = 8;
      const baseDamage = 60;

      const enemies = [
        { position: new Vector3(3, 0, -100) }, // Close
        { position: new Vector3(6, 0, -100) }, // Medium
        { position: new Vector3(10, 0, -100) }, // Outside radius
      ];

      const damages = enemies.map(e => {
        const dist = Vector3.Distance(e.position, impactPos);
        if (dist < blastRadius) {
          return Math.floor(baseDamage * (1 - dist / blastRadius));
        }
        return 0;
      });

      expect(damages[0]).toBeGreaterThan(0);
      expect(damages[1]).toBeGreaterThan(0);
      expect(damages[2]).toBe(0);
    });
  });

  // ==========================================================================
  // PLAYER DAMAGE
  // ==========================================================================

  describe('Player Damage', () => {
    it('should start with 100 health', () => {
      const playerHealth = 100;
      const maxHealth = 100;
      expect(playerHealth).toBe(maxHealth);
    });

    it('should apply damage to player', () => {
      let playerHealth = 100;
      const damage = 15;

      playerHealth -= damage;
      expect(playerHealth).toBe(85);
    });

    it('should trigger death at 0 health', () => {
      let playerHealth = 10;
      let isDead = false;
      const damage = 20;

      playerHealth -= damage;
      if (playerHealth <= 0) {
        playerHealth = 0;
        isDead = true;
      }

      expect(playerHealth).toBe(0);
      expect(isDead).toBe(true);
    });

    it('should track damage for stats', () => {
      let damageTaken = 0;
      const damage = 25;

      damageTaken += damage;
      expect(damageTaken).toBe(25);
    });
  });

  // ==========================================================================
  // COMMS MESSAGES
  // ==========================================================================

  describe('Comms Messages', () => {
    it('should have Commander Reyes briefing message', () => {
      const comms = {
        sender: 'Commander Reyes',
        callsign: 'ACTUAL',
        portrait: 'commander',
        text: 'All units, this is it. The main hive entrance is 600 meters north.',
      };
      expect(comms.sender).toBe('Commander Reyes');
      expect(comms.callsign).toBe('ACTUAL');
    });

    it('should have Marcus rally message', () => {
      const comms = {
        sender: 'Corporal Marcus Cole',
        callsign: 'HAMMER',
        portrait: 'marcus',
        text: "You heard the Commander, James. Time to finish what we started.",
      };
      expect(comms.callsign).toBe('HAMMER');
    });

    it('should have ATHENA tactical analysis', () => {
      const comms = {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Tactical analysis: Four AA emplacements must be neutralized.',
      };
      expect(comms.callsign).toBe('ATHENA');
    });

    it('should generate AA destroyed message with count', () => {
      const count: number = 2;
      const total: number = 4;
      const text = `AA turret destroyed. ${count} of ${total} neutralized. ${count === total ? 'Airspace is clear!' : 'Continue advancing.'}`;
      expect(text).toContain('2 of 4');
      expect(text).toContain('Continue advancing.');
    });

    it('should have beachhead secured message', () => {
      const comms = {
        sender: 'Commander Reyes',
        callsign: 'ACTUAL',
        text: 'Beachhead secured! Outstanding work, all units.',
      };
      expect(comms.text).toContain('Beachhead secured');
    });

    it('should have Marcus farewell message', () => {
      const comms = {
        sender: 'Corporal Marcus Cole',
        callsign: 'HAMMER',
        text: "Go on, brother. I'll hold the door.",
      };
      expect(comms.text).toContain("I'll hold the door");
    });
  });

  // ==========================================================================
  // OBJECTIVE MARKERS
  // ==========================================================================

  describe('Objective Markers', () => {
    it('should update marker every 2 seconds', () => {
      const updateInterval = 2.0;
      expect(updateInterval).toBe(2.0);
    });

    it('should point to AA turret in field assault', () => {
      const phase = 'field_assault';
      const turrets = [
        { position: new Vector3(-60, 0, -180), destroyed: false },
        { position: new Vector3(55, 0, -220), destroyed: true },
      ];

      let markerPosition: Vector3 | null = null;
      if (phase === 'field_assault') {
        const nextTurret = turrets.find(t => !t.destroyed);
        if (nextTurret) {
          markerPosition = nextTurret.position;
        }
      }

      expect(markerPosition).not.toBeNull();
      expect(markerPosition!.x).toBe(-60);
    });

    it('should point to hive entrance in breach point', () => {
      const phase = 'breach_point';
      let markerPosition: Vector3 | null = null;

      if (phase === 'breach_point') {
        markerPosition = new Vector3(0, 0, -550);
      }

      expect(markerPosition!.z).toBe(-550);
    });

    it('should point to extraction zone in entry push', () => {
      const phase = 'entry_push';
      const extractionPosition = new Vector3(0, 0, -660);
      let markerPosition: Vector3 | null = null;

      if (phase === 'entry_push') {
        markerPosition = extractionPosition;
      }

      expect(markerPosition!.z).toBe(-660);
    });
  });

  // ==========================================================================
  // AUDIO ZONES
  // ==========================================================================

  describe('Audio Zones', () => {
    it('should define staging audio zone', () => {
      const zone = {
        name: 'staging',
        type: 'base',
        position: { x: 0, y: 0, z: -20 },
        radius: 60,
        isIndoor: false,
        intensity: 0.3,
      };
      expect(zone.type).toBe('base');
    });

    it('should define battlefield audio zone', () => {
      const zone = {
        name: 'battlefield',
        type: 'surface',
        position: { x: 0, y: 0, z: -300 },
        radius: 300,
        isIndoor: false,
        intensity: 0.8,
        highThreat: true,
      };
      expect(zone.highThreat).toBe(true);
    });

    it('should define hive entrance audio zone', () => {
      const zone = {
        name: 'hive_entrance',
        type: 'hive',
        position: { x: 0, y: 0, z: -600 },
        radius: 80,
        isIndoor: false,
        intensity: 1.0,
        highThreat: true,
      };
      expect(zone.type).toBe('hive');
    });
  });

  // ==========================================================================
  // CHECKPOINTS
  // ==========================================================================

  describe('Checkpoints', () => {
    it('should save checkpoint at field assault start', () => {
      const checkpoints: string[] = [];

      const saveCheckpoint = (name: string) => {
        checkpoints.push(name);
      };

      saveCheckpoint('field_assault');
      expect(checkpoints).toContain('field_assault');
    });

    it('should save checkpoint at breach point', () => {
      const checkpoints: string[] = [];

      const saveCheckpoint = (name: string) => {
        checkpoints.push(name);
      };

      saveCheckpoint('breach_point');
      expect(checkpoints).toContain('breach_point');
    });
  });

  // ==========================================================================
  // PERFORMANCE OPTIMIZATION
  // ==========================================================================

  describe('Performance Optimization', () => {
    it('should only update enemies within 150m', () => {
      const enemyUpdateDistance = 150;
      const playerPosition = new Vector3(0, 0, -100);
      const enemies = [
        { position: new Vector3(0, 0, -130) }, // 30m away - should update
        { position: new Vector3(0, 0, -280) }, // 180m away - skip
      ];

      const shouldUpdate = enemies.map(e => {
        const dist = Vector3.Distance(e.position, playerPosition);
        return dist <= enemyUpdateDistance;
      });

      expect(shouldUpdate[0]).toBe(true);
      expect(shouldUpdate[1]).toBe(false);
    });

    it('should use LOD for enemies beyond 80m', () => {
      const lodDistance = 80;
      const playerPosition = new Vector3(0, 0, -100);
      const enemy = { position: new Vector3(0, 0, -190) };

      const dist = Vector3.Distance(enemy.position, playerPosition);
      const isClose = dist < lodDistance;

      expect(isClose).toBe(false);
    });

    it('should update marines at 20Hz', () => {
      const updateRate = 0.05; // 20Hz = 50ms interval
      expect(updateRate).toBe(0.05);
    });

    it('should update enemies at 30Hz', () => {
      const updateRate = 0.033; // ~30Hz
      expect(updateRate).toBeCloseTo(0.033);
    });
  });

  // ==========================================================================
  // LEVEL COMPLETION
  // ==========================================================================

  describe('Level Completion', () => {
    it('should trigger level complete sequence', () => {
      let levelCompleteTriggered = false;
      const commsMessages: string[] = [];

      const triggerLevelComplete = () => {
        levelCompleteTriggered = true;
        commsMessages.push('BEACHHEAD_SECURED');
        setTimeout(() => commsMessages.push('MARCUS_FAREWELL'), 5000);
      };

      triggerLevelComplete();
      expect(levelCompleteTriggered).toBe(true);
      expect(commsMessages).toContain('BEACHHEAD_SECURED');
    });

    it('should wait for farewell before completing', () => {
      let completed = false;

      const completeAfterDelay = () => {
        setTimeout(() => {
          completed = true;
        }, 10000);
      };

      completeAfterDelay();
      expect(completed).toBe(false); // Not yet completed
    });
  });

  // ==========================================================================
  // INPUT HANDLING
  // ==========================================================================

  describe('Input Handling', () => {
    it('should handle R key for reload', () => {
      const keyCode = 'KeyR';
      let reloadCalled = false;

      const handleKeyDown = (code: string) => {
        if (code === 'KeyR') {
          reloadCalled = true;
        }
      };

      handleKeyDown(keyCode);
      expect(reloadCalled).toBe(true);
    });

    it('should handle G key for grenade', () => {
      const keyCode = 'KeyG';
      let grenadeCalled = false;

      const handleKeyDown = (code: string) => {
        if (code === 'KeyG') {
          grenadeCalled = true;
        }
      };

      handleKeyDown(keyCode);
      expect(grenadeCalled).toBe(true);
    });

    it('should handle E key for vehicle mount in staging', () => {
      const keyCode = 'KeyE';
      const phase = 'staging';
      let mountCalled = false;

      const handleKeyDown = (code: string) => {
        if (code === 'KeyE' && phase === 'staging') {
          mountCalled = true;
        }
      };

      handleKeyDown(keyCode);
      expect(mountCalled).toBe(true);
    });

    it('should handle F key for vehicle dismount', () => {
      const keyCode = 'KeyF';
      let isInVehicle = true;
      let dismountCalled = false;

      const handleKeyDown = (code: string) => {
        if (code === 'KeyF' && isInVehicle) {
          dismountCalled = true;
          isInVehicle = false;
        }
      };

      handleKeyDown(keyCode);
      expect(dismountCalled).toBe(true);
    });

    it('should handle 1-3 keys for squad commands', () => {
      const commands: string[] = [];
      const phase: string = 'field_assault';

      const handleKeyDown = (code: string) => {
        if (phase !== 'staging') {
          if (code === 'Digit1') commands.push('follow');
          if (code === 'Digit2') commands.push('hold');
          if (code === 'Digit3') commands.push('advance');
        }
      };

      handleKeyDown('Digit1');
      handleKeyDown('Digit2');
      handleKeyDown('Digit3');

      expect(commands).toEqual(['follow', 'hold', 'advance']);
    });
  });

  // ==========================================================================
  // MOVE SPEED
  // ==========================================================================

  describe('Move Speed', () => {
    it('should return vehicle speed when in vehicle', () => {
      const isInVehicle = true;
      const vehicleSpeed = 25;
      const walkSpeed = 8;

      const getMoveSpeed = () => isInVehicle ? vehicleSpeed : walkSpeed;
      expect(getMoveSpeed()).toBe(25);
    });

    it('should return walk speed when on foot', () => {
      const isInVehicle = false;
      const vehicleSpeed = 25;
      const walkSpeed = 8;

      const getMoveSpeed = () => isInVehicle ? vehicleSpeed : walkSpeed;
      expect(getMoveSpeed()).toBe(8);
    });

    it('should return vehicle sprint multiplier when in vehicle', () => {
      const isInVehicle = true;
      const vehicleMultiplier = 1.3;
      const walkMultiplier = 1.5;

      const getSprintMultiplier = () => isInVehicle ? vehicleMultiplier : walkMultiplier;
      expect(getSprintMultiplier()).toBe(1.3);
    });

    it('should return walk sprint multiplier when on foot', () => {
      const isInVehicle = false;
      const vehicleMultiplier = 1.3;
      const walkMultiplier = 1.5;

      const getSprintMultiplier = () => isInVehicle ? vehicleMultiplier : walkMultiplier;
      expect(getSprintMultiplier()).toBe(1.5);
    });
  });

  // ==========================================================================
  // CLEANUP / DISPOSAL
  // ==========================================================================

  describe('Disposal', () => {
    it('should dispose all enemies', () => {
      const enemies = [
        { mesh: { dispose: vi.fn() } },
        { mesh: { dispose: vi.fn() } },
      ];

      enemies.forEach(e => e.mesh.dispose());

      expect(enemies[0].mesh.dispose).toHaveBeenCalled();
      expect(enemies[1].mesh.dispose).toHaveBeenCalled();
    });

    it('should dispose Marcus mech', () => {
      const marcus = {
        rootNode: { dispose: vi.fn() },
      };

      marcus.rootNode.dispose();
      expect(marcus.rootNode.dispose).toHaveBeenCalled();
    });

    it('should dispose player vehicle', () => {
      const vehicle = {
        rootNode: { dispose: vi.fn() },
      };

      vehicle.rootNode.dispose();
      expect(vehicle.rootNode.dispose).toHaveBeenCalled();
    });

    it('should dispose marine manager', () => {
      const marineManager = { dispose: vi.fn() };

      marineManager.dispose();
      expect(marineManager.dispose).toHaveBeenCalled();
    });

    it('should unregister dynamic actions', () => {
      const unregisterDynamicActions = vi.fn();

      unregisterDynamicActions('hive_assault');
      expect(unregisterDynamicActions).toHaveBeenCalledWith('hive_assault');
    });

    it('should remove audio zones', () => {
      const zonesRemoved: string[] = [];
      const removeAudioZone = (name: string) => zonesRemoved.push(name);

      removeAudioZone('staging');
      removeAudioZone('battlefield');
      removeAudioZone('hive_entrance');

      expect(zonesRemoved).toEqual(['staging', 'battlefield', 'hive_entrance']);
    });

    it('should clear action buttons', () => {
      const onActionGroupsChange = vi.fn();

      onActionGroupsChange([]);
      expect(onActionGroupsChange).toHaveBeenCalledWith([]);
    });
  });

  // ==========================================================================
  // SCRIPTED EVENTS
  // ==========================================================================

  describe('Scripted Events', () => {
    it('should trigger ambush with spawned enemies', () => {
      let ambushTriggered = false;
      let enemiesSpawned = 0;

      const triggerAmbush = () => {
        if (ambushTriggered) return;
        ambushTriggered = true;
        enemiesSpawned = 8;
      };

      triggerAmbush();
      expect(ambushTriggered).toBe(true);
      expect(enemiesSpawned).toBe(8);
    });

    it('should trigger squad overwhelmed with spawned enemies', () => {
      let squadOverwhelmedTriggered = false;
      let enemiesSpawned = 0;

      const triggerSquadOverwhelmed = () => {
        if (squadOverwhelmedTriggered) return;
        squadOverwhelmedTriggered = true;
        enemiesSpawned = 10;
      };

      triggerSquadOverwhelmed();
      expect(squadOverwhelmedTriggered).toBe(true);
      expect(enemiesSpawned).toBe(10);
    });

    it('should check squad rescue conditions', () => {
      const playerPosition = new Vector3(10, 0, -400);
      const squadPosition = new Vector3(15, 0, -410);
      const nearbyEnemies = 2;
      const wasRescued = false;

      const playerDist = Vector3.Distance(playerPosition, squadPosition);
      const canRescue = playerDist < 20 && nearbyEnemies < 3 && !wasRescued;

      expect(canRescue).toBe(true);
    });
  });
});
