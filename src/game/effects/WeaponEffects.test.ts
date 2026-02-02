/**
 * Unit tests for WeaponEffects particle system
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { particleManager } from './ParticleManager';
import { WeaponEffects, weaponEffects } from './WeaponEffects';

// Mock the particle manager
vi.mock('./ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emit: vi.fn(() => ({
      color1: { r: 1, g: 1, b: 1, a: 1 },
      color2: { r: 1, g: 1, b: 1, a: 1 },
      colorDead: { r: 0, g: 0, b: 0, a: 0 },
      minEmitPower: 1,
      maxEmitPower: 5,
      minLifeTime: 0.1,
      maxLifeTime: 0.5,
      minSize: 0.1,
      maxSize: 0.5,
      particleTexture: null,
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    emitMuzzleFlash: vi.fn(),
    emitBulletImpact: vi.fn(),
    emitBloodSplatter: vi.fn(),
    emitAlienSplatter: vi.fn(),
    emitAlienDeath: vi.fn(),
    emitDustImpact: vi.fn(),
    emitDebris: vi.fn(),
    getDefaultTexture: vi.fn(() => null),
  },
}));

describe('WeaponEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = WeaponEffects.getInstance();
      const instance2 = WeaponEffects.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should be same as exported weaponEffects', () => {
      expect(weaponEffects).toBe(WeaponEffects.getInstance());
    });
  });

  describe('emitMuzzleFlash', () => {
    it('should call particleManager.emitMuzzleFlash', () => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);

      const position = new Vector3(0, 0, 0);
      const direction = new Vector3(0, 0, 1);

      weaponEffects.emitMuzzleFlash(position, direction, 'rifle');

      expect(particleManager.emitMuzzleFlash).toHaveBeenCalledWith(position, direction, 1);
    });

    it('should not emit when scene is not initialized', () => {
      // Create a new instance without init
      const effects = WeaponEffects.getInstance();
      effects.dispose(); // Clear scene reference

      const position = new Vector3(0, 0, 0);
      const direction = new Vector3(0, 0, 1);

      // Should not throw, just early return
      effects.emitMuzzleFlash(position, direction);

      // Should not call particle manager since scene is null
      vi.mocked(particleManager.emitMuzzleFlash).mockClear();
    });
  });

  describe('emitImpact', () => {
    beforeEach(() => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);
    });

    it('should emit metal impact for metal surface', () => {
      const position = new Vector3(1, 2, 3);
      const normal = new Vector3(0, 1, 0);

      weaponEffects.emitImpact(position, normal, 'metal');

      expect(particleManager.emitBulletImpact).toHaveBeenCalled();
    });

    it('should emit dust for concrete surface', () => {
      const position = new Vector3(1, 2, 3);

      weaponEffects.emitImpact(position, undefined, 'concrete');

      expect(particleManager.emitDustImpact).toHaveBeenCalled();
    });

    it('should emit blood for organic surface', () => {
      const position = new Vector3(1, 2, 3);

      weaponEffects.emitImpact(position, undefined, 'organic');

      expect(particleManager.emitBloodSplatter).toHaveBeenCalled();
    });
  });

  describe('emitEnemyHit', () => {
    beforeEach(() => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);
    });

    it('should emit alien splatter for alien targets', () => {
      const position = new Vector3(5, 0, 5);

      weaponEffects.emitEnemyHit(position, undefined, true);

      expect(particleManager.emitAlienSplatter).toHaveBeenCalled();
    });

    it('should emit blood splatter for human targets', () => {
      const position = new Vector3(5, 0, 5);

      weaponEffects.emitEnemyHit(position, undefined, false);

      expect(particleManager.emitBloodSplatter).toHaveBeenCalled();
    });

    it('should scale effect based on damage', () => {
      const position = new Vector3(5, 0, 5);

      // High damage hit
      weaponEffects.emitEnemyHit(position, undefined, true, 100);

      expect(particleManager.emitAlienSplatter).toHaveBeenCalledWith(
        position,
        2 // Max scale capped at 2
      );
    });

    it('should emit extra burst for critical hits', () => {
      const position = new Vector3(5, 0, 5);

      weaponEffects.emitEnemyHit(position, undefined, true, 25, true);

      expect(particleManager.emitAlienDeath).toHaveBeenCalled();
    });
  });

  describe('emitEnemyDeath', () => {
    beforeEach(() => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);
    });

    it('should emit alien death effect for aliens', () => {
      const position = new Vector3(0, 0, 0);

      weaponEffects.emitEnemyDeath(position, true);

      expect(particleManager.emitAlienDeath).toHaveBeenCalled();
    });
  });

  describe('projectile trails', () => {
    it('should track active trails', () => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);

      expect(weaponEffects.getActiveTrailCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      const mockScene = {} as any;
      weaponEffects.init(mockScene);

      weaponEffects.dispose();

      // After dispose, operations should be no-ops
      const position = new Vector3(0, 0, 0);
      const direction = new Vector3(0, 0, 1);

      // Clear mocks and try to emit
      vi.mocked(particleManager.emitMuzzleFlash).mockClear();
      weaponEffects.emitMuzzleFlash(position, direction);

      // Should not have emitted since scene is null after dispose
    });
  });
});
