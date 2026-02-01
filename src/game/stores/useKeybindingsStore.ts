/**
 * useKeybindingsStore - Zustand store for keybindings with localStorage persistence
 *
 * Replaces the legacy KeybindingsContext with a modern Zustand store that:
 * - Persists keybindings to localStorage (not SQLite since keybindings need sync access)
 * - Emits KEYBINDING_CHANGED events via EventBus
 * - Provides type-safe access to all keybindings
 * - Supports dynamic actions for level-specific keybindings
 * - Supports gamepad bindings
 *
 * Note: Uses localStorage instead of SQLite for keybindings because:
 * 1. InputManager needs synchronous access to bindings
 * 2. Keybindings are simple key-value pairs, not complex data
 * 3. Faster startup without async hydration
 *
 * Usage:
 * ```ts
 * import { useKeybindingsStore, useKeybindings } from '../stores/useKeybindingsStore';
 *
 * // In a component using the convenience hook:
 * const { keybindings, setKeybinding, resetToDefaults } = useKeybindings();
 *
 * // Or with direct store access:
 * const keybindings = useKeybindingsStore((state) => state.keybindings);
 * ```
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';

const log = getLogger('KeybindingsStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Core actions that can be bound to keys (always available)
 */
export type BindableAction =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'crouch'
  | 'sprint'
  | 'fire'
  | 'reload'
  | 'interact'
  | 'pause';

/**
 * Dynamic actions that change based on level context
 * These are registered/unregistered per level as needed
 */
export type DynamicAction =
  // Vehicle controls
  | 'vehicleBoost'
  | 'vehicleBrake'
  | 'vehicleEject'
  // Squad commands
  | 'squadFollow'
  | 'squadHold'
  | 'squadAttack'
  | 'squadRegroup'
  // Abilities
  | 'useAbility1'
  | 'useAbility2'
  | 'useAbility3'
  // Additional weapon controls
  | 'weaponMelee'
  | 'weaponGrenade'
  // Movement abilities
  | 'mantle'
  | 'slide';

/**
 * Map of core action names to their display labels
 */
export const ACTION_LABELS: Record<BindableAction, string> = {
  moveForward: 'Move Forward',
  moveBackward: 'Move Backward',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  jump: 'Jump',
  crouch: 'Crouch',
  sprint: 'Sprint',
  fire: 'Fire',
  reload: 'Reload',
  interact: 'Interact',
  pause: 'Pause',
};

/**
 * Map of dynamic action names to their display labels
 */
export const DYNAMIC_ACTION_LABELS: Record<DynamicAction, string> = {
  // Vehicle controls
  vehicleBoost: 'Vehicle Boost',
  vehicleBrake: 'Vehicle Brake',
  vehicleEject: 'Eject from Vehicle',
  // Squad commands
  squadFollow: 'Squad: Follow',
  squadHold: 'Squad: Hold Position',
  squadAttack: 'Squad: Attack',
  squadRegroup: 'Squad: Regroup',
  // Abilities
  useAbility1: 'Ability 1',
  useAbility2: 'Ability 2',
  useAbility3: 'Ability 3',
  // Weapon controls
  weaponMelee: 'Melee Attack',
  weaponGrenade: 'Throw Grenade',
  // Movement abilities
  mantle: 'Mantle',
  slide: 'Slide',
};

/**
 * Keyboard code to display name mapping
 */
export function getKeyDisplayName(code: string): string {
  // Handle mouse buttons
  if (code === 'Mouse0') return 'Left Click';
  if (code === 'Mouse1') return 'Right Click';
  if (code === 'Mouse2') return 'Middle Click';

  // Handle special keys
  const specialKeys: Record<string, string> = {
    Space: 'Space',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt',
    AltRight: 'Right Alt',
    Tab: 'Tab',
    CapsLock: 'Caps Lock',
    Escape: 'Esc',
    Enter: 'Enter',
    Backspace: 'Backspace',
    ArrowUp: 'Up Arrow',
    ArrowDown: 'Down Arrow',
    ArrowLeft: 'Left Arrow',
    ArrowRight: 'Right Arrow',
  };

  if (specialKeys[code]) {
    return specialKeys[code];
  }

  // Handle letter keys (KeyA -> A)
  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  // Handle digit keys (Digit1 -> 1)
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  // Handle numpad keys
  if (code.startsWith('Numpad')) {
    return `Num ${code.slice(6)}`;
  }

  // Fallback to the code itself
  return code;
}

/**
 * Keybinding value - can be a single key or array of keys
 * Array allows primary key + alternatives (e.g., WASD + Arrow keys)
 */
export type KeybindingValue = string | string[];

/**
 * Core keybindings map - action to key code(s)
 */
export type Keybindings = Record<BindableAction, KeybindingValue>;

/**
 * Dynamic keybindings map - dynamic action to key code(s)
 */
export type DynamicBindings = Record<DynamicAction, KeybindingValue>;

/**
 * Helper to normalize keybinding value to array
 */
export function getKeysForAction(binding: KeybindingValue): string[] {
  if (Array.isArray(binding)) {
    return binding;
  }
  return binding ? [binding] : [];
}

/**
 * Helper to get primary (first) key for an action
 */
export function getPrimaryKey(binding: KeybindingValue): string {
  if (Array.isArray(binding)) {
    return binding[0] ?? '';
  }
  return binding ?? '';
}

// ============================================================================
// Gamepad Button Types and Bindings
// ============================================================================

/**
 * Standard gamepad button indices (matches W3C Gamepad API standard mapping)
 * https://w3c.github.io/gamepad/#remapping
 */
export type GamepadButton =
  | 'A' // 0 - Bottom button (A on Xbox, Cross on PlayStation)
  | 'B' // 1 - Right button (B on Xbox, Circle on PlayStation)
  | 'X' // 2 - Left button (X on Xbox, Square on PlayStation)
  | 'Y' // 3 - Top button (Y on Xbox, Triangle on PlayStation)
  | 'LB' // 4 - Left bumper/shoulder
  | 'RB' // 5 - Right bumper/shoulder
  | 'LT' // 6 - Left trigger
  | 'RT' // 7 - Right trigger
  | 'Select' // 8 - Back/Select/Share
  | 'Start' // 9 - Start/Options
  | 'LS' // 10 - Left stick press
  | 'RS' // 11 - Right stick press
  | 'DPadUp' // 12
  | 'DPadDown' // 13
  | 'DPadLeft' // 14
  | 'DPadRight' // 15
  | 'Home'; // 16 - Home/Guide button (not always available)

/**
 * Map GamepadButton to button index
 */
export const GAMEPAD_BUTTON_INDEX: Record<GamepadButton, number> = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Select: 8,
  Start: 9,
  LS: 10,
  RS: 11,
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  Home: 16,
};

/**
 * Map button index to GamepadButton
 */
export const GAMEPAD_INDEX_TO_BUTTON: Record<number, GamepadButton> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'Select',
  9: 'Start',
  10: 'LS',
  11: 'RS',
  12: 'DPadUp',
  13: 'DPadDown',
  14: 'DPadLeft',
  15: 'DPadRight',
  16: 'Home',
};

/**
 * Display names for gamepad buttons (Xbox style as default)
 */
export const GAMEPAD_BUTTON_LABELS: Record<GamepadButton, string> = {
  A: 'A',
  B: 'B',
  X: 'X',
  Y: 'Y',
  LB: 'LB',
  RB: 'RB',
  LT: 'LT',
  RT: 'RT',
  Select: 'Back',
  Start: 'Start',
  LS: 'L3',
  RS: 'R3',
  DPadUp: 'D-Pad Up',
  DPadDown: 'D-Pad Down',
  DPadLeft: 'D-Pad Left',
  DPadRight: 'D-Pad Right',
  Home: 'Guide',
};

/**
 * PlayStation button display names
 */
export const PLAYSTATION_BUTTON_LABELS: Record<GamepadButton, string> = {
  A: 'Cross',
  B: 'Circle',
  X: 'Square',
  Y: 'Triangle',
  LB: 'L1',
  RB: 'R1',
  LT: 'L2',
  RT: 'R2',
  Select: 'Share',
  Start: 'Options',
  LS: 'L3',
  RS: 'R3',
  DPadUp: 'D-Pad Up',
  DPadDown: 'D-Pad Down',
  DPadLeft: 'D-Pad Left',
  DPadRight: 'D-Pad Right',
  Home: 'PS',
};

/**
 * Nintendo button display names
 */
export const NINTENDO_BUTTON_LABELS: Record<GamepadButton, string> = {
  A: 'B', // Nintendo has A/B swapped
  B: 'A',
  X: 'Y', // Nintendo has X/Y swapped
  Y: 'X',
  LB: 'L',
  RB: 'R',
  LT: 'ZL',
  RT: 'ZR',
  Select: '-',
  Start: '+',
  LS: 'L3',
  RS: 'R3',
  DPadUp: 'D-Pad Up',
  DPadDown: 'D-Pad Down',
  DPadLeft: 'D-Pad Left',
  DPadRight: 'D-Pad Right',
  Home: 'Home',
};

/**
 * Get button display name based on controller type
 */
export function getGamepadButtonLabel(
  button: GamepadButton,
  controllerType: 'xbox' | 'playstation' | 'nintendo' | 'generic' = 'xbox'
): string {
  switch (controllerType) {
    case 'playstation':
      return PLAYSTATION_BUTTON_LABELS[button];
    case 'nintendo':
      return NINTENDO_BUTTON_LABELS[button];
    default:
      return GAMEPAD_BUTTON_LABELS[button];
  }
}

/**
 * Gamepad bindings map - action to gamepad button
 * Note: Movement uses analog sticks, so only certain actions are mappable
 */
export type GamepadBindings = Partial<Record<BindableAction | DynamicAction, GamepadButton>>;

/**
 * Default gamepad bindings - sensible FPS defaults
 * Movement is handled by left stick, look by right stick
 */
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  // Core combat
  fire: 'RT',
  reload: 'X',
  interact: 'A',

  // Movement modifiers
  jump: 'A',
  crouch: 'B',
  sprint: 'LS',

  // System
  pause: 'Start',

  // Dynamic actions - vehicle
  vehicleBoost: 'LB',
  vehicleBrake: 'LT',
  vehicleEject: 'Y',

  // Dynamic actions - squad (using D-Pad)
  squadFollow: 'DPadUp',
  squadHold: 'DPadDown',
  squadAttack: 'DPadRight',
  squadRegroup: 'DPadLeft',

  // Abilities
  useAbility1: 'LB',
  useAbility2: 'RB',
  useAbility3: 'Y',

  // Weapon controls
  weaponMelee: 'RS',
  weaponGrenade: 'RB',
};

/**
 * Default keybindings with WASD + Arrow key alternatives for movement
 */
export const DEFAULT_KEYBINDINGS: Keybindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: 'Space',
  crouch: ['ControlLeft', 'KeyC'],
  sprint: 'ShiftLeft',
  fire: 'Mouse0',
  reload: 'KeyR',
  interact: 'KeyE',
  pause: 'Escape',
};

/**
 * Default dynamic keybindings for level-specific actions
 */
export const DEFAULT_DYNAMIC_BINDINGS: DynamicBindings = {
  // Vehicle controls
  vehicleBoost: 'ShiftLeft',
  vehicleBrake: 'Space',
  vehicleEject: 'KeyF',
  // Squad commands - use number keys for quick access
  squadFollow: 'KeyZ',
  squadHold: 'KeyX',
  squadAttack: 'KeyC',
  squadRegroup: 'KeyV',
  // Abilities - mapped to number keys
  useAbility1: 'Digit1',
  useAbility2: 'Digit2',
  useAbility3: 'Digit3',
  // Weapon controls
  weaponMelee: 'KeyQ',
  weaponGrenade: 'KeyG',
  // Movement abilities
  mantle: 'Space',
  slide: 'ControlLeft',
};

/**
 * Registered dynamic action with metadata
 */
export interface RegisteredDynamicAction {
  action: DynamicAction;
  levelId: string;
  category?: string;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEY = 'stellar-descent-keybindings';
const DYNAMIC_STORAGE_KEY = 'stellar-descent-dynamic-keybindings';
const GAMEPAD_STORAGE_KEY = 'stellar-descent-gamepad-bindings';

// ============================================================================
// STORE STATE AND ACTIONS
// ============================================================================

/**
 * Keybindings store state
 */
export interface KeybindingsState {
  /** Current core keybindings */
  keybindings: Keybindings;
  /** Current dynamic keybindings */
  dynamicBindings: DynamicBindings;
  /** Current gamepad bindings */
  gamepadBindings: GamepadBindings;
  /** Currently active (registered) dynamic actions for the current level */
  activeDynamicActions: DynamicAction[];
  /** Whether the store has been initialized */
  _initialized: boolean;
}

/**
 * Keybindings store actions
 */
export interface KeybindingsActions {
  // Core keybinding methods
  /** Check if a key code is bound to a core action (checks all keys for that action) */
  isKeyBound: (code: string, action: BindableAction) => boolean;
  /** Check if a key code is bound to a dynamic action */
  isDynamicKeyBound: (code: string, action: DynamicAction) => boolean;
  /** Get the primary key code for a core action (for display purposes) */
  getKeyForAction: (action: BindableAction) => string;
  /** Get the primary key code for a dynamic action */
  getDynamicKeyForAction: (action: DynamicAction) => string;
  /** Get all key codes for a core action */
  getAllKeysForAction: (action: BindableAction) => string[];
  /** Get all key codes for a dynamic action */
  getAllDynamicKeysForAction: (action: DynamicAction) => string[];
  /** Update a core keybinding (replaces all keys for that action with single key) */
  setKeybinding: (action: BindableAction, code: string) => void;
  /** Update a dynamic keybinding */
  setDynamicBinding: (action: DynamicAction, code: string) => void;
  /** Get the current binding for a dynamic action */
  getDynamicBinding: (action: DynamicAction) => KeybindingValue;
  /** Add an alternative key for a core action */
  addAlternativeKey: (action: BindableAction, code: string) => void;
  /** Add an alternative key for a dynamic action */
  addDynamicAlternativeKey: (action: DynamicAction, code: string) => void;
  /** Reset all keybindings to defaults (core and dynamic) */
  resetToDefaults: () => void;
  /** Reset only dynamic bindings to defaults */
  resetDynamicToDefaults: () => void;
  /** Check if current core bindings differ from defaults */
  hasCustomBindings: () => boolean;
  /** Check if current dynamic bindings differ from defaults */
  hasCustomDynamicBindings: () => boolean;
  /** Register dynamic actions for a level */
  registerDynamicActions: (levelId: string, actions: DynamicAction[], category?: string) => void;
  /** Unregister all dynamic actions for a level */
  unregisterDynamicActions: (levelId: string) => void;
  /** Unregister all dynamic actions (clear all) */
  clearAllDynamicActions: () => void;
  /** Check if a dynamic action is currently active */
  isDynamicActionActive: (action: DynamicAction) => boolean;
  /** Get all registered dynamic actions with their metadata */
  getRegisteredDynamicActions: () => RegisteredDynamicAction[];
  // Gamepad binding methods
  /** Get the gamepad button for an action */
  getGamepadButtonForAction: (action: BindableAction | DynamicAction) => GamepadButton | undefined;
  /** Set a gamepad button for an action */
  setGamepadBinding: (action: BindableAction | DynamicAction, button: GamepadButton) => void;
  /** Remove gamepad binding for an action */
  clearGamepadBinding: (action: BindableAction | DynamicAction) => void;
  /** Reset gamepad bindings to defaults */
  resetGamepadToDefaults: () => void;
  /** Check if current gamepad bindings differ from defaults */
  hasCustomGamepadBindings: () => boolean;
}

export type KeybindingsStoreState = KeybindingsState & KeybindingsActions;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load keybindings from localStorage
 */
function loadKeybindings(): Keybindings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new actions
      return { ...DEFAULT_KEYBINDINGS, ...parsed };
    }
  } catch (e) {
    log.warn('Failed to load keybindings from localStorage', e);
  }
  return { ...DEFAULT_KEYBINDINGS };
}

/**
 * Save keybindings to localStorage
 */
function saveKeybindings(bindings: Keybindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    log.warn('Failed to save keybindings to localStorage', e);
  }
}

/**
 * Load dynamic keybindings from localStorage
 */
function loadDynamicBindings(): DynamicBindings {
  try {
    const stored = localStorage.getItem(DYNAMIC_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new actions
      return { ...DEFAULT_DYNAMIC_BINDINGS, ...parsed };
    }
  } catch (e) {
    log.warn('Failed to load dynamic bindings from localStorage', e);
  }
  return { ...DEFAULT_DYNAMIC_BINDINGS };
}

/**
 * Save dynamic keybindings to localStorage
 */
function saveDynamicBindings(bindings: DynamicBindings): void {
  try {
    localStorage.setItem(DYNAMIC_STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    log.warn('Failed to save dynamic bindings to localStorage', e);
  }
}

/**
 * Load gamepad bindings from localStorage
 */
function loadGamepadBindings(): GamepadBindings {
  try {
    const stored = localStorage.getItem(GAMEPAD_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new actions
      return { ...DEFAULT_GAMEPAD_BINDINGS, ...parsed };
    }
  } catch (e) {
    log.warn('Failed to load gamepad bindings from localStorage', e);
  }
  return { ...DEFAULT_GAMEPAD_BINDINGS };
}

/**
 * Save gamepad bindings to localStorage
 */
function saveGamepadBindings(bindings: GamepadBindings): void {
  try {
    localStorage.setItem(GAMEPAD_STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    log.warn('Failed to save gamepad bindings to localStorage', e);
  }
}

// ============================================================================
// DYNAMIC ACTION REGISTRY
// ============================================================================

// Track registered dynamic actions per level (internal state)
const registeredActionsMap = new Map<string, RegisteredDynamicAction[]>();

// ============================================================================
// STORE CREATION
// ============================================================================

/**
 * Keybindings store with localStorage persistence
 */
export const useKeybindingsStore = create<KeybindingsStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state - load from localStorage
    keybindings: loadKeybindings(),
    dynamicBindings: loadDynamicBindings(),
    gamepadBindings: loadGamepadBindings(),
    activeDynamicActions: [],
    _initialized: true,

    // Core keybinding methods
    isKeyBound: (code: string, action: BindableAction): boolean => {
      const binding = get().keybindings[action];
      const keys = getKeysForAction(binding);
      return keys.includes(code);
    },

    isDynamicKeyBound: (code: string, action: DynamicAction): boolean => {
      const binding = get().dynamicBindings[action];
      const keys = getKeysForAction(binding);
      return keys.includes(code);
    },

    getKeyForAction: (action: BindableAction): string => {
      return getPrimaryKey(get().keybindings[action]);
    },

    getDynamicKeyForAction: (action: DynamicAction): string => {
      return getPrimaryKey(get().dynamicBindings[action]);
    },

    getAllKeysForAction: (action: BindableAction): string[] => {
      return getKeysForAction(get().keybindings[action]);
    },

    getAllDynamicKeysForAction: (action: DynamicAction): string[] => {
      return getKeysForAction(get().dynamicBindings[action]);
    },

    setKeybinding: (action: BindableAction, code: string) => {
      set((state) => {
        // Remove the key from any other action it might be bound to
        const newBindings = { ...state.keybindings };
        for (const [otherAction, boundKeys] of Object.entries(newBindings)) {
          if (otherAction !== action) {
            const keys = getKeysForAction(boundKeys);
            const filteredKeys = keys.filter((k) => k !== code);
            if (filteredKeys.length !== keys.length) {
              // Key was found and removed
              newBindings[otherAction as BindableAction] =
                filteredKeys.length === 1 ? filteredKeys[0] : filteredKeys;
            }
          }
        }
        newBindings[action] = code;

        // Save to localStorage
        saveKeybindings(newBindings);

        // Emit event
        getEventBus().emit({
          type: 'KEYBINDING_CHANGED',
          action,
          binding: code,
          bindingType: 'keyboard',
        });

        return { keybindings: newBindings };
      });
    },

    setDynamicBinding: (action: DynamicAction, code: string) => {
      set((state) => {
        // Remove the key from any other dynamic action it might be bound to
        const newBindings = { ...state.dynamicBindings };
        for (const [otherAction, boundKeys] of Object.entries(newBindings)) {
          if (otherAction !== action) {
            const keys = getKeysForAction(boundKeys);
            const filteredKeys = keys.filter((k) => k !== code);
            if (filteredKeys.length !== keys.length) {
              newBindings[otherAction as DynamicAction] =
                filteredKeys.length === 1 ? filteredKeys[0] : filteredKeys;
            }
          }
        }
        newBindings[action] = code;

        // Save to localStorage
        saveDynamicBindings(newBindings);

        // Emit event
        getEventBus().emit({
          type: 'KEYBINDING_CHANGED',
          action,
          binding: code,
          bindingType: 'keyboard',
        });

        return { dynamicBindings: newBindings };
      });
    },

    getDynamicBinding: (action: DynamicAction): KeybindingValue => {
      return get().dynamicBindings[action];
    },

    addAlternativeKey: (action: BindableAction, code: string) => {
      set((state) => {
        // Remove the key from any other action
        const newBindings = { ...state.keybindings };
        for (const [otherAction, boundKeys] of Object.entries(newBindings)) {
          if (otherAction !== action) {
            const keys = getKeysForAction(boundKeys);
            const filteredKeys = keys.filter((k) => k !== code);
            if (filteredKeys.length !== keys.length) {
              newBindings[otherAction as BindableAction] =
                filteredKeys.length === 1 ? filteredKeys[0] : filteredKeys;
            }
          }
        }
        // Add to current action's keys
        const currentKeys = getKeysForAction(newBindings[action]);
        if (!currentKeys.includes(code)) {
          newBindings[action] = [...currentKeys, code];
        }

        // Save to localStorage
        saveKeybindings(newBindings);

        return { keybindings: newBindings };
      });
    },

    addDynamicAlternativeKey: (action: DynamicAction, code: string) => {
      set((state) => {
        // Remove the key from any other dynamic action
        const newBindings = { ...state.dynamicBindings };
        for (const [otherAction, boundKeys] of Object.entries(newBindings)) {
          if (otherAction !== action) {
            const keys = getKeysForAction(boundKeys);
            const filteredKeys = keys.filter((k) => k !== code);
            if (filteredKeys.length !== keys.length) {
              newBindings[otherAction as DynamicAction] =
                filteredKeys.length === 1 ? filteredKeys[0] : filteredKeys;
            }
          }
        }
        // Add to current action's keys
        const currentKeys = getKeysForAction(newBindings[action]);
        if (!currentKeys.includes(code)) {
          newBindings[action] = [...currentKeys, code];
        }

        // Save to localStorage
        saveDynamicBindings(newBindings);

        return { dynamicBindings: newBindings };
      });
    },

    resetToDefaults: () => {
      const newKeybindings = { ...DEFAULT_KEYBINDINGS };
      const newDynamicBindings = { ...DEFAULT_DYNAMIC_BINDINGS };
      const newGamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };

      // Save to localStorage
      saveKeybindings(newKeybindings);
      saveDynamicBindings(newDynamicBindings);
      saveGamepadBindings(newGamepadBindings);

      set({
        keybindings: newKeybindings,
        dynamicBindings: newDynamicBindings,
        gamepadBindings: newGamepadBindings,
      });

      log.info('Keybindings reset to defaults');
    },

    resetDynamicToDefaults: () => {
      const newDynamicBindings = { ...DEFAULT_DYNAMIC_BINDINGS };

      // Save to localStorage
      saveDynamicBindings(newDynamicBindings);

      set({ dynamicBindings: newDynamicBindings });
    },

    hasCustomBindings: (): boolean => {
      const state = get();
      return JSON.stringify(state.keybindings) !== JSON.stringify(DEFAULT_KEYBINDINGS);
    },

    hasCustomDynamicBindings: (): boolean => {
      const state = get();
      return JSON.stringify(state.dynamicBindings) !== JSON.stringify(DEFAULT_DYNAMIC_BINDINGS);
    },

    // Dynamic action registration
    registerDynamicActions: (levelId: string, actions: DynamicAction[], category?: string) => {
      const registrations: RegisteredDynamicAction[] = actions.map((action) => ({
        action,
        levelId,
        category,
      }));
      registeredActionsMap.set(levelId, registrations);

      // Recalculate active dynamic actions
      const allActions: DynamicAction[] = [];
      registeredActionsMap.forEach((levelActions) => {
        levelActions.forEach((reg) => {
          if (!allActions.includes(reg.action)) {
            allActions.push(reg.action);
          }
        });
      });

      set({ activeDynamicActions: allActions });
    },

    unregisterDynamicActions: (levelId: string) => {
      registeredActionsMap.delete(levelId);

      // Recalculate active dynamic actions
      const allActions: DynamicAction[] = [];
      registeredActionsMap.forEach((levelActions) => {
        levelActions.forEach((reg) => {
          if (!allActions.includes(reg.action)) {
            allActions.push(reg.action);
          }
        });
      });

      set({ activeDynamicActions: allActions });
    },

    clearAllDynamicActions: () => {
      registeredActionsMap.clear();
      set({ activeDynamicActions: [] });
    },

    isDynamicActionActive: (action: DynamicAction): boolean => {
      return get().activeDynamicActions.includes(action);
    },

    getRegisteredDynamicActions: (): RegisteredDynamicAction[] => {
      const all: RegisteredDynamicAction[] = [];
      registeredActionsMap.forEach((levelActions) => {
        all.push(...levelActions);
      });
      return all;
    },

    // Gamepad binding methods
    getGamepadButtonForAction: (
      action: BindableAction | DynamicAction
    ): GamepadButton | undefined => {
      return get().gamepadBindings[action];
    },

    setGamepadBinding: (action: BindableAction | DynamicAction, button: GamepadButton) => {
      set((state) => {
        // Remove the button from any other action it might be bound to
        const newBindings = { ...state.gamepadBindings };
        for (const [otherAction, boundButton] of Object.entries(newBindings)) {
          if (otherAction !== action && boundButton === button) {
            delete newBindings[otherAction as BindableAction | DynamicAction];
          }
        }
        newBindings[action] = button;

        // Save to localStorage
        saveGamepadBindings(newBindings);

        // Emit event
        getEventBus().emit({
          type: 'KEYBINDING_CHANGED',
          action,
          binding: button,
          bindingType: 'gamepad',
        });

        return { gamepadBindings: newBindings };
      });
    },

    clearGamepadBinding: (action: BindableAction | DynamicAction) => {
      set((state) => {
        const newBindings = { ...state.gamepadBindings };
        delete newBindings[action];

        // Save to localStorage
        saveGamepadBindings(newBindings);

        return { gamepadBindings: newBindings };
      });
    },

    resetGamepadToDefaults: () => {
      const newGamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };

      // Save to localStorage
      saveGamepadBindings(newGamepadBindings);

      set({ gamepadBindings: newGamepadBindings });
    },

    hasCustomGamepadBindings: (): boolean => {
      const state = get();
      return JSON.stringify(state.gamepadBindings) !== JSON.stringify(DEFAULT_GAMEPAD_BINDINGS);
    },
  }))
);

// ============================================================================
// CONVENIENCE HOOK FOR COMPATIBILITY
// ============================================================================

/**
 * Convenience hook that provides a similar API to the old useKeybindings()
 * For new code, prefer using useKeybindingsStore directly with selectors.
 */
export function useKeybindings() {
  const keybindings = useKeybindingsStore((state) => state.keybindings);
  const dynamicBindings = useKeybindingsStore((state) => state.dynamicBindings);
  const gamepadBindings = useKeybindingsStore((state) => state.gamepadBindings);
  const activeDynamicActions = useKeybindingsStore((state) => state.activeDynamicActions);
  const isKeyBound = useKeybindingsStore((state) => state.isKeyBound);
  const isDynamicKeyBound = useKeybindingsStore((state) => state.isDynamicKeyBound);
  const getKeyForAction = useKeybindingsStore((state) => state.getKeyForAction);
  const getDynamicKeyForAction = useKeybindingsStore((state) => state.getDynamicKeyForAction);
  const getAllKeysForAction = useKeybindingsStore((state) => state.getAllKeysForAction);
  const getAllDynamicKeysForAction = useKeybindingsStore(
    (state) => state.getAllDynamicKeysForAction
  );
  const setKeybinding = useKeybindingsStore((state) => state.setKeybinding);
  const setDynamicBinding = useKeybindingsStore((state) => state.setDynamicBinding);
  const getDynamicBinding = useKeybindingsStore((state) => state.getDynamicBinding);
  const addAlternativeKey = useKeybindingsStore((state) => state.addAlternativeKey);
  const addDynamicAlternativeKey = useKeybindingsStore((state) => state.addDynamicAlternativeKey);
  const resetToDefaults = useKeybindingsStore((state) => state.resetToDefaults);
  const resetDynamicToDefaults = useKeybindingsStore((state) => state.resetDynamicToDefaults);
  const hasCustomBindings = useKeybindingsStore((state) => state.hasCustomBindings);
  const hasCustomDynamicBindings = useKeybindingsStore((state) => state.hasCustomDynamicBindings);
  const registerDynamicActions = useKeybindingsStore((state) => state.registerDynamicActions);
  const unregisterDynamicActions = useKeybindingsStore((state) => state.unregisterDynamicActions);
  const clearAllDynamicActions = useKeybindingsStore((state) => state.clearAllDynamicActions);
  const isDynamicActionActive = useKeybindingsStore((state) => state.isDynamicActionActive);
  const getRegisteredDynamicActions = useKeybindingsStore(
    (state) => state.getRegisteredDynamicActions
  );
  const getGamepadButtonForAction = useKeybindingsStore((state) => state.getGamepadButtonForAction);
  const setGamepadBinding = useKeybindingsStore((state) => state.setGamepadBinding);
  const clearGamepadBinding = useKeybindingsStore((state) => state.clearGamepadBinding);
  const resetGamepadToDefaults = useKeybindingsStore((state) => state.resetGamepadToDefaults);
  const hasCustomGamepadBindings = useKeybindingsStore((state) => state.hasCustomGamepadBindings);

  return {
    keybindings,
    dynamicBindings,
    gamepadBindings,
    activeDynamicActions,
    isKeyBound,
    isDynamicKeyBound,
    getKeyForAction,
    getDynamicKeyForAction,
    getAllKeysForAction,
    getAllDynamicKeysForAction,
    setKeybinding,
    setDynamicBinding,
    getDynamicBinding,
    addAlternativeKey,
    addDynamicAlternativeKey,
    resetToDefaults,
    resetDynamicToDefaults,
    hasCustomBindings: hasCustomBindings(),
    hasCustomDynamicBindings: hasCustomDynamicBindings(),
    registerDynamicActions,
    unregisterDynamicActions,
    clearAllDynamicActions,
    isDynamicActionActive,
    getRegisteredDynamicActions,
    getGamepadButtonForAction,
    setGamepadBinding,
    clearGamepadBinding,
    resetGamepadToDefaults,
    hasCustomGamepadBindings: hasCustomGamepadBindings(),
  };
}

// ============================================================================
// NON-REACT ACCESSORS (for InputManager and useInputActions)
// ============================================================================

/**
 * Get keybindings synchronously (for non-React code like InputManager)
 */
export function getKeybindings(): Keybindings {
  return useKeybindingsStore.getState().keybindings;
}

/**
 * Get dynamic bindings synchronously
 */
export function getDynamicBindings(): DynamicBindings {
  return useKeybindingsStore.getState().dynamicBindings;
}

/**
 * Get gamepad bindings synchronously
 */
export function getGamepadBindings(): GamepadBindings {
  return useKeybindingsStore.getState().gamepadBindings;
}

/**
 * Subscribe to keybinding changes (for non-React code)
 */
export function subscribeToKeybindings(listener: (keybindings: Keybindings) => void): () => void {
  return useKeybindingsStore.subscribe((state) => state.keybindings, listener);
}

/**
 * Get the list of currently active dynamic action names.
 */
export function getActiveDynamicActions(): DynamicAction[] {
  return useKeybindingsStore.getState().activeDynamicActions;
}

/**
 * Register dynamic actions for a level (non-React).
 */
export function registerDynamicActions(
  levelId: string,
  actions: DynamicAction[],
  category?: string
): void {
  useKeybindingsStore.getState().registerDynamicActions(levelId, actions, category);
}

/**
 * Unregister dynamic actions for a level (non-React).
 */
export function unregisterDynamicActions(levelId: string): void {
  useKeybindingsStore.getState().unregisterDynamicActions(levelId);
}

/**
 * Clear all dynamic actions (non-React).
 */
export function clearAllDynamicActions(): void {
  useKeybindingsStore.getState().clearAllDynamicActions();
}

log.info('KeybindingsStore initialized');
