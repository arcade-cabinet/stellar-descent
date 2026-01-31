/**
 * Gemini AI Asset Generation Types
 *
 * Type definitions for the AI-powered asset generation system using Google Gemini.
 * Supports video generation via Veo 3.1, image generation via Imagen, and text
 * generation for dynamic dialogue/content.
 */

import type { LevelId } from '../levels/types';

// ============================================================================
// ASSET MANIFEST TYPES
// ============================================================================

/**
 * Aspect ratio options for generated media
 */
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

/**
 * Image resolution options (for Imagen)
 */
export type ImageResolution = '1K' | '2K' | '4K';

/**
 * Visual style presets for consistent game aesthetics
 */
export type VisualStyle =
  | 'cinematic_scifi'      // Epic sci-fi cinematics
  | 'horror_scifi'         // Dark, atmospheric horror sci-fi
  | 'military_tactical'    // Military/tactical shooter style
  | 'alien_organic'        // Organic alien environments
  | 'frozen_wasteland'     // Ice/snow environments
  | 'industrial_decay'     // Abandoned industrial facilities
  | 'space_station'        // Clean/damaged space station interiors
  | 'portrait_realistic';  // Character portraits

/**
 * Definition for a cinematic video asset
 */
export interface CinematicAssetDef {
  /** Unique identifier for this asset */
  id: string;
  /** Asset type - video for cinematics */
  type: 'video';
  /** Text prompt describing the video content */
  prompt: string;
  /** Duration in seconds (5-60 for Veo) */
  duration: number;
  /** Visual style preset */
  style: VisualStyle;
  /** Aspect ratio for the video */
  aspectRatio: '16:9' | '21:9';
  /** Level this cinematic belongs to */
  level: LevelId;
  /** Optional negative prompt (what to avoid) */
  negativePrompt?: string;
  /** Whether to allow person generation (default: false for game assets) */
  personGeneration?: boolean;
  /** Priority for generation order (higher = first) */
  priority?: number;
}

/**
 * Definition for a character portrait image
 */
export interface PortraitAssetDef {
  /** Unique identifier for this asset */
  id: string;
  /** Asset type - image for portraits */
  type: 'image';
  /** Text prompt describing the portrait */
  prompt: string;
  /** Visual style preset */
  style: VisualStyle;
  /** Aspect ratio (typically 1:1 or 3:4 for portraits) */
  aspectRatio: AspectRatio;
  /** Image resolution */
  resolution: ImageResolution;
  /** Character name this portrait represents */
  characterId: string;
  /** Emotional state variant (e.g., 'neutral', 'angry', 'worried') */
  emotion?: string;
}

/**
 * Definition for a quest/mission objective image
 */
export interface QuestImageDef {
  /** Unique identifier for this asset */
  id: string;
  /** Asset type - image */
  type: 'image';
  /** Text prompt describing the image */
  prompt: string;
  /** Visual style preset */
  style: VisualStyle;
  /** Aspect ratio */
  aspectRatio: AspectRatio;
  /** Image resolution */
  resolution: ImageResolution;
  /** Level this image is associated with */
  level: LevelId;
  /** Purpose of this image */
  purpose: 'objective' | 'loading_screen' | 'achievement' | 'briefing';
}

/**
 * Definition for dynamic text content generation
 */
export interface TextContentDef {
  /** Unique identifier for this content */
  id: string;
  /** Content type */
  type: 'text';
  /** Generation prompt */
  prompt: string;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Content category */
  category: 'dialogue' | 'audio_log' | 'briefing' | 'lore';
  /** Level context */
  level?: LevelId;
  /** Character speaking (for dialogue) */
  characterId?: string;
  /** System instruction for tone/style */
  systemInstruction?: string;
}

/**
 * Complete asset manifest for the game
 */
export interface AssetManifest {
  /** Version for cache invalidation */
  version: string;
  /** Generated timestamp */
  generatedAt: number;
  /** Cinematic video definitions */
  cinematics: CinematicAssetDef[];
  /** Character portrait definitions */
  dialoguePortraits: PortraitAssetDef[];
  /** Quest/mission images */
  questImages: QuestImageDef[];
  /** Dynamic text content definitions */
  textContent: TextContentDef[];
}

// ============================================================================
// GENERATION RESULT TYPES
// ============================================================================

/**
 * Result of a video generation operation
 */
export interface VideoGenerationResult {
  /** Asset ID this result corresponds to */
  assetId: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Video data as base64 or blob URL */
  videoData?: string;
  /** MIME type of the video */
  mimeType?: string;
  /** Error message if generation failed */
  error?: string;
  /** Generation duration in ms */
  generationTimeMs?: number;
}

/**
 * Result of an image generation operation
 */
export interface ImageGenerationResult {
  /** Asset ID this result corresponds to */
  assetId: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Image data as base64 */
  imageData?: string;
  /** MIME type of the image */
  mimeType?: string;
  /** Error message if generation failed */
  error?: string;
  /** Generation duration in ms */
  generationTimeMs?: number;
}

/**
 * Result of a text generation operation
 */
export interface TextGenerationResult {
  /** Content ID this result corresponds to */
  contentId: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Generated text content */
  text?: string;
  /** Error message if generation failed */
  error?: string;
  /** Generation duration in ms */
  generationTimeMs?: number;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Cached asset entry stored in IndexedDB
 */
export interface CachedAsset {
  /** Asset ID */
  id: string;
  /** Asset type */
  type: 'video' | 'image' | 'text';
  /** Data (base64 for media, string for text) */
  data: string;
  /** MIME type for media assets */
  mimeType?: string;
  /** Manifest version this was generated from */
  manifestVersion: string;
  /** When this was cached */
  cachedAt: number;
  /** Hash of the prompt (for invalidation) */
  promptHash: string;
}

/**
 * Cache metadata for quick lookups
 */
export interface CacheMetadata {
  /** Manifest version currently cached */
  manifestVersion: string;
  /** Last cache update timestamp */
  lastUpdated: number;
  /** Map of asset ID to prompt hash for validation */
  assetHashes: Record<string, string>;
  /** Total cached size in bytes (estimated) */
  totalSizeBytes: number;
}

// ============================================================================
// GENERATOR OPTIONS
// ============================================================================

/**
 * Options for the Gemini asset generator
 */
export interface GeminiGeneratorOptions {
  /** API key for Gemini (reads from VITE_GEMINI_API_KEY if not provided) */
  apiKey?: string;
  /** Maximum concurrent video generations */
  maxConcurrentVideos?: number;
  /** Maximum concurrent image generations */
  maxConcurrentImages?: number;
  /** Rate limit delay between requests in ms */
  rateLimitDelayMs?: number;
  /** Whether to use fast video model (veo-3.0-fast-generate-001) */
  useFastVideoModel?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Progress callback for batch generation
 */
export interface GenerationProgress {
  /** Total assets to generate */
  total: number;
  /** Assets completed */
  completed: number;
  /** Currently generating asset ID */
  currentAsset: string;
  /** Current asset type */
  currentType: 'video' | 'image' | 'text';
  /** Estimated time remaining in ms */
  estimatedTimeRemainingMs?: number;
}

/**
 * Callback signature for progress updates
 */
export type ProgressCallback = (progress: GenerationProgress) => void;

// ============================================================================
// CINEMATIC LOADER TYPES
// ============================================================================

/**
 * Loaded cinematic asset ready for playback
 */
export interface LoadedCinematic {
  /** Asset ID */
  id: string;
  /** Level this cinematic belongs to */
  level: LevelId;
  /** Video element for playback */
  videoElement?: HTMLVideoElement;
  /** Fallback static image if video unavailable */
  fallbackImage?: HTMLImageElement;
  /** Whether this is using a fallback placeholder */
  isPlaceholder: boolean;
  /** Duration in seconds */
  duration: number;
}

/**
 * Loaded portrait asset
 */
export interface LoadedPortrait {
  /** Asset ID */
  id: string;
  /** Character this portrait represents */
  characterId: string;
  /** Emotion variant */
  emotion: string;
  /** Image element */
  imageElement: HTMLImageElement;
  /** Whether this is a placeholder */
  isPlaceholder: boolean;
}

/**
 * Status of cinematic asset loading
 */
export interface CinematicLoadStatus {
  /** Level being loaded */
  level: LevelId;
  /** Whether all cinematics are loaded */
  ready: boolean;
  /** Loading progress (0-1) */
  progress: number;
  /** Assets that failed to load */
  failed: string[];
  /** Assets using fallback placeholders */
  placeholders: string[];
}

// ============================================================================
// FREESOUND AUDIO TYPES
// ============================================================================

/**
 * License types supported by Freesound
 */
export type FreesoundLicense = 'cc0' | 'cc-by' | 'cc-by-nc' | 'cc-by-sa' | 'other';

/**
 * Audio asset type categories
 */
export type AudioAssetType = 'sfx' | 'ambience' | 'music' | 'voice';

/**
 * Sound preview URLs from Freesound API
 */
export interface FreesoundSoundPreview {
  'preview-hq-mp3'?: string;
  'preview-hq-ogg'?: string;
  'preview-lq-mp3'?: string;
  'preview-lq-ogg'?: string;
}

/**
 * Sound information from Freesound API
 */
export interface FreesoundSound {
  /** Unique sound ID */
  id: number;
  /** Sound name/title */
  name: string;
  /** Description of the sound */
  description?: string;
  /** Tags associated with the sound */
  tags: string[];
  /** License type */
  license: FreesoundLicense | string;
  /** Duration in seconds */
  duration: number;
  /** Number of audio channels */
  channels?: number;
  /** Sample rate in Hz */
  samplerate?: number;
  /** Bit depth */
  bitdepth?: number;
  /** File size in bytes */
  filesize?: number;
  /** Download URL (requires authentication) */
  download?: string;
  /** Preview URLs */
  previews?: FreesoundSoundPreview;
  /** Username of uploader */
  username: string;
  /** URL to sound page on Freesound */
  url: string;
  /** Average rating */
  avg_rating?: number;
  /** Number of downloads */
  num_downloads?: number;
  /** Creation date */
  created?: string;
  /** File type/extension */
  type?: string;
}

/**
 * Search result from Freesound API
 */
export interface FreesoundSearchResult {
  /** Total count of matching sounds */
  count: number;
  /** URL to next page of results */
  next: string | null;
  /** URL to previous page of results */
  previous: string | null;
  /** Array of matching sounds */
  results: FreesoundSound[];
}

/**
 * Search options for Freesound API
 */
export interface FreesoundSearchOptions {
  /** Raw filter string (Freesound query syntax) */
  filter?: string;
  /** Sort order */
  sort?: 'score' | 'duration_desc' | 'duration_asc' | 'downloads_desc' | 'rating_desc' | 'created_desc';
  /** Fields to return */
  fields?: string[];
  /** Results per page */
  pageSize?: number;
  /** Minimum duration in seconds */
  minDuration?: number;
  /** Maximum duration in seconds */
  maxDuration?: number;
  /** Tags to filter by */
  tags?: string[];
  /** License type to filter by */
  license?: FreesoundLicense;
}

/**
 * Audio processing options
 */
export interface AudioProcessingOptions {
  /** Normalize volume to peak level */
  normalize?: boolean;
  /** Fade in duration in seconds */
  fadeIn?: number;
  /** Fade out duration in seconds */
  fadeOut?: number;
  /** Pitch shift in semitones (positive = higher, negative = lower) */
  pitchShift?: number;
  /** Apply reverb effect */
  reverb?: boolean;
  /** Trim audio */
  trim?: {
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
  };
}

/**
 * Definition for an audio asset to download from Freesound
 */
export interface AudioAssetDef {
  /** Unique identifier for this asset */
  id: string;
  /** Asset type category */
  type: AudioAssetType;
  /** Search query for Freesound */
  searchQuery: string;
  /** Filter options for search */
  filters?: {
    /** Maximum duration in seconds */
    maxDuration?: number;
    /** Minimum duration in seconds */
    minDuration?: number;
    /** Tags to filter by */
    tags?: string[];
    /** License type (cc0 recommended for commercial use) */
    license?: FreesoundLicense;
  };
  /** Audio processing to apply after download */
  processing?: AudioProcessingOptions;
  /** ID of procedural sound to use if download fails */
  fallbackProcedural?: string;
}

/**
 * Complete audio asset manifest
 */
export interface AudioAssetManifest {
  /** Version for cache invalidation */
  version: string;
  /** Generated timestamp */
  generatedAt: number;
  /** Weapon sound effects */
  weapons: AudioAssetDef[];
  /** Enemy sound effects */
  enemies: AudioAssetDef[];
  /** Ambient sounds */
  ambience: AudioAssetDef[];
  /** UI sounds */
  ui: AudioAssetDef[];
  /** Player sounds */
  player: AudioAssetDef[];
  /** Vehicle sounds */
  vehicles: AudioAssetDef[];
  /** Music stingers */
  music: AudioAssetDef[];
  /** Collectible sounds */
  collectibles: AudioAssetDef[];
  /** Environment sounds */
  environment: AudioAssetDef[];
}

/**
 * Result of downloading an audio asset
 */
export interface FreesoundDownloadResult {
  /** Asset ID this result corresponds to */
  assetId: string;
  /** Freesound sound ID */
  freesoundId: number;
  /** Whether download succeeded */
  success: boolean;
  /** Audio data as base64 */
  audioData?: string;
  /** MIME type of the audio */
  mimeType?: string;
  /** Duration in seconds */
  duration?: number;
  /** Error message if download failed */
  error?: string;
  /** Download duration in ms */
  downloadTimeMs?: number;
}

/**
 * Cached audio asset stored in IndexedDB
 */
export interface CachedAudioAsset {
  /** Asset ID */
  id: string;
  /** Freesound sound ID */
  freesoundId: number;
  /** Asset type */
  type: 'audio';
  /** Audio data as base64 */
  data: string;
  /** MIME type */
  mimeType: string;
  /** Duration in seconds */
  duration: number;
  /** Manifest version this was downloaded from */
  manifestVersion: string;
  /** When this was cached */
  cachedAt: number;
}

/**
 * Options for FreesoundClient
 */
export interface FreesoundClientOptions {
  /** Rate limit delay between API calls in ms */
  rateLimitDelayMs?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Preferred audio format for downloads */
  preferredFormat?: 'wav' | 'mp3' | 'ogg';
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  /** Enable caching to IndexedDB */
  cacheEnabled?: boolean;
}

/**
 * Progress callback for batch audio downloads
 */
export interface AudioDownloadProgress {
  /** Total assets to download */
  total: number;
  /** Assets completed */
  completed: number;
  /** Currently downloading asset ID */
  currentAsset: string;
  /** Estimated time remaining in ms */
  estimatedTimeRemainingMs?: number;
}

/**
 * Callback signature for audio download progress
 */
export type AudioProgressCallback = (progress: AudioDownloadProgress) => void;
