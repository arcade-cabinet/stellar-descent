/**
 * AchievementPopup - Toast notification component for achievement unlocks
 *
 * Features:
 * - Slides in from right
 * - Auto-dismisses after 3 seconds
 * - Military styling matching game aesthetic
 * - Supports multiple simultaneous popups (queued)
 * - Category-specific color themes
 */

import { useCallback, useEffect, useState } from 'react';
import {
  type Achievement,
  getAchievementManager,
} from '../../game/achievements/AchievementManager';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './AchievementPopup.module.css';

interface PopupItem {
  id: number;
  achievement: Achievement;
  exiting: boolean;
}

const POPUP_DURATION = 3000; // 3 seconds
const EXIT_ANIMATION_DURATION = 300; // Match CSS animation

export function AchievementPopup() {
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const [nextId, setNextId] = useState(0);

  // Dismiss a popup
  const dismissPopup = useCallback((id: number) => {
    // Mark as exiting first (triggers exit animation)
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, exiting: true } : p)));

    // Remove after animation completes
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, EXIT_ANIMATION_DURATION);
  }, []);

  // Add a new popup
  const addPopup = useCallback(
    (achievement: Achievement) => {
      const id = nextId;
      setNextId((prev) => prev + 1);

      setPopups((prev) => [...prev, { id, achievement, exiting: false }]);

      // Play achievement unlock fanfare
      try {
        getAudioManager().play('achievement_unlock', { volume: 0.5 });
      } catch {
        // Audio may not be initialized
      }

      // Auto-dismiss after duration
      setTimeout(() => {
        dismissPopup(id);
      }, POPUP_DURATION);
    },
    [nextId, dismissPopup]
  );

  // Subscribe to achievement unlocks
  useEffect(() => {
    const manager = getAchievementManager();
    const unsubscribe = manager.onUnlock(addPopup);
    return unsubscribe;
  }, [addPopup]);

  if (popups.length === 0) {
    return null;
  }

  return (
    <div className={styles.popupContainer} role="status" aria-live="polite">
      {popups.map((popup) => (
        <div
          key={popup.id}
          className={`${styles.popup} ${styles[popup.achievement.category]} ${popup.exiting ? styles.exiting : ''}`}
          onClick={() => dismissPopup(popup.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              dismissPopup(popup.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={styles.iconContainer}>
            <span className={styles.icon}>{popup.achievement.icon}</span>
          </div>
          <div className={styles.content}>
            <div className={styles.header}>
              <span>ACHIEVEMENT UNLOCKED</span>
              <div className={styles.headerLine} />
            </div>
            <div className={styles.name}>{popup.achievement.name}</div>
            <div className={styles.description}>{popup.achievement.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
