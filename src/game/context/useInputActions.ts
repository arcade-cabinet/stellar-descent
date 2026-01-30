/**
 * Input Actions Utility
 *
 * Provides a way to check if specific actions are active based on
 * the current keybindings. This is used by game levels to read player
 * input using the user-configurable keybindings.
 *
 * For non-React contexts (like Babylon.js levels), we need to access
 * keybindings differently since we can't use hooks directly.
 */

import type { BindableAction, Keybindings } from './KeybindingsContext';
import { DEFAULT_KEYBINDINGS, getKeysForAction, getPrimaryKey } from './KeybindingsContext';

const STORAGE_KEY = 'stellar-descent-keybindings';

/**
 * Load keybindings from localStorage (for use outside React)
 */
export function getKeybindings(): Keybindings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_KEYBINDINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load keybindings:', e);
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
