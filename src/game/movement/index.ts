/**
 * Movement Module - Vertical Gameplay Mechanics
 *
 * Exports all movement-related systems for vertical gameplay:
 * - Mantling/Ledge Climbing
 * - Jetpack Boost
 * - Unified Vertical Movement Controller
 */

// Jetpack system
export {
  DEFAULT_JETPACK_CONFIG,
  disposeJetpackSystem,
  getJetpackSystem,
  type JetpackConfig,
  type JetpackState,
  JetpackSystem,
} from './JetpackSystem';
// Mantle system (includes ledge grab)
export {
  DEFAULT_MANTLE_CONFIG,
  disposeMantleSystem,
  getMantleSystem,
  type LedgeInfo,
  type MantleConfig,
  type MantlePhase,
  type MantleState,
  MantleSystem,
} from './MantleSystem';

// Unified vertical movement controller
export {
  DEFAULT_VERTICAL_CONFIG,
  disposeVerticalMovement,
  type GroundInfo,
  getVerticalMovement,
  type SurfaceType,
  VerticalMovement,
  type VerticalMovementConfig,
  type VerticalState,
} from './VerticalMovement';
