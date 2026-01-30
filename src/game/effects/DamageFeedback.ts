/**
 * DamageFeedback - Unified damage feedback system for combat
 *
 * Provides visual feedback when entities take damage:
 * - Enemy hit flash (color change)
 * - Hit reaction knockback/stagger
 * - Floating damage numbers
 * - Screen shake integration
 *
 * Works with both Mesh and TransformNode (GLB models) enemy types.
 */

import type { Animatable } from '@babylonjs/core/Animations/animatable';
import { Animation } from '@babylonjs/core/Animations/animation';
import { BezierCurveEase } from '@babylonjs/core/Animations/easing';
import type { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// Required for animation
import '@babylonjs/core/Animations/animatable';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for damage feedback effects
 */
export interface DamageFeedbackConfig {
  /** Enable enemy hit flash effect */
  enableHitFlash: boolean;
  /** Duration of hit flash in milliseconds */
  hitFlashDuration: number;
  /** Color to flash when enemy is hit */
  hitFlashColor: Color3;
  /** Enable hit knockback/stagger */
  enableKnockback: boolean;
  /** Knockback distance multiplier (scaled by damage) */
  knockbackScale: number;
  /** Enable floating damage numbers */
  enableDamageNumbers: boolean;
  /** Damage number float speed (units per second) */
  damageNumberSpeed: number;
  /** Damage number display duration (milliseconds) */
  damageNumberDuration: number;
  /** Enable screen shake on damage dealt */
  enableScreenShake: boolean;
  /** Minimum damage to trigger screen shake */
  screenShakeThreshold: number;
  /** Screen shake intensity multiplier (per damage point above threshold) */
  screenShakeScale: number;
}

const DEFAULT_CONFIG: DamageFeedbackConfig = {
  enableHitFlash: true,
  hitFlashDuration: 100,
  hitFlashColor: new Color3(1, 0.2, 0.2),
  enableKnockback: true,
  knockbackScale: 0.02,
  enableDamageNumbers: true,
  damageNumberSpeed: 2,
  damageNumberDuration: 1000,
  enableScreenShake: true,
  screenShakeThreshold: 15,
  screenShakeScale: 0.1,
};

// ============================================================================
// DAMAGE NUMBER POOL
// ============================================================================

interface DamageNumberEntry {
  mesh: Mesh;
  material: StandardMaterial;
  texture: DynamicTexture | null;
  startTime: number;
  startPosition: Vector3;
  inUse: boolean;
}

// ============================================================================
// DAMAGE FEEDBACK MANAGER
// ============================================================================

/**
 * Singleton manager for damage feedback effects
 */
export class DamageFeedbackManager {
  private static instance: DamageFeedbackManager | null = null;

  private scene: Scene | null = null;
  private config: DamageFeedbackConfig = { ...DEFAULT_CONFIG };

  // Material tracking for flash restoration
  private originalMaterials: Map<
    string,
    { materials: Map<AbstractMesh, Material | null>; timeoutId: number }
  > = new Map();

  // Damage number pool
  private damageNumberPool: DamageNumberEntry[] = [];
  private readonly maxDamageNumbers = 20;

  // Active animations for cleanup
  private activeAnimations: Map<string, Animatable[]> = new Map();

  // Screen shake callback (to be set by levels)
  private screenShakeCallback: ((intensity: number) => void) | null = null;

  // Camera reference for billboard damage numbers
  private cameraPosition: Vector3 = Vector3.Zero();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): DamageFeedbackManager {
    if (!DamageFeedbackManager.instance) {
      DamageFeedbackManager.instance = new DamageFeedbackManager();
    }
    return DamageFeedbackManager.instance;
  }

  /**
   * Initialize the damage feedback system
   */
  init(scene: Scene, config?: Partial<DamageFeedbackConfig>): void {
    this.scene = scene;
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Pre-create damage number pool
    this.initDamageNumberPool();

    console.log('[DamageFeedback] Initialized');
  }

  /**
   * Set the camera position for billboard orientation
   */
  setCameraPosition(position: Vector3): void {
    this.cameraPosition = position;
  }

  /**
   * Set the screen shake callback function
   */
  setScreenShakeCallback(callback: (intensity: number) => void): void {
    this.screenShakeCallback = callback;
  }

  /**
   * Configure the feedback system
   */
  configure(config: Partial<DamageFeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // HIT FLASH
  // ============================================================================

  /**
   * Apply a hit flash effect to a mesh or TransformNode (GLB model)
   * @param target - The mesh or transform node to flash
   * @param intensity - Flash intensity (0-1), affects color saturation
   */
  applyHitFlash(target: Mesh | TransformNode, intensity: number = 1): void {
    if (!this.config.enableHitFlash || !this.scene) return;

    const targetId = target.uniqueId.toString();

    // Cancel any existing flash on this target
    if (this.originalMaterials.has(targetId)) {
      const existing = this.originalMaterials.get(targetId)!;
      clearTimeout(existing.timeoutId);
      this.restoreMaterials(target, existing.materials);
      this.originalMaterials.delete(targetId);
    }

    // Store original materials and apply flash
    const savedMaterials = new Map<AbstractMesh, Material | null>();

    // Get all meshes to flash
    const meshes: AbstractMesh[] = [];
    if ('material' in target && target.material) {
      meshes.push(target as AbstractMesh);
    }
    const childMeshes = target.getChildMeshes();
    meshes.push(...childMeshes);

    // Calculate flash color based on intensity
    const flashColor = new Color3(
      this.config.hitFlashColor.r * intensity,
      this.config.hitFlashColor.g * intensity,
      this.config.hitFlashColor.b * intensity
    );

    for (const mesh of meshes) {
      if (mesh.material) {
        savedMaterials.set(mesh, mesh.material);

        // Apply flash by modifying material
        if (mesh.material instanceof StandardMaterial) {
          const mat = mesh.material as StandardMaterial;
          // Store original and apply flash
          const origDiffuse = mat.diffuseColor.clone();
          const origEmissive = mat.emissiveColor.clone();

          mat.diffuseColor = flashColor;
          mat.emissiveColor = flashColor.scale(0.5);

          // Schedule restoration
          const timeoutId = window.setTimeout(() => {
            mat.diffuseColor = origDiffuse;
            mat.emissiveColor = origEmissive;
            this.originalMaterials.delete(targetId);
          }, this.config.hitFlashDuration);

          this.originalMaterials.set(targetId, { materials: savedMaterials, timeoutId });
        } else {
          // For other material types, create a temporary flash material
          const flashMat = new StandardMaterial('hitFlash', this.scene!);
          flashMat.diffuseColor = flashColor;
          flashMat.emissiveColor = flashColor.scale(0.5);
          flashMat.specularColor = Color3.Black();

          savedMaterials.set(mesh, mesh.material);
          mesh.material = flashMat;

          const timeoutId = window.setTimeout(() => {
            mesh.material = savedMaterials.get(mesh) || null;
            flashMat.dispose();
            this.originalMaterials.delete(targetId);
          }, this.config.hitFlashDuration);

          this.originalMaterials.set(targetId, { materials: savedMaterials, timeoutId });
        }
      }
    }
  }

  /**
   * Restore original materials after flash
   */
  private restoreMaterials(
    target: Mesh | TransformNode,
    savedMaterials: Map<AbstractMesh, Material | null>
  ): void {
    for (const [mesh, material] of savedMaterials) {
      if (!mesh.isDisposed()) {
        mesh.material = material;
      }
    }
  }

  // ============================================================================
  // HIT KNOCKBACK / STAGGER
  // ============================================================================

  /**
   * Apply knockback/stagger effect to a mesh
   * @param target - The mesh or transform node to knockback
   * @param direction - Direction of the hit (knockback is opposite)
   * @param damage - Damage amount (affects knockback distance)
   */
  applyKnockback(target: Mesh | TransformNode, direction: Vector3, damage: number): void {
    if (!this.config.enableKnockback || !this.scene) return;

    // Calculate knockback amount
    const knockbackAmount = damage * this.config.knockbackScale;
    const knockbackDir = direction.normalize().negate();

    // Store original position
    const originalPosition = target.position.clone();
    const knockbackPosition = originalPosition.add(knockbackDir.scale(knockbackAmount));

    // Animate knockback and return
    const targetId = target.uniqueId.toString();

    // Cancel existing animations
    this.cancelAnimations(targetId);

    // Create knockback animation
    const knockbackAnim = new Animation(
      'knockback',
      'position',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    knockbackAnim.setKeys([
      { frame: 0, value: originalPosition },
      { frame: 3, value: knockbackPosition },
      { frame: 10, value: originalPosition },
    ]);

    // Apply easing for snappy feel
    const easing = new BezierCurveEase(0.2, 0.8, 0.2, 1.0);
    knockbackAnim.setEasingFunction(easing);

    const animatable = this.scene.beginDirectAnimation(target, [knockbackAnim], 0, 10, false);

    this.activeAnimations.set(targetId, [animatable]);
  }

  /**
   * Apply a simple scale punch effect (quick scale up then return)
   */
  applyScalePunch(target: Mesh | TransformNode, intensity: number = 1): void {
    if (!this.scene) return;

    const originalScale = target.scaling.clone();
    const punchScale = originalScale.scale(1 + 0.15 * intensity);

    const targetId = `${target.uniqueId}_scale`;

    // Cancel existing scale animations
    this.cancelAnimations(targetId);

    const scaleAnim = new Animation(
      'scalePunch',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: originalScale },
      { frame: 2, value: punchScale },
      { frame: 8, value: originalScale },
    ]);

    const animatable = this.scene.beginDirectAnimation(target, [scaleAnim], 0, 8, false);

    this.activeAnimations.set(targetId, [animatable]);
  }

  // ============================================================================
  // DAMAGE NUMBERS
  // ============================================================================

  /**
   * Initialize the damage number mesh pool
   */
  private initDamageNumberPool(): void {
    if (!this.scene) return;

    for (let i = 0; i < this.maxDamageNumbers; i++) {
      const mesh = MeshBuilder.CreatePlane(
        `damageNumber_${i}`,
        { width: 1.0, height: 0.5 },
        this.scene
      );
      mesh.isVisible = false;
      mesh.isPickable = false;

      // Billboard mode - always face camera
      mesh.billboardMode = 7; // BILLBOARDMODE_ALL

      // Create dynamic texture for text rendering
      const texture = new DynamicTexture(
        `damageNumberTex_${i}`,
        { width: 128, height: 64 },
        this.scene,
        false
      );

      const material = new StandardMaterial(`damageNumberMat_${i}`, this.scene);
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.emissiveColor = new Color3(1, 1, 1);
      material.disableLighting = true;
      material.backFaceCulling = false;
      material.useAlphaFromDiffuseTexture = true;
      texture.hasAlpha = true;
      mesh.material = material;

      this.damageNumberPool.push({
        mesh,
        material,
        texture,
        startTime: 0,
        startPosition: Vector3.Zero(),
        inUse: false,
      });
    }
  }

  /**
   * Show a floating damage number
   * @param position - World position to spawn the number
   * @param damage - Damage amount to display
   * @param isCritical - Whether this was a critical hit (different color/size)
   */
  showDamageNumber(position: Vector3, damage: number, isCritical: boolean = false): void {
    if (!this.config.enableDamageNumbers || !this.scene) return;

    // Find an available damage number from the pool
    const entry = this.damageNumberPool.find((e) => !e.inUse);
    if (!entry) return; // Pool exhausted

    entry.inUse = true;
    entry.startTime = performance.now();
    entry.startPosition = position.clone();

    // Position with slight random offset
    const offset = new Vector3((Math.random() - 0.5) * 0.5, 0.5, (Math.random() - 0.5) * 0.5);
    entry.mesh.position = position.add(offset);
    entry.mesh.isVisible = true;

    // Configure appearance based on damage and critical hit
    const scale = isCritical ? 1.5 : Math.min(1 + damage / 100, 1.3);
    entry.mesh.scaling.setAll(scale);

    // Color: white/yellow for normal, red for critical
    if (isCritical) {
      entry.material.emissiveColor = new Color3(1, 0.2, 0.2);
    } else if (damage >= 50) {
      entry.material.emissiveColor = new Color3(1, 0.8, 0.2);
    } else {
      entry.material.emissiveColor = new Color3(1, 1, 1);
    }

    // Create a dynamic texture for the damage number text
    this.renderDamageNumberText(entry, Math.round(damage), isCritical);
  }

  /**
   * Render damage number text onto the mesh using DynamicTexture
   */
  private renderDamageNumberText(
    entry: DamageNumberEntry,
    damage: number,
    isCritical: boolean
  ): void {
    if (!entry.texture) return;

    // Clear the texture
    const ctx = entry.texture.getContext();
    ctx.clearRect(0, 0, 128, 64);

    // Text settings
    const fontSize = isCritical ? 48 : 36;

    // Determine text color
    let textColor: string;
    if (isCritical) {
      textColor = '#FF4444';
    } else if (damage >= 50) {
      textColor = '#FFCC00';
    } else {
      textColor = '#FFFFFF';
    }

    // Draw with DynamicTexture's drawText method
    entry.texture.drawText(
      damage.toString(),
      null, // Center horizontally
      40, // Vertical position
      `bold ${fontSize}px monospace`,
      textColor,
      'transparent',
      true // Invert Y for correct orientation
    );

    // Add outline effect using native canvas context for text properties
    const nativeCtx = ctx as unknown as CanvasRenderingContext2D;
    nativeCtx.font = `bold ${fontSize}px monospace`;
    nativeCtx.textAlign = 'center';
    nativeCtx.textBaseline = 'middle';
    nativeCtx.strokeStyle = '#000000';
    nativeCtx.lineWidth = 3;
    nativeCtx.strokeText(damage.toString(), 64, 32);

    // Redraw text on top of outline
    nativeCtx.fillStyle = textColor;
    nativeCtx.fillText(damage.toString(), 64, 32);

    entry.texture.update();
  }

  /**
   * Update damage numbers (call each frame)
   */
  updateDamageNumbers(deltaTime: number): void {
    if (!this.config.enableDamageNumbers) return;

    const now = performance.now();

    for (const entry of this.damageNumberPool) {
      if (!entry.inUse) continue;

      const elapsed = now - entry.startTime;

      if (elapsed >= this.config.damageNumberDuration) {
        // Hide and return to pool
        entry.mesh.isVisible = false;
        entry.inUse = false;
        continue;
      }

      // Animate: float upward and fade out
      const progress = elapsed / this.config.damageNumberDuration;

      // Move upward
      entry.mesh.position.y =
        entry.startPosition.y + 0.5 + progress * this.config.damageNumberSpeed;

      // Fade out alpha (using material alpha)
      entry.material.alpha = 1 - progress * progress; // Ease out
    }
  }

  // ============================================================================
  // SCREEN SHAKE INTEGRATION
  // ============================================================================

  /**
   * Trigger screen shake based on damage dealt
   * @param damage - Damage amount dealt
   * @param isPlayerDamage - If true, player took damage (stronger shake)
   */
  triggerScreenShake(damage: number, isPlayerDamage: boolean = false): void {
    if (!this.config.enableScreenShake || !this.screenShakeCallback) return;

    // Calculate shake intensity
    let intensity = 0;

    if (isPlayerDamage) {
      // Player damage always shakes
      intensity = Math.min(8, 1 + damage / 10);
    } else {
      // Enemy damage only shakes above threshold
      if (damage >= this.config.screenShakeThreshold) {
        intensity =
          (damage - this.config.screenShakeThreshold) * this.config.screenShakeScale + 0.5;
        intensity = Math.min(4, intensity);
      }
    }

    if (intensity > 0) {
      this.screenShakeCallback(intensity);
    }
  }

  // ============================================================================
  // COMBINED FEEDBACK
  // ============================================================================

  /**
   * Apply all damage feedback effects at once
   * This is the main method to call when an enemy takes damage
   *
   * @param target - The enemy mesh/transform node
   * @param damage - Amount of damage dealt
   * @param hitDirection - Direction of the hit (for knockback)
   * @param isCritical - Whether this was a critical hit
   */
  applyDamageFeedback(
    target: Mesh | TransformNode,
    damage: number,
    hitDirection?: Vector3,
    isCritical: boolean = false
  ): void {
    // 1. Hit flash (intensity based on damage)
    const flashIntensity = Math.min(1, 0.5 + damage / 100);
    this.applyHitFlash(target, flashIntensity);

    // 2. Scale punch for hit reaction
    this.applyScalePunch(target, isCritical ? 1.5 : 1);

    // 3. Knockback if direction provided
    if (hitDirection && damage >= 10) {
      this.applyKnockback(target, hitDirection, damage);
    }

    // 4. Damage number
    const worldPosition = target.position || (target as TransformNode).getAbsolutePosition();
    this.showDamageNumber(worldPosition.add(new Vector3(0, 1, 0)), damage, isCritical);

    // 5. Screen shake
    this.triggerScreenShake(damage, false);
  }

  /**
   * Apply damage feedback when player takes damage
   */
  applyPlayerDamageFeedback(damage: number): void {
    this.triggerScreenShake(damage, true);
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /**
   * Cancel active animations on a target
   */
  private cancelAnimations(targetId: string): void {
    const anims = this.activeAnimations.get(targetId);
    if (anims) {
      for (const anim of anims) {
        anim.stop();
      }
      this.activeAnimations.delete(targetId);
    }
  }

  /**
   * Update loop - call each frame
   */
  update(deltaTime: number): void {
    this.updateDamageNumbers(deltaTime);
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    // Clear all pending timeouts
    for (const entry of this.originalMaterials.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.originalMaterials.clear();

    // Stop all animations
    for (const anims of this.activeAnimations.values()) {
      for (const anim of anims) {
        anim.stop();
      }
    }
    this.activeAnimations.clear();

    // Dispose damage number pool
    for (const entry of this.damageNumberPool) {
      entry.mesh.dispose();
      entry.material.dispose();
      entry.texture?.dispose();
    }
    this.damageNumberPool = [];

    this.scene = null;
    this.screenShakeCallback = null;

    DamageFeedbackManager.instance = null;

    console.log('[DamageFeedback] Disposed');
  }
}

// Export singleton accessor
export const damageFeedback = DamageFeedbackManager.getInstance();
