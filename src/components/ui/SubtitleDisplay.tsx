import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  type SpeakerConfig,
  type SpeakerType,
  type SubtitleEntry,
  type SubtitleSettings,
  useSubtitles,
} from '../../game/context/SubtitleContext';
import styles from './SubtitleDisplay.module.css';

/**
 * SubtitleDisplay - Accessible subtitle overlay for game dialogue
 *
 * Features:
 * - Configurable font size for accessibility
 * - Speaker name/color differentiation
 * - Auto-scrolling for multiple subtitles
 * - Screen reader compatible (aria-live)
 * - Supports top or bottom positioning
 * - High contrast mode for visibility
 * - Text outline for readability
 * - Fade in/out animations
 * - Sound effect descriptions
 */
export function SubtitleDisplay() {
  const { settings, subtitles, getSpeakerConfig, fontSizePx, formatSubtitleText } = useSubtitles();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest subtitle
  useEffect(() => {
    if (containerRef.current && subtitles.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [subtitles]);

  // Build CSS class list based on settings
  const containerClasses = useMemo(() => {
    const classes = [styles.container];
    classes.push(settings.position === 'top' ? styles.positionTop : styles.positionBottom);
    if (settings.highContrastMode) {
      classes.push(styles.highContrast);
    }
    if (settings.textOutline) {
      classes.push(styles.textOutline);
    }
    return classes.join(' ');
  }, [settings.position, settings.highContrastMode, settings.textOutline]);

  // Don't render if disabled or no subtitles
  if (!settings.enabled || subtitles.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={
        {
          '--subtitle-font-size': `${fontSizePx}px`,
          '--subtitle-bg-opacity': settings.backgroundOpacity,
        } as React.CSSProperties
      }
      role="log"
      aria-live="polite"
      aria-label="Subtitles"
    >
      {subtitles.map((subtitle) => (
        <SubtitleLine
          key={subtitle.id}
          subtitle={subtitle}
          config={getSpeakerConfig(subtitle.speaker)}
          settings={settings}
          formatText={formatSubtitleText}
        />
      ))}
    </div>
  );
}

interface SubtitleLineProps {
  subtitle: SubtitleEntry;
  config: SpeakerConfig;
  settings: SubtitleSettings;
  formatText: (text: string) => string[];
}

function SubtitleLine({ subtitle, config, settings, formatText }: SubtitleLineProps) {
  const hasName = config.name && settings.showSpeakerName;
  const hasPrefix = config.prefix && settings.showSpeakerPrefix;
  const isSoundEffect = !!subtitle.soundEffect;

  // Format text into lines
  const textLines = useMemo(() => formatText(subtitle.text), [formatText, subtitle.text]);

  // Build line classes
  const lineClasses = useMemo(() => {
    const classes = [styles.subtitleLine];
    if (subtitle.isFadingOut) {
      classes.push(styles.fadeOut);
    }
    if (isSoundEffect) {
      classes.push(styles.soundEffect);
    }
    return classes.join(' ');
  }, [subtitle.isFadingOut, isSoundEffect]);

  return (
    <div className={lineClasses} data-testid="subtitle-line">
      <div className={styles.subtitleContent}>
        {(hasPrefix || hasName) && !isSoundEffect && (
          <span className={styles.speakerInfo} style={{ color: config.color }}>
            {hasPrefix && <span className={styles.speakerPrefix}>{config.prefix}</span>}
            {hasName && <span className={styles.speakerName}>{config.name}:</span>}
          </span>
        )}
        <span className={`${styles.subtitleText} ${isSoundEffect ? styles.soundEffectText : ''}`}>
          {textLines.map((line, index) => (
            <span key={`${subtitle.id}-line-${index}`} className={styles.textLine}>
              {line}
              {index < textLines.length - 1 && <br />}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * Minimal subtitle display for integration with CommsDisplay
 * Shows current dialogue text inline without the full subtitle container
 */
interface InlineSubtitleProps {
  speaker: SpeakerType;
  text: string;
  className?: string;
}

export function InlineSubtitle({ speaker, text, className }: InlineSubtitleProps) {
  const { settings, getSpeakerConfig, fontSizePx } = useSubtitles();

  // Build CSS class list based on settings
  const containerClasses = useMemo(() => {
    const classes = [styles.inlineSubtitle];
    if (className) {
      classes.push(className);
    }
    if (settings.highContrastMode) {
      classes.push(styles.highContrast);
    }
    if (settings.textOutline) {
      classes.push(styles.textOutline);
    }
    return classes.join(' ');
  }, [className, settings.highContrastMode, settings.textOutline]);

  if (!settings.enabled) {
    return null;
  }

  const config = getSpeakerConfig(speaker);
  const hasName = config.name && settings.showSpeakerName;
  const hasPrefix = config.prefix && settings.showSpeakerPrefix;

  return (
    <div
      className={containerClasses}
      style={{ '--subtitle-font-size': `${fontSizePx}px` } as React.CSSProperties}
      aria-live="polite"
    >
      {(hasPrefix || hasName) && (
        <span className={styles.inlineSpeakerInfo} style={{ color: config.color }}>
          {hasPrefix && <span className={styles.speakerPrefix}>{config.prefix} </span>}
          {hasName && <span className={styles.speakerName}>{config.name}: </span>}
        </span>
      )}
      <span className={styles.inlineText}>{text}</span>
    </div>
  );
}
