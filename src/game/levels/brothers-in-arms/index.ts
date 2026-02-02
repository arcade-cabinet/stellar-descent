// Re-export steering AI from the ai folder for convenience
export type {
  FlankingState,
  MarcusSteeringConfig,
  SteeringMode,
  SteeringResult,
  TargetCallout,
} from '../../ai/MarcusSteeringAI';
export { MarcusSteeringAI } from '../../ai/MarcusSteeringAI';
export { BrothersInArmsLevel } from './BrothersInArmsLevel';
export { COMMS, NOTIFICATIONS, OBJECTIVES, ReunionCinematic } from './cinematics';
export type {
  CombatTarget,
  CoordinatedAttack,
  MarcusCombatCallbacks,
  MarcusCombatConfig,
  MarcusCombatState,
} from './MarcusCombatAI';
export { COMBAT_CALLOUTS, MarcusCombatAI } from './MarcusCombatAI';
export type {
  CoordinationCombatState,
  CoordinationRequest,
  CoordinationTarget,
  CoordinatorCallbacks,
  MarcusStatusUpdate,
  TacticalCalloutType,
} from './MarcusCombatCoordinator';
export { MarcusCombatCoordinator } from './MarcusCombatCoordinator';
export type { BanterConfig, DialogueTrigger } from './marcusBanter';
export { createMarcusBanterManager, MarcusBanterManager } from './marcusBanter';
