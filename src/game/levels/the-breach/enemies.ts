/**
 * TheBreachLevel - Enemy Management
 *
 * Contains enemy spawning, AI behavior, and combat logic.
 * Uses GLB models from AssetManager when available.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('TheBreachEnemies');

import {
  type DifficultyLevel,
  loadDifficultySetting,
  scaleDetectionRange,
  scaleEnemyDamage,
  scaleEnemyFireRate,
  scaleEnemyHealth,
} from '../../core/DifficultySettings';
import { createEntity, removeEntity } from '../../core/ecs';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { ENEMY_DETECTION_RANGE, ENEMY_STATS } from './constants';
import type { Enemy, EnemyType, HiveZone } from './types';

// Map TheBreachLevel enemy types to alien species for GLB loading
const ENEMY_TYPE_TO_SPECIES: Record<EnemyType, string> = {
  drone: 'skitterer', // Fast crawler -> spider.glb
  grunt: 'lurker', // Tall stalker -> scout.glb
  spitter: 'spewer', // Armored ranged -> soldier.glb
  brute: 'broodmother', // Large boss type -> tentakel.glb
};

// GLB model scale factors per enemy type
const ENEMY_GLB_SCALE: Record<EnemyType, number> = {
  drone: 0.5,
  grunt: 0.7,
  spitter: 0.6,
  brute: 1.0,
};

// Track if GLB preloading has been done
let glbAssetsPreloaded = false;

// Current difficulty level for enemy scaling
let currentDifficulty: DifficultyLevel = loadDifficultySetting();

/**
 * Update the current difficulty level for enemy spawning and combat
 */
export function setEnemyDifficulty(difficulty: DifficultyLevel): void {
  currentDifficulty = difficulty;
  log.info(`Difficulty set to: ${difficulty}`);
}

/**
 * Get current difficulty level
 */
export function getEnemyDifficulty(): DifficultyLevel {
  return currentDifficulty;
}

// ============================================================================
// GLB PRELOADING
// ============================================================================

/**
 * Preload all enemy GLB models for faster spawning
 */
export async function preloadEnemyModels(scene: Scene): Promise<void> {
  if (glbAssetsPreloaded) return;

  log.info('Preloading enemy GLB models...');

  const speciesIds = Object.values(ENEMY_TYPE_TO_SPECIES);
  const uniqueSpecies = [...new Set(speciesIds)];

  try {
    await Promise.all(
      uniqueSpecies.map(async (speciesId) => {
        const assetName = SPECIES_TO_ASSET[speciesId];
        if (assetName) {
          await AssetManager.loadAsset('aliens', assetName, scene);
          log.info(`Preloaded GLB for ${speciesId} -> ${assetName}`);
        }
      })
    );
    glbAssetsPreloaded = true;
    log.info('All enemy GLB models preloaded');
  } catch (error) {
    log.warn('Some GLB models failed to preload:', error);
  }
}

// ============================================================================
// ENEMY SPAWNING
// ============================================================================

/**
 * Try to create a GLB-based enemy mesh
 */
function createGLBEnemyMesh(scene: Scene, type: EnemyType, index: number): TransformNode | null {
  const speciesId = ENEMY_TYPE_TO_SPECIES[type];
  const assetName = SPECIES_TO_ASSET[speciesId];

  if (!assetName) {
    log.warn(`No asset mapping for ${type}/${speciesId}`);
    return null;
  }

  const instance = AssetManager.createInstance(
    'aliens',
    assetName,
    `enemy_${type}_${index}`,
    scene
  );

  if (instance) {
    // Apply appropriate scale for this enemy type
    const scale = ENEMY_GLB_SCALE[type];
    instance.scaling.setAll(scale);
    log.info(`Created GLB instance for ${type} (${assetName}), scale=${scale}`);
  }

  return instance;
}

/**
 * Spawn an enemy at the specified position
 * Uses GLB models if preloaded, otherwise falls back to procedural meshes
 * Enemy stats are scaled based on current difficulty setting
 */
export function spawnEnemy(
  scene: Scene,
  position: Vector3,
  type: EnemyType,
  zone: HiveZone,
  existingCount: number
): Enemy {
  const baseStats = ENEMY_STATS[type];

  // Apply difficulty scaling to enemy stats
  const scaledHealth = scaleEnemyHealth(baseStats.health, currentDifficulty);

  // Use GLB models for all enemies - no fallbacks
  const mesh = createGLBEnemyMesh(scene, type, existingCount);
  if (!mesh) {
    const speciesId = ENEMY_TYPE_TO_SPECIES[type];
    const assetName = SPECIES_TO_ASSET[speciesId];
    throw new Error(
      `[TheBreachLevel/enemies] Failed to create GLB mesh for enemy type '${type}' ` +
        `(species: ${speciesId}, asset: ${assetName}). ` +
        `Ensure GLB models are preloaded via preloadEnemyModels().`
    );
  }

  mesh.position = position.clone();

  const entity = createEntity({
    transform: {
      position: position.clone(),
      rotation: Vector3.Zero(),
      scale: new Vector3(1, 1, 1),
    },
    health: {
      current: scaledHealth,
      max: scaledHealth,
      regenRate: 0,
    },
    tags: {
      enemy: true,
    },
  });

  return {
    entity,
    mesh,
    type,
    health: scaledHealth,
    maxHealth: scaledHealth,
    position: position.clone(),
    velocity: Vector3.Zero(),
    attackCooldown: 0,
    state: 'patrol',
    zone,
  };
}

/**
 * Spawn an enemy asynchronously (loads GLB if needed)
 * Use this for initial spawning when you can await
 */
export async function spawnEnemyAsync(
  scene: Scene,
  position: Vector3,
  type: EnemyType,
  zone: HiveZone,
  existingCount: number
): Promise<Enemy> {
  // Ensure models are preloaded
  if (!glbAssetsPreloaded) {
    await preloadEnemyModels(scene);
  }

  return spawnEnemy(scene, position, type, zone, existingCount);
}

// ============================================================================
// ENEMY AI
// ============================================================================

/**
 * Update a single enemy's AI state and behavior
 * Detection range is scaled based on current difficulty setting
 */
export function updateEnemyAI(enemy: Enemy, playerPosition: Vector3, deltaTime: number): void {
  if (enemy.state === 'dead') return;

  const stats = ENEMY_STATS[enemy.type];
  const dist = Vector3.Distance(playerPosition, enemy.position);

  // Apply difficulty scaling to detection range
  const scaledDetectionRange = scaleDetectionRange(ENEMY_DETECTION_RANGE, currentDifficulty);

  // State transitions
  if (dist < stats.attackRange && enemy.attackCooldown <= 0) {
    enemy.state = 'attack';
  } else if (dist < scaledDetectionRange) {
    enemy.state = 'chase';
  } else {
    enemy.state = 'patrol';
  }

  // Behavior
  switch (enemy.state) {
    case 'chase': {
      const dir = playerPosition.subtract(enemy.position).normalize();
      enemy.velocity = dir.scale(stats.speed);
      enemy.position.addInPlace(enemy.velocity.scale(deltaTime));
      enemy.mesh.position = enemy.position;
      // lookAt may not work for all TransformNodes, wrap in try-catch
      try {
        if ('lookAt' in enemy.mesh && typeof enemy.mesh.lookAt === 'function') {
          enemy.mesh.lookAt(playerPosition);
        }
      } catch {
        // lookAt not supported, manually rotate
        const angle = Math.atan2(dir.x, dir.z);
        enemy.mesh.rotation.y = angle;
      }
      break;
    }

    case 'patrol': {
      // Simple wandering based on time and entity id hash
      const time = performance.now() / 1000;
      // Use first 8 chars of entity id as unique offset
      const idHash = parseInt(enemy.entity.id.substring(0, 8), 16) || 0;
      const wanderAngle = Math.sin(time + (idHash % 1000) * 0.001) * 0.5;
      enemy.position.x += Math.sin(wanderAngle) * stats.speed * 0.1 * deltaTime;
      enemy.position.z += Math.cos(wanderAngle) * stats.speed * 0.1 * deltaTime;
      enemy.mesh.position = enemy.position;
      break;
    }

    case 'attack':
      // Attack is handled separately to allow for damage callbacks
      break;
  }

  // Cooldown
  enemy.attackCooldown -= deltaTime * 1000;
}

/**
 * Check if enemy can attack and calculate damage
 * Damage is scaled based on current difficulty setting
 * @returns Damage to deal to player, or 0 if not attacking
 */
export function getEnemyAttackDamage(enemy: Enemy, playerPosition: Vector3): number {
  if (enemy.state !== 'attack' || enemy.attackCooldown > 0) {
    return 0;
  }

  const stats = ENEMY_STATS[enemy.type];
  const dist = Vector3.Distance(playerPosition, enemy.position);

  if (dist < stats.attackRange * 1.5) {
    // Reset cooldown: Higher attack rate = shorter cooldown
    // Apply difficulty scaling to fire rate
    const scaledFireRate = scaleEnemyFireRate(stats.fireRate, currentDifficulty);
    enemy.attackCooldown = 1000 / scaledFireRate + stats.attackRange * 50;

    // Apply difficulty scaling to damage
    return scaleEnemyDamage(stats.damage, currentDifficulty);
  }

  return 0;
}

// ============================================================================
// ENEMY DAMAGE
// ============================================================================

/**
 * Damage an enemy and handle death
 * @param enemy - The enemy to damage
 * @param damage - Amount of damage to deal
 * @param hitDirection - Optional direction of the hit (for knockback)
 * @param isCritical - Whether this was a critical hit
 * @returns True if the enemy died
 */
export function damageEnemy(
  enemy: Enemy,
  damage: number,
  hitDirection?: Vector3,
  isCritical: boolean = false
): boolean {
  enemy.health -= damage;

  // Apply damage feedback effects (hit flash, knockback, damage number, screen shake)
  damageFeedback.applyDamageFeedback(enemy.mesh, damage, hitDirection, isCritical);

  // Emit alien splatter on hit
  particleManager.emitAlienSplatter(enemy.position, 0.7);

  if (enemy.health <= 0) {
    // Emit alien death burst
    particleManager.emitAlienDeath(enemy.position, 1.2);

    enemy.state = 'dead';
    enemy.mesh.dispose();
    removeEntity(enemy.entity);
    return true;
  }

  return false;
}

// ============================================================================
// INITIAL SPAWN CONFIGURATIONS
// ============================================================================

/**
 * Get spawn configuration for initial enemies in each zone
 */
export function getInitialSpawnConfig(): Array<{
  position: Vector3;
  type: EnemyType;
  zone: HiveZone;
}> {
  const spawns: Array<{ position: Vector3; type: EnemyType; zone: HiveZone }> = [];

  // Upper hive - drones only
  for (let i = 0; i < 5; i++) {
    spawns.push({
      position: new Vector3((Math.random() - 0.5) * 3, -10 - i * 8, 20 + i * 8),
      type: 'drone',
      zone: 'upper',
    });
  }

  // Mid hive - mixed
  for (let i = 0; i < 8; i++) {
    const type: EnemyType = Math.random() < 0.6 ? 'grunt' : 'spitter';
    spawns.push({
      position: new Vector3((Math.random() - 0.5) * 6, -55 - i * 5, 70 + i * 6),
      type,
      zone: 'mid',
    });
  }

  // Lower hive - all types including brutes
  for (let i = 0; i < 10; i++) {
    const rand = Math.random();
    const type: EnemyType =
      rand < 0.3 ? 'drone' : rand < 0.6 ? 'grunt' : rand < 0.85 ? 'spitter' : 'brute';
    spawns.push({
      position: new Vector3((Math.random() - 0.5) * 8, -100 - i * 4, 115 + i * 5),
      type,
      zone: 'lower',
    });
  }

  return spawns;
}

// ============================================================================
// HIT DETECTION
// ============================================================================

/**
 * Check if a raycast from the player hits an enemy
 * @returns The enemy that was hit, or null
 */
export function checkEnemyHit(
  enemies: Enemy[],
  playerPosition: Vector3,
  forward: Vector3,
  maxDistance: number = 50
): Enemy | null {
  for (const enemy of enemies) {
    if (enemy.state === 'dead') continue;

    const toEnemy = enemy.position.subtract(playerPosition);
    const dist = toEnemy.length();
    if (dist > maxDistance) continue;

    const dot = Vector3.Dot(toEnemy.normalize(), forward);
    const crossDist = Math.sqrt(1 - dot * dot) * dist;

    if (dot > 0.9 && crossDist < 0.8) {
      return enemy;
    }
  }

  return null;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Dispose all enemies and their ECS entities
 */
export function disposeEnemies(enemies: Enemy[]): void {
  for (const enemy of enemies) {
    enemy.mesh.dispose();
    removeEntity(enemy.entity);
  }
}

/**
 * Reset GLB preload state (for level transitions)
 */
export function resetEnemyAssets(): void {
  glbAssetsPreloaded = false;
}
