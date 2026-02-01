/**
 * QuestChain - Campaign Quest System
 *
 * This module defines the quest chain that wires all 10 campaign levels together.
 * It handles both:
 * - MAIN QUESTS: Linear campaign progression through levels
 * - BRANCH QUESTS: Optional side content found from objects/NPCs
 *
 * The quest system drives:
 * - What the player should do next in each level
 * - Dialogue triggers for Commander Reyes
 * - Objective markers and compass navigation
 * - Unlocking additional areas and content
 *
 * Design Philosophy:
 * - Quests are discovered organically in-world (no menu popups)
 * - Main quests auto-activate when entering a level
 * - Branch quests are triggered by interacting with objects/NPCs
 * - All quests integrate with the dialogue and achievement systems
 */

import type { LevelId } from '../levels/types';

// ============================================================================
// QUEST TYPES AND ENUMS
// ============================================================================

/** Quest status progression */
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed';

/** Quest category */
export type QuestType = 'main' | 'branch' | 'secret';

/** What triggers a quest to become available */
export type QuestTriggerType =
  | 'level_enter' // Auto-trigger when entering a level
  | 'quest_complete' // Trigger when another quest completes
  | 'object_interact' // Trigger from interacting with world object
  | 'npc_dialogue' // Trigger from talking to an NPC
  | 'collectible_found' // Trigger from finding a collectible
  | 'area_enter' // Trigger from entering a specific area
  | 'enemy_killed' // Trigger from killing specific enemy type
  | 'manual'; // Triggered programmatically

/** Objective types within a quest */
export type ObjectiveType =
  | 'reach_location' // Go to waypoint
  | 'interact' // Use an object/terminal
  | 'kill_enemies' // Defeat enemies (count-based)
  | 'kill_target' // Defeat specific enemy
  | 'survive' // Survive for duration
  | 'escort' // Keep NPC alive
  | 'collect' // Find items
  | 'defend' // Protect location
  | 'follow' // Follow NPC/waypoints
  | 'vehicle' // Drive/fly to destination
  | 'stealth' // Avoid detection
  | 'custom'; // Level-specific logic

// ============================================================================
// QUEST OBJECTIVE DEFINITION
// ============================================================================

/** A single objective within a quest */
export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;

  // Progress tracking
  required?: number; // For count-based objectives (kill 5, collect 3)
  current?: number; // Current progress

  // Location data
  targetPosition?: { x: number; y: number; z: number };
  targetRadius?: number; // How close to get

  // Timing
  timeLimit?: number; // Optional time limit in seconds

  // Display
  showMarker?: boolean; // Show objective marker
  markerLabel?: string; // Label for marker
  compassIcon?: string; // Icon for compass

  // Triggers
  dialogueOnStart?: string; // Dialogue trigger when objective starts
  dialogueOnComplete?: string; // Dialogue trigger when objective completes

  // State
  status?: 'pending' | 'active' | 'completed' | 'failed';
  completedAt?: number; // Timestamp (game time microseconds)
}

// ============================================================================
// QUEST DEFINITION
// ============================================================================

/** Complete quest definition */
export interface QuestDefinition {
  id: string;
  type: QuestType;
  levelId: LevelId; // Which level this quest belongs to

  // Display
  name: string;
  description: string;
  briefDescription?: string; // Short version for HUD

  // Objectives (ordered)
  objectives: QuestObjective[];

  // Triggers
  triggerType: QuestTriggerType;
  triggerData?: {
    questId?: string; // For quest_complete trigger
    objectId?: string; // For object_interact trigger
    npcId?: string; // For npc_dialogue trigger
    collectibleId?: string; // For collectible_found trigger
    areaId?: string; // For area_enter trigger
    enemyType?: string; // For enemy_killed trigger
  };

  // Prerequisites
  prerequisites?: {
    quests?: string[]; // Required completed quests
    levels?: LevelId[]; // Required completed levels
    items?: string[]; // Required inventory items
  };

  // Rewards
  rewards?: {
    unlockArea?: string; // Unlock a hidden area
    unlockQuest?: string; // Unlock another quest
    giveItem?: string; // Add item to inventory
    achievement?: string; // Trigger achievement
    dialogue?: string; // Play reward dialogue
  };

  // Branching
  nextQuestId?: string; // Main chain: next quest in sequence
  branchQuests?: string[]; // Optional quests this unlocks

  // Failure conditions
  failOnDeath?: boolean; // Fail if player dies
  failOnTimer?: boolean; // Fail if timer expires
  canRetry?: boolean; // Can restart after failure
}

// ============================================================================
// QUEST STATE (RUNTIME)
// ============================================================================

/** Runtime state for a quest */
export interface QuestState {
  questId: string;
  status: QuestStatus;
  currentObjectiveIndex: number;
  objectiveProgress: Record<string, number>; // objectiveId -> progress
  objectiveStatus: Record<string, QuestObjective['status']>;
  startedAt?: number; // Game time microseconds
  completedAt?: number; // Game time microseconds
  failedAt?: number; // Game time microseconds
  failReason?: string;
}

// ============================================================================
// MAIN CAMPAIGN QUEST CHAIN
// ============================================================================

/**
 * Main quest chain - one quest per level that drives the campaign forward.
 * These auto-activate when entering each level.
 */
export const MAIN_QUEST_CHAIN: QuestDefinition[] = [
  // -------------------------------------------------------------------------
  // ACT 1: THE DROP
  // -------------------------------------------------------------------------
  {
    id: 'main_anchor_station',
    type: 'main',
    levelId: 'anchor_station',
    name: 'Prep for Deployment',
    description:
      "Complete pre-mission briefing and board the drop pod for deployment to Kepler's Promise.",
    briefDescription: 'Report to Commander Reyes',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'anchor_wake',
        type: 'reach_location',
        description: 'Exit barracks and proceed to briefing room',
        targetPosition: { x: 0, y: 1.7, z: 15 },
        targetRadius: 3,
        showMarker: true,
        markerLabel: 'BRIEFING',
        dialogueOnStart: 'briefing_anchor_station',
      },
      {
        id: 'anchor_briefing',
        type: 'interact',
        description: 'Attend mission briefing from Commander Reyes',
        dialogueOnComplete: 'objective_complete',
      },
      {
        id: 'anchor_holodeck',
        type: 'reach_location',
        description: 'Complete combat training in the holodeck',
        targetPosition: { x: -20, y: 1.7, z: 0 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'TRAINING',
      },
      {
        id: 'anchor_training',
        type: 'custom',
        description: 'Complete movement and combat exercises',
      },
      {
        id: 'anchor_armory',
        type: 'reach_location',
        description: 'Collect weapons from the armory',
        targetPosition: { x: 15, y: 1.7, z: -10 },
        targetRadius: 3,
        showMarker: true,
        markerLabel: 'ARMORY',
      },
      {
        id: 'anchor_droppod',
        type: 'reach_location',
        description: 'Board drop pod in Bay 7',
        targetPosition: { x: 0, y: 1.7, z: -30 },
        targetRadius: 2,
        showMarker: true,
        markerLabel: 'DROP POD',
        dialogueOnComplete: 'drop_pod_ready',
      },
    ],
    nextQuestId: 'main_landfall',
    branchQuests: ['branch_anchor_marcus_letter', 'branch_anchor_observation'],
    failOnDeath: false,
    canRetry: true,
  },

  {
    id: 'main_landfall',
    type: 'main',
    levelId: 'landfall',
    name: 'Planetfall',
    description: "Survive the HALO drop and establish a foothold on Kepler's Promise surface.",
    briefDescription: 'Survive the drop',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'landfall_drop',
        type: 'survive',
        description: 'Control descent through atmosphere',
        dialogueOnStart: 'briefing_landfall',
      },
      {
        id: 'landfall_chute',
        type: 'custom',
        description: 'Deploy emergency chute at correct altitude',
      },
      {
        id: 'landfall_regroup',
        type: 'reach_location',
        description: 'Reach rally point and assess situation',
        targetPosition: { x: 50, y: 1.7, z: 100 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'RALLY',
      },
      {
        id: 'landfall_combat',
        type: 'kill_enemies',
        description: 'Clear hostiles from crash site',
        required: 10,
        dialogueOnStart: 'hostiles_detected',
        dialogueOnComplete: 'hostiles_cleared',
      },
      {
        id: 'landfall_extract',
        type: 'reach_location',
        description: 'Proceed to vehicle depot for extraction',
        targetPosition: { x: 200, y: 1.7, z: 300 },
        targetRadius: 15,
        showMarker: true,
        markerLabel: 'DEPOT',
      },
    ],
    nextQuestId: 'main_canyon_run',
    branchQuests: ['branch_landfall_survivor', 'branch_landfall_cache'],
    failOnDeath: true,
    canRetry: true,
  },

  // -------------------------------------------------------------------------
  // ACT 2: THE SEARCH
  // -------------------------------------------------------------------------
  {
    id: 'main_canyon_run',
    type: 'main',
    levelId: 'canyon_run',
    name: 'Canyon Run',
    description:
      'Race through the canyon system to reach FOB Delta before hostile reinforcements arrive.',
    briefDescription: 'Reach FOB Delta',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'canyon_vehicle',
        type: 'vehicle',
        description: 'Board the Warthog and head south',
        dialogueOnStart: 'briefing_canyon_run',
      },
      {
        id: 'canyon_checkpoint1',
        type: 'reach_location',
        description: 'Navigate through the narrow pass',
        targetPosition: { x: 0, y: 0, z: 500 },
        targetRadius: 50,
        showMarker: true,
        markerLabel: 'PASS',
      },
      {
        id: 'canyon_pursuit',
        type: 'survive',
        description: 'Outrun enemy Wraith pursuers',
        dialogueOnStart: 'enemy_vehicles_detected',
      },
      {
        id: 'canyon_bridge',
        type: 'reach_location',
        description: 'Cross the unstable bridge',
        targetPosition: { x: 100, y: 0, z: 1500 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'BRIDGE',
      },
      {
        id: 'canyon_fob',
        type: 'reach_location',
        description: 'Reach FOB Delta entrance',
        targetPosition: { x: 0, y: 0, z: 3000 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'FOB DELTA',
        dialogueOnComplete: 'fob_approach',
      },
    ],
    nextQuestId: 'main_fob_delta',
    branchQuests: ['branch_canyon_shortcut', 'branch_canyon_convoy'],
    failOnDeath: true,
    canRetry: true,
  },

  {
    id: 'main_fob_delta',
    type: 'main',
    levelId: 'fob_delta',
    name: 'Ghost Base',
    description: 'Investigate the abandoned FOB Delta and discover what happened to VANGUARD team.',
    briefDescription: 'Find VANGUARD intel',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'fob_enter',
        type: 'reach_location',
        description: 'Breach the main entrance',
        dialogueOnStart: 'briefing_fob_delta',
        targetPosition: { x: 0, y: 1.7, z: 10 },
        targetRadius: 3,
        showMarker: true,
        markerLabel: 'ENTRANCE',
      },
      {
        id: 'fob_power',
        type: 'interact',
        description: 'Restore emergency power',
        dialogueOnComplete: 'power_restored',
      },
      {
        id: 'fob_comms',
        type: 'reach_location',
        description: 'Access communications center',
        targetPosition: { x: -30, y: 1.7, z: 50 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'COMMS',
      },
      {
        id: 'fob_logs',
        type: 'collect',
        description: 'Retrieve VANGUARD team logs',
        required: 3,
      },
      {
        id: 'fob_marcus_signal',
        type: 'custom',
        description: "Analyze distress beacon - it's Marcus!",
        dialogueOnComplete: 'marcus_signal_found',
      },
      {
        id: 'fob_exit',
        type: 'reach_location',
        description: 'Exit through mining tunnel to reach Marcus',
        targetPosition: { x: 50, y: -5, z: 100 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'TUNNEL',
      },
    ],
    nextQuestId: 'main_brothers',
    branchQuests: ['branch_fob_armory', 'branch_fob_medical', 'branch_fob_survivor'],
    failOnDeath: true,
    canRetry: true,
  },

  {
    id: 'main_brothers',
    type: 'main',
    levelId: 'brothers_in_arms',
    name: 'Brothers in Arms',
    description:
      'Reunite with your brother Marcus and fight together to push back the alien assault.',
    briefDescription: 'Find Marcus',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'brothers_locate',
        type: 'reach_location',
        description: "Follow Marcus's beacon signal",
        dialogueOnStart: 'briefing_brothers',
        targetPosition: { x: 100, y: 1.7, z: 200 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'SIGNAL',
      },
      {
        id: 'brothers_reunion',
        type: 'custom',
        description: 'Rendezvous with Marcus',
        dialogueOnComplete: 'marcus_reunion',
      },
      {
        id: 'brothers_defend',
        type: 'defend',
        description: 'Defend position while Marcus repairs his mech',
        required: 60, // 60 seconds
        dialogueOnStart: 'hold_position',
      },
      {
        id: 'brothers_mech',
        type: 'escort',
        description: "Fight alongside Marcus's Atlas mech",
        dialogueOnStart: 'mech_online',
      },
      {
        id: 'brothers_push',
        type: 'reach_location',
        description: 'Push south toward the ice fields',
        targetPosition: { x: 0, y: 1.7, z: 500 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'SOUTH',
      },
      {
        id: 'brothers_clear',
        type: 'kill_enemies',
        description: 'Eliminate remaining hostiles',
        required: 25,
        dialogueOnComplete: 'area_secured',
      },
    ],
    nextQuestId: 'main_southern_ice',
    branchQuests: ['branch_brothers_cache', 'branch_brothers_memorial'],
    failOnDeath: true,
    canRetry: true,
  },

  // -------------------------------------------------------------------------
  // ACT 3: THE TRUTH
  // -------------------------------------------------------------------------
  {
    id: 'main_southern_ice',
    type: 'main',
    levelId: 'southern_ice',
    name: 'Frozen Hell',
    description: 'Cross the frozen southern wastes and locate the entrance to the alien hive.',
    briefDescription: 'Find the hive entrance',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'ice_traverse',
        type: 'reach_location',
        description: 'Navigate the ice fields',
        dialogueOnStart: 'briefing_southern_ice',
        targetPosition: { x: 200, y: 1.7, z: 400 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'WAYPOINT',
      },
      {
        id: 'ice_storm',
        type: 'survive',
        description: 'Survive the blizzard - find shelter',
        dialogueOnStart: 'storm_warning',
      },
      {
        id: 'ice_chitin',
        type: 'kill_enemies',
        description: 'Defeat the Ice Chitin ambush',
        required: 8,
        dialogueOnStart: 'new_enemy_detected',
      },
      {
        id: 'ice_caves',
        type: 'reach_location',
        description: 'Enter the thermal caves',
        targetPosition: { x: 500, y: -10, z: 800 },
        targetRadius: 15,
        showMarker: true,
        markerLabel: 'CAVES',
      },
      {
        id: 'ice_hive_entrance',
        type: 'reach_location',
        description: 'Locate the hive breach point',
        targetPosition: { x: 600, y: -50, z: 1000 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'BREACH',
        dialogueOnComplete: 'hive_entrance_found',
      },
    ],
    nextQuestId: 'main_breach',
    branchQuests: ['branch_ice_research', 'branch_ice_survivor'],
    failOnDeath: true,
    canRetry: true,
  },

  {
    id: 'main_breach',
    type: 'main',
    levelId: 'the_breach',
    name: 'Into the Breach',
    description: 'Descend into the hive and confront the alien Queen.',
    briefDescription: 'Kill the Queen',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'breach_descent',
        type: 'reach_location',
        description: 'Descend into the hive tunnels',
        dialogueOnStart: 'briefing_breach',
        targetPosition: { x: 0, y: -100, z: 200 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'DESCEND',
      },
      {
        id: 'breach_navigate',
        type: 'custom',
        description: 'Navigate the organic tunnels',
      },
      {
        id: 'breach_ambush',
        type: 'kill_enemies',
        description: 'Fight through the Chitin swarm',
        required: 30,
        dialogueOnStart: 'massive_contact',
      },
      {
        id: 'breach_lair',
        type: 'reach_location',
        description: "Reach the Queen's chamber",
        targetPosition: { x: 0, y: -200, z: 500 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: "QUEEN'S LAIR",
        dialogueOnStart: 'queen_detected',
      },
      {
        id: 'breach_queen',
        type: 'kill_target',
        description: 'Defeat the Alien Queen',
        dialogueOnComplete: 'queen_defeated',
      },
      {
        id: 'breach_escape',
        type: 'reach_location',
        description: 'Escape the collapsing chamber',
        timeLimit: 120,
        targetPosition: { x: 0, y: -50, z: 0 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'EXIT',
      },
    ],
    nextQuestId: 'main_hive_assault',
    branchQuests: ['branch_breach_eggs', 'branch_breach_artifact'],
    failOnDeath: true,
    failOnTimer: true,
    canRetry: true,
  },

  // -------------------------------------------------------------------------
  // ACT 4: ENDGAME
  // -------------------------------------------------------------------------
  {
    id: 'main_hive_assault',
    type: 'main',
    levelId: 'hive_assault',
    name: 'Hive Assault',
    description: 'Lead the combined assault to plant charges and destroy the hive core.',
    briefDescription: 'Destroy the hive',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'assault_rally',
        type: 'reach_location',
        description: 'Rally with marine reinforcements',
        dialogueOnStart: 'briefing_hive_assault',
        targetPosition: { x: 0, y: 1.7, z: 50 },
        targetRadius: 15,
        showMarker: true,
        markerLabel: 'MARINES',
      },
      {
        id: 'assault_push',
        type: 'reach_location',
        description: 'Push into the hive with fire support',
        targetPosition: { x: 100, y: -20, z: 200 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'ADVANCE',
      },
      {
        id: 'assault_clear',
        type: 'kill_enemies',
        description: 'Clear the breeding chambers',
        required: 50,
        dialogueOnStart: 'push_forward',
      },
      {
        id: 'assault_charges',
        type: 'interact',
        description: 'Plant demolition charges (3)',
        required: 3,
      },
      {
        id: 'assault_core',
        type: 'reach_location',
        description: 'Reach the hive core',
        targetPosition: { x: 0, y: -100, z: 500 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'CORE',
      },
      {
        id: 'assault_detonate',
        type: 'interact',
        description: 'Arm final charge and evacuate',
        dialogueOnComplete: 'charges_set',
      },
    ],
    nextQuestId: 'main_extraction',
    branchQuests: ['branch_assault_wounded'],
    failOnDeath: true,
    canRetry: true,
  },

  {
    id: 'main_extraction',
    type: 'main',
    levelId: 'extraction',
    name: 'Extraction',
    description: 'Fight to LZ Omega and hold until evac arrives.',
    briefDescription: 'Reach extraction point',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'extract_surface',
        type: 'reach_location',
        description: 'Escape to the surface',
        dialogueOnStart: 'briefing_extraction',
        targetPosition: { x: 0, y: 1.7, z: 100 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'SURFACE',
      },
      {
        id: 'extract_lz',
        type: 'reach_location',
        description: 'Fight to LZ Omega',
        targetPosition: { x: 200, y: 1.7, z: 500 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'LZ OMEGA',
      },
      {
        id: 'extract_wave1',
        type: 'defend',
        description: 'Hold the LZ - Wave 1',
        required: 90,
        dialogueOnStart: 'defend_lz',
      },
      {
        id: 'extract_wave2',
        type: 'defend',
        description: 'Hold the LZ - Wave 2',
        required: 120,
        dialogueOnStart: 'more_contacts',
      },
      {
        id: 'extract_wave3',
        type: 'defend',
        description: 'Hold the LZ - Final Wave',
        required: 90,
        dialogueOnStart: 'final_wave',
      },
      {
        id: 'extract_dropship',
        type: 'custom',
        description: 'Board the Phantom dropship',
        dialogueOnStart: 'dropship_inbound',
        dialogueOnComplete: 'evac_complete',
      },
    ],
    nextQuestId: 'main_final_escape',
    branchQuests: [],
    failOnDeath: true,
    canRetry: true,
  },

  {
    id: 'main_final_escape',
    type: 'main',
    levelId: 'final_escape',
    name: 'Final Escape',
    description: "Outrun the hive collapse and escape Kepler's Promise.",
    briefDescription: 'Escape the planet',
    triggerType: 'level_enter',
    objectives: [
      {
        id: 'escape_vehicle',
        type: 'vehicle',
        description: 'Man the gunner position on the Warthog',
        dialogueOnStart: 'briefing_final_escape',
      },
      {
        id: 'escape_run',
        type: 'survive',
        description: 'Outrun the collapse wave',
        timeLimit: 180,
        dialogueOnStart: 'drive_marcus',
      },
      {
        id: 'escape_obstacles',
        type: 'custom',
        description: 'Clear obstacles for Marcus',
      },
      {
        id: 'escape_bridge',
        type: 'reach_location',
        description: 'Cross the collapsing bridge',
        targetPosition: { x: 0, y: 10, z: 2000 },
        targetRadius: 50,
        showMarker: true,
        markerLabel: 'BRIDGE',
      },
      {
        id: 'escape_ramp',
        type: 'reach_location',
        description: 'Make the jump to the dropship ramp',
        targetPosition: { x: 0, y: 50, z: 3000 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'DROPSHIP',
      },
      {
        id: 'escape_victory',
        type: 'custom',
        description: 'Victory - You made it!',
        dialogueOnComplete: 'campaign_complete',
      },
    ],
    failOnDeath: true,
    failOnTimer: true,
    canRetry: true,
  },
];

// ============================================================================
// BRANCH QUESTS - OPTIONAL SIDE CONTENT
// ============================================================================

/**
 * Branch quests - Optional content found from objects/NPCs.
 * These unlock additional areas, lore, and rewards.
 */
export const BRANCH_QUESTS: QuestDefinition[] = [
  // -------------------------------------------------------------------------
  // ANCHOR STATION BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_anchor_marcus_letter',
    type: 'branch',
    levelId: 'anchor_station',
    name: "Marcus's Letter",
    description: 'You found a personal letter from your brother Marcus in your locker.',
    triggerType: 'object_interact',
    triggerData: { objectId: 'locker_personal' },
    objectives: [
      {
        id: 'marcus_letter_read',
        type: 'custom',
        description: 'Read the letter from Marcus',
        dialogueOnComplete: 'marcus_letter',
      },
    ],
    rewards: {
      achievement: 'family_ties',
      dialogue: 'marcus_letter_read',
    },
  },

  {
    id: 'branch_anchor_observation',
    type: 'branch',
    levelId: 'anchor_station',
    name: 'Last Look at Earth',
    description: 'Visit the observation deck for one last view of Earth before deployment.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'observation_deck' },
    objectives: [
      {
        id: 'observation_view',
        type: 'reach_location',
        description: 'Look out at Earth one last time',
        targetPosition: { x: -40, y: 5, z: 30 },
        targetRadius: 3,
        showMarker: true,
        markerLabel: 'VIEWPORT',
      },
    ],
    rewards: {
      achievement: 'homesick',
    },
  },

  // -------------------------------------------------------------------------
  // LANDFALL BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_landfall_survivor',
    type: 'branch',
    levelId: 'landfall',
    name: 'Downed Pilot',
    description:
      'You detected a faint UNSC distress signal nearby - another survivor from the drop.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'crash_site_secondary' },
    objectives: [
      {
        id: 'survivor_locate',
        type: 'reach_location',
        description: 'Follow the distress beacon',
        targetPosition: { x: -100, y: 1.7, z: 150 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'BEACON',
      },
      {
        id: 'survivor_find',
        type: 'custom',
        description: 'Investigate the crash site',
        dialogueOnComplete: 'survivor_found_dead',
      },
      {
        id: 'survivor_tags',
        type: 'collect',
        description: 'Recover dog tags',
        required: 1,
      },
    ],
    rewards: {
      achievement: 'no_one_left_behind',
      giveItem: 'pilot_dogtags',
    },
  },

  {
    id: 'branch_landfall_cache',
    type: 'branch',
    levelId: 'landfall',
    name: 'Supply Cache',
    description: 'VANGUARD team marked a supply cache location on the map - could be useful.',
    triggerType: 'object_interact',
    triggerData: { objectId: 'tactical_map' },
    objectives: [
      {
        id: 'cache_locate',
        type: 'reach_location',
        description: 'Find the supply cache',
        targetPosition: { x: 80, y: 1.7, z: -50 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'CACHE',
      },
      {
        id: 'cache_open',
        type: 'interact',
        description: 'Open the supply crate',
      },
    ],
    rewards: {
      giveItem: 'ammo_pack',
      unlockArea: 'hidden_cave',
    },
  },

  // -------------------------------------------------------------------------
  // CANYON RUN BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_canyon_shortcut',
    type: 'branch',
    levelId: 'canyon_run',
    name: 'The Old Pass',
    description: 'A barely visible trail leads up to a higher route - risky but faster.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'hidden_trail' },
    objectives: [
      {
        id: 'shortcut_climb',
        type: 'reach_location',
        description: 'Navigate the treacherous upper pass',
        targetPosition: { x: -50, y: 100, z: 800 },
        targetRadius: 30,
        showMarker: true,
        markerLabel: 'UPPER PASS',
      },
    ],
    rewards: {
      achievement: 'pathfinder',
    },
  },

  {
    id: 'branch_canyon_convoy',
    type: 'branch',
    levelId: 'canyon_run',
    name: 'Lost Convoy',
    description: 'Wreckage of a UNSC supply convoy is visible in a side canyon.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'convoy_wreck' },
    objectives: [
      {
        id: 'convoy_investigate',
        type: 'reach_location',
        description: 'Investigate the convoy wreckage',
        targetPosition: { x: 150, y: 0, z: 1200 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'WRECK',
      },
      {
        id: 'convoy_salvage',
        type: 'collect',
        description: 'Salvage useful equipment',
        required: 2,
      },
    ],
    rewards: {
      giveItem: 'heavy_ammo',
      achievement: 'scavenger',
    },
  },

  // -------------------------------------------------------------------------
  // FOB DELTA BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_fob_armory',
    type: 'branch',
    levelId: 'fob_delta',
    name: 'Secure Armory',
    description: 'The FOB armory is locked down - the access code might be in the command center.',
    triggerType: 'object_interact',
    triggerData: { objectId: 'armory_door' },
    objectives: [
      {
        id: 'armory_code',
        type: 'collect',
        description: 'Find the armory access code',
        required: 1,
      },
      {
        id: 'armory_unlock',
        type: 'interact',
        description: 'Unlock the armory',
      },
      {
        id: 'armory_loot',
        type: 'collect',
        description: 'Collect weapons and ammo',
        required: 3,
      },
    ],
    rewards: {
      giveItem: 'rocket_launcher',
      achievement: 'well_armed',
    },
  },

  {
    id: 'branch_fob_medical',
    type: 'branch',
    levelId: 'fob_delta',
    name: 'Medical Bay Logs',
    description: 'The medical bay might have logs about what happened to VANGUARD team.',
    triggerType: 'object_interact',
    triggerData: { objectId: 'medical_terminal' },
    objectives: [
      {
        id: 'medical_access',
        type: 'interact',
        description: 'Access medical records',
      },
      {
        id: 'medical_read',
        type: 'custom',
        description: 'Read the autopsy reports',
        dialogueOnComplete: 'medical_horror',
      },
    ],
    rewards: {
      achievement: 'investigator',
    },
  },

  {
    id: 'branch_fob_survivor',
    type: 'branch',
    levelId: 'fob_delta',
    name: 'Hidden Survivor',
    description: 'You hear faint tapping from inside a sealed storage room.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'storage_area' },
    objectives: [
      {
        id: 'survivor_breach',
        type: 'interact',
        description: 'Cut through the sealed door',
      },
      {
        id: 'survivor_rescue',
        type: 'custom',
        description: 'Rescue the survivor',
        dialogueOnComplete: 'fob_survivor_found',
      },
    ],
    rewards: {
      achievement: 'rescuer',
      unlockQuest: 'branch_fob_survivor_intel',
    },
  },

  // -------------------------------------------------------------------------
  // BROTHERS IN ARMS BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_brothers_cache',
    type: 'branch',
    levelId: 'brothers_in_arms',
    name: "Marcus's Stash",
    description: 'Marcus mentions he hid supplies nearby before linking up with you.',
    triggerType: 'npc_dialogue',
    triggerData: { npcId: 'marcus' },
    objectives: [
      {
        id: 'stash_find',
        type: 'reach_location',
        description: "Find Marcus's supply stash",
        targetPosition: { x: -80, y: 1.7, z: 100 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'STASH',
      },
      {
        id: 'stash_collect',
        type: 'collect',
        description: 'Collect supplies',
        required: 2,
      },
    ],
    rewards: {
      giveItem: 'mech_repair_kit',
    },
  },

  {
    id: 'branch_brothers_memorial',
    type: 'branch',
    levelId: 'brothers_in_arms',
    name: 'Fallen Comrades',
    description: 'Marcus wants to visit where his squad fell before moving on.',
    triggerType: 'npc_dialogue',
    triggerData: { npcId: 'marcus' },
    prerequisites: {
      quests: ['main_brothers'],
    },
    objectives: [
      {
        id: 'memorial_visit',
        type: 'reach_location',
        description: 'Accompany Marcus to the memorial site',
        targetPosition: { x: 200, y: 1.7, z: -50 },
        targetRadius: 10,
        showMarker: true,
        markerLabel: 'MEMORIAL',
      },
      {
        id: 'memorial_moment',
        type: 'custom',
        description: 'Pay respects',
        dialogueOnComplete: 'memorial_moment',
      },
    ],
    rewards: {
      achievement: 'brothers_bond',
    },
  },

  // -------------------------------------------------------------------------
  // SOUTHERN ICE BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_ice_research',
    type: 'branch',
    levelId: 'southern_ice',
    name: 'Research Station Zeta',
    description:
      'A buried research station appears on thermal scans - scientists might still be alive.',
    triggerType: 'object_interact',
    triggerData: { objectId: 'thermal_scanner' },
    objectives: [
      {
        id: 'research_locate',
        type: 'reach_location',
        description: 'Find the research station',
        targetPosition: { x: -200, y: -5, z: 600 },
        targetRadius: 20,
        showMarker: true,
        markerLabel: 'STATION',
      },
      {
        id: 'research_investigate',
        type: 'custom',
        description: 'Investigate the station',
        dialogueOnComplete: 'research_discovery',
      },
      {
        id: 'research_data',
        type: 'collect',
        description: 'Download research data',
        required: 1,
      },
    ],
    rewards: {
      achievement: 'scientist',
      giveItem: 'alien_research_data',
    },
  },

  {
    id: 'branch_ice_survivor',
    type: 'branch',
    levelId: 'southern_ice',
    name: 'Ice Grave',
    description: "A frozen soldier's body is visible in the ice - VANGUARD insignia.",
    triggerType: 'area_enter',
    triggerData: { areaId: 'frozen_grave' },
    objectives: [
      {
        id: 'ice_excavate',
        type: 'interact',
        description: 'Excavate the body',
      },
      {
        id: 'ice_tags',
        type: 'collect',
        description: 'Recover dog tags and data chip',
        required: 2,
      },
    ],
    rewards: {
      giveItem: 'vanguard_data',
      achievement: 'historian',
    },
  },

  // -------------------------------------------------------------------------
  // THE BREACH BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_breach_eggs',
    type: 'secret',
    levelId: 'the_breach',
    name: 'Destroy the Nest',
    description: 'A secondary egg chamber could spawn more Queens if left intact.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'secondary_chamber' },
    objectives: [
      {
        id: 'eggs_locate',
        type: 'reach_location',
        description: 'Find the secondary egg chamber',
        targetPosition: { x: -100, y: -180, z: 300 },
        targetRadius: 15,
        showMarker: true,
        markerLabel: 'EGGS',
      },
      {
        id: 'eggs_destroy',
        type: 'interact',
        description: 'Plant explosive charge',
      },
      {
        id: 'eggs_escape',
        type: 'reach_location',
        description: 'Escape blast radius',
        timeLimit: 30,
        targetPosition: { x: -50, y: -150, z: 200 },
        targetRadius: 20,
      },
    ],
    rewards: {
      achievement: 'exterminator',
    },
  },

  {
    id: 'branch_breach_artifact',
    type: 'secret',
    levelId: 'the_breach',
    name: 'Alien Artifact',
    description: 'A strange structure pulses with energy in a side chamber - alien technology?',
    triggerType: 'area_enter',
    triggerData: { areaId: 'artifact_chamber' },
    objectives: [
      {
        id: 'artifact_approach',
        type: 'reach_location',
        description: 'Approach the artifact',
        targetPosition: { x: 80, y: -190, z: 400 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'ARTIFACT',
      },
      {
        id: 'artifact_scan',
        type: 'interact',
        description: 'Scan the artifact',
        dialogueOnComplete: 'artifact_scanned',
      },
    ],
    rewards: {
      giveItem: 'alien_artifact',
      achievement: 'archaeologist',
    },
  },

  // -------------------------------------------------------------------------
  // HIVE ASSAULT BRANCHES
  // -------------------------------------------------------------------------
  {
    id: 'branch_assault_wounded',
    type: 'branch',
    levelId: 'hive_assault',
    name: 'Wounded Marine',
    description: 'A wounded marine calls for help from a collapsed tunnel.',
    triggerType: 'area_enter',
    triggerData: { areaId: 'collapsed_tunnel' },
    objectives: [
      {
        id: 'wounded_rescue',
        type: 'reach_location',
        description: 'Reach the wounded marine',
        targetPosition: { x: -50, y: -30, z: 150 },
        targetRadius: 5,
        showMarker: true,
        markerLabel: 'WOUNDED',
      },
      {
        id: 'wounded_heal',
        type: 'interact',
        description: 'Apply first aid',
      },
      {
        id: 'wounded_escort',
        type: 'escort',
        description: 'Escort marine to safety',
      },
    ],
    rewards: {
      achievement: 'combat_medic',
    },
  },
];

// ============================================================================
// QUEST REGISTRY
// ============================================================================

/** All quests indexed by ID */
export const QUEST_REGISTRY: Record<string, QuestDefinition> = {};

// Populate registry
for (const quest of MAIN_QUEST_CHAIN) {
  QUEST_REGISTRY[quest.id] = quest;
}
for (const quest of BRANCH_QUESTS) {
  QUEST_REGISTRY[quest.id] = quest;
}

// ============================================================================
// QUEST CHAIN UTILITIES
// ============================================================================

/**
 * Get main quest for a level
 */
export function getMainQuestForLevel(levelId: LevelId): QuestDefinition | null {
  return MAIN_QUEST_CHAIN.find((q) => q.levelId === levelId) ?? null;
}

/**
 * Get all branch quests for a level
 */
export function getBranchQuestsForLevel(levelId: LevelId): QuestDefinition[] {
  return BRANCH_QUESTS.filter((q) => q.levelId === levelId);
}

/**
 * Get all quests for a level (main + branches)
 */
export function getAllQuestsForLevel(levelId: LevelId): QuestDefinition[] {
  const main = getMainQuestForLevel(levelId);
  const branches = getBranchQuestsForLevel(levelId);
  return main ? [main, ...branches] : branches;
}

/**
 * Get next main quest in the chain
 */
export function getNextMainQuest(questId: string): QuestDefinition | null {
  const quest = QUEST_REGISTRY[questId];
  if (!quest || !quest.nextQuestId) return null;
  return QUEST_REGISTRY[quest.nextQuestId] ?? null;
}

/**
 * Check if a quest can be started based on prerequisites
 */
export function canStartQuest(
  questId: string,
  completedQuests: string[],
  completedLevels: LevelId[],
  inventory: Record<string, number>
): boolean {
  const quest = QUEST_REGISTRY[questId];
  if (!quest) return false;

  const prereqs = quest.prerequisites;
  if (!prereqs) return true;

  // Check quest prerequisites
  if (prereqs.quests) {
    for (const reqQuest of prereqs.quests) {
      if (!completedQuests.includes(reqQuest)) return false;
    }
  }

  // Check level prerequisites
  if (prereqs.levels) {
    for (const reqLevel of prereqs.levels) {
      if (!completedLevels.includes(reqLevel)) return false;
    }
  }

  // Check item prerequisites
  if (prereqs.items) {
    for (const reqItem of prereqs.items) {
      if (!inventory[reqItem] || inventory[reqItem] <= 0) return false;
    }
  }

  return true;
}

/**
 * Create initial state for a quest
 */
export function createQuestState(questId: string): QuestState {
  return {
    questId,
    status: 'available',
    currentObjectiveIndex: 0,
    objectiveProgress: {},
    objectiveStatus: {},
  };
}
