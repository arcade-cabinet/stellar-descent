/**
 * Level Design Data Types
 *
 * Defines the schema for level design documents used by the campaign director
 * and level factories. Each level has a full creative direction document
 * describing pacing, narrative, tension curves, and key moments.
 */

import type { LevelId } from '../levels/types';

/**
 * A single point on the tension curve for a level.
 * Tension curves drive dynamic music, encounter intensity, and ambient effects.
 */
export interface TensionPoint {
  /** Progress through the level as a percentage (0-100) */
  progress: number;
  /** Tension intensity on a 1-10 scale (1 = calm exploration, 10 = climactic boss phase) */
  tension: number;
  /** Human-readable description of what the player is experiencing at this point */
  description: string;
}

/**
 * A scripted key moment within a level -- the memorable beats players
 * will talk about after putting down the controller.
 */
export interface KeyMoment {
  /** Short evocative name for the moment (e.g. "First Contact") */
  name: string;
  /** Detailed description of the moment and its intended effect on the player */
  description: string;
  /** Approximate progress through the level when this moment occurs (0-100) */
  progressPercent: number;
  /** The type of beat this represents */
  type: 'reveal' | 'combat' | 'setpiece' | 'choice' | 'dialogue';
}

/**
 * Complete level design document. Written from a game director perspective,
 * these documents drive level construction, encounter placement, audio
 * mixing, and narrative delivery for each campaign chapter.
 */
export interface LevelDesignDocument {
  /** Canonical level identifier matching the campaign linked list */
  levelId: LevelId;

  /** Expected playtime range in minutes (first playthrough, normal difficulty) */
  estimatedMinutes: { min: number; max: number };

  /** Primary pacing archetype that informs encounter cadence and player agency */
  pacingStyle: 'exploration' | 'combat' | 'mixed' | 'chase' | 'holdout' | 'boss';

  /** One-line narrative beat -- the sentence-level summary of what this level IS */
  narrativeBeat: string;

  /** Emotional arc description -- how the player should FEEL from start to finish */
  emotionalArc: string;

  /** Tension curve points defining the dynamic intensity over the level's duration */
  tensionCurve: TensionPoint[];

  /** Scripted key moments -- the memorable beats within the level */
  keyMoments: KeyMoment[];

  /** Narrative setup paragraph -- the director's vision for the opening of this level */
  narrativeSetup: string;

  /** How this level connects to the one before it -- continuity and momentum */
  previousConnection: string;

  /** New mechanics introduced in this level that the player has not seen before */
  newMechanics: string[];

  /** Enemy types the player will encounter in this level */
  enemyTypes: string[];

  /** Weapons available to the player during this level */
  weaponsAvailable: string[];
}
