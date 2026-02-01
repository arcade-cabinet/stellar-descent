/**
 * QuestTracker - HUD component for displaying active quests and objectives
 *
 * Features:
 * - Current objective with progress (e.g., "3/5 terminals hacked")
 * - Time-limited objective countdown
 * - Main vs optional quest indicators
 * - Completion animations
 * - Waypoint distance integration
 */

import { useEffect, useState } from 'react';
import type { QuestTrackerData } from '../../game/campaign/QuestTrackerTypes';
import { useGame } from '../../game/context/GameContext';
import styles from './QuestTracker.module.css';

// Re-export types for convenience
export type {
  OptionalObjectiveData,
  QuestTrackerData,
} from '../../game/campaign/QuestTrackerTypes';

interface QuestTrackerProps {
  /** Quest data to display */
  data?: QuestTrackerData | null;
  /** Whether to show the tracker */
  visible?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Format time remaining as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get icon for objective type
 */
function getObjectiveIcon(type: QuestTrackerData['objectiveType']): string {
  switch (type) {
    case 'reach_location':
      return '\u2316'; // Position indicator
    case 'kill_enemies':
      return '\u2694'; // Crossed swords
    case 'collect':
      return '\u25A0'; // Square (item)
    case 'interact':
      return '\u2139'; // Info / interact
    case 'survive':
      return '\u23F1'; // Stopwatch
    case 'escort':
      return '\u2192'; // Arrow
    case 'defend':
      return '\u2694'; // Shield (using swords as fallback)
    case 'vehicle':
      return '\u26C6'; // Vehicle indicator (using a car-like symbol)
    default:
      return '!';
  }
}

export function QuestTracker({ data, visible = true, compact = false }: QuestTrackerProps) {
  const { compassData } = useGame();
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [completedAnimation, setCompletedAnimation] = useState(false);

  // Trigger pulse when objective is close to completing
  useEffect(() => {
    if (data?.required && data?.current) {
      const remaining = data.required - data.current;
      if (remaining <= 1 && remaining > 0) {
        setPulseAnimation(true);
        const timer = setTimeout(() => setPulseAnimation(false), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [data?.current, data?.required]);

  // Handle completion animation
  useEffect(() => {
    if (data?.justCompleted) {
      setCompletedAnimation(true);
      const timer = setTimeout(() => setCompletedAnimation(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [data?.justCompleted]);

  if (!visible || !data) {
    return null;
  }

  const hasProgress = data.required !== undefined && data.current !== undefined;
  const hasTimer = data.timeRemaining !== undefined;
  const isTimerCritical = hasTimer && data.timeRemaining! <= 30;
  const isTimerWarning = hasTimer && data.timeRemaining! <= 60 && data.timeRemaining! > 30;

  // Use compass data for distance if not provided
  const displayDistance = data.distance ?? compassData.objectiveDistance;

  const containerClasses = [
    styles.tracker,
    compact ? styles.compact : '',
    completedAnimation ? styles.completed : '',
    pulseAnimation ? styles.pulse : '',
  ]
    .filter(Boolean)
    .join(' ');

  const timerClasses = [
    styles.timer,
    isTimerCritical ? styles.timerCritical : '',
    isTimerWarning ? styles.timerWarning : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="region" aria-label="Quest Tracker">
      {/* Quest header */}
      <div className={styles.header}>
        <span className={`${styles.questType} ${data.isMain ? styles.main : styles.optional}`}>
          {data.isMain ? 'MISSION' : 'OPTIONAL'}
        </span>
        <span className={styles.questName}>{data.questName}</span>
      </div>

      {/* Current objective */}
      <div className={styles.objective}>
        <span className={styles.objectiveIcon} aria-hidden="true">
          {getObjectiveIcon(data.objectiveType)}
        </span>
        <div className={styles.objectiveContent}>
          <span className={styles.objectiveText}>{data.objectiveDescription}</span>

          {/* Progress bar */}
          {hasProgress && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.min(100, (data.current! / data.required!) * 100)}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={data.required}
                  aria-valuenow={data.current}
                />
              </div>
              <span className={styles.progressText}>
                {data.current}/{data.required}
              </span>
            </div>
          )}

          {/* Distance indicator */}
          {displayDistance !== undefined && displayDistance > 0 && (
            <span className={styles.distance}>
              {displayDistance >= 1000
                ? `${(displayDistance / 1000).toFixed(1)}km`
                : `${Math.round(displayDistance)}m`}
            </span>
          )}
        </div>
      </div>

      {/* Timer for timed objectives */}
      {hasTimer && (
        <div
          className={timerClasses}
          role="timer"
          aria-label={`Time remaining: ${formatTime(data.timeRemaining!)}`}
        >
          <span className={styles.timerIcon} aria-hidden="true">
            {'\u23F1'}
          </span>
          <span className={styles.timerValue}>{formatTime(data.timeRemaining!)}</span>
        </div>
      )}

      {/* Optional objectives */}
      {data.optionalObjectives && data.optionalObjectives.length > 0 && !compact && (
        <div className={styles.optionalSection}>
          <span className={styles.optionalHeader}>BONUS</span>
          {data.optionalObjectives.map((opt) => (
            <div
              key={opt.id}
              className={`${styles.optionalObjective} ${opt.completed ? styles.optionalCompleted : ''}`}
            >
              <span className={styles.optionalCheckbox}>{opt.completed ? '\u2713' : '\u25CB'}</span>
              <span className={styles.optionalText}>
                {opt.description}
                {opt.required !== undefined && opt.current !== undefined && !opt.completed && (
                  <span className={styles.optionalProgress}>
                    {' '}
                    ({opt.current}/{opt.required})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuestTracker;
