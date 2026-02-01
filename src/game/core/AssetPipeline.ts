/**
 * AssetPipeline - Smart asset loading pipeline with priority queue,
 * dependency resolution, memory budget, and background prefetch.
 *
 * Architecture:
 *  - Three priority bands: CRITICAL > HIGH > LOW.
 *  - Parallel loading with a configurable concurrency limit (default 3).
 *  - Dependency-aware: if mesh A depends on texture B, B loads first.
 *  - Memory budget: tracks estimated VRAM and evicts unused assets.
 *  - Texture format detection: prefers KTX2 when the browser supports it.
 *  - Progress callbacks for LoadingScreen integration.
 *  - Background prefetch: loads next-level assets during gameplay.
 */

import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF';

import type { LevelId } from '../levels/types';
import { getLogger } from './Logger';

const log = getLogger('AssetPipeline');

import {
  type AssetEntry,
  estimateTotalSizeKB,
  getAssetEntry,
  getNextLevelId,
  LEVEL_MANIFESTS,
} from '../assets';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AssetPriority = 'critical' | 'high' | 'low';

export interface PipelineProgress {
  /** Total items scheduled for the current operation */
  total: number;
  /** Items completed so far */
  loaded: number;
  /** Percentage 0-100 */
  percent: number;
  /** Size-weighted percentage 0-100 (more accurate for progress bar) */
  weightedPercent: number;
  /** Current asset id being loaded */
  currentAsset: string;
  /** Human-readable stage name for the loading screen */
  stage: string;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

/** What the pipeline stores in cache for a loaded asset */
export interface CachedPipelineAsset {
  id: string;
  entry: AssetEntry;
  /** For models: original meshes (hidden, used as instancing source) */
  meshes?: AbstractMesh[];
  /** For models: root TransformNode */
  root?: TransformNode;
  /** For textures: BabylonJS Texture */
  texture?: Texture;
  /** For raw data: ArrayBuffer or string */
  data?: unknown;
  /** When the asset was last accessed (for LRU eviction) */
  lastAccessTime: number;
  /** Which levels currently hold a reference to this asset */
  referencedByLevels: Set<LevelId>;
  /** Estimated memory cost in KB */
  memoryCostKB: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// KTX2 support detection
// ---------------------------------------------------------------------------

let _ktx2Supported: boolean | null = null;

function isKTX2Supported(): boolean {
  if (_ktx2Supported !== null) return _ktx2Supported;
  // We check for the compressed texture WebGL extension
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (gl) {
      const ext =
        (gl as WebGLRenderingContext).getExtension('WEBGL_compressed_texture_s3tc') ||
        (gl as WebGLRenderingContext).getExtension('WEBGL_compressed_texture_astc') ||
        (gl as WebGLRenderingContext).getExtension('WEBGL_compressed_texture_etc');
      _ktx2Supported = ext !== null;
    } else {
      _ktx2Supported = false;
    }
  } catch {
    _ktx2Supported = false;
  }
  return _ktx2Supported;
}

// ---------------------------------------------------------------------------
// AssetPipeline class
// ---------------------------------------------------------------------------

export class AssetPipeline {
  // Cache of loaded assets (keyed by asset id)
  private cache: Map<string, CachedPipelineAsset> = new Map();

  // In-flight loading promises (prevent duplicate loads)
  private inflight: Map<string, Promise<CachedPipelineAsset | null>> = new Map();

  // Concurrency control
  private readonly maxConcurrency: number;
  private activeLoads = 0;

  // Memory budget (in KB)
  private memoryBudgetKB: number;
  private currentMemoryKB = 0;

  // Scene reference
  private scene: Scene | null = null;

  // Background prefetch state
  private prefetchAbort: AbortController | null = null;

  // Progress tracking for the current batch operation
  private batchTotal = 0;
  private batchLoaded = 0;
  private batchTotalSizeKB = 0;
  private batchLoadedSizeKB = 0;
  private batchCurrentAsset = '';
  private batchStage = '';
  private progressCb: ProgressCallback | null = null;

  constructor(options?: { maxConcurrency?: number; memoryBudgetMB?: number }) {
    this.maxConcurrency = options?.maxConcurrency ?? 3;
    this.memoryBudgetKB = (options?.memoryBudgetMB ?? 512) * 1024;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Bind the pipeline to a BabylonJS scene. Must be called before loading.
   */
  init(scene: Scene): void {
    this.scene = scene;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Load all assets for a level, respecting priority bands and dependencies.
   *
   * Phase 1 (CRITICAL): required assets -- blocks until all are loaded.
   * Phase 2 (HIGH): preload assets -- loads during loading screen.
   * Phase 3 (LOW): deferred assets -- queued but caller need not wait.
   *
   * @returns Promise that resolves when CRITICAL + HIGH are loaded.
   *          LOW assets continue loading in the background.
   */
  async loadLevel(levelId: LevelId, onProgress?: ProgressCallback): Promise<void> {
    const manifest = LEVEL_MANIFESTS[levelId];
    if (!manifest) {
      log.warn(`No manifest for level: ${levelId}`);
      return;
    }

    this.progressCb = onProgress ?? null;

    // Collect all unique asset ids across all bands
    const allIds = [...manifest.required, ...manifest.preload, ...manifest.deferred];
    const uniqueIds = [...new Set(allIds)];

    // Resolve dependencies recursively
    const resolved = this.resolveDependencies(uniqueIds);

    // Split into already-cached and need-to-load
    const toLoad = resolved.filter((id) => !this.cache.has(id));
    const totalToLoad = toLoad.length;

    // Setup batch progress counters
    // We count required + preload for the loading screen (deferred is background)
    const requiredAndPreloadIds = new Set([...manifest.required, ...manifest.preload]);
    const screenIds = toLoad.filter((id) => requiredAndPreloadIds.has(id));
    this.batchTotal = screenIds.length;
    this.batchLoaded = 0;
    this.batchTotalSizeKB = this.sumSizeKB(screenIds);
    this.batchLoadedSizeKB = 0;
    this.batchStage = 'LOADING ASSETS';
    this.batchCurrentAsset = '';

    // Mark cached assets as referenced by this level
    for (const id of uniqueIds) {
      const cached = this.cache.get(id);
      if (cached) {
        cached.referencedByLevels.add(levelId);
        cached.lastAccessTime = performance.now();
      }
    }

    // Phase 1: CRITICAL
    this.batchStage = 'LOADING CRITICAL ASSETS';
    await this.loadBand(manifest.required, 'critical', levelId);

    // Phase 2: HIGH
    this.batchStage = 'LOADING LEVEL ASSETS';
    await this.loadBand(manifest.preload, 'high', levelId);

    // Fire 100% progress
    this.emitProgress();

    // Phase 3: LOW -- fire and forget (but still tracked in cache)
    this.batchStage = 'LOADING DEFERRED';
    this.loadBand(manifest.deferred, 'low', levelId).catch((err) => {
      throw new Error(`Deferred load error: ${err}`);
    });

    this.progressCb = null;
    log.info(
      `Level ${levelId}: ${totalToLoad} assets loaded, ` +
        `${uniqueIds.length - totalToLoad} from cache`
    );
  }

  /**
   * Background prefetch of the next level's assets.
   * Intended to run during gameplay at LOW priority.
   * Cancels any previous prefetch.
   */
  async prefetchNextLevel(currentLevelId: LevelId): Promise<void> {
    // Cancel any running prefetch
    this.cancelPrefetch();

    const nextId = getNextLevelId(currentLevelId);
    if (!nextId) return;

    const manifest = LEVEL_MANIFESTS[nextId];
    if (!manifest) return;

    this.prefetchAbort = new AbortController();
    this.isPrefetching = true;

    log.info(`Prefetching assets for next level: ${nextId}`);

    // Load only required + preload at LOW priority
    const ids = [...manifest.required, ...manifest.preload];
    const toLoad = ids.filter((id) => !this.cache.has(id));

    try {
      await this.loadBand(toLoad, 'low', nextId, this.prefetchAbort.signal);
      log.info(`Prefetch complete for ${nextId}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        log.info(`Prefetch cancelled for ${nextId}`);
      } else {
        throw err;
      }
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Cancel any running background prefetch.
   */
  cancelPrefetch(): void {
    if (this.prefetchAbort) {
      this.prefetchAbort.abort();
      this.prefetchAbort = null;
    }
  }

  /**
   * Unload all assets exclusively owned by a level.
   * Shared assets (referenced by other loaded levels) are kept.
   */
  unloadLevel(levelId: LevelId): void {
    const toRemove: string[] = [];
    for (const [id, cached] of this.cache) {
      cached.referencedByLevels.delete(levelId);
      if (cached.referencedByLevels.size === 0) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.disposeAsset(id);
    }

    log.info(
      `Unloaded level ${levelId}: removed ${toRemove.length} assets, ` +
        `${this.cache.size} remain in cache`
    );
  }

  /**
   * Get a cached asset by id. Returns null if not loaded.
   * Updates the LRU timestamp.
   */
  getAsset(id: string): CachedPipelineAsset | null {
    const cached = this.cache.get(id);
    if (cached) {
      cached.lastAccessTime = performance.now();
      return cached;
    }
    return null;
  }

  /**
   * Check if an asset is loaded and cached.
   */
  isLoaded(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Get current loading progress (for external polling).
   */
  getProgress(): PipelineProgress {
    return this.buildProgress();
  }

  /**
   * Evict least-recently-used assets to free memory down to the budget.
   */
  enforceMemoryBudget(): void {
    if (this.currentMemoryKB <= this.memoryBudgetKB) return;

    // Sort by lastAccessTime ascending (oldest first)
    const sortable: [string, CachedPipelineAsset][] = [];
    for (const [id, asset] of this.cache) {
      // Only evict unreferenced assets
      if (asset.referencedByLevels.size === 0) {
        sortable.push([id, asset]);
      }
    }
    sortable.sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime);

    for (const [id] of sortable) {
      if (this.currentMemoryKB <= this.memoryBudgetKB) break;
      this.disposeAsset(id);
    }

    log.info(
      `Memory budget enforced: ${(this.currentMemoryKB / 1024).toFixed(1)}MB / ${(this.memoryBudgetKB / 1024).toFixed(1)}MB`
    );
  }

  /**
   * Set the memory budget at runtime (in MB).
   */
  setMemoryBudget(budgetMB: number): void {
    this.memoryBudgetKB = budgetMB * 1024;
    this.enforceMemoryBudget();
  }

  /**
   * Get current memory usage stats.
   */
  getMemoryStats(): { usedMB: number; budgetMB: number; assetCount: number } {
    return {
      usedMB: this.currentMemoryKB / 1024,
      budgetMB: this.memoryBudgetKB / 1024,
      assetCount: this.cache.size,
    };
  }

  /**
   * Dispose the entire pipeline (clear all cached assets).
   */
  dispose(): void {
    this.cancelPrefetch();
    for (const id of [...this.cache.keys()]) {
      this.disposeAsset(id);
    }
    this.cache.clear();
    this.inflight.clear();
    this.scene = null;
    this.currentMemoryKB = 0;
  }

  // =========================================================================
  // Internal -- dependency resolution
  // =========================================================================

  /**
   * Topologically sort asset ids so that dependencies load before dependents.
   */
  private resolveDependencies(assetIds: string[]): string[] {
    const visited = new Set<string>();
    const sorted: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const entry = getAssetEntry(id);
      if (!entry) return;
      if (entry.dependencies) {
        for (const dep of entry.dependencies) {
          visit(dep);
        }
      }
      sorted.push(id);
    };

    for (const id of assetIds) {
      visit(id);
    }

    return sorted;
  }

  // =========================================================================
  // Internal -- band loading (priority groups)
  // =========================================================================

  /**
   * Load a list of asset ids at a given priority.
   * Uses a semaphore to limit concurrency.
   */
  private async loadBand(
    assetIds: string[],
    _priority: AssetPriority,
    levelId: LevelId,
    signal?: AbortSignal
  ): Promise<void> {
    // Resolve deps and filter out already-cached
    const resolved = this.resolveDependencies(assetIds);
    const toLoad = resolved.filter((id) => !this.cache.has(id) && !this.inflight.has(id));

    if (toLoad.length === 0) return;

    // Create a promise that resolves when all items in this band are done
    const promises: Promise<void>[] = [];

    for (const id of toLoad) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const entry = getAssetEntry(id);
      if (!entry) {
        log.warn(`Unknown asset id: ${id}`);
        continue;
      }

      // Wait until a slot opens
      while (this.activeLoads >= this.maxConcurrency) {
        await this.waitForSlot();
      }

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Skip if loaded while we were waiting
      if (this.cache.has(id)) {
        // Still mark reference
        const cached = this.cache.get(id)!;
        cached.referencedByLevels.add(levelId);
        continue;
      }

      // Start loading
      const loadPromise = this.loadSingleAsset(entry, levelId);
      promises.push(
        loadPromise.then(() => {
          // Update batch progress for loading screen items
          this.batchLoaded++;
          this.batchLoadedSizeKB += entry.sizeKB;
          this.emitProgress();
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Wait for at least one active load to complete (freeing a slot).
   */
  private waitForSlot(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = (): void => {
        if (this.activeLoads < this.maxConcurrency) {
          resolve();
        } else {
          // Poll at ~frame rate; requestAnimationFrame not available in workers
          setTimeout(check, 8);
        }
      };
      setTimeout(check, 2);
    });
  }

  // =========================================================================
  // Internal -- single asset loading
  // =========================================================================

  private async loadSingleAsset(
    entry: AssetEntry,
    levelId: LevelId
  ): Promise<CachedPipelineAsset | null> {
    const { id } = entry;

    // Return cached
    if (this.cache.has(id)) {
      const cached = this.cache.get(id)!;
      cached.referencedByLevels.add(levelId);
      return cached;
    }

    // Return inflight
    if (this.inflight.has(id)) {
      const result = await this.inflight.get(id)!;
      if (result) result.referencedByLevels.add(levelId);
      return result;
    }

    this.batchCurrentAsset = id;
    this.activeLoads++;

    const promise = this.doLoad(entry, levelId);
    this.inflight.set(id, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.activeLoads--;
      this.inflight.delete(id);
    }
  }

  private async doLoad(entry: AssetEntry, levelId: LevelId): Promise<CachedPipelineAsset | null> {
    try {
      switch (entry.category) {
        case 'model':
          return await this.loadModel(entry, levelId);
        case 'texture':
          return await this.loadTexture(entry, levelId);
        case 'audio':
        case 'shader':
        case 'data':
          return await this.loadData(entry, levelId);
        default:
          log.warn(`Unsupported category: ${entry.category}`);
          return null;
      }
    } catch (err) {
      log.error(`Failed to load ${entry.id} (${entry.path}):`, err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Model loading (GLB / glTF with optional Draco)
  // -----------------------------------------------------------------------

  private async loadModel(
    entry: AssetEntry,
    levelId: LevelId
  ): Promise<CachedPipelineAsset | null> {
    if (!this.scene) {
      log.error('No scene bound');
      return null;
    }

    const startTime = performance.now();
    const result = await SceneLoader.ImportMeshAsync('', entry.path, '', this.scene);

    // Create root transform and parent meshes
    const root = new TransformNode(`pipeline_${entry.id}`, this.scene);
    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = root;
      }
      mesh.isVisible = false; // Hide original for instancing
    }

    // Estimate memory: vertex count * ~40 bytes per vertex + textures
    let vertexCount = 0;
    for (const mesh of result.meshes) {
      vertexCount += mesh.getTotalVertices();
    }
    // Rough heuristic: 40 bytes per vertex (pos+normal+uv+tangent+index)
    const memoryCostKB = Math.max(entry.sizeKB, Math.ceil((vertexCount * 40) / 1024));

    const cachedAsset: CachedPipelineAsset = {
      id: entry.id,
      entry,
      meshes: result.meshes,
      root,
      lastAccessTime: performance.now(),
      referencedByLevels: new Set([levelId]),
      memoryCostKB,
    };

    this.cache.set(entry.id, cachedAsset);
    this.currentMemoryKB += memoryCostKB;

    const elapsed = (performance.now() - startTime).toFixed(0);
    log.info(`Loaded model: ${entry.id} (${result.meshes.length} meshes, ${elapsed}ms)`);

    // Check budget after every load
    this.enforceMemoryBudget();

    return cachedAsset;
  }

  // -----------------------------------------------------------------------
  // Texture loading (prefers KTX2 when available)
  // -----------------------------------------------------------------------

  private async loadTexture(
    entry: AssetEntry,
    levelId: LevelId
  ): Promise<CachedPipelineAsset | null> {
    if (!this.scene) {
      log.error('No scene bound');
      return null;
    }

    // Choose compressed path if KTX2 is supported and an alternate path exists
    let texturePath = entry.path;
    if (entry.compressedPath && isKTX2Supported()) {
      texturePath = entry.compressedPath;
    }

    const texture = await new Promise<Texture>((resolve, reject) => {
      const tex = new Texture(
        texturePath,
        this.scene!,
        false, // noMipmap
        true, // invertY
        Texture.TRILINEAR_SAMPLINGMODE,
        () => resolve(tex),
        (_msg, exception) =>
          reject(exception || new Error(`Failed to load texture: ${texturePath}`))
      );
    });

    const memoryCostKB = entry.sizeKB;

    const cachedAsset: CachedPipelineAsset = {
      id: entry.id,
      entry,
      texture,
      lastAccessTime: performance.now(),
      referencedByLevels: new Set([levelId]),
      memoryCostKB,
    };

    this.cache.set(entry.id, cachedAsset);
    this.currentMemoryKB += memoryCostKB;

    log.info(`Loaded texture: ${entry.id}`);
    return cachedAsset;
  }

  // -----------------------------------------------------------------------
  // Generic data loading (audio, shaders, JSON)
  // -----------------------------------------------------------------------

  private async loadData(entry: AssetEntry, levelId: LevelId): Promise<CachedPipelineAsset | null> {
    const response = await fetch(entry.path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${entry.path}`);
    }

    let data: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('json')) {
      data = await response.json();
    } else if (
      contentType.includes('audio') ||
      contentType.includes('octet-stream') ||
      entry.category === 'audio'
    ) {
      data = await response.arrayBuffer();
    } else {
      data = await response.text();
    }

    const memoryCostKB = entry.sizeKB;

    const cachedAsset: CachedPipelineAsset = {
      id: entry.id,
      entry,
      data,
      lastAccessTime: performance.now(),
      referencedByLevels: new Set([levelId]),
      memoryCostKB,
    };

    this.cache.set(entry.id, cachedAsset);
    this.currentMemoryKB += memoryCostKB;

    log.info(`Loaded data: ${entry.id}`);
    return cachedAsset;
  }

  // =========================================================================
  // Internal -- dispose
  // =========================================================================

  private disposeAsset(id: string): void {
    const cached = this.cache.get(id);
    if (!cached) return;

    // Dispose BabylonJS resources
    if (cached.root) {
      cached.root.dispose();
    }
    if (cached.meshes) {
      for (const mesh of cached.meshes) {
        mesh.dispose();
      }
    }
    if (cached.texture) {
      cached.texture.dispose();
    }

    this.currentMemoryKB -= cached.memoryCostKB;
    this.cache.delete(id);
  }

  // =========================================================================
  // Internal -- progress
  // =========================================================================

  private emitProgress(): void {
    if (!this.progressCb) return;
    this.progressCb(this.buildProgress());
  }

  private buildProgress(): PipelineProgress {
    const total = this.batchTotal;
    const loaded = Math.min(this.batchLoaded, total);
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 100;
    const weightedPercent =
      this.batchTotalSizeKB > 0
        ? Math.round((this.batchLoadedSizeKB / this.batchTotalSizeKB) * 100)
        : 100;

    return {
      total,
      loaded,
      percent: Math.min(percent, 100),
      weightedPercent: Math.min(weightedPercent, 100),
      currentAsset: this.batchCurrentAsset,
      stage: this.batchStage,
    };
  }

  private sumSizeKB(ids: string[]): number {
    return estimateTotalSizeKB(ids);
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let _pipelineInstance: AssetPipeline | null = null;

/**
 * Get or create the global AssetPipeline singleton.
 */
export function getAssetPipeline(options?: {
  maxConcurrency?: number;
  memoryBudgetMB?: number;
}): AssetPipeline {
  if (!_pipelineInstance) {
    _pipelineInstance = new AssetPipeline(options);
  }
  return _pipelineInstance;
}

/**
 * Dispose the global AssetPipeline singleton.
 */
export function disposeAssetPipeline(): void {
  if (_pipelineInstance) {
    _pipelineInstance.dispose();
    _pipelineInstance = null;
  }
}
