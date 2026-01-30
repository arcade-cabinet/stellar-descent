/**
 * ReyesDialogue - Commander Vasquez (Reyes) Dialogue System
 *
 * Manages all dialogue for Commander Elena Vasquez, the player's commanding officer
 * aboard Anchor Station Prometheus. She provides:
 *
 * - Level briefings (one per chapter, played before or at level start)
 * - In-mission radio calls (objective updates, warnings, encouragement)
 * - Extraction / endgame comms
 *
 * Integrates with:
 * - VoiceSynthesizer for procedural radio voice audio
 * - SubtitleContext for displaying dialogue text
 * - AudioManager for voice volume control
 *
 * The queue system prevents overlapping dialogue and respects priorities
 * so urgent transmissions (e.g. "hostiles inbound") can interrupt briefings.
 */

import type { CommsMessage } from '../types';
import type { LevelId } from '../levels/types';
import { getAudioManager } from '../core/AudioManager';
import { type VoicePlaybackHandle, REYES_VOICE, getVoiceSynthesizer } from './VoiceSynthesizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Priority levels for dialogue entries */
export enum DialoguePriority {
  /** Background chatter, can be freely interrupted */
  LOW = 1,
  /** Standard briefing / objective update */
  NORMAL = 5,
  /** Important warning or story beat */
  HIGH = 7,
  /** Critical / cannot miss (boss alerts, extraction countdown) */
  CRITICAL = 9,
}

/** A single dialogue entry */
export interface DialogueEntry {
  /** Unique identifier */
  id: string;
  /** The spoken text (also displayed as subtitle) */
  text: string;
  /** Speaker name for CommsMessage */
  speaker: string;
  /** Speaker callsign for CommsMessage */
  callsign: string;
  /** Portrait type for the CommsDisplay */
  portrait: CommsMessage['portrait'];
  /** Duration override in ms (0 = auto-estimate from text length) */
  durationMs: number;
  /** Queue priority -- higher values interrupt lower ones */
  priority: DialoguePriority;
  /** Delay before playing (ms), useful for sequencing multiple lines */
  delayMs: number;
}

/** Dialogue trigger that a level can fire */
export type DialogueTrigger =
  // Briefings (one per level)
  | 'briefing_anchor_station'
  | 'briefing_landfall'
  | 'briefing_fob_delta'
  | 'briefing_brothers_in_arms'
  | 'briefing_the_breach'
  | 'briefing_extraction'
  // In-mission triggers
  | 'objective_updated'
  | 'objective_complete'
  | 'hostiles_detected'
  | 'hostiles_cleared'
  | 'player_low_health_warning'
  | 'player_critical_warning'
  | 'ammo_low'
  | 'reinforcements_incoming'
  | 'extraction_available'
  | 'extraction_countdown'
  | 'marcus_located'
  | 'fob_delta_lights_out'
  | 'hive_entrance_found'
  | 'queen_detected'
  | 'queen_defeated'
  | 'mission_complete'
  | 'mission_failed';

// ---------------------------------------------------------------------------
// Commander Vasquez character definition
// ---------------------------------------------------------------------------

const VASQUEZ: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Commander Vasquez',
  callsign: 'ACTUAL',
  portrait: 'commander',
};

// ---------------------------------------------------------------------------
// Dialogue data
// ---------------------------------------------------------------------------

function entry(
  id: string,
  text: string,
  priority = DialoguePriority.NORMAL,
  delayMs = 0,
  durationMs = 0,
): DialogueEntry {
  return {
    id,
    text,
    speaker: VASQUEZ.sender,
    callsign: VASQUEZ.callsign,
    portrait: VASQUEZ.portrait,
    durationMs,
    priority,
    delayMs,
  };
}

// ---- Level Briefings ----

const BRIEFINGS: Record<LevelId, DialogueEntry[]> = {
  anchor_station: [
    entry(
      'brief_anchor_1',
      'Sergeant Cole, this is Commander Vasquez aboard Prometheus. Welcome to Prep Bay Seven.',
      DialoguePriority.NORMAL,
      0,
    ),
    entry(
      'brief_anchor_2',
      'Recon Team Vanguard went dark thirty-six hours ago at FOB Delta. No distress signal. No explanation.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_anchor_3',
      'Your brother Marcus was attached to that unit. I know this is personal. Keep your head straight.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_anchor_4',
      'Gear up, familiarize yourself with your loadout, then report to the drop bay. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  landfall: [
    entry(
      'brief_landfall_1',
      'Drop pod is green. Atmospheric entry in thirty seconds. Brace for turbulence.',
      DialoguePriority.HIGH,
      0,
    ),
    entry(
      'brief_landfall_2',
      'Your LZ is the northern canyon rim. FOB Delta is two klicks southeast.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_landfall_3',
      'Orbital scans show unknown movement signatures near the canyon floor. Watch yourself.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_landfall_4',
      'Good luck, Sergeant. Prometheus will maintain overwatch. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  canyon_run: [
    entry(
      'brief_canyon_1',
      'Cole, we have located a Warthog transport at the canyon depot. Take it and push southeast.',
      DialoguePriority.HIGH,
      0,
    ),
    entry(
      'brief_canyon_2',
      'Satellite imagery shows the canyon narrows ahead. Hostiles have set up ambush positions along the route.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_canyon_3',
      'Do not stop. Speed is your ally in that terrain. Punch through to FOB Delta. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  fob_delta: [
    entry(
      'brief_fob_1',
      'Cole, you are approaching FOB Delta. The base should be directly ahead.',
      DialoguePriority.NORMAL,
      0,
    ),
    entry(
      'brief_fob_2',
      'Sensors are picking up faint power signatures. The base still has juice, but nobody is answering our hails.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_fob_3',
      'Proceed with caution. If Vanguard went down, whatever hit them could still be in there.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_fob_4',
      'Find the command terminal and pull the logs. We need to know what happened. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  brothers_in_arms: [
    entry(
      'brief_brothers_1',
      'Cole, we are reading a friendly IFF beacon two hundred meters north. It matches Marcus.',
      DialoguePriority.HIGH,
      0,
    ),
    entry(
      'brief_brothers_2',
      'He is alive. Repeat: Corporal Cole is alive. He appears to be operating his combat walker.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_brothers_3',
      'The canyon is crawling with hostiles. Link up with Marcus and establish a defensive perimeter.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_brothers_4',
      'Hold that position until we can arrange extraction. Do not let them overrun you. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  southern_ice: [
    entry(
      'brief_ice_1',
      'Cole, thermal imaging shows the southern ice shelf is riddled with tunnel entrances.',
      DialoguePriority.HIGH,
      0,
    ),
    entry(
      'brief_ice_2',
      'Temperature is dropping fast. Your suit will compensate, but watch for ice formations that mask hostile signatures.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_ice_3',
      'We have detected new bio-signatures down there. Larger. More organized. Stay frosty, Sergeant. Vasquez out.',
      DialoguePriority.HIGH,
      500,
    ),
  ],

  the_breach: [
    entry(
      'brief_breach_1',
      'Sergeant, orbital imaging has located the source. A massive subterranean cavity beneath the canyon.',
      DialoguePriority.HIGH,
      0,
    ),
    entry(
      'brief_breach_2',
      'The hostiles are pouring out of it in waves. If we do not seal that breach, the colony is finished.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_breach_3',
      'Intel suggests a central organism controlling the hive mind. Eliminate it and the swarm collapses.',
      DialoguePriority.NORMAL,
      500,
    ),
    entry(
      'brief_breach_4',
      'This is a one-way trip until you neutralize the target. No extraction until the queen is dead. Vasquez out.',
      DialoguePriority.CRITICAL,
      500,
    ),
  ],

  hive_assault: [
    entry(
      'brief_hive_1',
      'All units, this is ACTUAL. Combined assault on the hive is authorized. Cole, you are on point.',
      DialoguePriority.CRITICAL,
      0,
    ),
    entry(
      'brief_hive_2',
      'Marcus and the remaining armor will provide covering fire topside. You push deep.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_hive_3',
      'Plant the charges at the structural nodes we have marked. Then get clear before detonation.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_hive_4',
      'We get one shot at this. Make it count, Sergeant. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  extraction: [
    entry(
      'brief_extract_1',
      'Outstanding work, Sergeant. The hive is collapsing. Get to LZ Omega for extraction.',
      DialoguePriority.CRITICAL,
      0,
    ),
    entry(
      'brief_extract_2',
      'The remaining hostiles are in a frenzy. They will throw everything at you on the way out.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_extract_3',
      'Dropship is inbound. ETA eight minutes. Hold that landing zone at all costs.',
      DialoguePriority.HIGH,
      500,
    ),
    entry(
      'brief_extract_4',
      'We are bringing you home, Cole. Both of you. Vasquez out.',
      DialoguePriority.NORMAL,
      500,
    ),
  ],

  final_escape: [
    entry(
      'brief_escape_1',
      'The whole canyon is coming down! There is a transport at the south depot. Get to it NOW!',
      DialoguePriority.CRITICAL,
      0,
    ),
    entry(
      'brief_escape_2',
      'Drive fast and do not stop for anything. The collapse is right behind you.',
      DialoguePriority.CRITICAL,
      500,
    ),
    entry(
      'brief_escape_3',
      'Dropship will match your speed at the canyon exit. Just keep moving! Vasquez out.',
      DialoguePriority.CRITICAL,
      500,
    ),
  ],
};

// ---- In-Mission Radio Calls ----

const IN_MISSION_LINES: Record<string, DialogueEntry[]> = {
  objective_updated: [
    entry('obj_update_1', 'Objective updated. Check your HUD for the new waypoint.'),
    entry('obj_update_2', 'New orders, Sergeant. Marking your next objective now.'),
    entry('obj_update_3', 'Prometheus has updated your mission parameters. Proceed to the marked location.'),
  ],

  objective_complete: [
    entry('obj_complete_1', 'Good work, Cole. Objective complete. Stand by for further instructions.'),
    entry('obj_complete_2', 'Confirmed. Objective achieved. Moving to the next phase.'),
  ],

  hostiles_detected: [
    entry('hostiles_1', 'Sergeant, we are reading movement converging on your position. Weapons free.', DialoguePriority.HIGH),
    entry('hostiles_2', 'Multiple contacts bearing down on you. Stay sharp.', DialoguePriority.HIGH),
    entry('hostiles_3', 'Orbital confirms hostile signatures. They know you are there.', DialoguePriority.HIGH),
  ],

  hostiles_cleared: [
    entry('cleared_1', 'Area looks clear from up here. Good shooting, Sergeant.'),
    entry('cleared_2', 'No more movement on scope. You have a window. Use it.'),
  ],

  player_low_health_warning: [
    entry('health_low_1', 'Cole, your bio-readings are dropping. Find cover and stabilize.', DialoguePriority.HIGH),
    entry('health_low_2', 'Sergeant, your vitals are concerning. Do not push it.', DialoguePriority.HIGH),
  ],

  player_critical_warning: [
    entry('health_crit_1', 'Cole! Your vitals are critical! Fall back immediately!', DialoguePriority.CRITICAL),
    entry('health_crit_2', 'Sergeant, you are not going to make it at this rate. Find medical supplies NOW.', DialoguePriority.CRITICAL),
  ],

  ammo_low: [
    entry('ammo_1', 'We are reading low ammunition on your loadout. Conserve your rounds.'),
    entry('ammo_2', 'Running dry, Sergeant. Make every shot count.'),
  ],

  reinforcements_incoming: [
    entry('reinforce_1', 'Heads up, Cole. Orbital shows a second wave forming. Dig in.', DialoguePriority.HIGH),
    entry('reinforce_2', 'More are coming. A lot more. Brace yourself.', DialoguePriority.HIGH),
  ],

  extraction_available: [
    entry('extract_ready_1', 'Extraction is available. Get to LZ Omega. Dropship is holding pattern.', DialoguePriority.CRITICAL),
  ],

  extraction_countdown: [
    entry('extract_count_1', 'Dropship is on final approach. Two minutes to dust-off. Hold that LZ!', DialoguePriority.CRITICAL),
    entry('extract_count_2', 'Sixty seconds! Keep them off the landing zone!', DialoguePriority.CRITICAL),
    entry('extract_count_3', 'Dropship is down! Get on board, Sergeant! Move!', DialoguePriority.CRITICAL),
  ],

  marcus_located: [
    entry('marcus_found_1', 'Prometheus confirms: that is Marcus. IFF is solid. Go get your brother, Cole.', DialoguePriority.HIGH),
  ],

  fob_delta_lights_out: [
    entry('fob_dark_1', 'Cole, power grid just went dark across the base. Something tripped the breakers.', DialoguePriority.HIGH),
    entry('fob_dark_2', 'Stay on your guard. This was not an accident.', DialoguePriority.HIGH),
  ],

  hive_entrance_found: [
    entry('hive_found_1', 'That is the entrance. Seismic readings are off the charts down there.', DialoguePriority.HIGH),
    entry('hive_found_2', 'Once you go in, comms may be unreliable. You are on your own, Sergeant.', DialoguePriority.HIGH),
  ],

  queen_detected: [
    entry('queen_1', 'Massive bio-signature detected ahead. That has to be the queen. End this, Cole.', DialoguePriority.CRITICAL),
  ],

  queen_defeated: [
    entry('queen_dead_1', 'The hive mind signal just flatlined. You did it, Sergeant. The queen is dead.', DialoguePriority.CRITICAL),
    entry('queen_dead_2', 'All hostile signatures are going erratic. The swarm is collapsing. Get out of there!', DialoguePriority.CRITICAL, 800),
  ],

  mission_complete: [
    entry('complete_1', 'Mission complete. Sergeant James Cole, you have done humanity proud.', DialoguePriority.CRITICAL),
    entry('complete_2', 'Welcome home, Sergeant. Welcome home.', DialoguePriority.CRITICAL, 1000),
  ],

  mission_failed: [
    entry('failed_1', 'We have lost contact with Sergeant Cole. Scramble recovery team. Vasquez out.', DialoguePriority.CRITICAL),
  ],
};

// ---------------------------------------------------------------------------
// Queued dialogue item
// ---------------------------------------------------------------------------

interface QueuedItem {
  entry: DialogueEntry;
  onCommsMessage: ((msg: CommsMessage) => void) | null;
  resolveFinished: () => void;
}

// ---------------------------------------------------------------------------
// ReyesDialogueManager
// ---------------------------------------------------------------------------

/**
 * Manages Commander Vasquez's dialogue playback, queue, and integration
 * with the voice synthesizer and subtitle/comms systems.
 */
export class ReyesDialogueManager {
  private queue: QueuedItem[] = [];
  private currentPlayback: VoicePlaybackHandle | null = null;
  private currentPriority: DialoguePriority = DialoguePriority.LOW;
  private isProcessing = false;
  private processTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDisposed = false;

  /** Cooldown tracking to prevent spamming the same trigger */
  private triggerCooldowns: Map<string, number> = new Map();
  private readonly defaultCooldownMs = 15_000;

  // Callback for showing comms messages in the UI
  private onCommsMessage: ((msg: CommsMessage) => void) | null = null;

  constructor(onCommsMessage?: (msg: CommsMessage) => void) {
    this.onCommsMessage = onCommsMessage ?? null;
  }

  /** Update the comms message callback (e.g. when React context changes) */
  setCommsCallback(cb: (msg: CommsMessage) => void): void {
    this.onCommsMessage = cb;
  }

  // -----------------------------------------------------------------------
  // Public dialogue triggers
  // -----------------------------------------------------------------------

  /**
   * Play the briefing sequence for a given level.
   * Each line is queued in order with appropriate delays.
   */
  async playBriefing(levelId: LevelId): Promise<void> {
    const lines = BRIEFINGS[levelId];
    if (!lines || lines.length === 0) return;

    // Clear any existing queue -- briefings take over
    this.clearQueue();

    const promises: Promise<void>[] = [];
    for (const line of lines) {
      promises.push(this.enqueue(line));
    }
    await Promise.all(promises);
  }

  /**
   * Trigger an in-mission dialogue event.
   * Respects cooldowns and priorities. Returns true if dialogue was queued.
   */
  triggerDialogue(trigger: DialogueTrigger): boolean {
    // Check cooldown
    const now = Date.now();
    const lastTime = this.triggerCooldowns.get(trigger) ?? 0;
    if (now - lastTime < this.defaultCooldownMs) {
      return false;
    }

    const lines = IN_MISSION_LINES[trigger];
    if (!lines || lines.length === 0) return false;

    // For triggers with multiple variants, pick one randomly
    if (trigger === 'extraction_countdown') {
      // Play all countdown lines in sequence
      for (const line of lines) {
        this.enqueue(line);
      }
    } else if (trigger === 'queen_defeated' || trigger === 'mission_complete') {
      // Play all lines in multi-line sequences
      for (const line of lines) {
        this.enqueue(line);
      }
    } else if (trigger === 'fob_delta_lights_out' || trigger === 'hive_entrance_found') {
      // Play both lines
      for (const line of lines) {
        this.enqueue(line);
      }
    } else {
      // Single random line
      const line = lines[Math.floor(Math.random() * lines.length)];
      this.enqueue(line);
    }

    this.triggerCooldowns.set(trigger, now);
    return true;
  }

  /**
   * Play a single custom dialogue entry (for level-specific one-offs).
   */
  async playCustomLine(text: string, priority = DialoguePriority.NORMAL): Promise<void> {
    const customEntry = entry(`custom_${Date.now()}`, text, priority);
    return this.enqueue(customEntry);
  }

  /**
   * Interrupt and clear all queued dialogue.
   */
  clearQueue(): void {
    // Stop current playback
    if (this.currentPlayback) {
      this.currentPlayback.stop();
      this.currentPlayback = null;
    }

    // Resolve all pending promises
    for (const item of this.queue) {
      item.resolveFinished();
    }
    this.queue = [];
    this.currentPriority = DialoguePriority.LOW;
    this.isProcessing = false;

    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.isDisposed = true;
    this.clearQueue();
    this.triggerCooldowns.clear();
  }

  // -----------------------------------------------------------------------
  // Queue management
  // -----------------------------------------------------------------------

  private enqueue(dialogueEntry: DialogueEntry): Promise<void> {
    if (this.isDisposed) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const item: QueuedItem = {
        entry: dialogueEntry,
        onCommsMessage: this.onCommsMessage,
        resolveFinished: resolve,
      };

      // If this entry can interrupt the current one, do so
      if (
        this.currentPlayback?.isPlaying &&
        dialogueEntry.priority > this.currentPriority
      ) {
        this.currentPlayback.stop();
        this.currentPlayback = null;
        // Insert at front
        this.queue.unshift(item);
      } else {
        // Insert sorted by priority (higher first), stable within same priority
        let insertIdx = this.queue.length;
        for (let i = 0; i < this.queue.length; i++) {
          if (this.queue[i].entry.priority < dialogueEntry.priority) {
            insertIdx = i;
            break;
          }
        }
        this.queue.splice(insertIdx, 0, item);
      }

      this.processNext();
    });
  }

  private processNext(): void {
    if (this.isProcessing || this.isDisposed) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue.shift()!;

    const delay = item.entry.delayMs;
    const go = () => this.playEntry(item);

    if (delay > 0) {
      this.processTimeout = setTimeout(go, delay);
    } else {
      go();
    }
  }

  private async playEntry(item: QueuedItem): Promise<void> {
    if (this.isDisposed) {
      item.resolveFinished();
      this.isProcessing = false;
      return;
    }

    const { entry: dialogueEntry } = item;
    this.currentPriority = dialogueEntry.priority;

    // Show comms message in UI
    if (this.onCommsMessage) {
      const msg: CommsMessage = {
        sender: dialogueEntry.speaker,
        callsign: dialogueEntry.callsign,
        portrait: dialogueEntry.portrait,
        text: dialogueEntry.text,
      };
      this.onCommsMessage(msg);
    }

    // Play voice audio
    const audio = getAudioManager();
    const voiceVol = audio.getVoiceVolume();
    const synth = getVoiceSynthesizer();

    try {
      this.currentPlayback = synth.speak(dialogueEntry.text, REYES_VOICE, voiceVol * 0.35);
      await this.currentPlayback.finished;
    } catch {
      // AudioContext not available or disposed
    }

    this.currentPlayback = null;
    this.currentPriority = DialoguePriority.LOW;
    item.resolveFinished();
    this.isProcessing = false;

    // Process next in queue
    this.processNext();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let managerInstance: ReyesDialogueManager | null = null;

export function getReyesDialogueManager(
  onCommsMessage?: (msg: CommsMessage) => void,
): ReyesDialogueManager {
  if (!managerInstance) {
    managerInstance = new ReyesDialogueManager(onCommsMessage);
  } else if (onCommsMessage) {
    managerInstance.setCommsCallback(onCommsMessage);
  }
  return managerInstance;
}

export function disposeReyesDialogueManager(): void {
  if (managerInstance) {
    managerInstance.dispose();
    managerInstance = null;
  }
}
