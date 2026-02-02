#!/usr/bin/env npx tsx
/**
 * download-audio-assets.ts
 *
 * Pre-download script for audio assets from Freesound.org.
 * Run during build to download and process all manifested audio assets.
 *
 * Usage:
 *   npx tsx scripts/download-audio-assets.ts [options]
 *
 * Options:
 *   --dry-run        List assets to download without downloading
 *   --category <c>   Only download assets of a specific category
 *   --verbose        Enable verbose logging
 *   --clear-cache    Clear all cached assets before downloading
 *   --cc0-only       Only download CC0 licensed sounds (safest)
 *   --limit <n>      Limit number of assets to download
 *   --skip-existing  Skip assets that already exist in output directory
 *
 * Environment:
 *   FREESOUND_API_KEY   Freesound API key (required)
 *
 * Output:
 *   Downloads audio to public/audio/ directory
 *   Generates AUDIO_CREDITS.md for attribution
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Import types
import type {
  AudioAssetDef,
  FreesoundLicense,
  FreesoundSearchResult,
  FreesoundSound,
} from '../src/game/ai/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface DownloadConfig {
  dryRun: boolean;
  category: string | null;
  verbose: boolean;
  clearCache: boolean;
  cc0Only: boolean;
  limit: number;
  skipExisting: boolean;
}

const API_BASE_URL = 'https://freesound.org/apiv2';
const OUTPUT_DIR = 'public/audio';
const CREDITS_FILE = 'AUDIO_CREDITS.md';
const RATE_LIMIT_DELAY = 500; // 500ms between requests
const MAX_RETRIES = 3;

// Default fields for search
const DEFAULT_SEARCH_FIELDS = [
  'id',
  'name',
  'tags',
  'license',
  'duration',
  'previews',
  'username',
  'url',
  'avg_rating',
  'num_downloads',
].join(',');

// ============================================================================
// MANIFEST DATA (inline to avoid import issues with Node.js)
// ============================================================================

// Audio asset definitions - duplicated from AudioAssetManifest.ts for Node.js compatibility
const WEAPON_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_pistol_fire',
    type: 'sfx',
    searchQuery: 'pistol gunshot single',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true, fadeOut: 0.1 },
  },
  {
    id: 'sfx_rifle_fire',
    type: 'sfx',
    searchQuery: 'assault rifle burst automatic',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true, fadeOut: 0.05 },
  },
  {
    id: 'sfx_shotgun_fire',
    type: 'sfx',
    searchQuery: 'shotgun blast pump action',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true, fadeOut: 0.15 },
  },
  {
    id: 'sfx_shotgun_pump',
    type: 'sfx',
    searchQuery: 'shotgun pump reload',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_plasma_fire',
    type: 'sfx',
    searchQuery: 'laser plasma energy weapon shot',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true, reverb: true },
  },
  {
    id: 'sfx_grenade_explosion',
    type: 'sfx',
    searchQuery: 'grenade explosion blast',
    filters: { maxDuration: 4, license: 'cc0' },
    processing: { normalize: true, reverb: true },
  },
  {
    id: 'sfx_reload_magazine',
    type: 'sfx',
    searchQuery: 'gun reload magazine insert',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true },
  },
];

const ENEMY_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_alien_screech',
    type: 'sfx',
    searchQuery: 'alien creature screech monster',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true, pitchShift: -3, reverb: true },
  },
  {
    id: 'sfx_alien_growl',
    type: 'sfx',
    searchQuery: 'monster growl aggressive creature',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true, pitchShift: -5 },
  },
  {
    id: 'sfx_alien_death',
    type: 'sfx',
    searchQuery: 'monster death growl creature die',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true, pitchShift: -4, fadeOut: 0.3 },
  },
  {
    id: 'sfx_alien_footstep',
    type: 'sfx',
    searchQuery: 'creature footstep claw',
    filters: { maxDuration: 1, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_queen_roar',
    type: 'sfx',
    searchQuery: 'monster roar deep massive creature',
    filters: { minDuration: 3, maxDuration: 8, license: 'cc0' },
    processing: { normalize: true, pitchShift: -8, reverb: true },
  },
];

const AMBIENCE_SFX: AudioAssetDef[] = [
  {
    id: 'amb_station_hum',
    type: 'ambience',
    searchQuery: 'spaceship interior hum engine room',
    filters: { minDuration: 30, license: 'cc0' },
    processing: { normalize: true, fadeIn: 2, fadeOut: 2 },
  },
  {
    id: 'amb_wind',
    type: 'ambience',
    searchQuery: 'wind howling outdoor desert',
    filters: { minDuration: 30, license: 'cc0' },
    processing: { normalize: true, fadeIn: 3, fadeOut: 3 },
  },
  {
    id: 'amb_cave_drip',
    type: 'ambience',
    searchQuery: 'cave water dripping echo underground',
    filters: { minDuration: 20, license: 'cc0' },
    processing: { normalize: true, reverb: true },
  },
  {
    id: 'amb_ice_crack',
    type: 'sfx',
    searchQuery: 'ice cracking frozen crack',
    filters: { maxDuration: 5, license: 'cc0' },
    processing: { normalize: true, reverb: true },
  },
  {
    id: 'amb_blizzard',
    type: 'ambience',
    searchQuery: 'blizzard snowstorm arctic wind',
    filters: { minDuration: 30, license: 'cc0' },
    processing: { normalize: true, fadeIn: 3, fadeOut: 3 },
  },
  {
    id: 'amb_hive_organic',
    type: 'ambience',
    searchQuery: 'organic alien hive pulsing',
    filters: { minDuration: 20, license: 'cc0' },
    processing: { normalize: true, pitchShift: -2, reverb: true },
  },
];

const UI_SFX: AudioAssetDef[] = [
  {
    id: 'ui_select',
    type: 'sfx',
    searchQuery: 'ui click select interface',
    filters: { maxDuration: 1, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'ui_hover',
    type: 'sfx',
    searchQuery: 'ui hover soft subtle',
    filters: { maxDuration: 0.5, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'ui_confirm',
    type: 'sfx',
    searchQuery: 'success confirmation positive',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'ui_cancel',
    type: 'sfx',
    searchQuery: 'cancel back error negative',
    filters: { maxDuration: 1, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'ui_notification',
    type: 'sfx',
    searchQuery: 'notification alert ping',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
];

const PLAYER_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_footstep_metal',
    type: 'sfx',
    searchQuery: 'footstep metal boot military',
    filters: { maxDuration: 1, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_footstep_dirt',
    type: 'sfx',
    searchQuery: 'footstep dirt gravel outdoor',
    filters: { maxDuration: 1, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_player_hurt',
    type: 'sfx',
    searchQuery: 'male grunt pain impact',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_health_pickup',
    type: 'sfx',
    searchQuery: 'health powerup healing collect',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
];

const VEHICLE_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_buggy_engine',
    type: 'sfx',
    searchQuery: 'offroad vehicle engine running loop',
    filters: { minDuration: 5, maxDuration: 20, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_mech_footstep',
    type: 'sfx',
    searchQuery: 'heavy metal footstep robot mech',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true, pitchShift: -2 },
  },
  {
    id: 'sfx_dropship_engine',
    type: 'sfx',
    searchQuery: 'spacecraft engine thrust hover',
    filters: { minDuration: 5, license: 'cc0' },
    processing: { normalize: true },
  },
];

const MUSIC_STINGERS: AudioAssetDef[] = [
  {
    id: 'music_victory',
    type: 'music',
    searchQuery: 'victory fanfare orchestral triumphant',
    filters: { maxDuration: 10, license: 'cc0' },
    processing: { normalize: true, fadeOut: 1 },
  },
  {
    id: 'music_defeat',
    type: 'music',
    searchQuery: 'defeat sad orchestral somber',
    filters: { maxDuration: 8, license: 'cc0' },
    processing: { normalize: true, fadeOut: 1 },
  },
  {
    id: 'music_tension_rise',
    type: 'music',
    searchQuery: 'tension rising suspense horror',
    filters: { maxDuration: 10, license: 'cc0' },
    processing: { normalize: true },
  },
];

const COLLECTIBLE_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_skull_pickup',
    type: 'sfx',
    searchQuery: 'mystical pickup collect magical',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true, reverb: true },
  },
  {
    id: 'sfx_secret_found',
    type: 'sfx',
    searchQuery: 'secret discover hidden reveal',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true },
  },
];

const ENVIRONMENT_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_door_open_metal',
    type: 'sfx',
    searchQuery: 'metal door open mechanical sci-fi',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_debris_fall',
    type: 'sfx',
    searchQuery: 'debris falling rocks rubble',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_glass_break',
    type: 'sfx',
    searchQuery: 'glass break shatter',
    filters: { maxDuration: 2, license: 'cc0' },
    processing: { normalize: true },
  },
  {
    id: 'sfx_steam_release',
    type: 'sfx',
    searchQuery: 'steam release hiss pipe',
    filters: { maxDuration: 3, license: 'cc0' },
    processing: { normalize: true },
  },
];

const ALL_AUDIO_ASSETS: AudioAssetDef[] = [
  ...WEAPON_SFX,
  ...ENEMY_SFX,
  ...AMBIENCE_SFX,
  ...UI_SFX,
  ...PLAYER_SFX,
  ...VEHICLE_SFX,
  ...MUSIC_STINGERS,
  ...COLLECTIBLE_SFX,
  ...ENVIRONMENT_SFX,
];

const CATEGORY_MAP: Record<string, AudioAssetDef[]> = {
  weapons: WEAPON_SFX,
  enemies: ENEMY_SFX,
  ambience: AMBIENCE_SFX,
  ui: UI_SFX,
  player: PLAYER_SFX,
  vehicles: VEHICLE_SFX,
  music: MUSIC_STINGERS,
  collectibles: COLLECTIBLE_SFX,
  environment: ENVIRONMENT_SFX,
};

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

function parseArgs(): DownloadConfig {
  const args = process.argv.slice(2);
  const config: DownloadConfig = {
    dryRun: false,
    category: null,
    verbose: false,
    clearCache: false,
    cc0Only: false,
    limit: 0,
    skipExisting: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--category':
        config.category = args[++i];
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--clear-cache':
        config.clearCache = true;
        break;
      case '--cc0-only':
        config.cc0Only = true;
        break;
      case '--limit':
        config.limit = parseInt(args[++i], 10);
        break;
      case '--skip-existing':
        config.skipExisting = true;
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
download-audio-assets.ts - Download audio assets from Freesound.org

Usage:
  npx tsx scripts/download-audio-assets.ts [options]

Options:
  --dry-run        List assets to download without downloading
  --category <c>   Only download assets of a specific category
                   Categories: weapons, enemies, ambience, ui, player, vehicles, music, collectibles, environment
  --verbose        Enable verbose logging
  --clear-cache    Clear all cached assets before downloading
  --cc0-only       Only download CC0 licensed sounds (safest for commercial use)
  --limit <n>      Limit number of assets to download
  --skip-existing  Skip assets that already exist in output directory
  --help           Show this help message

Environment:
  FREESOUND_API_KEY   Freesound API key (required, get from https://freesound.org/apiv2/apply/)

Examples:
  npx tsx scripts/download-audio-assets.ts --dry-run
  npx tsx scripts/download-audio-assets.ts --category weapons --cc0-only
  npx tsx scripts/download-audio-assets.ts --limit 10 --verbose
  npx tsx scripts/download-audio-assets.ts --skip-existing
`);
}

function ensureOutputDir(): void {
  const dir = path.resolve(process.cwd(), OUTPUT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created output directory: ${dir}`);
  }

  // Create subdirectories for each category
  const subdirs = ['sfx', 'ambience', 'music'];
  for (const subdir of subdirs) {
    const subdirPath = path.join(dir, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }
}

function parseLicense(licenseUrl: string): FreesoundLicense {
  if (licenseUrl.includes('publicdomain') || licenseUrl.includes('cc0')) {
    return 'cc0';
  }
  if (licenseUrl.includes('by-nc')) {
    return 'cc-by-nc';
  }
  if (licenseUrl.includes('by-sa')) {
    return 'cc-by-sa';
  }
  if (licenseUrl.includes('/by/')) {
    return 'cc-by';
  }
  return 'other';
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return entries.join('&');
}

// ============================================================================
// FREESOUND API FUNCTIONS
// ============================================================================

let lastRequestTime = 0;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await delay(RATE_LIMIT_DELAY - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

async function apiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  apiKey: string
): Promise<T> {
  await enforceRateLimit();

  const queryString = buildQueryString({ ...params, token: apiKey });
  const url = `${API_BASE_URL}${endpoint}?${queryString}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          log('Rate limited by Freesound API, waiting...');
          await delay(5000);
          continue;
        }
        throw new Error(`Freesound API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        log(`API request failed, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        await delay(1000 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error('API request failed');
}

async function searchSounds(
  query: string,
  apiKey: string,
  options: AudioAssetDef['filters'] = {}
): Promise<FreesoundSearchResult> {
  const filters: string[] = [];

  if (options.minDuration !== undefined) {
    filters.push(`duration:[${options.minDuration} TO *]`);
  }

  if (options.maxDuration !== undefined) {
    filters.push(`duration:[* TO ${options.maxDuration}]`);
  }

  if (options.tags && options.tags.length > 0) {
    filters.push(`tag:(${options.tags.join(' OR ')})`);
  }

  if (options.license === 'cc0') {
    filters.push('license:"Creative Commons 0"');
  }

  const params: Record<string, string | number | undefined> = {
    query,
    page_size: 5,
    fields: DEFAULT_SEARCH_FIELDS,
  };

  if (filters.length > 0) {
    params.filter = filters.join(' ');
  }

  params.sort = 'score';

  const response = await apiRequest<{
    count: number;
    next: string | null;
    previous: string | null;
    results: FreesoundSound[];
  }>('/search/text/', params, apiKey);

  return {
    count: response.count,
    next: response.next,
    previous: response.previous,
    results: response.results.map((sound) => ({
      ...sound,
      license: parseLicense(sound.license as string),
    })),
  };
}

async function downloadSound(
  sound: FreesoundSound,
  outputPath: string,
  apiKey: string,
  config: DownloadConfig
): Promise<boolean> {
  try {
    // Get preview URL (prefer high quality OGG)
    const previews = sound.previews as
      | {
          'preview-hq-mp3'?: string;
          'preview-hq-ogg'?: string;
          'preview-lq-mp3'?: string;
        }
      | undefined;

    let downloadUrl: string | undefined;
    let ext = 'mp3';

    if (previews) {
      if (previews['preview-hq-ogg']) {
        downloadUrl = previews['preview-hq-ogg'];
        ext = 'ogg';
      } else if (previews['preview-hq-mp3']) {
        downloadUrl = previews['preview-hq-mp3'];
        ext = 'mp3';
      } else if (previews['preview-lq-mp3']) {
        downloadUrl = previews['preview-lq-mp3'];
        ext = 'mp3';
      }
    }

    if (!downloadUrl) {
      throw new Error('No preview URL available');
    }

    // Add API key to download URL
    const authUrl = downloadUrl.includes('?')
      ? `${downloadUrl}&token=${apiKey}`
      : `${downloadUrl}?token=${apiKey}`;

    await enforceRateLimit();
    const response = await fetch(authUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const finalPath = outputPath.replace(/\.[^.]+$/, `.${ext}`);
    fs.writeFileSync(finalPath, Buffer.from(audioBuffer));

    if (config.verbose) {
      log(`  Downloaded: ${finalPath} (${Math.round(audioBuffer.byteLength / 1024)}KB)`);
    }

    return true;
  } catch (err) {
    error(`Download failed:`, err);
    return false;
  }
}

// ============================================================================
// CREDITS GENERATION
// ============================================================================

interface CreditEntry {
  id: string;
  freesoundId: number;
  name: string;
  author: string;
  license: FreesoundLicense;
  url: string;
}

function generateCreditsMarkdown(credits: CreditEntry[]): string {
  let markdown = '# Audio Credits\n\n';
  markdown +=
    'This game uses audio from [Freesound.org](https://freesound.org). ' +
    'All sounds are used under Creative Commons licenses.\n\n';

  // Group by license
  const byLicense: Record<string, CreditEntry[]> = {};
  for (const credit of credits) {
    const license = credit.license || 'unknown';
    if (!byLicense[license]) {
      byLicense[license] = [];
    }
    byLicense[license].push(credit);
  }

  const licenseNames: Record<string, string> = {
    cc0: 'Public Domain (CC0)',
    'cc-by': 'Attribution (CC BY)',
    'cc-by-nc': 'Attribution-NonCommercial (CC BY-NC)',
    'cc-by-sa': 'Attribution-ShareAlike (CC BY-SA)',
    other: 'Other Licenses',
  };

  for (const [license, sounds] of Object.entries(byLicense)) {
    markdown += `## ${licenseNames[license] || license}\n\n`;

    for (const sound of sounds) {
      markdown += `- **${sound.name}** by [${sound.author}](${sound.url}) - used as \`${sound.id}\`\n`;
    }

    markdown += '\n';
  }

  markdown += '---\n\n';
  markdown += `Generated on ${new Date().toISOString()}\n`;

  return markdown;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  // Check for API key
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey && !config.dryRun) {
    error('FREESOUND_API_KEY environment variable is required');
    error('Get your API key from: https://freesound.org/apiv2/apply/');
    error('Set FREESOUND_API_KEY or use --dry-run to preview assets');
    process.exit(1);
  }

  // Ensure output directory exists
  ensureOutputDir();

  // Get assets to download
  let assets: AudioAssetDef[] = [];

  if (config.category) {
    if (!CATEGORY_MAP[config.category]) {
      error(`Unknown category: ${config.category}`);
      error(`Valid categories: ${Object.keys(CATEGORY_MAP).join(', ')}`);
      process.exit(1);
    }
    assets = CATEGORY_MAP[config.category];
    log(`Filtering to category: ${config.category}`);
  } else {
    assets = ALL_AUDIO_ASSETS;
  }

  // Filter to CC0 only if requested
  if (config.cc0Only) {
    assets = assets.filter((a) => a.filters?.license === 'cc0');
    log('Filtering to CC0 licensed sounds only');
  }

  // Apply limit
  if (config.limit > 0) {
    assets = assets.slice(0, config.limit);
    log(`Limiting to ${config.limit} assets`);
  }

  // Skip existing if requested
  if (config.skipExisting) {
    const existingAssets: string[] = [];
    assets = assets.filter((a) => {
      const subdir = a.type === 'ambience' ? 'ambience' : a.type === 'music' ? 'music' : 'sfx';
      const outputDir = path.resolve(process.cwd(), OUTPUT_DIR, subdir);

      // Check for any extension
      const extensions = ['ogg', 'mp3', 'wav'];
      for (const ext of extensions) {
        const filePath = path.join(outputDir, `${a.id}.${ext}`);
        if (fs.existsSync(filePath)) {
          existingAssets.push(a.id);
          return false;
        }
      }
      return true;
    });

    if (existingAssets.length > 0) {
      log(`Skipping ${existingAssets.length} existing assets`);
    }
  }

  // Log summary
  log('='.repeat(60));
  log('AUDIO ASSET DOWNLOAD');
  log('='.repeat(60));
  log(`Total assets: ${assets.length}`);
  log(`Output: ${path.resolve(OUTPUT_DIR)}`);
  log(`Mode: ${config.dryRun ? 'DRY RUN' : 'DOWNLOAD'}`);
  log('='.repeat(60));

  // Dry run - just list assets
  if (config.dryRun) {
    log('\nAssets to download:');
    for (const asset of assets) {
      const filterInfo = [];
      if (asset.filters?.maxDuration) filterInfo.push(`max ${asset.filters.maxDuration}s`);
      if (asset.filters?.minDuration) filterInfo.push(`min ${asset.filters.minDuration}s`);
      if (asset.filters?.license) filterInfo.push(asset.filters.license);

      log(`  - ${asset.id} (${asset.type})`);
      log(`    Query: "${asset.searchQuery}"`);
      if (filterInfo.length > 0) {
        log(`    Filters: ${filterInfo.join(', ')}`);
      }
    }
    log('\nDry run complete. Use without --dry-run to download assets.');
    return;
  }

  // Download assets
  const results = {
    success: 0,
    failed: 0,
    notFound: 0,
  };

  const credits: CreditEntry[] = [];

  log('\n--- Downloading Audio Assets ---');

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    log(`[${i + 1}/${assets.length}] ${asset.id}`);

    try {
      // Search for the sound
      const searchResults = await searchSounds(asset.searchQuery, apiKey!, asset.filters);

      if (searchResults.results.length === 0) {
        log(`  No results found for query: "${asset.searchQuery}"`);
        results.notFound++;
        continue;
      }

      // Pick the best result
      const sound = searchResults.results[0];
      log(`  Found: "${sound.name}" by ${sound.username} (ID: ${sound.id})`);

      // Determine output path
      const subdir =
        asset.type === 'ambience' ? 'ambience' : asset.type === 'music' ? 'music' : 'sfx';
      const outputPath = path.join(OUTPUT_DIR, subdir, `${asset.id}.ogg`);

      // Download the sound
      const success = await downloadSound(sound, outputPath, apiKey!, config);

      if (success) {
        results.success++;
        credits.push({
          id: asset.id,
          freesoundId: sound.id,
          name: sound.name,
          author: sound.username,
          license: sound.license as FreesoundLicense,
          url: sound.url,
        });
      } else {
        results.failed++;
      }
    } catch (err) {
      error(`Failed to process ${asset.id}:`, err);
      results.failed++;
    }
  }

  // Generate credits file
  if (credits.length > 0) {
    const creditsMarkdown = generateCreditsMarkdown(credits);
    const creditsPath = path.resolve(process.cwd(), OUTPUT_DIR, CREDITS_FILE);
    fs.writeFileSync(creditsPath, creditsMarkdown, 'utf-8');
    log(`\nGenerated credits file: ${creditsPath}`);
  }

  // Print results
  log(`\n${'='.repeat(60)}`);
  log('DOWNLOAD COMPLETE');
  log('='.repeat(60));
  log(`Success:   ${results.success}`);
  log(`Failed:    ${results.failed}`);
  log(`Not Found: ${results.notFound}`);
  log('='.repeat(60));

  if (results.failed > 0 || results.notFound > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  error('Fatal error:', err);
  process.exit(1);
});
