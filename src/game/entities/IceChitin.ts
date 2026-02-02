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
 * Body meshes loaded from GLB files with ice-blue material tinting:
 * - Ice Drone: /models/enemies/chitin/spider.glb
 * - Ice Warrior: /models/enemies/chitin/soldier.glb
 * - Ice Brood Mother: /models/enemies/chitin/tentakel.glb
 *
 * Projectile and VFX indicators remain procedural MeshBuilder geometry.
 */

import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { ICE_CHITIN_MODELS } from '@config/entities';
import { AssetManager } from '../core/AssetManager';
import { getLogger } from '../core/Logger';

const log = getLogger('IceChitin');

import type { AlienSpecies, LootEntry } from './aliens';

// ============================================================================
// ICE CHITIN VARIANT TYPE
// ============================================================================

/** Ice Chitin variant types - determines which GLB model and stats to use */
export type IceChitinVariant = 'drone' | 'warrior' | 'brood_mother';

// ============================================================================
// ICE CHITIN SPECIES DEFINITIONS
// ============================================================================

/** Ice Drone - fast, weak, swarm variant (uses spider.glb) */
export const ICE_DRONE_SPECIES: AlienSpecies = {
  id: 'ice_drone',
  name: 'Ice Drone',
  designation: 'STRAIN-X6-CRYO-D',
  description:
    'Fast-moving cryogenic crawler. Swarms in packs across frozen terrain. ' +
    'Less durable than other ice variants but dangerous in numbers.',
  baseHealth: 60,
  baseDamage: 12,
  moveSpeed: 18,
  attackRange: 15,
  alertRadius: 35,
  fireRate: 2.0,
  projectileSpeed: 30,
  xpValue: 30,
  lootTable: [
    { itemId: 'cryo_shard', dropChance: 0.7, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'frozen_chitin_plate', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'bio_sample', dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
  ] as LootEntry[],
  hitReactionDuration: 80,
  painSounds: ['alien_chittering', 'organic_squish', 'alien_hiss'],
  deathAnimations: ['death_shatter', 'death_collapse', 'death_freeze'],
  knockbackResistance: 0.2,
};

/** Ice Warrior - armored ranged variant (uses soldier.glb) */
export const ICE_WARRIOR_SPECIES: AlienSpecies = {
  id: 'ice_warrior',
  name: 'Ice Warrior',
  designation: 'STRAIN-X6-CRYO-W',
  description:
    'Cryogenically adapted Chitin warrior. White-blue coloring provides camouflage in frozen terrain. ' +
    'Fires crystallized ice shards at range. Exudes a frost aura that slows nearby targets. ' +
    'Can burrow through ice for ambush attacks. Resistant to plasma, weak to kinetic rounds.',
  baseHealth: 150,
  baseDamage: 18,
  moveSpeed: 10,
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
  hitReactionDuration: 60,
  painSounds: ['alien_hiss', 'organic_squish', 'alien_growl'],
  deathAnimations: ['death_shatter', 'death_collapse', 'death_freeze'],
  knockbackResistance: 0.7,
};

/** Ice Brood Mother - large boss variant (uses tentakel.glb) */
export const ICE_BROOD_MOTHER_SPECIES: AlienSpecies = {
  id: 'ice_brood_mother',
  name: 'Ice Brood Mother',
  designation: 'STRAIN-X6-CRYO-B',
  description:
    'Massive cryogenic hive mother. Spawns ice drones and unleashes devastating frost nova attacks. ' +
    'Thick ice-encrusted armor makes it highly resistant to all damage types.',
  baseHealth: 500,
  baseDamage: 30,
  moveSpeed: 4,
  attackRange: 25,
  alertRadius: 50,
  fireRate: 0.6,
  projectileSpeed: 20,
  xpValue: 200,
  lootTable: [
    { itemId: 'cryo_shard', dropChance: 1.0, minQuantity: 3, maxQuantity: 6 },
    { itemId: 'frozen_chitin_plate', dropChance: 0.9, minQuantity: 2, maxQuantity: 4 },
    { itemId: 'frost_gland', dropChance: 0.7, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'brood_sac', dropChance: 0.5, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'bio_sample', dropChance: 0.4, minQuantity: 2, maxQuantity: 3 },
  ] as LootEntry[],
  hitReactionDuration: 30,
  painSounds: ['alien_roar', 'alien_growl', 'organic_squish'],
  deathAnimations: ['death_epic_collapse', 'death_shatter', 'death_freeze'],
  knockbackResistance: 0.95,
};

/** Legacy species definition for backward compatibility */
export const ICE_CHITIN_SPECIES: AlienSpecies = ICE_WARRIOR_SPECIES;

/** Map variant type to species definition */
export const ICE_CHITIN_VARIANTS: Record<IceChitinVariant, AlienSpecies> = {
  drone: ICE_DRONE_SPECIES,
  warrior: ICE_WARRIOR_SPECIES,
  brood_mother: ICE_BROOD_MOTHER_SPECIES,
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
  /** Spread angle for burst fire (radians) - wider for visual differentiation */
  burstSpreadAngle: 0.25,
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
  /** The variant type of this ice chitin */
  variant: IceChitinVariant;
}

// ============================================================================
// GLB MODEL PATHS AND CONFIGURATION
// ============================================================================

/** GLB model configuration per ice chitin variant (from @config/entities) */
const ICE_CHITIN_GLB_CONFIG: Record<IceChitinVariant, { path: string; scale: number }> =
  ICE_CHITIN_MODELS as Record<IceChitinVariant, { path: string; scale: number }>;

/** All GLB paths for preloading */
const ALL_ICE_CHITIN_GLBS = [
  ICE_CHITIN_GLB_CONFIG.drone.path,
  ICE_CHITIN_GLB_CONFIG.warrior.path,
  ICE_CHITIN_GLB_CONFIG.brood_mother.path,
];

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
 * Preload all Ice Chitin variant GLBs so that createIceChitinMesh can instance
 * them synchronously. Call once during level setup before spawning enemies.
 */
export async function preloadIceChitinAssets(scene: Scene): Promise<void> {
  await Promise.all(ALL_ICE_CHITIN_GLBS.map((path) => AssetManager.loadAssetByPath(path, scene)));
}

/**
 * Create an Ice Chitin mesh from GLB model based on variant type.
 *
 * Variant models:
 * - drone: spider.glb - fast multi-legged crawler
 * - warrior: soldier.glb - armored ranged attacker
 * - brood_mother: tentakel.glb - massive boss creature
 *
 * An ice-blue frost tint is applied to all loaded meshes for the cryo-adapted
 * look, and a procedural frost-aura torus is added as a VFX indicator.
 */
export function createIceChitinMesh(
  scene: Scene,
  seed: number,
  variant: IceChitinVariant = 'warrior'
): TransformNode {
  const config = ICE_CHITIN_GLB_CONFIG[variant];
  const root = new TransformNode(`ice_${variant}_${seed}`, scene);

  // --- GLB body instance ---
  const bodyNode = AssetManager.createInstanceByPath(
    config.path,
    `ice_${variant}_body_${seed}`,
    scene,
    true,
    'enemy'
  );

  if (bodyNode) {
    bodyNode.parent = root;
    // Apply variant-specific scaling
    bodyNode.scaling.setAll(config.scale);
    // Position adjustment based on variant size
    const yOffset = variant === 'brood_mother' ? 1.2 : variant === 'drone' ? 0.4 : 0.7;
    bodyNode.position.y = yOffset;

    // Apply ice-blue frost tint to all body meshes
    applyIceTint(scene, bodyNode, seed);
  } else {
    log.warn(`GLB not loaded for ice_${variant}_${seed}, using empty root`);
  }

  // --- Frost Aura Indicator (VFX -- kept as MeshBuilder) ---
  // Diameter scales with variant size for visual clarity
  const auraScale = variant === 'brood_mother' ? 1.5 : variant === 'drone' ? 0.6 : 1.0;
  const auraRing = MeshBuilder.CreateTorus(
    'frost_aura_ring',
    {
      diameter: FROST_AURA.radius * 0.5 * auraScale,
      thickness: 0.03,
      tessellation: 24,
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
 * cryo-adapted white/blue coloring using PBR materials for realistic ice.
 */
function applyIceTint(scene: Scene, node: TransformNode, seed: number): void {
  const meshes = node.getChildMeshes(false);

  // Ice PBR properties - blue-white with emissive frost glow
  const iceAlbedo = new Color3(0.7, 0.85, 1.0);
  const iceEmissive = new Color3(0.2, 0.4, 0.6);
  const iceRoughness = 0.3;
  const iceMetallic = 0.1;

  for (const mesh of meshes) {
    // Create a new PBR ice material for each mesh
    const iceMat = new PBRMaterial(`ice_mat_${seed}_${mesh.name}`, scene);
    iceMat.albedoColor = iceAlbedo;
    iceMat.emissiveColor = iceEmissive;
    iceMat.roughness = iceRoughness;
    iceMat.metallic = iceMetallic;

    // Slight transparency for icy look
    iceMat.alpha = 0.95;

    // Subsurface scattering approximation for ice depth
    iceMat.subSurface.isTranslucencyEnabled = true;
    iceMat.subSurface.translucencyIntensity = 0.3;
    iceMat.subSurface.tintColor = new Color3(0.6, 0.8, 1.0);

    mesh.material = iceMat;
  }
}

/**
 * Create an ice shard projectile mesh for the ranged attack.
 * A sharp, translucent crystal shard.
 * (VFX -- kept as MeshBuilder for transient projectile effects)
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
 * Create a frost nova effect mesh for the brood mother's area attack.
 * An expanding ring of ice crystals.
 * (VFX -- kept as MeshBuilder for transient effect)
 */
export function createFrostNovaMesh(scene: Scene): TransformNode {
  const root = new TransformNode('frost_nova', scene);

  const novaMat = new StandardMaterial('frost_nova_mat', scene);
  novaMat.diffuseColor = new Color3(0.7, 0.9, 1.0);
  novaMat.alpha = 0.6;
  novaMat.emissiveColor = new Color3(0.3, 0.6, 0.9);
  novaMat.disableLighting = true;

  // Expanding ring
  const ring = MeshBuilder.CreateTorus(
    'nova_ring',
    {
      diameter: 2.0,
      thickness: 0.15,
      tessellation: 32,
    },
    scene
  );
  ring.material = novaMat;
  ring.parent = root;
  ring.rotation.x = Math.PI / 2;

  // Ice crystal spikes around the ring
  const spikeMat = new StandardMaterial('nova_spike_mat', scene);
  spikeMat.diffuseColor = new Color3(0.8, 0.95, 1.0);
  spikeMat.alpha = 0.7;
  spikeMat.emissiveColor = new Color3(0.2, 0.4, 0.7);

  const spikeCount = 12;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const spike = MeshBuilder.CreateCylinder(
      `nova_spike_${i}`,
      {
        height: 0.5,
        diameterTop: 0,
        diameterBottom: 0.08,
        tessellation: 4,
      },
      scene
    );
    spike.material = spikeMat;
    spike.parent = root;
    spike.position.set(Math.cos(angle), 0.25, Math.sin(angle));
    spike.rotation.z = angle + Math.PI / 2;
  }

  return root;
}

/**
 * Create the dormant ice cocoon mesh (frozen nest wrapping).
 *
 * Uses a crouched/scaled-down GLB alien body encased in procedural VFX
 * frost crystals and an inner glow, giving the appearance of a creature
 * frozen mid-hibernation inside an ice shell.
 */
export function createDormantCocoonMesh(
  scene: Scene,
  seed: number,
  variant: IceChitinVariant = 'warrior'
): TransformNode {
  const random = seededRandom(seed);
  const config = ICE_CHITIN_GLB_CONFIG[variant];
  const root = new TransformNode(`ice_cocoon_${variant}_${seed}`, scene);

  // --- GLB body as the frozen cocoon core ---
  const bodyNode = AssetManager.createInstanceByPath(
    config.path,
    `ice_cocoon_${variant}_body_${seed}`,
    scene,
    true,
    'enemy'
  );

  if (bodyNode) {
    bodyNode.parent = root;
    // Crouched/compressed pose scaled by variant
    // Less extreme ratio for more natural curled-up appearance
    const baseScale = config.scale * 0.7;
    const verticalSquish = variant === 'brood_mother' ? 0.6 : 0.55;
    bodyNode.scaling.set(baseScale, baseScale * verticalSquish, baseScale);
    const yOffset = variant === 'brood_mother' ? 0.7 : variant === 'drone' ? 0.25 : 0.45;
    bodyNode.position.y = yOffset;

    // Heavy frost overlay -- PBR ice encasement for frozen appearance
    const meshes = bodyNode.getChildMeshes(false);
    for (const mesh of meshes) {
      const frozenMat = new PBRMaterial(`frozen_mat_${seed}_${mesh.name}`, scene);
      frozenMat.albedoColor = new Color3(0.7, 0.82, 0.92);
      frozenMat.emissiveColor = new Color3(0.05, 0.1, 0.15);
      frozenMat.roughness = 0.2;
      frozenMat.metallic = 0.05;
      frozenMat.alpha = 0.5;

      // Strong translucency for deep-frozen look
      frozenMat.subSurface.isTranslucencyEnabled = true;
      frozenMat.subSurface.translucencyIntensity = 0.5;
      frozenMat.subSurface.tintColor = new Color3(0.5, 0.7, 0.9);

      mesh.material = frozenMat;
    }
  }

  // --- Surface frost crystals (VFX -- kept as MeshBuilder) ---
  // Crystal count and size scales with variant
  const variantScale = variant === 'brood_mother' ? 1.5 : variant === 'drone' ? 0.6 : 1.0;
  const crystalCount = Math.floor((5 + Math.floor(random() * 4)) * variantScale);
  const crystalMat = new StandardMaterial(`cocoon_crystal_${seed}`, scene);
  crystalMat.diffuseColor = new Color3(0.75, 0.88, 1.0);
  crystalMat.alpha = 0.65;
  crystalMat.emissiveColor = new Color3(0.1, 0.2, 0.35);
  crystalMat.specularColor = new Color3(0.8, 0.9, 1.0);
  crystalMat.specularPower = 128;

  for (let i = 0; i < crystalCount; i++) {
    const crystalHeight = (0.18 + random() * 0.25) * variantScale;
    const crystal = MeshBuilder.CreateCylinder(
      `cocoon_crystal_${i}`,
      {
        height: crystalHeight,
        diameterTop: 0,
        diameterBottom: (0.05 + random() * 0.04) * variantScale,
        tessellation: 4,
      },
      scene
    );
    crystal.material = crystalMat;
    crystal.parent = root;
    // Calculate angle first, then position based on angle
    const angle = (i / crystalCount) * Math.PI * 2;
    const radialDist = (0.55 + random() * 0.2) * variantScale;
    // Set position, then apply rotation - order matters for correct orientation
    crystal.position.set(
      Math.cos(angle) * radialDist,
      (0.65 + random() * 0.35) * variantScale,
      Math.sin(angle) * radialDist
    );
    // Tilt crystals outward from center for more natural formation
    crystal.rotation.x = (random() - 0.5) * 0.6;
    crystal.rotation.z = angle + (random() - 0.5) * 0.4;
  }

  // --- Faint inner glow (VFX -- kept as MeshBuilder) ---
  const glowSize = 0.3 * variantScale;
  const innerGlow = MeshBuilder.CreateSphere('inner_glow', { diameter: glowSize }, scene);
  const innerMat = new StandardMaterial(`cocoon_inner_${seed}`, scene);
  innerMat.emissiveColor = new Color3(0.15, 0.5, 0.7);
  innerMat.disableLighting = true;
  innerMat.alpha = 0.25;
  innerGlow.material = innerMat;
  innerGlow.parent = root;
  innerGlow.position.y = 0.8 * variantScale;

  return root;
}
