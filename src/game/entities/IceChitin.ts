/**
 * IceChitin - Ice-adapted Chitin enemy variant for the Southern Ice level
 *
 * Three sub-variants:
 *   1. Ice Drone    - Fast, melee + ice shard ranged attack
 *   2. Ice Warrior  - Tanky, frost aura + charge attack
 *   3. Ice Brood Mother - Boss-tier, spawns ice drones, frost nova AOE
 *
 * All variants share:
 *   - White/ice-blue coloring with frost overlay materials
 *   - Crystalline ice armor plates (additional mesh pieces)
 *   - Ice crystal shatter death effect
 *   - 50% resistance to plasma/energy, 150% damage from kinetic
 *   - Burrow ability (dig into ice, emerge elsewhere)
 *   - Crystalline chittering audio profile
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { Vehicle } from 'yuka';

import {
  type DifficultyLevel,
  loadDifficultySetting,
  scaleDetectionRange,
  scaleEnemyFireRate,
  scaleEnemyHealth,
} from '../core/DifficultySettings';
import { createEntity, type Entity, getEntitiesInRadius } from '../core/ecs';
import { LODManager } from '../core/LODManager';
import { particleManager } from '../effects/ParticleManager';
import type { AlienSpecies, LootEntry } from './aliens';

// ---------------------------------------------------------------------------
// DAMAGE TYPE CONSTANTS
// ---------------------------------------------------------------------------

/** Weapon damage categories recognised by the resistance system. */
export type DamageType = 'kinetic' | 'plasma' | 'energy' | 'explosive' | 'ice';

/** Multiplier map: values < 1 mean resistance, > 1 mean vulnerability. */
export const ICE_CHITIN_RESISTANCES: Record<DamageType, number> = {
  kinetic: 1.5, // 150 % damage taken from bullets / shotguns
  plasma: 0.5, // 50 % damage taken from plasma weapons
  energy: 0.5, // 50 % damage taken from energy weapons
  explosive: 1.0, // Neutral
  ice: 0.0, // Immune to own element
};

// ---------------------------------------------------------------------------
// ICE CHITIN VARIANT ENUM
// ---------------------------------------------------------------------------

export type IceChitinVariant = 'ice_drone' | 'ice_warrior' | 'ice_brood_mother';

// ---------------------------------------------------------------------------
// SPECIES DEFINITIONS
// ---------------------------------------------------------------------------

export interface IceChitinSpecies extends AlienSpecies {
  variant: IceChitinVariant;
  /** Passive frost aura radius (0 = none) */
  frostAuraRadius: number;
  /** Frost aura slow percentage (0-1) */
  frostAuraSlow: number;
  /** Whether this variant can burrow */
  canBurrow: boolean;
  /** Burrow cooldown in milliseconds */
  burrowCooldownMs: number;
  /** Number of ice drones spawned (Brood Mother only) */
  spawnCount: number;
  /** Frost nova radius (Brood Mother only, 0 = none) */
  frostNovaRadius: number;
  /** Frost nova damage */
  frostNovaDamage: number;
  /** Frost nova cooldown in milliseconds */
  frostNovaCooldownMs: number;
}

// Shared loot entries for ice chitin drops
const ICE_CHITIN_LOOT_BASE: LootEntry[] = [
  { itemId: 'cryo_chitin', dropChance: 0.8, minQuantity: 1, maxQuantity: 3 },
  { itemId: 'ice_crystal_shard', dropChance: 0.5, minQuantity: 1, maxQuantity: 2 },
  { itemId: 'bio_sample', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
];

export const ICE_CHITIN_SPECIES: Record<IceChitinVariant, IceChitinSpecies> = {
  // ------------------------------------------------------------------
  // 1. Ice Drone - fast, fragile, melee + ice shard ranged
  // ------------------------------------------------------------------
  ice_drone: {
    id: 'ice_drone',
    variant: 'ice_drone',
    name: 'Ice Drone',
    designation: 'STRAIN-ICE-1',
    description:
      'Flash-frozen Chitin variant. Fires razor-sharp ice shards and closes distance fast.',
    baseHealth: 40,
    baseDamage: 8,
    moveSpeed: 20,
    attackRange: 18,
    alertRadius: 35,
    fireRate: 3,
    projectileSpeed: 30,
    xpValue: 20,
    frostAuraRadius: 0,
    frostAuraSlow: 0,
    canBurrow: true,
    burrowCooldownMs: 8_000,
    spawnCount: 0,
    frostNovaRadius: 0,
    frostNovaDamage: 0,
    frostNovaCooldownMs: 0,
    lootTable: ICE_CHITIN_LOOT_BASE,
  },

  // ------------------------------------------------------------------
  // 2. Ice Warrior - tanky, frost aura + charge attack
  // ------------------------------------------------------------------
  ice_warrior: {
    id: 'ice_warrior',
    variant: 'ice_warrior',
    name: 'Ice Warrior',
    designation: 'STRAIN-ICE-2',
    description:
      'Armoured cryo-chitin. Projects a passive frost aura. Charges through ice with devastating force.',
    baseHealth: 160,
    baseDamage: 30,
    moveSpeed: 10,
    attackRange: 12,
    alertRadius: 40,
    fireRate: 1.2,
    projectileSpeed: 22,
    xpValue: 60,
    frostAuraRadius: 8,
    frostAuraSlow: 0.35,
    canBurrow: true,
    burrowCooldownMs: 12_000,
    spawnCount: 0,
    frostNovaRadius: 0,
    frostNovaDamage: 0,
    frostNovaCooldownMs: 0,
    lootTable: [
      ...ICE_CHITIN_LOOT_BASE,
      { itemId: 'cryo_plate', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    ],
  },

  // ------------------------------------------------------------------
  // 3. Ice Brood Mother - boss-tier, spawns drones, frost nova
  // ------------------------------------------------------------------
  ice_brood_mother: {
    id: 'ice_brood_mother',
    variant: 'ice_brood_mother',
    name: 'Ice Brood Mother',
    designation: 'STRAIN-ICE-X',
    description:
      'Massive cryo-matriarch. Spawns Ice Drones and unleashes devastating frost nova blasts.',
    baseHealth: 450,
    baseDamage: 40,
    moveSpeed: 4,
    attackRange: 22,
    alertRadius: 55,
    fireRate: 0.5,
    projectileSpeed: 18,
    xpValue: 200,
    frostAuraRadius: 12,
    frostAuraSlow: 0.5,
    canBurrow: false, // Too large to burrow
    burrowCooldownMs: 0,
    spawnCount: 3,
    frostNovaRadius: 15,
    frostNovaDamage: 25,
    frostNovaCooldownMs: 10_000,
    lootTable: [
      { itemId: 'cryo_core', dropChance: 1.0, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'matriarch_ice_gland', dropChance: 0.5, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'cryo_chitin', dropChance: 0.9, minQuantity: 3, maxQuantity: 6 },
      { itemId: 'ice_crystal_shard', dropChance: 0.7, minQuantity: 2, maxQuantity: 4 },
      { itemId: 'bio_sample', dropChance: 0.5, minQuantity: 2, maxQuantity: 3 },
    ],
  },
};

// ---------------------------------------------------------------------------
// SEEDED RANDOM  (matches aliens.ts)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// MATERIAL PALETTE
// ---------------------------------------------------------------------------

interface IceMaterials {
  baseMat: StandardMaterial;
  armorMat: StandardMaterial;
  glowMat: StandardMaterial;
  frostMat: StandardMaterial;
}

function createIceMaterials(scene: Scene, variant: IceChitinVariant): IceMaterials {
  const prefix = `iceChitin_${variant}`;

  // Base organic chitin - pale white-blue
  const baseMat = new StandardMaterial(`${prefix}_base`, scene);
  baseMat.diffuseColor = new Color3(0.85, 0.9, 0.95);
  baseMat.specularColor = new Color3(0.6, 0.7, 0.8);
  baseMat.specularPower = 64;

  // Crystalline armor plates - translucent ice
  const armorMat = new StandardMaterial(`${prefix}_armor`, scene);
  armorMat.diffuseColor = new Color3(0.6, 0.78, 0.92);
  armorMat.specularColor = new Color3(0.9, 0.95, 1.0);
  armorMat.specularPower = 128;
  armorMat.alpha = 0.85;
  armorMat.emissiveColor = new Color3(0.15, 0.25, 0.4);

  // Glowing eyes / accents - bright cyan
  const glowMat = new StandardMaterial(`${prefix}_glow`, scene);
  glowMat.emissiveColor = new Color3(0.4, 0.85, 1.0);
  glowMat.disableLighting = true;

  // Frost overlay - faint icy sheen for surface details
  const frostMat = new StandardMaterial(`${prefix}_frost`, scene);
  frostMat.diffuseColor = new Color3(0.9, 0.95, 1.0);
  frostMat.alpha = 0.4;
  frostMat.emissiveColor = new Color3(0.2, 0.35, 0.5);
  frostMat.backFaceCulling = false;

  return { baseMat, armorMat, glowMat, frostMat };
}

// ---------------------------------------------------------------------------
// ICE ARMOR PLATE HELPER
// ---------------------------------------------------------------------------

/** Attach crystalline armor plates to a parent node. */
function attachArmorPlates(
  scene: Scene,
  parent: TransformNode,
  mat: StandardMaterial,
  count: number,
  radius: number,
  heightRange: [number, number],
  random: () => number
): void {
  for (let i = 0; i < count; i++) {
    const plate = MeshBuilder.CreatePolyhedron(
      'armorPlate',
      { type: 1, size: 0.08 + random() * 0.12 },
      scene
    );
    plate.material = mat;
    plate.parent = parent;

    const angle = (i / count) * Math.PI * 2 + random() * 0.3;
    const yPos = heightRange[0] + random() * (heightRange[1] - heightRange[0]);
    plate.position.set(Math.cos(angle) * radius, yPos, Math.sin(angle) * radius);
    plate.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
  }
}

// ---------------------------------------------------------------------------
// PROCEDURAL MESH BUILDERS  (per-variant)
// ---------------------------------------------------------------------------

function createIceDroneMesh(scene: Scene, mats: IceMaterials, random: () => number): TransformNode {
  const root = new TransformNode('iceChitin_drone', scene);

  // Central body - flattened sphere, icy coloring
  const body = MeshBuilder.CreateSphere(
    'body',
    {
      diameterX: 0.75 + random() * 0.15,
      diameterY: 0.35 + random() * 0.08,
      diameterZ: 0.6 + random() * 0.15,
      segments: 8,
    },
    scene
  );
  body.material = mats.baseMat;
  body.parent = root;
  body.position.y = 0.3;

  // Ice armor plates on body
  attachArmorPlates(scene, body, mats.armorMat, 5, 0.3, [-0.1, 0.15], random);

  // Glowing eyes (4-6)
  const eyeCount = 4 + Math.floor(random() * 3);
  for (let i = 0; i < eyeCount; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.06 + random() * 0.03 }, scene);
    eye.material = mats.glowMat;
    eye.parent = body;
    const angle = (i / eyeCount) * Math.PI * 0.6 - Math.PI * 0.3;
    eye.position.set(Math.sin(angle) * 0.28, 0.08 + random() * 0.08, -0.22 - random() * 0.08);
  }

  // 6-8 legs (spider-like, icy)
  const legCount = 6 + Math.floor(random() * 3);
  for (let i = 0; i < legCount; i++) {
    const side = i < legCount / 2 ? 1 : -1;
    const idx = i % Math.ceil(legCount / 2);
    const angle = (idx / Math.ceil(legCount / 2)) * Math.PI * 0.6 + Math.PI * 0.2;

    const upperLeg = MeshBuilder.CreateCylinder(
      'upperLeg',
      { height: 0.45 + random() * 0.15, diameterTop: 0.035, diameterBottom: 0.05, tessellation: 6 },
      scene
    );
    upperLeg.material = mats.baseMat;
    upperLeg.parent = root;
    upperLeg.position.set(side * 0.28, 0.38, Math.cos(angle) * 0.18);
    upperLeg.rotation.z = side * (Math.PI / 3 + random() * 0.15);
    upperLeg.rotation.y = angle;

    const lowerLeg = MeshBuilder.CreateCylinder(
      'lowerLeg',
      {
        height: 0.35 + random() * 0.15,
        diameterTop: 0.025,
        diameterBottom: 0.015,
        tessellation: 6,
      },
      scene
    );
    lowerLeg.material = mats.baseMat;
    lowerLeg.parent = upperLeg;
    lowerLeg.position.y = -0.3;
    lowerLeg.rotation.z = -side * (Math.PI / 4);

    // Ice crystal tip on foot
    const tip = MeshBuilder.CreatePolyhedron('tip', { type: 1, size: 0.02 }, scene);
    tip.material = mats.armorMat;
    tip.parent = lowerLeg;
    tip.position.y = -0.2;
  }

  // Mandibles with ice crystal tips
  for (let i = 0; i < 2; i++) {
    const mandible = MeshBuilder.CreateCylinder(
      'mandible',
      { height: 0.18, diameterTop: 0.015, diameterBottom: 0.035, tessellation: 4 },
      scene
    );
    mandible.material = mats.armorMat;
    mandible.parent = body;
    mandible.position.set((i - 0.5) * 0.12, -0.08, -0.3);
    mandible.rotation.x = Math.PI / 4;
    mandible.rotation.z = (i - 0.5) * 0.3;
  }

  // Frost overlay shell
  const frostShell = MeshBuilder.CreateSphere(
    'frostShell',
    { diameterX: 0.9, diameterY: 0.45, diameterZ: 0.7, segments: 6 },
    scene
  );
  frostShell.material = mats.frostMat;
  frostShell.parent = body;

  return root;
}

function createIceWarriorMesh(
  scene: Scene,
  mats: IceMaterials,
  random: () => number
): TransformNode {
  const root = new TransformNode('iceChitin_warrior', scene);

  // Upright torso - thick
  const torso = MeshBuilder.CreateCylinder(
    'torso',
    {
      height: 1.3 + random() * 0.2,
      diameterTop: 0.45,
      diameterBottom: 0.6,
      tessellation: 8,
    },
    scene
  );
  torso.material = mats.baseMat;
  torso.parent = root;
  torso.position.y = 1;

  // Heavy ice armor plates across torso
  attachArmorPlates(scene, torso, mats.armorMat, 8, 0.3, [-0.4, 0.5], random);

  // Head - angular, armoured
  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameterX: 0.45,
      diameterY: 0.5 + random() * 0.08,
      diameterZ: 0.4,
      segments: 8,
    },
    scene
  );
  head.material = mats.baseMat;
  head.parent = root;
  head.position.y = 1.9;

  // Ice crest on head
  const crest = MeshBuilder.CreatePolyhedron('crest', { type: 2, size: 0.15 }, scene);
  crest.material = mats.armorMat;
  crest.parent = head;
  crest.position.y = 0.25;
  crest.rotation.x = random() * 0.3;

  // Glowing eyes (2 large)
  for (let i = 0; i < 2; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.12 }, scene);
    eye.material = mats.glowMat;
    eye.parent = head;
    eye.position.set((i - 0.5) * 0.2, 0.04, -0.14);
  }

  // Heavy arms with ice blades
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const upperArm = MeshBuilder.CreateCylinder(
      'upperArm',
      { height: 0.7 + random() * 0.15, diameterTop: 0.08, diameterBottom: 0.1, tessellation: 6 },
      scene
    );
    upperArm.material = mats.baseMat;
    upperArm.parent = root;
    upperArm.position.set(side * 0.4, 1.5, 0);
    upperArm.rotation.z = (side * Math.PI) / 5;

    const forearm = MeshBuilder.CreateCylinder(
      'forearm',
      { height: 0.8 + random() * 0.2, diameterTop: 0.06, diameterBottom: 0.08, tessellation: 6 },
      scene
    );
    forearm.material = mats.baseMat;
    forearm.parent = upperArm;
    forearm.position.y = -0.5;
    forearm.rotation.z = (side * Math.PI) / 7;

    // Ice blade on forearm end
    const blade = MeshBuilder.CreateCylinder(
      'blade',
      { height: 0.35, diameterTop: 0.01, diameterBottom: 0.06, tessellation: 4 },
      scene
    );
    blade.material = mats.armorMat;
    blade.parent = forearm;
    blade.position.y = -0.5;
    blade.rotation.x = -Math.PI / 6;
  }

  // Thick legs
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const leg = MeshBuilder.CreateCylinder(
      'leg',
      { height: 0.75, diameterTop: 0.12, diameterBottom: 0.08, tessellation: 6 },
      scene
    );
    leg.material = mats.baseMat;
    leg.parent = root;
    leg.position.set(side * 0.18, 0.38, 0);

    // Armored knee plate
    const knee = MeshBuilder.CreatePolyhedron('knee', { type: 1, size: 0.04 }, scene);
    knee.material = mats.armorMat;
    knee.parent = leg;
    knee.position.set(side * 0.04, 0.1, -0.05);
  }

  // Frost overlay torso shell
  const frostShell = MeshBuilder.CreateCylinder(
    'frostShell',
    { height: 1.5, diameterTop: 0.55, diameterBottom: 0.7, tessellation: 8 },
    scene
  );
  frostShell.material = mats.frostMat;
  frostShell.parent = torso;

  return root;
}

function createIceBroodMotherMesh(
  scene: Scene,
  mats: IceMaterials,
  random: () => number
): TransformNode {
  const root = new TransformNode('iceChitin_broodMother', scene);

  // Massive egg sac body
  const body = MeshBuilder.CreateSphere(
    'body',
    {
      diameterX: 2.2 + random() * 0.4,
      diameterY: 1.6 + random() * 0.25,
      diameterZ: 1.8 + random() * 0.3,
      segments: 16,
    },
    scene
  );
  body.material = mats.baseMat;
  body.parent = root;
  body.position.y = 1.1;

  // Translucent frozen egg sacs
  const eggMat = new StandardMaterial('iceEggMat', scene);
  eggMat.diffuseColor = new Color3(0.6, 0.75, 0.9);
  eggMat.alpha = 0.5;
  eggMat.emissiveColor = new Color3(0.15, 0.3, 0.45);

  for (let i = 0; i < 6; i++) {
    const egg = MeshBuilder.CreateSphere(
      'egg',
      { diameter: 0.2 + random() * 0.12, segments: 8 },
      scene
    );
    egg.material = eggMat;
    egg.parent = body;

    const angle = (i / 6) * Math.PI * 2;
    const vertAngle = random() * Math.PI - Math.PI / 2;
    egg.position.set(
      Math.cos(angle) * (0.7 + random() * 0.25),
      Math.sin(vertAngle) * 0.25,
      Math.sin(angle) * (0.7 + random() * 0.25)
    );

    // Embryo glow inside
    const embryo = MeshBuilder.CreateSphere('embryo', { diameter: 0.08 }, scene);
    embryo.material = mats.glowMat;
    embryo.parent = egg;
  }

  // Heavy ice armor across body
  attachArmorPlates(scene, body, mats.armorMat, 12, 0.85, [-0.5, 0.5], random);

  // Upper thorax
  const thorax = MeshBuilder.CreateCylinder(
    'thorax',
    { height: 0.7, diameterTop: 0.5, diameterBottom: 0.75, tessellation: 8 },
    scene
  );
  thorax.material = mats.baseMat;
  thorax.parent = root;
  thorax.position.set(0, 2.2, -0.45);
  thorax.rotation.x = -0.25;

  // Head with crown of ice crystals
  const head = MeshBuilder.CreateSphere(
    'head',
    { diameterX: 0.55, diameterY: 0.45, diameterZ: 0.45, segments: 10 },
    scene
  );
  head.material = mats.baseMat;
  head.parent = root;
  head.position.set(0, 2.7, -0.7);

  // Crown of ice crystals
  for (let i = 0; i < 5; i++) {
    const crystal = MeshBuilder.CreateCylinder(
      'crystal',
      {
        height: 0.2 + random() * 0.15,
        diameterTop: 0.01,
        diameterBottom: 0.04 + random() * 0.02,
        tessellation: 4,
      },
      scene
    );
    crystal.material = mats.armorMat;
    crystal.parent = head;
    const angle = (i / 5) * Math.PI - Math.PI / 2;
    crystal.position.set(Math.sin(angle) * 0.2, 0.2, Math.cos(angle) * 0.15);
    crystal.rotation.z = Math.sin(angle) * 0.4;
  }

  // Multiple glowing eyes in crown pattern
  for (let i = 0; i < 6; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.08 + (i < 2 ? 0.04 : 0) }, scene);
    eye.material = mats.glowMat;
    eye.parent = head;
    const angle = (i / 6) * Math.PI * 1.4 - Math.PI * 0.7;
    eye.position.set(
      Math.sin(angle) * 0.22,
      0.08 + (i < 3 ? 0.04 : -0.04),
      Math.cos(angle) * 0.18 - 0.08
    );
  }

  // Large manipulator arms with ice pincers
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const arm = MeshBuilder.CreateCylinder(
      'arm',
      { height: 1.0, diameterTop: 0.1, diameterBottom: 0.14, tessellation: 6 },
      scene
    );
    arm.material = mats.baseMat;
    arm.parent = root;
    arm.position.set(side * 0.5, 2.1, -0.25);
    arm.rotation.z = (side * Math.PI) / 4;
    arm.rotation.x = -0.2;

    // Ice pincer claws
    for (let j = 0; j < 2; j++) {
      const pincer = MeshBuilder.CreateCylinder(
        'pincer',
        { height: 0.25, diameterTop: 0.015, diameterBottom: 0.05, tessellation: 4 },
        scene
      );
      pincer.material = mats.armorMat;
      pincer.parent = arm;
      pincer.position.set((j - 0.5) * 0.07, -0.6, 0);
      pincer.rotation.z = (j - 0.5) * 0.35;
    }
  }

  // Multiple stumpy legs
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leg = MeshBuilder.CreateCylinder(
      'leg',
      { height: 0.55, diameterTop: 0.11, diameterBottom: 0.07, tessellation: 6 },
      scene
    );
    leg.material = mats.baseMat;
    leg.parent = root;
    leg.position.set(Math.cos(angle) * 0.75, 0.28, Math.sin(angle) * 0.75);
    leg.rotation.z = Math.cos(angle) * 0.3;
    leg.rotation.x = -Math.sin(angle) * 0.3;
  }

  // Full frost overlay
  const frostShell = MeshBuilder.CreateSphere(
    'frostShell',
    { diameterX: 2.6, diameterY: 1.9, diameterZ: 2.1, segments: 8 },
    scene
  );
  frostShell.material = mats.frostMat;
  frostShell.parent = body;

  return root;
}

// ---------------------------------------------------------------------------
// PUBLIC: CREATE MESH
// ---------------------------------------------------------------------------

export function createIceChitinMesh(
  scene: Scene,
  species: IceChitinSpecies,
  seed: number
): TransformNode {
  const random = seededRandom(seed);
  const mats = createIceMaterials(scene, species.variant);

  switch (species.variant) {
    case 'ice_drone':
      return createIceDroneMesh(scene, mats, random);
    case 'ice_warrior':
      return createIceWarriorMesh(scene, mats, random);
    case 'ice_brood_mother':
      return createIceBroodMotherMesh(scene, mats, random);
  }
}

// ---------------------------------------------------------------------------
// ICE CHITIN RUNTIME STATE (attached alongside ECS entity)
// ---------------------------------------------------------------------------

/**
 * Additional runtime state for Ice Chitin entities, stored in a side Map
 * keyed by entity id. This avoids polluting the core Entity interface.
 */
export interface IceChitinState {
  variant: IceChitinVariant;
  species: IceChitinSpecies;

  // Burrow
  isBurrowed: boolean;
  burrowCooldownEnd: number;
  burrowDurationEnd: number;
  burrowTarget: Vector3 | null;

  // Frost aura
  frostAuraActive: boolean;
  frostAuraLight: PointLight | null;

  // Frost nova (Brood Mother)
  frostNovaCooldownEnd: number;

  // Spawn tracking (Brood Mother)
  lastSpawnTime: number;
  spawnedDrones: Entity[];
}

/** Global registry for Ice Chitin runtime state. */
export const iceChitinStateMap = new Map<string, IceChitinState>();

// ---------------------------------------------------------------------------
// PUBLIC: CREATE ENTITY
// ---------------------------------------------------------------------------

/**
 * Create a fully-integrated Ice Chitin ECS entity.
 *
 * This follows the same pattern as `createAlienEntity` in aliens.ts
 * but adds the extra frost/burrow/spawn capabilities via the side state map.
 */
export function createIceChitinEntity(
  scene: Scene,
  variant: IceChitinVariant,
  position: Vector3,
  seed: number = Date.now(),
  difficulty?: DifficultyLevel
): Entity {
  const species = ICE_CHITIN_SPECIES[variant];
  const mesh = createIceChitinMesh(scene, species, seed);
  mesh.position = position.clone();

  LODManager.applyNativeLODToNode(mesh, 'enemy');

  const currentDifficulty = difficulty ?? loadDifficultySetting();

  const scaledHealth = scaleEnemyHealth(species.baseHealth, currentDifficulty);
  const scaledFireRate = scaleEnemyFireRate(species.fireRate, currentDifficulty);
  const scaledAlertRadius = scaleDetectionRange(species.alertRadius, currentDifficulty);

  const vehicle = new Vehicle();
  vehicle.maxSpeed = species.moveSpeed;

  // Optional frost aura point light
  let frostAuraLight: PointLight | null = null;
  if (species.frostAuraRadius > 0) {
    frostAuraLight = new PointLight(`iceChitin_aura_${seed}`, position.clone(), scene);
    frostAuraLight.intensity = 0.6;
    frostAuraLight.range = species.frostAuraRadius;
    frostAuraLight.diffuse = new Color3(0.3, 0.6, 1.0);
  }

  const entity = createEntity({
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
      damage: species.baseDamage,
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
      boss: variant === 'ice_brood_mother',
    },
    alienInfo: {
      speciesId: species.id,
      seed,
      xpValue: species.xpValue,
      lootTable: species.lootTable,
    },
  });

  // Store side-state
  const state: IceChitinState = {
    variant,
    species,
    isBurrowed: false,
    burrowCooldownEnd: 0,
    burrowDurationEnd: 0,
    burrowTarget: null,
    frostAuraActive: species.frostAuraRadius > 0,
    frostAuraLight,
    frostNovaCooldownEnd: 0,
    lastSpawnTime: 0,
    spawnedDrones: [],
  };

  iceChitinStateMap.set(entity.id, state);

  return entity;
}

// ---------------------------------------------------------------------------
// PUBLIC: APPLY DAMAGE RESISTANCE
// ---------------------------------------------------------------------------

/**
 * Apply Ice Chitin damage resistance / vulnerability.
 * Call this before subtracting health to get the adjusted damage value.
 */
export function applyIceChitinResistance(
  baseDamage: number,
  damageType: DamageType,
  entityId: string
): number {
  const state = iceChitinStateMap.get(entityId);
  if (!state) return baseDamage;

  const multiplier = ICE_CHITIN_RESISTANCES[damageType] ?? 1.0;
  return Math.round(baseDamage * multiplier);
}

// ---------------------------------------------------------------------------
// BURROW ABILITY
// ---------------------------------------------------------------------------

/**
 * Initiate burrow for an Ice Chitin entity.
 * The entity sinks into the ground at its current position and will emerge at
 * `targetPosition` after `burrowDurationMs`.
 */
export function initiateBurrow(
  scene: Scene,
  entity: Entity,
  targetPosition: Vector3,
  burrowDurationMs: number = 2000
): boolean {
  if (!entity.transform || !entity.renderable?.mesh) return false;

  const state = iceChitinStateMap.get(entity.id);
  if (!state || !state.species.canBurrow) return false;

  const now = performance.now();
  if (now < state.burrowCooldownEnd || state.isBurrowed) return false;

  state.isBurrowed = true;
  state.burrowTarget = targetPosition.clone();
  state.burrowDurationEnd = now + burrowDurationMs;
  state.burrowCooldownEnd = now + burrowDurationMs + state.species.burrowCooldownMs;

  // Emit burrow-down particles (ice/snow variant)
  emitBurrowDownParticles(scene, entity.transform.position);

  // Animate mesh sinking
  const mesh = entity.renderable.mesh;
  const startY = mesh.position.y;
  const sinkStart = now;
  const sinkDuration = 400;

  const animateSink = () => {
    if (mesh.isDisposed()) return;
    const elapsed = performance.now() - sinkStart;
    const progress = Math.min(elapsed / sinkDuration, 1);
    const eased = progress * progress; // ease-in
    mesh.position.y = startY - eased * 2;
    mesh.scaling.y = 1 - eased * 0.8;

    if (progress < 1) {
      requestAnimationFrame(animateSink);
    } else {
      mesh.isEnabled(false);
    }
  };

  requestAnimationFrame(animateSink);
  return true;
}

/**
 * Complete the burrow emergence at the target position.
 * Call this when `performance.now() >= state.burrowDurationEnd`.
 */
export function completeBurrowEmergence(scene: Scene, entity: Entity): void {
  const state = iceChitinStateMap.get(entity.id);
  if (!state || !state.isBurrowed || !state.burrowTarget) return;
  if (!entity.transform || !entity.renderable?.mesh) return;

  // Teleport entity
  entity.transform.position = state.burrowTarget.clone();

  const mesh = entity.renderable.mesh;
  mesh.position = state.burrowTarget.clone();
  mesh.isEnabled(true);

  // Emergence particles
  particleManager.emitBurrowEmergence(state.burrowTarget, 1.2);
  emitIceBurrowEmergenceParticles(scene, state.burrowTarget);

  // Animate mesh rising
  const startY = state.burrowTarget.y - 2;
  const targetY = state.burrowTarget.y;
  const riseStart = performance.now();
  const riseDuration = 500;

  mesh.position.y = startY;
  mesh.scaling.y = 0.2;

  const animateRise = () => {
    if (mesh.isDisposed()) return;
    const elapsed = performance.now() - riseStart;
    const progress = Math.min(elapsed / riseDuration, 1);
    const eased = 1 - (1 - progress) * (1 - progress); // ease-out
    mesh.position.y = startY + (targetY - startY) * eased;
    mesh.scaling.y = 0.2 + 0.8 * eased;

    if (progress < 1) {
      requestAnimationFrame(animateRise);
    }
  };

  requestAnimationFrame(animateRise);

  // Reset burrow state
  state.isBurrowed = false;
  state.burrowTarget = null;
}

// ---------------------------------------------------------------------------
// FROST AURA LOGIC
// ---------------------------------------------------------------------------

/**
 * Evaluate the frost aura for one frame. Returns a list of entity ids
 * that are currently inside the aura for the caller to apply slow debuffs.
 */
export function evaluateFrostAura(entity: Entity): Entity[] {
  const state = iceChitinStateMap.get(entity.id);
  if (!state || !state.frostAuraActive || !entity.transform) return [];

  // Move the aura light with the entity
  if (state.frostAuraLight && !state.frostAuraLight.isDisposed()) {
    state.frostAuraLight.position = entity.transform.position.clone();
  }

  // Find entities inside the aura radius (player, allies)
  return getEntitiesInRadius(
    entity.transform.position,
    state.species.frostAuraRadius,
    (e) => (e.tags?.player === true || e.tags?.ally === true) && e.id !== entity.id
  );
}

// ---------------------------------------------------------------------------
// FROST NOVA (Brood Mother only)
// ---------------------------------------------------------------------------

/**
 * Attempt to trigger a frost nova.
 * Returns true if the nova was fired, false if on cooldown or not a brood mother.
 */
export function triggerFrostNova(
  scene: Scene,
  entity: Entity
): { fired: boolean; hitEntities: Entity[] } {
  const state = iceChitinStateMap.get(entity.id);
  if (!state || state.species.frostNovaRadius <= 0 || !entity.transform) {
    return { fired: false, hitEntities: [] };
  }

  const now = performance.now();
  if (now < state.frostNovaCooldownEnd) {
    return { fired: false, hitEntities: [] };
  }

  state.frostNovaCooldownEnd = now + state.species.frostNovaCooldownMs;

  const origin = entity.transform.position.clone();

  // Visual: expanding ice ring + particle burst
  emitFrostNovaVisuals(scene, origin, state.species.frostNovaRadius);

  // Collect hit targets
  const hitEntities = getEntitiesInRadius(
    origin,
    state.species.frostNovaRadius,
    (e) => (e.tags?.player === true || e.tags?.ally === true) && e.id !== entity.id
  );

  // Apply damage to hit targets
  for (const target of hitEntities) {
    if (target.health) {
      target.health.current = Math.max(0, target.health.current - state.species.frostNovaDamage);
    }
  }

  return { fired: true, hitEntities };
}

// ---------------------------------------------------------------------------
// DEATH EFFECT: ICE CRYSTAL SHATTER
// ---------------------------------------------------------------------------

/**
 * Play the ice crystal shatter death effect. Call this from the combat system
 * when an Ice Chitin entity's health reaches zero.
 */
export function playIceChitinDeathEffect(scene: Scene, position: Vector3, scale: number = 1): void {
  const shardCount = Math.min(12, Math.floor(6 * scale));

  const armorMat = new StandardMaterial('iceDeathMat', scene);
  armorMat.diffuseColor = new Color3(0.6, 0.78, 0.92);
  armorMat.specularColor = new Color3(0.9, 0.95, 1.0);
  armorMat.specularPower = 128;
  armorMat.alpha = 0.85;
  armorMat.emissiveColor = new Color3(0.15, 0.25, 0.4);

  for (let i = 0; i < shardCount; i++) {
    const shard = MeshBuilder.CreatePolyhedron(
      `iceShard_${i}`,
      { type: 1, size: 0.06 + Math.random() * 0.1 * scale },
      scene
    );
    shard.material = armorMat;
    shard.position = position.add(
      new Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.8, (Math.random() - 0.5) * 0.5)
    );

    // Velocity - explode outward
    const velocity = new Vector3(
      (Math.random() - 0.5) * 10,
      3 + Math.random() * 6,
      (Math.random() - 0.5) * 10
    );
    const angularVel = new Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);

    const startTime = performance.now();
    const gravity = -15;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 2.5 || shard.isDisposed()) {
        if (!shard.isDisposed()) {
          armorMat.dispose();
          shard.dispose();
        }
        return;
      }

      // Physics
      velocity.y += gravity * (1 / 60);
      shard.position.addInPlace(velocity.scale(1 / 60));
      shard.rotation.addInPlace(angularVel.scale(1 / 60));

      // Ground bounce
      if (shard.position.y < 0.05) {
        shard.position.y = 0.05;
        velocity.y *= -0.25;
        velocity.x *= 0.6;
        velocity.z *= 0.6;
        angularVel.scaleInPlace(0.7);
      }

      // Fade out at end
      if (elapsed > 1.8) {
        const fadeProgress = (elapsed - 1.8) / 0.7;
        armorMat.alpha = 0.85 * (1 - fadeProgress);
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  // Emit ice particle burst via ParticleManager
  emitIceDeathParticles(position, scale);

  // Flash of blue light
  const light = new PointLight('iceDeathLight', position, scene);
  light.intensity = 4 * scale;
  light.range = 10 * scale;
  light.diffuse = new Color3(0.4, 0.7, 1.0);

  const lightStart = performance.now();
  const animateLight = () => {
    const elapsed = performance.now() - lightStart;
    const progress = elapsed / 400;
    if (progress >= 1 || light.isDisposed()) {
      if (!light.isDisposed()) light.dispose();
      return;
    }
    light.intensity = 4 * scale * (1 - progress);
    requestAnimationFrame(animateLight);
  };
  requestAnimationFrame(animateLight);
}

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------

/**
 * Remove Ice Chitin runtime state and dispose associated resources.
 * Call this when the entity is removed from the ECS world.
 */
export function disposeIceChitinState(entityId: string): void {
  const state = iceChitinStateMap.get(entityId);
  if (!state) return;

  if (state.frostAuraLight && !state.frostAuraLight.isDisposed()) {
    state.frostAuraLight.dispose();
  }

  iceChitinStateMap.delete(entityId);
}

// ---------------------------------------------------------------------------
// INTERNAL: PARTICLE HELPERS
// ---------------------------------------------------------------------------

function emitBurrowDownParticles(scene: Scene, position: Vector3): void {
  // Ice/snow particles shooting upward as the entity digs in
  particleManager.emit('burrow_emergence', position, {
    direction: new Vector3(0, 1, 0),
    scale: 0.8,
  });
}

function emitIceBurrowEmergenceParticles(scene: Scene, position: Vector3): void {
  // Extra ice-specific particles on emergence (blue-tinted)
  // Uses the existing burrow system plus a secondary ice flash
  const light = new PointLight('burrowLight', position, scene);
  light.intensity = 3;
  light.range = 8;
  light.diffuse = new Color3(0.4, 0.7, 1.0);

  const startTime = performance.now();
  const animateLight = () => {
    const elapsed = performance.now() - startTime;
    const progress = elapsed / 600;
    if (progress >= 1 || light.isDisposed()) {
      if (!light.isDisposed()) light.dispose();
      return;
    }
    light.intensity = 3 * (1 - progress);
    requestAnimationFrame(animateLight);
  };
  requestAnimationFrame(animateLight);
}

function emitFrostNovaVisuals(scene: Scene, position: Vector3, radius: number): void {
  // Expanding ice ring on ground
  const ring = MeshBuilder.CreateTorus(
    'frostNovaRing',
    { diameter: 0.5, thickness: 0.08, tessellation: 32 },
    scene
  );
  ring.position = new Vector3(position.x, 0.1, position.z);
  ring.rotation.x = Math.PI / 2;

  const ringMat = new StandardMaterial('frostNovaRingMat', scene);
  ringMat.emissiveColor = new Color3(0.4, 0.75, 1.0);
  ringMat.disableLighting = true;
  ringMat.alpha = 0.9;
  ringMat.backFaceCulling = false;
  ring.material = ringMat;

  // Blue flash light
  const light = new PointLight('frostNovaLight', position, scene);
  light.intensity = 6;
  light.range = radius * 1.2;
  light.diffuse = new Color3(0.3, 0.6, 1.0);

  const startTime = performance.now();
  const duration = 700;

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = elapsed / duration;

    if (progress >= 1) {
      ring.dispose();
      ringMat.dispose();
      light.dispose();
      return;
    }

    // Ring expands rapidly
    const eased = 1 - (1 - progress) ** 3;
    const currentScale = 0.5 + eased * radius * 2;
    ring.scaling.setAll(currentScale);
    ringMat.alpha = 0.9 * (1 - progress);

    // Light fades
    light.intensity = 6 * (1 - progress);

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);

  // Also emit ice particle burst from ParticleManager
  particleManager.emitExplosion(position, 0.6);
}

function emitIceDeathParticles(position: Vector3, scale: number): void {
  // Use alien death as base, then add custom ice burst
  particleManager.emitAlienDeath(position, scale);
  // Additional debris for shattered ice
  particleManager.emitDebris(position, scale * 0.8);
}
