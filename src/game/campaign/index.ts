/**
 * Campaign System - barrel exports
 */

export { CampaignDirector, disposeCampaignDirector, getCampaignDirector } from './CampaignDirector';
export {
  BONUS_LEVELS,
  getMissionDefinition,
  getTotalAudioLogCount,
  getTotalSecretCount,
  getTotalSkullCount,
  MISSION_DEFINITIONS,
} from './MissionDefinitions';
export type { BonusLevelDefinition } from './MissionDefinitions';
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

// Quest system exports
export {
  // Quest Manager runtime API
  initializeQuestManager,
  loadQuestState,
  getQuestStateForSave,
  onLevelEnter,
  onLevelExit,
  activateQuest,
  progressObjective,
  completeObjective,
  completeQuest,
  failQuest,
  onObjectInteract,
  onNPCDialogue,
  onAreaEnter,
  onPlayerReachLocation,
  onEnemyKilled,
  onCollectibleFound,
  onPlayerDeath,
  getActiveMainQuest,
  getActiveQuests,
  isQuestCompleted,
  getCurrentObjective,
  getQuestDefinition,
  resetQuestManager,
  // Timed objective handling
  updateTimedObjectives,
  getObjectiveTimeRemaining,
  // HUD data
  getQuestTrackerData,
  getObjectiveProgress,
} from './QuestManager';

export type { QuestState, QuestStatus, QuestObjective } from './QuestManager';

// Quest Chain definitions
export {
  MAIN_QUEST_CHAIN,
  BRANCH_QUESTS,
  QUEST_REGISTRY,
  getMainQuestForLevel,
  getBranchQuestsForLevel,
  getAllQuestsForLevel,
  getNextMainQuest,
  canStartQuest,
  createQuestState,
} from './QuestChain';

export type {
  QuestDefinition,
  QuestType,
  QuestTriggerType,
  ObjectiveType,
} from './QuestChain';

// Quest Tracker hook for HUD integration
export {
  useQuestTracker,
  useObjectiveProgress,
  useIsQuestActive,
  updateQuestTrackerState,
  markObjectiveCompleted,
  updateObjectiveDistance,
  startQuestTimerTick,
  stopQuestTimerTick,
  pauseQuestTimerTick,
  resumeQuestTimerTick,
} from './useQuestTracker';

export type { UseQuestTrackerResult } from './useQuestTracker';

// Quest Tracker types for HUD components
export type { QuestTrackerData, OptionalObjectiveData } from './QuestTrackerTypes';
