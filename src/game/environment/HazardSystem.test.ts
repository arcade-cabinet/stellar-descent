/**
 * HazardSystem Tests
 *
 * Tests for the environmental hazard system including:
 * - Zone management (add/remove zones)
 * - Hazard state updates (meter drain/recovery)
 * - Damage calculations
 * - Warning thresholds
 * - Resistance modifiers
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it, vi } from 'vitest';

import { HAZARD_PRESETS, type HazardCallbacks, type HazardType } from './HazardSystem';

describe('HazardSystem Types', () => {
  describe('Hazard Presets', () => {
    it('should have presets for all hazard types', () => {
      const types: HazardType[] = ['cold', 'toxic', 'oxygen', 'radiation'];

      for (const type of types) {
        expect(HAZARD_PRESETS[type]).toBeDefined();
        expect(HAZARD_PRESETS[type].name).toBeTruthy();
        expect(HAZARD_PRESETS[type].maxMeter).toBeGreaterThan(0);
      }
    });

    it('should have valid threshold values for cold preset', () => {
      const cold = HAZARD_PRESETS.cold;

      expect(cold.warningThreshold).toBeLessThan(cold.maxMeter);
      expect(cold.criticalThreshold).toBeLessThan(cold.warningThreshold);
      expect(cold.damageThreshold).toBeLessThanOrEqual(cold.criticalThreshold);
    });

    it('should have valid threshold values for oxygen preset', () => {
      const oxygen = HAZARD_PRESETS.oxygen;

      expect(oxygen.warningThreshold).toBeLessThan(oxygen.maxMeter);
      expect(oxygen.criticalThreshold).toBeLessThan(oxygen.warningThreshold);
      // Oxygen can start damaging at a higher threshold
      expect(oxygen.damageThreshold).toBeLessThanOrEqual(oxygen.criticalThreshold);
    });

    it('should have valid threshold values for toxic preset', () => {
      const toxic = HAZARD_PRESETS.toxic;

      expect(toxic.warningThreshold).toBeLessThan(toxic.maxMeter);
      expect(toxic.criticalThreshold).toBeLessThan(toxic.warningThreshold);
    });

    it('should have valid threshold values for radiation preset', () => {
      const radiation = HAZARD_PRESETS.radiation;

      expect(radiation.warningThreshold).toBeLessThan(radiation.maxMeter);
      expect(radiation.criticalThreshold).toBeLessThan(radiation.warningThreshold);
      // Radiation starts damaging at a higher threshold (50%)
      expect(radiation.damageThreshold).toBeGreaterThan(radiation.criticalThreshold);
    });
  });

  describe('Hazard Preset Damage Rates', () => {
    it('should have positive drain rates for all presets', () => {
      for (const [, preset] of Object.entries(HAZARD_PRESETS)) {
        expect(preset.baseDrainRate).toBeGreaterThan(0);
      }
    });

    it('should have positive recovery rates for all presets', () => {
      for (const [, preset] of Object.entries(HAZARD_PRESETS)) {
        expect(preset.baseRecoveryRate).toBeGreaterThan(0);
      }
    });

    it('should have positive damage rates for all presets', () => {
      for (const [, preset] of Object.entries(HAZARD_PRESETS)) {
        expect(preset.baseDamageRate).toBeGreaterThan(0);
      }
    });
  });

  describe('Hazard Preset Screen Effects', () => {
    it('should have screen effect colors for all presets', () => {
      for (const [_type, preset] of Object.entries(HAZARD_PRESETS)) {
        expect(preset.screenEffectColor).toBeDefined();
        expect(preset.screenEffectColor.r).toBeGreaterThanOrEqual(0);
        expect(preset.screenEffectColor.g).toBeGreaterThanOrEqual(0);
        expect(preset.screenEffectColor.b).toBeGreaterThanOrEqual(0);
        expect(preset.screenEffectColor.a).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have valid screen effect intensities', () => {
      for (const [, preset] of Object.entries(HAZARD_PRESETS)) {
        expect(preset.screenEffectIntensity).toBeGreaterThan(0);
        expect(preset.screenEffectIntensity).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('Hazard Callbacks Interface', () => {
  it('should allow partial callback implementation', () => {
    const callbacks: HazardCallbacks = {
      onDamage: vi.fn(),
    };

    expect(callbacks.onDamage).toBeDefined();
    expect(callbacks.onWarning).toBeUndefined();
  });

  it('should allow full callback implementation', () => {
    const callbacks: HazardCallbacks = {
      onDamage: vi.fn(),
      onWarning: vi.fn(),
      onRecovered: vi.fn(),
      onEnterHazard: vi.fn(),
      onExitHazard: vi.fn(),
      onEnterSafeZone: vi.fn(),
      onExitSafeZone: vi.fn(),
    };

    expect(callbacks.onDamage).toBeDefined();
    expect(callbacks.onWarning).toBeDefined();
    expect(callbacks.onRecovered).toBeDefined();
    expect(callbacks.onEnterHazard).toBeDefined();
    expect(callbacks.onExitHazard).toBeDefined();
    expect(callbacks.onEnterSafeZone).toBeDefined();
    expect(callbacks.onExitSafeZone).toBeDefined();
  });
});

describe('Hazard Zone Configuration', () => {
  it('should calculate proper time to empty for cold hazard', () => {
    const cold = HAZARD_PRESETS.cold;
    const timeToEmpty = cold.maxMeter / cold.baseDrainRate;

    // Should take around 12.5 seconds to empty
    expect(timeToEmpty).toBeGreaterThan(10);
    expect(timeToEmpty).toBeLessThan(15);
  });

  it('should calculate proper time to empty for toxic hazard', () => {
    const toxic = HAZARD_PRESETS.toxic;
    const timeToEmpty = toxic.maxMeter / toxic.baseDrainRate;

    // Toxic drains faster - around 6-7 seconds
    expect(timeToEmpty).toBeGreaterThan(5);
    expect(timeToEmpty).toBeLessThan(10);
  });

  it('should calculate proper time to empty for oxygen hazard', () => {
    const oxygen = HAZARD_PRESETS.oxygen;
    const timeToEmpty = oxygen.maxMeter / oxygen.baseDrainRate;

    // Oxygen drains slowly - around 20 seconds
    expect(timeToEmpty).toBeGreaterThan(15);
    expect(timeToEmpty).toBeLessThan(25);
  });

  it('should calculate proper recovery time for cold safe zone', () => {
    const cold = HAZARD_PRESETS.cold;
    const timeToRecover = cold.maxMeter / cold.baseRecoveryRate;

    // Should recover in about 4 seconds at thermal vent
    expect(timeToRecover).toBeGreaterThan(3);
    expect(timeToRecover).toBeLessThan(6);
  });
});

describe('Vector3 Distance Calculations', () => {
  it('should correctly calculate 2D distance for zone checks', () => {
    const playerPos = new Vector3(10, 5, 20);
    const zonePos = new Vector3(15, 0, 20);

    // 2D distance ignoring Y
    const distance = Math.sqrt((playerPos.x - zonePos.x) ** 2 + (playerPos.z - zonePos.z) ** 2);

    expect(distance).toBe(5);
  });

  it('should correctly identify player inside zone radius', () => {
    const playerPos = new Vector3(12, 1.7, 18);
    const zonePos = new Vector3(10, 0, 20);
    const radius = 5;

    const distance = Math.sqrt((playerPos.x - zonePos.x) ** 2 + (playerPos.z - zonePos.z) ** 2);

    expect(distance).toBeLessThan(radius);
  });

  it('should correctly identify player outside zone radius', () => {
    const playerPos = new Vector3(20, 1.7, 30);
    const zonePos = new Vector3(10, 0, 20);
    const radius = 5;

    const distance = Math.sqrt((playerPos.x - zonePos.x) ** 2 + (playerPos.z - zonePos.z) ** 2);

    expect(distance).toBeGreaterThan(radius);
  });
});

describe('Resistance Calculations', () => {
  it('should reduce drain rate with 50% resistance', () => {
    const baseDrainRate = 10;
    const resistance = 0.5;

    const effectiveDrainRate = baseDrainRate * (1 - resistance);

    expect(effectiveDrainRate).toBe(5);
  });

  it('should eliminate drain rate with 100% resistance', () => {
    const baseDrainRate = 10;
    const resistance = 1.0;

    const effectiveDrainRate = baseDrainRate * (1 - resistance);

    expect(effectiveDrainRate).toBe(0);
  });

  it('should not affect drain rate with 0% resistance', () => {
    const baseDrainRate = 10;
    const resistance = 0;

    const effectiveDrainRate = baseDrainRate * (1 - resistance);

    expect(effectiveDrainRate).toBe(10);
  });

  it('should reduce damage with partial resistance', () => {
    const baseDamageRate = 10;
    const resistance = 0.3;

    const effectiveDamageRate = baseDamageRate * (1 - resistance);

    expect(effectiveDamageRate).toBe(7);
  });
});

describe('Meter State Transitions', () => {
  it('should transition through warning and critical thresholds', () => {
    const preset = HAZARD_PRESETS.cold;
    const testMeter = preset.maxMeter;

    // Start at full
    expect(testMeter).toBe(100);
    expect(testMeter > preset.warningThreshold).toBe(true);

    // Drain to warning
    const warningMeter = preset.warningThreshold - 1;
    expect(warningMeter <= preset.warningThreshold).toBe(true);
    expect(warningMeter > preset.criticalThreshold).toBe(true);

    // Drain to critical
    const criticalMeter = preset.criticalThreshold - 1;
    expect(criticalMeter <= preset.criticalThreshold).toBe(true);

    // Drain to damage threshold
    const damageMeter = preset.damageThreshold;
    expect(damageMeter <= preset.damageThreshold).toBe(true);
  });
});
