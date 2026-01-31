/**
 * SimulatedPlayer - AI-controlled player for automated testing
 *
 * Provides various playstyles and behaviors for testing level completion,
 * combat mechanics, and game flow without human input.
 *
 * PLAYSTYLES:
 * - Aggressive: Rush enemies, maximize kills
 * - Defensive: Use cover, pick shots carefully
 * - Speedrun: Rush objectives, ignore enemies when possible
 * - Explorer: Find all secrets and collectibles
 * - Completionist: Do everything
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type {
  HeadlessGameRunner,
  SimulatedInput,
  EnemyState,
  GameState,
  ObjectiveState,
} from './HeadlessGameRunner';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Playstyle configuration
 */
export type PlayStyle = 'aggressive' | 'defensive' | 'speedrun' | 'explorer' | 'completionist';

/**
 * Movement strategy
 */
export type MovementStrategy = 'direct' | 'strafing' | 'flanking' | 'retreating' | 'patrolling';

/**
 * Combat strategy
 */
export type CombatStrategy = 'sustained_fire' | 'burst_fire' | 'melee_focus' | 'grenade_spam' | 'mixed';

/**
 * Waypoint for pathfinding
 */
export interface Waypoint {
  x: number;
  y: number;
  z: number;
  action?: 'wait' | 'interact' | 'fight' | 'collect';
  duration?: number;
}

/**
 * Simulated player options
 */
export interface SimulatedPlayerOptions {
  playStyle?: PlayStyle;
  movementStrategy?: MovementStrategy;
  combatStrategy?: CombatStrategy;
  reactionTime?: number; // ms delay before reacting
  accuracy?: number; // 0-1, chance to hit
  aggressionLevel?: number; // 0-1, how likely to engage
  dodgeSkill?: number; // 0-1, how well they dodge attacks
  objectiveFocus?: number; // 0-1, how focused on objectives vs combat
}

// ============================================================================
// SIMULATED PLAYER CLASS
// ============================================================================

export class SimulatedPlayer {
  private runner: HeadlessGameRunner;
  private playStyle: PlayStyle;
  private movementStrategy: MovementStrategy;
  private combatStrategy: CombatStrategy;
  private reactionTime: number;
  private accuracy: number;
  private aggressionLevel: number;
  private dodgeSkill: number;
  private objectiveFocus: number;

  // Internal state
  private currentTarget: EnemyState | null = null;
  private currentWaypoint: Waypoint | null = null;
  private waypointQueue: Waypoint[] = [];
  private lastActionTime = 0;
  private strafeDirection = 1;
  private burstCount = 0;
  private reloadNeeded = false;
  private grenadeCount = 3;
  private isAutonomous = false;
  private autonomousUpdateInterval: number | null = null;

  constructor(runner: HeadlessGameRunner, options: SimulatedPlayerOptions = {}) {
    this.runner = runner;
    this.playStyle = options.playStyle ?? 'aggressive';
    this.movementStrategy = options.movementStrategy ?? 'direct';
    this.combatStrategy = options.combatStrategy ?? 'sustained_fire';
    this.reactionTime = options.reactionTime ?? 100;
    this.accuracy = options.accuracy ?? 0.7;
    this.aggressionLevel = options.aggressionLevel ?? 0.8;
    this.dodgeSkill = options.dodgeSkill ?? 0.5;
    this.objectiveFocus = options.objectiveFocus ?? 0.5;
  }

  // ============================================================================
  // PUBLIC MOVEMENT METHODS
  // ============================================================================

  /**
   * Move toward a target position
   */
  moveToward(target: { x: number; y: number; z: number }): void {
    const state = this.runner.getState();
    const playerPos = state.player.position;
    const dx = target.x - playerPos.x;
    const dz = target.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.5) {
      this.runner.injectInput({ movement: { x: 0, y: 0 }, look: { x: 0, y: 0 } });
      return;
    }

    // Calculate movement direction
    const moveX = dx / distance;
    const moveY = dz / distance;

    // Calculate look direction
    const targetAngle = Math.atan2(dx, dz);
    const currentAngle = state.player.rotation.y;
    let angleDiff = targetAngle - currentAngle;

    // Normalize angle
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const input: SimulatedInput = {
      movement: { x: moveX, y: moveY },
      look: { x: angleDiff * 100, y: 0 },
      isSprinting: distance > 10,
    };

    this.runner.injectInput(input);
  }

  /**
   * Move away from a target position
   */
  moveAwayFrom(target: { x: number; y: number; z: number }): void {
    const state = this.runner.getState();
    const playerPos = state.player.position;
    const dx = playerPos.x - target.x;
    const dz = playerPos.z - target.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 30) {
      // Far enough, stop running
      this.runner.injectInput({ movement: { x: 0, y: 0 }, look: { x: 0, y: 0 } });
      return;
    }

    const moveX = dx / distance;
    const moveY = dz / distance;

    // Look back at threat while retreating
    const targetAngle = Math.atan2(-dx, -dz);
    const currentAngle = state.player.rotation.y;
    let angleDiff = targetAngle - currentAngle;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const input: SimulatedInput = {
      movement: { x: moveX, y: moveY },
      look: { x: angleDiff * 50, y: 0 },
      isSprinting: true,
    };

    this.runner.injectInput(input);
  }

  /**
   * Strafe around a target (for dodging/combat)
   */
  strafeAround(target: { x: number; y: number; z: number }): void {
    const state = this.runner.getState();
    const playerPos = state.player.position;
    const dx = target.x - playerPos.x;
    const dz = target.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Change strafe direction occasionally
    if (Math.random() < 0.02) {
      this.strafeDirection *= -1;
    }

    // Calculate perpendicular movement
    const perpX = -dz / distance * this.strafeDirection;
    const perpZ = dx / distance * this.strafeDirection;

    // Look at target
    const targetAngle = Math.atan2(dx, dz);
    const currentAngle = state.player.rotation.y;
    let angleDiff = targetAngle - currentAngle;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const input: SimulatedInput = {
      movement: { x: perpX, y: perpZ },
      look: { x: angleDiff * 100, y: 0 },
    };

    this.runner.injectInput(input);
  }

  /**
   * Stop all movement
   */
  stop(): void {
    this.runner.injectInput({ movement: { x: 0, y: 0 }, look: { x: 0, y: 0 } });
  }

  // ============================================================================
  // PUBLIC COMBAT METHODS
  // ============================================================================

  /**
   * Aim at a target position
   */
  aimAt(target: { x: number; y: number; z: number }): void {
    const state = this.runner.getState();
    const playerPos = state.player.position;
    const dx = target.x - playerPos.x;
    const dy = target.y - playerPos.y;
    const dz = target.z - playerPos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    const targetYaw = Math.atan2(dx, dz);
    const targetPitch = Math.atan2(dy, horizontalDist);
    const currentYaw = state.player.rotation.y;
    const currentPitch = state.player.rotation.x;

    let yawDiff = targetYaw - currentYaw;
    let pitchDiff = targetPitch - currentPitch;

    while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
    while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;

    const input: SimulatedInput = {
      movement: { x: 0, y: 0 },
      look: { x: yawDiff * 100, y: -pitchDiff * 100 },
    };

    this.runner.injectInput(input);
  }

  /**
   * Fire weapon
   */
  fire(): void {
    // Apply accuracy check
    const shouldHit = Math.random() < this.accuracy;

    const input: SimulatedInput = {
      movement: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      isFiring: true,
    };

    // If accuracy check fails, add some aim deviation
    if (!shouldHit) {
      input.look = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
      };
    }

    this.runner.injectInput(input);
    this.burstCount++;
  }

  /**
   * Reload weapon
   */
  reload(): void {
    const input: SimulatedInput = {
      movement: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      isReloading: true,
    };

    this.runner.injectInput(input);
    this.reloadNeeded = false;
  }

  /**
   * Throw grenade at target
   */
  throwGrenade(target: { x: number; y: number; z: number }): void {
    if (this.grenadeCount <= 0) return;

    this.aimAt(target);

    const input: SimulatedInput = {
      movement: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      isGrenade: true,
      actionId: 'grenade',
    };

    this.runner.injectInput(input);
    this.grenadeCount--;
  }

  /**
   * Perform melee attack
   */
  melee(): void {
    const input: SimulatedInput = {
      movement: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      isMelee: true,
      actionId: 'melee',
    };

    this.runner.injectInput(input);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Find nearest enemy
   */
  findNearestEnemy(): EnemyState | null {
    const state = this.runner.getState();
    const aliveEnemies = state.enemies.filter((e) => e.isAlive);

    if (aliveEnemies.length === 0) return null;

    let nearest: EnemyState | null = null;
    let nearestDist = Infinity;

    for (const enemy of aliveEnemies) {
      if (enemy.distanceToPlayer < nearestDist) {
        nearestDist = enemy.distanceToPlayer;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * Find cover position (simplified - moves away from nearest enemy)
   */
  findCover(): { x: number; y: number; z: number } | null {
    const enemy = this.findNearestEnemy();
    if (!enemy) return null;

    const state = this.runner.getState();
    const playerPos = state.player.position;

    // Calculate direction away from enemy
    const dx = playerPos.x - enemy.position.x;
    const dz = playerPos.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist === 0) return null;

    // Cover position 15 units away from enemy
    return {
      x: playerPos.x + (dx / dist) * 15,
      y: playerPos.y,
      z: playerPos.z + (dz / dist) * 15,
    };
  }

  /**
   * Get path to objective (simplified - direct path)
   */
  pathToObjective(): Waypoint[] {
    const state = this.runner.getState();
    const incompleteObjectives = state.objectives.filter((o) => !o.isCompleted);

    if (incompleteObjectives.length === 0) return [];

    // For each objective, create a waypoint
    // In a real implementation, this would use actual level geometry
    const waypoints: Waypoint[] = [];

    // Simplified: generate waypoints based on objective type
    for (const objective of incompleteObjectives) {
      if (objective.id.includes('boss') || objective.id.includes('queen')) {
        // Boss is deep in the level
        waypoints.push({ x: 0, y: -150, z: 180, action: 'fight' });
      } else if (objective.id.includes('exit') || objective.id.includes('extract')) {
        waypoints.push({ x: 50, y: 0, z: 100, action: 'interact' });
      } else {
        // Generic forward movement
        waypoints.push({
          x: state.player.position.x + Math.random() * 20,
          y: state.player.position.y,
          z: state.player.position.z + 30,
          action: 'interact',
        });
      }
    }

    return waypoints;
  }

  /**
   * Check if enemy is in melee range
   */
  isInMeleeRange(enemy: EnemyState): boolean {
    return enemy.distanceToPlayer < 3;
  }

  /**
   * Check if enemy is in firing range
   */
  isInFiringRange(enemy: EnemyState): boolean {
    return enemy.distanceToPlayer < 50;
  }

  /**
   * Get player health percentage
   */
  getHealthPercent(): number {
    const state = this.runner.getState();
    return state.player.health / state.player.maxHealth;
  }

  // ============================================================================
  // AUTOMATION PLAYSTYLES
  // ============================================================================

  /**
   * Play aggressively - rush and shoot
   */
  playAggressively(): void {
    this.playStyle = 'aggressive';
    this.startAutonomous();
  }

  /**
   * Play defensively - take cover, pick shots
   */
  playDefensively(): void {
    this.playStyle = 'defensive';
    this.startAutonomous();
  }

  /**
   * Speedrun - rush objectives, ignore enemies
   */
  speedrun(): void {
    this.playStyle = 'speedrun';
    this.startAutonomous();
  }

  /**
   * Explorer - find all collectibles
   */
  explore(): void {
    this.playStyle = 'explorer';
    this.startAutonomous();
  }

  /**
   * Completionist - do everything
   */
  completionist(): void {
    this.playStyle = 'completionist';
    this.startAutonomous();
  }

  /**
   * Stop autonomous play
   */
  stopAutonomous(): void {
    this.isAutonomous = false;
    this.runner.clearInput();
  }

  /**
   * Update autonomous behavior (call each frame when autonomous)
   */
  updateAutonomous(): void {
    if (!this.isAutonomous) return;

    const state = this.runner.getState();

    // Check if player died
    if (!state.player.isAlive) {
      this.runner.respawnPlayer();
      return;
    }

    switch (this.playStyle) {
      case 'aggressive':
        this.updateAggressive(state);
        break;
      case 'defensive':
        this.updateDefensive(state);
        break;
      case 'speedrun':
        this.updateSpeedrun(state);
        break;
      case 'explorer':
        this.updateExplorer(state);
        break;
      case 'completionist':
        this.updateCompletionist(state);
        break;
    }
  }

  private startAutonomous(): void {
    this.isAutonomous = true;
  }

  private updateAggressive(state: GameState): void {
    const enemy = this.findNearestEnemy();

    if (enemy) {
      // Rush the enemy
      if (enemy.distanceToPlayer > 3) {
        this.moveToward(enemy.position);
      }

      // Attack
      if (this.isInMeleeRange(enemy)) {
        this.melee();
      } else if (this.isInFiringRange(enemy)) {
        this.aimAt(enemy.position);
        this.fire();
      }
    } else {
      // No enemies, move toward objectives
      const waypoints = this.pathToObjective();
      if (waypoints.length > 0) {
        this.moveToward(waypoints[0]);
      } else if (!state.levelPhase.includes('complete')) {
        // Move forward to find more enemies or objectives
        this.moveToward({
          x: state.player.position.x,
          y: state.player.position.y,
          z: state.player.position.z + 5,
        });
      }
    }

    // Use grenades on groups of enemies
    const aliveEnemies = state.enemies.filter((e) => e.isAlive);
    if (aliveEnemies.length >= 3 && this.grenadeCount > 0) {
      const target = aliveEnemies[0].position;
      this.throwGrenade(target);
    }
  }

  private updateDefensive(state: GameState): void {
    const healthPercent = this.getHealthPercent();
    const enemy = this.findNearestEnemy();

    if (healthPercent < 0.3) {
      // Low health - retreat
      if (enemy) {
        this.moveAwayFrom(enemy.position);
      }
      return;
    }

    if (enemy) {
      if (enemy.distanceToPlayer < 5) {
        // Too close - retreat while firing
        this.moveAwayFrom(enemy.position);
        this.fire();
      } else if (enemy.distanceToPlayer < 30) {
        // Good range - strafe and fire
        this.strafeAround(enemy.position);
        this.aimAt(enemy.position);
        if (this.burstCount < 5) {
          this.fire();
        } else {
          this.burstCount = 0;
          // Pause between bursts
        }
      } else {
        // Enemy far - careful approach
        this.moveToward(enemy.position);
      }
    } else {
      // No enemies - move to objectives carefully
      const waypoints = this.pathToObjective();
      if (waypoints.length > 0) {
        this.moveToward(waypoints[0]);
      }
    }
  }

  private updateSpeedrun(state: GameState): void {
    const enemy = this.findNearestEnemy();
    const waypoints = this.pathToObjective();

    if (waypoints.length > 0) {
      const target = waypoints[0];

      // Only fight if enemy is blocking the path
      if (enemy && enemy.distanceToPlayer < 5) {
        // Quick kill attempt
        if (this.isInMeleeRange(enemy)) {
          this.melee();
        } else {
          this.fire();
        }
      }

      // Sprint toward objective
      this.moveToward(target);
    } else if (!state.levelPhase.includes('complete')) {
      // Rush forward
      this.moveToward({
        x: state.player.position.x,
        y: state.player.position.y,
        z: state.player.position.z + 10,
      });
    }
  }

  private updateExplorer(state: GameState): void {
    // Prioritize finding secrets and collectibles
    // In headless mode, we simulate finding collectibles by area coverage

    const enemy = this.findNearestEnemy();

    // Kill enemies in the way
    if (enemy && enemy.distanceToPlayer < 10) {
      this.aimAt(enemy.position);
      this.fire();
    }

    // Explore in a pattern
    const time = this.runner.getFrameCount() * 0.01;
    const exploreRadius = 30;
    const targetX = Math.sin(time) * exploreRadius;
    const targetZ = Math.cos(time * 0.5) * exploreRadius + state.player.position.z * 0.5;

    this.moveToward({
      x: targetX,
      y: state.player.position.y,
      z: targetZ,
    });

    // Periodically "find" collectibles
    if (this.runner.getFrameCount() % 600 === 0) {
      const collectibles = ['skull', 'audio_log', 'secret'] as const;
      const type = collectibles[Math.floor(Math.random() * collectibles.length)];
      this.runner.findCollectible(type);
    }
  }

  private updateCompletionist(state: GameState): void {
    const enemy = this.findNearestEnemy();
    const healthPercent = this.getHealthPercent();

    // Kill all enemies first
    if (enemy) {
      if (healthPercent < 0.3) {
        this.moveAwayFrom(enemy.position);
        this.fire();
      } else if (enemy.distanceToPlayer < 3) {
        this.melee();
      } else {
        this.moveToward(enemy.position);
        this.aimAt(enemy.position);
        this.fire();
      }
      return;
    }

    // Then explore for collectibles
    if (state.kills < 10) {
      // Early in level - explore while killing
      this.updateExplorer(state);
    } else {
      // Enemies cleared - find collectibles then complete objectives
      const stats = this.runner.getLevelStats();
      const collectiblesFound =
        (stats?.secretsFound ?? 0) +
        (stats?.audioLogsFound ?? 0) +
        (stats?.skullsFound ?? 0);

      if (collectiblesFound < 3) {
        this.updateExplorer(state);
      } else {
        // Complete objectives
        const waypoints = this.pathToObjective();
        if (waypoints.length > 0) {
          this.moveToward(waypoints[0]);
        }
      }
    }
  }

  // ============================================================================
  // BOSS FIGHT STRATEGIES
  // ============================================================================

  /**
   * Execute boss fight strategy
   */
  fightBoss(): void {
    const state = this.runner.getState();

    if (!state.bossState?.isActive) {
      this.runner.startBossFight();
      return;
    }

    const bossHealth = state.bossHealth ?? 1;
    const bossPhase = state.bossPhase ?? 1;
    const playerHealth = this.getHealthPercent();

    // Phase-specific strategies
    if (bossPhase === 3) {
      // Final phase - all out attack
      this.bossPhase3Strategy(state);
    } else if (bossPhase === 2) {
      // Mid phase - balanced approach
      this.bossPhase2Strategy(state);
    } else {
      // Phase 1 - learn patterns
      this.bossPhase1Strategy(state);
    }
  }

  private bossPhase1Strategy(state: GameState): void {
    const bossPos = { x: 0, y: -150, z: 180 }; // Queen position

    // Strafe around boss while firing
    this.strafeAround(bossPos);
    this.aimAt(bossPos);

    // Fire in bursts
    if (this.burstCount < 10) {
      this.fire();
    } else {
      this.burstCount = 0;
    }

    // Scan for weak points periodically
    if (this.runner.getFrameCount() % 300 === 0) {
      this.runner.setBossVulnerable(true);
    }
  }

  private bossPhase2Strategy(state: GameState): void {
    const bossPos = { x: 0, y: -150, z: 180 };
    const playerHealth = this.getHealthPercent();

    if (playerHealth < 0.4) {
      // Low health - retreat and heal
      this.moveAwayFrom(bossPos);
      return;
    }

    // Use grenades
    if (this.grenadeCount > 0 && this.runner.getFrameCount() % 180 === 0) {
      this.throwGrenade(bossPos);
    }

    // Strafe and fire
    this.strafeAround(bossPos);
    this.aimAt(bossPos);
    this.fire();
  }

  private bossPhase3Strategy(state: GameState): void {
    const bossPos = { x: 0, y: -150, z: 180 };

    // All-out assault in final phase
    this.moveToward(bossPos);
    this.aimAt(bossPos);
    this.fire();

    // Use all remaining grenades
    if (this.grenadeCount > 0) {
      this.throwGrenade(bossPos);
    }

    // Target weak points when vulnerable
    if (state.bossState?.isVulnerable) {
      // Focus fire on weak point
      this.fire();
      this.fire();
      this.fire();
    }
  }

  // ============================================================================
  // VEHICLE STRATEGIES
  // ============================================================================

  /**
   * Drive vehicle in canyon run style
   */
  driveVehicle(): void {
    const state = this.runner.getState();

    // Simple forward driving with dodging
    const time = this.runner.getFrameCount() * 0.02;
    const swerve = Math.sin(time) * 0.3;

    const input: SimulatedInput = {
      movement: { x: swerve, y: 1 }, // Forward with swerving
      look: { x: 0, y: 0 },
      isSprinting: true, // Boost
    };

    this.runner.injectInput(input);

    // Fire at obstacles
    const enemy = this.findNearestEnemy();
    if (enemy && enemy.distanceToPlayer < 50) {
      this.aimAt(enemy.position);
      this.fire();
    }
  }

  // ============================================================================
  // SQUAD COMMANDS (for Brothers in Arms)
  // ============================================================================

  /**
   * Issue attack command to AI companion
   */
  commandAttack(target: EnemyState): void {
    // Simulates commanding Marcus to attack
    this.runner.damageEnemy(target.id, 50);
  }

  /**
   * Issue defend command to AI companion
   */
  commandDefend(): void {
    // Simulates defensive stance
    // In headless mode, this doesn't have a direct effect
  }

  /**
   * Issue follow command to AI companion
   */
  commandFollow(): void {
    // Simulates follow behavior
  }
}
