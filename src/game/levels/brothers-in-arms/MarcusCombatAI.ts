/**
 * MarcusCombatAI - Advanced AI for Marcus's Titan mech during combat
 *
 * COMBAT BEHAVIORS:
 * - Coordinated attacks with player (focus fire, flanking, suppression)
 * - Dynamic callouts based on combat situation
 * - Damage tracking and repair mechanics
 * - Tactical positioning relative to player and enemies
 *
 * STATES:
 * - idle: Standing by, awaiting orders
 * - support: Following player, providing cover
 * - assault: Aggressive attack on priority targets
 * - defensive: Protecting player from incoming threats
 * - suppression: Laying down covering fire
 * - damaged: Taking damage, limited mobility
 * - repairing: Self-repair sequence, reduced combat effectiveness
 *
 * COORDINATION INTEGRATION:
 * - Works with MarcusCombatCoordinator for target sharing
 * - Responds to coordination requests (focus fire, flank, cover)
 * - Provides status updates for UI display
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Entity } from '../../core/ecs';
import { createEntity, removeEntity } from '../../core/ecs';
import type { CommsMessage } from '../../types';
import { tokens } from '../../utils/designTokens';
import {
  type CoordinationCombatState,
  type CoordinationRequest,
  MarcusCombatCoordinator,
} from './MarcusCombatCoordinator';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type MarcusCombatState =
  | 'idle'
  | 'support'
  | 'assault'
  | 'defensive'
  | 'suppression'
  | 'damaged'
  | 'repairing'
  | 'downed'; // Critical state - Marcus is incapacitated but not dead

export interface MarcusCombatConfig {
  maxHealth: number;
  damage: number;
  fireRate: number;
  range: number;
  moveSpeed: number;
  rotationSpeed: number;
  repairRate: number;
  lowHealthThreshold: number;
  criticalHealthThreshold: number;
}

export interface CombatTarget {
  entity: Entity;
  mesh: Mesh;
  priority: number;
  lastSeenTime: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CoordinatedAttack {
  type: 'focus_fire' | 'flank' | 'suppress' | 'cover_player';
  targetEntity: Entity | null;
  targetPosition: Vector3;
  duration: number;
  startTime: number;
}

export interface MarcusCombatCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onMarcusHealthChange?: (health: number, maxHealth: number) => void;
  onMarcusShieldChange?: (shields: number, maxShields: number) => void;
  onStateChange?: (newState: MarcusCombatState, oldState: MarcusCombatState) => void;
  onCoordinatedAttack?: (attack: CoordinatedAttack) => void;
  onNotification?: (text: string, duration: number) => void;
  onMarcusDowned?: () => void;
  onMarcusRevived?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: MarcusCombatConfig = {
  maxHealth: 500,
  damage: 50,
  fireRate: 2.5,
  range: 80,
  moveSpeed: 12,
  rotationSpeed: 2,
  repairRate: 5, // HP per second when repairing
  lowHealthThreshold: 0.4, // 40% health
  criticalHealthThreshold: 0.15, // 15% health
};

// Marcus character for comms messages
const MARCUS_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// Combat callouts - organized by situation
export const COMBAT_CALLOUTS = {
  // Target acquisition
  TARGET_ACQUIRED: [
    'I see it! Engaging!',
    'Target acquired - opening fire!',
    'Got eyes on hostile - taking the shot!',
    'Locked on! Firing!',
  ],

  // Focus fire coordination
  FOCUS_FIRE: [
    'Focus fire on that one, James!',
    'Concentrate fire! Take it down!',
    "Let's drop this one together!",
    'Coordinating fire - hit it hard!',
  ],

  // Flank maneuver
  FLANKING: [
    "Moving to flank - keep 'em busy!",
    "Going around! I'll hit them from the side!",
    'Flanking maneuver - draw their attention!',
    "I'll circle around - you hold their focus!",
  ],

  // Suppression
  SUPPRESSION: [
    'Suppressing fire! Move up!',
    'Laying down cover - go go go!',
    'Keeping them pinned! Advance!',
    'Heavy fire incoming - use this opening!',
  ],

  // Kill confirmation
  KILL_CONFIRMED: [
    'Target down!',
    'Got one!',
    "That's a kill!",
    'Hostile eliminated!',
    'Scratch one!',
  ],

  // Brute/Boss specific
  BRUTE_SPOTTED: [
    'BRUTE! Big one! Focus fire!',
    'Heavy contact! That thing is huge!',
    "We've got a Brute incoming!",
    'Major threat detected - concentrate fire!',
  ],

  // Wave incoming
  WAVE_INCOMING: [
    'More incoming! Stay sharp!',
    'New contacts approaching!',
    'Here they come again!',
    'Movement detected - prepare for contact!',
  ],

  // Player danger
  PLAYER_DANGER: [
    'James, watch your six!',
    'Behind you! Move!',
    "They're flanking you!",
    'Get to cover!',
  ],

  // Low health warnings
  TAKING_DAMAGE: [
    'Taking hits! Armor holding!',
    'Getting hammered here!',
    'Heavy fire on my position!',
    'Shields absorbing fire!',
  ],

  // Critical damage
  CRITICAL_DAMAGE: [
    'HAMMER taking critical damage!',
    'Systems failing! I need a moment!',
    'Major damage! Initiating repairs!',
    'Armor breach! Pulling back!',
  ],

  // Repair status
  REPAIRING: [
    'Initiating field repairs - cover me!',
    'Running diagnostics - need a few seconds!',
    'Patching systems - keep them off me!',
    'Self-repair engaged - almost there!',
  ],

  // Repair complete
  REPAIR_COMPLETE: [
    'Repairs complete - back in the fight!',
    'Systems nominal - resuming combat!',
    'HAMMER is back online!',
    "Good as new! Let's finish this!",
  ],

  // Downed state - Marcus is incapacitated
  DOWNED: [
    'HAMMER down! Systems critical!',
    "I'm hit bad! Can't... can't move!",
    'Major systems failure! Need time to reboot!',
    "James... I'm down! Hold them off!",
  ],

  // Reviving - Marcus is recovering from downed state
  REVIVING: [
    'Systems coming back online...',
    'Rebooting primary systems...',
    'Almost there... just need a moment...',
    "Don't give up on me yet...",
  ],

  // Revived - Marcus recovered from downed
  REVIVED: [
    "I'm back! Sorry about that!",
    'HAMMER operational! Thanks for the cover!',
    "Back in action! Let's finish this!",
    "That was close... won't happen again!",
  ],

  // Player helping revive
  PLAYER_ASSIST_REVIVE: [
    'Your presence is boosting my morale, brother!',
    'Having you close helps the systems recalibrate!',
    'Thanks for staying with me, James!',
    'Almost there - keep them off us!',
  ],

  // Wave cleared
  WAVE_CLEARED: [
    'Area secure! Good work!',
    'All hostiles down!',
    'Clear! Take a breather!',
    "That's all of them - for now!",
  ],

  // Coordinated success
  COORDINATED_SUCCESS: [
    'Perfect timing, James!',
    'Just like the old days!',
    'Great teamwork!',
    "We're unstoppable together!",
  ],
};

// ============================================================================
// MARCUS COMBAT AI CLASS
// ============================================================================

export class MarcusCombatAI {
  // Scene reference
  private scene: Scene;

  // Marcus mech reference
  private rootNode: TransformNode;
  private leftArm: Mesh;
  private rightArm: Mesh;

  // Combat state
  private state: MarcusCombatState = 'idle';
  private previousState: MarcusCombatState = 'idle';
  private health: number;
  private shields: number = 100;
  private maxShields: number = 100;
  private config: MarcusCombatConfig;
  private callbacks: MarcusCombatCallbacks;

  // Position tracking
  private position: Vector3;
  private targetRotation: number = 0;
  private currentRotation: number = 0;

  // Combat tracking
  private targets: CombatTarget[] = [];
  private currentTarget: CombatTarget | null = null;
  private lastFireTime: number = 0;
  private lastCalloutTime: Map<string, number> = new Map();
  private calloutCooldown: number = 5000; // 5 seconds between similar callouts

  // Coordinated attack
  private activeCoordinatedAttack: CoordinatedAttack | null = null;

  // Combat coordinator integration
  private coordinator: MarcusCombatCoordinator | null = null;
  private coordinationCombatState: CoordinationCombatState = 'support';

  // Repair tracking
  private repairStartTime: number = 0;
  private isReloading: boolean = false;
  private reloadEndTime: number = 0;
  private reloadDuration: number = 2000; // 2 seconds to reload

  // Downed state tracking
  private downedStartTime: number = 0;
  private downedDuration: number = 15000; // 15 seconds to auto-recover
  private downedRecoveryProgress: number = 0;
  private playerAssistRange: number = 15; // Player within this range speeds up recovery
  private playerAssistMultiplier: number = 2.5; // Recovery is 2.5x faster when player is nearby
  private lastReviveCalloutTime: number = 0;
  private timesDownedThisLevel: number = 0;

  // Player reference
  private playerPosition: Vector3 = Vector3.Zero();
  private playerForward: Vector3 = Vector3.Forward();

  // Statistics
  private killCount: number = 0;
  private damageDealt: number = 0;
  private assistCount: number = 0;

  constructor(
    scene: Scene,
    rootNode: TransformNode,
    leftArm: Mesh,
    rightArm: Mesh,
    callbacks: MarcusCombatCallbacks,
    config?: Partial<MarcusCombatConfig>
  ) {
    this.scene = scene;
    this.rootNode = rootNode;
    this.leftArm = leftArm;
    this.rightArm = rightArm;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.health = this.config.maxHealth;
    this.position = rootNode.position.clone();

    // Initialize combat coordinator
    this.coordinator = new MarcusCombatCoordinator(scene, {
      onCommsMessage: callbacks.onCommsMessage,
      onNotification: callbacks.onNotification,
      onCombatStateChange: (state) => {
        this.coordinationCombatState = state;
      },
    });
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Update Marcus's combat AI each frame
   */
  update(
    deltaTime: number,
    playerPosition: Vector3,
    enemies: Entity[],
    playerForward?: Vector3
  ): void {
    this.playerPosition = playerPosition.clone();
    if (playerForward) {
      this.playerForward = playerForward.clone();
    }

    // Update coordinator with player info
    if (this.coordinator) {
      this.coordinator.updatePlayerPosition(playerPosition, this.playerForward);
      this.coordinator.update(deltaTime, enemies);

      // Sync status with coordinator
      this.coordinator.updateMarcusStatus({
        health: this.health,
        maxHealth: this.config.maxHealth,
        shields: this.shields,
        maxShields: this.maxShields,
        isReloading: this.isReloading,
        currentTarget: this.currentTarget?.entity ?? null,
        combatState: this.coordinationCombatState,
      });
    }

    // Update reload status
    if (this.isReloading && performance.now() >= this.reloadEndTime) {
      this.isReloading = false;
    }

    // Update target list
    this.updateTargets(enemies);

    // State machine
    this.updateStateMachine(deltaTime);

    // Movement and rotation
    this.updateMovement(deltaTime);

    // Combat (firing)
    this.updateCombat(deltaTime);

    // Health regeneration when not taking damage
    if (this.state === 'repairing') {
      this.updateRepair(deltaTime);
    }

    // Handle downed state recovery
    if (this.state === 'downed') {
      this.updateDownedState(deltaTime);
    }

    // Shield regeneration (slower than health)
    this.updateShields(deltaTime);

    // Update root node position
    this.rootNode.position = this.position.clone();
    this.rootNode.rotation.y = this.currentRotation;
  }

  /**
   * Update shield regeneration
   */
  private updateShields(deltaTime: number): void {
    // Regenerate shields when not taking damage (3 second delay)
    if (this.shields < this.maxShields && this.state !== 'damaged' && this.state !== 'repairing') {
      this.shields = Math.min(this.maxShields, this.shields + deltaTime * 5);
    }
  }

  /**
   * Set Marcus's combat state
   */
  setState(newState: MarcusCombatState): void {
    if (newState === this.state) return;

    this.previousState = this.state;
    this.state = newState;

    this.callbacks.onStateChange?.(newState, this.previousState);

    // State-specific announcements
    this.announceStateChange(newState);
  }

  /**
   * Get current state
   */
  getState(): MarcusCombatState {
    return this.state;
  }

  /**
   * Get current health
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Get max health
   */
  getMaxHealth(): number {
    return this.config.maxHealth;
  }

  /**
   * Get health percentage
   */
  getHealthPercent(): number {
    return this.health / this.config.maxHealth;
  }

  /**
   * Apply damage to Marcus
   */
  takeDamage(amount: number): void {
    // Damage goes to shields first
    let remainingDamage = amount;

    if (this.shields > 0) {
      const shieldDamage = Math.min(this.shields, remainingDamage);
      this.shields -= shieldDamage;
      remainingDamage -= shieldDamage;

      // Notify coordinator of shield status
      if (this.shields <= 0 && this.coordinator) {
        this.coordinator.updateMarcusStatus({ shields: 0 });
      }
    }

    // Remaining damage goes to health
    if (remainingDamage > 0) {
      this.health = Math.max(0, this.health - remainingDamage);
    }

    this.callbacks.onMarcusHealthChange?.(this.health, this.config.maxHealth);

    // Notify coordinator of damage
    if (this.coordinator) {
      this.coordinator.onMarcusDamage(amount);
    }

    // Check for state transitions based on health
    const healthPercent = this.getHealthPercent();

    if (healthPercent <= 0 && this.state !== 'downed') {
      // Marcus is downed but not dead - he can always recover
      this.health = 1; // Never truly reaches 0
      this.enterDownedState();
    } else if (
      healthPercent <= this.config.criticalHealthThreshold &&
      this.state !== 'repairing' &&
      this.state !== 'downed'
    ) {
      this.setState('repairing');
      this.repairStartTime = performance.now();
      this.sendCallout('CRITICAL_DAMAGE');
    } else if (
      healthPercent <= this.config.lowHealthThreshold &&
      this.state !== 'damaged' &&
      this.state !== 'repairing' &&
      this.state !== 'downed'
    ) {
      this.setState('damaged');
      this.sendCallout('TAKING_DAMAGE');
    }
  }

  /**
   * Enter the downed state - Marcus is incapacitated
   */
  private enterDownedState(): void {
    this.setState('downed');
    this.downedStartTime = performance.now();
    this.downedRecoveryProgress = 0;
    this.timesDownedThisLevel++;
    this.sendCallout('DOWNED');
    this.callbacks.onMarcusDowned?.();
    this.callbacks.onNotification?.('HAMMER IS DOWN!', 3000);
  }

  /**
   * Update the downed state - handle recovery
   */
  private updateDownedState(deltaTime: number): void {
    const now = performance.now();

    // Calculate recovery speed - faster when player is nearby
    const distToPlayer = Vector3.Distance(this.position, this.playerPosition);
    const playerAssisting = distToPlayer <= this.playerAssistRange;
    const recoveryMultiplier = playerAssisting ? this.playerAssistMultiplier : 1;

    // Increment recovery progress
    this.downedRecoveryProgress += (deltaTime * 1000 * recoveryMultiplier) / this.downedDuration;

    // Player assist callout (once per 5 seconds)
    if (playerAssisting && now - this.lastReviveCalloutTime > 5000) {
      this.lastReviveCalloutTime = now;
      this.sendCallout('PLAYER_ASSIST_REVIVE');
    }

    // Periodic "reviving" callout
    if (this.downedRecoveryProgress > 0.3 && this.downedRecoveryProgress < 0.35) {
      this.sendCallout('REVIVING');
    }
    if (this.downedRecoveryProgress > 0.6 && this.downedRecoveryProgress < 0.65) {
      this.sendCallout('REVIVING');
    }

    // Check if recovery is complete
    if (this.downedRecoveryProgress >= 1) {
      this.reviveFromDowned();
    }

    // Update health display during recovery
    this.callbacks.onMarcusHealthChange?.(
      Math.floor(this.downedRecoveryProgress * this.config.maxHealth * 0.4), // Recover to 40% health
      this.config.maxHealth
    );
  }

  /**
   * Revive Marcus from downed state
   */
  private reviveFromDowned(): void {
    this.health = this.config.maxHealth * 0.4; // Revive at 40% health
    this.shields = this.maxShields * 0.5; // Partial shields
    this.setState('support'); // Return to support mode
    this.sendCallout('REVIVED');
    this.callbacks.onMarcusRevived?.();
    this.callbacks.onMarcusHealthChange?.(this.health, this.config.maxHealth);
    this.callbacks.onMarcusShieldChange?.(this.shields, this.maxShields);
    this.callbacks.onNotification?.('HAMMER BACK ONLINE!', 2000);
  }

  /**
   * Check if Marcus is currently downed
   */
  isDowned(): boolean {
    return this.state === 'downed';
  }

  /**
   * Get downed recovery progress (0-1)
   */
  getDownedRecoveryProgress(): number {
    return this.state === 'downed' ? this.downedRecoveryProgress : 0;
  }

  /**
   * Get how many times Marcus has been downed
   */
  getTimesDownedThisLevel(): number {
    return this.timesDownedThisLevel;
  }

  /**
   * Get current shield value
   */
  getShields(): number {
    return this.shields;
  }

  /**
   * Get max shield value
   */
  getMaxShields(): number {
    return this.maxShields;
  }

  /**
   * Get the combat coordinator
   */
  getCoordinator(): MarcusCombatCoordinator | null {
    return this.coordinator;
  }

  /**
   * Set coordination combat state
   */
  setCoordinationState(state: CoordinationCombatState): void {
    this.coordinationCombatState = state;
    if (this.coordinator) {
      this.coordinator.setCombatState(state);
    }
  }

  /**
   * Get current coordination combat state
   */
  getCoordinationState(): CoordinationCombatState {
    return this.coordinationCombatState;
  }

  /**
   * Request focus fire on a target
   */
  requestFocusFire(target: Entity): CoordinationRequest | null {
    return this.coordinator?.requestFocusFire(target) ?? null;
  }

  /**
   * Request flanking maneuver
   */
  requestFlank(position: Vector3): CoordinationRequest | null {
    return this.coordinator?.requestFlank(position) ?? null;
  }

  /**
   * Request cover fire
   */
  requestCoverFire(duration?: number): CoordinationRequest | null {
    return this.coordinator?.requestCoverFire(duration) ?? null;
  }

  /**
   * Trigger reload (reduces fire rate temporarily)
   */
  triggerReload(): void {
    if (this.isReloading) return;

    this.isReloading = true;
    this.reloadEndTime = performance.now() + this.reloadDuration;
  }

  /**
   * Get assist count
   */
  getAssistCount(): number {
    return this.assistCount;
  }

  /**
   * Increment assist count
   */
  addAssist(): void {
    this.assistCount++;
  }

  /**
   * Heal Marcus
   */
  heal(amount: number): void {
    this.health = Math.min(this.config.maxHealth, this.health + amount);
    this.callbacks.onMarcusHealthChange?.(this.health, this.config.maxHealth);
  }

  /**
   * Initiate a coordinated attack with the player
   */
  initiateCoordinatedAttack(type: CoordinatedAttack['type'], target?: Entity): void {
    const targetPos = target?.transform?.position ?? this.currentTarget?.mesh.position;

    if (!targetPos) return;

    this.activeCoordinatedAttack = {
      type,
      targetEntity: target ?? this.currentTarget?.entity ?? null,
      targetPosition: targetPos.clone(),
      duration: type === 'suppress' ? 5000 : 3000,
      startTime: performance.now(),
    };

    this.callbacks.onCoordinatedAttack?.(this.activeCoordinatedAttack);

    // Announce the attack
    switch (type) {
      case 'focus_fire':
        this.sendCallout('FOCUS_FIRE');
        break;
      case 'flank':
        this.sendCallout('FLANKING');
        break;
      case 'suppress':
        this.sendCallout('SUPPRESSION');
        break;
      case 'cover_player':
        this.sendCallout('PLAYER_DANGER');
        break;
    }
  }

  /**
   * Get current position
   */
  getPosition(): Vector3 {
    return this.position.clone();
  }

  /**
   * Get kill count
   */
  getKillCount(): number {
    return this.killCount;
  }

  /**
   * Notify Marcus of an enemy kill
   */
  notifyKill(_enemy: Entity): void {
    this.killCount++;
    this.sendCallout('KILL_CONFIRMED');

    // Random chance for coordinated success callout
    if (Math.random() < 0.2) {
      setTimeout(() => {
        this.sendCallout('COORDINATED_SUCCESS');
      }, 800);
    }
  }

  /**
   * Request fire support - Marcus will focus all fire on a location
   */
  requestFireSupport(targetPosition: Vector3, duration: number = 5000): void {
    this.initiateCoordinatedAttack('suppress', undefined);

    // Override target position for suppression
    if (this.activeCoordinatedAttack) {
      this.activeCoordinatedAttack.targetPosition = targetPosition.clone();
      this.activeCoordinatedAttack.duration = duration;
    }

    // Increase fire rate temporarily
    const originalFireRate = this.config.fireRate;
    this.config.fireRate *= 2.5;

    setTimeout(() => {
      this.config.fireRate = originalFireRate;
      this.activeCoordinatedAttack = null;
    }, duration);
  }

  // ============================================================================
  // PRIVATE METHODS - STATE MACHINE
  // ============================================================================

  private updateStateMachine(_deltaTime: number): void {
    // Don't change state while downed - recovery is handled separately
    if (this.state === 'downed') {
      return;
    }

    // Don't change state while repairing unless repairs are complete
    if (this.state === 'repairing') {
      if (this.health >= this.config.maxHealth * 0.6) {
        this.sendCallout('REPAIR_COMPLETE');
        this.setState('support');
      }
      return;
    }

    // Evaluate state based on situation
    const healthPercent = this.getHealthPercent();
    const nearbyEnemies = this.targets.filter(
      (t) => Vector3.Distance(t.mesh.position, this.position) < this.config.range
    );
    const threatsNearPlayer = this.targets.filter(
      (t) => Vector3.Distance(t.mesh.position, this.playerPosition) < 20
    );

    // Critical health - repair (already returned above if state === 'repairing')
    if (healthPercent <= this.config.criticalHealthThreshold) {
      this.setState('repairing');
      this.repairStartTime = performance.now();
      return;
    }

    // Low health - defensive
    if (healthPercent <= this.config.lowHealthThreshold) {
      this.setState('damaged');
      return;
    }

    // Coordinated attack in progress
    if (this.activeCoordinatedAttack) {
      const elapsed = performance.now() - this.activeCoordinatedAttack.startTime;
      if (elapsed >= this.activeCoordinatedAttack.duration) {
        this.activeCoordinatedAttack = null;
      } else {
        // Stay in appropriate state for coordinated attack
        switch (this.activeCoordinatedAttack.type) {
          case 'focus_fire':
          case 'suppress':
            this.setState('suppression');
            return;
          case 'flank':
            this.setState('assault');
            return;
          case 'cover_player':
            this.setState('defensive');
            return;
        }
      }
    }

    // Priority targets (brutes) - assault
    const highPriorityTargets = nearbyEnemies.filter((t) => t.priority >= 8);
    if (highPriorityTargets.length > 0) {
      this.setState('assault');
      return;
    }

    // Threats near player - defensive
    if (threatsNearPlayer.length > 2) {
      this.setState('defensive');
      return;
    }

    // Multiple enemies in range - suppression
    if (nearbyEnemies.length > 5) {
      this.setState('suppression');
      return;
    }

    // Active enemies - support
    if (nearbyEnemies.length > 0) {
      this.setState('support');
      return;
    }

    // No enemies - idle
    this.setState('idle');
  }

  private announceStateChange(state: MarcusCombatState): void {
    switch (state) {
      case 'repairing':
        this.sendCallout('REPAIRING');
        break;
      case 'downed':
        // Downed callout is handled in enterDownedState()
        break;
      case 'assault': {
        // Check for brute
        const bruteTarget = this.targets.find((t) => t.priority >= 8);
        if (bruteTarget && this.previousState !== 'assault') {
          this.sendCallout('BRUTE_SPOTTED');
        }
        break;
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS - TARGET MANAGEMENT
  // ============================================================================

  private updateTargets(enemies: Entity[]): void {
    const now = performance.now();

    // Update existing targets and add new ones
    this.targets = enemies
      .filter((e) => e.transform && e.health && e.health.current > 0)
      .map((enemy) => {
        const mesh = enemy.renderable?.mesh as Mesh;
        if (!mesh || !enemy.transform) return null;

        // Calculate priority based on threat level and distance to player
        const distToPlayer = Vector3.Distance(enemy.transform.position, this.playerPosition);

        // Higher priority for enemies close to player
        let priority = Math.max(0, 10 - distToPlayer / 10);

        // Bonus priority for specific enemy types
        const meshName = mesh.name.toLowerCase();
        if (meshName.includes('brute')) {
          priority += 5;
        } else if (meshName.includes('spitter')) {
          priority += 2;
        }

        // Calculate threat level
        let threatLevel: CombatTarget['threatLevel'] = 'low';
        if (distToPlayer < 10) threatLevel = 'critical';
        else if (distToPlayer < 20) threatLevel = 'high';
        else if (distToPlayer < 40) threatLevel = 'medium';

        return {
          entity: enemy,
          mesh,
          priority,
          lastSeenTime: now,
          threatLevel,
        } as CombatTarget;
      })
      .filter((t): t is CombatTarget => t !== null)
      .sort((a, b) => b.priority - a.priority);

    // Update current target
    if (this.targets.length > 0) {
      // For coordinated attacks, prioritize the specified target
      if (this.activeCoordinatedAttack?.targetEntity) {
        const coordTarget = this.targets.find(
          (t) => t.entity.id === this.activeCoordinatedAttack!.targetEntity!.id
        );
        if (coordTarget) {
          this.currentTarget = coordTarget;
          return;
        }
      }

      // Otherwise, pick highest priority target
      this.currentTarget = this.targets[0];
    } else {
      this.currentTarget = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - MOVEMENT
  // ============================================================================

  private updateMovement(deltaTime: number): void {
    const moveSpeed = this.config.moveSpeed;
    const rotSpeed = this.config.rotationSpeed;

    // No movement when downed
    if (this.state === 'downed') {
      return;
    }

    // Reduce speed when damaged or repairing
    const speedMultiplier = this.state === 'repairing' ? 0 : this.state === 'damaged' ? 0.5 : 1;

    let targetPosition: Vector3 | null = null;

    switch (this.state) {
      case 'idle':
        // Stay near player
        targetPosition = this.getIdlePosition();
        break;

      case 'support':
        // Stay between player and nearest threat
        targetPosition = this.getSupportPosition();
        break;

      case 'assault':
        // Move toward priority target aggressively
        targetPosition = this.getAssaultPosition();
        break;

      case 'defensive':
        // Position to protect player
        targetPosition = this.getDefensivePosition();
        break;

      case 'suppression':
        // Hold position and fire
        targetPosition = this.position; // Stay in place
        break;

      case 'damaged':
        // Fall back toward player
        targetPosition = this.getRetreatPosition();
        break;

      case 'repairing':
        // Stationary
        targetPosition = this.position;
        break;
    }

    if (targetPosition) {
      const toTarget = targetPosition.subtract(this.position);
      toTarget.y = 0;

      const distance = toTarget.length();

      if (distance > 2) {
        toTarget.normalize();
        const moveAmount = moveSpeed * speedMultiplier * deltaTime;
        this.position.addInPlace(toTarget.scale(Math.min(moveAmount, distance)));
      }

      // Face toward current target or movement direction
      if (this.currentTarget && this.state !== 'idle') {
        const toEnemy = this.currentTarget.mesh.position.subtract(this.position);
        toEnemy.y = 0;
        if (toEnemy.length() > 0.1) {
          this.targetRotation = Math.atan2(toEnemy.x, toEnemy.z);
        }
      } else if (distance > 0.5) {
        this.targetRotation = Math.atan2(toTarget.x, toTarget.z);
      }

      // Smooth rotation
      let rotDiff = this.targetRotation - this.currentRotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.currentRotation += rotDiff * rotSpeed * deltaTime;
    }

    // Clamp position to arena bounds (assume 200x150 arena)
    const ARENA_WIDTH = 200;
    const ARENA_DEPTH = 150;
    this.position.x = Math.max(
      -ARENA_WIDTH / 2 + 10,
      Math.min(ARENA_WIDTH / 2 - 10, this.position.x)
    );
    this.position.z = Math.max(
      -ARENA_DEPTH / 2 + 10,
      Math.min(ARENA_DEPTH / 2 - 10, this.position.z)
    );
  }

  private getIdlePosition(): Vector3 {
    // Stay 15-20m from player
    const toPlayer = this.playerPosition.subtract(this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist < 15) {
      toPlayer.normalize();
      return this.playerPosition.subtract(toPlayer.scale(18));
    } else if (dist > 25) {
      toPlayer.normalize();
      return this.playerPosition.subtract(toPlayer.scale(20));
    }
    return this.position;
  }

  private getSupportPosition(): Vector3 {
    if (!this.currentTarget) return this.getIdlePosition();

    // Position between player and threat
    const toEnemy = this.currentTarget.mesh.position.subtract(this.playerPosition);
    toEnemy.y = 0;
    toEnemy.normalize();

    return this.playerPosition.add(toEnemy.scale(10));
  }

  private getAssaultPosition(): Vector3 {
    if (!this.currentTarget) return this.getIdlePosition();

    // Move closer to high-priority target
    const toTarget = this.currentTarget.mesh.position.subtract(this.position);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist > 40) {
      toTarget.normalize();
      return this.position.add(toTarget.scale(15));
    }
    return this.position;
  }

  private getDefensivePosition(): Vector3 {
    // Find the direction of most threats
    const threatDirection = new Vector3(0, 0, 0);

    for (const target of this.targets.slice(0, 5)) {
      const dir = target.mesh.position.subtract(this.playerPosition).normalize();
      threatDirection.addInPlace(dir);
    }

    threatDirection.normalize();

    // Position between player and threats
    return this.playerPosition.add(threatDirection.scale(12));
  }

  private getRetreatPosition(): Vector3 {
    // Move behind player relative to threats
    if (this.targets.length === 0) return this.getIdlePosition();

    const threatDirection = this.targets[0].mesh.position.subtract(this.playerPosition);
    threatDirection.y = 0;
    threatDirection.normalize();

    return this.playerPosition.subtract(threatDirection.scale(15));
  }

  // ============================================================================
  // PRIVATE METHODS - COMBAT
  // ============================================================================

  private updateCombat(_deltaTime: number): void {
    if (this.state === 'repairing') return;
    if (this.state === 'downed') return;
    if (this.isReloading) return;

    // Check for coordinated attack target from coordinator
    let targetToEngage = this.currentTarget;
    if (this.coordinator) {
      const coordTarget = this.coordinator.getMarcusAssignedTarget();
      if (coordTarget) {
        // Use coordinated target if available
        targetToEngage = {
          entity: coordTarget.entity,
          mesh: coordTarget.mesh,
          priority: coordTarget.priority,
          lastSeenTime: performance.now(),
          threatLevel: coordTarget.priority > 80 ? 'critical' : 'medium',
        };
      }
    }

    if (!targetToEngage) return;

    const now = performance.now();
    const fireInterval = 1000 / this.config.fireRate;

    // Suppression mode fires faster but less accurately
    // Aggressive mode also fires slightly faster
    let adjustedInterval = fireInterval;
    if (this.state === 'suppression') {
      adjustedInterval = fireInterval * 0.6;
    } else if (this.coordinationCombatState === 'aggressive') {
      adjustedInterval = fireInterval * 0.8;
    }

    if (now - this.lastFireTime < adjustedInterval) return;

    // Check range
    const distToTarget = Vector3.Distance(this.position, targetToEngage.mesh.position);
    if (distToTarget > this.config.range) return;

    // Fire at the coordinated target
    this.lastFireTime = now;
    this.fireWeaponsAtTarget(targetToEngage.mesh.position);
  }

  /**
   * Fire weapons at a specific position
   */
  private fireWeaponsAtTarget(targetPosition: Vector3): void {
    const arms = [this.leftArm, this.rightArm];
    const finalTarget =
      this.state === 'suppression' && this.activeCoordinatedAttack
        ? this.activeCoordinatedAttack.targetPosition
        : targetPosition;

    for (const arm of arms) {
      // Get arm world position
      const startPos = arm.absolutePosition.clone();
      startPos.y -= 2;

      // Add some inaccuracy for suppression fire
      const adjustedTarget = finalTarget.clone();
      if (this.state === 'suppression') {
        adjustedTarget.x += (Math.random() - 0.5) * 5;
        adjustedTarget.z += (Math.random() - 0.5) * 5;
      }

      const direction = adjustedTarget.subtract(startPos).normalize();
      const velocity = direction.scale(60);

      // Create projectile
      const projectile = MeshBuilder.CreateSphere(
        `marcusProjectile_${Date.now()}`,
        { diameter: 0.6 },
        this.scene
      );
      projectile.position = startPos;

      const projMat = new StandardMaterial('marcusProjMat', this.scene);
      projMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.brass);
      projMat.disableLighting = true;
      projectile.material = projMat;

      // Arm recoil animation
      const recoilZ = arm.position.x < 0 ? 0.15 : -0.15;
      const restZ = arm.position.x < 0 ? 0.3 : -0.3;
      arm.rotation.z += recoilZ;
      setTimeout(() => {
        arm.rotation.z = restZ;
      }, 100);

      // Create projectile entity
      const projEntity = createEntity({
        transform: {
          position: startPos.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: velocity,
          angular: Vector3.Zero(),
          maxSpeed: 60,
        },
        renderable: {
          mesh: projectile,
          visible: true,
        },
        tags: {
          projectile: true,
          ally: true,
        },
        lifetime: {
          remaining: 3000,
          onExpire: () => {
            projectile.material?.dispose();
            projectile.dispose();
          },
        },
      });

      // Simple collision check after travel time
      const travelTime = Vector3.Distance(startPos, adjustedTarget) / 60;
      setTimeout(
        () => {
          if (!this.currentTarget || this.currentTarget.mesh.isDisposed()) {
            projectile.material?.dispose();
            projectile.dispose();
            removeEntity(projEntity);
            return;
          }

          const dist = Vector3.Distance(projectile.position, this.currentTarget.mesh.position);
          if (dist < 2) {
            // Hit - the level handles actual damage application
            this.damageDealt += this.config.damage;
          }

          projectile.material?.dispose();
          projectile.dispose();
          removeEntity(projEntity);
        },
        Math.max(100, travelTime * 1000)
      );
    }
  }

  private fireWeapons(): void {
    if (!this.currentTarget) return;

    const arms = [this.leftArm, this.rightArm];
    const targetPos =
      this.state === 'suppression' && this.activeCoordinatedAttack
        ? this.activeCoordinatedAttack.targetPosition
        : this.currentTarget.mesh.position;

    for (const arm of arms) {
      // Get arm world position
      const startPos = arm.absolutePosition.clone();
      startPos.y -= 2;

      // Add some inaccuracy for suppression fire
      const finalTarget = targetPos.clone();
      if (this.state === 'suppression') {
        finalTarget.x += (Math.random() - 0.5) * 5;
        finalTarget.z += (Math.random() - 0.5) * 5;
      }

      const direction = finalTarget.subtract(startPos).normalize();
      const velocity = direction.scale(60);

      // Create projectile
      const projectile = MeshBuilder.CreateSphere(
        `marcusProjectile_${Date.now()}`,
        { diameter: 0.6 },
        this.scene
      );
      projectile.position = startPos;

      const projMat = new StandardMaterial('marcusProjMat', this.scene);
      projMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.brass);
      projMat.disableLighting = true;
      projectile.material = projMat;

      // Arm recoil animation
      const recoilZ = arm.position.x < 0 ? 0.15 : -0.15;
      const restZ = arm.position.x < 0 ? 0.3 : -0.3;
      arm.rotation.z += recoilZ;
      setTimeout(() => {
        arm.rotation.z = restZ;
      }, 100);

      // Create projectile entity
      const projEntity = createEntity({
        transform: {
          position: startPos.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: velocity,
          angular: Vector3.Zero(),
          maxSpeed: 60,
        },
        renderable: {
          mesh: projectile,
          visible: true,
        },
        tags: {
          projectile: true,
          ally: true,
        },
        lifetime: {
          remaining: 3000,
          onExpire: () => {
            projectile.material?.dispose();
            projectile.dispose();
          },
        },
      });

      // Simple collision check after travel time
      const travelTime = Vector3.Distance(startPos, finalTarget) / 60;
      setTimeout(
        () => {
          if (!this.currentTarget || this.currentTarget.mesh.isDisposed()) {
            projectile.material?.dispose();
            projectile.dispose();
            removeEntity(projEntity);
            return;
          }

          const dist = Vector3.Distance(projectile.position, this.currentTarget.mesh.position);
          if (dist < 2) {
            // Hit - the level handles actual damage application
          }

          projectile.material?.dispose();
          projectile.dispose();
          removeEntity(projEntity);
        },
        Math.max(100, travelTime * 1000)
      );
    }
  }

  // ============================================================================
  // PRIVATE METHODS - REPAIR
  // ============================================================================

  private updateRepair(deltaTime: number): void {
    const repairAmount = this.config.repairRate * deltaTime;
    this.health = Math.min(this.config.maxHealth, this.health + repairAmount);
    this.callbacks.onMarcusHealthChange?.(this.health, this.config.maxHealth);

    // Announce repair progress periodically
    const elapsed = performance.now() - this.repairStartTime;
    if (elapsed > 3000 && elapsed < 3500) {
      // Halfway through typical repair
    }
  }

  // ============================================================================
  // PRIVATE METHODS - CALLOUTS
  // ============================================================================

  private sendCallout(category: keyof typeof COMBAT_CALLOUTS): void {
    const now = performance.now();
    const lastTime = this.lastCalloutTime.get(category) ?? 0;

    // Cooldown check (allow important callouts more frequently)
    const importantCategories = ['CRITICAL_DAMAGE', 'BRUTE_SPOTTED', 'PLAYER_DANGER'];
    const cooldown = importantCategories.includes(category)
      ? this.calloutCooldown / 2
      : this.calloutCooldown;

    if (now - lastTime < cooldown) return;

    this.lastCalloutTime.set(category, now);

    const callouts = COMBAT_CALLOUTS[category];
    const text = callouts[Math.floor(Math.random() * callouts.length)];

    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.targets = [];
    this.currentTarget = null;
    this.activeCoordinatedAttack = null;
    this.lastCalloutTime.clear();

    // Dispose coordinator
    if (this.coordinator) {
      this.coordinator.dispose();
      this.coordinator = null;
    }
  }
}
