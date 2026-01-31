/**
 * Campaign System - barrel exports
 */

export { CampaignDirector, disposeCampaignDirector, getCampaignDirector } from './CampaignDirector';
export {
  BONUS_LEVELS,
  getMissionDefinition,
  getTotalAudioLogCount, // Issue #77: Export new helper
  getTotalSecretCount, // Issue #78: Export new helper
  getTotalSkullCount, // Issue #79: Export new helper
  MISSION_DEFINITIONS,
  validateMissionDefinitions, // Issue #80: Export validation helper
} from './MissionDefinitions';
export type { BonusLevelDefinition } from './MissionDefinitions'; // Issue #81: Export type
export type {
  CampaignCommand,
  CampaignPhase,
  CampaignSnapshot,
  LevelStats,
  MissionDefinition,
  MissionObjective,
} from './types';
export { useCampaign } from './useCampaign';
export { LEVEL_DESIGN_DOCUMENTS } from './LevelDesignDocuments';
export type { LevelDesignDocument, TensionPoint } from './LevelDesignData';
