/**
 * QuestTrackerTypes - Shared types for quest tracker HUD integration
 *
 * These types are used by both the QuestManager (game logic)
 * and the QuestTracker component (UI).
 */

/**
 * Data for displaying an active quest in the HUD
 */
export interface QuestTrackerData {
  /** Main quest ID */
  questId: string;
  /** Quest name */
  questName: string;
  /** Is this a main campaign quest */
  isMain: boolean;
  /** Current objective description */
  objectiveDescription: string;
  /** Objective type for icon */
  objectiveType: 'reach_location' | 'kill_enemies' | 'collect' | 'interact' | 'survive' | 'escort' | 'defend' | 'vehicle' | 'custom';
  /** Progress tracking - current count */
  current?: number;
  /** Progress tracking - required for completion */
  required?: number;
  /** Time remaining in seconds (for timed objectives) */
  timeRemaining?: number;
  /** Distance to objective in meters */
  distance?: number;
  /** Whether this objective was just completed (for animation) */
  justCompleted?: boolean;
  /** Optional objectives for this level */
  optionalObjectives?: OptionalObjectiveData[];
}

/**
 * Data for an optional/bonus objective
 */
export interface OptionalObjectiveData {
  id: string;
  description: string;
  current?: number;
  required?: number;
  completed: boolean;
}
