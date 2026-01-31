/**
 * LanguageSelector - Dropdown component for selecting display language
 *
 * Features:
 * - Dropdown with flag icons and native language names
 * - Persists language preference to localStorage
 * - Applies language change immediately without restart
 * - Military terminal styling consistent with game aesthetic
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { useTranslation, type SupportedLanguage, type LanguageInfo } from '../../i18n/useTranslation';
import styles from './LanguageSelector.module.css';

interface LanguageSelectorProps {
  /** Optional class name for custom styling */
  className?: string;
  /** Whether to show the full language name or just the flag */
  compact?: boolean;
  /** Callback when language changes */
  onLanguageChange?: (language: SupportedLanguage) => void;
}

/**
 * LanguageSelector component
 * Renders a dropdown for selecting the game's display language
 */
export function LanguageSelector({
  className,
  compact = false,
  onLanguageChange,
}: LanguageSelectorProps) {
  const { language, setLanguage, languages, languageInfo } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Play click sound
  const playClickSound = useCallback(() => {
    try {
      getAudioManager().play('ui_click', { volume: 0.3 });
    } catch {
      // Audio may not be initialized
    }
  }, []);

  // Handle language selection
  const handleSelectLanguage = useCallback(
    (lang: SupportedLanguage) => {
      playClickSound();
      setLanguage(lang);
      setIsOpen(false);
      onLanguageChange?.(lang);
    },
    [setLanguage, playClickSound, onLanguageChange]
  );

  // Toggle dropdown
  const handleToggle = useCallback(() => {
    playClickSound();
    setIsOpen((prev) => !prev);
  }, [playClickSound]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          event.preventDefault();
          const currentIndex = languages.findIndex((l) => l.code === language);
          const nextIndex =
            event.key === 'ArrowDown'
              ? (currentIndex + 1) % languages.length
              : (currentIndex - 1 + languages.length) % languages.length;
          const nextLang = languages[nextIndex];
          if (nextLang) {
            handleSelectLanguage(nextLang.code);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, language, languages, handleSelectLanguage]);

  return (
    <div
      ref={dropdownRef}
      className={`${styles.container} ${className ?? ''} ${isOpen ? styles.open : ''}`}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${compact ? styles.compact : ''}`}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language. Current: ${languageInfo.name}`}
      >
        <span className={styles.flag} aria-hidden="true">
          {languageInfo.flag}
        </span>
        {!compact && (
          <span className={styles.languageName}>{languageInfo.nativeName}</span>
        )}
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ''}`} aria-hidden="true">
          {'\u25BC'}
        </span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox" aria-label="Select language">
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>LANGUAGE</span>
          </div>
          <div className={styles.dropdownList}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`${styles.option} ${lang.code === language ? styles.selected : ''}`}
                onClick={() => handleSelectLanguage(lang.code)}
                role="option"
                aria-selected={lang.code === language}
              >
                <span className={styles.optionFlag} aria-hidden="true">
                  {lang.flag}
                </span>
                <span className={styles.optionName}>{lang.nativeName}</span>
                <span className={styles.optionNameEnglish}>({lang.name})</span>
                {lang.code === language && (
                  <span className={styles.checkmark} aria-hidden="true">
                    {'\u2713'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact language selector showing only flag icons
 * Useful for tight spaces like headers
 */
export function LanguageSelectorCompact(props: Omit<LanguageSelectorProps, 'compact'>) {
  return <LanguageSelector {...props} compact />;
}
