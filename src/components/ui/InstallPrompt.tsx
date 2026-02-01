import { useCallback, useEffect, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { getLogger } from '../../game/core/Logger';
import styles from './InstallPrompt.module.css';

/**
 * BeforeInstallPromptEvent interface for PWA install prompt
 * This event is fired when the browser determines the app can be installed.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const log = getLogger('InstallPrompt');

// Storage keys for install prompt state
const STORAGE_KEYS = {
  DISMISSED: 'stellar_descent_install_dismissed',
  INSTALLED: 'stellar_descent_pwa_installed',
  FIRST_STANDALONE_LAUNCH: 'stellar_descent_first_standalone',
} as const;

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
function isStandaloneMode(): boolean {
  // Check display-mode media query (works on most browsers)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari standalone check
  const isIOSStandalone = 'standalone' in navigator && (navigator as any).standalone === true;

  return isStandalone || isIOSStandalone;
}

/**
 * Detect if the device is running iOS Safari
 */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

interface InstallPromptProps {
  /** Trigger to show the prompt (e.g., after tutorial completion) */
  triggerShow?: boolean;
  /** Callback when install prompt is closed */
  onClose?: () => void;
}

/**
 * InstallPrompt Component
 *
 * Custom PWA install prompt with military terminal aesthetic.
 * Shows after user engagement (tutorial completion) and remembers if dismissed.
 *
 * Features:
 * - Standard PWA install flow for Chrome/Edge/etc
 * - Manual instructions for iOS Safari
 * - Standalone mode detection for post-install experience
 * - Persistent dismiss state via localStorage
 */
export function InstallPrompt({ triggerShow = false, onClose }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<'accepted' | 'dismissed' | null>(null);

  // Check if we should show the prompt
  const shouldShowPrompt = useCallback(() => {
    // Don't show if already in standalone mode
    if (isStandaloneMode()) {
      return false;
    }

    // Don't show if user previously dismissed
    const wasDismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED);
    if (wasDismissed === 'true') {
      return false;
    }

    // Don't show if already installed (some browsers still fire beforeinstallprompt)
    const wasInstalled = localStorage.getItem(STORAGE_KEYS.INSTALLED);
    if (wasInstalled === 'true') {
      return false;
    }

    return true;
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Check for standalone mode and show welcome message
  useEffect(() => {
    if (isStandaloneMode()) {
      const isFirstLaunch = !localStorage.getItem(STORAGE_KEYS.FIRST_STANDALONE_LAUNCH);
      if (isFirstLaunch) {
        localStorage.setItem(STORAGE_KEYS.FIRST_STANDALONE_LAUNCH, 'true');
        setShowWelcomeBack(true);
        // Auto-dismiss after 4 seconds
        const timer = setTimeout(() => {
          setShowWelcomeBack(false);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Trigger prompt display based on external trigger
  useEffect(() => {
    if (triggerShow && shouldShowPrompt()) {
      // Check if iOS Safari - show manual instructions
      if (isIOSSafari()) {
        setShowIOSInstructions(true);
        setShowPrompt(true);
      } else if (deferredPrompt) {
        // Standard PWA install prompt available
        setShowPrompt(true);
      }
    }
  }, [triggerShow, deferredPrompt, shouldShowPrompt]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  // Handle install button click
  const handleInstall = useCallback(async () => {
    playClickSound();

    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setInstallOutcome(outcome);

      if (outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);

      // Auto-close after showing result
      setTimeout(() => {
        setShowPrompt(false);
        onClose?.();
      }, 2000);
    } catch (error) {
      log.error('Error during PWA install:', error);
      setShowPrompt(false);
      onClose?.();
    }
  }, [deferredPrompt, playClickSound, onClose]);

  // Handle dismiss button click
  const handleDismiss = useCallback(() => {
    playClickSound();
    localStorage.setItem(STORAGE_KEYS.DISMISSED, 'true');
    setShowPrompt(false);
    setShowIOSInstructions(false);
    onClose?.();
  }, [playClickSound, onClose]);

  // Handle iOS instructions close
  const handleIOSClose = useCallback(() => {
    playClickSound();
    localStorage.setItem(STORAGE_KEYS.DISMISSED, 'true');
    setShowIOSInstructions(false);
    setShowPrompt(false);
    onClose?.();
  }, [playClickSound, onClose]);

  // Handle welcome message dismiss
  const handleWelcomeDismiss = useCallback(() => {
    playClickSound();
    setShowWelcomeBack(false);
  }, [playClickSound]);

  // Render welcome back message for first standalone launch
  if (showWelcomeBack) {
    return (
      <div className={styles.welcomeOverlay} role="dialog" aria-label="Welcome message">
        <div className={styles.welcomePanel}>
          <div className={styles.cornerTL} />
          <div className={styles.cornerTR} />
          <div className={styles.cornerBL} />
          <div className={styles.cornerBR} />

          <div className={styles.welcomeHeader}>
            <div className={styles.statusLight} />
            <span>SYSTEM INITIALIZED</span>
          </div>

          <div className={styles.welcomeContent}>
            <div className={styles.welcomeIcon}>&#9733;</div>
            <div className={styles.welcomeTitle}>STELLAR DESCENT</div>
            <div className={styles.welcomeSubtitle}>APP MODE ACTIVATED</div>
            <p className={styles.welcomeText}>
              Welcome, Specter. Full tactical interface enabled.
              <br />
              Optimal combat experience ready.
            </p>
          </div>

          <button
            type="button"
            className={styles.welcomeButton}
            onClick={handleWelcomeDismiss}
            aria-label="Dismiss welcome message"
          >
            CONTINUE
          </button>
        </div>
      </div>
    );
  }

  // Don't render if prompt shouldn't be shown
  if (!showPrompt) {
    return null;
  }

  // iOS Safari instructions
  if (showIOSInstructions) {
    return (
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
      >
        <div className={styles.panel}>
          <div className={styles.cornerTL} />
          <div className={styles.cornerTR} />
          <div className={styles.cornerBL} />
          <div className={styles.cornerBR} />

          <div className={styles.header}>
            <div className={styles.statusLight} />
            <span id="ios-install-title">INSTALLATION PROTOCOL</span>
          </div>

          <div className={styles.content}>
            <div className={styles.icon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={styles.iconSvg}
                role="img"
                aria-label="Share icon"
              >
                <path d="M12 3v12M12 3l4 4M12 3L8 7" />
                <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
              </svg>
            </div>

            <div className={styles.title}>ADD TO HOME SCREEN</div>
            <div className={styles.subtitle}>iOS MANUAL INSTALLATION</div>

            <div className={styles.instructions}>
              <div className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepText}>
                  Tap the <strong>Share</strong> button in Safari
                  <span className={styles.shareIcon} aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path d="M12 3v12M12 3l4 4M12 3L8 7M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
                    </svg>
                  </span>
                </span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepText}>
                  Scroll and tap <strong>"Add to Home Screen"</strong>
                </span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>3</span>
                <span className={styles.stepText}>
                  Tap <strong>"Add"</strong> to confirm
                </span>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.dismissButton} onClick={handleIOSClose}>
              NOT NOW
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show install outcome
  if (installOutcome) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Using div for overlay styling
      <div className={styles.overlay} role="status" aria-live="polite">
        <div className={styles.panel}>
          <div className={styles.cornerTL} />
          <div className={styles.cornerTR} />
          <div className={styles.cornerBL} />
          <div className={styles.cornerBR} />

          <div className={styles.outcomeContent}>
            {installOutcome === 'accepted' ? (
              <>
                <div className={styles.outcomeIcon}>&#10003;</div>
                <div className={styles.outcomeTitle}>INSTALLATION COMPLETE</div>
                <div className={styles.outcomeText}>
                  STELLAR DESCENT has been added to your home screen.
                </div>
              </>
            ) : (
              <>
                <div className={styles.outcomeIcon}>&#8212;</div>
                <div className={styles.outcomeTitle}>INSTALLATION CANCELLED</div>
                <div className={styles.outcomeText}>
                  You can install later from the browser menu.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard install prompt
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className={styles.panel}>
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        <div className={styles.header}>
          <div className={styles.statusLight} />
          <span id="install-title">TACTICAL UPGRADE AVAILABLE</span>
        </div>

        <div className={styles.content}>
          <div className={styles.icon}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={styles.iconSvg}
              role="img"
              aria-label="Mobile device icon"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
              <path d="M9 6h6M9 9h6" />
            </svg>
          </div>

          <div className={styles.title}>INSTALL STELLAR DESCENT</div>
          <div className={styles.subtitle}>ENHANCED COMBAT EXPERIENCE</div>

          <ul className={styles.benefits}>
            <li>
              <span className={styles.benefitIcon}>&#9632;</span>
              Launch instantly from home screen
            </li>
            <li>
              <span className={styles.benefitIcon}>&#9632;</span>
              Full screen immersive mode
            </li>
            <li>
              <span className={styles.benefitIcon}>&#9632;</span>
              Offline mission capability
            </li>
            <li>
              <span className={styles.benefitIcon}>&#9632;</span>
              Optimized performance
            </li>
          </ul>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.dismissButton} onClick={handleDismiss}>
            NOT NOW
          </button>
          <button type="button" className={styles.installButton} onClick={handleInstall}>
            INSTALL
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage install prompt visibility
 * Returns functions to trigger the prompt at the appropriate time
 */
export function useInstallPrompt() {
  const [shouldTrigger, setShouldTrigger] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
  }, []);

  const triggerPrompt = useCallback(() => {
    if (!isStandaloneMode()) {
      setShouldTrigger(true);
    }
  }, []);

  const resetTrigger = useCallback(() => {
    setShouldTrigger(false);
  }, []);

  return {
    shouldTrigger,
    triggerPrompt,
    resetTrigger,
    isStandalone,
  };
}

// Storage key for checking if prompt was dismissed
const DISMISSED_KEY = STORAGE_KEYS.DISMISSED;

/**
 * Hook to check if install is available (for menu button visibility)
 * Returns whether the app can be installed and a function to trigger the install
 */
export function useInstallAvailable() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (isStandaloneMode()) {
      setIsAvailable(false);
      return;
    }

    // Check if iOS Safari (manual install available)
    if (isIOSSafari()) {
      setIsIOSDevice(true);
      // Only show if not previously dismissed
      const wasDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
      setIsAvailable(!wasDismissed);
      return;
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if not previously dismissed
      const wasDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
      setIsAvailable(!wasDismissed);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsAvailable(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return {
    isAvailable,
    isIOSDevice,
    deferredPrompt,
    isStandalone: isStandaloneMode(),
  };
}
