/**
 * FinalEscapeLevel - Warthog Run Style Vehicle Finale (Chapter 10)
 *
 * The hive detonation has been triggered. The planet is crumbling.
 * The player drives a vehicle to the extraction shuttle at the launch pad.
 *
 * FOUR SECTIONS:
 *
 * Section A: HIVE EXIT (0-300m)
 *   - Drive through collapsing tunnels
 *   - Falling debris from ceiling
 *   - Organic walls cracking and breaking
 *   - Light at end signals surface exit
 *   - Marcus provides radio guidance
 *
 * Section B: SURFACE RUN (300-700m)
 *   - Race across crumbling terrain
 *   - Chasms opening in the ground
 *   - Distant explosions rock the landscape
 *   - Lava/magma emerging from fissures
 *   - Marcus runs alongside in his mech
 *
 * Section C: CANYON SPRINT (700-1000m)
 *   - Narrow canyon with falling rocks from walls
 *   - Must steer around debris and chasms
 *   - Canyon walls collapsing behind player
 *   - Intensifying destruction
 *
 * Section D: LAUNCH PAD (1000-1200m)
 *   - Reach the shuttle at the pad
 *   - Dramatic cinematic: shuttle launch
 *   - View of planet from orbit
 *   - Leads to credits
 *
 * TIMER: 4 minutes (240 seconds) to reach the frigate
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
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { ALIEN_SPECIES, createAlienMesh } from '../../entities/aliens';
import { levelActionParams } from '../../input/InputBridge';
import { saveSystem } from '../../persistence/SaveSystem';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { SurfaceLevel } from '../SurfaceLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import { CollapsingTerrain } from './CollapsingTerrain';
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

interface TunnelSegment {
  mesh: Mesh;
  lights: PointLight[];
  zPosition: number;
}

interface DebrisChunk {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
}

// Section boundary Z positions (player starts at Z=0 and moves in -Z direction)
const SECTION_BOUNDARIES = {
  hiveExitEnd: -300,
  surfaceRunEnd: -700,
  canyonSprintEnd: -1000,
  launchPad: -1200,
} as const;

const VEHICLE_SPEED = 30; // Base vehicle speed (m/s)
const VEHICLE_BOOST_MULTIPLIER = 1.5;
const VEHICLE_TURN_SPEED = 3.0;
const VEHICLE_HEIGHT = 2.5; // Camera height in vehicle

// ============================================================================
// FINAL ESCAPE LEVEL
// ============================================================================

export class FinalEscapeLevel extends SurfaceLevel {
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
  private vehicleNode: TransformNode | null = null;
  private vehicleMesh: Mesh | null = null;
  private vehicleHeadlights: PointLight[] = [];

  // Hive tunnel
  private tunnelSegments: TunnelSegment[] = [];
  private tunnelCollapseWall: Mesh | null = null;
  private tunnelCollapseZ = 10; // Z position of the collapse wall
  private tunnelExitLight: PointLight | null = null;
  private tunnelDebris: DebrisChunk[] = [];
  private tunnelDebrisTimer = 0;

  // Marcus mech companion
  private marcusMech: TransformNode | null = null;
  private marcusMechLight: PointLight | null = null;
  private marcusTargetOffset = new Vector3(15, 0, -5);
  private marcusCommsPlayed: Set<string> = new Set();

  // Launch pad / shuttle
  private launchPad: Mesh | null = null;
  private shuttle: TransformNode | null = null;
  private shuttleEngines: PointLight[] = [];
  private shuttleLight: PointLight | null = null;
  private shuttleBeacon: Mesh | null = null;

  // Enemy stragglers
  private stragglers: StragglerEnemy[] = [];
  private readonly maxStragglers = 8;
  private stragglerSpawnTimer = 0;

  // Player state
  private playerHealth = 100;
  private kills = 0;

  // Visual effects state
  private screenShakeAccumulator = 0;
  private environmentalShakeIntensity = 0;
  private skyColorShift = 0;

  // Action button callback reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Cinematic state
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
  private commsTimer = 0;

  // Timeouts to clean up on dispose
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks, {
      terrainSize: 1200,
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

    // Create environment sections
    this.createHiveTunnel();
    this.createVehicle();
    this.createMarcusMech();
    this.createLaunchPadAndShuttle();

    // Create collapsing terrain (visible from hive exit onwards)
    this.collapsingTerrain = new CollapsingTerrain(this.scene, {
      terrainLength: 1200,
      terrainWidth: 60,
      segmentCount: 60,
      maxChasms: 8,
      maxFallingRocks: 15,
      maxLavaPools: 10,
      destructionRate: 1.0,
    });
    this.collapsingTerrain.initialize();

    // Initially hide outdoor elements
    this.setOutdoorVisible(false);

    // Set up timer callbacks
    this.escapeTimer.setOnExpired(() => this.handleTimerExpired());
    this.escapeTimer.setOnUrgencyChange((urgency) => this.handleUrgencyChange(urgency));
    this.escapeTimer.setOnCheckpoint((bonus, total) => {
      this.callbacks.onNotification(`CHECKPOINT +${bonus}s`, 2000);
    });

    // Set up action buttons for vehicle controls
    this.setupActionButtons();

    // Start the escape sequence
    this.startEscapeSequence();
  }

  protected updateLevel(deltaTime: number): void {
    this.sectionTime += deltaTime;

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
    this.updateVehiclePhysics(deltaTime);
    this.updateMarcusMech(deltaTime);
    this.updateStragglerSpawning(deltaTime);
    this.updateEnvironmentalEffects(deltaTime);
    this.updateHUD();
  }

  protected override disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

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

    // Dispose tunnel
    for (const seg of this.tunnelSegments) {
      seg.mesh.dispose();
      seg.lights.forEach((l) => l.dispose());
    }
    this.tunnelSegments = [];
    this.tunnelCollapseWall?.dispose();
    this.tunnelExitLight?.dispose();
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

    // Dispose Marcus mech
    this.marcusMech?.dispose();
    this.marcusMechLight?.dispose();

    // Dispose launch pad / shuttle
    this.launchPad?.dispose();
    this.shuttle?.dispose();
    for (const light of this.shuttleEngines) {
      light.dispose();
    }
    this.shuttleLight?.dispose();
    this.shuttleBeacon?.dispose();

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

    // Create sky dome with apocalyptic colors
    this.createSkyDome();
    if (this.skyDome) {
      const skyMat = this.skyDome.material as StandardMaterial;
      skyMat.emissiveColor = new Color3(0.6, 0.3, 0.15);
    }
  }

  /**
   * Create the hive tunnel (Section A).
   * Organic tunnel with collapsing walls and falling debris.
   */
  private createHiveTunnel(): void {
    const tunnelLength = 300; // Section A is 300m
    const segmentLength = 20;
    const numSegments = tunnelLength / segmentLength;
    const tunnelRadius = 6; // Wider for vehicle

    const tunnelMat = new StandardMaterial('tunnel_mat', this.scene);
    tunnelMat.diffuseColor = Color3.FromHexString('#3A2A3A');
    tunnelMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const organicMat = new StandardMaterial('organic_mat', this.scene);
    organicMat.diffuseColor = Color3.FromHexString('#5A3A5A');
    organicMat.emissiveColor = new Color3(0.1, 0.05, 0.1);

    for (let i = 0; i < numSegments; i++) {
      const zPos = -i * segmentLength;

      // Main tunnel cylinder (inside-out for interior viewing)
      const segment = MeshBuilder.CreateCylinder(
        `tunnel_seg_${i}`,
        {
          height: segmentLength,
          diameter: tunnelRadius * 2,
          tessellation: 12,
          sideOrientation: 1,
        },
        this.scene
      );
      segment.material = tunnelMat;
      segment.position.set(0, tunnelRadius * 0.4, zPos);
      segment.rotation.x = Math.PI / 2; // Horizontal

      // Floor slab
      const floor = MeshBuilder.CreateBox(
        `tunnel_floor_${i}`,
        {
          width: tunnelRadius * 1.6,
          height: 0.5,
          depth: segmentLength,
        },
        this.scene
      );
      floor.position.set(0, -0.25, zPos);
      floor.material = organicMat;

      // Dim amber lights inside tunnel
      const lights: PointLight[] = [];
      const light = new PointLight(
        `tunnel_light_${i}`,
        new Vector3(0, tunnelRadius * 0.6, zPos),
        this.scene
      );
      light.diffuse = new Color3(1, 0.5, 0.2);
      light.intensity = 1.5;
      light.range = segmentLength * 1.5;
      lights.push(light);

      this.tunnelSegments.push({ mesh: segment, lights, zPosition: zPos });
    }

    // Collapse wall (follows the player)
    this.tunnelCollapseWall = MeshBuilder.CreateBox(
      'collapse_wall',
      { width: tunnelRadius * 2.5, height: tunnelRadius * 2.5, depth: 15 },
      this.scene
    );
    const collapseMat = new StandardMaterial('collapse_mat', this.scene);
    collapseMat.diffuseColor = new Color3(0.3, 0.15, 0.1);
    collapseMat.emissiveColor = new Color3(0.6, 0.2, 0.05);
    this.tunnelCollapseWall.material = collapseMat;
    this.tunnelCollapseWall.position.set(0, 3, 10);

    // Exit light at end of tunnel
    this.tunnelExitLight = new PointLight(
      'tunnel_exit_light',
      new Vector3(0, 3, SECTION_BOUNDARIES.hiveExitEnd + 10),
      this.scene
    );
    this.tunnelExitLight.diffuse = new Color3(1, 0.7, 0.4);
    this.tunnelExitLight.intensity = 8;
    this.tunnelExitLight.range = 40;
  }

  /**
   * Create the player vehicle (armored ground transport).
   */
  private createVehicle(): void {
    this.vehicleNode = new TransformNode('vehicle', this.scene);

    // Vehicle body
    this.vehicleMesh = MeshBuilder.CreateBox(
      'vehicle_body',
      { width: 3, height: 1.5, depth: 5 },
      this.scene
    );
    this.vehicleMesh.parent = this.vehicleNode;
    this.vehicleMesh.position.y = 0.75;

    const vehicleMat = new StandardMaterial('vehicle_mat', this.scene);
    vehicleMat.diffuseColor = Color3.FromHexString('#3A5A3A'); // Military green
    vehicleMat.specularColor = new Color3(0.2, 0.2, 0.2);
    this.vehicleMesh.material = vehicleMat;

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

    // Position vehicle at player start
    this.vehicleNode.position.set(0, 0, 0);
  }

  /**
   * Create Marcus's mech companion.
   */
  private createMarcusMech(): void {
    this.marcusMech = new TransformNode('marcus_mech', this.scene);

    // Mech body (simplified box)
    const mechBody = MeshBuilder.CreateBox(
      'mech_body',
      { width: 4, height: 6, depth: 3 },
      this.scene
    );
    mechBody.parent = this.marcusMech;
    mechBody.position.y = 4;

    const mechMat = new StandardMaterial('mech_mat', this.scene);
    mechMat.diffuseColor = Color3.FromHexString('#4A5A6A'); // Steel blue
    mechMat.specularColor = new Color3(0.3, 0.3, 0.3);
    mechBody.material = mechMat;

    // Mech legs (two pillars)
    for (let side = -1; side <= 1; side += 2) {
      const leg = MeshBuilder.CreateBox(
        `mech_leg_${side}`,
        { width: 1.2, height: 4, depth: 1.5 },
        this.scene
      );
      leg.parent = this.marcusMech;
      leg.position.set(side * 1.2, 2, 0);
      leg.material = mechMat;
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
   * Create the launch pad and shuttle at the end of the escape route.
   */
  private createLaunchPadAndShuttle(): void {
    // Launch pad (large flat platform)
    this.launchPad = MeshBuilder.CreateBox(
      'launch_pad',
      { width: 30, height: 1, depth: 30 },
      this.scene
    );
    this.launchPad.position.set(0, -0.5, SECTION_BOUNDARIES.launchPad);

    const padMat = new StandardMaterial('pad_mat', this.scene);
    padMat.diffuseColor = Color3.FromHexString('#5A5A5A');
    padMat.specularColor = new Color3(0.2, 0.2, 0.2);
    this.launchPad.material = padMat;

    // Shuttle
    this.shuttle = new TransformNode('shuttle', this.scene);
    this.shuttle.position.set(0, 2, SECTION_BOUNDARIES.launchPad);

    // Shuttle body (elongated capsule shape using box)
    const shuttleBody = MeshBuilder.CreateBox(
      'shuttle_body',
      { width: 6, height: 4, depth: 14 },
      this.scene
    );
    shuttleBody.parent = this.shuttle;
    shuttleBody.position.y = 3;

    const shuttleMat = new StandardMaterial('shuttle_mat', this.scene);
    shuttleMat.diffuseColor = Color3.FromHexString('#8A8A8A');
    shuttleMat.specularColor = new Color3(0.4, 0.4, 0.4);
    shuttleBody.material = shuttleMat;

    // Shuttle nose cone
    const noseCone = MeshBuilder.CreateCylinder(
      'shuttle_nose',
      { height: 4, diameterTop: 0, diameterBottom: 6, tessellation: 8 },
      this.scene
    );
    noseCone.parent = this.shuttle;
    noseCone.position.set(0, 5, -7);
    noseCone.rotation.x = -Math.PI / 2;
    noseCone.material = shuttleMat;

    // Shuttle wings
    for (let side = -1; side <= 1; side += 2) {
      const wing = MeshBuilder.CreateBox(
        `shuttle_wing_${side}`,
        { width: 10, height: 0.5, depth: 6 },
        this.scene
      );
      wing.parent = this.shuttle;
      wing.position.set(side * 7, 3, 2);
      wing.material = shuttleMat;
    }

    // Engine glow lights
    for (let i = -1; i <= 1; i++) {
      const engineLight = new PointLight(
        `shuttle_engine_${i}`,
        new Vector3(i * 2, 1.5, 9),
        this.scene
      );
      engineLight.parent = this.shuttle;
      engineLight.diffuse = new Color3(0.5, 0.7, 1.0);
      engineLight.intensity = 0;
      engineLight.range = 15;
      this.shuttleEngines.push(engineLight);
    }

    // Shuttle spotlight (navigation beacon)
    this.shuttleLight = new PointLight(
      'shuttle_spotlight',
      new Vector3(0, 8, SECTION_BOUNDARIES.launchPad),
      this.scene
    );
    this.shuttleLight.diffuse = new Color3(0.3, 0.5, 1.0);
    this.shuttleLight.intensity = 0;
    this.shuttleLight.range = 60;

    // Shuttle beacon (pulsing light marker)
    this.shuttleBeacon = MeshBuilder.CreateSphere(
      'shuttle_beacon',
      { diameter: 1, segments: 8 },
      this.scene
    );
    this.shuttleBeacon.position.set(0, 12, SECTION_BOUNDARIES.launchPad);
    const beaconMat = new StandardMaterial('beacon_mat', this.scene);
    beaconMat.emissiveColor = new Color3(0, 0.5, 1);
    beaconMat.disableLighting = true;
    this.shuttleBeacon.material = beaconMat;
  }

  /**
   * Toggle visibility of outdoor elements (hidden during tunnel section).
   */
  private setOutdoorVisible(visible: boolean): void {
    if (this.collapsingTerrain) {
      // Terrain segments are managed by CollapsingTerrain class
      // We show/hide the sky dome and launch pad
    }
    if (this.skyDome) this.skyDome.isVisible = visible;
    if (this.launchPad) this.launchPad.isVisible = visible;
    if (this.shuttle) this.shuttle.setEnabled(visible);
    if (this.shuttleBeacon) this.shuttleBeacon.isVisible = visible;
    if (this.shuttleLight) this.shuttleLight.intensity = visible ? 5 : 0;
    if (this.marcusMech) this.marcusMech.setEnabled(visible);
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

    // Opening comms
    this.callbacks.onObjectiveUpdate(
      'FINAL ESCAPE',
      'DRIVE TO THE SHUTTLE - THE PLANET IS BREAKING APART'
    );

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
      this.callbacks.onNotification('4:00 - ESCAPE TIMER STARTED', 3000);

      // Set base camera shake for the entire level (rumbling planet)
      this.setBaseShake(0.5);
    }, 8000);
    this.pendingTimeouts.push(startTimeout);
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

    this.callbacks.onActionGroupsChange([vehicleGroup]);

    // Register action handler
    this.actionCallback = (actionId: string) => {
      switch (actionId) {
        case 'boost':
          this.activateBoost();
          break;
      }
    };
    this.callbacks.onActionHandlerRegister(this.actionCallback);
  }

  /**
   * Activate vehicle boost.
   */
  private activateBoost(): void {
    if (this.isBoosting) return;
    this.isBoosting = true;

    const boostTimeout = setTimeout(() => {
      this.isBoosting = false;
    }, 2000);
    this.pendingTimeouts.push(boostTimeout);
  }

  // ============================================================================
  // VEHICLE PHYSICS
  // ============================================================================

  /**
   * Update vehicle movement based on player input.
   * The vehicle always moves forward; player controls steering.
   */
  private updateVehiclePhysics(deltaTime: number): void {
    if (this.cinematicActive || this.section === 'victory' || this.section === 'game_over') return;

    // Always moving forward (in -Z direction)
    const baseSpeed = VEHICLE_SPEED;
    const speedMultiplier = this.isBoosting ? VEHICLE_BOOST_MULTIPLIER : 1.0;
    this.vehicleSpeed = baseSpeed * speedMultiplier;

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

    // Clamp to terrain bounds
    if (this.section === 'hive_exit') {
      // Tunnel bounds
      const tunnelRadius = 4.5;
      const distFromCenter = Math.abs(this.camera.position.x);
      if (distFromCenter > tunnelRadius) {
        this.camera.position.x = Math.sign(this.camera.position.x) * tunnelRadius;
      }
    } else if (this.collapsingTerrain) {
      // Surface/canyon bounds
      const bounds = this.collapsingTerrain.getTerrainBounds();
      this.camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.camera.position.x));
    }

    // Update vehicle node position to match camera
    if (this.vehicleNode) {
      this.vehicleNode.position.set(this.camera.position.x, 0, this.camera.position.z);
      // Tilt vehicle based on steering
      this.vehicleNode.rotation.y = Math.PI + this.vehicleSteering * 0.1;
    }

    // Check section transitions
    this.checkSectionTransitions();

    // Check terrain damage
    this.checkTerrainDamage(deltaTime);
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

    console.log(`[FinalEscape] Section transition: ${previousSection} -> ${newSection}`);

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

    // Hide tunnel elements
    for (const seg of this.tunnelSegments) {
      seg.mesh.isVisible = false;
      seg.lights.forEach((l) => (l.intensity = 0));
    }
    this.tunnelCollapseWall?.setEnabled(false);
    this.tunnelExitLight?.setEnabled(false);

    // Checkpoint bonus
    this.escapeTimer.reachCheckpoint('Surface Run');

    this.callbacks.onObjectiveUpdate('SURFACE RUN', 'RACE ACROSS THE SURFACE TO THE CANYON');

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

    this.callbacks.onObjectiveUpdate(
      'CANYON SPRINT',
      'NAVIGATE THE CANYON - WATCH FOR FALLING ROCKS'
    );

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
      text: 'Shuttle beacon detected ahead. Distance: 500 meters. Structural collapse accelerating.',
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

    this.callbacks.onObjectiveUpdate('LAUNCH PAD', 'REACH THE SHUTTLE - ALMOST THERE');

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

    this.callbacks.onCinematicStart?.();

    this.callbacks.onObjectiveUpdate('ESCAPE SUCCESSFUL', 'LAUNCHING TO ORBIT');

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

    // Complete level after cinematic
    const completeTimeout = setTimeout(() => {
      this.callbacks.onCinematicEnd?.();
      this.state.completed = true;
      this.completeLevel();
    }, 15000);
    this.pendingTimeouts.push(completeTimeout);
  }

  /**
   * Enter Game Over - timer expired.
   */
  private onEnterGameOver(): void {
    this.cinematicActive = true;

    this.callbacks.onObjectiveUpdate('MISSION FAILED', 'THE PLANET HAS BEEN CONSUMED');

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

    // Flicker tunnel lights for drama
    for (const seg of this.tunnelSegments) {
      for (const light of seg.lights) {
        if (seg.zPosition > this.camera.position.z + 5) {
          // Lights behind player flicker and die
          light.intensity *= 0.95;
        } else {
          // Lights ahead pulse
          light.intensity = 1.5 + Math.sin(this.sectionTime * 4 + seg.zPosition * 0.1) * 0.5;
        }
      }
    }

    // Marcus comms for tunnel section
    if (this.sectionTime > 5 && !this.marcusCommsPlayed.has('tunnel_halfway')) {
      if (this.camera.position.z < -150) {
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
    const timerState = this.escapeTimer.getState();
    this.collapsingTerrain?.update(deltaTime, 0.9, this.camera.position);

    // Pulse shuttle beacon
    if (this.shuttleBeacon) {
      const pulse = Math.sin(this.sectionTime * 5) * 0.5 + 0.5;
      const beaconMat = this.shuttleBeacon.material as StandardMaterial;
      beaconMat.emissiveColor = new Color3(pulse * 0.3, pulse * 0.7, 1.0);
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

    const mesh = createAlienMesh(this.scene, species, Math.random() * 10000);
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
  }

  // ============================================================================
  // TUNNEL DEBRIS
  // ============================================================================

  /**
   * Spawn falling debris in the hive tunnel.
   */
  private spawnTunnelDebris(): void {
    const size = 0.3 + Math.random() * 0.8;

    const mesh = MeshBuilder.CreatePolyhedron(
      `tunnel_debris_${this.tunnelDebris.length}`,
      { type: Math.floor(Math.random() * 3), size },
      this.scene
    );

    // Spawn from ceiling, near player's forward path
    mesh.position.set(
      (Math.random() - 0.5) * 8,
      5 + Math.random() * 2,
      this.camera.position.z - 10 - Math.random() * 20
    );

    const debrisMat = new StandardMaterial(`debris_mat_${this.tunnelDebris.length}`, this.scene);
    debrisMat.diffuseColor = Color3.FromHexString('#4A3A4A');
    mesh.material = debrisMat;

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
  // DAMAGE / HEALTH
  // ============================================================================

  /**
   * Apply damage to the player.
   */
  private applyDamage(amount: number): void {
    this.playerHealth -= amount;
    this.callbacks.onHealthChange(Math.max(0, Math.round(this.playerHealth)));
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
    this.playerHealth = 50; // Respawn with half health
    this.escapeTimer.applyDeathPenalty();

    this.callbacks.onHealthChange(50);
    this.callbacks.onNotification('RESPAWNING - TIME PENALTY', 2000);
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
    console.log('[FinalEscape] Timer expired - game over');
    this.transitionToSection('game_over');
  }

  /**
   * Handle urgency level changes.
   */
  private handleUrgencyChange(urgency: TimerUrgency): void {
    switch (urgency) {
      case 'warning':
        this.callbacks.onNotification('2 MINUTES REMAINING', 2000);
        break;
      case 'critical':
        this.callbacks.onNotification('1 MINUTE REMAINING - HURRY!', 3000);
        this.queueComms(0, {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'CRITICAL: 60 seconds to total collapse. Maximum speed required.',
        });
        break;
      case 'final':
        this.callbacks.onNotification('20 SECONDS!', 3000);
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

    this.commsTimer += deltaTime;

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
      this.callbacks.onCommsMessage({
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

    let urgencyPrefix = '';
    if (timerState.urgency === 'critical') urgencyPrefix = 'CRITICAL: ';
    if (timerState.urgency === 'final') urgencyPrefix = 'FINAL: ';

    const distanceToGoal = this.getDistanceToGoal();
    const distStr = distanceToGoal > 0 ? ` | ${Math.round(distanceToGoal)}m TO SHUTTLE` : '';

    this.callbacks.onObjectiveUpdate(
      `${urgencyPrefix}${sectionName} - ${timerState.displayTime}`,
      `SPEED: ${Math.round(this.vehicleSpeed)} m/s${distStr} | HP: ${Math.round(Math.max(0, this.playerHealth))}`
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
