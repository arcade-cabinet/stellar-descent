/**
 * PWAUpdatePrompt Component
 *
 * Displays a prompt when a new version of the app is available.
 * Allows the user to update immediately or dismiss the notification.
 * Styled to match the game's military/tactical aesthetic.
 */

import { useCallback } from 'react';
import styles from './PWAUpdatePrompt.module.css';

interface PWAUpdatePromptProps {
  /** Whether a new version is available */
  needsUpdate: boolean;
  /** Whether the app is ready for offline use (first install) */
  isOfflineReady: boolean;
  /** Trigger the update */
  onUpdate: () => void;
  /** Dismiss the update notification */
  onDismissUpdate: () => void;
  /** Dismiss the offline ready notification */
  onDismissOfflineReady: () => void;
}

export function PWAUpdatePrompt({
  needsUpdate,
  isOfflineReady,
  onUpdate,
  onDismissUpdate,
  onDismissOfflineReady,
}: PWAUpdatePromptProps) {
  const handleUpdate = useCallback(() => {
    onUpdate();
  }, [onUpdate]);

  const handleDismiss = useCallback(() => {
    if (needsUpdate) {
      onDismissUpdate();
    } else {
      onDismissOfflineReady();
    }
  }, [needsUpdate, onDismissUpdate, onDismissOfflineReady]);

  // Don't show if neither condition is true
  if (!needsUpdate && !isOfflineReady) {
    return null;
  }

  return (
    <div
      className={styles.container}
      role="alertdialog"
      aria-labelledby="pwa-title"
      aria-describedby="pwa-description"
    >
      <div className={styles.prompt}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            {needsUpdate ? (
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Download/Update icon */}
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ) : (
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Checkmark icon */}
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <h2 id="pwa-title" className={styles.title}>
            {needsUpdate ? 'UPDATE AVAILABLE' : 'READY FOR DEPLOYMENT'}
          </h2>
        </div>

        <p id="pwa-description" className={styles.message}>
          {needsUpdate
            ? 'A new version of STELLAR DESCENT is available. Update now to get the latest features and improvements.'
            : 'STELLAR DESCENT has been cached and is ready for offline operations. You can now play without an internet connection.'}
        </p>

        <div className={styles.actions}>
          {needsUpdate && (
            <button type="button" className={styles.updateButton} onClick={handleUpdate}>
              <span className={styles.buttonText}>UPDATE NOW</span>
            </button>
          )}
          <button type="button" className={styles.dismissButton} onClick={handleDismiss}>
            <span className={styles.buttonText}>{needsUpdate ? 'LATER' : 'ACKNOWLEDGED'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
