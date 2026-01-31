/**
 * HiveAssaultLevel - Environment Creation (GLB-Asset-Driven)
 *
 * Builds the combined-arms battlefield: open terrain leading to the hive entrance.
 * Uses Quaternius modular GLBs, decals, station-external, and spaceship assets
 * from the hive-assault manifest. MeshBuilder primitives are retained only for
 * elements that have no corresponding GLB (wrecks, organic hive structures, terrain).
 *
 * Environment layers (far to near):
 *
 * 1. STAGING AREA (z: 0 to -50)
 *    - Quaternius modular FOB: Wall_5, doors, columns, roof tiles, pipes
 *    - Props_Base, Props_ContainerFull, Props_Chest
 *    - Fenced perimeter with poster decals
 *
 * 2. OPEN FIELD (z: -50 to -400)
 *    - Barricades, boulder cover (MeshBuilder)
 *    - Destroyed vehicles (MeshBuilder wrecks)
 *    - AA turret emplacements (destructible objectives)
 *    - Station06 visible on the horizon
 *
 * 3. BREACH POINT (z: -400 to -550)
 *    - Military barricades meeting organic hive barriers
 *    - Sandbag positions, acid pools
 *
 * 4. HIVE ENTRANCE (z: -550 to -650)
 *    - Massive organic gate (50m tall)
 *    - Bioluminescent growths, spore vents
 *
 * SKY BACKDROP:
 *    - Imperial and Executioner spaceships in the distant sky
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

import '@babylonjs/core/Layers/effectLayerSceneComponent';

// ============================================================================
// COLORS & CONSTANTS
// ============================================================================

export const ENV_COLORS = {
  // Terrain
  terrainBase: '#7A5230',
  terrainRock: '#6B4423',
  terrainDark: '#4A2E18',
  sand: '#C2A06A',

  // Military
  metalGrey: '#5A5A5A',
  militaryGreen: '#4A5A3A',
  concretePad: '#8A8A7A',
  sandbag: '#B8A880',
  crate: '#6A5A3A',

  // Hive organic
  chitinDark: '#2A1A2A',
  chitinPurple: '#4A2A4A',
  chitinRed: '#5A2A2A',
  bioGlow: '#4AFF9F',
  bioGlowDim: '#2A8A5A',
  sporeYellow: '#AAFF44',
  acidGreen: '#44FF44',

  // Wreckage
  burntMetal: '#3A3A3A',
  rust: '#7A4A2A',
  scorchBlack: '#1A1A1A',
} as const;

const TERRAIN_WIDTH = 300;
const TERRAIN_DEPTH = 700;
const TERRAIN_SUBDIVISIONS = 80;

// ============================================================================
// GLB ASSET PATHS (from hive-assault manifest)
// ============================================================================

const GLB = {
  // Quaternius modular pieces
  wall5: '/models/environment/modular/Wall_5.glb',
  doorDblLong: '/models/environment/modular/DoorDoubleLong_Wall_SideA.glb',
  doorSglLong: '/models/environment/modular/DoorSingleLong_Wall_SideA.glb',
  doorSglA: '/models/environment/modular/DoorSingle_Wall_SideA.glb',
  doorSglB: '/models/environment/modular/DoorSingle_Wall_SideB.glb',
  columnSlim: '/models/environment/modular/Column_Slim.glb',
  roofCornerPipes: '/models/environment/modular/RoofTile_Corner_Pipes.glb',
  roofInnerPipes: '/models/environment/modular/RoofTile_InnerCorner_Pipes.glb',
  roofSidesPipes: '/models/environment/modular/RoofTile_Sides_Pipes.glb',
  roofOrangeVent: '/models/environment/modular/RoofTile_OrangeVent.glb',
  roofVents: '/models/environment/modular/RoofTile_Vents.glb',
  pipes: '/models/environment/modular/Pipes.glb',
  base: '/models/environment/modular/Props_Base.glb',
  containerFull: '/models/environment/modular/Props_ContainerFull.glb',
  chest: '/models/environment/modular/Props_Chest.glb',
  detailOutput: '/models/environment/modular/Details_Output.glb',
  detailOutputSm: '/models/environment/modular/Details_Output_Small.glb',

  // Decals
  poster15: '/models/props/decals/poster_cx_15.glb',
  poster16: '/models/props/decals/poster_cx_16.glb',

  // Station external backdrop
  station06: '/models/environment/station-external/station06.glb',

  // Spaceships (sky backdrop)
  imperial: '/models/spaceships/Imperial.glb',
  executioner: '/models/spaceships/Executioner.glb',

  // Alien-flora for boulders & organic growths
  boulderPolyhaven: '/models/environment/alien-flora/alien_boulder_polyhaven.glb',
  rockMedium1: '/models/environment/alien-flora/alien_rock_medium_1.glb',
  rockMedium2: '/models/environment/alien-flora/alien_rock_medium_2.glb',
  rockMedium3: '/models/environment/alien-flora/alien_rock_medium_3.glb',
  tallRock1: '/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  tallRock2: '/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  tallRock3: '/models/environment/alien-flora/alien_tall_rock_3_01.glb',
  mushroomTall: '/models/environment/alien-flora/alien_mushroom_tall_01.glb',
  mushroom01: '/models/environment/alien-flora/alien_mushroom_01.glb',
  mushroom02: '/models/environment/alien-flora/alien_mushroom_02.glb',
  mushroom03: '/models/environment/alien-flora/alien_mushroom_03.glb',
  mushroom04: '/models/environment/alien-flora/alien_mushroom_04.glb',
  mushroomBrown: '/models/environment/alien-flora/alien_mushroom_brown_01.glb',
  mushroomRed: '/models/environment/alien-flora/alien_mushroom_red_01.glb',
  mushroomLaetiporus: '/models/environment/alien-flora/alien_mushroom_laetiporus.glb',
  twistedTree1: '/models/environment/alien-flora/alien_twistedtree_1.glb',
  twistedTree2: '/models/environment/alien-flora/alien_twistedtree_2.glb',
  twistedTree3: '/models/environment/alien-flora/alien_twistedtree_3.glb',
  twistedTree4: '/models/environment/alien-flora/alien_twistedtree_4.glb',
  twistedTree5: '/models/environment/alien-flora/alien_twistedtree_5.glb',
  deadTree1: '/models/environment/alien-flora/alien_deadtree_1.glb',
  deadTree2: '/models/environment/alien-flora/alien_deadtree_2.glb',
  deadTree3: '/models/environment/alien-flora/alien_deadtree_3.glb',
  fallenTrunk: '/models/environment/alien-flora/alien_fallen_trunk_01.glb',
  mushroom05: '/models/environment/alien-flora/alien_mushroom_05.glb',
  mushroom06: '/models/environment/alien-flora/alien_mushroom_06.glb',

  // Military barricades & crates
  barricadeA1: '/models/props/modular/barricade_a_1.glb',
  barricadeA2: '/models/props/modular/barricade_a_2.glb',
  barricadeA3: '/models/props/modular/barricade_a_3.glb',
  barricadeB1: '/models/props/modular/barricade_b_1.glb',
  barricadeB2: '/models/props/modular/barricade_b_2.glb',
  barricadeB3: '/models/props/modular/barricade_b_3.glb',
  barricadeB4: '/models/props/modular/barricade_b_4.glb',
  woodenCrate1: '/models/props/containers/wooden_crate_1.glb',
  woodenCrate2a: '/models/props/containers/wooden_crate_2_a.glb',
  woodenCrate3: '/models/props/containers/wooden_crate_3.glb',

  // Modular floor & platforms
  floorTile: '/models/environment/modular/FloorTile_Basic.glb',
  floorTileDouble: '/models/environment/modular/FloorTile_Double_Hallway.glb',
  propsCrate: '/models/environment/modular/Props_Crate.glb',

  // Debris & wreckage
  metalBarrel1: '/models/props/containers/metal_barrel_hr_1.glb',
  metalBarrel2: '/models/props/containers/metal_barrel_hr_2.glb',
  metalBarrel3: '/models/props/containers/metal_barrel_hr_3.glb',
  metalBarrel4: '/models/props/containers/metal_barrel_hr_4.glb',
  scrapMetal1: '/models/props/containers/scrap_metal_mx_1.glb',
  scrapMetal1a: '/models/props/containers/scrap_metal_mx_1_1.glb',
  scrapMetal1b: '/models/props/containers/scrap_metal_mx_1_2.glb',
  tire1: '/models/props/containers/tire_1.glb',
  tire2: '/models/props/containers/tire_2.glb',
  woodenBoard1: '/models/props/containers/wooden_board_1.glb',
  woodenBoard2: '/models/props/containers/wooden_board_2.glb',
  woodenBoard3: '/models/props/containers/wooden_board_3.glb',
  woodenPlank1: '/models/props/containers/wooden_plank_1.glb',
  woodenPlank2: '/models/props/containers/wooden_plank_2.glb',
  woodenPlank3: '/models/props/containers/wooden_plank_3.glb',
  gravelPile1: '/models/props/debris/gravel_pile_hr_1.glb',
  gravelPile2: '/models/props/debris/gravel_pile_hr_2.glb',
  debrisBricks1: '/models/props/debris/debris_bricks_mx_1.glb',
  debrisBricks2: '/models/props/debris/debris_bricks_mx_2_0.glb',

  // Additional alien flora for organic structures
  mushroom07: '/models/environment/alien-flora/alien_mushroom_07.glb',
  mushroom08: '/models/environment/alien-flora/alien_mushroom_08.glb',
  mushroom09: '/models/environment/alien-flora/alien_mushroom_09.glb',
  tree01: '/models/environment/alien-flora/alien_tree_01.glb',
  tree02: '/models/environment/alien-flora/alien_tree_02.glb',
  spruce01: '/models/environment/alien-flora/alien_spruce_01.glb',
  spruce02: '/models/environment/alien-flora/alien_spruce_02.glb',
} as const;

// ============================================================================
// ENVIRONMENT STRUCTURES (unchanged public interfaces)
// ============================================================================

export interface StagingAreaProps {
  vehicleBay: Mesh;
  briefingPlatform: Mesh;
  sandbags: Mesh[];
  crates: Mesh[];
  lights: PointLight[];
}

export interface AATurret {
  rootNode: TransformNode;
  baseMesh: Mesh;
  barrelMesh: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
  destroyed: boolean;
  fireTimer: number;
}

export interface DestroyedVehicle {
  mesh: Mesh;
  position: Vector3;
  type: 'warthog' | 'scorpion' | 'pelican';
}

export interface HiveEntrance {
  gateMesh: Mesh;
  archLeft: Mesh;
  archRight: Mesh;
  organicGrowths: Mesh[];
  bioLights: { mesh: Mesh; light: PointLight; baseIntensity: number; flickerPhase: number }[];
  sporeVents: Mesh[];
}

export interface Fortification {
  mesh: Mesh;
  position: Vector3;
  type: 'sandbag' | 'barrier' | 'crate' | 'rock';
  provideCover: boolean;
}

// ============================================================================
// HELPER: create GLB instance or return null
// ============================================================================

function glbInstance(
  path: string,
  name: string,
  scene: Scene,
  lodCategory = 'environment'
): TransformNode | null {
  if (!AssetManager.isPathCached(path)) return null;
  return AssetManager.createInstanceByPath(path, name, scene, true, lodCategory);
}

// ============================================================================
// ASSAULT ENVIRONMENT BUILDER
// ============================================================================

export class AssaultEnvironmentBuilder {
  private scene: Scene;
  private glowLayer: GlowLayer | null = null;

  // Disposable references
  private terrainMesh: Mesh | null = null;
  private skyDome: Mesh | null = null;
  private allMeshes: Mesh[] = [];
  private allLights: PointLight[] = [];
  private allNodes: TransformNode[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // ============================================================================
  // ASSET LOADING
  // ============================================================================

  /**
   * Pre-load every GLB referenced by this environment.
   * Must be awaited before any create* method that uses GLBs.
   */
  async loadAssets(): Promise<void> {
    const paths = Object.values(GLB);
    const promises = paths.map((p) => {
      if (!AssetManager.isPathCached(p)) {
        return AssetManager.loadAssetByPath(p, this.scene);
      }
      return Promise.resolve(null);
    });
    await Promise.all(promises);
    console.log('[AssaultEnv] All GLB assets loaded');
  }

  // ============================================================================
  // MAIN BUILD METHODS
  // ============================================================================

  /**
   * Initialize glow layer for bioluminescence and muzzle flashes
   */
  setupGlowLayer(): GlowLayer {
    this.glowLayer = new GlowLayer('assaultGlow', this.scene);
    this.glowLayer.intensity = 0.6;
    return this.glowLayer;
  }

  /**
   * Create the main terrain ground plane
   */
  createTerrain(): Mesh {
    this.terrainMesh = MeshBuilder.CreateGround(
      'assaultTerrain',
      {
        width: TERRAIN_WIDTH,
        height: TERRAIN_DEPTH,
        subdivisions: TERRAIN_SUBDIVISIONS,
      },
      this.scene
    );

    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.diffuseColor = Color3.FromHexString(ENV_COLORS.terrainBase);
    terrainMat.specularColor = new Color3(0.05, 0.04, 0.03);
    this.terrainMesh.material = terrainMat;

    // Center terrain so staging is at z=0 and hive entrance is at z=-650
    this.terrainMesh.position.z = -TERRAIN_DEPTH / 2;

    this.allMeshes.push(this.terrainMesh);
    return this.terrainMesh;
  }

  /**
   * Create sky dome with dusty battlefield atmosphere
   */
  createSkyDome(): Mesh {
    this.skyDome = MeshBuilder.CreateSphere(
      'skyDome',
      { diameter: 4000, segments: 16, sideOrientation: 1 },
      this.scene
    );

    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.6, 0.4, 0.25);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    this.skyDome.material = skyMat;
    this.skyDome.infiniteDistance = true;
    this.skyDome.renderingGroupId = 0;

    this.allMeshes.push(this.skyDome);
    return this.skyDome;
  }

  // ============================================================================
  // SKY BACKDROP: SPACESHIPS
  // ============================================================================

  /**
   * Place Imperial and Executioner spaceships as distant fleet backdrop.
   * These sit high in the sky, reminiscent of Halo's fleet scenes.
   */
  createFleetBackdrop(): void {
    // Imperial -- large capital ship on the left, tilted slightly
    const imperial = glbInstance(GLB.imperial, 'fleet_imperial', this.scene, 'environment');
    if (imperial) {
      imperial.position.set(-400, 350, -800);
      imperial.scaling.setAll(15);
      imperial.rotation.set(0.05, 0.3, 0.02);
      this.allNodes.push(imperial);
    }

    // Executioner -- slightly smaller, on the right
    const executioner = glbInstance(GLB.executioner, 'fleet_executioner', this.scene, 'environment');
    if (executioner) {
      executioner.position.set(350, 280, -900);
      executioner.scaling.setAll(12);
      executioner.rotation.set(-0.03, -0.4, 0.01);
      this.allNodes.push(executioner);
    }

    // A second Imperial further back for depth
    const imperial2 = glbInstance(GLB.imperial, 'fleet_imperial_2', this.scene, 'environment');
    if (imperial2) {
      imperial2.position.set(100, 500, -1200);
      imperial2.scaling.setAll(8);
      imperial2.rotation.set(0.02, 0.1, -0.01);
      this.allNodes.push(imperial2);
    }
  }

  // ============================================================================
  // STAGING AREA (z: 0 to -50) -- Forward Operating Base with GLBs
  // ============================================================================

  /**
   * Build the forward operating base staging area using Quaternius modular GLBs.
   */
  createStagingArea(): StagingAreaProps {
    const sandbags: Mesh[] = [];
    const crates: Mesh[] = [];
    const lights: PointLight[] = [];

    // -----------------------------------------------------------------------
    // Vehicle bay -- GLB floor tiles arranged as a concrete pad
    // -----------------------------------------------------------------------
    const vehicleBayRoot = new TransformNode('vehicleBay_root', this.scene);
    vehicleBayRoot.position.set(15, 0, -10);
    this.allNodes.push(vehicleBayRoot);

    // Place a 2x2 grid of floor tiles to form the pad
    const bayTileScale = 2.5;
    for (let tx = 0; tx < 2; tx++) {
      for (let tz = 0; tz < 2; tz++) {
        const tile = glbInstance(GLB.floorTileDouble, `vehicleBay_tile_${tx}_${tz}`, this.scene, 'environment');
        if (tile) {
          tile.position.set((tx - 0.5) * 5 * bayTileScale, 0, (tz - 0.5) * 3.75 * bayTileScale);
          tile.scaling.setAll(bayTileScale);
          tile.parent = vehicleBayRoot;
          this.allNodes.push(tile);
        }
      }
    }

    // Invisible collision proxy for vehicle bay
    const vehicleBay = MeshBuilder.CreateBox(
      'vehicleBay',
      { width: 20, height: 0.3, depth: 15 },
      this.scene
    );
    vehicleBay.position.set(15, 0.15, -10);
    vehicleBay.isVisible = false;
    this.allMeshes.push(vehicleBay);

    // -----------------------------------------------------------------------
    // Briefing platform -- GLB base prop (Props_Base) as holographic pedestal
    // -----------------------------------------------------------------------
    const briefingPlatformNode = glbInstance(GLB.base, 'briefingPlatform_glb', this.scene, 'prop');
    if (briefingPlatformNode) {
      briefingPlatformNode.position.set(-8, 0, -5);
      briefingPlatformNode.scaling.setAll(2.0);
      this.allNodes.push(briefingPlatformNode);
    }

    // Invisible collision proxy for the platform
    const briefingPlatform = MeshBuilder.CreateCylinder(
      'briefingPlatform',
      { height: 0.4, diameter: 4, tessellation: 16 },
      this.scene
    );
    briefingPlatform.position.set(-8, 0.2, -5);
    briefingPlatform.isVisible = false;
    this.allMeshes.push(briefingPlatform);

    // Hologram light
    const holoLight = new PointLight('holoLight', new Vector3(-8, 2.5, -5), this.scene);
    holoLight.diffuse = new Color3(0.2, 0.5, 0.8);
    holoLight.intensity = 8;
    holoLight.range = 10;
    lights.push(holoLight);
    this.allLights.push(holoLight);

    // -----------------------------------------------------------------------
    // FOB BUILDING CLUSTER: Left wing (Command Post)
    // -----------------------------------------------------------------------
    this.buildFOBCommandPost(lights);

    // -----------------------------------------------------------------------
    // FOB BUILDING CLUSTER: Right wing (Armory / Supply Depot)
    // -----------------------------------------------------------------------
    this.buildFOBArmory(lights);

    // -----------------------------------------------------------------------
    // PERIMETER FENCE: Wall_5 segments forming the FOB boundary
    // -----------------------------------------------------------------------
    this.buildFOBPerimeter(sandbags);

    // -----------------------------------------------------------------------
    // SUPPLY PROPS: containers, chests, crates, pipes
    // -----------------------------------------------------------------------
    this.buildFOBSupplyProps(crates);

    // -----------------------------------------------------------------------
    // POSTER DECALS on wall surfaces
    // -----------------------------------------------------------------------
    this.buildPosterDecals();

    // -----------------------------------------------------------------------
    // Staging area perimeter lights
    // -----------------------------------------------------------------------
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const radius = 25;
      const perimeterLight = new PointLight(
        `perimLight_${i}`,
        new Vector3(Math.cos(angle) * radius, 5, -20 + Math.sin(angle) * radius),
        this.scene
      );
      perimeterLight.diffuse = new Color3(1.0, 0.9, 0.7);
      perimeterLight.intensity = 5;
      perimeterLight.range = 20;
      lights.push(perimeterLight);
      this.allLights.push(perimeterLight);
    }

    return { vehicleBay, briefingPlatform, sandbags, crates, lights };
  }

  // -- FOB sub-builders --

  /**
   * Command Post: L-shaped building on the left side of the staging area.
   * Built from Wall_5 walls, DoorSingle_Wall, Column_Slim, rooftiles, and pipes.
   */
  private buildFOBCommandPost(lights: PointLight[]): void {
    const ox = -22; // origin x
    const oz = -8; // origin z
    const scale = 1.4;

    // Back wall (2 segments)
    this.placeModular(GLB.wall5, 'cmd_backwall_0', ox, 0, oz, 0, scale);
    this.placeModular(GLB.wall5, 'cmd_backwall_1', ox + 5.55 * scale, 0, oz, 0, scale);

    // Left wall
    this.placeModular(GLB.wall5, 'cmd_leftwall', ox, 0, oz, Math.PI / 2, scale);

    // Right wall with door
    this.placeModular(GLB.doorSglA, 'cmd_door_r', ox + 5.55 * scale * 2, 0, oz, Math.PI / 2, scale);

    // Front wall -- second segment is a door for access
    this.placeModular(GLB.wall5, 'cmd_frontwall_0', ox, 0, oz + 4 * scale, 0, scale);
    this.placeModular(GLB.doorSglA, 'cmd_frontdoor', ox + 5.55 * scale, 0, oz + 4 * scale, 0, scale);

    // Corner columns
    this.placeModular(GLB.columnSlim, 'cmd_col_0', ox, 0, oz, 0, scale);
    this.placeModular(GLB.columnSlim, 'cmd_col_1', ox + 5.55 * scale * 2, 0, oz, 0, scale);
    this.placeModular(GLB.columnSlim, 'cmd_col_2', ox, 0, oz + 4 * scale, 0, scale);
    this.placeModular(GLB.columnSlim, 'cmd_col_3', ox + 5.55 * scale * 2, 0, oz + 4 * scale, 0, scale);

    // Roof tiles with pipes
    this.placeModular(GLB.roofCornerPipes, 'cmd_roof_0', ox, 3.09 * scale, oz, 0, scale);
    this.placeModular(GLB.roofVents, 'cmd_roof_1', ox + 5.55 * scale, 3.09 * scale, oz, 0, scale);
    this.placeModular(GLB.roofSidesPipes, 'cmd_roof_2', ox, 3.09 * scale, oz + 4 * scale, 0, scale);

    // Pipes along the exterior
    this.placeModular(GLB.pipes, 'cmd_pipes_0', ox - 0.5, 1.5, oz + 2 * scale, 0, scale * 0.8);
    this.placeModular(GLB.pipes, 'cmd_pipes_1', ox + 5.55 * scale * 2 + 0.5, 1.5, oz + 2 * scale, Math.PI, scale * 0.8);

    // Detail outputs (exhaust vents)
    this.placeModular(GLB.detailOutput, 'cmd_vent_0', ox - 0.3, 2.8, oz + 1, Math.PI / 2, scale * 0.6);
    this.placeModular(GLB.detailOutputSm, 'cmd_vent_1', ox - 0.3, 2.0, oz + 3, Math.PI / 2, scale * 0.5);

    // Interior light
    const cmdLight = new PointLight(
      'cmdPostLight',
      new Vector3(ox + 5, 3.5, oz + 2),
      this.scene
    );
    cmdLight.diffuse = new Color3(0.9, 0.85, 0.7);
    cmdLight.intensity = 4;
    cmdLight.range = 12;
    lights.push(cmdLight);
    this.allLights.push(cmdLight);
  }

  /**
   * Armory / Supply Depot: building on the right side near the vehicle bay.
   * Uses doors, walls, containers.
   */
  private buildFOBArmory(lights: PointLight[]): void {
    const ox = 8;
    const oz = -25;
    const scale = 1.4;

    // Back wall (long segment with double door)
    this.placeModular(GLB.wall5, 'arm_backwall_0', ox, 0, oz, 0, scale);
    this.placeModular(GLB.doorDblLong, 'arm_dbl_door', ox + 5.55 * scale, 0, oz, 0, scale);
    this.placeModular(GLB.wall5, 'arm_backwall_2', ox + 5.55 * scale * 2, 0, oz, 0, scale);

    // Side walls
    this.placeModular(GLB.wall5, 'arm_leftwall', ox, 0, oz, Math.PI / 2, scale);
    this.placeModular(GLB.doorSglB, 'arm_rightdoor', ox + 5.55 * scale * 3, 0, oz, Math.PI / 2, scale);

    // Front wall
    this.placeModular(GLB.wall5, 'arm_frontwall_0', ox, 0, oz + 4 * scale, 0, scale);
    this.placeModular(GLB.doorSglLong, 'arm_frontdoor', ox + 5.55 * scale, 0, oz + 4 * scale, 0, scale);
    this.placeModular(GLB.wall5, 'arm_frontwall_2', ox + 5.55 * scale * 2, 0, oz + 4 * scale, 0, scale);

    // Columns at corners
    for (let c = 0; c < 4; c++) {
      const cx = ox + (c % 2 === 0 ? 0 : 5.55 * scale * 3);
      const cz = oz + (c < 2 ? 0 : 4 * scale);
      this.placeModular(GLB.columnSlim, `arm_col_${c}`, cx, 0, cz, 0, scale);
    }

    // Roof - mix of pipe variants and orange vent
    this.placeModular(GLB.roofCornerPipes, 'arm_roof_0', ox, 3.09 * scale, oz, 0, scale);
    this.placeModular(GLB.roofOrangeVent, 'arm_roof_1', ox + 5.55 * scale, 3.09 * scale, oz, 0, scale);
    this.placeModular(GLB.roofInnerPipes, 'arm_roof_2', ox + 5.55 * scale * 2, 3.09 * scale, oz, 0, scale);

    // Interior light
    const armLight = new PointLight(
      'armoryLight',
      new Vector3(ox + 10, 3.5, oz + 2.5),
      this.scene
    );
    armLight.diffuse = new Color3(1.0, 0.85, 0.6);
    armLight.intensity = 5;
    armLight.range = 14;
    lights.push(armLight);
    this.allLights.push(armLight);
  }

  /**
   * Perimeter fence: Wall_5 segments around the FOB with opening to the south.
   * Creates sandbag-equivalent cover positions for marines.
   */
  private buildFOBPerimeter(sandbags: Mesh[]): void {
    const scale = 1.4;
    const segWidth = 5.55 * scale; // ~7.77
    const perimZ = -38; // front line of perimeter

    // Front perimeter wall (left section)
    for (let i = 0; i < 3; i++) {
      this.placeModular(GLB.wall5, `perim_front_L_${i}`, -30 + i * segWidth, 0, perimZ, 0, scale);
    }

    // Front perimeter wall (right section) -- gap in center for vehicle exit
    for (let i = 0; i < 3; i++) {
      this.placeModular(GLB.wall5, `perim_front_R_${i}`, 8 + i * segWidth, 0, perimZ, 0, scale);
    }

    // Left perimeter wall
    for (let i = 0; i < 3; i++) {
      this.placeModular(GLB.wall5, `perim_left_${i}`, -32, 0, -5 - i * 4 * scale, Math.PI / 2, scale);
    }

    // Right perimeter wall
    for (let i = 0; i < 3; i++) {
      this.placeModular(GLB.wall5, `perim_right_${i}`, 32, 0, -5 - i * 4 * scale, Math.PI / 2, scale);
    }

    // Barricade cover positions at the gate opening (GLB barricades)
    const barricadeGlbs = [
      GLB.barricadeB1, GLB.barricadeB2, GLB.barricadeB3,
      GLB.barricadeB4, GLB.barricadeB1,
    ];

    const sandbagPositions = [
      { x: -7, z: perimZ - 2, rot: 0 },
      { x: 7, z: perimZ - 2, rot: 0 },
      { x: 0, z: perimZ - 4, rot: 0 },
      { x: -4, z: perimZ - 6, rot: Math.PI / 8 },
      { x: 4, z: perimZ - 6, rot: -Math.PI / 8 },
    ];

    for (let i = 0; i < sandbagPositions.length; i++) {
      const pos = sandbagPositions[i];
      const barricadeNode = glbInstance(barricadeGlbs[i], `sandbag_staging_${i}`, this.scene, 'prop');
      if (barricadeNode) {
        barricadeNode.position.set(pos.x, 0, pos.z);
        barricadeNode.rotation.y = pos.rot;
        barricadeNode.scaling.setAll(1.8);
        this.allNodes.push(barricadeNode);

        // Invisible collision proxy for cover
        const coverProxy = MeshBuilder.CreateBox(
          `sandbag_cover_${i}`,
          { width: 5, height: 1.2, depth: 1 },
          this.scene
        );
        coverProxy.position.set(pos.x, 0.6, pos.z);
        coverProxy.rotation.y = pos.rot;
        coverProxy.isVisible = false;
        sandbags.push(coverProxy);
        this.allMeshes.push(coverProxy);
      }
    }
  }

  /**
   * Supply props: containers, chests, base platforms, crates scattered inside FOB.
   */
  private buildFOBSupplyProps(crates: Mesh[]): void {
    // Containers (large shipping containers)
    const containerPlacements = [
      { x: 20, z: -22, rot: 0.1, s: 1.6 },
      { x: 24, z: -20, rot: -0.2, s: 1.4 },
      { x: -18, z: -18, rot: 0.3, s: 1.5 },
    ];
    for (let i = 0; i < containerPlacements.length; i++) {
      const cp = containerPlacements[i];
      const node = glbInstance(GLB.containerFull, `fob_container_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(cp.x, 0, cp.z);
        node.rotation.y = cp.rot;
        node.scaling.setAll(cp.s);
        this.allNodes.push(node);
      }
    }

    // Chests (ammo / supply crates)
    const chestPlacements = [
      { x: -14, z: -12, rot: 0.5, s: 1.2 },
      { x: -10, z: -15, rot: -0.1, s: 1.0 },
      { x: 12, z: -14, rot: 0.8, s: 1.1 },
      { x: -16, z: -22, rot: 0.2, s: 1.3 },
    ];
    for (let i = 0; i < chestPlacements.length; i++) {
      const ch = chestPlacements[i];
      const node = glbInstance(GLB.chest, `fob_chest_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(ch.x, 0, ch.z);
        node.rotation.y = ch.rot;
        node.scaling.setAll(ch.s);
        this.allNodes.push(node);
      }
    }

    // Base platform props (equipment / generators)
    const basePlacements = [
      { x: -6, z: -20, rot: 0, s: 1.4 },
      { x: 5, z: -30, rot: Math.PI / 4, s: 1.2 },
      { x: 18, z: -30, rot: Math.PI / 2, s: 1.0 },
    ];
    for (let i = 0; i < basePlacements.length; i++) {
      const bp = basePlacements[i];
      const node = glbInstance(GLB.base, `fob_base_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(bp.x, 0, bp.z);
        node.rotation.y = bp.rot;
        node.scaling.setAll(bp.s);
        this.allNodes.push(node);
      }
    }

    // Extra detail pipes along the FOB interior
    const pipePlacements = [
      { x: -20, y: 1.2, z: -15, rot: 0, s: 1.2 },
      { x: 26, y: 1.2, z: -16, rot: Math.PI, s: 1.0 },
    ];
    for (let i = 0; i < pipePlacements.length; i++) {
      const pp = pipePlacements[i];
      const node = glbInstance(GLB.pipes, `fob_pipes_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(pp.x, pp.y, pp.z);
        node.rotation.y = pp.rot;
        node.scaling.setAll(pp.s);
        this.allNodes.push(node);
      }
    }

    // Wooden crate GLBs for visual density
    const crateGlbs = [GLB.woodenCrate1, GLB.woodenCrate2a, GLB.woodenCrate3];

    for (let i = 0; i < 6; i++) {
      const crateNode = glbInstance(crateGlbs[i % crateGlbs.length], `crate_staging_${i}`, this.scene, 'prop');
      if (crateNode) {
        crateNode.position.set(
          -12 + Math.random() * 8,
          0,
          -15 - Math.random() * 10
        );
        crateNode.rotation.y = Math.random() * 0.3;
        crateNode.scaling.setAll(0.8 + Math.random() * 0.4);
        this.allNodes.push(crateNode);

        // Invisible collision proxy for the crate
        const coverProxy = MeshBuilder.CreateBox(
          `crate_cover_${i}`,
          { width: 1.2, height: 0.8, depth: 1.0 },
          this.scene
        );
        coverProxy.position.copyFrom(crateNode.position);
        coverProxy.position.y = 0.4;
        coverProxy.isVisible = false;
        crates.push(coverProxy);
        this.allMeshes.push(coverProxy);
      }
    }
  }

  /**
   * Poster decals placed on FOB wall surfaces for environmental storytelling.
   */
  private buildPosterDecals(): void {
    // Poster 15 on command post exterior wall
    const p15 = glbInstance(GLB.poster15, 'poster_cmd_15', this.scene, 'prop');
    if (p15) {
      p15.position.set(-22.3, 1.8, -6);
      p15.rotation.y = Math.PI / 2;
      p15.scaling.setAll(1.0);
      this.allNodes.push(p15);
    }

    // Poster 16 on armory front
    const p16a = glbInstance(GLB.poster16, 'poster_arm_16', this.scene, 'prop');
    if (p16a) {
      p16a.position.set(12, 1.6, -19.3);
      p16a.rotation.y = 0;
      p16a.scaling.setAll(1.0);
      this.allNodes.push(p16a);
    }

    // Second poster 15 near the perimeter gate
    const p15b = glbInstance(GLB.poster15, 'poster_perim_15', this.scene, 'prop');
    if (p15b) {
      p15b.position.set(-5, 1.5, -38.3);
      p15b.rotation.y = 0;
      p15b.scaling.setAll(0.9);
      this.allNodes.push(p15b);
    }

    // Poster 16 on right perimeter wall
    const p16b = glbInstance(GLB.poster16, 'poster_perim_16', this.scene, 'prop');
    if (p16b) {
      p16b.position.set(31.7, 1.8, -12);
      p16b.rotation.y = -Math.PI / 2;
      p16b.scaling.setAll(0.85);
      this.allNodes.push(p16b);
    }
  }

  // ============================================================================
  // OPEN FIELD (z: -50 to -400) -- Station backdrop + boulders
  // ============================================================================

  /**
   * Create cover objects scattered across the open field.
   * Also places station06 on the horizon as a command station backdrop.
   */
  createFieldCover(): Fortification[] {
    const fortifications: Fortification[] = [];

    // -----------------------------------------------------------------------
    // STATION06: distant command station visible on the horizon
    // -----------------------------------------------------------------------
    const station = glbInstance(GLB.station06, 'horizon_station06', this.scene, 'environment');
    if (station) {
      station.position.set(120, 15, -500);
      station.scaling.setAll(6);
      station.rotation.y = -0.4;
      this.allNodes.push(station);
    }

    // -----------------------------------------------------------------------
    // Boulders -- alien rock GLBs for organic battlefield cover
    // -----------------------------------------------------------------------
    const boulderGlbs = [
      GLB.boulderPolyhaven,
      GLB.rockMedium1,
      GLB.rockMedium2,
      GLB.rockMedium3,
    ];

    const boulderPositions = [
      new Vector3(-40, 0, -100),
      new Vector3(30, 0, -150),
      new Vector3(-20, 0, -200),
      new Vector3(50, 0, -250),
      new Vector3(-55, 0, -300),
      new Vector3(15, 0, -350),
      new Vector3(-35, 0, -180),
      new Vector3(45, 0, -280),
    ];

    for (let i = 0; i < boulderPositions.length; i++) {
      const size = 3 + Math.random() * 4;
      const glbPath = boulderGlbs[i % boulderGlbs.length];
      const boulderNode = glbInstance(glbPath, `boulder_${i}`, this.scene, 'environment');
      if (boulderNode) {
        boulderNode.position = boulderPositions[i].clone();
        boulderNode.position.y = size * 0.2;
        boulderNode.scaling.setAll(size * 0.5);
        boulderNode.rotation.y = Math.random() * Math.PI;
        this.allNodes.push(boulderNode);

        // Invisible collision proxy for cover system
        const coverProxy = MeshBuilder.CreateBox(
          `boulder_cover_${i}`,
          { width: size, height: size * 0.6, depth: size },
          this.scene
        );
        coverProxy.position = boulderPositions[i].clone();
        coverProxy.position.y = size * 0.3;
        coverProxy.isVisible = false;
        this.allMeshes.push(coverProxy);

        fortifications.push({
          mesh: coverProxy,
          position: boulderNode.position.clone(),
          type: 'rock',
          provideCover: true,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Barricade positions -- containers + base props for additional cover
    // -----------------------------------------------------------------------
    const barricadeContainerPositions = [
      { x: -25, z: -120, rot: 0.3, s: 1.6 },
      { x: 35, z: -180, rot: -0.5, s: 1.8 },
      { x: -45, z: -260, rot: 0.1, s: 1.5 },
      { x: 60, z: -320, rot: -0.2, s: 1.7 },
    ];
    for (let i = 0; i < barricadeContainerPositions.length; i++) {
      const bp = barricadeContainerPositions[i];
      const node = glbInstance(GLB.containerFull, `field_container_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(bp.x, 0, bp.z);
        node.rotation.y = bp.rot;
        node.scaling.setAll(bp.s);
        this.allNodes.push(node);

        // Register as cover for marines
        fortifications.push({
          mesh: MeshBuilder.CreateBox(`field_container_cover_${i}`, { width: 3, height: 2, depth: 5 }, this.scene),
          position: new Vector3(bp.x, 1, bp.z),
          type: 'crate',
          provideCover: true,
        });
        // Hide the cover collision proxy
        fortifications[fortifications.length - 1].mesh.isVisible = false;
        this.allMeshes.push(fortifications[fortifications.length - 1].mesh);
      }
    }

    // -----------------------------------------------------------------------
    // Terrain ridges -- alien rock GLBs arranged as elongated cover ridges
    // -----------------------------------------------------------------------
    const ridgeGlbs = [GLB.rockMedium1, GLB.rockMedium2, GLB.rockMedium3, GLB.boulderPolyhaven, GLB.rockMedium1];

    for (let i = 0; i < 5; i++) {
      const ridgeWidth = 15 + Math.random() * 10;
      const ridgeHeight = 1.5 + Math.random() * 1;
      const ridgeX = (Math.random() - 0.5) * 100;
      const ridgeZ = -80 - i * 60 - Math.random() * 30;
      const ridgeRotY = (Math.random() - 0.5) * 0.4;

      // Place 3 rock GLBs side-by-side to form the ridge line
      for (let r = 0; r < 3; r++) {
        const rockNode = glbInstance(ridgeGlbs[(i + r) % ridgeGlbs.length], `ridge_rock_${i}_${r}`, this.scene, 'environment');
        if (rockNode) {
          rockNode.position.set(
            ridgeX + (r - 1) * ridgeWidth * 0.3,
            0,
            ridgeZ + (Math.random() - 0.5) * 1.5
          );
          rockNode.scaling.set(ridgeWidth * 0.12, ridgeHeight * 0.8, ridgeWidth * 0.06);
          rockNode.rotation.y = ridgeRotY + (Math.random() - 0.5) * 0.3;
          this.allNodes.push(rockNode);
        }
      }

      // Invisible collision proxy for cover system
      const ridgeCover = MeshBuilder.CreateBox(
        `ridge_cover_${i}`,
        { width: ridgeWidth, height: ridgeHeight, depth: 2 + Math.random() },
        this.scene
      );
      ridgeCover.position.set(ridgeX, 0.5, ridgeZ);
      ridgeCover.rotation.y = ridgeRotY;
      ridgeCover.isVisible = false;
      this.allMeshes.push(ridgeCover);

      fortifications.push({
        mesh: ridgeCover,
        position: ridgeCover.position.clone(),
        type: 'rock',
        provideCover: true,
      });
    }

    return fortifications;
  }

  /**
   * Create destroyed vehicle wrecks using GLB debris assets
   */
  createDestroyedVehicles(): DestroyedVehicle[] {
    const wrecks: DestroyedVehicle[] = [];

    // GLB assets for wreckage composition
    const wreckGlbs = {
      scrap: [GLB.scrapMetal1, GLB.scrapMetal1a, GLB.scrapMetal1b],
      barrels: [GLB.metalBarrel1, GLB.metalBarrel2, GLB.metalBarrel3, GLB.metalBarrel4],
      tires: [GLB.tire1, GLB.tire2],
      boards: [GLB.woodenBoard1, GLB.woodenBoard2, GLB.woodenBoard3],
      planks: [GLB.woodenPlank1, GLB.woodenPlank2, GLB.woodenPlank3],
      gravel: [GLB.gravelPile1, GLB.gravelPile2],
      debris: [GLB.debrisBricks1, GLB.debrisBricks2],
    };

    // Helper to create a debris cluster for a wreck
    const createDebrisCluster = (
      baseName: string,
      centerX: number,
      centerZ: number,
      spread: number,
      scrapCount: number,
      barrelCount: number,
      tireCount: number
    ): TransformNode => {
      const clusterRoot = new TransformNode(`${baseName}_cluster`, this.scene);
      clusterRoot.position.set(centerX, 0, centerZ);
      this.allNodes.push(clusterRoot);

      // Add scrap metal pieces
      for (let i = 0; i < scrapCount; i++) {
        const scrapNode = glbInstance(
          wreckGlbs.scrap[i % wreckGlbs.scrap.length],
          `${baseName}_scrap_${i}`,
          this.scene,
          'prop'
        );
        if (scrapNode) {
          scrapNode.position.set(
            (Math.random() - 0.5) * spread,
            0.2,
            (Math.random() - 0.5) * spread
          );
          scrapNode.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.3
          );
          scrapNode.scaling.setAll(1.5 + Math.random() * 1.0);
          scrapNode.parent = clusterRoot;
          this.allNodes.push(scrapNode);
        }
      }

      // Add barrels (some tilted/fallen)
      for (let i = 0; i < barrelCount; i++) {
        const barrelNode = glbInstance(
          wreckGlbs.barrels[i % wreckGlbs.barrels.length],
          `${baseName}_barrel_${i}`,
          this.scene,
          'prop'
        );
        if (barrelNode) {
          barrelNode.position.set(
            (Math.random() - 0.5) * spread * 0.8,
            0,
            (Math.random() - 0.5) * spread * 0.8
          );
          barrelNode.rotation.set(
            Math.random() > 0.5 ? Math.PI / 3 : 0,
            Math.random() * Math.PI * 2,
            Math.random() > 0.7 ? Math.PI / 4 : 0
          );
          barrelNode.scaling.setAll(1.0 + Math.random() * 0.3);
          barrelNode.parent = clusterRoot;
          this.allNodes.push(barrelNode);
        }
      }

      // Add tires scattered around
      for (let i = 0; i < tireCount; i++) {
        const tireNode = glbInstance(
          wreckGlbs.tires[i % wreckGlbs.tires.length],
          `${baseName}_tire_${i}`,
          this.scene,
          'prop'
        );
        if (tireNode) {
          tireNode.position.set(
            (Math.random() - 0.5) * spread * 1.2,
            0.15,
            (Math.random() - 0.5) * spread * 1.2
          );
          tireNode.rotation.set(
            Math.PI / 2 * (Math.random() > 0.5 ? 1 : 0),
            Math.random() * Math.PI * 2,
            0
          );
          tireNode.scaling.setAll(1.2);
          tireNode.parent = clusterRoot;
          this.allNodes.push(tireNode);
        }
      }

      return clusterRoot;
    };

    // Warthog wreck -- overturned light vehicle (scrap + tires)
    const warthogPos = new Vector3(-30, 0, -120);
    createDebrisCluster('wreck_warthog', warthogPos.x, warthogPos.z, 6, 4, 2, 4);

    // Add gravel/debris around warthog wreck
    const warthogGravel = glbInstance(GLB.gravelPile1, 'wreck_warthog_gravel', this.scene, 'prop');
    if (warthogGravel) {
      warthogGravel.position.set(warthogPos.x, 0, warthogPos.z);
      warthogGravel.scaling.setAll(0.6);
      this.allNodes.push(warthogGravel);
    }

    // Invisible collision proxy for warthog wreck
    const warthogProxy = MeshBuilder.CreateBox(
      'wreck_warthog_proxy',
      { width: 5, height: 2, depth: 6 },
      this.scene
    );
    warthogProxy.position.set(warthogPos.x, 1, warthogPos.z);
    warthogProxy.isVisible = false;
    this.allMeshes.push(warthogProxy);

    wrecks.push({
      mesh: warthogProxy,
      position: warthogPos.clone(),
      type: 'warthog',
    });

    // Scorpion wreck -- heavier tank debris (more scrap, fewer tires)
    const scorpionPos = new Vector3(40, 0, -230);
    createDebrisCluster('wreck_scorpion', scorpionPos.x, scorpionPos.z, 10, 8, 4, 2);

    // Add main hull debris pieces for scorpion
    const scorpionDebris = glbInstance(GLB.debrisBricks1, 'wreck_scorpion_debris', this.scene, 'prop');
    if (scorpionDebris) {
      scorpionDebris.position.set(scorpionPos.x + 2, 0, scorpionPos.z);
      scorpionDebris.scaling.setAll(1.5);
      this.allNodes.push(scorpionDebris);
    }

    // Blown turret as separate scrap cluster offset from hull
    createDebrisCluster('wreck_scorpion_turret', scorpionPos.x + 5, scorpionPos.z + 3, 4, 3, 1, 0);

    // Invisible collision proxy for scorpion wreck
    const scorpionProxy = MeshBuilder.CreateBox(
      'wreck_scorpion_proxy',
      { width: 6, height: 2.5, depth: 10 },
      this.scene
    );
    scorpionProxy.position.set(scorpionPos.x, 1.2, scorpionPos.z);
    scorpionProxy.isVisible = false;
    this.allMeshes.push(scorpionProxy);

    wrecks.push({
      mesh: scorpionProxy,
      position: scorpionPos.clone(),
      type: 'scorpion',
    });

    // Pelican wreck -- large crashed dropship (massive debris field)
    const pelicanPos = new Vector3(-50, 0, -320);
    createDebrisCluster('wreck_pelican', pelicanPos.x, pelicanPos.z, 16, 12, 6, 4);

    // Add large gravel pile for crash impact crater
    const pelicanGravel1 = glbInstance(GLB.gravelPile2, 'wreck_pelican_gravel1', this.scene, 'prop');
    if (pelicanGravel1) {
      pelicanGravel1.position.set(pelicanPos.x - 3, 0, pelicanPos.z);
      pelicanGravel1.scaling.setAll(1.0);
      this.allNodes.push(pelicanGravel1);
    }
    const pelicanGravel2 = glbInstance(GLB.gravelPile1, 'wreck_pelican_gravel2', this.scene, 'prop');
    if (pelicanGravel2) {
      pelicanGravel2.position.set(pelicanPos.x + 4, 0, pelicanPos.z - 2);
      pelicanGravel2.scaling.setAll(0.8);
      this.allNodes.push(pelicanGravel2);
    }

    // Wing section debris offset
    const wingPos = new Vector3(pelicanPos.x + 10, 0, pelicanPos.z + 6);
    createDebrisCluster('wreck_pelican_wing', wingPos.x, wingPos.z, 8, 5, 2, 0);

    // Add scattered boards/planks for fuselage remains
    const plankGlbs = [GLB.woodenPlank1, GLB.woodenPlank2, GLB.woodenPlank3];
    for (let i = 0; i < 6; i++) {
      const plankNode = glbInstance(
        plankGlbs[i % plankGlbs.length],
        `wreck_pelican_plank_${i}`,
        this.scene,
        'prop'
      );
      if (plankNode) {
        plankNode.position.set(
          pelicanPos.x + (Math.random() - 0.5) * 20,
          0.1,
          pelicanPos.z + (Math.random() - 0.5) * 20
        );
        plankNode.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
        plankNode.scaling.setAll(1.0 + Math.random() * 0.5);
        this.allNodes.push(plankNode);
      }
    }

    // Invisible collision proxy for pelican wreck
    const pelicanProxy = MeshBuilder.CreateBox(
      'wreck_pelican_proxy',
      { width: 10, height: 4, depth: 18 },
      this.scene
    );
    pelicanProxy.position.set(pelicanPos.x, 2, pelicanPos.z);
    pelicanProxy.isVisible = false;
    this.allMeshes.push(pelicanProxy);

    wrecks.push({
      mesh: pelicanProxy,
      position: pelicanPos.clone(),
      type: 'pelican',
    });

    return wrecks;
  }

  /**
   * Create AA turret emplacements (destructible objectives in Phase 2)
   * Uses twisted tree GLBs for organic alien structure look
   */
  createAATurrets(): AATurret[] {
    const turrets: AATurret[] = [];

    const turretPositions = [
      new Vector3(-60, 0, -180),
      new Vector3(55, 0, -220),
      new Vector3(-45, 0, -300),
      new Vector3(65, 0, -340),
    ];

    // GLBs for organic turret construction
    const baseGlbs = [GLB.twistedTree1, GLB.twistedTree2, GLB.twistedTree3, GLB.twistedTree4];
    const barrelGlbs = [GLB.deadTree1, GLB.deadTree2, GLB.deadTree3];
    const growthGlbs = [
      GLB.mushroom01, GLB.mushroom02, GLB.mushroom03, GLB.mushroom04,
      GLB.mushroomBrown, GLB.mushroomRed, GLB.mushroom07, GLB.mushroom08,
    ];

    for (let i = 0; i < turretPositions.length; i++) {
      const rootNode = new TransformNode(`aaTurret_${i}`, this.scene);
      rootNode.position = turretPositions[i].clone();
      this.allNodes.push(rootNode);

      // Organic base -- twisted tree GLB as the main structure
      const baseNode = glbInstance(baseGlbs[i % baseGlbs.length], `turretBase_glb_${i}`, this.scene, 'environment');
      if (baseNode) {
        baseNode.position.y = 0;
        baseNode.scaling.setAll(0.8);
        baseNode.parent = rootNode;
        this.allNodes.push(baseNode);
      }

      // Invisible collision proxy for base (gameplay collision)
      const base = MeshBuilder.CreateCylinder(
        `turretBase_${i}`,
        { height: 3, diameterTop: 4, diameterBottom: 6, tessellation: 8 },
        this.scene
      );
      base.position.y = 1.5;
      base.parent = rootNode;
      base.isVisible = false;
      this.allMeshes.push(base);

      // Barrel assembly -- dead tree GLB angled upward as the weapon
      const barrelNode = glbInstance(barrelGlbs[i % barrelGlbs.length], `turretBarrel_glb_${i}`, this.scene, 'environment');
      if (barrelNode) {
        barrelNode.position.set(0, 2.5, 0.5);
        barrelNode.scaling.set(0.3, 0.6, 0.3);
        barrelNode.rotation.x = -Math.PI / 4;
        barrelNode.parent = rootNode;
        this.allNodes.push(barrelNode);
      }

      // Invisible collision proxy for barrel (gameplay collision)
      const barrel = MeshBuilder.CreateCylinder(
        `turretBarrel_${i}`,
        { height: 5, diameterTop: 0.4, diameterBottom: 0.8, tessellation: 6 },
        this.scene
      );
      barrel.position.y = 3.5;
      barrel.rotation.x = -Math.PI / 4;
      barrel.parent = rootNode;
      barrel.isVisible = false;
      this.allMeshes.push(barrel);

      // Organic growths around base (alien mushroom GLBs)
      for (let g = 0; g < 6; g++) {
        const growthNode = glbInstance(growthGlbs[g % growthGlbs.length], `turretGrowth_${i}_${g}`, this.scene, 'prop');
        if (growthNode) {
          const gAngle = (g / 6) * Math.PI * 2;
          const gRadius = 2.5 + Math.random() * 2;
          growthNode.position.set(
            turretPositions[i].x + Math.cos(gAngle) * gRadius,
            0,
            turretPositions[i].z + Math.sin(gAngle) * gRadius
          );
          growthNode.scaling.setAll(0.6 + Math.random() * 0.5);
          growthNode.rotation.y = Math.random() * Math.PI * 2;
          this.allNodes.push(growthNode);
        }
      }

      // Add some tall rocks around the turret for cover/visual interest
      const rockNode = glbInstance(GLB.tallRock1, `turretRock_${i}`, this.scene, 'environment');
      if (rockNode) {
        const rockAngle = Math.random() * Math.PI * 2;
        rockNode.position.set(
          turretPositions[i].x + Math.cos(rockAngle) * 5,
          0,
          turretPositions[i].z + Math.sin(rockAngle) * 5
        );
        rockNode.scaling.setAll(1.2 + Math.random() * 0.5);
        rockNode.rotation.y = Math.random() * Math.PI;
        this.allNodes.push(rockNode);
      }

      // Turret warning light
      const warningLight = new PointLight(
        `turretLight_${i}`,
        turretPositions[i].add(new Vector3(0, 5, 0)),
        this.scene
      );
      warningLight.diffuse = new Color3(1, 0.2, 0.1);
      warningLight.intensity = 3;
      warningLight.range = 15;
      this.allLights.push(warningLight);

      turrets.push({
        rootNode,
        baseMesh: base,
        barrelMesh: barrel,
        position: turretPositions[i].clone(),
        health: 200,
        maxHealth: 200,
        destroyed: false,
        fireTimer: 0,
      });
    }

    return turrets;
  }

  // ============================================================================
  // BREACH POINT (z: -400 to -550)
  // ============================================================================

  /**
   * Create fortifications around the hive entrance breach point.
   * Military barricades meet organic hive barriers.
   */
  createBreachFortifications(): Fortification[] {
    const fortifications: Fortification[] = [];

    // Chitin barriers flanking the approach (alien tall rock GLBs)
    const barrierGlbs = [GLB.tallRock1, GLB.tallRock2, GLB.tallRock3];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const depth = -420 - Math.floor(i / 2) * 30;
      const barrierX = side * (20 + Math.random() * 10);
      const barrierRotY = side * 0.2 + (Math.random() - 0.5) * 0.3;

      const barrierNode = glbInstance(barrierGlbs[i % barrierGlbs.length], `breachBarrier_${i}`, this.scene, 'environment');
      if (barrierNode) {
        barrierNode.position.set(barrierX, 0, depth);
        barrierNode.rotation.y = barrierRotY;
        barrierNode.scaling.setAll(1.5 + Math.random() * 0.5);
        this.allNodes.push(barrierNode);

        // Invisible collision proxy for cover
        const coverProxy = MeshBuilder.CreateBox(
          `breachBarrier_cover_${i}`,
          { width: 6, height: 2.5, depth: 1.5 },
          this.scene
        );
        coverProxy.position.set(barrierX, 1.2, depth);
        coverProxy.rotation.y = barrierRotY;
        coverProxy.isVisible = false;
        this.allMeshes.push(coverProxy);

        fortifications.push({
          mesh: coverProxy,
          position: coverProxy.position.clone(),
          type: 'barrier',
          provideCover: true,
        });
      }
    }

    // Military barricade containers on the approach
    const breachContainers = [
      { x: -8, z: -420, rot: 0.1, s: 1.5 },
      { x: 10, z: -450, rot: -0.2, s: 1.6 },
      { x: -5, z: -490, rot: 0, s: 1.4 },
    ];
    for (let i = 0; i < breachContainers.length; i++) {
      const bc = breachContainers[i];
      const node = glbInstance(GLB.containerFull, `breach_container_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(bc.x, 0, bc.z);
        node.rotation.y = bc.rot;
        node.scaling.setAll(bc.s);
        this.allNodes.push(node);
      }
    }

    // Sandbag positions for marine cover
    const coverPositions = [
      new Vector3(-10, 0.5, -430),
      new Vector3(10, 0.5, -430),
      new Vector3(0, 0.5, -460),
      new Vector3(-15, 0.5, -480),
      new Vector3(15, 0.5, -480),
      new Vector3(0, 0.5, -510),
    ];

    const breachBarricadeGlbs = [
      GLB.barricadeA1, GLB.barricadeA2, GLB.barricadeA3,
      GLB.barricadeA1, GLB.barricadeA2, GLB.barricadeA3,
    ];
    for (let i = 0; i < coverPositions.length; i++) {
      const barricadeNode = glbInstance(breachBarricadeGlbs[i], `breachSandbag_${i}`, this.scene, 'prop');
      if (barricadeNode) {
        barricadeNode.position.set(coverPositions[i].x, 0, coverPositions[i].z);
        barricadeNode.scaling.setAll(1.6);
        this.allNodes.push(barricadeNode);

        // Invisible collision proxy for cover
        const coverProxy = MeshBuilder.CreateBox(
          `breachSandbag_cover_${i}`,
          { width: 4, height: 1.2, depth: 1 },
          this.scene
        );
        coverProxy.position = coverPositions[i].clone();
        coverProxy.isVisible = false;
        this.allMeshes.push(coverProxy);

        fortifications.push({
          mesh: coverProxy,
          position: coverPositions[i].clone(),
          type: 'sandbag',
          provideCover: true,
        });
      }
    }

    // Chests near breach sandbag positions (ammo resupply points)
    const breachChests = [
      { x: -12, z: -435, rot: 0.6, s: 1.1 },
      { x: 12, z: -435, rot: -0.3, s: 1.0 },
      { x: 2, z: -465, rot: 0.1, s: 1.2 },
    ];
    for (let i = 0; i < breachChests.length; i++) {
      const bch = breachChests[i];
      const node = glbInstance(GLB.chest, `breach_chest_${i}`, this.scene, 'prop');
      if (node) {
        node.position.set(bch.x, 0, bch.z);
        node.rotation.y = bch.rot;
        node.scaling.setAll(bch.s);
        this.allNodes.push(node);
      }
    }

    return fortifications;
  }

  /**
   * Create acid pools and spore vents near the breach
   */
  createHazards(): { acidPools: Mesh[]; sporeVents: Mesh[] } {
    const acidPools: Mesh[] = [];
    const sporeVents: Mesh[] = [];

    const acidMat = new StandardMaterial('acidMat', this.scene);
    acidMat.diffuseColor = Color3.FromHexString(ENV_COLORS.acidGreen);
    acidMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    acidMat.alpha = 0.7;

    // Acid pools near breach
    const acidPositions = [
      new Vector3(-25, 0.02, -450),
      new Vector3(30, 0.02, -470),
      new Vector3(-10, 0.02, -520),
      new Vector3(20, 0.02, -540),
    ];

    for (let i = 0; i < acidPositions.length; i++) {
      const pool = MeshBuilder.CreateDisc(
        `acidPool_${i}`,
        { radius: 3 + Math.random() * 2, tessellation: 10 },
        this.scene
      );
      pool.material = acidMat;
      pool.position = acidPositions[i];
      pool.rotation.x = Math.PI / 2;
      acidPools.push(pool);
      this.allMeshes.push(pool);
    }

    // Spore vents (alien mushroom tall GLBs)
    const ventPositions = [
      new Vector3(-35, 0, -480),
      new Vector3(40, 0, -500),
      new Vector3(-5, 0, -550),
    ];

    const sporeVentGlbs = [GLB.mushroomTall, GLB.mushroomLaetiporus, GLB.mushroomTall];
    for (let i = 0; i < ventPositions.length; i++) {
      const ventNode = glbInstance(sporeVentGlbs[i], `sporeVent_${i}`, this.scene, 'prop');
      if (ventNode) {
        ventNode.position.set(ventPositions[i].x, 0, ventPositions[i].z);
        ventNode.scaling.setAll(1.2);
        ventNode.rotation.y = Math.random() * Math.PI * 2;
        this.allNodes.push(ventNode);
      }

      // Invisible collision proxy for spore vent interaction
      const ventProxy = MeshBuilder.CreateCylinder(
        `sporeVent_proxy_${i}`,
        { height: 2, diameterTop: 1.5, diameterBottom: 2.5, tessellation: 8 },
        this.scene
      );
      ventProxy.position = ventPositions[i].clone();
      ventProxy.position.y = 1;
      ventProxy.isVisible = false;
      sporeVents.push(ventProxy);
      this.allMeshes.push(ventProxy);

      const ventLight = new PointLight(
        `ventLight_${i}`,
        ventPositions[i].add(new Vector3(0, 2.5, 0)),
        this.scene
      );
      ventLight.diffuse = Color3.FromHexString(ENV_COLORS.sporeYellow);
      ventLight.intensity = 4;
      ventLight.range = 10;
      this.allLights.push(ventLight);
    }

    return { acidPools, sporeVents };
  }

  // ============================================================================
  // HIVE ENTRANCE (z: -550 to -650)
  // ============================================================================

  /**
   * Create the massive organic hive gate using GLB assets
   */
  createHiveEntrance(): HiveEntrance {
    const organicGrowths: Mesh[] = [];
    const bioLights: HiveEntrance['bioLights'] = [];
    const sporeVents: Mesh[] = [];

    // GLBs for massive organic gate structure
    const pillarGlbs = [GLB.twistedTree1, GLB.twistedTree2, GLB.twistedTree3, GLB.twistedTree4, GLB.twistedTree5];
    const archGlbs = [GLB.tree01, GLB.tree02, GLB.spruce01, GLB.spruce02];
    const hiveGrowthGlbs = [
      GLB.mushroom01, GLB.mushroom02, GLB.mushroom03, GLB.mushroom04,
      GLB.mushroom05, GLB.mushroom06, GLB.mushroom07, GLB.mushroom08,
      GLB.mushroomBrown, GLB.mushroomRed, GLB.mushroomLaetiporus,
      GLB.twistedTree1, GLB.twistedTree2,
    ];

    // -----------------------------------------------------------------------
    // Main gate structure -- composed of multiple large twisted tree GLBs
    // -----------------------------------------------------------------------
    const gateRoot = new TransformNode('hiveGate_root', this.scene);
    gateRoot.position.set(0, 0, -600);
    this.allNodes.push(gateRoot);

    // Create gate backdrop using multiple tall twisted trees stacked
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const treeNode = glbInstance(
          pillarGlbs[(row + col) % pillarGlbs.length],
          `hiveGate_tree_${row}_${col}`,
          this.scene,
          'environment'
        );
        if (treeNode) {
          treeNode.position.set(
            -16 + col * 8,
            row * 15,
            0
          );
          treeNode.scaling.set(2.0, 3.0, 2.0);
          treeNode.rotation.y = (row + col) * 0.3;
          treeNode.parent = gateRoot;
          this.allNodes.push(treeNode);
        }
      }
    }

    // Invisible collision proxy for gate (gameplay collision)
    const gateMesh = MeshBuilder.CreateBox(
      'hiveGate',
      { width: 40, height: 50, depth: 8 },
      this.scene
    );
    gateMesh.position.set(0, 25, -600);
    gateMesh.isVisible = false;
    this.allMeshes.push(gateMesh);

    // -----------------------------------------------------------------------
    // Left arch pillar -- massive twisted trees forming organic pillar
    // -----------------------------------------------------------------------
    const archLeftRoot = new TransformNode('archLeft_root', this.scene);
    archLeftRoot.position.set(-25, 0, -600);
    archLeftRoot.rotation.z = 0.08;
    this.allNodes.push(archLeftRoot);

    for (let h = 0; h < 4; h++) {
      const pillarTree = glbInstance(
        pillarGlbs[h % pillarGlbs.length],
        `archLeft_tree_${h}`,
        this.scene,
        'environment'
      );
      if (pillarTree) {
        pillarTree.position.y = h * 12;
        pillarTree.scaling.set(1.5, 3.5, 1.5);
        pillarTree.rotation.y = h * Math.PI / 3;
        pillarTree.parent = archLeftRoot;
        this.allNodes.push(pillarTree);
      }
    }

    // Add arch trees arching inward at top
    const archLeftTop = glbInstance(GLB.tree01, 'archLeft_top', this.scene, 'environment');
    if (archLeftTop) {
      archLeftTop.position.set(8, 45, 0);
      archLeftTop.scaling.set(2.0, 2.5, 2.0);
      archLeftTop.rotation.set(0, 0, Math.PI / 4);
      archLeftTop.parent = archLeftRoot;
      this.allNodes.push(archLeftTop);
    }

    // Invisible collision proxy for left arch
    const archLeft = MeshBuilder.CreateCylinder(
      'archLeft',
      { height: 55, diameterTop: 6, diameterBottom: 10, tessellation: 10 },
      this.scene
    );
    archLeft.position.set(-25, 27.5, -600);
    archLeft.rotation.z = 0.08;
    archLeft.isVisible = false;
    this.allMeshes.push(archLeft);

    // -----------------------------------------------------------------------
    // Right arch pillar -- mirror of left
    // -----------------------------------------------------------------------
    const archRightRoot = new TransformNode('archRight_root', this.scene);
    archRightRoot.position.set(25, 0, -600);
    archRightRoot.rotation.z = -0.08;
    this.allNodes.push(archRightRoot);

    for (let h = 0; h < 4; h++) {
      const pillarTree = glbInstance(
        pillarGlbs[(h + 2) % pillarGlbs.length],
        `archRight_tree_${h}`,
        this.scene,
        'environment'
      );
      if (pillarTree) {
        pillarTree.position.y = h * 12;
        pillarTree.scaling.set(1.5, 3.5, 1.5);
        pillarTree.rotation.y = -h * Math.PI / 3;
        pillarTree.parent = archRightRoot;
        this.allNodes.push(pillarTree);
      }
    }

    // Add arch trees arching inward at top
    const archRightTop = glbInstance(GLB.tree02, 'archRight_top', this.scene, 'environment');
    if (archRightTop) {
      archRightTop.position.set(-8, 45, 0);
      archRightTop.scaling.set(2.0, 2.5, 2.0);
      archRightTop.rotation.set(0, 0, -Math.PI / 4);
      archRightTop.parent = archRightRoot;
      this.allNodes.push(archRightTop);
    }

    // Invisible collision proxy for right arch
    const archRight = MeshBuilder.CreateCylinder(
      'archRight',
      { height: 55, diameterTop: 6, diameterBottom: 10, tessellation: 10 },
      this.scene
    );
    archRight.position.set(25, 27.5, -600);
    archRight.rotation.z = -0.08;
    archRight.isVisible = false;
    this.allMeshes.push(archRight);

    // -----------------------------------------------------------------------
    // Organic growths on pillars and gate (alien flora GLBs)
    // -----------------------------------------------------------------------
    for (let i = 0; i < 25; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const gx = side * (15 + Math.random() * 15);
      const gy = 2 + Math.random() * 45;
      const gz = -598 + (Math.random() - 0.5) * 6;

      const growthNode = glbInstance(
        hiveGrowthGlbs[i % hiveGrowthGlbs.length],
        `hiveGrowth_${i}`,
        this.scene,
        'prop'
      );
      if (growthNode) {
        growthNode.position.set(gx, gy, gz);
        growthNode.scaling.setAll(0.5 + Math.random() * 0.8);
        growthNode.rotation.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.5
        );
        this.allNodes.push(growthNode);
      }

      // Invisible collision proxy to satisfy organicGrowths Mesh[] contract
      const growthProxy = MeshBuilder.CreateSphere(
        `hiveGrowth_proxy_${i}`,
        { diameter: 1.5, segments: 4 },
        this.scene
      );
      growthProxy.position.set(gx, gy, gz);
      growthProxy.isVisible = false;
      organicGrowths.push(growthProxy);
      this.allMeshes.push(growthProxy);
    }

    // Add ground-level mushroom clusters at the base of the gate
    const groundMushroomGlbs = [GLB.mushroomTall, GLB.mushroomLaetiporus, GLB.mushroom05, GLB.mushroom06];
    for (let i = 0; i < 12; i++) {
      const groundMushroom = glbInstance(
        groundMushroomGlbs[i % groundMushroomGlbs.length],
        `hiveGate_groundMushroom_${i}`,
        this.scene,
        'prop'
      );
      if (groundMushroom) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 20 + Math.random() * 15;
        groundMushroom.position.set(
          Math.cos(angle) * radius,
          0,
          -600 + Math.sin(angle) * radius * 0.3
        );
        groundMushroom.scaling.setAll(1.0 + Math.random() * 0.8);
        groundMushroom.rotation.y = Math.random() * Math.PI * 2;
        this.allNodes.push(groundMushroom);
      }
    }

    // -----------------------------------------------------------------------
    // Bioluminescent lights along the entrance -- use mushroom GLBs with glow
    // -----------------------------------------------------------------------
    const bioMat = new StandardMaterial('bioLightMat', this.scene);
    bioMat.emissiveColor = Color3.FromHexString(ENV_COLORS.bioGlow);
    bioMat.disableLighting = true;

    const bioMushroomGlbs = [GLB.mushroom09, GLB.mushroomBrown, GLB.mushroomRed];
    for (let i = 0; i < 12; i++) {
      // Place a small emissive mushroom GLB for visual
      const bioMushroom = glbInstance(
        bioMushroomGlbs[i % bioMushroomGlbs.length],
        `bioMushroom_${i}`,
        this.scene,
        'prop'
      );
      const side = i % 2 === 0 ? -1 : 1;
      const height = 3 + (i / 12) * 40;
      const xPos = side * (18 + Math.random() * 5);
      const zPos = -598 + Math.random() * 2;

      if (bioMushroom) {
        bioMushroom.position.set(xPos, height, zPos);
        bioMushroom.scaling.setAll(0.3 + Math.random() * 0.2);
        this.allNodes.push(bioMushroom);
      }

      // Small glowing sphere for the actual light emission point
      const bulb = MeshBuilder.CreateSphere(
        `bioLight_${i}`,
        { diameter: 0.4 + Math.random() * 0.3, segments: 8 },
        this.scene
      );
      bulb.material = bioMat;
      bulb.position.set(xPos, height + 0.5, zPos);
      this.allMeshes.push(bulb);

      const light = new PointLight(`bioLightPL_${i}`, bulb.position.clone(), this.scene);
      light.diffuse = Color3.FromHexString(ENV_COLORS.bioGlow);
      light.intensity = 2 + Math.random() * 2;
      light.range = 8;

      bioLights.push({
        mesh: bulb,
        light,
        baseIntensity: light.intensity,
        flickerPhase: Math.random() * Math.PI * 2,
      });

      this.allLights.push(light);
    }

    // -----------------------------------------------------------------------
    // Spore vents at the base of the entrance (alien mushroom GLBs)
    // -----------------------------------------------------------------------
    const entranceVentGlbs = [GLB.mushroomTall, GLB.mushroom03, GLB.mushroom05, GLB.mushroom04, GLB.mushroomLaetiporus];
    for (let i = 0; i < 6; i++) {
      const ventX = (i % 2 === 0 ? -1 : 1) * (8 + (i / 2) * 4);
      const ventZ = -588 - Math.random() * 8;

      const ventNode = glbInstance(entranceVentGlbs[i % entranceVentGlbs.length], `entranceVent_${i}`, this.scene, 'prop');
      if (ventNode) {
        ventNode.position.set(ventX, 0, ventZ);
        ventNode.scaling.setAll(0.8 + Math.random() * 0.5);
        ventNode.rotation.y = Math.random() * Math.PI * 2;
        this.allNodes.push(ventNode);
      }

      // Invisible collision proxy for spore vent
      const ventProxy = MeshBuilder.CreateCylinder(
        `entranceVent_proxy_${i}`,
        { height: 1.5, diameterTop: 1, diameterBottom: 2, tessellation: 6 },
        this.scene
      );
      ventProxy.position.set(ventX, 0.75, ventZ);
      ventProxy.isVisible = false;
      sporeVents.push(ventProxy);
      this.allMeshes.push(ventProxy);
    }

    return {
      gateMesh,
      archLeft,
      archRight,
      organicGrowths,
      bioLights,
      sporeVents,
    };
  }

  // ============================================================================
  // CANYON WALLS (Battlefield boundaries)
  // ============================================================================

  /**
   * Create canyon walls that define the battlefield boundaries using rock GLBs
   */
  createCanyonWalls(): Mesh[] {
    const walls: Mesh[] = [];

    // GLBs for canyon wall composition
    const wallRockGlbs = [
      GLB.boulderPolyhaven,
      GLB.rockMedium1,
      GLB.rockMedium2,
      GLB.rockMedium3,
      GLB.tallRock1,
      GLB.tallRock2,
      GLB.tallRock3,
    ];

    // Helper to create a canyon wall segment from multiple rock GLBs
    const createWallSegment = (
      baseName: string,
      centerX: number,
      centerZ: number,
      isLeft: boolean
    ): void => {
      const segmentRoot = new TransformNode(`${baseName}_root`, this.scene);
      segmentRoot.position.set(centerX, 0, centerZ);
      this.allNodes.push(segmentRoot);

      // Place multiple large boulders to form the wall segment
      const rockCount = 4 + Math.floor(Math.random() * 3);
      for (let r = 0; r < rockCount; r++) {
        const rockNode = glbInstance(
          wallRockGlbs[r % wallRockGlbs.length],
          `${baseName}_rock_${r}`,
          this.scene,
          'environment'
        );
        if (rockNode) {
          // Stack rocks vertically with some horizontal offset
          const yOffset = r * 12 + Math.random() * 5;
          const xOffset = (Math.random() - 0.5) * 15;
          const zOffset = (Math.random() - 0.5) * 30;

          rockNode.position.set(xOffset, yOffset, zOffset);
          rockNode.scaling.set(
            8 + Math.random() * 6,
            10 + Math.random() * 8,
            6 + Math.random() * 4
          );
          rockNode.rotation.set(
            (Math.random() - 0.5) * 0.3,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.2
          );
          rockNode.parent = segmentRoot;
          this.allNodes.push(rockNode);
        }
      }

      // Add tall rock spires for visual interest
      const spireCount = 2 + Math.floor(Math.random() * 2);
      const spireGlbs = [GLB.tallRock1, GLB.tallRock2, GLB.tallRock3];
      for (let s = 0; s < spireCount; s++) {
        const spireNode = glbInstance(
          spireGlbs[s % spireGlbs.length],
          `${baseName}_spire_${s}`,
          this.scene,
          'environment'
        );
        if (spireNode) {
          spireNode.position.set(
            (Math.random() - 0.5) * 20,
            30 + Math.random() * 20,
            (Math.random() - 0.5) * 40
          );
          spireNode.scaling.set(4, 12 + Math.random() * 8, 4);
          spireNode.rotation.y = Math.random() * Math.PI * 2;
          spireNode.parent = segmentRoot;
          this.allNodes.push(spireNode);
        }
      }

      // Invisible collision wall for gameplay boundaries
      const wallProxy = MeshBuilder.CreateBox(
        `${baseName}_proxy`,
        { width: 30, height: 80, depth: 100 },
        this.scene
      );
      wallProxy.position.set(centerX, 40, centerZ);
      wallProxy.isVisible = false;
      walls.push(wallProxy);
      this.allMeshes.push(wallProxy);
    };

    // Left wall segments
    for (let i = 0; i < 7; i++) {
      const wallX = -(TERRAIN_WIDTH / 2 + 15) + (Math.random() - 0.5) * 10;
      const wallZ = -i * 100 - 20;
      createWallSegment(`canyonWallL_${i}`, wallX, wallZ, true);
    }

    // Right wall segments
    for (let i = 0; i < 7; i++) {
      const wallX = TERRAIN_WIDTH / 2 + 15 + (Math.random() - 0.5) * 10;
      const wallZ = -i * 100 - 20;
      createWallSegment(`canyonWallR_${i}`, wallX, wallZ, false);
    }

    return walls;
  }

  // ============================================================================
  // PARTICLE / ATMOSPHERIC HELPERS
  // ============================================================================

  /**
   * Update bioluminescent lights with flickering effect
   */
  updateBioLights(bioLights: HiveEntrance['bioLights'], time: number): void {
    for (const bio of bioLights) {
      const flicker = Math.sin(time * 1.5 + bio.flickerPhase) * 0.2 + 0.8;
      bio.light.intensity = bio.baseIntensity * flicker;
    }
  }

  // ============================================================================
  // INTERNAL: Modular GLB placement helper
  // ============================================================================

  /**
   * Place a modular GLB instance at the given world-space position.
   * Returns null if the asset is not cached (graceful degradation).
   */
  private placeModular(
    path: string,
    name: string,
    x: number,
    y: number,
    z: number,
    rotY: number,
    scale: number
  ): TransformNode | null {
    const node = glbInstance(path, name, this.scene, 'environment');
    if (!node) return null;

    node.position.set(x, y, z);
    node.rotation.y = rotY;
    node.scaling.setAll(scale);
    this.allNodes.push(node);
    return node;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    for (const mesh of this.allMeshes) {
      mesh.dispose();
    }
    this.allMeshes = [];

    for (const light of this.allLights) {
      light.dispose();
    }
    this.allLights = [];

    for (const node of this.allNodes) {
      node.dispose();
    }
    this.allNodes = [];

    this.glowLayer?.dispose();
    this.glowLayer = null;

    this.terrainMesh = null;
    this.skyDome = null;
  }
}
