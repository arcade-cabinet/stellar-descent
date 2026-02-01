/**
 * TriggerSystem - Robust trigger system for level scripting
 *
 * Provides multiple trigger types for gameplay events:
 * - Volume triggers (player enters area)
 * - Proximity triggers (get close to object)
 * - Interaction triggers (E key to interact)
 * - Line-of-sight triggers (look at something)
 * - Combat triggers (all enemies dead in area)
 * - Collectible triggers (pick up items)
 *
 * Integrates with EventBus for decoupled event handling.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { type GameEvent, getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';

const log = getLogger('TriggerSystem');

// ============================================================================
// TRIGGER EVENT TYPES
// ============================================================================

/**
 * Trigger-specific events that extend the GameEvent union.
 * These are emitted when triggers fire.
 */
export type TriggerEvent =
  | { type: 'TRIGGER_ENTER'; triggerId: string; triggerType: TriggerType }
  | { type: 'TRIGGER_EXIT'; triggerId: string; triggerType: TriggerType }
  | { type: 'TRIGGER_STAY'; triggerId: string; triggerType: TriggerType; duration: number }
  | { type: 'TRIGGER_INTERACT'; triggerId: string }
  | { type: 'TRIGGER_LINE_OF_SIGHT'; triggerId: string; targetPosition: Vector3 }
  | { type: 'TRIGGER_COMBAT_COMPLETE'; triggerId: string; enemiesKilled: number }
  | { type: 'TRIGGER_COLLECTIBLE'; triggerId: string; collectibleId: string }
  | { type: 'TRIGGER_GROUP_COMPLETE'; groupId: string; mode: 'all' | 'any' };

// ============================================================================
// TRIGGER TYPES
// ============================================================================

export type TriggerType =
  | 'volume'
  | 'proximity'
  | 'interaction'
  | 'line_of_sight'
  | 'combat'
  | 'collectible';

export type TriggerShape = 'box' | 'sphere' | 'cylinder';

export type TriggerState = 'idle' | 'active' | 'cooldown' | 'disabled' | 'completed';

// ============================================================================
// TRIGGER CONDITION TYPES
// ============================================================================

/**
 * Conditions that must be met for a trigger to fire.
 */
export interface TriggerCondition {
  /** Require a specific item in inventory */
  requiresItem?: string;
  /** Require a quest/flag state */
  requiresFlag?: string;
  /** Require minimum player health (0-100) */
  requiresMinHealth?: number;
  /** Require maximum player health (0-100) */
  requiresMaxHealth?: number;
  /** Require another trigger to have fired first */
  requiresTrigger?: string;
  /** Require all enemies in area to be dead (for combat triggers) */
  requiresEnemiesDead?: boolean;
  /** Custom condition function */
  customCondition?: () => boolean;
}

// ============================================================================
// TRIGGER CONFIGURATION
// ============================================================================

/**
 * Base configuration shared by all trigger types.
 */
export interface BaseTriggerConfig {
  /** Unique identifier for this trigger */
  id: string;
  /** Trigger type */
  type: TriggerType;
  /** World position of trigger center */
  position: Vector3;
  /** Whether trigger fires only once */
  oneShot: boolean;
  /** Whether trigger is currently enabled */
  enabled?: boolean;
  /** Cooldown in milliseconds between activations (ignored if oneShot) */
  cooldown?: number;
  /** Conditions that must be met for trigger to fire */
  conditions?: TriggerCondition;
  /** Debug visualization (shows trigger volume in editor/dev mode) */
  debugVisualize?: boolean;
  /** Tags for filtering/grouping */
  tags?: string[];
}

/**
 * Volume trigger - fires when player enters/exits/stays in area.
 */
export interface VolumeTriggerConfig extends BaseTriggerConfig {
  type: 'volume';
  /** Shape of the trigger volume */
  shape: TriggerShape;
  /** Size/radius of the volume */
  size: Vector3 | number; // Vector3 for box, number for sphere/cylinder radius
  /** Height for cylinder shape */
  height?: number;
  /** Callback when player enters */
  onEnter?: () => void;
  /** Callback when player exits */
  onExit?: () => void;
  /** Callback while player stays (called each frame) */
  onStay?: (deltaTime: number) => void;
}

/**
 * Proximity trigger - fires when player gets close to a point.
 */
export interface ProximityTriggerConfig extends BaseTriggerConfig {
  type: 'proximity';
  /** Radius at which trigger fires */
  radius: number;
  /** Optional: only fire when facing the trigger (dot product threshold) */
  requireFacing?: number; // 0.5 = roughly facing, 0.9 = looking directly at
  /** Callback when player enters proximity */
  onProximityEnter?: () => void;
  /** Callback when player exits proximity */
  onProximityExit?: () => void;
}

/**
 * Interaction trigger - fires when player presses interact key near object.
 */
export interface InteractionTriggerConfig extends BaseTriggerConfig {
  type: 'interaction';
  /** Radius within which interaction is possible */
  radius: number;
  /** Prompt text shown to player (e.g., "Press E to open") */
  promptText: string;
  /** Time required to complete interaction (ms, 0 = instant) */
  interactionTime?: number;
  /** Callback when interaction starts */
  onInteractionStart?: () => void;
  /** Callback when interaction completes */
  onInteract?: () => void;
  /** Callback if interaction is cancelled */
  onInteractionCancel?: () => void;
}

/**
 * Line-of-sight trigger - fires when player looks at something.
 */
export interface LineOfSightTriggerConfig extends BaseTriggerConfig {
  type: 'line_of_sight';
  /** Maximum distance for line of sight check */
  maxDistance: number;
  /** Target position or mesh to look at */
  targetPosition: Vector3;
  /** Angle threshold in radians (how precisely player must look) */
  angleThreshold?: number;
  /** Duration player must look (ms, 0 = instant) */
  lookDuration?: number;
  /** Callback when player starts looking */
  onLookStart?: () => void;
  /** Callback when look duration is met */
  onLook?: () => void;
  /** Callback when player looks away */
  onLookAway?: () => void;
}

/**
 * Combat trigger - fires when all enemies in area are dead.
 */
export interface CombatTriggerConfig extends BaseTriggerConfig {
  type: 'combat';
  /** Shape of the combat zone */
  shape: TriggerShape;
  /** Size of the zone */
  size: Vector3 | number;
  /** IDs of enemies that must be killed (if empty, checks all enemies in area) */
  enemyIds?: string[];
  /** Minimum enemies that must be killed */
  minKills?: number;
  /** Callback when all enemies are dead */
  onCombatComplete?: () => void;
  /** Callback for each enemy kill in the zone */
  onEnemyKilled?: (enemyId: string) => void;
}

/**
 * Collectible trigger - fires when specific items are picked up.
 */
export interface CollectibleTriggerConfig extends BaseTriggerConfig {
  type: 'collectible';
  /** IDs of collectibles that trigger this */
  collectibleIds: string[];
  /** How many collectibles must be picked up (default: all) */
  requiredCount?: number;
  /** Callback when a collectible is picked up */
  onCollect?: (collectibleId: string) => void;
  /** Callback when all required collectibles are collected */
  onAllCollected?: () => void;
}

/** Union of all trigger configs */
export type TriggerConfig =
  | VolumeTriggerConfig
  | ProximityTriggerConfig
  | InteractionTriggerConfig
  | LineOfSightTriggerConfig
  | CombatTriggerConfig
  | CollectibleTriggerConfig;

// ============================================================================
// TRIGGER STATE TRACKING
// ============================================================================

/**
 * Runtime state for a trigger instance.
 */
interface TriggerInstance {
  config: TriggerConfig;
  state: TriggerState;
  /** Whether player is currently inside (for volume/proximity) */
  playerInside: boolean;
  /** Time player entered (for stay duration tracking) */
  enterTime: number;
  /** Time of last activation (for cooldown) */
  lastActivationTime: number;
  /** Progress for timed interactions (0-1) */
  interactionProgress: number;
  /** Look duration accumulated (for line of sight) */
  lookDuration: number;
  /** Enemies killed in combat zone */
  killedEnemies: Set<string>;
  /** Collectibles collected */
  collectedItems: Set<string>;
  /** Debug visualization mesh */
  debugMesh?: Mesh;
}

// ============================================================================
// TRIGGER GROUP
// ============================================================================

/**
 * Group of triggers that fire together.
 */
export interface TriggerGroup {
  /** Group identifier */
  id: string;
  /** Trigger IDs in this group */
  triggerIds: string[];
  /** Mode: 'all' = all must complete, 'any' = any one completes the group */
  mode: 'all' | 'any';
  /** Callback when group condition is met */
  onGroupComplete?: () => void;
  /** Whether the group has completed */
  completed: boolean;
}

// ============================================================================
// TRIGGER SYSTEM CLASS
// ============================================================================

/**
 * Main trigger system class.
 * Manages all trigger instances and handles collision detection.
 */
export class TriggerSystem {
  private scene: Scene;
  private camera: Camera | null = null;
  private triggers: Map<string, TriggerInstance> = new Map();
  private groups: Map<string, TriggerGroup> = new Map();
  private completedTriggers: Set<string> = new Set();
  private activeTriggers: Set<string> = new Set();
  private debugMode = false;

  // Game state accessors (set by level)
  private playerPositionGetter: (() => Vector3) | null = null;
  private playerHealthGetter: (() => number) | null = null;
  private playerInventoryChecker: ((itemId: string) => boolean) | null = null;
  private flagChecker: ((flagId: string) => boolean) | null = null;
  private enemyPositionGetter:
    | (() => Array<{ id: string; position: Vector3; alive: boolean }>)
    | null = null;
  private interactKeyChecker: (() => boolean) | null = null;

  // Debug materials
  private debugMaterialActive: StandardMaterial | null = null;
  private debugMaterialInactive: StandardMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initDebugMaterials();
    log.info('TriggerSystem initialized');
  }

  // ============================================================================
  // INITIALIZATION & CONFIGURATION
  // ============================================================================

  /**
   * Set the camera for line-of-sight checks.
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Set the function to get player position.
   */
  setPlayerPositionGetter(getter: () => Vector3): void {
    this.playerPositionGetter = getter;
  }

  /**
   * Set the function to get player health.
   */
  setPlayerHealthGetter(getter: () => number): void {
    this.playerHealthGetter = getter;
  }

  /**
   * Set the function to check player inventory.
   */
  setPlayerInventoryChecker(checker: (itemId: string) => boolean): void {
    this.playerInventoryChecker = checker;
  }

  /**
   * Set the function to check game flags.
   */
  setFlagChecker(checker: (flagId: string) => boolean): void {
    this.flagChecker = checker;
  }

  /**
   * Set the function to get enemy positions.
   */
  setEnemyPositionGetter(
    getter: () => Array<{ id: string; position: Vector3; alive: boolean }>
  ): void {
    this.enemyPositionGetter = getter;
  }

  /**
   * Set the function to check if interact key is pressed.
   */
  setInteractKeyChecker(checker: () => boolean): void {
    this.interactKeyChecker = checker;
  }

  /**
   * Enable/disable debug visualization.
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    // Update existing trigger visualizations
    for (const [_id, instance] of this.triggers) {
      if (instance.debugMesh) {
        instance.debugMesh.setEnabled(enabled);
      } else if (enabled && instance.config.debugVisualize !== false) {
        this.createDebugMesh(instance);
      }
    }
    log.info(`Debug mode: ${enabled}`);
  }

  private initDebugMaterials(): void {
    this.debugMaterialActive = new StandardMaterial('trigger_debug_active', this.scene);
    this.debugMaterialActive.diffuseColor = new Color3(0, 1, 0);
    this.debugMaterialActive.emissiveColor = new Color3(0, 0.3, 0);
    this.debugMaterialActive.alpha = 0.3;
    this.debugMaterialActive.wireframe = true;

    this.debugMaterialInactive = new StandardMaterial('trigger_debug_inactive', this.scene);
    this.debugMaterialInactive.diffuseColor = new Color3(1, 1, 0);
    this.debugMaterialInactive.emissiveColor = new Color3(0.3, 0.3, 0);
    this.debugMaterialInactive.alpha = 0.2;
    this.debugMaterialInactive.wireframe = true;
  }

  // ============================================================================
  // TRIGGER CREATION
  // ============================================================================

  /**
   * Create a new trigger from configuration.
   * This is the main API for levels to create triggers.
   *
   * @example
   * ```typescript
   * triggerSystem.createTrigger({
   *   id: 'boss_room_enter',
   *   type: 'volume',
   *   position: new Vector3(0, 0, 50),
   *   shape: 'sphere',
   *   size: 5,
   *   oneShot: true,
   *   onEnter: () => startBossFight()
   * });
   * ```
   */
  createTrigger(config: TriggerConfig): void {
    if (this.triggers.has(config.id)) {
      log.warn(`Trigger with id "${config.id}" already exists, replacing`);
      this.removeTrigger(config.id);
    }

    const instance: TriggerInstance = {
      config,
      state: config.enabled === false ? 'disabled' : 'idle',
      playerInside: false,
      enterTime: 0,
      lastActivationTime: 0,
      interactionProgress: 0,
      lookDuration: 0,
      killedEnemies: new Set(),
      collectedItems: new Set(),
    };

    this.triggers.set(config.id, instance);

    // Create debug visualization if enabled
    if (this.debugMode || config.debugVisualize) {
      this.createDebugMesh(instance);
    }

    log.info(`Created trigger "${config.id}" of type "${config.type}"`);
  }

  /**
   * Create multiple triggers at once.
   */
  createTriggers(configs: TriggerConfig[]): void {
    for (const config of configs) {
      this.createTrigger(config);
    }
  }

  /**
   * Remove a trigger by ID.
   */
  removeTrigger(id: string): void {
    const instance = this.triggers.get(id);
    if (instance) {
      if (instance.debugMesh) {
        instance.debugMesh.dispose();
      }
      this.triggers.delete(id);
      this.activeTriggers.delete(id);
      log.info(`Removed trigger "${id}"`);
    }
  }

  /**
   * Remove all triggers.
   */
  clearTriggers(): void {
    for (const [_id, instance] of this.triggers) {
      if (instance.debugMesh) {
        instance.debugMesh.dispose();
      }
    }
    this.triggers.clear();
    this.activeTriggers.clear();
    this.completedTriggers.clear();
    this.groups.clear();
    log.info('Cleared all triggers');
  }

  // ============================================================================
  // TRIGGER GROUPS
  // ============================================================================

  /**
   * Create a trigger group.
   * Groups allow you to fire an event when multiple triggers complete.
   *
   * @example
   * ```typescript
   * triggerSystem.createGroup({
   *   id: 'all_switches_activated',
   *   triggerIds: ['switch_1', 'switch_2', 'switch_3'],
   *   mode: 'all',
   *   onGroupComplete: () => openDoor()
   * });
   * ```
   */
  createGroup(config: Omit<TriggerGroup, 'completed'>): void {
    this.groups.set(config.id, {
      ...config,
      completed: false,
    });
    log.info(`Created trigger group "${config.id}" with ${config.triggerIds.length} triggers`);
  }

  /**
   * Check if a group is complete.
   */
  isGroupComplete(groupId: string): boolean {
    const group = this.groups.get(groupId);
    return group?.completed ?? false;
  }

  // ============================================================================
  // TRIGGER STATE MANAGEMENT
  // ============================================================================

  /**
   * Enable a trigger.
   */
  enableTrigger(id: string): void {
    const instance = this.triggers.get(id);
    if (instance && instance.state === 'disabled') {
      instance.state = 'idle';
      log.info(`Enabled trigger "${id}"`);
    }
  }

  /**
   * Disable a trigger.
   */
  disableTrigger(id: string): void {
    const instance = this.triggers.get(id);
    if (instance) {
      instance.state = 'disabled';
      instance.playerInside = false;
      this.activeTriggers.delete(id);
      log.info(`Disabled trigger "${id}"`);
    }
  }

  /**
   * Reset a trigger (allows it to fire again even if oneShot).
   */
  resetTrigger(id: string): void {
    const instance = this.triggers.get(id);
    if (instance) {
      instance.state = 'idle';
      instance.playerInside = false;
      instance.interactionProgress = 0;
      instance.lookDuration = 0;
      instance.killedEnemies.clear();
      instance.collectedItems.clear();
      this.completedTriggers.delete(id);
      this.activeTriggers.delete(id);
      log.info(`Reset trigger "${id}"`);
    }
  }

  /**
   * Check if a trigger has completed (for oneShot triggers).
   */
  isTriggerComplete(id: string): boolean {
    return this.completedTriggers.has(id);
  }

  /**
   * Get all active triggers (player currently inside).
   */
  getActiveTriggers(): string[] {
    return Array.from(this.activeTriggers);
  }

  /**
   * Get trigger state.
   */
  getTriggerState(id: string): TriggerState | null {
    return this.triggers.get(id)?.state ?? null;
  }

  // ============================================================================
  // EXTERNAL EVENT NOTIFICATIONS
  // ============================================================================

  /**
   * Notify the trigger system that an enemy was killed.
   * Call this from combat system when enemies die.
   */
  notifyEnemyKilled(enemyId: string, position: Vector3): void {
    for (const [id, instance] of this.triggers) {
      if (instance.config.type !== 'combat') continue;
      if (instance.state === 'disabled' || instance.state === 'completed') continue;

      const config = instance.config as CombatTriggerConfig;

      // Check if enemy is in the combat zone
      if (this.isPointInTrigger(position, config)) {
        instance.killedEnemies.add(enemyId);

        // Fire per-kill callback
        config.onEnemyKilled?.(enemyId);

        log.debug(`Enemy "${enemyId}" killed in combat zone "${id}"`);
      }
    }
  }

  /**
   * Notify the trigger system that a collectible was picked up.
   * Call this from collectible system when items are collected.
   */
  notifyCollectiblePickedUp(collectibleId: string): void {
    for (const [id, instance] of this.triggers) {
      if (instance.config.type !== 'collectible') continue;
      if (instance.state === 'disabled' || instance.state === 'completed') continue;

      const config = instance.config as CollectibleTriggerConfig;

      if (config.collectibleIds.includes(collectibleId)) {
        instance.collectedItems.add(collectibleId);

        // Fire per-collect callback
        config.onCollect?.(collectibleId);

        // Emit event
        this.emitTriggerEvent({
          type: 'TRIGGER_COLLECTIBLE',
          triggerId: id,
          collectibleId,
        });

        log.debug(`Collectible "${collectibleId}" picked up for trigger "${id}"`);
      }
    }
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update all triggers. Call this each frame from the level update loop.
   *
   * @param deltaTime Time since last frame in seconds
   */
  update(deltaTime: number): void {
    const playerPos = this.playerPositionGetter?.();
    if (!playerPos) return;

    const now = performance.now();

    for (const [_id, instance] of this.triggers) {
      // Skip disabled or completed triggers
      if (instance.state === 'disabled' || instance.state === 'completed') {
        continue;
      }

      // Handle cooldown
      if (instance.state === 'cooldown') {
        const cooldown = instance.config.cooldown ?? 0;
        if (now - instance.lastActivationTime >= cooldown) {
          instance.state = 'idle';
        } else {
          continue;
        }
      }

      // Check conditions
      if (!this.checkConditions(instance.config.conditions)) {
        continue;
      }

      // Update based on trigger type
      switch (instance.config.type) {
        case 'volume':
          this.updateVolumeTrigger(instance, playerPos, deltaTime, now);
          break;
        case 'proximity':
          this.updateProximityTrigger(instance, playerPos, now);
          break;
        case 'interaction':
          this.updateInteractionTrigger(instance, playerPos, deltaTime, now);
          break;
        case 'line_of_sight':
          this.updateLineOfSightTrigger(instance, deltaTime, now);
          break;
        case 'combat':
          this.updateCombatTrigger(instance, now);
          break;
        case 'collectible':
          this.updateCollectibleTrigger(instance, now);
          break;
      }

      // Update debug mesh color
      if (instance.debugMesh) {
        instance.debugMesh.material =
          instance.playerInside || instance.state === 'active'
            ? this.debugMaterialActive
            : this.debugMaterialInactive;
      }
    }

    // Check trigger groups
    this.updateGroups();
  }

  // ============================================================================
  // TRIGGER TYPE UPDATE METHODS
  // ============================================================================

  private updateVolumeTrigger(
    instance: TriggerInstance,
    playerPos: Vector3,
    deltaTime: number,
    now: number
  ): void {
    const config = instance.config as VolumeTriggerConfig;
    const wasInside = instance.playerInside;
    const isInside = this.isPointInTrigger(playerPos, config);

    instance.playerInside = isInside;

    if (isInside && !wasInside) {
      // Player entered
      instance.enterTime = now;
      instance.state = 'active';
      this.activeTriggers.add(config.id);

      config.onEnter?.();
      this.emitTriggerEvent({
        type: 'TRIGGER_ENTER',
        triggerId: config.id,
        triggerType: 'volume',
      });

      log.debug(`Player entered volume trigger "${config.id}"`);

      if (config.oneShot && !config.onStay) {
        this.completeTrigger(instance, now);
      }
    } else if (!isInside && wasInside) {
      // Player exited
      this.activeTriggers.delete(config.id);
      instance.state = 'idle';

      config.onExit?.();
      this.emitTriggerEvent({
        type: 'TRIGGER_EXIT',
        triggerId: config.id,
        triggerType: 'volume',
      });

      log.debug(`Player exited volume trigger "${config.id}"`);
    } else if (isInside) {
      // Player staying inside
      const duration = now - instance.enterTime;

      config.onStay?.(deltaTime);
      this.emitTriggerEvent({
        type: 'TRIGGER_STAY',
        triggerId: config.id,
        triggerType: 'volume',
        duration,
      });
    }
  }

  private updateProximityTrigger(instance: TriggerInstance, playerPos: Vector3, now: number): void {
    const config = instance.config as ProximityTriggerConfig;
    const distance = Vector3.Distance(playerPos, config.position);
    const wasInside = instance.playerInside;
    let isInside = distance <= config.radius;

    // Check facing requirement
    if (isInside && config.requireFacing !== undefined && this.camera) {
      const toTrigger = config.position.subtract(playerPos).normalize();
      const forward = this.camera.getDirection(Vector3.Forward());
      const dot = Vector3.Dot(forward, toTrigger);
      isInside = dot >= config.requireFacing;
    }

    instance.playerInside = isInside;

    if (isInside && !wasInside) {
      instance.state = 'active';
      this.activeTriggers.add(config.id);

      config.onProximityEnter?.();
      this.emitTriggerEvent({
        type: 'TRIGGER_ENTER',
        triggerId: config.id,
        triggerType: 'proximity',
      });

      log.debug(`Player entered proximity trigger "${config.id}"`);

      if (config.oneShot) {
        this.completeTrigger(instance, now);
      }
    } else if (!isInside && wasInside) {
      this.activeTriggers.delete(config.id);
      instance.state = 'idle';

      config.onProximityExit?.();
      this.emitTriggerEvent({
        type: 'TRIGGER_EXIT',
        triggerId: config.id,
        triggerType: 'proximity',
      });

      log.debug(`Player exited proximity trigger "${config.id}"`);
    }
  }

  private updateInteractionTrigger(
    instance: TriggerInstance,
    playerPos: Vector3,
    deltaTime: number,
    now: number
  ): void {
    const config = instance.config as InteractionTriggerConfig;
    const distance = Vector3.Distance(playerPos, config.position);
    const inRange = distance <= config.radius;
    const interactPressed = this.interactKeyChecker?.() ?? false;

    instance.playerInside = inRange;

    if (inRange) {
      this.activeTriggers.add(config.id);

      if (interactPressed) {
        const interactionTime = config.interactionTime ?? 0;

        if (instance.interactionProgress === 0) {
          // Start interaction
          config.onInteractionStart?.();
          instance.state = 'active';
        }

        if (interactionTime > 0) {
          // Timed interaction
          instance.interactionProgress += (deltaTime * 1000) / interactionTime;

          if (instance.interactionProgress >= 1) {
            // Interaction complete
            instance.interactionProgress = 0;
            config.onInteract?.();
            this.emitTriggerEvent({
              type: 'TRIGGER_INTERACT',
              triggerId: config.id,
            });

            log.debug(`Interaction complete for trigger "${config.id}"`);

            if (config.oneShot) {
              this.completeTrigger(instance, now);
            } else {
              instance.state = 'cooldown';
              instance.lastActivationTime = now;
            }
          }
        } else {
          // Instant interaction
          config.onInteract?.();
          this.emitTriggerEvent({
            type: 'TRIGGER_INTERACT',
            triggerId: config.id,
          });

          log.debug(`Instant interaction for trigger "${config.id}"`);

          if (config.oneShot) {
            this.completeTrigger(instance, now);
          } else {
            instance.state = 'cooldown';
            instance.lastActivationTime = now;
          }
        }
      } else if (instance.interactionProgress > 0) {
        // Interaction cancelled
        config.onInteractionCancel?.();
        instance.interactionProgress = 0;
        instance.state = 'idle';
      }
    } else {
      this.activeTriggers.delete(config.id);
      if (instance.interactionProgress > 0) {
        config.onInteractionCancel?.();
        instance.interactionProgress = 0;
      }
      instance.state = 'idle';
    }
  }

  private updateLineOfSightTrigger(
    instance: TriggerInstance,
    deltaTime: number,
    now: number
  ): void {
    if (!this.camera) return;

    const config = instance.config as LineOfSightTriggerConfig;
    const cameraPos = this.camera.position;
    const forward = this.camera.getDirection(Vector3.Forward());
    const toTarget = config.targetPosition.subtract(cameraPos);
    const distance = toTarget.length();

    // Check distance
    if (distance > config.maxDistance) {
      if (instance.lookDuration > 0) {
        config.onLookAway?.();
        instance.lookDuration = 0;
        instance.state = 'idle';
      }
      return;
    }

    // Check angle
    const angleThreshold = config.angleThreshold ?? 0.1; // ~5.7 degrees
    const toTargetNorm = toTarget.normalize();
    const dot = Vector3.Dot(forward, toTargetNorm);
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

    const isLooking = angle <= angleThreshold;

    if (isLooking) {
      if (instance.lookDuration === 0) {
        // Started looking
        config.onLookStart?.();
        instance.state = 'active';
        this.activeTriggers.add(config.id);
      }

      const lookDuration = config.lookDuration ?? 0;
      instance.lookDuration += deltaTime * 1000;

      if (lookDuration === 0 || instance.lookDuration >= lookDuration) {
        // Look requirement met
        config.onLook?.();
        this.emitTriggerEvent({
          type: 'TRIGGER_LINE_OF_SIGHT',
          triggerId: config.id,
          targetPosition: config.targetPosition.clone(),
        });

        log.debug(`Line of sight trigger "${config.id}" fired`);

        if (config.oneShot) {
          this.completeTrigger(instance, now);
        } else {
          instance.state = 'cooldown';
          instance.lastActivationTime = now;
          instance.lookDuration = 0;
        }
      }
    } else if (instance.lookDuration > 0) {
      // Stopped looking
      config.onLookAway?.();
      instance.lookDuration = 0;
      instance.state = 'idle';
      this.activeTriggers.delete(config.id);
    }
  }

  private updateCombatTrigger(instance: TriggerInstance, now: number): void {
    const config = instance.config as CombatTriggerConfig;

    // Check if specific enemies are required
    if (config.enemyIds && config.enemyIds.length > 0) {
      const allDead = config.enemyIds.every((id) => instance.killedEnemies.has(id));
      if (allDead) {
        config.onCombatComplete?.();
        this.emitTriggerEvent({
          type: 'TRIGGER_COMBAT_COMPLETE',
          triggerId: config.id,
          enemiesKilled: instance.killedEnemies.size,
        });

        log.info(`Combat trigger "${config.id}" complete: all required enemies dead`);
        this.completeTrigger(instance, now);
      }
    } else if (config.minKills !== undefined) {
      // Check minimum kills
      if (instance.killedEnemies.size >= config.minKills) {
        // Also verify no living enemies in zone
        const enemies = this.enemyPositionGetter?.() ?? [];
        const livingInZone = enemies.filter(
          (e) => e.alive && this.isPointInTrigger(e.position, config)
        );

        if (livingInZone.length === 0) {
          config.onCombatComplete?.();
          this.emitTriggerEvent({
            type: 'TRIGGER_COMBAT_COMPLETE',
            triggerId: config.id,
            enemiesKilled: instance.killedEnemies.size,
          });

          log.info(`Combat trigger "${config.id}" complete: min kills reached and zone clear`);
          this.completeTrigger(instance, now);
        }
      }
    } else {
      // Check if all enemies in zone are dead
      const enemies = this.enemyPositionGetter?.() ?? [];
      const livingInZone = enemies.filter(
        (e) => e.alive && this.isPointInTrigger(e.position, config)
      );

      if (livingInZone.length === 0 && instance.killedEnemies.size > 0) {
        config.onCombatComplete?.();
        this.emitTriggerEvent({
          type: 'TRIGGER_COMBAT_COMPLETE',
          triggerId: config.id,
          enemiesKilled: instance.killedEnemies.size,
        });

        log.info(`Combat trigger "${config.id}" complete: all enemies in zone dead`);
        this.completeTrigger(instance, now);
      }
    }
  }

  private updateCollectibleTrigger(instance: TriggerInstance, now: number): void {
    const config = instance.config as CollectibleTriggerConfig;
    const requiredCount = config.requiredCount ?? config.collectibleIds.length;

    if (instance.collectedItems.size >= requiredCount) {
      config.onAllCollected?.();

      log.info(
        `Collectible trigger "${config.id}" complete: ${instance.collectedItems.size} items collected`
      );
      this.completeTrigger(instance, now);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private completeTrigger(instance: TriggerInstance, now: number): void {
    instance.state = 'completed';
    instance.playerInside = false;
    this.completedTriggers.add(instance.config.id);
    this.activeTriggers.delete(instance.config.id);

    if (!instance.config.oneShot && instance.config.cooldown) {
      instance.state = 'cooldown';
      instance.lastActivationTime = now;
    }

    log.debug(`Trigger "${instance.config.id}" completed`);
  }

  private checkConditions(conditions?: TriggerCondition): boolean {
    if (!conditions) return true;

    if (conditions.requiresItem && this.playerInventoryChecker) {
      if (!this.playerInventoryChecker(conditions.requiresItem)) {
        return false;
      }
    }

    if (conditions.requiresFlag && this.flagChecker) {
      if (!this.flagChecker(conditions.requiresFlag)) {
        return false;
      }
    }

    if (conditions.requiresMinHealth !== undefined && this.playerHealthGetter) {
      if (this.playerHealthGetter() < conditions.requiresMinHealth) {
        return false;
      }
    }

    if (conditions.requiresMaxHealth !== undefined && this.playerHealthGetter) {
      if (this.playerHealthGetter() > conditions.requiresMaxHealth) {
        return false;
      }
    }

    if (conditions.requiresTrigger) {
      if (!this.completedTriggers.has(conditions.requiresTrigger)) {
        return false;
      }
    }

    if (conditions.customCondition) {
      if (!conditions.customCondition()) {
        return false;
      }
    }

    return true;
  }

  private isPointInTrigger(
    point: Vector3,
    config: VolumeTriggerConfig | CombatTriggerConfig | ProximityTriggerConfig
  ): boolean {
    if (config.type === 'proximity') {
      const dist = Vector3.Distance(point, config.position);
      return dist <= (config as ProximityTriggerConfig).radius;
    }

    const volumeConfig = config as VolumeTriggerConfig | CombatTriggerConfig;
    const pos = volumeConfig.position;

    switch (volumeConfig.shape) {
      case 'sphere': {
        const radius =
          typeof volumeConfig.size === 'number' ? volumeConfig.size : volumeConfig.size.x;
        return Vector3.Distance(point, pos) <= radius;
      }
      case 'box': {
        const size =
          typeof volumeConfig.size === 'number'
            ? new Vector3(volumeConfig.size, volumeConfig.size, volumeConfig.size)
            : volumeConfig.size;
        const halfSize = size.scale(0.5);
        return (
          point.x >= pos.x - halfSize.x &&
          point.x <= pos.x + halfSize.x &&
          point.y >= pos.y - halfSize.y &&
          point.y <= pos.y + halfSize.y &&
          point.z >= pos.z - halfSize.z &&
          point.z <= pos.z + halfSize.z
        );
      }
      case 'cylinder': {
        const radius =
          typeof volumeConfig.size === 'number' ? volumeConfig.size : volumeConfig.size.x;
        const height =
          (volumeConfig as VolumeTriggerConfig).height ??
          (typeof volumeConfig.size === 'number' ? volumeConfig.size * 2 : volumeConfig.size.y);
        const halfHeight = height / 2;
        const horizontalDist = Math.sqrt((point.x - pos.x) ** 2 + (point.z - pos.z) ** 2);
        return (
          horizontalDist <= radius && point.y >= pos.y - halfHeight && point.y <= pos.y + halfHeight
        );
      }
      default:
        return false;
    }
  }

  private updateGroups(): void {
    for (const [groupId, group] of this.groups) {
      if (group.completed) continue;

      const triggerStates = group.triggerIds.map((id) => this.completedTriggers.has(id));

      const isComplete =
        group.mode === 'all' ? triggerStates.every((s) => s) : triggerStates.some((s) => s);

      if (isComplete) {
        group.completed = true;
        group.onGroupComplete?.();

        this.emitTriggerEvent({
          type: 'TRIGGER_GROUP_COMPLETE',
          groupId,
          mode: group.mode,
        });

        log.info(`Trigger group "${groupId}" completed`);
      }
    }
  }

  // ============================================================================
  // DEBUG VISUALIZATION
  // ============================================================================

  private createDebugMesh(instance: TriggerInstance): void {
    const config = instance.config;
    let mesh: Mesh | null = null;

    if (config.type === 'volume' || config.type === 'combat') {
      const volumeConfig = config as VolumeTriggerConfig | CombatTriggerConfig;

      switch (volumeConfig.shape) {
        case 'sphere': {
          const radius =
            typeof volumeConfig.size === 'number' ? volumeConfig.size : volumeConfig.size.x;
          mesh = MeshBuilder.CreateSphere(
            `trigger_debug_${config.id}`,
            { diameter: radius * 2, segments: 12 },
            this.scene
          );
          break;
        }
        case 'box': {
          const size =
            typeof volumeConfig.size === 'number'
              ? new Vector3(volumeConfig.size, volumeConfig.size, volumeConfig.size)
              : volumeConfig.size;
          mesh = MeshBuilder.CreateBox(
            `trigger_debug_${config.id}`,
            { width: size.x, height: size.y, depth: size.z },
            this.scene
          );
          break;
        }
        case 'cylinder': {
          const radius =
            typeof volumeConfig.size === 'number' ? volumeConfig.size : volumeConfig.size.x;
          const height =
            (volumeConfig as VolumeTriggerConfig).height ??
            (typeof volumeConfig.size === 'number' ? volumeConfig.size * 2 : volumeConfig.size.y);
          mesh = MeshBuilder.CreateCylinder(
            `trigger_debug_${config.id}`,
            { diameter: radius * 2, height, tessellation: 12 },
            this.scene
          );
          break;
        }
      }
    } else if (config.type === 'proximity' || config.type === 'interaction') {
      const radius = (config as ProximityTriggerConfig | InteractionTriggerConfig).radius;
      mesh = MeshBuilder.CreateSphere(
        `trigger_debug_${config.id}`,
        { diameter: radius * 2, segments: 12 },
        this.scene
      );
    } else if (config.type === 'line_of_sight') {
      // Create a line from camera to target
      const _losConfig = config as LineOfSightTriggerConfig;
      mesh = MeshBuilder.CreateSphere(
        `trigger_debug_${config.id}`,
        { diameter: 1, segments: 8 },
        this.scene
      );
    }

    if (mesh) {
      mesh.position = config.position.clone();
      mesh.material = this.debugMaterialInactive;
      mesh.isPickable = false;
      mesh.setEnabled(this.debugMode);
      instance.debugMesh = mesh;
    }
  }

  // ============================================================================
  // EVENT EMISSION
  // ============================================================================

  private emitTriggerEvent(event: TriggerEvent): void {
    // Cast to GameEvent for EventBus compatibility
    // In production, you'd extend the GameEvent union in EventBus.ts
    getEventBus().emit(event as unknown as GameEvent);
  }

  // ============================================================================
  // DISPOSAL
  // ============================================================================

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.clearTriggers();

    this.debugMaterialActive?.dispose();
    this.debugMaterialInactive?.dispose();
    this.debugMaterialActive = null;
    this.debugMaterialInactive = null;

    this.camera = null;
    this.playerPositionGetter = null;
    this.playerHealthGetter = null;
    this.playerInventoryChecker = null;
    this.flagChecker = null;
    this.enemyPositionGetter = null;
    this.interactKeyChecker = null;

    log.info('TriggerSystem disposed');
  }
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let instance: TriggerSystem | null = null;

/**
 * Get the TriggerSystem singleton for a scene.
 * Creates a new instance if one doesn't exist.
 */
export function getTriggerSystem(scene: Scene): TriggerSystem {
  if (!instance) {
    instance = new TriggerSystem(scene);
  }
  return instance;
}

/**
 * Dispose the TriggerSystem singleton.
 */
export function disposeTriggerSystem(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}

// ============================================================================
// CONVENIENCE FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a simple volume trigger with minimal configuration.
 */
export function createVolumeTrigger(
  id: string,
  position: Vector3,
  radius: number,
  onEnter: () => void,
  options?: Partial<VolumeTriggerConfig>
): VolumeTriggerConfig {
  return {
    id,
    type: 'volume',
    position,
    shape: 'sphere',
    size: radius,
    oneShot: true,
    onEnter,
    ...options,
  };
}

/**
 * Create a simple interaction trigger.
 */
export function createInteractionTrigger(
  id: string,
  position: Vector3,
  radius: number,
  promptText: string,
  onInteract: () => void,
  options?: Partial<InteractionTriggerConfig>
): InteractionTriggerConfig {
  return {
    id,
    type: 'interaction',
    position,
    radius,
    promptText,
    oneShot: true,
    onInteract,
    ...options,
  };
}

/**
 * Create a combat trigger that fires when all enemies are dead.
 */
export function createCombatTrigger(
  id: string,
  position: Vector3,
  radius: number,
  onCombatComplete: () => void,
  options?: Partial<CombatTriggerConfig>
): CombatTriggerConfig {
  return {
    id,
    type: 'combat',
    position,
    shape: 'sphere',
    size: radius,
    oneShot: true,
    onCombatComplete,
    ...options,
  };
}

/**
 * Create a line-of-sight trigger.
 */
export function createLineOfSightTrigger(
  id: string,
  position: Vector3,
  targetPosition: Vector3,
  maxDistance: number,
  onLook: () => void,
  options?: Partial<LineOfSightTriggerConfig>
): LineOfSightTriggerConfig {
  return {
    id,
    type: 'line_of_sight',
    position,
    targetPosition,
    maxDistance,
    oneShot: true,
    onLook,
    ...options,
  };
}
