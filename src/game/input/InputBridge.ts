/**
 * Input Bridge - Connects KeybindingsContext to level input handlers
 *
 * This module provides utilities to:
 * - Get the current key binding for any action
 * - Format keys for display on action buttons
 * - Check if a key event matches an action
 * - Create action buttons with proper keybinding lookups
 *
 * The bridge ensures all levels use consistent, user-configurable keybindings.
 */

import type { BindableAction, KeybindingValue } from '../context/KeybindingsContext';
import {
  DEFAULT_KEYBINDINGS,
  getKeyDisplayName,
  getKeysForAction,
  getPrimaryKey,
} from '../context/KeybindingsContext';
import { getKeybindings } from '../context/useInputActions';

// ============================================================================
// KEY DISPLAY FORMATTING
// ============================================================================

/**
 * Format a key code for display on HUD/action buttons.
 * Uses the centralized display name mapping from KeybindingsContext.
 *
 * @param keyCode - The key code (e.g., 'KeyE', 'Space', 'Mouse0')
 * @returns Display string (e.g., 'E', 'SPACE', 'CLICK')
 */
export function formatKeyForDisplay(keyCode: string): string {
  return getKeyDisplayName(keyCode).toUpperCase();
}

/**
 * Get the primary key code for a bindable action.
 *
 * @param action - The action to look up
 * @returns The primary key code (e.g., 'KeyE' for interact)
 */
export function getKeyForAction(action: BindableAction): string {
  const bindings = getKeybindings();
  return getPrimaryKey(bindings[action]);
}

/**
 * Get all key codes for a bindable action (primary + alternatives).
 *
 * @param action - The action to look up
 * @returns Array of key codes bound to the action
 */
export function getAllKeysForAction(action: BindableAction): string[] {
  const bindings = getKeybindings();
  return getKeysForAction(bindings[action]);
}

/**
 * Get the display string for a bindable action's primary key.
 *
 * @param action - The action to look up
 * @returns Display string for the primary key (e.g., 'E' for interact)
 */
export function getKeyDisplayForAction(action: BindableAction): string {
  const key = getKeyForAction(action);
  return formatKeyForDisplay(key);
}

/**
 * Check if a keyboard event matches any key bound to an action.
 *
 * @param event - The keyboard event
 * @param action - The action to check
 * @returns True if the event's key matches the action binding
 */
export function isKeyEventForAction(event: KeyboardEvent, action: BindableAction): boolean {
  const keys = getAllKeysForAction(action);
  return keys.includes(event.code);
}

/**
 * Check if a mouse event matches any mouse binding for an action.
 *
 * @param event - The mouse event
 * @param action - The action to check
 * @returns True if the event's button matches the action binding
 */
export function isMouseEventForAction(event: MouseEvent, action: BindableAction): boolean {
  const keys = getAllKeysForAction(action);
  const mouseKey = `Mouse${event.button}`;
  return keys.includes(mouseKey);
}

// ============================================================================
// ACTION BUTTON HELPERS
// ============================================================================

/**
 * Action info containing key code and display string.
 */
export interface ActionKeyInfo {
  /** The key code (e.g., 'KeyE', 'Space', 'Mouse0') */
  key: string;
  /** The display string (e.g., 'E', 'SPACE', 'CLICK') */
  keyDisplay: string;
}

/**
 * Get key info for creating action buttons from a bindable action.
 * This ensures action buttons display the user's actual keybinding.
 *
 * @param action - The bindable action
 * @returns Key code and display string for the action
 */
export function getActionKeyInfo(action: BindableAction): ActionKeyInfo {
  const key = getKeyForAction(action);
  return {
    key,
    keyDisplay: formatKeyForDisplay(key),
  };
}

/**
 * Map of bindable actions to their default keys.
 * Used for documentation and fallback purposes.
 */
export const ACTION_DEFAULT_KEYS: Record<BindableAction, string> = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  sprint: 'ShiftLeft',
  fire: 'Mouse0',
  reload: 'KeyR',
  interact: 'KeyE',
  pause: 'Escape',
};

/**
 * Check if a key code is the default for an action (ignoring user customizations).
 *
 * @param action - The action to check
 * @param keyCode - The key code to compare
 * @returns True if keyCode is the default for the action
 */
export function isDefaultKeyForAction(action: BindableAction, keyCode: string): boolean {
  const defaultBinding = DEFAULT_KEYBINDINGS[action];
  const defaultKeys = getKeysForAction(defaultBinding);
  return defaultKeys.includes(keyCode);
}

// ============================================================================
// LEVEL-SPECIFIC ACTIONS (NOT CONFIGURABLE)
// ============================================================================

/**
 * Level-specific actions that are NOT part of the global keybindings system.
 * These are intentionally hardcoded as they are unique to specific levels.
 */
export type LevelSpecificAction =
  | 'flashlight' // F - FOB Delta
  | 'scanner' // T - FOB Delta, The Breach
  | 'grenade' // G - Combat levels
  | 'melee' // V - Combat levels
  | 'callMarcus' // C - Brothers in Arms
  | 'igniteJets' // Space - Landfall (contextual)
  | 'boost' // Space - Landfall (contextual)
  | 'brake' // E - Landfall (contextual)
  | 'stabilize' // Q - Landfall (contextual)
  | 'flare'; // F - Extraction

/**
 * Default keys for level-specific actions.
 * These are fixed and not configurable by the user.
 */
export const LEVEL_SPECIFIC_KEYS: Record<LevelSpecificAction, string> = {
  flashlight: 'KeyF',
  scanner: 'KeyT',
  grenade: 'KeyG',
  melee: 'KeyV',
  callMarcus: 'KeyC',
  igniteJets: 'Space',
  boost: 'Space',
  brake: 'KeyE',
  stabilize: 'KeyQ',
  flare: 'KeyF',
};

/**
 * Get key info for a level-specific action.
 *
 * @param action - The level-specific action
 * @returns Key code and display string for the action
 */
export function getLevelSpecificKeyInfo(action: LevelSpecificAction): ActionKeyInfo {
  const key = LEVEL_SPECIFIC_KEYS[action];
  return {
    key,
    keyDisplay: formatKeyForDisplay(key),
  };
}

// ============================================================================
// COMBINED ACTION CREATION
// ============================================================================

/**
 * Create action button parameters for a configurable bindable action.
 * Use this when the action should respect user keybindings.
 *
 * @param action - The bindable action
 * @returns Object with key and keyDisplay for createAction()
 */
export function bindableActionParams(action: BindableAction): { key: string; keyDisplay: string } {
  return getActionKeyInfo(action);
}

/**
 * Create action button parameters for a level-specific fixed action.
 * Use this when the action has a fixed key that is not configurable.
 *
 * @param action - The level-specific action
 * @returns Object with key and keyDisplay for createAction()
 */
export function levelActionParams(action: LevelSpecificAction): {
  key: string;
  keyDisplay: string;
} {
  return getLevelSpecificKeyInfo(action);
}
