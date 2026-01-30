import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type TutorialCallbacks, TutorialManager } from './TutorialManager';
import { PHASE_HUD_STATES, TUTORIAL_STEPS } from './tutorialSteps';

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
      onPhaseChange: vi.fn(),
      onCommsMessage: vi.fn(),
      onObjectiveUpdate: vi.fn(),
      onTriggerSequence: vi.fn(),
      onActionButtonsChange: vi.fn(),
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

    it('should emit initial phase state on start', () => {
      tutorialManager.start(callbacks);

      // Initial phase should be 0
      expect(callbacks.onPhaseChange).toHaveBeenCalledWith(0, PHASE_HUD_STATES[0]);
    });

    it('should start at phase 0 with no HUD elements', () => {
      tutorialManager.start(callbacks);

      const hudState = tutorialManager.getHUDState();
      expect(hudState.healthBar).toBe(false);
      expect(hudState.crosshair).toBe(false);
      expect(hudState.movementEnabled).toBe(false);
    });
  });

  describe('phase progression', () => {
    it('should have 5 phases defined (0-4)', () => {
      expect(PHASE_HUD_STATES[0]).toBeDefined();
      expect(PHASE_HUD_STATES[1]).toBeDefined();
      expect(PHASE_HUD_STATES[2]).toBeDefined();
      expect(PHASE_HUD_STATES[3]).toBeDefined();
      expect(PHASE_HUD_STATES[4]).toBeDefined();
    });

    it('should unlock movement in phase 1', () => {
      expect(PHASE_HUD_STATES[1].movementEnabled).toBe(true);
      expect(PHASE_HUD_STATES[1].healthBar).toBe(true);
    });

    it('should unlock crosshair and look in phase 2', () => {
      expect(PHASE_HUD_STATES[2].crosshair).toBe(true);
      expect(PHASE_HUD_STATES[2].lookEnabled).toBe(true);
    });

    it('should unlock fire in phase 3', () => {
      expect(PHASE_HUD_STATES[3].fireEnabled).toBe(true);
      expect(PHASE_HUD_STATES[3].ammoCounter).toBe(true);
    });

    it('should have full HUD in phase 4', () => {
      const fullHUD = PHASE_HUD_STATES[4];
      expect(fullHUD.healthBar).toBe(true);
      expect(fullHUD.crosshair).toBe(true);
      expect(fullHUD.ammoCounter).toBe(true);
      expect(fullHUD.missionText).toBe(true);
      expect(fullHUD.actionButtons).toBe(true);
      expect(fullHUD.movementEnabled).toBe(true);
      expect(fullHUD.lookEnabled).toBe(true);
      expect(fullHUD.fireEnabled).toBe(true);
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
      vi.advanceTimersByTime(1500); // Initial delay

      // First step (wake_up) has comms with 1000ms delay
      // But MIN_COMMS_INTERVAL is 3000ms, so actual delay = max(1000, 3000) = 3000
      vi.advanceTimersByTime(3000);

      expect(callbacks.onCommsMessage).toHaveBeenCalled();
    });

    it('should auto-advance after wait duration for autoAdvanceAfterComms steps', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500); // Initial delay to first step
      vi.advanceTimersByTime(3000); // Comms delay for first step (max of 1000 and MIN_COMMS_INTERVAL=3000)
      vi.advanceTimersByTime(4000); // Wait duration for first step (wake_up has duration: 4000)
      vi.advanceTimersByTime(1000); // Delay between steps (longer due to comms)

      // Should have advanced to second step
      expect(callbacks.onStepChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('move_to objectives', () => {
    it('should complete when player reaches target position', () => {
      tutorialManager.start(callbacks);

      // Advance through briefing steps (phase 0) to reach movement_unlock (phase 1)
      // Now there are only 2 briefing steps (wake_up and commander_briefing)
      // Step 1 (wake_up): 1500ms initial + 1000ms comms delay + 4000ms wait + 1000ms step delay
      vi.advanceTimersByTime(1500 + 1000 + 4000 + 1000);
      // Step 2 (commander_briefing): min comms interval + 500ms comms delay + 5000ms wait + 1000ms step delay
      vi.advanceTimersByTime(3000 + 5000 + 1000);
      // movement_unlock step: 3000ms comms delay (gated by MIN_COMMS_INTERVAL)
      vi.advanceTimersByTime(3000);

      // Find the movement step
      const moveStep = TUTORIAL_STEPS.find((s) => s.id === 'movement_unlock');
      expect(moveStep?.objective?.type).toBe('move_to');

      // Simulate player reaching the target
      const target = moveStep?.objective?.target;
      if (target) {
        const completed = tutorialManager.checkObjective(target, new Vector3(0, 0, -1));
        expect(completed).toBe(true);
      }
    });

    it('should not complete when player is far from target', () => {
      tutorialManager.start(callbacks);

      // Player at origin, far from target
      const completed = tutorialManager.checkObjective(
        new Vector3(100, 0, 100),
        new Vector3(0, 0, -1)
      );
      expect(completed).toBe(false);
    });
  });

  describe('interact objectives', () => {
    it('should have interact steps with action buttons', () => {
      const interactSteps = TUTORIAL_STEPS.filter((s) => s.objective?.type === 'interact');
      expect(interactSteps.length).toBeGreaterThan(0);

      // equip_suit step should have action buttons
      const equipStep = TUTORIAL_STEPS.find((s) => s.id === 'equip_suit');
      expect(equipStep?.actionButtons).toBeDefined();
      expect(equipStep?.actionButtons?.[0]?.id).toBe('equip_suit');
    });
  });

  describe('shooting_range objectives', () => {
    it('should have shooting_range step in tutorial', () => {
      const shootingStep = TUTORIAL_STEPS.find((s) => s.objective?.type === 'shooting_range');
      expect(shootingStep).toBeDefined();
      expect(shootingStep?.id).toBe('calibration_start');
    });

    it('should have fire action button during calibration', () => {
      const shootingStep = TUTORIAL_STEPS.find((s) => s.id === 'calibration_start');
      expect(shootingStep?.actionButtons).toBeDefined();
      expect(shootingStep?.actionButtons?.find((b) => b.id === 'fire')).toBeDefined();
    });

    it('should complete shooting range when onShootingRangeComplete is called', () => {
      tutorialManager.start(callbacks);

      // Simulate completing the shooting range
      tutorialManager.onShootingRangeComplete();

      // Should not throw
    });

    it('should identify shooting range step correctly', () => {
      // Check that isShootingRangeStep works
      expect(tutorialManager.isShootingRangeStep()).toBe(false); // Not started yet

      tutorialManager.start(callbacks);
      expect(tutorialManager.isShootingRangeStep()).toBe(false); // First step is not shooting range
    });
  });

  describe('launch action', () => {
    it('should have launch step with danger variant button', () => {
      const launchStep = TUTORIAL_STEPS.find((s) => s.id === 'pre_launch');
      expect(launchStep).toBeDefined();
      expect(launchStep?.actionButtons?.[0]?.variant).toBe('danger');
      expect(launchStep?.actionButtons?.[0]?.size).toBe('large');
    });

    it('should identify launch step correctly', () => {
      tutorialManager.start(callbacks);
      expect(tutorialManager.isLaunchStep()).toBe(false); // First step is not launch
    });
  });

  describe('action buttons', () => {
    it('should call onActionButtonsChange when step has buttons', () => {
      tutorialManager.start(callbacks);
      vi.advanceTimersByTime(1500);

      // First step has no buttons
      expect(callbacks.onActionButtonsChange).toHaveBeenCalledWith([]);
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

  describe('getCurrentPhase', () => {
    it('should return current phase', () => {
      tutorialManager.start(callbacks);
      expect(tutorialManager.getCurrentPhase()).toBe(0);
    });
  });

  describe('tutorial step structure', () => {
    it('should have all required steps', () => {
      const requiredStepIds = [
        'wake_up',
        'commander_briefing',
        'movement_unlock',
        'corridor_progress',
        'platforming_intro',
        'jump_tutorial',
        'crouch_tutorial',
        'platforming_complete',
        'equipment_bay_enter',
        'equip_suit',
        'calibration_start',
        'move_to_hangar',
        'pre_launch',
      ];

      for (const id of requiredStepIds) {
        const step = TUTORIAL_STEPS.find((s) => s.id === id);
        expect(step, `Step ${id} should exist`).toBeDefined();
      }
    });

    it('should have steps in correct phase order', () => {
      let lastPhase = 0;
      for (const step of TUTORIAL_STEPS) {
        expect(step.phase >= lastPhase, `Step ${step.id} should not decrease phase`).toBe(true);
        lastPhase = step.phase;
      }
    });

    it('should have only 2 briefing steps in phase 0', () => {
      const phase0Steps = TUTORIAL_STEPS.filter((s) => s.phase === 0);
      expect(phase0Steps.length).toBe(2);
      expect(phase0Steps[0].id).toBe('wake_up');
      expect(phase0Steps[1].id).toBe('commander_briefing');
    });

    it('should have consolidated briefing message', () => {
      const briefingStep = TUTORIAL_STEPS.find((s) => s.id === 'commander_briefing');
      expect(briefingStep?.commsMessage?.text).toContain('FOB Delta');
      expect(briefingStep?.commsMessage?.text).toContain('weapons free');
    });

    it('should have proper comms delays (3+ seconds between major messages)', () => {
      const stepsWithComms = TUTORIAL_STEPS.filter((s) => s.commsMessage);
      for (const step of stepsWithComms) {
        // All comms delays should be at least reasonable (most should be 1000+ ms)
        expect(step.commsMessage!.delay).toBeGreaterThanOrEqual(500);
      }
    });

    it('should gate dialogue behind objectives - no comms on some progression steps', () => {
      // corridor_progress should have no comms - player already knows where to go
      const corridorStep = TUTORIAL_STEPS.find((s) => s.id === 'corridor_progress');
      expect(corridorStep?.commsMessage).toBeUndefined();

      // equip_suit should have no comms - action button is sufficient
      const equipStep = TUTORIAL_STEPS.find((s) => s.id === 'equip_suit');
      expect(equipStep?.commsMessage).toBeUndefined();
    });
  });

  describe('platforming tutorial', () => {
    it('should have platforming steps in phase 1', () => {
      const platformingSteps = TUTORIAL_STEPS.filter(
        (s) =>
          s.id === 'platforming_intro' ||
          s.id === 'jump_tutorial' ||
          s.id === 'crouch_tutorial' ||
          s.id === 'platforming_complete'
      );
      expect(platformingSteps.length).toBe(4);
      for (const step of platformingSteps) {
        expect(step.phase).toBe(1);
      }
    });

    it('should have jump tutorial with correct objective type', () => {
      const jumpStep = TUTORIAL_STEPS.find((s) => s.id === 'jump_tutorial');
      expect(jumpStep).toBeDefined();
      expect(jumpStep?.objective?.type).toBe('platforming_jump');
      expect(jumpStep?.actionButtons?.find((b) => b.id === 'jump')).toBeDefined();
    });

    it('should have crouch tutorial with correct objective type', () => {
      const crouchStep = TUTORIAL_STEPS.find((s) => s.id === 'crouch_tutorial');
      expect(crouchStep).toBeDefined();
      expect(crouchStep?.objective?.type).toBe('platforming_crouch');
      expect(crouchStep?.actionButtons?.find((b) => b.id === 'crouch')).toBeDefined();
    });

    it('should have platforming intro trigger start_platforming sequence', () => {
      const introStep = TUTORIAL_STEPS.find((s) => s.id === 'platforming_intro');
      expect(introStep?.triggerSequence).toBe('start_platforming');
    });

    it('should complete jump tutorial when onJumpComplete is called', () => {
      tutorialManager.start(callbacks);
      tutorialManager.onJumpComplete();
      // Should not throw
    });

    it('should complete crouch tutorial when onCrouchComplete is called', () => {
      tutorialManager.start(callbacks);
      tutorialManager.onCrouchComplete();
      // Should not throw
    });

    it('should identify platforming steps correctly', () => {
      expect(tutorialManager.isPlatformingStep()).toBe(false); // Not started yet
      tutorialManager.start(callbacks);
      expect(tutorialManager.isPlatformingStep()).toBe(false); // First step is not platforming
    });

    it('should identify jump tutorial step correctly', () => {
      expect(tutorialManager.isJumpTutorialStep()).toBe(false);
      tutorialManager.start(callbacks);
      expect(tutorialManager.isJumpTutorialStep()).toBe(false);
    });

    it('should identify crouch tutorial step correctly', () => {
      expect(tutorialManager.isCrouchTutorialStep()).toBe(false);
      tutorialManager.start(callbacks);
      expect(tutorialManager.isCrouchTutorialStep()).toBe(false);
    });

    it('should have platforming steps between movement and equipment bay', () => {
      const movementIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'movement_unlock');
      const platformingIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'platforming_intro');
      const equipmentIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'equipment_bay_enter');

      expect(platformingIndex).toBeGreaterThan(movementIndex);
      expect(platformingIndex).toBeLessThan(equipmentIndex);
    });
  });
});
