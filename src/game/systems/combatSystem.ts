import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getAchievementManager } from '../achievements';
import { getAudioManager } from '../core/AudioManager';
import {
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  loadDifficultySetting,
} from '../core/DifficultySettings';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { createEntity, type Entity, getEntitiesInRadius, queries, removeEntity } from '../core/ecs';
import { worldDb } from '../db/worldDatabase';
import { damageFeedback } from '../effects/DamageFeedback';
import { deathEffects } from '../effects/DeathEffects';
import { muzzleFlash } from '../effects/MuzzleFlash';
import { particleManager } from '../effects/ParticleManager';
import { weaponEffects } from '../effects/WeaponEffects';
import { tokens } from '../utils/designTokens';

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

    // Load difficulty settings
    this.difficulty = loadDifficultySetting();
    this.difficultyModifiers = getDifficultyModifiers(this.difficulty);
    console.log(`[CombatSystem] Initialized with difficulty: ${this.difficulty}`);
  }

  /**
   * Update difficulty setting - call this when difficulty changes mid-game
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    this.difficulty = difficulty;
    this.difficultyModifiers = getDifficultyModifiers(difficulty);
    console.log(`[CombatSystem] Difficulty changed to: ${difficulty}`);
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

  private checkProjectileCollisions(): void {
    // Get all projectiles
    const projectiles = [...queries.projectiles];

    for (const projectile of projectiles) {
      if (!projectile.transform) continue;

      const projPos = projectile.transform.position;
      const isAllyProjectile = projectile.tags?.ally === true;
      const isPlayerProjectile =
        projectile.tags?.player === true || (!isAllyProjectile && !projectile.tags?.enemy);
      const isEnemyProjectile = projectile.tags?.enemy === true;

      // Check against appropriate targets
      let targets: Entity[] = [];

      if (isPlayerProjectile || isAllyProjectile) {
        // Player/Ally shots hit enemies
        targets = getEntitiesInRadius(projPos, 2, (e) => e.tags?.enemy === true);
      } else if (isEnemyProjectile) {
        // Enemy shots hit player (handled in checkPlayerHits, but good to have symmetry here or avoid double check)
        // checkPlayerHits handles player collision specifically.
        // If we wanted enemy fire to hit allies (mechs), we'd add that here.
        targets = getEntitiesInRadius(projPos, 2, (e) => e.tags?.ally === true);
      }

      for (const target of targets) {
        if (!target.health || !target.transform) continue;

        const dist = Vector3.Distance(projPos, target.transform.position);
        if (dist < 1.5) {
          // Hit! Use damage from projectile's combat component if available
          const baseDamage = projectile.combat?.damage ?? 25;

          // Check if this was a critical hit (headshot - hit upper 30% of enemy)
          const hitHeight = projPos.y - target.transform.position.y;
          // Get enemy height from mesh bounding info if available
          const mesh = target.renderable?.mesh;
          const enemyHeight =
            mesh && 'getBoundingInfo' in mesh
              ? ((mesh as Mesh).getBoundingInfo()?.boundingBox?.extendSize.y ?? 1)
              : 1;
          const isCritical = hitHeight > enemyHeight * 0.7;

          // Apply bonus damage for critical hits
          const finalDamage = isCritical ? Math.round(baseDamage * 1.5) : baseDamage;
          target.health.current -= finalDamage;

          // Track shot hit for achievements (only for player projectiles)
          if (isPlayerProjectile) {
            getAchievementManager().onShotHit();

            // Emit hit marker for UI feedback
            if (this.onHitMarkerCallback) {
              this.onHitMarkerCallback(finalDamage, isCritical);
            }
          }

          // Play hit marker sound (different for critical)
          if (isCritical) {
            getAudioManager().play('headshot');
          } else {
            getAudioManager().play('hit_marker');
          }

          // Play enemy hit sound (pain/reaction sound)
          if (target.tags?.enemy) {
            getEnemySoundManager().playHitSound(target);
          }

          // Apply damage feedback if target has a mesh
          if (target.renderable?.mesh) {
            const hitDirection = projPos.subtract(target.transform.position).normalize();
            damageFeedback.applyDamageFeedback(target.renderable.mesh, finalDamage, hitDirection);
          }

          // Create hit effect with particles
          particleManager.emitBulletImpact(projPos, undefined, 0.8);
          // Keep mesh explosion for visual reinforcement
          this.createExplosion(projPos, 0.5);

          // Remove projectile
          if (projectile.renderable?.mesh) {
            projectile.renderable.mesh.dispose();
          }
          removeEntity(projectile);

          // Check if target died
          if (target.health.current <= 0) {
            this.handleDeath(target);
          }

          break;
        }
      }
    }
  }

  private handleDeath(entity: Entity): void {
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
      getAudioManager().playKillConfirmation(0.4);
    } else {
      getAudioManager().play('explosion');
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
      isBoss ? 2000 : 800
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

  private checkPlayerHits(): void {
    if (!this.playerEntity?.transform || !this.playerEntity.health) return;

    // Don't process hits if player is already dead
    if (this.playerEntity.health.current <= 0) return;

    const playerPos = this.playerEntity.transform.position;
    const playerRotation = this.playerEntity.transform.rotation;

    // Check enemy projectiles hitting player
    for (const projectile of queries.projectiles) {
      if (!projectile.tags?.enemy) continue;
      if (!projectile.transform) continue;

      const dist = Vector3.Distance(projectile.transform.position, playerPos);
      if (dist < 1) {
        // Player hit - apply difficulty scaling to damage received
        const baseDamage = 10;
        const damage = Math.round(
          baseDamage * this.difficultyModifiers.playerDamageReceivedMultiplier
        );
        // Clamp health to minimum 0
        this.playerEntity.health.current = Math.max(0, this.playerEntity.health.current - damage);

        // Calculate direction of damage relative to player facing
        // This gives us the angle for directional damage indicators
        const damageDir = projectile.transform.position.subtract(playerPos);
        // Get angle in XZ plane (ignoring Y)
        const worldAngle = Math.atan2(damageDir.x, damageDir.z);
        // Adjust for player rotation to get relative angle (0 = front, PI/2 = right, etc.)
        const relativeAngle = worldAngle - playerRotation.y;

        // Emit directional damage for UI
        if (this.onDirectionalDamageCallback) {
          this.onDirectionalDamageCallback(relativeAngle, damage);
        }

        // Track death cause
        this.lastDeathCause = 'HOSTILE FIRE';

        // Play player damage sound
        getAudioManager().play('player_damage');

        // Apply player damage feedback (screen shake)
        damageFeedback.applyPlayerDamageFeedback(damage);

        if (this.onPlayerDamageCallback) {
          this.onPlayerDamageCallback(damage);
        }

        // Remove projectile
        if (projectile.renderable?.mesh) {
          projectile.renderable.mesh.dispose();
        }
        removeEntity(projectile);

        // Create hit effect with particles
        particleManager.emitBulletImpact(projectile.transform.position, undefined, 0.5);
        // Keep legacy mesh explosion
        this.createExplosion(projectile.transform.position, 0.3);
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
   * @param surfaceType - Optional surface type for material-specific effects
   */
  createBulletImpact(
    position: Vector3,
    normal?: Vector3,
    surfaceType: 'metal' | 'concrete' | 'organic' | 'default' = 'default'
  ): void {
    // Use weapon effects for surface-aware impacts
    weaponEffects.emitImpact(position, normal, surfaceType);
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
    this.updateProjectiles(deltaTime);
    this.checkProjectileCollisions();
    this.checkEnemyAttacks(deltaTime);
    this.checkPlayerHits();
  }

  dispose(): void {
    // Clean up all active projectiles
    for (const projectile of queries.projectiles) {
      if (projectile.renderable?.mesh) {
        projectile.renderable.mesh.dispose();
      }
      removeEntity(projectile);
    }

    // Clear references
    this.playerEntity = null;
    this.onKillCallback = null;
    this.onPlayerDamageCallback = null;
    this.onHitMarkerCallback = null;
    this.onDirectionalDamageCallback = null;
  }
}
