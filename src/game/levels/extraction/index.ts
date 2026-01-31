/**
 * Extraction Level Module
 *
 * Level 6: Escape the collapsing hive and hold out at LZ Omega
 *
 * This barrel file exports all public APIs from the extraction level.
 */

// Main orchestrator class
export { ExtractionLevel } from './orchestrator';

// Types
export type {
  ExtractionPhase,
  Enemy,
  DebrisChunk,
  FallingStalactite,
  HealthPickup,
  CrumblingWall,
  SupplyDrop,
} from './types';

// Constants (for external configuration/testing)
export * from './constants';

// Environment builder
export { buildExtractionEnvironment, type ExtractionEnvironmentResult } from './ExtractionEnvironmentBuilder';
