/**
 * TheBreachLevel - Communications Messages
 *
 * Contains all dialogue and notification definitions for the underground hive level.
 */

import type { CommsMessage } from '../../types';

// ============================================================================
// CHARACTER DEFINITIONS
// ============================================================================

const MARCUS: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'WATCHDOG',
  portrait: 'marcus',
};

const ATHENA: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
};

// ============================================================================
// LEVEL START
// ============================================================================

export const COMMS_LEVEL_START: CommsMessage = {
  ...MARCUS,
  text: "I can't fit the mech in there, Specter. You're on your own. Watch your six.",
};

// ============================================================================
// BOSS FIGHT MESSAGES
// ============================================================================

export const COMMS_BOSS_DETECTED: CommsMessage = {
  ...ATHENA,
  text: 'Massive bio-signature detected. That is the hive queen. Eliminate her to collapse the colony.',
};

export const COMMS_BOSS_PHASE_2: CommsMessage = {
  ...ATHENA,
  text: "She's adapting! Watch for melee attacks!",
};

export const COMMS_BOSS_PHASE_3: CommsMessage = {
  ...ATHENA,
  text: 'Final phase! All attacks accelerated. Finish her!',
};

export const COMMS_BOSS_DEATH: CommsMessage = {
  ...ATHENA,
  text: 'Seismic activity spiking! The hive is collapsing! Get out NOW!',
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const NOTIFICATIONS = {
  // Level progression
  LEVEL_START: 'ENTERING THE BREACH',
  BOSS_AWAKEN: 'THE QUEEN AWAKENS',
  BOSS_DEFEATED: 'QUEEN DEFEATED!',
  ESCAPE: 'ESCAPE THE HIVE!',

  // Boss phases
  BOSS_PHASE_2: 'QUEEN ENRAGED - PHASE 2',
  BOSS_PHASE_3: 'QUEEN CRITICAL - PHASE 3',

  // Queen attacks
  ACID_INCOMING: 'ACID INCOMING!',
  CLAW_ATTACK: 'CLAW ATTACK!',
  TAIL_SLAM: 'TAIL SLAM!',
  GROUND_POUND: 'GROUND POUND!',

  // Minion spawns
  MINIONS_SPAWNED: (count: number, type: string) => `${count} ${type.toUpperCase()}S SPAWNED!`,

  // Combat
  GRENADE_OUT: 'GRENADE OUT!',
  GRENADE_NOT_READY: 'GRENADE NOT READY',
  MELEE: 'MELEE!',
  RELOADING: 'RELOADING...',
  MAGAZINE_FULL: 'MAGAZINE FULL',
  NO_RESERVE_AMMO: 'NO RESERVE AMMO',
  NO_AMMO_RELOADING: 'NO AMMO - RELOADING',
  SCAN_NOT_AVAILABLE: 'SCAN NOT AVAILABLE',
  SCANNING: 'SCANNING FOR WEAKNESS...',
  WEAK_POINT_REVEALED: 'WEAK POINT REVEALED!',
  CRITICAL_HIT: (damage: number) => `CRITICAL HIT! ${damage} damage!`,

  // Hazards
  EGGS_HATCHING: 'EGGS HATCHING!',
} as const;

// ============================================================================
// OBJECTIVES
// ============================================================================

export const OBJECTIVES = {
  DESCENT: {
    title: 'DESCENT',
    description: 'Navigate the hive tunnels. Find the Queen.',
  },
  KILL_QUEEN: {
    title: 'KILL THE QUEEN',
    getDescription: (health: number, maxHealth: number) => `Health: ${health} / ${maxHealth}`,
  },
  QUEEN_PHASE: {
    getTitle: (phase: number) => `QUEEN PHASE ${phase}`,
    getDescription: (health: number, maxHealth: number) =>
      `Health: ${Math.ceil(health)} / ${maxHealth}`,
  },
  EXPLORATION: {
    getTitle: (zone: string) => `${zone.toUpperCase()} HIVE`,
    getDescription: (depth: number, enemyCount: number, kills: number) =>
      `Depth: ${Math.floor(depth)}m | Enemies: ${enemyCount} | Kills: ${kills}`,
  },
} as const;
