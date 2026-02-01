/**
 * CinematicPlayer - Full-screen video cinematic playback
 *
 * Plays level intro cinematics before mission briefings.
 * Supports skip via tap/click/keypress with fade transition.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './CinematicPlayer.module.css';

interface CinematicPlayerProps {
  /** Path to the video file (e.g., /assets/videos/cinematics/landfall/intro.mp4) */
  src: string;
  /** Callback when cinematic ends or is skipped */
  onComplete: () => void;
  /** Whether the cinematic can be skipped (default: true) */
  skippable?: boolean;
}

type CinematicPhase = 'loading' | 'playing' | 'fadeOut' | 'complete' | 'error';

/**
 * Full-screen cinematic video player with skip support.
 *
 * Features:
 * - Auto-plays video on mount
 * - Skip on tap/click/keypress
 * - Fade out transition
 * - Progress bar indicator
 * - Error handling for missing videos
 */
export function CinematicPlayer({ src, onComplete, skippable = true }: CinematicPlayerProps) {
  const [phase, setPhase] = useState<CinematicPhase>('loading');
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenInfo = getScreenInfo();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  // Handle skip - fade out and complete
  const handleSkip = useCallback(() => {
    if (!skippable || phase === 'fadeOut' || phase === 'complete') return;

    // Play skip sound
    getAudioManager().play('ui_click', { volume: 0.3 });

    // Pause video and start fade
    if (videoRef.current) {
      videoRef.current.pause();
    }

    setPhase('fadeOut');

    // Complete after fade animation
    fadeTimeoutRef.current = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 500);
  }, [skippable, phase, onComplete]);

  // Video ended naturally
  const handleVideoEnd = useCallback(() => {
    if (phase === 'fadeOut' || phase === 'complete') return;

    setPhase('fadeOut');

    fadeTimeoutRef.current = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 500);
  }, [phase, onComplete]);

  // Video can play - start playback
  const handleCanPlay = useCallback(() => {
    setPhase('playing');
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked - user can tap to skip
      });
    }
  }, []);

  // Video loading error
  const handleError = useCallback(() => {
    setPhase('error');
    // Auto-skip on error after a brief moment
    fadeTimeoutRef.current = setTimeout(() => {
      onComplete();
    }, 1500);
  }, [onComplete]);

  // Update progress bar
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const { currentTime, duration } = videoRef.current;
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
      }
    }
  }, []);

  // Skip on keyboard/click/touch
  useEffect(() => {
    if (!skippable || phase === 'fadeOut' || phase === 'complete') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      handleSkip();
    };

    const handleClick = () => {
      handleSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
    };
  }, [skippable, phase, handleSkip]);

  const isFadingOut = phase === 'fadeOut' || phase === 'complete';
  const showLoading = phase === 'loading';
  const showError = phase === 'error';

  return (
    <div
      className={`${styles.overlay} ${isFadingOut ? styles.fadeOut : ''}`}
      role="presentation"
      aria-label="Level cinematic"
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        playsInline
        muted={false}
        onCanPlay={handleCanPlay}
        onEnded={handleVideoEnd}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Loading indicator */}
      {showLoading && (
        <div className={styles.loadingIndicator}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
        </div>
      )}

      {/* Error message */}
      {showError && (
        <div className={styles.errorMessage}>
          CINEMATIC UNAVAILABLE
          <br />
          SKIPPING...
        </div>
      )}

      {/* Progress bar */}
      {phase === 'playing' && (
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      )}

      {/* Corner brackets */}
      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerTR} aria-hidden="true" />
      <div className={styles.cornerBL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />

      {/* Skip hint */}
      {skippable && phase === 'playing' && (
        <div className={styles.skipHint}>
          {screenInfo.isTouchDevice ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP'}
        </div>
      )}
    </div>
  );
}
