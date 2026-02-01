/**
 * i18n module exports
 *
 * Provides internationalization functionality for Stellar Descent
 */

// Core i18n functions
export {
  getAllTranslations,
  getCurrentLanguageInfo,
  getLanguage,
  getLanguageInfo,
  initI18n,
  isValidLanguage,
  type LanguageInfo,
  onLanguageChange,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  setLanguage,
  t,
} from './i18n';

// React hooks
export {
  type UseTranslationResult,
  useT,
  useTranslation,
} from './useTranslation';
