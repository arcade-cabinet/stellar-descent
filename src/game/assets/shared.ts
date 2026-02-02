/**
 * Shared Assets - Enemy, NPC, and Vehicle models
 *
 * These assets are gameplay-critical and appear across multiple levels.
 * They are the ONLY assets shared between levels. All environment,
 * prop, and texture assets are curated per-level for unique atmosphere.
 */

import { ENEMY_MODELS, NPC_MODELS, VEHICLE_MODELS } from '@config/models';
import type { AssetEntry } from './types';

// ---------------------------------------------------------------------------
// Enemy models (Chitin species)
// ---------------------------------------------------------------------------

export const ENEMY_ASSETS: AssetEntry[] = [
  {
    id: 'enemy/spider',
    path: ENEMY_MODELS.spider,
    category: 'model',
    sizeKB: 620,
  },
  {
    id: 'enemy/scout',
    path: ENEMY_MODELS.scout,
    category: 'model',
    sizeKB: 780,
  },
  {
    id: 'enemy/soldier',
    path: ENEMY_MODELS.soldier,
    category: 'model',
    sizeKB: 850,
  },
  {
    id: 'enemy/flyingalien',
    path: ENEMY_MODELS.flyingalien,
    category: 'model',
    sizeKB: 700,
  },
  {
    id: 'enemy/tentakel',
    path: ENEMY_MODELS.tentakel,
    category: 'model',
    sizeKB: 1400,
  },
  {
    id: 'enemy/alienmonster',
    path: ENEMY_MODELS.alienmonster,
    category: 'model',
    sizeKB: 900,
  },
  {
    id: 'enemy/alienmale',
    path: ENEMY_MODELS.alienmale,
    category: 'model',
    sizeKB: 680,
  },
  {
    id: 'enemy/alienfemale',
    path: ENEMY_MODELS.alienfemale,
    category: 'model',
    sizeKB: 660,
  },
  {
    id: 'enemy/alien_scifi',
    path: ENEMY_MODELS.alien_scifi,
    category: 'model',
    sizeKB: 8500,
  },
];

// ---------------------------------------------------------------------------
// NPC Marines (exported from Unity via glTFast)
// ---------------------------------------------------------------------------

export const NPC_ASSETS: AssetEntry[] = [
  {
    id: 'npc/marine_soldier',
    path: NPC_MODELS.marine_soldier,
    category: 'model',
    sizeKB: 8300,
  },
  {
    id: 'npc/marine_sergeant',
    path: NPC_MODELS.marine_sergeant,
    category: 'model',
    sizeKB: 11928,
  },
  {
    id: 'npc/marine_crusader',
    path: NPC_MODELS.marine_crusader,
    category: 'model',
    sizeKB: 11500,
  },
  {
    id: 'npc/marine_elite',
    path: NPC_MODELS.marine_elite,
    category: 'model',
    sizeKB: 13000,
  },
];

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const VEHICLE_ASSETS: AssetEntry[] = [
  {
    id: 'vehicle/wraith',
    path: VEHICLE_MODELS.wraith,
    category: 'model',
    sizeKB: 1100,
  },
  {
    id: 'vehicle/phantom',
    path: VEHICLE_MODELS.phantom,
    category: 'model',
    sizeKB: 1200,
  },
  {
    id: 'vehicle/marcus_mech',
    path: VEHICLE_MODELS.marcus_mech,
    category: 'model',
    sizeKB: 1600,
  },
];

// ---------------------------------------------------------------------------
// All shared assets combined
// ---------------------------------------------------------------------------

export const ALL_SHARED_ASSETS: AssetEntry[] = [...ENEMY_ASSETS, ...NPC_ASSETS, ...VEHICLE_ASSETS];
