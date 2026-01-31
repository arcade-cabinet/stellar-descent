/**
 * CinematicAssetLoader - Load and manage AI-generated cinematic assets
 *
 * Provides a clean interface for loading generated video and image assets
 * from the Gemini AI cache or falling back to placeholder content.
 * Integrates with the existing CinematicSystem for playback.
 */

import { getLogger } from '../core/Logger';
import { getGeminiGenerator } from '../ai/GeminiAssetGenerator';
import {
  CINEMATIC_ASSETS,
  PORTRAIT_ASSETS,
  QUEST_IMAGES,
  getAssetsForLevel,
} from '../ai/AssetManifest';
import type {
  CinematicAssetDef,
  PortraitAssetDef,
  QuestImageDef,
  LoadedCinematic,
  LoadedPortrait,
  CinematicLoadStatus,
  CachedAsset,
} from '../ai/types';
import type { LevelId } from '../levels/types';

const log = getLogger('CinematicAssetLoader');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default fallback video (black with static noise) */
const FALLBACK_VIDEO_DATA_URI = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA';

/** Default fallback image (dark placeholder) */
const FALLBACK_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Asset load timeout (ms) */
const LOAD_TIMEOUT = 30000;

// ============================================================================
// LOADER CLASS
// ============================================================================

/**
 * Manages loading and caching of AI-generated cinematic assets
 */
export class CinematicAssetLoader {
  /** Loaded cinematics by ID */
  private loadedCinematics: Map<string, LoadedCinematic> = new Map();

  /** Loaded portraits by ID */
  private loadedPortraits: Map<string, LoadedPortrait> = new Map();

  /** Loading status by level */
  private loadStatus: Map<LevelId, CinematicLoadStatus> = new Map();

  /** Whether the loader has been initialized */
  private initialized = false;

  constructor() {}

  /**
   * Initialize the loader and warm up the generator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const generator = getGeminiGenerator();
    await generator.initialize();

    this.initialized = true;
    log.info('CinematicAssetLoader initialized');
  }

  // ==========================================================================
  // CINEMATIC LOADING
  // ==========================================================================

  /**
   * Load all cinematics for a specific level
   */
  async loadLevelCinematics(levelId: LevelId): Promise<CinematicLoadStatus> {
    const status: CinematicLoadStatus = {
      level: levelId,
      ready: false,
      progress: 0,
      failed: [],
      placeholders: [],
    };

    this.loadStatus.set(levelId, status);

    const levelAssets = getAssetsForLevel(levelId);
    const cinematics = levelAssets.cinematics;

    if (cinematics.length === 0) {
      status.ready = true;
      status.progress = 1;
      return status;
    }

    let loaded = 0;
    const total = cinematics.length;

    for (const def of cinematics) {
      try {
        const cinematic = await this.loadCinematic(def);
        this.loadedCinematics.set(def.id, cinematic);

        if (cinematic.isPlaceholder) {
          status.placeholders.push(def.id);
        }

        loaded++;
        status.progress = loaded / total;
      } catch (error) {
        log.error(`Failed to load cinematic ${def.id}:`, error);
        status.failed.push(def.id);
        loaded++;
        status.progress = loaded / total;
      }
    }

    status.ready = true;
    log.info(
      `Loaded ${cinematics.length} cinematics for ${levelId}`,
      `(${status.placeholders.length} placeholders, ${status.failed.length} failed)`
    );

    return status;
  }

  /**
   * Load a single cinematic asset
   */
  private async loadCinematic(def: CinematicAssetDef): Promise<LoadedCinematic> {
    const generator = getGeminiGenerator();

    // Try to get from cache
    const cached = await generator.getCached(def.id);

    if (cached && cached.type === 'video' && cached.data) {
      return this.createVideoElement(def, cached);
    }

    // Return placeholder if not cached
    log.info(`Using placeholder for cinematic: ${def.id}`);
    return this.createPlaceholderCinematic(def);
  }

  /**
   * Create a video element from cached data
   */
  private async createVideoElement(
    def: CinematicAssetDef,
    cached: CachedAsset
  ): Promise<LoadedCinematic> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true; // Mute by default, audio will be handled separately
      video.playsInline = true;
      video.preload = 'auto';

      const timeoutId = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, LOAD_TIMEOUT);

      video.onloadeddata = () => {
        clearTimeout(timeoutId);
        resolve({
          id: def.id,
          level: def.level,
          videoElement: video,
          isPlaceholder: false,
          duration: video.duration || def.duration,
        });
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        log.warn(`Video element error for ${def.id}, using placeholder`);
        resolve(this.createPlaceholderCinematic(def));
      };

      // Set source from base64 data
      const dataUri = `data:${cached.mimeType ?? 'video/mp4'};base64,${cached.data}`;
      video.src = dataUri;
      video.load();
    });
  }

  /**
   * Create a placeholder cinematic (black screen or static image)
   */
  private createPlaceholderCinematic(def: CinematicAssetDef): LoadedCinematic {
    // Create a simple placeholder image element
    const img = document.createElement('img');
    img.src = FALLBACK_IMAGE_DATA_URI;

    return {
      id: def.id,
      level: def.level,
      fallbackImage: img,
      isPlaceholder: true,
      duration: def.duration,
    };
  }

  // ==========================================================================
  // PORTRAIT LOADING
  // ==========================================================================

  /**
   * Load all character portraits
   */
  async loadAllPortraits(): Promise<Map<string, LoadedPortrait>> {
    const generator = getGeminiGenerator();

    for (const def of PORTRAIT_ASSETS) {
      try {
        const portrait = await this.loadPortrait(def);
        this.loadedPortraits.set(def.id, portrait);
      } catch (error) {
        log.warn(`Failed to load portrait ${def.id}:`, error);
        // Create placeholder
        this.loadedPortraits.set(def.id, this.createPlaceholderPortrait(def));
      }
    }

    log.info(`Loaded ${this.loadedPortraits.size} portraits`);
    return this.loadedPortraits;
  }

  /**
   * Load a single portrait asset
   */
  private async loadPortrait(def: PortraitAssetDef): Promise<LoadedPortrait> {
    const generator = getGeminiGenerator();

    // Try to get from cache
    const cached = await generator.getCached(def.id);

    if (cached && cached.type === 'image' && cached.data) {
      return this.createImageElement(def, cached);
    }

    // Return placeholder if not cached
    return this.createPlaceholderPortrait(def);
  }

  /**
   * Create an image element from cached data
   */
  private async createImageElement(
    def: PortraitAssetDef,
    cached: CachedAsset
  ): Promise<LoadedPortrait> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');

      const timeoutId = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, LOAD_TIMEOUT);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve({
          id: def.id,
          characterId: def.characterId,
          emotion: def.emotion ?? 'neutral',
          imageElement: img,
          isPlaceholder: false,
        });
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(this.createPlaceholderPortrait(def));
      };

      // Set source from base64 data
      const dataUri = `data:${cached.mimeType ?? 'image/png'};base64,${cached.data}`;
      img.src = dataUri;
    });
  }

  /**
   * Create a placeholder portrait
   */
  private createPlaceholderPortrait(def: PortraitAssetDef): LoadedPortrait {
    const img = document.createElement('img');
    img.src = FALLBACK_IMAGE_DATA_URI;

    return {
      id: def.id,
      characterId: def.characterId,
      emotion: def.emotion ?? 'neutral',
      imageElement: img,
      isPlaceholder: true,
    };
  }

  // ==========================================================================
  // QUEST IMAGE LOADING
  // ==========================================================================

  /**
   * Load quest images for a level
   */
  async loadQuestImages(levelId: LevelId): Promise<Map<string, HTMLImageElement>> {
    const result = new Map<string, HTMLImageElement>();
    const levelAssets = getAssetsForLevel(levelId);
    const generator = getGeminiGenerator();

    for (const def of levelAssets.questImages) {
      try {
        const cached = await generator.getCached(def.id);

        if (cached && cached.type === 'image' && cached.data) {
          const img = await this.loadQuestImage(def, cached);
          result.set(def.id, img);
        } else {
          // Use placeholder
          const img = document.createElement('img');
          img.src = FALLBACK_IMAGE_DATA_URI;
          result.set(def.id, img);
        }
      } catch (error) {
        log.warn(`Failed to load quest image ${def.id}:`, error);
        const img = document.createElement('img');
        img.src = FALLBACK_IMAGE_DATA_URI;
        result.set(def.id, img);
      }
    }

    return result;
  }

  /**
   * Load a single quest image
   */
  private async loadQuestImage(
    def: QuestImageDef,
    cached: CachedAsset
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');

      const timeoutId = setTimeout(() => {
        reject(new Error('Quest image load timeout'));
      }, LOAD_TIMEOUT);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        const fallback = document.createElement('img');
        fallback.src = FALLBACK_IMAGE_DATA_URI;
        resolve(fallback);
      };

      const dataUri = `data:${cached.mimeType ?? 'image/png'};base64,${cached.data}`;
      img.src = dataUri;
    });
  }

  // ==========================================================================
  // ACCESSORS
  // ==========================================================================

  /**
   * Get a loaded cinematic by ID
   */
  getCinematic(id: string): LoadedCinematic | undefined {
    return this.loadedCinematics.get(id);
  }

  /**
   * Get a loaded portrait by character ID and emotion
   */
  getPortrait(characterId: string, emotion = 'neutral'): LoadedPortrait | undefined {
    // Try exact match first
    const exactId = `portrait_${characterId}_${emotion}`;
    const exact = this.loadedPortraits.get(exactId);
    if (exact) return exact;

    // Fall back to neutral emotion
    const neutralId = `portrait_${characterId}_neutral`;
    return this.loadedPortraits.get(neutralId);
  }

  /**
   * Get load status for a level
   */
  getLoadStatus(levelId: LevelId): CinematicLoadStatus | undefined {
    return this.loadStatus.get(levelId);
  }

  /**
   * Check if a level's cinematics are fully loaded
   */
  isLevelReady(levelId: LevelId): boolean {
    const status = this.loadStatus.get(levelId);
    return status?.ready ?? false;
  }

  /**
   * Get all cinematic IDs for a level
   */
  getCinematicIdsForLevel(levelId: LevelId): string[] {
    return CINEMATIC_ASSETS.filter((c) => c.level === levelId).map((c) => c.id);
  }

  // ==========================================================================
  // PLAYBACK HELPERS
  // ==========================================================================

  /**
   * Play a cinematic video element
   */
  async playCinematic(id: string): Promise<void> {
    const cinematic = this.loadedCinematics.get(id);
    if (!cinematic) {
      log.warn(`Cinematic not loaded: ${id}`);
      return;
    }

    if (cinematic.videoElement) {
      cinematic.videoElement.currentTime = 0;
      await cinematic.videoElement.play();
    }
  }

  /**
   * Pause a cinematic video element
   */
  pauseCinematic(id: string): void {
    const cinematic = this.loadedCinematics.get(id);
    if (cinematic?.videoElement) {
      cinematic.videoElement.pause();
    }
  }

  /**
   * Stop and reset a cinematic video element
   */
  stopCinematic(id: string): void {
    const cinematic = this.loadedCinematics.get(id);
    if (cinematic?.videoElement) {
      cinematic.videoElement.pause();
      cinematic.videoElement.currentTime = 0;
    }
  }

  /**
   * Get the duration of a cinematic
   */
  getCinematicDuration(id: string): number {
    const cinematic = this.loadedCinematics.get(id);
    return cinematic?.duration ?? 0;
  }

  // ==========================================================================
  // PRELOADING
  // ==========================================================================

  /**
   * Preload cinematics for upcoming levels
   */
  async preloadNextLevel(currentLevelId: LevelId): Promise<void> {
    const levelOrder: LevelId[] = [
      'anchor_station',
      'landfall',
      'canyon_run',
      'fob_delta',
      'brothers_in_arms',
      'southern_ice',
      'the_breach',
      'hive_assault',
      'extraction',
      'final_escape',
    ];

    const currentIndex = levelOrder.indexOf(currentLevelId);
    if (currentIndex === -1 || currentIndex >= levelOrder.length - 1) return;

    const nextLevelId = levelOrder[currentIndex + 1];

    // Don't block on this, load in background
    this.loadLevelCinematics(nextLevelId).catch((error) => {
      log.warn(`Failed to preload cinematics for ${nextLevelId}:`, error);
    });
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Unload cinematics for a level to free memory
   */
  unloadLevel(levelId: LevelId): void {
    const cinematicIds = this.getCinematicIdsForLevel(levelId);

    for (const id of cinematicIds) {
      const cinematic = this.loadedCinematics.get(id);
      if (cinematic?.videoElement) {
        cinematic.videoElement.pause();
        cinematic.videoElement.src = '';
        cinematic.videoElement.load(); // Reset
      }
      this.loadedCinematics.delete(id);
    }

    this.loadStatus.delete(levelId);
    log.info(`Unloaded cinematics for ${levelId}`);
  }

  /**
   * Dispose the loader and clean up all resources
   */
  dispose(): void {
    // Clean up all video elements
    for (const [, cinematic] of this.loadedCinematics) {
      if (cinematic.videoElement) {
        cinematic.videoElement.pause();
        cinematic.videoElement.src = '';
      }
    }

    this.loadedCinematics.clear();
    this.loadedPortraits.clear();
    this.loadStatus.clear();
    this.initialized = false;

    log.info('CinematicAssetLoader disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global singleton instance */
let loaderInstance: CinematicAssetLoader | null = null;

/**
 * Get or create the global CinematicAssetLoader instance
 */
export function getCinematicLoader(): CinematicAssetLoader {
  if (!loaderInstance) {
    loaderInstance = new CinematicAssetLoader();
  }
  return loaderInstance;
}

/**
 * Initialize the global cinematic loader
 */
export async function initializeCinematicLoader(): Promise<void> {
  const loader = getCinematicLoader();
  await loader.initialize();
}

export default CinematicAssetLoader;
