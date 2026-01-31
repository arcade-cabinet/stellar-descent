/**
 * TheBreachLevel - Queen Boss
 *
 * Contains Queen boss creation, AI, attacks, and phase management.
 * Uses GLB models from AssetManager for the queen body and claws.
 *
 * ATTACK PATTERNS:
 *
 * Phase 1 (100-66% health): Basic attacks
 * - Acid Spray: Cone of acid projectiles (5 projectiles, 30 degree spread)
 * - Tail Swipe: Melee damage in frontal arc when player close
 * - Screech: Stuns player briefly, summons 2 skitterers
 * - Attack cooldown: 3 seconds between attacks
 *
 * Phase 2 (66-33% health): Aggressive attacks + minion spawns
 * - All Phase 1 attacks with 2.5s cooldown
 * - Egg Burst: Spawns 4 spitters from egg sacs on arena walls
 * - Charge: Rushes toward player, deals heavy damage on contact
 * - Poison Cloud: Area denial, damages player over time
 *
 * Phase 3 (33-0% health): Enraged, all attacks faster
 * - All attacks with 1.5s cooldown
 * - Frenzy: Rapid consecutive attacks (3 in a row)
 * - Death Throes: At 10% health, continuous spawns + faster attacks
 * - Weak points glow brighter, easier to hit
 *
 * WEAK POINT SYSTEM:
 * - 3 weak points: Head, Thorax, Egg Sac
 * - Each takes 2x damage when hit
 * - Visual feedback when weak point hit (flash, particle burst)
 * - Weak point destruction triggers stagger (2s vulnerability)
 */

import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';
import { getEventBus } from '../../core/EventBus';

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
  QUEEN_PHASE_COOLDOWNS,
  QUEEN_STAGGER_DURATION,
  QUEEN_PHASE_TRANSITION_DURATION,
  QUEEN_DEATH_THROES_THRESHOLD,
  QUEEN_WEAK_POINT_HEALTH,
  QUEEN_WEAK_POINT_MULTIPLIERS,
  QUEEN_WEAK_POINT_GLOW,
  ACID_SPRAY_PROJECTILE_COUNT,
  ACID_SPRAY_SPREAD_ANGLE,
  QUEEN_CHARGE_SPEED,
  QUEEN_CHARGE_RADIUS,
  QUEEN_CHARGE_RETURN_TIME,
  QUEEN_SCREECH_STUN_DURATION,
  QUEEN_SCREECH_SPAWN_COUNT,
  QUEEN_POISON_CLOUD_RADIUS,
  QUEEN_POISON_CLOUD_DURATION,
  QUEEN_FRENZY_ATTACK_COUNT,
  QUEEN_FRENZY_ATTACK_DELAY,
  QUEEN_EGG_BURST_SPAWN_COUNT,
  QUEEN_DEATH_SLOWMO_DURATION,
  QUEEN_DEATH_SLOWMO_SCALE,
} from './constants';
import { loadDifficultySetting, type DifficultyLevel } from '../../core/DifficultySettings';
import type {
  Queen,
  QueenAttackType,
  QueenPhase,
  QueenWeakPoint,
  QueenWeakPointId,
  QueenAIState,
} from './types';

// GLB paths for queen body parts
const QUEEN_BODY_PATH = '/models/enemies/chitin/tentakel.glb';
const QUEEN_CLAW_PATH = '/models/environment/hive/building_claw.glb';
const QUEEN_TAIL_PATH = '/models/environment/alien-flora/alien_fern_1.glb';

// Current difficulty level for queen scaling
let currentDifficulty: DifficultyLevel = loadDifficultySetting();

// ============================================================================
// GAME EVENT TYPES FOR QUEEN
// ============================================================================

/**
 * Queen-specific event types emitted through EventBus
 */
export type QueenEventType =
  | 'QUEEN_PHASE_CHANGE'
  | 'QUEEN_ATTACK_START'
  | 'QUEEN_ATTACK_END'
  | 'QUEEN_WEAK_POINT_HIT'
  | 'QUEEN_WEAK_POINT_DESTROYED'
  | 'QUEEN_STAGGER_START'
  | 'QUEEN_STAGGER_END'
  | 'QUEEN_DEATH'
  | 'QUEEN_SPAWN_MINIONS';

// ============================================================================
// DIFFICULTY SCALING
// ============================================================================

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
// WEAK POINT CREATION
// ============================================================================

/**
 * Create a weak point mesh at the specified offset from the queen body
 */
function createWeakPoint(
  scene: Scene,
  id: QueenWeakPointId,
  parentNode: TransformNode,
  offset: Vector3,
  diameter: number,
  glowLayer: GlowLayer | null
): QueenWeakPoint {
  const mesh = MeshBuilder.CreateSphere(
    `queenWeakPoint_${id}`,
    { diameter, segments: 12 },
    scene
  );

  const mat = new StandardMaterial(`weakPointMat_${id}`, scene);
  mat.emissiveColor = Color3.FromHexString(COLORS.weakPoint);
  mat.alpha = 0.8;
  mat.disableLighting = true;
  mesh.material = mat;
  mesh.position = offset;
  mesh.parent = parentNode;
  mesh.isVisible = false; // Hidden until scan reveals it

  if (glowLayer) {
    glowLayer.addIncludedOnlyMesh(mesh);
  }

  return {
    id,
    mesh,
    isDestroyed: false,
    health: QUEEN_WEAK_POINT_HEALTH[id] ?? 300,
    maxHealth: QUEEN_WEAK_POINT_HEALTH[id] ?? 300,
    damageMultiplier: QUEEN_WEAK_POINT_MULTIPLIERS[id] ?? 2.0,
    glowIntensity: QUEEN_WEAK_POINT_GLOW[1],
  };
}

/**
 * Create all three weak points for the queen
 */
function createWeakPoints(
  scene: Scene,
  bodyNode: TransformNode,
  glowLayer: GlowLayer | null
): QueenWeakPoint[] {
  return [
    // Head weak point - at the front/top
    createWeakPoint(
      scene,
      'head',
      bodyNode,
      new Vector3(0, 1.2, -0.8),
      0.6,
      glowLayer
    ),
    // Thorax weak point - center mass
    createWeakPoint(
      scene,
      'thorax',
      bodyNode,
      new Vector3(0, 0.5, 0.3),
      0.8,
      glowLayer
    ),
    // Egg sac weak point - rear/lower
    createWeakPoint(
      scene,
      'egg_sac',
      bodyNode,
      new Vector3(0, -0.2, 1.5),
      1.0,
      glowLayer
    ),
  ];
}

// ============================================================================
// QUEEN BUILDER
// ============================================================================

/**
 * Create initial AI state for the queen
 */
function createInitialAIState(): QueenAIState {
  return {
    currentAttack: 'none',
    attackAnimationTimer: 0,
    frenzyAttacksRemaining: 0,
    isFrenzied: false,
    isCharging: false,
    chargeTarget: null,
    chargeVelocity: null,
    isStaggered: false,
    staggerTimer: 0,
    deathThroesActive: false,
    deathThroesTimer: 0,
    totalDamageDealt: 0,
  };
}

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

  // --- Create all weak points ---
  const weakPoints = createWeakPoints(scene, bodyNode, glowLayer);

  // --- Legacy weak point (for backwards compatibility with scan system) ---
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
    weakPoints,
    aiState: createInitialAIState(),
    homePosition: position.clone(),
  };
}

// ============================================================================
// QUEEN AI - PHASE MANAGEMENT
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
 * Check if queen should enter death throes mode
 */
export function shouldEnterDeathThroes(health: number, maxHealth: number): boolean {
  return health / maxHealth <= QUEEN_DEATH_THROES_THRESHOLD;
}

/**
 * Get available attacks for the current phase
 */
export function getAvailableAttacks(phase: QueenPhase): QueenAttackType[] {
  // Phase 1: Basic attacks
  const phase1Attacks: QueenAttackType[] = ['acid_spray', 'tail_swipe', 'screech'];

  if (phase === 1) {
    return phase1Attacks;
  }

  // Phase 2: Add aggressive attacks
  const phase2Attacks: QueenAttackType[] = [...phase1Attacks, 'egg_burst', 'charge', 'poison_cloud'];

  if (phase === 2) {
    return phase2Attacks;
  }

  // Phase 3: All attacks + frenzy
  return [...phase2Attacks, 'frenzy'];
}

/**
 * Get attack cooldown for the current phase
 */
export function getPhaseAttackCooldown(phase: QueenPhase): number {
  const baseCooldown = QUEEN_PHASE_COOLDOWNS[phase] ?? 3000;
  return getScaledCooldown(baseCooldown);
}

/**
 * Get attack cooldown multiplier based on phase (legacy compatibility)
 */
export function getPhaseMultiplier(phase: QueenPhase): number {
  switch (phase) {
    case 3:
      return 0.5; // 50% cooldown in phase 3
    case 2:
      return 0.75; // 75% cooldown in phase 2
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
// QUEEN AI - ATTACK SELECTION
// ============================================================================

/**
 * Select the next attack based on player distance and phase
 */
export function selectNextAttack(
  queen: Queen,
  playerPosition: Vector3,
  deltaTime: number
): QueenAttackType {
  // Can't attack while staggered
  if (queen.aiState.isStaggered) {
    return 'none';
  }

  // If in frenzy, continue combo
  if (queen.aiState.isFrenzied && queen.aiState.frenzyAttacksRemaining > 0) {
    return 'frenzy';
  }

  const playerDist = Vector3.Distance(playerPosition, queen.mesh.position);
  const availableAttacks = getAvailableAttacks(queen.phase);

  // Close range: prefer melee attacks
  if (playerDist < 8) {
    // 60% chance for tail swipe, 20% frenzy in phase 3, 20% other
    const roll = Math.random();
    if (roll < 0.6 && availableAttacks.includes('tail_swipe')) {
      return 'tail_swipe';
    }
    if (roll < 0.8 && queen.phase === 3 && availableAttacks.includes('frenzy')) {
      return 'frenzy';
    }
  }

  // Medium range: charge or ranged attacks
  if (playerDist >= 8 && playerDist < 20) {
    const roll = Math.random();
    // Phase 2+: 30% chance to charge
    if (roll < 0.3 && availableAttacks.includes('charge')) {
      return 'charge';
    }
    // 40% chance for acid spray
    if (roll < 0.7 && availableAttacks.includes('acid_spray')) {
      return 'acid_spray';
    }
  }

  // Long range or random fallback
  const roll = Math.random();

  // Screech periodically to summon minions
  if (roll < 0.15 && availableAttacks.includes('screech')) {
    return 'screech';
  }

  // Egg burst periodically in phase 2+
  if (roll < 0.25 && availableAttacks.includes('egg_burst')) {
    return 'egg_burst';
  }

  // Poison cloud for area denial
  if (roll < 0.35 && availableAttacks.includes('poison_cloud')) {
    return 'poison_cloud';
  }

  // Default to acid spray
  if (availableAttacks.includes('acid_spray')) {
    return 'acid_spray';
  }

  // Fallback
  return availableAttacks[Math.floor(Math.random() * availableAttacks.length)];
}

// ============================================================================
// QUEEN DAMAGE - WEAK POINT SYSTEM
// ============================================================================

/**
 * Check if a position hits any weak point
 * Returns the weak point if hit, null otherwise
 */
export function checkWeakPointHit(
  queen: Queen,
  hitPosition: Vector3
): QueenWeakPoint | null {
  if (!queen.weakPointVisible) {
    return null;
  }

  for (const wp of queen.weakPoints) {
    if (wp.isDestroyed) continue;

    const wpWorldPos = wp.mesh.getAbsolutePosition();
    const dist = Vector3.Distance(hitPosition, wpWorldPos);
    const hitRadius = wp.mesh.getBoundingInfo().boundingBox.extendSize.x * 1.5;

    if (dist < hitRadius) {
      return wp;
    }
  }

  return null;
}

/**
 * Damage a weak point and check for destruction
 * Returns true if the weak point was destroyed
 */
export function damageWeakPoint(
  queen: Queen,
  weakPoint: QueenWeakPoint,
  damage: number
): boolean {
  const actualDamage = damage * weakPoint.damageMultiplier;
  weakPoint.health -= actualDamage;

  // Emit weak point hit event
  const eventBus = getEventBus();
  // Note: We can't add custom event types to the EventBus easily,
  // so we'll use NOTIFICATION for now
  eventBus.emit({
    type: 'NOTIFICATION',
    text: `WEAK POINT HIT! ${Math.round(actualDamage)} damage!`,
    duration: 1000,
  });

  if (weakPoint.health <= 0 && !weakPoint.isDestroyed) {
    weakPoint.isDestroyed = true;
    weakPoint.mesh.isVisible = false;

    // Trigger stagger
    queen.aiState.isStaggered = true;
    queen.aiState.staggerTimer = QUEEN_STAGGER_DURATION;

    log.info(`Weak point ${weakPoint.id} destroyed! Queen staggered.`);

    return true;
  }

  return false;
}

/**
 * Calculate actual damage dealt to queen
 */
export function calculateQueenDamage(baseDamage: number, isWeakPoint: boolean): number {
  return isWeakPoint ? baseDamage * WEAK_POINT_DAMAGE_MULTIPLIER : baseDamage;
}

// ============================================================================
// QUEEN AI STATE UPDATE
// ============================================================================

/**
 * Update queen AI state each frame
 */
export function updateQueenAI(
  queen: Queen,
  playerPosition: Vector3,
  deltaTime: number
): void {
  const deltaMs = deltaTime * 1000;

  // Update stagger
  if (queen.aiState.isStaggered) {
    queen.aiState.staggerTimer -= deltaMs;
    if (queen.aiState.staggerTimer <= 0) {
      queen.aiState.isStaggered = false;
      queen.aiState.staggerTimer = 0;
      log.info('Queen recovered from stagger');
    }
    return; // Can't do anything while staggered
  }

  // Update charge movement
  if (queen.aiState.isCharging && queen.aiState.chargeVelocity) {
    const moveAmount = queen.aiState.chargeVelocity.scale(deltaTime);
    queen.mesh.position.addInPlace(moveAmount);

    // Check if reached target or hit player
    if (queen.aiState.chargeTarget) {
      const distToTarget = Vector3.Distance(queen.mesh.position, queen.aiState.chargeTarget);
      if (distToTarget < 2) {
        endCharge(queen);
      }
    }
  }

  // Update death throes
  if (queen.aiState.deathThroesActive) {
    queen.aiState.deathThroesTimer += deltaMs;
  }

  // Update attack animation timer
  if (queen.aiState.attackAnimationTimer > 0) {
    queen.aiState.attackAnimationTimer -= deltaMs;
  }

  // Update frenzy
  if (queen.aiState.isFrenzied && queen.aiState.attackAnimationTimer <= 0) {
    if (queen.aiState.frenzyAttacksRemaining > 0) {
      queen.aiState.frenzyAttacksRemaining--;
      queen.aiState.attackAnimationTimer = QUEEN_FRENZY_ATTACK_DELAY;
    } else {
      queen.aiState.isFrenzied = false;
    }
  }

  // Update weak point glow intensity based on phase
  const targetGlow = QUEEN_WEAK_POINT_GLOW[queen.phase] ?? 0.3;
  for (const wp of queen.weakPoints) {
    if (!wp.isDestroyed) {
      wp.glowIntensity = targetGlow;
      const mat = wp.mesh.material as StandardMaterial;
      if (mat) {
        mat.emissiveColor = Color3.FromHexString(COLORS.weakPoint).scale(targetGlow);
      }
    }
  }
}

/**
 * End the charge attack and return to home position
 */
function endCharge(queen: Queen): void {
  queen.aiState.isCharging = false;
  queen.aiState.chargeTarget = null;
  queen.aiState.chargeVelocity = null;

  // Animate return to home position
  const returnDir = queen.homePosition.subtract(queen.mesh.position).normalize();
  const startPos = queen.mesh.position.clone();
  const startTime = performance.now();

  function returnAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / QUEEN_CHARGE_RETURN_TIME);
    const eased = 1 - Math.pow(1 - progress, 2); // Ease out

    queen.mesh.position = Vector3.Lerp(startPos, queen.homePosition, eased);

    if (progress < 1) {
      requestAnimationFrame(returnAnimation);
    }
  }

  requestAnimationFrame(returnAnimation);
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

  // Stagger animation
  if (queen.aiState.isStaggered) {
    const staggerShake = Math.sin(time * 20) * 0.1;
    queen.mesh.rotation.x = staggerShake;
    queen.mesh.rotation.z = staggerShake * 0.5;
    return;
  }

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
  if (queen.weakPointVisible) {
    const pulseAlpha =
      WEAK_POINT_MIN_ALPHA +
      (WEAK_POINT_MAX_ALPHA - WEAK_POINT_MIN_ALPHA) *
        (0.5 + 0.5 * Math.sin(time * WEAK_POINT_PULSE_SPEED));

    // Pulse all visible weak points
    for (const wp of queen.weakPoints) {
      if (!wp.isDestroyed && wp.mesh.isVisible) {
        const mat = wp.mesh.material as StandardMaterial;
        if (mat) {
          mat.alpha = pulseAlpha;
        }
        // Also pulse the size
        const pulseScale = 0.8 + 0.4 * Math.sin(time * WEAK_POINT_PULSE_SPEED);
        wp.mesh.scaling.setAll(pulseScale);
      }
    }

    // Legacy weak point
    if (queen.weakPointMesh) {
      const mat = queen.weakPointMesh.material as StandardMaterial;
      if (mat) {
        mat.alpha = pulseAlpha;
      }
      const pulseScale = 0.8 + 0.4 * Math.sin(time * WEAK_POINT_PULSE_SPEED);
      queen.weakPointMesh.scaling.setAll(pulseScale);
    }
  }

  // Screaming animation when dying
  if (queen.screaming) {
    queen.mesh.rotation.x = Math.sin(time * 10) * 0.1;
    queen.mesh.rotation.z = Math.sin(time * 8) * 0.05;
  }
}

/**
 * Animate acid spray attack with head lunge and projectile burst
 */
export function animateAcidSpray(queen: Queen): void {
  if (!queen.bodyParts.head) return;

  const head = queen.bodyParts.head;
  const originalRotX = head.rotation.x;

  // Rear back
  head.rotation.x = originalRotX - 0.4;

  // Spray forward (multiple projectiles)
  setTimeout(() => {
    head.rotation.x = originalRotX + 0.5;
  }, 400);

  // Recovery
  setTimeout(() => {
    head.rotation.x = originalRotX;
  }, 800);
}

/**
 * Animate tail swipe attack - wide arc
 */
export function animateTailSwipe(queen: Queen): void {
  if (!queen.bodyParts.tail) return;

  const tail = queen.bodyParts.tail;
  const originalRotY = tail.rotation.y;
  const originalRotX = tail.rotation.x;

  // Wind up - tail raised
  tail.rotation.x = originalRotX - 0.4;
  tail.rotation.y = originalRotY + 0.5;

  // Sweep across
  setTimeout(() => {
    tail.rotation.x = originalRotX + 0.2;
    tail.rotation.y = originalRotY - 0.8;
  }, 300);

  // Recovery
  setTimeout(() => {
    tail.rotation.x = originalRotX;
    tail.rotation.y = originalRotY;
  }, 600);
}

/**
 * Animate screech attack - head raised, body vibrating
 */
export function animateScreech(queen: Queen): void {
  if (!queen.bodyParts.head) return;

  const head = queen.bodyParts.head;
  const originalRotX = head.rotation.x;
  const startTime = performance.now();
  const duration = QUEEN_SCREECH_STUN_DURATION;

  // Raise head dramatically
  head.rotation.x = originalRotX - 0.6;

  function vibrateAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Vibrate during screech
    if (progress < 0.8) {
      queen.mesh.rotation.z = Math.sin(elapsed * 0.05) * 0.03;
      head.rotation.x = originalRotX - 0.6 + Math.sin(elapsed * 0.03) * 0.1;
    } else {
      // Wind down
      queen.mesh.rotation.z = 0;
      head.rotation.x = originalRotX;
    }

    if (progress < 1) {
      requestAnimationFrame(vibrateAnimation);
    }
  }

  requestAnimationFrame(vibrateAnimation);
}

/**
 * Animate charge attack - lean forward and rush
 */
export function animateCharge(queen: Queen, targetPosition: Vector3): void {
  const direction = targetPosition.subtract(queen.mesh.position).normalize();

  // Lean into charge
  queen.mesh.rotation.x = 0.3;

  // Set charge velocity
  queen.aiState.isCharging = true;
  queen.aiState.chargeTarget = targetPosition;
  queen.aiState.chargeVelocity = direction.scale(QUEEN_CHARGE_SPEED);

  // Face target
  const angle = Math.atan2(direction.x, direction.z);
  queen.mesh.rotation.y = angle + Math.PI;
}

/**
 * Animate egg burst - body pulses as eggs release
 */
export function animateEggBurst(queen: Queen): void {
  const startTime = performance.now();
  const duration = 1000;
  const originalScale = queen.mesh.scaling.y;

  function burstAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Pulse body
    const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.1 * (1 - progress);
    queen.mesh.scaling.y = originalScale * pulse;

    // Abdomen heave
    if (queen.bodyParts.abdomen) {
      queen.bodyParts.abdomen.rotation.x = Math.sin(progress * Math.PI * 2) * 0.1;
    }

    if (progress < 1) {
      requestAnimationFrame(burstAnimation);
    } else {
      queen.mesh.scaling.y = originalScale;
      if (queen.bodyParts.abdomen) {
        queen.bodyParts.abdomen.rotation.x = 0;
      }
    }
  }

  requestAnimationFrame(burstAnimation);
}

/**
 * Animate poison cloud release - body contracts then expels
 */
export function animatePoisonCloud(queen: Queen): void {
  const originalScale = queen.mesh.scaling.clone();

  // Contract
  queen.mesh.scaling.scaleInPlace(0.9);

  // Expel
  setTimeout(() => {
    queen.mesh.scaling = originalScale.scale(1.1);
  }, 300);

  // Recovery
  setTimeout(() => {
    queen.mesh.scaling = originalScale;
  }, 600);
}

/**
 * Animate frenzy attack - rapid claw strikes
 */
export function animateFrenzyAttack(queen: Queen, attackIndex: number): void {
  const clawIndex = attackIndex % 2;
  const claw = queen.bodyParts.claws[clawIndex];
  if (!claw) return;

  const side = clawIndex === 0 ? 1 : -1;
  const originalRotX = claw.rotation.x;
  const originalRotZ = claw.rotation.z;

  // Rapid strike
  claw.rotation.x = originalRotX + 0.6;
  claw.rotation.z = originalRotZ - side * 0.4;

  // Recovery
  setTimeout(() => {
    claw.rotation.x = originalRotX;
    claw.rotation.z = originalRotZ;
  }, QUEEN_FRENZY_ATTACK_DELAY * 0.8);
}

// Legacy animation functions for backwards compatibility
export function animateClawSwipe(queen: Queen): void {
  animateTailSwipe(queen);
}

export function animateTailSlam(queen: Queen): void {
  animateTailSwipe(queen);
}

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

export function animateAcidSpit(queen: Queen): void {
  animateAcidSpray(queen);
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
 * Play queen phase transition animation
 */
export function animatePhaseTransition(queen: Queen, newPhase: QueenPhase): void {
  queen.aiState.isStaggered = true;
  queen.aiState.staggerTimer = QUEEN_PHASE_TRANSITION_DURATION;

  const startTime = performance.now();
  const duration = QUEEN_PHASE_TRANSITION_DURATION;
  const originalScale = queen.mesh.scaling.clone();

  function transitionAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Violent shaking during transition
    queen.mesh.rotation.x = Math.sin(elapsed * 0.02) * 0.15 * (1 - progress);
    queen.mesh.rotation.z = Math.cos(elapsed * 0.025) * 0.1 * (1 - progress);

    // Pulse scale
    const pulse = 1 + Math.sin(elapsed * 0.01) * 0.1 * (1 - progress);
    queen.mesh.scaling = originalScale.scale(pulse);

    if (progress < 1) {
      requestAnimationFrame(transitionAnimation);
    } else {
      queen.mesh.rotation.x = 0;
      queen.mesh.rotation.z = 0;
      queen.mesh.scaling = originalScale;
      queen.aiState.isStaggered = false;
    }
  }

  // Roar effect - screen shake handled by level
  queen.screaming = true;
  setTimeout(() => {
    queen.screaming = false;
  }, 1500);

  requestAnimationFrame(transitionAnimation);
}

/**
 * Play queen death animation sequence with slow-mo
 */
export function animateQueenDeath(queen: Queen, onComplete?: () => void): void {
  queen.screaming = true;

  const startTime = performance.now();
  const slowMoDuration = QUEEN_DEATH_SLOWMO_DURATION;
  const collapseDuration = 3000;
  const totalDuration = slowMoDuration + collapseDuration;
  const originalY = queen.mesh.position.y;

  function deathAnimation(): void {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / totalDuration);

    // Slow-mo phase (first 2 seconds)
    const slowMoProgress = Math.min(1, elapsed / slowMoDuration);
    const timeScale = slowMoProgress < 1 ? QUEEN_DEATH_SLOWMO_SCALE : 1;

    // Violent shaking, scaled by time
    queen.mesh.rotation.x = Math.sin(elapsed * 0.03 * timeScale) * 0.2 * (1 - progress * 0.5);
    queen.mesh.rotation.z = Math.cos(elapsed * 0.025 * timeScale) * 0.15 * (1 - progress * 0.5);

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

    // Hide weak points
    for (const wp of queen.weakPoints) {
      wp.mesh.isVisible = false;
    }
    if (queen.weakPointMesh) {
      queen.weakPointMesh.isVisible = false;
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

  // Dispose weak points
  for (const wp of queen.weakPoints) {
    wp.mesh.dispose();
  }
}

// ============================================================================
// ATTACK EXECUTION HELPERS
// ============================================================================

/**
 * Get acid spray projectile positions (cone pattern)
 */
export function getAcidSprayPositions(
  queenPosition: Vector3,
  playerPosition: Vector3
): Vector3[] {
  const direction = playerPosition.subtract(queenPosition).normalize();
  const baseAngle = Math.atan2(direction.x, direction.z);
  const positions: Vector3[] = [];

  const halfSpread = (ACID_SPRAY_SPREAD_ANGLE * Math.PI) / 180 / 2;
  const angleStep = (ACID_SPRAY_SPREAD_ANGLE * Math.PI) / 180 / (ACID_SPRAY_PROJECTILE_COUNT - 1);

  for (let i = 0; i < ACID_SPRAY_PROJECTILE_COUNT; i++) {
    const angle = baseAngle - halfSpread + angleStep * i;
    const projectileDir = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    positions.push(projectileDir);
  }

  return positions;
}

/**
 * Check if player is in charge collision radius
 */
export function checkChargeCollision(
  queenPosition: Vector3,
  playerPosition: Vector3
): boolean {
  const dist = Vector3.Distance(queenPosition, playerPosition);
  return dist < QUEEN_CHARGE_RADIUS;
}

/**
 * Check if player is in poison cloud
 */
export function checkPoisonCloudCollision(
  cloudPosition: Vector3,
  playerPosition: Vector3
): boolean {
  const dist = Vector3.Distance(cloudPosition, playerPosition);
  return dist < QUEEN_POISON_CLOUD_RADIUS;
}

/**
 * Get spawn positions for egg burst (around arena edges)
 */
export function getEggBurstSpawnPositions(
  arenaCenter: Vector3,
  arenaRadius: number
): Vector3[] {
  const positions: Vector3[] = [];
  for (let i = 0; i < QUEEN_EGG_BURST_SPAWN_COUNT; i++) {
    const angle = (i / QUEEN_EGG_BURST_SPAWN_COUNT) * Math.PI * 2;
    const x = arenaCenter.x + Math.cos(angle) * (arenaRadius - 2);
    const z = arenaCenter.z + Math.sin(angle) * (arenaRadius - 2);
    positions.push(new Vector3(x, arenaCenter.y, z));
  }
  return positions;
}

/**
 * Reveal all weak points (called when scanning)
 */
export function revealWeakPoints(queen: Queen): void {
  queen.weakPointVisible = true;
  for (const wp of queen.weakPoints) {
    if (!wp.isDestroyed) {
      wp.mesh.isVisible = true;
    }
  }
  if (queen.weakPointMesh) {
    queen.weakPointMesh.isVisible = true;
  }
}

/**
 * Hide all weak points
 */
export function hideWeakPoints(queen: Queen): void {
  queen.weakPointVisible = false;
  for (const wp of queen.weakPoints) {
    wp.mesh.isVisible = false;
  }
  if (queen.weakPointMesh) {
    queen.weakPointMesh.isVisible = false;
  }
}

/**
 * Start frenzy mode
 */
export function startFrenzy(queen: Queen): void {
  queen.aiState.isFrenzied = true;
  queen.aiState.frenzyAttacksRemaining = QUEEN_FRENZY_ATTACK_COUNT;
  queen.aiState.attackAnimationTimer = QUEEN_FRENZY_ATTACK_DELAY;
}

/**
 * Activate death throes mode
 */
export function activateDeathThroes(queen: Queen): void {
  queen.aiState.deathThroesActive = true;
  queen.aiState.deathThroesTimer = 0;
  log.info('Queen entered death throes mode!');
}
