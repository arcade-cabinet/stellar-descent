/**
 * FOB Delta - Abandoned Forward Operating Base
 *
 * ATMOSPHERE: Dark, damaged military installation with horror undertones.
 * Power failures, flickering lights, signs of fierce battle.
 * Something terrible happened here - investigation/horror level.
 *
 * UNIQUE FEATURES:
 * - Extensively damaged station architecture (broken pillars, holes in walls)
 * - Dangling wires and exposed infrastructure
 * - Debris fields and battle damage
 * - Atmospheric hallway pieces for tension
 * - Flickering emergency lighting
 */

import { AssetEntry, LevelManifest } from '../types';

export const FOB_DELTA_ASSETS: AssetEntry[] = [
  // ENVIRONMENT MODELS - Damaged Station Architecture
  {
    id: 'station/pillar_broken',
    path: '/assets/models/environment/station/pillar_hr_1_broken.glb',
    category: 'model',
    sizeKB: 478,

  },
  {
    id: 'station/wall_hole_2',
    path: '/assets/models/environment/station/wall_hr_1_hole_2.glb',
    category: 'model',
    sizeKB: 1559,

  },
  {
    id: 'station/wall_15',
    path: '/assets/models/environment/station/wall_hr_15.glb',
    category: 'model',
    sizeKB: 858,

  },
  {
    id: 'station/floor_ceiling_2_hole',
    path: '/assets/models/environment/station/floor_ceiling_hr_2_hole.glb',
    category: 'model',
    sizeKB: 593,

  },
  {
    id: 'station/floor_ceiling_4',
    path: '/assets/models/environment/station/floor_ceiling_hr_4.glb',
    category: 'model',
    sizeKB: 1581,

  },
  {
    id: 'station/floor_ceiling_5',
    path: '/assets/models/environment/station/floor_ceiling_hr_5.glb',
    category: 'model',
    sizeKB: 561,

  },
  {
    id: 'station/floor_ceiling_6',
    path: '/assets/models/environment/station/floor_ceiling_hr_6.glb',
    category: 'model',
    sizeKB: 931,

  },
  {
    id: 'station/beam_rtx_2_pipes',
    path: '/assets/models/environment/station/beam_rtx_2_pipes.glb',
    category: 'model',
    sizeKB: 1400,

  },
  {
    id: 'station/doorway_2_wide',
    path: '/assets/models/environment/station/doorway_hr_2_wide.glb',
    category: 'model',
    sizeKB: 1532,

  },

  // INDUSTRIAL - Exposed Infrastructure
  {
    id: 'industrial/wires_1',
    path: '/assets/models/environment/industrial/wires_hr_1.glb',
    category: 'model',
    sizeKB: 125,

  },
  {
    id: 'industrial/wires_2',
    path: '/assets/models/environment/industrial/wires_hr_2.glb',
    category: 'model',
    sizeKB: 130,

  },
  {
    id: 'industrial/wires_3',
    path: '/assets/models/environment/industrial/wires_hr_3.glb',
    category: 'model',
    sizeKB: 130,

  },
  {
    id: 'industrial/wires_holder_large',
    path: '/assets/models/environment/industrial/wires_holder_hr_large_1.glb',
    category: 'model',
    sizeKB: 160,

  },
  {
    id: 'industrial/wires_holder_small',
    path: '/assets/models/environment/industrial/wires_holder_hr_small_1.glb',
    category: 'model',
    sizeKB: 120,

  },

  // ATMOSPHERIC - Horror Elements
  {
    id: 'atmospheric/hallway_2',
    path: '/assets/models/props/atmospheric/hallway 2.glb',
    category: 'model',
    sizeKB: 3976,

  },

  // PROPS - Battle Damage & Debris
  {
    id: 'prop/debris_bricks_1',
    path: '/assets/models/props/debris/debris_bricks_mx_1.glb',
    category: 'model',
    sizeKB: 100,

  },
  {
    id: 'prop/debris_bricks_2',
    path: '/assets/models/props/debris/debris_bricks_mx_2.glb',
    category: 'model',
    sizeKB: 100,

  },
  {
    id: 'prop/gravel_1',
    path: '/assets/models/props/debris/gravel_pile_hr_1.glb',
    category: 'model',
    sizeKB: 150,

  },

  // PROPS - Evidence & Story Items
  {
    id: 'prop/flare',
    path: '/assets/models/props/weapons/flare_mx_1.glb',
    category: 'model',
    sizeKB: 50,

  },
  {
    id: 'prop/flare_used',
    path: '/assets/models/props/weapons/flare_mx_1_used.glb',
    category: 'model',
    sizeKB: 50,

  },

  // PROPS - Furniture & Interior
  {
    id: 'prop/shelf_2',
    path: '/assets/models/props/furniture/shelf_mx_2.glb',
    category: 'model',
    sizeKB: 140,

  },
  {
    id: 'prop/shelf_3',
    path: '/assets/models/props/furniture/shelf_mx_3.glb',
    category: 'model',
    sizeKB: 140,

  },
  {
    id: 'prop/ladder',
    path: '/assets/models/props/furniture/ladder_hr_1_short.glb',
    category: 'model',
    sizeKB: 80,

  },

  // PROPS - Doors
  {
    id: 'prop/door_8',
    path: '/assets/models/props/doors/door_hr_8.glb',
    category: 'model',
    sizeKB: 135,

  },
  {
    id: 'prop/door_14',
    path: '/assets/models/props/doors/door_hr_14.glb',
    category: 'model',
    sizeKB: 140,

  },

  // PROPS - Emergency Lighting
  {
    id: 'prop/lamp_4_on',
    path: '/assets/models/props/electrical/lamp_mx_4_on.glb',
    category: 'model',
    sizeKB: 75,

  },
  {
    id: 'prop/lamp_4_off',
    path: '/assets/models/props/electrical/lamp_mx_4_off.glb',
    category: 'model',
    sizeKB: 75,

  },

  // TEXTURES - Rust & Decay
  {
    id: 'tex/fob/rust',
    path: '/assets/textures/levels/fob-delta/Rust005_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/rust_normal',
    path: '/assets/textures/levels/fob-delta/Rust005_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/rust_roughness',
    path: '/assets/textures/levels/fob-delta/Rust005_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },

  // TEXTURES - Concrete
  {
    id: 'tex/fob/concrete',
    path: '/assets/textures/levels/fob-delta/Concrete033_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/concrete_normal',
    path: '/assets/textures/levels/fob-delta/Concrete033_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/concrete_roughness',
    path: '/assets/textures/levels/fob-delta/Concrete033_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },

  // TEXTURES - Painted Metal
  {
    id: 'tex/fob/painted_metal',
    path: '/assets/textures/levels/fob-delta/PaintedMetal009_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/painted_metal_normal',
    path: '/assets/textures/levels/fob-delta/PaintedMetal009_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/painted_metal_roughness',
    path: '/assets/textures/levels/fob-delta/PaintedMetal009_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },

  // TEXTURES - Surface Damage
  {
    id: 'tex/fob/damage',
    path: '/assets/textures/levels/fob-delta/SurfaceImperfections004_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/damage_normal',
    path: '/assets/textures/levels/fob-delta/SurfaceImperfections004_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/fob/damage_roughness',
    path: '/assets/textures/levels/fob-delta/SurfaceImperfections004_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },

  // TEXTURES - Skybox
  {
    id: 'tex/fob/skybox',
    path: '/assets/textures/levels/fob-delta/skybox.exr',
    category: 'texture',
    sizeKB: 2000,

  },

  // QUATERNIUS MODULAR - Damaged/Abandoned Interiors
  {
    id: 'modular/floor_empty',
    path: '/assets/models/environment/modular/FloorTile_Empty.glb',
    category: 'model',
    sizeKB: 4,
  },
  {
    id: 'modular/floor_hallway',
    path: '/assets/models/environment/modular/FloorTile_Double_Hallway.glb',
    category: 'model',
    sizeKB: 24,
  },
  {
    id: 'modular/wall_3',
    path: '/assets/models/environment/modular/Wall_3.glb',
    category: 'model',
    sizeKB: 57,
  },
  {
    id: 'modular/wall_4',
    path: '/assets/models/environment/modular/Wall_4.glb',
    category: 'model',
    sizeKB: 68,
  },
  {
    id: 'modular/wall_empty',
    path: '/assets/models/environment/modular/Wall_Empty.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/door_double',
    path: '/assets/models/environment/modular/Door_Double.glb',
    category: 'model',
    sizeKB: 87,
  },
  {
    id: 'modular/door_dbl_wall_a',
    path: '/assets/models/environment/modular/DoorDouble_Wall_SideA.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/door_dbl_wall_b',
    path: '/assets/models/environment/modular/DoorDouble_Wall_SideB.glb',
    category: 'model',
    sizeKB: 11,
  },
  {
    id: 'modular/column_3',
    path: '/assets/models/environment/modular/Column_3.glb',
    category: 'model',
    sizeKB: 33,
  },
  {
    id: 'modular/roof_details',
    path: '/assets/models/environment/modular/RoofTile_Details.glb',
    category: 'model',
    sizeKB: 38,
  },
  {
    id: 'modular/roof_pipes1',
    path: '/assets/models/environment/modular/RoofTile_Pipes1.glb',
    category: 'model',
    sizeKB: 22,
  },
  {
    id: 'modular/roof_pipes2',
    path: '/assets/models/environment/modular/RoofTile_Pipes2.glb',
    category: 'model',
    sizeKB: 47,
  },
  {
    id: 'modular/detail_pipes_long',
    path: '/assets/models/environment/modular/Details_Pipes_Long.glb',
    category: 'model',
    sizeKB: 24,
  },
  {
    id: 'modular/detail_pipes_med',
    path: '/assets/models/environment/modular/Details_Pipes_Medium.glb',
    category: 'model',
    sizeKB: 25,
  },
  {
    id: 'modular/detail_pipes_sm',
    path: '/assets/models/environment/modular/Details_Pipes_Small.glb',
    category: 'model',
    sizeKB: 18,
  },
  {
    id: 'modular/detail_vent3',
    path: '/assets/models/environment/modular/Details_Vent_3.glb',
    category: 'model',
    sizeKB: 21,
  },
  {
    id: 'modular/detail_vent4',
    path: '/assets/models/environment/modular/Details_Vent_4.glb',
    category: 'model',
    sizeKB: 33,
  },
  {
    id: 'modular/detail_vent5',
    path: '/assets/models/environment/modular/Details_Vent_5.glb',
    category: 'model',
    sizeKB: 33,
  },
  {
    id: 'modular/crate',
    path: '/assets/models/environment/modular/Props_Crate.glb',
    category: 'model',
    sizeKB: 134,
  },
  {
    id: 'modular/crate_long',
    path: '/assets/models/environment/modular/Props_CrateLong.glb',
    category: 'model',
    sizeKB: 146,
  },

  // DECALS - Horror Graffiti, Blood-Splattered Walls
  {
    id: 'decal/graffiti_1',
    path: '/assets/models/props/decals/graffiti_mx_1.glb',
    category: 'model',
    sizeKB: 25,
  },
  {
    id: 'decal/graffiti_2',
    path: '/assets/models/props/decals/graffiti_mx_2.glb',
    category: 'model',
    sizeKB: 111,
  },
  {
    id: 'decal/graffiti_4',
    path: '/assets/models/props/decals/graffiti_mx_4.glb',
    category: 'model',
    sizeKB: 63,
  },
  {
    id: 'decal/graffiti_5',
    path: '/assets/models/props/decals/graffiti_mx_5.glb',
    category: 'model',
    sizeKB: 33,
  },
  {
    id: 'decal/poster_4',
    path: '/assets/models/props/decals/poster_cx_4.glb',
    category: 'model',
    sizeKB: 17,
  },

  // STATION EXTERNAL - Dark Silhouette
  {
    id: 'station-ext/station04',
    path: '/assets/models/environment/station-external/station04.glb',
    category: 'model',
    sizeKB: 533,
  },

  // SUPPLY/PICKUP PROPS - Gameplay Items
  {
    id: 'prop/supply_drop',
    path: '/assets/models/props/collectibles/supply_drop.glb',
    category: 'model',
    sizeKB: 80,
  },

  // FORTIFICATION PROPS - Defensive Structures
  {
    id: 'prop/cement_pallet_1',
    path: '/assets/models/props/containers/cement_bags_mp_1_pallet_1.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/cement_pallet_2',
    path: '/assets/models/props/containers/cement_bags_mp_1_pallet_2.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'station/shed_1',
    path: '/assets/models/environment/station/shed_ax_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'station/shed_2',
    path: '/assets/models/environment/station/shed_ax_2.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/platform_small',
    path: '/assets/models/environment/station/platform_small_mx_1.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'station/platform_ax_1',
    path: '/assets/models/environment/station/platform_ax_1.glb',
    category: 'model',
    sizeKB: 160,
  },

  // WAREHOUSE BUILDINGS
  {
    id: 'station/warehouse_1',
    path: '/assets/models/environment/station/warehouse_mx_1.glb',
    category: 'model',
    sizeKB: 400,
  },
  {
    id: 'station/warehouse_2',
    path: '/assets/models/environment/station/warehouse_mx_2.glb',
    category: 'model',
    sizeKB: 420,
  },
  {
    id: 'station/garages_block',
    path: '/assets/models/environment/station/garages_block_hr_1.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'station/garage_door_frame',
    path: '/assets/models/environment/station/garage_door_frame_hr_1.glb',
    category: 'model',
    sizeKB: 150,
  },

  // GROUND TILES - Asphalt
  {
    id: 'station/asphalt_large',
    path: '/assets/models/environment/station/asphalt_hr_1_large.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/asphalt_1',
    path: '/assets/models/environment/station/asphalt_hr_1.glb',
    category: 'model',
    sizeKB: 180,
  },

  // PERIMETER WALLS
  {
    id: 'station/wall_hr_1',
    path: '/assets/models/environment/station/wall_hr_1.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'station/wall_hr_15',
    path: '/assets/models/environment/station/wall_hr_15.glb',
    category: 'model',
    sizeKB: 320,
  },

  // CONTAINERS AND CLUTTER
  {
    id: 'prop/shipping_container',
    path: '/assets/models/environment/industrial/shipping_container_mx_1.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'prop/wooden_crate_1',
    path: '/assets/models/props/containers/wooden_crate_1.glb',
    category: 'model',
    sizeKB: 60,
  },
  {
    id: 'prop/metal_barrel',
    path: '/assets/models/props/containers/metal_barrel_hr_1.glb',
    category: 'model',
    sizeKB: 50,
  },

  // BARRACKS INTERIOR
  {
    id: 'prop/bench_1',
    path: '/assets/models/props/furniture/bench_mx_1.glb',
    category: 'model',
    sizeKB: 80,
  },
  {
    id: 'prop/marine_body',
    path: '/assets/models/npcs/marine/marine_soldier.glb',
    category: 'model',
    sizeKB: 300,
  },

  // COMMAND CENTER
  {
    id: 'prop/computer',
    path: '/assets/models/environment/modular/Props_Computer.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'prop/door_hr_6',
    path: '/assets/models/props/doors/door_hr_6.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/chimney',
    path: '/assets/models/environment/industrial/chimney_a_1.glb',
    category: 'model',
    sizeKB: 180,
  },

  // DETAIL ARROWS
  {
    id: 'modular/detail_arrow',
    path: '/assets/models/environment/modular/Details_Arrow.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/detail_arrow_2',
    path: '/assets/models/environment/modular/Details_Arrow_2.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/detail_plate_long',
    path: '/assets/models/environment/modular/Details_Plate_Long.glb',
    category: 'model',
    sizeKB: 20,
  },

  // UNDERGROUND HATCH
  {
    id: 'prop/hatch_door',
    path: '/assets/models/props/doors/door_hr_12.glb',
    category: 'model',
    sizeKB: 130,
  }
];

export const FOB_DELTA_MANIFEST: LevelManifest = {
  levelId: 'fob_delta',

  // Critical assets for horror atmosphere and combat
  required: [
    'enemy/spider',
    'enemy/scout',
    'station/pillar_broken',
    'station/wall_hole_2',
    'station/floor_ceiling_2_hole',
    'industrial/wires_1',
    'industrial/wires_2',
    'prop/lamp_4_on',
    'prop/lamp_4_off',
    'tex/fob/rust',
    'tex/fob/concrete'
  ],

  // Preload for smooth horror pacing and combat encounters
  // ALL modular, decal, and station-external assets are preloaded because
  // buildModularBaseStructure uses them during createEnvironment().
  preload: [
    'enemy/soldier',
    'vehicle/wraith',
    // Supply and fortification props
    'prop/supply_drop',
    'prop/cement_pallet_1',
    'prop/cement_pallet_2',
    'station/shed_1',
    'station/shed_2',
    'station/platform_small',
    'station/platform_ax_1',
    // Building structures
    'station/warehouse_1',
    'station/warehouse_2',
    'station/garages_block',
    'station/garage_door_frame',
    // Ground tiles
    'station/asphalt_large',
    'station/asphalt_1',
    // Perimeter walls
    'station/wall_hr_1',
    'station/wall_hr_15',
    // Containers and clutter
    'prop/shipping_container',
    'prop/wooden_crate_1',
    'prop/metal_barrel',
    // Barracks interior
    'prop/bench_1',
    'prop/marine_body',
    // Command center
    'prop/computer',
    'prop/door_hr_6',
    'prop/chimney',
    // Details
    'modular/detail_arrow',
    'modular/detail_arrow_2',
    'modular/detail_plate_long',
    'prop/hatch_door',
    'atmospheric/hallway_2',
    'station/wall_15',
    'station/floor_ceiling_4',
    'station/floor_ceiling_5',
    'station/floor_ceiling_6',
    'station/beam_rtx_2_pipes',
    'station/doorway_2_wide',
    'industrial/wires_3',
    'industrial/wires_holder_large',
    'industrial/wires_holder_small',
    'prop/debris_bricks_1',
    'prop/debris_bricks_2',
    'prop/gravel_1',
    'prop/flare',
    'prop/flare_used',
    'prop/door_8',
    'prop/door_14',
    'prop/shelf_2',
    'prop/shelf_3',
    'prop/ladder',
    'tex/fob/painted_metal',
    'tex/fob/damage',
    'tex/fob/skybox',
    // Quaternius modular pieces (floors, walls, doors, columns, roof, vents, pipes, props)
    'modular/floor_empty',
    'modular/floor_hallway',
    'modular/wall_3',
    'modular/wall_4',
    'modular/wall_empty',
    'modular/door_double',
    'modular/door_dbl_wall_a',
    'modular/door_dbl_wall_b',
    'modular/column_3',
    'modular/roof_details',
    'modular/roof_pipes1',
    'modular/roof_pipes2',
    'modular/detail_pipes_long',
    'modular/detail_pipes_med',
    'modular/detail_pipes_sm',
    'modular/detail_vent3',
    'modular/detail_vent4',
    'modular/detail_vent5',
    'modular/crate',
    'modular/crate_long',
    // Decals -- graffiti and posters on walls
    'decal/graffiti_1',
    'decal/graffiti_2',
    'decal/graffiti_4',
    'decal/graffiti_5',
    'decal/poster_4',
    // Station external silhouette
    'station-ext/station04'
  ],

  // Load on demand for later sections (textures only -- PBR maps)
  deferred: [
    'enemy/alienmale',
    'tex/fob/rust_normal',
    'tex/fob/rust_roughness',
    'tex/fob/concrete_normal',
    'tex/fob/concrete_roughness',
    'tex/fob/painted_metal_normal',
    'tex/fob/painted_metal_roughness',
    'tex/fob/damage_normal',
    'tex/fob/damage_roughness'
  ]
};

/**
 * MISSING ASSETS - Horror & Battle Damage Elements
 *
 * CRITICAL FOR ATMOSPHERE:
 * - Blood splatter / alien goo decal meshes
 * - Claw marks wall panel (alien damage signature)
 * - Overturned desk / smashed furniture (signs of struggle)
 * - Broken glass / shattered window panel
 * - Emergency red light strip (non-functional/flickering)
 *
 * STORY ELEMENTS:
 * - Body bag / covered stretcher model (casualties)
 * - Alien web / cocoon model (early hive infestation signs)
 * - Static / broken computer screen (last messages)
 * - Bullet-hole wall panel (firefight evidence)
 * - Torn military poster / signage (degradation)
 *
 * ENVIRONMENTAL STORYTELLING:
 * These assets would enhance the narrative of "what happened here"
 * by showing progression from functioning base → battle → alien takeover
 */
