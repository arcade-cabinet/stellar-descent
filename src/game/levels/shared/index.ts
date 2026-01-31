/**
 * Shared level utilities and modules
 *
 * Re-exports commonly used shared modules for convenient importing.
 */

// Spawn system (interface-based) - primary types
export {
  type AlienSpeciesId,
  type SpawnGroupConfig,
  type EnemyStatOverrides,
  type SpawnPointConfig,
  type TriggerType,
  type TriggerCondition,
  type SpawnWaveConfig,
  type LevelSpawnConfig,
} from './SpawnConfig';
export * from './SpawnManager';
export * from './SpawnManagerIntegration';
export * from './LevelSpawnConfigs';

// Spawn system (Zod-validated) - explicit exports to avoid type name conflicts
export {
  AlienSpeciesEnum,
  type AlienSpecies,
  SpawnUnitSchema,
  type SpawnUnit,
  TriggerTypeEnum,
  SpawnWaveSchema,
  type SpawnWave,
  PositionTupleSchema,
  type PositionTuple,
  SpawnPointSchema,
  type SpawnPoint,
  LevelSpawnConfigSchema,
  validateSpawnConfig,
  safeValidateSpawnConfig,
  validateSpawnPointReferences,
  validateWaveChain,
  validateSpawnConfigFull,
  degreesToRadians,
  parsePositionString,
  parseTriggerValue,
} from './SpawnConfigZod';
export * from './SpawnManagerZod';

// Environment builders
export * from './SurfaceTerrainFactory';
export * from './ModularBaseBuilder';
export * from './HiveEnvironmentBuilder';
export * from './AlienFloraBuilder';
export * from './CollectiblePlacer';
