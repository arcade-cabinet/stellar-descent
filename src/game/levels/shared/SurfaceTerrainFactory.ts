/**
 * SurfaceTerrainFactory - Procedural heightmap terrain for outdoor surface levels
 *
 * Creates ground meshes with seeded noise-based height displacement and
 * PBR materials using AmbientCG textures for different planetary biomes.
 *
 * Key Features:
 * - Multi-octave seeded noise for deterministic terrain generation
 * - PBRMaterial with albedo, normal, roughness textures
 * - Biome-specific texture sets (rock, ice, sand, etc.)
 * - Configurable UV tiling for consistent texture appearance
 *
 * Usage:
 *   import { createDynamicTerrain, ROCK_TERRAIN } from './shared/SurfaceTerrainFactory';
 *   const { mesh, material } = createDynamicTerrain(scene, ROCK_TERRAIN);
 */

import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

import {
  type TerrainBiomeConfig,
  CANYON_TERRAIN_CONFIG,
  ICE_TERRAIN_CONFIG,
  LANDFALL_TERRAIN_CONFIG,
  BREACH_TERRAIN_CONFIG,
  FINAL_ESCAPE_TERRAIN_CONFIG,
  createPBRTerrainMaterial,
} from './PBRTerrainMaterials';

// ============================================================================
// TYPES
// ============================================================================

export interface TerrainConfig {
  /** World-space width and depth of the terrain. */
  size: number;
  /** Number of subdivisions along each axis (vertex density). */
  subdivisions: number;
  /** Maximum vertical displacement applied by the noise function. */
  heightScale: number;
  /** Name used for the material and mesh (should be unique per scene). */
  materialName: string;
  /** Hex color string for the terrain diffuse tint (e.g. "#8B5A2B"). Fallback for non-PBR. */
  tintColor: string;
  /** Integer seed for deterministic procedural noise. */
  seed: number;
  /** Optional PBR biome configuration for high-quality textures. */
  biomeConfig?: TerrainBiomeConfig;
  /** UV scale for PBR textures (smaller = larger tiles). Default: 0.02 */
  textureUVScale?: number;
}

export interface TerrainResult {
  mesh: Mesh;
  material: PBRMaterial | StandardMaterial;
}

// ============================================================================
// SEEDED NOISE
// ============================================================================

/**
 * Simple seeded pseudo-random number generator (Lehmer / Park-Miller LCG).
 * Returns a function that produces values in the range (0, 1) on each call.
 */
function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Attempt at a simple gradient-noise function driven by a seed.
 *
 * This is *not* true Perlin noise but produces visually convincing terrain
 * undulations when layered with multiple octaves. The hash function maps
 * integer lattice points to pseudo-random gradients that are bilinearly
 * interpolated.
 */
function seededNoise2D(seed: number): (x: number, z: number) => number {
  // Build a small permutation table from the seed.
  const TABLE_SIZE = 256;
  const perm = new Uint8Array(TABLE_SIZE);
  const rand = seededRandom(seed);
  for (let i = 0; i < TABLE_SIZE; i++) {
    perm[i] = i;
  }
  // Fisher-Yates shuffle using the seeded RNG.
  for (let i = TABLE_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }

  /**
   * Hash two integer coordinates to a pseudo-random gradient angle.
   */
  function hash(ix: number, iz: number): number {
    const a = perm[((ix & 0xff) + perm[iz & 0xff]) & 0xff];
    return (a / TABLE_SIZE) * Math.PI * 2;
  }

  /**
   * Smooth interpolation (Hermite / smoothstep).
   */
  function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  return (x: number, z: number): number => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const dx = x - x0;
    const dz = z - z0;

    // Gradient dot-products at four corners.
    const dot00 = Math.cos(hash(x0, z0)) * dx + Math.sin(hash(x0, z0)) * dz;
    const dot10 = Math.cos(hash(x1, z0)) * (dx - 1) + Math.sin(hash(x1, z0)) * dz;
    const dot01 = Math.cos(hash(x0, z1)) * dx + Math.sin(hash(x0, z1)) * (dz - 1);
    const dot11 = Math.cos(hash(x1, z1)) * (dx - 1) + Math.sin(hash(x1, z1)) * (dz - 1);

    const u = fade(dx);
    const v = fade(dz);

    return lerp(lerp(dot00, dot10, u), lerp(dot01, dot11, u), v);
  };
}

// ============================================================================
// TERRAIN CREATION
// ============================================================================

/**
 * Create a heightmap-displaced ground mesh with PBR material.
 *
 * The terrain vertices are displaced vertically using multi-octave seeded noise,
 * producing natural-looking hills and valleys that are fully deterministic for
 * a given seed.
 *
 * If a biomeConfig is provided, uses PBRMaterial with AmbientCG textures for
 * high-quality rendering. Otherwise falls back to StandardMaterial.
 *
 * @param scene  - Active BabylonJS scene.
 * @param config - Terrain parameters (size, resolution, textures, seed).
 * @returns The created mesh and its material for external lifecycle management.
 */
export function createDynamicTerrain(scene: Scene, config: TerrainConfig): TerrainResult {
  const { size, subdivisions, heightScale, materialName, tintColor, seed, biomeConfig, textureUVScale } = config;

  // -- Mesh ------------------------------------------------------------------
  const mesh = MeshBuilder.CreateGround(
    `${materialName}_ground`,
    {
      width: size,
      height: size,
      subdivisions,
      updatable: true,
    },
    scene
  );

  // -- Heightmap displacement ------------------------------------------------
  const positions = mesh.getVerticesData('position');
  if (positions) {
    const noise = seededNoise2D(seed);
    const newPositions = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      // Multi-octave noise for varied terrain at different scales.
      let height = 0;
      height += noise(x * 0.008, z * 0.008) * 1.0;   // large rolling hills
      height += noise(x * 0.02, z * 0.02) * 0.5;      // medium ridges
      height += noise(x * 0.06, z * 0.06) * 0.2;      // small bumps
      height += noise(x * 0.15, z * 0.15) * 0.08;     // micro detail

      // Normalise combined amplitude then scale to desired height.
      // The raw sum ranges roughly in [-1.78, 1.78]; we multiply by
      // heightScale to map into the configured vertical range.
      newPositions[i] = x;
      newPositions[i + 1] = height * heightScale;
      newPositions[i + 2] = z;
    }

    mesh.updateVerticesData('position', newPositions);
    mesh.createNormals(false);
  }

  mesh.receiveShadows = true;

  // -- Material --------------------------------------------------------------
  let material: PBRMaterial | StandardMaterial;

  if (biomeConfig) {
    // Use PBR material with AmbientCG textures
    material = createPBRTerrainMaterial(scene, biomeConfig, materialName);

    // Adjust UV scale based on terrain size
    const uvScale = textureUVScale ?? 0.02;
    const scaledUV = uvScale * size;

    if (material.albedoTexture instanceof Texture) {
      material.albedoTexture.uScale = scaledUV;
      material.albedoTexture.vScale = scaledUV;
    }
    if (material.bumpTexture instanceof Texture) {
      material.bumpTexture.uScale = scaledUV;
      material.bumpTexture.vScale = scaledUV;
    }
    if (material.metallicTexture instanceof Texture) {
      material.metallicTexture.uScale = scaledUV;
      material.metallicTexture.vScale = scaledUV;
    }
  } else {
    // Fallback to StandardMaterial with color tint
    const standardMat = new StandardMaterial(materialName, scene);
    standardMat.diffuseColor = Color3.FromHexString(tintColor);
    standardMat.specularColor = new Color3(0.12, 0.1, 0.08);
    standardMat.specularPower = 24;
    material = standardMat;
  }

  mesh.material = material;

  return { mesh, material };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/** Rocky planetary surface - brownish terrain with PBR rock textures. */
export const ROCK_TERRAIN: TerrainConfig = {
  size: 500,
  subdivisions: 64,
  heightScale: 50,
  materialName: 'rockTerrain',
  tintColor: '#8B5A2B',
  seed: 12345,
  biomeConfig: LANDFALL_TERRAIN_CONFIG,
  textureUVScale: 0.015,
};

/** Frozen ice-sheet surface - snow and ice PBR textures. */
export const ICE_TERRAIN: TerrainConfig = {
  size: 500,
  subdivisions: 64,
  heightScale: 50,
  materialName: 'iceTerrain',
  tintColor: '#C8D8E4',
  seed: 67890,
  biomeConfig: ICE_TERRAIN_CONFIG,
  textureUVScale: 0.02,
};

/** Desert / sand dune surface - canyon rock PBR textures. */
export const SAND_TERRAIN: TerrainConfig = {
  size: 500,
  subdivisions: 64,
  heightScale: 50,
  materialName: 'sandTerrain',
  tintColor: '#C2B280',
  seed: 24680,
  biomeConfig: CANYON_TERRAIN_CONFIG,
  textureUVScale: 0.018,
};

/** Canyon terrain - rocky desert surface for canyon levels. */
export const CANYON_TERRAIN: TerrainConfig = {
  size: 1000,
  subdivisions: 128,
  heightScale: 30,
  materialName: 'canyonTerrain',
  tintColor: '#8B7355',
  seed: 42424,
  biomeConfig: CANYON_TERRAIN_CONFIG,
  textureUVScale: 0.012,
};

/** Breach terrain - organic alien ground surface. */
export const BREACH_TERRAIN: TerrainConfig = {
  size: 400,
  subdivisions: 64,
  heightScale: 40,
  materialName: 'breachTerrain',
  tintColor: '#4A3D35',
  seed: 98765,
  biomeConfig: BREACH_TERRAIN_CONFIG,
  textureUVScale: 0.02,
};

/** Final Escape terrain - volcanic rock surface. */
export const ESCAPE_TERRAIN: TerrainConfig = {
  size: 600,
  subdivisions: 96,
  heightScale: 60,
  materialName: 'escapeTerrain',
  tintColor: '#3A3030',
  seed: 11111,
  biomeConfig: FINAL_ESCAPE_TERRAIN_CONFIG,
  textureUVScale: 0.015,
};
