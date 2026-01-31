/**
 * LandfallEnvironment - Hand-crafted GLB environment for Level 2: Landfall
 *
 * Replaces procedural MeshBuilder primitives with actual GLB model placements.
 * Creates a Halo CE "arriving on an alien world" atmosphere:
 *
 * - Crashed human infrastructure scattered across a rocky alien landscape
 * - A fortified landing zone with asphalt pads, barricades, and barrels
 * - Industrial wreckage (water tower, shipping containers, warehouse frame)
 * - Orbital station debris visible in the sky as a burning hulk
 * - Sci-fi crash debris (pods, pipes, plating) strewn across the terrain
 * - Defensive perimeter of barricades and fences around the combat arena
 *
 * The procedural SurfaceTerrainFactory heightmap remains as the base ground
 * mesh. All GLB assets are placed ON TOP of that terrain at specific,
 * hand-authored coordinates.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single hand-placed GLB instance */
interface PlacedAsset {
  /** Path to the GLB file (under /models/) */
  path: string;
  /** Unique name for this instance */
  name: string;
  /** World position */
  position: Vector3;
  /** Euler rotation in radians */
  rotation: Vector3;
  /** Non-uniform scale */
  scaling: Vector3;
}

/** Everything the environment builder returns for lifecycle management */
export interface LandfallEnvironmentNodes {
  /** Root transform node -- dispose this to clean up everything */
  root: TransformNode;
  /** Orbital station wreck in the sky (separately managed for animation) */
  orbitalStation: TransformNode | null;
  /** All placed TransformNodes for visibility toggling */
  allNodes: TransformNode[];
}

// ---------------------------------------------------------------------------
// Asset paths (match the LANDFALL_ASSETS manifest)
// ---------------------------------------------------------------------------

const P = {
  // Industrial
  container:         '/models/environment/industrial/shipping_container_mx_1.glb',
  containerHollow:   '/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
  container2:        '/models/environment/industrial/shipping_container_mx_2.glb',
  waterTower:        '/models/environment/industrial/water_tower_hm_1.glb',
  storageTank:       '/models/environment/industrial/storage_tank_mx_1.glb',
  platform:          '/models/environment/industrial/platform_mx_1.glb',
  chimney1:          '/models/environment/industrial/chimney_a_1.glb',
  chimney2:          '/models/environment/industrial/chimney_a_2.glb',
  pipes:             '/models/environment/industrial/pipes_hr_1.glb',
  pipesElbow:        '/models/environment/industrial/pipes_hr_1_elbow_1.glb',
  warehouse:         '/models/environment/industrial/warehouse_hl_1.glb',
  electrical:        '/models/environment/industrial/electrical_equipment_1.glb',
  machinery:         '/models/environment/industrial/machinery_mx_1.glb',
  cage:              '/models/environment/industrial/cage_mx_1.glb',
  boiler:            '/models/environment/industrial/boiler_hx_4.glb',

  // Station surfaces
  asphalt1:          '/models/environment/station/asphalt_hr_1.glb',
  asphalt1Large:     '/models/environment/station/asphalt_hr_1_large.glb',
  asphalt2:          '/models/environment/station/asphalt_hr_2.glb',
  asphalt3:          '/models/environment/station/asphalt_hr_3.glb',
  platformLarge:     '/models/environment/station/platform_large_mx_1.glb',
  platformSmall:     '/models/environment/station/platform_small_mx_1.glb',
  beamH1:            '/models/environment/station/beam_hc_horizontal_1.glb',
  beamH2:            '/models/environment/station/beam_hc_horizontal_2.glb',
  beamV1:            '/models/environment/station/beam_hc_vertical_1.glb',
  beamRtx:           '/models/environment/station/beam_rtx_1.glb',
  concretePipeEnd:   '/models/environment/station/concrete_pipe_hm_1_end.glb',
  concretePipeMid:   '/models/environment/station/concrete_pipe_hm_1_middle.glb',
  doorway1:          '/models/environment/station/doorway_hr_1.glb',
  warehouse1:        '/models/environment/station/warehouse_mx_1.glb',
  warehouse2:        '/models/environment/station/warehouse_mx_2.glb',

  // Station external (orbital)
  stationExt02:      '/models/environment/station-external/station02.glb',
  stationExt04:      '/models/environment/station-external/station04.glb',

  // Barricades & fences
  barricadeA1:       '/models/props/modular/barricade_a_1.glb',
  barricadeA2:       '/models/props/modular/barricade_a_2.glb',
  barricadeA3:       '/models/props/modular/barricade_a_3.glb',
  barricadeB1:       '/models/props/modular/barricade_b_1.glb',
  barricadeB2:       '/models/props/modular/barricade_b_2.glb',
  fenceA1:           '/models/props/modular/fence_a_1.glb',
  concreteFence:     '/models/props/modular/concrete_fence_hr_1.glb',
  concretePillar:    '/models/props/modular/concrete_fence_hr_1_pillar_1.glb',

  // Props
  gasCylinder:       '/models/props/containers/gas_cylinder_mx_1.glb',
  jerrycan:          '/models/props/containers/jerrycan_mx_1.glb',
  cementPallet:      '/models/props/containers/cement_bags_mp_1_pallet_1.glb',
  barrel1:           '/models/props/containers/metal_barrel_hr_1.glb',
  barrel2:           '/models/props/containers/metal_barrel_hr_2.glb',
  barrel3:           '/models/props/containers/metal_barrel_hr_3.glb',
  woodenCrate1:      '/models/props/containers/wooden_crate_1.glb',
  woodenCrate2:      '/models/props/containers/wooden_crate_2_a.glb',
  scrapMetal1:       '/models/props/containers/scrap_metal_mx_1.glb',
  scrapMetal2:       '/models/props/containers/scrap_metal_mx_1_1.glb',
  tire1:             '/models/props/containers/tire_1.glb',
  plank1:            '/models/props/containers/wooden_plank_1.glb',
  plank2:            '/models/props/containers/wooden_plank_2.glb',
  toolbox:           '/models/props/containers/toolbox_mx_1.glb',

  // Modular sci-fi
  column1:           '/models/environment/modular/Column_1.glb',
  column2:           '/models/environment/modular/Column_2.glb',
  propsCrate:        '/models/environment/modular/Props_Crate.glb',
  propsCrateLong:    '/models/environment/modular/Props_CrateLong.glb',
  propsContainer:    '/models/environment/modular/Props_ContainerFull.glb',
  propsPod:          '/models/environment/modular/Props_Pod.glb',
  modPipes:          '/models/environment/modular/Pipes.glb',
  detailPipesLong:   '/models/environment/modular/Details_Pipes_Long.glb',
  detailPlateLarge:  '/models/environment/modular/Details_Plate_Large.glb',
} as const;

// ---------------------------------------------------------------------------
// Hand-crafted placement data
// ---------------------------------------------------------------------------

/**
 * LANDING ZONE (LZ) - The player's target landing pad area.
 * Centered at origin (0, 0, 0). Features asphalt pads, platforms, and
 * a perimeter of barricades. This is where the player touches down
 * after the HALO drop sequence.
 */
const LZ_PLACEMENTS: PlacedAsset[] = [
  // --- Central landing pad: large asphalt surface ---
  {
    path: P.asphalt1Large,
    name: 'lz_asphalt_center',
    position: new Vector3(0, 0.05, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(2.5, 1, 2.5),
  },
  // Surrounding asphalt pads (tiled outward from center)
  {
    path: P.asphalt1,
    name: 'lz_asphalt_north',
    position: new Vector3(0, 0.04, -10),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(2, 1, 2),
  },
  {
    path: P.asphalt2,
    name: 'lz_asphalt_east',
    position: new Vector3(10, 0.04, 0),
    rotation: new Vector3(0, Math.PI / 2, 0),
    scaling: new Vector3(2, 1, 2),
  },
  {
    path: P.asphalt3,
    name: 'lz_asphalt_south',
    position: new Vector3(0, 0.04, 10),
    rotation: new Vector3(0, Math.PI, 0),
    scaling: new Vector3(2, 1, 2),
  },
  {
    path: P.asphalt1,
    name: 'lz_asphalt_west',
    position: new Vector3(-10, 0.04, 0),
    rotation: new Vector3(0, -Math.PI / 2, 0),
    scaling: new Vector3(2, 1, 2),
  },

  // --- Raised platform at LZ edge (command post location) ---
  {
    path: P.platformLarge,
    name: 'lz_platform_command',
    position: new Vector3(-14, 0.1, -8),
    rotation: new Vector3(0, 0.2, 0),
    scaling: new Vector3(1.5, 1, 1.5),
  },
  {
    path: P.platformSmall,
    name: 'lz_platform_supply',
    position: new Vector3(12, 0.1, -6),
    rotation: new Vector3(0, -0.3, 0),
    scaling: new Vector3(1.2, 1, 1.2),
  },
];

/**
 * DEFENSIVE PERIMETER - Barricades and fences forming a ring around
 * the combat arena. Players use these for cover against alien assault.
 * Positioned in a roughly semicircular arc facing the approach direction.
 */
const BARRICADE_PLACEMENTS: PlacedAsset[] = [
  // --- Forward arc (north, facing enemy approach from +Z) ---
  {
    path: P.barricadeA1,
    name: 'barricade_fwd_1',
    position: new Vector3(-8, 0.1, 18),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barricadeA2,
    name: 'barricade_fwd_2',
    position: new Vector3(0, 0.1, 20),
    rotation: new Vector3(0, 0.15, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barricadeA3,
    name: 'barricade_fwd_3',
    position: new Vector3(8, 0.1, 18),
    rotation: new Vector3(0, -0.1, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barricadeB1,
    name: 'barricade_fwd_4',
    position: new Vector3(16, 0.1, 14),
    rotation: new Vector3(0, -0.4, 0),
    scaling: new Vector3(1.4, 1.4, 1.4),
  },
  {
    path: P.barricadeB2,
    name: 'barricade_fwd_5',
    position: new Vector3(-16, 0.1, 14),
    rotation: new Vector3(0, 0.4, 0),
    scaling: new Vector3(1.4, 1.4, 1.4),
  },

  // --- Flank barricades ---
  {
    path: P.barricadeA1,
    name: 'barricade_flank_left',
    position: new Vector3(-22, 0.1, 6),
    rotation: new Vector3(0, Math.PI / 4, 0),
    scaling: new Vector3(1.3, 1.3, 1.3),
  },
  {
    path: P.barricadeA2,
    name: 'barricade_flank_right',
    position: new Vector3(22, 0.1, 6),
    rotation: new Vector3(0, -Math.PI / 4, 0),
    scaling: new Vector3(1.3, 1.3, 1.3),
  },

  // --- Concrete fence segments along rear ---
  {
    path: P.concreteFence,
    name: 'fence_rear_1',
    position: new Vector3(-10, 0.1, -14),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.concreteFence,
    name: 'fence_rear_2',
    position: new Vector3(0, 0.1, -14),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.concreteFence,
    name: 'fence_rear_3',
    position: new Vector3(10, 0.1, -14),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.concretePillar,
    name: 'fence_pillar_rear_L',
    position: new Vector3(-15, 0.1, -14),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.concretePillar,
    name: 'fence_pillar_rear_R',
    position: new Vector3(15, 0.1, -14),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },

  // Wire fences on flanks
  {
    path: P.fenceA1,
    name: 'fence_wire_left',
    position: new Vector3(-25, 0.1, 0),
    rotation: new Vector3(0, Math.PI / 2, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.fenceA1,
    name: 'fence_wire_right',
    position: new Vector3(25, 0.1, 0),
    rotation: new Vector3(0, -Math.PI / 2, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
];

/**
 * CRASHED INFRASTRUCTURE - Wrecked human structures scattered across
 * the landscape, telling the story of a failed first-wave landing.
 * These are the dramatic set-pieces that create the Halo CE atmosphere.
 */
const WRECKAGE_PLACEMENTS: PlacedAsset[] = [
  // --- Toppled water tower (major landmark, NE of LZ) ---
  {
    path: P.waterTower,
    name: 'wreck_water_tower',
    position: new Vector3(40, 2, 35),
    rotation: new Vector3(0.8, 0.3, 0.2), // tilted on its side
    scaling: new Vector3(2.5, 2.5, 2.5),
  },

  // --- Crashed shipping containers (scattered wreckage field, NW) ---
  {
    path: P.container,
    name: 'wreck_container_1',
    position: new Vector3(-35, 1.5, 25),
    rotation: new Vector3(0.15, 0.6, 0.3), // tumbled
    scaling: new Vector3(1.8, 1.8, 1.8),
  },
  {
    path: P.containerHollow,
    name: 'wreck_container_hollow',
    position: new Vector3(-28, 0.3, 30),
    rotation: new Vector3(0, -0.8, 0.1),
    scaling: new Vector3(1.8, 1.8, 1.8),
  },
  {
    path: P.container2,
    name: 'wreck_container_2',
    position: new Vector3(-40, 3, 20),
    rotation: new Vector3(0.4, 1.2, -0.2), // stacked at angle on container_1
    scaling: new Vector3(1.6, 1.6, 1.6),
  },

  // --- Damaged warehouse frame (east side, partially collapsed) ---
  {
    path: P.warehouse,
    name: 'wreck_warehouse_frame',
    position: new Vector3(50, 0.5, 10),
    rotation: new Vector3(0.1, -0.4, 0.15),
    scaling: new Vector3(3, 2.5, 3),
  },

  // --- Fallen chimney stacks (south) ---
  {
    path: P.chimney1,
    name: 'wreck_chimney_1',
    position: new Vector3(20, 0.8, -30),
    rotation: new Vector3(Math.PI / 2 - 0.2, 0.5, 0), // fallen over
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.chimney2,
    name: 'wreck_chimney_2',
    position: new Vector3(-25, 1, -35),
    rotation: new Vector3(Math.PI / 2, -0.3, 0.1),
    scaling: new Vector3(1.8, 1.8, 1.8),
  },

  // --- Storage tank (ruptured, leaking) ---
  {
    path: P.storageTank,
    name: 'wreck_storage_tank',
    position: new Vector3(-50, 1, -15),
    rotation: new Vector3(0.3, 0.8, 0),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },

  // --- Industrial platform (broken, half-buried) ---
  {
    path: P.platform,
    name: 'wreck_platform',
    position: new Vector3(30, -0.5, -20),
    rotation: new Vector3(0.1, 1.6, 0.05),
    scaling: new Vector3(2, 2, 2),
  },

  // --- Warehouse station buildings (partially standing ruins) ---
  {
    path: P.warehouse1,
    name: 'wreck_station_warehouse_1',
    position: new Vector3(-55, 0.2, 45),
    rotation: new Vector3(0, 0.7, 0.08),
    scaling: new Vector3(2, 1.8, 2),
  },
  {
    path: P.warehouse2,
    name: 'wreck_station_warehouse_2',
    position: new Vector3(55, 0.3, -40),
    rotation: new Vector3(0.05, -1.2, 0),
    scaling: new Vector3(2, 1.8, 2),
  },

  // --- Boiler unit (exploded, near container field) ---
  {
    path: P.boiler,
    name: 'wreck_boiler',
    position: new Vector3(-45, 0.5, 10),
    rotation: new Vector3(0.2, 0.4, 0.3),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },

  // --- Machinery (overturned, near warehouse) ---
  {
    path: P.machinery,
    name: 'wreck_machinery',
    position: new Vector3(45, 0.3, 20),
    rotation: new Vector3(0.5, -0.7, 0.2),
    scaling: new Vector3(2, 2, 2),
  },
];

/**
 * SCATTERED BEAMS & STRUCTURAL DEBRIS - Broken girders and pipes
 * strewn across the landscape from the orbital bombardment that
 * preceded the player's drop. Creates visual complexity and cover.
 */
const STRUCTURAL_DEBRIS: PlacedAsset[] = [
  // Fallen I-beams
  {
    path: P.beamH1,
    name: 'beam_debris_1',
    position: new Vector3(12, 0.4, 28),
    rotation: new Vector3(0, 0.8, Math.PI / 2 - 0.3),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.beamH2,
    name: 'beam_debris_2',
    position: new Vector3(-18, 0.6, 32),
    rotation: new Vector3(0.1, -1.1, Math.PI / 2),
    scaling: new Vector3(1.8, 1.8, 1.8),
  },
  {
    path: P.beamV1,
    name: 'beam_debris_3',
    position: new Vector3(5, 0.3, -25),
    rotation: new Vector3(Math.PI / 2, 0.4, 0),
    scaling: new Vector3(2.2, 2.2, 2.2),
  },
  {
    path: P.beamRtx,
    name: 'beam_debris_4',
    position: new Vector3(-10, 0.5, -20),
    rotation: new Vector3(0.3, 2.1, Math.PI / 2 + 0.2),
    scaling: new Vector3(2, 2, 2),
  },

  // Concrete pipes (broken conduits)
  {
    path: P.concretePipeEnd,
    name: 'pipe_debris_1',
    position: new Vector3(25, 0.2, 15),
    rotation: new Vector3(0, 0.5, 0.1),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.concretePipeMid,
    name: 'pipe_debris_2',
    position: new Vector3(-30, 0.3, -5),
    rotation: new Vector3(0, -0.7, 0.05),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.concretePipeEnd,
    name: 'pipe_debris_3',
    position: new Vector3(35, 0.4, -15),
    rotation: new Vector3(0.2, 1.8, 0),
    scaling: new Vector3(2, 2, 2),
  },

  // Industrial pipes (tangled wreckage)
  {
    path: P.pipes,
    name: 'indust_pipes_1',
    position: new Vector3(-15, 0.3, 40),
    rotation: new Vector3(0, 0.9, 0.3),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.pipesElbow,
    name: 'indust_pipes_elbow_1',
    position: new Vector3(18, 0.2, 38),
    rotation: new Vector3(0.4, -0.6, 0),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },

  // Doorway frame (ripped from building, laying flat)
  {
    path: P.doorway1,
    name: 'doorway_debris',
    position: new Vector3(-20, 0.2, -28),
    rotation: new Vector3(Math.PI / 2, 0.3, 0),
    scaling: new Vector3(1.8, 1.8, 1.8),
  },
];

/**
 * SCI-FI CRASH DEBRIS - Modular kit pieces representing fragments of
 * the station or drop pods that crashed before the player arrived.
 * These are the "alien tech meets human wreckage" pieces.
 */
const SCIFI_DEBRIS: PlacedAsset[] = [
  // Crashed escape pods
  {
    path: P.propsPod,
    name: 'crash_pod_1',
    position: new Vector3(0, 0.5, 25),
    rotation: new Vector3(0.4, 0.3, 0.2),
    scaling: new Vector3(3, 3, 3),
  },
  {
    path: P.propsPod,
    name: 'crash_pod_2',
    position: new Vector3(-30, 0.8, -25),
    rotation: new Vector3(0.6, -1.5, 0.3),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },

  // Sci-fi cargo containers (supply drops that scattered)
  {
    path: P.propsContainer,
    name: 'scifi_container_1',
    position: new Vector3(15, 0.3, 30),
    rotation: new Vector3(0.1, 0.7, 0),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.propsCrate,
    name: 'scifi_crate_1',
    position: new Vector3(-12, 0.2, 22),
    rotation: new Vector3(0, 1.2, 0.05),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.propsCrateLong,
    name: 'scifi_crate_long_1',
    position: new Vector3(20, 0.2, -10),
    rotation: new Vector3(0, -0.5, 0.1),
    scaling: new Vector3(2, 2, 2),
  },

  // Structural columns (snapped off at base)
  {
    path: P.column1,
    name: 'column_debris_1',
    position: new Vector3(-40, 0.3, 0),
    rotation: new Vector3(Math.PI / 2, 0.2, 0),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.column2,
    name: 'column_debris_2',
    position: new Vector3(40, 0.4, -30),
    rotation: new Vector3(Math.PI / 2 - 0.3, -0.8, 0),
    scaling: new Vector3(2, 2, 2),
  },

  // Pipes ripped from station hull
  {
    path: P.modPipes,
    name: 'mod_pipes_1',
    position: new Vector3(-5, 0.2, 35),
    rotation: new Vector3(0.1, 0.4, 0),
    scaling: new Vector3(3, 3, 3),
  },
  {
    path: P.detailPipesLong,
    name: 'detail_pipes_1',
    position: new Vector3(30, 0.1, 5),
    rotation: new Vector3(0, -1.5, 0.1),
    scaling: new Vector3(3, 3, 3),
  },

  // Hull plating fragments
  {
    path: P.detailPlateLarge,
    name: 'hull_plate_1',
    position: new Vector3(-8, 0.05, 15),
    rotation: new Vector3(0, 0.6, 0),
    scaling: new Vector3(4, 4, 4),
  },
  {
    path: P.detailPlateLarge,
    name: 'hull_plate_2',
    position: new Vector3(25, 0.08, -22),
    rotation: new Vector3(0.05, -1.1, 0.03),
    scaling: new Vector3(3.5, 3.5, 3.5),
  },
  {
    path: P.detailPlateLarge,
    name: 'hull_plate_3',
    position: new Vector3(-35, 0.06, -10),
    rotation: new Vector3(0, 2.2, 0.02),
    scaling: new Vector3(3, 3, 3),
  },
];

/**
 * PROP SCATTER - Small objects that add lived-in detail: barrels,
 * crates, gas cylinders, scrap metal, tools. These are scattered
 * around the LZ and wreckage sites to tell the story of a supply
 * operation that was violently interrupted.
 */
const PROP_SCATTER: PlacedAsset[] = [
  // --- Around the LZ command platform ---
  {
    path: P.barrel1,
    name: 'barrel_lz_1',
    position: new Vector3(-12, 0.1, -6),
    rotation: new Vector3(0, 0.3, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barrel2,
    name: 'barrel_lz_2',
    position: new Vector3(-13.5, 0.1, -5),
    rotation: new Vector3(0, 1.1, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barrel3,
    name: 'barrel_lz_3',
    position: new Vector3(-11, 0.1, -7.5),
    rotation: new Vector3(0, -0.5, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.gasCylinder,
    name: 'gas_cyl_lz_1',
    position: new Vector3(-15, 0.1, -4),
    rotation: new Vector3(0, 0.8, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.woodenCrate1,
    name: 'crate_lz_1',
    position: new Vector3(-16, 0.1, -7),
    rotation: new Vector3(0, 0.2, 0),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.woodenCrate2,
    name: 'crate_lz_2',
    position: new Vector3(-16, 1.2, -7),
    rotation: new Vector3(0, 0.9, 0),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.cementPallet,
    name: 'cement_lz_1',
    position: new Vector3(13, 0.1, -4),
    rotation: new Vector3(0, -0.3, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },

  // --- Supply dump near east platform ---
  {
    path: P.jerrycan,
    name: 'jerrycan_supply_1',
    position: new Vector3(14, 0.1, -3),
    rotation: new Vector3(0, 0.5, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.jerrycan,
    name: 'jerrycan_supply_2',
    position: new Vector3(14.5, 0.1, -2),
    rotation: new Vector3(0, -0.8, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.toolbox,
    name: 'toolbox_supply_1',
    position: new Vector3(11, 0.1, -5),
    rotation: new Vector3(0, 0.1, 0),
    scaling: new Vector3(2, 2, 2),
  },

  // --- Scattered near wreckage sites ---
  {
    path: P.scrapMetal1,
    name: 'scrap_wreck_1',
    position: new Vector3(-32, 0.1, 22),
    rotation: new Vector3(0, 1.5, 0.2),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.scrapMetal2,
    name: 'scrap_wreck_2',
    position: new Vector3(-37, 0.1, 28),
    rotation: new Vector3(0.1, -0.7, 0),
    scaling: new Vector3(2.5, 2.5, 2.5),
  },
  {
    path: P.scrapMetal1,
    name: 'scrap_wreck_3',
    position: new Vector3(42, 0.1, 15),
    rotation: new Vector3(0, 2.3, 0.1),
    scaling: new Vector3(1.8, 1.8, 1.8),
  },
  {
    path: P.tire1,
    name: 'tire_wreck_1',
    position: new Vector3(38, 0.3, 30),
    rotation: new Vector3(0.3, 0.5, Math.PI / 2),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.tire1,
    name: 'tire_wreck_2',
    position: new Vector3(-42, 0.2, 15),
    rotation: new Vector3(0.1, -1.2, 0),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.plank1,
    name: 'plank_wreck_1',
    position: new Vector3(5, 0.08, 28),
    rotation: new Vector3(0, 0.6, 0.05),
    scaling: new Vector3(2, 2, 2),
  },
  {
    path: P.plank2,
    name: 'plank_wreck_2',
    position: new Vector3(-3, 0.08, 30),
    rotation: new Vector3(0, -1.0, 0.03),
    scaling: new Vector3(2, 2, 2),
  },

  // --- Electrical equipment near storage tank ---
  {
    path: P.electrical,
    name: 'electrical_wreck_1',
    position: new Vector3(-48, 0.2, -12),
    rotation: new Vector3(0, 0.5, 0.1),
    scaling: new Vector3(2, 2, 2),
  },

  // --- Cage near industrial area ---
  {
    path: P.cage,
    name: 'cage_wreck_1',
    position: new Vector3(48, 0.2, 8),
    rotation: new Vector3(0.2, -0.3, 0.15),
    scaling: new Vector3(2, 2, 2),
  },

  // --- Barrel cluster near fallen chimney ---
  {
    path: P.barrel1,
    name: 'barrel_chimney_1',
    position: new Vector3(22, 0.1, -28),
    rotation: new Vector3(0, 0.7, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.barrel2,
    name: 'barrel_chimney_2',
    position: new Vector3(24, 0.1, -27),
    rotation: new Vector3(0.1, -0.4, 0.6), // knocked over
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
  {
    path: P.gasCylinder,
    name: 'gas_cyl_chimney',
    position: new Vector3(18, 0.1, -32),
    rotation: new Vector3(0, 1.2, 0),
    scaling: new Vector3(1.5, 1.5, 1.5),
  },
];

/**
 * ORBITAL STATION WRECK - A large orbital station model placed high
 * in the sky, tilted at an angle with emissive glow to suggest it is
 * burning/damaged. Visible from the surface as environmental
 * storytelling -- "that's where we came from".
 */
const ORBITAL_STATION: PlacedAsset = {
  path: P.stationExt02,
  name: 'orbital_station_wreck',
  position: new Vector3(-200, 350, -400),
  rotation: new Vector3(0.3, 0.5, 0.15),
  scaling: new Vector3(60, 60, 60),
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Collect every unique GLB path from the placement data so we can
 * batch-load them before instancing.
 */
function collectUniquePaths(groups: PlacedAsset[][]): string[] {
  const set = new Set<string>();
  for (const group of groups) {
    for (const asset of group) {
      set.add(asset.path);
    }
  }
  return [...set];
}

/**
 * Load all GLB assets required by the environment, then instance each
 * one at its authored position/rotation/scale.
 *
 * Returns a handle that the level can use to toggle visibility and
 * dispose the entire environment on cleanup.
 */
export async function buildLandfallEnvironment(
  scene: Scene
): Promise<LandfallEnvironmentNodes> {
  const root = new TransformNode('landfallEnvRoot', scene);
  const allNodes: TransformNode[] = [];
  let orbitalStation: TransformNode | null = null;

  // Aggregate all placement groups
  const allGroups: PlacedAsset[][] = [
    LZ_PLACEMENTS,
    BARRICADE_PLACEMENTS,
    WRECKAGE_PLACEMENTS,
    STRUCTURAL_DEBRIS,
    SCIFI_DEBRIS,
    PROP_SCATTER,
  ];

  // Add orbital station as a single-entry group
  allGroups.push([ORBITAL_STATION]);

  // --- Phase 1: Batch-load every unique GLB --------------------------------
  const uniquePaths = collectUniquePaths(allGroups);

  console.log(
    `[LandfallEnv] Loading ${uniquePaths.length} unique GLB models...`
  );

  const loadResults = await Promise.allSettled(
    uniquePaths.map((p) => AssetManager.loadAssetByPath(p, scene))
  );

  let loadedCount = 0;
  let failedCount = 0;
  for (let i = 0; i < loadResults.length; i++) {
    const r = loadResults[i];
    if (r.status === 'fulfilled' && r.value) {
      loadedCount++;
    } else {
      failedCount++;
      console.warn(
        `[LandfallEnv] Failed to load: ${uniquePaths[i]}`,
        r.status === 'rejected' ? r.reason : 'null result'
      );
    }
  }

  console.log(
    `[LandfallEnv] Loaded ${loadedCount}/${uniquePaths.length} GLBs (${failedCount} failed)`
  );

  // --- Phase 2: Instance each placement ------------------------------------
  for (const group of allGroups) {
    for (const def of group) {
      const node = AssetManager.createInstanceByPath(
        def.path,
        def.name,
        scene,
        true,
        'environment'
      );

      if (!node) {
        // Asset failed to load -- skip silently (already warned above)
        continue;
      }

      node.position = def.position.clone();
      node.rotation = def.rotation.clone();
      node.scaling = def.scaling.clone();
      node.parent = root;

      // Start hidden -- the level will reveal them on surface phase
      node.setEnabled(false);

      // Enable distance-based culling for performance
      const distFromOrigin = def.position.length();
      if (distFromOrigin > 100) {
        // Far objects get more aggressive culling
        node.getChildMeshes().forEach((mesh) => {
          mesh.cullingStrategy = 2; // BOUNDINGSPHERE_ONLY
        });
      }

      allNodes.push(node);

      // Track orbital station separately for sky animation
      if (def.name === 'orbital_station_wreck') {
        orbitalStation = node;
      }
    }
  }

  console.log(
    `[LandfallEnv] Placed ${allNodes.length} environment instances`
  );

  // --- Phase 3: Add atmospheric point lights to wreckage -------------------
  addWreckageLights(scene, root);

  return { root, orbitalStation, allNodes };
}

/**
 * Adds small emissive point lights at key wreckage sites to suggest
 * fires, sparking electronics, and alien bio-luminescence.
 */
function addWreckageLights(scene: Scene, parent: TransformNode): void {
  const fireLights: Array<{
    position: Vector3;
    color: Color3;
    intensity: number;
    range: number;
  }> = [
    // Fire glow at toppled water tower
    {
      position: new Vector3(40, 4, 35),
      color: new Color3(1, 0.5, 0.1),
      intensity: 0.6,
      range: 20,
    },
    // Sparking containers
    {
      position: new Vector3(-35, 3, 25),
      color: new Color3(0.8, 0.6, 0.2),
      intensity: 0.4,
      range: 15,
    },
    // Electrical spark at storage tank
    {
      position: new Vector3(-50, 3, -15),
      color: new Color3(0.3, 0.5, 1),
      intensity: 0.5,
      range: 12,
    },
    // Crashed pod glow
    {
      position: new Vector3(0, 2, 25),
      color: new Color3(0.2, 0.8, 0.4),
      intensity: 0.3,
      range: 10,
    },
    // Alien bioluminescence near acid pools
    {
      position: new Vector3(25, 1, 18),
      color: new Color3(0.1, 0.8, 0.2),
      intensity: 0.3,
      range: 8,
    },
    {
      position: new Vector3(-22, 1, 28),
      color: new Color3(0.1, 0.7, 0.3),
      intensity: 0.25,
      range: 8,
    },
    // Distant warehouse fire glow
    {
      position: new Vector3(-55, 4, 45),
      color: new Color3(1, 0.4, 0.05),
      intensity: 0.4,
      range: 18,
    },
    // LZ operational light (cooler, functional)
    {
      position: new Vector3(0, 5, 0),
      color: new Color3(0.9, 0.95, 1),
      intensity: 0.5,
      range: 25,
    },
  ];

  for (let i = 0; i < fireLights.length; i++) {
    const def = fireLights[i];
    const light = new PointLight(
      `wreckLight_${i}`,
      def.position,
      scene
    );
    light.diffuse = def.color;
    light.specular = def.color.scale(0.3);
    light.intensity = def.intensity;
    light.range = def.range;
    light.parent = parent;
  }
}

/**
 * Toggle visibility of all environment nodes at once.
 * Called by the level when transitioning to surface phase.
 */
export function setEnvironmentVisible(
  env: LandfallEnvironmentNodes,
  visible: boolean
): void {
  for (const node of env.allNodes) {
    node.setEnabled(visible);
  }
}

/**
 * Dispose the entire environment (called on level cleanup).
 */
export function disposeEnvironment(env: LandfallEnvironmentNodes): void {
  // Disposing the root cascades to all children
  env.root.dispose();
  env.allNodes.length = 0;
  env.orbitalStation = null;
}

/**
 * Update environment LOD based on camera position.
 * Called each frame to optimize rendering of distant objects.
 */
export function updateEnvironmentLOD(
  env: LandfallEnvironmentNodes,
  cameraPosition: Vector3,
  lodFadeStart: number = 150,
  lodCullDistance: number = 250
): void {
  for (const node of env.allNodes) {
    if (!node.isEnabled()) continue;

    const distance = Vector3.Distance(node.position, cameraPosition);

    // Cull very distant objects
    if (distance > lodCullDistance) {
      node.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false;
      });
    } else if (distance > lodFadeStart) {
      // Fade out distant objects
      const fadeRatio = 1 - (distance - lodFadeStart) / (lodCullDistance - lodFadeStart);
      node.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true;
        if (mesh.material && 'alpha' in mesh.material) {
          // Don't fade materials that need to stay opaque
          // Just toggle visibility
        }
      });
    } else {
      // Nearby objects are fully visible
      node.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true;
      });
    }
  }
}

/**
 * Animate the orbital station wreck in the sky.
 * Creates a slow tumbling effect as it burns in orbit.
 */
export function updateOrbitalStation(
  env: LandfallEnvironmentNodes,
  deltaTime: number
): void {
  if (!env.orbitalStation || !env.orbitalStation.isEnabled()) return;

  // Slow tumble rotation
  env.orbitalStation.rotation.x += deltaTime * 0.05;
  env.orbitalStation.rotation.z += deltaTime * 0.03;

  // Subtle position wobble to simulate orbital decay
  const time = performance.now() * 0.0001;
  env.orbitalStation.position.y += Math.sin(time) * 0.01;
}
