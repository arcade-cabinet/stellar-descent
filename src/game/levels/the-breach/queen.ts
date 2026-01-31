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
import {
  COLORS,
  QUEEN_MAX_HEALTH,
  QUEEN_PHASE_2_THRESHOLD,
  QUEEN_PHASE_3_THRESHOLD,
  WEAK_POINT_DAMAGE_MULTIPLIER,
} from './constants';
import type { Queen, QueenAttackType, QueenPhase } from './types';

// GLB paths for queen body parts
const QUEEN_BODY_PATH = '/models/enemies/chitin/tentakel.glb';
const QUEEN_CLAW_PATH = '/models/environment/hive/building_claw.glb';
const QUEEN_TAIL_PATH = '/models/environment/alien-flora/alien_fern_1.glb';

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
  console.log('[TheBreachLevel/queen] Queen GLB models preloaded');
}

// ============================================================================
// QUEEN BUILDER
// ============================================================================

/**
 * Create the Queen boss at the specified position.
 * Uses GLB models for body (tentakel), claws (building_claw), and tail (alien flora).
 * Eyes and weak point remain procedural (VFX indicator elements).
 */
export function createQueen(scene: Scene, position: Vector3, glowLayer: GlowLayer | null): Queen {
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
    health: QUEEN_MAX_HEALTH,
    maxHealth: QUEEN_MAX_HEALTH,
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
 * Update queen idle animations (head and claw movement)
 */
export function animateQueen(queen: Queen, time: number): void {
  if (queen.bodyParts.head) {
    queen.bodyParts.head.rotation.y = Math.PI + Math.sin(time * 0.5) * 0.1;
  }
  for (let i = 0; i < queen.bodyParts.claws.length; i++) {
    const claw = queen.bodyParts.claws[i];
    claw.rotation.x = Math.sin(time * 0.8 + i) * 0.1;
  }
}

/**
 * Animate claw swipe attack
 */
export function animateClawSwipe(queen: Queen): void {
  if (queen.bodyParts.claws[0]) {
    const claw = queen.bodyParts.claws[0];
    const originalRot = claw.rotation.z;
    claw.rotation.z = originalRot - 0.5;
    setTimeout(() => {
      claw.rotation.z = originalRot;
    }, 300);
  }
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
