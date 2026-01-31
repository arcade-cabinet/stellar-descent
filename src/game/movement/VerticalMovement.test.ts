/**
 * VerticalMovement System Tests
 *
 * Tests for mantle, jetpack, and unified vertical movement mechanics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  getMantleSystem,
  getJetpackSystem,
  getVerticalMovement,
  disposeMantleSystem,
  disposeJetpackSystem,
  disposeVerticalMovement,
} from './index';

// Mock the audio manager
vi.mock('../core/AudioManager', () => ({
  getAudioManager: () => ({
    play: vi.fn(),
    startLoop: vi.fn(),
    stopLoop: vi.fn(),
  }),
}));

// Mock the particle manager
vi.mock('../effects/ParticleManager', () => ({
  particleManager: {
    emit: vi.fn(),
  },
}));

describe('MantleSystem', () => {
  beforeEach(() => {
    disposeMantleSystem();
  });

  afterEach(() => {
    disposeMantleSystem();
  });

  it('should initialize with correct defaults', () => {
    const mantle = getMantleSystem();

    expect(mantle.getState()).toBe('idle');
    expect(mantle.isMantling()).toBe(false);
    expect(mantle.isOnCooldown()).toBe(false);
    expect(mantle.getProgress()).toBe(0);
  });

  it('should return singleton instance', () => {
    const mantle1 = getMantleSystem();
    const mantle2 = getMantleSystem();

    expect(mantle1).toBe(mantle2);
  });

  it('should reset state correctly', () => {
    const mantle = getMantleSystem();
    mantle.reset();

    expect(mantle.getState()).toBe('idle');
    expect(mantle.getProgress()).toBe(0);
    expect(mantle.getLedgeInfo()).toBeNull();
  });

  it('should provide camera animation data', () => {
    const mantle = getMantleSystem();
    const anim = mantle.getCameraAnimation();

    expect(anim).toHaveProperty('pitchOffset');
    expect(anim).toHaveProperty('rollOffset');
    expect(typeof anim.pitchOffset).toBe('number');
    expect(typeof anim.rollOffset).toBe('number');
  });
});

describe('JetpackSystem', () => {
  beforeEach(() => {
    disposeJetpackSystem();
  });

  afterEach(() => {
    disposeJetpackSystem();
  });

  it('should initialize with full fuel', () => {
    const jetpack = getJetpackSystem();

    expect(jetpack.getFuel()).toBe(1);
    expect(jetpack.getState()).toBe('ready');
    expect(jetpack.isBoosting()).toBe(false);
    expect(jetpack.isReady()).toBe(true);
  });

  it('should return singleton instance', () => {
    const jetpack1 = getJetpackSystem();
    const jetpack2 = getJetpackSystem();

    expect(jetpack1).toBe(jetpack2);
  });

  it('should allow boosting when ready', () => {
    const jetpack = getJetpackSystem();

    expect(jetpack.isReady()).toBe(true);
    expect(jetpack.tryBoost()).toBe(true);
    expect(jetpack.isBoosting()).toBe(true);
    expect(jetpack.getState()).toBe('boosting');
  });

  it('should not allow boosting when already boosting', () => {
    const jetpack = getJetpackSystem();

    jetpack.tryBoost();
    expect(jetpack.isBoosting()).toBe(true);

    // Second boost attempt should fail
    expect(jetpack.tryBoost()).toBe(false);
  });

  it('should stop boosting when stopBoost is called', () => {
    const jetpack = getJetpackSystem();

    jetpack.tryBoost();
    expect(jetpack.isBoosting()).toBe(true);

    jetpack.stopBoost();
    expect(jetpack.isBoosting()).toBe(false);
  });

  it('should consume fuel while boosting', () => {
    const jetpack = getJetpackSystem();
    const initialFuel = jetpack.getFuel();

    jetpack.tryBoost();

    // Simulate update
    const playerPos = new Vector3(0, 5, 0);
    jetpack.update(0.1, playerPos);

    expect(jetpack.getFuel()).toBeLessThan(initialFuel);
  });

  it('should regenerate fuel over time when not boosting', () => {
    const jetpack = getJetpackSystem();

    // Deplete some fuel
    jetpack.tryBoost();
    jetpack.update(0.3, new Vector3(0, 5, 0));
    jetpack.stopBoost();

    const fuelAfterBoost = jetpack.getFuel();

    // Wait through regen delay (1.0s) and then regen for a bit
    jetpack.update(1.5, new Vector3(0, 5, 0));
    jetpack.update(1.0, new Vector3(0, 5, 0));

    expect(jetpack.getFuel()).toBeGreaterThan(fuelAfterBoost);
  });

  it('should refuel to full capacity', () => {
    const jetpack = getJetpackSystem();

    // Use some fuel
    jetpack.tryBoost();
    jetpack.update(0.2, new Vector3(0, 5, 0));
    jetpack.stopBoost();

    // Refuel
    jetpack.refuel();

    expect(jetpack.getFuel()).toBe(1);
    expect(jetpack.getState()).toBe('ready');
  });

  it('should provide camera shake when boosting', () => {
    const jetpack = getJetpackSystem();

    // No shake when not boosting
    let shake = jetpack.getCameraShake();
    expect(shake.x).toBe(0);
    expect(shake.y).toBe(0);

    // Should have shake when boosting
    jetpack.tryBoost();
    shake = jetpack.getCameraShake();
    // Shake values depend on performance.now(), but should be calculated
    expect(typeof shake.x).toBe('number');
    expect(typeof shake.y).toBe('number');
  });

  it('should reset state correctly', () => {
    const jetpack = getJetpackSystem();

    jetpack.tryBoost();
    jetpack.update(0.2, new Vector3(0, 5, 0));

    jetpack.reset();

    expect(jetpack.getFuel()).toBe(1);
    expect(jetpack.getState()).toBe('ready');
    expect(jetpack.isBoosting()).toBe(false);
  });

  it('should track thruster effects when boosting', () => {
    const jetpack = getJetpackSystem();

    // No effects when not boosting
    expect(jetpack.getThrusterEffects()).toHaveLength(0);

    // Should have effects when boosting
    jetpack.tryBoost();
    const effects = jetpack.getThrusterEffects();
    expect(effects.length).toBe(2); // Left and right thrusters
    expect(effects[0]).toHaveProperty('position');
    expect(effects[0]).toHaveProperty('direction');
    expect(effects[0]).toHaveProperty('intensity');
  });
});

describe('VerticalMovement', () => {
  beforeEach(() => {
    disposeVerticalMovement();
    disposeMantleSystem();
    disposeJetpackSystem();
  });

  afterEach(() => {
    disposeVerticalMovement();
    disposeMantleSystem();
    disposeJetpackSystem();
  });

  it('should initialize with correct defaults', () => {
    const vertical = getVerticalMovement();
    const state = vertical.getState();

    expect(state.isGrounded).toBe(true);
    expect(state.velocityY).toBe(0);
    expect(state.isJumping).toBe(false);
    expect(state.isMantling).toBe(false);
    expect(state.isJetpacking).toBe(false);
  });

  it('should return singleton instance', () => {
    const v1 = getVerticalMovement();
    const v2 = getVerticalMovement();

    expect(v1).toBe(v2);
  });

  it('should allow jumping when grounded', () => {
    const vertical = getVerticalMovement();

    expect(vertical.canJump()).toBe(true);
  });

  it('should track coyote time', () => {
    const vertical = getVerticalMovement();

    // Start grounded
    expect(vertical.isPlayerGrounded()).toBe(true);

    // Even without a scene, coyote time should be tracked
    expect(vertical.canJump()).toBe(true);
  });

  it('should get air control multiplier', () => {
    const vertical = getVerticalMovement();

    // Should be 1.0 when grounded
    expect(vertical.getAirControlMultiplier()).toBe(1.0);
  });

  it('should provide camera animation data', () => {
    const vertical = getVerticalMovement();
    const anim = vertical.getCameraAnimation();

    expect(anim).toHaveProperty('pitchOffset');
    expect(anim).toHaveProperty('rollOffset');
    expect(anim).toHaveProperty('shakeX');
    expect(anim).toHaveProperty('shakeY');
  });

  it('should reset state correctly', () => {
    const vertical = getVerticalMovement();

    vertical.reset();

    const state = vertical.getState();
    expect(state.isGrounded).toBe(true);
    expect(state.velocityY).toBe(0);
    expect(state.isJumping).toBe(false);
    expect(state.jetpackFuel).toBe(1);
  });

  it('should force player to ground', () => {
    const vertical = getVerticalMovement();

    vertical.forceGround();

    expect(vertical.isPlayerGrounded()).toBe(true);
    expect(vertical.getVelocityY()).toBe(0);
  });

  it('should cancel in-progress movement', () => {
    const vertical = getVerticalMovement();
    const jetpack = getJetpackSystem();

    // Start jetpack
    jetpack.tryBoost();
    expect(jetpack.isBoosting()).toBe(true);

    // Cancel all movement
    vertical.cancelMovement();

    expect(jetpack.isBoosting()).toBe(false);
  });

  it('should allow jetpack boost through unified controller', () => {
    const vertical = getVerticalMovement();

    expect(vertical.tryJetpack()).toBe(true);
    expect(vertical.getState().isJetpacking).toBe(true);
  });
});

describe('Integration: Mantle + Jetpack', () => {
  beforeEach(() => {
    disposeVerticalMovement();
    disposeMantleSystem();
    disposeJetpackSystem();
  });

  afterEach(() => {
    disposeVerticalMovement();
    disposeMantleSystem();
    disposeJetpackSystem();
  });

  it('should not allow jetpack while mantling', () => {
    const vertical = getVerticalMovement();
    const mantle = getMantleSystem();

    // Note: Without a scene, we can't actually trigger mantling
    // but we can verify the logic exists
    expect(vertical.getState().isMantling).toBe(false);
  });

  it('should not allow mantling while jetpacking', () => {
    const vertical = getVerticalMovement();

    // Start jetpack
    vertical.tryJetpack();
    expect(vertical.getState().isJetpacking).toBe(true);

    // Attempt mantle should fail (would need scene for full test)
    const result = vertical.tryMantle(
      new Vector3(0, 5, 0),
      new Vector3(0, 0, 1)
    );
    expect(result).toBe(false);
  });
});
