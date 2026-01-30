import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps';

export interface TutorialCallbacks {
  onStepChange?: (step: TutorialStep) => void;
  onCommsMessage?: (message: NonNullable<TutorialStep['commsMessage']>) => void;
  onObjectiveUpdate?: (title: string, instructions: string) => void;
  onTriggerSequence?: (sequence: NonNullable<TutorialStep['triggerSequence']>) => void;
  onComplete?: () => void;
}

// Manages the tutorial flow - story unfolds through comms as objectives complete
export class TutorialManager {
  private currentStepIndex = 0;
  private steps: TutorialStep[];
  private isActive = false;
  private callbacks: TutorialCallbacks = {};

  // Timer for auto-advance steps
  private waitTimer: number | null = null;
  private commsTimer: number | null = null;

  // Track if player can interact
  private canInteract = false;

  constructor(_scene: Scene) {
    this.steps = TUTORIAL_STEPS;
  }

  start(callbacks: TutorialCallbacks): void {
    this.callbacks = callbacks;
    this.isActive = true;
    this.currentStepIndex = 0;

    // Small delay before first step to let player orient
    setTimeout(() => {
      if (this.isActive) {
        this.activateStep(this.steps[0]);
      }
    }, 1500);
  }

  private activateStep(step: TutorialStep): void {
    // Clear any pending timers
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    if (this.commsTimer) {
      clearTimeout(this.commsTimer);
      this.commsTimer = null;
    }

    this.canInteract = false;

    this.callbacks.onStepChange?.(step);

    // Update objective display
    if (step.instructions) {
      this.callbacks.onObjectiveUpdate?.(step.title, step.instructions);
    } else {
      this.callbacks.onObjectiveUpdate?.(step.title, '');
    }

    // Show comms message with optional delay
    if (step.commsMessage) {
      const delay = step.commsMessage.delay ?? 0;
      this.commsTimer = window.setTimeout(() => {
        this.callbacks.onCommsMessage?.(step.commsMessage!);

        // If auto-advance after comms and wait objective, start timer
        if (step.autoAdvanceAfterComms && step.objective?.type === 'wait') {
          const waitDuration = step.objective.duration ?? 2000;
          this.waitTimer = window.setTimeout(() => {
            this.handleStepComplete(step);
          }, waitDuration);
        }
      }, delay);
    } else if (step.objective?.type === 'wait') {
      // No comms, just wait
      const waitDuration = step.objective.duration ?? 2000;
      this.waitTimer = window.setTimeout(() => {
        this.handleStepComplete(step);
      }, waitDuration);
    }

    // Enable interaction if this is an interact objective
    if (step.objective?.type === 'interact') {
      this.canInteract = true;
    }
  }

  private handleStepComplete(step: TutorialStep): void {
    // Trigger any sequences before advancing
    if (step.triggerSequence) {
      this.callbacks.onTriggerSequence?.(step.triggerSequence);
    }

    // Call step's onComplete callback
    step.onComplete?.();

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.isActive = false;
      this.callbacks.onComplete?.();
    } else {
      // Small delay between steps for pacing
      setTimeout(() => {
        if (this.isActive) {
          this.activateStep(this.steps[this.currentStepIndex]);
        }
      }, 300);
    }
  }

  // Called each frame to check if player completed objective
  checkObjective(playerPosition: Vector3, lookDirection?: Vector3): boolean {
    if (!this.isActive) return false;

    const step = this.steps[this.currentStepIndex];
    if (!step.objective) return false;

    // Don't check if we're waiting for auto-advance
    if (step.autoAdvanceAfterComms) return false;

    switch (step.objective.type) {
      case 'move_to':
        if (step.objective.target) {
          const dist = Vector3.Distance(
            new Vector3(playerPosition.x, 0, playerPosition.z),
            new Vector3(step.objective.target.x, 0, step.objective.target.z)
          );
          if (dist <= (step.objective.radius ?? 2)) {
            this.handleStepComplete(step);
            return true;
          }
        }
        break;

      case 'look_at':
        if (step.objective.target && lookDirection) {
          const toTarget = step.objective.target.subtract(playerPosition).normalize();
          const dot = Vector3.Dot(lookDirection, toTarget);
          if (dot > 0.7) {
            this.handleStepComplete(step);
            return true;
          }
        }
        break;

      case 'interact':
        // Handled by tryInteract()
        break;

      case 'shooting_range':
        // Handled by onShootingRangeComplete()
        break;

      case 'wait':
        // Handled by timer
        break;
    }

    return false;
  }

  // Check if player can interact and is in range
  canPlayerInteract(playerPosition: Vector3): boolean {
    if (!this.isActive || !this.canInteract) return false;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.type !== 'interact' || !step.objective.target) return false;

    const dist = Vector3.Distance(
      new Vector3(playerPosition.x, 0, playerPosition.z),
      new Vector3(step.objective.target.x, 0, step.objective.target.z)
    );

    return dist <= (step.objective.radius ?? 2);
  }

  // Player pressed interact button
  tryInteract(playerPosition: Vector3): boolean {
    if (!this.canPlayerInteract(playerPosition)) return false;

    const step = this.steps[this.currentStepIndex];
    this.canInteract = false;
    this.handleStepComplete(step);
    return true;
  }

  // Called when player dismisses comms message
  onCommsDismissed(): void {
    const step = this.steps[this.currentStepIndex];

    // If this step auto-advances but has a wait timer, let it continue
    // Otherwise if no objective, advance now
    if (!step.objective && !step.autoAdvanceAfterComms) {
      this.handleStepComplete(step);
    }
  }

  // Called when shooting range is completed
  onShootingRangeComplete(): void {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.type === 'shooting_range') {
      this.handleStepComplete(step);
    }
  }

  // Check if current step is shooting range
  isShootingRangeStep(): boolean {
    if (!this.isActive) return false;
    return this.steps[this.currentStepIndex]?.objective?.type === 'shooting_range';
  }

  getCurrentStep(): TutorialStep | null {
    if (!this.isActive) return null;
    return this.steps[this.currentStepIndex];
  }

  // Get target position for objective marker
  getCurrentObjectiveTarget(): Vector3 | null {
    if (!this.isActive) return null;
    const step = this.steps[this.currentStepIndex];
    if (
      step.objective?.target &&
      (step.objective.type === 'move_to' || step.objective.type === 'interact')
    ) {
      return step.objective.target;
    }
    return null;
  }

  // Check if current step is an interact type
  isInteractStep(): boolean {
    if (!this.isActive) return false;
    return this.steps[this.currentStepIndex]?.objective?.type === 'interact';
  }

  skip(): void {
    if (this.waitTimer) clearTimeout(this.waitTimer);
    if (this.commsTimer) clearTimeout(this.commsTimer);
    this.isActive = false;
    this.callbacks.onComplete?.();
  }

  isRunning(): boolean {
    return this.isActive;
  }

  dispose(): void {
    if (this.waitTimer) clearTimeout(this.waitTimer);
    if (this.commsTimer) clearTimeout(this.commsTimer);
    this.isActive = false;
  }
}
