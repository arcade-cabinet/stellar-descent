import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposeInputManager, getInputManager, InputManager } from './InputManager';

// Mock localStorage
const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    },
  });
});

// Mock navigator.getGamepads
beforeEach(() => {
  vi.stubGlobal('navigator', {
    getGamepads: () => [null, null, null, null],
  });
});

afterEach(() => {
  disposeInputManager();
});

describe('InputManager', () => {
  describe('initialization', () => {
    it('creates a singleton instance', () => {
      const manager1 = getInputManager();
      const manager2 = getInputManager();
      expect(manager1).toBe(manager2);
    });

    it('initializes with default keybindings', () => {
      const manager = getInputManager();
      expect(manager.getKeyForAction('fire')).toBe('Mouse0');
      expect(manager.getKeyForAction('jump')).toBe('Space');
      expect(manager.getKeyForAction('sprint')).toBe('ShiftLeft');
    });

    it('loads custom keybindings from localStorage', () => {
      // Set up custom bindings before creating manager
      mockStorage['stellar-descent-keybindings'] = JSON.stringify({
        fire: 'KeyF',
      });

      disposeInputManager();
      const manager = getInputManager();
      expect(manager.getKeyForAction('fire')).toBe('KeyF');
    });
  });

  describe('keyboard input', () => {
    it('tracks key presses via events', () => {
      const manager = getInputManager();

      // Simulate keydown
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyW' });
      window.dispatchEvent(keydownEvent);

      expect(manager.isKeyPressed('KeyW')).toBe(true);
      expect(manager.isKeyPressed('KeyS')).toBe(false);

      // Simulate keyup
      const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyW' });
      window.dispatchEvent(keyupEvent);

      expect(manager.isKeyPressed('KeyW')).toBe(false);
    });

    it('checks action based on default keybindings', () => {
      const manager = getInputManager();

      // Press W key (default for moveForward)
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyW' });
      window.dispatchEvent(keydownEvent);

      expect(manager.isActionPressed('moveForward')).toBe(true);
      expect(manager.isActionPressed('moveBackward')).toBe(false);
    });

    it('respects custom keybindings', () => {
      // Set up custom bindings
      mockStorage['stellar-descent-keybindings'] = JSON.stringify({
        fire: 'KeyF',
      });

      disposeInputManager();
      const manager = getInputManager();

      // Press F key (now bound to fire)
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyF' });
      window.dispatchEvent(keydownEvent);

      expect(manager.isActionPressed('fire')).toBe(true);
    });
  });

  describe('mouse input', () => {
    it('tracks mouse button presses', () => {
      const manager = getInputManager();

      // Simulate mousedown
      const mousedownEvent = new MouseEvent('mousedown', { button: 0 });
      window.dispatchEvent(mousedownEvent);

      expect(manager.isMouseButtonPressed(0)).toBe(true);
      expect(manager.isMouseButtonPressed(1)).toBe(false);

      // Simulate mouseup
      const mouseupEvent = new MouseEvent('mouseup', { button: 0 });
      window.dispatchEvent(mouseupEvent);

      expect(manager.isMouseButtonPressed(0)).toBe(false);
    });

    it('maps mouse buttons to actions via keybindings', () => {
      const manager = getInputManager();

      // Left click is bound to fire by default (Mouse0)
      const mousedownEvent = new MouseEvent('mousedown', { button: 0 });
      window.dispatchEvent(mousedownEvent);

      expect(manager.isActionPressed('fire')).toBe(true);
    });
  });

  describe('movement input', () => {
    it('returns normalized movement from keyboard', () => {
      const manager = getInputManager();

      // Press W and D for diagonal movement
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));

      const movement = manager.getMovementInput();

      // Should be normalized
      const magnitude = Math.sqrt(movement.x * movement.x + movement.y * movement.y);
      expect(magnitude).toBeCloseTo(1, 2);

      // Forward and right
      expect(movement.y).toBeGreaterThan(0);
      expect(movement.x).toBeGreaterThan(0);
    });

    it('respects alternative keybindings for movement', () => {
      const manager = getInputManager();

      // Arrow keys are alternatives for WASD
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));

      expect(manager.isActionPressed('moveForward')).toBe(true);
    });
  });

  describe('touch input', () => {
    it('sets and reads touch input state', () => {
      const manager = getInputManager();

      manager.setTouchInput({
        movement: { x: 0.5, y: 0.8 },
        look: { x: 0, y: 0 },
        isFiring: true,
        isSprinting: false,
      });

      expect(manager.isActionPressed('fire')).toBe(true);

      manager.setTouchInput(null);

      // Without touch input, fire should be false
      expect(manager.isActionPressed('fire')).toBe(false);
    });

    it('combines touch movement with keyboard', () => {
      const manager = getInputManager();

      manager.setTouchInput({
        movement: { x: 0.7, y: 0.3 },
        look: { x: 0, y: 0 },
        isFiring: false,
        isSprinting: false,
      });

      const movement = manager.getMovementInput();
      expect(movement.x).toBeCloseTo(0.7, 1);
      expect(movement.y).toBeCloseTo(0.3, 1);
    });
  });

  describe('edge detection', () => {
    it('detects just pressed actions', () => {
      const manager = getInputManager();

      // First update - no key pressed
      manager.update();
      expect(manager.isActionJustPressed('jump')).toBe(false);

      // Press space
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      manager.update();
      expect(manager.isActionJustPressed('jump')).toBe(true);

      // Still held - not "just" pressed anymore
      manager.update();
      expect(manager.isActionJustPressed('jump')).toBe(false);
      expect(manager.isActionPressed('jump')).toBe(true);
    });

    it('detects just released actions', () => {
      const manager = getInputManager();

      // Press space
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      manager.update();

      // Release space
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      manager.update();
      expect(manager.isActionJustReleased('jump')).toBe(true);

      // Not "just" released anymore
      manager.update();
      expect(manager.isActionJustReleased('jump')).toBe(false);
    });
  });

  describe('refreshKeybindings', () => {
    it('reloads keybindings from localStorage', () => {
      const manager = getInputManager();

      // Initially fire is Mouse0
      expect(manager.getKeyForAction('fire')).toBe('Mouse0');

      // Update localStorage
      mockStorage['stellar-descent-keybindings'] = JSON.stringify({
        fire: 'KeyF',
      });

      // Refresh should pick up new bindings
      manager.refreshKeybindings();
      expect(manager.getKeyForAction('fire')).toBe('KeyF');
    });
  });

  describe('clearAll', () => {
    it('clears all pressed states', () => {
      const manager = getInputManager();

      // Press some keys
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

      expect(manager.isKeyPressed('KeyW')).toBe(true);
      expect(manager.isMouseButtonPressed(0)).toBe(true);

      // Clear all
      manager.clearAll();

      expect(manager.isKeyPressed('KeyW')).toBe(false);
      expect(manager.isMouseButtonPressed(0)).toBe(false);
    });
  });

  describe('blur handling', () => {
    it('clears pressed states on window blur', () => {
      const manager = getInputManager();

      // Press a key
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      expect(manager.isKeyPressed('KeyW')).toBe(true);

      // Trigger blur
      window.dispatchEvent(new Event('blur'));
      expect(manager.isKeyPressed('KeyW')).toBe(false);
    });
  });
});
