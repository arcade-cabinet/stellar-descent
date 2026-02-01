/**
 * ExtractionLevel - Communications Tests
 *
 * Unit tests for all radio communications and dialogue.
 * Target: 95%+ line coverage
 */

import { describe, expect, it } from 'vitest';

import {
  AIRBORNE_COMMS,
  BOARD_NOW_COMMS,
  BOARDING_SEQUENCE_COMMS,
  CLOSE_CALL_COMMS,
  COLLAPSE_FAILURE_COMMS,
  COLLAPSE_PROGRESSION_SEQUENCE,
  COLLAPSE_START_SEQUENCE,
  COMMANDER_DEBRIEF_COMMS,
  COMMANDER_VICTORY_COMMS,
  DISTANCE_COMMS,
  DROPSHIP_APPROACH_COMMS,
  DROPSHIP_DETECTION_COMMS,
  DROPSHIP_HOVER_COMMS,
  ESCAPE_START_COMMS,
  getAthenaDebrief,
  HOLDOUT_START_COMMS,
  MARCUS_FINAL_COMMS,
  MARCUS_SEES_DROPSHIP_COMMS,
  MECH_COLLAPSE_COMMS,
  SIGNAL_FLARE_COMMS,
  SUPPLY_DROP_COMMS,
  SURFACE_REACHED_COMMS,
  WAVE_COMPLETE_COMMS,
} from './comms';

describe('Communications Module', () => {
  describe('Escape Phase Comms', () => {
    describe('ESCAPE_START_COMMS', () => {
      it('should have correct sender and callsign', () => {
        expect(ESCAPE_START_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(ESCAPE_START_COMMS.callsign).toBe('TITAN');
        expect(ESCAPE_START_COMMS.portrait).toBe('marcus');
      });

      it('should contain relevant escape message', () => {
        expect(ESCAPE_START_COMMS.text).toContain('coming down');
        expect(ESCAPE_START_COMMS.text).toContain('RUN');
        expect(ESCAPE_START_COMMS.text).toContain('LZ Omega');
      });
    });

    describe('SURFACE_REACHED_COMMS', () => {
      it('should have correct sender', () => {
        expect(SURFACE_REACHED_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(SURFACE_REACHED_COMMS.callsign).toBe('TITAN');
      });

      it('should mention reaching position', () => {
        expect(SURFACE_REACHED_COMMS.text).toContain('see you');
        expect(SURFACE_REACHED_COMMS.text).toContain('my position');
      });
    });
  });

  describe('Holdout Phase Comms', () => {
    describe('HOLDOUT_START_COMMS', () => {
      it('should have AI sender', () => {
        expect(HOLDOUT_START_COMMS.sender).toBe('PROMETHEUS A.I.');
        expect(HOLDOUT_START_COMMS.callsign).toBe('ATHENA');
        expect(HOLDOUT_START_COMMS.portrait).toBe('ai');
      });

      it('should contain dropship ETA', () => {
        expect(HOLDOUT_START_COMMS.text).toContain('ETA');
        expect(HOLDOUT_START_COMMS.text).toContain('SALVATION');
      });
    });

    describe('WAVE_COMPLETE_COMMS', () => {
      it('should have wave 2 comms from Marcus', () => {
        const wave2 = WAVE_COMPLETE_COMMS[2];
        expect(wave2).toBeDefined();
        expect(wave2.sender).toBe('Corporal Marcus Cole');
        expect(wave2.text).toContain('kills');
      });

      it('should have wave 4 comms from AI', () => {
        const wave4 = WAVE_COMPLETE_COMMS[4];
        expect(wave4).toBeDefined();
        expect(wave4.sender).toBe('PROMETHEUS A.I.');
        expect(wave4.text).toContain('ammunition');
      });

      it('should have wave 5 progress update', () => {
        const wave5 = WAVE_COMPLETE_COMMS[5];
        expect(wave5).toBeDefined();
        expect(wave5.text).toContain('halfway');
      });

      it('should have wave 6 final warning', () => {
        const wave6 = WAVE_COMPLETE_COMMS[6];
        expect(wave6).toBeDefined();
        expect(wave6.text).toContain('Seismic');
        expect(wave6.text).toContain('90 seconds');
      });
    });

    describe('SUPPLY_DROP_COMMS', () => {
      it('should have AI sender', () => {
        expect(SUPPLY_DROP_COMMS.sender).toBe('PROMETHEUS A.I.');
        expect(SUPPLY_DROP_COMMS.portrait).toBe('ai');
      });

      it('should mention resupply', () => {
        expect(SUPPLY_DROP_COMMS.text).toContain('Supply');
        expect(SUPPLY_DROP_COMMS.text).toContain('Resupply');
      });
    });

    describe('SIGNAL_FLARE_COMMS', () => {
      it('should confirm signal received', () => {
        expect(SIGNAL_FLARE_COMMS.text).toContain('Signal received');
        expect(SIGNAL_FLARE_COMMS.text).toContain('SALVATION');
      });
    });
  });

  describe('Collapse Phase Comms', () => {
    describe('COLLAPSE_START_SEQUENCE', () => {
      it('should have 3 messages in sequence', () => {
        expect(COLLAPSE_START_SEQUENCE.length).toBe(3);
      });

      it('should have increasing delays', () => {
        const delays = COLLAPSE_START_SEQUENCE.map((s) => s.delay);
        expect(delays[0]).toBeLessThan(delays[1]);
        expect(delays[1]).toBeLessThan(delays[2]);
      });

      it('should start with commander message', () => {
        const first = COLLAPSE_START_SEQUENCE[0];
        expect(first.message.sender).toBe('Commander Elena Vasquez');
        expect(first.message.callsign).toBe('PROMETHEUS ACTUAL');
        expect(first.message.text).toContain('90 seconds');
      });

      it('should include AI warning', () => {
        const second = COLLAPSE_START_SEQUENCE[1];
        expect(second.message.sender).toBe('PROMETHEUS A.I.');
        expect(second.message.text).toContain('CRITICAL');
      });

      it('should end with Marcus encouragement', () => {
        const third = COLLAPSE_START_SEQUENCE[2];
        expect(third.message.sender).toBe('Corporal Marcus Cole');
        expect(third.message.text).toContain('cover you');
      });
    });

    describe('COLLAPSE_PROGRESSION_SEQUENCE', () => {
      it('should have 4 messages', () => {
        expect(COLLAPSE_PROGRESSION_SEQUENCE.length).toBe(4);
      });

      it('should have messages with longer delays', () => {
        expect(COLLAPSE_PROGRESSION_SEQUENCE[0].delay).toBe(35000);
        expect(COLLAPSE_PROGRESSION_SEQUENCE[1].delay).toBe(50000);
        expect(COLLAPSE_PROGRESSION_SEQUENCE[2].delay).toBe(70000);
        expect(COLLAPSE_PROGRESSION_SEQUENCE[3].delay).toBe(80000);
      });

      it('should include pilot message', () => {
        const pilotMsg = COLLAPSE_PROGRESSION_SEQUENCE.find(
          (s) => s.message.callsign === 'SALVATION'
        );
        expect(pilotMsg).toBeDefined();
        expect(pilotMsg?.message.text).toContain("can't hold");
      });
    });

    describe('CLOSE_CALL_COMMS', () => {
      it('should have closeCall1 from Marcus', () => {
        const msg = CLOSE_CALL_COMMS.closeCall1;
        expect(msg.sender).toBe('Corporal Marcus Cole');
        expect(msg.text).toContain('debris');
      });

      it('should have closeCall2 from Commander', () => {
        const msg = CLOSE_CALL_COMMS.closeCall2;
        expect(msg.sender).toBe('Commander Elena Vasquez');
        expect(msg.text).toContain('keep moving');
      });
    });

    describe('DISTANCE_COMMS', () => {
      it('should have almost message from pilot', () => {
        const msg = DISTANCE_COMMS.almost;
        expect(msg.callsign).toBe('SALVATION');
        expect(msg.text).toContain('can see you');
      });

      it('should have soClose message from Marcus', () => {
        const msg = DISTANCE_COMMS.soClose;
        expect(msg.sender).toBe('Corporal Marcus Cole');
        expect(msg.text).toContain('almost there');
      });

      it('should have lowHealth message from AI', () => {
        const msg = DISTANCE_COMMS.lowHealth;
        expect(msg.sender).toBe('PROMETHEUS A.I.');
        expect(msg.text).toContain('integrity critical');
        expect(msg.text).toContain('Medical');
      });
    });

    describe('COLLAPSE_FAILURE_COMMS', () => {
      it('should have Marcus rescue message', () => {
        expect(COLLAPSE_FAILURE_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(COLLAPSE_FAILURE_COMMS.text).toContain('coming for you');
      });
    });
  });

  describe('Victory Phase Comms', () => {
    describe('DROPSHIP_DETECTION_COMMS', () => {
      it('should have AI sender', () => {
        expect(DROPSHIP_DETECTION_COMMS.sender).toBe('PROMETHEUS A.I.');
        expect(DROPSHIP_DETECTION_COMMS.text).toContain('friendly transponder');
        expect(DROPSHIP_DETECTION_COMMS.text).toContain('30 seconds');
      });
    });

    describe('COMMANDER_VICTORY_COMMS', () => {
      it('should have commander congratulations', () => {
        expect(COMMANDER_VICTORY_COMMS.sender).toBe('Commander Elena Vasquez');
        expect(COMMANDER_VICTORY_COMMS.text).toContain('did it');
        expect(COMMANDER_VICTORY_COMMS.text).toContain('Queen is dead');
      });
    });

    describe('DROPSHIP_APPROACH_COMMS', () => {
      it('should have pilot message', () => {
        expect(DROPSHIP_APPROACH_COMMS.callsign).toBe('SALVATION');
        expect(DROPSHIP_APPROACH_COMMS.text).toContain('final approach');
        expect(DROPSHIP_APPROACH_COMMS.text).toContain('25 seconds');
      });
    });

    describe('MARCUS_SEES_DROPSHIP_COMMS', () => {
      it('should have Marcus excitement', () => {
        expect(MARCUS_SEES_DROPSHIP_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(MARCUS_SEES_DROPSHIP_COMMS.text).toContain('beautiful');
        expect(MARCUS_SEES_DROPSHIP_COMMS.text).toContain('going home');
      });
    });

    describe('DROPSHIP_HOVER_COMMS', () => {
      it('should have pilot clearing message', () => {
        expect(DROPSHIP_HOVER_COMMS.callsign).toBe('SALVATION');
        expect(DROPSHIP_HOVER_COMMS.text).toContain('landing sequence');
      });
    });

    describe('MECH_COLLAPSE_COMMS', () => {
      it('should have Marcus mech status', () => {
        expect(MECH_COLLAPSE_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(MECH_COLLAPSE_COMMS.text).toContain('reactor');
        expect(MECH_COLLAPSE_COMMS.text).toContain('depleted');
        expect(MECH_COLLAPSE_COMMS.text).toContain('made it');
      });
    });

    describe('BOARD_NOW_COMMS', () => {
      it('should have pilot urgent boarding message', () => {
        expect(BOARD_NOW_COMMS.callsign).toBe('SALVATION');
        expect(BOARD_NOW_COMMS.text).toContain('Ramp is down');
        expect(BOARD_NOW_COMMS.text).toContain('leaving');
      });
    });

    describe('BOARDING_SEQUENCE_COMMS', () => {
      it('should have 2 messages in sequence', () => {
        expect(BOARDING_SEQUENCE_COMMS.length).toBe(2);
      });

      it('should start with player message', () => {
        const first = BOARDING_SEQUENCE_COMMS[0];
        expect(first.delay).toBe(0);
        expect(first.message.callsign).toBe('SPECTER');
        expect(first.message.portrait).toBe('player');
        expect(first.message.text).toContain('go home');
      });

      it('should have Marcus response', () => {
        const second = BOARDING_SEQUENCE_COMMS[1];
        expect(second.delay).toBe(3000);
        expect(second.message.sender).toBe('Corporal Marcus Cole');
        expect(second.message.text).toContain('Right behind you');
      });
    });
  });

  describe('Epilogue Comms', () => {
    describe('AIRBORNE_COMMS', () => {
      it('should have pilot airborne message', () => {
        expect(AIRBORNE_COMMS.callsign).toBe('SALVATION');
        expect(AIRBORNE_COMMS.text).toContain('airborne');
        expect(AIRBORNE_COMMS.text).toContain('Good work');
      });
    });

    describe('COMMANDER_DEBRIEF_COMMS', () => {
      it('should have commander debrief', () => {
        expect(COMMANDER_DEBRIEF_COMMS.sender).toBe('Commander Elena Vasquez');
        expect(COMMANDER_DEBRIEF_COMMS.text).toContain('Welcome home');
        expect(COMMANDER_DEBRIEF_COMMS.text).toContain('Queen is dead');
        expect(COMMANDER_DEBRIEF_COMMS.text).toContain("Kepler's Promise");
      });
    });

    describe('getAthenaDebrief', () => {
      it('should include kill count in message', () => {
        const debrief = getAthenaDebrief(42);
        expect(debrief.sender).toBe('PROMETHEUS A.I.');
        expect(debrief.callsign).toBe('ATHENA');
        expect(debrief.portrait).toBe('ai');
        expect(debrief.text).toContain('42');
        expect(debrief.text).toContain('Hostiles eliminated');
      });

      it('should include directive', () => {
        const debrief = getAthenaDebrief(0);
        expect(debrief.text).toContain('Find them');
        expect(debrief.text).toContain('Bring them home');
      });

      it('should include casualty report', () => {
        const debrief = getAthenaDebrief(100);
        expect(debrief.text).toContain('Casualties: Zero');
        expect(debrief.text).toContain('Brothers reunited');
      });
    });

    describe('MARCUS_FINAL_COMMS', () => {
      it('should have Marcus thank you message', () => {
        expect(MARCUS_FINAL_COMMS.sender).toBe('Corporal Marcus Cole');
        expect(MARCUS_FINAL_COMMS.text).toContain('Thanks');
        expect(MARCUS_FINAL_COMMS.text).toContain('coming for me');
        expect(MARCUS_FINAL_COMMS.text).toContain('knew you would');
      });
    });
  });

  describe('Message Structure Validation', () => {
    const allMessages = [
      ESCAPE_START_COMMS,
      SURFACE_REACHED_COMMS,
      HOLDOUT_START_COMMS,
      SUPPLY_DROP_COMMS,
      SIGNAL_FLARE_COMMS,
      COLLAPSE_FAILURE_COMMS,
      DROPSHIP_DETECTION_COMMS,
      COMMANDER_VICTORY_COMMS,
      DROPSHIP_APPROACH_COMMS,
      MARCUS_SEES_DROPSHIP_COMMS,
      DROPSHIP_HOVER_COMMS,
      MECH_COLLAPSE_COMMS,
      BOARD_NOW_COMMS,
      AIRBORNE_COMMS,
      COMMANDER_DEBRIEF_COMMS,
      MARCUS_FINAL_COMMS,
      ...Object.values(WAVE_COMPLETE_COMMS),
      ...Object.values(CLOSE_CALL_COMMS),
      ...Object.values(DISTANCE_COMMS),
      ...COLLAPSE_START_SEQUENCE.map((s) => s.message),
      ...COLLAPSE_PROGRESSION_SEQUENCE.map((s) => s.message),
      ...BOARDING_SEQUENCE_COMMS.map((s) => s.message),
    ];

    it('should have valid sender for all messages', () => {
      for (const msg of allMessages) {
        expect(msg.sender).toBeDefined();
        expect(typeof msg.sender).toBe('string');
        expect(msg.sender.length).toBeGreaterThan(0);
      }
    });

    it('should have valid callsign for all messages', () => {
      for (const msg of allMessages) {
        expect(msg.callsign).toBeDefined();
        expect(typeof msg.callsign).toBe('string');
        expect(msg.callsign.length).toBeGreaterThan(0);
      }
    });

    it('should have valid portrait for all messages', () => {
      const validPortraits = ['commander', 'ai', 'marcus', 'armory', 'player'];
      for (const msg of allMessages) {
        expect(msg.portrait).toBeDefined();
        expect(validPortraits).toContain(msg.portrait);
      }
    });

    it('should have valid text for all messages', () => {
      for (const msg of allMessages) {
        expect(msg.text).toBeDefined();
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThan(0);
      }
    });
  });
});
