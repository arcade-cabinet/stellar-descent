import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMPAIGN_LEVELS,
  type LevelConfig,
  type LevelId,
  type LevelType,
} from '../../game/levels/types';
import styles from './LoadingModal.module.css';
import { type GameTip, getShuffledTips } from './LoadingTips';

export interface LoadingState {
  stage: string;
  progress: number;
  detail?: string;
}

interface LoadingModalProps {
  isOpen: boolean;
  loadingState?: LoadingState;
  onLoadComplete: () => void;
  /** Level being loaded - used for level preview and contextual tips */
  levelId?: LevelId;
}

// Tip rotation interval in milliseconds
const TIP_ROTATION_INTERVAL = 5000;
// Typewriter effect speed (ms per character)
const TYPEWRITER_SPEED = 25;
// Minimum time to display a tip before rotating
const MIN_TIP_DISPLAY_TIME = 3000;

// ASCII schematics for different level types
const LEVEL_SCHEMATICS: Record<string, string> = {
  station: `
    +=========================================+
    |      [====ORBITAL PLATFORM====]        |
    |     //                        \\\\       |
    |    ||    ANCHOR STATION       ||       |
    |    ||    -+-PROMETHEUS-+-     ||       |
    |     \\\\                        //       |
    |      [========================]        |
    +=========================================+`,
  drop: `
    +=========================================+
    |              /\\                        |
    |             /  \\    DROP POD           |
    |            / ** \\   DEPLOYMENT         |
    |           /______\\                     |
    |              ||    TERMINAL VELOCITY   |
    |              \\/                        |
    +=========================================+`,
  canyon: `
    +=========================================+
    |    /\\            /\\            /\\      |
    |   /  \\    ~~~   /  \\    ~~~   /  \\     |
    |  /    \\       /    \\       /    \\    |
    | /______\\_____/______\\_____/______\\   |
    |       KEPLER'S PROMISE                 |
    |       NORTHERN SECTOR                  |
    +=========================================+`,
  base: `
    +=========================================+
    |  +------+  +------+  +------+          |
    |  | BRKS |==| C&C  |==| ARMRY|          |
    |  +------+  +------+  +------+          |
    |     ||        ||        ||             |
    |  +------+  +------+  +------+          |
    |  | MED  |==| ???  |==| COMM |          |
    |  +------+  +------+  +------+          |
    +=========================================+`,
  brothers: `
    +=========================================+
    |                                         |
    |   [M]--------------------[J]           |
    |    |   COMBAT FORMATION   |            |
    |   MARINE              TITAN            |
    |   RECON              SUPPORT           |
    |                                         |
    +=========================================+`,
  hive: `
    +=========================================+
    |  ~~~~~~~~SUBTERRANEAN COMPLEX~~~~~~~~   |
    |     \\\\    //     \\\\    //     \\\\      |
    |      \\\\  //       \\\\  //       \\\\     |
    |       \\\\//    *    \\\\//    *    \\\\    |
    |        ||  [HIVE]   ||  [NEST]  ||     |
    |       //\\\\         //\\\\         //\\\\    |
    +=========================================+`,
  extraction: `
    +=========================================+
    |          +=====+=====+                  |
    |         /|     |     |\\                 |
    |        / | LZ  | PAD | \\       EVAC    |
    |       /  |OMEGA|     |  \\      POINT   |
    |      +===+=====+=====+===+             |
    |      PERIMETER DEFENSE ACTIVE          |
    +=========================================+`,
};

// Default schematic for unknown level types
const DEFAULT_SCHEMATIC = `
    +=========================================+
    |      [====LOADING SYSTEMS====]         |
    |     //                        \\\\       |
    |    ||    TERRAN EXPANSION     ||       |
    |    ||      AUTHORITY          ||       |
    |     \\\\                        //       |
    |      [========================]        |
    +=========================================+`;

// Loading stages with visual identifiers
const LOADING_STAGE_ICONS: Record<string, string> = {
  INITIALIZING: '[>  ]',
  LOADING: '[>> ]',
  PROCESSING: '[>>>]',
  FINALIZING: '[<=>]',
  COMPLETE: '[OK]',
};

function getStageIcon(stage: string): string {
  const upperStage = stage.toUpperCase();
  for (const [key, icon] of Object.entries(LOADING_STAGE_ICONS)) {
    if (upperStage.includes(key)) {
      return icon;
    }
  }
  return '[>>]';
}

/**
 * Custom hook for typewriter text effect
 */
function useTypewriter(text: string, speed: number = TYPEWRITER_SPEED): string {
  const [displayedText, setDisplayedText] = useState('');
  const textRef = useRef(text);

  // Reset when text changes
  if (textRef.current !== text) {
    textRef.current = text;
    setDisplayedText('');
  }

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[prev.length]);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [displayedText, text, speed]);

  return displayedText;
}

/**
 * Generate random data stream characters
 */
function generateDataStream(length: number): string {
  const chars = '0123456789ABCDEF:.';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function LoadingModal({ isOpen, loadingState, onLoadComplete, levelId }: LoadingModalProps) {
  const [displayState, setDisplayState] = useState<LoadingState>({
    stage: 'INITIALIZING SYSTEMS...',
    progress: 0,
  });
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipFading, setTipFading] = useState(false);
  const [dataStream, setDataStream] = useState(() => generateDataStream(32));
  const completedRef = useRef(false);
  const tipIntervalRef = useRef<number | null>(null);
  const tipStartTimeRef = useRef<number>(Date.now());

  // Get level config for preview
  const levelConfig: LevelConfig | undefined = useMemo(() => {
    if (levelId) {
      return CAMPAIGN_LEVELS[levelId];
    }
    return undefined;
  }, [levelId]);

  // Get level type for contextual tips
  const levelType: LevelType | undefined = levelConfig?.type;

  // Get the appropriate schematic
  const schematic = useMemo(() => {
    if (levelConfig?.type) {
      return LEVEL_SCHEMATICS[levelConfig.type] || DEFAULT_SCHEMATIC;
    }
    return DEFAULT_SCHEMATIC;
  }, [levelConfig]);

  // Get shuffled tips filtered by level context
  const shuffledTips = useMemo((): GameTip[] => {
    return getShuffledTips(levelId, levelType);
  }, [levelId, levelType]);

  // Current tip with typewriter effect
  const currentTip = shuffledTips[currentTipIndex] || {
    category: 'INTEL',
    tip: 'Stand by for deployment...',
  };
  const typedTipText = useTypewriter(currentTip.tip, TYPEWRITER_SPEED);

  // Rotate tips with fade transition
  const rotateTip = useCallback(() => {
    const now = Date.now();
    const elapsed = now - tipStartTimeRef.current;

    // Ensure minimum display time
    if (elapsed < MIN_TIP_DISPLAY_TIME) {
      return;
    }

    setTipFading(true);
    setTimeout(() => {
      setCurrentTipIndex((prev) => (prev + 1) % shuffledTips.length);
      tipStartTimeRef.current = Date.now();
      setTipFading(false);
    }, 300);
  }, [shuffledTips.length]);

  // Animate data stream
  useEffect(() => {
    if (!isOpen) return;

    const streamInterval = setInterval(() => {
      setDataStream(generateDataStream(32));
    }, 150);

    return () => clearInterval(streamInterval);
  }, [isOpen]);

  // Start tip rotation when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset tip index on open
      setCurrentTipIndex(Math.floor(Math.random() * Math.max(1, shuffledTips.length)));
      setTipFading(false);
      tipStartTimeRef.current = Date.now();

      // Start rotation interval
      tipIntervalRef.current = window.setInterval(rotateTip, TIP_ROTATION_INTERVAL);
    }

    return () => {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
    };
  }, [isOpen, rotateTip, shuffledTips.length]);

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

  const progressSegments = 20;
  const filledSegments = Math.floor((displayState.progress / 100) * progressSegments);
  const stageIcon = getStageIcon(displayState.stage);

  return (
    <div className={styles.overlay} role="dialog" aria-label="Loading" aria-busy="true">
      {/* Animated scan lines effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Moving scanner line */}
      <div className={styles.scannerLine} aria-hidden="true" />

      <div className={styles.modal}>
        {/* Corner decorations with blinking lights */}
        <div className={styles.cornerTL} aria-hidden="true">
          <div className={styles.cornerLight} />
        </div>
        <div className={styles.cornerTR} aria-hidden="true">
          <div className={styles.cornerLight} />
        </div>
        <div className={styles.cornerBL} aria-hidden="true">
          <div className={styles.cornerLight} />
        </div>
        <div className={styles.cornerBR} aria-hidden="true">
          <div className={styles.cornerLight} />
        </div>

        {/* Data stream header */}
        <div className={styles.dataStream} aria-hidden="true">
          {dataStream}
        </div>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLine} />
          <span className={styles.headerText}>
            {levelConfig ? levelConfig.actName : 'TERRAN EXPANSION AUTHORITY'}
          </span>
          <div className={styles.headerLine} />
        </div>

        {/* Level Info Section */}
        {levelConfig && (
          <div className={styles.levelInfo}>
            <div className={styles.levelHeader}>
              <span className={styles.chapterLabel}>CHAPTER {levelConfig.chapter}</span>
              <span className={styles.missionName}>{levelConfig.missionName}</span>
              {levelConfig.missionSubtitle && (
                <span className={styles.missionSubtitle}>{levelConfig.missionSubtitle}</span>
              )}
            </div>
          </div>
        )}

        {/* Station schematic */}
        <div className={styles.schematic}>
          <pre className={styles.asciiArt} aria-hidden="true">
            {schematic}
          </pre>
          <div className={styles.schematicGlow} aria-hidden="true" />
        </div>

        {/* Segmented Progress Bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>
            <span className={styles.progressStage}>{stageIcon} LOADING</span>
            <span className={styles.progressPercent}>{Math.round(displayState.progress)}%</span>
          </div>
          <div className={styles.progressContainer}>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuenow={displayState.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {Array.from({ length: progressSegments }).map((_, i) => {
                const segmentId = `progress-segment-${i}`;
                return (
                  <div
                    key={segmentId}
                    className={`${styles.progressSegment} ${
                      i < filledSegments ? styles.segmentFilled : ''
                    } ${i === filledSegments - 1 && i >= 0 ? styles.segmentActive : ''}`}
                  />
                );
              })}
            </div>
          </div>
          <div className={styles.progressSubtext}>
            {displayState.progress < 100 ? 'TRANSFERRING DATA...' : 'TRANSFER COMPLETE'}
          </div>
        </div>

        {/* Status text */}
        <div className={styles.status}>
          <span className={styles.statusIndicator} aria-hidden="true" />
          <span className={styles.statusText}>
            {displayState.stage}
            {displayState.detail && (
              <span className={styles.statusDetail}> - {displayState.detail}</span>
            )}
          </span>
        </div>

        {/* Gameplay Tips Section */}
        <div className={styles.tipsSection}>
          <div className={styles.tipsDivider}>
            <div className={styles.tipsLine} />
            <span className={styles.tipsLabel}>COMBAT ADVISORY</span>
            <div className={styles.tipsLine} />
          </div>
          <div className={`${styles.tipContainer} ${tipFading ? styles.tipFading : ''}`}>
            <span className={styles.tipCategory}>[{currentTip.category}]</span>
            <p className={styles.tipText}>
              {typedTipText}
              <span className={styles.cursor} aria-hidden="true">
                _
              </span>
            </p>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className={styles.systemStatus} aria-hidden="true">
          <div className={styles.statusItem}>
            <span className={styles.statusDot} data-status="active" />
            <span>COMMS</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} data-status="active" />
            <span>NAV</span>
          </div>
          <div className={styles.statusItem}>
            <span
              className={styles.statusDot}
              data-status={displayState.progress < 100 ? 'loading' : 'active'}
            />
            <span>WEAP</span>
          </div>
          <div className={styles.statusItem}>
            <span
              className={styles.statusDot}
              data-status={displayState.progress < 50 ? 'loading' : 'active'}
            />
            <span>LIFE</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span>TERRAN EXPANSION AUTHORITY</span>
          <span className={styles.secureConnection}>
            <span className={styles.connectionDot} aria-hidden="true" />
            SECURE CONNECTION
          </span>
        </div>
      </div>
    </div>
  );
}
