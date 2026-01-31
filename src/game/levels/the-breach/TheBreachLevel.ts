/**
 * TheBreachLevel - Underground Hive Tunnels with Queen Boss Fight
 *
 * LEVEL STRUCTURE:
 * 1. UPPER HIVE (0-50m depth) - Linear tunnels, drones
 * 2. MID HIVE (50-100m) - Branching tunnels, grunts/spitters, acid pools
 * 3. LOWER HIVE (100-150m) - Large chambers, egg clusters, all enemy types
 * 4. QUEEN'S CHAMBER - 200m cavern, boss fight
 *
 * FEATURES:
 * - Organic tunnel environment with bioluminescent lighting
 * - Environmental hazards (acid pools, egg clusters, pheromone clouds)
 * - Progressive enemy density increase
 * - 3-phase Queen boss fight with weak point mechanic
 * - Death sequence triggers escape to extraction level
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, type Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { getAchievementManager } from '../../achievements';
import {
  CinematicSystem,
  createTheBreachIntroCinematic,
  type CinematicCallbacks,
} from '../../cinematics';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('TheBreachLevel');
import { getBossMusicManager } from '../../core/BossMusicManager';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BaseLevel } from '../BaseLevel';
import { buildCollectibles, type CollectibleSystemResult, getTheBreachCollectibles } from '../shared/CollectiblePlacer';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import {
  COMMS_BOSS_DEATH,
  COMMS_BOSS_DETECTED,
  COMMS_BOSS_PHASE_2,
  COMMS_BOSS_PHASE_3,
  COMMS_LEVEL_START,
  NOTIFICATIONS,
  OBJECTIVES,
} from './comms';

// ============================================================================
// QUEEN CHAMBER GLB ASSET PATHS
// ============================================================================

/** GLB paths for queen chamber structural elements */
const QUEEN_CHAMBER_GLBS = {
  /** Arena floor tile */
  arenaFloor: '/assets/models/environment/modular/FloorTile_Basic.glb',
  /** Chamber dome (organic stomach structure) */
  dome: '/assets/models/environment/hive/building_stomach.glb',
  /** Chamber entrance door */
  door: '/assets/models/environment/modular/Door_Double.glb',
  /** Arena pillar (organic claw structure) */
  pillar: '/assets/models/environment/hive/building_claw.glb',
  /** Pillar organic growth decorations */
  pillarGrowth: [
    '/assets/models/environment/alien-flora/alien_mushroom_01.glb',
    '/assets/models/environment/alien-flora/alien_mushroom_03.glb',
    '/assets/models/environment/alien-flora/alien_mushroom_05.glb',
  ],
} as const;
// Import from subpackage modules
import {
  COLORS,
  DAMAGE_INVINCIBILITY_MS,
  GRENADE_COOLDOWN,
  GRENADE_MAX_DAMAGE,
  GRENADE_RADIUS,
  MELEE_COOLDOWN,
  MELEE_DAMAGE,
  MELEE_RANGE,
  PLAYER_MAX_HEALTH,
  STARTING_GRENADES,
  TUNNEL_DIAMETER,
  TUNNEL_SEGMENT_LENGTH,
  WEAK_POINT_COOLDOWN,
  WEAK_POINT_DURATION,
  ARENA_PILLAR_COUNT,
  ARENA_PILLAR_RADIUS,
  ARENA_PILLAR_HEIGHT,
  WEAK_POINT_DURATION_SCALING,
  SCAN_COOLDOWN_SCALING,
  INVINCIBILITY_SCALING,
  QUEEN_ATTACK_TELEGRAPH,
  GROUND_POUND_INDICATOR_DURATION,
  QUEEN_ATTACK_RANGE,
  ACID_SPRAY_SPEED,
  QUEEN_SCREECH_SPAWN_COUNT,
  QUEEN_POISON_CLOUD_DURATION,
  QUEEN_FRENZY_ATTACK_COUNT,
  QUEEN_FRENZY_ATTACK_DELAY,
  QUEEN_DEATH_THROES_SPAWN_INTERVAL,
} from './constants';
import { loadDifficultySetting, type DifficultyLevel } from '../../core/DifficultySettings';
import {
  checkEnemyHit,
  damageEnemy,
  disposeEnemies,
  getEnemyAttackDamage,
  getInitialSpawnConfig,
  preloadEnemyModels,
  spawnEnemy,
  updateEnemyAI,
} from './enemies';
import {
  disposeBreachAssets,
  HiveEnvironmentBuilder,
  HIVE_STRUCTURE_PLACEMENTS,
  loadBreachAssets,
  placeBreachAssets,
  type PlacedAsset,
  updateBiolights,
} from './environment';
import {
  checkAcidPoolDamage,
  checkEggClusterTrigger,
  checkPheromoneCloud,
  HazardBuilder,
} from './hazards';
import {
  animateClawSwipe,
  animateTailSlam,
  animateGroundPound,
  animateAcidSpit,
  animateQueenAwakening,
  animateQueenDeath,
  animateQueen,
  calculateQueenDamage,
  createQueen,
  disposeQueen,
  getAvailableAttacks,
  getPhaseMultiplier,
  getQueenPhase,
  getSpawnCooldown,
  getSpawnCount,
  getSpawnType,
  preloadQueenModels,
  setQueenDifficulty,
  getScaledQueenDamage,
  getScaledCooldown,
  // New attack system exports
  selectNextAttack,
  updateQueenAI,
  animateAcidSpray,
  animateTailSwipe,
  animateScreech,
  animateCharge,
  animateEggBurst,
  animatePoisonCloud,
  animateFrenzyAttack,
  animatePhaseTransition,
  getAcidSprayPositions,
  checkChargeCollision,
  getEggBurstSpawnPositions,
  revealWeakPoints,
  hideWeakPoints,
  startFrenzy,
  activateDeathThroes,
  shouldEnterDeathThroes,
  getPhaseAttackCooldown,
  checkWeakPointHit,
  damageWeakPoint,
} from './queen';
import { setEnemyDifficulty } from './enemies';
import type { Enemy, HiveZone, LevelPhase, Queen, QueenPhase, QueenAttackType } from './types';

// ============================================================================
// LEVEL CLASS
// ============================================================================

export class TheBreachLevel extends BaseLevel {
  // Collectibles (no flora in hive interior)
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Cinematic system for intro sequence
  private cinematicSystem: CinematicSystem | null = null;

  // Level state
  private phase: LevelPhase = 'exploration';
  private currentZone: HiveZone = 'upper';
  private previousZone: HiveZone = 'upper';
  private depth = 0;

  // Difficulty
  private difficulty: DifficultyLevel = loadDifficultySetting();

  // Environment builders
  private environmentBuilder: HiveEnvironmentBuilder | null = null;
  private hazardBuilder: HazardBuilder | null = null;
  private placedBreachAssets: PlacedAsset[] = [];

  // Queen boss
  private queen: Queen | null = null;
  private queenArena: TransformNode | null = null;
  private queenDoorMesh: TransformNode | null = null;
  private queenDomeMesh: TransformNode | null = null;
  private queenDefeated = false;
  private arenaPillars: TransformNode[] = [];
  private groundPoundIndicator: Mesh | null = null;

  // Enemies
  private enemies: Enemy[] = [];
  private enemiesKilled = 0;

  // Player state
  private playerHealth = PLAYER_MAX_HEALTH;
  private lastDamageTime = 0;
  private grenadeCount = STARTING_GRENADES;
  private grenadeCooldown = 0;
  private meleeCooldown = 0;
  private scanCooldown = 0;

  // Statistics tracking
  private totalDamageTaken = 0;
  private levelStartTime = 0;

  // Screen effects
  private screenFlash = 0;
  private screenFlashColor = new Color3(1, 1, 1);

  // Action callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Timers
  private phaseTimer = 0;
  private escapeTimer = 0;

  // Tutorial hints shown
  private hintsShown: Set<string> = new Set();

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    return COLORS.background;
  }

  protected async createEnvironment(): Promise<void> {
    // Initialize environment builder
    this.environmentBuilder = new HiveEnvironmentBuilder(this.scene);
    this.environmentBuilder.setupGlowLayer();

    // Override lighting for dark hive atmosphere
    this.setupHiveLighting();

    // Initialize AssetManager, particle manager, and damage feedback
    AssetManager.init(this.scene);
    particleManager.init(this.scene);
    damageFeedback.init(this.scene);

    // Connect damage feedback screen shake to base level shake system
    damageFeedback.setScreenShakeCallback((intensity) => this.triggerShake(intensity));

    // Load assets -- hive geometry (tunnels/chambers), hive structures, captured vehicles, station/detail GLBs, queen models, and chamber GLBs
    await Promise.all([
      this.environmentBuilder.loadHiveGeometry(),
      this.environmentBuilder.loadHiveStructures(),
      this.environmentBuilder.loadCapturedVehicles(),
      loadBreachAssets(this.scene),
      preloadQueenModels(this.scene),
      this.loadQueenChamberAssets(),
    ]);
  }

  /**
   * Preload GLB assets used for the queen chamber (floor, dome, door, pillars).
   */
  private async loadQueenChamberAssets(): Promise<void> {
    const loadPromises: Promise<unknown>[] = [];

    // Load floor, dome, door, and pillar base
    const basePaths = [
      QUEEN_CHAMBER_GLBS.arenaFloor,
      QUEEN_CHAMBER_GLBS.dome,
      QUEEN_CHAMBER_GLBS.door,
      QUEEN_CHAMBER_GLBS.pillar,
    ];

    for (const path of basePaths) {
      if (!AssetManager.isPathCached(path)) {
        loadPromises.push(AssetManager.loadAssetByPath(path, this.scene));
      }
    }

    // Load pillar growth decorations
    for (const path of QUEEN_CHAMBER_GLBS.pillarGrowth) {
      if (!AssetManager.isPathCached(path)) {
        loadPromises.push(AssetManager.loadAssetByPath(path, this.scene));
      }
    }

    await Promise.all(loadPromises);
    log.info('Queen chamber GLB assets loaded');

    // Build the hive tunnel/chamber geometry
    this.createUpperHive();
    this.createMidHive();
    this.createLowerHive();
    this.createQueenChamber();

    // Place organic hive structures (birther, brain, claw, crystals, etc.)
    this.placeHiveStructures();

    // Place station beams and modular detail plates across all 3 zones
    this.placedBreachAssets = placeBreachAssets(this.scene);

    // Place captured military vehicles absorbed by the hive
    this.placeCapturedVehicles();

    // Initialize hazard builder and load egg cluster assets
    const glowLayer = this.environmentBuilder ? this.environmentBuilder.getGlowLayer() : null;
    this.hazardBuilder = new HazardBuilder(this.scene, glowLayer);
    await this.hazardBuilder.loadHazardAssets();
    this.hazardBuilder.createStandardAcidPools();
    this.hazardBuilder.createStandardEggClusters();

    // Preload enemy GLB models before spawning
    await preloadEnemyModels(this.scene);

    // Spawn initial enemies (now using GLB models)
    this.spawnInitialEnemies();

    // Setup player
    this.camera.position.set(0, 1.7, 0);
    this.callbacks.onHealthChange(this.playerHealth);

    // Build collectibles (no flora in hive interior)
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getTheBreachCollectibles(), collectibleRoot);

    // Initialize cinematic system
    this.initializeCinematicSystem();

    // Play intro cinematic when boss fight starts (not at level start)
    // The intro cinematic is played when the player reaches the Queen's chamber
    // For now, just start the level normally
    this.startLevel();
  }

  /**
   * Initialize the cinematic system with appropriate callbacks.
   */
  private initializeCinematicSystem(): void {
    const cinematicCallbacks: CinematicCallbacks = {
      onCommsMessage: (message) => {
        this.callbacks.onCommsMessage({
          sender: message.sender,
          callsign: message.callsign ?? '',
          portrait: (message.portrait ?? 'ai') as 'commander' | 'ai' | 'marcus' | 'armory' | 'player',
          text: message.text,
        });
      },
      onNotification: (text, duration) => {
        this.callbacks.onNotification(text, duration ?? 3000);
      },
      onObjectiveUpdate: (title, instructions) => {
        this.callbacks.onObjectiveUpdate(title, instructions);
      },
      onShakeCamera: (intensity) => {
        this.triggerShake(intensity);
      },
      onCinematicStart: () => {
        this.callbacks.onCinematicStart?.();
      },
      onCinematicEnd: () => {
        this.callbacks.onCinematicEnd?.();
      },
    };

    this.cinematicSystem = new CinematicSystem(this.scene, this.camera, cinematicCallbacks);
  }

  /**
   * Play the Queen boss intro cinematic.
   * Called when the player reaches the Queen's chamber.
   */
  private playQueenIntroCinematic(onComplete: () => void): void {
    if (!this.cinematicSystem || !this.queen) {
      onComplete();
      return;
    }

    const queenPosition = this.queen.mesh.position.clone();

    const sequence = createTheBreachIntroCinematic(
      onComplete,
      queenPosition
    );

    this.cinematicSystem.play(sequence);
  }

  private setupHiveLighting(): void {
    if (this.sunLight) {
      this.sunLight.dispose();
      this.sunLight = null;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.05;
      this.ambientLight.diffuse = Color3.FromHexString('#1A1020');
      this.ambientLight.groundColor = Color3.FromHexString('#0A0810');
    }
  }

  private startLevel(): void {
    this.phase = 'exploration';
    this.levelStartTime = performance.now();

    // Apply difficulty settings to queen and enemies
    setQueenDifficulty(this.difficulty);
    setEnemyDifficulty(this.difficulty);

    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    this.callbacks.onNotification(NOTIFICATIONS.LEVEL_START, 3000);
    this.callbacks.onObjectiveUpdate(OBJECTIVES.DESCENT.title, OBJECTIVES.DESCENT.description);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS_LEVEL_START);
    }, 2000);

    setTimeout(() => {
      this.updateActionButtons('exploration');
    }, 1000);

    // Set up environmental audio for oppressive hive atmosphere
    this.setupHiveEnvironmentalAudio();

    // Show zone entry notification
    setTimeout(() => {
      this.callbacks.onNotification(NOTIFICATIONS.ZONE_UPPER, 2000);
    }, 4000);
  }

  /**
   * Set up spatial sound sources for immersive hive atmosphere.
   * Dripping moisture, organic pulsing, alien nests, and acid pools.
   */
  private setupHiveEnvironmentalAudio(): void {
    // Dripping sounds throughout the tunnels (periodic water drops with echo)
    this.addSpatialSound(
      'drip_upper1',
      'dripping',
      { x: 2, y: 0, z: 20 },
      {
        maxDistance: 12,
        volume: 0.4,
        interval: 3000,
      }
    );
    this.addSpatialSound(
      'drip_upper2',
      'dripping',
      { x: -3, y: -10, z: 40 },
      {
        maxDistance: 10,
        volume: 0.3,
        interval: 4500,
      }
    );
    this.addSpatialSound(
      'drip_mid1',
      'dripping',
      { x: 0, y: -30, z: 80 },
      {
        maxDistance: 15,
        volume: 0.5,
        interval: 2500,
      }
    );
    this.addSpatialSound(
      'drip_lower1',
      'dripping',
      { x: 5, y: -60, z: 120 },
      {
        maxDistance: 12,
        volume: 0.4,
        interval: 3500,
      }
    );

    // Organic heartbeat pulsing in hive walls (gets stronger deeper)
    this.addSpatialSound(
      'heartbeat_upper',
      'hive_heartbeat',
      { x: 0, y: -5, z: 30 },
      {
        maxDistance: 20,
        volume: 0.2,
      }
    );
    this.addSpatialSound(
      'heartbeat_mid',
      'hive_heartbeat',
      { x: 0, y: -40, z: 90 },
      {
        maxDistance: 25,
        volume: 0.4,
      }
    );
    this.addSpatialSound(
      'heartbeat_lower',
      'hive_heartbeat',
      { x: 0, y: -80, z: 140 },
      {
        maxDistance: 30,
        volume: 0.6,
      }
    );

    // Alien nest sounds (wet organic movement)
    this.addSpatialSound(
      'nest_mid',
      'alien_nest',
      { x: 6, y: -35, z: 85 },
      {
        maxDistance: 15,
        volume: 0.3,
      }
    );
    this.addSpatialSound(
      'nest_lower',
      'alien_nest',
      { x: -4, y: -70, z: 130 },
      {
        maxDistance: 18,
        volume: 0.4,
      }
    );

    // Acid pool bubbling sounds
    this.addSpatialSound(
      'acid_mid1',
      'acid_bubbling',
      { x: 3, y: -45, z: 100 },
      {
        maxDistance: 10,
        volume: 0.35,
      }
    );
    this.addSpatialSound(
      'acid_lower1',
      'acid_bubbling',
      { x: -2, y: -75, z: 135 },
      {
        maxDistance: 12,
        volume: 0.4,
      }
    );

    // Organic growth pulsing in queen's chamber area
    this.addSpatialSound(
      'growth_queen',
      'organic_growth',
      { x: 0, y: -100, z: 180 },
      {
        maxDistance: 35,
        volume: 0.5,
      }
    );

    // Define audio zones for different hive depths
    this.addAudioZone('zone_upper', 'hive', { x: 0, y: -10, z: 30 }, 40, {
      isIndoor: true,
      intensity: 0.4,
    });
    this.addAudioZone('zone_mid', 'hive', { x: 0, y: -40, z: 90 }, 50, {
      isIndoor: true,
      intensity: 0.6,
      highThreat: true,
    });
    this.addAudioZone('zone_lower', 'hive', { x: 0, y: -80, z: 140 }, 50, {
      isIndoor: true,
      intensity: 0.8,
      highThreat: true,
    });
    this.addAudioZone('zone_queen', 'hive', { x: 0, y: -100, z: 180 }, 60, {
      isIndoor: true,
      intensity: 1.0,
      highThreat: true,
    });
  }

  // ============================================================================
  // ENVIRONMENT CREATION (delegated to builder)
  // ============================================================================

  private createUpperHive(): void {
    if (!this.environmentBuilder) return;

    const segments = 7;
    for (let i = 0; i < segments; i++) {
      const depth = -i * TUNNEL_SEGMENT_LENGTH;
      this.environmentBuilder.createTunnelSegment(
        new Vector3(0, depth - 2, i * TUNNEL_SEGMENT_LENGTH),
        0,
        'upper'
      );

      if (i % 2 === 0) {
        this.environmentBuilder.createBiolight(
          new Vector3((Math.random() - 0.5) * 2, depth, i * TUNNEL_SEGMENT_LENGTH + 4),
          0.5 + Math.random() * 0.3
        );
      }
    }
  }

  private createMidHive(): void {
    if (!this.environmentBuilder) return;

    const baseZ = 7 * TUNNEL_SEGMENT_LENGTH;
    const baseY = -7 * TUNNEL_SEGMENT_LENGTH - 2;

    for (let i = 0; i < 6; i++) {
      const depth = baseY - i * TUNNEL_SEGMENT_LENGTH * 0.8;
      this.environmentBuilder.createTunnelSegment(
        new Vector3(0, depth, baseZ + i * TUNNEL_SEGMENT_LENGTH),
        0,
        'mid'
      );

      if (i % 2 === 1) {
        const side = i % 4 === 1 ? 1 : -1;
        this.environmentBuilder.createTunnelSegment(
          new Vector3(side * 6, depth, baseZ + i * TUNNEL_SEGMENT_LENGTH),
          (side * Math.PI) / 4,
          'mid'
        );
      }

      this.environmentBuilder.createBiolight(
        new Vector3((Math.random() - 0.5) * 3, depth + 1, baseZ + i * TUNNEL_SEGMENT_LENGTH + 4),
        0.4 + Math.random() * 0.4
      );
    }

    this.environmentBuilder.createChamber(new Vector3(0, baseY - 30, baseZ + 40), 8, 'mid');
  }

  private createLowerHive(): void {
    if (!this.environmentBuilder) return;

    const baseZ = 7 * TUNNEL_SEGMENT_LENGTH + 6 * TUNNEL_SEGMENT_LENGTH;
    const baseY = -100;

    this.environmentBuilder.createChamber(new Vector3(0, baseY, baseZ + 20), 12, 'lower');

    for (let i = 0; i < 4; i++) {
      this.environmentBuilder.createTunnelSegment(
        new Vector3(0, baseY - 10 - i * 6, baseZ + 40 + i * 8),
        0,
        'lower'
      );
      this.environmentBuilder.createBiolight(
        new Vector3((Math.random() - 0.5) * 2, baseY - 10 - i * 6 + 1.5, baseZ + 44 + i * 8),
        0.6 + Math.random() * 0.3
      );
    }
  }

  private createQueenChamber(): void {
    if (!this.environmentBuilder) return;

    const chamberCenter = new Vector3(0, -150, 180);
    const chamberRadius = 25;

    // Arena floor - use GLB floor tiles arranged in a grid, with fallback to disc
    this.queenArena = this.createArenaFloor(chamberCenter, chamberRadius);

    // Dome ceiling - use GLB stomach structure, with fallback to sphere
    this.queenDomeMesh = this.createChamberDome(chamberCenter, chamberRadius);

    // Entrance tunnel
    this.environmentBuilder.createTunnelSegment(
      new Vector3(0, chamberCenter.y + 5, chamberCenter.z - chamberRadius - 4),
      0,
      'queen_chamber'
    );

    // Door for boss fight - use GLB door, with fallback to box
    this.queenDoorMesh = this.createChamberDoor(chamberCenter, chamberRadius);

    // Ring of biolights
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.environmentBuilder.createBiolight(
        new Vector3(
          chamberCenter.x + Math.cos(angle) * (chamberRadius - 2),
          chamberCenter.y + 2,
          chamberCenter.z + Math.sin(angle) * (chamberRadius - 2)
        ),
        0.8 + Math.random() * 0.4
      );
    }

    // Create arena pillars for cover during boss fight
    this.createArenaPillars(chamberCenter, chamberRadius);

    // Create ground pound indicator (hidden initially)
    this.createGroundPoundIndicator(chamberCenter);

    // Create acid hazards in queen chamber
    this.createQueenChamberHazards(chamberCenter, chamberRadius);

    // Create the Queen
    this.queen = createQueen(
      this.scene,
      new Vector3(0, chamberCenter.y, chamberCenter.z + chamberRadius - 5),
      this.environmentBuilder.getGlowLayer()
    );
  }

  /**
   * Create cover pillars arranged around the boss arena using GLB models.
   * Uses hive claw structure as pillar base with alien flora decorations.
   */
  private createArenaPillars(center: Vector3, arenaRadius: number): void {
    const pillarPath = QUEEN_CHAMBER_GLBS.pillar;

    if (!AssetManager.isPathCached(pillarPath)) {
      throw new Error(`[TheBreachLevel] Arena pillar GLB not preloaded: ${pillarPath}`);
    }

    for (let i = 0; i < ARENA_PILLAR_COUNT; i++) {
      // Offset angle so pillars don't block entrance or queen
      const angle = (i / ARENA_PILLAR_COUNT) * Math.PI * 2 + Math.PI / 6;
      const radius = ARENA_PILLAR_RADIUS;

      const pillarRoot = new TransformNode(`arenaPillar_${i}`, this.scene);
      pillarRoot.position = new Vector3(
        center.x + Math.cos(angle) * radius,
        center.y,
        center.z + Math.sin(angle) * radius
      );

      // Main pillar body - organic claw structure from GLB
      const pillar = AssetManager.createInstanceByPath(
        pillarPath,
        `pillarBody_${i}`,
        this.scene,
        false,
        'environment'
      );

      if (!pillar) {
        throw new Error(`[TheBreachLevel] Failed to create pillar instance at index ${i}`);
      }

      // Scale the claw GLB to approximate pillar dimensions
      // Building_claw is roughly 2 units tall, scale to match ARENA_PILLAR_HEIGHT
      const heightScale = ARENA_PILLAR_HEIGHT / 2;
      const widthVariation = 0.8 + Math.random() * 0.4;
      pillar.scaling.set(widthVariation, heightScale, widthVariation);
      pillar.position.y = 0;
      // Random rotation for organic variation
      pillar.rotation.y = Math.random() * Math.PI * 2;
      pillar.parent = pillarRoot;

      // Add organic growths on pillar using alien flora GLBs
      const growthCount = 2 + Math.floor(Math.random() * 2);
      for (let g = 0; g < growthCount; g++) {
        const growthPath = QUEEN_CHAMBER_GLBS.pillarGrowth[g % QUEEN_CHAMBER_GLBS.pillarGrowth.length];

        if (!AssetManager.isPathCached(growthPath)) {
          log.warn(`[TheBreachLevel] Pillar growth GLB not cached: ${growthPath}`);
          continue;
        }

        const growth = AssetManager.createInstanceByPath(
          growthPath,
          `pillarGrowth_${i}_${g}`,
          this.scene,
          false
        );

        if (!growth) {
          log.warn(`[TheBreachLevel] Failed to create pillar growth instance: ${growthPath}`);
          continue;
        }

        // Scale for small organic decoration
        const growthScale = 0.2 + Math.random() * 0.15;
        growth.scaling.setAll(growthScale);
        growth.position.set(
          (Math.random() - 0.5) * 0.8,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 0.8
        );
        growth.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.4
        );
        growth.parent = pillarRoot;
      }

      // Add bioluminescent patch
      if (this.environmentBuilder) {
        this.environmentBuilder.createBiolight(
          new Vector3(
            pillarRoot.position.x + (Math.random() - 0.5) * 0.5,
            center.y + 1 + Math.random() * 2,
            pillarRoot.position.z + (Math.random() - 0.5) * 0.5
          ),
          0.3 + Math.random() * 0.2
        );
      }

      this.arenaPillars.push(pillarRoot);
    }

    log.info(`Created ${ARENA_PILLAR_COUNT} arena cover pillars with GLB models`);
  }

  /**
   * Create the ground pound area indicator (hidden until attack).
   */
  private createGroundPoundIndicator(center: Vector3): void {
    const indicator = MeshBuilder.CreateDisc(
      'groundPoundIndicator',
      { radius: 15, tessellation: 32 },
      this.scene
    );

    const indicatorMat = new StandardMaterial('groundPoundMat', this.scene);
    indicatorMat.diffuseColor = new Color3(1, 0.3, 0.1);
    indicatorMat.emissiveColor = new Color3(1, 0.3, 0.1);
    indicatorMat.alpha = 0;
    indicatorMat.disableLighting = true;
    indicator.material = indicatorMat;

    indicator.position = new Vector3(center.x, center.y + 0.1, center.z);
    indicator.rotation.x = Math.PI / 2;
    indicator.isVisible = false;

    this.groundPoundIndicator = indicator;
  }

  /**
   * Create acid hazards in queen chamber edges.
   */
  private createQueenChamberHazards(center: Vector3, radius: number): void {
    if (!this.hazardBuilder) return;

    // Create acid pools around the chamber edges
    const poolCount = 4;
    for (let i = 0; i < poolCount; i++) {
      const angle = (i / poolCount) * Math.PI * 2 + Math.PI / 4;
      const poolRadius = radius - 3;
      this.hazardBuilder.createAcidPool(
        new Vector3(
          center.x + Math.cos(angle) * poolRadius,
          center.y,
          center.z + Math.sin(angle) * poolRadius
        ),
        1.5 + Math.random() * 0.5,
        8 // Higher damage in queen chamber
      );
    }
  }

  /**
   * Create the arena floor using GLB floor tiles.
   */
  private createArenaFloor(center: Vector3, radius: number): TransformNode {
    const floorPath = QUEEN_CHAMBER_GLBS.arenaFloor;

    if (!AssetManager.isPathCached(floorPath)) {
      throw new Error(`[TheBreachLevel] Arena floor GLB not preloaded: ${floorPath}`);
    }

    // Create a grid of floor tiles to cover the arena
    const floorRoot = new TransformNode('queenArenaRoot', this.scene);
    floorRoot.position = center.clone();

    const tileSize = 4; // Approximate size of floor tile GLB
    const tilesPerSide = Math.ceil((radius * 2) / tileSize);

    for (let x = 0; x < tilesPerSide; x++) {
      for (let z = 0; z < tilesPerSide; z++) {
        const tileX = (x - tilesPerSide / 2 + 0.5) * tileSize;
        const tileZ = (z - tilesPerSide / 2 + 0.5) * tileSize;

        // Only place tiles within the circular arena
        if (Math.sqrt(tileX * tileX + tileZ * tileZ) > radius + tileSize / 2) {
          continue;
        }

        const tile = AssetManager.createInstanceByPath(
          floorPath,
          `arenaFloor_${x}_${z}`,
          this.scene,
          false,
          'environment'
        );

        if (!tile) {
          throw new Error(`[TheBreachLevel] Failed to create floor tile instance at ${x},${z}`);
        }

        tile.position.set(tileX, 0, tileZ);
        tile.scaling.setAll(1.2);
        tile.rotation.y = Math.random() * Math.PI * 0.5; // Slight random rotation
        tile.parent = floorRoot;
      }
    }

    log.info('Queen arena floor created with GLB tiles');
    return floorRoot;
  }

  /**
   * Create the chamber dome using GLB stomach structure.
   */
  private createChamberDome(center: Vector3, radius: number): TransformNode {
    const domePath = QUEEN_CHAMBER_GLBS.dome;

    if (!AssetManager.isPathCached(domePath)) {
      throw new Error(`[TheBreachLevel] Chamber dome GLB not preloaded: ${domePath}`);
    }

    const dome = AssetManager.createInstanceByPath(
      domePath,
      'queenDome',
      this.scene,
      true,
      'environment'
    );

    if (!dome) {
      throw new Error(`[TheBreachLevel] Failed to create dome instance from: ${domePath}`);
    }

    dome.position.set(center.x, center.y + 5, center.z);
    // Scale the stomach GLB to approximate dome radius
    const scaleFactor = radius / 4;
    dome.scaling.set(scaleFactor, scaleFactor * 0.6, scaleFactor);
    dome.rotation.x = Math.PI; // Invert for dome effect

    log.info('Queen chamber dome created with GLB');
    return dome;
  }

  /**
   * Create the chamber door using GLB door.
   */
  private createChamberDoor(center: Vector3, radius: number): TransformNode {
    const doorPath = QUEEN_CHAMBER_GLBS.door;

    if (!AssetManager.isPathCached(doorPath)) {
      throw new Error(`[TheBreachLevel] Chamber door GLB not preloaded: ${doorPath}`);
    }

    const door = AssetManager.createInstanceByPath(
      doorPath,
      'queenDoor',
      this.scene,
      true,
      'environment'
    );

    if (!door) {
      throw new Error(`[TheBreachLevel] Failed to create door instance from: ${doorPath}`);
    }

    door.position.set(0, center.y + 5, center.z - radius);
    door.scaling.set(1.5, 1.5, 1.5);
    door.setEnabled(false); // Initially hidden

    log.info('Queen chamber door created with GLB');
    return door;
  }

  private placeHiveStructures(): void {
    if (!this.environmentBuilder) return;

    // Structure placements defined in environment.ts would be called here
    // For brevity, using direct placement calls
    const placements = this.getStructurePlacements();
    for (const p of placements) {
      this.environmentBuilder.placeStructure(p.type, p.position, p.zone, p.scale, p.rotationY);
    }
  }

  private getStructurePlacements(): Array<{
    type: 'birther' | 'brain' | 'claw' | 'crystals' | 'stomach' | 'terraformer' | 'undercrystal';
    position: Vector3;
    zone: HiveZone;
    scale: number;
    rotationY: number;
  }> {
    // Map environment zone names to HiveZone for the builder
    const zoneMap: Record<string, HiveZone> = {
      entry: 'upper',
      deep_hive: 'mid',
      queen_chamber: 'queen_chamber',
    };

    return HIVE_STRUCTURE_PLACEMENTS.map((p) => ({
      type: p.type,
      position: p.position,
      zone: zoneMap[p.zone] ?? 'mid',
      scale: p.scale,
      rotationY: p.rotationY,
    }));
  }

  private placeCapturedVehicles(): void {
    if (!this.environmentBuilder) return;

    this.environmentBuilder.placeCapturedVehicle(
      'wraith',
      new Vector3(-5, -75, 95),
      'mid',
      6,
      new Vector3(0.4, 1.2, 0.2)
    );
    this.environmentBuilder.placeCapturedVehicle(
      'phantom',
      new Vector3(8, -108, 128),
      'lower',
      8,
      new Vector3(-0.3, 2.5, 0.5)
    );
  }

  // ============================================================================
  // ENEMIES
  // ============================================================================

  private spawnInitialEnemies(): void {
    const config = getInitialSpawnConfig();
    for (const spawn of config) {
      const enemy = spawnEnemy(
        this.scene,
        spawn.position,
        spawn.type,
        spawn.zone,
        this.enemies.length
      );
      this.enemies.push(enemy);
    }
  }

  private spawnEnemyAtPosition(position: Vector3, type: 'drone' | 'grunt', zone: HiveZone): void {
    const enemy = spawnEnemy(this.scene, position, type, zone, this.enemies.length);
    this.enemies.push(enemy);
  }

  // ============================================================================
  // BOSS FIGHT
  // ============================================================================

  private startBossFight(): void {
    if (this.phase !== 'exploration' || !this.queen) return;

    // Save checkpoint before boss fight
    this.saveCheckpoint('boss_fight');

    this.phase = 'boss_intro';

    // Despawn remaining enemies when boss fight starts
    this.despawnRemainingEnemies();

    if (this.queenDoorMesh) {
      this.queenDoorMesh.setEnabled(true);
    }

    // Play intro cinematic for the Queen boss fight
    this.playQueenIntroCinematic(() => {
      // Cinematic complete, continue with boss fight setup
      this.callbacks.onNotification(NOTIFICATIONS.BOSS_AWAKEN, 3000);
      this.callbacks.onObjectiveUpdate(OBJECTIVES.BOSS_INTRO.title, OBJECTIVES.BOSS_INTRO.description);
      this.triggerShake(3);

      // Play queen awakening animation
      if (this.queen) {
        animateQueenAwakening(this.queen);
      }

      setTimeout(() => {
        this.callbacks.onCommsMessage(COMMS_BOSS_DETECTED);
      }, 2000);

      // Show tutorial hint for scan ability
      setTimeout(() => {
        if (!this.hintsShown.has('scan')) {
          this.callbacks.onNotification(NOTIFICATIONS.HINT_SCAN, 4000);
          this.hintsShown.add('scan');
        }
      }, 4000);

      setTimeout(() => {
        this.phase = 'boss_fight';
        this.callbacks.onCombatStateChange(true);
        this.updateActionButtons('boss');
        this.callbacks.onObjectiveUpdate(
          OBJECTIVES.KILL_QUEEN.title,
          OBJECTIVES.KILL_QUEEN.getDescription(this.queen!.health, this.queen!.maxHealth)
        );

        // Start boss fight music at phase 1
        getBossMusicManager().start(1);

        // Show cover hint
        setTimeout(() => {
          if (!this.hintsShown.has('cover')) {
            this.callbacks.onNotification(NOTIFICATIONS.HINT_COVER, 3000);
            this.hintsShown.add('cover');
          }
        }, 8000);
      }, 5000);
    });
  }

  /**
   * Despawn remaining enemies when boss fight starts to focus on the Queen.
   */
  private despawnRemainingEnemies(): void {
    const despawnCount = this.enemies.length;
    disposeEnemies(this.enemies);
    this.enemies = [];
    if (despawnCount > 0) {
      log.info(`Despawned ${despawnCount} enemies for boss fight`);
    }
  }

  private updateQueen(deltaTime: number): void {
    if (!this.queen || this.phase !== 'boss_fight') return;

    // Update queen AI state (handles stagger, charge movement, frenzy, etc.)
    updateQueenAI(this.queen, this.camera.position, deltaTime);

    // Update weak point visibility timer
    if (this.queen.weakPointVisible) {
      this.queen.weakPointTimer -= deltaTime * 1000;
      if (this.queen.weakPointTimer <= 0) {
        hideWeakPoints(this.queen);
        this.queen.isVulnerable = false;
        this.callbacks.onNotification(NOTIFICATIONS.WEAK_POINT_EXPIRED, 1000);
      }
    }

    // Cooldowns
    this.queen.attackCooldown -= deltaTime * 1000;
    this.queen.spawnCooldown -= deltaTime * 1000;

    // Phase transitions
    const newPhase = getQueenPhase(this.queen.health, this.queen.maxHealth, this.queen.phase);
    if (newPhase !== this.queen.phase) {
      this.transitionQueenPhase(newPhase);
    }

    // Check for death throes activation (10% health)
    if (!this.queen.aiState.deathThroesActive && shouldEnterDeathThroes(this.queen.health, this.queen.maxHealth)) {
      activateDeathThroes(this.queen);
      this.callbacks.onNotification('QUEEN ENTERS DEATH THROES!', 2000);
    }

    // Death throes spawning
    if (this.queen.aiState.deathThroesActive && this.queen.aiState.deathThroesTimer >= QUEEN_DEATH_THROES_SPAWN_INTERVAL) {
      this.queen.aiState.deathThroesTimer = 0;
      this.queenDeathThroesSpawn();
    }

    // Check charge collision with player
    if (this.queen.aiState.isCharging) {
      if (checkChargeCollision(this.queen.mesh.position, this.camera.position)) {
        const damage = getScaledQueenDamage('charge');
        this.damagePlayer(damage, 'QUEEN CHARGE');
        this.queen.aiState.totalDamageDealt += damage;
        // End charge on hit
        this.queen.aiState.isCharging = false;
        this.queen.aiState.chargeTarget = null;
        this.queen.aiState.chargeVelocity = null;
      }
    }

    // Execute attacks (only if not staggered and cooldown ready)
    if (this.queen.attackCooldown <= 0 && !this.queen.aiState.isStaggered) {
      this.queenAttack();
    }

    // Spawn minions (regular spawn, separate from attack spawns)
    if (this.queen.spawnCooldown <= 0 && !this.queen.aiState.deathThroesActive) {
      this.queenSpawnMinions();
    }

    // Animate
    animateQueen(this.queen, performance.now() / 1000);

    // Update HUD
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.QUEEN_PHASE.getTitle(this.queen.phase),
      OBJECTIVES.QUEEN_PHASE.getDescription(this.queen.health, this.queen.maxHealth)
    );
  }

  /**
   * Spawn enemies during death throes (continuous spawning at 10% health)
   */
  private queenDeathThroesSpawn(): void {
    if (!this.queen) return;

    const spawnCount = 2;
    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 5;
      const spawnPos = new Vector3(
        this.queen.mesh.position.x + Math.cos(angle) * dist,
        this.queen.mesh.position.y,
        this.queen.mesh.position.z + Math.sin(angle) * dist
      );
      this.spawnEnemyAtPosition(spawnPos, 'drone', 'queen_chamber');
    }

    this.callbacks.onNotification('DEATH THROES: DRONES SPAWNED!', 1000);
  }

  private transitionQueenPhase(newPhase: QueenPhase): void {
    if (!this.queen) return;

    const oldPhase = this.queen.phase;
    this.queen.phase = newPhase;

    // Play phase transition animation (includes 3s stagger)
    animatePhaseTransition(this.queen, newPhase);

    // Strong screen shake for roar
    this.triggerShake(8);

    // Transition boss music to match phase
    getBossMusicManager().transitionToPhase(newPhase);

    // Screen flash effect for phase transition
    this.screenFlash = 0.8;
    this.screenFlashColor = Color3.FromHexString(COLORS.queenPurple);

    // Enrage all existing minions (speed boost)
    for (const enemy of this.enemies) {
      // Minions get 50% speed boost on phase transition
      enemy.velocity.scaleInPlace(1.5);
    }

    if (newPhase === 2) {
      this.callbacks.onNotification(NOTIFICATIONS.PHASE_2_WARNING, 3000);
      setTimeout(() => {
        this.callbacks.onNotification(NOTIFICATIONS.BOSS_PHASE_2, 2000);
        this.callbacks.onCommsMessage(COMMS_BOSS_PHASE_2);
      }, 1000);

      // Show grenade hint
      if (!this.hintsShown.has('grenade')) {
        setTimeout(() => {
          this.callbacks.onNotification(NOTIFICATIONS.HINT_GRENADE, 3000);
          this.hintsShown.add('grenade');
        }, 5000);
      }

      // Play phase transition sound
      // Note: Audio system call would go here
    } else if (newPhase === 3) {
      this.callbacks.onNotification(NOTIFICATIONS.PHASE_3_WARNING, 3000);
      setTimeout(() => {
        this.callbacks.onNotification(NOTIFICATIONS.BOSS_PHASE_3, 2000);
        this.callbacks.onCommsMessage(COMMS_BOSS_PHASE_3);
      }, 1000);

      // Phase 3: Weak points glow brighter (handled in queen.ts updateQueenAI)
      // Show weak point hint if not already shown
      if (!this.hintsShown.has('weak_point_phase3')) {
        setTimeout(() => {
          this.callbacks.onNotification('WEAK POINTS NOW EASIER TO HIT!', 2500);
          this.hintsShown.add('weak_point_phase3');
        }, 3500);
      }
    }
  }

  private queenAttack(): void {
    if (!this.queen) return;

    // Use AI-driven attack selection
    const attackType = selectNextAttack(this.queen, this.camera.position, 0);

    if (attackType === 'none') {
      return; // Queen is staggered or can't attack
    }

    // Set attack cooldown based on phase
    this.queen.attackCooldown = getPhaseAttackCooldown(this.queen.phase);

    // Store current attack for tracking
    this.queen.aiState.currentAttack = attackType;

    // Execute the selected attack
    switch (attackType) {
      case 'acid_spray':
        this.queenAcidSpray();
        break;

      case 'tail_swipe':
        this.queenTailSwipe();
        break;

      case 'screech':
        this.queenScreech();
        break;

      case 'egg_burst':
        this.queenEggBurst();
        break;

      case 'charge':
        this.queenCharge();
        break;

      case 'poison_cloud':
        this.queenPoisonCloud();
        break;

      case 'frenzy':
        this.queenFrenzy();
        break;

      default:
        // Fallback to acid spray for any unmapped attacks
        this.queenAcidSpray();
        break;
    }
  }

  private queenAcidSpit(): void {
    this.callbacks.onNotification(NOTIFICATIONS.ACID_INCOMING, 1000);

    // Play acid spit animation
    if (this.queen) {
      animateAcidSpit(this.queen);
    }

    const playerPos = this.camera.position.clone();
    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.acid_spit;

    setTimeout(() => {
      if (this.hazardBuilder) {
        this.hazardBuilder.createPheromoneCloud(
          new Vector3(
            playerPos.x + (Math.random() - 0.5) * 3,
            playerPos.y,
            playerPos.z + (Math.random() - 0.5) * 3
          ),
          2,
          5000
        );
      }

      // Emit acid splatter particle effect
      particleManager.emitAlienSplatter(playerPos, 1.5);

      const dist = Vector3.Distance(this.camera.position, playerPos);
      if (dist < 3) {
        const damage = getScaledQueenDamage('acid_spit');
        this.damagePlayer(damage, 'Acid Spit');
      }
    }, telegraphTime);
  }

  private queenClawSwipe(): void {
    this.callbacks.onNotification(NOTIFICATIONS.CLAW_ATTACK, 800);

    if (this.queen) {
      animateClawSwipe(this.queen);
    }

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.claw_swipe;

    // Damage happens after telegraph
    setTimeout(() => {
      this.triggerShake(2);

      const dist = Vector3.Distance(this.camera.position, this.queen!.mesh.position);
      if (dist < 6) {
        const damage = getScaledQueenDamage('claw_swipe');
        this.damagePlayer(damage, 'Claw Swipe');
      }
    }, telegraphTime);
  }

  private queenTailSlam(): void {
    this.callbacks.onNotification(NOTIFICATIONS.TAIL_SLAM, 1000);

    if (this.queen) {
      animateTailSlam(this.queen);
    }

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.tail_slam;

    setTimeout(() => {
      this.triggerShake(4);
      const dist = Vector3.Distance(this.camera.position, this.queen!.mesh.position);
      if (dist < 8) {
        const damage = getScaledQueenDamage('tail_slam');
        this.damagePlayer(damage, 'Tail Slam');
      }
    }, telegraphTime);
  }

  private queenGroundPound(): void {
    this.callbacks.onNotification(NOTIFICATIONS.GROUND_POUND, 1500);

    if (this.queen) {
      animateGroundPound(this.queen);
    }

    // Show ground pound indicator
    this.showGroundPoundIndicator();

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.ground_pound;

    setTimeout(() => {
      this.triggerShake(6);
      // Hide indicator
      this.hideGroundPoundIndicator();

      // Ground pound hits everywhere in arena (but less damage if behind cover)
      const playerPos = this.camera.position;
      const queenPos = this.queen!.mesh.position;

      // Check if player is behind a pillar
      let behindCover = false;
      for (const pillar of this.arenaPillars) {
        const toPillar = pillar.position.subtract(queenPos).normalize();
        const toPlayer = playerPos.subtract(queenPos).normalize();
        const dot = Vector3.Dot(toPillar, toPlayer);
        const pillarDist = Vector3.Distance(playerPos, pillar.position);

        // Player is behind pillar if pillar is between queen and player, and player is close to pillar
        if (dot > 0.8 && pillarDist < 3) {
          behindCover = true;
          break;
        }
      }

      const baseDamage = getScaledQueenDamage('ground_pound');
      const damage = behindCover ? Math.floor(baseDamage * 0.3) : baseDamage;

      if (behindCover) {
        this.callbacks.onNotification('COVER ABSORBED IMPACT!', 1000);
      }

      this.damagePlayer(damage, 'Ground Pound');
    }, telegraphTime);
  }

  /**
   * Show the ground pound area indicator.
   */
  private showGroundPoundIndicator(): void {
    if (!this.groundPoundIndicator) return;

    this.groundPoundIndicator.isVisible = true;
    const mat = this.groundPoundIndicator.material as StandardMaterial;

    // Animate indicator expansion
    const startTime = performance.now();
    const duration = GROUND_POUND_INDICATOR_DURATION;

    const animateIndicator = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Scale up and increase opacity
      this.groundPoundIndicator!.scaling.setAll(0.3 + progress * 0.7);
      mat.alpha = 0.1 + progress * 0.4;

      if (progress < 1 && this.groundPoundIndicator!.isVisible) {
        requestAnimationFrame(animateIndicator);
      }
    };

    requestAnimationFrame(animateIndicator);
  }

  /**
   * Hide the ground pound indicator.
   */
  private hideGroundPoundIndicator(): void {
    if (!this.groundPoundIndicator) return;

    this.groundPoundIndicator.isVisible = false;
    const mat = this.groundPoundIndicator.material as StandardMaterial;
    mat.alpha = 0;
    this.groundPoundIndicator.scaling.setAll(1);
  }

  // ============================================================================
  // NEW ATTACK IMPLEMENTATIONS (Phase-based attack system)
  // ============================================================================

  /**
   * Phase 1 Attack: Acid Spray - Cone of 5 acid projectiles
   */
  private queenAcidSpray(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('ACID SPRAY INCOMING!', 1000);
    animateAcidSpray(this.queen);

    const playerPos = this.camera.position.clone();
    const queenPos = this.queen.mesh.position.clone();
    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.acid_spray;

    // Get projectile directions (cone pattern)
    const projectileDirections = getAcidSprayPositions(queenPos, playerPos);

    setTimeout(() => {
      if (!this.queen) return;

      // Spawn acid projectiles in cone pattern
      for (let i = 0; i < projectileDirections.length; i++) {
        const dir = projectileDirections[i];
        const startPos = queenPos.clone();
        startPos.y += 2; // Fire from head height

        // Create acid projectile visual
        if (this.hazardBuilder) {
          // Spawn pheromone cloud at predicted impact point
          const impactPos = startPos.add(dir.scale(15));
          setTimeout(() => {
            this.hazardBuilder?.createPheromoneCloud(
              impactPos,
              2,
              3000
            );
          }, i * 100); // Stagger impacts
        }

        // Check if player is in path
        const toPlayer = playerPos.subtract(startPos);
        const dot = Vector3.Dot(toPlayer.normalize(), dir);
        if (dot > 0.8 && toPlayer.length() < QUEEN_ATTACK_RANGE.acid_spray) {
          const damage = getScaledQueenDamage('acid_spray');
          setTimeout(() => {
            this.damagePlayer(damage, 'Acid Spray');
            if (this.queen) {
              this.queen.aiState.totalDamageDealt += damage;
            }
          }, i * 100);
        }
      }

      // Particle effects
      particleManager.emitAlienSplatter(queenPos.add(new Vector3(0, 2, -1)), 2);
      this.triggerShake(2);
    }, telegraphTime);
  }

  /**
   * Phase 1 Attack: Tail Swipe - Frontal arc melee attack
   */
  private queenTailSwipe(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('TAIL SWIPE!', 800);
    animateTailSwipe(this.queen);

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.tail_swipe;

    setTimeout(() => {
      if (!this.queen) return;

      this.triggerShake(3);

      const playerPos = this.camera.position;
      const queenPos = this.queen.mesh.position;
      const dist = Vector3.Distance(playerPos, queenPos);

      // Check if player is in frontal arc
      const toPlayer = playerPos.subtract(queenPos).normalize();
      const queenForward = new Vector3(0, 0, -1); // Queen faces -Z
      const dot = Vector3.Dot(toPlayer, queenForward);

      // Hit if within range AND in frontal arc (dot > 0.3 = ~70 degree arc)
      if (dist < QUEEN_ATTACK_RANGE.tail_swipe && dot > 0.3) {
        const damage = getScaledQueenDamage('tail_swipe');
        this.damagePlayer(damage, 'Tail Swipe');
        this.queen.aiState.totalDamageDealt += damage;
      }
    }, telegraphTime);
  }

  /**
   * Phase 1 Attack: Screech - Stuns player briefly, summons skitterers
   */
  private queenScreech(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('QUEEN SCREECH!', 1500);
    animateScreech(this.queen);

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.screech;

    // Screen shake during screech
    this.triggerShake(4);

    // Spawn skitterers
    setTimeout(() => {
      if (!this.queen) return;

      // Summon skitterers near the player
      for (let i = 0; i < QUEEN_SCREECH_SPAWN_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 3;
        const spawnPos = new Vector3(
          this.camera.position.x + Math.cos(angle) * dist,
          this.queen.mesh.position.y,
          this.camera.position.z + Math.sin(angle) * dist
        );
        this.spawnEnemyAtPosition(spawnPos, 'drone', 'queen_chamber');
      }

      this.callbacks.onNotification(`${QUEEN_SCREECH_SPAWN_COUNT} SKITTERERS SUMMONED!`, 1500);

      // Minor damage from screech
      const damage = getScaledQueenDamage('screech');
      this.damagePlayer(damage, 'Screech');
      this.queen.aiState.totalDamageDealt += damage;

      // Visual stun effect (screen flash)
      this.screenFlash = 0.5;
      this.screenFlashColor = Color3.FromHexString(COLORS.queenPurple);
    }, telegraphTime);
  }

  /**
   * Phase 2 Attack: Egg Burst - Spawns spitters from arena edges
   */
  private queenEggBurst(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('EGG BURST!', 1500);
    animateEggBurst(this.queen);

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.egg_burst;

    setTimeout(() => {
      if (!this.queen) return;

      // Get arena center and radius for spawn positions
      const arenaCenter = new Vector3(0, -150, 180);
      const arenaRadius = 25;
      const spawnPositions = getEggBurstSpawnPositions(arenaCenter, arenaRadius);

      // Spawn spitters at each position
      for (const pos of spawnPositions) {
        this.spawnEnemyAtPosition(pos, 'grunt', 'queen_chamber'); // Using grunt as "spitter"
        // Particle effect for egg hatching
        particleManager.emitAlienDeath(pos, 0.5);
      }

      this.callbacks.onNotification(`${spawnPositions.length} SPITTERS SPAWNED FROM EGGS!`, 2000);
      this.triggerShake(3);
    }, telegraphTime);
  }

  /**
   * Phase 2 Attack: Charge - Rush toward player
   */
  private queenCharge(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('QUEEN CHARGING!', 1500);

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.charge;

    // Wind-up shake
    this.triggerShake(2);

    setTimeout(() => {
      if (!this.queen) return;

      // Calculate charge target (where player was)
      const targetPos = this.camera.position.clone();
      targetPos.y = this.queen.mesh.position.y; // Keep same height

      // Start charge animation
      animateCharge(this.queen, targetPos);

      this.callbacks.onNotification('DODGE!', 500);
      this.triggerShake(4);

      // Damage is handled in updateQueen via checkChargeCollision
    }, telegraphTime);
  }

  /**
   * Phase 2 Attack: Poison Cloud - Area denial
   */
  private queenPoisonCloud(): void {
    if (!this.queen) return;

    this.callbacks.onNotification('POISON CLOUD!', 1000);
    animatePoisonCloud(this.queen);

    const telegraphTime = QUEEN_ATTACK_TELEGRAPH.poison_cloud;

    setTimeout(() => {
      if (!this.queen || !this.hazardBuilder) return;

      // Create poison cloud at player's current position
      const cloudPos = this.camera.position.clone();
      cloudPos.y = this.queen.mesh.position.y;

      // Use pheromone cloud as poison effect
      this.hazardBuilder.createPheromoneCloud(
        cloudPos,
        6, // Large radius
        QUEEN_POISON_CLOUD_DURATION
      );

      // Particle effect
      particleManager.emitAlienSplatter(cloudPos, 3);
      this.triggerShake(2);

      this.callbacks.onNotification('POISON CLOUD DEPLOYED - MOVE!', 2000);

      // Periodic damage while in cloud is handled by checkHazards
    }, telegraphTime);
  }

  /**
   * Phase 3 Attack: Frenzy - Rapid consecutive attacks
   */
  private queenFrenzy(): void {
    if (!this.queen) return;

    // Start frenzy mode
    startFrenzy(this.queen);

    this.callbacks.onNotification('FRENZY ATTACK!', 2000);
    this.triggerShake(5);

    // Execute rapid attacks
    const executeNextFrenzyAttack = (attackIndex: number): void => {
      if (!this.queen || attackIndex >= QUEEN_FRENZY_ATTACK_COUNT) {
        return;
      }

      // Animate current attack
      animateFrenzyAttack(this.queen, attackIndex);

      // Check for hit
      const playerPos = this.camera.position;
      const queenPos = this.queen.mesh.position;
      const dist = Vector3.Distance(playerPos, queenPos);

      if (dist < QUEEN_ATTACK_RANGE.frenzy) {
        const damage = getScaledQueenDamage('frenzy');
        setTimeout(() => {
          this.damagePlayer(damage, 'Frenzy Strike');
          if (this.queen) {
            this.queen.aiState.totalDamageDealt += damage;
          }
        }, QUEEN_FRENZY_ATTACK_DELAY * 0.5);
      }

      // Schedule next attack
      setTimeout(() => {
        executeNextFrenzyAttack(attackIndex + 1);
      }, QUEEN_FRENZY_ATTACK_DELAY);
    };

    // Start frenzy combo
    executeNextFrenzyAttack(0);
  }

  private queenSpawnMinions(): void {
    if (!this.queen) return;

    const spawnCount = getSpawnCount(this.queen.phase);
    const spawnType = getSpawnType(this.queen.phase);

    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 5;
      const spawnPos = new Vector3(
        this.queen.mesh.position.x + Math.cos(angle) * dist,
        this.queen.mesh.position.y,
        this.queen.mesh.position.z + Math.sin(angle) * dist
      );
      this.spawnEnemyAtPosition(spawnPos, spawnType, 'queen_chamber');
    }

    this.queen.spawnCooldown = getSpawnCooldown(this.queen.phase);
    this.callbacks.onNotification(NOTIFICATIONS.MINIONS_SPAWNED(spawnCount, spawnType), 1500);
  }

  private damageQueenInternal(amount: number, isWeakPoint: boolean): void {
    if (!this.queen || this.queen.health <= 0) return;

    const actualDamage = calculateQueenDamage(amount, isWeakPoint);
    this.queen.health -= actualDamage;

    if (isWeakPoint) {
      this.callbacks.onNotification(NOTIFICATIONS.CRITICAL_HIT(actualDamage), 1000);
      this.screenFlash = 0.3;
      this.screenFlashColor = new Color3(1, 0.3, 0.3);
    }

    if (this.queen.health <= 0) {
      this.queen.health = 0;
      this.queenDeath();
    }
  }

  private queenDeath(): void {
    if (!this.queen) return;

    this.phase = 'boss_death';
    this.queenDefeated = true;

    // Play queen death animation
    animateQueenDeath(this.queen);

    getAchievementManager().onQueenDefeated();

    // Play victory stinger - dramatic musical resolution
    getBossMusicManager().playVictoryStinger();

    this.callbacks.onNotification(NOTIFICATIONS.BOSS_DEFEATED, 3000);
    this.triggerShake(8);

    // Screen flash for dramatic death
    this.screenFlash = 1.0;
    this.screenFlashColor = new Color3(1, 1, 1);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS_BOSS_DEATH);
    }, 2000);

    // Show victory stats
    const elapsedTime = (performance.now() - this.levelStartTime) / 1000;
    setTimeout(() => {
      this.callbacks.onNotification(
        NOTIFICATIONS.VICTORY_STATS(elapsedTime, this.enemiesKilled, this.totalDamageTaken),
        5000
      );
    }, 3500);

    setTimeout(() => {
      this.callbacks.onNotification(NOTIFICATIONS.ESCAPE, 3000);

      if (this.queenDoorMesh) {
        this.queenDoorMesh.setEnabled(false);
      }

      this.phase = 'escape_trigger';
      this.escapeTimer = 0;
      this.callbacks.onObjectiveUpdate(
        OBJECTIVES.ESCAPE.title,
        OBJECTIVES.ESCAPE.getDescription(30)
      );

      setTimeout(() => {
        this.completeLevel();
      }, 5000);
    }, 6000);
  }

  // ============================================================================
  // PLAYER
  // ============================================================================

  private damagePlayer(amount: number, source: string): void {
    const now = performance.now();

    // Apply difficulty-scaled invincibility frames
    const iframeScaling = INVINCIBILITY_SCALING[this.difficulty] ?? 1.0;
    const scaledIframes = DAMAGE_INVINCIBILITY_MS * iframeScaling;

    if (now - this.lastDamageTime < scaledIframes) return;

    this.playerHealth -= amount;
    this.lastDamageTime = now;
    this.totalDamageTaken += amount;

    // Apply player damage feedback (screen shake scaled to damage)
    damageFeedback.applyPlayerDamageFeedback(amount);

    this.callbacks.onDamage();
    this.callbacks.onHealthChange(Math.max(0, this.playerHealth));

    if (this.playerHealth <= 0) {
      this.callbacks.onNotification(`KILLED BY ${source}`, 3000);
    }
  }

  private checkHazards(): void {
    if (!this.hazardBuilder) return;

    const playerPos = this.camera.position;

    // Acid pools
    const acidDamage = checkAcidPoolDamage(playerPos, this.hazardBuilder.getAcidPools());
    if (acidDamage > 0) {
      this.damagePlayer(acidDamage * 0.016, 'ACID POOL');
    }

    // Egg clusters
    const triggeredCluster = checkEggClusterTrigger(playerPos, this.hazardBuilder.getEggClusters());
    if (triggeredCluster) {
      triggeredCluster.triggered = true;
      this.callbacks.onNotification(NOTIFICATIONS.EGGS_HATCHING, 1500);

      for (let i = 0; i < triggeredCluster.droneCount; i++) {
        const angle = (i / triggeredCluster.droneCount) * Math.PI * 2;
        const spawnPos = triggeredCluster.position.add(
          new Vector3(Math.cos(angle) * 2, 0, Math.sin(angle) * 2)
        );
        this.spawnEnemyAtPosition(spawnPos, 'drone', this.currentZone);
      }
    }

    // Pheromone clouds
    if (checkPheromoneCloud(playerPos, this.hazardBuilder.getPheromoneClouds())) {
      this.screenFlash = 0.1;
      this.screenFlashColor = Color3.FromHexString(COLORS.acidGreen);
    }
  }

  private updateZone(): void {
    const playerZ = this.camera.position.z;
    const playerY = this.camera.position.y;

    this.previousZone = this.currentZone;

    if (playerZ > 150 && playerY < -140) {
      if (this.currentZone !== 'queen_chamber') {
        this.currentZone = 'queen_chamber';
        if (this.previousZone !== 'queen_chamber') {
          this.callbacks.onNotification(NOTIFICATIONS.ZONE_QUEEN, 2000);
        }
        if (this.phase === 'exploration') {
          this.startBossFight();
        }
      }
    } else if (playerZ > 100 && playerY < -90) {
      if (this.currentZone !== 'lower' && this.previousZone !== 'lower') {
        this.callbacks.onNotification(NOTIFICATIONS.ZONE_LOWER, 2000);
      }
      this.currentZone = 'lower';
      this.depth = 100 + (playerZ - 100) * 0.5;
    } else if (playerZ > 50 && playerY < -45) {
      if (this.currentZone !== 'mid' && this.previousZone !== 'mid') {
        this.callbacks.onNotification(NOTIFICATIONS.ZONE_MID, 2000);
      }
      this.currentZone = 'mid';
      this.depth = 50 + (playerZ - 50) * 0.8;
    } else {
      this.currentZone = 'upper';
      this.depth = playerZ * 0.7;
    }
  }

  // ============================================================================
  // ACTION HANDLING
  // ============================================================================

  private handleAction(actionId: string): void {
    switch (actionId) {
      case 'grenade':
        this.throwGrenade();
        break;
      case 'melee':
        this.meleeAttack();
        break;
      case 'weak_point':
        this.scanWeakPoint();
        break;
      case 'reload':
        this.handleReload();
        break;
    }
  }

  private throwGrenade(): void {
    if (this.grenadeCooldown > 0 || this.grenadeCount <= 0) {
      this.callbacks.onNotification(NOTIFICATIONS.GRENADE_NOT_READY, 800);
      return;
    }

    this.grenadeCount--;
    this.grenadeCooldown = GRENADE_COOLDOWN;

    const targetPos = this.camera.position.add(
      this.camera.getDirection(Vector3.Forward()).scale(10)
    );

    this.callbacks.onNotification(NOTIFICATIONS.GRENADE_OUT, 1000);

    setTimeout(() => {
      this.triggerShake(3);
      this.screenFlash = 0.5;
      this.screenFlashColor = new Color3(1, 0.8, 0.4);

      particleManager.emitSmallExplosion(targetPos, 1.5);

      // Damage enemies
      for (const enemy of this.enemies) {
        const dist = Vector3.Distance(enemy.position, targetPos);
        if (dist < GRENADE_RADIUS) {
          const damage = GRENADE_MAX_DAMAGE * (1 - dist / GRENADE_RADIUS);
          if (damageEnemy(enemy, damage)) {
            this.enemiesKilled++;
            this.callbacks.onKill();
          }
        }
      }
      this.enemies = this.enemies.filter((e) => e.state !== 'dead');

      // Damage queen
      if (this.queen && this.phase === 'boss_fight') {
        const queenDist = Vector3.Distance(this.queen.mesh.position, targetPos);
        if (queenDist < 10) {
          const damage = 100 * (1 - queenDist / 10);
          this.damageQueenInternal(damage, false);
        }
      }
    }, 1500);
  }

  private handleReload(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;

    const state = weaponActions.getState();
    if (state.isReloading) return;

    if (state.currentAmmo >= state.maxMagazineSize) {
      this.callbacks.onNotification(NOTIFICATIONS.MAGAZINE_FULL, 800);
      return;
    }

    if (state.reserveAmmo <= 0) {
      this.callbacks.onNotification(NOTIFICATIONS.NO_RESERVE_AMMO, 800);
      return;
    }

    startReload();
    this.callbacks.onNotification(NOTIFICATIONS.RELOADING, 1500);
  }

  private meleeAttack(): void {
    if (this.meleeCooldown > 0) return;

    this.meleeCooldown = MELEE_COOLDOWN;
    this.callbacks.onNotification(NOTIFICATIONS.MELEE, 500);

    const playerPos = this.camera.position;
    const forward = this.camera.getDirection(Vector3.Forward());

    for (const enemy of this.enemies) {
      const toEnemy = enemy.position.subtract(playerPos);
      const dist = toEnemy.length();
      if (dist < MELEE_RANGE) {
        const dot = Vector3.Dot(toEnemy.normalize(), forward);
        if (dot > 0.5) {
          if (damageEnemy(enemy, MELEE_DAMAGE)) {
            this.enemiesKilled++;
            this.callbacks.onKill();
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.state !== 'dead');
  }

  private scanWeakPoint(): void {
    if (!this.queen || this.phase !== 'boss_fight' || this.scanCooldown > 0) {
      this.callbacks.onNotification(NOTIFICATIONS.SCAN_NOT_AVAILABLE, 800);
      return;
    }

    // Apply difficulty-scaled cooldown
    const cooldownScaling = SCAN_COOLDOWN_SCALING[this.difficulty] ?? 1.0;
    this.scanCooldown = WEAK_POINT_COOLDOWN * cooldownScaling;
    this.callbacks.onNotification(NOTIFICATIONS.SCANNING, 1500);

    setTimeout(() => {
      if (!this.queen) return;

      // Use new weak point system - reveal all weak points
      revealWeakPoints(this.queen);
      this.queen.isVulnerable = true;

      // Apply difficulty-scaled weak point duration
      const durationScaling = WEAK_POINT_DURATION_SCALING[this.difficulty] ?? 1.0;
      this.queen.weakPointTimer = WEAK_POINT_DURATION * durationScaling;

      // Count active weak points
      const activeWeakPoints = this.queen.weakPoints.filter(wp => !wp.isDestroyed).length;

      this.callbacks.onNotification(
        `${activeWeakPoints} WEAK POINTS REVEALED!`,
        2000
      );

      // Show weak point damage hint
      if (!this.hintsShown.has('weak_point')) {
        setTimeout(() => {
          this.callbacks.onNotification(NOTIFICATIONS.HINT_WEAK_POINT, 2500);
          this.hintsShown.add('weak_point');
        }, 2500);
      }
    }, 1500);
  }

  private updateActionButtons(mode: 'exploration' | 'boss' | 'none'): void {
    let groups: ActionButtonGroup[] = [];

    // Get keybindings - level-specific (fixed) and configurable
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    const scanner = levelActionParams('scanner');
    const reload = bindableActionParams('reload');

    if (mode === 'exploration' || mode === 'boss') {
      const buttons = [
        createAction('grenade', 'GRENADE', grenade.key, {
          keyDisplay: grenade.keyDisplay,
          cooldown: GRENADE_COOLDOWN,
          variant: 'danger',
        }),
        createAction('melee', 'MELEE', melee.key, {
          keyDisplay: melee.keyDisplay,
          variant: 'primary',
        }),
        createAction('reload', 'RELOAD', reload.key, {
          keyDisplay: reload.keyDisplay,
          variant: 'secondary',
        }),
      ];

      if (mode === 'boss') {
        buttons.push(
          createAction('weak_point', 'SCAN WEAKNESS', scanner.key, {
            keyDisplay: scanner.keyDisplay,
            cooldown: WEAK_POINT_COOLDOWN,
            variant: 'warning',
          })
        );
      }

      groups = [{ id: mode === 'boss' ? 'boss' : 'combat', position: 'right', buttons }];
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  protected updateLevel(deltaTime: number): void {
    // Update cinematic system
    if (this.cinematicSystem) {
      this.cinematicSystem.update(deltaTime);

      // Don't update gameplay if cinematic is playing
      if (this.cinematicSystem.isPlaying()) {
        return;
      }
    }

    this.phaseTimer += deltaTime;

    // Update collectibles
    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) {
        this.collectibleSystem.collect(nearby.id);
      }
    }

    // Update damage feedback system (floating damage numbers, etc.)
    damageFeedback.update(deltaTime);
    damageFeedback.setCameraPosition(this.camera.position);

    // Update biolights
    if (this.environmentBuilder) {
      updateBiolights(this.environmentBuilder.getBiolights(), performance.now() / 1000);
    }

    // Update pheromone clouds
    if (this.hazardBuilder) {
      this.hazardBuilder.updatePheromoneClouds(deltaTime);
    }

    // Check zone and hazards
    this.updateZone();
    this.checkHazards();

    // Update enemies
    for (const enemy of this.enemies) {
      updateEnemyAI(enemy, this.camera.position, deltaTime);
      const damage = getEnemyAttackDamage(enemy, this.camera.position);
      if (damage > 0) {
        this.damagePlayer(damage, enemy.type.toUpperCase());
      }
    }

    // Update queen
    if (this.queen && this.phase === 'boss_fight') {
      this.updateQueen(deltaTime);
    }

    // Update cooldowns
    if (this.grenadeCooldown > 0) this.grenadeCooldown -= deltaTime * 1000;
    if (this.meleeCooldown > 0) this.meleeCooldown -= deltaTime * 1000;
    if (this.scanCooldown > 0) this.scanCooldown -= deltaTime * 1000;

    // Screen flash decay
    if (this.screenFlash > 0) {
      this.screenFlash *= 0.9;
      if (this.screenFlash < 0.01) this.screenFlash = 0;
    }

    // Escape sequence
    if (this.phase === 'escape_trigger') {
      this.escapeTimer += deltaTime;
      this.setBaseShake(Math.min(8, 2 + this.escapeTimer * 2));
    }

    // HUD updates for exploration
    if (this.phase === 'exploration') {
      this.callbacks.onObjectiveUpdate(
        OBJECTIVES.EXPLORATION.getTitle(this.currentZone),
        OBJECTIVES.EXPLORATION.getDescription(this.depth, this.enemies.length, this.enemiesKilled)
      );
    }
  }

  // ============================================================================
  // INPUT OVERRIDES
  // ============================================================================

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Get keybindings for action mapping
    const fireKeys = this.inputTracker.getAllKeysForAction('fire');
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');

    if (this.actionCallback) {
      // Level-specific action keys (G for grenade, V for melee, T for scanner)
      // These are level-specific combat abilities, not part of the global keybindings system
      switch (e.code) {
        case 'KeyG':
          this.actionCallback('grenade');
          break;
        case 'KeyV':
          this.actionCallback('melee');
          break;
        case 'KeyT':
          if (this.phase === 'boss_fight') {
            this.actionCallback('weak_point');
          }
          break;
      }
    }

    // Handle reload action (configurable keybinding, default: R)
    if (reloadKeys.includes(e.code)) {
      this.handleReload();
    }

    // Handle fire action (configurable keybinding, for non-mouse bindings)
    const nonMouseFireKeys = fireKeys.filter((k) => !k.startsWith('Mouse'));
    if (nonMouseFireKeys.includes(e.code)) {
      this.firePrimaryWeapon();
    }
  }

  protected override handleClick(): void {
    super.handleClick();

    if (this.isPointerLocked()) {
      this.firePrimaryWeapon();
    }
  }

  private firePrimaryWeapon(): void {
    if (!this.isPointerLocked()) return;

    if (!fireWeapon()) {
      this.callbacks.onNotification(NOTIFICATIONS.NO_AMMO_RELOADING, 800);
      startReload();
      return;
    }

    const playerPos = this.camera.position;
    const forward = this.camera.getDirection(Vector3.Forward());

    // Check enemy hits
    const hitEnemy = checkEnemyHit(this.enemies, playerPos, forward);
    if (hitEnemy) {
      // Pass hit direction for knockback effect
      if (damageEnemy(hitEnemy, 20, forward)) {
        this.enemiesKilled++;
        this.callbacks.onKill();
        this.enemies = this.enemies.filter((e) => e !== hitEnemy);
      }
      return;
    }

    // Check queen hit
    if (this.queen && this.phase === 'boss_fight') {
      const toQueen = this.queen.mesh.position.subtract(playerPos);
      const dist = toQueen.length();
      const dot = Vector3.Dot(toQueen.normalize(), forward);

      if (dot > 0.8 && dist < 40) {
        // Calculate approximate hit position for weak point check
        const hitDist = dist * 0.9; // Approximate hit on queen surface
        const hitPosition = playerPos.add(forward.scale(hitDist));

        // Check all weak points using the new system
        const hitWeakPoint = checkWeakPointHit(this.queen, hitPosition);
        if (hitWeakPoint) {
          // Damage the weak point
          const wasDestroyed = damageWeakPoint(this.queen, hitWeakPoint, 50);

          if (wasDestroyed) {
            this.callbacks.onNotification(`${hitWeakPoint.id.toUpperCase()} WEAK POINT DESTROYED!`, 2000);
            this.triggerShake(5);
            this.screenFlash = 0.5;
            this.screenFlashColor = new Color3(1, 0.5, 0);

            // Particle burst on weak point destruction
            particleManager.emitCriticalHit(hitPosition, 2);
          } else {
            // Visual feedback for weak point hit
            this.screenFlash = 0.3;
            this.screenFlashColor = new Color3(1, 0.3, 0.3);
            particleManager.emitCriticalHit(hitPosition, 1);
          }

          // Also damage the queen's main health
          this.damageQueenInternal(50, true);
          return;
        }

        // Legacy weak point check for backwards compatibility
        if (this.queen.weakPointVisible && this.queen.weakPointMesh) {
          const toWeakPoint = this.queen.weakPointMesh.position.subtract(playerPos);
          const wpDot = Vector3.Dot(toWeakPoint.normalize(), forward);
          const wpDist = toWeakPoint.length();
          const wpCrossDist = Math.sqrt(1 - wpDot * wpDot) * wpDist;

          if (wpDot > 0.9 && wpCrossDist < 1) {
            this.damageQueenInternal(50, true);
            return;
          }
        }

        this.damageQueenInternal(20, false);
      }
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'extraction' && this.queenDefeated;
  }

  protected disposeLevel(): void {
    // Dispose cinematic system
    this.cinematicSystem?.dispose();
    this.cinematicSystem = null;

    // Dispose collectibles
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;

    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Stop boss music if playing
    getBossMusicManager().stop(0.5);

    // Dispose environment
    this.environmentBuilder?.dispose();

    // Dispose placed breach GLB assets (beams, detail plates, organic growths)
    disposeBreachAssets(this.placedBreachAssets);
    this.placedBreachAssets = [];

    // Dispose hazards
    this.hazardBuilder?.dispose();

    // Dispose enemies
    disposeEnemies(this.enemies);
    this.enemies = [];

    // Dispose queen
    if (this.queen) {
      disposeQueen(this.queen);
    }

    // Dispose queen chamber geometry
    this.queenArena?.dispose();
    this.queenDoorMesh?.dispose();
    this.queenDomeMesh?.dispose();

    // Dispose arena pillars
    for (const pillar of this.arenaPillars) {
      pillar.dispose();
    }
    this.arenaPillars = [];

    // Dispose ground pound indicator
    this.groundPoundIndicator?.dispose();
    this.groundPoundIndicator = null;

    // Clear hints
    this.hintsShown.clear();

    // Dispose damage feedback system
    damageFeedback.dispose();
  }
}
