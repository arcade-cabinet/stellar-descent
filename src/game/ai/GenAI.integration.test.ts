/**
 * GenAI Integration Tests
 *
 * End-to-end tests for the GenAI asset generation pipeline.
 * Uses VCR recording for deterministic replay in CI.
 *
 * Run modes:
 * - VCR_MODE=record pnpm test GenAI.integration  # Record new API responses
 * - VCR_MODE=replay pnpm test GenAI.integration  # Replay from recordings (default)
 * - VCR_MODE=passthrough pnpm test GenAI.integration  # Real API calls
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createVCRContext, stopVCR, type VCRContext } from '../../test/vcr/VCRSetup';
import { GeminiAssetGenerator } from './GeminiAssetGenerator';
import {
  ImageAssetMetadataSchema,
  LevelAssetManifestSchema,
  SharedAssetManifestSchema,
  VideoAssetMetadataSchema,
} from './schemas/AssetManifestSchemas';
import { getManifestService, type ManifestUpdateService } from './services/ManifestUpdateService';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_OUTPUT_DIR = path.join(process.cwd(), 'public', 'assets');
const TEST_MANIFEST_DIR = path.join(process.cwd(), 'public', 'assets', 'manifests');

// Skip integration tests if no API key and not in replay mode
const SKIP_REASON =
  !process.env.GEMINI_API_KEY && process.env.VCR_MODE !== 'replay'
    ? 'GEMINI_API_KEY not set and not in VCR replay mode'
    : undefined;

// Video generation uses async polling which doesn't replay well in VCR
// Skip video tests in replay mode - they'll run in record/passthrough mode
const _SKIP_VIDEO_REASON =
  process.env.VCR_MODE === 'replay'
    ? 'Video async polling does not replay correctly in VCR mode'
    : SKIP_REASON;

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TEST_PORTRAIT_PROMPT = `Photorealistic character portrait of Sergeant James Cole,
a battle-hardened space marine in his late 30s. Short dark hair with grey at temples,
strong jaw, determined expression. Wearing futuristic military combat armor.
Dramatic side lighting. Dark background. High detail, cinematic quality.`;

const TEST_VIDEO_PROMPT = `Cinematic sci-fi space station interior. Camera slowly moves
through a cryo-bay with hibernation pods glowing blue. Warning alarms flash red.
One pod opens with steam. Dark metallic corridors. Dramatic lighting. 8 seconds.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('GenAI Integration Tests', () => {
  let vcr: VCRContext;
  let generator: GeminiAssetGenerator;
  let manifestService: ManifestUpdateService;

  beforeAll(async () => {
    // Setup directories
    ensureDir(TEST_OUTPUT_DIR);
    ensureDir(TEST_MANIFEST_DIR);

    // Initialize VCR
    vcr = createVCRContext('genai-integration');

    // Initialize generator
    generator = new GeminiAssetGenerator();
    await generator.initialize();

    // Initialize manifest service
    manifestService = getManifestService();
    await manifestService.initialize();
  });

  afterAll(async () => {
    await stopVCR(vcr);
    generator.dispose();
  });

  beforeEach(() => {
    manifestService.clearCache();
  });

  // ==========================================================================
  // IMAGE GENERATION TESTS
  // ==========================================================================

  describe('Image Generation', () => {
    it.skipIf(SKIP_REASON)(
      'should generate a character portrait',
      async () => {
        const result = await generator.generateImage({
          id: 'test_portrait_cole_neutral',
          type: 'image',
          prompt: TEST_PORTRAIT_PROMPT,
          style: 'portrait_realistic',
          aspectRatio: '1:1',
          resolution: '2K',
          characterId: 'cole_james',
          emotion: 'neutral',
        });

        expect(result.success).toBe(true);
        expect(result.imageData).toBeDefined();
        expect(result.mimeType).toMatch(/^image\/(png|jpeg|webp)$/);

        if (result.success && result.imageData) {
          // Save the generated image
          const ext = result.mimeType?.includes('jpeg') ? 'jpg' : 'png';
          const outputPath = path.join(
            TEST_OUTPUT_DIR,
            'images',
            'portraits',
            'cole_james',
            `neutral.${ext}`
          );
          ensureDir(path.dirname(outputPath));

          const buffer = Buffer.from(result.imageData, 'base64');
          fs.writeFileSync(outputPath, buffer);

          // Verify file was written
          expect(fs.existsSync(outputPath)).toBe(true);
          expect(fs.statSync(outputPath).size).toBeGreaterThan(10000); // At least 10KB

          // Register in manifest
          const metadata = ImageAssetMetadataSchema.parse({
            id: 'portrait_cole_neutral',
            type: 'image',
            path: `images/portraits/cole_james/neutral.${ext}`,
            model: 'gemini-3-pro-image-preview',
            promptHash: hashPrompt(TEST_PORTRAIT_PROMPT),
            prompt: TEST_PORTRAIT_PROMPT,
            generatedAt: new Date().toISOString(),
            generationTimeMs: result.generationTimeMs ?? 0,
            fileSizeBytes: buffer.length,
            width: 2048,
            height: 2048,
            format: ext as 'png' | 'jpg',
            aspectRatio: '1:1',
            style: 'portrait_realistic',
            characterId: 'cole_james',
            emotion: 'neutral',
            tags: ['portrait', 'cole', 'protagonist'],
          });

          await manifestService.registerImageAsset(metadata, { isPortrait: true });

          // Verify manifest was updated
          const manifest = await manifestService.loadSharedManifest();
          expect(manifest.portraits.cole_james).toBeDefined();
          expect(manifest.portraits.cole_james.length).toBeGreaterThan(0);
        }
      },
      60000
    ); // 60s timeout for image generation

    it.skipIf(SKIP_REASON)('should validate image metadata with Zod schema', () => {
      const validMetadata = {
        id: 'test_image',
        type: 'image' as const,
        path: 'images/test.png',
        model: 'gemini-3-pro-image-preview',
        promptHash: 'abc123',
        prompt: 'Test prompt',
        generatedAt: new Date().toISOString(),
        generationTimeMs: 1000,
        fileSizeBytes: 50000,
        width: 1024,
        height: 1024,
        format: 'png' as const,
        aspectRatio: '1:1' as const,
        style: 'portrait_realistic' as const,
      };

      const result = ImageAssetMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // VIDEO GENERATION TESTS
  // ==========================================================================

  describe('Video Generation', () => {
    // SKIPPED: This test calls the Gemini Veo video generation API which uses async
    // polling and can take 5+ minutes to complete. Video generation is an external
    // API dependency that is not suitable for automated test runs.
    // To test video generation manually, run with:
    //   VCR_MODE=passthrough GEMINI_API_KEY=<key> pnpm test GenAI.integration -- --testNamePattern="video"
    it.skip('should generate a cinematic video', async () => {
      const result = await generator.generateVideo({
        id: 'test_cinematic_anchor_intro',
        type: 'video',
        prompt: TEST_VIDEO_PROMPT,
        duration: 8,
        style: 'space_station',
        aspectRatio: '16:9',
        level: 'anchor_station',
        personGeneration: false,
        priority: 1,
      });

      expect(result.success).toBe(true);
      expect(result.videoData).toBeDefined();

      if (result.success && result.videoData) {
        // Save the generated video
        const outputPath = path.join(
          TEST_OUTPUT_DIR,
          'videos',
          'cinematics',
          'anchor_station',
          'intro.mp4'
        );
        ensureDir(path.dirname(outputPath));

        const buffer = Buffer.from(result.videoData, 'base64');
        fs.writeFileSync(outputPath, buffer);

        // Verify file was written
        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.statSync(outputPath).size).toBeGreaterThan(100000); // At least 100KB

        // Register in manifest
        const metadata = VideoAssetMetadataSchema.parse({
          id: 'cinematic_anchor_station_intro',
          type: 'video',
          path: 'videos/cinematics/anchor_station/intro.mp4',
          model: 'veo-3.1-fast-generate-preview',
          promptHash: hashPrompt(TEST_VIDEO_PROMPT),
          prompt: TEST_VIDEO_PROMPT,
          generatedAt: new Date().toISOString(),
          generationTimeMs: result.generationTimeMs ?? 0,
          fileSizeBytes: buffer.length,
          levelId: 'anchor_station',
          durationSeconds: 8,
          resolution: '720p',
          aspectRatio: '16:9',
          hasAudio: true,
          style: 'space_station',
          tags: ['cinematic', 'intro', 'anchor_station'],
        });

        await manifestService.registerVideoAsset(metadata, { isIntroCinematic: true });

        // Verify manifest was updated
        const manifest = await manifestService.loadLevelManifest('anchor_station');
        expect(manifest.introCinematic).toBeDefined();
        expect(manifest.introCinematic?.id).toBe('cinematic_anchor_station_intro');
      }
    }, 300000); // 5 minute timeout for video generation

    it.skipIf(SKIP_REASON)('should validate video metadata with Zod schema', () => {
      const validMetadata = {
        id: 'test_video',
        type: 'video' as const,
        path: 'videos/test.mp4',
        model: 'veo-3.1-generate-preview',
        promptHash: 'abc123',
        prompt: 'Test prompt',
        generatedAt: new Date().toISOString(),
        generationTimeMs: 60000,
        fileSizeBytes: 5000000,
        durationSeconds: 8,
        resolution: '1080p' as const,
        aspectRatio: '16:9' as const,
        hasAudio: true,
        style: 'cinematic_scifi' as const,
      };

      const result = VideoAssetMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // MANIFEST TESTS
  // ==========================================================================

  describe('Manifest Management', () => {
    it('should create and save a level manifest', async () => {
      const manifest = await manifestService.loadLevelManifest('landfall');

      expect(manifest.levelId).toBe('landfall');
      expect(manifest.schemaVersion).toBeDefined();

      // Validate schema
      const result = LevelAssetManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('should create and save a shared manifest', async () => {
      const manifest = await manifestService.loadSharedManifest();

      expect(manifest.schemaVersion).toBeDefined();

      // Validate schema
      const result = SharedAssetManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('should resolve asset paths correctly', () => {
      const portraitPath = manifestService.resolveAssetPath('portrait', {
        characterId: 'cole_james',
        emotion: 'determined',
      });
      expect(portraitPath).toBe('images/portraits/cole_james/determined.png');

      const cinematicPath = manifestService.resolveAssetPath('cinematic_intro', {
        levelId: 'anchor_station',
      });
      expect(cinematicPath).toBe('videos/cinematics/anchor_station/intro.mp4');

      const sfxPath = manifestService.resolveAssetPath('sfx', {
        category: 'weapons',
        id: 'pulse_rifle_fire',
      });
      expect(sfxPath).toBe('audio/sfx/weapons/pulse_rifle_fire.mp3');
    });
  });

  // ==========================================================================
  // PIPELINE INTEGRATION TEST
  // ==========================================================================

  describe('Full Pipeline Integration', () => {
    it.skipIf(SKIP_REASON)(
      'should exercise the complete generation pipeline',
      async () => {
        // 1. Generate image (use 2K resolution to get high-quality model)
        const imageResult = await generator.generateImage({
          id: 'pipeline_test_portrait',
          type: 'image',
          prompt: 'Sci-fi military commander portrait, dramatic lighting',
          style: 'portrait_realistic',
          aspectRatio: '1:1',
          resolution: '2K',
          characterId: 'reyes_commander',
          emotion: 'commanding',
        });

        expect(imageResult.success).toBe(true);

        // 2. Save to organized location
        if (imageResult.success && imageResult.imageData) {
          const relativePath = manifestService.resolveAssetPath('portrait', {
            characterId: 'reyes_commander',
            emotion: 'commanding',
          });
          const absolutePath = manifestService.getAbsoluteAssetPath(relativePath);
          manifestService.ensureAssetDirectory(relativePath);

          const buffer = Buffer.from(imageResult.imageData, 'base64');
          fs.writeFileSync(absolutePath, buffer);

          expect(fs.existsSync(absolutePath)).toBe(true);

          // 3. Register in manifest with metadata
          const metadata = ImageAssetMetadataSchema.parse({
            id: 'portrait_reyes_commanding',
            type: 'image',
            path: relativePath,
            model: 'gemini-3-pro-image-preview',
            promptHash: hashPrompt('Sci-fi military commander portrait'),
            prompt: 'Sci-fi military commander portrait, dramatic lighting',
            generatedAt: new Date().toISOString(),
            generationTimeMs: imageResult.generationTimeMs ?? 0,
            fileSizeBytes: buffer.length,
            width: 1024,
            height: 1024,
            format: 'png',
            aspectRatio: '1:1',
            style: 'portrait_realistic',
            characterId: 'reyes_commander',
            emotion: 'commanding',
            tags: ['portrait', 'reyes', 'commander', 'npc'],
          });

          await manifestService.registerImageAsset(metadata, { isPortrait: true });

          // 4. Verify manifest
          const manifest = await manifestService.loadSharedManifest();
          expect(manifest.portraits.reyes_commander).toBeDefined();

          // 5. Verify manifest persisted to disk
          const manifestPath = path.join(TEST_MANIFEST_DIR, 'shared.manifest.json');
          expect(fs.existsSync(manifestPath)).toBe(true);

          const savedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          expect(savedManifest.portraits.reyes_commander).toBeDefined();
        }
      },
      120000
    );
  });
});
