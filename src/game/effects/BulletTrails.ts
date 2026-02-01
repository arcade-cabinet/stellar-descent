/**
 * BulletTrails - Bullet trail and tracer effect system
 *
 * Provides visual feedback for ballistic weapons:
 * - Bullet trails: Brief line from muzzle to impact point (fades over 100-200ms)
 * - Tracers: Every Nth round shows a brighter, longer-lasting trail
 *
 * Uses Babylon.js LinesMesh for efficient rendering.
 * Implements object pooling to avoid runtime allocations.
 *
 * @see WeaponEffects for higher-level weapon effects
 * @see ParticleManager for particle-based projectile trails
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import type { WeaponCategory } from '../entities/weapons';

const log = getLogger('BulletTrails');

// ---------------------------------------------------------------------------
// Trail Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for bullet trail appearance
 */
export interface BulletTrailConfig {
  /** Trail color (RGB) */
  color: Color3;
  /** Trail opacity (0-1) */
  opacity: number;
  /** Duration in milliseconds before fully faded */
  duration: number;
  /** Trail width/thickness */
  width: number;
  /** Whether this is a tracer (brighter, longer-lasting) */
  isTracer: boolean;
}

/**
 * Weapon-specific trail configurations
 */
export interface WeaponTrailConfig {
  /** Base trail color for this weapon type */
  trailColor: Color3;
  /** Trail duration in milliseconds */
  trailDuration: number;
  /** How many rounds between tracer rounds (0 = no tracers) */
  tracerFrequency: number;
  /** Tracer color (usually brighter than trail) */
  tracerColor: Color3;
  /** Tracer duration in milliseconds */
  tracerDuration: number;
}

/**
 * Default trail configurations by weapon category
 */
const DEFAULT_TRAIL_CONFIGS: Record<WeaponCategory, WeaponTrailConfig> = {
  melee: {
    trailColor: new Color3(1, 1, 1), // Not used
    trailDuration: 0,
    tracerFrequency: 0, // No projectiles
    tracerColor: new Color3(1, 1, 1),
    tracerDuration: 0,
  },
  sidearm: {
    trailColor: new Color3(1, 0.85, 0.3), // Yellow-orange
    trailDuration: 100,
    tracerFrequency: 0, // No tracers for pistols
    tracerColor: new Color3(1, 0.95, 0.5),
    tracerDuration: 150,
  },
  smg: {
    trailColor: new Color3(1, 0.85, 0.3), // Yellow-orange
    trailDuration: 120,
    tracerFrequency: 5, // Every 5th round
    tracerColor: new Color3(1, 0.95, 0.5),
    tracerDuration: 200,
  },
  rifle: {
    trailColor: new Color3(1, 0.8, 0.2), // Golden yellow
    trailDuration: 150,
    tracerFrequency: 4, // Every 4th round
    tracerColor: new Color3(1, 1, 0.6),
    tracerDuration: 250,
  },
  marksman: {
    trailColor: new Color3(1, 0.75, 0.15), // Darker yellow
    trailDuration: 200,
    tracerFrequency: 2, // Every 2nd round (more visible for precision)
    tracerColor: new Color3(1, 0.95, 0.4),
    tracerDuration: 300,
  },
  shotgun: {
    trailColor: new Color3(1, 0.7, 0.2), // Orange-yellow
    trailDuration: 100,
    tracerFrequency: 0, // No tracers for shotguns
    tracerColor: new Color3(1, 0.9, 0.4),
    tracerDuration: 150,
  },
  heavy: {
    trailColor: new Color3(1, 0.85, 0.25), // Bright yellow
    trailDuration: 180,
    tracerFrequency: 3, // Every 3rd round
    tracerColor: new Color3(1, 1, 0.7),
    tracerDuration: 280,
  },
  vehicle: {
    trailColor: new Color3(1, 1, 1), // Not used for vehicle yoke
    trailDuration: 0,
    tracerFrequency: 0, // No projectiles from yoke itself
    tracerColor: new Color3(1, 1, 1),
    tracerDuration: 0,
  },
};

/**
 * Special trail colors for specific weapon types
 */
const SPECIAL_TRAIL_COLORS: Record<string, WeaponTrailConfig> = {
  // Plasma weapons - blue trails
  plasma_cannon: {
    trailColor: new Color3(0.3, 0.7, 1), // Cyan-blue
    trailDuration: 200,
    tracerFrequency: 1, // Every shot is visible
    tracerColor: new Color3(0.5, 0.9, 1),
    tracerDuration: 300,
  },
  // Pulse SMG - green trails
  pulse_smg: {
    trailColor: new Color3(0.3, 1, 0.5), // Green
    trailDuration: 120,
    tracerFrequency: 4,
    tracerColor: new Color3(0.5, 1, 0.7),
    tracerDuration: 200,
  },
  // PDW - green trails
  pdw: {
    trailColor: new Color3(0.4, 0.95, 0.5), // Light green
    trailDuration: 120,
    tracerFrequency: 5,
    tracerColor: new Color3(0.6, 1, 0.7),
    tracerDuration: 200,
  },
};

// ---------------------------------------------------------------------------
// Pooled Trail Entry
// ---------------------------------------------------------------------------

/**
 * Represents a single pooled trail instance
 */
interface PooledTrail {
  /** The line mesh rendering the trail */
  mesh: LinesMesh;
  /** Whether currently in use */
  inUse: boolean;
  /** Start time for fade animation */
  startTime: number;
  /** Duration for this trail */
  duration: number;
  /** Starting opacity */
  startOpacity: number;
  /** Whether this is a tracer */
  isTracer: boolean;
}

// ---------------------------------------------------------------------------
// BulletTrailManager - Singleton
// ---------------------------------------------------------------------------

/**
 * BulletTrailManager - Manages bullet trail and tracer effects
 *
 * Features:
 * - Object pooling for efficient trail reuse
 * - Per-weapon color and duration configuration
 * - Tracer system with configurable frequency
 * - Automatic fade-out animation
 */
export class BulletTrailManager {
  private static instance: BulletTrailManager | null = null;

  private scene: Scene | null = null;
  private trailPool: PooledTrail[] = [];
  private readonly maxPoolSize = 50;

  /** Shot counters for tracer frequency tracking (per weapon category) */
  private shotCounters: Map<string, number> = new Map();

  /** Custom trail configs per weapon ID */
  private customConfigs: Map<string, WeaponTrailConfig> = new Map();

  /** Frame observer handle */
  private frameObserverDispose: (() => void) | null = null;

  /** Material for trail lines */
  private trailMaterial: StandardMaterial | null = null;
  private tracerMaterial: StandardMaterial | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): BulletTrailManager {
    if (!BulletTrailManager.instance) {
      BulletTrailManager.instance = new BulletTrailManager();
    }
    return BulletTrailManager.instance;
  }

  /**
   * Initialize the trail manager with a scene
   */
  init(scene: Scene): void {
    this.scene = scene;

    // Create shared materials for trails
    this.trailMaterial = new StandardMaterial('bulletTrailMat', scene);
    this.trailMaterial.emissiveColor = Color3.White();
    this.trailMaterial.disableLighting = true;
    this.trailMaterial.backFaceCulling = false;

    this.tracerMaterial = new StandardMaterial('tracerMat', scene);
    this.tracerMaterial.emissiveColor = Color3.White();
    this.tracerMaterial.disableLighting = true;
    this.tracerMaterial.backFaceCulling = false;

    // Pre-warm the pool
    this.preWarmPool();

    // Register frame observer for updates
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.frameObserverDispose = () => {
      scene.onBeforeRenderObservable.remove(observer);
    };

    // Initialize special weapon configs
    for (const [weaponId, config] of Object.entries(SPECIAL_TRAIL_COLORS)) {
      this.customConfigs.set(weaponId, config);
    }

    log.info('Initialized');
  }

  /**
   * Pre-create pooled trails for better runtime performance
   */
  private preWarmPool(): void {
    if (!this.scene) return;

    for (let i = 0; i < Math.min(15, this.maxPoolSize); i++) {
      this.createPooledTrail();
    }
  }

  /**
   * Create a new pooled trail entry
   */
  private createPooledTrail(): PooledTrail | null {
    if (!this.scene) return null;
    if (this.trailPool.length >= this.maxPoolSize) return null;

    // Create a simple line mesh (will be updated with actual points later)
    const points = [Vector3.Zero(), Vector3.Zero()];
    const colors = [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 0)];

    const mesh = MeshBuilder.CreateLines(
      `bulletTrail_${this.trailPool.length}`,
      {
        points,
        colors,
        updatable: true,
      },
      this.scene
    );

    mesh.isVisible = false;
    mesh.isPickable = false;

    const entry: PooledTrail = {
      mesh,
      inUse: false,
      startTime: 0,
      duration: 150,
      startOpacity: 1,
      isTracer: false,
    };

    this.trailPool.push(entry);
    return entry;
  }

  /**
   * Get the trail configuration for a weapon
   */
  getTrailConfig(weaponId: string, category: WeaponCategory): WeaponTrailConfig {
    // Check for weapon-specific config first
    if (this.customConfigs.has(weaponId)) {
      return this.customConfigs.get(weaponId)!;
    }
    // Fall back to category defaults
    return DEFAULT_TRAIL_CONFIGS[category] ?? DEFAULT_TRAIL_CONFIGS.rifle;
  }

  /**
   * Set a custom trail configuration for a specific weapon
   */
  setTrailConfig(weaponId: string, config: Partial<WeaponTrailConfig>): void {
    const existing = this.customConfigs.get(weaponId) ?? DEFAULT_TRAIL_CONFIGS.rifle;
    this.customConfigs.set(weaponId, { ...existing, ...config });
  }

  /**
   * Create a bullet trail from muzzle to impact point
   *
   * @param start - Muzzle position (world space)
   * @param end - Impact position (world space)
   * @param color - Trail color
   * @param duration - Duration in milliseconds
   * @param opacity - Starting opacity (0-1)
   */
  createTrail(
    start: Vector3,
    end: Vector3,
    color: Color3 = new Color3(1, 0.85, 0.3),
    duration: number = 150,
    opacity: number = 0.6
  ): void {
    if (!this.scene) return;

    // Get or create a trail from the pool
    let trail = this.trailPool.find((t) => !t.inUse);
    if (!trail) {
      trail = this.createPooledTrail() ?? undefined;
    }
    if (!trail) return;

    this.activateTrail(trail, start, end, color, duration, opacity, false);
  }

  /**
   * Create a bright tracer trail (longer-lasting, more visible)
   *
   * @param start - Muzzle position (world space)
   * @param end - Impact position (world space)
   * @param color - Tracer color (usually brighter)
   * @param duration - Duration in milliseconds
   */
  createTracer(
    start: Vector3,
    end: Vector3,
    color: Color3 = new Color3(1, 0.95, 0.5),
    duration: number = 250
  ): void {
    if (!this.scene) return;

    // Get or create a trail from the pool
    let trail = this.trailPool.find((t) => !t.inUse);
    if (!trail) {
      trail = this.createPooledTrail() ?? undefined;
    }
    if (!trail) return;

    // Tracers have full opacity and longer duration
    this.activateTrail(trail, start, end, color, duration, 1.0, true);
  }

  /**
   * Create a trail for a weapon shot, automatically determining if it should be a tracer
   *
   * @param start - Muzzle position
   * @param end - Impact position
   * @param weaponId - Weapon identifier
   * @param category - Weapon category
   * @returns Whether a tracer was created
   */
  createWeaponTrail(
    start: Vector3,
    end: Vector3,
    weaponId: string,
    category: WeaponCategory
  ): boolean {
    const config = this.getTrailConfig(weaponId, category);

    // Increment shot counter
    const counterKey = weaponId;
    const currentCount = (this.shotCounters.get(counterKey) ?? 0) + 1;
    this.shotCounters.set(counterKey, currentCount);

    // Determine if this should be a tracer
    const isTracer = config.tracerFrequency > 0 && currentCount % config.tracerFrequency === 0;

    if (isTracer) {
      this.createTracer(start, end, config.tracerColor, config.tracerDuration);
      return true;
    } else {
      this.createTrail(start, end, config.trailColor, config.trailDuration, 0.5);
      return false;
    }
  }

  /**
   * Activate a pooled trail with specific parameters
   */
  private activateTrail(
    trail: PooledTrail,
    start: Vector3,
    end: Vector3,
    color: Color3,
    duration: number,
    opacity: number,
    isTracer: boolean
  ): void {
    trail.inUse = true;
    trail.startTime = performance.now();
    trail.duration = duration;
    trail.startOpacity = opacity;
    trail.isTracer = isTracer;

    // Update line points and colors
    const points = [start.clone(), end.clone()];

    // Tracers are thicker (visually represented by brighter start)
    const startAlpha = isTracer ? opacity : opacity * 0.8;
    const endAlpha = isTracer ? opacity * 0.5 : opacity * 0.3;

    const colors = [
      new Color4(color.r, color.g, color.b, startAlpha),
      new Color4(color.r * 0.8, color.g * 0.8, color.b * 0.8, endAlpha),
    ];

    // Update the mesh with new geometry
    trail.mesh = MeshBuilder.CreateLines(
      trail.mesh.name,
      {
        points,
        colors,
        updatable: true,
        instance: trail.mesh,
      },
      this.scene!
    );

    trail.mesh.isVisible = true;

    // Store color for fading
    (trail as PooledTrail & { _color: Color3 })._color = color;
  }

  /**
   * Update all active trails (called each frame)
   */
  update(): void {
    const now = performance.now();

    for (const trail of this.trailPool) {
      if (!trail.inUse) continue;

      const elapsed = now - trail.startTime;
      const progress = elapsed / trail.duration;

      if (progress >= 1) {
        // Release back to pool
        trail.inUse = false;
        trail.mesh.isVisible = false;
        continue;
      }

      // Fade out the trail
      const alpha = trail.startOpacity * (1 - progress);
      const _color =
        (trail as PooledTrail & { _color?: Color3 })._color ?? new Color3(1, 0.85, 0.3);

      // Update visibility based on alpha threshold
      if (alpha < 0.05) {
        trail.mesh.isVisible = false;
        trail.inUse = false;
      }

      // Note: Line alpha is set at creation time and can't be updated per-frame
      // easily without recreating the mesh. For performance, we just hide at threshold.
      // For a more sophisticated fade, we could recreate the lines each frame,
      // but that would be expensive.
    }
  }

  /**
   * Reset shot counters (e.g., on weapon switch or reload)
   */
  resetShotCounter(weaponId?: string): void {
    if (weaponId) {
      this.shotCounters.delete(weaponId);
    } else {
      this.shotCounters.clear();
    }
  }

  /**
   * Get current shot count for a weapon
   */
  getShotCount(weaponId: string): number {
    return this.shotCounters.get(weaponId) ?? 0;
  }

  /**
   * Get statistics about the trail pool
   */
  getStats(): {
    poolSize: number;
    inUse: number;
    tracersActive: number;
  } {
    const inUse = this.trailPool.filter((t) => t.inUse);
    return {
      poolSize: this.trailPool.length,
      inUse: inUse.length,
      tracersActive: inUse.filter((t) => t.isTracer).length,
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.frameObserverDispose?.();
    this.frameObserverDispose = null;

    for (const trail of this.trailPool) {
      trail.mesh.dispose();
    }
    this.trailPool = [];

    this.trailMaterial?.dispose();
    this.trailMaterial = null;

    this.tracerMaterial?.dispose();
    this.tracerMaterial = null;

    this.shotCounters.clear();
    this.customConfigs.clear();

    this.scene = null;
    BulletTrailManager.instance = null;

    log.info('Disposed');
  }
}

// Export singleton accessor
export const bulletTrails = BulletTrailManager.getInstance();
