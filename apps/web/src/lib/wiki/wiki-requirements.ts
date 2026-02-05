import { SKILLS, type Requirement, type SkillName } from '@skillbound/domain';

import { normalizeQuestName } from './wiki-utils';

const skillLookup = new Map<string, SkillName>(
  SKILLS.map((skill) => [skill.toLowerCase(), skill])
);

const QUEST_POINTS_KEY = 'quest_points';
const QUEST_POINTS_ALIASES = new Set(['quest points', 'quest']);

const ignoredLinkPrefixes = ['file:', 'category:', 'image:', 'special:'];

type LinkInfo = {
  target: string;
  label: string;
};

export type ParsedWikitextRequirements = {
  requirements: Requirement[];
  manual: Requirement[];
};

export function normalizeItemName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripWikiMarkup(value: string): string {
  let cleaned = value;
  cleaned = cleaned.replace(/<sup[^>]*>.*?<\/sup>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');
  cleaned = cleaned.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, '$1');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/''+/g, '');
  cleaned = cleaned.replace(/^\*+/, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}

function stripTemplates(value: string): string {
  const withoutTemplates = value.replace(/\{\{[^}]*\}\}/g, '');
  return withoutTemplates.replace(/^[,;:\-–—\s]+/, '').trim();
}

function isMeaninglessLine(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  return /^[\u2013\u2014-]+$/.test(trimmed);
}

function stripLinePrefix(value: string): string {
  return value.replace(/^[*#:/-]+/, '').trim();
}

function splitWikitextLines(raw: string): string[] {
  const normalized = raw.replace(/\r/g, '').trim();
  if (!normalized) return [];

  let lines = normalized.split('\n');
  if (lines.length === 1 && normalized.includes('*')) {
    lines = normalized.split('*');
  }

  return lines.map((line) => line.trim()).filter(Boolean);
}

function extractWikiLinks(raw: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(raw)) !== null) {
    const targetRaw = (match[1] ?? '').trim();
    if (!targetRaw) continue;
    const target = targetRaw.split('#')[0]?.trim() ?? '';
    if (!target) continue;
    const label = (match[2] ?? targetRaw).trim();
    links.push({ target, label });
  }

  return links;
}

function parseNumericLevel(value: string): number | null {
  const numberMatch = value.match(/\d+/);
  if (!numberMatch) return null;
  const level = Number(numberMatch[0]);
  return Number.isFinite(level) && level > 0 ? level : null;
}

function parseScpTemplates(raw: string): Requirement[] {
  const requirements: Requirement[] = [];
  const seen = new Set<string>();
  const regex = /\{\{\s*SCP\s*\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const rawSkill = match[1]?.trim() ?? '';
    const levelRaw = match[2]?.trim() ?? '';
    const level = parseNumericLevel(levelRaw);
    if (!level) continue;

    const normalized = rawSkill.toLowerCase();

    if (QUEST_POINTS_ALIASES.has(normalized)) {
      const key = `${QUEST_POINTS_KEY}:${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push({
        type: 'activity-score',
        activityKey: QUEST_POINTS_KEY,
        score: level,
      });
      continue;
    }

    if (normalized === 'combat level' || normalized === 'combat') {
      const key = `combat:${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push({
        type: 'combat-level',
        level,
      });
      continue;
    }

    const skill = skillLookup.get(normalized);
    if (!skill) {
      continue;
    }

    const key = `${skill}:${level}`;
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      type: 'skill-level',
      skill,
      level,
    });
  }

  return requirements;
}

function parseCombatTemplate(raw: string): Requirement[] {
  const requirements: Requirement[] = [];
  const regex = /\{\{\s*Combat(?:\s+level)?\s*\|\s*([0-9]+)\s*\}\}/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const level = parseNumericLevel(match[1] ?? '');
    if (!level) continue;
    requirements.push({ type: 'combat-level', level });
  }
  return requirements;
}

function normalizeItemCandidate(value: string): string {
  let cleaned = value;
  cleaned = cleaned.replace(/\b(?:x|×)\s*\d+\b/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*x\b/gi, '');
  cleaned = cleaned.replace(/^\b(a|an|the|one|any|some)\b\s+/i, '');
  return cleaned.trim();
}

function resolveItemId(
  value: string,
  itemMap: Map<string, number>
): number | null {
  const normalized = normalizeItemName(normalizeItemCandidate(value));
  if (!normalized) return null;
  return itemMap.get(normalized) ?? null;
}

function lineIsNote(cleaned: string): boolean {
  return /^(note:|this can also|this can be|this task can|for example|e\.g\.)/i.test(
    cleaned
  );
}

function lineIndicatesPartialQuest(cleaned: string): boolean {
  return /(partial completion|partially complete|started|begin)/i.test(cleaned);
}

function parseSkillRequirements(raw: string): Requirement[] {
  const requirements: Requirement[] = [];
  const seen = new Set<string>();
  const regex = /data-skill="([^"]+)"[^>]*data-level="(\d+)"/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const rawSkill = match[1]?.trim() ?? '';
    const level = Number(match[2]);
    if (!Number.isFinite(level) || level <= 0) {
      continue;
    }

    const normalized = rawSkill.toLowerCase();

    if (QUEST_POINTS_ALIASES.has(normalized)) {
      const key = `${QUEST_POINTS_KEY}:${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push({
        type: 'activity-score',
        activityKey: QUEST_POINTS_KEY,
        score: level,
      });
      continue;
    }

    if (normalized === 'combat level' || normalized === 'combat') {
      const key = `combat:${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push({
        type: 'combat-level',
        level,
      });
      continue;
    }

    const skill = skillLookup.get(normalized);
    if (!skill) {
      continue;
    }

    const key = `${skill}:${level}`;
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      type: 'skill-level',
      skill,
      level,
    });
  }

  return requirements;
}

function parseQuestRequirements(
  raw: string,
  knownQuestIds: Set<string>
): Requirement[] {
  const requirements: Requirement[] = [];
  const seen = new Set<string>();
  const linkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(raw)) !== null) {
    const link = (match[1] ?? '').trim();
    if (!link) continue;

    const normalizedLink = link.toLowerCase();
    if (
      ignoredLinkPrefixes.some((prefix) => normalizedLink.startsWith(prefix))
    ) {
      continue;
    }
    if (normalizedLink === 'quest points') {
      continue;
    }

    const questId = normalizeQuestName(link);
    if (!questId) continue;
    if (!knownQuestIds.has(questId)) {
      continue;
    }

    if (seen.has(questId)) continue;
    seen.add(questId);
    requirements.push({
      type: 'quest-complete',
      questId,
    });
  }

  return requirements;
}

function lineHasQuestLink(line: string, knownQuestIds: Set<string>): boolean {
  const linkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(line)) !== null) {
    const link = (match[1] ?? '').trim();
    if (!link) continue;
    const normalizedLink = link.toLowerCase();
    if (
      ignoredLinkPrefixes.some((prefix) => normalizedLink.startsWith(prefix))
    ) {
      continue;
    }
    const questId = normalizeQuestName(link);
    if (knownQuestIds.has(questId)) {
      return true;
    }
  }
  return false;
}

function parseManualRequirements(
  raw: string,
  knownQuestIds: Set<string>
): Requirement[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const manual: Requirement[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (line.includes('data-skill=')) {
      continue;
    }
    const cleaned = stripWikiMarkup(line);
    const cleanedText = stripTemplates(cleaned);
    if (isMeaninglessLine(cleanedText)) continue;
    if (/^(none|no requirements listed|n\/a)$/i.test(cleanedText)) {
      continue;
    }
    if (/^completion of/i.test(cleaned)) continue;
    if (/^skill requirements?/i.test(cleaned)) continue;
    if (lineHasQuestLink(line, knownQuestIds)) {
      if (!lineIndicatesPartialQuest(cleanedText)) {
        continue;
      }
    }
    if (lineIsNote(cleanedText)) continue;

    if (seen.has(cleanedText)) continue;
    seen.add(cleanedText);
    manual.push({
      type: 'manual-check',
      label: cleanedText,
    });
  }

  return manual;
}

export function parseQuestRequirementBlocks(
  requirements: string | undefined,
  knownQuestIds: Set<string>
): { required: Requirement[]; manual: Requirement[] } {
  if (!requirements) {
    return { required: [], manual: [] };
  }

  const required: Requirement[] = [
    ...parseSkillRequirements(requirements),
    ...parseQuestRequirements(requirements, knownQuestIds),
  ];

  const manual: Requirement[] = parseManualRequirements(
    requirements,
    knownQuestIds
  );

  return { required, manual };
}

export function parseQuestItemRequirements(
  itemsRequired: string | undefined,
  itemMap: Map<string, number>,
  knownQuestIds?: Set<string>
): ParsedWikitextRequirements {
  return parseWikitextRequirements(itemsRequired, {
    knownQuestIds: knownQuestIds ?? new Set(),
    itemMap,
  });
}

export function parseWikitextRequirements(
  raw: string | undefined,
  options: {
    knownQuestIds: Set<string>;
    itemMap?: Map<string, number>;
  }
): ParsedWikitextRequirements {
  if (!raw) {
    return { requirements: [], manual: [] };
  }

  const requirements: Requirement[] = [];
  const manual: Requirement[] = [];
  const seen = new Set<string>();
  const manualSeen = new Set<string>();

  const lines = splitWikitextLines(raw);

  for (const line of lines) {
    const trimmed = stripLinePrefix(line);
    if (!trimmed) continue;

    if (/\{\{\s*NA\s*\|\s*None\s*\}\}/i.test(trimmed)) {
      continue;
    }

    const cleaned = stripWikiMarkup(trimmed);
    const cleanedText = stripTemplates(cleaned);

    const lineRequirements: Requirement[] = [];

    const scpRequirements = [
      ...parseScpTemplates(trimmed),
      ...parseCombatTemplate(trimmed),
    ];

    if (isMeaninglessLine(cleanedText) && scpRequirements.length === 0) {
      continue;
    }
    if (cleanedText && /^(none|no requirements listed|n\/a)$/i.test(cleaned)) {
      continue;
    }
    if (cleanedText && lineIsNote(cleanedText)) continue;

    for (const req of scpRequirements) {
      const key = requirementKey(req);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      lineRequirements.push(req);
    }

    const links = extractWikiLinks(trimmed);
    const itemIds: number[] = [];
    let hasUnmappedItem = false;
    let addedQuest = false;

    if (!lineIndicatesPartialQuest(cleaned)) {
      for (const link of links) {
        const normalizedTarget = link.target.toLowerCase();
        if (
          ignoredLinkPrefixes.some((prefix) =>
            normalizedTarget.startsWith(prefix)
          )
        ) {
          continue;
        }
        const questId = normalizeQuestName(link.target);
        if (questId && options.knownQuestIds.has(questId)) {
          const req: Requirement = { type: 'quest-complete', questId };
          const key = requirementKey(req);
          if (key && seen.has(key)) continue;
          if (key) seen.add(key);
          lineRequirements.push(req);
          addedQuest = true;
        }
      }
    }

    if (options.itemMap) {
      for (const link of links) {
        const normalizedTarget = link.target.toLowerCase();
        if (
          ignoredLinkPrefixes.some((prefix) =>
            normalizedTarget.startsWith(prefix)
          )
        ) {
          continue;
        }
        if (options.knownQuestIds.has(normalizeQuestName(link.target))) {
          continue;
        }

        const candidate = link.label || link.target;
        const itemId = resolveItemId(candidate, options.itemMap);
        if (itemId !== null) {
          itemIds.push(itemId);
        } else {
          hasUnmappedItem = true;
        }
      }

      if (!links.length && !addedQuest && scpRequirements.length === 0) {
        const itemId = resolveItemId(cleanedText, options.itemMap);
        if (itemId !== null) {
          itemIds.push(itemId);
        } else if (cleanedText.length > 0) {
          hasUnmappedItem = true;
        }
      }
    }

    const uniqueItemIds = Array.from(new Set(itemIds));
    const hasOr = /\bor\b/i.test(cleanedText);

    if (uniqueItemIds.length > 1 && hasOr) {
      const anyOf: Requirement = {
        type: 'any-of',
        requirements: uniqueItemIds.map((itemId) => ({
          type: 'item-possessed',
          itemId,
        })),
      };
      const key = requirementKey(anyOf);
      if (!key || !seen.has(key)) {
        if (key) seen.add(key);
        lineRequirements.push(anyOf);
      }
    } else {
      for (const itemId of uniqueItemIds) {
        const req: Requirement = { type: 'item-possessed', itemId };
        const key = requirementKey(req);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        lineRequirements.push(req);
      }
    }

    if (lineRequirements.length === 0) {
      if (!isMeaninglessLine(cleanedText) && !manualSeen.has(cleanedText)) {
        manualSeen.add(cleanedText);
        manual.push({ type: 'manual-check', label: cleanedText });
      }
      continue;
    }

    if (
      hasUnmappedItem &&
      !isMeaninglessLine(cleanedText) &&
      !manualSeen.has(cleanedText)
    ) {
      manualSeen.add(cleanedText);
      manual.push({ type: 'manual-check', label: cleanedText });
    }

    requirements.push(...lineRequirements);
  }

  return { requirements, manual };
}

export function buildWikiUrl(pageName: string | undefined): string | undefined {
  if (!pageName) return undefined;
  const normalized = pageName.replace(/\s+/g, '_');
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(normalized)}`;
}

function requirementKey(requirement: Requirement): string | null {
  switch (requirement.type) {
    case 'skill-level':
      return `skill:${requirement.skill}:${requirement.level}`;
    case 'combat-level':
      return `combat:${requirement.level}`;
    case 'activity-score':
      return `activity:${requirement.activityKey}:${requirement.score}`;
    case 'quest-complete':
      return `quest:${requirement.questId}`;
    case 'item-possessed':
      return `item:${requirement.itemId}`;
    case 'manual-check':
      return `manual:${requirement.label}`;
    case 'all-of':
    case 'any-of': {
      const childKeys = requirement.requirements
        .map((child) => requirementKey(child))
        .filter((key): key is string => Boolean(key))
        .sort();
      return `${requirement.type}:${childKeys.join('|')}`;
    }
    default:
      return null;
  }
}
