/**
 * AudioLogCollection - Collection Menu
 *
 * Displays all collected audio logs with:
 * - Filter by level
 * - Progress tracking
 * - Play any collected log
 * - Shows undiscovered logs as locked
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AudioLog } from '../../game/collectibles';
import {
  AUDIO_LOGS,
  getCollectiblesProgress,
  getDiscoveredAudioLogIds,
  getUnplayedAudioLogs,
} from '../../game/collectibles';
import type { LevelId } from '../../game/levels/types';
import styles from './AudioLogCollection.module.css';
import { AudioLogPlayer } from './AudioLogPlayer';

interface AudioLogCollectionProps {
  isOpen: boolean;
  onClose: () => void;
}

// Level display names
const LEVEL_NAMES: Record<LevelId, string> = {
  anchor_station: 'ANCHOR STATION',
  landfall: 'LANDFALL',
  canyon_run: 'CANYON RUN',
  fob_delta: 'FOB DELTA',
  brothers_in_arms: 'BROTHERS IN ARMS',
  southern_ice: 'SOUTHERN ICE',
  the_breach: 'THE BREACH',
  hive_assault: 'HIVE ASSAULT',
  extraction: 'EXTRACTION',
  final_escape: 'FINAL ESCAPE',
};

// Level order for display
const LEVEL_ORDER: LevelId[] = [
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
];

type FilterOption = 'all' | LevelId;

/**
 * Format duration as M:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioLogCollection({ isOpen, onClose }: AudioLogCollectionProps) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [selectedLog, setSelectedLog] = useState<AudioLog | null>(null);

  // Collection state
  const [progress, setProgress] = useState<{
    total: number;
    discovered: number;
    played: number;
    percentage: number;
    byLevel: Record<LevelId, { total: number; discovered: number }>;
  } | null>(null);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [unplayedIds, setUnplayedIds] = useState<Set<string>>(new Set());

  // Load data when component opens
  useEffect(() => {
    if (!isOpen) return;

    const collectiblesProgress = getCollectiblesProgress();
    const discoveredData = getDiscoveredAudioLogIds();
    const unplayedData = getUnplayedAudioLogs();
    const discoveredSet = new Set(discoveredData);

    // Calculate per-level progress from AUDIO_LOGS and discovered data
    const byLevel: Record<string, { total: number; discovered: number }> = {};
    for (const log of AUDIO_LOGS) {
      if (!byLevel[log.levelId]) {
        byLevel[log.levelId] = { total: 0, discovered: 0 };
      }
      byLevel[log.levelId].total++;
      if (discoveredSet.has(log.id)) {
        byLevel[log.levelId].discovered++;
      }
    }

    setProgress({
      total: collectiblesProgress.audioLogs.total,
      discovered: collectiblesProgress.audioLogs.found,
      played: collectiblesProgress.audioLogs.played,
      percentage:
        collectiblesProgress.audioLogs.total > 0
          ? Math.round(
              (collectiblesProgress.audioLogs.found / collectiblesProgress.audioLogs.total) * 100
            )
          : 0,
      byLevel: byLevel as Record<LevelId, { total: number; discovered: number }>,
    });
    setDiscoveredIds(discoveredSet);
    setUnplayedIds(new Set(unplayedData.map((d) => d.logId)));
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        // If a log is selected, close the player first
        if (selectedLog) {
          setSelectedLog(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedLog]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (filter === 'all') {
      return AUDIO_LOGS;
    }
    return AUDIO_LOGS.filter((log) => log.levelId === filter);
  }, [filter]);

  // Group logs by level
  const logsByLevel = useMemo(() => {
    const grouped: Record<LevelId, AudioLog[]> = {} as Record<LevelId, AudioLog[]>;
    for (const levelId of LEVEL_ORDER) {
      grouped[levelId] = [];
    }
    for (const log of filteredLogs) {
      if (!grouped[log.levelId]) {
        grouped[log.levelId] = [];
      }
      grouped[log.levelId].push(log);
    }
    return grouped;
  }, [filteredLogs]);

  // Filter counts for tabs
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: AUDIO_LOGS.length };
    for (const log of AUDIO_LOGS) {
      counts[log.levelId] = (counts[log.levelId] || 0) + 1;
    }
    return counts;
  }, []);

  const handleLogClick = useCallback(
    (log: AudioLog) => {
      if (discoveredIds.has(log.id)) {
        setSelectedLog(log);
      }
    },
    [discoveredIds]
  );

  const handleClosePlayer = useCallback(() => {
    setSelectedLog(null);
  }, []);

  if (!isOpen) return null;

  // Show loading state while async data loads
  if (!progress) {
    return (
      <div className={styles.overlay}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 className={styles.title}>Audio Logs</h2>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              [ CLOSE ]
            </button>
          </div>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Audio Logs</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            [ CLOSE ]
          </button>
        </div>

        {/* Progress section */}
        <div className={styles.progressSection}>
          <div className={styles.progressStats}>
            <span className={styles.progressLabel}>Collection Progress</span>
            <span className={styles.progressCount}>
              {progress.discovered} / {progress.total}
            </span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress.percentage}%` }} />
          </div>
          <span className={styles.progressPercentage}>{progress.percentage}%</span>
        </div>

        {/* Filter tabs */}
        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All<span className={styles.filterCount}>({filterCounts.all})</span>
          </button>
          {LEVEL_ORDER.map((levelId) => (
            <button
              key={levelId}
              type="button"
              className={`${styles.filterTab} ${filter === levelId ? styles.active : ''}`}
              onClick={() => setFilter(levelId)}
            >
              {LEVEL_NAMES[levelId]}
              <span className={styles.filterCount}>({filterCounts[levelId] || 0})</span>
            </button>
          ))}
        </div>

        {/* Log list */}
        <div className={styles.logList}>
          {filter === 'all'
            ? // Show grouped by level
              LEVEL_ORDER.map((levelId) => {
                const logs = logsByLevel[levelId];
                if (logs.length === 0) return null;

                const levelProgress = progress.byLevel[levelId];

                return (
                  <div key={levelId} className={styles.levelSection}>
                    <div className={styles.levelHeader}>
                      <span className={styles.levelName}>{LEVEL_NAMES[levelId]}</span>
                      <span className={styles.levelProgress}>
                        {levelProgress?.discovered || 0}/{levelProgress?.total || 0}
                      </span>
                      <div className={styles.levelDivider} />
                    </div>
                    {logs.map((log) => (
                      <LogItem
                        key={log.id}
                        log={log}
                        isDiscovered={discoveredIds.has(log.id)}
                        isUnplayed={unplayedIds.has(log.id)}
                        onClick={() => handleLogClick(log)}
                      />
                    ))}
                  </div>
                );
              })
            : // Show flat list for specific level
              filteredLogs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  isDiscovered={discoveredIds.has(log.id)}
                  isUnplayed={unplayedIds.has(log.id)}
                  onClick={() => handleLogClick(log)}
                />
              ))}

          {/* Empty state */}
          {filteredLogs.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>?</div>
              <p className={styles.emptyText}>
                No audio logs found for this filter. Explore more of the world to discover logs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Audio log player */}
      {selectedLog && (
        <AudioLogPlayer
          log={selectedLog}
          isOpen={true}
          onClose={handleClosePlayer}
          autoPlay={false}
        />
      )}
    </div>
  );
}

// Individual log item component
interface LogItemProps {
  log: AudioLog;
  isDiscovered: boolean;
  isUnplayed: boolean;
  onClick: () => void;
}

function LogItem({ log, isDiscovered, isUnplayed, onClick }: LogItemProps) {
  const classNames = [
    styles.logItem,
    !isDiscovered && styles.locked,
    isDiscovered && isUnplayed && styles.unplayed,
  ]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDiscovered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      className={classNames}
      onClick={isDiscovered ? onClick : undefined}
      tabIndex={isDiscovered ? 0 : -1}
      onKeyDown={handleKeyDown}
      disabled={!isDiscovered}
      aria-disabled={!isDiscovered}
    >
      <div className={styles.logIcon}>
        <span className={styles.logIconText}>{isDiscovered ? 'LOG' : '???'}</span>
      </div>

      <div className={styles.logInfo}>
        <span className={styles.logTitle}>{isDiscovered ? log.title : 'UNDISCOVERED LOG'}</span>
        <div className={styles.logMeta}>
          <span className={styles.logSpeaker}>
            {isDiscovered ? log.speaker.name : 'Unknown Speaker'}
          </span>
          <span className={styles.logCategory}>{log.category}</span>
          {isDiscovered && isUnplayed && <span className={styles.newBadge}>NEW</span>}
        </div>
      </div>

      <span className={styles.logDuration}>
        {isDiscovered ? formatDuration(log.duration) : '--:--'}
      </span>
    </button>
  );
}
