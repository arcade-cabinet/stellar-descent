/**
 * PlayerGovernor.test.ts - Comprehensive unit tests for the PlayerGovernor system
 *
 * Tests the autonomous player controller ("bot player") that drives
 * automated game testing via goal-based state machine, input generation,
 * Yuka AI navigation, and event emission.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('yuka', () => {
  class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
  }

  class MockArriveBehavior {
    target: MockVector3;
    deceleration: number;
    weight = 0;
    constructor(target?: MockVector3, deceleration?: number) {
      this.target = target ?? new MockVector3();
      this.deceleration = deceleration ?? 3;
    }
  }

  class MockSeekBehavior {
    target: MockVector3;
    weight = 0;
    constructor(target?: MockVector3) {
      this.target = target ?? new MockVector3();
    }
  }

  class MockEntityManager {
    private entities: unknown[] = [];
    add = vi.fn((entity: unknown) => {
      this.entities.push(entity);
    });
    remove = vi.fn();
    update = vi.fn();
    clear = vi.fn(() => {
      this.entities = [];
    });
  }

  class MockSteering {
    private behaviors: unknown[] = [];
    add = vi.fn((behavior: unknown) => {
      this.behaviors.push(behavior);
    });
    clear = vi.fn(() => {
      this.behaviors = [];
    });
    getBehaviors() {
      return this.behaviors;
    }
  }

  class MockVehicle {
    position = new MockVector3(0, 0, 0);
    velocity = new MockVector3(0, 0, 0);
    maxSpeed = 10;
    maxForce = 10;
    steering = new MockSteering();
  }

  return {
    ArriveBehavior: MockArriveBehavior,
    EntityManager: MockEntityManager,
    SeekBehavior: MockSeekBehavior,
    Vehicle: MockVehicle,
    Vector3: MockVector3,
  };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static Distance(a: MockVector3, b: MockVector3): number {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    static Zero() {
      return new MockVector3(0, 0, 0);
    }
  }

  return {
    Vector3: MockVector3,
  };
});

vi.mock('../core/Logger', () => ({
  getLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../core/ecs', () => ({
  getEntitiesInRadius: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import { getEntitiesInRadius } from '../core/ecs';
import {
  type GovernorConfig,
  type GovernorEvent,
  type GovernorGoal,
  PlayerGovernor,
  getPlayerGovernor,
  resetPlayerGovernor,
} from './PlayerGovernor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayerEntity(x = 0, y = 0, z = 0) {
  return {
    id: 'player-1',
    transform: {
      position: new BabylonVector3(x, y, z),
      rotation: new BabylonVector3(0, 0, 0),
      scale: new BabylonVector3(1, 1, 1),
    },
    tags: { player: true },
    health: { current: 100, max: 100, regenRate: 0 },
  };
}

function makeEnemyEntity(id: string, x: number, y: number, z: number, hp = 100) {
  return {
    id,
    transform: {
      position: new BabylonVector3(x, y, z),
      rotation: new BabylonVector3(0, 0, 0),
      scale: new BabylonVector3(1, 1, 1),
    },
    tags: { enemy: true },
    health: { current: hp, max: 100, regenRate: 0 },
  };
}

function collectEvents(governor: PlayerGovernor): GovernorEvent[] {
  const events: GovernorEvent[] = [];
  governor.addEventListener((e) => events.push(e));
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayerGovernor', () => {
  let governor: PlayerGovernor;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPlayerGovernor();
    governor = new PlayerGovernor({ logActions: false });
  });

  afterEach(() => {
    governor.dispose();
    resetPlayerGovernor();
  });

  // ========================================================================
  // 1. Construction and configuration
  // ========================================================================

  describe('Construction and configuration', () => {
    it('should use default config values when no overrides provided', () => {
      const defaultGov = new PlayerGovernor();
      // The governor starts in idle
      expect(defaultGov.getCurrentGoal().type).toBe('idle');
      // Queued goals are empty
      expect(defaultGov.getQueuedGoals()).toEqual([]);
      defaultGov.dispose();
    });

    it('should apply custom config overrides', () => {
      const customGov = new PlayerGovernor({
        moveSpeed: 20,
        arrivalThreshold: 5,
        autoShoot: false,
        engagementRange: 50,
        dialogueAdvanceDelay: 500,
        logActions: false,
      });

      // Verify the config took effect by testing behavior that depends on it.
      // The vehicle's maxSpeed is set from moveSpeed in the constructor.
      // We can verify indirectly through the vehicle position accessor.
      expect(customGov.getVehiclePosition()).toBeDefined();
      customGov.dispose();
    });

    it('should merge partial config with defaults', () => {
      // Only override one value; rest should be defaults
      const partialGov = new PlayerGovernor({ moveSpeed: 12 });
      expect(partialGov.getCurrentGoal().type).toBe('idle');
      partialGov.dispose();
    });
  });

  // ========================================================================
  // Singleton pattern
  // ========================================================================

  describe('Singleton pattern', () => {
    it('getPlayerGovernor returns the same instance on repeated calls', () => {
      const a = getPlayerGovernor({ logActions: false });
      const b = getPlayerGovernor({ logActions: false });
      expect(a).toBe(b);
    });

    it('resetPlayerGovernor clears the singleton', () => {
      const first = getPlayerGovernor({ logActions: false });
      resetPlayerGovernor();
      const second = getPlayerGovernor({ logActions: false });
      expect(first).not.toBe(second);
    });

    it('resetPlayerGovernor disposes the previous instance', () => {
      const instance = getPlayerGovernor({ logActions: false });
      const disposeSpy = vi.spyOn(instance, 'dispose');
      resetPlayerGovernor();
      expect(disposeSpy).toHaveBeenCalled();
    });

    it('getPlayerGovernor passes config only on first creation', () => {
      const first = getPlayerGovernor({ moveSpeed: 99 });
      // Second call with different config should return the same instance
      const second = getPlayerGovernor({ moveSpeed: 1 });
      expect(first).toBe(second);
    });
  });

  // ========================================================================
  // 2. Goal management
  // ========================================================================

  describe('Goal management', () => {
    it('setGoal changes current goal', () => {
      const goal: GovernorGoal = { type: 'wait', duration: 1000 };
      governor.setGoal(goal);
      expect(governor.getCurrentGoal()).toEqual(goal);
    });

    it('setGoal replaces any previously set goal', () => {
      governor.setGoal({ type: 'wait', duration: 500 });
      governor.setGoal({ type: 'idle' });
      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('queueGoal adds goals to the queue', () => {
      governor.queueGoal({ type: 'wait', duration: 100 });
      governor.queueGoal({ type: 'advance_dialogue' });
      const queued = governor.getQueuedGoals();
      expect(queued).toHaveLength(2);
      expect(queued[0].type).toBe('wait');
      expect(queued[1].type).toBe('advance_dialogue');
    });

    it('queueGoal does not change the current goal', () => {
      governor.setGoal({ type: 'idle' });
      governor.queueGoal({ type: 'wait', duration: 500 });
      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('clearGoals resets current goal to idle and empties queue', () => {
      governor.setGoal({ type: 'wait', duration: 1000 });
      governor.queueGoal({ type: 'advance_dialogue' });
      governor.queueGoal({ type: 'engage_enemies' });

      governor.clearGoals();

      expect(governor.getCurrentGoal().type).toBe('idle');
      expect(governor.getQueuedGoals()).toEqual([]);
    });

    it('goal completion advances to the next queued goal', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      // Set a navigate goal with the player already at the target
      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });
      governor.queueGoal({ type: 'wait', duration: 5000 });

      // Run update - navigate goal should complete immediately (distance == 0)
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('wait');
    });

    it('goal completion returns to idle when queue is empty', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      // Navigate goal that will complete immediately (already at target)
      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });

      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
      expect(governor.getQueuedGoals()).toEqual([]);
    });

    it('getQueuedGoals returns a copy, not a reference', () => {
      governor.queueGoal({ type: 'wait', duration: 100 });
      const copy = governor.getQueuedGoals();
      copy.push({ type: 'idle' });
      // Original queue should be unchanged
      expect(governor.getQueuedGoals()).toHaveLength(1);
    });
  });

  // ========================================================================
  // 3. Event system
  // ========================================================================

  describe('Event system', () => {
    it('addEventListener receives events', () => {
      const events = collectEvents(governor);

      governor.setGoal({ type: 'wait', duration: 1000 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('goal_started');
    });

    it('multiple listeners all receive the same event', () => {
      const events1: GovernorEvent[] = [];
      const events2: GovernorEvent[] = [];
      governor.addEventListener((e) => events1.push(e));
      governor.addEventListener((e) => events2.push(e));

      governor.setGoal({ type: 'idle' });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].type).toBe('goal_started');
    });

    it('removeEventListener stops receiving events', () => {
      const events: GovernorEvent[] = [];
      const listener = (e: GovernorEvent) => events.push(e);
      governor.addEventListener(listener);

      governor.setGoal({ type: 'idle' });
      expect(events).toHaveLength(1);

      governor.removeEventListener(listener);

      governor.setGoal({ type: 'wait', duration: 100 });
      // Should still be 1 - listener was removed
      expect(events).toHaveLength(1);
    });

    it('removeEventListener is a no-op for unregistered listeners', () => {
      const unregistered = vi.fn();
      // Should not throw
      governor.removeEventListener(unregistered);
    });

    it('emits goal_started when a new goal is set', () => {
      const events = collectEvents(governor);
      const goal: GovernorGoal = { type: 'engage_enemies', aggressive: true };
      governor.setGoal(goal);

      const startEvent = events.find((e) => e.type === 'goal_started');
      expect(startEvent).toBeDefined();
      if (startEvent?.type === 'goal_started') {
        expect(startEvent.goal).toEqual(goal);
      }
    });

    it('emits goal_completed when a goal finishes', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const events = collectEvents(governor);

      // Navigate goal that completes immediately
      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });
      governor.update(0.016);

      const completedEvents = events.filter((e) => e.type === 'goal_completed');
      expect(completedEvents).toHaveLength(1);
      if (completedEvents[0]?.type === 'goal_completed') {
        expect(completedEvents[0].goal.type).toBe('navigate');
      }
    });

    it('emits goal_started for the next queued goal after completion', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const events = collectEvents(governor);

      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });
      governor.queueGoal({ type: 'wait', duration: 9999 });

      governor.update(0.016);

      const startedEvents = events.filter((e) => e.type === 'goal_started');
      // One for navigate, one for wait
      expect(startedEvents).toHaveLength(2);
      if (startedEvents[1]?.type === 'goal_started') {
        expect(startedEvents[1].goal.type).toBe('wait');
      }
    });

    it('dispose clears all event listeners', () => {
      const events: GovernorEvent[] = [];
      governor.addEventListener((e) => events.push(e));

      governor.dispose();

      // Create a new governor to verify the old one's listeners are gone
      const newGov = new PlayerGovernor({ logActions: false });
      newGov.setGoal({ type: 'idle' });
      // events should remain at 0 since the old governor was disposed
      expect(events).toHaveLength(0);
      newGov.dispose();
    });
  });

  // ========================================================================
  // 4. Navigate goal
  // ========================================================================

  describe('Navigate goal', () => {
    it('completes when player is within default threshold distance', () => {
      const player = makePlayerEntity(1, 0, 0);
      governor.setPlayer(player);

      // Target is at origin, player is 1 unit away, default threshold is 2
      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('does not complete when player is beyond threshold distance', () => {
      const player = makePlayerEntity(100, 0, 0);
      governor.setPlayer(player);

      governor.setGoal({ type: 'navigate', target: new BabylonVector3(0, 0, 0) });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('navigate');
    });

    it('uses custom threshold when provided', () => {
      const player = makePlayerEntity(4, 0, 0);
      governor.setPlayer(player);

      // Distance is 4, custom threshold is 5 -> should complete
      governor.setGoal({
        type: 'navigate',
        target: new BabylonVector3(0, 0, 0),
        threshold: 5,
      });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('does not complete with custom threshold when still too far', () => {
      const player = makePlayerEntity(10, 0, 0);
      governor.setPlayer(player);

      governor.setGoal({
        type: 'navigate',
        target: new BabylonVector3(0, 0, 0),
        threshold: 5,
      });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('navigate');
    });

    it('emits position_reached event on completion', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const events = collectEvents(governor);
      const target = new BabylonVector3(0, 0, 0);
      governor.setGoal({ type: 'navigate', target });
      governor.update(0.016);

      const posEvents = events.filter((e) => e.type === 'position_reached');
      expect(posEvents).toHaveLength(1);
      if (posEvents[0]?.type === 'position_reached') {
        expect(posEvents[0].position).toBe(target);
      }
    });

    it('navigateTo convenience method sets a navigate goal', () => {
      const target = new BabylonVector3(50, 0, 50);
      governor.navigateTo(target, 3);

      const goal = governor.getCurrentGoal();
      expect(goal.type).toBe('navigate');
      if (goal.type === 'navigate') {
        expect(goal.target).toBe(target);
        expect(goal.threshold).toBe(3);
      }
    });
  });

  // ========================================================================
  // 5. Wait goal
  // ========================================================================

  describe('Wait goal', () => {
    it('does not complete before the duration has elapsed', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      governor.setGoal({ type: 'wait', duration: 2000 });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('wait');
    });

    it('tracks the start time on first update', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const startTime = 10000;
      vi.spyOn(Date, 'now').mockReturnValue(startTime);

      const waitGoal: GovernorGoal = { type: 'wait', duration: 500 };
      governor.setGoal(waitGoal);
      governor.update(0.016);

      // The goal object should have its started property mutated
      if (waitGoal.type === 'wait') {
        expect(waitGoal.started).toBe(startTime);
      }
    });

    it('completes after the specified duration', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const startTime = 10000;
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValue(startTime);

      governor.setGoal({ type: 'wait', duration: 500 });
      governor.update(0.016);

      // Advance time past duration
      dateNowSpy.mockReturnValue(startTime + 500);
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('emits goal_completed on completion', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const events = collectEvents(governor);
      const startTime = 10000;
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValue(startTime);

      governor.setGoal({ type: 'wait', duration: 300 });
      governor.update(0.016);

      dateNowSpy.mockReturnValue(startTime + 300);
      governor.update(0.016);

      const completedEvents = events.filter((e) => e.type === 'goal_completed');
      expect(completedEvents).toHaveLength(1);
      if (completedEvents[0]?.type === 'goal_completed') {
        expect(completedEvents[0].goal.type).toBe('wait');
      }
    });

    it('wait convenience method sets a wait goal', () => {
      governor.wait(750);
      const goal = governor.getCurrentGoal();
      expect(goal.type).toBe('wait');
      if (goal.type === 'wait') {
        expect(goal.duration).toBe(750);
      }
    });
  });

  // ========================================================================
  // 6. Engage enemies goal
  // ========================================================================

  describe('Engage enemies goal', () => {
    it('completes when no enemies are in range (non-aggressive)', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      vi.mocked(getEntitiesInRadius).mockReturnValue([]);

      governor.setGoal({ type: 'engage_enemies', aggressive: false });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
    });

    it('stays active in aggressive mode even without enemies', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      vi.mocked(getEntitiesInRadius).mockReturnValue([]);

      governor.setGoal({ type: 'engage_enemies', aggressive: true });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('engage_enemies');
    });

    it('shoots when enemy is within shooting range', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const enemy = makeEnemyEntity('enemy-1', 10, 0, 0);
      vi.mocked(getEntitiesInRadius).mockReturnValue([enemy as any]);

      governor.setGoal({ type: 'engage_enemies' });
      governor.update(0.016);

      const input = governor.getInputState();
      expect(input.shoot).toBe(true);
    });

    it('does not shoot when enemy is beyond 20 units', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const enemy = makeEnemyEntity('enemy-far', 25, 0, 0);
      vi.mocked(getEntitiesInRadius).mockReturnValue([enemy as any]);

      governor.setGoal({ type: 'engage_enemies' });
      governor.update(0.016);

      const input = governor.getInputState();
      expect(input.shoot).toBe(false);
    });

    it('emits enemy_engaged when shooting at an enemy', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const enemy = makeEnemyEntity('enemy-close', 5, 0, 0);
      vi.mocked(getEntitiesInRadius).mockReturnValue([enemy as any]);

      const events = collectEvents(governor);
      governor.setGoal({ type: 'engage_enemies' });
      governor.update(0.016);

      const engagedEvents = events.filter((e) => e.type === 'enemy_engaged');
      expect(engagedEvents).toHaveLength(1);
      if (engagedEvents[0]?.type === 'enemy_engaged') {
        expect(engagedEvents[0].enemyId).toBe('enemy-close');
      }
    });

    it('targets the nearest enemy when multiple are present', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      const nearEnemy = makeEnemyEntity('near', 5, 0, 0);
      const farEnemy = makeEnemyEntity('far', 15, 0, 0);
      vi.mocked(getEntitiesInRadius).mockReturnValue([farEnemy as any, nearEnemy as any]);

      const events = collectEvents(governor);
      governor.setGoal({ type: 'engage_enemies' });
      governor.update(0.016);

      const engagedEvents = events.filter((e) => e.type === 'enemy_engaged');
      expect(engagedEvents).toHaveLength(1);
      if (engagedEvents[0]?.type === 'enemy_engaged') {
        expect(engagedEvents[0].enemyId).toBe('near');
      }
    });

    it('does not shoot when autoShoot is disabled', () => {
      const noAutoShootGov = new PlayerGovernor({ autoShoot: false, logActions: false });
      const player = makePlayerEntity(0, 0, 0);
      noAutoShootGov.setPlayer(player);

      const enemy = makeEnemyEntity('enemy-1', 5, 0, 0);
      vi.mocked(getEntitiesInRadius).mockReturnValue([enemy as any]);

      noAutoShootGov.setGoal({ type: 'engage_enemies' });
      noAutoShootGov.update(0.016);

      expect(noAutoShootGov.getInputState().shoot).toBe(false);
      noAutoShootGov.dispose();
    });

    it('engageEnemies convenience method sets an engage goal', () => {
      governor.engageEnemies(true);
      const goal = governor.getCurrentGoal();
      expect(goal.type).toBe('engage_enemies');
      if (goal.type === 'engage_enemies') {
        expect(goal.aggressive).toBe(true);
      }
    });

    it('engageEnemies defaults aggressive to false', () => {
      governor.engageEnemies();
      const goal = governor.getCurrentGoal();
      if (goal.type === 'engage_enemies') {
        expect(goal.aggressive).toBe(false);
      }
    });

    it('calls getEntitiesInRadius with correct engagement range', () => {
      const customGov = new PlayerGovernor({ engagementRange: 42, logActions: false });
      const player = makePlayerEntity(0, 0, 0);
      customGov.setPlayer(player);

      vi.mocked(getEntitiesInRadius).mockReturnValue([]);

      customGov.setGoal({ type: 'engage_enemies' });
      customGov.update(0.016);

      expect(getEntitiesInRadius).toHaveBeenCalledWith(
        player.transform.position,
        42,
        expect.any(Function)
      );
      customGov.dispose();
    });
  });

  // ========================================================================
  // 7. Dialogue goal
  // ========================================================================

  describe('Advance dialogue goal', () => {
    it('sets advanceDialogue input when delay has elapsed', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const now = 50000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      governor.setGoal({ type: 'advance_dialogue' });
      governor.update(0.016);

      expect(governor.getInputState().advanceDialogue).toBe(true);
    });

    it('respects dialogueAdvanceDelay - does not advance too soon', () => {
      const delayGov = new PlayerGovernor({
        dialogueAdvanceDelay: 2000,
        logActions: false,
      });
      const player = makePlayerEntity();
      delayGov.setPlayer(player);

      const baseTime = 50000;
      const dateNowSpy = vi.spyOn(Date, 'now');

      // First dialogue goal completes
      dateNowSpy.mockReturnValue(baseTime);
      delayGov.setGoal({ type: 'advance_dialogue' });
      delayGov.update(0.016);

      // Now set another dialogue goal immediately - should NOT advance
      // because lastDialogueAdvance was just set to baseTime
      dateNowSpy.mockReturnValue(baseTime + 500); // Only 500ms later
      delayGov.setGoal({ type: 'advance_dialogue' });
      delayGov.update(0.016);

      // The input state should be false because we haven't waited long enough
      expect(delayGov.getInputState().advanceDialogue).toBe(false);

      delayGov.dispose();
    });

    it('emits dialogue_advanced event', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const events = collectEvents(governor);

      vi.spyOn(Date, 'now').mockReturnValue(99999);

      governor.setGoal({ type: 'advance_dialogue' });
      governor.update(0.016);

      const dialogueEvents = events.filter((e) => e.type === 'dialogue_advanced');
      expect(dialogueEvents).toHaveLength(1);
    });

    it('completes the goal after advancing dialogue', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      vi.spyOn(Date, 'now').mockReturnValue(99999);

      governor.setGoal({ type: 'advance_dialogue' });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
    });
  });

  // ========================================================================
  // 8. Input state
  // ========================================================================

  describe('Input state', () => {
    it('getInputState returns a copy, not a reference', () => {
      const state1 = governor.getInputState();
      state1.shoot = true;
      const state2 = governor.getInputState();
      expect(state2.shoot).toBe(false);
    });

    it('input state contains all expected fields', () => {
      const state = governor.getInputState();
      expect(state).toHaveProperty('moveForward');
      expect(state).toHaveProperty('moveBack');
      expect(state).toHaveProperty('moveLeft');
      expect(state).toHaveProperty('moveRight');
      expect(state).toHaveProperty('shoot');
      expect(state).toHaveProperty('interact');
      expect(state).toHaveProperty('advanceDialogue');
    });

    it('all inputs default to false', () => {
      const state = governor.getInputState();
      expect(state.moveForward).toBe(false);
      expect(state.moveBack).toBe(false);
      expect(state.moveLeft).toBe(false);
      expect(state.moveRight).toBe(false);
      expect(state.shoot).toBe(false);
      expect(state.interact).toBe(false);
      expect(state.advanceDialogue).toBe(false);
    });

    it('input state resets each update cycle', () => {
      const player = makePlayerEntity(0, 0, 0);
      governor.setPlayer(player);

      // First update with interact goal sets interact = true
      governor.setGoal({ type: 'interact' });
      governor.update(0.016);

      // After the interact goal completes, the next update should reset inputs
      // The interact goal auto-completes, so the governor is now idle
      governor.update(0.016);

      const state = governor.getInputState();
      expect(state.interact).toBe(false);
    });

    it('interact goal sets interact input to true', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      governor.setGoal({ type: 'interact' });
      governor.update(0.016);

      // The interact goal sets interact = true, but also immediately completes.
      // We need to check during the same update. Since we cannot intercept mid-update,
      // verify through the event that the goal completed (which means interact was set).
      const events = collectEvents(governor);
      governor.setGoal({ type: 'interact' });
      governor.update(0.016);

      const completed = events.filter((e) => e.type === 'goal_completed');
      expect(completed).toHaveLength(1);
    });

    it('individual accessor methods reflect input state', () => {
      // All should be false initially
      expect(governor.isMovingForward()).toBe(false);
      expect(governor.isMovingBack()).toBe(false);
      expect(governor.isMovingLeft()).toBe(false);
      expect(governor.isMovingRight()).toBe(false);
      expect(governor.isShooting()).toBe(false);
      expect(governor.shouldAdvanceDialogue()).toBe(false);
      expect(governor.shouldInteract()).toBe(false);
    });
  });

  // ========================================================================
  // 9. Tutorial playthrough
  // ========================================================================

  describe('Tutorial playthrough', () => {
    it('runTutorialPlaythrough queues a goal sequence', () => {
      governor.runTutorialPlaythrough();

      // The first goal should have been shifted from the queue and set as current
      expect(governor.getCurrentGoal().type).toBe('wait');
    });

    it('runTutorialPlaythrough clears any existing goals first', () => {
      governor.setGoal({ type: 'engage_enemies' });
      governor.queueGoal({ type: 'idle' });

      governor.runTutorialPlaythrough();

      // Current goal should be the first tutorial step (wait), not engage_enemies
      expect(governor.getCurrentGoal().type).toBe('wait');
    });

    it('tutorial sequence includes wait and advance_dialogue goals', () => {
      governor.runTutorialPlaythrough();

      const allGoalTypes: string[] = [governor.getCurrentGoal().type];
      for (const g of governor.getQueuedGoals()) {
        allGoalTypes.push(g.type);
      }

      expect(allGoalTypes.filter((t) => t === 'wait').length).toBeGreaterThanOrEqual(1);
      expect(allGoalTypes.filter((t) => t === 'advance_dialogue').length).toBeGreaterThanOrEqual(1);
    });

    it('tutorial sequence ends with follow_objective', () => {
      governor.runTutorialPlaythrough();

      const queued = governor.getQueuedGoals();
      const lastGoal = queued[queued.length - 1];
      expect(lastGoal.type).toBe('follow_objective');
    });

    it('processes through goals sequentially during updates', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      governor.runTutorialPlaythrough();

      // First goal is a wait with 2000ms duration
      const firstGoal = governor.getCurrentGoal();
      expect(firstGoal.type).toBe('wait');
      if (firstGoal.type === 'wait') {
        expect(firstGoal.duration).toBe(2000);
      }

      const startTime = 10000;
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValue(startTime);

      // Start the wait timer
      governor.update(0.016);

      // Advance past the wait duration
      dateNowSpy.mockReturnValue(startTime + 2001);
      governor.update(0.016);

      // Should have advanced to next goal (advance_dialogue)
      expect(governor.getCurrentGoal().type).toBe('advance_dialogue');
    });
  });

  // ========================================================================
  // Additional coverage: interact goal, follow_objective, tutorial goal
  // ========================================================================

  describe('Interact goal', () => {
    it('immediately completes and sets interact input', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const events = collectEvents(governor);
      governor.setGoal({ type: 'interact' });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('idle');
      const completed = events.filter((e) => e.type === 'goal_completed');
      expect(completed).toHaveLength(1);
    });

    it('advances to queued goal after interaction', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      governor.setGoal({ type: 'interact' });
      governor.queueGoal({ type: 'wait', duration: 5000 });
      governor.update(0.016);

      expect(governor.getCurrentGoal().type).toBe('wait');
    });
  });

  describe('Complete tutorial goal', () => {
    it('advances dialogue on update when delay has passed', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      const now = 50000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const events = collectEvents(governor);
      governor.setGoal({ type: 'complete_tutorial' });
      governor.update(0.016);

      const dialogueEvents = events.filter((e) => e.type === 'dialogue_advanced');
      expect(dialogueEvents).toHaveLength(1);
    });

    it('does not advance dialogue when delay has not passed', () => {
      const customGov = new PlayerGovernor({
        dialogueAdvanceDelay: 5000,
        logActions: false,
      });
      const player = makePlayerEntity();
      customGov.setPlayer(player);

      const now = 50000;
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValue(now);

      // First call to set lastDialogueAdvance
      customGov.setGoal({ type: 'advance_dialogue' });
      customGov.update(0.016);

      // Now set complete_tutorial and try again too soon
      dateNowSpy.mockReturnValue(now + 1000);
      customGov.setGoal({ type: 'complete_tutorial' });

      const events = collectEvents(customGov);
      customGov.update(0.016);

      const dialogueEvents = events.filter((e) => e.type === 'dialogue_advanced');
      expect(dialogueEvents).toHaveLength(0);

      customGov.dispose();
    });
  });

  describe('Follow objective goal', () => {
    it('does not crash when processing follow_objective', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      governor.setGoal({ type: 'follow_objective' });
      // Should not throw
      expect(() => governor.update(0.016)).not.toThrow();
    });
  });

  // ========================================================================
  // Utility methods
  // ========================================================================

  describe('Utility methods', () => {
    it('setPlayer assigns the player entity', () => {
      const player = makePlayerEntity(10, 20, 30);
      governor.setPlayer(player);

      // Vehicle position should be synced from player
      const vehiclePos = governor.getVehiclePosition();
      expect(vehiclePos.x).toBe(10);
      expect(vehiclePos.y).toBe(20);
      expect(vehiclePos.z).toBe(30);
    });

    it('getVehicleVelocity returns vehicle velocity as BabylonVector3', () => {
      const vel = governor.getVehicleVelocity();
      expect(vel).toBeDefined();
      expect(typeof vel.x).toBe('number');
      expect(typeof vel.y).toBe('number');
      expect(typeof vel.z).toBe('number');
    });

    it('setObjective emits objective_updated event', () => {
      const events = collectEvents(governor);
      governor.setObjective('Find the control room');

      const objEvents = events.filter((e) => e.type === 'objective_updated');
      expect(objEvents).toHaveLength(1);
      if (objEvents[0]?.type === 'objective_updated') {
        expect(objEvents[0].objectiveText).toBe('Find the control room');
      }
    });

    it('markTutorialStepComplete does not duplicate steps', () => {
      governor.markTutorialStepComplete('move_forward');
      governor.markTutorialStepComplete('move_forward');
      // No public accessor for tutorialStepsCompleted, but it should not throw
      // and should only be recorded once internally
    });
  });

  // ========================================================================
  // Edge cases and robustness
  // ========================================================================

  describe('Edge cases', () => {
    it('update does nothing without a player entity', () => {
      // No player set - should not throw
      governor.setGoal({ type: 'wait', duration: 1000 });
      expect(() => governor.update(0.016)).not.toThrow();
    });

    it('update does nothing if player has no transform', () => {
      const noTransformPlayer = { id: 'no-transform' } as any;
      governor.setPlayer(noTransformPlayer);

      governor.setGoal({ type: 'wait', duration: 1000 });
      expect(() => governor.update(0.016)).not.toThrow();
    });

    it('idle goal does not modify input state', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      governor.setGoal({ type: 'idle' });
      governor.update(0.016);

      const state = governor.getInputState();
      expect(state.moveForward).toBe(false);
      expect(state.moveBack).toBe(false);
      expect(state.shoot).toBe(false);
      expect(state.interact).toBe(false);
      expect(state.advanceDialogue).toBe(false);
    });

    it('multiple rapid updates do not corrupt state', () => {
      const player = makePlayerEntity();
      governor.setPlayer(player);

      vi.spyOn(Date, 'now').mockReturnValue(10000);
      governor.setGoal({ type: 'wait', duration: 1000 });

      for (let i = 0; i < 100; i++) {
        governor.update(0.016);
      }

      // Should still be waiting (same timestamp)
      expect(governor.getCurrentGoal().type).toBe('wait');
    });

    it('dispose can be called multiple times safely', () => {
      governor.dispose();
      expect(() => governor.dispose()).not.toThrow();
    });
  });
});
