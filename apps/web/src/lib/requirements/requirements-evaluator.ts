import type {
  CombatAchievement,
  ContentBundle,
  Diary,
  Quest,
} from '@skillbound/content';
import {
  evaluateRequirementSet,
  getDiaryKey,
  getDiaryTaskKey,
  type CharacterFacts,
  type RequirementStatus,
} from '@skillbound/domain';

function resolveBoolean(value: boolean | null | undefined): RequirementStatus {
  if (value === true) {
    return 'MET';
  }
  if (value === false) {
    return 'NOT_MET';
  }
  // Only null is truly unknown - undefined means we have data and it's not completed
  if (value === null) {
    return 'UNKNOWN';
  }
  // undefined means not in the facts object - treat as not met when we have data
  return 'NOT_MET';
}

export function evaluateQuestRequirements(quest: Quest, facts: CharacterFacts) {
  const requirements = evaluateRequirementSet(
    quest.requirements ?? [],
    quest.optionalRequirements,
    facts
  );

  const completionStatus = resolveBoolean(facts.quests?.[quest.id]);

  return {
    quest,
    completionStatus,
    requirements,
  };
}

export function evaluateDiaryRequirements(diary: Diary, facts: CharacterFacts) {
  const tiers = diary.tiers.map((tier) => {
    const tierRequirements = evaluateRequirementSet(
      tier.requirements ?? [],
      tier.optionalRequirements,
      facts
    );

    const tierKey = getDiaryKey(diary.id, tier.tier);
    const completionStatus = resolveBoolean(facts.diaries?.[tierKey]);

    const tasks = tier.tasks.map((task) => {
      const taskRequirements = evaluateRequirementSet(
        task.requirements ?? [],
        task.optionalRequirements,
        facts
      );
      const taskKey = getDiaryTaskKey(diary.id, tier.tier, task.id);

      return {
        task,
        completionStatus: resolveBoolean(facts.diaryTasks?.[taskKey]),
        requirements: taskRequirements,
      };
    });

    return {
      tier,
      completionStatus,
      requirements: tierRequirements,
      tasks,
    };
  });

  return {
    diary,
    tiers,
  };
}

export function evaluateBundleQuests(
  bundle: ContentBundle,
  facts: CharacterFacts
) {
  return bundle.quests.map((quest) => evaluateQuestRequirements(quest, facts));
}

export function evaluateBundleDiaries(
  bundle: ContentBundle,
  facts: CharacterFacts
) {
  return bundle.diaries.map((diary) => evaluateDiaryRequirements(diary, facts));
}

export function evaluateCombatAchievementRequirements(
  achievement: CombatAchievement,
  facts: CharacterFacts
) {
  const requirements = evaluateRequirementSet(
    achievement.requirements ?? [],
    achievement.optionalRequirements,
    facts
  );

  const runeliteKey =
    achievement.runeliteId !== undefined
      ? String(achievement.runeliteId)
      : null;
  const completionStatus = resolveBoolean(
    (runeliteKey ? facts.combatAchievements?.[runeliteKey] : undefined) ??
      facts.combatAchievements?.[achievement.id]
  );

  return {
    achievement,
    completionStatus,
    requirements,
  };
}

export function evaluateBundleCombatAchievements(
  bundle: ContentBundle,
  facts: CharacterFacts
) {
  return bundle.combatAchievements.map((achievement) =>
    evaluateCombatAchievementRequirements(achievement, facts)
  );
}
