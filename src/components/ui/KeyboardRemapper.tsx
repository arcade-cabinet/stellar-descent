/**
 * KeyboardRemapper - Visual keyboard for key binding selection
 *
 * Uses simple-keyboard core library for visual QWERTY display.
 * - Mobile: Shows visual keyboard for tap-to-select
 * - Desktop: Uses "press any key" listening mode
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import {
  ACTION_LABELS,
  type BindableAction,
  getKeyDisplayName,
} from '../../game/stores/useKeybindingsStore';
import { shouldUseVisualKeyboard } from '../../game/utils/PlatformDetector';
import styles from './KeyboardRemapper.module.css';

/**
 * Map simple-keyboard button names to KeyboardEvent.code format
 */
function buttonToKeyCode(button: string): string {
  // Handle special keys
  const specialMap: Record<string, string> = {
    '{space}': 'Space',
    '{enter}': 'Enter',
    '{tab}': 'Tab',
    '{bksp}': 'Backspace',
    '{shift}': 'ShiftLeft',
    '{lock}': 'CapsLock',
    '{ctrl}': 'ControlLeft',
    '{alt}': 'AltLeft',
    '{esc}': 'Escape',
  };

  if (specialMap[button]) {
    return specialMap[button];
  }

  // Handle letter keys
  if (button.length === 1 && /[a-z]/i.test(button)) {
    return `Key${button.toUpperCase()}`;
  }

  // Handle number keys
  if (button.length === 1 && /[0-9]/.test(button)) {
    return `Digit${button}`;
  }

  // Handle punctuation and symbols
  const punctMap: Record<string, string> = {
    '`': 'Backquote',
    '-': 'Minus',
    '=': 'Equal',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    '\\': 'Backslash',
    ';': 'Semicolon',
    "'": 'Quote',
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
  };

  if (punctMap[button]) {
    return punctMap[button];
  }

  return button;
}

interface KeyboardRemapperProps {
  /** The action being remapped */
  action: BindableAction;
  /** Current key binding for display */
  currentKey: string;
  /** Callback when a new key is selected */
  onKeySelected: (keyCode: string) => void;
  /** Callback to cancel selection */
  onCancel: () => void;
}

/**
 * Visual keyboard picker for mobile or "press any key" for desktop
 */
export function KeyboardRemapper({
  action,
  currentKey,
  onKeySelected,
  onCancel,
}: KeyboardRemapperProps) {
  const [isListening, setIsListening] = useState(false);
  const keyboardRef = useRef<Keyboard | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const useVisual = shouldUseVisualKeyboard();

  // Handle keyboard button press (visual mode)
  const handleKeyPress = useCallback(
    (button: string) => {
      // Ignore modifier-only keys
      if (button === '{shift}' || button === '{lock}') return;

      const keyCode = buttonToKeyCode(button);
      onKeySelected(keyCode);
    },
    [onKeySelected]
  );

  // Initialize simple-keyboard for visual mode
  useEffect(() => {
    if (!useVisual || !containerRef.current) return;

    // Find or create the keyboard container
    let keyboardEl = containerRef.current.querySelector('.simple-keyboard');
    if (!keyboardEl) {
      keyboardEl = document.createElement('div');
      keyboardEl.className = 'simple-keyboard';
      containerRef.current.appendChild(keyboardEl);
    }

    keyboardRef.current = new Keyboard('.simple-keyboard', {
      layoutName: 'default',
      onKeyPress: handleKeyPress,
      theme: 'hg-theme-default stellar-keyboard-dark',
      layout: {
        default: [
          '{esc} ` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
          '{tab} q w e r t y u i o p [ ] \\',
          "{lock} a s d f g h j k l ; ' {enter}",
          '{shift} z x c v b n m , . / {shift}',
          '{ctrl} {alt} {space} {alt} {ctrl}',
        ],
      },
      display: {
        '{bksp}': 'BACK',
        '{enter}': 'ENTER',
        '{shift}': 'SHIFT',
        '{space}': 'SPACE',
        '{tab}': 'TAB',
        '{lock}': 'CAPS',
        '{ctrl}': 'CTRL',
        '{alt}': 'ALT',
        '{esc}': 'ESC',
      },
      // Highlight common gaming keys
      buttonTheme: [
        { class: styles.highlightWasd, buttons: 'w a s d' },
        { class: styles.highlightAction, buttons: 'e r f q' },
        { class: styles.highlightModifier, buttons: '{shift} {ctrl} {space}' },
      ],
      preventMouseDownDefault: true,
      stopMouseDownPropagation: true,
    });

    return () => {
      keyboardRef.current?.destroy();
      keyboardRef.current = null;
    };
  }, [useVisual, handleKeyPress]);

  // Handle physical key press (desktop listening mode)
  useEffect(() => {
    if (useVisual || !isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels
      if (e.code === 'Escape') {
        setIsListening(false);
        onCancel();
        return;
      }

      onKeySelected(e.code);
      setIsListening(false);
    };

    // Handle mouse buttons
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();

      // Map mouse buttons
      const mouseMap: Record<number, string> = {
        0: 'Mouse0', // Left click
        1: 'Mouse2', // Middle click
        2: 'Mouse1', // Right click
      };

      if (mouseMap[e.button]) {
        onKeySelected(mouseMap[e.button]);
        setIsListening(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
    };
  }, [useVisual, isListening, onKeySelected, onCancel]);

  // Desktop: "Press any key" mode
  if (!useVisual) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.actionLabel}>{ACTION_LABELS[action]}</span>
          <span className={styles.currentKey}>{getKeyDisplayName(currentKey)}</span>
        </div>

        {isListening ? (
          <div className={styles.listeningOverlay}>
            <div className={styles.listeningBox}>
              <div className={styles.listeningPulse} />
              <span className={styles.listeningText}>PRESS ANY KEY</span>
              <span className={styles.listeningHint}>or ESC to cancel</span>
            </div>
          </div>
        ) : (
          <button className={styles.rebindButton} onClick={() => setIsListening(true)}>
            REBIND
          </button>
        )}

        <button className={styles.cancelButton} onClick={onCancel}>
          CANCEL
        </button>
      </div>
    );
  }

  // Mobile: Visual keyboard mode
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.actionLabel}>{ACTION_LABELS[action]}</span>
        <span className={styles.currentKey}>{getKeyDisplayName(currentKey)}</span>
      </div>

      <div className={styles.instruction}>TAP A KEY TO BIND</div>

      <div ref={containerRef} className={styles.keyboardContainer} />

      <button className={styles.cancelButton} onClick={onCancel}>
        CANCEL
      </button>
    </div>
  );
}

export default KeyboardRemapper;
