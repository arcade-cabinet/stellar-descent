/**
 * Level System - Main exports
 *
 * The level system provides:
 * - Linked list level architecture (each level knows next/previous)
 * - Scene isolation (each level owns its Babylon.js Scene)
 * - State persistence via worldDatabase
 * - React integration via useLevelManager hook
 */

// Anchor Station (tutorial level)
export { AnchorStationLevel } from './anchor-station/AnchorStationLevel';

// Base classes
export { BaseLevel } from './BaseLevel';
// Factories
export {
  combinedArmsLevelFactory,
  createLevelFactories,
  defaultLevelFactories,
  dropLevelFactory,
  finaleLevelFactory,
  iceLevelFactory,
  stationLevelFactory,
  vehicleLevelFactory,
} from './factories';
// Level Manager
export { LevelManager, type LevelManagerConfig } from './LevelManager';
export { LandfallLevel } from './landfall';
export { StationLevel } from './StationLevel';
export { type SurfaceConfig, SurfaceLevel } from './SurfaceLevel';
// Types
export type {
  ILevel,
  LevelCallbacks,
  LevelConfig,
  LevelFactory,
  LevelFactoryRegistry,
  LevelId,
  LevelState,
  LevelType,
  TouchInputState,
} from './types';
export { CAMPAIGN_LEVELS } from './types';
// React hook
export {
  type LevelManagerActions,
  type LevelManagerState,
  type UseLevelManagerOptions,
  useLevelManager,
} from './useLevelManager';
