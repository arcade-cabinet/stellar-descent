/**
 * IceChitin - Frozen alien variant found in the southern wastes of LV-847
 *
 * A cold-adapted Chitin strain with:
 * - White/ice-blue coloring (cryogenic camouflage)
 * - Ice shard ranged attack (crystalline projectile)
 * - Frost aura that slows nearby players
 * - Ability to burrow through ice and ambush
 * - Resistant to plasma weapons, weak to kinetic
 *
 * Body mesh loaded from GLB: /models/enemies/chitin/alien_scifi.glb
 * Projectile and VFX indicators remain procedural MeshBuilder geometry.
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../../core/AssetManager';
import type { AlienSpecies, LootEntry } from '../../entities/aliens';

// ============================================================================
// ICE CHITIN SPECIES DEFINITION
// ============================================================================

export const ICE_CHITIN_SPECIES: AlienSpecies = {
  id: 'ice_chitin',
  name: 'Ice Chitin',
  designation: 'STRAIN-X6-CRYO',
  description:
    'Cryogenically adapted Chitin strain. White-blue coloring provides camouflage in frozen terrain. ' +
    'Fires crystallized ice shards at range. Exudes a frost aura that slows nearby targets. ' +
    'Can burrow through ice for ambush attacks. Resistant to plasma, weak to kinetic rounds.',
  baseHealth: 100,
  baseDamage: 18,
  moveSpeed: 12,
  attackRange: 22,
  alertRadius: 40,
  fireRate: 1.2,
  projectileSpeed: 28,
  xpValue: 60,
  lootTable: [
    { itemId: 'cryo_shard', dropChance: 0.8, minQuantity: 1, maxQuantity: 3 },
    { itemId: 'frozen_chitin_plate', dropChance: 0.5, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'frost_gland', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'bio_sample', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
  ] as LootEntry[],
};

// ============================================================================
// ICE CHITIN COMBAT CONSTANTS
// ============================================================================

/** Damage resistances - multiplied against incoming damage by type */
export const ICE_CHITIN_RESISTANCES = {
  plasma: 0.35, // Highly resistant to plasma
  kinetic: 1.6, // Weak to kinetic
  explosive: 1.0, // Normal explosive damage
  melee: 1.2, // Slightly weak to melee
  fire: 1.8, // Very weak to fire/incendiary
} as const;

/** Frost aura configuration */
export const FROST_AURA = {
  radius: 8, // Meters
  slowFactor: 0.55, // Player moves at 55% speed
  damagePerSecond: 2, // Minor frost damage
  visualPulseRate: 1.5, // Seconds between visual pulses
} as const;

/** Ice shard projectile configuration */
export const ICE_SHARD_PROJECTILE = {
  speed: 28,
  damage: 18,
  /** Shards slow player on hit for this duration in seconds */
  slowDuration: 1.5,
  slowFactor: 0.7,
  /** Visual trail length */
  trailLength: 3,
  /** Spread angle for burst fire (radians) */
  burstSpreadAngle: 0.15,
  /** Number of shards in a burst */
  burstCount: 3,
  /** Cooldown between bursts (seconds) */
  burstCooldown: 2.5,
} as const;

/** Burrow mechanic configuration */
export const BURROW_CONFIG = {
  /** Time to complete burrow animation (seconds) */
  burrowDuration: 1.2,
  /** Time spent underground before emerging (seconds) */
  undergroundDuration: 2.0,
  /** Time to emerge animation (seconds) */
  emergeDuration: 0.8,
  /** Distance the chitin can travel while burrowed (meters) */
  burrowDistance: 15,
  /** Cooldown between burrow attempts (seconds) */
  burrowCooldown: 12,
  /** Damage dealt on emergence (ambush damage) */
  emergeDamage: 25,
  /** Radius of emergence damage */
  emergeRadius: 4,
} as const;

// ============================================================================
// ICE CHITIN STATE
// ============================================================================

export type IceChitinState =
  | 'dormant' // Frozen in ice, not yet activated
  | 'awakening' // Breaking out of ice
  | 'idle' // Standing, scanning for threats
  | 'chase' // Moving toward player
  | 'attack_ranged' // Firing ice shards
  | 'attack_melee' // Close-range claw attack
  | 'burrowing' // Digging into ice
  | 'underground' // Traveling beneath ice
  | 'emerging' // Bursting out of ice
  | 'dead';

export interface IceChitinInstance {
  rootNode: TransformNode;
  health: number;
  maxHealth: number;
  state: IceChitinState;
  position: Vector3;
  speed: number;
  attackCooldown: number;
  burrowCooldown: number;
  stateTimer: number;
  targetPosition: Vector3 | null;
  /** Distance from player at which this chitin was last seen */
  lastKnownPlayerDistance: number;
  /** Whether frost aura is currently active (only when alive and not burrowed) */
  frostAuraActive: boolean;
  /** Timer for dormant -> awakening transition */
  awakenTimer: number;
}

// ============================================================================
// GLB MODEL PATHS
// ============================================================================

const ICE_CHITIN_GLB = '/models/enemies/chitin/alien_scifi.glb';

// ============================================================================
// MESH GENERATION -- GLB body + procedural VFX indicators
// ============================================================================

/** Seeded random for consistent procedural generation */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Preload the Ice Chitin GLB so that createIceChitinMesh can instance it
 * synchronously. Call once during level setup before spawning enemies.
 */
export async function preloadIceChitinAssets(scene: Scene): Promise<void> {
  await AssetManager.loadAssetByPath(ICE_CHITIN_GLB, scene);
}

/**
 * Create an Ice Chitin mesh from the alien_scifi GLB model.
 *
 * The GLB provides the full insectoid body (thorax, abdomen, head, eyes,
 * mandibles, legs, spines, launcher). An ice-blue frost tint is applied
 * to all loaded meshes for the cryo-adapted look, and a procedural
 * frost-aura torus is added as a VFX indicator.
 */
export function createIceChitinMesh(scene: Scene, seed: number): TransformNode {
  const root = new TransformNode(`ice_chitin_${seed}`, scene);

  // --- GLB body instance ---
  const bodyNode = AssetManager.createInstanceByPath(
    ICE_CHITIN_GLB,
    `ice_chitin_body_${seed}`,
    scene,
    true,
    'enemy'
  );

  if (bodyNode) {
    bodyNode.parent = root;
    // Scale the alien model to match the Ice Chitin size
    // (larger than a Skitterer but shorter than a Lurker)
    bodyNode.scaling.setAll(0.8);
    bodyNode.position.y = 0.8;

    // Apply ice-blue frost tint to all body meshes
    applyIceTint(scene, bodyNode, seed);
  } else {
    console.warn(`[IceChitin] GLB not loaded for ice_chitin_${seed}, using empty root`);
  }

  // --- Frost Aura Indicator (VFX -- kept as MeshBuilder) ---

  const auraRing = MeshBuilder.CreateTorus(
    'frost_aura_ring',
    {
      diameter: FROST_AURA.radius * 0.15, // Scaled-down visual indicator
      thickness: 0.02,
      tessellation: 16,
    },
    scene
  );
  const auraMat = new StandardMaterial(`frost_aura_mat_${seed}`, scene);
  auraMat.emissiveColor = new Color3(0.3, 0.6, 0.9);
  auraMat.alpha = 0.3;
  auraMat.disableLighting = true;
  auraRing.material = auraMat;
  auraRing.parent = root;
  auraRing.position.y = 0.05;
  auraRing.rotation.x = Math.PI / 2;

  return root;
}

/**
 * Apply an ice-blue frost tint to all meshes under a node, giving the
 * cryo-adapted white/blue coloring.
 */
function applyIceTint(scene: Scene, node: TransformNode, seed: number): void {
  const meshes = node.getChildMeshes(false);
  const frostBlend = 0.45;
  const frostColor = new Color3(0.85, 0.9, 0.95);
  const emissiveBoost = new Color3(0.05, 0.15, 0.25);

  for (const mesh of meshes) {
    if (mesh.material instanceof StandardMaterial) {
      const mat = mesh.material;
      mat.diffuseColor = Color3.Lerp(mat.diffuseColor, frostColor, frostBlend);
      mat.emissiveColor = Color3.Lerp(mat.emissiveColor, emissiveBoost, 0.5);
      mat.specularColor = Color3.Lerp(
        mat.specularColor,
        new Color3(0.6, 0.7, 0.8),
        frostBlend
      );
      mat.specularPower = Math.min(mat.specularPower + 32, 128);
    }
  }
}

/**
 * Create an ice shard projectile mesh for the ranged attack.
 * A sharp, translucent crystal shard.
 */
export function createIceShardMesh(scene: Scene): TransformNode {
  const root = new TransformNode('ice_shard_projectile', scene);

  const shardMat = new StandardMaterial('ice_shard_mat', scene);
  shardMat.diffuseColor = new Color3(0.6, 0.85, 1.0);
  shardMat.alpha = 0.75;
  shardMat.emissiveColor = new Color3(0.2, 0.5, 0.8);
  shardMat.specularColor = new Color3(1, 1, 1);
  shardMat.specularPower = 256;

  // Main crystal body (elongated pyramid shape via cylinder)
  const shard = MeshBuilder.CreateCylinder(
    'shard_body',
    {
      height: 0.4,
      diameterTop: 0,
      diameterBottom: 0.1,
      tessellation: 4,
    },
    scene
  );
  shard.material = shardMat;
  shard.parent = root;
  shard.rotation.x = -Math.PI / 2; // Point forward

  // Glowing core
  const coreMat = new StandardMaterial('shard_core_mat', scene);
  coreMat.emissiveColor = new Color3(0.4, 0.9, 1.0);
  coreMat.disableLighting = true;

  const core = MeshBuilder.CreateSphere('shard_core', { diameter: 0.04 }, scene);
  core.material = coreMat;
  core.parent = root;

  return root;
}

/**
 * Create the dormant ice cocoon mesh (frozen nest wrapping).
 *
 * Uses a crouched/scaled-down GLB alien body encased in procedural VFX
 * frost crystals and an inner glow, giving the appearance of a creature
 * frozen mid-hibernation inside an ice shell.
 */
export function createDormantCocoonMesh(scene: Scene, seed: number): TransformNode {
  const random = seededRandom(seed);
  const root = new TransformNode(`ice_cocoon_${seed}`, scene);

  // --- GLB body as the frozen cocoon core ---
  const bodyNode = AssetManager.createInstanceByPath(
    ICE_CHITIN_GLB,
    `ice_cocoon_body_${seed}`,
    scene,
    true,
    'enemy'
  );

  if (bodyNode) {
    bodyNode.parent = root;
    // Crouched/compressed pose -- squished vertically, scaled down
    bodyNode.scaling.set(0.6, 0.45, 0.6);
    bodyNode.position.y = 0.5;

    // Heavy frost overlay -- almost entirely white-blue ice encasement
    const meshes = bodyNode.getChildMeshes(false);
    for (const mesh of meshes) {
      if (mesh.material instanceof StandardMaterial) {
        const mat = mesh.material;
        mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.7, 0.82, 0.92), 0.7);
        mat.alpha = 0.5;
        mat.specularColor = new Color3(0.9, 0.95, 1.0);
        mat.specularPower = 128;
        mat.emissiveColor = new Color3(0.05, 0.1, 0.15);
      }
    }
  }

  // --- Surface frost crystals (VFX -- kept as MeshBuilder) ---
  const crystalCount = 4 + Math.floor(random() * 4);
  const crystalMat = new StandardMaterial(`cocoon_crystal_${seed}`, scene);
  crystalMat.diffuseColor = new Color3(0.75, 0.88, 1.0);
  crystalMat.alpha = 0.6;
  crystalMat.emissiveColor = new Color3(0.1, 0.2, 0.35);

  for (let i = 0; i < crystalCount; i++) {
    const crystal = MeshBuilder.CreateCylinder(
      `cocoon_crystal_${i}`,
      {
        height: 0.15 + random() * 0.2,
        diameterTop: 0,
        diameterBottom: 0.04 + random() * 0.03,
        tessellation: 4,
      },
      scene
    );
    crystal.material = crystalMat;
    crystal.parent = root;
    const angle = (i / crystalCount) * Math.PI * 2;
    crystal.position.set(
      Math.cos(angle) * (0.5 + random() * 0.2),
      0.7 + random() * 0.4 - 0.2,
      Math.sin(angle) * (0.4 + random() * 0.2)
    );
    crystal.rotation.x = (random() - 0.5) * 0.8;
    crystal.rotation.z = (random() - 0.5) * 0.8;
  }

  // --- Faint inner glow (VFX -- kept as MeshBuilder) ---
  const innerGlow = MeshBuilder.CreateSphere('inner_glow', { diameter: 0.3 }, scene);
  const innerMat = new StandardMaterial(`cocoon_inner_${seed}`, scene);
  innerMat.emissiveColor = new Color3(0.15, 0.5, 0.7);
  innerMat.disableLighting = true;
  innerMat.alpha = 0.25;
  innerGlow.material = innerMat;
  innerGlow.parent = root;
  innerGlow.position.y = 0.8;

  return root;
}
