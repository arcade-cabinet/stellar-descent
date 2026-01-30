/**
 * PlayerGovernor - Autonomous player control for e2e testing
 *
 * Uses Yuka AI behaviors to control the player character, enabling:
 * - Automated tutorial playthrough
 * - Combat engagement testing
 * - Navigation and objective completion
 * - Screenshot-based visual verification
 *
 * This is essentially a "bot player" that can exercise the full game loop.
 */

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import { ArriveBehavior, EntityManager, SeekBehavior, Vehicle, Vector3 as YukaVector3 } from 'yuka';
import type { Entity } from '../core/ecs';
import { getEntitiesInRadius } from '../core/ecs';

// Convert between Babylon and Yuka vectors
function toYuka(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}

function toBabylon(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}

// High-level goals the governor can pursue
export type GovernorGoal =
  | { type: 'idle' }
  | { type: 'navigate'; target: BabylonVector3; threshold?: number }
  | { type: 'follow_objective' } // Follow current game objective
  | { type: 'engage_enemies'; aggressive?: boolean }
  | { type: 'advance_dialogue' } // Press space to advance comms
  | { type: 'interact'; targetId?: string } // Interact with nearest interactable
  | { type: 'complete_tutorial' }
  | { type: 'wait'; duration: number; started?: number };

// Events the governor can emit for test verification
export type GovernorEvent =
  | { type: 'goal_started'; goal: GovernorGoal }
  | { type: 'goal_completed'; goal: GovernorGoal }
  | { type: 'enemy_engaged'; enemyId: string }
  | { type: 'enemy_killed'; enemyId: string }
  | { type: 'damage_taken'; amount: number }
  | { type: 'position_reached'; position: BabylonVector3 }
  | { type: 'dialogue_advanced' }
  | { type: 'interaction_performed'; targetId: string }
  | { type: 'objective_updated'; objectiveText: string };

export interface GovernorConfig {
  // Movement
  moveSpeed: number;
  arrivalThreshold: number;

  // Combat
  autoShoot: boolean;
  engagementRange: number;
  fleeHealthThreshold: number;

  // Dialogue
  dialogueAdvanceDelay: number; // ms between space presses
  autoAdvanceDialogue: boolean;

  // Testing
  logActions: boolean;
  captureScreenshots: boolean;
  screenshotInterval: number; // ms
}

const DEFAULT_CONFIG: GovernorConfig = {
  moveSpeed: 8,
  arrivalThreshold: 2,
  autoShoot: true,
  engagementRange: 30,
  fleeHealthThreshold: 0.2,
  dialogueAdvanceDelay: 1500,
  autoAdvanceDialogue: true,
  logActions: true,
  captureScreenshots: false,
  screenshotInterval: 2000,
};

export class PlayerGovernor {
  private entityManager: EntityManager;
  private vehicle: Vehicle;
  private playerEntity: Entity | null = null;
  private config: GovernorConfig;

  private currentGoal: GovernorGoal = { type: 'idle' };
  private goalQueue: GovernorGoal[] = [];
  private eventListeners: ((event: GovernorEvent) => void)[] = [];

  // State tracking
  private lastDialogueAdvance = 0;
  private lastShot = 0;
  private lastScreenshot = 0;
  private inputState: {
    moveForward: boolean;
    moveBack: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    shoot: boolean;
    interact: boolean;
    advanceDialogue: boolean;
  } = {
    moveForward: false,
    moveBack: false,
    moveLeft: false,
    moveRight: false,
    shoot: false,
    interact: false,
    advanceDialogue: false,
  };

  // Tutorial step tracking
  private tutorialStepsCompleted: string[] = [];
  private currentObjective: string = '';

  constructor(config: Partial<GovernorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.entityManager = new EntityManager();
    this.vehicle = new Vehicle();
    this.vehicle.maxSpeed = this.config.moveSpeed;
    this.vehicle.maxForce = 15;
    this.entityManager.add(this.vehicle);
  }

  setPlayer(player: Entity): void {
    this.playerEntity = player;
    if (player.transform) {
      this.vehicle.position = toYuka(player.transform.position);
    }
    this.log('Player entity assigned');
  }

  addEventListener(listener: (event: GovernorEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: GovernorEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: GovernorEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
    if (this.config.logActions) {
      this.log(`Event: ${event.type}`);
    }
  }

  private log(message: string): void {
    if (this.config.logActions) {
      console.log(`[PlayerGovernor] ${message}`);
    }
  }

  // ============================================================================
  // GOAL MANAGEMENT
  // ============================================================================

  setGoal(goal: GovernorGoal): void {
    this.currentGoal = goal;
    this.emit({ type: 'goal_started', goal });
    this.log(`Goal set: ${goal.type}`);
    this.updateBehaviors();
  }

  queueGoal(goal: GovernorGoal): void {
    this.goalQueue.push(goal);
    this.log(`Goal queued: ${goal.type}`);
  }

  clearGoals(): void {
    this.currentGoal = { type: 'idle' };
    this.goalQueue = [];
    this.vehicle.steering.clear();
    this.log('Goals cleared');
  }

  private completeCurrentGoal(): void {
    this.emit({ type: 'goal_completed', goal: this.currentGoal });
    this.log(`Goal completed: ${this.currentGoal.type}`);

    // Move to next goal in queue
    if (this.goalQueue.length > 0) {
      const nextGoal = this.goalQueue.shift()!;
      this.setGoal(nextGoal);
    } else {
      this.currentGoal = { type: 'idle' };
      this.vehicle.steering.clear();
    }
  }

  // ============================================================================
  // BEHAVIOR SETUP
  // ============================================================================

  private updateBehaviors(): void {
    this.vehicle.steering.clear();

    switch (this.currentGoal.type) {
      case 'navigate':
        this.setupNavigateBehavior(this.currentGoal.target);
        break;

      case 'follow_objective':
        // Will be handled dynamically based on current objective
        break;

      case 'engage_enemies':
        // Handled in update loop
        break;

      case 'complete_tutorial':
        // Multi-phase goal handled in update
        break;

      case 'idle':
      case 'advance_dialogue':
      case 'wait':
      case 'interact':
        // No movement behavior needed
        break;
    }
  }

  private setupNavigateBehavior(target: BabylonVector3): void {
    const arrive = new ArriveBehavior(toYuka(target), 3);
    arrive.weight = 1.0;
    this.vehicle.steering.add(arrive);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  update(deltaTime: number): void {
    if (!this.playerEntity?.transform) return;

    const now = Date.now();

    // Sync vehicle position from player
    this.vehicle.position = toYuka(this.playerEntity.transform.position);

    // Reset input state
    this.inputState = {
      moveForward: false,
      moveBack: false,
      moveLeft: false,
      moveRight: false,
      shoot: false,
      interact: false,
      advanceDialogue: false,
    };

    // Process current goal
    switch (this.currentGoal.type) {
      case 'navigate':
        this.processNavigateGoal(this.currentGoal);
        break;

      case 'engage_enemies':
        this.processEngageEnemiesGoal(this.currentGoal);
        break;

      case 'advance_dialogue':
        this.processAdvanceDialogueGoal(now);
        break;

      case 'wait':
        this.processWaitGoal(this.currentGoal, now);
        break;

      case 'complete_tutorial':
        this.processTutorialGoal(now);
        break;

      case 'follow_objective':
        this.processFollowObjectiveGoal();
        break;

      case 'interact':
        this.processInteractGoal();
        break;

      case 'idle':
        // Do nothing
        break;
    }

    // Auto advance dialogue if enabled
    if (
      this.config.autoAdvanceDialogue &&
      this.currentGoal.type !== 'advance_dialogue' &&
      now - this.lastDialogueAdvance > this.config.dialogueAdvanceDelay
    ) {
      // Check if dialogue is visible (this would need DOM access in actual impl)
      // For now, just mark for potential advancement
    }

    // Update Yuka
    this.entityManager.update(deltaTime);

    // Apply movement from vehicle velocity
    this.applyVehicleMovement();

    // Screenshots
    if (
      this.config.captureScreenshots &&
      now - this.lastScreenshot > this.config.screenshotInterval
    ) {
      this.lastScreenshot = now;
      // Screenshot capture would be handled by the test framework
    }
  }

  private processNavigateGoal(goal: {
    type: 'navigate';
    target: BabylonVector3;
    threshold?: number;
  }): void {
    const threshold = goal.threshold ?? this.config.arrivalThreshold;
    const distance = BabylonVector3.Distance(this.playerEntity!.transform!.position, goal.target);

    if (distance <= threshold) {
      this.emit({ type: 'position_reached', position: goal.target });
      this.completeCurrentGoal();
    }
  }

  private processEngageEnemiesGoal(goal: { type: 'engage_enemies'; aggressive?: boolean }): void {
    const enemies = getEntitiesInRadius(
      this.playerEntity!.transform!.position,
      this.config.engagementRange,
      (e) => e.tags?.enemy === true && (e.health?.current ?? 0) > 0
    );

    if (enemies.length === 0) {
      // No enemies in range - goal complete or wander
      if (goal.aggressive) {
        // Stay aggressive, but no enemies nearby
      } else {
        this.completeCurrentGoal();
      }
      return;
    }

    // Target nearest enemy
    const nearest = enemies.reduce((closest, enemy) => {
      const distToEnemy = BabylonVector3.Distance(
        this.playerEntity!.transform!.position,
        enemy.transform!.position
      );
      const distToClosest = BabylonVector3.Distance(
        this.playerEntity!.transform!.position,
        closest.transform!.position
      );
      return distToEnemy < distToClosest ? enemy : closest;
    });

    // Navigate towards enemy
    const seek = new SeekBehavior(toYuka(nearest.transform!.position));
    seek.weight = 1.0;
    this.vehicle.steering.clear();
    this.vehicle.steering.add(seek);

    // Shoot if in range
    const distToTarget = BabylonVector3.Distance(
      this.playerEntity!.transform!.position,
      nearest.transform!.position
    );

    if (distToTarget < 20 && this.config.autoShoot) {
      this.inputState.shoot = true;
      this.emit({ type: 'enemy_engaged', enemyId: nearest.id });
    }
  }

  private processAdvanceDialogueGoal(now: number): void {
    if (now - this.lastDialogueAdvance > this.config.dialogueAdvanceDelay) {
      this.inputState.advanceDialogue = true;
      this.lastDialogueAdvance = now;
      this.emit({ type: 'dialogue_advanced' });
      this.completeCurrentGoal();
    }
  }

  private processWaitGoal(
    goal: { type: 'wait'; duration: number; started?: number },
    now: number
  ): void {
    if (!goal.started) {
      goal.started = now;
    }

    if (now - goal.started >= goal.duration) {
      this.completeCurrentGoal();
    }
  }

  private processTutorialGoal(now: number): void {
    // Tutorial has multiple phases:
    // 1. Wait for initial comms
    // 2. Advance through dialogue
    // 3. Move to waypoints
    // 4. Interact with objects
    // 5. Complete objectives

    // This is a meta-goal that queues sub-goals
    // For now, just advance dialogue
    if (now - this.lastDialogueAdvance > this.config.dialogueAdvanceDelay) {
      this.inputState.advanceDialogue = true;
      this.lastDialogueAdvance = now;
      this.emit({ type: 'dialogue_advanced' });
    }
  }

  private processFollowObjectiveGoal(): void {
    // Would need to parse current objective and navigate/interact accordingly
    // For now, just idle
  }

  private processInteractGoal(): void {
    this.inputState.interact = true;
    this.completeCurrentGoal();
  }

  private applyVehicleMovement(): void {
    // Convert Yuka velocity to input state
    const velocity = this.vehicle.velocity;

    if (velocity.length() > 0.1) {
      // Determine primary movement direction
      const normalized = velocity.clone().normalize();

      if (normalized.z < -0.3) this.inputState.moveForward = true;
      if (normalized.z > 0.3) this.inputState.moveBack = true;
      if (normalized.x < -0.3) this.inputState.moveLeft = true;
      if (normalized.x > 0.3) this.inputState.moveRight = true;
    }
  }

  // ============================================================================
  // INPUT STATE ACCESS (for game input system to read)
  // ============================================================================

  getInputState(): typeof this.inputState {
    return { ...this.inputState };
  }

  isMovingForward(): boolean {
    return this.inputState.moveForward;
  }

  isMovingBack(): boolean {
    return this.inputState.moveBack;
  }

  isMovingLeft(): boolean {
    return this.inputState.moveLeft;
  }

  isMovingRight(): boolean {
    return this.inputState.moveRight;
  }

  isShooting(): boolean {
    return this.inputState.shoot;
  }

  shouldAdvanceDialogue(): boolean {
    return this.inputState.advanceDialogue;
  }

  shouldInteract(): boolean {
    return this.inputState.interact;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getCurrentGoal(): GovernorGoal {
    return this.currentGoal;
  }

  getQueuedGoals(): GovernorGoal[] {
    return [...this.goalQueue];
  }

  getVehiclePosition(): BabylonVector3 {
    return toBabylon(this.vehicle.position);
  }

  getVehicleVelocity(): BabylonVector3 {
    return toBabylon(this.vehicle.velocity);
  }

  setObjective(objective: string): void {
    this.currentObjective = objective;
    this.emit({ type: 'objective_updated', objectiveText: objective });
    this.log(`Objective updated: ${objective}`);
  }

  markTutorialStepComplete(step: string): void {
    if (!this.tutorialStepsCompleted.includes(step)) {
      this.tutorialStepsCompleted.push(step);
      this.log(`Tutorial step completed: ${step}`);
    }
  }

  // ============================================================================
  // PRESET GOAL SEQUENCES
  // ============================================================================

  /**
   * Run a full tutorial playthrough
   */
  runTutorialPlaythrough(): void {
    this.clearGoals();

    // Queue tutorial sequence
    this.queueGoal({ type: 'wait', duration: 2000 }); // Wait for game to load
    this.queueGoal({ type: 'advance_dialogue' }); // First comms
    this.queueGoal({ type: 'wait', duration: 1000 });
    this.queueGoal({ type: 'advance_dialogue' });
    this.queueGoal({ type: 'wait', duration: 1000 });
    this.queueGoal({ type: 'advance_dialogue' });
    this.queueGoal({ type: 'wait', duration: 1000 });
    this.queueGoal({ type: 'advance_dialogue' });
    this.queueGoal({ type: 'wait', duration: 1000 });
    this.queueGoal({ type: 'advance_dialogue' });
    this.queueGoal({ type: 'follow_objective' }); // Start following objectives

    // Start first goal
    if (this.goalQueue.length > 0) {
      const firstGoal = this.goalQueue.shift()!;
      this.setGoal(firstGoal);
    }

    this.log('Tutorial playthrough started');
  }

  /**
   * Navigate to a specific position
   */
  navigateTo(position: BabylonVector3, threshold?: number): void {
    this.setGoal({ type: 'navigate', target: position, threshold });
  }

  /**
   * Engage all enemies in range
   */
  engageEnemies(aggressive = false): void {
    this.setGoal({ type: 'engage_enemies', aggressive });
  }

  /**
   * Wait for a duration then continue
   */
  wait(duration: number): void {
    this.setGoal({ type: 'wait', duration });
  }

  dispose(): void {
    this.entityManager.clear();
    this.eventListeners = [];
    this.log('Governor disposed');
  }
}

// Singleton for easy access in tests
let governorInstance: PlayerGovernor | null = null;

export function getPlayerGovernor(config?: Partial<GovernorConfig>): PlayerGovernor {
  if (!governorInstance) {
    governorInstance = new PlayerGovernor(config);
  }
  return governorInstance;
}

export function resetPlayerGovernor(): void {
  if (governorInstance) {
    governorInstance.dispose();
    governorInstance = null;
  }
}
