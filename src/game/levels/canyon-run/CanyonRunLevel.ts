/**
 * CanyonRunLevel - Vehicle Chase Sequence (Chapter 3)
 *
 * After landing on the planet surface, the player commandeers a Warthog-style
 * vehicle and races through a narrow canyon towards FOB Delta. Enemy Wraith
 * vehicles pursue from behind while environmental hazards block the path.
 *
 * THREE DISTINCT PHASES:
 *
 * PHASE 1: CANYON APPROACH (driving)
 *   - Player learns vehicle controls
 *   - Navigate around boulders and wrecked vehicles
 *   - Enemy Wraiths begin pursuit partway through
 *   - Objective markers guide the path
 *   - Rockslide scripted event at Z=-800
 *
 * PHASE 2: BRIDGE CROSSING (scripted)
 *   - Approach the main bridge spanning the canyon
 *   - Reyes warns it may not hold
 *   - Bridge begins collapsing as player drives across
 *   - Must boost to clear the gap
 *   - Dramatic camera moment
 *
 * PHASE 3: FINAL STRETCH (combat chase)
 *   - Full enemy pursuit with multiple Wraiths
 *   - Falling rocks, collapsing terrain
 *   - Boost through narrow gaps
 *   - Reach extraction point to complete level
 *   - Dropship flyover at the end
 *
 * ENEMY VEHICLES:
 *   - Wraith-style hover tanks that fire plasma mortars
 *   - Appear behind the player and give chase
 *   - Can be slowed by obstacles or outrun with boost
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { SurfaceLevel } from '../SurfaceLevel';
import { buildFloraFromPlacements, getCanyonRunFlora } from '../shared/AlienFloraBuilder';
import { buildCollectibles, type CollectibleSystemResult, getCanyonRunCollectibles } from '../shared/CollectiblePlacer';
import {
  createDynamicTerrain,
  ROCK_TERRAIN,
  type TerrainResult,
} from '../shared/SurfaceTerrainFactory';
import type { LevelCallbacks, LevelConfig } from '../types';
import {
  BRIDGE_Z,
  type BridgeStructure,
  CANYON_HALF_WIDTH,
  CANYON_LENGTH,
  type CanyonEnvironment,
  collapseBridge,
  createCanyonEnvironment,
  disposeRockslide,
  EXTRACTION_Z,
  type ObjectiveMarker,
  type RockslideRock,
  sampleTerrainHeight,
  spawnRockslide,
  updateRockslide,
} from './environment';
import { VehicleController } from './VehicleController';

// ============================================================================
// TYPES
// ============================================================================

type CanyonPhase =
  | 'intro' // Cinematic intro / mount vehicle
  | 'canyon_approach' // Phase 1: driving through canyon
  | 'bridge_crossing' // Phase 2: bridge collapse sequence
  | 'final_stretch' // Phase 3: combat chase to extraction
  | 'extraction' // Reached extraction point
  | 'complete'; // Level complete

/** GLB path for the enemy wraith hover-tank model. */
const WRAITH_GLB = '/models/vehicles/chitin/wraith.glb';

interface EnemyWraith {
  rootNode: TransformNode;
  body: TransformNode;
  turret: TransformNode;
  glowMesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  health: number;
  maxHealth: number;
  fireCooldown: number;
  fireRate: number;
  isActive: boolean;
  /** Distance behind player (Z offset) */
  pursuitOffset: number;
}

interface WraithProjectile {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  damage: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WRAITH_MAX_HEALTH = 200;
const WRAITH_FIRE_RATE = 3.0; // Seconds between shots
const WRAITH_PROJECTILE_SPEED = 40;
const WRAITH_PROJECTILE_DAMAGE = 15;
const WRAITH_PURSUIT_SPEED = 45;
const WRAITH_LATERAL_SPEED = 15;
const WRAITH_SPAWN_DISTANCE = 80; // Behind player

const PLAYER_COLLISION_RADIUS = 3.0;
const BOULDER_COLLISION_RADIUS = 2.5;
const PROJECTILE_BLAST_RADIUS = 5.0;

// Phase trigger Z positions (player moves in -Z direction)
const ROCKSLIDE_TRIGGER_Z = -800;
const WRAITH_SPAWN_Z = -900;
const BRIDGE_APPROACH_Z = BRIDGE_Z + 100;
const BRIDGE_COLLAPSE_Z = BRIDGE_Z - 5;
const FINAL_WRAITH_SPAWN_Z = BRIDGE_Z - 200;

// ============================================================================
// COMMS DIALOGUE
// ============================================================================

const COMMS = {
  intro: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'Reyes, we found a vehicle near the LZ. Get moving through the canyon - FOB Delta is on the other side. Watch for hostiles.',
  },
  vehicleReady: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Vehicle systems online. WASD to drive, SHIFT to boost. Fuel is limited - use it wisely.',
  },
  rockslideWarning: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Seismic activity detected! Canyon walls are unstable - watch for falling debris!',
  },
  wraithContact: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'Contacts behind you! Wraith-class hover tanks - do NOT stop, keep moving!',
  },
  bridgeApproach: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Bridge ahead. Structural integrity is compromised - recommend maximum speed.',
  },
  bridgeCollapse: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'The bridge is going! PUNCH IT!',
  },
  finalStretch: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'Extraction point is close! Push through - we have a bird inbound!',
  },
  moreWraiths: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Multiple hostile signatures closing from behind. Recommend sustained boost to extraction.',
  },
  nearExtraction: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'Almost there, Reyes! I can see the extraction pad on sensors. Get to the green zone!',
  },
  extracted: {
    sender: 'Lt. Commander Reyes',
    callsign: 'COMMAND',
    portrait: 'commander' as const,
    text: 'Solid copy - you made it! Dismount and get aboard. FOB Delta is just over the ridge.',
  },
  vehicleDamage: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Warning: Vehicle hull integrity dropping. Avoid further impacts.',
  },
  vehicleCritical: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'CRITICAL: Vehicle systems failing. Hull breach imminent - reach extraction immediately!',
  },
};

// ============================================================================
// CANYON RUN LEVEL
// ============================================================================

export class CanyonRunLevel extends SurfaceLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Phase management
  private phase: CanyonPhase = 'intro';
  private phaseTime = 0;

  // Vehicle
  private vehicle: VehicleController | null = null;

  // Environment
  private canyonEnv: CanyonEnvironment | null = null;

  // Enemies
  private wraiths: EnemyWraith[] = [];
  private projectiles: WraithProjectile[] = [];
  private readonly maxWraiths = 4;

  // Rockslide
  private activeRockslides: RockslideRock[][] = [];
  private rockslideTriggered = false;

  // Bridge
  private bridgeCollapseTriggered = false;

  // Scripted event flags
  private commsPlayed = new Set<string>();
  private wraithsSpawned = false;
  private finalWraithsSpawned = false;

  // Player stats
  private playerHealth = 100;
  private kills = 0;

  // Objective tracking
  private currentObjectiveIndex = 0;

  // Action system
  private actionCallback: ((actionId: string) => void) | null = null;

  // Vehicle damage feedback
  private damageWarningShown = false;
  private criticalWarningShown = false;

  // Extraction zone
  private extractionReached = false;

  // Wraith material cache
  private wraithBodyMat: StandardMaterial | null = null;
  private wraithGlowMat: StandardMaterial | null = null;

  // Factory terrain (SurfaceTerrainFactory)
  private factoryTerrain: TerrainResult | null = null;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks, {
      terrainSize: CANYON_LENGTH,
      heightScale: 5,
      timeOfDay: 0.4,
      fogDensity: 0.003,
      dustIntensity: 0.5,
      enemyDensity: 0.3,
      maxEnemies: 10,
    });
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  protected getBackgroundColor(): Color4 {
    return new Color4(0.7, 0.45, 0.28, 1);
  }

  protected async createEnvironment(): Promise<void> {
    // Create canyon environment (async - loads GLB props in parallel)
    this.canyonEnv = await createCanyonEnvironment(this.scene);

    // Create factory-based terrain for the canyon floor using SurfaceTerrainFactory.
    // This provides a richer, noise-driven heightmap beneath the existing environment
    // geometry. We use a dusty-rock tint, moderate height scale suited to a vehicle
    // chase, and a large size to cover the full canyon length.
    this.factoryTerrain = createDynamicTerrain(this.scene, {
      ...ROCK_TERRAIN,
      size: 400,
      subdivisions: 80,
      heightScale: 10,
      materialName: 'canyonFloorTerrain',
      tintColor: '#9B7E5A', // dusty sandy-rock blend
      seed: 77777,
    });
    // Position the factory terrain so it spans the canyon floor.
    // The canyon runs from Z=0 to Z=-3000; the mesh is centred at origin by
    // default, so we shift it to align with the mid-section of the canyon.
    this.factoryTerrain.mesh.position.set(0, -0.5, -CANYON_LENGTH / 2);

    // Create vehicle at spawn position (async to preload GLB assets)
    const spawnPos = new Vector3(0, 2, -20);
    this.vehicle = await VehicleController.create(this.scene, this.camera, spawnPos);

    // Position camera for intro
    this.camera.position.set(5, 4, -15);
    this.camera.rotation.set(0.2, -0.3, 0);

    // Create Wraith materials (cached for reuse)
    this.wraithBodyMat = new StandardMaterial('wraith_body_mat', this.scene);
    this.wraithBodyMat.diffuseColor = Color3.FromHexString('#2A2040');
    this.wraithBodyMat.specularColor = new Color3(0.3, 0.2, 0.4);

    this.wraithGlowMat = new StandardMaterial('wraith_glow_mat', this.scene);
    this.wraithGlowMat.emissiveColor = new Color3(0.6, 0.2, 1.0);
    this.wraithGlowMat.disableLighting = true;

    // Pre-load the wraith GLB so instancing succeeds synchronously later
    await AssetManager.loadAssetByPath(WRAITH_GLB, this.scene);

    // Set up audio zones for the canyon
    this.addAudioZone('canyon_start', 'surface', { x: 0, y: 0, z: 0 }, 200, {
      isIndoor: false,
      intensity: 0.7,
    });
    this.addAudioZone('canyon_bridge', 'surface', { x: 0, y: 0, z: BRIDGE_Z }, 150, {
      isIndoor: false,
      intensity: 0.9,
      highThreat: true,
    });
    this.addAudioZone('canyon_extraction', 'extraction', { x: 0, y: 0, z: EXTRACTION_Z }, 100, {
      isIndoor: false,
      intensity: 1.0,
      highThreat: true,
    });

    // Set up action buttons
    this.setupActionButtons();

    // Build alien flora
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getCanyonRunFlora(), floraRoot);

    // Build collectibles
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getCanyonRunCollectibles(), collectibleRoot);

    // Start intro sequence
    this.startIntro();
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update collectibles
    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) {
        this.collectibleSystem.collect(nearby.id);
      }
    }

    switch (this.phase) {
      case 'intro':
        this.updateIntro(deltaTime);
        break;
      case 'canyon_approach':
        this.updateCanyonApproach(deltaTime);
        break;
      case 'bridge_crossing':
        this.updateBridgeCrossing(deltaTime);
        break;
      case 'final_stretch':
        this.updateFinalStretch(deltaTime);
        break;
      case 'extraction':
        this.updateExtraction(deltaTime);
        break;
      case 'complete':
        // No updates needed
        break;
    }

    // Always update vehicle (if active)
    if (this.vehicle && this.phase !== 'intro' && this.phase !== 'complete') {
      this.updateVehicleInput();
      this.vehicle.update(deltaTime, sampleTerrainHeight);
      this.updateVehicleDamageFeedback();
    }

    // Update enemies
    this.updateWraiths(deltaTime);
    this.updateProjectiles(deltaTime);

    // Update rockslides
    this.updateActiveRockslides(deltaTime);

    // Update objective markers
    this.updateObjectiveMarkers();

    // Collision detection
    this.checkCollisions();

    // Update time of day (slow progression)
    this.updateTimeOfDay(deltaTime);
  }

  protected override disposeLevel(): void {
    // Dispose flora
    for (const node of this.floraNodes) { node.dispose(false, true); }
    this.floraNodes = [];
    // Dispose collectibles
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;

    // Dispose vehicle
    this.vehicle?.dispose();
    this.vehicle = null;

    // Dispose wraiths
    for (const wraith of this.wraiths) {
      wraith.rootNode.dispose(false, true);
    }
    this.wraiths = [];

    // Dispose projectiles
    for (const proj of this.projectiles) {
      proj.mesh.dispose();
    }
    this.projectiles = [];

    // Dispose rockslides
    for (const rockslide of this.activeRockslides) {
      disposeRockslide(rockslide);
    }
    this.activeRockslides = [];

    // Dispose GLB props loaded by the environment
    if (this.canyonEnv) {
      for (const prop of this.canyonEnv.glbProps) {
        prop.dispose();
      }
    }

    // Dispose factory terrain
    if (this.factoryTerrain) {
      this.factoryTerrain.mesh.dispose();
      this.factoryTerrain.material.dispose();
      this.factoryTerrain = null;
    }

    // Dispose materials
    this.wraithBodyMat?.dispose();
    this.wraithGlowMat?.dispose();

    // Remove audio zones
    this.removeAudioZone('canyon_start');
    this.removeAudioZone('canyon_bridge');
    this.removeAudioZone('canyon_extraction');

    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);

    // Call parent dispose
    super.disposeLevel();
  }

  // ==========================================================================
  // PHASE: INTRO
  // ==========================================================================

  private startIntro(): void {
    this.phase = 'intro';
    this.phaseTime = 0;

    this.callbacks.onChapterChange(this.config.chapter);
    this.callbacks.onObjectiveUpdate(
      'REACH FOB DELTA',
      'Board the vehicle and drive through the canyon.'
    );

    // Intro comms
    this.sendComms('intro', COMMS.intro);

    // Cinematic start
    this.callbacks.onCinematicStart?.();
  }

  private updateIntro(deltaTime: number): void {
    // Pan camera toward vehicle during intro
    if (this.phaseTime < 3.0) {
      const t = this.phaseTime / 3.0;
      this.camera.position.x = 5 * (1 - t);
      this.camera.position.y = 4 - t * 1.5;
      this.camera.position.z = -15 + t * 5;
      this.camera.rotation.y = -0.3 * (1 - t);
    } else if (this.phaseTime >= 3.0 && !this.commsPlayed.has('vehicleReady')) {
      this.sendComms('vehicleReady', COMMS.vehicleReady);

      // Transition to driving
      this.callbacks.onCinematicEnd?.();
      this.transitionToPhase('canyon_approach');
    }
  }

  // ==========================================================================
  // PHASE: CANYON APPROACH
  // ==========================================================================

  private updateCanyonApproach(deltaTime: number): void {
    if (!this.vehicle) return;

    const playerZ = this.vehicle.getPosition().z;

    // Rockslide trigger
    if (playerZ <= ROCKSLIDE_TRIGGER_Z && !this.rockslideTriggered) {
      this.rockslideTriggered = true;
      this.sendComms('rockslideWarning', COMMS.rockslideWarning);
      this.triggerRockslide(ROCKSLIDE_TRIGGER_Z);
    }

    // First Wraith spawn
    if (playerZ <= WRAITH_SPAWN_Z && !this.wraithsSpawned) {
      this.wraithsSpawned = true;
      this.sendComms('wraithContact', COMMS.wraithContact);
      this.setCombatState(true);
      this.spawnWraith(2); // Spawn 2 wraiths initially
    }

    // Transition to bridge crossing when approaching bridge
    if (playerZ <= BRIDGE_APPROACH_Z) {
      this.transitionToPhase('bridge_crossing');
    }
  }

  // ==========================================================================
  // PHASE: BRIDGE CROSSING
  // ==========================================================================

  private updateBridgeCrossing(deltaTime: number): void {
    if (!this.vehicle) return;

    const playerZ = this.vehicle.getPosition().z;

    // Warn about bridge
    if (this.phaseTime < 0.5) {
      this.sendComms('bridgeApproach', COMMS.bridgeApproach);
    }

    // Trigger bridge collapse when player is on the bridge
    if (playerZ <= BRIDGE_COLLAPSE_Z && !this.bridgeCollapseTriggered) {
      this.bridgeCollapseTriggered = true;
      this.sendComms('bridgeCollapse', COMMS.bridgeCollapse);

      // Collapse the main bridge
      if (this.canyonEnv) {
        const mainBridge = this.canyonEnv.bridges.find((b) => b.isCollapsible);
        if (mainBridge) {
          collapseBridge(mainBridge, this.scene);
        }
      }

      // Trigger camera shake
      this.triggerShake(6);
      this.playSound('explosion');

      // Spawn a rockslide at the bridge for drama
      this.triggerRockslide(BRIDGE_Z);
    }

    // Transition to final stretch after clearing the bridge
    if (playerZ <= BRIDGE_Z - 80) {
      this.transitionToPhase('final_stretch');
    }
  }

  // ==========================================================================
  // PHASE: FINAL STRETCH
  // ==========================================================================

  private updateFinalStretch(deltaTime: number): void {
    if (!this.vehicle) return;

    const playerZ = this.vehicle.getPosition().z;

    // Comms for final stretch start
    if (this.phaseTime < 0.5) {
      this.sendComms('finalStretch', COMMS.finalStretch);
    }

    // Spawn more wraiths
    if (playerZ <= FINAL_WRAITH_SPAWN_Z && !this.finalWraithsSpawned) {
      this.finalWraithsSpawned = true;
      this.sendComms('moreWraiths', COMMS.moreWraiths);
      this.spawnWraith(2); // Spawn 2 more (up to 4 total)
    }

    // Additional rockslides in the final stretch
    if (playerZ <= -2200 && !this.commsPlayed.has('rockslide2')) {
      this.commsPlayed.add('rockslide2');
      this.triggerRockslide(-2200);
      this.triggerShake(4);
    }

    // Near extraction comms
    if (playerZ <= EXTRACTION_Z + 200 && !this.commsPlayed.has('nearExtraction')) {
      this.sendComms('nearExtraction', COMMS.nearExtraction);
    }

    // Check if player reached extraction zone
    if (playerZ <= EXTRACTION_Z + 15) {
      this.transitionToPhase('extraction');
    }
  }

  // ==========================================================================
  // PHASE: EXTRACTION
  // ==========================================================================

  private updateExtraction(deltaTime: number): void {
    if (this.extractionReached) return;
    this.extractionReached = true;

    this.sendComms('extracted', COMMS.extracted);
    this.setCombatState(false);

    this.callbacks.onObjectiveUpdate('EXTRACTION COMPLETE', 'Proceed to FOB Delta.');

    this.callbacks.onNotification('EXTRACTION POINT REACHED', 3000);

    // Complete level after a short delay
    setTimeout(() => {
      this.transitionToPhase('complete');
      this.completeLevel();
    }, 4000);
  }

  // ==========================================================================
  // PHASE TRANSITIONS
  // ==========================================================================

  private transitionToPhase(newPhase: CanyonPhase): void {
    console.log(`[CanyonRun] Phase transition: ${this.phase} -> ${newPhase}`);
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'canyon_approach':
        this.callbacks.onObjectiveUpdate(
          'REACH THE BRIDGE',
          'Drive through the canyon. Watch for obstacles.'
        );
        break;
      case 'bridge_crossing':
        this.callbacks.onObjectiveUpdate(
          'CROSS THE BRIDGE',
          'The bridge is unstable - get across fast!'
        );
        break;
      case 'final_stretch':
        this.callbacks.onObjectiveUpdate(
          'REACH EXTRACTION',
          'Enemy pursuit! Boost to the extraction point!'
        );
        break;
      case 'extraction':
        // Handled in updateExtraction
        break;
    }
  }

  // ==========================================================================
  // VEHICLE INPUT HANDLING
  // ==========================================================================

  /**
   * Override base class processMovement to route input to vehicle instead.
   */
  protected override processMovement(_deltaTime: number): void {
    // Vehicle handles its own movement - do not call super
  }

  private updateVehicleInput(): void {
    if (!this.vehicle) return;

    const input = VehicleController.buildInput(this.keys, this.touchInput);
    this.vehicle.setInput(input);
  }

  private updateVehicleDamageFeedback(): void {
    if (!this.vehicle) return;

    const health = this.vehicle.getHealth();
    const healthPct = this.vehicle.getHealthNormalized();

    // Update HUD health
    this.callbacks.onHealthChange(health);
    this.updatePlayerHealthVisual(health);

    // Damage warning at 50%
    if (healthPct < 0.5 && !this.damageWarningShown) {
      this.damageWarningShown = true;
      this.sendComms('vehicleDamage', COMMS.vehicleDamage);
    }

    // Critical warning at 25%
    if (healthPct < 0.25 && !this.criticalWarningShown) {
      this.criticalWarningShown = true;
      this.sendComms('vehicleCritical', COMMS.vehicleCritical);
    }

    // Vehicle destroyed
    if (this.vehicle.isDead()) {
      this.onPlayerDeath();
      this.callbacks.onHealthChange(0);
    }
  }

  // ==========================================================================
  // ENEMY WRAITHS
  // ==========================================================================

  private spawnWraith(count: number): void {
    if (!this.vehicle) return;

    for (let i = 0; i < count; i++) {
      if (this.wraiths.length >= this.maxWraiths) break;

      const playerPos = this.vehicle.getPosition();
      const offsetX = (Math.random() - 0.5) * CANYON_HALF_WIDTH * 0.8;
      const spawnZ = playerPos.z + WRAITH_SPAWN_DISTANCE;

      const wraith = this.createWraithMesh(new Vector3(offsetX, 2.5, spawnZ), this.wraiths.length);

      this.wraiths.push(wraith);
    }
  }

  private createWraithMesh(position: Vector3, index: number): EnemyWraith {
    const rootNode = new TransformNode(`wraith_${index}`, this.scene);
    rootNode.position = position.clone();

    // Wraith body - GLB hover-tank model (pre-loaded in createEnvironment)
    const bodyNode = AssetManager.createInstanceByPath(
      WRAITH_GLB,
      `wraith_body_${index}`,
      this.scene,
      true,
      'vehicle'
    );
    const body: TransformNode = bodyNode ?? new TransformNode(`wraith_body_fallback_${index}`, this.scene);
    body.parent = rootNode;
    body.position.y = 0;
    body.scaling.setAll(2.0);

    // Turret is part of the GLB model; create an empty node as the turret reference
    const turret = new TransformNode(`wraith_turret_${index}`, this.scene);
    turret.parent = rootNode;
    turret.position.y = 0.8;

    // Glow (hover effect) - kept as MeshBuilder (VFX)
    const glow = MeshBuilder.CreateDisc(
      `wraith_glow_${index}`,
      { radius: 2.5, tessellation: 16 },
      this.scene
    );
    glow.material = this.wraithGlowMat;
    glow.parent = rootNode;
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.8;

    return {
      rootNode,
      body,
      turret,
      glowMesh: glow,
      position: position.clone(),
      velocity: Vector3.Zero(),
      health: WRAITH_MAX_HEALTH,
      maxHealth: WRAITH_MAX_HEALTH,
      fireCooldown: WRAITH_FIRE_RATE * 0.5 + Math.random() * WRAITH_FIRE_RATE * 0.5,
      fireRate: WRAITH_FIRE_RATE,
      isActive: true,
      pursuitOffset: WRAITH_SPAWN_DISTANCE + index * 15,
    };
  }

  private updateWraiths(deltaTime: number): void {
    if (!this.vehicle) return;
    const playerPos = this.vehicle.getPosition();

    for (const wraith of this.wraiths) {
      if (!wraith.isActive) continue;

      // Target position: behind the player
      const targetZ = playerPos.z + wraith.pursuitOffset;
      const targetX = playerPos.x + Math.sin(this.phaseTime * 0.5 + wraith.pursuitOffset) * 10;

      // Move toward target
      const dx = targetX - wraith.position.x;
      const dz = targetZ - wraith.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 1) {
        const speed = Math.min(WRAITH_PURSUIT_SPEED, dist * 2);
        wraith.position.x += (dx / dist) * WRAITH_LATERAL_SPEED * deltaTime;
        wraith.position.z += (dz / dist) * speed * deltaTime;
      }

      // Clamp to canyon bounds
      wraith.position.x = Math.max(
        -CANYON_HALF_WIDTH + 3,
        Math.min(CANYON_HALF_WIDTH - 3, wraith.position.x)
      );

      // Terrain following with hover offset
      const terrainY = sampleTerrainHeight(wraith.position.x, wraith.position.z);
      wraith.position.y = terrainY + 2.5 + Math.sin(this.phaseTime * 3) * 0.3;

      // Update mesh
      wraith.rootNode.position.copyFrom(wraith.position);

      // Face the player
      const toPlayer = playerPos.subtract(wraith.position);
      wraith.rootNode.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // Hover animation on glow
      const glowScale = 0.9 + Math.sin(this.phaseTime * 5) * 0.1;
      wraith.glowMesh.scaling.set(glowScale, 1, glowScale);

      // Fire at player
      wraith.fireCooldown -= deltaTime;
      if (wraith.fireCooldown <= 0) {
        wraith.fireCooldown = wraith.fireRate + Math.random() * 0.5;
        this.fireWraithProjectile(wraith);
      }
    }
  }

  private fireWraithProjectile(wraith: EnemyWraith): void {
    if (!this.vehicle) return;

    const playerPos = this.vehicle.getPosition();
    const direction = playerPos.subtract(wraith.position).normalize();

    // Add some inaccuracy
    direction.x += (Math.random() - 0.5) * 0.15;
    direction.z += (Math.random() - 0.5) * 0.15;
    direction.normalize();

    const projectile = MeshBuilder.CreateSphere(
      `wraith_proj_${Date.now()}`,
      { diameter: 0.8, segments: 6 },
      this.scene
    );
    const projMat = new StandardMaterial(`wraith_proj_mat_${Date.now()}`, this.scene);
    projMat.emissiveColor = new Color3(0.6, 0.2, 1.0);
    projMat.disableLighting = true;
    projectile.material = projMat;
    projectile.position = wraith.position.clone();
    projectile.position.y += 1.0;

    this.projectiles.push({
      mesh: projectile,
      position: projectile.position.clone(),
      velocity: direction.scale(WRAITH_PROJECTILE_SPEED),
      lifetime: 5.0,
      damage: WRAITH_PROJECTILE_DAMAGE,
    });

    // Sound
    this.playSound('alien_attack');
  }

  private updateProjectiles(deltaTime: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifetime -= deltaTime;

      if (proj.lifetime <= 0) {
        proj.mesh.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Move projectile
      proj.position.addInPlace(proj.velocity.scale(deltaTime));
      proj.mesh.position.copyFrom(proj.position);

      // Check ground collision
      const groundY = sampleTerrainHeight(proj.position.x, proj.position.z);
      if (proj.position.y <= groundY + 0.5) {
        this.detonateProjectile(proj, i);
        continue;
      }

      // Check vehicle collision
      if (this.vehicle) {
        const vehiclePos = this.vehicle.getPosition();
        const dist = Vector3.Distance(proj.position, vehiclePos);
        if (dist < PROJECTILE_BLAST_RADIUS) {
          this.detonateProjectile(proj, i);
          // Damage vehicle
          const destroyed = this.vehicle.applyDamage(proj.damage);
          this.triggerDamageFlash(0.5);
          this.triggerShake(3);
          this.callbacks.onDamage();
          this.trackPlayerDamage(proj.damage);
        }
      }
    }
  }

  private detonateProjectile(proj: WraithProjectile, index: number): void {
    // Visual explosion
    this.triggerShake(2);
    this.playSound('explosion');

    proj.mesh.dispose();
    this.projectiles.splice(index, 1);
  }

  // ==========================================================================
  // ROCKSLIDES
  // ==========================================================================

  private triggerRockslide(zPosition: number): void {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const rocks = spawnRockslide(this.scene, side, zPosition, 15);
    this.activeRockslides.push(rocks);

    this.triggerShake(5);
    this.playSound('explosion');

    // Also trigger from other side slightly later for dramatic effect
    setTimeout(() => {
      const otherSide = side === 'left' ? 'right' : 'left';
      const moreRocks = spawnRockslide(this.scene, otherSide, zPosition - 20, 10);
      this.activeRockslides.push(moreRocks);
      this.triggerShake(4);
    }, 800);
  }

  private updateActiveRockslides(deltaTime: number): void {
    for (let i = this.activeRockslides.length - 1; i >= 0; i--) {
      const stillActive = updateRockslide(this.activeRockslides[i], deltaTime);
      if (!stillActive) {
        this.activeRockslides.splice(i, 1);
      }
    }

    // Check rock-vehicle collisions
    if (this.vehicle) {
      const vPos = this.vehicle.getPosition();
      for (const rockslide of this.activeRockslides) {
        for (const rock of rockslide) {
          if (rock.lifetime <= 0) continue;
          const dist = Vector3.Distance(vPos, rock.mesh.position);
          if (dist < PLAYER_COLLISION_RADIUS + 1.5) {
            this.vehicle.applyDamage(10);
            this.triggerDamageFlash(0.3);
            this.triggerShake(2);
            this.callbacks.onDamage();
            this.trackPlayerDamage(10);
            rock.lifetime = 0; // Prevent double-hit
            rock.mesh.dispose();
          }
        }
      }
    }
  }

  // ==========================================================================
  // COLLISION DETECTION
  // ==========================================================================

  private checkCollisions(): void {
    if (!this.vehicle || !this.canyonEnv) return;

    const vPos = this.vehicle.getPosition();

    // Canyon wall collision (bounce back)
    if (Math.abs(vPos.x) > CANYON_HALF_WIDTH - 2) {
      const pushback = Math.sign(vPos.x) * (CANYON_HALF_WIDTH - 3);
      vPos.x = pushback;
      this.vehicle.applyDamage(5);
      this.triggerShake(2);
      this.playSound('player_damage');
    }

    // Boulder collision
    for (const boulder of this.canyonEnv.boulders) {
      const dist = Vector3.Distance(
        new Vector3(vPos.x, 0, vPos.z),
        new Vector3(boulder.position.x, 0, boulder.position.z)
      );
      const boulderRadius = BOULDER_COLLISION_RADIUS * boulder.scaling.x;
      if (dist < PLAYER_COLLISION_RADIUS + boulderRadius) {
        this.vehicle.applyDamage(8);
        this.triggerDamageFlash(0.2);
        this.triggerShake(2);
        this.playSound('player_damage');
        this.callbacks.onDamage();
        this.trackPlayerDamage(8);
      }
    }
  }

  // ==========================================================================
  // OBJECTIVE MARKERS
  // ==========================================================================

  private updateObjectiveMarkers(): void {
    if (!this.vehicle || !this.canyonEnv) return;

    const playerZ = this.vehicle.getPosition().z;

    for (let i = 0; i < this.canyonEnv.objectiveMarkers.length; i++) {
      const marker = this.canyonEnv.objectiveMarkers[i];

      if (!marker.reached && playerZ <= marker.position.z + 20) {
        marker.reached = true;
        this.currentObjectiveIndex = i + 1;

        // Notification
        this.callbacks.onNotification(`${marker.label} REACHED`, 2000);

        // Dim the reached marker
        marker.mesh.isVisible = false;
        marker.beacon.intensity = 0;
      }

      // Pulse active marker beacon
      if (!marker.reached && i === this.currentObjectiveIndex) {
        marker.beacon.intensity = 1.5 + Math.sin(this.phaseTime * 4) * 0.5;
      }
    }
  }

  // ==========================================================================
  // ACTION BUTTONS
  // ==========================================================================

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
      if (actionId === 'boost') {
        // Boost is handled continuously via keyboard/touch
        // This callback is for the button press event
        this.callbacks.onNotification('BOOST ENGAGED', 1000);
      }
    };
    this.callbacks.onActionHandlerRegister(this.actionCallback);
  }

  // ==========================================================================
  // COMMS HELPER
  // ==========================================================================

  private sendComms(
    id: string,
    message: {
      sender: string;
      callsign: string;
      portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
      text: string;
    }
  ): void {
    if (this.commsPlayed.has(id)) return;
    this.commsPlayed.add(id);

    this.callbacks.onCommsMessage({
      sender: message.sender,
      callsign: message.callsign,
      portrait: message.portrait,
      text: message.text,
    });
  }

  // ==========================================================================
  // OVERRIDES
  // ==========================================================================

  override getState() {
    const state = super.getState();
    if (this.vehicle) {
      const vPos = this.vehicle.getPosition();
      state.playerPosition = { x: vPos.x, y: vPos.y, z: vPos.z };
      state.playerRotation = this.vehicle.getRotation();
    }
    state.stats = {
      kills: this.kills,
      secretsFound: getAchievementManager().getLevelSecretsFound(),
      timeSpent: this.phaseTime,
    };
    return state;
  }

  protected override getMoveSpeed(): number {
    // Vehicle handles movement; not used
    return 0;
  }
}
