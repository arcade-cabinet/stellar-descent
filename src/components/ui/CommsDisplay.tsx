import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSubtitles } from '../../game/context/SubtitleContext';
import { getAudioManager } from '../../game/core/AudioManager';
import type { CommsMessage, PortraitType } from '../../game/types';
import { getScreenInfo } from '../../game/utils/responsive';
import { useGameEvent } from '../../hooks/useGameEvent';
import styles from './CommsDisplay.module.css';

interface CommsDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  message: CommsMessage;
}

/**
 * Mapping from speaker IDs to portrait types for EventBus-driven messages
 */
const SPEAKER_TO_PORTRAIT: Record<string, PortraitType> = {
  commander: 'commander',
  reyes: 'commander',
  vasquez: 'commander',
  marcus: 'marcus',
  hammer: 'marcus',
  player: 'player',
  cole: 'player',
  specter: 'player',
  ai: 'ai',
  orbital: 'ai',
  armory: 'armory',
  gunnery: 'armory',
};

/**
 * Mapping from speaker IDs to display names
 */
const SPEAKER_TO_NAME: Record<string, string> = {
  commander: 'Cmdr. Elena Vasquez',
  reyes: 'Cmdr. Elena Vasquez',
  vasquez: 'Cmdr. Elena Vasquez',
  marcus: 'Cpl. Marcus Cole',
  hammer: 'Cpl. Marcus Cole',
  player: 'Sgt. James Cole',
  cole: 'Sgt. James Cole',
  specter: 'Sgt. James Cole',
  ai: 'ORBITAL AI',
  orbital: 'ORBITAL AI',
  armory: 'Gunnery Keeper',
  gunnery: 'Gunnery Keeper',
};

/**
 * Mapping from speaker IDs to callsigns
 */
const SPEAKER_TO_CALLSIGN: Record<string, string> = {
  commander: 'ACTUAL',
  reyes: 'ACTUAL',
  vasquez: 'ACTUAL',
  marcus: 'HAMMER',
  hammer: 'HAMMER',
  player: 'SPECTER',
  cole: 'SPECTER',
  specter: 'SPECTER',
  ai: 'ORBITAL',
  orbital: 'ORBITAL',
  armory: 'ARMORY',
  gunnery: 'ARMORY',
};

export function CommsDisplay({ isOpen, onClose, message }: CommsDisplayProps) {
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const screenInfo = getScreenInfo();
  const hasPlayedSound = useRef(false);

  // EventBus-driven message state (supplements props)
  const [eventBusMessage, setEventBusMessage] = useState<CommsMessage | null>(null);
  const [eventBusOpen, setEventBusOpen] = useState(false);
  const dialogueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get subtitle settings for accessibility font size
  const { settings: subtitleSettings, fontSizePx } = useSubtitles();

  // Subscribe to DIALOGUE_STARTED events from EventBus
  useGameEvent('DIALOGUE_STARTED', (event) => {
    // Convert EventBus event to CommsMessage format
    const speakerId = event.speakerId?.toLowerCase() ?? 'ai';
    const commsMessage: CommsMessage = {
      text: event.text ?? '',
      sender: SPEAKER_TO_NAME[speakerId] ?? 'Unknown',
      callsign: SPEAKER_TO_CALLSIGN[speakerId] ?? 'UNKNOWN',
      portrait: SPEAKER_TO_PORTRAIT[speakerId] ?? 'ai',
    };

    setEventBusMessage(commsMessage);
    setEventBusOpen(true);

    // Clear any existing auto-close timeout
    if (dialogueTimeoutRef.current) {
      clearTimeout(dialogueTimeoutRef.current);
    }

    // Auto-close after duration if specified
    if (event.duration && event.duration > 0) {
      dialogueTimeoutRef.current = setTimeout(() => {
        setEventBusOpen(false);
        setEventBusMessage(null);
      }, event.duration);
    }
  });

  // Subscribe to DIALOGUE_ENDED events from EventBus
  useGameEvent('DIALOGUE_ENDED', () => {
    setEventBusOpen(false);
    setEventBusMessage(null);

    if (dialogueTimeoutRef.current) {
      clearTimeout(dialogueTimeoutRef.current);
      dialogueTimeoutRef.current = null;
    }
  });

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (dialogueTimeoutRef.current) {
        clearTimeout(dialogueTimeoutRef.current);
      }
    };
  }, []);

  // Use EventBus message if available, otherwise fall back to props
  const effectiveMessage = eventBusMessage ?? message;
  const effectiveIsOpen = eventBusOpen || isOpen;

  // Play comms open sound when message appears
  useEffect(() => {
    if (effectiveIsOpen && effectiveMessage && !hasPlayedSound.current) {
      getAudioManager().play('comms_open', { volume: 0.4 });
      hasPlayedSound.current = true;
    }
    if (!effectiveIsOpen) {
      hasPlayedSound.current = false;
    }
  }, [effectiveIsOpen, effectiveMessage]);

  // Typewriter effect
  useEffect(() => {
    if (!effectiveIsOpen || !effectiveMessage) return;

    setTypedText('');
    setIsTyping(true);

    const text = effectiveMessage.text;
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setTypedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 20); // Slightly faster for smoother reading

    return () => clearInterval(interval);
  }, [effectiveIsOpen, effectiveMessage]);

  const handleAdvance = useCallback(() => {
    if (isTyping) {
      // Skip to end of current message
      setTypedText(effectiveMessage?.text || '');
      setIsTyping(false);
      return;
    }

    // Close the comms - handle both EventBus and prop-driven modes
    if (eventBusOpen) {
      setEventBusOpen(false);
      setEventBusMessage(null);
      if (dialogueTimeoutRef.current) {
        clearTimeout(dialogueTimeoutRef.current);
        dialogueTimeoutRef.current = null;
      }
    }
    onClose();
  }, [isTyping, effectiveMessage, eventBusOpen, onClose]);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (effectiveIsOpen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        e.preventDefault();
        handleAdvance();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [effectiveIsOpen, handleAdvance]);

  if (!effectiveIsOpen || !effectiveMessage) return null;

  const getPortraitClass = () => {
    switch (effectiveMessage.portrait) {
      case 'commander':
        return styles.portraitCommander;
      case 'marcus':
        return styles.portraitMarcus;
      case 'player':
        return styles.portraitPlayer;
      case 'ai':
        return styles.portraitAI;
      case 'armory':
        return styles.portraitArmory;
      default:
        return styles.portraitDefault;
    }
  };

  const getPortraitInitials = () => {
    switch (effectiveMessage.portrait) {
      case 'commander':
        return 'CV';
      case 'marcus':
        return 'MC';
      case 'player':
        return 'JC';
      case 'ai':
        return 'AI';
      case 'armory':
        return 'GK';
      default:
        return '??';
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdvance();
        }
      }}
      aria-label="Advance message"
    >
      <div className={styles.commsPanel} onClick={(e) => e.stopPropagation()}>
        {/* Header bar */}
        <div className={styles.header}>
          <div className={styles.statusLight} />
          <span className={styles.headerText}>SECURE CHANNEL // PRIORITY ALPHA</span>
          <div className={styles.signalBars}>
            <div className={styles.signalBar} />
            <div className={styles.signalBar} />
            <div className={styles.signalBar} />
          </div>
        </div>

        {/* Main content */}
        <div className={styles.content}>
          {/* Portrait */}
          <div className={`${styles.portrait} ${getPortraitClass()}`}>
            <div className={styles.portraitFrame}>
              <div className={styles.portraitInner}>
                <div className={styles.portraitIcon}>{getPortraitInitials()}</div>
              </div>
              <div className={styles.scanLine} />
            </div>
            <div className={styles.senderInfo}>
              <span className={styles.senderName}>{effectiveMessage.sender}</span>
              <span className={styles.senderCallsign}>[{effectiveMessage.callsign}]</span>
            </div>
          </div>

          {/* Message with accessibility subtitle support */}
          <div className={styles.messageContainer}>
            <div
              className={styles.messageText}
              style={
                subtitleSettings.enabled
                  ? ({ '--subtitle-font-size': `${fontSizePx}px` } as React.CSSProperties)
                  : undefined
              }
              aria-live="polite"
              aria-atomic="false"
            >
              {typedText}
              {isTyping && <span className={styles.cursor}>|</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.messageCounter}>INCOMING TRANSMISSION</span>
          <button type="button" className={styles.advanceButton} onClick={handleAdvance}>
            {isTyping ? '[ SKIP ]' : '[ ACKNOWLEDGE ]'}
          </button>
        </div>

        {/* Decorative elements */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />
      </div>

      {/* Hint text */}
      <p className={styles.hint}>
        {screenInfo.isTouchDevice ? 'TAP TO CONTINUE' : 'CLICK OR PRESS SPACE TO CONTINUE'}
      </p>
    </div>
  );
}
