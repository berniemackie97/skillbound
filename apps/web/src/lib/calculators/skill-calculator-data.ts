import 'server-only';

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { SkillName } from '@skillbound/domain';

import type {
  CalculatorDataResponse,
  CalculatorPayload,
  CombatTrainingData,
  SkillCalculatorData,
} from './skill-calculator-types';

const COMBAT_TRAINING_SKILLS = new Set<SkillName>([
  'attack',
  'defence',
  'strength',
  'hitpoints',
  'ranged',
  'slayer',
]);

const SKILL_SLUGS: Record<SkillName, string> = {
  attack: 'combat-training',
  defence: 'combat-training',
  strength: 'combat-training',
  hitpoints: 'combat-training',
  ranged: 'combat-training',
  prayer: 'prayer',
  magic: 'magic',
  cooking: 'cooking',
  woodcutting: 'woodcutting',
  fletching: 'fletching',
  fishing: 'fishing',
  firemaking: 'firemaking',
  crafting: 'crafting',
  smithing: 'smithing',
  mining: 'mining',
  herblore: 'herblore',
  agility: 'agility',
  thieving: 'thieving',
  slayer: 'combat-training',
  farming: 'farming',
  runecraft: 'runecrafting',
  hunter: 'hunter',
  construction: 'construction',
  sailing: 'sailing',
};

const payloadCache = new Map<string, CalculatorPayload<unknown>>();

function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const relative = path.resolve(here, '../data/skill-calculators');
  if (existsSync(relative)) {
    return relative;
  }
  const cwd = process.cwd();
  const monorepoPath = path.join(cwd, 'apps/web/src/data/skill-calculators');
  if (existsSync(monorepoPath)) {
    return monorepoPath;
  }
  const appPath = path.join(cwd, 'src/data/skill-calculators');
  if (existsSync(appPath)) {
    return appPath;
  }
  return relative;
}

async function readPayload<T>(slug: string): Promise<CalculatorPayload<T>> {
  const cached = payloadCache.get(slug) as CalculatorPayload<T> | undefined;
  if (cached) {
    return cached;
  }

  const filePath = path.join(getDataDir(), `${slug}.json`);
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as CalculatorPayload<T>;
  payloadCache.set(slug, parsed as CalculatorPayload<unknown>);
  return parsed;
}

function normalizeCategories(
  categories: Record<string, string> | [] | undefined
): Record<string, string> {
  if (!categories || Array.isArray(categories)) {
    return {};
  }
  return categories;
}

export async function getCalculatorDataForSkill(
  skill: SkillName
): Promise<CalculatorDataResponse> {
  const slug = SKILL_SLUGS[skill];
  const payload = await readPayload<SkillCalculatorData | CombatTrainingData>(
    slug
  );

  if (COMBAT_TRAINING_SKILLS.has(skill)) {
    const data = payload.payload as CombatTrainingData;
    return {
      type: 'combat',
      skill,
      source: payload.source,
      fetchedAt: payload.fetchedAt,
      data: {
        ...data,
        categories: normalizeCategories(data.categories),
      },
    };
  }

  const data = payload.payload as SkillCalculatorData;
  return {
    type: 'skill',
    skill,
    source: payload.source,
    fetchedAt: payload.fetchedAt,
    data: {
      ...data,
      categories: normalizeCategories(data.categories),
    },
  };
}
