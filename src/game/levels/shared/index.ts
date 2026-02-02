/**
 * Shared level utilities and modules
 *
 * Re-exports commonly used shared modules for convenient importing.
 *
 * COMPOSABLE SYSTEMS (use composition over inheritance):
 * - CameraShakeSystem - screen shake effects
 * - LevelStatsTracker - kills, accuracy, secrets tracking
 * - VictorySystem - objective tracking
 * - CheckpointSystem - save points and respawning
 * - EnvironmentalAudio - ambient sounds
 * - LevelLighting - PBR-calibrated lighting
 */

// Environment builders
export * from './AlienFloraBuilder';
// Composable systems (extracted from BaseLevel)
export * from './CameraShakeSystem';
export * from './CheckpointSystem';
export * from './CollectiblePlacer';
export * from './EnvironmentalAudio';
export * from './HiveEnvironmentBuilder';
export * from './LevelLighting';
export * from './LevelSpawnConfigs';
export * from './LevelStatsTracker';
export * from './ModularBaseBuilder';
// Spawn system (interface-based) - primary types
export type {
  AlienSpeciesId,
  EnemyStatOverrides,
  LevelSpawnConfig,
  SpawnGroupConfig,
  SpawnPointConfig,
  SpawnWaveConfig,
  TriggerCondition,
  TriggerType,
} from './SpawnConfig';
// Spawn system (Zod-validated) - explicit exports to avoid type name conflicts
export {
  type AlienSpecies,
  AlienSpeciesEnum,
  degreesToRadians,
  LevelSpawnConfigSchema,
  type PositionTuple,
  PositionTupleSchema,
  parsePositionString,
  parseTriggerValue,
  type SpawnPoint,
  SpawnPointSchema,
  type SpawnUnit,
  SpawnUnitSchema,
  type SpawnWave,
  SpawnWaveSchema,
  safeValidateSpawnConfig,
  TriggerTypeEnum,
  validateSpawnConfig,
  validateSpawnConfigFull,
  validateSpawnPointReferences,
  validateWaveChain,
} from './SpawnConfigZod';
export * from './SpawnManager';
export * from './SpawnManagerIntegration';
export * from './SpawnManagerZod';
// Environment builders
export * from './SurfaceTerrainFactory';
export * from './VictorySystem';
