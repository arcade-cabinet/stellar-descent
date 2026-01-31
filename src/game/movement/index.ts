/**
 * Movement Module - Vertical Gameplay Mechanics
 *
 * Exports all movement-related systems for vertical gameplay:
 * - Mantling/Ledge Climbing
 * - Jetpack Boost
 * - Unified Vertical Movement Controller
 */

// Mantle system (includes ledge grab)
export {
  MantleSystem,
  getMantleSystem,
  disposeMantleSystem,
  DEFAULT_MANTLE_CONFIG,
  type MantleConfig,
  type MantleState,
  type MantlePhase,
  type LedgeInfo,
} from './MantleSystem';

// Jetpack system
export {
  JetpackSystem,
  getJetpackSystem,
  disposeJetpackSystem,
  DEFAULT_JETPACK_CONFIG,
  type JetpackConfig,
  type JetpackState,
} from './JetpackSystem';

// Unified vertical movement controller
export {
  VerticalMovement,
  getVerticalMovement,
  disposeVerticalMovement,
  DEFAULT_VERTICAL_CONFIG,
  type VerticalMovementConfig,
  type VerticalState,
  type GroundInfo,
  type SurfaceType,
} from './VerticalMovement';
