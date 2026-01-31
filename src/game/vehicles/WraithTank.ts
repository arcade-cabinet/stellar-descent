/**
 * WraithTank - AI-controlled enemy tank vehicle
 *
 * Inspired by the Covenant Wraith from Halo.
 *
 * Features:
 *  - AI patrol and chase behaviours
 *  - Mortar weapon (arcing plasma projectile)
 *  - Boost ability on cooldown
 *  - Weak point on rear (double damage)
 *  - Hijackable by player when health drops below 25%
 *  - Loads GLB model from models/vehicles/wraith.glb
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, type Entity, getEntitiesInRadius, removeEntity } from '../core/ecs';
import { particleManager } from '../effects/ParticleManager';
import type { Player } from '../entities/player';
import { VehicleBase, type VehicleStats, type VehicleWeapon } from './VehicleBase';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const WRAITH_STATS: VehicleStats = {
  health: 600,
  maxHealth: 600,
  shield: 150,
  maxShield: 150,
  shieldRegenRate: 10,
  shieldRegenDelay: 5000,
  speed: 0,
  maxSpeed: 18,
  acceleration: 10,
  turnRate: 0.8,
  mass: 6000,
};

// AI tuning
const PATROL_SPEED = 6;
const CHASE_SPEED = 14;
const DETECTION_RANGE = 60;
const ATTACK_RANGE = 50;
const MORTAR_ARC_HEIGHT = 25; // peak height of mortar arc
const BOOST_SPEED_MULT = 2.5;
const BOOST_DURATION = 1.5; // seconds
const BOOST_COOLDOWN = 8; // seconds
const HIJACK_HEALTH_THRESHOLD = 0.25;
const WEAK_POINT_ANGLE = Math.PI / 3; // 60 degree cone from rear

// Colors
const WRAITH_GLOW = '#9B59B6';
const WRAITH_MORTAR_GLOW = '#FF4488';

// --------------------------------------------------------------------------
// AI State
// --------------------------------------------------------------------------

export type WraithAIState = 'patrol' | 'chase' | 'attack' | 'stunned';

export class WraithTank extends VehicleBase {
  // AI
  public aiState: WraithAIState = 'patrol';
  private playerTarget: Player | null = null;
  private patrolPoints: Vector3[] = [];
  private currentPatrolIndex = 0;
  private stateTimer = 0;

  // Boost
  private isBoosting = false;
  private boostTimer = 0;
  private boostCooldownTimer = 0;

  // Hijack
  public isHijackable = false;
  private isHijacked = false;

  // Stun (when damaged enough to be hijackable)
  private stunDuration = 0;

  // Visual refs
  private mortarGlowMesh: Mesh | null = null;
  private boostTrailMeshes: Mesh[] = [];
  private glowMat: StandardMaterial | null = null;

  // GLB model node
  private glbNode: TransformNode | null = null;

  // Flag indicating whether the GLB model has been loaded
  private _modelLoaded = false;

  constructor(scene: Scene, position: Vector3, patrolPoints?: Vector3[]) {
    super(scene, `wraith_${Date.now()}`, 'Wraith Tank', position, WRAITH_STATS, 0);
    this.weapons = this.initWeapons();
    this.setVehicleCameraOffset(new Vector3(0, 5, -12));

    // Tag as enemy
    if (this.entity.tags) {
      this.entity.tags.enemy = true;
    }

    // Setup patrol route
    if (patrolPoints && patrolPoints.length > 0) {
      this.patrolPoints = patrolPoints;
    } else {
      // Default patrol: circle around spawn
      const center = position.clone();
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        this.patrolPoints.push(
          center.add(new Vector3(Math.cos(angle) * 30, 0, Math.sin(angle) * 30))
        );
      }
    }
  }

  /**
   * Async factory method. Use this instead of `new WraithTank(...)` to ensure
   * the GLB model is loaded before the tank is used.
   */
  static async create(
    scene: Scene,
    position: Vector3,
    patrolPoints?: Vector3[]
  ): Promise<WraithTank> {
    const tank = new WraithTank(scene, position, patrolPoints);
    await tank.loadModel();
    return tank;
  }

  /**
   * Load the GLB model and attach it to the root transform node.
   */
  private async loadModel(): Promise<void> {
    try {
      // Ensure the asset is loaded (may already be cached from level preload)
      await AssetManager.loadAsset('vehicles', 'wraith', this.scene);

      // Create an instance parented to our root node
      const instance = AssetManager.createInstance(
        'vehicles',
        'wraith',
        `wraith_model_${this.vehicleId}`,
        this.scene
      );

      if (instance) {
        instance.parent = this.rootNode;
        instance.position = Vector3.Zero();
        this.glbNode = instance;
        this._modelLoaded = true;
        console.log(`[WraithTank] GLB model loaded for ${this.vehicleId}`);
      } else {
        throw new Error(`[WraithTank] GLB instance creation failed for ${this.vehicleId} - asset not preloaded or path invalid`);
      }
    } catch (err) {
      throw new Error(`[WraithTank] Failed to load GLB model for ${this.vehicleId}: ${err}`);
    }
  }

  // ------------------------------------------------------------------
  // Hull
  // ------------------------------------------------------------------

  /**
   * Called synchronously by VehicleBase constructor.
   * We cannot load GLB here (async), so this is intentionally a no-op.
   * The actual model is loaded via the async `loadModel()` method
   * called from the static `create()` factory.
   */
  protected buildHull(): void {
    // No-op: GLB model is loaded asynchronously via loadModel().
  }

  // ------------------------------------------------------------------
  // Weapons
  // ------------------------------------------------------------------

  protected initWeapons(): VehicleWeapon[] {
    return [
      {
        id: 'mortar',
        name: 'Plasma Mortar',
        damage: 80,
        fireRate: 0.35,
        cooldownMax: 1.0,
        heatPerShot: 0.4,
        coolRate: 0.12,
        projectileSpeed: 30,
        isAOE: true,
        aoeRadius: 10,
        lastFireTime: 0,
        currentHeat: 0,
        isOverheated: false,
      },
    ];
  }

  public fireWeapon(): void {
    this.fireMortar();
  }

  public fireSecondaryWeapon(): void {
    // Wraith has no secondary; boost is the "secondary"
    this.activateBoost();
  }

  private fireMortar(): void {
    const weapon = this.weapons[0];
    if (!this.canFireWeapon(weapon)) return;
    if (!this.playerTarget) return;
    this.onWeaponFired(weapon);

    const targetPos = this.playerTarget.getPosition();
    const spawnPos = this.rootNode.position.add(new Vector3(0, 3.6, 0));

    // Calculate arcing trajectory
    const toTarget = targetPos.subtract(spawnPos);
    const horizontalDist = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
    const timeToTarget = horizontalDist / weapon.projectileSpeed;

    // Initial velocity: horizontal toward target, vertical for arc
    const horizontalDir = new Vector3(toTarget.x, 0, toTarget.z).normalize();
    const initialVelocity = horizontalDir.scale(weapon.projectileSpeed);
    initialVelocity.y = MORTAR_ARC_HEIGHT / timeToTarget + 0.5 * 9.8 * timeToTarget;

    this.createMortarProjectile(spawnPos, initialVelocity, weapon);
    getAudioManager().play('mech_fire', { volume: 0.5 });
  }

  private createMortarProjectile(
    spawnPos: Vector3,
    initialVelocity: Vector3,
    weapon: VehicleWeapon
  ): void {
    const mortar = MeshBuilder.CreateSphere(
      'wraithMortar',
      { diameter: 1.2, segments: 8 },
      this.scene
    );
    mortar.position = spawnPos;

    const mat = new StandardMaterial('wraithMortarMat', this.scene);
    mat.emissiveColor = Color3.FromHexString(WRAITH_MORTAR_GLOW);
    mat.disableLighting = true;
    mortar.material = mat;

    // Glow shell
    const shell = MeshBuilder.CreateSphere(
      'wraithMortarShell',
      { diameter: 2, segments: 6 },
      this.scene
    );
    const shellMat = new StandardMaterial('wraithMortarShellMat', this.scene);
    shellMat.emissiveColor = Color3.FromHexString(WRAITH_GLOW);
    shellMat.disableLighting = true;
    shellMat.alpha = 0.25;
    shell.material = shellMat;
    shell.parent = mortar;

    mortar.onDisposeObservable.add(() => {
      mat.dispose();
      shellMat.dispose();
    });

    const velocity = initialVelocity.clone();

    const mortarEntity = createEntity({
      transform: {
        position: spawnPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: 100,
      },
      renderable: {
        mesh: mortar,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 6000,
        onExpire: () => {
          this.detonateMortar(mortar.position, weapon);
          mortar.dispose();
        },
      },
    });

    // Apply gravity each frame
    const applyGravity = () => {
      if (mortar.isDisposed()) return;
      if (mortarEntity.velocity) {
        mortarEntity.velocity.linear.y -= 9.8 * 0.016;
      }
      // Ground impact check
      if (mortarEntity.transform && mortarEntity.transform.position.y <= 0.5) {
        this.detonateMortar(mortarEntity.transform.position, weapon);
        mortar.dispose();
        removeEntity(mortarEntity);
        return;
      }
      requestAnimationFrame(applyGravity);
    };
    requestAnimationFrame(applyGravity);
  }

  private detonateMortar(position: Vector3, weapon: VehicleWeapon): void {
    const radius = weapon.aoeRadius ?? 10;
    const targets = getEntitiesInRadius(position, radius, (e) => e.tags?.player === true);
    for (const target of targets) {
      if (!target.health || !target.transform) continue;
      const dist = Vector3.Distance(position, target.transform.position);
      const falloff = 1 - dist / radius;
      const dmg = Math.round(weapon.damage * Math.max(0.15, falloff));
      target.health.current = Math.max(0, target.health.current - dmg);
    }

    particleManager.emitExplosion(position, 2);
    getAudioManager().play('explosion', { volume: 0.6 });
  }

  // ------------------------------------------------------------------
  // Boost
  // ------------------------------------------------------------------

  private activateBoost(): void {
    if (this.isBoosting || this.boostCooldownTimer > 0) return;
    this.isBoosting = true;
    this.boostTimer = BOOST_DURATION;
    console.log('[Wraith] Boost activated');
  }

  private updateBoost(deltaTime: number): void {
    if (this.boostCooldownTimer > 0) {
      this.boostCooldownTimer = Math.max(0, this.boostCooldownTimer - deltaTime);
    }

    if (!this.isBoosting) {
      // Fade boost trail
      for (const trail of this.boostTrailMeshes) {
        if (trail.material instanceof StandardMaterial) {
          trail.material.alpha = Math.max(0, trail.material.alpha - deltaTime * 3);
        }
      }
      return;
    }

    this.boostTimer -= deltaTime;
    if (this.boostTimer <= 0) {
      this.isBoosting = false;
      this.boostCooldownTimer = BOOST_COOLDOWN;
      console.log('[Wraith] Boost ended, cooldown started');
    }

    // Show boost trail
    for (const trail of this.boostTrailMeshes) {
      if (trail.material instanceof StandardMaterial) {
        trail.material.alpha = 0.6 + Math.sin(performance.now() * 0.01) * 0.2;
      }
    }
  }

  // ------------------------------------------------------------------
  // Weak point damage
  // ------------------------------------------------------------------

  public override takeDamage(amount: number, source?: Vector3): void {
    // Check if damage is from the rear (weak point)
    if (source) {
      const toSource = source.subtract(this.rootNode.position).normalize();
      const forward = this.getForward();
      const dot = Vector3.Dot(forward, toSource);
      // dot > 0 means source is in front, dot < 0 means behind
      // We want rear: check if the angle from rear is within WEAK_POINT_ANGLE
      if (dot > Math.cos(Math.PI - WEAK_POINT_ANGLE)) {
        // Hit from rear - double damage
        amount *= 2;
        console.log('[Wraith] Weak point hit! Double damage');
      }
    }

    super.takeDamage(amount, source);

    // Check hijack threshold
    const ratio = this.stats.health / this.stats.maxHealth;
    if (ratio <= HIJACK_HEALTH_THRESHOLD && !this.isHijackable) {
      this.isHijackable = true;
      this.aiState = 'stunned';
      this.stunDuration = 10; // 10 seconds to hijack
      console.log('[Wraith] Stunned - hijackable!');
    }
  }

  // ------------------------------------------------------------------
  // Hijack
  // ------------------------------------------------------------------

  public canHijack(player: Player): boolean {
    if (!this.isHijackable) return false;
    if (this.isHijacked) return false;
    if (this.aiState !== 'stunned') return false;
    const dist = Vector3.Distance(player.getPosition(), this.rootNode.position);
    return dist < 5;
  }

  public hijack(player: Player): void {
    if (!this.canHijack(player)) return;

    this.isHijacked = true;
    this.isHijackable = false;
    this.aiState = 'patrol'; // will be overridden by player control

    // Remove enemy tag, add player tag
    if (this.entity.tags) {
      this.entity.tags.enemy = false;
      this.entity.tags.player = true;
    }

    // Enter the vehicle as pilot
    // Override canEnter check since we already validated
    (this as any)._isOccupied = true;
    (this as any)._pilot = player;
    this.isPlayerInVehicle = true;

    player.mesh.isVisible = false;
    this.scene.activeCamera = this.vehicleCamera;

    getAudioManager().play('door_open', { volume: 0.5 });
    console.log('[Wraith] Hijacked by player!');
  }

  // ------------------------------------------------------------------
  // AI
  // ------------------------------------------------------------------

  public setPlayerTarget(player: Player): void {
    this.playerTarget = player;
  }

  private updateAI(deltaTime: number): void {
    if (this.isOccupied || this.isHijacked) return; // player controls

    switch (this.aiState) {
      case 'patrol':
        this.updatePatrol(deltaTime);
        this.checkForPlayer();
        break;
      case 'chase':
        this.updateChase(deltaTime);
        break;
      case 'attack':
        this.updateAttack(deltaTime);
        break;
      case 'stunned':
        this.updateStunned(deltaTime);
        break;
    }
  }

  private updatePatrol(deltaTime: number): void {
    if (this.patrolPoints.length === 0) return;

    const target = this.patrolPoints[this.currentPatrolIndex];
    const toTarget = target.subtract(this.rootNode.position);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < 3) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      return;
    }

    const dir = toTarget.normalize();
    this.moveToward(dir, PATROL_SPEED, deltaTime);
  }

  private checkForPlayer(): void {
    if (!this.playerTarget) return;
    const dist = Vector3.Distance(this.rootNode.position, this.playerTarget.getPosition());
    if (dist < DETECTION_RANGE) {
      this.aiState = 'chase';
      console.log('[Wraith] Player detected, chasing');
    }
  }

  private updateChase(deltaTime: number): void {
    if (!this.playerTarget) {
      this.aiState = 'patrol';
      return;
    }

    const playerPos = this.playerTarget.getPosition();
    const dist = Vector3.Distance(this.rootNode.position, playerPos);

    if (dist > DETECTION_RANGE * 1.5) {
      this.aiState = 'patrol';
      return;
    }

    if (dist < ATTACK_RANGE) {
      this.aiState = 'attack';
      return;
    }

    const toPlayer = playerPos.subtract(this.rootNode.position);
    toPlayer.y = 0;
    const dir = toPlayer.normalize();

    const speed = this.isBoosting ? CHASE_SPEED * BOOST_SPEED_MULT : CHASE_SPEED;
    this.moveToward(dir, speed, deltaTime);

    // Consider boosting if far away
    if (dist > ATTACK_RANGE * 1.2 && !this.isBoosting && this.boostCooldownTimer <= 0) {
      this.activateBoost();
    }
  }

  private updateAttack(deltaTime: number): void {
    if (!this.playerTarget) {
      this.aiState = 'patrol';
      return;
    }

    const playerPos = this.playerTarget.getPosition();
    const dist = Vector3.Distance(this.rootNode.position, playerPos);

    if (dist > ATTACK_RANGE * 1.3) {
      this.aiState = 'chase';
      return;
    }

    // Face the player
    const toPlayer = playerPos.subtract(this.rootNode.position);
    toPlayer.y = 0;
    const dir = toPlayer.normalize();
    this.faceDirection(dir, deltaTime);

    // Fire mortar
    this.fireMortar();

    // Slow strafe to avoid being an easy target
    this.stateTimer += deltaTime;
    const strafeDir = Vector3.Cross(dir, Vector3.Up()).normalize();
    const strafeSide = Math.sin(this.stateTimer * 0.5) > 0 ? 1 : -1;
    this.moveToward(strafeDir.scale(strafeSide), 4, deltaTime);
  }

  private updateStunned(deltaTime: number): void {
    this.stunDuration -= deltaTime;
    if (this.stunDuration <= 0) {
      this.isHijackable = false;
      this.aiState = 'patrol';
      console.log('[Wraith] Recovered from stun');
    }
  }

  // ------------------------------------------------------------------
  // Movement helpers
  // ------------------------------------------------------------------

  private moveToward(direction: Vector3, speed: number, deltaTime: number): void {
    this.faceDirection(direction, deltaTime);

    const movement = direction.scale(speed * deltaTime);
    this.rootNode.position.addInPlace(movement);
    // Keep on ground
    this.rootNode.position.y = 0.5;
  }

  private faceDirection(direction: Vector3, deltaTime: number): void {
    const targetAngle = Math.atan2(direction.x, direction.z);
    const currentEuler = this.rootNode.rotationQuaternion?.toEulerAngles() ?? Vector3.Zero();
    let currentAngle = currentEuler.y;

    // Shortest angle difference
    let diff = targetAngle - currentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const step = Math.sign(diff) * Math.min(Math.abs(diff), this.stats.turnRate * deltaTime);
    currentAngle += step;

    this.rootNode.rotationQuaternion = Quaternion.RotationYawPitchRoll(currentAngle, 0, 0);
  }

  // ------------------------------------------------------------------
  // Input (when hijacked by player)
  // ------------------------------------------------------------------

  protected processInput(deltaTime: number): void {
    // Only processes when player is in the vehicle
    const moveDir = Vector3.Zero();
    const forward = this.getForward();
    const right = this.getRight();

    if (this.isKeyDown('KeyW')) moveDir.addInPlace(forward);
    if (this.isKeyDown('KeyS')) moveDir.subtractInPlace(forward);
    if (this.isKeyDown('KeyA')) moveDir.subtractInPlace(right);
    if (this.isKeyDown('KeyD')) moveDir.addInPlace(right);

    if (moveDir.length() > 0.01) {
      moveDir.normalize();
      moveDir.y = 0;
      const speed = this.isBoosting ? CHASE_SPEED * BOOST_SPEED_MULT : CHASE_SPEED;
      this.moveToward(moveDir, speed, deltaTime);
    }

    // Boost on shift
    if (this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight')) {
      this.activateBoost();
    }

    // Fire mortar on click
    if (this.isFiring) {
      this.fireMortar();
    }
  }

  // ------------------------------------------------------------------
  // Vehicle update
  // ------------------------------------------------------------------

  protected updateVehicle(deltaTime: number): void {
    this.updateAI(deltaTime);
    this.updateBoost(deltaTime);
    this.updateGlowEffects();
  }

  private updateGlowEffects(): void {
    if (!this.glowMat) return;
    const time = performance.now() * 0.002;
    this.glowMat.alpha = 0.6 + Math.sin(time) * 0.2;

    // Mortar glow pulses when weapon is ready
    if (this.mortarGlowMesh?.material instanceof StandardMaterial) {
      const weapon = this.weapons[0];
      const ready = this.canFireWeapon(weapon);
      this.mortarGlowMesh.material.alpha = ready ? 0.8 + Math.sin(time * 2) * 0.2 : 0.3;
    }
  }

  // ------------------------------------------------------------------
  // Disposal override to clean up GLB instance
  // ------------------------------------------------------------------

  public override dispose(): void {
    if (this.glbNode) {
      this.glbNode.dispose();
      this.glbNode = null;
    }
    super.dispose();
  }
}
