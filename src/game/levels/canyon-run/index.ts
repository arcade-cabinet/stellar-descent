/**
 * Canyon Run Level - Vehicle Chase Sequence (Chapter 3)
 *
 * Exports for the canyon run level module:
 * - CanyonRunLevel: Main level class (extends SurfaceLevel)
 * - VehicleController: Player vehicle physics and controls
 * - Environment utilities for canyon terrain generation
 */

export { CanyonRunLevel } from './CanyonRunLevel';
export { VehicleController } from './VehicleController';
export type { VehicleConfig, VehicleInput, VehicleState } from './VehicleController';
export {
  BRIDGE_Z,
  CANYON_HALF_WIDTH,
  CANYON_LENGTH,
  EXTRACTION_Z,
  collapseBridge,
  createCanyonEnvironment,
  sampleTerrainHeight,
  spawnRockslide,
} from './environment';
export type {
  BridgeStructure,
  CanyonEnvironment,
  ObjectiveMarker,
  RockslideRock,
  TerrainSample,
} from './environment';
