/**
 * LandfallLevel - INTERACTIVE HALO Jump with Precision Landing
 *
 * TWO DISTINCT PHASES:
 *
 * PHASE 1: FREEFALL (first 2/3 of descent)
 * - Camera looking DOWN at planet
 * - Arms extended toward planet (skydiver pose)
 * - WASD to dodge asteroids in debris belt
 * - When ready, player hits "IGNITE JETS" to transition
 *
 * PHASE 2: POWERED DESCENT (final 1/3)
 * - Camera looking OUT (forward)
 * - Hands gripping thruster handles (visible)
 * - Balance fuel, velocity, and position
 * - Target the LZ pad (visible cement pad on surface)
 *
 * LANDING OUTCOMES:
 * - Perfect (on pad): Smooth transition to FOB Delta
 * - Near miss: Fight through hostiles to reach LZ
 * - Bad landing: Injury, reduced health
 * - Catastrophic: Death / slingshot into space
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
import {
  fireWeapon,
  getCurrentWeaponDef,
  getWeaponActions,
  startReload,
} from '../../context/useWeaponActions';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';

import '@babylonjs/core/Animations/animatable';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';

type DropPhase =
  | 'freefall_start' // Initial orientation
  | 'freefall_belt' // Asteroid dodging
  | 'freefall_clear' // Past asteroids, waiting for jets
  | 'powered_descent' // Jets active, targeting LZ
  | 'landing' // Final approach
  | 'surface'; // On ground

type LandingOutcome = 'perfect' | 'near_miss' | 'rough' | 'crash' | 'slingshot';

interface Asteroid {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  passed: boolean;
  size: number;
  trail?: ParticleSystem; // Smoke/dust trail for larger asteroids
  type: 'rock' | 'ice' | 'metal'; // Visual variety
}

interface DistantThreat {
  node: TransformNode;
  position: Vector3;
  velocity: Vector3;
  rotationSpeed: number;
  type: 'wraith' | 'phantom';
  spawnAltitude: number; // Altitude at which it appears
}

// Combat enemy interface for surface combat
interface SurfaceEnemy {
  mesh: Mesh | TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  state: 'idle' | 'chase' | 'attack';
  attackCooldown: number;
  species: 'skitterer' | 'lurker';
}

// Enemy species constants for surface combat
const SURFACE_ENEMY_SPECIES = 'skitterer'; // Fast, aggressive aliens
const SURFACE_ENEMY_SCALE = 0.5;

export class LandfallLevel extends BaseLevel {
  // Phase management
  private phase: DropPhase = 'freefall_start';
  private phaseTime = 0;

  // Descent metrics
  private altitude = 1000;
  private velocity = 10; // Current downward velocity
  private lateralVelocityX = 0;
  private lateralVelocityZ = 0;

  // Camera FOV settings (in radians)
  // Wide cinematic FOV during freefall for dramatic ODST-style drop
  private readonly FREEFALL_FOV = 1.75; // ~100 degrees - epic wide view
  private readonly POWERED_DESCENT_FOV = 1.4; // ~80 degrees - still dramatic
  private readonly SURFACE_FOV = 1.2; // ~69 degrees - standard FPS
  private targetFOV = 1.75;
  private currentFOV = 1.75;

  // Terrain collision constants
  private readonly MIN_PLAYER_HEIGHT = 1.7; // Player eye height above terrain
  private readonly TERRAIN_BOUNDS = 280; // Half of terrain size (600/2 - margin)

  // Fuel for powered descent
  private fuel = 100;
  private readonly maxFuel = 100;
  private readonly fuelBurnRate = 8; // Per second when boosting
  private readonly fuelRegenRate = 2; // Passive regen

  // Position relative to LZ (0,0 = perfect)
  private positionX = 0;
  private positionZ = 0;
  private readonly maxDrift = 100; // Too far = slingshot

  // LZ target
  private lzPad: Mesh | null = null;
  private lzBeacon: Mesh | null = null;
  private readonly lzRadius = 8; // Perfect landing zone
  private readonly nearMissRadius = 25; // Near miss zone

  // Camera effects (using BaseLevel's shake system)
  // Note: cameraShake/baseShake now managed by BaseLevel.shakeConfig

  // Environment - Freefall
  private planet: Mesh | null = null;
  private planetAtmosphere: Mesh | null = null;
  private starfield: Mesh | null = null;
  private leftArm: Mesh | null = null;
  private rightArm: Mesh | null = null;
  private leftGlove: Mesh | null = null;
  private rightGlove: Mesh | null = null;
  private visorFrame: Mesh | null = null;

  // Anchor Station (visible above player during drop)
  private anchorStation: TransformNode | null = null;
  private stationRing: Mesh | null = null;
  private stationHub: Mesh | null = null;
  private stationSolarPanels: Mesh[] = [];
  private stationLights: Mesh[] = [];
  private stationDropBay: Mesh | null = null;
  private stationInitialDistance = 50; // Initial distance above player
  private stationRecedeSpeed = 8; // How fast it appears to recede

  // Environment - Powered descent
  private leftHandle: Mesh | null = null;
  private rightHandle: Mesh | null = null;
  private thrusterGlow: Mesh | null = null;

  // Asteroids
  private asteroids: Asteroid[] = [];
  private asteroidSpawnTimer = 0;
  private asteroidSpawnRate = 0.35;
  private asteroidsSpawned = 0;

  // Stats
  private suitIntegrity = 100;
  private asteroidsHit = 0;
  private asteroidsDodged = 0;

  // Entry effects
  private plasmaGlow: Mesh | null = null;

  // Atmospheric re-entry particle effects
  private reentryParticles: ParticleSystem | null = null;
  private playerSmokeTrail: ParticleSystem | null = null;
  private heatDistortion: Mesh | null = null;
  private atmosphereStreaks: ParticleSystem | null = null;
  private thrusterExhaustParticles: ParticleSystem | null = null;
  private particleTexture: Texture | null = null;

  // Wind/atmosphere sounds visual cue
  private windStreaks: Mesh[] = [];
  private windIntensity = 0;

  // Near-miss feedback
  private nearMissTimer = 0;
  private readonly NEAR_MISS_COOLDOWN = 0.5; // seconds between near-miss alerts

  // Surface
  private terrain: Mesh | null = null;
  private canyonWalls: Mesh[] = [];
  private skyDome: Mesh | null = null;

  // Landing outcome
  private landingOutcome: LandingOutcome = 'perfect';

  // Distant alien vehicle threats during descent
  private distantThreats: DistantThreat[] = [];
  private threatsSpawned = false;

  // Action button callback reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Surface combat system
  private surfaceEnemies: SurfaceEnemy[] = [];
  private surfaceCombatActive = false;
  private enemyCount = 0;
  private readonly maxSurfaceEnemies = 6;
  private surfaceEnemiesPreloaded = false;
  private killCount = 0;

  // Combat cooldowns
  private meleeCooldown = 0;
  private primaryFireCooldown = 0;
  private readonly MELEE_COOLDOWN = 0.8; // 800ms between melee attacks
  private readonly PRIMARY_FIRE_COOLDOWN = 0.15; // 150ms between shots
  private readonly MELEE_DAMAGE = 40;
  private readonly MELEE_RANGE = 2.5;
  private readonly PRIMARY_FIRE_DAMAGE = 25;
  private readonly PRIMARY_FIRE_RANGE = 50;

  // Environment hazards
  private acidPools: Mesh[] = [];
  private unstableTerrain: Mesh[] = [];
  private acidDamageTimer = 0;
  private readonly ACID_DAMAGE_INTERVAL = 0.5; // Damage every 0.5 seconds in acid
  private readonly ACID_DAMAGE = 8;
  private unstableTerrainShakeTimer = 0;
  private playerInAcid = false;

  // FOB Delta objective marker
  private fobDeltaMarker: Mesh | null = null;
  private fobDeltaBeacon: Mesh | null = null;
  private fobDeltaPosition = new Vector3(0, 0, -150); // FOB Delta is far ahead

  // Combat tutorial tracking (for players who skipped Anchor Station)
  private hasShownMovementTutorial = false;
  private hasShownAimingTutorial = false;
  private hasShownReloadTutorial = false;
  private hasShownCoverTutorial = false;
  private combatTutorialActive = false;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    switch (this.phase) {
      case 'freefall_start':
      case 'freefall_belt':
      case 'freefall_clear':
        return new Color4(0.0, 0.0, 0.03, 1);
      case 'powered_descent':
        return new Color4(0.5, 0.3, 0.2, 1);
      case 'landing':
      case 'surface':
        return new Color4(0.75, 0.5, 0.35, 1);
      default:
        return new Color4(0.0, 0.0, 0.03, 1);
    }
  }

  protected async createEnvironment(): Promise<void> {
    // Start looking DOWN with wide cinematic FOV for epic HALO drop feel
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.x = Math.PI / 2;
    this.rotationX = Math.PI / 2;
    this.rotationY = 0;

    // Set initial wide FOV for dramatic freefall view
    this.camera.fov = this.FREEFALL_FOV;
    this.currentFOV = this.FREEFALL_FOV;
    this.targetFOV = this.FREEFALL_FOV;

    // Initialize AssetManager
    AssetManager.init(this.scene);

    this.createStarfield();
    this.createPlanet();
    this.createAnchorStation(); // Station visible above during drop
    this.createFreefallView();
    this.createPoweredDescentView();
    this.createEntryEffects();
    this.createLandingZone();
    this.createSurface();

    // Preload alien vehicle models for distant threats
    await this.preloadDistantThreats();

    // Initialize particle manager for combat effects
    particleManager.init(this.scene);

    // Preload surface combat enemy models
    await this.preloadSurfaceEnemyModels();

    // Hide powered descent elements initially
    this.setPoweredDescentVisible(false);

    this.startJump();
  }

  /**
   * Preload GLB models for surface combat enemies so they spawn instantly
   */
  private async preloadSurfaceEnemyModels(): Promise<void> {
    const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];
    if (!assetName) {
      console.warn('[Landfall] No asset mapping for surface enemy species');
      return;
    }

    try {
      await AssetManager.loadAsset('aliens', assetName, this.scene);
      this.surfaceEnemiesPreloaded = true;
      console.log(`[Landfall] Preloaded surface enemy GLB: ${assetName}`);
    } catch (error) {
      console.warn('[Landfall] Failed to preload surface enemy GLB:', error);
      this.surfaceEnemiesPreloaded = false;
    }
  }

  private createStarfield(): void {
    this.starfield = MeshBuilder.CreateSphere(
      'stars',
      { diameter: 8000, segments: 16, sideOrientation: 1 },
      this.scene
    );
    const mat = new StandardMaterial('starsMat', this.scene);
    mat.emissiveColor = new Color3(0.03, 0.03, 0.06);
    mat.disableLighting = true;
    this.starfield.material = mat;
    this.starfield.infiniteDistance = true;
  }

  private createPlanet(): void {
    this.planet = MeshBuilder.CreateSphere('planet', { diameter: 80, segments: 64 }, this.scene);
    const planetMat = new StandardMaterial('planetMat', this.scene);
    planetMat.diffuseColor = Color3.FromHexString('#9B7B5A');
    planetMat.specularColor = new Color3(0.08, 0.06, 0.04);
    this.planet.material = planetMat;
    this.planet.position.set(0, -150, 0);

    this.planetAtmosphere = MeshBuilder.CreateSphere(
      'atmos',
      { diameter: 90, segments: 32 },
      this.scene
    );
    const atmosMat = new StandardMaterial('atmosMat', this.scene);
    atmosMat.emissiveColor = new Color3(0.9, 0.6, 0.4);
    atmosMat.alpha = 0.15;
    atmosMat.backFaceCulling = false;
    this.planetAtmosphere.material = atmosMat;
    this.planetAtmosphere.position.copyFrom(this.planet.position);
  }

  /**
   * Creates the Anchor Station Prometheus visible above the player during the HALO drop.
   * The station is a procedural model featuring:
   * - Large rotating ring structure (main habitat)
   * - Central hub cylinder
   * - Solar panels extending outward
   * - Drop pod bay (where the player just left)
   * - Running lights for visual detail
   *
   * The station slowly rotates and recedes as the player falls, creating
   * a powerful "leaving home" moment that adds scale and immersion to the drop.
   */
  private createAnchorStation(): void {
    // Parent node for the entire station
    this.anchorStation = new TransformNode('anchorStation', this.scene);
    this.anchorStation.position.set(0, this.stationInitialDistance, 0);

    // Station materials
    const hullMat = new StandardMaterial('stationHullMat', this.scene);
    hullMat.diffuseColor = new Color3(0.35, 0.38, 0.42);
    hullMat.specularColor = new Color3(0.2, 0.2, 0.25);

    const panelMat = new StandardMaterial('stationPanelMat', this.scene);
    panelMat.diffuseColor = new Color3(0.1, 0.12, 0.2);
    panelMat.specularColor = new Color3(0.4, 0.45, 0.6);

    const lightMat = new StandardMaterial('stationLightMat', this.scene);
    lightMat.emissiveColor = new Color3(0.2, 0.8, 1.0);
    lightMat.disableLighting = true;

    const warningLightMat = new StandardMaterial('stationWarningMat', this.scene);
    warningLightMat.emissiveColor = new Color3(1.0, 0.3, 0.1);
    warningLightMat.disableLighting = true;

    // === MAIN RING (Habitat Torus) ===
    // Large rotating ring - the main living quarters of the station
    this.stationRing = MeshBuilder.CreateTorus(
      'stationRing',
      {
        diameter: 40,
        thickness: 4,
        tessellation: 48,
      },
      this.scene
    );
    this.stationRing.material = hullMat;
    this.stationRing.rotation.x = Math.PI / 2; // Flat orientation
    this.stationRing.parent = this.anchorStation;

    // Ring detail - inner supports
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spoke = MeshBuilder.CreateCylinder(
        `ringSpoke_${i}`,
        {
          height: 16,
          diameter: 0.8,
          tessellation: 8,
        },
        this.scene
      );
      spoke.material = hullMat;
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = angle;
      spoke.position.x = Math.cos(angle) * 10;
      spoke.position.z = Math.sin(angle) * 10;
      spoke.parent = this.anchorStation;
    }

    // === CENTRAL HUB ===
    // The command center and docking hub
    this.stationHub = MeshBuilder.CreateCylinder(
      'stationHub',
      {
        height: 12,
        diameter: 8,
        tessellation: 16,
      },
      this.scene
    );
    this.stationHub.material = hullMat;
    this.stationHub.parent = this.anchorStation;

    // Hub caps (top and bottom)
    const hubCapTop = MeshBuilder.CreateCylinder(
      'hubCapTop',
      {
        height: 2,
        diameterTop: 2,
        diameterBottom: 8,
        tessellation: 16,
      },
      this.scene
    );
    hubCapTop.material = hullMat;
    hubCapTop.position.y = 7;
    hubCapTop.parent = this.anchorStation;

    const hubCapBottom = MeshBuilder.CreateCylinder(
      'hubCapBottom',
      {
        height: 2,
        diameterTop: 8,
        diameterBottom: 2,
        tessellation: 16,
      },
      this.scene
    );
    hubCapBottom.material = hullMat;
    hubCapBottom.position.y = -7;
    hubCapBottom.parent = this.anchorStation;

    // === SOLAR PANELS ===
    // Four large solar panel arrays extending from the hub
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4; // Offset 45 degrees from spokes

      // Panel arm
      const arm = MeshBuilder.CreateCylinder(
        `solarArm_${i}`,
        {
          height: 15,
          diameter: 0.6,
          tessellation: 6,
        },
        this.scene
      );
      arm.material = hullMat;
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = angle;
      arm.position.x = Math.cos(angle) * 11.5;
      arm.position.z = Math.sin(angle) * 11.5;
      arm.position.y = 3;
      arm.parent = this.anchorStation;

      // Solar panel (large rectangle)
      const panel = MeshBuilder.CreateBox(
        `solarPanel_${i}`,
        {
          width: 12,
          height: 0.2,
          depth: 6,
        },
        this.scene
      );
      panel.material = panelMat;
      panel.rotation.y = angle;
      panel.position.x = Math.cos(angle) * 25;
      panel.position.z = Math.sin(angle) * 25;
      panel.position.y = 3;
      panel.parent = this.anchorStation;
      this.stationSolarPanels.push(panel);

      // Panel frame
      const frameOuter = MeshBuilder.CreateBox(
        `panelFrame_${i}`,
        {
          width: 12.5,
          height: 0.4,
          depth: 6.5,
        },
        this.scene
      );
      frameOuter.material = hullMat;
      frameOuter.rotation.y = angle;
      frameOuter.position.x = Math.cos(angle) * 25;
      frameOuter.position.z = Math.sin(angle) * 25;
      frameOuter.position.y = 3;
      frameOuter.parent = this.anchorStation;
    }

    // === DROP POD BAY ===
    // The bay the player just launched from - positioned at the bottom of the hub
    this.stationDropBay = MeshBuilder.CreateBox(
      'dropBay',
      {
        width: 6,
        height: 4,
        depth: 6,
      },
      this.scene
    );
    this.stationDropBay.material = hullMat;
    this.stationDropBay.position.y = -10;
    this.stationDropBay.parent = this.anchorStation;

    // Drop bay opening (where the player came from) - glowing
    const bayOpening = MeshBuilder.CreatePlane(
      'bayOpening',
      {
        width: 4,
        height: 4,
      },
      this.scene
    );
    const bayOpeningMat = new StandardMaterial('bayOpeningMat', this.scene);
    bayOpeningMat.emissiveColor = new Color3(1.0, 0.6, 0.2);
    bayOpeningMat.alpha = 0.6;
    bayOpeningMat.disableLighting = true;
    bayOpening.material = bayOpeningMat;
    bayOpening.position.y = -12;
    bayOpening.rotation.x = Math.PI / 2;
    bayOpening.parent = this.anchorStation;

    // === RUNNING LIGHTS ===
    // Station navigation and warning lights
    const lightPositions = [
      { pos: new Vector3(20, 0, 0), mat: lightMat },
      { pos: new Vector3(-20, 0, 0), mat: lightMat },
      { pos: new Vector3(0, 0, 20), mat: lightMat },
      { pos: new Vector3(0, 0, -20), mat: lightMat },
      { pos: new Vector3(0, 8, 0), mat: warningLightMat },
      { pos: new Vector3(0, -8, 0), mat: warningLightMat },
      { pos: new Vector3(3, -12, 3), mat: warningLightMat },
      { pos: new Vector3(-3, -12, 3), mat: warningLightMat },
      { pos: new Vector3(3, -12, -3), mat: warningLightMat },
      { pos: new Vector3(-3, -12, -3), mat: warningLightMat },
    ];

    for (let i = 0; i < lightPositions.length; i++) {
      const light = MeshBuilder.CreateSphere(
        `stationLight_${i}`,
        { diameter: 0.5, segments: 8 },
        this.scene
      );
      light.material = lightPositions[i].mat;
      light.position = lightPositions[i].pos;
      light.parent = this.anchorStation;
      this.stationLights.push(light);
    }

    // === DOCKING PORTS ===
    // Small docking ports around the ring
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const port = MeshBuilder.CreateCylinder(
        `dockingPort_${i}`,
        {
          height: 1.5,
          diameter: 2,
          tessellation: 8,
        },
        this.scene
      );
      port.material = hullMat;
      port.rotation.z = Math.PI / 2;
      port.rotation.y = angle;
      port.position.x = Math.cos(angle) * 22;
      port.position.z = Math.sin(angle) * 22;
      port.parent = this.anchorStation;
    }

    // === ANTENNA ARRAY ===
    // Communication array on top of hub
    const antenna = MeshBuilder.CreateCylinder(
      'antenna',
      {
        height: 6,
        diameter: 0.3,
        tessellation: 6,
      },
      this.scene
    );
    antenna.material = hullMat;
    antenna.position.y = 11;
    antenna.parent = this.anchorStation;

    const dish = MeshBuilder.CreateDisc(
      'dish',
      {
        radius: 2,
        tessellation: 12,
      },
      this.scene
    );
    dish.material = panelMat;
    dish.position.y = 13;
    dish.rotation.x = -Math.PI / 6;
    dish.parent = this.anchorStation;
  }

  /**
   * Updates the Anchor Station position and rotation during freefall.
   * The station slowly rotates and recedes into the distance as the player falls.
   */
  private updateAnchorStation(deltaTime: number): void {
    if (!this.anchorStation) return;

    // Station is only visible during freefall phases
    if (
      this.phase !== 'freefall_start' &&
      this.phase !== 'freefall_belt' &&
      this.phase !== 'freefall_clear'
    ) {
      this.anchorStation.setEnabled(false);
      return;
    }

    // Slowly rotate the station (creates sense of scale and realism)
    this.anchorStation.rotation.y += deltaTime * 0.1;

    // Station recedes as player falls - exponential distance increase
    // At altitude 1000, station is close; at altitude 650, station is far
    const altitudeFactor = Math.max(0, (this.altitude - 600) / 400); // 1.0 at 1000, 0 at 600
    const distance = this.stationInitialDistance + (1 - altitudeFactor) * 150;
    this.anchorStation.position.y = distance;

    // Scale down as it gets further (perspective effect)
    const scale = Math.max(0.3, altitudeFactor);
    this.anchorStation.scaling.setAll(scale);

    // Fade station lights based on distance
    const lightIntensity = Math.max(0.2, altitudeFactor);
    for (const light of this.stationLights) {
      if (light.material) {
        (light.material as StandardMaterial).alpha = lightIntensity;
      }
    }

    // Add slight drift to simulate relative motion
    this.anchorStation.position.x = -this.positionX * 0.02;
    this.anchorStation.position.z = -this.positionZ * 0.02;
  }

  private createFreefallView(): void {
    // Arms reaching down (skydiver pose)
    const armMat = new StandardMaterial('armMat', this.scene);
    armMat.diffuseColor = new Color3(0.15, 0.15, 0.18);

    this.leftArm = MeshBuilder.CreateCylinder(
      'leftArm',
      {
        height: 3,
        diameterTop: 0.25,
        diameterBottom: 0.3,
      },
      this.scene
    );
    this.leftArm.material = armMat;
    this.leftArm.position.set(-1.8, -2.5, 0);

    this.rightArm = MeshBuilder.CreateCylinder(
      'rightArm',
      {
        height: 3,
        diameterTop: 0.25,
        diameterBottom: 0.3,
      },
      this.scene
    );
    this.rightArm.material = armMat;
    this.rightArm.position.set(1.8, -2.5, 0);

    const gloveMat = new StandardMaterial('gloveMat', this.scene);
    gloveMat.diffuseColor = new Color3(0.3, 0.25, 0.2);

    this.leftGlove = MeshBuilder.CreateSphere('leftGlove', { diameter: 0.5 }, this.scene);
    this.leftGlove.material = gloveMat;
    this.leftGlove.position.set(-1.8, -4.2, 0.3);
    this.leftGlove.scaling.set(1, 0.6, 1.2);

    this.rightGlove = MeshBuilder.CreateSphere('rightGlove', { diameter: 0.5 }, this.scene);
    this.rightGlove.material = gloveMat;
    this.rightGlove.position.set(1.8, -4.2, 0.3);
    this.rightGlove.scaling.set(1, 0.6, 1.2);

    // Visor frame
    this.visorFrame = MeshBuilder.CreateTorus(
      'visor',
      {
        diameter: 10,
        thickness: 0.3,
      },
      this.scene
    );
    const visorMat = new StandardMaterial('visorMat', this.scene);
    visorMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
    visorMat.alpha = 0.6;
    this.visorFrame.material = visorMat;
    this.visorFrame.rotation.x = Math.PI / 2;
    this.visorFrame.position.y = -2;
  }

  private createPoweredDescentView(): void {
    // Hands gripping thruster handles (looking OUT)
    const handleMat = new StandardMaterial('handleMat', this.scene);
    handleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);

    // Left handle bar
    this.leftHandle = MeshBuilder.CreateCylinder(
      'leftHandle',
      {
        height: 0.8,
        diameter: 0.12,
      },
      this.scene
    );
    this.leftHandle.material = handleMat;
    this.leftHandle.position.set(-0.6, -0.3, 0.5);
    this.leftHandle.rotation.z = Math.PI / 2;

    // Right handle bar
    this.rightHandle = MeshBuilder.CreateCylinder(
      'rightHandle',
      {
        height: 0.8,
        diameter: 0.12,
      },
      this.scene
    );
    this.rightHandle.material = handleMat;
    this.rightHandle.position.set(0.6, -0.3, 0.5);
    this.rightHandle.rotation.z = Math.PI / 2;

    // Thruster glow (below view)
    this.thrusterGlow = MeshBuilder.CreateDisc(
      'thrusterGlow',
      {
        radius: 0.8,
      },
      this.scene
    );
    const thrusterMat = new StandardMaterial('thrusterMat', this.scene);
    thrusterMat.emissiveColor = new Color3(0.3, 0.5, 1);
    thrusterMat.alpha = 0;
    thrusterMat.disableLighting = true;
    this.thrusterGlow.material = thrusterMat;
    this.thrusterGlow.position.set(0, -1, 1);
    this.thrusterGlow.rotation.x = Math.PI / 2;
  }

  /**
   * Creates a procedural particle texture for effects
   */
  private createParticleTexture(): Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    const texture = new Texture(
      canvas.toDataURL(),
      this.scene,
      false,
      true,
      Texture.BILINEAR_SAMPLINGMODE
    );
    texture.name = 'landfallParticleTexture';
    return texture;
  }

  private createEntryEffects(): void {
    // Create shared particle texture
    this.particleTexture = this.createParticleTexture();

    // Plasma glow ring (mesh-based)
    this.plasmaGlow = MeshBuilder.CreateTorus(
      'plasma',
      {
        diameter: 12,
        thickness: 2,
      },
      this.scene
    );
    const plasmaMat = new StandardMaterial('plasmaMat', this.scene);
    plasmaMat.emissiveColor = new Color3(1, 0.5, 0.15);
    plasmaMat.alpha = 0;
    plasmaMat.disableLighting = true;
    this.plasmaGlow.material = plasmaMat;
    this.plasmaGlow.rotation.x = Math.PI / 2;
    this.plasmaGlow.position.y = -3;

    // Heat distortion effect (subtle warping mesh)
    this.heatDistortion = MeshBuilder.CreateSphere(
      'heatDistortion',
      { diameter: 8, segments: 16 },
      this.scene
    );
    const heatMat = new StandardMaterial('heatMat', this.scene);
    heatMat.emissiveColor = new Color3(1, 0.4, 0.1);
    heatMat.alpha = 0;
    heatMat.disableLighting = true;
    heatMat.backFaceCulling = false;
    this.heatDistortion.material = heatMat;
    this.heatDistortion.position.y = -4;

    // Re-entry particle system (fiery streaks around player)
    this.createReentryParticles();

    // Player smoke trail (visible behind during descent)
    this.createPlayerSmokeTrail();

    // Atmosphere streaks (speed lines rushing past)
    this.createAtmosphereStreaks();

    // Wind streak meshes (visual speed indicators)
    this.createWindStreaks();
  }

  /**
   * Creates the fiery re-entry particle effect that appears during atmospheric entry
   */
  private createReentryParticles(): void {
    if (!this.particleTexture) return;

    this.reentryParticles = new ParticleSystem('reentryParticles', 200, this.scene);
    this.reentryParticles.particleTexture = this.particleTexture;

    // Emit from a disc below the player (simulating heat shield)
    this.reentryParticles.emitter = new Vector3(0, -2, 0);
    this.reentryParticles.minEmitBox = new Vector3(-2, 0, -2);
    this.reentryParticles.maxEmitBox = new Vector3(2, 0, 2);

    // Particles stream upward (relative to falling player)
    this.reentryParticles.direction1 = new Vector3(-0.5, 3, -0.5);
    this.reentryParticles.direction2 = new Vector3(0.5, 5, 0.5);

    // Fiery colors
    this.reentryParticles.color1 = new Color4(1, 0.8, 0.3, 1);
    this.reentryParticles.color2 = new Color4(1, 0.5, 0.1, 1);
    this.reentryParticles.colorDead = new Color4(0.5, 0.1, 0.05, 0);

    this.reentryParticles.minSize = 0.3;
    this.reentryParticles.maxSize = 0.8;
    this.reentryParticles.minLifeTime = 0.2;
    this.reentryParticles.maxLifeTime = 0.5;

    this.reentryParticles.emitRate = 100;
    this.reentryParticles.minEmitPower = 8;
    this.reentryParticles.maxEmitPower = 15;

    this.reentryParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.reentryParticles.gravity = new Vector3(0, 0, 0);

    // Start stopped
    this.reentryParticles.stop();
  }

  /**
   * Creates the smoke trail behind the player during descent
   */
  private createPlayerSmokeTrail(): void {
    if (!this.particleTexture) return;

    this.playerSmokeTrail = new ParticleSystem('smokeTrail', 150, this.scene);
    this.playerSmokeTrail.particleTexture = this.particleTexture;

    // Emit from behind/above the player
    this.playerSmokeTrail.emitter = new Vector3(0, 2, 0);
    this.playerSmokeTrail.minEmitBox = new Vector3(-0.5, 0, -0.5);
    this.playerSmokeTrail.maxEmitBox = new Vector3(0.5, 0, 0.5);

    // Particles drift upward and outward
    this.playerSmokeTrail.direction1 = new Vector3(-1, 4, -1);
    this.playerSmokeTrail.direction2 = new Vector3(1, 8, 1);

    // Smoke colors (white to gray)
    this.playerSmokeTrail.color1 = new Color4(0.8, 0.8, 0.9, 0.6);
    this.playerSmokeTrail.color2 = new Color4(0.6, 0.6, 0.7, 0.4);
    this.playerSmokeTrail.colorDead = new Color4(0.3, 0.3, 0.35, 0);

    this.playerSmokeTrail.minSize = 0.4;
    this.playerSmokeTrail.maxSize = 1.2;
    this.playerSmokeTrail.minLifeTime = 0.8;
    this.playerSmokeTrail.maxLifeTime = 1.5;

    this.playerSmokeTrail.emitRate = 40;
    this.playerSmokeTrail.minEmitPower = 3;
    this.playerSmokeTrail.maxEmitPower = 6;

    this.playerSmokeTrail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.playerSmokeTrail.gravity = new Vector3(0, 0.5, 0);

    // Start immediately for freefall
    this.playerSmokeTrail.start();
  }

  /**
   * Creates atmosphere streaks (speed lines rushing past the player)
   */
  private createAtmosphereStreaks(): void {
    if (!this.particleTexture) return;

    this.atmosphereStreaks = new ParticleSystem('atmosphereStreaks', 100, this.scene);
    this.atmosphereStreaks.particleTexture = this.particleTexture;

    // Emit from a large area below and around the player
    this.atmosphereStreaks.emitter = new Vector3(0, -30, 0);
    this.atmosphereStreaks.minEmitBox = new Vector3(-30, 0, -30);
    this.atmosphereStreaks.maxEmitBox = new Vector3(30, 0, 30);

    // Streaks rush upward past the player
    this.atmosphereStreaks.direction1 = new Vector3(-0.2, 15, -0.2);
    this.atmosphereStreaks.direction2 = new Vector3(0.2, 25, 0.2);

    // White/blue streaks
    this.atmosphereStreaks.color1 = new Color4(0.8, 0.9, 1, 0.4);
    this.atmosphereStreaks.color2 = new Color4(0.7, 0.8, 0.95, 0.3);
    this.atmosphereStreaks.colorDead = new Color4(0.5, 0.6, 0.8, 0);

    this.atmosphereStreaks.minSize = 0.05;
    this.atmosphereStreaks.maxSize = 0.15;
    this.atmosphereStreaks.minLifeTime = 0.3;
    this.atmosphereStreaks.maxLifeTime = 0.6;

    this.atmosphereStreaks.emitRate = 60;
    this.atmosphereStreaks.minEmitPower = 30;
    this.atmosphereStreaks.maxEmitPower = 50;

    this.atmosphereStreaks.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.atmosphereStreaks.gravity = new Vector3(0, 0, 0);

    // Start for freefall
    this.atmosphereStreaks.start();
  }

  /**
   * Creates thruster exhaust particles for powered descent
   */
  private createThrusterExhaust(): void {
    if (!this.particleTexture) return;

    this.thrusterExhaustParticles = new ParticleSystem('thrusterExhaust', 300, this.scene);
    this.thrusterExhaustParticles.particleTexture = this.particleTexture;

    // Emit from below the player
    this.thrusterExhaustParticles.emitter = new Vector3(0, -1, 0.5);
    this.thrusterExhaustParticles.minEmitBox = new Vector3(-0.3, 0, -0.3);
    this.thrusterExhaustParticles.maxEmitBox = new Vector3(0.3, 0, 0.3);

    // Exhaust shoots downward
    this.thrusterExhaustParticles.direction1 = new Vector3(-0.3, -3, -0.5);
    this.thrusterExhaustParticles.direction2 = new Vector3(0.3, -1, 0.5);

    // Blue-white thruster colors
    this.thrusterExhaustParticles.color1 = new Color4(0.5, 0.7, 1, 1);
    this.thrusterExhaustParticles.color2 = new Color4(0.3, 0.5, 1, 0.8);
    this.thrusterExhaustParticles.colorDead = new Color4(0.2, 0.3, 0.8, 0);

    this.thrusterExhaustParticles.minSize = 0.2;
    this.thrusterExhaustParticles.maxSize = 0.5;
    this.thrusterExhaustParticles.minLifeTime = 0.1;
    this.thrusterExhaustParticles.maxLifeTime = 0.3;

    this.thrusterExhaustParticles.emitRate = 0; // Controlled manually
    this.thrusterExhaustParticles.minEmitPower = 10;
    this.thrusterExhaustParticles.maxEmitPower = 20;

    this.thrusterExhaustParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.thrusterExhaustParticles.gravity = new Vector3(0, -5, 0);

    this.thrusterExhaustParticles.start();
  }

  /**
   * Creates wind streak meshes for visual speed indication
   */
  private createWindStreaks(): void {
    const streakMat = new StandardMaterial('windStreakMat', this.scene);
    streakMat.emissiveColor = new Color3(0.7, 0.8, 1);
    streakMat.alpha = 0;
    streakMat.disableLighting = true;

    for (let i = 0; i < 20; i++) {
      const streak = MeshBuilder.CreateCylinder(
        `windStreak_${i}`,
        {
          height: 8 + Math.random() * 6,
          diameterTop: 0.02,
          diameterBottom: 0.02,
          tessellation: 4,
        },
        this.scene
      );
      streak.material = streakMat.clone(`windStreakMat_${i}`);
      streak.rotation.x = Math.PI / 2; // Point forward/backward
      streak.isVisible = false;

      // Random position around player
      streak.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20 - 10,
        (Math.random() - 0.5) * 30
      );

      this.windStreaks.push(streak);
    }
  }

  private createLandingZone(): void {
    // LZ pad - cement circle
    this.lzPad = MeshBuilder.CreateCylinder(
      'lzPad',
      {
        height: 0.3,
        diameter: this.lzRadius * 2,
      },
      this.scene
    );
    const padMat = new StandardMaterial('padMat', this.scene);
    padMat.diffuseColor = new Color3(0.5, 0.5, 0.5);
    this.lzPad.material = padMat;
    this.lzPad.position.y = 0.15;
    this.lzPad.isVisible = false;

    // Beacon
    this.lzBeacon = MeshBuilder.CreateCylinder(
      'beacon',
      {
        height: 20,
        diameter: 2,
      },
      this.scene
    );
    const beaconMat = new StandardMaterial('beaconMat', this.scene);
    beaconMat.emissiveColor = new Color3(0.2, 1, 0.3);
    beaconMat.alpha = 0.3;
    this.lzBeacon.material = beaconMat;
    this.lzBeacon.position.y = 10;
    this.lzBeacon.isVisible = false;
  }

  private createSurface(): void {
    this.terrain = MeshBuilder.CreateGround(
      'terrain',
      {
        width: 600,
        height: 600,
        subdivisions: 64,
      },
      this.scene
    );
    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.diffuseColor = Color3.FromHexString('#8B5A2B');
    this.terrain.material = terrainMat;
    this.terrain.isVisible = false;

    // Canyon walls
    for (let i = 0; i < 4; i++) {
      const wall = MeshBuilder.CreateBox(
        `wall_${i}`,
        {
          width: 25,
          height: 100,
          depth: 180,
        },
        this.scene
      );
      const wallMat = new StandardMaterial(`wallMat_${i}`, this.scene);
      wallMat.diffuseColor = Color3.FromHexString('#6B4423');
      wall.material = wallMat;
      wall.position.set((i % 2 === 0 ? -1 : 1) * (60 + i * 10), 50, -50 - i * 30);
      wall.isVisible = false;
      this.canyonWalls.push(wall);
    }

    // Create combat arena cover objects
    this.createCombatArenaCover();

    // Create environment hazards
    this.createEnvironmentHazards();

    // Create FOB Delta objective marker
    this.createFOBDeltaMarker();

    this.skyDome = MeshBuilder.CreateSphere(
      'sky',
      {
        diameter: 5000,
        segments: 16,
        sideOrientation: 1,
      },
      this.scene
    );
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.75, 0.5, 0.35);
    skyMat.disableLighting = true;
    this.skyDome.material = skyMat;
    this.skyDome.isVisible = false;
  }

  /**
   * Cover objects for the combat arena
   */
  private coverObjects: Mesh[] = [];

  /**
   * Creates cover objects for the first combat encounter arena.
   * Includes crashed debris and rock formations that players can use for cover.
   */
  private createCombatArenaCover(): void {
    const rockMat = new StandardMaterial('rockMat', this.scene);
    rockMat.diffuseColor = Color3.FromHexString('#5A4A3A');
    rockMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const debrisMat = new StandardMaterial('debrisMat', this.scene);
    debrisMat.diffuseColor = Color3.FromHexString('#3A3A3A');
    debrisMat.specularColor = new Color3(0.15, 0.15, 0.18);

    const burnedMat = new StandardMaterial('burnedMat', this.scene);
    burnedMat.diffuseColor = Color3.FromHexString('#1A1A1A');
    burnedMat.emissiveColor = new Color3(0.05, 0.02, 0);

    // Rock formations - provide natural cover
    const rockPositions = [
      { pos: new Vector3(15, 1.5, 20), scale: new Vector3(3, 3, 4), rotation: 0.3 },
      { pos: new Vector3(-18, 1.2, 15), scale: new Vector3(2.5, 2.5, 3), rotation: -0.5 },
      { pos: new Vector3(8, 1, 35), scale: new Vector3(2, 2, 2.5), rotation: 0.8 },
      { pos: new Vector3(-10, 0.8, 30), scale: new Vector3(1.8, 1.5, 2), rotation: 1.2 },
    ];

    for (let i = 0; i < rockPositions.length; i++) {
      const rock = MeshBuilder.CreatePolyhedron(
        `rock_${i}`,
        { type: 1, size: 1 }, // Octahedron base
        this.scene
      );
      rock.material = rockMat;
      rock.position = rockPositions[i].pos;
      rock.scaling = rockPositions[i].scale;
      rock.rotation.y = rockPositions[i].rotation;
      rock.rotation.x = Math.random() * 0.2;
      rock.isVisible = false;
      this.coverObjects.push(rock);
    }

    // Crashed debris - metallic wreckage from previous battles
    // Main crashed dropship hull
    const hull = MeshBuilder.CreateCylinder(
      'crashedHull',
      { height: 8, diameter: 3, tessellation: 8 },
      this.scene
    );
    hull.material = debrisMat;
    hull.position.set(0, 1.5, 25);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = 0.4;
    hull.isVisible = false;
    this.coverObjects.push(hull);

    // Wing debris
    const wing = MeshBuilder.CreateBox(
      'crashedWing',
      { width: 6, height: 0.3, depth: 3 },
      this.scene
    );
    wing.material = debrisMat;
    wing.position.set(5, 0.5, 28);
    wing.rotation.y = -0.3;
    wing.rotation.z = 0.15;
    wing.isVisible = false;
    this.coverObjects.push(wing);

    // Burned impact crater area (decorative)
    const crater = MeshBuilder.CreateDisc(
      'impactCrater',
      { radius: 4, tessellation: 16 },
      this.scene
    );
    crater.material = burnedMat;
    crater.position.set(2, 0.05, 26);
    crater.rotation.x = Math.PI / 2;
    crater.isVisible = false;
    this.coverObjects.push(crater);

    // Scattered metal plates
    for (let i = 0; i < 3; i++) {
      const plate = MeshBuilder.CreateBox(
        `metalPlate_${i}`,
        { width: 1.5 + Math.random(), height: 0.15, depth: 2 + Math.random() },
        this.scene
      );
      plate.material = debrisMat;
      plate.position.set(
        -5 + Math.random() * 10,
        0.1 + Math.random() * 0.3,
        20 + Math.random() * 15
      );
      plate.rotation.y = Math.random() * Math.PI;
      plate.rotation.z = (Math.random() - 0.5) * 0.3;
      plate.isVisible = false;
      this.coverObjects.push(plate);
    }
  }

  /**
   * Creates environment hazards for the combat arena:
   * - Acid pools: Damage over time, glowing green, bubbling effect
   * - Unstable terrain: Periodic tremors, visual cracks, movement penalty
   */
  private createEnvironmentHazards(): void {
    // ========================================
    // ACID POOLS - Corrosive hazard zones
    // ========================================
    const acidMat = new StandardMaterial('acidMat', this.scene);
    acidMat.diffuseColor = Color3.FromHexString('#2A5A2A');
    acidMat.emissiveColor = new Color3(0.2, 0.5, 0.15);
    acidMat.specularColor = new Color3(0.4, 0.6, 0.4);
    acidMat.specularPower = 64;
    acidMat.alpha = 0.85;

    // Acid pool positions - scattered around the combat area
    const acidPositions = [
      { pos: new Vector3(25, 0.02, 18), radius: 3.5 },
      { pos: new Vector3(-22, 0.02, 28), radius: 2.8 },
      { pos: new Vector3(12, 0.02, 40), radius: 2.2 },
      { pos: new Vector3(-8, 0.02, 12), radius: 1.8 },
    ];

    for (let i = 0; i < acidPositions.length; i++) {
      const acidDef = acidPositions[i];

      // Main pool surface
      const pool = MeshBuilder.CreateDisc(
        `acidPool_${i}`,
        { radius: acidDef.radius, tessellation: 24 },
        this.scene
      );
      pool.material = acidMat.clone(`acidMat_${i}`);
      pool.position = acidDef.pos.clone();
      pool.rotation.x = Math.PI / 2;
      pool.isVisible = false;
      this.acidPools.push(pool);

      // Acid pool border - darker ring
      const borderMat = new StandardMaterial('acidBorderMat', this.scene);
      borderMat.diffuseColor = Color3.FromHexString('#1A3A1A');
      borderMat.emissiveColor = new Color3(0.1, 0.2, 0.05);

      const border = MeshBuilder.CreateTorus(
        `acidBorder_${i}`,
        { diameter: acidDef.radius * 2, thickness: 0.3, tessellation: 24 },
        this.scene
      );
      border.material = borderMat;
      border.position = acidDef.pos.clone();
      border.position.y = 0.05;
      border.rotation.x = Math.PI / 2;
      border.isVisible = false;
      this.acidPools.push(border);
    }

    // ========================================
    // UNSTABLE TERRAIN - Cracked ground zones
    // ========================================
    const unstableMat = new StandardMaterial('unstableMat', this.scene);
    unstableMat.diffuseColor = Color3.FromHexString('#5A4030');
    unstableMat.emissiveColor = new Color3(0.15, 0.08, 0.02);
    unstableMat.specularColor = new Color3(0.1, 0.1, 0.1);

    // Crack pattern material
    const crackMat = new StandardMaterial('crackMat', this.scene);
    crackMat.diffuseColor = Color3.FromHexString('#2A1A10');
    crackMat.emissiveColor = new Color3(0.3, 0.15, 0.05);

    // Unstable terrain positions
    const unstablePositions = [
      { pos: new Vector3(5, 0.01, 35), size: 6 },
      { pos: new Vector3(-15, 0.01, 22), size: 5 },
      { pos: new Vector3(18, 0.01, 30), size: 4 },
    ];

    for (let i = 0; i < unstablePositions.length; i++) {
      const unstableDef = unstablePositions[i];

      // Main unstable zone
      const zone = MeshBuilder.CreateDisc(
        `unstableZone_${i}`,
        { radius: unstableDef.size, tessellation: 16 },
        this.scene
      );
      zone.material = unstableMat.clone(`unstableMat_${i}`);
      zone.position = unstableDef.pos.clone();
      zone.rotation.x = Math.PI / 2;
      zone.isVisible = false;
      this.unstableTerrain.push(zone);

      // Add crack lines across the zone
      for (let j = 0; j < 4; j++) {
        const crackAngle = (j / 4) * Math.PI * 2 + Math.random() * 0.5;
        const crackLength = unstableDef.size * 0.8 + Math.random() * unstableDef.size * 0.4;

        const crack = MeshBuilder.CreateBox(
          `crack_${i}_${j}`,
          { width: 0.1 + Math.random() * 0.1, height: 0.02, depth: crackLength },
          this.scene
        );
        crack.material = crackMat;
        crack.position = unstableDef.pos.clone();
        crack.position.y = 0.03;
        crack.rotation.y = crackAngle;
        crack.isVisible = false;
        this.unstableTerrain.push(crack);
      }
    }
  }

  /**
   * Creates the FOB Delta objective marker and beacon.
   * Visible after combat is cleared to guide player to next objective.
   */
  private createFOBDeltaMarker(): void {
    // FOB Delta marker - tall beacon visible from distance
    const markerMat = new StandardMaterial('fobMarkerMat', this.scene);
    markerMat.emissiveColor = new Color3(0.2, 0.6, 1.0);
    markerMat.alpha = 0.6;
    markerMat.disableLighting = true;

    // Vertical beacon column
    this.fobDeltaBeacon = MeshBuilder.CreateCylinder(
      'fobDeltaBeacon',
      { height: 50, diameter: 3, tessellation: 8 },
      this.scene
    );
    this.fobDeltaBeacon.material = markerMat;
    this.fobDeltaBeacon.position = this.fobDeltaPosition.clone();
    this.fobDeltaBeacon.position.y = 25;
    this.fobDeltaBeacon.isVisible = false;

    // Ground marker
    const groundMarkerMat = new StandardMaterial('fobGroundMat', this.scene);
    groundMarkerMat.diffuseColor = Color3.FromHexString('#4080C0');
    groundMarkerMat.emissiveColor = new Color3(0.1, 0.3, 0.5);

    this.fobDeltaMarker = MeshBuilder.CreateTorus(
      'fobDeltaMarker',
      { diameter: 8, thickness: 0.5, tessellation: 24 },
      this.scene
    );
    this.fobDeltaMarker.material = groundMarkerMat;
    this.fobDeltaMarker.position = this.fobDeltaPosition.clone();
    this.fobDeltaMarker.position.y = 0.2;
    this.fobDeltaMarker.rotation.x = Math.PI / 2;
    this.fobDeltaMarker.isVisible = false;
  }

  /**
   * Preload alien vehicle models for distant threats during descent.
   * Wraith hover tanks and Phantom dropships appear as distant silhouettes.
   */
  private async preloadDistantThreats(): Promise<void> {
    try {
      // Load both vehicle models
      await Promise.all([
        AssetManager.loadAsset('vehicles', 'wraith', this.scene),
        AssetManager.loadAsset('vehicles', 'phantom', this.scene),
      ]);
      console.log('[Landfall] Preloaded alien vehicle models for distant threats');
    } catch (error) {
      console.warn('[Landfall] Could not preload vehicle models:', error);
    }
  }

  /**
   * Spawn distant alien vehicles during the HALO jump.
   * These are visual threats that add tension without direct gameplay impact.
   */
  private spawnDistantThreats(): void {
    if (this.threatsSpawned) return;
    this.threatsSpawned = true;

    // Define distant threat patterns - alien vehicles patrolling during descent
    const threatDefinitions = [
      {
        type: 'wraith' as const,
        position: new Vector3(-80, -40, -60), // Far left
        velocity: new Vector3(8, 0, 3),
        rotationSpeed: 0.2,
        scale: 10,
      },
      {
        type: 'phantom' as const,
        position: new Vector3(100, -30, -80), // Far right
        velocity: new Vector3(-5, 1, 4),
        rotationSpeed: 0.15,
        scale: 12,
      },
      {
        type: 'wraith' as const,
        position: new Vector3(50, -60, 70), // Behind
        velocity: new Vector3(-3, 0.5, -2),
        rotationSpeed: 0.25,
        scale: 8,
      },
    ];

    for (let i = 0; i < threatDefinitions.length; i++) {
      const def = threatDefinitions[i];

      try {
        const instance = AssetManager.createInstance(
          'vehicles',
          def.type,
          `distant_${def.type}_${i}`,
          this.scene
        );

        if (instance) {
          instance.position = def.position.clone();
          instance.scaling.setAll(def.scale);
          // Start hidden, will fade in
          instance.setEnabled(true);

          this.distantThreats.push({
            node: instance,
            position: def.position.clone(),
            velocity: def.velocity,
            rotationSpeed: def.rotationSpeed,
            type: def.type,
            spawnAltitude: 900,
          });
        }
      } catch (error) {
        // Create fallback simple mesh if GLB loading fails
        const fallback = MeshBuilder.CreateBox(
          `threat_fallback_${i}`,
          { width: 3, height: 1, depth: 5 },
          this.scene
        );
        const mat = new StandardMaterial(`threatMat_${i}`, this.scene);
        mat.diffuseColor = new Color3(0.2, 0.15, 0.25);
        mat.alpha = 0.6;
        fallback.material = mat;
        fallback.position = def.position.clone();

        // Wrap in TransformNode for consistent interface
        const wrapper = new TransformNode(`threat_wrapper_${i}`, this.scene);
        fallback.parent = wrapper;

        this.distantThreats.push({
          node: wrapper,
          position: def.position.clone(),
          velocity: def.velocity,
          rotationSpeed: def.rotationSpeed,
          type: def.type,
          spawnAltitude: 900,
        });
      }
    }

    // Comms message about detecting enemy air traffic
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Warning: Enemy air traffic detected. Wraith patrols in the area. Maintain stealth profile.',
      });
    }, 500);
  }

  /**
   * Update distant threat positions and animations
   */
  private updateDistantThreats(deltaTime: number): void {
    for (const threat of this.distantThreats) {
      // Move the threat
      threat.position.addInPlace(threat.velocity.scale(deltaTime));
      threat.node.position = threat.position;

      // Rotate slowly (banking motion)
      threat.node.rotation.y += threat.rotationSpeed * deltaTime;

      // Slight bobbing for Phantom dropships
      if (threat.type === 'phantom') {
        threat.node.position.y += Math.sin(performance.now() * 0.001) * 0.02;
      }
    }
  }

  /**
   * Updates all visual effects based on current altitude and phase.
   * Manages particle systems, atmospheric effects, and visual polish.
   */
  private updateVisualEffects(deltaTime: number): void {
    // Calculate effect intensities based on altitude
    const altitudeFactor = Math.max(0, Math.min(1, (1000 - this.altitude) / 600)); // 0 at 1000, 1 at 400
    const atmosphereEntry = Math.max(0, Math.min(1, (700 - this.altitude) / 300)); // Starts at 700
    const time = performance.now() * 0.001;

    // ========================================
    // FREEFALL EFFECTS
    // ========================================
    if (
      this.phase === 'freefall_start' ||
      this.phase === 'freefall_belt' ||
      this.phase === 'freefall_clear'
    ) {
      // Smoke trail - always active during freefall, intensity increases with speed
      if (this.playerSmokeTrail) {
        const smokeIntensity = Math.min(1, this.velocity / 60);
        this.playerSmokeTrail.emitRate = 30 + smokeIntensity * 40;
        this.playerSmokeTrail.minSize = 0.3 + smokeIntensity * 0.3;
        this.playerSmokeTrail.maxSize = 0.8 + smokeIntensity * 0.6;
      }

      // Atmosphere streaks - intensity increases as we enter atmosphere
      if (this.atmosphereStreaks) {
        this.atmosphereStreaks.emitRate = 30 + altitudeFactor * 80;
        this.atmosphereStreaks.minEmitPower = 25 + altitudeFactor * 30;
        this.atmosphereStreaks.maxEmitPower = 40 + altitudeFactor * 40;
      }

      // Re-entry heating effects - start appearing at lower altitudes
      if (atmosphereEntry > 0) {
        // Start re-entry particles
        if (this.reentryParticles && !this.reentryParticles.isStarted()) {
          this.reentryParticles.start();
        }
        if (this.reentryParticles) {
          this.reentryParticles.emitRate = atmosphereEntry * 150;
          this.reentryParticles.minSize = 0.2 + atmosphereEntry * 0.3;
          this.reentryParticles.maxSize = 0.5 + atmosphereEntry * 0.5;
        }

        // Plasma glow mesh
        if (this.plasmaGlow?.material) {
          const plasmaMat = this.plasmaGlow.material as StandardMaterial;
          plasmaMat.alpha = atmosphereEntry * 0.4;
          plasmaMat.emissiveColor = new Color3(1, 0.5 - atmosphereEntry * 0.2, 0.15);
          // Pulsing effect
          const pulse = 0.9 + Math.sin(time * 8) * 0.1;
          this.plasmaGlow.scaling.setAll(1 + atmosphereEntry * 0.3 * pulse);
        }

        // Heat distortion
        if (this.heatDistortion?.material) {
          const heatMat = this.heatDistortion.material as StandardMaterial;
          heatMat.alpha = atmosphereEntry * 0.15;
          // Wobble effect
          this.heatDistortion.scaling.set(
            1 + Math.sin(time * 12) * 0.05,
            1 + Math.cos(time * 10) * 0.05,
            1 + Math.sin(time * 14) * 0.05
          );
        }

        // Camera shake increases during atmospheric entry
        if (atmosphereEntry > 0.3) {
          this.setBaseShake(atmosphereEntry * 1.5);
        }
      } else {
        // Above atmosphere - minimal effects
        if (this.reentryParticles?.isStarted()) {
          this.reentryParticles.emitRate = 0;
        }
        if (this.plasmaGlow?.material) {
          (this.plasmaGlow.material as StandardMaterial).alpha = 0;
        }
        if (this.heatDistortion?.material) {
          (this.heatDistortion.material as StandardMaterial).alpha = 0;
        }
      }

      // Wind streaks - visual speed indicators
      this.updateWindStreaks(deltaTime, altitudeFactor);

      // Decay wind intensity
      this.windIntensity = Math.max(0, this.windIntensity - deltaTime * 0.5);
    }

    // ========================================
    // POWERED DESCENT EFFECTS
    // ========================================
    if (this.phase === 'powered_descent' || this.phase === 'landing') {
      // Stop freefall-specific effects
      if (this.playerSmokeTrail?.isStarted()) {
        this.playerSmokeTrail.emitRate = 10; // Reduced but not stopped
      }
      if (this.atmosphereStreaks?.isStarted()) {
        this.atmosphereStreaks.emitRate = 20; // Reduced
      }
      if (this.reentryParticles?.isStarted()) {
        this.reentryParticles.stop();
      }

      // Fade plasma glow
      if (this.plasmaGlow?.material) {
        const plasmaMat = this.plasmaGlow.material as StandardMaterial;
        plasmaMat.alpha = Math.max(0, plasmaMat.alpha - deltaTime * 0.5);
      }

      // Thruster exhaust - intensity based on whether player is boosting
      if (this.thrusterExhaustParticles) {
        const boosting = this.inputTracker.isActionActive('fire');
        if (boosting && this.fuel > 0) {
          this.thrusterExhaustParticles.emitRate = 200;
          this.thrusterExhaustParticles.minEmitPower = 15;
          this.thrusterExhaustParticles.maxEmitPower = 25;
        } else {
          // Idle thruster
          this.thrusterExhaustParticles.emitRate = 30;
          this.thrusterExhaustParticles.minEmitPower = 5;
          this.thrusterExhaustParticles.maxEmitPower = 10;
        }
      }

      // Hide wind streaks during powered descent
      for (const streak of this.windStreaks) {
        streak.isVisible = false;
      }
    }

    // ========================================
    // SURFACE - STOP ALL DESCENT EFFECTS
    // ========================================
    if (this.phase === 'surface') {
      this.stopAllDescentEffects();
    }
  }

  /**
   * Updates wind streak positions and visibility for speed effect.
   * Creates dramatic speed lines that rush past the player during descent.
   * Intensity increases during atmospheric entry and after near-misses.
   */
  private updateWindStreaks(deltaTime: number, intensity: number): void {
    // Combine base intensity with dynamic wind intensity (from near-misses)
    const combinedIntensity = Math.min(1, intensity + this.windIntensity);
    const showStreaks = combinedIntensity > 0.15;

    // Calculate speed-based scaling for more dramatic effect at high velocity
    const velocityScale = Math.min(2, this.velocity / 40);

    for (let i = 0; i < this.windStreaks.length; i++) {
      const streak = this.windStreaks[i];
      streak.isVisible = showStreaks;

      if (showStreaks) {
        // Move streaks upward (past the falling player)
        // Speed increases with velocity for more dramatic feel
        const streakSpeed = (25 + this.velocity * 0.8) * velocityScale;
        streak.position.y += streakSpeed * deltaTime;

        // Lateral drift based on player movement (parallax effect)
        streak.position.x -= this.lateralVelocityX * deltaTime * 0.3;
        streak.position.z -= this.lateralVelocityZ * deltaTime * 0.3;

        // Reset position when too far above
        if (streak.position.y > 35) {
          streak.position.y = -45 - Math.random() * 25;
          streak.position.x = (Math.random() - 0.5) * 45;
          streak.position.z = (Math.random() - 0.5) * 45;
        }

        // Update alpha and scale based on intensity
        if (streak.material) {
          const mat = streak.material as StandardMaterial;
          // More opaque during high intensity (near-misses, deep atmosphere)
          mat.alpha = combinedIntensity * 0.4 * velocityScale;
          // Color shift from white to orange during atmospheric entry
          const heatFactor = Math.max(0, (700 - this.altitude) / 300);
          mat.emissiveColor = new Color3(
            0.7 + heatFactor * 0.3,
            0.8 - heatFactor * 0.2,
            1 - heatFactor * 0.5
          );
        }

        // Scale streak length based on velocity (longer at high speed)
        streak.scaling.y = 1 + velocityScale * 0.5;
      }
    }
  }

  /**
   * Stops all descent-related particle effects (called on landing)
   */
  private stopAllDescentEffects(): void {
    if (this.playerSmokeTrail) {
      this.playerSmokeTrail.stop();
    }
    if (this.atmosphereStreaks) {
      this.atmosphereStreaks.stop();
    }
    if (this.reentryParticles) {
      this.reentryParticles.stop();
    }
    if (this.thrusterExhaustParticles) {
      this.thrusterExhaustParticles.stop();
    }

    // Hide all visual effect meshes
    if (this.plasmaGlow) this.plasmaGlow.isVisible = false;
    if (this.heatDistortion) this.heatDistortion.isVisible = false;
    for (const streak of this.windStreaks) {
      streak.isVisible = false;
    }
  }

  private setFreefallVisible(visible: boolean): void {
    if (this.leftArm) this.leftArm.isVisible = visible;
    if (this.rightArm) this.rightArm.isVisible = visible;
    if (this.leftGlove) this.leftGlove.isVisible = visible;
    if (this.rightGlove) this.rightGlove.isVisible = visible;
    if (this.visorFrame) this.visorFrame.isVisible = visible;
  }

  private setPoweredDescentVisible(visible: boolean): void {
    if (this.leftHandle) this.leftHandle.isVisible = visible;
    if (this.rightHandle) this.rightHandle.isVisible = visible;
    if (this.thrusterGlow) this.thrusterGlow.isVisible = visible;
  }

  private startJump(): void {
    this.phase = 'freefall_start';
    this.altitude = 1000;
    this.velocity = 10;
    this.phaseTime = 0;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onNotification('HALO JUMP INITIATED', 3000);

    // Setup action handler
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Clear of station. Debris belt ahead. Spread and stabilize.',
      });
    }, 1500);

    setTimeout(() => {
      this.transitionToPhase('freefall_belt');
    }, 4000);
  }

  private handleAction(actionId: string): void {
    switch (actionId) {
      case 'ignite_jets':
        if (this.phase === 'freefall_clear' && this.altitude < 600) {
          this.transitionToPhase('powered_descent');
        } else {
          this.callbacks.onNotification('TOO HIGH FOR IGNITION', 1500);
        }
        break;

      case 'boost':
        if (this.phase === 'powered_descent' && this.fuel > 0) {
          this.velocity = Math.max(5, this.velocity - 30 * 0.016);
          this.fuel -= this.fuelBurnRate * 0.016;
          this.showThrusterGlow(0.8);
        }
        break;

      case 'brake':
        if (this.phase === 'powered_descent' && this.fuel > 0) {
          this.velocity = Math.min(80, this.velocity + 10 * 0.016);
          this.fuel -= this.fuelBurnRate * 0.5 * 0.016;
        }
        break;

      case 'stabilize':
        if (this.phase === 'powered_descent' && this.fuel > 5) {
          this.lateralVelocityX *= 0.8;
          this.lateralVelocityZ *= 0.8;
          this.fuel -= 5;
          this.callbacks.onNotification('STABILIZING', 500);
        }
        break;

      // Surface combat actions
      case 'grenade':
        if (this.phase === 'surface' && this.surfaceCombatActive) {
          this.throwGrenade();
        }
        break;

      case 'melee':
        if (this.phase === 'surface' && this.surfaceCombatActive) {
          this.performMeleeAttack();
        }
        break;
    }
  }

  /**
   * Throw a grenade - area of effect damage
   */
  private throwGrenade(): void {
    this.callbacks.onNotification('GRENADE OUT!', 1000);

    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());

    // Grenade lands ~10m in front of player
    const grenadePos = playerPos.add(forward.scale(10));
    grenadePos.y = 0;

    // Simulate grenade explosion after delay
    setTimeout(() => {
      // Visual effect - explosion
      particleManager.emitSmallExplosion(grenadePos);

      // Screen shake
      this.triggerShake(3);

      // Damage enemies in blast radius
      const blastRadius = 5;
      const grenadeDamage = 60;

      for (const enemy of this.surfaceEnemies) {
        if (enemy.health <= 0) continue;

        const dist = Vector3.Distance(grenadePos, enemy.mesh.position);
        if (dist < blastRadius) {
          // Damage falls off with distance
          const damageFalloff = 1 - dist / blastRadius;
          const damage = grenadeDamage * damageFalloff;
          enemy.health -= damage;

          // Visual feedback
          this.flashEnemyRed(enemy.mesh);
          particleManager.emitAlienSplatter(enemy.mesh.position, 0.6);

          // Check for kill
          if (enemy.health <= 0) {
            const index = this.surfaceEnemies.indexOf(enemy);
            this.onEnemyKilled(enemy, index);
          }
        }
      }
    }, 1500); // 1.5 second fuse
  }

  private showThrusterGlow(intensity: number): void {
    if (this.thrusterGlow?.material) {
      (this.thrusterGlow.material as StandardMaterial).alpha = intensity;
    }
  }

  private transitionToPhase(newPhase: DropPhase): void {
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'freefall_belt':
        this.callbacks.onNotification('⚠️ ENTERING DEBRIS FIELD', 2000);
        this.callbacks.onObjectiveUpdate(
          'NAVIGATE DEBRIS',
          'WASD: Body position | Dodge asteroids'
        );
        this.asteroidSpawnRate = 0.35;
        this.setBaseShake(0.3);
        break;

      case 'freefall_clear':
        this.callbacks.onNotification('DEBRIS FIELD CLEARED', 2000);
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Debris cleared. Ignite retros when ready. LZ beacon locked.',
        });
        // Show ignite jets button
        this.updateActionButtons('ignite');
        break;

      case 'powered_descent':
        this.callbacks.onNotification('JETS IGNITED', 2000);
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Retros online. Target the LZ pad. Watch your fuel.',
        });
        // Switch camera perspective and narrow FOV slightly
        this.targetFOV = this.POWERED_DESCENT_FOV;
        this.switchToPoweredDescent();
        // Show descent controls
        this.updateActionButtons('descent');
        break;

      case 'landing':
        this.callbacks.onNotification('⚠️ FINAL APPROACH', 2000);
        this.setBaseShake(2);
        break;

      case 'surface':
        this.completeLanding();
        // Set up environmental audio for surface (wind, desolate atmosphere)
        this.setupSurfaceEnvironmentalAudio();
        break;
    }
  }

  /**
   * Set up spatial sound sources for immersive surface atmosphere.
   * Desolate wind, distant thunder, and alien wildlife sounds.
   */
  private setupSurfaceEnvironmentalAudio(): void {
    // Wind howling through canyon walls
    this.addSpatialSound(
      'wind_canyon1',
      'wind_howl',
      { x: 50, y: 10, z: 0 },
      {
        maxDistance: 40,
        volume: 0.5,
      }
    );
    this.addSpatialSound(
      'wind_canyon2',
      'wind_howl',
      { x: -50, y: 10, z: 0 },
      {
        maxDistance: 40,
        volume: 0.4,
      }
    );
    this.addSpatialSound(
      'wind_lz',
      'wind_howl',
      { x: 0, y: 5, z: 30 },
      {
        maxDistance: 30,
        volume: 0.35,
      }
    );

    // Define audio zone for surface exploration
    this.addAudioZone('zone_surface', 'surface', { x: 0, y: 0, z: 0 }, 150, {
      isIndoor: false,
      intensity: 0.6,
    });
  }

  private updateActionButtons(mode: 'ignite' | 'descent' | 'combat' | 'none'): void {
    let groups: ActionButtonGroup[] = [];

    // Get keybindings for level-specific actions
    const jets = levelActionParams('igniteJets');
    const boost = levelActionParams('boost');
    const stabilize = levelActionParams('stabilize');
    const brake = levelActionParams('brake');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');

    switch (mode) {
      case 'ignite':
        groups = [
          {
            id: 'ignite',
            label: 'RETROS',
            position: 'right',
            buttons: [
              createAction('ignite_jets', 'IGNITE JETS', jets.key, {
                keyDisplay: jets.keyDisplay,
                variant: 'danger',
                size: 'large',
                highlighted: true,
                icon: '🔥',
              }),
            ],
          },
        ];
        break;

      case 'descent':
        groups = [
          {
            id: 'descent',
            label: 'THRUSTERS',
            position: 'right',
            buttons: [
              createAction('boost', 'BOOST', boost.key, {
                keyDisplay: boost.keyDisplay,
                variant: 'primary',
                size: 'large',
                icon: '⬆️',
              }),
              createAction('stabilize', 'STABILIZE', stabilize.key, {
                keyDisplay: stabilize.keyDisplay,
                variant: 'secondary',
                icon: '⚖️',
              }),
              createAction('brake', 'BRAKE', brake.key, {
                keyDisplay: brake.keyDisplay,
                variant: 'warning',
                icon: '⬇️',
              }),
            ],
          },
        ];
        break;

      case 'combat':
        groups = [
          {
            id: 'combat',
            label: 'COMBAT',
            position: 'right',
            buttons: [
              createAction('grenade', 'GRENADE', grenade.key, {
                keyDisplay: grenade.keyDisplay,
                variant: 'danger',
                cooldown: 5000,
                icon: '💥',
              }),
              createAction('melee', 'MELEE', melee.key, {
                keyDisplay: melee.keyDisplay,
                variant: 'primary',
                icon: '🔪',
              }),
            ],
          },
        ];
        break;
    }

    // Send action button configuration to the HUD
    this.callbacks.onActionGroupsChange(groups);
  }

  private switchToPoweredDescent(): void {
    // Hide freefall view
    this.setFreefallVisible(false);

    // Show powered descent view
    this.setPoweredDescentVisible(true);

    // Smooth camera rotation transition over ~1 second
    // Store the starting rotation
    const startRotX = this.camera.rotation.x;
    const targetRotX = 0.3; // Slight downward angle

    // Create camera rotation animation
    const rotationAnim = new Animation(
      'cameraRotationTransition',
      'rotation.x',
      60, // 60 fps
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Create easing function for smooth transition
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rotationAnim.setEasingFunction(easingFunction);

    // Define keyframes (60 frames = 1 second)
    rotationAnim.setKeys([
      { frame: 0, value: startRotX },
      { frame: 60, value: targetRotX },
    ]);

    // Apply animation
    this.camera.animations = [rotationAnim];
    this.scene.beginAnimation(this.camera, 0, 60, false, 1, () => {
      // Animation complete - ensure final values are set
      this.camera.rotation.x = targetRotX;
      this.rotationX = targetRotX;
    });

    // Set Y rotation immediately (no transition needed)
    this.rotationY = 0;
    this.camera.rotation.y = 0;

    // Show LZ
    if (this.lzPad) this.lzPad.isVisible = true;
    if (this.lzBeacon) this.lzBeacon.isVisible = true;

    // Show terrain in distance
    if (this.terrain) this.terrain.isVisible = true;

    // Update background
    this.scene.clearColor = new Color4(0.5, 0.3, 0.2, 1);

    // Create thruster exhaust particle system for powered descent
    this.createThrusterExhaust();
  }

  private spawnAsteroid(): void {
    if (this.asteroids.length >= 60 || this.phase !== 'freefall_belt') return;

    // Determine asteroid type for visual variety
    const typeRoll = Math.random();
    let asteroidType: 'rock' | 'ice' | 'metal';
    if (typeRoll < 0.6) {
      asteroidType = 'rock';
    } else if (typeRoll < 0.85) {
      asteroidType = 'ice';
    } else {
      asteroidType = 'metal';
    }

    const size = 0.8 + Math.random() * 2.5;
    const asteroid = MeshBuilder.CreatePolyhedron(
      `ast_${this.asteroidsSpawned++}`,
      { type: Math.floor(Math.random() * 4), size },
      this.scene
    );

    const mat = new StandardMaterial(`astMat_${this.asteroidsSpawned}`, this.scene);

    // Color based on asteroid type
    switch (asteroidType) {
      case 'rock':
        mat.diffuseColor = new Color3(
          0.25 + Math.random() * 0.2,
          0.2 + Math.random() * 0.15,
          0.15 + Math.random() * 0.1
        );
        break;
      case 'ice':
        mat.diffuseColor = new Color3(
          0.6 + Math.random() * 0.2,
          0.7 + Math.random() * 0.2,
          0.9 + Math.random() * 0.1
        );
        mat.specularColor = new Color3(0.8, 0.9, 1);
        mat.alpha = 0.85;
        break;
      case 'metal':
        mat.diffuseColor = new Color3(
          0.4 + Math.random() * 0.15,
          0.4 + Math.random() * 0.15,
          0.45 + Math.random() * 0.15
        );
        mat.specularColor = new Color3(0.8, 0.8, 0.9);
        mat.specularPower = 64;
        break;
    }

    asteroid.material = mat;

    // Spawn position - some asteroids spawn closer for more intense moments
    const spawnClose = Math.random() < 0.15; // 15% chance for close spawn
    const spawnDistance = spawnClose ? 60 : 120 + Math.random() * 40;
    const lateralSpread = spawnClose ? 25 : 50;

    asteroid.position.set(
      (Math.random() - 0.5) * lateralSpread,
      -spawnDistance,
      (Math.random() - 0.5) * lateralSpread
    );

    // Velocity varies by size - larger asteroids are slower
    const speedFactor = 1.5 - size / 3;
    const baseSpeed = 35 + Math.random() * 25;

    // Create trail for larger asteroids
    let trail: ParticleSystem | undefined;
    if (size > 2.0 && this.particleTexture) {
      trail = this.createAsteroidTrail(asteroid, asteroidType);
    }

    this.asteroids.push({
      mesh: asteroid,
      velocity: new Vector3(
        (Math.random() - 0.5) * 8,
        baseSpeed * speedFactor,
        (Math.random() - 0.5) * 8
      ),
      rotationSpeed: new Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3),
      passed: false,
      size,
      trail,
      type: asteroidType,
    });
  }

  /**
   * Creates a particle trail for larger asteroids
   */
  private createAsteroidTrail(asteroid: Mesh, type: 'rock' | 'ice' | 'metal'): ParticleSystem {
    const trail = new ParticleSystem(`asteroidTrail_${asteroid.name}`, 50, this.scene);
    trail.particleTexture = this.particleTexture!;

    trail.emitter = asteroid;
    trail.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
    trail.maxEmitBox = new Vector3(0.2, 0.2, 0.2);

    // Particles trail behind (opposite of asteroid motion)
    trail.direction1 = new Vector3(-0.5, -2, -0.5);
    trail.direction2 = new Vector3(0.5, -4, 0.5);

    // Colors based on type
    switch (type) {
      case 'rock':
        trail.color1 = new Color4(0.5, 0.4, 0.3, 0.5);
        trail.color2 = new Color4(0.4, 0.3, 0.2, 0.3);
        trail.colorDead = new Color4(0.2, 0.15, 0.1, 0);
        break;
      case 'ice':
        trail.color1 = new Color4(0.7, 0.8, 1, 0.6);
        trail.color2 = new Color4(0.6, 0.7, 0.9, 0.4);
        trail.colorDead = new Color4(0.4, 0.5, 0.7, 0);
        break;
      case 'metal':
        trail.color1 = new Color4(1, 0.6, 0.2, 0.5);
        trail.color2 = new Color4(0.8, 0.4, 0.1, 0.3);
        trail.colorDead = new Color4(0.4, 0.2, 0.05, 0);
        break;
    }

    trail.minSize = 0.1;
    trail.maxSize = 0.3;
    trail.minLifeTime = 0.3;
    trail.maxLifeTime = 0.6;

    trail.emitRate = 30;
    trail.minEmitPower = 2;
    trail.maxEmitPower = 5;

    trail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    trail.gravity = new Vector3(0, 0, 0);

    trail.start();
    return trail;
  }

  private updateAsteroids(deltaTime: number): void {
    // Update near-miss cooldown
    if (this.nearMissTimer > 0) {
      this.nearMissTimer -= deltaTime;
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];

      ast.mesh.position.addInPlace(ast.velocity.scale(deltaTime));
      ast.mesh.rotation.addInPlace(ast.rotationSpeed.scale(deltaTime));

      // Collision check - hitbox scales with asteroid size
      const hitRadius = 2.0 + ast.size * 0.5;
      const dist = Math.sqrt(ast.mesh.position.x ** 2 + ast.mesh.position.z ** 2);
      const inZone = ast.mesh.position.y > -6 && ast.mesh.position.y < 6;

      if (inZone && dist < hitRadius && !ast.passed) {
        this.onAsteroidHit(ast);
        ast.passed = true;
      }

      // Near-miss detection (close call but no hit)
      const nearMissRadius = hitRadius + 3;
      if (
        inZone &&
        dist >= hitRadius &&
        dist < nearMissRadius &&
        !ast.passed &&
        this.nearMissTimer <= 0
      ) {
        this.onAsteroidNearMiss(ast);
      }

      if (ast.mesh.position.y > 15 && !ast.passed) {
        ast.passed = true;
        this.asteroidsDodged++;
      }

      if (ast.mesh.position.y > 60) {
        // Dispose trail if exists
        if (ast.trail) {
          ast.trail.stop();
          ast.trail.dispose();
        }
        ast.mesh.dispose();
        this.asteroids.splice(i, 1);
      }
    }
  }

  /**
   * Called when player narrowly dodges an asteroid (near miss)
   * Provides dramatic audio-visual feedback for close calls
   */
  private onAsteroidNearMiss(asteroid: Asteroid): void {
    this.nearMissTimer = this.NEAR_MISS_COOLDOWN;

    // Camera shake scales with asteroid size - bigger = more dramatic
    const sizeMultiplier = 0.5 + asteroid.size * 0.4;
    this.triggerShake(1.5 * sizeMultiplier);

    // Play near-miss whoosh sound based on asteroid type
    // Different asteroid types have distinct audio signatures
    switch (asteroid.type) {
      case 'ice':
        // Ice asteroids: crystalline shimmer undertone
        this.playSound('near_miss_ice', { volume: 0.6 + asteroid.size * 0.1 });
        break;
      case 'metal':
        // Metal asteroids: metallic ring/ping
        this.playSound('near_miss_metal', { volume: 0.6 + asteroid.size * 0.1 });
        break;
      default:
        // Rock asteroids: standard whoosh
        this.playSound('near_miss_whoosh', { volume: 0.5 + asteroid.size * 0.1 });
        break;
    }

    // Increase wind intensity briefly for dramatic effect
    // Larger asteroids displace more "air" (dramatic license)
    this.windIntensity = Math.min(1, this.windIntensity + 0.2 + asteroid.size * 0.1);

    // Boost atmosphere streaks briefly for visual "wake" effect
    if (this.atmosphereStreaks) {
      const originalEmitRate = this.atmosphereStreaks.emitRate;
      this.atmosphereStreaks.emitRate = originalEmitRate + 80;
      setTimeout(() => {
        if (this.atmosphereStreaks) {
          this.atmosphereStreaks.emitRate = originalEmitRate;
        }
      }, 200);
    }
  }

  private onAsteroidHit(asteroid: Asteroid): void {
    // Don't process hits if already dead
    if (this.suitIntegrity <= 0) return;

    this.asteroidsHit++;

    // Damage scales with asteroid size (larger = more damage)
    const baseDamage = 8 + asteroid.size * 3;
    this.suitIntegrity = Math.max(0, this.suitIntegrity - baseDamage);

    // Intense screen shake scales with asteroid size
    const shakeIntensity = 4 + asteroid.size * 1.5;
    this.triggerShake(shakeIntensity);

    // Play damage feedback
    this.callbacks.onDamage();
    this.callbacks.onHealthChange(this.suitIntegrity);
    this.playSound('player_damage', { volume: 0.7 });

    // Brief wind intensity spike from impact
    this.windIntensity = Math.min(1, this.windIntensity + 0.5);

    // Create impact flash by briefly boosting re-entry particles
    if (this.reentryParticles) {
      const originalRate = this.reentryParticles.emitRate;
      this.reentryParticles.emitRate = 300;
      setTimeout(() => {
        if (this.reentryParticles) {
          this.reentryParticles.emitRate = originalRate;
        }
      }, 100);
    }

    if (this.suitIntegrity <= 0) {
      this.callbacks.onNotification('SUIT BREACH - CRITICAL', 3000);
    } else if (this.suitIntegrity < 30) {
      this.callbacks.onNotification('HEAVY IMPACT - SUIT CRITICAL', 1200);
    } else {
      this.callbacks.onNotification('IMPACT', 800);
    }

    // Stop asteroid trail if it has one
    if (asteroid.trail) {
      asteroid.trail.stop();
    }

    asteroid.mesh.scaling.setAll(0.1);
    setTimeout(() => asteroid.mesh.dispose(), 50);
  }

  protected override processMovement(deltaTime: number): void {
    if (this.phase === 'freefall_belt' || this.phase === 'freefall_start') {
      // Freefall body steering - use InputTracker for configurable keybindings
      if (this.inputTracker.isActionActive('moveLeft')) this.lateralVelocityX -= 40 * deltaTime;
      if (this.inputTracker.isActionActive('moveRight')) this.lateralVelocityX += 40 * deltaTime;
      if (this.inputTracker.isActionActive('moveForward')) this.lateralVelocityZ += 40 * deltaTime;
      if (this.inputTracker.isActionActive('moveBackward')) this.lateralVelocityZ -= 40 * deltaTime;

      this.lateralVelocityX *= 0.95;
      this.lateralVelocityZ *= 0.95;
    } else if (this.phase === 'powered_descent') {
      // Powered descent steering - use InputTracker for configurable keybindings
      if (this.inputTracker.isActionActive('moveLeft')) this.lateralVelocityX -= 20 * deltaTime;
      if (this.inputTracker.isActionActive('moveRight')) this.lateralVelocityX += 20 * deltaTime;
      if (this.inputTracker.isActionActive('moveForward')) this.lateralVelocityZ += 20 * deltaTime;
      if (this.inputTracker.isActionActive('moveBackward')) this.lateralVelocityZ -= 20 * deltaTime;

      // Boost (fire action - typically Space/Mouse0)
      if (this.inputTracker.isActionActive('fire') && this.fuel > 0) {
        this.velocity = Math.max(5, this.velocity - 60 * deltaTime);
        this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * deltaTime);
        this.showThrusterGlow(0.8);
      } else {
        this.showThrusterGlow(0.2);
      }

      // Stabilize (reload action - typically R, or check raw key)
      if (this.inputTracker.isActionActive('reload') && this.fuel > 0) {
        this.lateralVelocityX *= 0.9;
        this.lateralVelocityZ *= 0.9;
        this.fuel = Math.max(0, this.fuel - 2 * deltaTime);
      }

      this.lateralVelocityX *= 0.98;
      this.lateralVelocityZ *= 0.98;
    }

    // Update position
    this.positionX += this.lateralVelocityX * deltaTime;
    this.positionZ += this.lateralVelocityZ * deltaTime;
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Smooth FOV interpolation for cinematic transitions
    if (Math.abs(this.currentFOV - this.targetFOV) > 0.01) {
      const fovLerpSpeed = 2.0; // Adjust for smooth transition speed
      this.currentFOV += (this.targetFOV - this.currentFOV) * fovLerpSpeed * deltaTime;
      this.camera.fov = this.currentFOV;
    }

    // Gravity / descent
    if (this.phase !== 'surface') {
      if (this.phase === 'powered_descent' || this.phase === 'landing') {
        // Gravity pulls down, jets counter
        this.velocity = Math.min(100, this.velocity + 15 * deltaTime);
      } else {
        // Freefall acceleration
        this.velocity = Math.min(80, this.velocity + 8 * deltaTime);
      }

      this.altitude -= this.velocity * deltaTime;

      // Fuel passive regen (tiny)
      if (this.phase === 'powered_descent') {
        this.fuel = Math.min(this.maxFuel, this.fuel + this.fuelRegenRate * deltaTime * 0.1);
      }
    } else {
      // On surface - enforce ground collision and terrain bounds
      this.enforceTerrainConstraints();

      // Update surface combat
      if (this.surfaceCombatActive) {
        this.updateSurfaceCombat(deltaTime);
      }
    }

    // Update combat cooldowns
    if (this.meleeCooldown > 0) {
      this.meleeCooldown -= deltaTime;
    }
    if (this.primaryFireCooldown > 0) {
      this.primaryFireCooldown -= deltaTime;
    }

    // Update planet visual
    if (this.planet && this.phase !== 'surface' && this.phase !== 'powered_descent') {
      const scale = Math.max(1, (1000 - this.altitude) / 40 + 1);
      this.planet.scaling.setAll(scale);
      this.planet.position.y = -150 + (1000 - this.altitude) * 0.12;
      this.planet.position.x = -this.positionX * 0.1;
      this.planet.position.z = -this.positionZ * 0.1;
      if (this.planetAtmosphere) {
        this.planetAtmosphere.scaling.setAll(scale * 1.08);
        this.planetAtmosphere.position.copyFrom(this.planet.position);
      }
    }

    // Update Anchor Station (visible above during freefall)
    this.updateAnchorStation(deltaTime);

    // Update all visual effects (particles, streaks, atmosphere)
    this.updateVisualEffects(deltaTime);

    // Update LZ position indicator during powered descent
    if (this.phase === 'powered_descent' || this.phase === 'landing') {
      // LZ stays at origin, we're drifting relative to it
      const distToLZ = Math.sqrt(this.positionX ** 2 + this.positionZ ** 2);

      // Visual feedback on LZ beacon
      if (this.lzBeacon?.material) {
        const mat = this.lzBeacon.material as StandardMaterial;
        if (distToLZ < this.lzRadius) {
          mat.emissiveColor = new Color3(0.2, 1, 0.3); // Green - on target
        } else if (distToLZ < this.nearMissRadius) {
          mat.emissiveColor = new Color3(1, 1, 0.2); // Yellow - close
        } else {
          mat.emissiveColor = new Color3(1, 0.3, 0.2); // Red - off target
        }
      }

      // Check for slingshot (too far off course)
      if (distToLZ > this.maxDrift) {
        this.landingOutcome = 'slingshot';
        this.callbacks.onNotification('⚠️ TRAJECTORY LOST', 2000);
      }
    }

    // Phase transitions
    switch (this.phase) {
      case 'freefall_start':
        if (this.phaseTime > 3) {
          this.transitionToPhase('freefall_belt');
        }
        break;

      case 'freefall_belt':
        this.asteroidSpawnTimer += deltaTime;
        if (this.asteroidSpawnTimer > this.asteroidSpawnRate) {
          this.spawnAsteroid();
          this.asteroidSpawnTimer = 0;
          this.asteroidSpawnRate = Math.max(0.12, this.asteroidSpawnRate - 0.005);
        }
        this.updateAsteroids(deltaTime);

        // Spawn distant threats at altitude 900 (visual storytelling)
        if (this.altitude < 900 && !this.threatsSpawned) {
          this.spawnDistantThreats();
        }

        // Update distant threats
        if (this.distantThreats.length > 0) {
          this.updateDistantThreats(deltaTime);
        }

        // Clear debris field at altitude 650
        if (this.altitude < 650) {
          this.transitionToPhase('freefall_clear');
        }
        break;

      case 'freefall_clear':
        this.updateAsteroids(deltaTime);
        // Update distant threats
        if (this.distantThreats.length > 0) {
          this.updateDistantThreats(deltaTime);
        }
        // Player must hit "Ignite Jets" - if they wait too long...
        if (this.altitude < 200 && this.phase === 'freefall_clear') {
          this.callbacks.onNotification('⚠️ IGNITE JETS NOW!', 1000);
        }
        if (this.altitude < 50 && this.phase === 'freefall_clear') {
          // Forced crash - didn't ignite in time
          this.landingOutcome = 'crash';
          this.transitionToPhase('surface');
        }
        break;

      case 'powered_descent':
        // Transition to landing at low altitude
        if (this.altitude < 80) {
          this.transitionToPhase('landing');
        }
        break;

      case 'landing':
        if (this.altitude <= 0) {
          this.altitude = 0;
          this.determineLandingOutcome();
          this.transitionToPhase('surface');
        }
        break;
    }

    // HUD update
    if (this.phase !== 'surface') {
      const altStr = Math.max(0, this.altitude).toFixed(0);
      const velStr = this.velocity.toFixed(0);

      if (this.phase === 'powered_descent' || this.phase === 'landing') {
        const fuelStr = this.fuel.toFixed(0);
        const distToLZ = Math.sqrt(this.positionX ** 2 + this.positionZ ** 2).toFixed(0);
        this.callbacks.onObjectiveUpdate(
          'TARGET LZ',
          `ALT: ${altStr} | VEL: ${velStr} | FUEL: ${fuelStr}% | LZ: ${distToLZ}m`
        );
      } else {
        this.callbacks.onObjectiveUpdate(
          this.phase === 'freefall_belt' ? 'NAVIGATE DEBRIS' : 'FREEFALL',
          `ALT: ${altStr} | VEL: ${velStr} m/s | SUIT: ${this.suitIntegrity}%`
        );
      }
    }
  }

  private determineLandingOutcome(): void {
    const distToLZ = Math.sqrt(this.positionX ** 2 + this.positionZ ** 2);

    if (this.velocity > 60) {
      this.landingOutcome = 'crash';
    } else if (distToLZ <= this.lzRadius && this.velocity < 25) {
      this.landingOutcome = 'perfect';
    } else if (distToLZ <= this.nearMissRadius) {
      this.landingOutcome = this.velocity < 40 ? 'near_miss' : 'rough';
    } else if (distToLZ > this.maxDrift) {
      this.landingOutcome = 'slingshot';
    } else {
      this.landingOutcome = 'rough';
    }
  }

  private completeLanding(): void {
    this.setBaseShake(0);
    this.callbacks.onCinematicEnd?.();

    // Clear action buttons
    this.updateActionButtons('none');

    switch (this.landingOutcome) {
      case 'perfect':
        this.triggerShake(2);
        this.callbacks.onNotification('🎯 PERFECT LANDING', 3000);
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'PROMETHEUS A.I.',
            callsign: 'ATHENA',
            portrait: 'ai',
            text: `Touchdown on LZ pad. ${this.asteroidsDodged} debris dodged. Exemplary, Sergeant.`,
          });
        }, 2000);
        this.transitionToSurface(false);
        break;

      case 'near_miss':
        this.triggerShake(4);
        this.callbacks.onNotification('⚠️ NEAR MISS - HOSTILES INBOUND', 3000);
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'PROMETHEUS A.I.',
            callsign: 'ATHENA',
            portrait: 'ai',
            text: 'Landed outside LZ perimeter. Movement detected. Fight to the pad!',
          });
        }, 2000);
        this.transitionToSurface(true); // Combat on way to LZ
        break;

      case 'rough':
        this.triggerShake(6);
        // Clamp suit integrity to minimum 0
        this.suitIntegrity = Math.max(0, this.suitIntegrity - 25);
        this.callbacks.onHealthChange(this.suitIntegrity);
        this.callbacks.onNotification('ROUGH LANDING - DAMAGE TAKEN', 3000);
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'PROMETHEUS A.I.',
            callsign: 'ATHENA',
            portrait: 'ai',
            text: `Hard touchdown. Suit integrity compromised. Multiple hostiles converging.`,
          });
        }, 2000);
        this.transitionToSurface(true);
        break;

      case 'crash':
        this.triggerShake(10);
        this.suitIntegrity = Math.max(10, this.suitIntegrity - 50);
        this.callbacks.onHealthChange(this.suitIntegrity);
        this.callbacks.onNotification('💀 CRASH LANDING', 3000);
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'PROMETHEUS A.I.',
            callsign: 'ATHENA',
            portrait: 'ai',
            text: 'Critical impact. Medical nanites deployed. You need to move, Sergeant.',
          });
        }, 2000);
        this.transitionToSurface(true);
        break;

      case 'slingshot':
        this.callbacks.onNotification('💀 TRAJECTORY LOST - KIA', 3000);
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'Commander Vasquez',
            callsign: 'PROMETHEUS ACTUAL',
            portrait: 'commander',
            text: "Specter, we've lost your signal. Specter, respond... Damn it.",
          });
        }, 2000);
        // Game over - would restart level
        break;
    }
  }

  /**
   * Enforces terrain constraints to prevent player from falling through ground
   * or wandering outside playable area. Called every frame on surface.
   */
  private enforceTerrainConstraints(): void {
    // Ensure player stays above terrain (ground collision)
    if (this.camera.position.y < this.MIN_PLAYER_HEIGHT) {
      this.camera.position.y = this.MIN_PLAYER_HEIGHT;
    }

    // Clamp player position to terrain bounds (prevent wandering off map)
    this.camera.position.x = Math.max(
      -this.TERRAIN_BOUNDS,
      Math.min(this.TERRAIN_BOUNDS, this.camera.position.x)
    );
    this.camera.position.z = Math.max(
      -this.TERRAIN_BOUNDS,
      Math.min(this.TERRAIN_BOUNDS, this.camera.position.z)
    );
  }

  private transitionToSurface(combatRequired: boolean): void {
    // Unlock HALO drop achievement
    getAchievementManager().onHaloDropComplete();

    // Stop descent audio loops
    getAudioManager().stopLoop('drop_wind');
    getAudioManager().stopLoop('drop_thrust');

    // Hide descent elements
    this.setPoweredDescentVisible(false);
    if (this.planet) this.planet.isVisible = false;
    if (this.planetAtmosphere) this.planetAtmosphere.isVisible = false;
    if (this.starfield) this.starfield.isVisible = false;
    if (this.plasmaGlow) this.plasmaGlow.isVisible = false;
    if (this.lzBeacon) this.lzBeacon.isVisible = false;

    // Clear asteroids with proper cleanup
    this.asteroids.forEach((a) => {
      if (a.trail) {
        a.trail.stop();
        a.trail.dispose();
      }
      a.mesh.dispose();
    });
    this.asteroids = [];

    // Dispose distant threats on landing
    for (const threat of this.distantThreats) {
      threat.node.dispose();
    }
    this.distantThreats = [];

    // Stop all descent particle effects
    this.stopAllDescentEffects();

    // Show surface
    if (this.terrain) this.terrain.isVisible = true;
    if (this.skyDome) this.skyDome.isVisible = true;
    if (this.lzPad) this.lzPad.isVisible = true;
    this.canyonWalls.forEach((w) => (w.isVisible = true));

    // Show combat arena cover objects
    this.coverObjects.forEach((obj) => (obj.isVisible = true));

    // Show environment hazards
    this.acidPools.forEach((pool) => (pool.isVisible = true));
    this.unstableTerrain.forEach((terrain) => (terrain.isVisible = true));

    // Transition to standard FPS FOV for ground combat
    this.targetFOV = this.SURFACE_FOV;

    // FPS camera - clamp position to valid terrain bounds
    const clampedX = Math.max(-this.TERRAIN_BOUNDS, Math.min(this.TERRAIN_BOUNDS, this.positionX));
    const clampedZ = Math.max(-this.TERRAIN_BOUNDS, Math.min(this.TERRAIN_BOUNDS, this.positionZ));
    this.camera.position.set(clampedX, this.MIN_PLAYER_HEIGHT, clampedZ);

    // Animate camera rotation from looking down to looking forward
    // This creates a smooth "getting up" transition after landing
    const startRotX = this.camera.rotation.x;
    const targetRotX = 0;
    const startRotY = this.camera.rotation.y;
    const targetRotY = Math.PI;

    // Create smooth camera rotation animation (800ms)
    const rotAnimation = new Animation(
      'landingCameraRotation',
      'rotation',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const rotKeyframes = [
      { frame: 0, value: new Vector3(startRotX, startRotY, 0) },
      {
        frame: 24,
        value: new Vector3(targetRotX * 0.3, startRotY + (targetRotY - startRotY) * 0.3, 0),
      },
      { frame: 48, value: new Vector3(targetRotX, targetRotY, 0) },
    ];
    rotAnimation.setKeys(rotKeyframes);

    // Apply easing for smooth feel
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rotAnimation.setEasingFunction(easing);

    // Run the animation
    this.camera.animations = [rotAnimation];
    this.scene.beginAnimation(this.camera, 0, 48, false, 1, () => {
      // Animation complete - set final values
      this.rotationX = 0;
      this.rotationY = Math.PI;
      this.camera.rotation.set(0, Math.PI, 0);
    });

    this.scene.clearColor = new Color4(0.75, 0.5, 0.35, 1);

    if (combatRequired) {
      // Brief calm for orientation (2 seconds)
      setTimeout(() => {
        this.callbacks.onObjectiveUpdate(
          'GET YOUR BEARINGS',
          'Assess the situation. LZ pad is ahead.'
        );
      }, 1000);

      // Comms warning of contacts (4 seconds)
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Sergeant, detecting seismic activity nearby. Possible subsurface contacts.',
        });
      }, 4000);

      // Second warning (6 seconds)
      setTimeout(() => {
        this.callbacks.onNotification('SEISMIC WARNING', 1500);
        this.triggerShake(2);
      }, 6000);

      // Combat begins (8 seconds)
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'CONTACTS EMERGING! Chitin Drones - fast but fragile. Use cover and aim for center mass!',
        });
        this.callbacks.onObjectiveUpdate(
          'SURVIVE THE AMBUSH',
          'Eliminate hostiles. Use the debris for cover!'
        );
        this.callbacks.onCombatStateChange(true);
        // Switch to combat action buttons
        this.updateActionButtons('combat');
        // Start combat music
        getAudioManager().enterCombat();

        // Check if player needs combat tutorial (skipped Anchor Station)
        // If the tutorial achievement is not unlocked, enable tutorial prompts
        const achievementManager = getAchievementManager();
        const hasCompletedTutorial = achievementManager.isUnlocked('first_steps');
        const hasShootingExperience = achievementManager.isUnlocked('sharpshooter');
        this.combatTutorialActive = !hasCompletedTutorial && !hasShootingExperience;

        if (this.combatTutorialActive) {
          // Add initial combat tutorial message
          setTimeout(() => {
            this.callbacks.onCommsMessage({
              sender: 'PROMETHEUS A.I.',
              callsign: 'ATHENA',
              portrait: 'ai',
              text: 'Sergeant, I detect you may have skipped station training. I will provide tactical guidance.',
            });
          }, 2000);
        }

        // Spawn first combat encounter
        this.spawnFirstCombatEncounter();
      }, 8000);
    } else {
      setTimeout(() => {
        this.callbacks.onObjectiveUpdate('PROCEED TO FOB DELTA', 'LZ secure. Move out.');
        // Auto-complete after perfect landing
        setTimeout(() => this.completeLevel(), 5000);
      }, 3000);
    }
  }

  /**
   * Spawn surface combat enemies around the player's landing position
   */
  private spawnSurfaceEnemies(): void {
    if (this.surfaceCombatActive) return;
    this.surfaceCombatActive = true;

    this.callbacks.onNotification('HOSTILES DETECTED!', 2000);

    // Calculate spawn points around the player, between them and the LZ
    const playerPos = this.camera.position.clone();
    const lzPos = new Vector3(0, 0, 0); // LZ is at origin
    const towardsLZ = lzPos.subtract(playerPos).normalize();

    // Spawn points in an arc between player and LZ
    const spawnPoints: Vector3[] = [];
    for (let i = 0; i < this.maxSurfaceEnemies; i++) {
      const angle = (i / this.maxSurfaceEnemies) * Math.PI - Math.PI / 2;
      const distance = 20 + Math.random() * 15;
      const offsetX = Math.cos(angle) * distance;
      const offsetZ = Math.sin(angle) * distance + 10; // Bias towards LZ

      const spawnPos = playerPos.add(new Vector3(offsetX, 0, offsetZ));
      // Clamp to terrain bounds
      spawnPos.x = Math.max(
        -this.TERRAIN_BOUNDS + 10,
        Math.min(this.TERRAIN_BOUNDS - 10, spawnPos.x)
      );
      spawnPos.z = Math.max(
        -this.TERRAIN_BOUNDS + 10,
        Math.min(this.TERRAIN_BOUNDS - 10, spawnPos.z)
      );
      spawnPoints.push(spawnPos);
    }

    // Materials for fallback procedural enemies
    const enemyMat = new StandardMaterial('surfaceEnemyMat', this.scene);
    enemyMat.diffuseColor = new Color3(0.3, 0.2, 0.15);
    enemyMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const glowMat = new StandardMaterial('enemyGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#FF4444');
    glowMat.disableLighting = true;

    for (let i = 0; i < this.maxSurfaceEnemies; i++) {
      const spawnPos = spawnPoints[i].clone();
      spawnPos.y = 1;

      // Try GLB model first
      let enemyMesh: Mesh | TransformNode;
      const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];

      if (this.surfaceEnemiesPreloaded && assetName) {
        const glbInstance = AssetManager.createInstance(
          'aliens',
          assetName,
          `surfaceEnemy_${i}`,
          this.scene
        );

        if (glbInstance) {
          glbInstance.scaling.setAll(SURFACE_ENEMY_SCALE);
          enemyMesh = glbInstance;
          console.log(`[Landfall] Created GLB enemy instance ${i} (${assetName})`);
        } else {
          enemyMesh = this.createProceduralEnemy(i, enemyMat, glowMat);
        }
      } else {
        enemyMesh = this.createProceduralEnemy(i, enemyMat, glowMat);
      }

      enemyMesh.position = spawnPos;

      // Spawn animation - enemies rise from the ground
      enemyMesh.scaling.setAll(0.1);
      const targetScale = this.surfaceEnemiesPreloaded ? SURFACE_ENEMY_SCALE : 1;
      const spawnStart = performance.now();
      const animateSpawn = () => {
        const elapsed = performance.now() - spawnStart;
        const progress = Math.min(elapsed / 500, 1);
        enemyMesh.scaling.setAll(0.1 + progress * (targetScale - 0.1));
        if (progress < 1) requestAnimationFrame(animateSpawn);
      };
      requestAnimationFrame(animateSpawn);

      this.surfaceEnemies.push({
        mesh: enemyMesh,
        health: 50,
        maxHealth: 50,
        position: spawnPos,
        state: 'chase',
        attackCooldown: 0,
        species: 'skitterer',
      });
    }

    this.enemyCount = this.maxSurfaceEnemies;
  }

  /**
   * Create a procedural fallback enemy mesh
   */
  private createProceduralEnemy(
    index: number,
    enemyMat: StandardMaterial,
    glowMat: StandardMaterial
  ): Mesh {
    console.log(`[Landfall] Creating procedural enemy ${index} (GLB not available)`);

    // Create skitterer-style enemy mesh (low, fast creatures)
    const body = MeshBuilder.CreateCapsule(
      `surfaceEnemy_${index}`,
      { height: 1.2, radius: 0.4 },
      this.scene
    );
    body.material = enemyMat;

    // Glowing eyes
    const leftEye = MeshBuilder.CreateSphere('eye', { diameter: 0.1 }, this.scene);
    leftEye.material = glowMat;
    leftEye.parent = body;
    leftEye.position.set(-0.15, 0.3, -0.35);

    const rightEye = MeshBuilder.CreateSphere('eye', { diameter: 0.1 }, this.scene);
    rightEye.material = glowMat;
    rightEye.parent = body;
    rightEye.position.set(0.15, 0.3, -0.35);

    return body;
  }

  /**
   * First combat encounter spawn state
   */
  private firstEncounterSpawnIndex = 0;
  private firstEncounterEnemyCount = 4; // Small group of 3-4 Chitin Drones
  private tutorialSlowdownActive = true;
  private tutorialSlowdownTimer = 0;
  private readonly TUTORIAL_SLOWDOWN_DURATION = 8; // First 8 seconds enemies are slower

  /**
   * Spawns the first combat encounter - a tutorial-like fight with Chitin Drones.
   * Features:
   * - Small group of 3-4 enemies
   * - Enemies spawn from burrow holes with particle effects
   * - Staggered spawn timing for dramatic effect
   * - Tutorial hint about using cover
   */
  private spawnFirstCombatEncounter(): void {
    if (this.surfaceCombatActive) return;
    this.surfaceCombatActive = true;
    this.tutorialSlowdownActive = true;
    this.tutorialSlowdownTimer = 0;
    this.firstEncounterSpawnIndex = 0;

    // Calculate spawn positions - in front of player near cover objects
    const playerPos = this.camera.position.clone();

    // Spawn points near debris (so enemies feel like they're ambushing)
    const spawnPoints: Vector3[] = [
      new Vector3(playerPos.x + 12, 0, playerPos.z + 18), // Right front
      new Vector3(playerPos.x - 10, 0, playerPos.z + 22), // Left front
      new Vector3(playerPos.x + 5, 0, playerPos.z + 28), // Center far
      new Vector3(playerPos.x - 8, 0, playerPos.z + 15), // Left close
    ];

    // Clamp to terrain bounds
    for (const pos of spawnPoints) {
      pos.x = Math.max(-this.TERRAIN_BOUNDS + 10, Math.min(this.TERRAIN_BOUNDS - 10, pos.x));
      pos.z = Math.max(-this.TERRAIN_BOUNDS + 10, Math.min(this.TERRAIN_BOUNDS - 10, pos.z));
    }

    // Create burrow hole meshes at spawn locations
    const burrowMat = new StandardMaterial('burrowMat', this.scene);
    burrowMat.diffuseColor = Color3.FromHexString('#3A2A1A');
    burrowMat.emissiveColor = new Color3(0.1, 0.05, 0);

    // Materials for fallback procedural enemies
    const enemyMat = new StandardMaterial('firstEncounterEnemyMat', this.scene);
    enemyMat.diffuseColor = new Color3(0.3, 0.2, 0.15);
    enemyMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const glowMat = new StandardMaterial('firstEncounterGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#FF4444');
    glowMat.disableLighting = true;

    // Staggered spawn sequence
    const spawnEnemy = (index: number) => {
      if (index >= this.firstEncounterEnemyCount) {
        // All enemies spawned - show tutorial tip
        setTimeout(() => {
          this.callbacks.onNotification('TIP: Use debris for cover!', 2500);
        }, 1500);
        return;
      }

      const spawnPos = spawnPoints[index].clone();

      // Create burrow hole visual
      const burrowHole = MeshBuilder.CreateDisc(
        `burrowHole_${index}`,
        { radius: 1.2, tessellation: 12 },
        this.scene
      );
      burrowHole.material = burrowMat;
      burrowHole.position = spawnPos.clone();
      burrowHole.position.y = 0.05;
      burrowHole.rotation.x = Math.PI / 2;

      // Emit burrow emergence particles
      particleManager.emitBurrowEmergence(spawnPos, 1.2);

      // Camera shake for dramatic effect
      this.triggerShake(3);

      // Play alien screech sound
      getAudioManager().play('alien_screech', { volume: 0.4 });

      // Spawn enemy after brief delay (emergence animation)
      setTimeout(() => {
        spawnPos.y = 0; // Start underground

        // Create enemy mesh
        let enemyMesh: Mesh | TransformNode;
        const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];

        if (this.surfaceEnemiesPreloaded && assetName) {
          const glbInstance = AssetManager.createInstance(
            'aliens',
            assetName,
            `firstEncounterEnemy_${index}`,
            this.scene
          );

          if (glbInstance) {
            glbInstance.scaling.setAll(0.1); // Start small
            enemyMesh = glbInstance;
          } else {
            enemyMesh = this.createProceduralEnemy(index + 100, enemyMat, glowMat);
            enemyMesh.scaling.setAll(0.1);
          }
        } else {
          enemyMesh = this.createProceduralEnemy(index + 100, enemyMat, glowMat);
          enemyMesh.scaling.setAll(0.1);
        }

        enemyMesh.position = spawnPos;

        // Emergence animation - enemy rises from ground
        const targetScale = this.surfaceEnemiesPreloaded ? SURFACE_ENEMY_SCALE : 1;
        const spawnStart = performance.now();
        const emergeDuration = 600;

        const animateEmergence = () => {
          const elapsed = performance.now() - spawnStart;
          const progress = Math.min(elapsed / emergeDuration, 1);

          // Scale up
          const currentScale = 0.1 + progress * (targetScale - 0.1);
          enemyMesh.scaling.setAll(currentScale);

          // Rise from ground
          enemyMesh.position.y = progress * 1;

          if (progress < 1) {
            requestAnimationFrame(animateEmergence);
          } else {
            // Enemy fully emerged - remove burrow hole
            setTimeout(() => burrowHole.dispose(), 2000);
          }
        };
        requestAnimationFrame(animateEmergence);

        // Add to enemies list - tutorial enemies have slower initial behavior
        this.surfaceEnemies.push({
          mesh: enemyMesh,
          health: 40, // Slightly weaker for tutorial
          maxHealth: 40,
          position: spawnPos,
          state: 'idle', // Start idle for tutorial pacing
          attackCooldown: 2.0, // Longer initial cooldown
          species: 'skitterer',
        });

        this.enemyCount++;

        // Notification for first kill hint
        if (index === 0) {
          setTimeout(() => {
            this.callbacks.onNotification(
              `${this.firstEncounterEnemyCount} HOSTILES DETECTED`,
              1500
            );
          }, 500);
        }
      }, 300); // 300ms delay for emergence

      // Schedule next enemy spawn (staggered timing)
      const nextDelay = 800 + Math.random() * 400; // 800-1200ms between spawns
      setTimeout(() => spawnEnemy(index + 1), nextDelay);
    };

    // Start spawn sequence
    spawnEnemy(0);
  }

  /**
   * Update surface combat - enemy AI and combat state
   */
  private updateSurfaceCombat(deltaTime: number): void {
    const playerPos = this.camera.position;

    // Update tutorial slowdown timer
    if (this.tutorialSlowdownActive) {
      this.tutorialSlowdownTimer += deltaTime;
      if (this.tutorialSlowdownTimer >= this.TUTORIAL_SLOWDOWN_DURATION) {
        this.tutorialSlowdownActive = false;
        // Notify player that enemies are getting faster
        this.callbacks.onNotification('ENEMIES BECOMING AGGRESSIVE!', 1500);
      }
    }

    // Calculate slowdown multiplier for tutorial pacing
    // During tutorial: 0.4 speed, ramping up to 1.0 over the duration
    const tutorialProgress = Math.min(
      this.tutorialSlowdownTimer / this.TUTORIAL_SLOWDOWN_DURATION,
      1
    );
    const speedMultiplier = this.tutorialSlowdownActive
      ? 0.4 + tutorialProgress * 0.6 // Ramp from 0.4 to 1.0
      : 1.0;

    // Process each enemy
    for (let i = this.surfaceEnemies.length - 1; i >= 0; i--) {
      const enemy = this.surfaceEnemies[i];

      // Skip dead enemies (cleanup happens after death animation)
      if (enemy.health <= 0) continue;

      // Update attack cooldown
      if (enemy.attackCooldown > 0) {
        enemy.attackCooldown -= deltaTime;
      }

      // Calculate distance to player
      const toPlayer = playerPos.subtract(enemy.mesh.position);
      toPlayer.y = 0; // Ignore vertical
      const dist = toPlayer.length();

      // Enemy AI state machine with tutorial pacing
      const attackRange = 2.0;
      const baseChaseSpeed = 4.0;
      const chaseSpeed = baseChaseSpeed * speedMultiplier;

      // Idle state transition (for tutorial pacing)
      if (enemy.state === 'idle') {
        // Transition to chase after brief delay
        enemy.state = 'chase';
      }

      if (dist < attackRange) {
        // In attack range
        enemy.state = 'attack';
        // Tutorial pacing - longer attack cooldown during slowdown
        const attackCooldown = this.tutorialSlowdownActive ? 2.5 : 1.5;
        if (enemy.attackCooldown <= 0) {
          const damage = this.tutorialSlowdownActive ? 10 : 15; // Less damage during tutorial
          this.onEnemyAttack(enemy, damage);
          enemy.attackCooldown = attackCooldown;
        }
      } else {
        // Chase the player
        enemy.state = 'chase';

        // Move towards player
        const moveDir = toPlayer.normalize();
        enemy.mesh.position.addInPlace(moveDir.scale(chaseSpeed * deltaTime));
        enemy.mesh.position.y = 1; // Keep at ground level

        // Face movement direction
        const angle = Math.atan2(toPlayer.x, toPlayer.z);
        enemy.mesh.rotation.y = angle;

        // Subtle bobbing animation while moving
        enemy.mesh.position.y = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      }
    }

    // Check for combat completion
    const aliveEnemies = this.surfaceEnemies.filter((e) => e.health > 0);
    if (aliveEnemies.length === 0 && this.surfaceCombatActive && this.killCount > 0) {
      this.onCombatCleared();
    }

    // Update environment hazards
    this.updateEnvironmentHazards(deltaTime);

    // Show combat tutorial prompts if needed
    this.updateCombatTutorialPrompts(deltaTime);
  }

  /**
   * Updates environment hazards (acid pools, unstable terrain).
   * Handles damage over time and visual effects.
   */
  private updateEnvironmentHazards(deltaTime: number): void {
    const playerPos = this.camera.position;

    // ========================================
    // ACID POOL DAMAGE CHECK
    // ========================================
    let inAcidPool = false;
    const acidPositions = [
      { pos: new Vector3(25, 0, 18), radius: 3.5 },
      { pos: new Vector3(-22, 0, 28), radius: 2.8 },
      { pos: new Vector3(12, 0, 40), radius: 2.2 },
      { pos: new Vector3(-8, 0, 12), radius: 1.8 },
    ];

    for (const acid of acidPositions) {
      const dist2D = Math.sqrt((playerPos.x - acid.pos.x) ** 2 + (playerPos.z - acid.pos.z) ** 2);
      if (dist2D < acid.radius) {
        inAcidPool = true;
        break;
      }
    }

    // Handle acid damage
    if (inAcidPool) {
      if (!this.playerInAcid) {
        this.playerInAcid = true;
        this.callbacks.onNotification('ACID BURNS!', 1000);
        // Tint screen green briefly
        this.triggerShake(1.5);
      }

      this.acidDamageTimer += deltaTime;
      if (this.acidDamageTimer >= this.ACID_DAMAGE_INTERVAL) {
        this.acidDamageTimer = 0;
        this.suitIntegrity = Math.max(0, this.suitIntegrity - this.ACID_DAMAGE);
        this.callbacks.onHealthChange(-this.ACID_DAMAGE);
        this.triggerDamageShake(this.ACID_DAMAGE);

        // Emit acid splash particles at player feet
        const splashPos = playerPos.clone();
        splashPos.y = 0.1;
        particleManager.emitSmallExplosion(splashPos);

        if (this.suitIntegrity <= 0) {
          this.callbacks.onNotification('DISSOLVED IN ACID - KIA', 3000);
        }
      }
    } else {
      if (this.playerInAcid) {
        this.playerInAcid = false;
        this.callbacks.onNotification('ESCAPED ACID', 800);
      }
      this.acidDamageTimer = 0;
    }

    // ========================================
    // UNSTABLE TERRAIN EFFECTS
    // ========================================
    const unstablePositions = [
      { pos: new Vector3(5, 0, 35), size: 6 },
      { pos: new Vector3(-15, 0, 22), size: 5 },
      { pos: new Vector3(18, 0, 30), size: 4 },
    ];

    let onUnstableTerrain = false;
    for (const unstable of unstablePositions) {
      const dist2D = Math.sqrt(
        (playerPos.x - unstable.pos.x) ** 2 + (playerPos.z - unstable.pos.z) ** 2
      );
      if (dist2D < unstable.size) {
        onUnstableTerrain = true;
        break;
      }
    }

    // Periodic tremors on unstable terrain
    if (onUnstableTerrain) {
      this.unstableTerrainShakeTimer += deltaTime;
      if (this.unstableTerrainShakeTimer >= 2.5) {
        // Tremor every 2.5 seconds
        this.unstableTerrainShakeTimer = 0;
        this.triggerShake(1.0);
        // Random chance of stumble notification
        if (Math.random() < 0.3) {
          this.callbacks.onNotification('GROUND UNSTABLE!', 800);
        }
      }
    } else {
      this.unstableTerrainShakeTimer = 0;
    }

    // ========================================
    // ACID POOL VISUAL ANIMATION
    // ========================================
    const time = performance.now() * 0.001;
    for (let i = 0; i < this.acidPools.length; i++) {
      const pool = this.acidPools[i];
      if (pool && pool.material instanceof StandardMaterial) {
        // Pulsing glow effect
        const pulse = 0.15 + Math.sin(time * 2 + i * 0.5) * 0.05;
        pool.material.emissiveColor = new Color3(0.2 + pulse, 0.5 + pulse * 2, 0.15);
      }
    }

    // Unstable terrain crack glow animation
    for (let i = 0; i < this.unstableTerrain.length; i++) {
      const terrain = this.unstableTerrain[i];
      if (
        terrain &&
        terrain.material instanceof StandardMaterial &&
        terrain.name.includes('crack')
      ) {
        const pulse = 0.3 + Math.sin(time * 3 + i * 0.3) * 0.15;
        terrain.material.emissiveColor = new Color3(pulse, pulse * 0.5, pulse * 0.15);
      }
    }
  }

  /**
   * Shows combat tutorial prompts for players who haven't completed Anchor Station.
   * Checks achievement/save system to determine if tutorial is needed.
   */
  private updateCombatTutorialPrompts(deltaTime: number): void {
    if (!this.combatTutorialActive) return;

    // Only show tutorials if player hasn't completed shooting range
    // This is determined at combat start

    // Movement tutorial - shown once when combat starts
    if (!this.hasShownMovementTutorial && this.phaseTime > 2) {
      this.hasShownMovementTutorial = true;
      this.callbacks.onNotification('TIP: WASD to move, dodge enemy attacks!', 3000);
    }

    // Aiming tutorial - shown after 5 seconds
    if (!this.hasShownAimingTutorial && this.phaseTime > 5 && this.hasShownMovementTutorial) {
      this.hasShownAimingTutorial = true;
      this.callbacks.onNotification('TIP: Click to shoot, aim at center mass!', 3000);
    }

    // Cover tutorial - shown after 8 seconds
    if (!this.hasShownCoverTutorial && this.phaseTime > 8 && this.hasShownAimingTutorial) {
      this.hasShownCoverTutorial = true;
      this.callbacks.onNotification('TIP: Use debris and rocks for cover!', 3000);
    }

    // Reload tutorial - shown after player fires some shots
    if (!this.hasShownReloadTutorial && this.phaseTime > 12 && this.hasShownCoverTutorial) {
      this.hasShownReloadTutorial = true;
      const weaponDef = getCurrentWeaponDef();
      if (weaponDef) {
        this.callbacks.onNotification(`TIP: R to reload when ammo is low!`, 3000);
      }
    }
  }

  /**
   * Handle enemy attack on player
   */
  private onEnemyAttack(enemy: SurfaceEnemy, damage: number): void {
    // Visual feedback - enemy lunges
    const originalY = enemy.mesh.position.y;
    enemy.mesh.position.y += 0.3;
    setTimeout(() => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        enemy.mesh.position.y = originalY;
      }
    }, 150);

    // Apply damage to player
    this.suitIntegrity = Math.max(0, this.suitIntegrity - damage);
    this.callbacks.onHealthChange(-damage);

    // Screen shake effect
    this.triggerDamageShake(damage);
    this.callbacks.onNotification('TAKING DAMAGE!', 500);

    // Check for player death
    if (this.suitIntegrity <= 0) {
      this.callbacks.onNotification('SUIT INTEGRITY CRITICAL - KIA', 3000);
      // Would trigger game over / level restart
    }
  }

  /**
   * Handle enemy death
   */
  private onEnemyKilled(enemy: SurfaceEnemy, _index: number): void {
    this.killCount++;
    this.enemyCount--;

    // Emit alien death particle effect
    particleManager.emitAlienDeath(enemy.mesh.position.clone(), 1.2);

    // Play alien death sound
    getAudioManager().play('enemy_death', { volume: 0.5 });

    // Kill feedback
    this.callbacks.onKill();

    // Use first encounter count for display if in first encounter
    const totalEnemies =
      this.firstEncounterEnemyCount > 0 ? this.firstEncounterEnemyCount : this.maxSurfaceEnemies;
    this.callbacks.onNotification(`HOSTILE DOWN [${this.killCount}/${totalEnemies}]`, 800);

    // Death animation - shrink and fade
    const deathStart = performance.now();
    const animateDeath = () => {
      const elapsed = performance.now() - deathStart;
      const progress = Math.min(elapsed / 500, 1);

      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        enemy.mesh.scaling.setAll((1 - progress) * SURFACE_ENEMY_SCALE);

        if (progress >= 1) {
          enemy.mesh.dispose();
        } else {
          requestAnimationFrame(animateDeath);
        }
      }
    };
    requestAnimationFrame(animateDeath);
  }

  /**
   * Called when all enemies are cleared
   */
  private onCombatCleared(): void {
    this.surfaceCombatActive = false;
    this.tutorialSlowdownActive = false;
    this.callbacks.onCombatStateChange(false);

    // Stop combat music and return to ambient
    getAudioManager().exitCombat();

    // Victory notification sequence
    this.callbacks.onNotification('ALL HOSTILES ELIMINATED', 2000);

    // Brief pause then celebration
    setTimeout(() => {
      this.callbacks.onNotification('FIRST BLOOD - SURFACE COMBAT COMPLETE', 2500);
      // Track first combat achievement
      getAchievementManager().onFirstCombatWin();
    }, 2500);

    // Comms message with debrief
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: `Impressive, Sergeant. ${this.killCount} Chitin Drones neutralized. You handled that ambush well.`,
      });
    }, 3000);

    // Update objective to show LZ marker
    setTimeout(() => {
      this.callbacks.onObjectiveUpdate(
        'SECURE THE LANDING ZONE',
        'Proceed to the LZ pad. Watch for stragglers.'
      );

      // Visual indicator pointing to LZ
      if (this.lzPad) {
        // Make LZ beacon visible and pulsing
        if (this.lzBeacon) {
          this.lzBeacon.isVisible = true;
          const mat = this.lzBeacon.material as StandardMaterial;
          mat.emissiveColor = new Color3(0.2, 1, 0.3);

          // Pulsing animation
          const pulseStart = performance.now();
          const animatePulse = () => {
            if (!this.lzBeacon || this.lzBeacon.isDisposed()) return;
            const elapsed = performance.now() - pulseStart;
            mat.alpha = 0.3 + Math.sin(elapsed * 0.005) * 0.15;
            if (this.surfaceCombatActive === false) {
              requestAnimationFrame(animatePulse);
            }
          };
          requestAnimationFrame(animatePulse);
        }
      }
    }, 5000);

    // Final comms and level complete
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'LZ secured. FOB Delta is expecting you. This was just the beginning, Sergeant.',
      });
      this.callbacks.onObjectiveUpdate(
        'PROCEED TO FOB DELTA',
        'LZ secure. Move out. Waypoint set.'
      );
      this.updateActionButtons('none');

      // Show FOB Delta marker
      this.showFOBDeltaMarker();
    }, 8000);

    // Complete level after short delay
    setTimeout(() => {
      this.completeLevel();
    }, 12000);
  }

  /**
   * Shows the FOB Delta objective marker with pulsing animation.
   * Called after combat is cleared to guide player to next objective.
   */
  private showFOBDeltaMarker(): void {
    // Show FOB Delta beacon
    if (this.fobDeltaBeacon) {
      this.fobDeltaBeacon.isVisible = true;

      // Pulsing animation for beacon
      const beaconMat = this.fobDeltaBeacon.material as StandardMaterial;
      const pulseStart = performance.now();
      const animateBeacon = () => {
        if (!this.fobDeltaBeacon || this.fobDeltaBeacon.isDisposed()) return;
        const elapsed = performance.now() - pulseStart;
        const pulse = 0.4 + Math.sin(elapsed * 0.003) * 0.2;
        beaconMat.alpha = pulse;
        requestAnimationFrame(animateBeacon);
      };
      requestAnimationFrame(animateBeacon);
    }

    // Show ground marker
    if (this.fobDeltaMarker) {
      this.fobDeltaMarker.isVisible = true;

      // Spinning animation for ground marker
      const spinStart = performance.now();
      const animateSpin = () => {
        if (!this.fobDeltaMarker || this.fobDeltaMarker.isDisposed()) return;
        const elapsed = performance.now() - spinStart;
        this.fobDeltaMarker.rotation.z = elapsed * 0.001;
        requestAnimationFrame(animateSpin);
      };
      requestAnimationFrame(animateSpin);
    }

    // Add comms message about FOB Delta
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'I have marked FOB Delta on your HUD. The base went dark 36 hours ago. Proceed with caution, Sergeant.',
      });
    }, 2000);
  }

  /**
   * Primary fire - ranged weapon attack
   */
  private firePrimaryWeapon(): void {
    if (this.primaryFireCooldown > 0) return;
    if (!this.isPointerLocked()) return;

    // Only allow shooting during surface combat
    if (this.phase !== 'surface' || !this.surfaceCombatActive) return;

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
    let closestEnemy: SurfaceEnemy | null = null;
    let closestDist = this.PRIMARY_FIRE_RANGE;

    for (const enemy of this.surfaceEnemies) {
      if (enemy.health <= 0) continue;

      // Simple ray-sphere intersection approximation
      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dot = Vector3.Dot(toEnemy, forward);

      if (dot > 0 && dot < this.PRIMARY_FIRE_RANGE) {
        // Check perpendicular distance to ray
        const proj = forward.scale(dot);
        const perpDist = toEnemy.subtract(proj).length();

        if (perpDist < 1.5 && dot < closestDist) {
          closestEnemy = enemy;
          closestDist = dot;
        }
      }
    }

    // Visual feedback - muzzle flash
    const flashPos = playerPos.add(forward.scale(0.5));
    particleManager.emitMuzzleFlash(flashPos, forward);

    // Point light flash for additional impact
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

    // Apply damage if we hit an enemy
    if (closestEnemy) {
      closestEnemy.health -= this.PRIMARY_FIRE_DAMAGE;

      // Visual hit feedback - flash red
      this.flashEnemyRed(closestEnemy.mesh);

      // Emit blood/splatter particle effect
      particleManager.emitAlienSplatter(closestEnemy.mesh.position, 0.8);

      this.callbacks.onNotification('HIT!', 300);

      // Check for kill
      if (closestEnemy.health <= 0) {
        const index = this.surfaceEnemies.indexOf(closestEnemy);
        this.onEnemyKilled(closestEnemy, index);
      }
    }
  }

  /**
   * Flash an enemy mesh red when hit
   */
  private flashEnemyRed(mesh: Mesh | TransformNode): void {
    // For a direct Mesh with material
    if ('material' in mesh && mesh.material instanceof StandardMaterial) {
      const mat = mesh.material as StandardMaterial;
      const originalColor = mat.diffuseColor.clone();
      mat.diffuseColor = new Color3(1, 0.2, 0.2);

      setTimeout(() => {
        try {
          mat.diffuseColor = originalColor;
        } catch {
          // Material was disposed, ignore
        }
      }, 100);
    }

    // For TransformNode (GLB instance), find child meshes
    if (mesh instanceof TransformNode) {
      const childMeshes = mesh.getChildMeshes();
      for (const child of childMeshes) {
        if (child.material instanceof StandardMaterial) {
          const mat = child.material as StandardMaterial;
          const originalColor = mat.diffuseColor.clone();
          mat.diffuseColor = new Color3(1, 0.2, 0.2);

          setTimeout(() => {
            try {
              mat.diffuseColor = originalColor;
            } catch {
              // Material was disposed, ignore
            }
          }, 100);
        }
      }
    }
  }

  /**
   * Melee attack - close range, high damage
   */
  private performMeleeAttack(): void {
    if (this.meleeCooldown > 0) return;
    if (this.phase !== 'surface' || !this.surfaceCombatActive) return;

    this.meleeCooldown = this.MELEE_COOLDOWN;
    this.callbacks.onNotification('MELEE!', 500);

    const playerPos = this.camera.position;
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // Attack position is in front of the player
    const attackPos = playerPos.add(forward.scale(this.MELEE_RANGE / 2));

    // Damage enemies in melee range
    let hitAny = false;

    for (const enemy of this.surfaceEnemies) {
      if (enemy.health <= 0) continue;

      const dist = Vector3.Distance(attackPos, enemy.mesh.position);
      if (dist < this.MELEE_RANGE) {
        enemy.health -= this.MELEE_DAMAGE;
        hitAny = true;

        // Emit blood/splatter particle effect
        particleManager.emitAlienSplatter(enemy.mesh.position, 1.0);

        // Visual hit feedback - flash red
        this.flashEnemyRed(enemy.mesh);

        // Check for kill
        if (enemy.health <= 0) {
          const index = this.surfaceEnemies.indexOf(enemy);
          this.onEnemyKilled(enemy, index);
        }
      }
    }

    if (hitAny) {
      this.callbacks.onNotification('HIT!', 300);
      this.callbacks.onKill(); // Trigger hit feedback
    }
  }

  /**
   * Handle reload action
   */
  private handleReload(): void {
    if (this.phase !== 'surface' || !this.surfaceCombatActive) return;

    const weaponState = getWeaponActions()?.getState();
    if (!weaponState) return;

    if (weaponState.isReloading) return;
    if (weaponState.currentAmmo >= weaponState.maxMagazineSize) return;
    if (weaponState.reserveAmmo <= 0) {
      this.callbacks.onNotification('NO RESERVE AMMO', 800);
      return;
    }

    startReload();
    this.callbacks.onNotification('RELOADING...', 1500);
  }

  /**
   * Handle keyboard input during surface combat
   */
  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Get configured keybindings
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');
    const fireKeys = this.inputTracker.getAllKeysForAction('fire');

    // Handle melee attack (level-specific combat action, using V key)
    if (e.code === 'KeyV') {
      this.performMeleeAttack();
    }

    // Handle reload action (configurable keybinding, default: R)
    if (reloadKeys.includes(e.code)) {
      this.handleReload();
    }

    // Handle fire action for non-mouse bindings
    const nonMouseFireKeys = fireKeys.filter((k) => !k.startsWith('Mouse'));
    if (nonMouseFireKeys.includes(e.code)) {
      this.firePrimaryWeapon();
    }
  }

  /**
   * Handle mouse click for firing
   */
  protected override handleClick(): void {
    super.handleClick();

    // Fire weapon when pointer is locked (in game)
    if (this.isPointerLocked()) {
      this.firePrimaryWeapon();
    }
  }

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'fob_delta' && this.phase === 'surface';
  }

  protected disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    this.planet?.dispose();
    this.planetAtmosphere?.dispose();
    this.starfield?.dispose();
    this.leftArm?.dispose();
    this.rightArm?.dispose();
    this.leftGlove?.dispose();
    this.rightGlove?.dispose();
    this.visorFrame?.dispose();
    this.leftHandle?.dispose();
    this.rightHandle?.dispose();
    this.thrusterGlow?.dispose();
    this.plasmaGlow?.dispose();
    this.lzPad?.dispose();
    this.lzBeacon?.dispose();
    this.terrain?.dispose();
    this.skyDome?.dispose();
    this.canyonWalls.forEach((w) => w.dispose());

    // Dispose asteroids and their trails
    this.asteroids.forEach((a) => {
      if (a.trail) {
        a.trail.stop();
        a.trail.dispose();
      }
      a.mesh.dispose();
    });
    this.asteroids = [];

    // Dispose Anchor Station
    this.stationRing?.dispose();
    this.stationHub?.dispose();
    this.stationDropBay?.dispose();
    this.stationSolarPanels.forEach((p) => p.dispose());
    this.stationLights.forEach((l) => l.dispose());
    this.anchorStation?.dispose();
    this.stationSolarPanels = [];
    this.stationLights = [];

    // Dispose distant threats
    for (const threat of this.distantThreats) {
      threat.node.dispose();
    }
    this.distantThreats = [];

    // Dispose surface combat enemies
    for (const enemy of this.surfaceEnemies) {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        enemy.mesh.dispose();
      }
    }
    this.surfaceEnemies = [];

    // Dispose environment hazards
    for (const pool of this.acidPools) {
      if (pool && !pool.isDisposed()) {
        pool.dispose();
      }
    }
    this.acidPools = [];

    for (const terrain of this.unstableTerrain) {
      if (terrain && !terrain.isDisposed()) {
        terrain.dispose();
      }
    }
    this.unstableTerrain = [];

    // Dispose FOB Delta markers
    this.fobDeltaMarker?.dispose();
    this.fobDeltaBeacon?.dispose();
    this.fobDeltaMarker = null;
    this.fobDeltaBeacon = null;

    // Dispose particle systems
    this.reentryParticles?.dispose();
    this.reentryParticles = null;
    this.playerSmokeTrail?.dispose();
    this.playerSmokeTrail = null;
    this.atmosphereStreaks?.dispose();
    this.atmosphereStreaks = null;
    this.thrusterExhaustParticles?.dispose();
    this.thrusterExhaustParticles = null;

    // Dispose particle texture
    this.particleTexture?.dispose();
    this.particleTexture = null;

    // Dispose heat distortion mesh
    this.heatDistortion?.dispose();
    this.heatDistortion = null;

    // Dispose wind streaks
    for (const streak of this.windStreaks) {
      streak.dispose();
    }
    this.windStreaks = [];
  }
}
