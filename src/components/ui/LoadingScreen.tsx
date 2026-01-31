/**
 * LoadingScreen - Full-screen loading overlay with level transitions
 *
 * Features:
 * - Full-screen overlay with theme-appropriate backgrounds
 * - Rotating contextual gameplay tips with typewriter effect
 * - Animated progress bar with multiple visual states
 * - Level artwork/schematics with atmospheric effects
 * - Smooth fade-in/fade-out transitions
 * - Accessibility support for reduced motion
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMPAIGN_LEVELS,
  type LevelConfig,
  type LevelId,
  type LevelType,
} from '../../game/levels/types';
import styles from './LoadingScreen.module.css';
import { type GameTip, getShuffledTips } from './LoadingTips';

export interface LoadingProgress {
  /** Current loading stage name */
  stage: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Optional detail text */
  detail?: string;
}

interface LoadingScreenProps {
  /** Whether the loading screen is visible */
  isVisible: boolean;
  /** Current loading progress */
  progress?: LoadingProgress;
  /** Callback when loading completes and fade-out finishes */
  onLoadComplete: () => void;
  /** Level being loaded - affects tips and visuals */
  levelId?: LevelId;
  /** Minimum display time in ms before fade-out can begin */
  minDisplayTime?: number;
}

// Configuration constants
const TIP_ROTATION_INTERVAL = 6000;
const TYPEWRITER_SPEED = 30;
const MIN_TIP_DISPLAY_TIME = 4000;
const FADE_DURATION = 800;
const DEFAULT_MIN_DISPLAY_TIME = 2000;

// Level background themes - colors and gradients for each environment
const LEVEL_BACKGROUNDS: Record<LevelType, string> = {
  station: 'linear-gradient(135deg, #0a0a0f 0%, #141428 50%, #0a0a0f 100%)',
  drop: 'linear-gradient(180deg, #000510 0%, #1a1a2e 40%, #2d1f1f 100%)',
  canyon: 'linear-gradient(180deg, #1a0a05 0%, #2d1810 50%, #0a0505 100%)',
  base: 'linear-gradient(180deg, #050a08 0%, #0a1410 50%, #050505 100%)',
  brothers: 'linear-gradient(180deg, #1a1005 0%, #2d2010 50%, #0a0805 100%)',
  hive: 'linear-gradient(180deg, #0a0510 0%, #150a18 50%, #050308 100%)',
  boss: 'linear-gradient(180deg, #150510 0%, #200a15 50%, #0a0308 100%)', // Queen boss fight
  extraction: 'linear-gradient(180deg, #1a0a00 0%, #2d1a08 50%, #0a0500 100%)',
  vehicle: 'linear-gradient(180deg, #1a0a05 0%, #2d1810 50%, #0a0505 100%)',
  ice: 'linear-gradient(180deg, #050a14 0%, #0a1828 50%, #050810 100%)',
  assault: 'linear-gradient(180deg, #0a0510 0%, #1a0a18 50%, #050308 100%)', // Combined arms assault
  combined_arms: 'linear-gradient(180deg, #0a0510 0%, #1a0a18 50%, #050308 100%)',
  escape: 'linear-gradient(180deg, #1a0500 0%, #2d0a08 50%, #0a0200 100%)', // Timed escape
  finale: 'linear-gradient(180deg, #1a0500 0%, #2d0a08 50%, #0a0200 100%)',
  mine: 'linear-gradient(180deg, #0a0808 0%, #141210 50%, #0a0808 100%)',
};

// ASCII environment art for atmospheric display
const LEVEL_ART: Record<LevelType, string[]> = {
  station: [
    '                     ╔══════════════════════════╗',
    '                     ║   ANCHOR STATION         ║',
    '            ┌────────║     PROMETHEUS           ║────────┐',
    '            │        ╚══════════════════════════╝        │',
    '       ═════╪════════════════════════════════════════════╪═════',
    '            │     ╔═══╗         ╔═══╗         ╔═══╗      │',
    '            │     ║ D ║─────────║ B ║─────────║ H ║      │',
    '            │     ╚═══╝         ╚═══╝         ╚═══╝      │',
    '            └────────────────────────────────────────────┘',
    '                   ORBITAL PLATFORM TEA-7',
  ],
  drop: [
    '                           *',
    '                          /|\\',
    '                         / | \\',
    '                        /  |  \\',
    '                       /   |   \\',
    '                      /    |    \\',
    '                     /_____|_____\\',
    '                          |||',
    '                          |||',
    '                      HALO INSERTION',
    '                    TERMINAL VELOCITY',
    '',
    '    ~~~~~~~~~~~~~~~~~ ATMOSPHERE ~~~~~~~~~~~~~~~~~',
    '        ██░░██░░██░░██░░██░░██░░██░░██░░██░░',
  ],
  canyon: [
    '         /\\                    /\\                    /\\',
    '        /  \\       ~~~~       /  \\       ~~~~       /  \\',
    '       /    \\               /    \\               /    \\',
    '      /      \\             /      \\             /      \\',
    '     /        \\           /        \\           /        \\',
    '    /          \\         /          \\         /          \\',
    '   /____________\\_______/____________\\_______/____________\\',
    '',
    "              KEPLER'S PROMISE - NORTHERN SECTOR",
    '               Surface Temperature: -47C',
  ],
  base: [
    '    ┌──────────┐    ┌──────────┐    ┌──────────┐',
    '    │ BARRACKS │════│ COMMAND  │════│ ARMORY   │',
    '    │   [B1]   │    │   [C1]   │    │   [A1]   │',
    '    └────╥─────┘    └────╥─────┘    └────╥─────┘',
    '         ║              ║              ║',
    '    ┌────╨─────┐    ┌────╨─────┐    ┌────╨─────┐',
    '    │ MEDICAL  │════│ ??????  │════│  COMMS   │',
    '    │   [M1]   │    │   [??]   │    │   [C2]   │',
    '    └──────────┘    └──────────┘    └──────────┘',
    '',
    '          FOB DELTA - STATUS: COMPROMISED',
  ],
  brothers: [
    '',
    '    ▄▄▄▄▄▄▄              ┌─────┐',
    '   ██ TITAN██            │SPECTER',
    '   ██ M-09 ██────────────│ J-17│',
    '   ██      ██            └─────┘',
    '    ▀▀▀▀▀▀▀',
    '       ║',
    '     ══╬══     COMBAT FORMATION ACTIVE',
    '       ║',
    '',
    '    CPL. MARCUS COLE       SGT. JORIN VANCE',
    '       [MECH]                [RECON]',
  ],
  hive: [
    '        ╔════════════════════════════════════╗',
    '        ║   ~~ SUBTERRANEAN COMPLEX ~~       ║',
    '        ╚════════════════════════════════════╝',
    '              \\\\    //     \\\\    //',
    '               \\\\  //       \\\\  //',
    '                \\\\//    ◊    \\\\//',
    '                 ||  [HIVE]  ||',
    '                //\\\\  NEXUS //\\\\',
    '               //  \\\\      //  \\\\',
    '              //    \\\\    //    \\\\',
    '',
    '          THREAT LEVEL: CRITICAL',
    '          QUEEN DETECTED IN SECTOR',
  ],
  extraction: [
    '               ╔═══════════════════╗',
    '               ║    LZ OMEGA       ║',
    '               ║   EVAC POINT      ║',
    '               ╚═══════════════════╝',
    '                      │ │',
    '               ╔══════╧═╧══════╗',
    '               ║   LANDING     ║',
    '               ║    PAD A      ║',
    '               ╚═══════════════╝',
    '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '            PERIMETER DEFENSE ACTIVE',
    '            ETA TO EXTRACTION: ???',
  ],
  vehicle: [
    '         /\\                    /\\',
    '        /  \\       ~~~~       /  \\',
    '       /    \\               /    \\',
    '      /      \\    ┌───┐   /      \\',
    '     /________\\   │LRV│  /________\\',
    '                  └─┬─┘',
    '              ══════╪══════',
    '',
    "              KEPLER'S PROMISE - CANYON RUN",
    '               Vehicle Chase Sequence',
  ],
  ice: [
    '       * *  *     *    *  * *     *  *',
    '    *     *   *  *  *    *   *  *    *',
    '   ═══════════════════════════════════',
    '   ░░░░░░░ FROZEN SURFACE ░░░░░░░░░░',
    '   ═══════════════════════════════════',
    '        ╔═══╗     ╔═══╗     ╔═══╗',
    '        ║ICE║     ║ICE║     ║ICE║',
    '        ╚═══╝     ╚═══╝     ╚═══╝',
    '',
    '          SOUTHERN POLAR REGION',
    '          Temperature: -62C',
  ],
  boss: [
    '        ╔════════════════════════════════════╗',
    '        ║   !! CHITIN QUEEN DETECTED !!      ║',
    '        ╚════════════════════════════════════╝',
    '              \\\\\\\\    ////     \\\\\\\\    ////',
    '               \\\\\\\\  ////       \\\\\\\\  ////',
    '                \\\\\\\\//// ◊◊◊◊◊ \\\\\\\\////',
    '                 ||  [QUEEN]  ||',
    '                ////\\\\\\\\     ////\\\\\\\\',
    '               ////  \\\\\\\\   ////  \\\\\\\\',
    '',
    '          THREAT LEVEL: EXTREME',
    '          ENGAGING BOSS ENCOUNTER',
  ],
  assault: [
    '        ╔════════════════════════════════════╗',
    '        ║   ~~ COMBINED ARMS ASSAULT ~~     ║',
    '        ╚════════════════════════════════════╝',
    '    ▄▄▄▄▄▄▄     ┌─────┐     ▄▄▄▄▄▄▄',
    '   ██ TITAN██   │SQUAD │   ██ TITAN██',
    '    ▀▀▀▀▀▀▀     └─────┘    ▀▀▀▀▀▀▀',
    '          \\\\       ||       //',
    '           \\\\      ||      //',
    '            \\\\=====||=====//',
    '',
    '          ALL UNITS ADVANCE',
    '          TARGET: HIVE CORE',
  ],
  combined_arms: [
    '        ╔════════════════════════════════════╗',
    '        ║   ~~ COMBINED ARMS ASSAULT ~~     ║',
    '        ╚════════════════════════════════════╝',
    '    ▄▄▄▄▄▄▄     ┌─────┐     ▄▄▄▄▄▄▄',
    '   ██ TITAN██   │SQUAD │   ██ TITAN██',
    '    ▀▀▀▀▀▀▀     └─────┘    ▀▀▀▀▀▀▀',
    '          \\\\       ||       //',
    '           \\\\      ||      //',
    '            \\\\=====||=====//',
    '',
    '          ALL UNITS ADVANCE',
    '          TARGET: HIVE CORE',
  ],
  escape: [
    '    ████████████████████████████████████',
    '    ██ !! TIMED ESCAPE SEQUENCE !!    ██',
    '    ████████████████████████████████████',
    '         \\\\   //      \\\\   //',
    '          \\\\ //        \\\\ //',
    '     ┌───┐ XX    ┌───┐  XX',
    '     │LRV│ //\\\\  │LRV│ //\\\\',
    '     └─┬─┘//  \\\\└─┬─┘//  \\\\',
    '       ════════════════════',
    '',
    '      OUTRUN THE COLLAPSE',
    '      TIME REMAINING: ???',
  ],
  finale: [
    '    ████████████████████████████████████',
    '    ██ !! PLANETARY COLLAPSE !!       ██',
    '    ████████████████████████████████████',
    '         \\\\   //      \\\\   //',
    '          \\\\ //        \\\\ //',
    '     ┌───┐ XX    ┌───┐  XX',
    '     │LRV│ //\\\\  │LRV│ //\\\\',
    '     └─┬─┘//  \\\\└─┬─┘//  \\\\',
    '       ════════════════════',
    '',
    '      OUTRUN THE COLLAPSE',
    '      TIME REMAINING: ???',
  ],
  mine: [
    '            ╔════════════════════╗',
    '            ║  MINING DEPTHS     ║',
    '            ╚════════╤═══════════╝',
    '                ┌────┴────┐',
    '                │ SHAFT-7 │',
    '                └────┬────┘',
    '            ═════════╧═════════',
    '            ////////////////////',
    '            ░░░░░░░░░░░░░░░░░░░',
    '',
    '      UNDERGROUND MINING FACILITY',
    '      DEPTH: CLASSIFIED',
  ],
};

// Stage icons for visual feedback
const STAGE_ICONS: Record<string, string> = {
  INITIALIZING: '[>  ]',
  LOADING: '[>> ]',
  PROCESSING: '[>>>]',
  FINALIZING: '[<=>]',
  COMPLETE: '[OK ]',
};

/**
 * Get the icon for a loading stage
 */
function getStageIcon(stage: string): string {
  const upper = stage.toUpperCase();
  for (const [key, icon] of Object.entries(STAGE_ICONS)) {
    if (upper.includes(key)) return icon;
  }
  return '[>> ]';
}

/**
 * Typewriter effect hook - reveals text character by character
 */
function useTypewriter(text: string, speed: number = TYPEWRITER_SPEED): string {
  const [displayed, setDisplayed] = useState('');
  const textRef = useRef(text);

  // Reset when text changes
  if (textRef.current !== text) {
    textRef.current = text;
    setDisplayed('');
  }

  useEffect(() => {
    if (displayed.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text[prev.length]);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [displayed, text, speed]);

  return displayed;
}

/**
 * Generate random hex data stream for visual effect
 */
function generateDataStream(length: number): string {
  const chars = '0123456789ABCDEF:.█░▒▓';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function LoadingScreen({
  isVisible,
  progress,
  onLoadComplete,
  levelId,
  minDisplayTime = DEFAULT_MIN_DISPLAY_TIME,
}: LoadingScreenProps) {
  // Track display state for fade transitions
  const [fadeState, setFadeState] = useState<'hidden' | 'fading-in' | 'visible' | 'fading-out'>(
    'hidden'
  );

  // Track current progress
  const [displayProgress, setDisplayProgress] = useState<LoadingProgress>({
    stage: 'INITIALIZING SYSTEMS...',
    progress: 0,
  });

  // Tips rotation state
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipFading, setTipFading] = useState(false);

  // Data stream animation
  const [dataStream, setDataStream] = useState(() => generateDataStream(48));

  // Refs for timing
  const displayStartTimeRef = useRef<number>(0);
  const tipStartTimeRef = useRef<number>(Date.now());
  const completedRef = useRef(false);
  const tipIntervalRef = useRef<number | null>(null);

  // Get level configuration
  const levelConfig: LevelConfig | undefined = useMemo(() => {
    return levelId ? CAMPAIGN_LEVELS[levelId] : undefined;
  }, [levelId]);

  const levelType: LevelType = levelConfig?.type ?? 'station';

  // Get background style for current level
  const backgroundStyle = useMemo(() => {
    return { background: LEVEL_BACKGROUNDS[levelType] };
  }, [levelType]);

  // Get ASCII art for current level
  const levelArt = useMemo(() => {
    return LEVEL_ART[levelType] ?? LEVEL_ART.station;
  }, [levelType]);

  // Get shuffled tips for current level context
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
    const elapsed = Date.now() - tipStartTimeRef.current;
    if (elapsed < MIN_TIP_DISPLAY_TIME) return;

    setTipFading(true);
    setTimeout(() => {
      setCurrentTipIndex((prev) => (prev + 1) % Math.max(1, shuffledTips.length));
      tipStartTimeRef.current = Date.now();
      setTipFading(false);
    }, 300);
  }, [shuffledTips.length]);

  // Handle visibility changes with fade transitions
  useEffect(() => {
    if (isVisible && fadeState === 'hidden') {
      displayStartTimeRef.current = Date.now();
      completedRef.current = false;
      setFadeState('fading-in');

      // Complete fade-in after animation
      const timer = setTimeout(() => setFadeState('visible'), FADE_DURATION);
      return () => clearTimeout(timer);
    }

    if (!isVisible && (fadeState === 'visible' || fadeState === 'fading-in')) {
      // Don't start fade-out yet - wait for completion trigger
    }
  }, [isVisible, fadeState]);

  // Update progress display
  useEffect(() => {
    if (progress) {
      setDisplayProgress(progress);
    }
  }, [progress]);

  // Animate data stream
  useEffect(() => {
    if (fadeState === 'hidden') return;

    const interval = setInterval(() => {
      setDataStream(generateDataStream(48));
    }, 150);

    return () => clearInterval(interval);
  }, [fadeState]);

  // Tip rotation interval
  useEffect(() => {
    if (fadeState === 'visible') {
      setCurrentTipIndex(Math.floor(Math.random() * Math.max(1, shuffledTips.length)));
      tipStartTimeRef.current = Date.now();

      tipIntervalRef.current = window.setInterval(rotateTip, TIP_ROTATION_INTERVAL);
    }

    return () => {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
    };
  }, [fadeState, rotateTip, shuffledTips.length]);

  // Handle completion - check min display time and trigger fade-out
  useEffect(() => {
    if (displayProgress.progress >= 100 && !completedRef.current && fadeState === 'visible') {
      const elapsed = Date.now() - displayStartTimeRef.current;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      const completeTimer = setTimeout(() => {
        completedRef.current = true;
        setFadeState('fading-out');

        // Call completion callback after fade
        const fadeTimer = setTimeout(() => {
          setFadeState('hidden');
          onLoadComplete();
        }, FADE_DURATION);

        return () => clearTimeout(fadeTimer);
      }, remainingTime);

      return () => clearTimeout(completeTimer);
    }
  }, [displayProgress.progress, fadeState, minDisplayTime, onLoadComplete]);

  // Don't render if hidden
  if (fadeState === 'hidden') return null;

  // Calculate progress bar segments
  const progressSegments = 25;
  const filledSegments = Math.floor((displayProgress.progress / 100) * progressSegments);
  const stageIcon = getStageIcon(displayProgress.stage);

  // Determine fade class
  const fadeClass =
    fadeState === 'fading-in' ? styles.fadeIn : fadeState === 'fading-out' ? styles.fadeOut : '';

  return (
    <div
      className={`${styles.overlay} ${fadeClass}`}
      style={backgroundStyle}
      role="progressbar"
      aria-label={`Loading ${levelConfig?.missionName || 'mission'}: ${Math.round(displayProgress.progress)}% complete`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(displayProgress.progress)}
      aria-busy={displayProgress.progress < 100}
    >
      {/* Atmospheric effects layer */}
      <div className={styles.atmosphereLayer} aria-hidden="true">
        <div className={styles.particles} />
        <div className={styles.vignette} />
      </div>

      {/* Scan lines for CRT aesthetic */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Moving scanner beam */}
      <div className={styles.scannerBeam} aria-hidden="true" />

      {/* Main content container */}
      <div className={styles.container}>
        {/* Corner decorations */}
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

        {/* Act/Chapter header */}
        <div className={styles.header}>
          <div className={styles.headerLine} />
          <span className={styles.headerText}>
            {levelConfig?.actName ?? 'TERRAN EXPANSION AUTHORITY'}
          </span>
          <div className={styles.headerLine} />
        </div>

        {/* Level info section */}
        {levelConfig && (
          <div className={styles.levelInfo}>
            <span className={styles.chapterLabel}>CHAPTER {levelConfig.chapter}</span>
            <h2 className={styles.missionName}>{levelConfig.missionName}</h2>
            {levelConfig.missionSubtitle && (
              <span className={styles.missionSubtitle}>{levelConfig.missionSubtitle}</span>
            )}
          </div>
        )}

        {/* ASCII level art */}
        <div className={styles.artContainer}>
          <pre className={styles.asciiArt} aria-hidden="true">
            {levelArt.join('\n')}
          </pre>
          <div className={styles.artGlow} aria-hidden="true" />
        </div>

        {/* Progress section */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressStage}>{stageIcon} LOADING</span>
            <span className={styles.progressPercent}>{Math.round(displayProgress.progress)}%</span>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuenow={displayProgress.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {Array.from({ length: progressSegments }).map((_, i) => (
                <div
                  key={`seg-${i}`}
                  className={`${styles.progressSegment} ${
                    i < filledSegments ? styles.segmentFilled : ''
                  } ${i === filledSegments - 1 ? styles.segmentActive : ''}`}
                />
              ))}
            </div>
          </div>

          <div className={styles.progressStatus}>
            <span className={styles.statusIndicator} aria-hidden="true" />
            <span className={styles.statusText}>
              {displayProgress.stage}
              {displayProgress.detail && (
                <span className={styles.statusDetail}> - {displayProgress.detail}</span>
              )}
            </span>
          </div>
        </div>

        {/* Tips section */}
        <div className={styles.tipsSection} role="status" aria-live="polite">
          <div className={styles.tipsDivider} aria-hidden="true">
            <div className={styles.tipsLine} />
            <span className={styles.tipsLabel}>COMBAT ADVISORY</span>
            <div className={styles.tipsLine} />
          </div>

          <div className={`${styles.tipContainer} ${tipFading ? styles.tipFading : ''}`}>
            <span className={styles.tipCategory} aria-hidden="true">[{currentTip.category}]</span>
            <p className={styles.tipText} aria-label={`Tip: ${currentTip.tip}`}>
              {typedTipText}
              <span className={styles.cursor} aria-hidden="true">
                _
              </span>
            </p>
          </div>
        </div>

        {/* System status indicators */}
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
              data-status={displayProgress.progress < 100 ? 'loading' : 'active'}
            />
            <span>WEAP</span>
          </div>
          <div className={styles.statusItem}>
            <span
              className={styles.statusDot}
              data-status={displayProgress.progress < 50 ? 'loading' : 'active'}
            />
            <span>LIFE</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerOrg}>TERRAN EXPANSION AUTHORITY</span>
          <span className={styles.footerConnection}>
            <span className={styles.connectionDot} aria-hidden="true" />
            SECURE CONNECTION
          </span>
        </div>
      </div>
    </div>
  );
}
