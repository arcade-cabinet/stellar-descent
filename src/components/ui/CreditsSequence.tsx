import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACHIEVEMENTS, type Achievement, getAchievementManager } from '../../game/achievements';
import { getAudioManager } from '../../game/core/AudioManager';
import { GAME_SUBTITLE, GAME_TITLE } from '../../game/core/lore';
import { WEAPONS, type WeaponId } from '../../game/entities/weapons';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import {
  formatPlayTime,
  type GameSave,
  getLevelDisplayName,
  saveSystem,
} from '../../game/persistence';
import { useGameStatsStore } from '../../game/stores/useGameStatsStore';
import styles from './CreditsSequence.module.css';

/**
 * Campaign statistics for credits display
 */
export interface CampaignStats {
  /** Total play time in milliseconds */
  totalPlayTime: number;
  /** Total enemies killed */
  totalKills: number;
  /** Overall accuracy percentage (0-100) */
  overallAccuracy: number;
  /** Number of deaths/retries */
  deaths: number;
  /** Total secrets found */
  secretsFound: number;
  /** Total secrets available */
  totalSecrets: number;
  /** Favorite weapon (most kills) */
  favoriteWeapon: WeaponId | null;
  /** Total shots fired */
  shotsFired: number;
  /** Total shots hit */
  shotsHit: number;
  /** Per-level stats breakdown */
  levelStats: LevelStatEntry[];
}

/**
 * Per-level stat entry
 */
interface LevelStatEntry {
  levelId: LevelId;
  displayName: string;
  time: number;
  kills: number;
  rating: string;
}

/**
 * Calculate total secrets across all campaign levels
 */
function calculateTotalSecrets(): number {
  return Object.values(CAMPAIGN_LEVELS).reduce((sum, level) => sum + (level.totalSecrets ?? 0), 0);
}

/**
 * Default stats (used when no save data available)
 */
const DEFAULT_STATS: CampaignStats = {
  totalPlayTime: 0,
  totalKills: 0,
  overallAccuracy: 0,
  deaths: 0,
  secretsFound: 0,
  totalSecrets: calculateTotalSecrets(),
  favoriteWeapon: null,
  shotsFired: 0,
  shotsHit: 0,
  levelStats: [],
};

/**
 * Load best stats from the game stats store for a level
 */
function loadLevelBestStats(
  levelId: LevelId
): { time: number; kills: number; rating: string } | null {
  const stats = useGameStatsStore.getState().getLevelBestStats(levelId);
  if (stats) {
    return {
      time: stats.bestTime ?? 0,
      kills: stats.bestKills ?? 0,
      rating: stats.bestRating ?? 'C',
    };
  }
  return null;
}

/**
 * Calculate campaign stats from save data and localStorage
 */
function calculateCampaignStats(save: GameSave | null): CampaignStats {
  if (!save) {
    return DEFAULT_STATS;
  }

  // Get per-level stats from localStorage
  const levelIds: LevelId[] = [
    'anchor_station',
    'landfall',
    'fob_delta',
    'brothers_in_arms',
    'the_breach',
    'extraction',
  ];

  const levelStats: LevelStatEntry[] = [];
  let totalTime = 0;
  const totalKills = save.totalKills;

  for (const levelId of levelIds) {
    if (save.levelsCompleted.includes(levelId) || save.levelsVisited.includes(levelId)) {
      const stats = loadLevelBestStats(levelId);
      if (stats) {
        levelStats.push({
          levelId,
          displayName: getLevelDisplayName(levelId),
          time: stats.time,
          kills: stats.kills,
          rating: stats.rating,
        });
        totalTime += stats.time * 1000; // Convert seconds to ms
      } else {
        // Level visited but no stats recorded
        levelStats.push({
          levelId,
          displayName: getLevelDisplayName(levelId),
          time: 0,
          kills: 0,
          rating: '-',
        });
      }
    }
  }

  // Use save's play time if greater than calculated
  const playTime = Math.max(save.playTime, totalTime);

  // Get accuracy from achievement progress
  const achievementManager = getAchievementManager();
  const progress = achievementManager.getProgress();
  const shotsFired = progress.shotsFired ?? 0;
  const shotsHit = progress.shotsHit ?? 0;
  const overallAccuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;

  // Get death count from persisted store
  const deaths = useGameStatsStore.getState().getDeathCount();

  // Default favorite weapon (weapon usage tracking not implemented)
  const favoriteWeapon: WeaponId | null = 'assault_rifle';

  // Calculate total secrets from all level configs
  const totalSecrets = Object.values(CAMPAIGN_LEVELS).reduce(
    (sum, level) => sum + (level.totalSecrets ?? 0),
    0
  );

  return {
    totalPlayTime: playTime,
    totalKills,
    overallAccuracy,
    deaths,
    secretsFound: progress.secretsFound ?? 0,
    totalSecrets,
    favoriteWeapon,
    shotsFired,
    shotsHit,
    levelStats,
  };
}

/**
 * Get unlocked achievements with unlock timestamps
 */
function getUnlockedAchievements(): Array<{ achievement: Achievement; unlockedAt: number }> {
  const manager = getAchievementManager();
  const allAchievements = manager.getAllAchievements();

  return allAchievements
    .filter(({ state }) => state.unlockedAt !== null)
    .map(({ achievement, state }) => ({
      achievement,
      unlockedAt: state.unlockedAt!,
    }))
    .sort((a, b) => a.unlockedAt - b.unlockedAt);
}

/**
 * Get weapon display name from ID
 */
function getWeaponDisplayName(weaponId: WeaponId | null): string {
  if (!weaponId) return 'N/A';
  const weapon = WEAPONS[weaponId];
  return weapon?.shortName ?? weaponId;
}

interface CreditsSequenceProps {
  /** Callback when credits end or skip is pressed - returns to menu */
  onComplete: () => void;
  /** Callback for New Game+ - starts new campaign with bonuses (optional) */
  onNewGamePlus?: () => void;
  /** Optional pre-calculated stats (if not provided, will load from save) */
  stats?: CampaignStats;
  /** Duration of the scroll animation in seconds (default 60) */
  scrollDuration?: number;
}

/**
 * CreditsSequence - End-game credits with campaign statistics
 *
 * Displays:
 * - Game title and credits
 * - Development team credits
 * - Campaign statistics from save data
 * - Per-level breakdown
 * - Technology stack
 * - Special thanks
 *
 * Features:
 * - Smooth scrolling animation
 * - Speed up with SPACE
 * - Skip with ESC
 * - Progress bar
 * - Starfield background
 */
export function CreditsSequence({
  onComplete,
  onNewGamePlus,
  stats: providedStats,
  scrollDuration = 60,
}: CreditsSequenceProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFastForward, setIsFastForward] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showEndButtons, setShowEndButtons] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const animationRef = useRef<number | null>(null);

  // Load stats from save if not provided
  const stats = useMemo(() => {
    if (providedStats) return providedStats;
    const save = saveSystem.getCurrentSave();
    return calculateCampaignStats(save);
  }, [providedStats]);

  // Load unlocked achievements
  const unlockedAchievements = useMemo(() => getUnlockedAchievements(), []);
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;

  // Generate random stars for background
  const stars = useMemo(() => {
    const starCount = 50;
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      size: Math.random() * 1.5 + 1,
    }));
  }, []);

  // Play credits music on mount
  useEffect(() => {
    const audioManager = getAudioManager();
    // Use victory track for credits (already playing from level completion)
    // or switch to menu for a more ambient feel
    audioManager.playMusic('victory', 2);

    return () => {
      // Don't stop music - let it continue to menu
    };
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onComplete();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsFastForward(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setIsFastForward(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onComplete]);

  // Track progress
  useEffect(() => {
    const actualDuration = isFastForward ? scrollDuration / 3 : scrollDuration;

    const updateProgress = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const newProgress = Math.min((elapsed / actualDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        // Show end buttons instead of auto-completing
        setShowEndButtons(true);
        setIsPlaying(false);
      } else if (isPlaying) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, isFastForward, scrollDuration]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleSkip = useCallback(() => {
    playClickSound();
    setShowEndButtons(true);
    setIsPlaying(false);
  }, [playClickSound]);

  const handleReturnToMenu = useCallback(() => {
    playClickSound();
    onComplete();
  }, [onComplete, playClickSound]);

  const handleNewGamePlus = useCallback(() => {
    playClickSound();
    onNewGamePlus?.();
  }, [onNewGamePlus, playClickSound]);

  const handleTogglePause = useCallback(() => {
    playClickSound();
    setIsPlaying((prev) => !prev);
  }, [playClickSound]);

  const handleSpeedUp = useCallback(() => {
    playClickSound();
    setIsFastForward((prev) => !prev);
  }, [playClickSound]);

  const actualDuration = isFastForward ? scrollDuration / 3 : scrollDuration;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Game Credits" aria-modal="true">
      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Vignette */}
      <div className={styles.vignette} aria-hidden="true" />

      {/* Starfield background */}
      <div className={styles.starfield} aria-hidden="true">
        {stars.map((star) => (
          <div
            key={star.id}
            className={styles.star}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
              width: `${star.size}px`,
              height: `${star.size}px`,
            }}
          />
        ))}
      </div>

      {/* Credits container */}
      <div className={styles.creditsContainer}>
        <div
          ref={scrollRef}
          className={styles.scrollWrapper}
          style={
            {
              '--scroll-duration': `${actualDuration}s`,
              '--scroll-state': isPlaying ? 'running' : 'paused',
            } as React.CSSProperties
          }
        >
          <div className={styles.creditsContent}>
            {/* Game Title */}
            <div className={styles.titleSection}>
              <h1 className={styles.gameTitle}>{GAME_TITLE}</h1>
              <p className={styles.gameSubtitle}>{GAME_SUBTITLE}</p>
            </div>

            {/* Primary Credits */}
            <section className={styles.creditSection}>
              <h2 className={styles.sectionTitle}>Created By</h2>
              <div className={styles.creditItem}>
                <span className={styles.creditRole}>Game Design & Development</span>
                <span className={styles.creditName}>Jeff Bogaty</span>
              </div>
            </section>

            {/* Music Credits */}
            <section className={styles.creditSection}>
              <h2 className={styles.sectionTitle}>Music</h2>
              <div className={styles.creditItem}>
                <span className={styles.creditRole}>Original Soundtrack</span>
                <span className={styles.creditName}>Clement Panchout</span>
              </div>
            </section>

            {/* Campaign Stats */}
            <section className={styles.statsSection}>
              <h2 className={styles.sectionTitle}>Campaign Statistics</h2>

              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Play Time</span>
                  <span className={styles.statValue}>{formatPlayTime(stats.totalPlayTime)}</span>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Hostiles Eliminated</span>
                  <span className={styles.statValue}>{stats.totalKills}</span>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Overall Accuracy</span>
                  <span className={styles.statValue}>
                    {stats.overallAccuracy > 0 ? `${stats.overallAccuracy}%` : 'N/A'}
                  </span>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Deaths</span>
                  <span className={styles.statValue}>{stats.deaths}</span>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Favorite Weapon</span>
                  <span className={styles.statValue}>
                    {getWeaponDisplayName(stats.favoriteWeapon)}
                  </span>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Missions Completed</span>
                  <span className={styles.statValue}>{stats.levelStats.length}</span>
                </div>

                {stats.totalSecrets > 0 && (
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Intel Recovered</span>
                    <span className={styles.statValue}>
                      {stats.secretsFound}/{stats.totalSecrets}
                    </span>
                  </div>
                )}

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Shots Fired</span>
                  <span className={styles.statValue}>{stats.shotsFired.toLocaleString()}</span>
                </div>
              </div>

              {/* Per-level breakdown */}
              {stats.levelStats.length > 0 && (
                <div className={styles.levelBreakdown}>
                  {stats.levelStats.map((level) => (
                    <div key={level.levelId} className={styles.levelRow}>
                      <span className={styles.levelName}>{level.displayName}</span>
                      <span className={styles.levelStats}>
                        {level.time > 0
                          ? `${Math.floor(level.time / 60)}:${String(Math.floor(level.time % 60)).padStart(2, '0')}`
                          : '--:--'}{' '}
                        | {level.kills} kills | {level.rating}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Achievement Summary */}
            <section className={styles.achievementSection}>
              <h2 className={styles.sectionTitle}>Achievement Summary</h2>
              <div className={styles.achievementProgress}>
                <span className={styles.achievementCount}>
                  {unlockedAchievements.length} / {totalAchievements}
                </span>
                <span className={styles.achievementLabel}>Achievements Unlocked</span>
                <div className={styles.achievementBar}>
                  <div
                    className={styles.achievementFill}
                    style={{
                      width: `${(unlockedAchievements.length / totalAchievements) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Show first 6 unlocked achievements */}
              {unlockedAchievements.length > 0 && (
                <div className={styles.achievementList}>
                  {unlockedAchievements.slice(0, 6).map(({ achievement }) => (
                    <div key={achievement.id} className={styles.achievementItem}>
                      <span className={styles.achievementIcon}>{achievement.icon}</span>
                      <span className={styles.achievementName}>{achievement.name}</span>
                    </div>
                  ))}
                  {unlockedAchievements.length > 6 && (
                    <div className={styles.achievementMore}>
                      +{unlockedAchievements.length - 6} more
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Technology Stack */}
            <section className={styles.creditSection}>
              <h2 className={styles.sectionTitle}>Powered By</h2>
              <div className={styles.techStack}>
                <span className={styles.techItem}>React</span>
                <span className={styles.techItem}>TypeScript</span>
                <span className={styles.techItem}>Babylon.js</span>
                <span className={styles.techItem}>Tone.js</span>
                <span className={styles.techItem}>Vite</span>
              </div>
            </section>

            {/* Special Thanks */}
            <section className={styles.creditSection}>
              <h2 className={styles.sectionTitle}>Special Thanks</h2>
              <div className={styles.thanksSection}>
                <span className={styles.thanksItem}>The Babylon.js Community</span>
                <span className={styles.thanksItem}>Anthropic Claude</span>
                <span className={styles.thanksItem}>All the Marines who tested this mission</span>
                <span className={styles.thanksItem}>And you, for playing</span>
              </div>
            </section>

            {/* Final Message */}
            <div className={styles.finalMessage}>
              <span className={styles.thankYouText}>THANK YOU FOR PLAYING</span>
              <span className={styles.finalText}>7th Drop Marines</span>
              <span className={styles.marineQuote}>
                "Through the void we fall, upon the enemy we rise."
              </span>
              <span className={styles.finalText}>Semper Descensus</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className={styles.progressBar}
        style={{ '--progress': `${progress}%` } as React.CSSProperties}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Credits progress"
      />

      {/* Controls - Show playback controls during scroll, end buttons when complete */}
      {!showEndButtons ? (
        <div className={styles.controlsOverlay}>
          <button
            type="button"
            className={styles.controlButton}
            onClick={handleTogglePause}
            aria-label={isPlaying ? 'Pause credits' : 'Resume credits'}
          >
            {isPlaying ? '\u23F8' : '\u25B6'} {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          <button
            type="button"
            className={`${styles.controlButton} ${isFastForward ? styles.skipButton : ''}`}
            onClick={handleSpeedUp}
            aria-label={isFastForward ? 'Normal speed' : 'Fast forward'}
          >
            {isFastForward ? '\u25B6' : '\u23E9'} {isFastForward ? 'NORMAL' : 'SPEED UP'}
          </button>

          <button
            type="button"
            className={`${styles.controlButton} ${styles.skipButton}`}
            onClick={handleSkip}
          >
            {'\u23ED'} SKIP
          </button>
        </div>
      ) : (
        <div className={styles.endButtonsOverlay}>
          <button
            type="button"
            className={`${styles.endButton} ${styles.primaryEndButton}`}
            onClick={handleReturnToMenu}
          >
            {'\u25C0'} RETURN TO MENU
          </button>

          {onNewGamePlus && (
            <button type="button" className={styles.endButton} onClick={handleNewGamePlus}>
              {'\u2795'} NEW GAME+
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Export stats interface for external use
 */
export type { LevelStatEntry };
