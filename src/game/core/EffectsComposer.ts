/**
 * EffectsComposer - Central coordinator for all post-processing visual effects
 *
 * This module orchestrates multiple effect systems to create cohesive visual feedback:
 * - PostProcessManager: Core BabylonJS pipeline (bloom, chromatic aberration, vignette, grain)
 * - Screen shake integration: Works with BaseLevel camera shake system
 * - Dynamic effect states: Manages transitions between combat, exploration, and cinematic modes
 * - Event-driven effects: Responds to game events (damage, explosions, boss attacks)
 *
 * The EffectsComposer acts as a facade, providing a simplified API for triggering
 * complex multi-effect sequences while managing proper layering and priorities.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import type { LevelType } from '../levels/types';
import { getLogger } from './Logger';
import {
  type PostProcessConfig,
  PostProcessManager,
  type PostProcessQuality,
} from './PostProcessManager';

const log = getLogger('EffectsComposer');

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

/**
 * Effect intensity levels for categorizing different game events
 */
export type EffectIntensity = 'subtle' | 'light' | 'medium' | 'heavy' | 'extreme';

/**
 * Screen shake configuration for different event types
 */
export interface ScreenShakeEvent {
  /** Shake intensity (1-10 scale) */
  intensity: number;
  /** Duration in seconds */
  duration: number;
  /** Decay rate (0.9 = fast, 0.95 = slow) */
  decayRate?: number;
  /** Whether to add to existing shake or replace */
  additive?: boolean;
}

/**
 * Preset screen shake configurations for common events
 */
export const SHAKE_PRESETS: Record<string, ScreenShakeEvent> = {
  // Weapon fire - subtle to medium based on weapon
  weaponFire_light: { intensity: 0.5, duration: 0.08, decayRate: 0.85 },
  weaponFire_medium: { intensity: 1.5, duration: 0.1, decayRate: 0.88 },
  weaponFire_heavy: { intensity: 3.0, duration: 0.15, decayRate: 0.9 },
  weaponFire_shotgun: { intensity: 4.0, duration: 0.18, decayRate: 0.88 },
  weaponFire_rocket: { intensity: 5.0, duration: 0.2, decayRate: 0.9 },

  // Explosions
  explosion_small: { intensity: 3.0, duration: 0.3, decayRate: 0.92 },
  explosion_medium: { intensity: 5.0, duration: 0.4, decayRate: 0.93 },
  explosion_large: { intensity: 7.0, duration: 0.5, decayRate: 0.94 },
  explosion_massive: { intensity: 9.0, duration: 0.6, decayRate: 0.95 },

  // Player damage
  damage_light: { intensity: 1.5, duration: 0.15, decayRate: 0.85 },
  damage_medium: { intensity: 3.0, duration: 0.2, decayRate: 0.88 },
  damage_heavy: { intensity: 5.0, duration: 0.25, decayRate: 0.9 },
  damage_critical: { intensity: 7.0, duration: 0.35, decayRate: 0.92 },

  // Boss attacks
  boss_stomp: { intensity: 6.0, duration: 0.4, decayRate: 0.93 },
  boss_roar: { intensity: 4.0, duration: 0.5, decayRate: 0.94 },
  boss_charge: { intensity: 5.0, duration: 0.3, decayRate: 0.91 },
  boss_death: { intensity: 8.0, duration: 0.8, decayRate: 0.95 },

  // Environmental
  earthquake: { intensity: 4.0, duration: 2.0, decayRate: 0.98 },
  collapse: { intensity: 6.0, duration: 1.5, decayRate: 0.96 },
  vehicle_impact: { intensity: 4.0, duration: 0.25, decayRate: 0.9 },

  // Landing/Movement
  landing_hard: { intensity: 2.0, duration: 0.15, decayRate: 0.85 },
  melee_impact: { intensity: 2.5, duration: 0.12, decayRate: 0.85 },
};

/**
 * Visual effect state for tracking active effects
 */
export interface EffectState {
  // Bloom
  bloomIntensity: number;
  bloomThreshold: number;

  // Chromatic aberration
  chromaticAberrationOffset: number;
  chromaticPulseActive: boolean;

  // Vignette
  vignetteWeight: number;
  vignetteColor: { r: number; g: number; b: number };

  // Damage flash
  damageFlashActive: boolean;
  damageFlashIntensity: number;

  // Motion blur
  motionBlurStrength: number;
  motionBlurEnabled: boolean;

  // Screen shake
  screenShakeActive: boolean;
  screenShakeIntensity: number;

  // Combat state
  inCombat: boolean;
  combatIntensity: number;

  // Special states
  isAiming: boolean;
  isLowHealth: boolean;
  healthPercentage: number;
}

/**
 * Callback for screen shake integration with BaseLevel
 */
export type ScreenShakeCallback = (intensity: number, additive?: boolean) => void;

// ============================================================================
// EFFECTS COMPOSER
// ============================================================================

/**
 * EffectsComposer - Orchestrates all visual post-processing effects
 *
 * Usage:
 * ```ts
 * const composer = new EffectsComposer(scene, camera);
 * composer.setLevelType('hive');
 *
 * // On weapon fire
 * composer.triggerWeaponFire('shotgun');
 *
 * // On explosion
 * composer.triggerExplosion('large', distanceToPlayer);
 *
 * // On damage
 * composer.triggerDamage(25);
 *
 * // Update every frame
 * composer.update(deltaTime);
 * ```
 */
export class EffectsComposer {
  private postProcess: PostProcessManager;

  // State tracking
  private effectState: EffectState;

  // Screen shake callback (set by level)
  private screenShakeCallback: ScreenShakeCallback | null = null;

  // User settings
  private screenShakeEnabled = true;
  private screenShakeMultiplier = 1.0;
  private reducedFlashing = false;

  // Combat tracking for dynamic effects
  private combatTimer = 0;
  private killStreak = 0;
  private killStreakDecayTimer = 0;

  // Explosion bloom tracking
  private explosionBloomTimer = 0;

  // Time for pulsing effects
  private time = 0;

  constructor(scene: Scene, camera: Camera, config?: Partial<PostProcessConfig>) {
    this.scene = scene;
    this.camera = camera;

    // Initialize PostProcessManager with enhanced defaults
    this.postProcess = new PostProcessManager(scene, camera, config);

    // Initialize effect state
    this.effectState = {
      bloomIntensity: 0.5,
      bloomThreshold: 0.8,
      chromaticAberrationOffset: 0.002,
      chromaticPulseActive: false,
      vignetteWeight: 0.3,
      vignetteColor: { r: 0, g: 0, b: 0 },
      damageFlashActive: false,
      damageFlashIntensity: 0,
      motionBlurStrength: 0.3,
      motionBlurEnabled: false,
      screenShakeActive: false,
      screenShakeIntensity: 0,
      inCombat: false,
      combatIntensity: 0,
      isAiming: false,
      isLowHealth: false,
      healthPercentage: 100,
    };

    log.info('EffectsComposer initialized');
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Set the level type for appropriate color grading
   */
  setLevelType(levelType: LevelType): void {
    this.postProcess.setLevelType(levelType);
  }

  /**
   * Transition to a new level type with smooth color grading
   */
  transitionToLevelType(levelType: LevelType, duration: number = 1000): void {
    this.postProcess.transitionToLevelType(levelType, duration);
  }

  /**
   * Set screen shake callback for integration with BaseLevel
   */
  setScreenShakeCallback(callback: ScreenShakeCallback | null): void {
    this.screenShakeCallback = callback;
  }

  /**
   * Set quality level
   */
  setQuality(quality: PostProcessQuality): void {
    this.postProcess.setQuality(quality);
  }

  /**
   * Configure user settings for effects
   */
  configureSettings(settings: {
    screenShakeEnabled?: boolean;
    screenShakeMultiplier?: number;
    reducedFlashing?: boolean;
    postProcessingEnabled?: boolean;
    bloomEnabled?: boolean;
    bloomIntensity?: number;
    chromaticAberrationEnabled?: boolean;
    vignetteEnabled?: boolean;
    filmGrainEnabled?: boolean;
    filmGrainIntensity?: number;
    motionBlur?: boolean;
    colorGradingEnabled?: boolean;
  }): void {
    // Local settings
    if (settings.screenShakeEnabled !== undefined) {
      this.screenShakeEnabled = settings.screenShakeEnabled;
    }
    if (settings.screenShakeMultiplier !== undefined) {
      this.screenShakeMultiplier = settings.screenShakeMultiplier;
    }
    if (settings.reducedFlashing !== undefined) {
      this.reducedFlashing = settings.reducedFlashing;
    }

    // Forward to PostProcessManager
    this.postProcess.syncWithGameSettings(settings);
  }

  // ============================================================================
  // WEAPON FIRE EFFECTS
  // ============================================================================

  /**
   * Trigger effects for weapon fire
   * @param weaponType - Type of weapon fired
   */
  triggerWeaponFire(
    weaponType: 'light' | 'medium' | 'heavy' | 'shotgun' | 'rocket' | 'plasma' = 'medium'
  ): void {
    // Get shake preset
    const presetKey = `weaponFire_${weaponType}` as keyof typeof SHAKE_PRESETS;
    const shake = SHAKE_PRESETS[presetKey] || SHAKE_PRESETS.weaponFire_medium;

    // Trigger screen shake
    this.triggerScreenShake(shake);

    // Trigger weapon shake on post-process (chromatic aberration pulse)
    const caIntensity = this.getChromaticIntensityForWeapon(weaponType);
    this.postProcess.triggerWeaponShake(caIntensity, shake.duration);

    // Heavy weapons get FOV punch
    if (weaponType === 'shotgun' || weaponType === 'rocket' || weaponType === 'heavy') {
      const fovPunch = weaponType === 'rocket' ? 6 : weaponType === 'shotgun' ? 5 : 3;
      this.postProcess.triggerFOVPunch(fovPunch, 15);
    }

    // Plasma/energy weapons boost bloom briefly
    if (weaponType === 'plasma') {
      this.triggerBloomPulse(0.3, 0.15);
    }

    // Enter combat state
    this.enterCombat();
  }

  private getChromaticIntensityForWeapon(
    weaponType: 'light' | 'medium' | 'heavy' | 'shotgun' | 'rocket' | 'plasma'
  ): number {
    switch (weaponType) {
      case 'light':
        return 0.1;
      case 'medium':
        return 0.2;
      case 'heavy':
        return 0.4;
      case 'shotgun':
        return 0.5;
      case 'rocket':
        return 0.7;
      case 'plasma':
        return 0.6;
      default:
        return 0.2;
    }
  }

  // ============================================================================
  // EXPLOSION EFFECTS
  // ============================================================================

  /**
   * Trigger effects for explosion
   * @param size - Explosion size category
   * @param distance - Distance from player (affects intensity falloff)
   */
  triggerExplosion(
    size: 'small' | 'medium' | 'large' | 'massive' = 'medium',
    distance: number = 0
  ): void {
    // Get shake preset
    const presetKey = `explosion_${size}` as keyof typeof SHAKE_PRESETS;
    const shake = SHAKE_PRESETS[presetKey] || SHAKE_PRESETS.explosion_medium;

    // Calculate distance falloff (closer = stronger effect)
    const maxDistance =
      size === 'massive' ? 100 : size === 'large' ? 60 : size === 'medium' ? 40 : 25;
    const falloff = Math.max(0, 1 - distance / maxDistance);

    if (falloff > 0) {
      // Trigger screen shake with distance falloff
      const scaledShake = {
        ...shake,
        intensity: shake.intensity * falloff,
      };
      this.triggerScreenShake(scaledShake);

      // Bloom pulse for explosions (muzzle flash, plasma, fire glow)
      const bloomIntensity =
        (size === 'massive' ? 1.5 : size === 'large' ? 1.2 : size === 'medium' ? 1.0 : 0.7) *
        falloff;
      this.triggerBloomPulse(bloomIntensity, shake.duration);

      // Chromatic aberration pulse
      const caIntensity = (size === 'massive' ? 0.01 : size === 'large' ? 0.008 : 0.005) * falloff;
      this.postProcess.triggerWeaponShake(caIntensity * 10, shake.duration);
    }
  }

  // ============================================================================
  // DAMAGE EFFECTS
  // ============================================================================

  /**
   * Trigger effects for player taking damage
   * @param damageAmount - Amount of damage taken
   * @param healthPercentage - Current health percentage (0-100)
   */
  triggerDamage(damageAmount: number, healthPercentage?: number): void {
    // Calculate intensity based on damage
    let intensity: 'light' | 'medium' | 'heavy' | 'critical';
    if (damageAmount >= 50) {
      intensity = 'critical';
    } else if (damageAmount >= 30) {
      intensity = 'heavy';
    } else if (damageAmount >= 15) {
      intensity = 'medium';
    } else {
      intensity = 'light';
    }

    // Get shake preset
    const presetKey = `damage_${intensity}` as keyof typeof SHAKE_PRESETS;
    const shake = SHAKE_PRESETS[presetKey] || SHAKE_PRESETS.damage_medium;

    // Reduced shake if reduced flashing is enabled
    const shakeMultiplier = this.reducedFlashing ? 0.5 : 1.0;

    this.triggerScreenShake({
      ...shake,
      intensity: shake.intensity * shakeMultiplier,
    });

    // Trigger damage flash
    const flashIntensity = Math.min(1, damageAmount / 50);
    this.postProcess.triggerDamageFlash(flashIntensity * (this.reducedFlashing ? 0.6 : 1.0));

    // Update health state
    if (healthPercentage !== undefined) {
      this.effectState.healthPercentage = healthPercentage;
      this.effectState.isLowHealth = healthPercentage < 30;
      this.postProcess.setPlayerHealth(healthPercentage);
    }
  }

  /**
   * Update player health for continuous low-health effects
   */
  setPlayerHealth(healthPercentage: number): void {
    this.effectState.healthPercentage = healthPercentage;
    this.effectState.isLowHealth = healthPercentage < 30;
    this.postProcess.setPlayerHealth(healthPercentage);
  }

  // ============================================================================
  // BOSS ATTACK EFFECTS
  // ============================================================================

  /**
   * Trigger effects for boss attacks
   * @param attackType - Type of boss attack
   * @param distance - Distance from player
   */
  triggerBossAttack(
    attackType: 'stomp' | 'roar' | 'charge' | 'death' = 'stomp',
    distance: number = 0
  ): void {
    const presetKey = `boss_${attackType}` as keyof typeof SHAKE_PRESETS;
    const shake = SHAKE_PRESETS[presetKey] || SHAKE_PRESETS.boss_stomp;

    // Boss effects have longer range
    const maxDistance = attackType === 'death' ? 150 : attackType === 'roar' ? 100 : 60;
    const falloff = Math.max(0.2, 1 - distance / maxDistance); // Minimum 20% intensity

    this.triggerScreenShake({
      ...shake,
      intensity: shake.intensity * falloff * (this.reducedFlashing ? 0.7 : 1.0),
    });

    // Boss death gets special bloom effect
    if (attackType === 'death') {
      this.triggerBloomPulse(1.5, 1.0);
    }
  }

  // ============================================================================
  // ENVIRONMENTAL EFFECTS
  // ============================================================================

  /**
   * Trigger environmental shake effects
   * @param type - Type of environmental effect
   */
  triggerEnvironmental(type: 'earthquake' | 'collapse' | 'vehicle_impact'): void {
    const shake = SHAKE_PRESETS[type] || SHAKE_PRESETS.earthquake;
    this.triggerScreenShake(shake);
  }

  /**
   * Set base/ambient shake for continuous effects (escape sequences, rumbles)
   * @param intensity - Continuous shake intensity (0 to disable)
   */
  setAmbientShake(intensity: number): void {
    // This would be forwarded to BaseLevel's setBaseShake
    // For now, we track it in state
    this.effectState.screenShakeIntensity = intensity;
  }

  // ============================================================================
  // COMBAT STATE
  // ============================================================================

  /**
   * Enter combat state (affects color grading)
   */
  enterCombat(): void {
    this.effectState.inCombat = true;
    this.lastCombatTime = this.time;
    this.combatTimer = 5; // 5 seconds to exit combat
  }

  /**
   * Record a kill for kill streak effects
   */
  recordKill(): void {
    this.killStreak++;
    this.killStreakDecayTimer = 3; // 3 seconds between kills to maintain streak
    this.postProcess.updateKillStreak(this.killStreak);
    this.postProcess.triggerHitConfirmation();
    this.enterCombat();
  }

  /**
   * Trigger hit confirmation effect (when hitting enemy)
   */
  triggerHitConfirmation(): void {
    this.postProcess.triggerHitConfirmation();
    this.enterCombat();
  }

  // ============================================================================
  // MOVEMENT EFFECTS
  // ============================================================================

  /**
   * Set sprint state for motion blur
   */
  setSprinting(isSprinting: boolean): void {
    this.effectState.motionBlurEnabled = isSprinting;
    this.postProcess.setSprinting(isSprinting);
  }

  /**
   * Set slide state for enhanced motion effects
   */
  setSliding(isSliding: boolean): void {
    this.postProcess.setSliding(isSliding);
  }

  /**
   * Set aiming state (reduces motion blur, disables some effects)
   */
  setAiming(isAiming: boolean): void {
    this.effectState.isAiming = isAiming;
    if (isAiming) {
      // Disable motion blur while aiming
      this.effectState.motionBlurEnabled = false;
    }
  }

  /**
   * Trigger landing impact effect
   * @param fallDistance - Approximate fall distance
   */
  triggerLanding(fallDistance: number): void {
    if (fallDistance > 3) {
      // Only trigger for significant falls
      const intensity = Math.min(4, fallDistance / 3);
      this.triggerScreenShake({
        intensity,
        duration: 0.15,
        decayRate: 0.85,
      });
    }
  }

  /**
   * Trigger melee impact effect
   */
  triggerMeleeImpact(): void {
    this.triggerScreenShake(SHAKE_PRESETS.melee_impact);
    this.enterCombat();
  }

  // ============================================================================
  // CINEMATIC EFFECTS
  // ============================================================================

  /**
   * Enable depth of field for cinematic moments
   */
  enableDepthOfField(focusDistance: number, focalLength = 50, fStop = 2.8): void {
    this.postProcess.enableDepthOfField(focusDistance, focalLength, fStop);
  }

  /**
   * Disable depth of field
   */
  disableDepthOfField(): void {
    this.postProcess.disableDepthOfField();
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Trigger screen shake via callback
   */
  private triggerScreenShake(event: ScreenShakeEvent): void {
    if (!this.screenShakeEnabled) return;

    const scaledIntensity = event.intensity * this.screenShakeMultiplier;

    if (this.screenShakeCallback) {
      this.screenShakeCallback(scaledIntensity, event.additive ?? false);
    }

    this.effectState.screenShakeActive = true;
    this.effectState.screenShakeIntensity = Math.max(
      this.effectState.screenShakeIntensity,
      scaledIntensity
    );
  }

  /**
   * Trigger a brief bloom intensity pulse
   */
  private triggerBloomPulse(intensity: number, duration: number): void {
    this.explosionBloomTarget = intensity;
    this.explosionBloomTimer = duration;
    this.postProcess.setBloomIntensity(0.5 + intensity);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update all effects - call every frame
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    // Update PostProcessManager
    this.postProcess.update(deltaTime);

    // Update combat timer
    this.updateCombatState(deltaTime);

    // Update kill streak decay
    this.updateKillStreak(deltaTime);

    // Update explosion bloom decay
    this.updateExplosionBloom(deltaTime);

    // Update low health pulsing effects
    this.updateLowHealthEffects(deltaTime);

    // Decay screen shake intensity tracker
    if (this.effectState.screenShakeIntensity > 0) {
      this.effectState.screenShakeIntensity *= 0.9;
      if (this.effectState.screenShakeIntensity < 0.1) {
        this.effectState.screenShakeIntensity = 0;
        this.effectState.screenShakeActive = false;
      }
    }
  }

  private updateCombatState(deltaTime: number): void {
    if (this.effectState.inCombat) {
      this.combatTimer -= deltaTime;
      if (this.combatTimer <= 0) {
        this.effectState.inCombat = false;
        this.effectState.combatIntensity = 0;
      } else {
        // Combat intensity ramps up quickly, decays slowly
        this.effectState.combatIntensity = Math.min(
          1,
          this.effectState.combatIntensity + deltaTime * 2
        );
      }
    }
  }

  private updateKillStreak(deltaTime: number): void {
    if (this.killStreak > 0) {
      this.killStreakDecayTimer -= deltaTime;
      if (this.killStreakDecayTimer <= 0) {
        this.killStreak = Math.max(0, this.killStreak - 1);
        this.killStreakDecayTimer = 1; // Decay one kill per second after timeout
        this.postProcess.updateKillStreak(this.killStreak);
      }
    }
  }

  private updateExplosionBloom(deltaTime: number): void {
    if (this.explosionBloomTimer > 0) {
      this.explosionBloomTimer -= deltaTime;
      if (this.explosionBloomTimer <= 0) {
        // Reset bloom to default
        this.postProcess.setBloomIntensity(0.5);
        this.explosionBloomTarget = 0;
      }
    }
  }

  private updateLowHealthEffects(_deltaTime: number): void {
    // Low health pulsing is handled by PostProcessManager and LowHealthFeedback
    // We just need to update the state
    if (this.effectState.isLowHealth && !this.reducedFlashing) {
      // Chromatic aberration pulse on low health
      const pulse = Math.sin(this.time * 4) * 0.5 + 0.5;
      const healthFactor = 1 - this.effectState.healthPercentage / 30;
      this.effectState.chromaticAberrationOffset = 0.002 + pulse * healthFactor * 0.008;
    } else {
      this.effectState.chromaticAberrationOffset = 0.002;
    }
  }

  // ============================================================================
  // ACCESSORS
  // ============================================================================

  /**
   * Get current effect state
   */
  getState(): Readonly<EffectState> {
    return { ...this.effectState };
  }

  /**
   * Get the underlying PostProcessManager
   */
  getPostProcessManager(): PostProcessManager {
    return this.postProcess;
  }

  /**
   * Check if any dynamic effects are currently active
   */
  isActive(): boolean {
    return (
      this.effectState.screenShakeActive ||
      this.effectState.damageFlashActive ||
      this.explosionBloomTimer > 0 ||
      this.effectState.isLowHealth
    );
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.postProcess.dispose();
    this.screenShakeCallback = null;
    log.info('EffectsComposer disposed');
  }
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let effectsComposerInstance: EffectsComposer | null = null;

/**
 * Initialize the global effects composer
 */
export function initializeEffectsComposer(
  scene: Scene,
  camera: Camera,
  config?: Partial<PostProcessConfig>
): EffectsComposer {
  if (effectsComposerInstance) {
    effectsComposerInstance.dispose();
  }
  effectsComposerInstance = new EffectsComposer(scene, camera, config);
  return effectsComposerInstance;
}

/**
 * Get the global effects composer instance
 */
export function getEffectsComposer(): EffectsComposer | null {
  return effectsComposerInstance;
}

/**
 * Dispose the global effects composer
 */
export function disposeEffectsComposer(): void {
  if (effectsComposerInstance) {
    effectsComposerInstance.dispose();
    effectsComposerInstance = null;
  }
}
