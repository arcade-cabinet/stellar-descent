// ============================================================================
// ANCHOR STATION PROMETHEUS - Tutorial Level
// ============================================================================
// The player's introduction to the game aboard the orbital staging base.
// Features modular GLB-based station construction and exploration rewards.
// ============================================================================

// Main level implementation (ILevel-compatible, uses modular GLB corridors)
export { AnchorStationLevel } from './AnchorStationLevel';
// Legacy curved corridor builder (ring station design)
export {
  type CurvedCorridorConfig,
  type CurvedCorridorResult,
  clampToCorridor,
  createCurvedCorridor,
  getPositionOnCorridor,
  isInCorridor,
} from './curvedCorridor';
// Legacy procedural environment
export {
  CURVED_CORRIDOR_CONFIGS,
  createStationEnvironment,
  ROOM_POSITIONS,
} from './environment';
// Modular Station Builder - snap-together GLB corridors
export {
  ANCHOR_STATION_LAYOUT,
  buildModularStation,
  DISCOVERY_POINTS,
  type DiscoveryPoint,
  getCurrentRoom,
  isPositionInStation,
  MODULAR_ROOM_POSITIONS,
  type ModularStationResult,
  ROOM_ATMOSPHERES,
  type RoomAtmosphere,
  type RoomDefinition,
  type StationLayout,
  type StationSegment,
} from './ModularStationBuilder';
// Modular Station Environment - GLB-based with interactive elements
export {
  createModularStationEnvironment,
  type HolodeckCallbacks,
  type ModularStationEnv,
  type ShootingRangeCallbacks,
} from './ModularStationEnvironment';

// Tutorial System
export { TutorialManager } from './TutorialManager';
export {
  type HUDUnlockState,
  PHASE_HUD_STATES,
  TUTORIAL_STEPS,
  type TutorialPhase,
  type TutorialStep,
} from './tutorialSteps';
