import type { AssetEntry, LevelManifest } from '../types';

/**
 * Asset manifest for "The Breach" - Level 10 (Final Boss)
 *
 * Underground alien hive with Queen boss fight. Pure organic alien environment.
 * Dark caverns with bioluminescent green/purple glow, pulsing biomass, wet organic walls.
 * No artificial structures - entirely alien architecture.
 * Minimal tech assets only where absorbed by organic growth.
 */

export const THE_BREACH_ASSETS: AssetEntry[] = [
  // ENVIRONMENT MODELS - Exclusive hive structures
  {
    id: 'structure/birther',
    path: '/assets/models/environment/hive/building_birther.glb',
    category: 'model',
    sizeKB: 520,

  },
  {
    id: 'structure/brain',
    path: '/assets/models/environment/hive/building_brain.glb',
    category: 'model',
    sizeKB: 480,

  },
  {
    id: 'structure/claw',
    path: '/assets/models/environment/hive/building_claw.glb',
    category: 'model',
    sizeKB: 440,

  },
  {
    id: 'structure/crystals',
    path: '/assets/models/environment/hive/building_crystals.glb',
    category: 'model',
    sizeKB: 500,

  },
  {
    id: 'structure/stomach',
    path: '/assets/models/environment/hive/building_stomach.glb',
    category: 'model',
    sizeKB: 460,

  },
  {
    id: 'structure/terraformer',
    path: '/assets/models/environment/hive/building_terraformer.glb',
    category: 'model',
    sizeKB: 530,

  },
  {
    id: 'structure/undercrystal',
    path: '/assets/models/environment/hive/building_undercrystal.glb',
    category: 'model',
    sizeKB: 490,

  },

  // QUATERNIUS DETAILS - Technology absorbed by hive growth
  {
    id: 'modular/detail_plate_detail',
    path: '/assets/models/environment/modular/Details_Plate_Details.glb',
    category: 'model',
    sizeKB: 16,
  },
  {
    id: 'modular/detail_plate_long',
    path: '/assets/models/environment/modular/Details_Plate_Long.glb',
    category: 'model',
    sizeKB: 14,
  },
  {
    id: 'modular/detail_plate_sm',
    path: '/assets/models/environment/modular/Details_Plate_Small.glb',
    category: 'model',
    sizeKB: 11,
  },
  {
    id: 'modular/detail_x',
    path: '/assets/models/environment/modular/Details_X.glb',
    category: 'model',
    sizeKB: 3,
  },
  {
    id: 'modular/detail_triangles',
    path: '/assets/models/environment/modular/Details_Triangles.glb',
    category: 'model',
    sizeKB: 2,
  },

  // STATION PIECES - Broken, consumed by hive
  {
    id: 'station/beam_hc_h1',
    path: '/assets/models/environment/station/beam_hc_horizonatal_1.glb',
    category: 'model',
    sizeKB: 470,
  },
  {
    id: 'station/beam_hc_h2',
    path: '/assets/models/environment/station/beam_hc_horizonatal_2.glb',
    category: 'model',
    sizeKB: 470,
  },
  {
    id: 'station/beam_hc_v2',
    path: '/assets/models/environment/station/beam_hc_vertical_2.glb',
    category: 'model',
    sizeKB: 501,
  },
  {
    id: 'station/beam_hl_1',
    path: '/assets/models/environment/station/beam_hl_1.glb',
    category: 'model',
    sizeKB: 429,
  },

  // TEXTURES - Exclusive underground hive textures
  {
    id: 'tex/breach/lava',
    path: '/assets/textures/levels/the-breach/Lava002_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/lava-normal',
    path: '/assets/textures/levels/the-breach/Lava002_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/lava-rough',
    path: '/assets/textures/levels/the-breach/Lava002_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/moss',
    path: '/assets/textures/levels/the-breach/Moss002_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/moss-normal',
    path: '/assets/textures/levels/the-breach/Moss002_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/moss-rough',
    path: '/assets/textures/levels/the-breach/Moss002_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/rock',
    path: '/assets/textures/levels/the-breach/Rock007_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/rock-normal',
    path: '/assets/textures/levels/the-breach/Rock007_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/rock-rough',
    path: '/assets/textures/levels/the-breach/Rock007_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/ground',
    path: '/assets/textures/levels/the-breach/Ground017_1K-JPG_Color.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/ground-normal',
    path: '/assets/textures/levels/the-breach/Ground017_1K-JPG_NormalGL.jpg',
    category: 'texture',
    sizeKB: 200,

  },
  {
    id: 'tex/breach/ground-rough',
    path: '/assets/textures/levels/the-breach/Ground017_1K-JPG_Roughness.jpg',
    category: 'texture',
    sizeKB: 200,

  },
];

export const THE_BREACH_MANIFEST: LevelManifest = {
  levelId: 'the_breach',

  // Critical assets for immediate gameplay
  required: [
    'enemy/spider',
    'enemy/scout',
    'enemy/soldier',
    'enemy/tentakel',
    'structure/brain', // Queen's chamber - central structure
  ],

  // Important assets loaded early
  preload: [
    'structure/birther',
    'structure/claw',
    'structure/crystals',
    'structure/stomach',
    'structure/terraformer',
    'structure/undercrystal',
    'vehicle/wraith',
    'vehicle/phantom',
    'tex/breach/lava',
    'tex/breach/lava-normal',
    'tex/breach/lava-rough',
    'tex/breach/moss',
    'tex/breach/moss-normal',
    'tex/breach/moss-rough',
    'tex/breach/rock',
    'tex/breach/rock-normal',
    'tex/breach/rock-rough',
    'tex/breach/ground',
    'tex/breach/ground-normal',
    'tex/breach/ground-rough',
    'station/beam_hc_h1', // structural remnants in the hive
    'station/beam_hc_h2',
    'station/beam_hc_v2',
  ],

  // Can be loaded during gameplay
  deferred: [
    'enemy/alienmonster',
    'enemy/alienmale',
    'enemy/alienfemale',
    'station/beam_hl_1',
    'modular/detail_plate_detail',
    'modular/detail_plate_long',
    'modular/detail_plate_sm',
    'modular/detail_x',
    'modular/detail_triangles',
  ],
};

/*
 * MISSING ASSETS - Required for full level polish
 *
 * BOSS & CRITICAL:
 * - Queen boss model (large unique alien - no current mesh available)
 * - Egg sac cluster model (alien nursery/spawning)
 *
 * ENVIRONMENT PROPS:
 * - Bile pool / acid pit mesh (ground hazards)
 * - Pulsing wall membrane (organic door mechanism)
 * - Bioluminescent fungus cluster (ambient lighting source)
 * - Alien web / silk strands hanging model (atmospheric detail)
 * - Hive column / support tendril (structural elements)
 * - Organic bridge / walkway (traversal geometry)
 * - Chrysalis / mutation pod (environmental storytelling)
 * - Queen's throne / nest platform (boss arena centerpiece)
 *
 * VISUAL EFFECTS:
 * - Pulsing organic material shader/animation
 * - Dripping biomass particle effect
 * - Spore cloud ambient particles
 * - Bioluminescent pulse animation
 *
 * AUDIO:
 * - Queen roar/scream SFX
 * - Biomass squelch/squish ambient
 * - Egg hatching sound
 * - Acid bubbling/sizzling
 */
