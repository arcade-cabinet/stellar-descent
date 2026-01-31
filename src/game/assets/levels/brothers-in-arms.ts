/**
 * Brothers in Arms - Level Asset Manifest
 *
 * Open battlefield environment with dust storm.
 * Reunite with Corporal Marcus Cole and his mech.
 * Surface combat with reduced visibility and military debris.
 *
 * BATTLEFIELD LAYOUT:
 * GLB-based cover positions at close/mid/far ranges form a Halo Reach
 * "Tip of the Spear" style arena. Assets are loaded by BattlefieldEnvironment.ts
 * using path-based AssetManager calls (loadAssetByPath / createInstanceByPath).
 */

import type { AssetEntry, LevelManifest } from '../types';

/**
 * Asset entries specific to Brothers in Arms level
 */
export const BROTHERS_IN_ARMS_ASSETS: AssetEntry[] = [
  // -----------------------------------------------------------------------
  // Environment Models (exclusive to this level)
  // -----------------------------------------------------------------------
  {
    id: 'industrial/storage_tank',
    path: '/models/environment/industrial/storage_tank_mx_1.glb',
    category: 'model',
    sizeKB: 400,
  },
  {
    id: 'industrial/electrical_2',
    path: '/models/environment/industrial/electrical_equipment_2.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'industrial/shipping_container',
    path: '/models/environment/industrial/shipping_container_mx_1.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'industrial/shipping_container_hollow',
    path: '/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
    category: 'model',
    sizeKB: 550,
  },

  // Atmospheric (exclusive)
  {
    id: 'atmospheric/hallway_3',
    path: '/models/props/atmospheric/hallway 3.glb',
    category: 'model',
    sizeKB: 4363,
  },

  // -----------------------------------------------------------------------
  // Props (battlefield debris and supplies)
  // -----------------------------------------------------------------------
  {
    id: 'prop/gravel_2',
    path: '/models/props/debris/gravel_pile_hr_2.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'prop/brick_stack',
    path: '/models/props/debris/bricks_stacked_mx_1.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'prop/wooden_crate',
    path: '/models/props/containers/wooden_crate_1.glb',
    category: 'model',
    sizeKB: 948,
  },
  {
    id: 'prop/metal_barrel_1',
    path: '/models/props/containers/metal_barrel_hr_1.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/metal_barrel_2',
    path: '/models/props/containers/metal_barrel_hr_2.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/scrap_metal',
    path: '/models/props/containers/scrap_metal_mx_1.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'prop/cement_bags',
    path: '/models/props/containers/cement_bags_mp_1_pallet_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'prop/jerrycan',
    path: '/models/props/containers/jerrycan_mx_1.glb',
    category: 'model',
    sizeKB: 80,
  },
  {
    id: 'prop/tire',
    path: '/models/props/containers/tire_1.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'prop/toolbox',
    path: '/models/props/containers/toolbox_mx_1.glb',
    category: 'model',
    sizeKB: 90,
  },

  // -----------------------------------------------------------------------
  // Fencing / perimeter
  // -----------------------------------------------------------------------
  {
    id: 'fence/concrete_1',
    path: '/models/props/modular/concrete_fence_hr_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'fence/metal_1',
    path: '/models/props/modular/metal_fence_hr_1.glb',
    category: 'model',
    sizeKB: 150,
  },

  // -----------------------------------------------------------------------
  // Textures (exclusive)
  // -----------------------------------------------------------------------
  {
    id: 'tex/brothers/ground',
    path: '/textures/levels/brothers-in-arms/Ground078_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/ground_normal',
    path: '/textures/levels/brothers-in-arms/Ground078_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/ground_roughness',
    path: '/textures/levels/brothers-in-arms/Ground078_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/sheet_metal',
    path: '/textures/levels/brothers-in-arms/SheetMetal002_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/sheet_metal_normal',
    path: '/textures/levels/brothers-in-arms/SheetMetal002_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/sheet_metal_roughness',
    path: '/textures/levels/brothers-in-arms/SheetMetal002_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/scratches',
    path: '/textures/levels/brothers-in-arms/Scratches003_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/scratches_normal',
    path: '/textures/levels/brothers-in-arms/Scratches003_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/scratches_roughness',
    path: '/textures/levels/brothers-in-arms/Scratches003_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/diamond',
    path: '/textures/levels/brothers-in-arms/DiamondPlate003_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/diamond_normal',
    path: '/textures/levels/brothers-in-arms/DiamondPlate003_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/diamond_roughness',
    path: '/textures/levels/brothers-in-arms/DiamondPlate003_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/brothers/skybox',
    path: '/textures/levels/brothers-in-arms/skybox.exr',
    category: 'texture',
    sizeKB: 2000,
  },

  // -----------------------------------------------------------------------
  // Barricades (military defensive positions -- all 4 b-variants + 2 a-variants)
  // -----------------------------------------------------------------------
  {
    id: 'barricade/b_1',
    path: '/models/props/modular/barricade_b_1.glb',
    category: 'model',
    sizeKB: 218,
  },
  {
    id: 'barricade/b_2',
    path: '/models/props/modular/barricade_b_2.glb',
    category: 'model',
    sizeKB: 211,
  },
  {
    id: 'barricade/b_3',
    path: '/models/props/modular/barricade_b_3.glb',
    category: 'model',
    sizeKB: 291,
  },
  {
    id: 'barricade/b_4',
    path: '/models/props/modular/barricade_b_4.glb',
    category: 'model',
    sizeKB: 478,
  },
  {
    id: 'barricade/a_1',
    path: '/models/props/modular/barricade_a_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'barricade/a_2',
    path: '/models/props/modular/barricade_a_2.glb',
    category: 'model',
    sizeKB: 195,
  },

  // -----------------------------------------------------------------------
  // Station external (burning station visible on horizon)
  // -----------------------------------------------------------------------
  {
    id: 'station-ext/station03b',
    path: '/models/environment/station-external/station03.glb',
    category: 'model',
    sizeKB: 769,
  },

  // -----------------------------------------------------------------------
  // Industrial structures (battlefield landmarks)
  // -----------------------------------------------------------------------
  {
    id: 'station/water_tower',
    path: '/models/environment/industrial/water_tower_hm_1.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'station/platform',
    path: '/models/environment/industrial/platform_mx_1.glb',
    category: 'model',
    sizeKB: 498,
  },
  {
    id: 'station/boiler',
    path: '/models/environment/industrial/boiler_hx_4.glb',
    category: 'model',
    sizeKB: 400,
  },

  // -----------------------------------------------------------------------
  // Decals (military posters on barricade surfaces)
  // -----------------------------------------------------------------------
  {
    id: 'decal/poster_5',
    path: '/models/props/decals/poster_cx_5.glb',
    category: 'model',
    sizeKB: 68,
  },
  {
    id: 'decal/poster_9',
    path: '/models/props/decals/poster_cx_9.glb',
    category: 'model',
    sizeKB: 43,
  },

  // -----------------------------------------------------------------------
  // Spaceships (environmental backdrop, exclusive)
  // -----------------------------------------------------------------------
  {
    id: 'spaceship/insurgent',
    path: '/models/spaceships/Insurgent.glb',
    category: 'model',
    sizeKB: 3500,
  },
  {
    id: 'spaceship/striker',
    path: '/models/spaceships/Striker.glb',
    category: 'model',
    sizeKB: 3000,
  },
];

/**
 * Level manifest defining loading strategy for Brothers in Arms
 *
 * Loading priority:
 * - Required: Must load before gameplay (blocks loading screen)
 * - Preload: Load during loading screen (high priority)
 * - Deferred: Stream during gameplay (low priority)
 */
export const BROTHERS_IN_ARMS_MANIFEST: LevelManifest = {
  levelId: 'brothers_in_arms',

  // Critical assets - must be loaded before level starts
  // These block the loading screen until loaded
  required: [
    // Enemy models for wave combat
    'enemy/flyingalien', // Drone enemies
    'enemy/scout', // Grunt enemies
    'enemy/soldier', // Spitter enemies
    'enemy/alienmonster', // Brute enemies
    // Marcus mech - central to the level
    'vehicle/marcus_mech',
  ],

  // High-priority assets - loaded during initial loading screen
  preload: [
    // Additional enemy variants
    'enemy/spider',
    'enemy/alienmale',

    // Vehicles (backdrop)
    'vehicle/wraith',

    // Environment models
    'industrial/storage_tank',
    'industrial/electrical_2',
    'industrial/shipping_container',
    'industrial/shipping_container_hollow',

    // Atmospheric
    'atmospheric/hallway_3',

    // Barricades (all variants for battlefield cover)
    'barricade/b_1',
    'barricade/b_2',
    'barricade/b_3',
    'barricade/b_4',
    'barricade/a_1',
    'barricade/a_2',

    // Industrial structures (landmarks)
    'station/water_tower',
    'station/platform',
    'station/boiler',

    // Battlefield props
    'prop/wooden_crate',
    'prop/metal_barrel_1',
    'prop/metal_barrel_2',
    'prop/scrap_metal',
    'prop/cement_bags',

    // Fencing
    'fence/concrete_1',
    'fence/metal_1',

    // Spaceships (backdrop)
    'spaceship/insurgent',
    'spaceship/striker',

    // Textures
    'tex/brothers/ground',
    'tex/brothers/ground_normal',
    'tex/brothers/ground_roughness',
    'tex/brothers/sheet_metal',
    'tex/brothers/sheet_metal_normal',
    'tex/brothers/sheet_metal_roughness',
    'tex/brothers/scratches',
    'tex/brothers/scratches_normal',
    'tex/brothers/scratches_roughness',
    'tex/brothers/diamond',
    'tex/brothers/diamond_normal',
    'tex/brothers/diamond_roughness',
    'tex/brothers/skybox',
  ],

  // Lower-priority assets - can stream in during gameplay
  deferred: [
    'enemy/alienmale',
    'prop/gravel_2',
    'prop/brick_stack',
    'prop/jerrycan',
    'prop/tire',
    'prop/toolbox',
    'station-ext/station03b',
    'decal/poster_5',
    'decal/poster_9',
  ],
};
