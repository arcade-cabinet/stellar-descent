/**
 * Input Module
 *
 * Provides utilities for handling player input with customizable keybindings.
 *
 * Usage in levels:
 * - Import getInputManager() for unified input handling with keybindings
 * - Import getActionKeyInfo() to create action buttons with proper keybindings
 * - Import isKeyEventForAction() to check key events against bindings
 * - Import the InputTracker via getInputTracker() for legacy continuous input polling
 *
 * The InputManager is the preferred way to handle input as it:
 * - Respects user keybindings from KeybindingsContext
 * - Polls connected gamepads and maps buttons to actions
 * - Combines keyboard/mouse/gamepad/touch into unified input
 * - Provides isActionPressed(action) for action-based queries
 */

// Primary input manager (preferred)
export {
  disposeInputManager,
  getInputManager,
  InputManager,
  type AnalogState,
  type AnyAction,
  type InputSource,
  type InputState,
  type TouchInputState,
} from './InputManager';

// Legacy InputTracker (for backwards compatibility)
export { disposeInputTracker, getInputTracker, InputTracker } from '../context/useInputActions';

export type { ActionKeyInfo, LevelSpecificAction, WeaponSwitchAction, TouchWeaponSwitchInput } from './InputBridge';
export {
  // Default key info
  ACTION_DEFAULT_KEYS,
  // Action creation helpers
  bindableActionParams,
  // Key display formatting
  formatKeyForDisplay,
  // Action key lookups
  getActionKeyInfo,
  getAllKeysForAction,
  getKeyDisplayForAction,
  getKeyForAction,
  // Level-specific actions
  getLevelSpecificKeyInfo,
  isDefaultKeyForAction,
  // Key event matching
  isKeyEventForAction,
  isMouseEventForAction,
  LEVEL_SPECIFIC_KEYS,
  levelActionParams,
  // Weapon switching
  WEAPON_SWITCH_KEYS,
  getWeaponSwitchKeyInfo,
  isWeaponSwitchKeyEvent,
  getWeaponSlotFromKeyEvent,
  isQuickSwapKeyEvent,
  handleWeaponSwitchKeyEvent,
  handleWeaponSwitchWheelEvent,
  handleWeaponSwitchTouchInput,
  setupWeaponSwitchListeners,
} from './InputBridge';
