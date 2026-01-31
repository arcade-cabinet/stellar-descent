/**
 * ExtractionLevel - Enemy Management
 *
 * Contains enemy spawning, AI behavior, and combat logic.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { ALIEN_SPECIES, createAlienMesh } from '../../entities/aliens';
import { particleManager } from '../../effects/ParticleManager';

import type { Enemy } from './types';
import { MAX_ENEMIES } from './constants';

// ============================================================================
// ENEMY SPAWNING
// ============================================================================

/**
 * Spawn a single enemy at the given position
 */
export async function spawnEnemy(
  scene: Scene,
  species: string,
  spawnPos: Vector3,
  waveNumber: number,
  existingEnemyCount: number
): Promise<Enemy | null> {
  if (existingEnemyCount >= MAX_ENEMIES) return null;

  const speciesData = ALIEN_SPECIES[species];
  if (!speciesData) return null;

  const mesh = await createAlienMesh(scene, speciesData, Date.now() + existingEnemyCount);
  mesh.position = spawnPos.clone();

  // Scale health based on wave for difficulty progression
  const waveHealthMultiplier = 1 + (waveNumber - 1) * 0.1;
  const scaledHealth = Math.floor(speciesData.baseHealth * waveHealthMultiplier);

  const enemy: Enemy = {
    mesh,
    health: scaledHealth,
    maxHealth: scaledHealth,
    position: spawnPos.clone(),
    velocity: new Vector3(0, 0, 0),
    species,
    isActive: true,
  };

  // Emit spawn effect for dramatic entrance
  particleManager.emitAlienDeath(spawnPos.clone(), 0.5);

  return enemy;
}

/**
 * Calculate spawn position based on spawn points, breach holes, and enemy type
 */
export function calculateSpawnPosition(
  species: string,
  spawnPoints: Vector3[],
  breachHoles: Mesh[],
  lzPosition: Vector3,
  currentSpawnPointIndex: number
): { position: Vector3; newSpawnPointIndex: number } {
  let spawnPos: Vector3;
  let newIndex = currentSpawnPointIndex;

  if (species === 'broodmother' && breachHoles.length > 0) {
    // Brutes spawn from breach holes for dramatic effect
    const holeIndex = Math.floor(Math.random() * Math.min(2, breachHoles.length));
    const hole = breachHoles[holeIndex];
    spawnPos = hole.position.clone();
    spawnPos.y = 0;
    spawnPos.x += (Math.random() - 0.5) * 5;
    spawnPos.z += (Math.random() - 0.5) * 5;
  } else if (spawnPoints.length > 0) {
    // Use rotating spawn points for variety
    const spawnIndex = (currentSpawnPointIndex + Math.floor(Math.random() * 3)) % spawnPoints.length;
    const basePos = spawnPoints[spawnIndex];
    spawnPos = basePos.clone();
    spawnPos.y = 0;
    // Add randomization around the spawn point
    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadRadius = 3 + Math.random() * 8;
    spawnPos.x += Math.cos(spreadAngle) * spreadRadius;
    spawnPos.z += Math.sin(spreadAngle) * spreadRadius;

    // Rotate spawn point index occasionally
    if (Math.random() < 0.3) {
      newIndex = (currentSpawnPointIndex + 1) % spawnPoints.length;
    }
  } else if (breachHoles.length > 0) {
    // Fallback to breach holes
    const holeIndex = Math.floor(Math.random() * breachHoles.length);
    const hole = breachHoles[holeIndex];
    spawnPos = hole.position.clone();
    spawnPos.y = 0;
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 8;
    spawnPos.x += Math.cos(angle) * radius;
    spawnPos.z += Math.sin(angle) * radius;
  } else {
    // Final fallback - random position around LZ
    const angle = Math.random() * Math.PI * 2;
    const radius = 40 + Math.random() * 20;
    spawnPos = new Vector3(
      lzPosition.x + Math.cos(angle) * radius,
      0,
      lzPosition.z + Math.sin(angle) * radius
    );
  }

  return { position: spawnPos, newSpawnPointIndex: newIndex };
}

// ============================================================================
// ENEMY AI
// ============================================================================

/**
 * Update enemy movement and behavior
 * Returns damage dealt to player if any enemies are in attack range
 */
export function updateEnemies(
  enemies: Enemy[],
  playerPosition: Vector3,
  deltaTime: number
): number {
  let playerDamage = 0;

  for (const enemy of enemies) {
    if (!enemy.isActive) continue;

    // Move toward player
    const toPlayer = playerPosition.subtract(enemy.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist > 3) {
      toPlayer.normalize();
      const species = ALIEN_SPECIES[enemy.species];
      const speed = species ? species.moveSpeed : 5;
      enemy.velocity = toPlayer.scale(speed);
      enemy.position.addInPlace(enemy.velocity.scale(deltaTime));
      enemy.mesh.position = enemy.position.clone();

      // Face player
      enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    } else {
      // Attack player
      playerDamage += 5;
    }
  }

  return playerDamage;
}

/**
 * Update collapse enemies (faster movement, removed when too far behind)
 */
export function updateCollapseEnemies(
  enemies: Enemy[],
  playerPosition: Vector3,
  deltaTime: number
): number {
  let playerDamage = 0;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!enemy.isActive) continue;

    // Move toward player
    const toPlayer = playerPosition.subtract(enemy.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist > 3) {
      toPlayer.normalize();
      const species = ALIEN_SPECIES[enemy.species];
      const speed = species ? species.moveSpeed * 1.2 : 6; // Faster during escape
      enemy.velocity = toPlayer.scale(speed);
      enemy.position.addInPlace(enemy.velocity.scale(deltaTime));
      enemy.mesh.position = enemy.position.clone();
      enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    } else {
      // Attack player
      playerDamage += 3; // Light damage during escape
    }

    // Remove enemies that are far behind the player (lost in collapse)
    if (enemy.position.z > playerPosition.z + 50) {
      enemy.isActive = false;
      enemy.mesh.setEnabled(false);
      particleManager.emitAlienDeath(enemy.position.clone(), 0.5);
    }
  }

  return playerDamage;
}

// ============================================================================
// MECH AI
// ============================================================================

/**
 * Find closest enemy to mech and fire at it
 * Returns the enemy that was hit and damage dealt
 */
export function mechFireAtEnemy(
  mechMesh: TransformNode,
  mechGunLight: PointLight,
  enemies: Enemy[],
  mechIntegrity: number
): { enemy: Enemy | null; damage: number } {
  // Find closest enemy to mech
  let closestEnemy: Enemy | null = null;
  let closestDist = Infinity;

  const mechPos = mechMesh.position;

  for (const enemy of enemies) {
    if (!enemy.isActive) continue;
    const dist = Vector3.Distance(enemy.position, mechPos);
    if (dist < closestDist && dist < 100) {
      closestDist = dist;
      closestEnemy = enemy;
    }
  }

  if (closestEnemy) {
    // Muzzle flash
    mechGunLight.intensity = 50;
    setTimeout(() => {
      mechGunLight.intensity = 0;
    }, 50);

    // Deal damage based on mech integrity
    const damage = 20 * (mechIntegrity / 100);
    return { enemy: closestEnemy, damage };
  }

  return { enemy: null, damage: 0 };
}

// ============================================================================
// ENEMY DEATH
// ============================================================================

/**
 * Kill an enemy with death effects
 */
export function killEnemy(enemy: Enemy): void {
  // Emit alien death particle effect (green goo burst)
  particleManager.emitAlienDeath(enemy.position.clone(), 1.2);

  enemy.isActive = false;
  enemy.mesh.setEnabled(false);
}

/**
 * Clear all remaining enemies with dramatic effect
 */
export function clearAllEnemies(enemies: Enemy[]): number {
  let killCount = 0;

  for (const enemy of enemies) {
    if (enemy.isActive) {
      particleManager.emitAlienDeath(enemy.position.clone(), 0.8);
      enemy.isActive = false;
      enemy.mesh.setEnabled(false);
      killCount++;
    }
  }

  return killCount;
}

/**
 * Apply grenade damage to all enemies in radius
 * Returns number of kills
 */
export function applyGrenadeDamage(
  enemies: Enemy[],
  grenadePos: Vector3,
  radius: number = 15
): { kills: number; killedEnemies: Enemy[] } {
  let kills = 0;
  const killedEnemies: Enemy[] = [];

  for (const enemy of enemies) {
    if (!enemy.isActive) continue;
    const dist = Vector3.Distance(enemy.position, grenadePos);
    if (dist < radius) {
      const damage = Math.max(10, 100 - dist * 5);
      enemy.health -= damage;
      if (enemy.health <= 0) {
        killEnemy(enemy);
        kills++;
        killedEnemies.push(enemy);
      }
    }
  }

  return { kills, killedEnemies };
}

/**
 * Check for melee hit on enemies
 * Returns the hit enemy or null
 */
export function checkMeleeHit(
  enemies: Enemy[],
  playerPosition: Vector3,
  meleeRange: number = 3,
  meleeDamage: number = 50
): Enemy | null {
  for (const enemy of enemies) {
    if (!enemy.isActive) continue;
    const dist = Vector3.Distance(enemy.position, playerPosition);
    if (dist < meleeRange) {
      enemy.health -= meleeDamage;
      if (enemy.health <= 0) {
        killEnemy(enemy);
      }
      return enemy;
    }
  }
  return null;
}

// ============================================================================
// SPAWN QUEUE MANAGEMENT
// ============================================================================

/**
 * Prepare spawn queue for a wave
 * FIX #3: Added husk support
 * FIX #16: Improved spawn diversity with interleaved spawning
 */
export function prepareWaveSpawnQueue(
  drones: number,
  grunts: number,
  spitters: number,
  brutes: number,
  husks: number = 0
): { species: string; count: number }[] {
  const spawnList: { species: string; count: number }[] = [];

  // FIX #16: Interleave enemy types for better variety
  // Split larger groups into smaller chunks
  const chunkSize = 3;

  // Add drones in chunks
  let remainingDrones = drones;
  while (remainingDrones > 0) {
    const count = Math.min(chunkSize, remainingDrones);
    spawnList.push({ species: 'skitterer', count });
    remainingDrones -= count;
  }

  // Add grunts in chunks
  let remainingGrunts = grunts;
  while (remainingGrunts > 0) {
    const count = Math.min(chunkSize, remainingGrunts);
    spawnList.push({ species: 'lurker', count });
    remainingGrunts -= count;
  }

  // Add spitters in chunks
  let remainingSpitters = spitters;
  while (remainingSpitters > 0) {
    const count = Math.min(chunkSize, remainingSpitters);
    spawnList.push({ species: 'spewer', count });
    remainingSpitters -= count;
  }

  // FIX #3: Add husks in chunks
  let remainingHusks = husks;
  while (remainingHusks > 0) {
    const count = Math.min(chunkSize, remainingHusks);
    spawnList.push({ species: 'husk', count });
    remainingHusks -= count;
  }

  // Brutes spawn one at a time for dramatic effect
  for (let i = 0; i < brutes; i++) {
    spawnList.push({ species: 'broodmother', count: 1 });
  }

  // Shuffle the spawn groups for variety
  for (let i = spawnList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spawnList[i], spawnList[j]] = [spawnList[j], spawnList[i]];
  }

  return spawnList;
}

/**
 * Spawn collapse stragglers (weakened enemies during escape)
 */
export async function spawnCollapseStraggler(
  scene: Scene,
  playerPosition: Vector3,
  existingCount: number
): Promise<Enemy | null> {
  // Spawn position ahead of player
  const spawnPos = new Vector3(
    (Math.random() - 0.5) * 40,
    0,
    playerPosition.z - 30 - Math.random() * 50
  );

  const species = ALIEN_SPECIES['skitterer'];
  const mesh = await createAlienMesh(scene, species, Date.now() + existingCount);
  mesh.position = spawnPos.clone();

  const enemy: Enemy = {
    mesh,
    health: species.baseHealth * 0.5, // Weakened for escape sequence
    maxHealth: species.baseHealth * 0.5,
    position: spawnPos,
    velocity: new Vector3(0, 0, 0),
    species: 'skitterer',
    isActive: true,
  };

  return enemy;
}
