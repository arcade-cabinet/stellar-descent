import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ROOM_POSITIONS } from './environment';

// ============================================================================
// Tutorial Phase System
// ============================================================================
// Phase 0: Briefing - notifications only, no HUD elements visible
// Phase 1: After briefing - health bar appears, WASD enabled
// Phase 2: Equipment Bay - crosshair appears, mouse look enabled
// Phase 3: Shooting Range - ammo counter visible, fire enabled
// Phase 4: Hangar Bay - full HUD, ready for drop
// ============================================================================

export type TutorialPhase = 0 | 1 | 2 | 3 | 4;

export interface HUDUnlockState {
  healthBar: boolean;
  crosshair: boolean;
  ammoCounter: boolean;
  missionText: boolean;
  actionButtons: boolean;
  movementEnabled: boolean;
  lookEnabled: boolean;
  fireEnabled: boolean;
}

export const PHASE_HUD_STATES: Record<TutorialPhase, HUDUnlockState> = {
  0: {
    healthBar: false,
    crosshair: false,
    ammoCounter: false,
    missionText: false,
    actionButtons: false,
    movementEnabled: false,
    lookEnabled: false,
    fireEnabled: false,
  },
  1: {
    healthBar: true,
    crosshair: false,
    ammoCounter: false,
    missionText: true,
    actionButtons: false,
    movementEnabled: true,
    lookEnabled: false,
    fireEnabled: false,
  },
  2: {
    healthBar: true,
    crosshair: true,
    ammoCounter: false,
    missionText: true,
    actionButtons: true,
    movementEnabled: true,
    lookEnabled: true,
    fireEnabled: false,
  },
  3: {
    healthBar: true,
    crosshair: true,
    ammoCounter: true,
    missionText: true,
    actionButtons: true,
    movementEnabled: true,
    lookEnabled: true,
    fireEnabled: true,
  },
  4: {
    healthBar: true,
    crosshair: true,
    ammoCounter: true,
    missionText: true,
    actionButtons: true,
    movementEnabled: true,
    lookEnabled: true,
    fireEnabled: true,
  },
};

// Tutorial step definitions - the narrative spine of the intro
export interface TutorialStep {
  id: string;
  title: string;
  instructions: string;
  phase: TutorialPhase;
  commsMessage?: {
    sender: string;
    callsign: string;
    portrait: 'commander' | 'ai' | 'marcus' | 'armory';
    text: string;
    // Delay before showing this message (ms)
    delay?: number;
  };
  objective?: {
    type:
      | 'move_to'
      | 'interact'
      | 'look_at'
      | 'wait'
      | 'shooting_range'
      | 'platforming_jump'
      | 'platforming_crouch'
      | 'platforming_complete';
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
    | 'start_calibration'
    | 'pickup_weapon'
    | 'start_platforming';
  // Action buttons to display during this step
  actionButtons?: {
    id: string;
    label: string;
    key: string;
    highlighted?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'warning';
    size?: 'small' | 'medium' | 'large';
  }[];
  onComplete?: () => void;
}

// ============================================================================
// TUTORIAL STEPS
// ============================================================================
// Dialogue is now gated by player actions. Only ONE message fires at level start.
// Subsequent messages require completing the previous objective before appearing.
// ============================================================================

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ============================================================================
  // PHASE 0: BRIEFING - Single initial message, then wait for player to move
  // ============================================================================
  {
    id: 'wake_up',
    title: 'NEURAL SYNC',
    instructions: '',
    phase: 0,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Good morning, Sergeant Cole. Neural sync complete. Incoming priority transmission from Commander Vasquez.',
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'commander_briefing',
    title: 'INCOMING TRANSMISSION',
    instructions: '',
    phase: 0,
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "Sergeant Cole - your brother's team went dark 36 hours ago at FOB Delta. Drop to Alpha-7, find out what happened. Hostile contact confirmed - you are weapons free. Bring them home, Sergeant. Vasquez out.",
      delay: 500,
    },
    objective: {
      type: 'wait',
      duration: 5000,
    },
    autoAdvanceAfterComms: true,
  },

  // ============================================================================
  // PHASE 1: Movement Tutorial - Health bar appears, WASD enabled
  // Dialogue only appears AFTER player dismisses briefing comms
  // ============================================================================
  {
    id: 'movement_unlock',
    title: 'MOVEMENT ONLINE',
    instructions: 'Use WASD or arrow keys to move.',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Movement controls online. Proceed to the Equipment Bay - follow the guide markers on the floor.',
      delay: 3000,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.corridorA,
      radius: 3,
    },
  },
  {
    id: 'corridor_progress',
    title: 'CORRIDOR A',
    instructions: 'Enter the Training Room on your left.',
    phase: 1,
    // No comms message - player already knows where to go
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.platformingEntry,
      radius: 3,
    },
  },

  // ============================================================================
  // PHASE 1.5: Platforming Tutorial - Jump and Crouch mechanics
  // Located in Training Room off the corridor
  // ============================================================================
  {
    id: 'platforming_intro',
    title: 'TRAINING ROOM',
    instructions: 'Complete the obstacle course.',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Mobility training initiated. This course will calibrate your jump and crouch systems.',
      delay: 2000,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.platform1,
      radius: 2,
    },
    triggerSequence: 'start_platforming',
  },
  {
    id: 'jump_tutorial',
    title: 'JUMP TRAINING',
    instructions: 'Press SPACE to jump across the gap.',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Jump module online. Use SPACE to leap across gaps. Platform surfaces are highlighted.',
      delay: 1500,
    },
    actionButtons: [
      { id: 'jump', label: 'JUMP', key: 'Space', highlighted: true, variant: 'primary' },
    ],
    objective: {
      type: 'platforming_jump',
      target: ROOM_POSITIONS.platform2,
      radius: 2,
    },
  },
  {
    id: 'jump_complete',
    title: 'JUMP CALIBRATED',
    instructions: '',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Jump systems calibrated. Proceed to the low passage ahead.',
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'crouch_tutorial',
    title: 'CROUCH TRAINING',
    instructions: 'Press CTRL or C to crouch through the passage.',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Low clearance detected. Use CTRL or C to crouch. Essential for confined spaces.',
      delay: 1500,
    },
    actionButtons: [
      { id: 'crouch', label: 'CROUCH', key: 'ControlLeft', highlighted: true, variant: 'primary' },
    ],
    objective: {
      type: 'platforming_crouch',
      target: ROOM_POSITIONS.crouchPassageEntry,
      radius: 2,
    },
  },
  {
    id: 'crouch_complete',
    title: 'CROUCH CALIBRATED',
    instructions: '',
    phase: 1,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Mobility systems fully calibrated. You are cleared for field operations.',
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 2000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'platforming_complete',
    title: 'TRAINING COMPLETE',
    instructions: 'Return to the corridor and proceed to Equipment Bay.',
    phase: 1,
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.platformingExit,
      radius: 3,
    },
  },
  {
    id: 'corridor_to_equipment',
    title: 'CORRIDOR A',
    instructions: 'Continue to Equipment Bay.',
    phase: 1,
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.equipmentBay,
      radius: 4,
    },
  },

  // ============================================================================
  // PHASE 2: Equipment Bay - Crosshair appears, mouse look enabled
  // Comms messages are spaced and gated by objective completion
  // ============================================================================
  {
    id: 'equipment_bay_enter',
    title: 'EQUIPMENT BAY',
    instructions: 'Approach the suit locker.',
    phase: 2,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Targeting systems online. Approach the suit locker on the left wall.',
      delay: 2000,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.suitLocker,
      radius: 2.5,
    },
  },
  {
    id: 'equip_suit',
    title: 'EQUIP EVA SUIT',
    instructions: 'Press E or tap to equip.',
    phase: 2,
    // No comms - player sees the prompt and action button
    actionButtons: [
      { id: 'equip_suit', label: 'EQUIP SUIT', key: 'KeyE', highlighted: true, variant: 'primary' },
    ],
    objective: {
      type: 'interact',
      target: ROOM_POSITIONS.suitLocker,
      radius: 2.5,
      interactId: 'suit_locker',
    },
    triggerSequence: 'equip_suit',
  },
  {
    id: 'suit_equipped',
    title: 'SUIT ONLINE',
    instructions: '',
    phase: 2,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'EVA suit sealed. Life support active. You are cleared for vacuum operations.',
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 3500,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'approach_weapon_rack',
    title: 'WEAPON RACK',
    instructions: 'Approach the weapon rack.',
    phase: 2,
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: "Hold up, Cole. Can't drop without iron. Your M7's on the rack.",
      delay: 3500,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.weaponRack,
      radius: 2,
    },
    triggerSequence: 'pickup_weapon',
  },
  {
    id: 'weapon_acquired',
    title: 'WEAPON ACQUIRED',
    instructions: 'Proceed to the shooting range.',
    phase: 2,
    // No immediate comms - let player process weapon pickup
    objective: {
      type: 'wait',
      duration: 2000,
    },
    autoAdvanceAfterComms: true,
  },

  // ============================================================================
  // PHASE 3: Shooting Range - Ammo counter visible, fire enabled
  // Comms only when player reaches new area or completes objective
  // ============================================================================
  {
    id: 'move_to_range',
    title: 'SHOOTING RANGE',
    instructions: 'Proceed to the shooting range.',
    phase: 3,
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: "Now get to the range and calibrate. Lane's down the corridor.",
      delay: 2000,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.shootingPosition,
      radius: 3,
    },
  },
  {
    id: 'calibration_start',
    title: 'WEAPONS CALIBRATION',
    instructions: 'Click or tap to fire. Hit all 5 targets.',
    phase: 3,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Calibration sequence initiated. Five targets, Sergeant.',
      delay: 2500,
    },
    actionButtons: [
      { id: 'fire', label: 'FIRE', key: 'Mouse0', variant: 'primary' },
      { id: 'reload', label: 'RELOAD', key: 'KeyR', variant: 'secondary' },
    ],
    objective: {
      type: 'shooting_range',
    },
    triggerSequence: 'start_calibration',
  },
  {
    id: 'calibration_complete',
    title: 'CALIBRATION COMPLETE',
    instructions: '',
    phase: 3,
    commsMessage: {
      sender: 'Gunnery Sgt. Kowalski',
      callsign: 'ARMORY',
      portrait: 'armory',
      text: 'Still got it. Now move your ass, Marine.',
      delay: 1500,
    },
    objective: {
      type: 'wait',
      duration: 3000,
    },
    autoAdvanceAfterComms: true,
  },

  // ============================================================================
  // PHASE 4: Hangar Bay - Full HUD, ready for drop
  // Comms are more spaced out - cinematic sequence plays with longer waits
  // ============================================================================
  {
    id: 'move_to_hangar',
    title: 'HANGAR BAY',
    instructions: 'Proceed to Hangar Bay.',
    phase: 4,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Hangar Bay 7 ahead. Drop pod HELL-7 is prepped and waiting.',
      delay: 2500,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.hangarEntry,
      radius: 3,
    },
  },
  {
    id: 'depressurize_warning',
    title: 'DEPRESSURIZATION',
    instructions: '',
    phase: 4,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'WARNING: Initiating hangar bay depressurization.',
      delay: 2000,
    },
    objective: {
      type: 'wait',
      duration: 4000,
    },
    triggerSequence: 'depressurize',
    autoAdvanceAfterComms: true,
  },
  {
    id: 'depressurizing',
    title: 'VENTING ATMOSPHERE',
    instructions: 'Stand by...',
    phase: 4,
    // No comms - let the visuals speak
    objective: {
      type: 'wait',
      duration: 4000,
    },
    autoAdvanceAfterComms: true,
  },
  {
    id: 'bay_doors',
    title: 'BAY DOORS',
    instructions: '',
    phase: 4,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: "Opening bay doors. Kepler's Promise awaits.",
      delay: 1000,
    },
    objective: {
      type: 'wait',
      duration: 5000,
    },
    triggerSequence: 'open_bay_doors',
    autoAdvanceAfterComms: true,
  },
  {
    id: 'move_to_pod',
    title: 'DROP POD',
    instructions: 'Board drop pod HELL-7.',
    phase: 4,
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: 'The view never gets old. Bring Marcus home, Sergeant.',
      delay: 3500,
    },
    objective: {
      type: 'move_to',
      target: ROOM_POSITIONS.dropPod,
      radius: 2.5,
    },
  },
  {
    id: 'enter_pod',
    title: 'BOARDING',
    instructions: '',
    phase: 4,
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Drop pod HELL-7 sealed. Launch sequence initiating.',
      delay: 1500,
    },
    objective: {
      type: 'wait',
      duration: 3000,
    },
    triggerSequence: 'enter_pod',
    autoAdvanceAfterComms: true,
  },
  {
    id: 'pre_launch',
    title: 'LAUNCH READY',
    instructions: 'Press SPACE to begin orbital drop.',
    phase: 4,
    commsMessage: {
      sender: 'Commander Elena Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "Green light confirmed. Give 'em hell, Sergeant.",
      delay: 2500,
    },
    actionButtons: [
      {
        id: 'begin_drop',
        label: 'BEGIN ORBITAL DROP',
        key: 'Space',
        variant: 'danger',
        size: 'large',
        highlighted: true,
      },
    ],
    objective: {
      type: 'interact',
      interactId: 'launch_pod',
      radius: 5,
    },
    triggerSequence: 'launch',
  },
];
