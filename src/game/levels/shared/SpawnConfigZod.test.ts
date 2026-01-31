/**
 * SpawnConfigZod.test.ts - Unit tests for Zod-based spawn configuration
 */

import { describe, expect, it } from 'vitest';

import {
  validateSpawnConfig,
  safeValidateSpawnConfig,
  validateSpawnConfigFull,
  validateSpawnPointReferences,
  validateWaveChain,
  degreesToRadians,
  parsePositionString,
  parseTriggerValue,
  type LevelSpawnConfig,
  LevelSpawnConfigSchema,
  SpawnUnitSchema,
  SpawnWaveSchema,
} from './SpawnConfigZod';

describe('SpawnConfigZod', () => {
  // Valid test config
  const validConfig: LevelSpawnConfig = {
    levelId: 'test_level',
    spawnPoints: {
      spawn_north: { position: [0, 0, 50], rotation: 0 },
      spawn_south: { position: [0, 0, -50], rotation: 180 },
    },
    waves: [
      {
        id: 'wave_1',
        label: 'First Wave',
        trigger: 'immediate',
        units: [
          { species: 'drone', count: 3, spawnPoint: 'spawn_north', delay: 0, spread: 5 },
        ],
        onComplete: 'wave_2',
        spawnInterval: 1.0,
      },
      {
        id: 'wave_2',
        label: 'Second Wave',
        trigger: 'manual',
        units: [
          { species: 'soldier', count: 2, spawnPoint: 'spawn_south', delay: 0, spread: 3 },
        ],
        onComplete: 'victory',
        spawnInterval: 1.5,
      },
    ],
    maxGlobalEnemies: 10,
    defaultSpawnInterval: 1.0,
  };

  describe('Schema Validation', () => {
    it('should validate a correct config', () => {
      const result = safeValidateSpawnConfig(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject missing levelId', () => {
      const invalid = { ...validConfig, levelId: undefined };
      const result = safeValidateSpawnConfig(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid species', () => {
      const invalid = {
        ...validConfig,
        waves: [
          {
            ...validConfig.waves[0],
            units: [{ species: 'invalid_species', count: 1, spawnPoint: 'spawn_north' }],
          },
        ],
      };
      const result = safeValidateSpawnConfig(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative count', () => {
      const invalid = {
        ...validConfig,
        waves: [
          {
            ...validConfig.waves[0],
            units: [{ species: 'drone', count: -1, spawnPoint: 'spawn_north' }],
          },
        ],
      };
      const result = safeValidateSpawnConfig(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject zero count', () => {
      const invalid = {
        ...validConfig,
        waves: [
          {
            ...validConfig.waves[0],
            units: [{ species: 'drone', count: 0, spawnPoint: 'spawn_north' }],
          },
        ],
      };
      const result = safeValidateSpawnConfig(invalid);
      expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
      const minimal = {
        levelId: 'minimal',
        spawnPoints: {
          sp1: { position: [0, 0, 0] },
        },
        waves: [
          {
            id: 'w1',
            trigger: 'immediate',
            units: [{ species: 'drone', count: 1, spawnPoint: 'sp1' }],
          },
        ],
      };
      const result = safeValidateSpawnConfig(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxGlobalEnemies).toBe(40);
        expect(result.data.defaultSpawnInterval).toBe(1.0);
        expect(result.data.spawnPoints.sp1.rotation).toBe(0);
        expect(result.data.waves[0].units[0].delay).toBe(0);
        expect(result.data.waves[0].units[0].spread).toBe(5);
      }
    });
  });

  describe('SpawnUnit Schema', () => {
    it('should validate all valid species', () => {
      const species = [
        'drone', 'soldier', 'warrior', 'spitter', 'ice_drone', 'ice_warrior',
        'skitterer', 'lurker', 'spewer', 'husk', 'heavy', 'stalker', 'broodmother', 'queen',
      ];

      for (const sp of species) {
        const unit = { species: sp, count: 1, spawnPoint: 'test' };
        const result = SpawnUnitSchema.safeParse(unit);
        expect(result.success, `Species ${sp} should be valid`).toBe(true);
      }
    });

    it('should validate overrides', () => {
      const unit = {
        species: 'drone',
        count: 5,
        spawnPoint: 'test',
        overrides: {
          healthMultiplier: 1.5,
          damageMultiplier: 2.0,
          speedMultiplier: 0.8,
          scale: 1.2,
        },
      };
      const result = SpawnUnitSchema.safeParse(unit);
      expect(result.success).toBe(true);
    });
  });

  describe('SpawnWave Schema', () => {
    it('should validate all trigger types', () => {
      const triggers = ['immediate', 'objective', 'timer', 'proximity', 'manual'];

      for (const trigger of triggers) {
        const wave = {
          id: `wave_${trigger}`,
          trigger,
          units: [{ species: 'drone', count: 1, spawnPoint: 'test' }],
        };
        const result = SpawnWaveSchema.safeParse(wave);
        expect(result.success, `Trigger ${trigger} should be valid`).toBe(true);
      }
    });

    it('should validate triggerValue for objective trigger', () => {
      const wave = {
        id: 'wave_obj',
        trigger: 'objective',
        triggerValue: 'reach_checkpoint',
        units: [{ species: 'drone', count: 1, spawnPoint: 'test' }],
      };
      const result = SpawnWaveSchema.safeParse(wave);
      expect(result.success).toBe(true);
    });

    it('should validate triggerPosition for proximity trigger', () => {
      const wave = {
        id: 'wave_prox',
        trigger: 'proximity',
        triggerValue: '30',
        triggerPosition: '10,0,20',
        units: [{ species: 'drone', count: 1, spawnPoint: 'test' }],
      };
      const result = SpawnWaveSchema.safeParse(wave);
      expect(result.success).toBe(true);
    });
  });

  describe('Reference Validation', () => {
    it('should detect invalid spawn point references', () => {
      const config: LevelSpawnConfig = {
        ...validConfig,
        waves: [
          {
            id: 'wave_bad',
            trigger: 'immediate',
            spawnInterval: 1,
            units: [
              { species: 'drone', count: 1, spawnPoint: 'nonexistent_point', delay: 0, spread: 5 },
            ],
          },
        ],
      };

      const errors = validateSpawnPointReferences(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('nonexistent_point');
    });

    it('should pass with valid spawn point references', () => {
      const errors = validateSpawnPointReferences(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid onComplete references', () => {
      const config: LevelSpawnConfig = {
        ...validConfig,
        waves: [
          {
            id: 'wave_bad_chain',
            trigger: 'immediate',
            spawnInterval: 1,
            units: [{ species: 'drone', count: 1, spawnPoint: 'spawn_north', delay: 0, spread: 5 }],
            onComplete: 'nonexistent_wave',
          },
        ],
      };

      const errors = validateWaveChain(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('nonexistent_wave');
    });

    it('should allow victory as onComplete target', () => {
      const config: LevelSpawnConfig = {
        ...validConfig,
        waves: [
          {
            id: 'final_wave',
            trigger: 'immediate',
            spawnInterval: 1,
            units: [{ species: 'drone', count: 1, spawnPoint: 'spawn_north', delay: 0, spread: 5 }],
            onComplete: 'victory',
          },
        ],
      };

      const errors = validateWaveChain(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Full Validation', () => {
    it('should return isValid true for valid config', () => {
      const result = validateSpawnConfigFull(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.config).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it('should return schema errors for invalid config', () => {
      const invalid = { levelId: 123 }; // Wrong type
      const result = validateSpawnConfigFull(invalid);
      expect(result.isValid).toBe(false);
      expect(result.config).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return reference errors for valid schema but invalid refs', () => {
      const config = {
        ...validConfig,
        waves: [
          {
            id: 'bad_wave',
            trigger: 'immediate',
            units: [{ species: 'drone', count: 1, spawnPoint: 'bad_point' }],
            onComplete: 'bad_target',
          },
        ],
      };

      const result = validateSpawnConfigFull(config);
      expect(result.isValid).toBe(false);
      expect(result.config).not.toBeNull(); // Schema is valid
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Helper Functions', () => {
    describe('degreesToRadians', () => {
      it('should convert 0 degrees', () => {
        expect(degreesToRadians(0)).toBe(0);
      });

      it('should convert 180 degrees', () => {
        expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
      });

      it('should convert 90 degrees', () => {
        expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
      });

      it('should convert 360 degrees', () => {
        expect(degreesToRadians(360)).toBeCloseTo(Math.PI * 2);
      });
    });

    describe('parsePositionString', () => {
      it('should parse valid position string', () => {
        const result = parsePositionString('10,20,30');
        expect(result).toEqual([10, 20, 30]);
      });

      it('should parse negative values', () => {
        const result = parsePositionString('-10, -20, -30');
        expect(result).toEqual([-10, -20, -30]);
      });

      it('should parse decimals', () => {
        const result = parsePositionString('1.5, 2.5, 3.5');
        expect(result).toEqual([1.5, 2.5, 3.5]);
      });

      it('should return null for invalid string', () => {
        expect(parsePositionString('invalid')).toBeNull();
        expect(parsePositionString('1,2')).toBeNull();
        expect(parsePositionString('')).toBeNull();
      });
    });

    describe('parseTriggerValue', () => {
      it('should parse timer trigger', () => {
        const result = parseTriggerValue('timer', '30');
        expect(result.delay).toBe(30);
      });

      it('should parse objective trigger', () => {
        const result = parseTriggerValue('objective', 'reach_door');
        expect(result.objectiveFlag).toBe('reach_door');
      });

      it('should parse proximity trigger', () => {
        const result = parseTriggerValue('proximity', '25', '10,0,20');
        expect(result.proximityRadius).toBe(25);
        expect(result.proximityCenter).toEqual({ x: 10, y: 0, z: 20 });
      });

      it('should return empty object for immediate trigger', () => {
        const result = parseTriggerValue('immediate');
        expect(result).toEqual({});
      });

      it('should return empty object for manual trigger', () => {
        const result = parseTriggerValue('manual');
        expect(result).toEqual({});
      });
    });
  });

  describe('validateSpawnConfig (throwing)', () => {
    it('should return parsed config for valid input', () => {
      const result = validateSpawnConfig(validConfig);
      expect(result.levelId).toBe('test_level');
    });

    it('should throw for invalid input', () => {
      expect(() => validateSpawnConfig({ invalid: true })).toThrow();
    });
  });
});
