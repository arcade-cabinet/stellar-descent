import type { AssetEntry, LevelManifest } from '../types';

/**
 * LANDFALL - First Surface Combat
 *
 * The player HALO drops from orbit onto the alien planet surface.
 * Dusty canyon environment with warm tones, rocky terrain, and scattered
 * industrial containers for cover. First outdoor combat encounter.
 *
 * ATMOSPHERE: Dry alien canyon, warm lighting, industrial landing zone
 */

export const LANDFALL_ASSETS: AssetEntry[] = [
  // =========================================================================
  // ENVIRONMENT MODELS - Industrial structures for the landing zone
  // =========================================================================
  {
    id: 'industrial/shipping_container',
    path: '/assets/models/environment/industrial/shipping_container_mx_1.glb',
    category: 'model',
    sizeKB: 4960,
  },
  {
    id: 'industrial/shipping_container_hollow',
    path: '/assets/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
    category: 'model',
    sizeKB: 5000,
  },
  {
    id: 'industrial/shipping_container_2',
    path: '/assets/models/environment/industrial/shipping_container_mx_2.glb',
    category: 'model',
    sizeKB: 4800,
  },
  {
    id: 'industrial/water_tower',
    path: '/assets/models/environment/industrial/water_tower_hm_1.glb',
    category: 'model',
    sizeKB: 600,
  },
  {
    id: 'industrial/storage_tank',
    path: '/assets/models/environment/industrial/storage_tank_mx_1.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'industrial/platform',
    path: '/assets/models/environment/industrial/platform_mx_1.glb',
    category: 'model',
    sizeKB: 400,
  },
  {
    id: 'industrial/chimney_1',
    path: '/assets/models/environment/industrial/chimney_a_1.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'industrial/chimney_2',
    path: '/assets/models/environment/industrial/chimney_a_2.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'industrial/pipes',
    path: '/assets/models/environment/industrial/pipes_hr_1.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'industrial/pipes_elbow',
    path: '/assets/models/environment/industrial/pipes_hr_1_elbow_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'industrial/warehouse',
    path: '/assets/models/environment/industrial/warehouse_hl_1.glb',
    category: 'model',
    sizeKB: 800,
  },
  {
    id: 'industrial/electrical_1',
    path: '/assets/models/environment/industrial/electrical_equipment_1.glb',
    category: 'model',
    sizeKB: 350,
  },
  {
    id: 'industrial/machinery',
    path: '/assets/models/environment/industrial/machinery_mx_1.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'industrial/cage',
    path: '/assets/models/environment/industrial/cage_mx_1.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'industrial/boiler',
    path: '/assets/models/environment/industrial/boiler_hx_4.glb',
    category: 'model',
    sizeKB: 400,
  },

  // =========================================================================
  // PROPS - Surface scatter objects
  // =========================================================================
  {
    id: 'prop/gas_cylinder',
    path: '/assets/models/props/containers/gas_cylinder_mx_1.glb',
    category: 'model',
    sizeKB: 505,
  },
  {
    id: 'prop/jerrycan',
    path: '/assets/models/props/containers/jerrycan_mx_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'prop/cement_pallet',
    path: '/assets/models/props/containers/cement_bags_mp_1_pallet_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'prop/metal_barrel_1',
    path: '/assets/models/props/containers/metal_barrel_hr_1.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'prop/metal_barrel_2',
    path: '/assets/models/props/containers/metal_barrel_hr_2.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'prop/metal_barrel_3',
    path: '/assets/models/props/containers/metal_barrel_hr_3.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'prop/wooden_crate_1',
    path: '/assets/models/props/containers/wooden_crate_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'prop/wooden_crate_2',
    path: '/assets/models/props/containers/wooden_crate_2_a.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'prop/scrap_metal_1',
    path: '/assets/models/props/containers/scrap_metal_mx_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'prop/scrap_metal_2',
    path: '/assets/models/props/containers/scrap_metal_mx_1_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'prop/tire_1',
    path: '/assets/models/props/containers/tire_1.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'prop/wooden_plank_1',
    path: '/assets/models/props/containers/wooden_plank_1.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'prop/wooden_plank_2',
    path: '/assets/models/props/containers/wooden_plank_2.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'prop/toolbox',
    path: '/assets/models/props/containers/toolbox_mx_1.glb',
    category: 'model',
    sizeKB: 150,
  },

  // =========================================================================
  // BARRICADES & FENCES - Surface defense structures
  // =========================================================================
  {
    id: 'barricade/a_1',
    path: '/assets/models/props/modular/barricade_a_1.glb',
    category: 'model',
    sizeKB: 221,
  },
  {
    id: 'barricade/a_2',
    path: '/assets/models/props/modular/barricade_a_2.glb',
    category: 'model',
    sizeKB: 214,
  },
  {
    id: 'barricade/a_3',
    path: '/assets/models/props/modular/barricade_a_3.glb',
    category: 'model',
    sizeKB: 191,
  },
  {
    id: 'barricade/b_1',
    path: '/assets/models/props/modular/barricade_b_1.glb',
    category: 'model',
    sizeKB: 220,
  },
  {
    id: 'barricade/b_2',
    path: '/assets/models/props/modular/barricade_b_2.glb',
    category: 'model',
    sizeKB: 210,
  },
  {
    id: 'fence/a_1',
    path: '/assets/models/props/modular/fence_a_1.glb',
    category: 'model',
    sizeKB: 73,
  },
  {
    id: 'fence/concrete_1',
    path: '/assets/models/props/modular/concrete_fence_hr_1.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'fence/concrete_pillar',
    path: '/assets/models/props/modular/concrete_fence_hr_1_pillar_1.glb',
    category: 'model',
    sizeKB: 100,
  },

  // =========================================================================
  // STATION EXTERNAL - Crashed orbital station visible in sky
  // =========================================================================
  {
    id: 'station-ext/station02',
    path: '/assets/models/environment/station-external/station02.glb',
    category: 'model',
    sizeKB: 390,
  },
  {
    id: 'station-ext/station04',
    path: '/assets/models/environment/station-external/station04.glb',
    category: 'model',
    sizeKB: 400,
  },

  // =========================================================================
  // STATION PIECES - Landing zone surfaces & wrecked infrastructure
  // =========================================================================
  {
    id: 'station/asphalt_1',
    path: '/assets/models/environment/station/asphalt_hr_1.glb',
    category: 'model',
    sizeKB: 518,
  },
  {
    id: 'station/asphalt_1_large',
    path: '/assets/models/environment/station/asphalt_hr_1_large.glb',
    category: 'model',
    sizeKB: 519,
  },
  {
    id: 'station/asphalt_2',
    path: '/assets/models/environment/station/asphalt_hr_2.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'station/asphalt_3',
    path: '/assets/models/environment/station/asphalt_hr_3.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'station/platform_large',
    path: '/assets/models/environment/station/platform_large_mx_1.glb',
    category: 'model',
    sizeKB: 498,
  },
  {
    id: 'station/platform_small',
    path: '/assets/models/environment/station/platform_small_mx_1.glb',
    category: 'model',
    sizeKB: 498,
  },
  {
    id: 'station/beam_horizontal_1',
    path: '/assets/models/environment/station/beam_hc_horizontal_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/beam_horizontal_2',
    path: '/assets/models/environment/station/beam_hc_horizontal_2.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/beam_vertical_1',
    path: '/assets/models/environment/station/beam_hc_vertical_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/beam_rtx_1',
    path: '/assets/models/environment/station/beam_rtx_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/concrete_pipe_end',
    path: '/assets/models/environment/station/concrete_pipe_hm_1_end.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'station/concrete_pipe_middle',
    path: '/assets/models/environment/station/concrete_pipe_hm_1_middle.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'station/doorway_1',
    path: '/assets/models/environment/station/doorway_hr_1.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'station/warehouse_1',
    path: '/assets/models/environment/station/warehouse_mx_1.glb',
    category: 'model',
    sizeKB: 600,
  },
  {
    id: 'station/warehouse_2',
    path: '/assets/models/environment/station/warehouse_mx_2.glb',
    category: 'model',
    sizeKB: 600,
  },

  // =========================================================================
  // MODULAR SCI-FI PIECES - Crashed station debris scattered on surface
  // =========================================================================
  {
    id: 'modular/column_1',
    path: '/assets/models/environment/modular/Column_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'modular/column_2',
    path: '/assets/models/environment/modular/Column_2.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'modular/props_crate',
    path: '/assets/models/environment/modular/Props_Crate.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'modular/props_crate_long',
    path: '/assets/models/environment/modular/Props_CrateLong.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'modular/props_container',
    path: '/assets/models/environment/modular/Props_ContainerFull.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'modular/props_pod',
    path: '/assets/models/environment/modular/Props_Pod.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'modular/pipes',
    path: '/assets/models/environment/modular/Pipes.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'modular/details_pipes_long',
    path: '/assets/models/environment/modular/Details_Pipes_Long.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'modular/details_plate_large',
    path: '/assets/models/environment/modular/Details_Plate_Large.glb',
    category: 'model',
    sizeKB: 120,
  },

  // TEXTURES - Canyon terrain materials
  {
    id: 'tex/landfall/ground',
    path: '/assets/textures/levels/landfall/Ground037_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/ground_normal',
    path: '/assets/textures/levels/landfall/Ground037_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/ground_roughness',
    path: '/assets/textures/levels/landfall/Ground037_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/landfall/rock',
    path: '/assets/textures/levels/landfall/Rock022_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/rock_normal',
    path: '/assets/textures/levels/landfall/Rock022_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/rock_roughness',
    path: '/assets/textures/levels/landfall/Rock022_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/landfall/gravel',
    path: '/assets/textures/levels/landfall/Gravel019_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/gravel_normal',
    path: '/assets/textures/levels/landfall/Gravel019_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/gravel_roughness',
    path: '/assets/textures/levels/landfall/Gravel019_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  {
    id: 'tex/landfall/asphalt',
    path: '/assets/textures/levels/landfall/Asphalt003_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/asphalt_normal',
    path: '/assets/textures/levels/landfall/Asphalt003_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/landfall/asphalt_roughness',
    path: '/assets/textures/levels/landfall/Asphalt003_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,
  },

  // SKYBOX - Alien planet atmosphere
  {
    id: 'tex/landfall/skybox',
    path: '/assets/textures/levels/landfall/skybox.exr',
    category: 'texture',
    sizeKB: 2000,
  },
];

export const LANDFALL_MANIFEST: LevelManifest = {
  levelId: 'landfall',

  // First enemies encountered on the surface
  required: ['enemy/spider', 'enemy/scout'],

  // Preload core environment and vehicles for dramatic entrance
  preload: [
    // Vehicles for distant threat silhouettes during descent
    'vehicle/wraith',
    'vehicle/phantom',

    // Primary structural pieces visible on landing
    'station-ext/station02',
    'station/asphalt_1',
    'station/asphalt_1_large',
    'station/platform_large',
    'station/warehouse_1',
    'station/beam_horizontal_1',
    'station/concrete_pipe_end',

    // Industrial landmarks
    'industrial/shipping_container',
    'industrial/shipping_container_hollow',
    'industrial/water_tower',
    'industrial/storage_tank',
    'industrial/warehouse',
    'industrial/chimney_1',

    // Combat cover - barricades around LZ
    'barricade/a_1',
    'barricade/a_2',
    'barricade/b_1',

    // Modular sci-fi crash debris
    'modular/props_crate',
    'modular/props_container',
    'modular/props_pod',
    'modular/pipes',
    'modular/details_plate_large',

    // Textures
    'tex/landfall/ground',
    'tex/landfall/ground_normal',
    'tex/landfall/ground_roughness',
    'tex/landfall/rock',
    'tex/landfall/rock_normal',
    'tex/landfall/rock_roughness',
    'tex/landfall/gravel',
    'tex/landfall/gravel_normal',
    'tex/landfall/gravel_roughness',
    'tex/landfall/asphalt',
    'tex/landfall/asphalt_normal',
    'tex/landfall/asphalt_roughness',
    'tex/landfall/skybox',
  ],

  // Deferred props and additional enemies
  deferred: [
    'barricade/a_3',
    'barricade/b_2',
    'fence/a_1',
    'fence/concrete_1',
    'fence/concrete_pillar',
    'station/asphalt_2',
    'station/asphalt_3',
    'station/platform_small',
    'station/beam_horizontal_2',
    'station/beam_vertical_1',
    'station/beam_rtx_1',
    'station/concrete_pipe_middle',
    'station/doorway_1',
    'station/warehouse_2',
    'station-ext/station04',
    'industrial/shipping_container_2',
    'industrial/platform',
    'industrial/chimney_2',
    'industrial/pipes',
    'industrial/pipes_elbow',
    'industrial/electrical_1',
    'industrial/machinery',
    'industrial/cage',
    'industrial/boiler',
    'modular/column_1',
    'modular/column_2',
    'modular/props_crate_long',
    'modular/details_pipes_long',
    'enemy/alienmale',
    'prop/gas_cylinder',
    'prop/jerrycan',
    'prop/cement_pallet',
    'prop/metal_barrel_1',
    'prop/metal_barrel_2',
    'prop/metal_barrel_3',
    'prop/wooden_crate_1',
    'prop/wooden_crate_2',
    'prop/scrap_metal_1',
    'prop/scrap_metal_2',
    'prop/tire_1',
    'prop/wooden_plank_1',
    'prop/wooden_plank_2',
    'prop/toolbox',
  ],
};

/*
 * MISSING ASSETS - Required for full Landfall experience:
 *
 * CRITICAL:
 * - Drop pod wreckage model (player lands in one)
 * - Landing zone beacon / marker model (objective marker)
 *
 * ENVIRONMENT:
 * - Canyon rock wall formations (large cliff meshes for boundaries)
 * - Rocky outcrop / boulder models for natural cover
 * - Canyon floor variations (cracked ground, blast craters)
 *
 * PROPS:
 * - Supply cache / ammo crate model (resupply point)
 * - Crashed satellite / orbital debris (environmental storytelling)
 *
 * ATMOSPHERE:
 * - Alien plant/vegetation scatter models (sparse alien flora)
 * - Dust devil particle emitter mesh (atmospheric effect)
 * - Wind streak particle effects (dusty atmosphere)
 * - Heat distortion shader material
 *
 * AUDIO:
 * - Wind ambience (canyon winds)
 * - Drop pod impact sound
 * - Atmospheric re-entry whoosh
 */
