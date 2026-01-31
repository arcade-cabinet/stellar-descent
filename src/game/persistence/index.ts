/**
 * Game Persistence Module
 *
 * Exports the save system and related types for game state persistence.
 * Includes IndexedDB persistence for PWA offline support.
 *
 * Features:
 * - Multiple save slots (3 manual + autosave + quicksave)
 * - Quick save (F5) and quick load (F9)
 * - Full player state restoration (health, armor, weapons, grenades)
 * - Collectibles persistence (skulls, audio logs, secrets)
 * - Cloud save preparation (JSON export/import)
 * - Checkpoint system for mid-level saves
 */

export {
  type CollectiblesSaveState,
  createNewSave,
  extractSaveMetadata,
  formatPlayTime,
  fromSaveState,
  type GameSave,
  type GameSaveMetadata,
  generateSaveId,
  getLevelDisplayName,
  MAX_SAVE_SLOTS,
  type PlayerSaveState,
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_AUTOSAVE,
  SAVE_SLOT_QUICKSAVE,
  type SavedGameSettings,
  type SaveState,
  toSaveState,
  type WeaponSaveState,
} from './GameSave';
export { type SaveSystemEvent, saveSystem } from './SaveSystem';
