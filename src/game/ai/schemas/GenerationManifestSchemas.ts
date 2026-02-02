/**
 * Generation Manifest Schemas
 *
 * Zod schemas for asset generation manifests that live alongside generated assets.
 * These manifests define what to generate AND track generation metadata for idempotency.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Generation status for an asset
 */
export const GenerationStatusSchema = z.enum(['pending', 'generating', 'generated', 'failed']);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

/**
 * Metadata added after successful generation
 */
export const GenerationMetadataSchema = z
  .object({
    promptHash: z
      .string()
      .describe('Hash of the prompt used for generation - enables cache invalidation'),
    generatedAt: z.string().datetime().describe('ISO timestamp of generation'),
    generationTimeMs: z.number().describe('Time taken to generate in milliseconds'),
    fileSizeBytes: z.number().describe('Size of generated file'),
    model: z.string().describe('Model used for generation'),
  })
  .strict();
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

// ============================================================================
// IMAGE/PORTRAIT SCHEMAS
// ============================================================================

export const ImageResolutionSchema = z.enum(['HD', '2K', '4K']);
export const ImageAspectRatioSchema = z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']);

/**
 * Single portrait asset definition
 */
export const PortraitAssetSchema = z
  .object({
    id: z.string().describe('Unique identifier for this portrait'),
    characterId: z.string().describe('Character this portrait belongs to'),
    emotion: z.string().describe('Emotional state/expression'),
    prompt: z.string().describe('Generation prompt'),
    aspectRatio: ImageAspectRatioSchema.default('1:1'),
    resolution: ImageResolutionSchema.default('2K'),
    filename: z.string().describe('Output filename relative to manifest directory'),

    // Generation tracking
    status: GenerationStatusSchema.default('pending'),
    metadata: GenerationMetadataSchema.optional(),
    lastError: z.string().optional().describe('Last error message if failed'),
  })
  .strict();
export type PortraitAsset = z.infer<typeof PortraitAssetSchema>;

/**
 * Portrait manifest - lives in public/assets/images/portraits/manifest.json
 */
export const PortraitManifestSchema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.string().default('1.0.0'),
    description: z.string().default('Character portrait generation manifest'),
    updatedAt: z.string().datetime(),

    // Lore branding applied to all portraits
    loreBranding: z.object({
      unitPatches: z
        .record(z.string(), z.string())
        .describe('Character ID -> unit patch description'),
      rankInsignia: z
        .record(z.string(), z.string())
        .describe('Character ID -> rank insignia description'),
      styleGuide: z.string().describe('Global styling rules applied to all portraits'),
    }),

    assets: z.array(PortraitAssetSchema),
  })
  .strict();
export type PortraitManifest = z.infer<typeof PortraitManifestSchema>;

// ============================================================================
// VIDEO SCHEMAS
// ============================================================================

export const VideoResolutionSchema = z.enum(['720p', '1080p', '4k']);
export const VideoAspectRatioSchema = z.enum(['16:9', '9:16']);
export const VideoDurationSchema = z.union([z.literal(4), z.literal(6), z.literal(8)]);

/**
 * Single video asset definition
 */
export const VideoAssetSchema = z
  .object({
    id: z.string().describe('Unique identifier for this video'),
    prompt: z.string().describe('Generation prompt - include audio cues for Veo 3.1'),
    negativePrompt: z.string().optional().describe('Elements to exclude from generation'),
    aspectRatio: VideoAspectRatioSchema.default('16:9'),
    resolution: VideoResolutionSchema.default('1080p'),
    duration: VideoDurationSchema.default(8).describe('Duration in seconds (4, 6, or 8)'),
    filename: z.string().describe('Output filename relative to manifest directory'),

    // Optional context
    levelId: z.string().optional().describe('Associated level ID if level-specific'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),

    // Generation tracking
    status: GenerationStatusSchema.default('pending'),
    metadata: GenerationMetadataSchema.optional(),
    lastError: z.string().optional().describe('Last error message if failed'),
  })
  .strict();
export type VideoAsset = z.infer<typeof VideoAssetSchema>;

/**
 * Splash video manifest - lives in public/assets/videos/splash/manifest.json
 */
export const SplashManifestSchema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.string().default('1.0.0'),
    description: z.string().default('Splash/title screen video generation manifest'),
    updatedAt: z.string().datetime(),
    assets: z.array(VideoAssetSchema),
  })
  .strict();
export type SplashManifest = z.infer<typeof SplashManifestSchema>;

/**
 * Cinematic video manifest - lives in public/assets/videos/cinematics/manifest.json
 */
export const CinematicManifestSchema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.string().default('1.0.0'),
    description: z.string().default('Level cinematic video generation manifest'),
    updatedAt: z.string().datetime(),
    assets: z.array(VideoAssetSchema),
  })
  .strict();
export type CinematicManifest = z.infer<typeof CinematicManifestSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash a prompt string for cache invalidation
 */
export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash << 5) - hash + prompt.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check if an asset needs regeneration
 */
export function needsRegeneration(
  asset: PortraitAsset | VideoAsset,
  currentPrompt: string,
  fileExists: boolean
): boolean {
  // Never generated
  if (asset.status === 'pending' || !asset.metadata) {
    return true;
  }

  // File doesn't exist
  if (!fileExists) {
    return true;
  }

  // Prompt changed (hash mismatch)
  const currentHash = hashPrompt(currentPrompt);
  if (asset.metadata.promptHash !== currentHash) {
    return true;
  }

  return false;
}
