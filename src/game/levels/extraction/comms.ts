/**
 * ExtractionLevel - Communications/Dialogue
 *
 * Contains all radio communications and dialogue for the extraction level.
 * Organized by phase for easy reference and modification.
 */

import type { CommsMessage } from './types';
import { LZ_POSITION } from './constants';

// ============================================================================
// ESCAPE PHASE COMMS
// ============================================================================

/**
 * Initial escape comms after Queen kill
 */
export const ESCAPE_START_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: "The whole place is coming down! RUN, brother! I'm holding position at LZ Omega!",
};

/**
 * Surface reached comms
 */
export const SURFACE_REACHED_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: 'I see you! Run to my position! Hostiles everywhere!',
};

// ============================================================================
// HOLDOUT PHASE COMMS
// ============================================================================

/**
 * Holdout start comms
 */
export const HOLDOUT_START_COMMS: CommsMessage = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
  text: 'Dropship SALVATION en route. ETA 5 minutes. Detecting multiple hostile signatures converging on your position.',
};

/**
 * Wave complete comms (by wave number)
 */
export const WAVE_COMPLETE_COMMS: Record<number, CommsMessage> = {
  2: {
    sender: 'Corporal Marcus Cole',
    callsign: 'TITAN',
    portrait: 'marcus',
    text: 'Good kills, brother! Keep it up - Titan is holding but they just keep coming!',
  },
  4: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Warning: Massive hostile signatures converging. Recommend conserving ammunition.',
  },
  5: {
    sender: 'Corporal Marcus Cole',
    callsign: 'TITAN',
    portrait: 'marcus',
    text: "We're past the halfway point! Two more waves - you got this!",
  },
  6: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Warning: Seismic activity detected. Massive hostile force approaching. SALVATION ETA update: 90 seconds.',
  },
};

/**
 * Supply drop notification
 */
export const SUPPLY_DROP_COMMS: CommsMessage = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
  text: 'Supply drop deployed. Resupply before the next wave.',
};

/**
 * Signal flare response
 */
export const SIGNAL_FLARE_COMMS: CommsMessage = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
  text: 'Signal received. Relaying position to SALVATION.',
};

// ============================================================================
// HIVE COLLAPSE PHASE COMMS
// ============================================================================

/**
 * Collapse start comms sequence (ordered by delay in ms)
 */
export const COLLAPSE_START_SEQUENCE: Array<{ delay: number; message: CommsMessage }> = [
  {
    delay: 1000,
    message: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'SPECTER! The entire hive structure is coming down! You have 90 seconds to reach SALVATION - MOVE!',
    },
  },
  {
    delay: 4000,
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'CRITICAL: Subterranean hive structure collapsing! Surface destabilization imminent! SALVATION is holding position - recommend maximum sprint velocity!',
    },
  },
  {
    delay: 7000,
    message: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Titan's running on fumes but I'll cover you! RUN, brother! Don't look back!",
    },
  },
];

/**
 * Collapse progression comms (ordered by delay in ms)
 */
export const COLLAPSE_PROGRESSION_SEQUENCE: Array<{ delay: number; message: CommsMessage }> = [
  {
    delay: 35000,
    message: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'Seismic readings are off the charts! The whole sector is destabilizing! KEEP RUNNING, SOLDIER!',
    },
  },
  {
    delay: 50000,
    message: {
      sender: 'Dropship Pilot',
      callsign: 'SALVATION',
      portrait: 'ai',
      text: "I can't hold much longer! This whole area is coming apart! GET HERE NOW!",
    },
  },
  {
    delay: 70000,
    message: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'YOU ARE RUNNING OUT OF TIME! SALVATION IS YOUR ONLY CHANCE! GO GO GO!',
    },
  },
  {
    delay: 80000,
    message: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Almost there, brother! Don't you DARE give up now! I didn't survive this long to lose you!",
    },
  },
];

/**
 * Close call comms (triggered by near-misses with debris)
 */
export const CLOSE_CALL_COMMS: Record<string, CommsMessage> = {
  closeCall1: {
    sender: 'Corporal Marcus Cole',
    callsign: 'TITAN',
    portrait: 'marcus',
    text: 'Watch the debris! That was close!',
  },
  closeCall2: {
    sender: 'Commander Elena Vasquez',
    callsign: 'PROMETHEUS ACTUAL',
    portrait: 'commander',
    text: 'SPECTER, keep moving! Do NOT stop for anything!',
  },
};

/**
 * Distance-based comms during collapse
 */
export const DISTANCE_COMMS: Record<string, CommsMessage> = {
  almost: {
    sender: 'Dropship Pilot',
    callsign: 'SALVATION',
    portrait: 'ai',
    text: 'I can see you! Keep coming! Ramp is down!',
  },
  soClose: {
    sender: 'Corporal Marcus Cole',
    callsign: 'TITAN',
    portrait: 'marcus',
    text: "You're almost there! DON'T STOP!",
  },
  lowHealth: {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Warning: Suit integrity critical. Medical supplies detected ahead. Recommend immediate retrieval.',
  },
};

/**
 * Collapse failure comms (Marcus saves player)
 */
export const COLLAPSE_FAILURE_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: "NO! Hold on, I'm coming for you!",
};

// ============================================================================
// VICTORY PHASE COMMS
// ============================================================================

/**
 * Dropship arrival detection
 */
export const DROPSHIP_DETECTION_COMMS: CommsMessage = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
  text: 'Detecting friendly transponder. Dropship SALVATION on final approach vector. ETA 30 seconds to touchdown.',
};

/**
 * Commander victory comms
 */
export const COMMANDER_VICTORY_COMMS: CommsMessage = {
  sender: 'Commander Elena Vasquez',
  callsign: 'PROMETHEUS ACTUAL',
  portrait: 'commander',
  text: "You did it, Cole brothers! You actually did it! The Queen is dead and you're still standing! Get to that LZ - your ride home is inbound!",
};

/**
 * Dropship approach comms
 */
export const DROPSHIP_APPROACH_COMMS: CommsMessage = {
  sender: 'Dropship Pilot',
  callsign: 'SALVATION',
  portrait: 'ai',
  text: 'SALVATION on final approach! Touchdown in 25 seconds! I see the LZ beacon - clearing hot!',
};

/**
 * Marcus sees dropship
 */
export const MARCUS_SEES_DROPSHIP_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: "There she is! Most beautiful thing I've ever seen! We're going home, brother!",
};

/**
 * Dropship hovering comms
 */
export const DROPSHIP_HOVER_COMMS: CommsMessage = {
  sender: 'Dropship Pilot',
  callsign: 'SALVATION',
  portrait: 'ai',
  text: 'LZ is hot but manageable! Commencing landing sequence!',
};

/**
 * Marcus mech collapse comms
 */
export const MECH_COLLAPSE_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: "Titan's reactor is critical... power cells depleted. But we did it, James. We made it.",
};

/**
 * Board now comms
 */
export const BOARD_NOW_COMMS: CommsMessage = {
  sender: 'Dropship Pilot',
  callsign: 'SALVATION',
  portrait: 'ai',
  text: 'Ramp is down! Get your asses on board, Marines! We are leaving!',
};

/**
 * Boarding sequence comms
 */
export const BOARDING_SEQUENCE_COMMS: Array<{ delay: number; message: CommsMessage }> = [
  {
    delay: 0,
    message: {
      sender: 'Sergeant James Cole',
      callsign: 'SPECTER',
      portrait: 'player',
      text: 'Come on, Marcus. Time to go home.',
    },
  },
  {
    delay: 3000,
    message: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: 'Right behind you, brother. Just like old times.',
    },
  },
];

// ============================================================================
// EPILOGUE COMMS
// ============================================================================

/**
 * Airborne comms
 */
export const AIRBORNE_COMMS: CommsMessage = {
  sender: 'Dropship Pilot',
  callsign: 'SALVATION',
  portrait: 'ai',
  text: "We're airborne! Good work, Marine!",
};

/**
 * Commander debrief
 */
export const COMMANDER_DEBRIEF_COMMS: CommsMessage = {
  sender: 'Commander Elena Vasquez',
  callsign: 'PROMETHEUS ACTUAL',
  portrait: 'commander',
  text: "Sergeants Cole... both of you. Welcome home. The Queen is dead. Kepler's Promise is secure. Outstanding work.",
};

/**
 * ATHENA mission summary (kills count will be inserted)
 */
export function getAthenaDebrief(kills: number): CommsMessage {
  return {
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: `Mission debrief complete. Hostiles eliminated: ${kills}. Casualties: Zero. Brothers reunited. Directive fulfilled: Find them. Bring them home.`,
  };
}

/**
 * Final Marcus dialogue
 */
export const MARCUS_FINAL_COMMS: CommsMessage = {
  sender: 'Corporal Marcus Cole',
  callsign: 'TITAN',
  portrait: 'marcus',
  text: 'Thanks for coming for me, James. I knew you would.',
};
