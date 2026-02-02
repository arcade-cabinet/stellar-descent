/**
 * LeaderboardScreen - Full leaderboard view accessible from level complete and main menu
 *
 * Features:
 * - Tab navigation for different leaderboard types (speedrun, score, accuracy, kills)
 * - Level selector dropdown
 * - Scrollable leaderboard list
 * - Highlight player's entries
 * - Show rank change indicators
 * - Filter by difficulty
 * - Sort options
 * - Military terminal styling consistent with game aesthetic
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import type { DifficultyLevel } from '../../game/core/DifficultySettings';
import { getLogger } from '../../game/core/Logger';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import {
  getPlayerName,
  leaderboardSystem,
  setPlayerName as setPlayerNameStorage,
} from '../../game/social/LeaderboardSystem';
import {
  LEADERBOARD_INFO,
  type LeaderboardEntry,
  type LeaderboardQueryResult,
  type LeaderboardType,
  type PersonalBest,
} from '../../game/social/LeaderboardTypes';
import styles from './LeaderboardScreen.module.css';
import { MilitaryButton } from './MilitaryButton';

interface LeaderboardScreenProps {
  /** Whether the screen is visible */
  isOpen: boolean;
  /** Callback to close the screen */
  onClose: () => void;
  /** Optional initial level to display */
  initialLevel?: LevelId | 'campaign';
  /** Optional initial leaderboard type */
  initialType?: LeaderboardType;
}

// Level options for dropdown
const LEVEL_OPTIONS: Array<{ id: LevelId | 'campaign'; name: string }> = [
  { id: 'campaign', name: 'CAMPAIGN TOTAL' },
  ...Object.values(CAMPAIGN_LEVELS).map((config) => ({
    id: config.id,
    name: `CH.${config.chapter}: ${config.missionName}`,
  })),
];

// Difficulty options for filter
const DIFFICULTY_OPTIONS: Array<{ id: DifficultyLevel | 'all'; name: string }> = [
  { id: 'all', name: 'ALL DIFFICULTIES' },
  { id: 'easy', name: 'EASY' },
  { id: 'normal', name: 'NORMAL' },
  { id: 'hard', name: 'HARD' },
  { id: 'nightmare', name: 'NIGHTMARE' },
];

/**
 * Format time as MM:SS.mmm
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Format date as short date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

/**
 * Get display value for a leaderboard entry based on type
 */
function getDisplayValue(entry: LeaderboardEntry, type: LeaderboardType): string {
  switch (type) {
    case 'speedrun':
      return formatTime(entry.completionTime);
    case 'score':
      return entry.score.toLocaleString();
    case 'accuracy':
      return `${entry.accuracy.toFixed(1)}%`;
    case 'kills':
      return entry.enemiesKilled.toString();
    default:
      return entry.score.toString();
  }
}

const log = getLogger('LeaderboardScreen');

export function LeaderboardScreen({
  isOpen,
  onClose,
  initialLevel = 'campaign',
  initialType = 'score',
}: LeaderboardScreenProps) {
  // State
  const [activeType, setActiveType] = useState<LeaderboardType>(initialType);
  const [selectedLevel, setSelectedLevel] = useState<LevelId | 'campaign'>(initialLevel);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardQueryResult | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playerName, setPlayerName] = useState(getPlayerName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Current leaderboard info
  const leaderboardInfo = LEADERBOARD_INFO[activeType];

  // Load leaderboard data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Initialize system if needed
        await leaderboardSystem.initialize();

        // Load leaderboard
        const data = await leaderboardSystem.getLeaderboard(selectedLevel, activeType, {
          difficulty: selectedDifficulty,
          limit: 100,
        });
        setLeaderboardData(data);

        // Load personal bests for current level
        const bests = await leaderboardSystem.getPersonalBests(selectedLevel);
        setPersonalBests(bests);
      } catch (error) {
        log.error('Failed to load leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, selectedLevel, activeType, selectedDifficulty]);

  // Get personal best for current view
  const currentPersonalBest = useMemo(() => {
    if (selectedDifficulty === 'all') {
      // Find best across all difficulties
      const matching = personalBests.filter((pb) => pb.type === activeType);
      if (matching.length === 0) return null;

      const info = LEADERBOARD_INFO[activeType];
      return matching.reduce((best, current) =>
        info.higherIsBetter
          ? current.value > best.value
            ? current
            : best
          : current.value < best.value
            ? current
            : best
      );
    }
    return (
      personalBests.find((pb) => pb.type === activeType && pb.difficulty === selectedDifficulty) ||
      null
    );
  }, [personalBests, activeType, selectedDifficulty]);

  // Play click sound
  const playClickSound = useCallback(() => {
    try {
      getAudioManager().play('ui_click', { volume: 0.2 });
    } catch {
      // Audio may not be initialized
    }
  }, []);

  // Handle tab change
  const handleTypeChange = useCallback(
    (type: LeaderboardType) => {
      playClickSound();
      setActiveType(type);
    },
    [playClickSound]
  );

  // Handle level change
  const handleLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      playClickSound();
      setSelectedLevel(e.target.value as LevelId | 'campaign');
    },
    [playClickSound]
  );

  // Handle difficulty change
  const handleDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      playClickSound();
      setSelectedDifficulty(e.target.value as DifficultyLevel | 'all');
    },
    [playClickSound]
  );

  // Handle close
  const handleClose = useCallback(() => {
    playClickSound();
    onClose();
  }, [onClose, playClickSound]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  // Handle name edit
  const handleStartNameEdit = useCallback(() => {
    setEditNameValue(playerName);
    setIsEditingName(true);
  }, [playerName]);

  const handleSaveName = useCallback(() => {
    const newName = editNameValue.trim().toUpperCase().substring(0, 16) || 'MARINE';
    setPlayerNameStorage(newName);
    setPlayerName(newName);
    setIsEditingName(false);
    playClickSound();
  }, [editNameValue, playClickSound]);

  const handleCancelNameEdit = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveName();
      } else if (e.key === 'Escape') {
        handleCancelNameEdit();
      }
    },
    [handleSaveName, handleCancelNameEdit]
  );

  // Get player ID for highlighting
  const playerId = useMemo(() => leaderboardSystem.getPlayerId(), []);

  if (!isOpen) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
    >
      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Corner brackets */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerIcon} aria-hidden="true">
              {leaderboardInfo.icon}
            </div>
            <h2 id="leaderboard-title" className={styles.title}>
              LEADERBOARDS
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close leaderboard"
            >
              {'\u2715'}
            </button>
          </div>

          {/* Player name section */}
          <div className={styles.playerSection}>
            <span className={styles.playerLabel}>CALLSIGN:</span>
            {isEditingName ? (
              <div className={styles.nameEditContainer}>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className={styles.nameInput}
                  maxLength={16}
                />
                <button type="button" className={styles.nameButton} onClick={handleSaveName}>
                  {'\u2713'}
                </button>
                <button type="button" className={styles.nameButton} onClick={handleCancelNameEdit}>
                  {'\u2715'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.playerName}
                onClick={handleStartNameEdit}
                title="Click to edit callsign"
              >
                {playerName} {'\u270E'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs for leaderboard types */}
        <div className={styles.tabs} role="tablist">
          {(Object.keys(LEADERBOARD_INFO) as LeaderboardType[]).map((type) => {
            const info = LEADERBOARD_INFO[type];
            return (
              <button
                key={type}
                type="button"
                className={`${styles.tab} ${activeType === type ? styles.active : ''}`}
                onClick={() => handleTypeChange(type)}
                role="tab"
                aria-selected={activeType === type}
                aria-controls="leaderboard-content"
              >
                <span className={styles.tabIcon} aria-hidden="true">
                  {info.icon}
                </span>
                <span className={styles.tabLabel}>{info.name}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label htmlFor="level-select" className={styles.filterLabel}>
              MISSION
            </label>
            <select
              id="level-select"
              className={styles.filterSelect}
              value={selectedLevel}
              onChange={handleLevelChange}
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="difficulty-select" className={styles.filterLabel}>
              DIFFICULTY
            </label>
            <select
              id="difficulty-select"
              className={styles.filterSelect}
              value={selectedDifficulty}
              onChange={handleDifficultyChange}
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Personal best display */}
        {currentPersonalBest && (
          <div className={styles.personalBestCard}>
            <div className={styles.personalBestHeader}>
              <span className={styles.personalBestIcon}>{'\u2605'}</span>
              <span className={styles.personalBestTitle}>YOUR PERSONAL BEST</span>
            </div>
            <div className={styles.personalBestValue}>
              {getDisplayValue(currentPersonalBest.entry, activeType)}
            </div>
            <div className={styles.personalBestMeta}>
              <span>Rank: #{leaderboardData?.playerRank ?? '?'}</span>
              <span>{currentPersonalBest.difficulty.toUpperCase()}</span>
              <span>{formatDate(currentPersonalBest.timestamp)}</span>
            </div>
          </div>
        )}

        {/* Leaderboard content */}
        <div
          id="leaderboard-content"
          className={styles.content}
          role="tabpanel"
          aria-labelledby={`tab-${activeType}`}
        >
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
              <span>LOADING DATA...</span>
            </div>
          ) : !leaderboardData || leaderboardData.entries.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{leaderboardInfo.icon}</div>
              <span className={styles.emptyTitle}>NO ENTRIES YET</span>
              <span className={styles.emptyText}>
                Complete missions to add your scores to the leaderboard.
              </span>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className={styles.tableHeader}>
                <span className={styles.colRank}>RANK</span>
                <span className={styles.colName}>MARINE</span>
                <span className={styles.colValue}>{leaderboardInfo.name}</span>
                <span className={styles.colRating}>RATING</span>
                <span className={styles.colDifficulty}>DIFF</span>
                <span className={styles.colDate}>DATE</span>
              </div>

              {/* Entries list */}
              <div className={styles.entriesList}>
                {leaderboardData.entries.map((entry) => {
                  const isPlayer = entry.playerId === playerId;
                  const isTopThree = entry.rank <= 3;

                  return (
                    <div
                      key={entry.id}
                      className={`
                        ${styles.entryRow}
                        ${isPlayer ? styles.playerEntry : ''}
                        ${isTopThree ? styles.topEntry : ''}
                        ${entry.rank === 1 ? styles.firstPlace : ''}
                        ${entry.rank === 2 ? styles.secondPlace : ''}
                        ${entry.rank === 3 ? styles.thirdPlace : ''}
                      `}
                    >
                      <span className={styles.colRank}>
                        {entry.rank === 1 && <span className={styles.medal}>{'\uD83E\uDD47'}</span>}
                        {entry.rank === 2 && <span className={styles.medal}>{'\uD83E\uDD48'}</span>}
                        {entry.rank === 3 && <span className={styles.medal}>{'\uD83E\uDD49'}</span>}
                        {entry.rank > 3 && `#${entry.rank}`}
                      </span>
                      <span className={styles.colName}>
                        {entry.playerName}
                        {isPlayer && <span className={styles.youBadge}>YOU</span>}
                      </span>
                      <span className={styles.colValue}>{getDisplayValue(entry, activeType)}</span>
                      <span className={`${styles.colRating} ${styles[`rating${entry.rating}`]}`}>
                        {entry.rating}
                      </span>
                      <span className={styles.colDifficulty}>
                        {entry.difficulty.substring(0, 1).toUpperCase()}
                      </span>
                      <span className={styles.colDate}>{formatDate(entry.timestamp)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Total count */}
              <div className={styles.totalCount}>
                Showing {leaderboardData.entries.length} of {leaderboardData.totalCount} entries
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerInfo}>
            <span>7TH DROP MARINES</span>
            <span className={styles.footerSeparator}>{'\u2022'}</span>
            <span>COMBAT RECORDS</span>
          </div>
          <MilitaryButton onClick={handleClose} size="sm">
            CLOSE
          </MilitaryButton>
        </div>
      </div>
    </div>
  );
}
