/**
 * GrenadeSystem - Throwable explosives system for Stellar Descent
 *
 * Features:
 * - Three grenade types: Frag, Plasma, EMP
 * - Physics arc trajectory with gravity
 * - Fuse timer and explosion effects
 * - Damage falloff from center
 * - Screen shake for nearby explosions
 * - Integration with combat, player, and HUD systems
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import type { DifficultyLevel } from '../core/DifficultySettings';
import { getLogger } from '../core/Logger';
import { type Entity, getEntitiesInRadius } from '../core/ecs';
import { damageFeedback } from '../effects/DamageFeedback';
import { particleManager } from '../effects/ParticleManager';

const log = getLogger('GrenadeSystem');

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

/**
 * Grenade type enumeration
 */
export type GrenadeType = 'frag' | 'plasma' | 'emp';

/**
 * Configuration for each grenade type
 */
export interface GrenadeConfig {
  /** Base damage at explosion center */
  baseDamage: number;
  /** Damage at explosion edge */
  edgeDamage: number;
  /** Explosion radius in meters */
  radius: number;
  /** Fuse time in seconds */
  fuseTime: number;
  /** Color of the grenade body */
  bodyColor: string;
  /** Color of the grenade indicator light */
  indicatorColor: string;
  /** Special effect type */
  effectType: 'explosive' | 'energy' | 'emp';
  /** Duration of lingering effect (for plasma) in ms */
  lingerDuration?: number;
  /** EMP disable duration in ms */
  disableDuration?: number;
}

/**
 * Active grenade instance
 */
interface ActiveGrenade {
  id: string;
  type: GrenadeType;
  mesh: Mesh;
  indicatorMesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  fuseRemaining: number;
  isExploded: boolean;
  material: StandardMaterial;
  indicatorMaterial: StandardMaterial;
}

/**
 * Lingering plasma zone (damage over time area)
 */
interface PlasmaZone {
  id: string;
  position: Vector3;
  radius: number;
  remainingDuration: number;
  damagePerTick: number;
  mesh: Mesh;
  material: StandardMaterial;
}

/**
 * EMP-disabled enemy tracking
 */
interface EMPDisabledEnemy {
  entityId: string;
  remainingDuration: number;
}

// ============================================================================
// GRENADE CONFIGURATIONS
// ============================================================================

const GRENADE_CONFIGS: Record<GrenadeType, GrenadeConfig> = {
  frag: {
    baseDamage: 100,
    edgeDamage: 20,
    radius: 8,
    fuseTime: 3,
    bodyColor: '#4A5D23', // Military green
    indicatorColor: '#FF4444',
    effectType: 'explosive',
  },
  plasma: {
    baseDamage: 80,
    edgeDamage: 30,
    radius: 6,
    fuseTime: 2.5,
    bodyColor: '#2244AA', // Blue
    indicatorColor: '#44FFFF',
    effectType: 'energy',
    lingerDuration: 4000, // 4 seconds of lingering damage
  },
  emp: {
    baseDamage: 25,
    edgeDamage: 10,
    radius: 10,
    fuseTime: 2,
    bodyColor: '#666666', // Gray
    indicatorColor: '#FFFF44',
    effectType: 'emp',
    disableDuration: 5000, // 5 seconds of attack disable
  },
};

// Physics constants
const GRAVITY = -15; // m/s^2 (slightly less than real gravity for game feel)
const THROW_SPEED = 25; // Initial throw velocity
const THROW_ARC_ANGLE = 0.4; // Radians upward from camera direction
const GRENADE_BOUNCE_FACTOR = 0.3; // Energy retained on bounce
const GROUND_LEVEL = 0.3; // Ground height for collision

// Inventory constants
export const MAX_GRENADES = 4;
const SCREEN_SHAKE_RADIUS = 15; // Distance within which player feels screen shake

/**
 * Default starting grenades per difficulty level
 */
export const DEFAULT_GRENADES_BY_DIFFICULTY: Record<DifficultyLevel, { frag: number; plasma: number; emp: number }> = {
  easy: { frag: 3, plasma: 2, emp: 2 },
  normal: { frag: 2, plasma: 1, emp: 1 },
  hard: { frag: 1, plasma: 1, emp: 0 },
  nightmare: { frag: 1, plasma: 0, emp: 0 },
};

/**
 * Grenade usage statistics for save persistence
 */
export interface GrenadeStats {
  /** Total grenades picked up by type */
  pickedUp: { frag: number; plasma: number; emp: number };
  /** Total grenades used/thrown by type */
  used: { frag: number; plasma: number; emp: number };
}

// ============================================================================
// GRENADE SYSTEM CLASS
// ============================================================================

/**
 * Singleton manager for the grenade/throwable system
 */
export class GrenadeSystem {
  private static instance: GrenadeSystem | null = null;

  private scene: Scene | null = null;
  private activeGrenades: ActiveGrenade[] = [];
  private plasmaZones: PlasmaZone[] = [];
  private empDisabledEnemies: EMPDisabledEnemy[] = [];

  // Inventory
  private inventory: Map<GrenadeType, number> = new Map([
    ['frag', 2],
    ['plasma', 1],
    ['emp', 1],
  ]);
  private selectedType: GrenadeType = 'frag';

  // Stats tracking for save persistence
  private stats: GrenadeStats = {
    pickedUp: { frag: 0, plasma: 0, emp: 0 },
    used: { frag: 0, plasma: 0, emp: 0 },
  };

  // Callbacks
  private onExplosionDamageCallback:
    | ((entity: Entity, damage: number, grenadeType: GrenadeType) => void)
    | null = null;
  private onScreenShakeCallback: ((intensity: number) => void) | null = null;
  private onInventoryChangeCallback: (() => void) | null = null;
  private onGrenadePickupCallback:
    | ((type: GrenadeType, count: number) => void)
    | null = null;

  // Throw animation state
  private isThrowAnimating = false;
  private throwAnimationProgress = 0;
  private cameraOriginalY = 0;

  // Input state
  private throwKeyPressed = false;
  private cycleKeyPressed = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): GrenadeSystem {
    if (!GrenadeSystem.instance) {
      GrenadeSystem.instance = new GrenadeSystem();
    }
    return GrenadeSystem.instance;
  }

  /**
   * Initialize the grenade system
   */
  init(scene: Scene): void {
    this.scene = scene;
    this.setupInputHandlers();
    log.info('Initialized');
  }

  /**
   * Setup keyboard input handlers
   */
  private setupInputHandlers(): void {
    const keydownHandler = (e: KeyboardEvent) => {
      // G key to throw grenade
      if (e.code === 'KeyG' && !this.throwKeyPressed) {
        this.throwKeyPressed = true;
        this.throwGrenade();
      }
      // T key to cycle grenade type
      if (e.code === 'KeyT' && !this.cycleKeyPressed) {
        this.cycleKeyPressed = true;
        this.cycleGrenadeType();
      }
    };

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyG') {
        this.throwKeyPressed = false;
      }
      if (e.code === 'KeyT') {
        this.cycleKeyPressed = false;
      }
    };

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);

    // Store for cleanup
    (this as unknown as { _keydownHandler: (e: KeyboardEvent) => void })._keydownHandler =
      keydownHandler;
    (this as unknown as { _keyupHandler: (e: KeyboardEvent) => void })._keyupHandler = keyupHandler;
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Get current grenade count for a type
   */
  getGrenadeCount(type: GrenadeType): number {
    return this.inventory.get(type) ?? 0;
  }

  /**
   * Get total grenade count across all types
   */
  getTotalGrenadeCount(): number {
    let total = 0;
    for (const count of this.inventory.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Get currently selected grenade type
   */
  getSelectedType(): GrenadeType {
    return this.selectedType;
  }

  /**
   * Get full inventory state
   */
  getInventory(): Map<GrenadeType, number> {
    return new Map(this.inventory);
  }

  /**
   * Add grenades to inventory (from weapon cache pickup)
   * @param type - Type of grenade to add
   * @param count - Number to add
   * @param trackPickup - Whether to track as picked up in stats (default true)
   * @returns Number of grenades actually added
   */
  addGrenades(type: GrenadeType, count: number, trackPickup: boolean = true): number {
    const current = this.inventory.get(type) ?? 0;
    const spaceAvailable = MAX_GRENADES - this.getTotalGrenadeCount();
    const actualAdd = Math.min(count, spaceAvailable);

    if (actualAdd > 0) {
      this.inventory.set(type, current + actualAdd);

      // Track pickup stats
      if (trackPickup) {
        this.stats.pickedUp[type] += actualAdd;
      }

      this.onInventoryChangeCallback?.();
      log.info(`Added ${actualAdd} ${type} grenades`);
    }

    return actualAdd;
  }

  /**
   * Pickup grenades with full notification (sound + callback)
   * Use this when player picks up grenade from world
   */
  pickupGrenade(type: GrenadeType, count: number = 1): number {
    const added = this.addGrenades(type, count, true);

    if (added > 0) {
      // Play pickup sound (using audio_log_pickup as generic pickup sound)
      getAudioManager().play('audio_log_pickup', { volume: 0.5 });

      // Notify listeners (for HUD notification)
      this.onGrenadePickupCallback?.(type, added);

      log.info(`Picked up ${added} ${type} grenade(s)`);
    }

    return added;
  }

  /**
   * Set callback for grenade pickups (for HUD notifications)
   */
  onGrenadePickup(callback: (type: GrenadeType, count: number) => void): void {
    this.onGrenadePickupCallback = callback;
  }

  /**
   * Cycle to next available grenade type
   */
  cycleGrenadeType(): void {
    const types: GrenadeType[] = ['frag', 'plasma', 'emp'];
    const currentIndex = types.indexOf(this.selectedType);

    // Find next type with grenades available
    for (let i = 1; i <= types.length; i++) {
      const nextIndex = (currentIndex + i) % types.length;
      const nextType = types[nextIndex];
      if ((this.inventory.get(nextType) ?? 0) > 0) {
        this.selectedType = nextType;
        this.onInventoryChangeCallback?.();
        getAudioManager().play('ui_click');
        log.info(`Selected ${nextType} grenade`);
        return;
      }
    }
  }

  /**
   * Set callback for inventory changes
   */
  onInventoryChange(callback: () => void): void {
    this.onInventoryChangeCallback = callback;
  }

  // ============================================================================
  // GRENADE THROWING
  // ============================================================================

  /**
   * Throw a grenade from the player's position
   */
  throwGrenade(
    position?: Vector3,
    direction?: Vector3,
    type?: GrenadeType
  ): boolean {
    if (!this.scene) return false;

    const grenadeType = type ?? this.selectedType;
    const count = this.inventory.get(grenadeType) ?? 0;

    if (count <= 0) {
      // No grenades of this type
      getAudioManager().play('weapon_empty_click');
      return false;
    }

    // Get camera for position and direction if not provided
    const camera = this.scene.activeCamera;
    if (!camera && (!position || !direction)) {
      return false;
    }

    const throwPos = position ?? camera!.position.clone();
    const throwDir = direction ?? camera!.getDirection(Vector3.Forward());

    // Consume grenade from inventory
    this.inventory.set(grenadeType, count - 1);

    // Track usage stats
    this.stats.used[grenadeType]++;

    this.onInventoryChangeCallback?.();

    // Start throw animation
    this.startThrowAnimation();

    // Create the grenade
    this.createGrenade(grenadeType, throwPos, throwDir);

    // Play throw sound
    getAudioManager().play('weapon_fire', { volume: 0.4 });

    log.info(`Threw ${grenadeType} grenade`);
    return true;
  }

  /**
   * Start the throw animation (camera dip + arm swing)
   */
  private startThrowAnimation(): void {
    if (!this.scene?.activeCamera) return;

    this.isThrowAnimating = true;
    this.throwAnimationProgress = 0;
    this.cameraOriginalY = this.scene.activeCamera.position.y;
  }

  /**
   * Create a grenade mesh and add to active grenades
   */
  private createGrenade(type: GrenadeType, position: Vector3, direction: Vector3): void {
    if (!this.scene) return;

    const config = GRENADE_CONFIGS[type];
    const id = `grenade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create grenade body (cylinder + sphere top)
    const body = MeshBuilder.CreateCylinder(
      `${id}_body`,
      { height: 0.2, diameter: 0.08, tessellation: 12 },
      this.scene
    );

    const top = MeshBuilder.CreateSphere(
      `${id}_top`,
      { diameter: 0.1, segments: 8 },
      this.scene
    );
    top.position.y = 0.12;
    top.parent = body;

    // Create material for body
    const bodyMat = new StandardMaterial(`${id}_bodyMat`, this.scene);
    bodyMat.diffuseColor = Color3.FromHexString(config.bodyColor);
    bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);
    body.material = bodyMat;

    // Create indicator light mesh
    const indicator = MeshBuilder.CreateSphere(
      `${id}_indicator`,
      { diameter: 0.03, segments: 6 },
      this.scene
    );
    indicator.position.y = 0.18;
    indicator.parent = body;

    const indicatorMat = new StandardMaterial(`${id}_indicatorMat`, this.scene);
    indicatorMat.emissiveColor = Color3.FromHexString(config.indicatorColor);
    indicatorMat.disableLighting = true;
    indicator.material = indicatorMat;

    // Position and orient grenade
    body.position = position.add(direction.scale(0.5)); // Slightly in front of camera

    // Calculate initial velocity with arc
    const throwDirection = direction.clone().normalize();
    // Add upward component for arc
    const upwardVelocity = new Vector3(0, Math.sin(THROW_ARC_ANGLE) * THROW_SPEED, 0);
    const forwardVelocity = throwDirection.scale(Math.cos(THROW_ARC_ANGLE) * THROW_SPEED);
    const initialVelocity = forwardVelocity.add(upwardVelocity);

    // Add slight random spin
    const spinAxis = Vector3.Cross(direction, Vector3.Up()).normalize();
    body.rotationQuaternion = Quaternion.RotationAxis(spinAxis, 0);

    const grenade: ActiveGrenade = {
      id,
      type,
      mesh: body,
      indicatorMesh: indicator,
      position: body.position.clone(),
      velocity: initialVelocity,
      fuseRemaining: config.fuseTime,
      isExploded: false,
      material: bodyMat,
      indicatorMaterial: indicatorMat,
    };

    this.activeGrenades.push(grenade);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update all active grenades and effects
   */
  update(deltaTime: number, playerPosition?: Vector3): void {
    if (!this.scene) return;

    // Update throw animation
    this.updateThrowAnimation(deltaTime);

    // Update active grenades
    this.updateGrenades(deltaTime, playerPosition);

    // Update plasma zones
    this.updatePlasmaZones(deltaTime);

    // Update EMP disabled enemies
    this.updateEMPDisabledEnemies(deltaTime);
  }

  /**
   * Update throw animation (camera dip effect)
   */
  private updateThrowAnimation(deltaTime: number): void {
    if (!this.isThrowAnimating || !this.scene?.activeCamera) return;

    this.throwAnimationProgress += deltaTime * 4; // Animation duration ~0.25s

    if (this.throwAnimationProgress >= 1) {
      // Animation complete
      this.isThrowAnimating = false;
      this.scene.activeCamera.position.y = this.cameraOriginalY;
      return;
    }

    // Camera dip: quick down then back up
    const dipAmount = Math.sin(this.throwAnimationProgress * Math.PI) * 0.15;
    this.scene.activeCamera.position.y = this.cameraOriginalY - dipAmount;
  }

  /**
   * Update all active grenades (physics, fuse, explosion)
   */
  private updateGrenades(deltaTime: number, playerPosition?: Vector3): void {
    const toRemove: string[] = [];

    for (const grenade of this.activeGrenades) {
      if (grenade.isExploded) {
        toRemove.push(grenade.id);
        continue;
      }

      // Apply gravity
      grenade.velocity.y += GRAVITY * deltaTime;

      // Update position
      grenade.position.addInPlace(grenade.velocity.scale(deltaTime));

      // Ground collision check
      if (grenade.position.y <= GROUND_LEVEL) {
        grenade.position.y = GROUND_LEVEL;
        // Bounce with energy loss
        if (Math.abs(grenade.velocity.y) > 1) {
          grenade.velocity.y = -grenade.velocity.y * GRENADE_BOUNCE_FACTOR;
          grenade.velocity.x *= 0.8;
          grenade.velocity.z *= 0.8;
        } else {
          grenade.velocity.y = 0;
          grenade.velocity.x *= 0.9;
          grenade.velocity.z *= 0.9;
        }
      }

      // Update mesh position
      grenade.mesh.position = grenade.position.clone();

      // Add rotation to grenade while in flight
      if (grenade.velocity.length() > 0.5) {
        const rotationSpeed = grenade.velocity.length() * 0.5 * deltaTime;
        if (grenade.mesh.rotationQuaternion) {
          const spinQuat = Quaternion.RotationAxis(Vector3.Right(), rotationSpeed);
          grenade.mesh.rotationQuaternion = spinQuat.multiply(grenade.mesh.rotationQuaternion);
        }
      }

      // Update fuse
      grenade.fuseRemaining -= deltaTime;

      // Blink indicator as fuse runs out
      const blinkRate = Math.max(2, 10 - grenade.fuseRemaining * 3);
      const blinkState = Math.sin(grenade.fuseRemaining * blinkRate * Math.PI * 2) > 0;
      grenade.indicatorMaterial.emissiveColor = blinkState
        ? Color3.FromHexString(GRENADE_CONFIGS[grenade.type].indicatorColor)
        : Color3.Black();

      // Check for explosion
      if (grenade.fuseRemaining <= 0) {
        this.explodeGrenade(grenade, playerPosition);
      }
    }

    // Remove exploded grenades
    this.activeGrenades = this.activeGrenades.filter((g) => !toRemove.includes(g.id));
  }

  /**
   * Explode a grenade
   */
  private explodeGrenade(grenade: ActiveGrenade, playerPosition?: Vector3): void {
    if (!this.scene) return;

    grenade.isExploded = true;
    const config = GRENADE_CONFIGS[grenade.type];
    const position = grenade.position.clone();

    // Play explosion sound
    getAudioManager().play('explosion', { volume: 0.8, position });

    // Create visual explosion based on type
    this.createExplosionEffect(position, grenade.type);

    // Apply damage to entities in radius
    this.applyExplosionDamage(position, config, grenade.type);

    // Screen shake if player is nearby
    if (playerPosition) {
      const distToPlayer = Vector3.Distance(position, playerPosition);
      if (distToPlayer < SCREEN_SHAKE_RADIUS) {
        const shakeIntensity = (1 - distToPlayer / SCREEN_SHAKE_RADIUS) * 8;
        this.onScreenShakeCallback?.(shakeIntensity);
        damageFeedback.triggerScreenShake(config.baseDamage * 0.5, false);
      }
    }

    // Type-specific effects
    if (grenade.type === 'plasma' && config.lingerDuration) {
      this.createPlasmaZone(position, config);
    }

    if (grenade.type === 'emp' && config.disableDuration) {
      this.applyEMPEffect(position, config);
    }

    // Clean up grenade mesh
    grenade.mesh.dispose(false, true);
    grenade.material.dispose();
    grenade.indicatorMaterial.dispose();
  }

  /**
   * Create explosion visual effect
   */
  private createExplosionEffect(position: Vector3, type: GrenadeType): void {
    if (!this.scene) return;

    switch (type) {
      case 'frag':
        // Standard explosion with debris
        particleManager.emitExplosion(position, 1.5);
        particleManager.emitDebris(position, 1.2);
        this.createExplosionFlash(position, '#FF6633', 1.5);
        break;

      case 'plasma':
        // Blue energy explosion
        particleManager.emitExplosion(position, 1.2);
        particleManager.emitEnergyShield(position, undefined, 1.5);
        this.createExplosionFlash(position, '#44FFFF', 1.3);
        break;

      case 'emp':
        // Yellow/white electrical burst
        particleManager.emitCriticalHit(position, 2);
        this.createExplosionFlash(position, '#FFFF88', 2);
        this.createEMPRing(position);
        break;
    }
  }

  /**
   * Create flash sphere for explosion
   */
  private createExplosionFlash(position: Vector3, color: string, scale: number): void {
    if (!this.scene) return;

    const flash = MeshBuilder.CreateSphere('explosionFlash', { diameter: scale * 2 }, this.scene);
    flash.position = position.clone();

    const mat = new StandardMaterial('explosionFlashMat', this.scene);
    mat.emissiveColor = Color3.FromHexString(color);
    mat.disableLighting = true;
    mat.alpha = 0.8;
    flash.material = mat;

    // Animate flash
    const startTime = performance.now();
    const duration = 200;

    const animateFlash = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      flash.scaling.setAll(1 + progress * 2);
      mat.alpha = 0.8 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animateFlash);
      } else {
        flash.dispose();
        mat.dispose();
      }
    };

    requestAnimationFrame(animateFlash);
  }

  /**
   * Create EMP ring effect
   */
  private createEMPRing(position: Vector3): void {
    if (!this.scene) return;

    const ring = MeshBuilder.CreateTorus(
      'empRing',
      { diameter: 2, thickness: 0.1, tessellation: 24 },
      this.scene
    );
    ring.position = position.clone();
    ring.rotation.x = Math.PI / 2;

    const mat = new StandardMaterial('empRingMat', this.scene);
    mat.emissiveColor = Color3.FromHexString('#FFFF44');
    mat.disableLighting = true;
    mat.alpha = 0.6;
    ring.material = mat;

    // Animate ring expanding
    const startTime = performance.now();
    const duration = 500;
    const maxRadius = 10;

    const animateRing = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const scale = 1 + progress * (maxRadius / 2);
      ring.scaling.set(scale, scale, 1);
      mat.alpha = 0.6 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animateRing);
      } else {
        ring.dispose();
        mat.dispose();
      }
    };

    requestAnimationFrame(animateRing);
  }

  /**
   * Apply explosion damage to entities in radius
   */
  private applyExplosionDamage(
    position: Vector3,
    config: GrenadeConfig,
    type: GrenadeType
  ): void {
    const enemies = getEntitiesInRadius(position, config.radius, (e) => e.tags?.enemy === true);

    for (const enemy of enemies) {
      if (!enemy.health || !enemy.transform) continue;

      const distance = Vector3.Distance(position, enemy.transform.position);
      const normalizedDist = distance / config.radius;

      // Calculate damage with falloff (linear interpolation from center to edge)
      const damage = Math.round(
        config.baseDamage - (config.baseDamage - config.edgeDamage) * normalizedDist
      );

      // Apply damage
      enemy.health.current -= damage;

      // Trigger damage feedback
      const hitDirection = enemy.transform.position.subtract(position).normalize();
      if (enemy.renderable?.mesh) {
        damageFeedback.applyDamageFeedback(
          enemy.renderable.mesh as Mesh,
          damage,
          hitDirection,
          damage >= config.baseDamage * 0.8
        );
      }

      // Callback for combat system integration
      this.onExplosionDamageCallback?.(enemy, damage, type);

      log.info(`Explosion dealt ${damage} damage to entity at distance ${distance.toFixed(1)}m`);
    }
  }

  // ============================================================================
  // PLASMA ZONE (LINGERING DAMAGE)
  // ============================================================================

  /**
   * Create a lingering plasma damage zone
   */
  private createPlasmaZone(position: Vector3, config: GrenadeConfig): void {
    if (!this.scene || !config.lingerDuration) return;

    const id = `plasma_zone_${Date.now()}`;

    // Create visual indicator (pulsing disc on ground)
    const disc = MeshBuilder.CreateDisc(`${id}_disc`, { radius: config.radius * 0.8 }, this.scene);
    disc.position = position.clone();
    disc.position.y = 0.1;
    disc.rotation.x = Math.PI / 2;

    const mat = new StandardMaterial(`${id}_mat`, this.scene);
    mat.emissiveColor = Color3.FromHexString('#4488FF');
    mat.disableLighting = true;
    mat.alpha = 0.3;
    disc.material = mat;

    const zone: PlasmaZone = {
      id,
      position: position.clone(),
      radius: config.radius * 0.8,
      remainingDuration: config.lingerDuration,
      damagePerTick: 15, // Damage per second
      mesh: disc,
      material: mat,
    };

    this.plasmaZones.push(zone);
  }

  /**
   * Update plasma zones
   */
  private updatePlasmaZones(deltaTime: number): void {
    const toRemove: string[] = [];

    for (const zone of this.plasmaZones) {
      zone.remainingDuration -= deltaTime * 1000;

      if (zone.remainingDuration <= 0) {
        toRemove.push(zone.id);
        zone.mesh.dispose();
        zone.material.dispose();
        continue;
      }

      // Pulse effect
      const pulse = 0.3 + Math.sin(performance.now() * 0.005) * 0.1;
      zone.material.alpha = pulse;

      // Apply damage to enemies in zone (once per second approximation)
      const enemies = getEntitiesInRadius(zone.position, zone.radius, (e) => e.tags?.enemy === true);
      for (const enemy of enemies) {
        if (enemy.health) {
          const damage = zone.damagePerTick * deltaTime;
          enemy.health.current -= damage;
        }
      }
    }

    this.plasmaZones = this.plasmaZones.filter((z) => !toRemove.includes(z.id));
  }

  // ============================================================================
  // EMP EFFECT
  // ============================================================================

  /**
   * Apply EMP disable effect to enemies
   */
  private applyEMPEffect(position: Vector3, config: GrenadeConfig): void {
    if (!config.disableDuration) return;

    const enemies = getEntitiesInRadius(position, config.radius, (e) => e.tags?.enemy === true);

    for (const enemy of enemies) {
      // Add to disabled list if not already
      const existing = this.empDisabledEnemies.find((e) => e.entityId === enemy.id);
      if (existing) {
        // Refresh duration
        existing.remainingDuration = config.disableDuration;
      } else {
        this.empDisabledEnemies.push({
          entityId: enemy.id,
          remainingDuration: config.disableDuration,
        });
      }

      log.info(`EMP disabled enemy ${enemy.id} for ${config.disableDuration}ms`);
    }
  }

  /**
   * Update EMP disabled enemies
   */
  private updateEMPDisabledEnemies(deltaTime: number): void {
    this.empDisabledEnemies = this.empDisabledEnemies.filter((e) => {
      e.remainingDuration -= deltaTime * 1000;
      return e.remainingDuration > 0;
    });
  }

  /**
   * Check if an enemy is EMP disabled
   */
  isEnemyEMPDisabled(entityId: string): boolean {
    return this.empDisabledEnemies.some((e) => e.entityId === entityId);
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set callback for explosion damage events
   */
  onExplosionDamage(
    callback: (entity: Entity, damage: number, grenadeType: GrenadeType) => void
  ): void {
    this.onExplosionDamageCallback = callback;
  }

  /**
   * Set callback for screen shake
   */
  onScreenShake(callback: (intensity: number) => void): void {
    this.onScreenShakeCallback = callback;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Remove event listeners
    const self = this as unknown as {
      _keydownHandler?: (e: KeyboardEvent) => void;
      _keyupHandler?: (e: KeyboardEvent) => void;
    };
    if (self._keydownHandler) {
      window.removeEventListener('keydown', self._keydownHandler);
    }
    if (self._keyupHandler) {
      window.removeEventListener('keyup', self._keyupHandler);
    }

    // Dispose active grenades
    for (const grenade of this.activeGrenades) {
      grenade.mesh.dispose(false, true);
      grenade.material.dispose();
      grenade.indicatorMaterial.dispose();
    }
    this.activeGrenades = [];

    // Dispose plasma zones
    for (const zone of this.plasmaZones) {
      zone.mesh.dispose();
      zone.material.dispose();
    }
    this.plasmaZones = [];

    // Clear state
    this.empDisabledEnemies = [];
    this.scene = null;
    this.onExplosionDamageCallback = null;
    this.onScreenShakeCallback = null;
    this.onInventoryChangeCallback = null;

    GrenadeSystem.instance = null;

    log.info('Disposed');
  }

  /**
   * Reset inventory to default
   */
  resetInventory(): void {
    this.inventory.set('frag', 2);
    this.inventory.set('plasma', 1);
    this.inventory.set('emp', 1);
    this.selectedType = 'frag';
    this.onInventoryChangeCallback?.();
  }

  /**
   * Reset inventory based on difficulty level
   */
  resetInventoryForDifficulty(difficulty: DifficultyLevel): void {
    const defaults = DEFAULT_GRENADES_BY_DIFFICULTY[difficulty];
    this.inventory.set('frag', defaults.frag);
    this.inventory.set('plasma', defaults.plasma);
    this.inventory.set('emp', defaults.emp);
    this.selectedType = 'frag';
    this.onInventoryChangeCallback?.();
    log.info(`Reset inventory for ${difficulty} difficulty`);
  }

  /**
   * Get grenade usage stats for save persistence
   */
  getStats(): GrenadeStats {
    return {
      pickedUp: { ...this.stats.pickedUp },
      used: { ...this.stats.used },
    };
  }

  /**
   * Set grenade usage stats from loaded save
   */
  setStats(stats: GrenadeStats): void {
    this.stats = {
      pickedUp: { ...stats.pickedUp },
      used: { ...stats.used },
    };
  }

  /**
   * Reset stats (for new game)
   */
  resetStats(): void {
    this.stats = {
      pickedUp: { frag: 0, plasma: 0, emp: 0 },
      used: { frag: 0, plasma: 0, emp: 0 },
    };
  }

  /**
   * Set inventory from save data
   */
  setInventory(grenades: { frag: number; plasma: number; emp: number }): void {
    this.inventory.set('frag', grenades.frag);
    this.inventory.set('plasma', grenades.plasma);
    this.inventory.set('emp', grenades.emp);

    // Select first available type
    if (grenades.frag > 0) {
      this.selectedType = 'frag';
    } else if (grenades.plasma > 0) {
      this.selectedType = 'plasma';
    } else if (grenades.emp > 0) {
      this.selectedType = 'emp';
    }

    this.onInventoryChangeCallback?.();
    log.info('Inventory restored from save');
  }

  /**
   * Get inventory as object (for save system)
   */
  getInventoryObject(): { frag: number; plasma: number; emp: number } {
    return {
      frag: this.inventory.get('frag') ?? 0,
      plasma: this.inventory.get('plasma') ?? 0,
      emp: this.inventory.get('emp') ?? 0,
    };
  }
}

// Export singleton accessor
export const grenadeSystem = GrenadeSystem.getInstance();
