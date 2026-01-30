/**
 * Mock for virtual:pwa-register module
 *
 * This mock provides a test-friendly implementation of the PWA registration
 * functions that vite-plugin-pwa normally provides via virtual modules.
 */

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

// Store for testing callbacks
let registeredOptions: RegisterSWOptions | null = null;

/**
 * Mock registerSW function
 * Returns a function that can be called to update the service worker
 */
export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  registeredOptions = options || null;

  // Call onRegistered callback if provided (simulates successful registration)
  if (options?.onRegistered) {
    // Use setTimeout to simulate async registration
    setTimeout(() => {
      options.onRegistered?.(undefined);
    }, 0);
  }

  // Return the update function
  return async (reloadPage?: boolean) => {
    if (reloadPage !== false) {
      // In tests, we don't actually reload
      console.log('[PWA Mock] Would reload page');
    }
  };
}

// Test helpers to simulate PWA events
export const __test__ = {
  /** Get the registered options for assertions */
  getOptions: () => registeredOptions,

  /** Reset the mock state */
  reset: () => {
    registeredOptions = null;
  },

  /** Simulate the service worker being ready for offline use */
  triggerOfflineReady: () => {
    registeredOptions?.onOfflineReady?.();
  },

  /** Simulate a new version being available */
  triggerNeedRefresh: () => {
    registeredOptions?.onNeedRefresh?.();
  },

  /** Simulate a registration error */
  triggerRegisterError: (error: unknown) => {
    registeredOptions?.onRegisterError?.(error);
  },
};
