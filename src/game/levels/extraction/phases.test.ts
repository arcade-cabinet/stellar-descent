/**
 * ExtractionLevel - Phase State Machine Tests
 *
 * Unit tests for phase transitions and wave management.
 * Target: 95%+ line coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('../../core/DifficultySettings', () => ({
  loadDifficultySetting: vi.fn().mockReturnValue('normal'),
}));

vi.mock('./enemies', () => ({
  prepareWaveSpawnQueue: vi.fn().mockReturnValue([
    { species: 'skitterer', count: 3 },
    { species: 'lurker', count: 2 },
  ]),
}));

// Import after mocks
import {
  createPhaseState,
  createWaveState,
  getWaveConfig,
  getTotalWaves,
  getWaveEnemyCount,
  startWaveIntermission,
  startWaveAnnouncement,
  startWave,
  completeWave,
  isWaveComplete,
  areAllWavesComplete,
  updateWaveIntermission,
  updateWaveAnnouncement,
  updateActiveWaveSpawning,
  recordWaveKill,
  getMechIntegrityCapForWave,
  getScaledWaveConfig,
  shouldSpawnSupplyDrop,
  formatTime,
  getWaveHUDDisplay,
  getCollapseHUDDisplay,
  type PhaseState,
  type WaveState,
} from './phases';
import { TOTAL_WAVES, WAVE_INTERMISSION_DURATION, WAVE_ANNOUNCEMENT_DURATION } from './constants';

describe('Phase State Machine', () => {
  describe('createPhaseState', () => {
    it('should create initial phase state with escape_start phase', () => {
      const state = createPhaseState();

      expect(state.phase).toBe('escape_start');
      expect(state.phaseTime).toBe(0);
      expect(state.escapeTimer).toBeGreaterThan(0);
      expect(state.dropshipETA).toBeGreaterThan(0);
      expect(state.hiveCollapseTimer).toBeGreaterThan(0);
      expect(state.playerEscapeProgress).toBe(0);
      expect(state.collapseDistance).toBe(-20);
      expect(state.distanceToLZ).toBe(500);
      expect(state.distanceToDropship).toBe(0);
    });

    it('should have consistent initial values with constants', () => {
      const state = createPhaseState();

      expect(state.escapeTimer).toBe(180); // ESCAPE_TIMER_INITIAL
      expect(state.dropshipETA).toBe(420); // DROPSHIP_ETA_INITIAL
      expect(state.hiveCollapseTimer).toBe(90); // HIVE_COLLAPSE_TIMER
    });
  });

  describe('createWaveState', () => {
    it('should create initial wave state in waiting phase', () => {
      const state = createWaveState();

      expect(state.currentWave).toBe(0);
      expect(state.wavePhase).toBe('waiting');
      expect(state.wavePhaseTimer).toBe(0);
      expect(state.waveEnemiesRemaining).toBe(0);
      expect(state.waveEnemiesKilled).toBe(0);
      expect(state.waveSpawnTimer).toBe(0);
      expect(state.intermissionCountdown).toBe(0);
      expect(state.enemiesToSpawn).toEqual([]);
      expect(state.currentSpawnPointIndex).toBe(0);
      expect(state.waveStartTime).toBe(0);
    });
  });

  describe('Wave Configuration', () => {
    describe('getWaveConfig', () => {
      it('should return wave config for valid wave numbers (1-7)', () => {
        for (let wave = 1; wave <= TOTAL_WAVES; wave++) {
          const config = getWaveConfig(wave);
          expect(config).toBeDefined();
          expect(config?.waveTitle).toBeDefined();
          expect(config?.waveDescription).toBeDefined();
          expect(config?.spawnDelay).toBeGreaterThan(0);
        }
      });

      it('should return undefined for wave 0', () => {
        const config = getWaveConfig(0);
        expect(config).toBeUndefined();
      });

      it('should return undefined for wave beyond total', () => {
        const config = getWaveConfig(TOTAL_WAVES + 1);
        expect(config).toBeUndefined();
      });

      it('should have increasing enemy counts through waves', () => {
        const wave1 = getWaveConfig(1);
        const wave7 = getWaveConfig(7);

        const count1 = getWaveEnemyCount(wave1!);
        const count7 = getWaveEnemyCount(wave7!);

        expect(count7).toBeGreaterThan(count1);
      });
    });

    describe('getTotalWaves', () => {
      it('should return 7 total waves', () => {
        expect(getTotalWaves()).toBe(7);
        expect(getTotalWaves()).toBe(TOTAL_WAVES);
      });
    });

    describe('getWaveEnemyCount', () => {
      it('should count all enemy types including husks', () => {
        const config = {
          drones: 5,
          grunts: 3,
          spitters: 2,
          brutes: 1,
          husks: 4,
          spawnDelay: 1,
          waveTitle: 'Test',
          waveDescription: 'Test wave',
        };

        expect(getWaveEnemyCount(config)).toBe(15);
      });

      it('should handle missing husks', () => {
        const config = {
          drones: 3,
          grunts: 2,
          spitters: 1,
          brutes: 0,
          husks: 0,
          spawnDelay: 1,
          waveTitle: 'Test',
          waveDescription: 'Test wave',
        };

        expect(getWaveEnemyCount(config)).toBe(6);
      });
    });
  });

  describe('Wave State Transitions', () => {
    let initialState: WaveState;

    beforeEach(() => {
      initialState = createWaveState();
    });

    describe('startWaveIntermission', () => {
      it('should transition to intermission phase', () => {
        const newState = startWaveIntermission(initialState, 1);

        expect(newState.currentWave).toBe(1);
        expect(newState.wavePhase).toBe('intermission');
        expect(newState.intermissionCountdown).toBe(WAVE_INTERMISSION_DURATION);
        expect(newState.wavePhaseTimer).toBe(0);
      });

      it('should not transition for wave beyond config', () => {
        const newState = startWaveIntermission(initialState, 100);

        expect(newState).toBe(initialState);
      });
    });

    describe('startWaveAnnouncement', () => {
      it('should transition to announcement phase', () => {
        const intermissionState = startWaveIntermission(initialState, 1);
        const newState = startWaveAnnouncement(intermissionState);

        expect(newState.wavePhase).toBe('announcement');
        expect(newState.wavePhaseTimer).toBe(0);
      });
    });

    describe('startWave', () => {
      it('should transition to active wave phase', () => {
        const newState = startWave(initialState, 1);

        expect(newState.currentWave).toBe(1);
        expect(newState.wavePhase).toBe('active');
        expect(newState.waveSpawnTimer).toBe(0);
        expect(newState.waveEnemiesKilled).toBe(0);
        expect(newState.waveStartTime).toBeGreaterThan(0);
        expect(newState.enemiesToSpawn.length).toBeGreaterThan(0);
        expect(newState.waveEnemiesRemaining).toBeGreaterThan(0);
      });

      it('should not start wave with invalid wave number', () => {
        const newState = startWave(initialState, 100);

        expect(newState).toBe(initialState);
      });
    });

    describe('completeWave', () => {
      it('should transition to waiting phase and rotate spawn points', () => {
        const activeState = startWave(initialState, 1);
        const newState = completeWave(activeState);

        expect(newState.wavePhase).toBe('waiting');
        expect(newState.currentSpawnPointIndex).toBe(2); // Rotated by 2
      });
    });

    describe('isWaveComplete', () => {
      it('should return false when not in active phase', () => {
        expect(isWaveComplete(initialState)).toBe(false);
      });

      it('should return false when enemies remain', () => {
        const activeState: WaveState = {
          ...initialState,
          wavePhase: 'active',
          waveEnemiesRemaining: 5,
          enemiesToSpawn: [],
        };

        expect(isWaveComplete(activeState)).toBe(false);
      });

      it('should return false when enemies still to spawn', () => {
        const activeState: WaveState = {
          ...initialState,
          wavePhase: 'active',
          waveEnemiesRemaining: 0,
          enemiesToSpawn: [{ species: 'skitterer', count: 1 }],
        };

        expect(isWaveComplete(activeState)).toBe(false);
      });

      it('should return true when all enemies killed and none to spawn', () => {
        const completeState: WaveState = {
          ...initialState,
          wavePhase: 'active',
          waveEnemiesRemaining: 0,
          enemiesToSpawn: [],
        };

        expect(isWaveComplete(completeState)).toBe(true);
      });
    });

    describe('areAllWavesComplete', () => {
      it('should return false before final wave', () => {
        const state: WaveState = {
          ...initialState,
          currentWave: 5,
          wavePhase: 'waiting',
        };

        expect(areAllWavesComplete(state)).toBe(false);
      });

      it('should return true after completing final wave', () => {
        const state: WaveState = {
          ...initialState,
          currentWave: TOTAL_WAVES,
          wavePhase: 'waiting',
        };

        expect(areAllWavesComplete(state)).toBe(true);
      });

      it('should return false if still in active phase', () => {
        const state: WaveState = {
          ...initialState,
          currentWave: TOTAL_WAVES,
          wavePhase: 'active',
        };

        expect(areAllWavesComplete(state)).toBe(false);
      });
    });
  });

  describe('Wave Update Logic', () => {
    describe('updateWaveIntermission', () => {
      it('should decrement countdown each frame', () => {
        const state = startWaveIntermission(createWaveState(), 1);
        const { newState, shouldTransition } = updateWaveIntermission(state, 1.0);

        expect(newState.intermissionCountdown).toBe(state.intermissionCountdown - 1.0);
        expect(shouldTransition).toBe(false);
      });

      it('should transition when countdown reaches zero', () => {
        const state: WaveState = {
          ...createWaveState(),
          wavePhase: 'intermission',
          intermissionCountdown: 0.5,
        };
        const { newState, shouldTransition } = updateWaveIntermission(state, 1.0);

        expect(newState.wavePhase).toBe('announcement');
        expect(shouldTransition).toBe(true);
      });
    });

    describe('updateWaveAnnouncement', () => {
      it('should increment timer each frame', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'announcement',
          wavePhaseTimer: 0,
        };
        const { newState, shouldTransition } = updateWaveAnnouncement(state, 1.0);

        expect(newState.wavePhaseTimer).toBe(1.0);
        expect(shouldTransition).toBe(false);
      });

      it('should transition to active when timer exceeds duration', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'announcement',
          wavePhaseTimer: WAVE_ANNOUNCEMENT_DURATION - 0.1,
        };
        const { newState, shouldTransition } = updateWaveAnnouncement(state, 1.0);

        expect(newState.wavePhase).toBe('active');
        expect(shouldTransition).toBe(true);
      });
    });

    describe('updateActiveWaveSpawning', () => {
      it('should return null species when no enemies to spawn', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'active',
          enemiesToSpawn: [],
        };
        const { newState, spawnSpecies } = updateActiveWaveSpawning(state, 0.1);

        expect(spawnSpecies).toBeNull();
        expect(newState).toBe(state);
      });

      it('should not spawn when timer is positive', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'active',
          waveSpawnTimer: 0.5,
          enemiesToSpawn: [{ species: 'skitterer', count: 3 }],
        };
        const { newState, spawnSpecies } = updateActiveWaveSpawning(state, 0.1);

        expect(spawnSpecies).toBeNull();
        expect(newState.waveSpawnTimer).toBe(0.4);
      });

      it('should spawn enemy when timer reaches zero', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'active',
          waveSpawnTimer: 0,
          enemiesToSpawn: [{ species: 'skitterer', count: 3 }],
        };
        const { newState, spawnSpecies } = updateActiveWaveSpawning(state, 0.1);

        expect(spawnSpecies).toBe('skitterer');
        expect(newState.enemiesToSpawn[0].count).toBe(2);
      });

      it('should remove spawn group when count reaches zero', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 1,
          wavePhase: 'active',
          waveSpawnTimer: 0,
          enemiesToSpawn: [{ species: 'skitterer', count: 1 }],
        };
        const { newState, spawnSpecies } = updateActiveWaveSpawning(state, 0.1);

        expect(spawnSpecies).toBe('skitterer');
        expect(newState.enemiesToSpawn.length).toBe(0);
      });

      it('should return null when wave config is missing', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 999, // Invalid wave
          wavePhase: 'active',
          waveSpawnTimer: 0,
          enemiesToSpawn: [{ species: 'skitterer', count: 1 }],
        };
        const { newState, spawnSpecies } = updateActiveWaveSpawning(state, 0.1);

        expect(spawnSpecies).toBeNull();
      });
    });

    describe('recordWaveKill', () => {
      it('should decrement remaining and increment killed', () => {
        const state: WaveState = {
          ...createWaveState(),
          waveEnemiesRemaining: 10,
          waveEnemiesKilled: 5,
        };
        const newState = recordWaveKill(state);

        expect(newState.waveEnemiesRemaining).toBe(9);
        expect(newState.waveEnemiesKilled).toBe(6);
      });
    });
  });

  describe('Mech Integrity', () => {
    describe('getMechIntegrityCapForWave', () => {
      it('should return 100 for waves 1-2', () => {
        expect(getMechIntegrityCapForWave(1)).toBe(100);
        expect(getMechIntegrityCapForWave(2)).toBe(100);
      });

      it('should return decreasing caps for later waves', () => {
        expect(getMechIntegrityCapForWave(3)).toBe(80);
        expect(getMechIntegrityCapForWave(4)).toBe(65);
        expect(getMechIntegrityCapForWave(5)).toBe(50);
        expect(getMechIntegrityCapForWave(6)).toBe(35);
        expect(getMechIntegrityCapForWave(7)).toBe(20);
      });

      it('should return 100 for unexpected wave numbers', () => {
        expect(getMechIntegrityCapForWave(0)).toBe(100);
        expect(getMechIntegrityCapForWave(10)).toBe(100);
      });
    });
  });

  describe('Difficulty Scaling', () => {
    describe('getScaledWaveConfig', () => {
      it('should return undefined for invalid wave', () => {
        const config = getScaledWaveConfig(0);
        expect(config).toBeUndefined();
      });

      it('should return scaled config for valid wave', () => {
        const config = getScaledWaveConfig(1);
        expect(config).toBeDefined();
        expect(config?.drones).toBeGreaterThanOrEqual(1);
      });

      it('should not scale brutes (mini-boss count fixed)', () => {
        const baseConfig = getWaveConfig(5);
        const scaledConfig = getScaledWaveConfig(5);

        expect(scaledConfig?.brutes).toBe(baseConfig?.brutes);
      });
    });

    describe('shouldSpawnSupplyDrop', () => {
      it('should return true for wave 1', () => {
        expect(shouldSpawnSupplyDrop(1)).toBe(true);
      });

      it('should return true for wave 3', () => {
        expect(shouldSpawnSupplyDrop(3)).toBe(true);
      });

      it('should return true for wave 5', () => {
        expect(shouldSpawnSupplyDrop(5)).toBe(true);
      });

      it('should return false for wave 2', () => {
        expect(shouldSpawnSupplyDrop(2)).toBe(false);
      });

      it('should return false for wave 4', () => {
        expect(shouldSpawnSupplyDrop(4)).toBe(false);
      });

      it('should return false for invalid wave', () => {
        expect(shouldSpawnSupplyDrop(0)).toBe(false);
        expect(shouldSpawnSupplyDrop(100)).toBe(false);
      });
    });
  });

  describe('HUD Formatting', () => {
    describe('formatTime', () => {
      it('should format seconds to mm:ss', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(30)).toBe('0:30');
        expect(formatTime(60)).toBe('1:00');
        expect(formatTime(90)).toBe('1:30');
        expect(formatTime(300)).toBe('5:00');
        expect(formatTime(420)).toBe('7:00');
      });

      it('should pad seconds with leading zero', () => {
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(125)).toBe('2:05');
      });
    });

    describe('getWaveHUDDisplay', () => {
      it('should show intermission countdown', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 2,
          wavePhase: 'intermission',
          intermissionCountdown: 8.5,
        };
        const hud = getWaveHUDDisplay(state, 300, 50, 75, 0);

        expect(hud.title).toContain('NEXT WAVE');
        expect(hud.title).toContain('9s');
        expect(hud.title).toContain('[2/7]');
        expect(hud.description).toContain('DROPSHIP');
        expect(hud.description).toContain('KILLS: 50');
        expect(hud.description).toContain('MECH: 75%');
      });

      it('should show wave announcement title', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 3,
          wavePhase: 'announcement',
        };
        const hud = getWaveHUDDisplay(state, 300, 30, 80, 0);

        expect(hud.title).toContain('WAVE 3');
        expect(hud.description).toBeDefined();
      });

      it('should show active wave with enemy count', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 4,
          wavePhase: 'active',
          enemiesToSpawn: [{ species: 'lurker', count: 5 }],
        };
        const hud = getWaveHUDDisplay(state, 200, 60, 50, 8);

        expect(hud.title).toContain('WAVE 4/7');
        expect(hud.title).toContain('[SPAWNING]');
        expect(hud.description).toContain('HOSTILES: 8');
      });

      it('should show waiting state summary', () => {
        const state: WaveState = {
          ...createWaveState(),
          currentWave: 5,
          wavePhase: 'waiting',
        };
        const hud = getWaveHUDDisplay(state, 150, 80, 40, 0);

        expect(hud.title).toContain('LZ OMEGA');
        expect(hud.title).toContain('[5/7]');
        expect(hud.description).toContain('TOTAL KILLS: 80');
      });
    });

    describe('getCollapseHUDDisplay', () => {
      it('should show time and distance', () => {
        const hud = getCollapseHUDDisplay(60, 100);

        expect(hud.title).toBe('REACH THE DROPSHIP');
        expect(hud.description).toContain('TIME: 60s');
        expect(hud.description).toContain('DISTANCE: 100m');
      });

      it('should show warning when time is low', () => {
        const hud = getCollapseHUDDisplay(25, 50);

        expect(hud.description).toContain('[WARNING]');
      });

      it('should show critical when time is very low', () => {
        const hud = getCollapseHUDDisplay(8, 30);

        expect(hud.description).toContain('[CRITICAL]');
      });

      it('should clamp negative time to zero', () => {
        const hud = getCollapseHUDDisplay(-5, 10);

        expect(hud.description).toContain('TIME: 0s');
      });
    });
  });
});
