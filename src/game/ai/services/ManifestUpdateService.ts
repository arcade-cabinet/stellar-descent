/**
 * ManifestUpdateService - AI-Powered Manifest Management
 *
 * Uses Gemini Pro structured output to analyze, validate, and update
 * asset manifests when new assets are generated.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { getLogger } from '../../core/Logger';
import {
  ASSET_DESTINATIONS,
  type AssetDestinationType,
  type AudioAssetMetadata,
  type ImageAssetMetadata,
  type LevelAssetManifest,
  LevelAssetManifestSchema,
  type ManifestUpdateResponse,
  ManifestUpdateResponseSchema,
  type SharedAssetManifest,
  SharedAssetManifestSchema,
  type VideoAssetMetadata,
} from '../schemas/AssetManifestSchemas';

const log = getLogger('ManifestUpdateService');

// ============================================================================
// CONSTANTS
// ============================================================================

const MANIFEST_DIR = 'public/assets/manifests';
const ASSETS_DIR = 'public/assets';
const SCHEMA_VERSION = '1.0.0';

const GEMINI_MODEL = 'gemini-3-pro-preview';

// ============================================================================
// MANIFEST UPDATE SERVICE
// ============================================================================

export class ManifestUpdateService {
  private ai: GoogleGenAI | null = null;
  private manifestCache: Map<string, LevelAssetManifest | SharedAssetManifest> = new Map();

  constructor(private apiKey?: string) {}

  /**
   * Initialize the service with API key
   */
  async initialize(): Promise<boolean> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      log.warn('GEMINI_API_KEY not set - manifest analysis disabled');
      return false;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey: key });
      log.info('ManifestUpdateService initialized');
      return true;
    } catch (error) {
      log.error('Failed to initialize ManifestUpdateService:', error);
      return false;
    }
  }

  // ==========================================================================
  // ASSET PATH RESOLUTION
  // ==========================================================================

  /**
   * Resolve the destination path for an asset based on its type and metadata
   */
  resolveAssetPath(
    destinationType: AssetDestinationType,
    variables: Record<string, string>
  ): string {
    const dest = ASSET_DESTINATIONS[destinationType];

    let subDir: string = dest.subDirPattern;
    let filename: string = dest.filenamePattern;

    // Replace variables in patterns
    for (const [key, value] of Object.entries(variables)) {
      subDir = subDir.replace(`{${key}}`, value);
      filename = filename.replace(`{${key}}`, value);
    }

    const relativePath = path.join(dest.baseDir, subDir, filename);
    return relativePath;
  }

  /**
   * Get absolute path for an asset
   */
  getAbsoluteAssetPath(relativePath: string): string {
    return path.join(process.cwd(), ASSETS_DIR, relativePath);
  }

  /**
   * Ensure directory exists for asset path
   */
  ensureAssetDirectory(relativePath: string): void {
    const dir = path.dirname(this.getAbsoluteAssetPath(relativePath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.debug(`Created directory: ${dir}`);
    }
  }

  // ==========================================================================
  // MANIFEST LOADING/SAVING
  // ==========================================================================

  /**
   * Get the manifest file path for a level
   */
  private getLevelManifestPath(levelId: string): string {
    return path.join(process.cwd(), MANIFEST_DIR, `${levelId}.manifest.json`);
  }

  /**
   * Get the shared manifest file path
   */
  private getSharedManifestPath(): string {
    return path.join(process.cwd(), MANIFEST_DIR, 'shared.manifest.json');
  }

  /**
   * Load a level manifest (creates empty if doesn't exist)
   */
  async loadLevelManifest(levelId: string): Promise<LevelAssetManifest> {
    const cacheKey = `level:${levelId}`;
    if (this.manifestCache.has(cacheKey)) {
      return this.manifestCache.get(cacheKey) as LevelAssetManifest;
    }

    const manifestPath = this.getLevelManifestPath(levelId);

    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = LevelAssetManifestSchema.parse(parsed);
        this.manifestCache.set(cacheKey, validated);
        return validated;
      } catch (error) {
        log.warn(`Failed to parse manifest for ${levelId}, creating new:`, error);
      }
    }

    // Create empty manifest
    const emptyManifest: LevelAssetManifest = {
      levelId: levelId as LevelAssetManifest['levelId'],
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      loadingScreens: [],
      briefingImages: [],
      audio: [],
      textContent: [],
    };

    this.manifestCache.set(cacheKey, emptyManifest);
    return emptyManifest;
  }

  /**
   * Load the shared manifest (creates empty if doesn't exist)
   */
  async loadSharedManifest(): Promise<SharedAssetManifest> {
    const cacheKey = 'shared';
    if (this.manifestCache.has(cacheKey)) {
      return this.manifestCache.get(cacheKey) as SharedAssetManifest;
    }

    const manifestPath = this.getSharedManifestPath();

    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = SharedAssetManifestSchema.parse(parsed);
        this.manifestCache.set(cacheKey, validated);
        return validated;
      } catch (error) {
        log.warn('Failed to parse shared manifest, creating new:', error);
      }
    }

    // Create empty manifest
    const emptyManifest: SharedAssetManifest = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      portraits: {},
      uiAssets: [],
      splashVideos: [],
      sharedAudio: [],
      sharedText: [],
    };

    this.manifestCache.set(cacheKey, emptyManifest);
    return emptyManifest;
  }

  /**
   * Save a level manifest
   */
  async saveLevelManifest(levelId: string, manifest: LevelAssetManifest): Promise<void> {
    const manifestPath = this.getLevelManifestPath(levelId);

    // Ensure directory exists
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Update timestamp
    manifest.updatedAt = new Date().toISOString();

    // Validate before saving
    const validated = LevelAssetManifestSchema.parse(manifest);

    fs.writeFileSync(manifestPath, JSON.stringify(validated, null, 2));
    this.manifestCache.set(`level:${levelId}`, validated);
    log.info(`Saved manifest: ${manifestPath}`);
  }

  /**
   * Save the shared manifest
   */
  async saveSharedManifest(manifest: SharedAssetManifest): Promise<void> {
    const manifestPath = this.getSharedManifestPath();

    // Ensure directory exists
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Update timestamp
    manifest.updatedAt = new Date().toISOString();

    // Validate before saving
    const validated = SharedAssetManifestSchema.parse(manifest);

    fs.writeFileSync(manifestPath, JSON.stringify(validated, null, 2));
    this.manifestCache.set('shared', validated);
    log.info(`Saved manifest: ${manifestPath}`);
  }

  // ==========================================================================
  // ASSET REGISTRATION
  // ==========================================================================

  /**
   * Register a video asset in the appropriate manifest
   */
  async registerVideoAsset(
    asset: VideoAssetMetadata,
    options: {
      isIntroCinematic?: boolean;
      isOutroCinematic?: boolean;
      isSplash?: boolean;
    } = {}
  ): Promise<void> {
    if (options.isSplash) {
      const manifest = await this.loadSharedManifest();
      manifest.splashVideos.push(asset);
      await this.saveSharedManifest(manifest);
    } else if (asset.levelId) {
      const manifest = await this.loadLevelManifest(asset.levelId);
      if (options.isIntroCinematic) {
        manifest.introCinematic = asset;
      } else if (options.isOutroCinematic) {
        manifest.outroCinematic = asset;
      }
      await this.saveLevelManifest(asset.levelId, manifest);
    }
  }

  /**
   * Register an image asset in the appropriate manifest
   */
  async registerImageAsset(
    asset: ImageAssetMetadata,
    options: {
      isPortrait?: boolean;
      isUI?: boolean;
      isLoadingScreen?: boolean;
      isBriefing?: boolean;
    } = {}
  ): Promise<void> {
    if (options.isPortrait && asset.characterId) {
      const manifest = await this.loadSharedManifest();
      if (!manifest.portraits[asset.characterId]) {
        manifest.portraits[asset.characterId] = [];
      }
      manifest.portraits[asset.characterId].push(asset);
      await this.saveSharedManifest(manifest);
    } else if (options.isUI) {
      const manifest = await this.loadSharedManifest();
      manifest.uiAssets.push(asset);
      await this.saveSharedManifest(manifest);
    } else if (asset.levelId) {
      const manifest = await this.loadLevelManifest(asset.levelId);
      if (options.isLoadingScreen) {
        manifest.loadingScreens.push(asset);
      } else if (options.isBriefing) {
        manifest.briefingImages.push(asset);
      }
      await this.saveLevelManifest(asset.levelId, manifest);
    }
  }

  /**
   * Register an audio asset in the appropriate manifest
   */
  async registerAudioAsset(asset: AudioAssetMetadata): Promise<void> {
    if (asset.levelId) {
      const manifest = await this.loadLevelManifest(asset.levelId);
      manifest.audio.push(asset);
      await this.saveLevelManifest(asset.levelId, manifest);
    } else {
      const manifest = await this.loadSharedManifest();
      manifest.sharedAudio.push(asset);
      await this.saveSharedManifest(manifest);
    }
  }

  // ==========================================================================
  // AI-POWERED ANALYSIS
  // ==========================================================================

  /**
   * Use Gemini to analyze an asset and suggest manifest updates
   */
  async analyzeAsset(
    asset: VideoAssetMetadata | ImageAssetMetadata | AudioAssetMetadata,
    existingManifest: LevelAssetManifest | SharedAssetManifest
  ): Promise<ManifestUpdateResponse> {
    if (!this.ai) {
      return {
        valid: true,
        errors: [],
        warnings: ['AI analysis unavailable - manifest update will proceed without validation'],
        suggestions: [],
      };
    }

    try {
      const prompt = `You are a game asset manifest manager. Analyze the following asset and provide structured feedback.

EXISTING MANIFEST:
${JSON.stringify(existingManifest, null, 2)}

NEW ASSET TO ADD:
${JSON.stringify(asset, null, 2)}

Analyze for:
1. Naming consistency with existing assets
2. Path structure correctness
3. Metadata completeness
4. Potential duplicates
5. Style consistency (if applicable)

Respond with a JSON object matching this schema:
{
  "valid": boolean,
  "errors": string[],
  "warnings": string[],
  "suggestions": [{ "field": string, "current": string, "suggested": string, "reason": string }]
}`;

      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        return ManifestUpdateResponseSchema.parse(parsed);
      }

      return { valid: true, errors: [], warnings: [], suggestions: [] };
    } catch (error) {
      log.warn('AI analysis failed:', error);
      return {
        valid: true,
        errors: [],
        warnings: ['AI analysis failed - proceeding without validation'],
        suggestions: [],
      };
    }
  }

  /**
   * Clear the manifest cache
   */
  clearCache(): void {
    this.manifestCache.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let serviceInstance: ManifestUpdateService | null = null;

export function getManifestService(): ManifestUpdateService {
  if (!serviceInstance) {
    serviceInstance = new ManifestUpdateService();
  }
  return serviceInstance;
}

export async function initializeManifestService(): Promise<boolean> {
  const service = getManifestService();
  return service.initialize();
}
