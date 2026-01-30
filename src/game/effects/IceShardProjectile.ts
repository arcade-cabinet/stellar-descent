/**
 * IceShardProjectile - Ranged ice crystal projectile for Ice Chitin enemies
 *
 * Features:
 *   - Elongated crystal mesh (polyhedron / cylinder hybrid)
 *   - Ice particle trail effect
 *   - On impact: frost AOE slow + damage
 *   - Shatter into small ice fragments on contact with surfaces
 *   - Can be shot out of the air by the player
 *   - Performance-aware particle count
 *
 * Integration:
 *   Call `fireIceShard(scene, origin, target, config)` from the combat system
 *   when an Ice Chitin fires its ranged attack.  The function creates the mesh,
 *   attaches a trail, and registers an ECS projectile entity.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import { createEntity, type Entity, getEntitiesInRadius, removeEntity } from '../core/ecs';
import { particleManager } from './ParticleManager';

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

export interface IceShardConfig {
  /** Base damage on direct hit. */
  damage: number;
  /** Projectile speed (units / second). */
  speed: number;
  /** Frost AOE radius on impact. */
  frostAoeRadius: number;
  /** Duration of the slow debuff in seconds applied to targets in AOE. */
  frostSlowDurationSec: number;
  /** Fraction of speed removed by the slow (0-1). */
  frostSlowFraction: number;
  /** Lifetime in milliseconds before the shard auto-destructs. */
  lifetimeMs: number;
  /** Scale multiplier (1 = default size). */
  scale: number;
  /** Whether the shard can be destroyed by player projectiles. */
  shootable: boolean;
  /** Health of the shard when shootable. */
  shardHealth: number;
}

const DEFAULT_ICE_SHARD_CONFIG: IceShardConfig = {
  damage: 12,
  speed: 28,
  frostAoeRadius: 4,
  frostSlowDurationSec: 2.5,
  frostSlowFraction: 0.35,
  lifetimeMs: 4000,
  scale: 1,
  shootable: true,
  shardHealth: 15,
};

// ---------------------------------------------------------------------------
// MESH CREATION
// ---------------------------------------------------------------------------

/**
 * Build an elongated crystal mesh for the ice shard.
 * Uses a tapered cylinder core with a polyhedron tip to emulate a
 * crystalline shape without custom geometry.
 */
function createIceShardMesh(scene: Scene, scale: number): {
  root: Mesh;
  coreMat: StandardMaterial;
  glowMat: StandardMaterial;
} {
  // Core body: tapered cylinder
  const core = MeshBuilder.CreateCylinder(
    'iceShardCore',
    {
      height: 0.9 * scale,
      diameterTop: 0.04 * scale,
      diameterBottom: 0.14 * scale,
      tessellation: 6,
    },
    scene
  );

  const coreMat = new StandardMaterial('iceShardCoreMat', scene);
  coreMat.diffuseColor = new Color3(0.65, 0.82, 0.95);
  coreMat.specularColor = new Color3(0.9, 0.95, 1.0);
  coreMat.specularPower = 128;
  coreMat.emissiveColor = new Color3(0.25, 0.45, 0.7);
  coreMat.alpha = 0.9;
  core.material = coreMat;

  // Glow shell (slightly larger, additive)
  const glowShell = MeshBuilder.CreateCylinder(
    'iceShardGlow',
    {
      height: 1.05 * scale,
      diameterTop: 0.08 * scale,
      diameterBottom: 0.2 * scale,
      tessellation: 6,
    },
    scene
  );
  glowShell.parent = core;
  glowShell.position = Vector3.Zero();

  const glowMat = new StandardMaterial('iceShardGlowMat', scene);
  glowMat.emissiveColor = new Color3(0.35, 0.65, 1.0);
  glowMat.disableLighting = true;
  glowMat.alpha = 0.25;
  glowShell.material = glowMat;

  // Crystal tip (polyhedron) at the front
  const tip = MeshBuilder.CreatePolyhedron(
    'iceShardTip',
    { type: 1, size: 0.04 * scale },
    scene
  );
  tip.parent = core;
  tip.position.y = -0.48 * scale; // Bottom of cylinder = leading edge
  tip.material = coreMat;

  return { root: core, coreMat, glowMat };
}

// ---------------------------------------------------------------------------
// TRAIL EFFECT
// ---------------------------------------------------------------------------

/**
 * Attach a continuous ice particle trail to the shard mesh.
 * Returns a dispose callback to stop the trail.
 */
function attachIceTrail(
  scene: Scene,
  shardMesh: Mesh,
  scale: number
): () => void {
  // Use the energy_trail config from ParticleManager as a starting point
  // but override colours to icy blue/white
  const trailSystem = particleManager.emit('energy_trail', Vector3.Zero(), {
    emitter: shardMesh,
    scale: scale * 0.7,
  });

  if (trailSystem) {
    // Override trail colours to ice palette
    trailSystem.color1 = new Color4(0.6, 0.85, 1.0, 0.8);
    trailSystem.color2 = new Color4(0.4, 0.7, 1.0, 0.6);
    trailSystem.colorDead = new Color4(0.2, 0.5, 0.9, 0);
  }

  return () => {
    if (trailSystem) {
      trailSystem.stop();
      // Allow particles to finish fading before dispose
      window.setTimeout(() => {
        trailSystem.dispose();
      }, 500);
    }
  };
}

// ---------------------------------------------------------------------------
// IMPACT EFFECTS
// ---------------------------------------------------------------------------

/**
 * Visual + gameplay effect on shard impact.
 * Creates a frost AOE, shatter fragments, and brief blue flash.
 */
function onIceShardImpact(
  scene: Scene,
  position: Vector3,
  config: IceShardConfig
): Entity[] {
  // Shatter fragments
  emitShatterFragments(scene, position, config.scale);

  // Frost AOE slow visual (expanding ring on ground)
  emitFrostAoeVisual(scene, position, config.frostAoeRadius);

  // Blue flash point light
  const light = new PointLight('iceImpactLight', position, scene);
  light.intensity = 3 * config.scale;
  light.range = config.frostAoeRadius * 1.5;
  light.diffuse = new Color3(0.35, 0.65, 1.0);

  const lightStart = performance.now();
  const animateLight = () => {
    const elapsed = performance.now() - lightStart;
    const progress = elapsed / 350;
    if (progress >= 1 || light.isDisposed()) {
      if (!light.isDisposed()) light.dispose();
      return;
    }
    light.intensity = 3 * config.scale * (1 - progress);
    requestAnimationFrame(animateLight);
  };
  requestAnimationFrame(animateLight);

  // Particle burst
  particleManager.emitBulletImpact(position, undefined, config.scale * 0.8);

  // Collect entities in AOE
  const hitEntities = getEntitiesInRadius(
    position,
    config.frostAoeRadius,
    (e) => e.tags?.player === true || e.tags?.ally === true
  );

  return hitEntities;
}

/**
 * Spawn small ice fragments that fly outward and fall.
 */
function emitShatterFragments(scene: Scene, position: Vector3, scale: number): void {
  const count = Math.min(8, Math.floor(4 * scale));

  const fragMat = new StandardMaterial('iceFragMat', scene);
  fragMat.diffuseColor = new Color3(0.65, 0.82, 0.95);
  fragMat.emissiveColor = new Color3(0.2, 0.35, 0.55);
  fragMat.specularPower = 128;
  fragMat.alpha = 0.85;

  for (let i = 0; i < count; i++) {
    const frag = MeshBuilder.CreatePolyhedron(
      `iceFrag_${i}`,
      { type: 1, size: 0.02 + Math.random() * 0.04 * scale },
      scene
    );
    frag.material = fragMat;
    frag.position = position.add(
      new Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.3
      )
    );

    const velocity = new Vector3(
      (Math.random() - 0.5) * 7,
      2 + Math.random() * 4,
      (Math.random() - 0.5) * 7
    );
    const angularVel = new Vector3(
      Math.random() * 10,
      Math.random() * 10,
      Math.random() * 10
    );

    const startTime = performance.now();
    const gravity = -14;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 1.5 || frag.isDisposed()) {
        if (!frag.isDisposed()) {
          fragMat.dispose();
          frag.dispose();
        }
        return;
      }

      velocity.y += gravity * (1 / 60);
      frag.position.addInPlace(velocity.scale(1 / 60));
      frag.rotation.addInPlace(angularVel.scale(1 / 60));

      if (frag.position.y < 0.02) {
        frag.position.y = 0.02;
        velocity.y *= -0.2;
        velocity.x *= 0.5;
        velocity.z *= 0.5;
        angularVel.scaleInPlace(0.6);
      }

      if (elapsed > 1.0) {
        const fade = (elapsed - 1.0) / 0.5;
        fragMat.alpha = 0.85 * (1 - fade);
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
}

/**
 * Visual: expanding blue ring on the ground indicating frost AOE.
 */
function emitFrostAoeVisual(scene: Scene, position: Vector3, radius: number): void {
  const ring = MeshBuilder.CreateTorus(
    'frostAoeRing',
    { diameter: 0.3, thickness: 0.05, tessellation: 24 },
    scene
  );
  ring.position = new Vector3(position.x, 0.05, position.z);
  ring.rotation.x = Math.PI / 2;

  const ringMat = new StandardMaterial('frostAoeRingMat', scene);
  ringMat.emissiveColor = new Color3(0.4, 0.7, 1.0);
  ringMat.disableLighting = true;
  ringMat.alpha = 0.7;
  ringMat.backFaceCulling = false;
  ring.material = ringMat;

  const startTime = performance.now();
  const duration = 500;

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = elapsed / duration;

    if (progress >= 1) {
      ring.dispose();
      ringMat.dispose();
      return;
    }

    const eased = 1 - (1 - progress) ** 2;
    ring.scaling.setAll(0.3 + eased * radius * 2);
    ringMat.alpha = 0.7 * (1 - progress);

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

// ---------------------------------------------------------------------------
// GLOW FLICKER ANIMATION
// ---------------------------------------------------------------------------

function startGlowFlicker(
  glowMat: StandardMaterial,
  shardMesh: Mesh
): () => void {
  const startTime = performance.now();
  let cancelled = false;

  const animate = () => {
    if (cancelled || shardMesh.isDisposed()) return;

    const elapsed = performance.now() - startTime;
    const flicker = 0.2 + Math.sin(elapsed * 0.02) * 0.06 + Math.random() * 0.03;
    glowMat.alpha = flicker;

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);

  return () => {
    cancelled = true;
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: FIRE ICE SHARD
// ---------------------------------------------------------------------------

/**
 * Fire an ice shard projectile from `origin` toward `targetPosition`.
 *
 * Returns the ECS Entity representing the projectile so the caller can
 * track it if needed.
 *
 * @param scene    Active BabylonJS scene.
 * @param origin   World-space spawn position.
 * @param targetPosition  World-space point the shard flies toward.
 * @param config   Optional overrides for damage, speed, etc.
 */
export function fireIceShard(
  scene: Scene,
  origin: Vector3,
  targetPosition: Vector3,
  config?: Partial<IceShardConfig>
): Entity {
  const cfg: IceShardConfig = { ...DEFAULT_ICE_SHARD_CONFIG, ...config };

  // Build mesh
  const { root: shardMesh, coreMat, glowMat } = createIceShardMesh(scene, cfg.scale);
  shardMesh.position = origin.clone();

  // Orient shard toward target
  const direction = targetPosition.subtract(origin).normalize();
  const rotationAxis = Vector3.Cross(Vector3.Up(), direction).normalize();
  const angle = Math.acos(Vector3.Dot(Vector3.Up(), direction));
  if (rotationAxis.length() > 0.001) {
    shardMesh.rotationQuaternion = Quaternion.RotationAxis(rotationAxis, angle);
  }

  // Attach trail
  const stopTrail = attachIceTrail(scene, shardMesh, cfg.scale);

  // Start glow flicker
  const stopFlicker = startGlowFlicker(glowMat, shardMesh);

  // Velocity vector
  const velocity = direction.scale(cfg.speed);

  // Cleanup materials on mesh dispose
  shardMesh.onDisposeObservable.add(() => {
    coreMat.dispose();
    glowMat.dispose();
    stopTrail();
    stopFlicker();
  });

  // ------------------------------------------------------------------
  // Impact handler - called when the shard hits something or expires
  // ------------------------------------------------------------------
  const handleImpact = (impactPos: Vector3) => {
    const hitEntities = onIceShardImpact(scene, impactPos, cfg);

    // Apply damage to the player/allies caught in the AOE
    for (const target of hitEntities) {
      if (target.health) {
        target.health.current = Math.max(0, target.health.current - cfg.damage);
      }
      // NOTE: The caller (combat system / level update loop) should also
      // apply the frost slow via FrostEffect when it detects this event.
      // We intentionally do not import FrostEffect here to avoid a
      // circular dependency; instead, the impact function returns the
      // hit entity list.
    }
  };

  // ------------------------------------------------------------------
  // Create ECS projectile entity
  // ------------------------------------------------------------------
  const entity = createEntity({
    transform: {
      position: origin.clone(),
      rotation: Vector3.Zero(),
      scale: new Vector3(1, 1, 1),
    },
    velocity: {
      linear: velocity,
      angular: Vector3.Zero(),
      maxSpeed: cfg.speed,
    },
    renderable: {
      mesh: shardMesh,
      visible: true,
    },
    tags: {
      projectile: true,
      enemy: true,
    },
    lifetime: {
      remaining: cfg.lifetimeMs,
      onExpire: () => {
        handleImpact(shardMesh.position.clone());
        shardMesh.dispose();
      },
    },
    // If shootable, give it health so player projectiles can destroy it
    ...(cfg.shootable
      ? {
          health: {
            current: cfg.shardHealth,
            max: cfg.shardHealth,
            regenRate: 0,
          },
        }
      : {}),
  });

  return entity;
}

// ---------------------------------------------------------------------------
// PUBLIC: DESTROY SHARD (shot out of the air)
// ---------------------------------------------------------------------------

/**
 * Call this when the player shoots an ice shard projectile out of the air.
 * Plays a smaller shatter effect without the frost AOE.
 */
export function destroyIceShardInAir(scene: Scene, entity: Entity): void {
  if (!entity.transform) return;

  const position = entity.transform.position.clone();

  // Small shatter fragments (no frost AOE)
  emitShatterFragments(scene, position, 0.6);

  // Brief blue flash
  const light = new PointLight('iceShardDestroyLight', position, scene);
  light.intensity = 2;
  light.range = 4;
  light.diffuse = new Color3(0.4, 0.7, 1.0);

  const lightStart = performance.now();
  const animateLight = () => {
    const elapsed = performance.now() - lightStart;
    const progress = elapsed / 200;
    if (progress >= 1 || light.isDisposed()) {
      if (!light.isDisposed()) light.dispose();
      return;
    }
    light.intensity = 2 * (1 - progress);
    requestAnimationFrame(animateLight);
  };
  requestAnimationFrame(animateLight);

  // Particle spark burst
  particleManager.emitBulletImpact(position, undefined, 0.5);

  // Clean up ECS entity
  if (entity.renderable?.mesh) {
    entity.renderable.mesh.dispose();
  }
  removeEntity(entity);
}
