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

import type { BindableAction } from '../stores/useKeybindingsStore';
import {
  DEFAULT_KEYBINDINGS,
  getKeybindings,
  getKeyDisplayName,
  getKeysForAction,
  getPrimaryKey,
} from '../stores/useKeybindingsStore';

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
  | 'flare' // F - Extraction
  | 'jetpack' // Space (hold) - Jetpack boost
  // Vehicle-specific actions
  | 'vehicleAccelerate' // W/Up - Accelerate vehicle
  | 'vehicleBrake' // S/Down - Brake/reverse vehicle
  | 'vehicleSteerLeft' // A/Left - Steer left
  | 'vehicleSteerRight' // D/Right - Steer right
  | 'vehicleHandbrake' // Space - Handbrake/Boost
  | 'vehicleFire' // Mouse0 - Fire vehicle weapons
  | 'vehicleSecondaryFire' // Mouse1 - Secondary weapon
  | 'vehicleExit' // E - Exit vehicle (when stopped)
  | 'vehicleTurretAim'; // Mouse - Turret aim (implied by mouse movement)

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
  jetpack: 'Space',
  // Vehicle controls
  vehicleAccelerate: 'KeyW',
  vehicleBrake: 'KeyS',
  vehicleSteerLeft: 'KeyA',
  vehicleSteerRight: 'KeyD',
  vehicleHandbrake: 'Space',
  vehicleFire: 'Mouse0',
  vehicleSecondaryFire: 'Mouse1',
  vehicleExit: 'KeyE',
  vehicleTurretAim: 'MouseMove',
};

/**
 * Alternative keys for vehicle controls (arrows, etc.)
 */
export const VEHICLE_ALT_KEYS: Record<string, string[]> = {
  vehicleAccelerate: ['KeyW', 'ArrowUp'],
  vehicleBrake: ['KeyS', 'ArrowDown'],
  vehicleSteerLeft: ['KeyA', 'ArrowLeft'],
  vehicleSteerRight: ['KeyD', 'ArrowRight'],
};

/**
 * Check if any key in a set of alternatives is pressed.
 */
export function isVehicleKeyPressed(
  action: LevelSpecificAction,
  keysPressed: Set<string>
): boolean {
  const primaryKey = LEVEL_SPECIFIC_KEYS[action];
  if (keysPressed.has(primaryKey)) return true;

  const alts = VEHICLE_ALT_KEYS[action];
  if (alts) {
    for (const key of alts) {
      if (keysPressed.has(key)) return true;
    }
  }
  return false;
}

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

// ============================================================================
// WEAPON SWITCHING KEYS (Fixed bindings for weapon slots)
// ============================================================================

/**
 * Weapon switching actions - always available during gameplay
 */
export type WeaponSwitchAction =
  | 'weaponSlot1' // 1 - First weapon slot
  | 'weaponSlot2' // 2 - Second weapon slot
  | 'weaponSlot3' // 3 - Third weapon slot
  | 'weaponSlot4' // 4 - Fourth weapon slot
  | 'weaponQuickSwap' // Q - Last weapon quick swap
  | 'weaponNext' // Mouse wheel up
  | 'weaponPrevious'; // Mouse wheel down

/**
 * Default keys for weapon switching.
 * These are fixed and not configurable by the user.
 */
export const WEAPON_SWITCH_KEYS: Record<WeaponSwitchAction, string> = {
  weaponSlot1: 'Digit1',
  weaponSlot2: 'Digit2',
  weaponSlot3: 'Digit3',
  weaponSlot4: 'Digit4',
  weaponQuickSwap: 'KeyQ',
  weaponNext: 'WheelUp', // Special: handled via wheel event
  weaponPrevious: 'WheelDown', // Special: handled via wheel event
};

/**
 * Get key info for a weapon switch action.
 *
 * @param action - The weapon switch action
 * @returns Key code and display string for the action
 */
export function getWeaponSwitchKeyInfo(action: WeaponSwitchAction): ActionKeyInfo {
  const key = WEAPON_SWITCH_KEYS[action];
  return {
    key,
    keyDisplay: formatKeyForDisplay(key),
  };
}

/**
 * Check if a keyboard event matches a weapon switch action.
 *
 * @param event - The keyboard event
 * @param action - The weapon switch action to check
 * @returns True if the event's key matches the action
 */
export function isWeaponSwitchKeyEvent(event: KeyboardEvent, action: WeaponSwitchAction): boolean {
  const key = WEAPON_SWITCH_KEYS[action];
  return event.code === key;
}

/**
 * Get the weapon slot (0-3) from a keyboard event, or -1 if not a slot key.
 *
 * @param event - The keyboard event
 * @returns Slot index (0-3) or -1
 */
export function getWeaponSlotFromKeyEvent(event: KeyboardEvent): number {
  switch (event.code) {
    case 'Digit1':
      return 0;
    case 'Digit2':
      return 1;
    case 'Digit3':
      return 2;
    case 'Digit4':
      return 3;
    default:
      return -1;
  }
}

/**
 * Check if a keyboard event is the quick swap key (Q).
 *
 * @param event - The keyboard event
 * @returns True if quick swap key
 */
export function isQuickSwapKeyEvent(event: KeyboardEvent): boolean {
  return event.code === WEAPON_SWITCH_KEYS.weaponQuickSwap;
}

// ============================================================================
// WEAPON SWITCHING INPUT HANDLER
// ============================================================================

import {
  cycleWeapon as cycleWeaponAction,
  quickSwapWeapon,
  switchToWeaponSlot,
} from '../context/useWeaponActions';

/**
 * Handle weapon switching keyboard input.
 * Call this from your level's keydown handler.
 *
 * @param event - The keyboard event
 * @returns True if the event was handled (weapon switch triggered)
 */
export function handleWeaponSwitchKeyEvent(event: KeyboardEvent): boolean {
  // Check for number key weapon slots (1-4)
  const slot = getWeaponSlotFromKeyEvent(event);
  if (slot >= 0) {
    switchToWeaponSlot(slot);
    return true;
  }

  // Check for quick swap (Q key)
  if (isQuickSwapKeyEvent(event)) {
    quickSwapWeapon();
    return true;
  }

  return false;
}

/**
 * Handle weapon switching mouse wheel input.
 * Call this from your level's wheel handler.
 *
 * @param event - The wheel event
 * @returns True if the event was handled
 */
export function handleWeaponSwitchWheelEvent(event: WheelEvent): boolean {
  if (event.deltaY < 0) {
    // Scroll up - previous weapon
    cycleWeaponAction(-1);
    return true;
  } else if (event.deltaY > 0) {
    // Scroll down - next weapon
    cycleWeaponAction(1);
    return true;
  }
  return false;
}

/**
 * Interface for touch weapon switching
 */
export interface TouchWeaponSwitchInput {
  /** True if player swiped left on weapon area */
  swipeLeft: boolean;
  /** True if player swiped right on weapon area */
  swipeRight: boolean;
  /** Slot number tapped (0-3) or -1 if none */
  slotTapped: number;
}

/**
 * Handle weapon switching touch input.
 * Call this from your level's touch input handler.
 *
 * @param input - The touch weapon switch input state
 * @returns True if any input was handled
 */
export function handleWeaponSwitchTouchInput(input: TouchWeaponSwitchInput): boolean {
  if (input.swipeLeft) {
    cycleWeaponAction(-1);
    return true;
  }

  if (input.swipeRight) {
    cycleWeaponAction(1);
    return true;
  }

  if (input.slotTapped >= 0) {
    switchToWeaponSlot(input.slotTapped);
    return true;
  }

  return false;
}

/**
 * Create weapon switching event listeners and return a cleanup function.
 * This is a convenience function for levels that want automatic weapon switching.
 *
 * @param canvas - The canvas element (for wheel events)
 * @returns Cleanup function to remove listeners
 */
export function setupWeaponSwitchListeners(canvas: HTMLCanvasElement): () => void {
  const keydownHandler = (e: KeyboardEvent) => {
    handleWeaponSwitchKeyEvent(e);
  };

  const wheelHandler = (e: WheelEvent) => {
    // Only handle wheel for weapon switching when pointer is locked (in gameplay)
    if (document.pointerLockElement === canvas) {
      if (handleWeaponSwitchWheelEvent(e)) {
        e.preventDefault();
      }
    }
  };

  window.addEventListener('keydown', keydownHandler);
  canvas.addEventListener('wheel', wheelHandler, { passive: false });

  return () => {
    window.removeEventListener('keydown', keydownHandler);
    canvas.removeEventListener('wheel', wheelHandler);
  };
}
