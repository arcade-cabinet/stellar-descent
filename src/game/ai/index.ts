/**
 * AI Systems - Squad commands, companion AI, pathfinding, and asset generation
 */

export {
  ASSET_MANIFEST,
  CINEMATIC_ASSETS,
  getAssetById,
  getAssetsForLevel,
  getCinematicsByPriority,
  PORTRAIT_ASSETS,
  QUEST_IMAGES,
  TEXT_CONTENT,
} from './AssetManifest';
export {
  ALL_AUDIO_ASSETS,
  AMBIENCE_SFX,
  AUDIO_ASSET_MANIFEST,
  COLLECTIBLE_SFX,
  ENEMY_SFX,
  ENVIRONMENT_SFX,
  getAudioAssetById,
  getAudioAssetCount,
  getAudioAssetsByCategory,
  getAudioAssetsByType,
  getCC0AudioAssets,
  MUSIC_STINGERS,
  PLAYER_SFX,
  UI_SFX,
  VEHICLE_SFX,
  WEAPON_SFX,
} from './AudioAssetManifest';

// Freesound Audio Asset Generation
export {
  FreesoundClient,
  getFreesoundClient,
  initializeFreesoundClient,
} from './FreesoundClient';
// Gemini AI Asset Generation
export {
  GeminiAssetGenerator,
  getGeminiGenerator,
  initializeGeminiGenerator,
} from './GeminiAssetGenerator';
// Level NavMesh Data
export {
  buildLevelNavMesh,
  getLevelNavMeshDefinition,
  hasNavMeshSupport,
  LEVEL_NAVMESH_DEFINITIONS,
  type LevelNavMeshDefinition,
} from './LevelNavMeshData';
// Marcus Steering AI
export {
  type FlankingState,
  MarcusSteeringAI,
  type MarcusSteeringConfig,
  type PathfindingState,
  type SteeringMode,
  type SteeringResult,
  type TargetCallout,
} from './MarcusSteeringAI';
// NavMesh Builder
export {
  createBrothersNavMesh,
  createHiveNavMesh,
  createStationNavMesh,
  type EnvironmentType,
  NAV_FLAGS,
  NavMeshBuilder,
  type NavMeshBuildResult,
  type NavMeshConfig,
  type NavMeshObstacle,
  type NavMeshRegionData,
  type VerticalConnection,
} from './NavMeshBuilder';
// Path Visualizer
export {
  PathVisualizer,
  type PathVisualizerConfig,
} from './PathVisualizer';

// Scouting System
export {
  type IntelReport,
  type IntelType,
  type ScoutingCallbacks,
  type ScoutingConfig,
  type ScoutingState,
  ScoutingSystem,
  type ScoutWaypoint,
} from './ScoutingSystem';
// Squad Command System
export {
  COMMAND_ACKNOWLEDGMENTS,
  COMMAND_INFO,
  type SquadCommand,
  type SquadCommandCallbacks,
  type SquadCommandConfig,
  type SquadCommandData,
  SquadCommandSystem,
} from './SquadCommandSystem';
export type {
  // Gemini/Visual Asset Types
  AspectRatio,
  AssetManifest,
  AudioAssetDef,
  AudioAssetManifest,
  AudioAssetType,
  AudioDownloadProgress,
  AudioProcessingOptions,
  AudioProgressCallback,
  CachedAsset,
  CachedAudioAsset,
  CacheMetadata,
  CinematicAssetDef,
  CinematicLoadStatus,
  FreesoundClientOptions,
  FreesoundDownloadResult,
  // Freesound/Audio Asset Types
  FreesoundLicense,
  FreesoundSearchOptions,
  FreesoundSearchResult,
  FreesoundSound,
  FreesoundSoundPreview,
  GeminiGeneratorOptions,
  GenerationProgress,
  ImageGenerationResult,
  ImageResolution,
  LoadedCinematic,
  LoadedPortrait,
  PortraitAssetDef,
  ProgressCallback,
  QuestImageDef,
  TextContentDef,
  TextGenerationResult,
  VideoGenerationResult,
  VisualStyle,
} from './types';
