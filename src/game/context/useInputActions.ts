/**
 * Input Actions Utility
 *
 * This module provides backwards compatibility for code that still imports from
 * the context directory. All functionality is now in the useKeybindingsStore.
 *
 * For new code, import directly from '../stores/useKeybindingsStore'.
 */

import type { BindableAction, Keybindings } from '../stores/useKeybindingsStore';
import {
  clearAllDynamicActions as clearAllDynamicActionsFromStore,
  type DynamicAction,
  getActiveDynamicActions as getActiveDynamicActionsFromStore,
  getKeybindings as getKeybindingsFromStore,
  getKeysForAction,
  getPrimaryKey,
  registerDynamicActions as registerDynamicActionsFromStore,
  unregisterDynamicActions as unregisterDynamicActionsFromStore,
} from '../stores/useKeybindingsStore';

/**
 * Load keybindings from the store (for use outside React)
 * @deprecated Import getKeybindings from '../stores/useKeybindingsStore' instead
 */
export function getKeybindings(): Keybindings {
  return getKeybindingsFromStore();
}

/**
 * Input state tracker for game levels
 *
 * This class tracks the current state of keyboard and mouse inputs
 * and maps them to game actions using the user's keybindings.
 *
 * @deprecated Use InputManager from '../input/InputManager' instead
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
    this.keybindings = getKeybindingsFromStore();

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
   * Refresh keybindings from the store
   * Call this when returning from settings menu
   */
  refreshKeybindings(): void {
    this.keybindings = getKeybindingsFromStore();
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
 * @deprecated Use getInputManager() from '../input/InputManager' instead
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
// Re-export from the store for backwards compatibility
// ============================================================================

/**
 * @deprecated Import from '../stores/useKeybindingsStore' instead
 */
export function getActiveDynamicActions(): DynamicAction[] {
  return getActiveDynamicActionsFromStore();
}

/**
 * @deprecated Import from '../stores/useKeybindingsStore' instead
 */
export function registerDynamicActions(
  levelId: string,
  actions: DynamicAction[],
  category?: string
): void {
  registerDynamicActionsFromStore(levelId, actions, category);
}

/**
 * @deprecated Import from '../stores/useKeybindingsStore' instead
 */
export function unregisterDynamicActions(levelId: string): void {
  unregisterDynamicActionsFromStore(levelId);
}

/**
 * @deprecated Import from '../stores/useKeybindingsStore' instead
 */
export function clearAllDynamicActions(): void {
  clearAllDynamicActionsFromStore();
}

/**
 * @deprecated This callback is no longer needed as the store handles synchronization
 */
export function setDynamicActionsRegistryCallback(_callback: (() => void) | null): void {
  // No-op - the store handles synchronization internally
}

/**
 * @deprecated Import from '../stores/useKeybindingsStore' instead
 */
export function getRegisteredDynamicActions() {
  // Return from the store
  const { useKeybindingsStore } = require('../stores/useKeybindingsStore');
  return useKeybindingsStore.getState().getRegisteredDynamicActions();
}
