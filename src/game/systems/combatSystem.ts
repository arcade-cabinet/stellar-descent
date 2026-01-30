import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { createEntity, type Entity, getEntitiesInRadius, queries, removeEntity } from '../core/ecs';
import { worldDb } from '../db/worldDatabase';
import { tokens } from '../utils/designTokens';

export class CombatSystem {
  private scene: Scene;
  private playerEntity: Entity | null = null;
  private onKillCallback: ((entity: Entity) => void) | null = null;
  private onPlayerDamageCallback: ((amount: number) => void) | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
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
      const isPlayerProjectile = projectile.tags?.player === true || (!isAllyProjectile && !projectile.tags?.enemy);
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
          // Hit!
          const damage = 25; // Default projectile damage
          target.health.current -= damage;

          // Create hit effect
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

    // Create death explosion
    this.createExplosion(entity.transform.position, 2);

    // Update stats
    if (entity.tags?.enemy) {
      worldDb.updatePlayerStats({ kills: 1 });
      if (entity.tags?.boss) {
        worldDb.updatePlayerStats({ bossesDefeated: 1 });
      }
    }

    // Callback
    if (this.onKillCallback) {
      this.onKillCallback(entity);
    }

    // Death animation
    if (entity.renderable?.mesh) {
      const mesh = entity.renderable.mesh;
      const startTime = performance.now();
      const duration = 500;

      const animateDeath = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Shrink horizontally, stretch vertically
        mesh.scaling.x = 1 - progress;
        mesh.scaling.y = 1 + progress;
        mesh.scaling.z = 1 - progress;

        if (progress < 1) {
          requestAnimationFrame(animateDeath);
        } else {
          removeEntity(entity);
        }
      };

      requestAnimationFrame(animateDeath);
    } else {
      removeEntity(entity);
    }
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
        const fireInterval = 1000 / enemy.combat.fireRate;

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

    const playerPos = this.playerEntity.transform.position;

    // Check enemy projectiles hitting player
    for (const projectile of queries.projectiles) {
      if (!projectile.tags?.enemy) continue;
      if (!projectile.transform) continue;

      const dist = Vector3.Distance(projectile.transform.position, playerPos);
      if (dist < 1) {
        // Player hit
        const damage = 10;
        this.playerEntity.health.current -= damage;

        if (this.onPlayerDamageCallback) {
          this.onPlayerDamageCallback(damage);
        }

        // Remove projectile
        if (projectile.renderable?.mesh) {
          projectile.renderable.mesh.dispose();
        }
        removeEntity(projectile);

        // Create hit effect
        this.createExplosion(projectile.transform.position, 0.3);
      }
    }
  }

  update(deltaTime: number): void {
    this.updateProjectiles(deltaTime);
    this.checkProjectileCollisions();
    this.checkEnemyAttacks(deltaTime);
    this.checkPlayerHits();
  }
}
