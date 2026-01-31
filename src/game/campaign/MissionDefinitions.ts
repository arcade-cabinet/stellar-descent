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
    // Issue #36: Add par time (no par for tutorial)
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
    audioLogCount: 2, // Issue #37: Fix - was 3, but CAMPAIGN_LEVELS says 2
    secretCount: 2,
    parTimeSeconds: 300, // Issue #38: 5 minutes par
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
    audioLogCount: 1, // Issue #39: Fix - was 2, but CAMPAIGN_LEVELS says 1
    secretCount: 2, // Issue #40: Fix - was 1, but CAMPAIGN_LEVELS says 2
    skullId: 'skull_famine',
    parTimeSeconds: 240, // 4 minutes par
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
    audioLogCount: 3, // Issue #41: Fix - was 5, but CAMPAIGN_LEVELS says 3
    secretCount: 3,
    skullId: 'skull_mythic',
    hasBonusAccess: 'mining_depths',
    parTimeSeconds: 480, // 8 minutes par
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
    audioLogCount: 2, // Issue #42: Fix - was 3, but CAMPAIGN_LEVELS says 2
    secretCount: 2,
    skullId: 'skull_thunderstorm',
    parTimeSeconds: 600, // 10 minutes par
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
    audioLogCount: 2, // Issue #43: Fix - was 4, but CAMPAIGN_LEVELS says 2
    secretCount: 3, // Issue #44: Fix - was 2, but CAMPAIGN_LEVELS says 3
    skullId: 'skull_blind',
    parTimeSeconds: 540, // 9 minutes par
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
    audioLogCount: 2, // Issue #45: Fix - was 3, but CAMPAIGN_LEVELS says 2
    secretCount: 3,
    skullId: 'skull_anger',
    bossId: 'chitin_queen', // Issue #46: Add boss tracking
    parTimeSeconds: 720, // 12 minutes par
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
    audioLogCount: 1, // Issue #47: Fix - was 2, but CAMPAIGN_LEVELS says 1
    secretCount: 2,
    skullId: 'skull_catch', // Issue #48: Missing skull for hive_assault
    parTimeSeconds: 900, // 15 minutes par
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
    secretCount: 2, // Issue #49: Fix - was 1, but CAMPAIGN_LEVELS says 2
    skullId: 'skull_grunt', // Issue #50: Missing skull for extraction
    parTimeSeconds: 360, // 6 minutes par
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
    audioLogCount: 0, // Issue #51: Fix - was 0, but CAMPAIGN_LEVELS says 1
    secretCount: 1, // Issue #52: Fix - was 0, but CAMPAIGN_LEVELS says 1
    parTimeSeconds: 180, // 3 minutes par
  },
};

// ============================================================================
// Bonus Levels (not in main linked list)
// ============================================================================

// Issue #72: Add MissionDefinition interface for bonus levels
export interface BonusLevelDefinition {
  displayName: string;
  type: string;
  returnLevelId: LevelId;
  audioLogCount: number;
  secretCount: number;
  skullId?: string;
}

export const BONUS_LEVELS: Record<string, BonusLevelDefinition> = {
  mining_depths: {
    displayName: 'Mining Depths',
    type: 'mine',
    returnLevelId: 'fob_delta', // Issue #73: Fix - should return to FOB Delta, not brothers_in_arms
    audioLogCount: 2,
    secretCount: 3,
    skullId: 'skull_cowbell',
  },
};

/**
 * Get mission definition for a level
 */
export function getMissionDefinition(levelId: LevelId): MissionDefinition {
  return MISSION_DEFINITIONS[levelId];
}

/**
 * Issue #57: Get total audio log count across all campaign levels
 */
export function getTotalAudioLogCount(): number {
  return Object.values(MISSION_DEFINITIONS).reduce(
    (total, mission) => total + mission.audioLogCount,
    0
  );
}

/**
 * Issue #58: Get total secret count across all campaign levels
 */
export function getTotalSecretCount(): number {
  return Object.values(MISSION_DEFINITIONS).reduce(
    (total, mission) => total + mission.secretCount,
    0
  );
}

/**
 * Issue #59: Get total skull count across all campaign levels
 */
export function getTotalSkullCount(): number {
  return Object.values(MISSION_DEFINITIONS).filter(
    (mission) => mission.skullId !== undefined
  ).length;
}

/**
 * Issue #60: Validate mission definitions match level configs
 */
export function validateMissionDefinitions(): string[] {
  const errors: string[] = [];
  const { CAMPAIGN_LEVELS } = require('../levels/types');

  for (const [levelId, mission] of Object.entries(MISSION_DEFINITIONS)) {
    const config = CAMPAIGN_LEVELS[levelId];
    if (!config) {
      errors.push(`Mission ${levelId} has no matching level config`);
      continue;
    }

    if (config.totalSecrets !== undefined && config.totalSecrets !== (mission as MissionDefinition).secretCount) {
      errors.push(`${levelId}: secretCount mismatch (mission: ${(mission as MissionDefinition).secretCount}, config: ${config.totalSecrets})`);
    }

    if (config.totalAudioLogs !== undefined && config.totalAudioLogs !== (mission as MissionDefinition).audioLogCount) {
      errors.push(`${levelId}: audioLogCount mismatch (mission: ${(mission as MissionDefinition).audioLogCount}, config: ${config.totalAudioLogs})`);
    }
  }

  return errors;
}
