/**
 * Tests for usePWA hook
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __test__ as pwaMockTest } from '../test/mocks/pwa-register';
import { usePWA } from './usePWA';

describe('usePWA', () => {
  beforeEach(() => {
    // Reset the mock state
    pwaMockTest.reset();

    // Mock navigator.onLine
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    pwaMockTest.reset();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isOffline).toBe(false);
    expect(result.current.isOfflineReady).toBe(false);
    expect(result.current.needsUpdate).toBe(false);
    expect(result.current.registrationError).toBe(null);
  });

  it('should detect offline state from navigator.onLine', () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isOffline).toBe(true);
  });

  it('should respond to online/offline events', () => {
    const { result } = renderHook(() => usePWA());

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOffline).toBe(true);

    // Simulate going online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOffline).toBe(false);
  });

  it('should provide dismissOfflineReady callback', () => {
    const { result } = renderHook(() => usePWA());

    expect(typeof result.current.dismissOfflineReady).toBe('function');
  });

  it('should provide dismissUpdate callback', () => {
    const { result } = renderHook(() => usePWA());

    expect(typeof result.current.dismissUpdate).toBe('function');
  });

  it('should provide updateServiceWorker callback', () => {
    const { result } = renderHook(() => usePWA());

    expect(typeof result.current.updateServiceWorker).toBe('function');
  });

  it('should set isOfflineReady when triggered', async () => {
    const { result } = renderHook(() => usePWA());

    act(() => {
      pwaMockTest.triggerOfflineReady();
    });

    await waitFor(() => {
      expect(result.current.isOfflineReady).toBe(true);
    });
  });

  it('should set needsUpdate when triggered', async () => {
    const { result } = renderHook(() => usePWA());

    act(() => {
      pwaMockTest.triggerNeedRefresh();
    });

    await waitFor(() => {
      expect(result.current.needsUpdate).toBe(true);
    });
  });

  it('should dismiss offline ready notification', async () => {
    const { result } = renderHook(() => usePWA());

    // Trigger offline ready
    act(() => {
      pwaMockTest.triggerOfflineReady();
    });

    await waitFor(() => {
      expect(result.current.isOfflineReady).toBe(true);
    });

    // Dismiss it
    act(() => {
      result.current.dismissOfflineReady();
    });

    expect(result.current.isOfflineReady).toBe(false);
  });

  it('should dismiss update notification', async () => {
    const { result } = renderHook(() => usePWA());

    // Trigger update available
    act(() => {
      pwaMockTest.triggerNeedRefresh();
    });

    await waitFor(() => {
      expect(result.current.needsUpdate).toBe(true);
    });

    // Dismiss it
    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.needsUpdate).toBe(false);
  });
});
