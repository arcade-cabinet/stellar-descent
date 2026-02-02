// Re-export level types from their canonical sources

export type { LevelManifest } from '@/game/assets/types';
export type {
  BonusLevelEntry,
  LevelEntry,
  LevelId,
  LevelType,
  MissionDefinition,
  MissionObjective,
  WeatherConfig,
} from '@/game/levels/LevelRegistry';
export type {
  ILevel,
  LevelConfig,
  LevelFactory,
  LevelFactoryRegistry,
  LevelState,
  LevelStats,
  TouchInputState,
  VictoryResult,
} from '@/game/levels/types';
