/**
 * MarcusSteeringAI - YukaAI steering behaviors for Marcus's Titan mech
 *
 * Implements proper steering behaviors from the Yuka library:
 * - ArriveBehavior: Smooth deceleration when approaching destinations
 * - SeekBehavior: Direct movement toward targets
 * - WanderBehavior: Organic idle movement patterns
 * - OffsetPursuitBehavior: Following player while maintaining formation
 * - SeparationBehavior: Avoiding collision with player
 *
 * NAVMESH PATHFINDING:
 * - NavMesh integration for scouting missions
 * - A* path planning through navigation mesh regions
 * - Path smoothing for natural movement
 * - Dynamic obstacle avoidance during pathfinding
 *
 * SCOUTING COMMANDS:
 * - SCOUT: Marcus pathfinds to distant position
 * - FLANK: Marcus finds alternate path around enemies
 * - REGROUP: Marcus pathfinds back to player
 *
 * INTEGRATION:
 * - Works with SquadCommandSystem for command-driven behavior
 * - Provides movement vectors to MarcusCombatAI
 * - Enables coordinated combat with player (flanking, target sharing)
 *
 * COORDINATED COMBAT:
 * - Flanks opposite side from player when engaging enemies
 * - Prioritizes targets marked by player crosshair
 * - Calls out targeting for tactical awareness
 */

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import {
  ArriveBehavior,
  EntityManager,
  FollowPathBehavior,
  NavMesh,
  OffsetPursuitBehavior,
  Path,
  SeekBehavior,
  SeparationBehavior,
  Vehicle,
  Vector3 as YukaVector3,
  WanderBehavior,
} from 'yuka';
import type { Entity } from '../core/ecs';
import type { SquadCommand, SquadCommandData } from './SquadCommandSystem';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SteeringMode =
  | 'idle'
  | 'follow'
  | 'hold'
  | 'attack'
  | 'suppression'
  | 'regroup'
  | 'flank'
  | 'scout' // Scouting to distant position
  | 'scout_flank' // Finding alternate route around enemies
  | 'pathfinding'; // Following calculated path

export interface MarcusSteeringConfig {
  maxSpeed: number;
  maxForce: number;
  arrivalTolerance: number;
  followDistance: number;
  separationRadius: number;
  separationWeight: number;
  wanderRadius: number;
  wanderDistance: number;
  wanderJitter: number;
  flankDistance: number;
  flankAngle: number;
}

export interface FlankingState {
  isActive: boolean;
  targetPosition: BabylonVector3;
  playerSide: 'left' | 'right';
  calculatedAt: number;
}

export interface PathfindingState {
  isActive: boolean;
  path: Path | null;
  currentWaypointIndex: number;
  destination: BabylonVector3 | null;
  calculatedAt: number;
  pathType: 'direct' | 'scout' | 'flank' | 'regroup';
}

export interface TargetCallout {
  entityId: string;
  calledAt: number;
  type: 'engaging' | 'switching' | 'priority';
}

export interface SteeringResult {
  velocity: BabylonVector3;
  facingDirection: BabylonVector3;
  mode: SteeringMode;
  isMoving: boolean;
  /** Current path waypoints for visualization (if pathfinding) */
  pathWaypoints?: BabylonVector3[];
  /** Progress along path (0-1) */
  pathProgress?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: MarcusSteeringConfig = {
  maxSpeed: 12,
  maxForce: 15,
  arrivalTolerance: 3,
  followDistance: 15,
  separationRadius: 8,
  separationWeight: 2.5,
  wanderRadius: 3,
  wanderDistance: 8,
  wanderJitter: 0.5,
  flankDistance: 20,
  flankAngle: Math.PI / 3, // 60 degrees
};

const REGROUP_SPEED_MULTIPLIER = 1.5;
const FLANK_RECALCULATION_INTERVAL = 2000; // ms
const TARGET_CALLOUT_COOLDOWN = 4000; // ms

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toYuka(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}

function toBabylon(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}

// ============================================================================
// MARCUS STEERING AI CLASS
// ============================================================================

export class MarcusSteeringAI {
  private entityManager: EntityManager;
  private marcusVehicle: Vehicle;
  private playerVehicle: Vehicle;
  private config: MarcusSteeringConfig;

  // Current state
  private steeringMode: SteeringMode = 'idle';
  private position: BabylonVector3;
  private facingDirection: BabylonVector3 = BabylonVector3.Forward();

  // Player tracking
  private playerPosition: BabylonVector3 = BabylonVector3.Zero();
  private playerForward: BabylonVector3 = BabylonVector3.Forward();
  private playerVelocity: BabylonVector3 = BabylonVector3.Zero();

  // Behaviors (cached for performance)
  private arriveBehavior: ArriveBehavior | null = null;
  private seekBehavior: SeekBehavior | null = null;
  private wanderBehavior: WanderBehavior | null = null;
  private offsetPursuitBehavior: OffsetPursuitBehavior | null = null;
  private separationBehavior: SeparationBehavior | null = null;

  // Flanking state
  private flankingState: FlankingState = {
    isActive: false,
    targetPosition: BabylonVector3.Zero(),
    playerSide: 'left',
    calculatedAt: 0,
  };

  // Target coordination
  private currentTarget: Entity | null = null;
  private playerMarkedTarget: Entity | null = null;
  private lastTargetCallout: TargetCallout | null = null;
  private targetCalloutCallback: ((callout: TargetCallout) => void) | null = null;

  // Command integration
  private activeCommand: SquadCommandData | null = null;
  private holdPosition: BabylonVector3 | null = null;

  // NavMesh pathfinding
  private navMesh: NavMesh | null = null;
  private pathfindingState: PathfindingState = {
    isActive: false,
    path: null,
    currentWaypointIndex: 0,
    destination: null,
    calculatedAt: 0,
    pathType: 'direct',
  };
  private followPathBehavior: FollowPathBehavior | null = null;
  private pathRecalculationInterval: number = 3000; // Recalculate path every 3s

  // Scout/flank callback for state changes
  private onScoutStateChange: ((state: SteeringMode) => void) | null = null;

  constructor(
    initialPosition: BabylonVector3,
    config?: Partial<MarcusSteeringConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.position = initialPosition.clone();

    // Initialize Yuka entity manager
    this.entityManager = new EntityManager();

    // Create Marcus vehicle
    this.marcusVehicle = new Vehicle();
    this.marcusVehicle.position = toYuka(initialPosition);
    this.marcusVehicle.maxSpeed = this.config.maxSpeed;
    this.marcusVehicle.maxForce = this.config.maxForce;
    this.marcusVehicle.mass = 5; // Heavier than player - mech is bulky
    this.entityManager.add(this.marcusVehicle);

    // Create player vehicle (for offset pursuit)
    this.playerVehicle = new Vehicle();
    this.playerVehicle.maxSpeed = 10;
    this.entityManager.add(this.playerVehicle);

    // Initialize behaviors
    this.initializeBehaviors();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initializeBehaviors(): void {
    // Wander behavior for idle state
    this.wanderBehavior = new WanderBehavior();
    this.wanderBehavior.radius = this.config.wanderRadius;
    this.wanderBehavior.distance = this.config.wanderDistance;
    this.wanderBehavior.jitter = this.config.wanderJitter;
    this.wanderBehavior.weight = 0.5;

    // Separation behavior to avoid player collision
    this.separationBehavior = new SeparationBehavior();
    this.separationBehavior.weight = this.config.separationWeight;

    // Offset pursuit for following player in formation
    const followOffset = new YukaVector3(0, 0, -this.config.followDistance);
    this.offsetPursuitBehavior = new OffsetPursuitBehavior(
      this.playerVehicle,
      followOffset
    );
    this.offsetPursuitBehavior.weight = 1.0;

    // Follow path behavior for NavMesh pathfinding
    this.followPathBehavior = new FollowPathBehavior();
    this.followPathBehavior.weight = 1.0;
  }

  // ============================================================================
  // PUBLIC METHODS - COMMAND INTEGRATION
  // ============================================================================

  /**
   * Set the active squad command from SquadCommandSystem
   */
  setCommand(command: SquadCommandData | null): void {
    this.activeCommand = command;

    if (!command) {
      this.steeringMode = 'idle';
      return;
    }

    // Map command to steering mode
    switch (command.command) {
      case 'FOLLOW_ME':
        this.steeringMode = 'follow';
        break;

      case 'HOLD_POSITION':
        this.steeringMode = 'hold';
        this.holdPosition = command.targetPosition?.clone() ?? this.position.clone();
        break;

      case 'ATTACK_TARGET':
        this.steeringMode = 'attack';
        if (command.targetEntity) {
          this.setPlayerMarkedTarget(command.targetEntity);
        }
        break;

      case 'SUPPRESSING_FIRE':
        this.steeringMode = 'suppression';
        this.holdPosition = this.position.clone();
        break;

      case 'REGROUP':
        this.steeringMode = 'regroup';
        break;

      default:
        this.steeringMode = 'idle';
    }
  }

  /**
   * Get the current steering mode
   */
  getSteeringMode(): SteeringMode {
    return this.steeringMode;
  }

  /**
   * Set callback for target callouts
   */
  setTargetCalloutCallback(callback: (callout: TargetCallout) => void): void {
    this.targetCalloutCallback = callback;
  }

  // ============================================================================
  // PUBLIC METHODS - TARGET COORDINATION
  // ============================================================================

  /**
   * Set the player's marked target (from crosshair)
   * Marcus will prioritize this target
   */
  setPlayerMarkedTarget(target: Entity | null): void {
    const previousTarget = this.playerMarkedTarget;
    this.playerMarkedTarget = target;

    if (target && target !== previousTarget) {
      this.emitTargetCallout(target.id, 'priority');
      this.currentTarget = target;
    }
  }

  /**
   * Get the current target Marcus is engaging
   */
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }

  /**
   * Update Marcus's target selection based on available enemies
   * Implements flanking logic: Marcus engages from opposite side of player
   */
  updateTargetSelection(enemies: Entity[]): void {
    if (enemies.length === 0) {
      this.currentTarget = null;
      this.flankingState.isActive = false;
      return;
    }

    // Priority 1: Player marked target
    if (this.playerMarkedTarget) {
      const markedStillValid = enemies.find(
        (e) => e.id === this.playerMarkedTarget?.id
      );
      if (markedStillValid) {
        this.currentTarget = this.playerMarkedTarget;
        this.updateFlankingPosition(this.currentTarget);
        return;
      }
      // Marked target no longer valid
      this.playerMarkedTarget = null;
    }

    // Priority 2: Select target for flanking
    const targetWithFlank = this.selectFlankingTarget(enemies);
    if (targetWithFlank && targetWithFlank !== this.currentTarget) {
      this.emitTargetCallout(targetWithFlank.id, 'switching');
    }
    this.currentTarget = targetWithFlank;
  }

  /**
   * Calculate flanking position opposite to player
   */
  getFlankingPosition(): BabylonVector3 | null {
    if (!this.flankingState.isActive || !this.currentTarget?.transform) {
      return null;
    }
    return this.flankingState.targetPosition.clone();
  }

  // ============================================================================
  // PUBLIC METHODS - UPDATE
  // ============================================================================

  /**
   * Update player state for steering calculations
   */
  updatePlayerState(
    position: BabylonVector3,
    forward: BabylonVector3,
    velocity?: BabylonVector3
  ): void {
    this.playerPosition = position.clone();
    this.playerForward = forward.clone();
    if (velocity) {
      this.playerVelocity = velocity.clone();
    }

    // Update player vehicle for offset pursuit
    this.playerVehicle.position = toYuka(position);
    this.playerVehicle.velocity = toYuka(this.playerVelocity);

    // Update facing based on player forward
    const playerYaw = Math.atan2(forward.x, forward.z);
    this.playerVehicle.rotation.fromEuler(0, playerYaw, 0);
  }

  /**
   * Set Marcus's current position
   */
  setPosition(position: BabylonVector3): void {
    this.position = position.clone();
    this.marcusVehicle.position = toYuka(position);
  }

  /**
   * Main update function - calculates steering force and returns movement vector
   */
  update(deltaTime: number): SteeringResult {
    // Clear previous behaviors
    this.marcusVehicle.steering.clear();

    // Sync position
    this.marcusVehicle.position = toYuka(this.position);

    // Apply appropriate behaviors based on mode
    this.applySteeringBehaviors();

    // Update entity manager
    this.entityManager.update(deltaTime);

    // Calculate results
    const velocity = toBabylon(this.marcusVehicle.velocity);
    const isMoving = velocity.length() > 0.5;

    // Update facing direction
    if (isMoving) {
      this.facingDirection = velocity.normalize();
    } else if (this.currentTarget?.transform) {
      // Face target when stationary
      const toTarget = this.currentTarget.transform.position.subtract(this.position);
      toTarget.y = 0;
      if (toTarget.length() > 0.1) {
        this.facingDirection = toTarget.normalize();
      }
    }

    // Apply speed multiplier for regroup
    let finalVelocity = velocity;
    if (this.steeringMode === 'regroup') {
      finalVelocity = velocity.scale(REGROUP_SPEED_MULTIPLIER);
    }

    return {
      velocity: finalVelocity,
      facingDirection: this.facingDirection.clone(),
      mode: this.steeringMode,
      isMoving,
    };
  }

  /**
   * Get the calculated movement position for this frame
   * This is the main method MarcusCombatAI should call instead of getIdlePosition(), etc.
   */
  getSteeringMovementVector(deltaTime: number): BabylonVector3 {
    const result = this.update(deltaTime);
    return result.velocity.scale(deltaTime);
  }

  /**
   * Get target position based on current steering mode
   * Returns null if Marcus should stay in place
   */
  getTargetPosition(): BabylonVector3 | null {
    switch (this.steeringMode) {
      case 'idle':
        return this.getIdleWanderTarget();

      case 'follow':
        return this.getFollowPosition();

      case 'hold':
      case 'suppression':
        return this.holdPosition;

      case 'attack':
        return this.getAttackPosition();

      case 'regroup':
        return this.playerPosition.clone();

      case 'flank':
        return this.getFlankingPosition();

      case 'scout':
      case 'scout_flank':
      case 'pathfinding':
        return this.pathfindingState.destination?.clone() ?? null;

      default:
        return null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - STEERING BEHAVIORS
  // ============================================================================

  private applySteeringBehaviors(): void {
    switch (this.steeringMode) {
      case 'idle':
        this.applyIdleBehaviors();
        break;

      case 'follow':
        this.applyFollowBehaviors();
        break;

      case 'hold':
      case 'suppression':
        // No movement behaviors - stay in place
        this.applyHoldBehaviors();
        break;

      case 'attack':
        this.applyAttackBehaviors();
        break;

      case 'regroup':
        this.applyRegroupBehaviors();
        break;

      case 'flank':
        this.applyFlankBehaviors();
        break;

      case 'scout':
        this.applyScoutBehavior();
        break;

      case 'scout_flank':
        this.applyScoutFlankBehavior();
        break;

      case 'pathfinding':
        this.applyPathfindingBehavior();
        break;
    }

    // Always apply separation from player
    this.applySeparationBehavior();
  }

  private applyIdleBehaviors(): void {
    // Wander near player
    if (this.wanderBehavior) {
      this.marcusVehicle.steering.add(this.wanderBehavior);
    }

    // Gentle arrive toward player vicinity
    const idleTarget = this.getIdleWanderTarget();
    if (idleTarget) {
      const arrive = new ArriveBehavior(toYuka(idleTarget), this.config.arrivalTolerance);
      arrive.weight = 0.3;
      this.marcusVehicle.steering.add(arrive);
    }
  }

  private applyFollowBehaviors(): void {
    // Use offset pursuit to stay behind player
    if (this.offsetPursuitBehavior) {
      // Update offset based on current player direction
      const offset = new YukaVector3(
        -this.playerForward.x * this.config.followDistance,
        0,
        -this.playerForward.z * this.config.followDistance
      );
      this.offsetPursuitBehavior.offset = offset;
      this.marcusVehicle.steering.add(this.offsetPursuitBehavior);
    }
  }

  private applyHoldBehaviors(): void {
    if (!this.holdPosition) return;

    // Check if drifted from hold position
    const distFromHold = BabylonVector3.Distance(this.position, this.holdPosition);
    if (distFromHold > this.config.arrivalTolerance) {
      const arrive = new ArriveBehavior(
        toYuka(this.holdPosition),
        this.config.arrivalTolerance
      );
      arrive.weight = 1.0;
      this.marcusVehicle.steering.add(arrive);
    }
  }

  private applyAttackBehaviors(): void {
    if (!this.currentTarget?.transform) {
      // No target - fall back to follow
      this.applyFollowBehaviors();
      return;
    }

    const targetPos = this.currentTarget.transform.position;
    const distToTarget = BabylonVector3.Distance(this.position, targetPos);

    // If too far from target, seek toward it
    if (distToTarget > 40) {
      const seek = new SeekBehavior(toYuka(targetPos));
      seek.weight = 1.0;
      this.marcusVehicle.steering.add(seek);
    } else if (distToTarget > 25) {
      // Arrive at optimal combat range
      const arrive = new ArriveBehavior(toYuka(targetPos), 25);
      arrive.weight = 0.8;
      this.marcusVehicle.steering.add(arrive);
    }
    // Otherwise stay in position and fight
  }

  private applyRegroupBehaviors(): void {
    // Fast arrive to player position
    const arrive = new ArriveBehavior(
      toYuka(this.playerPosition),
      this.config.arrivalTolerance
    );
    arrive.weight = 1.5;
    this.marcusVehicle.steering.add(arrive);
  }

  private applyFlankBehaviors(): void {
    const flankPos = this.getFlankingPosition();
    if (!flankPos) {
      this.applyAttackBehaviors();
      return;
    }

    const distToFlank = BabylonVector3.Distance(this.position, flankPos);

    if (distToFlank > 5) {
      const seek = new SeekBehavior(toYuka(flankPos));
      seek.weight = 1.0;
      this.marcusVehicle.steering.add(seek);
    } else {
      const arrive = new ArriveBehavior(toYuka(flankPos), 3);
      arrive.weight = 0.8;
      this.marcusVehicle.steering.add(arrive);
    }
  }

  private applySeparationBehavior(): void {
    // Calculate separation force from player
    const toPlayer = this.playerPosition.subtract(this.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    if (distToPlayer < this.config.separationRadius && distToPlayer > 0.1) {
      // Push away from player
      const separationForce = toPlayer
        .normalize()
        .scale(-this.config.separationWeight * (1 - distToPlayer / this.config.separationRadius));

      this.marcusVehicle.velocity.x += separationForce.x;
      this.marcusVehicle.velocity.z += separationForce.z;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - TARGET SELECTION & FLANKING
  // ============================================================================

  private selectFlankingTarget(enemies: Entity[]): Entity | null {
    if (enemies.length === 0) return null;

    // Sort enemies by threat level (distance to player, health)
    const scoredEnemies = enemies
      .filter((e) => e.transform && e.health && e.health.current > 0)
      .map((enemy) => {
        const distToPlayer = BabylonVector3.Distance(
          enemy.transform!.position,
          this.playerPosition
        );
        const healthPercent = enemy.health!.current / enemy.health!.max;
        const isBoss = enemy.tags?.boss ? 2 : 1;

        // Higher score = higher priority
        const score =
          (100 - distToPlayer) * isBoss + (1 - healthPercent) * 30;

        return { enemy, score, distToPlayer };
      })
      .sort((a, b) => b.score - a.score);

    if (scoredEnemies.length === 0) return null;

    const bestTarget = scoredEnemies[0].enemy;
    this.updateFlankingPosition(bestTarget);

    return bestTarget;
  }

  private updateFlankingPosition(target: Entity): void {
    if (!target.transform) return;

    const now = performance.now();

    // Don't recalculate too frequently
    if (
      this.flankingState.isActive &&
      now - this.flankingState.calculatedAt < FLANK_RECALCULATION_INTERVAL
    ) {
      return;
    }

    const targetPos = target.transform.position;

    // Calculate vector from target to player
    const targetToPlayer = this.playerPosition.subtract(targetPos);
    targetToPlayer.y = 0;
    targetToPlayer.normalize();

    // Calculate perpendicular directions
    const perpLeft = new BabylonVector3(-targetToPlayer.z, 0, targetToPlayer.x);
    const perpRight = new BabylonVector3(targetToPlayer.z, 0, -targetToPlayer.x);

    // Choose side opposite to player's current position
    const playerToTarget = targetPos.subtract(this.playerPosition);
    const dotLeft = BabylonVector3.Dot(playerToTarget.normalize(), perpLeft);

    // Marcus goes opposite side
    const flankDirection = dotLeft > 0 ? perpRight : perpLeft;
    const playerSide = dotLeft > 0 ? 'left' : 'right';

    // Calculate flank position at angle from direct line
    const flankPos = targetPos.add(flankDirection.scale(this.config.flankDistance));
    flankPos.y = 0;

    this.flankingState = {
      isActive: true,
      targetPosition: flankPos,
      playerSide,
      calculatedAt: now,
    };

    // Enable flank steering mode when attacking with multiple enemies
    if (this.steeringMode === 'attack') {
      this.steeringMode = 'flank';
    }
  }

  // ============================================================================
  // PRIVATE METHODS - POSITION CALCULATIONS
  // ============================================================================

  private getIdleWanderTarget(): BabylonVector3 {
    // Stay 15-20m from player
    const toPlayer = this.playerPosition.subtract(this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist < 12) {
      // Too close - back away
      toPlayer.normalize();
      return this.playerPosition.subtract(toPlayer.scale(18));
    } else if (dist > 25) {
      // Too far - move closer
      toPlayer.normalize();
      return this.playerPosition.subtract(toPlayer.scale(20));
    }

    // Good distance - wander in vicinity
    return this.position.clone();
  }

  private getFollowPosition(): BabylonVector3 {
    // Calculate position behind player
    const behindPlayer = this.playerPosition.subtract(
      this.playerForward.scale(this.config.followDistance)
    );
    behindPlayer.y = 0;
    return behindPlayer;
  }

  private getAttackPosition(): BabylonVector3 {
    if (!this.currentTarget?.transform) {
      return this.getFollowPosition();
    }

    // If flanking is active, use flank position
    if (this.flankingState.isActive) {
      return this.flankingState.targetPosition.clone();
    }

    // Otherwise move toward target
    const targetPos = this.currentTarget.transform.position;
    const toTarget = targetPos.subtract(this.position);
    toTarget.y = 0;

    const dist = toTarget.length();
    if (dist > 30) {
      // Move closer
      toTarget.normalize();
      return this.position.add(toTarget.scale(15));
    }

    return this.position.clone();
  }

  // ============================================================================
  // PRIVATE METHODS - TARGET CALLOUTS
  // ============================================================================

  private emitTargetCallout(entityId: string, type: TargetCallout['type']): void {
    const now = performance.now();

    // Check cooldown
    if (
      this.lastTargetCallout &&
      now - this.lastTargetCallout.calledAt < TARGET_CALLOUT_COOLDOWN
    ) {
      return;
    }

    const callout: TargetCallout = {
      entityId,
      calledAt: now,
      type,
    };

    this.lastTargetCallout = callout;
    this.targetCalloutCallback?.(callout);
  }

  // ============================================================================
  // PUBLIC METHODS - NAVMESH PATHFINDING
  // ============================================================================

  /**
   * Set the NavMesh for pathfinding queries.
   * Should be called after level NavMesh is built.
   */
  setNavMesh(navMesh: NavMesh | null): void {
    this.navMesh = navMesh;
  }

  /**
   * Get the current NavMesh.
   */
  getNavMesh(): NavMesh | null {
    return this.navMesh;
  }

  /**
   * Set callback for scout state changes.
   */
  setScoutStateCallback(callback: (state: SteeringMode) => void): void {
    this.onScoutStateChange = callback;
  }

  /**
   * Start scouting to a distant position using NavMesh pathfinding.
   * Returns true if path was successfully calculated.
   */
  startScout(destination: BabylonVector3): boolean {
    if (!this.navMesh) {
      // Fallback: direct movement without navmesh
      this.steeringMode = 'scout';
      this.pathfindingState.destination = destination.clone();
      this.pathfindingState.isActive = true;
      this.pathfindingState.pathType = 'scout';
      this.onScoutStateChange?.('scout');
      return true;
    }

    const path = this.calculatePath(destination);
    if (path) {
      this.pathfindingState = {
        isActive: true,
        path,
        currentWaypointIndex: 0,
        destination: destination.clone(),
        calculatedAt: performance.now(),
        pathType: 'scout',
      };
      this.steeringMode = 'scout';
      this.onScoutStateChange?.('scout');
      return true;
    }

    return false;
  }

  /**
   * Start flanking maneuver - find alternate path around enemies.
   * Calculates path that avoids direct line to target.
   */
  startFlankPath(
    targetPosition: BabylonVector3,
    avoidPositions: BabylonVector3[]
  ): boolean {
    // Calculate flanking position (perpendicular to player-target line)
    const toTarget = targetPosition.subtract(this.playerPosition);
    toTarget.y = 0;
    toTarget.normalize();

    // Calculate perpendicular
    const perp = new BabylonVector3(-toTarget.z, 0, toTarget.x);

    // Choose side based on current position
    const toMarcus = this.position.subtract(this.playerPosition);
    const side = BabylonVector3.Dot(toMarcus.normalize(), perp) > 0 ? 1 : -1;

    // Calculate wide flanking position
    const flankDist = this.config.flankDistance * 1.5;
    const flankPosition = targetPosition.add(perp.scale(side * flankDist));

    if (!this.navMesh) {
      // Fallback: direct movement
      this.pathfindingState = {
        isActive: true,
        path: null,
        currentWaypointIndex: 0,
        destination: flankPosition,
        calculatedAt: performance.now(),
        pathType: 'flank',
      };
      this.steeringMode = 'scout_flank';
      this.onScoutStateChange?.('scout_flank');
      return true;
    }

    const path = this.calculatePath(flankPosition);
    if (path) {
      this.pathfindingState = {
        isActive: true,
        path,
        currentWaypointIndex: 0,
        destination: flankPosition,
        calculatedAt: performance.now(),
        pathType: 'flank',
      };
      this.steeringMode = 'scout_flank';
      this.onScoutStateChange?.('scout_flank');
      return true;
    }

    return false;
  }

  /**
   * Start returning to player using NavMesh pathfinding.
   */
  startRegroupPath(): boolean {
    if (!this.navMesh) {
      // Fallback: use existing regroup behavior
      this.steeringMode = 'regroup';
      this.pathfindingState.isActive = false;
      return true;
    }

    const path = this.calculatePath(this.playerPosition);
    if (path) {
      this.pathfindingState = {
        isActive: true,
        path,
        currentWaypointIndex: 0,
        destination: this.playerPosition.clone(),
        calculatedAt: performance.now(),
        pathType: 'regroup',
      };
      this.steeringMode = 'pathfinding';
      this.onScoutStateChange?.('pathfinding');
      return true;
    }

    // Fallback to simple regroup
    this.steeringMode = 'regroup';
    return true;
  }

  /**
   * Cancel current pathfinding/scouting operation.
   */
  cancelPathfinding(): void {
    this.pathfindingState.isActive = false;
    this.pathfindingState.path = null;
    this.pathfindingState.destination = null;
    this.steeringMode = 'idle';
    this.onScoutStateChange?.('idle');
  }

  /**
   * Check if currently following a path.
   */
  isPathfinding(): boolean {
    return this.pathfindingState.isActive;
  }

  /**
   * Get current path progress (0-1).
   */
  getPathProgress(): number {
    if (!this.pathfindingState.isActive || !this.pathfindingState.path) {
      return 0;
    }

    const totalWaypoints = this.pathfindingState.path.length();
    if (totalWaypoints === 0) return 1;

    return this.pathfindingState.currentWaypointIndex / totalWaypoints;
  }

  /**
   * Get current path waypoints for visualization.
   */
  getPathWaypoints(): BabylonVector3[] {
    if (!this.pathfindingState.path) return [];

    const waypoints: BabylonVector3[] = [];
    for (let i = 0; i < this.pathfindingState.path.length(); i++) {
      const point = this.pathfindingState.path.getWaypoint(i);
      if (point) {
        waypoints.push(toBabylon(point));
      }
    }
    return waypoints;
  }

  /**
   * Get pathfinding destination.
   */
  getPathDestination(): BabylonVector3 | null {
    return this.pathfindingState.destination?.clone() ?? null;
  }

  // ============================================================================
  // PRIVATE METHODS - PATHFINDING
  // ============================================================================

  /**
   * Calculate path from current position to destination using NavMesh.
   */
  private calculatePath(destination: BabylonVector3): Path | null {
    if (!this.navMesh) return null;

    const from = toYuka(this.position);
    const to = toYuka(destination);

    // Find path through NavMesh
    const path = this.navMesh.findPath(from, to);

    if (path.length === 0) return null;

    // Create Yuka Path object
    const yukaPath = new Path();
    yukaPath.loop = false;

    for (const point of path) {
      yukaPath.add(point);
    }

    return yukaPath;
  }

  /**
   * Apply pathfinding behavior - follow calculated path.
   */
  private applyPathfindingBehavior(): void {
    if (!this.pathfindingState.isActive) {
      this.applyFollowBehaviors();
      return;
    }

    const { path, destination } = this.pathfindingState;

    if (path && this.followPathBehavior) {
      // Use FollowPathBehavior
      this.followPathBehavior.path = path;
      this.marcusVehicle.steering.add(this.followPathBehavior);

      // Check if reached current waypoint
      const currentWaypoint = path.current();
      if (currentWaypoint) {
        const distToWaypoint = this.marcusVehicle.position.distanceTo(currentWaypoint);
        if (distToWaypoint < this.config.arrivalTolerance) {
          if (!path.finished()) {
            path.advance();
            this.pathfindingState.currentWaypointIndex++;
          }
        }
      }

      // Check if path complete
      if (path.finished()) {
        this.pathfindingState.isActive = false;
        this.steeringMode = 'idle';
        this.onScoutStateChange?.('idle');
      }
    } else if (destination) {
      // Fallback: simple arrive at destination
      const arrive = new ArriveBehavior(toYuka(destination), this.config.arrivalTolerance);
      arrive.weight = 1.0;
      this.marcusVehicle.steering.add(arrive);

      // Check if arrived
      const distToDest = BabylonVector3.Distance(this.position, destination);
      if (distToDest < this.config.arrivalTolerance * 2) {
        this.pathfindingState.isActive = false;
        this.steeringMode = 'idle';
        this.onScoutStateChange?.('idle');
      }
    }
  }

  /**
   * Apply scout behavior - move to scout position.
   */
  private applyScoutBehavior(): void {
    this.applyPathfindingBehavior();
  }

  /**
   * Apply scout flank behavior - take alternate route.
   */
  private applyScoutFlankBehavior(): void {
    this.applyPathfindingBehavior();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.entityManager.clear();
    this.arriveBehavior = null;
    this.seekBehavior = null;
    this.wanderBehavior = null;
    this.offsetPursuitBehavior = null;
    this.separationBehavior = null;
    this.followPathBehavior = null;
    this.currentTarget = null;
    this.playerMarkedTarget = null;
    this.targetCalloutCallback = null;
    this.navMesh = null;
    this.pathfindingState.path = null;
    this.onScoutStateChange = null;
  }
}
