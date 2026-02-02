/**
 * ChallengeMode - Core challenge system for Stellar Descent
 *
 * Provides:
 * - Challenge definitions (daily, weekly, permanent)
 * - Progress tracking for objectives
 * - Reward management
 * - Seeded random generation for consistent daily/weekly challenges
 *
 * Integration Points:
 * - GameContext: Combat stats tracking
 * - AchievementManager: Progress updates
 * - SaveSystem: Persistence of challenge progress
 */

import { getLogger } from '../core/Logger';
import { capacitorDb } from '../db/database';
import type { LevelId } from '../levels/types';

const log = getLogger('ChallengeMode');

// ============================================================================
// TYPES
// ============================================================================

export type ChallengeType = 'daily' | 'weekly' | 'permanent';

export type ObjectiveType =
  | 'kills'
  | 'headshots'
  | 'time'
  | 'accuracy'
  | 'noDamage'
  | 'melee'
  | 'grenade'
  | 'levelComplete'
  | 'campaignComplete'
  | 'secretsFound'
  | 'skullsCollected'
  | 'noDeaths'
  | 'weaponMastery'
  | 'multiKills';

export type RewardType = 'xp' | 'skull' | 'cosmetic' | 'badge' | 'title' | 'leaderboard_entry';

export type DifficultyModifier = 'easy' | 'normal' | 'hard' | 'insane';

export interface ChallengeObjective {
  type: ObjectiveType;
  target: number;
  current: number;
  description: string;
  // Optional level restriction
  levelId?: LevelId;
  // Optional weapon restriction (for weapon mastery)
  weaponId?: string;
  // Optional difficulty restriction
  difficulty?: DifficultyModifier;
}

export interface ChallengeReward {
  type: RewardType;
  amount: number;
  id?: string; // For specific items (skull id, cosmetic id, etc.)
  name: string;
  description: string;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  name: string;
  description: string;
  objectives: ChallengeObjective[];
  rewards: ChallengeReward[];
  startDate: Date;
  endDate: Date;
  completed: boolean;
  claimed: boolean;
  // For seeded generation
  seed?: number;
  // Optional difficulty requirement
  minDifficulty?: DifficultyModifier;
}

export interface ChallengeProgress {
  challengeId: string;
  objectives: ChallengeObjective[];
  completed: boolean;
  claimed: boolean;
  completedAt?: number;
  claimedAt?: number;
}

export interface ChallengeState {
  dailyChallenges: Challenge[];
  weeklyChallenges: Challenge[];
  permanentChallenges: Challenge[];
  progress: Record<string, ChallengeProgress>;
  claimedRewards: string[];
  totalXP: number;
  streak: number;
  lastDailyCompletion?: number;
}

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Simple seeded random number generator (mulberry32)
 * Ensures same seed produces same sequence of random numbers
 */
function seededRandom(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Get seed from date (YYYYMMDD format)
 */
export function getDateSeed(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return year * 10000 + month * 100 + day;
}

/**
 * Get seed from week (YYYYWW format)
 */
export function getWeekSeed(date: Date = new Date()): number {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return year * 100 + week;
}

// ============================================================================
// CHALLENGE TEMPLATES
// ============================================================================

interface DailyChallengeTemplate {
  id: string;
  name: string;
  description: string;
  objectiveType: ObjectiveType;
  targetRange: [number, number]; // [min, max]
  rewards: Omit<ChallengeReward, 'name' | 'description'>[];
  levelRestricted?: boolean;
}

interface WeeklyChallengeTemplate {
  id: string;
  name: string;
  description: string;
  objectives: Array<{
    type: ObjectiveType;
    targetRange: [number, number];
    levelId?: LevelId;
  }>;
  rewards: Omit<ChallengeReward, 'name' | 'description'>[];
  minDifficulty?: DifficultyModifier;
}

const DAILY_CHALLENGE_TEMPLATES: DailyChallengeTemplate[] = [
  {
    id: 'daily_headshots',
    name: 'Precision Strikes',
    description: 'Kill {target} enemies with headshots',
    objectiveType: 'headshots',
    targetRange: [25, 75],
    rewards: [{ type: 'xp', amount: 500 }],
  },
  {
    id: 'daily_speedrun',
    name: 'Speed Demon',
    description: 'Complete {level} in under {target} minutes',
    objectiveType: 'time',
    targetRange: [3, 8],
    levelRestricted: true,
    rewards: [{ type: 'xp', amount: 750 }],
  },
  {
    id: 'daily_grenades',
    name: 'Explosives Expert',
    description: 'Kill {target} enemies with grenades',
    objectiveType: 'grenade',
    targetRange: [5, 20],
    rewards: [{ type: 'xp', amount: 400 }],
  },
  {
    id: 'daily_accuracy',
    name: 'Sharpshooter',
    description: 'Achieve {target}% accuracy on any level',
    objectiveType: 'accuracy',
    targetRange: [75, 95],
    rewards: [{ type: 'xp', amount: 600 }],
  },
  {
    id: 'daily_kills',
    name: 'Exterminator',
    description: 'Kill {target} enemies',
    objectiveType: 'kills',
    targetRange: [50, 150],
    rewards: [{ type: 'xp', amount: 350 }],
  },
  {
    id: 'daily_melee',
    name: 'Up Close and Personal',
    description: 'Kill {target} enemies with melee attacks',
    objectiveType: 'melee',
    targetRange: [5, 15],
    rewards: [{ type: 'xp', amount: 450 }],
  },
  {
    id: 'daily_nodamage',
    name: 'Untouchable',
    description: 'Complete any level without taking damage',
    objectiveType: 'noDamage',
    targetRange: [1, 1],
    rewards: [{ type: 'xp', amount: 1000 }],
  },
  {
    id: 'daily_secrets',
    name: 'Secret Hunter',
    description: 'Find {target} secret areas',
    objectiveType: 'secretsFound',
    targetRange: [2, 5],
    rewards: [{ type: 'xp', amount: 550 }],
  },
  {
    id: 'daily_multikills',
    name: 'Chain Reaction',
    description: 'Get {target} multi-kills (3+ kills in 3 seconds)',
    objectiveType: 'multiKills',
    targetRange: [3, 8],
    rewards: [{ type: 'xp', amount: 650 }],
  },
];

const WEEKLY_CHALLENGE_TEMPLATES: WeeklyChallengeTemplate[] = [
  {
    id: 'weekly_campaign_hard',
    name: 'Hard Mode Warrior',
    description: 'Complete the entire campaign on Hard difficulty',
    objectives: [{ type: 'campaignComplete', targetRange: [1, 1] }],
    rewards: [
      { type: 'xp', amount: 5000 },
      { type: 'badge', amount: 1, id: 'hard_mode_badge' },
    ],
    minDifficulty: 'hard',
  },
  {
    id: 'weekly_total_kills',
    name: 'Alien Apocalypse',
    description: 'Kill 500 enemies across all levels',
    objectives: [{ type: 'kills', targetRange: [400, 600] }],
    rewards: [{ type: 'xp', amount: 3000 }],
  },
  {
    id: 'weekly_all_skulls',
    name: 'Skull Collector',
    description: 'Collect all skulls in the campaign',
    objectives: [{ type: 'skullsCollected', targetRange: [10, 10] }],
    rewards: [
      { type: 'xp', amount: 4000 },
      { type: 'skull', amount: 1, id: 'bonus_skull_weekly' },
    ],
  },
  {
    id: 'weekly_queen_flawless',
    name: "Queen's Bane",
    description: 'Defeat the Brood Queen without taking damage',
    objectives: [
      { type: 'levelComplete', targetRange: [1, 1], levelId: 'the_breach' },
      { type: 'noDamage', targetRange: [1, 1], levelId: 'the_breach' },
    ],
    rewards: [
      { type: 'xp', amount: 3500 },
      { type: 'title', amount: 1, id: 'queen_slayer_title' },
    ],
  },
  {
    id: 'weekly_speedrun_all',
    name: 'Speed Demon Elite',
    description: 'Complete all levels under par time',
    objectives: [
      { type: 'time', targetRange: [1, 1] }, // All levels under par
    ],
    rewards: [
      { type: 'xp', amount: 6000 },
      { type: 'cosmetic', amount: 1, id: 'speedster_skin' },
    ],
  },
  {
    id: 'weekly_deathless',
    name: 'Immortal Marine',
    description: 'Complete 5 levels without dying',
    objectives: [{ type: 'noDeaths', targetRange: [5, 5] }],
    rewards: [
      { type: 'xp', amount: 4500 },
      { type: 'badge', amount: 1, id: 'immortal_badge' },
    ],
  },
];

// ============================================================================
// PERMANENT CHALLENGES (Achievement-like)
// ============================================================================

const PERMANENT_CHALLENGES: Omit<Challenge, 'startDate' | 'endDate' | 'completed' | 'claimed'>[] = [
  // Weapon Mastery Challenges
  {
    id: 'mastery_rifle',
    type: 'permanent',
    name: 'Rifle Master',
    description: 'Kill 1000 enemies with the assault rifle',
    objectives: [
      {
        type: 'weaponMastery',
        target: 1000,
        current: 0,
        description: 'Kill 1000 enemies with the assault rifle',
        weaponId: 'rifle',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 2500,
        name: 'Rifle Mastery XP',
        description: 'XP for completing rifle mastery',
      },
      {
        type: 'cosmetic',
        amount: 1,
        id: 'rifle_gold',
        name: 'Golden Rifle',
        description: 'Unlock the golden rifle skin',
      },
    ],
  },
  {
    id: 'mastery_shotgun',
    type: 'permanent',
    name: 'Shotgun Master',
    description: 'Kill 500 enemies with the shotgun',
    objectives: [
      {
        type: 'weaponMastery',
        target: 500,
        current: 0,
        description: 'Kill 500 enemies with the shotgun',
        weaponId: 'shotgun',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 2500,
        name: 'Shotgun Mastery XP',
        description: 'XP for completing shotgun mastery',
      },
      {
        type: 'cosmetic',
        amount: 1,
        id: 'shotgun_gold',
        name: 'Golden Shotgun',
        description: 'Unlock the golden shotgun skin',
      },
    ],
  },
  {
    id: 'mastery_pistol',
    type: 'permanent',
    name: 'Pistol Master',
    description: 'Kill 300 enemies with the pistol',
    objectives: [
      {
        type: 'weaponMastery',
        target: 300,
        current: 0,
        description: 'Kill 300 enemies with the pistol',
        weaponId: 'pistol',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 2000,
        name: 'Pistol Mastery XP',
        description: 'XP for completing pistol mastery',
      },
      {
        type: 'cosmetic',
        amount: 1,
        id: 'pistol_gold',
        name: 'Golden Pistol',
        description: 'Unlock the golden pistol skin',
      },
    ],
  },
  // Level Mastery Challenges (3-star ratings)
  {
    id: 'mastery_landfall',
    type: 'permanent',
    name: 'Landfall Mastery',
    description: 'Complete Landfall with 3 stars (no deaths, all secrets, under par time)',
    objectives: [
      {
        type: 'noDeaths',
        target: 1,
        current: 0,
        description: 'Complete without dying',
        levelId: 'landfall',
      },
      {
        type: 'secretsFound',
        target: 2,
        current: 0,
        description: 'Find all secrets',
        levelId: 'landfall',
      },
      {
        type: 'time',
        target: 5,
        current: 0,
        description: 'Complete in under 5 minutes',
        levelId: 'landfall',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 1500,
        name: 'Landfall Mastery XP',
        description: 'XP for mastering Landfall',
      },
      {
        type: 'badge',
        amount: 1,
        id: 'landfall_3star',
        name: 'Landfall Expert',
        description: '3-star Landfall badge',
      },
    ],
  },
  {
    id: 'mastery_canyon_run',
    type: 'permanent',
    name: 'Canyon Run Mastery',
    description: 'Complete Canyon Run with 3 stars (no deaths, all secrets, under par time)',
    objectives: [
      {
        type: 'noDeaths',
        target: 1,
        current: 0,
        description: 'Complete without dying',
        levelId: 'canyon_run',
      },
      {
        type: 'secretsFound',
        target: 2,
        current: 0,
        description: 'Find all secrets',
        levelId: 'canyon_run',
      },
      {
        type: 'time',
        target: 4,
        current: 0,
        description: 'Complete in under 4 minutes',
        levelId: 'canyon_run',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 1500,
        name: 'Canyon Run Mastery XP',
        description: 'XP for mastering Canyon Run',
      },
      {
        type: 'badge',
        amount: 1,
        id: 'canyon_run_3star',
        name: 'Canyon Runner',
        description: '3-star Canyon Run badge',
      },
    ],
  },
  {
    id: 'mastery_the_breach',
    type: 'permanent',
    name: 'The Breach Mastery',
    description: 'Defeat the Queen with 3 stars (no deaths, all secrets, under par time)',
    objectives: [
      {
        type: 'noDeaths',
        target: 1,
        current: 0,
        description: 'Complete without dying',
        levelId: 'the_breach',
      },
      {
        type: 'secretsFound',
        target: 3,
        current: 0,
        description: 'Find all secrets',
        levelId: 'the_breach',
      },
      {
        type: 'time',
        target: 12,
        current: 0,
        description: 'Complete in under 12 minutes',
        levelId: 'the_breach',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 3000,
        name: 'The Breach Mastery XP',
        description: 'XP for mastering The Breach',
      },
      {
        type: 'badge',
        amount: 1,
        id: 'the_breach_3star',
        name: 'Queen Slayer',
        description: '3-star The Breach badge',
      },
      {
        type: 'skull',
        amount: 1,
        id: 'queen_skull',
        name: 'Queen Skull',
        description: 'Rare skull from The Breach mastery',
      },
    ],
  },
  // Meta Challenges
  {
    id: 'veteran_campaign',
    type: 'permanent',
    name: 'Campaign Veteran',
    description: 'Complete the full campaign 3 times',
    objectives: [
      {
        type: 'campaignComplete',
        target: 3,
        current: 0,
        description: 'Complete the campaign 3 times',
      },
    ],
    rewards: [
      { type: 'xp', amount: 10000, name: 'Veteran XP', description: 'XP for true dedication' },
      {
        type: 'title',
        amount: 1,
        id: 'veteran_title',
        name: 'Veteran',
        description: 'The "Veteran" title',
      },
    ],
  },
  {
    id: 'insane_completionist',
    type: 'permanent',
    name: 'Insane Completionist',
    description: 'Complete all levels on Insane difficulty',
    objectives: [
      {
        type: 'levelComplete',
        target: 10,
        current: 0,
        description: 'Complete all 10 levels on Insane',
        difficulty: 'insane',
      },
    ],
    rewards: [
      {
        type: 'xp',
        amount: 15000,
        name: 'Insane XP',
        description: 'Massive XP for the ultimate challenge',
      },
      {
        type: 'title',
        amount: 1,
        id: 'insane_title',
        name: 'Insane Marine',
        description: 'The "Insane Marine" title',
      },
      {
        type: 'cosmetic',
        amount: 1,
        id: 'insane_armor',
        name: 'Elite Armor',
        description: 'Exclusive armor skin for insane completion',
      },
    ],
  },
];

// ============================================================================
// LEVEL IDS FOR RANDOM SELECTION
// ============================================================================

const SPEEDRUN_LEVELS: LevelId[] = [
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'extraction',
  'final_escape',
];

const LEVEL_DISPLAY_NAMES: Record<LevelId, string> = {
  anchor_station: 'Anchor Station',
  landfall: 'Landfall',
  canyon_run: 'Canyon Run',
  fob_delta: 'FOB Delta',
  brothers_in_arms: 'Brothers in Arms',
  southern_ice: 'Southern Ice',
  the_breach: 'The Breach',
  hive_assault: 'Hive Assault',
  extraction: 'Extraction',
  final_escape: 'Final Escape',
};

// ============================================================================
// CHALLENGE GENERATOR
// ============================================================================

/**
 * Generate daily challenges based on the current date seed
 */
export function generateDailyChallenges(date: Date = new Date()): Challenge[] {
  const seed = getDateSeed(date);
  const random = seededRandom(seed);
  const challenges: Challenge[] = [];

  // Get start and end of day
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // Select 3 unique challenges for today
  const shuffledTemplates = [...DAILY_CHALLENGE_TEMPLATES].sort(() => random() - 0.5);
  const selectedTemplates = shuffledTemplates.slice(0, 3);

  for (let i = 0; i < selectedTemplates.length; i++) {
    const template = selectedTemplates[i];
    const targetVariance = template.targetRange[1] - template.targetRange[0];
    const target = Math.floor(template.targetRange[0] + random() * targetVariance);

    // Select random level for level-restricted challenges
    let levelId: LevelId | undefined;
    let levelName = '';
    if (template.levelRestricted) {
      const levelIndex = Math.floor(random() * SPEEDRUN_LEVELS.length);
      levelId = SPEEDRUN_LEVELS[levelIndex];
      levelName = LEVEL_DISPLAY_NAMES[levelId];
    }

    // Build description with substitutions
    const description = template.description
      .replace('{target}', target.toString())
      .replace('{level}', levelName);

    const challenge: Challenge = {
      id: `${template.id}_${seed}_${i}`,
      type: 'daily',
      name: template.name,
      description,
      objectives: [
        {
          type: template.objectiveType,
          target,
          current: 0,
          description,
          levelId,
        },
      ],
      rewards: template.rewards.map((r) => ({
        ...r,
        name: getRewardName(r.type, r.amount),
        description: getRewardDescription(r.type, r.amount),
      })),
      startDate,
      endDate,
      completed: false,
      claimed: false,
      seed,
    };

    challenges.push(challenge);
  }

  return challenges;
}

/**
 * Generate weekly challenges based on the current week seed
 */
export function generateWeeklyChallenges(date: Date = new Date()): Challenge[] {
  const seed = getWeekSeed(date);
  const random = seededRandom(seed);
  const challenges: Challenge[] = [];

  // Get start and end of week (Monday to Sunday)
  const startDate = new Date(date);
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
  startDate.setDate(diff);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  // Select 2 unique weekly challenges
  const shuffledTemplates = [...WEEKLY_CHALLENGE_TEMPLATES].sort(() => random() - 0.5);
  const selectedTemplates = shuffledTemplates.slice(0, 2);

  for (let i = 0; i < selectedTemplates.length; i++) {
    const template = selectedTemplates[i];
    const objectives: ChallengeObjective[] = template.objectives.map((obj) => {
      const targetVariance = obj.targetRange[1] - obj.targetRange[0];
      const target = Math.floor(obj.targetRange[0] + random() * targetVariance);
      return {
        type: obj.type,
        target,
        current: 0,
        description: getObjectiveDescription(obj.type, target, obj.levelId),
        levelId: obj.levelId,
      };
    });

    const challenge: Challenge = {
      id: `${template.id}_${seed}_${i}`,
      type: 'weekly',
      name: template.name,
      description: template.description,
      objectives,
      rewards: template.rewards.map((r) => ({
        ...r,
        name: getRewardName(r.type, r.amount, r.id),
        description: getRewardDescription(r.type, r.amount, r.id),
      })),
      startDate,
      endDate,
      completed: false,
      claimed: false,
      seed,
      minDifficulty: template.minDifficulty,
    };

    challenges.push(challenge);
  }

  return challenges;
}

/**
 * Get permanent challenges (static, always available)
 */
export function getPermanentChallenges(): Challenge[] {
  const farFuture = new Date('2099-12-31');
  const distantPast = new Date('2000-01-01');

  return PERMANENT_CHALLENGES.map((template) => ({
    ...template,
    startDate: distantPast,
    endDate: farFuture,
    completed: false,
    claimed: false,
  }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRewardName(type: RewardType, amount: number, id?: string): string {
  switch (type) {
    case 'xp':
      return `${amount} XP`;
    case 'skull':
      return id ? `Skull: ${id}` : 'Mystery Skull';
    case 'cosmetic':
      return id ? `Cosmetic: ${id}` : 'Cosmetic Item';
    case 'badge':
      return id ? `Badge: ${id}` : 'Achievement Badge';
    case 'title':
      return id ? `Title: ${id}` : 'Player Title';
    case 'leaderboard_entry':
      return 'Leaderboard Entry';
    default:
      return 'Unknown Reward';
  }
}

function getRewardDescription(type: RewardType, amount: number, _id?: string): string {
  switch (type) {
    case 'xp':
      return `Earn ${amount} experience points`;
    case 'skull':
      return 'Unlock a special skull modifier';
    case 'cosmetic':
      return 'Unlock a cosmetic item';
    case 'badge':
      return 'Unlock a profile badge';
    case 'title':
      return 'Unlock a player title';
    case 'leaderboard_entry':
      return 'Your score will be recorded on the leaderboard';
    default:
      return '';
  }
}

function getObjectiveDescription(type: ObjectiveType, target: number, levelId?: LevelId): string {
  const levelName = levelId ? LEVEL_DISPLAY_NAMES[levelId] : '';

  switch (type) {
    case 'kills':
      return `Kill ${target} enemies${levelName ? ` in ${levelName}` : ''}`;
    case 'headshots':
      return `Get ${target} headshots${levelName ? ` in ${levelName}` : ''}`;
    case 'time':
      return `Complete ${levelName || 'the level'} in under ${target} minutes`;
    case 'accuracy':
      return `Achieve ${target}% accuracy${levelName ? ` in ${levelName}` : ''}`;
    case 'noDamage':
      return `Complete ${levelName || 'a level'} without taking damage`;
    case 'melee':
      return `Kill ${target} enemies with melee attacks`;
    case 'grenade':
      return `Kill ${target} enemies with grenades`;
    case 'levelComplete':
      return `Complete ${levelName || 'the level'}`;
    case 'campaignComplete':
      return target === 1 ? 'Complete the campaign' : `Complete the campaign ${target} times`;
    case 'secretsFound':
      return `Find ${target} secret areas${levelName ? ` in ${levelName}` : ''}`;
    case 'skullsCollected':
      return `Collect ${target} skulls`;
    case 'noDeaths':
      return `Complete ${target} level${target > 1 ? 's' : ''} without dying`;
    case 'weaponMastery':
      return `Kill ${target} enemies with this weapon`;
    case 'multiKills':
      return `Get ${target} multi-kills (3+ kills in 3 seconds)`;
    default:
      return 'Complete the objective';
  }
}

// ============================================================================
// STORAGE
// ============================================================================

const TABLE_CHALLENGES = 'challenge_state';

/** Flag to track if database is initialized */
let dbInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensure the challenge table exists
 */
async function ensureTable(): Promise<void> {
  if (dbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = doEnsureTable();
  return initPromise;
}

async function doEnsureTable(): Promise<void> {
  await capacitorDb.init();
  await capacitorDb.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_CHALLENGES} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  dbInitialized = true;
}

/**
 * Create default challenge state
 */
function createDefaultState(): ChallengeState {
  return {
    dailyChallenges: [],
    weeklyChallenges: [],
    permanentChallenges: [],
    progress: {},
    claimedRewards: [],
    totalXP: 0,
    streak: 0,
  };
}

/**
 * Load challenge state from SQLite
 */
export async function loadChallengeState(): Promise<ChallengeState> {
  try {
    await ensureTable();
    const rows = await capacitorDb.query<{ key: string; value: string }>(
      `SELECT key, value FROM ${TABLE_CHALLENGES} WHERE key = ?`,
      ['state']
    );
    if (rows.length > 0) {
      const state = JSON.parse(rows[0].value);
      // Convert date strings back to Date objects
      state.dailyChallenges =
        state.dailyChallenges?.map((c: Challenge) => ({
          ...c,
          startDate: new Date(c.startDate),
          endDate: new Date(c.endDate),
        })) ?? [];
      state.weeklyChallenges =
        state.weeklyChallenges?.map((c: Challenge) => ({
          ...c,
          startDate: new Date(c.startDate),
          endDate: new Date(c.endDate),
        })) ?? [];
      state.permanentChallenges =
        state.permanentChallenges?.map((c: Challenge) => ({
          ...c,
          startDate: new Date(c.startDate),
          endDate: new Date(c.endDate),
        })) ?? [];
      return state;
    }
  } catch (error) {
    log.error('Failed to load challenge state:', error);
  }

  // Return default state
  return createDefaultState();
}

/**
 * Save challenge state to SQLite
 */
export async function saveChallengeState(state: ChallengeState): Promise<void> {
  try {
    await ensureTable();
    await capacitorDb.run(`INSERT OR REPLACE INTO ${TABLE_CHALLENGES} (key, value) VALUES (?, ?)`, [
      'state',
      JSON.stringify(state),
    ]);
  } catch (error) {
    log.error('Failed to save challenge state:', error);
  }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Get time remaining until end of day
 */
export function getTimeUntilDailyReset(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() - now.getTime();
}

/**
 * Get time remaining until end of week
 */
export function getTimeUntilWeeklyReset(): number {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = (7 - day) % 7 || 7;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek.getTime() - now.getTime();
}

/**
 * Format time remaining as human readable string
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Check if a challenge has expired
 */
export function isChallengeExpired(challenge: Challenge): boolean {
  return new Date() > challenge.endDate;
}

/**
 * Check if a challenge is active (within its time window)
 */
export function isChallengeActive(challenge: Challenge): boolean {
  const now = new Date();
  return now >= challenge.startDate && now <= challenge.endDate;
}

export { LEVEL_DISPLAY_NAMES };
