import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { Vehicle } from 'yuka';
import { AssetManager } from '../core/AssetManager';
import {
  type DifficultyLevel,
  loadDifficultySetting,
  scaleDetectionRange,
  scaleEnemyFireRate,
  scaleEnemyHealth,
} from '../core/DifficultySettings';
import { createEntity, type Entity } from '../core/ecs';

// ---------------------------------------------------------------------------
// GLB model paths and per-species scale factors
// ---------------------------------------------------------------------------

/** Map each alien species to its GLB file path and scale factor */
const SPECIES_GLB_CONFIG: Record<string, { path: string; scale: number }> = {
  skitterer: { path: '/models/enemies/chitin/spider.glb', scale: 0.4 },
  lurker: { path: '/models/enemies/chitin/scout.glb', scale: 0.7 },
  spewer: { path: '/models/enemies/chitin/soldier.glb', scale: 0.6 },
  husk: { path: '/models/enemies/chitin/alienmale.glb', scale: 0.6 },
  broodmother: { path: '/models/enemies/chitin/tentakel.glb', scale: 1.0 },
};

// Alien species definitions - creepy, surreal, procedurally generated
export interface AlienSpecies {
  id: string;
  name: string;
  designation: string;
  description: string;
  baseHealth: number;
  baseDamage: number;
  moveSpeed: number;
  attackRange: number;
  alertRadius: number;
  fireRate: number;
  projectileSpeed: number;
  xpValue: number;
  lootTable: LootEntry[];
  // Hit reaction properties
  hitReactionDuration: number; // ms of stagger animation
  painSounds: string[]; // Array of pain sound IDs
  deathAnimations: string[]; // Array of death animation IDs
  knockbackResistance: number; // 0-1, resistance to knockback force
}

export interface LootEntry {
  itemId: string;
  dropChance: number; // 0-1
  minQuantity: number;
  maxQuantity: number;
}

// The five alien species of Kepler's Promise
export const ALIEN_SPECIES: Record<string, AlienSpecies> = {
  // Skitterer - Fast, weak, swarm creatures
  skitterer: {
    id: 'skitterer',
    name: 'Skitterer',
    designation: 'STRAIN-X1',
    description: 'Multi-legged crawler. Fast and numerous. Weak individually but deadly in swarms.',
    baseHealth: 170, // Aligned with CombatBalanceConfig for 0.85s TTK target
    baseDamage: 8,
    moveSpeed: 18,
    attackRange: 8,
    alertRadius: 30,
    fireRate: 4,
    projectileSpeed: 25,
    xpValue: 10,
    lootTable: [
      { itemId: 'chitin_shard', dropChance: 0.8, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'bio_sample', dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
    ],
    // Hit reactions - small and light, staggers easily
    hitReactionDuration: 80,
    painSounds: ['alien_chittering', 'organic_squish', 'alien_hiss'],
    deathAnimations: ['death_collapse', 'death_explode', 'death_ragdoll'],
    knockbackResistance: 0.1, // Very low resistance - flies back easily
  },

  // Lurker - Tall, thin, stalks from shadows
  lurker: {
    id: 'lurker',
    name: 'Lurker',
    designation: 'STRAIN-X2',
    description: 'Elongated humanoid form. Stalks prey silently. Attacks with extending limbs.',
    baseHealth: 380, // Aligned with CombatBalanceConfig for 1.9s TTK target
    baseDamage: 15,
    moveSpeed: 10,
    attackRange: 15,
    alertRadius: 50,
    fireRate: 1.5,
    projectileSpeed: 35,
    xpValue: 35,
    lootTable: [
      { itemId: 'shadow_membrane', dropChance: 0.5, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'neural_cluster', dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'bio_sample', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    ],
    // Hit reactions - lean and agile, moderate stagger
    hitReactionDuration: 120,
    painSounds: ['alien_hiss', 'alien_screech', 'alien_growl'],
    deathAnimations: ['death_collapse', 'death_dissolve', 'death_ragdoll'],
    knockbackResistance: 0.35, // Moderate resistance
  },

  // Spewer - Bloated, acid-spitting horror
  spewer: {
    id: 'spewer',
    name: 'Spewer',
    designation: 'STRAIN-X3',
    description: 'Bloated sac creature. Sprays corrosive acid from multiple orifices.',
    baseHealth: 680, // Aligned with CombatBalanceConfig for 3.4s TTK target
    baseDamage: 12,
    moveSpeed: 6,
    attackRange: 25,
    alertRadius: 35,
    fireRate: 0.8,
    projectileSpeed: 20,
    xpValue: 50,
    lootTable: [
      { itemId: 'acid_gland', dropChance: 0.7, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'caustic_residue', dropChance: 0.4, minQuantity: 2, maxQuantity: 5 },
      { itemId: 'bio_sample', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    ],
    // Hit reactions - heavy and bloated, resists stagger
    hitReactionDuration: 60,
    painSounds: ['organic_squish', 'alien_gurgle', 'alien_hiss'],
    deathAnimations: ['death_explode', 'death_acid_burst', 'death_collapse'],
    knockbackResistance: 0.7, // High resistance - heavy mass
  },

  // Husk - Dessicated, fast, screaming horror
  husk: {
    id: 'husk',
    name: 'Husk',
    designation: 'STRAIN-X4',
    description: 'Dried, mummified form. Emits disorienting screech. Relentless pursuit.',
    baseHealth: 340, // Aligned with CombatBalanceConfig for 1.7s TTK target
    baseDamage: 18,
    moveSpeed: 14,
    attackRange: 10,
    alertRadius: 60,
    fireRate: 2,
    projectileSpeed: 30,
    xpValue: 40,
    lootTable: [
      { itemId: 'desiccated_tissue', dropChance: 0.6, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'resonance_crystal', dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'bio_sample', dropChance: 0.35, minQuantity: 1, maxQuantity: 2 },
    ],
    // Hit reactions - dried/brittle, brief stagger with screech
    hitReactionDuration: 100,
    painSounds: ['alien_screech', 'alien_hiss', 'alien_chittering'],
    deathAnimations: ['death_shatter', 'death_collapse', 'death_ragdoll'],
    knockbackResistance: 0.25, // Light frame, moderate knockback
  },

  // Broodmother - Large, spawns skitterers, mini-boss
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    designation: 'STRAIN-X5',
    description: 'Massive egg-layer. Produces Skitterers continuously. Priority target.',
    baseHealth: 2500, // Aligned with CombatBalanceConfig - boss tier
    baseDamage: 25,
    moveSpeed: 4,
    attackRange: 20,
    alertRadius: 45,
    fireRate: 0.5,
    projectileSpeed: 15,
    xpValue: 150,
    lootTable: [
      { itemId: 'brood_sac', dropChance: 1.0, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'queen_pheromone', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'chitin_plate', dropChance: 0.8, minQuantity: 2, maxQuantity: 4 },
      { itemId: 'bio_sample', dropChance: 0.5, minQuantity: 2, maxQuantity: 3 },
    ],
    // Hit reactions - massive boss, barely staggers
    hitReactionDuration: 40,
    painSounds: ['alien_roar', 'alien_growl', 'organic_squish'],
    deathAnimations: ['death_epic_collapse', 'death_explode_massive', 'death_dissolve'],
    knockbackResistance: 0.95, // Nearly immune to knockback
  },
};

// ---------------------------------------------------------------------------
// Hit Reaction Configuration
// ---------------------------------------------------------------------------

/**
 * Get species-specific hit reaction configuration.
 * Returns reaction properties for applying stagger, pain sounds, and knockback.
 */
export function getHitReactionConfig(speciesId: string): {
  duration: number;
  painSounds: string[];
  knockbackResistance: number;
} {
  const species = ALIEN_SPECIES[speciesId];
  if (!species) {
    return {
      duration: 100,
      painSounds: ['organic_squish'],
      knockbackResistance: 0.5,
    };
  }
  return {
    duration: species.hitReactionDuration,
    painSounds: species.painSounds,
    knockbackResistance: species.knockbackResistance,
  };
}

/**
 * Get a random pain sound for a species.
 * Returns a sound ID from the species' pain sounds array.
 */
export function getRandomPainSound(speciesId: string): string {
  const species = ALIEN_SPECIES[speciesId];
  if (!species || species.painSounds.length === 0) {
    return 'organic_squish';
  }
  const index = Math.floor(Math.random() * species.painSounds.length);
  return species.painSounds[index];
}

/**
 * Get a random death animation for a species.
 * Returns an animation ID from the species' death animations array.
 */
export function getRandomDeathAnimation(speciesId: string): string {
  const species = ALIEN_SPECIES[speciesId];
  if (!species || species.deathAnimations.length === 0) {
    return 'death_collapse';
  }
  const index = Math.floor(Math.random() * species.deathAnimations.length);
  return species.deathAnimations[index];
}

/**
 * Calculate knockback force for a species based on weapon damage.
 * @param speciesId - The species to calculate knockback for
 * @param weaponDamage - The damage dealt by the weapon
 * @returns The knockback force to apply (0 = no knockback)
 */
export function calculateKnockbackForce(speciesId: string, weaponDamage: number): number {
  const species = ALIEN_SPECIES[speciesId];
  const resistance = species?.knockbackResistance ?? 0.5;

  // Base knockback scales with damage, reduced by resistance
  const baseKnockback = weaponDamage * 0.05;
  const finalKnockback = baseKnockback * (1 - resistance);

  // Clamp to reasonable range
  return Math.min(Math.max(finalKnockback, 0), 3);
}

// ---------------------------------------------------------------------------
// GLB mesh loading
// ---------------------------------------------------------------------------

/**
 * Load an alien mesh from a GLB model.
 * Uses AssetManager's path-based caching so repeated spawns of the same
 * species reuse the already-loaded source geometry (instancing).
 */
export async function createAlienMesh(
  scene: Scene,
  species: AlienSpecies,
  seed: number
): Promise<TransformNode> {
  const config = SPECIES_GLB_CONFIG[species.id];
  if (!config) {
    throw new Error(`[Aliens] No GLB config for species '${species.id}'`);
  }

  const instanceName = `alien_${species.id}_${seed}`;

  // Ensure the GLB is loaded (cached after first load)
  if (!AssetManager.isPathCached(config.path)) {
    await AssetManager.loadAssetByPath(config.path, scene);
  }

  // Create an instance from the cached source
  const instance = AssetManager.createInstanceByPath(
    config.path,
    instanceName,
    scene,
    true, // applyLOD
    'enemy'
  );

  if (!instance) {
    throw new Error(
      `[Aliens] Failed to create GLB instance for species '${species.id}' from path '${config.path}'. ` +
        `Ensure the GLB file exists and has valid geometry. ` +
        `Is path cached: ${AssetManager.isPathCached(config.path)}`
    );
  }

  instance.scaling.setAll(config.scale);
  return instance;
}

// ---------------------------------------------------------------------------
// Entity creation (async — GLB loading is inherently async)
// ---------------------------------------------------------------------------

/**
 * Create an alien entity with GLB model and full ECS integration.
 * Stats are scaled based on current difficulty setting.
 *
 * This is the primary spawn function. All callers should `await` it.
 * The legacy sync `createAlienEntity` name is kept as an alias for
 * backward-compatible call-sites that are already being migrated to async.
 */
export async function createAlienEntityAsync(
  scene: Scene,
  species: AlienSpecies,
  position: Vector3,
  seed: number = Date.now(),
  difficulty?: DifficultyLevel
): Promise<Entity> {
  const mesh = await createAlienMesh(scene, species, seed);
  mesh.position = position.clone();

  // Use provided difficulty or load from settings
  const currentDifficulty = difficulty ?? loadDifficultySetting();

  // Apply difficulty scaling to stats
  const scaledHealth = scaleEnemyHealth(species.baseHealth, currentDifficulty);
  const scaledFireRate = scaleEnemyFireRate(species.fireRate, currentDifficulty);
  const scaledAlertRadius = scaleDetectionRange(species.alertRadius, currentDifficulty);

  const vehicle = new Vehicle();
  vehicle.maxSpeed = species.moveSpeed;

  return createEntity({
    transform: {
      position: position.clone(),
      rotation: Vector3.Zero(),
      scale: new Vector3(1, 1, 1),
    },
    health: {
      current: scaledHealth,
      max: scaledHealth,
      regenRate: 0,
    },
    velocity: {
      linear: Vector3.Zero(),
      angular: Vector3.Zero(),
      maxSpeed: species.moveSpeed,
    },
    combat: {
      damage: species.baseDamage, // Damage scaling applied at attack time in combat system
      range: species.attackRange,
      fireRate: scaledFireRate,
      lastFire: 0,
      projectileSpeed: species.projectileSpeed,
    },
    ai: {
      vehicle,
      behaviors: [],
      state: 'patrol',
      target: null,
      alertRadius: scaledAlertRadius,
      attackRadius: species.attackRange,
    },
    renderable: {
      mesh,
      visible: true,
    },
    tags: {
      enemy: true,
      alien: true,
      boss: species.id === 'broodmother',
    },
    alienInfo: {
      speciesId: species.id,
      seed,
      xpValue: species.xpValue,
      lootTable: species.lootTable,
    },
  });
}

/**
 * Alias kept for call-sites that still reference the old sync name.
 * Returns a Promise now -- callers must be updated to `await` it.
 */
export const createAlienEntity = createAlienEntityAsync;
