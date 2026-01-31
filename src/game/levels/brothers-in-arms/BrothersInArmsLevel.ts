/**
 * BrothersInArmsLevel - Chapter 4: Reunite with Marcus, Wave Combat
 *
 * LEVEL STRUCTURE:
 * 1. REUNION - Emotional cutscene with Marcus
 * 2. WAVE COMBAT - 4 waves of increasing difficulty
 * 3. THE BREACH - Final battle at massive sinkhole entrance
 * 4. TRANSITION - Marcus can't follow into tunnels
 *
 * KEY FEATURES:
 * - Marcus AI ally (8m tall Titan mech)
 * - Wave-based Chitin combat
 * - Open canyon arena (200m x 150m)
 * - The Breach: 100m diameter sinkhole
 * - Orange-red sunset lighting
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { registerDynamicActions, unregisterDynamicActions } from '../../context/useInputActions';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';
import { SkyboxManager, type SkyboxResult } from '../../core/SkyboxManager';

const log = getLogger('BrothersInArms');
import { createEntity, type Entity, removeEntity } from '../../core/ecs';
import { levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { tokens } from '../../utils/designTokens';
import { BaseLevel } from '../BaseLevel';
import { buildFloraFromPlacements, getBrothersFlora } from '../shared/AlienFloraBuilder';
import { buildCollectibles, type CollectibleSystemResult, getBrothersCollectibles } from '../shared/CollectiblePlacer';
import { createDynamicTerrain, CANYON_TERRAIN } from '../shared/SurfaceTerrainFactory';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import {
  buildBattlefieldEnvironment,
  updateBattlefieldLights,
  type BattlefieldResult,
} from './BattlefieldEnvironment';
import { COMMS, NOTIFICATIONS, OBJECTIVES, ReunionCinematic } from './cinematics';
import { MarcusCombatAI, type MarcusCombatState } from './MarcusCombatAI';
import type { CoordinationCombatState } from './MarcusCombatCoordinator';
import { createMarcusBanterManager, type MarcusBanterManager } from './marcusBanter';
import { SquadCommandSystem, type SquadCommand } from '../../ai/SquadCommandSystem';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type LevelPhase = 'reunion' | 'wave_combat' | 'breach_battle' | 'transition';

type MarcusState = 'patrol' | 'combat' | 'dialogue' | 'coordinated';

interface MarcusMech {
  rootNode: TransformNode;
  body: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  legs: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
  targetEnemy: Entity | null;
  state: MarcusState;
  lastFireTime: number;
  fireRate: number;
  damage: number;
  range: number;
}

type EnemyType = 'drone' | 'grunt' | 'spitter' | 'brute';

interface EnemyConfig {
  type: EnemyType;
  health: number;
  damage: number;
  speed: number;
  size: number;
  color: string;
  attackRange: number;
}

interface Wave {
  id: number;
  enemies: { type: EnemyType; count: number }[];
  spawnPoints: Vector3[];
  dialogue: string;
  dialogueSender: string;
}

interface ActiveEnemy {
  entity: Entity;
  mesh: Mesh;
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  lastAttackTime: number;
  targetPosition: Vector3;
  state: 'spawning' | 'moving' | 'attacking' | 'dead';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  drone: {
    type: 'drone',
    health: 25, // Reduced - should be fragile but numerous
    damage: 8,
    speed: 20, // Fast flyers
    size: 0.5,
    color: '#2D4A3E',
    attackRange: 10,
  },
  grunt: {
    type: 'grunt',
    health: 80, // Balanced - standard enemy
    damage: 12,
    speed: 8,
    size: 1.5,
    color: '#3A3A4A',
    attackRange: 10,
  },
  spitter: {
    type: 'spitter',
    health: 45, // Fragile but dangerous ranged
    damage: 30, // Reduced - was too punishing
    speed: 5,
    size: 1.2,
    color: '#3E5A2D',
    attackRange: 30, // Long range
  },
  brute: {
    type: 'brute',
    health: 300, // Increased - should be a real threat
    damage: 35, // Increased - tank enemy should hit hard
    speed: 4, // Slow
    size: 3.0, // Bigger
    color: '#5A2A2A',
    attackRange: 12,
  },
};

const WAVES: Wave[] = [
  {
    // Wave 1: Introduction - Drones only, easy warm-up
    id: 1,
    enemies: [{ type: 'drone', count: 12 }],
    spawnPoints: [],
    dialogue: 'Contacts inbound! Just like the Europa job, eh James?',
    dialogueSender: 'Marcus',
  },
  {
    // Wave 2: Ground combat - Grunts with a few drones
    id: 2,
    enemies: [
      { type: 'grunt', count: 8 },
      { type: 'drone', count: 4 },
    ],
    spawnPoints: [],
    dialogue: 'Grunts incoming! Keep your distance!',
    dialogueSender: 'Marcus',
  },
  {
    // Wave 3: Combined arms - Mixed threats, introduces spitters
    id: 3,
    enemies: [
      { type: 'grunt', count: 6 },
      { type: 'drone', count: 6 },
      { type: 'spitter', count: 3 },
    ],
    spawnPoints: [],
    dialogue: 'Mixed wave! Watch for acid spitters - the green ones!',
    dialogueSender: 'Marcus',
  },
  {
    // Wave 4: Boss wave - Brute with support
    id: 4,
    enemies: [
      { type: 'brute', count: 2 }, // Two brutes for challenge
      { type: 'grunt', count: 5 },
      { type: 'spitter', count: 2 },
      { type: 'drone', count: 8 },
    ],
    spawnPoints: [],
    dialogue: 'Something big is coming... TWO BRUTES! Focus fire, James!',
    dialogueSender: 'Marcus',
  },
];

const ARENA_WIDTH = 200;
const ARENA_DEPTH = 150;
const BREACH_DIAMETER = 100;
const BREACH_POSITION = new Vector3(0, 0, -60);
const MARCUS_START_POSITION = new Vector3(15, 0, 10);
const PLAYER_START_POSITION = new Vector3(0, 1.7, 50); // Consistent player spawn
const WAVE_REST_DURATION = 20000; // 20 seconds between waves (reduced for better pacing)

// ---------------------------------------------------------------------------
// GLB ASSET PATHS -- canyon walls & breach rim debris
// ---------------------------------------------------------------------------

const CANYON_WALL_PATHS = {
  /** Long horizontal wall segment, tiled along N/S boundaries */
  wall_long: '/models/environment/station/wall_hr_15_double.glb',
  /** Shorter wall segment used to fill gaps at E/W boundaries */
  wall_short: '/models/environment/station/wall_hr_1.glb',
  /** Pillar segments placed at wall junctions for visual variety */
  pillar: '/models/environment/station/pillar_hr_8.glb',
} as const;

const BREACH_RIM_PATHS = {
  /** Debris bricks scattered around breach lip */
  debris_bricks: '/models/props/debris/debris_bricks_mx_1.glb',
  /** Gravel piles at breach edge */
  gravel: '/models/props/debris/gravel_pile_hr_1.glb',
  /** Scrap metal fragments */
  scrap: '/models/props/containers/scrap_metal_mx_1.glb',
} as const;

// ---------------------------------------------------------------------------
// GLB ASSET PATHS -- enemy models (Chitin aliens)
// ---------------------------------------------------------------------------

/**
 * Maps enemy types to GLB model paths. These replace the old MeshBuilder
 * primitives (spheres, capsules, boxes) with proper 3D alien models.
 */
const ENEMY_GLB_PATHS: Record<EnemyType, string> = {
  /** Flying drone - fast, small flyer */
  drone: '/models/enemies/chitin/flyingalien.glb',
  /** Grunt - standard ground enemy (lurker/scout type) */
  grunt: '/models/enemies/chitin/scout.glb',
  /** Spitter - ranged acid attacker (spewer/soldier type) */
  spitter: '/models/enemies/chitin/soldier.glb',
  /** Brute - heavy tank enemy (large alien monster) */
  brute: '/models/enemies/chitin/alienmonster.glb',
} as const;

/**
 * Scale factors for enemy GLB models to match gameplay sizes.
 * These are tuned so hitbox and visual size align with ENEMY_CONFIGS.size values.
 */
const ENEMY_GLB_SCALES: Record<EnemyType, number> = {
  drone: 0.4, // Small flying alien scaled down
  grunt: 0.8, // Standard humanoid-sized alien
  spitter: 0.7, // Medium ranged alien
  brute: 1.5, // Large heavy alien
} as const;

// ============================================================================
// LEVEL CLASS
// ============================================================================

export class BrothersInArmsLevel extends BaseLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Phase management
  private phase: LevelPhase = 'reunion';
  private phaseTime = 0;

  // Marcus AI ally
  private marcus: MarcusMech | null = null;
  private marcusCombatAI: MarcusCombatAI | null = null;
  private marcusHealthBar: Mesh | null = null;
  private marcusHealthBarFill: Mesh | null = null;

  // Wave combat
  private currentWave = 0;
  private waveEnemies: ActiveEnemy[] = [];
  private waveComplete = false;
  private waveRestTimer = 0;
  private allWavesComplete = false;
  private totalKills = 0;

  // Environment
  private terrain: Mesh | null = null;
  private terrainMaterial: StandardMaterial | PBRMaterial | null = null;
  private canyonWalls: Mesh[] = [];
  private battlefield: BattlefieldResult | null = null;
  private breachMesh: Mesh | null = null;
  private breachGlow: PointLight | null = null;
  private skyDome: Mesh | null = null;
  private skyboxResult: SkyboxResult | null = null;

  // Combat
  private playerHealth = 100;
  private maxPlayerHealth = 100; // Track max health for percentage calculations
  private fireSuportCooldown = 0;
  private grenadeCooldown = 0;
  private flankCooldown = 0;
  private focusFireCooldown = 0;
  private lastMarcusDamageTime = 0;

  // Marcus coordination state
  private marcusCoordinationState: CoordinationCombatState = 'support';

  // Marcus downed state tracking
  private marcusDownedIndicator: Mesh | null = null;
  private marcusShieldBar: Mesh | null = null;
  private marcusShieldBarFill: Mesh | null = null;

  // Action handler reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Spawn points generated once
  private spawnPoints: Vector3[] = [];

  // Cinematic system
  private reunionCinematic: ReunionCinematic | null = null;
  private cinematicInProgress = false;

  // Marcus banter system - situation-aware dialogue
  private marcusBanterManager: MarcusBanterManager | null = null;

  // Squad command system - player-issued orders to Marcus
  private squadCommandSystem: SquadCommandSystem | null = null;
  private isCommandWheelOpen = false;
  private previousPlayerHealth = 100;
  private previousMarcusHealth = 500;
  private previousMarcusHealthPercent = 1;
  private lastBanterUpdateTime = 0;
  private waveStartEnemyCount = 0;
  private hasSeenBreach = false;
  private hasTriggeredDefendingPosition = false;
  private cinematicSkipped = false; // Allow skipping cinematic

  // Performance tracking
  private enemyUpdateInterval = 0;
  private lastEnemyBatchUpdate = 0;
  private readonly ENEMY_BATCH_UPDATE_INTERVAL = 50; // Update enemies in batches every 50ms

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    // Orange-red sunset sky
    return new Color4(0.85, 0.55, 0.35, 1);
  }

  protected async createEnvironment(): Promise<void> {
    // Initialize AssetManager for GLB loading
    AssetManager.init(this.scene);

    // Override default lighting with sunset-style
    this.setupSunsetLighting();

    // Create base environment
    this.createTerrain();
    await this.createCanyonWalls();
    await this.createBreach();
    this.createSkyDome();
    this.generateSpawnPoints();

    // Build GLB-based battlefield (replaces old MeshBuilder rock pillars)
    // Loads barricades, industrial structures, containers, debris, and decals
    this.battlefield = await buildBattlefieldEnvironment(this.scene);
    log.info(
      `Battlefield built with ${this.battlefield.meshes.length} meshes, ` +
        `${this.battlefield.lights.length} lights, ` +
        `${this.battlefield.supplyCratePositions.length} supply positions`
    );

    // Preload enemy GLB models for wave combat
    await this.preloadEnemyModels();

    // Create Marcus (GLB-based mech model)
    await this.createMarcusMech();

    // Setup camera for FPS - use constant for consistency
    this.camera.position.copyFrom(PLAYER_START_POSITION);
    this.rotationY = Math.PI;
    this.targetRotationY = Math.PI;
    this.camera.rotation.y = this.rotationY;
    // 90 degrees FOV - standard FPS view for outdoor combat
    this.camera.fov = Math.PI / 2;

    // Setup action handler
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Build alien flora
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getBrothersFlora(), floraRoot);

    // Build collectibles
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getBrothersCollectibles(), collectibleRoot);

    // Register dynamic actions for squad commands and coordination with Marcus
    registerDynamicActions('brothers_in_arms', ['squadFollow', 'squadHold', 'squadAttack', 'squadRegroup'], 'squad');

    // Start reunion phase
    this.startReunionPhase();
  }

  private setupSunsetLighting(): void {
    // Remove default lighting
    if (this.sunLight) {
      this.sunLight.dispose();
      this.sunLight = null;
    }
    if (this.ambientLight) {
      this.ambientLight.dispose();
      this.ambientLight = null;
    }

    // Low-angle sunset sun - positioned in the west for authentic dusk feel
    const sunDir = new Vector3(0.7, -0.25, -0.4).normalize();
    const sun = new DirectionalLight('sunsetSun', sunDir, this.scene);
    sun.intensity = 2.8;
    sun.diffuse = Color3.FromHexString('#FF8030'); // Deep orange-red sunset
    sun.specular = Color3.FromHexString('#FFD080');
    this.sunLight = sun;

    // Setup shadow generator for dramatic lighting
    if (sun) {
      sun.autoUpdateExtends = false;
    }

    // Ambient fill with warm tones - slightly purple for dusk sky reflection
    // Note: Using DirectionalLight for consistent ambient fill, not stored in BaseLevel.ambientLight
    const ambientFill = new DirectionalLight('ambientFill', new Vector3(0, 1, 0), this.scene);
    ambientFill.intensity = 0.5;
    ambientFill.diffuse = new Color3(0.45, 0.35, 0.4); // Purple-warm ambient for dusk

    // Add subtle rim light from opposite direction for mech visibility
    const rimLight = new DirectionalLight('rimLight', new Vector3(-0.5, -0.2, 0.5).normalize(), this.scene);
    rimLight.intensity = 0.6;
    rimLight.diffuse = Color3.FromHexString('#4A3060'); // Cool purple rim light
    rimLight.specular = Color3.FromHexString('#2A1040');

    // Store reference (note: we keep this as a separate light, not stored in ambientLight)
  }

  /**
   * Preload all enemy GLB models so spawnEnemy can create instances synchronously.
   * Uses parallel loading for better performance during level init.
   */
  private async preloadEnemyModels(): Promise<void> {
    const enemyPaths = Object.values(ENEMY_GLB_PATHS);
    const uniquePaths = [...new Set(enemyPaths)];

    const loadPromises = uniquePaths.map(async (path) => {
      try {
        if (!AssetManager.isPathCached(path)) {
          await AssetManager.loadAssetByPath(path, this.scene);
        }
      } catch (err) {
        log.warn(`Failed to load enemy GLB: ${path}`, err);
      }
    });

    await Promise.all(loadPromises);

    const loaded = uniquePaths.filter((p) => AssetManager.isPathCached(p)).length;
    log.info(
      `Preloaded ${loaded}/${uniquePaths.length} enemy models`
    );
  }

  private createTerrain(): void {
    // Use SurfaceTerrainFactory for procedural heightmap terrain.
    // Canyon arena with rust-brown rocky terrain, moderate height variation.
    // CANYON_TERRAIN preset includes PBR textures for realistic rock surfaces.
    const { mesh, material } = createDynamicTerrain(this.scene, {
      ...CANYON_TERRAIN,
      size: 220, // Slightly larger than arena for visual continuity
      heightScale: 12, // Moderate height variation - not too rough for combat
      subdivisions: 128, // Higher detail for close-up ground visibility
      seed: 54321,
      materialName: 'brothersCanyonTerrain',
      tintColor: '#8B6B4A', // Warm rust brown matching dusk lighting
      textureUVScale: 0.015, // Larger texture tiles for open battlefield
    });

    this.terrain = mesh;
    this.terrainMaterial = material;

    // Configure terrain for proper rendering
    mesh.receiveShadows = true;
    mesh.checkCollisions = false; // Level handles collisions differently
  }

  private async createCanyonWalls(): Promise<void> {
    // Preload canyon wall GLBs
    await Promise.all([
      AssetManager.loadAssetByPath(CANYON_WALL_PATHS.wall_long, this.scene),
      AssetManager.loadAssetByPath(CANYON_WALL_PATHS.wall_short, this.scene),
      AssetManager.loadAssetByPath(CANYON_WALL_PATHS.pillar, this.scene),
    ]);

    const longLoaded = AssetManager.isPathCached(CANYON_WALL_PATHS.wall_long);
    const shortLoaded = AssetManager.isPathCached(CANYON_WALL_PATHS.wall_short);
    const pillarLoaded = AssetManager.isPathCached(CANYON_WALL_PATHS.pillar);

    if (!longLoaded && !shortLoaded) {
      throw new Error(
        '[BrothersInArms] FATAL: Canyon wall GLBs failed to load. ' +
        `Tried: ${CANYON_WALL_PATHS.wall_long}, ${CANYON_WALL_PATHS.wall_short}`
      );
    }

    // Each GLB wall segment is ~6m wide at scale 1; we tile them along each boundary.
    // We use scale 8 so each segment spans ~48m, and place multiple to cover 300m (1.5x arena).
    const wallScale = 8;
    const segmentWidth = 48; // approximate visual width per instance at scale 8
    const totalLengthNS = ARENA_WIDTH * 1.5; // 300m for N/S walls
    const totalLengthEW = ARENA_DEPTH * 1.5; // 225m for E/W walls
    const wallPath = longLoaded ? CANYON_WALL_PATHS.wall_long : CANYON_WALL_PATHS.wall_short;

    // Helper: tile wall instances along a line
    const tileWall = (
      baseName: string,
      totalLength: number,
      centerX: number,
      centerZ: number,
      rotY: number,
      isEW: boolean,
    ) => {
      const count = Math.ceil(totalLength / segmentWidth) + 1;
      const startOffset = -(count * segmentWidth) / 2;

      for (let i = 0; i < count; i++) {
        const instance = AssetManager.createInstanceByPath(
          wallPath,
          `${baseName}_seg_${i}`,
          this.scene,
          true,
          'environment'
        );
        if (!instance) continue;

        const offset = startOffset + i * segmentWidth;
        if (isEW) {
          // E/W walls: tile along Z axis
          instance.position.set(centerX, 0, centerZ + offset);
        } else {
          // N/S walls: tile along X axis
          instance.position.set(centerX + offset, 0, centerZ);
        }
        instance.rotation.y = rotY;
        instance.scaling.setAll(wallScale);

        // Collect as a Mesh reference for disposal
        this.canyonWalls.push(instance as unknown as Mesh);
      }

      // Add pillar at corners for visual anchoring
      if (pillarLoaded) {
        const pillar = AssetManager.createInstanceByPath(
          CANYON_WALL_PATHS.pillar,
          `${baseName}_pillar`,
          this.scene,
          true,
          'environment'
        );
        if (pillar) {
          pillar.position.set(centerX, 0, centerZ);
          pillar.scaling.setAll(wallScale * 0.8);
          this.canyonWalls.push(pillar as unknown as Mesh);
        }
      }
    };

    // North wall (behind breach)
    tileWall('northWall', totalLengthNS, 0, -ARENA_DEPTH / 2 - 30, 0, false);

    // South wall (behind player start)
    tileWall('southWall', totalLengthNS, 0, ARENA_DEPTH / 2 + 30, Math.PI, false);

    // East wall
    tileWall('eastWall', totalLengthEW, ARENA_WIDTH / 2 + 30, 0, Math.PI / 2, true);

    // West wall
    tileWall('westWall', totalLengthEW, -ARENA_WIDTH / 2 - 30, 0, -Math.PI / 2, true);
  }

  // NOTE: createRockPillars() removed -- replaced by BattlefieldEnvironment.ts
  // which places GLB barricades, industrial structures, containers, debris,
  // fencing, and decals across the arena at close/mid/far cover distances.

  private async createBreach(): Promise<void> {
    // The Breach - massive sinkhole entrance to hive
    // The cylinder and torus are procedural (unique terrain geometry with no GLB match)
    this.breachMesh = MeshBuilder.CreateCylinder(
      'breach',
      {
        height: 50,
        diameter: BREACH_DIAMETER,
        tessellation: 32,
      },
      this.scene
    );

    const breachMat = new StandardMaterial('breachMat', this.scene);
    breachMat.diffuseColor = new Color3(0.15, 0.1, 0.15);
    breachMat.emissiveColor = new Color3(0.05, 0.15, 0.15); // Slight bioluminescent glow
    this.breachMesh.material = breachMat;

    this.breachMesh.position = BREACH_POSITION.clone();
    this.breachMesh.position.y = -25;

    // Create rim around breach (procedural torus -- unique shape)
    const rimMat = new StandardMaterial('rimMat', this.scene);
    rimMat.diffuseColor = Color3.FromHexString('#5A3A5A');
    rimMat.emissiveColor = new Color3(0.1, 0.3, 0.3);

    const rim = MeshBuilder.CreateTorus(
      'breachRim',
      {
        diameter: BREACH_DIAMETER + 5,
        thickness: 4,
        tessellation: 32,
      },
      this.scene
    );
    rim.position = BREACH_POSITION.clone();
    rim.position.y = 0.5;
    rim.rotation.x = Math.PI / 2;
    rim.material = rimMat;

    // Bioluminescent glow from below
    this.breachGlow = new PointLight('breachGlow', BREACH_POSITION.clone(), this.scene);
    this.breachGlow.position.y = -10;
    this.breachGlow.intensity = 1.5;
    this.breachGlow.diffuse = Color3.FromHexString('#4AC8C8');
    this.breachGlow.range = 80;

    // GLB debris ring around breach lip for visual detail
    await Promise.all([
      AssetManager.loadAssetByPath(BREACH_RIM_PATHS.debris_bricks, this.scene),
      AssetManager.loadAssetByPath(BREACH_RIM_PATHS.gravel, this.scene),
      AssetManager.loadAssetByPath(BREACH_RIM_PATHS.scrap, this.scene),
    ]);

    const rimDebrisPaths = [
      BREACH_RIM_PATHS.debris_bricks,
      BREACH_RIM_PATHS.gravel,
      BREACH_RIM_PATHS.scrap,
    ];
    const rimRadius = BREACH_DIAMETER / 2 + 3;
    const debrisCount = 12;

    for (let i = 0; i < debrisCount; i++) {
      const angle = (i / debrisCount) * Math.PI * 2;
      const pathIndex = i % rimDebrisPaths.length;
      const path = rimDebrisPaths[pathIndex];

      if (!AssetManager.isPathCached(path)) continue;

      const instance = AssetManager.createInstanceByPath(
        path,
        `breachRimDebris_${i}`,
        this.scene,
        true,
        'environment'
      );
      if (!instance) continue;

      instance.position.set(
        BREACH_POSITION.x + Math.cos(angle) * rimRadius + (Math.random() - 0.5) * 4,
        0,
        BREACH_POSITION.z + Math.sin(angle) * rimRadius + (Math.random() - 0.5) * 4
      );
      instance.rotation.y = angle + (Math.random() - 0.5) * 0.5;
      const s = 2 + Math.random() * 1.5;
      instance.scaling.setAll(s);
    }
  }

  private createSkyDome(): void {
    // Use SkyboxManager for proper Babylon.js skybox with dusk/sunset atmosphere
    const skyboxManager = new SkyboxManager(this.scene);

    // Try to load HDRI first for best quality
    const hdriPath = '/textures/hdri/dusk_canyon.exr';

    // Create fallback dusk skybox - will be replaced if HDRI loads successfully
    this.skyboxResult = skyboxManager.createFallbackSkybox({
      type: 'dusk',
      size: 12000, // Larger skybox for open battlefield
      useEnvironmentLighting: true,
      environmentIntensity: 0.85, // Balanced for PBR materials
      // Sunset orange with purple horizon - dramatic end-of-day lighting
      tint: new Color3(0.85, 0.5, 0.38),
    });

    this.skyDome = this.skyboxResult.mesh;

    // Apply dusk atmosphere gradient to scene
    this.scene.clearColor = new Color4(0.25, 0.15, 0.2, 1); // Dark purple-brown for dusk
    this.scene.ambientColor = new Color3(0.3, 0.25, 0.25); // Warm ambient
  }

  private generateSpawnPoints(): void {
    // Generate spawn points around arena edges
    // Enemies spawn from multiple directions to create tactical variety
    this.spawnPoints = [];

    // North edge (behind breach) - primary spawn direction
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 25;
      this.spawnPoints.push(new Vector3(x, 0, -ARENA_DEPTH / 2 + 15));
    }

    // East edge
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 25;
      this.spawnPoints.push(new Vector3(ARENA_WIDTH / 2 - 15, 0, z));
    }

    // West edge
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 25;
      this.spawnPoints.push(new Vector3(-ARENA_WIDTH / 2 + 15, 0, z));
    }

    // South-east and south-west flanks (not directly behind player)
    this.spawnPoints.push(new Vector3(ARENA_WIDTH / 2 - 30, 0, ARENA_DEPTH / 2 - 40));
    this.spawnPoints.push(new Vector3(-ARENA_WIDTH / 2 + 30, 0, ARENA_DEPTH / 2 - 40));

    // Breach edge spawn points (for later waves emerging from the pit)
    const breachAngleStep = Math.PI * 2 / 8;
    for (let i = 0; i < 8; i++) {
      const angle = i * breachAngleStep;
      const radius = BREACH_DIAMETER / 2 + 10;
      this.spawnPoints.push(new Vector3(
        BREACH_POSITION.x + Math.cos(angle) * radius,
        0,
        BREACH_POSITION.z + Math.sin(angle) * radius
      ));
    }

    // Assign spawn points to waves - shuffle for variety
    WAVES.forEach((wave) => {
      wave.spawnPoints = [...this.spawnPoints];
      // Shuffle spawn points per wave
      for (let i = wave.spawnPoints.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wave.spawnPoints[i], wave.spawnPoints[j]] = [wave.spawnPoints[j], wave.spawnPoints[i]];
      }
    });

    log.info(`Generated ${this.spawnPoints.length} spawn points`);
  }

  // ============================================================================
  // MARCUS MECH
  // ============================================================================

  private async createMarcusMech(): Promise<void> {
    const root = new TransformNode('marcusRoot', this.scene);
    root.position = MARCUS_START_POSITION.clone();

    // Load the Marcus mech GLB model
    const MECH_GLB_PATH = '/models/vehicles/tea/marcus_mech.glb';

    try {
      await AssetManager.loadAssetByPath(MECH_GLB_PATH, this.scene);
    } catch (err) {
      log.error(`Failed to load marcus_mech.glb: ${err}`);
      // Create fallback mech geometry if GLB fails
      this.createFallbackMarcusMech(root);
      return;
    }

    const mechModel = AssetManager.createInstanceByPath(
      MECH_GLB_PATH,
      'marcusMechInstance',
      this.scene,
      true,
      'vehicle'
    );

    if (mechModel) {
      mechModel.parent = root;
      // Scale GLB to match the ~8m tall mech (adjust if model is a different base size)
      mechModel.scaling.setAll(4);
      mechModel.position.y = 0;

      // Ensure mech is visible and receives proper lighting
      const mechMeshes = mechModel.getChildMeshes();
      for (const mesh of mechMeshes) {
        mesh.receiveShadows = true;
        mesh.isPickable = true;
        // Ensure materials render correctly with sunset lighting
        if (mesh.material && mesh.material instanceof PBRMaterial) {
          mesh.material.environmentIntensity = 1.0;
        }
      }

      log.info(`Marcus mech loaded successfully with ${mechMeshes.length} meshes`);
    } else {
      log.warn('GLB instance creation failed, using fallback');
      this.createFallbackMarcusMech(root);
      return;
    }

    // Create invisible proxy meshes for arms, body, and legs.
    // These are required by MarcusCombatAI for projectile spawn positions
    // (absolutePosition), arm recoil animations (rotation.z), and walk
    // animation (legs.position.y). They are invisible and simply track
    // the correct offsets on the root TransformNode.

    // Body proxy (torso center -- used only for disposal/structure)
    const body = MeshBuilder.CreateBox('mechBody', { width: 0.1, height: 0.1, depth: 0.1 }, this.scene);
    body.visibility = 0;
    body.parent = root;
    body.position.y = 6;

    // Left arm proxy (projectile spawn + recoil)
    const leftArm = MeshBuilder.CreateBox('mechLeftArm', { width: 0.1, height: 0.1, depth: 0.1 }, this.scene);
    leftArm.visibility = 0;
    leftArm.parent = root;
    leftArm.position.set(-3, 5.5, 0);
    leftArm.rotation.z = 0.3;

    // Right arm proxy (projectile spawn + recoil)
    const rightArm = MeshBuilder.CreateBox('mechRightArm', { width: 0.1, height: 0.1, depth: 0.1 }, this.scene);
    rightArm.visibility = 0;
    rightArm.parent = root;
    rightArm.position.set(3, 5.5, 0);
    rightArm.rotation.z = -0.3;

    // Legs proxy (walking animation target)
    const legs = MeshBuilder.CreateBox('mechLegs', { width: 0.1, height: 0.1, depth: 0.1 }, this.scene);
    legs.visibility = 0;
    legs.parent = root;
    legs.position.y = 3;

    this.marcus = {
      rootNode: root,
      body,
      leftArm,
      rightArm,
      legs,
      position: MARCUS_START_POSITION.clone(),
      health: 500,
      maxHealth: 500,
      targetEnemy: null,
      state: 'dialogue',
      lastFireTime: 0,
      fireRate: 2.5, // 2.5 shots per second
      damage: 50,
      range: 80,
    };

    // Initialize the advanced Combat AI system
    this.marcusCombatAI = new MarcusCombatAI(
      this.scene,
      root,
      leftArm,
      rightArm,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onMarcusHealthChange: (health, maxHealth) => {
          this.updateMarcusHealthBar(health, maxHealth);
          if (this.marcus) {
            this.marcus.health = health;
            this.marcus.maxHealth = maxHealth;
          }
          // Trigger banter for Marcus damage/health changes
          this.handleMarcusHealthBanter(health, maxHealth);
        },
        onMarcusShieldChange: (shields, maxShields) => {
          this.updateMarcusShieldBar(shields, maxShields);
        },
        onStateChange: (newState, oldState) => {
          this.onMarcusCombatStateChange(newState, oldState);
        },
        onCoordinatedAttack: (attack) => {
          this.onCoordinatedAttackStarted(attack);
        },
        onNotification: (text, duration) => {
          this.callbacks.onNotification(text, duration);
        },
        onMarcusDowned: () => {
          this.onMarcusDowned();
        },
        onMarcusRevived: () => {
          this.onMarcusRevived();
        },
      },
      {
        maxHealth: 500,
        damage: 50,
        fireRate: 2.5,
        range: 80,
        moveSpeed: 12,
        rotationSpeed: 2,
        repairRate: 8,
        lowHealthThreshold: 0.4,
        criticalHealthThreshold: 0.15,
      }
    );

    // Create Marcus's health bar (floating above mech)
    this.createMarcusHealthBar(root);

    // Initialize the Marcus banter system for situation-aware dialogue
    this.marcusBanterManager = createMarcusBanterManager(
      (message) => this.callbacks.onCommsMessage(message),
      {
        globalCooldown: 4000, // 4 seconds between dialogue to not overwhelm
        banterChance: 0.35, // 35% chance for optional banter
        allowInterrupts: true,
      }
    );

    // Initialize the squad command system for player-issued orders
    this.squadCommandSystem = new SquadCommandSystem(
      this.scene,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onNotification: (text, duration) => this.callbacks.onNotification(text, duration),
        onCommandIssued: (command) => this.onSquadCommandIssued(command),
        onCommandExpired: (command) => this.onSquadCommandExpired(command),
      },
      {
        commandDuration: 30000, // 30 seconds
        followDistance: 12,
        holdPositionTolerance: 3,
        suppressionDuration: 5000,
        regroupSpeedMultiplier: 1.5,
      }
    );
  }

  /**
   * Create fallback Marcus mech using MeshBuilder if GLB fails to load.
   * This ensures the level remains playable even without the GLB model.
   */
  private createFallbackMarcusMech(root: TransformNode): void {
    log.warn('Creating fallback mech geometry');

    // Create the mech body using primitive shapes
    const body = MeshBuilder.CreateBox('mechBody_fallback', { width: 3, height: 4, depth: 2 }, this.scene);
    body.parent = root;
    body.position.y = 6;

    const bodyMat = new PBRMaterial('mechBodyMat', this.scene);
    bodyMat.albedoColor = Color3.FromHexString('#5A5A6A');
    bodyMat.metallic = 0.9;
    bodyMat.roughness = 0.3;
    body.material = bodyMat;

    // Create left arm
    const leftArm = MeshBuilder.CreateCylinder('mechLeftArm_fallback', { height: 4, diameter: 0.8 }, this.scene);
    leftArm.parent = root;
    leftArm.position.set(-2.5, 5.5, 0);
    leftArm.rotation.z = 0.3;
    leftArm.material = bodyMat;

    // Create right arm
    const rightArm = MeshBuilder.CreateCylinder('mechRightArm_fallback', { height: 4, diameter: 0.8 }, this.scene);
    rightArm.parent = root;
    rightArm.position.set(2.5, 5.5, 0);
    rightArm.rotation.z = -0.3;
    rightArm.material = bodyMat;

    // Create legs
    const legs = MeshBuilder.CreateBox('mechLegs_fallback', { width: 2, height: 3, depth: 1.5 }, this.scene);
    legs.parent = root;
    legs.position.y = 2;
    legs.material = bodyMat;

    // Create head/cockpit
    const head = MeshBuilder.CreateBox('mechHead_fallback', { width: 1.5, height: 1.2, depth: 1 }, this.scene);
    head.parent = root;
    head.position.y = 8.5;

    const cockpitMat = new PBRMaterial('mechCockpitMat', this.scene);
    cockpitMat.albedoColor = Color3.FromHexString('#1A4A6A');
    cockpitMat.metallic = 0.5;
    cockpitMat.roughness = 0.1;
    cockpitMat.emissiveColor = Color3.FromHexString('#0A2A4A');
    head.material = cockpitMat;

    // Initialize marcus struct with fallback meshes
    this.marcus = {
      rootNode: root,
      body,
      leftArm,
      rightArm,
      legs,
      position: MARCUS_START_POSITION.clone(),
      health: 500,
      maxHealth: 500,
      targetEnemy: null,
      state: 'dialogue',
      lastFireTime: 0,
      fireRate: 2.5,
      damage: 50,
      range: 80,
    };

    // Initialize combat AI with fallback meshes
    this.marcusCombatAI = new MarcusCombatAI(
      this.scene,
      root,
      leftArm,
      rightArm,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onMarcusHealthChange: (health, maxHealth) => {
          this.updateMarcusHealthBar(health, maxHealth);
          if (this.marcus) {
            this.marcus.health = health;
            this.marcus.maxHealth = maxHealth;
          }
          this.handleMarcusHealthBanter(health, maxHealth);
        },
        onMarcusShieldChange: (shields, maxShields) => {
          this.updateMarcusShieldBar(shields, maxShields);
        },
        onStateChange: (newState, oldState) => {
          this.onMarcusCombatStateChange(newState, oldState);
        },
        onCoordinatedAttack: (attack) => {
          this.onCoordinatedAttackStarted(attack);
        },
        onNotification: (text, duration) => {
          this.callbacks.onNotification(text, duration);
        },
        onMarcusDowned: () => {
          this.onMarcusDowned();
        },
        onMarcusRevived: () => {
          this.onMarcusRevived();
        },
      },
      {
        maxHealth: 500,
        damage: 50,
        fireRate: 2.5,
        range: 80,
        moveSpeed: 12,
        rotationSpeed: 2,
        repairRate: 8,
        lowHealthThreshold: 0.4,
        criticalHealthThreshold: 0.15,
      }
    );

    // Create health bar
    this.createMarcusHealthBar(root);

    // Initialize banter system
    this.marcusBanterManager = createMarcusBanterManager(
      (message) => this.callbacks.onCommsMessage(message),
      {
        globalCooldown: 4000,
        banterChance: 0.35,
        allowInterrupts: true,
      }
    );
  }

  /**
   * Create a health bar that floats above Marcus
   */
  private createMarcusHealthBar(root: TransformNode): void {
    // Background bar
    this.marcusHealthBar = MeshBuilder.CreatePlane(
      'marcusHealthBarBg',
      { width: 4, height: 0.4 },
      this.scene
    );
    this.marcusHealthBar.parent = root;
    this.marcusHealthBar.position.y = 10;
    this.marcusHealthBar.billboardMode = 7; // Always face camera

    const bgMat = new StandardMaterial('healthBarBgMat', this.scene);
    bgMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    bgMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    bgMat.disableLighting = true;
    this.marcusHealthBar.material = bgMat;

    // Shield bar (above health bar)
    this.marcusShieldBar = MeshBuilder.CreatePlane(
      'marcusShieldBarBg',
      { width: 4, height: 0.2 },
      this.scene
    );
    this.marcusShieldBar.parent = this.marcusHealthBar;
    this.marcusShieldBar.position.y = 0.35;

    const shieldBgMat = new StandardMaterial('shieldBarBgMat', this.scene);
    shieldBgMat.diffuseColor = new Color3(0.15, 0.15, 0.25);
    shieldBgMat.emissiveColor = new Color3(0.05, 0.05, 0.15);
    shieldBgMat.disableLighting = true;
    this.marcusShieldBar.material = shieldBgMat;

    // Shield fill
    this.marcusShieldBarFill = MeshBuilder.CreatePlane(
      'marcusShieldBarFill',
      { width: 3.9, height: 0.15 },
      this.scene
    );
    this.marcusShieldBarFill.parent = this.marcusShieldBar;
    this.marcusShieldBarFill.position.z = -0.01;

    const shieldFillMat = new StandardMaterial('shieldBarFillMat', this.scene);
    shieldFillMat.diffuseColor = Color3.FromHexString('#4A9FFF');
    shieldFillMat.emissiveColor = Color3.FromHexString('#2A6FAF');
    shieldFillMat.disableLighting = true;
    this.marcusShieldBarFill.material = shieldFillMat;

    // Health fill bar
    this.marcusHealthBarFill = MeshBuilder.CreatePlane(
      'marcusHealthBarFill',
      { width: 3.9, height: 0.35 },
      this.scene
    );
    this.marcusHealthBarFill.parent = this.marcusHealthBar;
    this.marcusHealthBarFill.position.z = -0.01; // Slightly in front

    const fillMat = new StandardMaterial('healthBarFillMat', this.scene);
    fillMat.diffuseColor = Color3.FromHexString('#4AFF4A');
    fillMat.emissiveColor = Color3.FromHexString('#2A9F2A');
    fillMat.disableLighting = true;
    this.marcusHealthBarFill.material = fillMat;

    // Downed indicator (hidden by default)
    this.marcusDownedIndicator = MeshBuilder.CreatePlane(
      'marcusDownedIndicator',
      { width: 5, height: 1 },
      this.scene
    );
    this.marcusDownedIndicator.parent = root;
    this.marcusDownedIndicator.position.y = 11;
    this.marcusDownedIndicator.billboardMode = 7;
    this.marcusDownedIndicator.visibility = 0;

    const downedMat = new StandardMaterial('downedIndicatorMat', this.scene);
    downedMat.diffuseColor = Color3.FromHexString('#FF4444');
    downedMat.emissiveColor = Color3.FromHexString('#FF2222');
    downedMat.disableLighting = true;
    this.marcusDownedIndicator.material = downedMat;
  }

  /**
   * Update Marcus's shield bar display
   */
  private updateMarcusShieldBar(shields: number, maxShields: number): void {
    if (!this.marcusShieldBarFill) return;

    const percent = shields / maxShields;
    this.marcusShieldBarFill.scaling.x = Math.max(0.01, percent);
    this.marcusShieldBarFill.position.x = (1 - percent) * -1.95;

    // Change opacity based on shield level
    const mat = this.marcusShieldBarFill.material as StandardMaterial;
    if (percent <= 0) {
      mat.alpha = 0.3; // Dim when depleted
    } else {
      mat.alpha = 0.8 + percent * 0.2;
    }
  }

  /**
   * Handle Marcus being downed
   */
  private onMarcusDowned(): void {
    // Show downed indicator with pulsing animation
    if (this.marcusDownedIndicator) {
      this.marcusDownedIndicator.visibility = 1;
      this.animateDownedIndicator();
    }

    // Update objective to show Marcus is down
    this.callbacks.onObjectiveUpdate('HAMMER DOWN', 'Stay close to Marcus to help him recover!');
  }

  /**
   * Handle Marcus reviving
   */
  private onMarcusRevived(): void {
    // Hide downed indicator
    if (this.marcusDownedIndicator) {
      this.marcusDownedIndicator.visibility = 0;
    }

    // Restore objective
    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead').length;
    if (aliveEnemies > 0) {
      this.callbacks.onObjectiveUpdate(
        OBJECTIVES.WAVE_COMBAT.getTitle(this.currentWave + 1, WAVES.length),
        OBJECTIVES.WAVE_COMBAT.getDescription(this.totalKills)
      );
    }
  }

  /**
   * Animate the downed indicator with pulsing effect
   */
  private animateDownedIndicator(): void {
    if (!this.marcusDownedIndicator || this.marcusDownedIndicator.visibility === 0) return;

    const mat = this.marcusDownedIndicator.material as StandardMaterial;
    const time = performance.now() * 0.005;
    const pulse = 0.7 + Math.sin(time) * 0.3;
    mat.alpha = pulse;

    // Also update position based on recovery progress
    if (this.marcusCombatAI?.isDowned()) {
      const progress = this.marcusCombatAI.getDownedRecoveryProgress();
      // Scale the indicator to show recovery progress
      this.marcusDownedIndicator.scaling.x = 1 - progress * 0.5;

      requestAnimationFrame(() => this.animateDownedIndicator());
    }
  }

  /**
   * Update Marcus's health bar display
   */
  private updateMarcusHealthBar(health: number, maxHealth: number): void {
    if (!this.marcusHealthBarFill) return;

    const percent = health / maxHealth;
    this.marcusHealthBarFill.scaling.x = percent;
    this.marcusHealthBarFill.position.x = (1 - percent) * -1.95;

    // Change color based on health
    const mat = this.marcusHealthBarFill.material as StandardMaterial;
    if (percent > 0.6) {
      mat.diffuseColor = Color3.FromHexString('#4AFF4A');
      mat.emissiveColor = Color3.FromHexString('#2A9F2A');
    } else if (percent > 0.3) {
      mat.diffuseColor = Color3.FromHexString('#FFAA00');
      mat.emissiveColor = Color3.FromHexString('#AA6600');
    } else {
      mat.diffuseColor = Color3.FromHexString('#FF4444');
      mat.emissiveColor = Color3.FromHexString('#AA2222');
    }
  }

  /**
   * Handle Marcus health changes for banter triggers
   * This creates emotional reactions to Marcus being hurt
   */
  private handleMarcusHealthBanter(health: number, maxHealth: number): void {
    if (!this.marcusBanterManager) return;

    const healthPercent = health / maxHealth;
    const damage = this.previousMarcusHealth - health;

    // Check for damage taken
    if (damage > 0) {
      this.marcusBanterManager.onMarcusTakeDamage(damage, healthPercent);
    }

    // Check for recovery (health increased)
    if (
      health > this.previousMarcusHealth &&
      this.previousMarcusHealthPercent <= 0.4 &&
      healthPercent > 0.5
    ) {
      this.marcusBanterManager.onMarcusRecovered();
    }

    // Update previous values
    this.previousMarcusHealth = health;
    this.previousMarcusHealthPercent = healthPercent;
  }

  /**
   * Handle Marcus combat state changes
   */
  private onMarcusCombatStateChange(
    newState: MarcusCombatState,
    oldState: MarcusCombatState
  ): void {
    // Update the legacy marcus state to reflect AI state
    if (this.marcus) {
      switch (newState) {
        case 'idle':
        case 'support':
          this.marcus.state = 'patrol';
          break;
        case 'assault':
        case 'defensive':
        case 'suppression':
          this.marcus.state = 'combat';
          break;
        case 'damaged':
        case 'repairing':
        case 'downed':
          this.marcus.state = 'combat'; // Still in combat, just damaged/downed
          break;
      }
    }

    // Show notification for significant state changes
    if (newState === 'repairing') {
      this.callbacks.onNotification('HAMMER REPAIRING', 2000);
    } else if (newState === 'downed') {
      this.callbacks.onNotification('HAMMER IS DOWN!', 3000);
    } else if (oldState === 'repairing') {
      // Exited repairing state (newState is guaranteed to not be 'repairing' in this branch)
      this.callbacks.onNotification('HAMMER BACK ONLINE', 2000);
    } else if (oldState === 'downed') {
      // Recovered from downed state
      this.callbacks.onNotification('HAMMER BACK ONLINE!', 2000);
    }
  }

  /**
   * Handle coordinated attack notifications
   */
  private onCoordinatedAttackStarted(attack: { type: string; targetPosition: Vector3 }): void {
    // Visual indicator for coordinated attacks
    switch (attack.type) {
      case 'focus_fire':
        this.callbacks.onNotification('FOCUS FIRE', 1500);
        break;
      case 'flank':
        this.callbacks.onNotification('FLANKING MANEUVER', 1500);
        break;
      case 'suppress':
        this.callbacks.onNotification('SUPPRESSION FIRE', 1500);
        break;
      case 'cover_player':
        this.callbacks.onNotification('COVERING FIRE', 1500);
        break;
    }
  }

  private updateMarcus(deltaTime: number): void {
    if (!this.marcus) return;

    const playerPos = this.camera.position.clone();
    playerPos.y = 0;
    const playerForward = this.camera.getDirection(Vector3.Forward());

    // Update squad command system
    if (this.squadCommandSystem) {
      this.squadCommandSystem.update(playerPos, playerForward, this.marcus.position);
    }

    // Use the advanced Combat AI system during combat phases
    if (
      this.marcusCombatAI &&
      (this.phase === 'wave_combat' || this.phase === 'breach_battle') &&
      this.marcus.state !== 'dialogue'
    ) {
      // Convert ActiveEnemy[] to Entity[] for the combat AI
      const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead').map((e) => e.entity);

      // Check for squad command overrides
      const movementOverride = this.squadCommandSystem?.getMovementOverride(this.marcus.position);
      const targetOverride = this.squadCommandSystem?.getTargetOverride();
      const fireModeOverride = this.squadCommandSystem?.getFireModeOverride();
      const speedMultiplier = this.squadCommandSystem?.getSpeedMultiplier() ?? 1;

      // Apply squad command effects to combat AI
      if (targetOverride) {
        // Force focus fire on specified target
        this.marcusCombatAI.requestFocusFire(targetOverride);
      }

      if (fireModeOverride === 'suppression') {
        // Trigger suppression fire
        const suppressionDir = this.squadCommandSystem?.getSuppressionDirection();
        if (suppressionDir) {
          const suppressionTarget = playerPos.add(suppressionDir.scale(50));
          this.marcusCombatAI.requestFireSupport(suppressionTarget, 5000);
        }
      }

      // Pass player forward direction for tactical awareness
      this.marcusCombatAI.update(deltaTime, playerPos, aliveEnemies, playerForward);

      // Apply movement override from squad commands
      if (movementOverride) {
        const toTarget = movementOverride.subtract(this.marcus.position);
        toTarget.y = 0;
        const distance = toTarget.length();

        if (distance > 2) {
          toTarget.normalize();
          const moveSpeed = 12 * speedMultiplier * deltaTime;
          this.marcus.position.addInPlace(toTarget.scale(Math.min(moveSpeed, distance)));
          this.marcus.rootNode.position = this.marcus.position.clone();
        }
      } else {
        // Sync position from Combat AI back to legacy marcus struct
        this.marcus.position = this.marcusCombatAI.getPosition();
      }

      this.marcus.health = this.marcusCombatAI.getHealth();
      this.marcus.rootNode.position = this.marcus.position.clone();

      // Walking animation based on movement
      const time = performance.now() * 0.003;
      const aiState = this.marcusCombatAI.getState();
      if (aiState !== 'repairing') {
        this.marcus.legs.position.y = 3 + Math.sin(time) * 0.15;
      }

      return;
    }

    // Fallback to legacy behavior for dialogue/cinematic phases
    switch (this.marcus.state) {
      case 'dialogue':
        // Just face player
        this.faceMarcusTowards(playerPos);
        break;

      case 'patrol':
        // Follow player loosely (stay ~20m away)
        this.marcusFollowPlayer(deltaTime);
        break;

      case 'combat':
        // Target enemies >15m from player, provide covering fire
        this.marcusCombat(deltaTime);
        break;
    }

    // Update root position
    this.marcus.rootNode.position = this.marcus.position.clone();

    // Walking animation when moving
    const time = performance.now() * 0.003;
    if (this.marcus.state !== 'dialogue') {
      this.marcus.legs.position.y = 3 + Math.sin(time) * 0.15;
    }
  }

  private faceMarcusTowards(target: Vector3): void {
    if (!this.marcus) return;

    const direction = target.subtract(this.marcus.position);
    direction.y = 0;

    if (direction.length() > 0.1) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.marcus.rootNode.rotation.y = targetRotation;
    }
  }

  private marcusFollowPlayer(deltaTime: number): void {
    if (!this.marcus) return;

    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    const toPlayer = playerPos.subtract(this.marcus.position);
    const distance = toPlayer.length();

    // Stay between 15-25m from player
    if (distance > 25) {
      toPlayer.normalize();
      this.marcus.position.addInPlace(toPlayer.scale(10 * deltaTime));
      this.faceMarcusTowards(playerPos);
    } else if (distance < 15) {
      toPlayer.normalize();
      this.marcus.position.subtractInPlace(toPlayer.scale(5 * deltaTime));
    }

    // Keep Marcus in arena bounds
    this.marcus.position.x = Math.max(
      -ARENA_WIDTH / 2 + 10,
      Math.min(ARENA_WIDTH / 2 - 10, this.marcus.position.x)
    );
    this.marcus.position.z = Math.max(
      -ARENA_DEPTH / 2 + 10,
      Math.min(ARENA_DEPTH / 2 - 10, this.marcus.position.z)
    );
  }

  private marcusCombat(deltaTime: number): void {
    if (!this.marcus) return;

    // Find enemy >15m from player to target
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    let bestTarget: ActiveEnemy | null = null;
    let bestDistance = Infinity;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const enemyPos = enemy.mesh.position.clone();
      enemyPos.y = 0;

      const distToPlayer = Vector3.Distance(enemyPos, playerPos);
      const distToMarcus = Vector3.Distance(enemyPos, this.marcus.position);

      // Only target enemies >15m from player that are in range
      if (distToPlayer > 15 && distToMarcus < this.marcus.range && distToMarcus < bestDistance) {
        bestDistance = distToMarcus;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      // Face and fire at target
      this.faceMarcusTowards(bestTarget.mesh.position);
      this.marcusFire(bestTarget);
    } else {
      // No valid target, follow player
      this.marcusFollowPlayer(deltaTime);
    }
  }

  private marcusFire(target: ActiveEnemy): void {
    if (!this.marcus) return;

    const now = performance.now();
    const fireInterval = 1000 / this.marcus.fireRate;

    if (now - this.marcus.lastFireTime < fireInterval) return;
    this.marcus.lastFireTime = now;

    // Create projectile from both arms
    const arms = [this.marcus.leftArm, this.marcus.rightArm];

    for (const arm of arms) {
      const startPos = arm.absolutePosition.clone();
      startPos.y -= 2;

      const direction = target.mesh.position.subtract(startPos).normalize();
      const velocity = direction.scale(60);

      // Create projectile mesh
      const projectile = MeshBuilder.CreateSphere(
        'marcusProjectile',
        { diameter: 0.6 },
        this.scene
      );
      projectile.position = startPos;

      const projMat = new StandardMaterial('marcusProjMat', this.scene);
      projMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.brass);
      projMat.disableLighting = true;
      projectile.material = projMat;

      // Arm recoil animation
      const originalZ = arm.rotation.z;
      const recoilAmount = arm.position.x < 0 ? 0.15 : -0.15;
      arm.rotation.z += recoilAmount;

      // Restore arm to original position smoothly
      setTimeout(() => {
        if (this.marcus && arm && !arm.isDisposed()) {
          arm.rotation.z = originalZ;
        }
      }, 100);

      // Create projectile entity
      const projEntity = createEntity({
        transform: {
          position: startPos.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: velocity,
          angular: Vector3.Zero(),
          maxSpeed: 60,
        },
        renderable: {
          mesh: projectile,
          visible: true,
        },
        tags: {
          projectile: true,
          ally: true,
        },
        lifetime: {
          remaining: 3000,
          onExpire: () => {
            projectile.material?.dispose();
            projectile.dispose();
          },
        },
      });

      // Check collision with target after short delay
      setTimeout(() => {
        if (target.state !== 'dead') {
          const dist = Vector3.Distance(projectile.position, target.mesh.position);
          if (dist < target.mesh.scaling.x + 1) {
            target.health -= this.marcus!.damage;
            if (target.health <= 0) {
              this.killEnemy(target, true); // Marcus kill
            }
          }
        }
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
      }, 500);
    }
  }

  // ============================================================================
  // ENEMY MANAGEMENT
  // ============================================================================

  private spawnEnemy(type: EnemyType, position: Vector3): ActiveEnemy {
    const config = ENEMY_CONFIGS[type];
    const glbPath = ENEMY_GLB_PATHS[type];
    const glbScale = ENEMY_GLB_SCALES[type];
    const instanceId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Load GLB instance - throws if not cached or instance creation fails
    let mesh: Mesh;

    if (AssetManager.isPathCached(glbPath)) {
      const instance = AssetManager.createInstanceByPath(
        glbPath,
        instanceId,
        this.scene,
        true, // apply LOD
        'enemy'
      );

      if (instance) {
        // GLB success - create a collision proxy mesh (invisible) for hit detection
        // The TransformNode from GLB does not have geometry for raycasting
        const proxyMesh = MeshBuilder.CreateBox(
          `${instanceId}_proxy`,
          { width: config.size, height: config.size * 1.2, depth: config.size },
          this.scene
        );
        proxyMesh.visibility = 0; // Invisible collision volume
        proxyMesh.isPickable = true;

        // Parent GLB instance to proxy so they move together
        instance.parent = proxyMesh;
        instance.position.set(0, -config.size * 0.5, 0); // Center GLB on proxy
        instance.scaling.setAll(glbScale);

        mesh = proxyMesh;
      } else {
        throw new Error(
          `[BrothersInArms] FATAL: Failed to create instance for enemy GLB: ${glbPath}`
        );
      }
    } else {
      throw new Error(
        `[BrothersInArms] FATAL: Enemy GLB not cached: ${glbPath}. ` +
        `Ensure preloadEnemyModels() completed successfully.`
      );
    }

    mesh.position = position.clone();
    mesh.position.y = config.size / 2;

    // Spawn animation - scale up
    mesh.scaling.setAll(0.1);
    const spawnStart = performance.now();
    const animateSpawn = () => {
      const elapsed = performance.now() - spawnStart;
      const progress = Math.min(elapsed / 500, 1);
      mesh.scaling.setAll(0.1 + progress * 0.9);
      if (progress < 1) requestAnimationFrame(animateSpawn);
    };
    requestAnimationFrame(animateSpawn);

    const entity = createEntity({
      transform: {
        position: position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: config.health,
        max: config.health,
        regenRate: 0,
      },
      tags: {
        enemy: true,
      },
    });

    const enemy: ActiveEnemy = {
      entity,
      mesh,
      type,
      health: config.health,
      maxHealth: config.health,
      speed: config.speed,
      damage: config.damage,
      attackRange: config.attackRange,
      lastAttackTime: 0,
      targetPosition: this.camera.position.clone(),
      state: 'spawning',
    };

    setTimeout(() => {
      enemy.state = 'moving';
    }, 500);

    this.waveEnemies.push(enemy);
    return enemy;
  }

  private updateEnemies(deltaTime: number): void {
    const playerPos = this.camera.position.clone();
    const marcusPos = this.marcus?.position ?? playerPos;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      // Determine target - enemies use different targeting strategies
      const distToPlayer = Vector3.Distance(enemy.mesh.position, playerPos);
      const distToMarcus = Vector3.Distance(enemy.mesh.position, marcusPos);

      // Target selection logic:
      // - Brutes always prioritize Marcus (mech threat)
      // - Spitters prefer the closer target to stay at range
      // - Grunts split attention (30% target Marcus if he's closer)
      // - Drones swarm the player
      let shouldTargetMarcus = false;
      if (this.marcus && this.marcusCombatAI && !this.marcusCombatAI.isDowned()) {
        if (enemy.type === 'brute') {
          // Brutes always target Marcus as the bigger threat
          shouldTargetMarcus = true;
        } else if (enemy.type === 'spitter') {
          // Spitters target whoever is at optimal range (25-35m)
          const optimalRange = 30;
          const playerRangeDiff = Math.abs(distToPlayer - optimalRange);
          const marcusRangeDiff = Math.abs(distToMarcus - optimalRange);
          shouldTargetMarcus = marcusRangeDiff < playerRangeDiff;
        } else if (enemy.type === 'grunt') {
          // Grunts split attention
          shouldTargetMarcus = distToMarcus < distToPlayer * 0.8 && Math.random() < 0.35;
        }
        // Drones always target player (shouldTargetMarcus stays false)
      }

      const targetPos = shouldTargetMarcus ? marcusPos : playerPos;
      enemy.targetPosition = targetPos.clone();

      const toTarget = enemy.targetPosition.subtract(enemy.mesh.position);
      toTarget.y = 0;
      const distance = toTarget.length();

      // Face target
      if (distance > 0.1) {
        const targetRotation = Math.atan2(toTarget.x, toTarget.z);
        enemy.mesh.rotation.y = targetRotation;
      }

      // Move or attack
      if (distance > enemy.attackRange) {
        // Move towards target
        enemy.state = 'moving';
        toTarget.normalize();
        enemy.mesh.position.addInPlace(toTarget.scale(enemy.speed * deltaTime));
      } else {
        // Attack target
        enemy.state = 'attacking';
        const now = performance.now();
        const attackInterval = enemy.type === 'spitter' ? 2000 : 1000;

        if (now - enemy.lastAttackTime > attackInterval) {
          enemy.lastAttackTime = now;

          if (shouldTargetMarcus && this.marcusCombatAI) {
            // Attack Marcus
            if (enemy.type === 'spitter') {
              this.spawnEnemyProjectileAtMarcus(enemy);
            } else {
              // Melee attack on Marcus - brutes deal 50% more damage
              const damage = enemy.damage * (enemy.type === 'brute' ? 1.5 : 1);
              this.marcusCombatAI.takeDamage(damage);
              this.lastMarcusDamageTime = now;
            }
          } else {
            // Attack player
            if (enemy.type === 'spitter') {
              this.spawnEnemyProjectile(enemy);
            } else {
              // Melee attack - direct damage
              this.playerHealth -= enemy.damage;
              this.callbacks.onHealthChange(this.playerHealth);
              this.callbacks.onDamage();
              this.triggerDamageShake(enemy.damage);

              if (this.playerHealth <= 0) {
                this.callbacks.onNotification('CRITICAL DAMAGE - MISSION FAILED', 3000);
              }
            }
          }
        }
      }

      // Update entity transform
      if (enemy.entity.transform) {
        enemy.entity.transform.position = enemy.mesh.position.clone();
      }
    }
  }

  /**
   * Spawn acid projectile targeting Marcus's mech.
   * Projectile tracks toward Marcus with proper collision detection.
   */
  private spawnEnemyProjectileAtMarcus(enemy: ActiveEnemy): void {
    if (!this.marcus || !this.marcusCombatAI) return;

    const startPos = enemy.mesh.position.clone();
    startPos.y += 0.5;

    // Target Marcus's torso (higher up on the mech)
    const targetPos = this.marcus.position.clone();
    targetPos.y += 4;
    const direction = targetPos.subtract(startPos).normalize();
    const velocity = direction.scale(22); // Slightly faster for mech targeting

    const projectile = MeshBuilder.CreateSphere('acidBoltMarcus', { diameter: 0.4 }, this.scene);
    projectile.position = startPos;

    const projMat = new StandardMaterial('acidMatMarcus', this.scene);
    projMat.emissiveColor = Color3.FromHexString('#AAFF00');
    projMat.disableLighting = true;
    projectile.material = projMat;

    const projEntity = createEntity({
      transform: {
        position: startPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: 20,
      },
      renderable: {
        mesh: projectile,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          projectile.material?.dispose();
          projectile.dispose();
        },
      },
    });

    // Check collision with Marcus
    const checkCollision = () => {
      if (projectile.isDisposed() || !this.marcus || !this.marcusCombatAI) return;

      const dist = Vector3.Distance(projectile.position, this.marcus.position);
      if (dist < 4) {
        // Hit Marcus - apply damage
        this.marcusCombatAI.takeDamage(enemy.damage);
        this.lastMarcusDamageTime = performance.now();
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
        return;
      }

      // Update projectile position
      projectile.position.addInPlace(velocity.scale(0.016));

      if (!projectile.isDisposed()) {
        requestAnimationFrame(checkCollision);
      }
    };
    requestAnimationFrame(checkCollision);
  }

  private spawnEnemyProjectile(enemy: ActiveEnemy): void {
    const startPos = enemy.mesh.position.clone();
    startPos.y += 0.5;

    const direction = this.camera.position.subtract(startPos).normalize();
    const velocity = direction.scale(20);

    const projectile = MeshBuilder.CreateSphere('acidBolt', { diameter: 0.4 }, this.scene);
    projectile.position = startPos;

    const projMat = new StandardMaterial('acidMat', this.scene);
    projMat.emissiveColor = Color3.FromHexString('#AAFF00');
    projMat.disableLighting = true;
    projectile.material = projMat;

    // Track projectile for collision
    const projEntity = createEntity({
      transform: {
        position: startPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: 20,
      },
      renderable: {
        mesh: projectile,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          projectile.material?.dispose();
          projectile.dispose();
        },
      },
    });

    // Check collision with player - use proper delta time
    let lastTime = performance.now();
    const checkCollision = () => {
      if (projectile.isDisposed()) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap at 50ms to prevent huge jumps
      lastTime = now;

      const dist = Vector3.Distance(projectile.position, this.camera.position);
      if (dist < 1.8) { // Slightly larger hitbox for fairness
        this.playerHealth -= enemy.damage;
        this.playerHealth = Math.max(0, this.playerHealth); // Clamp to 0
        this.callbacks.onHealthChange(this.playerHealth);
        this.callbacks.onDamage();
        this.triggerDamageShake(enemy.damage);
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);

        // Check for player death
        if (this.playerHealth <= 0) {
          this.callbacks.onNotification('CRITICAL DAMAGE - MISSION FAILED', 3000);
          // Note: Death handling is done via health reaching 0
          // The game loop monitors health and triggers death screen
        }
        return;
      }

      // Update projectile position with delta time
      projectile.position.addInPlace(velocity.scale(dt));

      // Check if projectile is out of bounds
      if (projectile.position.y < -10 || Math.abs(projectile.position.x) > ARENA_WIDTH || Math.abs(projectile.position.z) > ARENA_DEPTH) {
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
        return;
      }

      if (!projectile.isDisposed()) {
        requestAnimationFrame(checkCollision);
      }
    };
    requestAnimationFrame(checkCollision);
  }

  private killEnemy(enemy: ActiveEnemy, killedByMarcus: boolean = false): void {
    if (enemy.state === 'dead') return;

    enemy.state = 'dead';
    this.totalKills++;
    this.callbacks.onKill();

    // Trigger banter for the kill
    if (this.marcusBanterManager) {
      if (killedByMarcus) {
        this.marcusBanterManager.onMarcusKill();
      } else {
        this.marcusBanterManager.onPlayerKill(enemy.type);
      }
    }

    // Death animation
    const startY = enemy.mesh.position.y;
    const startTime = performance.now();

    const animateDeath = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 300, 1);

      enemy.mesh.scaling.setAll(1 - progress);
      enemy.mesh.position.y = startY - progress * 0.5;

      if (progress < 1) {
        requestAnimationFrame(animateDeath);
      } else {
        enemy.mesh.dispose();
        removeEntity(enemy.entity);
      }
    };
    requestAnimationFrame(animateDeath);
  }

  // ============================================================================
  // WAVE MANAGEMENT
  // ============================================================================

  private startWave(waveIndex: number): void {
    if (waveIndex >= WAVES.length) {
      this.allWavesComplete = true;
      return;
    }

    const wave = WAVES[waveIndex];
    this.currentWave = waveIndex;
    this.waveComplete = false;

    // Send wave-specific dialogue using COMMS module
    const waveComms = [
      COMMS.WAVE_1_START,
      COMMS.WAVE_2_START,
      COMMS.WAVE_3_START,
      COMMS.WAVE_4_START,
    ];
    if (waveIndex < waveComms.length) {
      this.callbacks.onCommsMessage(waveComms[waveIndex]);
    }

    this.callbacks.onNotification(NOTIFICATIONS.WAVE_INCOMING(wave.id), 2000);
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.WAVE_COMBAT.getTitle(wave.id, WAVES.length),
      OBJECTIVES.WAVE_COMBAT.getDescription(this.totalKills)
    );

    // Set Marcus to combat mode
    if (this.marcus) {
      this.marcus.state = 'combat';
    }

    // Track starting enemy count for wave progress banter
    const totalWaveEnemies = wave.enemies.reduce((sum, e) => sum + e.count, 0);
    this.waveStartEnemyCount = totalWaveEnemies;

    // Notify banter system about wave start
    const isFinalWave = waveIndex === WAVES.length - 1;
    if (this.marcusBanterManager) {
      this.marcusBanterManager.onWaveStart(waveIndex + 1, isFinalWave);
    }

    // Spawn enemies
    let spawnIndex = 0;
    wave.enemies.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        const spawnPoint = wave.spawnPoints[spawnIndex % wave.spawnPoints.length];
        const offset = new Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
        const position = spawnPoint.add(offset);

        // Stagger spawns
        const spawnDelay = spawnIndex * 200;
        setTimeout(() => {
          const spawnedEnemy = this.spawnEnemy(type, position);

          // Trigger banter for special enemy types when they first spawn
          if (this.marcusBanterManager && i === 0) {
            if (type === 'brute') {
              this.marcusBanterManager.onEnemySpotted('brute', count);
            } else if (type === 'spitter') {
              this.marcusBanterManager.onEnemySpotted('spitter', count);
            } else if (type === 'drone' && count >= 5) {
              this.marcusBanterManager.onEnemySpotted('drone', count);
            }
          }
        }, spawnDelay);

        spawnIndex++;
      }
    });
  }

  private checkWaveComplete(): boolean {
    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead');
    return aliveEnemies.length === 0 && !this.waveComplete;
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  private startReunionPhase(): void {
    this.phase = 'reunion';
    this.phaseTime = 0;
    this.cinematicInProgress = true;

    // Unlock Reunited achievement - Marcus found!
    getAchievementManager().onMarcusFound();

    // Create and start the reunion cinematic
    this.reunionCinematic = new ReunionCinematic(
      this.scene,
      this.camera,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onNotification: (text, duration) => this.callbacks.onNotification(text, duration),
        onObjectiveUpdate: (title, instructions) =>
          this.callbacks.onObjectiveUpdate(title, instructions),
        onCinematicStart: () => {
          this.callbacks.onCinematicStart?.();
          this.cinematicInProgress = true;
        },
        onCinematicEnd: () => {
          this.callbacks.onCinematicEnd?.();
          this.cinematicInProgress = false;
          // Transition to wave combat after cinematic
          this.startWaveCombatPhase();
        },
        onShakeCamera: (intensity) => this.triggerShake(intensity),
      },
      this.marcus?.rootNode ?? null
    );

    this.reunionCinematic.play();
  }

  private startWaveCombatPhase(): void {
    this.phase = 'wave_combat';
    this.phaseTime = 0;

    // Reset camera to gameplay position if coming from cinematic
    this.camera.position.set(0, 1.7, 50);
    this.rotationY = Math.PI;
    this.targetRotationY = Math.PI;
    this.camera.rotation.y = this.rotationY;
    // 90 degrees FOV - standard FPS view for outdoor combat
    this.camera.fov = Math.PI / 2;

    // Setup combat action buttons
    this.updateActionButtons('combat');

    // Notify gameplay transition
    this.callbacks.onNotification('COMBAT INITIATED', 2000);

    // Start first wave after short delay
    setTimeout(() => {
      this.startWave(0);
    }, 2000);
  }

  private startBreachBattlePhase(): void {
    this.phase = 'breach_battle';
    this.phaseTime = 0;

    this.callbacks.onNotification(NOTIFICATIONS.THE_BREACH, 3000);
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.BREACH_BATTLE.title,
      OBJECTIVES.BREACH_BATTLE.description
    );

    this.callbacks.onCommsMessage(COMMS.BREACH_APPROACH);

    // Final wave already completed - now player must enter breach
    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.BREACH_CLEARED);
    }, 3000);

    setTimeout(() => {
      this.startTransitionPhase();
    }, 6000);
  }

  private startTransitionPhase(): void {
    this.phase = 'transition';
    this.phaseTime = 0;
    this.cinematicInProgress = true;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.ENTER_BREACH.title,
      OBJECTIVES.ENTER_BREACH.description
    );

    // Marcus dialogue about not being able to follow
    this.callbacks.onCommsMessage(COMMS.TRANSITION_START);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.TRANSITION_FAREWELL);
    }, 4000);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.TRANSITION_FINAL);
    }, 8000);

    setTimeout(() => {
      this.callbacks.onCinematicEnd?.();
      this.cinematicInProgress = false;

      // Update objective to enter breach
      this.callbacks.onNotification(NOTIFICATIONS.ENTER_THE_BREACH, 2000);
    }, 12000);
  }

  // ============================================================================
  // ACTION HANDLING
  // ============================================================================

  private handleAction(actionId: string): void {
    // Ignore actions during cinematics
    if (this.cinematicInProgress) return;

    switch (actionId) {
      case 'grenade':
        if (this.grenadeCooldown <= 0) {
          this.throwGrenade();
          this.grenadeCooldown = 5000;
        }
        break;

      case 'melee':
        this.meleeAttack();
        break;

      case 'call_marcus':
        if (this.marcusCombatAI?.isDowned()) {
          this.callbacks.onNotification('MARCUS IS DOWN - CANNOT PROVIDE SUPPORT', 2000);
        } else if (this.fireSuportCooldown <= 0 && this.marcus) {
          this.callFireSupport();
          this.fireSuportCooldown = 25000; // 25 seconds cooldown
        } else if (this.fireSuportCooldown > 0) {
          const secondsLeft = Math.ceil(this.fireSuportCooldown / 1000);
          this.callbacks.onNotification(`FIRE SUPPORT ON COOLDOWN: ${secondsLeft}s`, 1500);
        }
        break;

      case 'focus_fire':
        if (this.focusFireCooldown <= 0 && this.marcusCombatAI) {
          this.requestFocusFire();
          this.focusFireCooldown = 10000;
        }
        break;

      case 'flank':
        if (this.flankCooldown <= 0 && this.marcusCombatAI) {
          this.requestFlank();
          this.flankCooldown = 20000;
        }
        break;

      case 'marcus_aggressive':
        this.setMarcusCoordinationState('aggressive');
        break;

      case 'marcus_defensive':
        this.setMarcusCoordinationState('defensive');
        break;

      case 'marcus_support':
        this.setMarcusCoordinationState('support');
        break;

      case 'open_command_wheel':
        this.openCommandWheel();
        break;

      case 'close_command_wheel':
        this.closeCommandWheel();
        break;

      case 'cancel_command':
        this.squadCommandSystem?.cancelCommand();
        break;
    }
  }

  // ============================================================================
  // SQUAD COMMAND SYSTEM
  // ============================================================================

  /**
   * Open the command wheel (called when Tab is pressed)
   */
  private openCommandWheel(): void {
    if (this.isCommandWheelOpen || !this.squadCommandSystem) return;
    if (this.cinematicInProgress) return;
    if (this.marcusCombatAI?.isDowned()) {
      this.callbacks.onNotification('MARCUS IS DOWN - COMMANDS UNAVAILABLE', 1500);
      return;
    }

    this.isCommandWheelOpen = true;
    this.squadCommandSystem.openCommandWheel();

    // Notify UI to show command wheel
    this.callbacks.onSquadCommandWheelChange?.(true, null);
  }

  /**
   * Close the command wheel and issue selected command
   */
  private closeCommandWheel(): void {
    if (!this.isCommandWheelOpen || !this.squadCommandSystem) return;

    const selectedCommand = this.squadCommandSystem.closeCommandWheel();
    this.isCommandWheelOpen = false;

    // Handle special commands that need target info
    if (selectedCommand === 'ATTACK_TARGET') {
      this.issueAttackTargetCommand();
    } else if (selectedCommand === 'HOLD_POSITION' && this.marcus) {
      // Set hold position at Marcus's current location
      this.squadCommandSystem.issueCommand('HOLD_POSITION', undefined, this.marcus.position);
    }

    // Notify UI to hide command wheel
    this.callbacks.onSquadCommandWheelChange?.(false, selectedCommand);
  }

  /**
   * Update command wheel selection based on mouse position
   */
  updateCommandWheelSelection(angle: number, distance: number): void {
    if (!this.isCommandWheelOpen || !this.squadCommandSystem) return;

    this.squadCommandSystem.updateCommandWheelSelection(angle, distance);

    // Notify UI of selection change
    const selectedCommand = this.squadCommandSystem.getSelectedCommand();
    this.callbacks.onSquadCommandWheelChange?.(true, selectedCommand);
  }

  /**
   * Issue ATTACK_TARGET command on the enemy under crosshair
   */
  private issueAttackTargetCommand(): void {
    if (!this.squadCommandSystem) return;

    // Find enemy under crosshair
    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());

    let bestTarget: ActiveEnemy | null = null;
    let bestScore = -1;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      toEnemy.normalize();

      // Score based on alignment with crosshair
      const alignment = Vector3.Dot(forward, toEnemy);
      const score = alignment * 100 - dist;

      if (alignment > 0.7 && score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      this.squadCommandSystem.issueCommand(
        'ATTACK_TARGET',
        bestTarget.entity,
        bestTarget.mesh.position
      );
    } else {
      this.callbacks.onNotification('NO TARGET IN CROSSHAIRS', 1000);
    }
  }

  /**
   * Called when a squad command is issued
   */
  private onSquadCommandIssued(command: SquadCommand): void {
    log.info(`Squad command issued: ${command}`);

    // Update action buttons to reflect active command
    if (this.phase === 'wave_combat' || this.phase === 'breach_battle') {
      this.updateActionButtons('combat');
    }
  }

  /**
   * Called when a squad command expires
   */
  private onSquadCommandExpired(command: SquadCommand): void {
    log.info(`Squad command expired: ${command}`);

    // Return Marcus to autonomous behavior
    // The SquadCommandSystem will return null for getMovementOverride
  }

  /**
   * Check if command wheel is open
   */
  isSquadCommandWheelOpen(): boolean {
    return this.isCommandWheelOpen;
  }

  /**
   * Get currently selected command in wheel
   */
  getSelectedSquadCommand(): SquadCommand | null {
    return this.squadCommandSystem?.getSelectedCommand() ?? null;
  }

  /**
   * Request focus fire on nearest enemy
   */
  private requestFocusFire(): void {
    if (!this.marcusCombatAI) return;

    // Find the nearest enemy to player's crosshair direction
    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());

    let bestTarget: ActiveEnemy | null = null;
    let bestScore = -1;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      toEnemy.normalize();

      // Score based on alignment with crosshair and distance
      const alignment = Vector3.Dot(forward, toEnemy);
      const score = alignment * 100 - dist;

      if (alignment > 0.5 && score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      const request = this.marcusCombatAI.requestFocusFire(bestTarget.entity);
      if (request) {
        this.callbacks.onNotification('FOCUS FIRE REQUESTED', 1500);
      }
    } else {
      this.callbacks.onNotification('NO TARGET IN SIGHT', 1000);
    }
  }

  /**
   * Request flanking maneuver
   */
  private requestFlank(): void {
    if (!this.marcusCombatAI) return;

    // Find highest threat enemy group
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    const threatCenter = Vector3.Zero();
    let threatCount = 0;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const dist = Vector3.Distance(enemy.mesh.position, playerPos);
      if (dist < 50) {
        threatCenter.addInPlace(enemy.mesh.position);
        threatCount++;
      }
    }

    if (threatCount > 0) {
      threatCenter.scaleInPlace(1 / threatCount);
      const request = this.marcusCombatAI.requestFlank(threatCenter);
      if (request) {
        this.callbacks.onNotification('FLANKING MANEUVER', 1500);
      }
    }
  }

  /**
   * Set Marcus's coordination combat state
   */
  private setMarcusCoordinationState(state: CoordinationCombatState): void {
    if (!this.marcusCombatAI) return;

    this.marcusCoordinationState = state;
    this.marcusCombatAI.setCoordinationState(state);

    // Show notification
    const stateNames: Record<CoordinationCombatState, string> = {
      aggressive: 'AGGRESSIVE',
      defensive: 'DEFENSIVE',
      support: 'SUPPORT',
      damaged: 'DAMAGED',
    };
    this.callbacks.onNotification(`MARCUS: ${stateNames[state]} MODE`, 1500);
  }

  private throwGrenade(): void {
    this.callbacks.onNotification(NOTIFICATIONS.GRENADE_OUT, 1000);

    // Create grenade projectile
    const startPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());
    const throwVelocity = forward.scale(30).add(new Vector3(0, 10, 0));

    const grenade = MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene);
    grenade.position = startPos.add(forward.scale(1));

    const grenadeMat = new StandardMaterial('grenadeMat', this.scene);
    grenadeMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
    grenade.material = grenadeMat;

    // Animate grenade flight
    const velocity = throwVelocity.clone();
    const gravity = new Vector3(0, -40, 0);
    const startTime = performance.now();

    const animateGrenade = () => {
      const dt = 0.016;
      velocity.addInPlace(gravity.scale(dt));
      grenade.position.addInPlace(velocity.scale(dt));

      // Ground collision
      if (grenade.position.y <= 0.3) {
        // Explode
        this.explodeGrenade(grenade.position.clone());
        grenade.dispose();
        return;
      }

      // Timeout after 3 seconds
      if (performance.now() - startTime > 3000) {
        this.explodeGrenade(grenade.position.clone());
        grenade.dispose();
        return;
      }

      requestAnimationFrame(animateGrenade);
    };
    requestAnimationFrame(animateGrenade);
  }

  private explodeGrenade(position: Vector3): void {
    // Explosion effect
    const explosion = MeshBuilder.CreateSphere('explosion', { diameter: 2 }, this.scene);
    explosion.position = position;

    const explosionMat = new StandardMaterial('explosionMat', this.scene);
    explosionMat.emissiveColor = Color3.FromHexString('#FF8800');
    explosionMat.disableLighting = true;
    explosion.material = explosionMat;

    // Damage enemies in radius
    const damageRadius = 10;
    const damage = 75;
    let grenadeKills = 0;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const dist = Vector3.Distance(enemy.mesh.position, position);
      if (dist < damageRadius) {
        const damageAmount = damage * (1 - dist / damageRadius);
        enemy.health -= damageAmount;

        if (enemy.health <= 0) {
          this.killEnemy(enemy);
          grenadeKills++;
        }
      }
    }

    // Trigger banter for grenade kills
    if (this.marcusBanterManager && grenadeKills > 0) {
      this.marcusBanterManager.onGrenadeKill(grenadeKills);
      if (grenadeKills >= 2) {
        this.marcusBanterManager.onMultiKill();
      }
    }

    // Animate explosion
    const startTime = performance.now();
    const animateExplosion = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / 500;

      if (progress < 1) {
        explosion.scaling.setAll(1 + progress * 4);
        explosionMat.alpha = 1 - progress;
        requestAnimationFrame(animateExplosion);
      } else {
        explosion.dispose();
      }
    };
    requestAnimationFrame(animateExplosion);
  }

  private meleeAttack(): void {
    this.callbacks.onNotification(NOTIFICATIONS.MELEE, 500);

    // Check for enemies in melee range
    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());
    const meleeRange = 3;
    const meleeDamage = 50;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      toEnemy.normalize();

      const dot = Vector3.Dot(forward, toEnemy);

      if (dist < meleeRange && dot > 0.5) {
        enemy.health -= meleeDamage;

        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        break; // Only hit one enemy
      }
    }
  }

  private callFireSupport(): void {
    if (!this.marcus) return;

    this.callbacks.onNotification(NOTIFICATIONS.FIRE_SUPPORT_CALLED, 2000);

    this.callbacks.onCommsMessage({
      ...COMMS.WAVE_1_START,
      text: 'Covering fire! Get down!',
    });

    // Notify banter system about fire support
    if (this.marcusBanterManager) {
      this.marcusBanterManager.onFireSupportCalled();
    }

    // Marcus focuses fire on all visible enemies for 5 seconds
    const supportEndTime = performance.now() + 5000;
    const originalFireRate = this.marcus.fireRate;
    this.marcus.fireRate = 6; // Triple fire rate

    const supportLoop = () => {
      if (performance.now() < supportEndTime && this.marcus) {
        // Fire at any enemy
        for (const enemy of this.waveEnemies) {
          if (enemy.state !== 'dead') {
            this.marcusFire(enemy);
            break;
          }
        }
        setTimeout(supportLoop, 150);
      } else if (this.marcus) {
        this.marcus.fireRate = originalFireRate;
        // Notify banter system fire support is complete
        if (this.marcusBanterManager) {
          this.marcusBanterManager.onFireSupportComplete();
        }
      }
    };
    supportLoop();
  }

  private updateActionButtons(mode: 'combat' | 'none'): void {
    let groups: ActionButtonGroup[] = [];

    // Get keybindings for level-specific actions
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    const callMarcus = levelActionParams('callMarcus');
    // Level-specific coordination keys (not configurable)
    const focusFire = { key: 'KeyF', keyDisplay: 'F' };
    const flank = { key: 'KeyH', keyDisplay: 'H' };

    if (mode === 'combat') {
      groups = [
        {
          id: 'combat',
          position: 'right',
          buttons: [
            createAction('grenade', 'GRENADE', grenade.key, {
              keyDisplay: grenade.keyDisplay,
              cooldown: 5000,
              cooldownRemaining: this.grenadeCooldown,
            }),
            createAction('melee', 'MELEE', melee.key, {
              keyDisplay: melee.keyDisplay,
            }),
            createAction('call_marcus', 'FIRE SUPPORT', callMarcus.key, {
              keyDisplay: callMarcus.keyDisplay,
              cooldown: 30000,
              cooldownRemaining: this.fireSuportCooldown,
              variant: 'primary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
        {
          id: 'coordination',
          position: 'left',
          buttons: [
            createAction('focus_fire', 'FOCUS FIRE', focusFire.key, {
              keyDisplay: focusFire.keyDisplay,
              cooldown: 10000,
              cooldownRemaining: this.focusFireCooldown,
              variant: 'secondary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
            createAction('flank', 'FLANK', flank.key, {
              keyDisplay: flank.keyDisplay,
              cooldown: 20000,
              cooldownRemaining: this.flankCooldown,
              variant: 'secondary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
        {
          id: 'marcus_stance',
          position: 'center',
          label: this.marcusCombatAI?.isDowned() ? 'MARCUS DOWN' : 'MARCUS STANCE',
          buttons: [
            createAction('marcus_aggressive', 'AGR', 'Digit1', {
              keyDisplay: '1',
              variant: this.marcusCoordinationState === 'aggressive' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
            createAction('marcus_defensive', 'DEF', 'Digit2', {
              keyDisplay: '2',
              variant: this.marcusCoordinationState === 'defensive' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
            createAction('marcus_support', 'SUP', 'Digit3', {
              keyDisplay: '3',
              variant: this.marcusCoordinationState === 'support' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
      ];
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  // ============================================================================
  // UPDATE & DISPOSE
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

    // Update cooldowns
    if (this.grenadeCooldown > 0) {
      this.grenadeCooldown = Math.max(0, this.grenadeCooldown - deltaTime * 1000);
    }
    if (this.fireSuportCooldown > 0) {
      this.fireSuportCooldown = Math.max(0, this.fireSuportCooldown - deltaTime * 1000);
    }
    if (this.focusFireCooldown > 0) {
      this.focusFireCooldown = Math.max(0, this.focusFireCooldown - deltaTime * 1000);
    }
    if (this.flankCooldown > 0) {
      this.flankCooldown = Math.max(0, this.flankCooldown - deltaTime * 1000);
    }

    // Sync Marcus coordination state from AI
    if (this.marcusCombatAI) {
      this.marcusCoordinationState = this.marcusCombatAI.getCoordinationState();
    }

    // Update action buttons to show cooldowns
    if (this.phase === 'wave_combat' || this.phase === 'breach_battle') {
      this.updateActionButtons('combat');
    }

    // Update Marcus
    this.updateMarcus(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update Marcus banter system with combat awareness
    this.updateMarcusBanter(deltaTime);

    // Phase-specific updates
    switch (this.phase) {
      case 'reunion':
        // Handled by timers in startReunionPhase
        break;

      case 'wave_combat':
        // Check wave completion
        if (this.checkWaveComplete()) {
          this.waveComplete = true;

          if (this.currentWave < WAVES.length - 1) {
            // Wave complete, start rest period
            this.callbacks.onNotification(NOTIFICATIONS.WAVE_CLEARED(this.currentWave + 1), 2000);
            this.waveRestTimer = WAVE_REST_DURATION;

            // Wave completion dialogue using COMMS module
            const waveCompleteComms = [
              COMMS.WAVE_1_COMPLETE,
              COMMS.WAVE_2_COMPLETE,
              COMMS.WAVE_3_COMPLETE,
              COMMS.WAVE_4_COMPLETE,
            ];
            if (this.currentWave < waveCompleteComms.length) {
              this.callbacks.onCommsMessage(waveCompleteComms[this.currentWave]);
            }
          } else {
            // All waves complete
            this.allWavesComplete = true;
            this.callbacks.onNotification(NOTIFICATIONS.ALL_WAVES_CLEARED, 3000);
            this.callbacks.onCommsMessage(COMMS.WAVE_4_COMPLETE);

            // Trigger banter for all waves complete
            if (this.marcusBanterManager) {
              this.marcusBanterManager.onAllWavesComplete();
            }

            this.startBreachBattlePhase();
          }
        }

        // Handle rest period between waves
        if (this.waveComplete && !this.allWavesComplete) {
          this.waveRestTimer -= deltaTime * 1000;

          if (this.waveRestTimer <= 0) {
            this.startWave(this.currentWave + 1);
          } else {
            const secondsLeft = Math.ceil(this.waveRestTimer / 1000);
            if (secondsLeft % 10 === 0 || secondsLeft <= 5) {
              this.callbacks.onObjectiveUpdate(
                OBJECTIVES.NEXT_WAVE.getTitle(secondsLeft),
                OBJECTIVES.NEXT_WAVE.getDescription(this.totalKills)
              );
            }
          }
        }
        break;

      case 'breach_battle':
        // Handled by startBreachBattlePhase timer
        break;

      case 'transition': {
        // Check if player enters breach
        const playerPos = this.camera.position.clone();
        playerPos.y = 0;
        const distToBreach = Vector3.Distance(playerPos, BREACH_POSITION);

        if (distToBreach < BREACH_DIAMETER / 2 - 10) {
          // Player entered breach - complete level
          this.completeLevel();
        }
        break;
      }
    }

    // Animate breach glow
    if (this.breachGlow) {
      const time = performance.now() * 0.001;
      this.breachGlow.intensity = 1.5 + Math.sin(time * 2) * 0.5;
    }

    // Animate battlefield fire lights (station wreckage flicker)
    if (this.battlefield) {
      updateBattlefieldLights(this.battlefield.lights, deltaTime);
    }
  }

  /**
   * Update Marcus banter system with situation awareness
   */
  private updateMarcusBanter(deltaTime: number): void {
    if (!this.marcusBanterManager || this.cinematicInProgress) return;

    const now = performance.now();

    // Throttle banter updates to every 500ms for performance
    if (now - this.lastBanterUpdateTime < 500) return;
    this.lastBanterUpdateTime = now;

    // Track player health changes for banter
    if (this.playerHealth !== this.previousPlayerHealth) {
      this.marcusBanterManager.onPlayerHealthChange(
        this.playerHealth,
        this.maxPlayerHealth, // Use tracked max health
        this.previousPlayerHealth
      );
      this.previousPlayerHealth = this.playerHealth;
    }

    // Check for close call - player was critical and survived
    if (this.previousPlayerHealth <= this.maxPlayerHealth * 0.15 && this.playerHealth > this.maxPlayerHealth * 0.3) {
      this.marcusBanterManager.onPlayerCloseCall();
    }

    // Only process combat-related banter during active combat phases
    if (this.phase !== 'wave_combat' && this.phase !== 'breach_battle') {
      return;
    }

    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead');
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    // Calculate wave progress for banter
    if (aliveEnemies.length > 0 && this.waveStartEnemyCount > 0) {
      this.marcusBanterManager.onWaveProgress(
        aliveEnemies.length,
        this.waveStartEnemyCount,
        this.currentWave + 1
      );
    }

    // Area cleared banter
    if (aliveEnemies.length === 0 && !this.waveComplete) {
      this.marcusBanterManager.onAreaCleared();
    }

    // Combat situation awareness - check for flanking/surrounded
    if (aliveEnemies.length >= 3) {
      const forward = this.camera.getDirection(Vector3.Forward());
      let enemiesInFront = 0;
      let enemiesBehind = 0;

      for (const enemy of aliveEnemies) {
        const toEnemy = enemy.mesh.position.subtract(playerPos).normalize();
        const dot = Vector3.Dot(forward, toEnemy);

        if (dot > 0.3) {
          enemiesInFront++;
        } else if (dot < -0.3) {
          enemiesBehind++;
        }
      }

      this.marcusBanterManager.onCombatSituation(
        enemiesInFront,
        enemiesBehind,
        aliveEnemies.length
      );
    }

    // Check proximity to breach for contextual dialogue
    const distToBreach = Vector3.Distance(playerPos, BREACH_POSITION);
    if (distToBreach < BREACH_DIAMETER * 0.75 && this.phase === 'breach_battle') {
      this.marcusBanterManager.onNearBreach();
    }

    // First time seeing the breach - story moment
    if (!this.hasSeenBreach && distToBreach < BREACH_DIAMETER * 1.2) {
      this.hasSeenBreach = true;
      this.marcusBanterManager.onViewingBreachFirst();
    }

    // Defending position trigger - when near Marcus's original spot
    if (!this.hasTriggeredDefendingPosition && this.marcus) {
      const distToMarcusStart = Vector3.Distance(playerPos, MARCUS_START_POSITION);
      if (distToMarcusStart < 20) {
        this.hasTriggeredDefendingPosition = true;
        this.marcusBanterManager.onDefendingPosition();
      }
    }

    // Near canyon walls - cover advice
    const distToWallEast = Math.abs(playerPos.x - ARENA_WIDTH / 2);
    const distToWallWest = Math.abs(playerPos.x + ARENA_WIDTH / 2);
    if (distToWallEast < 15 || distToWallWest < 15) {
      this.marcusBanterManager.onNearCanyonWall();
    }

    // Trigger idle banter during rest periods between waves
    if (this.waveComplete && !this.allWavesComplete && this.waveRestTimer > 5000) {
      // Use extended idle for longer lulls to get deeper emotional moments
      if (this.waveRestTimer > 15000) {
        this.marcusBanterManager.onExtendedIdle();
      } else {
        this.marcusBanterManager.onIdleUpdate();
      }
    }

    // Occasional mech commentary during combat lulls
    if (aliveEnemies.length === 0 && !this.waveComplete && Math.random() < 0.01) {
      this.marcusBanterManager.onCommentOnMech();
    }
  }

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'the_breach' && this.phase === 'transition';
  }

  // ============================================================================
  // KEYBOARD INPUT OVERRIDES FOR COMMAND WHEEL
  // ============================================================================

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Tab key opens command wheel (only during combat phases)
    if (e.code === 'Tab' && !this.isCommandWheelOpen) {
      e.preventDefault();
      if (this.phase === 'wave_combat' || this.phase === 'breach_battle') {
        this.openCommandWheel();
      }
    }

    // Escape cancels active command
    if (e.code === 'Escape' && this.squadCommandSystem?.getActiveCommand()) {
      e.preventDefault();
      this.squadCommandSystem.cancelCommand();
    }
  }

  protected override handleKeyUp(e: KeyboardEvent): void {
    super.handleKeyUp(e);

    // Tab release closes command wheel and issues command
    if (e.code === 'Tab' && this.isCommandWheelOpen) {
      e.preventDefault();
      this.closeCommandWheel();
    }
  }

  protected disposeLevel(): void {
    log.info('Disposing level resources...');

    // Dispose flora
    for (const node of this.floraNodes) {
      if (node && !node.isDisposed()) {
        node.dispose(false, true);
      }
    }
    this.floraNodes = [];

    // Dispose collectibles
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;

    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Unregister dynamic actions
    unregisterDynamicActions('brothers_in_arms');

    // Dispose cinematic
    this.reunionCinematic?.dispose();
    this.reunionCinematic = null;

    // Dispose banter manager
    this.marcusBanterManager?.reset();
    this.marcusBanterManager = null;

    // Dispose squad command system
    this.squadCommandSystem?.dispose();
    this.squadCommandSystem = null;

    // Dispose Marcus Combat AI
    this.marcusCombatAI?.dispose();
    this.marcusCombatAI = null;

    // Dispose Marcus health bars
    this.marcusHealthBar?.dispose();
    this.marcusHealthBarFill?.dispose();
    this.marcusShieldBar?.dispose();
    this.marcusShieldBarFill?.dispose();
    this.marcusDownedIndicator?.dispose();

    // Dispose Marcus mech
    if (this.marcus) {
      this.marcus.body?.dispose();
      this.marcus.leftArm?.dispose();
      this.marcus.rightArm?.dispose();
      this.marcus.legs?.dispose();
      this.marcus.rootNode?.dispose();
      this.marcus = null;
    }

    // Dispose enemies
    for (const enemy of this.waveEnemies) {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        // Also dispose any child meshes (GLB instances)
        const children = enemy.mesh.getChildMeshes();
        for (const child of children) {
          child.dispose();
        }
        enemy.mesh.dispose();
      }
      removeEntity(enemy.entity);
    }
    this.waveEnemies = [];

    // Dispose canyon walls
    for (const wall of this.canyonWalls) {
      if (wall && !wall.isDisposed()) {
        wall.dispose();
      }
    }
    this.canyonWalls = [];

    // Dispose terrain
    this.terrain?.dispose();
    this.terrain = null;
    this.terrainMaterial?.dispose();
    this.terrainMaterial = null;

    // Dispose battlefield environment
    this.battlefield?.dispose();
    this.battlefield = null;

    // Dispose breach
    this.breachMesh?.dispose();
    this.breachMesh = null;
    this.breachGlow?.dispose();
    this.breachGlow = null;

    // Dispose skybox using SkyboxResult
    this.skyboxResult?.dispose();
    this.skyboxResult = null;
    this.skyDome = null;

    log.info('Level disposal complete');
  }
}
