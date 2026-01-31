/**
 * QuestManager - Runtime quest state management
 *
 * Manages the active quest chain state, integrating with:
 * - CampaignDirector for level transitions
 * - SaveSystem for persistence
 * - ReyesDialogue for narrative triggers
 * - MissionContext for HUD display
 *
 * This is the central hub for quest progression tracking.
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import {
  QUEST_REGISTRY,
  getMainQuestForLevel,
  getBranchQuestsForLevel,
  canStartQuest,
  createQuestState,
  type QuestDefinition,
  type QuestState,
  type QuestStatus,
  type QuestObjective,
} from './QuestChain';

const logger = getLogger('QuestManager');

// ============================================================================
// QUEST MANAGER STATE
// ============================================================================

interface QuestManagerState {
  /** Currently active quests (can have multiple branch quests active) */
  activeQuests: Map<string, QuestState>;

  /** All completed quest IDs */
  completedQuests: Set<string>;

  /** Failed quest IDs */
  failedQuests: Set<string>;

  /** Current level */
  currentLevelId: LevelId | null;

  /** Callback for objective updates (HUD) */
  onObjectiveUpdate?: (title: string, instructions: string) => void;

  /** Callback for objective marker updates */
  onObjectiveMarker?: (position: { x: number; y: number; z: number } | null, label?: string) => void;

  /** Callback for dialogue triggers */
  onDialogueTrigger?: (trigger: string) => void;

  /** Callback for notifications */
  onNotification?: (text: string, duration?: number) => void;

  /** Callback for quest state changes */
  onQuestStateChange?: (questId: string, state: QuestState) => void;
}

const state: QuestManagerState = {
  activeQuests: new Map(),
  completedQuests: new Set(),
  failedQuests: new Set(),
  currentLevelId: null,
};

// ============================================================================
// INITIALIZATION AND CALLBACKS
// ============================================================================

/**
 * Initialize quest manager with callbacks
 */
export function initializeQuestManager(callbacks: {
  onObjectiveUpdate?: (title: string, instructions: string) => void;
  onObjectiveMarker?: (position: { x: number; y: number; z: number } | null, label?: string) => void;
  onDialogueTrigger?: (trigger: string) => void;
  onNotification?: (text: string, duration?: number) => void;
  onQuestStateChange?: (questId: string, state: QuestState) => void;
}): void {
  state.onObjectiveUpdate = callbacks.onObjectiveUpdate;
  state.onObjectiveMarker = callbacks.onObjectiveMarker;
  state.onDialogueTrigger = callbacks.onDialogueTrigger;
  state.onNotification = callbacks.onNotification;
  state.onQuestStateChange = callbacks.onQuestStateChange;
  logger.info('Quest manager initialized');
}

/**
 * Load quest state from save data
 */
export function loadQuestState(
  completedQuests: string[],
  activeQuestStates: Record<string, QuestState>,
  failedQuests: string[]
): void {
  state.completedQuests = new Set(completedQuests);
  state.failedQuests = new Set(failedQuests);
  state.activeQuests.clear();

  for (const [questId, questState] of Object.entries(activeQuestStates)) {
    state.activeQuests.set(questId, questState);
  }

  logger.info(`Loaded quest state: ${completedQuests.length} completed, ${Object.keys(activeQuestStates).length} active`);
}

/**
 * Get current quest state for saving
 */
export function getQuestStateForSave(): {
  completedQuests: string[];
  activeQuestStates: Record<string, QuestState>;
  failedQuests: string[];
} {
  return {
    completedQuests: Array.from(state.completedQuests),
    activeQuestStates: Object.fromEntries(state.activeQuests),
    failedQuests: Array.from(state.failedQuests),
  };
}

// ============================================================================
// LEVEL TRANSITIONS
// ============================================================================

/**
 * Called when entering a new level - activates main quest
 */
export function onLevelEnter(
  levelId: LevelId,
  completedLevels: LevelId[],
  inventory: Record<string, number>
): void {
  state.currentLevelId = levelId;
  logger.info(`Entering level: ${levelId}`);

  // Get and activate main quest for this level
  const mainQuest = getMainQuestForLevel(levelId);
  if (mainQuest && !state.completedQuests.has(mainQuest.id)) {
    if (canStartQuest(mainQuest.id, Array.from(state.completedQuests), completedLevels, inventory)) {
      activateQuest(mainQuest.id);
    }
  }

  // Check for branch quests that auto-trigger on level enter
  const branchQuests = getBranchQuestsForLevel(levelId);
  for (const branch of branchQuests) {
    if (
      branch.triggerType === 'level_enter' &&
      !state.completedQuests.has(branch.id) &&
      !state.activeQuests.has(branch.id) &&
      canStartQuest(branch.id, Array.from(state.completedQuests), completedLevels, inventory)
    ) {
      activateQuest(branch.id);
    }
  }
}

/**
 * Called when leaving a level
 */
export function onLevelExit(levelId: LevelId): void {
  logger.info(`Exiting level: ${levelId}`);

  // Mark any incomplete branch quests as failed (they're level-specific)
  for (const [questId, questState] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (quest && quest.levelId === levelId && quest.type !== 'main') {
      if (questState.status === 'active') {
        failQuest(questId, 'Left level before completion');
      }
    }
  }
}

// ============================================================================
// QUEST ACTIVATION
// ============================================================================

/**
 * Activate a quest
 */
export function activateQuest(questId: string): boolean {
  const quest = QUEST_REGISTRY[questId];
  if (!quest) {
    logger.warn(`Quest not found: ${questId}`);
    return false;
  }

  if (state.activeQuests.has(questId)) {
    logger.debug(`Quest already active: ${questId}`);
    return false;
  }

  if (state.completedQuests.has(questId)) {
    logger.debug(`Quest already completed: ${questId}`);
    return false;
  }

  // Create quest state
  const questState = createQuestState(questId);
  questState.status = 'active';
  questState.startedAt = performance.now() * 1000; // Microseconds

  // Initialize objective states
  for (const objective of quest.objectives) {
    questState.objectiveStatus[objective.id] = 'pending';
    if (objective.required) {
      questState.objectiveProgress[objective.id] = 0;
    }
  }

  // Activate first objective
  if (quest.objectives.length > 0) {
    questState.objectiveStatus[quest.objectives[0].id] = 'active';
  }

  state.activeQuests.set(questId, questState);

  logger.info(`Quest activated: ${quest.name}`);

  // Notify
  if (quest.type === 'main') {
    state.onNotification?.(`MISSION: ${quest.name}`, 4000);
  } else {
    state.onNotification?.(`OPTIONAL: ${quest.name}`, 3000);
  }

  // Update HUD
  updateHUDForQuest(questId);

  // Trigger dialogue if first objective has one
  const firstObjective = quest.objectives[0];
  if (firstObjective?.dialogueOnStart) {
    state.onDialogueTrigger?.(firstObjective.dialogueOnStart);
  }

  state.onQuestStateChange?.(questId, questState);

  return true;
}

// ============================================================================
// OBJECTIVE PROGRESSION
// ============================================================================

/**
 * Update HUD with current objective
 */
function updateHUDForQuest(questId: string): void {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return;

  const currentObjective = quest.objectives[questState.currentObjectiveIndex];
  if (!currentObjective) return;

  // Update objective text
  state.onObjectiveUpdate?.(quest.briefDescription ?? quest.name, currentObjective.description);

  // Update marker if applicable
  if (currentObjective.showMarker && currentObjective.targetPosition) {
    state.onObjectiveMarker?.(currentObjective.targetPosition, currentObjective.markerLabel);
  } else {
    state.onObjectiveMarker?.(null);
  }
}

/**
 * Progress an objective (for count-based objectives)
 */
export function progressObjective(questId: string, objectiveId: string, amount: number = 1): void {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return;

  const objective = quest.objectives.find((o) => o.id === objectiveId);
  if (!objective) return;

  if (questState.objectiveStatus[objectiveId] !== 'active') return;

  // Update progress
  const current = (questState.objectiveProgress[objectiveId] ?? 0) + amount;
  questState.objectiveProgress[objectiveId] = current;

  logger.debug(`Objective progress: ${objectiveId} = ${current}/${objective.required}`);

  // Check if complete
  if (objective.required && current >= objective.required) {
    completeObjective(questId, objectiveId);
  }

  state.onQuestStateChange?.(questId, questState);
}

/**
 * Complete an objective
 */
export function completeObjective(questId: string, objectiveId: string): void {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return;

  const objectiveIndex = quest.objectives.findIndex((o) => o.id === objectiveId);
  if (objectiveIndex === -1) return;

  const objective = quest.objectives[objectiveIndex];

  // Mark as completed
  questState.objectiveStatus[objectiveId] = 'completed';
  logger.info(`Objective completed: ${objective.description}`);

  // Trigger completion dialogue
  if (objective.dialogueOnComplete) {
    state.onDialogueTrigger?.(objective.dialogueOnComplete);
  }

  // Move to next objective or complete quest
  const nextObjectiveIndex = objectiveIndex + 1;
  if (nextObjectiveIndex < quest.objectives.length) {
    // Activate next objective
    questState.currentObjectiveIndex = nextObjectiveIndex;
    const nextObjective = quest.objectives[nextObjectiveIndex];
    questState.objectiveStatus[nextObjective.id] = 'active';

    // Update HUD
    updateHUDForQuest(questId);

    // Trigger next objective dialogue
    if (nextObjective.dialogueOnStart) {
      state.onDialogueTrigger?.(nextObjective.dialogueOnStart);
    }
  } else {
    // All objectives complete - finish quest
    completeQuest(questId);
  }

  state.onQuestStateChange?.(questId, questState);
}

// ============================================================================
// QUEST COMPLETION / FAILURE
// ============================================================================

/**
 * Complete a quest
 */
export function completeQuest(questId: string): void {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return;

  questState.status = 'completed';
  questState.completedAt = performance.now() * 1000;

  state.activeQuests.delete(questId);
  state.completedQuests.add(questId);

  logger.info(`Quest completed: ${quest.name}`);

  // Notify
  state.onNotification?.(`COMPLETE: ${quest.name}`, 3000);

  // Process rewards
  if (quest.rewards) {
    if (quest.rewards.dialogue) {
      state.onDialogueTrigger?.(quest.rewards.dialogue);
    }
    // TODO: Handle other reward types (unlockArea, giveItem, achievement)
  }

  // Activate next quest in chain if main quest
  if (quest.nextQuestId && !state.completedQuests.has(quest.nextQuestId)) {
    // Don't auto-activate - let level enter handle it
    logger.debug(`Next quest available: ${quest.nextQuestId}`);
  }

  // Activate unlocked branch quests
  if (quest.branchQuests) {
    for (const branchId of quest.branchQuests) {
      // Branch quests are triggered by other means, just log availability
      logger.debug(`Branch quest now available: ${branchId}`);
    }
  }

  state.onQuestStateChange?.(questId, questState);
}

/**
 * Fail a quest
 */
export function failQuest(questId: string, reason: string): void {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return;

  questState.status = 'failed';
  questState.failedAt = performance.now() * 1000;
  questState.failReason = reason;

  state.activeQuests.delete(questId);
  state.failedQuests.add(questId);

  logger.warn(`Quest failed: ${quest.name} - ${reason}`);

  if (quest.type === 'main') {
    state.onNotification?.(`MISSION FAILED: ${quest.name}`, 4000);
    state.onDialogueTrigger?.('mission_failed');
  } else {
    state.onNotification?.(`FAILED: ${quest.name}`, 3000);
  }

  state.onQuestStateChange?.(questId, questState);
}

// ============================================================================
// TRIGGER HANDLERS
// ============================================================================

/**
 * Handle object interaction trigger
 */
export function onObjectInteract(
  objectId: string,
  levelId: LevelId,
  completedLevels: LevelId[],
  inventory: Record<string, number>
): void {
  // Check for branch quests triggered by this object
  const branchQuests = getBranchQuestsForLevel(levelId);
  for (const branch of branchQuests) {
    if (
      branch.triggerType === 'object_interact' &&
      branch.triggerData?.objectId === objectId &&
      !state.completedQuests.has(branch.id) &&
      !state.activeQuests.has(branch.id) &&
      canStartQuest(branch.id, Array.from(state.completedQuests), completedLevels, inventory)
    ) {
      activateQuest(branch.id);
    }
  }

  // Check if any active quest has an interact objective for this object
  for (const [questId] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (!quest) continue;

    for (const objective of quest.objectives) {
      if (objective.type === 'interact' && state.activeQuests.get(questId)?.objectiveStatus[objective.id] === 'active') {
        completeObjective(questId, objective.id);
      }
    }
  }
}

/**
 * Handle NPC dialogue trigger
 */
export function onNPCDialogue(
  npcId: string,
  levelId: LevelId,
  completedLevels: LevelId[],
  inventory: Record<string, number>
): void {
  const branchQuests = getBranchQuestsForLevel(levelId);
  for (const branch of branchQuests) {
    if (
      branch.triggerType === 'npc_dialogue' &&
      branch.triggerData?.npcId === npcId &&
      !state.completedQuests.has(branch.id) &&
      !state.activeQuests.has(branch.id) &&
      canStartQuest(branch.id, Array.from(state.completedQuests), completedLevels, inventory)
    ) {
      activateQuest(branch.id);
    }
  }
}

/**
 * Handle area enter trigger
 */
export function onAreaEnter(
  areaId: string,
  levelId: LevelId,
  completedLevels: LevelId[],
  inventory: Record<string, number>
): void {
  const branchQuests = getBranchQuestsForLevel(levelId);
  for (const branch of branchQuests) {
    if (
      branch.triggerType === 'area_enter' &&
      branch.triggerData?.areaId === areaId &&
      !state.completedQuests.has(branch.id) &&
      !state.activeQuests.has(branch.id) &&
      canStartQuest(branch.id, Array.from(state.completedQuests), completedLevels, inventory)
    ) {
      activateQuest(branch.id);
    }
  }

  // Check if any active quest has a reach_location objective near this area
  // (This would need position data to properly check)
}

/**
 * Handle player reaching a location
 */
export function onPlayerReachLocation(position: { x: number; y: number; z: number }): void {
  for (const [questId, questState] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (!quest) continue;

    const currentObjective = quest.objectives[questState.currentObjectiveIndex];
    if (
      currentObjective &&
      currentObjective.type === 'reach_location' &&
      currentObjective.targetPosition &&
      questState.objectiveStatus[currentObjective.id] === 'active'
    ) {
      const target = currentObjective.targetPosition;
      const radius = currentObjective.targetRadius ?? 5;
      const distance = Math.sqrt(
        Math.pow(position.x - target.x, 2) +
        Math.pow(position.y - target.y, 2) +
        Math.pow(position.z - target.z, 2)
      );

      if (distance <= radius) {
        completeObjective(questId, currentObjective.id);
      }
    }
  }
}

/**
 * Handle enemy killed
 */
export function onEnemyKilled(enemyType?: string): void {
  for (const [questId, questState] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (!quest) continue;

    const currentObjective = quest.objectives[questState.currentObjectiveIndex];
    if (
      currentObjective &&
      currentObjective.type === 'kill_enemies' &&
      questState.objectiveStatus[currentObjective.id] === 'active'
    ) {
      progressObjective(questId, currentObjective.id, 1);
    }
  }
}

/**
 * Handle collectible found
 */
export function onCollectibleFound(
  collectibleId: string,
  levelId: LevelId,
  completedLevels: LevelId[],
  inventory: Record<string, number>
): void {
  const branchQuests = getBranchQuestsForLevel(levelId);
  for (const branch of branchQuests) {
    if (
      branch.triggerType === 'collectible_found' &&
      branch.triggerData?.collectibleId === collectibleId &&
      !state.completedQuests.has(branch.id) &&
      !state.activeQuests.has(branch.id) &&
      canStartQuest(branch.id, Array.from(state.completedQuests), completedLevels, inventory)
    ) {
      activateQuest(branch.id);
    }
  }

  // Progress any collect objectives
  for (const [questId, questState] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (!quest) continue;

    const currentObjective = quest.objectives[questState.currentObjectiveIndex];
    if (
      currentObjective &&
      currentObjective.type === 'collect' &&
      questState.objectiveStatus[currentObjective.id] === 'active'
    ) {
      progressObjective(questId, currentObjective.id, 1);
    }
  }
}

/**
 * Handle player death
 */
export function onPlayerDeath(): void {
  for (const [questId] of state.activeQuests) {
    const quest = QUEST_REGISTRY[questId];
    if (quest?.failOnDeath) {
      failQuest(questId, 'Player died');
    }
  }
}

// ============================================================================
// QUERY METHODS
// ============================================================================

/**
 * Get active quest for a level (main quest)
 */
export function getActiveMainQuest(levelId: LevelId): QuestState | null {
  const mainQuest = getMainQuestForLevel(levelId);
  if (!mainQuest) return null;
  return state.activeQuests.get(mainQuest.id) ?? null;
}

/**
 * Get all active quests
 */
export function getActiveQuests(): Map<string, QuestState> {
  return new Map(state.activeQuests);
}

/**
 * Check if a quest is completed
 */
export function isQuestCompleted(questId: string): boolean {
  return state.completedQuests.has(questId);
}

/**
 * Get current objective for a quest
 */
export function getCurrentObjective(questId: string): QuestObjective | null {
  const questState = state.activeQuests.get(questId);
  const quest = QUEST_REGISTRY[questId];
  if (!questState || !quest) return null;
  return quest.objectives[questState.currentObjectiveIndex] ?? null;
}

/**
 * Get quest definition
 */
export function getQuestDefinition(questId: string): QuestDefinition | null {
  return QUEST_REGISTRY[questId] ?? null;
}

/**
 * Reset quest manager (for new game)
 */
export function resetQuestManager(): void {
  state.activeQuests.clear();
  state.completedQuests.clear();
  state.failedQuests.clear();
  state.currentLevelId = null;
  logger.info('Quest manager reset');
}
