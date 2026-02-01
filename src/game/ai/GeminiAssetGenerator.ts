/**
 * GeminiAssetGenerator - AI-Powered Asset Generation
 *
 * Integrates Google Gemini AI for generating cinematic videos (Veo 3.1),
 * images (Imagen), and dynamic text content for Stellar Descent.
 *
 * Uses @google/genai SDK following the latest codegen instructions.
 * Supports caching to IndexedDB and graceful fallbacks when API is unavailable.
 */

import { GoogleGenAI } from '@google/genai';

import { getLogger } from '../core/Logger';
import type {
  CachedAsset,
  CacheMetadata,
  CinematicAssetDef,
  GeminiGeneratorOptions,
  ImageGenerationResult,
  PortraitAssetDef,
  ProgressCallback,
  QuestImageDef,
  TextContentDef,
  TextGenerationResult,
  VideoGenerationResult,
} from './types';

const log = getLogger('GeminiAssetGenerator');

// ============================================================================
// CONSTANTS
// ============================================================================

/** IndexedDB database name for caching generated assets */
const CACHE_DB_NAME = 'stellar_descent_ai_cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'generated_assets';
const CACHE_METADATA_KEY = 'cache_metadata';

/** Model identifiers - Updated January 2026 */
const MODELS = {
  // Text generation - Gemini 3 Pro for best quality
  text: 'gemini-3-pro-preview',
  // Image generation - Gemini 2.5 Flash Image for speed
  image: 'gemini-2.5-flash-image',
  // High quality images - Gemini 3 Pro Image
  imageHighQuality: 'gemini-3-pro-image-preview',
  // Video generation - Veo 3.1 Fast for quick iterations
  videoFast: 'veo-3.1-fast-generate-preview',
  // Video generation - Veo 3.1 for final quality (720p/1080p/4K, native audio)
  video: 'veo-3.1-generate-preview',
} as const;

/** Default rate limit delay between API calls (ms) */
const DEFAULT_RATE_LIMIT_DELAY = 2000;

/** Video generation polling interval (ms) */
const VIDEO_POLL_INTERVAL = 10000;

/** Maximum video generation wait time (ms) - 10 minutes */
const VIDEO_MAX_WAIT_TIME = 600000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a hash for a prompt string (for cache invalidation)
 */
function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Delay utility for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

// ============================================================================
// INDEXEDDB CACHE OPERATIONS
// ============================================================================

/**
 * Open the IndexedDB cache database
 */
function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onerror = () => {
      log.error('Failed to open cache database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME);
        log.info('Created AI asset cache store');
      }
    };
  });
}

/**
 * Get cached asset from IndexedDB
 */
async function getCachedAsset(assetId: string): Promise<CachedAsset | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.get(assetId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as CachedAsset | null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    log.warn('Failed to get cached asset:', error);
    return null;
  }
}

/**
 * Save asset to IndexedDB cache
 */
async function cacheAsset(asset: CachedAsset): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      store.put(asset, asset.id);

      transaction.oncomplete = () => {
        db.close();
        log.debug(`Cached asset: ${asset.id}`);
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.warn('Failed to cache asset:', error);
  }
}

/**
 * Get cache metadata
 */
async function getCacheMetadata(): Promise<CacheMetadata | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.get(CACHE_METADATA_KEY);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as CacheMetadata | null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    log.warn('Failed to get cache metadata:', error);
    return null;
  }
}

/**
 * Update cache metadata
 */
async function _updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      store.put(metadata, CACHE_METADATA_KEY);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.warn('Failed to update cache metadata:', error);
  }
}

/**
 * Clear all cached assets
 */
async function clearCache(): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      store.clear();

      transaction.oncomplete = () => {
        db.close();
        log.info('Cache cleared');
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.error('Failed to clear cache:', error);
  }
}

// ============================================================================
// GEMINI ASSET GENERATOR CLASS
// ============================================================================

/**
 * Main class for generating assets using Google Gemini AI
 */
export class GeminiAssetGenerator {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private options: Required<GeminiGeneratorOptions>;
  private isInitialized = false;

  constructor(options: GeminiGeneratorOptions = {}) {
    this.options = {
      apiKey: options.apiKey ?? '',
      maxConcurrentVideos: options.maxConcurrentVideos ?? 1,
      maxConcurrentImages: options.maxConcurrentImages ?? 3,
      rateLimitDelayMs: options.rateLimitDelayMs ?? DEFAULT_RATE_LIMIT_DELAY,
      useFastVideoModel: options.useFastVideoModel ?? true,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Initialize the generator with API key
   */
  async initialize(): Promise<boolean> {
    // Try to get API key from options, then environment
    this.apiKey = this.options.apiKey || this.getApiKeyFromEnv();

    if (!this.apiKey) {
      log.warn('Gemini API key not configured. Asset generation disabled.');
      log.info('Set GEMINI_API_KEY environment variable to enable AI features.');
      return false;
    }

    try {
      // Initialize the GoogleGenAI client
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
      this.isInitialized = true;
      log.info('Gemini AI initialized successfully');
      return true;
    } catch (error) {
      log.error('Failed to initialize Gemini AI:', error);
      return false;
    }
  }

  /**
   * Get API key from environment
   * Checks GEMINI_API_KEY first (standard), then VITE_GEMINI_API_KEY for backwards compat
   */
  private getApiKeyFromEnv(): string | null {
    // Node.js environment - check GEMINI_API_KEY first
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    // Vite environment - check GEMINI_API_KEY (exposed via define)
    if (typeof import.meta !== 'undefined' && import.meta.env?.GEMINI_API_KEY) {
      return import.meta.env.GEMINI_API_KEY;
    }
    // Backwards compatibility: VITE_GEMINI_API_KEY
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
    return null;
  }

  /**
   * Check if the generator is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.ai !== null;
  }

  // ==========================================================================
  // VIDEO GENERATION (Veo)
  // ==========================================================================

  /**
   * Generate a cinematic video using Veo
   */
  async generateVideo(def: CinematicAssetDef): Promise<VideoGenerationResult> {
    const startTime = performance.now();

    // Check cache first
    const promptHash = hashPrompt(def.prompt);
    const cached = await getCachedAsset(def.id);
    if (cached && cached.promptHash === promptHash) {
      log.info(`Using cached video: ${def.id}`);
      return {
        assetId: def.id,
        success: true,
        videoData: cached.data,
        mimeType: cached.mimeType,
        generationTimeMs: 0,
      };
    }

    if (!this.isReady()) {
      return {
        assetId: def.id,
        success: false,
        error: 'Gemini AI not initialized',
      };
    }

    try {
      const model = this.options.useFastVideoModel ? MODELS.videoFast : MODELS.video;
      log.info(`Generating video: ${def.id} using ${model}`);

      // Build the prompt with style context
      const fullPrompt = this.buildVideoPrompt(def);

      // Start video generation operation
      // Note: personGeneration 'dont_allow' is not supported by API as of Jan 2026
      let operation = await this.ai!.models.generateVideos({
        model,
        prompt: fullPrompt,
        config: {
          aspectRatio: def.aspectRatio,
        },
      });

      // Poll for completion
      const maxWaitTime = VIDEO_MAX_WAIT_TIME;
      const startPoll = Date.now();

      while (!operation.done) {
        if (Date.now() - startPoll > maxWaitTime) {
          throw new Error('Video generation timed out');
        }

        await delay(VIDEO_POLL_INTERVAL);
        operation = await this.ai!.operations.getVideosOperation({ operation });

        if (this.options.verbose) {
          log.debug(`Video generation in progress: ${def.id}`);
        }
      }

      // Extract video data
      if (operation.response?.generatedVideos?.length) {
        const video = operation.response.generatedVideos[0];
        const videoUri = video.video?.uri;

        if (videoUri) {
          // Fetch the video data with API key
          const videoUrl = `${videoUri}&key=${this.apiKey}`;
          const response = await fetch(videoUrl);
          const videoBlob = await response.blob();
          const videoBase64 = await this.blobToBase64(videoBlob);

          // Cache the result
          await cacheAsset({
            id: def.id,
            type: 'video',
            data: videoBase64,
            mimeType: 'video/mp4',
            manifestVersion: '1.0.0',
            cachedAt: Date.now(),
            promptHash,
          });

          return {
            assetId: def.id,
            success: true,
            videoData: videoBase64,
            mimeType: 'video/mp4',
            generationTimeMs: performance.now() - startTime,
          };
        }
      }

      throw new Error('No video generated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Video generation failed for ${def.id}:`, errorMessage);
      return {
        assetId: def.id,
        success: false,
        error: errorMessage,
        generationTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Build a complete video prompt with style context
   */
  private buildVideoPrompt(def: CinematicAssetDef): string {
    const styleContext = this.getStyleContext(def.style);
    const negativePrompt = def.negativePrompt ? `\n\nAvoid: ${def.negativePrompt}` : '';

    return `${styleContext}\n\n${def.prompt}${negativePrompt}`;
  }

  // ==========================================================================
  // IMAGE GENERATION (Imagen)
  // ==========================================================================

  /**
   * Generate an image using Imagen
   */
  async generateImage(def: PortraitAssetDef | QuestImageDef): Promise<ImageGenerationResult> {
    const startTime = performance.now();

    // Check cache first
    const promptHash = hashPrompt(def.prompt);
    const cached = await getCachedAsset(def.id);
    if (cached && cached.promptHash === promptHash) {
      log.info(`Using cached image: ${def.id}`);
      return {
        assetId: def.id,
        success: true,
        imageData: cached.data,
        mimeType: cached.mimeType,
        generationTimeMs: 0,
      };
    }

    if (!this.isReady()) {
      return {
        assetId: def.id,
        success: false,
        error: 'Gemini AI not initialized',
      };
    }

    try {
      // Use high quality model for larger resolutions
      const model =
        def.resolution === '4K' || def.resolution === '2K' ? MODELS.imageHighQuality : MODELS.image;

      log.info(`Generating image: ${def.id} using ${model}`);

      // Build the prompt with style context
      const fullPrompt = this.buildImagePrompt(def);

      // Generate image
      const response = await this.ai!.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          imageConfig: {
            aspectRatio: def.aspectRatio,
            imageSize: def.resolution,
          },
        },
      });

      // Extract image data from response
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType ?? 'image/png';

            // Cache the result
            await cacheAsset({
              id: def.id,
              type: 'image',
              data: imageData as string,
              mimeType,
              manifestVersion: '1.0.0',
              cachedAt: Date.now(),
              promptHash,
            });

            return {
              assetId: def.id,
              success: true,
              imageData: imageData as string,
              mimeType,
              generationTimeMs: performance.now() - startTime,
            };
          }
        }
      }

      throw new Error('No image generated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Image generation failed for ${def.id}:`, errorMessage);
      return {
        assetId: def.id,
        success: false,
        error: errorMessage,
        generationTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Build a complete image prompt with style context
   */
  private buildImagePrompt(def: PortraitAssetDef | QuestImageDef): string {
    const styleContext = this.getStyleContext(def.style);
    return `${styleContext}\n\n${def.prompt}`;
  }

  // ==========================================================================
  // TEXT GENERATION
  // ==========================================================================

  /**
   * Generate text content using Gemini
   */
  async generateText(def: TextContentDef): Promise<TextGenerationResult> {
    const startTime = performance.now();

    // Check cache first
    const promptHash = hashPrompt(def.prompt);
    const cached = await getCachedAsset(def.id);
    if (cached && cached.promptHash === promptHash) {
      log.info(`Using cached text: ${def.id}`);
      return {
        contentId: def.id,
        success: true,
        text: cached.data,
        generationTimeMs: 0,
      };
    }

    if (!this.isReady()) {
      return {
        contentId: def.id,
        success: false,
        error: 'Gemini AI not initialized',
      };
    }

    try {
      log.info(`Generating text: ${def.id}`);

      const response = await this.ai!.models.generateContent({
        model: MODELS.text,
        contents: def.prompt,
        config: {
          systemInstruction: def.systemInstruction,
          maxOutputTokens: def.maxTokens,
        },
      });

      const text = response.text;

      if (text) {
        // Cache the result
        await cacheAsset({
          id: def.id,
          type: 'text',
          data: text,
          manifestVersion: '1.0.0',
          cachedAt: Date.now(),
          promptHash,
        });

        return {
          contentId: def.id,
          success: true,
          text,
          generationTimeMs: performance.now() - startTime,
        };
      }

      throw new Error('No text generated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Text generation failed for ${def.id}:`, errorMessage);
      return {
        contentId: def.id,
        success: false,
        error: errorMessage,
        generationTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Generate dialogue variations using structured output
   */
  async generateDialogueVariations(
    def: TextContentDef
  ): Promise<{ variations: string[]; success: boolean; error?: string }> {
    const result = await this.generateText(def);

    if (!result.success || !result.text) {
      return { variations: [], success: false, error: result.error };
    }

    try {
      // Try to parse as JSON array
      const variations = JSON.parse(result.text);
      if (Array.isArray(variations)) {
        return { variations, success: true };
      }
    } catch {
      // If not valid JSON, split by newlines
      const variations = result.text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return { variations, success: true };
    }

    return { variations: [result.text], success: true };
  }

  // ==========================================================================
  // BATCH GENERATION
  // ==========================================================================

  /**
   * Generate all assets from a manifest with progress tracking
   */
  async generateAllAssets(
    cinematics: CinematicAssetDef[],
    portraits: PortraitAssetDef[],
    questImages: QuestImageDef[],
    textContent: TextContentDef[],
    onProgress?: ProgressCallback
  ): Promise<{
    videos: VideoGenerationResult[];
    images: ImageGenerationResult[];
    texts: TextGenerationResult[];
  }> {
    const results = {
      videos: [] as VideoGenerationResult[],
      images: [] as ImageGenerationResult[],
      texts: [] as TextGenerationResult[],
    };

    const total = cinematics.length + portraits.length + questImages.length + textContent.length;
    let completed = 0;

    const updateProgress = (assetId: string, type: 'video' | 'image' | 'text') => {
      completed++;
      if (onProgress) {
        onProgress({
          total,
          completed,
          currentAsset: assetId,
          currentType: type,
          estimatedTimeRemainingMs: (total - completed) * this.options.rateLimitDelayMs * 2,
        });
      }
    };

    // Generate videos (sequentially due to cost/limits)
    for (const def of cinematics) {
      const result = await this.generateVideo(def);
      results.videos.push(result);
      updateProgress(def.id, 'video');
      await delay(this.options.rateLimitDelayMs);
    }

    // Generate images (can batch more aggressively)
    for (const def of portraits) {
      const result = await this.generateImage(def);
      results.images.push(result);
      updateProgress(def.id, 'image');
      await delay(this.options.rateLimitDelayMs);
    }

    for (const def of questImages) {
      const result = await this.generateImage(def);
      results.images.push(result);
      updateProgress(def.id, 'image');
      await delay(this.options.rateLimitDelayMs);
    }

    // Generate text (fastest)
    for (const def of textContent) {
      const result = await this.generateText(def);
      results.texts.push(result);
      updateProgress(def.id, 'text');
      await delay(this.options.rateLimitDelayMs / 2);
    }

    return results;
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Check if an asset is cached and valid
   */
  async isCached(assetId: string, promptHash?: string): Promise<boolean> {
    const cached = await getCachedAsset(assetId);
    if (!cached) return false;
    if (promptHash && cached.promptHash !== promptHash) return false;
    return true;
  }

  /**
   * Get cached asset data
   */
  async getCached(assetId: string): Promise<CachedAsset | null> {
    return getCachedAsset(assetId);
  }

  /**
   * Clear all cached assets
   */
  async clearCache(): Promise<void> {
    await clearCache();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheMetadata | null> {
    return getCacheMetadata();
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Convert a Blob to base64 string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get style context for consistent visual output
   */
  private getStyleContext(style: string): string {
    const styleContexts: Record<string, string> = {
      cinematic_scifi: `Style: High-budget Hollywood sci-fi cinematography. Anamorphic lens
        flares, dramatic lighting, 4K quality. References: Blade Runner, Alien, Interstellar.
        Cinematic color grading with deep blacks and saturated highlights.`,

      horror_scifi: `Style: Dark atmospheric horror with sci-fi elements. Low key lighting,
        heavy shadows, desaturated colors except for accent lights (red, green).
        References: Dead Space, Alien Isolation, Event Horizon. Tension and dread.`,

      military_tactical: `Style: Realistic military aesthetic. Tactical HUD elements,
        military hardware, professional soldiers. References: Call of Duty, Battlefield,
        Generation Kill. Authentic equipment, unit patches, radio chatter feel.`,

      alien_organic: `Style: H.R. Giger-inspired bio-mechanical alien aesthetic.
        Organic structures with chitinous textures, bioluminescence, sinister beauty.
        References: Aliens, Prometheus, Scorn. Disturbing but visually striking.`,

      frozen_wasteland: `Style: Harsh arctic environment. Blinding white snow, ice blue
        accents, limited visibility. References: The Thing, Frostpunk, The Day After Tomorrow.
        Beauty in desolation, survival against nature.`,

      industrial_decay: `Style: Abandoned industrial facility. Rust, debris, flickering
        lights, broken machinery. References: Half-Life, STALKER, Chernobyl documentaries.
        Environmental storytelling through decay.`,

      space_station: `Style: Clean sci-fi space station interior when intact, or damaged
        with exposed wiring and emergency lighting. References: 2001, The Expanse, Dead Space.
        Utilitarian military design with some comfort.`,

      portrait_realistic: `Style: Photorealistic character portrait. Professional lighting
        with key light and fill. Shallow depth of field. References: Mass Effect portraits,
        military ID photos. Clean background, focus on character expression.`,
    };

    return styleContexts[style] ?? '';
  }

  /**
   * Dispose the generator and clean up resources
   */
  dispose(): void {
    this.ai = null;
    this.isInitialized = false;
    log.info('GeminiAssetGenerator disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global singleton instance */
let generatorInstance: GeminiAssetGenerator | null = null;

/**
 * Get or create the global GeminiAssetGenerator instance
 */
export function getGeminiGenerator(options?: GeminiGeneratorOptions): GeminiAssetGenerator {
  if (!generatorInstance) {
    generatorInstance = new GeminiAssetGenerator(options);
  }
  return generatorInstance;
}

/**
 * Initialize the global generator with API key from environment
 */
export async function initializeGeminiGenerator(
  options?: GeminiGeneratorOptions
): Promise<boolean> {
  const generator = getGeminiGenerator(options);
  return generator.initialize();
}

export default GeminiAssetGenerator;
