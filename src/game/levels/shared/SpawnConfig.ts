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

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

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

// ============================================================================
// SAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Sample spawn config for Chapter 6: Southern Ice.
 *
 * Three phases map to three waves, each triggered by player proximity
 * as they move southward through the frozen landscape.
 */
export const SOUTHERN_ICE_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'southern_ice',
  maxGlobalEnemies: 30,
  defaultSpawnInterval: 1.2,

  spawnPoints: [
    {
      id: 'ice_fields_east',
      position: { x: 40, y: 0.8, z: -20 },
      radius: 25,
      facingAngle: Math.PI,
    },
    {
      id: 'ice_fields_west',
      position: { x: -40, y: 0.8, z: -30 },
      radius: 25,
      facingAngle: Math.PI,
    },
    {
      id: 'frozen_lake_shore',
      position: { x: 0, y: 0.8, z: -160 },
      radius: 40,
      facingAngle: 0,
    },
    {
      id: 'cavern_entrance',
      position: { x: 0, y: 0.8, z: -260 },
      radius: 20,
      facingAngle: 0,
    },
    {
      id: 'cavern_deep',
      position: { x: 10, y: 0.8, z: -290 },
      radius: 15,
      facingAngle: Math.PI / 2,
    },
  ],

  waves: [
    // Phase 1: Ice Fields -- a handful of active enemies
    {
      waveNumber: 0,
      label: 'ICE FIELD CONTACTS',
      trigger: { type: 'timer', delay: 5 },
      groups: [
        { speciesId: 'skitterer', count: 4 },
        { speciesId: 'lurker', count: 2 },
      ],
      spawnPointIds: ['ice_fields_east', 'ice_fields_west'],
      spawnInterval: 1.5,
    },

    // Phase 2: Frozen Lake -- dormant nests awaken as player crosses
    {
      waveNumber: 1,
      label: 'NESTS AWAKENING',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -100 },
        proximityRadius: 30,
      },
      groups: [
        { speciesId: 'skitterer', count: 6 },
        { speciesId: 'lurker', count: 2 },
      ],
      spawnPointIds: ['frozen_lake_shore'],
      spawnInterval: 1.0,
      maxConcurrent: 12,
    },

    // Phase 3: Ice Caverns -- heavier resistance
    {
      waveNumber: 2,
      label: 'CAVERN SWARM',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -220 },
        proximityRadius: 25,
      },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 4 },
        {
          speciesId: 'broodmother',
          count: 1,
          spawnPointIds: ['cavern_deep'],
          overrides: { healthMultiplier: 1.5, scale: 2.0 },
        },
      ],
      spawnPointIds: ['cavern_entrance', 'cavern_deep'],
      spawnInterval: 0.8,
      maxConcurrent: 18,
    },
  ],
};

/**
 * Sample spawn config for Chapter 8: Hive Assault.
 *
 * Four phases, mixing ground / flying / armored chitin enemy types.
 * Waves escalate from the open field through the breach and into the
 * hive entrance corridor.
 */
export const HIVE_ASSAULT_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'hive_assault',
  maxGlobalEnemies: 60,
  defaultSpawnInterval: 0.8,

  spawnPoints: [
    {
      id: 'field_north',
      position: { x: 0, y: 0, z: -120 },
      radius: 80,
      facingAngle: Math.PI,
    },
    {
      id: 'field_east',
      position: { x: 80, y: 0, z: -200 },
      radius: 40,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'field_west',
      position: { x: -80, y: 0, z: -200 },
      radius: 40,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'field_air',
      position: { x: 0, y: 18, z: -180 },
      radius: 60,
      facingAngle: Math.PI,
      allowedSpecies: ['skitterer'], // flying variant uses skitterer species
    },
    {
      id: 'breach_front',
      position: { x: 0, y: 0, z: -520 },
      radius: 40,
      facingAngle: 0,
    },
    {
      id: 'breach_flanks',
      position: { x: 50, y: 0, z: -500 },
      radius: 30,
      facingAngle: -Math.PI / 4,
    },
    {
      id: 'entry_corridor',
      position: { x: 0, y: 0, z: -630 },
      radius: 12,
      facingAngle: 0,
    },
  ],

  waves: [
    // Phase 2 - Wave 1: Light resistance
    {
      waveNumber: 0,
      label: 'FIELD ASSAULT - WAVE 1',
      trigger: { type: 'objective', objectiveFlag: 'field_assault_started' },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 4 },
        {
          speciesId: 'skitterer',
          count: 4,
          spawnPointIds: ['field_air'],
          overrides: { scale: 0.6, speedMultiplier: 1.5 },
        },
      ],
      spawnPointIds: ['field_north', 'field_east', 'field_west'],
      spawnInterval: 1.0,
    },

    // Phase 2 - Wave 2: Heavier field push
    {
      waveNumber: 1,
      label: 'FIELD ASSAULT - WAVE 2',
      trigger: { type: 'killPercent', killPercent: 70 },
      groups: [
        { speciesId: 'skitterer', count: 12 },
        { speciesId: 'lurker', count: 6 },
        {
          speciesId: 'skitterer',
          count: 6,
          spawnPointIds: ['field_air'],
          overrides: { scale: 0.6, speedMultiplier: 1.5 },
        },
        { speciesId: 'broodmother', count: 1, overrides: { healthMultiplier: 1.2 } },
      ],
      spawnPointIds: ['field_north', 'field_east', 'field_west'],
      spawnInterval: 0.8,
    },

    // Phase 2 - Wave 3: Final field push before breach
    {
      waveNumber: 2,
      label: 'FIELD ASSAULT - WAVE 3',
      trigger: { type: 'killPercent', killPercent: 60 },
      groups: [
        { speciesId: 'skitterer', count: 16 },
        { speciesId: 'lurker', count: 8 },
        {
          speciesId: 'skitterer',
          count: 8,
          spawnPointIds: ['field_air'],
          overrides: { scale: 0.6, speedMultiplier: 1.5 },
        },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 1.3 } },
      ],
      spawnPointIds: ['field_north', 'field_east', 'field_west'],
      spawnInterval: 0.6,
    },

    // Phase 3 - Breach Point
    {
      waveNumber: 3,
      label: 'BREACH POINT',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -400 },
        proximityRadius: 40,
      },
      groups: [
        { speciesId: 'skitterer', count: 15 },
        { speciesId: 'lurker', count: 5 },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 1.5, scale: 2.0 } },
      ],
      spawnPointIds: ['breach_front', 'breach_flanks'],
      spawnInterval: 0.9,
      maxConcurrent: 25,
    },

    // Phase 3 - Breach Escalation
    {
      waveNumber: 4,
      label: 'BREACH ESCALATION',
      trigger: { type: 'killPercent', killPercent: 60 },
      groups: [
        { speciesId: 'skitterer', count: 20 },
        { speciesId: 'lurker', count: 6 },
        { speciesId: 'broodmother', count: 3, overrides: { healthMultiplier: 1.5, scale: 2.0 } },
        {
          speciesId: 'skitterer',
          count: 4,
          spawnPointIds: ['field_air'],
          overrides: { scale: 0.6, speedMultiplier: 1.5 },
        },
      ],
      spawnPointIds: ['breach_front', 'breach_flanks'],
      spawnInterval: 0.7,
      maxConcurrent: 30,
    },

    // Phase 3 - Final Breach Wave
    {
      waveNumber: 5,
      label: 'BREACH FINAL PUSH',
      trigger: { type: 'killPercent', killPercent: 50 },
      groups: [
        { speciesId: 'skitterer', count: 25 },
        { speciesId: 'lurker', count: 10 },
        { speciesId: 'broodmother', count: 4, overrides: { healthMultiplier: 1.8, scale: 2.2 } },
        {
          speciesId: 'skitterer',
          count: 6,
          spawnPointIds: ['field_air'],
          overrides: { scale: 0.6, speedMultiplier: 1.5 },
        },
      ],
      spawnPointIds: ['breach_front', 'breach_flanks'],
      spawnInterval: 0.5,
      maxConcurrent: 35,
    },

    // Phase 4 - Entry Push: Close quarters
    {
      waveNumber: 6,
      label: 'ENTRY PUSH - WAVE 1',
      trigger: { type: 'objective', objectiveFlag: 'entry_push_started' },
      groups: [
        { speciesId: 'skitterer', count: 20 },
        { speciesId: 'broodmother', count: 1, overrides: { healthMultiplier: 1.5 } },
      ],
      spawnPointIds: ['entry_corridor'],
      spawnInterval: 0.8,
      maxConcurrent: 20,
    },

    // Phase 4 - Entry Push Final Wave
    {
      waveNumber: 7,
      label: 'ENTRY PUSH - FINAL WAVE',
      trigger: { type: 'killPercent', killPercent: 70 },
      groups: [
        { speciesId: 'skitterer', count: 25 },
        { speciesId: 'lurker', count: 5 },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 2.0, scale: 2.0 } },
      ],
      spawnPointIds: ['entry_corridor'],
      spawnInterval: 0.5,
      maxConcurrent: 25,
    },
  ],
};

// Re-export all level configs from the dedicated config file
export * from './LevelSpawnConfigs';
