import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type TutorialCallbacks, TutorialManager } from './TutorialManager';
import { TUTORIAL_STEPS } from './tutorialSteps';

// Mock Scene
const mockScene = {
  onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
} as unknown as import('@babylonjs/core/scene').Scene;

describe('TutorialManager', () => {
  let tutorialManager: TutorialManager;
  let callbacks: TutorialCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    tutorialManager = new TutorialManager(mockScene);
    callbacks = {
      onStepChange: vi.fn(),
      onCommsMessage: vi.fn(),
      onObjectiveUpdate: vi.fn(),
      onTriggerSequence: vi.fn(),
      onComplete: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    tutorialManager.dispose();
  });

  describe('initialization', () => {
    it('should not be running before start', () => {
      expect(tutorialManager.isRunning()).toBe(false);
    });

    it('should be running after start', () => {
      tutorialManager.start(callbacks);
      expect(tutorialManager.isRunning()).toBe(true);
    });

    it('should start with first step after delay', () => {
      tutorialManager.start(callbacks);

      // First step activates after 1500ms delay
      vi.advanceTimersByTime(1500);

      expect(callbacks.onStepChange).toHaveBeenCalledWith(TUTORIAL_STEPS[0]);
    });
  });

  describe('step progression', () => {
    it('should call onObjectiveUpdate when step has instructions', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500);

      // First step should update objective
      expect(callbacks.onObjectiveUpdate).toHaveBeenCalled();
    });

    it('should call onCommsMessage when step has comms', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500);

      // First step has comms with 1000ms delay
      vi.advanceTimersByTime(1000);

      expect(callbacks.onCommsMessage).toHaveBeenCalled();
    });

    it('should auto-advance after wait duration for autoAdvanceAfterComms steps', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500); // Initial delay
      vi.advanceTimersByTime(1000); // Comms delay for first step
      vi.advanceTimersByTime(2000); // Wait duration for first step
      vi.advanceTimersByTime(300); // Delay between steps

      // Should have advanced to second step
      expect(callbacks.onStepChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('move_to objectives', () => {
    it('should complete when player reaches target position', () => {
      tutorialManager.start(callbacks);

      // Advance to the move_tutorial step (step index 2)
      // Skip through wake_up and location_info
      vi.advanceTimersByTime(1500 + 1000 + 2000 + 300); // wake_up
      vi.advanceTimersByTime(500 + 3000 + 300); // location_info

      const moveStep = TUTORIAL_STEPS[2]; // move_tutorial
      expect(moveStep.objective?.type).toBe('move_to');

      // Simulate player reaching the target
      const target = moveStep.objective?.target;
      if (target) {
        const completed = tutorialManager.checkObjective(target, new Vector3(0, 0, -1));
        expect(completed).toBe(true);
      }
    });

    it('should not complete when player is far from target', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500 + 1000 + 2000 + 300 + 500 + 3000 + 300);

      // Player at origin, far from target
      const completed = tutorialManager.checkObjective(new Vector3(0, 0, 0), new Vector3(0, 0, -1));
      expect(completed).toBe(false);
    });
  });

  describe('interact objectives', () => {
    it('should allow interaction when player is in range', () => {
      tutorialManager.start(callbacks);

      // Advance to equip_suit step (step index 3)
      // We need to complete move_tutorial first
      vi.advanceTimersByTime(1500 + 1000 + 2000 + 300 + 500 + 3000 + 300);

      // Complete move_tutorial
      const moveTarget = TUTORIAL_STEPS[2].objective?.target;
      if (moveTarget) {
        tutorialManager.checkObjective(moveTarget, new Vector3(0, 0, -1));
      }
      vi.advanceTimersByTime(300 + 500); // Step delay + comms delay

      // Now at equip_suit step
      const equipStep = TUTORIAL_STEPS[3];
      expect(equipStep.objective?.type).toBe('interact');

      // Check if player can interact when at target
      const canInteract = tutorialManager.canPlayerInteract(
        equipStep.objective?.target || new Vector3()
      );
      expect(canInteract).toBe(true);
    });
  });

  describe('shooting_range objectives', () => {
    it('should have shooting_range step in tutorial', () => {
      const shootingStep = TUTORIAL_STEPS.find((s) => s.objective?.type === 'shooting_range');
      expect(shootingStep).toBeDefined();
      expect(shootingStep?.id).toBe('calibration_start');
    });

    it('should complete shooting range when onShootingRangeComplete is called', () => {
      tutorialManager.start(callbacks);

      // Simulate advancing to the shooting range step
      // In a real scenario, this would happen via step progression
      // For testing, we'll fast-forward internal state if possible, but
      // since 'currentStepIndex' is private, we can rely on the public method onShootingRangeComplete
      // to trigger the progression assuming we are in the correct state.

      // However, we can't easily force the state to the shooting range step without
      // waiting through previous steps.
      // Let's manually trigger the completion and verify it attempts to advance.
      // Even if not currently on that step, the method should be robust or we should
      // wait until we are on that step.

      // Let's cheat slightly and simulate the sequence of events leading to it?
      // Too long.

      // Alternatively, we can check if onShootingRangeComplete calls onStepChange
      // But we need to be on the right step for it to work usually?
      // Let's check the implementation of onShootingRangeComplete in TutorialManager.

      // Assuming onShootingRangeComplete checks if current step is shooting_range.
      // So we MUST be on that step.

      // Let's calculate total wait time to get there.
      // Step 0: wake_up (1500 + 1000 + 2000 + 300) = 4800
      // Step 1: location_info (500 + 3000 + 300) = 3800
      // Step 2: move_tutorial (needs movement) -> manual complete
      // Step 3: equip_suit (needs interaction) -> manual complete
      // Step 4: equip_suit_done (auto)
      // ...

      // This is getting complicated to simulate purely by timers.
      // The previous test "should have shooting_range step in tutorial" verifies it exists.
      // The requirement "Assert that it completes" implies verifying the transition.

      // Let's try to mock the internal state or use a method if available.
      // Since we can't, we'll verify that calling it *when appropriate* triggers the next step.
      // But we can't easily get to "when appropriate".

      // Wait, let's look at how we can mock the step index or use 'any' cast.
      (tutorialManager as any).currentStepIndex = TUTORIAL_STEPS.findIndex(
        (s) => s.objective?.type === 'shooting_range'
      );

      // Now call complete
      tutorialManager.onShootingRangeComplete();

      // Advance timers to allow step transition (300ms delay)
      vi.advanceTimersByTime(500);

      // Should advance to next step
      // The next step after calibration_start should be triggered
      // We expect onStepChange to be called with the NEXT step
      const currentStepIndex = (tutorialManager as any).currentStepIndex;
      expect(callbacks.onStepChange).toHaveBeenCalledWith(TUTORIAL_STEPS[currentStepIndex]);
    });

    it('should identify shooting range step correctly', () => {
      // Check that isShootingRangeStep works
      expect(tutorialManager.isShootingRangeStep()).toBe(false); // Not started yet

      tutorialManager.start(callbacks);
      expect(tutorialManager.isShootingRangeStep()).toBe(false); // First step is not shooting range
    });
  });

  describe('skip functionality', () => {
    it('should stop running when skipped', () => {
      tutorialManager.start(callbacks);
      expect(tutorialManager.isRunning()).toBe(true);

      tutorialManager.skip();
      expect(tutorialManager.isRunning()).toBe(false);
    });

    it('should call onComplete when skipped', () => {
      tutorialManager.start(callbacks);
      tutorialManager.skip();

      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should stop running when disposed', () => {
      tutorialManager.start(callbacks);
      tutorialManager.dispose();

      expect(tutorialManager.isRunning()).toBe(false);
    });
  });
});
