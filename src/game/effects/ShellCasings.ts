/**
 * ShellCasings - Physical shell casing ejection system using BabylonJS Solid Particle System
 *
 * Provides realistic brass casing ejection for all weapon types:
 * - Pool of 50 pre-allocated shell casing particles for performance
 * - Per-weapon casing configurations (size, color, ejection angle)
 * - Physics simulation: gravity, bounce on ground collision, tumbling rotation
 * - 3-second lifetime with automatic recycling
 * - Randomized ejection velocity and angular momentum
 * - Sound effect on ground impact
 *
 * Uses SPS for efficient rendering - all casings share a single draw call.
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { SolidParticle } from '@babylonjs/core/Particles/solidParticle';
import { SolidParticleSystem } from '@babylonjs/core/Particles/solidParticleSystem';
import type { Scene } from '@babylonjs/core/scene';

import { getLogger } from '../core/Logger';
import type { WeaponCategory } from '../entities/weapons';

const log = getLogger('ShellCasings');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Weapon category for casing ejection configuration
 */
export type CasingWeaponType = 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy';

/**
 * Per-weapon casing configuration
 */
export interface CasingConfig {
  /** Casing cylinder height in meters */
  height: number;
  /** Casing cylinder diameter in meters */
  diameter: number;
  /** Base color of the casing (brass, red for shotgun shells, etc.) */
  color: Color3;
  /** Specular highlight color */
  specularColor: Color3;
  /** Base ejection speed (m/s) */
  ejectionSpeed: number;
  /** Speed randomization range (+/-) */
  speedVariance: number;
  /** Upward velocity component */
  upwardVelocity: number;
  /** Base angular velocity (rad/s) for tumbling */
  angularVelocity: number;
  /** Whether to emit smoke trail (for heavy weapons) */
  hasSmokeTrail: boolean;
}

/**
 * Active shell casing state
 */
interface ActiveCasing {
  /** SPS particle reference */
  particle: SolidParticle;
  /** Current velocity vector */
  velocity: Vector3;
  /** Current angular velocity */
  angularVelocity: Vector3;
  /** Time alive in seconds */
  lifetime: number;
  /** Whether this casing slot is currently active */
  active: boolean;
  /** Has played ground impact sound */
  hasPlayedImpactSound: boolean;
  /** Bounce count for diminishing returns */
  bounceCount: number;
  /** Scale factor for this casing */
  scale: number;
}

// ---------------------------------------------------------------------------
// Configuration Constants
// ---------------------------------------------------------------------------

/** Pool size - covers rapid-fire scenarios */
const POOL_SIZE = 50;

/** How long casings persist before recycling (seconds) */
const CASING_LIFETIME = 3.0;

/** Gravity acceleration (m/s^2) */
const GRAVITY = -15;

/** Ground Y position for collision */
const GROUND_Y = 0.0;

/** Bounce coefficient (energy retained per bounce) */
const BOUNCE_COEFFICIENT = 0.3;

/** Friction coefficient (horizontal velocity retained per bounce) */
const FRICTION_COEFFICIENT = 0.7;

/** Angular dampening per bounce */
const ANGULAR_DAMPENING = 0.6;

/** Minimum velocity threshold to stop movement */
const VELOCITY_THRESHOLD = 0.5;

/** Maximum bounces before settling */
const MAX_BOUNCES = 3;

// ---------------------------------------------------------------------------
// Per-Weapon Casing Configurations
// ---------------------------------------------------------------------------

/**
 * Casing configurations for each weapon category.
 * Based on realistic cartridge dimensions scaled for game visibility.
 */
const CASING_CONFIGS: Record<CasingWeaponType, CasingConfig> = {
  // Pistols: Small brass casings, weak ejection
  pistol: {
    height: 0.019, // 19mm (9mm Luger case length)
    diameter: 0.01, // 10mm diameter
    color: new Color3(0.78, 0.57, 0.11), // Brass
    specularColor: new Color3(1, 0.9, 0.5),
    ejectionSpeed: 3.0,
    speedVariance: 1.0,
    upwardVelocity: 1.5,
    angularVelocity: 15,
    hasSmokeTrail: false,
  },

  // SMGs: Small casings, rapid ejection
  smg: {
    height: 0.019, // Same as pistol (9mm typically)
    diameter: 0.01,
    color: new Color3(0.78, 0.57, 0.11), // Brass
    specularColor: new Color3(1, 0.9, 0.5),
    ejectionSpeed: 4.0, // Slightly faster than pistol
    speedVariance: 1.5,
    upwardVelocity: 1.2,
    angularVelocity: 20, // More spin for rapid ejection
    hasSmokeTrail: false,
  },

  // Rifles: Medium brass casings, strong side ejection
  rifle: {
    height: 0.045, // 45mm (5.56 NATO case length)
    diameter: 0.01, // 10mm base diameter
    color: new Color3(0.78, 0.57, 0.11), // Brass
    specularColor: new Color3(1, 0.9, 0.5),
    ejectionSpeed: 5.0, // Strong ejection
    speedVariance: 1.5,
    upwardVelocity: 2.0,
    angularVelocity: 18,
    hasSmokeTrail: false,
  },

  // Shotguns: Large red shell casings, dramatic arc
  shotgun: {
    height: 0.07, // 70mm (12 gauge 2.75" shell)
    diameter: 0.02, // 20mm diameter
    color: new Color3(0.7, 0.15, 0.1), // Red shell
    specularColor: new Color3(0.9, 0.4, 0.3),
    ejectionSpeed: 4.5,
    speedVariance: 1.0,
    upwardVelocity: 3.0, // Higher arc for dramatic effect
    angularVelocity: 12, // Slower tumble, larger casing
    hasSmokeTrail: false,
  },

  // Heavy: Large casings with smoke trail
  heavy: {
    height: 0.08, // 80mm (large caliber)
    diameter: 0.015, // 15mm diameter
    color: new Color3(0.72, 0.52, 0.08), // Darker brass
    specularColor: new Color3(0.9, 0.8, 0.4),
    ejectionSpeed: 6.0, // Strong ejection
    speedVariance: 2.0,
    upwardVelocity: 2.5,
    angularVelocity: 10, // Slower rotation for heavy casing
    hasSmokeTrail: true,
  },
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Map WeaponCategory to CasingWeaponType
 */
export function categoryToCasingType(category: WeaponCategory): CasingWeaponType {
  switch (category) {
    case 'sidearm':
      return 'pistol';
    case 'smg':
      return 'smg';
    case 'rifle':
    case 'marksman':
      return 'rifle';
    case 'shotgun':
      return 'shotgun';
    case 'heavy':
      return 'heavy';
    default:
      return 'rifle';
  }
}

// ---------------------------------------------------------------------------
// Shell Casing System
// ---------------------------------------------------------------------------

/**
 * ShellCasingSystem - Manages shell casing ejection using BabylonJS SPS
 *
 * Uses a pre-allocated pool of solid particles for efficient rendering.
 * All casings are rendered in a single draw call.
 */
export class ShellCasingSystem {
  private static instance: ShellCasingSystem | null = null;

  private scene: Scene | null = null;
  private sps: SolidParticleSystem | null = null;
  private casings: ActiveCasing[] = [];
  private materials: Map<CasingWeaponType, StandardMaterial> = new Map();

  /** Track if any casings are active for update optimization */
  private hasActiveCasings = false;

  /** Frame observer dispose handle */
  private frameObserverDispose: (() => void) | null = null;

  /** Audio callback for impact sounds */
  private onImpactSound: ((position: Vector3, velocity: number) => void) | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ShellCasingSystem {
    if (!ShellCasingSystem.instance) {
      ShellCasingSystem.instance = new ShellCasingSystem();
    }
    return ShellCasingSystem.instance;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Initialize the shell casing system.
   * Call once after scene is ready.
   *
   * @param scene - Active BabylonJS scene
   * @param onImpactSound - Optional callback for playing impact sounds
   */
  init(scene: Scene, onImpactSound?: (position: Vector3, velocity: number) => void): void {
    this.scene = scene;
    this.onImpactSound = onImpactSound ?? null;

    // Create materials for each casing type
    this.createMaterials(scene);

    // Create the Solid Particle System
    this.sps = new SolidParticleSystem('shellCasingSPS', scene, {
      updatable: true,
      isPickable: false,
    });

    // Create a cylinder mesh for casings (rifle-sized as base)
    // Individual casing sizes are handled via particle scaling
    const casingMesh = MeshBuilder.CreateCylinder(
      'casingBase',
      {
        height: 0.045, // Base height (rifle-sized)
        diameter: 0.01, // Base diameter
        tessellation: 8, // 8-sided for performance
      },
      scene
    );

    // Add particles to the pool
    this.sps.addShape(casingMesh, POOL_SIZE);

    // Build the SPS mesh
    const spsMesh = this.sps.buildMesh();
    spsMesh.hasVertexAlpha = false;
    spsMesh.isPickable = false;
    spsMesh.checkCollisions = false;

    // Apply default brass material
    spsMesh.material = this.materials.get('rifle') ?? null;

    // Dispose the source mesh (no longer needed)
    casingMesh.dispose();

    // Initialize all particles as inactive (hidden)
    this.initParticles();

    // Register per-frame update
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.frameObserverDispose = () => {
      scene.onBeforeRenderObservable.remove(observer);
    };

    log.info(`Initialized with pool of ${POOL_SIZE} casings`);
  }

  /**
   * Create materials for different casing types
   */
  private createMaterials(scene: Scene): void {
    for (const [type, config] of Object.entries(CASING_CONFIGS)) {
      const mat = new StandardMaterial(`casingMat_${type}`, scene);
      mat.diffuseColor = config.color;
      mat.specularColor = config.specularColor;
      mat.specularPower = 64;
      mat.backFaceCulling = true;
      this.materials.set(type as CasingWeaponType, mat);
    }
  }

  /**
   * Initialize all particles in the pool
   */
  private initParticles(): void {
    if (!this.sps) return;

    for (let i = 0; i < this.sps.nbParticles; i++) {
      const p = this.sps.particles[i];
      p.isVisible = false;
      p.position.setAll(0);
      p.rotation.setAll(0);
      p.scaling.setAll(1);

      this.casings.push({
        particle: p,
        velocity: Vector3.Zero(),
        angularVelocity: Vector3.Zero(),
        lifetime: 0,
        active: false,
        hasPlayedImpactSound: false,
        bounceCount: 0,
        scale: 1,
      });
    }

    // Initial SPS update
    this.sps.setParticles();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Eject a shell casing from the weapon
   *
   * @param position - Ejection port position in world space
   * @param ejectionDirection - Direction to eject (usually right side of weapon)
   * @param weaponType - Type of weapon for casing configuration
   * @param playerVelocity - Optional player velocity to add to ejection
   */
  eject(
    position: Vector3,
    ejectionDirection: Vector3,
    weaponType: CasingWeaponType = 'rifle',
    playerVelocity: Vector3 = Vector3.Zero()
  ): void {
    if (!this.sps) return;

    // Find an inactive casing in the pool
    const casing = this.casings.find((c) => !c.active);
    if (!casing) {
      // Pool exhausted - skip this casing (player won't notice during intense action)
      return;
    }

    const config = CASING_CONFIGS[weaponType];
    const p = casing.particle;

    // Set position at weapon ejection port
    p.position.copyFrom(position);

    // Calculate ejection velocity with randomization
    const speed = config.ejectionSpeed + (Math.random() * 2 - 1) * config.speedVariance;
    const direction = ejectionDirection.normalize();

    // Base velocity in ejection direction
    casing.velocity = direction.scale(speed);

    // Add upward component
    casing.velocity.y += config.upwardVelocity + Math.random() * 0.5;

    // Add player velocity for realistic movement
    casing.velocity.addInPlace(playerVelocity.scale(0.3));

    // Random angular velocity for tumbling effect
    const angSpeed = config.angularVelocity;
    casing.angularVelocity = new Vector3(
      (Math.random() - 0.5) * angSpeed * 2,
      (Math.random() - 0.5) * angSpeed * 2,
      (Math.random() - 0.5) * angSpeed * 2
    );

    // Calculate scale based on weapon type (relative to rifle base)
    const rifleConfig = CASING_CONFIGS.rifle;
    const heightScale = config.height / rifleConfig.height;
    const diameterScale = config.diameter / rifleConfig.diameter;

    p.scaling.set(diameterScale, heightScale, diameterScale);
    casing.scale = heightScale;

    // Reset state
    casing.lifetime = 0;
    casing.active = true;
    casing.hasPlayedImpactSound = false;
    casing.bounceCount = 0;
    p.isVisible = true;

    // Random initial rotation for variety
    p.rotation.x = Math.random() * Math.PI * 2;
    p.rotation.y = Math.random() * Math.PI * 2;
    p.rotation.z = Math.random() * Math.PI * 2;

    // Apply appropriate color via vertex colors
    const color = config.color;
    p.color = new Color4(color.r, color.g, color.b, 1);

    this.hasActiveCasings = true;
  }

  /**
   * Eject a shell casing using weapon category instead of casing type
   *
   * @param position - Ejection port position
   * @param ejectionDirection - Direction to eject
   * @param category - Weapon category (will be mapped to casing type)
   * @param playerVelocity - Optional player velocity
   */
  ejectForCategory(
    position: Vector3,
    ejectionDirection: Vector3,
    category: WeaponCategory,
    playerVelocity: Vector3 = Vector3.Zero()
  ): void {
    const casingType = categoryToCasingType(category);
    this.eject(position, ejectionDirection, casingType, playerVelocity);
  }

  /**
   * Set the callback for impact sounds
   */
  setImpactSoundCallback(callback: (position: Vector3, velocity: number) => void): void {
    this.onImpactSound = callback;
  }

  /**
   * Get the number of currently active casings
   */
  getActiveCasingCount(): number {
    return this.casings.filter((c) => c.active).length;
  }

  /**
   * Check if the system has been initialized
   */
  get isInitialized(): boolean {
    return this.sps !== null;
  }

  // --------------------------------------------------------------------------
  // Update Loop
  // --------------------------------------------------------------------------

  /**
   * Per-frame update for physics simulation
   */
  private update(): void {
    if (!this.scene || !this.sps || !this.hasActiveCasings) return;

    const engine = this.scene.getEngine();
    const dt = engine.getDeltaTime() / 1000;

    // Skip degenerate frames
    if (dt <= 0 || dt > 0.25) return;

    let anyActive = false;

    for (const casing of this.casings) {
      if (!casing.active) continue;
      anyActive = true;

      const p = casing.particle;

      // Apply gravity
      casing.velocity.y += GRAVITY * dt;

      // Update position
      p.position.x += casing.velocity.x * dt;
      p.position.y += casing.velocity.y * dt;
      p.position.z += casing.velocity.z * dt;

      // Update rotation (tumbling)
      p.rotation.x += casing.angularVelocity.x * dt;
      p.rotation.y += casing.angularVelocity.y * dt;
      p.rotation.z += casing.angularVelocity.z * dt;

      // Ground collision detection
      const groundOffset = (CASING_CONFIGS.rifle.height * casing.scale) / 2;
      if (p.position.y <= GROUND_Y + groundOffset) {
        p.position.y = GROUND_Y + groundOffset;

        // Check if we should bounce
        if (Math.abs(casing.velocity.y) > VELOCITY_THRESHOLD && casing.bounceCount < MAX_BOUNCES) {
          // Bounce with energy loss
          casing.velocity.y *= -BOUNCE_COEFFICIENT;
          casing.velocity.x *= FRICTION_COEFFICIENT;
          casing.velocity.z *= FRICTION_COEFFICIENT;
          casing.angularVelocity.scaleInPlace(ANGULAR_DAMPENING);
          casing.bounceCount++;

          // Play impact sound on first bounce
          if (!casing.hasPlayedImpactSound && this.onImpactSound) {
            const impactVelocity = Math.abs(casing.velocity.y) / BOUNCE_COEFFICIENT;
            this.onImpactSound(p.position.clone(), impactVelocity);
            casing.hasPlayedImpactSound = true;
          }
        } else {
          // Stop movement when energy is low
          casing.velocity.setAll(0);
          casing.angularVelocity.setAll(0);
        }
      }

      // Update lifetime
      casing.lifetime += dt;

      // Recycle after lifetime expires
      if (casing.lifetime > CASING_LIFETIME) {
        casing.active = false;
        p.isVisible = false;
      }
    }

    // Only update SPS if there are active casings
    if (anyActive) {
      this.sps.setParticles();
    }

    this.hasActiveCasings = anyActive;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.frameObserverDispose?.();
    this.frameObserverDispose = null;

    // Dispose materials
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();

    // Dispose SPS
    this.sps?.dispose();
    this.sps = null;

    // Clear state
    this.casings = [];
    this.scene = null;
    this.onImpactSound = null;
    this.hasActiveCasings = false;

    ShellCasingSystem.instance = null;

    log.info('Disposed');
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

/**
 * Singleton accessor for the shell casing system
 */
export const shellCasings = ShellCasingSystem.getInstance();
