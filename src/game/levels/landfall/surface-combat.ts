/**
 * LandfallLevel Surface Combat
 * Surface enemy spawning, combat AI, and hazard management.
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager, SPECIES_TO_ASSET } from '../../core/AssetManager';
import { particleManager } from '../../effects/ParticleManager';
import {
  ACID_POOL_POSITIONS,
  SURFACE_ENEMY_SCALE,
  SURFACE_ENEMY_SPECIES,
  TERRAIN_BOUNDS,
  UNSTABLE_TERRAIN_POSITIONS,
} from './constants';
import type { SurfaceEnemy } from './types';

// ---------------------------------------------------------------------------
// Enemy Spawning
// ---------------------------------------------------------------------------

/**
 * Calculates spawn points for surface enemies.
 */
export function calculateSpawnPoints(playerPos: Vector3, count: number): Vector3[] {
  const spawnPoints: Vector3[] = [];
  const lzPos = new Vector3(0, 0, 0);
  const _towardsLZ = lzPos.subtract(playerPos).normalize();

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI - Math.PI / 2;
    const distance = 20 + Math.random() * 15;
    const offsetX = Math.cos(angle) * distance;
    const offsetZ = Math.sin(angle) * distance + 10;

    const spawnPos = playerPos.add(new Vector3(offsetX, 0, offsetZ));
    spawnPos.x = Math.max(-TERRAIN_BOUNDS + 10, Math.min(TERRAIN_BOUNDS - 10, spawnPos.x));
    spawnPos.z = Math.max(-TERRAIN_BOUNDS + 10, Math.min(TERRAIN_BOUNDS - 10, spawnPos.z));
    spawnPoints.push(spawnPos);
  }

  return spawnPoints;
}

/**
 * Spawns a surface combat enemy.
 */
export function spawnSurfaceEnemy(
  scene: Scene,
  spawnPos: Vector3,
  index: number,
  preloaded: boolean
): SurfaceEnemy {
  const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];
  if (!assetName) {
    throw new Error(`[Landfall] No asset mapping for species: ${SURFACE_ENEMY_SPECIES}`);
  }
  if (!preloaded) {
    throw new Error(
      `[Landfall] Surface enemies not preloaded - assets must be loaded before spawning`
    );
  }

  const enemyMesh = AssetManager.createInstance(
    'aliens',
    assetName,
    `surfaceEnemy_${index}`,
    scene
  );

  if (!enemyMesh) {
    throw new Error(
      `[Landfall] Failed to create enemy GLB instance ${index} (${assetName}) - asset not loaded`
    );
  }

  enemyMesh.scaling.setAll(SURFACE_ENEMY_SCALE);
  enemyMesh.position = spawnPos.clone();
  enemyMesh.position.y = 1;

  // Spawn animation
  enemyMesh.scaling.setAll(0.1);
  const targetScale = SURFACE_ENEMY_SCALE;
  const spawnStart = performance.now();
  const animateSpawn = () => {
    const elapsed = performance.now() - spawnStart;
    const progress = Math.min(elapsed / 500, 1);
    enemyMesh.scaling.setAll(0.1 + progress * (targetScale - 0.1));
    if (progress < 1) requestAnimationFrame(animateSpawn);
  };
  requestAnimationFrame(animateSpawn);

  return {
    mesh: enemyMesh,
    health: 50,
    maxHealth: 50,
    position: spawnPos.clone(),
    state: 'chase',
    attackCooldown: 0,
    species: 'skitterer',
  };
}

/**
 * Spawns a first encounter enemy with burrow emergence effect.
 */
export function spawnFirstEncounterEnemy(
  scene: Scene,
  spawnPos: Vector3,
  index: number,
  preloaded: boolean
): { enemy: SurfaceEnemy; burrowHole: Mesh } {
  // Create burrow hole visual
  const burrowMat = new StandardMaterial('burrowMat', scene);
  burrowMat.diffuseColor = Color3.FromHexString('#3A2A1A');
  burrowMat.emissiveColor = new Color3(0.1, 0.05, 0);

  const burrowHole = MeshBuilder.CreateDisc(
    `burrowHole_${index}`,
    { radius: 1.2, tessellation: 12 },
    scene
  );
  burrowHole.material = burrowMat;
  burrowHole.position = spawnPos.clone();
  burrowHole.position.y = 0.05;
  burrowHole.rotation.x = Math.PI / 2;

  // Emit burrow emergence particles
  particleManager.emitBurrowEmergence(spawnPos, 1.2);

  // Create enemy mesh
  const assetName = SPECIES_TO_ASSET[SURFACE_ENEMY_SPECIES];
  if (!assetName) {
    throw new Error(`[Landfall] No asset mapping for species: ${SURFACE_ENEMY_SPECIES}`);
  }
  if (!preloaded) {
    throw new Error(
      `[Landfall] Surface enemies not preloaded - assets must be loaded before spawning`
    );
  }

  const enemyMesh = AssetManager.createInstance(
    'aliens',
    assetName,
    `firstEncounterEnemy_${index}`,
    scene
  );

  if (!enemyMesh) {
    throw new Error(
      `[Landfall] Failed to create first encounter enemy GLB instance ${index} (${assetName}) - asset not loaded`
    );
  }

  enemyMesh.scaling.setAll(0.1);
  enemyMesh.position = spawnPos.clone();
  enemyMesh.position.y = 0;

  // Emergence animation
  const targetScale = SURFACE_ENEMY_SCALE;
  const spawnStart = performance.now();
  const emergeDuration = 600;

  const animateEmergence = () => {
    const elapsed = performance.now() - spawnStart;
    const progress = Math.min(elapsed / emergeDuration, 1);
    const currentScale = 0.1 + progress * (targetScale - 0.1);
    enemyMesh.scaling.setAll(currentScale);
    enemyMesh.position.y = progress * 1;

    if (progress < 1) {
      requestAnimationFrame(animateEmergence);
    } else {
      setTimeout(() => burrowHole.dispose(), 2000);
    }
  };
  requestAnimationFrame(animateEmergence);

  const enemy: SurfaceEnemy = {
    mesh: enemyMesh,
    health: 40,
    maxHealth: 40,
    position: spawnPos.clone(),
    state: 'idle',
    attackCooldown: 2.0,
    species: 'skitterer',
  };

  return { enemy, burrowHole };
}

// ---------------------------------------------------------------------------
// Enemy AI
// ---------------------------------------------------------------------------

/**
 * Updates enemy AI state and movement.
 * Includes strafing, flanking, and retreat behaviors.
 */
export function updateEnemyAI(
  enemy: SurfaceEnemy,
  playerPos: Vector3,
  deltaTime: number,
  speedMultiplier: number
): void {
  if (enemy.health <= 0) return;

  if (enemy.attackCooldown > 0) {
    enemy.attackCooldown -= deltaTime;
  }

  const toPlayer = playerPos.subtract(enemy.mesh.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();

  const attackRange = 2.5;
  const strafeRange = 8.0;
  const baseChaseSpeed = 4.0;
  const chaseSpeed = baseChaseSpeed * speedMultiplier;

  if (enemy.state === 'idle') {
    enemy.state = 'chase';
  }

  // Low health - retreat behavior
  if (enemy.health < enemy.maxHealth * 0.3 && dist < strafeRange) {
    const retreatDir = toPlayer.normalize().scale(-1);
    const lateralOffset = new Vector3(
      Math.sin(performance.now() * 0.003) * 0.5,
      0,
      Math.cos(performance.now() * 0.003) * 0.5
    );
    const moveDir = retreatDir.add(lateralOffset).normalize();
    enemy.mesh.position.addInPlace(moveDir.scale(chaseSpeed * 0.7 * deltaTime));
    enemy.mesh.position.y = 1;

    const angle = Math.atan2(toPlayer.x, toPlayer.z);
    enemy.mesh.rotation.y = angle;
    return;
  }

  if (dist < attackRange) {
    enemy.state = 'attack';
    // Slight bobbing during attack stance
    enemy.mesh.position.y = 1 + Math.sin(performance.now() * 0.015) * 0.05;
  } else if (dist < strafeRange && dist > attackRange) {
    // Strafe around player at medium range
    enemy.state = 'chase';
    const strafeAngle = performance.now() * 0.002 + enemy.mesh.position.x * 0.1;
    const strafeDir = new Vector3(Math.cos(strafeAngle), 0, Math.sin(strafeAngle));
    const approachDir = toPlayer.normalize();
    const moveDir = approachDir.scale(0.7).add(strafeDir.scale(0.3)).normalize();

    enemy.mesh.position.addInPlace(moveDir.scale(chaseSpeed * deltaTime));
    enemy.mesh.position.y = 1 + Math.sin(performance.now() * 0.01) * 0.1;

    const angle = Math.atan2(toPlayer.x, toPlayer.z);
    enemy.mesh.rotation.y = angle;
  } else {
    // Chase directly
    enemy.state = 'chase';
    const moveDir = toPlayer.normalize();
    enemy.mesh.position.addInPlace(moveDir.scale(chaseSpeed * deltaTime));
    enemy.mesh.position.y = 1;

    const angle = Math.atan2(toPlayer.x, toPlayer.z);
    enemy.mesh.rotation.y = angle;

    // Bobbing animation while moving
    enemy.mesh.position.y = 1 + Math.sin(performance.now() * 0.01) * 0.1;
  }

  // Clamp to terrain bounds
  enemy.mesh.position.x = Math.max(
    -TERRAIN_BOUNDS + 5,
    Math.min(TERRAIN_BOUNDS - 5, enemy.mesh.position.x)
  );
  enemy.mesh.position.z = Math.max(
    -TERRAIN_BOUNDS + 5,
    Math.min(TERRAIN_BOUNDS - 5, enemy.mesh.position.z)
  );
}

// ---------------------------------------------------------------------------
// Enemy Visual Feedback
// ---------------------------------------------------------------------------

/**
 * Flashes an enemy mesh red when hit.
 */
export function flashEnemyRed(mesh: Mesh | TransformNode): void {
  if ('material' in mesh && mesh.material instanceof StandardMaterial) {
    const mat = mesh.material as StandardMaterial;
    const originalColor = mat.diffuseColor.clone();
    mat.diffuseColor = new Color3(1, 0.2, 0.2);

    setTimeout(() => {
      try {
        mat.diffuseColor = originalColor;
      } catch {
        // Material was disposed
      }
    }, 100);
  }

  if (mesh instanceof TransformNode) {
    const childMeshes = mesh.getChildMeshes();
    for (const child of childMeshes) {
      if (child.material instanceof StandardMaterial) {
        const mat = child.material as StandardMaterial;
        const originalColor = mat.diffuseColor.clone();
        mat.diffuseColor = new Color3(1, 0.2, 0.2);

        setTimeout(() => {
          try {
            mat.diffuseColor = originalColor;
          } catch {
            // Material was disposed
          }
        }, 100);
      }
    }
  }
}

/**
 * Animates enemy death.
 */
export function animateEnemyDeath(enemy: SurfaceEnemy): void {
  const deathStart = performance.now();
  const animateDeath = () => {
    const elapsed = performance.now() - deathStart;
    const progress = Math.min(elapsed / 500, 1);

    if (enemy.mesh && !enemy.mesh.isDisposed()) {
      enemy.mesh.scaling.setAll((1 - progress) * SURFACE_ENEMY_SCALE);

      if (progress >= 1) {
        enemy.mesh.dispose();
      } else {
        requestAnimationFrame(animateDeath);
      }
    }
  };
  requestAnimationFrame(animateDeath);
}

// ---------------------------------------------------------------------------
// Environment Hazards Creation
// ---------------------------------------------------------------------------

/**
 * Creates acid pool meshes.
 */
export function createAcidPools(scene: Scene): Mesh[] {
  const acidPools: Mesh[] = [];

  const acidMat = new StandardMaterial('acidMat', scene);
  acidMat.diffuseColor = Color3.FromHexString('#2A5A2A');
  acidMat.emissiveColor = new Color3(0.2, 0.5, 0.15);
  acidMat.specularColor = new Color3(0.4, 0.6, 0.4);
  acidMat.specularPower = 64;
  acidMat.alpha = 0.85;

  const borderMat = new StandardMaterial('acidBorderMat', scene);
  borderMat.diffuseColor = Color3.FromHexString('#1A3A1A');
  borderMat.emissiveColor = new Color3(0.1, 0.2, 0.05);

  for (let i = 0; i < ACID_POOL_POSITIONS.length; i++) {
    const acidDef = ACID_POOL_POSITIONS[i];

    const pool = MeshBuilder.CreateDisc(
      `acidPool_${i}`,
      { radius: acidDef.radius, tessellation: 24 },
      scene
    );
    pool.material = acidMat.clone(`acidMat_${i}`);
    pool.position.set(acidDef.x, 0.02, acidDef.z);
    pool.rotation.x = Math.PI / 2;
    pool.isVisible = false;
    acidPools.push(pool);

    const border = MeshBuilder.CreateTorus(
      `acidBorder_${i}`,
      { diameter: acidDef.radius * 2, thickness: 0.3, tessellation: 24 },
      scene
    );
    border.material = borderMat.clone(`acidBorderMat_${i}`);
    border.position.set(acidDef.x, 0.05, acidDef.z);
    border.rotation.x = Math.PI / 2;
    border.isVisible = false;
    acidPools.push(border);
  }

  return acidPools;
}

/**
 * Creates unstable terrain meshes.
 */
export function createUnstableTerrain(scene: Scene): Mesh[] {
  const unstableTerrain: Mesh[] = [];

  const unstableMat = new StandardMaterial('unstableMat', scene);
  unstableMat.diffuseColor = Color3.FromHexString('#5A4030');
  unstableMat.emissiveColor = new Color3(0.15, 0.08, 0.02);
  unstableMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const crackMat = new StandardMaterial('crackMat', scene);
  crackMat.diffuseColor = Color3.FromHexString('#2A1A10');
  crackMat.emissiveColor = new Color3(0.3, 0.15, 0.05);

  for (let i = 0; i < UNSTABLE_TERRAIN_POSITIONS.length; i++) {
    const unstableDef = UNSTABLE_TERRAIN_POSITIONS[i];

    const zone = MeshBuilder.CreateDisc(
      `unstableZone_${i}`,
      { radius: unstableDef.size, tessellation: 16 },
      scene
    );
    zone.material = unstableMat.clone(`unstableMat_${i}`);
    zone.position.set(unstableDef.x, 0.01, unstableDef.z);
    zone.rotation.x = Math.PI / 2;
    zone.isVisible = false;
    unstableTerrain.push(zone);

    for (let j = 0; j < 4; j++) {
      const crackAngle = (j / 4) * Math.PI * 2 + Math.random() * 0.5;
      const crackLength = unstableDef.size * 0.8 + Math.random() * unstableDef.size * 0.4;

      const crack = MeshBuilder.CreateBox(
        `crack_${i}_${j}`,
        { width: 0.1 + Math.random() * 0.1, height: 0.02, depth: crackLength },
        scene
      );
      crack.material = crackMat.clone(`crackMat_${i}_${j}`);
      crack.position.set(unstableDef.x, 0.03, unstableDef.z);
      crack.rotation.y = crackAngle;
      crack.isVisible = false;
      unstableTerrain.push(crack);
    }
  }

  return unstableTerrain;
}

// ---------------------------------------------------------------------------
// Environment Hazard Checks
// ---------------------------------------------------------------------------

/**
 * Checks if player is in an acid pool.
 */
export function isPlayerInAcidPool(playerPos: Vector3): boolean {
  for (const acid of ACID_POOL_POSITIONS) {
    const dist2D = Math.sqrt((playerPos.x - acid.x) ** 2 + (playerPos.z - acid.z) ** 2);
    if (dist2D < acid.radius) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if player is on unstable terrain.
 */
export function isPlayerOnUnstableTerrain(playerPos: Vector3): boolean {
  for (const unstable of UNSTABLE_TERRAIN_POSITIONS) {
    const dist2D = Math.sqrt((playerPos.x - unstable.x) ** 2 + (playerPos.z - unstable.z) ** 2);
    if (dist2D < unstable.size) {
      return true;
    }
  }
  return false;
}

/**
 * Updates acid pool visual animation.
 */
export function updateAcidPoolVisuals(acidPools: Mesh[], time: number): void {
  for (let i = 0; i < acidPools.length; i++) {
    const pool = acidPools[i];
    if (pool && pool.material instanceof StandardMaterial) {
      const pulse = 0.15 + Math.sin(time * 2 + i * 0.5) * 0.05;
      pool.material.emissiveColor = new Color3(0.2 + pulse, 0.5 + pulse * 2, 0.15);
    }
  }
}

/**
 * Updates unstable terrain crack glow animation.
 */
export function updateUnstableTerrainVisuals(unstableTerrain: Mesh[], time: number): void {
  for (let i = 0; i < unstableTerrain.length; i++) {
    const terrain = unstableTerrain[i];
    if (terrain && terrain.material instanceof StandardMaterial && terrain.name.includes('crack')) {
      const pulse = 0.3 + Math.sin(time * 3 + i * 0.3) * 0.15;
      terrain.material.emissiveColor = new Color3(pulse, pulse * 0.5, pulse * 0.15);
    }
  }
}
