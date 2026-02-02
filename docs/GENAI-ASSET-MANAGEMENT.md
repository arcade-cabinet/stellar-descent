# GenAI Asset Management Architecture

**Document Version:** 1.0.0
**Date:** 2026-01-31
**Status:** Design Document

---

## Executive Summary

This document defines a comprehensive architecture for managing AI-generated assets in Stellar Descent, including:
1. VCR-style HTTP recording for deterministic testing
2. Directory structure for organizing generated assets
3. Zod schema definitions for manifest validation
4. Structured output integration with Gemini Pro for manifest updates

---

## 1. VCR Testing Package Recommendation

### Recommendation: **MSW (Mock Service Worker)** + **Polly.JS** Hybrid

After evaluating the major options, I recommend a hybrid approach:

| Package | Use Case | Why |
|---------|----------|-----|
| **MSW** | Unit/integration tests | Modern API, works with Vitest, browser+Node.js |
| **Polly.JS** | Recording actual API responses | Native VCR recording, HAR format, deterministic replay |

### Comparison Matrix

| Feature | MSW | Nock | Polly.JS |
|---------|-----|------|----------|
| Vitest Support | Excellent | Good | Good |
| Browser Support | Native | None | Native |
| Node.js Support | Native | Native | Native |
| VCR Recording | Manual | Manual | **Automatic** |
| GraphQL Support | First-class | Limited | Yes |
| HAR Format | No | No | **Yes** |
| Active Maintenance | Very Active | Active | Moderate |

### Why This Hybrid Approach

1. **MSW for Unit Tests**: Fast, doesn't require network, great Vitest integration
2. **Polly.JS for Integration Tests**: Records real Gemini/Freesound responses for replay
3. **HAR Files**: Industry-standard format, can be inspected and edited

### Installation

```bash
# Primary: MSW for mocking
pnpm add -D msw

# Secondary: Polly.JS for VCR recording
pnpm add -D @pollyjs/core @pollyjs/adapter-node-http @pollyjs/persister-fs
```

### Package Versions (as of January 2026)

```json
{
  "devDependencies": {
    "msw": "^2.7.0",
    "@pollyjs/core": "^6.0.6",
    "@pollyjs/adapter-node-http": "^6.0.6",
    "@pollyjs/persister-fs": "^6.0.6"
  }
}
```

---

## 2. Asset Organization Structure

### Complete Directory Tree

```
public/
├── assets/
│   ├── videos/
│   │   ├── cinematics/
│   │   │   ├── shared/                    # Cross-level cinematics
│   │   │   │   ├── game_intro.mp4
│   │   │   │   └── credits.mp4
│   │   │   ├── anchor_station/
│   │   │   │   └── intro.mp4
│   │   │   ├── landfall/
│   │   │   │   └── intro.mp4
│   │   │   ├── canyon_run/
│   │   │   │   └── intro.mp4
│   │   │   ├── fob_delta/
│   │   │   │   └── intro.mp4
│   │   │   ├── brothers_in_arms/
│   │   │   │   └── intro.mp4
│   │   │   ├── southern_ice/
│   │   │   │   └── intro.mp4
│   │   │   ├── the_breach/
│   │   │   │   ├── intro.mp4
│   │   │   │   └── queen_reveal.mp4
│   │   │   ├── hive_assault/
│   │   │   │   └── intro.mp4
│   │   │   ├── extraction/
│   │   │   │   └── intro.mp4
│   │   │   └── final_escape/
│   │   │       ├── intro.mp4
│   │   │       └── ending.mp4
│   │   └── splash/
│   │       ├── logo_animation.mp4
│   │       └── studio_intro.mp4
│   │
│   ├── images/
│   │   ├── portraits/
│   │   │   ├── cole/
│   │   │   │   ├── neutral.png
│   │   │   │   ├── combat.png
│   │   │   │   ├── injured.png
│   │   │   │   └── determined.png
│   │   │   ├── marcus/
│   │   │   │   ├── neutral.png
│   │   │   │   ├── injured.png
│   │   │   │   └── combat.png
│   │   │   ├── athena/
│   │   │   │   ├── normal.png
│   │   │   │   └── alert.png
│   │   │   ├── reyes/
│   │   │   │   └── neutral.png
│   │   │   └── phoenix/
│   │   │       └── neutral.png
│   │   │
│   │   ├── quest/
│   │   │   ├── loading_screens/
│   │   │   │   ├── act1.png
│   │   │   │   ├── act2.png
│   │   │   │   ├── act3.png
│   │   │   │   └── act4.png
│   │   │   ├── briefings/
│   │   │   │   ├── landfall.png
│   │   │   │   ├── the_breach.png
│   │   │   │   └── hive_assault.png
│   │   │   └── achievements/
│   │   │       ├── survivor.png
│   │   │       ├── queen_slayer.png
│   │   │       └── brothers_reunited.png
│   │   │
│   │   └── ui/
│   │       ├── backgrounds/
│   │       │   ├── main_menu.png
│   │       │   └── pause_overlay.png
│   │       ├── buttons/
│   │       │   └── (existing button assets)
│   │       └── icons/
│   │           ├── weapons/
│   │           └── abilities/
│   │
│   └── audio/
│       ├── sfx/
│       │   ├── weapons/
│       │   │   ├── pistol_fire.wav
│       │   │   ├── rifle_fire.wav
│       │   │   └── shotgun_fire.wav
│       │   ├── enemies/
│       │   │   ├── alien_screech.wav
│       │   │   └── queen_roar.wav
│       │   ├── player/
│       │   │   ├── footstep_metal.wav
│       │   │   └── player_hurt.wav
│       │   ├── ui/
│       │   │   ├── select.wav
│       │   │   └── confirm.wav
│       │   └── environment/
│       │       ├── door_open.wav
│       │       └── debris_fall.wav
│       │
│       ├── music/
│       │   ├── stingers/
│       │   │   ├── victory.wav
│       │   │   ├── defeat.wav
│       │   │   └── boss_intro.wav
│       │   └── tracks/
│       │       ├── menu_theme.wav
│       │       └── combat_loop.wav
│       │
│       └── ambience/
│           ├── station/
│           │   ├── hum.wav
│           │   └── alarm.wav
│           ├── outdoor/
│           │   ├── wind.wav
│           │   └── dust_storm.wav
│           ├── cave/
│           │   ├── drip.wav
│           │   └── rumble.wav
│           ├── ice/
│           │   ├── blizzard.wav
│           │   └── crack.wav
│           └── hive/
│               ├── organic.wav
│               └── breathing.wav
│
├── generated/                             # AI-generated assets (gitignored)
│   ├── images/
│   ├── videos/
│   └── text/
│
└── manifests/                             # Asset manifests (tracked in git)
    ├── visual-assets.manifest.json
    ├── audio-assets.manifest.json
    └── generated-assets.manifest.json
```

### Naming Conventions

| Asset Type | Pattern | Example |
|------------|---------|---------|
| Cinematics | `{level_id}/intro.mp4` | `anchor_station/intro.mp4` |
| Portraits | `{character_id}/{emotion}.png` | `cole/combat.png` |
| Quest Images | `{category}/{asset_id}.png` | `achievements/queen_slayer.png` |
| SFX | `{category}/{asset_id}.wav` | `weapons/rifle_fire.wav` |
| Ambience | `{environment}/{asset_id}.wav` | `station/alarm.wav` |

---

## 3. Zod Schema Definitions

### File: `src/game/ai/schemas/AssetManifestSchemas.ts`

```typescript
/**
 * Zod Schema Definitions for GenAI Asset Manifests
 *
 * These schemas provide runtime validation for:
 * - Generated asset metadata
 * - Level-specific asset manifests
 * - Shared asset manifests
 * - Gemini structured output responses
 */

import { z } from 'zod';

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Valid aspect ratios for generated media
 */
export const AspectRatioSchema = z.enum([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
]);

/**
 * Image resolution tiers
 */
export const ImageResolutionSchema = z.enum(['1K', '2K', '4K']);

/**
 * Visual style presets for consistent aesthetics
 */
export const VisualStyleSchema = z.enum([
  'cinematic_scifi',
  'horror_scifi',
  'military_tactical',
  'alien_organic',
  'frozen_wasteland',
  'industrial_decay',
  'space_station',
  'portrait_realistic',
]);

/**
 * Level identifiers (must match LevelId type)
 */
export const LevelIdSchema = z.enum([
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
]);

/**
 * Audio asset type categories
 */
export const AudioAssetTypeSchema = z.enum(['sfx', 'ambience', 'music', 'voice']);

/**
 * Freesound license types
 */
export const FreesoundLicenseSchema = z.enum(['cc0', 'cc-by', 'cc-by-nc', 'cc-by-sa', 'other']);

// ============================================================================
// GENERATED ASSET METADATA
// ============================================================================

/**
 * Base metadata for any generated asset
 */
export const GeneratedAssetMetadataSchema = z.object({
  /** Unique asset identifier */
  id: z.string().min(1),
  /** File path relative to public/ */
  path: z.string().min(1),
  /** AI model used for generation */
  model: z.string(),
  /** SHA-256 hash of the generation prompt */
  promptHash: z.string().length(64),
  /** ISO 8601 timestamp of generation */
  generatedAt: z.string().datetime(),
  /** Generation duration in milliseconds */
  generationTimeMs: z.number().positive().optional(),
  /** File size in bytes */
  fileSizeBytes: z.number().positive().optional(),
  /** MIME type of the generated file */
  mimeType: z.string().optional(),
  /** Whether this is a placeholder asset */
  isPlaceholder: z.boolean().default(false),
});

export type GeneratedAssetMetadata = z.infer<typeof GeneratedAssetMetadataSchema>;

/**
 * Video-specific metadata
 */
export const VideoAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('video'),
  /** Video duration in seconds */
  durationSeconds: z.number().positive(),
  /** Aspect ratio */
  aspectRatio: z.enum(['16:9', '21:9']),
  /** Video resolution (e.g., "1920x1080") */
  resolution: z.string().regex(/^\d+x\d+$/),
  /** Whether video has audio track */
  hasAudio: z.boolean().default(true),
});

export type VideoAssetMetadata = z.infer<typeof VideoAssetMetadataSchema>;

/**
 * Image-specific metadata
 */
export const ImageAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('image'),
  /** Image width in pixels */
  width: z.number().positive(),
  /** Image height in pixels */
  height: z.number().positive(),
  /** Aspect ratio */
  aspectRatio: AspectRatioSchema,
  /** Image format */
  format: z.enum(['png', 'jpg', 'webp']),
});

export type ImageAssetMetadata = z.infer<typeof ImageAssetMetadataSchema>;

/**
 * Text-specific metadata
 */
export const TextAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('text'),
  /** Character count */
  charCount: z.number().nonnegative(),
  /** Token count (if available) */
  tokenCount: z.number().nonnegative().optional(),
  /** Content category */
  category: z.enum(['dialogue', 'audio_log', 'briefing', 'lore']),
});

export type TextAssetMetadata = z.infer<typeof TextAssetMetadataSchema>;

/**
 * Audio-specific metadata (for Freesound downloads)
 */
export const AudioAssetMetadataSchema = GeneratedAssetMetadataSchema.extend({
  type: z.literal('audio'),
  /** Freesound sound ID */
  freesoundId: z.number().positive(),
  /** Duration in seconds */
  durationSeconds: z.number().positive(),
  /** Sample rate in Hz */
  sampleRate: z.number().positive(),
  /** License type */
  license: FreesoundLicenseSchema,
  /** Original uploader username */
  author: z.string(),
  /** Attribution text (required for cc-by) */
  attribution: z.string().optional(),
});

export type AudioAssetMetadata = z.infer<typeof AudioAssetMetadataSchema>;

/**
 * Union of all asset metadata types
 */
export const AssetMetadataSchema = z.discriminatedUnion('type', [
  VideoAssetMetadataSchema,
  ImageAssetMetadataSchema,
  TextAssetMetadataSchema,
  AudioAssetMetadataSchema,
]);

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

// ============================================================================
// LEVEL-SPECIFIC ASSET MANIFEST
// ============================================================================

/**
 * Cinematic definition for a level
 */
export const CinematicDefSchema = z.object({
  id: z.string().min(1),
  type: z.literal('video'),
  prompt: z.string().min(10),
  duration: z.number().min(5).max(60),
  style: VisualStyleSchema,
  aspectRatio: z.enum(['16:9', '21:9']),
  negativePrompt: z.string().optional(),
  priority: z.number().min(0).max(10).default(5),
  /** Generated asset metadata (populated after generation) */
  generated: VideoAssetMetadataSchema.optional(),
});

export type CinematicDef = z.infer<typeof CinematicDefSchema>;

/**
 * Quest/mission image definition
 */
export const QuestImageDefSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  prompt: z.string().min(10),
  style: VisualStyleSchema,
  aspectRatio: AspectRatioSchema,
  resolution: ImageResolutionSchema,
  purpose: z.enum(['objective', 'loading_screen', 'achievement', 'briefing']),
  /** Generated asset metadata (populated after generation) */
  generated: ImageAssetMetadataSchema.optional(),
});

export type QuestImageDef = z.infer<typeof QuestImageDefSchema>;

/**
 * Text content definition
 */
export const TextContentDefSchema = z.object({
  id: z.string().min(1),
  type: z.literal('text'),
  prompt: z.string().min(10),
  maxTokens: z.number().positive().default(200),
  category: z.enum(['dialogue', 'audio_log', 'briefing', 'lore']),
  characterId: z.string().optional(),
  systemInstruction: z.string().optional(),
  /** Generated asset metadata (populated after generation) */
  generated: TextAssetMetadataSchema.optional(),
});

export type TextContentDef = z.infer<typeof TextContentDefSchema>;

/**
 * Level-specific asset manifest
 */
export const LevelAssetManifestSchema = z.object({
  /** Level identifier */
  levelId: LevelIdSchema,
  /** Schema version for migrations */
  schemaVersion: z.string().default('1.0.0'),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Cinematics for this level */
  cinematics: z.array(CinematicDefSchema),
  /** Quest images for this level */
  questImages: z.array(QuestImageDefSchema),
  /** Text content for this level */
  textContent: z.array(TextContentDefSchema),
  /** Generation statistics */
  stats: z.object({
    totalAssets: z.number().nonnegative(),
    generatedAssets: z.number().nonnegative(),
    pendingAssets: z.number().nonnegative(),
    failedAssets: z.number().nonnegative(),
    totalSizeBytes: z.number().nonnegative(),
  }).optional(),
});

export type LevelAssetManifest = z.infer<typeof LevelAssetManifestSchema>;

// ============================================================================
// SHARED ASSET MANIFEST
// ============================================================================

/**
 * Portrait definition for dialogue system
 */
export const PortraitDefSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  prompt: z.string().min(10),
  style: z.literal('portrait_realistic'),
  aspectRatio: AspectRatioSchema,
  resolution: ImageResolutionSchema,
  characterId: z.string().min(1),
  emotion: z.string().min(1),
  /** Generated asset metadata (populated after generation) */
  generated: ImageAssetMetadataSchema.optional(),
});

export type PortraitDef = z.infer<typeof PortraitDefSchema>;

/**
 * Audio asset definition
 */
export const AudioDefSchema = z.object({
  id: z.string().min(1),
  type: AudioAssetTypeSchema,
  searchQuery: z.string().min(3),
  filters: z.object({
    maxDuration: z.number().positive().optional(),
    minDuration: z.number().positive().optional(),
    tags: z.array(z.string()).optional(),
    license: FreesoundLicenseSchema.optional(),
  }).optional(),
  processing: z.object({
    normalize: z.boolean().optional(),
    fadeIn: z.number().nonnegative().optional(),
    fadeOut: z.number().nonnegative().optional(),
    pitchShift: z.number().optional(),
    reverb: z.boolean().optional(),
  }).optional(),
  fallbackProcedural: z.string().optional(),
  /** Downloaded asset metadata (populated after download) */
  downloaded: AudioAssetMetadataSchema.optional(),
});

export type AudioDef = z.infer<typeof AudioDefSchema>;

/**
 * Shared assets used across multiple levels
 */
export const SharedAssetManifestSchema = z.object({
  /** Schema version for migrations */
  schemaVersion: z.string().default('1.0.0'),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Character portraits (shared across all levels) */
  portraits: z.array(PortraitDefSchema),
  /** Global cinematics (intro, credits, etc.) */
  globalCinematics: z.array(CinematicDefSchema),
  /** Audio assets organized by category */
  audio: z.object({
    weapons: z.array(AudioDefSchema),
    enemies: z.array(AudioDefSchema),
    ambience: z.array(AudioDefSchema),
    ui: z.array(AudioDefSchema),
    player: z.array(AudioDefSchema),
    vehicles: z.array(AudioDefSchema),
    music: z.array(AudioDefSchema),
    collectibles: z.array(AudioDefSchema),
    environment: z.array(AudioDefSchema),
  }),
  /** Generation statistics */
  stats: z.object({
    totalPortraits: z.number().nonnegative(),
    generatedPortraits: z.number().nonnegative(),
    totalAudioAssets: z.number().nonnegative(),
    downloadedAudioAssets: z.number().nonnegative(),
    totalSizeBytes: z.number().nonnegative(),
  }).optional(),
});

export type SharedAssetManifest = z.infer<typeof SharedAssetManifestSchema>;

// ============================================================================
// COMPLETE MANIFEST (Combined)
// ============================================================================

/**
 * Complete game asset manifest combining all sources
 */
export const CompleteAssetManifestSchema = z.object({
  /** Schema version for migrations */
  schemaVersion: z.string().default('1.0.0'),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Build identifier (git commit hash) */
  buildId: z.string().optional(),
  /** Shared assets */
  shared: SharedAssetManifestSchema,
  /** Level-specific assets */
  levels: z.record(LevelIdSchema, LevelAssetManifestSchema),
  /** Global generation statistics */
  globalStats: z.object({
    totalAssets: z.number().nonnegative(),
    generatedAssets: z.number().nonnegative(),
    downloadedAssets: z.number().nonnegative(),
    pendingAssets: z.number().nonnegative(),
    failedAssets: z.number().nonnegative(),
    totalSizeBytes: z.number().nonnegative(),
    lastFullGeneration: z.string().datetime().optional(),
  }),
});

export type CompleteAssetManifest = z.infer<typeof CompleteAssetManifestSchema>;

// ============================================================================
// GEMINI STRUCTURED OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for Gemini to update a single asset entry
 */
export const AssetUpdateRequestSchema = z.object({
  /** Asset ID to update */
  assetId: z.string().min(1),
  /** Action to perform */
  action: z.enum(['generate', 'regenerate', 'skip', 'mark_failed']),
  /** Updated prompt (for regenerate) */
  updatedPrompt: z.string().optional(),
  /** Reason for action */
  reason: z.string().optional(),
});

export type AssetUpdateRequest = z.infer<typeof AssetUpdateRequestSchema>;

/**
 * Schema for Gemini to respond with manifest updates
 */
export const ManifestUpdateResponseSchema = z.object({
  /** Summary of changes */
  summary: z.string(),
  /** List of asset updates */
  updates: z.array(AssetUpdateRequestSchema),
  /** New assets to add */
  additions: z.array(z.object({
    type: z.enum(['cinematic', 'portrait', 'quest_image', 'text', 'audio']),
    levelId: LevelIdSchema.optional(),
    definition: z.record(z.unknown()), // Flexible for different asset types
  })).optional(),
  /** Assets to remove */
  removals: z.array(z.string()).optional(),
  /** Validation warnings */
  warnings: z.array(z.string()).optional(),
});

export type ManifestUpdateResponse = z.infer<typeof ManifestUpdateResponseSchema>;

/**
 * Schema for asset generation status report
 */
export const GenerationStatusReportSchema = z.object({
  /** Report timestamp */
  timestamp: z.string().datetime(),
  /** Overall status */
  status: z.enum(['success', 'partial', 'failed']),
  /** Assets successfully generated */
  generated: z.array(z.object({
    id: z.string(),
    type: z.string(),
    path: z.string(),
    timeMs: z.number(),
  })),
  /** Assets that failed */
  failed: z.array(z.object({
    id: z.string(),
    type: z.string(),
    error: z.string(),
    retryable: z.boolean(),
  })),
  /** Assets skipped (already cached) */
  skipped: z.array(z.string()),
  /** Total generation time in ms */
  totalTimeMs: z.number(),
  /** Estimated cost (API usage) */
  estimatedCostUsd: z.number().optional(),
});

export type GenerationStatusReport = z.infer<typeof GenerationStatusReportSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a level asset manifest
 */
export function validateLevelManifest(data: unknown): LevelAssetManifest {
  return LevelAssetManifestSchema.parse(data);
}

/**
 * Validate a shared asset manifest
 */
export function validateSharedManifest(data: unknown): SharedAssetManifest {
  return SharedAssetManifestSchema.parse(data);
}

/**
 * Validate a complete asset manifest
 */
export function validateCompleteManifest(data: unknown): CompleteAssetManifest {
  return CompleteAssetManifestSchema.parse(data);
}

/**
 * Safe validation that returns result object instead of throwing
 */
export function safeValidateLevelManifest(data: unknown): z.SafeParseReturnType<unknown, LevelAssetManifest> {
  return LevelAssetManifestSchema.safeParse(data);
}

export function safeValidateSharedManifest(data: unknown): z.SafeParseReturnType<unknown, SharedAssetManifest> {
  return SharedAssetManifestSchema.safeParse(data);
}

export function safeValidateCompleteManifest(data: unknown): z.SafeParseReturnType<unknown, CompleteAssetManifest> {
  return CompleteAssetManifestSchema.safeParse(data);
}
```

---

## 4. Structured Output for Manifest Updates

### File: `src/game/ai/services/ManifestUpdateService.ts`

```typescript
/**
 * ManifestUpdateService - Gemini-powered manifest management
 *
 * Uses structured output to have Gemini Pro analyze and update asset manifests,
 * ensuring consistent, validated updates to the asset pipeline.
 */

import { GoogleGenAI } from '@google/genai';
import { getLogger } from '../../core/Logger';
import {
  CompleteAssetManifestSchema,
  ManifestUpdateResponseSchema,
  type CompleteAssetManifest,
  type ManifestUpdateResponse,
  type LevelAssetManifest,
} from '../schemas/AssetManifestSchemas';

const log = getLogger('ManifestUpdateService');

// ============================================================================
// JSON SCHEMA FOR GEMINI STRUCTURED OUTPUT
// ============================================================================

/**
 * JSON Schema for Gemini's structured output
 * This tells Gemini exactly what format to return
 */
const MANIFEST_UPDATE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Brief summary of the changes being made',
    },
    updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assetId: { type: 'string' },
          action: {
            type: 'string',
            enum: ['generate', 'regenerate', 'skip', 'mark_failed'],
          },
          updatedPrompt: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['assetId', 'action'],
      },
    },
    additions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['cinematic', 'portrait', 'quest_image', 'text', 'audio'],
          },
          levelId: { type: 'string' },
          definition: { type: 'object' },
        },
        required: ['type', 'definition'],
      },
    },
    removals: {
      type: 'array',
      items: { type: 'string' },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'updates'],
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export interface ManifestUpdateOptions {
  /** Dry run - don't actually modify anything */
  dryRun?: boolean;
  /** Only analyze specific level */
  levelFilter?: string;
  /** Only analyze specific asset types */
  typeFilter?: ('video' | 'image' | 'text' | 'audio')[];
  /** Force regeneration of existing assets */
  forceRegenerate?: boolean;
}

export class ManifestUpdateService {
  private ai: GoogleGenAI | null = null;
  private initialized = false;

  constructor(private apiKey?: string) {}

  /**
   * Initialize the service with API key
   */
  async initialize(): Promise<boolean> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      log.error('GEMINI_API_KEY not configured');
      return false;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey: key });
      this.initialized = true;
      log.info('ManifestUpdateService initialized');
      return true;
    } catch (error) {
      log.error('Failed to initialize ManifestUpdateService:', error);
      return false;
    }
  }

  /**
   * Analyze current manifest and generate update recommendations
   */
  async analyzeManifest(
    currentManifest: CompleteAssetManifest,
    options: ManifestUpdateOptions = {}
  ): Promise<ManifestUpdateResponse> {
    if (!this.initialized || !this.ai) {
      throw new Error('Service not initialized');
    }

    const systemPrompt = this.buildSystemPrompt(options);
    const userPrompt = this.buildAnalysisPrompt(currentManifest, options);

    log.info('Analyzing manifest with Gemini...');

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseSchema: MANIFEST_UPDATE_JSON_SCHEMA,
        responseMimeType: 'application/json',
      },
    });

    // Parse and validate the response
    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text);
    const validated = ManifestUpdateResponseSchema.parse(parsed);

    log.info(`Analysis complete: ${validated.updates.length} updates, ${validated.additions?.length ?? 0} additions`);

    return validated;
  }

  /**
   * Apply updates to a manifest
   */
  async applyUpdates(
    manifest: CompleteAssetManifest,
    updates: ManifestUpdateResponse
  ): Promise<CompleteAssetManifest> {
    const updated = structuredClone(manifest);
    updated.updatedAt = new Date().toISOString();

    // Process updates
    for (const update of updates.updates) {
      this.applyAssetUpdate(updated, update);
    }

    // Process additions
    if (updates.additions) {
      for (const addition of updates.additions) {
        this.addAsset(updated, addition);
      }
    }

    // Process removals
    if (updates.removals) {
      for (const assetId of updates.removals) {
        this.removeAsset(updated, assetId);
      }
    }

    // Validate the updated manifest
    return CompleteAssetManifestSchema.parse(updated);
  }

  /**
   * Generate a prompt quality improvement suggestion
   */
  async improvePrompt(
    assetType: 'video' | 'image' | 'text',
    currentPrompt: string,
    context: string
  ): Promise<string> {
    if (!this.initialized || !this.ai) {
      throw new Error('Service not initialized');
    }

    const systemPrompt = `You are an expert prompt engineer specializing in ${assetType} generation.
    Improve the following prompt for better AI generation results.
    Maintain the core intent but enhance specificity, clarity, and visual detail.
    Return ONLY the improved prompt, no explanations.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context: ${context}\n\nOriginal prompt:\n${currentPrompt}`,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 500,
      },
    });

    return response.text || currentPrompt;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private buildSystemPrompt(options: ManifestUpdateOptions): string {
    return `You are an AI asset manifest manager for Stellar Descent, a military sci-fi shooter game.

Your role is to analyze the asset manifest and provide structured updates.

Game context:
- Setting: Year 3147, Proxima Centauri b
- Tone: Military sci-fi horror (Aliens, Starship Troopers, Dead Space)
- Characters: Sgt. James Cole (player), Cpl. Marcus Cole (brother), Cmdr. Reyes, ATHENA AI
- Enemies: "Chitin" - insectoid aliens from underground hives

Guidelines:
- Prioritize visual consistency across all generated assets
- Ensure prompts are detailed enough for high-quality generation
- Flag any prompts that might produce inappropriate content
- Suggest improvements for low-quality or generic prompts
${options.forceRegenerate ? '- Mark ALL assets for regeneration' : '- Only regenerate assets with outdated prompts'}
${options.levelFilter ? `- Focus only on level: ${options.levelFilter}` : ''}
${options.typeFilter ? `- Focus only on types: ${options.typeFilter.join(', ')}` : ''}

Always return valid JSON matching the specified schema.`;
  }

  private buildAnalysisPrompt(
    manifest: CompleteAssetManifest,
    options: ManifestUpdateOptions
  ): string {
    const manifestJson = JSON.stringify(manifest, null, 2);

    return `Analyze this asset manifest and provide update recommendations:

\`\`\`json
${manifestJson}
\`\`\`

Tasks:
1. Review all asset definitions for quality and consistency
2. Identify assets that need regeneration (missing, outdated, or low quality)
3. Suggest prompt improvements where needed
4. Flag any missing assets for each level
5. Identify duplicate or redundant assets
${options.dryRun ? '\nThis is a DRY RUN - only analyze, do not modify.' : ''}

Provide your analysis as structured JSON.`;
  }

  private applyAssetUpdate(
    manifest: CompleteAssetManifest,
    update: { assetId: string; action: string; updatedPrompt?: string; reason?: string }
  ): void {
    // Find and update the asset in the appropriate location
    // Implementation depends on asset type and location
    log.debug(`Applying update to ${update.assetId}: ${update.action}`);
  }

  private addAsset(
    manifest: CompleteAssetManifest,
    addition: { type: string; levelId?: string; definition: Record<string, unknown> }
  ): void {
    log.debug(`Adding new ${addition.type} asset`);
  }

  private removeAsset(manifest: CompleteAssetManifest, assetId: string): void {
    log.debug(`Removing asset: ${assetId}`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let serviceInstance: ManifestUpdateService | null = null;

export function getManifestUpdateService(): ManifestUpdateService {
  if (!serviceInstance) {
    serviceInstance = new ManifestUpdateService();
  }
  return serviceInstance;
}

export async function initializeManifestUpdateService(apiKey?: string): Promise<boolean> {
  const service = getManifestUpdateService();
  return service.initialize();
}
```

---

## 5. Test Infrastructure with VCR Recording

### File: `src/test/vcr/VCRSetup.ts`

```typescript
/**
 * VCR Test Setup for Gemini/Freesound API Recording
 *
 * Uses Polly.JS for recording actual API responses and MSW for mocking.
 */

import { Polly } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import path from 'path';

// Register Polly adapters and persisters
Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

// ============================================================================
// POLLY.JS VCR SETUP
// ============================================================================

export interface VCROptions {
  /** Test name (used for recording directory) */
  testName: string;
  /** Recording mode: record, replay, passthrough, record_missing */
  mode?: 'record' | 'replay' | 'passthrough' | 'record_missing';
  /** APIs to record */
  apis?: ('gemini' | 'freesound')[];
}

const RECORDINGS_DIR = path.join(__dirname, '__recordings__');

export function createVCR(options: VCROptions): Polly {
  const polly = new Polly(options.testName, {
    adapters: ['node-http'],
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: RECORDINGS_DIR,
      },
    },
    mode: options.mode || 'replay',
    recordIfMissing: options.mode === 'record_missing',
    matchRequestsBy: {
      headers: false, // Don't match by headers (API keys change)
      body: true,
      url: {
        protocol: false,
        hostname: true,
        pathname: true,
        query: true,
      },
    },
  });

  // Configure which APIs to record
  const apis = options.apis || ['gemini', 'freesound'];

  polly.server.any().on('beforePersist', (req, recording) => {
    // Sanitize API keys from recordings
    if (recording.request.headers) {
      delete recording.request.headers['authorization'];
      delete recording.request.headers['x-goog-api-key'];
    }
    if (recording.request.queryString) {
      recording.request.queryString = recording.request.queryString.filter(
        (param: { name: string }) => param.name !== 'key' && param.name !== 'token'
      );
    }
  });

  // Only intercept relevant APIs
  if (!apis.includes('gemini')) {
    polly.server.any('*generativelanguage.googleapis.com*').passthrough();
  }
  if (!apis.includes('freesound')) {
    polly.server.any('*freesound.org*').passthrough();
  }

  return polly;
}

// ============================================================================
// MSW MOCK SETUP
// ============================================================================

/**
 * Mock Gemini API responses for unit tests
 */
export const geminiMocks = [
  // Text generation
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-*:generateContent', () => {
    return HttpResponse.json({
      candidates: [{
        content: {
          parts: [{ text: 'Mock generated text response' }],
        },
      }],
    });
  }),

  // Image generation
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-*-image*:generateContent', () => {
    return HttpResponse.json({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          }],
        },
      }],
    });
  }),

  // Video generation (start)
  http.post('https://generativelanguage.googleapis.com/v1beta/models/veo-*:generateVideos', () => {
    return HttpResponse.json({
      name: 'operations/mock-video-op-123',
      done: false,
    });
  }),

  // Video generation (poll)
  http.get('https://generativelanguage.googleapis.com/v1beta/operations/*', () => {
    return HttpResponse.json({
      name: 'operations/mock-video-op-123',
      done: true,
      response: {
        generatedVideos: [{
          video: {
            uri: 'https://example.com/mock-video.mp4',
          },
        }],
      },
    });
  }),
];

/**
 * Mock Freesound API responses for unit tests
 */
export const freesoundMocks = [
  // Search
  http.get('https://freesound.org/apiv2/search/text/', () => {
    return HttpResponse.json({
      count: 1,
      results: [{
        id: 12345,
        name: 'Mock Sound Effect',
        duration: 2.5,
        license: 'http://creativecommons.org/publicdomain/zero/1.0/',
        username: 'testuser',
        previews: {
          'preview-hq-mp3': 'https://freesound.org/mock-preview.mp3',
        },
      }],
    });
  }),

  // Download
  http.get('https://freesound.org/apiv2/sounds/*/download/', () => {
    return new HttpResponse(new ArrayBuffer(1024), {
      headers: { 'Content-Type': 'audio/wav' },
    });
  }),
];

/**
 * Create MSW server with all mocks
 */
export function createMockServer() {
  return setupServer(...geminiMocks, ...freesoundMocks);
}

// ============================================================================
// VITEST INTEGRATION
// ============================================================================

/**
 * Vitest setup for VCR tests
 *
 * Usage in test file:
 * ```typescript
 * import { setupVCRTest, cleanupVCRTest } from './VCRSetup';
 *
 * let polly: Polly;
 *
 * beforeEach(async () => {
 *   polly = await setupVCRTest('my-test-name');
 * });
 *
 * afterEach(async () => {
 *   await cleanupVCRTest(polly);
 * });
 * ```
 */
export async function setupVCRTest(testName: string, mode: VCROptions['mode'] = 'replay'): Promise<Polly> {
  const polly = createVCR({ testName, mode });
  return polly;
}

export async function cleanupVCRTest(polly: Polly): Promise<void> {
  await polly.stop();
}

/**
 * Vitest setup for mock tests (no recording)
 */
const mockServer = createMockServer();

export function setupMockTests(): void {
  mockServer.listen({ onUnhandledRequest: 'bypass' });
}

export function cleanupMockTests(): void {
  mockServer.close();
}

export function resetMockHandlers(): void {
  mockServer.resetHandlers();
}
```

### File: `src/test/vcr/__recordings__/.gitkeep`

```
# This directory contains VCR recordings of API responses
# Recordings are sanitized to remove API keys
```

---

## 6. Implementation Plan

### Phase 1: Foundation (Week 1)

1. **Install dependencies**
   ```bash
   pnpm add zod
   pnpm add -D msw @pollyjs/core @pollyjs/adapter-node-http @pollyjs/persister-fs
   ```

2. **Create directory structure**
   ```bash
   mkdir -p public/assets/{videos/cinematics,images/{portraits,quest,ui},audio/{sfx,music,ambience}}
   mkdir -p public/manifests
   mkdir -p src/game/ai/schemas
   mkdir -p src/game/ai/services
   mkdir -p src/test/vcr/__recordings__
   ```

3. **Implement Zod schemas**
   - Create `src/game/ai/schemas/AssetManifestSchemas.ts`
   - Add validation functions
   - Export from index

### Phase 2: Manifest Migration (Week 2)

1. **Convert existing manifests to JSON**
   - Create `public/manifests/visual-assets.manifest.json`
   - Create `public/manifests/audio-assets.manifest.json`
   - Validate against Zod schemas

2. **Update TypeScript types**
   - Replace interface definitions with Zod inferred types
   - Update existing code to use validators

### Phase 3: Test Infrastructure (Week 3)

1. **Set up VCR recording**
   - Configure Polly.JS for Gemini API
   - Configure Polly.JS for Freesound API
   - Record baseline API responses

2. **Set up MSW mocking**
   - Create mock handlers for all API endpoints
   - Integrate with Vitest setup

### Phase 4: Manifest Service (Week 4)

1. **Implement ManifestUpdateService**
   - Gemini integration for structured output
   - Manifest analysis and update logic
   - Prompt improvement suggestions

2. **Create CLI tools**
   - `pnpm generate:manifest-analysis` - Analyze and suggest updates
   - `pnpm generate:manifest-apply` - Apply approved updates

---

## 7. Usage Examples

### Running VCR Tests

```typescript
// src/game/ai/GeminiAssetGenerator.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupVCRTest, cleanupVCRTest } from '../../test/vcr/VCRSetup';
import { GeminiAssetGenerator } from './GeminiAssetGenerator';
import type { Polly } from '@pollyjs/core';

describe('GeminiAssetGenerator', () => {
  let polly: Polly;
  let generator: GeminiAssetGenerator;

  beforeEach(async () => {
    // Use 'record_missing' during development, 'replay' in CI
    polly = await setupVCRTest('gemini-generator',
      process.env.VCR_MODE as any || 'replay'
    );
    generator = new GeminiAssetGenerator();
    await generator.initialize();
  });

  afterEach(async () => {
    await cleanupVCRTest(polly);
  });

  it('generates text content', async () => {
    const result = await generator.generateText({
      id: 'test_audio_log',
      type: 'text',
      prompt: 'Write a 50-word audio log from a scientist.',
      category: 'audio_log',
    });

    expect(result.success).toBe(true);
    expect(result.text).toBeDefined();
    expect(result.text!.length).toBeGreaterThan(50);
  });
});
```

### Validating Manifests

```typescript
import { validateCompleteManifest, safeValidateCompleteManifest } from './schemas/AssetManifestSchemas';
import manifestData from '../../../public/manifests/complete-assets.manifest.json';

// Throws on invalid data
const manifest = validateCompleteManifest(manifestData);

// Returns result object
const result = safeValidateCompleteManifest(manifestData);
if (!result.success) {
  console.error('Validation errors:', result.error.format());
}
```

### Using Manifest Update Service

```typescript
import { getManifestUpdateService } from './services/ManifestUpdateService';
import { validateCompleteManifest } from './schemas/AssetManifestSchemas';
import fs from 'fs/promises';

async function analyzeAndUpdate() {
  const service = getManifestUpdateService();
  await service.initialize();

  // Load current manifest
  const raw = await fs.readFile('public/manifests/complete-assets.manifest.json', 'utf-8');
  const manifest = validateCompleteManifest(JSON.parse(raw));

  // Get AI analysis
  const updates = await service.analyzeManifest(manifest, {
    dryRun: false,
    typeFilter: ['video', 'image'],
  });

  console.log('Summary:', updates.summary);
  console.log('Updates:', updates.updates.length);
  console.log('Warnings:', updates.warnings);

  // Apply updates
  const updated = await service.applyUpdates(manifest, updates);

  // Save updated manifest
  await fs.writeFile(
    'public/manifests/complete-assets.manifest.json',
    JSON.stringify(updated, null, 2)
  );
}
```

---

## Sources

- [Polly.JS - Netflix](https://netflix.github.io/pollyjs/)
- [MSW Comparison Documentation](https://mswjs.io/docs/comparison/)
- [Nock - GitHub](https://github.com/nock/nock)
- [Polly.JS GitHub Repository](https://github.com/Netflix/pollyjs)

---

## Appendix: File Inventory

| File | Purpose | Status |
|------|---------|--------|
| `src/game/ai/schemas/AssetManifestSchemas.ts` | Zod schema definitions | To Create |
| `src/game/ai/services/ManifestUpdateService.ts` | Gemini manifest updates | To Create |
| `src/test/vcr/VCRSetup.ts` | Test VCR configuration | To Create |
| `public/manifests/visual-assets.manifest.json` | Visual asset manifest | To Create |
| `public/manifests/audio-assets.manifest.json` | Audio asset manifest | To Create |
| `public/manifests/generated-assets.manifest.json` | Generation tracking | To Create |
