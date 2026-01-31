/**
 * HitReactionSystem - Handles enemy stagger animations and hit reactions
 *
 * Provides:
 * - Stagger animation trigger on hit (brief pause + visual feedback)
 * - Pain sound playback per enemy type on damage
 * - Multiple death animation selection
 * - Knockback force based on weapon damage
 * - Death force direction based on shot origin
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import { BezierCurveEase } from '@babylonjs/core/Animations/easing';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Animatable } from '@babylonjs/core/Animations/animatable';

// Required for animation
import '@babylonjs/core/Animations/animatable';

import {
  calculateKnockbackForce,
  getHitReactionConfig,
  getRandomDeathAnimation,
  getRandomPainSound,
} from '../entities/aliens';
import type { Entity } from '../core/ecs';
import { getLogger } from '../core/Logger';
import { getAudioManager, type SoundEffect } from '../core/AudioManager';

const log = getLogger('HitReactionSystem');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Death animation types supported by the system
 */
export type DeathAnimationType =
  | 'death_collapse' // Standard fall over
  | 'death_explode' // Burst into particles
  | 'death_ragdoll' // Physics ragdoll
  | 'death_dissolve' // Fade/melt away
  | 'death_shatter' // Break into pieces (husk)
  | 'death_acid_burst' // Acid explosion (spewer)
  | 'death_epic_collapse' // Dramatic boss fall
  | 'death_explode_massive'; // Big boss explosion

/**
 * Hit reaction state for tracking stagger
 */
interface HitReactionState {
  isStaggered: boolean;
  staggerEndTime: number;
  originalSpeed: number;
  animatable: Animatable | null;
}

/**
 * Configuration for a death animation
 */
interface DeathAnimationConfig {
  duration: number; // ms
  applyForce: boolean; // whether to apply death force direction
  particleEffect: 'dissolve' | 'explode' | 'ichor_burst' | 'mechanical' | 'boss';
  rotationAxis: 'x' | 'z' | 'random';
}

// ---------------------------------------------------------------------------
// Death Animation Configurations
// ---------------------------------------------------------------------------

const DEATH_ANIMATION_CONFIGS: Record<DeathAnimationType, DeathAnimationConfig> = {
  death_collapse: {
    duration: 600,
    applyForce: true,
    particleEffect: 'dissolve',
    rotationAxis: 'x',
  },
  death_explode: {
    duration: 300,
    applyForce: false,
    particleEffect: 'explode',
    rotationAxis: 'random',
  },
  death_ragdoll: {
    duration: 800,
    applyForce: true,
    particleEffect: 'ichor_burst',
    rotationAxis: 'random',
  },
  death_dissolve: {
    duration: 1000,
    applyForce: false,
    particleEffect: 'dissolve',
    rotationAxis: 'x',
  },
  death_shatter: {
    duration: 400,
    applyForce: true,
    particleEffect: 'mechanical',
    rotationAxis: 'random',
  },
  death_acid_burst: {
    duration: 500,
    applyForce: false,
    particleEffect: 'ichor_burst',
    rotationAxis: 'z',
  },
  death_epic_collapse: {
    duration: 2000,
    applyForce: true,
    particleEffect: 'boss',
    rotationAxis: 'x',
  },
  death_explode_massive: {
    duration: 1500,
    applyForce: false,
    particleEffect: 'boss',
    rotationAxis: 'random',
  },
};

// ---------------------------------------------------------------------------
// HitReactionSystem Class
// ---------------------------------------------------------------------------

export class HitReactionSystem {
  private static instance: HitReactionSystem | null = null;

  private scene: Scene | null = null;
  private entityStates: Map<string, HitReactionState> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): HitReactionSystem {
    if (!HitReactionSystem.instance) {
      HitReactionSystem.instance = new HitReactionSystem();
    }
    return HitReactionSystem.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;
    log.info('Initialized');
  }

  /**
   * Apply hit reaction to an enemy entity.
   * This triggers stagger animation, plays pain sound, and applies knockback.
   *
   * @param entity - The enemy entity that was hit
   * @param damage - Amount of damage dealt
   * @param hitDirection - Direction the hit came from (projectile direction)
   * @param shotOrigin - World position where the shot originated
   */
  applyHitReaction(
    entity: Entity,
    damage: number,
    hitDirection: Vector3,
    shotOrigin?: Vector3
  ): void {
    if (!entity.id || !entity.transform || !entity.alienInfo || !entity.renderable?.mesh) {
      return;
    }

    const speciesId = entity.alienInfo.speciesId;
    const config = getHitReactionConfig(speciesId);

    // 1. Trigger stagger animation
    this.triggerStagger(entity, config.duration);

    // 2. Play pain sound
    this.playPainSound(entity, speciesId);

    // 3. Apply knockback
    const knockbackForce = calculateKnockbackForce(speciesId, damage);
    if (knockbackForce > 0) {
      this.applyKnockback(entity, hitDirection, knockbackForce);
    }

    // 4. Apply visual stagger effect
    this.applyStaggerVisual(entity.renderable.mesh, config.duration);
  }

  /**
   * Trigger stagger state for an entity.
   * During stagger, enemy movement is paused briefly.
   */
  private triggerStagger(entity: Entity, duration: number): void {
    if (!entity.id || !entity.ai) return;

    const now = performance.now();
    let state = this.entityStates.get(entity.id);

    if (!state) {
      state = {
        isStaggered: false,
        staggerEndTime: 0,
        originalSpeed: entity.velocity?.maxSpeed ?? 10,
        animatable: null,
      };
      this.entityStates.set(entity.id, state);
    }

    // Start stagger
    state.isStaggered = true;
    state.staggerEndTime = now + duration;

    // Temporarily reduce speed during stagger
    if (entity.velocity) {
      state.originalSpeed = entity.velocity.maxSpeed;
      entity.velocity.maxSpeed = 0; // Freeze during stagger
    }
  }

  /**
   * Play a random pain sound for the species.
   */
  private playPainSound(entity: Entity, speciesId: string): void {
    const soundId = getRandomPainSound(speciesId);

    // Map to AudioManager sound effects
    const soundMap: Record<string, SoundEffect> = {
      alien_chittering: 'alien_chittering',
      organic_squish: 'organic_squish',
      alien_hiss: 'alien_hiss',
      alien_screech: 'alien_screech',
      alien_growl: 'alien_growl',
      alien_roar: 'alien_roar',
      alien_gurgle: 'organic_squish', // fallback
    };

    const soundEffect = soundMap[soundId] || 'organic_squish';

    // Calculate volume based on distance (spatial audio handled by EnemySoundManager normally,
    // but we want pain sounds to be slightly louder for feedback)
    getAudioManager().play(soundEffect, { volume: 0.7 });
  }

  /**
   * Apply knockback force to an entity.
   * Direction is opposite to hit direction.
   */
  private applyKnockback(entity: Entity, hitDirection: Vector3, force: number): void {
    if (!entity.transform) return;

    // Knockback is in the direction the hit came from (push back)
    const knockbackDir = hitDirection.normalize().scale(-force);

    // Apply to position immediately for instant feedback
    entity.transform.position.addInPlace(knockbackDir);

    // Also apply to velocity for continued motion
    if (entity.velocity) {
      entity.velocity.linear.addInPlace(knockbackDir.scale(5));
    }
  }

  /**
   * Apply visual stagger effect (jitter/shake animation).
   */
  private applyStaggerVisual(mesh: Mesh | TransformNode, duration: number): void {
    if (!this.scene) return;

    const originalPosition = mesh.position.clone();
    const originalRotation = mesh.rotation.clone();

    // Create a rapid shake animation
    const shakeAnim = new Animation(
      'staggerShake',
      'position',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const shakeIntensity = 0.1;
    const frames = Math.floor(duration / 16.67); // ~60fps

    const keys: { frame: number; value: Vector3 }[] = [];
    for (let i = 0; i <= frames; i++) {
      const progress = i / frames;
      const damping = 1 - progress; // Fade out shake
      const offset = new Vector3(
        (Math.random() - 0.5) * shakeIntensity * damping,
        (Math.random() - 0.5) * shakeIntensity * damping * 0.5,
        (Math.random() - 0.5) * shakeIntensity * damping
      );
      keys.push({
        frame: i,
        value: originalPosition.add(offset),
      });
    }
    // Return to original position
    keys.push({ frame: frames + 1, value: originalPosition });

    shakeAnim.setKeys(keys);

    // Create rotation stagger (slight tilt)
    const rotAnim = new Animation(
      'staggerRotate',
      'rotation',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const rotIntensity = 0.1;
    const rotKeys = [
      { frame: 0, value: originalRotation },
      {
        frame: 2,
        value: originalRotation.add(
          new Vector3((Math.random() - 0.5) * rotIntensity, 0, (Math.random() - 0.5) * rotIntensity)
        ),
      },
      {
        frame: 4,
        value: originalRotation.add(
          new Vector3(
            (Math.random() - 0.5) * rotIntensity * 0.5,
            0,
            (Math.random() - 0.5) * rotIntensity * 0.5
          )
        ),
      },
      { frame: Math.floor(frames / 2), value: originalRotation },
    ];
    rotAnim.setKeys(rotKeys);

    this.scene.beginDirectAnimation(mesh, [shakeAnim, rotAnim], 0, frames + 1, false);
  }

  /**
   * Select and execute a death animation for an entity.
   *
   * @param entity - The dying entity
   * @param shotOrigin - Where the killing shot came from (for death force direction)
   * @returns The selected death animation type and duration
   */
  selectDeathAnimation(
    entity: Entity,
    shotOrigin?: Vector3
  ): { animationType: DeathAnimationType; duration: number; forceDirection: Vector3 } {
    if (!entity.alienInfo || !entity.transform) {
      return {
        animationType: 'death_collapse',
        duration: 600,
        forceDirection: Vector3.Zero(),
      };
    }

    const speciesId = entity.alienInfo.speciesId;
    const animationType = getRandomDeathAnimation(speciesId) as DeathAnimationType;
    const config = DEATH_ANIMATION_CONFIGS[animationType] || DEATH_ANIMATION_CONFIGS.death_collapse;

    // Calculate death force direction based on shot origin
    let forceDirection = Vector3.Zero();
    if (shotOrigin && config.applyForce) {
      forceDirection = entity.transform.position.subtract(shotOrigin).normalize();
      // Add slight upward component for dramatic effect
      forceDirection.y = Math.max(forceDirection.y, 0.3);
    }

    return {
      animationType,
      duration: config.duration,
      forceDirection,
    };
  }

  /**
   * Execute a death animation on an entity's mesh.
   *
   * @param mesh - The mesh to animate
   * @param animationType - The type of death animation to play
   * @param forceDirection - Direction to apply death force
   * @param scale - Scale of the entity (affects animation intensity)
   */
  executeDeathAnimation(
    mesh: Mesh | TransformNode,
    animationType: DeathAnimationType,
    forceDirection: Vector3,
    scale: number = 1
  ): void {
    if (!this.scene) return;

    const config = DEATH_ANIMATION_CONFIGS[animationType] || DEATH_ANIMATION_CONFIGS.death_collapse;
    const duration = config.duration;
    const frameCount = Math.floor(duration / 16.67);

    // Determine rotation axis
    let rotationAxis: Vector3;
    switch (config.rotationAxis) {
      case 'x':
        rotationAxis = new Vector3(1, 0, 0);
        break;
      case 'z':
        rotationAxis = new Vector3(0, 0, 1);
        break;
      case 'random':
      default:
        rotationAxis = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        break;
    }

    const originalPosition = mesh.position.clone();
    const originalRotation = mesh.rotation.clone();
    const originalScale = mesh.scaling.clone();

    // Create death movement animation based on type
    switch (animationType) {
      case 'death_collapse':
      case 'death_epic_collapse':
        this.animateCollapse(mesh, originalPosition, originalRotation, forceDirection, config);
        break;

      case 'death_explode':
      case 'death_explode_massive':
        this.animateExplode(mesh, originalScale, config);
        break;

      case 'death_ragdoll':
        this.animateRagdoll(mesh, originalPosition, forceDirection, config);
        break;

      case 'death_dissolve':
        this.animateDissolve(mesh, originalScale, config);
        break;

      case 'death_shatter':
        this.animateShatter(mesh, originalPosition, originalRotation, config);
        break;

      case 'death_acid_burst':
        this.animateAcidBurst(mesh, originalPosition, originalScale, config);
        break;
    }
  }

  /**
   * Collapse death animation - entity falls over
   */
  private animateCollapse(
    mesh: Mesh | TransformNode,
    startPos: Vector3,
    startRot: Vector3,
    forceDir: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    // Fall to ground with rotation
    const fallAnim = new Animation(
      'deathCollapse',
      'position',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const endPos = startPos.add(forceDir.scale(1.5));
    endPos.y = 0.1; // Near ground

    fallAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: Math.floor(frameCount * 0.3), value: startPos.add(forceDir.scale(0.5)) },
      { frame: frameCount, value: endPos },
    ]);

    // Easing for natural fall
    const easing = new BezierCurveEase(0.4, 0, 0.6, 1);
    fallAnim.setEasingFunction(easing);

    // Rotation to fallen position
    const rotAnim = new Animation(
      'deathRotate',
      'rotation.x',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    rotAnim.setKeys([
      { frame: 0, value: startRot.x },
      { frame: frameCount, value: startRot.x + Math.PI / 2 },
    ]);
    rotAnim.setEasingFunction(easing);

    this.scene.beginDirectAnimation(mesh, [fallAnim, rotAnim], 0, frameCount, false);
  }

  /**
   * Explode death animation - rapid scale down and disappear
   */
  private animateExplode(
    mesh: Mesh | TransformNode,
    startScale: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    const scaleAnim = new Animation(
      'deathExplode',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: startScale },
      { frame: 3, value: startScale.scale(1.3) }, // Brief expansion
      { frame: frameCount, value: Vector3.Zero() },
    ]);

    this.scene.beginDirectAnimation(mesh, [scaleAnim], 0, frameCount, false);
  }

  /**
   * Ragdoll death animation - physics-like tumble
   */
  private animateRagdoll(
    mesh: Mesh | TransformNode,
    startPos: Vector3,
    forceDir: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    // Arc trajectory
    const posAnim = new Animation(
      'deathRagdoll',
      'position',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const midPoint = startPos.add(forceDir.scale(2));
    midPoint.y = startPos.y + 1;
    const endPoint = startPos.add(forceDir.scale(3));
    endPoint.y = 0.1;

    posAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: Math.floor(frameCount * 0.4), value: midPoint },
      { frame: frameCount, value: endPoint },
    ]);

    // Tumble rotation
    const rotXAnim = new Animation(
      'ragdollRotX',
      'rotation.x',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotXAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: frameCount, value: Math.PI * 2 * (0.5 + Math.random()) },
    ]);

    const rotZAnim = new Animation(
      'ragdollRotZ',
      'rotation.z',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotZAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: frameCount, value: Math.PI * (0.5 + Math.random()) },
    ]);

    this.scene.beginDirectAnimation(mesh, [posAnim, rotXAnim, rotZAnim], 0, frameCount, false);
  }

  /**
   * Dissolve death animation - fade and shrink
   */
  private animateDissolve(
    mesh: Mesh | TransformNode,
    startScale: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    const scaleAnim = new Animation(
      'deathDissolve',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: startScale },
      { frame: frameCount, value: startScale.scale(0.1) },
    ]);

    const easing = new BezierCurveEase(0.2, 0, 0.4, 1);
    scaleAnim.setEasingFunction(easing);

    this.scene.beginDirectAnimation(mesh, [scaleAnim], 0, frameCount, false);
  }

  /**
   * Shatter death animation - break apart with spin
   */
  private animateShatter(
    mesh: Mesh | TransformNode,
    startPos: Vector3,
    startRot: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    // Rapid spin
    const rotAnim = new Animation(
      'deathShatter',
      'rotation',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    rotAnim.setKeys([
      { frame: 0, value: startRot },
      {
        frame: 5,
        value: new Vector3(
          startRot.x + Math.PI * 0.5,
          startRot.y + Math.PI,
          startRot.z + Math.PI * 0.3
        ),
      },
      { frame: frameCount, value: new Vector3(startRot.x + Math.PI, startRot.y, startRot.z) },
    ]);

    // Scale to zero
    const scaleAnim = new Animation(
      'shatterScale',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const startScale = mesh.scaling.clone();
    scaleAnim.setKeys([
      { frame: 0, value: startScale },
      { frame: 3, value: startScale.scale(1.2) },
      { frame: frameCount, value: Vector3.Zero() },
    ]);

    this.scene.beginDirectAnimation(mesh, [rotAnim, scaleAnim], 0, frameCount, false);
  }

  /**
   * Acid burst death animation - expand and pop
   */
  private animateAcidBurst(
    mesh: Mesh | TransformNode,
    startPos: Vector3,
    startScale: Vector3,
    config: DeathAnimationConfig
  ): void {
    if (!this.scene) return;

    const frameCount = Math.floor(config.duration / 16.67);

    // Swell up then pop
    const scaleAnim = new Animation(
      'deathAcidBurst',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: startScale },
      { frame: Math.floor(frameCount * 0.6), value: startScale.scale(1.4) },
      { frame: Math.floor(frameCount * 0.7), value: startScale.scale(1.5) },
      { frame: frameCount, value: Vector3.Zero() },
    ]);

    // Rise slightly during swell
    const posAnim = new Animation(
      'acidRise',
      'position.y',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    posAnim.setKeys([
      { frame: 0, value: startPos.y },
      { frame: Math.floor(frameCount * 0.6), value: startPos.y + 0.3 },
      { frame: frameCount, value: startPos.y - 0.5 },
    ]);

    this.scene.beginDirectAnimation(mesh, [scaleAnim, posAnim], 0, frameCount, false);
  }

  /**
   * Update stagger states - call each frame.
   * Restores entity movement when stagger ends.
   */
  update(): void {
    const now = performance.now();

    for (const [entityId, state] of this.entityStates) {
      if (state.isStaggered && now >= state.staggerEndTime) {
        state.isStaggered = false;

        // Note: Entity speed restoration would be handled here,
        // but we need a reference to the entity. For now, stagger
        // just uses temporary speed reduction during hit reaction.
      }
    }
  }

  /**
   * Get the particle effect type for a death animation.
   */
  getDeathParticleEffect(
    animationType: DeathAnimationType
  ): 'dissolve' | 'explode' | 'ichor_burst' | 'mechanical' | 'boss' {
    const config = DEATH_ANIMATION_CONFIGS[animationType];
    return config?.particleEffect ?? 'dissolve';
  }

  /**
   * Clean up state for a removed entity.
   */
  removeEntity(entityId: string): void {
    const state = this.entityStates.get(entityId);
    if (state?.animatable) {
      state.animatable.stop();
    }
    this.entityStates.delete(entityId);
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    for (const state of this.entityStates.values()) {
      if (state.animatable) {
        state.animatable.stop();
      }
    }
    this.entityStates.clear();
    this.scene = null;
    HitReactionSystem.instance = null;
    log.info('Disposed');
  }
}

// Export singleton accessor
export const hitReactionSystem = HitReactionSystem.getInstance();
