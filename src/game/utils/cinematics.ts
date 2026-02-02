/**
 * Cinematic utilities for level intro videos
 *
 * All level cinematics are located at:
 * public/assets/videos/cinematics/{levelId}/intro.mp4
 */

import type { LevelId } from '../levels/types';

/**
 * List of levels that have intro cinematics.
 * Update this list when adding new cinematics.
 */
const LEVELS_WITH_CINEMATICS: Set<LevelId> = new Set([
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
]);

/**
 * Get the path to a level's intro cinematic video.
 * Returns null if the level doesn't have a cinematic.
 *
 * @param levelId - The level identifier
 * @returns The path to the cinematic video, or null if none exists
 */
export function getLevelCinematicPath(levelId: LevelId): string | null {
  if (!LEVELS_WITH_CINEMATICS.has(levelId)) {
    return null;
  }
  return `/assets/videos/cinematics/${levelId}/intro.mp4`;
}

/**
 * Check if a level has an intro cinematic.
 *
 * @param levelId - The level identifier
 * @returns True if the level has a cinematic
 */
export function hasLevelCinematic(levelId: LevelId): boolean {
  return LEVELS_WITH_CINEMATICS.has(levelId);
}
