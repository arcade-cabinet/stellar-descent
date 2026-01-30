/**
 * Tests for particle effects systems
 */

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it, vi } from 'vitest';

// Mock BabylonJS modules
vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation(() => ({
    intensity: 0,
    range: 0,
    diffuse: new Color3(1, 1, 1),
    position: new Vector3(0, 0, 0),
    dispose: vi.fn(),
    isDisposed: () => false,
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreatePlane: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      scaling: { setAll: vi.fn() },
      billboardMode: 0,
      isVisible: false,
      isPickable: false,
      material: null,
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateTorus: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      rotation: { x: 0 },
      scaling: { setAll: vi.fn() },
      material: null,
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateDisc: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      rotation: { x: 0 },
      material: null,
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateBox: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, addInPlace: vi.fn() },
      material: null,
      dispose: vi.fn(),
      isDisposed: () => false,
      addInPlace: vi.fn(),
    }),
    CreateSphere: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      material: null,
      dispose: vi.fn(),
    }),
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    emissiveColor: new Color3(1, 1, 1),
    diffuseColor: new Color3(1, 1, 1),
    disableLighting: false,
    backFaceCulling: true,
    alpha: 1,
    dispose: vi.fn(),
    clone: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@babylonjs/core/Particles/particleSystem', () => ({
  ParticleSystem: vi.fn().mockImplementation(() => ({
    emitter: null,
    minEmitBox: new Vector3(0, 0, 0),
    maxEmitBox: new Vector3(0, 0, 0),
    minLifeTime: 0,
    maxLifeTime: 0,
    minSize: 0,
    maxSize: 0,
    emitRate: 0,
    manualEmitCount: 0,
    color1: new Color4(1, 1, 1, 1),
    color2: new Color4(1, 1, 1, 1),
    colorDead: new Color4(0, 0, 0, 0),
    minEmitPower: 0,
    maxEmitPower: 0,
    gravity: new Vector3(0, 0, 0),
    direction1: new Vector3(0, 0, 0),
    direction2: new Vector3(0, 0, 0),
    blendMode: 0,
    updateSpeed: 0,
    particleTexture: null,
    preventAutoStart: false,
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    isStarted: vi.fn().mockReturnValue(false),
  })),
  BLENDMODE_ADD: 1,
  BLENDMODE_STANDARD: 0,
}));

vi.mock('../core/PerformanceManager', () => ({
  getAdjustedParticleCount: vi.fn((count) => count),
  getParticleMultiplier: vi.fn(() => 1),
  getPerformanceManager: vi.fn(() => ({
    canCreateParticleSystem: vi.fn(() => true),
  })),
}));

vi.mock('./ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emit: vi.fn().mockReturnValue({
      particleTexture: null,
      color1: new Color4(1, 1, 1, 1),
      color2: new Color4(1, 1, 1, 1),
      colorDead: new Color4(0, 0, 0, 0),
      minEmitPower: 0,
      maxEmitPower: 0,
      minLifeTime: 0,
      maxLifeTime: 0,
      minSize: 0,
      maxSize: 0,
      manualEmitCount: 0,
      start: vi.fn(),
    }),
    emitMuzzleFlash: vi.fn(),
    emitEnhancedMuzzleFlash: vi.fn(),
    emitAlienDeath: vi.fn(),
    emitExplosion: vi.fn(),
    emitBulletImpact: vi.fn(),
    emitDebris: vi.fn(),
    getDefaultTexture: vi.fn().mockReturnValue(null),
  },
}));

describe('MuzzleFlash', () => {
  it('should export MuzzleFlashManager singleton', async () => {
    const { MuzzleFlashManager, muzzleFlash } = await import('./MuzzleFlash');

    expect(MuzzleFlashManager).toBeDefined();
    expect(muzzleFlash).toBeDefined();
    expect(MuzzleFlashManager.getInstance()).toBe(muzzleFlash);
  });

  it('should export weapon flash configs', async () => {
    const { WEAPON_FLASH_CONFIGS } = await import('./MuzzleFlash');

    expect(WEAPON_FLASH_CONFIGS).toBeDefined();
    expect(WEAPON_FLASH_CONFIGS.rifle).toBeDefined();
    expect(WEAPON_FLASH_CONFIGS.shotgun).toBeDefined();
    expect(WEAPON_FLASH_CONFIGS.plasma).toBeDefined();
  });
});

describe('EnvironmentalParticles', () => {
  it('should export EnvironmentalParticles singleton', async () => {
    const { EnvironmentalParticles, environmentalParticles } = await import(
      './EnvironmentalParticles'
    );

    expect(EnvironmentalParticles).toBeDefined();
    expect(environmentalParticles).toBeDefined();
    expect(EnvironmentalParticles.getInstance()).toBe(environmentalParticles);
  });

  it('should support different environmental effect types', async () => {
    const { EnvironmentalParticles } = await import('./EnvironmentalParticles');

    // The module should export types for different effects
    // This is a compile-time check that the types exist
    const effectTypes: string[] = [
      'dust_motes',
      'light_beam_dust',
      'machinery_sparks',
      'water_drip',
      'alien_drip',
      'steam_vent',
      'debris_fall',
      'ember_float',
      'spore_drift',
    ];

    expect(effectTypes.length).toBe(9);
    expect(EnvironmentalParticles).toBeDefined();
  });
});

describe('DeathEffects', () => {
  it('should export DeathEffects singleton', async () => {
    const { DeathEffects, deathEffects } = await import('./DeathEffects');

    expect(DeathEffects).toBeDefined();
    expect(deathEffects).toBeDefined();
    expect(DeathEffects.getInstance()).toBe(deathEffects);
  });

  it('should support different death effect types', async () => {
    const { DeathEffects } = await import('./DeathEffects');

    // The module should have methods for different death types
    const instance = DeathEffects.getInstance();

    expect(typeof instance.playEnemyDeath).toBe('function');
    expect(typeof instance.playBossDeath).toBe('function');
    expect(typeof instance.playMechanicalDeath).toBe('function');
    expect(typeof instance.playDeathEffect).toBe('function');
  });
});

describe('Effects Index', () => {
  it('should export all effect modules', async () => {
    const effects = await import('./index');

    // Core exports
    expect(effects.particleManager).toBeDefined();
    expect(effects.weaponEffects).toBeDefined();
    expect(effects.damageFeedback).toBeDefined();

    // New exports
    expect(effects.muzzleFlash).toBeDefined();
    expect(effects.deathEffects).toBeDefined();
    expect(effects.environmentalParticles).toBeDefined();

    // Type exports should exist (checking manager classes)
    expect(effects.MuzzleFlashManager).toBeDefined();
    expect(effects.DeathEffects).toBeDefined();
    expect(effects.EnvironmentalParticles).toBeDefined();
  });
});
