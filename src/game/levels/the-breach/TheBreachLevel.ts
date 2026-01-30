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
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { AssetManager } from '../../core/AssetManager';
import { getBossMusicManager } from '../../core/BossMusicManager';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
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
} from './constants';
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
import { HiveEnvironmentBuilder, updateBiolights } from './environment';
import {
  checkAcidPoolDamage,
  checkEggClusterTrigger,
  checkPheromoneCloud,
  HazardBuilder,
} from './hazards';
import {
  animateClawSwipe,
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
} from './queen';
import type { Enemy, HiveZone, LevelPhase, Queen, QueenPhase } from './types';

// ============================================================================
// LEVEL CLASS
// ============================================================================

export class TheBreachLevel extends BaseLevel {
  // Level state
  private phase: LevelPhase = 'exploration';
  private currentZone: HiveZone = 'upper';
  private depth = 0;

  // Environment builders
  private environmentBuilder: HiveEnvironmentBuilder | null = null;
  private hazardBuilder: HazardBuilder | null = null;

  // Queen boss
  private queen: Queen | null = null;
  private queenArena: Mesh | null = null;
  private queenDoorMesh: Mesh | null = null;
  private queenDefeated = false;

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

  // Screen effects
  private screenFlash = 0;
  private screenFlashColor = new Color3(1, 1, 1);

  // Action callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Timers
  private phaseTimer = 0;
  private escapeTimer = 0;

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

    // Load assets
    await this.environmentBuilder.loadHiveStructures();
    await this.environmentBuilder.loadCapturedVehicles();

    // Build the hive structure
    this.createUpperHive();
    this.createMidHive();
    this.createLowerHive();
    this.createQueenChamber();

    // Place hive structures and vehicles
    this.placeHiveStructures();
    this.placeCapturedVehicles();

    // Initialize hazard builder
    this.hazardBuilder = new HazardBuilder(this.scene, this.environmentBuilder.getGlowLayer());
    this.hazardBuilder.createStandardAcidPools();
    this.hazardBuilder.createStandardEggClusters();

    // Preload enemy GLB models before spawning
    await preloadEnemyModels(this.scene);

    // Spawn initial enemies (now using GLB models)
    this.spawnInitialEnemies();

    // Setup player
    this.camera.position.set(0, 1.7, 0);
    this.callbacks.onHealthChange(this.playerHealth);

    // Start level
    this.startLevel();
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

    // Arena floor
    this.queenArena = MeshBuilder.CreateDisc(
      'queenArena',
      { radius: chamberRadius, tessellation: 48 },
      this.scene
    );
    const arenaMat = new StandardMaterial('arenaMat', this.scene);
    arenaMat.diffuseColor = Color3.FromHexString(COLORS.chitinDark);
    arenaMat.specularColor = new Color3(0.1, 0.1, 0.1);
    this.queenArena.material = arenaMat;
    this.queenArena.position = chamberCenter.clone();
    this.queenArena.rotation.x = Math.PI / 2;

    // Dome ceiling
    const dome = MeshBuilder.CreateSphere(
      'queenDome',
      { diameter: chamberRadius * 2.5, segments: 24, slice: 0.5, sideOrientation: 1 },
      this.scene
    );
    const domeMat = new StandardMaterial('domeMat', this.scene);
    domeMat.diffuseColor = Color3.FromHexString(COLORS.chitinPurple);
    domeMat.emissiveColor = new Color3(0.02, 0.01, 0.03);
    dome.material = domeMat;
    dome.position.set(chamberCenter.x, chamberCenter.y + 5, chamberCenter.z);
    dome.rotation.x = Math.PI;

    // Entrance tunnel
    this.environmentBuilder.createTunnelSegment(
      new Vector3(0, chamberCenter.y + 5, chamberCenter.z - chamberRadius - 4),
      0,
      'queen_chamber'
    );

    // Door for boss fight
    this.queenDoorMesh = MeshBuilder.CreateBox(
      'queenDoor',
      { width: TUNNEL_DIAMETER + 1, height: TUNNEL_DIAMETER + 1, depth: 0.5 },
      this.scene
    );
    const doorMat = new StandardMaterial('doorMat', this.scene);
    doorMat.diffuseColor = Color3.FromHexString('#2A1A2A');
    this.queenDoorMesh.material = doorMat;
    this.queenDoorMesh.position.set(0, chamberCenter.y + 5, chamberCenter.z - chamberRadius);
    this.queenDoorMesh.isVisible = false;

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

    // Create the Queen
    this.queen = createQueen(
      this.scene,
      new Vector3(0, chamberCenter.y, chamberCenter.z + chamberRadius - 5),
      this.environmentBuilder.getGlowLayer()
    );
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
    // Returns the structure placement configuration
    // This could be moved to a separate config file if needed
    return [
      // Upper tunnels
      {
        type: 'crystals',
        position: new Vector3(1.5, -15, 25),
        zone: 'upper',
        scale: 0.4,
        rotationY: Math.PI / 4,
      },
      {
        type: 'crystals',
        position: new Vector3(-1.8, -25, 35),
        zone: 'upper',
        scale: 0.35,
        rotationY: -Math.PI / 6,
      },
      // Mid hive
      {
        type: 'birther',
        position: new Vector3(-4, -58, 75),
        zone: 'mid',
        scale: 0.6,
        rotationY: Math.PI,
      },
      {
        type: 'terraformer',
        position: new Vector3(5, -65, 82),
        zone: 'mid',
        scale: 0.5,
        rotationY: -Math.PI / 4,
      },
      // Lower hive
      {
        type: 'brain',
        position: new Vector3(0, -95, 112),
        zone: 'lower',
        scale: 0.8,
        rotationY: 0,
      },
      // Queen chamber
      {
        type: 'brain',
        position: new Vector3(0, -148, 198),
        zone: 'queen_chamber',
        scale: 1.2,
        rotationY: Math.PI,
      },
    ];
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

    this.phase = 'boss_intro';

    if (this.queenDoorMesh) {
      this.queenDoorMesh.isVisible = true;
    }

    this.callbacks.onNotification(NOTIFICATIONS.BOSS_AWAKEN, 3000);
    this.triggerShake(3);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS_BOSS_DETECTED);
    }, 2000);

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
    }, 5000);
  }

  private updateQueen(deltaTime: number): void {
    if (!this.queen || this.phase !== 'boss_fight') return;

    // Update weak point visibility
    if (this.queen.weakPointVisible) {
      this.queen.weakPointTimer -= deltaTime * 1000;
      if (this.queen.weakPointTimer <= 0) {
        this.queen.weakPointVisible = false;
        this.queen.isVulnerable = false;
        if (this.queen.weakPointMesh) {
          this.queen.weakPointMesh.isVisible = false;
        }
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

    // Execute attacks
    if (this.queen.attackCooldown <= 0) {
      this.queenAttack();
    }

    // Spawn minions
    if (this.queen.spawnCooldown <= 0) {
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

  private transitionQueenPhase(newPhase: QueenPhase): void {
    if (!this.queen) return;

    this.queen.phase = newPhase;
    this.triggerShake(5);

    // Transition boss music to match phase
    getBossMusicManager().transitionToPhase(newPhase);

    if (newPhase === 2) {
      this.callbacks.onNotification(NOTIFICATIONS.BOSS_PHASE_2, 2000);
      this.callbacks.onCommsMessage(COMMS_BOSS_PHASE_2);
    } else if (newPhase === 3) {
      this.callbacks.onNotification(NOTIFICATIONS.BOSS_PHASE_3, 2000);
      this.callbacks.onCommsMessage(COMMS_BOSS_PHASE_3);
    }
  }

  private queenAttack(): void {
    if (!this.queen) return;

    const phaseMultiplier = getPhaseMultiplier(this.queen.phase);
    const attacks = getAvailableAttacks(this.queen.phase);
    const attackType = attacks[Math.floor(Math.random() * attacks.length)];

    const playerPos = this.camera.position;
    const queenPos = this.queen.mesh.position;
    const dist = Vector3.Distance(playerPos, queenPos);

    switch (attackType) {
      case 'acid_spit':
        this.queenAcidSpit();
        this.queen.attackCooldown = 3000 * phaseMultiplier;
        break;

      case 'claw_swipe':
        if (dist < 8) {
          this.queenClawSwipe();
          this.queen.attackCooldown = 2500 * phaseMultiplier;
        } else {
          this.queenAcidSpit();
          this.queen.attackCooldown = 3000 * phaseMultiplier;
        }
        break;

      case 'tail_slam':
        if (dist < 10) {
          this.queenTailSlam();
          this.queen.attackCooldown = 4000 * phaseMultiplier;
        } else {
          this.queenAcidSpit();
          this.queen.attackCooldown = 3000 * phaseMultiplier;
        }
        break;

      case 'ground_pound':
        this.queenGroundPound();
        this.queen.attackCooldown = 5000 * phaseMultiplier;
        break;
    }
  }

  private queenAcidSpit(): void {
    this.callbacks.onNotification(NOTIFICATIONS.ACID_INCOMING, 1000);

    const playerPos = this.camera.position.clone();
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
      const dist = Vector3.Distance(this.camera.position, playerPos);
      if (dist < 3) {
        this.damagePlayer(20, 'Acid Spit');
      }
    }, 800);
  }

  private queenClawSwipe(): void {
    this.callbacks.onNotification(NOTIFICATIONS.CLAW_ATTACK, 800);
    this.triggerShake(2);

    if (this.queen) {
      animateClawSwipe(this.queen);
    }

    const dist = Vector3.Distance(this.camera.position, this.queen!.mesh.position);
    if (dist < 6) {
      this.damagePlayer(35, 'Claw Swipe');
    }
  }

  private queenTailSlam(): void {
    this.callbacks.onNotification(NOTIFICATIONS.TAIL_SLAM, 1000);

    setTimeout(() => {
      this.triggerShake(4);
      const dist = Vector3.Distance(this.camera.position, this.queen!.mesh.position);
      if (dist < 8) {
        this.damagePlayer(40, 'Tail Slam');
      }
    }, 500);
  }

  private queenGroundPound(): void {
    this.callbacks.onNotification(NOTIFICATIONS.GROUND_POUND, 1500);

    setTimeout(() => {
      this.triggerShake(6);
      this.damagePlayer(25, 'Ground Pound');
    }, 1000);
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
    this.queen.screaming = true;
    this.queenDefeated = true;

    getAchievementManager().onQueenDefeated();

    // Play victory stinger - dramatic musical resolution
    getBossMusicManager().playVictoryStinger();

    this.callbacks.onNotification(NOTIFICATIONS.BOSS_DEFEATED, 3000);
    this.triggerShake(8);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS_BOSS_DEATH);
    }, 2000);

    setTimeout(() => {
      this.callbacks.onNotification(NOTIFICATIONS.ESCAPE, 3000);

      if (this.queenDoorMesh) {
        this.queenDoorMesh.isVisible = false;
      }

      this.phase = 'escape_trigger';
      this.escapeTimer = 0;

      setTimeout(() => {
        this.completeLevel();
      }, 5000);
    }, 5000);
  }

  // ============================================================================
  // PLAYER
  // ============================================================================

  private damagePlayer(amount: number, source: string): void {
    const now = performance.now();
    if (now - this.lastDamageTime < DAMAGE_INVINCIBILITY_MS) return;

    this.playerHealth -= amount;
    this.lastDamageTime = now;

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

    if (playerZ > 150 && playerY < -140) {
      if (this.currentZone !== 'queen_chamber') {
        this.currentZone = 'queen_chamber';
        if (this.phase === 'exploration') {
          this.startBossFight();
        }
      }
    } else if (playerZ > 100 && playerY < -90) {
      this.currentZone = 'lower';
      this.depth = 100 + (playerZ - 100) * 0.5;
    } else if (playerZ > 50 && playerY < -45) {
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

    this.scanCooldown = WEAK_POINT_COOLDOWN;
    this.callbacks.onNotification(NOTIFICATIONS.SCANNING, 1500);

    setTimeout(() => {
      if (this.queen && this.queen.weakPointMesh) {
        this.queen.weakPointVisible = true;
        this.queen.isVulnerable = true;
        this.queen.weakPointTimer = WEAK_POINT_DURATION;
        this.queen.weakPointMesh.isVisible = true;
        this.callbacks.onNotification(NOTIFICATIONS.WEAK_POINT_REVEALED, 2000);
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
    this.phaseTimer += deltaTime;

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
        // Check weak point
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
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Stop boss music if playing
    getBossMusicManager().stop(0.5);

    // Dispose environment
    this.environmentBuilder?.dispose();

    // Dispose hazards
    this.hazardBuilder?.dispose();

    // Dispose enemies
    disposeEnemies(this.enemies);
    this.enemies = [];

    // Dispose queen
    if (this.queen) {
      disposeQueen(this.queen);
    }

    // Dispose arena
    this.queenArena?.dispose();
    this.queenDoorMesh?.dispose();

    // Dispose damage feedback system
    damageFeedback.dispose();
  }
}
