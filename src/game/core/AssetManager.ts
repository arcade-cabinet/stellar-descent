/**
 * AssetManager - Centralized GLB/asset loading, caching, and instancing system
 *
 * Handles loading, caching, and instancing of 3D models for Stellar Descent.
 * Integrates with AssetPipeline for smart priority-based loading, memory
 * budgeting, and background prefetch.
 *
 * All game-ready GLB assets are stored in public/models/ (enemies, vehicles,
 * environment, props).
 */

import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF';

import type { LevelId } from '../levels/types';
import { LODManager } from './LODManager';
import {
  getAssetPipeline,
  type PipelineProgress,
  type ProgressCallback,
} from './AssetPipeline';
import {
  getNextLevelId,
  LEVEL_MANIFESTS,
} from './AssetManifest';

// ---------------------------------------------------------------------------
// Legacy asset path / manifest (kept for backward-compatible callers)
// ---------------------------------------------------------------------------

// Asset categories and their base paths
const ASSET_PATHS = {
  aliens: '/models/aliens/',
  vehicles: '/models/vehicles/',
  structures: '/models/structures/',
  props: '/models/psx/props/',
} as const;

// Asset manifest - maps logical names to GLB files
export const ASSET_MANIFEST = {
  // Alien creatures (from UE pack conversion)
  aliens: {
    spider: 'spider.glb', // Maps to skitterer - fast crawler
    scout: 'scout.glb', // Maps to lurker - tall stalker
    soldier: 'soldier.glb', // Maps to spewer - armored ranged
    tentakel: 'tentakel.glb', // Maps to broodmother - boss
    flyingalien: 'flyingalien.glb', // Flying drone variant
    // Humanoid aliens
    alienmonster: 'alienmonster.glb',
    alienmale: 'alienmale.glb',
    alienfemale: 'alienfemale.glb',
  },
  // Vehicles
  vehicles: {
    wraith: 'wraith.glb', // Enemy hover tank
    phantom: 'phantom.glb', // Dropship for extraction
  },
  // Organic hive structures for The Breach
  structures: {
    birther: 'building_birther.glb',
    brain: 'building_brain.glb',
    claw: 'building_claw.glb',
    crystals: 'building_crystals.glb',
    stomach: 'building_stomach.glb',
    terraformer: 'building_terraformer.glb',
    undercrystal: 'building_undercrystal.glb',
  },
} as const;

// Map game alien species to GLB assets
export const SPECIES_TO_ASSET: Record<string, string> = {
  skitterer: 'spider',
  lurker: 'scout',
  spewer: 'soldier',
  husk: 'alienmale', // Dried humanoid form
  broodmother: 'tentakel',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedAsset {
  meshes: AbstractMesh[];
  root: TransformNode;
  loadTime: number;
  category: keyof typeof ASSET_PATHS | 'raw';
}

interface LoadingPromise {
  promise: Promise<CachedAsset>;
  abortController?: AbortController;
}

/** Progress data for UI integration */
export interface LoadProgress {
  stage: string;
  progress: number;
  detail?: string;
}

// ---------------------------------------------------------------------------
// AssetManagerClass
// ---------------------------------------------------------------------------

class AssetManagerClass {
  private cache: Map<string, CachedAsset> = new Map();
  private loading: Map<string, LoadingPromise> = new Map();
  private scene: Scene | null = null;

  // Pipeline integration
  private pipelineInitialized = false;

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the asset manager with a scene.
   * Also initializes the AssetPipeline singleton.
   */
  init(scene: Scene): void {
    this.scene = scene;

    // Initialize the pipeline with the same scene
    const pipeline = getAssetPipeline();
    pipeline.init(scene);
    this.pipelineInitialized = true;
  }

  // =========================================================================
  // Pipeline-backed level loading (new API)
  // =========================================================================

  /**
   * Preload all assets for a level using the AssetPipeline.
   *
   * This is the recommended way to load level assets. It uses the manifest-
   * driven pipeline with priority bands, dependency resolution, parallel
   * loading, and memory budget enforcement.
   *
   * @param levelId - Level to preload assets for
   * @param onProgress - Optional callback for LoadingScreen integration
   */
  async preloadLevel(
    levelId: LevelId,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<void> {
    if (!this.pipelineInitialized) {
      console.warn('[AssetManager] Pipeline not initialized. Call init(scene) first.');
      return;
    }

    const pipeline = getAssetPipeline();

    // Adapt PipelineProgress -> LoadProgress for the loading screen
    const adaptedCallback: ProgressCallback | undefined = onProgress
      ? (pp: PipelineProgress) => {
          onProgress({
            stage: pp.stage,
            progress: pp.weightedPercent,
            detail: pp.currentAsset,
          });
        }
      : undefined;

    await pipeline.loadLevel(levelId, adaptedCallback);

    // Sync pipeline cache into the legacy cache so that existing callers
    // (createInstance, loadAlienModel, etc.) still work.
    this.syncPipelineCacheToLegacy(levelId);
  }

  /**
   * Prefetch assets for the next level in the background.
   *
   * Call this during gameplay (e.g., after the loading screen closes or
   * at a natural break point). Uses LOW priority so it does not compete
   * with foreground work.
   *
   * @param currentLevelId - The level the player is currently in
   */
  async prefetchNextLevel(currentLevelId: LevelId): Promise<void> {
    if (!this.pipelineInitialized) return;

    const pipeline = getAssetPipeline();
    await pipeline.prefetchNextLevel(currentLevelId);

    // Pre-populate legacy cache for the next level
    const nextId = getNextLevelId(currentLevelId);
    if (nextId) {
      this.syncPipelineCacheToLegacy(nextId);
    }
  }

  /**
   * Get current loading progress from the pipeline.
   * Useful for polling from a UI component.
   */
  getLoadProgress(): LoadProgress {
    if (!this.pipelineInitialized) {
      return { stage: 'IDLE', progress: 100 };
    }
    const pp = getAssetPipeline().getProgress();
    return {
      stage: pp.stage,
      progress: pp.weightedPercent,
      detail: pp.currentAsset,
    };
  }

  /**
   * Unload all assets exclusively owned by a level.
   * Shared assets (used by other loaded levels) are kept.
   */
  unloadLevel(levelId: LevelId): void {
    if (!this.pipelineInitialized) return;

    const pipeline = getAssetPipeline();
    pipeline.unloadLevel(levelId);

    // Remove legacy cache entries that are no longer in the pipeline cache
    for (const key of [...this.cache.keys()]) {
      const pipelineId = this.legacyKeyToPipelineId(key);
      // Only clean up entries that have a pipeline mapping
      if (pipelineId !== key && !pipeline.isLoaded(pipelineId)) {
        const cached = this.cache.get(key);
        if (cached) {
          // Do not dispose -- the pipeline already disposed the underlying resources
          this.cache.delete(key);
        }
      }
    }

    console.log(`[AssetManager] Unloaded level: ${levelId}`);
  }

  /**
   * Get memory usage stats from the pipeline.
   */
  getMemoryStats(): { usedMB: number; budgetMB: number; assetCount: number } {
    if (!this.pipelineInitialized) {
      return { usedMB: 0, budgetMB: 512, assetCount: this.cache.size };
    }
    return getAssetPipeline().getMemoryStats();
  }

  // =========================================================================
  // Legacy API (preserved for backward compatibility)
  // =========================================================================

  /**
   * Get the full path for an asset
   */
  private getAssetPath(category: keyof typeof ASSET_PATHS, assetName: string): string {
    const manifest = ASSET_MANIFEST[category as keyof typeof ASSET_MANIFEST];
    if (!manifest || !(assetName in manifest)) {
      console.warn(`Asset not found in manifest: ${category}/${assetName}`);
      return '';
    }
    return `${ASSET_PATHS[category]}${manifest[assetName as keyof typeof manifest]}`;
  }

  /**
   * Load a GLB asset (with caching)
   */
  async loadAsset(
    category: keyof typeof ASSET_PATHS,
    assetName: string,
    scene?: Scene
  ): Promise<CachedAsset | null> {
    const targetScene = scene || this.scene;
    if (!targetScene) {
      console.error('AssetManager: No scene available');
      return null;
    }

    const cacheKey = `${category}/${assetName}`;

    // Return cached asset if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Return existing loading promise if in progress
    if (this.loading.has(cacheKey)) {
      return this.loading.get(cacheKey)!.promise;
    }

    const path = this.getAssetPath(category, assetName);
    if (!path) return null;

    // Start loading
    const loadPromise = this.loadGLB(path, targetScene, cacheKey, category);
    this.loading.set(cacheKey, { promise: loadPromise });

    try {
      const asset = await loadPromise;
      this.cache.set(cacheKey, asset);
      return asset;
    } catch (error) {
      console.error(`Failed to load asset ${cacheKey}:`, error);
      return null;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  /**
   * Load a GLB file and return meshes
   */
  private async loadGLB(
    path: string,
    scene: Scene,
    name: string,
    category: keyof typeof ASSET_PATHS | 'raw'
  ): Promise<CachedAsset> {
    const startTime = performance.now();

    console.log(`[AssetManager] Loading GLB: ${path}`);

    const result = await SceneLoader.ImportMeshAsync('', path, '', scene);

    console.log(`[AssetManager] GLB loaded: ${path} - ${result.meshes.length} meshes found`);

    // Create a root transform node for the asset
    const root = new TransformNode(`asset_${name}`, scene);

    // Parent all meshes to root and hide the originals (for instancing)
    let meshWithGeometry = 0;
    result.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.parent = root;
      }
      mesh.isVisible = false; // Hide original, we'll create instances
      if (mesh instanceof Mesh && mesh.geometry) {
        meshWithGeometry++;
      }
    });

    console.log(
      `[AssetManager] GLB ${name}: ${meshWithGeometry}/${result.meshes.length} meshes have geometry (can be instanced)`
    );

    return {
      meshes: result.meshes,
      root,
      loadTime: performance.now() - startTime,
      category,
    };
  }

  /**
   * Create an instance of a loaded asset
   * @param applyLOD Whether to apply LOD to the instance (default: true for non-player assets)
   */
  createInstance(
    category: keyof typeof ASSET_PATHS,
    assetName: string,
    instanceName: string,
    scene?: Scene,
    applyLOD: boolean = true
  ): TransformNode | null {
    const cacheKey = `${category}/${assetName}`;
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      console.warn(`[AssetManager] Asset not loaded: ${cacheKey}. Call loadAsset first.`);
      return null;
    }

    const targetScene = scene || this.scene;
    if (!targetScene) return null;

    // Create a new transform node for this instance
    const instanceRoot = new TransformNode(instanceName, targetScene);

    // Create instances of all meshes (only Mesh type supports createInstance)
    let instanceCount = 0;
    cached.meshes.forEach((mesh) => {
      if (mesh instanceof Mesh && mesh.geometry) {
        const instance = mesh.createInstance(`${instanceName}_${mesh.name}`);
        instance.parent = instanceRoot;
        instance.isVisible = true;
        instanceCount++;
      }
    });

    if (instanceCount === 0) {
      console.warn(
        `[AssetManager] WARNING: Created instance '${instanceName}' but NO mesh instances were created from ${cacheKey}. ` +
          `This likely means the GLB has no instancable geometry.`
      );
    } else {
      console.log(
        `[AssetManager] Created instance '${instanceName}' with ${instanceCount} mesh instances from ${cacheKey}`
      );

      // Apply LOD to the instance based on category
      if (applyLOD) {
        const lodCategory = this.mapAssetCategoryToLODCategory(category);
        LODManager.applyNativeLODToNode(instanceRoot, lodCategory);
      }
    }

    return instanceRoot;
  }

  /**
   * Map asset category to LOD category for appropriate distance thresholds
   */
  private mapAssetCategoryToLODCategory(category: keyof typeof ASSET_PATHS | 'raw'): string {
    switch (category) {
      case 'aliens':
        return 'enemy';
      case 'vehicles':
        return 'vehicle';
      case 'structures':
        return 'environment';
      case 'props':
        return 'prop';
      case 'raw':
        return 'environment';
      default:
        return 'prop';
    }
  }

  /**
   * Load and immediately create an instance (convenience method)
   */
  async loadAndCreateInstance(
    category: keyof typeof ASSET_PATHS,
    assetName: string,
    instanceName: string,
    scene?: Scene
  ): Promise<TransformNode | null> {
    const asset = await this.loadAsset(category, assetName, scene);
    if (!asset) {
      console.warn(
        `[AssetManager] loadAndCreateInstance failed: could not load ${category}/${assetName}`
      );
      return null;
    }
    return this.createInstance(category, assetName, instanceName, scene);
  }

  /**
   * Load an alien model by species ID
   */
  async loadAlienModel(speciesId: string, scene?: Scene): Promise<CachedAsset | null> {
    const assetName = SPECIES_TO_ASSET[speciesId];
    if (!assetName) {
      console.warn(`No GLB asset mapped for species: ${speciesId}`);
      return null;
    }
    return this.loadAsset('aliens', assetName, scene);
  }

  /**
   * Create an instance of an alien by species ID
   */
  createAlienInstance(
    speciesId: string,
    instanceName: string,
    scene?: Scene
  ): TransformNode | null {
    const assetName = SPECIES_TO_ASSET[speciesId];
    if (!assetName) return null;
    return this.createInstance('aliens', assetName, instanceName, scene);
  }

  /**
   * Preload common assets for a level.
   * If the pipeline is initialized, delegates to preloadLevel for manifest-driven loading.
   * Otherwise falls back to the legacy sequential loading path.
   */
  async preloadForLevel(
    levelId: string,
    scene: Scene,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    // If the pipeline is initialized, try to use it for levels in the manifest
    if (this.pipelineInitialized && levelId in LEVEL_MANIFESTS) {
      await this.preloadLevel(levelId as LevelId, onProgress
        ? (p) => {
            const total = 100;
            const loaded = Math.round(p.progress);
            onProgress(loaded, total);
          }
        : undefined
      );
      return;
    }

    // Fallback: legacy sequential loading
    const levelAssets: Record<
      string,
      Array<{ category: keyof typeof ASSET_PATHS; name: string }>
    > = {
      anchor_station: [],
      landfall: [
        { category: 'aliens', name: 'spider' },
        { category: 'aliens', name: 'scout' },
        { category: 'vehicles', name: 'wraith' },
        { category: 'vehicles', name: 'phantom' },
      ],
      fob_delta: [
        { category: 'aliens', name: 'spider' },
        { category: 'aliens', name: 'scout' },
        { category: 'aliens', name: 'soldier' },
        { category: 'vehicles', name: 'wraith' },
      ],
      brothers_in_arms: [
        { category: 'aliens', name: 'spider' },
        { category: 'aliens', name: 'scout' },
        { category: 'aliens', name: 'soldier' },
        { category: 'aliens', name: 'flyingalien' },
        { category: 'vehicles', name: 'wraith' },
      ],
      the_breach: [
        { category: 'aliens', name: 'spider' },
        { category: 'aliens', name: 'scout' },
        { category: 'aliens', name: 'soldier' },
        { category: 'aliens', name: 'tentakel' },
        { category: 'structures', name: 'birther' },
        { category: 'structures', name: 'brain' },
        { category: 'structures', name: 'claw' },
        { category: 'structures', name: 'crystals' },
        { category: 'structures', name: 'stomach' },
        { category: 'vehicles', name: 'wraith' },
        { category: 'vehicles', name: 'phantom' },
      ],
      extraction: [
        { category: 'aliens', name: 'spider' },
        { category: 'aliens', name: 'scout' },
        { category: 'aliens', name: 'soldier' },
        { category: 'aliens', name: 'flyingalien' },
        { category: 'vehicles', name: 'phantom' },
      ],
    };

    const assets = levelAssets[levelId] || [];
    let loaded = 0;

    for (const asset of assets) {
      await this.loadAsset(asset.category, asset.name, scene);
      loaded++;
      onProgress?.(loaded, assets.length);
    }
  }

  /**
   * Load a GLB asset by its raw file path (with caching).
   * Useful for PSX structural models referenced by direct path in assemblage definitions.
   */
  async loadAssetByPath(
    path: string,
    scene?: Scene
  ): Promise<CachedAsset | null> {
    const targetScene = scene || this.scene;
    if (!targetScene) {
      console.error('AssetManager: No scene available');
      return null;
    }

    const cacheKey = `path:${path}`;

    // Return cached asset if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Return existing loading promise if in progress
    if (this.loading.has(cacheKey)) {
      return this.loading.get(cacheKey)!.promise;
    }

    if (!path) return null;

    // Start loading
    const loadPromise = this.loadGLB(path, targetScene, cacheKey, 'raw');
    this.loading.set(cacheKey, { promise: loadPromise });

    try {
      const asset = await loadPromise;
      this.cache.set(cacheKey, asset);
      return asset;
    } catch (error) {
      console.error(`Failed to load asset at path ${path}:`, error);
      return null;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  /**
   * Create an instance from a cached asset loaded by path.
   * Returns a new TransformNode with instanced meshes parented to it.
   */
  createInstanceByPath(
    path: string,
    instanceName: string,
    scene?: Scene,
    applyLOD: boolean = true,
    lodCategory: string = 'environment'
  ): TransformNode | null {
    const cacheKey = `path:${path}`;
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      console.warn(`[AssetManager] Asset not loaded for path: ${path}. Call loadAssetByPath first.`);
      return null;
    }

    const targetScene = scene || this.scene;
    if (!targetScene) return null;

    // Create a new transform node for this instance
    const instanceRoot = new TransformNode(instanceName, targetScene);

    // Create instances of all meshes (only Mesh type supports createInstance)
    let instanceCount = 0;
    cached.meshes.forEach((mesh) => {
      if (mesh instanceof Mesh && mesh.geometry) {
        const instance = mesh.createInstance(`${instanceName}_${mesh.name}`);
        instance.parent = instanceRoot;
        instance.isVisible = true;
        instanceCount++;
      }
    });

    if (instanceCount === 0) {
      // Fallback: clone meshes if instancing is not possible
      cached.meshes.forEach((mesh) => {
        if (mesh.getTotalVertices() > 0) {
          const clone = (mesh as Mesh).clone(`${instanceName}_${mesh.name}`, instanceRoot);
          if (clone) {
            clone.setEnabled(true);
            clone.isVisible = true;
            instanceCount++;
          }
        }
      });
    }

    if (instanceCount > 0 && applyLOD) {
      LODManager.applyNativeLODToNode(instanceRoot, lodCategory);
    }

    return instanceRoot;
  }

  /**
   * Check whether an asset at a given path is already cached.
   */
  isPathCached(path: string): boolean {
    return this.cache.has(`path:${path}`);
  }

  /**
   * Check whether an asset by category/name is already cached.
   */
  isCached(category: keyof typeof ASSET_PATHS, assetName: string): boolean {
    return this.cache.has(`${category}/${assetName}`);
  }

  /**
   * Clear cache for a specific asset or all assets
   */
  clearCache(cacheKey?: string): void {
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        cached.root.dispose();
        cached.meshes.forEach((m) => m.dispose());
        this.cache.delete(cacheKey);
      }
    } else {
      this.cache.forEach((cached) => {
        cached.root.dispose();
        cached.meshes.forEach((m) => m.dispose());
      });
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    totalLoadTime: number;
    assetNames: string[];
    memoryStats: { usedMB: number; budgetMB: number; assetCount: number };
  } {
    let totalLoadTime = 0;
    const assetNames: string[] = [];

    this.cache.forEach((cached, key) => {
      totalLoadTime += cached.loadTime;
      assetNames.push(key);
    });

    return {
      cacheSize: this.cache.size,
      totalLoadTime,
      assetNames,
      memoryStats: this.getMemoryStats(),
    };
  }

  // =========================================================================
  // Internal -- pipeline <-> legacy cache synchronization
  // =========================================================================

  /**
   * Map a pipeline asset id (e.g. "enemy/spider") to a legacy cache key
   * (e.g. "aliens/spider").
   */
  private pipelineIdToLegacyKey(pipelineId: string): string | null {
    const prefixMap: Record<string, keyof typeof ASSET_PATHS> = {
      'enemy/': 'aliens',
      'vehicle/': 'vehicles',
      'structure/': 'structures',
      'prop/': 'props',
    };

    for (const [prefix, legacyCategory] of Object.entries(prefixMap)) {
      if (pipelineId.startsWith(prefix)) {
        const name = pipelineId.slice(prefix.length);
        return `${legacyCategory}/${name}`;
      }
    }

    // Station, texture and other types do not have legacy equivalents
    return null;
  }

  /**
   * Map a legacy cache key back to a pipeline id.
   */
  private legacyKeyToPipelineId(legacyKey: string): string {
    const categoryMap: Record<string, string> = {
      'aliens/': 'enemy/',
      'vehicles/': 'vehicle/',
      'structures/': 'structure/',
      'props/': 'prop/',
    };
    for (const [prefix, pipelinePrefix] of Object.entries(categoryMap)) {
      if (legacyKey.startsWith(prefix)) {
        return pipelinePrefix + legacyKey.slice(prefix.length);
      }
    }
    return legacyKey;
  }

  /**
   * Copy pipeline-loaded assets into the legacy cache so that
   * createInstance / loadAlienModel / etc. continue to work.
   */
  private syncPipelineCacheToLegacy(levelId: LevelId): void {
    const manifest = LEVEL_MANIFESTS[levelId];
    if (!manifest) return;

    const pipeline = getAssetPipeline();
    const allIds = [...manifest.required, ...manifest.preload, ...manifest.deferred];

    for (const pipelineId of allIds) {
      const legacyKey = this.pipelineIdToLegacyKey(pipelineId);
      if (!legacyKey) continue; // No legacy equivalent (textures, station pieces, etc.)
      if (this.cache.has(legacyKey)) continue; // Already cached

      const pipelineAsset = pipeline.getAsset(pipelineId);
      if (!pipelineAsset || !pipelineAsset.meshes || !pipelineAsset.root) continue;

      // Create a CachedAsset facade that shares the same underlying meshes
      const category = legacyKey.split('/')[0] as keyof typeof ASSET_PATHS;
      const cachedAsset: CachedAsset = {
        meshes: pipelineAsset.meshes,
        root: pipelineAsset.root,
        loadTime: 0,
        category,
      };

      this.cache.set(legacyKey, cachedAsset);
    }
  }
}

// Export singleton instance
export const AssetManager = new AssetManagerClass();
