/**
 * MeleeSystem - Close-quarters melee combat system
 *
 * Provides a satisfying melee attack for emergency close-range encounters:
 * - Triggered by V key or right mouse button tap
 * - 2 meter attack reach from player
 * - 100 base damage (kills Skitterers in 1-2 hits)
 * - 0.8 second cooldown between attacks
 * - Camera punch forward + weapon lunge animation
 * - Cone-based hit detection (45 degree arc)
 * - Screen shake on successful hit
 * - Swing whoosh + impact thud sound effects
 * - Knockback pushes enemies away
 * - 2.0x headshot/critical multiplier
 *
 * Enemy-specific damage multipliers:
 * - Skitterer: 1.5x (dies in 1-2 hits)
 * - Light enemies: 1.2-1.3x
 * - Standard enemies: 1.0x
 * - Heavy enemies: 0.8x (3-4 hits)
 * - Bosses: 0.5-0.6x (heavily armored)
 *
 * Integrates with:
 * - Player input system
 * - CombatSystem for damage registration
 * - FirstPersonWeapons for weapon lunge animation
 * - AudioManager for melee sounds
 * - DamageFeedback for screen shake
 * - CombatBalanceConfig for damage values
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { getLogger } from '../core/Logger';
import { getAudioManager } from '../core/AudioManager';
import { type Entity, getEntitiesInRadius } from '../core/ecs';
import { damageFeedback } from '../effects/DamageFeedback';
import { hitReactionSystem } from '../systems/HitReactionSystem';
import { hitAudioManager } from '../core/HitAudioManager';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { getAchievementManager } from '../achievements';
import { firstPersonWeapons } from '../weapons/FirstPersonWeapons';
import { MELEE_BALANCE, calculateMeleeDamage } from '../balance/CombatBalanceConfig';

const log = getLogger('MeleeSystem');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MeleeConfig {
  /** Base damage per melee hit */
  baseDamage: number;
  /** Attack reach in meters */
  attackRange: number;
  /** Cooldown between attacks in seconds */
  cooldown: number;
  /** Cone angle for hit detection in degrees */
  coneAngle: number;
  /** Knockback force applied to hit enemies */
  knockbackForce: number;
  /** Camera punch intensity during attack */
  cameraPunchIntensity: number;
  /** Screen shake intensity on successful hit */
  hitScreenShakeIntensity: number;
  /** Duration of the attack animation in milliseconds */
  attackDuration: number;
}

const DEFAULT_CONFIG: MeleeConfig = {
  baseDamage: MELEE_BALANCE.baseDamage, // 100 base damage (was 50)
  attackRange: MELEE_BALANCE.attackRange, // 2.0 meters
  cooldown: MELEE_BALANCE.cooldown, // 0.8 seconds
  coneAngle: 45,
  knockbackForce: 5.0,
  cameraPunchIntensity: 0.15,
  hitScreenShakeIntensity: 6,
  attackDuration: 200,
};

// ---------------------------------------------------------------------------
// Melee Attack State
// ---------------------------------------------------------------------------

export interface MeleeAttackResult {
  /** Whether the attack hit any targets */
  didHit: boolean;
  /** Number of targets hit */
  hitCount: number;
  /** Total damage dealt */
  totalDamage: number;
  /** Entities that were hit */
  hitEntities: Entity[];
}

// ---------------------------------------------------------------------------
// Melee System Class
// ---------------------------------------------------------------------------

/**
 * MeleeSystem - Singleton that manages melee combat mechanics
 */
export class MeleeSystem {
  private static instance: MeleeSystem | null = null;

  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private config: MeleeConfig = { ...DEFAULT_CONFIG };

  // Cooldown tracking
  private lastAttackTime = 0;
  private isAttacking = false;

  // Animation state
  private attackProgress = 0;
  private cameraPunchOffset = 0;

  // Callbacks
  private onAttackCallback: ((result: MeleeAttackResult) => void) | null = null;
  private weaponLungeCallback: (() => void) | null = null;

  private constructor() {}

  static getInstance(): MeleeSystem {
    if (!MeleeSystem.instance) {
      MeleeSystem.instance = new MeleeSystem();
    }
    return MeleeSystem.instance;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize the melee system
   * @param scene - Active Babylon.js scene
   * @param camera - Player's first-person camera
   * @param config - Optional configuration overrides
   */
  init(scene: Scene, camera: FreeCamera, config?: Partial<MeleeConfig>): void {
    this.scene = scene;
    this.camera = camera;

    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    log.info('Initialized with config:', {
      damage: this.config.baseDamage,
      range: this.config.attackRange,
      cooldown: this.config.cooldown,
    });
  }

  /**
   * Configure the melee system
   */
  configure(config: Partial<MeleeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set callback for when attack completes
   */
  onAttack(callback: (result: MeleeAttackResult) => void): void {
    this.onAttackCallback = callback;
  }

  /**
   * Set callback for triggering weapon lunge animation
   */
  setWeaponLungeCallback(callback: () => void): void {
    this.weaponLungeCallback = callback;
  }

  // ---------------------------------------------------------------------------
  // Attack Execution
  // ---------------------------------------------------------------------------

  /**
   * Check if melee attack is ready (off cooldown)
   */
  canAttack(): boolean {
    const now = performance.now();
    const cooldownMs = this.config.cooldown * 1000;
    return !this.isAttacking && now - this.lastAttackTime >= cooldownMs;
  }

  /**
   * Get remaining cooldown time in seconds
   */
  getCooldownRemaining(): number {
    const now = performance.now();
    const cooldownMs = this.config.cooldown * 1000;
    const elapsed = now - this.lastAttackTime;
    const remaining = (cooldownMs - elapsed) / 1000;
    return Math.max(0, remaining);
  }

  /**
   * Execute a melee attack
   * @returns Attack result with hit information
   */
  attack(): MeleeAttackResult | null {
    if (!this.canAttack() || !this.camera || !this.scene) {
      return null;
    }

    // Start attack
    this.isAttacking = true;
    this.lastAttackTime = performance.now();
    this.attackProgress = 0;

    // Play swing sound
    const audio = getAudioManager();
    audio.play('melee_swing', { volume: 0.6 });

    // Trigger weapon lunge animation via FirstPersonWeapons system
    if (firstPersonWeapons.isInitialized) {
      firstPersonWeapons.triggerMeleeLunge();
    }
    // Also call custom callback if set
    this.weaponLungeCallback?.();

    // Start camera punch animation
    this.startCameraPunch();

    // Perform hit detection
    const result = this.performHitDetection();

    // Process hits
    if (result.didHit) {
      // Play impact sound
      audio.play('melee_impact', { volume: 0.7 });

      // Screen shake on hit
      damageFeedback.triggerScreenShake(this.config.hitScreenShakeIntensity, false);

      // Track achievement stat
      getAchievementManager().onShotHit(); // Melee counts as a hit

      log.info(`Melee hit ${result.hitCount} targets for ${result.totalDamage} total damage`);
    }

    // Callback
    this.onAttackCallback?.(result);

    // End attack after duration
    setTimeout(() => {
      this.isAttacking = false;
    }, this.config.attackDuration);

    return result;
  }

  /**
   * Perform cone-based hit detection
   */
  private performHitDetection(): MeleeAttackResult {
    const result: MeleeAttackResult = {
      didHit: false,
      hitCount: 0,
      totalDamage: 0,
      hitEntities: [],
    };

    if (!this.camera) return result;

    const playerPos = this.camera.position;
    const forward = this.camera.getForwardRay(1).direction.normalize();

    // Get all enemies within attack range
    const nearbyEntities = getEntitiesInRadius(
      playerPos,
      this.config.attackRange * 1.5, // Slightly larger radius for initial filter
      (entity) => entity.tags?.enemy === true && !!entity.health && entity.health.current > 0
    );

    // Convert cone angle to radians and calculate cos threshold
    const coneAngleRad = (this.config.coneAngle * Math.PI) / 180;
    const cosThreshold = Math.cos(coneAngleRad / 2);

    for (const entity of nearbyEntities) {
      if (!entity.transform || !entity.health) continue;

      const entityPos = entity.transform.position;
      const toEntity = entityPos.subtract(playerPos);
      const distance = toEntity.length();

      // Check if within attack range
      if (distance > this.config.attackRange) continue;

      // Normalize direction to entity
      const dirToEntity = toEntity.normalize();

      // Check if within cone (dot product test)
      const dot = Vector3.Dot(forward, dirToEntity);
      if (dot < cosThreshold) continue;

      // Entity is hit!
      result.didHit = true;
      result.hitCount++;

      // Apply damage with enemy-specific multiplier
      const speciesId = entity.alienInfo?.speciesId ?? 'unknown';
      const damage = calculateMeleeDamage(speciesId, this.config.baseDamage);
      entity.health.current -= damage;
      result.totalDamage += damage;
      result.hitEntities.push(entity);

      // Apply knockback
      this.applyKnockback(entity, forward);

      // Apply hit feedback
      this.applyHitFeedback(entity, damage, forward);

      // Check for kill
      if (entity.health.current <= 0) {
        // Kill confirmed - play sound
        hitAudioManager.playKillSound();
      }
    }

    return result;
  }

  /**
   * Apply knockback force to hit entity
   */
  private applyKnockback(entity: Entity, direction: Vector3): void {
    if (!entity.transform) return;

    // Calculate knockback direction (mostly horizontal, slight upward)
    const knockbackDir = new Vector3(direction.x, 0.2, direction.z).normalize();
    const knockbackAmount = this.config.knockbackForce * 0.3; // Scale for position offset

    // Apply immediate position offset
    entity.transform.position.addInPlace(knockbackDir.scale(knockbackAmount));

    // If entity has velocity, add knockback impulse
    if (entity.velocity) {
      const impulse = knockbackDir.scale(this.config.knockbackForce);
      entity.velocity.linear.addInPlace(impulse);
    }
  }

  /**
   * Apply visual and audio feedback for hitting an entity
   */
  private applyHitFeedback(entity: Entity, damage: number, hitDirection: Vector3): void {
    // Apply damage feedback (flash, knockback animation, damage numbers)
    if (entity.renderable?.mesh) {
      const target = entity.renderable.mesh as Mesh | TransformNode;
      damageFeedback.applyDamageFeedback(target, damage, hitDirection.negate(), false);
    }

    // Apply hit reaction (stagger, pain sound)
    if (entity.alienInfo) {
      hitReactionSystem.applyHitReaction(
        entity,
        damage,
        hitDirection.negate(),
        this.camera?.position ?? Vector3.Zero()
      );
    } else {
      // Fallback pain sound for non-alien enemies
      getEnemySoundManager().playHitSound(entity);
    }

    // Play hit marker sound
    hitAudioManager.playHitSound(damage, false);
  }

  // ---------------------------------------------------------------------------
  // Camera Punch Animation
  // ---------------------------------------------------------------------------

  /**
   * Start the camera punch animation
   */
  private startCameraPunch(): void {
    if (!this.camera) return;

    const startTime = performance.now();
    const duration = this.config.attackDuration;
    const intensity = this.config.cameraPunchIntensity;

    // Store original camera rotation
    const originalRotX = this.camera.rotation?.x ?? 0;

    const animatePunch = () => {
      if (!this.camera) return;

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Punch curve: quick forward, slow return
      // 0-0.3: punch forward
      // 0.3-1.0: return
      let punchAmount: number;
      if (progress < 0.3) {
        // Quick forward punch (ease out)
        const t = progress / 0.3;
        punchAmount = t * t;
      } else {
        // Slow return (ease in)
        const t = (progress - 0.3) / 0.7;
        punchAmount = 1 - t * t;
      }

      // Apply punch as forward camera tilt
      this.cameraPunchOffset = -punchAmount * intensity;

      // Also move camera slightly forward
      const forward = this.camera.getForwardRay(1).direction;
      // Note: We don't actually move camera position, just store the offset
      // The player class can query this for applying

      if (progress < 1) {
        requestAnimationFrame(animatePunch);
      } else {
        this.cameraPunchOffset = 0;
      }
    };

    requestAnimationFrame(animatePunch);
  }

  /**
   * Get current camera punch offset (for external application)
   */
  getCameraPunchOffset(): number {
    return this.cameraPunchOffset;
  }

  /**
   * Check if currently in attack animation
   */
  isInAttack(): boolean {
    return this.isAttacking;
  }

  // ---------------------------------------------------------------------------
  // Update Loop
  // ---------------------------------------------------------------------------

  /**
   * Update the melee system (call each frame)
   * Currently handles cooldown display but can be extended
   */
  update(_deltaTime: number): void {
    // Reserved for future animation updates if needed
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.scene = null;
    this.camera = null;
    this.onAttackCallback = null;
    this.weaponLungeCallback = null;
    this.isAttacking = false;
    this.attackProgress = 0;
    this.cameraPunchOffset = 0;

    MeleeSystem.instance = null;
    log.info('Disposed');
  }
}

// ---------------------------------------------------------------------------
// Singleton Accessor
// ---------------------------------------------------------------------------

export const meleeSystem = MeleeSystem.getInstance();

/**
 * Get the melee system instance
 */
export function getMeleeSystem(): MeleeSystem {
  return MeleeSystem.getInstance();
}
