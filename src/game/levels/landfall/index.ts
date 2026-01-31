/**
 * Landfall Level Module
 *
 * Interactive HALO Drop Level - The player's orbital insertion into Kepler's Promise
 *
 * This barrel file exports all public APIs from the landfall level.
 */

// Main orchestrator class
export { LandfallLevel } from './orchestrator';

// Types
export type {
  DropPhase,
  LandingOutcome,
  Asteroid,
  AsteroidType,
  DistantThreat,
  DistantThreatType,
  SurfaceEnemy,
  EnemyState,
  SurfaceEnemySpecies,
  DistantThreatDefinition,
} from './types';

// Constants (for external configuration/testing)
export * from './constants';

// Environment components (for potential reuse)
export { buildLandfallEnvironment, setEnvironmentVisible, disposeEnvironment } from './LandfallEnvironment';
export type { LandfallEnvironmentNodes } from './LandfallEnvironment';
