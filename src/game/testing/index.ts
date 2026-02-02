/**
 * Testing utilities for Stellar Descent
 *
 * Provides headless game simulation for automated testing of:
 * - Level playthroughs
 * - Combat mechanics
 * - Boss fights
 * - Collectibles
 * - Checkpoints and saves
 *
 * Also provides the DebugInterface for Playwright E2E testing.
 */

export * from './DebugInterface';
export * from './HeadlessGameRunner';
export * from './SimulatedPlayer';
