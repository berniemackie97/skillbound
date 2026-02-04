import type {
  CharacterSnapshot,
  NewCharacterSnapshot,
} from '@skillbound/database';
import {
  calculateCombatLevel,
  calculateTotalLevel,
  calculateTotalXp,
  isSkillName,
  type ProgressSnapshot,
  type SkillName,
  type SkillSnapshot,
} from '@skillbound/domain';
import type {
  HiscoresResponse,
  ParsedRuneLiteData,
} from '@skillbound/hiscores';

import {
  buildSnapshotActivities,
  buildSnapshotSkills,
} from '../requirements/requirements-context';

function buildSkillLevelMap(
  skills: SkillSnapshot[]
): Partial<Record<SkillName, number>> {
  const levels: Partial<Record<SkillName, number>> = {};

  for (const skill of skills) {
    levels[skill.name] = skill.level;
  }

  return levels;
}

export function buildSnapshotInsert(
  profileId: string,
  hiscores: HiscoresResponse,
  dataSource: 'runelite' | 'hiscores' = 'hiscores',
  dataSourceWarning?: string,
  runeliteData?: ParsedRuneLiteData
): NewCharacterSnapshot {
  const domainSkills = buildSnapshotSkills(hiscores);
  const activities = buildSnapshotActivities(hiscores);
  const totalLevel = calculateTotalLevel(domainSkills);
  const totalXp = calculateTotalXp(domainSkills);
  const combatLevel = calculateCombatLevel(buildSkillLevelMap(domainSkills));

  const skills = domainSkills.map((skill) => ({
    ...skill,
    rank: skill.rank ?? null,
  }));

  const snapshot: NewCharacterSnapshot = {
    profileId,
    capturedAt: new Date(hiscores.capturedAt),
    dataSource,
    dataSourceWarning: dataSourceWarning ?? null,
    totalLevel,
    totalXp,
    combatLevel,
    skills,
    activities: Object.keys(activities).length > 0 ? activities : null,
  };

  // Add RuneLite-specific data if available
  if (runeliteData) {
    snapshot.quests = runeliteData.quests;
    snapshot.achievementDiaries = runeliteData.achievement_diaries;
    snapshot.musicTracks = runeliteData.music_tracks;
    snapshot.combatAchievements = runeliteData.combat_achievements;
    snapshot.collectionLog = runeliteData.collection_log;
  }

  return snapshot;
}

export function toProgressSnapshot(
  snapshot: CharacterSnapshot
): ProgressSnapshot {
  const skills: SkillSnapshot[] = [];

  for (const skill of snapshot.skills) {
    if (isSkillName(skill.name)) {
      skills.push({
        name: skill.name,
        level: skill.level,
        xp: skill.xp,
        rank: skill.rank ?? null,
      });
    }
  }

  return {
    capturedAt: snapshot.capturedAt.toISOString(),
    totalLevel: snapshot.totalLevel,
    totalXp: snapshot.totalXp,
    combatLevel: snapshot.combatLevel,
    skills,
    activities: snapshot.activities ?? {},
  };
}

export function toProgressSnapshotFromDraft(
  draft: NewCharacterSnapshot
): ProgressSnapshot {
  const skills: SkillSnapshot[] = [];

  for (const skill of draft.skills) {
    if (isSkillName(skill.name)) {
      skills.push({
        name: skill.name,
        level: skill.level,
        xp: skill.xp,
        rank: skill.rank ?? null,
      });
    }
  }

  return {
    capturedAt: (draft.capturedAt ?? new Date()).toISOString(),
    totalLevel: draft.totalLevel,
    totalXp: draft.totalXp,
    combatLevel: draft.combatLevel,
    skills,
    activities: draft.activities ?? {},
  };
}
