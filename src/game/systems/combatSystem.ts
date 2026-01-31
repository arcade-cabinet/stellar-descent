import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getAchievementManager } from '../achievements';
import { getAudioManager } from '../core/AudioManager';
import { hitAudioManager } from '../core/HitAudioManager';
import { getLogger } from '../core/Logger';
import {
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  loadDifficultySetting,
} from '../core/DifficultySettings';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { createEntity, type Entity, getEntitiesInRadius, queries, removeEntity } from '../core/ecs';
import { getEventBus } from '../core/EventBus';
import { worldDb } from '../db/worldDatabase';
import { damageFeedback } from '../effects/DamageFeedback';
import { deathEffects, type DeathEffectType } from '../effects/DeathEffects';
import { impactDecals, type DecalSurfaceType } from '../effects/ImpactDecals';
import { impactParticles, type ImpactSurfaceType } from '../effects/ImpactParticles';
import { muzzleFlash } from '../effects/MuzzleFlash';
import { particleManager } from '../effects/ParticleManager';
import { weaponEffects } from '../effects/WeaponEffects';
import { hitReactionSystem } from './HitReactionSystem';
import { tokens } from '../utils/designTokens';

// ---------------------------------------------------------------------------
// Projectile Types
// ---------------------------------------------------------------------------

export type ProjectileType = 'bullet' | 'plasma' | 'explosive';

export interface ProjectileInfo {
  type: ProjectileType;
  damage: number;
  speed: number;
  explosionRadius?: number; // For explosive projectiles
  previousPosition?: Vector3; // For raycast collision detection
}

// ---------------------------------------------------------------------------
// Spatial Hash Grid for Efficient Enemy Lookups
// ---------------------------------------------------------------------------

/**
 * Spatial hash grid for O(1) average-case enemy position lookups.
 * Divides the world into cells and tracks which enemies are in each cell.
 */
class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, Set<Entity>> = new Map();
  private entityCells: Map<string, string> = new Map(); // entity.id -> cellKey

  constructor(cellSize: number = 10) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  /**
   * Insert or update an entity in the grid
   */
  updateEntity(entity: Entity): void {
    if (!entity.transform || !entity.id) return;

    const newKey = this.getCellKey(
      entity.transform.position.x,
      entity.transform.position.z
    );
    const oldKey = this.entityCells.get(entity.id);

    // If entity moved to a new cell, update
    if (oldKey !== newKey) {
      // Remove from old cell
      if (oldKey) {
        const oldCell = this.grid.get(oldKey);
        if (oldCell) {
          oldCell.delete(entity);
          if (oldCell.size === 0) {
            this.grid.delete(oldKey);
          }
        }
      }

      // Add to new cell
      let newCell = this.grid.get(newKey);
      if (!newCell) {
        newCell = new Set();
        this.grid.set(newKey, newCell);
      }
      newCell.add(entity);
      this.entityCells.set(entity.id, newKey);
    }
  }

  /**
   * Remove an entity from the grid
   */
  removeEntity(entityId: string): void {
    const cellKey = this.entityCells.get(entityId);
    if (cellKey) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        // Find and remove the entity with matching ID
        for (const entity of cell) {
          if (entity.id === entityId) {
            cell.delete(entity);
            break;
          }
        }
        if (cell.size === 0) {
          this.grid.delete(cellKey);
        }
      }
      this.entityCells.delete(entityId);
    }
  }

  /**
   * Get all entities within a radius of a point.
   * Checks cells that could potentially contain entities within the radius.
   */
  getEntitiesInRadius(
    center: Vector3,
    radius: number,
    filter?: (entity: Entity) => boolean
  ): Entity[] {
    const results: Entity[] = [];
    const radiusSq = radius * radius;

    // Calculate which cells to check
    const minCellX = Math.floor((center.x - radius) / this.cellSize);
    const maxCellX = Math.floor((center.x + radius) / this.cellSize);
    const minCellZ = Math.floor((center.z - radius) / this.cellSize);
    const maxCellZ = Math.floor((center.z + radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cellKey = `${cx},${cz}`;
        const cell = this.grid.get(cellKey);
        if (!cell) continue;

        for (const entity of cell) {
          if (!entity.transform) continue;

          const dx = entity.transform.position.x - center.x;
          const dy = entity.transform.position.y - center.y;
          const dz = entity.transform.position.z - center.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq <= radiusSq) {
            if (!filter || filter(entity)) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Get entities along a ray segment (for fast projectile collision)
   */
  getEntitiesAlongRay(
    start: Vector3,
    end: Vector3,
    filter?: (entity: Entity) => boolean
  ): Entity[] {
    const results: Entity[] = [];
    const direction = end.subtract(start);
    const length = direction.length();
    if (length === 0) return results;

    // Sample cells along the ray
    const steps = Math.ceil(length / this.cellSize) + 1;
    const checkedCells = new Set<string>();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sampleX = start.x + direction.x * t;
      const sampleZ = start.z + direction.z * t;
      const cellKey = this.getCellKey(sampleX, sampleZ);

      if (checkedCells.has(cellKey)) continue;
      checkedCells.add(cellKey);

      const cell = this.grid.get(cellKey);
      if (!cell) continue;

      for (const entity of cell) {
        if (!filter || filter(entity)) {
          // Avoid duplicates
          if (!results.includes(entity)) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    this.grid.clear();
    this.entityCells.clear();
  }
}

const log = getLogger('CombatSystem');

// ---------------------------------------------------------------------------
// Weak Point Configuration
// ---------------------------------------------------------------------------

interface WeakPointConfig {
  /** Relative Y position (0 = bottom, 1 = top) of weak point center */
  relativeY: number;
  /** Radius of the weak point as fraction of entity height */
  radiusFraction: number;
  /** Damage multiplier for hitting weak point */
  damageMultiplier: number;
}

/** Species-specific weak point configurations */
const WEAK_POINT_CONFIGS: Record<string, WeakPointConfig> = {
  skitterer: { relativeY: 0.6, radiusFraction: 0.25, damageMultiplier: 2.0 },
  lurker: { relativeY: 0.85, radiusFraction: 0.15, damageMultiplier: 2.5 }, // Head shot
  spewer: { relativeY: 0.5, radiusFraction: 0.3, damageMultiplier: 2.0 }, // Acid sac
  husk: { relativeY: 0.8, radiusFraction: 0.2, damageMultiplier: 2.0 },
  broodmother: { relativeY: 0.4, radiusFraction: 0.2, damageMultiplier: 1.5 }, // Egg sac
  default: { relativeY: 0.75, radiusFraction: 0.2, damageMultiplier: 2.0 },
};

// ---------------------------------------------------------------------------
// CombatSystem Class
// ---------------------------------------------------------------------------

export class CombatSystem {
  private scene: Scene;
  private playerEntity: Entity | null = null;
  private onKillCallback: ((entity: Entity) => void) | null = null;
  private onPlayerDamageCallback: ((amount: number) => void) | null = null;
  private onHitMarkerCallback: ((damage: number, isCritical: boolean) => void) | null = null;
  private onDirectionalDamageCallback: ((angle: number, damage: number) => void) | null = null;

  // Track death cause for death screen
  private lastDeathCause: string = 'HOSTILE FIRE';

  // Difficulty settings
  private difficulty: DifficultyLevel;
  private difficultyModifiers: DifficultyModifiers;

  // Spatial hash grid for efficient enemy lookups
  private enemySpatialGrid: SpatialHashGrid = new SpatialHashGrid(10);

  // Track previous projectile positions for raycast collision
  private projectilePreviousPositions: Map<string, Vector3> = new Map();

  // Track projectile metadata (type, explosion radius, etc.)
  private projectileInfo: Map<string, ProjectileInfo> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    // Initialize particle manager with this scene
    particleManager.init(scene);
    // Initialize damage feedback system
    damageFeedback.init(scene);
    // Initialize weapon effects system
    weaponEffects.init(scene);
    // Initialize muzzle flash system
    muzzleFlash.init(scene);
    // Initialize death effects system
    deathEffects.init(scene);
    // Initialize impact particles system for surface-specific impact VFX
    impactParticles.init(scene);
    // Initialize impact decal system for bullet holes
    impactDecals.init(scene);
    // Initialize hit reaction system for stagger/knockback
    hitReactionSystem.init(scene);

    // Load difficulty settings
    this.difficulty = loadDifficultySetting();
    this.difficultyModifiers = getDifficultyModifiers(this.difficulty);
    log.info(`Initialized with difficulty: ${this.difficulty}`);
  }

  /**
   * Update difficulty setting - call this when difficulty changes mid-game
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    this.difficulty = difficulty;
    this.difficultyModifiers = getDifficultyModifiers(difficulty);
    log.info(`Difficulty changed to: ${difficulty}`);
  }

  /**
   * Get current difficulty modifiers
   */
  getDifficultyModifiers(): DifficultyModifiers {
    return this.difficultyModifiers;
  }

  setPlayer(player: Entity): void {
    this.playerEntity = player;
  }

  onKill(callback: (entity: Entity) => void): void {
    this.onKillCallback = callback;
  }

  onPlayerDamage(callback: (amount: number) => void): void {
    this.onPlayerDamageCallback = callback;
  }

  /**
   * Set callback for hit marker events (when player deals damage)
   */
  onHitMarker(callback: (damage: number, isCritical: boolean) => void): void {
    this.onHitMarkerCallback = callback;
  }

  /**
   * Set callback for directional damage events (when player takes damage)
   * @param callback - Receives angle (radians, 0=front, PI/2=right) and damage amount
   */
  onDirectionalDamage(callback: (angle: number, damage: number) => void): void {
    this.onDirectionalDamageCallback = callback;
  }

  /**
   * Get the cause of the last player death
   */
  getLastDeathCause(): string {
    return this.lastDeathCause;
  }

  // ---------------------------------------------------------------------------
  // Public Projectile Registration API
  // ---------------------------------------------------------------------------

  /**
   * Create a player bullet projectile with proper tracking.
   * Use this for hitscan-style weapons that need raycast collision.
   *
   * @param projectileEntity - The projectile entity (already created)
   * @param damage - Base damage of the projectile
   * @param speed - Projectile travel speed
   */
  registerBulletProjectile(projectileEntity: Entity, damage: number, speed: number): void {
    if (!projectileEntity.id) return;
    this.projectileInfo.set(projectileEntity.id, {
      type: 'bullet',
      damage,
      speed,
    });
    if (projectileEntity.transform) {
      this.projectilePreviousPositions.set(
        projectileEntity.id,
        projectileEntity.transform.position.clone()
      );
    }
  }

  /**
   * Create a plasma projectile with sphere collision.
   * Use this for energy weapons with visible projectiles.
   *
   * @param projectileEntity - The projectile entity (already created)
   * @param damage - Base damage of the projectile
   * @param speed - Projectile travel speed
   * @param collisionRadius - Radius for sphere collision detection
   */
  registerPlasmaProjectile(
    projectileEntity: Entity,
    damage: number,
    speed: number,
    collisionRadius: number = 1.0
  ): void {
    if (!projectileEntity.id) return;
    this.projectileInfo.set(projectileEntity.id, {
      type: 'plasma',
      damage,
      speed,
      explosionRadius: collisionRadius,
    });
    if (projectileEntity.transform) {
      this.projectilePreviousPositions.set(
        projectileEntity.id,
        projectileEntity.transform.position.clone()
      );
    }
  }

  /**
   * Create an explosive projectile with area-of-effect damage.
   * Use this for rockets, grenades, and other AOE weapons.
   *
   * @param projectileEntity - The projectile entity (already created)
   * @param damage - Base damage at center of explosion
   * @param speed - Projectile travel speed
   * @param explosionRadius - Radius of the explosion effect
   */
  registerExplosiveProjectile(
    projectileEntity: Entity,
    damage: number,
    speed: number,
    explosionRadius: number = 5.0
  ): void {
    if (!projectileEntity.id) return;
    this.projectileInfo.set(projectileEntity.id, {
      type: 'explosive',
      damage,
      speed,
      explosionRadius,
    });
    if (projectileEntity.transform) {
      this.projectilePreviousPositions.set(
        projectileEntity.id,
        projectileEntity.transform.position.clone()
      );
    }
  }

  /**
   * Notify combat system that an enemy was removed (for spatial grid cleanup).
   * Call this when despawning enemies to keep the spatial grid accurate.
   */
  notifyEnemyRemoved(entityId: string): void {
    this.enemySpatialGrid.removeEntity(entityId);
  }

  /**
   * Get entities within a radius using the optimized spatial hash grid.
   * More efficient than the ECS getEntitiesInRadius for enemy queries.
   */
  getEnemiesInRadius(
    center: Vector3,
    radius: number,
    filter?: (entity: Entity) => boolean
  ): Entity[] {
    return this.enemySpatialGrid.getEntitiesInRadius(center, radius, filter);
  }

  // ---------------------------------------------------------------------------
  // Visual Effects
  // ---------------------------------------------------------------------------

  private createExplosion(position: Vector3, scale: number = 1): void {
    // Core flash - bright white/yellow center
    const core = MeshBuilder.CreateSphere('explosionCore', { diameter: scale * 0.5 }, this.scene);
    core.position = position.clone();

    const coreMat = new StandardMaterial('explosionCoreMat', this.scene);
    coreMat.emissiveColor = Color3.FromHexString('#FFFFAA');
    coreMat.disableLighting = true;
    core.material = coreMat;

    // Outer fireball - orange/red
    const fireball = MeshBuilder.CreateSphere('explosionFireball', { diameter: scale }, this.scene);
    fireball.position = position.clone();

    const fireballMat = new StandardMaterial('explosionFireballMat', this.scene);
    fireballMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.amber);
    fireballMat.disableLighting = true;
    fireballMat.alpha = 0.7;
    fireball.material = fireballMat;

    // Smoke ring - darker, expands faster
    const smoke = MeshBuilder.CreateTorus(
      'explosionSmoke',
      { diameter: scale * 0.8, thickness: scale * 0.3, tessellation: 16 },
      this.scene
    );
    smoke.position = position.clone();
    smoke.rotation.x = Math.PI / 2;

    const smokeMat = new StandardMaterial('explosionSmokeMat', this.scene);
    smokeMat.emissiveColor = Color3.FromHexString('#FF6633');
    smokeMat.disableLighting = true;
    smokeMat.alpha = 0.5;
    smoke.material = smokeMat;

    const startTime = performance.now();
    const duration = 400;

    const animateExplosion = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Core: quick flash then shrink
      const coreProgress = Math.min(progress * 3, 1);
      core.scaling.setAll(1 + coreProgress * 0.5 - coreProgress * coreProgress * 1.5);
      coreMat.emissiveColor = new Color3(1, 1 - coreProgress * 0.3, 0.7 - coreProgress * 0.7);

      // Fireball: expand and fade
      const fireScale = 1 + progress * (scale * 2.5);
      fireball.scaling.setAll(fireScale);
      fireballMat.alpha = 0.7 * (1 - progress);
      fireballMat.emissiveColor = new Color3(1, 0.6 - progress * 0.4, 0.2 - progress * 0.2);

      // Smoke: expand faster, fade slower
      const smokeScale = 1 + progress * (scale * 4);
      smoke.scaling.setAll(smokeScale);
      smokeMat.alpha = 0.5 * (1 - progress * 0.8);

      if (progress < 1) {
        requestAnimationFrame(animateExplosion);
      } else {
        core.dispose();
        fireball.dispose();
        smoke.dispose();

        coreMat.dispose();
        fireballMat.dispose();
        smokeMat.dispose();
      }
    };

    requestAnimationFrame(animateExplosion);
  }

  /**
   * Update the spatial hash grid with current enemy positions.
   * Call this at the start of each frame for accurate collision detection.
   */
  private updateSpatialGrid(): void {
    for (const enemy of queries.enemies) {
      if (enemy.tags?.enemy && enemy.transform) {
        this.enemySpatialGrid.updateEntity(enemy);
      }
    }
  }

  /**
   * Register a projectile with additional metadata for collision handling.
   * Call this when spawning a projectile to enable type-specific collision behavior.
   */
  registerProjectile(
    projectileId: string,
    info: ProjectileInfo
  ): void {
    this.projectileInfo.set(projectileId, info);
  }

  /**
   * Get the projectile type for collision handling.
   * Returns 'bullet' as default if not registered.
   */
  private getProjectileType(projectileId: string): ProjectileType {
    return this.projectileInfo.get(projectileId)?.type ?? 'bullet';
  }

  /**
   * Check if a hit position is within an entity's weak point.
   * Returns the damage multiplier if critical, 1.0 otherwise.
   */
  private checkWeakPointHit(
    hitPosition: Vector3,
    target: Entity
  ): { isCritical: boolean; multiplier: number } {
    if (!target.transform || !target.renderable?.mesh) {
      return { isCritical: false, multiplier: 1.0 };
    }

    // Get species-specific weak point config
    const speciesId = target.alienInfo?.speciesId ?? 'default';
    const config = WEAK_POINT_CONFIGS[speciesId] ?? WEAK_POINT_CONFIGS.default;

    // Calculate entity height from mesh bounding info
    const mesh = target.renderable.mesh;
    let entityHeight = 2.0; // Default height
    if ('getBoundingInfo' in mesh) {
      const boundingInfo = (mesh as Mesh).getBoundingInfo();
      if (boundingInfo) {
        entityHeight = boundingInfo.boundingBox.extendSize.y * 2;
      }
    }

    // Calculate weak point world position
    const entityBase = target.transform.position.y;
    const weakPointY = entityBase + entityHeight * config.relativeY;
    const weakPointRadius = entityHeight * config.radiusFraction;

    // Check if hit is within weak point sphere
    const hitY = hitPosition.y;
    const hitXZ = new Vector3(hitPosition.x, 0, hitPosition.z);
    const targetXZ = new Vector3(target.transform.position.x, 0, target.transform.position.z);
    const horizontalDist = Vector3.Distance(hitXZ, targetXZ);

    // Hit must be within vertical range and horizontal radius
    const verticalHit = Math.abs(hitY - weakPointY) < weakPointRadius;
    const horizontalHit = horizontalDist < weakPointRadius;

    if (verticalHit && horizontalHit) {
      return { isCritical: true, multiplier: config.damageMultiplier };
    }

    return { isCritical: false, multiplier: 1.0 };
  }

  /**
   * Perform raycast collision detection from previous to current position.
   * Returns hit info if collision detected.
   */
  private raycastProjectileCollision(
    projectile: Entity,
    previousPos: Vector3,
    currentPos: Vector3,
    targets: Entity[]
  ): { target: Entity; hitPosition: Vector3 } | null {
    const direction = currentPos.subtract(previousPos);
    const distance = direction.length();
    if (distance === 0) return null;

    const normalizedDir = direction.normalize();
    let closestHit: { target: Entity; hitPosition: Vector3; dist: number } | null = null;

    for (const target of targets) {
      if (!target.health || !target.transform) continue;

      // Get target bounding sphere radius
      let targetRadius = 1.0;
      const mesh = target.renderable?.mesh;
      if (mesh && 'getBoundingInfo' in mesh) {
        const boundingInfo = (mesh as Mesh).getBoundingInfo();
        if (boundingInfo) {
          // Use maximum extent as radius for sphere approximation
          const extents = boundingInfo.boundingBox.extendSize;
          targetRadius = Math.max(extents.x, extents.y, extents.z);
        }
      }

      // Ray-sphere intersection test
      const toTarget = target.transform.position.subtract(previousPos);
      const projectionLength = Vector3.Dot(toTarget, normalizedDir);

      // Skip if target is behind or beyond projectile travel
      if (projectionLength < 0 || projectionLength > distance) continue;

      // Find closest point on ray to target center
      const closestPoint = previousPos.add(normalizedDir.scale(projectionLength));
      const distToCenter = Vector3.Distance(closestPoint, target.transform.position);

      // Check if ray passes within target radius
      if (distToCenter <= targetRadius) {
        // Calculate actual hit point on the surface
        const hitDist = projectionLength - Math.sqrt(targetRadius * targetRadius - distToCenter * distToCenter);
        if (hitDist > 0 && hitDist < distance) {
          const hitPosition = previousPos.add(normalizedDir.scale(hitDist));

          if (!closestHit || hitDist < closestHit.dist) {
            closestHit = { target, hitPosition, dist: hitDist };
          }
        }
      }
    }

    return closestHit ? { target: closestHit.target, hitPosition: closestHit.hitPosition } : null;
  }

  /**
   * Apply explosive damage to all entities within radius.
   */
  private applyExplosiveDamage(
    center: Vector3,
    radius: number,
    baseDamage: number,
    isPlayerProjectile: boolean,
    shotOrigin: Vector3
  ): void {
    const targets = this.enemySpatialGrid.getEntitiesInRadius(
      center,
      radius,
      (e) => e.tags?.enemy === true && e.health !== undefined
    );

    for (const target of targets) {
      if (!target.transform || !target.health) continue;

      const dist = Vector3.Distance(center, target.transform.position);
      // Damage falloff: 100% at center, 25% at edge
      const falloff = 1 - (dist / radius) * 0.75;
      const damage = Math.round(baseDamage * falloff);

      target.health.current -= damage;

      // Hit effects
      const hitDirection = target.transform.position.subtract(center).normalize();

      if (isPlayerProjectile) {
        getAchievementManager().onShotHit();
        if (this.onHitMarkerCallback) {
          this.onHitMarkerCallback(damage, false);
        }
      }

      hitAudioManager.playHitSound(damage, false);

      // Apply hit reaction
      if (target.tags?.enemy && target.alienInfo) {
        hitReactionSystem.applyHitReaction(target, damage, hitDirection, shotOrigin);
      }

      // Damage feedback
      if (target.renderable?.mesh) {
        damageFeedback.applyDamageFeedback(target.renderable.mesh, damage, hitDirection);
      }

      // Emit hit event
      const eventBus = getEventBus();
      eventBus.emit({
        type: 'ENEMY_KILLED', // Using existing event type for hit notification
        position: target.transform.position.clone(),
        enemyType: target.alienInfo?.speciesId ?? 'unknown',
        enemyId: target.id,
      });

      // Check death
      if (target.health.current <= 0) {
        this.handleDeath(target, shotOrigin);
      }
    }

    // Create explosion effect
    particleManager.emitExplosion(center, radius / 3);
    this.createExplosion(center, radius / 2);
    getAudioManager().play('explosion');
  }

  /**
   * Main projectile collision detection - runs each frame.
   * Handles different projectile types with appropriate collision methods.
   */
  private checkProjectileCollisions(): void {
    const projectiles = [...queries.projectiles];

    for (const projectile of projectiles) {
      if (!projectile.transform || !projectile.id) continue;

      const currentPos = projectile.transform.position.clone();
      const previousPos = this.projectilePreviousPositions.get(projectile.id) ?? currentPos.clone();

      const isAllyProjectile = projectile.tags?.ally === true;
      const isPlayerProjectile =
        projectile.tags?.player === true || (!isAllyProjectile && !projectile.tags?.enemy);
      const isEnemyProjectile = projectile.tags?.enemy === true;

      // Get projectile type and info
      const projInfo = this.projectileInfo.get(projectile.id);
      const projType = projInfo?.type ?? 'bullet';

      // Determine targets based on projectile ownership
      let targets: Entity[] = [];
      if (isPlayerProjectile || isAllyProjectile) {
        // Use spatial grid for efficient enemy lookup along projectile path
        const travelDist = Vector3.Distance(previousPos, currentPos);
        const searchRadius = Math.max(travelDist, 2);
        const midpoint = previousPos.add(currentPos).scale(0.5);
        targets = this.enemySpatialGrid.getEntitiesInRadius(
          midpoint,
          searchRadius,
          (e) => e.tags?.enemy === true
        );
      } else if (isEnemyProjectile) {
        // Enemy projectiles can hit allies (mechs)
        targets = getEntitiesInRadius(currentPos, 2, (e) => e.tags?.ally === true);
      }

      let hitResult: { target: Entity; hitPosition: Vector3 } | null = null;

      // Different collision detection based on projectile type
      switch (projType) {
        case 'bullet':
          // Fast projectiles use raycast from previous to current position
          hitResult = this.raycastProjectileCollision(projectile, previousPos, currentPos, targets);
          break;

        case 'plasma':
          // Plasma uses sphere collision at current position
          for (const target of targets) {
            if (!target.health || !target.transform) continue;
            const dist = Vector3.Distance(currentPos, target.transform.position);
            const hitRadius = projInfo?.explosionRadius ?? 1.5;
            if (dist < hitRadius) {
              hitResult = { target, hitPosition: currentPos.clone() };
              break;
            }
          }
          break;

        case 'explosive':
          // Explosive uses sphere collision, then applies area damage on impact
          for (const target of targets) {
            if (!target.health || !target.transform) continue;
            const dist = Vector3.Distance(currentPos, target.transform.position);
            if (dist < 1.5) {
              hitResult = { target, hitPosition: currentPos.clone() };
              break;
            }
          }

          // Also check for ground/wall collision (Y near 0 or very close to previous pos with low velocity)
          if (!hitResult && currentPos.y < 0.5) {
            // Explode on ground impact
            const explosionRadius = projInfo?.explosionRadius ?? 5;
            const baseDamage = projInfo?.damage ?? projectile.combat?.damage ?? 50;
            const shotOrigin = previousPos.clone();

            this.applyExplosiveDamage(
              currentPos,
              explosionRadius,
              baseDamage,
              isPlayerProjectile,
              shotOrigin
            );

            // Clean up projectile
            if (projectile.renderable?.mesh) {
              projectile.renderable.mesh.dispose();
            }
            this.projectilePreviousPositions.delete(projectile.id);
            this.projectileInfo.delete(projectile.id);
            removeEntity(projectile);
            continue; // Skip normal hit processing
          }
          break;
      }

      // Process hit if found
      if (hitResult) {
        const { target, hitPosition } = hitResult;

        // Base damage from projectile
        const baseDamage = projInfo?.damage ?? projectile.combat?.damage ?? 25;

        // Check for critical hit (weak point)
        const { isCritical, multiplier } = this.checkWeakPointHit(hitPosition, target);
        const finalDamage = Math.round(baseDamage * multiplier);

        // Apply damage
        target.health!.current -= finalDamage;

        // Track achievements and UI feedback
        if (isPlayerProjectile) {
          getAchievementManager().onShotHit();
          if (this.onHitMarkerCallback) {
            this.onHitMarkerCallback(finalDamage, isCritical);
          }
        }

        // Audio feedback
        hitAudioManager.playHitSound(finalDamage, isCritical);

        // Calculate hit direction for effects
        const hitDirection = hitPosition.subtract(target.transform!.position).normalize();

        // Apply hit reaction for enemies
        if (target.tags?.enemy && target.alienInfo) {
          const shotOrigin = projectile.velocity?.linear
            ? hitPosition.subtract(projectile.velocity.linear.normalize().scale(10))
            : hitPosition;
          hitReactionSystem.applyHitReaction(target, finalDamage, hitDirection, shotOrigin);
        } else {
          getEnemySoundManager().playHitSound(target);
        }

        // Visual feedback
        if (target.renderable?.mesh) {
          damageFeedback.applyDamageFeedback(target.renderable.mesh, finalDamage, hitDirection);

          const targetMesh = target.renderable.mesh;
          if ('getBoundingInfo' in targetMesh) {
            impactDecals.createDecal(
              targetMesh as import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh,
              hitPosition,
              hitDirection.negate(),
              {
                surfaceType: 'organic',
                damage: finalDamage,
              }
            );
          }
        }

        // Particle effects
        particleManager.emitBulletImpact(hitPosition, undefined, 0.8);
        if (isCritical) {
          this.createCriticalHitEffect(hitPosition, 1.2);
        }
        this.createExplosion(hitPosition, 0.5);

        // Emit hit event through EventBus
        const eventBus = getEventBus();
        // Note: Using ENEMY_KILLED event as a hit notification since that's the available event type
        // In a full implementation, we'd add ENEMY_HIT event type

        // Handle explosive projectile area damage on direct hit
        if (projType === 'explosive') {
          const explosionRadius = projInfo?.explosionRadius ?? 5;
          this.applyExplosiveDamage(
            hitPosition,
            explosionRadius,
            baseDamage * 0.5, // Reduced damage for splash
            isPlayerProjectile,
            hitPosition
          );
        }

        // Clean up projectile
        if (projectile.renderable?.mesh) {
          projectile.renderable.mesh.dispose();
        }
        this.projectilePreviousPositions.delete(projectile.id);
        this.projectileInfo.delete(projectile.id);
        removeEntity(projectile);

        // Check if target died
        if (target.health!.current <= 0) {
          const shotOrigin = projectile.velocity?.linear
            ? hitPosition.subtract(projectile.velocity.linear.normalize().scale(10))
            : hitPosition;

          // Emit kill event
          eventBus.emit({
            type: 'ENEMY_KILLED',
            position: target.transform!.position.clone(),
            enemyType: target.alienInfo?.speciesId ?? 'unknown',
            enemyId: target.id,
          });

          this.handleDeath(target, shotOrigin);
        }
      }

      // Store current position for next frame's raycast
      this.projectilePreviousPositions.set(projectile.id, currentPos);
    }

    // Clean up tracking for removed projectiles
    const activeProjectileIds = new Set(projectiles.map((p) => p.id));
    for (const id of this.projectilePreviousPositions.keys()) {
      if (!activeProjectileIds.has(id)) {
        this.projectilePreviousPositions.delete(id);
        this.projectileInfo.delete(id);
      }
    }
  }

  /**
   * Handle entity death with advanced death animations and effects.
   * @param entity - The dying entity
   * @param shotOrigin - Optional position where the killing shot originated (for death force direction)
   */
  private handleDeath(entity: Entity, shotOrigin?: Vector3): void {
    if (!entity.transform) return;

    const position = entity.transform.position.clone();
    const isAlien = entity.tags?.alien === true || entity.tags?.enemy === true;
    const isBoss = entity.tags?.boss === true;
    const isMechanical = entity.tags?.mechanical === true;

    // Determine death effect scale based on entity
    const scale = isBoss ? 2.5 : 1.0;

    // Play death sounds and kill confirmation
    if (isAlien) {
      // Use species-specific death sound through enemy sound manager
      getEnemySoundManager().playDeathSound(entity);
      // Use HitAudioManager for satisfying kill confirmation
      hitAudioManager.playKillSound();
    } else {
      getAudioManager().play('explosion');
      hitAudioManager.playKillSound();
    }

    // Select death animation variation based on species
    let deathDuration = isBoss ? 2000 : 800;
    if (entity.alienInfo) {
      const deathInfo = hitReactionSystem.selectDeathAnimation(entity, shotOrigin);
      deathDuration = deathInfo.duration;

      // Execute the death animation on the mesh
      if (entity.renderable?.mesh) {
        hitReactionSystem.executeDeathAnimation(
          entity.renderable.mesh as Mesh | TransformNode,
          deathInfo.animationType,
          deathInfo.forceDirection,
          scale
        );
      }

      // Clean up hit reaction state
      hitReactionSystem.removeEntity(entity.id);
    }

    // Use new death effects system for advanced particle effects
    if (isBoss) {
      // Epic boss death with shockwave
      deathEffects.playBossDeath(
        position,
        isAlien,
        scale,
        entity.renderable?.mesh as Mesh | undefined
      );
    } else if (isMechanical) {
      // Mechanical enemy - debris and sparks
      deathEffects.playMechanicalDeath(
        position,
        scale,
        entity.renderable?.mesh as Mesh | undefined
      );
    } else {
      // Standard enemy death with dissolve/ichor burst
      deathEffects.playEnemyDeath(
        position,
        isAlien,
        scale,
        entity.renderable?.mesh as Mesh | undefined
      );
    }

    // Also emit legacy particle effects for additional visual reinforcement
    if (isAlien) {
      particleManager.emitAlienDeath(position, scale);
    } else {
      particleManager.emitExplosion(position, scale);
    }

    // Keep legacy mesh explosion for compatibility
    this.createExplosion(position, scale * 1.5);

    // Update stats
    if (entity.tags?.enemy) {
      worldDb.updatePlayerStats({ kills: 1 });
      if (isBoss) {
        worldDb.updatePlayerStats({ bossesDefeated: 1 });
      }
    }

    // Callback
    if (this.onKillCallback) {
      this.onKillCallback(entity);
    }

    // Schedule entity removal after death animation completes
    // The death effects system handles the mesh animation
    window.setTimeout(
      () => {
        removeEntity(entity);
      },
      deathDuration
    );
  }

  private checkEnemyAttacks(_deltaTime: number): void {
    if (!this.playerEntity?.transform) return;

    const playerPos = this.playerEntity.transform.position;

    for (const enemy of queries.enemies) {
      if (!enemy.transform || !enemy.combat || !enemy.ai) continue;
      if (enemy.ai.state !== 'attack') continue;

      const dist = Vector3.Distance(enemy.transform.position, playerPos);

      if (dist < enemy.combat.range) {
        const now = performance.now();
        // Apply difficulty scaling to fire rate
        const scaledFireRate =
          enemy.combat.fireRate * this.difficultyModifiers.enemyFireRateMultiplier;
        const fireInterval = 1000 / scaledFireRate;

        if (now - enemy.combat.lastFire >= fireInterval) {
          enemy.combat.lastFire = now;

          // Fire at player
          this.enemyFire(enemy);
        }
      }
    }
  }

  private enemyFire(enemy: Entity): void {
    if (!enemy.transform || !enemy.combat || !this.playerEntity?.transform) return;

    // Play attack sound for this enemy
    getEnemySoundManager().playAttackSound(enemy);

    const spawnPos = enemy.transform.position.clone();
    spawnPos.y = 1.5;

    const direction = this.playerEntity.transform.position
      .subtract(enemy.transform.position)
      .normalize();

    // Create alien plasma bolt - reddish, more organic looking
    const plasmaBolt = MeshBuilder.CreateCylinder(
      'enemyBolt',
      {
        height: 0.8,
        diameterTop: 0.12,
        diameterBottom: 0.06,
        tessellation: 6,
      },
      this.scene
    );

    // Orient bolt toward player
    const rotationAxis = Vector3.Cross(Vector3.Up(), direction).normalize();
    const angle = Math.acos(Vector3.Dot(Vector3.Up(), direction));
    if (rotationAxis.length() > 0.001) {
      plasmaBolt.rotationQuaternion = Quaternion.RotationAxis(rotationAxis, angle);
    }

    plasmaBolt.position = spawnPos;

    // Red-orange core
    const coreMat = new StandardMaterial('enemyCoreMat', this.scene);
    coreMat.emissiveColor = Color3.FromHexString('#FF6644');
    coreMat.disableLighting = true;
    plasmaBolt.material = coreMat;

    // Outer glow
    const glowShell = MeshBuilder.CreateCylinder(
      'enemyGlow',
      {
        height: 1.0,
        diameterTop: 0.25,
        diameterBottom: 0.15,
        tessellation: 6,
      },
      this.scene
    );
    glowShell.parent = plasmaBolt;
    glowShell.position = Vector3.Zero();

    const glowMat = new StandardMaterial('enemyGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#FF2222');
    glowMat.disableLighting = true;
    glowMat.alpha = 0.35;
    glowShell.material = glowMat;

    // Animate enemy bolt glow
    const boltStartTime = performance.now();
    const animateBolt = () => {
      if (plasmaBolt.isDisposed()) return;

      const elapsed = performance.now() - boltStartTime;
      // Flickering glow
      const flicker = 0.25 + Math.sin(elapsed * 0.025) * 0.1 + Math.random() * 0.05;
      glowMat.alpha = flicker;

      requestAnimationFrame(animateBolt);
    };
    requestAnimationFrame(animateBolt);

    // Add projectile trail particle effect
    this.createProjectileTrail(plasmaBolt, 'enemy_plasma');

    // Emit enhanced muzzle flash with point light for enemy weapon
    muzzleFlash.emit(spawnPos, direction, 'plasma', { scale: 0.6 });

    // Clean up materials when mesh is disposed
    plasmaBolt.onDisposeObservable.add(() => {
      coreMat.dispose();
      glowMat.dispose();
    });

    const velocity = direction.scale(enemy.combat.projectileSpeed);

    createEntity({
      transform: {
        position: plasmaBolt.position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: enemy.combat.projectileSpeed,
      },
      renderable: {
        mesh: plasmaBolt,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          plasmaBolt.dispose();
        },
      },
    });
  }

  private updateProjectiles(deltaTime: number): void {
    for (const projectile of queries.projectiles) {
      if (!projectile.transform || !projectile.velocity) continue;

      // Move projectile
      projectile.transform.position.addInPlace(projectile.velocity.linear.scale(deltaTime));

      // Update mesh
      if (projectile.renderable?.mesh) {
        projectile.renderable.mesh.position = projectile.transform.position.clone();
      }

      // Update lifetime
      if (projectile.lifetime) {
        projectile.lifetime.remaining -= deltaTime * 1000;
        if (projectile.lifetime.remaining <= 0) {
          if (projectile.lifetime.onExpire) {
            projectile.lifetime.onExpire();
          }
          removeEntity(projectile);
        }
      }
    }
  }

  /**
   * Check enemy projectiles hitting the player.
   * Uses raycast detection for fast projectiles and sphere collision for others.
   */
  private checkPlayerHits(): void {
    if (!this.playerEntity?.transform || !this.playerEntity.health) return;

    // Don't process hits if player is already dead
    if (this.playerEntity.health.current <= 0) return;

    const playerPos = this.playerEntity.transform.position;
    const playerRotation = this.playerEntity.transform.rotation;
    const playerRadius = 0.8; // Player collision radius

    for (const projectile of queries.projectiles) {
      if (!projectile.tags?.enemy) continue;
      if (!projectile.transform || !projectile.id) continue;

      const currentPos = projectile.transform.position;
      const previousPos = this.projectilePreviousPositions.get(projectile.id) ?? currentPos;

      // Get projectile info for type-specific handling
      const projInfo = this.projectileInfo.get(projectile.id);
      const projType = projInfo?.type ?? 'plasma'; // Enemy projectiles default to plasma

      let hit = false;
      let hitPosition = currentPos.clone();

      switch (projType) {
        case 'bullet':
          // Raycast collision for fast projectiles
          const direction = currentPos.subtract(previousPos);
          const distance = direction.length();
          if (distance > 0) {
            const normalizedDir = direction.normalize();
            const toPlayer = playerPos.subtract(previousPos);
            const projLength = Vector3.Dot(toPlayer, normalizedDir);

            if (projLength >= 0 && projLength <= distance) {
              const closestPoint = previousPos.add(normalizedDir.scale(projLength));
              const distToPlayer = Vector3.Distance(closestPoint, playerPos);

              if (distToPlayer <= playerRadius) {
                hit = true;
                hitPosition = closestPoint;
              }
            }
          }
          break;

        case 'plasma':
        case 'explosive':
        default:
          // Sphere collision for slower projectiles
          const dist = Vector3.Distance(currentPos, playerPos);
          if (dist < playerRadius + 0.5) {
            hit = true;
            hitPosition = currentPos.clone();
          }
          break;
      }

      if (hit) {
        // Calculate base damage from projectile
        const baseDamage = projInfo?.damage ?? projectile.combat?.damage ?? 10;
        const damage = Math.round(
          baseDamage * this.difficultyModifiers.playerDamageReceivedMultiplier
        );

        // Apply damage
        this.playerEntity.health.current = Math.max(0, this.playerEntity.health.current - damage);

        // Calculate direction of damage relative to player facing
        const damageDir = hitPosition.subtract(playerPos);
        const worldAngle = Math.atan2(damageDir.x, damageDir.z);
        const relativeAngle = worldAngle - playerRotation.y;

        // Emit directional damage for UI
        if (this.onDirectionalDamageCallback) {
          this.onDirectionalDamageCallback(relativeAngle, damage);
        }

        // Emit player damaged event
        const eventBus = getEventBus();
        eventBus.emit({
          type: 'PLAYER_DAMAGED',
          amount: damage,
          direction: relativeAngle,
        });

        // Track death cause
        this.lastDeathCause = 'HOSTILE FIRE';

        // Audio feedback
        getAudioManager().play('player_damage');

        // Apply player damage feedback (screen shake, vignette)
        damageFeedback.applyPlayerDamageFeedback(damage);

        if (this.onPlayerDamageCallback) {
          this.onPlayerDamageCallback(damage);
        }

        // Handle explosive projectile splash damage
        if (projType === 'explosive') {
          const explosionRadius = projInfo?.explosionRadius ?? 3;
          // Player takes additional splash damage if close to explosion center
          const splashDamage = Math.round(baseDamage * 0.3);
          this.playerEntity.health.current = Math.max(
            0,
            this.playerEntity.health.current - splashDamage
          );
          particleManager.emitExplosion(hitPosition, explosionRadius / 3);
          getAudioManager().play('explosion');
        }

        // Create hit effects
        particleManager.emitBulletImpact(hitPosition, undefined, 0.5);
        this.createExplosion(hitPosition, 0.3);

        // Clean up projectile
        if (projectile.renderable?.mesh) {
          projectile.renderable.mesh.dispose();
        }
        this.projectilePreviousPositions.delete(projectile.id);
        this.projectileInfo.delete(projectile.id);
        removeEntity(projectile);
      }
    }
  }

  /**
   * Create muzzle flash effect at position
   * Uses enhanced multi-layered muzzle flash with core, sparks, and smoke
   */
  createMuzzleFlash(position: Vector3, direction: Vector3): void {
    // Use the enhanced muzzle flash with multiple particle layers
    particleManager.emitEnhancedMuzzleFlash(position, direction);
  }

  /**
   * Create bullet impact effect at position
   * Uses ImpactParticles (multi-layer surface VFX), ImpactDecals (bullet holes), and weaponEffects
   * @param position - Impact position in world space
   * @param normal - Surface normal at impact point
   * @param surfaceType - Surface type for material-specific effects
   * @param damage - Damage amount (affects intensity and decal size)
   * @param targetMesh - Optional mesh to project decal onto
   */
  createBulletImpact(
    position: Vector3,
    normal?: Vector3,
    surfaceType: 'metal' | 'concrete' | 'organic' | 'ice' | 'energy' | 'dirt' | 'default' = 'default',
    damage = 25,
    targetMesh?: import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh
  ): void {
    // Use impact particles for enhanced multi-layer surface VFX
    impactParticles.emit(position, normal, surfaceType as ImpactSurfaceType, {
      scale: 1,
      damage,
    });

    // Create impact decal on the target mesh if provided
    if (targetMesh && normal) {
      // Map surface types to decal types
      const decalSurfaceType: DecalSurfaceType =
        surfaceType === 'energy' || surfaceType === 'dirt' || surfaceType === 'default'
          ? 'metal'
          : (surfaceType as DecalSurfaceType);

      impactDecals.createDecal(targetMesh, position, normal, {
        surfaceType: decalSurfaceType,
        damage,
      });
    }

    // Also use weapon effects for additional visual reinforcement
    const mappedSurface =
      surfaceType === 'ice' || surfaceType === 'dirt' ? 'default' : surfaceType;
    weaponEffects.emitImpact(position, normal, mappedSurface);
  }

  /**
   * Create alien splatter effect with directional spray
   */
  createAlienSplatter(position: Vector3, hitDirection?: Vector3, scale = 1): void {
    weaponEffects.emitEnemyHit(position, hitDirection, true, scale * 25);
  }

  /**
   * Create blood splatter effect for human targets
   */
  createBloodSplatter(position: Vector3, hitDirection?: Vector3, scale = 1): void {
    weaponEffects.emitEnemyHit(position, hitDirection, false, scale * 25);
  }

  /**
   * Create explosion effect
   */
  createParticleExplosion(position: Vector3, scale = 1): void {
    particleManager.emitExplosion(position, scale);
  }

  /**
   * Create critical hit effect - extra flashy burst
   */
  createCriticalHitEffect(position: Vector3, scale = 1): void {
    particleManager.emitCriticalHit(position, scale);
  }

  /**
   * Create ice shard impact - blue/white crystalline particles
   * Ideal for Southern Ice level and ice environments
   */
  createIceImpact(position: Vector3, normal?: Vector3, scale = 1): void {
    impactParticles.emitIceImpact(position, normal, scale);
  }

  /**
   * Create energy/plasma impact - electrical arcs and plasma glow
   * Used for energy weapons and shield impacts
   */
  createEnergyImpact(position: Vector3, normal?: Vector3, scale = 1): void {
    impactParticles.emitEnergyImpact(position, normal, scale);
  }

  /**
   * Create dirt impact - earthen dust and debris
   * Used for outdoor/surface environments
   */
  createDirtImpact(position: Vector3, normal?: Vector3, scale = 1): void {
    impactParticles.emitDirtImpact(position, normal, scale);
  }

  /**
   * Create surface-specific impact based on detected material
   * Bridges surface detection to appropriate particle effect
   */
  createSurfaceImpact(
    position: Vector3,
    normal: Vector3 | undefined,
    surfaceMaterial: string,
    scale = 1,
    damage = 25
  ): void {
    impactParticles.emitSurfaceImpact(position, normal, surfaceMaterial, scale, damage);
  }

  /**
   * Create projectile trail for a given projectile mesh
   * Call this when spawning a projectile to add a trailing particle effect
   */
  createProjectileTrail(
    projectileMesh: ReturnType<typeof MeshBuilder.CreateCylinder>,
    trailType: 'player_plasma' | 'enemy_plasma' | 'alien_acid' | 'heavy' | 'default' = 'default'
  ): void {
    const projectileId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    weaponEffects.createProjectileTrail(projectileMesh, trailType, projectileId);
  }

  update(deltaTime: number): void {
    // Update spatial grid with current enemy positions for efficient collision queries
    this.updateSpatialGrid();

    this.updateProjectiles(deltaTime);
    this.checkProjectileCollisions();
    this.checkEnemyAttacks(deltaTime);
    this.checkPlayerHits();

    // Update hit reaction stagger states
    hitReactionSystem.update();
  }

  dispose(): void {
    // Clean up all active projectiles
    for (const projectile of queries.projectiles) {
      if (projectile.renderable?.mesh) {
        projectile.renderable.mesh.dispose();
      }
      removeEntity(projectile);
    }

    // Dispose hit reaction system
    hitReactionSystem.dispose();

    // Dispose impact particles system
    impactParticles.dispose();

    // Dispose impact decals system
    impactDecals.dispose();

    // Clear spatial grid and tracking maps
    this.enemySpatialGrid.clear();
    this.projectilePreviousPositions.clear();
    this.projectileInfo.clear();

    // Clear references
    this.playerEntity = null;
    this.onKillCallback = null;
    this.onPlayerDamageCallback = null;
    this.onHitMarkerCallback = null;
    this.onDirectionalDamageCallback = null;
  }
}
