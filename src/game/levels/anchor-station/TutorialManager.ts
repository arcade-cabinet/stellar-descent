import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../../core/Logger';
import {
  type HUDUnlockState,
  PHASE_HUD_STATES,
  TUTORIAL_STEPS,
  type TutorialPhase,
  type TutorialStep,
} from './tutorialSteps';

const log = getLogger('TutorialManager');

export interface TutorialCallbacks {
  onStepChange?: (step: TutorialStep) => void;
  onPhaseChange?: (phase: TutorialPhase, hudState: HUDUnlockState) => void;
  onCommsMessage?: (message: NonNullable<TutorialStep['commsMessage']>) => void;
  onObjectiveUpdate?: (title: string, instructions: string) => void;
  onTriggerSequence?: (sequence: NonNullable<TutorialStep['triggerSequence']>) => void;
  onActionButtonsChange?: (buttons: NonNullable<TutorialStep['actionButtons']>) => void;
  onComplete?: () => void;
}

// Manages the tutorial flow - story unfolds through comms as objectives complete
export class TutorialManager {
  private currentStepIndex = 0;
  private steps: TutorialStep[];
  private isActive = false;
  private callbacks: TutorialCallbacks = {};

  // Current phase for HUD state
  private currentPhase: TutorialPhase = 0;

  // Timer for auto-advance steps
  private waitTimer: number | null = null;
  private commsTimer: number | null = null;

  // Track if player can interact
  private canInteract = false;

  // Minimum delay between comms messages to prevent dialogue flood
  private static readonly MIN_COMMS_INTERVAL = 3000; // 3 seconds minimum
  private lastCommsTime = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.steps = TUTORIAL_STEPS;
  }

  start(callbacks: TutorialCallbacks): void {
    log.info('start() called');
    this.callbacks = callbacks;
    this.isActive = true;
    this.currentStepIndex = 0;
    this.currentPhase = 0;

    // Emit initial phase state
    this.callbacks.onPhaseChange?.(0, PHASE_HUD_STATES[0]);

    // Small delay before first step to let player orient
    log.debug('Setting timeout for first step (1500ms)');
    setTimeout(() => {
      log.debug('Timeout fired, isActive:', this.isActive);
      if (this.isActive) {
        this.activateStep(this.steps[0]);
      }
    }, 1500);
  }

  private activateStep(step: TutorialStep): void {
    log.debug('activateStep() called for step:', step.id);
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
    this.interactCallback = null;

    // Check for phase change
    if (step.phase !== this.currentPhase) {
      this.currentPhase = step.phase;
      this.callbacks.onPhaseChange?.(step.phase, PHASE_HUD_STATES[step.phase]);
    }

    this.callbacks.onStepChange?.(step);

    // Update objective display
    if (step.instructions) {
      this.callbacks.onObjectiveUpdate?.(step.title, step.instructions);
    } else {
      this.callbacks.onObjectiveUpdate?.(step.title, '');
    }

    // Update action buttons
    if (step.actionButtons && step.actionButtons.length > 0) {
      this.callbacks.onActionButtonsChange?.(step.actionButtons);
    } else {
      this.callbacks.onActionButtonsChange?.([]);
    }

    // Show comms message with optional delay, enforcing minimum interval
    if (step.commsMessage) {
      const configuredDelay = step.commsMessage.delay ?? 0;
      const timeSinceLastComms = performance.now() - this.lastCommsTime;
      const minIntervalRemaining = Math.max(
        0,
        TutorialManager.MIN_COMMS_INTERVAL - timeSinceLastComms
      );
      const actualDelay = Math.max(configuredDelay, minIntervalRemaining);

      log.debug('Setting comms timer for', actualDelay, 'ms');
      this.commsTimer = window.setTimeout(() => {
        log.debug('Comms timer fired, calling onCommsMessage');
        this.lastCommsTime = performance.now();
        this.callbacks.onCommsMessage?.(step.commsMessage!);

        // If auto-advance after comms and wait objective, start timer
        if (step.autoAdvanceAfterComms && step.objective?.type === 'wait') {
          const waitDuration = step.objective.duration ?? 2000;
          this.waitTimer = window.setTimeout(() => {
            this.handleStepComplete(step);
          }, waitDuration);
        }
      }, actualDelay);
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
      this.callbacks.onActionButtonsChange?.([]);
      this.callbacks.onComplete?.();
    } else {
      // Delay between steps for pacing - longer if previous step had comms
      const hasComms = step.commsMessage !== undefined;
      const stepDelay = hasComms ? 1000 : 500;
      setTimeout(() => {
        if (this.isActive) {
          this.activateStep(this.steps[this.currentStepIndex]);
        }
      }, stepDelay);
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

      case 'platforming_jump':
        // Handled by onJumpComplete()
        break;

      case 'platforming_crouch':
        // Handled by onCrouchComplete()
        break;

      case 'platforming_complete':
        // Handled by onPlatformingComplete()
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
    if (step.objective?.type !== 'interact') return false;

    // Special case for launch - always allow if we're in that step
    if (step.objective.interactId === 'launch_pod') return true;

    if (!step.objective.target) return false;

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

  // Handle space key for launch action
  tryLaunchAction(): boolean {
    if (!this.isActive) return false;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.interactId === 'launch_pod') {
      this.canInteract = false;
      this.handleStepComplete(step);
      return true;
    }
    return false;
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

  // Called when player completes jump in platforming room
  onJumpComplete(): void {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.type === 'platforming_jump') {
      this.handleStepComplete(step);
    }
  }

  // Called when player completes crouch in platforming room
  onCrouchComplete(): void {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.type === 'platforming_crouch') {
      this.handleStepComplete(step);
    }
  }

  // Called when platforming tutorial is fully completed
  onPlatformingComplete(): void {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (step.objective?.type === 'platforming_complete') {
      this.handleStepComplete(step);
    }
  }

  // Check if current step is a platforming step
  isPlatformingStep(): boolean {
    if (!this.isActive) return false;
    const type = this.steps[this.currentStepIndex]?.objective?.type;
    return (
      type === 'platforming_jump' ||
      type === 'platforming_crouch' ||
      type === 'platforming_complete'
    );
  }

  // Check if current step is the jump tutorial
  isJumpTutorialStep(): boolean {
    if (!this.isActive) return false;
    return this.steps[this.currentStepIndex]?.objective?.type === 'platforming_jump';
  }

  // Check if current step is the crouch tutorial
  isCrouchTutorialStep(): boolean {
    if (!this.isActive) return false;
    return this.steps[this.currentStepIndex]?.objective?.type === 'platforming_crouch';
  }

  getCurrentStep(): TutorialStep | null {
    if (!this.isActive) return null;
    return this.steps[this.currentStepIndex];
  }

  getCurrentPhase(): TutorialPhase {
    return this.currentPhase;
  }

  getHUDState(): HUDUnlockState {
    return PHASE_HUD_STATES[this.currentPhase];
  }

  // Get target position for objective marker
  getCurrentObjectiveTarget(): Vector3 | null {
    if (!this.isActive) return null;
    const step = this.steps[this.currentStepIndex];
    if (
      step.objective?.target &&
      (step.objective.type === 'move_to' ||
        step.objective.type === 'interact' ||
        step.objective.type === 'platforming_jump' ||
        step.objective.type === 'platforming_crouch')
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

  // Check if current step has the launch action
  isLaunchStep(): boolean {
    if (!this.isActive) return false;
    return this.steps[this.currentStepIndex]?.objective?.interactId === 'launch_pod';
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
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    if (this.commsTimer) {
      clearTimeout(this.commsTimer);
      this.commsTimer = null;
    }
    this.isActive = false;
    this.callbacks = {};
    this.canInteract = false;
    this.interactCallback = null;
  }

  /**
   * Get progress through the tutorial as a percentage (0-100).
   */
  getProgress(): number {
    if (this.steps.length === 0) return 0;
    return Math.round((this.currentStepIndex / this.steps.length) * 100);
  }

  /**
   * Get the total number of steps in the tutorial.
   */
  getTotalSteps(): number {
    return this.steps.length;
  }

  /**
   * Get the current step index (0-based).
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }
}
