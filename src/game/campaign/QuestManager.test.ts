/**
 * QuestManager Tests
 *
 * Tests for the quest system runtime state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeQuestManager,
  resetQuestManager,
  activateQuest,
  progressObjective,
  completeObjective,
  getActiveQuests,
  getCurrentObjective,
  isQuestCompleted,
  onLevelEnter,
  onLevelExit,
  onEnemyKilled,
  updateTimedObjectives,
  getObjectiveTimeRemaining,
  getQuestTrackerData,
  getObjectiveProgress,
} from './QuestManager';
import { QUEST_REGISTRY, MAIN_QUEST_CHAIN } from './QuestChain';

describe('QuestManager', () => {
  beforeEach(() => {
    resetQuestManager();
    // Initialize with mock callbacks
    initializeQuestManager({
      onObjectiveUpdate: vi.fn(),
      onObjectiveMarker: vi.fn(),
      onDialogueTrigger: vi.fn(),
      onNotification: vi.fn(),
      onQuestStateChange: vi.fn(),
    });
  });

  describe('Quest Activation', () => {
    it('should activate a quest', () => {
      const questId = 'main_anchor_station';
      const result = activateQuest(questId);

      expect(result).toBe(true);
      expect(getActiveQuests().has(questId)).toBe(true);
    });

    it('should not activate an already active quest', () => {
      const questId = 'main_anchor_station';
      activateQuest(questId);
      const result = activateQuest(questId);

      expect(result).toBe(false);
    });

    it('should not activate a non-existent quest', () => {
      const result = activateQuest('fake_quest');

      expect(result).toBe(false);
    });

    it('should set first objective to active status', () => {
      const questId = 'main_anchor_station';
      activateQuest(questId);

      const objective = getCurrentObjective(questId);
      expect(objective).not.toBeNull();
      expect(objective?.id).toBe('anchor_wake');
    });
  });

  describe('Objective Progress', () => {
    it('should track progress for count-based objectives', () => {
      // Use landfall which has kill_enemies objective
      const questId = 'main_landfall';
      activateQuest(questId);

      // Advance to the kill enemies objective
      completeObjective(questId, 'landfall_drop');
      completeObjective(questId, 'landfall_chute');
      completeObjective(questId, 'landfall_regroup');

      // Now we're on landfall_combat which requires 10 kills
      const objective = getCurrentObjective(questId);
      expect(objective?.type).toBe('kill_enemies');
      expect(objective?.required).toBe(10);

      // Progress the objective
      progressObjective(questId, 'landfall_combat', 5);

      const progress = getObjectiveProgress(questId, 'landfall_combat');
      expect(progress).toEqual({ current: 5, required: 10 });
    });

    it('should auto-complete objective when progress reaches required', () => {
      const questId = 'main_landfall';
      activateQuest(questId);

      // Advance to kill enemies objective
      completeObjective(questId, 'landfall_drop');
      completeObjective(questId, 'landfall_chute');
      completeObjective(questId, 'landfall_regroup');

      // Complete all kills
      progressObjective(questId, 'landfall_combat', 10);

      // Should have moved to next objective
      const objective = getCurrentObjective(questId);
      expect(objective?.id).toBe('landfall_extract');
    });
  });

  describe('Quest Completion', () => {
    it('should mark quest as completed when all objectives done', () => {
      const questId = 'main_anchor_station';
      activateQuest(questId);

      // Complete all objectives in order
      const quest = QUEST_REGISTRY[questId];
      for (const objective of quest.objectives) {
        completeObjective(questId, objective.id);
      }

      expect(isQuestCompleted(questId)).toBe(true);
      expect(getActiveQuests().has(questId)).toBe(false);
    });
  });

  describe('Level Enter/Exit', () => {
    it('should activate main quest on level enter', () => {
      onLevelEnter('anchor_station', [], {});

      const quests = getActiveQuests();
      expect(quests.has('main_anchor_station')).toBe(true);
    });

    it('should not re-activate completed quest on level enter', () => {
      // Complete the quest first
      activateQuest('main_anchor_station');
      const quest = QUEST_REGISTRY['main_anchor_station'];
      for (const obj of quest.objectives) {
        completeObjective('main_anchor_station', obj.id);
      }

      expect(isQuestCompleted('main_anchor_station')).toBe(true);

      // Re-enter the level
      onLevelEnter('anchor_station', [], {});

      // Should not be active again
      expect(getActiveQuests().has('main_anchor_station')).toBe(false);
    });
  });

  describe('Enemy Killed Trigger', () => {
    it('should progress kill_enemies objectives', () => {
      const questId = 'main_landfall';
      activateQuest(questId);

      // Advance to kill enemies objective
      completeObjective(questId, 'landfall_drop');
      completeObjective(questId, 'landfall_chute');
      completeObjective(questId, 'landfall_regroup');

      const initialProgress = getObjectiveProgress(questId, 'landfall_combat');
      expect(initialProgress?.current).toBe(0);

      onEnemyKilled('chitin');

      const newProgress = getObjectiveProgress(questId, 'landfall_combat');
      expect(newProgress?.current).toBe(1);
    });
  });

  describe('Timed Objectives', () => {
    it('should track time remaining for timed objectives', () => {
      // The breach quest has a timed escape objective
      const questId = 'main_breach';
      activateQuest(questId);

      // Advance to the escape objective which has timeLimit: 120
      completeObjective(questId, 'breach_descent');
      completeObjective(questId, 'breach_navigate');
      completeObjective(questId, 'breach_ambush');
      completeObjective(questId, 'breach_lair');
      completeObjective(questId, 'breach_queen');

      // Now on escape objective with 120 second timer
      const objective = getCurrentObjective(questId);
      expect(objective?.id).toBe('breach_escape');
      expect(objective?.timeLimit).toBe(120);

      // Start timer tick
      updateTimedObjectives(0);

      const timeRemaining = getObjectiveTimeRemaining(questId);
      expect(timeRemaining).toBe(120);

      // Advance timer
      updateTimedObjectives(30);

      const newTimeRemaining = getObjectiveTimeRemaining(questId);
      expect(newTimeRemaining).toBeCloseTo(90, 0);
    });

    it('should fail quest when timer expires and failOnTimer is true', () => {
      const questId = 'main_breach';
      activateQuest(questId);

      // Advance to timed objective
      completeObjective(questId, 'breach_descent');
      completeObjective(questId, 'breach_navigate');
      completeObjective(questId, 'breach_ambush');
      completeObjective(questId, 'breach_lair');
      completeObjective(questId, 'breach_queen');

      // Start and expire timer
      updateTimedObjectives(0);
      const expired = updateTimedObjectives(130); // Expire the 120s timer

      expect(expired).toBe(true);
      expect(getActiveQuests().has(questId)).toBe(false);
    });
  });

  describe('Quest Tracker Data', () => {
    it('should return tracker data for active quest', () => {
      onLevelEnter('anchor_station', [], {});

      const data = getQuestTrackerData('anchor_station');

      expect(data).not.toBeNull();
      expect(data?.questId).toBe('main_anchor_station');
      expect(data?.questName).toBe('Report to Commander Reyes'); // briefDescription
      expect(data?.isMain).toBe(true);
      expect(data?.objectiveDescription).toBe('Exit barracks and proceed to briefing room');
      expect(data?.objectiveType).toBe('reach_location');
    });

    it('should return null when no active quest', () => {
      const data = getQuestTrackerData('anchor_station');

      expect(data).toBeNull();
    });

    it('should include progress for count-based objectives', () => {
      const questId = 'main_landfall';
      onLevelEnter('landfall', [], {});

      // Advance to kill enemies objective
      completeObjective(questId, 'landfall_drop');
      completeObjective(questId, 'landfall_chute');
      completeObjective(questId, 'landfall_regroup');
      progressObjective(questId, 'landfall_combat', 3);

      const data = getQuestTrackerData('landfall');

      expect(data?.current).toBe(3);
      expect(data?.required).toBe(10);
    });
  });

  describe('Main Quest Chain', () => {
    it('should have 10 main campaign quests', () => {
      expect(MAIN_QUEST_CHAIN.length).toBe(10);
    });

    it('should have all main quests in registry', () => {
      for (const quest of MAIN_QUEST_CHAIN) {
        expect(QUEST_REGISTRY[quest.id]).toBeDefined();
        expect(QUEST_REGISTRY[quest.id].type).toBe('main');
      }
    });

    it('should have linked nextQuestId chain', () => {
      // First 9 quests should link to next
      for (let i = 0; i < MAIN_QUEST_CHAIN.length - 1; i++) {
        const quest = MAIN_QUEST_CHAIN[i];
        expect(quest.nextQuestId).toBe(MAIN_QUEST_CHAIN[i + 1].id);
      }

      // Last quest has no next
      expect(MAIN_QUEST_CHAIN[9].nextQuestId).toBeUndefined();
    });
  });
});
