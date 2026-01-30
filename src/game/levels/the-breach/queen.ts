/**
 * TheBreachLevel - Queen Boss
 *
 * Contains Queen boss creation, AI, attacks, and phase management.
 */

import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import {
  COLORS,
  QUEEN_MAX_HEALTH,
  QUEEN_PHASE_2_THRESHOLD,
  QUEEN_PHASE_3_THRESHOLD,
  WEAK_POINT_DAMAGE_MULTIPLIER,
} from './constants';
import type { Queen, QueenAttackType, QueenPhase } from './types';

// ============================================================================
// QUEEN BUILDER
// ============================================================================

/**
 * Create the Queen boss at the specified position
 */
export function createQueen(scene: Scene, position: Vector3, glowLayer: GlowLayer | null): Queen {
  const queenMat = new StandardMaterial('queenMat', scene);
  queenMat.diffuseColor = Color3.FromHexString(COLORS.queenPurple);
  queenMat.specularColor = new Color3(0.3, 0.2, 0.4);

  // Abdomen (huge, embedded in wall)
  const abdomen = MeshBuilder.CreateSphere(
    'queenAbdomen',
    {
      diameterX: 6,
      diameterY: 4,
      diameterZ: 8,
      segments: 16,
    },
    scene
  );
  abdomen.material = queenMat;
  abdomen.position.set(position.x, position.y + 2, position.z + 4);

  // Thorax
  const thorax = MeshBuilder.CreateCylinder(
    'queenThorax',
    {
      height: 2.5,
      diameterTop: 1.5,
      diameterBottom: 2.5,
      tessellation: 12,
    },
    scene
  );
  thorax.material = queenMat;
  thorax.position.set(position.x, position.y + 3, position.z);
  thorax.rotation.x = -0.3;

  // Head
  const head = MeshBuilder.CreateSphere(
    'queenHead',
    {
      diameterX: 1.5,
      diameterY: 1.2,
      diameterZ: 1.5,
      segments: 12,
    },
    scene
  );
  head.material = queenMat;
  head.position.set(position.x, position.y + 4.5, position.z - 1);

  // Multiple glowing eyes
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
    eye.position.set(Math.sin(angle) * 0.5, 0.2, Math.cos(angle) * 0.4 - 0.5);
    eye.parent = head;

    if (glowLayer) {
      glowLayer.addIncludedOnlyMesh(eye);
    }
  }

  // Claws (2 large manipulator arms)
  const claws: Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const claw = MeshBuilder.CreateCylinder(
      `queenClaw_${i}`,
      {
        height: 3,
        diameterTop: 0.2,
        diameterBottom: 0.4,
        tessellation: 8,
      },
      scene
    );
    claw.material = queenMat;
    claw.position.set(position.x + side * 2, position.y + 3, position.z - 0.5);
    claw.rotation.z = (side * Math.PI) / 4;
    claws.push(claw);
  }

  // Tail
  const tail = MeshBuilder.CreateCylinder(
    'queenTail',
    {
      height: 4,
      diameterTop: 0.3,
      diameterBottom: 0.8,
      tessellation: 8,
    },
    scene
  );
  tail.material = queenMat;
  tail.position.set(position.x, position.y + 1, position.z + 6);
  tail.rotation.x = Math.PI / 3;

  // Weak point (hidden initially)
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
    mesh: thorax,
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
      head,
      thorax,
      abdomen,
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
    queen.bodyParts.head.rotation.y = Math.sin(time * 0.5) * 0.1;
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
 * Dispose all queen meshes
 */
export function disposeQueen(queen: Queen): void {
  queen.mesh.dispose();
  queen.bodyParts.head.dispose();
  queen.bodyParts.thorax.dispose();
  queen.bodyParts.abdomen.dispose();
  queen.bodyParts.tail.dispose();
  for (const claw of queen.bodyParts.claws) {
    claw.dispose();
  }
  queen.weakPointMesh?.dispose();
}
