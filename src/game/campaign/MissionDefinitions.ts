/**
 * MissionDefinitions - Re-exports from LevelRegistry
 *
 * All mission data now lives in LevelRegistry.ts as the single source of truth.
 * This module exists for backward compatibility only.
 *
 * @deprecated Import directly from '../levels/LevelRegistry' instead
 */

// Re-export BonusLevelEntry as BonusLevelDefinition for backward compat
export {
  // Bonus levels
  BONUS_LEVELS,
  type BonusLevelEntry,
  type BonusLevelEntry as BonusLevelDefinition,
  getMissionDefinition,
  // Aggregate functions
  getTotalAudioLogCount,
  getTotalSecretCount,
  getTotalSkullCount,
  // Level types
  type LevelId,
  // Mission data (derived from LEVEL_REGISTRY)
  MISSION_DEFINITIONS,
  type MissionDefinition,
} from '../levels/LevelRegistry';
