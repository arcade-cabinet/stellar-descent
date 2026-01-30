import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './LevelIntro.module.css';

interface LevelIntroProps {
  isOpen: boolean;
  levelId: LevelId;
  onComplete: () => void;
}

// Establishing shot narrative context for each level
const LEVEL_NARRATIVES: Record<LevelId, string[]> = {
  anchor_station: [
    'ANCHOR STATION PROMETHEUS',
    'Orbital altitude: 400 km',
    'Status: Combat operations standby',
    '',
    'The hangar bay awaits.',
    'Complete final preparations before drop.',
  ],
  landfall: [
    'DROP POD HELL-7 DEPLOYED',
    'Terminal velocity: 8,200 km/h',
    'Atmosphere entry in T-minus 30 seconds',
    '',
    "Kepler's Promise rushes up to meet you.",
    'The mission begins now.',
  ],
  canyon_run: [
    'SOUTHERN RIFT VALLEY',
    'Vehicle convoy en route to FOB Delta',
    'Terrain: Narrow canyon passages',
    '',
    'Enemy contacts ahead.',
    'Keep the convoy moving.',
  ],
  fob_delta: [
    'FORWARD OPERATING BASE DELTA',
    'Last contact: 36 hours ago',
    'Status: Unknown',
    '',
    'The prefab structures stand silent.',
    'Something is very wrong here.',
  ],
  brothers_in_arms: [
    'CANYON SECTOR 7-ALPHA',
    'Titan mech signature detected',
    'Distance: 200 meters',
    '',
    'Marcus is alive.',
    'But you are not alone out here.',
  ],
  southern_ice: [
    'POLAR REGION - SOUTHERN CONTINENT',
    'Temperature: -62C and falling',
    'Visibility: Near zero - blizzard conditions',
    '',
    'New Chitin variants adapted to the cold.',
    'Press forward through the ice.',
  ],
  the_breach: [
    'SUBTERRANEAN HIVE NETWORK',
    'Depth: 400 meters below surface',
    'Atmosphere: Toxic - suit seal required',
    '',
    'The walls pulse with alien life.',
    'The Queen awaits in the darkness.',
  ],
  hive_assault: [
    'HIVE CORE - SURFACE BREACH POINT',
    'Combined arms operation authorized',
    'All units converge on target',
    '',
    'Infantry and armor push together.',
    'Burn the hive from the inside.',
  ],
  extraction: [
    'LZ OMEGA - EXTRACTION POINT',
    'Distance to dropship: 3 kilometers',
    'Hive collapse imminent',
    '',
    'The Queen is dead. The Chitin are enraged.',
    'Run. Fight. Survive.',
  ],
  final_escape: [
    'PLANETARY COLLAPSE IN PROGRESS',
    'Seismic instability: CRITICAL',
    'Evacuation window: 4 minutes',
    '',
    'The ground is tearing itself apart.',
    'Drive. Do not stop.',
  ],
};

// Duration config
const TIMING = {
  fadeIn: 500,
  chapterReveal: 800,
  titleReveal: 1000,
  narrativeDelay: 1500,
  narrativeLineDelay: 400,
  holdBeforeTransition: 1500,
  fadeOut: 500,
  totalAutoplay: 7000, // Total time before auto-complete (7 seconds)
};

type IntroPhase = 'fadeIn' | 'chapter' | 'title' | 'narrative' | 'hold' | 'fadeOut' | 'complete';

export function LevelIntro({ isOpen, levelId, onComplete }: LevelIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>('fadeIn');
  const [narrativeLines, setNarrativeLines] = useState<string[]>([]);
  const [currentNarrativeIndex, setCurrentNarrativeIndex] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenInfo = getScreenInfo();

  const levelConfig = CAMPAIGN_LEVELS[levelId];
  const narrative = LEVEL_NARRATIVES[levelId] || [];

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
    };
  }, []);

  // Skip handler - complete immediately
  const handleSkip = useCallback(() => {
    if (isSkipping || phase === 'complete') return;
    setIsSkipping(true);
    getAudioManager().play('ui_click', { volume: 0.3 });
    setPhase('fadeOut');
  }, [isSkipping, phase]);

  // Keyboard/touch/mouse skip handlers
  useEffect(() => {
    if (!isOpen || phase === 'complete') return;

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
  }, [isOpen, phase, handleSkip]);

  // Phase progression
  useEffect(() => {
    if (!isOpen || isSkipping) return;

    // Clear any existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    switch (phase) {
      case 'fadeIn':
        // Play intro sound
        getAudioManager().play('comms_open', { volume: 0.4 });
        timeoutRef.current = setTimeout(() => setPhase('chapter'), TIMING.fadeIn);
        break;

      case 'chapter':
        timeoutRef.current = setTimeout(() => setPhase('title'), TIMING.chapterReveal);
        break;

      case 'title':
        // Play title reveal sound
        getAudioManager().play('notification', { volume: 0.3 });
        timeoutRef.current = setTimeout(() => setPhase('narrative'), TIMING.titleReveal);
        break;

      case 'narrative':
        // Start revealing narrative lines
        if (currentNarrativeIndex < narrative.length) {
          timeoutRef.current = setTimeout(() => {
            setNarrativeLines((prev) => [...prev, narrative[currentNarrativeIndex]]);
            setCurrentNarrativeIndex((prev) => prev + 1);
          }, TIMING.narrativeLineDelay);
        } else {
          timeoutRef.current = setTimeout(() => setPhase('hold'), TIMING.holdBeforeTransition);
        }
        break;

      case 'hold':
        timeoutRef.current = setTimeout(() => setPhase('fadeOut'), TIMING.holdBeforeTransition);
        break;

      case 'fadeOut':
        timeoutRef.current = setTimeout(() => setPhase('complete'), TIMING.fadeOut);
        break;

      case 'complete':
        onComplete();
        break;
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, phase, isSkipping, narrative, currentNarrativeIndex, onComplete]);

  // Auto-complete timer as safety net
  useEffect(() => {
    if (!isOpen) return;

    autoCompleteRef.current = setTimeout(() => {
      if (phase !== 'complete') {
        setPhase('fadeOut');
      }
    }, TIMING.totalAutoplay);

    return () => {
      if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
    };
  }, [isOpen, phase]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPhase('fadeIn');
      setNarrativeLines([]);
      setCurrentNarrativeIndex(0);
      setIsSkipping(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine visibility classes based on phase
  const showChapter = phase !== 'fadeIn';
  const showTitle = phase !== 'fadeIn' && phase !== 'chapter';
  const showNarrative =
    phase === 'narrative' || phase === 'hold' || phase === 'fadeOut' || phase === 'complete';
  const isFadingOut = phase === 'fadeOut' || phase === 'complete';

  return (
    <div
      className={`${styles.overlay} ${isFadingOut ? styles.fadeOut : ''}`}
      role="presentation"
      aria-label={`Level intro: ${levelConfig?.missionName || 'Mission'}`}
    >
      {/* Animated scan lines */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Vignette effect */}
      <div className={styles.vignette} aria-hidden="true" />

      {/* Horizontal scan line */}
      <div className={styles.scannerLine} aria-hidden="true" />

      {/* Content container */}
      <div className={styles.content}>
        {/* Act name */}
        <div className={`${styles.actName} ${showChapter ? styles.visible : ''}`}>
          {levelConfig?.actName || 'MISSION'}
        </div>

        {/* Chapter badge */}
        <div className={`${styles.chapterBadge} ${showChapter ? styles.visible : ''}`}>
          <span className={styles.chapterLabel}>CHAPTER</span>
          <span className={styles.chapterNumber}>{levelConfig?.chapter || 1}</span>
        </div>

        {/* Mission title */}
        <h1 className={`${styles.missionTitle} ${showTitle ? styles.visible : ''}`}>
          {levelConfig?.missionName || 'MISSION'}
        </h1>

        {/* Mission subtitle */}
        {levelConfig?.missionSubtitle && (
          <div className={`${styles.missionSubtitle} ${showTitle ? styles.visible : ''}`}>
            {levelConfig.missionSubtitle}
          </div>
        )}

        {/* Narrative lines */}
        <div className={`${styles.narrativeContainer} ${showNarrative ? styles.visible : ''}`}>
          {narrativeLines.map((line, index) => (
            <p
              key={`narrative-${levelId}-${index}-${line.slice(0, 20)}`}
              className={`${styles.narrativeLine} ${line === '' ? styles.emptyLine : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      </div>

      {/* Skip hint */}
      <div className={styles.skipHint}>
        <span>{screenInfo.isTouchDevice ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP'}</span>
      </div>

      {/* Decorative corner brackets */}
      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerTR} aria-hidden="true" />
      <div className={styles.cornerBL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />

      {/* Status indicators */}
      <div className={styles.statusBar} aria-hidden="true">
        <div className={styles.statusItem}>
          <span className={styles.statusDot} data-status="active" />
          <span>MISSION BRIEF</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusDot} data-status="standby" />
          <span>AWAITING INSERTION</span>
        </div>
      </div>
    </div>
  );
}
