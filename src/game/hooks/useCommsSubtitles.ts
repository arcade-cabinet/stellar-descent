import { useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import {
  type ShowSubtitleOptions,
  type SoundEffectType,
  type SpeakerType,
  useSubtitles,
} from '../context/SubtitleContext';
import type { CommsMessage } from '../types';

/**
 * Map comms portrait to subtitle speaker type
 */
function portraitToSpeaker(portrait: CommsMessage['portrait']): SpeakerType {
  switch (portrait) {
    case 'commander':
      return 'commander';
    case 'marcus':
      return 'marcus';
    case 'ai':
      return 'ai';
    case 'armory':
      return 'armory';
    case 'player':
      return 'player';
    default:
      return 'radio';
  }
}

/**
 * Hook to automatically sync comms messages with the subtitle system
 *
 * This hook observes the current comms message from GameContext and
 * automatically displays corresponding subtitles when messages appear.
 *
 * Features:
 * - Auto-display subtitles for all comms messages
 * - Sync subtitle duration with comms display time
 * - Support for queued messages
 * - Sound effect descriptions for audio cues
 */
export function useCommsSubtitles() {
  const { currentComms, commsDismissedFlag } = useGame();
  const { showSubtitle, hideSubtitle, showSoundEffect, clearSubtitles, settings } = useSubtitles();
  const currentSubtitleIdRef = useRef<string | null>(null);
  const lastCommsRef = useRef<CommsMessage | null>(null);

  // Show subtitle when comms message appears
  useEffect(() => {
    if (!settings.enabled) return;

    // New comms message
    if (currentComms && currentComms !== lastCommsRef.current) {
      // Hide previous subtitle if any
      if (currentSubtitleIdRef.current) {
        hideSubtitle(currentSubtitleIdRef.current, true);
      }

      const speaker = portraitToSpeaker(currentComms.portrait);

      // Calculate duration based on text length (approx 150 words/min reading speed)
      // But since comms has manual dismiss, use 0 for manual control
      const options: ShowSubtitleOptions = {
        duration: 0, // Manual dismiss - sync with comms
        priority: 10, // High priority for dialogue
      };

      const id = showSubtitle(speaker, currentComms.text, options);
      currentSubtitleIdRef.current = id;
      lastCommsRef.current = currentComms;
    }
  }, [currentComms, settings.enabled, showSubtitle, hideSubtitle]);

  // Hide subtitle when comms is dismissed
  useEffect(() => {
    if (commsDismissedFlag > 0 && currentSubtitleIdRef.current) {
      hideSubtitle(currentSubtitleIdRef.current, true);
      currentSubtitleIdRef.current = null;
      lastCommsRef.current = null;
    }
  }, [commsDismissedFlag, hideSubtitle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSubtitleIdRef.current) {
        hideSubtitle(currentSubtitleIdRef.current, false);
      }
    };
  }, [hideSubtitle]);

  /**
   * Show a subtitle with sound effect indicator
   */
  const showWithSoundEffect = useCallback(
    (speaker: SpeakerType, text: string, soundEffect: SoundEffectType, duration?: number) => {
      // Show sound effect first
      showSoundEffect(soundEffect, 1500);

      // Then show the dialogue
      return showSubtitle(speaker, text, {
        duration: duration ?? 0,
        priority: 5,
      });
    },
    [showSubtitle, showSoundEffect]
  );

  /**
   * Show an audio log subtitle (longer duration, queued)
   */
  const showAudioLog = useCallback(
    (speaker: SpeakerType, text: string) => {
      // Audio logs get longer display time
      const words = text.split(/\s+/).length;
      const duration = Math.max(4000, Math.min(12000, words * 300));

      return showSubtitle(speaker, text, {
        duration,
        priority: 3,
      });
    },
    [showSubtitle]
  );

  return {
    showSubtitle,
    hideSubtitle,
    showSoundEffect,
    showWithSoundEffect,
    showAudioLog,
    clearSubtitles,
    isEnabled: settings.enabled,
  };
}
