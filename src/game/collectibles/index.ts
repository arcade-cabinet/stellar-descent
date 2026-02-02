/**
 * Collectibles Module
 *
 * Exports all collectible-related functionality including:
 * - Audio logs data and types
 * - Audio log system for level integration
 * - Secret areas and rewards system
 * - Skull modifier system (Halo-style easter eggs)
 * - Unified collectibles store (replacing old persistence files)
 */

// ============================================================================
// UNIFIED COLLECTIBLES STORE
// ============================================================================

export {
  // Types
  type AudioLogEntry,
  addDiscoveredAudioLog,
  addDiscoveredSecret,
  addFoundSkull,
  type CollectiblesActions,
  type CollectiblesProgress,
  type CollectiblesState,
  type CollectiblesStoreState,
  getActiveSkullIds,
  getCollectiblesProgress,
  getDiscoveredAudioLogIds,
  getDiscoveredLogsByLevel,
  getDiscoveredSecretIds,
  getDiscoveredSecretsByLevel,
  getFoundSkullIds,
  // Backwards compatibility functions
  getUnplayedAudioLogs,
  hasAudioLog,
  hasSecret,
  hasSkull,
  initializeCollectiblesStore,
  isAudioLogDiscovered,
  isSecretDiscovered,
  isSkullFound,
  markAudioLogPlayed,
  type SecretEntry,
  type SkullEntry,
  useCollectiblesStore,
} from '../stores/useCollectiblesStore';

// ============================================================================
// AUDIO LOGS
// ============================================================================

export type { AudioLogSystemCallbacks } from './AudioLogSystem';
// Audio log system
export { AudioLogSystem, createAudioLogSystem } from './AudioLogSystem';
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
