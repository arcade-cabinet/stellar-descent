/**
 * Canyon Run Level - Vehicle Chase Sequence (Chapter 3)
 *
 * Exports for the canyon run level module:
 * - CanyonRunLevel: Main level class (extends SurfaceLevel)
 * - VehicleController: Player vehicle physics and controls
 * - Environment utilities for canyon terrain generation
 */

export { CanyonRunLevel } from './CanyonRunLevel';
export type {
  BridgeStructure,
  CanyonEnvironment,
  ObjectiveMarker,
  RockslideRock,
  TerrainSample,
} from './environment';
export {
  BRIDGE_Z,
  CANYON_HALF_WIDTH,
  CANYON_LENGTH,
  collapseBridge,
  createCanyonEnvironment,
  EXTRACTION_Z,
  sampleTerrainHeight,
  spawnRockslide,
} from './environment';
export type { VehicleConfig, VehicleInput, VehicleState } from './VehicleController';
export { VehicleController } from './VehicleController';
