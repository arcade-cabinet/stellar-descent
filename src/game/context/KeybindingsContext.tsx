import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setDynamicActionsRegistryCallback, getActiveDynamicActions as getActiveDynamicActionsFromRegistry } from './useInputActions';

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
    case 'xbox':
    case 'generic':
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

const STORAGE_KEY = 'stellar-descent-keybindings';
const DYNAMIC_STORAGE_KEY = 'stellar-descent-dynamic-keybindings';
const GAMEPAD_STORAGE_KEY = 'stellar-descent-gamepad-bindings';

/**
 * Load keybindings from localStorage
 */
function loadKeybindings(): Keybindings {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new actions
    return { ...DEFAULT_KEYBINDINGS, ...parsed };
  }
  return { ...DEFAULT_KEYBINDINGS };
}

/**
 * Save keybindings to localStorage
 */
function saveKeybindings(bindings: Keybindings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

/**
 * Load dynamic keybindings from localStorage
 */
function loadDynamicBindings(): DynamicBindings {
  const stored = localStorage.getItem(DYNAMIC_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new actions
    return { ...DEFAULT_DYNAMIC_BINDINGS, ...parsed };
  }
  return { ...DEFAULT_DYNAMIC_BINDINGS };
}

/**
 * Save dynamic keybindings to localStorage
 */
function saveDynamicBindings(bindings: DynamicBindings): void {
  localStorage.setItem(DYNAMIC_STORAGE_KEY, JSON.stringify(bindings));
}

/**
 * Load gamepad bindings from localStorage
 */
function loadGamepadBindings(): GamepadBindings {
  const stored = localStorage.getItem(GAMEPAD_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new actions
    return { ...DEFAULT_GAMEPAD_BINDINGS, ...parsed };
  }
  return { ...DEFAULT_GAMEPAD_BINDINGS };
}

/**
 * Save gamepad bindings to localStorage
 */
function saveGamepadBindings(bindings: GamepadBindings): void {
  localStorage.setItem(GAMEPAD_STORAGE_KEY, JSON.stringify(bindings));
}

/**
 * Registered dynamic action with metadata
 */
export interface RegisteredDynamicAction {
  action: DynamicAction;
  levelId: string;
  category?: string;
}

interface KeybindingsContextType {
  /** Current core keybindings */
  keybindings: Keybindings;

  /** Current dynamic keybindings */
  dynamicBindings: DynamicBindings;

  /** Current gamepad bindings */
  gamepadBindings: GamepadBindings;

  /** Currently active (registered) dynamic actions for the current level */
  activeDynamicActions: DynamicAction[];

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
  hasCustomBindings: boolean;

  /** Check if current dynamic bindings differ from defaults */
  hasCustomDynamicBindings: boolean;

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
  hasCustomGamepadBindings: boolean;
}

const KeybindingsContext = createContext<KeybindingsContextType | null>(null);

/**
 * Hook to access keybindings context
 */
export function useKeybindings() {
  const context = useContext(KeybindingsContext);
  if (!context) {
    throw new Error('useKeybindings must be used within a KeybindingsProvider');
  }
  return context;
}

interface KeybindingsProviderProps {
  children: ReactNode;
}

export function KeybindingsProvider({ children }: KeybindingsProviderProps) {
  const [keybindings, setKeybindings] = useState<Keybindings>(loadKeybindings);
  const [dynamicBindings, setDynamicBindings] = useState<DynamicBindings>(loadDynamicBindings);
  const [gamepadBindings, setGamepadBindings] = useState<GamepadBindings>(loadGamepadBindings);

  // Track registered dynamic actions per level
  const registeredActionsRef = useRef<Map<string, RegisteredDynamicAction[]>>(new Map());
  const [registeredActionsVersion, setRegisteredActionsVersion] = useState(0);

  // Subscribe to dynamic action registry changes from BabylonJS levels
  useEffect(() => {
    // Callback that gets invoked when the non-React registry changes
    const handleRegistryChange = () => {
      // Pull the current state from the registry and update our local state
      const activeActions = getActiveDynamicActionsFromRegistry();
      registeredActionsRef.current.clear();
      // Rebuild the map with the new active actions
      activeActions.forEach((action) => {
        registeredActionsRef.current.set(action, [
          {
            action,
            levelId: 'external',
            category: 'synced',
          },
        ]);
      });
      // Trigger a re-render by bumping the version
      setRegisteredActionsVersion((v) => v + 1);
    };

    // Register our callback with the dynamic actions registry
    setDynamicActionsRegistryCallback(handleRegistryChange);

    // Cleanup on unmount
    return () => {
      setDynamicActionsRegistryCallback(null);
    };
  }, []);

  // Save to localStorage whenever bindings change
  useEffect(() => {
    saveKeybindings(keybindings);
  }, [keybindings]);

  useEffect(() => {
    saveDynamicBindings(dynamicBindings);
  }, [dynamicBindings]);

  useEffect(() => {
    saveGamepadBindings(gamepadBindings);
  }, [gamepadBindings]);

  // Compute active dynamic actions from registered actions
  const activeDynamicActions = useMemo(() => {
    const actions: DynamicAction[] = [];
    registeredActionsRef.current.forEach((levelActions) => {
      levelActions.forEach((reg) => {
        if (!actions.includes(reg.action)) {
          actions.push(reg.action);
        }
      });
    });
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredActionsVersion]);

  // Core keybinding methods
  const isKeyBound = useCallback(
    (code: string, action: BindableAction): boolean => {
      const binding = keybindings[action];
      const keys = getKeysForAction(binding);
      return keys.includes(code);
    },
    [keybindings]
  );

  const getKeyForAction = useCallback(
    (action: BindableAction): string => {
      return getPrimaryKey(keybindings[action]);
    },
    [keybindings]
  );

  const getAllKeysForAction = useCallback(
    (action: BindableAction): string[] => {
      return getKeysForAction(keybindings[action]);
    },
    [keybindings]
  );

  const setKeybinding = useCallback((action: BindableAction, code: string) => {
    setKeybindings((prev) => {
      // Remove the key from any other action it might be bound to
      const newBindings = { ...prev };
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
      return newBindings;
    });
  }, []);

  const addAlternativeKey = useCallback((action: BindableAction, code: string) => {
    setKeybindings((prev) => {
      // Remove the key from any other action
      const newBindings = { ...prev };
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
      return newBindings;
    });
  }, []);

  // Dynamic keybinding methods
  const isDynamicKeyBound = useCallback(
    (code: string, action: DynamicAction): boolean => {
      const binding = dynamicBindings[action];
      const keys = getKeysForAction(binding);
      return keys.includes(code);
    },
    [dynamicBindings]
  );

  const getDynamicKeyForAction = useCallback(
    (action: DynamicAction): string => {
      return getPrimaryKey(dynamicBindings[action]);
    },
    [dynamicBindings]
  );

  const getAllDynamicKeysForAction = useCallback(
    (action: DynamicAction): string[] => {
      return getKeysForAction(dynamicBindings[action]);
    },
    [dynamicBindings]
  );

  const getDynamicBinding = useCallback(
    (action: DynamicAction): KeybindingValue => {
      return dynamicBindings[action];
    },
    [dynamicBindings]
  );

  const setDynamicBinding = useCallback((action: DynamicAction, code: string) => {
    setDynamicBindings((prev) => {
      // Remove the key from any other dynamic action it might be bound to
      const newBindings = { ...prev };
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
      return newBindings;
    });
  }, []);

  const addDynamicAlternativeKey = useCallback((action: DynamicAction, code: string) => {
    setDynamicBindings((prev) => {
      // Remove the key from any other dynamic action
      const newBindings = { ...prev };
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
      return newBindings;
    });
  }, []);

  // Reset methods
  const resetToDefaults = useCallback(() => {
    setKeybindings({ ...DEFAULT_KEYBINDINGS });
    setDynamicBindings({ ...DEFAULT_DYNAMIC_BINDINGS });
    setGamepadBindings({ ...DEFAULT_GAMEPAD_BINDINGS });
  }, []);

  const resetDynamicToDefaults = useCallback(() => {
    setDynamicBindings({ ...DEFAULT_DYNAMIC_BINDINGS });
  }, []);

  const resetGamepadToDefaults = useCallback(() => {
    setGamepadBindings({ ...DEFAULT_GAMEPAD_BINDINGS });
  }, []);

  // Gamepad binding methods
  const getGamepadButtonForAction = useCallback(
    (action: BindableAction | DynamicAction): GamepadButton | undefined => {
      return gamepadBindings[action];
    },
    [gamepadBindings]
  );

  const setGamepadBinding = useCallback(
    (action: BindableAction | DynamicAction, button: GamepadButton) => {
      setGamepadBindings((prev) => {
        // Remove the button from any other action it might be bound to
        const newBindings = { ...prev };
        for (const [otherAction, boundButton] of Object.entries(newBindings)) {
          if (otherAction !== action && boundButton === button) {
            delete newBindings[otherAction as BindableAction | DynamicAction];
          }
        }
        newBindings[action] = button;
        return newBindings;
      });
    },
    []
  );

  const clearGamepadBinding = useCallback((action: BindableAction | DynamicAction) => {
    setGamepadBindings((prev) => {
      const newBindings = { ...prev };
      delete newBindings[action];
      return newBindings;
    });
  }, []);

  // Dynamic action registration methods
  const registerDynamicActions = useCallback(
    (levelId: string, actions: DynamicAction[], category?: string) => {
      const registrations: RegisteredDynamicAction[] = actions.map((action) => ({
        action,
        levelId,
        category,
      }));
      registeredActionsRef.current.set(levelId, registrations);
      setRegisteredActionsVersion((v) => v + 1);
    },
    []
  );

  const unregisterDynamicActions = useCallback((levelId: string) => {
    registeredActionsRef.current.delete(levelId);
    setRegisteredActionsVersion((v) => v + 1);
  }, []);

  const clearAllDynamicActions = useCallback(() => {
    registeredActionsRef.current.clear();
    setRegisteredActionsVersion((v) => v + 1);
  }, []);

  const isDynamicActionActive = useCallback(
    (action: DynamicAction): boolean => {
      return activeDynamicActions.includes(action);
    },
    [activeDynamicActions]
  );

  const getRegisteredDynamicActions = useCallback((): RegisteredDynamicAction[] => {
    const all: RegisteredDynamicAction[] = [];
    registeredActionsRef.current.forEach((levelActions) => {
      all.push(...levelActions);
    });
    return all;
  }, []);

  const hasCustomBindings = JSON.stringify(keybindings) !== JSON.stringify(DEFAULT_KEYBINDINGS);
  const hasCustomDynamicBindings =
    JSON.stringify(dynamicBindings) !== JSON.stringify(DEFAULT_DYNAMIC_BINDINGS);
  const hasCustomGamepadBindings =
    JSON.stringify(gamepadBindings) !== JSON.stringify(DEFAULT_GAMEPAD_BINDINGS);

  const value: KeybindingsContextType = {
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
    hasCustomBindings,
    hasCustomDynamicBindings,
    registerDynamicActions,
    unregisterDynamicActions,
    clearAllDynamicActions,
    isDynamicActionActive,
    getRegisteredDynamicActions,
    // Gamepad methods
    getGamepadButtonForAction,
    setGamepadBinding,
    clearGamepadBinding,
    resetGamepadToDefaults,
    hasCustomGamepadBindings,
  };

  return <KeybindingsContext.Provider value={value}>{children}</KeybindingsContext.Provider>;
}
