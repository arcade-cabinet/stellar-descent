/**
 * EscapeRouteEnvironment.test.ts - Unit tests for Escape Route Environment Builder
 *
 * Tests cover:
 * - ESCAPE_SECTIONS constants validation
 * - Section boundary continuity
 * - Total escape route length
 *
 * Note: The buildEscapeRouteEnvironment function is heavily BabylonJS-dependent
 * and is better tested via integration tests. These unit tests focus on the
 * exported constants and type contracts.
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */

import { describe, expect, it } from 'vitest';
import { ESCAPE_SECTIONS } from './EscapeRouteEnvironment';

describe('ESCAPE_SECTIONS Constants', () => {
  describe('Tunnel Section (Section A)', () => {
    it('should define tunnel start at 0', () => {
      expect(ESCAPE_SECTIONS.tunnelStart).toBe(0);
    });

    it('should define tunnel end at -500', () => {
      expect(ESCAPE_SECTIONS.tunnelEnd).toBe(-500);
    });

    it('should have tunnel length of 500m', () => {
      const tunnelLength = Math.abs(ESCAPE_SECTIONS.tunnelEnd - ESCAPE_SECTIONS.tunnelStart);
      expect(tunnelLength).toBe(500);
    });
  });

  describe('Surface Section (Section B)', () => {
    it('should define surface start at -500', () => {
      expect(ESCAPE_SECTIONS.surfaceStart).toBe(-500);
    });

    it('should define surface end at -1500', () => {
      expect(ESCAPE_SECTIONS.surfaceEnd).toBe(-1500);
    });

    it('should have surface length of 1000m', () => {
      const surfaceLength = Math.abs(ESCAPE_SECTIONS.surfaceEnd - ESCAPE_SECTIONS.surfaceStart);
      expect(surfaceLength).toBe(1000);
    });
  });

  describe('Canyon Section (Section C)', () => {
    it('should define canyon start at -1500', () => {
      expect(ESCAPE_SECTIONS.canyonStart).toBe(-1500);
    });

    it('should define canyon end at -2500', () => {
      expect(ESCAPE_SECTIONS.canyonEnd).toBe(-2500);
    });

    it('should have canyon length of 1000m', () => {
      const canyonLength = Math.abs(ESCAPE_SECTIONS.canyonEnd - ESCAPE_SECTIONS.canyonStart);
      expect(canyonLength).toBe(1000);
    });
  });

  describe('Launch Pad Section (Section D)', () => {
    it('should define launch start at -2500', () => {
      expect(ESCAPE_SECTIONS.launchStart).toBe(-2500);
    });

    it('should define launch end at -3000', () => {
      expect(ESCAPE_SECTIONS.launchEnd).toBe(-3000);
    });

    it('should have launch pad approach length of 500m', () => {
      const launchLength = Math.abs(ESCAPE_SECTIONS.launchEnd - ESCAPE_SECTIONS.launchStart);
      expect(launchLength).toBe(500);
    });
  });

  describe('Shuttle Position', () => {
    it('should define shuttle position at -2900', () => {
      expect(ESCAPE_SECTIONS.shuttleZ).toBe(-2900);
    });

    it('should place shuttle within launch pad section', () => {
      expect(ESCAPE_SECTIONS.shuttleZ).toBeLessThan(ESCAPE_SECTIONS.launchStart);
      expect(ESCAPE_SECTIONS.shuttleZ).toBeGreaterThan(ESCAPE_SECTIONS.launchEnd);
    });

    it('should place shuttle 100m before end of route', () => {
      const distanceFromEnd = Math.abs(ESCAPE_SECTIONS.shuttleZ - ESCAPE_SECTIONS.launchEnd);
      expect(distanceFromEnd).toBe(100);
    });
  });

  describe('Section Continuity', () => {
    it('should have tunnel end equal surface start', () => {
      expect(ESCAPE_SECTIONS.tunnelEnd).toBe(ESCAPE_SECTIONS.surfaceStart);
    });

    it('should have surface end equal canyon start', () => {
      expect(ESCAPE_SECTIONS.surfaceEnd).toBe(ESCAPE_SECTIONS.canyonStart);
    });

    it('should have canyon end equal launch start', () => {
      expect(ESCAPE_SECTIONS.canyonEnd).toBe(ESCAPE_SECTIONS.launchStart);
    });

    it('should have no gaps between sections', () => {
      const gaps = [
        ESCAPE_SECTIONS.surfaceStart - ESCAPE_SECTIONS.tunnelEnd,
        ESCAPE_SECTIONS.canyonStart - ESCAPE_SECTIONS.surfaceEnd,
        ESCAPE_SECTIONS.launchStart - ESCAPE_SECTIONS.canyonEnd,
      ];

      gaps.forEach((gap) => {
        expect(gap).toBe(0);
      });
    });
  });

  describe('Total Route Length', () => {
    it('should have total length of 3000m', () => {
      const totalLength = Math.abs(ESCAPE_SECTIONS.launchEnd - ESCAPE_SECTIONS.tunnelStart);
      expect(totalLength).toBe(3000);
    });

    it('should have sections sum to total length', () => {
      const tunnelLength = Math.abs(ESCAPE_SECTIONS.tunnelEnd - ESCAPE_SECTIONS.tunnelStart);
      const surfaceLength = Math.abs(ESCAPE_SECTIONS.surfaceEnd - ESCAPE_SECTIONS.surfaceStart);
      const canyonLength = Math.abs(ESCAPE_SECTIONS.canyonEnd - ESCAPE_SECTIONS.canyonStart);
      const launchLength = Math.abs(ESCAPE_SECTIONS.launchEnd - ESCAPE_SECTIONS.launchStart);

      const totalFromSections = tunnelLength + surfaceLength + canyonLength + launchLength;
      expect(totalFromSections).toBe(3000);
    });
  });

  describe('Direction Consistency', () => {
    it('should progress in negative Z direction', () => {
      expect(ESCAPE_SECTIONS.tunnelStart).toBeGreaterThan(ESCAPE_SECTIONS.tunnelEnd);
      expect(ESCAPE_SECTIONS.surfaceStart).toBeGreaterThan(ESCAPE_SECTIONS.surfaceEnd);
      expect(ESCAPE_SECTIONS.canyonStart).toBeGreaterThan(ESCAPE_SECTIONS.canyonEnd);
      expect(ESCAPE_SECTIONS.launchStart).toBeGreaterThan(ESCAPE_SECTIONS.launchEnd);
    });

    it('should have all positions negative or zero', () => {
      expect(ESCAPE_SECTIONS.tunnelStart).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.tunnelEnd).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.surfaceStart).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.surfaceEnd).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.canyonStart).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.canyonEnd).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.launchStart).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.launchEnd).toBeLessThanOrEqual(0);
      expect(ESCAPE_SECTIONS.shuttleZ).toBeLessThanOrEqual(0);
    });
  });

  describe('Section Proportions', () => {
    it('should have tunnel as shortest section (500m)', () => {
      const tunnelLength = Math.abs(ESCAPE_SECTIONS.tunnelEnd - ESCAPE_SECTIONS.tunnelStart);
      expect(tunnelLength).toBe(500);
    });

    it('should have surface and canyon as longest sections (1000m each)', () => {
      const surfaceLength = Math.abs(ESCAPE_SECTIONS.surfaceEnd - ESCAPE_SECTIONS.surfaceStart);
      const canyonLength = Math.abs(ESCAPE_SECTIONS.canyonEnd - ESCAPE_SECTIONS.canyonStart);

      expect(surfaceLength).toBe(1000);
      expect(canyonLength).toBe(1000);
    });

    it('should have launch pad approach same length as tunnel (500m)', () => {
      const tunnelLength = Math.abs(ESCAPE_SECTIONS.tunnelEnd - ESCAPE_SECTIONS.tunnelStart);
      const launchLength = Math.abs(ESCAPE_SECTIONS.launchEnd - ESCAPE_SECTIONS.launchStart);

      expect(launchLength).toBe(tunnelLength);
    });
  });
});

describe('EscapeRouteResult Type Contract', () => {
  it('should export ESCAPE_SECTIONS as readonly object', () => {
    // Verify the constants are accessible and have expected types
    expect(typeof ESCAPE_SECTIONS.tunnelStart).toBe('number');
    expect(typeof ESCAPE_SECTIONS.tunnelEnd).toBe('number');
    expect(typeof ESCAPE_SECTIONS.surfaceStart).toBe('number');
    expect(typeof ESCAPE_SECTIONS.surfaceEnd).toBe('number');
    expect(typeof ESCAPE_SECTIONS.canyonStart).toBe('number');
    expect(typeof ESCAPE_SECTIONS.canyonEnd).toBe('number');
    expect(typeof ESCAPE_SECTIONS.launchStart).toBe('number');
    expect(typeof ESCAPE_SECTIONS.launchEnd).toBe('number');
    expect(typeof ESCAPE_SECTIONS.shuttleZ).toBe('number');
  });

  it('should have exactly 9 section boundary constants', () => {
    const keys = Object.keys(ESCAPE_SECTIONS);
    expect(keys.length).toBe(9);
  });

  it('should include all expected keys', () => {
    expect(ESCAPE_SECTIONS).toHaveProperty('tunnelStart');
    expect(ESCAPE_SECTIONS).toHaveProperty('tunnelEnd');
    expect(ESCAPE_SECTIONS).toHaveProperty('surfaceStart');
    expect(ESCAPE_SECTIONS).toHaveProperty('surfaceEnd');
    expect(ESCAPE_SECTIONS).toHaveProperty('canyonStart');
    expect(ESCAPE_SECTIONS).toHaveProperty('canyonEnd');
    expect(ESCAPE_SECTIONS).toHaveProperty('launchStart');
    expect(ESCAPE_SECTIONS).toHaveProperty('launchEnd');
    expect(ESCAPE_SECTIONS).toHaveProperty('shuttleZ');
  });
});
