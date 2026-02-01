#!/usr/bin/env npx tsx
/**
 * GenAI Asset Generation CLI - Manifest-Driven
 *
 * Scans manifest.json files in public/assets/ directories and generates
 * assets based on their definitions. Updates manifests with generation metadata.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-assets.ts portraits          # Generate all portraits
 *   pnpm exec tsx scripts/generate-assets.ts portraits 0        # Generate first portrait
 *   pnpm exec tsx scripts/generate-assets.ts splash             # Generate splash videos
 *   pnpm exec tsx scripts/generate-assets.ts cinematics         # Generate cinematics
 *   pnpm exec tsx scripts/generate-assets.ts all                # Generate everything
 *   pnpm exec tsx scripts/generate-assets.ts status             # Show generation status
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import {
  type CinematicManifest,
  CinematicManifestSchema,
  hashPrompt,
  needsRegeneration,
  type PortraitAsset,
  type PortraitManifest,
  PortraitManifestSchema,
  type SplashManifest,
  SplashManifestSchema,
  type VideoAsset,
} from '../src/game/ai/schemas/GenerationManifestSchemas';

// ============================================================================
// MODELS
// ============================================================================

const MODELS = {
  image: 'gemini-2.5-flash-image',
  imageHighQuality: 'gemini-3-pro-image-preview',
  videoFast: 'veo-3.1-fast-generate-preview',
  video: 'veo-3.1-generate-preview',
};

// ============================================================================
// PATHS
// ============================================================================

const ASSETS_ROOT = path.join(process.cwd(), 'public', 'assets');

const MANIFEST_PATHS = {
  portraits: path.join(ASSETS_ROOT, 'images', 'portraits', 'manifest.json'),
  splash: path.join(ASSETS_ROOT, 'videos', 'splash', 'manifest.json'),
  cinematics: path.join(ASSETS_ROOT, 'videos', 'cinematics', 'manifest.json'),
};

// ============================================================================
// MANIFEST LOADING
// ============================================================================

function loadPortraitManifest(): PortraitManifest {
  const content = fs.readFileSync(MANIFEST_PATHS.portraits, 'utf-8');
  return PortraitManifestSchema.parse(JSON.parse(content));
}

function loadSplashManifest(): SplashManifest {
  const content = fs.readFileSync(MANIFEST_PATHS.splash, 'utf-8');
  return SplashManifestSchema.parse(JSON.parse(content));
}

function loadCinematicManifest(): CinematicManifest {
  const content = fs.readFileSync(MANIFEST_PATHS.cinematics, 'utf-8');
  return CinematicManifestSchema.parse(JSON.parse(content));
}

function saveManifest(manifestPath: string, manifest: unknown): void {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   Manifest updated: ${path.basename(manifestPath)}`);
}

// ============================================================================
// PORTRAIT GENERATION
// ============================================================================

function buildPortraitPrompt(asset: PortraitAsset, manifest: PortraitManifest): string {
  const branding: string[] = [];

  if (manifest.loreBranding.unitPatches[asset.characterId]) {
    branding.push(manifest.loreBranding.unitPatches[asset.characterId]);
  }
  if (manifest.loreBranding.rankInsignia[asset.characterId]) {
    branding.push(manifest.loreBranding.rankInsignia[asset.characterId]);
  }

  const brandingText =
    branding.length > 0
      ? `\n\nMilitary details: ${branding.join('. ')}.\n\n${manifest.loreBranding.styleGuide}`
      : `\n\n${manifest.loreBranding.styleGuide}`;

  return `${asset.prompt}${brandingText}`;
}

async function generatePortrait(
  ai: GoogleGenAI,
  asset: PortraitAsset,
  manifest: PortraitManifest,
  force = false
): Promise<boolean> {
  const outputDir = path.dirname(MANIFEST_PATHS.portraits);
  const outputPath = path.join(outputDir, asset.filename);
  const fileExists = fs.existsSync(outputPath);

  const fullPrompt = buildPortraitPrompt(asset, manifest);

  // Idempotency check
  if (!force && !needsRegeneration(asset, fullPrompt, fileExists)) {
    console.log(`⏭️  Skipping (up-to-date): ${asset.id}`);
    return true;
  }

  console.log(`🎨 Generating portrait: ${asset.id}`);
  if (process.env.VERBOSE) {
    console.log('   Prompt:', `${fullPrompt.slice(0, 200)}...`);
  }

  asset.status = 'generating';
  const startTime = Date.now();

  try {
    const model =
      asset.resolution === '2K' || asset.resolution === '4K'
        ? MODELS.imageHighQuality
        : MODELS.image;

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseModalities: ['image', 'text'],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data as string, 'base64');

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);

        // Update asset metadata
        asset.status = 'generated';
        asset.metadata = {
          promptHash: hashPrompt(fullPrompt),
          generatedAt: new Date().toISOString(),
          generationTimeMs: Date.now() - startTime,
          fileSizeBytes: buffer.length,
          model,
        };
        delete asset.lastError;

        console.log(
          `✅ Generated: ${asset.filename} (${(buffer.length / 1024).toFixed(1)} KB, ${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        );
        return true;
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    asset.status = 'failed';
    asset.lastError = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed: ${asset.id} - ${asset.lastError}`);
    return false;
  }
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

async function generateVideo(
  ai: GoogleGenAI,
  asset: VideoAsset,
  manifestPath: string,
  force = false
): Promise<boolean> {
  const outputDir = path.dirname(manifestPath);
  const outputPath = path.join(outputDir, asset.filename);
  const fileExists = fs.existsSync(outputPath);

  // Idempotency check
  if (!force && !needsRegeneration(asset, asset.prompt, fileExists)) {
    console.log(`⏭️  Skipping (up-to-date): ${asset.id}`);
    return true;
  }

  console.log(`🎬 Generating video: ${asset.id}`);
  console.log(`   Config: ${asset.aspectRatio}, ${asset.resolution}, ${asset.duration}s`);

  asset.status = 'generating';
  const startTime = Date.now();

  try {
    // Veo 3.1 API configuration
    let operation = await ai.models.generateVideos({
      model: MODELS.videoFast,
      prompt: asset.prompt,
      config: {
        aspectRatio: asset.aspectRatio,
        durationSeconds: asset.duration,
        resolution: asset.resolution,
        ...(asset.negativePrompt && { negativePrompt: asset.negativePrompt }),
      },
    });

    console.log('   Video generation started, polling...');

    const maxWait = 600000; // 10 minutes
    while (!operation.done) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Timed out after 10 minutes');
      }
      await new Promise((r) => setTimeout(r, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`   Polling... (${elapsed}s)`);
    }

    if (operation.response?.generatedVideos?.[0]?.video?.uri) {
      const videoUri = operation.response.generatedVideos[0].video.uri;
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(`${videoUri}&key=${apiKey}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, buffer);

      // Update asset metadata
      asset.status = 'generated';
      asset.metadata = {
        promptHash: hashPrompt(asset.prompt),
        generatedAt: new Date().toISOString(),
        generationTimeMs: Date.now() - startTime,
        fileSizeBytes: buffer.length,
        model: MODELS.videoFast,
      };
      delete asset.lastError;

      console.log(
        `✅ Generated: ${asset.filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - startTime) / 1000).toFixed(0)}s)`
      );
      return true;
    }

    throw new Error('No video data in response');
  } catch (error) {
    asset.status = 'failed';
    asset.lastError = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed: ${asset.id} - ${asset.lastError}`);
    return false;
  }
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

async function runPortraits(ai: GoogleGenAI, target?: string, force = false): Promise<void> {
  const manifest = loadPortraitManifest();

  if (target === undefined || target === 'all') {
    for (const asset of manifest.assets) {
      await generatePortrait(ai, asset, manifest, force);
    }
  } else {
    const idx = Number.isNaN(Number(target))
      ? manifest.assets.findIndex((a) => a.id === target)
      : Number(target);
    const asset = manifest.assets[idx];
    if (!asset) {
      console.error(`Portrait not found: ${target}`);
      process.exit(1);
    }
    await generatePortrait(ai, asset, manifest, force);
  }

  manifest.updatedAt = new Date().toISOString();
  saveManifest(MANIFEST_PATHS.portraits, manifest);
}

async function runSplash(ai: GoogleGenAI, target?: string, force = false): Promise<void> {
  const manifest = loadSplashManifest();

  if (target === undefined || target === 'all') {
    for (const asset of manifest.assets) {
      await generateVideo(ai, asset, MANIFEST_PATHS.splash, force);
    }
  } else if (target === '16:9' || target === '16x9') {
    const asset = manifest.assets.find((a) => a.aspectRatio === '16:9');
    if (asset) await generateVideo(ai, asset, MANIFEST_PATHS.splash, force);
  } else if (target === '9:16' || target === '9x16') {
    const asset = manifest.assets.find((a) => a.aspectRatio === '9:16');
    if (asset) await generateVideo(ai, asset, MANIFEST_PATHS.splash, force);
  } else {
    const idx = Number.isNaN(Number(target))
      ? manifest.assets.findIndex((a) => a.id === target)
      : Number(target);
    const asset = manifest.assets[idx];
    if (!asset) {
      console.error(`Splash video not found: ${target}`);
      process.exit(1);
    }
    await generateVideo(ai, asset, MANIFEST_PATHS.splash, force);
  }

  manifest.updatedAt = new Date().toISOString();
  saveManifest(MANIFEST_PATHS.splash, manifest);
}

async function runCinematics(ai: GoogleGenAI, target?: string, force = false): Promise<void> {
  const manifest = loadCinematicManifest();

  if (target === undefined || target === 'all') {
    for (const asset of manifest.assets) {
      await generateVideo(ai, asset, MANIFEST_PATHS.cinematics, force);
    }
  } else {
    const idx = Number.isNaN(Number(target))
      ? manifest.assets.findIndex((a) => a.id === target || a.levelId === target)
      : Number(target);
    const asset = manifest.assets[idx];
    if (!asset) {
      console.error(`Cinematic not found: ${target}`);
      process.exit(1);
    }
    await generateVideo(ai, asset, MANIFEST_PATHS.cinematics, force);
  }

  manifest.updatedAt = new Date().toISOString();
  saveManifest(MANIFEST_PATHS.cinematics, manifest);
}

function showStatus(): void {
  console.log('=== Asset Generation Status ===\n');

  // Portraits
  console.log('📸 Portraits:');
  const portraits = loadPortraitManifest();
  for (const asset of portraits.assets) {
    const status = asset.status === 'generated' ? '✅' : asset.status === 'failed' ? '❌' : '⏳';
    const size = asset.metadata?.fileSizeBytes
      ? ` (${(asset.metadata.fileSizeBytes / 1024).toFixed(0)} KB)`
      : '';
    console.log(`   ${status} ${asset.id}${size}`);
  }

  // Splash
  console.log('\n🎬 Splash Videos:');
  const splash = loadSplashManifest();
  for (const asset of splash.assets) {
    const status = asset.status === 'generated' ? '✅' : asset.status === 'failed' ? '❌' : '⏳';
    const size = asset.metadata?.fileSizeBytes
      ? ` (${(asset.metadata.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)`
      : '';
    console.log(`   ${status} ${asset.id} [${asset.aspectRatio}]${size}`);
  }

  // Cinematics
  console.log('\n🎥 Cinematics:');
  const cinematics = loadCinematicManifest();
  for (const asset of cinematics.assets) {
    const status = asset.status === 'generated' ? '✅' : asset.status === 'failed' ? '❌' : '⏳';
    const size = asset.metadata?.fileSizeBytes
      ? ` (${(asset.metadata.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)`
      : '';
    console.log(`   ${status} ${asset.id}${size}`);
  }

  // Summary
  const allAssets = [...portraits.assets, ...splash.assets, ...cinematics.assets];
  const generated = allAssets.filter((a) => a.status === 'generated').length;
  const pending = allAssets.filter((a) => a.status === 'pending').length;
  const failed = allAssets.filter((a) => a.status === 'failed').length;

  console.log(`\n📊 Summary: ${generated} generated, ${pending} pending, ${failed} failed`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];
  const force = args.includes('--force');

  if (command === 'status') {
    showStatus();
    return;
  }

  // Initialize API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set in .env');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}\n`);

  switch (command) {
    case 'portraits':
      await runPortraits(ai, target, force);
      break;

    case 'splash':
      await runSplash(ai, target, force);
      break;

    case 'cinematics':
      await runCinematics(ai, target, force);
      break;

    case 'all':
      console.log('=== Generating All Assets ===\n');
      await runPortraits(ai, 'all', force);
      console.log('');
      await runSplash(ai, 'all', force);
      console.log('');
      await runCinematics(ai, 'all', force);
      break;

    default:
      console.log(`
GenAI Asset Generation CLI (Manifest-Driven)

Usage: pnpm exec tsx scripts/generate-assets.ts <command> [target] [--force]

Commands:
  portraits [id|index|all]    Generate character portraits
  splash [16:9|9:16|all]      Generate splash/title videos
  cinematics [id|level|all]   Generate level intro cinematics
  all                         Generate all assets
  status                      Show generation status

Options:
  --force                     Regenerate even if up-to-date

Examples:
  portraits 0                 Generate first portrait
  portraits portrait_cole_neutral   Generate by ID
  portraits all               Generate all portraits
  splash 16:9                 Generate landscape splash only
  splash all                  Generate both splash videos
  cinematics anchor_station   Generate by level ID
  status                      Check what's generated

Manifests:
  portraits:  public/assets/images/portraits/manifest.json
  splash:     public/assets/videos/splash/manifest.json
  cinematics: public/assets/videos/cinematics/manifest.json

Video Config (Veo 3.1):
  - Resolution: 1080p (native HD)
  - Duration: 8 seconds
  - Audio: Native 48kHz synchronized audio
  - Aspect ratios: 16:9 (landscape), 9:16 (portrait)
`);
  }
}

main().catch(console.error);
