/**
 * Collectibles Module
 *
 * Exports all collectible-related functionality including:
 * - Audio logs data and types
 * - Audio log system for level integration
 * - Secret areas and rewards system
 * - Skull modifier system (Halo-style easter eggs)
 * - Persistence layer for save/load
 */

// ============================================================================
// AUDIO LOGS
// ============================================================================

export type { AudioLogSystemCallbacks } from './AudioLogSystem';
// Audio log system
export { AudioLogSystem, createAudioLogSystem } from './AudioLogSystem';
// Persistence
export type { AudioLogCollectionState } from './audioLogPersistence';
export {
  addDiscoveredAudioLog,
  deleteAllAudioLogSaves,
  getCollectionProgress,
  getCurrentSaveId,
  getDiscoveredAudioLogIds,
  getDiscoveredLogsByLevel,
  getUnplayedAudioLogs,
  isAudioLogDiscovered,
  loadAudioLogCollection,
  markAudioLogPlayed,
  resetAudioLogCollection,
  saveAudioLogCollection,
  setCurrentSaveId,
} from './audioLogPersistence';
// Audio log types and data
export type { AudioLog, AudioLogDiscovery, AudioLogSpeaker } from './audioLogs';
export {
  AUDIO_LOGS,
  getAudioLogById,
  getAudioLogCountByLevel,
  getAudioLogsByLevel,
  getTotalAudioLogCount,
  SPEAKERS,
} from './audioLogs';

// ============================================================================
// SECRET AREAS
// ============================================================================

export type { SecretAreaSystemCallbacks } from './SecretAreaSystem';
// Secret area system
export { createSecretAreaSystem, SecretAreaSystem } from './SecretAreaSystem';
// Secret persistence
export type { SecretCollectionState } from './secretPersistence';
export {
  addDiscoveredSecret,
  deleteAllSecretSaves,
  getDiscoveredSecretIds,
  getDiscoveredSecretsByLevel,
  getSecretCollectionProgress,
  isLevelSecretsComplete,
  isSecretDiscovered,
  loadSecretCollection,
  resetSecretCollection,
  saveSecretCollection,
} from './secretPersistence';
// Secret types and data
export type {
  SecretArea,
  SecretDiscovery,
  SecretHintType,
  SecretReward,
  SecretRewardType,
} from './secrets';
export {
  getSecretById,
  getSecretCountByLevel,
  getSecretsByDifficulty,
  getSecretsByLevel,
  getTotalSecretCount,
  SECRET_AREAS,
} from './secrets';

// ============================================================================
// SKULL MODIFIERS
// ============================================================================

export type { SkullPickupCallbacks } from './SkullPickup';
// Skull pickup system
export { createSkullPickupManager, SkullPickupManager } from './SkullPickup';
// Skull system and types
export type {
  SkullCategory,
  SkullDefinition,
  SkullEffectType,
  SkullId,
  SkullModifiers,
  SkullState,
  SkullSystem,
} from './SkullSystem';
export {
  getSkullSystem,
  initSkulls,
  SKULL_ORDER,
  SKULLS,
} from './SkullSystem';
// Skull persistence
export type { SkullCollectionState } from './skullPersistence';
export {
  addFoundSkull,
  deleteAllSkullSaves,
  getActiveSkullIds,
  getFoundSkullIds,
  getSkullCollectionProgress,
  isSkullFound,
  loadSkullCollection,
  resetSkullCollection,
  saveSkullCollection,
} from './skullPersistence';
