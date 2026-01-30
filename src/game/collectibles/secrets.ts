/**
 * Secret Areas Collectible System
 *
 * Secret areas are hidden throughout levels rewarding exploration.
 * Each secret contains rewards like health, ammo, or achievements.
 *
 * Secrets should be:
 * - Discoverable but not obvious (hidden alcoves, breakable walls, etc.)
 * - Rewarding (tangible gameplay benefits)
 * - Tracked across saves for completion
 */

import type { LevelId } from '../levels/types';

/**
 * Reward types for discovering secrets
 */
export type SecretRewardType =
  | 'health' // Restore health
  | 'ammo' // Restore ammunition
  | 'armor' // Temporary damage reduction
  | 'achievement' // Unlock achievement only
  | 'lore' // Story/worldbuilding reveal
  | 'weapon_upgrade'; // Enhance weapon stats

/**
 * Reward given when a secret is discovered
 */
export interface SecretReward {
  type: SecretRewardType;
  /** Amount for health/ammo/armor rewards */
  amount?: number;
  /** Display text for the reward */
  description: string;
  /** Optional icon for HUD display */
  icon?: string;
}

/**
 * Visual hint types for secrets
 */
export type SecretHintType =
  | 'crack' // Cracked wall that can be broken
  | 'vent' // Accessible vent or crawlspace
  | 'hidden_door' // Concealed door with subtle seams
  | 'platform' // Hidden platform accessible by jumping
  | 'tunnel' // Dark tunnel entrance
  | 'alcove' // Hidden alcove behind objects
  | 'environmental'; // Environmental clue (blood trail, scorch marks)

/**
 * Secret area data structure
 */
export interface SecretArea {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Level where this secret can be found */
  levelId: LevelId;
  /** Position of the secret trigger zone */
  position: { x: number; y: number; z: number };
  /** Radius of the trigger zone */
  triggerRadius: number;
  /** Type of visual hint for the secret */
  hintType: SecretHintType;
  /** Hint text shown nearby (optional) */
  hintText?: string;
  /** Rewards given when discovered */
  rewards: SecretReward[];
  /** Lore text revealed when discovered (optional) */
  loreText?: string;
  /** Difficulty rating (1-3, affects visibility of hints) */
  difficulty: 1 | 2 | 3;
}

/**
 * Secret discovery state
 */
export interface SecretDiscovery {
  secretId: string;
  discoveredAt: number; // Unix timestamp
  levelId: LevelId;
}

// ============================================================================
// SECRET AREAS DATABASE
// ============================================================================

export const SECRET_AREAS: SecretArea[] = [
  // ---------------------------------------------------------------------------
  // ANCHOR STATION - 2 secrets (tutorial level, easier to find)
  // ---------------------------------------------------------------------------
  {
    id: 'anchor_station_secret_01',
    name: 'Hidden Supply Cache',
    levelId: 'anchor_station',
    position: { x: -12, y: 1.5, z: 8 },
    triggerRadius: 2.5,
    hintType: 'vent',
    hintText: 'That maintenance vent looks accessible...',
    difficulty: 1,
    rewards: [
      {
        type: 'health',
        amount: 25,
        description: '+25 Health',
        icon: '+',
      },
    ],
    loreText:
      'Emergency supplies stashed by a paranoid technician. A note reads: "Trust no one. Not even PROMETHEUS."',
  },
  {
    id: 'anchor_station_secret_02',
    name: 'Commander\'s Personal Stash',
    levelId: 'anchor_station',
    position: { x: 15, y: 1.5, z: -20 },
    triggerRadius: 2.0,
    hintType: 'hidden_door',
    hintText: 'The wall panel here seems slightly different...',
    difficulty: 2,
    rewards: [
      {
        type: 'ammo',
        amount: 30,
        description: '+30 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      "Commander Vasquez's personal emergency kit. 'Just in case' never felt more prescient.",
  },

  // ---------------------------------------------------------------------------
  // LANDFALL - 3 secrets (open canyon, exploration rewarded)
  // ---------------------------------------------------------------------------
  {
    id: 'landfall_secret_01',
    name: 'Crashed Supply Pod',
    levelId: 'landfall',
    position: { x: -45, y: 5, z: -35 },
    triggerRadius: 3.0,
    hintType: 'environmental',
    hintText: 'Debris trail leads to that canyon edge...',
    difficulty: 1,
    rewards: [
      {
        type: 'health',
        amount: 50,
        description: '+50 Health',
        icon: '+',
      },
      {
        type: 'ammo',
        amount: 20,
        description: '+20 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      'A supply pod that missed its target during the initial drop. Contents mostly intact.',
  },
  {
    id: 'landfall_secret_02',
    name: 'Colonist Hideout',
    levelId: 'landfall',
    position: { x: 30, y: -2, z: 60 },
    triggerRadius: 2.5,
    hintType: 'tunnel',
    hintText: 'A narrow gap in the rock face catches your eye.',
    difficulty: 2,
    rewards: [
      {
        type: 'armor',
        amount: 15,
        description: '+15% Damage Reduction (60s)',
        icon: '\u25B2',
      },
    ],
    loreText:
      'A small cave where colonists hid during the initial attack. Scratches on the walls tell a grim story.',
  },
  {
    id: 'landfall_secret_03',
    name: 'Sniper Nest',
    levelId: 'landfall',
    position: { x: -15, y: 12, z: -55 },
    triggerRadius: 2.0,
    hintType: 'platform',
    hintText: 'That ledge looks like it might be reachable...',
    difficulty: 3,
    rewards: [
      {
        type: 'weapon_upgrade',
        description: '+10% Damage for 2 minutes',
        icon: '\u2605',
      },
    ],
    loreText:
      "A sniper position with spent casings everywhere. Whoever was here put up one hell of a fight.",
  },

  // ---------------------------------------------------------------------------
  // FOB DELTA - 3 secrets (horror level, hidden in dark corners)
  // ---------------------------------------------------------------------------
  {
    id: 'fob_delta_secret_01',
    name: 'Sealed Armory',
    levelId: 'fob_delta',
    position: { x: 12, y: 0.5, z: -15 },
    triggerRadius: 2.0,
    hintType: 'crack',
    hintText: 'The wall here is damaged. Might be breachable.',
    difficulty: 1,
    rewards: [
      {
        type: 'ammo',
        amount: 50,
        description: '+50 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      'Emergency armory sealed during the attack. The door mechanism is fused shut, but the wall tells a different story.',
  },
  {
    id: 'fob_delta_secret_02',
    name: 'Medic Station',
    levelId: 'fob_delta',
    position: { x: -8, y: 0.5, z: 18 },
    triggerRadius: 2.5,
    hintType: 'alcove',
    hintText: 'Behind the collapsed shelving...',
    difficulty: 2,
    rewards: [
      {
        type: 'health',
        amount: 75,
        description: '+75 Health',
        icon: '+',
      },
    ],
    loreText:
      "Rodriguez's personal med supplies. He always said preparation beats panic.",
  },
  {
    id: 'fob_delta_secret_03',
    name: 'Kowalski\'s Dead Drop',
    levelId: 'fob_delta',
    position: { x: -20, y: -1.5, z: -5 },
    triggerRadius: 1.8,
    hintType: 'hidden_door',
    hintText: 'The floor panel is slightly raised...',
    difficulty: 3,
    rewards: [
      {
        type: 'lore',
        description: 'Intel Recovered',
        icon: '\u2139',
      },
      {
        type: 'armor',
        amount: 20,
        description: '+20% Damage Reduction (60s)',
        icon: '\u25B2',
      },
    ],
    loreText:
      "Kowalski hid classified intel here before the attack. Coordinates to the Queen's chamber are clearly marked.",
  },

  // ---------------------------------------------------------------------------
  // BROTHERS IN ARMS - 2 secrets (combat-focused, quick grabs)
  // ---------------------------------------------------------------------------
  {
    id: 'brothers_secret_01',
    name: 'Fallen Soldier\'s Gear',
    levelId: 'brothers_in_arms',
    position: { x: -40, y: 1, z: 35 },
    triggerRadius: 2.5,
    hintType: 'environmental',
    hintText: 'Dog tags glint in the dust...',
    difficulty: 1,
    rewards: [
      {
        type: 'health',
        amount: 40,
        description: '+40 Health',
        icon: '+',
      },
      {
        type: 'ammo',
        amount: 35,
        description: '+35 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      'Private Williams made it further than anyone knew. Her sacrifice bought precious time.',
  },
  {
    id: 'brothers_secret_02',
    name: 'Mech Resupply Cache',
    levelId: 'brothers_in_arms',
    position: { x: 55, y: 3, z: -25 },
    triggerRadius: 3.0,
    hintType: 'tunnel',
    hintText: 'A supply beacon pulses weakly from behind the rocks.',
    difficulty: 2,
    rewards: [
      {
        type: 'weapon_upgrade',
        description: '+15% Fire Rate for 90s',
        icon: '\u2605',
      },
    ],
    loreText:
      "Marcus dropped this during his fighting retreat. 'Big Betty sends her regards.'",
  },

  // ---------------------------------------------------------------------------
  // THE BREACH - 3 secrets (hive environment, organic hiding spots)
  // ---------------------------------------------------------------------------
  {
    id: 'breach_secret_01',
    name: 'Research Team Cache',
    levelId: 'the_breach',
    position: { x: 18, y: -8, z: -30 },
    triggerRadius: 2.5,
    hintType: 'alcove',
    hintText: 'The resin wall here has a different texture...',
    difficulty: 1,
    rewards: [
      {
        type: 'health',
        amount: 60,
        description: '+60 Health',
        icon: '+',
      },
    ],
    loreText:
      "Dr. Chen's emergency supplies. She made it this far before being captured.",
  },
  {
    id: 'breach_secret_02',
    name: 'Dormant Egg Chamber',
    levelId: 'the_breach',
    position: { x: -15, y: -12, z: -55 },
    triggerRadius: 2.0,
    hintType: 'tunnel',
    hintText: 'A side passage, unguarded. Risky but tempting.',
    difficulty: 2,
    rewards: [
      {
        type: 'armor',
        amount: 25,
        description: '+25% Damage Reduction (90s)',
        icon: '\u25B2',
      },
      {
        type: 'ammo',
        amount: 40,
        description: '+40 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      'A chamber of dormant eggs. Supplies from fallen soldiers litter the floor.',
  },
  {
    id: 'breach_secret_03',
    name: 'Queen\'s Trophy Room',
    levelId: 'the_breach',
    position: { x: 5, y: -18, z: -75 },
    triggerRadius: 3.0,
    hintType: 'hidden_door',
    hintText: 'The bioluminescent patterns form a path...',
    difficulty: 3,
    rewards: [
      {
        type: 'weapon_upgrade',
        description: '+20% Critical Damage (Boss)',
        icon: '\u2605',
      },
      {
        type: 'health',
        amount: 100,
        description: '+100 Health',
        icon: '+',
      },
    ],
    loreText:
      "The Queen's collection of 'trophies' from previous incursions. Your predecessors were not the first.",
  },

  // ---------------------------------------------------------------------------
  // EXTRACTION - 2 secrets (final level, high rewards)
  // ---------------------------------------------------------------------------
  {
    id: 'extraction_secret_01',
    name: 'Emergency Supply Drop',
    levelId: 'extraction',
    position: { x: -25, y: 2, z: 40 },
    triggerRadius: 3.0,
    hintType: 'environmental',
    hintText: 'A supply crate beacon blinks in the chaos.',
    difficulty: 1,
    rewards: [
      {
        type: 'health',
        amount: 100,
        description: '+100 Health',
        icon: '+',
      },
      {
        type: 'ammo',
        amount: 60,
        description: '+60 Reserve Ammo',
        icon: '\u2022',
      },
    ],
    loreText:
      'Emergency resupply ordered by Commander Vasquez. She always has a backup plan.',
  },
  {
    id: 'extraction_secret_02',
    name: 'Pilot\'s Last Stand',
    levelId: 'extraction',
    position: { x: 35, y: 1, z: -15 },
    triggerRadius: 2.5,
    hintType: 'crack',
    hintText: 'Wreckage from the previous evac attempt...',
    difficulty: 2,
    rewards: [
      {
        type: 'weapon_upgrade',
        description: '+25% Damage for Final Stand',
        icon: '\u2605',
      },
      {
        type: 'armor',
        amount: 30,
        description: '+30% Damage Reduction (120s)',
        icon: '\u25B2',
      },
    ],
    loreText:
      "The pilot of the first evac ship went down fighting. Their sacrifice won't be forgotten.",
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all secrets for a specific level
 */
export function getSecretsByLevel(levelId: LevelId): SecretArea[] {
  return SECRET_AREAS.filter((secret) => secret.levelId === levelId);
}

/**
 * Get a specific secret by ID
 */
export function getSecretById(secretId: string): SecretArea | undefined {
  return SECRET_AREAS.find((secret) => secret.id === secretId);
}

/**
 * Get secret count per level
 */
export function getSecretCountByLevel(): Record<LevelId, number> {
  const counts: Record<string, number> = {};
  for (const secret of SECRET_AREAS) {
    counts[secret.levelId] = (counts[secret.levelId] || 0) + 1;
  }
  return counts as Record<LevelId, number>;
}

/**
 * Get total secret count
 */
export function getTotalSecretCount(): number {
  return SECRET_AREAS.length;
}

/**
 * Get secrets by difficulty
 */
export function getSecretsByDifficulty(difficulty: 1 | 2 | 3): SecretArea[] {
  return SECRET_AREAS.filter((secret) => secret.difficulty === difficulty);
}
