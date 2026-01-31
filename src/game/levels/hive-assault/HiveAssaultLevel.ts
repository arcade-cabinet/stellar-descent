/**
 * HiveAssaultLevel - Chapter 8: Combined Arms Push into the Hive
 *
 * The largest battle in the campaign. UNSC forces launch a combined arms
 * assault on the main hive entrance. Player fights alongside NPC marine
 * squads and Marcus's mech, alternating between vehicle and infantry combat.
 *
 * FOUR PHASES:
 *
 * PHASE 1: STAGING AREA (2-3 minutes)
 *   - Mission briefing from Commander Reyes
 *   - Gear up, interact with marines
 *   - Board vehicle when ready
 *   - Marcus rallies the troops
 *
 * PHASE 2: OPEN FIELD ASSAULT (5-7 minutes)
 *   - Drive toward hive entrance
 *   - Destroy 4 AA turrets blocking air support
 *   - Ground Chitin swarms attack convoy
 *   - Flying Chitin strafe from above
 *   - Marcus provides mech support alongside
 *   - Scripted moment: marine squad gets ambushed
 *
 * PHASE 3: BREACH POINT (5-7 minutes)
 *   - Dismount (vehicles destroyed by concentrated fire)
 *   - Intense infantry combat at the hive entrance
 *   - Marine squads provide covering fire
 *   - Armored Chitin (turret class) defend the entrance
 *   - Player must clear path to the gate
 *   - Scripted: squad overwhelmed, player saves them
 *
 * PHASE 4: ENTRY PUSH (3-5 minutes)
 *   - Push through the hive entrance corridor
 *   - Close quarters combat
 *   - Establish beachhead inside the hive
 *   - Marcus holds the entrance with his mech
 *   - Level complete when beachhead secured
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { registerDynamicActions, unregisterDynamicActions } from '../../context/useInputActions';
import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { ALIEN_SPECIES, createAlienMesh } from '../../entities/aliens';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { SurfaceLevel } from '../SurfaceLevel';
import { buildFloraFromPlacements, getHiveAssaultFlora } from '../shared/AlienFloraBuilder';
import { buildCollectibles, type CollectibleSystemResult, getHiveAssaultCollectibles } from '../shared/CollectiblePlacer';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import { createDynamicTerrain, ROCK_TERRAIN } from '../shared/SurfaceTerrainFactory';
import type { TerrainResult } from '../shared/SurfaceTerrainFactory';
import { HiveEnvironmentBuilder, updateBiolights } from '../shared/HiveEnvironmentBuilder';
import {
  type AATurret,
  AssaultEnvironmentBuilder,
  type DestroyedVehicle,
  type Fortification,
  type HiveEntrance,
  type StagingAreaProps,
} from './environment';
import {
  type EnemyTarget,
  type Marine,
  type MarineSquad,
  MarineSquadManager,
} from './MarineSquadAI';

import '@babylonjs/core/Animations/animatable';

// ============================================================================
// GLB ASSET PATHS (vehicles & NPCs)
// ============================================================================

const LEVEL_GLB = {
  marcusMech: '/models/vehicles/tea/marcus_mech.glb',
  marineSoldier: '/models/npcs/marine/marine_soldier.glb',
  marineSergeant: '/models/npcs/marine/marine_sergeant.glb',
  marineElite: '/models/npcs/marine/marine_elite.glb',
  marineCrusader: '/models/npcs/marine/marine_crusader.glb',
  playerVehicle: '/models/vehicles/chitin/wraith.glb',
} as const;

// ============================================================================
// TYPES
// ============================================================================

type AssaultPhase =
  | 'staging' // Phase 1: Briefing, gear up
  | 'field_assault' // Phase 2: Vehicle combat, destroy AA turrets
  | 'breach_point' // Phase 3: Dismount, infantry assault
  | 'entry_push'; // Phase 4: Clear hive entrance

type EnemyClass = 'ground' | 'flying' | 'armored';

interface AssaultEnemy {
  mesh: TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  velocity: Vector3;
  species: string;
  enemyClass: EnemyClass;
  isActive: boolean;
  attackCooldown: number;
  fireRate: number;
  damage: number;
  speed: number;
  targetPosition: Vector3;
}

interface MarcusMech {
  rootNode: TransformNode;
  body: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  legs: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
  fireTimer: number;
  fireRate: number;
  damage: number;
  range: number;
  targetEnemy: AssaultEnemy | null;
}

interface PlayerVehicle {
  rootNode: TransformNode;
  body: Mesh;
  turret: Mesh;
  health: number;
  maxHealth: number;
  speed: number;
  fireTimer: number;
  fireRate: number;
  damage: number;
  isActive: boolean;
}

interface PhaseWaveConfig {
  groundChitin: number;
  flyingChitin: number;
  armoredChitin: number;
  spawnDelay: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLAYER_MAX_HEALTH = 100;
const PLAYER_VEHICLE_HEALTH = 500;
const VEHICLE_SPEED = 25;
const VEHICLE_FIRE_RATE = 3; // shots per second
const VEHICLE_DAMAGE = 40;
const VEHICLE_TURN_SPEED = 2.0; // radians per second

const MARCUS_MECH_HEALTH = 800;
const MARCUS_FIRE_RATE = 2;
const MARCUS_DAMAGE = 60;
const MARCUS_RANGE = 100;
const MARCUS_FOLLOW_DISTANCE = 12; // meters behind player

const AA_TURRET_FIRE_RATE = 1.5;
const AA_TURRET_DAMAGE = 15;
const AA_TURRET_RANGE = 80;
const AA_TURRET_HEALTH = 200;

// Objective marker update intervals
const OBJECTIVE_UPDATE_INTERVAL = 2.0; // seconds
const WAYPOINT_PROXIMITY = 15; // meters to consider waypoint reached

// Performance optimization constants
const ENEMY_UPDATE_DISTANCE = 150; // only update enemies within this range
const ENEMY_LOD_DISTANCE = 80; // distance for enemy LOD switching
const MARINE_UPDATE_DISTANCE = 120; // only update marines within this range

const ENEMY_CONFIGS: Record<
  EnemyClass,
  {
    health: number;
    damage: number;
    speed: number;
    fireRate: number;
    attackRange: number;
  }
> = {
  ground: {
    health: 40,
    damage: 8,
    speed: 12,
    fireRate: 2,
    attackRange: 15,
  },
  flying: {
    health: 30,
    damage: 12,
    speed: 20,
    fireRate: 1.5,
    attackRange: 40,
  },
  armored: {
    health: 200,
    damage: 25,
    speed: 4,
    fireRate: 0.8,
    attackRange: 35,
  },
};

// Phase 2 wave configs (enemy waves during field assault)
const FIELD_WAVES: PhaseWaveConfig[] = [
  { groundChitin: 12, flyingChitin: 4, armoredChitin: 0, spawnDelay: 1.0 },
  { groundChitin: 18, flyingChitin: 6, armoredChitin: 1, spawnDelay: 0.8 },
  { groundChitin: 24, flyingChitin: 8, armoredChitin: 2, spawnDelay: 0.6 },
];

// Phase 3 wave configs (breach point infantry combat)
const BREACH_WAVES: PhaseWaveConfig[] = [
  { groundChitin: 15, flyingChitin: 2, armoredChitin: 2, spawnDelay: 0.9 },
  { groundChitin: 20, flyingChitin: 4, armoredChitin: 3, spawnDelay: 0.7 },
  { groundChitin: 30, flyingChitin: 6, armoredChitin: 4, spawnDelay: 0.5 },
];

// Phase 4 wave configs (entry push close quarters)
const ENTRY_WAVES: PhaseWaveConfig[] = [
  { groundChitin: 20, flyingChitin: 0, armoredChitin: 1, spawnDelay: 0.8 },
  { groundChitin: 30, flyingChitin: 0, armoredChitin: 2, spawnDelay: 0.5 },
];

// ============================================================================
// COMMS MESSAGES
// ============================================================================

const COMMS = {
  // Phase 1: Staging
  BRIEFING: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'All units, this is it. The main hive entrance is 600 meters north. We hit them with everything we have. Destroy the AA turrets, breach the entrance, and secure a beachhead inside. Good luck.',
  },
  MARCUS_RALLY: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "You heard the Commander, James. Time to finish what we started. HAMMER is locked and loaded - let's roll!",
  },
  ATHENA_BRIEFING: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Tactical analysis: Four AA emplacements must be neutralized before air support can operate. Recommend vehicle assault on turret positions.',
  },
  BOARD_VEHICLE: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Vehicle bay is operational. Board your Warthog when ready to begin the assault.',
  },

  // Phase 2: Field Assault
  ASSAULT_BEGIN: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'All units, commence assault! Push to the hive entrance!',
  },
  AA_DESTROYED: (count: number, total: number) => ({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: `AA turret destroyed. ${count} of ${total} neutralized. ${count === total ? 'Airspace is clear!' : 'Continue advancing.'}`,
  }),
  FLYING_CHITIN: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "Flying contacts! They're coming from above - watch the skies!",
  },
  AMBUSH_ALERT: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'ALPHA squad is getting hit hard! They need support, now!',
  },
  MARCUS_FIELD: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "HAMMER engaging targets! Keep pushing, James - I've got your flanks covered!",
  },

  // Phase 3: Breach Point
  DISMOUNT: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Warning: Vehicle cannot proceed. Heavy organic obstructions ahead. Recommend dismounting for infantry assault.',
  },
  BREACH_COMBAT: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "Dismount! Fight on foot from here! I'll provide heavy fire support!",
  },
  ARMORED_CHITIN: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Warning: Armored Chitin turret constructs detected. These are high-priority targets.',
  },
  SQUAD_OVERWHELMED: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'BRAVO squad is being overrun! Get to them, Lieutenant!',
  },
  SQUAD_SAVED: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'BRAVO squad is back in action! Outstanding work, Lieutenant!',
  },

  // Phase 4: Entry Push
  ENTRY_BEGIN: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "The gate is open! Push inside! I'll hold the entrance - they won't get behind you!",
  },
  ENTRY_COMBAT: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'Clear that entrance corridor! Secure a position we can hold!',
  },
  BEACHHEAD_SECURED: {
    sender: 'Commander Reyes',
    callsign: 'ACTUAL',
    portrait: 'commander' as const,
    text: 'Beachhead secured! Outstanding work, all units. The hive is breached. This is just the beginning.',
  },
  MARCUS_FAREWELL: {
    sender: 'Corporal Marcus Cole',
    callsign: 'HAMMER',
    portrait: 'marcus' as const,
    text: "Go on, brother. I'll hold the door. Whatever's in there... end it. For all of us.",
  },
};

// ============================================================================
// MAIN LEVEL CLASS
// ============================================================================

export class HiveAssaultLevel extends SurfaceLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Phase management
  private phase: AssaultPhase = 'staging';
  private phaseTime = 0;
  private phaseStarted = false;

  // Environment
  private envBuilder: AssaultEnvironmentBuilder | null = null;
  private surfaceTerrain: TerrainResult | null = null;
  private hiveBuilder: HiveEnvironmentBuilder | null = null;
  private stagingArea: StagingAreaProps | null = null;
  private aaTurrets: AATurret[] = [];
  private fieldCover: Fortification[] = [];
  private breachFortifications: Fortification[] = [];
  private hiveEntrance: HiveEntrance | null = null;
  private destroyedVehicles: DestroyedVehicle[] = [];

  // Player
  private playerHealth = PLAYER_MAX_HEALTH;
  private kills = 0;
  private isInVehicle = false;
  private playerVehicle: PlayerVehicle | null = null;

  // Marcus
  private marcus: MarcusMech | null = null;

  // Marine squads
  private marineManager: MarineSquadManager | null = null;

  // Enemies
  private enemies: AssaultEnemy[] = [];
  private readonly maxEnemies = 60;
  private waveIndex = 0;
  private waveSpawnTimer = 0;
  private enemiesToSpawn: { enemyClass: EnemyClass; count: number }[] = [];
  private enemiesRemaining = 0;

  // AA turret tracking
  private turretsDestroyed = 0;
  private readonly totalTurrets = 4;

  // Scripted events
  private ambushTriggered = false;
  private squadOverwhelmedTriggered = false;
  private flyingChitinAlerted = false;
  private armoredChitinAlerted = false;

  // Action button callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Cooldowns
  private grenadeCooldown = 0;
  private readonly grenadeCooldownTime = 5000;

  // Cover positions for marine AI
  private coverPositions: Vector3[] = [];

  // Entry push state
  private beachheadProgress = 0;
  private readonly beachheadRequired = 100; // Kill score to secure beachhead

  // Objective marker state
  private currentObjectiveMarker: Vector3 | null = null;
  private objectiveUpdateTimer = 0;

  // Squad command state
  private squadCommandMode: 'follow' | 'hold' | 'advance' = 'follow';
  private lastSquadCommandTime = 0;

  // Performance optimization state
  private enemyUpdateAccumulator = 0;
  private marineUpdateAccumulator = 0;

  // Level completion state
  private levelCompleteTriggered = false;
  private extractionZonePosition = new Vector3(0, 0, -660);
  private extractionZoneRadius = 15;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks, {
      terrainSize: 700,
      heightScale: 5,
      timeOfDay: 0.55,
      fogDensity: 0.003,
      dustIntensity: 0.4,
      enemyDensity: 1.0,
      maxEnemies: 60,
    });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  protected getBackgroundColor(): Color4 {
    switch (this.phase) {
      case 'staging':
        return new Color4(0.55, 0.35, 0.2, 1);
      case 'field_assault':
        return new Color4(0.6, 0.35, 0.2, 1);
      case 'breach_point':
        return new Color4(0.5, 0.3, 0.18, 1);
      case 'entry_push':
        return new Color4(0.15, 0.08, 0.12, 1); // Darker as entering hive
      default:
        return new Color4(0.6, 0.35, 0.2, 1);
    }
  }

  protected async createEnvironment(): Promise<void> {
    this.camera.position.set(0, 1.7, -5);
    this.rotationX = 0;
    this.rotationY = Math.PI;
    this.targetRotationX = 0;
    this.targetRotationY = Math.PI;

    // Initialize systems
    particleManager.init(this.scene);

    // Build environment -- load GLB assets first, then construct zones
    this.envBuilder = new AssaultEnvironmentBuilder(this.scene);
    await this.envBuilder.loadAssets();
    this.envBuilder.setupGlowLayer();
    this.envBuilder.createTerrain();
    this.envBuilder.createSkyDome();
    this.envBuilder.createCanyonWalls();
    this.envBuilder.createFleetBackdrop();

    this.stagingArea = this.envBuilder.createStagingArea();
    this.fieldCover = this.envBuilder.createFieldCover();
    this.breachFortifications = this.envBuilder.createBreachFortifications();
    this.destroyedVehicles = this.envBuilder.createDestroyedVehicles();
    this.aaTurrets = this.envBuilder.createAATurrets();

    const hazards = this.envBuilder.createHazards();
    this.hiveEntrance = this.envBuilder.createHiveEntrance();

    // --- Surface terrain (open field combat area, phases 1-3) ---
    this.surfaceTerrain = createDynamicTerrain(this.scene, {
      ...ROCK_TERRAIN,
      size: 700,
      heightScale: 5,
      seed: 88881,
      materialName: 'hiveAssaultRockTerrain',
    });

    // --- Hive underground environment (entry push, phase 4) ---
    this.hiveBuilder = new HiveEnvironmentBuilder(this.scene, {
      logPrefix: 'HiveAssault',
    });
    this.hiveBuilder.setupGlowLayer();

    // Build the hive entrance corridor tunnels (z: -600 to -650)
    for (let i = 0; i < 6; i++) {
      this.hiveBuilder.createTunnelSegment(
        new Vector3(0, -2, -600 - i * 8),
        0,
        'upper'
      );
    }

    // Place bioluminescent lights along the entrance corridor
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1.5 : 1.5;
      this.hiveBuilder.createBiolight(
        new Vector3(side, 1.5, -605 - i * 6),
        0.6 + Math.random() * 0.4
      );
    }

    // Create a chamber at the beachhead destination
    this.hiveBuilder.createChamber(new Vector3(0, -3, -660), 10, 'upper');

    // Extract cover positions for marine AI
    this.coverPositions = [
      ...this.fieldCover.filter((f) => f.provideCover).map((f) => f.position),
      ...this.breachFortifications.filter((f) => f.provideCover).map((f) => f.position),
    ];

    // Preload level-specific GLBs (mech, marines)
    await Promise.all(
      Object.values(LEVEL_GLB).map((p) =>
        AssetManager.isPathCached(p) ? Promise.resolve(null) : AssetManager.loadAssetByPath(p, this.scene)
      )
    );

    // Create Marcus mech
    this.createMarcusMech();

    // Create marine squads
    this.marineManager = new MarineSquadManager(this.scene, {
      onCommsMessage: (msg) => this.callbacks.onCommsMessage(msg),
      onNotification: (text, duration) => this.callbacks.onNotification(text, duration),
      onMarineRevived: (marine) => {
        this.callbacks.onNotification(`${marine.name} revived!`, 3000);
      },
      onSquadWiped: (squad) => {
        this.callbacks.onNotification(`${squad.callsign} squad is down!`, 5000);
      },
    });

    // Create 4 marine squads
    this.marineManager.createSquad(new Vector3(-15, 0, -20), 0, 'follow_player');
    this.marineManager.createSquad(new Vector3(15, 0, -20), 1, 'follow_player');
    this.marineManager.createSquad(new Vector3(-25, 0, -25), 2, 'hold_position');
    this.marineManager.createSquad(new Vector3(25, 0, -25), 3, 'hold_position');

    // Create player vehicle (parked in staging area)
    this.createPlayerVehicle();

    // Set up audio zones
    this.addAudioZone('staging', 'base', { x: 0, y: 0, z: -20 }, 60, {
      isIndoor: false,
      intensity: 0.3,
    });
    this.addAudioZone('battlefield', 'surface', { x: 0, y: 0, z: -300 }, 300, {
      isIndoor: false,
      intensity: 0.8,
      highThreat: true,
    });
    this.addAudioZone('hive_entrance', 'hive', { x: 0, y: 0, z: -600 }, 80, {
      isIndoor: false,
      intensity: 1.0,
      highThreat: true,
    });

    // Spatial sounds
    this.addSpatialSound(
      'wind',
      'vent',
      { x: 0, y: 5, z: -100 },
      {
        maxDistance: 200,
        volume: 0.3,
      }
    );

    // Build alien flora
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getHiveAssaultFlora(), floraRoot);

    // Build collectibles
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getHiveAssaultCollectibles(), collectibleRoot);

    // Register dynamic actions for squad commands and vehicle controls
    registerDynamicActions('hive_assault', ['squadFollow', 'squadHold', 'squadAttack', 'vehicleBoost', 'vehicleBrake'], 'squad');

    // Start staging phase
    this.startStagingPhase();
  }

  // ============================================================================
  // MARCUS MECH
  // ============================================================================

  private createMarcusMech(): void {
    const rootNode = new TransformNode('marcus_mech', this.scene);
    rootNode.position.set(10, 0, -15);

    // Load GLB model for the mech
    if (AssetManager.isPathCached(LEVEL_GLB.marcusMech)) {
      const mechModel = AssetManager.createInstanceByPath(
        LEVEL_GLB.marcusMech, 'marcus_mech_model', this.scene, true, 'vehicle'
      );
      if (mechModel) {
        mechModel.scaling.setAll(2.0);
        mechModel.parent = rootNode;
      }
    }

    // Invisible proxy meshes to satisfy MarcusMech interface (body, arms, legs)
    const body = MeshBuilder.CreateBox('mechBody_proxy', { width: 3, height: 4, depth: 2.5 }, this.scene);
    body.position.y = 5;
    body.parent = rootNode;
    body.isVisible = false;

    const leftArm = MeshBuilder.CreateBox('mechLeftArm_proxy', { width: 1, height: 3.5, depth: 1 }, this.scene);
    leftArm.position.set(-2.2, 5, 0);
    leftArm.parent = rootNode;
    leftArm.isVisible = false;

    const rightArm = MeshBuilder.CreateBox('mechRightArm_proxy', { width: 1, height: 3.5, depth: 1 }, this.scene);
    rightArm.position.set(2.2, 5, 0);
    rightArm.parent = rootNode;
    rightArm.isVisible = false;

    const legs = MeshBuilder.CreateBox('mechLegs_proxy', { width: 2.5, height: 3, depth: 2 }, this.scene);
    legs.position.y = 1.5;
    legs.parent = rootNode;
    legs.isVisible = false;

    // Mech eye light
    const mechEye = new PointLight('mechEye', new Vector3(10, 7.5, -14.5), this.scene);
    mechEye.diffuse = new Color3(0.5, 0.8, 1.0);
    mechEye.intensity = 3;
    mechEye.range = 15;

    this.marcus = {
      rootNode,
      body,
      leftArm,
      rightArm,
      legs,
      position: new Vector3(10, 0, -15),
      health: MARCUS_MECH_HEALTH,
      maxHealth: MARCUS_MECH_HEALTH,
      fireTimer: 0,
      fireRate: MARCUS_FIRE_RATE,
      damage: MARCUS_DAMAGE,
      range: MARCUS_RANGE,
      targetEnemy: null,
    };
  }

  // ============================================================================
  // PLAYER VEHICLE
  // ============================================================================

  private createPlayerVehicle(): void {
    const rootNode = new TransformNode('playerVehicle', this.scene);
    rootNode.position.set(15, 0, -10);

    // Load GLB model for the player vehicle
    if (AssetManager.isPathCached(LEVEL_GLB.playerVehicle)) {
      const vehicleModel = AssetManager.createInstanceByPath(
        LEVEL_GLB.playerVehicle, 'playerVehicle_model', this.scene, true, 'vehicle'
      );
      if (vehicleModel) {
        vehicleModel.scaling.setAll(0.8);
        vehicleModel.parent = rootNode;
      }
    }

    // Invisible collision proxy for body (gameplay collision)
    const body = MeshBuilder.CreateBox(
      'vehicleBody',
      { width: 2.5, height: 1.2, depth: 4 },
      this.scene
    );
    body.position.y = 0.8;
    body.parent = rootNode;
    body.isVisible = false;

    // Invisible collision proxy for turret
    const turret = MeshBuilder.CreateBox(
      'vehicleTurret',
      { width: 0.6, height: 0.5, depth: 1.5 },
      this.scene
    );
    turret.position.set(0, 1.8, 0.3);
    turret.parent = rootNode;
    turret.isVisible = false;

    this.playerVehicle = {
      rootNode,
      body,
      turret,
      health: PLAYER_VEHICLE_HEALTH,
      maxHealth: PLAYER_VEHICLE_HEALTH,
      speed: VEHICLE_SPEED,
      fireTimer: 0,
      fireRate: VEHICLE_FIRE_RATE,
      damage: VEHICLE_DAMAGE,
      isActive: true,
    };
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  private startStagingPhase(): void {
    this.phase = 'staging';
    this.phaseTime = 0;
    this.phaseStarted = true;

    this.callbacks.onChapterChange(this.config.chapter);
    this.callbacks.onObjectiveUpdate(
      'STAGING AREA',
      'Attend briefing and board your vehicle when ready.'
    );

    // Set initial objective marker at vehicle
    this.currentObjectiveMarker = new Vector3(15, 0, -10);
    this.callbacks.onObjectiveMarker?.(this.currentObjectiveMarker);

    // Register action buttons
    this.registerStagingActions();

    // Delayed comms sequence
    setTimeout(() => this.callbacks.onCommsMessage(COMMS.BRIEFING), 2000);
    setTimeout(() => this.callbacks.onCommsMessage(COMMS.ATHENA_BRIEFING), 8000);
    setTimeout(() => this.callbacks.onCommsMessage(COMMS.MARCUS_RALLY), 14000);
    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.BOARD_VEHICLE);
      this.callbacks.onNotification('Board your vehicle to begin the assault', 5000);
    }, 20000);
  }

  private startFieldAssaultPhase(): void {
    // Save checkpoint at start of field assault
    this.saveCheckpoint('field_assault');

    this.phase = 'field_assault';
    this.phaseTime = 0;
    this.waveIndex = 0;
    this.turretsDestroyed = 0;

    this.callbacks.onObjectiveUpdate(
      'OPEN FIELD ASSAULT',
      `Destroy AA turrets (0/${this.totalTurrets}) and advance to hive entrance.`
    );

    // Set objective marker to first AA turret
    if (this.aaTurrets.length > 0) {
      this.currentObjectiveMarker = this.aaTurrets[0].position.clone();
      this.callbacks.onObjectiveMarker?.(this.currentObjectiveMarker);
    }

    this.registerCombatActions();
    this.callbacks.onCommsMessage(COMMS.ASSAULT_BEGIN);

    // Marcus follows the assault
    if (this.marcus) {
      this.marcus.position = new Vector3(5, 0, -40);
      this.marcus.rootNode.position.copyFrom(this.marcus.position);
    }

    // Squads advance with proper spacing
    this.marineManager?.issueGlobalOrder('advance', new Vector3(0, 0, -200));
    this.squadCommandMode = 'advance';

    // Spawn first wave
    this.spawnWave(FIELD_WAVES[0]);

    setTimeout(() => this.callbacks.onCommsMessage(COMMS.MARCUS_FIELD), 5000);

    this.setCombatState(true);
  }

  private startBreachPointPhase(): void {
    // Save checkpoint before breach point (major encounter)
    this.saveCheckpoint('breach_point');

    this.phase = 'breach_point';
    this.phaseTime = 0;
    this.waveIndex = 0;

    // Force dismount
    if (this.isInVehicle) {
      this.dismountVehicle();
    }

    // Destroy vehicle (scripted) with explosion effect
    if (this.playerVehicle) {
      this.playerVehicle.isActive = false;
      this.playerVehicle.health = 0;
      particleManager.emit('explosion', this.playerVehicle.rootNode.position);
      this.triggerShake(6);
      this.playSound('explosion');
    }

    this.callbacks.onObjectiveUpdate('BREACH POINT', 'Clear the hive entrance. Fight on foot.');

    // Set objective marker to hive entrance
    this.currentObjectiveMarker = new Vector3(0, 0, -550);
    this.callbacks.onObjectiveMarker?.(this.currentObjectiveMarker);

    this.callbacks.onCommsMessage(COMMS.DISMOUNT);
    setTimeout(() => this.callbacks.onCommsMessage(COMMS.BREACH_COMBAT), 3000);

    // Squads push to breach with line formation for maximum firepower
    this.marineManager?.issueGlobalOrder('advance', new Vector3(0, 0, -500));
    this.marineManager?.getSquads().forEach((s) => {
      this.marineManager?.setFormation(s, 'line');
    });
    this.squadCommandMode = 'advance';

    this.spawnWave(BREACH_WAVES[0]);

    // Scripted: ambush on BRAVO squad
    setTimeout(() => this.triggerSquadOverwhelmed(), 30000);
  }

  private startEntryPushPhase(): void {
    this.phase = 'entry_push';
    this.phaseTime = 0;
    this.waveIndex = 0;
    this.beachheadProgress = 0;

    this.callbacks.onObjectiveUpdate(
      'ENTRY PUSH',
      'Push into the hive entrance and establish a beachhead.'
    );

    // Set objective marker to extraction/beachhead zone
    this.currentObjectiveMarker = this.extractionZonePosition.clone();
    this.callbacks.onObjectiveMarker?.(this.currentObjectiveMarker);

    this.callbacks.onCommsMessage(COMMS.ENTRY_BEGIN);
    setTimeout(() => this.callbacks.onCommsMessage(COMMS.ENTRY_COMBAT), 4000);

    // Marcus holds the entrance - provide covering fire
    if (this.marcus) {
      this.marcus.position = new Vector3(0, 0, -590);
      this.marcus.rootNode.position.copyFrom(this.marcus.position);
    }

    // Squads push inside with cover formation for close quarters
    this.marineManager?.issueGlobalOrder('advance', new Vector3(0, 0, -630));
    this.marineManager?.getSquads().forEach((s) => {
      this.marineManager?.setFormation(s, 'cover');
    });
    this.squadCommandMode = 'advance';

    this.spawnWave(ENTRY_WAVES[0]);

    // Transition color grading to hive atmosphere
    this.transitionColorGrading('hive', 5000);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update collectibles
    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) {
        this.collectibleSystem.collect(nearby.id);
      }
    }

    // Update environment effects
    if (this.hiveEntrance && this.envBuilder) {
      this.envBuilder.updateBioLights(this.hiveEntrance.bioLights, this.phaseTime);
    }

    // Update shared hive bioluminescent lights
    if (this.hiveBuilder) {
      updateBiolights(this.hiveBuilder.getBiolights(), this.phaseTime);
    }

    // Update objective markers (periodic update for performance)
    this.objectiveUpdateTimer += deltaTime;
    if (this.objectiveUpdateTimer >= OBJECTIVE_UPDATE_INTERVAL) {
      this.objectiveUpdateTimer = 0;
      this.updateObjectiveMarker();
    }

    // Update Marcus (optimized - always update since he's important)
    this.updateMarcus(deltaTime);

    // Update marine squads (with distance-based optimization)
    this.marineUpdateAccumulator += deltaTime;
    if (this.marineUpdateAccumulator >= 0.05) { // 20Hz update for marines
      this.marineUpdateAccumulator = 0;
      const enemyTargets = this.getEnemyTargets();
      this.marineManager?.update(0.05, this.camera.position, enemyTargets, this.coverPositions);
    }

    // Process marine fire
    this.processMarineFire();

    // Check revive
    this.checkReviveProximity();

    // Update enemies (with performance optimization)
    this.enemyUpdateAccumulator += deltaTime;
    if (this.enemyUpdateAccumulator >= 0.033) { // 30Hz update for enemies
      this.enemyUpdateAccumulator = 0;
      this.updateEnemies(0.033);
    }

    // Update spawning
    this.updateSpawning(deltaTime);

    // Update cooldowns
    if (this.grenadeCooldown > 0) {
      this.grenadeCooldown -= deltaTime * 1000;
    }

    // Phase-specific updates
    switch (this.phase) {
      case 'staging':
        this.updateStagingPhase(deltaTime);
        break;
      case 'field_assault':
        this.updateFieldAssault(deltaTime);
        break;
      case 'breach_point':
        this.updateBreachPoint(deltaTime);
        break;
      case 'entry_push':
        this.updateEntryPush(deltaTime);
        break;
    }

    // Update vehicle if player is in it
    if (this.isInVehicle && this.playerVehicle?.isActive) {
      this.updateVehicle(deltaTime);
    }

    // Check extraction zone in entry_push phase
    if (this.phase === 'entry_push' && !this.levelCompleteTriggered) {
      this.checkExtractionZone();
    }

    // Update player health visual
    this.updatePlayerHealthVisual(this.playerHealth);

    // Update HUD
    this.callbacks.onHealthChange(this.playerHealth);

    // Check for squad rescue opportunity
    if (this.squadOverwhelmedTriggered) {
      this.checkSquadRescue();
    }
  }

  /**
   * Update objective marker position based on current phase
   */
  private updateObjectiveMarker(): void {
    switch (this.phase) {
      case 'field_assault': {
        // Point to next undestroyed AA turret
        const nextTurret = this.aaTurrets.find(t => !t.destroyed);
        if (nextTurret) {
          this.currentObjectiveMarker = nextTurret.position.clone();
        } else {
          // All turrets destroyed - point to breach point
          this.currentObjectiveMarker = new Vector3(0, 0, -400);
        }
        break;
      }
      case 'breach_point':
        // Point to hive entrance
        this.currentObjectiveMarker = new Vector3(0, 0, -550);
        break;
      case 'entry_push':
        // Point to extraction/beachhead zone
        this.currentObjectiveMarker = this.extractionZonePosition.clone();
        break;
    }

    if (this.currentObjectiveMarker) {
      this.callbacks.onObjectiveMarker?.(this.currentObjectiveMarker);
    }
  }

  /**
   * Check if player is in extraction zone
   */
  private checkExtractionZone(): void {
    const dist = Vector3.Distance(this.camera.position, this.extractionZonePosition);
    if (dist <= this.extractionZoneRadius && this.beachheadProgress >= this.beachheadRequired) {
      this.levelCompleteTriggered = true;
      this.triggerLevelComplete();
    }
  }

  // ============================================================================
  // PHASE UPDATES
  // ============================================================================

  private updateStagingPhase(_deltaTime: number): void {
    // Check if player boarded vehicle
    if (this.isInVehicle && this.phaseTime > 3) {
      this.startFieldAssaultPhase();
    }
  }

  private updateFieldAssault(deltaTime: number): void {
    // Update AA turrets
    this.updateAATurrets(deltaTime);

    // Check wave progression with delay between waves
    if (this.enemiesRemaining <= 0 && this.enemiesToSpawn.length === 0) {
      this.waveIndex++;
      if (this.waveIndex < FIELD_WAVES.length) {
        // Small delay before next wave
        setTimeout(() => {
          if (this.phase === 'field_assault') {
            this.spawnWave(FIELD_WAVES[this.waveIndex]);
            this.callbacks.onNotification(`Wave ${this.waveIndex + 1} incoming!`, 3000);
          }
        }, 2000);
      }
    }

    // Scripted ambush at halfway through field
    if (!this.ambushTriggered && this.camera.position.z < -200) {
      this.triggerAmbush();
    }

    // Alert for flying chitin first appearance
    if (!this.flyingChitinAlerted && this.enemies.some(e => e.enemyClass === 'flying' && e.isActive)) {
      this.flyingChitinAlerted = true;
      this.callbacks.onCommsMessage(COMMS.FLYING_CHITIN);
    }

    // Transition to breach point when all turrets destroyed and player is close
    if (this.turretsDestroyed >= this.totalTurrets && this.camera.position.z < -380) {
      this.startBreachPointPhase();
    }

    // Update objective with more detail
    const nearestTurret = this.aaTurrets.find(t => !t.destroyed);
    const turretDistance = nearestTurret
      ? Math.floor(Vector3.Distance(this.camera.position, nearestTurret.position))
      : 0;

    this.callbacks.onObjectiveUpdate(
      'OPEN FIELD ASSAULT',
      `Destroy AA turrets (${this.turretsDestroyed}/${this.totalTurrets})${nearestTurret ? ` - ${turretDistance}m to next target` : ' - Advance!'}`
    );
  }

  private updateBreachPoint(_deltaTime: number): void {
    // Wave progression with notification
    if (this.enemiesRemaining <= 0 && this.enemiesToSpawn.length === 0) {
      this.waveIndex++;
      if (this.waveIndex < BREACH_WAVES.length) {
        setTimeout(() => {
          if (this.phase === 'breach_point') {
            this.spawnWave(BREACH_WAVES[this.waveIndex]);
            this.callbacks.onNotification(`Wave ${this.waveIndex + 1} - Hold the line!`, 3000);
          }
        }, 1500);
      }
    }

    // Alert for armored chitin first appearance
    if (!this.armoredChitinAlerted && this.enemies.some(e => e.enemyClass === 'armored' && e.isActive)) {
      this.armoredChitinAlerted = true;
      this.callbacks.onCommsMessage(COMMS.ARMORED_CHITIN);
    }

    // Update objective with distance to gate
    const distToGate = Math.floor(Math.abs(this.camera.position.z - (-560)));
    this.callbacks.onObjectiveUpdate(
      'BREACH POINT',
      `Clear the entrance - ${distToGate}m to gate`
    );

    // Transition to entry push when player reaches the gate
    if (
      this.camera.position.z < -560 &&
      this.waveIndex >= BREACH_WAVES.length - 1 &&
      this.enemiesRemaining <= 5
    ) {
      this.startEntryPushPhase();
    }
  }

  private updateEntryPush(_deltaTime: number): void {
    // Wave progression
    if (this.enemiesRemaining <= 0 && this.enemiesToSpawn.length === 0) {
      this.waveIndex++;
      if (this.waveIndex < ENTRY_WAVES.length) {
        setTimeout(() => {
          if (this.phase === 'entry_push') {
            this.spawnWave(ENTRY_WAVES[this.waveIndex]);
            this.callbacks.onNotification('More hostiles incoming!', 2000);
          }
        }, 1000);
      }
    }

    // Track beachhead progress with detailed feedback
    const progressPercent = Math.min(100, Math.floor((this.beachheadProgress / this.beachheadRequired) * 100));
    const distToZone = Math.floor(Vector3.Distance(this.camera.position, this.extractionZonePosition));

    let statusText = `Secure the beachhead (${progressPercent}%)`;
    if (progressPercent >= 100) {
      statusText = `Beachhead secured! Move to extraction point (${distToZone}m)`;
    } else if (progressPercent >= 75) {
      statusText = `Almost there! (${progressPercent}%) - Keep pushing!`;
    } else if (progressPercent >= 50) {
      statusText = `Halfway secure (${progressPercent}%) - Hold the line!`;
    }

    this.callbacks.onObjectiveUpdate('ENTRY PUSH', statusText);
  }

  // ============================================================================
  // ENEMY MANAGEMENT
  // ============================================================================

  private spawnWave(config: PhaseWaveConfig): void {
    this.enemiesToSpawn = [];

    if (config.groundChitin > 0) {
      this.enemiesToSpawn.push({ enemyClass: 'ground', count: config.groundChitin });
    }
    if (config.flyingChitin > 0) {
      this.enemiesToSpawn.push({ enemyClass: 'flying', count: config.flyingChitin });
    }
    if (config.armoredChitin > 0) {
      this.enemiesToSpawn.push({ enemyClass: 'armored', count: config.armoredChitin });
    }

    this.waveSpawnTimer = 0;
    this.enemiesRemaining = config.groundChitin + config.flyingChitin + config.armoredChitin;
  }

  private updateSpawning(deltaTime: number): void {
    if (this.enemiesToSpawn.length === 0) return;
    if (this.enemies.filter((e) => e.isActive).length >= this.maxEnemies) return;

    this.waveSpawnTimer += deltaTime;

    // Determine spawn delay based on current wave configs
    const currentWaves =
      this.phase === 'field_assault'
        ? FIELD_WAVES
        : this.phase === 'breach_point'
          ? BREACH_WAVES
          : ENTRY_WAVES;
    const spawnDelay =
      currentWaves[Math.min(this.waveIndex, currentWaves.length - 1)]?.spawnDelay ?? 1.0;

    if (this.waveSpawnTimer >= spawnDelay) {
      this.waveSpawnTimer = 0;

      // Find next group to spawn from
      const group = this.enemiesToSpawn[0];
      if (group && group.count > 0) {
        this.spawnEnemy(group.enemyClass);
        group.count--;
        if (group.count <= 0) {
          this.enemiesToSpawn.shift();
        }
      }
    }
  }

  private async spawnEnemy(enemyClass: EnemyClass): Promise<void> {
    const config = ENEMY_CONFIGS[enemyClass];

    // Determine spawn position based on phase with better distribution
    let spawnPos: Vector3;
    const playerZ = this.camera.position.z;
    const playerX = this.camera.position.x;

    switch (this.phase) {
      case 'field_assault': {
        // Spawn from multiple directions - flanking attacks
        const spawnPattern = Math.random();
        if (spawnPattern < 0.4) {
          // Spawn ahead of player
          spawnPos = new Vector3(
            (Math.random() - 0.5) * 180,
            enemyClass === 'flying' ? 15 + Math.random() * 10 : 0,
            playerZ - 80 - Math.random() * 60
          );
        } else if (spawnPattern < 0.7) {
          // Spawn from left flank
          spawnPos = new Vector3(
            -80 - Math.random() * 40,
            enemyClass === 'flying' ? 12 + Math.random() * 8 : 0,
            playerZ - 30 - Math.random() * 40
          );
        } else {
          // Spawn from right flank
          spawnPos = new Vector3(
            80 + Math.random() * 40,
            enemyClass === 'flying' ? 12 + Math.random() * 8 : 0,
            playerZ - 30 - Math.random() * 40
          );
        }
        break;
      }
      case 'breach_point': {
        // Spawn from hive entrance and flanks
        const spawnSide = Math.random();
        if (spawnSide < 0.6) {
          // Main spawn from entrance
          spawnPos = new Vector3(
            (Math.random() - 0.5) * 80,
            enemyClass === 'flying' ? 12 + Math.random() * 8 : 0,
            -520 - Math.random() * 40
          );
        } else if (spawnSide < 0.8) {
          // Left side spawn
          spawnPos = new Vector3(
            -40 - Math.random() * 20,
            enemyClass === 'flying' ? 10 + Math.random() * 5 : 0,
            playerZ - 20 - Math.random() * 30
          );
        } else {
          // Right side spawn
          spawnPos = new Vector3(
            40 + Math.random() * 20,
            enemyClass === 'flying' ? 10 + Math.random() * 5 : 0,
            playerZ - 20 - Math.random() * 30
          );
        }
        break;
      }
      case 'entry_push':
        // Spawn from deeper in the hive (corridor spawns)
        spawnPos = new Vector3(
          (Math.random() - 0.5) * 25,
          0,
          -630 - Math.random() * 25
        );
        break;
      default:
        spawnPos = new Vector3(0, 0, -100);
    }

    // Choose species based on class
    let speciesId: string;
    switch (enemyClass) {
      case 'ground':
        speciesId = Math.random() > 0.6 ? 'lurker' : 'skitterer';
        break;
      case 'flying':
        speciesId = 'skitterer'; // Flying variant
        break;
      case 'armored':
        speciesId = 'broodmother';
        break;
    }

    const species = ALIEN_SPECIES[speciesId];
    if (!species) return;

    const mesh = await createAlienMesh(this.scene, species, Math.random() * 10000);
    mesh.position = spawnPos;

    // Scale flying enemies smaller
    if (enemyClass === 'flying') {
      mesh.scaling.setAll(0.6);
    }
    // Scale armored enemies larger
    if (enemyClass === 'armored') {
      mesh.scaling.setAll(2.0);
    }

    const enemy: AssaultEnemy = {
      mesh,
      health: config.health,
      maxHealth: config.health,
      position: spawnPos.clone(),
      velocity: Vector3.Zero(),
      species: speciesId,
      enemyClass,
      isActive: true,
      attackCooldown: 0,
      fireRate: config.fireRate,
      damage: config.damage,
      speed: config.speed,
      targetPosition: this.camera.position.clone(),
    };

    this.enemies.push(enemy);

    // Alert callouts for new enemy types
    if (enemyClass === 'flying' && !this.flyingChitinAlerted) {
      this.flyingChitinAlerted = true;
      this.callbacks.onCommsMessage(COMMS.FLYING_CHITIN);
    }
    if (enemyClass === 'armored' && !this.armoredChitinAlerted) {
      this.armoredChitinAlerted = true;
      this.callbacks.onCommsMessage(COMMS.ARMORED_CHITIN);
    }
  }

  private updateEnemies(deltaTime: number): void {
    const playerPos = this.camera.position;
    const activeMarines = this.marineManager?.getActiveMarines() ?? [];

    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;

      // Performance optimization: skip distant enemies
      const distToPlayer = Vector3.Distance(enemy.position, playerPos);
      if (distToPlayer > ENEMY_UPDATE_DISTANCE) {
        // Still move mesh position but skip complex AI
        enemy.mesh.position.copyFrom(enemy.position);
        continue;
      }

      // LOD-based detail: reduce update frequency for distant enemies
      const isClose = distToPlayer < ENEMY_LOD_DISTANCE;

      // Target selection: prioritize player but consider marines
      let targetPos = playerPos.clone();
      let minDist = distToPlayer;
      let targetIsMarine = false;

      // Check marine positions (only for close enemies to save perf)
      if (isClose) {
        for (const marine of activeMarines) {
          const dist = Vector3.Distance(enemy.position, marine.position);
          // Enemies prefer closer targets, but player is more attractive
          if (dist < minDist * 0.8) {
            minDist = dist;
            targetPos = marine.position.clone();
            targetIsMarine = true;
          }
        }
      }

      enemy.targetPosition = targetPos;

      // Move toward target with class-specific behavior
      const moveDir = targetPos.subtract(enemy.position);
      const distance = moveDir.length();

      if (distance > 2) {
        const normalized = moveDir.normalize();

        // Speed varies by enemy class and distance
        let effectiveSpeed = enemy.speed;
        if (enemy.enemyClass === 'armored') {
          // Armored enemies are slower but relentless
          effectiveSpeed = enemy.speed;
        } else if (enemy.enemyClass === 'flying') {
          // Flying enemies strafe more
          effectiveSpeed = enemy.speed * 1.2;
        } else {
          // Ground enemies speed up when close
          effectiveSpeed = distance < 20 ? enemy.speed * 1.3 : enemy.speed;
        }

        const moveAmount = effectiveSpeed * deltaTime;
        enemy.position.addInPlace(normalized.scale(moveAmount));

        // Class-specific movement behaviors
        if (enemy.enemyClass === 'flying') {
          // Flying enemies maintain altitude and bob
          const targetAltitude = 12 + Math.sin(this.phaseTime * 0.5 + enemy.position.x * 0.1) * 5;
          enemy.position.y = Math.max(8, enemy.position.y + (targetAltitude - enemy.position.y) * 0.1);
          // Add strafing motion
          enemy.position.x += Math.sin(this.phaseTime * 3 + enemy.position.z * 0.1) * 0.2;
        } else if (enemy.enemyClass === 'ground') {
          // Ground enemies hug terrain
          enemy.position.y = 0;
        } else if (enemy.enemyClass === 'armored') {
          // Armored enemies are more direct
          enemy.position.y = 0;
        }

        enemy.mesh.position.copyFrom(enemy.position);

        // Face movement direction smoothly
        if (normalized.length() > 0.01) {
          const targetRotY = Math.atan2(normalized.x, normalized.z);
          const currentRotY = (enemy.mesh.rotation as Vector3).y;
          const rotDiff = targetRotY - currentRotY;
          (enemy.mesh.rotation as Vector3).y += rotDiff * Math.min(1, deltaTime * 5);
        }
      }

      // Attack behavior
      enemy.attackCooldown -= deltaTime;
      const attackRange = ENEMY_CONFIGS[enemy.enemyClass].attackRange;

      if (enemy.attackCooldown <= 0 && distance < attackRange) {
        enemy.attackCooldown = 1 / enemy.fireRate;

        // Calculate damage with distance falloff for ranged enemies
        let damage = enemy.damage;
        if (enemy.enemyClass === 'flying') {
          // Flying enemies have ranged attacks with falloff
          damage = enemy.damage * (1 - distance / (attackRange * 2));
        }

        // Determine target: player or marine
        if (!targetIsMarine) {
          this.damagePlayer(damage);
        } else {
          // Damage nearest marine
          const nearestMarine = this.findNearestMarine(enemy.position);
          if (nearestMarine) {
            this.marineManager?.damageMarine(nearestMarine, damage);
          }
        }
      }
    }
  }

  private findNearestMarine(position: Vector3): Marine | null {
    const marines = this.marineManager?.getActiveMarines() ?? [];
    let nearest: Marine | null = null;
    let nearestDist = Infinity;

    for (const marine of marines) {
      const dist = Vector3.Distance(position, marine.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = marine;
      }
    }

    return nearest;
  }

  private killEnemy(enemy: AssaultEnemy): void {
    enemy.isActive = false;
    enemy.health = 0;
    enemy.mesh.setEnabled(false);

    this.enemiesRemaining--;
    this.kills++;
    this.callbacks.onKill();

    // Beachhead progress in entry push
    if (this.phase === 'entry_push') {
      const value = enemy.enemyClass === 'armored' ? 8 : enemy.enemyClass === 'flying' ? 3 : 2;
      this.beachheadProgress += value;
    }

    // Kill streak visual
    this.updateKillStreak(this.kills);
    this.triggerHitConfirmation();

    this.playSound('explosion');
  }

  private getEnemyTargets(): EnemyTarget[] {
    return this.enemies
      .filter((e) => e.isActive)
      .map((e) => ({
        position: e.position.clone(),
        health: e.health,
        threatLevel: (e.enemyClass === 'armored'
          ? 'high'
          : e.enemyClass === 'flying'
            ? 'medium'
            : 'low') as EnemyTarget['threatLevel'],
      }));
  }

  // ============================================================================
  // MARCUS AI
  // ============================================================================

  private updateMarcus(deltaTime: number): void {
    if (!this.marcus) return;

    // Phase-specific positioning
    let targetPos: Vector3;

    switch (this.phase) {
      case 'staging':
        // Stay at staging position
        targetPos = new Vector3(10, 0, -15);
        break;
      case 'field_assault':
        // Flank the player on the right, slightly behind
        targetPos = this.camera.position.add(new Vector3(MARCUS_FOLLOW_DISTANCE, 0, 5));
        break;
      case 'breach_point':
        // Push alongside player during breach
        targetPos = this.camera.position.add(new Vector3(8, 0, 3));
        break;
      case 'entry_push':
        // Hold entrance position - don't follow into the hive
        targetPos = new Vector3(0, 0, -590);
        break;
      default:
        targetPos = this.camera.position.add(new Vector3(8, 0, 5));
    }

    const diff = targetPos.subtract(this.marcus.position);
    const dist = diff.length();

    // Move toward target with speed based on distance
    if (dist > 3) {
      const moveSpeed = dist > 20 ? 18 : 12; // Catch up faster when far away
      const moveDir = diff.normalize();
      this.marcus.position.addInPlace(moveDir.scale(moveSpeed * deltaTime));
      this.marcus.rootNode.position.copyFrom(this.marcus.position);

      // Face movement direction while moving
      this.marcus.rootNode.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    }

    // Leg animation based on movement
    const isMoving = dist > 3;
    if (isMoving) {
      this.marcus.legs.position.y = 1.5 + Math.sin(this.phaseTime * 6) * 0.15;
    } else {
      this.marcus.legs.position.y = 1.5;
    }

    // Combat: find and shoot nearest enemy (prioritize high-threat targets)
    this.marcus.fireTimer -= deltaTime;

    let nearestEnemy: AssaultEnemy | null = null;
    let bestScore = -Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;
      const eDist = Vector3.Distance(this.marcus.position, enemy.position);
      if (eDist > this.marcus.range) continue;

      // Score based on distance, class, and threat to player
      const distToPlayer = Vector3.Distance(enemy.position, this.camera.position);
      let score = 100 - eDist; // Closer is better

      // Prioritize threats to player
      if (distToPlayer < 30) score += 50;

      // Prioritize armored enemies (Marcus can handle them)
      if (enemy.enemyClass === 'armored') score += 30;
      if (enemy.enemyClass === 'flying') score += 20;

      if (score > bestScore) {
        bestScore = score;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy) {
      // Face enemy smoothly
      const lookDir = nearestEnemy.position.subtract(this.marcus.position);
      const targetRotY = Math.atan2(lookDir.x, lookDir.z);
      const rotDiff = targetRotY - this.marcus.rootNode.rotation.y;
      this.marcus.rootNode.rotation.y += rotDiff * Math.min(1, deltaTime * 5);

      // Fire when ready
      if (this.marcus.fireTimer <= 0) {
        this.marcus.fireTimer = 1 / this.marcus.fireRate;
        this.marcus.targetEnemy = nearestEnemy;

        // Arm animation for firing
        this.marcus.rightArm.rotation.x = -0.3;
        setTimeout(() => {
          if (this.marcus) this.marcus.rightArm.rotation.x = 0;
        }, 150);

        // Deal damage to enemy (Marcus deals extra damage to armored)
        const damage = nearestEnemy.enemyClass === 'armored'
          ? this.marcus.damage * 1.5
          : this.marcus.damage;
        nearestEnemy.health -= damage;

        if (nearestEnemy.health <= 0) {
          this.killEnemy(nearestEnemy);
        }

        // Muzzle flash effect and sound
        this.playSound('weapon_fire');
        particleManager.emit('muzzleFlash', this.marcus.position.add(new Vector3(0, 5, 0)));
      }
    }
  }

  // ============================================================================
  // AA TURRETS
  // ============================================================================

  private updateAATurrets(deltaTime: number): void {
    for (const turret of this.aaTurrets) {
      if (turret.destroyed) continue;

      turret.fireTimer -= deltaTime;
      const distToPlayer = Vector3.Distance(turret.position, this.camera.position);

      if (distToPlayer < AA_TURRET_RANGE && turret.fireTimer <= 0) {
        turret.fireTimer = 1 / AA_TURRET_FIRE_RATE;

        // Turret fires at player
        this.damagePlayer(AA_TURRET_DAMAGE);

        // Rotate barrel toward player
        const lookDir = this.camera.position.subtract(turret.position);
        turret.barrelMesh.rotation.x = -Math.atan2(lookDir.y, lookDir.length());

        this.triggerShake(2);
      }
    }
  }

  private damageAATurret(turret: AATurret, damage: number): void {
    turret.health -= damage;

    if (turret.health <= 0 && !turret.destroyed) {
      turret.destroyed = true;
      this.turretsDestroyed++;

      // Visual: collapse the turret
      turret.baseMesh.scaling.y = 0.3;
      turret.barrelMesh.rotation.x = Math.PI / 3;

      const mat = turret.baseMesh.material as StandardMaterial;
      if (mat) {
        mat.emissiveColor = new Color3(0.3, 0.1, 0.05);
      }

      this.callbacks.onCommsMessage(COMMS.AA_DESTROYED(this.turretsDestroyed, this.totalTurrets));
      this.triggerShake(4);
      this.playSound('explosion');
    }
  }

  // ============================================================================
  // VEHICLE CONTROLS
  // ============================================================================

  private mountVehicle(): void {
    if (!this.playerVehicle?.isActive) return;
    if (Vector3.Distance(this.camera.position, this.playerVehicle.rootNode.position) > 6) return;

    this.isInVehicle = true;
    this.camera.position.y = 2.5; // Higher camera in vehicle

    this.callbacks.onNotification('Vehicle mounted. Use WASD to drive.', 3000);
  }

  private dismountVehicle(): void {
    this.isInVehicle = false;
    this.camera.position.y = 1.7;

    this.callbacks.onNotification('Dismounted from vehicle.', 2000);
  }

  private updateVehicle(deltaTime: number): void {
    if (!this.playerVehicle) return;

    // Vehicle follows camera position (player drives)
    this.playerVehicle.rootNode.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.playerVehicle.rootNode.rotation.y = this.rotationY;

    // Vehicle fire
    this.playerVehicle.fireTimer -= deltaTime;

    // Check for fire input (mouse click while in vehicle)
    if (this.touchInput?.isFiring || this.keys.has('Mouse0')) {
      if (this.playerVehicle.fireTimer <= 0) {
        this.playerVehicle.fireTimer = 1 / this.playerVehicle.fireRate;
        this.fireVehicleWeapon();
      }
    }
  }

  private fireVehicleWeapon(): void {
    // Raycast forward from vehicle position
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // Check enemy hits
    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;

      const toEnemy = enemy.position.subtract(this.camera.position);
      const dist = toEnemy.length();
      if (dist > 100) continue;

      const dot = Vector3.Dot(toEnemy.normalize(), forward);
      if (dot > 0.95) {
        enemy.health -= this.playerVehicle!.damage;
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        this.triggerHitConfirmation();
        break;
      }
    }

    // Check AA turret hits
    for (const turret of this.aaTurrets) {
      if (turret.destroyed) continue;

      const toTurret = turret.position.subtract(this.camera.position);
      const dist = toTurret.length();
      if (dist > 120) continue;

      const dot = Vector3.Dot(toTurret.normalize(), forward);
      if (dot > 0.9) {
        this.damageAATurret(turret, this.playerVehicle!.damage);
        this.triggerHitConfirmation();
        break;
      }
    }

    this.playSound('weapon_fire');
    this.triggerShake(1);
  }

  // ============================================================================
  // PLAYER COMBAT
  // ============================================================================

  private handleFire(): void {
    if (this.isInVehicle) {
      this.fireVehicleWeapon();
      return;
    }

    const didFire = fireWeapon();
    if (!didFire) return;

    // Raycast check against enemies
    const forward = new Vector3(
      Math.sin(this.rotationY) * Math.cos(this.rotationX),
      Math.sin(this.rotationX),
      Math.cos(this.rotationY) * Math.cos(this.rotationX)
    );

    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;

      const toEnemy = enemy.position.subtract(this.camera.position);
      const dist = toEnemy.length();
      if (dist > 80) continue;

      const dot = Vector3.Dot(toEnemy.normalize(), forward);
      const hitThreshold = enemy.enemyClass === 'armored' ? 0.92 : 0.95;

      if (dot > hitThreshold) {
        const weaponState = getWeaponActions()?.getState();
        const damage = weaponState ? 25 : 25;
        enemy.health -= damage;

        this.triggerHitConfirmation();
        this.callbacks.onHitMarker?.(damage, false);

        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        break;
      }
    }

    // Check AA turret hits (infantry)
    for (const turret of this.aaTurrets) {
      if (turret.destroyed) continue;

      const toTurret = turret.position.subtract(this.camera.position);
      const dist = toTurret.length();
      if (dist > 80) continue;

      const dot = Vector3.Dot(toTurret.normalize(), forward);
      if (dot > 0.92) {
        this.damageAATurret(turret, 25);
        this.triggerHitConfirmation();
        break;
      }
    }

    this.playSound('weapon_fire');
    this.triggerShake(0.5);
  }

  private handleGrenade(): void {
    if (this.grenadeCooldown > 0) return;
    this.grenadeCooldown = this.grenadeCooldownTime;

    const throwDir = new Vector3(
      Math.sin(this.rotationY),
      0.3,
      Math.cos(this.rotationY)
    ).normalize();
    const impactPos = this.camera.position.add(throwDir.scale(15));

    // Damage enemies in blast radius
    const blastRadius = 8;
    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;

      const dist = Vector3.Distance(enemy.position, impactPos);
      if (dist < blastRadius) {
        const damage = Math.floor(60 * (1 - dist / blastRadius));
        enemy.health -= damage;
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
      }
    }

    this.playSound('explosion');
    this.triggerShake(5, true);
    particleManager.emit('explosion', impactPos);
  }

  private damagePlayer(damage: number): void {
    this.playerHealth -= damage;
    this.callbacks.onHealthChange(this.playerHealth);
    this.callbacks.onDamage();
    this.triggerDamageFlash(damage / 50);
    this.triggerDamageShake(damage);
    this.trackPlayerDamage(damage);

    // Directional damage indicator
    // (Simplified: assumes damage comes from in front)
    this.callbacks.onDirectionalDamage?.(0, damage);

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.onPlayerDeath();
    }
  }

  // ============================================================================
  // MARINE SQUAD HELPERS
  // ============================================================================

  private processMarineFire(): void {
    if (!this.marineManager) return;

    const firingMarines = this.marineManager.getFiringMarines();
    for (const { marine, targetPos } of firingMarines) {
      // Find enemy near target position and deal damage
      for (const enemy of this.enemies) {
        if (!enemy.isActive) continue;

        const dist = Vector3.Distance(enemy.position, targetPos);
        if (dist < 5) {
          enemy.health -= marine.damage;
          if (enemy.health <= 0) {
            this.killEnemy(enemy);
          }
          break;
        }
      }
    }
  }

  private checkReviveProximity(): void {
    if (!this.marineManager) return;

    const downedNearby = this.marineManager.getDownedMarinesNearPlayer(this.camera.position);
    if (downedNearby.length > 0) {
      const marine = downedNearby[0];

      // Check if player is holding interact
      if (this.inputTracker.isActionActive('interact')) {
        this.marineManager.startRevive(marine);

        const progress = Math.floor((marine.reviveProgress / marine.reviveTime) * 100);
        this.callbacks.onNotification(`Reviving ${marine.name}... ${progress}%`, 500);
      } else {
        this.marineManager.cancelRevive(marine);
      }
    }
  }

  // ============================================================================
  // SCRIPTED EVENTS
  // ============================================================================

  private triggerAmbush(): void {
    if (this.ambushTriggered) return;
    this.ambushTriggered = true;

    // Alpha squad gets ambushed
    const alphaSquad = this.marineManager?.getSquad(0);
    if (alphaSquad) {
      this.marineManager?.simulateSquadUnderFire(0, 40);
      this.callbacks.onCommsMessage(COMMS.AMBUSH_ALERT);
    }

    // Spawn enemies around alpha squad
    for (let i = 0; i < 8; i++) {
      this.spawnEnemy('ground');
    }

    this.triggerShake(3);
  }

  private triggerSquadOverwhelmed(): void {
    if (this.squadOverwhelmedTriggered) return;
    this.squadOverwhelmedTriggered = true;

    // Bravo squad gets overwhelmed
    const bravoSquad = this.marineManager?.getSquad(1);
    if (bravoSquad) {
      this.marineManager?.setSquadOverwhelmed(1);
      this.callbacks.onCommsMessage(COMMS.SQUAD_OVERWHELMED);
    }

    // Spawn enemies around bravo squad
    for (let i = 0; i < 10; i++) {
      this.spawnEnemy('ground');
    }
  }

  /**
   * Called when player reaches the overwhelmed squad and kills nearby enemies
   */
  private checkSquadRescue(): void {
    const bravoSquad = this.marineManager?.getSquad(1);
    if (!bravoSquad || bravoSquad.wasRescued) return;

    // Check if player is near bravo and enemies are cleared
    const playerDist = Vector3.Distance(this.camera.position, bravoSquad.position);
    const nearbyEnemies = this.enemies.filter(
      (e) => e.isActive && Vector3.Distance(e.position, bravoSquad.position) < 30
    );

    if (playerDist < 20 && nearbyEnemies.length < 3) {
      this.marineManager?.triggerRescueCallout(bravoSquad);
      this.callbacks.onCommsMessage(COMMS.SQUAD_SAVED);

      // Restore squad orders
      this.marineManager?.issueOrder(bravoSquad, 'follow_player');
      this.marineManager?.setFormation(bravoSquad, 'diamond');
    }
  }

  private triggerLevelComplete(): void {
    this.callbacks.onCommsMessage(COMMS.BEACHHEAD_SECURED);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.MARCUS_FAREWELL);
    }, 5000);

    setTimeout(() => {
      this.completeLevel();
    }, 10000);
  }

  // ============================================================================
  // ACTION BUTTONS
  // ============================================================================

  private registerStagingActions(): void {
    const interact = bindableActionParams('interact');
    const groups: ActionButtonGroup[] = [
      {
        id: 'staging',
        label: 'STAGING',
        position: 'right',
        buttons: [
          createAction('board_vehicle', 'BOARD VEHICLE', interact.key, {
            keyDisplay: interact.keyDisplay,
            variant: 'primary',
            size: 'large',
            highlighted: true,
          }),
        ],
      },
    ];

    this.actionCallback = (actionId: string) => {
      if (actionId === 'board_vehicle') {
        this.mountVehicle();
      }
    };

    this.callbacks.onActionGroupsChange(groups);
    this.callbacks.onActionHandlerRegister(this.actionCallback);
  }

  private registerCombatActions(): void {
    const reload = bindableActionParams('reload');
    const grenade = levelActionParams('grenade');
    const interact = bindableActionParams('interact');

    const groups: ActionButtonGroup[] = [
      {
        id: 'combat',
        label: 'COMBAT',
        position: 'right',
        buttons: [
          createAction('reload', 'RELOAD', reload.key, {
            keyDisplay: reload.keyDisplay,
            variant: 'secondary',
          }),
          createAction('grenade', 'GRENADE', grenade.key, {
            keyDisplay: grenade.keyDisplay,
            variant: 'danger',
            cooldown: this.grenadeCooldownTime,
          }),
          createAction('revive', 'REVIVE', interact.key, {
            keyDisplay: interact.keyDisplay,
            variant: 'primary',
          }),
        ],
      },
      {
        id: 'squad',
        label: 'SQUAD ORDERS',
        position: 'left',
        buttons: [
          createAction('squad_follow', 'FOLLOW', '1', {
            keyDisplay: '1',
            variant: this.squadCommandMode === 'follow' ? 'primary' : 'secondary',
          }),
          createAction('squad_hold', 'HOLD', '2', {
            keyDisplay: '2',
            variant: this.squadCommandMode === 'hold' ? 'primary' : 'secondary',
          }),
          createAction('squad_advance', 'ADVANCE', '3', {
            keyDisplay: '3',
            variant: this.squadCommandMode === 'advance' ? 'primary' : 'secondary',
          }),
        ],
      },
    ];

    this.actionCallback = (actionId: string) => {
      switch (actionId) {
        case 'reload':
          startReload();
          break;
        case 'grenade':
          this.handleGrenade();
          break;
        case 'revive':
          // Handled in checkReviveProximity
          break;
        case 'squad_follow':
          this.issueSquadCommand('follow');
          break;
        case 'squad_hold':
          this.issueSquadCommand('hold');
          break;
        case 'squad_advance':
          this.issueSquadCommand('advance');
          break;
      }
    };

    this.callbacks.onActionGroupsChange(groups);
    this.callbacks.onActionHandlerRegister(this.actionCallback);
  }

  /**
   * Issue a command to all marine squads
   */
  private issueSquadCommand(command: 'follow' | 'hold' | 'advance'): void {
    // Cooldown check to prevent spam
    const now = performance.now();
    if (now - this.lastSquadCommandTime < 1000) return;
    this.lastSquadCommandTime = now;

    this.squadCommandMode = command;

    switch (command) {
      case 'follow':
        this.marineManager?.issueGlobalOrder('follow_player');
        this.callbacks.onNotification('Squad: Following your lead', 2000);
        break;
      case 'hold':
        this.marineManager?.issueGlobalOrder('hold_position');
        this.marineManager?.getSquads().forEach((s) => {
          this.marineManager?.setFormation(s, 'cover');
        });
        this.callbacks.onNotification('Squad: Holding position', 2000);
        break;
      case 'advance':
        // Advance to a position ahead of player
        const advanceTarget = this.camera.position.add(
          new Vector3(0, 0, -50)
        );
        this.marineManager?.issueGlobalOrder('advance', advanceTarget);
        this.marineManager?.getSquads().forEach((s) => {
          this.marineManager?.setFormation(s, 'line');
        });
        this.callbacks.onNotification('Squad: Advancing!', 2000);
        break;
    }

    // Update action button highlights
    this.registerCombatActions();
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Fire on click handled via mouse event
    if (e.code === 'KeyR') {
      startReload();
    }
    if (e.code === 'KeyG') {
      this.handleGrenade();
    }
    if (e.code === 'KeyE') {
      if (this.phase === 'staging') {
        this.mountVehicle();
      }
    }
    if (e.code === 'KeyF') {
      if (this.isInVehicle) {
        this.dismountVehicle();
      }
    }

    // Squad command shortcuts (1, 2, 3)
    if (this.phase !== 'staging') {
      if (e.code === 'Digit1') {
        this.issueSquadCommand('follow');
      }
      if (e.code === 'Digit2') {
        this.issueSquadCommand('hold');
      }
      if (e.code === 'Digit3') {
        this.issueSquadCommand('advance');
      }
    }
  }

  protected override handleClick(): void {
    super.handleClick();

    if (this.isPointerLocked()) {
      this.handleFire();
    }
  }

  protected override getMoveSpeed(): number {
    if (this.isInVehicle) return VEHICLE_SPEED;
    return 8;
  }

  protected override getSprintMultiplier(): number {
    if (this.isInVehicle) return 1.3;
    return 1.5;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  protected override disposeLevel(): void {
    // Dispose flora
    for (const node of this.floraNodes) { node.dispose(false, true); }
    this.floraNodes = [];
    // Dispose collectibles
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;

    super.disposeLevel();

    // Dispose enemies
    for (const enemy of this.enemies) {
      enemy.mesh.dispose();
    }
    this.enemies = [];

    // Dispose Marcus
    if (this.marcus) {
      this.marcus.rootNode.dispose();
      this.marcus = null;
    }

    // Dispose vehicle
    if (this.playerVehicle) {
      this.playerVehicle.rootNode.dispose();
      this.playerVehicle = null;
    }

    // Dispose marine squads
    this.marineManager?.dispose();
    this.marineManager = null;

    // Dispose environment
    this.envBuilder?.dispose();
    this.envBuilder = null;

    // Dispose surface terrain
    if (this.surfaceTerrain) {
      this.surfaceTerrain.mesh.dispose();
      this.surfaceTerrain.material.dispose();
      this.surfaceTerrain = null;
    }

    // Dispose hive environment
    this.hiveBuilder?.dispose();
    this.hiveBuilder = null;

    // Unregister actions
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);
    this.actionCallback = null;

    // Unregister dynamic actions
    unregisterDynamicActions('hive_assault');

    // Remove audio
    this.removeAudioZone('staging');
    this.removeAudioZone('battlefield');
    this.removeAudioZone('hive_entrance');
    this.removeSpatialSound('wind');
  }
}
