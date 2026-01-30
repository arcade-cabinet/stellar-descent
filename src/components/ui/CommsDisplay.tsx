import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './CommsDisplay.module.css';

// Single message interface - used by both tutorial and gameplay
export interface CommsMessage {
  sender: string;
  callsign: string;
  text: string;
  portrait?: 'commander' | 'marcus' | 'player' | 'ai' | 'armory';
}

interface CommsDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  message: CommsMessage;
}

export function CommsDisplay({ isOpen, onClose, message }: CommsDisplayProps) {
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const screenInfo = getScreenInfo();
  const hasPlayedSound = useRef(false);

  // Play comms open sound when message appears
  useEffect(() => {
    if (isOpen && message && !hasPlayedSound.current) {
      getAudioManager().play('comms_open', { volume: 0.4 });
      hasPlayedSound.current = true;
    }
    if (!isOpen) {
      hasPlayedSound.current = false;
    }
  }, [isOpen, message]);

  // Typewriter effect
  useEffect(() => {
    if (!isOpen || !message) return;

    setTypedText('');
    setIsTyping(true);

    const text = message.text;
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
  }, [isOpen, message]);

  const handleAdvance = useCallback(() => {
    if (isTyping) {
      // Skip to end of current message
      setTypedText(message?.text || '');
      setIsTyping(false);
      return;
    }

    // Close the comms
    onClose();
  }, [isTyping, message, onClose]);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isOpen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        e.preventDefault();
        handleAdvance();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleAdvance]);

  if (!isOpen || !message) return null;

  const getPortraitClass = () => {
    switch (message.portrait) {
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
    switch (message.portrait) {
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
    <div className={styles.overlay} onClick={handleAdvance}>
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
              <span className={styles.senderName}>{message.sender}</span>
              <span className={styles.senderCallsign}>[{message.callsign}]</span>
            </div>
          </div>

          {/* Message */}
          <div className={styles.messageContainer}>
            <div className={styles.messageText}>
              {typedText}
              {isTyping && <span className={styles.cursor}>|</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.messageCounter}>INCOMING TRANSMISSION</span>
          <button className={styles.advanceButton} onClick={handleAdvance}>
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
