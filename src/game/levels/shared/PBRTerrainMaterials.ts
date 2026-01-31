/**
 * PBRTerrainMaterials - Factory for high-quality PBR terrain materials
 *
 * Creates PBRMaterial instances using AmbientCG textures for realistic
 * ground surfaces. Supports multiple biome types with proper texture channels:
 * - Albedo (Color)
 * - Normal (NormalGL)
 * - Roughness
 * - Optional AO (Ambient Occlusion)
 *
 * Texture paths follow AmbientCG naming convention:
 *   {Name}_{Resolution}-JPG_{Channel}.jpg
 * Example: Ground054_1K-JPG_Color.jpg
 */

import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// TYPES
// ============================================================================

export interface PBRTextureSet {
  /** Base path without channel suffix (e.g., '/textures/levels/canyon-run/Ground054_1K-JPG') */
  basePath: string;
  /** Texture tiling factor for UV repeat */
  uvScale?: number;
  /** Optional roughness multiplier (0-1) */
  roughnessMultiplier?: number;
  /** Optional metallic value (0-1) - most terrain is non-metallic */
  metallic?: number;
  /** Optional ambient occlusion strength */
  aoStrength?: number;
  /** Optional color tint to blend with albedo */
  tint?: Color3;
}

export interface TerrainBiomeConfig {
  name: string;
  primary: PBRTextureSet;
  /** Optional secondary texture for blending (e.g., rock patches on grass) */
  secondary?: PBRTextureSet;
  /** Blend factor between primary and secondary (0 = all primary, 1 = all secondary) */
  blendFactor?: number;
}

// ============================================================================
// PRE-DEFINED BIOME TEXTURE CONFIGURATIONS
// ============================================================================

/**
 * Canyon/desert rocky terrain - reddish-brown rocky ground
 */
export const CANYON_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'canyon',
  primary: {
    basePath: '/textures/levels/canyon-run/Ground054_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.9,
    metallic: 0.0,
  },
  secondary: {
    basePath: '/textures/levels/canyon-run/Rock041_1K-JPG',
    uvScale: 0.08,
    roughnessMultiplier: 0.95,
  },
  blendFactor: 0.3,
};

/**
 * Canyon wall rock texture - larger scale rocky surface
 */
export const CANYON_ROCK_CONFIG: TerrainBiomeConfig = {
  name: 'canyon_rock',
  primary: {
    basePath: '/textures/levels/canyon-run/Rocks011_1K-JPG',
    uvScale: 0.04,
    roughnessMultiplier: 1.0,
    metallic: 0.0,
  },
};

/**
 * Ice/snow terrain - frozen wasteland
 */
export const ICE_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'ice',
  primary: {
    basePath: '/textures/levels/southern-ice/Snow003_1K-JPG',
    uvScale: 0.06,
    roughnessMultiplier: 0.3,
    metallic: 0.0,
    tint: new Color3(0.9, 0.95, 1.0),
  },
  secondary: {
    basePath: '/textures/levels/southern-ice/Ice002_1K-JPG',
    uvScale: 0.04,
    roughnessMultiplier: 0.1,
  },
  blendFactor: 0.2,
};

/**
 * Frozen rock terrain - exposed rock in ice level
 */
export const ICE_ROCK_CONFIG: TerrainBiomeConfig = {
  name: 'ice_rock',
  primary: {
    basePath: '/textures/levels/southern-ice/Rock014_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.85,
    metallic: 0.0,
    tint: new Color3(0.75, 0.82, 0.92),
  },
};

/**
 * Landfall/FOB terrain - military base dirt/gravel
 */
export const LANDFALL_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'landfall',
  primary: {
    basePath: '/textures/levels/landfall/Ground037_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.85,
    metallic: 0.0,
  },
  secondary: {
    basePath: '/textures/levels/landfall/Gravel019_1K-JPG',
    uvScale: 0.08,
    roughnessMultiplier: 0.9,
  },
  blendFactor: 0.25,
};

/**
 * Landfall rock terrain - rocky outcrops
 */
export const LANDFALL_ROCK_CONFIG: TerrainBiomeConfig = {
  name: 'landfall_rock',
  primary: {
    basePath: '/textures/levels/landfall/Rock022_1K-JPG',
    uvScale: 0.04,
    roughnessMultiplier: 0.95,
    metallic: 0.0,
  },
};

/**
 * Asphalt/road surface
 */
export const ASPHALT_CONFIG: TerrainBiomeConfig = {
  name: 'asphalt',
  primary: {
    basePath: '/textures/levels/landfall/Asphalt003_1K-JPG',
    uvScale: 0.1,
    roughnessMultiplier: 0.7,
    metallic: 0.0,
  },
};

/**
 * Hive assault terrain - concrete with metal grating
 */
export const HIVE_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'hive',
  primary: {
    basePath: '/textures/levels/hive-assault/Concrete018_1K-JPG',
    uvScale: 0.08,
    roughnessMultiplier: 0.75,
    metallic: 0.0,
  },
};

/**
 * The Breach terrain - organic alien ground
 */
export const BREACH_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'breach',
  primary: {
    basePath: '/textures/levels/the-breach/Ground017_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.8,
    metallic: 0.0,
    tint: new Color3(0.6, 0.5, 0.45),
  },
  secondary: {
    basePath: '/textures/levels/the-breach/Moss002_1K-JPG',
    uvScale: 0.06,
    roughnessMultiplier: 0.9,
  },
  blendFactor: 0.35,
};

/**
 * Breach rock - organic rocky surface
 */
export const BREACH_ROCK_CONFIG: TerrainBiomeConfig = {
  name: 'breach_rock',
  primary: {
    basePath: '/textures/levels/the-breach/Rock007_1K-JPG',
    uvScale: 0.04,
    roughnessMultiplier: 0.9,
    metallic: 0.0,
  },
};

/**
 * Extraction terrain - damaged urban ground
 */
export const EXTRACTION_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'extraction',
  primary: {
    basePath: '/textures/levels/extraction/Ground042_1K-JPG',
    uvScale: 0.06,
    roughnessMultiplier: 0.8,
    metallic: 0.0,
  },
  secondary: {
    basePath: '/textures/levels/extraction/Asphalt007_1K-JPG',
    uvScale: 0.08,
    roughnessMultiplier: 0.7,
  },
  blendFactor: 0.3,
};

/**
 * Final Escape terrain - volcanic/lava adjacent rock
 */
export const FINAL_ESCAPE_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'final_escape',
  primary: {
    basePath: '/textures/levels/final-escape/Ground029_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.85,
    metallic: 0.0,
    tint: new Color3(0.4, 0.35, 0.3),
  },
  secondary: {
    basePath: '/textures/levels/final-escape/Rock030_1K-JPG',
    uvScale: 0.04,
    roughnessMultiplier: 0.95,
  },
  blendFactor: 0.4,
};

/**
 * FOB Delta terrain - concrete military base
 */
export const FOB_DELTA_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'fob_delta',
  primary: {
    basePath: '/textures/levels/fob-delta/Concrete033_1K-JPG',
    uvScale: 0.08,
    roughnessMultiplier: 0.7,
    metallic: 0.0,
  },
};

/**
 * Brothers in Arms terrain - battlefield dirt
 */
export const BROTHERS_TERRAIN_CONFIG: TerrainBiomeConfig = {
  name: 'brothers',
  primary: {
    basePath: '/textures/levels/brothers-in-arms/Ground078_1K-JPG',
    uvScale: 0.05,
    roughnessMultiplier: 0.85,
    metallic: 0.0,
  },
};

// ============================================================================
// MATERIAL CREATION
// ============================================================================

/**
 * Create a PBRMaterial from a texture set configuration.
 *
 * @param scene - Active Babylon.js scene
 * @param config - Biome configuration with texture paths and settings
 * @param name - Optional material name override
 * @returns Configured PBRMaterial
 */
export function createPBRTerrainMaterial(
  scene: Scene,
  config: TerrainBiomeConfig,
  name?: string
): PBRMaterial {
  const materialName = name || `terrain_${config.name}`;
  const mat = new PBRMaterial(materialName, scene);

  const primary = config.primary;

  // Albedo (base color)
  const albedoTex = new Texture(`${primary.basePath}_Color.jpg`, scene);
  albedoTex.uScale = primary.uvScale ?? 0.05;
  albedoTex.vScale = primary.uvScale ?? 0.05;
  mat.albedoTexture = albedoTex;

  // Apply optional tint
  if (primary.tint) {
    mat.albedoColor = primary.tint;
  }

  // Normal map
  const normalTex = new Texture(`${primary.basePath}_NormalGL.jpg`, scene);
  normalTex.uScale = primary.uvScale ?? 0.05;
  normalTex.vScale = primary.uvScale ?? 0.05;
  mat.bumpTexture = normalTex;

  // Roughness (stored in green channel of metallicTexture)
  const roughnessTex = new Texture(`${primary.basePath}_Roughness.jpg`, scene);
  roughnessTex.uScale = primary.uvScale ?? 0.05;
  roughnessTex.vScale = primary.uvScale ?? 0.05;
  mat.metallicTexture = roughnessTex;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useRoughnessFromMetallicTextureAlpha = false;

  // Metallic setting (most terrain is non-metallic)
  mat.metallic = primary.metallic ?? 0.0;

  // Apply roughness multiplier
  mat.roughness = primary.roughnessMultiplier ?? 1.0;

  // Enable microsurface for realistic terrain
  mat.useAutoMicroSurfaceFromReflectivityMap = false;
  mat.microSurface = 1.0 - (primary.roughnessMultiplier ?? 0.8);

  // Environment reflections (subtle for terrain)
  mat.environmentIntensity = 0.4;
  mat.reflectivityColor = new Color3(0.04, 0.04, 0.04);

  // Shadow and lighting settings
  mat.useRadianceOcclusion = true;
  mat.useHorizonOcclusion = true;

  // Backface culling for terrain (single-sided rendering)
  mat.backFaceCulling = true;

  return mat;
}

/**
 * Create a tiled ground mesh material optimized for large terrain areas.
 * Uses world-space UV coordinates for consistent tiling across large surfaces.
 *
 * @param scene - Active Babylon.js scene
 * @param config - Biome configuration
 * @param worldSize - World size for UV scaling (larger = smaller tile repeat)
 * @returns Configured PBRMaterial with world-space tiling
 */
export function createWorldSpaceTerrainMaterial(
  scene: Scene,
  config: TerrainBiomeConfig,
  worldSize: number = 100
): PBRMaterial {
  const mat = createPBRTerrainMaterial(scene, config);

  // Adjust UV scale based on world size for consistent tiling
  const baseUVScale = config.primary.uvScale ?? 0.05;
  const adjustedScale = baseUVScale * (100 / worldSize);

  if (mat.albedoTexture instanceof Texture) {
    mat.albedoTexture.uScale = adjustedScale * worldSize;
    mat.albedoTexture.vScale = adjustedScale * worldSize;
  }
  if (mat.bumpTexture instanceof Texture) {
    mat.bumpTexture.uScale = adjustedScale * worldSize;
    mat.bumpTexture.vScale = adjustedScale * worldSize;
  }
  if (mat.metallicTexture instanceof Texture) {
    mat.metallicTexture.uScale = adjustedScale * worldSize;
    mat.metallicTexture.vScale = adjustedScale * worldSize;
  }

  return mat;
}

/**
 * Create a blended terrain material combining two texture sets.
 * Useful for terrain variation (e.g., rock patches in grass).
 *
 * @param scene - Active Babylon.js scene
 * @param config - Biome configuration with primary and secondary textures
 * @returns Primary material (blending requires custom shader - this is a fallback)
 */
export function createBlendedTerrainMaterial(
  scene: Scene,
  config: TerrainBiomeConfig
): PBRMaterial {
  // For now, return primary material
  // Full blending would require a custom shader or NodeMaterial
  return createPBRTerrainMaterial(scene, config);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the appropriate terrain config for a level by name.
 */
export function getTerrainConfigByLevel(
  levelId: string
): TerrainBiomeConfig | null {
  const configs: Record<string, TerrainBiomeConfig> = {
    'landfall': LANDFALL_TERRAIN_CONFIG,
    'fob-delta': FOB_DELTA_TERRAIN_CONFIG,
    'mining-depths': FOB_DELTA_TERRAIN_CONFIG, // Use concrete for underground
    'canyon-run': CANYON_TERRAIN_CONFIG,
    'southern-ice': ICE_TERRAIN_CONFIG,
    'hive-assault': HIVE_TERRAIN_CONFIG,
    'brothers-in-arms': BROTHERS_TERRAIN_CONFIG,
    'extraction': EXTRACTION_TERRAIN_CONFIG,
    'the-breach': BREACH_TERRAIN_CONFIG,
    'final-escape': FINAL_ESCAPE_TERRAIN_CONFIG,
    'anchor-station': HIVE_TERRAIN_CONFIG, // Space station uses similar textures
  };

  return configs[levelId] ?? null;
}

/**
 * Preload all textures for a terrain configuration.
 * Call this during level loading to ensure textures are ready.
 */
export async function preloadTerrainTextures(
  scene: Scene,
  config: TerrainBiomeConfig
): Promise<void> {
  const loadTexture = (path: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const tex = new Texture(path, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, resolve, reject);
      tex.dispose();
    });
  };

  const promises: Promise<void>[] = [
    loadTexture(`${config.primary.basePath}_Color.jpg`),
    loadTexture(`${config.primary.basePath}_NormalGL.jpg`),
    loadTexture(`${config.primary.basePath}_Roughness.jpg`),
  ];

  if (config.secondary) {
    promises.push(
      loadTexture(`${config.secondary.basePath}_Color.jpg`),
      loadTexture(`${config.secondary.basePath}_NormalGL.jpg`),
      loadTexture(`${config.secondary.basePath}_Roughness.jpg`)
    );
  }

  await Promise.all(promises);
}
