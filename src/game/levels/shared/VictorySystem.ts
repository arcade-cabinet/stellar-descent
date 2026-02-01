/**
 * VictorySystem - Composable victory condition tracking for levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Tracks objectives and determines when victory conditions are met.
 *
 * Usage:
 *   const victory = new VictorySystem();
 *   victory.registerObjective('destroy_generator');
 *   victory.registerObjective('rescue_marines');
 *   victory.completeObjective('destroy_generator');
 *   if (victory.areConditionsMet()) { ... }
 */

import { getLogger } from '../../core/Logger';
import { getEventBus } from '../../core/EventBus';

const log = getLogger('VictorySystem');

export interface VictoryResult {
  success: boolean;
  allObjectivesComplete: boolean;
  objectivesCompleted: string[];
  objectivesRemaining: string[];
  bonusObjectivesCompleted: string[];
}

export class VictorySystem {
  private requiredObjectives: Set<string> = new Set();
  private completedObjectives: Set<string> = new Set();
  private bonusObjectives: Set<string> = new Set();
  private completedBonusObjectives: Set<string> = new Set();
  private victoryCallback: (() => void) | null = null;
  private autoComplete = false;

  constructor() {
    // Listen for objective events from EventBus
    getEventBus().on('OBJECTIVE_COMPLETED', (event) => {
      this.completeObjective(event.objectiveId);
    });
  }

  /**
   * Register a required objective
   */
  registerObjective(objectiveId: string): void {
    this.requiredObjectives.add(objectiveId);
    log.debug(`Objective registered: ${objectiveId}`);
  }

  /**
   * Register multiple required objectives
   */
  registerObjectives(objectiveIds: string[]): void {
    for (const id of objectiveIds) {
      this.registerObjective(id);
    }
  }

  /**
   * Register a bonus (optional) objective
   */
  registerBonusObjective(objectiveId: string): void {
    this.bonusObjectives.add(objectiveId);
    log.debug(`Bonus objective registered: ${objectiveId}`);
  }

  /**
   * Mark an objective as complete
   */
  completeObjective(objectiveId: string): boolean {
    if (this.requiredObjectives.has(objectiveId)) {
      this.completedObjectives.add(objectiveId);
      log.info(`Objective complete: ${objectiveId} (${this.completedObjectives.size}/${this.requiredObjectives.size})`);

      getEventBus().emit({
        type: 'OBJECTIVE_COMPLETED',
        objectiveId,
      });

      // Check for auto-complete
      if (this.autoComplete && this.areConditionsMet()) {
        this.triggerVictory();
      }

      return true;
    }

    if (this.bonusObjectives.has(objectiveId)) {
      this.completedBonusObjectives.add(objectiveId);
      log.info(`Bonus objective complete: ${objectiveId}`);
      return true;
    }

    log.warn(`Unknown objective completed: ${objectiveId}`);
    return false;
  }

  /**
   * Check if all required objectives are complete
   */
  areConditionsMet(): boolean {
    if (this.requiredObjectives.size === 0) {
      return false; // No objectives registered
    }

    for (const objective of this.requiredObjectives) {
      if (!this.completedObjectives.has(objective)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get remaining objectives
   */
  getRemainingObjectives(): string[] {
    const remaining: string[] = [];
    for (const objective of this.requiredObjectives) {
      if (!this.completedObjectives.has(objective)) {
        remaining.push(objective);
      }
    }
    return remaining;
  }

  /**
   * Get victory result
   */
  getResult(): VictoryResult {
    return {
      success: this.areConditionsMet(),
      allObjectivesComplete: this.areConditionsMet(),
      objectivesCompleted: Array.from(this.completedObjectives),
      objectivesRemaining: this.getRemainingObjectives(),
      bonusObjectivesCompleted: Array.from(this.completedBonusObjectives),
    };
  }

  /**
   * Set callback for when victory is achieved (with auto-complete)
   */
  onVictory(callback: () => void, autoComplete = true): void {
    this.victoryCallback = callback;
    this.autoComplete = autoComplete;
  }

  /**
   * Manually trigger victory
   */
  triggerVictory(): void {
    if (this.victoryCallback) {
      log.info('Victory triggered!');
      this.victoryCallback();
    }
  }

  /**
   * Check if a specific objective is complete
   */
  isObjectiveComplete(objectiveId: string): boolean {
    return this.completedObjectives.has(objectiveId) || this.completedBonusObjectives.has(objectiveId);
  }

  /**
   * Get progress as a fraction (0-1)
   */
  getProgress(): number {
    if (this.requiredObjectives.size === 0) return 0;
    return this.completedObjectives.size / this.requiredObjectives.size;
  }

  /**
   * Reset for level restart
   */
  reset(): void {
    this.completedObjectives.clear();
    this.completedBonusObjectives.clear();
  }

  dispose(): void {
    this.victoryCallback = null;
    this.requiredObjectives.clear();
    this.completedObjectives.clear();
    this.bonusObjectives.clear();
    this.completedBonusObjectives.clear();
  }
}
