/**
 * E2E Test Utilities
 *
 * Provides isolated testing infrastructure for each game level.
 * Uses the PlayerGovernor pattern to simulate player actions.
 */

export { type MoveDirection, PlayerGovernor, type PlayerGovernorOptions } from './PlayerGovernor';

/**
 * Level IDs matching the campaign structure in src/game/levels/types.ts
 */
export const LEVEL_IDS = {
  ANCHOR_STATION: 'anchor_station',
  LANDFALL: 'landfall',
  FOB_DELTA: 'fob_delta',
  BROTHERS_IN_ARMS: 'brothers_in_arms',
  THE_BREACH: 'the_breach',
  EXTRACTION: 'extraction',
} as const;

export type LevelId = (typeof LEVEL_IDS)[keyof typeof LEVEL_IDS];

/**
 * Campaign level order for sequential testing
 */
export const CAMPAIGN_ORDER: LevelId[] = [
  LEVEL_IDS.ANCHOR_STATION,
  LEVEL_IDS.LANDFALL,
  LEVEL_IDS.FOB_DELTA,
  LEVEL_IDS.BROTHERS_IN_ARMS,
  LEVEL_IDS.THE_BREACH,
  LEVEL_IDS.EXTRACTION,
];

/**
 * Level display names for test reporting
 */
export const LEVEL_NAMES: Record<LevelId, string> = {
  [LEVEL_IDS.ANCHOR_STATION]: 'Anchor Station (Tutorial)',
  [LEVEL_IDS.LANDFALL]: 'Landfall (HALO Drop)',
  [LEVEL_IDS.FOB_DELTA]: 'FOB Delta (Investigation)',
  [LEVEL_IDS.BROTHERS_IN_ARMS]: 'Brothers in Arms (Rescue)',
  [LEVEL_IDS.THE_BREACH]: 'The Breach (Boss Fight)',
  [LEVEL_IDS.EXTRACTION]: 'Extraction (Finale)',
};

/**
 * Default test timeouts for different level types
 */
export const LEVEL_TIMEOUTS = {
  /** Standard smoke test timeout */
  SMOKE: 30000,
  /** Short level playthrough */
  SHORT_PLAYTHROUGH: 60000,
  /** Medium level playthrough */
  MEDIUM_PLAYTHROUGH: 120000,
  /** Long level playthrough (boss fights, full campaign) */
  LONG_PLAYTHROUGH: 300000,
  /** Level load timeout */
  LOAD: 30000,
};
