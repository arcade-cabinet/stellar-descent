/**
 * FinalEscapeLevel - Warthog Run Style Vehicle Finale (Chapter 10)
 *
 * The hive detonation has been triggered. The planet is crumbling.
 * The player drives a vehicle to the extraction shuttle at the launch pad.
 *
 * FOUR SECTIONS (GLB-asset-based linear escape route):
 *
 * Section A: COLLAPSING TUNNELS (z: 0 to -500)
 *   - Station beams, modular walls collapsing
 *   - Metal fences as barriers to dodge
 *   - Ladder pieces as debris
 *   - Collapse wall chasing from behind
 *
 * Section B: SURFACE RUN (z: -500 to -1500)
 *   - Crashed spaceships (Bob, Pancake, Spitfire, Zenith) as wreckage obstacles
 *   - Station external (station05b) as giant collapsing station
 *   - Detail arrows as directional markers
 *   - Marcus runs alongside in his mech
 *
 * Section C: LAVA CANYON (z: -1500 to -2500)
 *   - Metal fences as collapsing bridges
 *   - Teleporter models as alien tech
 *   - Modular laser/statue as destroyed equipment
 *   - Intensifying lava and destruction
 *
 * Section D: LAUNCH PAD (z: -2500 to -3000)
 *   - Final platform with escape shuttle
 *   - Detail_basic models as landing markers
 *   - Dramatic cinematic: shuttle launch
 *   - Leads to credits
 *
 * TIMER: 4 minutes (240 seconds) to reach the shuttle
 * FAILURE: Timer expires = dramatic explosion game over
 * VICTORY: Shuttle launches, cutscene of planet destruction from orbit
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import '@babylonjs/core/Animations/animatable';

import { getAchievementManager } from '../../achievements';
import {
  type CinematicCallbacks,
  CinematicSystem,
  createFinalEscapeIntroCinematic,
} from '../../cinematics';
import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { getLogger } from '../../core/Logger';
import { createVehicleDestructionEffect } from '../../vehicles/VehicleUtils';

const log = getLogger('FinalEscapeLevel');

import { particleManager } from '../../effects/ParticleManager';
import { ALIEN_SPECIES, createAlienMesh } from '../../entities/aliens';
import { levelActionParams } from '../../input/InputBridge';
import { saveSystem } from '../../persistence/SaveSystem';
import { registerDynamicActions, unregisterDynamicActions } from '../../stores/useKeybindingsStore';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { firstPersonWeapons } from '../../weapons/FirstPersonWeapons';
import { GyroscopeManager, type VehicleYokeInput } from '../../weapons/VehicleYoke';
import { SurfaceLevel } from '../SurfaceLevel';
import { buildFloraFromPlacements, getFinalEscapeFlora } from '../shared/AlienFloraBuilder';
import {
  buildCollectibles,
  type CollectibleSystemResult,
  getFinalEscapeCollectibles,
} from '../shared/CollectiblePlacer';
import { createDynamicTerrain, ROCK_TERRAIN } from '../shared/SurfaceTerrainFactory';
import type { LevelConfig, LevelId } from '../types';
import { CollapsingTerrain } from './CollapsingTerrain';
import {
  buildEscapeRouteEnvironment,
  ESCAPE_SECTIONS,
  type EscapeRouteResult,
} from './EscapeRouteEnvironment';
import { EscapeTimer, type TimerUrgency } from './EscapeTimer';

// ============================================================================
// TYPES
// ============================================================================

type EscapeSection =
  | 'hive_exit'
  | 'surface_run'
  | 'canyon_sprint'
  | 'launch_pad'
  | 'victory'
  | 'game_over';

interface StragglerEnemy {
  mesh: TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  velocity: Vector3;
  species: string;
  isActive: boolean;
}

interface DebrisChunk {
  mesh: TransformNode;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
}

// Section boundary Z positions (player starts at Z=0 and moves in -Z direction)
// These match ESCAPE_SECTIONS from EscapeRouteEnvironment.ts
const SECTION_BOUNDARIES = {
  hiveExitEnd: ESCAPE_SECTIONS.tunnelEnd, // -500
  surfaceRunEnd: ESCAPE_SECTIONS.surfaceEnd, // -1500
  canyonSprintEnd: ESCAPE_SECTIONS.canyonEnd, // -2500
  launchPad: ESCAPE_SECTIONS.shuttleZ, // -2900
} as const;

// GLB paths for vehicle and mech - use available assets
// Vehicle: Challenger spaceship (shuttle-like, fits escape theme)
// Mech: Fallback to Phantom dropship scaled down as armored walker
const VEHICLE_GLB_PATH = '/assets/models/spaceships/Challenger.glb';
const MARCUS_MECH_GLB_PATH = '/assets/models/vehicles/marcus_mech.glb';

// GLB paths for tunnel debris (falling chunks in Section A)
const TUNNEL_DEBRIS_GLB_PATHS = [
  '/assets/models/props/debris/brick_mx_1.glb',
  '/assets/models/props/debris/brick_mx_2.glb',
  '/assets/models/props/debris/brick_mx_3.glb',
  '/assets/models/props/debris/brick_mx_4.glb',
  '/assets/models/props/debris/debris_bricks_mx_1.glb',
  '/assets/models/props/debris/debris_bricks_mx_2.glb',
] as const;

const VEHICLE_SPEED = 30; // Base vehicle speed (m/s)
const VEHICLE_BOOST_MULTIPLIER = 1.5;
const VEHICLE_TURN_SPEED = 3.0;
const VEHICLE_HEIGHT = 2.5; // Camera height in vehicle
const BOOST_COOLDOWN = 3.0; // Cooldown between boosts in seconds
const BOOST_DURATION = 2.0; // How long boost lasts

// ============================================================================
// FINAL ESCAPE LEVEL
// ============================================================================

export class FinalEscapeLevel extends SurfaceLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Section state
  private section: EscapeSection = 'hive_exit';
  private sectionTime = 0;

  // Timer system
  private escapeTimer: EscapeTimer;

  // Collapsing terrain system (surface and canyon sections)
  private collapsingTerrain: CollapsingTerrain | null = null;

  // Vehicle state
  private vehicleSpeed = 0;
  private vehicleSteering = 0;
  private isBoosting = false;
  private boostCooldownTimer = 0; // Track cooldown
  private boostRemainingTimer = 0; // Track active boost duration
  private vehicleNode: TransformNode | null = null;
  private vehicleMesh: Mesh | null = null;
  private vehicleHeadlights: PointLight[] = [];
  private vehicleExhaustLight: PointLight | null = null;

  // GLB-based escape route environment
  private escapeRouteEnv: EscapeRouteResult | null = null;

  // Collapse wall (procedural, chases player through tunnel section)
  private tunnelCollapseWall: Mesh | null = null;
  private tunnelCollapseZ = 10; // Z position of the collapse wall

  // Tunnel debris (GLB-based falling chunks during Section A)
  private tunnelDebris: DebrisChunk[] = [];
  private tunnelDebrisTimer = 0;
  private tunnelDebrisCounter = 0;

  // Marcus mech companion
  private marcusMech: TransformNode | null = null;
  private marcusMechLight: PointLight | null = null;
  private marcusTargetOffset = new Vector3(15, 0, -5);
  private marcusCommsPlayed: Set<string> = new Set();

  // Launch pad / shuttle (references into escapeRouteEnv)
  private launchPad: Mesh | null = null;
  private shuttle: TransformNode | null = null;
  private shuttleEngines: PointLight[] = [];
  private shuttleLight: PointLight | null = null;
  private shuttleBeacon: Mesh | null = null;
  private shuttleBeaconMaterial: StandardMaterial | null = null;

  // Enemy stragglers
  private stragglers: StragglerEnemy[] = [];
  private readonly maxStragglers = 8;
  private stragglerSpawnTimer = 0;

  // Player state
  private playerHealth = 100;

  // Visual effects state
  private screenShakeAccumulator = 0;
  private skyColorShift = 0;
  private environmentalShakeIntensity = 0;

  // Action button callback reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Cinematic state
  private cinematicSystem: CinematicSystem | null = null;
  private cinematicActive = false;
  private cinematicTimer = 0;

  // Comms queue for staggered radio messages
  private commsQueue: Array<{
    delay: number;
    sender: string;
    callsign: string;
    portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
    text: string;
  }> = [];
  // Note: commsTimer was tracked but unused - queue uses per-message delay instead

  // Timeouts to clean up on dispose
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Gyroscope manager for mobile controls
  private gyroscopeManager: GyroscopeManager | null = null;

  // Flag for vehicle yoke mode
  private vehicleYokeActive = false;

  constructor(engine: Engine, canvas: HTMLCanvasElement, config: LevelConfig) {
    super(engine, canvas, config, {
      terrainSize: 3000,
      heightScale: 20,
      timeOfDay: 0.35, // Dawn - dramatic orange sky
      fogDensity: 0.003,
      dustIntensity: 0.5,
      enemyDensity: 0.2,
      maxEnemies: 8,
    });

    // Initialize escape timer
    this.escapeTimer = new EscapeTimer(this.scene, {
      totalTime: 240,
      checkpointBonus: 15,
      deathPenalty: 10,
      warningThreshold: 120,
      criticalThreshold: 60,
      finalThreshold: 20,
    });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  protected getBackgroundColor(): Color4 {
    // Sky color shifts from dusty dawn to apocalyptic red as destruction progresses
    const shift = this.skyColorShift;
    return new Color4(
      0.5 + shift * 0.4, // R: increases
      0.3 - shift * 0.15, // G: decreases
      0.2 - shift * 0.1, // B: decreases
      1
    );
  }

  protected async createEnvironment(): Promise<void> {
    // Set camera to vehicle height at start
    this.camera.position.set(0, VEHICLE_HEIGHT, 0);
    this.camera.rotation.set(0, Math.PI, 0); // Face forward (-Z direction)
    this.rotationX = 0;
    this.rotationY = Math.PI;
    this.targetRotationX = 0;
    this.targetRotationY = Math.PI;

    // Initialize particle manager
    particleManager.init(this.scene);

    // Override lighting for apocalyptic atmosphere
    this.setupApocalypticLighting();

    // Preload vehicle, mech, and debris GLBs
    await Promise.all([
      AssetManager.loadAssetByPath(VEHICLE_GLB_PATH, this.scene),
      AssetManager.loadAssetByPath(MARCUS_MECH_GLB_PATH, this.scene),
      ...TUNNEL_DEBRIS_GLB_PATHS.map((path) =>
        AssetManager.loadAssetByPath(path, this.scene).catch((err) => {
          log.warn(`Failed to preload debris GLB ${path}:`, err);
          return null;
        })
      ),
    ]);

    // Build the GLB-based escape route environment (all 4 sections)
    this.escapeRouteEnv = await buildEscapeRouteEnvironment(this.scene);

    // Wire shuttle / launch pad references from the environment builder
    this.shuttle = this.escapeRouteEnv.shuttle;
    this.launchPad = this.escapeRouteEnv.launchPad;
    this.shuttleBeacon = this.escapeRouteEnv.shuttleBeacon;
    this.shuttleEngines = this.escapeRouteEnv.shuttleEngines;
    this.shuttleLight = this.escapeRouteEnv.shuttleLight;

    // Cache beacon material for safe pulsing
    if (this.shuttleBeacon?.material) {
      this.shuttleBeaconMaterial = this.shuttleBeacon.material as StandardMaterial;
    }

    // Create collapse wall for tunnel section (procedural, chases player)
    this.createCollapseWall();

    // Create vehicle and Marcus mech (procedural helpers)
    this.createVehicle();
    this.createMarcusMech();

    // Create collapsing terrain system (dynamic chasms, falling rocks, lava)
    // Covers sections B-D (Z: -500 to -3000 = 2500m)
    // Surface run + canyon + launch pad approach
    this.collapsingTerrain = new CollapsingTerrain(this.scene, {
      terrainLength: 2500, // Match actual outdoor sections
      terrainWidth: 60, // Wide enough for vehicle maneuvering
      segmentCount: 100, // More segments for smoother collapse
      maxChasms: 15, // More chasms for dramatic effect
      maxFallingRocks: 25, // More falling rocks
      maxLavaPools: 18, // More lava pools
      destructionRate: 1.2, // Slightly faster destruction for urgency
    });
    this.collapsingTerrain.initialize();

    // Create procedural rock terrain as the ground surface for the chase sequence.
    // Uses SurfaceTerrainFactory with a large size for the vehicle escape and a
    // dramatic heightScale. Seed 99999 keeps generation deterministic.
    const terrainResult = createDynamicTerrain(this.scene, {
      ...ROCK_TERRAIN,
      size: 800,
      heightScale: 20,
      seed: 99999,
      materialName: 'finalEscapeRockTerrain',
    });
    this.terrain = terrainResult.mesh;
    this.terrainMaterial = terrainResult.material;

    // Initially hide outdoor elements (shown when leaving tunnel)
    this.setOutdoorVisible(false);

    // Set up timer callbacks
    this.escapeTimer.setOnExpired(() => this.handleTimerExpired());
    this.escapeTimer.setOnUrgencyChange((urgency) => this.handleUrgencyChange(urgency));
    this.escapeTimer.setOnCheckpoint((bonus, _total) => {
      // Visual checkpoint feedback
      this.emitNotification(`>>> CHECKPOINT REACHED <<< +${bonus}s`, 3000);

      // Brief green flash for positive feedback
      this.triggerCheckpointFlash();

      // Play checkpoint sound
      getAudioManager().play('notification');
    });

    // Set up action buttons for vehicle controls
    this.setupActionButtons();

    // Build alien flora
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getFinalEscapeFlora(), floraRoot);

    // Build collectibles
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(
      this.scene,
      getFinalEscapeCollectibles(),
      collectibleRoot
    );

    // Register vehicle-specific dynamic keybindings
    registerDynamicActions(
      'final_escape',
      ['vehicleBoost', 'vehicleBrake', 'vehicleEject'],
      'vehicle'
    );

    // Initialize gyroscope manager for mobile
    this.gyroscopeManager = GyroscopeManager.getInstance();

    // Start the escape sequence
    this.startEscapeSequence();
  }

  protected updateLevel(deltaTime: number): void {
    // Update cinematic system if active
    if (this.cinematicSystem) {
      this.cinematicSystem.update(deltaTime);

      // Skip gameplay updates during cinematic
      if (this.cinematicSystem.isPlaying()) {
        return;
      }
    }

    this.sectionTime += deltaTime;

    // Update collectibles
    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) {
        this.collectibleSystem.collect(nearby.id);
      }
    }

    // Update escape timer
    if (!this.cinematicActive) {
      this.escapeTimer.update(deltaTime);
    }

    // Update comms queue
    this.updateCommsQueue(deltaTime);

    // Section-specific updates
    switch (this.section) {
      case 'hive_exit':
        this.updateHiveExit(deltaTime);
        break;
      case 'surface_run':
        this.updateSurfaceRun(deltaTime);
        break;
      case 'canyon_sprint':
        this.updateCanyonSprint(deltaTime);
        break;
      case 'launch_pad':
        this.updateLaunchPad(deltaTime);
        break;
      case 'victory':
        this.updateVictory(deltaTime);
        break;
      case 'game_over':
        // No updates during game over
        break;
    }

    // Global updates (always running)
    this.updateBoostState(deltaTime);
    this.updateVehiclePhysics(deltaTime);
    this.updateMarcusMech(deltaTime);
    // Note: Straggler spawning is called within section updates, not here
    this.updateEnvironmentalEffects(deltaTime);
    this.updateHUD();

    // Update vehicle yoke visual feedback
    if (this.vehicleYokeActive && !this.cinematicActive) {
      const yokeInput: VehicleYokeInput = {
        steerInput: this.vehicleSteering,
        throttleInput: this.vehicleSpeed / (VEHICLE_SPEED * VEHICLE_BOOST_MULTIPLIER),
        brakeInput: 0,
        healthNormalized: Math.max(0, this.playerHealth / 100),
        boostNormalized: this.isBoosting ? 0.5 : 1 - this.boostCooldownTimer / BOOST_COOLDOWN,
        isBoosting: this.isBoosting,
        speedNormalized: this.vehicleSpeed / (VEHICLE_SPEED * VEHICLE_BOOST_MULTIPLIER),
        deltaTime,
      };
      firstPersonWeapons.updateVehicleYoke(yokeInput);
    }
  }

  protected override disposeLevel(): void {
    // Exit vehicle mode before cleanup
    if (this.vehicleYokeActive) {
      this.vehicleYokeActive = false;
      firstPersonWeapons.exitVehicleMode();
    }

    // Disable gyroscope
    this.gyroscopeManager?.disable();
    this.gyroscopeManager = null;

    // Dispose cinematic system
    this.cinematicSystem?.dispose();
    this.cinematicSystem = null;

    // Dispose flora
    for (const node of this.floraNodes) {
      node.dispose(false, true);
    }
    this.floraNodes = [];
    // Dispose collectibles
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;

    // Unregister action handler
    this.emitActionHandlerRegistered(null);
    this.emitActionGroupsChanged([]);

    // Unregister vehicle-specific dynamic keybindings
    unregisterDynamicActions('final_escape');

    // Clear pending timeouts
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts = [];

    // Dispose timer
    this.escapeTimer.dispose();

    // Dispose collapsing terrain
    this.collapsingTerrain?.dispose();
    this.collapsingTerrain = null;

    // Dispose GLB-based escape route environment (includes shuttle, launch pad, etc.)
    this.escapeRouteEnv?.dispose();
    this.escapeRouteEnv = null;
    // Clear references (owned by escapeRouteEnv)
    this.shuttle = null;
    this.launchPad = null;
    this.shuttleBeacon = null;
    this.shuttleEngines = [];
    this.shuttleLight = null;

    // Dispose collapse wall
    this.tunnelCollapseWall?.dispose();
    for (const debris of this.tunnelDebris) {
      debris.mesh.dispose();
    }
    this.tunnelDebris = [];

    // Dispose vehicle
    this.vehicleNode?.dispose();
    this.vehicleMesh?.dispose();
    for (const light of this.vehicleHeadlights) {
      light.dispose();
    }
    this.vehicleHeadlights = [];
    this.vehicleExhaustLight?.dispose();
    this.vehicleExhaustLight = null;

    // Dispose Marcus mech
    this.marcusMech?.dispose();
    this.marcusMechLight?.dispose();

    // Dispose stragglers
    for (const s of this.stragglers) {
      s.mesh.dispose();
    }
    this.stragglers = [];

    // Call parent disposeLevel
    super.disposeLevel();
  }

  // ============================================================================
  // ENVIRONMENT CREATION
  // ============================================================================

  /**
   * Override lighting for apocalyptic orange/red atmosphere.
   */
  private setupApocalypticLighting(): void {
    if (this.sunLight) {
      this.sunLight.intensity = 2.5;
      this.sunLight.diffuse = new Color3(1.0, 0.6, 0.3);
      this.sunLight.direction = new Vector3(0.3, -0.5, -0.4).normalize();
    }
    if (this.skyLight) {
      this.skyLight.intensity = 0.5;
      this.skyLight.diffuse = new Color3(0.7, 0.4, 0.3);
      this.skyLight.groundColor = new Color3(0.4, 0.15, 0.05);
    }

    // Set up apocalyptic fog - thick smoke/ash
    this.scene.fogMode = 3; // Exponential fog
    this.scene.fogDensity = 0.004;
    this.scene.fogColor = new Color3(0.5, 0.3, 0.2);

    // Create sky dome with apocalyptic colors
    this.createSkyDome();
    if (this.skyDome) {
      const skyMat = this.skyDome.material as StandardMaterial;
      skyMat.emissiveColor = new Color3(0.6, 0.3, 0.15);
    }
  }

  /**
   * Create the collapse wall that chases the player through Section A.
   * The tunnel geometry itself is built by EscapeRouteEnvironment.
   */
  private createCollapseWall(): void {
    const tunnelHalfWidth = 8;
    this.tunnelCollapseWall = MeshBuilder.CreateBox(
      'collapse_wall',
      { width: tunnelHalfWidth * 2.5, height: 12, depth: 15 },
      this.scene
    );
    const collapseMat = new StandardMaterial('collapse_mat', this.scene);
    collapseMat.diffuseColor = new Color3(0.3, 0.15, 0.1);
    collapseMat.emissiveColor = new Color3(0.6, 0.2, 0.05);
    this.tunnelCollapseWall.material = collapseMat;
    this.tunnelCollapseWall.position.set(0, 3, 10);
  }

  /**
   * Create the player vehicle (armored ground transport) from a GLB model.
   */
  private createVehicle(): void {
    this.vehicleNode = new TransformNode('vehicle', this.scene);

    // Vehicle body from GLB (replaces procedural box)
    const vehicleModel = AssetManager.createInstanceByPath(
      VEHICLE_GLB_PATH,
      'vehicle_body_glb',
      this.scene,
      true,
      'vehicle'
    );
    if (vehicleModel) {
      vehicleModel.parent = this.vehicleNode;
      vehicleModel.position.set(0, 0.75, 0);
      vehicleModel.rotation.set(0, Math.PI, 0);
      vehicleModel.scaling.set(1.5, 1.5, 1.5);
    }

    // Headlights
    for (let side = -1; side <= 1; side += 2) {
      const headlight = new PointLight(
        `headlight_${side}`,
        new Vector3(side * 1, 1.2, -2.5),
        this.scene
      );
      headlight.parent = this.vehicleNode;
      headlight.diffuse = new Color3(1, 0.95, 0.8);
      headlight.intensity = 5;
      headlight.range = 40;
      this.vehicleHeadlights.push(headlight);
    }

    // Exhaust/boost light at rear
    this.vehicleExhaustLight = new PointLight(
      'vehicle_exhaust',
      new Vector3(0, 0.5, 2),
      this.scene
    );
    this.vehicleExhaustLight.parent = this.vehicleNode;
    this.vehicleExhaustLight.diffuse = new Color3(1, 0.5, 0.2);
    this.vehicleExhaustLight.intensity = 3;
    this.vehicleExhaustLight.range = 15;

    // Position vehicle at player start
    this.vehicleNode.position.set(0, 0, 0);
  }

  /**
   * Create Marcus's mech companion from a GLB model.
   */
  private createMarcusMech(): void {
    this.marcusMech = new TransformNode('marcus_mech', this.scene);

    // Mech body from GLB (replaces procedural boxes for body and legs)
    const mechModel = AssetManager.createInstanceByPath(
      MARCUS_MECH_GLB_PATH,
      'mech_body_glb',
      this.scene,
      true,
      'vehicle'
    );
    if (mechModel) {
      mechModel.parent = this.marcusMech;
      mechModel.position.set(0, 0, 0);
      mechModel.scaling.set(3, 3, 3);
    }

    // Mech spotlight
    this.marcusMechLight = new PointLight('mech_light', new Vector3(0, 7, -2), this.scene);
    this.marcusMechLight.parent = this.marcusMech;
    this.marcusMechLight.diffuse = new Color3(0.8, 0.9, 1.0);
    this.marcusMechLight.intensity = 4;
    this.marcusMechLight.range = 30;

    // Start Marcus offset to the side
    this.marcusMech.position.set(15, 0, -5);
  }

  /**
   * Toggle visibility of outdoor elements (hidden during tunnel section).
   * Also manages tunnel visibility inversely.
   */
  private setOutdoorVisible(visible: boolean): void {
    // Outdoor elements: visible when outside tunnel
    if (this.skyDome) this.skyDome.isVisible = visible;
    if (this.launchPad) this.launchPad.isVisible = visible;
    if (this.shuttle) this.shuttle.setEnabled(visible);
    if (this.shuttleBeacon) this.shuttleBeacon.isVisible = visible;
    if (this.shuttleLight) this.shuttleLight.intensity = visible ? 5 : 0;
    if (this.marcusMech) this.marcusMech.setEnabled(visible);
    if (this.terrain) this.terrain.isVisible = visible;

    // Tunnel elements: visible when inside tunnel (inverse of outdoor)
    if (this.tunnelCollapseWall) this.tunnelCollapseWall.isVisible = !visible;

    // Update fog density based on location
    if (visible) {
      // Outdoor: lighter fog for visibility
      this.scene.fogDensity = 0.003;
      this.scene.fogColor = new Color3(0.5, 0.3, 0.2);
    } else {
      // Tunnel: thicker fog for atmosphere
      this.scene.fogDensity = 0.008;
      this.scene.fogColor = new Color3(0.3, 0.15, 0.1);
    }
  }

  // ============================================================================
  // ESCAPE SEQUENCE START
  // ============================================================================

  /**
   * Initialize the escape sequence with opening comms and objectives.
   */
  private startEscapeSequence(): void {
    this.section = 'hive_exit';
    this.sectionTime = 0;
    this.escapeTimer.pause(); // Pause during intro

    // Initialize the cinematic system
    this.initializeCinematicSystem();

    // Enter vehicle mode - show yoke instead of weapon
    if (!this.vehicleYokeActive) {
      this.vehicleYokeActive = true;
      firstPersonWeapons.enterVehicleMode();

      // Try to enable gyroscope on mobile
      if (this.gyroscopeManager?.isAvailable()) {
        this.gyroscopeManager.enable().catch(() => {
          log.info('Gyroscope not available, using touch fallback');
        });
      }
    }

    // Opening comms
    this.emitObjectiveUpdate('FINAL ESCAPE', 'DRIVE TO THE SHUTTLE - THE PLANET IS BREAKING APART');

    // Check if we should play the full intro cinematic (only on first playthrough)
    const currentSave = saveSystem.getCurrentSave();
    const hasSeenIntro = currentSave?.objectives.final_escape_intro_seen ?? false;

    if (!hasSeenIntro) {
      // Play the full intro cinematic
      saveSystem.setObjective('final_escape_intro_seen', true);
      this.playIntroCinematic();
    } else {
      // Skip cinematic, just play the quick opening comms
      this.playQuickOpening();
    }
  }

  /**
   * Play a quick opening sequence without the full cinematic (for replays).
   */
  private playQuickOpening(): void {
    // Stagger opening comms
    this.queueComms(0, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'WARNING: Hive detonation in progress. Seismic cascade detected. Total planetary collapse in 4 minutes.',
    });

    this.queueComms(4, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "I'm clearing a path ahead! Follow the tunnel to the surface - the shuttle is waiting at the launch pad! MOVE!",
    });

    this.queueComms(7, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Vehicle systems online. Headlights engaged. Timer initiated.',
    });

    // Start timer after intro
    const startTimeout = setTimeout(() => {
      this.escapeTimer.resume();
      this.emitNotification('4:00 - ESCAPE TIMER STARTED', 3000);

      // Set base camera shake for the entire level (rumbling planet)
      this.setBaseShake(0.5);
    }, 8000);
    this.pendingTimeouts.push(startTimeout);
  }

  // ============================================================================
  // CINEMATIC SYSTEM
  // ============================================================================

  /**
   * Initialize the cinematic system with proper callbacks.
   */
  private initializeCinematicSystem(): void {
    const cinematicCallbacks: CinematicCallbacks = {
      onCommsMessage: (message) => {
        // Convert CinematicCallbacks message to LevelCallbacks CommsMessage format
        this.emitCommsMessage({
          sender: message.sender,
          callsign: message.callsign ?? 'ATHENA',
          portrait:
            (message.portrait as 'commander' | 'ai' | 'marcus' | 'armory' | 'player') ?? 'ai',
          text: message.text,
        });
      },
      onNotification: (text, duration) => {
        this.emitNotification(text, duration ?? 3000);
      },
      onObjectiveUpdate: (title, instructions) => {
        this.emitObjectiveUpdate(title, instructions);
      },
      onShakeCamera: (intensity) => {
        this.triggerShake(intensity);
      },
      onCinematicStart: () => {
        this.cinematicActive = true;
        this.escapeTimer.pause();
        this.emitCinematicStart();
      },
      onCinematicEnd: () => {
        this.cinematicActive = false;
        this.emitCinematicEnd();
      },
    };

    this.cinematicSystem = new CinematicSystem(this.scene, this.camera, cinematicCallbacks);
  }

  /**
   * Play the intro cinematic for the Final Escape level.
   * Camera swoops over the collapsing tunnel entrance, then pulls back to the vehicle.
   */
  private playIntroCinematic(): void {
    if (!this.cinematicSystem) {
      this.initializeCinematicSystem();
    }

    // Create the intro cinematic sequence
    const playerStart = this.camera.position.clone();
    const sequence = createFinalEscapeIntroCinematic(() => {
      // Cinematic complete - start the escape
      this.cinematicActive = false;
      this.escapeTimer.resume();
      this.emitNotification('4:00 - ESCAPE TIMER STARTED', 3000);
      this.setBaseShake(0.5);
    }, playerStart);

    this.cinematicSystem!.play(sequence);
  }

  // ============================================================================
  // ACTION BUTTONS
  // ============================================================================

  /**
   * Set up vehicle control action buttons.
   */
  private setupActionButtons(): void {
    const boostParams = levelActionParams('boost');

    const vehicleGroup: ActionButtonGroup = {
      id: 'vehicle',
      label: 'VEHICLE',
      position: 'right',
      buttons: [
        createAction('boost', 'BOOST', boostParams.key, {
          keyDisplay: boostParams.keyDisplay,
          variant: 'primary',
          size: 'large',
        }),
      ],
    };

    this.emitActionGroupsChanged([vehicleGroup]);

    // Register action handler
    this.actionCallback = (actionId: string) => {
      switch (actionId) {
        case 'boost':
          this.activateBoost();
          break;
      }
    };
    this.emitActionHandlerRegistered(this.actionCallback);
  }

  /**
   * Activate vehicle boost with proper cooldown management.
   */
  private activateBoost(): void {
    // Check if boost is on cooldown or already active
    if (this.isBoosting || this.boostCooldownTimer > 0) return;

    this.isBoosting = true;
    this.boostRemainingTimer = BOOST_DURATION;

    // Play boost sound effect - use dropship engine as boost SFX
    getAudioManager().play('dropship_engine');

    // Visual feedback - intensify headlights
    for (const light of this.vehicleHeadlights) {
      light.intensity = 10;
    }
    if (this.vehicleExhaustLight) {
      this.vehicleExhaustLight.intensity = 15;
    }

    // Spawn boost particle effect at vehicle exhaust
    if (this.vehicleNode) {
      particleManager.emit('explosion', this.vehicleNode.position.add(new Vector3(0, 0.5, 2)), {
        scale: 0.3,
      });
    }

    this.emitNotification('BOOST ACTIVE', 1000);
  }

  /**
   * Update boost state and cooldown timers.
   */
  private updateBoostState(deltaTime: number): void {
    // Update active boost
    if (this.isBoosting) {
      this.boostRemainingTimer -= deltaTime;
      if (this.boostRemainingTimer <= 0) {
        this.isBoosting = false;
        this.boostCooldownTimer = BOOST_COOLDOWN;

        // Reset visual feedback
        for (const light of this.vehicleHeadlights) {
          light.intensity = 5;
        }
        if (this.vehicleExhaustLight) {
          this.vehicleExhaustLight.intensity = 3;
        }
      }
    }

    // Update cooldown
    if (this.boostCooldownTimer > 0) {
      this.boostCooldownTimer -= deltaTime;
    }
  }

  // ============================================================================
  // VEHICLE PHYSICS
  // ============================================================================

  /**
   * Update vehicle movement based on player input.
   * The vehicle always moves forward; player controls steering.
   */
  private updateVehiclePhysics(deltaTime: number): void {
    if (this.cinematicActive || this.section === 'victory' || this.section === 'game_over') {
      this.vehicleSpeed = 0;
      return;
    }

    // Always moving forward (in -Z direction)
    const baseSpeed = VEHICLE_SPEED;
    const speedMultiplier = this.isBoosting ? VEHICLE_BOOST_MULTIPLIER : 1.0;
    const targetSpeed = baseSpeed * speedMultiplier;

    // Smooth speed transitions
    const acceleration = this.isBoosting ? 80 : 40;
    if (this.vehicleSpeed < targetSpeed) {
      this.vehicleSpeed = Math.min(targetSpeed, this.vehicleSpeed + acceleration * deltaTime);
    } else if (this.vehicleSpeed > targetSpeed) {
      this.vehicleSpeed = Math.max(targetSpeed, this.vehicleSpeed - acceleration * 0.5 * deltaTime);
    }

    // Steering from player input
    let steerInput = 0;
    if (this.inputTracker.isActionActive('moveLeft') || (this.touchInput?.movement.x ?? 0) < -0.3) {
      steerInput = 1;
    }
    if (this.inputTracker.isActionActive('moveRight') || (this.touchInput?.movement.x ?? 0) > 0.3) {
      steerInput = -1;
    }

    // Smooth steering
    this.vehicleSteering +=
      (steerInput * VEHICLE_TURN_SPEED - this.vehicleSteering) * deltaTime * 5;

    // Apply movement
    const moveZ = -this.vehicleSpeed * deltaTime;
    const moveX = this.vehicleSteering * deltaTime * 15;

    this.camera.position.z += moveZ;
    this.camera.position.x += moveX;
    this.camera.position.y = VEHICLE_HEIGHT;

    // Clamp to terrain bounds with wall collision feedback
    let hitWall = false;
    if (this.section === 'hive_exit') {
      // Tunnel bounds (matches EscapeRouteEnvironment tunnel half-width)
      const tunnelHalfWidth = 7;
      const distFromCenter = Math.abs(this.camera.position.x);
      if (distFromCenter > tunnelHalfWidth) {
        this.camera.position.x = Math.sign(this.camera.position.x) * tunnelHalfWidth;
        hitWall = true;
      }
    } else if (this.collapsingTerrain) {
      // Surface/canyon bounds
      const bounds = this.collapsingTerrain.getTerrainBounds();
      const prevX = this.camera.position.x;
      this.camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.camera.position.x));
      if (prevX !== this.camera.position.x) {
        hitWall = true;
      }
    }

    // Wall collision feedback
    if (hitWall) {
      this.applyDamage(2);
      this.triggerShake(1);
      // Bounce off wall slightly
      this.vehicleSteering *= -0.3;
    }

    // Update vehicle node position to match camera
    if (this.vehicleNode) {
      this.vehicleNode.position.set(this.camera.position.x, 0, this.camera.position.z);
      // Tilt vehicle based on steering and add roll effect when boosting
      const boostRoll = this.isBoosting ? Math.sin(this.sectionTime * 10) * 0.02 : 0;
      this.vehicleNode.rotation.y = Math.PI + this.vehicleSteering * 0.1;
      this.vehicleNode.rotation.z = this.vehicleSteering * 0.05 + boostRoll;
    }

    // Check section transitions
    this.checkSectionTransitions();

    // Check terrain damage
    this.checkTerrainDamage(deltaTime);

    // Check obstacle collisions (GLB-based obstacles are visual only, but we add proximity damage)
    this.checkObstacleCollisions(deltaTime);
  }

  /**
   * Check for collisions with environment obstacles (wreckage, debris).
   * This is a simplified proximity-based check since GLB assets don't have physics.
   */
  private checkObstacleCollisions(_deltaTime: number): void {
    // Only check in outdoor sections where wreckage exists
    if (
      this.section === 'hive_exit' ||
      this.section === 'victory' ||
      this.section === 'game_over'
    ) {
      return;
    }

    // Check proximity to major wreckage positions (from EscapeRouteEnvironment)
    const wreckagePositions = [
      { x: -15, z: -600, radius: 8 }, // Bob wreckage
      { x: 10, z: -780, radius: 10 }, // Pancake wreckage
      { x: -20, z: -1000, radius: 7 }, // Spitfire wreckage
      { x: 5, z: -1200, radius: 12 }, // Zenith wreckage
    ];

    const playerX = this.camera.position.x;
    const playerZ = this.camera.position.z;

    for (const wreck of wreckagePositions) {
      const dx = playerX - wreck.x;
      const dz = playerZ - wreck.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < wreck.radius) {
        // Collision with wreckage - apply damage and push away
        const damage = (wreck.radius - dist) * 3;
        this.applyDamage(damage);
        this.triggerShake(2);

        // Push player away from wreckage center
        const pushDir = dist > 0.1 ? dx / dist : 1;
        this.camera.position.x += pushDir * 2;

        break; // Only one collision per frame
      }
    }
  }

  /**
   * Check if the player has entered a new section.
   */
  private checkSectionTransitions(): void {
    const z = this.camera.position.z;

    if (this.section === 'hive_exit' && z <= SECTION_BOUNDARIES.hiveExitEnd) {
      this.transitionToSection('surface_run');
    } else if (this.section === 'surface_run' && z <= SECTION_BOUNDARIES.surfaceRunEnd) {
      this.transitionToSection('canyon_sprint');
    } else if (this.section === 'canyon_sprint' && z <= SECTION_BOUNDARIES.canyonSprintEnd) {
      this.transitionToSection('launch_pad');
    }
  }

  /**
   * Check for terrain damage at player position.
   */
  private checkTerrainDamage(deltaTime: number): void {
    if (!this.collapsingTerrain || this.section === 'hive_exit') return;

    const damage = this.collapsingTerrain.getDamageAtPosition(this.camera.position);
    if (damage > 0) {
      const actualDamage = damage * deltaTime;
      this.applyDamage(actualDamage);
    }
  }

  // ============================================================================
  // SECTION TRANSITIONS
  // ============================================================================

  /**
   * Transition to a new section with appropriate comms and effects.
   */
  private transitionToSection(newSection: EscapeSection): void {
    const previousSection = this.section;
    this.section = newSection;
    this.sectionTime = 0;

    // Save checkpoint on major section transitions
    if (
      newSection === 'surface_run' ||
      newSection === 'canyon_sprint' ||
      newSection === 'launch_pad'
    ) {
      this.saveCheckpoint(newSection);
    }

    // Debug logging (can be enabled via DevMode)
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { DEBUG_ESCAPE?: boolean }).DEBUG_ESCAPE
    ) {
      log.debug(`Section transition: ${previousSection} -> ${newSection}`);
    }

    switch (newSection) {
      case 'surface_run':
        this.onEnterSurfaceRun();
        break;
      case 'canyon_sprint':
        this.onEnterCanyonSprint();
        break;
      case 'launch_pad':
        this.onEnterLaunchPad();
        break;
      case 'victory':
        this.onEnterVictory();
        break;
      case 'game_over':
        this.onEnterGameOver();
        break;
    }
  }

  /**
   * Enter Surface Run section - open sky, terrain destruction begins.
   */
  private onEnterSurfaceRun(): void {
    this.setOutdoorVisible(true);

    // Disable the collapse wall (tunnel section complete)
    this.tunnelCollapseWall?.setEnabled(false);

    // Checkpoint bonus
    this.escapeTimer.reachCheckpoint('Surface Run');

    this.emitObjectiveUpdate('SURFACE RUN', 'RACE ACROSS THE SURFACE TO THE CANYON');

    this.queueComms(0.5, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Surface! I'm on your six! Watch for chasms - the ground is splitting apart!",
    });

    this.queueComms(3, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Seismic activity increasing. Lava breaches detected along escape route. Maintain vehicle speed.',
    });

    // Increase environmental shake
    this.setBaseShake(1.0);
  }

  /**
   * Enter Canyon Sprint section - narrow canyon, falling rocks.
   */
  private onEnterCanyonSprint(): void {
    // Checkpoint bonus
    this.escapeTimer.reachCheckpoint('Canyon Sprint');

    this.emitObjectiveUpdate('CANYON SPRINT', 'NAVIGATE THE CANYON - WATCH FOR FALLING ROCKS');

    this.queueComms(0.5, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: 'Canyon ahead! Walls are coming down - stay in the center and floor it!',
    });

    this.queueComms(5, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Shuttle beacon detected ahead. Distance: 1000 meters. Structural collapse accelerating.',
    });

    // Intensify environmental effects
    this.setBaseShake(1.5);
    this.environmentalShakeIntensity = 2.0;
  }

  /**
   * Enter Launch Pad section - reach the shuttle.
   */
  private onEnterLaunchPad(): void {
    // Checkpoint bonus
    this.escapeTimer.reachCheckpoint('Launch Pad');

    this.emitObjectiveUpdate('LAUNCH PAD', 'REACH THE SHUTTLE - ALMOST THERE');

    this.queueComms(0.5, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "I see the shuttle! Almost there, brother! DON'T STOP!",
    });

    // Activate shuttle engines
    for (const light of this.shuttleEngines) {
      light.intensity = 8;
    }

    // Maximum environmental intensity
    this.setBaseShake(2.5);
    this.environmentalShakeIntensity = 3.0;
  }

  /**
   * Enter Victory sequence - shuttle launch cinematic.
   */
  private onEnterVictory(): void {
    this.cinematicActive = true;
    this.cinematicTimer = 0;
    this.escapeTimer.pause();

    this.emitCinematicStart();

    this.emitObjectiveUpdate('ESCAPE SUCCESSFUL', 'LAUNCHING TO ORBIT');

    // Comms
    this.queueComms(0, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "We made it! Get on board - I'm right behind you! GO GO GO!",
    });

    this.queueComms(4, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'All personnel aboard. Initiating emergency launch sequence. Brace for acceleration.',
    });

    this.queueComms(8, {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Look... the whole planet. It's over. We actually made it out.",
    });

    // Shuttle launch animation
    const launchTimeout = setTimeout(() => {
      this.animateShuttleLaunch();
    }, 3000);
    this.pendingTimeouts.push(launchTimeout);

    // Track achievements
    getAchievementManager().onGameComplete();

    // Save progress
    saveSystem.completeLevel('final_escape');
    saveSystem.setObjective('campaign_complete', true);

    // Complete level after cinematic - trigger credits screen
    const completeTimeout = setTimeout(() => {
      this.emitCinematicEnd();
      this.state.completed = true;

      // Save campaign completion stats
      const timerState = this.escapeTimer.getState();
      const stats = {
        escapeTime: timerState.elapsed,
        checkpointsReached: timerState.checkpointsReached,
        deaths: timerState.deaths,
        timeRemaining: timerState.remaining,
      };

      // Log completion stats (can be enabled via debug flag)
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { DEBUG_ESCAPE?: boolean }).DEBUG_ESCAPE
      ) {
        log.info('Campaign complete! Stats:', stats);
      }

      // Mark campaign as complete in save system
      saveSystem.setObjective('campaign_complete', true);

      // Trigger level completion with special 'credits' flag
      this.completeLevel();
    }, 15000);
    this.pendingTimeouts.push(completeTimeout);
  }

  /**
   * Enter Game Over - timer expired.
   */
  private onEnterGameOver(): void {
    this.cinematicActive = true;

    this.emitObjectiveUpdate('MISSION FAILED', 'THE PLANET HAS BEEN CONSUMED');

    this.queueComms(0, {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Seismic cascade complete. Total structural failure. No escape possible.',
    });

    // Dramatic explosion effect
    this.triggerShake(10);
    this.setBaseShake(5);

    // Flash white screen
    this.scene.clearColor = new Color4(1, 0.9, 0.7, 1);

    // Fade to black and show game over
    const gameOverTimeout = setTimeout(() => {
      this.scene.clearColor = new Color4(0, 0, 0, 1);
      this.onPlayerDeath();
    }, 3000);
    this.pendingTimeouts.push(gameOverTimeout);
  }

  // ============================================================================
  // SECTION UPDATES
  // ============================================================================

  /**
   * Update Hive Exit section (tunnel escape).
   */
  private updateHiveExit(deltaTime: number): void {
    // Advance collapse wall behind player
    this.tunnelCollapseZ -= VEHICLE_SPEED * 0.8 * deltaTime; // Collapse chases player
    if (this.tunnelCollapseWall) {
      this.tunnelCollapseWall.position.z = this.tunnelCollapseZ;
    }

    // Check if collapse wall caught player
    if (this.tunnelCollapseZ <= this.camera.position.z + 3) {
      this.applyDamage(50 * deltaTime); // Heavy damage if caught
    }

    // Spawn tunnel debris
    this.tunnelDebrisTimer += deltaTime;
    if (this.tunnelDebrisTimer >= 0.5 && this.tunnelDebris.length < 10) {
      this.tunnelDebrisTimer = 0;
      this.spawnTunnelDebris();
    }

    // Update tunnel debris
    this.updateTunnelDebris(deltaTime);

    // Flicker environment lights in the tunnel (lights are owned by EscapeRouteEnvironment)
    // The static GLB-placed lights pulse naturally via the environment builder

    // Marcus comms for tunnel section
    if (this.sectionTime > 5 && !this.marcusCommsPlayed.has('tunnel_halfway')) {
      if (this.camera.position.z < -250) {
        this.marcusCommsPlayed.add('tunnel_halfway');
        this.queueComms(0, {
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: 'Keep going! I can see light ahead - the surface exit is close!',
        });
      }
    }
  }

  /**
   * Update Surface Run section.
   */
  private updateSurfaceRun(deltaTime: number): void {
    // Update collapsing terrain
    const timerState = this.escapeTimer.getState();
    const destructionProgress = 1 - timerState.progress;
    this.collapsingTerrain?.update(deltaTime, destructionProgress * 0.5, this.camera.position);

    // Spawn straggler enemies
    this.updateStragglerSpawning(deltaTime);

    // Marcus running comms
    if (this.sectionTime > 15 && !this.marcusCommsPlayed.has('surface_midway')) {
      this.marcusCommsPlayed.add('surface_midway');
      this.queueComms(0, {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "The ground's splitting open everywhere! Stay on the road - the canyon entrance is ahead!",
      });
    }
  }

  /**
   * Update Canyon Sprint section.
   */
  private updateCanyonSprint(deltaTime: number): void {
    // Update collapsing terrain with higher destruction rate
    const timerState = this.escapeTimer.getState();
    const destructionProgress = 1 - timerState.progress;
    this.collapsingTerrain?.update(deltaTime, destructionProgress * 0.8, this.camera.position);

    // Spawn straggler enemies (fewer in canyon)
    this.updateStragglerSpawning(deltaTime);

    // Urgency comms
    if (timerState.remaining < 60 && !this.marcusCommsPlayed.has('canyon_urgent')) {
      this.marcusCommsPlayed.add('canyon_urgent');
      this.queueComms(0, {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "We're running out of time! PUSH IT! The shuttle won't wait forever!",
      });
    }
  }

  /**
   * Update Launch Pad section.
   */
  private updateLaunchPad(deltaTime: number): void {
    // Maximum destruction
    const _timerState = this.escapeTimer.getState();
    this.collapsingTerrain?.update(deltaTime, 0.9, this.camera.position);

    // Pulse shuttle beacon using cached material reference
    if (this.shuttleBeaconMaterial) {
      const pulse = Math.sin(this.sectionTime * 5) * 0.5 + 0.5;
      this.shuttleBeaconMaterial.emissiveColor = new Color3(pulse * 0.3, pulse * 0.7, 1.0);
    }

    // Pulse shuttle engines
    for (const light of this.shuttleEngines) {
      light.intensity = 8 + Math.sin(this.sectionTime * 8) * 3;
    }

    // Check if player reached the shuttle
    const distToShuttle = Vector3.Distance(
      new Vector3(this.camera.position.x, 0, this.camera.position.z),
      new Vector3(0, 0, SECTION_BOUNDARIES.launchPad)
    );

    if (distToShuttle < 15) {
      this.transitionToSection('victory');
    }
  }

  /**
   * Update Victory cinematic.
   */
  private updateVictory(deltaTime: number): void {
    this.cinematicTimer += deltaTime;

    // Camera slowly looks up (orbit view)
    if (this.cinematicTimer > 5) {
      this.camera.rotation.x -= deltaTime * 0.1;
      this.camera.rotation.x = Math.max(-Math.PI / 3, this.camera.rotation.x);
    }

    // Reduce shake during victory
    this.setBaseShake(Math.max(0, 2.5 - this.cinematicTimer * 0.3));
  }

  // ============================================================================
  // ENVIRONMENTAL EFFECTS
  // ============================================================================

  /**
   * Update environmental visual effects based on timer urgency.
   */
  private updateEnvironmentalEffects(deltaTime: number): void {
    const timerState = this.escapeTimer.getState();

    // Sky color shift increases with destruction
    this.skyColorShift = Math.min(1, (1 - timerState.progress) * 1.2);
    this.scene.clearColor = this.getBackgroundColor();

    // Update sky dome color
    if (this.skyDome) {
      const skyMat = this.skyDome.material as StandardMaterial;
      const shift = this.skyColorShift;
      skyMat.emissiveColor = new Color3(0.6 + shift * 0.3, 0.3 - shift * 0.15, 0.15 - shift * 0.1);
    }

    // Environmental camera shake increases with urgency
    const urgencyShake = timerState.shakeIntensity;
    this.screenShakeAccumulator += deltaTime;
    if (this.screenShakeAccumulator > 0.1) {
      this.screenShakeAccumulator = 0;
      if (urgencyShake > 0.5) {
        this.triggerShake(urgencyShake * 0.3);
      }
    }

    // Update sun color for apocalyptic feel
    if (this.sunLight) {
      const shift = this.skyColorShift;
      this.sunLight.diffuse = new Color3(1.0, 0.6 - shift * 0.3, 0.3 - shift * 0.2);
      this.sunLight.intensity = 2.5 + shift * 2;
    }
  }

  // ============================================================================
  // MARCUS MECH
  // ============================================================================

  /**
   * Update Marcus's mech position and behavior.
   * He runs alongside the player during outdoor sections.
   */
  private updateMarcusMech(deltaTime: number): void {
    if (!this.marcusMech) return;

    // Marcus only visible during outdoor sections
    if (
      this.section === 'hive_exit' ||
      this.section === 'victory' ||
      this.section === 'game_over'
    ) {
      return;
    }

    // Target position: offset from player
    const targetPos = new Vector3(
      this.camera.position.x + this.marcusTargetOffset.x,
      0,
      this.camera.position.z + this.marcusTargetOffset.z
    );

    // Smooth follow
    const mechPos = this.marcusMech.position;
    mechPos.x += (targetPos.x - mechPos.x) * deltaTime * 3;
    mechPos.z += (targetPos.z - mechPos.z) * deltaTime * 3;

    // Bobbing animation (mech walking)
    const bob = Math.sin(this.sectionTime * 6) * 0.3;
    this.marcusMech.position.y = bob;
    this.marcusMech.rotation.z = Math.sin(this.sectionTime * 3) * 0.05;

    // Vary Marcus's offset based on terrain
    const lateralShift = Math.sin(this.sectionTime * 0.5) * 5;
    this.marcusTargetOffset.x = 15 + lateralShift;
  }

  // ============================================================================
  // STRAGGLER ENEMIES
  // ============================================================================

  /**
   * Spawn straggler enemies along the escape route.
   * These are not the main threat (the timer is), but add tension.
   */
  private updateStragglerSpawning(deltaTime: number): void {
    this.stragglerSpawnTimer += deltaTime;

    // Spawn rate: one every 3-5 seconds
    const spawnInterval = 3 + Math.random() * 2;

    if (
      this.stragglerSpawnTimer >= spawnInterval &&
      this.stragglers.filter((s) => s.isActive).length < this.maxStragglers
    ) {
      this.stragglerSpawnTimer = 0;
      this.spawnStraggler();
    }

    // Update existing stragglers
    for (const straggler of this.stragglers) {
      if (!straggler.isActive) continue;

      // Move toward player's path
      const toPlayer = this.camera.position.subtract(straggler.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      if (dist > 2) {
        const dir = toPlayer.normalize();
        const speed = 8;
        straggler.velocity = dir.scale(speed);
        straggler.position.addInPlace(straggler.velocity.scale(deltaTime));
        straggler.mesh.position.copyFrom(straggler.position);

        // Face player
        straggler.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // Damage player if close
      if (dist < 4) {
        this.applyDamage(5 * deltaTime);
      }

      // Despawn if too far behind
      if (straggler.position.z > this.camera.position.z + 50) {
        straggler.isActive = false;
        straggler.mesh.isVisible = false;
      }
    }
  }

  /**
   * Spawn a single straggler enemy.
   * Uses fire-and-forget pattern with proper cleanup.
   */
  private spawnStraggler(): void {
    // Spawn to the side of the road, slightly ahead or beside the player
    const side = Math.random() > 0.5 ? 1 : -1;
    const halfWidth = this.collapsingTerrain?.getTerrainWidth()
      ? this.collapsingTerrain.getTerrainWidth() / 2
      : 25;

    const spawnPos = new Vector3(
      side * (halfWidth - 5 + Math.random() * 5),
      0,
      this.camera.position.z - 20 - Math.random() * 30
    );

    // Pick a species (mostly skitterers for speed)
    const speciesKey = Math.random() > 0.7 ? 'lurker' : 'skitterer';
    const species = ALIEN_SPECIES[speciesKey];

    // Fire-and-forget async spawn with error handling
    createAlienMesh(this.scene, species, Math.random() * 10000)
      .then((mesh) => {
        // Check if level is still active (not disposed)
        if (!this.scene || this.scene.isDisposed) {
          mesh.dispose();
          return;
        }

        mesh.position.copyFrom(spawnPos);

        this.stragglers.push({
          mesh,
          health: species.baseHealth * 0.5, // Weakened stragglers
          maxHealth: species.baseHealth * 0.5,
          position: spawnPos.clone(),
          velocity: Vector3.Zero(),
          species: speciesKey,
          isActive: true,
        });
      })
      .catch((err) => {
        log.warn('Failed to spawn straggler:', err);
      });
  }

  // ============================================================================
  // TUNNEL DEBRIS
  // ============================================================================

  /**
   * Spawn falling debris in the hive tunnel using GLB models.
   */
  private spawnTunnelDebris(): void {
    const size = 0.3 + Math.random() * 0.8;

    // Pick a random debris GLB path
    const debrisIndex = Math.floor(Math.random() * TUNNEL_DEBRIS_GLB_PATHS.length);
    const debrisPath = TUNNEL_DEBRIS_GLB_PATHS[debrisIndex];
    const instanceName = `tunnel_debris_${this.tunnelDebrisCounter++}`;

    // Create GLB instance
    const mesh = AssetManager.createInstanceByPath(
      debrisPath,
      instanceName,
      this.scene,
      false, // not animated
      'debris'
    );

    if (!mesh) {
      // Skip if GLB not loaded yet
      log.warn(`Failed to create tunnel debris instance from ${debrisPath}`);
      return;
    }

    // Spawn from ceiling, near player's forward path
    mesh.position.set(
      (Math.random() - 0.5) * 8,
      5 + Math.random() * 2,
      this.camera.position.z - 10 - Math.random() * 20
    );

    // Scale the GLB to desired size
    const scale = size * 0.4;
    mesh.scaling.set(scale, scale, scale);

    this.tunnelDebris.push({
      mesh,
      velocity: new Vector3(
        (Math.random() - 0.5) * 3,
        -8 - Math.random() * 5,
        (Math.random() - 0.5) * 2
      ),
      rotationSpeed: new Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
      ),
      lifetime: 0,
    });
  }

  /**
   * Update tunnel debris physics.
   */
  private updateTunnelDebris(deltaTime: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.tunnelDebris.length; i++) {
      const debris = this.tunnelDebris[i];
      debris.lifetime += deltaTime;

      if (debris.lifetime > 4) {
        toRemove.push(i);
        continue;
      }

      // Gravity
      debris.velocity.y -= 15 * deltaTime;

      // Update position
      debris.mesh.position.addInPlace(debris.velocity.scale(deltaTime));
      debris.mesh.rotation.x += debris.rotationSpeed.x * deltaTime;
      debris.mesh.rotation.y += debris.rotationSpeed.y * deltaTime;
      debris.mesh.rotation.z += debris.rotationSpeed.z * deltaTime;

      // Bounce off floor
      if (debris.mesh.position.y < 0.3) {
        debris.mesh.position.y = 0.3;
        debris.velocity.y = Math.abs(debris.velocity.y) * 0.3;
        debris.velocity.scaleInPlace(0.7);
      }

      // Check player collision (debris hits vehicle)
      const dist = Vector3.Distance(debris.mesh.position, this.camera.position);
      if (dist < 2 && !debris.mesh.metadata?.hit) {
        debris.mesh.metadata = { hit: true };
        this.applyDamage(5);
        this.triggerShake(2);
      }
    }

    // Remove expired debris
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.tunnelDebris[toRemove[i]].mesh.dispose();
      this.tunnelDebris.splice(toRemove[i], 1);
    }
  }

  // ============================================================================
  // VISUAL FEEDBACK
  // ============================================================================

  /**
   * Trigger a brief green flash for checkpoint reached.
   */
  private triggerCheckpointFlash(): void {
    // Store original clear color
    const originalColor = this.scene.clearColor.clone();

    // Flash green briefly
    this.scene.clearColor = new Color4(0.2, 0.8, 0.3, 1);

    const flashTimeout = setTimeout(() => {
      this.scene.clearColor = originalColor;
    }, 150);
    this.pendingTimeouts.push(flashTimeout);
  }

  // ============================================================================
  // DAMAGE / HEALTH
  // ============================================================================

  /**
   * Apply damage to the player.
   */
  private applyDamage(amount: number): void {
    this.playerHealth -= amount;
    this.emitHealthChanged(Math.max(0, Math.round(this.playerHealth)));
    this.updatePlayerHealthVisual(this.playerHealth);

    if (amount >= 3) {
      this.triggerDamageFlash(Math.min(1, amount / 20));
    }

    this.trackPlayerDamage(amount);

    if (this.playerHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  /**
   * Handle player death (respawn with time penalty).
   */
  private handlePlayerDeath(): void {
    this.playerDiedInLevel = true;

    // Create destruction effect at current position
    createVehicleDestructionEffect(this.scene, this.camera.position.clone());

    this.playerHealth = 50; // Respawn with half health
    this.escapeTimer.applyDeathPenalty();

    this.emitHealthChanged(50);
    this.emitNotification('RESPAWNING - TIME PENALTY', 2000);
    this.triggerDamageFlash(1);
    this.triggerShake(5);

    // Check if timer expired after penalty
    if (this.escapeTimer.isExpired()) {
      this.transitionToSection('game_over');
    }
  }

  // ============================================================================
  // TIMER CALLBACKS
  // ============================================================================

  /**
   * Handle timer expiration - game over.
   */
  private handleTimerExpired(): void {
    // Timer expired - transition to game over
    this.transitionToSection('game_over');
  }

  /**
   * Handle urgency level changes.
   */
  private handleUrgencyChange(urgency: TimerUrgency): void {
    switch (urgency) {
      case 'warning':
        this.emitNotification('2 MINUTES REMAINING', 2000);
        break;
      case 'critical':
        this.emitNotification('1 MINUTE REMAINING - HURRY!', 3000);
        this.queueComms(0, {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'CRITICAL: 60 seconds to total collapse. Maximum speed required.',
        });
        break;
      case 'final':
        this.emitNotification('20 SECONDS!', 3000);
        this.queueComms(0, {
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: "NO TIME LEFT! FLOOR IT! WE'RE NOT DYING HERE!",
        });
        break;
    }
  }

  // ============================================================================
  // SHUTTLE LAUNCH ANIMATION
  // ============================================================================

  /**
   * Animate the shuttle launch for the victory cinematic.
   */
  private animateShuttleLaunch(): void {
    if (!this.shuttle) return;

    const frameRate = 30;
    const currentPos = this.shuttle.position.clone();
    const orbitPos = new Vector3(currentPos.x, 300, currentPos.z - 200);

    // Position animation: launch to orbit
    const posAnim = new Animation(
      'shuttleLaunch',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    posAnim.setEasingFunction(easing);

    posAnim.setKeys([
      { frame: 0, value: currentPos },
      { frame: 30, value: new Vector3(currentPos.x, 15, currentPos.z - 10) }, // Liftoff
      { frame: 90, value: new Vector3(currentPos.x, 60, currentPos.z - 60) }, // Climbing
      { frame: 200, value: orbitPos }, // Orbit
    ]);

    // Pitch animation
    const pitchAnim = new Animation(
      'shuttlePitch',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    pitchAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 30, value: -0.1 },
      { frame: 90, value: -0.4 },
      { frame: 200, value: -0.6 },
    ]);

    this.shuttle.animations = [posAnim, pitchAnim];
    this.scene.beginAnimation(this.shuttle, 0, 200, false);

    // Intensify engine glow during launch
    for (const light of this.shuttleEngines) {
      light.intensity = 20;
      light.range = 40;
    }

    // Camera follows shuttle (look up)
    const camTimeout = setTimeout(() => {
      this.enableDramaticDepthOfField(100, 85, 1.4);
    }, 2000);
    this.pendingTimeouts.push(camTimeout);
  }

  // ============================================================================
  // COMMS QUEUE
  // ============================================================================

  /**
   * Queue a comms message for delayed delivery.
   */
  private queueComms(
    delay: number,
    message: {
      sender: string;
      callsign: string;
      portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
      text: string;
    }
  ): void {
    this.commsQueue.push({ delay, ...message });
  }

  /**
   * Update the comms queue, delivering messages as their delays expire.
   */
  private updateCommsQueue(deltaTime: number): void {
    if (this.commsQueue.length === 0) return;

    const toDeliver: number[] = [];

    for (let i = 0; i < this.commsQueue.length; i++) {
      const msg = this.commsQueue[i];
      msg.delay -= deltaTime;
      if (msg.delay <= 0) {
        toDeliver.push(i);
      }
    }

    // Deliver messages (reverse to preserve indices)
    for (let i = toDeliver.length - 1; i >= 0; i--) {
      const idx = toDeliver[i];
      const msg = this.commsQueue[idx];
      this.emitCommsMessage({
        sender: msg.sender,
        callsign: msg.callsign,
        portrait: msg.portrait,
        text: msg.text,
      });
      this.commsQueue.splice(idx, 1);
    }
  }

  // ============================================================================
  // HUD
  // ============================================================================

  /**
   * Update the HUD objective display with timer and section info.
   */
  private updateHUD(): void {
    if (this.cinematicActive) return;

    const timerState = this.escapeTimer.getState();
    const sectionName = this.getSectionDisplayName();

    // Build urgency prefix with visual indicators
    let urgencyPrefix = '';
    let timerDisplay = timerState.displayTime;
    if (timerState.urgency === 'warning') {
      urgencyPrefix = '! ';
    } else if (timerState.urgency === 'critical') {
      urgencyPrefix = '!! CRITICAL: ';
      // Pulse effect on timer
      if (Math.floor(timerState.remaining * 2) % 2 === 0) {
        timerDisplay = `[${timerState.displayTime}]`;
      }
    } else if (timerState.urgency === 'final') {
      urgencyPrefix = '!!! FINAL: ';
      // Rapid pulse effect
      if (Math.floor(timerState.remaining * 4) % 2 === 0) {
        timerDisplay = `>>>${timerState.displayTime}<<<`;
      }
    }

    const distanceToGoal = this.getDistanceToGoal();
    const distStr = distanceToGoal > 0 ? ` | ${Math.round(distanceToGoal)}m TO SHUTTLE` : '';

    // Show boost status
    let boostStr = '';
    if (this.isBoosting) {
      boostStr = ' | BOOST!';
    } else if (this.boostCooldownTimer > 0) {
      boostStr = ` | BOOST: ${Math.ceil(this.boostCooldownTimer)}s`;
    } else {
      boostStr = ' | BOOST: READY';
    }

    this.emitObjectiveUpdate(
      `${urgencyPrefix}${sectionName} - ${timerDisplay}`,
      `SPEED: ${Math.round(this.vehicleSpeed)} m/s${distStr}${boostStr} | HP: ${Math.round(Math.max(0, this.playerHealth))}`
    );
  }

  /**
   * Get display name for current section.
   */
  private getSectionDisplayName(): string {
    switch (this.section) {
      case 'hive_exit':
        return 'HIVE EXIT';
      case 'surface_run':
        return 'SURFACE RUN';
      case 'canyon_sprint':
        return 'CANYON SPRINT';
      case 'launch_pad':
        return 'LAUNCH PAD';
      case 'victory':
        return 'ESCAPE SUCCESSFUL';
      case 'game_over':
        return 'MISSION FAILED';
      default:
        return 'FINAL ESCAPE';
    }
  }

  /**
   * Get distance from player to the launch pad.
   */
  private getDistanceToGoal(): number {
    return Math.abs(this.camera.position.z - SECTION_BOUNDARIES.launchPad);
  }

  // ============================================================================
  // INPUT OVERRIDES
  // ============================================================================

  /**
   * Override movement processing for vehicle controls.
   * The vehicle always moves forward; player only controls steering.
   * Supports gyroscope for mobile devices.
   */
  protected override processMovement(deltaTime: number): void {
    // Process touch look input
    if (this.touchInput) {
      const look = this.touchInput.look;
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        this.targetRotationY += look.x;
        this.targetRotationX -= look.y;
        this.targetRotationX = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.targetRotationX)
        );
      }
    }

    // Smooth camera rotation
    const lerpFactor = Math.min(1, this.rotationLerpSpeed * deltaTime);
    this.rotationX += (this.targetRotationX - this.rotationX) * lerpFactor;
    this.rotationY += (this.targetRotationY - this.rotationY) * lerpFactor;

    this.camera.rotation.y = this.rotationY;

    // Vehicle physics handles position updates via updateVehiclePhysics
    // We only handle boost input here
    if (this.inputTracker.isActionActive('jump') || this.touchInput?.isJumping) {
      this.activateBoost();
    }

    // Override steering with gyroscope input on mobile if available
    if (this.gyroscopeManager?.isEnabled()) {
      const gyroSteer = this.gyroscopeManager.getSteeringInput();
      if (Math.abs(gyroSteer) > 0.1) {
        // Apply gyroscope steering (converted to vehicle steering in updateVehiclePhysics)
        this.vehicleSteering = gyroSteer * VEHICLE_TURN_SPEED * 0.5;
      }

      const gyroThrottle = this.gyroscopeManager.getThrottleInput();
      if (gyroThrottle.throttle > 0.5) {
        this.activateBoost();
      }
    }
  }

  protected override getMoveSpeed(): number {
    return VEHICLE_SPEED;
  }

  protected override getSprintMultiplier(): number {
    return VEHICLE_BOOST_MULTIPLIER;
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Boost on space
    if (e.code === 'Space') {
      this.activateBoost();
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  override canTransitionTo(_levelId: LevelId): boolean {
    return false; // Final level - no forward transition (goes to credits)
  }
}
