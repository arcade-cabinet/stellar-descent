/**
 * FINAL ESCAPE - Asset Manifest
 *
 * Warthog Run style vehicle finale. Timed escape as the planet erupts.
 * Player drives the Phantom vehicle escaping destruction.
 *
 * ATMOSPHERE: Apocalyptic. Ground cracking, lava erupting, structures collapsing.
 * Fiery sky. Maximum intensity. Everything is falling apart.
 */

import type { AssetEntry, LevelManifest } from '../types';

/**
 * Final Escape exclusive assets
 * Environment models, crashed spaceships as wreckage, apocalyptic textures
 */
export const FINAL_ESCAPE_ASSETS: AssetEntry[] = [
  // ENVIRONMENT MODELS - Collapsing structures
  {
    id: 'env/column_b',
    category: 'model',
    path: '/assets/models/environment/modular/Column_B.glb',
    sizeKB: 150,
  },
  {
    id: 'env/detail_a',
    category: 'model',
    path: '/assets/models/environment/modular/Detail_A.glb',
    sizeKB: 100,
  },
  {
    id: 'env/detail_b',
    category: 'model',
    path: '/assets/models/environment/modular/Detail_B.glb',
    sizeKB: 100,
  },

  // SPACESHIPS - Crashing wreckage scattered across escape route
  {
    id: 'wreck/bob',
    category: 'model',
    path: '/assets/models/spaceships/Bob.glb',
    sizeKB: 2000,
  },
  {
    id: 'wreck/pancake',
    category: 'model',
    path: '/assets/models/spaceships/Pancake.glb',
    sizeKB: 2000,
  },
  {
    id: 'wreck/spitfire',
    category: 'model',
    path: '/assets/models/spaceships/Spitfire.glb',
    sizeKB: 2000,
  },
  {
    id: 'wreck/zenith',
    category: 'model',
    path: '/assets/models/spaceships/Zenith.glb',
    sizeKB: 2000,
  },

  // TEXTURES - Apocalyptic destruction theme
  // Lava - Active volcanic eruptions
  {
    id: 'tex/escape/lava/color',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Lava004_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/lava/normal',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Lava004_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/lava/roughness',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Lava004_1K-JPG_Roughness.jpg',
    sizeKB: 200,
  },

  // Ground - Cracking terrain
  {
    id: 'tex/escape/ground/color',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Ground029_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/ground/normal',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Ground029_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/ground/roughness',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Ground029_1K-JPG_Roughness.jpg',
    sizeKB: 200,
  },

  // Rock - Collapsing geology
  {
    id: 'tex/escape/rock/color',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Rock030_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/rock/normal',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Rock030_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/rock/roughness',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Rock030_1K-JPG_Roughness.jpg',
    sizeKB: 200,
  },

  // Concrete - Destroyed structures
  {
    id: 'tex/escape/concrete/color',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Concrete028_1K-JPG_Color.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/concrete/normal',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Concrete028_1K-JPG_NormalGL.jpg',
    sizeKB: 200,
  },
  {
    id: 'tex/escape/concrete/roughness',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/Concrete028_1K-JPG_Roughness.jpg',
    sizeKB: 200,
  },

  // Skybox - Fiery apocalyptic sky
  {
    id: 'tex/escape/skybox',
    category: 'texture',
    path: '/assets/textures/levels/final-escape/skybox.exr',
    sizeKB: 2000,
  },

  // QUATERNIUS MODULAR - Broken tech, destroyed equipment
  {
    id: 'modular/laser',
    path: '/assets/models/environment/modular/Props_Laser.glb',
    category: 'model',
    sizeKB: 79,
  },
  {
    id: 'modular/statue',
    path: '/assets/models/environment/modular/Props_Statue.glb',
    category: 'model',
    sizeKB: 58,
  },
  {
    id: 'modular/teleporter_1',
    path: '/assets/models/environment/modular/Props_Teleporter_1.glb',
    category: 'model',
    sizeKB: 36,
  },
  {
    id: 'modular/teleporter_2',
    path: '/assets/models/environment/modular/Props_Teleporter_2.glb',
    category: 'model',
    sizeKB: 49,
  },
  {
    id: 'modular/detail_arrow',
    path: '/assets/models/environment/modular/Details_Arrow.glb',
    category: 'model',
    sizeKB: 3,
  },
  {
    id: 'modular/detail_arrow2',
    path: '/assets/models/environment/modular/Details_Arrow_2.glb',
    category: 'model',
    sizeKB: 3,
  },
  {
    id: 'modular/detail_basic1',
    path: '/assets/models/environment/modular/Details_Basic_1.glb',
    category: 'model',
    sizeKB: 6,
  },
  {
    id: 'modular/detail_basic2',
    path: '/assets/models/environment/modular/Details_Basic_2.glb',
    category: 'model',
    sizeKB: 9,
  },
  {
    id: 'modular/detail_basic3',
    path: '/assets/models/environment/modular/Details_Basic_3.glb',
    category: 'model',
    sizeKB: 3,
  },
  {
    id: 'modular/detail_basic4',
    path: '/assets/models/environment/modular/Details_Basic_4.glb',
    category: 'model',
    sizeKB: 7,
  },

  // METAL FENCES - Collapsed perimeter
  {
    id: 'fence/metal_2',
    path: '/assets/models/props/modular/metal_fence_hr_2.glb',
    category: 'model',
    sizeKB: 839,
  },
  {
    id: 'fence/metal_2_tall',
    path: '/assets/models/props/modular/metal_fence_hr_2_tall.glb',
    category: 'model',
    sizeKB: 337,
  },
  {
    id: 'ladder/long',
    path: '/assets/models/props/modular/ladder_hr_1_long.glb',
    category: 'model',
    sizeKB: 155,
  },

  // STATION EXTERNAL - Massive collapsing wreckage
  {
    id: 'station-ext/station05b',
    path: '/assets/models/environment/station-external/station05.glb',
    category: 'model',
    sizeKB: 1965,
  },
];

/**
 * Final Escape level manifest
 *
 * REQUIRED: Player in Phantom vehicle, flying alien enemies chase
 * PRELOAD: All environment models, wreckage, core textures
 * DEFERRED: Additional texture variations
 */
export const FINAL_ESCAPE_MANIFEST: LevelManifest = {
  levelId: 'final_escape',

  // Critical assets - must load before level starts
  required: [
    'enemy/flyingalien', // Chase enemies pursuing player vehicle
    'vehicle/phantom', // Player's escape vehicle
  ],

  // High priority - load during initial screen
  preload: [
    'enemy/spider', // Ground threats during escape

    // Environment structures
    'env/column_b',
    'env/detail_a',
    'env/detail_b',

    // Crashed wreckage obstacles
    'wreck/bob',
    'wreck/pancake',
    'wreck/spitfire',
    'wreck/zenith',

    // Core apocalyptic textures
    'tex/escape/lava/color',
    'tex/escape/lava/normal',
    'tex/escape/ground/color',
    'tex/escape/ground/normal',
    'tex/escape/rock/color',
    'tex/escape/rock/normal',
    'tex/escape/concrete/color',
    'tex/escape/concrete/normal',
    'tex/escape/skybox',

    // Broken tech & destroyed equipment
    'modular/laser',
    'modular/teleporter_1',
    'modular/teleporter_2',

    // Collapsed perimeter fencing
    'fence/metal_2',
    'fence/metal_2_tall',

    // Massive collapsing wreckage
    'station-ext/station05b',
  ],

  // Load in background during gameplay
  deferred: [
    'tex/escape/lava/roughness',
    'tex/escape/ground/roughness',
    'tex/escape/rock/roughness',
    'tex/escape/concrete/roughness',

    // Decorative modular details
    'modular/statue',
    'modular/detail_arrow',
    'modular/detail_arrow2',
    'modular/detail_basic1',
    'modular/detail_basic2',
    'modular/detail_basic3',
    'modular/detail_basic4',

    // Additional infrastructure
    'ladder/long',
  ],
};

/*
 * MISSING ASSETS - Production Enhancement Opportunities
 *
 * COLLAPSING INFRASTRUCTURE:
 * - Collapsing bridge / road section model with animation states
 * - Cracking ground / fissure model with progressive damage
 * - Collapsing building / tower model with debris particles
 * - Falling ceiling / cave-in debris chunks
 *
 * VOLCANIC DESTRUCTION:
 * - Eruption vent / lava geyser animated mesh
 * - Lava flow / river dynamic model
 * - Falling rock / meteor impact meshes
 * - Explosion crater mesh with heat distortion
 *
 * VEHICLE DESTRUCTION:
 * - Destroyed alien vehicle wreckage variations
 * - Burning vehicle frames with fire effects
 * - Scattered debris fields
 *
 * ESCAPE ROUTE:
 * - Escape tunnel / exit portal with energy field
 * - Orbiting ship / rescue vessel (final destination)
 * - Landing platform / extraction zone
 * - Countdown timer display hologram
 *
 * ATMOSPHERE:
 * - Ash / smoke particle textures
 * - Fire / ember sprite sheets
 * - Heat haze / distortion overlay
 * - Shockwave / explosion ring effects
 * - Planetary destruction skybox sequence
 */
