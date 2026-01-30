/**
 * AudioLogPlayer - Audio Log Playback Modal
 *
 * Displays an audio log with:
 * - Speaker portrait and info
 * - Transcript text (scrolling)
 * - Simulated playback with progress bar
 * - Play/pause controls
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioLog } from '../../game/collectibles';
import { markAudioLogPlayed } from '../../game/collectibles';
import { getAudioManager } from '../../game/core/AudioManager';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './AudioLogPlayer.module.css';

interface AudioLogPlayerProps {
  log: AudioLog;
  isOpen: boolean;
  onClose: () => void;
  autoPlay?: boolean;
}

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get portrait initials from speaker portrait type
 */
function getPortraitInitials(portrait: AudioLog['speaker']['portrait']): string {
  switch (portrait) {
    case 'commander':
      return 'CV';
    case 'marcus':
      return 'MC';
    case 'researcher':
      return 'LC';
    case 'soldier':
      return 'MR';
    case 'technician':
      return 'JK';
    case 'ai':
      return 'AI';
    default:
      return '??';
  }
}

/**
 * Get portrait CSS class from speaker portrait type
 */
function getPortraitClass(portrait: AudioLog['speaker']['portrait']): string {
  switch (portrait) {
    case 'commander':
      return styles.portraitCommander;
    case 'marcus':
      return styles.portraitMarcus;
    case 'researcher':
      return styles.portraitResearcher;
    case 'soldier':
      return styles.portraitSoldier;
    case 'technician':
      return styles.portraitTechnician;
    case 'ai':
      return styles.portraitAi;
    default:
      return styles.portraitUnknown;
  }
}

export function AudioLogPlayer({ log, isOpen, onClose, autoPlay = true }: AudioLogPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasBeenPlayed, setHasBeenPlayed] = useState(false);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const screenInfo = getScreenInfo();

  // Reset state when log changes - track by log id
  const currentLogId = log.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when log changes
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setHasBeenPlayed(false);

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }, [currentLogId]);

  // Auto-play when opened - only run once when modal opens
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    if (isOpen && autoPlay && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      // Small delay before auto-playing
      const timeout = setTimeout(() => {
        setIsPlaying(true);
        getAudioManager().play('notification', { volume: 0.3 });
      }, 500);
      return () => clearTimeout(timeout);
    }
    if (!isOpen) {
      hasAutoPlayed.current = false;
    }
  }, [isOpen, autoPlay]);

  // Simulated playback
  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= log.duration) {
            // Playback complete
            setIsPlaying(false);
            if (!hasBeenPlayed) {
              setHasBeenPlayed(true);
              markAudioLogPlayed(log.id);
            }
            return log.duration;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [isPlaying, log.duration, log.id, hasBeenPlayed]);

  // Auto-scroll transcript based on playback progress
  useEffect(() => {
    if (transcriptRef.current && isPlaying) {
      const progress = currentTime / log.duration;
      const scrollHeight = transcriptRef.current.scrollHeight - transcriptRef.current.clientHeight;
      transcriptRef.current.scrollTop = scrollHeight * progress;
    }
  }, [currentTime, log.duration, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    getAudioManager().play('notification', { volume: 0.3 });
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      // If at end, restart from beginning
      if (currentTime >= log.duration) {
        setCurrentTime(0);
      }
      handlePlay();
    }
  }, [isPlaying, currentTime, log.duration, handlePlay, handlePause]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      setCurrentTime(Math.max(0, Math.min(log.duration, percentage * log.duration)));
    },
    [log.duration]
  );

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayback();
      } else if (e.code === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleTogglePlayback, handleClose]);

  if (!isOpen) return null;

  const progress = (currentTime / log.duration) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={`${styles.statusLight} ${isPlaying ? styles.playing : ''}`} />
          <span className={styles.headerTitle}>Audio Log Playback</span>
          <button type="button" className={styles.closeButton} onClick={handleClose}>
            [X]
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Speaker section */}
          <div className={styles.speakerSection}>
            <div className={`${styles.portraitFrame} ${getPortraitClass(log.speaker.portrait)}`}>
              <div className={styles.portraitInner}>
                <div className={styles.portraitIcon}>
                  {getPortraitInitials(log.speaker.portrait)}
                </div>
              </div>
              <div className={styles.scanLine} />
            </div>
            <div className={styles.speakerInfo}>
              <span className={styles.speakerName}>{log.speaker.name}</span>
              <span className={styles.speakerTitle}>{log.speaker.title}</span>
              <span className={styles.recordingDate}>DATE: {log.recordingDate}</span>
            </div>
          </div>

          {/* Transcript section */}
          <div className={styles.transcriptSection}>
            <h3 className={styles.logTitle}>{log.title}</h3>
            <span className={styles.logCategory}>{log.category}</span>
            <div className={styles.transcriptContainer} ref={transcriptRef}>
              <p className={styles.transcriptText}>{log.transcript}</p>
            </div>
          </div>
        </div>

        {/* Playback controls */}
        <div className={styles.controls}>
          <div className={styles.progressContainer}>
            <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
            <div
              className={styles.progressBar}
              onClick={handleSeek}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  setCurrentTime((prev) => Math.min(log.duration, prev + 5));
                } else if (e.key === 'ArrowLeft') {
                  setCurrentTime((prev) => Math.max(0, prev - 5));
                }
              }}
              role="slider"
              aria-label="Playback progress"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={log.duration}
              tabIndex={0}
            >
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.timeDisplay}>{formatTime(log.duration)}</span>
          </div>

          <div className={styles.controlButtons}>
            <button
              type="button"
              className={`${styles.controlButton} ${styles.playButton} ${isPlaying ? styles.playing : ''}`}
              onClick={handleTogglePlayback}
            >
              {isPlaying ? '[ PAUSE ]' : currentTime >= log.duration ? '[ REPLAY ]' : '[ PLAY ]'}
            </button>
            <button type="button" className={styles.controlButton} onClick={handleClose}>
              [ CLOSE ]
            </button>
          </div>
        </div>

        {/* Corner decorations */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />
      </div>

      {/* Hint text for mobile */}
      {screenInfo.isTouchDevice && (
        <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.625rem' }}>TAP PLAY TO LISTEN</p>
      )}
    </div>
  );
}
