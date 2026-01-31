/**
 * ImpactDecals - Pool-based decal system for bullet holes and impact marks
 *
 * Uses BabylonJS CreateDecal for dynamic objects with a pool-based approach:
 * - Per-surface decal types (metal sparks, concrete chips, organic splatter, ice cracks)
 * - Decal aging and fade-out over 30 seconds
 * - Size variation based on weapon damage
 * - Proper normal alignment to hit surface
 * - Object pooling with recycling (50-100 max on screen)
 *
 * Surface detection checks mesh metadata or material name for surface type,
 * defaulting to "metal" for unknown surfaces.
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';

const log = getLogger('ImpactDecals');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Surface types for different decal appearances
 */
export type DecalSurfaceType = 'metal' | 'concrete' | 'organic' | 'ice' | 'default';

/**
 * Configuration for a decal instance
 */
export interface DecalConfig {
  /** Base size of the decal in world units */
  baseSize: number;
  /** How long the decal lives before starting to fade (seconds) */
  lifetime: number;
  /** Duration of the fade-out phase (seconds) */
  fadeOutDuration: number;
}

/**
 * Internal tracked decal instance
 */
interface TrackedDecal {
  /** The decal mesh */
  mesh: Mesh;
  /** Time when the decal was created (performance.now()) */
  createdAt: number;
  /** Whether this decal is currently in use */
  active: boolean;
  /** Surface type for visual variation */
  surfaceType: DecalSurfaceType;
  /** The material applied to this decal */
  material: StandardMaterial;
  /** Parent mesh the decal is attached to (for dynamic object tracking) */
  parentMesh: AbstractMesh | null;
}

/**
 * Per-surface-type decal visual configuration
 */
interface SurfaceDecalStyle {
  /** Primary color of the decal */
  color: Color3;
  /** Secondary/rim color */
  rimColor: Color3;
  /** Emissive intensity (0-1) for glow effects */
  emissiveIntensity: number;
  /** Alpha/transparency */
  alpha: number;
  /** Whether to add particle sparks/debris */
  hasParticles: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of decals allowed on screen */
const MAX_DECALS = 75;

/** Default lifetime before fade begins (seconds) */
const DEFAULT_LIFETIME = 30;

/** Default fade-out duration (seconds) */
const DEFAULT_FADE_DURATION = 3;

/** Z-offset to prevent z-fighting */
const DECAL_Z_OFFSET = -2;

/** Per-surface visual styles */
const SURFACE_STYLES: Record<DecalSurfaceType, SurfaceDecalStyle> = {
  metal: {
    color: new Color3(0.15, 0.15, 0.15),
    rimColor: new Color3(0.8, 0.6, 0.3),
    emissiveIntensity: 0.1,
    alpha: 0.9,
    hasParticles: true,
  },
  concrete: {
    color: new Color3(0.3, 0.28, 0.25),
    rimColor: new Color3(0.5, 0.48, 0.45),
    emissiveIntensity: 0,
    alpha: 0.85,
    hasParticles: true,
  },
  organic: {
    color: new Color3(0.1, 0.4, 0.15),
    rimColor: new Color3(0.2, 0.6, 0.25),
    emissiveIntensity: 0.15,
    alpha: 0.9,
    hasParticles: false,
  },
  ice: {
    color: new Color3(0.7, 0.85, 0.95),
    rimColor: new Color3(0.4, 0.6, 0.8),
    emissiveIntensity: 0.2,
    alpha: 0.75,
    hasParticles: true,
  },
  default: {
    color: new Color3(0.2, 0.2, 0.2),
    rimColor: new Color3(0.4, 0.35, 0.3),
    emissiveIntensity: 0.05,
    alpha: 0.85,
    hasParticles: true,
  },
};

// ---------------------------------------------------------------------------
// ImpactDecalSystem
// ---------------------------------------------------------------------------

/**
 * Singleton system for managing impact decals with object pooling
 */
export class ImpactDecalSystem {
  private static instance: ImpactDecalSystem | null = null;

  private scene: Scene | null = null;
  private decalPool: TrackedDecal[] = [];
  private decalTextures: Map<DecalSurfaceType, DynamicTexture> = new Map();
  private frameObserverDispose: (() => void) | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ImpactDecalSystem {
    if (!ImpactDecalSystem.instance) {
      ImpactDecalSystem.instance = new ImpactDecalSystem();
    }
    return ImpactDecalSystem.instance;
  }

  /**
   * Initialize the decal system with a scene reference
   */
  init(scene: Scene): void {
    if (this.scene) {
      log.warn('Already initialized, skipping');
      return;
    }

    this.scene = scene;

    // Create procedural decal textures for each surface type
    this.createDecalTextures();

    // Register update loop for aging and fade-out
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.frameObserverDispose = () => {
      scene.onBeforeRenderObservable.remove(observer);
    };

    log.info(`Initialized with max ${MAX_DECALS} decals`);
  }

  /**
   * Create procedural decal textures for each surface type
   */
  private createDecalTextures(): void {
    if (!this.scene) return;

    for (const surfaceType of Object.keys(SURFACE_STYLES) as DecalSurfaceType[]) {
      const texture = this.createDecalTextureForSurface(surfaceType);
      this.decalTextures.set(surfaceType, texture);
    }
  }

  /**
   * Create a procedural bullet hole texture for a surface type
   */
  private createDecalTextureForSurface(surfaceType: DecalSurfaceType): DynamicTexture {
    const size = 128;
    const texture = new DynamicTexture(
      `decalTexture_${surfaceType}`,
      { width: size, height: size },
      this.scene!,
      true
    );

    const ctx = texture.getContext() as CanvasRenderingContext2D;
    const style = SURFACE_STYLES[surfaceType];

    // Clear with transparent background
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;

    // Draw based on surface type
    switch (surfaceType) {
      case 'metal':
        this.drawMetalBulletHole(ctx, centerX, centerY, size, style);
        break;
      case 'concrete':
        this.drawConcreteBulletHole(ctx, centerX, centerY, size, style);
        break;
      case 'organic':
        this.drawOrganicSplatter(ctx, centerX, centerY, size, style);
        break;
      case 'ice':
        this.drawIceCrack(ctx, centerX, centerY, size, style);
        break;
      default:
        this.drawDefaultBulletHole(ctx, centerX, centerY, size, style);
    }

    texture.update();
    texture.hasAlpha = true;
    return texture;
  }

  /**
   * Draw a metal bullet hole with a dark center and bright rim
   */
  private drawMetalBulletHole(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    style: SurfaceDecalStyle
  ): void {
    const radius = size * 0.35;

    // Outer scorch/rim
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${style.color.r * 255}, ${style.color.g * 255}, ${style.color.b * 255}, 1)`);
    gradient.addColorStop(0.5, `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.8)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark hole
    ctx.fillStyle = 'rgba(10, 10, 10, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Metallic spark marks (random scratches radiating outward)
    ctx.strokeStyle = `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.6)`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const startR = radius * 0.35;
      const endR = radius * (0.7 + Math.random() * 0.3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
      ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);
      ctx.stroke();
    }
  }

  /**
   * Draw a concrete chip/crater with dust ring
   */
  private drawConcreteBulletHole(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    style: SurfaceDecalStyle
  ): void {
    const radius = size * 0.38;

    // Dust/debris ring
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${style.color.r * 255}, ${style.color.g * 255}, ${style.color.b * 255}, 0.9)`);
    gradient.addColorStop(0.4, `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.7)`);
    gradient.addColorStop(0.8, `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.3)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Irregular crater shape
    ctx.fillStyle = `rgba(${style.color.r * 150}, ${style.color.g * 150}, ${style.color.b * 150}, 0.95)`;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = radius * 0.25 * (0.8 + Math.random() * 0.4);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw organic splatter (alien goo)
   */
  private drawOrganicSplatter(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    style: SurfaceDecalStyle
  ): void {
    const radius = size * 0.4;

    // Gooey splatter with multiple blobs
    for (let blob = 0; blob < 5; blob++) {
      const blobX = cx + (Math.random() - 0.5) * radius * 0.6;
      const blobY = cy + (Math.random() - 0.5) * radius * 0.6;
      const blobR = radius * (0.15 + Math.random() * 0.25);

      const gradient = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobR);
      gradient.addColorStop(0, `rgba(${style.color.r * 255}, ${style.color.g * 255}, ${style.color.b * 255}, 0.95)`);
      gradient.addColorStop(0.6, `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.7)`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(blobX, blobY, blobR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central darker spot
    const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.2);
    coreGradient.addColorStop(0, `rgba(${style.color.r * 100}, ${style.color.g * 200}, ${style.color.b * 100}, 0.9)`);
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw ice crack pattern
   */
  private drawIceCrack(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    style: SurfaceDecalStyle
  ): void {
    const radius = size * 0.4;

    // Central impact point
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.25);
    gradient.addColorStop(0, `rgba(${style.color.r * 255}, ${style.color.g * 255}, ${style.color.b * 255}, 0.9)`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Crack lines radiating outward
    ctx.strokeStyle = `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.8)`;
    ctx.lineWidth = 2;

    for (let i = 0; i < 6; i++) {
      const baseAngle = (i / 6) * Math.PI * 2 + Math.random() * 0.2;
      const endR = radius * (0.6 + Math.random() * 0.4);

      // Main crack
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      let currentX = cx;
      let currentY = cy;
      const segments = 4;
      for (let j = 1; j <= segments; j++) {
        const progress = j / segments;
        const deviation = (Math.random() - 0.5) * 0.3;
        const angle = baseAngle + deviation;
        const r = endR * progress;
        currentX = cx + Math.cos(angle) * r;
        currentY = cy + Math.sin(angle) * r;
        ctx.lineTo(currentX, currentY);
      }
      ctx.stroke();

      // Branch cracks
      if (Math.random() > 0.5) {
        const branchAngle = baseAngle + (Math.random() - 0.5) * 0.8;
        const branchStart = radius * 0.3;
        const branchEnd = radius * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(baseAngle) * branchStart, cy + Math.sin(baseAngle) * branchStart);
        ctx.lineTo(cx + Math.cos(branchAngle) * branchEnd, cy + Math.sin(branchAngle) * branchEnd);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw a default bullet hole
   */
  private drawDefaultBulletHole(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    style: SurfaceDecalStyle
  ): void {
    const radius = size * 0.35;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${style.color.r * 255}, ${style.color.g * 255}, ${style.color.b * 255}, 0.95)`);
    gradient.addColorStop(0.5, `rgba(${style.rimColor.r * 255}, ${style.rimColor.g * 255}, ${style.rimColor.b * 255}, 0.6)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Dark center
    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Detect surface type from mesh metadata or material name
   */
  detectSurfaceType(mesh: AbstractMesh): DecalSurfaceType {
    // Check mesh metadata first
    if (mesh.metadata?.surfaceType) {
      const type = mesh.metadata.surfaceType as string;
      if (type in SURFACE_STYLES) {
        return type as DecalSurfaceType;
      }
    }

    // Check material name
    const material = mesh.material;
    if (material) {
      const name = material.name.toLowerCase();

      if (name.includes('metal') || name.includes('steel') || name.includes('iron')) {
        return 'metal';
      }
      if (name.includes('concrete') || name.includes('stone') || name.includes('rock')) {
        return 'concrete';
      }
      if (name.includes('organic') || name.includes('flesh') || name.includes('alien') || name.includes('chitin')) {
        return 'organic';
      }
      if (name.includes('ice') || name.includes('snow') || name.includes('frost')) {
        return 'ice';
      }
    }

    // Check mesh name as fallback
    const meshName = mesh.name.toLowerCase();
    if (meshName.includes('metal') || meshName.includes('floor') || meshName.includes('wall')) {
      return 'metal';
    }
    if (meshName.includes('ground') || meshName.includes('terrain')) {
      return 'concrete';
    }
    if (meshName.includes('enemy') || meshName.includes('alien')) {
      return 'organic';
    }
    if (meshName.includes('ice')) {
      return 'ice';
    }

    // Default to metal for unknown surfaces
    return 'metal';
  }

  /**
   * Create a decal at the specified impact point
   *
   * @param targetMesh - The mesh to project the decal onto
   * @param position - World position of the impact
   * @param normal - Surface normal at the impact point
   * @param options - Optional configuration
   */
  createDecal(
    targetMesh: AbstractMesh,
    position: Vector3,
    normal: Vector3,
    options?: {
      surfaceType?: DecalSurfaceType;
      damage?: number;
      size?: number;
    }
  ): void {
    if (!this.scene) {
      log.warn('Not initialized');
      return;
    }

    // Detect or use provided surface type
    const surfaceType = options?.surfaceType ?? this.detectSurfaceType(targetMesh);

    // Calculate size based on damage (higher damage = larger decal)
    const baseDamage = options?.damage ?? 25;
    const damageScale = Math.min(1.5, 0.7 + (baseDamage / 100));
    const baseSize = options?.size ?? 0.12;
    const size = baseSize * damageScale * (0.9 + Math.random() * 0.2);

    // Get or recycle a decal
    const decal = this.getOrCreateDecal(surfaceType);
    if (!decal) {
      log.warn('Could not create decal - pool exhausted');
      return;
    }

    // Create the decal mesh using BabylonJS CreateDecal
    const decalSize = new Vector3(size, size, size);

    try {
      // Dispose old mesh if reusing
      if (decal.mesh && !decal.mesh.isDisposed()) {
        decal.mesh.dispose();
      }

      // Create new decal projected onto target mesh
      const newMesh = MeshBuilder.CreateDecal('impactDecal', targetMesh as Mesh, {
        position: position,
        normal: normal,
        size: decalSize,
        angle: Math.random() * Math.PI * 2, // Random rotation for variety
        cullBackFaces: true,
      });

      // Apply material
      const material = this.createDecalMaterial(surfaceType);
      newMesh.material = material;

      // Update tracked decal
      decal.mesh = newMesh;
      decal.material = material;
      decal.createdAt = performance.now();
      decal.active = true;
      decal.surfaceType = surfaceType;
      decal.parentMesh = targetMesh;
    } catch (error) {
      // CreateDecal can fail on complex geometry - handle gracefully
      log.debug('Failed to create decal on mesh:', targetMesh.name, error);
      decal.active = false;
    }
  }

  /**
   * Get an available decal from pool or create a new one
   */
  private getOrCreateDecal(surfaceType: DecalSurfaceType): TrackedDecal | null {
    // Try to find an inactive decal
    for (const decal of this.decalPool) {
      if (!decal.active) {
        return decal;
      }
    }

    // If pool is full, recycle the oldest
    if (this.decalPool.length >= MAX_DECALS) {
      let oldest = this.decalPool[0];
      for (const decal of this.decalPool) {
        if (decal.createdAt < oldest.createdAt) {
          oldest = decal;
        }
      }

      // Clean up the oldest decal for reuse
      if (oldest.mesh && !oldest.mesh.isDisposed()) {
        oldest.mesh.dispose();
      }
      if (oldest.material) {
        try {
          oldest.material.dispose();
        } catch {
          // Material may already be disposed
        }
      }

      return oldest;
    }

    // Create new tracked decal entry
    const newDecal: TrackedDecal = {
      mesh: null as unknown as Mesh,
      material: null as unknown as StandardMaterial,
      createdAt: 0,
      active: false,
      surfaceType: surfaceType,
      parentMesh: null,
    };

    this.decalPool.push(newDecal);
    return newDecal;
  }

  /**
   * Create a material for the decal
   */
  private createDecalMaterial(surfaceType: DecalSurfaceType): StandardMaterial {
    if (!this.scene) {
      throw new Error('Scene not initialized');
    }

    const style = SURFACE_STYLES[surfaceType];
    const material = new StandardMaterial(`decalMat_${Date.now()}`, this.scene);

    // Apply texture
    const texture = this.decalTextures.get(surfaceType);
    if (texture) {
      material.diffuseTexture = texture;
      material.diffuseTexture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
    }

    // Material settings
    material.diffuseColor = style.color;
    material.emissiveColor = style.rimColor.scale(style.emissiveIntensity);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    material.alpha = style.alpha;
    material.zOffset = DECAL_Z_OFFSET;
    material.backFaceCulling = true;

    return material;
  }

  /**
   * Update loop - handle aging and fade-out
   */
  private update(): void {
    const now = performance.now();
    const lifetimeMs = DEFAULT_LIFETIME * 1000;
    const fadeDurationMs = DEFAULT_FADE_DURATION * 1000;

    for (const decal of this.decalPool) {
      if (!decal.active) continue;

      const age = now - decal.createdAt;

      // Check if decal has exceeded its lifetime
      if (age > lifetimeMs + fadeDurationMs) {
        // Dispose and mark inactive
        if (decal.mesh && !decal.mesh.isDisposed()) {
          decal.mesh.dispose();
        }
        if (decal.material) {
          try {
            decal.material.dispose();
          } catch {
            // Material may already be disposed
          }
        }
        decal.active = false;
        decal.parentMesh = null;
        continue;
      }

      // Apply fade-out during the fade phase
      if (age > lifetimeMs) {
        const fadeProgress = (age - lifetimeMs) / fadeDurationMs;
        const alpha = SURFACE_STYLES[decal.surfaceType].alpha * (1 - fadeProgress);

        if (decal.material) {
          try {
            decal.material.alpha = Math.max(0, alpha);
          } catch {
            // Material may already be disposed
          }
        }
      }

      // Check if parent mesh was disposed (dynamic object destroyed)
      if (decal.parentMesh && decal.parentMesh.isDisposed()) {
        if (decal.mesh && !decal.mesh.isDisposed()) {
          decal.mesh.dispose();
        }
        if (decal.material) {
          try {
            decal.material.dispose();
          } catch {
            // Material may already be disposed
          }
        }
        decal.active = false;
        decal.parentMesh = null;
      }
    }
  }

  /**
   * Get statistics about the decal pool
   */
  getStats(): { poolSize: number; activeCount: number; maxDecals: number } {
    const activeCount = this.decalPool.filter((d) => d.active).length;
    return {
      poolSize: this.decalPool.length,
      activeCount,
      maxDecals: MAX_DECALS,
    };
  }

  /**
   * Clear all decals
   */
  clearAll(): void {
    for (const decal of this.decalPool) {
      if (decal.mesh && !decal.mesh.isDisposed()) {
        decal.mesh.dispose();
      }
      if (decal.material) {
        try {
          decal.material.dispose();
        } catch {
          // Material may already be disposed
        }
      }
      decal.active = false;
      decal.parentMesh = null;
    }
    this.decalPool = [];
    log.info('Cleared all decals');
  }

  /**
   * Dispose the decal system
   */
  dispose(): void {
    this.clearAll();

    this.frameObserverDispose?.();
    this.frameObserverDispose = null;

    // Dispose textures
    for (const texture of this.decalTextures.values()) {
      texture.dispose();
    }
    this.decalTextures.clear();

    this.scene = null;
    ImpactDecalSystem.instance = null;

    log.info('Disposed');
  }
}

// Export singleton accessor
export const impactDecals = ImpactDecalSystem.getInstance();

/**
 * Convenience function to create an impact decal
 */
export function createImpactDecal(
  targetMesh: AbstractMesh,
  position: Vector3,
  normal: Vector3,
  options?: {
    surfaceType?: DecalSurfaceType;
    damage?: number;
    size?: number;
  }
): void {
  impactDecals.createDecal(targetMesh, position, normal, options);
}

/**
 * Get the detected surface type for a mesh
 */
export function detectMeshSurfaceType(mesh: AbstractMesh): DecalSurfaceType {
  return impactDecals.detectSurfaceType(mesh);
}
