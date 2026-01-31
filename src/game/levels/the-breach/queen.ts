/**
 * TheBreachLevel - Queen Boss
 *
 * Contains Queen boss creation, AI, attacks, and phase management.
 * Uses GLB models from AssetManager for the queen body and claws.
 */

import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('Queen');
import {
  COLORS,
  QUEEN_MAX_HEALTH,
  QUEEN_PHASE_2_THRESHOLD,
  QUEEN_PHASE_3_THRESHOLD,
  WEAK_POINT_DAMAGE_MULTIPLIER,
  QUEEN_HEALTH_SCALING,
  QUEEN_DAMAGE_SCALING,
  QUEEN_COOLDOWN_SCALING,
  WEAK_POINT_PULSE_SPEED,
  WEAK_POINT_MIN_ALPHA,
  WEAK_POINT_MAX_ALPHA,
  QUEEN_ATTACK_DAMAGE,
} from './constants';
import { loadDifficultySetting, type DifficultyLevel } from '../../core/DifficultySettings';
import type { Queen, QueenAttackType, QueenPhase } from './types';

// GLB paths for queen body parts
const QUEEN_BODY_PATH = '/models/enemies/chitin/tentakel.glb';
const QUEEN_CLAW_PATH = '/models/environment/hive/building_claw.glb';
const QUEEN_TAIL_PATH = '/models/environment/alien-flora/alien_fern_1.glb';

// Current difficulty level for queen scaling
let currentDifficulty: DifficultyLevel = loadDifficultySetting();

/**
 * Update the difficulty level for queen scaling
 */
export function setQueenDifficulty(difficulty: DifficultyLevel): void {
  currentDifficulty = difficulty;
  log.info(`Difficulty set to: ${difficulty}`);
}

/**
 * Get scaled queen max health based on current difficulty
 */
export function getScaledQueenHealth(): number {
  const scaling = QUEEN_HEALTH_SCALING[currentDifficulty] ?? 1.0;
  return Math.round(QUEEN_MAX_HEALTH * scaling);
}

/**
 * Get scaled queen attack damage based on current difficulty
 */
export function getScaledQueenDamage(attackType: string): number {
  const baseDamage = QUEEN_ATTACK_DAMAGE[attackType] ?? 20;
  const scaling = QUEEN_DAMAGE_SCALING[currentDifficulty] ?? 1.0;
  return Math.round(baseDamage * scaling);
}

/**
 * Get scaled attack cooldown based on current difficulty
 */
export function getScaledCooldown(baseCooldown: number): number {
  const scaling = QUEEN_COOLDOWN_SCALING[currentDifficulty] ?? 1.0;
  return Math.round(baseCooldown * scaling);
}

// ============================================================================
// QUEEN ASSET PRELOADING
// ============================================================================

/**
 * Preload queen GLB models so createQueen can instance them synchronously.
 */
export async function preloadQueenModels(scene: Scene): Promise<void> {
  await Promise.all([
    AssetManager.loadAssetByPath(QUEEN_BODY_PATH, scene),
    AssetManager.loadAssetByPath(QUEEN_CLAW_PATH, scene),
    AssetManager.loadAssetByPath(QUEEN_TAIL_PATH, scene),
  ]);
  log.info('Queen GLB models preloaded');
}

// ============================================================================
// QUEEN BUILDER
// ============================================================================

/**
 * Create the Queen boss at the specified position.
 * Uses GLB models for body (tentakel), claws (building_claw), and tail (alien flora).
 * Eyes and weak point remain procedural (VFX indicator elements).
 * Queen health is scaled based on current difficulty setting.
 */
export function createQueen(scene: Scene, position: Vector3, glowLayer: GlowLayer | null): Queen {
  // Get difficulty-scaled health
  const scaledHealth = getScaledQueenHealth();
  // --- Main body (abdomen + thorax + head) from tentakel.glb ---
  const bodyNode = AssetManager.createInstanceByPath(
    QUEEN_BODY_PATH,
    'queenBody',
    scene,
    true,
    'enemy'
  );

  if (!bodyNode) {
    throw new Error('[TheBreachLevel/queen] Failed to create queen body GLB instance');
  }

  // Position and scale the full body model
  bodyNode.position.set(position.x, position.y + 2, position.z + 2);
  bodyNode.scaling.setAll(2.5);
  bodyNode.rotation.y = Math.PI; // Face the player

  // Create logical sub-nodes for animation attachment points
  // These are parented to the body so animation code can rotate them independently
  const abdomenNode = bodyNode; // Main body is the abdomen anchor
  const thoraxNode = bodyNode; // Shares the same root; animation offsets within
  const headNode = bodyNode; // Head rotation applied to top of body model

  // --- Multiple glowing eyes (VFX - remain procedural) ---
  const eyeMat = new StandardMaterial('queenEyeMat', scene);
  eyeMat.emissiveColor = new Color3(1, 0.3, 0.3);
  eyeMat.disableLighting = true;

  for (let i = 0; i < 6; i++) {
    const eye = MeshBuilder.CreateSphere(
      `queenEye_${i}`,
      { diameter: 0.15 + (i < 2 ? 0.1 : 0), segments: 8 },
      scene
    );
    eye.material = eyeMat;
    const angle = (i / 6) * Math.PI - Math.PI / 2;
    eye.position.set(Math.sin(angle) * 0.5, 0.8, Math.cos(angle) * 0.4 - 0.5);
    eye.parent = bodyNode;

    if (glowLayer) {
      glowLayer.addIncludedOnlyMesh(eye);
    }
  }

  // --- Claws (2 large manipulator arms from building_claw.glb) ---
  const claws: TransformNode[] = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const claw = AssetManager.createInstanceByPath(
      QUEEN_CLAW_PATH,
      `queenClaw_${i}`,
      scene,
      true,
      'enemy'
    );

    if (claw) {
      claw.scaling.setAll(0.6);
      claw.position.set(position.x + side * 2, position.y + 3, position.z - 0.5);
      claw.rotation.z = (side * Math.PI) / 4;
      claws.push(claw);
    }
  }

  // --- Tail (organic appendage - uses alien flora GLB) ---
  let tail: TransformNode;

  if (!AssetManager.isPathCached(QUEEN_TAIL_PATH)) {
    throw new Error(`[Queen] Tail GLB not cached: ${QUEEN_TAIL_PATH}`);
  }

  const tailNode = AssetManager.createInstanceByPath(
    QUEEN_TAIL_PATH,
    'queenTail',
    scene,
    true,
    'enemy'
  );

  if (!tailNode) {
    throw new Error('[Queen] Failed to create tail instance from cached GLB');
  }

  tailNode.position.set(position.x, position.y + 1, position.z + 6);
  tailNode.scaling.set(2.5, 3.5, 2.5); // Elongate for tail-like shape
  tailNode.rotation.set(Math.PI / 3, Math.PI, 0);
  tail = tailNode;

  // --- Weak point (VFX indicator - remains procedural, hidden initially) ---
  const weakPoint = MeshBuilder.CreateSphere(
    'queenWeakPoint',
    { diameter: 0.8, segments: 12 },
    scene
  );
  const weakPointMat = new StandardMaterial('weakPointMat', scene);
  weakPointMat.emissiveColor = Color3.FromHexString(COLORS.weakPoint);
  weakPointMat.alpha = 0.8;
  weakPointMat.disableLighting = true;
  weakPoint.material = weakPointMat;
  weakPoint.position.set(position.x, position.y + 3.5, position.z + 0.5);
  weakPoint.isVisible = false;

  if (glowLayer) {
    glowLayer.addIncludedOnlyMesh(weakPoint);
  }

  return {
    mesh: bodyNode,
    health: scaledHealth,
    maxHealth: scaledHealth,
    phase: 1,
    attackCooldown: 0,
    spawnCooldown: 0,
    weakPointMesh: weakPoint,
    weakPointVisible: false,
    weakPointTimer: 0,
    isVulnerable: false,
    attackType: 'none',
    attackTimer: 0,
    screaming: false,
    bodyParts: {
      head: headNode,
      thorax: thoraxNode,
      abdomen: abdomenNode,
      claws,
      tail,
    },
  };
}

// ============================================================================
// QUEEN AI
// ============================================================================

/**
 * Determine the next queen phase based on current health
 */
export function getQueenPhase(
  health: number,
  maxHealth: number,
  currentPhase: QueenPhase
): QueenPhase {
  const healthPercent = health / maxHealth;

  if (healthPercent <= QUEEN_PHASE_3_THRESHOLD && currentPhase === 2) {
    return 3;
  }
  if (healthPercent <= QUEEN_PHASE_2_THRESHOLD && currentPhase === 1) {
    return 2;
  }
  return currentPhase;
}

/**
 * Get available attacks for the current phase
 */
export function getAvailableAttacks(phase: QueenPhase): QueenAttackType[] {
  const attacks: QueenAttackType[] = ['acid_spit'];

  if (phase >= 2) {
    attacks.push('claw_swipe', 'tail_slam');
  }
  if (phase === 3) {
    attacks.push('ground_pound');
  }

  return attacks;
}

/**
 * Get attack cooldown multiplier based on phase
 */
export function getPhaseMultiplier(phase: QueenPhase): number {
  switch (phase) {
    case 3:
      return 0.6;
    case 2:
      return 0.8;
    default:
      return 1;
  }
}

/**
 * Get spawn cooldown for the current phase
 */
export function getSpawnCooldown(phase: QueenPhase): number {
  return phase === 3 ? 8000 : 12000;
}

/**
 * Get number of minions to spawn for the current phase
 */
export function getSpawnCount(phase: QueenPhase): number {
  return phase === 3 ? 3 : phase === 2 ? 2 : 1;
}

/**
 * Get minion type to spawn for the current phase
 */
export function getSpawnType(phase: QueenPhase): 'drone' | 'grunt' {
  return phase >= 2 ? 'grunt' : 'drone';
}

// ============================================================================
// QUEEN DAMAGE
// ============================================================================

/**
 * Calculate actual damage dealt to queen
 */
export function calculateQueenDamage(baseDamage: number, isWeakPoint: boolean): number {
  return isWeakPoint ? baseDamage * WEAK_POINT_DAMAGE_MULTIPLIER : baseDamage;
}

// ============================================================================
// QUEEN ANIMATION
// ============================================================================

/**
 * Update queen idle animations (head, claw, tail, and body movement)
 * Animation intensity increases with phase for more aggressive feel.
 */
export function animateQueen(queen: Queen, time: number): void {
  const phaseIntensity = 0.8 + queen.phase * 0.2; // 1.0, 1.2, 1.4 for phases 1, 2, 3

  // Head sway - more aggressive in later phases
  if (queen.bodyParts.head) {
    const headSway = Math.sin(time * 0.5 * phaseIntensity) * 0.1 * phaseIntensity;
    const headNod = Math.sin(time * 0.3) * 0.05;
    queen.bodyParts.head.rotation.y = Math.PI + headSway;
    queen.bodyParts.head.rotation.x = headNod;
  }

  // Claw movement - menacing flex
  for (let i = 0; i < queen.bodyParts.claws.length; i++) {
    const claw = queen.bodyParts.claws[i];
    const clawPhase = i * Math.PI; // Offset each claw
    claw.rotation.x = Math.sin(time * 0.8 * phaseIntensity + clawPhase) * 0.15 * phaseIntensity;
    claw.rotation.z = (i === 0 ? 1 : -1) * (Math.PI / 4 + Math.sin(time * 0.5 + clawPhase) * 0.1);
  }

  // Tail sway - organic movement
  if (queen.bodyParts.tail) {
    const tailSway = Math.sin(time * 0.6) * 0.2 * phaseIntensity;
    const tailWave = Math.sin(time * 1.2) * 0.1;
    queen.bodyParts.tail.rotation.y = Math.PI + tailSway;
    queen.bodyParts.tail.rotation.z = tailWave;
  }

  // Body breathing/pulsing - organic feel
  if (queen.bodyParts.abdomen) {
    const breathScale = 1 + Math.sin(time * 0.4) * 0.02 * phaseIntensity;
    queen.mesh.scaling.setAll(2.5 * breathScale);
  }

  // Weak point pulsing animation when visible
  if (queen.weakPointVisible && queen.weakPointMesh) {
    const pulseAlpha = WEAK_POINT_MIN_ALPHA +
      (WEAK_POINT_MAX_ALPHA - WEAK_POINT_MIN_ALPHA) *
      (0.5 + 0.5 * Math.sin(time * WEAK_POINT_PULSE_SPEED));
    const mat = queen.weakPointMesh.material as StandardMaterial;
    if (mat) {
      mat.alpha = pulseAlpha;
    }
    // Also pulse the size
    const pulseScale = 0.8 + 0.4 * Math.sin(time * WEAK_POINT_PULSE_SPEED);
    queen.weakPointMesh.scaling.setAll(pulseScale);
  }

  // Screaming animation when dying
  if (queen.screaming) {
    queen.mesh.rotation.x = Math.sin(time * 10) * 0.1;
    queen.mesh.rotation.z = Math.sin(time * 8) * 0.05;
  }
}

/**
 * Animate claw swipe attack with wind-up and follow-through
 */
export function animateClawSwipe(queen: Queen): void {
  const clawIndex = Math.random() < 0.5 ? 0 : 1; // Randomly choose which claw
  const claw = queen.bodyParts.claws[clawIndex];
  if (!claw) return;

  const side = clawIndex === 0 ? 1 : -1;
  const originalRotX = claw.rotation.x;
  const originalRotZ = claw.rotation.z;

  // Wind-up phase (100ms)
  claw.rotation.x = originalRotX - 0.4;
  claw.rotation.z = originalRotZ + side * 0.3;

  // Strike phase (150ms after wind-up)
  setTimeout(() => {
    claw.rotation.x = originalRotX + 0.8;
    claw.rotation.z = originalRotZ - side * 0.6;
  }, 100);

  // Recovery phase (200ms after strike)
  setTimeout(() => {
    claw.rotation.x = originalRotX;
    claw.rotation.z = originalRotZ;
  }, 350);
}

/**
 * Animate tail slam attack with wind-up and slam
 */
export function animateTailSlam(queen: Queen): void {
  if (!queen.bodyParts.tail) return;

  const tail = queen.bodyParts.tail;
  const originalRotX = tail.rotation.x;
  const originalRotY = tail.rotation.y;

  // Raise tail (wind-up)
  tail.rotation.x = originalRotX - 0.5;
  tail.rotation.y = originalRotY + 0.2;

  // Slam down
  setTimeout(() => {
    tail.rotation.x = originalRotX + 0.6;
    tail.rotation.y = originalRotY - 0.1;
  }, 300);

  // Recovery
  setTimeout(() => {
    tail.rotation.x = originalRotX;
    tail.rotation.y = originalRotY;
  }, 600);
}

/**
 * Animate ground pound attack with body raise and slam
 */
export function animateGroundPound(queen: Queen): void {
  const originalY = queen.mesh.position.y;
  const originalScale = queen.mesh.scaling.y;

  // Raise up
  queen.mesh.position.y = originalY + 2;
  queen.mesh.scaling.y = originalScale * 1.2;

  // Slam down
  setTimeout(() => {
    queen.mesh.position.y = originalY - 0.5;
    queen.mesh.scaling.y = originalScale * 0.8;
  }, 800);

  // Recovery
  setTimeout(() => {
    queen.mesh.position.y = originalY;
    queen.mesh.scaling.y = originalScale;
  }, 1200);
}

/**
 * Animate acid spit attack with head lunge
 */
export function animateAcidSpit(queen: Queen): void {
  if (!queen.bodyParts.head) return;

  const head = queen.bodyParts.head;
  const originalRotX = head.rotation.x;

  // Rear back
  head.rotation.x = originalRotX - 0.3;

  // Lunge forward (spit)
  setTimeout(() => {
    head.rotation.x = originalRotX + 0.4;
  }, 400);

  // Recovery
  setTimeout(() => {
    head.rotation.x = originalRotX;
  }, 700);
}

/**
 * Play queen awakening animation (called when boss fight starts)
 */
export function animateQueenAwakening(queen: Queen): void {
  const originalY = queen.mesh.position.y;

  // Start low
  queen.mesh.position.y = originalY - 3;
  queen.mesh.scaling.setAll(0.5);

  // Rise up dramatically over 3 seconds
  const startTime = performance.now();
  const duration = 3000;

  function animationStep(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

    queen.mesh.position.y = originalY - 3 + eased * 3;
    queen.mesh.scaling.setAll(0.5 + eased * 2);

    // Add dramatic shake
    if (progress < 0.8) {
      queen.mesh.rotation.z = Math.sin(elapsed * 0.02) * 0.05 * (1 - progress);
    } else {
      queen.mesh.rotation.z = 0;
    }

    if (progress < 1) {
      requestAnimationFrame(animationStep);
    }
  }

  requestAnimationFrame(animationStep);
}

/**
 * Play queen death animation sequence
 */
export function animateQueenDeath(queen: Queen, onComplete?: () => void): void {
  queen.screaming = true;

  const startTime = performance.now();
  const duration = 5000;
  const originalY = queen.mesh.position.y;

  function deathAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Violent shaking
    queen.mesh.rotation.x = Math.sin(elapsed * 0.03) * 0.2 * (1 - progress * 0.5);
    queen.mesh.rotation.z = Math.cos(elapsed * 0.025) * 0.15 * (1 - progress * 0.5);

    // Slowly sink and collapse
    queen.mesh.position.y = originalY - progress * 2;
    queen.mesh.scaling.y = 2.5 * (1 - progress * 0.3);

    // Claws go limp
    for (const claw of queen.bodyParts.claws) {
      claw.rotation.x = progress * 0.8;
      claw.rotation.z = claw.rotation.z * (1 - progress);
    }

    // Tail droops
    if (queen.bodyParts.tail) {
      queen.bodyParts.tail.rotation.x = Math.PI / 3 + progress * 0.5;
    }

    if (progress < 1) {
      requestAnimationFrame(deathAnimation);
    } else {
      queen.screaming = false;
      onComplete?.();
    }
  }

  requestAnimationFrame(deathAnimation);
}

// ============================================================================
// QUEEN CLEANUP
// ============================================================================

/**
 * Dispose all queen meshes and GLB instances
 */
export function disposeQueen(queen: Queen): void {
  queen.mesh.dispose();
  // head, thorax, abdomen share the same node as mesh -- already disposed
  queen.bodyParts.tail.dispose();
  for (const claw of queen.bodyParts.claws) {
    claw.dispose();
  }
  queen.weakPointMesh?.dispose();
}
