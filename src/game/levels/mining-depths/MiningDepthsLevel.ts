/**
 * MiningDepthsLevel - Abandoned Underground Mining Facility
 *
 * LEVEL: THE MINING DEPTHS
 * An abandoned mining facility deep underground on LV-847.
 * The player descends into the mines to investigate missing miners
 * and discovers alien infestation spreading through the tunnels.
 *
 * SECTIONS:
 * 1. MINING HUB - Explore, find keycard to unlock deep shaft
 * 2. COLLAPSED TUNNELS - Navigate debris, environmental hazards
 * 3. DEEP SHAFT - Vertical descent, boss arena (Mining Drill Chitin)
 *
 * FEATURES:
 * - Environmental hazards: gas vents (damage), unstable ground (rockfalls),
 *   flooded sections (limited visibility)
 * - Lighting: emergency red lights, flickering fluorescents, player flashlight,
 *   glowing crystals
 * - Burrower aliens that emerge from walls
 * - Mini-boss: Mining Drill Chitin (armored variant with drill appendages)
 * - Collectible audio logs revealing what happened to the miners
 * - Comms dialogue with Reyes providing guidance
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';

// ---------------------------------------------------------------------------
// GLB Asset Paths for boss & level-specific models
// ---------------------------------------------------------------------------

const BOSS_GLB_PATHS = {
  /** Chitin alien body -- used for the Mining Drill Chitin boss */
  chitinBody: '/models/enemies/chitin/alien_scifi.glb',
  /** Industrial pipe -- stand-in for drill arm appendages */
  drillArm: '/models/environment/industrial/pipes_hr_1.glb',
  /** Lamp for boss eye glow effect */
  eyeGlow: '/models/environment/industrial/lamp_mx_1_a_on.glb',
} as const;

const ALL_BOSS_GLB_PATHS: readonly string[] = [
  ...new Set(Object.values(BOSS_GLB_PATHS)),
];

/** Unique counter for boss instance naming */
let _bossInstanceCounter = 0;
import {
  AUDIO_LOGS,
  type AudioLogPickup,
  createMiningEnvironment,
  type FlickerLightDef,
  HAZARD_ZONES,
  type HazardZone,
  MINE_POSITIONS,
  type MiningEnvironment,
} from './environment';

import '@babylonjs/core/Animations/animatable';

// ============================================================================
// Level Phase Progression
// ============================================================================

type MiningPhase =
  | 'arrival' // Player enters via broken elevator
  | 'hub_explore' // Explore mining hub, find keycard
  | 'tunnels' // Navigate collapsed tunnels
  | 'shaft_descent' // Descend the deep shaft
  | 'boss_fight' // Fight Mining Drill Chitin
  | 'boss_defeated' // Boss eliminated, level complete
  | 'exit'; // Proceed to next level

// ============================================================================
// Enemy & Boss Definitions
// ============================================================================

interface BurrowerEnemy {
  mesh: Mesh | TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  state: 'buried' | 'emerging' | 'chase' | 'attack' | 'burrow';
  attackCooldown: number;
  emergeTimer: number;
  stateTimer: number;
}

interface DrillChitinBoss {
  mesh: Mesh | TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  state: 'idle' | 'charge' | 'drill_attack' | 'burrow' | 'emerge' | 'enraged';
  attackCooldown: number;
  stateTimer: number;
  chargeTarget: Vector3 | null;
  isEnraged: boolean;
  drillActive: boolean;
}

// ============================================================================
// Area Trigger Zones
// ============================================================================

interface AreaZone {
  id: string;
  name: string;
  center: Vector3;
  radius: number;
  triggered: boolean;
}

// Burrower enemy species mapping
const BURROWER_SPECIES = 'skitterer'; // Maps to spider.glb - fits the burrower concept
const BURROWER_SCALE = 0.8;

export class MiningDepthsLevel extends BaseLevel {
  // Phase management
  private phase: MiningPhase = 'arrival';
  private phaseTime = 0;

  // Environment
  private environment: MiningEnvironment | null = null;

  // Lighting
  private caveAmbient: HemisphericLight | null = null;
  private flashlight: SpotLight | null = null;
  private flashlightFill: PointLight | null = null;
  private flashlightOn = false;

  // Atmospheric effects
  private dustParticles: Mesh[] = [];
  private fogDensity = 0.015;
  private lastDustSpawn = 0;

  // Area zones
  private areaZones: AreaZone[] = [];

  // Objectives
  private objectiveMarker: Mesh | null = null;
  private currentObjective: Vector3 | null = null;

  // Keycard
  private hasKeycard = false;
  private shaftGateOpen = false;

  // Audio logs
  private audioLogs: AudioLogPickup[] = [];
  private audioLogsCollected = 0;

  // Hazards
  private hazardZones: HazardZone[] = [];
  private hazardDamageAccumulator: Map<string, number> = new Map();
  private playerInFlood = false;

  // Enemies - Burrowers
  private burrowers: BurrowerEnemy[] = [];
  private burrowerSpawnQueue: Vector3[] = [];
  private burrowerEnemiesPreloaded = false;
  private readonly MAX_BURROWERS = 8;
  private activeEnemyCount = 0;

  // Boss - Mining Drill Chitin
  private boss: DrillChitinBoss | null = null;
  private bossDefeated = false;
  private bossAssetsPreloaded = false;
  /** GLB instance roots for the boss (for disposal) */
  private bossGlbInstances: TransformNode[] = [];

  // Combat state
  private meleeCooldown = 0;
  private primaryFireCooldown = 0;
  private readonly MELEE_DAMAGE = 50;
  private readonly MELEE_RANGE = 3;
  private readonly MELEE_COOLDOWN = 800;
  private readonly PRIMARY_FIRE_DAMAGE = 25;
  private readonly PRIMARY_FIRE_RANGE = 50;
  private readonly PRIMARY_FIRE_COOLDOWN = 150;

  // Kill tracking
  private killCount = 0;

  // Action button callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Comms message flags
  private messageFlags: Set<string> = new Set();

  // Player health (local tracking for hazard damage)
  private playerHealth = 100;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    // Very dark underground - near black with slight blue tint
    return new Color4(0.002, 0.002, 0.005, 1);
  }

  /**
   * Override FOV for claustrophobic underground feel.
   * Narrower FOV creates tension in tight tunnels.
   */
  protected override getDefaultFOV(): number {
    // 65 degrees in radians - narrower for claustrophobic feel
    return (65 * Math.PI) / 180;
  }

  // ==========================================================================
  // ENVIRONMENT SETUP
  // ==========================================================================

  protected async createEnvironment(): Promise<void> {
    // Initialize subsystems
    AssetManager.init(this.scene);
    particleManager.init(this.scene);
    damageFeedback.init(this.scene);
    damageFeedback.setScreenShakeCallback((intensity) => this.triggerShake(intensity));

    // Set up underground lighting
    this.setupCaveLighting();

    // Create full environment (async - loads GLB assets)
    this.environment = await createMiningEnvironment(this.scene);

    // Create player flashlight
    this.createFlashlight();

    // Create objective marker
    this.createObjectiveMarker();

    // Initialize audio logs (copy to allow mutation of collected state)
    this.audioLogs = AUDIO_LOGS.map((log) => ({ ...log }));

    // Initialize hazard zones
    this.hazardZones = HAZARD_ZONES.map((hz) => ({ ...hz }));

    // Set up area triggers
    this.setupAreaZones();

    // Preload burrower enemy models
    await this.preloadBurrowerModels();

    // Preload boss GLB assets
    await this.preloadBossModels();

    // Set up environmental audio
    this.setupMiningAudio();

    // Start the level
    this.startLevel();
  }

  private setupCaveLighting(): void {
    // Disable base level lights - we're underground
    if (this.sunLight) {
      this.sunLight.intensity = 0;
      this.sunLight.setEnabled(false);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0;
      this.ambientLight.setEnabled(false);
    }

    // Very dark cave ambient - barely visible without flashlight
    this.caveAmbient = new HemisphericLight('caveAmbient', new Vector3(0, 1, 0), this.scene);
    this.caveAmbient.intensity = 0.04; // Reduced for darker feel
    this.caveAmbient.diffuse = new Color3(0.08, 0.06, 0.05);
    this.caveAmbient.groundColor = new Color3(0.02, 0.02, 0.03);

    // Enable exponential fog for atmospheric depth
    this.scene.fogMode = 3; // FOGMODE_EXP2
    this.scene.fogDensity = this.fogDensity;
    this.scene.fogColor = new Color3(0.01, 0.01, 0.015);

    // Disable skybox - we're underground
    this.scene.environmentTexture = null;
  }

  private createFlashlight(): void {
    // Primary flashlight - SpotLight for directional beam
    // Position will be updated every frame to follow camera
    const forward = new Vector3(0, 0, 1);
    this.flashlight = new SpotLight(
      'flashlight',
      new Vector3(0, 0, 0), // Position (updated in update loop)
      forward, // Direction (updated in update loop)
      Math.PI / 4, // Angle - 45 degree cone
      2, // Exponent - controls falloff softness
      this.scene
    );
    this.flashlight.diffuse = new Color3(1, 0.98, 0.9); // Slightly warm white
    this.flashlight.specular = new Color3(0.5, 0.5, 0.5);
    this.flashlight.intensity = 0; // Off by default
    this.flashlight.range = 35; // Increased range for better visibility

    // Fill light - subtle PointLight for ambient around player
    this.flashlightFill = new PointLight('flashlightFill', new Vector3(0, 0, 0), this.scene);
    this.flashlightFill.diffuse = new Color3(0.6, 0.55, 0.5);
    this.flashlightFill.intensity = 0;
    this.flashlightFill.range = 8;
  }

  private createObjectiveMarker(): void {
    this.objectiveMarker = MeshBuilder.CreateTorus(
      'objectiveMarker',
      { diameter: 2, thickness: 0.1, tessellation: 32 },
      this.scene
    );
    this.objectiveMarker.rotation.x = Math.PI / 2;

    const markerMat = new StandardMaterial('markerMat', this.scene);
    markerMat.emissiveColor = Color3.FromHexString('#FFD700');
    markerMat.alpha = 0.6;
    this.objectiveMarker.material = markerMat;
    this.objectiveMarker.isVisible = false;
  }

  private setupAreaZones(): void {
    this.areaZones = [
      {
        id: 'entry',
        name: 'Entry Elevator',
        center: MINE_POSITIONS.entry.clone(),
        radius: 8,
        triggered: false,
      },
      {
        id: 'hub',
        name: 'Mining Hub',
        center: MINE_POSITIONS.hubCenter.clone(),
        radius: 20,
        triggered: false,
      },
      {
        id: 'hub_keycard',
        name: 'Keycard Location',
        center: MINE_POSITIONS.hubKeycard.clone(),
        radius: 4,
        triggered: false,
      },
      {
        id: 'tunnel_start',
        name: 'Collapsed Tunnels',
        center: MINE_POSITIONS.tunnelStart.clone(),
        radius: 8,
        triggered: false,
      },
      {
        id: 'tunnel_mid',
        name: 'Tunnel Junction',
        center: MINE_POSITIONS.tunnelMid.clone(),
        radius: 8,
        triggered: false,
      },
      {
        id: 'tunnel_end',
        name: 'Tunnel Exit',
        center: MINE_POSITIONS.tunnelEnd.clone(),
        radius: 8,
        triggered: false,
      },
      {
        id: 'shaft_gate',
        name: 'Deep Shaft Gate',
        center: new Vector3(-10, -13, -110),
        radius: 5,
        triggered: false,
      },
      {
        id: 'shaft',
        name: 'Deep Shaft',
        center: MINE_POSITIONS.shaftCenter.clone(),
        radius: 15,
        triggered: false,
      },
      {
        id: 'shaft_floor',
        name: 'Shaft Floor',
        center: MINE_POSITIONS.shaftFloor.clone(),
        radius: 12,
        triggered: false,
      },
    ];
  }

  private async preloadBurrowerModels(): Promise<void> {
    const assetName = SPECIES_TO_ASSET[BURROWER_SPECIES];
    if (!assetName) {
      console.warn('[MiningDepths] No asset mapping for burrower species');
      return;
    }

    try {
      await AssetManager.loadAsset('aliens', assetName, this.scene);
      this.burrowerEnemiesPreloaded = true;
      console.log(`[MiningDepths] Preloaded burrower GLB: ${assetName}`);
    } catch (error) {
      console.warn('[MiningDepths] Failed to preload burrower GLB:', error);
      this.burrowerEnemiesPreloaded = false;
    }
  }

  /**
   * Preload GLB assets used by the boss enemy.
   */
  private async preloadBossModels(): Promise<void> {
    const loadPromises = ALL_BOSS_GLB_PATHS.map((path) =>
      AssetManager.loadAssetByPath(path, this.scene).catch((err) => {
        console.warn(`[MiningDepths] Failed to preload boss GLB ${path}:`, err);
        return null;
      })
    );
    await Promise.all(loadPromises);
    this.bossAssetsPreloaded = true;
    console.log(`[MiningDepths] Preloaded ${ALL_BOSS_GLB_PATHS.length} boss GLB assets`);
  }

  private setupMiningAudio(): void {
    // =========================================================================
    // WATER DRIPS - scattered throughout for eerie ambiance
    // =========================================================================
    this.addSpatialSound(
      'drip_hub_1',
      'dripping',
      { x: -15, y: 2, z: -20 },
      { maxDistance: 12, volume: 0.3, interval: 3000 }
    );
    this.addSpatialSound(
      'drip_hub_2',
      'dripping',
      { x: 12, y: 3, z: -28 },
      { maxDistance: 10, volume: 0.25, interval: 4500 }
    );
    this.addSpatialSound(
      'drip_tunnel_1',
      'dripping',
      { x: -12, y: -5, z: -70 },
      { maxDistance: 10, volume: 0.35, interval: 4000 }
    );
    this.addSpatialSound(
      'drip_tunnel_2',
      'dripping',
      { x: -8, y: -8, z: -85 },
      { maxDistance: 8, volume: 0.4, interval: 2500 }
    );
    this.addSpatialSound(
      'drip_shaft',
      'dripping',
      { x: -5, y: -20, z: -125 },
      { maxDistance: 15, volume: 0.3, interval: 3500 }
    );

    // =========================================================================
    // CREAKING SUPPORTS - structural stress sounds
    // =========================================================================
    this.addSpatialSound(
      'creak_hub_1',
      'debris_settling',
      { x: 10, y: 4, z: -25 },
      { maxDistance: 15, volume: 0.4, interval: 8000 }
    );
    this.addSpatialSound(
      'creak_hub_2',
      'debris_settling',
      { x: -18, y: 5, z: -32 },
      { maxDistance: 12, volume: 0.35, interval: 10000 }
    );
    this.addSpatialSound(
      'creak_tunnel_1',
      'debris_settling',
      { x: -8, y: -3, z: -60 },
      { maxDistance: 12, volume: 0.5, interval: 6000 }
    );
    this.addSpatialSound(
      'creak_tunnel_2',
      'debris_settling',
      { x: -15, y: -7, z: -82 },
      { maxDistance: 10, volume: 0.45, interval: 7500 }
    );
    this.addSpatialSound(
      'creak_shaft_1',
      'debris_settling',
      { x: -10, y: -15, z: -120 },
      { maxDistance: 18, volume: 0.45, interval: 7000 }
    );
    this.addSpatialSound(
      'creak_shaft_2',
      'debris_settling',
      { x: -18, y: -25, z: -130 },
      { maxDistance: 20, volume: 0.5, interval: 9000 }
    );

    // =========================================================================
    // WIND AND ATMOSPHERE
    // =========================================================================
    this.addSpatialSound(
      'wind_entry',
      'wind_howl',
      { x: 0, y: 3, z: 0 },
      { maxDistance: 20, volume: 0.25 }
    );
    this.addSpatialSound(
      'wind_tunnel',
      'wind_howl',
      { x: -10, y: -5, z: -65 },
      { maxDistance: 15, volume: 0.2 }
    );

    // =========================================================================
    // MACHINERY - abandoned but not fully dead
    // =========================================================================
    this.addSpatialSound(
      'machinery_hub',
      'machinery',
      { x: 8, y: 1, z: -20 },
      { maxDistance: 12, volume: 0.2 }
    );
    this.addSpatialSound(
      'electrical_hub',
      'electrical_panel',
      { x: -12, y: 2, z: -18 },
      { maxDistance: 8, volume: 0.15 }
    );
    this.addSpatialSound(
      'vent_tunnel',
      'vent',
      { x: -5, y: -2, z: -55 },
      { maxDistance: 10, volume: 0.3 }
    );

    // =========================================================================
    // GAS VENTS - warning sounds near hazards
    // =========================================================================
    this.addSpatialSound(
      'gas_vent_1',
      'vent',
      { x: -5, y: 0, z: -55 },
      { maxDistance: 8, volume: 0.4 }
    );
    this.addSpatialSound(
      'gas_vent_2',
      'vent',
      { x: -18, y: -5, z: -80 },
      { maxDistance: 6, volume: 0.5 }
    );

    // =========================================================================
    // DISTANT RUMBLES - deep underground atmosphere
    // =========================================================================
    this.addSpatialSound(
      'rumble_deep_1',
      'debris_settling',
      { x: 0, y: -30, z: -100 },
      { maxDistance: 50, volume: 0.2, interval: 15000 }
    );
    this.addSpatialSound(
      'rumble_deep_2',
      'debris_settling',
      { x: -20, y: -35, z: -140 },
      { maxDistance: 60, volume: 0.25, interval: 20000 }
    );

    // =========================================================================
    // AUDIO ZONES - environmental transitions
    // =========================================================================
    this.addAudioZone('zone_entry', 'station', { x: 0, y: 0, z: 0 }, 15, {
      isIndoor: true,
      intensity: 0.3,
    });
    this.addAudioZone('zone_hub', 'station', { x: 0, y: 0, z: -25 }, 25, {
      isIndoor: true,
      intensity: 0.5,
    });
    this.addAudioZone('zone_tunnels', 'hive', { x: -10, y: -5, z: -70 }, 30, {
      isIndoor: true,
      intensity: 0.6,
      highThreat: true,
    });
    this.addAudioZone('zone_shaft', 'hive', { x: -10, y: -15, z: -120 }, 25, {
      isIndoor: true,
      intensity: 0.8,
      highThreat: true,
    });
    this.addAudioZone('zone_boss', 'hive', { x: -10, y: -30, z: -120 }, 15, {
      isIndoor: true,
      intensity: 1.0,
      highThreat: true,
    });
  }

  // ==========================================================================
  // LEVEL START & PHASE MANAGEMENT
  // ==========================================================================

  private startLevel(): void {
    this.phase = 'arrival';
    this.phaseTime = 0;

    // Register action handler
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Set initial UI
    this.updateActionButtons();
    this.callbacks.onNotification('THE MINING DEPTHS - LV-847', 3000);
    this.callbacks.onObjectiveUpdate(
      'INVESTIGATE THE MINES',
      'Explore the abandoned mining facility. Find a way deeper.'
    );

    // Initial Reyes comms
    setTimeout(() => {
      this.sendCommsMessage('arrival_1', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Sergeant, you are entering the LV-847 mining complex. Last contact with the miners was eighteen days ago. Their final transmission mentioned something in the walls. Stay sharp.',
      });
    }, 2000);

    setTimeout(() => {
      this.sendCommsMessage('arrival_2', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'The elevator is destroyed. You will need to find another way through. I am detecting a faint power signature deeper in. Head for the Mining Hub.',
      });
    }, 7000);

    this.setObjective(MINE_POSITIONS.hubCenter);
  }

  private transitionToPhase(newPhase: MiningPhase): void {
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'hub_explore':
        this.callbacks.onObjectiveUpdate(
          'EXPLORE THE MINING HUB',
          'Search for a keycard to access the deep shaft. Check audio logs.'
        );
        this.setObjective(MINE_POSITIONS.hubKeycard);

        // Spawn first burrower encounter
        setTimeout(() => {
          this.spawnBurrower(MINE_POSITIONS.burrowerSpawn1.clone());
        }, 5000);
        break;

      case 'tunnels':
        this.callbacks.onObjectiveUpdate(
          'NAVIGATE COLLAPSED TUNNELS',
          'Find a path through the cave-ins. Watch for hazards.'
        );
        this.setObjective(MINE_POSITIONS.tunnelEnd);

        this.sendCommsMessage('tunnels_enter', {
          sender: 'Lt. Reyes',
          callsign: 'REYES',
          portrait: 'commander',
          text: 'These tunnels are unstable. I am detecting gas pockets and structural weaknesses. Move carefully and watch your footing.',
        });

        // Spawn burrowers in tunnels
        this.burrowerSpawnQueue.push(
          MINE_POSITIONS.burrowerSpawn2.clone(),
          MINE_POSITIONS.burrowerSpawn3.clone()
        );
        break;

      case 'shaft_descent':
        this.callbacks.onObjectiveUpdate(
          'DESCEND THE DEEP SHAFT',
          'Use the ledges to reach the bottom. Something is down there.'
        );
        this.setObjective(MINE_POSITIONS.shaftFloor);

        this.sendCommsMessage('shaft_enter', {
          sender: 'Lt. Reyes',
          callsign: 'REYES',
          portrait: 'commander',
          text: 'Massive vertical shaft. The crystal formations are... biological. They are pulsing. Be ready for anything, Sergeant.',
        });

        // Spawn burrowers on ledges
        this.burrowerSpawnQueue.push(
          MINE_POSITIONS.burrowerSpawn4.clone(),
          MINE_POSITIONS.burrowerSpawn5.clone()
        );
        break;

      case 'boss_fight':
        this.startBossFight();
        break;

      case 'boss_defeated':
        this.onBossDefeated();
        break;

      case 'exit':
        this.callbacks.onObjectiveUpdate('LEVEL COMPLETE', 'The mining facility has been cleared.');
        this.clearObjective();
        break;
    }
  }

  // ==========================================================================
  // UPDATE LOOP
  // ==========================================================================

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update damage feedback
    damageFeedback.update(deltaTime);
    damageFeedback.setCameraPosition(this.camera.position);

    // Update flashlight position and direction
    this.updateFlashlightTransform();

    // Update dust particles for atmosphere
    this.updateDustParticles(deltaTime);

    // Update fog density based on location (thicker in deeper areas)
    this.updateFogDensity();

    // Update flickering lights
    this.updateFlickerLights(deltaTime);

    // Check area triggers
    this.checkAreaTriggers();

    // Check hazard zones
    this.checkHazards(deltaTime);

    // Check audio log pickups
    this.checkAudioLogPickups();

    // Check keycard pickup
    this.checkKeycardPickup();

    // Update burrower spawn queue
    this.processBurrowerQueue();

    // Update enemies
    this.updateBurrowers(deltaTime);

    // Update boss
    if (this.boss) {
      this.updateBoss(deltaTime);
    }

    // Update combat cooldowns
    if (this.meleeCooldown > 0) {
      this.meleeCooldown -= deltaTime * 1000;
    }
    if (this.primaryFireCooldown > 0) {
      this.primaryFireCooldown -= deltaTime * 1000;
    }

    // Animate objective marker
    if (this.objectiveMarker?.isVisible) {
      this.objectiveMarker.rotation.y += deltaTime * 2;
      const pulse = 0.4 + Math.sin(performance.now() * 0.003) * 0.2;
      (this.objectiveMarker.material as StandardMaterial).alpha = pulse;
    }

    // Update action buttons
    this.updateActionButtons();

    // Keep player at appropriate eye height (varies by section)
    this.constrainPlayerPosition();
  }

  private constrainPlayerPosition(): void {
    const pos = this.camera.position;

    // Calculate expected ground height based on section
    let groundY = 0;
    if (pos.z < -95 && pos.z > -115) {
      // Transition tunnel - interpolate
      const t = (pos.z + 115) / 20;
      groundY = -15 + t * 5; // -15 to -10
    } else if (pos.z <= -115) {
      // Deep shaft area
      groundY = -15 - 15 + 1; // Shaft floor
    } else if (pos.z < -50) {
      // Collapsed tunnels - gradual descent
      const t = (pos.z + 95) / 45;
      groundY = -10 + t * 10; // -10 to 0
    }

    // Eye height above ground
    pos.y = groundY + 1.7;
  }

  // ==========================================================================
  // FLASHLIGHT SYSTEM
  // ==========================================================================

  private updateFlashlightTransform(): void {
    if (!this.flashlight) return;

    // Position flashlight at camera (player's hand/helmet)
    this.flashlight.position.copyFrom(this.camera.position);
    // Slight offset down and forward for hand-held feel
    this.flashlight.position.y -= 0.3;

    // Direction follows camera look direction
    const forward = this.camera.getDirection(Vector3.Forward());
    this.flashlight.direction = forward;

    // Update fill light position
    if (this.flashlightFill) {
      this.flashlightFill.position.copyFrom(this.camera.position);
    }
  }

  // ==========================================================================
  // ATMOSPHERIC DUST PARTICLES
  // ==========================================================================

  private updateDustParticles(deltaTime: number): void {
    const now = performance.now();

    // Spawn new dust particles periodically
    if (now - this.lastDustSpawn > 200 && this.dustParticles.length < 30) {
      this.lastDustSpawn = now;
      this.spawnDustParticle();
    }

    // Update existing particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dust = this.dustParticles[i];
      if (!dust || dust.isDisposed()) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      // Slow drift
      dust.position.y -= deltaTime * 0.3;
      dust.position.x += Math.sin(now * 0.001 + i) * deltaTime * 0.1;

      // Fade out and remove when too low
      const material = dust.material as StandardMaterial;
      if (material) {
        material.alpha -= deltaTime * 0.1;
        if (material.alpha <= 0) {
          material.dispose();
          dust.dispose();
          this.dustParticles.splice(i, 1);
        }
      }
    }
  }

  private spawnDustParticle(): void {
    const playerPos = this.camera.position;

    // Spawn in visible area around player
    const offset = new Vector3(
      (Math.random() - 0.5) * 10,
      Math.random() * 3 + 1,
      (Math.random() - 0.5) * 10
    );
    const spawnPos = playerPos.add(offset);

    const dust = MeshBuilder.CreatePlane(
      `dust_${this.dustParticles.length}`,
      { size: 0.03 + Math.random() * 0.02 },
      this.scene
    );
    dust.position = spawnPos;
    dust.billboardMode = 7; // BILLBOARDMODE_ALL

    const mat = new StandardMaterial(`dustMat_${this.dustParticles.length}`, this.scene);
    mat.diffuseColor = new Color3(0.6, 0.55, 0.5);
    mat.emissiveColor = new Color3(0.1, 0.08, 0.06);
    mat.alpha = 0.3 + Math.random() * 0.3;
    mat.disableLighting = true;
    dust.material = mat;

    this.dustParticles.push(dust);
  }

  // ==========================================================================
  // FOG SYSTEM
  // ==========================================================================

  private updateFogDensity(): void {
    const playerZ = this.camera.position.z;
    const playerY = this.camera.position.y;

    // Increase fog density as player goes deeper
    let baseDensity = 0.012;

    if (playerZ < -50) {
      // In collapsed tunnels - more fog
      baseDensity = 0.018;
    }
    if (playerZ < -100) {
      // Near shaft - even more fog
      baseDensity = 0.022;
    }
    if (playerY < -15) {
      // Deep shaft floor - thickest fog
      baseDensity = 0.028;
    }

    // In flooded area - reduced visibility
    if (this.playerInFlood) {
      baseDensity = 0.04;
    }

    // Smooth transition
    this.fogDensity += (baseDensity - this.fogDensity) * 0.02;
    this.scene.fogDensity = this.fogDensity;
  }

  // ==========================================================================
  // FLICKER LIGHTS
  // ==========================================================================

  private updateFlickerLights(deltaTime: number): void {
    if (!this.environment) return;

    for (const fl of this.environment.flickerLights) {
      fl.timer += deltaTime * fl.flickerSpeed;

      if (fl.isOff) {
        fl.offTimer += deltaTime;
        if (fl.offTimer >= fl.offDuration) {
          fl.isOff = false;
          fl.offTimer = 0;
        }
        fl.light.intensity = 0;
      } else {
        // Random chance to turn off
        if (Math.random() < 0.002 * fl.flickerAmount) {
          fl.isOff = true;
          fl.offDuration = 0.1 + Math.random() * 0.5;
        }

        const noise = Math.sin(fl.timer) * Math.sin(fl.timer * 2.3) * Math.sin(fl.timer * 0.7);
        fl.light.intensity = fl.baseIntensity + noise * fl.flickerAmount * fl.baseIntensity;
        fl.light.intensity = Math.max(0, fl.light.intensity);
      }
    }
  }

  // ==========================================================================
  // AREA TRIGGERS
  // ==========================================================================

  private checkAreaTriggers(): void {
    const playerPos = this.camera.position;

    for (const zone of this.areaZones) {
      if (zone.triggered) continue;

      const dist = Vector3.Distance(
        new Vector3(playerPos.x, 0, playerPos.z),
        new Vector3(zone.center.x, 0, zone.center.z)
      );

      if (dist < zone.radius) {
        zone.triggered = true;
        this.onEnterArea(zone.id);
      }
    }
  }

  private onEnterArea(areaId: string): void {
    switch (areaId) {
      case 'entry':
        // Already handled in startLevel
        break;

      case 'hub':
        if (this.phase === 'arrival') {
          this.transitionToPhase('hub_explore');
        }
        break;

      case 'hub_keycard':
        if (!this.hasKeycard) {
          this.sendCommsMessage('keycard_near', {
            sender: 'Lt. Reyes',
            callsign: 'REYES',
            portrait: 'commander',
            text: 'I am detecting an access card nearby. That should unlock the deep shaft security gate.',
          });
        }
        break;

      case 'tunnel_start':
        if (this.phase === 'hub_explore' && this.hasKeycard) {
          this.transitionToPhase('tunnels');
        }
        break;

      case 'tunnel_mid':
        this.sendCommsMessage('tunnel_mid', {
          sender: 'Lt. Reyes',
          callsign: 'REYES',
          portrait: 'commander',
          text: 'Midway through. The alien bio-signature is getting stronger. Those crystal formations are responding to your presence.',
        });
        break;

      case 'tunnel_end':
        this.sendCommsMessage('tunnel_end', {
          sender: 'Lt. Reyes',
          callsign: 'REYES',
          portrait: 'commander',
          text: 'Almost through. The deep shaft should be just ahead. Use the keycard on the security gate.',
        });
        break;

      case 'shaft_gate':
        if (this.hasKeycard && !this.shaftGateOpen) {
          this.callbacks.onNotification('PRESS E TO USE KEYCARD', 2000);
        }
        break;

      case 'shaft':
        if (this.shaftGateOpen && this.phase === 'tunnels') {
          this.transitionToPhase('shaft_descent');
        }
        break;

      case 'shaft_floor':
        if (this.phase === 'shaft_descent' && !this.bossDefeated) {
          this.transitionToPhase('boss_fight');
        }
        break;
    }
  }

  // ==========================================================================
  // HAZARD SYSTEM
  // ==========================================================================

  private checkHazards(deltaTime: number): void {
    const playerPos = this.camera.position;
    this.playerInFlood = false;

    for (const hazard of this.hazardZones) {
      if (!hazard.active) continue;

      const dist = Vector3.Distance(
        new Vector3(playerPos.x, 0, playerPos.z),
        new Vector3(hazard.center.x, 0, hazard.center.z)
      );

      if (dist < hazard.radius) {
        switch (hazard.type) {
          case 'gas_vent': {
            // Accumulate damage
            const accum = (this.hazardDamageAccumulator.get(hazard.id) ?? 0) + deltaTime;
            this.hazardDamageAccumulator.set(hazard.id, accum);

            if (accum >= 1.0) {
              this.hazardDamageAccumulator.set(hazard.id, 0);
              this.callbacks.onHealthChange(-hazard.damage);
              this.playerHealth -= hazard.damage;
              this.trackPlayerDamage(hazard.damage);
              this.triggerDamageFlash(0.3);
              this.callbacks.onNotification('TOXIC GAS!', 500);
            }
            break;
          }
          case 'unstable_ground': {
            // One-time rockfall trigger
            const accum = this.hazardDamageAccumulator.get(hazard.id) ?? 0;
            if (accum === 0) {
              this.hazardDamageAccumulator.set(hazard.id, 1);
              this.callbacks.onHealthChange(-hazard.damage);
              this.playerHealth -= hazard.damage;
              this.trackPlayerDamage(hazard.damage);
              this.triggerDamageFlash(0.5);
              this.triggerShake(5);
              this.callbacks.onNotification('ROCKFALL!', 1000);
              this.playSound('explosion');
              // Disable after triggering
              hazard.active = false;
            }
            break;
          }
          case 'flooded': {
            this.playerInFlood = true;
            // No damage, just reduced visibility notification once
            const accum = this.hazardDamageAccumulator.get(hazard.id) ?? 0;
            if (accum === 0) {
              this.hazardDamageAccumulator.set(hazard.id, 1);
              this.callbacks.onNotification('FLOODED SECTION - LIMITED VISIBILITY', 2000);
            }
            break;
          }
        }
      } else {
        // Reset accumulator when leaving area
        if (hazard.type === 'gas_vent') {
          this.hazardDamageAccumulator.set(hazard.id, 0);
        }
      }
    }
  }

  // ==========================================================================
  // AUDIO LOG PICKUPS
  // ==========================================================================

  private checkAudioLogPickups(): void {
    const playerPos = this.camera.position;

    for (let i = 0; i < this.audioLogs.length; i++) {
      const log = this.audioLogs[i];
      if (log.collected) continue;

      const dist = Vector3.Distance(playerPos, log.position);
      if (dist < 2.5) {
        this.collectAudioLog(log, i);
      }
    }
  }

  private collectAudioLog(log: AudioLogPickup, index: number): void {
    log.collected = true;
    this.audioLogsCollected++;

    // Hide pickup mesh
    if (this.environment && index < this.environment.audioLogMeshes.length) {
      this.environment.audioLogMeshes[index].isVisible = false;
    }

    this.playSound('notification');
    this.callbacks.onNotification(`AUDIO LOG: ${log.title}`, 3000);

    // Play the log as a comms message
    setTimeout(() => {
      this.sendCommsMessage(`audio_log_${log.id}`, {
        sender: 'Audio Log',
        callsign: log.title,
        portrait: 'ai',
        text: log.text,
      });
    }, 1500);

    // Achievement tracking
    getAchievementManager().onSecretFound();
  }

  // ==========================================================================
  // KEYCARD & GATE
  // ==========================================================================

  private checkKeycardPickup(): void {
    if (this.hasKeycard) return;
    if (!this.environment) return;

    const dist = Vector3.Distance(this.camera.position, MINE_POSITIONS.hubKeycard);

    if (dist < 2) {
      this.pickupKeycard();
    }
  }

  private pickupKeycard(): void {
    this.hasKeycard = true;

    // Hide keycard mesh
    if (this.environment) {
      this.environment.keycardPickup.isVisible = false;
    }

    this.playSound('notification');
    this.callbacks.onNotification('DEEP SHAFT ACCESS KEYCARD ACQUIRED', 2000);

    setTimeout(() => {
      this.sendCommsMessage('keycard_found', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Good, you have the access card. Head south through the tunnels to reach the deep shaft. That is where the strongest bio-signatures are coming from.',
      });

      this.callbacks.onObjectiveUpdate(
        'REACH THE DEEP SHAFT',
        'Navigate the collapsed tunnels to the deep shaft gate.'
      );
      this.setObjective(new Vector3(-10, -13, -110));
    }, 2000);
  }

  private openShaftGate(): void {
    if (!this.hasKeycard || this.shaftGateOpen) return;

    this.shaftGateOpen = true;

    // Move gate mesh
    if (this.environment) {
      this.environment.shaftGate.position.y = -20; // Drop below floor
    }

    this.playSound('door_open');
    this.callbacks.onNotification('SHAFT GATE UNLOCKED', 1500);

    setTimeout(() => {
      this.sendCommsMessage('gate_open', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Gate is open. I am reading massive bio-energy below. Whatever killed those miners... it is still down there. Descend when ready.',
      });
    }, 1500);
  }

  // ==========================================================================
  // ENEMY SYSTEM - BURROWERS
  // ==========================================================================

  private processBurrowerQueue(): void {
    if (this.burrowerSpawnQueue.length === 0) return;
    if (this.burrowers.length >= this.MAX_BURROWERS) return;

    // Check proximity to spawn point
    const playerPos = this.camera.position;
    for (let i = this.burrowerSpawnQueue.length - 1; i >= 0; i--) {
      const spawnPos = this.burrowerSpawnQueue[i];
      const dist = Vector3.Distance(
        new Vector3(playerPos.x, 0, playerPos.z),
        new Vector3(spawnPos.x, 0, spawnPos.z)
      );

      if (dist < 20) {
        this.burrowerSpawnQueue.splice(i, 1);
        this.spawnBurrower(spawnPos);
      }
    }
  }

  private spawnBurrower(position: Vector3): void {
    if (this.burrowers.length >= this.MAX_BURROWERS) return;

    let mesh: Mesh | TransformNode;
    const assetName = SPECIES_TO_ASSET[BURROWER_SPECIES];

    if (this.burrowerEnemiesPreloaded && assetName) {
      const instance = AssetManager.createInstance(
        'aliens',
        assetName,
        `burrower_${this.burrowers.length}`,
        this.scene
      );
      if (instance) {
        instance.scaling.setAll(BURROWER_SCALE);
        mesh = instance;
      } else {
        mesh = this.createProceduralBurrower();
      }
    } else {
      mesh = this.createProceduralBurrower();
    }

    mesh.position = position.clone();
    mesh.position.y = position.y - 1; // Start buried
    mesh.scaling.setAll(0.1);

    this.burrowers.push({
      mesh,
      health: 80,
      maxHealth: 80,
      position: position.clone(),
      state: 'buried',
      attackCooldown: 0,
      emergeTimer: 1.0 + Math.random() * 2.0,
      stateTimer: 0,
    });

    this.activeEnemyCount++;

    // Notification
    this.triggerShake(2);
    this.callbacks.onNotification('MOVEMENT DETECTED!', 1000);
    this.callbacks.onCombatStateChange(true);
    this.setCombatState(true);
  }

  private createProceduralBurrower(): Mesh {
    const body = MeshBuilder.CreateCapsule(
      `burrower_${this.burrowers.length}`,
      { height: 1.5, radius: 0.4 },
      this.scene
    );
    const mat = new StandardMaterial(`burrowerMat_${this.burrowers.length}`, this.scene);
    mat.diffuseColor = new Color3(0.2, 0.15, 0.25);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    body.material = mat;

    // Glowing eyes
    const eye = MeshBuilder.CreateSphere('burrowerEye', { diameter: 0.1 }, this.scene);
    const eyeMat = new StandardMaterial('burrowerEyeMat', this.scene);
    eyeMat.emissiveColor = Color3.FromHexString('#FF4400');
    eyeMat.disableLighting = true;
    eye.material = eyeMat;
    eye.parent = body;
    eye.position.set(0, 0.5, -0.3);

    return body;
  }

  private updateBurrowers(deltaTime: number): void {
    const playerPos = this.camera.position;
    const chaseSpeed = 3.5;
    const attackRange = 2.5;
    const attackDamage = 10;
    const attackCooldownTime = 1.8;

    for (let i = this.burrowers.length - 1; i >= 0; i--) {
      const burrower = this.burrowers[i];

      // Dead check
      if (burrower.health <= 0) {
        this.onBurrowerKilled(burrower, i);
        continue;
      }

      burrower.stateTimer += deltaTime;

      switch (burrower.state) {
        case 'buried': {
          burrower.emergeTimer -= deltaTime;
          if (burrower.emergeTimer <= 0) {
            burrower.state = 'emerging';
            burrower.stateTimer = 0;
            this.triggerShake(3);
            this.playSound('explosion');
          }
          break;
        }
        case 'emerging': {
          // Rise from ground over 0.8 seconds
          const emergeProgress = Math.min(burrower.stateTimer / 0.8, 1);
          burrower.mesh.position.y = burrower.position.y - 1 + emergeProgress * 2;
          const targetScale = this.burrowerEnemiesPreloaded ? BURROWER_SCALE : 1;
          burrower.mesh.scaling.setAll(0.1 + emergeProgress * (targetScale - 0.1));

          if (emergeProgress >= 1) {
            burrower.state = 'chase';
            burrower.stateTimer = 0;
          }
          break;
        }
        case 'chase': {
          const toPlayer = new Vector3(
            playerPos.x - burrower.mesh.position.x,
            0,
            playerPos.z - burrower.mesh.position.z
          );
          const dist = toPlayer.length();

          if (dist < attackRange) {
            burrower.state = 'attack';
            burrower.stateTimer = 0;
          } else {
            toPlayer.normalize();
            burrower.mesh.position.x += toPlayer.x * chaseSpeed * deltaTime;
            burrower.mesh.position.z += toPlayer.z * chaseSpeed * deltaTime;
            burrower.position.copyFrom(burrower.mesh.position);

            const angle = Math.atan2(toPlayer.x, toPlayer.z);
            burrower.mesh.rotation.y = angle;

            // Bob animation
            burrower.mesh.position.y =
              burrower.position.y + Math.sin(performance.now() * 0.01) * 0.1;
          }
          break;
        }
        case 'attack': {
          if (burrower.attackCooldown > 0) {
            burrower.attackCooldown -= deltaTime;
          }

          const toPlayer = new Vector3(
            playerPos.x - burrower.mesh.position.x,
            0,
            playerPos.z - burrower.mesh.position.z
          );
          const dist = toPlayer.length();

          // Face player
          if (dist > 0.1) {
            const angle = Math.atan2(toPlayer.x, toPlayer.z);
            burrower.mesh.rotation.y = angle;
          }

          if (dist > attackRange * 1.5) {
            burrower.state = 'chase';
            burrower.stateTimer = 0;
          } else if (burrower.attackCooldown <= 0) {
            // Attack!
            this.onBurrowerAttack(burrower, attackDamage);
            burrower.attackCooldown = attackCooldownTime;
          }
          break;
        }
        case 'burrow': {
          // Re-burrow and move to new position (advanced behavior)
          const progress = Math.min(burrower.stateTimer / 0.5, 1);
          burrower.mesh.position.y = burrower.position.y - progress * 2;
          if (progress >= 1) {
            burrower.state = 'buried';
            burrower.emergeTimer = 1.5 + Math.random() * 2;
            burrower.stateTimer = 0;
            // Relocate
            const angle = Math.random() * Math.PI * 2;
            burrower.position.x = playerPos.x + Math.cos(angle) * (8 + Math.random() * 5);
            burrower.position.z = playerPos.z + Math.sin(angle) * (8 + Math.random() * 5);
            burrower.mesh.position.x = burrower.position.x;
            burrower.mesh.position.z = burrower.position.z;
          }
          break;
        }
      }
    }
  }

  private onBurrowerAttack(burrower: BurrowerEnemy, damage: number): void {
    // Visual lunge
    const origY = burrower.mesh.position.y;
    burrower.mesh.position.y += 0.4;
    setTimeout(() => {
      if (burrower.mesh && !burrower.mesh.isDisposed()) {
        burrower.mesh.position.y = origY;
      }
    }, 150);

    this.callbacks.onHealthChange(-damage);
    this.playerHealth -= damage;
    damageFeedback.applyPlayerDamageFeedback(damage);
    this.callbacks.onNotification('BURROWER ATTACK!', 500);
  }

  private onBurrowerKilled(burrower: BurrowerEnemy, index: number): void {
    this.killCount++;
    this.activeEnemyCount--;

    particleManager.emitAlienDeath(burrower.mesh.position.clone(), 1.0);
    this.callbacks.onKill();
    this.updateKillStreak(this.killCount);

    // Death animation
    const deathStart = performance.now();
    const animateDeath = () => {
      const elapsed = performance.now() - deathStart;
      const progress = Math.min(elapsed / 300, 1);

      if (burrower.mesh && !burrower.mesh.isDisposed()) {
        burrower.mesh.scaling.setAll((1 - progress) * BURROWER_SCALE);
        if (progress >= 1) {
          burrower.mesh.dispose();
        } else {
          requestAnimationFrame(animateDeath);
        }
      }
    };
    requestAnimationFrame(animateDeath);

    this.burrowers.splice(index, 1);

    // Check if all active enemies defeated
    if (this.activeEnemyCount <= 0 && this.burrowerSpawnQueue.length === 0 && !this.boss) {
      this.callbacks.onCombatStateChange(false);
      this.setCombatState(false);
    }
  }

  // ==========================================================================
  // BOSS FIGHT - MINING DRILL CHITIN
  // ==========================================================================

  private startBossFight(): void {
    this.callbacks.onNotification('WARNING: HOSTILE ALPHA DETECTED', 3000);
    this.callbacks.onCombatStateChange(true);
    this.setCombatState(true);

    // Close arena door
    if (this.environment) {
      this.environment.bossArenaDoor.isVisible = true;
    }

    // Spawn boss
    setTimeout(() => {
      this.spawnBoss();
    }, 2000);

    this.sendCommsMessage('boss_alert', {
      sender: 'Lt. Reyes',
      callsign: 'REYES',
      portrait: 'commander',
      text: 'Massive bio-signature! That thing has drill-like appendages, probably mutated from exposure to the mining equipment. Its chitin armor is thick. Target the joints and exposed areas!',
    });

    this.callbacks.onObjectiveUpdate(
      'DEFEAT THE MINING DRILL CHITIN',
      'Destroy the armored alien. Target weak points between armor plates.'
    );
  }

  private spawnBoss(): void {
    const spawnPos = MINE_POSITIONS.shaftBossSpawn.clone();
    const instanceId = _bossInstanceCounter++;

    if (!this.bossAssetsPreloaded) {
      throw new Error('[MiningDepthsLevel] Boss assets not preloaded - call preloadBossModels() first');
    }

    const bossRoot = AssetManager.createInstanceByPath(
      BOSS_GLB_PATHS.chitinBody,
      `drillChitin_${instanceId}`,
      this.scene,
      true,
      'enemy'
    );

    if (!bossRoot) {
      throw new Error(`[MiningDepthsLevel] Failed to create boss instance from: ${BOSS_GLB_PATHS.chitinBody}`);
    }

    this.bossGlbInstances.push(bossRoot);
    // Scale boss appropriately for the arena
    bossRoot.scaling.setAll(2.5);
    bossRoot.position = spawnPos.clone();
    bossRoot.position.y += 2;

    // Boss eye light (always procedural for dynamic effect)
    const bossEyeLight = new PointLight(
      'bossEyeLight',
      spawnPos.add(new Vector3(0, 3.5, -1)),
      this.scene
    );
    bossEyeLight.diffuse = new Color3(1.0, 0.2, 0.1);
    bossEyeLight.intensity = 0.6;
    bossEyeLight.range = 12;

    this.boss = {
      mesh: bossRoot,
      health: 500,
      maxHealth: 500,
      position: spawnPos.clone(),
      state: 'idle',
      attackCooldown: 2,
      stateTimer: 0,
      chargeTarget: null,
      isEnraged: false,
      drillActive: false,
    };

    // Spawn animation
    const finalScale = this.bossAssetsPreloaded ? 2.5 : 1.0;
    bossRoot.scaling.setAll(0.1);
    const spawnStart = performance.now();
    const animateSpawn = () => {
      const elapsed = performance.now() - spawnStart;
      const progress = Math.min(elapsed / 1000, 1);
      bossRoot!.scaling.setAll(0.1 + progress * (finalScale - 0.1));
      if (progress < 1) requestAnimationFrame(animateSpawn);
    };
    requestAnimationFrame(animateSpawn);

    this.triggerShake(6);
    this.playSound('explosion');
  }

  private updateBoss(deltaTime: number): void {
    if (!this.boss || this.bossDefeated) return;

    const boss = this.boss;
    boss.stateTimer += deltaTime;

    // Health check
    if (boss.health <= 0) {
      this.transitionToPhase('boss_defeated');
      return;
    }

    // Enrage at 30% health
    if (!boss.isEnraged && boss.health < boss.maxHealth * 0.3) {
      boss.isEnraged = true;
      this.callbacks.onNotification('THE CHITIN IS ENRAGED!', 2000);
      this.triggerShake(4);
    }

    const playerPos = this.camera.position;
    const toPlayer = new Vector3(
      playerPos.x - boss.mesh.position.x,
      0,
      playerPos.z - boss.mesh.position.z
    );
    const dist = toPlayer.length();

    // Attack cooldown
    if (boss.attackCooldown > 0) {
      boss.attackCooldown -= deltaTime;
    }

    const moveSpeed = boss.isEnraged ? 5 : 3;
    const attackRange = 4;
    const chargeDist = 12;

    switch (boss.state) {
      case 'idle': {
        // Face player
        if (dist > 0.1) {
          const angle = Math.atan2(toPlayer.x, toPlayer.z);
          boss.mesh.rotation.y = angle;
        }

        if (boss.attackCooldown <= 0) {
          if (dist > chargeDist) {
            boss.state = 'charge';
            boss.chargeTarget = playerPos.clone();
            boss.stateTimer = 0;
          } else if (dist < attackRange) {
            boss.state = 'drill_attack';
            boss.stateTimer = 0;
          } else {
            // Chase
            toPlayer.normalize();
            boss.mesh.position.x += toPlayer.x * moveSpeed * deltaTime;
            boss.mesh.position.z += toPlayer.z * moveSpeed * deltaTime;
            boss.position.copyFrom(boss.mesh.position);
          }
        }
        break;
      }
      case 'charge': {
        // Charge toward the locked target
        if (boss.chargeTarget) {
          const toTarget = boss.chargeTarget.subtract(boss.mesh.position);
          toTarget.y = 0;
          const targetDist = toTarget.length();

          if (targetDist < 2 || boss.stateTimer > 2) {
            // Impact!
            if (Vector3.Distance(playerPos, boss.mesh.position) < 3) {
              const chargeDamage = boss.isEnraged ? 30 : 20;
              this.callbacks.onHealthChange(-chargeDamage);
              this.playerHealth -= chargeDamage;
              damageFeedback.applyPlayerDamageFeedback(chargeDamage);
              this.triggerShake(6);
            }
            boss.state = 'idle';
            boss.attackCooldown = boss.isEnraged ? 1.0 : 2.0;
            boss.stateTimer = 0;
            boss.chargeTarget = null;
          } else {
            toTarget.normalize();
            const chargeSpeed = boss.isEnraged ? 10 : 7;
            boss.mesh.position.x += toTarget.x * chargeSpeed * deltaTime;
            boss.mesh.position.z += toTarget.z * chargeSpeed * deltaTime;
            boss.position.copyFrom(boss.mesh.position);

            const angle = Math.atan2(toTarget.x, toTarget.z);
            boss.mesh.rotation.y = angle;
          }
        }
        break;
      }
      case 'drill_attack': {
        // Melee drill attack
        if (boss.stateTimer > 0.5) {
          if (dist < attackRange + 1) {
            const drillDamage = boss.isEnraged ? 25 : 15;
            this.callbacks.onHealthChange(-drillDamage);
            this.playerHealth -= drillDamage;
            damageFeedback.applyPlayerDamageFeedback(drillDamage);
            this.triggerShake(4);
            this.callbacks.onNotification('DRILL ATTACK!', 500);
          }
          boss.state = 'idle';
          boss.attackCooldown = boss.isEnraged ? 1.5 : 2.5;
          boss.stateTimer = 0;
        }
        break;
      }
      case 'burrow': {
        // Boss burrows underground
        const progress = Math.min(boss.stateTimer / 1.0, 1);
        boss.mesh.position.y = boss.position.y + 2 - progress * 4;

        if (progress >= 1) {
          boss.state = 'emerge';
          boss.stateTimer = 0;
          // Relocate near player
          const angle = Math.random() * Math.PI * 2;
          boss.mesh.position.x = playerPos.x + Math.cos(angle) * 8;
          boss.mesh.position.z = playerPos.z + Math.sin(angle) * 8;
          boss.position.x = boss.mesh.position.x;
          boss.position.z = boss.mesh.position.z;
        }
        break;
      }
      case 'emerge': {
        const progress = Math.min(boss.stateTimer / 0.8, 1);
        boss.mesh.position.y = boss.position.y - 2 + progress * 4;

        if (progress >= 1) {
          boss.state = 'idle';
          boss.stateTimer = 0;
          boss.attackCooldown = 0.5;
          this.triggerShake(5);
          this.playSound('explosion');
        }
        break;
      }
      case 'enraged': {
        // Handled by isEnraged flag, transitions back to idle
        boss.state = 'idle';
        boss.stateTimer = 0;
        break;
      }
    }

    // Random burrow behavior
    if (boss.state === 'idle' && boss.stateTimer > 5 && Math.random() < 0.01 * deltaTime) {
      boss.state = 'burrow';
      boss.stateTimer = 0;
    }

    // Subtle body animation
    if (boss.mesh && !boss.mesh.isDisposed()) {
      const bob = Math.sin(performance.now() * 0.005) * 0.1;
      if (boss.state !== 'burrow' && boss.state !== 'emerge') {
        boss.mesh.position.y = boss.position.y + 2 + bob;
      }
    }
  }

  private onBossDefeated(): void {
    if (!this.boss) return;

    this.bossDefeated = true;

    // Boss death effects
    this.triggerShake(8);
    this.playSound('explosion');
    particleManager.emitAlienDeath(this.boss.mesh.position.clone(), 3.0);
    this.callbacks.onNotification('MINING DRILL CHITIN DESTROYED!', 3000);

    // Death animation
    const deathStart = performance.now();
    const bossMesh = this.boss.mesh;
    const animateDeath = () => {
      const elapsed = performance.now() - deathStart;
      const progress = Math.min(elapsed / 1500, 1);

      if (bossMesh && !bossMesh.isDisposed()) {
        bossMesh.scaling.setAll(1 - progress);
        if (progress >= 1) {
          bossMesh.dispose();
        } else {
          requestAnimationFrame(animateDeath);
        }
      }
    };
    requestAnimationFrame(animateDeath);

    this.callbacks.onCombatStateChange(false);
    this.setCombatState(false);

    // Open arena door
    if (this.environment) {
      this.environment.bossArenaDoor.isVisible = false;
    }

    setTimeout(() => {
      this.sendCommsMessage('boss_dead', {
        sender: 'Lt. Reyes',
        callsign: 'REYES',
        portrait: 'commander',
        text: 'Incredible, Sergeant! That thing is down. Bio-scans show the area is clear. The mining complex is secure. Return to the surface for extraction.',
      });

      this.callbacks.onKill();
      this.killCount++;
      this.updateKillStreak(this.killCount);
    }, 2000);

    setTimeout(() => {
      this.transitionToPhase('exit');
      this.completeLevel();
    }, 6000);
  }

  // ==========================================================================
  // COMBAT ACTIONS
  // ==========================================================================

  private firePrimaryWeapon(): void {
    if (this.primaryFireCooldown > 0) return;
    if (!this.isPointerLocked()) return;

    // Check ammo
    if (!fireWeapon()) {
      this.callbacks.onNotification('NO AMMO - RELOADING', 800);
      startReload();
      return;
    }

    this.primaryFireCooldown = this.PRIMARY_FIRE_COOLDOWN;

    const playerPos = this.camera.position;
    const forward = this.camera.getDirection(Vector3.Forward());

    // Check burrower hits
    let hitEnemy = false;
    for (const burrower of this.burrowers) {
      if (burrower.health <= 0 || burrower.state === 'buried') continue;

      const toEnemy = burrower.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      if (dist > this.PRIMARY_FIRE_RANGE) continue;

      const dot = Vector3.Dot(toEnemy.normalize(), forward);
      const crossDist = Math.sqrt(1 - dot * dot) * dist;

      if (dot > 0.9 && crossDist < 1.0) {
        burrower.health -= this.PRIMARY_FIRE_DAMAGE;
        damageFeedback.applyDamageFeedback(burrower.mesh, this.PRIMARY_FIRE_DAMAGE, forward);
        particleManager.emitAlienSplatter(burrower.mesh.position, 0.6);
        this.callbacks.onNotification('HIT!', 200);
        hitEnemy = true;
        break;
      }
    }

    // Check boss hit
    if (!hitEnemy && this.boss && this.boss.health > 0) {
      const toEnemy = this.boss.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      if (dist <= this.PRIMARY_FIRE_RANGE) {
        const dot = Vector3.Dot(toEnemy.normalize(), forward);
        const crossDist = Math.sqrt(1 - dot * dot) * dist;

        if (dot > 0.85 && crossDist < 1.5) {
          // Reduced damage to armored boss
          const effectiveDamage = this.boss.isEnraged
            ? this.PRIMARY_FIRE_DAMAGE
            : Math.floor(this.PRIMARY_FIRE_DAMAGE * 0.7);
          this.boss.health -= effectiveDamage;
          damageFeedback.applyDamageFeedback(this.boss.mesh, effectiveDamage, forward);
          particleManager.emitAlienSplatter(this.boss.mesh.position, 0.8);

          const healthPct = Math.round((this.boss.health / this.boss.maxHealth) * 100);
          this.callbacks.onNotification(`BOSS: ${healthPct}%`, 300);
        }
      }
    }

    this.createMuzzleFlash();
  }

  private meleeAttack(): void {
    if (this.meleeCooldown > 0) return;

    const hasTargets =
      this.burrowers.some((b) => b.health > 0 && b.state !== 'buried') ||
      (this.boss !== null && this.boss.health > 0);

    if (!hasTargets) return;

    this.meleeCooldown = this.MELEE_COOLDOWN;
    this.callbacks.onNotification('MELEE!', 500);

    const playerPos = this.camera.position;
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const attackPos = playerPos.add(forward.scale(this.MELEE_RANGE / 2));

    let hitAny = false;

    // Damage burrowers
    for (const burrower of this.burrowers) {
      if (burrower.health <= 0 || burrower.state === 'buried') continue;
      const dist = Vector3.Distance(attackPos, burrower.mesh.position);
      if (dist < this.MELEE_RANGE) {
        burrower.health -= this.MELEE_DAMAGE;
        const hitDir = burrower.mesh.position.subtract(attackPos).normalize();
        damageFeedback.applyDamageFeedback(burrower.mesh, this.MELEE_DAMAGE, hitDir);
        particleManager.emitAlienSplatter(burrower.mesh.position, 0.8);
        hitAny = true;
      }
    }

    // Damage boss
    if (this.boss && this.boss.health > 0) {
      const dist = Vector3.Distance(attackPos, this.boss.mesh.position);
      if (dist < this.MELEE_RANGE + 1) {
        const effectiveDamage = Math.floor(this.MELEE_DAMAGE * 1.5); // Melee does extra to boss
        this.boss.health -= effectiveDamage;
        const hitDir = this.boss.mesh.position.subtract(attackPos).normalize();
        damageFeedback.applyDamageFeedback(this.boss.mesh, effectiveDamage, hitDir);
        particleManager.emitAlienSplatter(this.boss.mesh.position, 1.0);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.callbacks.onNotification('HIT!', 300);
      this.callbacks.onKill();
    }
  }

  private handleReload(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;

    const state = weaponActions.getState();
    if (state.isReloading) return;

    if (state.currentAmmo >= state.maxMagazineSize) {
      this.callbacks.onNotification('MAGAZINE FULL', 800);
      return;
    }

    if (state.reserveAmmo <= 0) {
      this.callbacks.onNotification('NO RESERVE AMMO', 800);
      return;
    }

    startReload();
    this.callbacks.onNotification('RELOADING...', 1500);
  }

  private createMuzzleFlash(): void {
    const forward = this.camera.getDirection(Vector3.Forward());
    const flashPos = this.camera.position.add(forward.scale(0.5));

    particleManager.emitMuzzleFlash(flashPos, forward);

    const flashLight = new PointLight('muzzleFlash', flashPos, this.scene);
    flashLight.diffuse = new Color3(1, 0.8, 0.4);
    flashLight.intensity = 2;
    flashLight.range = 10;

    const startTime = performance.now();
    const animateFlash = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 80, 1);
      flashLight.intensity = 2 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animateFlash);
      } else {
        flashLight.dispose();
      }
    };
    requestAnimationFrame(animateFlash);
  }

  // ==========================================================================
  // ACTION HANDLING
  // ==========================================================================

  private handleAction(actionId: string): void {
    switch (actionId) {
      case 'flashlight':
        this.toggleFlashlight();
        break;
      case 'scanner':
        this.activateScanner();
        break;
      case 'interact':
        this.tryInteract();
        break;
      case 'melee':
        this.meleeAttack();
        break;
      case 'reload':
        this.handleReload();
        break;
    }
  }

  private toggleFlashlight(): void {
    this.flashlightOn = !this.flashlightOn;
    if (this.flashlight) {
      this.flashlight.intensity = this.flashlightOn ? 2.5 : 0;
    }
    if (this.flashlightFill) {
      this.flashlightFill.intensity = this.flashlightOn ? 0.4 : 0;
    }
    this.playSound(this.flashlightOn ? 'notification' : 'notification');
    this.callbacks.onNotification(this.flashlightOn ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF', 800);
  }

  private activateScanner(): void {
    this.callbacks.onNotification('SCANNING...', 1500);
    const playerPos = this.camera.position;

    // Scan for nearby objectives
    if (!this.hasKeycard) {
      const keycardDist = Vector3.Distance(playerPos, MINE_POSITIONS.hubKeycard);
      if (keycardDist < 25) {
        setTimeout(() => {
          this.callbacks.onNotification(`KEYCARD DETECTED - ${Math.round(keycardDist)}M`, 2000);
          this.setObjective(MINE_POSITIONS.hubKeycard);
        }, 1500);
        return;
      }
    }

    // Scan for audio logs
    for (const log of this.audioLogs) {
      if (log.collected) continue;
      const dist = Vector3.Distance(playerPos, log.position);
      if (dist < 20) {
        setTimeout(() => {
          this.callbacks.onNotification(`AUDIO LOG DETECTED - ${Math.round(dist)}M`, 2000);
        }, 1500);
        return;
      }
    }

    // Scan for gate
    if (this.hasKeycard && !this.shaftGateOpen) {
      const gateDist = Vector3.Distance(playerPos, new Vector3(-10, -13, -110));
      if (gateDist < 25) {
        setTimeout(() => {
          this.callbacks.onNotification(`SHAFT GATE - ${Math.round(gateDist)}M`, 2000);
        }, 1500);
        return;
      }
    }

    setTimeout(() => {
      this.callbacks.onNotification('NO TARGETS IN RANGE', 1500);
    }, 1500);
  }

  private tryInteract(): void {
    const playerPos = this.camera.position;

    // Gate interaction
    if (this.hasKeycard && !this.shaftGateOpen) {
      const gateDist = Vector3.Distance(playerPos, new Vector3(-10, -13, -110));
      if (gateDist < 4) {
        this.openShaftGate();
        return;
      }
    }
  }

  // ==========================================================================
  // UI - ACTION BUTTONS
  // ==========================================================================

  private updateActionButtons(): void {
    const flashlight = levelActionParams('flashlight');
    const scanner = levelActionParams('scanner');
    const melee = levelActionParams('melee');
    const reload = bindableActionParams('reload');
    const interact = bindableActionParams('interact');

    const groups: ActionButtonGroup[] = [
      {
        id: 'tools',
        label: 'TOOLS',
        position: 'right',
        buttons: [
          createAction('flashlight', 'FLASHLIGHT', flashlight.key, {
            keyDisplay: flashlight.keyDisplay,
            variant: 'secondary',
            icon: '🔦',
          }),
          createAction('scanner', 'SCANNER', scanner.key, {
            keyDisplay: scanner.keyDisplay,
            variant: 'primary',
            icon: '📡',
          }),
        ],
      },
    ];

    // Combat buttons when enemies active
    const hasEnemies =
      this.burrowers.some((b) => b.health > 0 && b.state !== 'buried') ||
      (this.boss !== null && this.boss.health > 0 && !this.bossDefeated);

    if (hasEnemies) {
      groups.push({
        id: 'combat',
        label: 'COMBAT',
        position: 'left',
        buttons: [
          createAction('melee', 'MELEE', melee.key, {
            keyDisplay: melee.keyDisplay,
            variant: 'danger',
            icon: '🔪',
          }),
          createAction('reload', 'RELOAD', reload.key, {
            keyDisplay: reload.keyDisplay,
            variant: 'secondary',
            icon: '🔄',
          }),
        ],
      });
    }

    // Interact button when near interactables
    const nearInteractable = this.checkNearInteractable();
    if (nearInteractable) {
      groups.push({
        id: 'interact',
        position: 'bottom',
        buttons: [
          createAction('interact', nearInteractable, interact.key, {
            keyDisplay: interact.keyDisplay,
            variant: 'primary',
            size: 'large',
            highlighted: true,
          }),
        ],
      });
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  private checkNearInteractable(): string | null {
    const playerPos = this.camera.position;

    // Gate
    if (this.hasKeycard && !this.shaftGateOpen) {
      const gateDist = Vector3.Distance(playerPos, new Vector3(-10, -13, -110));
      if (gateDist < 4) return 'USE KEYCARD';
    }

    return null;
  }

  // ==========================================================================
  // OBJECTIVES
  // ==========================================================================

  private setObjective(position: Vector3): void {
    this.currentObjective = position;
    if (this.objectiveMarker) {
      this.objectiveMarker.position.set(position.x, position.y + 0.5, position.z);
      this.objectiveMarker.isVisible = true;
    }
  }

  private clearObjective(): void {
    this.currentObjective = null;
    if (this.objectiveMarker) {
      this.objectiveMarker.isVisible = false;
    }
  }

  // ==========================================================================
  // COMMS HELPER
  // ==========================================================================

  private sendCommsMessage(
    flag: string,
    message: {
      sender: string;
      callsign: string;
      portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
      text: string;
    }
  ): void {
    if (this.messageFlags.has(flag)) return;
    this.messageFlags.add(flag);
    this.callbacks.onCommsMessage(message);
  }

  // ==========================================================================
  // INPUT HANDLING
  // ==========================================================================

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    const interactKeys = this.inputTracker.getAllKeysForAction('interact');
    const fireKeys = this.inputTracker.getAllKeysForAction('fire');
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');

    // Level-specific action keys
    switch (e.code) {
      case 'KeyF':
        this.toggleFlashlight();
        break;
      case 'KeyT':
        this.activateScanner();
        break;
      case 'KeyV':
        this.meleeAttack();
        break;
    }

    // Reload
    if (reloadKeys.includes(e.code)) {
      this.handleReload();
    }

    // Interact
    if (interactKeys.includes(e.code)) {
      this.tryInteract();
    }

    // Fire (non-mouse)
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

  protected override getMoveSpeed(): number {
    // Slower in flooded areas
    if (this.playerInFlood) return 2.5;
    return 4;
  }

  // ==========================================================================
  // TRANSITION
  // ==========================================================================

  override canTransitionTo(levelId: LevelId): boolean {
    return this.bossDefeated && this.phase === 'exit';
  }

  // ==========================================================================
  // DISPOSE
  // ==========================================================================

  protected disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Dispose enemies
    for (const burrower of this.burrowers) {
      burrower.mesh.dispose();
    }
    this.burrowers = [];

    // Dispose boss
    if (this.boss?.mesh && !this.boss.mesh.isDisposed()) {
      this.boss.mesh.dispose();
    }
    this.boss = null;

    // Dispose boss GLB instances
    for (const node of this.bossGlbInstances) {
      if (node && !node.isDisposed()) {
        node.dispose(false, true);
      }
    }
    this.bossGlbInstances = [];

    // Dispose flashlight
    this.flashlight?.dispose();
    this.flashlight = null;
    this.flashlightFill?.dispose();
    this.flashlightFill = null;

    // Dispose dust particles
    for (const dust of this.dustParticles) {
      if (dust && !dust.isDisposed()) {
        (dust.material as StandardMaterial)?.dispose();
        dust.dispose();
      }
    }
    this.dustParticles = [];

    // Reset fog
    this.scene.fogMode = 0;

    // Dispose cave ambient
    this.caveAmbient?.dispose();
    this.caveAmbient = null;

    // Dispose objective marker
    if (this.objectiveMarker) {
      (this.objectiveMarker.material as StandardMaterial)?.dispose();
      this.objectiveMarker.dispose();
      this.objectiveMarker = null;
    }

    // Dispose environment
    if (this.environment) {
      this.environment.dispose();
      this.environment = null;
    }

    // Dispose damage feedback
    damageFeedback.dispose();
  }
}
