import { AssetEntry, LevelManifest } from '../types';

/**
 * Canyon Run - High-speed vehicle chase through narrow alien canyons
 *
 * ATMOSPHERE: Dramatic evening light through narrow canyon walls, industrial
 * debris scattered as obstacles. Player drives a Phantom vehicle through
 * winding passages at high speed, fighting off Spider and Flying Alien enemies.
 * Think Halo Warthog run but in an alien canyon environment.
 */

export const CANYON_RUN_ASSETS: AssetEntry[] = [
  // =============================================================================
  // ENVIRONMENT MODELS (Exclusive to Canyon Run)
  // =============================================================================
  {
    id: 'industrial/shipping_container_2',
    category: 'model',
    path: '/assets/models/environment/industrial/shipping_container_mx_2.glb',
    sizeKB: 5000,

  },
  {
    id: 'industrial/cage',
    category: 'model',
    path: '/assets/models/environment/industrial/cage_mx_1.glb',
    sizeKB: 1145,

  },

  // =============================================================================
  // CONCRETE BARRIERS (Canyon obstacles)
  // =============================================================================
  {
    id: 'barrier/concrete_fence',
    category: 'model',
    path: '/assets/models/props/modular/concrete_fence_hr_1.glb',
    sizeKB: 360,

  },
  {
    id: 'barrier/concrete_pillar',
    category: 'model',
    path: '/assets/models/props/modular/concrete_fence_hr_1_pillar_1.glb',
    sizeKB: 357,

  },
  {
    id: 'barrier/concrete_corner',
    category: 'model',
    path: '/assets/models/props/modular/concrete_fence_hr_1_pillar_1_corner.glb',
    sizeKB: 358,

  },
  {
    id: 'barrier/concrete_fence_2',
    category: 'model',
    path: '/assets/models/props/modular/concrete_fence_hr_2.glb',
    sizeKB: 912,

  },

  // =============================================================================
  // STATION PIECES (Road/ramp segments)
  // =============================================================================
  {
    id: 'station/asphalt_2',
    category: 'model',
    path: '/assets/models/environment/station/asphalt_hr_2.glb',
    sizeKB: 560,

  },
  {
    id: 'station/asphalt_3',
    category: 'model',
    path: '/assets/models/environment/station/asphalt_hr_3.glb',
    sizeKB: 561,

  },
  {
    id: 'station/ramp_platform_slim',
    category: 'model',
    path: '/assets/models/environment/station/ramp_platform_slim_mx_1.glb',
    sizeKB: 844,

  },
  {
    id: 'station/ramp_platform_wide',
    category: 'model',
    path: '/assets/models/environment/station/ramp_platform_wide_mx_1.glb',
    sizeKB: 497,

  },
  {
    id: 'station/concrete_pipe_end',
    category: 'model',
    path: '/assets/models/environment/station/concrete_pipe_hm_1_end.glb',
    sizeKB: 586,

  },
  {
    id: 'station/concrete_pipe_mid',
    category: 'model',
    path: '/assets/models/environment/station/concrete_pipe_hm_1_middle.glb',
    sizeKB: 579,

  },

  // =============================================================================
  // STATION EXTERNAL (Distant wreckage)
  // =============================================================================
  {
    id: 'station-ext/station03',
    category: 'model',
    path: '/assets/models/environment/station-external/station03.glb',
    sizeKB: 769,

  },

  // =============================================================================
  // PROPS (Exclusive to Canyon Run)
  // =============================================================================
  {
    id: 'prop/barrel_3',
    category: 'model',
    path: '/assets/models/props/containers/metal_barrel_hr_3.glb',
    sizeKB: 400,

  },
  {
    id: 'prop/barrel_4',
    category: 'model',
    path: '/assets/models/props/containers/metal_barrel_hr_4.glb',
    sizeKB: 400,

  },

  // =============================================================================
  // SPACESHIPS (Environmental backdrop)
  // =============================================================================
  {
    id: 'spaceship/challenger',
    category: 'model',
    path: '/assets/models/spaceships/Challenger.glb',
    sizeKB: 3500,

  },
  {
    id: 'spaceship/omen',
    category: 'model',
    path: '/assets/models/spaceships/Omen.glb',
    sizeKB: 3237,

  },

  // =============================================================================
  // TEXTURES (Exclusive to Canyon Run)
  // =============================================================================
  {
    id: 'tex/canyon/rock',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rock041_1K-JPG_Color.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/rock_normal',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rock041_1K-JPG_NormalGL.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/rock_roughness',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rock041_1K-JPG_Roughness.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/ground',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Ground054_1K-JPG_Color.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/ground_normal',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Ground054_1K-JPG_NormalGL.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/ground_roughness',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Ground054_1K-JPG_Roughness.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/rocks',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rocks011_1K-JPG_Color.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/rocks_normal',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rocks011_1K-JPG_NormalGL.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/rocks_roughness',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/Rocks011_1K-JPG_Roughness.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/steel',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/CorrugatedSteel003_1K-JPG_Color.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/steel_normal',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/CorrugatedSteel003_1K-JPG_NormalGL.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/steel_roughness',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/CorrugatedSteel003_1K-JPG_Roughness.jpg',
    sizeKB: 200,

  },
  {
    id: 'tex/canyon/skybox',
    category: 'texture',
    path: '/assets/textures/levels/canyon-run/skybox.exr',
    sizeKB: 2000,
  },

  // =============================================================================
  // [FIX] ADDITIONAL ASSETS - Previously missing from manifest
  // =============================================================================
  {
    id: 'vehicle/phantom',
    category: 'model',
    path: '/assets/models/spaceships/Bob.glb',
    sizeKB: 2500,
  },
  {
    id: 'vehicle/wraith',
    category: 'model',
    path: '/assets/models/vehicles/chitin/wraith.glb',
    sizeKB: 3000,
  },
  {
    id: 'prop/tire_1',
    category: 'model',
    path: '/assets/models/props/containers/tire_1.glb',
    sizeKB: 200,
  },
  {
    id: 'prop/tire_2',
    category: 'model',
    path: '/assets/models/props/containers/tire_2.glb',
    sizeKB: 200,
  },
  {
    id: 'weapon/plasma_cannon',
    category: 'model',
    path: '/assets/models/props/weapons/fps_plasma_cannon.glb',
    sizeKB: 400,
  },
  {
    id: 'flora/alien_boulder',
    category: 'model',
    path: '/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb',
    sizeKB: 800,
  },
  {
    id: 'flora/alien_rock_med_1',
    category: 'model',
    path: '/assets/models/environment/alien-flora/alien_rock_medium_1.glb',
    sizeKB: 600,
  },
  {
    id: 'station/bridge_pillar',
    category: 'model',
    path: '/assets/models/environment/station/pillar_hr_2.glb',
    sizeKB: 400,
  },
  {
    id: 'station/bridge_handrail',
    category: 'model',
    path: '/assets/models/environment/station/platform_b_handrail_1.glb',
    sizeKB: 300,
  }
];

export const CANYON_RUN_MANIFEST: LevelManifest = {
  levelId: 'canyon_run',

  /**
   * REQUIRED: Assets that must be loaded before level starts
   * - Spider and Flying Alien enemies (primary threats during vehicle chase)
   */
  required: [
    'enemy/spider',
    'enemy/flyingalien'
  ],

  /**
   * PRELOAD: Assets loaded during initial load screen
   * - Enemy Scout (light vehicle combat)
   * - Wraith vehicle (enemy vehicles to destroy)
   * - Player vehicle and parts
   * - All environment models, props, spaceships
   * - All canyon-specific textures
   */
  preload: [
    'enemy/scout',
    'vehicle/wraith',
    'vehicle/phantom',
    'prop/tire_1',
    'prop/tire_2',
    'weapon/plasma_cannon',
    'flora/alien_boulder',
    'flora/alien_rock_med_1',
    'station/bridge_pillar',
    'station/bridge_handrail',
    'industrial/shipping_container_2',
    'industrial/cage',
    'barrier/concrete_fence',
    'station/asphalt_2',
    'station/ramp_platform_slim',
    'station-ext/station03',
    'prop/barrel_3',
    'prop/barrel_4',
    'spaceship/challenger',
    'spaceship/omen',
    'tex/canyon/rock',
    'tex/canyon/rock_normal',
    'tex/canyon/rock_roughness',
    'tex/canyon/ground',
    'tex/canyon/ground_normal',
    'tex/canyon/ground_roughness',
    'tex/canyon/rocks',
    'tex/canyon/rocks_normal',
    'tex/canyon/rocks_roughness',
    'tex/canyon/steel',
    'tex/canyon/steel_normal',
    'tex/canyon/steel_roughness',
    'tex/canyon/skybox'
  ],

  /**
   * DEFERRED: Assets that can be loaded in background
   * - Enemy Soldier (may appear in certain sections)
   * - Any other common assets not critical for initial canyon sequence
   */
  deferred: [
    'enemy/soldier',
    'barrier/concrete_pillar',
    'barrier/concrete_corner',
    'barrier/concrete_fence_2',
    'station/asphalt_3',
    'station/ramp_platform_wide',
    'station/concrete_pipe_end',
    'station/concrete_pipe_mid'
  ]
};

// =============================================================================
// MISSING ASSETS - Assets needed for full Canyon Run experience
// =============================================================================
/*
 * ENVIRONMENTAL GEOMETRY:
 * - Canyon arch / natural bridge mesh (iconic canyon feature)
 * - Narrow canyon wall segments - modular pieces (procedural canyon generation)
 * - Fallen rock / rockslide obstacle model (dynamic obstacles)
 * - Vehicle ramp / jump mesh (high-speed jumps across gaps)
 *
 * GAMEPLAY ELEMENTS:
 * - Speed boost strip / road surface model (visual indicator for boost zones)
 * - Road checkpoint / barrier gate (progression markers)
 * - Alien nest / hive entrance in canyon wall (enemy spawn points)
 *
 * VEHICLE DESTRUCTION:
 * - Wraith vehicle wreckage (destroyed enemy vehicles)
 * - Phantom vehicle parts / debris (player vehicle damage states)
 *
 * ADDITIONAL TEXTURES:
 * - Canyon wall decals (erosion, alien markings)
 * - Speed trail / motion blur texture (vehicle speed effects)
 *
 * LIGHTING:
 * - Evening sun shaft light volumes
 * - Canyon shadow masks for dramatic lighting
 */
