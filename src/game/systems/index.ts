/**
 * Game Systems Index
 *
 * Exports all game systems for easy importing.
 */

// AI System
export { AISystem } from './aiSystem';

// Combat System
export { CombatSystem, type ProjectileType, type ProjectileInfo } from './combatSystem';

// Hit Reaction System
export { hitReactionSystem, HitReactionSystem } from './HitReactionSystem';

// Player Governor
export { PlayerGovernor, getPlayerGovernor, resetPlayerGovernor } from './PlayerGovernor';

// Trigger System
export {
  TriggerSystem,
  getTriggerSystem,
  disposeTriggerSystem,
  // Factory functions
  createVolumeTrigger,
  createInteractionTrigger,
  createCombatTrigger,
  createLineOfSightTrigger,
  // Types
  type TriggerType,
  type TriggerShape,
  type TriggerState,
  type TriggerCondition,
  type BaseTriggerConfig,
  type VolumeTriggerConfig,
  type ProximityTriggerConfig,
  type InteractionTriggerConfig,
  type LineOfSightTriggerConfig,
  type CombatTriggerConfig,
  type CollectibleTriggerConfig,
  type TriggerConfig,
  type TriggerGroup,
  type TriggerEvent,
} from './TriggerSystem';
