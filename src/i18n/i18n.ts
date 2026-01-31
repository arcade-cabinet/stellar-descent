/**
 * Lightweight i18n (internationalization) system for Stellar Descent
 *
 * Features:
 * - Type-safe translation keys
 * - Pluralization support
 * - Parameter interpolation
 * - Language persistence
 * - Lazy loading of locale files
 */

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';

// Supported languages
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'ja';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', name: 'French', nativeName: 'Francais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65E5\u672C\u8A9E', flag: '\u{1F1EF}\u{1F1F5}' },
];

// Translation data type - nested object structure
type TranslationValue = string | { [key: string]: TranslationValue };
type Translations = { [key: string]: TranslationValue };

// All loaded translations
const translations: Record<SupportedLanguage, Translations> = {
  en: en as Translations,
  es: es as Translations,
  fr: fr as Translations,
  de: de as Translations,
  ja: ja as Translations,
};

// Current language state
let currentLanguage: SupportedLanguage = 'en';
const listeners: Set<() => void> = new Set();

// Storage key for persisting language preference
const LANGUAGE_STORAGE_KEY = 'stellar_descent_language';

/**
 * Initialize i18n system - load persisted language preference
 */
export function initI18n(): void {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isValidLanguage(stored)) {
      currentLanguage = stored;
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (isValidLanguage(browserLang)) {
        currentLanguage = browserLang;
      }
    }
  } catch {
    // localStorage may not be available
  }
}

/**
 * Check if a language code is supported
 */
export function isValidLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

/**
 * Get the current language
 */
export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * Set the current language and persist preference
 */
export function setLanguage(language: SupportedLanguage): void {
  if (currentLanguage === language) return;

  currentLanguage = language;

  // Persist preference
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage may not be available
  }

  // Notify all listeners
  listeners.forEach((listener) => listener());
}

/**
 * Subscribe to language changes
 * Returns unsubscribe function
 */
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Translations, path: string): string | undefined {
  const keys = path.split('.');
  let current: TranslationValue = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as { [key: string]: TranslationValue })[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Pluralization rules for each language
 */
function getPluralForm(count: number, language: SupportedLanguage): 'zero' | 'one' | 'few' | 'many' | 'other' {
  // Handle zero case first (some languages have special zero form)
  if (count === 0) {
    return 'zero';
  }

  switch (language) {
    case 'en':
    case 'de':
    case 'es':
    case 'fr':
      // Simple singular/plural
      return count === 1 ? 'one' : 'other';

    case 'ja':
      // Japanese doesn't have grammatical plural
      return 'other';

    default:
      return count === 1 ? 'one' : 'other';
  }
}

/**
 * Interpolate parameters into a string
 * Supports {{param}} syntax
 */
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

/**
 * Main translation function
 *
 * @param key - Dot-notation key (e.g., 'menu.newGame')
 * @param params - Optional parameters for interpolation
 * @returns Translated string or key if not found
 *
 * For pluralization, the key should point to an object with 'one', 'other', etc.
 * and params should include 'count'
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const langData = translations[currentLanguage];
  let result = getNestedValue(langData, key);

  // Handle pluralization
  if (result === undefined && params?.count !== undefined) {
    const pluralForm = getPluralForm(Number(params.count), currentLanguage);
    result = getNestedValue(langData, `${key}.${pluralForm}`);

    // Fall back to 'other' if specific form not found
    if (result === undefined) {
      result = getNestedValue(langData, `${key}.other`);
    }
  }

  // Fall back to English if not found in current language
  if (result === undefined && currentLanguage !== 'en') {
    result = getNestedValue(translations.en, key);

    // Try pluralization in English fallback
    if (result === undefined && params?.count !== undefined) {
      const pluralForm = getPluralForm(Number(params.count), 'en');
      result = getNestedValue(translations.en, `${key}.${pluralForm}`);
      if (result === undefined) {
        result = getNestedValue(translations.en, `${key}.other`);
      }
    }
  }

  // Return key if translation not found
  if (result === undefined) {
    console.warn(`[i18n] Missing translation for key: ${key}`);
    return key;
  }

  return interpolate(result, params);
}

/**
 * Get all translations for the current language
 * Useful for debugging
 */
export function getAllTranslations(): Translations {
  return translations[currentLanguage];
}

/**
 * Get language info for a specific language code
 */
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get current language info
 */
export function getCurrentLanguageInfo(): LanguageInfo {
  return getLanguageInfo(currentLanguage) ?? SUPPORTED_LANGUAGES[0];
}

// Initialize on module load
initI18n();
