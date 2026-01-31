/**
 * Asset System Types
 *
 * Shared type definitions for the per-level asset manifest system.
 */

import type { LevelId } from '../levels/types';

export type AssetCategory = 'model' | 'texture' | 'audio' | 'shader' | 'data';

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
