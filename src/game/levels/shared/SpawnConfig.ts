/**
 * SpawnConfig - Data-driven spawn configuration types and sample configs
 *
 * Defines the schema for declaratively specifying enemy waves, spawn points,
 * and trigger conditions for any campaign level. Levels provide a
 * LevelSpawnConfig and hand it to a SpawnManager which handles the runtime
 * wave progression, entity tracking, and spawn pacing.
 *
 * Design goals:
 *   - Replace per-level hard-coded spawn logic with pure data
 *   - Support multiple trigger strategies (timer, kill count, proximity, objective, manual)
 *   - Allow spawn-point reuse across waves with per-wave overrides
 *   - Keep the interface generic so any level type can use it
 */

// ============================================================================
// ENEMY TYPES
// ============================================================================

/**
 * Identifier for an alien species as defined in `aliens.ts`.
 * This is intentionally a string union rather than an enum so levels can
 * introduce custom species (e.g. IceChitin) without modifying this file.
 */
export type AlienSpeciesId = string;

/**
 * An entry describing a group of enemies within a wave.
 * Multiple groups can exist in a single wave to mix enemy types.
 */
export interface SpawnGroupConfig {
  /** Alien species identifier (must match a key in ALIEN_SPECIES or a custom registry). */
  speciesId: AlienSpeciesId;

  /** Number of enemies of this species to spawn in this group. */
  count: number;

  /**
   * Optional override for the spawn point(s) this group should use.
   * If omitted, the wave-level or level-level spawn points are used.
   */
  spawnPointIds?: string[];

  /**
   * Optional per-group stat overrides applied on top of the species defaults.
   * Useful for creating elite variants without defining a whole new species.
   */
  overrides?: Partial<EnemyStatOverrides>;
}

/**
 * Stat overrides that can be applied to enemies spawned by a group or spawn point.
 */
export interface EnemyStatOverrides {
  /** Multiplier applied to base health (1.0 = no change). */
  healthMultiplier: number;
  /** Multiplier applied to base damage. */
  damageMultiplier: number;
  /** Multiplier applied to base move speed. */
  speedMultiplier: number;
  /** Uniform scale factor applied to the mesh. */
  scale: number;
}

// ============================================================================
// SPAWN POINTS
// ============================================================================

/**
 * A named location in the level where enemies can appear.
 * Spawn points are defined once per level and referenced by waves/groups.
 */
export interface SpawnPointConfig {
  /** Unique identifier within the level (e.g. "hive_entrance_north"). */
  id: string;

  /** World-space position for the spawn origin. */
  position: { x: number; y: number; z: number };

  /**
   * Radius around `position` in which spawned entities are randomly placed.
   * A value of 0 means all entities spawn at the exact position.
   */
  radius: number;

  /**
   * Y-axis rotation (radians) that spawned entities should face.
   * Useful for ensuring enemies face toward the player path.
   */
  facingAngle: number;

  /**
   * When set, only enemies of these species can use this spawn point.
   * Other species in the wave will fall through to alternative points.
   */
  allowedSpecies?: AlienSpeciesId[];

  /**
   * Per-point stat overrides. These are combined (multiplied) with any
   * group-level overrides so a "hard" spawn point can further buff enemies.
   */
  overrides?: Partial<EnemyStatOverrides>;
}

// ============================================================================
// TRIGGER CONDITIONS
// ============================================================================

/**
 * Determines when a wave should begin.
 *
 * - `timer`      : starts N seconds after the previous wave began (or level start for wave 0).
 * - `killCount`  : starts when a target number of total kills is reached.
 * - `killPercent` : starts when a percentage of the current wave's enemies are killed.
 * - `proximity`  : starts when the player enters a radius around a point.
 * - `objective`  : starts when a named objective/flag is set to true.
 * - `manual`     : only starts when `SpawnManager.startWave()` is called explicitly.
 */
export type TriggerType =
  | 'timer'
  | 'killCount'
  | 'killPercent'
  | 'proximity'
  | 'objective'
  | 'manual';

/**
 * Full trigger condition specification.
 * Only the fields relevant to the chosen `type` need to be set.
 */
export interface TriggerCondition {
  /** The kind of trigger. */
  type: TriggerType;

  /**
   * Seconds to wait (for `timer` triggers).
   * Counted from the moment the previous wave started, or from level start for wave 0.
   */
  delay?: number;

  /**
   * Total cumulative kills required (for `killCount` triggers).
   */
  killCount?: number;

  /**
   * Percentage (0-100) of the previous wave's enemies that must be killed
   * before this wave begins (for `killPercent` triggers).
   */
  killPercent?: number;

  /**
   * Center point the player must approach (for `proximity` triggers).
   */
  proximityCenter?: { x: number; y: number; z: number };

  /**
   * Radius around `proximityCenter` (for `proximity` triggers).
   */
  proximityRadius?: number;

  /**
   * Name of the objective flag that must be truthy (for `objective` triggers).
   * The hosting level is responsible for setting flags via `SpawnManager.setFlag()`.
   */
  objectiveFlag?: string;
}

// ============================================================================
// WAVE CONFIGURATION
// ============================================================================

/**
 * Configuration for a single enemy wave within a level.
 */
export interface SpawnWaveConfig {
  /** Wave number (0-indexed). Used for ordering and display. */
  waveNumber: number;

  /**
   * Human-readable label shown in HUD notifications (e.g. "SWARM INCOMING").
   * Optional -- if omitted no notification is shown.
   */
  label?: string;

  /** Condition that must be met before this wave activates. */
  trigger: TriggerCondition;

  /** Enemy groups to spawn in this wave. */
  groups: SpawnGroupConfig[];

  /**
   * IDs of spawn points to use for this wave. Enemies are distributed
   * round-robin across these points unless overridden at the group level.
   * If omitted, all level spawn points are available.
   */
  spawnPointIds?: string[];

  /**
   * Delay in seconds between individual enemy spawns within this wave.
   * Controls pacing so the player is not instantly overwhelmed.
   * @default 1.0
   */
  spawnInterval?: number;

  /**
   * Maximum number of simultaneously alive enemies from this wave.
   * If the cap is reached, spawning pauses until some are killed.
   * @default Infinity (no cap)
   */
  maxConcurrent?: number;
}

// ============================================================================
// LEVEL SPAWN CONFIGURATION
// ============================================================================

/**
 * Top-level spawn configuration for an entire level.
 * One of these is authored per level and passed to a `SpawnManager`.
 */
export interface LevelSpawnConfig {
  /** Level identifier, for logging and debugging. */
  levelId: string;

  /** Named spawn points available in this level. */
  spawnPoints: SpawnPointConfig[];

  /** Ordered list of waves. Wave 0 is evaluated first. */
  waves: SpawnWaveConfig[];

  /**
   * Global cap on concurrently alive enemies across all waves.
   * Prevents performance degradation on lower-end hardware.
   * @default 40
   */
  maxGlobalEnemies?: number;

  /**
   * Default spawn interval used when a wave does not specify its own.
   * @default 1.0
   */
  defaultSpawnInterval?: number;
}
