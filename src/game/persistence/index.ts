/**
 * Game Persistence Module
 *
 * Exports the save system and related types for game state persistence.
 * Includes IndexedDB persistence for PWA offline support.
 */

export {
  createNewSave,
  extractSaveMetadata,
  formatPlayTime,
  type GameSave,
  type GameSaveMetadata,
  generateSaveId,
  getLevelDisplayName,
  SAVE_FORMAT_VERSION,
} from './GameSave';
export { type SaveSystemEvent, saveSystem } from './SaveSystem';
