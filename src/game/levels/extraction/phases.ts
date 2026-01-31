/**
 * ExtractionLevel - Phase State Machine
 *
 * Contains phase transition logic and wave management.
 */

import type { WaveConfig, WavePhase, ExtractionPhase } from './types';
import {
  WAVE_CONFIGS,
  TOTAL_WAVES,
  WAVE_ANNOUNCEMENT_DURATION,
  WAVE_INTERMISSION_DURATION,
  ESCAPE_TIMER_INITIAL,
  DROPSHIP_ETA_INITIAL,
  HIVE_COLLAPSE_TIMER,
} from './constants';
import { prepareWaveSpawnQueue } from './enemies';

// ============================================================================
// PHASE STATE
// ============================================================================

/**
 * Phase state container
 */
export interface PhaseState {
  phase: ExtractionPhase;
  phaseTime: number;
  escapeTimer: number;
  dropshipETA: number;
  hiveCollapseTimer: number;
  playerEscapeProgress: number;
  collapseDistance: number;
  distanceToLZ: number;
  distanceToDropship: number;
}

/**
 * Wave state container
 */
export interface WaveState {
  currentWave: number;
  wavePhase: WavePhase;
  wavePhaseTimer: number;
  waveEnemiesRemaining: number;
  waveEnemiesKilled: number;
  waveSpawnTimer: number;
  intermissionCountdown: number;
  enemiesToSpawn: { species: string; count: number }[];
  currentSpawnPointIndex: number;
  waveStartTime: number;
}

/**
 * Create initial phase state
 */
export function createPhaseState(): PhaseState {
  return {
    phase: 'escape_start',
    phaseTime: 0,
    escapeTimer: ESCAPE_TIMER_INITIAL,
    dropshipETA: DROPSHIP_ETA_INITIAL,
    hiveCollapseTimer: HIVE_COLLAPSE_TIMER,
    playerEscapeProgress: 0,
    collapseDistance: -20,
    distanceToLZ: 500,
    distanceToDropship: 0,
  };
}

/**
 * Create initial wave state
 */
export function createWaveState(): WaveState {
  return {
    currentWave: 0,
    wavePhase: 'waiting',
    wavePhaseTimer: 0,
    waveEnemiesRemaining: 0,
    waveEnemiesKilled: 0,
    waveSpawnTimer: 0,
    intermissionCountdown: 0,
    enemiesToSpawn: [],
    currentSpawnPointIndex: 0,
    waveStartTime: 0,
  };
}

// ============================================================================
// WAVE CONFIGURATION ACCESS
// ============================================================================

/**
 * Get wave configuration by wave number (1-indexed)
 */
export function getWaveConfig(waveNumber: number): WaveConfig | undefined {
  return WAVE_CONFIGS[waveNumber - 1];
}

/**
 * Get total number of waves
 */
export function getTotalWaves(): number {
  return TOTAL_WAVES;
}

/**
 * Calculate total enemy count for a wave
 */
export function getWaveEnemyCount(config: WaveConfig): number {
  return config.drones + config.grunts + config.spitters + config.brutes;
}

// ============================================================================
// WAVE STATE TRANSITIONS
// ============================================================================

/**
 * Start wave intermission (countdown before wave begins)
 */
export function startWaveIntermission(state: WaveState, waveNumber: number): WaveState {
  if (waveNumber > WAVE_CONFIGS.length) {
    return state;
  }

  return {
    ...state,
    currentWave: waveNumber,
    wavePhase: 'intermission',
    intermissionCountdown: WAVE_INTERMISSION_DURATION,
    wavePhaseTimer: 0,
  };
}

/**
 * Start wave announcement phase
 */
export function startWaveAnnouncement(state: WaveState): WaveState {
  return {
    ...state,
    wavePhase: 'announcement',
    wavePhaseTimer: 0,
  };
}

/**
 * Start active wave combat
 */
export function startWave(state: WaveState, waveNumber: number): WaveState {
  const config = getWaveConfig(waveNumber);
  if (!config) {
    return state;
  }

  const enemiesToSpawn = prepareWaveSpawnQueue(
    config.drones,
    config.grunts,
    config.spitters,
    config.brutes
  );

  return {
    ...state,
    currentWave: waveNumber,
    wavePhase: 'active',
    waveSpawnTimer: 0,
    waveEnemiesKilled: 0,
    waveStartTime: performance.now(),
    enemiesToSpawn,
    waveEnemiesRemaining: getWaveEnemyCount(config),
  };
}

/**
 * Mark wave as complete
 */
export function completeWave(state: WaveState): WaveState {
  return {
    ...state,
    wavePhase: 'waiting',
    currentSpawnPointIndex: (state.currentSpawnPointIndex + 2) % 8, // Rotate spawn points
  };
}

/**
 * Check if wave is complete
 */
export function isWaveComplete(state: WaveState): boolean {
  return (
    state.wavePhase === 'active' &&
    state.waveEnemiesRemaining <= 0 &&
    state.enemiesToSpawn.length === 0
  );
}

/**
 * Check if all waves are complete
 */
export function areAllWavesComplete(state: WaveState): boolean {
  return state.currentWave >= TOTAL_WAVES && state.wavePhase === 'waiting';
}

// ============================================================================
// WAVE UPDATE LOGIC
// ============================================================================

/**
 * Update wave intermission countdown
 * Returns true if should transition to announcement
 */
export function updateWaveIntermission(state: WaveState, deltaTime: number): {
  newState: WaveState;
  shouldTransition: boolean;
} {
  const newCountdown = state.intermissionCountdown - deltaTime;

  if (newCountdown <= 0) {
    return {
      newState: startWaveAnnouncement(state),
      shouldTransition: true,
    };
  }

  return {
    newState: {
      ...state,
      intermissionCountdown: newCountdown,
    },
    shouldTransition: false,
  };
}

/**
 * Update wave announcement timer
 * Returns true if should transition to active wave
 */
export function updateWaveAnnouncement(state: WaveState, deltaTime: number): {
  newState: WaveState;
  shouldTransition: boolean;
} {
  const newTimer = state.wavePhaseTimer + deltaTime;

  if (newTimer >= WAVE_ANNOUNCEMENT_DURATION) {
    return {
      newState: startWave(state, state.currentWave),
      shouldTransition: true,
    };
  }

  return {
    newState: {
      ...state,
      wavePhaseTimer: newTimer,
    },
    shouldTransition: false,
  };
}

/**
 * Update active wave spawning
 * Returns species to spawn or null
 */
export function updateActiveWaveSpawning(
  state: WaveState,
  deltaTime: number
): { newState: WaveState; spawnSpecies: string | null } {
  if (state.enemiesToSpawn.length === 0) {
    return { newState: state, spawnSpecies: null };
  }

  const config = getWaveConfig(state.currentWave);
  if (!config) {
    return { newState: state, spawnSpecies: null };
  }

  const newSpawnTimer = state.waveSpawnTimer - deltaTime;

  if (newSpawnTimer <= 0) {
    const spawnGroup = state.enemiesToSpawn[0];
    const speciesName = spawnGroup.species;
    spawnGroup.count--;

    const newEnemiesToSpawn =
      spawnGroup.count <= 0 ? state.enemiesToSpawn.slice(1) : state.enemiesToSpawn;

    return {
      newState: {
        ...state,
        waveSpawnTimer: config.spawnDelay,
        enemiesToSpawn: newEnemiesToSpawn,
      },
      spawnSpecies: speciesName,
    };
  }

  return {
    newState: {
      ...state,
      waveSpawnTimer: newSpawnTimer,
    },
    spawnSpecies: null,
  };
}

/**
 * Record enemy kill in wave state
 */
export function recordWaveKill(state: WaveState): WaveState {
  return {
    ...state,
    waveEnemiesRemaining: state.waveEnemiesRemaining - 1,
    waveEnemiesKilled: state.waveEnemiesKilled + 1,
  };
}

// ============================================================================
// MECH INTEGRITY
// ============================================================================

/**
 * Get mech integrity cap for a given wave
 */
export function getMechIntegrityCapForWave(waveNumber: number): number {
  switch (waveNumber) {
    case 3:
      return 80;
    case 4:
      return 65;
    case 5:
      return 50;
    case 6:
      return 35;
    case 7:
      return 20;
    default:
      return 100;
  }
}

// ============================================================================
// HUD FORMATTING
// ============================================================================

/**
 * Format time in mm:ss format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get HUD display for current wave state
 */
export function getWaveHUDDisplay(
  state: WaveState,
  dropshipETA: number,
  kills: number,
  mechIntegrity: number,
  activeEnemyCount: number
): { title: string; description: string } {
  const timerStr = formatTime(Math.max(0, dropshipETA));

  switch (state.wavePhase) {
    case 'intermission': {
      const countdownInt = Math.ceil(state.intermissionCountdown);
      return {
        title: `NEXT WAVE IN ${countdownInt}s`,
        description: `DROPSHIP ETA: ${timerStr} | KILLS: ${kills} | MECH: ${Math.floor(Math.max(0, mechIntegrity))}%`,
      };
    }

    case 'announcement': {
      const config = getWaveConfig(state.currentWave);
      return {
        title: config?.waveTitle ?? 'WAVE INCOMING',
        description: config?.waveDescription ?? 'Prepare for combat!',
      };
    }

    case 'active': {
      return {
        title: `WAVE ${state.currentWave}/${TOTAL_WAVES}`,
        description: `ENEMIES: ${activeEnemyCount} | DROPSHIP: ${timerStr} | MECH: ${Math.floor(Math.max(0, mechIntegrity))}%`,
      };
    }

    case 'waiting':
    default: {
      return {
        title: 'LZ OMEGA - HOLDOUT',
        description: `DROPSHIP ETA: ${timerStr} | TOTAL KILLS: ${kills}`,
      };
    }
  }
}

/**
 * Get collapse HUD display
 */
export function getCollapseHUDDisplay(
  timer: number,
  distanceToDropship: number
): { title: string; description: string } {
  const timerInt = Math.ceil(Math.max(0, timer));
  let urgencyLevel = '';
  if (timerInt <= 10) {
    urgencyLevel = ' [CRITICAL]';
  } else if (timerInt <= 30) {
    urgencyLevel = ' [WARNING]';
  }

  return {
    title: 'REACH THE DROPSHIP',
    description: `TIME: ${timerInt}s | DISTANCE: ${distanceToDropship.toFixed(0)}m${urgencyLevel}`,
  };
}
