/**
 * AssetPipeline - Idempotent GenAI Asset Generation
 *
 * Manages the full pipeline for generating, organizing, and registering
 * AI-generated assets. Supports targeting specific assets by ID or index,
 * and skips already-generated assets for idempotency.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { CINEMATIC_ASSETS, PORTRAIT_ASSETS, QUEST_IMAGES } from '../AssetManifest';
import {
  type ImageAssetMetadata,
  ImageAssetMetadataSchema,
  type VideoAssetMetadata,
  VideoAssetMetadataSchema,
} from '../schemas/AssetManifestSchemas';
import type { CinematicAssetDef, PortraitAssetDef, QuestImageDef } from '../types';
import { getManifestService } from './ManifestUpdateService';

// ============================================================================
// CONSTANTS
// ============================================================================

const MODELS = {
  text: 'gemini-3-pro-preview',
  image: 'gemini-2.5-flash-image',
  imageHighQuality: 'gemini-3-pro-image-preview',
  videoFast: 'veo-3.1-fast-generate-preview',
  video: 'veo-3.1-generate-preview',
};

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');

const VIDEO_POLL_INTERVAL = 10000;
const VIDEO_MAX_WAIT = 600000;

// ============================================================================
// LORE BRANDING CONTEXT
// ============================================================================

/**
 * Lore-appropriate branding context for character portraits.
 * This ensures generated assets match the game's military aesthetic.
 */
const LORE_BRANDING = {
  unitPatches: {
    cole: '7th Drop Marines "Hell Jumpers" - skull with wings patch on shoulder',
    marcus: 'Vanguard Recon Team - crossed swords over planet patch',
    reyes: 'UEF Prometheus Command - gold star cluster insignia',
    phoenix: 'Dropship Wing - phoenix rising patch',
  },
  rankInsignia: {
    sergeant: 'Three chevrons on collar',
    corporal: 'Two chevrons on collar',
    commander: 'Four gold bars on collar, command star on chest',
    pilot: 'Wings insignia on chest',
  },
  callsigns: {
    cole: 'SPECTER - stenciled on helmet',
    marcus: 'HAMMER - painted on mech shoulder plate',
    reyes: 'ACTUAL - on command uniform nameplate',
    phoenix: 'PHOENIX - on flight helmet',
  },
  aesthetic: `
    IMPORTANT STYLING RULES:
    - NO visible name tags or text labels on uniforms
    - Unit patches should be subtle, military-authentic, non-text based imagery
    - Rank insignia are small metallic pins, not text
    - Callsigns can appear subtly stenciled on equipment but NOT prominently displayed
    - Overall aesthetic: gritty military realism, not comic book
    - Reference: Modern military photos, Mass Effect, Starship Troopers
  `,
};

/**
 * Enhance a portrait prompt with lore-appropriate branding
 */
function enhancePortraitPrompt(def: PortraitAssetDef): string {
  const charId = def.characterId as keyof typeof LORE_BRANDING.unitPatches;
  const branding: string[] = [];

  if (LORE_BRANDING.unitPatches[charId]) {
    branding.push(LORE_BRANDING.unitPatches[charId]);
  }

  // Map character to rank
  const rankMap: Record<string, keyof typeof LORE_BRANDING.rankInsignia> = {
    cole: 'sergeant',
    marcus: 'corporal',
    reyes: 'commander',
    phoenix: 'pilot',
  };

  if (rankMap[charId]) {
    branding.push(LORE_BRANDING.rankInsignia[rankMap[charId]]);
  }

  const brandingText =
    branding.length > 0
      ? `\n\nMilitary details: ${branding.join('. ')}.\n${LORE_BRANDING.aesthetic}`
      : '';

  return `${def.prompt}${brandingText}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// ASSET PIPELINE CLASS
// ============================================================================

export interface PipelineOptions {
  useFastVideo?: boolean;
  skipExisting?: boolean;
  verbose?: boolean;
}

export interface GenerationResult {
  assetId: string;
  success: boolean;
  skipped?: boolean;
  path?: string;
  error?: string;
  generationTimeMs?: number;
}

export class AssetPipeline {
  private ai: GoogleGenAI | null = null;
  private options: Required<PipelineOptions>;
  private manifestService = getManifestService();

  constructor(options: PipelineOptions = {}) {
    this.options = {
      useFastVideo: options.useFastVideo ?? true,
      skipExisting: options.skipExisting ?? true,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Initialize the pipeline
   */
  async initialize(): Promise<boolean> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set');
      return false;
    }

    this.ai = new GoogleGenAI({ apiKey });
    await this.manifestService.initialize();
    return true;
  }

  // ==========================================================================
  // ASSET TARGETING
  // ==========================================================================

  /**
   * Get a cinematic by ID or index
   */
  getCinematic(idOrIndex: string | number): CinematicAssetDef | undefined {
    if (typeof idOrIndex === 'number') {
      return CINEMATIC_ASSETS[idOrIndex];
    }
    return CINEMATIC_ASSETS.find((c) => c.id === idOrIndex);
  }

  /**
   * Get a portrait by ID or index
   */
  getPortrait(idOrIndex: string | number): PortraitAssetDef | undefined {
    if (typeof idOrIndex === 'number') {
      return PORTRAIT_ASSETS[idOrIndex];
    }
    return PORTRAIT_ASSETS.find((p) => p.id === idOrIndex);
  }

  /**
   * Get a quest image by ID or index
   */
  getQuestImage(idOrIndex: string | number): QuestImageDef | undefined {
    if (typeof idOrIndex === 'number') {
      return QUEST_IMAGES[idOrIndex];
    }
    return QUEST_IMAGES.find((q) => q.id === idOrIndex);
  }

  /**
   * Get all cinematics
   */
  getAllCinematics(): CinematicAssetDef[] {
    return CINEMATIC_ASSETS;
  }

  /**
   * Get all portraits
   */
  getAllPortraits(): PortraitAssetDef[] {
    return PORTRAIT_ASSETS;
  }

  // ==========================================================================
  // PATH RESOLUTION
  // ==========================================================================

  /**
   * Get the destination path for a cinematic
   */
  getCinematicPath(def: CinematicAssetDef): string {
    const levelDir = def.level || 'shared';
    return path.join(ASSETS_DIR, 'videos', 'cinematics', levelDir, `${def.id}.mp4`);
  }

  /**
   * Get the destination path for a portrait
   */
  getPortraitPath(def: PortraitAssetDef): string {
    return path.join(ASSETS_DIR, 'images', 'portraits', def.characterId, `${def.emotion}.png`);
  }

  /**
   * Get the destination path for a quest image
   */
  getQuestImagePath(def: QuestImageDef): string {
    const subdir = def.purpose || 'misc';
    return path.join(ASSETS_DIR, 'images', 'quest', subdir, `${def.id}.png`);
  }

  /**
   * Check if an asset already exists
   */
  assetExists(assetPath: string): boolean {
    return fs.existsSync(assetPath);
  }

  // ==========================================================================
  // GENERATION METHODS
  // ==========================================================================

  /**
   * Generate a specific cinematic by ID or index
   */
  async generateCinematic(idOrIndex: string | number): Promise<GenerationResult> {
    const def = this.getCinematic(idOrIndex);
    if (!def) {
      return { assetId: String(idOrIndex), success: false, error: 'Cinematic not found' };
    }

    const outputPath = this.getCinematicPath(def);

    // Idempotency check
    if (this.options.skipExisting && this.assetExists(outputPath)) {
      if (this.options.verbose) console.log(`Skipping existing: ${def.id}`);
      return { assetId: def.id, success: true, skipped: true, path: outputPath };
    }

    if (!this.ai) {
      return { assetId: def.id, success: false, error: 'Pipeline not initialized' };
    }

    const startTime = Date.now();
    console.log(`Generating cinematic: ${def.id}`);

    try {
      const model = this.options.useFastVideo ? MODELS.videoFast : MODELS.video;

      let operation = await this.ai.models.generateVideos({
        model,
        prompt: def.prompt,
        config: {
          aspectRatio: def.aspectRatio,
        },
      });

      // Poll for completion
      const startPoll = Date.now();
      while (!operation.done) {
        if (Date.now() - startPoll > VIDEO_MAX_WAIT) {
          throw new Error('Video generation timed out');
        }
        await delay(VIDEO_POLL_INTERVAL);
        operation = await this.ai.operations.getVideosOperation({ operation });

        if (this.options.verbose) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(`  Polling... (${elapsed}s)`);
        }
      }

      // Extract and save video
      if (operation.response?.generatedVideos?.[0]?.video?.uri) {
        const videoUri = operation.response.generatedVideos[0].video.uri;
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        const buffer = Buffer.from(await response.arrayBuffer());

        ensureDir(path.dirname(outputPath));
        fs.writeFileSync(outputPath, buffer);

        const generationTimeMs = Date.now() - startTime;

        // Register in manifest
        const metadata: VideoAssetMetadata = VideoAssetMetadataSchema.parse({
          id: def.id,
          type: 'video',
          path: path.relative(ASSETS_DIR, outputPath),
          model,
          promptHash: hashPrompt(def.prompt),
          prompt: def.prompt,
          generatedAt: new Date().toISOString(),
          generationTimeMs,
          fileSizeBytes: buffer.length,
          levelId: def.level,
          durationSeconds: def.duration,
          resolution: '720p',
          aspectRatio: def.aspectRatio,
          hasAudio: true,
          style: def.style,
          tags: ['cinematic', def.level || 'shared'],
        });

        await this.manifestService.registerVideoAsset(metadata, { isIntroCinematic: true });

        console.log(`✅ Generated: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return { assetId: def.id, success: true, path: outputPath, generationTimeMs };
      }

      throw new Error('No video data returned');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${def.id} - ${errorMsg}`);
      return { assetId: def.id, success: false, error: errorMsg };
    }
  }

  /**
   * Generate a specific portrait by ID or index
   */
  async generatePortrait(idOrIndex: string | number): Promise<GenerationResult> {
    const def = this.getPortrait(idOrIndex);
    if (!def) {
      return { assetId: String(idOrIndex), success: false, error: 'Portrait not found' };
    }

    const outputPath = this.getPortraitPath(def);

    // Idempotency check
    if (this.options.skipExisting && this.assetExists(outputPath)) {
      if (this.options.verbose) console.log(`Skipping existing: ${def.id}`);
      return { assetId: def.id, success: true, skipped: true, path: outputPath };
    }

    if (!this.ai) {
      return { assetId: def.id, success: false, error: 'Pipeline not initialized' };
    }

    const startTime = Date.now();
    console.log(`Generating portrait: ${def.id}`);

    try {
      // Enhance prompt with lore branding
      const enhancedPrompt = enhancePortraitPrompt(def);

      const model =
        def.resolution === '4K' || def.resolution === '2K' ? MODELS.imageHighQuality : MODELS.image;

      const response = await this.ai.models.generateContent({
        model,
        contents: enhancedPrompt,
        config: {
          responseModalities: ['image', 'text'],
        },
      });

      // Extract image
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data as string, 'base64');

          ensureDir(path.dirname(outputPath));
          fs.writeFileSync(outputPath, buffer);

          const generationTimeMs = Date.now() - startTime;

          // Register in manifest
          const metadata: ImageAssetMetadata = ImageAssetMetadataSchema.parse({
            id: def.id,
            type: 'image',
            path: path.relative(ASSETS_DIR, outputPath),
            model,
            promptHash: hashPrompt(enhancedPrompt),
            prompt: enhancedPrompt,
            generatedAt: new Date().toISOString(),
            generationTimeMs,
            fileSizeBytes: buffer.length,
            width: def.resolution === '4K' ? 4096 : def.resolution === '2K' ? 2048 : 1024,
            height: def.resolution === '4K' ? 4096 : def.resolution === '2K' ? 2048 : 1024,
            format: 'png',
            aspectRatio: def.aspectRatio,
            style: def.style,
            characterId: def.characterId as any,
            emotion: def.emotion,
            tags: ['portrait', def.characterId, def.emotion],
          });

          await this.manifestService.registerImageAsset(metadata, { isPortrait: true });

          console.log(`✅ Generated: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
          return { assetId: def.id, success: true, path: outputPath, generationTimeMs };
        }
      }

      throw new Error('No image data returned');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${def.id} - ${errorMsg}`);
      return { assetId: def.id, success: false, error: errorMsg };
    }
  }

  /**
   * Generate the first asset of each type (for testing)
   */
  async generateFirstOfEach(): Promise<{
    portrait: GenerationResult;
    cinematic: GenerationResult;
  }> {
    const portrait = await this.generatePortrait(0);
    const cinematic = await this.generateCinematic(0);
    return { portrait, cinematic };
  }

  /**
   * Generate all assets of a specific type
   */
  async generateAllPortraits(): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];
    for (let i = 0; i < PORTRAIT_ASSETS.length; i++) {
      results.push(await this.generatePortrait(i));
    }
    return results;
  }

  async generateAllCinematics(): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];
    for (let i = 0; i < CINEMATIC_ASSETS.length; i++) {
      results.push(await this.generateCinematic(i));
    }
    return results;
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

export async function runPipeline(args: string[]): Promise<void> {
  const pipeline = new AssetPipeline({ verbose: true });

  if (!(await pipeline.initialize())) {
    process.exit(1);
  }

  const command = args[0];
  const target = args[1];

  switch (command) {
    case 'portrait':
      if (target === 'all') {
        await pipeline.generateAllPortraits();
      } else {
        const idOrIndex = Number.isNaN(Number(target)) ? target : Number(target);
        await pipeline.generatePortrait(idOrIndex);
      }
      break;

    case 'cinematic':
      if (target === 'all') {
        await pipeline.generateAllCinematics();
      } else {
        const idOrIndex = Number.isNaN(Number(target)) ? target : Number(target);
        await pipeline.generateCinematic(idOrIndex);
      }
      break;

    case 'first':
      await pipeline.generateFirstOfEach();
      break;

    case 'list':
      console.log('\nPortraits:');
      pipeline
        .getAllPortraits()
        .forEach((p, i) => console.log(`  [${i}] ${p.id} - ${p.characterId}/${p.emotion}`));
      console.log('\nCinematics:');
      pipeline.getAllCinematics().forEach((c, i) => console.log(`  [${i}] ${c.id} - ${c.level}`));
      break;

    default:
      console.log(`
Usage: pnpm exec tsx src/game/ai/services/AssetPipeline.ts <command> [target]

Commands:
  portrait <id|index|all>  Generate portrait(s)
  cinematic <id|index|all> Generate cinematic(s)
  first                    Generate first of each type (for testing)
  list                     List all available assets

Examples:
  portrait 0               Generate first portrait
  portrait portrait_cole_neutral  Generate by ID
  portrait all             Generate all portraits
  cinematic 0              Generate first cinematic
  first                    Generate one of each type
`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline(process.argv.slice(2)).catch(console.error);
}
