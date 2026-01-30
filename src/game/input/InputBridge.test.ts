import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_DEFAULT_KEYS,
  bindableActionParams,
  formatKeyForDisplay,
  getActionKeyInfo,
  getAllKeysForAction,
  getKeyDisplayForAction,
  getKeyForAction,
  isDefaultKeyForAction,
  LEVEL_SPECIFIC_KEYS,
  levelActionParams,
} from './InputBridge';

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

describe('InputBridge', () => {
  describe('formatKeyForDisplay', () => {
    it('formats special keys correctly', () => {
      expect(formatKeyForDisplay('Space')).toBe('SPACE');
      expect(formatKeyForDisplay('ShiftLeft')).toBe('LEFT SHIFT');
      expect(formatKeyForDisplay('ControlLeft')).toBe('LEFT CTRL');
      expect(formatKeyForDisplay('Escape')).toBe('ESC');
    });

    it('formats letter keys correctly', () => {
      expect(formatKeyForDisplay('KeyE')).toBe('E');
      expect(formatKeyForDisplay('KeyW')).toBe('W');
      expect(formatKeyForDisplay('KeyR')).toBe('R');
    });

    it('formats mouse buttons correctly', () => {
      expect(formatKeyForDisplay('Mouse0')).toBe('LEFT CLICK');
      expect(formatKeyForDisplay('Mouse1')).toBe('RIGHT CLICK');
      expect(formatKeyForDisplay('Mouse2')).toBe('MIDDLE CLICK');
    });

    it('formats digit keys correctly', () => {
      expect(formatKeyForDisplay('Digit1')).toBe('1');
      expect(formatKeyForDisplay('Digit2')).toBe('2');
    });
  });

  describe('getKeyForAction', () => {
    it('returns default key for standard actions', () => {
      // With no custom bindings, should return defaults
      expect(getKeyForAction('interact')).toBe('KeyE');
      expect(getKeyForAction('reload')).toBe('KeyR');
      expect(getKeyForAction('fire')).toBe('Mouse0');
      expect(getKeyForAction('jump')).toBe('Space');
    });

    it('returns first key of array bindings', () => {
      // moveForward has ['KeyW', 'ArrowUp'] by default
      expect(getKeyForAction('moveForward')).toBe('KeyW');
    });
  });

  describe('getAllKeysForAction', () => {
    it('returns all keys for actions with alternatives', () => {
      const keys = getAllKeysForAction('moveForward');
      expect(keys).toContain('KeyW');
      expect(keys).toContain('ArrowUp');
    });

    it('returns single-element array for single-key bindings', () => {
      const keys = getAllKeysForAction('interact');
      expect(keys).toEqual(['KeyE']);
    });
  });

  describe('getKeyDisplayForAction', () => {
    it('returns formatted display string for actions', () => {
      expect(getKeyDisplayForAction('interact')).toBe('E');
      expect(getKeyDisplayForAction('reload')).toBe('R');
      expect(getKeyDisplayForAction('jump')).toBe('SPACE');
      expect(getKeyDisplayForAction('fire')).toBe('LEFT CLICK');
      expect(getKeyDisplayForAction('sprint')).toBe('LEFT SHIFT');
    });
  });

  describe('getActionKeyInfo', () => {
    it('returns both key and display for bindable actions', () => {
      const info = getActionKeyInfo('interact');
      expect(info.key).toBe('KeyE');
      expect(info.keyDisplay).toBe('E');

      const reloadInfo = getActionKeyInfo('reload');
      expect(reloadInfo.key).toBe('KeyR');
      expect(reloadInfo.keyDisplay).toBe('R');
    });
  });

  describe('isDefaultKeyForAction', () => {
    it('returns true for default key assignments', () => {
      expect(isDefaultKeyForAction('interact', 'KeyE')).toBe(true);
      expect(isDefaultKeyForAction('reload', 'KeyR')).toBe(true);
      expect(isDefaultKeyForAction('moveForward', 'KeyW')).toBe(true);
      expect(isDefaultKeyForAction('moveForward', 'ArrowUp')).toBe(true);
    });

    it('returns false for non-default keys', () => {
      expect(isDefaultKeyForAction('interact', 'KeyF')).toBe(false);
      expect(isDefaultKeyForAction('reload', 'KeyE')).toBe(false);
    });
  });

  describe('bindableActionParams', () => {
    it('returns key info for configurable actions', () => {
      const params = bindableActionParams('reload');
      expect(params.key).toBe('KeyR');
      expect(params.keyDisplay).toBe('R');

      const interactParams = bindableActionParams('interact');
      expect(interactParams.key).toBe('KeyE');
      expect(interactParams.keyDisplay).toBe('E');
    });
  });

  describe('levelActionParams', () => {
    it('returns correct key info for level-specific actions', () => {
      expect(levelActionParams('flashlight')).toEqual({
        key: 'KeyF',
        keyDisplay: 'F',
      });

      expect(levelActionParams('scanner')).toEqual({
        key: 'KeyT',
        keyDisplay: 'T',
      });

      expect(levelActionParams('grenade')).toEqual({
        key: 'KeyG',
        keyDisplay: 'G',
      });

      expect(levelActionParams('melee')).toEqual({
        key: 'KeyV',
        keyDisplay: 'V',
      });

      expect(levelActionParams('callMarcus')).toEqual({
        key: 'KeyC',
        keyDisplay: 'C',
      });
    });
  });

  describe('constants', () => {
    it('LEVEL_SPECIFIC_KEYS contains all level actions', () => {
      expect(LEVEL_SPECIFIC_KEYS.flashlight).toBe('KeyF');
      expect(LEVEL_SPECIFIC_KEYS.scanner).toBe('KeyT');
      expect(LEVEL_SPECIFIC_KEYS.grenade).toBe('KeyG');
      expect(LEVEL_SPECIFIC_KEYS.melee).toBe('KeyV');
      expect(LEVEL_SPECIFIC_KEYS.callMarcus).toBe('KeyC');
      expect(LEVEL_SPECIFIC_KEYS.igniteJets).toBe('Space');
      expect(LEVEL_SPECIFIC_KEYS.boost).toBe('Space');
      expect(LEVEL_SPECIFIC_KEYS.brake).toBe('KeyE');
      expect(LEVEL_SPECIFIC_KEYS.stabilize).toBe('KeyQ');
      expect(LEVEL_SPECIFIC_KEYS.flare).toBe('KeyF');
    });

    it('ACTION_DEFAULT_KEYS contains all bindable actions', () => {
      expect(ACTION_DEFAULT_KEYS.moveForward).toBe('KeyW');
      expect(ACTION_DEFAULT_KEYS.moveBackward).toBe('KeyS');
      expect(ACTION_DEFAULT_KEYS.moveLeft).toBe('KeyA');
      expect(ACTION_DEFAULT_KEYS.moveRight).toBe('KeyD');
      expect(ACTION_DEFAULT_KEYS.jump).toBe('Space');
      expect(ACTION_DEFAULT_KEYS.crouch).toBe('ControlLeft');
      expect(ACTION_DEFAULT_KEYS.sprint).toBe('ShiftLeft');
      expect(ACTION_DEFAULT_KEYS.fire).toBe('Mouse0');
      expect(ACTION_DEFAULT_KEYS.reload).toBe('KeyR');
      expect(ACTION_DEFAULT_KEYS.interact).toBe('KeyE');
      expect(ACTION_DEFAULT_KEYS.pause).toBe('Escape');
    });
  });
});
