/**
 * useSavePersistence - Handles automatic save persistence for PWA
 *
 * This hook ensures game saves are properly persisted to IndexedDB:
 * - Flushes pending saves on page unload
 * - Saves on visibility change (tab switch, app minimize)
 * - Provides manual save trigger for critical moments
 */

import { useCallback, useEffect } from 'react';
import { saveSystem } from '../game/persistence';

/**
 * Hook to manage save persistence lifecycle
 * Call this in your root app component
 */
export function useSavePersistence() {
  // Flush persistence on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon pattern for reliable unload saves
      // Note: We can't await here, but flush() will try its best
      saveSystem.flush();
    };

    // Handle page hide (more reliable on mobile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Save when app goes to background
        saveSystem.autoSave();
      }
    };

    // Handle page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Manual save trigger for critical moments
  const triggerSave = useCallback(() => {
    saveSystem.autoSave();
  }, []);

  return { triggerSave };
}
