/**
 * LandfallLevel Orchestrator - INTERACTIVE HALO Jump with Precision Landing
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
import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Animations/animatable';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';

import { getAchievementManager } from '../../achievements';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import { buildFloraFromPlacements, getLandfallFlora } from '../shared/AlienFloraBuilder';
import { buildCollectibles, type CollectibleSystemResult, getLandfallCollectibles } from '../shared/CollectiblePlacer';
import { createDynamicTerrain, ROCK_TERRAIN } from '../shared/SurfaceTerrainFactory';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import {
  buildLandfallEnvironment,
  setEnvironmentVisible,
  disposeEnvironment,
  type LandfallEnvironmentNodes,
} from './LandfallEnvironment';

// Import modular components
import type { DropPhase, LandingOutcome, Asteroid, DistantThreat, SurfaceEnemy } from './types';
import {
  ALL_LANDFALL_GLB_PATHS,
  SURFACE_GLB_PATHS,
  ARENA_GLB_PATHS,
  FREEFALL_FOV,
  POWERED_DESCENT_FOV,
  SURFACE_FOV,
  MIN_PLAYER_HEIGHT,
  TERRAIN_BOUNDS,
  MAX_FUEL,
  FUEL_BURN_RATE,
  FUEL_REGEN_RATE,
  SURFACE_ENEMY_SPECIES,
  FIRST_ENCOUNTER_ENEMY_COUNT,
  TUTORIAL_SLOWDOWN_DURATION,
} from './constants';
import * as comms from './comms';
import {
  createParticleTexture,
  spawnAsteroid,
  createReentryParticles,
  createPlayerSmokeTrail,
  createAtmosphereStreaks,
  createThrusterExhaust,
  createWindStreaks,
  DISTANT_THREAT_DEFINITIONS,
  spawnDistantThreat,
  updateDistantThreat,
} from './halo-drop';
import {
  spawnFirstEncounterEnemy,
  createAcidPools,
  createUnstableTerrain,
} from './surface-combat';
import {
  createAnchorStation,
  updateAnchorStation,
  disposeAnchorStation,
  type AnchorStationNodes,
} from './station';

// Import new modular components
import * as Descent from './descent';
import * as Combat from './combat';
import { updateVisualEffects, stopAllDescentEffects, disposeDescentEffects, type DescentEffects } from './visual-effects';

export class LandfallLevel extends BaseLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Phase management
  private phase: DropPhase = 'freefall_start';
  private phaseTime = 0;

  // Descent metrics
  private altitude = 1000;
  private velocity = 10;
  private lateralVelocityX = 0;
  private lateralVelocityZ = 0;

  // FOV management
  private targetFOV = FREEFALL_FOV;
  private currentFOV = FREEFALL_FOV;

  // Fuel
  private fuel = MAX_FUEL;

  // Position relative to LZ
  private positionX = 0;
  private positionZ = 0;

  // Environment elements
  private planet: Mesh | null = null;
  private planetAtmosphere: Mesh | null = null;
  private starfield: Mesh | null = null;
  private leftArm: Mesh | null = null;
  private rightArm: Mesh | null = null;
  private leftGlove: Mesh | null = null;
  private rightGlove: Mesh | null = null;
  private visorFrame: Mesh | null = null;
  private leftHandle: Mesh | null = null;
  private rightHandle: Mesh | null = null;
  private thrusterGlow: Mesh | null = null;
  private plasmaGlow: Mesh | null = null;
  private heatDistortion: Mesh | null = null;
  private lzPad: TransformNode | null = null;
  private lzBeacon: Mesh | null = null;
  private terrain: Mesh | null = null;
  private canyonWalls: TransformNode[] = [];
  private skyDome: Mesh | null = null;
  private coverObjects: (Mesh | TransformNode)[] = [];
  private glbEnvironment: LandfallEnvironmentNodes | null = null;

  // Anchor Station
  private anchorStation: AnchorStationNodes | null = null;

  // Asteroids
  private asteroids: Asteroid[] = [];
  private asteroidSpawnTimer = 0;
  private asteroidSpawnRate = 0.35;
  private asteroidsSpawned = 0;

  // Stats
  private suitIntegrity = 100;
  private asteroidsHit = 0;
  private asteroidsDodged = 0;

  // Particle effects
  private reentryParticles: ParticleSystem | null = null;
  private playerSmokeTrail: ParticleSystem | null = null;
  private atmosphereStreaks: ParticleSystem | null = null;
  private thrusterExhaustParticles: ParticleSystem | null = null;
  private particleTexture: Texture | null = null;
  private windStreaks: Mesh[] = [];
  private windIntensity = 0;

  // Near-miss feedback
  private nearMissTimer = 0;

  // Distant threats
  private distantThreats: DistantThreat[] = [];
  private threatsSpawned = false;

  // Landing outcome
  private landingOutcome: LandingOutcome = 'perfect';

  // Action callback
  private actionCallback: ((actionId: string) => void) | null = null;

  // Surface combat
  private surfaceEnemies: SurfaceEnemy[] = [];
  private combatState = Combat.createCombatState();
  private surfaceEnemiesPreloaded = false;

  // Environment hazards
  private acidPools: Mesh[] = [];
  private unstableTerrain: Mesh[] = [];

  // FOB Delta marker
  private fobDeltaMarker: Mesh | null = null;
  private fobDeltaBeacon: Mesh | null = null;
  private fobDeltaPosition = new Vector3(0, 0, -150);

  // Combat tutorial
  private hasShownMovementTutorial = false;
  private hasShownAimingTutorial = false;
  private hasShownReloadTutorial = false;
  private hasShownCoverTutorial = false;
  private combatTutorialActive = false;

  constructor(engine: Engine, canvas: HTMLCanvasElement, config: LevelConfig, callbacks: LevelCallbacks) {
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
    // Start looking DOWN with wide cinematic FOV
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.x = Math.PI / 2;
    this.rotationX = Math.PI / 2;
    this.rotationY = 0;
    this.camera.fov = FREEFALL_FOV;
    this.currentFOV = FREEFALL_FOV;
    this.targetFOV = FREEFALL_FOV;

    // Initialize assets
    AssetManager.init(this.scene);
    await this.preloadAssets();

    // Create environment elements
    this.createStarfield();
    this.createPlanet();
    this.anchorStation = createAnchorStation(this.scene);
    this.createFreefallView();
    this.createPoweredDescentView();
    this.createEntryEffects();
    this.createLandingZone();
    this.createSurface();

    await this.preloadDistantThreats();
    particleManager.init(this.scene);
    await this.preloadSurfaceEnemyModels();

    this.glbEnvironment = await buildLandfallEnvironment(this.scene);
    this.setPoweredDescentVisible(false);

    // Build flora and collectibles
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getLandfallFlora(), floraRoot);
    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getLandfallCollectibles(), collectibleRoot);

    this.startJump();
  }

  private async preloadAssets(): Promise<void> {
    const results = await Promise.allSettled(
      ALL_LANDFALL_GLB_PATHS.map((path) => AssetManager.loadAssetByPath(path, this.scene))
    );
    const loaded = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    console.log(`[Landfall] Preloaded ${loaded}/${ALL_LANDFALL_GLB_PATHS.length} GLBs`);
  }

  private async preloadSurfaceEnemyModels(): Promise<void> {
    const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];
    if (!assetName) return;
    try {
      await AssetManager.loadAsset('aliens', assetName, this.scene);
      this.surfaceEnemiesPreloaded = true;
    } catch (error) {
      console.warn('[Landfall] Failed to preload surface enemy GLB:', error);
    }
  }

  private async preloadDistantThreats(): Promise<void> {
    try {
      await Promise.all([
        AssetManager.loadAsset('vehicles', 'wraith', this.scene),
        AssetManager.loadAsset('vehicles', 'phantom', this.scene),
      ]);
    } catch (error) {
      console.warn('[Landfall] Could not preload vehicle models:', error);
    }
  }

  private createStarfield(): void {
    this.starfield = MeshBuilder.CreateSphere('stars', { diameter: 8000, segments: 16, sideOrientation: 1 }, this.scene);
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

    this.planetAtmosphere = MeshBuilder.CreateSphere('atmos', { diameter: 90, segments: 32 }, this.scene);
    const atmosMat = new StandardMaterial('atmosMat', this.scene);
    atmosMat.emissiveColor = new Color3(0.9, 0.6, 0.4);
    atmosMat.alpha = 0.15;
    atmosMat.backFaceCulling = false;
    this.planetAtmosphere.material = atmosMat;
    this.planetAtmosphere.position.copyFrom(this.planet.position);
  }

  private createFreefallView(): void {
    const armMat = new StandardMaterial('armMat', this.scene);
    armMat.diffuseColor = new Color3(0.15, 0.15, 0.18);

    this.leftArm = MeshBuilder.CreateCylinder('leftArm', { height: 3, diameterTop: 0.25, diameterBottom: 0.3 }, this.scene);
    this.leftArm.material = armMat;
    this.leftArm.position.set(-1.8, -2.5, 0);

    this.rightArm = MeshBuilder.CreateCylinder('rightArm', { height: 3, diameterTop: 0.25, diameterBottom: 0.3 }, this.scene);
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

    this.visorFrame = MeshBuilder.CreateTorus('visor', { diameter: 10, thickness: 0.3 }, this.scene);
    const visorMat = new StandardMaterial('visorMat', this.scene);
    visorMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
    visorMat.alpha = 0.6;
    this.visorFrame.material = visorMat;
    this.visorFrame.rotation.x = Math.PI / 2;
    this.visorFrame.position.y = -2;
  }

  private createPoweredDescentView(): void {
    const handleMat = new StandardMaterial('handleMat', this.scene);
    handleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);

    this.leftHandle = MeshBuilder.CreateCylinder('leftHandle', { height: 0.8, diameter: 0.12 }, this.scene);
    this.leftHandle.material = handleMat;
    this.leftHandle.position.set(-0.6, -0.3, 0.5);
    this.leftHandle.rotation.z = Math.PI / 2;

    this.rightHandle = MeshBuilder.CreateCylinder('rightHandle', { height: 0.8, diameter: 0.12 }, this.scene);
    this.rightHandle.material = handleMat;
    this.rightHandle.position.set(0.6, -0.3, 0.5);
    this.rightHandle.rotation.z = Math.PI / 2;

    this.thrusterGlow = MeshBuilder.CreateDisc('thrusterGlow', { radius: 0.8 }, this.scene);
    const thrusterMat = new StandardMaterial('thrusterMat', this.scene);
    thrusterMat.emissiveColor = new Color3(0.3, 0.5, 1);
    thrusterMat.alpha = 0;
    thrusterMat.disableLighting = true;
    this.thrusterGlow.material = thrusterMat;
    this.thrusterGlow.position.set(0, -1, 1);
    this.thrusterGlow.rotation.x = Math.PI / 2;
  }

  private createEntryEffects(): void {
    this.particleTexture = createParticleTexture(this.scene);

    this.plasmaGlow = MeshBuilder.CreateTorus('plasma', { diameter: 12, thickness: 2 }, this.scene);
    const plasmaMat = new StandardMaterial('plasmaMat', this.scene);
    plasmaMat.emissiveColor = new Color3(1, 0.5, 0.15);
    plasmaMat.alpha = 0;
    plasmaMat.disableLighting = true;
    this.plasmaGlow.material = plasmaMat;
    this.plasmaGlow.rotation.x = Math.PI / 2;
    this.plasmaGlow.position.y = -3;

    this.heatDistortion = MeshBuilder.CreateSphere('heatDistortion', { diameter: 8, segments: 16 }, this.scene);
    const heatMat = new StandardMaterial('heatMat', this.scene);
    heatMat.emissiveColor = new Color3(1, 0.4, 0.1);
    heatMat.alpha = 0;
    heatMat.disableLighting = true;
    heatMat.backFaceCulling = false;
    this.heatDistortion.material = heatMat;
    this.heatDistortion.position.y = -4;

    this.reentryParticles = createReentryParticles(this.scene, this.particleTexture);
    this.playerSmokeTrail = createPlayerSmokeTrail(this.scene, this.particleTexture);
    this.atmosphereStreaks = createAtmosphereStreaks(this.scene, this.particleTexture);
    this.windStreaks = createWindStreaks(this.scene);
  }

  private createLandingZone(): void {
    const lzPadNode = AssetManager.createInstanceByPath(SURFACE_GLB_PATHS.lzPadAsphalt, 'lzPad', this.scene, true, 'environment');
    if (!lzPadNode) throw new Error(`[LandfallLevel] Failed to create LZ pad`);
    lzPadNode.scaling.set(2, 1, 2);
    lzPadNode.position.set(0, 0.05, 0);
    lzPadNode.setEnabled(false);
    this.lzPad = lzPadNode;

    this.lzBeacon = MeshBuilder.CreateCylinder('beacon', { height: 20, diameter: 2 }, this.scene);
    const beaconMat = new StandardMaterial('beaconMat', this.scene);
    beaconMat.emissiveColor = new Color3(0.2, 1, 0.3);
    beaconMat.alpha = 0.3;
    this.lzBeacon.material = beaconMat;
    this.lzBeacon.position.y = 10;
    this.lzBeacon.isVisible = false;
  }

  private createSurface(): void {
    const { mesh } = createDynamicTerrain(this.scene, { ...ROCK_TERRAIN, size: 600, materialName: 'landfallTerrain' });
    this.terrain = mesh;
    this.terrain.isVisible = false;

    const wallGlbPaths = [SURFACE_GLB_PATHS.wallRg1, SURFACE_GLB_PATHS.wallRg15, SURFACE_GLB_PATHS.wallHs1, SURFACE_GLB_PATHS.wallHs15];
    const wallPositions = [{ x: -70, z: -50, rotY: 0 }, { x: 70, z: -50, rotY: Math.PI }, { x: -80, z: -80, rotY: 0 }, { x: 80, z: -80, rotY: Math.PI }];

    for (let i = 0; i < 4; i++) {
      const wallNode = AssetManager.createInstanceByPath(wallGlbPaths[i], `canyonWall_${i}`, this.scene, true, 'environment');
      if (!wallNode) throw new Error(`[LandfallLevel] Failed to create canyon wall`);
      wallNode.scaling.set(8, 15, 25);
      wallNode.position.set(wallPositions[i].x, 50, wallPositions[i].z);
      wallNode.rotation.y = wallPositions[i].rotY;
      wallNode.setEnabled(false);
      this.canyonWalls.push(wallNode);
    }

    this.createCombatArenaCover();
    this.acidPools = createAcidPools(this.scene);
    this.unstableTerrain = createUnstableTerrain(this.scene);
    this.createFOBDeltaMarker();

    this.skyDome = MeshBuilder.CreateSphere('sky', { diameter: 5000, segments: 16, sideOrientation: 1 }, this.scene);
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.75, 0.5, 0.35);
    skyMat.disableLighting = true;
    this.skyDome.material = skyMat;
    this.skyDome.isVisible = false;
  }

  private createCombatArenaCover(): void {
    const rockGlbs = [ARENA_GLB_PATHS.boulderA, ARENA_GLB_PATHS.rockMedA, ARENA_GLB_PATHS.rockMedB, ARENA_GLB_PATHS.rockMedC];
    const rockPositions = [
      { pos: new Vector3(15, 0, 20), scale: new Vector3(2.5, 2.5, 3), rotY: 0.3 },
      { pos: new Vector3(-18, 0, 15), scale: new Vector3(2, 2, 2.5), rotY: -0.5 },
      { pos: new Vector3(8, 0, 35), scale: new Vector3(1.8, 1.8, 2), rotY: 0.8 },
      { pos: new Vector3(-10, 0, 30), scale: new Vector3(1.5, 1.2, 1.5), rotY: 1.2 },
    ];

    for (let i = 0; i < rockPositions.length; i++) {
      const r = rockPositions[i];
      const node = AssetManager.createInstanceByPath(rockGlbs[i], `rock_${i}`, this.scene, true, 'prop');
      if (node) {
        node.position = r.pos;
        node.rotation = new Vector3(0, r.rotY, 0);
        node.scaling = r.scale;
        node.setEnabled(false);
        this.coverObjects.push(node);
      }
    }

    const crashedHull = AssetManager.createInstanceByPath(ARENA_GLB_PATHS.shippingContainer, 'crashedHull', this.scene, true, 'prop');
    if (crashedHull) {
      crashedHull.position.set(0, 0, 25);
      crashedHull.rotation.set(0, 0.4, Math.PI / 6);
      crashedHull.scaling.setAll(1.5);
      crashedHull.setEnabled(false);
      this.coverObjects.push(crashedHull);
    }
  }

  private createFOBDeltaMarker(): void {
    const markerMat = new StandardMaterial('fobMarkerMat', this.scene);
    markerMat.emissiveColor = new Color3(0.2, 0.6, 1.0);
    markerMat.alpha = 0.6;
    markerMat.disableLighting = true;

    this.fobDeltaBeacon = MeshBuilder.CreateCylinder('fobDeltaBeacon', { height: 50, diameter: 3, tessellation: 8 }, this.scene);
    this.fobDeltaBeacon.material = markerMat;
    this.fobDeltaBeacon.position = this.fobDeltaPosition.clone();
    this.fobDeltaBeacon.position.y = 25;
    this.fobDeltaBeacon.isVisible = false;

    this.fobDeltaMarker = MeshBuilder.CreateTorus('fobDeltaMarker', { diameter: 8, thickness: 0.5, tessellation: 24 }, this.scene);
    const groundMat = new StandardMaterial('fobGroundMat', this.scene);
    groundMat.diffuseColor = Color3.FromHexString('#4080C0');
    groundMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
    this.fobDeltaMarker.material = groundMat;
    this.fobDeltaMarker.position = this.fobDeltaPosition.clone();
    this.fobDeltaMarker.position.y = 0.2;
    this.fobDeltaMarker.rotation.x = Math.PI / 2;
    this.fobDeltaMarker.isVisible = false;
  }

  private startJump(): void {
    this.phase = 'freefall_start';
    this.altitude = 1000;
    this.velocity = 10;
    this.phaseTime = 0;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onNotification('HALO JUMP INITIATED', 3000);

    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    setTimeout(() => comms.sendClearOfStationMessage(this.callbacks), 1500);
    setTimeout(() => this.transitionToPhase('freefall_belt'), 4000);
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
          this.fuel -= FUEL_BURN_RATE * 0.016;
          this.showThrusterGlow(0.8);
        }
        break;
      case 'stabilize':
        if (this.phase === 'powered_descent' && this.fuel > 5) {
          this.lateralVelocityX *= 0.8;
          this.lateralVelocityZ *= 0.8;
          this.fuel -= 5;
        }
        break;
      case 'grenade':
        if (this.phase === 'surface' && this.combatState.surfaceCombatActive) this.throwGrenade();
        break;
      case 'melee':
        if (this.phase === 'surface' && this.combatState.surfaceCombatActive) this.performMeleeAttack();
        break;
    }
  }

  private transitionToPhase(newPhase: DropPhase): void {
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'freefall_belt':
        this.callbacks.onNotification('ENTERING DEBRIS FIELD', 2000);
        this.callbacks.onObjectiveUpdate('NAVIGATE DEBRIS', 'WASD: Body position | Dodge asteroids');
        this.setBaseShake(0.3);
        break;
      case 'freefall_clear':
        this.callbacks.onNotification('DEBRIS FIELD CLEARED', 2000);
        comms.sendDebrisClearedMessage(this.callbacks);
        this.updateActionButtons('ignite');
        break;
      case 'powered_descent':
        this.callbacks.onNotification('JETS IGNITED', 2000);
        comms.sendJetsIgnitedMessage(this.callbacks);
        this.targetFOV = POWERED_DESCENT_FOV;
        this.switchToPoweredDescent();
        this.updateActionButtons('descent');
        break;
      case 'landing':
        this.callbacks.onNotification('FINAL APPROACH', 2000);
        this.setBaseShake(2);
        break;
      case 'surface':
        this.completeLanding();
        this.setupSurfaceEnvironmentalAudio();
        break;
    }
  }

  private showThrusterGlow(intensity: number): void {
    if (this.thrusterGlow?.material) {
      (this.thrusterGlow.material as StandardMaterial).alpha = intensity;
    }
  }

  private setFreefallVisible(visible: boolean): void {
    [this.leftArm, this.rightArm, this.leftGlove, this.rightGlove, this.visorFrame].forEach(
      (m) => { if (m) m.isVisible = visible; }
    );
  }

  private setPoweredDescentVisible(visible: boolean): void {
    [this.leftHandle, this.rightHandle, this.thrusterGlow].forEach(
      (m) => { if (m) m.isVisible = visible; }
    );
  }

  private switchToPoweredDescent(): void {
    this.setFreefallVisible(false);
    this.setPoweredDescentVisible(true);

    const rotationAnim = new Animation('cameraRotationTransition', 'rotation.x', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rotationAnim.setEasingFunction(easing);
    rotationAnim.setKeys([{ frame: 0, value: this.camera.rotation.x }, { frame: 60, value: 0.3 }]);

    this.camera.animations = [rotationAnim];
    this.scene.beginAnimation(this.camera, 0, 60, false, 1, () => {
      this.camera.rotation.x = 0.3;
      this.rotationX = 0.3;
    });

    this.rotationY = 0;
    this.camera.rotation.y = 0;

    if (this.lzPad) this.lzPad.setEnabled(true);
    if (this.lzBeacon) this.lzBeacon.isVisible = true;
    if (this.terrain) this.terrain.isVisible = true;

    this.scene.clearColor = new Color4(0.5, 0.3, 0.2, 1);

    if (this.particleTexture) {
      this.thrusterExhaustParticles = createThrusterExhaust(this.scene, this.particleTexture);
    }
  }

  private updateActionButtons(mode: 'ignite' | 'descent' | 'combat' | 'none'): void {
    let groups: ActionButtonGroup[] = [];
    const jets = levelActionParams('igniteJets');
    const boost = levelActionParams('boost');
    const stabilize = levelActionParams('stabilize');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');

    switch (mode) {
      case 'ignite':
        groups = [{ id: 'ignite', label: 'RETROS', position: 'right', buttons: [
          createAction('ignite_jets', 'IGNITE JETS', jets.key, { keyDisplay: jets.keyDisplay, variant: 'danger', size: 'large', highlighted: true }),
        ]}];
        break;
      case 'descent':
        groups = [{ id: 'descent', label: 'THRUSTERS', position: 'right', buttons: [
          createAction('boost', 'BOOST', boost.key, { keyDisplay: boost.keyDisplay, variant: 'primary', size: 'large' }),
          createAction('stabilize', 'STABILIZE', stabilize.key, { keyDisplay: stabilize.keyDisplay, variant: 'secondary' }),
        ]}];
        break;
      case 'combat':
        groups = [{ id: 'combat', label: 'COMBAT', position: 'right', buttons: [
          createAction('grenade', 'GRENADE', grenade.key, { keyDisplay: grenade.keyDisplay, variant: 'danger', cooldown: 5000 }),
          createAction('melee', 'MELEE', melee.key, { keyDisplay: melee.keyDisplay, variant: 'primary' }),
        ]}];
        break;
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  private setupSurfaceEnvironmentalAudio(): void {
    this.addSpatialSound('wind_canyon1', 'wind_howl', { x: 50, y: 10, z: 0 }, { maxDistance: 40, volume: 0.5 });
    this.addAudioZone('zone_surface', 'surface', { x: 0, y: 0, z: 0 }, 150, { isIndoor: false, intensity: 0.6 });
  }

  protected override processMovement(deltaTime: number): void {
    const input: Descent.MovementInput = {
      moveLeft: this.inputTracker.isActionActive('moveLeft'),
      moveRight: this.inputTracker.isActionActive('moveRight'),
      moveForward: this.inputTracker.isActionActive('moveForward'),
      moveBackward: this.inputTracker.isActionActive('moveBackward'),
      fire: this.inputTracker.isActionActive('fire'),
      reload: this.inputTracker.isActionActive('reload'),
    };

    if (this.phase === 'freefall_belt' || this.phase === 'freefall_start') {
      const result = Descent.processFreefallMovement(input, this.lateralVelocityX, this.lateralVelocityZ, deltaTime);
      this.lateralVelocityX = result.lateralVelocityX;
      this.lateralVelocityZ = result.lateralVelocityZ;
    } else if (this.phase === 'powered_descent') {
      const result = Descent.processPoweredDescentMovement(input, this.lateralVelocityX, this.lateralVelocityZ, this.velocity, this.fuel, FUEL_BURN_RATE, deltaTime);
      this.lateralVelocityX = result.lateralVelocityX;
      this.lateralVelocityZ = result.lateralVelocityZ;
      this.velocity = result.velocity;
      this.fuel = result.fuel;
      this.showThrusterGlow(result.thrusterGlowIntensity);
    }

    this.positionX += this.lateralVelocityX * deltaTime;
    this.positionZ += this.lateralVelocityZ * deltaTime;
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) this.collectibleSystem.collect(nearby.id);
    }

    // FOV interpolation
    if (Math.abs(this.currentFOV - this.targetFOV) > 0.01) {
      this.currentFOV += (this.targetFOV - this.currentFOV) * 2.0 * deltaTime;
      this.camera.fov = this.currentFOV;
    }

    // Gravity / descent
    if (this.phase !== 'surface') {
      if (this.phase === 'powered_descent' || this.phase === 'landing') {
        this.velocity = Math.min(100, this.velocity + 15 * deltaTime);
      } else {
        this.velocity = Math.min(80, this.velocity + 8 * deltaTime);
      }
      this.altitude -= this.velocity * deltaTime;

      if (this.phase === 'powered_descent') {
        this.fuel = Math.min(MAX_FUEL, this.fuel + FUEL_REGEN_RATE * deltaTime * 0.1);
      }
    } else {
      this.enforceTerrainConstraints();
      if (this.combatState.surfaceCombatActive) this.updateSurfaceCombat(deltaTime);
    }

    // Combat cooldowns
    if (this.combatState.meleeCooldown > 0) this.combatState.meleeCooldown -= deltaTime;
    if (this.combatState.primaryFireCooldown > 0) this.combatState.primaryFireCooldown -= deltaTime;

    // Update planet visual
    if (this.planet && this.phase !== 'surface' && this.phase !== 'powered_descent') {
      const scale = Math.max(1, (1000 - this.altitude) / 40 + 1);
      this.planet.scaling.setAll(scale);
      this.planet.position.y = -150 + (1000 - this.altitude) * 0.12;
      if (this.planetAtmosphere) {
        this.planetAtmosphere.scaling.setAll(scale * 1.08);
        this.planetAtmosphere.position.copyFrom(this.planet.position);
      }
    }

    // Update station
    updateAnchorStation(this.anchorStation, deltaTime, this.altitude, this.positionX, this.positionZ, this.phase);

    // Update visual effects
    const effects: DescentEffects = {
      reentryParticles: this.reentryParticles,
      playerSmokeTrail: this.playerSmokeTrail,
      atmosphereStreaks: this.atmosphereStreaks,
      thrusterExhaustParticles: this.thrusterExhaustParticles,
      plasmaGlow: this.plasmaGlow,
      heatDistortion: this.heatDistortion,
      windStreaks: this.windStreaks,
    };
    const effectResult = updateVisualEffects({
      phase: this.phase,
      effects,
      state: { altitude: this.altitude, velocity: this.velocity, fuel: this.fuel, lateralVelocityX: this.lateralVelocityX, lateralVelocityZ: this.lateralVelocityZ, windIntensity: this.windIntensity },
      inputTracker: this.inputTracker,
      setBaseShake: this.setBaseShake.bind(this),
    }, deltaTime);
    this.windIntensity = effectResult.newWindIntensity;

    // Phase-specific updates
    switch (this.phase) {
      case 'freefall_start':
        if (this.phaseTime > 3) this.transitionToPhase('freefall_belt');
        break;
      case 'freefall_belt':
        this.updateFreefallBelt(deltaTime);
        break;
      case 'freefall_clear':
        this.updateFreefallClear(deltaTime);
        break;
      case 'powered_descent':
        Descent.updateLZBeaconColor(this.lzBeacon, this.positionX, this.positionZ);
        if (Descent.checkTrajectoryLost(this.positionX, this.positionZ)) {
          this.landingOutcome = 'slingshot';
          this.callbacks.onNotification('TRAJECTORY LOST', 2000);
        }
        if (this.altitude < 80) this.transitionToPhase('landing');
        break;
      case 'landing':
        if (this.altitude <= 0) {
          this.altitude = 0;
          this.landingOutcome = Descent.determineLandingOutcome(this.positionX, this.positionZ, this.velocity);
          this.transitionToPhase('surface');
        }
        break;
    }

    // HUD update
    this.updateHUD();
  }

  private updateFreefallBelt(deltaTime: number): void {
    this.asteroidSpawnTimer += deltaTime;
    if (this.asteroidSpawnTimer > this.asteroidSpawnRate) {
      const asteroid = spawnAsteroid(this.scene, this.asteroidsSpawned++, this.particleTexture);
      if (asteroid) this.asteroids.push(asteroid);
      this.asteroidSpawnTimer = 0;
      this.asteroidSpawnRate = Math.max(0.12, this.asteroidSpawnRate - 0.005);
    }

    const asteroidUpdate = Descent.updateAsteroids(this.asteroids, this.nearMissTimer, deltaTime);
    this.asteroids = asteroidUpdate.updatedAsteroids;
    this.nearMissTimer = asteroidUpdate.newNearMissTimer;
    Descent.disposeAsteroids(asteroidUpdate.removedAsteroids);

    if (asteroidUpdate.result.suitDamage > 0) {
      this.suitIntegrity = Math.max(0, this.suitIntegrity - asteroidUpdate.result.suitDamage);
      this.triggerShake(4 + asteroidUpdate.result.suitDamage * 0.2);
      this.callbacks.onDamage();
      this.callbacks.onHealthChange(this.suitIntegrity);
      this.windIntensity = Math.min(1, this.windIntensity + 0.5);
    }

    if (asteroidUpdate.result.nearMissTriggered && asteroidUpdate.result.nearMissAsteroid) {
      const ast = asteroidUpdate.result.nearMissAsteroid;
      this.triggerShake(1.5 * (0.5 + ast.size * 0.4));
      this.playSound('near_miss_whoosh', { volume: 0.5 + ast.size * 0.1 });
      this.windIntensity = Math.min(1, this.windIntensity + 0.2 + ast.size * 0.1);
    }

    this.asteroidsHit += asteroidUpdate.result.asteroidsHit;
    this.asteroidsDodged += asteroidUpdate.result.asteroidsDodged;

    if (this.altitude < 900 && !this.threatsSpawned) this.spawnDistantThreats();
    this.distantThreats.forEach((t) => updateDistantThreat(t, deltaTime));

    if (this.altitude < 650) this.transitionToPhase('freefall_clear');
  }

  private updateFreefallClear(deltaTime: number): void {
    const asteroidUpdate = Descent.updateAsteroids(this.asteroids, this.nearMissTimer, deltaTime);
    this.asteroids = asteroidUpdate.updatedAsteroids;
    this.nearMissTimer = asteroidUpdate.newNearMissTimer;
    Descent.disposeAsteroids(asteroidUpdate.removedAsteroids);

    this.distantThreats.forEach((t) => updateDistantThreat(t, deltaTime));

    if (this.altitude < 200) this.callbacks.onNotification('IGNITE JETS NOW!', 1000);
    if (this.altitude < 50) {
      this.landingOutcome = 'crash';
      this.transitionToPhase('surface');
    }
  }

  private updateHUD(): void {
    if (this.phase !== 'surface') {
      const altStr = Math.max(0, this.altitude).toFixed(0);
      const velStr = this.velocity.toFixed(0);

      if (this.phase === 'powered_descent' || this.phase === 'landing') {
        const fuelStr = this.fuel.toFixed(0);
        const distToLZ = Math.sqrt(this.positionX ** 2 + this.positionZ ** 2).toFixed(0);
        this.callbacks.onObjectiveUpdate('TARGET LZ', `ALT: ${altStr} | VEL: ${velStr} | FUEL: ${fuelStr}% | LZ: ${distToLZ}m`);
      } else {
        this.callbacks.onObjectiveUpdate(
          this.phase === 'freefall_belt' ? 'NAVIGATE DEBRIS' : 'FREEFALL',
          `ALT: ${altStr} | VEL: ${velStr} m/s | SUIT: ${this.suitIntegrity}%`
        );
      }
    }
  }

  private spawnDistantThreats(): void {
    if (this.threatsSpawned) return;
    this.threatsSpawned = true;

    for (let i = 0; i < DISTANT_THREAT_DEFINITIONS.length; i++) {
      const threat = spawnDistantThreat(this.scene, DISTANT_THREAT_DEFINITIONS[i], i);
      if (threat) this.distantThreats.push(threat);
    }

    setTimeout(() => comms.sendEnemyAirTrafficWarning(this.callbacks), 500);
  }

  private completeLanding(): void {
    this.setBaseShake(0);
    this.callbacks.onCinematicEnd?.();
    this.updateActionButtons('none');

    switch (this.landingOutcome) {
      case 'perfect':
        this.triggerShake(2);
        this.callbacks.onNotification('PERFECT LANDING', 3000);
        setTimeout(() => comms.sendPerfectLandingMessage(this.callbacks, this.asteroidsDodged), 2000);
        this.transitionToSurface(false);
        break;
      case 'near_miss':
        this.triggerShake(4);
        this.callbacks.onNotification('NEAR MISS - HOSTILES INBOUND', 3000);
        setTimeout(() => comms.sendNearMissLandingMessage(this.callbacks), 2000);
        this.transitionToSurface(true);
        break;
      case 'rough':
        this.triggerShake(6);
        this.suitIntegrity = Math.max(0, this.suitIntegrity - 25);
        this.callbacks.onHealthChange(this.suitIntegrity);
        this.callbacks.onNotification('ROUGH LANDING - DAMAGE TAKEN', 3000);
        setTimeout(() => comms.sendRoughLandingMessage(this.callbacks), 2000);
        this.transitionToSurface(true);
        break;
      case 'crash':
        this.triggerShake(10);
        this.suitIntegrity = Math.max(10, this.suitIntegrity - 50);
        this.callbacks.onHealthChange(this.suitIntegrity);
        this.callbacks.onNotification('CRASH LANDING', 3000);
        setTimeout(() => comms.sendCrashLandingMessage(this.callbacks), 2000);
        this.transitionToSurface(true);
        break;
      case 'slingshot':
        this.callbacks.onNotification('TRAJECTORY LOST - KIA', 3000);
        setTimeout(() => comms.sendSlingshotMessage(this.callbacks), 2000);
        break;
    }
  }

  private enforceTerrainConstraints(): void {
    if (this.camera.position.y < MIN_PLAYER_HEIGHT) this.camera.position.y = MIN_PLAYER_HEIGHT;
    this.camera.position.x = Math.max(-TERRAIN_BOUNDS, Math.min(TERRAIN_BOUNDS, this.camera.position.x));
    this.camera.position.z = Math.max(-TERRAIN_BOUNDS, Math.min(TERRAIN_BOUNDS, this.camera.position.z));
  }

  private transitionToSurface(combatRequired: boolean): void {
    getAchievementManager().onHaloDropComplete();
    getAudioManager().stopLoop('drop_wind');
    getAudioManager().stopLoop('drop_thrust');

    this.setPoweredDescentVisible(false);
    [this.planet, this.planetAtmosphere, this.starfield, this.plasmaGlow, this.lzBeacon].forEach((m) => { if (m) m.isVisible = false; });

    Descent.disposeAsteroids(this.asteroids);
    this.asteroids = [];
    this.distantThreats.forEach((t) => t.node.dispose());
    this.distantThreats = [];
    stopAllDescentEffects({
      reentryParticles: this.reentryParticles,
      playerSmokeTrail: this.playerSmokeTrail,
      atmosphereStreaks: this.atmosphereStreaks,
      thrusterExhaustParticles: this.thrusterExhaustParticles,
      plasmaGlow: this.plasmaGlow,
      heatDistortion: this.heatDistortion,
      windStreaks: this.windStreaks,
    });

    if (this.terrain) this.terrain.isVisible = true;
    if (this.skyDome) this.skyDome.isVisible = true;
    if (this.lzPad) this.lzPad.setEnabled(true);
    this.canyonWalls.forEach((w) => w.setEnabled(true));
    this.coverObjects.forEach((obj) => { obj.setEnabled(true); if ('isVisible' in obj) (obj as Mesh).isVisible = true; });
    if (this.glbEnvironment) setEnvironmentVisible(this.glbEnvironment, true);
    this.acidPools.forEach((p) => (p.isVisible = true));
    this.unstableTerrain.forEach((t) => (t.isVisible = true));

    this.targetFOV = SURFACE_FOV;
    this.camera.position.set(Math.max(-TERRAIN_BOUNDS, Math.min(TERRAIN_BOUNDS, this.positionX)), MIN_PLAYER_HEIGHT, Math.max(-TERRAIN_BOUNDS, Math.min(TERRAIN_BOUNDS, this.positionZ)));

    const rotAnim = new Animation('landingCameraRotation', 'rotation', 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    rotAnim.setKeys([{ frame: 0, value: new Vector3(this.camera.rotation.x, this.camera.rotation.y, 0) }, { frame: 48, value: new Vector3(0, Math.PI, 0) }]);
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rotAnim.setEasingFunction(easing);
    this.camera.animations = [rotAnim];
    this.scene.beginAnimation(this.camera, 0, 48, false, 1, () => { this.rotationX = 0; this.rotationY = Math.PI; this.camera.rotation.set(0, Math.PI, 0); });

    this.scene.clearColor = new Color4(0.75, 0.5, 0.35, 1);

    if (combatRequired) {
      setTimeout(() => this.callbacks.onObjectiveUpdate('GET YOUR BEARINGS', 'Assess the situation. LZ pad is ahead.'), 1000);
      setTimeout(() => comms.sendSeismicWarningMessage(this.callbacks), 4000);
      setTimeout(() => { this.callbacks.onNotification('SEISMIC WARNING', 1500); this.triggerShake(2); }, 6000);
      setTimeout(() => {
        comms.sendCombatBeginsMessage(this.callbacks);
        this.callbacks.onObjectiveUpdate('SURVIVE THE AMBUSH', 'Eliminate hostiles. Use the debris for cover!');
        this.callbacks.onCombatStateChange(true);
        this.updateActionButtons('combat');
        getAudioManager().enterCombat();

        const am = getAchievementManager();
        this.combatTutorialActive = !am.isUnlocked('first_steps') && !am.isUnlocked('sharpshooter');
        if (this.combatTutorialActive) setTimeout(() => comms.sendCombatTutorialMessage(this.callbacks), 2000);
        this.spawnFirstCombatEncounter();
      }, 8000);
    } else {
      setTimeout(() => { this.callbacks.onObjectiveUpdate('PROCEED TO FOB DELTA', 'LZ secure. Move out.'); setTimeout(() => this.completeLevel(), 5000); }, 3000);
    }
  }

  private spawnFirstCombatEncounter(): void {
    if (this.combatState.surfaceCombatActive) return;
    this.combatState.surfaceCombatActive = true;
    this.combatState.tutorialSlowdownActive = true;
    this.combatState.tutorialSlowdownTimer = 0;

    const playerPos = this.camera.position.clone();
    const spawnPoints = [
      new Vector3(playerPos.x + 12, 0, playerPos.z + 18),
      new Vector3(playerPos.x - 10, 0, playerPos.z + 22),
      new Vector3(playerPos.x + 5, 0, playerPos.z + 28),
      new Vector3(playerPos.x - 8, 0, playerPos.z + 15),
    ];

    spawnPoints.forEach((pos) => {
      pos.x = Math.max(-TERRAIN_BOUNDS + 10, Math.min(TERRAIN_BOUNDS - 10, pos.x));
      pos.z = Math.max(-TERRAIN_BOUNDS + 10, Math.min(TERRAIN_BOUNDS - 10, pos.z));
    });

    const spawnEnemy = (index: number) => {
      if (index >= FIRST_ENCOUNTER_ENEMY_COUNT) {
        setTimeout(() => this.callbacks.onNotification('TIP: Use debris for cover!', 2500), 1500);
        return;
      }

      this.triggerShake(3);
      getAudioManager().play('alien_screech', { volume: 0.4 });

      setTimeout(() => {
        const { enemy } = spawnFirstEncounterEnemy(this.scene, spawnPoints[index], index, this.surfaceEnemiesPreloaded);
        this.surfaceEnemies.push(enemy);
        this.combatState.enemyCount++;
        if (index === 0) setTimeout(() => this.callbacks.onNotification(`${FIRST_ENCOUNTER_ENEMY_COUNT} HOSTILES DETECTED`, 1500), 500);
      }, 300);

      setTimeout(() => spawnEnemy(index + 1), 800 + Math.random() * 400);
    };

    spawnEnemy(0);
  }

  private updateSurfaceCombat(deltaTime: number): void {
    const playerPos = this.camera.position;

    if (this.combatState.tutorialSlowdownActive) {
      this.combatState.tutorialSlowdownTimer += deltaTime;
      if (this.combatState.tutorialSlowdownTimer >= TUTORIAL_SLOWDOWN_DURATION) {
        this.combatState.tutorialSlowdownActive = false;
        this.callbacks.onNotification('ENEMIES BECOMING AGGRESSIVE!', 1500);
      }
    }

    const tutorialProgress = Math.min(this.combatState.tutorialSlowdownTimer / TUTORIAL_SLOWDOWN_DURATION, 1);
    const enemyUpdate = Combat.updateSurfaceEnemies(this.surfaceEnemies, playerPos, deltaTime, this.combatState.tutorialSlowdownActive, tutorialProgress);

    if (enemyUpdate.playerDamage > 0) this.onEnemyAttack(enemyUpdate.playerDamage);

    const aliveEnemies = this.surfaceEnemies.filter((e) => e.health > 0);
    if (aliveEnemies.length === 0 && this.combatState.surfaceCombatActive && this.combatState.killCount > 0) this.onCombatCleared();

    const hazardUpdate = Combat.updateEnvironmentHazards(playerPos, this.acidPools, this.unstableTerrain, this.combatState.acidDamageTimer, this.combatState.unstableTerrainShakeTimer, this.combatState.playerInAcid, deltaTime);
    this.combatState.acidDamageTimer = hazardUpdate.newAcidDamageTimer;
    this.combatState.unstableTerrainShakeTimer = hazardUpdate.newUnstableTerrainShakeTimer;

    if (hazardUpdate.result.enteredAcid) { this.combatState.playerInAcid = true; this.callbacks.onNotification('ACID BURNS!', 1000); this.triggerShake(1.5); }
    if (hazardUpdate.result.exitedAcid) { this.combatState.playerInAcid = false; this.callbacks.onNotification('ESCAPED ACID', 800); }
    if (hazardUpdate.result.acidDamage > 0) {
      this.suitIntegrity = Math.max(0, this.suitIntegrity - hazardUpdate.result.acidDamage);
      this.callbacks.onHealthChange(-hazardUpdate.result.acidDamage);
      this.triggerDamageShake(hazardUpdate.result.acidDamage);
      particleManager.emitSmallExplosion(playerPos.clone());
    }
    if (hazardUpdate.result.shouldShake) this.triggerShake(1.0);
    if (hazardUpdate.result.showUnstableWarning) this.callbacks.onNotification('GROUND UNSTABLE!', 800);

    this.updateCombatTutorialPrompts();
  }

  private updateCombatTutorialPrompts(): void {
    if (!this.combatTutorialActive) return;
    if (!this.hasShownMovementTutorial && this.phaseTime > 2) { this.hasShownMovementTutorial = true; this.callbacks.onNotification('TIP: WASD to move, dodge enemy attacks!', 3000); }
    if (!this.hasShownAimingTutorial && this.phaseTime > 5 && this.hasShownMovementTutorial) { this.hasShownAimingTutorial = true; this.callbacks.onNotification('TIP: Click to shoot, aim at center mass!', 3000); }
    if (!this.hasShownCoverTutorial && this.phaseTime > 8 && this.hasShownAimingTutorial) { this.hasShownCoverTutorial = true; this.callbacks.onNotification('TIP: Use debris and rocks for cover!', 3000); }
    if (!this.hasShownReloadTutorial && this.phaseTime > 12 && this.hasShownCoverTutorial) { this.hasShownReloadTutorial = true; this.callbacks.onNotification('TIP: R to reload when ammo is low!', 3000); }
  }

  private onEnemyAttack(damage: number): void {
    this.suitIntegrity = Math.max(0, this.suitIntegrity - damage);
    this.callbacks.onHealthChange(-damage);
    this.triggerDamageShake(damage);
    this.callbacks.onNotification('TAKING DAMAGE!', 500);
  }

  private onEnemyKilled(enemy: SurfaceEnemy): void {
    this.combatState.killCount++;
    this.combatState.enemyCount--;
    Combat.processEnemyKill(enemy);
    this.callbacks.onKill();
    this.callbacks.onNotification(`HOSTILE DOWN [${this.combatState.killCount}/${FIRST_ENCOUNTER_ENEMY_COUNT}]`, 800);
  }

  private onCombatCleared(): void {
    this.combatState.surfaceCombatActive = false;
    this.combatState.tutorialSlowdownActive = false;
    this.callbacks.onCombatStateChange(false);
    getAudioManager().exitCombat();
    this.callbacks.onNotification('ALL HOSTILES ELIMINATED', 2000);
    setTimeout(() => { this.callbacks.onNotification('FIRST BLOOD - SURFACE COMBAT COMPLETE', 2500); getAchievementManager().onFirstCombatWin(); }, 2500);
    setTimeout(() => comms.sendCombatClearedMessage(this.callbacks, this.combatState.killCount), 3000);
    setTimeout(() => { this.callbacks.onObjectiveUpdate('SECURE THE LANDING ZONE', 'Proceed to the LZ pad. Watch for stragglers.'); }, 5000);
    setTimeout(() => { comms.sendLZSecuredMessage(this.callbacks); this.callbacks.onObjectiveUpdate('PROCEED TO FOB DELTA', 'LZ secure. Move out. Waypoint set.'); this.updateActionButtons('none'); this.showFOBDeltaMarker(); }, 8000);
    setTimeout(() => this.completeLevel(), 12000);
  }

  private showFOBDeltaMarker(): void {
    if (this.fobDeltaBeacon) this.fobDeltaBeacon.isVisible = true;
    if (this.fobDeltaMarker) this.fobDeltaMarker.isVisible = true;
    setTimeout(() => comms.sendFOBDeltaWaypointMessage(this.callbacks), 2000);
  }

  private throwGrenade(): void {
    this.callbacks.onNotification('GRENADE OUT!', 1000);
    const forward = this.camera.getDirection(Vector3.Forward());

    setTimeout(() => {
      const result = Combat.throwGrenade(this.surfaceEnemies, this.camera.position.clone(), forward);
      this.triggerShake(3);
      for (const enemy of result.killedEnemies) this.onEnemyKilled(enemy);
    }, 1500);
  }

  private performMeleeAttack(): void {
    if (this.combatState.meleeCooldown > 0 || this.phase !== 'surface' || !this.combatState.surfaceCombatActive) return;
    this.combatState.meleeCooldown = 0.5;
    this.callbacks.onNotification('MELEE!', 500);

    const result = Combat.performMeleeAttack(this.surfaceEnemies, this.camera.position, this.rotationY);
    if (result.enemyKilled) this.onEnemyKilled(result.enemyKilled);
  }

  private firePrimaryWeapon(): void {
    if (this.combatState.primaryFireCooldown > 0 || !this.isPointerLocked() || this.phase !== 'surface' || !this.combatState.surfaceCombatActive) return;
    this.combatState.primaryFireCooldown = 0.15;

    const forward = this.camera.getDirection(Vector3.Forward());
    const result = Combat.firePrimaryWeapon(this.scene, this.surfaceEnemies, this.camera.position, forward);

    if (result.outOfAmmo) { this.callbacks.onNotification('NO AMMO - RELOADING', 800); return; }
    if (result.hit) this.callbacks.onNotification('HIT!', 300);
    if (result.enemyKilled) this.onEnemyKilled(result.enemyKilled);
  }

  private handleReload(): void {
    if (this.phase !== 'surface' || !this.combatState.surfaceCombatActive) return;
    const result = Combat.handleReload();
    if (result.message) this.callbacks.onNotification(result.message, result.started ? 1500 : 800);
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');
    const fireKeys = this.inputTracker.getAllKeysForAction('fire');
    if (e.code === 'KeyV') this.performMeleeAttack();
    if (reloadKeys.includes(e.code)) this.handleReload();
    const nonMouseFireKeys = fireKeys.filter((k) => !k.startsWith('Mouse'));
    if (nonMouseFireKeys.includes(e.code)) this.firePrimaryWeapon();
  }

  protected override handleClick(): void {
    super.handleClick();
    if (this.isPointerLocked()) this.firePrimaryWeapon();
  }

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'fob_delta' && this.phase === 'surface';
  }

  protected disposeLevel(): void {
    for (const node of this.floraNodes) node.dispose(false, true);
    this.floraNodes = [];
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    [this.planet, this.planetAtmosphere, this.starfield, this.leftArm, this.rightArm, this.leftGlove, this.rightGlove, this.visorFrame, this.leftHandle, this.rightHandle, this.thrusterGlow, this.plasmaGlow, this.lzPad, this.lzBeacon, this.terrain, this.skyDome, this.heatDistortion, this.fobDeltaMarker, this.fobDeltaBeacon].forEach((m) => m?.dispose());
    this.canyonWalls.forEach((w) => w.dispose());

    for (const obj of this.coverObjects) if (!obj.isDisposed()) obj.dispose(false, true);
    this.coverObjects = [];

    Descent.disposeAsteroids(this.asteroids);
    this.asteroids = [];

    disposeAnchorStation(this.anchorStation);
    this.anchorStation = null;

    this.distantThreats.forEach((t) => t.node.dispose());
    this.distantThreats = [];

    this.surfaceEnemies.forEach((e) => { if (e.mesh && !e.mesh.isDisposed()) e.mesh.dispose(); });
    this.surfaceEnemies = [];

    this.acidPools.forEach((p) => { if (p && !p.isDisposed()) p.dispose(); });
    this.acidPools = [];
    this.unstableTerrain.forEach((t) => { if (t && !t.isDisposed()) t.dispose(); });
    this.unstableTerrain = [];

    if (this.glbEnvironment) { disposeEnvironment(this.glbEnvironment); this.glbEnvironment = null; }

    disposeDescentEffects({
      reentryParticles: this.reentryParticles,
      playerSmokeTrail: this.playerSmokeTrail,
      atmosphereStreaks: this.atmosphereStreaks,
      thrusterExhaustParticles: this.thrusterExhaustParticles,
      plasmaGlow: this.plasmaGlow,
      heatDistortion: this.heatDistortion,
      windStreaks: this.windStreaks,
    });
    this.reentryParticles = this.playerSmokeTrail = this.atmosphereStreaks = this.thrusterExhaustParticles = null;

    this.particleTexture?.dispose();
    this.particleTexture = null;

    this.windStreaks = [];
  }
}
