/**
 * SpawnManagerZod - Runtime wave/spawn orchestrator using Zod-validated configs
 *
 * Consumes {@link LevelSpawnConfig} from SpawnConfigZod.ts and manages the full
 * lifecycle of enemy waves: evaluating triggers, pacing spawns, tracking entities,
 * and progressing through waves.
 *
 * Usage:
 * ```ts
 * import { SpawnManagerZod } from './SpawnManagerZod';
 * import { anchorStationSpawnConfig } from '../anchor-station/spawnConfig';
 *
 * const manager = new SpawnManagerZod(anchorStationSpawnConfig, scene, world);
 * manager.initialize();
 *
 * // In update loop:
 * manager.update(deltaTime, playerPosition);
 *
 * // When enemy dies:
 * manager.reportKill(entityId);
 *
 * // Cleanup:
 * manager.dispose();
 * ```
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { World } from 'miniplex';

import { getEventBus } from '../../core/EventBus';
import { getLogger } from '../../core/Logger';
import { createAlienEntityAsync, ALIEN_SPECIES, type AlienSpecies } from '../../entities/aliens';

import {
  type LevelSpawnConfig,
  type SpawnWave,
  type SpawnUnit,
  type TriggerType,
  degreesToRadians,
  parseTriggerValue,
} from './SpawnConfigZod';

const log = getLogger('SpawnManagerZod');

// ============================================================================
// TYPES
// ============================================================================

/** Runtime state for tracking spawned entities */
interface SpawnedEntity {
  id: string;
  waveId: string;
  speciesId: string;
  isAlive: boolean;
}

/** Runtime state for a wave */
interface WaveState {
  config: SpawnWave;
  status: 'pending' | 'active' | 'spawning_complete' | 'complete';
  spawnedCount: number;
  aliveCount: number;
  spawnTimer: number;
  elapsedTime: number;
  unitQueues: Map<string, { unit: SpawnUnit; remaining: number; delayTimer: number }>;
}

/** Callbacks for level integration */
export interface SpawnManagerZodCallbacks {
  /** Called when a single enemy is spawned */
  onSpawnEnemy?: (speciesId: string, entityId: string, position: Vector3) => void;
  /** Called when a wave begins */
  onWaveStart?: (waveId: string, label?: string) => void;
  /** Called when all enemies in a wave are killed */
  onWaveComplete?: (waveId: string) => void;
  /** Called when all waves are complete */
  onAllWavesComplete?: () => void;
}

// ============================================================================
// SPAWN MANAGER
// ============================================================================

/**
 * SpawnManagerZod orchestrates enemy wave spawning using Zod-validated configs.
 *
 * Key features:
 * - Runtime validation via Zod schemas
 * - Multiple trigger types (immediate, timer, objective, proximity, manual)
 * - Entity tracking and kill reporting
 * - EventBus integration for game-wide events
 * - Pause/resume support for cutscenes
 */
export class SpawnManagerZod {
  private readonly config: LevelSpawnConfig;
  private readonly scene: Scene;
  private readonly world: World;
  private readonly callbacks: SpawnManagerZodCallbacks;

  // Wave runtime state
  private waveStates: Map<string, WaveState> = new Map();

  // Entity tracking
  private spawnedEntities: Map<string, SpawnedEntity> = new Map();
  private entityIdCounter = 0;

  // Global state
  private elapsedTime = 0;
  private totalKills = 0;
  private totalSpawned = 0;
  private active = true;

  // Objective flags for trigger evaluation
  private flags: Map<string, boolean> = new Map();

  // Subscriptions for cleanup
  private eventSubscriptions: Array<() => void> = [];

  constructor(
    config: LevelSpawnConfig,
    scene: Scene,
    world: World,
    callbacks: SpawnManagerZodCallbacks = {}
  ) {
    this.config = config;
    this.scene = scene;
    this.world = world;
    this.callbacks = callbacks;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initializes the spawn manager.
   * Sets up wave states, subscribes to events, and starts immediate waves.
   */
  initialize(): void {
    log.info(`Initializing SpawnManagerZod for level: ${this.config.levelId}`);

    // Initialize wave states
    for (const wave of this.config.waves) {
      const unitQueues = new Map<
        string,
        { unit: SpawnUnit; remaining: number; delayTimer: number }
      >();

      for (const unit of wave.units) {
        unitQueues.set(`${unit.species}_${unit.spawnPoint}`, {
          unit,
          remaining: unit.count,
          delayTimer: unit.delay,
        });
      }

      this.waveStates.set(wave.id, {
        config: wave,
        status: 'pending',
        spawnedCount: 0,
        aliveCount: 0,
        spawnTimer: 0,
        elapsedTime: 0,
        unitQueues,
      });
    }

    // Subscribe to objective completion events
    const eventBus = getEventBus();
    const unsubObjective = eventBus.on('OBJECTIVE_COMPLETED', (event) => {
      this.setFlag(event.objectiveId, true);
    });
    this.eventSubscriptions.push(unsubObjective);

    // Start immediate waves
    for (const [waveId, state] of this.waveStates) {
      if (state.config.trigger === 'immediate') {
        this.activateWave(waveId);
      }
    }

    log.info(
      `SpawnManagerZod initialized with ${this.config.waves.length} waves, ` +
        `${Object.keys(this.config.spawnPoints).length} spawn points`
    );
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Updates the spawn manager each frame.
   *
   * @param deltaTime - Seconds since last frame
   * @param playerPosition - Current player position for proximity triggers
   */
  update(deltaTime: number, playerPosition: Vector3): void {
    if (!this.active) return;

    this.elapsedTime += deltaTime;

    for (const [waveId, state] of this.waveStates) {
      switch (state.status) {
        case 'pending':
          if (this.evaluateTrigger(state.config, playerPosition)) {
            this.activateWave(waveId);
          }
          break;

        case 'active':
          state.elapsedTime += deltaTime;
          this.processSpawning(waveId, state, deltaTime);

          // Check if all spawning is done
          let allSpawned = true;
          for (const queue of state.unitQueues.values()) {
            if (queue.remaining > 0) {
              allSpawned = false;
              break;
            }
          }
          if (allSpawned) {
            state.status = 'spawning_complete';
            log.debug(`Wave ${waveId}: all enemies spawned, awaiting kills`);
          }
          break;

        case 'spawning_complete':
          // Wait for all enemies to be killed
          if (state.aliveCount === 0) {
            this.completeWave(waveId);
          }
          break;

        case 'complete':
          // Nothing to do
          break;
      }
    }
  }

  // ============================================================================
  // WAVE CONTROL
  // ============================================================================

  /**
   * Manually triggers a wave by ID.
   * Only works for waves with 'manual' trigger type.
   */
  triggerWave(waveId: string): void {
    const state = this.waveStates.get(waveId);
    if (!state) {
      log.warn(`Cannot trigger unknown wave: ${waveId}`);
      return;
    }
    if (state.status !== 'pending') {
      log.warn(`Wave ${waveId} is not pending (status: ${state.status})`);
      return;
    }

    this.activateWave(waveId);
  }

  /**
   * Activates a wave, starting its spawning process.
   */
  private activateWave(waveId: string): void {
    const state = this.waveStates.get(waveId);
    if (!state) return;

    state.status = 'active';
    state.elapsedTime = 0;
    state.spawnTimer = 0;

    log.info(`Wave ${waveId} activated: ${state.config.label ?? 'unnamed'}`);

    // Emit event
    getEventBus().emit({
      type: 'WAVE_START',
      levelId: this.config.levelId,
      waveNumber: this.config.waves.findIndex((w) => w.id === waveId),
      label: state.config.label,
    });

    this.callbacks.onWaveStart?.(waveId, state.config.label);
  }

  /**
   * Completes a wave and triggers the next one if specified.
   */
  private completeWave(waveId: string): void {
    const state = this.waveStates.get(waveId);
    if (!state) return;

    state.status = 'complete';
    log.info(`Wave ${waveId} completed`);

    // Emit event
    getEventBus().emit({
      type: 'WAVE_COMPLETE',
      levelId: this.config.levelId,
      waveNumber: this.config.waves.findIndex((w) => w.id === waveId),
    });

    this.callbacks.onWaveComplete?.(waveId);

    // Handle onComplete action
    if (state.config.onComplete) {
      if (state.config.onComplete === 'victory') {
        this.handleVictory();
      } else {
        // Trigger next wave
        const nextState = this.waveStates.get(state.config.onComplete);
        if (nextState && nextState.status === 'pending') {
          this.activateWave(state.config.onComplete);
        }
      }
    }

    // Check if all waves complete
    this.checkAllWavesComplete();
  }

  /**
   * Handles level victory when last wave has onComplete: 'victory'.
   */
  private handleVictory(): void {
    log.info(`Level ${this.config.levelId}: VICTORY triggered`);

    getEventBus().emit({
      type: 'ALL_WAVES_COMPLETE',
      levelId: this.config.levelId,
    });

    this.callbacks.onAllWavesComplete?.();
  }

  /**
   * Checks if all waves are complete and fires callback.
   */
  private checkAllWavesComplete(): void {
    for (const state of this.waveStates.values()) {
      if (state.status !== 'complete') {
        return;
      }
    }

    log.info(`All waves complete for level: ${this.config.levelId}`);
    this.callbacks.onAllWavesComplete?.();
  }

  // ============================================================================
  // TRIGGER EVALUATION
  // ============================================================================

  /**
   * Evaluates whether a wave's trigger condition is met.
   */
  private evaluateTrigger(wave: SpawnWave, playerPosition: Vector3): boolean {
    const triggerData = parseTriggerValue(
      wave.trigger,
      wave.triggerValue,
      wave.triggerPosition
    );

    switch (wave.trigger) {
      case 'immediate':
        return true;

      case 'timer':
        return this.elapsedTime >= (triggerData.delay ?? 0);

      case 'objective':
        return this.flags.get(triggerData.objectiveFlag ?? '') === true;

      case 'proximity':
        if (!triggerData.proximityCenter) return false;
        const center = new Vector3(
          triggerData.proximityCenter.x,
          triggerData.proximityCenter.y,
          triggerData.proximityCenter.z
        );
        const dist = Vector3.Distance(playerPosition, center);
        return dist <= (triggerData.proximityRadius ?? 30);

      case 'manual':
        return false;

      default:
        return false;
    }
  }

  // ============================================================================
  // SPAWNING
  // ============================================================================

  /**
   * Processes spawning for an active wave.
   */
  private processSpawning(waveId: string, state: WaveState, deltaTime: number): void {
    const interval =
      state.config.spawnInterval ?? this.config.defaultSpawnInterval;
    const maxConcurrent = state.config.maxConcurrent ?? Infinity;
    const globalMax = this.config.maxGlobalEnemies;

    state.spawnTimer += deltaTime;

    // Process each unit queue
    for (const [key, queue] of state.unitQueues) {
      if (queue.remaining <= 0) continue;

      // Check delay
      if (queue.delayTimer > 0) {
        queue.delayTimer -= deltaTime;
        continue;
      }

      // Check spawn interval
      if (state.spawnTimer < interval) continue;

      // Check concurrent limits
      if (state.aliveCount >= maxConcurrent) continue;
      if (this.getAliveCount() >= globalMax) continue;

      // Spawn one enemy
      this.spawnUnit(waveId, state, queue.unit);
      queue.remaining--;
    }

    // Reset spawn timer when interval passes
    if (state.spawnTimer >= interval) {
      state.spawnTimer = 0;
    }
  }

  /**
   * Spawns a single enemy unit.
   */
  private async spawnUnit(
    waveId: string,
    state: WaveState,
    unit: SpawnUnit
  ): Promise<void> {
    const spawnPoint = this.config.spawnPoints[unit.spawnPoint];
    if (!spawnPoint) {
      log.warn(`Unknown spawn point: ${unit.spawnPoint}`);
      return;
    }

    // Calculate position with spread
    const [baseX, baseY, baseZ] = spawnPoint.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * unit.spread;
    const position = new Vector3(
      baseX + Math.cos(angle) * dist,
      baseY,
      baseZ + Math.sin(angle) * dist
    );

    // Map species to ALIEN_SPECIES
    const speciesId = this.mapSpeciesId(unit.species);
    const species = ALIEN_SPECIES[speciesId];
    if (!species) {
      log.warn(`Unknown species: ${unit.species} (mapped to ${speciesId})`);
      return;
    }

    // Generate entity ID
    const entityId = `spawn_${this.config.levelId}_${this.entityIdCounter++}`;

    try {
      // Create the entity
      const entity = await createAlienEntityAsync(
        this.scene,
        species,
        position,
        Date.now()
      );

      // Apply overrides if present
      if (unit.overrides) {
        if (unit.overrides.scale && entity.renderable?.mesh) {
          const baseScale = entity.transform?.scale?.x ?? 1;
          const newScale = baseScale * unit.overrides.scale;
          entity.renderable.mesh.scaling.setAll(newScale);
        }
        if (unit.overrides.healthMultiplier && entity.health) {
          const newHealth = entity.health.max * unit.overrides.healthMultiplier;
          entity.health.max = newHealth;
          entity.health.current = newHealth;
        }
      }

      // Set rotation
      const facingRadians = degreesToRadians(spawnPoint.rotation);
      if (entity.renderable?.mesh) {
        entity.renderable.mesh.rotation.y = facingRadians;
      }

      // Track entity
      this.spawnedEntities.set(entityId, {
        id: entityId,
        waveId,
        speciesId: unit.species,
        isAlive: true,
      });

      state.spawnedCount++;
      state.aliveCount++;
      this.totalSpawned++;

      // Emit event
      getEventBus().emit({
        type: 'ENEMY_SPAWNED',
        levelId: this.config.levelId,
        speciesId: unit.species,
        entityId,
        position: { x: position.x, y: position.y, z: position.z },
        facingAngle: facingRadians,
      });

      this.callbacks.onSpawnEnemy?.(unit.species, entityId, position);

      log.debug(
        `Spawned ${unit.species} at ${unit.spawnPoint} (${entityId})`
      );
    } catch (error) {
      log.error(`Failed to spawn ${unit.species}: ${error}`);
    }
  }

  /**
   * Maps Zod species enum to ALIEN_SPECIES keys.
   */
  private mapSpeciesId(species: string): string {
    // Map simplified names to ALIEN_SPECIES keys
    const mapping: Record<string, string> = {
      drone: 'skitterer',
      soldier: 'spitter',
      warrior: 'warrior',
      spitter: 'spitter',
      ice_drone: 'skitterer', // Ice variants use same base with overrides
      ice_warrior: 'warrior',
    };
    return mapping[species] ?? species;
  }

  // ============================================================================
  // KILL TRACKING
  // ============================================================================

  /**
   * Reports that an enemy has been killed.
   * Updates wave completion tracking.
   */
  reportKill(entityId: string): void {
    const entity = this.spawnedEntities.get(entityId);
    if (!entity || !entity.isAlive) return;

    entity.isAlive = false;
    this.totalKills++;

    const state = this.waveStates.get(entity.waveId);
    if (state) {
      state.aliveCount--;
    }

    log.debug(`Kill reported: ${entityId} (total: ${this.totalKills})`);
  }

  // ============================================================================
  // FLAG MANAGEMENT
  // ============================================================================

  /**
   * Sets an objective flag for trigger evaluation.
   */
  setFlag(flagName: string, value: boolean = true): void {
    this.flags.set(flagName, value);
    log.debug(`Flag set: ${flagName} = ${value}`);
  }

  /**
   * Gets an objective flag value.
   */
  getFlag(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Returns IDs of all alive enemies from active waves.
   */
  getActiveEnemyIds(): string[] {
    const ids: string[] = [];
    for (const [id, entity] of this.spawnedEntities) {
      if (entity.isAlive) {
        ids.push(id);
      }
    }
    return ids;
  }

  /**
   * Returns count of all alive enemies.
   */
  getAliveCount(): number {
    let count = 0;
    for (const entity of this.spawnedEntities.values()) {
      if (entity.isAlive) count++;
    }
    return count;
  }

  /**
   * Returns total kills reported.
   */
  getTotalKills(): number {
    return this.totalKills;
  }

  /**
   * Returns true if all waves are complete.
   */
  isComplete(): boolean {
    for (const state of this.waveStates.values()) {
      if (state.status !== 'complete') return false;
    }
    return true;
  }

  /**
   * Returns true if specified wave is currently active.
   */
  isWaveActive(waveId: string): boolean {
    const state = this.waveStates.get(waveId);
    return state?.status === 'active' || state?.status === 'spawning_complete';
  }

  /**
   * Returns true if specified wave is complete.
   */
  isWaveComplete(waveId: string): boolean {
    const state = this.waveStates.get(waveId);
    return state?.status === 'complete';
  }

  /**
   * Returns the current active wave ID, or null if none.
   */
  getCurrentWaveId(): string | null {
    for (const [waveId, state] of this.waveStates) {
      if (state.status === 'active' || state.status === 'spawning_complete') {
        return waveId;
      }
    }
    return null;
  }

  // ============================================================================
  // CONTROL
  // ============================================================================

  /**
   * Pauses all spawning and trigger evaluation.
   */
  pause(): void {
    this.active = false;
    log.debug('SpawnManagerZod paused');
  }

  /**
   * Resumes spawning after a pause.
   */
  resume(): void {
    this.active = true;
    log.debug('SpawnManagerZod resumed');
  }

  /**
   * Resets the manager to initial state.
   */
  reset(): void {
    this.spawnedEntities.clear();
    this.flags.clear();
    this.elapsedTime = 0;
    this.totalKills = 0;
    this.totalSpawned = 0;
    this.entityIdCounter = 0;
    this.active = true;

    // Reset wave states
    for (const [waveId, state] of this.waveStates) {
      state.status = 'pending';
      state.spawnedCount = 0;
      state.aliveCount = 0;
      state.spawnTimer = 0;
      state.elapsedTime = 0;

      // Rebuild unit queues
      state.unitQueues.clear();
      for (const unit of state.config.units) {
        state.unitQueues.set(`${unit.species}_${unit.spawnPoint}`, {
          unit,
          remaining: unit.count,
          delayTimer: unit.delay,
        });
      }
    }

    log.info('SpawnManagerZod reset');
  }

  /**
   * Cleans up all resources.
   */
  dispose(): void {
    this.active = false;

    // Unsubscribe from events
    for (const unsub of this.eventSubscriptions) {
      unsub();
    }
    this.eventSubscriptions = [];

    // Clear state
    this.spawnedEntities.clear();
    this.waveStates.clear();
    this.flags.clear();

    log.info('SpawnManagerZod disposed');
  }

  // ============================================================================
  // WAVE COMPLETION CHECKING (for killPercent triggers if needed)
  // ============================================================================

  /**
   * Checks and updates wave completion based on current alive counts.
   * Called internally during update.
   */
  checkWaveCompletion(): void {
    for (const [waveId, state] of this.waveStates) {
      if (state.status === 'spawning_complete' && state.aliveCount === 0) {
        this.completeWave(waveId);
      }
    }
  }
}
