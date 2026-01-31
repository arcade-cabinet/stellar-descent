/**
 * Logger - Centralized logging system for Stellar Descent
 *
 * Uses loglevel for cross-platform logging (web + mobile).
 * Supports log levels: trace, debug, info, warn, error
 *
 * Features:
 * - Named loggers for different subsystems
 * - Log level control via environment/localStorage
 * - Production-ready (no console.log spam)
 * - Tracing support via prefixes
 *
 * Usage:
 *   import { getLogger } from './Logger';
 *   const log = getLogger('LevelManager');
 *   log.info('Level loaded');
 *   log.debug('Detailed info here');
 *   log.error('Something went wrong', error);
 */

import log, { type Logger as LogLevel, type LogLevelNames } from 'loglevel';

// Set default log level based on build mode
const DEFAULT_LEVEL: LogLevelNames =
  import.meta.env.MODE === 'production' ? 'warn' : 'debug';

// Check localStorage for override (allows runtime adjustment)
const storedLevel = typeof localStorage !== 'undefined' ? localStorage.getItem('stellar_log_level') : null;
if (storedLevel) {
  log.setLevel(storedLevel as LogLevelNames, false);
} else {
  log.setLevel(DEFAULT_LEVEL, false);
}

/** Logger instance with named prefix */
export interface Logger {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Cache of named loggers */
const loggerCache = new Map<string, Logger>();

/**
 * Get a named logger instance
 *
 * @param name - Subsystem name (e.g., 'LevelManager', 'AudioManager', 'CombatSystem')
 * @returns Logger instance with prefixed output
 */
export function getLogger(name: string): Logger {
  if (loggerCache.has(name)) {
    return loggerCache.get(name)!;
  }

  const childLogger = log.getLogger(name);
  childLogger.setLevel(log.getLevel(), false);

  const prefix = `[${name}]`;

  const logger: Logger = {
    trace: (...args) => childLogger.trace(prefix, ...args),
    debug: (...args) => childLogger.debug(prefix, ...args),
    info: (...args) => childLogger.info(prefix, ...args),
    warn: (...args) => childLogger.warn(prefix, ...args),
    error: (...args) => childLogger.error(prefix, ...args),
  };

  loggerCache.set(name, logger);
  return logger;
}

/**
 * Set the global log level
 *
 * @param level - Log level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 * @param persist - Save to localStorage for persistence across sessions
 */
export function setLogLevel(level: LogLevelNames, persist = true): void {
  log.setLevel(level, false);

  // Update all cached loggers
  for (const [name] of loggerCache) {
    log.getLogger(name).setLevel(level, false);
  }

  if (persist && typeof localStorage !== 'undefined') {
    localStorage.setItem('stellar_log_level', level);
  }
}

/**
 * Get current log level
 */
export function getLogLevel(): string {
  const level = log.getLevel();
  const levelNames = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
  return levelNames[level] || 'info';
}

/**
 * Enable all logging (for debugging)
 */
export function enableAllLogs(): void {
  setLogLevel('trace', false);
}

/**
 * Disable all logging (for production/performance)
 */
export function disableLogs(): void {
  setLogLevel('error', false);
}

// Export the root logger for simple usage
export const rootLogger = getLogger('App');

// Re-export loglevel types
export type { LogLevelNames };
