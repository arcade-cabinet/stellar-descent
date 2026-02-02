/**
 * LevelSpawnConfigs - Spawn configurations for all 10 campaign levels
 *
 * Each level has a unique spawn configuration tailored to its gameplay style,
 * enemy types, and pacing requirements. These configurations are consumed by
 * the SpawnManager to orchestrate enemy waves.
 */

import type { LevelSpawnConfig } from './SpawnConfig';

// ============================================================================
// LEVEL 1: ANCHOR STATION (Tutorial)
// Tutorial spawns, 3-5 skitterers only, very easy introduction
// ============================================================================

export const ANCHOR_STATION_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'anchor_station',
  maxGlobalEnemies: 5,
  defaultSpawnInterval: 2.0, // Slow spawning for tutorial

  spawnPoints: [
    {
      id: 'shooting_range_center',
      position: { x: 0, y: 0, z: -55 },
      radius: 5,
      facingAngle: Math.PI, // Face toward player
      allowedSpecies: ['skitterer'],
    },
    {
      id: 'shooting_range_left',
      position: { x: -5, y: 0, z: -52 },
      radius: 3,
      facingAngle: Math.PI,
      allowedSpecies: ['skitterer'],
    },
    {
      id: 'shooting_range_right',
      position: { x: 5, y: 0, z: -52 },
      radius: 3,
      facingAngle: Math.PI,
      allowedSpecies: ['skitterer'],
    },
  ],

  waves: [
    // Tutorial Wave: Just target practice (no actual enemies, handled by TutorialManager)
    // SpawnManager is mostly dormant on this level
  ],
};

// ============================================================================
// LEVEL 2: LANDFALL (Surface Combat Introduction)
// Mixed ground enemies after landing, first real combat
// ============================================================================

export const LANDFALL_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'landfall',
  maxGlobalEnemies: 15,
  defaultSpawnInterval: 1.2,

  spawnPoints: [
    {
      id: 'surface_north',
      position: { x: 0, y: 0.5, z: 30 },
      radius: 15,
      facingAngle: Math.PI,
    },
    {
      id: 'surface_east',
      position: { x: 20, y: 0.5, z: 20 },
      radius: 12,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'surface_west',
      position: { x: -20, y: 0.5, z: 20 },
      radius: 12,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'surface_far',
      position: { x: 0, y: 0.5, z: 45 },
      radius: 20,
      facingAngle: Math.PI,
    },
  ],

  waves: [
    // Wave 0: Initial encounter after landing
    {
      waveNumber: 0,
      label: 'CONTACT',
      trigger: { type: 'objective', objectiveFlag: 'surface_combat_started' },
      groups: [{ speciesId: 'skitterer', count: 4 }],
      spawnPointIds: ['surface_north', 'surface_east', 'surface_west'],
      spawnInterval: 1.5,
      maxConcurrent: 4,
    },
  ],
};

// ============================================================================
// LEVEL 3: CANYON RUN (Vehicle Chase)
// Roadside ambushes during vehicle sections
// ============================================================================

export const CANYON_RUN_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'canyon_run',
  maxGlobalEnemies: 20,
  defaultSpawnInterval: 0.8,

  spawnPoints: [
    {
      id: 'canyon_roadside_1',
      position: { x: 30, y: 2, z: -200 },
      radius: 15,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'canyon_roadside_2',
      position: { x: -30, y: 2, z: -400 },
      radius: 15,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'canyon_ahead_1',
      position: { x: 0, y: 2, z: -600 },
      radius: 25,
      facingAngle: 0,
    },
    {
      id: 'canyon_ahead_2',
      position: { x: 0, y: 2, z: -1000 },
      radius: 30,
      facingAngle: 0,
    },
    {
      id: 'bridge_ambush',
      position: { x: 0, y: 5, z: -1300 },
      radius: 20,
      facingAngle: 0,
    },
  ],

  waves: [
    // Wave 0: Early canyon ambush
    {
      waveNumber: 0,
      label: 'ROADSIDE AMBUSH',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -150 },
        proximityRadius: 50,
      },
      groups: [{ speciesId: 'skitterer', count: 6 }],
      spawnPointIds: ['canyon_roadside_1'],
      spawnInterval: 0.5,
    },
    // Wave 1: Second ambush
    {
      waveNumber: 1,
      label: 'FLANK ATTACK',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -350 },
        proximityRadius: 50,
      },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 2 },
      ],
      spawnPointIds: ['canyon_roadside_2'],
      spawnInterval: 0.6,
    },
    // Wave 2: Bridge ambush (most dangerous)
    {
      waveNumber: 2,
      label: 'BRIDGE ASSAULT',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -1200 },
        proximityRadius: 60,
      },
      groups: [
        { speciesId: 'skitterer', count: 10 },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['bridge_ambush'],
      spawnInterval: 0.4,
      maxConcurrent: 12,
    },
  ],
};

// ============================================================================
// LEVEL 4: FOB DELTA (Horror Investigation)
// Defensive waves, increasing difficulty
// ============================================================================

export const FOB_DELTA_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'fob_delta',
  maxGlobalEnemies: 20,
  defaultSpawnInterval: 1.0,

  spawnPoints: [
    {
      id: 'courtyard_north',
      position: { x: 0, y: 0, z: 30 },
      radius: 20,
      facingAngle: Math.PI,
    },
    {
      id: 'courtyard_east',
      position: { x: 40, y: 0, z: 0 },
      radius: 15,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'courtyard_west',
      position: { x: -40, y: 0, z: 0 },
      radius: 15,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'vehicle_bay',
      position: { x: 20, y: 0, z: -40 },
      radius: 12,
      facingAngle: Math.PI,
    },
    {
      id: 'barracks_interior',
      position: { x: -20, y: 0, z: 10 },
      radius: 8,
      facingAngle: 0,
    },
  ],

  waves: [
    // Wave 0: Initial ambush in vehicle bay
    {
      waveNumber: 0,
      label: 'AMBUSH',
      trigger: { type: 'objective', objectiveFlag: 'ambush_triggered' },
      groups: [{ speciesId: 'lurker', count: 5 }],
      spawnPointIds: ['vehicle_bay'],
      spawnInterval: 1.2,
      maxConcurrent: 5,
    },
    // Wave 1: Courtyard reinforcements
    {
      waveNumber: 1,
      label: 'REINFORCEMENTS',
      trigger: { type: 'killPercent', killPercent: 60 },
      groups: [
        { speciesId: 'skitterer', count: 6 },
        { speciesId: 'lurker', count: 3 },
      ],
      spawnPointIds: ['courtyard_north', 'courtyard_east', 'courtyard_west'],
      spawnInterval: 0.9,
      maxConcurrent: 8,
    },
    // Wave 2: Final defense
    {
      waveNumber: 2,
      label: 'FINAL ASSAULT',
      trigger: { type: 'killPercent', killPercent: 70 },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 4 },
        { speciesId: 'broodmother', count: 1, overrides: { healthMultiplier: 1.2 } },
      ],
      spawnPointIds: ['courtyard_north', 'courtyard_east', 'courtyard_west'],
      spawnInterval: 0.7,
      maxConcurrent: 12,
    },
  ],
};

// ============================================================================
// LEVEL 5: BROTHERS IN ARMS (Wave Combat with Marcus)
// Coordinated with Marcus AI, flanking spawns
// ============================================================================

export const BROTHERS_IN_ARMS_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'brothers_in_arms',
  maxGlobalEnemies: 40,
  defaultSpawnInterval: 0.8,

  spawnPoints: [
    {
      id: 'arena_north',
      position: { x: 0, y: 0, z: -80 },
      radius: 30,
      facingAngle: Math.PI,
    },
    {
      id: 'arena_northeast',
      position: { x: 60, y: 0, z: -60 },
      radius: 25,
      facingAngle: Math.PI * 0.75,
    },
    {
      id: 'arena_northwest',
      position: { x: -60, y: 0, z: -60 },
      radius: 25,
      facingAngle: Math.PI * 0.25,
    },
    {
      id: 'arena_east',
      position: { x: 80, y: 0, z: 0 },
      radius: 20,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'arena_west',
      position: { x: -80, y: 0, z: 0 },
      radius: 20,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'breach_rim',
      position: { x: 0, y: 0, z: -100 },
      radius: 40,
      facingAngle: Math.PI,
    },
    {
      id: 'flank_left',
      position: { x: -50, y: 0, z: 30 },
      radius: 15,
      facingAngle: -Math.PI / 4,
    },
    {
      id: 'flank_right',
      position: { x: 50, y: 0, z: 30 },
      radius: 15,
      facingAngle: -Math.PI * 0.75,
    },
  ],

  waves: [
    // Wave 0: Drones only - introduction
    {
      waveNumber: 0,
      label: 'WAVE 1 - DRONES',
      trigger: { type: 'objective', objectiveFlag: 'wave_combat_started' },
      groups: [
        { speciesId: 'skitterer', count: 12, overrides: { scale: 0.6, speedMultiplier: 1.5 } },
      ],
      spawnPointIds: ['arena_north', 'arena_northeast', 'arena_northwest'],
      spawnInterval: 0.6,
      maxConcurrent: 12,
    },
    // Wave 1: Ground combat
    {
      waveNumber: 1,
      label: 'WAVE 2 - GROUND ASSAULT',
      trigger: { type: 'killPercent', killPercent: 70 },
      groups: [
        { speciesId: 'lurker', count: 8 },
        { speciesId: 'skitterer', count: 4, overrides: { scale: 0.6, speedMultiplier: 1.5 } },
      ],
      spawnPointIds: ['arena_north', 'arena_east', 'arena_west'],
      spawnInterval: 0.8,
      maxConcurrent: 14,
    },
    // Wave 2: Mixed threats with spitters
    {
      waveNumber: 2,
      label: 'WAVE 3 - COMBINED ARMS',
      trigger: { type: 'killPercent', killPercent: 60 },
      groups: [
        { speciesId: 'lurker', count: 6 },
        { speciesId: 'skitterer', count: 6, overrides: { scale: 0.6, speedMultiplier: 1.5 } },
        {
          speciesId: 'broodmother',
          count: 3,
          overrides: { healthMultiplier: 0.8, damageMultiplier: 1.2 },
        },
      ],
      spawnPointIds: ['arena_north', 'flank_left', 'flank_right'],
      spawnInterval: 0.7,
      maxConcurrent: 18,
    },
    // Wave 3: Boss wave with brutes
    {
      waveNumber: 3,
      label: 'WAVE 4 - BOSS WAVE',
      trigger: { type: 'killPercent', killPercent: 50 },
      groups: [
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 1.5, scale: 1.5 } },
        { speciesId: 'lurker', count: 5 },
        { speciesId: 'skitterer', count: 8, overrides: { scale: 0.6, speedMultiplier: 1.5 } },
      ],
      spawnPointIds: ['breach_rim', 'arena_east', 'arena_west'],
      spawnInterval: 0.5,
      maxConcurrent: 22,
    },
  ],
};

// ============================================================================
// LEVEL 6: SOUTHERN ICE (Ice Variants)
// Ice variants, environmental spawn triggers
// ============================================================================

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
      id: 'frozen_lake_center',
      position: { x: 0, y: 0.5, z: -130 },
      radius: 30,
      facingAngle: 0,
      allowedSpecies: ['ice_chitin'],
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
    // Phase 2: Frozen Lake -- dormant nests awaken
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

// ============================================================================
// LEVEL 7: MINING DEPTHS (Tunnel Combat)
// Tunnel ambushes, darkness spawns
// ============================================================================

export const MINING_DEPTHS_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'mining_depths',
  maxGlobalEnemies: 25,
  defaultSpawnInterval: 1.0,

  spawnPoints: [
    {
      id: 'hub_east',
      position: { x: 15, y: -5, z: -20 },
      radius: 8,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'hub_west',
      position: { x: -15, y: -5, z: -20 },
      radius: 8,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'tunnel_junction',
      position: { x: 0, y: -10, z: -60 },
      radius: 10,
      facingAngle: Math.PI,
    },
    {
      id: 'tunnel_side',
      position: { x: 20, y: -12, z: -80 },
      radius: 6,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'shaft_upper',
      position: { x: 0, y: -20, z: -120 },
      radius: 12,
      facingAngle: Math.PI,
    },
    {
      id: 'shaft_lower',
      position: { x: 0, y: -35, z: -150 },
      radius: 15,
      facingAngle: Math.PI,
    },
    {
      id: 'boss_arena',
      position: { x: 0, y: -40, z: -180 },
      radius: 20,
      facingAngle: Math.PI,
    },
  ],

  waves: [
    // Wave 0: Hub ambush
    {
      waveNumber: 0,
      label: 'BURROWERS EMERGING',
      trigger: { type: 'objective', objectiveFlag: 'hub_explore_started' },
      groups: [{ speciesId: 'skitterer', count: 4 }],
      spawnPointIds: ['hub_east', 'hub_west'],
      spawnInterval: 1.5,
      maxConcurrent: 4,
    },
    // Wave 1: Tunnel junction ambush
    {
      waveNumber: 1,
      label: 'TUNNEL AMBUSH',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: -10, z: -50 },
        proximityRadius: 15,
      },
      groups: [
        { speciesId: 'skitterer', count: 6 },
        { speciesId: 'lurker', count: 2 },
      ],
      spawnPointIds: ['tunnel_junction', 'tunnel_side'],
      spawnInterval: 0.8,
      maxConcurrent: 8,
    },
    // Wave 2: Shaft descent enemies
    {
      waveNumber: 2,
      label: 'DEEP SHAFT CONTACTS',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: -25, z: -130 },
        proximityRadius: 20,
      },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['shaft_upper', 'shaft_lower'],
      spawnInterval: 0.7,
      maxConcurrent: 12,
    },
    // Wave 3: Boss arena spawns (support for drill chitin boss)
    {
      waveNumber: 3,
      label: 'BOSS SUPPORT',
      trigger: { type: 'objective', objectiveFlag: 'boss_fight_started' },
      groups: [{ speciesId: 'skitterer', count: 10 }],
      spawnPointIds: ['boss_arena'],
      spawnInterval: 2.0,
      maxConcurrent: 6,
    },
  ],
};

// ============================================================================
// LEVEL 8: THE BREACH (Hive Queen Boss)
// Boss arena with minion spawns during phases
// ============================================================================

export const THE_BREACH_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'the_breach',
  maxGlobalEnemies: 50,
  defaultSpawnInterval: 0.8,

  spawnPoints: [
    {
      id: 'upper_hive_1',
      position: { x: 5, y: -5, z: 25 },
      radius: 8,
      facingAngle: Math.PI,
    },
    {
      id: 'upper_hive_2',
      position: { x: -5, y: -8, z: 40 },
      radius: 8,
      facingAngle: Math.PI,
    },
    {
      id: 'mid_hive_left',
      position: { x: -15, y: -40, z: 80 },
      radius: 12,
      facingAngle: Math.PI / 4,
    },
    {
      id: 'mid_hive_right',
      position: { x: 15, y: -40, z: 80 },
      radius: 12,
      facingAngle: -Math.PI / 4,
    },
    {
      id: 'lower_hive_chamber',
      position: { x: 0, y: -80, z: 130 },
      radius: 20,
      facingAngle: Math.PI,
    },
    {
      id: 'queen_arena_left',
      position: { x: -30, y: -100, z: 180 },
      radius: 15,
      facingAngle: Math.PI / 3,
    },
    {
      id: 'queen_arena_right',
      position: { x: 30, y: -100, z: 180 },
      radius: 15,
      facingAngle: -Math.PI / 3,
    },
    {
      id: 'queen_arena_back',
      position: { x: 0, y: -100, z: 210 },
      radius: 20,
      facingAngle: Math.PI,
    },
  ],

  waves: [
    // Wave 0: Upper hive exploration
    {
      waveNumber: 0,
      label: 'HIVE PATROL',
      trigger: { type: 'timer', delay: 10 },
      groups: [{ speciesId: 'skitterer', count: 6 }],
      spawnPointIds: ['upper_hive_1', 'upper_hive_2'],
      spawnInterval: 1.2,
      maxConcurrent: 6,
    },
    // Wave 1: Mid hive swarms
    {
      waveNumber: 1,
      label: 'HIVE DEFENSE',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: -30, z: 60 },
        proximityRadius: 20,
      },
      groups: [
        { speciesId: 'skitterer', count: 10 },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['mid_hive_left', 'mid_hive_right'],
      spawnInterval: 0.8,
      maxConcurrent: 14,
    },
    // Wave 2: Lower hive chamber
    {
      waveNumber: 2,
      label: 'CHAMBER DEFENDERS',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: -70, z: 110 },
        proximityRadius: 25,
      },
      groups: [
        { speciesId: 'skitterer', count: 12 },
        { speciesId: 'lurker', count: 6 },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 1.2 } },
      ],
      spawnPointIds: ['lower_hive_chamber'],
      spawnInterval: 0.7,
      maxConcurrent: 20,
    },
    // Wave 3: Queen Phase 1 minions
    {
      waveNumber: 3,
      label: 'QUEEN SUMMONS',
      trigger: { type: 'objective', objectiveFlag: 'queen_phase_1' },
      groups: [{ speciesId: 'skitterer', count: 8 }],
      spawnPointIds: ['queen_arena_left', 'queen_arena_right'],
      spawnInterval: 1.5,
      maxConcurrent: 8,
    },
    // Wave 4: Queen Phase 2 reinforcements
    {
      waveNumber: 4,
      label: 'DESPERATE DEFENSE',
      trigger: { type: 'objective', objectiveFlag: 'queen_phase_2' },
      groups: [
        { speciesId: 'skitterer', count: 12 },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['queen_arena_left', 'queen_arena_right', 'queen_arena_back'],
      spawnInterval: 0.6,
      maxConcurrent: 16,
    },
    // Wave 5: Queen Phase 3 final swarm
    {
      waveNumber: 5,
      label: 'FINAL SWARM',
      trigger: { type: 'objective', objectiveFlag: 'queen_phase_3' },
      groups: [
        { speciesId: 'skitterer', count: 20 },
        { speciesId: 'lurker', count: 6 },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 0.8 } },
      ],
      spawnPointIds: ['queen_arena_left', 'queen_arena_right', 'queen_arena_back'],
      spawnInterval: 0.4,
      maxConcurrent: 25,
    },
  ],
};

// ============================================================================
// LEVEL 9: HIVE ASSAULT (Combined Arms)
// Heavy enemy concentration, squad support
// ============================================================================

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
      allowedSpecies: ['skitterer'], // flying variant
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
    // Phase 2 - Wave 3: Final field push
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
      ],
      spawnPointIds: ['breach_front', 'breach_flanks'],
      spawnInterval: 0.5,
      maxConcurrent: 35,
    },
    // Phase 4 - Entry Push
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
    // Phase 4 - Entry Push Final
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

// ============================================================================
// LEVEL 10: EXTRACTION (Holdout Defense)
// Escalating waves during holdout
// ============================================================================

export const EXTRACTION_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'extraction',
  maxGlobalEnemies: 50,
  defaultSpawnInterval: 0.8,

  spawnPoints: [
    {
      id: 'tunnel_exit_left',
      position: { x: -25, y: 0, z: -20 },
      radius: 15,
      facingAngle: Math.PI / 3,
    },
    {
      id: 'tunnel_exit_right',
      position: { x: 25, y: 0, z: -20 },
      radius: 15,
      facingAngle: -Math.PI / 3,
    },
    {
      id: 'surface_north',
      position: { x: 0, y: 0, z: -80 },
      radius: 30,
      facingAngle: Math.PI,
    },
    {
      id: 'surface_east',
      position: { x: 60, y: 0, z: -40 },
      radius: 25,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'surface_west',
      position: { x: -60, y: 0, z: -40 },
      radius: 25,
      facingAngle: Math.PI / 2,
    },
    {
      id: 'lz_perimeter_1',
      position: { x: 40, y: 0, z: 30 },
      radius: 20,
      facingAngle: -Math.PI * 0.75,
    },
    {
      id: 'lz_perimeter_2',
      position: { x: -40, y: 0, z: 30 },
      radius: 20,
      facingAngle: Math.PI * 0.75,
    },
    {
      id: 'breach_holes',
      position: { x: 0, y: 0, z: -50 },
      radius: 40,
      facingAngle: Math.PI,
    },
  ],

  waves: [
    // Wave 1: Initial holdout
    {
      waveNumber: 0,
      label: 'HOLDOUT - WAVE 1',
      trigger: { type: 'objective', objectiveFlag: 'holdout_started' },
      groups: [
        { speciesId: 'skitterer', count: 10 },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['tunnel_exit_left', 'tunnel_exit_right', 'surface_north'],
      spawnInterval: 1.0,
      maxConcurrent: 14,
    },
    // Wave 2: Flanking attack
    {
      waveNumber: 1,
      label: 'HOLDOUT - WAVE 2',
      trigger: { type: 'killPercent', killPercent: 70 },
      groups: [
        { speciesId: 'skitterer', count: 14 },
        { speciesId: 'lurker', count: 6 },
        { speciesId: 'broodmother', count: 1, overrides: { healthMultiplier: 1.2 } },
      ],
      spawnPointIds: ['surface_east', 'surface_west', 'surface_north'],
      spawnInterval: 0.8,
      maxConcurrent: 18,
    },
    // Wave 3: Heavy assault
    {
      waveNumber: 2,
      label: 'HOLDOUT - WAVE 3',
      trigger: { type: 'killPercent', killPercent: 60 },
      groups: [
        { speciesId: 'skitterer', count: 18 },
        { speciesId: 'lurker', count: 8 },
        { speciesId: 'broodmother', count: 2, overrides: { healthMultiplier: 1.3 } },
      ],
      spawnPointIds: ['surface_north', 'lz_perimeter_1', 'lz_perimeter_2'],
      spawnInterval: 0.7,
      maxConcurrent: 22,
    },
    // Wave 4: Breach wave
    {
      waveNumber: 3,
      label: 'HOLDOUT - WAVE 4',
      trigger: { type: 'killPercent', killPercent: 50 },
      groups: [
        { speciesId: 'skitterer', count: 20 },
        { speciesId: 'lurker', count: 10 },
        { speciesId: 'broodmother', count: 3, overrides: { healthMultiplier: 1.5 } },
      ],
      spawnPointIds: ['breach_holes', 'surface_north'],
      spawnInterval: 0.6,
      maxConcurrent: 28,
    },
    // Wave 5: Desperate defense
    {
      waveNumber: 4,
      label: 'HOLDOUT - WAVE 5',
      trigger: { type: 'killPercent', killPercent: 50 },
      groups: [
        { speciesId: 'skitterer', count: 25 },
        { speciesId: 'lurker', count: 12 },
        { speciesId: 'broodmother', count: 3, overrides: { healthMultiplier: 1.8, scale: 1.5 } },
      ],
      spawnPointIds: ['breach_holes', 'surface_east', 'surface_west'],
      spawnInterval: 0.5,
      maxConcurrent: 32,
    },
    // Wave 6: Final wave before collapse
    {
      waveNumber: 5,
      label: 'HOLDOUT - WAVE 6',
      trigger: { type: 'killPercent', killPercent: 50 },
      groups: [
        { speciesId: 'skitterer', count: 30 },
        { speciesId: 'lurker', count: 15 },
        { speciesId: 'broodmother', count: 4, overrides: { healthMultiplier: 2.0, scale: 1.8 } },
      ],
      spawnPointIds: ['breach_holes', 'surface_north', 'lz_perimeter_1', 'lz_perimeter_2'],
      spawnInterval: 0.4,
      maxConcurrent: 40,
    },
    // Wave 7: Final holdout
    {
      waveNumber: 6,
      label: 'HOLDOUT - FINAL WAVE',
      trigger: { type: 'killPercent', killPercent: 40 },
      groups: [
        { speciesId: 'skitterer', count: 35 },
        { speciesId: 'lurker', count: 18 },
        { speciesId: 'broodmother', count: 5, overrides: { healthMultiplier: 2.2, scale: 2.0 } },
      ],
      spawnPointIds: ['breach_holes', 'surface_north', 'surface_east', 'surface_west'],
      spawnInterval: 0.3,
      maxConcurrent: 50,
    },
  ],
};

// ============================================================================
// LEVEL 11: FINAL ESCAPE (Pursuit Chase)
// Pursuit spawns, timed waves during vehicle escape
// ============================================================================

export const FINAL_ESCAPE_SPAWN_CONFIG: LevelSpawnConfig = {
  levelId: 'final_escape',
  maxGlobalEnemies: 20,
  defaultSpawnInterval: 1.5,

  spawnPoints: [
    {
      id: 'tunnel_behind',
      position: { x: 0, y: 2, z: 20 },
      radius: 15,
      facingAngle: Math.PI,
    },
    {
      id: 'tunnel_sides',
      position: { x: 15, y: 2, z: 0 },
      radius: 10,
      facingAngle: -Math.PI / 2,
    },
    {
      id: 'surface_pursuit',
      position: { x: 0, y: 2, z: -400 },
      radius: 40,
      facingAngle: 0,
    },
    {
      id: 'canyon_flanks',
      position: { x: 30, y: 3, z: -1800 },
      radius: 25,
      facingAngle: -Math.PI / 3,
    },
    {
      id: 'launch_pad_defense',
      position: { x: 0, y: 2, z: -2700 },
      radius: 30,
      facingAngle: Math.PI,
    },
  ],

  waves: [
    // Tunnel section: pursuit enemies
    {
      waveNumber: 0,
      label: 'PURSUIT BEGINS',
      trigger: { type: 'timer', delay: 5 },
      groups: [{ speciesId: 'skitterer', count: 6, overrides: { speedMultiplier: 1.5 } }],
      spawnPointIds: ['tunnel_behind'],
      spawnInterval: 2.0,
      maxConcurrent: 6,
    },
    // Surface section: stragglers
    {
      waveNumber: 1,
      label: 'SURFACE STRAGGLERS',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -500 },
        proximityRadius: 60,
      },
      groups: [
        { speciesId: 'skitterer', count: 8, overrides: { speedMultiplier: 1.3 } },
        { speciesId: 'lurker', count: 3 },
      ],
      spawnPointIds: ['surface_pursuit'],
      spawnInterval: 1.5,
      maxConcurrent: 8,
    },
    // Canyon section: flank attacks
    {
      waveNumber: 2,
      label: 'CANYON AMBUSH',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -1700 },
        proximityRadius: 80,
      },
      groups: [
        { speciesId: 'skitterer', count: 10, overrides: { speedMultiplier: 1.4 } },
        { speciesId: 'lurker', count: 4 },
      ],
      spawnPointIds: ['canyon_flanks'],
      spawnInterval: 1.0,
      maxConcurrent: 10,
    },
    // Launch pad: final defense
    {
      waveNumber: 3,
      label: 'FINAL DEFENSE',
      trigger: {
        type: 'proximity',
        proximityCenter: { x: 0, y: 0, z: -2600 },
        proximityRadius: 50,
      },
      groups: [
        { speciesId: 'skitterer', count: 8 },
        { speciesId: 'lurker', count: 4 },
        { speciesId: 'broodmother', count: 1, overrides: { healthMultiplier: 0.8 } },
      ],
      spawnPointIds: ['launch_pad_defense'],
      spawnInterval: 0.8,
      maxConcurrent: 12,
    },
  ],
};

// ============================================================================
// LEVEL CONFIG MAP - Export all configs for easy lookup
// ============================================================================

export const LEVEL_SPAWN_CONFIGS: Record<string, LevelSpawnConfig> = {
  anchor_station: ANCHOR_STATION_SPAWN_CONFIG,
  landfall: LANDFALL_SPAWN_CONFIG,
  canyon_run: CANYON_RUN_SPAWN_CONFIG,
  fob_delta: FOB_DELTA_SPAWN_CONFIG,
  brothers_in_arms: BROTHERS_IN_ARMS_SPAWN_CONFIG,
  southern_ice: SOUTHERN_ICE_SPAWN_CONFIG,
  mining_depths: MINING_DEPTHS_SPAWN_CONFIG,
  the_breach: THE_BREACH_SPAWN_CONFIG,
  hive_assault: HIVE_ASSAULT_SPAWN_CONFIG,
  extraction: EXTRACTION_SPAWN_CONFIG,
  final_escape: FINAL_ESCAPE_SPAWN_CONFIG,
};
