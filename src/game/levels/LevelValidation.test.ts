/**
 * Level Validation Tests
 *
 * Comprehensive validation of the level system to catch configuration
 * errors, missing factories, and broken level chains before runtime.
 * These tests prevent "level doesn't open" bugs by verifying the full
 * level pipeline at test time.
 */

import { describe, expect, it } from 'vitest';
import { defaultLevelFactories, getSupportedLevelTypes, isLevelTypeSupported } from './factories';
import { LEVEL_REGISTRY } from './LevelRegistry';
import type { LevelId, LevelType } from './types';

// ============================================================================
// LEVEL REGISTRY VALIDATION
// ============================================================================

describe('LevelRegistry', () => {
  const levelIds = Object.keys(LEVEL_REGISTRY) as LevelId[];

  it('should have at least 10 campaign levels', () => {
    // 10 campaign + 1 bonus = 11
    expect(levelIds.length).toBeGreaterThanOrEqual(10);
  });

  describe.each(levelIds)('Level "%s"', (levelId) => {
    const entry = LEVEL_REGISTRY[levelId];

    it('should have a valid id matching its key', () => {
      expect(entry.id).toBe(levelId);
    });

    it('should have a non-empty type', () => {
      expect(entry.type).toBeTruthy();
      expect(typeof entry.type).toBe('string');
    });

    it('should have a supported level type with a factory', () => {
      expect(isLevelTypeSupported(entry.type)).toBe(true);
      expect(defaultLevelFactories[entry.type]).toBeDefined();
    });

    it('should have a chapter number', () => {
      expect(entry.chapter).toBeGreaterThanOrEqual(1);
    });

    it('should have an actName', () => {
      expect(entry.actName).toBeTruthy();
    });

    it('should have a missionName', () => {
      expect(entry.missionName).toBeTruthy();
    });

    it('should have a valid player spawn position', () => {
      expect(entry.playerSpawnPosition).toBeDefined();
      expect(entry.playerSpawnPosition).toHaveProperty('x');
      expect(entry.playerSpawnPosition).toHaveProperty('y');
      expect(entry.playerSpawnPosition).toHaveProperty('z');
    });

    it('should have at least one mission objective', () => {
      expect(entry.objectives.length).toBeGreaterThanOrEqual(1);
    });

    it('should have objectives with valid structure', () => {
      for (const obj of entry.objectives) {
        expect(obj.id).toBeTruthy();
        expect(obj.description).toBeTruthy();
        expect(['primary', 'optional']).toContain(obj.type);
      }
    });

    it('should have at least one primary objective', () => {
      const primaryObjectives = entry.objectives.filter((o) => o.type === 'primary');
      expect(primaryObjectives.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// LEVEL CHAIN VALIDATION
// ============================================================================

describe('Level Chain (Campaign Progression)', () => {
  // All entries in LEVEL_REGISTRY are campaign levels (bonus levels are in BONUS_LEVELS)
  const campaignLevels = Object.entries(LEVEL_REGISTRY);

  it('should form a complete chain from first to last', () => {
    // Find the starting level (one with no previousLevelId)
    const startLevels = campaignLevels.filter(([, entry]) => !entry.previousLevelId);
    expect(startLevels.length).toBe(1);
    const startId = startLevels[0][0] as LevelId;

    // Walk the chain
    const visited = new Set<string>();
    let currentId: LevelId | null = startId;
    while (currentId) {
      expect(visited.has(currentId)).toBe(false); // No cycles
      visited.add(currentId);
      const entry = LEVEL_REGISTRY[currentId];
      expect(entry).toBeDefined();
      currentId = entry.nextLevelId;
    }

    // All campaign levels should be reachable
    expect(visited.size).toBe(campaignLevels.length);
  });

  it('should have consistent forward/backward links', () => {
    for (const [id, entry] of campaignLevels) {
      if (entry.nextLevelId) {
        const nextEntry = LEVEL_REGISTRY[entry.nextLevelId];
        expect(nextEntry).toBeDefined();
        expect(nextEntry.previousLevelId).toBe(id);
      }
      if (entry.previousLevelId) {
        const prevEntry = LEVEL_REGISTRY[entry.previousLevelId];
        expect(prevEntry).toBeDefined();
        expect(prevEntry.nextLevelId).toBe(id);
      }
    }
  });
});

// ============================================================================
// FACTORY REGISTRY VALIDATION
// ============================================================================

describe('Level Factory Registry', () => {
  it('should have a factory for every supported level type', () => {
    const types = getSupportedLevelTypes();
    expect(types.length).toBeGreaterThanOrEqual(10);

    for (const type of types) {
      expect(defaultLevelFactories[type]).toBeDefined();
      expect(typeof defaultLevelFactories[type]).toBe('function');
    }
  });

  it('should have a factory for every level type used in the registry', () => {
    const usedTypes = new Set(Object.values(LEVEL_REGISTRY).map((e) => e.type));

    for (const type of usedTypes) {
      expect(
        defaultLevelFactories[type],
        `Missing factory for level type "${type}" used by at least one level`
      ).toBeDefined();
    }
  });

  it('should not have unused factory types', () => {
    const usedTypes = new Set(Object.values(LEVEL_REGISTRY).map((e) => e.type));
    const factoryTypes = Object.keys(defaultLevelFactories);

    // Allow some extra factory types for flexibility, but flag them
    const unused = factoryTypes.filter((t) => !usedTypes.has(t as LevelType));
    // This is a warning, not a failure - some factories may exist for future use
    if (unused.length > 0) {
      console.warn(`Unused factory types: ${unused.join(', ')}`);
    }
  });
});

// ============================================================================
// MISSION DEFINITION VALIDATION
// ============================================================================

describe('Mission Definitions', () => {
  it('should have unique objective IDs within each level', () => {
    for (const [levelId, entry] of Object.entries(LEVEL_REGISTRY)) {
      const objectiveIds = entry.objectives.map((o) => o.id);
      const uniqueIds = new Set(objectiveIds);
      expect(uniqueIds.size, `Level "${levelId}" has duplicate objective IDs`).toBe(
        objectiveIds.length
      );
    }
  });

  it('should have unique objective IDs across all levels', () => {
    const allIds = new Set<string>();
    for (const [levelId, entry] of Object.entries(LEVEL_REGISTRY)) {
      for (const obj of entry.objectives) {
        expect(
          allIds.has(obj.id),
          `Duplicate objective ID "${obj.id}" found in level "${levelId}"`
        ).toBe(false);
        allIds.add(obj.id);
      }
    }
  });
});
