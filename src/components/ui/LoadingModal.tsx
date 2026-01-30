import { useEffect, useRef, useState } from 'react';
import styles from './LoadingModal.module.css';

export interface LoadingState {
  stage: string;
  progress: number;
  detail?: string;
}

interface LoadingModalProps {
  isOpen: boolean;
  loadingState?: LoadingState;
  onLoadComplete: () => void;
}

export function LoadingModal({ isOpen, loadingState, onLoadComplete }: LoadingModalProps) {
  const [displayState, setDisplayState] = useState<LoadingState>({
    stage: 'INITIALIZING SYSTEMS...',
    progress: 0,
  });
  const completedRef = useRef(false);

  // Update display when loading state changes
  useEffect(() => {
    if (loadingState) {
      setDisplayState(loadingState);
    }
  }, [loadingState]);

  // Trigger completion when progress reaches 100
  useEffect(() => {
    if (displayState.progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      // Small delay to show "SYSTEMS ONLINE" before transitioning
      const timer = setTimeout(onLoadComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [displayState.progress, onLoadComplete]);

  // Reset completed flag when modal opens
  useEffect(() => {
    if (isOpen) {
      completedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLine} />
          <span className={styles.headerText}>ANCHOR STATION PROMETHEUS</span>
          <div className={styles.headerLine} />
        </div>

        {/* Station schematic */}
        <div className={styles.schematic}>
          <pre className={styles.asciiArt}>{`
    ╔═══════════════════════════════════╗
    ║     ◇═══════════════════◇        ║
    ║    /                      \\       ║
    ║   [  PROMETHEUS STATION   ]      ║
    ║    \\                      /       ║
    ║     ◇═══════════════════◇        ║
    ╚═══════════════════════════════════╝
          `}</pre>
        </div>

        {/* Progress bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${displayState.progress}%` }} />
          </div>
          <span className={styles.progressPercent}>{Math.round(displayState.progress)}%</span>
        </div>

        {/* Status text */}
        <div className={styles.status}>
          <span className={styles.statusIndicator} />
          <span className={styles.statusText}>
            {displayState.stage}
            {displayState.detail && (
              <span className={styles.statusDetail}> - {displayState.detail}</span>
            )}
          </span>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span>TERRAN EXPANSION AUTHORITY</span>
          <span>SECURE CONNECTION</span>
        </div>
      </div>
    </div>
  );
}
