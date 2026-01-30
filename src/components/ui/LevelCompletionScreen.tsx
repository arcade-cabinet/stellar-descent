import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Achievement, getAchievementManager } from '../../game/achievements';
import { useGame } from '../../game/context/GameContext';
import { getAudioManager } from '../../game/core/AudioManager';
import type { LevelId } from '../../game/levels/types';
import styles from './LevelCompletionScreen.module.css';

/**
 * Stats collected during level gameplay
 */
export interface LevelStats {
  /** Time spent in level in seconds */
  timeElapsed: number;
  /** Number of enemies killed */
  kills: number;
  /** Shots fired (for accuracy calculation) */
  shotsFired?: number;
  /** Shots that hit targets (for accuracy calculation) */
  shotsHit?: number;
  /** Number of headshots */
  headshots?: number;
  /** Total damage taken by player */
  damageTaken?: number;
  /** Number of times player died (respawned) */
  deaths?: number;
  /** Secrets found (optional) */
  secretsFound?: number;
  /** Total secrets in level (optional) */
  totalSecrets?: number;
}

/**
 * Stored best stats for a level
 */
interface LevelBestStats {
  bestTime: number;
  bestKills: number;
  bestAccuracy: number;
  bestHeadshots: number;
  lowestDamageTaken: number;
  lowestDeaths: number;
  bestRating: string;
}

interface LevelCompletionScreenProps {
  /** Callback when continue button is clicked */
  onContinue: () => void;
  /** Callback when retry mission button is clicked */
  onRetry?: () => void;
  /** Callback when main menu button is clicked */
  onMainMenu: () => void;
  /** Current level ID */
  levelId: LevelId;
  /** Mission display name */
  missionName: string;
  /** Level statistics */
  stats: LevelStats;
  /** Whether this is the final level of the campaign */
  isFinalLevel?: boolean;
}

/**
 * Score component breakdown
 */
interface ScoreBreakdown {
  timeScore: number;
  timeLabel: string;
  killScore: number;
  killLabel: string;
  accuracyScore: number;
  accuracyLabel: string;
  survivalScore: number;
  survivalLabel: string;
  totalScore: number;
}

/**
 * Calculate performance rating based on stats
 * Returns rating and score breakdown
 */
function calculateRatingWithBreakdown(
  stats: LevelStats,
  kills: number
): { rating: string; breakdown: ScoreBreakdown } {
  let timeScore = 0;
  let timeLabel = '';
  let killScore = 0;
  let killLabel = '';
  let accuracyScore = 0;
  let accuracyLabel = '';
  let survivalScore = 0;
  let survivalLabel = '';

  // Time bonus (faster = better, baseline 10 minutes) - max 30 points
  const timeMinutes = stats.timeElapsed / 60;
  if (timeMinutes < 3) {
    timeScore = 30;
    timeLabel = 'Lightning Fast';
  } else if (timeMinutes < 5) {
    timeScore = 25;
    timeLabel = 'Very Fast';
  } else if (timeMinutes < 8) {
    timeScore = 20;
    timeLabel = 'Good Pace';
  } else if (timeMinutes < 12) {
    timeScore = 12;
    timeLabel = 'Moderate';
  } else {
    timeScore = 5;
    timeLabel = 'Slow';
  }

  // Kill bonus - max 25 points
  const totalKills = kills;
  if (totalKills >= 30) {
    killScore = 25;
    killLabel = 'Exterminator';
  } else if (totalKills >= 20) {
    killScore = 20;
    killLabel = 'Efficient';
  } else if (totalKills >= 10) {
    killScore = 12;
    killLabel = 'Combat Ready';
  } else if (totalKills >= 5) {
    killScore = 8;
    killLabel = 'Engaged';
  } else {
    killScore = 4;
    killLabel = 'Minimal';
  }

  // Accuracy bonus (if tracked) - max 25 points
  if (stats.shotsFired && stats.shotsFired > 0 && stats.shotsHit !== undefined) {
    const accuracy = (stats.shotsHit / stats.shotsFired) * 100;
    if (accuracy >= 80) {
      accuracyScore = 25;
      accuracyLabel = 'Sharpshooter';
    } else if (accuracy >= 60) {
      accuracyScore = 20;
      accuracyLabel = 'Marksman';
    } else if (accuracy >= 40) {
      accuracyScore = 12;
      accuracyLabel = 'Accurate';
    } else if (accuracy >= 20) {
      accuracyScore = 8;
      accuracyLabel = 'Needs Practice';
    } else {
      accuracyScore = 4;
      accuracyLabel = 'Spray & Pray';
    }
  } else {
    // No accuracy data - give baseline score
    accuracyScore = 12;
    accuracyLabel = 'N/A';
  }

  // Survival bonus (based on damage taken and deaths) - max 20 points
  const damageTaken = stats.damageTaken ?? 0;
  const deaths = stats.deaths ?? 0;

  if (deaths === 0 && damageTaken === 0) {
    survivalScore = 20;
    survivalLabel = 'Untouchable';
  } else if (deaths === 0 && damageTaken <= 25) {
    survivalScore = 18;
    survivalLabel = 'Iron Will';
  } else if (deaths === 0 && damageTaken <= 50) {
    survivalScore = 15;
    survivalLabel = 'Resilient';
  } else if (deaths <= 1 && damageTaken <= 100) {
    survivalScore = 12;
    survivalLabel = 'Durable';
  } else if (deaths <= 2) {
    survivalScore = 8;
    survivalLabel = 'Survivor';
  } else if (deaths <= 3) {
    survivalScore = 5;
    survivalLabel = 'Persistent';
  } else {
    survivalScore = 2;
    survivalLabel = 'Determined';
  }

  const totalScore = timeScore + killScore + accuracyScore + survivalScore;

  // Rating thresholds (max 100)
  let rating: string;
  if (totalScore >= 90) rating = 'S';
  else if (totalScore >= 75) rating = 'A';
  else if (totalScore >= 55) rating = 'B';
  else if (totalScore >= 35) rating = 'C';
  else rating = 'D';

  return {
    rating,
    breakdown: {
      timeScore,
      timeLabel,
      killScore,
      killLabel,
      accuracyScore,
      accuracyLabel,
      survivalScore,
      survivalLabel,
      totalScore,
    },
  };
}

/**
 * Format time as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Storage key for level best stats
 */
function getBestStatsKey(levelId: LevelId): string {
  return `stellar_descent_best_${levelId}`;
}

/**
 * Load best stats from localStorage
 */
function loadBestStats(levelId: LevelId): LevelBestStats | null {
  try {
    const stored = localStorage.getItem(getBestStatsKey(levelId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save best stats to localStorage
 */
function saveBestStats(levelId: LevelId, stats: LevelBestStats): void {
  try {
    localStorage.setItem(getBestStatsKey(levelId), JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Custom hook for animated counter
 */
function useAnimatedCounter(
  targetValue: number,
  duration: number = 1000,
  delay: number = 0,
  onTick?: () => void
): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    hasCompletedRef.current = false;

    const timeout = setTimeout(() => {
      const startTime = performance.now();
      startTimeRef.current = startTime;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        const eased = 1 - (1 - progress) ** 3;
        const newValue = Math.floor(eased * targetValue);

        setValue(newValue);

        // Play tick sound on value changes (throttled)
        if (onTick && newValue > 0 && !hasCompletedRef.current) {
          const tickInterval = Math.max(1, Math.floor(targetValue / 10));
          if (newValue % tickInterval === 0) {
            onTick();
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setValue(targetValue);
          hasCompletedRef.current = true;
        }
      };

      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [targetValue, duration, delay, onTick]);

  return value;
}

/**
 * Get recently unlocked achievements (unlocked in last 2 minutes)
 */
function getRecentlyUnlockedAchievements(): Achievement[] {
  const manager = getAchievementManager();
  const allAchievements = manager.getAllAchievements();
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

  return allAchievements
    .filter(({ state }) => state.unlockedAt && state.unlockedAt > twoMinutesAgo)
    .map(({ achievement }) => achievement);
}

/**
 * LevelCompletionScreen - Mission Complete screen with military terminal styling
 *
 * Displays when player completes a level. Features:
 * - Mission name and SUCCESS status
 * - Animated stat counters
 * - Progress bars for score components
 * - Comparison to previous best
 * - Performance rating with breakdown
 * - Recently unlocked achievements
 * - Scan line effects for terminal aesthetic
 */
export function LevelCompletionScreen({
  onContinue,
  onRetry,
  onMainMenu,
  levelId,
  missionName,
  stats,
  isFinalLevel = false,
}: LevelCompletionScreenProps) {
  const { kills } = useGame();
  const [hasPlayedSound, setHasPlayedSound] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  // Calculate rating and breakdown
  const { rating, breakdown } = useMemo(
    () => calculateRatingWithBreakdown(stats, kills),
    [stats, kills]
  );

  // Calculate accuracy percentage
  const accuracy = useMemo(() => {
    if (stats.shotsFired && stats.shotsFired > 0 && stats.shotsHit !== undefined) {
      return Math.round((stats.shotsHit / stats.shotsFired) * 100);
    }
    return null;
  }, [stats.shotsFired, stats.shotsHit]);

  // Load and compare with best stats
  const previousBest = useMemo(() => loadBestStats(levelId), [levelId]);

  const newRecords = useMemo(() => {
    const records: {
      time: boolean;
      kills: boolean;
      accuracy: boolean;
      headshots: boolean;
      damageTaken: boolean;
      deaths: boolean;
      rating: boolean;
    } = {
      time: false,
      kills: false,
      accuracy: false,
      headshots: false,
      damageTaken: false,
      deaths: false,
      rating: false,
    };

    if (!previousBest) {
      // First completion is always a new record
      return {
        time: true,
        kills: true,
        accuracy: true,
        headshots: true,
        damageTaken: true,
        deaths: true,
        rating: true,
      };
    }

    if (stats.timeElapsed < previousBest.bestTime) {
      records.time = true;
    }
    if (kills > previousBest.bestKills) {
      records.kills = true;
    }
    if (accuracy !== null && accuracy > previousBest.bestAccuracy) {
      records.accuracy = true;
    }
    if (stats.headshots !== undefined && stats.headshots > (previousBest.bestHeadshots ?? 0)) {
      records.headshots = true;
    }
    // Lower damage is better
    if (
      stats.damageTaken !== undefined &&
      stats.damageTaken < (previousBest.lowestDamageTaken ?? Infinity)
    ) {
      records.damageTaken = true;
    }
    // Fewer deaths is better
    if (stats.deaths !== undefined && stats.deaths < (previousBest.lowestDeaths ?? Infinity)) {
      records.deaths = true;
    }

    const ratingOrder = ['D', 'C', 'B', 'A', 'S'];
    if (ratingOrder.indexOf(rating) > ratingOrder.indexOf(previousBest.bestRating)) {
      records.rating = true;
    }

    return records;
  }, [
    previousBest,
    stats.timeElapsed,
    stats.headshots,
    stats.damageTaken,
    stats.deaths,
    kills,
    accuracy,
    rating,
  ]);

  // Save new best stats
  useEffect(() => {
    const currentBest = loadBestStats(levelId);
    const headshots = stats.headshots ?? 0;
    const damageTaken = stats.damageTaken ?? Infinity;
    const deaths = stats.deaths ?? Infinity;

    const newBest: LevelBestStats = {
      bestTime: currentBest ? Math.min(currentBest.bestTime, stats.timeElapsed) : stats.timeElapsed,
      bestKills: currentBest ? Math.max(currentBest.bestKills, kills) : kills,
      bestAccuracy: currentBest
        ? Math.max(currentBest.bestAccuracy, accuracy ?? 0)
        : (accuracy ?? 0),
      bestHeadshots: currentBest ? Math.max(currentBest.bestHeadshots ?? 0, headshots) : headshots,
      lowestDamageTaken: currentBest
        ? Math.min(currentBest.lowestDamageTaken ?? Infinity, damageTaken)
        : damageTaken,
      lowestDeaths: currentBest ? Math.min(currentBest.lowestDeaths ?? Infinity, deaths) : deaths,
      bestRating: currentBest
        ? ['D', 'C', 'B', 'A', 'S'].indexOf(rating) >
          ['D', 'C', 'B', 'A', 'S'].indexOf(currentBest.bestRating)
          ? rating
          : currentBest.bestRating
        : rating,
    };
    saveBestStats(levelId, newBest);
  }, [
    levelId,
    stats.timeElapsed,
    stats.headshots,
    stats.damageTaken,
    stats.deaths,
    kills,
    accuracy,
    rating,
  ]);

  // Get recently unlocked achievements
  const recentAchievements = useMemo(() => getRecentlyUnlockedAchievements(), []);

  // Tick sound callback
  const playTickSound = useCallback(() => {
    getAudioManager().play('ui_hover', { volume: 0.1 });
  }, []);

  // Animated counters with staggered delays
  const animatedTime = useAnimatedCounter(stats.timeElapsed, 1500, 300, playTickSound);
  const animatedKills = useAnimatedCounter(kills, 1200, 600, playTickSound);
  const animatedAccuracy = useAnimatedCounter(accuracy ?? 0, 1000, 900, playTickSound);
  const animatedHeadshots = useAnimatedCounter(stats.headshots ?? 0, 1000, 1100, playTickSound);
  const animatedDamageTaken = useAnimatedCounter(stats.damageTaken ?? 0, 1000, 1300, playTickSound);
  const animatedDeaths = useAnimatedCounter(stats.deaths ?? 0, 800, 1500, playTickSound);
  const animatedTimeScore = useAnimatedCounter(breakdown.timeScore, 800, 2000);
  const animatedKillScore = useAnimatedCounter(breakdown.killScore, 800, 2200);
  const animatedAccuracyScore = useAnimatedCounter(breakdown.accuracyScore, 800, 2400);
  const animatedSurvivalScore = useAnimatedCounter(breakdown.survivalScore, 800, 2600);
  const animatedTotalScore = useAnimatedCounter(breakdown.totalScore, 1000, 3000);

  // Play victory sound on mount and focus continue button
  useEffect(() => {
    if (!hasPlayedSound) {
      getAudioManager().playMusic('victory', 2);
      getAudioManager().play('ui_click', { volume: 0.5 });
      setHasPlayedSound(true);
    }

    // Show breakdown after stats animate (longer delay for new stats)
    const breakdownTimer = setTimeout(() => setShowBreakdown(true), 1900);
    // Show achievements after breakdown
    const achievementTimer = setTimeout(() => setShowAchievements(true), 3200);

    continueButtonRef.current?.focus();

    return () => {
      clearTimeout(breakdownTimer);
      clearTimeout(achievementTimer);
    };
  }, [hasPlayedSound]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleContinue = useCallback(() => {
    playClickSound();
    onContinue();
  }, [onContinue, playClickSound]);

  const handleRetry = useCallback(() => {
    playClickSound();
    onRetry?.();
  }, [onRetry, playClickSound]);

  const handleMainMenu = useCallback(() => {
    playClickSound();
    onMainMenu();
  }, [onMainMenu, playClickSound]);

  // Get rating color class
  const ratingClass = useMemo(() => {
    switch (rating) {
      case 'S':
        return styles.ratingS;
      case 'A':
        return styles.ratingA;
      case 'B':
        return styles.ratingB;
      case 'C':
        return styles.ratingC;
      default:
        return styles.ratingD;
    }
  }, [rating]);

  // Get rating description
  const ratingDescription = useMemo(() => {
    switch (rating) {
      case 'S':
        return 'EXEMPLARY PERFORMANCE';
      case 'A':
        return 'EXCELLENT WORK, MARINE';
      case 'B':
        return 'SOLID PERFORMANCE';
      case 'C':
        return 'MISSION ACCOMPLISHED';
      default:
        return 'ROOM FOR IMPROVEMENT';
    }
  }, [rating]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-labelledby="completion-title"
      aria-modal="true"
    >
      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Victory vignette */}
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.container}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Success Marker */}
        <div className={styles.successMarker} aria-hidden="true">
          <div className={styles.successMarkerInner}>{'\u2713'}</div>
        </div>

        {/* Title */}
        <h1 id="completion-title" className={styles.title}>
          {isFinalLevel ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE'}
        </h1>

        {/* Mission name */}
        <p className={styles.missionName}>{missionName}</p>

        {/* Divider */}
        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerText}>DEBRIEF</span>
        </div>

        {/* Stats grid */}
        <div className={styles.statsContainer}>
          <div
            className={`${styles.statItem} ${styles.statAnimateIn}`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className={styles.statHeader}>
              <span className={styles.statIcon} aria-hidden="true">
                {'\u23F1'}
              </span>
              <span className={styles.statLabel}>TIME</span>
              {newRecords.time && <span className={styles.newRecord}>NEW BEST</span>}
            </div>
            <span className={styles.statValue}>{formatTime(animatedTime)}</span>
            {previousBest && !newRecords.time && (
              <span className={styles.previousBest}>Best: {formatTime(previousBest.bestTime)}</span>
            )}
          </div>

          <div
            className={`${styles.statItem} ${styles.statAnimateIn}`}
            style={{ animationDelay: '0.4s' }}
          >
            <div className={styles.statHeader}>
              <span className={styles.statIcon} aria-hidden="true">
                {'\u2694'}
              </span>
              <span className={styles.statLabel}>HOSTILES ELIMINATED</span>
              {newRecords.kills && <span className={styles.newRecord}>NEW BEST</span>}
            </div>
            <span className={styles.statValue}>{animatedKills}</span>
            {previousBest && !newRecords.kills && (
              <span className={styles.previousBest}>Best: {previousBest.bestKills}</span>
            )}
          </div>

          {accuracy !== null && (
            <div
              className={`${styles.statItem} ${styles.statAnimateIn}`}
              style={{ animationDelay: '0.6s' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">
                  {'\u25CE'}
                </span>
                <span className={styles.statLabel}>ACCURACY</span>
                {newRecords.accuracy && <span className={styles.newRecord}>NEW BEST</span>}
              </div>
              <div className={styles.statWithBar}>
                <span className={styles.statValue}>{animatedAccuracy}%</span>
                <div className={styles.accuracyBar}>
                  <div className={styles.accuracyFill} style={{ width: `${animatedAccuracy}%` }} />
                </div>
              </div>
              {previousBest && !newRecords.accuracy && (
                <span className={styles.previousBest}>Best: {previousBest.bestAccuracy}%</span>
              )}
            </div>
          )}

          {stats.headshots !== undefined && (
            <div
              className={`${styles.statItem} ${styles.statAnimateIn}`}
              style={{ animationDelay: '0.8s' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">
                  {'\u2316'}
                </span>
                <span className={styles.statLabel}>HEADSHOTS</span>
                {newRecords.headshots && <span className={styles.newRecord}>NEW BEST</span>}
              </div>
              <span className={styles.statValue}>{animatedHeadshots}</span>
              {previousBest && !newRecords.headshots && previousBest.bestHeadshots > 0 && (
                <span className={styles.previousBest}>Best: {previousBest.bestHeadshots}</span>
              )}
            </div>
          )}

          {stats.damageTaken !== undefined && (
            <div
              className={`${styles.statItem} ${styles.statAnimateIn}`}
              style={{ animationDelay: '1.0s' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">
                  {'\u2661'}
                </span>
                <span className={styles.statLabel}>DAMAGE TAKEN</span>
                {newRecords.damageTaken && <span className={styles.newRecord}>NEW BEST</span>}
              </div>
              <span
                className={`${styles.statValue} ${stats.damageTaken === 0 ? styles.perfectStat : ''}`}
              >
                {animatedDamageTaken}
              </span>
              {previousBest &&
                !newRecords.damageTaken &&
                previousBest.lowestDamageTaken < Infinity && (
                  <span className={styles.previousBest}>
                    Best: {previousBest.lowestDamageTaken}
                  </span>
                )}
            </div>
          )}

          {stats.deaths !== undefined && (
            <div
              className={`${styles.statItem} ${styles.statAnimateIn}`}
              style={{ animationDelay: '1.2s' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">
                  {'\u2620'}
                </span>
                <span className={styles.statLabel}>DEATHS</span>
                {newRecords.deaths && <span className={styles.newRecord}>NEW BEST</span>}
              </div>
              <span
                className={`${styles.statValue} ${stats.deaths === 0 ? styles.perfectStat : ''}`}
              >
                {animatedDeaths}
              </span>
              {previousBest && !newRecords.deaths && previousBest.lowestDeaths < Infinity && (
                <span className={styles.previousBest}>Best: {previousBest.lowestDeaths}</span>
              )}
            </div>
          )}

          {stats.secretsFound !== undefined && stats.totalSecrets !== undefined && (
            <div
              className={`${styles.statItem} ${styles.statAnimateIn}`}
              style={{ animationDelay: '1.4s' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">
                  {'\u2605'}
                </span>
                <span className={styles.statLabel}>INTEL RECOVERED</span>
              </div>
              <span className={styles.statValue}>
                {stats.secretsFound}/{stats.totalSecrets}
              </span>
              <div className={styles.secretsBar}>
                <div
                  className={styles.secretsFill}
                  style={{ width: `${(stats.secretsFound / stats.totalSecrets) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        {showBreakdown && (
          <div className={`${styles.breakdownContainer} ${styles.fadeIn}`}>
            <div className={styles.breakdownHeader}>
              <span className={styles.dividerText}>PERFORMANCE BREAKDOWN</span>
            </div>

            <div className={styles.breakdownGrid}>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Time Bonus</span>
                  <span className={styles.breakdownScore}>+{animatedTimeScore}</span>
                </div>
                <span className={styles.breakdownComment}>{breakdown.timeLabel}</span>
                <div className={styles.breakdownBar}>
                  <div
                    className={styles.breakdownFill}
                    style={{ width: `${(animatedTimeScore / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div className={styles.breakdownItem}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Combat Bonus</span>
                  <span className={styles.breakdownScore}>+{animatedKillScore}</span>
                </div>
                <span className={styles.breakdownComment}>{breakdown.killLabel}</span>
                <div className={styles.breakdownBar}>
                  <div
                    className={styles.breakdownFill}
                    style={{ width: `${(animatedKillScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className={styles.breakdownItem}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Accuracy Bonus</span>
                  <span className={styles.breakdownScore}>+{animatedAccuracyScore}</span>
                </div>
                <span className={styles.breakdownComment}>{breakdown.accuracyLabel}</span>
                <div className={styles.breakdownBar}>
                  <div
                    className={styles.breakdownFill}
                    style={{ width: `${(animatedAccuracyScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className={styles.breakdownItem}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Survival Bonus</span>
                  <span className={styles.breakdownScore}>+{animatedSurvivalScore}</span>
                </div>
                <span className={styles.breakdownComment}>{breakdown.survivalLabel}</span>
                <div className={styles.breakdownBar}>
                  <div
                    className={styles.breakdownFill}
                    style={{ width: `${(animatedSurvivalScore / 20) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.totalScoreRow}>
              <span className={styles.totalScoreLabel}>TOTAL SCORE</span>
              <span className={styles.totalScoreValue}>{animatedTotalScore}/100</span>
            </div>
          </div>
        )}

        {/* Rating display */}
        <div className={`${styles.ratingContainer} ${showBreakdown ? styles.ratingVisible : ''}`}>
          <span className={styles.ratingLabel}>PERFORMANCE RATING</span>
          <div className={styles.ratingDisplay}>
            <span className={`${styles.ratingValue} ${ratingClass}`}>{rating}</span>
            {newRecords.rating && <span className={styles.ratingNewRecord}>NEW BEST!</span>}
          </div>
          <span className={styles.ratingDescription}>{ratingDescription}</span>
        </div>

        {/* Achievements earned */}
        {showAchievements && recentAchievements.length > 0 && (
          <div className={`${styles.achievementsContainer} ${styles.fadeIn}`}>
            <div className={styles.achievementsHeader}>
              <span className={styles.dividerText}>ACHIEVEMENTS UNLOCKED</span>
            </div>
            <div className={styles.achievementsList}>
              {recentAchievements.map((achievement) => (
                <div key={achievement.id} className={styles.achievementItem}>
                  <span className={styles.achievementIcon}>{achievement.icon}</span>
                  <div className={styles.achievementInfo}>
                    <span className={styles.achievementName}>{achievement.name}</span>
                    <span className={styles.achievementDesc}>{achievement.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className={styles.buttonGroup}>
          <button
            ref={continueButtonRef}
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={handleContinue}
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              {isFinalLevel ? '\u2605' : '\u25B6'}
            </span>
            {isFinalLevel ? 'VIEW CREDITS' : 'CONTINUE'}
          </button>

          {onRetry && (
            <button type="button" className={styles.button} onClick={handleRetry}>
              <span className={styles.buttonIcon} aria-hidden="true">
                {'\u21BB'}
              </span>
              RETRY MISSION
            </button>
          )}

          <button type="button" className={styles.button} onClick={handleMainMenu}>
            <span className={styles.buttonIcon} aria-hidden="true">
              {'\u25C0'}
            </span>
            MAIN MENU
          </button>
        </div>

        {/* Footer info */}
        <div className={styles.footer}>
          <span>7TH DROP MARINES</span>
          <span className={styles.footerCenter}>OPERATION SUCCESS</span>
          <span>MISSION DEBRIEF</span>
        </div>
      </div>
    </div>
  );
}
