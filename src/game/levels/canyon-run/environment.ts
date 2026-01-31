/**
 * Canyon Run Environment - GLB-enriched canyon terrain and obstacle generation
 *
 * Creates a dramatic canyon environment for the vehicle chase sequence:
 * - Terrain floor with height variation (procedural MeshBuilder)
 * - Canyon walls on both sides with irregular surfaces (MeshBuilder + GLB wall segments)
 * - GLB concrete barriers and barricades along the canyon road
 * - GLB industrial structures (pipes, boilers, water towers, shipping containers)
 * - GLB station/platform pieces as bridges and overpasses
 * - GLB ramp platforms for vehicle jumps
 * - GLB wrecked spaceship in the canyon wall
 * - Rock formations and boulders as obstacles
 * - Bridge structures (intact and collapsed)
 * - Lighting through canyon gaps
 * - Objective waypoint markers
 *
 * The canyon is laid out as a long track along the Z axis:
 *   Z = 0      : Start (player spawns)
 *   Z = -1500  : Bridge crossing (scripted event)
 *   Z = -3000  : Extraction point (level end)
 */

import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { getLogger } from '../../core/Logger';

const log = getLogger('CanyonEnv');
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { SkyboxManager, type SkyboxResult } from '../../core/SkyboxManager';
import {
  CANYON_TERRAIN_CONFIG,
  CANYON_ROCK_CONFIG,
  createPBRTerrainMaterial,
} from '../shared/PBRTerrainMaterials';

// ============================================================================
// TYPES
// ============================================================================

export interface CanyonEnvironment {
  terrain: Mesh;
  leftWalls: Mesh[];
  rightWalls: Mesh[];
  boulders: Mesh[];
  bridges: BridgeStructure[];
  wrecks: TransformNode[];
  vegetation: Mesh[];
  dustEmitters: TransformNode[];
  objectiveMarkers: ObjectiveMarker[];
  sunLight: DirectionalLight;
  canyonLights: PointLight[];
  extractionZone: Mesh;
  /** All loaded GLB prop meshes for lifecycle management */
  glbProps: AbstractMesh[];
}

export interface BridgeStructure {
  mesh: Mesh;
  position: Vector3;
  /** Whether this bridge collapses during gameplay */
  isCollapsible: boolean;
  /** Whether the bridge has already collapsed */
  collapsed: boolean;
  /** Individual deck segments for collapse animation */
  segments: Mesh[];
}

export interface ObjectiveMarker {
  mesh: Mesh;
  beacon: PointLight;
  position: Vector3;
  label: string;
  reached: boolean;
}

export interface TerrainSample {
  height: number;
  isOnBridge: boolean;
  isInWater: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Total canyon length along Z axis */
export const CANYON_LENGTH = 3000;

/** Half-width of the drivable canyon floor */
export const CANYON_HALF_WIDTH = 25;

/** Canyon wall height */
const WALL_HEIGHT = 80;

/** Number of wall segments per side */
const WALL_SEGMENTS = 60;

/** Segment length along Z */
const WALL_SEGMENT_LENGTH = CANYON_LENGTH / WALL_SEGMENTS;

/** Z position of the bridge */
export const BRIDGE_Z = -1500;

/** Z position of the extraction point */
export const EXTRACTION_Z = -2900;

/** Number of boulders to scatter */
const BOULDER_COUNT = 45;

/** Number of wrecked vehicles */
const WRECK_COUNT = 8;

/** Number of vegetation clusters */
const VEGETATION_COUNT = 30;

// Seeded random for deterministic layout
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// GLB MODEL PATHS
// ============================================================================

const GLB = {
  // Barriers and barricades (props/modular)
  barricadeA1: '/models/props/modular/barricade_a_1.glb',
  barricadeA2: '/models/props/modular/barricade_a_2.glb',
  barricadeA3: '/models/props/modular/barricade_a_3.glb',
  barricadeB1: '/models/props/modular/barricade_b_1.glb',
  barricadeB2: '/models/props/modular/barricade_b_2.glb',
  barricadeB3: '/models/props/modular/barricade_b_3.glb',
  barricadeB4: '/models/props/modular/barricade_b_4.glb',
  concreteFence: '/models/props/modular/concrete_fence_hr_1.glb',
  concreteFence2: '/models/props/modular/concrete_fence_hr_2.glb',
  concreteFencePillar: '/models/props/modular/concrete_fence_hr_1_pillar_1.glb',
  concreteFenceCorner: '/models/props/modular/concrete_fence_hr_1_pillar_1_corner.glb',
  metalFence: '/models/props/modular/metal_fence_hr_1.glb',
  metalFenceTall: '/models/props/modular/metal_fence_hr_1_tall.glb',
  metalFencePillar: '/models/props/modular/metal_fence_hr_1_pillar_1.glb',

  // Alien rocks (boulders)
  alienBoulder: '/models/environment/alien-flora/alien_boulder_polyhaven.glb',
  alienRockMed1: '/models/environment/alien-flora/alien_rock_medium_1.glb',
  alienRockMed2: '/models/environment/alien-flora/alien_rock_medium_2.glb',
  alienRockMed3: '/models/environment/alien-flora/alien_rock_medium_3.glb',
  alienTallRock1: '/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  alienTallRock2: '/models/environment/alien-flora/alien_tall_rock_2_01.glb',

  // Alien vegetation
  alienBush: '/models/environment/alien-flora/alien_bush_common.glb',
  alienFern: '/models/environment/alien-flora/alien_fern_1.glb',
  alienGrass: '/models/environment/alien-flora/alien_grass.glb',
  alienIceplant: '/models/environment/alien-flora/alien_iceplant.glb',
  alienMushroom1: '/models/environment/alien-flora/alien_mushroom_01.glb',
  alienMushroom2: '/models/environment/alien-flora/alien_mushroom_02.glb',
  alienDeadTree1: '/models/environment/alien-flora/alien_deadtree_1.glb',
  alienDeadTree2: '/models/environment/alien-flora/alien_deadtree_2.glb',
  alienTwistedTree1: '/models/environment/alien-flora/alien_twistedtree_1.glb',
  alienTwistedTree2: '/models/environment/alien-flora/alien_twistedtree_2.glb',

  // Rockslide debris
  rockBrick1: '/models/props/debris/brick_mx_1.glb',
  rockBrick2: '/models/props/debris/brick_mx_2.glb',
  rockBrick3: '/models/props/debris/brick_mx_3.glb',
  rockBrick4: '/models/props/debris/brick_mx_4.glb',
  rockBrickStacked1: '/models/props/debris/bricks_stacked_mx_1.glb',
  rockBrickStacked2: '/models/props/debris/bricks_stacked_mx_2.glb',

  // Bridge structure parts (pillars and handrails)
  bridgePillarHr2: '/models/environment/station/pillar_hr_2.glb',
  bridgePillarHr4: '/models/environment/station/pillar_hr_4.glb',
  bridgeHandrail1: '/models/environment/station/platform_b_handrail_1.glb',
  bridgeHandrail2: '/models/environment/station/platform_b_handrail_2.glb',

  // Industrial structures
  boiler: '/models/environment/industrial/boiler_hx_4.glb',
  waterTower: '/models/environment/industrial/water_tower_hm_1.glb',
  storageTank: '/models/environment/industrial/storage_tank_mx_1.glb',
  tankSystem: '/models/environment/industrial/tank_system_mx_1.glb',
  shippingContainer1: '/models/environment/industrial/shipping_container_mx_1.glb',
  shippingContainer2: '/models/environment/industrial/shipping_container_mx_2.glb',
  shippingContainerHollow: '/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
  cage: '/models/environment/industrial/cage_mx_1.glb',
  machinery: '/models/environment/industrial/machinery_mx_1.glb',
  distillery: '/models/environment/industrial/distillery_mx_1.glb',
  chimney1: '/models/environment/industrial/chimney_a_1.glb',
  chimney2: '/models/environment/industrial/chimney_a_2.glb',
  chimney3: '/models/environment/industrial/chimney_a_3.glb',
  pipes: '/models/environment/industrial/pipes_hr_1.glb',
  pipeElbow: '/models/environment/industrial/pipes_hr_1_elbow_1.glb',
  pipeHorizMid1: '/models/environment/industrial/pipes_hr_1_horizontal_middle_1.glb',
  pipeHorizMid2: '/models/environment/industrial/pipes_hr_1_horizontal_middle_2.glb',
  warehouse: '/models/environment/industrial/warehouse_hl_1.glb',
  electricalEquip1: '/models/environment/industrial/electrical_equipment_1.glb',
  electricalEquip2: '/models/environment/industrial/electrical_equipment_2.glb',
  portal: '/models/environment/industrial/portal_mx_1.glb',
  platform: '/models/environment/industrial/platform_mx_1.glb',

  // Station pieces (ramps, platforms, asphalt, pipes)
  rampSlim: '/models/environment/station/ramp_platform_slim_mx_1.glb',
  rampWide: '/models/environment/station/ramp_platform_wide_mx_1.glb',
  asphalt1: '/models/environment/station/asphalt_hr_1.glb',
  asphalt2: '/models/environment/station/asphalt_hr_2.glb',
  asphalt3: '/models/environment/station/asphalt_hr_3.glb',
  asphaltLarge: '/models/environment/station/asphalt_hr_1_large.glb',
  concretePipeEnd: '/models/environment/station/concrete_pipe_hm_1_end.glb',
  concretePipeMid: '/models/environment/station/concrete_pipe_hm_1_middle.glb',
  concretePipeBars: '/models/environment/station/concrete_pipe_hm_1_end_bars_1.glb',
  pillarBroken: '/models/environment/station/pillar_hr_1_broken.glb',
  pillar2: '/models/environment/station/pillar_hr_2.glb',
  pillar4: '/models/environment/station/pillar_hr_4.glb',
  pillar5: '/models/environment/station/pillar_hr_5.glb',
  wallDouble: '/models/environment/station/wall_hr_1_double.glb',
  wallSingle: '/models/environment/station/wall_hr_1.glb',
  wallHole1: '/models/environment/station/wall_hr_1_hole_1.glb',
  wallHole2: '/models/environment/station/wall_hr_1_hole_2.glb',
  garageBlock: '/models/environment/station/garages_block_hr_1.glb',
  garage1: '/models/environment/station/garage_hl_1.glb',
  garage2: '/models/environment/station/garage_hl_2.glb',
  shed1: '/models/environment/station/shed_ax_1.glb',
  shed2: '/models/environment/station/shed_ax_2.glb',
  shed3: '/models/environment/station/shed_ax_3.glb',
  platformAx1: '/models/environment/station/platform_ax_1.glb',
  platformAx2: '/models/environment/station/platform_ax_2.glb',
  platformBx1: '/models/environment/station/platform_bx_1.glb',
  platformCx1: '/models/environment/station/platform_cx_1.glb',
  platformLarge: '/models/environment/station/platform_large_mx_1.glb',
  platformSmall: '/models/environment/station/platform_small_mx_1.glb',
  beamHoriz1: '/models/environment/station/beam_hc_horizontal_1.glb',
  beamHoriz2: '/models/environment/station/beam_hc_horizontal_2.glb',
  beamVert1: '/models/environment/station/beam_hc_vertical_1.glb',
  beamVert2: '/models/environment/station/beam_hc_vertical_2.glb',
  beamRtx1: '/models/environment/station/beam_rtx_1.glb',
  roofBx1: '/models/environment/station/roof_bx_1.glb',
  warehouseMx1: '/models/environment/station/warehouse_mx_1.glb',
  warehouseMx2: '/models/environment/station/warehouse_mx_2.glb',

  // Station external (crashed ship)
  stationExt03: '/models/environment/station-external/station03.glb',
  stationExt05: '/models/environment/station-external/station05.glb',

  // Spaceships (wrecked)
  spaceshipChallenger: '/models/spaceships/Challenger.glb',
  spaceshipOmen: '/models/spaceships/Omen.glb',

  // Wrecked spaceships (for canyon wreck obstacles)
  wreckSpaceship2: '/models/spaceships/Spaceship2.glb',
  wreckSpaceship3: '/models/spaceships/Spaceship3.glb',
  wreckSpaceship4: '/models/spaceships/Spaceship4.glb',
  wreckSpaceship5: '/models/spaceships/Spaceship5.glb',

  // Wreck debris parts
  debrisBrick0: '/models/props/debris/debris_bricks_mx_1_0.glb',
  debrisBrick2_0: '/models/props/debris/debris_bricks_mx_2_0.glb',
  bricksStacked1: '/models/props/debris/bricks_stacked_mx_1.glb',
  bricksStacked2: '/models/props/debris/bricks_stacked_mx_2.glb',
  scrapMetal1_1: '/models/props/containers/scrap_metal_mx_1_1.glb',
  scrapMetal1_2: '/models/props/containers/scrap_metal_mx_1_2.glb',

  // Props - containers/debris
  barrel3: '/models/props/containers/metal_barrel_hr_3.glb',
  barrel4: '/models/props/containers/metal_barrel_hr_4.glb',
  tire1: '/models/props/containers/tire_1.glb',
  tire2: '/models/props/containers/tire_2.glb',
  jerrycan: '/models/props/containers/jerrycan_mx_1.glb',
  woodenCrate1: '/models/props/containers/wooden_crate_1.glb',
  woodenCrate2a: '/models/props/containers/wooden_crate_2_a.glb',
  scrapMetal1: '/models/props/containers/scrap_metal_mx_1.glb',
  gravelPile1: '/models/props/debris/gravel_pile_hr_1.glb',
  gravelPile2: '/models/props/debris/gravel_pile_hr_2.glb',
  debrisBricks1: '/models/props/debris/debris_bricks_mx_1.glb',
  debrisBricks2: '/models/props/debris/debris_bricks_mx_2.glb',
} as const;

// ============================================================================
// GLB PROP PLACEMENT DEFINITIONS
// ============================================================================

interface PropPlacement {
  model: string;
  position: Vector3;
  rotationY: number;
  scale: number;
  name: string;
}

/**
 * Hand-placed GLB asset coordinates along the canyon.
 * Arranged by canyon zone from Z=0 (start) to Z=-3000 (extraction).
 *
 * The canyon is CANYON_HALF_WIDTH=25 wide, so X ranges roughly [-25, +25].
 * Props outside the drivable area (on canyon ledges, walls) have |X| > 20.
 */
function getCanyonPropPlacements(): PropPlacement[] {
  return [
    // ========================================================================
    // ZONE 1: STARTING AREA (Z = 0 to Z = -300)
    // Military forward camp wreckage - sets the tone
    // ========================================================================

    // Barricade checkpoint at the canyon mouth
    { model: GLB.barricadeB1, position: new Vector3(-8, 0, -40), rotationY: 0, scale: 2.5, name: 'barricade_start_L' },
    { model: GLB.barricadeB2, position: new Vector3(8, 0, -40), rotationY: Math.PI, scale: 2.5, name: 'barricade_start_R' },
    { model: GLB.concreteFencePillar, position: new Vector3(-14, 0, -40), rotationY: 0, scale: 2.0, name: 'fence_pillar_start_L' },
    { model: GLB.concreteFencePillar, position: new Vector3(14, 0, -40), rotationY: 0, scale: 2.0, name: 'fence_pillar_start_R' },

    // Overturned shipping container (roadside)
    { model: GLB.shippingContainer2, position: new Vector3(-18, 1.0, -80), rotationY: 0.3, scale: 2.0, name: 'container_start_1' },
    { model: GLB.barrel3, position: new Vector3(-14, 0, -85), rotationY: 0, scale: 2.0, name: 'barrel_start_1' },
    { model: GLB.barrel4, position: new Vector3(-15, 0, -78), rotationY: 1.2, scale: 2.0, name: 'barrel_start_2' },

    // Gravel piles flanking the road
    { model: GLB.gravelPile1, position: new Vector3(18, 0, -120), rotationY: 0, scale: 3.0, name: 'gravel_start_1' },
    { model: GLB.gravelPile2, position: new Vector3(-20, 0, -150), rotationY: 1.5, scale: 3.0, name: 'gravel_start_2' },

    // Debris and tires from a previous firefight
    { model: GLB.tire1, position: new Vector3(5, 0, -100), rotationY: 0.5, scale: 2.0, name: 'tire_start_1' },
    { model: GLB.tire2, position: new Vector3(-3, 0, -110), rotationY: 2.1, scale: 2.0, name: 'tire_start_2' },
    { model: GLB.scrapMetal1, position: new Vector3(10, 0, -130), rotationY: 0.8, scale: 2.5, name: 'scrap_start_1' },

    // Small shed near start (supply outpost)
    { model: GLB.shed1, position: new Vector3(20, 0, -60), rotationY: -0.2, scale: 2.5, name: 'shed_start' },

    // Wooden crates and jerrycans (supplies)
    { model: GLB.woodenCrate1, position: new Vector3(16, 0, -70), rotationY: 0.3, scale: 2.0, name: 'crate_start_1' },
    { model: GLB.woodenCrate2a, position: new Vector3(18, 0, -65), rotationY: 0.8, scale: 2.0, name: 'crate_start_2' },
    { model: GLB.jerrycan, position: new Vector3(17, 0, -75), rotationY: 1.0, scale: 2.0, name: 'jerrycan_start_1' },

    // ========================================================================
    // ZONE 2: NARROW PASSAGE (Z = -300 to Z = -600)
    // Industrial ruins built into canyon walls
    // ========================================================================

    // Wall segments forming narrowing passage
    { model: GLB.wallDouble, position: new Vector3(-22, 0, -320), rotationY: 0, scale: 3.0, name: 'wall_narrow_L1' },
    { model: GLB.wallDouble, position: new Vector3(22, 0, -320), rotationY: Math.PI, scale: 3.0, name: 'wall_narrow_R1' },
    { model: GLB.wallHole1, position: new Vector3(-22, 0, -360), rotationY: 0, scale: 3.0, name: 'wall_hole_L1' },
    { model: GLB.wallSingle, position: new Vector3(22, 0, -360), rotationY: Math.PI, scale: 3.0, name: 'wall_single_R1' },

    // Industrial pipes crossing overhead
    { model: GLB.pipeHorizMid1, position: new Vector3(0, 12, -380), rotationY: Math.PI / 2, scale: 4.0, name: 'pipe_overhead_1' },
    { model: GLB.pipeHorizMid2, position: new Vector3(0, 14, -420), rotationY: Math.PI / 2, scale: 4.0, name: 'pipe_overhead_2' },

    // Boiler tucked into left canyon wall
    { model: GLB.boiler, position: new Vector3(-22, 0, -400), rotationY: 0.3, scale: 3.0, name: 'boiler_L1' },

    // Electrical equipment on right wall
    { model: GLB.electricalEquip1, position: new Vector3(21, 2, -350), rotationY: -Math.PI / 2, scale: 2.5, name: 'elec_equip_R1' },
    { model: GLB.electricalEquip2, position: new Vector3(21, 2, -440), rotationY: -Math.PI / 2, scale: 2.5, name: 'elec_equip_R2' },

    // Concrete barricade chicane (forces weaving)
    { model: GLB.barricadeA1, position: new Vector3(-6, 0, -460), rotationY: 0.2, scale: 2.5, name: 'chicane_L1' },
    { model: GLB.barricadeA2, position: new Vector3(8, 0, -480), rotationY: -0.3, scale: 2.5, name: 'chicane_R1' },
    { model: GLB.barricadeA3, position: new Vector3(-4, 0, -500), rotationY: 0.15, scale: 2.5, name: 'chicane_L2' },

    // Broken pillars at passage exit
    { model: GLB.pillarBroken, position: new Vector3(-16, 0, -550), rotationY: 0, scale: 3.0, name: 'pillar_broken_L1' },
    { model: GLB.pillarBroken, position: new Vector3(16, 0, -560), rotationY: 0.8, scale: 3.0, name: 'pillar_broken_R1' },

    // Concrete fencing along roadside
    { model: GLB.concreteFence, position: new Vector3(-20, 0, -330), rotationY: 0, scale: 2.0, name: 'cfence_L1' },
    { model: GLB.concreteFence, position: new Vector3(-20, 0, -340), rotationY: 0, scale: 2.0, name: 'cfence_L2' },
    { model: GLB.concreteFence2, position: new Vector3(20, 0, -330), rotationY: Math.PI, scale: 2.0, name: 'cfence_R1' },
    { model: GLB.concreteFence2, position: new Vector3(20, 0, -340), rotationY: Math.PI, scale: 2.0, name: 'cfence_R2' },

    // ========================================================================
    // ZONE 3: EARLY BRIDGE AREA (Z = -600)
    // The small intact bridge with surrounding infrastructure
    // ========================================================================

    // Platform pieces forming bridge approaches
    { model: GLB.platformLarge, position: new Vector3(-20, 4, -580), rotationY: 0, scale: 2.5, name: 'plat_bridge1_L' },
    { model: GLB.platformLarge, position: new Vector3(20, 4, -580), rotationY: Math.PI, scale: 2.5, name: 'plat_bridge1_R' },

    // Structural beams under early bridge
    { model: GLB.beamVert1, position: new Vector3(-18, 0, -600), rotationY: 0, scale: 3.0, name: 'beam_bridge1_L' },
    { model: GLB.beamVert2, position: new Vector3(18, 0, -600), rotationY: 0, scale: 3.0, name: 'beam_bridge1_R' },

    // Asphalt road patches leading to bridge
    { model: GLB.asphalt2, position: new Vector3(0, 0.1, -570), rotationY: 0, scale: 3.0, name: 'asphalt_bridge1_a' },
    { model: GLB.asphalt3, position: new Vector3(0, 0.1, -630), rotationY: 0, scale: 3.0, name: 'asphalt_bridge1_b' },

    // ========================================================================
    // ZONE 4: RAMP JUMP SECTION (Z = -700 to Z = -900)
    // Vehicle jumps and open canyon with scattered obstacles
    // ========================================================================

    // First vehicle ramp
    { model: GLB.rampWide, position: new Vector3(0, 0, -720), rotationY: Math.PI, scale: 3.0, name: 'ramp_jump_1' },

    // Landing debris after ramp
    { model: GLB.debrisBricks1, position: new Vector3(-8, 0, -760), rotationY: 0.5, scale: 3.0, name: 'debris_ramp1_1' },
    { model: GLB.debrisBricks2, position: new Vector3(6, 0, -770), rotationY: 1.2, scale: 3.0, name: 'debris_ramp1_2' },

    // Water tower on canyon ledge (landmark)
    { model: GLB.waterTower, position: new Vector3(-22, 0, -750), rotationY: 0, scale: 2.5, name: 'water_tower_1' },

    // Chimney stacks along left wall (industrial ruins)
    { model: GLB.chimney1, position: new Vector3(-23, 0, -800), rotationY: 0, scale: 2.5, name: 'chimney_L1' },
    { model: GLB.chimney2, position: new Vector3(-24, 0, -830), rotationY: 0.2, scale: 2.5, name: 'chimney_L2' },

    // Storage tanks on right wall
    { model: GLB.storageTank, position: new Vector3(22, 0, -790), rotationY: 0, scale: 2.5, name: 'tank_R1' },
    { model: GLB.tankSystem, position: new Vector3(23, 0, -850), rotationY: -0.3, scale: 2.5, name: 'tank_system_R1' },

    // Barricade gauntlet before rockslide zone
    { model: GLB.barricadeB3, position: new Vector3(-10, 0, -870), rotationY: 0.1, scale: 2.5, name: 'barricade_gauntlet_L1' },
    { model: GLB.barricadeB4, position: new Vector3(12, 0, -880), rotationY: -0.2, scale: 2.5, name: 'barricade_gauntlet_R1' },
    { model: GLB.barricadeB1, position: new Vector3(-5, 0, -900), rotationY: 0.3, scale: 2.5, name: 'barricade_gauntlet_L2' },

    // Second ramp (sends player airborne through rockslide zone)
    { model: GLB.rampSlim, position: new Vector3(3, 0, -910), rotationY: Math.PI, scale: 2.5, name: 'ramp_jump_2' },

    // Cage obstacle in the road
    { model: GLB.cage, position: new Vector3(-12, 0, -840), rotationY: 0.5, scale: 2.5, name: 'cage_roadblock_1' },

    // Metal fencing along this stretch
    { model: GLB.metalFence, position: new Vector3(-21, 0, -720), rotationY: 0, scale: 2.0, name: 'mfence_L1' },
    { model: GLB.metalFence, position: new Vector3(-21, 0, -730), rotationY: 0, scale: 2.0, name: 'mfence_L2' },
    { model: GLB.metalFenceTall, position: new Vector3(21, 0, -720), rotationY: Math.PI, scale: 2.0, name: 'mfence_R1' },
    { model: GLB.metalFenceTall, position: new Vector3(21, 0, -730), rotationY: Math.PI, scale: 2.0, name: 'mfence_R2' },

    // ========================================================================
    // ZONE 5: MID-CANYON (Z = -900 to Z = -1200)
    // After first wraith encounter - more industrial density
    // ========================================================================

    // Shipping container roadblock cluster
    { model: GLB.shippingContainer1, position: new Vector3(-15, 0, -950), rotationY: 0.4, scale: 2.0, name: 'container_mid_1' },
    { model: GLB.shippingContainer2, position: new Vector3(12, 1.5, -980), rotationY: -0.6, scale: 2.0, name: 'container_mid_2' },
    { model: GLB.shippingContainerHollow, position: new Vector3(0, 0, -1020), rotationY: Math.PI / 2, scale: 2.0, name: 'container_mid_hollow' },

    // Player can drive THROUGH the hollow container (tunnel)

    // Machinery on canyon walls
    { model: GLB.machinery, position: new Vector3(-22, 0, -1050), rotationY: 0, scale: 2.5, name: 'machinery_L1' },
    { model: GLB.distillery, position: new Vector3(22, 0, -1080), rotationY: Math.PI, scale: 2.5, name: 'distillery_R1' },

    // Platform overpass (players drive under)
    { model: GLB.platformAx1, position: new Vector3(0, 10, -1100), rotationY: Math.PI / 2, scale: 3.5, name: 'overpass_mid_1' },
    { model: GLB.beamVert1, position: new Vector3(-15, 0, -1100), rotationY: 0, scale: 3.5, name: 'overpass_pillar_L' },
    { model: GLB.beamVert2, position: new Vector3(15, 0, -1100), rotationY: 0, scale: 3.5, name: 'overpass_pillar_R' },

    // Warehouse structure on left wall
    { model: GLB.warehouse, position: new Vector3(-24, 0, -1150), rotationY: Math.PI / 2, scale: 2.5, name: 'warehouse_L1' },

    // Barrels scattered as minor obstacles
    { model: GLB.barrel3, position: new Vector3(-3, 0, -1000), rotationY: 0, scale: 2.0, name: 'barrel_mid_1' },
    { model: GLB.barrel4, position: new Vector3(7, 0, -1060), rotationY: 1.5, scale: 2.0, name: 'barrel_mid_2' },
    { model: GLB.barrel3, position: new Vector3(-9, 0, -1120), rotationY: 2.3, scale: 2.0, name: 'barrel_mid_3' },

    // Gravel piles along walls
    { model: GLB.gravelPile1, position: new Vector3(19, 0, -960), rotationY: 0.7, scale: 3.0, name: 'gravel_mid_1' },
    { model: GLB.gravelPile2, position: new Vector3(-19, 0, -1040), rotationY: 2.0, scale: 3.0, name: 'gravel_mid_2' },

    // ========================================================================
    // ZONE 6: APPROACH TO MAIN BRIDGE (Z = -1200 to Z = -1500)
    // Building tension - more obstacles, wreckage increases
    // ========================================================================

    // Garage structure (abandoned maintenance depot)
    { model: GLB.garageBlock, position: new Vector3(-22, 0, -1250), rotationY: Math.PI / 2, scale: 2.5, name: 'garage_approach' },
    { model: GLB.garage1, position: new Vector3(22, 0, -1280), rotationY: -Math.PI / 2, scale: 2.5, name: 'garage_R1' },

    // Concrete barrier line (player must weave)
    { model: GLB.concreteFence, position: new Vector3(-8, 0, -1300), rotationY: 0.1, scale: 2.0, name: 'cfence_approach_L1' },
    { model: GLB.concreteFence, position: new Vector3(-8, 0, -1310), rotationY: 0.1, scale: 2.0, name: 'cfence_approach_L2' },
    { model: GLB.concreteFence2, position: new Vector3(10, 0, -1330), rotationY: -0.15, scale: 2.0, name: 'cfence_approach_R1' },
    { model: GLB.concreteFence2, position: new Vector3(10, 0, -1340), rotationY: -0.15, scale: 2.0, name: 'cfence_approach_R2' },

    // Broken pillars increasing in density
    { model: GLB.pillar2, position: new Vector3(-17, 0, -1350), rotationY: 0, scale: 3.0, name: 'pillar_approach_L1' },
    { model: GLB.pillar4, position: new Vector3(17, 0, -1370), rotationY: 0, scale: 3.0, name: 'pillar_approach_R1' },
    { model: GLB.pillar5, position: new Vector3(-12, 0, -1390), rotationY: 0.4, scale: 3.0, name: 'pillar_approach_L2' },

    // Third ramp (dramatic pre-bridge jump)
    { model: GLB.rampWide, position: new Vector3(0, 0, -1420), rotationY: Math.PI, scale: 3.0, name: 'ramp_bridge_approach' },

    // Asphalt road surface approaching bridge
    { model: GLB.asphaltLarge, position: new Vector3(0, 0.1, -1460), rotationY: 0, scale: 3.5, name: 'asphalt_bridge_approach' },
    { model: GLB.asphalt2, position: new Vector3(0, 0.1, -1480), rotationY: 0, scale: 3.0, name: 'asphalt_bridge_lead' },

    // Pipes running along walls near bridge
    { model: GLB.pipes, position: new Vector3(-23, 4, -1350), rotationY: 0, scale: 3.0, name: 'pipes_approach_L1' },
    { model: GLB.pipeElbow, position: new Vector3(23, 4, -1380), rotationY: Math.PI, scale: 3.0, name: 'pipe_elbow_R1' },

    // ========================================================================
    // ZONE 7: MAIN BRIDGE (Z = -1500)
    // Bridge structure is still created via procedural MeshBuilder for collapse
    // animation. We add GLB props on either side of the approach.
    // ========================================================================

    // Platform bases for bridge supports
    { model: GLB.platformBx1, position: new Vector3(-22, 0, -1500), rotationY: 0, scale: 3.0, name: 'bridge_base_L' },
    { model: GLB.platformBx1, position: new Vector3(22, 0, -1500), rotationY: Math.PI, scale: 3.0, name: 'bridge_base_R' },

    // Beams visible beside the bridge
    { model: GLB.beamHoriz1, position: new Vector3(-20, 6, -1490), rotationY: 0, scale: 3.0, name: 'bridge_beam_L1' },
    { model: GLB.beamHoriz2, position: new Vector3(20, 6, -1510), rotationY: Math.PI, scale: 3.0, name: 'bridge_beam_R1' },

    // ========================================================================
    // ZONE 8: POST-BRIDGE (Z = -1500 to Z = -2000)
    // Destruction aftermath - crashed ship, heavy debris
    // ========================================================================

    // CRASHED SPACESHIP in canyon wall (major landmark)
    { model: GLB.spaceshipChallenger, position: new Vector3(-25, 5, -1650), rotationY: 0.7, scale: 4.0, name: 'crashed_ship_1' },

    // Station external module (crashed habitation pod)
    { model: GLB.stationExt03, position: new Vector3(20, 3, -1700), rotationY: -0.4, scale: 3.5, name: 'station_wreck_1' },

    // Heavy debris field around crash site
    { model: GLB.debrisBricks1, position: new Vector3(-15, 0, -1630), rotationY: 0.3, scale: 3.5, name: 'debris_crash_1' },
    { model: GLB.debrisBricks2, position: new Vector3(-10, 0, -1660), rotationY: 1.8, scale: 3.5, name: 'debris_crash_2' },
    { model: GLB.gravelPile1, position: new Vector3(-18, 0, -1680), rotationY: 0, scale: 4.0, name: 'gravel_crash_1' },
    { model: GLB.gravelPile2, position: new Vector3(15, 0, -1720), rotationY: 1.0, scale: 4.0, name: 'gravel_crash_2' },
    { model: GLB.scrapMetal1, position: new Vector3(5, 0, -1640), rotationY: 2.5, scale: 3.0, name: 'scrap_crash_1' },

    // Tires and barrels from the wreckage
    { model: GLB.tire1, position: new Vector3(-7, 0, -1670), rotationY: 0.9, scale: 2.0, name: 'tire_crash_1' },
    { model: GLB.tire2, position: new Vector3(3, 0, -1690), rotationY: 1.7, scale: 2.0, name: 'tire_crash_2' },
    { model: GLB.barrel3, position: new Vector3(-2, 0, -1710), rotationY: 0, scale: 2.0, name: 'barrel_crash_1' },
    { model: GLB.barrel4, position: new Vector3(9, 0, -1650), rotationY: 1.3, scale: 2.0, name: 'barrel_crash_2' },

    // Shipping containers as improvised barricades
    { model: GLB.shippingContainer1, position: new Vector3(15, 0, -1780), rotationY: 0.8, scale: 2.0, name: 'container_post_1' },
    { model: GLB.shippingContainer2, position: new Vector3(-14, 2.0, -1820), rotationY: -0.5, scale: 2.0, name: 'container_post_2' },

    // Another overpass structure
    { model: GLB.platformAx2, position: new Vector3(0, 12, -1850), rotationY: Math.PI / 2, scale: 3.5, name: 'overpass_post_1' },
    { model: GLB.beamVert1, position: new Vector3(-16, 0, -1850), rotationY: 0, scale: 3.5, name: 'overpass_post_L' },
    { model: GLB.beamVert2, position: new Vector3(16, 0, -1850), rotationY: 0, scale: 3.5, name: 'overpass_post_R' },

    // Wall segments with holes (cover from wraith fire)
    { model: GLB.wallHole2, position: new Vector3(-20, 0, -1900), rotationY: 0, scale: 3.0, name: 'wall_cover_L1' },
    { model: GLB.wallHole1, position: new Vector3(20, 0, -1930), rotationY: Math.PI, scale: 3.0, name: 'wall_cover_R1' },

    // Fourth ramp (high-speed jump over debris)
    { model: GLB.rampSlim, position: new Vector3(-5, 0, -1960), rotationY: Math.PI, scale: 2.5, name: 'ramp_post_bridge' },

    // ========================================================================
    // ZONE 9: FINAL GAUNTLET (Z = -2000 to Z = -2600)
    // Maximum obstacle density - wraiths + environmental hazards
    // ========================================================================

    // Portal structure (alien arch, purely decorative)
    { model: GLB.portal, position: new Vector3(0, 0, -2020), rotationY: Math.PI / 2, scale: 4.0, name: 'alien_arch_1' },

    // Dense barricade field
    { model: GLB.barricadeA1, position: new Vector3(-12, 0, -2080), rotationY: 0.15, scale: 2.5, name: 'barricade_final_L1' },
    { model: GLB.barricadeB2, position: new Vector3(10, 0, -2100), rotationY: -0.2, scale: 2.5, name: 'barricade_final_R1' },
    { model: GLB.barricadeA3, position: new Vector3(-5, 0, -2130), rotationY: 0.3, scale: 2.5, name: 'barricade_final_C1' },
    { model: GLB.barricadeB4, position: new Vector3(14, 0, -2160), rotationY: -0.1, scale: 2.5, name: 'barricade_final_R2' },
    { model: GLB.barricadeA2, position: new Vector3(-8, 0, -2190), rotationY: 0.25, scale: 2.5, name: 'barricade_final_L2' },

    // Water tower cluster (second landmark)
    { model: GLB.waterTower, position: new Vector3(22, 0, -2120), rotationY: 0, scale: 2.5, name: 'water_tower_2' },

    // Chimney stacks (ruins continuing)
    { model: GLB.chimney3, position: new Vector3(-24, 0, -2200), rotationY: 0, scale: 2.5, name: 'chimney_final_L1' },
    { model: GLB.chimney1, position: new Vector3(24, 0, -2250), rotationY: 0.5, scale: 2.5, name: 'chimney_final_R1' },

    // Industrial pipes overhead
    { model: GLB.pipeHorizMid1, position: new Vector3(0, 13, -2280), rotationY: Math.PI / 2, scale: 4.0, name: 'pipe_final_1' },
    { model: GLB.pipeHorizMid2, position: new Vector3(0, 15, -2350), rotationY: Math.PI / 2, scale: 4.0, name: 'pipe_final_2' },

    // Shipping containers forming a slalom
    { model: GLB.shippingContainer1, position: new Vector3(-10, 0, -2300), rotationY: 0.2, scale: 2.0, name: 'container_final_1' },
    { model: GLB.shippingContainer2, position: new Vector3(8, 0, -2340), rotationY: -0.3, scale: 2.0, name: 'container_final_2' },
    { model: GLB.shippingContainerHollow, position: new Vector3(-3, 0, -2380), rotationY: 0, scale: 2.0, name: 'container_final_hollow' },

    // Fifth ramp (dramatic final jump)
    { model: GLB.rampWide, position: new Vector3(0, 0, -2430), rotationY: Math.PI, scale: 3.0, name: 'ramp_final' },

    // Cage and machinery obstacles
    { model: GLB.cage, position: new Vector3(15, 0, -2460), rotationY: 0.7, scale: 2.5, name: 'cage_final_1' },
    { model: GLB.machinery, position: new Vector3(-22, 0, -2480), rotationY: 0.2, scale: 2.5, name: 'machinery_final_L1' },
    { model: GLB.distillery, position: new Vector3(22, 0, -2520), rotationY: -Math.PI / 2, scale: 2.5, name: 'distillery_final_R1' },

    // Concrete fencing guiding toward extraction
    { model: GLB.concreteFence, position: new Vector3(-15, 0, -2550), rotationY: 0.05, scale: 2.0, name: 'cfence_final_L1' },
    { model: GLB.concreteFence, position: new Vector3(-15, 0, -2560), rotationY: 0.05, scale: 2.0, name: 'cfence_final_L2' },
    { model: GLB.concreteFence2, position: new Vector3(15, 0, -2550), rotationY: Math.PI, scale: 2.0, name: 'cfence_final_R1' },
    { model: GLB.concreteFence2, position: new Vector3(15, 0, -2560), rotationY: Math.PI, scale: 2.0, name: 'cfence_final_R2' },

    // Second crashed spaceship (further along)
    { model: GLB.spaceshipOmen, position: new Vector3(25, 8, -2500), rotationY: -0.9, scale: 3.5, name: 'crashed_ship_2' },

    // Warehouse on right wall
    { model: GLB.warehouseMx1, position: new Vector3(24, 0, -2400), rotationY: -Math.PI / 2, scale: 3.0, name: 'warehouse_final_R1' },

    // ========================================================================
    // ZONE 10: EXTRACTION APPROACH (Z = -2600 to Z = -2900)
    // Opening up - wide canyon, less clutter, landing zone ahead
    // ========================================================================

    // Station external module (base infrastructure)
    { model: GLB.stationExt05, position: new Vector3(-22, 0, -2650), rotationY: 0.3, scale: 3.0, name: 'station_extraction_L' },

    // Shed structures (forward operating post)
    { model: GLB.shed2, position: new Vector3(20, 0, -2680), rotationY: -0.5, scale: 2.5, name: 'shed_extraction_R1' },
    { model: GLB.shed3, position: new Vector3(-20, 0, -2720), rotationY: 0.3, scale: 2.5, name: 'shed_extraction_L1' },

    // Barrel and crate supply dump near extraction
    { model: GLB.barrel3, position: new Vector3(15, 0, -2750), rotationY: 0, scale: 2.0, name: 'barrel_extract_1' },
    { model: GLB.barrel4, position: new Vector3(13, 0, -2760), rotationY: 1.0, scale: 2.0, name: 'barrel_extract_2' },
    { model: GLB.woodenCrate1, position: new Vector3(-16, 0, -2770), rotationY: 0.5, scale: 2.0, name: 'crate_extract_1' },
    { model: GLB.woodenCrate2a, position: new Vector3(-14, 0, -2780), rotationY: 0.9, scale: 2.0, name: 'crate_extract_2' },
    { model: GLB.jerrycan, position: new Vector3(12, 0, -2790), rotationY: 2.0, scale: 2.0, name: 'jerrycan_extract_1' },

    // Concrete barriers guiding to landing pad
    { model: GLB.barricadeB1, position: new Vector3(-10, 0, -2830), rotationY: 0, scale: 2.5, name: 'barricade_extract_L1' },
    { model: GLB.barricadeB2, position: new Vector3(10, 0, -2830), rotationY: Math.PI, scale: 2.5, name: 'barricade_extract_R1' },

    // Asphalt road surface at extraction
    { model: GLB.asphaltLarge, position: new Vector3(0, 0.1, -2870), rotationY: 0, scale: 4.0, name: 'asphalt_extraction' },

    // Gravel and debris at edges of landing zone
    { model: GLB.gravelPile1, position: new Vector3(-18, 0, -2880), rotationY: 0.5, scale: 3.5, name: 'gravel_extract_1' },
    { model: GLB.gravelPile2, position: new Vector3(18, 0, -2890), rotationY: 1.8, scale: 3.5, name: 'gravel_extract_2' },

    // Metal fencing around the landing pad perimeter
    { model: GLB.metalFencePillar, position: new Vector3(-13, 0, -2880), rotationY: 0, scale: 2.0, name: 'fence_extract_L' },
    { model: GLB.metalFencePillar, position: new Vector3(13, 0, -2880), rotationY: Math.PI, scale: 2.0, name: 'fence_extract_R' },
  ];
}

// ============================================================================
// ENVIRONMENT CREATION
// ============================================================================

/**
 * Create the complete canyon environment.
 * Now async to support GLB model loading alongside procedural geometry.
 */
export async function createCanyonEnvironment(scene: Scene): Promise<CanyonEnvironment> {
  const rand = seededRandom(42);

  // Materials
  const materials = createMaterials(scene);

  // Pre-load all GLB assets needed by procedural builders (boulders, vegetation,
  // bridges, rockslide) so that createInstanceByPath succeeds synchronously.
  await preloadEnvironmentGLBs(scene);

  // Terrain floor
  const terrain = createTerrain(scene, materials);

  // Canyon walls (procedural - keep MeshBuilder for massive cliff faces)
  const { leftWalls, rightWalls } = createCanyonWalls(scene, materials, rand);

  // Boulders / obstacles (GLB rock instances)
  const boulders = createBoulders(scene, materials, rand);

  // Bridges (deck segments stay procedural for collapse animation;
  // pillars and railings use GLB instances)
  const bridges = createBridges(scene, materials);

  // Wrecked vehicles (GLB spaceship models)
  const wrecks = await createWrecks(scene, materials, rand);

  // Vegetation (GLB alien flora instances)
  const vegetation = createVegetation(scene, materials, rand);

  // Dust emitter positions
  const dustEmitters = createDustEmitters(scene, rand);

  // Lighting
  const { sunLight, canyonLights } = createLighting(scene);

  // Objective markers
  const objectiveMarkers = createObjectiveMarkers(scene);

  // Extraction zone
  const extractionZone = createExtractionZone(scene, materials);

  // Sky dome
  createSkyDome(scene);

  // Load all GLB props in parallel (non-blocking; individual failures are logged)
  const glbProps = await loadCanyonGLBProps(scene);

  return {
    terrain,
    leftWalls,
    rightWalls,
    boulders,
    bridges,
    wrecks,
    vegetation,
    dustEmitters,
    objectiveMarkers,
    sunLight,
    canyonLights,
    extractionZone,
    glbProps,
  };
}

// ============================================================================
// GLB PROP LOADER
// ============================================================================

/**
 * Load all hand-placed GLB props for the canyon.
 * Each placement is loaded in parallel. Failures are logged but tolerated
 * so the level can still function if individual models fail to load.
 */
async function loadCanyonGLBProps(scene: Scene): Promise<AbstractMesh[]> {
  const placements = getCanyonPropPlacements();
  const allMeshes: AbstractMesh[] = [];

  log.info(`Loading ${placements.length} GLB prop placements...`);

  const loadPromises = placements.map(async (placement) => {
    try {
      const result = await SceneLoader.ImportMeshAsync('', placement.model, '', scene);
      const propRoot = new TransformNode(placement.name, scene);
      propRoot.position = placement.position;
      propRoot.rotation.y = placement.rotationY;
      propRoot.scaling.setAll(placement.scale);

      for (const mesh of result.meshes) {
        if (mesh.parent === null || mesh.parent?.name === '__root__') {
          mesh.parent = propRoot;
        }
        mesh.receiveShadows = true;
        mesh.checkCollisions = false; // Props are visual only; boulder collision handles gameplay
        allMeshes.push(mesh);
      }
      // Track the root node itself for disposal
      allMeshes.push(propRoot as unknown as AbstractMesh);
    } catch (error) {
      log.warn(`Failed to load prop ${placement.name} (${placement.model}):`, error);
    }
  });

  await Promise.all(loadPromises);
  log.info(`GLB props loaded: ${allMeshes.length} meshes from ${placements.length} placements`);

  return allMeshes;
}

// ============================================================================
// GLB PRELOADING FOR PROCEDURAL BUILDERS
// ============================================================================

/**
 * Preload all GLB assets that are used by the procedural builder functions
 * (boulders, vegetation, bridge parts, rockslide debris). This lets those
 * functions use createInstanceByPath synchronously.
 */
async function preloadEnvironmentGLBs(scene: Scene): Promise<void> {
  const pathsToPreload = [
    // Boulder models
    GLB.alienBoulder,
    GLB.alienRockMed1,
    GLB.alienRockMed2,
    GLB.alienRockMed3,
    GLB.alienTallRock1,
    GLB.alienTallRock2,
    // Vegetation models
    GLB.alienBush,
    GLB.alienFern,
    GLB.alienGrass,
    GLB.alienIceplant,
    GLB.alienMushroom1,
    GLB.alienMushroom2,
    GLB.alienDeadTree1,
    GLB.alienDeadTree2,
    GLB.alienTwistedTree1,
    GLB.alienTwistedTree2,
    // Bridge parts
    GLB.bridgePillarHr2,
    GLB.bridgePillarHr4,
    GLB.bridgeHandrail1,
    GLB.bridgeHandrail2,
    // Rockslide debris
    GLB.rockBrick1,
    GLB.rockBrick2,
    GLB.rockBrick3,
    GLB.rockBrick4,
    GLB.rockBrickStacked1,
    GLB.rockBrickStacked2,
  ];

  const unique = [...new Set(pathsToPreload)];
  log.info(`Preloading ${unique.length} environment GLBs...`);
  await Promise.all(unique.map((p) => AssetManager.loadAssetByPath(p, scene)));
  log.info('Environment GLB preload complete.');
}

// ============================================================================
// MATERIALS
// ============================================================================

interface CanyonMaterials {
  ground: PBRMaterial | StandardMaterial;
  wall: PBRMaterial | StandardMaterial;
  boulder: StandardMaterial;
  bridge: StandardMaterial;
  bridgeMetal: StandardMaterial;
  wreck: StandardMaterial;
  vegetation: StandardMaterial;
  beacon: StandardMaterial;
  extraction: StandardMaterial;
}

function createMaterials(scene: Scene): CanyonMaterials {
  // PBR ground material with AmbientCG textures for high-quality terrain
  const ground = createPBRTerrainMaterial(scene, CANYON_TERRAIN_CONFIG, 'canyon_ground_mat');

  // Adjust UV scale for canyon terrain dimensions
  const groundUVScale = 0.012 * (CANYON_HALF_WIDTH * 2 + 20);
  const lengthRatio = CANYON_LENGTH / (CANYON_HALF_WIDTH * 2);
  if (ground.albedoTexture instanceof Texture) {
    ground.albedoTexture.uScale = groundUVScale;
    ground.albedoTexture.vScale = groundUVScale * lengthRatio;
  }
  if (ground.bumpTexture instanceof Texture) {
    ground.bumpTexture.uScale = groundUVScale;
    ground.bumpTexture.vScale = groundUVScale * lengthRatio;
  }
  if (ground.metallicTexture instanceof Texture) {
    ground.metallicTexture.uScale = groundUVScale;
    ground.metallicTexture.vScale = groundUVScale * lengthRatio;
  }

  // PBR wall material with rock textures
  const wall = createPBRTerrainMaterial(scene, CANYON_ROCK_CONFIG, 'canyon_wall_mat');

  const boulder = new StandardMaterial('canyon_boulder_mat', scene);
  boulder.diffuseColor = Color3.FromHexString('#7A6B5B');
  boulder.specularColor = new Color3(0.08, 0.06, 0.04);

  const bridge = new StandardMaterial('canyon_bridge_mat', scene);
  bridge.diffuseColor = Color3.FromHexString('#5A5A5A');
  bridge.specularColor = new Color3(0.15, 0.15, 0.12);

  const bridgeMetal = new StandardMaterial('canyon_bridge_metal_mat', scene);
  bridgeMetal.diffuseColor = Color3.FromHexString('#4A4A4A');
  bridgeMetal.specularColor = new Color3(0.3, 0.3, 0.25);

  const wreck = new StandardMaterial('canyon_wreck_mat', scene);
  wreck.diffuseColor = Color3.FromHexString('#3A3A3A');
  wreck.specularColor = new Color3(0.1, 0.1, 0.08);

  const vegetation = new StandardMaterial('canyon_veg_mat', scene);
  vegetation.diffuseColor = Color3.FromHexString('#3A5C3A');
  vegetation.specularColor = new Color3(0.05, 0.08, 0.05);
  vegetation.alpha = 0.9;

  const beacon = new StandardMaterial('canyon_beacon_mat', scene);
  beacon.emissiveColor = new Color3(0.2, 0.8, 1.0);
  beacon.disableLighting = true;

  const extraction = new StandardMaterial('canyon_extraction_mat', scene);
  extraction.emissiveColor = new Color3(0.1, 1.0, 0.3);
  extraction.alpha = 0.3;
  extraction.disableLighting = true;

  return {
    ground,
    wall,
    boulder,
    bridge,
    bridgeMetal,
    wreck,
    vegetation,
    beacon,
    extraction,
  };
}

// ============================================================================
// TERRAIN
// ============================================================================

function createTerrain(scene: Scene, materials: CanyonMaterials): Mesh {
  const terrain = MeshBuilder.CreateGround(
    'canyon_terrain',
    {
      width: CANYON_HALF_WIDTH * 2 + 20,
      height: CANYON_LENGTH + 100,
      subdivisions: 128,
    },
    scene
  );
  terrain.material = materials.ground;
  terrain.position.set(0, 0, -CANYON_LENGTH / 2);
  terrain.receiveShadows = true;

  // Apply height variation to vertices
  const positions = terrain.getVerticesData('position');
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      // Gentle rolling + some noise
      positions[i + 1] +=
        Math.sin(x * 0.05) * 0.8 + Math.sin(z * 0.03) * 1.2 + Math.sin(x * 0.15 + z * 0.1) * 0.3;
    }
    terrain.updateVerticesData('position', positions);
    terrain.createNormals(true);
  }

  return terrain;
}

/**
 * Sample terrain height at a given world position.
 * This is a simplified approximation matching the vertex displacement above.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  // Replicate the same height function used in createTerrain
  const localZ = z + CANYON_LENGTH / 2;
  const localX = x;
  return (
    Math.sin(localX * 0.05) * 0.8 +
    Math.sin(localZ * 0.03) * 1.2 +
    Math.sin(localX * 0.15 + localZ * 0.1) * 0.3
  );
}

// ============================================================================
// CANYON WALLS
// ============================================================================

function createCanyonWalls(
  scene: Scene,
  materials: CanyonMaterials,
  rand: () => number
): { leftWalls: Mesh[]; rightWalls: Mesh[] } {
  const leftWalls: Mesh[] = [];
  const rightWalls: Mesh[] = [];

  for (let i = 0; i < WALL_SEGMENTS; i++) {
    const z = -i * WALL_SEGMENT_LENGTH;

    // [FIX #41] Slightly randomize wall width to hide seams
    const seamHideOverlap = 3; // Extra overlap to hide seams

    // Left wall - varies in distance from center
    const leftOffset = CANYON_HALF_WIDTH + rand() * 8;
    const leftWall = MeshBuilder.CreateBox(
      `canyon_wall_left_${i}`,
      {
        width: 15 + rand() * 10,
        height: WALL_HEIGHT + rand() * 30,
        depth: WALL_SEGMENT_LENGTH + seamHideOverlap, // [FIX #41] Extra overlap
      },
      scene
    );
    leftWall.material = materials.wall;
    leftWall.position.set(-leftOffset - 5, WALL_HEIGHT / 2 - 5, z);
    // [FIX #41] Reduce rotation to minimize visible gaps
    leftWall.rotation.y = (rand() - 0.5) * 0.05;
    leftWalls.push(leftWall);

    // Right wall
    const rightOffset = CANYON_HALF_WIDTH + rand() * 8;
    const rightWall = MeshBuilder.CreateBox(
      `canyon_wall_right_${i}`,
      {
        width: 15 + rand() * 10,
        height: WALL_HEIGHT + rand() * 30,
        depth: WALL_SEGMENT_LENGTH + seamHideOverlap, // [FIX #41] Extra overlap
      },
      scene
    );
    rightWall.material = materials.wall;
    rightWall.position.set(rightOffset + 5, WALL_HEIGHT / 2 - 5, z);
    // [FIX #41] Reduce rotation to minimize visible gaps
    rightWall.rotation.y = (rand() - 0.5) * 0.05;
    rightWalls.push(rightWall);
  }

  return { leftWalls, rightWalls };
}

// ============================================================================
// BOULDERS / OBSTACLES
// ============================================================================

/** GLB models cycled for boulder instances. */
const BOULDER_GLBS = [
  GLB.alienBoulder,
  GLB.alienRockMed1,
  GLB.alienRockMed2,
  GLB.alienRockMed3,
  GLB.alienTallRock1,
  GLB.alienTallRock2,
];

function createBoulders(scene: Scene, _materials: CanyonMaterials, rand: () => number): Mesh[] {
  // We return Mesh[] for interface compat. Each boulder is a TransformNode wrapper
  // with GLB children; we create a tiny invisible collision sphere alongside it so
  // that the collision system (which checks boulder.position / boulder.scaling)
  // continues to work unchanged.
  const boulders: Mesh[] = [];

  for (let i = 0; i < BOULDER_COUNT; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.6;
    const z = -rand() * (CANYON_LENGTH - 200) - 100;
    const size = 1.5 + rand() * 3.5;

    // Skip boulders too close to bridge or extraction
    if (Math.abs(z - BRIDGE_Z) < 60) continue;
    if (Math.abs(z - EXTRACTION_Z) < 50) continue;

    const glbPath = BOULDER_GLBS[i % BOULDER_GLBS.length];
    const boulderNode = AssetManager.createInstanceByPath(
      glbPath,
      `canyon_boulder_${i}`,
      scene,
      true,
      'environment'
    );

    // Invisible collision sphere that the gameplay collision system checks
    const collider = MeshBuilder.CreateSphere(
      `canyon_boulder_col_${i}`,
      { diameter: size, segments: 4 },
      scene
    );
    collider.isVisible = false;
    collider.position.set(x, sampleTerrainHeight(x, z) + size * 0.3, z);
    collider.scaling.set(0.7 + rand() * 0.6, 0.5 + rand() * 0.5, 0.7 + rand() * 0.6);

    if (boulderNode) {
      boulderNode.position.set(x, sampleTerrainHeight(x, z) + size * 0.3, z);
      boulderNode.scaling.set(
        (0.7 + rand() * 0.6) * size * 0.5,
        (0.5 + rand() * 0.5) * size * 0.5,
        (0.7 + rand() * 0.6) * size * 0.5
      );
      boulderNode.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    }

    // Push the invisible collider so collision code keeps working
    boulders.push(collider);
  }

  return boulders;
}

// ============================================================================
// BRIDGES
// ============================================================================

function createBridges(scene: Scene, materials: CanyonMaterials): BridgeStructure[] {
  const bridges: BridgeStructure[] = [];

  // Main bridge (collapsible during gameplay)
  const mainBridge = createSingleBridge(scene, materials, new Vector3(0, 8, BRIDGE_Z), true);
  bridges.push(mainBridge);

  // A smaller intact bridge earlier in the canyon (non-collapsible)
  const earlyBridge = createSingleBridge(scene, materials, new Vector3(0, 6, -600), false);
  bridges.push(earlyBridge);

  return bridges;
}

function createSingleBridge(
  scene: Scene,
  materials: CanyonMaterials,
  position: Vector3,
  isCollapsible: boolean
): BridgeStructure {
  const bridgeWidth = CANYON_HALF_WIDTH * 2 + 10;
  const segmentCount = isCollapsible ? 8 : 1;
  const segmentDepth = 8 / segmentCount;
  const segments: Mesh[] = [];

  // Bridge deck - split into segments for collapse animation
  // [FIX #30] Increased overlap to eliminate visible gaps
  const segmentOverlap = 0.3;
  for (let i = 0; i < segmentCount; i++) {
    const segment = MeshBuilder.CreateBox(
      `canyon_bridge_segment_${position.z}_${i}`,
      { width: bridgeWidth, height: 1.5, depth: segmentDepth + segmentOverlap },
      scene
    );
    segment.material = materials.bridge;
    segment.position.set(
      position.x,
      position.y,
      position.z + (i - segmentCount / 2) * segmentDepth
    );
    segments.push(segment);
  }

  // Support pillars
  const pillarPositions = [
    new Vector3(-bridgeWidth / 2 + 2, position.y / 2, position.z),
    new Vector3(bridgeWidth / 2 - 2, position.y / 2, position.z),
  ];

  for (let p = 0; p < pillarPositions.length; p++) {
    const pillar = MeshBuilder.CreateBox(
      `canyon_bridge_pillar_${position.z}_${p}`,
      { width: 2, height: position.y, depth: 3 },
      scene
    );
    pillar.material = materials.bridgeMetal;
    pillar.position = pillarPositions[p];
  }

  // [FIX #15] Railing meshes using GLB handrail assets
  for (const side of [-1, 1]) {
    // Try to use GLB handrail, fall back to MeshBuilder
    const handrailPath = side === 1 ? GLB.bridgeHandrail1 : GLB.bridgeHandrail2;
    const handrailNode = AssetManager.createInstanceByPath(
      handrailPath,
      `canyon_bridge_railing_${position.z}_${side}`,
      scene,
      true,
      'environment'
    );

    if (handrailNode) {
      handrailNode.position.set(
        position.x + side * (bridgeWidth / 2 - 0.5),
        position.y + 0.5,
        position.z
      );
      handrailNode.rotation.y = side === 1 ? 0 : Math.PI;
      handrailNode.scaling.setAll(2.0);
    } else {
      // Fallback to primitive
      const railing = MeshBuilder.CreateBox(
        `canyon_bridge_railing_fallback_${position.z}_${side}`,
        { width: 0.3, height: 1.5, depth: 10 },
        scene
      );
      railing.material = materials.bridgeMetal;
      railing.position.set(position.x + side * (bridgeWidth / 2 - 0.5), position.y + 1.0, position.z);
    }
  }

  // Use the first segment as the representative mesh
  const bridgeMesh = segments[0];

  return {
    mesh: bridgeMesh,
    position: position.clone(),
    isCollapsible,
    collapsed: false,
    segments,
  };
}

// ============================================================================
// WRECKED VEHICLES
// ============================================================================

/** GLB models used for wrecked vehicle bodies, cycled via index. */
const WRECK_BODY_GLBS = [
  GLB.wreckSpaceship2,
  GLB.wreckSpaceship3,
  GLB.wreckSpaceship4,
  GLB.wreckSpaceship5,
];

/** GLB models used for small debris pieces around wrecks. */
const WRECK_DEBRIS_GLBS = [
  GLB.debrisBrick0,
  GLB.debrisBrick2_0,
  GLB.bricksStacked1,
  GLB.bricksStacked2,
  GLB.scrapMetal1_1,
  GLB.scrapMetal1_2,
];

async function createWrecks(
  scene: Scene,
  _materials: CanyonMaterials,
  rand: () => number
): Promise<TransformNode[]> {
  // Pre-load all wreck GLBs so instancing works
  const allWreckPaths = [...new Set([...WRECK_BODY_GLBS, ...WRECK_DEBRIS_GLBS])];
  await Promise.all(allWreckPaths.map((p) => AssetManager.loadAssetByPath(p, scene)));

  const wrecks: TransformNode[] = [];

  for (let i = 0; i < WRECK_COUNT; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.4;
    const z = -200 - rand() * (CANYON_LENGTH - 500);

    // Skip near bridge or extraction
    if (Math.abs(z - BRIDGE_Z) < 80) continue;
    if (Math.abs(z - EXTRACTION_Z) < 60) continue;

    const wreck = new TransformNode(`canyon_wreck_${i}`, scene);
    wreck.position.set(x, sampleTerrainHeight(x, z), z);
    wreck.rotation.y = rand() * Math.PI * 2;

    // Wreck body - GLB spaceship model (overturned)
    const bodyGlb = WRECK_BODY_GLBS[i % WRECK_BODY_GLBS.length];
    const bodyNode = AssetManager.createInstanceByPath(
      bodyGlb,
      `wreck_body_${i}`,
      scene,
      true,
      'environment'
    );
    if (bodyNode) {
      bodyNode.parent = wreck;
      bodyNode.position.y = 0.6;
      bodyNode.rotation.z = (rand() - 0.3) * 0.5;
      bodyNode.rotation.x = (rand() - 0.5) * 0.3;
      bodyNode.scaling.setAll(1.5);
    }

    // Debris around wreck - GLB debris pieces
    for (let d = 0; d < 3; d++) {
      const debrisGlb = WRECK_DEBRIS_GLBS[(i * 3 + d) % WRECK_DEBRIS_GLBS.length];
      const debrisNode = AssetManager.createInstanceByPath(
        debrisGlb,
        `wreck_debris_${i}_${d}`,
        scene,
        true,
        'prop'
      );
      if (debrisNode) {
        debrisNode.parent = wreck;
        debrisNode.position.set((rand() - 0.5) * 5, rand() * 0.3, (rand() - 0.5) * 5);
        debrisNode.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        debrisNode.scaling.setAll(1.2 + rand() * 0.8);
      }
    }

    wrecks.push(wreck);
  }

  return wrecks;
}

// ============================================================================
// VEGETATION
// ============================================================================

/** GLB models cycled for vegetation clusters. */
const VEGETATION_GLBS = [
  GLB.alienBush,
  GLB.alienFern,
  GLB.alienGrass,
  GLB.alienIceplant,
  GLB.alienMushroom1,
  GLB.alienMushroom2,
  GLB.alienDeadTree1,
  GLB.alienDeadTree2,
  GLB.alienTwistedTree1,
  GLB.alienTwistedTree2,
];

function createVegetation(scene: Scene, _materials: CanyonMaterials, rand: () => number): Mesh[] {
  // We return Mesh[] for interface compatibility. Each vegetation cluster uses a GLB
  // model with an invisible collision reference mesh for the array.
  const vegMeshes: Mesh[] = [];

  for (let i = 0; i < VEGETATION_COUNT; i++) {
    // Vegetation grows at base of canyon walls
    const side = rand() > 0.5 ? 1 : -1;
    const x = side * (CANYON_HALF_WIDTH - 3 + rand() * 6);
    const z = -rand() * CANYON_LENGTH;
    const size = 1.5 + rand() * 2;

    const glbPath = VEGETATION_GLBS[i % VEGETATION_GLBS.length];
    const vegNode = AssetManager.createInstanceByPath(
      glbPath,
      `canyon_veg_glb_${i}`,
      scene,
      true,
      'environment'
    );

    // Invisible reference mesh for interface compatibility (Mesh[])
    const refMesh = MeshBuilder.CreateSphere(
      `canyon_veg_${i}`,
      { diameter: 0.1, segments: 4 },
      scene
    );
    refMesh.isVisible = false;
    refMesh.position.set(x, sampleTerrainHeight(x, z) + 0.5, z);

    if (vegNode) {
      vegNode.position.set(x, sampleTerrainHeight(x, z), z);
      vegNode.scaling.setAll(size * 0.6);
      vegNode.rotation.y = rand() * Math.PI * 2;
    }

    vegMeshes.push(refMesh);
  }

  return vegMeshes;
}

// ============================================================================
// DUST EMITTERS
// ============================================================================

function createDustEmitters(scene: Scene, rand: () => number): TransformNode[] {
  const emitters: TransformNode[] = [];

  // Place dust sources along the canyon
  for (let i = 0; i < 15; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.5;
    const z = -rand() * CANYON_LENGTH;
    const emitter = new TransformNode(`canyon_dust_${i}`, scene);
    emitter.position.set(x, 1, z);
    emitters.push(emitter);
  }

  return emitters;
}

// ============================================================================
// LIGHTING
// ============================================================================

function createLighting(scene: Scene): {
  sunLight: DirectionalLight;
  canyonLights: PointLight[];
} {
  // Sun coming from high angle, casting light through canyon gaps
  const sunLight = new DirectionalLight(
    'canyon_sun',
    new Vector3(0.3, -0.7, -0.4).normalize(),
    scene
  );
  sunLight.intensity = 2.2;
  sunLight.diffuse = Color3.FromHexString('#FFD4A0');

  // Point lights along the canyon for ambient fill in shadowed areas
  const canyonLights: PointLight[] = [];
  for (let i = 0; i < 10; i++) {
    const z = -(i / 10) * CANYON_LENGTH;
    const light = new PointLight(`canyon_fill_${i}`, new Vector3(0, 15, z), scene);
    light.intensity = 0.4;
    light.diffuse = Color3.FromHexString('#FFC090');
    light.range = 80;
    canyonLights.push(light);
  }

  return { sunLight, canyonLights };
}

// ============================================================================
// OBJECTIVE MARKERS
// ============================================================================

function createObjectiveMarkers(scene: Scene): ObjectiveMarker[] {
  const markers: ObjectiveMarker[] = [];

  const markerConfigs = [
    { z: -500, label: 'CHECKPOINT ALPHA' },
    { z: -1000, label: 'CHECKPOINT BRAVO' },
    { z: BRIDGE_Z, label: 'BRIDGE CROSSING' },
    { z: -2000, label: 'CHECKPOINT CHARLIE' },
    { z: -2500, label: 'CHECKPOINT DELTA' },
    { z: EXTRACTION_Z, label: 'EXTRACTION POINT' },
  ];

  for (let i = 0; i < markerConfigs.length; i++) {
    const cfg = markerConfigs[i];
    const pos = new Vector3(0, 10, cfg.z);

    // [FIX #31] Use hexagonal prism for visual interest
    const markerMesh = MeshBuilder.CreateCylinder(
      `canyon_marker_${i}`,
      { diameter: 1.5, height: 25, tessellation: 6 },
      scene
    );
    const markerMat = new StandardMaterial(`canyon_marker_mat_${i}`, scene);
    markerMat.emissiveColor = new Color3(0.2, 0.7, 1.0);
    markerMat.alpha = 0.4;
    markerMat.disableLighting = true;
    markerMesh.material = markerMat;
    markerMesh.position = pos.clone();

    // [FIX #31] Add inner rotating element
    const innerMarker = MeshBuilder.CreateCylinder(
      `canyon_marker_inner_${i}`,
      { diameter: 0.8, height: 30, tessellation: 4 },
      scene
    );
    innerMarker.parent = markerMesh;
    innerMarker.position.y = 2;
    const innerMat = new StandardMaterial(`canyon_marker_inner_mat_${i}`, scene);
    innerMat.emissiveColor = new Color3(0.4, 0.9, 1.0);
    innerMat.alpha = 0.5;
    innerMat.disableLighting = true;
    innerMarker.material = innerMat;

    // [FIX #31] Animate rotation
    scene.registerBeforeRender(() => {
      if (!markerMesh.isDisposed()) {
        markerMesh.rotation.y += 0.01;
      }
    });

    const beacon = new PointLight(
      `canyon_marker_light_${i}`,
      pos.add(new Vector3(0, 12, 0)),
      scene
    );
    beacon.intensity = 2.0; // [FIX #31] Brighter beacon
    beacon.diffuse = new Color3(0.2, 0.8, 1.0);
    beacon.range = 50; // [FIX #31] Larger range

    markers.push({
      mesh: markerMesh,
      beacon,
      position: pos,
      label: cfg.label,
      reached: false,
    });
  }

  return markers;
}

// ============================================================================
// EXTRACTION ZONE
// ============================================================================

function createExtractionZone(scene: Scene, materials: CanyonMaterials): Mesh {
  const zone = MeshBuilder.CreateCylinder(
    'canyon_extraction_zone',
    { diameter: 30, height: 0.3, tessellation: 32 },
    scene
  );
  zone.material = materials.extraction;
  zone.position.set(0, 0.2, EXTRACTION_Z);

  // [FIX #32] Pulsing emissive ring
  const ringMat = new StandardMaterial('canyon_extraction_ring_mat', scene);
  ringMat.emissiveColor = new Color3(0.1, 1.0, 0.3);
  ringMat.alpha = 0.6;
  ringMat.disableLighting = true;

  const ring = MeshBuilder.CreateTorus(
    'canyon_extraction_ring',
    { diameter: 28, thickness: 1.0, tessellation: 32 },
    scene
  );
  ring.material = ringMat;
  ring.position.set(0, 0.4, EXTRACTION_Z);
  ring.rotation.x = Math.PI / 2;

  // [FIX #32] Animate pulsing
  scene.registerBeforeRender(() => {
    if (!ring.isDisposed() && ringMat) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.3;
      ringMat.alpha = pulse;
      ring.scaling.x = 1 + Math.sin(performance.now() * 0.002) * 0.05;
      ring.scaling.z = ring.scaling.x;
    }
  });

  // Landing pad markings
  const padCenter = MeshBuilder.CreateCylinder(
    'canyon_extraction_pad',
    { diameter: 10, height: 0.15, tessellation: 32 },
    scene
  );
  const padMat = new StandardMaterial('canyon_pad_mat', scene);
  padMat.diffuseColor = Color3.FromHexString('#444444');
  padMat.specularColor = new Color3(0.1, 0.1, 0.1);
  padCenter.material = padMat;
  padCenter.position.set(0, 0.35, EXTRACTION_Z);

  // [FIX #32] Add H marking for helipad
  const hBar1 = MeshBuilder.CreateBox(
    'canyon_h_bar1',
    { width: 4, height: 0.05, depth: 0.5 },
    scene
  );
  hBar1.position.set(0, 0.4, EXTRACTION_Z);
  const hMat = new StandardMaterial('canyon_h_mat', scene);
  hMat.diffuseColor = Color3.FromHexString('#FFFF00');
  hMat.emissiveColor = new Color3(0.3, 0.3, 0);
  hBar1.material = hMat;

  const hBar2 = hBar1.clone('canyon_h_bar2');
  hBar2.rotation.y = Math.PI / 2;

  return zone;
}

// ============================================================================
// SKY DOME - Using proper Babylon.js skybox with SkyboxManager
// ============================================================================

/** Stored skybox result for disposal */
let canyonSkyboxResult: SkyboxResult | null = null;

function createSkyDome(scene: Scene): Mesh {
  // Use SkyboxManager for proper Babylon.js skybox with desert atmosphere
  const skyboxManager = new SkyboxManager(scene);
  canyonSkyboxResult = skyboxManager.createFallbackSkybox({
    type: 'desert',
    size: 10000,
    useEnvironmentLighting: true,
    environmentIntensity: 1.0,
    // Canyon has dusty orange atmosphere
    tint: Color3.FromHexString('#C8845A'),
  });

  return canyonSkyboxResult.mesh;
}

/**
 * Get the current canyon skybox result for disposal.
 */
export function getCanyonSkyboxResult(): SkyboxResult | null {
  return canyonSkyboxResult;
}

// ============================================================================
// BRIDGE COLLAPSE ANIMATION
// ============================================================================

/**
 * Animate the collapse of a bridge structure.
 * Each segment falls with slightly different timing for dramatic effect.
 */
export function collapseBridge(bridge: BridgeStructure, scene: Scene): void {
  if (bridge.collapsed || !bridge.isCollapsible) return;
  bridge.collapsed = true;

  // Sequentially drop each segment with slight delay
  bridge.segments.forEach((segment, index) => {
    const delay = index * 150; // 150ms between each segment

    setTimeout(() => {
      // Animate segment falling
      const startY = segment.position.y;
      const startTime = performance.now();
      const duration = 2000; // 2 seconds to fall

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);

        // Accelerating fall (gravity)
        const fallDistance = t * t * 30;
        segment.position.y = startY - fallDistance;

        // Tumble rotation
        segment.rotation.x += 0.02 * t;
        segment.rotation.z += 0.01 * t;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Remove after falling off-screen
          segment.isVisible = false;
        }
      };

      animate();
    }, delay);
  });
}

// ============================================================================
// ROCKSLIDE GENERATION
// ============================================================================

export interface RockslideRock {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
  /** GLB root node if using GLB model (for proper disposal). */
  glbRoot?: TransformNode;
}

/** GLB models cycled for rockslide debris. */
const ROCKSLIDE_GLBS = [
  GLB.rockBrick1,
  GLB.rockBrick2,
  GLB.rockBrick3,
  GLB.rockBrick4,
  GLB.rockBrickStacked1,
  GLB.rockBrickStacked2,
];

/**
 * Spawn a rockslide from a canyon wall position.
 * Returns rocks that should be updated each frame.
 * Now uses GLB debris models instead of primitive spheres.
 */
export function spawnRockslide(
  scene: Scene,
  wallSide: 'left' | 'right',
  zPosition: number,
  count: number = 12
): RockslideRock[] {
  const rocks: RockslideRock[] = [];
  const rand = seededRandom(Math.floor(zPosition * 100));

  const baseX = wallSide === 'left' ? -CANYON_HALF_WIDTH : CANYON_HALF_WIDTH;

  for (let i = 0; i < count; i++) {
    const size = 0.8 + rand() * 2.5;

    // Select GLB model for this rock
    const glbPath = ROCKSLIDE_GLBS[i % ROCKSLIDE_GLBS.length];
    const glbNode = AssetManager.createInstanceByPath(
      glbPath,
      `rockslide_glb_${zPosition}_${i}`,
      scene,
      true,
      'prop'
    );

    // Create an invisible collision sphere as the "mesh" reference
    // (the physics/collision code expects a Mesh with position, scaling, etc.)
    const collisionMesh = MeshBuilder.CreateSphere(
      `rockslide_${zPosition}_${i}`,
      { diameter: size, segments: 4 },
      scene
    );
    collisionMesh.isVisible = false;
    collisionMesh.position.set(
      baseX + (rand() - 0.5) * 5,
      WALL_HEIGHT * 0.5 + rand() * WALL_HEIGHT * 0.4,
      zPosition + (rand() - 0.5) * 15
    );

    if (glbNode) {
      glbNode.position.copyFrom(collisionMesh.position);
      glbNode.scaling.setAll(size * 1.2);
      glbNode.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    }

    // Velocity toward canyon center and downward
    const directionX = wallSide === 'left' ? 1 : -1;
    const velocity = new Vector3(
      directionX * (5 + rand() * 10),
      -2 - rand() * 5,
      (rand() - 0.5) * 5
    );

    const rotationSpeed = new Vector3((rand() - 0.5) * 4, (rand() - 0.5) * 4, (rand() - 0.5) * 4);

    rocks.push({
      mesh: collisionMesh,
      velocity,
      rotationSpeed,
      lifetime: 5 + rand() * 3,
      glbRoot: glbNode ?? undefined,
    });
  }

  return rocks;
}

/**
 * Update rockslide physics. Returns true if rocks still active.
 */
export function updateRockslide(
  rocks: RockslideRock[],
  deltaTime: number,
  gravity: number = 20
): boolean {
  let anyActive = false;

  for (const rock of rocks) {
    if (rock.lifetime <= 0) continue;

    rock.lifetime -= deltaTime;

    // Apply gravity
    rock.velocity.y -= gravity * deltaTime;

    // Update position
    rock.mesh.position.addInPlace(rock.velocity.scale(deltaTime));

    // Update rotation
    rock.mesh.rotation.addInPlace(rock.rotationSpeed.scale(deltaTime));

    // Sync GLB node position and rotation if present
    if (rock.glbRoot) {
      rock.glbRoot.position.copyFrom(rock.mesh.position);
      rock.glbRoot.rotation.addInPlace(rock.rotationSpeed.scale(deltaTime));
    }

    // Bounce off ground
    const groundY = sampleTerrainHeight(rock.mesh.position.x, rock.mesh.position.z);
    if (rock.mesh.position.y < groundY + 0.5) {
      rock.mesh.position.y = groundY + 0.5;
      rock.velocity.y = Math.abs(rock.velocity.y) * 0.3;
      rock.velocity.x *= 0.7;
      rock.velocity.z *= 0.7;
    }

    if (rock.lifetime > 0) {
      anyActive = true;
    } else {
      rock.mesh.dispose();
      rock.glbRoot?.dispose(false, true);
    }
  }

  return anyActive;
}

/**
 * Dispose all rocks in a rockslide.
 */
export function disposeRockslide(rocks: RockslideRock[]): void {
  for (const rock of rocks) {
    rock.mesh.dispose();
    rock.glbRoot?.dispose(false, true);
  }
  rocks.length = 0;
}
