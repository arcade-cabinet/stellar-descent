import type { AssetEntry, LevelManifest } from '../types';

/**
 * Extraction - Level Asset Manifest
 *
 * Night surface holdout at LZ Omega. Wave-based combat while holding
 * position until the Phantom dropship arrives for emergency extraction.
 *
 * ATMOSPHERE: Dark night sky. Flares lighting the landing zone.
 * Distant explosions on the horizon. Desperate last stand.
 */

// ============================================================================
// PROPS - Extraction site infrastructure (pipes, electrical)
// ============================================================================

const EXTRACTION_PROPS: AssetEntry[] = [
  {
    id: 'prop/extraction/pipe_1',
    path: '/models/props/pipes/pipe_e_1.glb',
    category: 'model',
    sizeKB: 90,
  },
  {
    id: 'prop/extraction/pipe_2',
    path: '/models/props/pipes/pipe_e_2.glb',
    category: 'model',
    sizeKB: 95,
  },
  {
    id: 'prop/extraction/pipe_3',
    path: '/models/props/pipes/pipe_mx_1.glb',
    category: 'model',
    sizeKB: 85,
  },
  {
    id: 'prop/extraction/pipe_4',
    path: '/models/props/pipes/pipe_mx_2.glb',
    category: 'model',
    sizeKB: 85,
  },
  {
    id: 'prop/extraction/elec_1',
    path: '/models/props/industrial/electrical_equipment_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'prop/extraction/gear_1',
    path: '/models/props/electrical/gear_mx_1.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/extraction/gear_2',
    path: '/models/props/electrical/gear_mx_2.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/extraction/lamp_off',
    path: '/models/props/electrical/lamp_mx_4_off.glb',
    category: 'model',
    sizeKB: 75,
  },
  {
    id: 'prop/extraction/concrete_block',
    path: '/models/props/electrical/concrete_block_mx_1.glb',
    category: 'model',
    sizeKB: 90,
  },
  {
    id: 'prop/extraction/radio',
    path: '/models/props/electrical/handheld_fm_radio_etx_1.glb',
    category: 'model',
    sizeKB: 60,
  },
];

// ============================================================================
// TEXTURES - Night surface PBR materials (AmbientCG)
// ============================================================================

const EXTRACTION_TEXTURES: AssetEntry[] = [
  // Ground042 - night surface terrain
  {
    id: 'tex/extraction/ground',
    path: '/textures/levels/extraction/Ground042_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/ground_normal',
    path: '/textures/levels/extraction/Ground042_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/ground_roughness',
    path: '/textures/levels/extraction/Ground042_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },

  // PaintedMetal013 - LZ markings
  {
    id: 'tex/extraction/painted',
    path: '/textures/levels/extraction/PaintedMetal013_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/painted_normal',
    path: '/textures/levels/extraction/PaintedMetal013_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/painted_roughness',
    path: '/textures/levels/extraction/PaintedMetal013_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },

  // Rubber002 - tire marks / landing pad
  {
    id: 'tex/extraction/rubber',
    path: '/textures/levels/extraction/Rubber002_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/rubber_normal',
    path: '/textures/levels/extraction/Rubber002_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/rubber_roughness',
    path: '/textures/levels/extraction/Rubber002_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },

  // Asphalt007 - runway/landing strip
  {
    id: 'tex/extraction/asphalt',
    path: '/textures/levels/extraction/Asphalt007_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/asphalt_normal',
    path: '/textures/levels/extraction/Asphalt007_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/extraction/asphalt_roughness',
    path: '/textures/levels/extraction/Asphalt007_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },

  // Night sky HDRI
  {
    id: 'tex/extraction/skybox',
    path: '/textures/levels/extraction/skybox.exr',
    category: 'texture',
    sizeKB: 2000,
  },
];

// ============================================================================
// FENCES & BARRIERS - Defensive perimeter around LZ Omega
// ============================================================================

const EXTRACTION_FENCES: AssetEntry[] = [
  {
    id: 'fence/b_1',
    path: '/models/props/modular/fence_b_1.glb',
    category: 'model',
    sizeKB: 254,
  },
  {
    id: 'fence/b_pillar',
    path: '/models/props/modular/fence_b_pillar.glb',
    category: 'model',
    sizeKB: 58,
  },
  {
    id: 'fence/e_1',
    path: '/models/props/modular/fence_e_1.glb',
    category: 'model',
    sizeKB: 479,
  },
  {
    id: 'fence/e_2',
    path: '/models/props/modular/fence_e_2.glb',
    category: 'model',
    sizeKB: 518,
  },
  {
    id: 'fence/e_pillar',
    path: '/models/props/modular/fence_e_pillar_1.glb',
    category: 'model',
    sizeKB: 476,
  },
  {
    id: 'fence/e_corner',
    path: '/models/props/modular/fence_e_pillar_1_corner.glb',
    category: 'model',
    sizeKB: 478,
  },
];

// ============================================================================
// QUATERNIUS MODULAR - LZ infrastructure buildings
// ============================================================================

const EXTRACTION_MODULAR: AssetEntry[] = [
  {
    id: 'modular/window_wall_a',
    path: '/models/environment/modular/Window_Wall_SideA.glb',
    category: 'model',
    sizeKB: 19,
  },
  {
    id: 'modular/window_wall_b',
    path: '/models/environment/modular/Window_Wall_SideB.glb',
    category: 'model',
    sizeKB: 18,
  },
  {
    id: 'modular/3win_wall_a',
    path: '/models/environment/modular/ThreeWindows_Wall_SideA.glb',
    category: 'model',
    sizeKB: 37,
  },
  {
    id: 'modular/3win_wall_b',
    path: '/models/environment/modular/ThreeWindows_Wall_SideB.glb',
    category: 'model',
    sizeKB: 34,
  },
  {
    id: 'modular/wall_empty',
    path: '/models/environment/modular/Wall_Empty.glb',
    category: 'model',
    sizeKB: 12,
  },
  {
    id: 'modular/door_single_wall_a',
    path: '/models/environment/modular/DoorSingle_Wall_SideA.glb',
    category: 'model',
    sizeKB: 22,
  },
  {
    id: 'modular/floor_basic',
    path: '/models/environment/modular/FloorTile_Basic.glb',
    category: 'model',
    sizeKB: 10,
  },
  {
    id: 'modular/floor_empty',
    path: '/models/environment/modular/FloorTile_Empty.glb',
    category: 'model',
    sizeKB: 4,
  },
  {
    id: 'modular/roof_empty',
    path: '/models/environment/modular/RoofTile_Empty.glb',
    category: 'model',
    sizeKB: 4,
  },
  {
    id: 'modular/roof_plate2',
    path: '/models/environment/modular/RoofTile_Plate2.glb',
    category: 'model',
    sizeKB: 22,
  },
  {
    id: 'modular/roof_vents',
    path: '/models/environment/modular/RoofTile_Vents.glb',
    category: 'model',
    sizeKB: 18,
  },
  {
    id: 'modular/column_1',
    path: '/models/environment/modular/Column_1.glb',
    category: 'model',
    sizeKB: 8,
  },
  {
    id: 'modular/computer_sm',
    path: '/models/environment/modular/Props_ComputerSmall.glb',
    category: 'model',
    sizeKB: 38,
  },
  {
    id: 'modular/computer',
    path: '/models/environment/modular/Props_Computer.glb',
    category: 'model',
    sizeKB: 42,
  },
  {
    id: 'modular/crate',
    path: '/models/environment/modular/Props_Crate.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/crate_long',
    path: '/models/environment/modular/Props_CrateLong.glb',
    category: 'model',
    sizeKB: 20,
  },
  {
    id: 'modular/shelf',
    path: '/models/environment/modular/Props_Shelf.glb',
    category: 'model',
    sizeKB: 14,
  },
  {
    id: 'modular/details_plate_large',
    path: '/models/environment/modular/Details_Plate_Large.glb',
    category: 'model',
    sizeKB: 10,
  },
  {
    id: 'modular/details_vent_1',
    path: '/models/environment/modular/Details_Vent_1.glb',
    category: 'model',
    sizeKB: 8,
  },
  {
    id: 'modular/pipes',
    path: '/models/environment/modular/Pipes.glb',
    category: 'model',
    sizeKB: 15,
  },
];

// ============================================================================
// COMBINED ASSET LIST
// ============================================================================

export const EXTRACTION_ASSETS: AssetEntry[] = [
  ...EXTRACTION_PROPS,
  ...EXTRACTION_TEXTURES,
  ...EXTRACTION_FENCES,
  ...EXTRACTION_MODULAR,
];

// ============================================================================
// LEVEL MANIFEST - Loading priorities
// ============================================================================

export const EXTRACTION_MANIFEST: LevelManifest = {
  levelId: 'extraction',

  required: [
    'enemy/spider',
    'enemy/scout',
    'enemy/soldier',
    'vehicle/phantom',
  ],

  preload: [
    // Enemies
    'enemy/flyingalien',
    // Fences (perimeter defense)
    'fence/b_1',
    'fence/b_pillar',
    'fence/e_1',
    'fence/e_2',
    'fence/e_pillar',
    'fence/e_corner',
    // Props (infrastructure)
    'prop/extraction/pipe_1',
    'prop/extraction/pipe_2',
    'prop/extraction/elec_1',
    'prop/extraction/lamp_off',
    'prop/extraction/concrete_block',
    // Modular buildings (LZ control structures)
    'modular/window_wall_a',
    'modular/window_wall_b',
    'modular/3win_wall_a',
    'modular/wall_empty',
    'modular/door_single_wall_a',
    'modular/floor_basic',
    'modular/roof_plate2',
    'modular/roof_vents',
    'modular/column_1',
    'modular/computer_sm',
    'modular/crate',
    // Textures
    'tex/extraction/ground',
    'tex/extraction/painted',
    'tex/extraction/asphalt',
    'tex/extraction/skybox',
  ],

  deferred: [
    'enemy/alienmonster',
    // Additional props
    'prop/extraction/pipe_3',
    'prop/extraction/pipe_4',
    'prop/extraction/gear_1',
    'prop/extraction/gear_2',
    'prop/extraction/radio',
    // Additional modular pieces
    'modular/3win_wall_b',
    'modular/floor_empty',
    'modular/roof_empty',
    'modular/computer',
    'modular/crate_long',
    'modular/shelf',
    'modular/details_plate_large',
    'modular/details_vent_1',
    'modular/pipes',
    // PBR normal/roughness maps
    'tex/extraction/ground_normal',
    'tex/extraction/ground_roughness',
    'tex/extraction/painted_normal',
    'tex/extraction/painted_roughness',
    'tex/extraction/rubber',
    'tex/extraction/rubber_normal',
    'tex/extraction/rubber_roughness',
    'tex/extraction/asphalt_normal',
    'tex/extraction/asphalt_roughness',
  ],
};

// ============================================================================
// MISSING ASSETS
// ============================================================================

/**
 * MISSING ASSETS - Extraction site details
 *
 * LANDING ZONE:
 * - Landing pad mesh (circle with painted markings)
 * - Dropship landing gear marks / scorch marks decal
 * - Flare stand / signal flare launcher model
 *
 * DEFENSIVE POSITION:
 * - Sandbag circle fortification
 * - Razor wire / concertina wire barrier
 * - Ammunition crate stack
 * - Cargo net / supply drop model
 *
 * EQUIPMENT:
 * - Portable generator model
 * - Radio antenna / comms mast
 * - Spotlight / searchlight on tripod
 */
