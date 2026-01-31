import type { AssetEntry, LevelManifest } from '../types';

/**
 * Southern Ice - Frozen Polar Wasteland
 *
 * ATMOSPHERE:
 * Extreme cold environment with blue-white frozen landscape under blizzard conditions.
 * Industrial structures are frozen over and visibility is limited by swirling snow.
 * New enemy types emerge from the ice.
 */

export const SOUTHERN_ICE_ASSETS: AssetEntry[] = [
  // ENVIRONMENT MODELS (exclusive to Southern Ice)
  {
    id: 'industrial/tank_system',
    path: '/models/environment/industrial/tank_system_mx_1.glb',
    category: 'model',
    sizeKB: 400,
  },
  {
    id: 'industrial/pipes_elbow',
    path: '/models/environment/industrial/pipes_hr_1_elbow_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'industrial/pipes_h_mid',
    path: '/models/environment/industrial/pipes_hr_1_horizontal_middle_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'industrial/pipes_v_end',
    path: '/models/environment/industrial/pipes_hr_1_vertical_end_1.glb',
    category: 'model',
    sizeKB: 200,
  },

  // PROPS (exclusive to Southern Ice)
  {
    id: 'prop/gate',
    path: '/models/props/doors/gate_1.glb',
    category: 'model',
    sizeKB: 150,
  },

  // TEXTURES (exclusive to Southern Ice)
  {
    id: 'tex/ice/ice',
    path: '/textures/levels/southern-ice/Ice002_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/ice_normal',
    path: '/textures/levels/southern-ice/Ice002_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/ice_roughness',
    path: '/textures/levels/southern-ice/Ice002_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },
  {
    id: 'tex/ice/snow',
    path: '/textures/levels/southern-ice/Snow003_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/snow_normal',
    path: '/textures/levels/southern-ice/Snow003_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/snow_roughness',
    path: '/textures/levels/southern-ice/Snow003_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },
  {
    id: 'tex/ice/rock',
    path: '/textures/levels/southern-ice/Rock014_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/rock_normal',
    path: '/textures/levels/southern-ice/Rock014_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/rock_roughness',
    path: '/textures/levels/southern-ice/Rock014_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },
  {
    id: 'tex/ice/ground',
    path: '/textures/levels/southern-ice/Ground012_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/ground_normal',
    path: '/textures/levels/southern-ice/Ground012_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/ice/ground_roughness',
    path: '/textures/levels/southern-ice/Ground012_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 100,
  },
  {
    id: 'tex/ice/skybox',
    path: '/textures/levels/southern-ice/skybox.exr',
    category: 'texture',
    sizeKB: 2000,
  },

  // SPACESHIPS (environmental, exclusive to Southern Ice)
  {
    id: 'spaceship/dispatcher',
    path: '/models/spaceships/Dispatcher.glb',
    category: 'model',
    sizeKB: 3000,
  },

  // QUATERNIUS MODULAR (frozen research station windows/science props)
  {
    id: 'modular/long_window_a',
    path: '/models/environment/modular/LongWindow_Wall_SideA.glb',
    category: 'model',
    sizeKB: 19,
  },
  {
    id: 'modular/long_window_b',
    path: '/models/environment/modular/LongWindow_Wall_SideB.glb',
    category: 'model',
    sizeKB: 18,
  },
  {
    id: 'modular/small_windows_a',
    path: '/models/environment/modular/SmallWindows_Wall_SideA.glb',
    category: 'model',
    sizeKB: 37,
  },
  {
    id: 'modular/small_windows_b',
    path: '/models/environment/modular/SmallWindows_Wall_SideB.glb',
    category: 'model',
    sizeKB: 34,
  },
  {
    id: 'modular/capsule',
    path: '/models/environment/modular/Props_Capsule.glb',
    category: 'model',
    sizeKB: 67,
  },
  {
    id: 'modular/pod',
    path: '/models/environment/modular/Props_Pod.glb',
    category: 'model',
    sizeKB: 110,
  },
  {
    id: 'modular/vessel',
    path: '/models/environment/modular/Props_Vessel.glb',
    category: 'model',
    sizeKB: 19,
  },
  {
    id: 'modular/vessel_short',
    path: '/models/environment/modular/Props_Vessel_Short.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/vessel_tall',
    path: '/models/environment/modular/Props_Vessel_Tall.glb',
    category: 'model',
    sizeKB: 19,
  },
  {
    id: 'modular/detail_cylinder',
    path: '/models/environment/modular/Details_Cylinder.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/detail_cyl_long',
    path: '/models/environment/modular/Details_Cylinder_Long.glb',
    category: 'model',
    sizeKB: 15,
  },
  {
    id: 'modular/detail_dots',
    path: '/models/environment/modular/Details_Dots.glb',
    category: 'model',
    sizeKB: 12,
  },
  {
    id: 'modular/detail_hexagon',
    path: '/models/environment/modular/Details_Hexagon.glb',
    category: 'model',
    sizeKB: 3,
  },

  // METAL FENCES (frozen perimeter)
  {
    id: 'fence/metal_1',
    path: '/models/props/modular/metal_fence_hr_1.glb',
    category: 'model',
    sizeKB: 288,
  },
  {
    id: 'fence/metal_pillar',
    path: '/models/props/modular/metal_fence_hr_1_pillar_1.glb',
    category: 'model',
    sizeKB: 284,
  },
  {
    id: 'fence/metal_corner',
    path: '/models/props/modular/metal_fence_hr_1_pillar_1_corner.glb',
    category: 'model',
    sizeKB: 285,
  },
  {
    id: 'fence/metal_corner_tall',
    path: '/models/props/modular/metal_fence_hr_1_pillar_1_corner_tall.glb',
    category: 'model',
    sizeKB: 285,
  },
  {
    id: 'fence/metal_pillar_tall',
    path: '/models/props/modular/metal_fence_hr_1_pillar_1_tall.glb',
    category: 'model',
    sizeKB: 285,
  },
  {
    id: 'fence/metal_tall',
    path: '/models/props/modular/metal_fence_hr_1_tall.glb',
    category: 'model',
    sizeKB: 291,
  },

  // STATION EXTERNAL (crashed station in ice field)
  {
    id: 'station-ext/station05',
    path: '/models/environment/station-external/station05.glb',
    category: 'model',
    sizeKB: 1965,
  },
];

export const SOUTHERN_ICE_MANIFEST: LevelManifest = {
  levelId: 'southern_ice',

  required: [
    'enemy/spider',
    'enemy/scout',
    'enemy/soldier',
  ],

  preload: [
    // Critical enemies
    'enemy/flyingalien',
    'enemy/tentakel',

    // Environment models
    'industrial/tank_system',
    'industrial/pipes_elbow',
    'industrial/pipes_h_mid',
    'industrial/pipes_v_end',

    // Props
    'prop/gate',

    // All textures for frozen environment
    'tex/ice/ice',
    'tex/ice/ice_normal',
    'tex/ice/ice_roughness',
    'tex/ice/snow',
    'tex/ice/snow_normal',
    'tex/ice/snow_roughness',
    'tex/ice/rock',
    'tex/ice/rock_normal',
    'tex/ice/rock_roughness',
    'tex/ice/ground',
    'tex/ice/ground_normal',
    'tex/ice/ground_roughness',
    'tex/ice/skybox',

    // Environmental spaceship
    'spaceship/dispatcher',

    // Research station windows & science props
    'modular/long_window_a',
    'modular/long_window_b',
    'modular/capsule',
    'modular/pod',

    // Frozen perimeter fencing
    'fence/metal_1',
    'fence/metal_pillar',

    // Crashed station
    'station-ext/station05',
  ],

  deferred: [
    // Heavy enemy - load after level start
    'enemy/alienmonster',

    // Additional research station windows
    'modular/small_windows_a',
    'modular/small_windows_b',

    // Science vessel props
    'modular/vessel',
    'modular/vessel_short',
    'modular/vessel_tall',

    // Detail props
    'modular/detail_cylinder',
    'modular/detail_cyl_long',
    'modular/detail_dots',
    'modular/detail_hexagon',

    // Additional fence variants
    'fence/metal_corner',
    'fence/metal_corner_tall',
    'fence/metal_pillar_tall',
    'fence/metal_tall',
  ],
};

/*
 * MISSING ASSETS - Future Enhancements
 *
 * The following assets would enhance the frozen polar atmosphere:
 *
 * NATURAL FORMATIONS:
 * - Ice stalagmite / stalactite model (cave entrance decorations)
 * - Ice crevasse edge model (terrain hazards)
 * - Ice cave entrance arch model (environmental framing)
 * - Frozen waterfall mesh (dynamic frozen water effect)
 * - Snow drift / deep snow bank mesh (terrain variation)
 * - Ice crystal cluster model (natural decorations)
 *
 * ENVIRONMENTAL HAZARDS:
 * - Frozen alien cocoon model (preserved specimens in ice)
 * - Frozen over machinery (ice-encrusted industrial variant)
 *
 * STRUCTURES:
 * - Research outpost prefab (abandoned polar station)
 *
 * EFFECTS:
 * - Blizzard wind streamer particle mesh (atmospheric effect)
 */
