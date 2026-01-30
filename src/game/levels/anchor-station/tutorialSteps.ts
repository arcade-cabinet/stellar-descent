import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// Tutorial step definitions - the narrative spine of the intro
export interface TutorialStep {
  id: string;
  title: string;
  instructions: string;
  commsMessage?: {
    sender: string;
    callsign: string;
    portrait: 'commander' | 'ai' | 'marcus' | 'armory';
    text: string;
    // Delay before showing this message (ms)
    delay?: number;
  };
  objective?: {
    type: 'move_to' | 'interact' | 'look_at' | 'wait' | 'shooting_range';
    target?: Vector3;
    radius?: number;
    duration?: number;
    interactId?: string; // For interact objectives
  };
  // Auto-advance after comms without requiring objective completion
  autoAdvanceAfterComms?: boolean;
  // Trigger special sequences
  triggerSequence?:
    | 'equip_suit'
    | 'depressurize'
    | 'open_bay_doors'
    | 'enter_pod'
    | 'launch'
    | 'start_calibration';
  onComplete?: () => void;
}

// Position constants for the station layout
const EQUIPMENT_RACK_POS = new Vector3(-3.5, 0, -18);
const SHOOTING_RANGE_POS = new Vector3(3.5, 0, -18);
const HANGAR_INNER_DOOR_POS = new Vector3(0, 0, -35);
const DROP_POD_POS = new Vector3(0, 0, -48);

// The tutorial unfolds through comms - no clicking through 8 boxes at once
// Each step flows naturally as the player completes objectives
export const TUTORIAL_STEPS: TutorialStep[] = [
  // === WAKE UP SEQUENCE ===
  {
    id: 'wake_up',
    title: 'NEURAL SYNC',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Good morning, Sergeant Cole. Neural sync complete. All systems nominal.',
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'location_info',
    title: 'ORIENTATION',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'You are aboard ANCHOR STATION PROMETHEUS, Prep Bay 7. Please proceed to the equipment station to suit up.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 3000,
    },
    autoAdvanceAfterComms: true,
  },

  // === MOVEMENT TUTORIAL ===
  {
    id: 'move_tutorial',
    title: 'MOVEMENT',
    instructions: 'Use WASD or left stick to move.',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Follow the guide markers on the floor to the equipment rack.',
      delay: 500,
    },
    objective: {
      type: 'move_to',
      target: EQUIPMENT_RACK_POS,
      radius: 2,
    },
  },

  // === EQUIPMENT INTERACTION ===
  {
    id: 'equip_suit',
    title: 'EQUIPMENT',
    instructions: 'Press E or tap to equip EVA suit.',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Standard EVA suit detected. Approach the rack and interact to equip.',
      delay: 500,
    },
    objective: {
      type: 'interact',
      target: EQUIPMENT_RACK_POS,
      radius: 2.5,
      interactId: 'equipment_rack',
    },
    triggerSequence: 'equip_suit',
  },
  {
    id: 'suit_equipped',
    title: 'SUIT ONLINE',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'EVA suit sealed. Life support active. Oxygen at 100%. You are cleared for vacuum operations.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 2500,
    },
    autoAdvanceAfterComms: true,
  },

  // === WEAPONS CALIBRATION ===
  {
    id: 'armory_master_intro',
    title: 'WEAPONS CHECK',
    instructions: '',
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: 'Hold up, Cole. Calibrate your sidearm before drop. You know better.',
      delay: 800,
    },
    objective: {
      type: 'wait',
      duration: 2500,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'move_to_range',
    title: 'CALIBRATION',
    instructions: 'Proceed to the firing range.',
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: "Lane two. And don't give me that look - I don't care if you can hit an LGM at 500 klicks. We don't drop without calibration.",
      delay: 300,
    },
    objective: {
      type: 'move_to',
      target: SHOOTING_RANGE_POS,
      radius: 2,
    },
  },
  {
    id: 'calibration_start',
    title: 'WEAPONS CALIBRATION',
    instructions: 'Click to fire. Hit all targets.',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Calibration sequence initiated. Five targets, Sergeant.',
      delay: 500,
    },
    objective: {
      type: 'shooting_range',
    },
    triggerSequence: 'start_calibration',
  },
  {
    id: 'calibration_complete',
    title: 'CALIBRATION COMPLETE',
    instructions: '',
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: 'Still got it. Now move your ass, Marine - brass wants you planetside five minutes ago.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    autoAdvanceAfterComms: true,
  },

  // === COMMANDER BRIEFING ===
  {
    id: 'commander_intro',
    title: 'INCOMING TRANSMISSION',
    instructions: '',
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "Sergeant Cole. I'll cut to it - your brother's team went dark 36 hours ago at FOB Delta.",
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'commander_personal',
    title: 'MISSION BRIEFING',
    instructions: '',
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "I know this is personal. Marcus was assigned to Vanguard as their heavy support. But you're our best operative for this.",
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'commander_objectives',
    title: 'OBJECTIVES',
    instructions: '',
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'Drop to coordinates Alpha-7, proceed to FOB Delta, assess the situation. Hostile contact confirmed - you are weapons free.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    autoAdvanceAfterComms: true,
  },

  // === PROCEED TO HANGAR ===
  {
    id: 'move_to_hangar',
    title: 'HANGAR BAY',
    instructions: 'Proceed to the hangar bay airlock.',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Hangar Bay 7 airlock ahead. Proceed through the inner door.',
      delay: 500,
    },
    objective: {
      type: 'move_to',
      target: HANGAR_INNER_DOOR_POS,
      radius: 3,
    },
  },

  // === DEPRESSURIZATION SEQUENCE ===
  {
    id: 'depressurize_warning',
    title: 'DEPRESSURIZATION',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'WARNING: Initiating hangar bay depressurization. Sealing inner airlock.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    triggerSequence: 'depressurize',
    autoAdvanceAfterComms: true,
  },
  {
    id: 'depressurizing',
    title: 'VENTING ATMOSPHERE',
    instructions: 'Stand by...',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Atmosphere venting... 50%... 80%... Complete. Hangar bay at vacuum.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 3500,
    },
    autoAdvanceAfterComms: true,
  },

  // === BAY DOORS OPENING ===
  {
    id: 'bay_doors',
    title: 'BAY DOORS',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: "Opening bay doors. Kepler's Promise awaits, Sergeant.",
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    triggerSequence: 'open_bay_doors',
    autoAdvanceAfterComms: true,
  },

  // === FINAL APPROACH TO DROP POD ===
  {
    id: 'move_to_pod',
    title: 'DROP POD',
    instructions: 'Board drop pod HELL-7.',
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'The view never gets old. Find out what happened to Vanguard. Bring Marcus home.',
      delay: 1000,
    },
    objective: {
      type: 'move_to',
      target: DROP_POD_POS,
      radius: 2,
    },
  },

  // === ENTER POD AND LAUNCH ===
  {
    id: 'enter_pod',
    title: 'BOARDING',
    instructions: '',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Drop pod HELL-7 sealed. Launch sequence initiating. Godspeed, Sergeant Cole.',
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 2500,
    },
    triggerSequence: 'enter_pod',
    autoAdvanceAfterComms: true,
  },
  {
    id: 'launch',
    title: 'LAUNCH',
    instructions: '',
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "Prometheus Actual to Specter. Green light confirmed. Give 'em hell.",
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    triggerSequence: 'launch',
    autoAdvanceAfterComms: true,
  },
];
