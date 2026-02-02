import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { GAME_SUBTITLE, GAME_TITLE, LORE } from '../../game/core/lore';
import styles from './TitleSequence.module.css';

interface TitleSequenceProps {
  onComplete: () => void;
  isTouchDevice?: boolean;
}

// Text content for the briefing
const BRIEFING_LINES = [
  'PRIORITY ALPHA TRANSMISSION',
  '',
  'FROM: TEA COMMAND',
  'TO: 7TH DROP MARINES - ALL PERSONNEL',
  '',
  'SITUATION REPORT:',
  '',
  'Recon Team VANGUARD deployed to Proxima Centauri b',
  'designation PCb-7 "Kepler\'s Promise" - 72 hours ago.',
  '',
  'Mission: Establish Forward Operating Base DELTA.',
  'Secure landing zone for terraforming operations.',
  '',
  'STATUS: ALL CONTACT LOST - 36 HOURS AGO',
  '',
  'Orbital scans show FOB intact.',
  'No movement. No distress beacon. No explanation.',
  '',
  'Initial surveys indicated no hostile life forms.',
  'The surveys were wrong.',
  '',
  'Something awakened beneath the surface.',
  '',
  'Authorization granted for combat reconnaissance.',
  '',
  'MISSION: Find out what happened.',
  'Locate survivors. Eliminate the threat.',
  '',
  '>>> SPECTERS AUTHORIZED FOR ORBITAL DROP <<<',
];

type SequencePhase =
  | 'initial'
  | 'year'
  | 'header'
  | 'briefing'
  | 'pause'
  | 'title'
  | 'subtitle'
  | 'complete';

// Timing configuration (milliseconds)
const TIMING = {
  initialFade: 500,
  yearFadeIn: 1000,
  yearHold: 1500,
  headerFadeIn: 800,
  headerHold: 1000,
  lineDelay: 80, // ms per character for typing effect
  lineHold: 150, // hold between lines
  pauseBeforeTitle: 1000,
  titleReveal: 1500,
  subtitleReveal: 1000,
  holdComplete: 500,
};

// Star field for background
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create stars
    const stars: Array<{ x: number; y: number; size: number; speed: number; brightness: number }> =
      [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.2 + 0.05,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const star of stars) {
        // Twinkle effect
        const twinkle = Math.sin(Date.now() * 0.002 + star.x) * 0.3 + 0.7;
        const alpha = star.brightness * twinkle;

        ctx.fillStyle = `rgba(200, 200, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Slow drift
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initial clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.starField} />;
}

// Typing text effect component
function TypingText({
  text,
  onComplete,
  speed = 50,
  className,
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
  className?: string;
}) {
  const [displayText, setDisplayText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      onComplete?.();
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        // Play typing sound occasionally
        if (index % 3 === 0) {
          getAudioManager().play('ui_click', { volume: 0.05 });
        }
        index++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className}>
      {displayText}
      <span className={styles.cursor} style={{ opacity: cursorVisible ? 1 : 0 }}>
        _
      </span>
    </span>
  );
}

export function TitleSequence({ onComplete, isTouchDevice = false }: TitleSequenceProps) {
  const [phase, setPhase] = useState<SequencePhase>('initial');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lineComplete, setLineComplete] = useState(false);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [isSkipping, setIsSkipping] = useState(false);
  const briefingRef = useRef<HTMLDivElement>(null);

  // Skip handler
  const handleSkip = useCallback(() => {
    if (isSkipping) return;
    setIsSkipping(true);
    getAudioManager().play('ui_click', { volume: 0.3 });
    setPhase('complete');
  }, [isSkipping]);

  // Keyboard/touch skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip on any key press
      if (phase !== 'complete') {
        e.preventDefault();
        handleSkip();
      }
    };

    const handleClick = () => {
      if (phase !== 'complete') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
    };
  }, [phase, handleSkip]);

  // Phase progression
  useEffect(() => {
    if (isSkipping) return;

    let timeout: ReturnType<typeof setTimeout>;

    switch (phase) {
      case 'initial':
        timeout = setTimeout(() => setPhase('year'), TIMING.initialFade);
        break;
      case 'year':
        timeout = setTimeout(() => setPhase('header'), TIMING.yearFadeIn + TIMING.yearHold);
        break;
      case 'header':
        // Play comms open sound
        getAudioManager().play('comms_open', { volume: 0.3 });
        timeout = setTimeout(() => setPhase('briefing'), TIMING.headerFadeIn + TIMING.headerHold);
        break;
      case 'briefing':
        // Handled by line progression
        break;
      case 'pause':
        timeout = setTimeout(() => setPhase('title'), TIMING.pauseBeforeTitle);
        break;
      case 'title':
        // Play title reveal sound
        getAudioManager().play('notification', { volume: 0.4 });
        timeout = setTimeout(() => setPhase('subtitle'), TIMING.titleReveal);
        break;
      case 'subtitle':
        timeout = setTimeout(() => setPhase('complete'), TIMING.subtitleReveal);
        break;
      case 'complete':
        timeout = setTimeout(() => onComplete(), TIMING.holdComplete);
        break;
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [phase, isSkipping, onComplete]);

  // Line progression during briefing phase
  useEffect(() => {
    if (phase !== 'briefing' || isSkipping) return;

    if (lineComplete && currentLineIndex < BRIEFING_LINES.length - 1) {
      const timeout = setTimeout(() => {
        setCurrentLineIndex((i) => i + 1);
        setLineComplete(false);
        setDisplayedLines((lines) => [...lines, BRIEFING_LINES[currentLineIndex]]);
      }, TIMING.lineHold);

      return () => clearTimeout(timeout);
    } else if (lineComplete && currentLineIndex >= BRIEFING_LINES.length - 1) {
      // All lines done, add the last one and move to pause
      setDisplayedLines((lines) => [...lines, BRIEFING_LINES[currentLineIndex]]);
      const timeout = setTimeout(() => setPhase('pause'), TIMING.lineHold * 3);
      return () => clearTimeout(timeout);
    }
  }, [phase, lineComplete, currentLineIndex, isSkipping]);

  // Auto-scroll briefing
  useEffect(() => {
    if (briefingRef.current) {
      briefingRef.current.scrollTop = briefingRef.current.scrollHeight;
    }
  }, []);

  const handleLineComplete = useCallback(() => {
    setLineComplete(true);
  }, []);

  // Calculate typing speed based on line content
  const getTypingSpeed = (line: string) => {
    if (line === '') return 10; // Empty lines are instant
    if (line.includes('>>>')) return 40; // Important lines slower
    if (line.startsWith('STATUS:')) return 60; // Status line dramatic
    return TIMING.lineDelay;
  };

  return (
    <div className={styles.overlay} role="presentation" aria-label="Opening title sequence">
      <StarField />

      {/* Scanline effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* CRT glow effect */}
      <div className={styles.crtGlow} aria-hidden="true" />

      {/* Skip hint */}
      <div className={styles.skipHint}>
        <span>{isTouchDevice ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP'}</span>
      </div>

      {/* Year display */}
      <div className={`${styles.yearDisplay} ${phase !== 'initial' ? styles.visible : ''}`}>
        <span className={styles.yearText}>{LORE.setting.year}</span>
      </div>

      {/* Header */}
      <div
        className={`${styles.header} ${phase === 'header' || phase === 'briefing' || phase === 'pause' ? styles.visible : ''}`}
      >
        <div className={styles.headerBorder} />
        <span className={styles.headerText}>TEA COMMAND BRIEFING</span>
        <div className={styles.headerBorder} />
      </div>

      {/* Briefing text */}
      <div
        className={`${styles.briefingContainer} ${phase === 'briefing' || phase === 'pause' ? styles.visible : ''}`}
        ref={briefingRef}
      >
        {/* Already displayed lines */}
        {displayedLines.map((line, idx) => (
          <div
            key={idx}
            className={`${styles.briefingLine} ${line.includes('STATUS:') ? styles.alertLine : ''} ${line.includes('>>>') ? styles.importantLine : ''} ${line === '' ? styles.emptyLine : ''}`}
          >
            {line || '\u00A0'}
          </div>
        ))}

        {/* Currently typing line */}
        {phase === 'briefing' && currentLineIndex < BRIEFING_LINES.length && (
          <div
            className={`${styles.briefingLine} ${BRIEFING_LINES[currentLineIndex].includes('STATUS:') ? styles.alertLine : ''} ${BRIEFING_LINES[currentLineIndex].includes('>>>') ? styles.importantLine : ''}`}
          >
            <TypingText
              text={BRIEFING_LINES[currentLineIndex]}
              onComplete={handleLineComplete}
              speed={getTypingSpeed(BRIEFING_LINES[currentLineIndex])}
            />
          </div>
        )}
      </div>

      {/* Title reveal */}
      <div
        className={`${styles.titleContainer} ${phase === 'title' || phase === 'subtitle' || phase === 'complete' ? styles.visible : ''}`}
      >
        <h1 className={styles.title}>
          <span className={styles.titleGlow}>{GAME_TITLE}</span>
        </h1>

        <div
          className={`${styles.subtitleContainer} ${phase === 'subtitle' || phase === 'complete' ? styles.visible : ''}`}
        >
          <h2 className={styles.subtitle}>{GAME_SUBTITLE}</h2>
        </div>
      </div>
    </div>
  );
}
