/**
 * MarcusVoice - Marcus Cole AI Companion Voice System
 *
 * Provides procedural radio-filtered voice synthesis for Corporal Marcus Cole
 * during the Brothers in Arms level and any subsequent appearances.
 *
 * Marcus uses a distinct voice profile (deep male, higher static for field comms)
 * that contrasts with Commander Vasquez's cleaner command channel.
 *
 * This module bridges the existing MarcusBanterManager (which handles dialogue
 * selection and triggers) with the VoiceSynthesizer (which generates audio).
 *
 * Integration points:
 * - MarcusBanterManager dispatches CommsMessage -> MarcusVoice plays audio
 * - SubtitleContext displays the text
 * - AudioManager controls voice volume
 *
 * Additional dialogue categories unique to this module:
 * - Reunion dialogue (first meeting Marcus in Brothers in Arms)
 * - Combat callouts with audio synthesis
 */

import type { CommsMessage } from '../types';
import { getAudioManager } from '../core/AudioManager';
import {
  type VoicePlaybackHandle,
  type VoiceProfile,
  MARCUS_VOICE,
  getVoiceSynthesizer,
} from './VoiceSynthesizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarcusVoiceEvent =
  // Reunion sequence
  | 'reunion_first_contact'
  | 'reunion_visual'
  | 'reunion_greeting'
  | 'reunion_status_report'
  // Special combat moments
  | 'mech_power_up'
  | 'mech_weapons_hot'
  | 'mech_damage_warning'
  | 'mech_shields_down'
  | 'mech_critical'
  // Mission-critical
  | 'covering_fire'
  | 'suppressing'
  | 'breach_farewell'
  // Generic -- pass through from banter system
  | 'banter';

/** Reunion dialogue sequence -- played in order during Brothers in Arms intro */
export interface ReunionLine {
  event: MarcusVoiceEvent;
  text: string;
  delayMs: number;
}

// ---------------------------------------------------------------------------
// Reunion dialogue data
// ---------------------------------------------------------------------------

const REUNION_SEQUENCE: ReunionLine[] = [
  {
    event: 'reunion_first_contact',
    text: 'Unknown contact on approach... wait. That IFF. James?!',
    delayMs: 0,
  },
  {
    event: 'reunion_visual',
    text: 'I have visual! SPECTER, is that you? Please tell me that is you!',
    delayMs: 600,
  },
  {
    event: 'reunion_greeting',
    text: 'James! You beautiful idiot! You actually came! Three weeks I have been waiting!',
    delayMs: 800,
  },
  {
    event: 'reunion_status_report',
    text: 'HAMMER is operational but banged up. Autocannon is hot. I can fight. We can fight.',
    delayMs: 600,
  },
];

// ---------------------------------------------------------------------------
// Special dialogue pools (beyond what marcusBanter.ts covers)
// ---------------------------------------------------------------------------

const MECH_POWER_UP_LINES = [
  'HAMMER powering up! All systems nominal!',
  'Combat walker online! Time to even the odds!',
  'HAMMER is hot! Let them come!',
];

const MECH_WEAPONS_HOT_LINES = [
  'Autocannon spun up! Say the word!',
  'Weapons free! Painting targets!',
  'All barrels green! Ready to rock!',
];

const MECH_DAMAGE_WARNING_LINES = [
  'HAMMER taking hits! Armor holding!',
  'Impact! Systems nominal, keep fighting!',
  'They dinged the paint! Now I am angry!',
];

const MECH_SHIELDS_DOWN_LINES = [
  'Shields are down! Armor only!',
  'Lost the energy barrier! Taking direct hits!',
  'No more shields! Need to play it smart!',
];

const MECH_CRITICAL_LINES = [
  'HAMMER is critical! Multiple system failures!',
  'Red across the board! I cannot take much more!',
  'James, HAMMER is going down! I need cover!',
];

const COVERING_FIRE_LINES = [
  'Covering fire! Move, James!',
  'Suppressing! Go go go!',
  'I have got you covered! Move up!',
];

const SUPPRESSING_LINES = [
  'Laying down fire! They cannot move!',
  'Keeping them pinned! Take the shot!',
  'Suppression fire! Make it count!',
];

const BREACH_FAREWELL_LINES = [
  'HAMMER cannot fit down there. You are on your own, brother.',
  'I will hold topside. Promise me you will come back.',
  'James... be careful down there. I will be right here when you come out.',
];

const EVENT_LINE_POOLS: Partial<Record<MarcusVoiceEvent, string[]>> = {
  mech_power_up: MECH_POWER_UP_LINES,
  mech_weapons_hot: MECH_WEAPONS_HOT_LINES,
  mech_damage_warning: MECH_DAMAGE_WARNING_LINES,
  mech_shields_down: MECH_SHIELDS_DOWN_LINES,
  mech_critical: MECH_CRITICAL_LINES,
  covering_fire: COVERING_FIRE_LINES,
  suppressing: SUPPRESSING_LINES,
  breach_farewell: BREACH_FAREWELL_LINES,
};

// ---------------------------------------------------------------------------
// Marcus character info for CommsMessage
// ---------------------------------------------------------------------------

const MARCUS: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// ---------------------------------------------------------------------------
// MarcusVoiceManager
// ---------------------------------------------------------------------------

/**
 * Manages Marcus Cole's voice synthesis and dialogue playback.
 * Works alongside the existing MarcusBanterManager which handles trigger
 * logic and cooldowns -- this module adds the audio layer.
 */
export class MarcusVoiceManager {
  private currentPlayback: VoicePlaybackHandle | null = null;
  private isDisposed = false;
  private onCommsMessage: ((msg: CommsMessage) => void) | null = null;
  private eventCooldowns: Map<MarcusVoiceEvent, number> = new Map();
  private readonly defaultCooldownMs = 3000;
  private reunionPlayed = false;

  /** The voice profile used for Marcus (can be tweaked at runtime) */
  readonly voiceProfile: VoiceProfile = { ...MARCUS_VOICE };

  constructor(onCommsMessage?: (msg: CommsMessage) => void) {
    this.onCommsMessage = onCommsMessage ?? null;
  }

  /** Update the comms callback */
  setCommsCallback(cb: (msg: CommsMessage) => void): void {
    this.onCommsMessage = cb;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Play a Marcus voice event. Selects a random line from the pool,
   * shows it as a comms message, and synthesizes the voice audio.
   *
   * Returns false if on cooldown or disposed.
   */
  playEvent(event: MarcusVoiceEvent): boolean {
    if (this.isDisposed) return false;

    // Cooldown check
    const now = Date.now();
    const last = this.eventCooldowns.get(event) ?? 0;
    if (now - last < this.defaultCooldownMs) return false;

    const pool = EVENT_LINE_POOLS[event];
    if (!pool || pool.length === 0) return false;

    const text = pool[Math.floor(Math.random() * pool.length)];
    this.eventCooldowns.set(event, now);

    this.playLine(text);
    return true;
  }

  /**
   * Play a specific text line as Marcus (used by MarcusBanterManager integration).
   * This is the bridge between the banter system's CommsMessage output and audio.
   */
  playLine(text: string): void {
    if (this.isDisposed) return;

    // Stop any currently playing line
    if (this.currentPlayback?.isPlaying) {
      this.currentPlayback.stop();
    }

    // Show comms message
    if (this.onCommsMessage) {
      this.onCommsMessage({
        ...MARCUS,
        text,
      });
    }

    // Synthesize voice audio
    const audio = getAudioManager();
    const voiceVol = audio.getVoiceVolume();
    const synth = getVoiceSynthesizer();

    try {
      this.currentPlayback = synth.speak(text, this.voiceProfile, voiceVol * 0.35);
    } catch {
      // AudioContext not available
    }
  }

  /**
   * Play a CommsMessage that originated from the MarcusBanterManager.
   * Only synthesizes audio -- assumes the banter manager already showed the comms UI.
   */
  synthesizeForBanter(message: CommsMessage): void {
    if (this.isDisposed) return;

    // Stop any currently playing line
    if (this.currentPlayback?.isPlaying) {
      this.currentPlayback.stop();
    }

    const audio = getAudioManager();
    const voiceVol = audio.getVoiceVolume();
    const synth = getVoiceSynthesizer();

    try {
      this.currentPlayback = synth.speak(message.text, this.voiceProfile, voiceVol * 0.35);
    } catch {
      // AudioContext not available
    }
  }

  /**
   * Play the full reunion dialogue sequence (Brothers in Arms level intro).
   * Each line is played in order with delays between them.
   *
   * Returns a promise that resolves when the full sequence completes.
   * Can only be played once per session (subsequent calls are no-ops).
   */
  async playReunionSequence(): Promise<void> {
    if (this.isDisposed || this.reunionPlayed) return;
    this.reunionPlayed = true;

    for (const line of REUNION_SEQUENCE) {
      if (this.isDisposed) break;

      // Wait for delay
      if (line.delayMs > 0) {
        await this.delay(line.delayMs);
      }

      // Show comms and play audio
      if (this.onCommsMessage) {
        this.onCommsMessage({
          ...MARCUS,
          text: line.text,
        });
      }

      const audio = getAudioManager();
      const voiceVol = audio.getVoiceVolume();
      const synth = getVoiceSynthesizer();

      try {
        this.currentPlayback = synth.speak(line.text, this.voiceProfile, voiceVol * 0.35);
        await this.currentPlayback.finished;
      } catch {
        // AudioContext not available
      }
    }
  }

  /**
   * Stop any currently playing Marcus dialogue.
   */
  stopCurrent(): void {
    if (this.currentPlayback?.isPlaying) {
      this.currentPlayback.stop();
      this.currentPlayback = null;
    }
  }

  /**
   * Reset cooldowns and reunion state (e.g. on level restart).
   */
  reset(): void {
    this.stopCurrent();
    this.eventCooldowns.clear();
    this.reunionPlayed = false;
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.isDisposed = true;
    this.stopCurrent();
    this.eventCooldowns.clear();
    this.onCommsMessage = null;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Create a MarcusBanterManager-compatible callback that routes audio
   * through this voice manager. Use this to wire up the banter system:
   *
   * ```ts
   * const voice = getMarcusVoiceManager(onComms);
   * const banter = createMarcusBanterManager(voice.createBanterCallback());
   * ```
   */
  createBanterCallback(): (message: CommsMessage) => void {
    return (message: CommsMessage) => {
      // Forward the comms message to the UI
      if (this.onCommsMessage) {
        this.onCommsMessage(message);
      }
      // Synthesize audio
      this.synthesizeForBanter(message);
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let marcusVoiceInstance: MarcusVoiceManager | null = null;

export function getMarcusVoiceManager(
  onCommsMessage?: (msg: CommsMessage) => void,
): MarcusVoiceManager {
  if (!marcusVoiceInstance) {
    marcusVoiceInstance = new MarcusVoiceManager(onCommsMessage);
  } else if (onCommsMessage) {
    marcusVoiceInstance.setCommsCallback(onCommsMessage);
  }
  return marcusVoiceInstance;
}

export function disposeMarcusVoiceManager(): void {
  if (marcusVoiceInstance) {
    marcusVoiceInstance.dispose();
    marcusVoiceInstance = null;
  }
}
