/**
 * SpawnManager - Runtime wave/spawn orchestrator
 *
 * Reads a {@link LevelSpawnConfig} and manages the full lifecycle of enemy
 * waves within a level: evaluating trigger conditions, pacing individual
 * spawns, tracking live entity counts, and advancing through waves.
 *
 * Usage:
 * ```ts
 * const manager = new SpawnManager(config, {
 *   onSpawnEnemy: (speciesId, position, facing, overrides) => { ... },
 *   onWaveStart: (waveNumber, label) => { ... },
 *   onWaveComplete: (waveNumber) => { ... },
 *   onAllWavesComplete: () => { ... },
 * });
 *
 * // In the level update loop:
 * manager.update(deltaTime, playerPosition);
 *
 * // When an enemy dies:
 * manager.reportKill(entityId);
 * ```
 *
 * The manager does **not** create BabylonJS meshes or ECS entities itself.
 * Instead it calls back into the hosting level via {@link SpawnManagerCallbacks}
 * so the level retains full control over entity creation and scene management.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import type {
  EnemyStatOverrides,
  LevelSpawnConfig,
  SpawnGroupConfig,
  SpawnPointConfig,
  SpawnWaveConfig,
  TriggerCondition,
} from './SpawnConfig';

// ============================================================================
// CALLBACK INTERFACE
// ============================================================================

/**
 * Callbacks that the hosting level must implement.
 * The SpawnManager invokes these to communicate spawn events without
 * directly depending on BabylonJS scene internals or ECS specifics.
 */
export interface SpawnManagerCallbacks {
  /**
   * Called when the manager decides to spawn a single enemy.
   *
   * @param speciesId  - Alien species identifier (e.g. "skitterer", "broodmother").
   * @param position   - World-space position where the enemy should appear.
   * @param facingAngle - Y-axis rotation in radians the enemy should face.
   * @param overrides  - Combined stat overrides from the spawn point and group config.
   * @returns A unique string identifier for the spawned entity, used for kill tracking.
   *          Return `null` if spawning was not possible (e.g. asset not loaded).
   */
  onSpawnEnemy: (
    speciesId: string,
    position: Vector3,
    facingAngle: number,
    overrides: Partial<EnemyStatOverrides> | null
  ) => string | null;

  /**
   * Called when a wave begins (trigger conditions met and first spawn is imminent).
   *
   * @param waveNumber - Zero-indexed wave number.
   * @param label      - Optional human-readable label for HUD display.
   */
  onWaveStart?: (waveNumber: number, label?: string) => void;

  /**
   * Called when all enemies in a wave have been killed.
   *
   * @param waveNumber - Zero-indexed wave number that was completed.
   */
  onWaveComplete?: (waveNumber: number) => void;

  /**
   * Called when every wave in the config has been completed.
   */
  onAllWavesComplete?: () => void;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Runtime state for a single wave. */
interface WaveState {
  config: SpawnWaveConfig;
  status: 'pending' | 'active' | 'spawning_complete' | 'complete';

  /** IDs of all entities that belong to this wave (alive or dead). */
  spawnedEntityIds: Set<string>;

  /** IDs of entities from this wave that are still alive. */
  aliveEntityIds: Set<string>;

  /** Total enemies still waiting to be spawned (across all groups). */
  remainingToSpawn: number;

  /** Accumulator for spawn pacing. */
  spawnTimer: number;

  /** Time elapsed since this wave became active. */
  elapsedTime: number;

  /** Flattened queue of individual spawns to process. */
  spawnQueue: QueuedSpawn[];
}

/** A single pending spawn in the queue. */
interface QueuedSpawn {
  speciesId: string;
  spawnPointId: string | null; // null = pick from wave/level defaults
  overrides: Partial<EnemyStatOverrides> | null;
}

// ============================================================================
// SPAWN MANAGER
// ============================================================================

export class SpawnManager {
  // Configuration (immutable after construction)
  private readonly config: LevelSpawnConfig;
  private readonly callbacks: SpawnManagerCallbacks;
  private readonly spawnPointMap: Map<string, SpawnPointConfig>;

  // Wave runtime state
  private readonly waveStates: WaveState[];

  // Global counters
  private totalKills = 0;
  private totalSpawned = 0;
  private elapsedTime = 0;

  // Objective flags (set by the hosting level)
  private readonly flags: Map<string, boolean> = new Map();

  // Indicates whether the manager is actively processing waves
  private active = true;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  /**
   * Creates a new SpawnManager.
   *
   * @param config    - The declarative spawn configuration for the level.
   * @param callbacks - Callbacks into the hosting level for entity creation and events.
   */
  constructor(config: LevelSpawnConfig, callbacks: SpawnManagerCallbacks) {
    this.config = config;
    this.callbacks = callbacks;

    // Index spawn points by id for fast lookup
    this.spawnPointMap = new Map();
    for (const sp of config.spawnPoints) {
      this.spawnPointMap.set(sp.id, sp);
    }

    // Initialize wave states
    this.waveStates = config.waves.map((waveConfig) => {
      const totalEnemies = waveConfig.groups.reduce((sum, g) => sum + g.count, 0);
      return {
        config: waveConfig,
        status: 'pending',
        spawnedEntityIds: new Set(),
        aliveEntityIds: new Set(),
        remainingToSpawn: totalEnemies,
        spawnTimer: 0,
        elapsedTime: 0,
        spawnQueue: [],
      };
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Advances the spawn manager by one frame.
   * Call this every frame from the level's `updateLevel()` method.
   *
   * @param deltaTime     - Seconds elapsed since the last frame.
   * @param playerPosition - Current player world position (used for proximity triggers).
   */
  public update(deltaTime: number, playerPosition: Vector3): void {
    if (!this.active) return;

    this.elapsedTime += deltaTime;

    for (const wave of this.waveStates) {
      switch (wave.status) {
        case 'pending':
          if (this.evaluateTrigger(wave.config.trigger, wave, playerPosition)) {
            this.activateWave(wave);
          }
          break;

        case 'active':
          wave.elapsedTime += deltaTime;
          this.processSpawning(wave, deltaTime);

          // Check if all spawns have been emitted
          if (wave.remainingToSpawn <= 0 && wave.spawnQueue.length === 0) {
            wave.status = 'spawning_complete';
          }
          break;

        case 'spawning_complete':
          // Wait for all wave enemies to be killed
          if (wave.aliveEntityIds.size === 0) {
            wave.status = 'complete';
            this.callbacks.onWaveComplete?.(wave.config.waveNumber);
            this.checkAllWavesComplete();
          }
          break;

        case 'complete':
          // Nothing to do
          break;
      }
    }
  }

  /**
   * Manually starts a specific wave, bypassing its trigger condition.
   * Useful for scripted sequences or the `manual` trigger type.
   *
   * @param waveNumber - Zero-indexed wave number to start.
   */
  public startWave(waveNumber: number): void {
    const wave = this.waveStates.find((w) => w.config.waveNumber === waveNumber);
    if (wave && wave.status === 'pending') {
      this.activateWave(wave);
    }
  }

  /**
   * Reports that an enemy entity has been killed.
   * The manager uses this to track wave completion and kill-based triggers.
   *
   * @param entityId - The id returned by `onSpawnEnemy` when the entity was created.
   */
  public reportKill(entityId: string): void {
    this.totalKills++;

    for (const wave of this.waveStates) {
      if (wave.aliveEntityIds.has(entityId)) {
        wave.aliveEntityIds.delete(entityId);
        break; // An entity belongs to exactly one wave
      }
    }
  }

  /**
   * Sets an objective flag. Waves with `objective` triggers will check these.
   *
   * @param flagName - The flag identifier (must match `TriggerCondition.objectiveFlag`).
   * @param value    - Whether the flag is set.
   */
  public setFlag(flagName: string, value: boolean = true): void {
    this.flags.set(flagName, value);
  }

  /**
   * Reads an objective flag.
   *
   * @param flagName - The flag identifier.
   * @returns The current value, or `false` if the flag has never been set.
   */
  public getFlag(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  /**
   * Returns all entities from active/spawning-complete waves that are still alive.
   * Useful for the level to iterate over enemies for AI updates.
   */
  public getActiveEnemyIds(): string[] {
    const ids: string[] = [];
    for (const wave of this.waveStates) {
      if (wave.status === 'active' || wave.status === 'spawning_complete') {
        for (const id of wave.aliveEntityIds) {
          ids.push(id);
        }
      }
    }
    return ids;
  }

  /**
   * Returns the total number of currently alive enemies across all waves.
   */
  public getAliveCount(): number {
    let count = 0;
    for (const wave of this.waveStates) {
      count += wave.aliveEntityIds.size;
    }
    return count;
  }

  /**
   * Returns the total number of kills reported so far.
   */
  public getTotalKills(): number {
    return this.totalKills;
  }

  /**
   * Returns true if all waves have been completed (all enemies spawned and killed).
   */
  public isComplete(): boolean {
    return this.waveStates.every((w) => w.status === 'complete');
  }

  /**
   * Returns true if the specified wave is currently active or has spawning in progress.
   *
   * @param waveNumber - Zero-indexed wave number.
   */
  public isWaveActive(waveNumber: number): boolean {
    const wave = this.waveStates.find((w) => w.config.waveNumber === waveNumber);
    return wave?.status === 'active' || wave?.status === 'spawning_complete';
  }

  /**
   * Returns true if the specified wave has been completed.
   *
   * @param waveNumber - Zero-indexed wave number.
   */
  public isWaveComplete(waveNumber: number): boolean {
    const wave = this.waveStates.find((w) => w.config.waveNumber === waveNumber);
    return wave?.status === 'complete';
  }

  /**
   * Returns the current wave number (the highest-numbered active or spawning-complete wave).
   * Returns -1 if no wave has started yet.
   */
  public getCurrentWaveNumber(): number {
    let highest = -1;
    for (const wave of this.waveStates) {
      if (
        (wave.status === 'active' || wave.status === 'spawning_complete') &&
        wave.config.waveNumber > highest
      ) {
        highest = wave.config.waveNumber;
      }
    }
    return highest;
  }

  /**
   * Pauses all spawning and trigger evaluation.
   * Existing alive enemies remain in the world.
   */
  public pause(): void {
    this.active = false;
  }

  /**
   * Resumes spawning and trigger evaluation after a pause.
   */
  public resume(): void {
    this.active = true;
  }

  /**
   * Resets the manager to its initial state, clearing all wave progress and counters.
   * Does NOT dispose any existing entities -- the level must handle that.
   */
  public reset(): void {
    this.totalKills = 0;
    this.totalSpawned = 0;
    this.elapsedTime = 0;
    this.flags.clear();
    this.active = true;

    for (const wave of this.waveStates) {
      const totalEnemies = wave.config.groups.reduce((sum, g) => sum + g.count, 0);
      wave.status = 'pending';
      wave.spawnedEntityIds.clear();
      wave.aliveEntityIds.clear();
      wave.remainingToSpawn = totalEnemies;
      wave.spawnTimer = 0;
      wave.elapsedTime = 0;
      wave.spawnQueue = [];
    }
  }

  /**
   * Cleans up internal state. Call when the level is disposed.
   * Does NOT dispose any scene objects -- the level owns those.
   */
  public dispose(): void {
    this.active = false;
    for (const wave of this.waveStates) {
      wave.spawnedEntityIds.clear();
      wave.aliveEntityIds.clear();
      wave.spawnQueue = [];
    }
    this.flags.clear();
  }

  // ============================================================================
  // TRIGGER EVALUATION
  // ============================================================================

  private evaluateTrigger(
    trigger: TriggerCondition,
    wave: WaveState,
    playerPosition: Vector3
  ): boolean {
    switch (trigger.type) {
      case 'timer':
        return this.elapsedTime >= (trigger.delay ?? 0);

      case 'killCount':
        return this.totalKills >= (trigger.killCount ?? 0);

      case 'killPercent': {
        const prevWave = this.getPreviousWave(wave.config.waveNumber);
        if (!prevWave) return true; // No previous wave, trigger immediately
        if (prevWave.status === 'pending') return false; // Previous wave hasn't started
        const totalInPrev = prevWave.spawnedEntityIds.size;
        if (totalInPrev === 0) return true;
        const killedInPrev = totalInPrev - prevWave.aliveEntityIds.size;
        const percent = (killedInPrev / totalInPrev) * 100;
        return percent >= (trigger.killPercent ?? 100);
      }

      case 'proximity': {
        if (!trigger.proximityCenter || trigger.proximityRadius === undefined) return false;
        const center = new Vector3(
          trigger.proximityCenter.x,
          trigger.proximityCenter.y,
          trigger.proximityCenter.z
        );
        const dist = Vector3.Distance(playerPosition, center);
        return dist <= trigger.proximityRadius;
      }

      case 'objective':
        return this.flags.get(trigger.objectiveFlag ?? '') === true;

      case 'manual':
        return false; // Only starts via startWave()

      default:
        return false;
    }
  }

  // ============================================================================
  // WAVE ACTIVATION
  // ============================================================================

  private activateWave(wave: WaveState): void {
    wave.status = 'active';
    wave.elapsedTime = 0;
    wave.spawnTimer = 0;

    // Build the spawn queue from groups
    wave.spawnQueue = this.buildSpawnQueue(wave.config);

    this.callbacks.onWaveStart?.(wave.config.waveNumber, wave.config.label);
  }

  /**
   * Flattens wave groups into an interleaved spawn queue so different enemy
   * types appear mixed rather than in sequential blocks.
   */
  private buildSpawnQueue(waveConfig: SpawnWaveConfig): QueuedSpawn[] {
    const queue: QueuedSpawn[] = [];

    // Expand each group into individual spawn entries
    const expanded: QueuedSpawn[][] = waveConfig.groups.map((group) =>
      this.expandGroup(group)
    );

    // Interleave: round-robin across groups for variety
    let remaining = true;
    let index = 0;
    while (remaining) {
      remaining = false;
      for (const groupEntries of expanded) {
        if (index < groupEntries.length) {
          queue.push(groupEntries[index]);
          remaining = true;
        }
      }
      index++;
    }

    return queue;
  }

  private expandGroup(group: SpawnGroupConfig): QueuedSpawn[] {
    const entries: QueuedSpawn[] = [];
    const spawnPointIds = group.spawnPointIds ?? null;

    for (let i = 0; i < group.count; i++) {
      entries.push({
        speciesId: group.speciesId,
        spawnPointId: spawnPointIds
          ? spawnPointIds[i % spawnPointIds.length]
          : null,
        overrides: group.overrides ?? null,
      });
    }

    return entries;
  }

  // ============================================================================
  // SPAWN PROCESSING
  // ============================================================================

  private processSpawning(wave: WaveState, deltaTime: number): void {
    if (wave.spawnQueue.length === 0) return;

    const interval = wave.config.spawnInterval ?? this.config.defaultSpawnInterval ?? 1.0;
    const maxConcurrent = wave.config.maxConcurrent ?? Infinity;
    const globalMax = this.config.maxGlobalEnemies ?? 40;

    wave.spawnTimer += deltaTime;

    while (wave.spawnTimer >= interval && wave.spawnQueue.length > 0) {
      // Check concurrent limits
      if (wave.aliveEntityIds.size >= maxConcurrent) break;
      if (this.getAliveCount() >= globalMax) break;

      wave.spawnTimer -= interval;

      const queued = wave.spawnQueue.shift()!;
      this.spawnSingleEnemy(wave, queued);
    }
  }

  private spawnSingleEnemy(wave: WaveState, queued: QueuedSpawn): void {
    // Resolve spawn point
    const spawnPoint = this.resolveSpawnPoint(
      queued.spawnPointId,
      wave.config.spawnPointIds ?? null,
      queued.speciesId
    );

    // Calculate position
    let position: Vector3;
    let facingAngle: number;

    if (spawnPoint) {
      position = this.randomizePosition(spawnPoint);
      facingAngle = spawnPoint.facingAngle;
    } else {
      // Fallback: spawn at origin with random offset (should not happen with good config)
      position = new Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
      facingAngle = 0;
      console.warn(
        `[SpawnManager] No spawn point resolved for species "${queued.speciesId}" ` +
        `in wave ${wave.config.waveNumber}. Using fallback position.`
      );
    }

    // Combine overrides: spawn-point overrides * group overrides
    const combinedOverrides = this.combineOverrides(
      spawnPoint?.overrides ?? null,
      queued.overrides
    );

    // Call back to the level to create the entity
    const entityId = this.callbacks.onSpawnEnemy(
      queued.speciesId,
      position,
      facingAngle,
      combinedOverrides
    );

    if (entityId) {
      wave.spawnedEntityIds.add(entityId);
      wave.aliveEntityIds.add(entityId);
      wave.remainingToSpawn--;
      this.totalSpawned++;
    } else {
      // Spawning failed -- put it back at the front of the queue to retry next frame
      wave.spawnQueue.unshift(queued);
    }
  }

  // ============================================================================
  // SPAWN POINT RESOLUTION
  // ============================================================================

  /**
   * Resolves which spawn point to use for a given spawn entry.
   * Priority: queued entry > wave config > level config.
   */
  private resolveSpawnPoint(
    preferredId: string | null,
    waveLevelIds: string[] | null,
    speciesId: string
  ): SpawnPointConfig | null {
    // Try the preferred point first
    if (preferredId) {
      const point = this.spawnPointMap.get(preferredId);
      if (point && this.isSpeciesAllowed(point, speciesId)) {
        return point;
      }
    }

    // Try wave-level points
    if (waveLevelIds && waveLevelIds.length > 0) {
      const eligible = waveLevelIds
        .map((id) => this.spawnPointMap.get(id))
        .filter((p): p is SpawnPointConfig => p !== undefined && this.isSpeciesAllowed(p, speciesId));

      if (eligible.length > 0) {
        return eligible[Math.floor(Math.random() * eligible.length)];
      }
    }

    // Fall back to all level spawn points
    const allEligible = this.config.spawnPoints.filter((p) =>
      this.isSpeciesAllowed(p, speciesId)
    );
    if (allEligible.length > 0) {
      return allEligible[Math.floor(Math.random() * allEligible.length)];
    }

    return null;
  }

  private isSpeciesAllowed(point: SpawnPointConfig, speciesId: string): boolean {
    if (!point.allowedSpecies || point.allowedSpecies.length === 0) return true;
    return point.allowedSpecies.includes(speciesId);
  }

  /**
   * Returns a randomized world position within the spawn point's radius.
   */
  private randomizePosition(point: SpawnPointConfig): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * point.radius;
    return new Vector3(
      point.position.x + Math.cos(angle) * dist,
      point.position.y,
      point.position.z + Math.sin(angle) * dist
    );
  }

  // ============================================================================
  // OVERRIDE COMBINATION
  // ============================================================================

  /**
   * Combines spawn-point overrides with group-level overrides.
   * Multiplier fields are multiplied together; `scale` is multiplied.
   */
  private combineOverrides(
    pointOverrides: Partial<EnemyStatOverrides> | null | undefined,
    groupOverrides: Partial<EnemyStatOverrides> | null | undefined
  ): Partial<EnemyStatOverrides> | null {
    if (!pointOverrides && !groupOverrides) return null;

    const result: Partial<EnemyStatOverrides> = {};

    const p = pointOverrides ?? {};
    const g = groupOverrides ?? {};

    if (p.healthMultiplier !== undefined || g.healthMultiplier !== undefined) {
      result.healthMultiplier = (p.healthMultiplier ?? 1) * (g.healthMultiplier ?? 1);
    }
    if (p.damageMultiplier !== undefined || g.damageMultiplier !== undefined) {
      result.damageMultiplier = (p.damageMultiplier ?? 1) * (g.damageMultiplier ?? 1);
    }
    if (p.speedMultiplier !== undefined || g.speedMultiplier !== undefined) {
      result.speedMultiplier = (p.speedMultiplier ?? 1) * (g.speedMultiplier ?? 1);
    }
    if (p.scale !== undefined || g.scale !== undefined) {
      result.scale = (p.scale ?? 1) * (g.scale ?? 1);
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  // ============================================================================
  // WAVE HELPERS
  // ============================================================================

  /**
   * Finds the wave state for the wave immediately before the given wave number.
   */
  private getPreviousWave(waveNumber: number): WaveState | null {
    if (waveNumber <= 0) return null;

    // Look for the wave with the largest waveNumber that is still < waveNumber
    let best: WaveState | null = null;
    for (const w of this.waveStates) {
      if (
        w.config.waveNumber < waveNumber &&
        (best === null || w.config.waveNumber > best.config.waveNumber)
      ) {
        best = w;
      }
    }
    return best;
  }

  /**
   * Checks whether all waves are complete and fires the callback if so.
   */
  private checkAllWavesComplete(): void {
    if (this.waveStates.every((w) => w.status === 'complete')) {
      this.callbacks.onAllWavesComplete?.();
    }
  }
}
