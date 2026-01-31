import { useCallback, useEffect, useState } from 'react';
import { BUILD_FLAGS } from '../../game/core/BuildConfig';
import { devMode } from '../../game/core/DevMode';
import { getAudioManager } from '../../game/core/AudioManager';
import { worldDb } from '../../game/db/worldDatabase';
import {
  CAMPAIGN_LEVELS,
  iterateLevels,
  type LevelConfig,
  type LevelId,
} from '../../game/levels/types';
import styles from './LevelSelect.module.css';

interface LevelSelectProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLevel: (levelId: LevelId) => void;
}

interface LevelCompletionState {
  completed: Set<LevelId>;
  unlocked: Set<LevelId>;
}

/**
 * Level Select screen for replaying completed missions
 * Shows all 10 campaign levels with completion status and lock state
 */
export function LevelSelect({ isOpen, onClose, onSelectLevel }: LevelSelectProps) {
  const [completionState, setCompletionState] = useState<LevelCompletionState>({
    completed: new Set(),
    unlocked: new Set(['anchor_station']), // First level always unlocked
  });

  // Load completion state from database
  useEffect(() => {
    if (!isOpen) return;

    const loadCompletionState = async () => {
      await worldDb.init();
      const completedLevels = await worldDb.getCompletedLevels() as LevelId[];
      const completed = new Set<LevelId>(completedLevels);

      // Calculate unlocked levels based on completion
      // If BUILD_FLAGS.UNLOCK_ALL_CAMPAIGNS is set OR devMode.allLevelsUnlocked (Player Governor),
      // all levels are unlocked
      const unlocked = new Set<LevelId>(['anchor_station']);

      if (BUILD_FLAGS.UNLOCK_ALL_CAMPAIGNS || devMode.allLevelsUnlocked) {
        // Dev mode or Player Governor: unlock all levels
        for (const level of iterateLevels()) {
          unlocked.add(level.id);
        }
      } else {
        // Production: unlock based on completion
        for (const level of iterateLevels()) {
          if (completed.has(level.id) && level.nextLevelId) {
            unlocked.add(level.nextLevelId);
          }
        }
      }

      setCompletionState({ completed, unlocked });
    };

    loadCompletionState();
  }, [isOpen]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleLevelSelect = useCallback(
    (levelId: LevelId) => {
      if (!completionState.unlocked.has(levelId)) return;
      playClickSound();
      onSelectLevel(levelId);
    },
    [completionState.unlocked, onSelectLevel, playClickSound]
  );

  const handleClose = useCallback(() => {
    playClickSound();
    onClose();
  }, [onClose, playClickSound]);

  const handleBackdropClick = useCallback(
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

  if (!isOpen) return null;

  // Build level list from linked list traversal
  const levels: LevelConfig[] = [];
  for (const level of iterateLevels()) {
    levels.push(level);
  }

  const completedCount = completionState.completed.size;
  const totalCount = levels.length;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-select-title"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        {/* Header */}
        <div className={styles.header}>
          <h2 id="level-select-title" className={styles.title}>
            SELECT MISSION
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close level select"
          >
            X
          </button>
        </div>

        {/* Level Grid */}
        <div className={styles.levelGrid} role="list">
          {levels.map((level) => {
            const isCompleted = completionState.completed.has(level.id);
            const isUnlocked = completionState.unlocked.has(level.id);
            const isLocked = !isUnlocked;

            return (
              <div
                key={level.id}
                className={`${styles.levelCard} ${isLocked ? styles.locked : ''} ${isCompleted ? styles.completed : ''}`}
                onClick={() => handleLevelSelect(level.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLevelSelect(level.id);
                  }
                }}
                role="listitem"
                tabIndex={isUnlocked ? 0 : -1}
                aria-disabled={isLocked}
                aria-label={`${level.missionName}${isLocked ? ' - Locked' : ''}${isCompleted ? ' - Completed' : ''}`}
              >
                <div className={styles.levelHeader}>
                  <div className={styles.levelInfo}>
                    <div className={styles.levelChapter}>CHAPTER {level.chapter}</div>
                    <h3 className={styles.levelName}>{level.missionName}</h3>
                  </div>
                  <div className={styles.statusIcon}>
                    {isLocked && <span className={styles.lockIcon}>&#128274;</span>}
                    {isCompleted && <span className={styles.completedIcon}>&#10003;</span>}
                    {isUnlocked && !isCompleted && (
                      <span className={styles.availableIcon}>&#9654;</span>
                    )}
                  </div>
                </div>

                {level.missionSubtitle && (
                  <div className={styles.levelSubtitle}>{level.missionSubtitle}</div>
                )}

                <div className={styles.actName}>{level.actName}</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.backButton} onClick={handleClose}>
            BACK
          </button>
          <div className={styles.progress}>
            MISSIONS COMPLETE: {completedCount}/{totalCount}
          </div>
        </div>
      </div>
    </div>
  );
}
