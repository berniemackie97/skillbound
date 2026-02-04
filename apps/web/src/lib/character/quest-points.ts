import type { ContentBundle } from '@skillbound/content';
import type { CharacterFacts } from '@skillbound/domain';

export function applyQuestPoints(
  facts: CharacterFacts,
  bundle: ContentBundle
): CharacterFacts {
  const completions = facts.quests ?? {};
  let total = 0;

  for (const quest of bundle.quests) {
    if (completions[quest.id]) {
      total += quest.questPoints ?? 0;
    }
  }

  facts.activities ??= {};
  facts.activities['quest_points'] = total;
  return facts;
}
