/**
 * FOBDeltaLevel - Abandoned Military Base with Horror Atmosphere
 *
 * LEVEL 3: FOB DELTA
 * An abandoned forward operating base with a horror/investigation theme.
 * The player searches for clues about what happened to the garrison
 * and locates Marcus's mech signature.
 *
 * AREAS:
 * 1. PERIMETER - Breached barriers, entry point
 * 2. COURTYARD - Central open area, overturned vehicles
 * 3. BARRACKS - Bunks, personal effects, bodies (horror)
 * 4. COMMAND CENTER - Terminals, mission logs
 * 5. VEHICLE BAY - Marcus's mech signature detected
 * 6. UNDERGROUND ACCESS - Exit to The Breach
 *
 * ATMOSPHERE:
 * - Flickering lights
 * - Environmental storytelling
 * - Jump scares (carefully placed)
 * - Motion tracker mechanic introduction
 * - Increasing dread
 */

import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('FOBDelta');

import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import type { BaseSegment, ModularBaseResult } from '../shared/ModularBaseBuilder';
import {
  buildModularBase,
  updateFlickerLights as updateModularFlickerLights,
} from '../shared/ModularBaseBuilder';
import type { LevelId } from '../types';

// Map for ambush enemy types to GLB assets
const AMBUSH_ENEMY_SPECIES = 'lurker'; // Maps to scout.glb - tall stalker type
const AMBUSH_ENEMY_SCALE = 0.6;

import '@babylonjs/core/Animations/animatable';

// ---------------------------------------------------------------------------
// GLB asset path constants for FOB Delta environment
// ---------------------------------------------------------------------------

/** Props used as debris at the perimeter breach */
const GLB_DEBRIS = {
  brick_pile_1: '/assets/models/props/debris/debris_bricks_mx_1.glb',
  brick_pile_2: '/assets/models/props/debris/debris_bricks_mx_2.glb',
  brick_1: '/assets/models/props/debris/brick_mx_1.glb',
  brick_2: '/assets/models/props/debris/brick_mx_2.glb',
  brick_3: '/assets/models/props/debris/brick_mx_3.glb',
  brick_4: '/assets/models/props/debris/brick_mx_4.glb',
  gravel_1: '/assets/models/props/debris/gravel_pile_hr_1.glb',
  gravel_2: '/assets/models/props/debris/gravel_pile_hr_2.glb',
} as const;

/** Sandbag / barrier props */
const GLB_BARRIERS = {
  cement_pallet_1: '/assets/models/props/containers/cement_bags_mp_1_pallet_1.glb',
  cement_pallet_2: '/assets/models/props/containers/cement_bags_mp_1_pallet_2.glb',
} as const;

/** Courtyard clutter -- vehicles, crates, barrels */
const GLB_COURTYARD = {
  shipping_container: '/assets/models/environment/industrial/shipping_container_mx_1.glb',
  shipping_container_hollow:
    '/assets/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
  tire_1: '/assets/models/props/containers/tire_1.glb',
  tire_2: '/assets/models/props/containers/tire_2.glb',
  wooden_crate_1: '/assets/models/props/containers/wooden_crate_1.glb',
  wooden_crate_2a: '/assets/models/props/containers/wooden_crate_2_a.glb',
  wooden_crate_2b: '/assets/models/props/containers/wooden_crate_2_b.glb',
  wooden_crate_3: '/assets/models/props/containers/wooden_crate_3.glb',
  wooden_crate_hx_2: '/assets/models/props/containers/wooden_crate_hx_2.glb',
  wooden_crate_hx_3: '/assets/models/props/containers/wooden_crate_hx_3.glb',
  wooden_crate_hx_4: '/assets/models/props/containers/wooden_crate_hx_4.glb',
  metal_barrel_1: '/assets/models/props/containers/metal_barrel_hr_1.glb',
  metal_barrel_2: '/assets/models/props/containers/metal_barrel_hr_2.glb',
  metal_barrel_3: '/assets/models/props/containers/metal_barrel_hr_3.glb',
  metal_barrel_4: '/assets/models/props/containers/metal_barrel_hr_4.glb',
  barrel_atmo: '/assets/models/props/atmospheric/barrel.glb',
} as const;

/** Barracks interior props */
const GLB_BARRACKS = {
  bench_1: '/assets/models/props/furniture/bench_mx_1.glb',
  bench_2: '/assets/models/props/furniture/bench_mx_1_1.glb',
  bench_3: '/assets/models/props/furniture/bench_mx_1_2.glb',
  shelf_1: '/assets/models/props/furniture/shelf_mx_1.glb',
  shelf_2: '/assets/models/props/furniture/shelf_mx_2.glb',
  old_mattress: '/assets/models/props/containers/old_mattress_mx_1.glb',
  marine_body: '/assets/models/npcs/marine/marine_soldier.glb',
} as const;

/** Command center / terminal props */
const GLB_COMMAND = {
  computer: '/assets/models/environment/modular/Props_Computer.glb',
  computer_sm: '/assets/models/environment/modular/Props_ComputerSmall.glb',
  door_hr_6: '/assets/models/props/doors/door_hr_6.glb',
  door_hr_8: '/assets/models/props/doors/door_hr_8.glb',
  chimney: '/assets/models/environment/industrial/chimney_a_1.glb',
} as const;

/** Building structures -- buildings, hangars */
const GLB_BUILDINGS = {
  warehouse_1: '/assets/models/environment/station/warehouse_mx_1.glb',
  warehouse_2: '/assets/models/environment/station/warehouse_mx_2.glb',
  warehouse_3: '/assets/models/environment/station/warehouse_mx_3.glb',
  warehouse_4: '/assets/models/environment/station/warehouse_mx_4.glb',
  garages_block: '/assets/models/environment/station/garages_block_hr_1.glb',
  garage_door_frame_1: '/assets/models/environment/station/garage_door_frame_hr_1.glb',
  garage_door_frame_2: '/assets/models/environment/station/garage_door_frame_hr_2.glb',
  garage_hl_1: '/assets/models/environment/station/garage_hl_1.glb',
  garage_hl_2: '/assets/models/environment/station/garage_hl_2.glb',
  shed_1: '/assets/models/environment/station/shed_ax_1.glb',
  shed_2: '/assets/models/environment/station/shed_ax_2.glb',
} as const;

/** Caution stripe replacements -- directional arrows/details */
const GLB_DETAILS = {
  arrow: '/assets/models/environment/modular/Details_Arrow.glb',
  arrow_2: '/assets/models/environment/modular/Details_Arrow_2.glb',
  caution_plate: '/assets/models/environment/modular/Details_Plate_Long.glb',
} as const;

/** Perimeter walls -- station wall GLBs tiled along the perimeter */
const GLB_PERIMETER = {
  wall_hr_1: '/assets/models/environment/station/wall_hr_1.glb',
  wall_hr_15: '/assets/models/environment/station/wall_hr_15.glb',
  wall_hr_1_hole_2: '/assets/models/environment/station/wall_hr_1_hole_2.glb',
  wall_hr_2: '/assets/models/environment/station/wall_hr_2.glb',
} as const;

/** Antenna dish / comm tower detail */
const GLB_ANTENNA = {
  platform_ax_1: '/assets/models/environment/station/platform_ax_1.glb',
} as const;

/** Underground hatch components */
const GLB_HATCH = {
  floor_plate: '/assets/models/environment/station/floor_ceiling_hr_4.glb',
  hatch_door: '/assets/models/props/doors/door_hr_12.glb',
  hatch_handle: '/assets/models/props/pipes/pipe_mx_1.glb',
  caution_ring: '/assets/models/environment/modular/Details_Plate_Long.glb',
} as const;

/** Supply/pickup props for ammo and health */
const GLB_SUPPLIES = {
  ammo_crate: '/assets/models/props/weapons/ammo_box_556.glb',
  med_kit: '/assets/models/props/containers/cardboard_box_1.glb',
  supply_crate: '/assets/models/props/collectibles/supply_drop.glb',
  flare_box: '/assets/models/props/weapons/flare_mx_1.glb',
} as const;

/** Fortification props - sandbags, barriers, defensive positions */
const GLB_FORTIFICATIONS = {
  sandbag_wall: '/assets/models/props/containers/cement_bags_mp_1_pallet_1.glb',
  sandbag_corner: '/assets/models/props/containers/cement_bags_mp_1_pallet_2.glb',
  barricade: '/assets/models/props/containers/wooden_crate_hx_5.glb',
  bunker_small: '/assets/models/environment/station/shed_ax_3.glb',
  bunker_large: '/assets/models/environment/station/shed_ax_4.glb',
  watchtower_base: '/assets/models/environment/station/platform_bx_1.glb',
  guard_rail: '/assets/models/props/pipes/pipe_mx_1.glb',
} as const;

/** Turret/defense system props */
const GLB_DEFENSES = {
  turret_base: '/assets/models/props/containers/metal_barrel_hr_1.glb',
  turret_gun: '/assets/models/props/pipes/pipe_mx_2.glb',
  radar_dish: '/assets/models/environment/station/platform_ax_1.glb',
  spotlight: '/assets/models/props/electrical/lamp_mx_4_on.glb',
} as const;

/** Ground surface - large asphalt tiles */
const GLB_GROUND = {
  asphalt_large: '/assets/models/environment/station/asphalt_hr_1_large.glb',
  asphalt_1: '/assets/models/environment/station/asphalt_hr_1.glb',
  asphalt_2: '/assets/models/environment/station/asphalt_hr_2.glb',
  asphalt_3: '/assets/models/environment/station/asphalt_hr_3.glb',
} as const;

/** Antenna dish / platform components */
const GLB_ANTENNA_PLATFORM = {
  platform_small: '/assets/models/environment/station/platform_small_mx_1.glb',
  platform_large: '/assets/models/environment/station/platform_large_mx_1.glb',
} as const;

/** Marcus's TITAN mech */
const GLB_MECH = {
  marcus_mech: '/assets/models/vehicles/marcus_mech.glb',
} as const;

/**
 * Aggregate all FOB Delta GLB paths for batch preloading.
 */
const ALL_FOB_GLB_PATHS: string[] = [
  ...Object.values(GLB_DEBRIS),
  ...Object.values(GLB_BARRIERS),
  ...Object.values(GLB_COURTYARD),
  ...Object.values(GLB_BARRACKS),
  ...Object.values(GLB_COMMAND),
  ...Object.values(GLB_BUILDINGS),
  ...Object.values(GLB_DETAILS),
  ...Object.values(GLB_PERIMETER),
  ...Object.values(GLB_ANTENNA),
  ...Object.values(GLB_HATCH),
  ...Object.values(GLB_MECH),
  ...Object.values(GLB_GROUND),
  ...Object.values(GLB_ANTENNA_PLATFORM),
  ...Object.values(GLB_SUPPLIES),
  ...Object.values(GLB_FORTIFICATIONS),
  ...Object.values(GLB_DEFENSES),
];

// Phase progression through the level
type FOBPhase =
  | 'approach' // Initial approach to FOB
  | 'courtyard' // Exploring the central courtyard
  | 'investigation' // Searching barracks and command center
  | 'ambush' // Enemy ambush in vehicle bay
  | 'discovery' // Finding the underground access
  | 'exit'; // Ready to proceed to next level

// Area definitions for trigger zones
interface AreaZone {
  id: string;
  name: string;
  center: Vector3;
  radius: number;
  triggered: boolean;
}

// Flickering light definition
interface FlickerLight {
  light: PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  flickerAmount: number;
  timer: number;
  isOff: boolean;
  offDuration: number;
  offTimer: number;
}

export class FOBDeltaLevel extends BaseLevel {
  // Phase management
  private phase: FOBPhase = 'approach';

  // Environment containers
  private fobRoot: TransformNode | null = null;
  private allMeshes: Mesh[] = [];
  private materials: Map<string, StandardMaterial> = new Map();

  // Lighting
  private flickerLights: FlickerLight[] = [];
  private horrorAmbient: HemisphericLight | null = null;

  // Area zones for phase triggers
  private areaZones: AreaZone[] = [];

  // Terminal interaction
  private terminal: Mesh | null = null;
  private terminalLight: PointLight | null = null;
  private logsAccessed = false;

  // Marcus's mech
  private mechMesh: Mesh | null = null;
  private mechEyeLight: PointLight | null = null;

  // Underground hatch
  private undergroundHatch: Mesh | null = null;
  private hatchOpen = false;

  // Objective marker
  private objectiveMarker: Mesh | null = null;

  // Flashlight system
  private flashlight: PointLight | null = null;
  private flashlightOn = false;

  // Enemy spawns for ambush
  private ambushTriggered = false;
  private readonly maxEnemies = 5;
  private enemies: Array<{
    mesh: Mesh | TransformNode;
    health: number;
    position: Vector3;
    state: 'idle' | 'chase' | 'attack';
    attackCooldown: number;
  }> = [];
  private ambushEnemiesPreloaded = false;

  // Action button callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Modular base (corridor segments from ModularBaseBuilder)
  private modularBaseResult: ModularBaseResult | null = null;

  // Blood decals for horror atmosphere
  private bloodDecals: Mesh[] = [];

  // Alien vehicle wrecks in courtyard
  private alienVehicles: TransformNode[] = [];

  // Comms messages delivered
  private messageFlags: Set<string> = new Set();

  // Mining outpost bonus level access
  private miningTerminal: Mesh | null = null;
  private miningTerminalLight: PointLight | null = null;
  private miningTerminalAccessed = false;

  // Supply pickup system
  private supplyPickups: Array<{
    mesh: TransformNode;
    type: 'ammo' | 'health' | 'armor';
    amount: number;
    position: Vector3;
    collected: boolean;
    glowLight: PointLight;
  }> = [];

  // Fortification meshes
  private fortificationMeshes: TransformNode[] = [];

  // Defense turret system (destroyed turrets for atmosphere)
  private turretPositions: Array<{
    position: Vector3;
    destroyed: boolean;
    light: PointLight | null;
  }> = [];

  // Spotlight system for perimeter
  private spotlights: Array<{
    light: PointLight;
    baseRotation: number;
    sweepSpeed: number;
    active: boolean;
  }> = [];

  // Combat state
  private meleeCooldown = 0;
  private primaryFireCooldown = 0;
  private readonly MELEE_DAMAGE = 50;
  private readonly MELEE_RANGE = 3;
  private readonly MELEE_COOLDOWN = 800; // ms
  private readonly PRIMARY_FIRE_DAMAGE = 25;
  private readonly PRIMARY_FIRE_RANGE = 50;
  private readonly PRIMARY_FIRE_COOLDOWN = 150; // ms

  // Phase timing
  private phaseTime = 0;

  // Current objective position
  private currentObjective: Vector3 | null = null;

  // Enemy tracking
  private enemyCount = 0;
  private killCount = 0;

  protected getBackgroundColor(): Color4 {
    // Very dark, almost black - horror atmosphere
    return new Color4(0.008, 0.008, 0.012, 1);
  }

  protected async createEnvironment(): Promise<void> {
    // Create root node
    this.fobRoot = new TransformNode('fobDelta', this.scene);

    // Initialize AssetManager with scene
    AssetManager.init(this.scene);

    // Initialize particle manager for combat effects
    particleManager.init(this.scene);

    // Initialize damage feedback system
    damageFeedback.init(this.scene);
    damageFeedback.setScreenShakeCallback((intensity) => this.triggerShake(intensity));

    // Batch-preload all FOB Delta GLB assets
    await this.preloadFOBAssets();

    // Create materials
    this.createMaterials();

    // Set up horror lighting
    this.setupHorrorLighting();

    // Build the FOB
    this.createPerimeter();
    this.createCourtyard();
    this.createBarracks();
    this.createCommandCenter();
    this.createVehicleBay();
    this.createUndergroundAccess();

    // Build modular base corridors (adds interior structure to the FOB)
    await this.buildModularBaseStructure();

    // Create fortifications (sandbags, barriers, defensive positions)
    this.createFortifications();

    // Create supply pickups (ammo, health, armor)
    this.createSupplyPickups();

    // Create destroyed turret/defense positions
    this.createDestroyedDefenses();

    // Create perimeter spotlights (some working, some destroyed)
    this.createPerimeterSpotlights();

    // Add blood decals
    this.createBloodDecals();

    // Load and place crashed alien vehicles
    await this.createAlienVehicleWrecks();

    // Preload ambush enemy GLB models
    await this.preloadAmbushEnemyModels();

    // Create objective marker
    this.createObjectiveMarker();

    // Create player flashlight
    this.createFlashlight();

    // Setup area zones
    this.setupAreaZones();

    // Start the level
    this.startLevel();

    // Set up environmental audio for horror atmosphere
    this.setupHorrorEnvironmentalAudio();
  }

  /**
   * Set up spatial sound sources for immersive horror atmosphere.
   * Creaking structures, distant movements, electrical shorts, and wind.
   */
  private setupHorrorEnvironmentalAudio(): void {
    // Wind howling through broken structures
    this.addSpatialSound(
      'wind_perimeter',
      'wind_howl',
      { x: 0, y: 3, z: -30 },
      {
        maxDistance: 25,
        volume: 0.4,
      }
    );
    this.addSpatialSound(
      'wind_courtyard',
      'wind_howl',
      { x: 0, y: 5, z: 15 },
      {
        maxDistance: 30,
        volume: 0.3,
      }
    );

    // Debris settling and metal creaks (horror atmosphere)
    this.addSpatialSound(
      'creak_barracks',
      'debris_settling',
      { x: -20, y: 2, z: 10 },
      {
        maxDistance: 15,
        volume: 0.35,
        interval: 8000,
      }
    );
    this.addSpatialSound(
      'creak_command',
      'debris_settling',
      { x: 20, y: 2, z: 10 },
      {
        maxDistance: 12,
        volume: 0.4,
        interval: 10000,
      }
    );
    this.addSpatialSound(
      'creak_vehicle_bay',
      'debris_settling',
      { x: 0, y: 2, z: 35 },
      {
        maxDistance: 18,
        volume: 0.45,
        interval: 7000,
      }
    );

    // Electrical shorts from damaged panels (flickering sounds)
    this.addSpatialSound(
      'electric_barracks',
      'electrical_panel',
      { x: -18, y: 2, z: 8 },
      {
        maxDistance: 8,
        volume: 0.25,
      }
    );
    this.addSpatialSound(
      'electric_command',
      'electrical_panel',
      { x: 22, y: 2, z: 12 },
      {
        maxDistance: 6,
        volume: 0.2,
      }
    );

    // Computer terminal beeps in command center
    this.addSpatialSound(
      'terminal_command',
      'terminal',
      { x: 20, y: 1.5, z: 10 },
      {
        maxDistance: 8,
        volume: 0.2,
        interval: 5000,
      }
    );

    // Radio static (distant garbled transmissions) - multiple sources for atmosphere
    this.addSpatialSound(
      'radio_command',
      'radio_static',
      { x: 18, y: 1.5, z: 12 },
      {
        maxDistance: 10,
        volume: 0.15,
      }
    );

    // Dripping water (from broken pipes)
    this.addSpatialSound(
      'drip_barracks',
      'dripping',
      { x: -22, y: 0, z: 5 },
      {
        maxDistance: 8,
        volume: 0.3,
        interval: 4000,
      }
    );

    // Additional radio sources for military atmosphere
    this.addSpatialSound(
      'radio_barracks',
      'radio_static',
      { x: -25, y: 1.5, z: 0 },
      {
        maxDistance: 8,
        volume: 0.1,
        interval: 15000,
      }
    );
    this.addSpatialSound(
      'radio_vehicle_bay',
      'radio_static',
      { x: 28, y: 1.5, z: 5 },
      {
        maxDistance: 10,
        volume: 0.12,
        interval: 12000,
      }
    );

    // Distant electrical sounds (broken systems)
    this.addSpatialSound(
      'electric_distant_1',
      'electrical_panel',
      { x: -35, y: 3, z: -20 },
      {
        maxDistance: 35,
        volume: 0.08,
        interval: 20000,
      }
    );
    this.addSpatialSound(
      'electric_distant_2',
      'electrical_panel',
      { x: 35, y: 3, z: 25 },
      {
        maxDistance: 40,
        volume: 0.06,
        interval: 25000,
      }
    );

    // Generator hum in vehicle bay
    this.addSpatialSound(
      'generator_vehicle_bay',
      'generator',
      { x: 30, y: 0, z: 0 },
      {
        maxDistance: 20,
        volume: 0.25,
      }
    );

    // Define audio zones - base environment is darker/more oppressive
    this.addAudioZone('zone_perimeter', 'base', { x: 0, y: 0, z: -20 }, 25, {
      isIndoor: false,
      intensity: 0.4,
    });
    this.addAudioZone('zone_courtyard', 'base', { x: 0, y: 0, z: 15 }, 30, {
      isIndoor: false,
      intensity: 0.5,
    });
    this.addAudioZone('zone_barracks', 'base', { x: -20, y: 0, z: 10 }, 15, {
      isIndoor: true,
      intensity: 0.6,
      highThreat: true,
    });
    this.addAudioZone('zone_command', 'base', { x: 20, y: 0, z: 10 }, 15, {
      isIndoor: true,
      intensity: 0.5,
    });
    this.addAudioZone('zone_vehicle_bay', 'base', { x: 0, y: 0, z: 35 }, 20, {
      isIndoor: true,
      intensity: 0.7,
      highThreat: true,
    });
  }

  /**
   * Batch-preload all GLB models used by the FOB Delta level.
   * Loads every path in ALL_FOB_GLB_PATHS in parallel so that
   * subsequent createInstanceByPath calls are instant.
   */
  private async preloadFOBAssets(): Promise<void> {
    const results = await Promise.all(
      ALL_FOB_GLB_PATHS.map(async (path) => {
        const result = await AssetManager.loadAssetByPath(path, this.scene);
        return { path, success: result !== null };
      })
    );
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      log.warn(
        `Failed to load ${failed.length}/${ALL_FOB_GLB_PATHS.length} GLB assets: ${failed.map((r) => r.path).join(', ')}`
      );
    }
    log.info(`Preloaded ${results.length - failed.length}/${ALL_FOB_GLB_PATHS.length} GLB assets`);
  }

  /**
   * Helper: create a GLB instance by path with position/rotation/scale,
   * parented to fobRoot. Returns the TransformNode or null if the asset
   * is not cached (graceful degradation).
   */
  private placeGLB(
    path: string,
    name: string,
    position: Vector3,
    opts?: { rotationY?: number; scale?: number; rotation?: Vector3 }
  ): TransformNode | null {
    if (!AssetManager.isPathCached(path)) return null;
    const node = AssetManager.createInstanceByPath(path, name, this.scene, true, 'environment');
    if (!node) return null;
    node.position = position;
    if (opts?.rotation) {
      node.rotation = opts.rotation;
    } else if (opts?.rotationY !== undefined) {
      node.rotation.y = opts.rotationY;
    }
    if (opts?.scale !== undefined) {
      node.scaling.setAll(opts.scale);
    }
    if (this.fobRoot) {
      node.parent = this.fobRoot;
    }
    return node;
  }

  private createMaterials(): void {
    // Concrete/cement - base walls and floors
    const concrete = new StandardMaterial('concrete', this.scene);
    concrete.diffuseColor = Color3.FromHexString('#3A3A3A');
    concrete.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.set('concrete', concrete);

    // Military prefab - olive drab
    const military = new StandardMaterial('military', this.scene);
    military.diffuseColor = Color3.FromHexString('#4A4A32');
    military.specularColor = new Color3(0.15, 0.15, 0.1);
    this.materials.set('military', military);

    // Metal - darker industrial
    const metal = new StandardMaterial('metal', this.scene);
    metal.diffuseColor = Color3.FromHexString('#2A2A2A');
    metal.specularColor = new Color3(0.3, 0.3, 0.3);
    this.materials.set('metal', metal);

    // Damaged metal - rusted
    const damaged = new StandardMaterial('damaged', this.scene);
    damaged.diffuseColor = Color3.FromHexString('#4A3228');
    damaged.specularColor = new Color3(0.1, 0.08, 0.06);
    this.materials.set('damaged', damaged);

    // Blood - red decals
    const blood = new StandardMaterial('blood', this.scene);
    blood.diffuseColor = Color3.FromHexString('#3A0808');
    blood.specularColor = new Color3(0.4, 0.1, 0.1);
    this.materials.set('blood', blood);

    // Terminal screen - glowing
    const terminal = new StandardMaterial('terminal', this.scene);
    terminal.diffuseColor = Color3.FromHexString('#001A00');
    terminal.emissiveColor = Color3.FromHexString('#00FF44');
    terminal.specularColor = new Color3(0.5, 0.5, 0.5);
    this.materials.set('terminal', terminal);

    // Mech - Marcus's damaged Titan
    const mech = new StandardMaterial('mech', this.scene);
    mech.diffuseColor = Color3.FromHexString('#3A3A32');
    mech.specularColor = new Color3(0.2, 0.2, 0.2);
    this.materials.set('mech', mech);

    // Mech eyes - eerie glow
    const mechEyes = new StandardMaterial('mechEyes', this.scene);
    mechEyes.diffuseColor = Color3.FromHexString('#220000');
    mechEyes.emissiveColor = Color3.FromHexString('#FF2200');
    this.materials.set('mechEyes', mechEyes);

    // Sandbag
    const sandbag = new StandardMaterial('sandbag', this.scene);
    sandbag.diffuseColor = Color3.FromHexString('#6A5A4A');
    sandbag.specularColor = new Color3(0.05, 0.05, 0.05);
    this.materials.set('sandbag', sandbag);

    // Caution stripes
    const caution = new StandardMaterial('caution', this.scene);
    caution.diffuseColor = Color3.FromHexString('#C4A000');
    caution.specularColor = new Color3(0.2, 0.2, 0.1);
    this.materials.set('caution', caution);

    // Hatch - underground access
    const hatch = new StandardMaterial('hatch', this.scene);
    hatch.diffuseColor = Color3.FromHexString('#2A2A2A');
    hatch.specularColor = new Color3(0.4, 0.4, 0.4);
    this.materials.set('hatch', hatch);

    // Ground - rocky dirt
    const ground = new StandardMaterial('ground', this.scene);
    ground.diffuseColor = Color3.FromHexString('#4A3A2A');
    ground.specularColor = new Color3(0.05, 0.05, 0.05);
    this.materials.set('ground', ground);
  }

  private setupHorrorLighting(): void {
    // Disable base level lights
    if (this.sunLight) {
      this.sunLight.intensity = 0;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0;
    }

    // Very dark ambient - minimal visibility (horror atmosphere)
    this.horrorAmbient = new HemisphericLight('horrorAmbient', new Vector3(0, 1, 0), this.scene);
    this.horrorAmbient.intensity = 0.12;
    this.horrorAmbient.diffuse = new Color3(0.2, 0.2, 0.25);
    this.horrorAmbient.groundColor = new Color3(0.05, 0.05, 0.08);
  }

  private addFlickerLight(
    position: Vector3,
    color: Color3 = new Color3(1, 0.9, 0.7),
    intensity: number = 0.6,
    flickerAmount: number = 0.4,
    flickerSpeed: number = 10
  ): PointLight {
    const light = new PointLight(`flicker_${this.flickerLights.length}`, position, this.scene);
    light.diffuse = color;
    light.intensity = intensity;
    light.range = 15;

    this.flickerLights.push({
      light,
      baseIntensity: intensity,
      flickerSpeed,
      flickerAmount,
      timer: Math.random() * Math.PI * 2,
      isOff: false,
      offDuration: 0,
      offTimer: 0,
    });

    return light;
  }

  private createPerimeter(): void {
    // Ground plane - tile large asphalt GLBs in a grid pattern
    const groundTileSize = 20; // Approximate GLB tile coverage
    const groundExtent = 100; // Half-width of total ground coverage
    const asphaltModels = Object.values(GLB_GROUND);

    for (let gx = -groundExtent; gx < groundExtent; gx += groundTileSize) {
      for (let gz = -groundExtent; gz < groundExtent; gz += groundTileSize) {
        // Vary tile models for visual interest
        const modelIdx = Math.abs(Math.floor(gx + gz)) % asphaltModels.length;
        const path = asphaltModels[modelIdx];
        this.placeGLB(
          path,
          `ground_${gx}_${gz}`,
          new Vector3(gx + groundTileSize / 2, 0, gz + groundTileSize / 2),
          { scale: 2.0, rotationY: (Math.floor((gx + gz) / groundTileSize) % 4) * (Math.PI / 2) }
        );
      }
    }

    // Invisible collision ground for player/physics (procedural - collision volume)
    const groundCollision = MeshBuilder.CreateGround(
      'fobGroundCollision',
      { width: 200, height: 200, subdivisions: 1 },
      this.scene
    );
    groundCollision.isVisible = false;
    groundCollision.parent = this.fobRoot;
    this.allMeshes.push(groundCollision);

    // Perimeter walls (damaged) - use GLB wall segments
    const perimeterSize = 80;
    const wallSegmentLength = 8; // Approximate length of one wall_hr_1 GLB

    // Define wall runs: direction, fixed coordinate, start, end, breached sections
    const wallRuns: Array<{
      dir: 'x' | 'z';
      fixed: number;
      start: number;
      end: number;
      skipFrom?: number;
      skipTo?: number;
    }> = [
      // Front wall (with breach from -10 to +10)
      {
        dir: 'x',
        fixed: -perimeterSize / 2,
        start: -perimeterSize / 2,
        end: perimeterSize / 2,
        skipFrom: -10,
        skipTo: 10,
      },
      // Left wall
      { dir: 'z', fixed: -perimeterSize / 2, start: -perimeterSize / 2, end: perimeterSize / 2 },
      // Right wall
      { dir: 'z', fixed: perimeterSize / 2, start: -perimeterSize / 2, end: perimeterSize / 2 },
      // Back wall
      { dir: 'x', fixed: perimeterSize / 2, start: -perimeterSize / 2, end: perimeterSize / 2 },
    ];

    let wallIdx = 0;
    for (const run of wallRuns) {
      for (let pos = run.start; pos < run.end; pos += wallSegmentLength) {
        // Skip breached section
        if (run.skipFrom !== undefined && run.skipTo !== undefined) {
          if (pos >= run.skipFrom && pos < run.skipTo) continue;
        }

        // Alternate wall GLBs, use hole variant near breach
        const nearBreach =
          run.skipFrom !== undefined &&
          (Math.abs(pos - run.skipFrom) < wallSegmentLength ||
            Math.abs(pos - run.skipTo!) < wallSegmentLength);
        const wallPath = nearBreach
          ? GLB_PERIMETER.wall_hr_1_hole_2
          : wallIdx % 2 === 0
            ? GLB_PERIMETER.wall_hr_1
            : GLB_PERIMETER.wall_hr_15;

        const x = run.dir === 'x' ? pos + wallSegmentLength / 2 : run.fixed;
        const z = run.dir === 'z' ? pos + wallSegmentLength / 2 : run.fixed;
        const rotY = run.dir === 'z' ? Math.PI / 2 : 0;

        this.placeGLB(wallPath, `perimeterWall_${wallIdx}`, new Vector3(x, 0, z), {
          rotationY: rotY,
          scale: 1.5,
        });
        wallIdx++;
      }
    }

    // Breach debris at entry -- GLB debris models
    const debrisModels = Object.values(GLB_DEBRIS);
    for (let i = 0; i < 8; i++) {
      const path = debrisModels[i % debrisModels.length];
      const scale = 0.8 + Math.random() * 1.2;
      this.placeGLB(
        path,
        `debris_${i}`,
        new Vector3(-8 + Math.random() * 16, 0, -perimeterSize / 2 + Math.random() * 8),
        { rotationY: Math.random() * Math.PI, scale }
      );
    }

    // Sandbag barriers at entry (damaged) -- GLB cement bag pallets
    const barrierModels = Object.values(GLB_BARRIERS);
    for (let i = 0; i < 4; i++) {
      const path = barrierModels[i % barrierModels.length];
      const angle = (i / 4) * Math.PI - Math.PI / 2;
      this.placeGLB(
        path,
        `sandbag_${i}`,
        new Vector3(Math.sin(angle) * 12, 0, -perimeterSize / 2 + 10 + Math.cos(angle) * 5),
        { rotationY: angle + Math.random() * 0.5, scale: 1.5 }
      );
    }

    // Entry light (flickering)
    this.addFlickerLight(
      new Vector3(0, 3.5, -perimeterSize / 2 + 5),
      new Color3(1, 0.8, 0.6),
      0.4,
      0.6,
      15
    );
  }

  private createCourtyard(): void {
    // Central open area with overturned vehicles and crates

    // Overturned vehicle -- GLB shipping container tipped on its side
    this.placeGLB(GLB_COURTYARD.shipping_container, 'overturnedVehicle', new Vector3(-8, 0.3, 0), {
      rotation: new Vector3(0, 0.3, Math.PI / 3),
      scale: 1.8,
    });

    // Wheels scattered around overturned vehicle -- GLB tire models
    const tireModels = [GLB_COURTYARD.tire_1, GLB_COURTYARD.tire_2];
    for (let i = 0; i < 4; i++) {
      const path = tireModels[i % tireModels.length];
      const xOff = i < 2 ? -1.2 : 1.2;
      const zOff = i % 2 === 0 ? -2 : 2;
      this.placeGLB(path, `wheel_${i}`, new Vector3(-8 + xOff, 0, zOff), {
        rotationY: Math.random() * Math.PI,
        scale: 0.8,
      });
    }

    // Scattered crates -- GLB wooden crate variants
    const cratePositions = [
      new Vector3(5, 0, -5),
      new Vector3(7, 0, -3),
      new Vector3(5, 0.8, -4),
      new Vector3(-3, 0, 8),
      new Vector3(-5, 0, 7),
      new Vector3(12, 0, 5),
      new Vector3(10, 0, 3),
    ];
    const crateModels = [
      GLB_COURTYARD.wooden_crate_1,
      GLB_COURTYARD.wooden_crate_2a,
      GLB_COURTYARD.wooden_crate_2b,
      GLB_COURTYARD.wooden_crate_3,
      GLB_COURTYARD.wooden_crate_hx_2,
      GLB_COURTYARD.wooden_crate_hx_3,
      GLB_COURTYARD.wooden_crate_hx_4,
    ];

    for (let i = 0; i < cratePositions.length; i++) {
      const path = crateModels[i % crateModels.length];
      this.placeGLB(path, `crate_${i}`, cratePositions[i].clone(), {
        rotationY: Math.random() * Math.PI,
        scale: 0.8 + Math.random() * 0.4,
      });
    }

    // Barrels -- GLB metal barrel variants
    const barrelModels = [
      GLB_COURTYARD.metal_barrel_1,
      GLB_COURTYARD.metal_barrel_2,
      GLB_COURTYARD.metal_barrel_3,
      GLB_COURTYARD.metal_barrel_4,
      GLB_COURTYARD.barrel_atmo,
    ];
    for (let i = 0; i < 5; i++) {
      const path = barrelModels[i % barrelModels.length];
      this.placeGLB(
        path,
        `barrel_${i}`,
        new Vector3(-15 + Math.random() * 30, 0, -10 + Math.random() * 20),
        { rotationY: Math.random() * Math.PI * 2 }
      );
    }

    // Courtyard lights (flickering)
    this.addFlickerLight(new Vector3(0, 4, 0), new Color3(1, 0.9, 0.7), 0.5, 0.5, 8);
    this.addFlickerLight(new Vector3(-15, 4, 10), new Color3(1, 0.8, 0.6), 0.4, 0.7, 12);
    this.addFlickerLight(new Vector3(15, 4, -10), new Color3(1, 0.7, 0.5), 0.3, 0.8, 20);
  }

  private createBarracks(): void {
    // Barracks building - west side
    const barracksX = -25;
    const barracksZ = 0;

    // Main structure -- GLB warehouse model
    this.placeGLB(GLB_BUILDINGS.warehouse_1, 'barracks', new Vector3(barracksX, 0, barracksZ), {
      scale: 3.0,
    });

    // Door opening -- GLB door model
    this.placeGLB(
      GLB_COMMAND.door_hr_6,
      'barracksDoor',
      new Vector3(barracksX + 6.3, 0, barracksZ),
      { scale: 1.2 }
    );

    // Interior bunks (visible through door) -- GLB bench models
    const bunkModels = [
      GLB_BARRACKS.bench_1,
      GLB_BARRACKS.bench_2,
      GLB_BARRACKS.bench_3,
      GLB_BARRACKS.bench_1,
    ];
    for (let i = 0; i < 4; i++) {
      const path = bunkModels[i % bunkModels.length];
      this.placeGLB(path, `bunk_${i}`, new Vector3(barracksX - 3, 0, barracksZ - 6 + i * 4), {
        rotationY: Math.PI / 2,
        scale: 1.0,
      });
    }

    // Barracks interior light (dim, flickering)
    this.addFlickerLight(
      new Vector3(barracksX, 3.5, barracksZ),
      new Color3(1, 0.7, 0.5),
      0.3,
      0.9,
      25
    );

    // Bodies -- GLB marine soldier models laid on the ground (horror element)
    const bodyPositions = [
      new Vector3(barracksX + 2, 0, barracksZ - 3),
      new Vector3(barracksX - 2, 0, barracksZ + 5),
    ];

    for (let i = 0; i < bodyPositions.length; i++) {
      this.placeGLB(GLB_BARRACKS.marine_body, `body_${i}`, bodyPositions[i].clone(), {
        rotation: new Vector3(Math.PI / 2, Math.random() * Math.PI, 0),
        scale: 0.5,
      });
    }

    // Mining Outpost Gamma-7 terminal (bonus level access) -- GLB computer model
    // NOTE: miningTerminal is kept as a Mesh for interaction distance checks,
    // but we place a GLB computer visually and use a hidden collision box.
    this.placeGLB(
      GLB_COMMAND.computer_sm,
      'miningTerminalGLB',
      new Vector3(barracksX - 3, 0, barracksZ + 8),
      { scale: 1.2 }
    );
    // Hidden interaction mesh (invisible box for distance checks)
    this.miningTerminal = MeshBuilder.CreateBox(
      'miningTerminal',
      { width: 1.2, height: 1.5, depth: 0.6 },
      this.scene
    );
    this.miningTerminal.position.set(barracksX - 3, 0.75, barracksZ + 8);
    this.miningTerminal.isVisible = false;
    this.miningTerminal.parent = this.fobRoot;
    this.allMeshes.push(this.miningTerminal);

    // Green glow for mining terminal
    this.miningTerminalLight = new PointLight(
      'miningTerminalLight',
      new Vector3(barracksX - 3, 1.5, barracksZ + 8),
      this.scene
    );
    this.miningTerminalLight.diffuse = new Color3(0.1, 0.8, 0.3);
    this.miningTerminalLight.intensity = 0.3;
    this.miningTerminalLight.range = 5;
  }

  private createCommandCenter(): void {
    // Command Center - north side
    const cmdX = 0;
    const cmdZ = 25;

    // Main structure -- GLB warehouse model
    this.placeGLB(GLB_BUILDINGS.warehouse_2, 'commandCenter', new Vector3(cmdX, 0, cmdZ), {
      scale: 3.5,
    });

    // Door -- GLB door model
    this.placeGLB(GLB_COMMAND.door_hr_8, 'cmdDoor', new Vector3(cmdX, 0, cmdZ - 5.3), {
      scale: 1.2,
    });

    // Terminal base -- GLB computer model
    this.placeGLB(GLB_COMMAND.computer, 'terminalBase', new Vector3(cmdX, 0, cmdZ + 2));

    // Terminal screen (kept as MeshBuilder -- interactive UI surface with emissive material)
    this.terminal = MeshBuilder.CreatePlane(
      'terminalScreen',
      { width: 1.2, height: 0.8 },
      this.scene
    );
    this.terminal.position.set(cmdX, 1.5, cmdZ + 1.6);
    this.terminal.rotation.x = -0.2; // Tilted toward player
    this.terminal.material = this.materials.get('terminal')!;
    this.terminal.parent = this.fobRoot;
    this.allMeshes.push(this.terminal);

    // Terminal light (green glow)
    this.terminalLight = new PointLight(
      'terminalLight',
      new Vector3(cmdX, 1.5, cmdZ + 1),
      this.scene
    );
    this.terminalLight.diffuse = Color3.FromHexString('#00FF44');
    this.terminalLight.intensity = 0.3;
    this.terminalLight.range = 5;

    // Command center interior light
    this.addFlickerLight(new Vector3(cmdX, 4, cmdZ), new Color3(0.8, 0.9, 1), 0.4, 0.3, 5);

    // Comm tower outside -- GLB chimney model (tall vertical structure)
    this.placeGLB(GLB_COMMAND.chimney, 'commTower', new Vector3(cmdX + 10, 0, cmdZ), {
      scale: 3.0,
    });

    // Antenna platform (GLB) - acts as dish mount / radar platform
    this.placeGLB(
      GLB_ANTENNA_PLATFORM.platform_small,
      'antennaPlatform',
      new Vector3(cmdX + 10, 10, cmdZ),
      { rotation: new Vector3(-Math.PI / 4, 0, 0), scale: 2.5 }
    );
  }

  private createVehicleBay(): void {
    // Vehicle Bay - east side (where mech is)
    const bayX = 25;
    const bayZ = 0;

    // Hangar-style structure -- GLB garages block model
    this.placeGLB(GLB_BUILDINGS.garages_block, 'vehicleBay', new Vector3(bayX, 0, bayZ), {
      scale: 4.0,
    });

    // Large rolling door frame -- GLB garage door frame
    this.placeGLB(
      GLB_BUILDINGS.garage_door_frame_1,
      'bayDoorFrame',
      new Vector3(bayX - 10.3, 0, bayZ),
      { scale: 2.5 }
    );

    // Caution stripes around door -- GLB directional arrow details
    const cautionModels = [GLB_DETAILS.arrow, GLB_DETAILS.arrow_2, GLB_DETAILS.caution_plate];
    for (let i = 0; i < 3; i++) {
      const path = cautionModels[i % cautionModels.length];
      this.placeGLB(path, `bayStripe_${i}`, new Vector3(bayX - 10.3, 1 + i * 2.5, bayZ), {
        scale: 2.0,
      });
    }

    // Marcus's damaged mech (TITAN)
    this.createMech(new Vector3(bayX + 2, 0, bayZ));

    // Vehicle bay lights (most are dead/flickering badly)
    this.addFlickerLight(new Vector3(bayX, 7, bayZ - 8), new Color3(1, 0.6, 0.4), 0.2, 0.95, 30);
    this.addFlickerLight(new Vector3(bayX, 7, bayZ + 8), new Color3(1, 0.7, 0.5), 0.15, 0.9, 25);
  }

  private createMech(position: Vector3): void {
    // Marcus's TITAN mech - GLB model with eerie eye glow

    // Place the mech GLB model
    this.placeGLB(GLB_MECH.marcus_mech, 'marcusMech', position, { scale: 2.0 });

    // Invisible collision box for interaction distance checks (mechMesh reference)
    this.mechMesh = MeshBuilder.CreateBox(
      'mechHead',
      { width: 2, height: 1.5, depth: 1.5 },
      this.scene
    );
    this.mechMesh.position.set(position.x, 7.5, position.z);
    this.mechMesh.isVisible = false;
    this.mechMesh.parent = this.fobRoot;
    this.allMeshes.push(this.mechMesh);

    // Eyes (glowing red VFX spheres - kept as MeshBuilder for emissive effect)
    const leftEye = MeshBuilder.CreateSphere(
      'mechLeftEye',
      { diameter: 0.3, segments: 8 },
      this.scene
    );
    leftEye.position.set(position.x - 0.4, 7.6, position.z - 0.8);
    leftEye.material = this.materials.get('mechEyes')!;
    leftEye.parent = this.fobRoot;
    this.allMeshes.push(leftEye);

    const rightEye = MeshBuilder.CreateSphere(
      'mechRightEye',
      { diameter: 0.3, segments: 8 },
      this.scene
    );
    rightEye.position.set(position.x + 0.4, 7.6, position.z - 0.8);
    rightEye.material = this.materials.get('mechEyes')!;
    rightEye.parent = this.fobRoot;
    this.allMeshes.push(rightEye);

    // Eye light
    this.mechEyeLight = new PointLight(
      'mechEyeLight',
      new Vector3(position.x, 7.6, position.z - 1),
      this.scene
    );
    this.mechEyeLight.diffuse = Color3.FromHexString('#FF2200');
    this.mechEyeLight.intensity = 0.3;
    this.mechEyeLight.range = 8;
  }

  private createUndergroundAccess(): void {
    // Underground access hatch - in vehicle bay
    const hatchX = 30;
    const hatchZ = 10;

    // Floor plate around hatch (GLB) - decorative visual
    this.placeGLB(GLB_HATCH.floor_plate, 'hatchFloorPlate', new Vector3(hatchX, 0.02, hatchZ), {
      scale: 1.5,
    });

    // Hatch door (GLB) - visual representation
    this.placeGLB(GLB_HATCH.hatch_door, 'hatchDoorGLB', new Vector3(hatchX, 0.1, hatchZ), {
      scale: 1.2,
    });

    // Hatch handle (GLB pipe)
    this.placeGLB(GLB_HATCH.hatch_handle, 'hatchHandleGLB', new Vector3(hatchX, 0.3, hatchZ), {
      rotation: new Vector3(Math.PI / 2, 0, 0),
      scale: 0.8,
    });

    // Invisible collision mesh for interaction (kept procedural - collision volume)
    this.undergroundHatch = MeshBuilder.CreateCylinder(
      'hatchCollision',
      { height: 0.3, diameter: 2.5, tessellation: 8 },
      this.scene
    );
    this.undergroundHatch.position.set(hatchX, 0.15, hatchZ);
    this.undergroundHatch.isVisible = false;
    this.undergroundHatch.parent = this.fobRoot;
    this.allMeshes.push(this.undergroundHatch);

    // Caution marking (kept procedural - special emissive caution material for gameplay visibility)
    const cautionRing = MeshBuilder.CreateTorus(
      'hatchCaution',
      { diameter: 3.5, thickness: 0.15, tessellation: 32 },
      this.scene
    );
    cautionRing.position.set(hatchX, 0.1, hatchZ);
    cautionRing.rotation.x = Math.PI / 2;
    cautionRing.material = this.materials.get('caution')!;
    cautionRing.parent = this.fobRoot;
    this.allMeshes.push(cautionRing);
  }

  /**
   * Build the interior modular base corridors that connect the major FOB
   * buildings (barracks, command center, vehicle bay). Uses the shared
   * ModularBaseBuilder for consistent, asset-driven corridor geometry with
   * battle damage and horror-style flickering lights.
   *
   * DENSITY OVERHAUL: This method now places a large number of Quaternius
   * modular GLB assets (floor tiles, walls, doors, columns, roof details,
   * vents, pipes, crates) plus graffiti/poster decals and an external
   * station silhouette visible through corridor windows. The goal is a
   * claustrophobic, Dead Space / Alien: Isolation atmosphere -- every
   * surface has geometry, every corridor has clutter and damage.
   */
  private async buildModularBaseStructure(): Promise<void> {
    // ================================================================
    // PHASE 1 -- Pre-load ALL Quaternius modular, decal, and external
    // assets by path so they are available for instancing.
    // ================================================================
    const modularBasePath = '/assets/models/environment/modular/';
    const decalBasePath = '/assets/models/props/decals/';
    const stationExtBasePath = '/assets/models/environment/station-external/';

    const modularGLBs: Record<string, string> = {
      // Floors
      floor_empty: `${modularBasePath}FloorTile_Empty.glb`,
      floor_hallway: `${modularBasePath}FloorTile_Double_Hallway.glb`,
      floor_basic: `${modularBasePath}FloorTile_Basic.glb`,
      floor_basic2: `${modularBasePath}FloorTile_Basic2.glb`,
      floor_side: `${modularBasePath}FloorTile_Side.glb`,
      floor_corner: `${modularBasePath}FloorTile_Corner.glb`,
      floor_inner_corner: `${modularBasePath}FloorTile_InnerCorner.glb`,
      // Walls
      wall_3: `${modularBasePath}Wall_3.glb`,
      wall_4: `${modularBasePath}Wall_4.glb`,
      wall_5: `${modularBasePath}Wall_5.glb`,
      wall_empty: `${modularBasePath}Wall_Empty.glb`,
      wall_1: `${modularBasePath}Wall_1.glb`,
      wall_2: `${modularBasePath}Wall_2.glb`,
      // Windows (walls with window cutouts)
      window_wall_a: `${modularBasePath}Window_Wall_SideA.glb`,
      window_wall_b: `${modularBasePath}Window_Wall_SideB.glb`,
      long_window_a: `${modularBasePath}LongWindow_Wall_SideA.glb`,
      small_windows_a: `${modularBasePath}SmallWindows_Wall_SideA.glb`,
      // Doors
      door_double: `${modularBasePath}Door_Double.glb`,
      door_single: `${modularBasePath}Door_Single.glb`,
      door_dbl_wall_a: `${modularBasePath}DoorDouble_Wall_SideA.glb`,
      door_dbl_wall_b: `${modularBasePath}DoorDouble_Wall_SideB.glb`,
      door_sgl_wall_a: `${modularBasePath}DoorSingle_Wall_SideA.glb`,
      door_sgl_wall_b: `${modularBasePath}DoorSingle_Wall_SideB.glb`,
      // Columns
      column_1: `${modularBasePath}Column_1.glb`,
      column_2: `${modularBasePath}Column_2.glb`,
      column_3: `${modularBasePath}Column_3.glb`,
      column_slim: `${modularBasePath}Column_Slim.glb`,
      // Roof / ceiling tiles
      roof_details: `${modularBasePath}RoofTile_Details.glb`,
      roof_pipes1: `${modularBasePath}RoofTile_Pipes1.glb`,
      roof_pipes2: `${modularBasePath}RoofTile_Pipes2.glb`,
      roof_plate: `${modularBasePath}RoofTile_Plate.glb`,
      roof_plate2: `${modularBasePath}RoofTile_Plate2.glb`,
      roof_empty: `${modularBasePath}RoofTile_Empty.glb`,
      roof_vents: `${modularBasePath}RoofTile_Vents.glb`,
      roof_small_vents: `${modularBasePath}RoofTile_SmallVents.glb`,
      roof_orange_vent: `${modularBasePath}RoofTile_OrangeVent.glb`,
      roof_sides_pipes: `${modularBasePath}RoofTile_Sides_Pipes.glb`,
      roof_corner_pipes: `${modularBasePath}RoofTile_Corner_Pipes.glb`,
      // Wall / ceiling detail panels
      detail_pipes_long: `${modularBasePath}Details_Pipes_Long.glb`,
      detail_pipes_med: `${modularBasePath}Details_Pipes_Medium.glb`,
      detail_pipes_sm: `${modularBasePath}Details_Pipes_Small.glb`,
      detail_vent3: `${modularBasePath}Details_Vent_3.glb`,
      detail_vent4: `${modularBasePath}Details_Vent_4.glb`,
      detail_vent5: `${modularBasePath}Details_Vent_5.glb`,
      detail_basic1: `${modularBasePath}Details_Basic_1.glb`,
      detail_basic2: `${modularBasePath}Details_Basic_2.glb`,
      detail_basic3: `${modularBasePath}Details_Basic_3.glb`,
      detail_basic4: `${modularBasePath}Details_Basic_4.glb`,
      detail_plate_sm: `${modularBasePath}Details_Plate_Small.glb`,
      detail_plate_lg: `${modularBasePath}Details_Plate_Large.glb`,
      detail_plate_long: `${modularBasePath}Details_Plate_Long.glb`,
      detail_x: `${modularBasePath}Details_X.glb`,
      detail_hexagon: `${modularBasePath}Details_Hexagon.glb`,
      detail_dots: `${modularBasePath}Details_Dots.glb`,
      detail_triangles: `${modularBasePath}Details_Triangles.glb`,
      detail_cylinder: `${modularBasePath}Details_Cylinder.glb`,
      detail_cyl_long: `${modularBasePath}Details_Cylinder_Long.glb`,
      detail_arrow: `${modularBasePath}Details_Arrow.glb`,
      detail_arrow2: `${modularBasePath}Details_Arrow_2.glb`,
      detail_output: `${modularBasePath}Details_Output.glb`,
      detail_output_sm: `${modularBasePath}Details_Output_Small.glb`,
      detail_plate_det: `${modularBasePath}Details_Plate_Details.glb`,
      // Props (crates, containers, furniture)
      crate: `${modularBasePath}Props_Crate.glb`,
      crate_long: `${modularBasePath}Props_CrateLong.glb`,
      container_full: `${modularBasePath}Props_ContainerFull.glb`,
      shelf_short: `${modularBasePath}Props_Shelf.glb`,
      shelf_tall: `${modularBasePath}Props_Shelf_Tall.glb`,
      computer: `${modularBasePath}Props_Computer.glb`,
      computer_sm: `${modularBasePath}Props_ComputerSmall.glb`,
      base_prop: `${modularBasePath}Props_Base.glb`,
      capsule: `${modularBasePath}Props_Capsule.glb`,
      laser: `${modularBasePath}Props_Laser.glb`,
      // Pipes
      pipes: `${modularBasePath}Pipes.glb`,
      // Staircase
      staircase: `${modularBasePath}Staircase.glb`,
    };

    const decalGLBs: Record<string, string> = {
      graffiti_1: `${decalBasePath}graffiti_mx_1.glb`,
      graffiti_2: `${decalBasePath}graffiti_mx_2.glb`,
      graffiti_4: `${decalBasePath}graffiti_mx_4.glb`,
      graffiti_5: `${decalBasePath}graffiti_mx_5.glb`,
      poster_4: `${decalBasePath}poster_cx_4.glb`,
      poster_5: `${decalBasePath}poster_cx_5.glb`,
      poster_9: `${decalBasePath}poster_cx_9.glb`,
      poster_11: `${decalBasePath}poster_cx_11.glb`,
    };

    const stationExtGLBs: Record<string, string> = {
      station04: `${stationExtBasePath}station04.glb`,
    };

    // Merge all paths for parallel loading
    const allPaths = {
      ...modularGLBs,
      ...decalGLBs,
      ...stationExtGLBs,
    };

    // Load all GLBs in parallel
    const loadPromises = Object.values(allPaths).map((path) =>
      AssetManager.loadAssetByPath(path, this.scene)
    );
    await Promise.all(loadPromises);

    // ================================================================
    // Helper: instance a modular GLB by its key
    // ================================================================
    let instanceCounter = 0;
    const place = (
      key: string,
      pos: { x: number; y: number; z: number },
      rotY: number = 0,
      scale: number = 1.0
    ): void => {
      const path = allPaths[key];
      if (!path || !AssetManager.isPathCached(path)) {
        return; // Asset not available, skip silently
      }
      const name = `fob_mod_${instanceCounter++}`;
      const inst = AssetManager.createInstanceByPath(path, name, this.scene, true, 'environment');
      if (inst) {
        inst.position = new Vector3(pos.x, pos.y, pos.z);
        inst.rotation = new Vector3(0, rotY, 0);
        if (scale !== 1.0) {
          inst.scaling = new Vector3(scale, scale, scale);
        }
        if (this.fobRoot) {
          inst.parent = this.fobRoot;
        }
      }
    };

    // ================================================================
    // PHASE 2 -- ModularBaseBuilder corridors (structural backbone)
    // ================================================================
    const layout: BaseSegment[] = [
      // --- Barracks wing (west corridor running south-to-north) ---
      { type: 'corridor', position: new Vector3(-18, 0, -6), rotation: 0 },
      { type: 'corridor', position: new Vector3(-18, 0, -2), rotation: 0 },
      { type: 'corridor', position: new Vector3(-18, 0, 2), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(-18, 0, 6), rotation: 0 },

      // --- Junction at barracks corridor / courtyard crossover ---
      { type: 'junction', position: new Vector3(-18, 0, 10), rotation: 0 },

      // --- East-west corridor linking barracks junction to courtyard ---
      { type: 'corridor', position: new Vector3(-14, 0, 10), rotation: Math.PI / 2 },
      { type: 'corridor', position: new Vector3(-10, 0, 10), rotation: Math.PI / 2, damaged: true },
      { type: 'wide', position: new Vector3(-6, 0, 10), rotation: Math.PI / 2 },
      { type: 'corridor', position: new Vector3(-2, 0, 10), rotation: Math.PI / 2 },

      // --- Central courtyard junction ---
      { type: 'junction', position: new Vector3(2, 0, 10), rotation: 0 },

      // --- North corridor from courtyard to command center ---
      { type: 'corridor', position: new Vector3(2, 0, 14), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(2, 0, 18), rotation: 0 },
      { type: 'corner', position: new Vector3(2, 0, 22), rotation: 0 },

      // --- East corridor from courtyard junction toward vehicle bay ---
      { type: 'corridor', position: new Vector3(6, 0, 10), rotation: Math.PI / 2 },
      { type: 'corridor', position: new Vector3(10, 0, 10), rotation: Math.PI / 2, damaged: true },
      { type: 'wide', position: new Vector3(14, 0, 10), rotation: Math.PI / 2 },
      { type: 'corridor', position: new Vector3(18, 0, 10), rotation: Math.PI / 2 },

      // --- Additional south wing (approach corridor from perimeter) ---
      { type: 'corridor', position: new Vector3(0, 0, -20), rotation: 0 },
      { type: 'corridor', position: new Vector3(0, 0, -16), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(0, 0, -12), rotation: 0 },
      { type: 'corridor', position: new Vector3(0, 0, -8), rotation: 0 },
      { type: 'junction', position: new Vector3(0, 0, -4), rotation: 0 },
      { type: 'corridor', position: new Vector3(0, 0, 0), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(0, 0, 4), rotation: 0 },

      // --- Vehicle bay internal corridors ---
      { type: 'corridor', position: new Vector3(22, 0, 10), rotation: Math.PI / 2 },
      { type: 'wide', position: new Vector3(22, 0, 6), rotation: 0 },
      { type: 'corridor', position: new Vector3(22, 0, 2), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(22, 0, -2), rotation: 0 },

      // --- North-west wing (barracks deep interior) ---
      { type: 'corridor', position: new Vector3(-22, 0, 10), rotation: Math.PI / 2 },
      { type: 'wide', position: new Vector3(-22, 0, 14), rotation: 0, damaged: true },
      { type: 'corridor', position: new Vector3(-22, 0, 18), rotation: 0 },
    ];

    try {
      this.modularBaseResult = await buildModularBase(
        this.scene,
        layout,
        {
          damageRatio: 0.45,
          lightingMode: 'horror',
          flickerIntensity: 1.5,
        },
        // Props handled below via direct placement for maximum density
        []
      );

      if (this.fobRoot && this.modularBaseResult) {
        this.modularBaseResult.root.parent = this.fobRoot;
      }
    } catch (error) {
      throw new Error(`[FOBDelta] ModularBaseBuilder failed: ${error}`);
    }

    // ================================================================
    // PHASE 3 -- FLOOR TILES along every corridor path
    // Dense tiling with hallway and basic variants
    // ================================================================
    const TILE = 4.0; // Quaternius tile size (4x4 units)

    // Barracks wing floors (west corridor Z = -6 to +10)
    for (let z = -6; z <= 10; z += TILE) {
      place('floor_hallway', { x: -18, y: 0, z }, 0);
    }
    // East-west corridor floors (X = -14 to +2, Z = 10)
    for (let x = -14; x <= 2; x += TILE) {
      place('floor_hallway', { x, y: 0, z: 10 }, Math.PI / 2);
    }
    // North corridor floors (X = 2, Z = 14 to 22)
    for (let z = 14; z <= 22; z += TILE) {
      place('floor_basic', { x: 2, y: 0, z }, 0);
    }
    // East corridor floors (X = 6 to 18, Z = 10)
    for (let x = 6; x <= 18; x += TILE) {
      place('floor_hallway', { x, y: 0, z: 10 }, Math.PI / 2);
    }
    // South approach corridor floors (X = 0, Z = -20 to +4)
    for (let z = -20; z <= 4; z += TILE) {
      place(z % 8 === 0 ? 'floor_basic2' : 'floor_hallway', { x: 0, y: 0, z }, 0);
    }
    // Vehicle bay internal floors
    for (let z = -2; z <= 10; z += TILE) {
      place('floor_basic', { x: 22, y: 0, z }, 0);
    }
    // Barracks deep wing floors
    for (let z = 10; z <= 18; z += TILE) {
      place('floor_empty', { x: -22, y: 0, z }, 0);
    }
    // Courtyard floor tiles (open area with battle-scarred tiles)
    for (let x = -8; x <= 8; x += TILE) {
      for (let z = -8; z <= 8; z += TILE) {
        const variant = (x + z) % 3 === 0 ? 'floor_empty' : 'floor_basic';
        place(variant, { x, y: 0.01, z }, ((x * 7 + z * 3) % 4) * (Math.PI / 2));
      }
    }

    // ================================================================
    // PHASE 4 -- WALLS along corridor edges
    // Alternating wall_3 / wall_4 / wall_empty for visual variety.
    // Walls placed on both sides of each corridor.
    // ================================================================
    const WALL_OFFSET = 2.8; // Half-width of corridor
    const WALL_Y = 0;
    const wallTypes = ['wall_3', 'wall_4', 'wall_empty', 'wall_3', 'wall_5', 'wall_4'];

    // Barracks wing walls (both sides of Z corridor at X=-18)
    for (let i = 0; i < 5; i++) {
      const z = -6 + i * TILE;
      const wt = wallTypes[i % wallTypes.length];
      place(wt, { x: -18 - WALL_OFFSET, y: WALL_Y, z }, 0);
      place(wallTypes[(i + 2) % wallTypes.length], { x: -18 + WALL_OFFSET, y: WALL_Y, z }, Math.PI);
    }
    // East-west corridor walls (both sides of X corridor at Z=10)
    for (let i = 0; i < 5; i++) {
      const x = -14 + i * TILE;
      const wt = wallTypes[(i + 1) % wallTypes.length];
      place(wt, { x, y: WALL_Y, z: 10 - WALL_OFFSET }, Math.PI / 2);
      place(
        wallTypes[(i + 3) % wallTypes.length],
        { x, y: WALL_Y, z: 10 + WALL_OFFSET },
        -Math.PI / 2
      );
    }
    // North corridor walls
    for (let i = 0; i < 3; i++) {
      const z = 14 + i * TILE;
      place('wall_3', { x: 2 - WALL_OFFSET, y: WALL_Y, z }, 0);
      place('wall_4', { x: 2 + WALL_OFFSET, y: WALL_Y, z }, Math.PI);
    }
    // East corridor walls
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * TILE;
      place(wallTypes[i % wallTypes.length], { x, y: WALL_Y, z: 10 - WALL_OFFSET }, Math.PI / 2);
      place(
        wallTypes[(i + 1) % wallTypes.length],
        { x, y: WALL_Y, z: 10 + WALL_OFFSET },
        -Math.PI / 2
      );
    }
    // South approach walls
    for (let i = 0; i < 7; i++) {
      const z = -20 + i * TILE;
      const wt = wallTypes[i % wallTypes.length];
      place(wt, { x: 0 - WALL_OFFSET, y: WALL_Y, z }, 0);
      place(wallTypes[(i + 3) % wallTypes.length], { x: 0 + WALL_OFFSET, y: WALL_Y, z }, Math.PI);
    }
    // Vehicle bay walls
    for (let i = 0; i < 4; i++) {
      const z = -2 + i * TILE;
      place('wall_empty', { x: 22 - WALL_OFFSET, y: WALL_Y, z }, 0);
      place('wall_3', { x: 22 + WALL_OFFSET, y: WALL_Y, z }, Math.PI);
    }

    // ================================================================
    // PHASE 5 -- DOORS at corridor junctions and room entries
    // Double doors mark transition points; single doors for side rooms
    // ================================================================
    // Barracks junction door
    place('door_double', { x: -18, y: 0, z: 10 }, Math.PI / 2);
    place('door_dbl_wall_a', { x: -18 - WALL_OFFSET, y: 0, z: 10 }, Math.PI / 2);
    place('door_dbl_wall_b', { x: -18 + WALL_OFFSET, y: 0, z: 10 }, Math.PI / 2);

    // Central courtyard junction door
    place('door_double', { x: 2, y: 0, z: 10 }, 0);
    place('door_dbl_wall_a', { x: 2, y: 0, z: 10 - WALL_OFFSET }, 0);
    place('door_dbl_wall_b', { x: 2, y: 0, z: 10 + WALL_OFFSET }, 0);

    // South junction door (approach to courtyard)
    place('door_double', { x: 0, y: 0, z: -4 }, 0);
    place('door_dbl_wall_a', { x: 0 - WALL_OFFSET, y: 0, z: -4 }, 0);

    // Vehicle bay entry door
    place('door_double', { x: 22, y: 0, z: 10 }, Math.PI / 2);

    // Command center approach door
    place('door_single', { x: 2, y: 0, z: 22 }, 0);
    place('door_sgl_wall_a', { x: 2 - WALL_OFFSET, y: 0, z: 22 }, 0);
    place('door_sgl_wall_b', { x: 2 + WALL_OFFSET, y: 0, z: 22 }, 0);

    // Barracks deep wing entry
    place('door_single', { x: -22, y: 0, z: 10 }, Math.PI / 2);

    // ================================================================
    // PHASE 6 -- COLUMNS at intersections and room corners
    // Structural pillars that break sight lines for horror tension
    // ================================================================
    // Courtyard columns (structural supports)
    place('column_3', { x: -6, y: 0, z: -4 }, 0);
    place('column_3', { x: 6, y: 0, z: -4 }, Math.PI / 2);
    place('column_3', { x: -6, y: 0, z: 4 }, -Math.PI / 2);
    place('column_3', { x: 6, y: 0, z: 4 }, Math.PI);
    // Junction columns
    place('column_1', { x: -18 - WALL_OFFSET, y: 0, z: 10 - WALL_OFFSET }, 0);
    place('column_1', { x: -18 + WALL_OFFSET, y: 0, z: 10 + WALL_OFFSET }, Math.PI);
    place('column_2', { x: 2 - WALL_OFFSET, y: 0, z: 10 - WALL_OFFSET }, 0);
    place('column_2', { x: 2 + WALL_OFFSET, y: 0, z: 10 + WALL_OFFSET }, Math.PI);
    // Vehicle bay columns (large open space needs supports)
    place('column_3', { x: 22, y: 0, z: 4 }, 0);
    place('column_3', { x: 22, y: 0, z: -2 }, Math.PI / 2);
    place('column_slim', { x: 26, y: 0, z: 0 }, 0);
    place('column_slim', { x: 26, y: 0, z: 8 }, Math.PI / 4);
    // Approach corridor columns (every 8 units for rhythm)
    place('column_slim', { x: 0 - WALL_OFFSET, y: 0, z: -12 }, 0);
    place('column_slim', { x: 0 + WALL_OFFSET, y: 0, z: -12 }, Math.PI);
    place('column_slim', { x: 0 - WALL_OFFSET, y: 0, z: -4 }, 0);
    // Barracks deep wing columns
    place('column_2', { x: -22 - WALL_OFFSET, y: 0, z: 14 }, 0);
    place('column_2', { x: -22 + WALL_OFFSET, y: 0, z: 14 }, Math.PI);

    // ================================================================
    // PHASE 7 -- ROOF / CEILING TILES with pipes, vents, and plates
    // Every corridor section gets ceiling detail; damaged areas get
    // exposed piping; horror zones get open vents.
    // ================================================================
    const ROOF_Y = 3.09; // Module height (ceiling level)

    // Barracks wing ceiling
    for (let z = -6; z <= 10; z += TILE) {
      const variant = z === 2 ? 'roof_vents' : z === 6 ? 'roof_pipes1' : 'roof_details';
      place(variant, { x: -18, y: ROOF_Y, z }, 0);
    }
    // East-west corridor ceiling
    for (let x = -14; x <= 2; x += TILE) {
      const variant = x === -10 ? 'roof_pipes2' : x === -6 ? 'roof_small_vents' : 'roof_plate';
      place(variant, { x, y: ROOF_Y, z: 10 }, Math.PI / 2);
    }
    // North corridor ceiling
    for (let z = 14; z <= 22; z += TILE) {
      place(z === 14 ? 'roof_orange_vent' : 'roof_details', { x: 2, y: ROOF_Y, z }, 0);
    }
    // East corridor ceiling
    for (let x = 6; x <= 18; x += TILE) {
      const variant = x === 10 ? 'roof_pipes1' : x === 14 ? 'roof_sides_pipes' : 'roof_plate2';
      place(variant, { x, y: ROOF_Y, z: 10 }, Math.PI / 2);
    }
    // South approach ceiling (sparse -- some tiles missing for horror)
    for (let z = -20; z <= 4; z += TILE) {
      if (z === -16) continue; // Missing ceiling tile -- exposed to sky
      const variant = z === -8 ? 'roof_vents' : z === 0 ? 'roof_pipes2' : 'roof_empty';
      place(variant, { x: 0, y: ROOF_Y, z }, 0);
    }
    // Vehicle bay ceiling (high, industrial)
    for (let z = -2; z <= 10; z += TILE) {
      place('roof_sides_pipes', { x: 22, y: ROOF_Y, z }, 0);
    }
    // Barracks deep wing ceiling
    for (let z = 10; z <= 18; z += TILE) {
      place(z === 14 ? 'roof_corner_pipes' : 'roof_pipes1', { x: -22, y: ROOF_Y, z }, 0);
    }

    // ================================================================
    // PHASE 8 -- WALL DETAILS (vents, pipes, panels) mounted on walls
    // These add texture and break up flat wall surfaces. Placed at
    // eye height (~1.5m) on alternating wall segments.
    // ================================================================
    const DETAIL_Y = 1.5;

    // Barracks wing wall details
    place('detail_vent3', { x: -18 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: -4 }, Math.PI / 2);
    place('detail_pipes_long', { x: -18 + WALL_OFFSET - 0.05, y: 2.2, z: 0 }, -Math.PI / 2);
    place('detail_vent4', { x: -18 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 4 }, Math.PI / 2);
    place('detail_basic1', { x: -18 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: 8 }, -Math.PI / 2);

    // East-west corridor wall details
    place('detail_vent5', { x: -12, y: DETAIL_Y, z: 10 - WALL_OFFSET + 0.05 }, 0);
    place('detail_pipes_med', { x: -8, y: 2.0, z: 10 + WALL_OFFSET - 0.05 }, Math.PI);
    place('detail_basic2', { x: -4, y: DETAIL_Y, z: 10 - WALL_OFFSET + 0.05 }, 0);
    place('detail_hexagon', { x: 0, y: DETAIL_Y, z: 10 + WALL_OFFSET - 0.05 }, Math.PI);

    // North corridor wall details
    place('detail_pipes_sm', { x: 2 - WALL_OFFSET + 0.05, y: 2.0, z: 16 }, Math.PI / 2);
    place('detail_x', { x: 2 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: 18 }, -Math.PI / 2);
    place('detail_dots', { x: 2 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 20 }, Math.PI / 2);

    // East corridor wall details
    place('detail_vent3', { x: 8, y: DETAIL_Y, z: 10 - WALL_OFFSET + 0.05 }, 0);
    place('detail_pipes_long', { x: 12, y: 2.2, z: 10 + WALL_OFFSET - 0.05 }, Math.PI);
    place('detail_vent5', { x: 16, y: DETAIL_Y, z: 10 - WALL_OFFSET + 0.05 }, 0);
    place('detail_basic3', { x: 18, y: DETAIL_Y, z: 10 + WALL_OFFSET - 0.05 }, Math.PI);

    // South approach corridor wall details (sparser, more damaged feel)
    place('detail_vent4', { x: 0 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: -18 }, Math.PI / 2);
    place('detail_plate_sm', { x: 0 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: -14 }, -Math.PI / 2);
    place('detail_pipes_med', { x: 0 - WALL_OFFSET + 0.05, y: 2.0, z: -10 }, Math.PI / 2);
    place('detail_basic4', { x: 0 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: -6 }, -Math.PI / 2);
    place('detail_output', { x: 0 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: -2 }, Math.PI / 2);
    place('detail_arrow', { x: 0 + WALL_OFFSET - 0.05, y: 2.0, z: 2 }, -Math.PI / 2);

    // Vehicle bay wall details
    place('detail_plate_lg', { x: 22 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 0 }, Math.PI / 2);
    place('detail_cyl_long', { x: 22 + WALL_OFFSET - 0.05, y: 2.5, z: 4 }, -Math.PI / 2);
    place('detail_plate_det', { x: 22 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 8 }, Math.PI / 2);
    place('detail_triangles', { x: 22 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: -2 }, -Math.PI / 2);

    // Barracks deep wing details
    place('detail_output_sm', { x: -22 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 12 }, Math.PI / 2);
    place('detail_plate_long', { x: -22 + WALL_OFFSET - 0.05, y: 2.0, z: 16 }, -Math.PI / 2);
    place('detail_cylinder', { x: -22 - WALL_OFFSET + 0.05, y: DETAIL_Y, z: 18 }, Math.PI / 2);
    place('detail_arrow2', { x: -22 + WALL_OFFSET - 0.05, y: DETAIL_Y, z: 14 }, -Math.PI / 2);

    // ================================================================
    // PHASE 9 -- WINDOW WALLS with station04 exterior silhouette
    // Selected wall segments are replaced with window variants;
    // outside the windows, station04 provides a dark skyline.
    // ================================================================
    // Window walls along east corridor (looking out toward vehicle bay)
    place('window_wall_a', { x: 8, y: WALL_Y, z: 10 + WALL_OFFSET }, -Math.PI / 2);
    place('long_window_a', { x: 14, y: WALL_Y, z: 10 + WALL_OFFSET }, -Math.PI / 2);
    // Window walls in south approach (broken windows letting in cold air)
    place('small_windows_a', { x: 0 + WALL_OFFSET, y: WALL_Y, z: -16 }, -Math.PI / 2);
    place('window_wall_a', { x: 0 + WALL_OFFSET, y: WALL_Y, z: -8 }, -Math.PI / 2);

    // Station04 exterior silhouettes visible through windows
    // Large, distant structures creating an oppressive skyline
    place('station04', { x: 40, y: -5, z: 10 }, Math.PI * 0.75, 12.0);
    place('station04', { x: -40, y: -8, z: -10 }, Math.PI * 0.25, 15.0);
    place('station04', { x: 10, y: -6, z: -45 }, Math.PI * 0.5, 10.0);

    // ================================================================
    // PHASE 10 -- CRATES, CONTAINERS, AND SCATTERED PROPS
    // Dense clutter throughout every corridor for horror navigation.
    // Overturned crates, supply containers, shelves, computers.
    // ================================================================

    // --- South approach corridor (entry clutter) ---
    place('crate', { x: -1.5, y: 0, z: -18 }, 0.3);
    place('crate_long', { x: 1.8, y: 0, z: -17 }, 1.1);
    place('crate', { x: -1.2, y: 0, z: -14 }, 2.0);
    place('container_full', { x: 1.5, y: 0, z: -10 }, 0.5);
    place('crate', { x: -2.0, y: 0, z: -6 }, 0.8);
    place('shelf_short', { x: 2.5, y: 0, z: -4 }, Math.PI);
    place('crate_long', { x: -1.5, y: 0, z: 0 }, 1.9, 0.9);
    place('crate', { x: 1.0, y: 0, z: 2 }, 0.4);

    // --- Barracks wing corridor ---
    place('crate', { x: -17, y: 0, z: -5 }, 0.7);
    place('shelf_tall', { x: -19.5, y: 0, z: -3 }, Math.PI);
    place('crate_long', { x: -16.5, y: 0, z: 1 }, 2.5);
    place('container_full', { x: -19.2, y: 0, z: 5 }, 0.2);
    place('computer_sm', { x: -16.8, y: 0.9, z: 7 }, 1.0);
    place('crate', { x: -19.0, y: 0, z: 8 }, 3.1);

    // --- East-west main corridor ---
    place('crate', { x: -13, y: 0, z: 9 }, 0.6);
    place('crate_long', { x: -9, y: 0, z: 11 }, 1.8);
    place('shelf_short', { x: -5, y: 0, z: 8.5 }, 0.3);
    place('crate', { x: -1, y: 0, z: 11 }, 2.2);
    place('container_full', { x: -7, y: 0, z: 12 }, 0.1);

    // --- East corridor to vehicle bay ---
    place('crate_long', { x: 7, y: 0, z: 9 }, 0.9);
    place('crate', { x: 9, y: 0, z: 11.5 }, 1.5);
    place('shelf_tall', { x: 12, y: 0, z: 8.5 }, Math.PI / 2);
    place('container_full', { x: 15, y: 0, z: 11 }, 0.7);
    place('crate', { x: 17, y: 0, z: 9.2 }, 2.8);
    place('crate_long', { x: 19, y: 0, z: 11 }, 0.0);

    // --- North corridor (to command center) ---
    place('crate', { x: 1, y: 0, z: 15 }, 0.5);
    place('computer', { x: 3.2, y: 0, z: 17 }, Math.PI);
    place('crate_long', { x: 0.5, y: 0, z: 20 }, 1.2);

    // --- Vehicle bay interior ---
    place('container_full', { x: 23, y: 0, z: -1 }, 0.3);
    place('crate', { x: 20.5, y: 0, z: 1 }, 1.8);
    place('crate_long', { x: 24, y: 0, z: 3 }, 0.6);
    place('crate', { x: 21, y: 0, z: 5 }, 2.4);
    place('shelf_tall', { x: 24.2, y: 0, z: 7 }, -Math.PI / 2);
    place('container_full', { x: 20, y: 0, z: 9 }, 1.1);
    place('crate', { x: 24, y: 0, z: 9 }, 0.0);

    // --- Barracks deep wing ---
    place('shelf_short', { x: -23, y: 0, z: 11 }, 0.4);
    place('crate', { x: -21, y: 0, z: 13 }, 1.6);
    place('crate_long', { x: -23.5, y: 0, z: 16 }, 0.8);
    place('capsule', { x: -21, y: 0, z: 18 }, 2.3);

    // --- Courtyard area scattered props ---
    place('crate', { x: -5, y: 0, z: -6 }, 0.4);
    place('crate_long', { x: 4, y: 0, z: -3 }, 2.1);
    place('container_full', { x: -3, y: 0, z: 6 }, 0.9);
    place('crate', { x: 7, y: 0, z: 3 }, 1.7);
    place('base_prop', { x: -7, y: 0, z: 2 }, 0.0);
    place('laser', { x: 5, y: 0.8, z: -5 }, 1.2);

    // Stacked crates (double-height for visual density)
    place('crate', { x: -1.5, y: 1.0, z: -18 }, 0.8); // on top of first crate
    place('crate', { x: 7, y: 1.0, z: 9 }, 0.3); // on top of east corridor crate
    place('crate', { x: 23, y: 1.0, z: -1 }, 2.0); // vehicle bay stack

    // ================================================================
    // PHASE 11 -- PIPE runs along ceilings and walls
    // Exposed piping reinforces the industrial horror atmosphere.
    // ================================================================
    place('pipes', { x: -18, y: 2.5, z: -2 }, 0);
    place('pipes', { x: -18, y: 2.5, z: 6 }, 0);
    place('pipes', { x: -12, y: 2.5, z: 10 }, Math.PI / 2);
    place('pipes', { x: -4, y: 2.5, z: 10 }, Math.PI / 2);
    place('pipes', { x: 8, y: 2.5, z: 10 }, Math.PI / 2);
    place('pipes', { x: 16, y: 2.5, z: 10 }, Math.PI / 2);
    place('pipes', { x: 0, y: 2.5, z: -14 }, 0);
    place('pipes', { x: 0, y: 2.5, z: -6 }, 0);
    place('pipes', { x: 0, y: 2.5, z: 2 }, 0);
    place('pipes', { x: 2, y: 2.5, z: 16 }, 0);
    place('pipes', { x: 22, y: 2.5, z: 2 }, 0);
    place('pipes', { x: 22, y: 2.5, z: 8 }, 0);
    place('pipes', { x: -22, y: 2.5, z: 14 }, 0);

    // ================================================================
    // PHASE 12 -- GRAFFITI DECALS and POSTERS on walls
    // Placed slightly offset from wall surfaces (Z-fighting prevention).
    // Graffiti tells the story of desperate soldiers and alien warnings.
    // ================================================================

    // South approach graffiti -- soldiers left warnings
    place('graffiti_1', { x: 0 - WALL_OFFSET + 0.1, y: 1.2, z: -19 }, Math.PI / 2, 0.8);
    place('graffiti_4', { x: 0 + WALL_OFFSET - 0.1, y: 1.0, z: -11 }, -Math.PI / 2, 0.7);
    place('poster_4', { x: 0 - WALL_OFFSET + 0.1, y: 1.5, z: -7 }, Math.PI / 2, 0.6);

    // Barracks wing graffiti
    place('graffiti_2', { x: -18 + WALL_OFFSET - 0.1, y: 1.3, z: -3 }, -Math.PI / 2, 0.9);
    place('graffiti_5', { x: -18 - WALL_OFFSET + 0.1, y: 1.0, z: 3 }, Math.PI / 2, 0.7);
    place('poster_5', { x: -18 + WALL_OFFSET - 0.1, y: 1.5, z: 7 }, -Math.PI / 2, 0.5);

    // East-west corridor graffiti
    place('graffiti_1', { x: -11, y: 1.2, z: 10 + WALL_OFFSET - 0.1 }, Math.PI, 0.8);
    place('graffiti_4', { x: -3, y: 1.0, z: 10 - WALL_OFFSET + 0.1 }, 0, 0.6);
    place('poster_9', { x: -7, y: 1.5, z: 10 + WALL_OFFSET - 0.1 }, Math.PI, 0.5);

    // East corridor graffiti
    place('graffiti_2', { x: 9, y: 1.3, z: 10 - WALL_OFFSET + 0.1 }, 0, 0.75);
    place('graffiti_5', { x: 15, y: 1.0, z: 10 + WALL_OFFSET - 0.1 }, Math.PI, 0.65);
    place('poster_11', { x: 11, y: 1.5, z: 10 + WALL_OFFSET - 0.1 }, Math.PI, 0.5);

    // Vehicle bay graffiti (desperate final messages)
    place('graffiti_1', { x: 22 + WALL_OFFSET - 0.1, y: 1.2, z: 0 }, -Math.PI / 2, 1.0);
    place('graffiti_4', { x: 22 - WALL_OFFSET + 0.1, y: 1.0, z: 6 }, Math.PI / 2, 0.8);

    // North corridor poster
    place('poster_4', { x: 2 - WALL_OFFSET + 0.1, y: 1.5, z: 17 }, Math.PI / 2, 0.6);
    place('graffiti_2', { x: 2 + WALL_OFFSET - 0.1, y: 1.2, z: 21 }, -Math.PI / 2, 0.7);

    // Barracks deep wing
    place('graffiti_5', { x: -22 - WALL_OFFSET + 0.1, y: 1.0, z: 13 }, Math.PI / 2, 0.8);
    place('poster_4', { x: -22 + WALL_OFFSET - 0.1, y: 1.5, z: 17 }, -Math.PI / 2, 0.55);

    // ================================================================
    // PHASE 13 -- MODULAR FURNITURE and COMPUTERS
    // Scattered computers, shelves, and capsule props for interior
    // detail in rooms adjacent to corridors.
    // ================================================================
    // Command center area computers
    place('computer', { x: 1, y: 0, z: 23 }, Math.PI);
    place('computer_sm', { x: 3.5, y: 0.8, z: 23 }, Math.PI);
    place('shelf_tall', { x: -1, y: 0, z: 22 }, 0);

    // Barracks deep wing interior
    place('computer_sm', { x: -23, y: 0.8, z: 18 }, Math.PI / 2);
    place('shelf_short', { x: -21, y: 0, z: 16 }, -Math.PI / 2);
    place('base_prop', { x: -23, y: 0, z: 13 }, 0);

    // Vehicle bay control area
    place('computer', { x: 24, y: 0, z: 5 }, -Math.PI / 2);
    place('shelf_short', { x: 20, y: 0, z: 3 }, Math.PI);

    // Courtyard makeshift triage area
    place('capsule', { x: -4, y: 0, z: -2 }, 0.5);
    place('capsule', { x: -6, y: 0, z: -3 }, 1.8);

    // ================================================================
    // PHASE 14 -- STAIRCASE near underground access
    // Provides visual connection to the underground hatch area
    // ================================================================
    place('staircase', { x: 28, y: 0, z: 10 }, -Math.PI / 2);

    log.info(`Dense modular environment built: ${instanceCounter} GLB instances placed`);
  }

  private createBloodDecals(): void {
    // Blood splatters for horror atmosphere
    const decalPositions = [
      { pos: new Vector3(-20, 0.02, -5), size: 2, rot: 0 },
      { pos: new Vector3(-22, 0.02, 2), size: 1.5, rot: 0.5 },
      { pos: new Vector3(5, 0.02, 15), size: 1, rot: 1.2 },
      { pos: new Vector3(-8, 0.02, -2), size: 2.5, rot: 2.1 },
      { pos: new Vector3(15, 0.02, -15), size: 1.2, rot: 3.0 },
      // Wall splatters (vertical)
      { pos: new Vector3(-25 + 6.05, 1.5, 3), size: 1, rot: 0, wall: true, rotX: Math.PI / 2 },
    ];

    for (let i = 0; i < decalPositions.length; i++) {
      const d = decalPositions[i];
      const decal = MeshBuilder.CreateDisc(
        `blood_${i}`,
        { radius: d.size, tessellation: 12 },
        this.scene
      );

      if (d.wall) {
        decal.position = d.pos.clone();
        decal.rotation.y = d.rot;
        decal.rotation.z = Math.PI / 2;
      } else {
        decal.position = d.pos.clone();
        decal.rotation.x = Math.PI / 2;
        decal.rotation.z = d.rot;
      }

      decal.material = this.materials.get('blood')!;
      decal.parent = this.fobRoot;
      this.allMeshes.push(decal);
      this.bloodDecals.push(decal);
    }
  }

  /**
   * Create fortification structures around the base perimeter and key positions.
   * Includes sandbag walls, barriers, and defensive bunker positions.
   */
  private createFortifications(): void {
    const perimeterSize = 80;

    // Sandbag positions around the breach and key choke points
    const sandbagPositions = [
      // Near the breach - defensive fallback position
      { pos: new Vector3(-15, 0, -35), rot: 0.3, scale: 1.2 },
      { pos: new Vector3(-12, 0, -33), rot: -0.2, scale: 1.0 },
      { pos: new Vector3(12, 0, -35), rot: -0.3, scale: 1.1 },
      { pos: new Vector3(15, 0, -33), rot: 0.1, scale: 1.0 },
      // Courtyard defensive line
      { pos: new Vector3(-10, 0, -15), rot: 0, scale: 1.5 },
      { pos: new Vector3(10, 0, -15), rot: 0, scale: 1.5 },
      { pos: new Vector3(0, 0, -18), rot: 0, scale: 1.8 },
      // Vehicle bay entrance
      { pos: new Vector3(18, 0, -5), rot: Math.PI / 2, scale: 1.3 },
      { pos: new Vector3(18, 0, 5), rot: Math.PI / 2, scale: 1.3 },
      // Command center approach
      { pos: new Vector3(-5, 0, 18), rot: 0, scale: 1.2 },
      { pos: new Vector3(5, 0, 18), rot: 0, scale: 1.2 },
      // Barracks perimeter
      { pos: new Vector3(-30, 0, -5), rot: Math.PI / 2, scale: 1.0 },
      { pos: new Vector3(-30, 0, 5), rot: Math.PI / 2, scale: 1.0 },
    ];

    // Place sandbag barriers using cement pallet GLBs (available in GLB_BARRIERS)
    for (let i = 0; i < sandbagPositions.length; i++) {
      const sp = sandbagPositions[i];
      const barrierPath = i % 2 === 0 ? GLB_BARRIERS.cement_pallet_1 : GLB_BARRIERS.cement_pallet_2;
      const node = this.placeGLB(barrierPath, `fortification_sandbag_${i}`, sp.pos, {
        rotationY: sp.rot,
        scale: sp.scale,
      });
      if (node) this.fortificationMeshes.push(node);
    }

    // Guard bunker positions (small sheds as makeshift bunkers)
    const bunkerPositions = [
      { pos: new Vector3(-20, 0, -30), rot: Math.PI / 4, type: 'small' },
      { pos: new Vector3(20, 0, -30), rot: -Math.PI / 4, type: 'small' },
      { pos: new Vector3(0, 0, -25), rot: 0, type: 'large' },
      { pos: new Vector3(-35, 0, 0), rot: Math.PI / 2, type: 'small' },
    ];

    for (let i = 0; i < bunkerPositions.length; i++) {
      const bp = bunkerPositions[i];
      const bunkerPath = bp.type === 'large' ? GLB_BUILDINGS.shed_2 : GLB_BUILDINGS.shed_1;
      const node = this.placeGLB(bunkerPath, `fortification_bunker_${i}`, bp.pos, {
        rotationY: bp.rot,
        scale: bp.type === 'large' ? 2.5 : 1.8,
      });
      if (node) this.fortificationMeshes.push(node);
    }

    // Watchtower platforms at corners
    const watchtowerPositions = [
      { pos: new Vector3(-perimeterSize / 2 + 5, 0, -perimeterSize / 2 + 5), rot: Math.PI / 4 },
      { pos: new Vector3(perimeterSize / 2 - 5, 0, -perimeterSize / 2 + 5), rot: -Math.PI / 4 },
      {
        pos: new Vector3(-perimeterSize / 2 + 5, 0, perimeterSize / 2 - 5),
        rot: (3 * Math.PI) / 4,
      },
      {
        pos: new Vector3(perimeterSize / 2 - 5, 0, perimeterSize / 2 - 5),
        rot: (-3 * Math.PI) / 4,
      },
    ];

    for (let i = 0; i < watchtowerPositions.length; i++) {
      const wtp = watchtowerPositions[i];
      const node = this.placeGLB(
        GLB_ANTENNA_PLATFORM.platform_small,
        `watchtower_platform_${i}`,
        wtp.pos,
        { rotationY: wtp.rot, scale: 2.0 }
      );
      if (node) this.fortificationMeshes.push(node);

      // Add dim light on top of each watchtower (some destroyed)
      if (i !== 1) {
        // Tower at index 1 is destroyed (no light)
        const towerLight = new PointLight(
          `watchtower_light_${i}`,
          wtp.pos.add(new Vector3(0, 4, 0)),
          this.scene
        );
        towerLight.diffuse = new Color3(0.9, 0.85, 0.7);
        towerLight.intensity = i === 0 ? 0.3 : 0.15; // Some working better than others
        towerLight.range = 15;

        this.flickerLights.push({
          light: towerLight,
          baseIntensity: towerLight.intensity,
          flickerSpeed: 2 + Math.random() * 3,
          flickerAmount: 0.5,
          timer: Math.random() * Math.PI * 2,
          isOff: false,
          offDuration: 0,
          offTimer: 0,
        });
      }
    }

    log.info(
      `Created ${sandbagPositions.length + bunkerPositions.length + watchtowerPositions.length} fortification elements`
    );
  }

  /**
   * Create supply pickups (ammo, health, armor) scattered throughout the base.
   * These provide gameplay incentive to explore and survival resources.
   */
  private createSupplyPickups(): void {
    // Supply pickup definitions
    const supplySpawns: Array<{
      position: Vector3;
      type: 'ammo' | 'health' | 'armor';
      amount: number;
    }> = [
      // Barracks area - medical supplies
      { position: new Vector3(-23, 0.5, 2), type: 'health', amount: 25 },
      { position: new Vector3(-20, 0.5, 8), type: 'health', amount: 15 },
      // Command center - ammo cache
      { position: new Vector3(3, 0.5, 22), type: 'ammo', amount: 30 },
      { position: new Vector3(-2, 0.5, 24), type: 'ammo', amount: 20 },
      // Vehicle bay - heavy supplies
      { position: new Vector3(28, 0.5, 2), type: 'ammo', amount: 40 },
      { position: new Vector3(24, 0.5, -3), type: 'health', amount: 30 },
      { position: new Vector3(26, 0.5, 8), type: 'armor', amount: 25 },
      // Courtyard - scattered supplies
      { position: new Vector3(-5, 0.5, 5), type: 'ammo', amount: 15 },
      { position: new Vector3(8, 0.5, -8), type: 'health', amount: 20 },
      // Near breach - emergency supplies
      { position: new Vector3(-8, 0.5, -32), type: 'health', amount: 25 },
      { position: new Vector3(8, 0.5, -32), type: 'ammo', amount: 25 },
      // Bunker positions - tactical supplies
      { position: new Vector3(-20, 0.5, -28), type: 'ammo', amount: 35 },
      { position: new Vector3(20, 0.5, -28), type: 'ammo', amount: 35 },
      { position: new Vector3(0, 0.5, -23), type: 'armor', amount: 40 },
      // Underground hatch area - final supplies before descent
      { position: new Vector3(32, 0.5, 12), type: 'health', amount: 50 },
      { position: new Vector3(28, 0.5, 14), type: 'ammo', amount: 50 },
    ];

    // Color mapping for supply types
    const supplyColors: Record<string, Color3> = {
      ammo: new Color3(1.0, 0.8, 0.2), // Yellow/amber
      health: new Color3(0.2, 1.0, 0.3), // Green
      armor: new Color3(0.3, 0.5, 1.0), // Blue
    };

    // GLB path mapping for supply types
    const supplyGLBPaths: Record<string, string> = {
      ammo: GLB_SUPPLIES.ammo_crate,
      health: GLB_SUPPLIES.med_kit,
      armor: GLB_SUPPLIES.supply_crate,
    };

    for (let i = 0; i < supplySpawns.length; i++) {
      const spawn = supplySpawns[i];

      // Create pickup mesh using GLB model
      const glbPath = supplyGLBPaths[spawn.type];
      const pickupMesh = this.placeGLB(
        glbPath,
        `supply_${spawn.type}_${i}`,
        spawn.position.clone(),
        { scale: 0.8 }
      );

      // Skip if GLB failed to load
      if (!pickupMesh) {
        log.warn(`Failed to load GLB for supply pickup: ${spawn.type}`);
        continue;
      }

      // Glow light for visibility
      const glowLight = new PointLight(
        `supplyGlow_${i}`,
        spawn.position.add(new Vector3(0, 0.3, 0)),
        this.scene
      );
      glowLight.diffuse = supplyColors[spawn.type];
      glowLight.intensity = 0.25;
      glowLight.range = 4;

      // Add subtle pulsing to the glow
      this.flickerLights.push({
        light: glowLight,
        baseIntensity: 0.25,
        flickerSpeed: 1.5 + Math.random(),
        flickerAmount: 0.3,
        timer: Math.random() * Math.PI * 2,
        isOff: false,
        offDuration: 0,
        offTimer: 0,
      });

      this.supplyPickups.push({
        mesh: pickupMesh,
        type: spawn.type,
        amount: spawn.amount,
        position: spawn.position.clone(),
        collected: false,
        glowLight,
      });
    }

    log.info(`Created ${supplySpawns.length} supply pickups`);
  }

  /**
   * Create destroyed turret and defense positions to show the base was defended.
   * These are purely atmospheric - showing signs of the battle.
   */
  private createDestroyedDefenses(): void {
    const turretPositionDefs = [
      // Perimeter defense turrets (all destroyed)
      { pos: new Vector3(-15, 0, -38), rot: 0, destroyed: true },
      { pos: new Vector3(15, 0, -38), rot: 0, destroyed: true },
      { pos: new Vector3(-38, 0, -15), rot: Math.PI / 2, destroyed: true },
      { pos: new Vector3(-38, 0, 15), rot: Math.PI / 2, destroyed: true },
      { pos: new Vector3(38, 0, -15), rot: -Math.PI / 2, destroyed: true },
      { pos: new Vector3(38, 0, 15), rot: -Math.PI / 2, destroyed: true },
      // Courtyard defense (one partially working)
      { pos: new Vector3(0, 0, -10), rot: 0, destroyed: true },
    ];

    for (let i = 0; i < turretPositionDefs.length; i++) {
      const tp = turretPositionDefs[i];

      // Place the radar dish as a destroyed turret base (tilted/damaged)
      const _node = this.placeGLB(GLB_ANTENNA.platform_ax_1, `destroyed_turret_${i}`, tp.pos, {
        rotation: new Vector3(
          tp.destroyed ? Math.random() * 0.4 - 0.2 : 0, // Random tilt if destroyed
          tp.rot,
          tp.destroyed ? Math.random() * 0.3 - 0.15 : 0
        ),
        scale: 1.5,
      });

      // Add sparking/damage light for destroyed turrets
      let damageLight: PointLight | null = null;
      if (tp.destroyed) {
        damageLight = new PointLight(
          `turret_spark_${i}`,
          tp.pos.add(new Vector3(0, 1, 0)),
          this.scene
        );
        damageLight.diffuse = new Color3(1.0, 0.5, 0.2);
        damageLight.intensity = 0;
        damageLight.range = 5;

        // Intermittent sparking effect
        this.flickerLights.push({
          light: damageLight,
          baseIntensity: 0.4,
          flickerSpeed: 15 + Math.random() * 10,
          flickerAmount: 1.5, // High flicker = sparking
          timer: Math.random() * Math.PI * 2,
          isOff: true,
          offDuration: 2 + Math.random() * 3, // Mostly off
          offTimer: 0,
        });
      }

      this.turretPositions.push({
        position: tp.pos.clone(),
        destroyed: tp.destroyed,
        light: damageLight,
      });
    }

    log.info(`Created ${turretPositionDefs.length} destroyed defense positions`);
  }

  /**
   * Create perimeter spotlight system - some working, some destroyed.
   * Adds to the abandoned military base atmosphere.
   */
  private createPerimeterSpotlights(): void {
    const perimeterSize = 80;
    const spotlightDefs = [
      // Front wall spotlights (near breach - most destroyed)
      { pos: new Vector3(-25, 6, -perimeterSize / 2), active: false },
      { pos: new Vector3(25, 6, -perimeterSize / 2), active: true },
      // Side wall spotlights
      { pos: new Vector3(-perimeterSize / 2, 6, -10), active: true },
      { pos: new Vector3(-perimeterSize / 2, 6, 10), active: false },
      { pos: new Vector3(perimeterSize / 2, 6, -10), active: false },
      { pos: new Vector3(perimeterSize / 2, 6, 10), active: true },
      // Back wall spotlights
      { pos: new Vector3(-20, 6, perimeterSize / 2), active: true },
      { pos: new Vector3(20, 6, perimeterSize / 2), active: false },
    ];

    for (let i = 0; i < spotlightDefs.length; i++) {
      const sd = spotlightDefs[i];

      const spotlight = new PointLight(`perimeter_spotlight_${i}`, sd.pos, this.scene);
      spotlight.diffuse = new Color3(0.95, 0.9, 0.8);
      spotlight.intensity = sd.active ? 0.6 : 0;
      spotlight.range = 25;

      if (sd.active) {
        // Working spotlights have slow flicker
        this.flickerLights.push({
          light: spotlight,
          baseIntensity: 0.6,
          flickerSpeed: 0.5 + Math.random() * 0.5,
          flickerAmount: 0.2,
          timer: Math.random() * Math.PI * 2,
          isOff: false,
          offDuration: 0,
          offTimer: 0,
        });
      }

      this.spotlights.push({
        light: spotlight,
        baseRotation: Math.atan2(sd.pos.z, sd.pos.x),
        sweepSpeed: sd.active ? 0.3 + Math.random() * 0.2 : 0,
        active: sd.active,
      });
    }

    log.info(
      `Created ${spotlightDefs.length} perimeter spotlights (${spotlightDefs.filter((s) => s.active).length} active)`
    );
  }

  /**
   * Load and place crashed alien vehicle wrecks in the courtyard.
   * These Wraith hover tanks were destroyed during the base assault.
   */
  private async createAlienVehicleWrecks(): Promise<void> {
    // Define positions for crashed Wraith vehicles (alien hover tanks)
    // These tell the story of the battle - crashed/abandoned in the courtyard
    const vehicleWrecks = [
      {
        position: new Vector3(12, 0.3, -18), // Near perimeter breach - crash landed
        rotation: new Vector3(0.4, 0.8, 0.3), // Tilted/crashed orientation
        scale: 7, // Large alien hover tank (~7m scale)
      },
      {
        position: new Vector3(-18, 0.5, 12), // In courtyard - shot down
        rotation: new Vector3(-0.2, 2.1, 0.5), // Different crash angle
        scale: 6,
      },
    ];

    // Try to load the Wraith model
    try {
      await AssetManager.loadAsset('vehicles', 'wraith', this.scene);

      for (let i = 0; i < vehicleWrecks.length; i++) {
        const wreck = vehicleWrecks[i];
        const instance = AssetManager.createInstance(
          'vehicles',
          'wraith',
          `wraith_wreck_${i}`,
          this.scene
        );

        if (instance) {
          instance.position = wreck.position;
          instance.rotation = wreck.rotation;
          instance.scaling.setAll(wreck.scale);

          if (this.fobRoot) {
            instance.parent = this.fobRoot;
          }

          this.alienVehicles.push(instance);

          // Add a dim red glow underneath the crashed vehicle (damaged reactor)
          const damageGlow = new PointLight(
            `wreckGlow_${i}`,
            wreck.position.add(new Vector3(0, 0.5, 0)),
            this.scene
          );
          damageGlow.diffuse = new Color3(0.8, 0.2, 0.1);
          damageGlow.intensity = 0.2;
          damageGlow.range = 6;

          // Add to flicker lights for atmospheric effect
          this.flickerLights.push({
            light: damageGlow,
            baseIntensity: 0.2,
            flickerSpeed: 3 + Math.random() * 2,
            flickerAmount: 0.8,
            timer: Math.random() * Math.PI * 2,
            isOff: false,
            offDuration: 0,
            offTimer: 0,
          });
        }
      }

      log.info(`Loaded ${this.alienVehicles.length} alien vehicle wrecks`);
    } catch (error) {
      throw new Error(`[FOBDelta] Failed to load alien vehicle models: ${error}`);
    }
  }

  /**
   * Preload GLB models for ambush enemies so they spawn instantly
   */
  private async preloadAmbushEnemyModels(): Promise<void> {
    const assetName = SPECIES_TO_ASSET[AMBUSH_ENEMY_SPECIES];
    if (!assetName) {
      throw new Error(
        `[FOBDelta] No asset mapping for ambush enemy species: ${AMBUSH_ENEMY_SPECIES}`
      );
    }

    const result = await AssetManager.loadAsset('aliens', assetName, this.scene);
    if (!result) {
      log.error(`Failed to preload ambush enemy GLB: ${assetName} - enemies will not spawn`);
      return;
    }
    this.ambushEnemiesPreloaded = true;
    log.info(`Preloaded ambush enemy GLB: ${assetName}`);
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
    this.objectiveMarker.parent = this.fobRoot;
  }

  private createFlashlight(): void {
    // Player's flashlight (attached to camera)
    this.flashlight = new PointLight('flashlight', new Vector3(0, 0, 0), this.scene);
    this.flashlight.diffuse = new Color3(1, 1, 0.95);
    this.flashlight.intensity = 0;
    this.flashlight.range = 25;
  }

  private setupAreaZones(): void {
    this.areaZones = [
      {
        id: 'perimeter',
        name: 'Perimeter',
        center: new Vector3(0, 0, -35),
        radius: 15,
        triggered: false,
      },
      {
        id: 'courtyard',
        name: 'Courtyard',
        center: new Vector3(0, 0, 0),
        radius: 20,
        triggered: false,
      },
      {
        id: 'barracks',
        name: 'Barracks',
        center: new Vector3(-25, 0, 0),
        radius: 12,
        triggered: false,
      },
      {
        id: 'command',
        name: 'Command Center',
        center: new Vector3(0, 0, 25),
        radius: 12,
        triggered: false,
      },
      {
        id: 'vehiclebay',
        name: 'Vehicle Bay',
        center: new Vector3(25, 0, 0),
        radius: 15,
        triggered: false,
      },
      {
        id: 'hatch',
        name: 'Underground Access',
        center: new Vector3(30, 0, 10),
        radius: 5,
        triggered: false,
      },
    ];
  }

  private startLevel(): void {
    this.phase = 'approach';
    this.phaseTime = 0;

    // Set up action handler
    this.actionCallback = this.handleAction.bind(this);
    this.emitActionHandlerRegistered(this.actionCallback);

    // Set exploration action buttons
    this.updateActionButtons();

    // Initial comms
    this.emitNotification('FOB DELTA - FORWARD OPERATING BASE', 3000);
    this.emitObjectiveUpdate('INVESTIGATE FOB DELTA', 'Search the base for survivors and intel.');

    setTimeout(() => {
      this.sendCommsMessage('approach_entry', {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'FOB Delta beacon located. Detecting no active transponders. Proceed with caution, Sergeant.',
      });
    }, 2000);

    // Set initial objective
    this.setObjective(new Vector3(0, 0, 0)); // Courtyard
  }

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
      this.flashlight.intensity = this.flashlightOn ? 1.5 : 0;
    }

    this.emitNotification(this.flashlightOn ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF', 800);
  }

  private activateScanner(): void {
    // Simple scanner pulse - shows nearby points of interest
    this.emitNotification('SCANNING...', 1500);

    // Check if near terminal
    if (this.terminal) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 15 && !this.logsAccessed) {
        setTimeout(() => {
          this.emitNotification('TERMINAL DETECTED - 12M', 2000);
          this.setObjective(this.terminal!.position);
        }, 1500);
      }
    }

    // Check if near mech
    if (this.mechMesh) {
      const dist = Vector3.Distance(this.camera.position, this.mechMesh.position);
      if (dist < 20) {
        setTimeout(() => {
          this.emitNotification('MECH SIGNATURE DETECTED', 2000);
        }, 1500);
      }
    }

    // Check if near hatch
    if (this.undergroundHatch && this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
      if (dist < 15 && !this.hatchOpen) {
        setTimeout(() => {
          this.emitNotification('UNDERGROUND ACCESS DETECTED', 2000);
          this.setObjective(this.undergroundHatch!.position);
        }, 1500);
      }
    }
  }

  private tryInteract(): void {
    // Check supply pickup interaction first (most common)
    const nearbySupply = this.getNearbySupply();
    if (nearbySupply) {
      this.collectSupply(nearbySupply);
      return;
    }

    // Check terminal interaction
    if (this.terminal && !this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 4) {
        this.accessLogs();
        return;
      }
    }

    // Check mining terminal interaction (bonus level access)
    if (this.miningTerminal && !this.miningTerminalAccessed && this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.miningTerminal.position);
      if (dist < 4) {
        this.accessMiningOutpost();
        return;
      }
    }

    // Check hatch interaction
    if (this.undergroundHatch && this.logsAccessed && !this.hatchOpen) {
      const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
      if (dist < 4) {
        this.openHatch();
        return;
      }
    }
  }

  /**
   * Get a nearby supply pickup if within interaction range.
   */
  private getNearbySupply(): (typeof this.supplyPickups)[0] | null {
    const PICKUP_RANGE = 3;
    for (const supply of this.supplyPickups) {
      if (supply.collected) continue;
      const dist = Vector3.Distance(this.camera.position, supply.position);
      if (dist < PICKUP_RANGE) {
        return supply;
      }
    }
    return null;
  }

  /**
   * Collect a supply pickup and apply its effects.
   */
  private collectSupply(supply: (typeof this.supplyPickups)[0]): void {
    if (supply.collected) return;

    supply.collected = true;

    // Apply effect based on type
    switch (supply.type) {
      case 'health':
        this.emitHealthChanged(supply.amount);
        this.emitNotification(`+${supply.amount} HEALTH`, 1500);
        break;
      case 'ammo': {
        // Add reserve ammo via weapon system
        const weaponActions = getWeaponActions();
        if (weaponActions) {
          weaponActions.addAmmo(supply.amount);
        }
        this.emitNotification(`+${supply.amount} AMMO`, 1500);
        break;
      }
      case 'armor':
        // Armor reduces incoming damage - implement via health for now
        this.emitHealthChanged(Math.floor(supply.amount / 2));
        this.emitNotification(`+${supply.amount} ARMOR`, 1500);
        break;
    }

    // Hide the pickup mesh and disable its light
    supply.mesh.isVisible = false;
    supply.glowLight.intensity = 0;

    // Play pickup sound effect via spatial audio (use terminal beep as pickup sound)
    this.addSpatialSound(
      `pickup_${supply.type}_${Date.now()}`,
      'terminal',
      { x: supply.position.x, y: supply.position.y, z: supply.position.z },
      { maxDistance: 15, volume: 0.6 }
    );
  }

  private accessMiningOutpost(): void {
    this.miningTerminalAccessed = true;
    this.emitNotification('MINING OUTPOST GAMMA-7 ACCESS GRANTED', 2000);

    this.sendCommsMessage('mining_access', {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Mining Outpost Gamma-7 network link detected. Logs indicate unusual seismic activity below the mineshaft. Optional reconnaissance available.',
    });

    // Dispatch bonus level entry after a short delay
    setTimeout(() => {
      this.emitNotification('ENTERING MINING DEPTHS...', 2000);
      // Complete the level and transition to next (mining_depths bonus level)
      this.completeLevel();
    }, 4000);
  }

  private accessLogs(): void {
    this.logsAccessed = true;
    this.emitNotification('ACCESSING MISSION LOGS...', 2000);

    // Series of comms messages revealing what happened
    setTimeout(() => {
      this.sendCommsMessage('log_1', {
        sender: 'Mission Log',
        callsign: 'FOB DELTA',
        portrait: 'ai',
        text: '[DAY 3] Contact with forward scouts lost. Reports of hostile creatures in the canyons. Perimeter defense activated.',
      });
    }, 2500);

    setTimeout(() => {
      this.sendCommsMessage('log_2', {
        sender: 'Mission Log',
        callsign: 'FOB DELTA',
        portrait: 'ai',
        text: '[DAY 5] They came at night. Hundreds of them. Perimeter breached. Heavy casualties. Corporal Cole took his mech to cover the evacuation.',
      });
    }, 8000);

    setTimeout(() => {
      this.sendCommsMessage('log_3', {
        sender: 'Mission Log',
        callsign: 'FOB DELTA',
        portrait: 'ai',
        text: "[DAY 5 - FINAL] Cole's mech went down in the vehicle bay. Underground tunnels discovered. That's where they came from. That's where they took our people.",
      });
    }, 14000);

    setTimeout(() => {
      this.emitObjectiveUpdate(
        'LOCATE UNDERGROUND ACCESS',
        'Find the tunnel entrance in the Vehicle Bay.'
      );
      this.transitionToPhase('discovery');
      this.setObjective(new Vector3(30, 0, 10)); // Hatch location
    }, 20000);
  }

  private openHatch(): void {
    this.hatchOpen = true;
    this.emitNotification('HATCH OPENED', 1500);

    // Animate hatch opening (simple position change)
    if (this.undergroundHatch) {
      this.undergroundHatch.position.y = -0.5;
    }

    setTimeout(() => {
      this.sendCommsMessage('hatch_open', {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: "Underground access secured. Detecting Corporal Cole's transponder signal below. He's alive, Sergeant.",
      });
    }, 1500);

    setTimeout(() => {
      this.emitObjectiveUpdate(
        'DESCEND INTO THE BREACH',
        'Enter the underground tunnels to find Marcus.'
      );
      this.transitionToPhase('exit');
    }, 6000);

    setTimeout(() => {
      this.emitNotification('PROCEED TO UNDERGROUND ACCESS', 3000);
    }, 8000);
  }

  private updateActionButtons(): void {
    // Get keybindings - level-specific (fixed) and configurable
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

    // Add combat buttons during ambush phase
    if (this.phase === 'ambush' && this.enemies.length > 0) {
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

    // Add interact button when near interactables
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

    this.emitActionGroupsChanged(groups);
  }

  private checkNearInteractable(): string | null {
    // Check supply pickups first (most common interaction)
    const nearbySupply = this.getNearbySupply();
    if (nearbySupply) {
      const typeLabels: Record<string, string> = {
        ammo: 'AMMO CRATE',
        health: 'MED KIT',
        armor: 'ARMOR PACK',
      };
      return `COLLECT ${typeLabels[nearbySupply.type]} (+${nearbySupply.amount})`;
    }

    // Terminal
    if (this.terminal && !this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 4) return 'ACCESS TERMINAL';
    }

    // Mining Outpost terminal (bonus level)
    if (this.miningTerminal && !this.miningTerminalAccessed && this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.miningTerminal.position);
      if (dist < 4) return 'ACCESS MINING OUTPOST GAMMA-7';
    }

    // Hatch
    if (this.undergroundHatch && this.logsAccessed && !this.hatchOpen) {
      const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
      if (dist < 4) return 'OPEN HATCH';
    }

    // Exit
    if (this.undergroundHatch && this.hatchOpen) {
      const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
      if (dist < 3) return 'ENTER TUNNELS';
    }

    return null;
  }

  private setObjective(position: Vector3): void {
    this.currentObjective = position;
    if (this.objectiveMarker) {
      this.objectiveMarker.position.set(position.x, 0.5, position.z);
      this.objectiveMarker.isVisible = true;
    }
  }

  private clearObjective(): void {
    this.currentObjective = null;
    if (this.objectiveMarker) {
      this.objectiveMarker.isVisible = false;
    }
  }

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
    this.emitCommsMessage(message);
  }

  private transitionToPhase(newPhase: FOBPhase): void {
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'courtyard':
        this.sendCommsMessage('courtyard_entry', {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Signs of heavy combat. Recommend searching Command Center for mission logs.',
        });
        this.setObjective(new Vector3(0, 0, 25)); // Command center
        break;

      case 'investigation':
        this.emitObjectiveUpdate('ACCESS COMMAND LOGS', 'Find the terminal in the Command Center.');
        break;

      case 'ambush':
        this.triggerAmbush();
        break;

      case 'discovery':
        // Objective already set in accessLogs
        break;

      case 'exit':
        this.clearObjective();
        break;
    }
  }

  private triggerAmbush(): void {
    if (this.ambushTriggered) return;
    this.ambushTriggered = true;

    this.emitNotification('HOSTILES DETECTED!', 2000);
    this.emitCombatStateChanged(true);

    this.sendCommsMessage('ambush', {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Multiple hostile signatures converging on your position! They were hiding in the tunnels!',
    });

    // Spawn enemies from dark corners of the base
    const spawnPoints = [
      new Vector3(-30, 0, -20), // Behind barracks
      new Vector3(30, 0, -25), // Vehicle bay entrance
      new Vector3(-25, 0, 15), // Command center side
      new Vector3(20, 0, 30), // Courtyard corner
      new Vector3(0, 0, -40), // Underground entrance
    ];

    const assetName = SPECIES_TO_ASSET[AMBUSH_ENEMY_SPECIES];
    if (!assetName) {
      throw new Error(
        `[FOBDelta] No asset mapping for ambush enemy species: ${AMBUSH_ENEMY_SPECIES}`
      );
    }

    if (!this.ambushEnemiesPreloaded) {
      throw new Error(`[FOBDelta] Ambush enemies were not preloaded - cannot spawn enemies`);
    }

    for (let i = 0; i < this.maxEnemies; i++) {
      const spawnPos = spawnPoints[i % spawnPoints.length].clone();
      spawnPos.x += (Math.random() - 0.5) * 10;
      spawnPos.z += (Math.random() - 0.5) * 10;

      const glbInstance = AssetManager.createInstance(
        'aliens',
        assetName,
        `ambushEnemy_${i}`,
        this.scene
      );

      if (!glbInstance) {
        throw new Error(`[FOBDelta] Failed to create GLB enemy instance ${i} (${assetName})`);
      }

      glbInstance.scaling.setAll(AMBUSH_ENEMY_SCALE);
      const enemyMesh = glbInstance;
      log.debug(`Created GLB enemy instance ${i} (${assetName})`);

      enemyMesh.position = spawnPos.clone();
      enemyMesh.position.y = 1;

      // Spawn animation
      enemyMesh.scaling.setAll(0.1);
      const targetScale = AMBUSH_ENEMY_SCALE;
      const spawnStart = performance.now();
      const animateSpawn = () => {
        const elapsed = performance.now() - spawnStart;
        const progress = Math.min(elapsed / 500, 1);
        enemyMesh.scaling.setAll(0.1 + progress * (targetScale - 0.1));
        if (progress < 1) requestAnimationFrame(animateSpawn);
      };
      requestAnimationFrame(animateSpawn);

      this.enemies.push({
        mesh: enemyMesh,
        health: 60,
        position: spawnPos,
        state: 'chase',
        attackCooldown: 0,
      });
    }

    this.enemyCount = this.maxEnemies;
  }

  private checkAreaTriggers(): void {
    const playerPos = this.camera.position;

    for (const zone of this.areaZones) {
      if (zone.triggered) continue;

      const dist = Vector3.Distance(new Vector3(playerPos.x, 0, playerPos.z), zone.center);

      if (dist < zone.radius) {
        zone.triggered = true;
        this.onEnterArea(zone.id);
      }
    }
  }

  private onEnterArea(areaId: string): void {
    switch (areaId) {
      case 'perimeter':
        // Already handled in start
        break;

      case 'courtyard':
        if (this.phase === 'approach') {
          this.transitionToPhase('courtyard');
        }
        break;

      case 'barracks':
        this.sendCommsMessage('barracks_entry', {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Barracks area. Signs of struggle. No survivors detected.',
        });
        break;

      case 'command':
        if (this.phase === 'courtyard') {
          this.transitionToPhase('investigation');
        }
        break;

      case 'vehiclebay':
        this.sendCommsMessage('vehiclebay_entry', {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: "Vehicle Bay. That's... that's Corporal Cole's TITAN. The mech is powered down but intact.",
        });

        // Trigger ambush if not already done and logs accessed
        if (this.logsAccessed && !this.ambushTriggered) {
          setTimeout(() => {
            this.transitionToPhase('ambush');
          }, 3000);
        }
        break;

      case 'hatch':
        if (this.phase === 'discovery' || this.phase === 'exit') {
          // Near the exit
          if (this.hatchOpen) {
            this.emitNotification('PRESS E TO ENTER TUNNELS', 2000);
          }
        }
        break;
    }
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Get keybindings for action mapping
    const interactKeys = this.inputTracker.getAllKeysForAction('interact');
    const fireKeys = this.inputTracker.getAllKeysForAction('fire');
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');

    // Handle level-specific action keys (F for flashlight, T for scanner, V for melee)
    // These are level-specific tools, not part of the global keybindings system
    switch (e.code) {
      case 'KeyF':
        this.toggleFlashlight();
        break;
      case 'KeyT':
        this.activateScanner();
        break;
      case 'KeyV':
        // Melee attack (level-specific combat action)
        this.meleeAttack();
        break;
    }

    // Handle reload action (configurable keybinding, default: R)
    if (reloadKeys.includes(e.code)) {
      this.handleReload();
    }

    // Handle interact action (configurable keybinding, default: E)
    if (interactKeys.includes(e.code)) {
      // Check for level exit
      if (this.hatchOpen && this.undergroundHatch) {
        const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
        if (dist < 3) {
          this.completeLevel();
          return;
        }
      }
      this.tryInteract();
    }

    // Handle fire action (configurable keybinding, for non-mouse bindings)
    const nonMouseFireKeys = fireKeys.filter((k) => !k.startsWith('Mouse'));
    if (nonMouseFireKeys.includes(e.code)) {
      this.firePrimaryWeapon();
    }
  }

  protected override handleClick(): void {
    super.handleClick();

    // Fire weapon when pointer is locked (in game)
    if (this.isPointerLocked()) {
      this.firePrimaryWeapon();
    }
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update damage feedback system (floating damage numbers, etc.)
    damageFeedback.update(deltaTime);
    damageFeedback.setCameraPosition(this.camera.position);

    // Update flashlight position
    if (this.flashlight) {
      this.flashlight.position.copyFrom(this.camera.position);
    }

    // Update flickering lights
    this.updateFlickerLights(deltaTime);

    // Update modular base flicker lights
    if (this.modularBaseResult) {
      updateModularFlickerLights(this.modularBaseResult.lights, deltaTime);
    }

    // Check area triggers
    this.checkAreaTriggers();

    // Update action buttons (for interact prompts)
    this.updateActionButtons();

    // Update enemies (ambush AI)
    this.updateEnemies(deltaTime);

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

    // Animate mech eyes (subtle pulsing)
    if (this.mechEyeLight) {
      const eyePulse = 0.25 + Math.sin(performance.now() * 0.002) * 0.1;
      this.mechEyeLight.intensity = eyePulse;
    }

    // Animate supply pickups (floating bob and rotation)
    this.updateSupplyPickups(deltaTime);

    // Update perimeter spotlight sweep (for active spotlights)
    this.updateSpotlights(deltaTime);

    // Keep player at eye height
    this.camera.position.y = 1.7;

    // Boundary constraints
    const bounds = 38;
    this.camera.position.x = Math.max(-bounds, Math.min(bounds, this.camera.position.x));
    this.camera.position.z = Math.max(-bounds, Math.min(bounds, this.camera.position.z));
  }

  private updateEnemies(deltaTime: number): void {
    if (this.enemies.length === 0) return;

    const playerPos = this.camera.position;
    const chaseSpeed = 4; // units per second
    const attackRange = 2.5;
    const attackDamage = 8;
    const attackCooldownTime = 1.5; // seconds

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // Skip dead enemies
      if (enemy.health <= 0) {
        this.onEnemyKilled(enemy, i);
        continue;
      }

      // Calculate distance to player
      const toPlayer = new Vector3(
        playerPos.x - enemy.mesh.position.x,
        0,
        playerPos.z - enemy.mesh.position.z
      );
      const distance = toPlayer.length();

      // Update attack cooldown
      if (enemy.attackCooldown > 0) {
        enemy.attackCooldown -= deltaTime;
      }

      // State machine for enemy AI
      if (distance < attackRange) {
        // In attack range
        enemy.state = 'attack';

        // Face the player
        if (distance > 0.1) {
          const angle = Math.atan2(toPlayer.x, toPlayer.z);
          enemy.mesh.rotation.y = angle;
        }

        // Attack if cooldown is ready
        if (enemy.attackCooldown <= 0) {
          this.onEnemyAttack(enemy, attackDamage);
          enemy.attackCooldown = attackCooldownTime;
        }
      } else {
        // Chase the player
        enemy.state = 'chase';

        // Move toward player
        toPlayer.normalize();
        enemy.mesh.position.x += toPlayer.x * chaseSpeed * deltaTime;
        enemy.mesh.position.z += toPlayer.z * chaseSpeed * deltaTime;
        enemy.position.copyFrom(enemy.mesh.position);

        // Face movement direction
        const angle = Math.atan2(toPlayer.x, toPlayer.z);
        enemy.mesh.rotation.y = angle;

        // Subtle bobbing animation while moving
        enemy.mesh.position.y = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      }
    }
  }

  private onEnemyAttack(enemy: (typeof this.enemies)[0], damage: number): void {
    // Visual feedback - enemy lunges
    const originalY = enemy.mesh.position.y;
    enemy.mesh.position.y += 0.3;
    setTimeout(() => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        enemy.mesh.position.y = originalY;
      }
    }, 150);

    // Apply damage to player
    this.emitHealthChanged(-damage);

    // Apply player damage feedback (screen shake scaled to damage)
    damageFeedback.applyPlayerDamageFeedback(damage);

    this.emitNotification('TAKING DAMAGE!', 500);
  }

  private onEnemyKilled(enemy: (typeof this.enemies)[0], index: number): void {
    this.killCount++;
    this.enemyCount--;

    // Emit alien death particle effect (green goo burst)
    particleManager.emitAlienDeath(enemy.mesh.position.clone(), 1.2);

    // Death animation - shrink and fade
    const deathStart = performance.now();
    const animateDeath = () => {
      const elapsed = performance.now() - deathStart;
      const progress = Math.min(elapsed / 300, 1);

      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        enemy.mesh.scaling.setAll(1 - progress);
        enemy.mesh.position.y = 1 - progress * 0.5;

        if (progress >= 1) {
          enemy.mesh.dispose();
        } else {
          requestAnimationFrame(animateDeath);
        }
      }
    };
    requestAnimationFrame(animateDeath);

    // Remove from array
    this.enemies.splice(index, 1);

    // Check if all enemies defeated
    if (this.enemies.length === 0 && this.ambushTriggered) {
      this.onAmbushCleared();
    }
  }

  private onAmbushCleared(): void {
    this.emitCombatStateChanged(false);
    this.emitNotification('AREA CLEAR', 2000);

    setTimeout(() => {
      this.sendCommsMessage('ambush_clear', {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Hostile contacts eliminated. Proceed to the underground access, Sergeant.',
      });
    }, 1500);
  }

  /**
   * Handle reload action
   */
  private handleReload(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;

    const state = weaponActions.getState();
    if (state.isReloading) {
      // Already reloading
      return;
    }

    if (state.currentAmmo >= state.maxMagazineSize) {
      this.emitNotification('MAGAZINE FULL', 800);
      return;
    }

    if (state.reserveAmmo <= 0) {
      this.emitNotification('NO RESERVE AMMO', 800);
      return;
    }

    startReload();
    this.emitNotification('RELOADING...', 1500);
  }

  /**
   * Melee attack - close range, high damage
   */
  private meleeAttack(): void {
    if (this.meleeCooldown > 0) return;
    if (this.phase !== 'ambush' || this.enemies.length === 0) return;

    this.meleeCooldown = this.MELEE_COOLDOWN;
    this.emitNotification('MELEE!', 500);

    const playerPos = this.camera.position;
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // Attack position is in front of the player
    const attackPos = playerPos.add(forward.scale(this.MELEE_RANGE / 2));

    // Damage enemies in melee range
    const hitAny = this.damageEnemyAtPosition(attackPos, this.MELEE_DAMAGE, this.MELEE_RANGE);

    if (hitAny) {
      this.emitNotification('HIT!', 300);
      this.recordKill(); // Trigger hit feedback
    }
  }

  /**
   * Primary fire - ranged weapon attack (pistol/rifle)
   */
  private firePrimaryWeapon(): void {
    if (this.primaryFireCooldown > 0) return;
    if (!this.isPointerLocked()) return;

    // Only allow shooting during combat
    if (this.phase !== 'ambush' || this.enemies.length === 0) return;

    // Check ammo - use weapon system if available
    if (!fireWeapon()) {
      // No ammo - show notification and auto-start reload
      this.emitNotification('NO AMMO - RELOADING', 800);
      startReload();
      return;
    }

    this.primaryFireCooldown = this.PRIMARY_FIRE_COOLDOWN;

    const playerPos = this.camera.position;
    const forward = this.camera.getDirection(Vector3.Forward());

    // Check for enemy hits using simple ray-like detection
    let closestEnemy: (typeof this.enemies)[0] | null = null;
    let closestDist = this.PRIMARY_FIRE_RANGE;

    for (const enemy of this.enemies) {
      if (enemy.health <= 0) continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();

      if (dist > this.PRIMARY_FIRE_RANGE) continue;

      // Check if enemy is in line of fire (dot product)
      const dot = Vector3.Dot(toEnemy.normalize(), forward);
      const crossDist = Math.sqrt(1 - dot * dot) * dist;

      // Enemy must be in front and within a narrow cone
      if (dot > 0.9 && crossDist < 1.0 && dist < closestDist) {
        closestEnemy = enemy;
        closestDist = dist;
      }
    }

    if (closestEnemy) {
      // Hit the enemy
      closestEnemy.health -= this.PRIMARY_FIRE_DAMAGE;

      // Apply comprehensive damage feedback (hit flash, knockback, damage number, screen shake)
      damageFeedback.applyDamageFeedback(closestEnemy.mesh, this.PRIMARY_FIRE_DAMAGE, forward);

      // Emit alien splatter particle effect
      particleManager.emitAlienSplatter(closestEnemy.mesh.position, 0.6);

      this.emitNotification('HIT!', 200);
    }

    // Create muzzle flash effect
    this.createMuzzleFlash();
  }

  /**
   * Create a brief muzzle flash visual effect using particle system
   */
  private createMuzzleFlash(): void {
    // Position slightly in front of camera
    const forward = this.camera.getDirection(Vector3.Forward());
    const flashPos = this.camera.position.add(forward.scale(0.5));

    // Emit particle muzzle flash
    particleManager.emitMuzzleFlash(flashPos, forward);

    // Also keep the point light flash for additional visual impact
    const flashLight = new PointLight('muzzleFlash', flashPos, this.scene);
    flashLight.diffuse = new Color3(1, 0.8, 0.4);
    flashLight.intensity = 2;
    flashLight.range = 10;

    // Fade out quickly
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

  /**
   * Handle damage to enemies from player attacks
   */
  public damageEnemyAtPosition(position: Vector3, damage: number, radius: number = 2): boolean {
    let hitAny = false;

    for (const enemy of this.enemies) {
      const dist = Vector3.Distance(position, enemy.mesh.position);
      if (dist < radius) {
        enemy.health -= damage;
        hitAny = true;

        // Calculate hit direction for knockback
        const hitDirection = enemy.mesh.position.subtract(position).normalize();

        // Apply comprehensive damage feedback (hit flash, knockback, damage number, screen shake)
        damageFeedback.applyDamageFeedback(enemy.mesh, damage, hitDirection);

        // Emit blood/splatter particle effect at enemy position
        particleManager.emitAlienSplatter(enemy.mesh.position, 0.8);
      }
    }

    return hitAny;
  }

  private updateFlickerLights(deltaTime: number): void {
    for (const fl of this.flickerLights) {
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

        // Flickering intensity
        const noise = Math.sin(fl.timer) * Math.sin(fl.timer * 2.3) * Math.sin(fl.timer * 0.7);
        fl.light.intensity = fl.baseIntensity + noise * fl.flickerAmount * fl.baseIntensity;
        fl.light.intensity = Math.max(0, fl.light.intensity);
      }
    }
  }

  /**
   * Update supply pickup animations (floating bob and slow rotation).
   */
  private updateSupplyPickups(deltaTime: number): void {
    const time = performance.now() * 0.001;
    for (const supply of this.supplyPickups) {
      if (supply.collected) continue;

      // Gentle floating bob
      const bobOffset = Math.sin(time * 2 + supply.position.x) * 0.1;
      supply.mesh.position.y = supply.position.y + bobOffset;

      // Slow rotation
      supply.mesh.rotation.y += deltaTime * 0.5;

      // Pulse the glow light
      const pulse = 0.2 + Math.sin(time * 3 + supply.position.z) * 0.1;
      supply.glowLight.intensity = pulse;
    }
  }

  /**
   * Update perimeter spotlight sweep animation.
   */
  private updateSpotlights(_deltaTime: number): void {
    const time = performance.now() * 0.001;
    for (const spotlight of this.spotlights) {
      if (!spotlight.active) continue;

      // Slow sweep motion (simulated by modulating intensity based on direction)
      const sweepPhase = Math.sin(time * spotlight.sweepSpeed + spotlight.baseRotation);
      spotlight.light.intensity = 0.4 + sweepPhase * 0.2;
    }
  }

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'brothers_in_arms' && this.phase === 'exit' && this.hatchOpen;
  }

  protected disposeLevel(): void {
    // Unregister action handler
    this.emitActionHandlerRegistered(null);
    this.emitActionGroupsChanged([]);

    // Dispose modular base (corridors, lights, props)
    if (this.modularBaseResult) {
      this.modularBaseResult.dispose();
      this.modularBaseResult = null;
    }

    // Dispose flicker lights
    for (const fl of this.flickerLights) {
      fl.light.dispose();
    }
    this.flickerLights = [];

    // Dispose enemies
    for (const enemy of this.enemies) {
      enemy.mesh.dispose();
    }
    this.enemies = [];

    // Dispose alien vehicle wrecks
    for (const vehicle of this.alienVehicles) {
      vehicle.dispose();
    }
    this.alienVehicles = [];

    // Dispose special lights
    this.terminalLight?.dispose();
    this.mechEyeLight?.dispose();
    this.flashlight?.dispose();
    this.horrorAmbient?.dispose();
    this.miningTerminalLight?.dispose();

    // Dispose supply pickup lights
    for (const supply of this.supplyPickups) {
      supply.glowLight.dispose();
      supply.mesh.dispose();
    }
    this.supplyPickups = [];

    // Dispose fortification meshes
    for (const fort of this.fortificationMeshes) {
      fort.dispose();
    }
    this.fortificationMeshes = [];

    // Dispose turret lights
    for (const turret of this.turretPositions) {
      turret.light?.dispose();
    }
    this.turretPositions = [];

    // Dispose spotlight lights
    for (const spotlight of this.spotlights) {
      spotlight.light.dispose();
    }
    this.spotlights = [];

    // Dispose materials
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();

    // Dispose all meshes
    for (const mesh of this.allMeshes) {
      mesh.dispose();
    }
    this.allMeshes = [];

    // Dispose root
    this.fobRoot?.dispose();
    this.fobRoot = null;

    // Clear references
    this.terminal = null;
    this.mechMesh = null;
    this.undergroundHatch = null;
    this.objectiveMarker = null;
    this.miningTerminal = null;
    this.miningTerminalLight = null;

    // Dispose damage feedback system
    damageFeedback.dispose();
  }
}
