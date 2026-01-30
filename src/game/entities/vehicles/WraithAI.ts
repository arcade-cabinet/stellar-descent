/**
 * WraithAI - Alien hover tank enemy vehicle AI.
 *
 * The Wraith is the primary Covenant-style enemy vehicle in Stellar Descent.
 * It appears in vehicle levels and open combat areas, acting as a mini-boss
 * threat that requires tactical engagement.
 *
 * States:
 *   Patrol   - Follows a waypoint loop, scanning for the player.
 *   Alert    - Player detected; rotates turret to face them.
 *   Combat   - Fires mortar at predicted player position; strafes laterally.
 *   Pursuit  - Chases player if they retreat beyond combat range.
 *   Damaged  - Health below 50%: reduced speed and accuracy.
 *
 * Weapons:
 *   Primary  - Plasma mortar (arcing AOE, 2s charge, 1.5s flight).
 *   Secondary- Plasma turret (rapid, low-damage anti-infantry).
 *
 * Weak Point:
 *   Rear armor takes 2x damage.
 *
 * Hijack:
 *   Below 25% health, player can board from the rear (interact hold).
 *
 * Visuals:
 *   Purple/blue hover tank built from BabylonJS primitives.
 *   Hover bobbing animation and engine glow particle emitter.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import {
  type DifficultyLevel,
  loadDifficultySetting,
  scaleDetectionRange,
  scaleEnemyFireRate,
  scaleEnemyHealth,
} from '../../core/DifficultySettings';
import { createEntity, type Entity, removeEntity } from '../../core/ecs';
import { getAudioManager } from '../../core/AudioManager';
import {
  launchMortar,
  updateMortar,
  predictTargetPosition,
  MORTAR_CHARGE_TIME,
  MORTAR_FLIGHT_TIME,
  type MortarProjectile,
} from './WraithMortar';

// ----------------------------------------------------------------------------
// Wraith Configuration
// ----------------------------------------------------------------------------

export interface WraithConfig {
  /** Base health (before difficulty scaling) */
  baseHealth: number;
  /** Movement speed (units/second) */
  moveSpeed: number;
  /** Rotation speed (radians/second) */
  turnSpeed: number;
  /** Detection radius for entering alert state */
  alertRadius: number;
  /** Maximum combat engagement range */
  combatRange: number;
  /** Minimum distance to maintain in combat (strafing orbit) */
  combatMinRange: number;
  /** Distance at which pursuit is triggered (player fled beyond this) */
  pursuitThreshold: number;
  /** Mortar fire rate (shots per minute) */
  mortarFireRate: number;
  /** Plasma turret fire rate (shots per second) */
  turretFireRate: number;
  /** Plasma turret damage per shot */
  turretDamage: number;
  /** Plasma turret range */
  turretRange: number;
  /** Plasma turret projectile speed */
  turretProjectileSpeed: number;
  /** XP awarded on destruction */
  xpValue: number;
  /** Health percentage at which hijack becomes available */
  hijackThreshold: number;
  /** Rear armor damage multiplier */
  rearDamageMultiplier: number;
  /** Health percentage at which Damaged state triggers */
  damagedThreshold: number;
  /** Speed multiplier when in Damaged state */
  damagedSpeedMultiplier: number;
  /** Accuracy penalty (scatter radius) when in Damaged state */
  damagedInaccuracy: number;
}

export const DEFAULT_WRAITH_CONFIG: WraithConfig = {
  baseHealth: 500,
  moveSpeed: 12,
  turnSpeed: 1.2,
  alertRadius: 80,
  combatRange: 60,
  combatMinRange: 20,
  pursuitThreshold: 90,
  mortarFireRate: 8, // 8 per minute = one every 7.5s
  turretFireRate: 4,
  turretDamage: 8,
  turretRange: 35,
  turretProjectileSpeed: 40,
  xpValue: 300,
  hijackThreshold: 0.25,
  rearDamageMultiplier: 2.0,
  damagedThreshold: 0.5,
  damagedSpeedMultiplier: 0.6,
  damagedInaccuracy: 5.0,
};

// ----------------------------------------------------------------------------
// AI State
// ----------------------------------------------------------------------------

export type WraithState = 'patrol' | 'alert' | 'combat' | 'pursuit' | 'damaged' | 'destroyed';

export interface WraithWaypoint {
  position: Vector3;
  /** Optional pause time at this waypoint (seconds) */
  pauseTime?: number;
}

// ----------------------------------------------------------------------------
// Wraith Class
// ----------------------------------------------------------------------------

export class WraithAI {
  // Identity
  readonly id: string;

  // Config
  private config: WraithConfig;
  private difficulty: DifficultyLevel;

  // ECS
  public entity: Entity;

  // Visual
  private scene: Scene;
  private root: TransformNode;
  private bodyMesh: Mesh;
  private turretNode: TransformNode;
  private mortarMesh: Mesh;
  private engineGlow: ParticleSystem | null = null;
  private engineLight: PointLight | null = null;

  // State machine
  private _state: WraithState = 'patrol';
  private stateTimer: number = 0;

  // Patrol
  private waypoints: WraithWaypoint[] = [];
  private currentWaypointIndex: number = 0;
  private waypointPauseTimer: number = 0;

  // Combat
  private mortarChargeTimer: number = 0;
  private mortarCooldownTimer: number = 0;
  private turretCooldownTimer: number = 0;
  private activeMortars: MortarProjectile[] = [];
  private strafeDirection: number = 1; // 1 = right, -1 = left
  private strafeSwitchTimer: number = 0;

  // Animation
  private hoverTime: number = 0;
  private readonly hoverAmplitude: number = 0.3;
  private readonly hoverFrequency: number = 1.5;
  private baseY: number = 2.0; // Hover height above ground

  // Hijack
  private _isHijackable: boolean = false;
  private _isHijacked: boolean = false;

  // Tracking
  private facingAngle: number = 0;
  private turretAngle: number = 0;

  // Screen shake callback (set by the level/manager)
  public onScreenShake: ((intensity: number) => void) | null = null;

  // Destruction callback
  public onDestroyed: ((wraith: WraithAI) => void) | null = null;

  constructor(
    scene: Scene,
    position: Vector3,
    waypoints: WraithWaypoint[] = [],
    config: Partial<WraithConfig> = {},
    difficulty?: DifficultyLevel
  ) {
    this.id = `wraith_${crypto.randomUUID().slice(0, 8)}`;
    this.scene = scene;
    this.config = { ...DEFAULT_WRAITH_CONFIG, ...config };
    this.difficulty = difficulty ?? loadDifficultySetting();
    this.waypoints = waypoints.length > 0 ? waypoints : [{ position: position.clone() }];
    this.baseY = position.y > 0 ? position.y : 2.0;

    // Build mesh hierarchy
    const { root, body, turretNode, mortar } = this.createMesh(scene, position);
    this.root = root;
    this.bodyMesh = body;
    this.turretNode = turretNode;
    this.mortarMesh = mortar;

    // Engine glow particles
    this.createEngineEffects(scene);

    // Create ECS entity
    this.entity = this.createEntity(position);

    // Initial facing toward first waypoint
    if (this.waypoints.length > 1) {
      const dir = this.waypoints[1].position.subtract(position);
      this.facingAngle = Math.atan2(dir.x, dir.z);
    }
  }

  // --------------------------------------------------------------------------
  // Public Accessors
  // --------------------------------------------------------------------------

  get state(): WraithState {
    return this._state;
  }

  get position(): Vector3 {
    return this.root.position.clone();
  }

  get isHijackable(): boolean {
    return this._isHijackable;
  }

  get isHijacked(): boolean {
    return this._isHijacked;
  }

  get isDestroyed(): boolean {
    return this._state === 'destroyed';
  }

  get healthPercent(): number {
    if (!this.entity.health) return 0;
    return this.entity.health.current / this.entity.health.max;
  }

  /** World-space position of the rear armor zone (for hijack and weak point) */
  get rearPosition(): Vector3 {
    const behind = new Vector3(
      -Math.sin(this.facingAngle) * 4,
      0,
      -Math.cos(this.facingAngle) * 4
    );
    return this.root.position.add(behind);
  }

  // --------------------------------------------------------------------------
  // Damage
  // --------------------------------------------------------------------------

  /**
   * Apply damage to the Wraith.
   *
   * @param amount    - Base damage amount
   * @param hitPos    - World position of the hit (to check rear armor)
   * @returns The actual damage dealt (after weak-point multiplier)
   */
  applyDamage(amount: number, hitPos?: Vector3): number {
    if (this._state === 'destroyed' || !this.entity.health) return 0;

    let finalDamage = amount;

    // Check for rear armor hit (2x multiplier)
    if (hitPos) {
      const toHit = hitPos.subtract(this.root.position).normalize();
      const facing = new Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
      const dot = Vector3.Dot(toHit, facing);
      // dot < -0.5 means hit came from behind
      if (dot < -0.5) {
        finalDamage = Math.round(amount * this.config.rearDamageMultiplier);
      }
    }

    this.entity.health.current = Math.max(0, this.entity.health.current - finalDamage);

    // Flash body material red briefly
    this.flashDamage();

    // Check destruction
    if (this.entity.health.current <= 0) {
      this.destroy();
    }

    return finalDamage;
  }

  // --------------------------------------------------------------------------
  // Hijack
  // --------------------------------------------------------------------------

  /**
   * Attempt to hijack the Wraith.
   * Only succeeds if the Wraith is hijackable (below 25% health).
   */
  tryHijack(): boolean {
    if (!this._isHijackable || this._isHijacked || this._state === 'destroyed') return false;

    this._isHijacked = true;
    this._state = 'destroyed'; // Stops AI updates
    console.log(`[WraithAI] ${this.id} hijacked by player`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Update Loop
  // --------------------------------------------------------------------------

  /**
   * Main update tick. Call every frame.
   *
   * @param deltaTime     - Frame delta in seconds
   * @param playerPos     - Current player world position
   * @param playerVelocity- Current player velocity (for mortar prediction)
   */
  update(
    deltaTime: number,
    playerPos: Vector3 | null,
    playerVelocity: Vector3 = Vector3.Zero()
  ): void {
    if (this._state === 'destroyed') return;

    // Hover animation
    this.updateHover(deltaTime);

    // Update active mortar projectiles
    this.updateMortars(deltaTime);

    // State timer
    this.stateTimer += deltaTime;

    // Calculate distance to player
    const distToPlayer = playerPos
      ? Vector3.Distance(this.root.position, playerPos)
      : Infinity;

    // Check hijack eligibility
    this._isHijackable =
      this.healthPercent > 0 &&
      this.healthPercent <= this.config.hijackThreshold;

    // Determine effective speed
    const isDamaged = this.healthPercent <= this.config.damagedThreshold && this.healthPercent > 0;
    const effectiveSpeed = isDamaged
      ? this.config.moveSpeed * this.config.damagedSpeedMultiplier
      : this.config.moveSpeed;

    // Scale detection/combat ranges by difficulty
    const alertRadius = scaleDetectionRange(this.config.alertRadius, this.difficulty);
    const combatRange = this.config.combatRange;
    const pursuitThreshold = this.config.pursuitThreshold;

    // State machine transitions
    switch (this._state) {
      case 'patrol':
        if (playerPos && distToPlayer < alertRadius) {
          this.transitionTo('alert');
        } else {
          this.updatePatrol(deltaTime, effectiveSpeed);
        }
        break;

      case 'alert':
        if (!playerPos || distToPlayer > alertRadius * 1.2) {
          this.transitionTo('patrol');
        } else if (distToPlayer <= combatRange) {
          this.transitionTo('combat');
        } else {
          this.updateAlert(deltaTime, playerPos);
        }
        break;

      case 'combat':
        if (!playerPos || distToPlayer > pursuitThreshold) {
          this.transitionTo('pursuit');
        } else if (distToPlayer > combatRange * 1.3) {
          this.transitionTo('pursuit');
        } else {
          this.updateCombat(deltaTime, playerPos, playerVelocity, effectiveSpeed, isDamaged);
        }
        break;

      case 'pursuit':
        if (!playerPos || distToPlayer > pursuitThreshold * 1.5) {
          this.transitionTo('patrol');
        } else if (distToPlayer <= combatRange) {
          this.transitionTo('combat');
        } else {
          this.updatePursuit(deltaTime, playerPos, effectiveSpeed);
        }
        break;

      case 'damaged':
        // Damaged is not a separate state branch; damage modifiers are
        // applied in combat/pursuit via isDamaged flag. This state exists
        // if we want a stagger/pause when first hitting the threshold.
        if (playerPos && distToPlayer <= combatRange) {
          this.transitionTo('combat');
        } else if (playerPos && distToPlayer <= alertRadius) {
          this.transitionTo('alert');
        } else {
          this.transitionTo('patrol');
        }
        break;
    }

    // Sync ECS entity transform
    this.syncEntityTransform();
  }

  // --------------------------------------------------------------------------
  // State Updates
  // --------------------------------------------------------------------------

  private transitionTo(newState: WraithState): void {
    if (newState === this._state) return;
    const prev = this._state;
    this._state = newState;
    this.stateTimer = 0;

    console.log(`[WraithAI] ${this.id}: ${prev} -> ${newState}`);

    // Reset combat timers on entering combat
    if (newState === 'combat') {
      this.mortarChargeTimer = 0;
      this.mortarCooldownTimer = 0;
      this.strafeDirection = Math.random() > 0.5 ? 1 : -1;
      this.strafeSwitchTimer = 3 + Math.random() * 2;
    }
  }

  private updatePatrol(deltaTime: number, speed: number): void {
    if (this.waypoints.length === 0) return;

    const target = this.waypoints[this.currentWaypointIndex];

    // Check if paused at waypoint
    if (this.waypointPauseTimer > 0) {
      this.waypointPauseTimer -= deltaTime;
      return;
    }

    // Move toward waypoint
    const toTarget = target.position.subtract(this.root.position);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < 2.0) {
      // Arrived at waypoint
      if (target.pauseTime) {
        this.waypointPauseTimer = target.pauseTime;
      }
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      return;
    }

    // Rotate toward waypoint
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);
    this.facingAngle = this.lerpAngle(this.facingAngle, targetAngle, this.config.turnSpeed * deltaTime);
    this.root.rotation.y = this.facingAngle;

    // Move forward
    const forward = new Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    this.root.position.addInPlace(forward.scale(speed * deltaTime));
  }

  private updateAlert(deltaTime: number, playerPos: Vector3): void {
    // Rotate body to face player
    const toPlayer = playerPos.subtract(this.root.position);
    toPlayer.y = 0;
    const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);

    this.facingAngle = this.lerpAngle(
      this.facingAngle,
      targetAngle,
      this.config.turnSpeed * 1.5 * deltaTime
    );
    this.root.rotation.y = this.facingAngle;

    // Also rotate turret
    this.turretAngle = this.lerpAngle(
      this.turretAngle,
      targetAngle,
      this.config.turnSpeed * 2.0 * deltaTime
    );
    this.turretNode.rotation.y = this.turretAngle - this.facingAngle;
  }

  private updateCombat(
    deltaTime: number,
    playerPos: Vector3,
    playerVelocity: Vector3,
    speed: number,
    isDamaged: boolean
  ): void {
    const toPlayer = playerPos.subtract(this.root.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Face player (body)
    const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
    this.facingAngle = this.lerpAngle(
      this.facingAngle,
      targetAngle,
      this.config.turnSpeed * deltaTime
    );
    this.root.rotation.y = this.facingAngle;

    // Turret tracks player independently (faster)
    this.turretAngle = this.lerpAngle(
      this.turretAngle,
      targetAngle,
      this.config.turnSpeed * 2.5 * deltaTime
    );
    this.turretNode.rotation.y = this.turretAngle - this.facingAngle;

    // --- Strafing movement ---
    this.strafeSwitchTimer -= deltaTime;
    if (this.strafeSwitchTimer <= 0) {
      this.strafeDirection *= -1;
      this.strafeSwitchTimer = 3 + Math.random() * 3;
    }

    // Maintain orbit distance
    const desiredDist = (this.config.combatMinRange + this.config.combatRange) * 0.5;
    const approachSpeed = (dist - desiredDist) * 0.3;
    const forwardDir = toPlayer.normalize();
    const strafeDir = new Vector3(-forwardDir.z, 0, forwardDir.x).scale(this.strafeDirection);

    const movement = forwardDir
      .scale(approachSpeed * deltaTime)
      .add(strafeDir.scale(speed * 0.5 * deltaTime));
    this.root.position.addInPlace(movement);

    // --- Mortar weapon ---
    const mortarCooldown = 60 / scaleEnemyFireRate(this.config.mortarFireRate, this.difficulty);
    this.mortarCooldownTimer -= deltaTime;

    if (this.mortarCooldownTimer <= 0 && this.mortarChargeTimer <= 0) {
      // Start charging
      this.mortarChargeTimer = MORTAR_CHARGE_TIME;
    }

    if (this.mortarChargeTimer > 0) {
      this.mortarChargeTimer -= deltaTime;

      if (this.mortarChargeTimer <= 0) {
        // Fire mortar
        const inaccuracy = isDamaged ? this.config.damagedInaccuracy : 2.0;
        const predictedPos = predictTargetPosition(
          playerPos,
          playerVelocity,
          MORTAR_FLIGHT_TIME,
          inaccuracy
        );

        const launchPos = this.mortarMesh.getAbsolutePosition();
        const mortar = launchMortar(this.scene, launchPos, predictedPos, MORTAR_FLIGHT_TIME);
        this.activeMortars.push(mortar);

        this.mortarCooldownTimer = mortarCooldown;

        try {
          getAudioManager().play('explosion', { volume: 0.2 });
        } catch {
          // Audio not available
        }
      }
    }

    // --- Secondary plasma turret ---
    this.turretCooldownTimer -= deltaTime;
    const turretRange = this.config.turretRange;

    if (this.turretCooldownTimer <= 0 && dist <= turretRange) {
      this.firePlasmaTurret(playerPos);
      this.turretCooldownTimer = 1.0 / scaleEnemyFireRate(this.config.turretFireRate, this.difficulty);
    }
  }

  private updatePursuit(deltaTime: number, playerPos: Vector3, speed: number): void {
    const toPlayer = playerPos.subtract(this.root.position);
    toPlayer.y = 0;

    // Rotate toward player
    const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
    this.facingAngle = this.lerpAngle(
      this.facingAngle,
      targetAngle,
      this.config.turnSpeed * deltaTime
    );
    this.root.rotation.y = this.facingAngle;
    this.turretNode.rotation.y = this.turretAngle - this.facingAngle;

    // Move toward player at full speed
    const forward = new Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    this.root.position.addInPlace(forward.scale(speed * deltaTime));
  }

  // --------------------------------------------------------------------------
  // Weapons
  // --------------------------------------------------------------------------

  private firePlasmaTurret(targetPos: Vector3): void {
    const spawnPos = this.turretNode.getAbsolutePosition();
    const direction = targetPos.subtract(spawnPos).normalize();

    // Add small scatter for imperfect aim
    direction.x += (Math.random() - 0.5) * 0.1;
    direction.z += (Math.random() - 0.5) * 0.1;
    direction.normalize();

    // Create plasma bolt mesh
    const bolt = MeshBuilder.CreateCylinder(
      'wraith_turret_bolt',
      { height: 0.6, diameterTop: 0.08, diameterBottom: 0.05, tessellation: 6 },
      this.scene
    );
    bolt.position = spawnPos.clone();

    // Orient toward target
    const up = Vector3.Up();
    const rotAxis = Vector3.Cross(up, direction).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, direction))));
    if (rotAxis.length() > 0.001) {
      bolt.rotationQuaternion = Quaternion.RotationAxis(rotAxis, angle);
    }

    const boltMat = new StandardMaterial('wraith_boltMat', this.scene);
    boltMat.emissiveColor = Color3.FromHexString('#6644FF');
    boltMat.disableLighting = true;
    bolt.material = boltMat;

    // Outer glow
    const glowShell = MeshBuilder.CreateCylinder(
      'wraith_boltGlow',
      { height: 0.8, diameterTop: 0.18, diameterBottom: 0.12, tessellation: 6 },
      this.scene
    );
    glowShell.parent = bolt;
    glowShell.position = Vector3.Zero();

    const glowMat = new StandardMaterial('wraith_boltGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#4422CC');
    glowMat.disableLighting = true;
    glowMat.alpha = 0.3;
    glowShell.material = glowMat;

    bolt.onDisposeObservable.add(() => {
      boltMat.dispose();
      glowMat.dispose();
    });

    const velocity = direction.scale(this.config.turretProjectileSpeed);

    createEntity({
      transform: {
        position: spawnPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: this.config.turretProjectileSpeed,
      },
      combat: {
        damage: this.config.turretDamage,
        range: this.config.turretRange,
        fireRate: this.config.turretFireRate,
        lastFire: performance.now(),
        projectileSpeed: this.config.turretProjectileSpeed,
      },
      renderable: {
        mesh: bolt,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          bolt.dispose();
        },
      },
    });
  }

  // --------------------------------------------------------------------------
  // Mortar Management
  // --------------------------------------------------------------------------

  private updateMortars(deltaTime: number): void {
    const playerPos = this.entity.transform?.position ?? null;

    this.activeMortars = this.activeMortars.filter((mortar) => {
      const done = updateMortar(
        mortar,
        deltaTime,
        this.scene,
        playerPos,
        this.onScreenShake ?? undefined
      );
      return !done;
    });
  }

  // --------------------------------------------------------------------------
  // Mesh Construction
  // --------------------------------------------------------------------------

  private createMesh(
    scene: Scene,
    position: Vector3
  ): { root: TransformNode; body: Mesh; turretNode: TransformNode; mortar: Mesh } {
    const root = new TransformNode(`wraith_${this.id}`, scene);
    root.position = position.clone();

    // Color palette
    const hullMat = new StandardMaterial('wraith_hullMat', scene);
    hullMat.diffuseColor = Color3.FromHexString('#2A1845');
    hullMat.specularColor = new Color3(0.25, 0.2, 0.35);

    const armorMat = new StandardMaterial('wraith_armorMat', scene);
    armorMat.diffuseColor = Color3.FromHexString('#3D2660');
    armorMat.specularColor = new Color3(0.3, 0.25, 0.4);

    const glowMat = new StandardMaterial('wraith_glowMat', scene);
    glowMat.emissiveColor = Color3.FromHexString('#5588FF');
    glowMat.disableLighting = true;

    const accentMat = new StandardMaterial('wraith_accentMat', scene);
    accentMat.diffuseColor = Color3.FromHexString('#1A0E30');
    accentMat.specularColor = new Color3(0.15, 0.1, 0.25);

    // --- Main body (flattened box) ---
    const body = MeshBuilder.CreateBox(
      'wraith_body',
      { width: 5, height: 1.2, depth: 7 },
      scene
    );
    body.material = hullMat;
    body.parent = root;
    body.position.y = 0;

    // --- Side armor plates ---
    for (let side = -1; side <= 1; side += 2) {
      const plate = MeshBuilder.CreateBox(
        'wraith_sideArmor',
        { width: 0.6, height: 0.8, depth: 5.5 },
        scene
      );
      plate.material = armorMat;
      plate.parent = root;
      plate.position.set(side * 2.8, 0.2, -0.3);
    }

    // --- Front wedge (tapered nose) ---
    const nose = MeshBuilder.CreateBox(
      'wraith_nose',
      { width: 3.5, height: 0.9, depth: 2.5 },
      scene
    );
    nose.material = armorMat;
    nose.parent = root;
    nose.position.set(0, 0.1, 4.2);
    nose.scaling.set(1, 1, 1);

    // --- Rear engine block ---
    const engineBlock = MeshBuilder.CreateBox(
      'wraith_engine',
      { width: 4, height: 1.0, depth: 1.5 },
      scene
    );
    engineBlock.material = accentMat;
    engineBlock.parent = root;
    engineBlock.position.set(0, -0.1, -3.8);

    // Engine glow strips
    for (let i = -1; i <= 1; i += 2) {
      const strip = MeshBuilder.CreateBox(
        'wraith_engineStrip',
        { width: 0.4, height: 0.3, depth: 1.2 },
        scene
      );
      strip.material = glowMat;
      strip.parent = root;
      strip.position.set(i * 1.2, -0.3, -3.8);
    }

    // --- Undercarriage hover emitters (4 glowing discs) ---
    const emitterPositions = [
      new Vector3(-1.5, -0.7, 2),
      new Vector3(1.5, -0.7, 2),
      new Vector3(-1.5, -0.7, -2),
      new Vector3(1.5, -0.7, -2),
    ];
    for (const pos of emitterPositions) {
      const emitter = MeshBuilder.CreateCylinder(
        'wraith_hoverEmitter',
        { height: 0.1, diameter: 1.0, tessellation: 12 },
        scene
      );
      emitter.material = glowMat;
      emitter.parent = root;
      emitter.position = pos;
    }

    // --- Turret assembly ---
    const turretNode = new TransformNode('wraith_turretNode', scene);
    turretNode.parent = root;
    turretNode.position.set(0, 0.9, -0.5);

    // Turret base (sphere)
    const turretBase = MeshBuilder.CreateSphere(
      'wraith_turretBase',
      { diameterX: 2.5, diameterY: 1.5, diameterZ: 2.5, segments: 10 },
      scene
    );
    turretBase.material = armorMat;
    turretBase.parent = turretNode;

    // Turret ring (glow accent)
    const turretRing = MeshBuilder.CreateTorus(
      'wraith_turretRing',
      { diameter: 2.2, thickness: 0.12, tessellation: 16 },
      scene
    );
    turretRing.material = glowMat;
    turretRing.parent = turretNode;
    turretRing.position.y = -0.2;
    turretRing.rotation.x = Math.PI / 2;

    // --- Mortar barrel (cylinder extending forward from turret) ---
    const mortar = MeshBuilder.CreateCylinder(
      'wraith_mortar',
      { height: 3.0, diameterTop: 0.5, diameterBottom: 0.7, tessellation: 10 },
      scene
    );
    mortar.material = hullMat;
    mortar.parent = turretNode;
    mortar.rotation.x = -Math.PI / 2; // Point forward
    mortar.position.set(0, 0.3, 2.0);

    // Mortar muzzle glow
    const muzzleGlow = MeshBuilder.CreateSphere(
      'wraith_mortarGlow',
      { diameter: 0.6, segments: 8 },
      scene
    );
    muzzleGlow.material = glowMat;
    muzzleGlow.parent = mortar;
    muzzleGlow.position.set(0, 1.5, 0); // Tip of the barrel (rotated)

    return { root, body, turretNode, mortar };
  }

  private createEngineEffects(scene: Scene): void {
    try {
      // Engine glow light
      this.engineLight = new PointLight('wraith_engineLight', new Vector3(0, -0.5, -3.5), scene);
      this.engineLight.parent = this.root;
      this.engineLight.intensity = 2.0;
      this.engineLight.diffuse = Color3.FromHexString('#5588FF');
      this.engineLight.range = 8;

      // Engine particle system
      this.engineGlow = new ParticleSystem('wraith_engineGlow', 60, scene);
      this.engineGlow.emitter = this.bodyMesh;
      this.engineGlow.minEmitBox = new Vector3(-1.5, -0.8, -4.0);
      this.engineGlow.maxEmitBox = new Vector3(1.5, -0.4, -3.5);
      this.engineGlow.minSize = 0.2;
      this.engineGlow.maxSize = 0.6;
      this.engineGlow.minLifeTime = 0.2;
      this.engineGlow.maxLifeTime = 0.5;
      this.engineGlow.emitRate = 40;
      this.engineGlow.color1 = new Color4(0.3, 0.5, 1.0, 0.8);
      this.engineGlow.color2 = new Color4(0.2, 0.3, 0.8, 0.6);
      this.engineGlow.colorDead = new Color4(0.1, 0.1, 0.3, 0.0);
      this.engineGlow.minEmitPower = 1;
      this.engineGlow.maxEmitPower = 3;
      this.engineGlow.direction1 = new Vector3(-0.3, -1.5, -0.5);
      this.engineGlow.direction2 = new Vector3(0.3, -0.5, 0.5);
      this.engineGlow.gravity = new Vector3(0, -2, 0);
      this.engineGlow.start();
    } catch {
      console.warn('[WraithAI] Could not create engine particle effects');
    }
  }

  // --------------------------------------------------------------------------
  // Animation
  // --------------------------------------------------------------------------

  private updateHover(deltaTime: number): void {
    this.hoverTime += deltaTime;
    const bob = Math.sin(this.hoverTime * this.hoverFrequency * Math.PI * 2) * this.hoverAmplitude;
    this.root.position.y = this.baseY + bob;

    // Slight roll based on strafing
    if (this._state === 'combat') {
      const targetRoll = this.strafeDirection * 0.05;
      this.root.rotation.z = this.root.rotation.z + (targetRoll - this.root.rotation.z) * 2 * deltaTime;
    } else {
      this.root.rotation.z *= 1 - 3 * deltaTime; // Dampen roll
    }
  }

  // --------------------------------------------------------------------------
  // Damage Feedback
  // --------------------------------------------------------------------------

  private flashDamage(): void {
    const mat = this.bodyMesh.material as StandardMaterial | null;
    if (!mat) return;

    const originalColor = mat.diffuseColor.clone();
    mat.emissiveColor = Color3.FromHexString('#FF2222');

    window.setTimeout(() => {
      try {
        mat.emissiveColor = Color3.Black();
      } catch {
        // Material already disposed
      }
    }, 120);
  }

  // --------------------------------------------------------------------------
  // Destruction
  // --------------------------------------------------------------------------

  private destroy(): void {
    if (this._state === 'destroyed') return;
    this._state = 'destroyed';

    console.log(`[WraithAI] ${this.id} destroyed`);

    // Stop engine effects
    this.engineGlow?.stop();
    this.engineLight?.dispose();

    // Stop active mortars
    for (const mortar of this.activeMortars) {
      if (!mortar.detonated) {
        mortar.root.dispose();
        mortar.trailParticles?.dispose();
        removeEntity(mortar.entity);
      }
    }
    this.activeMortars = [];

    // Destruction callback
    if (this.onDestroyed) {
      this.onDestroyed(this);
    }
  }

  // --------------------------------------------------------------------------
  // ECS
  // --------------------------------------------------------------------------

  private createEntity(position: Vector3): Entity {
    const scaledHealth = scaleEnemyHealth(this.config.baseHealth, this.difficulty);

    return createEntity({
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
      velocity: {
        linear: Vector3.Zero(),
        angular: Vector3.Zero(),
        maxSpeed: this.config.moveSpeed,
      },
      combat: {
        damage: this.config.turretDamage,
        range: this.config.combatRange,
        fireRate: this.config.turretFireRate,
        lastFire: 0,
        projectileSpeed: this.config.turretProjectileSpeed,
      },
      renderable: {
        mesh: this.root,
        visible: true,
      },
      tags: {
        enemy: true,
        mechanical: true,
      },
      alienInfo: {
        speciesId: 'wraith_vehicle',
        seed: Date.now(),
        xpValue: this.config.xpValue,
        lootTable: [
          { itemId: 'plasma_core', dropChance: 1.0, minQuantity: 1, maxQuantity: 1 },
          { itemId: 'alien_alloy', dropChance: 0.6, minQuantity: 2, maxQuantity: 5 },
          { itemId: 'energy_cell', dropChance: 0.4, minQuantity: 1, maxQuantity: 3 },
        ],
      },
    });
  }

  private syncEntityTransform(): void {
    if (this.entity.transform) {
      this.entity.transform.position.copyFrom(this.root.position);
      this.entity.transform.rotation.y = this.facingAngle;
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private lerpAngle(current: number, target: number, maxDelta: number): number {
    let diff = target - current;
    // Normalise to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) < maxDelta) return target;
    return current + Math.sign(diff) * maxDelta;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this._state = 'destroyed';

    // Stop particles
    this.engineGlow?.dispose();
    this.engineLight?.dispose();

    // Dispose active mortars
    for (const mortar of this.activeMortars) {
      mortar.root.dispose();
      mortar.trailParticles?.dispose();
      removeEntity(mortar.entity);
    }
    this.activeMortars = [];

    // Dispose mesh hierarchy (root disposes children)
    this.root.dispose();

    // Remove ECS entity
    removeEntity(this.entity);
  }
}
