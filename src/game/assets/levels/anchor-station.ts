/**
 * Anchor Station Prometheus - Level Asset Manifest
 *
 * Tutorial/briefing level set in a clean, operational military space station.
 * This is the first environment the player experiences - well-lit, organized,
 * and professional military atmosphere.
 */

import type { AssetEntry, LevelManifest } from '../types';

// ============================================================================
// STATION STRUCTURE - Core architectural pieces
// ============================================================================

const STATION_CORRIDORS: AssetEntry[] = [
  {
    id: 'station/corridor_main',
    category: 'model',
    path: '/assets/models/environment/station/corridor_main.glb',
    sizeKB: 320,
  },
  {
    id: 'station/corridor_wide',
    category: 'model',
    path: '/assets/models/environment/station/corridor_wide.glb',
    sizeKB: 340,
  },
  {
    id: 'station/corridor_corner',
    category: 'model',
    path: '/assets/models/environment/station/corridor_corner.glb',
    sizeKB: 300,
  },
  {
    id: 'station/corridor_junction',
    category: 'model',
    path: '/assets/models/environment/station/corridor_junction.glb',
    sizeKB: 360,
  },
];

const STATION_FLOORS_CEILINGS: AssetEntry[] = [
  {
    id: 'station/floor_ceiling_1',
    category: 'model',
    path: '/assets/models/environment/station/floor_ceiling_hr_1.glb',
    sizeKB: 180,
  },
  {
    id: 'station/floor_ceiling_3',
    category: 'model',
    path: '/assets/models/environment/station/floor_ceiling_hr_3.glb',
    sizeKB: 190,
  },
  {
    id: 'station/floor_ceiling_rtx',
    category: 'model',
    path: '/assets/models/environment/station/floor_ceiling_rtx_1.glb',
    sizeKB: 200,
  },
  {
    id: 'station/floor_ceiling_rtx_2',
    category: 'model',
    path: '/assets/models/environment/station/floor_ceiling_rtx_2.glb',
    sizeKB: 1689,
  },
  {
    id: 'station/floor_ceiling_rtx_corner',
    category: 'model',
    path: '/assets/models/environment/station/floor_ceiling_rtx_1_corner.glb',
    sizeKB: 1704,
  },
];

const STATION_WALLS: AssetEntry[] = [
  {
    id: 'station/wall_double',
    category: 'model',
    path: '/assets/models/environment/station/wall_hr_1_double.glb',
    sizeKB: 220,
  },
  {
    id: 'station/wall_single',
    category: 'model',
    path: '/assets/models/environment/station/wall_hr_1.glb',
    sizeKB: 969,
  },
  {
    id: 'station/wall_m_2',
    category: 'model',
    path: '/assets/models/environment/station/wall_hr_1_m_2.glb',
    sizeKB: 1797,
  },
  {
    id: 'station/wall_hole',
    category: 'model',
    path: '/assets/models/environment/station/wall_hr_1_hole_1.glb',
    sizeKB: 240,
  },
  {
    id: 'station/wall_rtx_1',
    category: 'model',
    path: '/assets/models/environment/station/wall_rtx_1.glb',
    sizeKB: 874,
  },
];

const STATION_DOORWAYS: AssetEntry[] = [
  {
    id: 'station/doorway',
    category: 'model',
    path: '/assets/models/environment/station/doorway_hr_1.glb',
    sizeKB: 210,
  },
  {
    id: 'station/doorway_wide',
    category: 'model',
    path: '/assets/models/environment/station/doorway_hr_1_wide.glb',
    sizeKB: 230,
  },
  {
    id: 'station/doorway_2',
    category: 'model',
    path: '/assets/models/environment/station/doorway_hr_2_regular.glb',
    sizeKB: 1532,
  },
  {
    id: 'station/doorway_3',
    category: 'model',
    path: '/assets/models/environment/station/doorway_hr_3_regular.glb',
    sizeKB: 1640,
  },
  {
    id: 'station/station_door',
    category: 'model',
    path: '/assets/models/environment/station/station_door.glb',
    sizeKB: 150,
  },
];

const STATION_GARAGE_DOORS: AssetEntry[] = [
  {
    id: 'station/garage_door_1',
    category: 'model',
    path: '/assets/models/environment/station/garage_door_frame_hr_1.glb',
    sizeKB: 1559,
  },
  {
    id: 'station/garage_door_2',
    category: 'model',
    path: '/assets/models/environment/station/garage_door_frame_hr_2.glb',
    sizeKB: 1434,
  },
];

// ============================================================================
// STATION DETAILS - Structural elements and utilities
// ============================================================================

const STATION_BEAMS: AssetEntry[] = [
  {
    id: 'station/beam_horizontal',
    category: 'model',
    path: '/assets/models/environment/station/beam_hc_horizontal_1.glb',
    sizeKB: 110,
  },
  {
    id: 'station/beam_horizontal_2',
    category: 'model',
    path: '/assets/models/environment/station/beam_hc_horizontal_2.glb',
    sizeKB: 470,
  },
  {
    id: 'station/beam_vertical',
    category: 'model',
    path: '/assets/models/environment/station/beam_hc_vertical_1.glb',
    sizeKB: 100,
  },
  {
    id: 'station/beam_rtx_1',
    category: 'model',
    path: '/assets/models/environment/station/beam_rtx_1.glb',
    sizeKB: 875,
  },
];

const STATION_PIPES: AssetEntry[] = [
  {
    id: 'station/pipe_1',
    category: 'model',
    path: '/assets/models/environment/station/pipe_cx_1.glb',
    sizeKB: 90,
  },
  {
    id: 'station/pipe_2',
    category: 'model',
    path: '/assets/models/environment/station/pipe_cx_2.glb',
    sizeKB: 95,
  },
];

const STATION_PILLARS: AssetEntry[] = [
  {
    id: 'station/pillar_2',
    category: 'model',
    path: '/assets/models/environment/station/pillar_hr_2.glb',
    sizeKB: 970,
  },
  {
    id: 'station/pillar_4',
    category: 'model',
    path: '/assets/models/environment/station/pillar_hr_4.glb',
    sizeKB: 969,
  },
];

const STATION_WINDOWS: AssetEntry[] = [
  {
    id: 'station/window_1',
    category: 'model',
    path: '/assets/models/environment/station/window_hr_1.glb',
    sizeKB: 2326,
  },
  {
    id: 'station/window_2',
    category: 'model',
    path: '/assets/models/environment/station/window_hr_2.glb',
    sizeKB: 2328,
  },
];

const STATION_PLATFORMS: AssetEntry[] = [
  {
    id: 'station/platform_a1',
    category: 'model',
    path: '/assets/models/environment/station/platform_ax_1.glb',
    sizeKB: 152,
  },
  {
    id: 'station/platform_b1',
    category: 'model',
    path: '/assets/models/environment/station/platform_bx_1.glb',
    sizeKB: 474,
  },
  {
    id: 'station/platform_large',
    category: 'model',
    path: '/assets/models/environment/station/platform_large_mx_1.glb',
    sizeKB: 498,
  },
  {
    id: 'station/ramp_slim',
    category: 'model',
    path: '/assets/models/environment/station/ramp_platform_slim_mx_1.glb',
    sizeKB: 844,
  },
  {
    id: 'station/ramp_wide',
    category: 'model',
    path: '/assets/models/environment/station/ramp_platform_wide_mx_1.glb',
    sizeKB: 497,
  },
];

const STATION_MISC: AssetEntry[] = [
  {
    id: 'station/station_barrel',
    category: 'model',
    path: '/assets/models/environment/station/station_barrel.glb',
    sizeKB: 80,
  },
];

// ============================================================================
// ATMOSPHERIC ELEMENTS - High-quality hallway piece
// ============================================================================

const ATMOSPHERIC_HALLWAY: AssetEntry[] = [
  {
    id: 'atmospheric/hallway_1',
    category: 'model',
    path: '/assets/models/props/atmospheric/hallway_1.glb',
    sizeKB: 7500,
  },
];

// ============================================================================
// PROPS - Industrial and furniture items
// ============================================================================

const INDUSTRIAL_PROPS: AssetEntry[] = [
  {
    id: 'prop/barrel_1',
    category: 'model',
    path: '/assets/models/props/containers/metal_barrel_hr_1.glb',
    sizeKB: 120,
  },
  {
    id: 'prop/barrel_2',
    category: 'model',
    path: '/assets/models/props/containers/metal_barrel_hr_2.glb',
    sizeKB: 125,
  },
  {
    id: 'prop/shelf',
    category: 'model',
    path: '/assets/models/props/furniture/shelf_mx_1.glb',
    sizeKB: 140,
  },
  {
    id: 'prop/box',
    category: 'model',
    path: '/assets/models/props/containers/cardboard_box_1.glb',
    sizeKB: 60,
  },
  {
    id: 'prop/electrical',
    category: 'model',
    path: '/assets/models/environment/industrial/electrical_equipment_1.glb',
    sizeKB: 180,
  },
  {
    id: 'prop/machinery',
    category: 'model',
    path: '/assets/models/environment/industrial/machinery_mx_1.glb',
    sizeKB: 250,
  },
  {
    id: 'prop/pipes',
    category: 'model',
    path: '/assets/models/environment/industrial/pipes_hr_1.glb',
    sizeKB: 160,
  },
  {
    id: 'prop/door_6',
    category: 'model',
    path: '/assets/models/props/doors/door_hr_6.glb',
    sizeKB: 130,
  },
  {
    id: 'prop/door_12',
    category: 'model',
    path: '/assets/models/props/doors/door_hr_12.glb',
    sizeKB: 135,
  },
  {
    id: 'prop/door_13',
    category: 'model',
    path: '/assets/models/props/doors/door_hr_13.glb',
    sizeKB: 138,
  },
];

const LIGHTING_PROPS: AssetEntry[] = [
  {
    id: 'prop/lamp_1',
    category: 'model',
    path: '/assets/models/props/electrical/lamp_mx_1_a_on.glb',
    sizeKB: 70,
  },
  {
    id: 'prop/lamp_2',
    category: 'model',
    path: '/assets/models/props/electrical/lamp_mx_2_on.glb',
    sizeKB: 72,
  },
  {
    id: 'prop/lamp_3',
    category: 'model',
    path: '/assets/models/props/electrical/lamp_mx_3_on.glb',
    sizeKB: 75,
  },
];

const FURNITURE_PROPS: AssetEntry[] = [
  {
    id: 'prop/first_aid_kit',
    category: 'model',
    path: '/assets/models/props/electrical/first_aid_kit_hr_1.glb',
    sizeKB: 100,
  },
  {
    id: 'prop/bench',
    category: 'model',
    path: '/assets/models/props/furniture/bench_mx_1.glb',
    sizeKB: 100,
  },
];

// ============================================================================
// TEXTURES - AmbientCG materials
// ============================================================================

const AMBIENTCG_TEXTURES: AssetEntry[] = [
  // Metal007 - Industrial metal
  {
    id: 'tex/anchor/metal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Metal007_1K-JPG_Color.jpg',
    sizeKB: 256,
  },
  {
    id: 'tex/anchor/metal_normal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Metal007_1K-JPG_NormalGL.jpg',
    sizeKB: 256,
  },
  {
    id: 'tex/anchor/metal_roughness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Metal007_1K-JPG_Roughness.jpg',
    sizeKB: 128,
  },
  {
    id: 'tex/anchor/metal_metalness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Metal007_1K-JPG_Metalness.jpg',
    sizeKB: 128,
  },

  // MetalPlates006A - Wall plates
  {
    id: 'tex/anchor/plates',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalPlates006A_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/plates_normal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalPlates006A_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/plates_roughness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalPlates006A_1K-JPG_Roughness.jpg',
    sizeKB: 100,
  },

  // MetalWalkway003 - Floor grating
  {
    id: 'tex/anchor/walkway',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalWalkway003_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/walkway_normal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalWalkway003_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/walkway_roughness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/MetalWalkway003_1K-JPG_Roughness.jpg',
    sizeKB: 100,
  },

  // Tiles074 - Clean floor tiles
  {
    id: 'tex/anchor/floor',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Tiles074_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/floor_normal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Tiles074_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/anchor/floor_roughness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Tiles074_1K-JPG_Roughness.jpg',
    sizeKB: 100,
  },

  // Plastic008 - Control panels
  {
    id: 'tex/anchor/plastic',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Plastic008_1K-JPG_Color.jpg',
    sizeKB: 150,
  },
  {
    id: 'tex/anchor/plastic_normal',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Plastic008_1K-JPG_NormalGL.jpg',
    sizeKB: 150,
  },
  {
    id: 'tex/anchor/plastic_roughness',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/Plastic008_1K-JPG_Roughness.jpg',
    sizeKB: 75,
  },
];

const SKYBOX_TEXTURES: AssetEntry[] = [
  {
    id: 'tex/anchor/skybox',
    category: 'texture',
    path: '/assets/textures/levels/anchor-station/skybox.exr',
    sizeKB: 2000,
  },
];

// ============================================================================
// PSX PACK TEXTURES - Retro-styled textures
// ============================================================================

const PSX_TEXTURES: AssetEntry[] = [
  {
    id: 'tex/metal_hr_1',
    category: 'texture',
    path: '/assets/textures/psx/metal_hr_1.png',
    sizeKB: 256,
  },
  {
    id: 'tex/wall',
    category: 'texture',
    path: '/assets/textures/psx/wall_hr_1.png',
    sizeKB: 240,
  },
  {
    id: 'tex/concrete',
    category: 'texture',
    path: '/assets/textures/psx/concrete_hr_1.png',
    sizeKB: 230,
  },
  {
    id: 'tex/metal_barrel',
    category: 'texture',
    path: '/assets/textures/psx/metal_barrel_hr_1.png',
    sizeKB: 180,
  },
  {
    id: 'tex/machinery',
    category: 'texture',
    path: '/assets/textures/psx/machinery_mx_1.png',
    sizeKB: 210,
  },
  {
    id: 'tex/door',
    category: 'texture',
    path: '/assets/textures/psx/door_hr_6.png',
    sizeKB: 200,
  },
];

// ============================================================================
// MODULAR SCI-FI - Quaternius clean station interior pieces
// ============================================================================

const MODULAR_SCIFI: AssetEntry[] = [
  {
    id: 'modular/floor_basic',
    category: 'model',
    path: '/assets/models/environment/modular/FloorTile_Basic.glb',
    sizeKB: 18,
  },
  {
    id: 'modular/floor_basic2',
    category: 'model',
    path: '/assets/models/environment/modular/FloorTile_Basic2.glb',
    sizeKB: 27,
  },
  {
    id: 'modular/floor_corner',
    category: 'model',
    path: '/assets/models/environment/modular/FloorTile_Corner.glb',
    sizeKB: 18,
  },
  {
    id: 'modular/floor_side',
    category: 'model',
    path: '/assets/models/environment/modular/FloorTile_Side.glb',
    sizeKB: 14,
  },
  {
    id: 'modular/floor_inner',
    category: 'model',
    path: '/assets/models/environment/modular/FloorTile_InnerCorner.glb',
    sizeKB: 12,
  },
  {
    id: 'modular/wall_1',
    category: 'model',
    path: '/assets/models/environment/modular/Wall_1.glb',
    sizeKB: 58,
  },
  {
    id: 'modular/wall_2',
    category: 'model',
    path: '/assets/models/environment/modular/Wall_2.glb',
    sizeKB: 93,
  },
  {
    id: 'modular/door_single',
    category: 'model',
    path: '/assets/models/environment/modular/Door_Single.glb',
    sizeKB: 57,
  },
  {
    id: 'modular/column_1',
    category: 'model',
    path: '/assets/models/environment/modular/Column_1.glb',
    sizeKB: 5,
  },
  {
    id: 'modular/column_2',
    category: 'model',
    path: '/assets/models/environment/modular/Column_2.glb',
    sizeKB: 9,
  },
  {
    id: 'modular/roof_plate',
    category: 'model',
    path: '/assets/models/environment/modular/RoofTile_Plate.glb',
    sizeKB: 21,
  },
  {
    id: 'modular/roof_vents_sm',
    category: 'model',
    path: '/assets/models/environment/modular/RoofTile_SmallVents.glb',
    sizeKB: 20,
  },
  {
    id: 'modular/staircase',
    category: 'model',
    path: '/assets/models/environment/modular/Staircase.glb',
    sizeKB: 19,
  },
  {
    id: 'modular/computer',
    category: 'model',
    path: '/assets/models/environment/modular/Props_Computer.glb',
    sizeKB: 38,
  },
  {
    id: 'modular/shelf',
    category: 'model',
    path: '/assets/models/environment/modular/Props_Shelf.glb',
    sizeKB: 19,
  },
  {
    id: 'modular/shelf_tall',
    category: 'model',
    path: '/assets/models/environment/modular/Props_Shelf_Tall.glb',
    sizeKB: 27,
  },
  {
    id: 'modular/detail_vent1',
    category: 'model',
    path: '/assets/models/environment/modular/Details_Vent_1.glb',
    sizeKB: 10,
  },
  {
    id: 'modular/detail_vent2',
    category: 'model',
    path: '/assets/models/environment/modular/Details_Vent_2.glb',
    sizeKB: 9,
  },
  {
    id: 'modular/detail_plate_lg',
    category: 'model',
    path: '/assets/models/environment/modular/Details_Plate_Large.glb',
    sizeKB: 14,
  },
];

// ============================================================================
// STATION EXTERNAL - Space visible through windows
// ============================================================================

const STATION_EXTERNAL: AssetEntry[] = [
  {
    id: 'station-ext/station01',
    category: 'model',
    path: '/assets/models/environment/station-external/station01.glb',
    sizeKB: 678,
  },
];

// ============================================================================
// DECALS - Military notices on walls
// ============================================================================

const DECAL_PROPS: AssetEntry[] = [
  {
    id: 'decal/poster_11',
    category: 'model',
    path: '/assets/models/props/decals/poster_cx_11.glb',
    sizeKB: 38,
  },
  {
    id: 'decal/poster_12',
    category: 'model',
    path: '/assets/models/props/decals/poster_cx_12.glb',
    sizeKB: 39,
  },
  {
    id: 'decal/poster_13',
    category: 'model',
    path: '/assets/models/props/decals/poster_cx_13.glb',
    sizeKB: 39,
  },
];

// ============================================================================
// COMBINED ASSET LIST
// ============================================================================

export const ANCHOR_STATION_ASSETS: AssetEntry[] = [
  ...STATION_CORRIDORS,
  ...STATION_FLOORS_CEILINGS,
  ...STATION_WALLS,
  ...STATION_DOORWAYS,
  ...STATION_GARAGE_DOORS,
  ...STATION_BEAMS,
  ...STATION_PIPES,
  ...STATION_PILLARS,
  ...STATION_WINDOWS,
  ...STATION_PLATFORMS,
  ...STATION_MISC,
  ...ATMOSPHERIC_HALLWAY,
  ...INDUSTRIAL_PROPS,
  ...LIGHTING_PROPS,
  ...FURNITURE_PROPS,
  ...AMBIENTCG_TEXTURES,
  ...SKYBOX_TEXTURES,
  ...PSX_TEXTURES,
  ...MODULAR_SCIFI,
  ...STATION_EXTERNAL,
  ...DECAL_PROPS,
];

// ============================================================================
// LEVEL MANIFEST - Loading priorities
// ============================================================================

export const ANCHOR_STATION_MANIFEST: LevelManifest = {
  levelId: 'anchor_station',
  // REQUIRED - Must be loaded before the level can start
  // These are the immediate spawn area assets
  required: [
    'station/corridor_main',
    'station/floor_ceiling_1',
    'station/wall_double',
    'station/doorway',
    'station/station_door',
    'tex/wall',
    'tex/metal_hr_1',
  ],

  // PRELOAD - Load during initial loading screen
  // Remaining station structure and key props
  preload: [
    // Additional corridors and structure
    'station/corridor_wide',
    'station/corridor_corner',
    'station/corridor_junction',
    'station/floor_ceiling_3',
    'station/wall_single',
    'station/doorway_wide',

    // Essential structural elements
    'station/beam_horizontal',
    'station/beam_vertical',
    'station/pipe_1',
    'station/pillar_2',

    // Common props for initial areas
    'prop/barrel_1',
    'prop/box',
    'prop/lamp_1',
    'prop/bench',
    'prop/first_aid_kit',

    // PSX textures for immediate areas
    'tex/concrete',
    'tex/door',
    'tex/machinery',

    // Modular sci-fi core pieces
    'modular/floor_basic',
    'modular/wall_1',
    'modular/wall_2',
    'modular/door_single',
    'modular/column_1',
    'modular/column_2',
    'modular/roof_plate',
    'modular/staircase',
    'modular/computer',

    // Station external
    'station-ext/station01',
  ],

  // DEFERRED - Load in background during gameplay
  // Extended variants, high-res models, and atmospheric pieces
  deferred: [
    // Expanded station variants
    'station/floor_ceiling_rtx',
    'station/floor_ceiling_rtx_2',
    'station/floor_ceiling_rtx_corner',
    'station/wall_m_2',
    'station/wall_hole',
    'station/wall_rtx_1',
    'station/doorway_2',
    'station/doorway_3',
    'station/beam_horizontal_2',
    'station/beam_rtx_1',
    'station/pipe_2',
    'station/pillar_4',
    'station/window_1',
    'station/window_2',
    'station/garage_door_1',
    'station/garage_door_2',

    // Platforms and ramps
    'station/platform_a1',
    'station/platform_b1',
    'station/platform_large',
    'station/ramp_slim',
    'station/ramp_wide',

    // Additional props
    'station/station_barrel',
    'prop/barrel_2',
    'prop/shelf',
    'prop/electrical',
    'prop/machinery',
    'prop/pipes',
    'prop/door_6',
    'prop/door_12',
    'prop/door_13',
    'prop/lamp_2',
    'prop/lamp_3',

    // Atmospheric hallway (large file)
    'atmospheric/hallway_1',

    // AmbientCG PBR textures
    'tex/anchor/metal',
    'tex/anchor/metal_normal',
    'tex/anchor/metal_roughness',
    'tex/anchor/metal_metalness',
    'tex/anchor/plates',
    'tex/anchor/plates_normal',
    'tex/anchor/plates_roughness',
    'tex/anchor/walkway',
    'tex/anchor/walkway_normal',
    'tex/anchor/walkway_roughness',
    'tex/anchor/floor',
    'tex/anchor/floor_normal',
    'tex/anchor/floor_roughness',
    'tex/anchor/plastic',
    'tex/anchor/plastic_normal',
    'tex/anchor/plastic_roughness',
    'tex/anchor/skybox',

    // Remaining PSX textures
    'tex/metal_barrel',

    // Modular sci-fi deferred pieces
    'modular/floor_basic2',
    'modular/floor_corner',
    'modular/floor_side',
    'modular/floor_inner',
    'modular/roof_vents_sm',
    'modular/shelf',
    'modular/shelf_tall',
    'modular/detail_vent1',
    'modular/detail_vent2',
    'modular/detail_plate_lg',

    // Decals
    'decal/poster_11',
    'decal/poster_12',
    'decal/poster_13',
  ],
};

// ============================================================================
// MISSING ASSETS
// ============================================================================

/**
 * MISSING ASSETS
 *
 * The following models and props would enhance the Anchor Station level
 * but are not currently available in the asset library:
 *
 * FURNITURE & EQUIPMENT:
 * - Armory weapons rack model (for weapons storage area)
 * - Bunk bed / sleeping quarters furniture (for crew quarters)
 * - Command console / holographic table (for briefing room centerpiece)
 * - Locker / storage locker model (for personal storage areas)
 * - Computer terminal / workstation model (for control rooms)
 * - Briefing room table with chairs (for mission briefing area)
 *
 * ATMOSPHERIC DETAILS:
 * - Emergency lighting strips (red/amber warning lights)
 * - Vent / air duct grate cover (for ceiling/wall ventilation)
 * - Fire extinguisher model (safety equipment)
 * - Ceiling-mounted security camera (surveillance equipment)
 *
 * These assets would help create distinct functional areas within the station
 * (briefing room, armory, crew quarters, command center) and add military/
 * industrial authenticity to the environment.
 */
