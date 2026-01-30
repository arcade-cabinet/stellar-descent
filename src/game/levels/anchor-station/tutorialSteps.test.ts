import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from './tutorialSteps';

describe('Tutorial Steps Configuration', () => {
  describe('step structure', () => {
    it('should have all required fields for each step', () => {
      TUTORIAL_STEPS.forEach((step, index) => {
        expect(step.id, `Step ${index} missing id`).toBeDefined();
        expect(step.title, `Step ${index} missing title`).toBeDefined();
        expect(typeof step.instructions, `Step ${index} instructions should be string`).toBe(
          'string'
        );
      });
    });

    it('should have unique ids for all steps', () => {
      const ids = TUTORIAL_STEPS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('objective types', () => {
    it('should only use valid objective types', () => {
      const validTypes = ['move_to', 'interact', 'look_at', 'wait', 'shooting_range'];

      TUTORIAL_STEPS.forEach((step) => {
        if (step.objective) {
          expect(validTypes).toContain(step.objective.type);
        }
      });
    });

    it('move_to objectives should have target and radius', () => {
      const moveSteps = TUTORIAL_STEPS.filter((s) => s.objective?.type === 'move_to');

      moveSteps.forEach((step) => {
        expect(step.objective?.target, `${step.id} missing target`).toBeDefined();
        expect(step.objective?.radius, `${step.id} missing radius`).toBeDefined();
      });
    });

    it('interact objectives should have target', () => {
      const interactSteps = TUTORIAL_STEPS.filter((s) => s.objective?.type === 'interact');

      interactSteps.forEach((step) => {
        expect(step.objective?.target, `${step.id} missing target`).toBeDefined();
      });
    });

    it('wait objectives should have duration or be autoAdvance', () => {
      const waitSteps = TUTORIAL_STEPS.filter((s) => s.objective?.type === 'wait');

      waitSteps.forEach((step) => {
        const hasDuration = step.objective?.duration !== undefined;
        const isAutoAdvance = step.autoAdvanceAfterComms === true;
        expect(
          hasDuration || isAutoAdvance,
          `${step.id} wait step needs duration or autoAdvance`
        ).toBe(true);
      });
    });
  });

  describe('comms messages', () => {
    it('should have valid portrait types', () => {
      const validPortraits = ['commander', 'ai', 'marcus', 'armory'];

      TUTORIAL_STEPS.forEach((step) => {
        if (step.commsMessage) {
          expect(validPortraits, `${step.id} has invalid portrait`).toContain(
            step.commsMessage.portrait
          );
        }
      });
    });

    it('should have sender and callsign for all comms', () => {
      TUTORIAL_STEPS.forEach((step) => {
        if (step.commsMessage) {
          expect(step.commsMessage.sender, `${step.id} missing sender`).toBeDefined();
          expect(step.commsMessage.callsign, `${step.id} missing callsign`).toBeDefined();
          expect(step.commsMessage.text, `${step.id} missing text`).toBeDefined();
        }
      });
    });
  });

  describe('trigger sequences', () => {
    it('should only use valid trigger sequences', () => {
      const validSequences = [
        'equip_suit',
        'depressurize',
        'open_bay_doors',
        'enter_pod',
        'launch',
        'start_calibration',
      ];

      TUTORIAL_STEPS.forEach((step) => {
        if (step.triggerSequence) {
          expect(validSequences, `${step.id} has invalid trigger sequence`).toContain(
            step.triggerSequence
          );
        }
      });
    });
  });

  describe('shooting range flow', () => {
    it('should have armory master intro before shooting range', () => {
      const shootingIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'calibration_start');
      const armoryIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'armory_master_intro');

      expect(armoryIndex).toBeLessThan(shootingIndex);
    });

    it('should have move_to_range step before calibration', () => {
      const shootingIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'calibration_start');
      const moveIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'move_to_range');

      expect(moveIndex).toBeLessThan(shootingIndex);
      expect(moveIndex).toBe(shootingIndex - 1);
    });

    it('should have calibration_complete after calibration_start', () => {
      const startIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'calibration_start');
      const completeIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'calibration_complete');

      expect(completeIndex).toBe(startIndex + 1);
    });

    it('calibration_start should trigger start_calibration sequence', () => {
      const calibrationStep = TUTORIAL_STEPS.find((s) => s.id === 'calibration_start');

      expect(calibrationStep?.triggerSequence).toBe('start_calibration');
      expect(calibrationStep?.objective?.type).toBe('shooting_range');
    });
  });

  describe('tutorial flow order', () => {
    it('should start with wake_up sequence', () => {
      expect(TUTORIAL_STEPS[0].id).toBe('wake_up');
    });

    it('should have equipment before weapons calibration', () => {
      const equipIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'equip_suit');
      const calibrationIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'calibration_start');

      expect(equipIndex).toBeLessThan(calibrationIndex);
    });

    it('should have commander briefing after calibration', () => {
      const calibrationCompleteIndex = TUTORIAL_STEPS.findIndex(
        (s) => s.id === 'calibration_complete'
      );
      const commanderIndex = TUTORIAL_STEPS.findIndex((s) => s.id === 'commander_intro');

      expect(commanderIndex).toBe(calibrationCompleteIndex + 1);
    });

    it('should end with launch sequence', () => {
      const lastStep = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
      expect(lastStep.id).toBe('launch');
      expect(lastStep.triggerSequence).toBe('launch');
    });
  });

  describe('armory character', () => {
    it('should have armory portrait for Gunnery Sgt messages', () => {
      const armorySteps = TUTORIAL_STEPS.filter((s) =>
        s.commsMessage?.sender.includes('Gunnery Sgt')
      );

      expect(armorySteps.length).toBeGreaterThan(0);

      armorySteps.forEach((step) => {
        expect(step.commsMessage?.portrait).toBe('armory');
        expect(step.commsMessage?.callsign).toBe('ARMORY');
      });
    });

    it('should have appropriate military dialogue', () => {
      const armorySteps = TUTORIAL_STEPS.filter((s) => s.commsMessage?.portrait === 'armory');

      // Check that dialogue exists and is not empty
      armorySteps.forEach((step) => {
        expect(step.commsMessage?.text.length).toBeGreaterThan(10);
      });
    });
  });
});
