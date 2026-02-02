import { ENEMY_MODELS } from './models';

type GlbEntry = { path: string; scale: number };

/** Maps each alien species to its GLB model path and scale factor */
export const SPECIES_GLB_CONFIG: Record<string, GlbEntry> = {
  // Primary enemy types
  skitterer: { path: ENEMY_MODELS.spider, scale: 0.4 },
  spitter: { path: ENEMY_MODELS.soldier, scale: 0.5 },
  warrior: { path: ENEMY_MODELS.alienmale, scale: 0.7 },
  heavy: { path: ENEMY_MODELS.tentakel, scale: 0.8 },
  stalker: { path: ENEMY_MODELS.scout, scale: 0.6 },
  broodmother: { path: ENEMY_MODELS.tentakel, scale: 1.0 },
  queen: { path: ENEMY_MODELS.tentakel, scale: 1.5 },
  // Legacy mappings
  lurker: { path: ENEMY_MODELS.scout, scale: 0.7 },
  spewer: { path: ENEMY_MODELS.soldier, scale: 0.6 },
  husk: { path: ENEMY_MODELS.alienmale, scale: 0.6 },
};

/** Ice Chitin variant model mapping */
export const ICE_CHITIN_MODELS: Record<string, GlbEntry> = {
  drone: { path: ENEMY_MODELS.spider, scale: 0.5 },
  warrior: { path: ENEMY_MODELS.soldier, scale: 0.6 },
  brood_mother: { path: ENEMY_MODELS.tentakel, scale: 1.0 },
};
