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

import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';

// Map for ambush enemy types to GLB assets
const AMBUSH_ENEMY_SPECIES = 'lurker'; // Maps to scout.glb - tall stalker type
const AMBUSH_ENEMY_SCALE = 0.6;

import '@babylonjs/core/Animations/animatable';

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
  private phaseTime = 0;

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
  private currentObjective: Vector3 | null = null;

  // Flashlight system
  private flashlight: PointLight | null = null;
  private flashlightOn = false;

  // Enemy spawns for ambush
  private ambushTriggered = false;
  private enemyCount = 0;
  private readonly maxEnemies = 5;
  private enemies: Array<{
    mesh: Mesh | TransformNode;
    health: number;
    position: Vector3;
    state: 'idle' | 'chase' | 'attack';
    attackCooldown: number;
  }> = [];
  private ambushEnemiesPreloaded = false;

  // Stats tracking
  private killCount = 0;

  // Action button callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Blood decals for horror atmosphere
  private bloodDecals: Mesh[] = [];

  // Alien vehicle wrecks in courtyard
  private alienVehicles: TransformNode[] = [];

  // Comms messages delivered
  private messageFlags: Set<string> = new Set();

  // Combat state
  private meleeCooldown = 0;
  private primaryFireCooldown = 0;
  private readonly MELEE_DAMAGE = 50;
  private readonly MELEE_RANGE = 3;
  private readonly MELEE_COOLDOWN = 800; // ms
  private readonly PRIMARY_FIRE_DAMAGE = 25;
  private readonly PRIMARY_FIRE_RANGE = 50;
  private readonly PRIMARY_FIRE_COOLDOWN = 150; // ms

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

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

    // Radio static (distant garbled transmissions)
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
    // Ground plane
    const ground = MeshBuilder.CreateGround(
      'fobGround',
      { width: 200, height: 200, subdivisions: 32 },
      this.scene
    );
    ground.material = this.materials.get('ground')!;
    ground.parent = this.fobRoot;
    this.allMeshes.push(ground);

    // Perimeter walls (damaged)
    const wallHeight = 4;
    const wallThickness = 0.5;
    const perimeterSize = 80;

    // Create damaged perimeter walls with gaps
    const wallSegments = [
      // Front wall (with breach)
      { start: -perimeterSize / 2, end: -10, z: -perimeterSize / 2, dir: 'x' },
      { start: 10, end: perimeterSize / 2, z: -perimeterSize / 2, dir: 'x' },
      // Left wall
      { start: -perimeterSize / 2, end: perimeterSize / 2, x: -perimeterSize / 2, dir: 'z' },
      // Right wall
      { start: -perimeterSize / 2, end: perimeterSize / 2, x: perimeterSize / 2, dir: 'z' },
      // Back wall
      { start: -perimeterSize / 2, end: perimeterSize / 2, z: perimeterSize / 2, dir: 'x' },
    ];

    for (let i = 0; i < wallSegments.length; i++) {
      const seg = wallSegments[i];
      const length = seg.end - seg.start;

      const wall = MeshBuilder.CreateBox(
        `perimeterWall_${i}`,
        {
          width: seg.dir === 'x' ? length : wallThickness,
          height: wallHeight,
          depth: seg.dir === 'z' ? length : wallThickness,
        },
        this.scene
      );

      if (seg.dir === 'x') {
        wall.position.set((seg.start + seg.end) / 2, wallHeight / 2, seg.z!);
      } else {
        wall.position.set(seg.x!, wallHeight / 2, (seg.start + seg.end) / 2);
      }

      wall.material = this.materials.get('concrete')!;
      wall.parent = this.fobRoot;
      this.allMeshes.push(wall);
    }

    // Breach debris at entry
    for (let i = 0; i < 8; i++) {
      const debris = MeshBuilder.CreateBox(
        `debris_${i}`,
        {
          width: 1 + Math.random() * 2,
          height: 0.5 + Math.random() * 1.5,
          depth: 1 + Math.random() * 2,
        },
        this.scene
      );
      debris.position.set(
        -8 + Math.random() * 16,
        debris.scaling.y / 2,
        -perimeterSize / 2 + Math.random() * 8
      );
      debris.rotation.y = Math.random() * Math.PI;
      debris.material = this.materials.get('damaged')!;
      debris.parent = this.fobRoot;
      this.allMeshes.push(debris);
    }

    // Sandbag barriers at entry (damaged)
    for (let i = 0; i < 4; i++) {
      const sandbag = MeshBuilder.CreateBox(
        `sandbag_${i}`,
        { width: 3, height: 1, depth: 1 },
        this.scene
      );
      const angle = (i / 4) * Math.PI - Math.PI / 2;
      sandbag.position.set(
        Math.sin(angle) * 12,
        0.5,
        -perimeterSize / 2 + 10 + Math.cos(angle) * 5
      );
      sandbag.rotation.y = angle + Math.random() * 0.5;
      sandbag.material = this.materials.get('sandbag')!;
      sandbag.parent = this.fobRoot;
      this.allMeshes.push(sandbag);
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

    // Overturned vehicle (simple box representation)
    const vehicle = MeshBuilder.CreateBox(
      'overturnedVehicle',
      { width: 3, height: 2, depth: 6 },
      this.scene
    );
    vehicle.position.set(-8, 1.5, 0);
    vehicle.rotation.z = Math.PI / 3; // Tipped over
    vehicle.rotation.y = 0.3;
    vehicle.material = this.materials.get('military')!;
    vehicle.parent = this.fobRoot;
    this.allMeshes.push(vehicle);

    // Wheels (cylinders)
    for (let i = 0; i < 4; i++) {
      const wheel = MeshBuilder.CreateCylinder(
        `wheel_${i}`,
        { height: 0.4, diameter: 0.8, tessellation: 12 },
        this.scene
      );
      const xOff = i < 2 ? -1.2 : 1.2;
      const zOff = i % 2 === 0 ? -2 : 2;
      wheel.position.set(-8 + xOff, 0.8 + xOff * 0.5, zOff);
      wheel.rotation.z = Math.PI / 2;
      wheel.material = this.materials.get('metal')!;
      wheel.parent = this.fobRoot;
      this.allMeshes.push(wheel);
    }

    // Scattered crates
    const cratePositions = [
      new Vector3(5, 0.5, -5),
      new Vector3(7, 0.5, -3),
      new Vector3(5, 1.5, -4),
      new Vector3(-3, 0.5, 8),
      new Vector3(-5, 0.5, 7),
      new Vector3(12, 0.5, 5),
      new Vector3(10, 0.5, 3),
    ];

    for (let i = 0; i < cratePositions.length; i++) {
      const size = 0.8 + Math.random() * 0.4;
      const crate = MeshBuilder.CreateBox(
        `crate_${i}`,
        { width: size, height: size, depth: size },
        this.scene
      );
      crate.position = cratePositions[i].clone();
      crate.rotation.y = Math.random() * Math.PI;
      crate.material = this.materials.get('military')!;
      crate.parent = this.fobRoot;
      this.allMeshes.push(crate);
    }

    // Barrels
    for (let i = 0; i < 5; i++) {
      const barrel = MeshBuilder.CreateCylinder(
        `barrel_${i}`,
        { height: 1.2, diameter: 0.6, tessellation: 12 },
        this.scene
      );
      barrel.position.set(-15 + Math.random() * 30, 0.6, -10 + Math.random() * 20);
      barrel.material = this.materials.get('damaged')!;
      barrel.parent = this.fobRoot;
      this.allMeshes.push(barrel);
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

    // Main structure
    const barracks = MeshBuilder.CreateBox(
      'barracks',
      { width: 12, height: 4, depth: 20 },
      this.scene
    );
    barracks.position.set(barracksX, 2, barracksZ);
    barracks.material = this.materials.get('military')!;
    barracks.parent = this.fobRoot;
    this.allMeshes.push(barracks);

    // Door opening (represented as dark recess)
    const doorway = MeshBuilder.CreateBox(
      'barracksDoor',
      { width: 2, height: 2.5, depth: 0.5 },
      this.scene
    );
    doorway.position.set(barracksX + 6.3, 1.25, barracksZ);
    doorway.material = this.materials.get('metal')!;
    doorway.parent = this.fobRoot;
    this.allMeshes.push(doorway);

    // Interior bunks (visible through door)
    for (let i = 0; i < 4; i++) {
      const bunk = MeshBuilder.CreateBox(
        `bunk_${i}`,
        { width: 2, height: 0.8, depth: 1 },
        this.scene
      );
      bunk.position.set(barracksX - 3, 0.4 + (i % 2) * 1.2, barracksZ - 6 + i * 4);
      bunk.material = this.materials.get('metal')!;
      bunk.parent = this.fobRoot;
      this.allMeshes.push(bunk);
    }

    // Barracks interior light (dim, flickering)
    this.addFlickerLight(
      new Vector3(barracksX, 3.5, barracksZ),
      new Color3(1, 0.7, 0.5),
      0.3,
      0.9,
      25
    );

    // Bodies represented as capsules (horror element)
    const bodyPositions = [
      new Vector3(barracksX + 2, 0.3, barracksZ - 3),
      new Vector3(barracksX - 2, 0.3, barracksZ + 5),
    ];

    for (let i = 0; i < bodyPositions.length; i++) {
      const body = MeshBuilder.CreateCapsule(
        `body_${i}`,
        { height: 1.8, radius: 0.25 },
        this.scene
      );
      body.position = bodyPositions[i].clone();
      body.rotation.z = Math.PI / 2;
      body.rotation.y = Math.random() * Math.PI;
      body.material = this.materials.get('military')!;
      body.parent = this.fobRoot;
      this.allMeshes.push(body);
    }
  }

  private createCommandCenter(): void {
    // Command Center - north side
    const cmdX = 0;
    const cmdZ = 25;

    // Main structure
    const cmdCenter = MeshBuilder.CreateBox(
      'commandCenter',
      { width: 15, height: 5, depth: 10 },
      this.scene
    );
    cmdCenter.position.set(cmdX, 2.5, cmdZ);
    cmdCenter.material = this.materials.get('military')!;
    cmdCenter.parent = this.fobRoot;
    this.allMeshes.push(cmdCenter);

    // Door
    const cmdDoor = MeshBuilder.CreateBox(
      'cmdDoor',
      { width: 2, height: 2.5, depth: 0.5 },
      this.scene
    );
    cmdDoor.position.set(cmdX, 1.25, cmdZ - 5.3);
    cmdDoor.material = this.materials.get('metal')!;
    cmdDoor.parent = this.fobRoot;
    this.allMeshes.push(cmdDoor);

    // Terminal
    const terminalBase = MeshBuilder.CreateBox(
      'terminalBase',
      { width: 1.5, height: 1.2, depth: 0.8 },
      this.scene
    );
    terminalBase.position.set(cmdX, 0.6, cmdZ + 2);
    terminalBase.material = this.materials.get('metal')!;
    terminalBase.parent = this.fobRoot;
    this.allMeshes.push(terminalBase);

    // Terminal screen
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

    // Comm tower outside
    const commTower = MeshBuilder.CreateCylinder(
      'commTower',
      { height: 12, diameter: 1, tessellation: 8 },
      this.scene
    );
    commTower.position.set(cmdX + 10, 6, cmdZ);
    commTower.material = this.materials.get('metal')!;
    commTower.parent = this.fobRoot;
    this.allMeshes.push(commTower);

    // Antenna dish
    const dish = MeshBuilder.CreateDisc('dish', { radius: 2, tessellation: 16 }, this.scene);
    dish.position.set(cmdX + 10, 10, cmdZ);
    dish.rotation.x = -Math.PI / 4;
    dish.material = this.materials.get('metal')!;
    dish.parent = this.fobRoot;
    this.allMeshes.push(dish);
  }

  private createVehicleBay(): void {
    // Vehicle Bay - east side (where mech is)
    const bayX = 25;
    const bayZ = 0;

    // Hangar-style structure
    const hangar = MeshBuilder.CreateBox(
      'vehicleBay',
      { width: 20, height: 8, depth: 25 },
      this.scene
    );
    hangar.position.set(bayX, 4, bayZ);
    hangar.material = this.materials.get('military')!;
    hangar.parent = this.fobRoot;
    this.allMeshes.push(hangar);

    // Large rolling door (open)
    const doorFrame = MeshBuilder.CreateBox(
      'bayDoorFrame',
      { width: 10, height: 7, depth: 0.5 },
      this.scene
    );
    doorFrame.position.set(bayX - 10.3, 3.5, bayZ);
    doorFrame.material = this.materials.get('metal')!;
    doorFrame.parent = this.fobRoot;
    this.allMeshes.push(doorFrame);

    // Caution stripes around door
    for (let i = 0; i < 3; i++) {
      const stripe = MeshBuilder.CreateBox(
        `bayStripe_${i}`,
        { width: 10, height: 0.3, depth: 0.55 },
        this.scene
      );
      stripe.position.set(bayX - 10.3, 1 + i * 2.5, bayZ);
      stripe.material = this.materials.get('caution')!;
      stripe.parent = this.fobRoot;
      this.allMeshes.push(stripe);
    }

    // Marcus's damaged mech (TITAN)
    this.createMech(new Vector3(bayX + 2, 0, bayZ));

    // Vehicle bay lights (most are dead/flickering badly)
    this.addFlickerLight(new Vector3(bayX, 7, bayZ - 8), new Color3(1, 0.6, 0.4), 0.2, 0.95, 30);
    this.addFlickerLight(new Vector3(bayX, 7, bayZ + 8), new Color3(1, 0.7, 0.5), 0.15, 0.9, 25);
  }

  private createMech(position: Vector3): void {
    // Marcus's TITAN mech - damaged, eyes glowing ominously

    // Legs
    const leftLeg = MeshBuilder.CreateBox(
      'mechLeftLeg',
      { width: 1, height: 4, depth: 1.2 },
      this.scene
    );
    leftLeg.position.set(position.x - 1, 2, position.z);
    leftLeg.material = this.materials.get('mech')!;
    leftLeg.parent = this.fobRoot;
    this.allMeshes.push(leftLeg);

    const rightLeg = MeshBuilder.CreateBox(
      'mechRightLeg',
      { width: 1, height: 4, depth: 1.2 },
      this.scene
    );
    rightLeg.position.set(position.x + 1, 2, position.z);
    rightLeg.material = this.materials.get('mech')!;
    rightLeg.parent = this.fobRoot;
    this.allMeshes.push(rightLeg);

    // Torso
    const torso = MeshBuilder.CreateBox('mechTorso', { width: 3, height: 3, depth: 2 }, this.scene);
    torso.position.set(position.x, 5.5, position.z);
    torso.material = this.materials.get('mech')!;
    torso.parent = this.fobRoot;
    this.allMeshes.push(torso);

    // Head/cockpit
    this.mechMesh = MeshBuilder.CreateBox(
      'mechHead',
      { width: 2, height: 1.5, depth: 1.5 },
      this.scene
    );
    this.mechMesh.position.set(position.x, 7.5, position.z);
    this.mechMesh.material = this.materials.get('mech')!;
    this.mechMesh.parent = this.fobRoot;
    this.allMeshes.push(this.mechMesh);

    // Eyes (glowing red - eerie)
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

    // Arm cannons (damaged, pointing down)
    const leftArm = MeshBuilder.CreateCylinder(
      'mechLeftArm',
      { height: 3, diameter: 0.8, tessellation: 8 },
      this.scene
    );
    leftArm.position.set(position.x - 2, 4.5, position.z);
    leftArm.rotation.z = 0.3;
    leftArm.material = this.materials.get('mech')!;
    leftArm.parent = this.fobRoot;
    this.allMeshes.push(leftArm);

    const rightArm = MeshBuilder.CreateCylinder(
      'mechRightArm',
      { height: 3, diameter: 0.8, tessellation: 8 },
      this.scene
    );
    rightArm.position.set(position.x + 2, 4.5, position.z);
    rightArm.rotation.z = -0.3;
    rightArm.material = this.materials.get('mech')!;
    rightArm.parent = this.fobRoot;
    this.allMeshes.push(rightArm);
  }

  private createUndergroundAccess(): void {
    // Underground access hatch - in vehicle bay
    const hatchX = 30;
    const hatchZ = 10;

    // Floor plate around hatch
    const floorPlate = MeshBuilder.CreateCylinder(
      'hatchFloor',
      { height: 0.1, diameter: 4, tessellation: 16 },
      this.scene
    );
    floorPlate.position.set(hatchX, 0.05, hatchZ);
    floorPlate.material = this.materials.get('metal')!;
    floorPlate.parent = this.fobRoot;
    this.allMeshes.push(floorPlate);

    // Hatch itself
    this.undergroundHatch = MeshBuilder.CreateCylinder(
      'hatch',
      { height: 0.2, diameter: 2.5, tessellation: 16 },
      this.scene
    );
    this.undergroundHatch.position.set(hatchX, 0.15, hatchZ);
    this.undergroundHatch.material = this.materials.get('hatch')!;
    this.undergroundHatch.parent = this.fobRoot;
    this.allMeshes.push(this.undergroundHatch);

    // Hatch handle
    const handle = MeshBuilder.CreateTorus(
      'hatchHandle',
      { diameter: 0.6, thickness: 0.08, tessellation: 16 },
      this.scene
    );
    handle.position.set(hatchX, 0.35, hatchZ);
    handle.rotation.x = Math.PI / 2;
    handle.material = this.materials.get('metal')!;
    handle.parent = this.fobRoot;
    this.allMeshes.push(handle);

    // Caution marking
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

      console.log(`[FOBDelta] Loaded ${this.alienVehicles.length} alien vehicle wrecks`);
    } catch (error) {
      console.warn('[FOBDelta] Could not load alien vehicle models, using fallback:', error);
      // Fallback: Create simple placeholder meshes if GLB fails to load
      for (let i = 0; i < vehicleWrecks.length; i++) {
        const wreck = vehicleWrecks[i];
        const placeholder = MeshBuilder.CreateBox(
          `wraith_placeholder_${i}`,
          { width: 4, height: 1.5, depth: 6 },
          this.scene
        );
        placeholder.position = wreck.position;
        placeholder.rotation = wreck.rotation;
        placeholder.material = this.materials.get('damaged')!;
        if (this.fobRoot) {
          placeholder.parent = this.fobRoot;
        }
        this.allMeshes.push(placeholder);
      }
    }
  }

  /**
   * Preload GLB models for ambush enemies so they spawn instantly
   */
  private async preloadAmbushEnemyModels(): Promise<void> {
    const assetName = SPECIES_TO_ASSET[AMBUSH_ENEMY_SPECIES];
    if (!assetName) {
      console.warn('[FOBDelta] No asset mapping for ambush enemy species');
      return;
    }

    try {
      await AssetManager.loadAsset('aliens', assetName, this.scene);
      this.ambushEnemiesPreloaded = true;
      console.log(`[FOBDelta] Preloaded ambush enemy GLB: ${assetName}`);
    } catch (error) {
      console.warn('[FOBDelta] Failed to preload ambush enemy GLB:', error);
      this.ambushEnemiesPreloaded = false;
    }
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
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Set exploration action buttons
    this.updateActionButtons();

    // Initial comms
    this.callbacks.onNotification('FOB DELTA - FORWARD OPERATING BASE', 3000);
    this.callbacks.onObjectiveUpdate(
      'INVESTIGATE FOB DELTA',
      'Search the base for survivors and intel.'
    );

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

    this.callbacks.onNotification(this.flashlightOn ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF', 800);
  }

  private activateScanner(): void {
    // Simple scanner pulse - shows nearby points of interest
    this.callbacks.onNotification('SCANNING...', 1500);

    // Check if near terminal
    if (this.terminal) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 15 && !this.logsAccessed) {
        setTimeout(() => {
          this.callbacks.onNotification('TERMINAL DETECTED - 12M', 2000);
          this.setObjective(this.terminal!.position);
        }, 1500);
      }
    }

    // Check if near mech
    if (this.mechMesh) {
      const dist = Vector3.Distance(this.camera.position, this.mechMesh.position);
      if (dist < 20) {
        setTimeout(() => {
          this.callbacks.onNotification('MECH SIGNATURE DETECTED', 2000);
        }, 1500);
      }
    }

    // Check if near hatch
    if (this.undergroundHatch && this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.undergroundHatch.position);
      if (dist < 15 && !this.hatchOpen) {
        setTimeout(() => {
          this.callbacks.onNotification('UNDERGROUND ACCESS DETECTED', 2000);
          this.setObjective(this.undergroundHatch!.position);
        }, 1500);
      }
    }
  }

  private tryInteract(): void {
    // Check terminal interaction
    if (this.terminal && !this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 4) {
        this.accessLogs();
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

  private accessLogs(): void {
    this.logsAccessed = true;
    this.callbacks.onNotification('ACCESSING MISSION LOGS...', 2000);

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
      this.callbacks.onObjectiveUpdate(
        'LOCATE UNDERGROUND ACCESS',
        'Find the tunnel entrance in the Vehicle Bay.'
      );
      this.transitionToPhase('discovery');
      this.setObjective(new Vector3(30, 0, 10)); // Hatch location
    }, 20000);
  }

  private openHatch(): void {
    this.hatchOpen = true;
    this.callbacks.onNotification('HATCH OPENED', 1500);

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
      this.callbacks.onObjectiveUpdate(
        'DESCEND INTO THE BREACH',
        'Enter the underground tunnels to find Marcus.'
      );
      this.transitionToPhase('exit');
    }, 6000);

    setTimeout(() => {
      this.callbacks.onNotification('PROCEED TO UNDERGROUND ACCESS', 3000);
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

    this.callbacks.onActionGroupsChange(groups);
  }

  private checkNearInteractable(): string | null {
    // Terminal
    if (this.terminal && !this.logsAccessed) {
      const dist = Vector3.Distance(this.camera.position, this.terminal.position);
      if (dist < 4) return 'ACCESS TERMINAL';
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
    this.callbacks.onCommsMessage(message);
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
        this.callbacks.onObjectiveUpdate(
          'ACCESS COMMAND LOGS',
          'Find the terminal in the Command Center.'
        );
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

    this.callbacks.onNotification('HOSTILES DETECTED!', 2000);
    this.callbacks.onCombatStateChange(true);

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

    // Materials for fallback procedural enemies
    const enemyMat = new StandardMaterial('ambushEnemyMat', this.scene);
    enemyMat.diffuseColor = new Color3(0.2, 0.15, 0.25);
    enemyMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const glowMat = new StandardMaterial('enemyGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#4AFF9F');
    glowMat.disableLighting = true;

    for (let i = 0; i < this.maxEnemies; i++) {
      const spawnPos = spawnPoints[i % spawnPoints.length].clone();
      spawnPos.x += (Math.random() - 0.5) * 10;
      spawnPos.z += (Math.random() - 0.5) * 10;

      // Try GLB model first
      let enemyMesh: Mesh | TransformNode;
      const assetName = SPECIES_TO_ASSET[AMBUSH_ENEMY_SPECIES];

      if (this.ambushEnemiesPreloaded && assetName) {
        const glbInstance = AssetManager.createInstance(
          'aliens',
          assetName,
          `ambushEnemy_${i}`,
          this.scene
        );

        if (glbInstance) {
          glbInstance.scaling.setAll(AMBUSH_ENEMY_SCALE);
          enemyMesh = glbInstance;
          console.log(`[FOBDelta] Created GLB enemy instance ${i} (${assetName})`);
        } else {
          // Fallback to procedural
          enemyMesh = this.createProceduralEnemy(i, enemyMat, glowMat);
        }
      } else {
        // Fallback to procedural
        enemyMesh = this.createProceduralEnemy(i, enemyMat, glowMat);
      }

      enemyMesh.position = spawnPos.clone();
      enemyMesh.position.y = 1;

      // Spawn animation
      enemyMesh.scaling.setAll(0.1);
      const targetScale = this.ambushEnemiesPreloaded ? AMBUSH_ENEMY_SCALE : 1;
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

  /**
   * Create a procedural fallback enemy mesh
   */
  private createProceduralEnemy(
    index: number,
    enemyMat: StandardMaterial,
    glowMat: StandardMaterial
  ): Mesh {
    console.log(`[FOBDelta] Creating procedural enemy ${index} (GLB not available)`);

    // Create lurker-style enemy mesh (tall, thin horrors from the shadows)
    const body = MeshBuilder.CreateCapsule(
      `ambushEnemy_${index}`,
      { height: 2, radius: 0.3 },
      this.scene
    );
    body.material = enemyMat;

    // Glowing eyes
    const leftEye = MeshBuilder.CreateSphere('eye', { diameter: 0.08 }, this.scene);
    leftEye.material = glowMat;
    leftEye.parent = body;
    leftEye.position.set(-0.1, 0.7, -0.25);

    const rightEye = MeshBuilder.CreateSphere('eye', { diameter: 0.08 }, this.scene);
    rightEye.material = glowMat;
    rightEye.parent = body;
    rightEye.position.set(0.1, 0.7, -0.25);

    return body;
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
            this.callbacks.onNotification('PRESS E TO ENTER TUNNELS', 2000);
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
    this.callbacks.onHealthChange(-damage);

    // Apply player damage feedback (screen shake scaled to damage)
    damageFeedback.applyPlayerDamageFeedback(damage);

    this.callbacks.onNotification('TAKING DAMAGE!', 500);
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
    this.callbacks.onCombatStateChange(false);
    this.callbacks.onNotification('AREA CLEAR', 2000);

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

  /**
   * Melee attack - close range, high damage
   */
  private meleeAttack(): void {
    if (this.meleeCooldown > 0) return;
    if (this.phase !== 'ambush' || this.enemies.length === 0) return;

    this.meleeCooldown = this.MELEE_COOLDOWN;
    this.callbacks.onNotification('MELEE!', 500);

    const playerPos = this.camera.position;
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // Attack position is in front of the player
    const attackPos = playerPos.add(forward.scale(this.MELEE_RANGE / 2));

    // Damage enemies in melee range
    const hitAny = this.damageEnemyAtPosition(attackPos, this.MELEE_DAMAGE, this.MELEE_RANGE);

    if (hitAny) {
      this.callbacks.onNotification('HIT!', 300);
      this.callbacks.onKill(); // Trigger hit feedback
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
      this.callbacks.onNotification('NO AMMO - RELOADING', 800);
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

      this.callbacks.onNotification('HIT!', 200);
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

  /**
   * Flash an enemy mesh red when hit (works with both Mesh and TransformNode)
   */
  private flashEnemyRed(mesh: Mesh | TransformNode): void {
    // For a direct Mesh with material
    if ('material' in mesh && mesh.material instanceof StandardMaterial) {
      const mat = mesh.material;
      const origColor = mat.diffuseColor.clone();
      mat.diffuseColor = new Color3(1, 0.2, 0.2);
      setTimeout(() => {
        try {
          mat.diffuseColor = origColor;
        } catch {
          // Material already disposed
        }
      }, 100);
      return;
    }

    // For TransformNode (GLB instance), find child meshes
    const children = mesh.getChildMeshes();
    for (const child of children) {
      if (child.material instanceof StandardMaterial) {
        const mat = child.material;
        const origColor = mat.diffuseColor.clone();
        mat.diffuseColor = new Color3(1, 0.2, 0.2);
        setTimeout(() => {
          try {
            mat.diffuseColor = origColor;
          } catch {
            // Material already disposed
          }
        }, 100);
      }
    }
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

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'brothers_in_arms' && this.phase === 'exit' && this.hatchOpen;
  }

  protected disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

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

    // Dispose damage feedback system
    damageFeedback.dispose();
  }
}
