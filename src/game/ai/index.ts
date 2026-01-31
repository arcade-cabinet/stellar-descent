/**
 * AI Systems - Squad commands, companion AI, pathfinding, and asset generation
 */

// Gemini AI Asset Generation
export {
  GeminiAssetGenerator,
  getGeminiGenerator,
  initializeGeminiGenerator,
} from './GeminiAssetGenerator';

export {
  ASSET_MANIFEST,
  CINEMATIC_ASSETS,
  PORTRAIT_ASSETS,
  QUEST_IMAGES,
  TEXT_CONTENT,
  getAssetsForLevel,
  getAssetById,
  getCinematicsByPriority,
} from './AssetManifest';

// Freesound Audio Asset Generation
export {
  FreesoundClient,
  getFreesoundClient,
  initializeFreesoundClient,
} from './FreesoundClient';

export {
  AUDIO_ASSET_MANIFEST,
  ALL_AUDIO_ASSETS,
  WEAPON_SFX,
  ENEMY_SFX,
  AMBIENCE_SFX,
  UI_SFX,
  PLAYER_SFX,
  VEHICLE_SFX,
  MUSIC_STINGERS,
  COLLECTIBLE_SFX,
  ENVIRONMENT_SFX,
  getAudioAssetsByType,
  getAudioAssetById,
  getCC0AudioAssets,
  getAudioAssetsByCategory,
  getAudioAssetCount,
} from './AudioAssetManifest';

export type {
  // Gemini/Visual Asset Types
  AspectRatio,
  ImageResolution,
  VisualStyle,
  CinematicAssetDef,
  PortraitAssetDef,
  QuestImageDef,
  TextContentDef,
  AssetManifest,
  VideoGenerationResult,
  ImageGenerationResult,
  TextGenerationResult,
  CachedAsset,
  CacheMetadata,
  GeminiGeneratorOptions,
  ProgressCallback,
  GenerationProgress,
  LoadedCinematic,
  LoadedPortrait,
  CinematicLoadStatus,
  // Freesound/Audio Asset Types
  FreesoundLicense,
  AudioAssetType,
  FreesoundSound,
  FreesoundSoundPreview,
  FreesoundSearchResult,
  FreesoundSearchOptions,
  AudioProcessingOptions,
  AudioAssetDef,
  AudioAssetManifest,
  FreesoundDownloadResult,
  CachedAudioAsset,
  FreesoundClientOptions,
  AudioDownloadProgress,
  AudioProgressCallback,
} from './types';

// Squad Command System
export {
  SquadCommandSystem,
  type SquadCommand,
  type SquadCommandData,
  type SquadCommandConfig,
  type SquadCommandCallbacks,
  COMMAND_INFO,
  COMMAND_ACKNOWLEDGMENTS,
} from './SquadCommandSystem';

// Marcus Steering AI
export {
  MarcusSteeringAI,
  type MarcusSteeringConfig,
  type SteeringMode,
  type SteeringResult,
  type FlankingState,
  type PathfindingState,
  type TargetCallout,
} from './MarcusSteeringAI';

// NavMesh Builder
export {
  NavMeshBuilder,
  type NavMeshConfig,
  type NavMeshObstacle,
  type NavMeshRegionData,
  type NavMeshBuildResult,
  type VerticalConnection,
  type EnvironmentType,
  NAV_FLAGS,
  createBrothersNavMesh,
  createStationNavMesh,
  createHiveNavMesh,
} from './NavMeshBuilder';

// Scouting System
export {
  ScoutingSystem,
  type ScoutingState,
  type ScoutWaypoint,
  type IntelReport,
  type IntelType,
  type ScoutingCallbacks,
  type ScoutingConfig,
} from './ScoutingSystem';

// Level NavMesh Data
export {
  buildLevelNavMesh,
  getLevelNavMeshDefinition,
  hasNavMeshSupport,
  LEVEL_NAVMESH_DEFINITIONS,
  type LevelNavMeshDefinition,
} from './LevelNavMeshData';

// Path Visualizer
export {
  PathVisualizer,
  type PathVisualizerConfig,
} from './PathVisualizer';
