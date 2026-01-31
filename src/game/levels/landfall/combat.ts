/**
 * Landfall Combat Logic
 * Handles surface combat, enemy management, and player attacks
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { Scene } from '@babylonjs/core/scene';

import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { fireWeapon, startReload, getWeaponActions } from '../../context/useWeaponActions';
import type { SurfaceEnemy } from './types';
import {
  MELEE_COOLDOWN,
  MELEE_DAMAGE,
  MELEE_RANGE,
  PRIMARY_FIRE_DAMAGE,
  PRIMARY_FIRE_RANGE,
  PRIMARY_FIRE_COOLDOWN,
  ACID_DAMAGE_INTERVAL,
  ACID_DAMAGE,
  TERRAIN_BOUNDS,
  FIRST_ENCOUNTER_ENEMY_COUNT,
} from './constants';
import {
  updateEnemyAI,
  flashEnemyRed,
  animateEnemyDeath,
  isPlayerInAcidPool,
  isPlayerOnUnstableTerrain,
  updateAcidPoolVisuals,
  updateUnstableTerrainVisuals,
} from './surface-combat';

// ============================================================================
// COMBAT STATE
// ============================================================================

export interface CombatState {
  surfaceCombatActive: boolean;
  killCount: number;
  enemyCount: number;
  meleeCooldown: number;
  primaryFireCooldown: number;
  acidDamageTimer: number;
  unstableTerrainShakeTimer: number;
  playerInAcid: boolean;
  tutorialSlowdownActive: boolean;
  tutorialSlowdownTimer: number;
}

export function createCombatState(): CombatState {
  return {
    surfaceCombatActive: false,
    killCount: 0,
    enemyCount: 0,
    meleeCooldown: 0,
    primaryFireCooldown: 0,
    acidDamageTimer: 0,
    unstableTerrainShakeTimer: 0,
    playerInAcid: false,
    tutorialSlowdownActive: true,
    tutorialSlowdownTimer: 0,
  };
}

// ============================================================================
// ENEMY MANAGEMENT
// ============================================================================

export interface EnemyUpdateResult {
  playerDamage: number;
  enemiesKilled: SurfaceEnemy[];
}

/**
 * Update all surface enemies
 */
export function updateSurfaceEnemies(
  enemies: SurfaceEnemy[],
  playerPos: Vector3,
  deltaTime: number,
  tutorialSlowdownActive: boolean,
  tutorialProgress: number
): EnemyUpdateResult {
  const result: EnemyUpdateResult = {
    playerDamage: 0,
    enemiesKilled: [],
  };

  const speedMultiplier = tutorialSlowdownActive ? 0.4 + tutorialProgress * 0.6 : 1.0;

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    updateEnemyAI(enemy, playerPos, deltaTime, speedMultiplier);

    if (enemy.state === 'attack') {
      const cooldown = tutorialSlowdownActive ? 2.5 : 1.5;
      if (enemy.attackCooldown <= 0) {
        const damage = tutorialSlowdownActive ? 10 : 15;
        result.playerDamage += damage;
        enemy.attackCooldown = cooldown;
      }
    }
  }

  return result;
}

// ============================================================================
// PLAYER ATTACKS
// ============================================================================

export interface MeleeAttackResult {
  hit: boolean;
  enemyKilled: SurfaceEnemy | null;
}

/**
 * Perform melee attack
 */
export function performMeleeAttack(
  enemies: SurfaceEnemy[],
  playerPos: Vector3,
  playerRotationY: number
): MeleeAttackResult {
  const result: MeleeAttackResult = {
    hit: false,
    enemyKilled: null,
  };

  const forward = new Vector3(Math.sin(playerRotationY), 0, Math.cos(playerRotationY));
  const attackPos = playerPos.add(forward.scale(MELEE_RANGE / 2));

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    if (Vector3.Distance(attackPos, enemy.mesh.position) < MELEE_RANGE) {
      enemy.health -= MELEE_DAMAGE;
      particleManager.emitAlienSplatter(enemy.mesh.position, 1.0);
      flashEnemyRed(enemy.mesh);
      result.hit = true;

      if (enemy.health <= 0) {
        result.enemyKilled = enemy;
      }
      break; // Only hit one enemy
    }
  }

  return result;
}

export interface PrimaryFireResult {
  hit: boolean;
  enemyKilled: SurfaceEnemy | null;
  outOfAmmo: boolean;
}

/**
 * Fire primary weapon
 */
export function firePrimaryWeapon(
  scene: Scene,
  enemies: SurfaceEnemy[],
  playerPos: Vector3,
  forward: Vector3
): PrimaryFireResult {
  const result: PrimaryFireResult = {
    hit: false,
    enemyKilled: null,
    outOfAmmo: false,
  };

  // Check ammo
  if (!fireWeapon()) {
    result.outOfAmmo = true;
    startReload();
    return result;
  }

  // Find closest enemy in aim
  let closestEnemy: SurfaceEnemy | null = null;
  let closestDist = PRIMARY_FIRE_RANGE;

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const toEnemy = enemy.mesh.position.subtract(playerPos);
    const dot = Vector3.Dot(toEnemy, forward);

    if (dot > 0 && dot < PRIMARY_FIRE_RANGE) {
      const perpDist = toEnemy.subtract(forward.scale(dot)).length();
      if (perpDist < 1.5 && dot < closestDist) {
        closestEnemy = enemy;
        closestDist = dot;
      }
    }
  }

  // Muzzle flash
  const flashPos = playerPos.add(forward.scale(0.5));
  particleManager.emitMuzzleFlash(flashPos, forward);

  const flashLight = new PointLight('muzzleFlash', flashPos, scene);
  flashLight.diffuse = new Color3(1, 0.8, 0.4);
  flashLight.intensity = 2;
  flashLight.range = 10;

  const startTime = performance.now();
  const animateFlash = () => {
    const progress = Math.min((performance.now() - startTime) / 80, 1);
    flashLight.intensity = 2 * (1 - progress);
    if (progress < 1) {
      requestAnimationFrame(animateFlash);
    } else {
      flashLight.dispose();
    }
  };
  requestAnimationFrame(animateFlash);

  // Apply damage
  if (closestEnemy) {
    closestEnemy.health -= PRIMARY_FIRE_DAMAGE;
    flashEnemyRed(closestEnemy.mesh);
    particleManager.emitAlienSplatter(closestEnemy.mesh.position, 0.8);
    result.hit = true;

    if (closestEnemy.health <= 0) {
      result.enemyKilled = closestEnemy;
    }
  }

  return result;
}

/**
 * Throw grenade at target position
 */
export function throwGrenade(
  enemies: SurfaceEnemy[],
  playerPos: Vector3,
  forward: Vector3
): { kills: number; killedEnemies: SurfaceEnemy[] } {
  const grenadePos = playerPos.add(forward.scale(10));
  grenadePos.y = 0;

  const killedEnemies: SurfaceEnemy[] = [];

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const dist = Vector3.Distance(grenadePos, enemy.mesh.position);
    if (dist < 5) {
      const damage = 60 * (1 - dist / 5);
      enemy.health -= damage;
      flashEnemyRed(enemy.mesh);
      particleManager.emitAlienSplatter(enemy.mesh.position, 0.6);

      if (enemy.health <= 0) {
        killedEnemies.push(enemy);
      }
    }
  }

  particleManager.emitSmallExplosion(grenadePos);

  return { kills: killedEnemies.length, killedEnemies };
}

// ============================================================================
// ENVIRONMENT HAZARDS
// ============================================================================

export interface HazardUpdateResult {
  acidDamage: number;
  enteredAcid: boolean;
  exitedAcid: boolean;
  shouldShake: boolean;
  showUnstableWarning: boolean;
}

/**
 * Update environment hazards and check player interaction
 */
export function updateEnvironmentHazards(
  playerPos: Vector3,
  acidPools: any[],
  unstableTerrain: any[],
  acidDamageTimer: number,
  unstableTerrainShakeTimer: number,
  wasInAcid: boolean,
  deltaTime: number
): {
  result: HazardUpdateResult;
  newAcidDamageTimer: number;
  newUnstableTerrainShakeTimer: number;
} {
  const result: HazardUpdateResult = {
    acidDamage: 0,
    enteredAcid: false,
    exitedAcid: false,
    shouldShake: false,
    showUnstableWarning: false,
  };

  let newAcidTimer = acidDamageTimer;
  let newUnstableTimer = unstableTerrainShakeTimer;

  // Acid pool check
  const inAcidPool = isPlayerInAcidPool(playerPos);
  if (inAcidPool) {
    if (!wasInAcid) {
      result.enteredAcid = true;
    }

    newAcidTimer += deltaTime;
    if (newAcidTimer >= ACID_DAMAGE_INTERVAL) {
      newAcidTimer = 0;
      result.acidDamage = ACID_DAMAGE;
    }
  } else {
    if (wasInAcid) {
      result.exitedAcid = true;
    }
    newAcidTimer = 0;
  }

  // Unstable terrain check
  const onUnstable = isPlayerOnUnstableTerrain(playerPos);
  if (onUnstable) {
    newUnstableTimer += deltaTime;
    if (newUnstableTimer >= 2.5) {
      newUnstableTimer = 0;
      result.shouldShake = true;
      if (Math.random() < 0.3) {
        result.showUnstableWarning = true;
      }
    }
  } else {
    newUnstableTimer = 0;
  }

  // Update visuals
  const time = performance.now() * 0.001;
  updateAcidPoolVisuals(acidPools, time);
  updateUnstableTerrainVisuals(unstableTerrain, time);

  return {
    result,
    newAcidDamageTimer: newAcidTimer,
    newUnstableTerrainShakeTimer: newUnstableTimer,
  };
}

// ============================================================================
// ENEMY DEATH
// ============================================================================

/**
 * Process enemy kill
 */
export function processEnemyKill(enemy: SurfaceEnemy): void {
  particleManager.emitAlienDeath(enemy.mesh.position.clone(), 1.2);
  getAudioManager().play('enemy_death', { volume: 0.5 });
  animateEnemyDeath(enemy);
}

// ============================================================================
// RELOAD
// ============================================================================

/**
 * Handle reload action
 */
export function handleReload(): { started: boolean; message: string } {
  const weaponState = getWeaponActions()?.getState();

  if (!weaponState || weaponState.isReloading || weaponState.currentAmmo >= weaponState.maxMagazineSize) {
    return { started: false, message: '' };
  }

  if (weaponState.reserveAmmo <= 0) {
    return { started: false, message: 'NO RESERVE AMMO' };
  }

  startReload();
  return { started: true, message: 'RELOADING...' };
}
