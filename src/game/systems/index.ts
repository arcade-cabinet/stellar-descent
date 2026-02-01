/**
 * Game Systems Index
 *
 * Exports all game systems for easy importing.
 */

// AI System
export { AISystem } from './aiSystem';

// Combat System
export { CombatSystem, type ProjectileInfo, type ProjectileType } from './combatSystem';

// Hit Reaction System
export { HitReactionSystem, hitReactionSystem } from './HitReactionSystem';

// Player Governor
export { getPlayerGovernor, PlayerGovernor, resetPlayerGovernor } from './PlayerGovernor';

// Trigger System
export {
  type BaseTriggerConfig,
  type CollectibleTriggerConfig,
  type CombatTriggerConfig,
  createCombatTrigger,
  createInteractionTrigger,
  createLineOfSightTrigger,
  // Factory functions
  createVolumeTrigger,
  disposeTriggerSystem,
  getTriggerSystem,
  type InteractionTriggerConfig,
  type LineOfSightTriggerConfig,
  type ProximityTriggerConfig,
  type TriggerCondition,
  type TriggerConfig,
  type TriggerEvent,
  type TriggerGroup,
  type TriggerShape,
  type TriggerState,
  TriggerSystem,
  // Types
  type TriggerType,
  type VolumeTriggerConfig,
} from './TriggerSystem';
