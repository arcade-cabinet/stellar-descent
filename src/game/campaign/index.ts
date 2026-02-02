/**
 * Campaign System - barrel exports
 */

export { CampaignDirector, disposeCampaignDirector, getCampaignDirector } from './CampaignDirector';
export type { LevelDesignDocument, TensionPoint } from './LevelDesignData';
export { LEVEL_DESIGN_DOCUMENTS } from './LevelDesignDocuments';
export type { BonusLevelDefinition } from './MissionDefinitions';
export {
  BONUS_LEVELS,
  getMissionDefinition,
  getTotalAudioLogCount,
  getTotalSecretCount,
  getTotalSkullCount,
  MISSION_DEFINITIONS,
} from './MissionDefinitions';
export type {
  ObjectiveType,
  QuestDefinition,
  QuestTriggerType,
  QuestType,
} from './QuestChain';
// Quest Chain definitions
export {
  BRANCH_QUESTS,
  canStartQuest,
  createQuestState,
  getAllQuestsForLevel,
  getBranchQuestsForLevel,
  getMainQuestForLevel,
  getNextMainQuest,
  MAIN_QUEST_CHAIN,
  QUEST_REGISTRY,
} from './QuestChain';
export type { QuestObjective, QuestState, QuestStatus } from './QuestManager';
// Quest system exports
export {
  activateQuest,
  completeObjective,
  completeQuest,
  failQuest,
  getActiveMainQuest,
  getActiveQuests,
  getCurrentObjective,
  getObjectiveProgress,
  getObjectiveTimeRemaining,
  getQuestDefinition,
  getQuestStateForSave,
  // HUD data
  getQuestTrackerData,
  // Quest Manager runtime API
  initializeQuestManager,
  isQuestCompleted,
  loadQuestState,
  onAreaEnter,
  onCollectibleFound,
  onEnemyKilled,
  onLevelEnter,
  onLevelExit,
  onNPCDialogue,
  onObjectInteract,
  onPlayerDeath,
  onPlayerReachLocation,
  progressObjective,
  resetQuestManager,
  // Timed objective handling
  updateTimedObjectives,
} from './QuestManager';
// Quest Tracker types for HUD components
export type { OptionalObjectiveData, QuestTrackerData } from './QuestTrackerTypes';
export type {
  CampaignCommand,
  CampaignPhase,
  CampaignSnapshot,
  LevelStats,
  MissionDefinition,
  MissionObjective,
} from './types';
export { useCampaign } from './useCampaign';

export type { UseQuestTrackerResult } from './useQuestTracker';
// Quest Tracker hook for HUD integration
export {
  markObjectiveCompleted,
  pauseQuestTimerTick,
  resumeQuestTimerTick,
  startQuestTimerTick,
  stopQuestTimerTick,
  updateObjectiveDistance,
  updateQuestTrackerState,
  useIsQuestActive,
  useObjectiveProgress,
  useQuestTracker,
} from './useQuestTracker';
