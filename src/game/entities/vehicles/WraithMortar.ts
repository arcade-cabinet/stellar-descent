/**
 * WraithMortar - Arcing mortar projectile system for the Wraith hover tank.
 *
 * Features:
 * - Arcing ballistic trajectory (gravity-affected parabola)
 * - Predictive aiming that leads moving targets
 * - Area-of-effect damage on impact
 * - Visual: glowing blue plasma ball with particle trail
 * - Impact crater decal (dark disc on terrain)
 * - Screen shake on nearby impact
 *
 * The mortar is fired from the Wraith's turret and follows a parabolic arc
 * toward the predicted player position. Flight time is fixed at 1.5 seconds
 * to give players a window to dodge.
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { getAudioManager } from '../../core/AudioManager';
import { createEntity, type Entity, getEntitiesInRadius, removeEntity } from '../../core/ecs';
import { particleManager } from '../../effects/ParticleManager';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

/** Duration of the mortar's arc in seconds */
export const MORTAR_FLIGHT_TIME = 1.5;

/** Charge time before firing in seconds */
export const MORTAR_CHARGE_TIME = 2.0;

/** Radius of the area-of-effect explosion */
export const MORTAR_AOE_RADIUS = 8;

/** Maximum damage at explosion center */
export const MORTAR_MAX_DAMAGE = 60;

/** Minimum damage at explosion edge */
export const MORTAR_MIN_DAMAGE = 15;

/** Peak height of the ballistic arc (world units above launch) */
const ARC_PEAK_HEIGHT = 30;

/** Size of the impact crater decal */
const CRATER_RADIUS = 3;

/** Duration the crater decal remains visible (ms) */
const CRATER_LIFETIME_MS = 15_000;

/** Screen shake intensity for nearby mortar impacts */
const IMPACT_SHAKE_INTENSITY = 6;

/** Distance within which the player feels screen shake */
const SHAKE_RANGE = 30;

// ----------------------------------------------------------------------------
// Mortar Projectile
// ----------------------------------------------------------------------------

export interface MortarProjectile {
  /** ECS entity backing this projectile */
  entity: Entity;
  /** BabylonJS root transform for the projectile visuals */
  root: TransformNode;
  /** World-space launch position */
  origin: Vector3;
  /** World-space target position (predicted) */
  target: Vector3;
  /** Elapsed time since launch (seconds) */
  elapsed: number;
  /** Total flight time (seconds) */
  flightTime: number;
  /** Whether this projectile has detonated */
  detonated: boolean;
  /** Trail particle system */
  trailParticles: ParticleSystem | null;
}

/**
 * Predict where a moving target will be after `leadTime` seconds.
 *
 * Uses a simple linear extrapolation from the target's current position
 * and velocity. Adds a small random scatter to avoid perfect accuracy.
 */
export function predictTargetPosition(
  targetPos: Vector3,
  targetVelocity: Vector3,
  leadTime: number,
  inaccuracy: number = 2.0
): Vector3 {
  const predicted = targetPos.add(targetVelocity.scale(leadTime));

  // Add inaccuracy scatter (circle on XZ plane)
  const angle = Math.random() * Math.PI * 2;
  const scatter = Math.random() * inaccuracy;
  predicted.x += Math.cos(angle) * scatter;
  predicted.z += Math.sin(angle) * scatter;

  return predicted;
}

/**
 * Evaluate the parabolic arc position at a given normalised time `t` (0..1).
 *
 * Horizontal movement is linear; vertical movement follows a parabola
 * peaking at `ARC_PEAK_HEIGHT` above the midpoint of origin and target.
 */
function evaluateArc(origin: Vector3, target: Vector3, t: number): Vector3 {
  // Linear interpolation on XZ
  const x = origin.x + (target.x - origin.x) * t;
  const z = origin.z + (target.z - origin.z) * t;

  // Parabolic Y: base linear interpolation + arc
  const baseY = origin.y + (target.y - origin.y) * t;
  // 4 * h * t * (1 - t) gives a parabola with peak h at t=0.5
  const arcY = 4 * ARC_PEAK_HEIGHT * t * (1 - t);

  return new Vector3(x, baseY + arcY, z);
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Create and launch a mortar projectile from the Wraith turret.
 *
 * @param scene       - BabylonJS scene
 * @param launchPos   - World-space position of the Wraith mortar barrel
 * @param targetPos   - Predicted impact point
 * @param flightTime  - Override for flight duration (defaults to MORTAR_FLIGHT_TIME)
 * @returns A MortarProjectile handle for the caller to update each frame
 */
export function launchMortar(
  scene: Scene,
  launchPos: Vector3,
  targetPos: Vector3,
  flightTime: number = MORTAR_FLIGHT_TIME
): MortarProjectile {
  const root = new TransformNode('wraith_mortar', scene);
  root.position = launchPos.clone();

  // --- Core plasma ball ---
  const ball = MeshBuilder.CreateSphere('mortar_core', { diameter: 1.0, segments: 10 }, scene);
  ball.parent = root;

  const coreMat = new StandardMaterial('mortar_coreMat', scene);
  coreMat.emissiveColor = Color3.FromHexString('#6688FF');
  coreMat.disableLighting = true;
  ball.material = coreMat;

  // --- Outer glow shell ---
  const glow = MeshBuilder.CreateSphere('mortar_glow', { diameter: 1.8, segments: 8 }, scene);
  glow.parent = root;

  const glowMat = new StandardMaterial('mortar_glowMat', scene);
  glowMat.emissiveColor = Color3.FromHexString('#4466DD');
  glowMat.disableLighting = true;
  glowMat.alpha = 0.35;
  glow.material = glowMat;

  // --- Trail particle system ---
  let trailParticles: ParticleSystem | null = null;
  try {
    trailParticles = new ParticleSystem('mortar_trail', 120, scene);
    trailParticles.emitter = ball;
    trailParticles.minSize = 0.15;
    trailParticles.maxSize = 0.5;
    trailParticles.minLifeTime = 0.2;
    trailParticles.maxLifeTime = 0.6;
    trailParticles.emitRate = 80;
    trailParticles.color1 = new Color4(0.4, 0.5, 1.0, 1.0);
    trailParticles.color2 = new Color4(0.2, 0.3, 0.9, 0.8);
    trailParticles.colorDead = new Color4(0.1, 0.1, 0.4, 0.0);
    trailParticles.minEmitPower = 0.3;
    trailParticles.maxEmitPower = 1.0;
    trailParticles.direction1 = new Vector3(-0.5, -0.5, -0.5);
    trailParticles.direction2 = new Vector3(0.5, 0.5, 0.5);
    trailParticles.gravity = new Vector3(0, -2, 0);
    trailParticles.start();
  } catch {
    // Particle system creation may fail in test environments
    console.warn('[WraithMortar] Could not create trail particles');
  }

  // Animate glow pulsing
  const pulseStart = performance.now();
  const animateGlow = () => {
    if (glow.isDisposed()) return;
    const elapsed = performance.now() - pulseStart;
    const pulse = 0.3 + Math.sin(elapsed * 0.01) * 0.1;
    glowMat.alpha = pulse;
    requestAnimationFrame(animateGlow);
  };
  requestAnimationFrame(animateGlow);

  // Play launch sound
  try {
    getAudioManager().play('explosion', { volume: 0.3 });
  } catch {
    // Audio may not be available in all contexts
  }

  // Create ECS entity for the mortar projectile
  const entity = createEntity({
    transform: {
      position: launchPos.clone(),
      rotation: Vector3.Zero(),
      scale: new Vector3(1, 1, 1),
    },
    velocity: {
      linear: Vector3.Zero(), // We manually interpolate along the arc
      angular: Vector3.Zero(),
      maxSpeed: 0,
    },
    renderable: {
      mesh: root,
      visible: true,
    },
    tags: {
      projectile: true,
      enemy: true,
    },
    lifetime: {
      remaining: (flightTime + 0.5) * 1000, // Grace period past flight time
      onExpire: () => {
        root.dispose();
        trailParticles?.dispose();
      },
    },
  });

  return {
    entity,
    root,
    origin: launchPos.clone(),
    target: targetPos.clone(),
    elapsed: 0,
    flightTime,
    detonated: false,
    trailParticles,
  };
}

/**
 * Update a mortar projectile's position along its arc.
 *
 * Call this every frame with deltaTime. Returns `true` when the mortar
 * has reached its target and detonated.
 */
export function updateMortar(
  mortar: MortarProjectile,
  deltaTime: number,
  scene: Scene,
  playerPos: Vector3 | null,
  onScreenShake?: (intensity: number) => void
): boolean {
  if (mortar.detonated) return true;

  mortar.elapsed += deltaTime;
  const t = Math.min(mortar.elapsed / mortar.flightTime, 1.0);

  // Evaluate position on arc
  const pos = evaluateArc(mortar.origin, mortar.target, t);
  mortar.root.position.copyFrom(pos);

  // Sync ECS transform
  if (mortar.entity.transform) {
    mortar.entity.transform.position.copyFrom(pos);
  }

  // Check for impact
  if (t >= 1.0) {
    detonateMortar(mortar, scene, playerPos, onScreenShake);
    return true;
  }

  return false;
}

/**
 * Detonate the mortar at its current position.
 *
 * Handles:
 * - AOE damage to nearby entities
 * - Explosion visual/particles
 * - Impact crater decal
 * - Screen shake notification
 */
export function detonateMortar(
  mortar: MortarProjectile,
  scene: Scene,
  playerPos: Vector3 | null,
  onScreenShake?: (intensity: number) => void
): void {
  if (mortar.detonated) return;
  mortar.detonated = true;

  const impactPos = mortar.root.position.clone();

  // --- Stop trail ---
  mortar.trailParticles?.stop();

  // --- AOE damage ---
  const affectedEntities = getEntitiesInRadius(impactPos, MORTAR_AOE_RADIUS, (e) => {
    // Damage player and allies, not other enemies
    return e.tags?.player === true || e.tags?.ally === true;
  });

  for (const target of affectedEntities) {
    if (!target.health || !target.transform) continue;

    const dist = Vector3.Distance(impactPos, target.transform.position);
    // Linear falloff from center to edge
    const falloff = 1.0 - Math.min(dist / MORTAR_AOE_RADIUS, 1.0);
    const damage = Math.round(
      MORTAR_MIN_DAMAGE + (MORTAR_MAX_DAMAGE - MORTAR_MIN_DAMAGE) * falloff
    );

    target.health.current = Math.max(0, target.health.current - damage);
  }

  // --- Screen shake based on distance to player ---
  if (playerPos && onScreenShake) {
    const distToPlayer = Vector3.Distance(impactPos, playerPos);
    if (distToPlayer < SHAKE_RANGE) {
      const shakeFalloff = 1.0 - distToPlayer / SHAKE_RANGE;
      onScreenShake(IMPACT_SHAKE_INTENSITY * shakeFalloff);
    }
  }

  // --- Explosion visual ---
  createMortarExplosion(scene, impactPos);

  // --- Impact crater decal ---
  createImpactCrater(scene, impactPos);

  // --- Sound ---
  try {
    getAudioManager().play('explosion', { volume: 0.7 });
  } catch {
    // Audio may not be available
  }

  // --- Particle burst ---
  try {
    particleManager.emitExplosion(impactPos, 2.0);
  } catch {
    // Particle manager may not be initialised
  }

  // --- Clean up projectile ---
  // Delay disposal slightly so explosion is visible
  window.setTimeout(() => {
    mortar.root.dispose();
    mortar.trailParticles?.dispose();
    removeEntity(mortar.entity);
  }, 200);
}

// ----------------------------------------------------------------------------
// Visual Helpers
// ----------------------------------------------------------------------------

/**
 * Create a multi-mesh explosion at the mortar impact point.
 * Expands and fades over ~500ms.
 */
function createMortarExplosion(scene: Scene, position: Vector3): void {
  // Core flash - bright blue/white
  const core = MeshBuilder.CreateSphere('mortar_exp_core', { diameter: 1.5 }, scene);
  core.position = position.clone();
  core.position.y += 0.5;

  const coreMat = new StandardMaterial('mortar_exp_coreMat', scene);
  coreMat.emissiveColor = Color3.FromHexString('#AACCFF');
  coreMat.disableLighting = true;
  core.material = coreMat;

  // Outer blast wave - wider, semi-transparent blue
  const blast = MeshBuilder.CreateSphere('mortar_exp_blast', { diameter: 3.0 }, scene);
  blast.position = position.clone();
  blast.position.y += 0.3;

  const blastMat = new StandardMaterial('mortar_exp_blastMat', scene);
  blastMat.emissiveColor = Color3.FromHexString('#4466FF');
  blastMat.disableLighting = true;
  blastMat.alpha = 0.6;
  blast.material = blastMat;

  // Smoke torus
  const smoke = MeshBuilder.CreateTorus(
    'mortar_exp_smoke',
    { diameter: 4, thickness: 1.5, tessellation: 16 },
    scene
  );
  smoke.position = position.clone();
  smoke.position.y += 0.2;
  smoke.rotation.x = Math.PI / 2;

  const smokeMat = new StandardMaterial('mortar_exp_smokeMat', scene);
  smokeMat.emissiveColor = Color3.FromHexString('#3344AA');
  smokeMat.disableLighting = true;
  smokeMat.alpha = 0.4;
  smoke.material = smokeMat;

  // Animate explosion
  const startTime = performance.now();
  const duration = 500;

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1.0);

    // Core: quick flash then shrink
    const coreScale = 1.0 + progress * 2.0 - progress * progress * 3.0;
    core.scaling.setAll(Math.max(0.01, coreScale));
    coreMat.alpha = 1.0 - progress;

    // Blast: expand and fade
    const blastScale = 1.0 + progress * MORTAR_AOE_RADIUS * 0.4;
    blast.scaling.setAll(blastScale);
    blastMat.alpha = 0.6 * (1.0 - progress);

    // Smoke: expand wider, fade slower
    const smokeScale = 1.0 + progress * MORTAR_AOE_RADIUS * 0.6;
    smoke.scaling.setAll(smokeScale);
    smokeMat.alpha = 0.4 * (1.0 - progress * 0.7);

    if (progress < 1.0) {
      requestAnimationFrame(animate);
    } else {
      core.dispose();
      blast.dispose();
      smoke.dispose();
      coreMat.dispose();
      blastMat.dispose();
      smokeMat.dispose();
    }
  };

  requestAnimationFrame(animate);
}

/**
 * Create a dark scorch mark on the terrain at the impact point.
 * The crater fades out after CRATER_LIFETIME_MS.
 */
function createImpactCrater(scene: Scene, position: Vector3): void {
  const crater = MeshBuilder.CreateDisc(
    'mortar_crater',
    { radius: CRATER_RADIUS, tessellation: 16 },
    scene
  );
  crater.position = position.clone();
  crater.position.y = 0.05; // Slightly above ground to avoid z-fighting
  crater.rotation.x = Math.PI / 2; // Lay flat

  const craterMat = new StandardMaterial('mortar_craterMat', scene);
  craterMat.diffuseColor = Color3.FromHexString('#111111');
  craterMat.specularColor = Color3.Black();
  craterMat.alpha = 0.6;
  craterMat.disableLighting = true;
  crater.material = craterMat;

  // Fade out over final 3 seconds of lifetime
  const fadeStart = CRATER_LIFETIME_MS - 3000;
  const craterCreated = performance.now();

  const fadeCrater = () => {
    const age = performance.now() - craterCreated;
    if (age > CRATER_LIFETIME_MS) {
      crater.dispose();
      craterMat.dispose();
      return;
    }
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / 3000;
      craterMat.alpha = 0.6 * (1.0 - fadeProgress);
    }
    requestAnimationFrame(fadeCrater);
  };

  requestAnimationFrame(fadeCrater);
}
