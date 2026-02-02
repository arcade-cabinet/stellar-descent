import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './IntroBriefing.module.css';
import { MilitaryButton } from './MilitaryButton';

interface IntroBriefingProps {
  onComplete: () => void;
}

const BRIEFING_LINES = [
  'PRIORITY ALPHA // TEA COMMAND',
  '',
  'Recon Team VANGUARD deployed to PCb-7. 72 hours ago.',
  'FOB DELTA established. Then silence.',
  'All contact lost. No distress signal.',
  '',
  'Something woke beneath the surface.',
  '',
  'Find your brother. Find the truth.',
  '',
  '>>> SPECTER: CLEARED FOR ORBITAL DROP <<<',
];

const CHAR_DELAY_MS = 30;
const LINE_PAUSE_MS = 200;

/**
 * IntroBriefing - One-time military terminal typing briefing shown after New Game.
 * Condensed narrative setup with fast typing effect.
 */
export function IntroBriefing({ onComplete }: IntroBriefingProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineChars, setCurrentLineChars] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const lineIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeNext = useCallback(() => {
    const lineIdx = lineIndexRef.current;
    if (lineIdx >= BRIEFING_LINES.length) {
      setIsComplete(true);
      setTimeout(() => setShowButton(true), 300);
      return;
    }

    const line = BRIEFING_LINES[lineIdx];
    const charIdx = charIndexRef.current;

    if (charIdx <= line.length) {
      setCurrentLineChars(line.substring(0, charIdx));
      charIndexRef.current = charIdx + 1;
      timerRef.current = setTimeout(typeNext, line.length === 0 ? LINE_PAUSE_MS : CHAR_DELAY_MS);
    } else {
      // Line complete
      setDisplayedLines((prev) => [...prev, line]);
      setCurrentLineChars('');
      lineIndexRef.current = lineIdx + 1;
      charIndexRef.current = 0;
      timerRef.current = setTimeout(typeNext, LINE_PAUSE_MS);
    }
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(typeNext, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [typeNext]);

  // Allow skipping the typing animation
  const handleSkip = useCallback(() => {
    if (isComplete) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayedLines(BRIEFING_LINES);
    setCurrentLineChars('');
    setIsComplete(true);
    setTimeout(() => setShowButton(true), 300);
  }, [isComplete]);

  return (
    <div
      className={styles.overlay}
      onClick={!isComplete ? handleSkip : undefined}
      onKeyDown={() => {}}
      role="presentation"
    >
      <div className={styles.scanLines} />
      <div className={styles.container}>
        <div className={styles.header}>BARRACKS // ANCHOR STATION PROMETHEUS</div>
        <div className={styles.textBlock}>
          {displayedLines.map((line, i) => (
            <div key={i} className={styles.line}>
              {line || '\u00A0'}
            </div>
          ))}
          {!isComplete && (
            <div className={styles.line}>
              {currentLineChars}
              <span className={styles.cursor} />
            </div>
          )}
        </div>
        {showButton && (
          <div className={styles.buttonContainer}>
            <MilitaryButton variant="primary" onClick={onComplete}>
              ACKNOWLEDGED
            </MilitaryButton>
          </div>
        )}
      </div>
    </div>
  );
}
