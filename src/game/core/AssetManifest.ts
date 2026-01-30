/**
 * AssetManifest - Declarative asset manifest for all levels
 *
 * Defines every asset the game needs, organized by category, with per-level
 * dependency lists so the AssetPipeline knows exactly what to load and when.
 *
 * Design goals:
 *  - Single source of truth for all asset metadata (path, size, category, deps).
 *  - Shared asset pool: assets referenced by multiple levels are loaded once.
 *  - Level-specific lists: only the assets a level actually needs.
 *  - File size hints for accurate progress bars.
 */

import type { LevelId } from '../levels/types';

// ---------------------------------------------------------------------------
// Asset category enum
// ---------------------------------------------------------------------------

export type AssetCategory = 'model' | 'texture' | 'audio' | 'shader' | 'data';

// ---------------------------------------------------------------------------
// Asset entry
// ---------------------------------------------------------------------------

export interface AssetEntry {
  /** Unique asset id (used as cache key) */
  id: string;
  /** Path relative to public root (starts with /) */
  path: string;
  /** Asset category */
  category: AssetCategory;
  /** Estimated file size in KB (used for progress weight) */
  sizeKB: number;
  /** IDs of assets that must be loaded before this one */
  dependencies?: string[];
  /** Optional alternate path for compressed format (KTX2 for textures) */
  compressedPath?: string;
  /** Whether this asset supports Draco decompression (GLB models) */
  dracoCompressed?: boolean;
}

// ---------------------------------------------------------------------------
// Shared assets -- referenced by multiple levels, loaded once
// ---------------------------------------------------------------------------

export const SHARED_ASSETS: AssetEntry[] = [
  // Common enemy models (chitin species)
  {
    id: 'enemy/spider',
    path: '/models/enemies/chitin/spider.glb',
    category: 'model',
    sizeKB: 620,
    dracoCompressed: false,
  },
  {
    id: 'enemy/scout',
    path: '/models/enemies/chitin/scout.glb',
    category: 'model',
    sizeKB: 780,
  },
  {
    id: 'enemy/soldier',
    path: '/models/enemies/chitin/soldier.glb',
    category: 'model',
    sizeKB: 850,
  },
  {
    id: 'enemy/flyingalien',
    path: '/models/enemies/chitin/flyingalien.glb',
    category: 'model',
    sizeKB: 700,
  },
  {
    id: 'enemy/tentakel',
    path: '/models/enemies/chitin/tentakel.glb',
    category: 'model',
    sizeKB: 1400,
  },
  {
    id: 'enemy/alienmonster',
    path: '/models/enemies/chitin/alienmonster.glb',
    category: 'model',
    sizeKB: 900,
  },
  {
    id: 'enemy/alienmale',
    path: '/models/enemies/chitin/alienmale.glb',
    category: 'model',
    sizeKB: 680,
  },
  {
    id: 'enemy/alienfemale',
    path: '/models/enemies/chitin/alienfemale.glb',
    category: 'model',
    sizeKB: 660,
  },

  // Vehicles
  {
    id: 'vehicle/wraith',
    path: '/models/vehicles/chitin/wraith.glb',
    category: 'model',
    sizeKB: 1100,
  },
  {
    id: 'vehicle/phantom',
    path: '/models/vehicles/tea/phantom.glb',
    category: 'model',
    sizeKB: 1200,
  },
  {
    id: 'vehicle/marcus_mech',
    path: '/models/vehicles/tea/marcus_mech.glb',
    category: 'model',
    sizeKB: 1600,
  },

  // Hive structures (organic buildings)
  {
    id: 'structure/birther',
    path: '/models/environment/hive/building_birther.glb',
    category: 'model',
    sizeKB: 520,
  },
  {
    id: 'structure/brain',
    path: '/models/environment/hive/building_brain.glb',
    category: 'model',
    sizeKB: 480,
  },
  {
    id: 'structure/claw',
    path: '/models/environment/hive/building_claw.glb',
    category: 'model',
    sizeKB: 440,
  },
  {
    id: 'structure/crystals',
    path: '/models/environment/hive/building_crystals.glb',
    category: 'model',
    sizeKB: 500,
  },
  {
    id: 'structure/stomach',
    path: '/models/environment/hive/building_stomach.glb',
    category: 'model',
    sizeKB: 460,
  },
  {
    id: 'structure/terraformer',
    path: '/models/environment/hive/building_terraformer.glb',
    category: 'model',
    sizeKB: 530,
  },
  {
    id: 'structure/undercrystal',
    path: '/models/environment/hive/building_undercrystal.glb',
    category: 'model',
    sizeKB: 490,
  },

  // Station environment pieces (PSX style)
  {
    id: 'station/floor_ceiling_1',
    path: '/models/environment/station/floor_ceiling_hr_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'station/floor_ceiling_3',
    path: '/models/environment/station/floor_ceiling_hr_3.glb',
    category: 'model',
    sizeKB: 190,
  },
  {
    id: 'station/floor_ceiling_rtx',
    path: '/models/environment/station/floor_ceiling_rtx_1.glb',
    category: 'model',
    sizeKB: 200,
  },
  {
    id: 'station/wall_double',
    path: '/models/environment/station/wall_hr_1_double.glb',
    category: 'model',
    sizeKB: 220,
  },
  {
    id: 'station/wall_hole',
    path: '/models/environment/station/wall_hr_1_hole_1.glb',
    category: 'model',
    sizeKB: 240,
  },
  {
    id: 'station/doorway',
    path: '/models/environment/station/doorway_hr_1.glb',
    category: 'model',
    sizeKB: 210,
  },
  {
    id: 'station/doorway_wide',
    path: '/models/environment/station/doorway_hr_1_wide.glb',
    category: 'model',
    sizeKB: 230,
  },
  {
    id: 'station/beam_horizontal',
    path: '/models/environment/station/beam_hc_horizonatal_1.glb',
    category: 'model',
    sizeKB: 110,
  },
  {
    id: 'station/beam_vertical',
    path: '/models/environment/station/beam_hc_vertical_1.glb',
    category: 'model',
    sizeKB: 100,
  },
  {
    id: 'station/pipe_1',
    path: '/models/environment/station/pipe_cx_1.glb',
    category: 'model',
    sizeKB: 90,
  },
  {
    id: 'station/pipe_2',
    path: '/models/environment/station/pipe_cx_2.glb',
    category: 'model',
    sizeKB: 95,
  },
  {
    id: 'station/corridor_main',
    path: '/models/environment/station/corridor_main.glb',
    category: 'model',
    sizeKB: 320,
  },
  {
    id: 'station/corridor_wide',
    path: '/models/environment/station/corridor_wide.glb',
    category: 'model',
    sizeKB: 340,
  },
  {
    id: 'station/corridor_corner',
    path: '/models/environment/station/corridor_corner.glb',
    category: 'model',
    sizeKB: 300,
  },
  {
    id: 'station/corridor_junction',
    path: '/models/environment/station/corridor_junction.glb',
    category: 'model',
    sizeKB: 360,
  },
  {
    id: 'station/station_door',
    path: '/models/environment/station/station_door.glb',
    category: 'model',
    sizeKB: 150,
  },
  {
    id: 'station/station_barrel',
    path: '/models/environment/station/station_barrel.glb',
    category: 'model',
    sizeKB: 80,
  },

  // Industrial props
  {
    id: 'prop/barrel_1',
    path: '/models/props/industrial/metal_barrel_hr_1.glb',
    category: 'model',
    sizeKB: 120,
  },
  {
    id: 'prop/barrel_2',
    path: '/models/props/industrial/metal_barrel_hr_2.glb',
    category: 'model',
    sizeKB: 125,
  },
  {
    id: 'prop/shelf',
    path: '/models/props/industrial/shelf_mx_1.glb',
    category: 'model',
    sizeKB: 140,
  },
  {
    id: 'prop/box',
    path: '/models/props/industrial/cardboard_box_1.glb',
    category: 'model',
    sizeKB: 60,
  },
  {
    id: 'prop/electrical',
    path: '/models/props/industrial/electrical_equipment_1.glb',
    category: 'model',
    sizeKB: 180,
  },
  {
    id: 'prop/machinery',
    path: '/models/props/industrial/machinery_mx_1.glb',
    category: 'model',
    sizeKB: 250,
  },
  {
    id: 'prop/pipes',
    path: '/models/props/industrial/pipes_hr_1.glb',
    category: 'model',
    sizeKB: 160,
  },
  {
    id: 'prop/door_6',
    path: '/models/props/industrial/door_hr_6.glb',
    category: 'model',
    sizeKB: 130,
  },
  {
    id: 'prop/door_12',
    path: '/models/props/industrial/door_hr_12.glb',
    category: 'model',
    sizeKB: 135,
  },
  {
    id: 'prop/door_13',
    path: '/models/props/industrial/door_hr_13.glb',
    category: 'model',
    sizeKB: 138,
  },
  {
    id: 'prop/lamp_1',
    path: '/models/props/industrial/lamp_mx_1_a_on.glb',
    category: 'model',
    sizeKB: 70,
  },
  {
    id: 'prop/lamp_2',
    path: '/models/props/industrial/lamp_mx_2_on.glb',
    category: 'model',
    sizeKB: 72,
  },
  {
    id: 'prop/lamp_3',
    path: '/models/props/industrial/lamp_mx_3_on.glb',
    category: 'model',
    sizeKB: 75,
  },

  // PSX textures
  {
    id: 'tex/metal_hr_1',
    path: '/textures/psx/metal_hr_1.png',
    category: 'texture',
    sizeKB: 256,
  },
  {
    id: 'tex/metal_barrel',
    path: '/textures/psx/metal_barrel_hr_1.png',
    category: 'texture',
    sizeKB: 180,
  },
  {
    id: 'tex/machinery',
    path: '/textures/psx/machinery_mx_1.png',
    category: 'texture',
    sizeKB: 210,
  },
  {
    id: 'tex/door',
    path: '/textures/psx/door_hr_6.png',
    category: 'texture',
    sizeKB: 200,
  },
  {
    id: 'tex/wall',
    path: '/textures/psx/wall_hr_1.png',
    category: 'texture',
    sizeKB: 240,
  },
  {
    id: 'tex/concrete',
    path: '/textures/psx/concrete_hr_1.png',
    category: 'texture',
    sizeKB: 230,
  },
];

// ---------------------------------------------------------------------------
// Per-level asset lists (references ids from SHARED_ASSETS)
// ---------------------------------------------------------------------------

export interface LevelManifest {
  /** Level identifier */
  levelId: LevelId;
  /** IDs of assets required before the level can start (CRITICAL priority) */
  required: string[];
  /** IDs of assets that should load during the loading screen (HIGH priority) */
  preload: string[];
  /** IDs of assets that can load lazily during gameplay (LOW priority) */
  deferred: string[];
}

export const LEVEL_MANIFESTS: Record<LevelId, LevelManifest> = {
  // -------------------------------------------------------------------------
  // ACT 1: THE DROP
  // -------------------------------------------------------------------------
  anchor_station: {
    levelId: 'anchor_station',
    required: [
      // Station geometry is critical -- the player spawns in it
      'station/corridor_main',
      'station/floor_ceiling_1',
      'station/wall_double',
      'station/doorway',
      'station/station_door',
    ],
    preload: [
      'station/floor_ceiling_3',
      'station/floor_ceiling_rtx',
      'station/wall_hole',
      'station/doorway_wide',
      'station/beam_horizontal',
      'station/beam_vertical',
      'station/pipe_1',
      'station/pipe_2',
      'station/corridor_wide',
      'station/corridor_corner',
      'station/corridor_junction',
      'station/station_barrel',
      'prop/barrel_1',
      'prop/box',
      'prop/electrical',
      'prop/lamp_1',
      'prop/lamp_2',
      'prop/lamp_3',
      'tex/metal_hr_1',
      'tex/wall',
      'tex/concrete',
    ],
    deferred: [
      'prop/barrel_2',
      'prop/shelf',
      'prop/machinery',
      'prop/pipes',
      'prop/door_6',
      'prop/door_12',
      'prop/door_13',
      'tex/metal_barrel',
      'tex/machinery',
      'tex/door',
    ],
  },

  landfall: {
    levelId: 'landfall',
    required: [
      'enemy/spider',
      'enemy/scout',
    ],
    preload: [
      'vehicle/wraith',
      'vehicle/phantom',
    ],
    deferred: [
      'enemy/alienmale',
    ],
  },

  // -------------------------------------------------------------------------
  // ACT 2: THE SEARCH
  // -------------------------------------------------------------------------
  fob_delta: {
    levelId: 'fob_delta',
    required: [
      'enemy/spider',
      'enemy/scout',
      // Station pieces for the abandoned base
      'station/corridor_main',
      'station/floor_ceiling_1',
      'station/wall_double',
      'station/doorway',
    ],
    preload: [
      'enemy/soldier',
      'vehicle/wraith',
      'prop/barrel_1',
      'prop/barrel_2',
      'prop/box',
      'prop/electrical',
      'prop/machinery',
      'prop/lamp_1',
      'prop/lamp_2',
      'tex/metal_hr_1',
      'tex/wall',
    ],
    deferred: [
      'prop/shelf',
      'prop/pipes',
      'prop/door_6',
      'prop/door_12',
      'prop/door_13',
      'prop/lamp_3',
      'station/station_barrel',
      'station/corridor_wide',
      'station/corridor_corner',
    ],
  },

  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    required: [
      'enemy/spider',
      'enemy/scout',
      'enemy/soldier',
      'vehicle/marcus_mech',
    ],
    preload: [
      'enemy/flyingalien',
      'vehicle/wraith',
    ],
    deferred: [
      'enemy/alienmale',
    ],
  },

  // -------------------------------------------------------------------------
  // ACT 3: THE TRUTH
  // -------------------------------------------------------------------------
  the_breach: {
    levelId: 'the_breach',
    required: [
      'enemy/spider',
      'enemy/scout',
      'enemy/soldier',
      'enemy/tentakel',
      'structure/brain',
    ],
    preload: [
      'structure/birther',
      'structure/claw',
      'structure/crystals',
      'structure/stomach',
      'structure/terraformer',
      'structure/undercrystal',
      'vehicle/wraith',
      'vehicle/phantom',
    ],
    deferred: [
      'enemy/alienmonster',
      'enemy/alienmale',
      'enemy/alienfemale',
    ],
  },

  extraction: {
    levelId: 'extraction',
    required: [
      'enemy/spider',
      'enemy/scout',
      'enemy/soldier',
      'vehicle/phantom',
    ],
    preload: [
      'enemy/flyingalien',
    ],
    deferred: [
      'enemy/alienmonster',
    ],
  },

  // -------------------------------------------------------------------------
  // Additional campaign levels
  // -------------------------------------------------------------------------
  canyon_run: {
    levelId: 'canyon_run',
    required: [
      'enemy/spider',
      'enemy/flyingalien',
    ],
    preload: [
      'enemy/scout',
      'vehicle/wraith',
    ],
    deferred: [
      'enemy/soldier',
    ],
  },

  southern_ice: {
    levelId: 'southern_ice',
    required: [
      'enemy/spider',
      'enemy/scout',
      'enemy/soldier',
    ],
    preload: [
      'enemy/flyingalien',
      'enemy/tentakel',
    ],
    deferred: [
      'enemy/alienmonster',
    ],
  },

  hive_assault: {
    levelId: 'hive_assault',
    required: [
      'enemy/spider',
      'enemy/scout',
      'enemy/soldier',
      'enemy/tentakel',
      'structure/brain',
      'vehicle/marcus_mech',
    ],
    preload: [
      'structure/birther',
      'structure/claw',
      'structure/crystals',
      'vehicle/wraith',
      'vehicle/phantom',
    ],
    deferred: [
      'enemy/alienmonster',
      'enemy/alienmale',
      'enemy/alienfemale',
    ],
  },

  final_escape: {
    levelId: 'final_escape',
    required: [
      'enemy/flyingalien',
      'vehicle/phantom',
    ],
    preload: [
      'enemy/spider',
    ],
    deferred: [],
  },
};

// ---------------------------------------------------------------------------
// Level ordering (for next-level prefetch)
// ---------------------------------------------------------------------------

export const LEVEL_ORDER: LevelId[] = [
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Map from asset id to AssetEntry for O(1) lookup */
const assetIndex: Map<string, AssetEntry> = new Map();
for (const entry of SHARED_ASSETS) {
  assetIndex.set(entry.id, entry);
}

/**
 * Look up an AssetEntry by id. Returns undefined when the id is not in the manifest.
 */
export function getAssetEntry(id: string): AssetEntry | undefined {
  return assetIndex.get(id);
}

/**
 * Return the full list of asset ids needed by a level (required + preload + deferred).
 */
export function getAllLevelAssetIds(levelId: LevelId): string[] {
  const manifest = LEVEL_MANIFESTS[levelId];
  if (!manifest) return [];
  return [...manifest.required, ...manifest.preload, ...manifest.deferred];
}

/**
 * Get the next level id in the campaign order.
 */
export function getNextLevelId(currentLevelId: LevelId): LevelId | null {
  const idx = LEVEL_ORDER.indexOf(currentLevelId);
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

/**
 * Compute the set of asset ids shared between two levels.
 */
export function getSharedAssetIds(levelA: LevelId, levelB: LevelId): Set<string> {
  const idsA = new Set(getAllLevelAssetIds(levelA));
  const idsB = getAllLevelAssetIds(levelB);
  const shared = new Set<string>();
  for (const id of idsB) {
    if (idsA.has(id)) {
      shared.add(id);
    }
  }
  return shared;
}

/**
 * Total estimated size in KB for a set of asset ids.
 */
export function estimateTotalSizeKB(assetIds: string[]): number {
  let total = 0;
  for (const id of assetIds) {
    const entry = assetIndex.get(id);
    if (entry) total += entry.sizeKB;
  }
  return total;
}
