import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

/**
 * Actions that can be bound to keys
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
 * Map of action names to their display labels
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
 * Keybindings map - action to key code(s)
 */
export type Keybindings = Record<BindableAction, KeybindingValue>;

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

const STORAGE_KEY = 'stellar-descent-keybindings';

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
    console.warn('Failed to load keybindings from localStorage:', e);
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
    console.warn('Failed to save keybindings to localStorage:', e);
  }
}

interface KeybindingsContextType {
  /** Current keybindings */
  keybindings: Keybindings;

  /** Check if a key code is bound to an action (checks all keys for that action) */
  isKeyBound: (code: string, action: BindableAction) => boolean;

  /** Get the primary key code for an action (for display purposes) */
  getKeyForAction: (action: BindableAction) => string;

  /** Get all key codes for an action */
  getAllKeysForAction: (action: BindableAction) => string[];

  /** Update a keybinding (replaces all keys for that action with single key) */
  setKeybinding: (action: BindableAction, code: string) => void;

  /** Add an alternative key for an action */
  addAlternativeKey: (action: BindableAction, code: string) => void;

  /** Reset all keybindings to defaults */
  resetToDefaults: () => void;

  /** Check if current bindings differ from defaults */
  hasCustomBindings: boolean;
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

  // Save to localStorage whenever bindings change
  useEffect(() => {
    saveKeybindings(keybindings);
  }, [keybindings]);

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

  const resetToDefaults = useCallback(() => {
    setKeybindings({ ...DEFAULT_KEYBINDINGS });
  }, []);

  const hasCustomBindings = JSON.stringify(keybindings) !== JSON.stringify(DEFAULT_KEYBINDINGS);

  const value: KeybindingsContextType = {
    keybindings,
    isKeyBound,
    getKeyForAction,
    getAllKeysForAction,
    setKeybinding,
    addAlternativeKey,
    resetToDefaults,
    hasCustomBindings,
  };

  return <KeybindingsContext.Provider value={value}>{children}</KeybindingsContext.Provider>;
}
