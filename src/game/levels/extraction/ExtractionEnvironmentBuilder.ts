/**
 * ExtractionEnvironmentBuilder - GLB-based LZ Omega environment
 *
 * Builds a fortified landing zone for the Extraction level using loaded GLB
 * assets from the asset pipeline. The LZ is surrounded by a fence perimeter
 * with four distinct defense sectors:
 *
 *   a) Landing Pad Center - flat area with pad markings, lamp posts
 *   b) North Perimeter   - fence line with gap for enemy approach
 *   c) South Bunker      - modular buildings with computers, cover
 *   d) East/West Flanks  - pipe infrastructure, electrical stations
 *
 * Night atmosphere: near-black sky, only local point lights at the LZ.
 * Inspired by ODST "Tayari Plaza" -- desperate, isolated, surrounded.
 *
 * Uses AssetManager.loadAssetByPath / createInstanceByPath for caching and
 * instancing, following the same pattern as BattlefieldEnvironment.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { SkyboxManager, type SkyboxResult } from '../../core/SkyboxManager';

// ============================================================================
// TYPES
// ============================================================================

interface Placement {
  /** Filesystem path relative to public root */
  path: string;
  /** World-space position */
  position: Vector3;
  /** Y-axis rotation in radians */
  rotationY: number;
  /** Uniform scale (default 1.0) */
  scale: number;
  /** Human-readable label for logging */
  label: string;
}

export interface ExtractionEnvironmentResult {
  /** Root node parenting all environment geometry */
  root: TransformNode;
  /** All environment meshes (for visibility toggling and disposal) */
  meshes: Mesh[];
  /** All point lights placed in the environment */
  lights: PointLight[];
  /** Cover objects available for gameplay collision */
  coverMeshes: Mesh[];
  /** Dispose all environment resources */
  dispose: () => void;
}

// ============================================================================
// ASSET PATHS (matching the extraction manifest)
// ============================================================================

const FENCE = {
  b_1: '/models/props/modular/fence_b_1.glb',
  b_pillar: '/models/props/modular/fence_b_pillar.glb',
  e_1: '/models/props/modular/fence_e_1.glb',
  e_2: '/models/props/modular/fence_e_2.glb',
  e_pillar: '/models/props/modular/fence_e_pillar_1.glb',
  e_corner: '/models/props/modular/fence_e_pillar_1_corner.glb',
} as const;

const MODULAR = {
  window_wall_a: '/models/environment/modular/Window_Wall_SideA.glb',
  window_wall_b: '/models/environment/modular/Window_Wall_SideB.glb',
  threewin_wall_a: '/models/environment/modular/ThreeWindows_Wall_SideA.glb',
  threewin_wall_b: '/models/environment/modular/ThreeWindows_Wall_SideB.glb',
  wall_empty: '/models/environment/modular/Wall_Empty.glb',
  door_single_wall_a: '/models/environment/modular/DoorSingle_Wall_SideA.glb',
  floor_basic: '/models/environment/modular/FloorTile_Basic.glb',
  floor_empty: '/models/environment/modular/FloorTile_Empty.glb',
  roof_empty: '/models/environment/modular/RoofTile_Empty.glb',
  roof_plate2: '/models/environment/modular/RoofTile_Plate2.glb',
  roof_vents: '/models/environment/modular/RoofTile_Vents.glb',
  column_1: '/models/environment/modular/Column_1.glb',
  computer_sm: '/models/environment/modular/Props_ComputerSmall.glb',
  computer: '/models/environment/modular/Props_Computer.glb',
  crate: '/models/environment/modular/Props_Crate.glb',
  crate_long: '/models/environment/modular/Props_CrateLong.glb',
  shelf: '/models/environment/modular/Props_Shelf.glb',
  details_plate_large: '/models/environment/modular/Details_Plate_Large.glb',
  details_vent_1: '/models/environment/modular/Details_Vent_1.glb',
  pipes_modular: '/models/environment/modular/Pipes.glb',
} as const;

const PROPS = {
  pipe_1: '/models/props/pipes/pipe_e_1.glb',
  pipe_2: '/models/props/pipes/pipe_e_2.glb',
  pipe_3: '/models/props/pipes/pipe_mx_1.glb',
  pipe_4: '/models/props/pipes/pipe_mx_2.glb',
  elec_1: '/models/props/industrial/electrical_equipment_1.glb',
  gear_1: '/models/props/electrical/gear_mx_1.glb',
  gear_2: '/models/props/electrical/gear_mx_2.glb',
  lamp_off: '/models/props/electrical/lamp_mx_4_off.glb',
  concrete_block: '/models/props/electrical/concrete_block_mx_1.glb',
  radio: '/models/props/electrical/handheld_fm_radio_etx_1.glb',
} as const;

// Station wall GLBs for canyon walls (replacing procedural boxes)
const STATION_WALLS = {
  wall_hr_1: '/models/environment/station/wall_hr_1.glb',
  wall_hr_15: '/models/environment/station/wall_hr_15.glb',
  wall_rg_1: '/models/environment/station/wall_rg_1.glb',
} as const;

// ============================================================================
// PLACEMENT DATA - The full LZ Omega layout
// ============================================================================

/**
 * All LZ positions are relative to lzCenter (0, 0, -500) which is the
 * canonical landing pad origin used by ExtractionLevel.
 */
const LZ_CENTER_X = 0;
const LZ_CENTER_Z = -500;

/** Offset helper: translate placement relative to LZ center */
function lz(x: number, y: number, z: number): Vector3 {
  return new Vector3(LZ_CENTER_X + x, y, LZ_CENTER_Z + z);
}

// --------------------------------------------------------------------------
// FENCE PERIMETER
// --------------------------------------------------------------------------
// The perimeter is a roughly rectangular ring (80m x 70m) around the landing
// pad. The north side has a deliberate gap (~15m wide) where enemies funnel
// through -- this creates a choke point the player must defend.
//
// Layout (top-down, north = +Z relative to LZ center):
//
//           N gap
//   NW corner ---- NE corner
//   |                       |
//   W fences          E fences
//   |                       |
//   SW corner ---- SE corner
//           S bunker
// --------------------------------------------------------------------------

function getFencePerimeter(): Placement[] {
  const p: Placement[] = [];

  // Fence segment approximate length: ~5 units for fence_e_1/e_2
  const FENCE_LEN = 5.0;
  const HALF_W = 40; // Half-width of perimeter (X)
  const HALF_D = 35; // Half-depth of perimeter (Z)

  // -- SOUTH WALL (continuous, full coverage) --
  // 16 fence segments spanning 80m
  for (let i = 0; i < 16; i++) {
    const x = -HALF_W + i * FENCE_LEN + FENCE_LEN / 2;
    const variant = i % 2 === 0 ? FENCE.e_1 : FENCE.e_2;
    p.push({
      path: variant,
      position: lz(x, 0, -HALF_D),
      rotationY: 0,
      scale: 1.0,
      label: `fence_south_${i}`,
    });
  }

  // -- NORTH WALL (gap in center for enemy funnel, ~15m opening) --
  // West half: 5 segments from -40 to -15
  for (let i = 0; i < 5; i++) {
    const x = -HALF_W + i * FENCE_LEN + FENCE_LEN / 2;
    p.push({
      path: i % 2 === 0 ? FENCE.e_1 : FENCE.e_2,
      position: lz(x, 0, HALF_D),
      rotationY: Math.PI,
      scale: 1.0,
      label: `fence_north_w_${i}`,
    });
  }
  // East half: 5 segments from +15 to +40
  for (let i = 0; i < 5; i++) {
    const x = 15 + i * FENCE_LEN + FENCE_LEN / 2;
    p.push({
      path: i % 2 === 0 ? FENCE.e_2 : FENCE.e_1,
      position: lz(x, 0, HALF_D),
      rotationY: Math.PI,
      scale: 1.0,
      label: `fence_north_e_${i}`,
    });
  }

  // -- WEST WALL --
  // 14 segments spanning 70m
  for (let i = 0; i < 14; i++) {
    const z = -HALF_D + i * FENCE_LEN + FENCE_LEN / 2;
    p.push({
      path: i % 3 === 0 ? FENCE.b_1 : FENCE.e_1,
      position: lz(-HALF_W, 0, z),
      rotationY: Math.PI / 2,
      scale: 1.0,
      label: `fence_west_${i}`,
    });
  }

  // -- EAST WALL --
  for (let i = 0; i < 14; i++) {
    const z = -HALF_D + i * FENCE_LEN + FENCE_LEN / 2;
    p.push({
      path: i % 3 === 0 ? FENCE.b_1 : FENCE.e_2,
      position: lz(HALF_W, 0, z),
      rotationY: -Math.PI / 2,
      scale: 1.0,
      label: `fence_east_${i}`,
    });
  }

  // -- CORNER PILLARS --
  const corners = [
    { x: -HALF_W, z: -HALF_D, rot: 0, label: 'corner_sw' },
    { x: HALF_W, z: -HALF_D, rot: Math.PI / 2, label: 'corner_se' },
    { x: -HALF_W, z: HALF_D, rot: -Math.PI / 2, label: 'corner_nw' },
    { x: HALF_W, z: HALF_D, rot: Math.PI, label: 'corner_ne' },
  ];
  for (const c of corners) {
    p.push({
      path: FENCE.e_corner,
      position: lz(c.x, 0, c.z),
      rotationY: c.rot,
      scale: 1.0,
      label: c.label,
    });
  }

  // -- PILLAR POSTS along walls (every 3rd fence segment) --
  // West wall pillars
  for (let i = 0; i < 14; i += 3) {
    const z = -HALF_D + i * FENCE_LEN;
    p.push({
      path: FENCE.e_pillar,
      position: lz(-HALF_W, 0, z),
      rotationY: Math.PI / 2,
      scale: 1.0,
      label: `pillar_west_${i}`,
    });
  }
  // East wall pillars
  for (let i = 0; i < 14; i += 3) {
    const z = -HALF_D + i * FENCE_LEN;
    p.push({
      path: FENCE.e_pillar,
      position: lz(HALF_W, 0, z),
      rotationY: -Math.PI / 2,
      scale: 1.0,
      label: `pillar_east_${i}`,
    });
  }
  // North gap flanking pillars (mark the choke point)
  p.push({
    path: FENCE.b_pillar,
    position: lz(-15, 0, HALF_D),
    rotationY: 0,
    scale: 1.2,
    label: 'pillar_gap_west',
  });
  p.push({
    path: FENCE.b_pillar,
    position: lz(15, 0, HALF_D),
    rotationY: 0,
    scale: 1.2,
    label: 'pillar_gap_east',
  });

  return p;
}

// --------------------------------------------------------------------------
// SOUTH BUNKER - Modular control buildings
// --------------------------------------------------------------------------
// Two L-shaped structures flanking the southern perimeter. These serve as
// the command post / control buildings for LZ Omega. Players can use them
// as cover during holdout waves.
//
// Quaternius modular segments are ~5.55 wide, ~3.09 tall, ~4.0 deep.
// --------------------------------------------------------------------------

const MOD_W = 5.55; // Module width (X)
const MOD_H = 3.09; // Module height (Y)
const MOD_D = 4.0; // Module depth (Z)

function getSouthBunker(): Placement[] {
  const p: Placement[] = [];

  // --- WEST CONTROL BUILDING (3 segments wide x 2 deep) ---
  const wcX = -22; // Center X of west building
  const wcZ = -28; // Center Z (south of LZ center)

  // Front walls (face north toward LZ)
  p.push({
    path: MODULAR.threewin_wall_a,
    position: lz(wcX - MOD_W, 0, wcZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'wc_front_left',
  });
  p.push({
    path: MODULAR.door_single_wall_a,
    position: lz(wcX, 0, wcZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'wc_front_door',
  });
  p.push({
    path: MODULAR.window_wall_a,
    position: lz(wcX + MOD_W, 0, wcZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'wc_front_right',
  });

  // Back walls (face south)
  p.push({
    path: MODULAR.wall_empty,
    position: lz(wcX - MOD_W, 0, wcZ - MOD_D / 2),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'wc_back_left',
  });
  p.push({
    path: MODULAR.wall_empty,
    position: lz(wcX, 0, wcZ - MOD_D / 2),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'wc_back_center',
  });
  p.push({
    path: MODULAR.window_wall_b,
    position: lz(wcX + MOD_W, 0, wcZ - MOD_D / 2),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'wc_back_right',
  });

  // Side walls
  p.push({
    path: MODULAR.wall_empty,
    position: lz(wcX - MOD_W - MOD_W / 2, 0, wcZ),
    rotationY: Math.PI / 2,
    scale: 1.0,
    label: 'wc_side_left',
  });
  p.push({
    path: MODULAR.wall_empty,
    position: lz(wcX + MOD_W + MOD_W / 2, 0, wcZ),
    rotationY: -Math.PI / 2,
    scale: 1.0,
    label: 'wc_side_right',
  });

  // Floor tiles
  for (let i = -1; i <= 1; i++) {
    p.push({
      path: MODULAR.floor_basic,
      position: lz(wcX + i * MOD_W, 0, wcZ),
      rotationY: 0,
      scale: 1.0,
      label: `wc_floor_${i}`,
    });
  }

  // Roof
  for (let i = -1; i <= 1; i++) {
    const roofType = i === 0 ? MODULAR.roof_vents : MODULAR.roof_plate2;
    p.push({
      path: roofType,
      position: lz(wcX + i * MOD_W, MOD_H, wcZ),
      rotationY: 0,
      scale: 1.0,
      label: `wc_roof_${i}`,
    });
  }

  // Interior: computer terminal and shelf
  p.push({
    path: MODULAR.computer_sm,
    position: lz(wcX - MOD_W + 1, 0.8, wcZ - 1),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'wc_computer_1',
  });
  p.push({
    path: MODULAR.shelf,
    position: lz(wcX + MOD_W - 1, 0, wcZ - 1.5),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'wc_shelf_1',
  });

  // --- EAST CONTROL BUILDING (2 segments wide x 1 deep, smaller) ---
  const ecX = 20;
  const ecZ = -28;

  // Front walls
  p.push({
    path: MODULAR.window_wall_a,
    position: lz(ecX - MOD_W / 2, 0, ecZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_front_left',
  });
  p.push({
    path: MODULAR.threewin_wall_a,
    position: lz(ecX + MOD_W / 2, 0, ecZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_front_right',
  });

  // Back walls
  p.push({
    path: MODULAR.wall_empty,
    position: lz(ecX - MOD_W / 2, 0, ecZ - MOD_D / 2),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'ec_back_left',
  });
  p.push({
    path: MODULAR.wall_empty,
    position: lz(ecX + MOD_W / 2, 0, ecZ - MOD_D / 2),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'ec_back_right',
  });

  // Side walls
  p.push({
    path: MODULAR.wall_empty,
    position: lz(ecX - MOD_W, 0, ecZ),
    rotationY: Math.PI / 2,
    scale: 1.0,
    label: 'ec_side_left',
  });
  p.push({
    path: MODULAR.wall_empty,
    position: lz(ecX + MOD_W, 0, ecZ),
    rotationY: -Math.PI / 2,
    scale: 1.0,
    label: 'ec_side_right',
  });

  // Floor
  p.push({
    path: MODULAR.floor_basic,
    position: lz(ecX - MOD_W / 2, 0, ecZ),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_floor_left',
  });
  p.push({
    path: MODULAR.floor_basic,
    position: lz(ecX + MOD_W / 2, 0, ecZ),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_floor_right',
  });

  // Roof
  p.push({
    path: MODULAR.roof_plate2,
    position: lz(ecX - MOD_W / 2, MOD_H, ecZ),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_roof_left',
  });
  p.push({
    path: MODULAR.roof_empty,
    position: lz(ecX + MOD_W / 2, MOD_H, ecZ),
    rotationY: 0,
    scale: 1.0,
    label: 'ec_roof_right',
  });

  // Interior: computer and radio
  p.push({
    path: MODULAR.computer,
    position: lz(ecX, 0.8, ecZ - 1),
    rotationY: Math.PI,
    scale: 1.0,
    label: 'ec_computer_1',
  });
  p.push({
    path: PROPS.radio,
    position: lz(ecX + MOD_W / 2 - 0.5, 0.85, ecZ + 1),
    rotationY: 0.3,
    scale: 2.5,
    label: 'ec_radio',
  });

  // Column supports at building entrances
  p.push({
    path: MODULAR.column_1,
    position: lz(wcX - MOD_W - MOD_W / 2 + 0.5, 0, wcZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'wc_column_left',
  });
  p.push({
    path: MODULAR.column_1,
    position: lz(wcX + MOD_W + MOD_W / 2 - 0.5, 0, wcZ + MOD_D / 2),
    rotationY: 0,
    scale: 1.0,
    label: 'wc_column_right',
  });

  return p;
}

// --------------------------------------------------------------------------
// EAST / WEST FLANKS - Pipe infrastructure and electrical stations
// --------------------------------------------------------------------------

function getFlankInfrastructure(): Placement[] {
  const p: Placement[] = [];

  // --- EAST FLANK: Pipe runs and electrical station ---

  // Pipe run along east inner wall (3 pipes connected)
  for (let i = 0; i < 3; i++) {
    p.push({
      path: i % 2 === 0 ? PROPS.pipe_1 : PROPS.pipe_2,
      position: lz(32, 0.5, -15 + i * 8),
      rotationY: Math.PI / 2,
      scale: 1.5,
      label: `east_pipe_${i}`,
    });
  }

  // Electrical equipment station (east)
  p.push({
    path: PROPS.elec_1,
    position: lz(33, 0, 10),
    rotationY: -Math.PI / 2,
    scale: 1.2,
    label: 'east_elec_station',
  });

  // Gear boxes flanking the electrical station
  p.push({
    path: PROPS.gear_1,
    position: lz(34, 0, 7),
    rotationY: 0,
    scale: 2.0,
    label: 'east_gear_1',
  });
  p.push({
    path: PROPS.gear_2,
    position: lz(34, 0, 13),
    rotationY: Math.PI,
    scale: 2.0,
    label: 'east_gear_2',
  });

  // Concrete blocks (cover)
  p.push({
    path: PROPS.concrete_block,
    position: lz(28, 0, 5),
    rotationY: 0.5,
    scale: 2.0,
    label: 'east_block_1',
  });
  p.push({
    path: PROPS.concrete_block,
    position: lz(30, 0, -5),
    rotationY: -0.3,
    scale: 2.0,
    label: 'east_block_2',
  });

  // --- WEST FLANK: Pipe junction and power station ---

  // Pipe junction (west side)
  for (let i = 0; i < 4; i++) {
    p.push({
      path: i < 2 ? PROPS.pipe_3 : PROPS.pipe_4,
      position: lz(-32, 0.5, -10 + i * 7),
      rotationY: -Math.PI / 2,
      scale: 1.5,
      label: `west_pipe_${i}`,
    });
  }

  // Modular pipes (Quaternius) connecting to buildings
  p.push({
    path: MODULAR.pipes_modular,
    position: lz(-28, 2, -20),
    rotationY: Math.PI / 2,
    scale: 1.2,
    label: 'west_mod_pipes_1',
  });
  p.push({
    path: MODULAR.pipes_modular,
    position: lz(-28, 2, -12),
    rotationY: Math.PI / 2,
    scale: 1.2,
    label: 'west_mod_pipes_2',
  });

  // Electrical station (west)
  p.push({
    path: PROPS.elec_1,
    position: lz(-33, 0, 8),
    rotationY: Math.PI / 2,
    scale: 1.2,
    label: 'west_elec_station',
  });

  // Gear
  p.push({
    path: PROPS.gear_1,
    position: lz(-35, 0, 5),
    rotationY: Math.PI,
    scale: 2.0,
    label: 'west_gear_1',
  });

  // Concrete blocks (cover)
  p.push({
    path: PROPS.concrete_block,
    position: lz(-28, 0, 0),
    rotationY: -0.5,
    scale: 2.0,
    label: 'west_block_1',
  });
  p.push({
    path: PROPS.concrete_block,
    position: lz(-30, 0, 12),
    rotationY: 0.7,
    scale: 2.0,
    label: 'west_block_2',
  });

  // Crates scattered around both flanks for additional cover
  const cratePositions = [
    { x: 25, z: -10, rot: 0.2, label: 'crate_e1' },
    { x: 26, z: -8, rot: 0.4, label: 'crate_e2' },
    { x: -25, z: 15, rot: -0.3, label: 'crate_w1' },
    { x: -26, z: 17, rot: 0.1, label: 'crate_w2' },
    { x: 18, z: 12, rot: 0.6, label: 'crate_ne' },
    { x: -18, z: 10, rot: -0.5, label: 'crate_nw' },
  ];
  for (const c of cratePositions) {
    p.push({
      path: MODULAR.crate,
      position: lz(c.x, 0, c.z),
      rotationY: c.rot,
      scale: 1.0,
      label: c.label,
    });
  }

  // Long crates stacked near bunkers
  p.push({
    path: MODULAR.crate_long,
    position: lz(-15, 0, -25),
    rotationY: 0.1,
    scale: 1.0,
    label: 'crate_long_sw',
  });
  p.push({
    path: MODULAR.crate_long,
    position: lz(12, 0, -25),
    rotationY: -0.2,
    scale: 1.0,
    label: 'crate_long_se',
  });

  // Detail plates on building exteriors
  p.push({
    path: MODULAR.details_plate_large,
    position: lz(-22, 1.5, -26),
    rotationY: 0,
    scale: 1.0,
    label: 'detail_plate_wc',
  });
  p.push({
    path: MODULAR.details_vent_1,
    position: lz(20, 1.5, -26),
    rotationY: 0,
    scale: 1.0,
    label: 'detail_vent_ec',
  });

  return p;
}

// --------------------------------------------------------------------------
// LAMP POSTS (perimeter lights - all "off" models for night desperation)
// --------------------------------------------------------------------------

function getLampPosts(): Placement[] {
  const p: Placement[] = [];
  const HALF_W = 40;
  const HALF_D = 35;

  // Lamps at 8 cardinal/ordinal positions around the perimeter
  const lampPositions = [
    { x: 0, z: HALF_D - 2, label: 'lamp_n' }, // North center (near gap)
    { x: -HALF_W + 2, z: 0, label: 'lamp_w' }, // West center
    { x: HALF_W - 2, z: 0, label: 'lamp_e' }, // East center
    { x: 0, z: -HALF_D + 2, label: 'lamp_s' }, // South center
    { x: -HALF_W + 8, z: HALF_D - 5, label: 'lamp_nw' },
    { x: HALF_W - 8, z: HALF_D - 5, label: 'lamp_ne' },
    { x: -HALF_W + 8, z: -HALF_D + 5, label: 'lamp_sw' },
    { x: HALF_W - 8, z: -HALF_D + 5, label: 'lamp_se' },
  ];

  for (const lp of lampPositions) {
    p.push({
      path: PROPS.lamp_off,
      position: lz(lp.x, 0, lp.z),
      rotationY: 0,
      scale: 2.0,
      label: lp.label,
    });
  }

  return p;
}

// ============================================================================
// LIGHTING SETUP
// ============================================================================

/**
 * Create the night atmosphere lighting for LZ Omega.
 * Very few, dim lights -- the LZ is barely illuminated.
 * This creates a desperate, isolated feeling.
 */
function createNightLighting(
  scene: Scene,
  root: TransformNode
): PointLight[] {
  const lights: PointLight[] = [];

  // --- Landing pad center light (faint overhead) ---
  const padLight = new PointLight('lz_padLight', lz(0, 8, 0), scene);
  padLight.diffuse = Color3.FromHexString('#FFE4B5'); // Warm amber
  padLight.intensity = 1.5;
  padLight.range = 30;
  padLight.parent = root;
  lights.push(padLight);

  // --- Emergency flare lights (red-orange, scattered) ---
  const flarePositions = [
    { x: -10, z: 5, label: 'flare_1' },
    { x: 12, z: -3, label: 'flare_2' },
    { x: -5, z: -15, label: 'flare_3' },
    { x: 8, z: 20, label: 'flare_4' },
  ];
  for (const fp of flarePositions) {
    const fl = new PointLight(`lz_${fp.label}`, lz(fp.x, 1.5, fp.z), scene);
    fl.diffuse = Color3.FromHexString('#FF4500'); // Red-orange flare
    fl.intensity = 0.8;
    fl.range = 15;
    fl.parent = root;
    lights.push(fl);
  }

  // --- Bunker interior lights (cold white, very dim) ---
  const bunkerLight1 = new PointLight('lz_bunkerLight_w', lz(-22, 2.5, -28), scene);
  bunkerLight1.diffuse = Color3.FromHexString('#B0C4DE'); // Cool steel blue
  bunkerLight1.intensity = 0.6;
  bunkerLight1.range = 12;
  bunkerLight1.parent = root;
  lights.push(bunkerLight1);

  const bunkerLight2 = new PointLight('lz_bunkerLight_e', lz(20, 2.5, -28), scene);
  bunkerLight2.diffuse = Color3.FromHexString('#B0C4DE');
  bunkerLight2.intensity = 0.6;
  bunkerLight2.range = 12;
  bunkerLight2.parent = root;
  lights.push(bunkerLight2);

  // --- Electrical station warning lights (amber, pulsing) ---
  const warnLight1 = new PointLight('lz_warn_e', lz(33, 3, 10), scene);
  warnLight1.diffuse = Color3.FromHexString('#FFA500');
  warnLight1.intensity = 0.5;
  warnLight1.range = 10;
  warnLight1.parent = root;
  lights.push(warnLight1);

  const warnLight2 = new PointLight('lz_warn_w', lz(-33, 3, 8), scene);
  warnLight2.diffuse = Color3.FromHexString('#FFA500');
  warnLight2.intensity = 0.5;
  warnLight2.range = 10;
  warnLight2.parent = root;
  lights.push(warnLight2);

  // --- North gap warning: faint red lights flanking the choke point ---
  const gapLightW = new PointLight('lz_gap_w', lz(-14, 3, 34), scene);
  gapLightW.diffuse = Color3.FromHexString('#8B0000'); // Dark red
  gapLightW.intensity = 0.4;
  gapLightW.range = 8;
  gapLightW.parent = root;
  lights.push(gapLightW);

  const gapLightE = new PointLight('lz_gap_e', lz(14, 3, 34), scene);
  gapLightE.diffuse = Color3.FromHexString('#8B0000');
  gapLightE.intensity = 0.4;
  gapLightE.range = 8;
  gapLightE.parent = root;
  lights.push(gapLightE);

  return lights;
}

// ============================================================================
// PROCEDURAL ELEMENTS (things that must remain procedural)
// ============================================================================

/**
 * Create the LZ pad -- a flat circular concrete platform with markings.
 * This remains procedural because it is a simple geometric shape.
 */
function createLandingPad(scene: Scene, root: TransformNode): Mesh[] {
  const meshes: Mesh[] = [];

  // Main pad surface
  const pad = MeshBuilder.CreateCylinder(
    'lz_pad',
    { height: 0.3, diameter: 30, tessellation: 32 },
    scene
  );
  const padMat = new StandardMaterial('lz_padMat', scene);
  padMat.diffuseColor = new Color3(0.35, 0.35, 0.35);
  padMat.specularColor = new Color3(0.1, 0.1, 0.1);
  pad.material = padMat;
  pad.position = lz(0, 0.15, 0);
  pad.parent = root;
  pad.receiveShadows = true;
  meshes.push(pad);

  // Landing markings (4 crossing lines)
  const markingMat = new StandardMaterial('lz_markingMat', scene);
  markingMat.diffuseColor = new Color3(0.8, 0.8, 0);
  markingMat.emissiveColor = new Color3(0.15, 0.15, 0);

  for (let i = 0; i < 4; i++) {
    const marking = MeshBuilder.CreateBox(
      `lz_marking_${i}`,
      { width: 8, height: 0.05, depth: 0.5 },
      scene
    );
    marking.material = markingMat;
    marking.position = lz(0, 0.35, 0);
    marking.rotation.y = (i / 4) * Math.PI;
    marking.parent = root;
    meshes.push(marking);
  }

  // Outer ring marking
  const ring = MeshBuilder.CreateTorus(
    'lz_ring',
    { diameter: 28, thickness: 0.3, tessellation: 32 },
    scene
  );
  const ringMat = new StandardMaterial('lz_ringMat', scene);
  ringMat.diffuseColor = new Color3(0.6, 0.6, 0);
  ringMat.emissiveColor = new Color3(0.1, 0.1, 0);
  ring.material = ringMat;
  ring.position = lz(0, 0.35, 0);
  ring.rotation.x = Math.PI / 2;
  ring.parent = root;
  meshes.push(ring);

  // "H" landing mark (two vertical bars + one horizontal)
  const hBarMat = new StandardMaterial('lz_hBarMat', scene);
  hBarMat.diffuseColor = new Color3(1, 1, 1);
  hBarMat.emissiveColor = new Color3(0.2, 0.2, 0.2);

  const hLeft = MeshBuilder.CreateBox('lz_hLeft', { width: 0.4, height: 0.05, depth: 4 }, scene);
  hLeft.material = hBarMat;
  hLeft.position = lz(-1.5, 0.36, 0);
  hLeft.parent = root;
  meshes.push(hLeft);

  const hRight = MeshBuilder.CreateBox('lz_hRight', { width: 0.4, height: 0.05, depth: 4 }, scene);
  hRight.material = hBarMat;
  hRight.position = lz(1.5, 0.36, 0);
  hRight.parent = root;
  meshes.push(hRight);

  const hMid = MeshBuilder.CreateBox('lz_hMid', { width: 3.4, height: 0.05, depth: 0.4 }, scene);
  hMid.material = hBarMat;
  hMid.position = lz(0, 0.36, 0);
  hMid.parent = root;
  meshes.push(hMid);

  return meshes;
}

/** Stored skybox result for disposal */
let extractionSkyboxResult: SkyboxResult | null = null;

/**
 * Create the night sky using proper Babylon.js skybox with SkyboxManager.
 * Near-black sky for night extraction mission.
 */
function createNightSky(scene: Scene, root: TransformNode): Mesh {
  // Use SkyboxManager for proper Babylon.js skybox with night atmosphere
  const skyboxManager = new SkyboxManager(scene);
  extractionSkyboxResult = skyboxManager.createFallbackSkybox({
    type: 'night',
    size: 10000,
    useEnvironmentLighting: true,
    environmentIntensity: 0.3, // Dark night lighting
    // Near-black sky -- dark night, no stars, just oppressive darkness
    tint: new Color3(0.02, 0.02, 0.04),
  });

  extractionSkyboxResult.mesh.parent = root;
  return extractionSkyboxResult.mesh;
}

/**
 * Get the current extraction skybox result for disposal.
 */
export function getExtractionSkyboxResult(): SkyboxResult | null {
  return extractionSkyboxResult;
}

/**
 * Create breach holes where aliens emerge from underground during the holdout.
 * These are positioned outside the fence perimeter.
 * FIX #13: Added pulsing glow lights for breach holes
 */
function createBreachHoles(scene: Scene, root: TransformNode): Mesh[] {
  const meshes: Mesh[] = [];
  const holeMat = new StandardMaterial('lz_breachMat', scene);
  holeMat.diffuseColor = Color3.FromHexString('#1A0A1A');
  holeMat.emissiveColor = new Color3(0.12, 0.04, 0.1);

  // 4 breach holes placed outside the perimeter
  const holePositions = [
    lz(-50, -2, 15),
    lz(50, -2, 10),
    lz(-30, -2, 55),
    lz(30, -2, 55),
  ];

  for (let i = 0; i < holePositions.length; i++) {
    const hole = MeshBuilder.CreateCylinder(
      `lz_breach_${i}`,
      { height: 5, diameter: 8, tessellation: 8 },
      scene
    );
    hole.material = holeMat;
    hole.position = holePositions[i];
    hole.parent = root;
    meshes.push(hole);

    // FIX #13: Add warning glow around breach holes
    const glowLight = new PointLight(`lz_breach_glow_${i}`, holePositions[i].clone(), scene);
    glowLight.position.y = 1;
    glowLight.diffuse = Color3.FromHexString('#8B0040'); // Dark magenta
    glowLight.intensity = 0.8;
    glowLight.range = 12;
    glowLight.parent = root;
  }

  return meshes;
}

/**
 * Create distant canyon walls framing the LZ using GLB wall assets.
 * Sells the sense of an isolated valley on a hostile planet surface.
 */
async function createCanyonWalls(scene: Scene, root: TransformNode): Promise<TransformNode[]> {
  const nodes: TransformNode[] = [];

  // Wall definitions: position, scale, rotation
  const wallDefs = [
    { x: -100, z: -20, scaleX: 3, scaleY: 8, scaleZ: 25, rot: 0.1 },
    { x: 100, z: -20, scaleX: 3, scaleY: 8, scaleZ: 25, rot: -0.1 },
    { x: -80, z: -120, scaleX: 3, scaleY: 6, scaleZ: 19, rot: 0.2 },
    { x: 80, z: -120, scaleX: 3, scaleY: 6, scaleZ: 19, rot: -0.15 },
    { x: -60, z: 80, scaleX: 2.5, scaleY: 5, scaleZ: 22, rot: 0.05 },
    { x: 60, z: 80, scaleX: 2.5, scaleY: 5, scaleZ: 22, rot: -0.08 },
  ];

  const wallPaths = [STATION_WALLS.wall_hr_1, STATION_WALLS.wall_hr_15, STATION_WALLS.wall_rg_1];

  // Preload wall GLBs
  for (const path of wallPaths) {
    if (!AssetManager.isPathCached(path)) {
      await AssetManager.loadAssetByPath(path, scene);
    }
  }

  for (let i = 0; i < wallDefs.length; i++) {
    const def = wallDefs[i];
    const wallPath = wallPaths[i % wallPaths.length];

    const wallNode = AssetManager.createInstanceByPath(
      wallPath,
      `lz_canyon_${i}`,
      scene,
      true,
      'environment'
    );

    if (wallNode) {
      wallNode.position = lz(def.x, 0, def.z);
      wallNode.rotation = new Vector3(0, def.rot, 0);
      wallNode.scaling = new Vector3(def.scaleX, def.scaleY, def.scaleZ);
      wallNode.parent = root;
      nodes.push(wallNode);
    }
  }

  return nodes;
}

// ============================================================================
// UTILITY
// ============================================================================

function collectMeshes(node: TransformNode, out: Mesh[]): void {
  if ('geometry' in node && node.constructor.name !== 'TransformNode') {
    out.push(node as unknown as Mesh);
  }
  const children = node.getChildren();
  for (const child of children) {
    if (child instanceof TransformNode) {
      collectMeshes(child, out);
    }
  }
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build the complete LZ Omega extraction environment.
 *
 * 1. Collects all unique asset paths from placement data
 * 2. Loads them in parallel via AssetManager.loadAssetByPath
 * 3. Creates positioned instances for each placement
 * 4. Adds procedural elements (landing pad, sky dome, breach holes, canyon walls)
 * 5. Sets up night lighting
 *
 * @param scene - Active BabylonJS scene
 * @returns Promise resolving to ExtractionEnvironmentResult
 */
export async function buildExtractionEnvironment(
  scene: Scene
): Promise<ExtractionEnvironmentResult> {
  const root = new TransformNode('ExtractionEnvironment', scene);
  const allMeshes: Mesh[] = [];
  const coverMeshes: Mesh[] = [];

  // ------------------------------------------------------------------
  // 1. Gather all placements
  // ------------------------------------------------------------------
  const fencePlacements = getFencePerimeter();
  const bunkerPlacements = getSouthBunker();
  const flankPlacements = getFlankInfrastructure();
  const lampPlacements = getLampPosts();

  const allPlacements: Placement[] = [
    ...fencePlacements,
    ...bunkerPlacements,
    ...flankPlacements,
    ...lampPlacements,
  ];

  // ------------------------------------------------------------------
  // 2. Collect unique asset paths and load in parallel
  // ------------------------------------------------------------------
  const uniquePaths = new Set<string>();
  for (const p of allPlacements) {
    uniquePaths.add(p.path);
  }

  const loadPromises = [...uniquePaths].map(async (assetPath) => {
    try {
      if (!AssetManager.isPathCached(assetPath)) {
        await AssetManager.loadAssetByPath(assetPath, scene);
      }
    } catch (err) {
      console.warn(`[ExtractionEnv] Failed to load: ${assetPath}`, err);
    }
  });

  await Promise.all(loadPromises);

  console.log(
    `[ExtractionEnv] Loaded ${uniquePaths.size} unique assets, ` +
      `placing ${allPlacements.length} instances`
  );

  // ------------------------------------------------------------------
  // 3. Create instances for each placement
  // ------------------------------------------------------------------
  let placed = 0;
  let skipped = 0;

  // Track which placements produce cover objects (concrete blocks, crates,
  // bunker walls) so the level can use them for gameplay collision.
  const coverLabels = new Set([
    'east_block_1', 'east_block_2', 'west_block_1', 'west_block_2',
    'crate_e1', 'crate_e2', 'crate_w1', 'crate_w2', 'crate_ne', 'crate_nw',
    'crate_long_sw', 'crate_long_se',
  ]);

  for (let i = 0; i < allPlacements.length; i++) {
    const p = allPlacements[i];

    if (!AssetManager.isPathCached(p.path)) {
      skipped++;
      continue;
    }

    const instance = AssetManager.createInstanceByPath(
      p.path,
      `lz_${p.label}_${i}`,
      scene,
      true,
      'environment'
    );

    if (!instance) {
      skipped++;
      continue;
    }

    instance.position = p.position.clone();
    instance.rotation = new Vector3(0, p.rotationY, 0);
    instance.scaling = new Vector3(p.scale, p.scale, p.scale);
    instance.parent = root;

    collectMeshes(instance, allMeshes);

    if (coverLabels.has(p.label)) {
      collectMeshes(instance, coverMeshes);
    }

    placed++;
  }

  console.log(
    `[ExtractionEnv] Placed ${placed} GLB instances, skipped ${skipped}`
  );

  // ------------------------------------------------------------------
  // 4. Procedural elements
  // ------------------------------------------------------------------

  // Landing pad
  const padMeshes = createLandingPad(scene, root);
  allMeshes.push(...padMeshes);

  // Night sky dome
  const skyDome = createNightSky(scene, root);
  allMeshes.push(skyDome);

  // Breach holes
  const breachMeshes = createBreachHoles(scene, root);
  allMeshes.push(...breachMeshes);

  // Canyon walls (GLB-based)
  const canyonNodes = await createCanyonWalls(scene, root);
  // Collect meshes from canyon wall nodes for visibility toggling
  for (const node of canyonNodes) {
    collectMeshes(node, allMeshes);
  }

  // ------------------------------------------------------------------
  // 5. Night lighting
  // ------------------------------------------------------------------
  const lights = createNightLighting(scene, root);

  // ------------------------------------------------------------------
  // 6. Build result
  // ------------------------------------------------------------------
  return {
    root,
    meshes: allMeshes,
    lights,
    coverMeshes,
    dispose: () => {
      lights.forEach((l) => l.dispose());
      allMeshes.forEach((m) => m.dispose());
      root.dispose();
      // FIX #7: Properly dispose skybox result
      const skyboxResult = getExtractionSkyboxResult();
      if (skyboxResult) {
        skyboxResult.dispose();
      }
    },
  };
}
