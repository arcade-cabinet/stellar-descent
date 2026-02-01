/**
 * Extraction Level Module
 *
 * Level 6: Escape the collapsing hive and hold out at LZ Omega
 *
 * This barrel file exports all public APIs from the extraction level.
 */

// Constants (for external configuration/testing)
export * from './constants';
// Environment builder
export {
  buildExtractionEnvironment,
  type ExtractionEnvironmentResult,
} from './ExtractionEnvironmentBuilder';
// Main orchestrator class
export { ExtractionLevel } from './orchestrator';
// Types
export type {
  CrumblingWall,
  DebrisChunk,
  Enemy,
  ExtractionPhase,
  FallingStalactite,
  HealthPickup,
  SupplyDrop,
} from './types';
