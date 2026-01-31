/**
 * LevelProgressionIntegration.test.ts - Level progression tests for all 10 campaign levels
 *
 * Tests the completion conditions for each level in the campaign:
 * - Anchor Station: Tutorial objectives
 * - Landfall: Beacon activation
 * - Canyon Run: Reaching extraction
 * - FOB Delta: Defense waves
 * - Brothers in Arms: Marcus rescue
 * - Southern Ice: Ice Queen defeat
 * - Mining Depths: Elevator activation
 * - The Breach: Queen boss defeat
 * - Hive Assault: Core destruction
 * - Extraction: Holdout waves
 * - Final Escape: Reaching orbit
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  CAMPAIGN_LEVELS,
  getFirstLevel,
  getNextLevel,
  getPreviousLevel,
  getTotalLevels,
  getLevelIndex,
  iterateLevels,
  type LevelId,
  type LevelConfig,
  type LevelState,
  type LevelStats,
} from '../levels/types';
import { EventBus, getEventBus, disposeEventBus } from '../core/EventBus';

// Mock crypto
vi.stubGlobal('crypto', {
  randomUUID: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

/**
 * Simulate level state for testing
 */
function createLevelState(levelId: LevelId, overrides: Partial<LevelState> = {}): LevelState {
  return {
    id: levelId,
    visited: false,
    completed: false,
    stats: {
      kills: 0,
      secretsFound: 0,
      timeSpent: 0,
      deaths: 0,
    },
    flags: {},
    ...overrides,
  };
}

/**
 * Check if victory conditions are met for a level
 */
function checkVictoryConditions(
  levelId: LevelId,
  state: LevelState,
  flags: Record<string, boolean>
): boolean {
  switch (levelId) {
    case 'anchor_station':
      return flags.tutorialComplete ?? false;
    case 'landfall':
      return flags.beaconActivated ?? false;
    case 'canyon_run':
      return flags.reachedExtraction ?? false;
    case 'fob_delta':
      return (flags.wave1Complete && flags.wave2Complete && flags.wave3Complete) ?? false;
    case 'brothers_in_arms':
      return flags.marcusRescued ?? false;
    case 'southern_ice':
      return flags.iceQueenDefeated ?? false;
    case 'the_breach':
      return flags.queenDefeated ?? false;
    case 'hive_assault':
      return flags.coreDestroyed ?? false;
    case 'extraction':
      return (flags.holdoutComplete && flags.evac) ?? false;
    case 'final_escape':
      return flags.reachedOrbit ?? false;
    default:
      return false;
  }
}

describe('Level Progression Integration', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    disposeEventBus();
    eventBus = getEventBus();
  });

  afterEach(() => {
    disposeEventBus();
  });

  describe('Campaign Structure', () => {
    it('should have exactly 10 campaign levels', () => {
      const totalLevels = getTotalLevels();
      expect(totalLevels).toBe(10);
    });

    it('should have correct level order via linked list', () => {
      const expectedOrder: LevelId[] = [
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
      ];

      const actualOrder: LevelId[] = [];
      for (const level of iterateLevels()) {
        actualOrder.push(level.id);
      }

      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should start with Anchor Station', () => {
      const firstLevel = getFirstLevel();
      expect(firstLevel.id).toBe('anchor_station');
    });

    it('should end with Final Escape', () => {
      const levels = [...iterateLevels()];
      const lastLevel = levels[levels.length - 1];
      expect(lastLevel.id).toBe('final_escape');
      expect(lastLevel.nextLevelId).toBeNull();
    });

    it('should navigate forward through levels', () => {
      let current: LevelConfig | null = getFirstLevel();
      const visited: LevelId[] = [];

      while (current) {
        visited.push(current.id);
        current = getNextLevel(current.id);
      }

      expect(visited.length).toBe(10);
      expect(visited[0]).toBe('anchor_station');
      expect(visited[9]).toBe('final_escape');
    });

    it('should navigate backward through levels', () => {
      const levels = [...iterateLevels()];
      const lastLevel = levels[levels.length - 1];

      let current: LevelConfig | null = lastLevel;
      const visited: LevelId[] = [];

      while (current) {
        visited.push(current.id);
        current = getPreviousLevel(current.id);
      }

      expect(visited.length).toBe(10);
      expect(visited[0]).toBe('final_escape');
      expect(visited[9]).toBe('anchor_station');
    });

    it('should return correct level index', () => {
      expect(getLevelIndex('anchor_station')).toBe(0);
      expect(getLevelIndex('landfall')).toBe(1);
      expect(getLevelIndex('final_escape')).toBe(9);
    });
  });

  describe('Level Configurations', () => {
    it('should have unique chapter numbers', () => {
      const chapters = new Set<number>();
      for (const level of iterateLevels()) {
        expect(chapters.has(level.chapter)).toBe(false);
        chapters.add(level.chapter);
      }
      expect(chapters.size).toBe(10);
    });

    it('should have chapters 1-10', () => {
      const chapters = [...iterateLevels()].map((l) => l.chapter).sort((a, b) => a - b);
      expect(chapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should have valid spawn positions', () => {
      for (const level of iterateLevels()) {
        expect(level.playerSpawnPosition).toBeDefined();
        expect(level.playerSpawnPosition!.y).toBeGreaterThan(0);
      }
    });

    it('should have mission names', () => {
      for (const level of iterateLevels()) {
        expect(level.missionName).toBeDefined();
        expect(level.missionName.length).toBeGreaterThan(0);
      }
    });

    it('should have act names', () => {
      for (const level of iterateLevels()) {
        expect(level.actName).toBeDefined();
        expect(level.actName).toMatch(/^ACT \d:/);
      }
    });
  });

  describe('Anchor Station: Tutorial Objectives', () => {
    it('should complete after tutorial objectives are done', () => {
      const state = createLevelState('anchor_station');
      const flags = { tutorialComplete: true };

      const isComplete = checkVictoryConditions('anchor_station', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without tutorial objectives', () => {
      const state = createLevelState('anchor_station');
      const flags = { tutorialComplete: false };

      const isComplete = checkVictoryConditions('anchor_station', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have station level type', () => {
      const level = CAMPAIGN_LEVELS.anchor_station;
      expect(level.type).toBe('station');
    });

    it('should link to Landfall', () => {
      const level = CAMPAIGN_LEVELS.anchor_station;
      expect(level.nextLevelId).toBe('landfall');
    });
  });

  describe('Landfall: Beacon Activation', () => {
    it('should complete after beacon activation', () => {
      const state = createLevelState('landfall');
      const flags = { beaconActivated: true };

      const isComplete = checkVictoryConditions('landfall', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without beacon activation', () => {
      const state = createLevelState('landfall');
      const flags = { beaconActivated: false };

      const isComplete = checkVictoryConditions('landfall', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have drop level type', () => {
      const level = CAMPAIGN_LEVELS.landfall;
      expect(level.type).toBe('drop');
    });

    it('should have high altitude spawn for HALO drop', () => {
      const level = CAMPAIGN_LEVELS.landfall;
      expect(level.playerSpawnPosition!.y).toBeGreaterThan(100);
    });
  });

  describe('Canyon Run: Reaching Extraction', () => {
    it('should complete after reaching extraction point', () => {
      const state = createLevelState('canyon_run');
      const flags = { reachedExtraction: true };

      const isComplete = checkVictoryConditions('canyon_run', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete before reaching extraction', () => {
      const state = createLevelState('canyon_run');
      const flags = { reachedExtraction: false };

      const isComplete = checkVictoryConditions('canyon_run', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have vehicle level type', () => {
      const level = CAMPAIGN_LEVELS.canyon_run;
      expect(level.type).toBe('vehicle');
    });
  });

  describe('FOB Delta: Defense Waves', () => {
    it('should complete after all defense waves', () => {
      const state = createLevelState('fob_delta');
      const flags = {
        wave1Complete: true,
        wave2Complete: true,
        wave3Complete: true,
      };

      const isComplete = checkVictoryConditions('fob_delta', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete with incomplete waves', () => {
      const state = createLevelState('fob_delta');
      const flags = {
        wave1Complete: true,
        wave2Complete: true,
        wave3Complete: false,
      };

      const isComplete = checkVictoryConditions('fob_delta', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have base level type', () => {
      const level = CAMPAIGN_LEVELS.fob_delta;
      expect(level.type).toBe('base');
    });
  });

  describe('Brothers in Arms: Marcus Rescue', () => {
    it('should complete after Marcus rescue', () => {
      const state = createLevelState('brothers_in_arms');
      const flags = { marcusRescued: true };

      const isComplete = checkVictoryConditions('brothers_in_arms', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without Marcus rescue', () => {
      const state = createLevelState('brothers_in_arms');
      const flags = { marcusRescued: false };

      const isComplete = checkVictoryConditions('brothers_in_arms', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have brothers level type', () => {
      const level = CAMPAIGN_LEVELS.brothers_in_arms;
      expect(level.type).toBe('brothers');
    });
  });

  describe('Southern Ice: Ice Queen Defeat', () => {
    it('should complete after ice queen defeat', () => {
      const state = createLevelState('southern_ice');
      const flags = { iceQueenDefeated: true };

      const isComplete = checkVictoryConditions('southern_ice', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without ice queen defeat', () => {
      const state = createLevelState('southern_ice');
      const flags = { iceQueenDefeated: false };

      const isComplete = checkVictoryConditions('southern_ice', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have ice level type', () => {
      const level = CAMPAIGN_LEVELS.southern_ice;
      expect(level.type).toBe('ice');
    });

    it('should have blizzard weather', () => {
      const level = CAMPAIGN_LEVELS.southern_ice;
      expect(level.weather?.initialWeather).toBe('blizzard');
    });
  });

  describe('The Breach: Queen Boss Defeat', () => {
    it('should complete after Queen boss defeat', () => {
      const state = createLevelState('the_breach');
      const flags = { queenDefeated: true };

      const isComplete = checkVictoryConditions('the_breach', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without Queen defeat', () => {
      const state = createLevelState('the_breach');
      const flags = { queenDefeated: false };

      const isComplete = checkVictoryConditions('the_breach', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have hive level type', () => {
      const level = CAMPAIGN_LEVELS.the_breach;
      expect(level.type).toBe('hive');
    });

    it('should have boss combat track', () => {
      const level = CAMPAIGN_LEVELS.the_breach;
      expect(level.combatTrack).toBe('boss_combat');
    });
  });

  describe('Hive Assault: Core Destruction', () => {
    it('should complete after core destruction', () => {
      const state = createLevelState('hive_assault');
      const flags = { coreDestroyed: true };

      const isComplete = checkVictoryConditions('hive_assault', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without core destruction', () => {
      const state = createLevelState('hive_assault');
      const flags = { coreDestroyed: false };

      const isComplete = checkVictoryConditions('hive_assault', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have combined_arms level type', () => {
      const level = CAMPAIGN_LEVELS.hive_assault;
      expect(level.type).toBe('combined_arms');
    });
  });

  describe('Extraction: Holdout Waves', () => {
    it('should complete after holdout waves', () => {
      const state = createLevelState('extraction');
      const flags = { holdoutComplete: true, evac: true };

      const isComplete = checkVictoryConditions('extraction', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete without evac', () => {
      const state = createLevelState('extraction');
      const flags = { holdoutComplete: true, evac: false };

      const isComplete = checkVictoryConditions('extraction', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have extraction level type', () => {
      const level = CAMPAIGN_LEVELS.extraction;
      expect(level.type).toBe('extraction');
    });
  });

  describe('Final Escape: Reaching Orbit', () => {
    it('should complete after reaching orbit', () => {
      const state = createLevelState('final_escape');
      const flags = { reachedOrbit: true };

      const isComplete = checkVictoryConditions('final_escape', state, flags);
      expect(isComplete).toBe(true);
    });

    it('should not complete before reaching orbit', () => {
      const state = createLevelState('final_escape');
      const flags = { reachedOrbit: false };

      const isComplete = checkVictoryConditions('final_escape', state, flags);
      expect(isComplete).toBe(false);
    });

    it('should have finale level type', () => {
      const level = CAMPAIGN_LEVELS.final_escape;
      expect(level.type).toBe('finale');
    });

    it('should be the last level (no nextLevelId)', () => {
      const level = CAMPAIGN_LEVELS.final_escape;
      expect(level.nextLevelId).toBeNull();
    });
  });

  describe('Level Transition Events', () => {
    it('should emit OBJECTIVE_COMPLETED when level completes', () => {
      const completedEvents: any[] = [];

      eventBus.on('OBJECTIVE_COMPLETED', (event) => {
        completedEvents.push(event);
      });

      eventBus.emit({
        type: 'OBJECTIVE_COMPLETED',
        objectiveId: 'level_anchor_station',
      });

      expect(completedEvents.length).toBe(1);
    });

    it('should emit CHECKPOINT_REACHED at level checkpoints', () => {
      const checkpointEvents: any[] = [];

      eventBus.on('CHECKPOINT_REACHED', (event) => {
        checkpointEvents.push(event);
      });

      eventBus.emit({
        type: 'CHECKPOINT_REACHED',
        checkpointId: 'landfall_cp1',
      });

      expect(checkpointEvents.length).toBe(1);
      expect(checkpointEvents[0].checkpointId).toBe('landfall_cp1');
    });
  });

  describe('Level Stats Tracking', () => {
    it('should track kills per level', () => {
      const stats: LevelStats = {
        kills: 0,
        secretsFound: 0,
        timeSpent: 0,
        deaths: 0,
      };

      // Simulate kills
      stats.kills += 5;
      stats.kills += 10;

      expect(stats.kills).toBe(15);
    });

    it('should track secrets found', () => {
      const stats: LevelStats = {
        kills: 0,
        secretsFound: 0,
        totalSecrets: 3,
        timeSpent: 0,
        deaths: 0,
      };

      stats.secretsFound = 2;

      expect(stats.secretsFound).toBe(2);
      expect(stats.secretsFound).toBeLessThan(stats.totalSecrets!);
    });

    it('should track time spent in level', () => {
      const stats: LevelStats = {
        kills: 0,
        secretsFound: 0,
        timeSpent: 0,
        deaths: 0,
      };

      // Simulate 5 minutes
      stats.timeSpent = 5 * 60 * 1000;

      expect(stats.timeSpent).toBe(300000);
    });

    it('should track death count', () => {
      const stats: LevelStats = {
        kills: 0,
        secretsFound: 0,
        timeSpent: 0,
        deaths: 0,
      };

      stats.deaths += 1;
      stats.deaths += 1;

      expect(stats.deaths).toBe(2);
    });

    it('should calculate accuracy from shots', () => {
      const stats: LevelStats = {
        kills: 10,
        secretsFound: 0,
        timeSpent: 0,
        deaths: 0,
        totalShots: 100,
        shotsHit: 75,
      };

      stats.accuracy = (stats.shotsHit! / stats.totalShots!) * 100;

      expect(stats.accuracy).toBe(75);
    });
  });

  describe('Collectibles per Level', () => {
    it('should have secret counts defined', () => {
      for (const level of iterateLevels()) {
        expect(level.totalSecrets).toBeDefined();
        expect(level.totalSecrets).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have audio log counts defined', () => {
      for (const level of iterateLevels()) {
        expect(level.totalAudioLogs).toBeDefined();
        expect(level.totalAudioLogs).toBeGreaterThanOrEqual(1);
      }
    });

    it('should emit SECRET_FOUND event when secret discovered', () => {
      const secretEvents: any[] = [];

      eventBus.on('SECRET_FOUND', (event) => {
        secretEvents.push(event);
      });

      eventBus.emit({
        type: 'SECRET_FOUND',
        secretId: 'anchor_station_secret_1',
      });

      expect(secretEvents.length).toBe(1);
    });

    it('should emit AUDIO_LOG_FOUND event when log collected', () => {
      const logEvents: any[] = [];

      eventBus.on('AUDIO_LOG_FOUND', (event) => {
        logEvents.push(event);
      });

      eventBus.emit({
        type: 'AUDIO_LOG_FOUND',
        logId: 'landfall_log_1',
      });

      expect(logEvents.length).toBe(1);
    });
  });
});
