/**
 * AchievementsPanel - Full achievement list view accessible from main menu
 *
 * Features:
 * - Shows all achievements (locked and unlocked)
 * - Category tabs for filtering
 * - Progress tracking display with progress bars
 * - Secret achievements hidden until unlocked
 * - Military styling consistent with game aesthetic
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AchievementWithState, getAchievementManager } from '../../game/achievements';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './AchievementsPanel.module.css';

interface AchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabFilter = 'all' | 'story' | 'combat' | 'exploration' | 'challenge';

export function AchievementsPanel({ isOpen, onClose }: AchievementsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [achievements, setAchievements] = useState<AchievementWithState[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Load achievements data
  useEffect(() => {
    if (!isOpen) return;

    const manager = getAchievementManager();
    // getAllAchievements() now returns enriched data with progress already calculated
    setAchievements(manager.getAllAchievements());
    setUnlockedCount(manager.getUnlockedCount());
    setTotalCount(manager.getTotalCount());
  }, [isOpen]);

  // Filter achievements by tab
  const filteredAchievements = useMemo(() => {
    if (activeTab === 'all') {
      return achievements;
    }
    return achievements.filter((a) => a.achievement.category === activeTab);
  }, [achievements, activeTab]);

  // Sort: unlocked first, then alphabetically
  const sortedAchievements = useMemo(() => {
    return [...filteredAchievements].sort((a, b) => {
      // Unlocked first
      const aUnlocked = a.state.unlockedAt !== null;
      const bUnlocked = b.state.unlockedAt !== null;
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;

      // If both unlocked, sort by unlock date (newest first)
      if (aUnlocked && bUnlocked) {
        return (b.state.unlockedAt ?? 0) - (a.state.unlockedAt ?? 0);
      }

      // If both locked, alphabetically
      return a.achievement.name.localeCompare(b.achievement.name);
    });
  }, [filteredAchievements]);

  const handleTabChange = useCallback((tab: TabFilter) => {
    setActiveTab(tab);
    try {
      getAudioManager().play('ui_click', { volume: 0.2 });
    } catch {
      // Audio may not be initialized
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      getAudioManager().play('ui_click', { volume: 0.3 });
    } catch {
      // Audio may not be initialized
    }
    onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-title"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="achievements-title" className={styles.title}>
            Achievements
          </h2>
          <div className={styles.progress}>
            <span>
              {unlockedCount} / {totalCount}
            </span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
            onClick={() => handleTabChange('all')}
            role="tab"
            aria-selected={activeTab === 'all'}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'story' ? styles.active : ''}`}
            onClick={() => handleTabChange('story')}
            role="tab"
            aria-selected={activeTab === 'story'}
          >
            Story
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'combat' ? styles.active : ''}`}
            onClick={() => handleTabChange('combat')}
            role="tab"
            aria-selected={activeTab === 'combat'}
          >
            Combat
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'exploration' ? styles.active : ''}`}
            onClick={() => handleTabChange('exploration')}
            role="tab"
            aria-selected={activeTab === 'exploration'}
          >
            Explore
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'challenge' ? styles.active : ''}`}
            onClick={() => handleTabChange('challenge')}
            role="tab"
            aria-selected={activeTab === 'challenge'}
          >
            Challenge
          </button>
        </div>

        {/* Content */}
        <div className={styles.content} role="tabpanel">
          {sortedAchievements.length === 0 ? (
            <div className={styles.emptyState}>No achievements in this category</div>
          ) : (
            <div className={styles.grid}>
              {sortedAchievements.map(
                ({ achievement, state, progress, progressCurrent, progressTarget }) => {
                  const isUnlocked = state.unlockedAt !== null;
                  const isSecret = achievement.secret && !isUnlocked;
                  const hasProgress =
                    !isUnlocked && progress !== undefined && progressTarget !== undefined;

                  return (
                    <div
                      key={achievement.id}
                      className={`
                      ${styles.achievementCard}
                      ${styles[achievement.category]}
                      ${isUnlocked ? styles.unlocked : styles.locked}
                      ${achievement.secret ? styles.secret : ''}
                    `}
                    >
                      <div className={styles.iconBox}>
                        <span className={styles.icon}>{isSecret ? '?' : achievement.icon}</span>
                      </div>
                      <div className={styles.info}>
                        <span className={styles.categoryBadge}>{achievement.category}</span>
                        <div className={styles.name}>{isSecret ? '???' : achievement.name}</div>
                        <div className={styles.description}>
                          {isSecret
                            ? 'This achievement is secret. Complete it to reveal details.'
                            : achievement.description}
                        </div>
                        {/* Progress bar for progressive achievements */}
                        {hasProgress && (
                          <div className={styles.progressContainer}>
                            <div className={styles.achievementProgressBar}>
                              <div
                                className={styles.achievementProgressFill}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={styles.progressText}>
                              {progressCurrent} / {progressTarget}
                            </span>
                          </div>
                        )}
                        {isUnlocked && state.unlockedAt && (
                          <div className={styles.unlockDate}>
                            Unlocked: {formatDate(state.unlockedAt)}
                          </div>
                        )}
                      </div>
                      {isUnlocked && <div className={styles.statusBadge}>Unlocked</div>}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.closeButton} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
