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
 * Based on the existing alien entity pattern from entities/aliens.ts
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

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
// PROCEDURAL MESH GENERATION
// ============================================================================

/** Seeded random for consistent procedural generation */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Create a procedural Ice Chitin mesh.
 *
 * Visual design: insectoid creature with angular, crystalline chitin armor.
 * White-blue color palette with glowing cyan accents.
 * Larger than a Skitterer but shorter than a Lurker.
 */
export function createIceChitinMesh(scene: Scene, seed: number): TransformNode {
  const random = seededRandom(seed);
  const root = new TransformNode(`ice_chitin_${seed}`, scene);

  // --- Materials ---

  // Primary carapace: pale icy white
  const carapaceMat = new StandardMaterial(`ice_chitin_carapace_${seed}`, scene);
  carapaceMat.diffuseColor = new Color3(0.85, 0.9, 0.95);
  carapaceMat.specularColor = new Color3(0.6, 0.7, 0.8);
  carapaceMat.specularPower = 64;

  // Secondary: translucent ice-blue
  const iceMat = new StandardMaterial(`ice_chitin_ice_${seed}`, scene);
  iceMat.diffuseColor = new Color3(0.5, 0.7, 0.9);
  iceMat.alpha = 0.8;
  iceMat.specularColor = new Color3(0.8, 0.9, 1.0);
  iceMat.specularPower = 128;

  // Glow material: cyan bioluminescence
  const glowMat = new StandardMaterial(`ice_chitin_glow_${seed}`, scene);
  glowMat.emissiveColor = new Color3(0.2, 0.8, 1.0);
  glowMat.disableLighting = true;

  // Frost crystal material
  const crystalMat = new StandardMaterial(`ice_chitin_crystal_${seed}`, scene);
  crystalMat.diffuseColor = new Color3(0.7, 0.85, 1.0);
  crystalMat.alpha = 0.6;
  crystalMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
  crystalMat.specularColor = new Color3(1, 1, 1);
  crystalMat.specularPower = 256;

  // --- Body ---

  // Central thorax: angular, slightly flattened
  const thorax = MeshBuilder.CreateSphere(
    'thorax',
    {
      diameterX: 1.0 + random() * 0.2,
      diameterY: 0.7 + random() * 0.1,
      diameterZ: 0.8 + random() * 0.2,
      segments: 8,
    },
    scene
  );
  thorax.material = carapaceMat;
  thorax.parent = root;
  thorax.position.y = 0.8;

  // Abdomen behind thorax
  const abdomen = MeshBuilder.CreateSphere(
    'abdomen',
    {
      diameterX: 0.7 + random() * 0.15,
      diameterY: 0.5 + random() * 0.1,
      diameterZ: 0.6 + random() * 0.15,
      segments: 8,
    },
    scene
  );
  abdomen.material = carapaceMat;
  abdomen.parent = root;
  abdomen.position.set(0, 0.7, 0.5);

  // --- Head ---

  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameterX: 0.45 + random() * 0.05,
      diameterY: 0.4 + random() * 0.05,
      diameterZ: 0.5,
      segments: 8,
    },
    scene
  );
  head.material = carapaceMat;
  head.parent = root;
  head.position.set(0, 1.0, -0.55);

  // Glowing compound eyes (4 eyes arranged in pairs)
  const eyeCount = 4;
  for (let i = 0; i < eyeCount; i++) {
    const eye = MeshBuilder.CreateSphere(
      `eye_${i}`,
      { diameter: 0.06 + random() * 0.03 },
      scene
    );
    eye.material = glowMat;
    eye.parent = head;
    const row = Math.floor(i / 2);
    const col = i % 2;
    eye.position.set(
      (col - 0.5) * 0.18,
      0.05 + row * 0.1,
      -0.2
    );
  }

  // Mandibles for ice shard formation
  for (let i = 0; i < 2; i++) {
    const mandible = MeshBuilder.CreateCylinder(
      `mandible_${i}`,
      {
        height: 0.2 + random() * 0.05,
        diameterTop: 0.015,
        diameterBottom: 0.04,
        tessellation: 4,
      },
      scene
    );
    mandible.material = iceMat;
    mandible.parent = head;
    mandible.position.set((i - 0.5) * 0.12, -0.12, -0.22);
    mandible.rotation.x = Math.PI / 3.5;
    mandible.rotation.z = (i - 0.5) * 0.4;
  }

  // --- Legs (6 legs, spider-like) ---

  const legCount = 6;
  for (let i = 0; i < legCount; i++) {
    const side = i < legCount / 2 ? 1 : -1;
    const idx = i % (legCount / 2);
    const zOffset = (idx / (legCount / 2 - 1)) * 0.6 - 0.3;

    // Upper leg segment
    const upperLeg = MeshBuilder.CreateCylinder(
      `upperLeg_${i}`,
      {
        height: 0.55 + random() * 0.15,
        diameterTop: 0.05,
        diameterBottom: 0.07,
        tessellation: 6,
      },
      scene
    );
    upperLeg.material = carapaceMat;
    upperLeg.parent = root;
    upperLeg.position.set(side * 0.4, 0.8, zOffset);
    upperLeg.rotation.z = side * (Math.PI / 3 + random() * 0.15);

    // Lower leg segment with ice-crystal tip
    const lowerLeg = MeshBuilder.CreateCylinder(
      `lowerLeg_${i}`,
      {
        height: 0.5 + random() * 0.15,
        diameterTop: 0.04,
        diameterBottom: 0.025,
        tessellation: 6,
      },
      scene
    );
    lowerLeg.material = iceMat;
    lowerLeg.parent = upperLeg;
    lowerLeg.position.y = -0.4;
    lowerLeg.rotation.z = -side * (Math.PI / 4);
  }

  // --- Crystalline Spines (dorsal ice formations) ---

  const spineCount = 3 + Math.floor(random() * 3);
  for (let i = 0; i < spineCount; i++) {
    const spine = MeshBuilder.CreateCylinder(
      `spine_${i}`,
      {
        height: 0.25 + random() * 0.2,
        diameterTop: 0.01,
        diameterBottom: 0.04 + random() * 0.02,
        tessellation: 4,
      },
      scene
    );
    spine.material = crystalMat;
    spine.parent = thorax;
    const angle = (i / spineCount) * Math.PI * 0.8 - Math.PI * 0.4;
    spine.position.set(
      Math.sin(angle) * 0.2,
      0.3 + random() * 0.1,
      Math.cos(angle) * 0.15
    );
    spine.rotation.x = -0.3 + random() * 0.6;
    spine.rotation.z = (random() - 0.5) * 0.4;
  }

  // --- Ice Shard Launcher (on thorax front, between head and body) ---

  const launcher = MeshBuilder.CreateCylinder(
    'shard_launcher',
    {
      height: 0.18,
      diameterTop: 0.06,
      diameterBottom: 0.1,
      tessellation: 6,
    },
    scene
  );
  launcher.material = iceMat;
  launcher.parent = root;
  launcher.position.set(0, 0.9, -0.35);
  launcher.rotation.x = Math.PI / 2;

  // Glow core inside launcher
  const launcherCore = MeshBuilder.CreateSphere(
    'launcher_core',
    { diameter: 0.05 },
    scene
  );
  launcherCore.material = glowMat;
  launcherCore.parent = launcher;
  launcherCore.position.set(0, -0.05, 0);

  // --- Frost Aura Indicator (subtle ring at base) ---

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

  const core = MeshBuilder.CreateSphere(
    'shard_core',
    { diameter: 0.04 },
    scene
  );
  core.material = coreMat;
  core.parent = root;

  return root;
}

/**
 * Create the dormant ice cocoon mesh (frozen nest wrapping).
 * Used for dormant Ice Chitins before they awaken.
 */
export function createDormantCocoonMesh(scene: Scene, seed: number): TransformNode {
  const random = seededRandom(seed);
  const root = new TransformNode(`ice_cocoon_${seed}`, scene);

  // Frozen ice shell
  const shellMat = new StandardMaterial(`cocoon_shell_${seed}`, scene);
  shellMat.diffuseColor = new Color3(0.7, 0.82, 0.92);
  shellMat.alpha = 0.5;
  shellMat.specularColor = new Color3(0.9, 0.95, 1.0);
  shellMat.specularPower = 128;
  shellMat.emissiveColor = new Color3(0.05, 0.1, 0.15);

  const shell = MeshBuilder.CreateSphere(
    'cocoon_shell',
    {
      diameterX: 1.2 + random() * 0.3,
      diameterY: 1.5 + random() * 0.3,
      diameterZ: 1.0 + random() * 0.2,
      segments: 10,
    },
    scene
  );
  shell.material = shellMat;
  shell.parent = root;
  shell.position.y = 0.7;

  // Surface frost crystals
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
    crystal.parent = shell;
    const angle = (i / crystalCount) * Math.PI * 2;
    crystal.position.set(
      Math.cos(angle) * (0.5 + random() * 0.2),
      random() * 0.4 - 0.2,
      Math.sin(angle) * (0.4 + random() * 0.2)
    );
    crystal.rotation.x = (random() - 0.5) * 0.8;
    crystal.rotation.z = (random() - 0.5) * 0.8;
  }

  // Faint inner glow (the creature inside)
  const innerGlow = MeshBuilder.CreateSphere(
    'inner_glow',
    { diameter: 0.3 },
    scene
  );
  const innerMat = new StandardMaterial(`cocoon_inner_${seed}`, scene);
  innerMat.emissiveColor = new Color3(0.15, 0.5, 0.7);
  innerMat.disableLighting = true;
  innerMat.alpha = 0.25;
  innerGlow.material = innerMat;
  innerGlow.parent = shell;
  innerGlow.position.y = 0.1;

  return root;
}
