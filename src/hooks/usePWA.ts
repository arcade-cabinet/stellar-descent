/**
 * PWA Service Worker Registration and Update Hook
 *
 * Provides:
 * - Service worker registration status
 * - Update detection and notification
 * - Offline detection
 * - Manual update trigger
 */

import { registerSW } from 'virtual:pwa-register';
import { useCallback, useEffect, useState } from 'react';

export interface PWAState {
  /** Whether the app is ready to work offline */
  isOfflineReady: boolean;
  /** Whether a new version is available */
  needsUpdate: boolean;
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Whether the service worker registration is complete */
  isRegistered: boolean;
  /** Any error that occurred during registration */
  registrationError: Error | null;
}

export interface PWAActions {
  /** Trigger the update (reload with new service worker) */
  updateServiceWorker: () => void;
  /** Dismiss the offline ready notification */
  dismissOfflineReady: () => void;
  /** Dismiss the update available notification */
  dismissUpdate: () => void;
}

export function usePWA(): PWAState & PWAActions {
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationError, setRegistrationError] = useState<Error | null>(null);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register the service worker
    try {
      const updateServiceWorker = registerSW({
        immediate: true,
        onRegistered(registration) {
          console.log('[PWA] Service worker registered');
          setIsRegistered(true);

          // Check for updates periodically (every hour)
          if (registration) {
            setInterval(
              () => {
                registration.update();
              },
              60 * 60 * 1000
            );
          }
        },
        onRegisterError(error) {
          console.error('[PWA] Service worker registration error:', error);
          setRegistrationError(error instanceof Error ? error : new Error(String(error)));
        },
        onOfflineReady() {
          console.log('[PWA] App is ready for offline use');
          setIsOfflineReady(true);
        },
        onNeedRefresh() {
          console.log('[PWA] New content available, please refresh');
          setNeedsUpdate(true);
        },
      });

      setUpdateSW(() => updateServiceWorker);
    } catch (error) {
      console.error('[PWA] Failed to register service worker:', error);
      setRegistrationError(error instanceof Error ? error : new Error(String(error)));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (updateSW) {
      updateSW();
    }
  }, [updateSW]);

  const dismissOfflineReady = useCallback(() => {
    setIsOfflineReady(false);
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedsUpdate(false);
  }, []);

  return {
    isOfflineReady,
    needsUpdate,
    isOffline,
    isRegistered,
    registrationError,
    updateServiceWorker,
    dismissOfflineReady,
    dismissUpdate,
  };
}
