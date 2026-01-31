/**
 * Shared Assets - Enemy, NPC, and Vehicle models
 *
 * These assets are gameplay-critical and appear across multiple levels.
 * They are the ONLY assets shared between levels. All environment,
 * prop, and texture assets are curated per-level for unique atmosphere.
 */

import type { AssetEntry } from './types';

// ---------------------------------------------------------------------------
// Enemy models (Chitin species)
// ---------------------------------------------------------------------------

export const ENEMY_ASSETS: AssetEntry[] = [
  {
    id: 'enemy/spider',
    path: '/models/enemies/chitin/spider.glb',
    category: 'model',
    sizeKB: 620,
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
  {
    id: 'enemy/alien_scifi',
    path: '/models/enemies/chitin/alien_scifi.glb',
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
    path: '/models/npcs/marine/marine_soldier.glb',
    category: 'model',
    sizeKB: 8300,
  },
  {
    id: 'npc/marine_sergeant',
    path: '/models/npcs/marine/marine_sergeant.glb',
    category: 'model',
    sizeKB: 11928,
  },
  {
    id: 'npc/marine_crusader',
    path: '/models/npcs/marine/marine_crusader.glb',
    category: 'model',
    sizeKB: 11500,
  },
  {
    id: 'npc/marine_elite',
    path: '/models/npcs/marine/marine_elite.glb',
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
    path: '/models/vehicles/chitin/wraith.glb',
    category: 'model',
    sizeKB: 1100,
  },
  {
    id: 'vehicle/phantom',
    path: '/models/spaceships/Dispatcher.glb',
    category: 'model',
    sizeKB: 1200,
  },
  {
    id: 'vehicle/marcus_mech',
    path: '/models/vehicles/tea/marcus_mech.glb',
    category: 'model',
    sizeKB: 1600,
  },
];

// ---------------------------------------------------------------------------
// All shared assets combined
// ---------------------------------------------------------------------------

export const ALL_SHARED_ASSETS: AssetEntry[] = [
  ...ENEMY_ASSETS,
  ...NPC_ASSETS,
  ...VEHICLE_ASSETS,
];
