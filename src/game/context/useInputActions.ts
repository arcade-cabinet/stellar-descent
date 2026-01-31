/**
 * Input Actions Utility
 *
 * Provides a way to check if specific actions are active based on
 * the current keybindings. This is used by game levels to read player
 * input using the user-configurable keybindings.
 *
 * For non-React contexts (like Babylon.js levels), we need to access
 * keybindings differently since we can't use hooks directly.
 *
 * This module also provides singleton accessors for dynamic action
 * registration, allowing BabylonJS levels to register context-specific
 * keybindings (e.g., vehicle controls, squad commands).
 */

import type { BindableAction, DynamicAction, Keybindings } from './KeybindingsContext';
import { DEFAULT_KEYBINDINGS, getKeysForAction, getPrimaryKey } from './KeybindingsContext';

const STORAGE_KEY = 'stellar-descent-keybindings';

/**
 * Load keybindings from localStorage (for use outside React)
 */
export function getKeybindings(): Keybindings {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_KEYBINDINGS, ...parsed };
  }
  return { ...DEFAULT_KEYBINDINGS };
}

/**
 * Input state tracker for game levels
 *
 * This class tracks the current state of keyboard and mouse inputs
 * and maps them to game actions using the user's keybindings.
 */
export class InputTracker {
  private keysPressed: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private keybindings: Keybindings;

  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;
  private mousedownHandler: (e: MouseEvent) => void;
  private mouseupHandler: (e: MouseEvent) => void;

  constructor() {
    this.keybindings = getKeybindings();

    this.keydownHandler = this.handleKeyDown.bind(this);
    this.keyupHandler = this.handleKeyUp.bind(this);
    this.mousedownHandler = this.handleMouseDown.bind(this);
    this.mouseupHandler = this.handleMouseUp.bind(this);

    this.attach();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keysPressed.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysPressed.delete(e.code);
  }

  private handleMouseDown(e: MouseEvent): void {
    this.mouseButtons.add(e.button);
  }

  private handleMouseUp(e: MouseEvent): void {
    this.mouseButtons.delete(e.button);
  }

  /**
   * Attach event listeners
   */
  attach(): void {
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('mousedown', this.mousedownHandler);
    window.addEventListener('mouseup', this.mouseupHandler);
  }

  /**
   * Detach event listeners and clean up
   */
  dispose(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    window.removeEventListener('mousedown', this.mousedownHandler);
    window.removeEventListener('mouseup', this.mouseupHandler);
    this.keysPressed.clear();
    this.mouseButtons.clear();
  }

  /**
   * Refresh keybindings from localStorage
   * Call this when returning from settings menu
   */
  refreshKeybindings(): void {
    this.keybindings = getKeybindings();
  }

  /**
   * Check if an action is currently active
   * Checks all keys bound to the action (primary + alternatives)
   */
  isActionActive(action: BindableAction): boolean {
    const binding = this.keybindings[action];
    if (!binding) return false;

    const keys = getKeysForAction(binding);

    for (const key of keys) {
      // Check mouse buttons
      if (key.startsWith('Mouse')) {
        const buttonIndex = parseInt(key.slice(5), 10);
        if (this.mouseButtons.has(buttonIndex)) return true;
      } else {
        // Check keyboard
        if (this.keysPressed.has(key)) return true;
      }
    }

    return false;
  }

  /**
   * Check if a specific key code is pressed (for raw access)
   */
  isKeyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /**
   * Check if a specific mouse button is pressed
   */
  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  /**
   * Get the primary key code bound to an action (for display purposes)
   */
  getKeyForAction(action: BindableAction): string {
    return getPrimaryKey(this.keybindings[action]);
  }

  /**
   * Get all key codes bound to an action
   */
  getAllKeysForAction(action: BindableAction): string[] {
    return getKeysForAction(this.keybindings[action]);
  }

  /**
   * Clear all pressed states (useful when losing focus)
   */
  clearAll(): void {
    this.keysPressed.clear();
    this.mouseButtons.clear();
  }
}

/**
 * Singleton input tracker instance
 * Use this in game levels instead of creating multiple trackers
 */
let globalInputTracker: InputTracker | null = null;

export function getInputTracker(): InputTracker {
  if (!globalInputTracker) {
    globalInputTracker = new InputTracker();
  }
  return globalInputTracker;
}

export function disposeInputTracker(): void {
  if (globalInputTracker) {
    globalInputTracker.dispose();
    globalInputTracker = null;
  }
}

// ============================================================================
// DYNAMIC ACTION REGISTRATION (for non-React contexts)
// ============================================================================

/**
 * Registered dynamic action with metadata.
 * Mirrors the structure in KeybindingsContext.
 */
interface RegisteredDynamicAction {
  action: DynamicAction;
  levelId: string;
  category?: string;
}

/**
 * Registry for dynamic actions.
 * This is a simple in-memory store that levels can use to register/unregister
 * their context-specific actions. The React KeybindingsContext provider
 * observes this registry via the bridge functions below.
 */
const dynamicActionsRegistry = new Map<string, RegisteredDynamicAction[]>();

/**
 * Callbacks registered by the React KeybindingsProvider to sync state.
 * When levels register/unregister actions, these callbacks notify the
 * React context to update its state.
 */
type RegistryChangeCallback = () => void;
let registryChangeCallback: RegistryChangeCallback | null = null;

/**
 * Set the callback that gets invoked when the registry changes.
 * This is called by the KeybindingsProvider to stay in sync.
 */
export function setDynamicActionsRegistryCallback(callback: RegistryChangeCallback | null): void {
  registryChangeCallback = callback;
}

/**
 * Get all currently registered dynamic actions.
 * Used by the React context to read the current state.
 */
export function getRegisteredDynamicActions(): RegisteredDynamicAction[] {
  const all: RegisteredDynamicAction[] = [];
  dynamicActionsRegistry.forEach((levelActions) => {
    all.push(...levelActions);
  });
  return all;
}

/**
 * Get the list of currently active dynamic action names.
 */
export function getActiveDynamicActions(): DynamicAction[] {
  const actions: DynamicAction[] = [];
  dynamicActionsRegistry.forEach((levelActions) => {
    for (const reg of levelActions) {
      if (!actions.includes(reg.action)) {
        actions.push(reg.action);
      }
    }
  });
  return actions;
}

/**
 * Register dynamic actions for a level.
 * Call this in level initialize() to make context-specific keybindings active.
 *
 * @param levelId - Unique identifier for the level (e.g., 'canyon_run', 'final_escape')
 * @param actions - Array of dynamic actions to register
 * @param category - Optional category for grouping (e.g., 'vehicle', 'squad')
 */
export function registerDynamicActions(
  levelId: string,
  actions: DynamicAction[],
  category?: string
): void {
  const registrations: RegisteredDynamicAction[] = actions.map((action) => ({
    action,
    levelId,
    category,
  }));
  dynamicActionsRegistry.set(levelId, registrations);

  // Notify React context of the change
  registryChangeCallback?.();
}

/**
 * Unregister all dynamic actions for a level.
 * Call this in level dispose() to clean up context-specific keybindings.
 *
 * @param levelId - Unique identifier for the level
 */
export function unregisterDynamicActions(levelId: string): void {
  dynamicActionsRegistry.delete(levelId);

  // Notify React context of the change
  registryChangeCallback?.();
}

/**
 * Clear all registered dynamic actions.
 * Useful when resetting the game state.
 */
export function clearAllDynamicActions(): void {
  dynamicActionsRegistry.clear();

  // Notify React context of the change
  registryChangeCallback?.();
}
