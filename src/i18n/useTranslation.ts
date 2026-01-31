/**
 * React hook for accessing the i18n translation system
 *
 * Provides:
 * - t() function for translating strings
 * - Current language state
 * - Language switching functionality
 * - Automatic re-render on language change
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getLanguage,
  setLanguage,
  onLanguageChange,
  t as translate,
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getCurrentLanguageInfo,
  type LanguageInfo,
} from './i18n';

export interface UseTranslationResult {
  /** Translation function - pass key and optional params */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Current language code */
  language: SupportedLanguage;
  /** Change the current language */
  setLanguage: (lang: SupportedLanguage) => void;
  /** List of all supported languages */
  languages: readonly LanguageInfo[];
  /** Current language info (name, native name, flag) */
  languageInfo: LanguageInfo;
}

/**
 * Hook for using translations in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, language, setLanguage } = useTranslation();
 *
 *   return (
 *     <div>
 *       <h1>{t('menu.newGame')}</h1>
 *       <p>{t('hud.kills', { count: 5 })}</p>
 *       <button onClick={() => setLanguage('es')}>Spanish</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranslation(): UseTranslationResult {
  const [language, setLanguageState] = useState<SupportedLanguage>(getLanguage);
  const [languageInfo, setLanguageInfo] = useState<LanguageInfo>(getCurrentLanguageInfo);

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      setLanguageState(getLanguage());
      setLanguageInfo(getCurrentLanguageInfo());
    });

    return unsubscribe;
  }, []);

  // Memoized translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(key, params);
    },
    // Re-create when language changes to ensure fresh translations
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  // Memoized language setter
  const handleSetLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang);
  }, []);

  return {
    t,
    language,
    setLanguage: handleSetLanguage,
    languages: SUPPORTED_LANGUAGES,
    languageInfo,
  };
}

/**
 * Simple hook for just getting the translation function
 * Lighter weight for components that don't need language switching
 */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const [, setVersion] = useState(0);

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      setVersion((v) => v + 1);
    });

    return unsubscribe;
  }, []);

  return translate;
}

// Re-export types and utilities for convenience
export { type SupportedLanguage, SUPPORTED_LANGUAGES, type LanguageInfo } from './i18n';
