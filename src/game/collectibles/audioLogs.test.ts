/**
 * Audio Logs Tests
 */

import { describe, expect, it } from 'vitest';
import {
  AUDIO_LOGS,
  getAudioLogById,
  getAudioLogCountByLevel,
  getAudioLogsByLevel,
  getTotalAudioLogCount,
  SPEAKERS,
} from './audioLogs';

describe('Audio Logs Data', () => {
  it('should have audio logs defined', () => {
    expect(AUDIO_LOGS.length).toBeGreaterThan(0);
  });

  it('should have at least 15 total audio logs (minimum for story)', () => {
    // 15 logs is the minimum (about 2-3 per level), actual count is 18
    expect(getTotalAudioLogCount()).toBeGreaterThanOrEqual(15);
    expect(getTotalAudioLogCount()).toBe(18);
  });

  it('should have speakers defined', () => {
    expect(Object.keys(SPEAKERS).length).toBeGreaterThan(0);
    expect(SPEAKERS.vasquez).toBeDefined();
    expect(SPEAKERS.marcus).toBeDefined();
  });

  it('should have required fields for each audio log', () => {
    for (const log of AUDIO_LOGS) {
      expect(log.id).toBeTruthy();
      expect(log.title).toBeTruthy();
      expect(log.speaker).toBeDefined();
      expect(log.speaker.name).toBeTruthy();
      expect(log.levelId).toBeTruthy();
      expect(log.transcript).toBeTruthy();
      expect(log.duration).toBeGreaterThan(0);
      expect(log.recordingDate).toBeTruthy();
      expect(['personal', 'military', 'research', 'emergency']).toContain(log.category);
    }
  });

  it('should have unique IDs for all logs', () => {
    const ids = AUDIO_LOGS.map((log) => log.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('getAudioLogsByLevel', () => {
  it('should return logs for anchor_station', () => {
    const logs = getAudioLogsByLevel('anchor_station');
    expect(logs.length).toBe(3);
    expect(logs.every((log) => log.levelId === 'anchor_station')).toBe(true);
  });

  it('should return logs for landfall', () => {
    const logs = getAudioLogsByLevel('landfall');
    expect(logs.length).toBe(3);
  });

  it('should return logs for fob_delta', () => {
    const logs = getAudioLogsByLevel('fob_delta');
    expect(logs.length).toBe(3);
  });

  it('should return logs for brothers_in_arms', () => {
    const logs = getAudioLogsByLevel('brothers_in_arms');
    expect(logs.length).toBe(3);
  });

  it('should return logs for the_breach', () => {
    const logs = getAudioLogsByLevel('the_breach');
    expect(logs.length).toBe(3);
  });

  it('should return logs for extraction', () => {
    const logs = getAudioLogsByLevel('extraction');
    expect(logs.length).toBe(3);
  });
});

describe('getAudioLogById', () => {
  it('should find a log by ID', () => {
    const log = getAudioLogById('station_01');
    expect(log).toBeDefined();
    expect(log?.title).toBe('Mission Briefing Supplement');
  });

  it('should return undefined for non-existent ID', () => {
    const log = getAudioLogById('nonexistent_id');
    expect(log).toBeUndefined();
  });
});

describe('getAudioLogCountByLevel', () => {
  it('should return correct counts per level', () => {
    const counts = getAudioLogCountByLevel();
    expect(counts.anchor_station).toBe(3);
    expect(counts.landfall).toBe(3);
    expect(counts.fob_delta).toBe(3);
    expect(counts.brothers_in_arms).toBe(3);
    expect(counts.the_breach).toBe(3);
    expect(counts.extraction).toBe(3);
  });
});
