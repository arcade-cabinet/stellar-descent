/**
 * PlayerGovernor Utilities for E2E Testing
 *
 * Provides Playwright-friendly wrappers for controlling the PlayerGovernor
 * autonomous player system. Used for automated campaign playthroughs.
 */

import type { Page } from '@playwright/test';
import type { LevelId } from '../../../game/levels/types';

// Goal types matching PlayerGovernor
export type GovernorGoalType =
  | 'idle'
  | 'navigate'
  | 'follow_objective'
  | 'engage_enemies'
  | 'advance_dialogue'
  | 'interact'
  | 'complete_tutorial'
  | 'wait'
  | 'complete_level';

export interface GovernorGoal {
  type: GovernorGoalType;
  params?: Record<string, unknown>;
}

export interface GovernorState {
  enabled: boolean;
  currentGoal: GovernorGoalType;
  goalQueue: GovernorGoalType[];
  eventsLog: string[];
}

export interface GovernorConfig {
  moveSpeed: number;
  autoShoot: boolean;
  engagementRange: number;
  dialogueAdvanceDelay: number;
  autoAdvanceDialogue: boolean;
  logActions: boolean;
  captureScreenshots: boolean;
  screenshotInterval: number;
}

/**
 * PlayerGovernor controller for E2E tests
 */
export class GovernorController {
  constructor(private page: Page) {}

  /**
   * Enable the PlayerGovernor
   */
  async enable(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: { enable?: () => void } };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.enable?.();
    });
  }

  /**
   * Disable the PlayerGovernor
   */
  async disable(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: { disable?: () => void } };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.disable?.();
    });
  }

  /**
   * Get current governor state
   */
  async getState(): Promise<GovernorState> {
    return this.page.evaluate(() => {
      const w = window as unknown as { __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: GovernorState } };
      const gov = w.__STELLAR_DESCENT_DEBUG__?.playerGovernor;
      return {
        enabled: gov?.enabled ?? false,
        currentGoal: gov?.currentGoal ?? 'idle',
        goalQueue: gov?.goalQueue ?? [],
        eventsLog: gov?.eventsLog ?? [],
      };
    });
  }

  /**
   * Set a new goal for the governor
   */
  async setGoal(goal: GovernorGoal): Promise<void> {
    await this.page.evaluate(({ type, params }) => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          playerGovernor?: {
            setGoal?: (t: string, p?: Record<string, unknown>) => void;
          };
        };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.setGoal?.(type, params);
    }, goal);
  }

  /**
   * Queue a goal to execute after current goal completes
   */
  async queueGoal(goal: GovernorGoal): Promise<void> {
    await this.page.evaluate(({ type, params }) => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          playerGovernor?: {
            queueGoal?: (t: string, p?: Record<string, unknown>) => void;
          };
        };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.queueGoal?.(type, params);
    }, goal);
  }

  /**
   * Clear all queued goals
   */
  async clearGoals(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: { clearGoals?: () => void } };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.clearGoals?.();
    });
  }

  /**
   * Wait for current goal to complete
   */
  async waitForGoalComplete(timeout = 300000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const w = window as unknown as {
          __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: { currentGoal?: string } };
        };
        return w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.currentGoal === 'idle';
      },
      { timeout }
    );
  }

  /**
   * Wait for a specific goal type to become active
   */
  async waitForGoal(goalType: GovernorGoalType, timeout = 30000): Promise<void> {
    await this.page.waitForFunction(
      (expected) => {
        const w = window as unknown as {
          __STELLAR_DESCENT_DEBUG__?: { playerGovernor?: { currentGoal?: string } };
        };
        return w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.currentGoal === expected;
      },
      goalType,
      { timeout }
    );
  }

  /**
   * Configure the governor
   */
  async configure(config: Partial<GovernorConfig>): Promise<void> {
    await this.page.evaluate((cfg) => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          playerGovernor?: { configure?: (c: Partial<GovernorConfig>) => void };
        };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.configure?.(cfg);
    }, config);
  }

  /**
   * Run tutorial playthrough sequence
   */
  async runTutorialPlaythrough(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          playerGovernor?: { runTutorialPlaythrough?: () => void };
        };
      };
      w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.runTutorialPlaythrough?.();
    });
  }

  /**
   * Navigate to a specific position
   */
  async navigateTo(position: { x: number; y: number; z: number }, threshold = 2): Promise<void> {
    await this.setGoal({
      type: 'navigate',
      params: { target: position, threshold },
    });
  }

  /**
   * Engage enemies in range
   */
  async engageEnemies(aggressive = false): Promise<void> {
    await this.setGoal({
      type: 'engage_enemies',
      params: { aggressive },
    });
  }

  /**
   * Wait for a specified duration
   */
  async wait(duration: number): Promise<void> {
    await this.setGoal({
      type: 'wait',
      params: { duration },
    });
    await this.waitForGoalComplete(duration + 5000);
  }

  /**
   * Advance dialogue
   */
  async advanceDialogue(): Promise<void> {
    await this.setGoal({ type: 'advance_dialogue' });
  }

  /**
   * Follow current objective
   */
  async followObjective(): Promise<void> {
    await this.setGoal({ type: 'follow_objective' });
  }

  /**
   * Interact with nearest interactable
   */
  async interact(): Promise<void> {
    await this.setGoal({ type: 'interact' });
  }

  /**
   * Run a complete level playthrough
   *
   * This sets up the governor to:
   * 1. Advance through any dialogue
   * 2. Follow objectives
   * 3. Engage enemies as encountered
   * 4. Interact with required objects
   *
   * @param levelId The level to complete
   * @param timeout Maximum time to wait for completion (default 10 minutes)
   */
  async completeLevelPlaythrough(levelId: LevelId, timeout = 600000): Promise<void> {
    // Configure for autonomous play
    await this.configure({
      autoShoot: true,
      autoAdvanceDialogue: true,
      engagementRange: 50,
      logActions: true,
    });

    // Set the complete_level goal
    await this.setGoal({
      type: 'complete_level',
      params: { levelId },
    });

    // Wait for level to complete
    await this.page.waitForFunction(
      (level) => {
        const w = window as unknown as {
          __STELLAR_DESCENT_DEBUG__?: {
            gameState?: { getCurrentPhase?: () => string; getCurrentLevel?: () => string };
          };
        };
        const gs = w.__STELLAR_DESCENT_DEBUG__?.gameState;
        const phase = gs?.getCurrentPhase?.();
        const currentLevel = gs?.getCurrentLevel?.();
        // Level is complete when we reach levelComplete phase
        // or we've moved to the next level
        return (
          phase === 'levelComplete' ||
          (currentLevel !== level && phase !== 'loading')
        );
      },
      levelId,
      { timeout }
    );
  }

  /**
   * Get the event log from the governor
   */
  async getEventLog(): Promise<string[]> {
    const state = await this.getState();
    return state.eventsLog;
  }

  /**
   * Clear the event log
   */
  async clearEventLog(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          playerGovernor?: { eventsLog?: string[] };
        };
      };
      if (w.__STELLAR_DESCENT_DEBUG__?.playerGovernor) {
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.eventsLog = [];
      }
    });
  }
}

/**
 * Create a GovernorController for a page
 */
export function createGovernorController(page: Page): GovernorController {
  return new GovernorController(page);
}
