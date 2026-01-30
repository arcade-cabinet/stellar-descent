/**
 * Audio Log Persistence Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDiscoveredAudioLog,
  deleteAllAudioLogSaves,
  getCollectionProgress,
  getCurrentSaveId,
  getDiscoveredAudioLogIds,
  getDiscoveredLogsByLevel,
  getUnplayedAudioLogs,
  isAudioLogDiscovered,
  loadAudioLogCollection,
  markAudioLogPlayed,
  resetAudioLogCollection,
  setCurrentSaveId,
} from './audioLogPersistence';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

// Replace global localStorage
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Audio Log Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentSaveId('test_save');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadAudioLogCollection', () => {
    it('should return empty collection for new save', () => {
      const state = loadAudioLogCollection('new_save');
      expect(state.discoveries).toEqual([]);
      expect(state.saveId).toBe('new_save');
    });

    it('should load existing collection', () => {
      // Add a discovery first
      addDiscoveredAudioLog('station_01', 'anchor_station', 'test_save');

      const state = loadAudioLogCollection('test_save');
      expect(state.discoveries.length).toBe(1);
      expect(state.discoveries[0].logId).toBe('station_01');
    });
  });

  describe('addDiscoveredAudioLog', () => {
    it('should add a new discovery', () => {
      const state = addDiscoveredAudioLog('station_01', 'anchor_station');
      expect(state.discoveries.length).toBe(1);
      expect(state.discoveries[0].logId).toBe('station_01');
      expect(state.discoveries[0].levelId).toBe('anchor_station');
      expect(state.discoveries[0].hasBeenPlayed).toBe(false);
    });

    it('should not add duplicate discoveries', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      const state = addDiscoveredAudioLog('station_01', 'anchor_station');
      expect(state.discoveries.length).toBe(1);
    });

    it('should add multiple different discoveries', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      const state = addDiscoveredAudioLog('station_02', 'anchor_station');
      expect(state.discoveries.length).toBe(2);
    });
  });

  describe('markAudioLogPlayed', () => {
    it('should mark a log as played', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      markAudioLogPlayed('station_01');

      const state = loadAudioLogCollection();
      expect(state.discoveries[0].hasBeenPlayed).toBe(true);
    });

    it('should not affect non-existent logs', () => {
      markAudioLogPlayed('nonexistent');
      const state = loadAudioLogCollection();
      expect(state.discoveries.length).toBe(0);
    });
  });

  describe('isAudioLogDiscovered', () => {
    it('should return true for discovered logs', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      expect(isAudioLogDiscovered('station_01')).toBe(true);
    });

    it('should return false for undiscovered logs', () => {
      expect(isAudioLogDiscovered('station_01')).toBe(false);
    });
  });

  describe('getDiscoveredAudioLogIds', () => {
    it('should return array of discovered log IDs', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      addDiscoveredAudioLog('station_02', 'anchor_station');

      const ids = getDiscoveredAudioLogIds();
      expect(ids).toContain('station_01');
      expect(ids).toContain('station_02');
      expect(ids.length).toBe(2);
    });
  });

  describe('getDiscoveredLogsByLevel', () => {
    it('should return discoveries for specific level', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      addDiscoveredAudioLog('landfall_01', 'landfall');

      const stationLogs = getDiscoveredLogsByLevel('anchor_station');
      expect(stationLogs.length).toBe(1);
      expect(stationLogs[0].logId).toBe('station_01');
    });
  });

  describe('getCollectionProgress', () => {
    it('should return correct progress stats', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      addDiscoveredAudioLog('station_02', 'anchor_station');
      markAudioLogPlayed('station_01');

      const progress = getCollectionProgress();
      expect(progress.discovered).toBe(2);
      expect(progress.played).toBe(1);
      expect(progress.total).toBe(18); // 3 logs per 6 levels
      expect(progress.percentage).toBe(11); // ~11%
    });

    it('should track per-level progress', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      addDiscoveredAudioLog('station_02', 'anchor_station');

      const progress = getCollectionProgress();
      expect(progress.byLevel.anchor_station.discovered).toBe(2);
      expect(progress.byLevel.anchor_station.total).toBe(3);
    });
  });

  describe('getUnplayedAudioLogs', () => {
    it('should return only unplayed discoveries', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      addDiscoveredAudioLog('station_02', 'anchor_station');
      markAudioLogPlayed('station_01');

      const unplayed = getUnplayedAudioLogs();
      expect(unplayed.length).toBe(1);
      expect(unplayed[0].logId).toBe('station_02');
    });
  });

  describe('resetAudioLogCollection', () => {
    it('should clear all discoveries for a save', () => {
      addDiscoveredAudioLog('station_01', 'anchor_station');
      resetAudioLogCollection();

      const state = loadAudioLogCollection();
      expect(state.discoveries.length).toBe(0);
    });
  });

  describe('getCurrentSaveId / setCurrentSaveId', () => {
    it('should get and set current save ID', () => {
      setCurrentSaveId('my_save');
      expect(getCurrentSaveId()).toBe('my_save');
    });
  });
});
