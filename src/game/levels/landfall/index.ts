/**
 * Landfall Level Module
 *
 * Interactive HALO Drop Level - The player's orbital insertion into Kepler's Promise
 *
 * This barrel file exports all public APIs from the landfall level.
 */

// Additional exports for testing and reuse
export * from './comms';
// Constants (for external configuration/testing)
export * from './constants';
export { calculateLandingDamage } from './descent';
export type { LandfallEnvironmentNodes } from './LandfallEnvironment';
// Environment components (for potential reuse)
export {
  buildLandfallEnvironment,
  disposeEnvironment,
  setEnvironmentVisible,
  updateEnvironmentLOD,
  updateOrbitalStation,
} from './LandfallEnvironment';
// Main orchestrator class
export { LandfallLevel } from './orchestrator';
// Types
export type {
  Asteroid,
  AsteroidType,
  DistantSpaceship,
  DistantSpaceshipDefinition,
  DistantSpaceshipType,
  DistantThreat,
  DistantThreatDefinition,
  DistantThreatType,
  DropPhase,
  EnemyState,
  LandingOutcome,
  SurfaceEnemy,
  SurfaceEnemySpecies,
} from './types';
