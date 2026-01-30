import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { Vehicle } from 'yuka';
import { AssetManager, SPECIES_TO_ASSET } from '../core/AssetManager';
import {
  type DifficultyLevel,
  loadDifficultySetting,
  scaleDetectionRange,
  scaleEnemyFireRate,
  scaleEnemyHealth,
} from '../core/DifficultySettings';
import { createEntity, type Entity } from '../core/ecs';
import { LODManager } from '../core/LODManager';

// Configuration for GLB vs procedural mesh generation
export const ALIEN_CONFIG = {
  useGLBModels: true, // Set to false to use procedural meshes
  glbScale: 0.5, // Scale factor for GLB models to match game units
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
    baseHealth: 30,
    baseDamage: 5,
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
  },

  // Lurker - Tall, thin, stalks from shadows
  lurker: {
    id: 'lurker',
    name: 'Lurker',
    designation: 'STRAIN-X2',
    description: 'Elongated humanoid form. Stalks prey silently. Attacks with extending limbs.',
    baseHealth: 80,
    baseDamage: 20,
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
  },

  // Spewer - Bloated, acid-spitting horror
  spewer: {
    id: 'spewer',
    name: 'Spewer',
    designation: 'STRAIN-X3',
    description: 'Bloated sac creature. Sprays corrosive acid from multiple orifices.',
    baseHealth: 120,
    baseDamage: 15,
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
  },

  // Husk - Dessicated, fast, screaming horror
  husk: {
    id: 'husk',
    name: 'Husk',
    designation: 'STRAIN-X4',
    description: 'Dried, mummified form. Emits disorienting screech. Relentless pursuit.',
    baseHealth: 60,
    baseDamage: 25,
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
  },

  // Broodmother - Large, spawns skitterers, mini-boss
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    designation: 'STRAIN-X5',
    description: 'Massive egg-layer. Produces Skitterers continuously. Priority target.',
    baseHealth: 300,
    baseDamage: 35,
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
  },
};

// Seeded random for consistent procedural generation
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Create procedural alien mesh based on species
export function createAlienMesh(scene: Scene, species: AlienSpecies, seed: number): TransformNode {
  const random = seededRandom(seed);
  const root = new TransformNode(`alien_${species.id}_${seed}`, scene);

  // Color palette for each species
  const colorPalettes: Record<string, { primary: string; secondary: string; glow: string }> = {
    skitterer: { primary: '#2D4A3E', secondary: '#1A2F28', glow: '#4AFF9F' },
    lurker: { primary: '#1C1C2E', secondary: '#0D0D1A', glow: '#9F4AFF' },
    spewer: { primary: '#3E4A2D', secondary: '#282F1A', glow: '#FFFF4A' },
    husk: { primary: '#4A3E2D', secondary: '#2F281A', glow: '#FF4A4A' },
    broodmother: { primary: '#4A2D3E', secondary: '#2F1A28', glow: '#FF4AFF' },
  };

  const palette = colorPalettes[species.id] || colorPalettes.skitterer;

  // Base material
  const baseMat = new StandardMaterial(`${species.id}_baseMat`, scene);
  baseMat.diffuseColor = Color3.FromHexString(palette.primary);
  baseMat.specularColor = new Color3(0.2, 0.2, 0.2);

  // Glow material for eyes/accents
  const glowMat = new StandardMaterial(`${species.id}_glowMat`, scene);
  glowMat.emissiveColor = Color3.FromHexString(palette.glow);
  glowMat.disableLighting = true;

  // Secondary material
  const secondaryMat = new StandardMaterial(`${species.id}_secondaryMat`, scene);
  secondaryMat.diffuseColor = Color3.FromHexString(palette.secondary);

  switch (species.id) {
    case 'skitterer':
      createSkitterer(scene, root, baseMat, glowMat, secondaryMat, random);
      break;
    case 'lurker':
      createLurker(scene, root, baseMat, glowMat, secondaryMat, random);
      break;
    case 'spewer':
      createSpewer(scene, root, baseMat, glowMat, secondaryMat, random);
      break;
    case 'husk':
      createHusk(scene, root, baseMat, glowMat, secondaryMat, random);
      break;
    case 'broodmother':
      createBroodmother(scene, root, baseMat, glowMat, secondaryMat, random);
      break;
  }

  return root;
}

// Skitterer - spider-like multi-legged horror
function createSkitterer(
  scene: Scene,
  root: TransformNode,
  baseMat: StandardMaterial,
  glowMat: StandardMaterial,
  secondaryMat: StandardMaterial,
  random: () => number
): void {
  // Central body - flattened sphere
  const body = MeshBuilder.CreateSphere(
    'body',
    {
      diameterX: 0.8 + random() * 0.2,
      diameterY: 0.4 + random() * 0.1,
      diameterZ: 0.6 + random() * 0.2,
      segments: 8,
    },
    scene
  );
  body.material = baseMat;
  body.parent = root;
  body.position.y = 0.3;

  // Multiple glowing eyes (3-5)
  const eyeCount = 3 + Math.floor(random() * 3);
  for (let i = 0; i < eyeCount; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.08 + random() * 0.04 }, scene);
    eye.material = glowMat;
    eye.parent = body;
    const angle = (i / eyeCount) * Math.PI * 0.6 - Math.PI * 0.3;
    eye.position.set(Math.sin(angle) * 0.3, 0.1 + random() * 0.1, -0.25 - random() * 0.1);
  }

  // 6-8 spindly legs
  const legCount = 6 + Math.floor(random() * 3);
  for (let i = 0; i < legCount; i++) {
    const side = i < legCount / 2 ? 1 : -1;
    const idx = i % (legCount / 2);
    const angle = (idx / (legCount / 2)) * Math.PI * 0.6 + Math.PI * 0.2;

    // Upper leg segment
    const upperLeg = MeshBuilder.CreateCylinder(
      'upperLeg',
      {
        height: 0.5 + random() * 0.2,
        diameterTop: 0.04,
        diameterBottom: 0.06,
        tessellation: 6,
      },
      scene
    );
    upperLeg.material = secondaryMat;
    upperLeg.parent = root;
    upperLeg.position.set(side * 0.3, 0.4, Math.cos(angle) * 0.2);
    upperLeg.rotation.z = side * (Math.PI / 3 + random() * 0.2);
    upperLeg.rotation.y = angle;

    // Lower leg segment
    const lowerLeg = MeshBuilder.CreateCylinder(
      'lowerLeg',
      {
        height: 0.4 + random() * 0.2,
        diameterTop: 0.03,
        diameterBottom: 0.02,
        tessellation: 6,
      },
      scene
    );
    lowerLeg.material = secondaryMat;
    lowerLeg.parent = upperLeg;
    lowerLeg.position.y = -0.35;
    lowerLeg.rotation.z = -side * (Math.PI / 4);
  }

  // Mandibles
  for (let i = 0; i < 2; i++) {
    const mandible = MeshBuilder.CreateCylinder(
      'mandible',
      {
        height: 0.2,
        diameterTop: 0.02,
        diameterBottom: 0.04,
        tessellation: 4,
      },
      scene
    );
    mandible.material = secondaryMat;
    mandible.parent = body;
    mandible.position.set((i - 0.5) * 0.15, -0.1, -0.35);
    mandible.rotation.x = Math.PI / 4;
    mandible.rotation.z = (i - 0.5) * 0.3;
  }
}

// Lurker - tall, thin, elongated nightmare
function createLurker(
  scene: Scene,
  root: TransformNode,
  baseMat: StandardMaterial,
  glowMat: StandardMaterial,
  secondaryMat: StandardMaterial,
  random: () => number
): void {
  // Elongated body
  const torso = MeshBuilder.CreateCylinder(
    'torso',
    {
      height: 1.5 + random() * 0.3,
      diameterTop: 0.3,
      diameterBottom: 0.5,
      tessellation: 8,
    },
    scene
  );
  torso.material = baseMat;
  torso.parent = root;
  torso.position.y = 1;

  // Small head
  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameterX: 0.4,
      diameterY: 0.5 + random() * 0.1,
      diameterZ: 0.35,
      segments: 8,
    },
    scene
  );
  head.material = baseMat;
  head.parent = root;
  head.position.y = 2;

  // Two large eyes - widely spaced
  for (let i = 0; i < 2; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.15 }, scene);
    eye.material = glowMat;
    eye.parent = head;
    eye.position.set((i - 0.5) * 0.25, 0.05, -0.15);
  }

  // Long, spindly arms
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    // Upper arm
    const upperArm = MeshBuilder.CreateCylinder(
      'upperArm',
      {
        height: 0.8 + random() * 0.2,
        diameterTop: 0.06,
        diameterBottom: 0.08,
        tessellation: 6,
      },
      scene
    );
    upperArm.material = secondaryMat;
    upperArm.parent = root;
    upperArm.position.set(side * 0.35, 1.6, 0);
    upperArm.rotation.z = (side * Math.PI) / 4;

    // Forearm - very long
    const forearm = MeshBuilder.CreateCylinder(
      'forearm',
      {
        height: 1.0 + random() * 0.3,
        diameterTop: 0.04,
        diameterBottom: 0.06,
        tessellation: 6,
      },
      scene
    );
    forearm.material = secondaryMat;
    forearm.parent = upperArm;
    forearm.position.y = -0.6;
    forearm.rotation.z = (side * Math.PI) / 6;

    // Clawed hand
    for (let j = 0; j < 3; j++) {
      const claw = MeshBuilder.CreateCylinder(
        'claw',
        {
          height: 0.15,
          diameterTop: 0.01,
          diameterBottom: 0.025,
          tessellation: 4,
        },
        scene
      );
      claw.material = glowMat;
      claw.parent = forearm;
      claw.position.set((j - 1) * 0.04, -0.55, 0);
      claw.rotation.x = -Math.PI / 6;
    }
  }

  // Thin legs
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const leg = MeshBuilder.CreateCylinder(
      'leg',
      {
        height: 0.8,
        diameterTop: 0.1,
        diameterBottom: 0.06,
        tessellation: 6,
      },
      scene
    );
    leg.material = secondaryMat;
    leg.parent = root;
    leg.position.set(side * 0.15, 0.4, 0);
  }
}

// Spewer - bloated, disgusting acid-spitter
function createSpewer(
  scene: Scene,
  root: TransformNode,
  baseMat: StandardMaterial,
  glowMat: StandardMaterial,
  secondaryMat: StandardMaterial,
  random: () => number
): void {
  // Bloated main body
  const body = MeshBuilder.CreateSphere(
    'body',
    {
      diameterX: 1.2 + random() * 0.3,
      diameterY: 0.9 + random() * 0.2,
      diameterZ: 1.0 + random() * 0.3,
      segments: 12,
    },
    scene
  );
  body.material = baseMat;
  body.parent = root;
  body.position.y = 0.6;

  // Pulsating sacs (3-5)
  const sacCount = 3 + Math.floor(random() * 3);

  const sacMat = new StandardMaterial('sacMat', scene);
  sacMat.diffuseColor = Color3.FromHexString('#5A7A3D');
  sacMat.alpha = 0.7;
  sacMat.emissiveColor = new Color3(0.2, 0.3, 0.1);

  for (let i = 0; i < sacCount; i++) {
    const sac = MeshBuilder.CreateSphere(
      'sac',
      {
        diameter: 0.2 + random() * 0.15,
        segments: 6,
      },
      scene
    );

    sac.material = sacMat;
    sac.parent = body;

    const angle = (i / sacCount) * Math.PI * 2;
    sac.position.set(
      Math.cos(angle) * (0.4 + random() * 0.2),
      random() * 0.3 - 0.1,
      Math.sin(angle) * (0.4 + random() * 0.2)
    );
  }

  // Small vestigial head
  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameter: 0.3,
      segments: 8,
    },
    scene
  );
  head.material = baseMat;
  head.parent = root;
  head.position.set(0, 1.1, -0.4);

  // Tiny clustered eyes
  for (let i = 0; i < 6; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.04 }, scene);
    eye.material = glowMat;
    eye.parent = head;
    const angle = (i / 6) * Math.PI * 2;
    eye.position.set(Math.cos(angle) * 0.1, 0.05, Math.sin(angle) * 0.1 - 0.1);
  }

  // Acid-spitting orifices
  for (let i = 0; i < 3; i++) {
    const orifice = MeshBuilder.CreateTorus(
      'orifice',
      {
        diameter: 0.15,
        thickness: 0.03,
        tessellation: 8,
      },
      scene
    );
    orifice.material = glowMat;
    orifice.parent = body;
    const angle = (i / 3) * Math.PI * 0.8 - Math.PI * 0.4;
    orifice.position.set(Math.sin(angle) * 0.5, -0.2, -0.5);
    orifice.rotation.x = Math.PI / 2;
  }

  // Stubby legs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = MeshBuilder.CreateCylinder(
      'leg',
      {
        height: 0.3,
        diameterTop: 0.15,
        diameterBottom: 0.2,
        tessellation: 6,
      },
      scene
    );
    leg.material = secondaryMat;
    leg.parent = root;
    leg.position.set(Math.cos(angle) * 0.4, 0.15, Math.sin(angle) * 0.4);
  }
}

// Husk - dried, mummified, screaming horror
function createHusk(
  scene: Scene,
  root: TransformNode,
  baseMat: StandardMaterial,
  glowMat: StandardMaterial,
  secondaryMat: StandardMaterial,
  random: () => number
): void {
  // Emaciated torso
  const torso = MeshBuilder.CreateCylinder(
    'torso',
    {
      height: 1.0,
      diameterTop: 0.35,
      diameterBottom: 0.4,
      tessellation: 8,
    },
    scene
  );
  torso.material = baseMat;
  torso.parent = root;
  torso.position.y = 0.8;

  // Visible rib-like protrusions
  for (let i = 0; i < 6; i++) {
    const rib = MeshBuilder.CreateTorus(
      'rib',
      {
        diameter: 0.4 - i * 0.03,
        thickness: 0.025,
        tessellation: 8,
      },
      scene
    );
    rib.material = secondaryMat;
    rib.parent = torso;
    rib.position.y = 0.3 - i * 0.1;
    rib.rotation.x = Math.PI / 2;
  }

  // Skull-like head with gaping mouth
  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameterX: 0.35,
      diameterY: 0.4,
      diameterZ: 0.35,
      segments: 8,
    },
    scene
  );
  head.material = baseMat;
  head.parent = root;
  head.position.y = 1.5;

  // Sunken eye sockets with glowing eyes
  for (let i = 0; i < 2; i++) {
    const socket = MeshBuilder.CreateSphere('socket', { diameter: 0.12 }, scene);
    socket.material = secondaryMat;
    socket.parent = head;
    socket.position.set((i - 0.5) * 0.15, 0.05, -0.12);

    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.06 }, scene);
    eye.material = glowMat;
    eye.parent = socket;
    eye.position.z = -0.03;
  }

  // Gaping mouth cavity
  const mouth = MeshBuilder.CreateCylinder(
    'mouth',
    {
      height: 0.1,
      diameter: 0.12,
      tessellation: 6,
    },
    scene
  );
  mouth.material = secondaryMat;
  mouth.parent = head;
  mouth.position.set(0, -0.1, -0.15);
  mouth.rotation.x = Math.PI / 2;

  // Skeletal arms
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const arm = MeshBuilder.CreateCylinder(
      'arm',
      {
        height: 0.6 + random() * 0.1,
        diameterTop: 0.04,
        diameterBottom: 0.06,
        tessellation: 6,
      },
      scene
    );
    arm.material = secondaryMat;
    arm.parent = root;
    arm.position.set(side * 0.25, 1.1, 0);
    arm.rotation.z = (side * Math.PI) / 6;

    // Clawed fingers
    for (let j = 0; j < 4; j++) {
      const finger = MeshBuilder.CreateCylinder(
        'finger',
        {
          height: 0.1,
          diameterTop: 0.01,
          diameterBottom: 0.015,
          tessellation: 4,
        },
        scene
      );
      finger.material = baseMat;
      finger.parent = arm;
      finger.position.set((j - 1.5) * 0.025, -0.35, 0);
      finger.rotation.x = -0.3;
    }
  }

  // Thin legs
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const leg = MeshBuilder.CreateCylinder(
      'leg',
      {
        height: 0.6,
        diameterTop: 0.08,
        diameterBottom: 0.05,
        tessellation: 6,
      },
      scene
    );
    leg.material = secondaryMat;
    leg.parent = root;
    leg.position.set(side * 0.12, 0.3, 0);
  }
}

// Broodmother - massive egg-laying horror
function createBroodmother(
  scene: Scene,
  root: TransformNode,
  baseMat: StandardMaterial,
  glowMat: StandardMaterial,
  secondaryMat: StandardMaterial,
  random: () => number
): void {
  // Massive egg sac body
  const body = MeshBuilder.CreateSphere(
    'body',
    {
      diameterX: 2.5 + random() * 0.5,
      diameterY: 1.8 + random() * 0.3,
      diameterZ: 2.0 + random() * 0.4,
      segments: 16,
    },
    scene
  );
  body.material = baseMat;
  body.parent = root;
  body.position.y = 1.2;

  // Translucent egg sacs with visible embryos
  const eggMat = new StandardMaterial('eggMat', scene);
  eggMat.diffuseColor = Color3.FromHexString('#4A3D5A');
  eggMat.alpha = 0.6;
  eggMat.emissiveColor = new Color3(0.2, 0.1, 0.2);

  for (let i = 0; i < 8; i++) {
    const egg = MeshBuilder.CreateSphere(
      'egg',
      {
        diameter: 0.25 + random() * 0.15,
        segments: 8,
      },
      scene
    );
    egg.material = eggMat;
    egg.parent = body;

    const angle = (i / 8) * Math.PI * 2;
    const vertAngle = random() * Math.PI - Math.PI / 2;
    egg.position.set(
      Math.cos(angle) * (0.8 + random() * 0.3),
      Math.sin(vertAngle) * 0.3,
      Math.sin(angle) * (0.8 + random() * 0.3)
    );

    // Embryo inside
    const embryo = MeshBuilder.CreateSphere('embryo', { diameter: 0.1 }, scene);
    embryo.material = glowMat;
    embryo.parent = egg;
  }

  // Upper body/thorax
  const thorax = MeshBuilder.CreateCylinder(
    'thorax',
    {
      height: 0.8,
      diameterTop: 0.5,
      diameterBottom: 0.8,
      tessellation: 8,
    },
    scene
  );
  thorax.material = baseMat;
  thorax.parent = root;
  thorax.position.set(0, 2.3, -0.5);
  thorax.rotation.x = -0.3;

  // Head
  const head = MeshBuilder.CreateSphere(
    'head',
    {
      diameterX: 0.6,
      diameterY: 0.5,
      diameterZ: 0.5,
      segments: 10,
    },
    scene
  );
  head.material = baseMat;
  head.parent = root;
  head.position.set(0, 2.8, -0.8);

  // Multiple eyes in crown pattern
  for (let i = 0; i < 8; i++) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.1 + (i < 2 ? 0.05 : 0) }, scene);
    eye.material = glowMat;
    eye.parent = head;
    const angle = (i / 8) * Math.PI * 1.5 - Math.PI * 0.75;
    eye.position.set(
      Math.sin(angle) * 0.25,
      0.1 + (i < 4 ? 0.05 : -0.05),
      Math.cos(angle) * 0.2 - 0.1
    );
  }

  // Large manipulator arms
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;

    const arm = MeshBuilder.CreateCylinder(
      'arm',
      {
        height: 1.2,
        diameterTop: 0.1,
        diameterBottom: 0.15,
        tessellation: 6,
      },
      scene
    );
    arm.material = secondaryMat;
    arm.parent = root;
    arm.position.set(side * 0.5, 2.2, -0.3);
    arm.rotation.z = (side * Math.PI) / 4;
    arm.rotation.x = -0.2;

    // Pincer claw
    for (let j = 0; j < 2; j++) {
      const pincer = MeshBuilder.CreateCylinder(
        'pincer',
        {
          height: 0.3,
          diameterTop: 0.02,
          diameterBottom: 0.06,
          tessellation: 4,
        },
        scene
      );
      pincer.material = glowMat;
      pincer.parent = arm;
      pincer.position.set((j - 0.5) * 0.08, -0.7, 0);
      pincer.rotation.z = (j - 0.5) * 0.4;
    }
  }

  // Multiple small legs
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leg = MeshBuilder.CreateCylinder(
      'leg',
      {
        height: 0.6,
        diameterTop: 0.12,
        diameterBottom: 0.08,
        tessellation: 6,
      },
      scene
    );
    leg.material = secondaryMat;
    leg.parent = root;
    leg.position.set(Math.cos(angle) * 0.8, 0.3, Math.sin(angle) * 0.8);
    leg.rotation.z = Math.cos(angle) * 0.3;
    leg.rotation.x = -Math.sin(angle) * 0.3;
  }
}

/**
 * Create alien mesh using GLB model if available, falling back to procedural
 */
export async function createAlienMeshAsync(
  scene: Scene,
  species: AlienSpecies,
  seed: number
): Promise<TransformNode> {
  // Try GLB model first if enabled
  if (ALIEN_CONFIG.useGLBModels && SPECIES_TO_ASSET[species.id]) {
    const assetName = SPECIES_TO_ASSET[species.id];
    console.log(`[Aliens] Attempting GLB load for ${species.id} -> asset '${assetName}'`);

    try {
      const instance = await AssetManager.loadAndCreateInstance(
        'aliens',
        assetName,
        `alien_${species.id}_${seed}`,
        scene
      );

      if (instance) {
        // Apply scale for GLB models
        instance.scaling.setAll(ALIEN_CONFIG.glbScale);
        console.log(
          `[Aliens] SUCCESS: GLB instance created for ${species.id}, scale=${ALIEN_CONFIG.glbScale}`
        );
        return instance;
      } else {
        console.warn(
          `[Aliens] GLB instance was null for ${species.id}, falling back to procedural`
        );
      }
    } catch (error) {
      console.warn(`[Aliens] Failed to load GLB for ${species.id}, using procedural:`, error);
    }
  } else {
    console.log(
      `[Aliens] Using procedural mesh for ${species.id} (useGLBModels=${ALIEN_CONFIG.useGLBModels}, hasAsset=${!!SPECIES_TO_ASSET[species.id]})`
    );
  }

  // Fallback to procedural mesh
  return createAlienMesh(scene, species, seed);
}

// Create an alien entity with full ECS integration
// Stats are scaled based on current difficulty setting
export function createAlienEntity(
  scene: Scene,
  species: AlienSpecies,
  position: Vector3,
  seed: number = Date.now(),
  difficulty?: DifficultyLevel
): Entity {
  const mesh = createAlienMesh(scene, species, seed);
  mesh.position = position.clone();

  // Apply LOD to procedural meshes - they have lots of geometry that benefits from LOD
  LODManager.applyNativeLODToNode(mesh, 'enemy');

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
      boss: species.id === 'broodmother',
    },
    // Track alien species for stats and loot
    alienInfo: {
      speciesId: species.id,
      seed,
      xpValue: species.xpValue,
      lootTable: species.lootTable,
    },
  });
}

/**
 * Create an alien entity with GLB model support (async version)
 * Use this for spawning aliens with high-quality GLB models
 * Stats are scaled based on current difficulty setting
 */
export async function createAlienEntityAsync(
  scene: Scene,
  species: AlienSpecies,
  position: Vector3,
  seed: number = Date.now(),
  difficulty?: DifficultyLevel
): Promise<Entity> {
  const mesh = await createAlienMeshAsync(scene, species, seed);
  mesh.position = position.clone();

  // Apply LOD to alien mesh - particularly important for GLB models with high poly counts
  LODManager.applyNativeLODToNode(mesh, 'enemy');

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
