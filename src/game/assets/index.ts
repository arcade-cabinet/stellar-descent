/**
 * Asset System - Per-Level Curated Manifests
 *
 * Each level has its own unique set of environment models, props, and textures.
 * Only enemies, NPCs, and vehicles are shared across levels.
 *
 * This module composes all per-level manifests into the unified data structures
 * that AssetPipeline and AssetManager consume.
 */

import type { LevelId } from '../levels/types';
import type { AssetEntry, LevelManifest } from './types';

// Re-export types for consumers
export type { AssetCategory, AssetEntry, LevelManifest } from './types';

// ---------------------------------------------------------------------------
// Shared assets (enemies, NPCs, vehicles)
// ---------------------------------------------------------------------------

import { ALL_SHARED_ASSETS } from './shared';

// ---------------------------------------------------------------------------
// Per-level asset definitions
// ---------------------------------------------------------------------------

import { ANCHOR_STATION_ASSETS, ANCHOR_STATION_MANIFEST } from './levels/anchor-station';
import { BROTHERS_IN_ARMS_ASSETS, BROTHERS_IN_ARMS_MANIFEST } from './levels/brothers-in-arms';
import { CANYON_RUN_ASSETS, CANYON_RUN_MANIFEST } from './levels/canyon-run';
import { EXTRACTION_ASSETS, EXTRACTION_MANIFEST } from './levels/extraction';
import { FINAL_ESCAPE_ASSETS, FINAL_ESCAPE_MANIFEST } from './levels/final-escape';
import { FOB_DELTA_ASSETS, FOB_DELTA_MANIFEST } from './levels/fob-delta';
import { HIVE_ASSAULT_ASSETS, HIVE_ASSAULT_MANIFEST } from './levels/hive-assault';
import { LANDFALL_ASSETS, LANDFALL_MANIFEST } from './levels/landfall';
import { SOUTHERN_ICE_ASSETS, SOUTHERN_ICE_MANIFEST } from './levels/southern-ice';
import { THE_BREACH_ASSETS, THE_BREACH_MANIFEST } from './levels/the-breach';

// ---------------------------------------------------------------------------
// Composed SHARED_ASSETS (all per-level + shared combined for the asset index)
// ---------------------------------------------------------------------------

export const SHARED_ASSETS: AssetEntry[] = [
  ...ALL_SHARED_ASSETS,
  ...ANCHOR_STATION_ASSETS,
  ...LANDFALL_ASSETS,
  ...CANYON_RUN_ASSETS,
  ...FOB_DELTA_ASSETS,
  ...BROTHERS_IN_ARMS_ASSETS,
  ...SOUTHERN_ICE_ASSETS,
  ...THE_BREACH_ASSETS,
  ...HIVE_ASSAULT_ASSETS,
  ...EXTRACTION_ASSETS,
  ...FINAL_ESCAPE_ASSETS,
];

// ---------------------------------------------------------------------------
// Per-level manifests (what AssetPipeline loads for each level)
// ---------------------------------------------------------------------------

export const LEVEL_MANIFESTS: Record<LevelId, LevelManifest> = {
  anchor_station: ANCHOR_STATION_MANIFEST,
  landfall: LANDFALL_MANIFEST,
  canyon_run: CANYON_RUN_MANIFEST,
  fob_delta: FOB_DELTA_MANIFEST,
  brothers_in_arms: BROTHERS_IN_ARMS_MANIFEST,
  southern_ice: SOUTHERN_ICE_MANIFEST,
  the_breach: THE_BREACH_MANIFEST,
  hive_assault: HIVE_ASSAULT_MANIFEST,
  extraction: EXTRACTION_MANIFEST,
  final_escape: FINAL_ESCAPE_MANIFEST,
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
