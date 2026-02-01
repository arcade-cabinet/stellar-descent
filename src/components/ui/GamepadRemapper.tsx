/**
 * GamepadRemapper - Visual gamepad for button binding selection
 *
 * Features:
 * - Visual gamepad layout showing all buttons
 * - Different visual styles for Xbox, PlayStation, Nintendo controllers
 * - Tap to select button OR press button on controller
 * - Real-time button press detection
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTION_LABELS,
  type BindableAction,
  DYNAMIC_ACTION_LABELS,
  type DynamicAction,
  GAMEPAD_INDEX_TO_BUTTON,
  type GamepadButton,
  getGamepadButtonLabel,
} from '../../game/stores/useKeybindingsStore';
import {
  type ControllerType,
  getConnectedGamepads,
  getRawGamepads,
} from '../../game/utils/PlatformDetector';
import styles from './GamepadRemapper.module.css';

interface GamepadRemapperProps {
  /** The action being remapped */
  action: BindableAction | DynamicAction;
  /** Current button binding for display */
  currentButton: GamepadButton | undefined;
  /** Callback when a new button is selected */
  onButtonSelected: (button: GamepadButton) => void;
  /** Callback to cancel selection */
  onCancel: () => void;
}

/**
 * All available gamepad buttons for selection
 */
const _ALL_GAMEPAD_BUTTONS: GamepadButton[] = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Select',
  'Start',
  'LS',
  'RS',
  'DPadUp',
  'DPadDown',
  'DPadLeft',
  'DPadRight',
  'Home',
];

/**
 * Get action label (works for both core and dynamic actions)
 */
function getActionLabel(action: BindableAction | DynamicAction): string {
  if (action in ACTION_LABELS) {
    return ACTION_LABELS[action as BindableAction];
  }
  if (action in DYNAMIC_ACTION_LABELS) {
    return DYNAMIC_ACTION_LABELS[action as DynamicAction];
  }
  return action;
}

/**
 * Visual gamepad picker with button press detection
 */
export function GamepadRemapper({
  action,
  currentButton,
  onButtonSelected,
  onCancel,
}: GamepadRemapperProps) {
  const [selectedButton, setSelectedButton] = useState<GamepadButton | null>(null);
  const [pressedButtons, setPressedButtons] = useState<Set<GamepadButton>>(new Set());
  const [isListening, _setIsListening] = useState(true);
  const [controllerType, setControllerType] = useState<ControllerType>('xbox');
  const pollingRef = useRef<number | null>(null);
  const previousButtonsRef = useRef<boolean[]>([]);

  // Detect controller type from connected gamepads
  useEffect(() => {
    const gamepads = getConnectedGamepads();
    if (gamepads.length > 0) {
      setControllerType(gamepads[0].controllerType);
    }
  }, []);

  // Poll for gamepad button presses
  useEffect(() => {
    if (!isListening) return;

    const pollGamepad = () => {
      const gamepads = getRawGamepads();
      if (gamepads.length === 0) {
        pollingRef.current = requestAnimationFrame(pollGamepad);
        return;
      }

      const gamepad = gamepads[0];
      const newPressedButtons = new Set<GamepadButton>();
      let buttonJustPressed: GamepadButton | null = null;

      // Check each button
      gamepad.buttons.forEach((button, index) => {
        const gpButton = GAMEPAD_INDEX_TO_BUTTON[index];
        if (!gpButton) return;

        const isPressed = button.pressed || button.value > 0.5;
        if (isPressed) {
          newPressedButtons.add(gpButton);

          // Check if this button was just pressed (wasn't pressed before)
          const wasPressed = previousButtonsRef.current[index];
          if (!wasPressed) {
            buttonJustPressed = gpButton;
          }
        }
      });

      // Update previous button states
      previousButtonsRef.current = gamepad.buttons.map((b) => b.pressed || b.value > 0.5);

      // Update pressed buttons for visual feedback
      setPressedButtons(newPressedButtons);

      // If a button was just pressed, select it
      if (buttonJustPressed) {
        // Ignore Start button as it might be used to cancel
        if (buttonJustPressed === 'Start') {
          onCancel();
          return;
        }

        setSelectedButton(buttonJustPressed);
        onButtonSelected(buttonJustPressed);
        return;
      }

      pollingRef.current = requestAnimationFrame(pollGamepad);
    };

    pollingRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      if (pollingRef.current !== null) {
        cancelAnimationFrame(pollingRef.current);
      }
    };
  }, [isListening, onButtonSelected, onCancel]);

  // Handle visual button click
  const handleButtonClick = useCallback((button: GamepadButton) => {
    setSelectedButton(button);
  }, []);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedButton) {
      onButtonSelected(selectedButton);
    }
  }, [selectedButton, onButtonSelected]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const getButtonLabel = (button: GamepadButton): string => {
    return getGamepadButtonLabel(button, controllerType);
  };

  const getButtonClassName = (button: GamepadButton): string => {
    const classes = [styles.gamepadButton];

    // Button type styling
    if (['A', 'B', 'X', 'Y'].includes(button)) {
      classes.push(styles.faceButton);
      classes.push(styles[`button${button}`]);
    } else if (['LB', 'RB'].includes(button)) {
      classes.push(styles.shoulderButton);
    } else if (['LT', 'RT'].includes(button)) {
      classes.push(styles.triggerButton);
    } else if (button.startsWith('DPad')) {
      classes.push(styles.dpadButton);
    } else if (['LS', 'RS'].includes(button)) {
      classes.push(styles.stickButton);
    } else if (['Select', 'Start', 'Home'].includes(button)) {
      classes.push(styles.menuButton);
    }

    // State styling
    if (pressedButtons.has(button)) {
      classes.push(styles.pressed);
    }
    if (selectedButton === button) {
      classes.push(styles.selected);
    }

    return classes.join(' ');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.actionLabel}>{getActionLabel(action)}</span>
        <span className={styles.currentButton}>
          Current: {currentButton ? getButtonLabel(currentButton) : 'Unbound'}
        </span>
      </div>

      <div className={styles.instruction}>PRESS A BUTTON ON YOUR CONTROLLER</div>

      <div className={styles.gamepadContainer}>
        <div className={`${styles.gamepadVisual} ${styles[controllerType]}`}>
          <div className={styles.controllerType}>
            {controllerType === 'xbox' && 'XBOX CONTROLLER'}
            {controllerType === 'playstation' && 'PLAYSTATION CONTROLLER'}
            {controllerType === 'nintendo' && 'NINTENDO CONTROLLER'}
            {controllerType === 'generic' && 'GAMEPAD'}
          </div>

          <div className={styles.gamepadLayout}>
            {/* Bumpers and Triggers row */}
            <div className={styles.buttonsRow}>
              <div className={styles.bumperRow}>
                <button
                  type="button"
                  className={getButtonClassName('LB')}
                  onClick={() => handleButtonClick('LB')}
                >
                  {getButtonLabel('LB')}
                </button>
                <button
                  type="button"
                  className={getButtonClassName('LT')}
                  onClick={() => handleButtonClick('LT')}
                >
                  {getButtonLabel('LT')}
                </button>
              </div>
              <div className={styles.bumperRow}>
                <button
                  type="button"
                  className={getButtonClassName('RT')}
                  onClick={() => handleButtonClick('RT')}
                >
                  {getButtonLabel('RT')}
                </button>
                <button
                  type="button"
                  className={getButtonClassName('RB')}
                  onClick={() => handleButtonClick('RB')}
                >
                  {getButtonLabel('RB')}
                </button>
              </div>
            </div>

            {/* Menu buttons row */}
            <div className={styles.menuRow}>
              <button
                type="button"
                className={getButtonClassName('Select')}
                onClick={() => handleButtonClick('Select')}
              >
                {getButtonLabel('Select')}
              </button>
              <button
                type="button"
                className={getButtonClassName('Home')}
                onClick={() => handleButtonClick('Home')}
              >
                {getButtonLabel('Home')}
              </button>
              <button
                type="button"
                className={getButtonClassName('Start')}
                onClick={() => handleButtonClick('Start')}
              >
                {getButtonLabel('Start')}
              </button>
            </div>

            {/* D-Pad and Face buttons row */}
            <div className={styles.buttonsRowCenter}>
              {/* D-Pad */}
              <div className={styles.dpadContainer}>
                <button
                  type="button"
                  className={`${getButtonClassName('DPadUp')} ${styles.dpadUp}`}
                  onClick={() => handleButtonClick('DPadUp')}
                >
                  UP
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('DPadDown')} ${styles.dpadDown}`}
                  onClick={() => handleButtonClick('DPadDown')}
                >
                  DN
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('DPadLeft')} ${styles.dpadLeft}`}
                  onClick={() => handleButtonClick('DPadLeft')}
                >
                  LT
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('DPadRight')} ${styles.dpadRight}`}
                  onClick={() => handleButtonClick('DPadRight')}
                >
                  RT
                </button>
                <div className={`${styles.gamepadButton} ${styles.dpadCenter}`} />
              </div>

              {/* Face buttons */}
              <div className={styles.faceButtonsContainer}>
                <button
                  type="button"
                  className={`${getButtonClassName('Y')} ${styles.faceY}`}
                  onClick={() => handleButtonClick('Y')}
                >
                  {getButtonLabel('Y')}
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('X')} ${styles.faceX}`}
                  onClick={() => handleButtonClick('X')}
                >
                  {getButtonLabel('X')}
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('B')} ${styles.faceB}`}
                  onClick={() => handleButtonClick('B')}
                >
                  {getButtonLabel('B')}
                </button>
                <button
                  type="button"
                  className={`${getButtonClassName('A')} ${styles.faceA}`}
                  onClick={() => handleButtonClick('A')}
                >
                  {getButtonLabel('A')}
                </button>
              </div>
            </div>

            {/* Stick buttons row */}
            <div className={styles.stickRow}>
              <button
                type="button"
                className={getButtonClassName('LS')}
                onClick={() => handleButtonClick('LS')}
              >
                {getButtonLabel('LS')}
              </button>
              <button
                type="button"
                className={getButtonClassName('RS')}
                onClick={() => handleButtonClick('RS')}
              >
                {getButtonLabel('RS')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.selectButton}
          onClick={handleConfirm}
          disabled={!selectedButton}
        >
          {selectedButton ? `SELECT ${getButtonLabel(selectedButton)}` : 'SELECT'}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default GamepadRemapper;
