/**
 * HeadlessGameRunner - Run game without rendering for automated testing
 *
 * Provides a headless simulation of the game loop that can be used to
 * test level completion, combat mechanics, and game flow programmatically.
 *
 * FEATURES:
 * - Simulates game tick without WebGL rendering
 * - Tracks game state (player, enemies, projectiles, objectives)
 * - Supports input injection for automated player control
 * - Runs until conditions are met or timeout
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { DifficultyLevel } from '../core/DifficultySettings';
import type { LevelId, LevelStats } from '../levels/types';
import { CAMPAIGN_LEVELS as CampaignLevels } from '../levels/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Simulated input state for the headless runner
 */
export interface SimulatedInput {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring?: boolean;
  isSprinting?: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
  isReloading?: boolean;
  isMelee?: boolean;
  isGrenade?: boolean;
  isInteracting?: boolean;
  actionId?: string;
}

/**
 * Player state snapshot
 */
export interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  maxHealth: number;
  isAlive: boolean;
  velocity: { x: number; y: number; z: number };
  isSprinting: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isJetpacking: boolean;
}

/**
 * Enemy state snapshot
 */
export interface EnemyState {
  id: string;
  speciesId: string;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isAlive: boolean;
  aiState: string;
  distanceToPlayer: number;
}

/**
 * Projectile state snapshot
 */
export interface ProjectileState {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isPlayerOwned: boolean;
  damage: number;
}

/**
 * Objective state snapshot
 */
export interface ObjectiveState {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isOptional: boolean;
}

/**
 * Boss state for The Breach level
 */
export interface BossState {
  isActive: boolean;
  health: number;
  maxHealth: number;
  phase: number;
  isVulnerable: boolean;
  currentAttack: string | null;
}

/**
 * Full game state snapshot
 */
export interface GameState {
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  levelPhase: string;
  levelId: LevelId;
  objectives: ObjectiveState[];
  bossState?: BossState;
  bossHealth?: number;
  bossPhase?: number;
  frameCount: number;
  elapsedTime: number;
  kills: number;
  deaths: number;
  checkpointsReached: string[];
}

/**
 * Headless runner options
 */
export interface HeadlessGameRunnerOptions {
  difficulty?: DifficultyLevel;
  startLevel?: LevelId;
  startPosition?: { x: number; y: number; z: number };
  startRotation?: number;
  enableLogging?: boolean;
  simulationSpeed?: number; // 1.0 = realtime, 2.0 = 2x speed
}

/**
 * Level completion result
 */
export interface LevelCompletionResult {
  completed: boolean;
  stats: LevelStats;
  elapsedFrames: number;
  elapsedTime: number;
  deaths: number;
  checkpointsReached: string[];
}

// ============================================================================
// HEADLESS GAME RUNNER
// ============================================================================

export class HeadlessGameRunner {
  // Configuration
  private readonly difficulty: DifficultyLevel;
  private readonly startLevel: LevelId;
  private readonly enableLogging: boolean;
  private readonly simulationSpeed: number;

  // Game state
  private frameCount = 0;
  private elapsedTime = 0;
  private isRunning = false;
  private isPaused = false;

  // Simulated player state
  private playerPosition: Vector3;
  private playerRotation = { x: 0, y: 0 };
  private playerHealth = 100;
  private readonly playerMaxHealth = 100;
  private playerVelocity = Vector3.Zero();
  private playerIsAlive = true;
  private isSprinting = false;
  private isCrouching = false;
  private isSliding = false;
  private isJetpacking = false;

  // Simulated enemies
  private enemies: Map<string, EnemyState> = new Map();
  private nextEnemyId = 1;

  // Simulated projectiles
  private projectiles: Map<string, ProjectileState> = new Map();

  // Level state
  private currentLevelId: LevelId;
  private levelPhase = 'exploration';
  private levelCompleted = false;
  private objectives: ObjectiveState[] = [];

  // Boss state (for The Breach)
  private bossActive = false;
  private bossHealth = 3000;
  private bossMaxHealth = 3000;
  private bossPhase = 1;
  private bossVulnerable = false;
  private bossCurrentAttack: string | null = null;

  // Stats tracking
  private kills = 0;
  private deaths = 0;
  private damageDealt = 0;
  private damageTaken = 0;
  private totalShots = 0;
  private shotsHit = 0;
  private checkpointsReached: string[] = [];
  private secretsFound = 0;
  private audioLogsFound = 0;
  private skullsFound = 0;

  // Current input state
  private currentInput: SimulatedInput = {
    movement: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
  };

  // Callbacks
  private onPlayerDeath: (() => void) | null = null;
  private onLevelComplete: ((stats: LevelStats) => void) | null = null;
  private onCheckpoint: ((id: string) => void) | null = null;

  constructor(options: HeadlessGameRunnerOptions = {}) {
    this.difficulty = options.difficulty ?? 'normal';
    this.startLevel = options.startLevel ?? 'anchor_station';
    this.enableLogging = options.enableLogging ?? false;
    this.simulationSpeed = options.simulationSpeed ?? 1.0;

    this.currentLevelId = this.startLevel;

    // Initialize player position
    const levelConfig = CampaignLevels[this.startLevel];
    const spawnPos = levelConfig?.playerSpawnPosition ?? { x: 0, y: 1.7, z: 0 };
    this.playerPosition = new Vector3(spawnPos.x, spawnPos.y, spawnPos.z);

    if (options.startPosition) {
      this.playerPosition = new Vector3(
        options.startPosition.x,
        options.startPosition.y,
        options.startPosition.z
      );
    }

    if (options.startRotation !== undefined) {
      this.playerRotation.y = options.startRotation;
    } else if (levelConfig?.playerSpawnRotation !== undefined) {
      this.playerRotation.y = levelConfig.playerSpawnRotation;
    }

    // Initialize level-specific state
    this.initializeLevel(this.currentLevelId);

    this.log(`HeadlessGameRunner initialized for ${this.startLevel} on ${this.difficulty}`);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Advance game by one frame
   */
  tick(deltaTime: number = 1 / 60): void {
    if (this.isPaused || !this.playerIsAlive) return;

    const scaledDelta = deltaTime * this.simulationSpeed;
    this.frameCount++;
    this.elapsedTime += scaledDelta;

    // Process input
    this.processInput(scaledDelta);

    // Update player physics
    this.updatePlayerPhysics(scaledDelta);

    // Update enemies
    this.updateEnemies(scaledDelta);

    // Update projectiles
    this.updateProjectiles(scaledDelta);

    // Update boss (if active)
    if (this.bossActive) {
      this.updateBoss(scaledDelta);
    }

    // Check level completion
    this.checkLevelCompletion();

    // Check player death
    if (this.playerHealth <= 0 && this.playerIsAlive) {
      this.handlePlayerDeath();
    }
  }

  /**
   * Run until condition is met or timeout
   * @returns true if condition was met, false if timed out
   */
  async runUntil(
    condition: () => boolean,
    maxFrames: number = 36000 // 10 minutes at 60fps
  ): Promise<boolean> {
    this.isRunning = true;
    let frames = 0;

    while (this.isRunning && frames < maxFrames) {
      if (condition()) {
        this.isRunning = false;
        return true;
      }

      this.tick();
      frames++;

      // Yield to event loop occasionally to prevent blocking
      if (frames % 1000 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this.isRunning = false;
    return false;
  }

  /**
   * Run for specified number of seconds
   */
  async runForSeconds(seconds: number): Promise<void> {
    const targetTime = this.elapsedTime + seconds;
    await this.runUntil(() => this.elapsedTime >= targetTime);
  }

  /**
   * Run for specified number of frames
   */
  async runForFrames(frames: number): Promise<void> {
    const targetFrame = this.frameCount + frames;
    await this.runUntil(() => this.frameCount >= targetFrame, frames + 1);
  }

  /**
   * Get current game state snapshot
   */
  getState(): GameState {
    return {
      player: this.getPlayerState(),
      enemies: this.getEnemyStates(),
      projectiles: this.getProjectileStates(),
      levelPhase: this.levelPhase,
      levelId: this.currentLevelId,
      objectives: [...this.objectives],
      bossState: this.bossActive
        ? {
            isActive: this.bossActive,
            health: this.bossHealth,
            maxHealth: this.bossMaxHealth,
            phase: this.bossPhase,
            isVulnerable: this.bossVulnerable,
            currentAttack: this.bossCurrentAttack,
          }
        : undefined,
      bossHealth: this.bossActive ? this.bossHealth / this.bossMaxHealth : undefined,
      bossPhase: this.bossActive ? this.bossPhase : undefined,
      frameCount: this.frameCount,
      elapsedTime: this.elapsedTime,
      kills: this.kills,
      deaths: this.deaths,
      checkpointsReached: [...this.checkpointsReached],
    };
  }

  /**
   * Inject input for next tick
   */
  injectInput(input: SimulatedInput): void {
    this.currentInput = { ...input };
  }

  /**
   * Clear current input
   */
  clearInput(): void {
    this.currentInput = {
      movement: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
    };
  }

  /**
   * Check if level is complete
   */
  isLevelComplete(): boolean {
    return this.levelCompleted;
  }

  /**
   * Get level stats
   */
  getLevelStats(): LevelStats {
    return {
      kills: this.kills,
      totalShots: this.totalShots,
      shotsHit: this.shotsHit,
      accuracy: this.totalShots > 0 ? Math.round((this.shotsHit / this.totalShots) * 100) : 0,
      headshots: 0, // Not tracked in headless mode
      meleKills: 0,
      grenadeKills: 0,
      timeSpent: this.elapsedTime,
      parTime: 300, // 5 minutes default
      secretsFound: this.secretsFound,
      totalSecrets: CampaignLevels[this.currentLevelId]?.totalSecrets ?? 0,
      audioLogsFound: this.audioLogsFound,
      totalAudioLogs: CampaignLevels[this.currentLevelId]?.totalAudioLogs ?? 0,
      skullsFound: this.skullsFound,
      deaths: this.deaths,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      objectivesCompleted: this.objectives.filter((o) => o.isCompleted).length,
      totalObjectives: this.objectives.length,
      bonusObjectivesCompleted: this.objectives.filter((o) => o.isOptional && o.isCompleted).length,
    };
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /**
   * Stop the runner
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Pause the runner
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the runner
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.frameCount = 0;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.isPaused = false;

    // Reset player
    const levelConfig = CampaignLevels[this.currentLevelId];
    const spawnPos = levelConfig?.playerSpawnPosition ?? { x: 0, y: 1.7, z: 0 };
    this.playerPosition = new Vector3(spawnPos.x, spawnPos.y, spawnPos.z);
    this.playerHealth = this.playerMaxHealth;
    this.playerIsAlive = true;
    this.playerVelocity = Vector3.Zero();

    // Reset state
    this.enemies.clear();
    this.projectiles.clear();
    this.levelCompleted = false;
    this.bossActive = false;

    // Reset stats
    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.totalShots = 0;
    this.shotsHit = 0;
    this.checkpointsReached = [];

    // Reinitialize level
    this.initializeLevel(this.currentLevelId);
  }

  /**
   * Transition to next level
   */
  transitionToNextLevel(): boolean {
    const currentConfig = CampaignLevels[this.currentLevelId];
    if (!currentConfig?.nextLevelId) {
      return false;
    }

    this.currentLevelId = currentConfig.nextLevelId;
    this.reset();
    return true;
  }

  /**
   * Transition to specific level
   */
  transitionToLevel(levelId: LevelId): void {
    this.currentLevelId = levelId;
    this.reset();
  }

  // ============================================================================
  // PLAYER MANIPULATION
  // ============================================================================

  /**
   * Teleport player to position
   */
  teleportPlayer(position: { x: number; y: number; z: number }): void {
    this.playerPosition = new Vector3(position.x, position.y, position.z);
  }

  /**
   * Damage player
   */
  damagePlayer(amount: number): void {
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.damageTaken += amount;

    // Check for death immediately
    if (this.playerHealth <= 0 && this.playerIsAlive) {
      this.handlePlayerDeath();
    }
  }

  /**
   * Heal player
   */
  healPlayer(amount: number): void {
    this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + amount);
  }

  /**
   * Set player health directly
   */
  setPlayerHealth(health: number): void {
    this.playerHealth = Math.max(0, Math.min(this.playerMaxHealth, health));
  }

  /**
   * Respawn player at checkpoint or spawn
   */
  respawnPlayer(): void {
    this.playerIsAlive = true;
    this.playerHealth = this.playerMaxHealth;

    // Use last checkpoint if available
    if (this.checkpointsReached.length > 0) {
      // For simplicity, respawn at level spawn
      const levelConfig = CampaignLevels[this.currentLevelId];
      const spawnPos = levelConfig?.playerSpawnPosition ?? { x: 0, y: 1.7, z: 0 };
      this.playerPosition = new Vector3(spawnPos.x, spawnPos.y, spawnPos.z);
    }

    this.log('Player respawned');
  }

  // ============================================================================
  // ENEMY MANIPULATION
  // ============================================================================

  /**
   * Spawn an enemy at position
   */
  spawnEnemy(
    speciesId: string,
    position: { x: number; y: number; z: number },
    health: number = 100
  ): string {
    const id = `enemy_${this.nextEnemyId++}`;
    const enemy: EnemyState = {
      id,
      speciesId,
      position: { ...position },
      health,
      maxHealth: health,
      isAlive: true,
      aiState: 'patrol',
      distanceToPlayer: this.calculateDistance(position, {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        z: this.playerPosition.z,
      }),
    };
    this.enemies.set(id, enemy);
    return id;
  }

  /**
   * Damage an enemy
   */
  damageEnemy(enemyId: string, amount: number): boolean {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || !enemy.isAlive) return false;

    enemy.health -= amount;
    this.damageDealt += amount;

    if (enemy.health <= 0) {
      enemy.health = 0;
      enemy.isAlive = false;
      this.kills++;
      return true; // Enemy killed
    }

    return false;
  }

  /**
   * Kill all enemies
   */
  killAllEnemies(): void {
    Array.from(this.enemies.values()).forEach((enemy) => {
      if (enemy.isAlive) {
        enemy.health = 0;
        enemy.isAlive = false;
        this.kills++;
      }
    });
  }

  /**
   * Get enemy count
   */
  getEnemyCount(aliveOnly: boolean = true): number {
    if (aliveOnly) {
      return Array.from(this.enemies.values()).filter((e) => e.isAlive).length;
    }
    return this.enemies.size;
  }

  // ============================================================================
  // BOSS MANIPULATION
  // ============================================================================

  /**
   * Start boss fight
   */
  startBossFight(): void {
    this.bossActive = true;
    this.bossHealth = this.bossMaxHealth;
    this.bossPhase = 1;
    this.levelPhase = 'boss_fight';
    this.log('Boss fight started');
  }

  /**
   * Damage boss
   */
  damageBoss(amount: number, isWeakPoint: boolean = false): void {
    if (!this.bossActive) return;

    const actualDamage = isWeakPoint ? amount * 2.5 : amount;
    this.bossHealth = Math.max(0, this.bossHealth - actualDamage);
    this.damageDealt += actualDamage;

    // Check phase transitions
    const healthPercent = this.bossHealth / this.bossMaxHealth;
    if (healthPercent < 0.33 && this.bossPhase < 3) {
      this.bossPhase = 3;
      this.log('Boss entered phase 3');
    } else if (healthPercent < 0.66 && this.bossPhase < 2) {
      this.bossPhase = 2;
      this.log('Boss entered phase 2');
    }

    // Check boss death
    if (this.bossHealth <= 0) {
      this.bossActive = false;
      this.levelPhase = 'boss_death';
      this.log('Boss defeated');
    }
  }

  /**
   * Set boss vulnerability
   */
  setBossVulnerable(vulnerable: boolean): void {
    this.bossVulnerable = vulnerable;
  }

  // ============================================================================
  // LEVEL STATE MANIPULATION
  // ============================================================================

  /**
   * Set level phase
   */
  setLevelPhase(phase: string): void {
    this.levelPhase = phase;
  }

  /**
   * Complete an objective
   */
  completeObjective(objectiveId: string): void {
    const objective = this.objectives.find((o) => o.id === objectiveId);
    if (objective) {
      objective.isCompleted = true;
      this.log(`Objective completed: ${objective.title}`);
    }
  }

  /**
   * Add a checkpoint
   */
  addCheckpoint(checkpointId: string): void {
    if (!this.checkpointsReached.includes(checkpointId)) {
      this.checkpointsReached.push(checkpointId);
      this.onCheckpoint?.(checkpointId);
      this.log(`Checkpoint reached: ${checkpointId}`);
    }
  }

  /**
   * Mark level as complete
   */
  markLevelComplete(): void {
    this.levelCompleted = true;
    this.levelPhase = 'complete';
    this.onLevelComplete?.(this.getLevelStats());
    this.log(`Level ${this.currentLevelId} completed`);
  }

  /**
   * Find a collectible (skull, audio log, secret)
   */
  findCollectible(type: 'skull' | 'audio_log' | 'secret'): void {
    switch (type) {
      case 'skull':
        this.skullsFound++;
        break;
      case 'audio_log':
        this.audioLogsFound++;
        break;
      case 'secret':
        this.secretsFound++;
        break;
    }
    this.log(`Found ${type}`);
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set callback for player death
   */
  setOnPlayerDeath(callback: () => void): void {
    this.onPlayerDeath = callback;
  }

  /**
   * Set callback for level completion
   */
  setOnLevelComplete(callback: (stats: LevelStats) => void): void {
    this.onLevelComplete = callback;
  }

  /**
   * Set callback for checkpoint reached
   */
  setOnCheckpoint(callback: (id: string) => void): void {
    this.onCheckpoint = callback;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private log(message: string): void {
    if (this.enableLogging) {
      console.log(`[HeadlessRunner] ${message}`);
    }
  }

  private initializeLevel(levelId: LevelId): void {
    this.objectives = [];
    this.levelPhase = 'exploration';
    this.levelCompleted = false;
    this.bossActive = false;

    // Level-specific initialization
    switch (levelId) {
      case 'anchor_station':
        this.objectives = [
          {
            id: 'tutorial_look',
            title: 'Look Around',
            description: 'Use mouse to look around',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'tutorial_move',
            title: 'Movement',
            description: 'Use WASD to move',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'tutorial_sprint',
            title: 'Sprint',
            description: 'Hold Shift to sprint',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'tutorial_complete',
            title: 'Enter Drop Pod',
            description: 'Approach the drop pod',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'landfall':
        this.spawnEnemy('skitterer', { x: 20, y: 0, z: 30 }, 80);
        this.spawnEnemy('skitterer', { x: -15, y: 0, z: 40 }, 80);
        this.spawnEnemy('spitter', { x: 0, y: 0, z: 50 }, 120);
        this.objectives = [
          {
            id: 'survive_drop',
            title: 'Survive Drop',
            description: 'Complete HALO drop',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'clear_area',
            title: 'Clear Landing Zone',
            description: 'Eliminate hostiles',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'activate_beacon',
            title: 'Activate Beacon',
            description: 'Signal for extraction',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'canyon_run':
        this.objectives = [
          {
            id: 'board_vehicle',
            title: 'Board Vehicle',
            description: 'Get in the Wraith',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'escape_canyon',
            title: 'Escape Canyon',
            description: 'Drive through the canyon',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'reach_fob',
            title: 'Reach FOB Delta',
            description: 'Arrive at destination',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'fob_delta':
        this.spawnEnemy('stalker', { x: 10, y: 0, z: 20 }, 150);
        this.spawnEnemy('warrior', { x: -5, y: 0, z: 35 }, 200);
        this.objectives = [
          {
            id: 'investigate_fob',
            title: 'Investigate FOB',
            description: 'Search the base',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'find_survivors',
            title: 'Find Survivors',
            description: 'Locate Marcus',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'restore_power',
            title: 'Restore Power',
            description: 'Activate generators',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'brothers_in_arms':
        this.spawnEnemy('heavy', { x: 30, y: 0, z: 50 }, 400);
        this.spawnEnemy('warrior', { x: 20, y: 0, z: 60 }, 200);
        this.spawnEnemy('warrior', { x: 40, y: 0, z: 55 }, 200);
        this.objectives = [
          {
            id: 'rendezvous_marcus',
            title: 'Find Marcus',
            description: 'Locate Marcus Cole',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'escort_mech',
            title: 'Support Mech',
            description: 'Cover Marcus in his mech',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'clear_outpost',
            title: 'Clear Outpost',
            description: 'Eliminate enemy presence',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'southern_ice':
        this.spawnEnemy('skitterer', { x: 15, y: 0, z: 25 }, 80);
        this.spawnEnemy('skitterer', { x: -10, y: 0, z: 30 }, 80);
        this.spawnEnemy('spitter', { x: 5, y: 0, z: 45 }, 120);
        this.objectives = [
          {
            id: 'survive_cold',
            title: 'Survive Cold',
            description: 'Find heat sources',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'locate_entrance',
            title: 'Find Hive Entrance',
            description: 'Locate the breach',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'defeat_icechitin',
            title: 'Defeat Ice Chitin',
            description: 'Clear the guardians',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'the_breach':
        // Boss level - enemies spawn during fight
        this.objectives = [
          {
            id: 'descend_hive',
            title: 'Descend into Hive',
            description: 'Navigate the tunnels',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'reach_queen',
            title: 'Find the Queen',
            description: 'Locate the Queen chamber',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'defeat_queen',
            title: 'Defeat the Queen',
            description: 'Destroy the Hive Queen',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'hive_assault':
        this.spawnEnemy('warrior', { x: 25, y: 0, z: 40 }, 200);
        this.spawnEnemy('spitter', { x: 15, y: 0, z: 50 }, 120);
        this.spawnEnemy('heavy', { x: 35, y: 0, z: 60 }, 400);
        this.objectives = [
          {
            id: 'assault_hive',
            title: 'Assault the Hive',
            description: 'Push into enemy territory',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'plant_charges',
            title: 'Plant Explosives',
            description: 'Set demolition charges',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'extract_squad',
            title: 'Extract Squad',
            description: 'Get to extraction point',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'extraction':
        this.spawnEnemy('skitterer', { x: 10, y: 0, z: 20 }, 80);
        this.spawnEnemy('skitterer', { x: -10, y: 0, z: 25 }, 80);
        this.objectives = [
          {
            id: 'reach_lz',
            title: 'Reach LZ Omega',
            description: 'Get to extraction point',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'hold_position',
            title: 'Hold Position',
            description: 'Defend until dropship arrives',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'board_dropship',
            title: 'Board Dropship',
            description: 'Escape the planet',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;

      case 'final_escape':
        this.objectives = [
          {
            id: 'board_vehicle',
            title: 'Board Vehicle',
            description: 'Get in the escape vehicle',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'outrun_collapse',
            title: 'Outrun Collapse',
            description: 'Escape the collapsing hive',
            isCompleted: false,
            isOptional: false,
          },
          {
            id: 'reach_extraction',
            title: 'Reach Extraction',
            description: 'Get to the Phantom',
            isCompleted: false,
            isOptional: false,
          },
        ];
        break;
    }

    this.log(`Level ${levelId} initialized with ${this.objectives.length} objectives`);
  }

  private processInput(deltaTime: number): void {
    const input = this.currentInput;

    // Movement
    if (input.movement.x !== 0 || input.movement.y !== 0) {
      const speed = input.isSprinting ? 20 : 10;
      const forward = new Vector3(
        Math.sin(this.playerRotation.y),
        0,
        Math.cos(this.playerRotation.y)
      );
      const right = new Vector3(
        Math.cos(this.playerRotation.y),
        0,
        -Math.sin(this.playerRotation.y)
      );

      const moveDir = forward.scale(input.movement.y).add(right.scale(input.movement.x));
      moveDir.normalize();
      moveDir.scaleInPlace(speed * deltaTime);

      this.playerPosition.addInPlace(moveDir);
    }

    // Look
    if (input.look.x !== 0 || input.look.y !== 0) {
      this.playerRotation.y += input.look.x * 0.002;
      this.playerRotation.x = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, this.playerRotation.x - input.look.y * 0.002)
      );
    }

    // Firing
    if (input.isFiring) {
      this.totalShots++;
      this.fireWeapon();
    }

    // Sprinting
    this.isSprinting = input.isSprinting ?? false;

    // Crouching
    this.isCrouching = input.isCrouching ?? false;

    // Jumping
    if (input.isJumping) {
      this.playerVelocity.y = 8; // Jump velocity
    }

    // Action execution
    if (input.actionId) {
      this.executeAction(input.actionId);
    }
  }

  private fireWeapon(): void {
    // Check for enemy hits
    const forward = new Vector3(
      Math.sin(this.playerRotation.y),
      0,
      Math.cos(this.playerRotation.y)
    );

    const enemies = Array.from(this.enemies.values());
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const toEnemy = new Vector3(
        enemy.position.x - this.playerPosition.x,
        enemy.position.y - this.playerPosition.y,
        enemy.position.z - this.playerPosition.z
      );

      const distance = toEnemy.length();
      if (distance > 100) continue; // Max range

      toEnemy.normalize();
      const dot = Vector3.Dot(forward, toEnemy);

      if (dot > 0.9) {
        // Hit detected
        this.shotsHit++;
        const damage = 25; // Base weapon damage
        this.damageEnemy(enemy.id, damage);
        return;
      }
    }

    // Check boss hit
    if (this.bossActive && this.bossHealth > 0) {
      const bossPos = new Vector3(0, -150, 180); // Queen position
      const toBoss = bossPos.subtract(this.playerPosition);
      const distance = toBoss.length();

      if (distance < 40) {
        toBoss.normalize();
        const dot = Vector3.Dot(forward, toBoss);

        if (dot > 0.8) {
          this.shotsHit++;
          this.damageBoss(20, this.bossVulnerable);
        }
      }
    }
  }

  private executeAction(actionId: string): void {
    switch (actionId) {
      case 'melee':
        this.meleeAttack();
        break;
      case 'grenade':
        this.throwGrenade();
        break;
      case 'interact':
        this.interact();
        break;
      case 'reload':
        // Reload is instant in headless mode
        break;
    }
  }

  private meleeAttack(): void {
    const meleeDamage = 100;
    const meleeRange = 3;

    const enemies = Array.from(this.enemies.values());
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const distance = this.calculateDistance(enemy.position, {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        z: this.playerPosition.z,
      });

      if (distance < meleeRange) {
        this.damageEnemy(enemy.id, meleeDamage);
        this.log(`Melee hit on ${enemy.speciesId}`);
        return;
      }
    }
  }

  private throwGrenade(): void {
    const grenadeDamage = 150;
    const grenadeRadius = 5;
    const grenadePos = this.playerPosition.add(
      new Vector3(Math.sin(this.playerRotation.y) * 10, 0, Math.cos(this.playerRotation.y) * 10)
    );

    const enemies = Array.from(this.enemies.values());
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const distance = this.calculateDistance(enemy.position, {
        x: grenadePos.x,
        y: grenadePos.y,
        z: grenadePos.z,
      });

      if (distance < grenadeRadius) {
        const damage = grenadeDamage * (1 - distance / grenadeRadius);
        this.damageEnemy(enemy.id, damage);
      }
    }

    // Damage boss if in range
    if (this.bossActive) {
      const bossPos = { x: 0, y: -150, z: 180 };
      const distance = this.calculateDistance(bossPos, {
        x: grenadePos.x,
        y: grenadePos.y,
        z: grenadePos.z,
      });

      if (distance < 10) {
        this.damageBoss(100, false);
      }
    }
  }

  private interact(): void {
    // Check for interactable objectives
    // This is simplified for headless testing
  }

  private updatePlayerPhysics(deltaTime: number): void {
    // Gravity
    if (this.playerPosition.y > 1.7) {
      this.playerVelocity.y -= 20 * deltaTime; // Gravity
      this.playerPosition.y += this.playerVelocity.y * deltaTime;

      if (this.playerPosition.y <= 1.7) {
        this.playerPosition.y = 1.7;
        this.playerVelocity.y = 0;
      }
    }

    // Health regeneration
    if (this.playerHealth < this.playerMaxHealth && this.playerIsAlive) {
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 2 * deltaTime);
    }
  }

  private updateEnemies(deltaTime: number): void {
    const enemies = Array.from(this.enemies.values());
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      // Update distance to player
      enemy.distanceToPlayer = this.calculateDistance(enemy.position, {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        z: this.playerPosition.z,
      });

      // Simple AI - move toward player and attack
      if (enemy.distanceToPlayer < 50 && enemy.distanceToPlayer > 3) {
        enemy.aiState = 'chase';
        const toPlayer = new Vector3(
          this.playerPosition.x - enemy.position.x,
          0,
          this.playerPosition.z - enemy.position.z
        );
        toPlayer.normalize();
        const moveSpeed = 8 * deltaTime;
        enemy.position.x += toPlayer.x * moveSpeed;
        enemy.position.z += toPlayer.z * moveSpeed;
      } else if (enemy.distanceToPlayer <= 3) {
        enemy.aiState = 'attack';
        // Attack player
        this.damagePlayer(10 * deltaTime);
      } else {
        enemy.aiState = 'patrol';
      }
    }
  }

  private updateProjectiles(deltaTime: number): void {
    const projectileEntries = Array.from(this.projectiles.entries());
    for (const [id, projectile] of projectileEntries) {
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;
      projectile.position.z += projectile.velocity.z * deltaTime;

      // Check for hits
      // ... collision detection would go here

      // Remove if out of range
      const distance = Math.sqrt(
        projectile.position.x ** 2 + projectile.position.y ** 2 + projectile.position.z ** 2
      );

      if (distance > 500) {
        this.projectiles.delete(id);
      }
    }
  }

  private updateBoss(deltaTime: number): void {
    if (!this.bossActive || this.bossHealth <= 0) return;

    // Simplified boss AI - periodic attacks
    const attackInterval = 3; // seconds
    const attackChance = deltaTime / attackInterval;

    if (Math.random() < attackChance) {
      this.bossAttack();
    }
  }

  private bossAttack(): void {
    const attacks = ['acid_spray', 'tail_swipe', 'screech', 'ground_pound'];
    const attack = attacks[Math.floor(Math.random() * attacks.length)];
    this.bossCurrentAttack = attack;

    // Damage player based on distance
    const playerDist = this.playerPosition.length() + 150; // Approximate distance to queen
    if (playerDist < 15) {
      const damage = Math.floor(Math.random() * 20) + 10;
      this.damagePlayer(damage);
    }

    // Reset attack after delay
    setTimeout(() => {
      this.bossCurrentAttack = null;
    }, 1000);
  }

  private checkLevelCompletion(): void {
    if (this.levelCompleted) return;

    // Check if all required objectives are complete
    const requiredObjectives = this.objectives.filter((o) => !o.isOptional);
    const allComplete = requiredObjectives.every((o) => o.isCompleted);

    if (allComplete && requiredObjectives.length > 0) {
      this.markLevelComplete();
    }

    // Special case: The Breach boss level
    if (this.currentLevelId === 'the_breach' && this.bossHealth <= 0 && this.bossActive === false) {
      this.completeObjective('defeat_queen');
    }
  }

  private handlePlayerDeath(): void {
    this.playerIsAlive = false;
    this.deaths++;
    this.onPlayerDeath?.();
    this.log(`Player died (death #${this.deaths})`);
  }

  private getPlayerState(): PlayerState {
    return {
      position: {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        z: this.playerPosition.z,
      },
      rotation: { ...this.playerRotation },
      health: this.playerHealth,
      maxHealth: this.playerMaxHealth,
      isAlive: this.playerIsAlive,
      velocity: {
        x: this.playerVelocity.x,
        y: this.playerVelocity.y,
        z: this.playerVelocity.z,
      },
      isSprinting: this.isSprinting,
      isCrouching: this.isCrouching,
      isSliding: this.isSliding,
      isJetpacking: this.isJetpacking,
    };
  }

  private getEnemyStates(): EnemyState[] {
    return Array.from(this.enemies.values());
  }

  private getProjectileStates(): ProjectileState[] {
    return Array.from(this.projectiles.values());
  }

  private calculateDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }
}
