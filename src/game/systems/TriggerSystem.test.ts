/**
 * TriggerSystem Unit Tests
 *
 * Tests the trigger system functionality including:
 * - Volume triggers (enter/exit/stay)
 * - Proximity triggers
 * - Interaction triggers
 * - Line-of-sight triggers
 * - Combat triggers
 * - Collectible triggers
 * - Trigger groups
 * - Conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import {
  TriggerSystem,
  createVolumeTrigger,
  createInteractionTrigger,
  createCombatTrigger,
  createLineOfSightTrigger,
  type VolumeTriggerConfig,
  type ProximityTriggerConfig,
  type InteractionTriggerConfig,
  type CombatTriggerConfig,
  type CollectibleTriggerConfig,
} from './TriggerSystem';

describe('TriggerSystem', () => {
  let engine: NullEngine;
  let scene: Scene;
  let triggerSystem: TriggerSystem;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    triggerSystem = new TriggerSystem(scene);
  });

  afterEach(() => {
    triggerSystem.dispose();
    scene.dispose();
    engine.dispose();
  });

  // ==========================================================================
  // VOLUME TRIGGERS
  // ==========================================================================

  describe('Volume Triggers', () => {
    it('should fire onEnter when player enters sphere volume', () => {
      const onEnter = vi.fn();
      const onExit = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_volume',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 5,
        oneShot: false,
        onEnter,
        onExit,
      });

      // Set player position getter
      let playerPos = new Vector3(10, 0, 0); // Outside
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      // Update - player outside
      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();

      // Move player inside
      playerPos = new Vector3(2, 0, 0);
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(1);

      // Move player outside
      playerPos = new Vector3(10, 0, 0);
      triggerSystem.update(0.016);
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('should fire onStay while player remains in volume', () => {
      const onStay = vi.fn();
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_stay',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 5,
        oneShot: false,
        onEnter,
        onStay,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      // First frame: onEnter fires, not onStay (player just entered)
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(1);
      // onStay is only called when player was already inside from previous frame
      expect(onStay).not.toHaveBeenCalled();

      // Second frame: player still inside, now onStay fires
      triggerSystem.update(0.032);
      expect(onStay).toHaveBeenCalledWith(0.032);
      expect(onStay).toHaveBeenCalledTimes(1);

      // Third frame: onStay called again
      triggerSystem.update(0.016);
      expect(onStay).toHaveBeenCalledTimes(2);
    });

    it('should handle box-shaped volumes', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_box',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'box',
        size: new Vector3(10, 4, 10),
        oneShot: false,
        onEnter,
      });

      let playerPos = new Vector3(20, 0, 0); // Outside
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();

      // Move inside box
      playerPos = new Vector3(3, 1, 3);
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalled();
    });

    it('should handle oneShot triggers correctly', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_oneshot',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 5,
        oneShot: true,
        onEnter,
      });

      let playerPos = new Vector3(0, 0, 0);
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      // First entry
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(1);

      // Exit
      playerPos = new Vector3(20, 0, 0);
      triggerSystem.update(0.016);

      // Re-enter - should not fire again
      playerPos = new Vector3(0, 0, 0);
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(1);

      expect(triggerSystem.isTriggerComplete('test_oneshot')).toBe(true);
    });
  });

  // ==========================================================================
  // PROXIMITY TRIGGERS
  // ==========================================================================

  describe('Proximity Triggers', () => {
    it('should fire when player enters proximity radius', () => {
      const onProximityEnter = vi.fn();
      const onProximityExit = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_proximity',
        type: 'proximity',
        position: new Vector3(0, 0, 0),
        radius: 3,
        oneShot: false,
        onProximityEnter,
        onProximityExit,
      });

      let playerPos = new Vector3(10, 0, 0);
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      triggerSystem.update(0.016);
      expect(onProximityEnter).not.toHaveBeenCalled();

      playerPos = new Vector3(2, 0, 0);
      triggerSystem.update(0.016);
      expect(onProximityEnter).toHaveBeenCalled();

      playerPos = new Vector3(10, 0, 0);
      triggerSystem.update(0.016);
      expect(onProximityExit).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // INTERACTION TRIGGERS
  // ==========================================================================

  describe('Interaction Triggers', () => {
    it('should fire onInteract when player presses interact key in range', () => {
      const onInteract = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_interact',
        type: 'interaction',
        position: new Vector3(0, 0, 0),
        radius: 2,
        promptText: 'Press E to interact',
        oneShot: true,
        onInteract,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(1, 0, 0));
      triggerSystem.setInteractKeyChecker(() => true);

      triggerSystem.update(0.016);
      expect(onInteract).toHaveBeenCalled();
    });

    it('should not fire when player is out of range', () => {
      const onInteract = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_interact_range',
        type: 'interaction',
        position: new Vector3(0, 0, 0),
        radius: 2,
        promptText: 'Press E',
        oneShot: true,
        onInteract,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(10, 0, 0));
      triggerSystem.setInteractKeyChecker(() => true);

      triggerSystem.update(0.016);
      expect(onInteract).not.toHaveBeenCalled();
    });

    it('should handle timed interactions', () => {
      const onInteract = vi.fn();
      const onInteractionStart = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_timed_interact',
        type: 'interaction',
        position: new Vector3(0, 0, 0),
        radius: 2,
        promptText: 'Hold E',
        interactionTime: 1000, // 1 second
        oneShot: true,
        onInteract,
        onInteractionStart,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setInteractKeyChecker(() => true);

      // First frame - start interaction
      triggerSystem.update(0.5); // 500ms
      expect(onInteractionStart).toHaveBeenCalled();
      expect(onInteract).not.toHaveBeenCalled();

      // Continue holding
      triggerSystem.update(0.6); // Total > 1000ms
      expect(onInteract).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // COMBAT TRIGGERS
  // ==========================================================================

  describe('Combat Triggers', () => {
    it('should fire when all enemies in zone are killed', () => {
      const onCombatComplete = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_combat',
        type: 'combat',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 20,
        oneShot: true,
        onCombatComplete,
      });

      // Simulate enemy deaths
      triggerSystem.setEnemyPositionGetter(() => []);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      // Kill enemies in zone
      triggerSystem.notifyEnemyKilled('enemy_1', new Vector3(5, 0, 0));
      triggerSystem.notifyEnemyKilled('enemy_2', new Vector3(-3, 0, 2));

      triggerSystem.update(0.016);
      expect(onCombatComplete).toHaveBeenCalled();
    });

    it('should track per-enemy kills', () => {
      const onEnemyKilled = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_combat_kills',
        type: 'combat',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 20,
        oneShot: true,
        onEnemyKilled,
        onCombatComplete: () => {},
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setEnemyPositionGetter(() => []);

      triggerSystem.notifyEnemyKilled('enemy_1', new Vector3(5, 0, 0));
      expect(onEnemyKilled).toHaveBeenCalledWith('enemy_1');

      triggerSystem.notifyEnemyKilled('enemy_2', new Vector3(3, 0, 0));
      expect(onEnemyKilled).toHaveBeenCalledWith('enemy_2');
    });
  });

  // ==========================================================================
  // COLLECTIBLE TRIGGERS
  // ==========================================================================

  describe('Collectible Triggers', () => {
    it('should fire when all collectibles are picked up', () => {
      const onAllCollected = vi.fn();
      const onCollect = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_collectibles',
        type: 'collectible',
        position: new Vector3(0, 0, 0),
        collectibleIds: ['key_1', 'key_2', 'key_3'],
        oneShot: true,
        onCollect,
        onAllCollected,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      triggerSystem.notifyCollectiblePickedUp('key_1');
      expect(onCollect).toHaveBeenCalledWith('key_1');
      triggerSystem.update(0.016);
      expect(onAllCollected).not.toHaveBeenCalled();

      triggerSystem.notifyCollectiblePickedUp('key_2');
      triggerSystem.update(0.016);
      expect(onAllCollected).not.toHaveBeenCalled();

      triggerSystem.notifyCollectiblePickedUp('key_3');
      triggerSystem.update(0.016);
      expect(onAllCollected).toHaveBeenCalled();
    });

    it('should support partial collection requirements', () => {
      const onAllCollected = vi.fn();

      triggerSystem.createTrigger({
        id: 'test_partial',
        type: 'collectible',
        position: new Vector3(0, 0, 0),
        collectibleIds: ['gem_1', 'gem_2', 'gem_3', 'gem_4', 'gem_5'],
        requiredCount: 3,
        oneShot: true,
        onAllCollected,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      triggerSystem.notifyCollectiblePickedUp('gem_1');
      triggerSystem.notifyCollectiblePickedUp('gem_3');
      triggerSystem.update(0.016);
      expect(onAllCollected).not.toHaveBeenCalled();

      triggerSystem.notifyCollectiblePickedUp('gem_5');
      triggerSystem.update(0.016);
      expect(onAllCollected).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TRIGGER GROUPS
  // ==========================================================================

  describe('Trigger Groups', () => {
    it('should fire when all triggers in group complete (mode: all)', () => {
      const onGroupComplete = vi.fn();

      // Create three triggers
      triggerSystem.createTrigger({
        id: 'switch_1',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: () => {},
      });

      triggerSystem.createTrigger({
        id: 'switch_2',
        type: 'volume',
        position: new Vector3(10, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: () => {},
      });

      triggerSystem.createTrigger({
        id: 'switch_3',
        type: 'volume',
        position: new Vector3(20, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: () => {},
      });

      // Create group
      triggerSystem.createGroup({
        id: 'all_switches',
        triggerIds: ['switch_1', 'switch_2', 'switch_3'],
        mode: 'all',
        onGroupComplete,
      });

      let playerPos = new Vector3(0, 0, 0);
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      // Activate first switch
      triggerSystem.update(0.016);
      expect(onGroupComplete).not.toHaveBeenCalled();

      // Activate second switch
      playerPos = new Vector3(10, 0, 0);
      triggerSystem.update(0.016);
      expect(onGroupComplete).not.toHaveBeenCalled();

      // Activate third switch
      playerPos = new Vector3(20, 0, 0);
      triggerSystem.update(0.016);
      expect(onGroupComplete).toHaveBeenCalled();
    });

    it('should fire when any trigger in group completes (mode: any)', () => {
      const onGroupComplete = vi.fn();

      triggerSystem.createTrigger({
        id: 'door_1',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: () => {},
      });

      triggerSystem.createTrigger({
        id: 'door_2',
        type: 'volume',
        position: new Vector3(10, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: () => {},
      });

      triggerSystem.createGroup({
        id: 'any_door',
        triggerIds: ['door_1', 'door_2'],
        mode: 'any',
        onGroupComplete,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.update(0.016);
      expect(onGroupComplete).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CONDITIONS
  // ==========================================================================

  describe('Trigger Conditions', () => {
    it('should respect requiresItem condition', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'locked_door',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        conditions: {
          requiresItem: 'red_keycard',
        },
        onEnter,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setPlayerInventoryChecker((item) => item === 'blue_keycard');

      // Player doesn't have the required item
      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();

      // Player gets the item
      triggerSystem.setPlayerInventoryChecker((item) => item === 'red_keycard');
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalled();
    });

    it('should respect requiresFlag condition', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'boss_door',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        conditions: {
          requiresFlag: 'boss_intro_complete',
        },
        onEnter,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setFlagChecker(() => false);

      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();

      triggerSystem.setFlagChecker((flag) => flag === 'boss_intro_complete');
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalled();
    });

    it('should respect requiresTrigger condition', () => {
      const onFirstEnter = vi.fn();
      const onSecondEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'first_trigger',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter: onFirstEnter,
      });

      triggerSystem.createTrigger({
        id: 'second_trigger',
        type: 'volume',
        position: new Vector3(10, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        conditions: {
          requiresTrigger: 'first_trigger',
        },
        onEnter: onSecondEnter,
      });

      let playerPos = new Vector3(10, 0, 0);
      triggerSystem.setPlayerPositionGetter(() => playerPos);

      // Try second trigger first - should not fire
      triggerSystem.update(0.016);
      expect(onSecondEnter).not.toHaveBeenCalled();

      // Activate first trigger
      playerPos = new Vector3(0, 0, 0);
      triggerSystem.update(0.016);
      expect(onFirstEnter).toHaveBeenCalled();

      // Now second trigger should work
      playerPos = new Vector3(10, 0, 0);
      triggerSystem.update(0.016);
      expect(onSecondEnter).toHaveBeenCalled();
    });

    it('should respect health conditions', () => {
      const onLowHealthEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'health_station',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: false,
        cooldown: 0,
        conditions: {
          requiresMaxHealth: 50,
        },
        onEnter: onLowHealthEnter,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setPlayerHealthGetter(() => 100);

      // Full health - should not trigger
      triggerSystem.update(0.016);
      expect(onLowHealthEnter).not.toHaveBeenCalled();

      // Low health - should trigger
      triggerSystem.setPlayerHealthGetter(() => 30);
      triggerSystem.update(0.016);
      expect(onLowHealthEnter).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  describe('State Management', () => {
    it('should enable and disable triggers', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'toggle_trigger',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: false,
        enabled: false,
        onEnter,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      // Disabled - should not fire
      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();

      // Enable
      triggerSystem.enableTrigger('toggle_trigger');
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalled();

      // Disable
      triggerSystem.disableTrigger('toggle_trigger');
      onEnter.mockClear();

      // Move out and back in
      triggerSystem.setPlayerPositionGetter(() => new Vector3(10, 0, 0));
      triggerSystem.update(0.016);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.update(0.016);
      expect(onEnter).not.toHaveBeenCalled();
    });

    it('should reset triggers', () => {
      const onEnter = vi.fn();

      triggerSystem.createTrigger({
        id: 'resettable',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: true,
        onEnter,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));

      // First activation
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(triggerSystem.isTriggerComplete('resettable')).toBe(true);

      // Reset
      triggerSystem.resetTrigger('resettable');
      expect(triggerSystem.isTriggerComplete('resettable')).toBe(false);

      // Move out and back in
      triggerSystem.setPlayerPositionGetter(() => new Vector3(10, 0, 0));
      triggerSystem.update(0.016);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalledTimes(2);
    });

    it('should track active triggers', () => {
      triggerSystem.createTrigger({
        id: 'zone_a',
        type: 'volume',
        position: new Vector3(0, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: false,
        onEnter: () => {},
      });

      triggerSystem.createTrigger({
        id: 'zone_b',
        type: 'volume',
        position: new Vector3(10, 0, 0),
        shape: 'sphere',
        size: 2,
        oneShot: false,
        onEnter: () => {},
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.update(0.016);

      const active = triggerSystem.getActiveTriggers();
      expect(active).toContain('zone_a');
      expect(active).not.toContain('zone_b');
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('Factory Functions', () => {
    it('should create volume trigger with createVolumeTrigger', () => {
      const onEnter = vi.fn();
      const config = createVolumeTrigger('quick_trigger', new Vector3(5, 0, 5), 3, onEnter);

      expect(config.id).toBe('quick_trigger');
      expect(config.type).toBe('volume');
      expect(config.shape).toBe('sphere');
      expect(config.size).toBe(3);
      expect(config.oneShot).toBe(true);

      triggerSystem.createTrigger(config);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(5, 0, 5));
      triggerSystem.update(0.016);
      expect(onEnter).toHaveBeenCalled();
    });

    it('should create interaction trigger with createInteractionTrigger', () => {
      const onInteract = vi.fn();
      const config = createInteractionTrigger(
        'door_interact',
        new Vector3(0, 0, 0),
        2,
        'Press E to open',
        onInteract
      );

      expect(config.id).toBe('door_interact');
      expect(config.type).toBe('interaction');
      expect(config.promptText).toBe('Press E to open');

      triggerSystem.createTrigger(config);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setInteractKeyChecker(() => true);
      triggerSystem.update(0.016);
      expect(onInteract).toHaveBeenCalled();
    });

    it('should create combat trigger with createCombatTrigger', () => {
      const onCombatComplete = vi.fn();
      const config = createCombatTrigger('arena_clear', new Vector3(0, 0, 0), 15, onCombatComplete);

      expect(config.id).toBe('arena_clear');
      expect(config.type).toBe('combat');
      expect(config.shape).toBe('sphere');

      triggerSystem.createTrigger(config);
      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setEnemyPositionGetter(() => []);
      triggerSystem.notifyEnemyKilled('test_enemy', new Vector3(5, 0, 0));
      triggerSystem.update(0.016);
      expect(onCombatComplete).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // COOLDOWNS
  // ==========================================================================

  describe('Cooldowns', () => {
    it('should respect cooldown for non-oneShot triggers', () => {
      // Use fake timers to control performance.now()
      vi.useFakeTimers();

      const onInteract = vi.fn();

      // Use interaction trigger which has proper cooldown behavior
      triggerSystem.createTrigger({
        id: 'cooldown_trigger',
        type: 'interaction',
        position: new Vector3(0, 0, 0),
        radius: 2,
        promptText: 'Press E',
        oneShot: false,
        cooldown: 1000, // 1 second
        onInteract,
      });

      triggerSystem.setPlayerPositionGetter(() => new Vector3(0, 0, 0));
      triggerSystem.setInteractKeyChecker(() => true);

      // First interaction
      triggerSystem.update(0.016);
      expect(onInteract).toHaveBeenCalledTimes(1);

      // Try again immediately - should not fire (cooldown)
      triggerSystem.update(0.016);
      expect(onInteract).toHaveBeenCalledTimes(1);

      // Advance time past cooldown
      vi.advanceTimersByTime(1100); // 1.1 seconds

      // Interact again - should fire now (release and press again to simulate new interaction)
      triggerSystem.setInteractKeyChecker(() => false);
      triggerSystem.update(0.016);
      triggerSystem.setInteractKeyChecker(() => true);
      triggerSystem.update(0.016);
      expect(onInteract).toHaveBeenCalledTimes(2);

      // Restore real timers
      vi.useRealTimers();
    });
  });
});
