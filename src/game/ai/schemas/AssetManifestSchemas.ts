/**
 * Zod Schemas for GenAI Asset Management
 *
 * Defines type-safe schemas for all generated assets, manifests,
 * and structured output formats for Gemini manifest updates.
 */

import { z } from 'zod';

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export const AssetTypeEnum = z.enum([
  'video',
  'image',
  'audio',
  'text',
]);

export const VideoStyleEnum = z.enum([
  'cinematic_scifi',
  'horror_scifi',
  'military_tactical',
  'alien_organic',
  'frozen_wasteland',
  'industrial_decay',
  'space_station',
]);

export const ImageStyleEnum = z.enum([
  'portrait_realistic',
  'portrait_stylized',
  'environment_concept',
  'ui_element',
  'quest_illustration',
]);

export const AspectRatioEnum = z.enum([
  '16:9',
  '21:9',
  '9:16',
  '1:1',
  '4:3',
]);

export const ImageResolutionEnum = z.enum([
  'SD',    // 512px
  'HD',    // 1024px
  '2K',    // 2048px
  '4K',    // 4096px
]);

export const LevelIdEnum = z.enum([
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'mining_depths',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
]);

export const CharacterIdEnum = z.enum([
  'cole_james',
  'cole_marcus',
  'vasquez_elena',
  'reyes_commander',
  'marine_generic',
]);

// ============================================================================
// BASE ASSET METADATA
// ============================================================================

/**
 * Base metadata present on all generated assets
 */
export const GeneratedAssetMetadataSchema = z.object({
  /** Unique asset identifier */
  id: z.string(),
  /** Asset type */
  type: AssetTypeEnum,
  /** Relative path from public/ */
  path: z.string(),
  /** Model used for generation */
  model: z.string(),
  /** Hash of the prompt used */
  promptHash: z.string(),
  /** Full prompt text (for regeneration) */
  prompt: z.string(),
  /** ISO timestamp of generation */
  generatedAt: z.string().datetime(),
  /** Generation time in milliseconds */
  generationTimeMs: z.number(),
  /** File size in bytes */
  fileSizeBytes: z.number(),
  /** Associated level (if any) */
  levelId: LevelIdEnum.optional(),
  /** Tags for searchability */
  tags: z.array(z.string()).default([]),
});

export type GeneratedAssetMetadata = z.infer<typeof GeneratedAssetMetadataSchema>;

// ============================================================================
// VIDEO ASSET METADATA
// ============================================================================

export const VideoAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('video'),
  /** Video duration in seconds */
  durationSeconds: z.number(),
  /** Video resolution */
  resolution: z.enum(['720p', '1080p', '4K']),
  /** Aspect ratio */
  aspectRatio: AspectRatioEnum,
  /** Whether video has native audio */
  hasAudio: z.boolean(),
  /** Visual style category */
  style: VideoStyleEnum,
});

export type VideoAssetMetadata = z.infer<typeof VideoAssetMetadataSchema>;

// ============================================================================
// IMAGE ASSET METADATA
// ============================================================================

export const ImageAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('image'),
  /** Image width in pixels */
  width: z.number(),
  /** Image height in pixels */
  height: z.number(),
  /** Image format */
  format: z.enum(['png', 'jpg', 'webp']),
  /** Aspect ratio */
  aspectRatio: AspectRatioEnum,
  /** Visual style */
  style: ImageStyleEnum,
  /** Character ID for portraits */
  characterId: CharacterIdEnum.optional(),
  /** Character emotion for portraits */
  emotion: z.string().optional(),
});

export type ImageAssetMetadata = z.infer<typeof ImageAssetMetadataSchema>;

// ============================================================================
// AUDIO ASSET METADATA
// ============================================================================

export const AudioAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('audio'),
  /** Audio duration in seconds */
  durationSeconds: z.number(),
  /** Sample rate */
  sampleRate: z.number(),
  /** Audio format */
  format: z.enum(['mp3', 'wav', 'ogg']),
  /** Freesound ID if sourced from there */
  freesoundId: z.number().optional(),
  /** License type */
  license: z.enum(['cc0', 'cc-by', 'cc-by-nc', 'generated']),
  /** Attribution text if required */
  attribution: z.string().optional(),
  /** Audio category */
  category: z.enum(['sfx', 'music', 'ambience', 'voice']),
});

export type AudioAssetMetadata = z.infer<typeof AudioAssetMetadataSchema>;

// ============================================================================
// TEXT ASSET METADATA
// ============================================================================

export const TextAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('text'),
  /** Character count */
  charCount: z.number(),
  /** Estimated token count */
  tokenCount: z.number(),
  /** Text category */
  category: z.enum(['dialogue', 'lore', 'ui', 'briefing', 'achievement']),
  /** Language code */
  language: z.string().default('en'),
});

export type TextAssetMetadata = z.infer<typeof TextAssetMetadataSchema>;

// ============================================================================
// ASSET DESTINATION MAPPING
// ============================================================================

/**
 * Defines where each asset type should be stored
 */
export const AssetDestinationSchema = z.object({
  /** Base directory under public/assets/ */
  baseDir: z.string(),
  /** Subdirectory pattern (can include {levelId}, {characterId}, etc.) */
  subDirPattern: z.string(),
  /** Filename pattern */
  filenamePattern: z.string(),
});

export const ASSET_DESTINATIONS = {
  cinematic_intro: {
    baseDir: 'videos/cinematics',
    subDirPattern: '{levelId}',
    filenamePattern: 'intro.mp4',
  },
  cinematic_outro: {
    baseDir: 'videos/cinematics',
    subDirPattern: '{levelId}',
    filenamePattern: 'outro.mp4',
  },
  splash_video: {
    baseDir: 'videos/splash',
    subDirPattern: '',
    filenamePattern: '{id}.mp4',
  },
  portrait: {
    baseDir: 'images/portraits',
    subDirPattern: '{characterId}',
    filenamePattern: '{emotion}.png',
  },
  quest_image: {
    baseDir: 'images/quest',
    subDirPattern: '{category}',
    filenamePattern: '{id}.png',
  },
  ui_image: {
    baseDir: 'images/ui',
    subDirPattern: '{category}',
    filenamePattern: '{id}.png',
  },
  sfx: {
    baseDir: 'audio/sfx',
    subDirPattern: '{category}',
    filenamePattern: '{id}.mp3',
  },
  music: {
    baseDir: 'audio/music',
    subDirPattern: '{category}',
    filenamePattern: '{id}.mp3',
  },
  ambience: {
    baseDir: 'audio/ambience',
    subDirPattern: '{environment}',
    filenamePattern: '{id}.mp3',
  },
} as const;

export type AssetDestinationType = keyof typeof ASSET_DESTINATIONS;

// ============================================================================
// LEVEL ASSET MANIFEST
// ============================================================================

/**
 * Manifest of all assets associated with a specific level
 */
export const LevelAssetManifestSchema = z.object({
  /** Level identifier */
  levelId: LevelIdEnum,
  /** Schema version for migrations */
  schemaVersion: z.string(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Intro cinematic */
  introCinematic: VideoAssetMetadataSchema.optional(),
  /** Outro cinematic (if any) */
  outroCinematic: VideoAssetMetadataSchema.optional(),
  /** Loading screen images */
  loadingScreens: z.array(ImageAssetMetadataSchema).default([]),
  /** Briefing images */
  briefingImages: z.array(ImageAssetMetadataSchema).default([]),
  /** Level-specific audio */
  audio: z.array(AudioAssetMetadataSchema).default([]),
  /** Level-specific text content */
  textContent: z.array(TextAssetMetadataSchema).default([]),
});

export type LevelAssetManifest = z.infer<typeof LevelAssetManifestSchema>;

// ============================================================================
// SHARED ASSET MANIFEST
// ============================================================================

/**
 * Manifest of shared assets used across multiple levels
 */
export const SharedAssetManifestSchema = z.object({
  /** Schema version */
  schemaVersion: z.string(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Character portraits - keyed by character ID (flexible string keys) */
  portraits: z.record(z.string(), z.array(ImageAssetMetadataSchema)).default({}),
  /** UI elements */
  uiAssets: z.array(ImageAssetMetadataSchema).default([]),
  /** Splash videos */
  splashVideos: z.array(VideoAssetMetadataSchema).default([]),
  /** Shared audio (UI sounds, common SFX) */
  sharedAudio: z.array(AudioAssetMetadataSchema).default([]),
  /** Shared text (achievements, common UI) */
  sharedText: z.array(TextAssetMetadataSchema).default([]),
});

export type SharedAssetManifest = z.infer<typeof SharedAssetManifestSchema>;

// ============================================================================
// COMPLETE GAME MANIFEST
// ============================================================================

/**
 * Complete manifest of all generated assets in the game
 */
export const CompleteAssetManifestSchema = z.object({
  /** Schema version */
  schemaVersion: z.string(),
  /** Game version this manifest was generated for */
  gameVersion: z.string(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Per-level manifests */
  levels: z.record(LevelIdEnum, LevelAssetManifestSchema),
  /** Shared assets */
  shared: SharedAssetManifestSchema,
  /** Generation statistics */
  stats: z.object({
    totalVideos: z.number(),
    totalImages: z.number(),
    totalAudio: z.number(),
    totalText: z.number(),
    totalSizeBytes: z.number(),
    totalGenerationTimeMs: z.number(),
  }),
});

export type CompleteAssetManifest = z.infer<typeof CompleteAssetManifestSchema>;

// ============================================================================
// MANIFEST UPDATE REQUEST/RESPONSE (for Gemini structured output)
// ============================================================================

/**
 * Request format for Gemini to analyze and update manifests
 */
export const ManifestUpdateRequestSchema = z.object({
  /** Action to perform */
  action: z.enum(['add', 'update', 'remove', 'analyze']),
  /** Asset being added/updated */
  asset: z.union([
    VideoAssetMetadataSchema,
    ImageAssetMetadataSchema,
    AudioAssetMetadataSchema,
    TextAssetMetadataSchema,
  ]).optional(),
  /** Target manifest type */
  targetManifest: z.enum(['level', 'shared']),
  /** Level ID if targeting level manifest */
  levelId: LevelIdEnum.optional(),
});

export type ManifestUpdateRequest = z.infer<typeof ManifestUpdateRequestSchema>;

/**
 * Response format from Gemini manifest analysis
 */
export const ManifestUpdateResponseSchema = z.object({
  /** Whether the update is valid */
  valid: z.boolean(),
  /** Validation errors if any */
  errors: z.array(z.string()).default([]),
  /** Warnings (non-blocking issues) */
  warnings: z.array(z.string()).default([]),
  /** Suggested improvements to the asset */
  suggestions: z.array(z.object({
    field: z.string(),
    current: z.string(),
    suggested: z.string(),
    reason: z.string(),
  })).default([]),
  /** Updated manifest (if action was add/update) */
  updatedManifest: z.any().optional(),
});

export type ManifestUpdateResponse = z.infer<typeof ManifestUpdateResponseSchema>;

// ============================================================================
// JSON SCHEMA EXPORT (for Gemini structured output)
// ============================================================================

/**
 * Generate JSON Schema from Zod schema for use with Gemini
 */
export function zodToJsonSchema(schema: z.ZodType): object {
  // This is a simplified conversion - for production use zodToJsonSchema package
  return {
    type: 'object',
    description: 'Asset manifest update response',
    properties: {
      valid: { type: 'boolean' },
      errors: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            current: { type: 'string' },
            suggested: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    required: ['valid'],
  };
}
