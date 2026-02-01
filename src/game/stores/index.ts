/**
 * Stores - Zustand store infrastructure for game state management
 *
 * This module provides:
 * - createPersistedStore: Factory for SQLite-persisted Zustand stores
 * - createStore: Factory for non-persisted stores with subscribeWithSelector
 *
 * All game stores should be created using these factories for consistency
 * and automatic persistence handling.
 *
 * @example
 * ```ts
 * import { createPersistedStore } from '../stores';
 *
 * interface SettingsState {
 *   masterVolume: number;
 *   setMasterVolume: (volume: number) => void;
 * }
 *
 * export const useSettingsStore = createPersistedStore<SettingsState>(
 *   'settings',
 *   { masterVolume: 1.0 },
 *   (set) => ({
 *     masterVolume: 1.0,
 *     setMasterVolume: (volume) => set({ masterVolume: volume }),
 *   })
 * );
 * ```
 */

// Factory functions for creating stores
export {
  createPersistedStore,
  createStore,
  type PersistedActions,
  type PersistedState,
  type PersistedStore,
  type PersistedStoreConfig,
} from './createPersistedStore';
// Achievements store
export {
  type AchievementsActions,
  type AchievementsState,
  type AchievementsStoreState,
  type AchievementWithState,
  getAchievementManager,
  getAchievementsStore,
  initAchievements,
  initializeAchievementsStore,
  type LevelStatsResult,
  type ProgressStats,
  useAchievementsStore,
} from './useAchievementsStore';
// Campaign store
export {
  type CampaignActions,
  type CampaignState,
  type CampaignStoreState,
  getCampaignDifficulty,
  // Non-React accessors
  getCampaignPhase,
  getCurrentLevel,
  initializeCampaignStore,
  isLevelUnlocked,
  // Types
  type LevelProgress,
  selectCompletionStats,
  selectCurrentLevel,
  selectDifficulty,
  selectInitialized as selectCampaignInitialized,
  selectLevelProgress,
  selectNewGamePlusLevel,
  // Selectors
  selectPhase,
  selectTotalDeaths,
  selectTotalKills,
  subscribeToCampaign,
  useCampaignStore,
} from './useCampaignStore';
// Collectibles store (skulls, audio logs, secrets)
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
} from './useCollectiblesStore';
// Game stats store (death count, best times, level stats)
export {
  type BestTimeEntry,
  type GameStatsActions,
  type GameStatsState,
  type GameStatsStoreState,
  getGameStatsStore,
  initializeGameStatsStore,
  type LevelBestStatsData,
  useGameStatsStore,
} from './useGameStatsStore';
// Combat store (non-persisted runtime stats)
export {
  type CombatActions,
  type CombatState,
  type CombatStoreState,
  getCombatStore,
  initializeCombatStoreEventHandlers,
  // Types
  type KillRecord,
  playChapterMusic,
  // Selectors
  selectAccuracy,
  selectIsOnStreak,
  subscribeToCombatState,
  useCombatStore,
} from './useCombatStore';
// Mission store (non-persisted UI state - replaces MissionContext)
export {
  type CompassData,
  getMissionStore,
  type MissionActions,
  type MissionState,
  type MissionStoreState,
  type ObjectiveMarker,
  type ScreenSpaceObjective,
  useMissionStore,
} from './useMissionStore';
// Keybindings store
export {
  // Constants
  ACTION_LABELS,
  // Types
  type BindableAction,
  clearAllDynamicActions,
  DEFAULT_DYNAMIC_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEYBINDINGS,
  DYNAMIC_ACTION_LABELS,
  type DynamicAction,
  type DynamicBindings,
  GAMEPAD_BUTTON_INDEX,
  GAMEPAD_BUTTON_LABELS,
  GAMEPAD_INDEX_TO_BUTTON,
  type GamepadBindings,
  type GamepadButton,
  getActiveDynamicActions,
  getDynamicBindings,
  getGamepadBindings,
  getGamepadButtonLabel,
  getKeybindings,
  // Helper functions
  getKeyDisplayName,
  getKeysForAction,
  getPrimaryKey,
  type Keybindings,
  type KeybindingsActions,
  type KeybindingsState,
  type KeybindingsStoreState,
  type KeybindingValue,
  NINTENDO_BUTTON_LABELS,
  PLAYSTATION_BUTTON_LABELS,
  type RegisteredDynamicAction,
  registerDynamicActions,
  subscribeToKeybindings,
  unregisterDynamicActions,
  useKeybindings,
  useKeybindingsStore,
} from './useKeybindingsStore';
// Player store (non-persisted runtime state)
export {
  DEFAULT_HUD_VISIBILITY,
  getPlayerStore,
  type HUDVisibility,
  type PlayerActions,
  // Types
  type PlayerState,
  type PlayerStoreState,
  subscribeToPlayerState,
  TUTORIAL_START_HUD_VISIBILITY,
  usePlayerStore,
} from './usePlayerStore';
// Settings store
export {
  COLOR_BLIND_MODE_DESCRIPTIONS,
  COLOR_BLIND_MODE_LABELS,
  type ColorPalette,
  DEFAULT_GAME_SETTINGS,
  FPS_LIMIT_OPTIONS,
  type FPSLimit,
  type GameSettings,
  GRAPHICS_QUALITY_DESCRIPTIONS,
  type GraphicsQuality,
  initializeSettingsStore,
  PARTICLE_DENSITY_DESCRIPTIONS,
  PARTICLE_DENSITY_OPTIONS,
  type ParticleDensity,
  type SettingsActions,
  type SettingsState,
  type SettingsStoreState,
  SHADOW_QUALITY_DESCRIPTIONS,
  SHADOW_QUALITY_OPTIONS,
  type ShadowQuality,
  useSettings,
  useSettingsStore,
} from './useSettingsStore';
