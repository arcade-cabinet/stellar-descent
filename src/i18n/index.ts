/**
 * i18n module exports
 *
 * Provides internationalization functionality for Stellar Descent
 */

// Core i18n functions
export {
  t,
  getLanguage,
  setLanguage,
  onLanguageChange,
  initI18n,
  isValidLanguage,
  getAllTranslations,
  getLanguageInfo,
  getCurrentLanguageInfo,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type LanguageInfo,
} from './i18n';

// React hooks
export {
  useTranslation,
  useT,
  type UseTranslationResult,
} from './useTranslation';
