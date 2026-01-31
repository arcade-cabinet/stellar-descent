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
  DistantSpaceship,
  DistantSpaceshipType,
  DistantSpaceshipDefinition,
  SurfaceEnemy,
  EnemyState,
  SurfaceEnemySpecies,
  DistantThreatDefinition,
} from './types';

// Constants (for external configuration/testing)
export * from './constants';

// Environment components (for potential reuse)
export {
  buildLandfallEnvironment,
  setEnvironmentVisible,
  disposeEnvironment,
  updateEnvironmentLOD,
  updateOrbitalStation,
} from './LandfallEnvironment';
export type { LandfallEnvironmentNodes } from './LandfallEnvironment';

// Additional exports for testing and reuse
export * from './comms';
export { calculateLandingDamage } from './descent';
