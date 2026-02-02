import type { AssetEntry, LevelManifest } from '../types';

/**
 * Hive Assault - Combined Arms Push from Surface into Hive
 *
 * ATMOSPHERE: Transition zone. Military forward operating base on surface
 * gives way to alien hive entrance underground. Twilight sky above, spore-filled air.
 * Players push from a fortified position into organic alien territory.
 */

export const HIVE_ASSAULT_ASSETS: AssetEntry[] = [
  // ============================================================================
  // ENVIRONMENT MODELS - Modular Forward Base Structures
  // ============================================================================
  {
    id: 'modular/wall_a',
    path: '/assets/models/environment/modular/Wall_1.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'modular/wall_b',
    path: '/assets/models/environment/modular/Wall_2.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'modular/floor_a',
    path: '/assets/models/environment/modular/FloorTile_Basic.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'modular/door_a',
    path: '/assets/models/environment/modular/Door_Single.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'modular/column_a',
    path: '/assets/models/environment/modular/Column_1.glb',
    category: 'model',
    sizeKB: 150,
  },

  // ============================================================================
  // ATMOSPHERIC MODELS
  // ============================================================================
  {
    id: 'atmospheric/hallway_4',
    path: '/assets/models/props/atmospheric/hallway 4.glb',
    category: 'model',
    sizeKB: 4355,
  },

  // ============================================================================
  // TEXTURES - Hive Assault Exclusive
  // ============================================================================
  {
    id: 'tex/assault/diamond',
    path: '/assets/textures/levels/hive-assault/DiamondPlate005A_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/diamond_normal',
    path: '/assets/textures/levels/hive-assault/DiamondPlate005A_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/diamond_roughness',
    path: '/assets/textures/levels/hive-assault/DiamondPlate005A_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/assault/concrete',
    path: '/assets/textures/levels/hive-assault/Concrete018_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/concrete_normal',
    path: '/assets/textures/levels/hive-assault/Concrete018_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/concrete_roughness',
    path: '/assets/textures/levels/hive-assault/Concrete018_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/assault/metal',
    path: '/assets/textures/levels/hive-assault/Metal014_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/metal_normal',
    path: '/assets/textures/levels/hive-assault/Metal014_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/metal_roughness',
    path: '/assets/textures/levels/hive-assault/Metal014_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/metal_metalness',
    path: '/assets/textures/levels/hive-assault/Metal014_1K-JPG_Metalness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/assault/painted',
    path: '/assets/textures/levels/hive-assault/PaintedMetal003_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/painted_normal',
    path: '/assets/textures/levels/hive-assault/PaintedMetal003_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/assault/painted_roughness',
    path: '/assets/textures/levels/hive-assault/PaintedMetal003_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/assault/skybox',
    path: '/assets/textures/levels/hive-assault/skybox.exr',
    category: 'texture',
    sizeKB: 2000,
  },

  // ============================================================================
  // SPACESHIPS - Environmental Backdrop
  // ============================================================================
  {
    id: 'spaceship/imperial',
    path: '/assets/models/spaceships/Imperial.glb',
    category: 'model',
    sizeKB: 3500,
  },
  {
    id: 'spaceship/executioner',
    path: '/assets/models/spaceships/Executioner.glb',
    category: 'model',
    sizeKB: 3500,
  },

  // ============================================================================
  // QUATERNIUS MODULAR - Forward Base Structures
  // ============================================================================
  {
    id: 'modular/wall_5',
    path: '/assets/models/environment/modular/Wall_5.glb',
    category: 'model',
    sizeKB: 63,
  },
  {
    id: 'modular/door_dbl_long_a',
    path: '/assets/models/environment/modular/DoorDoubleLong_Wall_SideA.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/door_sgl_long_a',
    path: '/assets/models/environment/modular/DoorSingleLong_Wall_SideA.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/door_sgl_wall_a',
    path: '/assets/models/environment/modular/DoorSingle_Wall_SideA.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/door_sgl_wall_b',
    path: '/assets/models/environment/modular/DoorSingle_Wall_SideB.glb',
    category: 'model',
    sizeKB: 11,
  },
  {
    id: 'modular/column_slim',
    path: '/assets/models/environment/modular/Column_Slim.glb',
    category: 'model',
    sizeKB: 14,
  },
  {
    id: 'modular/roof_corner_pipes',
    path: '/assets/models/environment/modular/RoofTile_Corner_Pipes.glb',
    category: 'model',
    sizeKB: 27,
  },
  {
    id: 'modular/roof_inner_pipes',
    path: '/assets/models/environment/modular/RoofTile_InnerCorner_Pipes.glb',
    category: 'model',
    sizeKB: 27,
  },
  {
    id: 'modular/roof_sides_pipes',
    path: '/assets/models/environment/modular/RoofTile_Sides_Pipes.glb',
    category: 'model',
    sizeKB: 18,
  },
  {
    id: 'modular/roof_orange_vent',
    path: '/assets/models/environment/modular/RoofTile_OrangeVent.glb',
    category: 'model',
    sizeKB: 14,
  },
  {
    id: 'modular/roof_vents',
    path: '/assets/models/environment/modular/RoofTile_Vents.glb',
    category: 'model',
    sizeKB: 63,
  },
  {
    id: 'modular/pipes',
    path: '/assets/models/environment/modular/Pipes.glb',
    category: 'model',
    sizeKB: 13,
  },
  {
    id: 'modular/base',
    path: '/assets/models/environment/modular/Props_Base.glb',
    category: 'model',
    sizeKB: 28,
  },
  {
    id: 'modular/container_full',
    path: '/assets/models/environment/modular/Props_ContainerFull.glb',
    category: 'model',
    sizeKB: 236,
  },
  {
    id: 'modular/chest',
    path: '/assets/models/environment/modular/Props_Chest.glb',
    category: 'model',
    sizeKB: 229,
  },
  {
    id: 'modular/detail_output',
    path: '/assets/models/environment/modular/Details_Output.glb',
    category: 'model',
    sizeKB: 12,
  },
  {
    id: 'modular/detail_output_sm',
    path: '/assets/models/environment/modular/Details_Output_Small.glb',
    category: 'model',
    sizeKB: 6,
  },

  // ============================================================================
  // DECALS - Forward Base Signage
  // ============================================================================
  {
    id: 'decal/poster_15',
    path: '/assets/models/props/decals/poster_cx_15.glb',
    category: 'model',
    sizeKB: 43,
  },
  {
    id: 'decal/poster_16',
    path: '/assets/models/props/decals/poster_cx_16.glb',
    category: 'model',
    sizeKB: 36,
  },

  // ============================================================================
  // STATION EXTERNAL - Command Station Backdrop
  // ============================================================================
  {
    id: 'station-ext/station06',
    path: '/assets/models/environment/station-external/station06.glb',
    category: 'model',
    sizeKB: 366,
  },
];

/**
 * Level Manifest for Hive Assault
 *
 * REQUIRED: Core enemies and player vehicle for combined arms assault
 * PRELOAD: Structures, support vehicles, base modules, textures for smooth gameplay
 * DEFERRED: Large atmospheric pieces and special aliens that appear later
 */
export const HIVE_ASSAULT_MANIFEST: LevelManifest = {
  levelId: 'hive_assault',

  required: [
    // Core enemies - infantry units
    'enemy/spider',
    'enemy/scout',
    'enemy/soldier',
    'enemy/tentakel',

    // Hive structure
    'structure/brain',

    // Player vehicle
    'vehicle/marcus_mech',
  ],

  preload: [
    // Alien structures
    'structure/birther',
    'structure/claw',
    'structure/crystals',

    // Support vehicles
    'vehicle/wraith',
    'vehicle/phantom',

    // Forward base modular pieces
    'modular/wall_a',
    'modular/wall_b',
    'modular/floor_a',
    'modular/door_a',
    'modular/column_a',

    // All textures for military-hive transition
    'tex/assault/diamond',
    'tex/assault/diamond_normal',
    'tex/assault/diamond_roughness',
    'tex/assault/concrete',
    'tex/assault/concrete_normal',
    'tex/assault/concrete_roughness',
    'tex/assault/metal',
    'tex/assault/metal_normal',
    'tex/assault/metal_roughness',
    'tex/assault/metal_metalness',
    'tex/assault/painted',
    'tex/assault/painted_normal',
    'tex/assault/painted_roughness',
    'tex/assault/skybox',

    // Environmental backdrop spaceships
    'spaceship/imperial',
    'spaceship/executioner',

    // Quaternius modular forward base structures
    'modular/wall_5',
    'modular/column_slim',
    'modular/door_sgl_wall_a',
    'modular/roof_corner_pipes',
    'modular/roof_vents',
    'modular/pipes',
    'modular/base',
    'modular/container_full',
    'modular/chest',

    // Command station backdrop
    'station-ext/station06',
  ],

  deferred: [
    // Special alien variants appearing later in assault
    'enemy/alienmonster',
    'enemy/alienmale',
    'enemy/alienfemale',

    // Large atmospheric piece for interior sections
    'atmospheric/hallway_4',

    // Deferred modular forward base pieces
    'modular/door_dbl_long_a',
    'modular/door_sgl_long_a',
    'modular/door_sgl_wall_b',
    'modular/roof_inner_pipes',
    'modular/roof_sides_pipes',
    'modular/roof_orange_vent',
    'modular/detail_output',
    'modular/detail_output_sm',

    // Forward base signage decals
    'decal/poster_15',
    'decal/poster_16',
  ],
};

/**
 * MISSING ASSETS - Future Enhancement Opportunities
 *
 * FORWARD OPERATING BASE:
 * - Sandbag fortification circle model (defensive positions)
 * - Anti-air turret / defense gun emplacement (base defense)
 * - Command tent / field HQ prefab (operational center)
 * - Ammunition dump / supply stack (resource staging)
 * - Forward barricade / concrete barrier (perimeter security)
 * - Military camo netting (concealment)
 * - Field communications array (antenna towers, dishes)
 *
 * TRANSITION ELEMENTS:
 * - Hive entrance tunnel mesh (transition from surface to underground)
 * - Spore-covered military equipment (alien corruption spreading)
 * - Medical tent / triage station (casualty handling)
 * - Landing zone markers (air support coordination)
 * - Blast walls (protection from hive counterattacks)
 *
 * ENVIRONMENTAL STORYTELLING:
 * - Damaged/destroyed base sections (previous assault evidence)
 * - Emergency lighting rigs (twilight/underground illumination)
 * - Biohazard containment equipment (spore protection)
 * - Scout observation post (forward reconnaissance)
 */

// Additional marine NPC assets for squad variety
export const MARINE_ASSETS: AssetEntry[] = [
  {
    id: 'npc/marine_soldier',
    path: '/assets/models/npcs/marine/marine_soldier.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'npc/marine_sergeant',
    path: '/assets/models/npcs/marine/marine_sergeant.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'npc/marine_elite',
    path: '/assets/models/npcs/marine/marine_elite.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'npc/marine_crusader',
    path: '/assets/models/npcs/marine/marine_crusader.glb',
    category: 'model',
    sizeKB: 500,
  },
];

// Vehicle assets for combined arms
export const VEHICLE_ASSETS: AssetEntry[] = [
  {
    id: 'vehicle/marcus_mech',
    path: '/assets/models/vehicles/marcus_mech.glb',
    category: 'model',
    sizeKB: 2000,
  },
  {
    id: 'vehicle/player_warthog',
    path: '/assets/models/vehicles/chitin/wraith.glb',
    category: 'model',
    sizeKB: 1500,
  },
];
