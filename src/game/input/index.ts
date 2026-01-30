/**
 * Input Module
 *
 * Provides utilities for handling player input with customizable keybindings.
 *
 * Usage in levels:
 * - Import getActionKeyInfo() to create action buttons with proper keybindings
 * - Import isKeyEventForAction() to check key events against bindings
 * - Import the InputTracker via getInputTracker() for continuous input polling
 */

// Re-export InputTracker from useInputActions
export { disposeInputTracker, getInputTracker, InputTracker } from '../context/useInputActions';

export type { ActionKeyInfo, LevelSpecificAction } from './InputBridge';
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
} from './InputBridge';
