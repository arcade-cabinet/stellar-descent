/**
 * MissionDefinitions - Static data for all campaign missions
 *
 * Defines per-level objectives, vehicle availability, dialogue triggers,
 * collectible counts, and bonus level access.
 */

import type { LevelId } from '../levels/types';
import type { MissionDefinition } from './types';

// ============================================================================
// Campaign Mission Definitions (10 levels, linear linked list)
// ============================================================================

export const MISSION_DEFINITIONS: Record<LevelId, MissionDefinition> = {
  anchor_station: {
    levelId: 'anchor_station',
    objectives: [
      { id: 'tutorial_movement', description: 'Complete movement training', type: 'primary' },
      { id: 'tutorial_combat', description: 'Complete combat training', type: 'primary' },
      { id: 'tutorial_interact', description: 'Board the drop pod', type: 'primary' },
      { id: 'explore_barracks', description: 'Explore the barracks', type: 'optional' },
    ],
    dialogueTriggers: [
      'tutorial_start',
      'tutorial_movement',
      'tutorial_combat',
      'tutorial_complete',
    ],
    audioLogCount: 2,
    secretCount: 1,
    skullId: 'skull_iron',
  },

  landfall: {
    levelId: 'landfall',
    objectives: [
      { id: 'survive_drop', description: 'Survive orbital drop', type: 'primary' },
      { id: 'reach_surface', description: 'Reach the surface', type: 'primary' },
      { id: 'clear_lz', description: 'Clear the landing zone', type: 'primary' },
      { id: 'find_beacon', description: 'Locate FOB Delta beacon', type: 'optional' },
    ],
    dialogueTriggers: ['drop_start', 'hostiles_detected', 'lz_clear'],
    audioLogCount: 3,
    secretCount: 2,
  },

  canyon_run: {
    levelId: 'canyon_run',
    objectives: [
      { id: 'reach_fob', description: 'Reach FOB Delta through the canyon', type: 'primary' },
      { id: 'survive_pursuit', description: 'Survive the Wraith pursuit', type: 'primary' },
      { id: 'destroy_roadblocks', description: 'Destroy alien roadblocks (0/3)', type: 'optional' },
    ],
    vehicleIds: ['wraith_tank'],
    dialogueTriggers: ['canyon_entry', 'wraith_spotted', 'canyon_exit'],
    audioLogCount: 2,
    secretCount: 1,
    skullId: 'skull_famine',
  },

  fob_delta: {
    levelId: 'fob_delta',
    objectives: [
      { id: 'investigate_fob', description: 'Investigate FOB Delta', type: 'primary' },
      { id: 'restore_power', description: 'Restore power to the base', type: 'primary' },
      { id: 'find_intel', description: 'Find VANGUARD team intel', type: 'primary' },
      { id: 'mining_outpost', description: 'Access Mining Outpost Gamma-7', type: 'optional' },
    ],
    dialogueTriggers: [
      'fob_entry',
      'fob_delta_lights_out',
      'power_restored',
      'intel_found',
      'hive_entrance_found',
    ],
    audioLogCount: 5,
    secretCount: 3,
    skullId: 'skull_mythic',
    hasBonusAccess: 'mining_depths',
  },

  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    objectives: [
      { id: 'find_marcus', description: 'Locate Corporal Marcus Cole', type: 'primary' },
      { id: 'defend_position', description: 'Defend position with Marcus', type: 'primary' },
      { id: 'reach_extraction', description: 'Reach extraction point', type: 'primary' },
      { id: 'investigate_sinkhole', description: 'Investigate the sinkhole', type: 'optional' },
    ],
    dialogueTriggers: ['marcus_found', 'combat_start', 'sinkhole_discovered'],
    audioLogCount: 3,
    secretCount: 2,
    skullId: 'skull_thunderstorm',
  },

  southern_ice: {
    levelId: 'southern_ice',
    objectives: [
      { id: 'traverse_ice', description: 'Traverse the frozen wasteland', type: 'primary' },
      { id: 'find_outpost', description: 'Find the abandoned outpost', type: 'primary' },
      { id: 'survive_blizzard', description: 'Survive the blizzard', type: 'primary' },
      { id: 'ice_cave_exploration', description: 'Explore the ice caves', type: 'optional' },
    ],
    dialogueTriggers: ['ice_entry', 'outpost_found', 'blizzard_start', 'cave_entrance'],
    audioLogCount: 4,
    secretCount: 2,
    skullId: 'skull_blind',
  },

  the_breach: {
    levelId: 'the_breach',
    objectives: [
      { id: 'enter_hive', description: 'Enter the hive', type: 'primary' },
      { id: 'reach_queen', description: "Reach the Queen's chamber", type: 'primary' },
      { id: 'defeat_queen', description: 'Defeat the Chitin Queen', type: 'primary' },
      { id: 'find_hive_core', description: 'Find the hive core sample', type: 'optional' },
    ],
    dialogueTriggers: ['hive_entry', 'queen_chamber', 'queen_defeated'],
    audioLogCount: 3,
    secretCount: 3,
    skullId: 'skull_anger',
  },

  hive_assault: {
    levelId: 'hive_assault',
    objectives: [
      { id: 'assault_surface', description: 'Lead the surface assault', type: 'primary' },
      { id: 'breach_hive', description: 'Breach the hive entrance', type: 'primary' },
      { id: 'destroy_nexus', description: 'Destroy nexus nodes (0/3)', type: 'primary' },
      { id: 'rescue_marines', description: 'Rescue trapped marines', type: 'optional' },
    ],
    vehicleIds: ['wraith_tank', 'phantom_dropship'],
    dialogueTriggers: ['assault_begin', 'hive_breach', 'nexus_destroyed', 'marines_found'],
    audioLogCount: 2,
    secretCount: 2,
  },

  extraction: {
    levelId: 'extraction',
    objectives: [
      { id: 'escape_hive', description: 'Escape the collapsing hive', type: 'primary' },
      { id: 'reach_lz', description: 'Reach LZ Omega', type: 'primary' },
      { id: 'hold_lz', description: 'Hold LZ Omega until extraction', type: 'primary' },
      { id: 'save_all_squad', description: 'Keep all squad members alive', type: 'optional' },
    ],
    vehicleIds: ['phantom_dropship'],
    dialogueTriggers: [
      'extraction_start',
      'extraction_countdown',
      'lz_reached',
      'mission_complete',
    ],
    audioLogCount: 1,
    secretCount: 1,
  },

  final_escape: {
    levelId: 'final_escape',
    objectives: [
      { id: 'outrun_collapse', description: 'Outrun the terrain collapse', type: 'primary' },
      { id: 'reach_dropship', description: 'Reach the Phantom dropship', type: 'primary' },
      { id: 'no_casualties', description: 'Complete with no casualties', type: 'optional' },
    ],
    vehicleIds: ['phantom_dropship'],
    dialogueTriggers: ['escape_start', 'terrain_collapsing', 'dropship_inbound', 'escape_complete'],
    audioLogCount: 0,
    secretCount: 0,
  },
};

// ============================================================================
// Bonus Levels (not in main linked list)
// ============================================================================

export const BONUS_LEVELS: Record<
  string,
  { displayName: string; type: string; returnLevelId: LevelId }
> = {
  mining_depths: {
    displayName: 'Mining Depths',
    type: 'mine',
    returnLevelId: 'brothers_in_arms',
  },
};

/**
 * Get mission definition for a level
 */
export function getMissionDefinition(levelId: LevelId): MissionDefinition {
  return MISSION_DEFINITIONS[levelId];
}
