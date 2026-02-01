#!/usr/bin/env npx tsx

/**
 * generate-cinematic-assets.ts
 *
 * Pre-generation script for AI-powered cinematic assets using Google Gemini.
 * Run during build to pre-generate all manifested video, image, and text assets.
 *
 * Usage:
 *   npx tsx scripts/generate-cinematic-assets.ts [options]
 *
 * Options:
 *   --videos-only    Only generate video cinematics
 *   --images-only    Only generate images (portraits, quest images)
 *   --text-only      Only generate text content
 *   --level <id>     Only generate assets for a specific level
 *   --priority <n>   Only generate assets with priority >= n
 *   --fast           Use fast video model (lower quality, faster)
 *   --dry-run        List assets to generate without actually generating
 *   --verbose        Enable verbose logging
 *   --clear-cache    Clear all cached assets before generating
 *
 * Environment:
 *   GEMINI_API_KEY   Google Gemini API key (required)
 *
 * Output:
 *   Generates assets to public/generated/ directory
 *   Also caches to IndexedDB for browser access (when run in browser context)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';

// Import manifest definitions
// Note: This script is designed to be run with tsx which handles TypeScript imports
import type {
  CinematicAssetDef,
  PortraitAssetDef,
  QuestImageDef,
  TextContentDef,
} from '../src/game/ai/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface GenerationConfig {
  videosOnly: boolean;
  imagesOnly: boolean;
  textOnly: boolean;
  level: string | null;
  minPriority: number;
  useFastModel: boolean;
  dryRun: boolean;
  verbose: boolean;
  clearCache: boolean;
}

const MODELS = {
  text: 'gemini-3-flash-preview',
  image: 'gemini-2.5-flash-image',
  imageHighQuality: 'gemini-3-pro-image-preview',
  videoFast: 'veo-3.0-fast-generate-001',
  video: 'veo-3.1-generate-preview',
} as const;

const OUTPUT_DIR = 'public/generated';
const VIDEO_POLL_INTERVAL = 10000; // 10 seconds
const VIDEO_MAX_WAIT_TIME = 600000; // 10 minutes
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests

// ============================================================================
// MANIFEST DATA (inline to avoid import issues with Node.js)
// ============================================================================

// Define manifest data directly to avoid ESM/CJS issues
const CINEMATIC_ASSETS: CinematicAssetDef[] = [
  {
    id: 'cinematic_anchor_station_intro',
    type: 'video',
    prompt: `Cinematic sci-fi space station interior scene. Camera slowly moves through
    a cryo-bay with multiple hibernation pods glowing with soft blue light. Warning alarms
    flash red in the background. One pod begins to open with steam and hydraulic sounds.
    Dark metallic corridors with holographic displays. Dramatic lighting with lens flares.
    High-end CGI quality, Alien movie aesthetic, atmospheric tension.`,
    duration: 15,
    style: 'space_station',
    aspectRatio: '21:9',
    level: 'anchor_station',
    negativePrompt: 'cartoon, anime, low quality, blurry, text, watermark',
    personGeneration: false,
    priority: 10,
  },
  {
    id: 'cinematic_landfall_intro',
    type: 'video',
    prompt: `Cinematic military dropship descent through alien planet atmosphere. POV from
    inside looking out window at orange-red sky with swirling dust clouds. Turbulence shakes
    the camera. Silhouettes of other drop pods falling alongside. Surface approaching rapidly
    with alien terrain visible - red canyons and strange rock formations. Military HUD
    elements flickering. Intensity increases as ground approaches. Starship Troopers meets
    Halo ODST aesthetic.`,
    duration: 12,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'landfall',
    negativePrompt: 'cartoon, anime, low quality, blurry, faces, humans visible',
    personGeneration: false,
    priority: 9,
  },
  {
    id: 'cinematic_the_breach_intro',
    type: 'video',
    prompt: `Dramatic reveal of alien queen in massive organic hive chamber. Camera slowly
    pushes through bioluminescent tunnel into vast cavern. Strange organic architecture
    with pulsing veins and alien eggs. In the center, a massive creature begins to stir -
    the QUEEN. Multiple glowing eyes open. Terrible screech echoes. Aliens movie queen
    reveal aesthetic. Horror, scale, dread. Bio-mechanical H.R. Giger influence.`,
    duration: 20,
    style: 'alien_organic',
    aspectRatio: '21:9',
    level: 'the_breach',
    negativePrompt: 'cartoon, anime, cute, friendly, bright colors',
    personGeneration: false,
    priority: 10,
  },
  {
    id: 'cinematic_final_escape_intro',
    type: 'video',
    prompt: `Apocalyptic escape sequence through collapsing alien hive. Vehicle racing
    through tunnels as everything collapses behind. Explosions, falling debris, alien
    structures disintegrating. Glimpses of surviving creatures being crushed. Light
    visible ahead - the exit. Ground cracking, lava visible below. Timer HUD element
    counting down. Halo Warthog Run meets Aliens escape sequence. Maximum intensity,
    triumphant desperation.`,
    duration: 15,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'final_escape',
    negativePrompt: 'cartoon, anime, slow, calm',
    personGeneration: false,
    priority: 10,
  },
];

const PORTRAIT_ASSETS: PortraitAssetDef[] = [
  {
    id: 'portrait_cole_neutral',
    type: 'image',
    prompt: `Military sci-fi portrait of a battle-hardened space marine sergeant. Male,
    mid-30s, short dark hair, strong jaw, determined eyes. Wearing futuristic combat
    helmet with visor up. Subtle scars. Dark background with subtle blue rim lighting.
    Realistic rendering, cinematic quality. Similar to Mass Effect character portraits.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'cole',
    emotion: 'neutral',
  },
  {
    id: 'portrait_athena_normal',
    type: 'image',
    prompt: `Holographic AI avatar portrait. Abstract feminine face formed from blue
    light particles and data streams. Geometric patterns suggesting features. Calm,
    professional appearance. Circuit board patterns in background. TRON meets Cortana
    aesthetic. Glowing edges, digital artifacts.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'athena',
    emotion: 'normal',
  },
  {
    id: 'portrait_marcus_neutral',
    type: 'image',
    prompt: `Military sci-fi portrait of a mech pilot. Male, late-20s, similar features
    to protagonist (brothers), slightly younger. Mech pilot helmet with retracted faceplate.
    Confident but weary expression. Scorch marks on helmet. Dark background with orange
    rim lighting. Realistic rendering.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'marcus',
    emotion: 'neutral',
  },
];

const QUEST_IMAGES: QuestImageDef[] = [
  {
    id: 'loading_act1',
    type: 'image',
    prompt: `Wide cinematic shot of space station orbiting alien planet. Station in
    foreground with planet's orange-red surface below. Stars in background. Dramatic
    lighting with sun creating lens flare. Prometheus station aesthetic. Epic scale.`,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'anchor_station',
    purpose: 'loading_screen',
  },
  {
    id: 'loading_act4',
    type: 'image',
    prompt: `Massive alien hive structure emerging from planet surface. Bio-organic
    architecture with pulsing lights. Military forces assembling in foreground.
    Storm clouds overhead with lightning. Final battle aesthetic. Epic scale dread.`,
    style: 'alien_organic',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'hive_assault',
    purpose: 'loading_screen',
  },
];

const TEXT_CONTENT: TextContentDef[] = [
  {
    id: 'audio_log_scientist_01',
    type: 'text',
    prompt: `Write a short audio log entry (50-75 words) from a terrified scientist
    at FOB Delta. They discovered something horrifying about the alien creatures -
    they're not just predators, they're intelligent and coordinating. The log cuts off
    suddenly. Use first person, present tense, include timestamps. Avoid cliches.`,
    maxTokens: 150,
    category: 'audio_log',
    level: 'fob_delta',
    systemInstruction: `You are writing for a military sci-fi horror game. Tone should
    be tense, realistic, and slightly desperate. No purple prose. Short sentences.
    Include specific technical/scientific details to feel authentic.`,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string, ...args: unknown[]): void {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

function error(message: string, ...args: unknown[]): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
}

function parseArgs(): GenerationConfig {
  const args = process.argv.slice(2);
  const config: GenerationConfig = {
    videosOnly: false,
    imagesOnly: false,
    textOnly: false,
    level: null,
    minPriority: 0,
    useFastModel: false,
    dryRun: false,
    verbose: false,
    clearCache: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--videos-only':
        config.videosOnly = true;
        break;
      case '--images-only':
        config.imagesOnly = true;
        break;
      case '--text-only':
        config.textOnly = true;
        break;
      case '--level':
        config.level = args[++i];
        break;
      case '--priority':
        config.minPriority = parseInt(args[++i], 10);
        break;
      case '--fast':
        config.useFastModel = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--clear-cache':
        config.clearCache = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
generate-cinematic-assets.ts - Pre-generate AI assets for Stellar Descent

Usage:
  npx tsx scripts/generate-cinematic-assets.ts [options]

Options:
  --videos-only    Only generate video cinematics
  --images-only    Only generate images (portraits, quest images)
  --text-only      Only generate text content
  --level <id>     Only generate assets for a specific level
  --priority <n>   Only generate assets with priority >= n
  --fast           Use fast video model (lower quality, faster)
  --dry-run        List assets to generate without actually generating
  --verbose        Enable verbose logging
  --clear-cache    Clear all cached assets before generating
  --help           Show this help message

Environment:
  GEMINI_API_KEY   Google Gemini API key (required)

Examples:
  npx tsx scripts/generate-cinematic-assets.ts --dry-run
  npx tsx scripts/generate-cinematic-assets.ts --videos-only --priority 10
  npx tsx scripts/generate-cinematic-assets.ts --level the_breach
  npx tsx scripts/generate-cinematic-assets.ts --images-only --fast
`);
}

function ensureOutputDir(): void {
  const dir = path.resolve(process.cwd(), OUTPUT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created output directory: ${dir}`);
  }

  // Create subdirectories
  const subdirs = ['videos', 'images', 'text'];
  for (const subdir of subdirs) {
    const subdirPath = path.join(dir, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }
}

function getStyleContext(style: string): string {
  const styleContexts: Record<string, string> = {
    cinematic_scifi: `Style: High-budget Hollywood sci-fi cinematography. Anamorphic lens
      flares, dramatic lighting, 4K quality. References: Blade Runner, Alien, Interstellar.`,
    horror_scifi: `Style: Dark atmospheric horror with sci-fi elements. Low key lighting,
      heavy shadows, desaturated colors. References: Dead Space, Alien Isolation.`,
    military_tactical: `Style: Realistic military aesthetic. Tactical HUD elements,
      military hardware. References: Call of Duty, Battlefield.`,
    alien_organic: `Style: H.R. Giger-inspired bio-mechanical alien aesthetic.
      Organic structures with chitinous textures, bioluminescence.`,
    frozen_wasteland: `Style: Harsh arctic environment. Ice blue accents, limited visibility.
      References: The Thing, Frostpunk.`,
    space_station: `Style: Clean sci-fi space station interior or damaged with
      emergency lighting. References: 2001, The Expanse.`,
    portrait_realistic: `Style: Photorealistic character portrait. Professional lighting
      with shallow depth of field. References: Mass Effect portraits.`,
  };

  return styleContexts[style] ?? '';
}

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

async function generateVideo(
  ai: GoogleGenAI,
  def: CinematicAssetDef,
  config: GenerationConfig
): Promise<boolean> {
  const model = config.useFastModel ? MODELS.videoFast : MODELS.video;
  log(`Generating video: ${def.id} using ${model}`);

  try {
    const styleContext = getStyleContext(def.style);
    const fullPrompt = `${styleContext}\n\n${def.prompt}${
      def.negativePrompt ? `\n\nAvoid: ${def.negativePrompt}` : ''
    }`;

    // Start video generation
    let operation = await ai.models.generateVideos({
      model,
      prompt: fullPrompt,
      config: {
        personGeneration: def.personGeneration ? 'allow' : 'dont_allow',
        aspectRatio: def.aspectRatio,
      },
    });

    // Poll for completion
    const startTime = Date.now();
    while (!operation.done) {
      if (Date.now() - startTime > VIDEO_MAX_WAIT_TIME) {
        throw new Error('Video generation timed out');
      }

      if (config.verbose) {
        log(`  Polling for completion... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      }

      await delay(VIDEO_POLL_INTERVAL);
      operation = await ai.operations.getVideosOperation({ operation });
    }

    // Save video
    if (operation.response?.generatedVideos?.length) {
      const video = operation.response.generatedVideos[0];
      const videoUri = video.video?.uri;

      if (videoUri) {
        const apiKey = process.env.GEMINI_API_KEY!;
        const videoUrl = `${videoUri}&key=${apiKey}`;
        const response = await fetch(videoUrl);
        const videoBuffer = await response.arrayBuffer();

        const outputPath = path.join(OUTPUT_DIR, 'videos', `${def.id}.mp4`);
        fs.writeFileSync(outputPath, Buffer.from(videoBuffer));

        log(`  Saved: ${outputPath}`);
        return true;
      }
    }

    throw new Error('No video generated');
  } catch (err) {
    error(`Failed to generate video ${def.id}:`, err);
    return false;
  }
}

async function generateImage(
  ai: GoogleGenAI,
  def: PortraitAssetDef | QuestImageDef,
  _config: GenerationConfig
): Promise<boolean> {
  const model =
    def.resolution === '4K' || def.resolution === '2K' ? MODELS.imageHighQuality : MODELS.image;

  log(`Generating image: ${def.id} using ${model}`);

  try {
    const styleContext = getStyleContext(def.style);
    const fullPrompt = `${styleContext}\n\n${def.prompt}`;

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        imageConfig: {
          aspectRatio: def.aspectRatio,
          imageSize: def.resolution,
        },
      },
    });

    // Extract and save image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data as string;
          const mimeType = part.inlineData.mimeType ?? 'image/png';
          const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';

          const outputPath = path.join(OUTPUT_DIR, 'images', `${def.id}.${ext}`);
          fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));

          log(`  Saved: ${outputPath}`);
          return true;
        }
      }
    }

    throw new Error('No image generated');
  } catch (err) {
    error(`Failed to generate image ${def.id}:`, err);
    return false;
  }
}

async function generateText(
  ai: GoogleGenAI,
  def: TextContentDef,
  _config: GenerationConfig
): Promise<boolean> {
  log(`Generating text: ${def.id}`);

  try {
    const response = await ai.models.generateContent({
      model: MODELS.text,
      contents: def.prompt,
      config: {
        systemInstruction: def.systemInstruction,
        maxOutputTokens: def.maxTokens,
      },
    });

    const text = response.text;

    if (text) {
      const outputPath = path.join(OUTPUT_DIR, 'text', `${def.id}.txt`);
      fs.writeFileSync(outputPath, text, 'utf-8');

      log(`  Saved: ${outputPath}`);
      return true;
    }

    throw new Error('No text generated');
  } catch (err) {
    error(`Failed to generate text ${def.id}:`, err);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  // Check for API key (not required for dry-run)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !config.dryRun) {
    error('GEMINI_API_KEY environment variable is required');
    error('Set GEMINI_API_KEY or use --dry-run to preview assets');
    process.exit(1);
  }

  // Initialize Gemini (only if not dry-run)
  let ai: GoogleGenAI | null = null;
  if (apiKey && !config.dryRun) {
    ai = new GoogleGenAI({ apiKey });
    log('Gemini AI initialized');
  }

  // Ensure output directory exists
  ensureOutputDir();

  // Filter assets based on config
  let cinematics = [...CINEMATIC_ASSETS];
  const portraits = [...PORTRAIT_ASSETS];
  let questImages = [...QUEST_IMAGES];
  let textContent = [...TEXT_CONTENT];

  // Filter by level if specified
  if (config.level) {
    cinematics = cinematics.filter((c) => c.level === config.level);
    questImages = questImages.filter((q) => q.level === config.level);
    textContent = textContent.filter((t) => t.level === config.level);
    log(`Filtered to level: ${config.level}`);
  }

  // Filter by priority
  if (config.minPriority > 0) {
    cinematics = cinematics.filter((c) => (c.priority ?? 0) >= config.minPriority);
    log(`Filtered to priority >= ${config.minPriority}`);
  }

  // Determine what to generate
  const generateVideos = !config.imagesOnly && !config.textOnly;
  const generateImages = !config.videosOnly && !config.textOnly;
  const generateTexts = !config.videosOnly && !config.imagesOnly;

  // Log summary
  log('='.repeat(60));
  log('ASSET GENERATION SUMMARY');
  log('='.repeat(60));
  if (generateVideos) log(`Videos: ${cinematics.length}`);
  if (generateImages) log(`Images: ${portraits.length + questImages.length}`);
  if (generateTexts) log(`Text: ${textContent.length}`);
  log(`Output: ${path.resolve(OUTPUT_DIR)}`);
  log(`Mode: ${config.dryRun ? 'DRY RUN' : 'GENERATE'}`);
  log('='.repeat(60));

  if (config.dryRun) {
    log('\nAssets to generate:');
    if (generateVideos) {
      log('\nVideos:');
      cinematics.forEach((c) => log(`  - ${c.id} (${c.level}, priority: ${c.priority ?? 0})`));
    }
    if (generateImages) {
      log('\nPortraits:');
      portraits.forEach((p) => log(`  - ${p.id} (${p.characterId})`));
      log('\nQuest Images:');
      questImages.forEach((q) => log(`  - ${q.id} (${q.level}, ${q.purpose})`));
    }
    if (generateTexts) {
      log('\nText Content:');
      textContent.forEach((t) => log(`  - ${t.id} (${t.category})`));
    }
    log('\nDry run complete. Use without --dry-run to generate assets.');
    return;
  }

  // Track results
  const results = {
    videos: { success: 0, failed: 0 },
    images: { success: 0, failed: 0 },
    text: { success: 0, failed: 0 },
  };

  // Generate videos
  if (generateVideos && cinematics.length > 0 && ai) {
    log('\n--- Generating Videos ---');
    for (const def of cinematics) {
      const success = await generateVideo(ai, def, config);
      if (success) results.videos.success++;
      else results.videos.failed++;
      await delay(RATE_LIMIT_DELAY);
    }
  }

  // Generate images
  if (generateImages && ai) {
    log('\n--- Generating Portraits ---');
    for (const def of portraits) {
      const success = await generateImage(ai, def, config);
      if (success) results.images.success++;
      else results.images.failed++;
      await delay(RATE_LIMIT_DELAY);
    }

    log('\n--- Generating Quest Images ---');
    for (const def of questImages) {
      const success = await generateImage(ai, def, config);
      if (success) results.images.success++;
      else results.images.failed++;
      await delay(RATE_LIMIT_DELAY);
    }
  }

  // Generate text
  if (generateTexts && textContent.length > 0 && ai) {
    log('\n--- Generating Text Content ---');
    for (const def of textContent) {
      const success = await generateText(ai, def, config);
      if (success) results.text.success++;
      else results.text.failed++;
      await delay(RATE_LIMIT_DELAY / 2);
    }
  }

  // Print results
  log(`\n${'='.repeat(60)}`);
  log('GENERATION COMPLETE');
  log('='.repeat(60));
  log(`Videos:  ${results.videos.success} success, ${results.videos.failed} failed`);
  log(`Images:  ${results.images.success} success, ${results.images.failed} failed`);
  log(`Text:    ${results.text.success} success, ${results.text.failed} failed`);
  log('='.repeat(60));

  const totalFailed = results.videos.failed + results.images.failed + results.text.failed;
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  error('Fatal error:', err);
  process.exit(1);
});
