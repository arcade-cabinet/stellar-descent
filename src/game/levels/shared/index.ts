/**
 * Shared level utilities and modules
 *
 * Re-exports commonly used shared modules for convenient importing.
 */

export * from './AlienFloraBuilder';
export * from './CollectiblePlacer';
export * from './HiveEnvironmentBuilder';
export * from './LevelSpawnConfigs';
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
