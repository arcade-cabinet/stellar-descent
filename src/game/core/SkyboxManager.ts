/**
 * SkyboxManager - Centralized skybox and environment lighting management
 *
 * Uses proper Babylon.js patterns:
 * - CubeTexture for skybox rendering
 * - HDRCubeTexture for environment-based lighting (PBR)
 * - Fallback to procedural skybox when HDRIs not available
 *
 * Skybox types:
 * - space: Stars and nebulae for station levels
 * - desert: Dusty orange-red Mars-like sky
 * - ice: Cold overcast arctic sky with aurora hints
 * - hive: Alien purple-green atmosphere
 * - dusk: Sunset/dawn orange-purple gradient
 * - underground: Dark ambient with no visible sky
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { EquiRectangularCubeTexture } from '@babylonjs/core/Materials/Textures/equiRectangularCubeTexture';
import type { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
// Import EXR texture loader for HDRI support
import '@babylonjs/core/Materials/Textures/Loaders/exrTextureLoader';
import { getLogger } from './Logger';

const log = getLogger('SkyboxManager');

// ============================================================================
// TYPES
// ============================================================================

export type SkyboxType = 'space' | 'desert' | 'ice' | 'hive' | 'dusk' | 'underground' | 'night';

export interface SkyboxConfig {
  /** Type of skybox to create */
  type: SkyboxType;
  /** Size of the skybox mesh (default: 10000) */
  size?: number;
  /** Whether to set up environment lighting from HDRI (default: true) */
  useEnvironmentLighting?: boolean;
  /** Custom tint to apply to the skybox (multiplied with texture) */
  tint?: Color3;
  /** Intensity multiplier for environment lighting (default: 1.0) */
  environmentIntensity?: number;
  /** Rotation offset for the skybox in radians (default: 0) */
  rotation?: number;
}

export interface SkyboxResult {
  /** The skybox mesh */
  mesh: Mesh;
  /** The skybox material */
  material: StandardMaterial;
  /** The cube texture used for the skybox (if loaded) */
  cubeTexture: CubeTexture | null;
  /** The HDR texture used for environment lighting (if loaded) */
  hdrTexture: HDRCubeTexture | null;
  /** The equirectangular texture used for environment (if loaded) */
  envTexture: EquiRectangularCubeTexture | null;
  /** Dispose all skybox resources */
  dispose: () => void;
}

// ============================================================================
// HDRI PATHS
// ============================================================================

/**
 * HDRI texture paths for each skybox type.
 * Uses EXR format HDRIs from AmbientCG for environment-based lighting.
 *
 * For cube textures: use 6-face format (px, nx, py, ny, pz, nz)
 * For environment: use .exr files from AmbientCG for PBR lighting
 */
const HDRI_PATHS: Record<SkyboxType, { cubemap: string; env: string }> = {
  space: {
    cubemap: '/assets/textures/skybox/space/space',
    env: '/assets/textures/hdri/space.exr',
  },
  desert: {
    cubemap: '/assets/textures/skybox/desert/desert',
    env: '/assets/textures/hdri/desert.exr',
  },
  ice: {
    cubemap: '/assets/textures/skybox/ice/ice',
    env: '/assets/textures/hdri/ice.exr',
  },
  hive: {
    cubemap: '/assets/textures/skybox/hive/hive',
    env: '/assets/textures/hdri/hive.exr',
  },
  dusk: {
    cubemap: '/assets/textures/skybox/dusk/dusk',
    env: '/assets/textures/hdri/dusk.exr',
  },
  night: {
    cubemap: '/assets/textures/skybox/night/night',
    env: '/assets/textures/hdri/night.exr',
  },
  underground: {
    cubemap: '', // No skybox for underground
    env: '/assets/textures/hdri/underground.exr',
  },
};

/**
 * Indoor HDRI for station interior ambient lighting.
 * This provides neutral, soft lighting for indoor spaces.
 */
const INDOOR_HDRI_PATH = '/assets/textures/hdri/indoor.exr';

// ============================================================================
// FALLBACK COLORS (used when HDRIs are not available)
// ============================================================================

const FALLBACK_COLORS: Record<SkyboxType, { emissive: Color3; clear: Color4 }> = {
  space: {
    emissive: new Color3(0.02, 0.02, 0.04),
    clear: new Color4(0.02, 0.02, 0.04, 1),
  },
  desert: {
    emissive: new Color3(0.75, 0.5, 0.35),
    clear: new Color4(0.6, 0.35, 0.2, 1),
  },
  ice: {
    emissive: new Color3(0.4, 0.5, 0.6),
    clear: new Color4(0.3, 0.4, 0.5, 1),
  },
  hive: {
    emissive: new Color3(0.15, 0.08, 0.2),
    clear: new Color4(0.1, 0.05, 0.15, 1),
  },
  dusk: {
    emissive: new Color3(0.5, 0.25, 0.15),
    clear: new Color4(0.4, 0.2, 0.1, 1),
  },
  night: {
    emissive: new Color3(0.02, 0.03, 0.06),
    clear: new Color4(0.02, 0.03, 0.06, 1),
  },
  underground: {
    emissive: new Color3(0.02, 0.02, 0.02),
    clear: new Color4(0.02, 0.02, 0.02, 1),
  },
};

// ============================================================================
// SKYBOX MANAGER CLASS
// ============================================================================

export class SkyboxManager {
  private scene: Scene;
  private currentSkybox: SkyboxResult | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Create a skybox with the specified configuration.
   * Attempts to load HDRI textures, falls back to procedural colors if unavailable.
   */
  async createSkybox(config: SkyboxConfig): Promise<SkyboxResult> {
    // Dispose existing skybox if any
    this.dispose();

    const {
      type,
      size = 10000,
      useEnvironmentLighting = true,
      tint,
      environmentIntensity = 1.0,
      rotation = 0,
    } = config;

    // Create skybox mesh
    const mesh = MeshBuilder.CreateBox('skybox', { size }, this.scene);
    mesh.infiniteDistance = true;
    mesh.renderingGroupId = 0;

    // Create material
    const material = new StandardMaterial('skyboxMat', this.scene);
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();

    let cubeTexture: CubeTexture | null = null;
    const hdrTexture: HDRCubeTexture | null = null;
    let envTexture: EquiRectangularCubeTexture | null = null;

    const paths = HDRI_PATHS[type];
    const fallback = FALLBACK_COLORS[type];

    // Underground levels don't need a visible skybox
    if (type === 'underground') {
      material.emissiveColor = fallback.emissive;
      mesh.material = material;
      this.scene.clearColor = fallback.clear;

      // Still load environment texture for underground lighting
      if (useEnvironmentLighting && paths.env) {
        try {
          envTexture = await this.loadEnvironmentTexture(paths.env);
          if (envTexture) {
            this.scene.environmentTexture = envTexture;
            this.scene.environmentIntensity = environmentIntensity * 0.3; // Dimmer for underground
          }
        } catch (error) {
          log.warn(`Failed to load env for ${type}:`, error);
        }
      }

      const result: SkyboxResult = {
        mesh,
        material,
        cubeTexture: null,
        hdrTexture: null,
        envTexture,
        dispose: () => this.disposeResult(result),
      };

      this.currentSkybox = result;
      return result;
    }

    // Try to load cube texture for skybox
    if (paths.cubemap) {
      try {
        cubeTexture = await this.loadCubeTexture(paths.cubemap, rotation);
        if (cubeTexture) {
          material.reflectionTexture = cubeTexture;
          material.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
          if (tint) {
            material.emissiveColor = tint;
          }
        }
      } catch (error) {
        log.warn(`Failed to load cubemap for ${type}, using fallback:`, error);
        cubeTexture = null;
      }
    }

    // If cube texture failed, use fallback emissive color
    if (!cubeTexture) {
      material.emissiveColor = tint ? tint.multiply(fallback.emissive) : fallback.emissive;
    }

    mesh.material = material;

    // Set scene clear color
    this.scene.clearColor = fallback.clear;

    // Try to load EXR environment texture for PBR lighting
    if (useEnvironmentLighting && paths.env) {
      try {
        envTexture = await this.loadEnvironmentTexture(paths.env);
        if (envTexture) {
          this.scene.environmentTexture = envTexture;
          this.scene.environmentIntensity = environmentIntensity;
        }
      } catch (error) {
        log.warn(`Failed to load env for ${type}, using ambient:`, error);
        envTexture = null;
      }
    }

    const result: SkyboxResult = {
      mesh,
      material,
      cubeTexture,
      hdrTexture,
      envTexture,
      dispose: () => this.disposeResult(result),
    };

    this.currentSkybox = result;
    return result;
  }

  /**
   * Create a skybox synchronously using fallback colors.
   * Use this when you don't want to wait for texture loading.
   * Starts async HDRI loading in background for environment lighting.
   */
  createFallbackSkybox(config: SkyboxConfig): SkyboxResult {
    const {
      type,
      size = 10000,
      tint,
      useEnvironmentLighting = true,
      environmentIntensity = 1.0,
    } = config;

    // Dispose existing skybox if any
    this.dispose();

    const fallback = FALLBACK_COLORS[type];
    const paths = HDRI_PATHS[type];

    // Create skybox mesh (use sphere for fallback - better gradient appearance)
    const mesh = MeshBuilder.CreateSphere(
      'skybox',
      { diameter: size, segments: 32, sideOrientation: 1 },
      this.scene
    );
    mesh.infiniteDistance = true;
    mesh.renderingGroupId = 0;

    // Create material with emissive color
    const material = new StandardMaterial('skyboxMat', this.scene);
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveColor = tint ? tint.multiply(fallback.emissive) : fallback.emissive;

    mesh.material = material;
    this.scene.clearColor = fallback.clear;

    const result: SkyboxResult = {
      mesh,
      material,
      cubeTexture: null,
      hdrTexture: null,
      envTexture: null,
      dispose: () => this.disposeResult(result),
    };

    this.currentSkybox = result;

    // Start async loading of environment texture for PBR lighting
    if (useEnvironmentLighting && paths.env) {
      this.loadEnvironmentTexture(paths.env)
        .then((envTexture) => {
          if (envTexture && this.currentSkybox === result) {
            result.envTexture = envTexture;
            this.scene.environmentTexture = envTexture;
            this.scene.environmentIntensity =
              type === 'underground' ? environmentIntensity * 0.3 : environmentIntensity;
          }
        })
        .catch((error) => {
          log.warn(`Failed to load env for ${type}:`, error);
        });
    }

    return result;
  }

  /**
   * Update the skybox tint/color dynamically.
   * Useful for time-of-day transitions.
   */
  setTint(color: Color3): void {
    if (this.currentSkybox) {
      this.currentSkybox.material.emissiveColor = color;
    }
  }

  /**
   * Set the environment lighting intensity.
   */
  setEnvironmentIntensity(intensity: number): void {
    this.scene.environmentIntensity = intensity;
  }

  /**
   * Load indoor HDRI for station interior ambient lighting.
   * This provides neutral, soft lighting appropriate for indoor spaces.
   */
  async loadIndoorEnvironment(intensity: number = 0.4): Promise<void> {
    try {
      const envTexture = await this.loadEnvironmentTexture(INDOOR_HDRI_PATH);
      if (envTexture) {
        this.scene.environmentTexture = envTexture;
        this.scene.environmentIntensity = intensity;
      }
    } catch (error) {
      log.warn('Failed to load indoor environment:', error);
    }
  }

  /**
   * Get the current skybox result.
   */
  getCurrentSkybox(): SkyboxResult | null {
    return this.currentSkybox;
  }

  /**
   * Dispose all skybox resources.
   */
  dispose(): void {
    if (this.currentSkybox) {
      this.disposeResult(this.currentSkybox);
      this.currentSkybox = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async loadCubeTexture(basePath: string, rotation: number): Promise<CubeTexture | null> {
    return new Promise((resolve) => {
      // CubeTexture expects a base path and will append _px, _nx, etc.
      const texture = new CubeTexture(
        basePath,
        this.scene,
        null, // extensions (uses default)
        false, // noMipmap
        null, // files array
        () => {
          // On load success
          texture.rotationY = rotation;
          resolve(texture);
        },
        (message, exception) => {
          // On error
          log.warn(`CubeTexture load failed: ${message}`, exception);
          resolve(null);
        }
      );
    });
  }

  /**
   * Load an equirectangular environment texture (EXR format from AmbientCG).
   * This is used for PBR environment-based lighting.
   */
  private async loadEnvironmentTexture(path: string): Promise<EquiRectangularCubeTexture | null> {
    return new Promise((resolve) => {
      const texture = new EquiRectangularCubeTexture(
        path,
        this.scene,
        512, // size
        false, // noMipmap (we want mipmaps for PBR)
        true, // gammaSpace = false would be linear, but EXR is already linear
        () => {
          // On load success
          resolve(texture);
        },
        (message, exception) => {
          // On error
          log.warn(`EquiRectangularCubeTexture load failed: ${message}`, exception);
          resolve(null);
        }
      );
    });
  }

  private disposeResult(result: SkyboxResult): void {
    result.cubeTexture?.dispose();
    result.hdrTexture?.dispose();
    result.envTexture?.dispose();
    result.material?.dispose();
    result.mesh?.dispose();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a space skybox for station levels.
 * Features: stars, nebulae, dark background
 */
export function createSpaceSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'space' });
}

/**
 * Create a desert skybox for Mars-like surface levels.
 * Features: dusty orange-red atmosphere, harsh sunlight
 */
export function createDesertSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'desert' });
}

/**
 * Create an ice skybox for frozen levels.
 * Features: cold overcast sky, aurora hints
 */
export function createIceSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'ice' });
}

/**
 * Create a hive skybox for alien atmosphere levels.
 * Features: purple-green alien sky, organic feel
 */
export function createHiveSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'hive' });
}

/**
 * Create a dusk skybox for sunset/dawn levels.
 * Features: orange-purple gradient, dramatic lighting
 */
export function createDuskSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'dusk' });
}

/**
 * Create a night skybox for dark outdoor levels.
 * Features: dark blue sky, stars
 */
export function createNightSkybox(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'night' });
}

/**
 * Create ambient lighting for underground levels (no visible skybox).
 * Features: very dark, no sky visible
 */
export function createUndergroundAmbient(scene: Scene): SkyboxResult {
  const manager = new SkyboxManager(scene);
  return manager.createFallbackSkybox({ type: 'underground' });
}
