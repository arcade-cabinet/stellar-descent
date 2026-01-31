/**
 * Anchor Station Spawn Configuration
 *
 * Tutorial level spawn config using the Zod-validated schema.
 * This level introduces basic combat with small numbers of weaker enemies.
 *
 * The tutorial waves are triggered by objective completion as the player
 * progresses through the station's training areas.
 */

import type { LevelSpawnConfig } from '../shared/SpawnConfigZod';

/**
 * Anchor Station spawn configuration.
 *
 * Three tutorial waves:
 * 1. First contact - 2 drones after reaching the armory
 * 2. Second encounter - 3 drones + 1 soldier after clearing wave 1
 * 3. Final test - Victory condition
 */
export const anchorStationSpawnConfig: LevelSpawnConfig = {
  levelId: 'anchor_station',

  // Named spawn points in the station
  spawnPoints: {
    corridor_1: {
      position: [10, 0, 5],
      rotation: 0,
    },
    vent_1: {
      position: [15, 2, 8],
      rotation: 180,
    },
    bay_entrance: {
      position: [20, 0, 0],
      rotation: 90,
    },
    // Additional tutorial spawn points
    shooting_range_center: {
      position: [0, 0, -55],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer'],
    },
    shooting_range_left: {
      position: [-5, 0, -52],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer'],
    },
    shooting_range_right: {
      position: [5, 0, -52],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer'],
    },
  },

  waves: [
    // Tutorial Wave 1: First enemies after reaching armory
    {
      id: 'tutorial_wave_1',
      label: 'FIRST CONTACT',
      trigger: 'objective',
      triggerValue: 'reach_armory',
      units: [
        {
          species: 'drone',
          count: 2,
          spawnPoint: 'corridor_1',
          delay: 0,
          spread: 3,
        },
      ],
      onComplete: 'tutorial_wave_2',
      spawnInterval: 2.0,
      maxConcurrent: 2,
    },

    // Tutorial Wave 2: Slightly harder after clearing first wave
    {
      id: 'tutorial_wave_2',
      label: 'REINFORCEMENTS',
      trigger: 'manual', // Triggered by onComplete of wave 1
      units: [
        {
          species: 'drone',
          count: 3,
          spawnPoint: 'vent_1',
          delay: 0,
          spread: 4,
        },
        {
          species: 'soldier',
          count: 1,
          spawnPoint: 'bay_entrance',
          delay: 2,
          spread: 2,
        },
      ],
      onComplete: 'victory',
      spawnInterval: 1.5,
      maxConcurrent: 4,
    },
  ],

  // Tutorial-friendly limits
  maxGlobalEnemies: 5,
  defaultSpawnInterval: 2.0,
};

/**
 * Extended anchor station config with shooting range practice waves.
 * Used when player enters the holodeck training area.
 */
export const anchorStationTrainingConfig: LevelSpawnConfig = {
  levelId: 'anchor_station_training',

  spawnPoints: {
    target_near: {
      position: [0, 0, -30],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer'],
    },
    target_mid: {
      position: [0, 0, -45],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer'],
    },
    target_far: {
      position: [0, 0, -60],
      rotation: 180,
      allowedSpecies: ['drone', 'skitterer', 'soldier'],
    },
    target_left: {
      position: [-10, 0, -50],
      rotation: 135,
    },
    target_right: {
      position: [10, 0, -50],
      rotation: 225,
    },
  },

  waves: [
    // Wave 1: Basic stationary targets
    {
      id: 'training_static',
      label: 'STATIC TARGETS',
      trigger: 'objective',
      triggerValue: 'training_start',
      units: [
        { species: 'drone', count: 3, spawnPoint: 'target_mid', delay: 0, spread: 8 },
      ],
      onComplete: 'training_moving',
      spawnInterval: 1.0,
    },

    // Wave 2: Moving targets
    {
      id: 'training_moving',
      label: 'MOVING TARGETS',
      trigger: 'manual',
      units: [
        { species: 'drone', count: 2, spawnPoint: 'target_left', delay: 0, spread: 3 },
        { species: 'drone', count: 2, spawnPoint: 'target_right', delay: 1, spread: 3 },
      ],
      onComplete: 'training_mixed',
      spawnInterval: 0.8,
    },

    // Wave 3: Mixed difficulty
    {
      id: 'training_mixed',
      label: 'COMBAT DRILL',
      trigger: 'manual',
      units: [
        { species: 'drone', count: 3, spawnPoint: 'target_near', delay: 0, spread: 5 },
        { species: 'soldier', count: 1, spawnPoint: 'target_far', delay: 2, spread: 2 },
      ],
      onComplete: 'victory',
      spawnInterval: 1.2,
      maxConcurrent: 4,
    },
  ],

  maxGlobalEnemies: 5,
  defaultSpawnInterval: 1.5,
};
