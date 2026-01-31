/**
 * Campaign System - barrel exports
 */

export { CampaignDirector, disposeCampaignDirector, getCampaignDirector } from './CampaignDirector';
export { BONUS_LEVELS, getMissionDefinition, MISSION_DEFINITIONS } from './MissionDefinitions';
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
