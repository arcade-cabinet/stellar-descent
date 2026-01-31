/**
 * MissionDefinitions - Re-exports from LevelRegistry
 *
 * All mission data now lives in LevelRegistry.ts as the single source of truth.
 * This module exists for backward compatibility only.
 *
 * @deprecated Import directly from '../levels/LevelRegistry' instead
 */

export {
  // Mission data (derived from LEVEL_REGISTRY)
  MISSION_DEFINITIONS,
  getMissionDefinition,
  type MissionDefinition,

  // Bonus levels
  BONUS_LEVELS,
  type BonusLevelEntry,

  // Aggregate functions
  getTotalAudioLogCount,
  getTotalSecretCount,
  getTotalSkullCount,

  // Level types
  type LevelId,
} from '../levels/LevelRegistry';

// Re-export BonusLevelEntry as BonusLevelDefinition for backward compat
export { type BonusLevelEntry as BonusLevelDefinition } from '../levels/LevelRegistry';
