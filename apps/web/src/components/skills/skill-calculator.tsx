'use client';

import {
  ARTISAN_SKILLS,
  COMBAT_SKILLS,
  GATHERING_SKILLS,
  MAX_LEVEL,
  MAX_XP,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  SUPPORT_SKILLS,
  getLevelForXp,
  getXpForLevel,
  type SkillName,
} from '@skillbound/domain';
import type { HiscoresResponse } from '@skillbound/hiscores';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  CalculatorDataResponse,
  CalculatorItem,
  CombatMonster,
  SkillAction,
} from '@/lib/calculators/skill-calculator-types';

type SkillSnapshot = {
  name: string;
  level: number;
  xp: number;
};

type LookupMeta = {
  cached?: boolean;
  mode?: string;
};

type SkillCalculatorProps = {
  activeCharacterName?: string | null;
  snapshotSkills?: SkillSnapshot[] | null;
  initialSkill: SkillName;
  initialCalculator: CalculatorDataResponse;
  initialMode: string;
  initialUsername: string;
  initialCurrentLevel: string;
  initialCurrentXp: string;
  initialTargetLevel: string;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const RUNECRAFT_MULTIPLIERS: Record<string, Record<number, number>> = {
  'Air rune': {
    11: 2,
    22: 3,
    33: 4,
    44: 5,
    55: 6,
    66: 7,
    77: 8,
    88: 9,
    99: 10,
  },
  'Mind rune': { 14: 2, 28: 3, 42: 4, 56: 5, 70: 6, 84: 7, 98: 8 },
  'Water rune': { 19: 2, 38: 3, 57: 4, 76: 5, 95: 6 },
  'Earth rune': { 26: 2, 52: 3, 78: 4, 104: 5 },
  'Fire rune': { 35: 2, 70: 3, 105: 4 },
  'Body rune': { 46: 2, 92: 3 },
  'Cosmic rune': { 59: 2 },
  'Chaos rune': { 74: 2 },
  'Astral rune': { 82: 2 },
  'Nature rune': { 91: 2 },
  'Law rune': { 95: 2 },
  'Death rune': { 99: 2 },
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}

function formatGp(value: number | null): string {
  if (value === null) {
    return '-';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(2)}b`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(2)}m`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}k`;
  }
  return `${sign}${absValue.toLocaleString()}`;
}

function parseNumber(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safeGetXpForLevel(level: number) {
  try {
    return getXpForLevel(level);
  } catch {
    return null;
  }
}

function safeGetLevelForXp(xp: number) {
  try {
    return getLevelForXp(xp);
  } catch {
    return null;
  }
}

function buildWikiUrl(title: string) {
  const slug = title.replace(/\s+/g, '_');
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(slug)}`;
}

function resolveActionImage(image?: string | null): string | null {
  if (!image) {
    return null;
  }
  const trimmed = image.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `https://oldschool.tools${trimmed}`;
  }
  return `https://oldschool.tools/${trimmed.replace(/^\//, '')}`;
}

function normalizeWikiKey(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function getSkillEntryFromLookup(
  lookup: HiscoresResponse | null,
  skill: SkillName
) {
  if (!lookup) {
    return null;
  }
  return lookup.skills.find((entry) => entry.key === skill) ?? null;
}

function getItemPrice(
  item: CalculatorItem,
  useRealTimePrices: boolean
): number | null {
  if (
    useRealTimePrices &&
    item.real_time_price !== undefined &&
    item.real_time_price !== null
  ) {
    return item.real_time_price;
  }
  if (item.price !== undefined && item.price !== null) {
    return item.price;
  }
  return null;
}

function sumItemValue(
  items: CalculatorItem[] | null | undefined,
  useRealTimePrices: boolean
) {
  if (!items || items.length === 0) {
    return 0;
  }
  return items.reduce((total, item) => {
    const price = getItemPrice(item, useRealTimePrices);
    if (price === null) {
      return total;
    }
    const amount = item.amount ?? 1;
    return total + price * amount;
  }, 0);
}

function calculateRunecraftProfit({
  action,
  xpRemaining,
  currentXp,
  targetXp,
  useRealTimePrices,
}: {
  action: SkillAction;
  xpRemaining: number;
  currentXp: number;
  targetXp: number;
  useRealTimePrices: boolean;
}) {
  const baseName = action.name.replace(/\s*\(Daeyalt\)$/, '');
  const multiplierTable = RUNECRAFT_MULTIPLIERS[baseName];
  if (!multiplierTable) {
    return null;
  }

  const revenuePerEssence = sumItemValue(
    action.products ?? null,
    useRealTimePrices
  );
  const costPerEssence = sumItemValue(
    action.components ?? null,
    useRealTimePrices
  );
  let totalProfit = 0;
  let xpCursor = currentXp;

  while (xpCursor < targetXp) {
    const level = safeGetLevelForXp(xpCursor) ?? 1;
    let nextThreshold: number | null = null;
    let runeMultiplier = 1;

    for (const [thresholdRaw, multiplier] of Object.entries(multiplierTable)) {
      const threshold = Number(thresholdRaw);
      if (level >= threshold) {
        runeMultiplier = multiplier;
      } else if (nextThreshold === null || threshold < nextThreshold) {
        nextThreshold = threshold;
      }
    }

    const nextXp = nextThreshold
      ? (safeGetXpForLevel(nextThreshold) ?? targetXp)
      : targetXp;
    const targetSegmentXp = Math.min(nextXp, targetXp);
    const xpDelta = Math.max(0, targetSegmentXp - xpCursor);
    const actionsNeeded = Math.ceil(xpDelta / action.exp_given);
    totalProfit +=
      actionsNeeded * (revenuePerEssence - costPerEssence) * runeMultiplier;
    xpCursor += actionsNeeded * action.exp_given;

    if (actionsNeeded === 0) {
      break;
    }
  }

  if (xpRemaining <= 0) {
    return 0;
  }

  return totalProfit;
}

function calculateCombatXpPerDamage({
  skill,
  combatStyle,
  usingControlled,
}: {
  skill: SkillName;
  combatStyle: 'melee' | 'magic' | 'ranged';
  usingControlled: boolean;
}) {
  const controlled = usingControlled && combatStyle === 'melee';
  if (skill === 'slayer') {
    return 1;
  }
  if (skill === 'hitpoints' || controlled) {
    return 1.33;
  }
  if (skill === 'magic') {
    return 2;
  }
  if (skill === 'defence' && combatStyle === 'magic') {
    return 2;
  }
  if (skill === 'ranged' && combatStyle === 'ranged') {
    return 4;
  }
  if (skill === 'defence' && combatStyle === 'ranged') {
    return 2;
  }
  return 4;
}

function buildSkillGroups() {
  const combatGroup = [...COMBAT_SKILLS, 'slayer'] as SkillName[];
  const supportGroup = SUPPORT_SKILLS.filter((entry) => entry !== 'slayer');
  return [
    { label: 'Combat', skills: combatGroup },
    { label: 'Gathering', skills: GATHERING_SKILLS },
    { label: 'Artisan', skills: ARTISAN_SKILLS },
    { label: 'Support', skills: supportGroup },
  ];
}

export default function SkillCalculator({
  activeCharacterName,
  snapshotSkills,
  initialSkill,
  initialCalculator,
  initialMode,
  initialUsername,
  initialCurrentLevel,
  initialCurrentXp,
  initialTargetLevel,
}: SkillCalculatorProps) {
  const [skill, setSkill] = useState<SkillName>(initialSkill);
  const [calculator, setCalculator] =
    useState<CalculatorDataResponse>(initialCalculator);
  const [loadingCalculator, setLoadingCalculator] = useState(false);
  const [calculatorError, setCalculatorError] = useState<string | null>(null);

  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState(initialUsername);
  const initialCurrentLevelValue = clampNumber(
    parseNumber(initialCurrentLevel) ?? 1,
    1,
    MAX_LEVEL
  );
  const initialCurrentXpValue = clampNumber(
    parseNumber(initialCurrentXp) ?? 0,
    0,
    MAX_XP
  );
  const initialTargetLevelValue = clampNumber(
    parseNumber(initialTargetLevel) ?? 2,
    1,
    MAX_LEVEL
  );
  const initialTargetXpValue = safeGetXpForLevel(initialTargetLevelValue) ?? 83;

  const [currentLevel, setCurrentLevel] = useState(initialCurrentLevelValue);
  const [currentXp, setCurrentXp] = useState(initialCurrentXpValue);
  const [targetLevel, setTargetLevel] = useState(initialTargetLevelValue);
  const [targetLevelInput, setTargetLevelInput] = useState(
    String(initialTargetLevelValue)
  );
  const [targetXp, setTargetXp] = useState(initialTargetXpValue);

  const [lookupData, setLookupData] = useState<HiscoresResponse | null>(null);
  const [lookupMeta, setLookupMeta] = useState<LookupMeta | null>(null);
  const [lookupStatus, setLookupStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(0);
  const [hideMembers, setHideMembers] = useState(false);
  const [selectedBonuses, setSelectedBonuses] = useState<number[]>([]);
  const [useRealTimePrices, setUseRealTimePrices] = useState(false);
  const [actionsPerHourInput, setActionsPerHourInput] = useState('');
  const [sortBy, setSortBy] = useState<
    'level' | 'exp' | 'actions' | 'profit' | 'name' | 'hitpoints'
  >('level');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [combatStyle, setCombatStyle] = useState<'melee' | 'magic' | 'ranged'>(
    'melee'
  );
  const [usingControlled, setUsingControlled] = useState(false);
  const [killsPerHourInput, setKillsPerHourInput] = useState('');
  const [customMonsters, setCustomMonsters] = useState<CombatMonster[]>([]);
  const [isAddingMonster, setIsAddingMonster] = useState(false);
  const [newMonsterName, setNewMonsterName] = useState('');
  const [newMonsterLevel, setNewMonsterLevel] = useState('');
  const [newMonsterHitpoints, setNewMonsterHitpoints] = useState('');
  const [newMonsterBonus, setNewMonsterBonus] = useState('');
  const [monsterImages, setMonsterImages] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    setTargetLevelInput(String(targetLevel));
  }, [targetLevel]);

  const snapshotSkillMap = useMemo(() => {
    const map = new Map<SkillName, SkillSnapshot>();
    if (!snapshotSkills) {
      return map;
    }
    for (const entry of snapshotSkills) {
      if (SKILLS.includes(entry.name as SkillName)) {
        map.set(entry.name as SkillName, entry);
      }
    }
    return map;
  }, [snapshotSkills]);

  const skillGroups = useMemo(() => buildSkillGroups(), []);

  const xpRemaining = Math.max(0, targetXp - currentXp);
  const currentLevelBaseXp = safeGetXpForLevel(currentLevel) ?? 0;
  const progressBaseXp = Math.min(currentXp, currentLevelBaseXp);
  const progressDenominator = Math.max(1, targetXp - progressBaseXp);
  const progressNumerator = Math.max(0, currentXp - progressBaseXp);
  const progressPercent =
    targetXp <= progressBaseXp
      ? 100
      : Math.min(100, (progressNumerator / progressDenominator) * 100);
  const showControlledToggle =
    skill === 'attack' ||
    skill === 'strength' ||
    (skill === 'defence' && combatStyle === 'melee');
  const actionsPerHour = clampNumber(
    parseNumber(actionsPerHourInput) ?? 0,
    0,
    1_000_000
  );
  const killsPerHour = clampNumber(
    parseNumber(killsPerHourInput) ?? 0,
    0,
    1_000_000
  );

  const applySkillSnapshot = useCallback(
    (skillKey: SkillName) => {
      const entry = snapshotSkillMap.get(skillKey);
      if (!entry) {
        return false;
      }
      setCurrentLevel(entry.level);
      setCurrentXp(entry.xp);
      const nextTargetLevel = clampNumber(entry.level + 1, 1, MAX_LEVEL);
      setTargetLevel(nextTargetLevel);
      const nextTargetXp = safeGetXpForLevel(nextTargetLevel);
      if (nextTargetXp !== null) {
        setTargetXp(nextTargetXp);
      }
      return true;
    },
    [snapshotSkillMap]
  );

  const applyLookupSkill = useCallback(
    (skillKey: SkillName, lookup: HiscoresResponse | null) => {
      const entry = getSkillEntryFromLookup(lookup, skillKey);
      if (!entry) {
        return false;
      }
      setCurrentLevel(entry.level);
      setCurrentXp(entry.xp);
      const nextTargetLevel = clampNumber(entry.level + 1, 1, MAX_LEVEL);
      setTargetLevel(nextTargetLevel);
      const nextTargetXp = safeGetXpForLevel(nextTargetLevel);
      if (nextTargetXp !== null) {
        setTargetXp(nextTargetXp);
      }
      return true;
    },
    []
  );

  const handleLookup = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setLookupStatus('error');
      setLookupError('Enter a username to lookup hiscores data.');
      return;
    }

    setLookupStatus('loading');
    setLookupError(null);

    const params = new URLSearchParams();
    params.set('username', trimmed);
    if (mode) {
      params.set('mode', mode);
    }

    try {
      const response = await fetch(
        `/api/characters/lookup?${params.toString()}`
      );
      if (!response.ok) {
        const payload = (await response.json()) as {
          detail?: string;
          title?: string;
        };
        throw new Error(
          payload.detail ??
            payload.title ??
            'Unable to load hiscores for that username.'
        );
      }
      const payload = (await response.json()) as {
        data: HiscoresResponse;
        meta?: LookupMeta;
      };
      setLookupData(payload.data);
      setLookupMeta(payload.meta ?? null);
      setLookupStatus('success');
      setLookupError(null);

      if (!applyLookupSkill(skill, payload.data)) {
        setLookupStatus('error');
        setLookupError('That lookup did not include data for this skill.');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load hiscores for that username.';
      setLookupStatus('error');
      setLookupError(message);
    }
  }, [applyLookupSkill, mode, skill, username]);

  const handleUseActive = useCallback(() => {
    setLookupData(null);
    setLookupMeta(null);
    setLookupStatus('idle');
    setLookupError(null);
    if (activeCharacterName) {
      setUsername(activeCharacterName);
    }
    applySkillSnapshot(skill);
  }, [activeCharacterName, applySkillSnapshot, skill]);

  const handleSkillChange = useCallback(
    (nextSkill: SkillName) => {
      if (nextSkill === skill) {
        return;
      }

      setSkill(nextSkill);
      setFilter('');
      setCategoryFilter(0);
      setHideMembers(false);
      setSelectedBonuses([]);
      setSortBy('level');
      setSortDirection('asc');
      setUseRealTimePrices(false);
      setActionsPerHourInput('');
      setCombatStyle('melee');
      setUsingControlled(false);
      setKillsPerHourInput('');
      setCustomMonsters([]);
      setIsAddingMonster(false);
      setNewMonsterName('');
      setNewMonsterLevel('');
      setNewMonsterHitpoints('');
      setNewMonsterBonus('');

      // Update URL without triggering server re-fetch
      const params = new URLSearchParams(window.location.search);
      params.set('skill', nextSkill);
      window.history.replaceState(
        null,
        '',
        `/calculators?${params.toString()}`
      );

      if (lookupData && applyLookupSkill(nextSkill, lookupData)) {
        return;
      }
      const snapshotApplied = applySkillSnapshot(nextSkill);
      if (!snapshotApplied) {
        setCurrentLevel(1);
        setCurrentXp(0);
        setTargetLevel(2);
        const defaultTargetXp = safeGetXpForLevel(2);
        if (defaultTargetXp !== null) {
          setTargetXp(defaultTargetXp);
        }
      }
    },
    [applyLookupSkill, applySkillSnapshot, lookupData, skill]
  );

  useEffect(() => {
    if (skill === 'defence' && combatStyle !== 'melee' && usingControlled) {
      setUsingControlled(false);
    }
  }, [combatStyle, skill, usingControlled]);

  useEffect(() => {
    if (calculator.skill === skill) {
      return;
    }

    let isActive = true;
    setLoadingCalculator(true);
    setCalculatorError(null);

    fetch(`/api/calculators/skill?skill=${skill}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? 'Unable to load calculator data.');
        }
        return (await response.json()) as { data: CalculatorDataResponse };
      })
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setCalculator(payload.data);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load calculator data.';
        setCalculatorError(message);
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setLoadingCalculator(false);
      });

    return () => {
      isActive = false;
    };
  }, [calculator.skill, skill]);

  const lookupLabel = lookupData?.displayName ?? lookupData?.username ?? '';
  const lookupMetaLabel = lookupMeta?.mode ? ` (${lookupMeta.mode})` : '';

  const skillData = calculator.type === 'skill' ? calculator.data : null;
  const combatData = calculator.type === 'combat' ? calculator.data : null;

  const categoryOptions = useMemo(() => {
    if (!skillData) {
      return [];
    }
    return Object.entries(skillData.categories || {})
      .map(([id, label]) => ({ id: Number(id), label: String(label) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [skillData]);

  const bonusMultiplier = useCallback(
    (action: SkillAction) => {
      if (!skillData) {
        return 1;
      }
      if (!skillData.bonuses || skillData.bonuses.length === 0) {
        return 1;
      }

      let multiplier = 1;
      for (const index of selectedBonuses) {
        const bonus = skillData.bonuses[index];
        if (!bonus) {
          continue;
        }
        const hasValidCategory =
          bonus.validCategories.length === 0 ||
          bonus.validCategories.some((categoryId) =>
            action.categories.includes(categoryId)
          );
        if (!hasValidCategory) {
          continue;
        }
        multiplier *= bonus.bonus;
      }

      return multiplier;
    },
    [selectedBonuses, skillData]
  );

  const computedActions = useMemo(() => {
    if (!skillData) {
      return [] as Array<{
        action: SkillAction;
        xpPerAction: number;
        actionsNeeded: number;
        profit: number | null;
      }>;
    }

    const loweredFilter = filter.trim().toLowerCase();
    const actions = skillData.data
      .filter((action) => {
        if (hideMembers && action.action_members) {
          return false;
        }
        if (categoryFilter && !action.categories.includes(categoryFilter)) {
          return false;
        }
        if (
          loweredFilter &&
          !action.name.toLowerCase().includes(loweredFilter)
        ) {
          return false;
        }
        return true;
      })
      .map((action) => {
        const multiplier = bonusMultiplier(action);
        const xpPerAction = action.exp_given * multiplier;
        const actionsNeeded =
          xpPerAction > 0 ? Math.ceil(xpRemaining / xpPerAction) : 0;
        let profit: number | null = null;

        if (skillData.profit_loss_settings.enabled) {
          if (
            skillData.slug === 'runecrafting' &&
            RUNECRAFT_MULTIPLIERS[action.name]
          ) {
            profit = calculateRunecraftProfit({
              action,
              xpRemaining,
              currentXp,
              targetXp,
              useRealTimePrices,
            });
          } else if (action.components || action.products) {
            const revenue = sumItemValue(action.products, useRealTimePrices);
            const cost = sumItemValue(action.components, useRealTimePrices);
            profit = actionsNeeded * (revenue - cost);
          }
        }

        return {
          action,
          xpPerAction,
          actionsNeeded,
          profit,
        };
      });

    const sorted = [...actions].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'exp':
          return direction * (a.xpPerAction - b.xpPerAction);
        case 'actions':
          return direction * (a.actionsNeeded - b.actionsNeeded);
        case 'profit': {
          const aProfit = a.profit ?? Number.NEGATIVE_INFINITY;
          const bProfit = b.profit ?? Number.NEGATIVE_INFINITY;
          return direction * (aProfit - bProfit);
        }
        case 'name':
          return direction * a.action.name.localeCompare(b.action.name);
        case 'level':
        default:
          return direction * (a.action.level_req - b.action.level_req);
      }
    });

    return sorted;
  }, [
    bonusMultiplier,
    categoryFilter,
    currentXp,
    filter,
    hideMembers,
    skillData,
    sortBy,
    sortDirection,
    targetXp,
    useRealTimePrices,
    xpRemaining,
  ]);

  const combatRows = useMemo(() => {
    if (!combatData) {
      return [] as Array<{
        monster: CombatMonster;
        killsNeeded: number;
        xpPerKill: number;
        isCustom: boolean;
        customIndex?: number;
      }>;
    }

    const loweredFilter = filter.trim().toLowerCase();
    const xpPerDamage = calculateCombatXpPerDamage({
      skill,
      combatStyle,
      usingControlled,
    });

    const baseRowsRaw = combatData.data.filter((monster) => {
      if (hideMembers && monster.members) {
        return false;
      }
      if (
        loweredFilter &&
        !monster.name.toLowerCase().includes(loweredFilter)
      ) {
        return false;
      }
      return true;
    });

    const customRows = customMonsters.map((monster, index) => {
      const bonus = monster.xp_bonus_multiplier ?? 1;
      const xpPerKill = monster.hitpoints * xpPerDamage * bonus;
      const killsNeeded =
        xpPerKill > 0 ? Math.ceil(xpRemaining / xpPerKill) : 0;
      return {
        monster,
        killsNeeded,
        xpPerKill,
        isCustom: true,
        customIndex: index,
      };
    });

    const baseRows = baseRowsRaw.map((monster) => {
      const bonus = monster.xp_bonus_multiplier ?? 1;
      const xpPerKill = monster.hitpoints * xpPerDamage * bonus;
      const killsNeeded =
        xpPerKill > 0 ? Math.ceil(xpRemaining / xpPerKill) : 0;
      return {
        monster,
        killsNeeded,
        xpPerKill,
        isCustom: false as const,
        customIndex: undefined,
      };
    });

    const rows = [...customRows, ...baseRows];

    const sorted = rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'name':
          return direction * a.monster.name.localeCompare(b.monster.name);
        case 'exp':
          return direction * (a.killsNeeded - b.killsNeeded);
        case 'actions':
          return direction * (a.killsNeeded - b.killsNeeded);
        case 'hitpoints':
          return direction * (a.monster.hitpoints - b.monster.hitpoints);
        case 'level':
        default:
          return direction * (a.monster.level - b.monster.level);
      }
    });

    return sorted;
  }, [
    combatData,
    combatStyle,
    customMonsters,
    filter,
    hideMembers,
    skill,
    sortBy,
    sortDirection,
    usingControlled,
    xpRemaining,
  ]);

  const handleCurrentLevelChange = useCallback(
    (value: string) => {
      const parsed = parseNumber(value);
      if (parsed === null) {
        return;
      }
      const nextLevel = clampNumber(parsed, 1, MAX_LEVEL);
      const xpForLevel = safeGetXpForLevel(nextLevel);
      if (xpForLevel === null) {
        return;
      }
      setCurrentLevel(nextLevel);
      setCurrentXp(xpForLevel);
      if (nextLevel >= targetLevel) {
        const nextTarget = clampNumber(nextLevel + 1, 1, MAX_LEVEL);
        setTargetLevel(nextTarget);
        const nextTargetXp = safeGetXpForLevel(nextTarget);
        if (nextTargetXp !== null) {
          setTargetXp(nextTargetXp);
        }
      }
    },
    [targetLevel]
  );

  const handleTargetLevelChange = useCallback((value: string) => {
    setTargetLevelInput(value);
    if (value.trim() === '') {
      return;
    }
    const parsed = parseNumber(value);
    if (parsed === null) {
      return;
    }
    const nextLevel = clampNumber(parsed, 1, MAX_LEVEL);
    const xpForLevel = safeGetXpForLevel(nextLevel);
    if (xpForLevel === null) {
      return;
    }
    setTargetLevel(nextLevel);
    setTargetXp(xpForLevel);
  }, []);

  const handleCurrentXpChange = useCallback(
    (value: string) => {
      const parsed = parseNumber(value);
      if (parsed === null) {
        return;
      }
      const xp = clampNumber(parsed, 0, MAX_XP);
      const level = Math.min(safeGetLevelForXp(xp) ?? 1, MAX_LEVEL);
      setCurrentXp(xp);
      setCurrentLevel(level);
      if (xp >= targetXp) {
        const nextTargetXp = clampNumber(xp + 1, 0, MAX_XP);
        setTargetXp(nextTargetXp);
        setTargetLevel(
          Math.min(safeGetLevelForXp(nextTargetXp) ?? MAX_LEVEL, MAX_LEVEL)
        );
      }
    },
    [targetXp]
  );

  const handleTargetXpChange = useCallback((value: string) => {
    const parsed = parseNumber(value);
    if (parsed === null) {
      return;
    }
    const xp = clampNumber(parsed, 0, MAX_XP);
    setTargetXp(xp);
    setTargetLevel(Math.min(safeGetLevelForXp(xp) ?? MAX_LEVEL, MAX_LEVEL));
  }, []);

  const toggleSort = useCallback(
    (field: typeof sortBy) => {
      if (sortBy !== field) {
        setSortBy(field);
        setSortDirection('asc');
        return;
      }
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    },
    [sortBy, sortDirection]
  );

  const handleAddMonster = useCallback(() => {
    const level = parseNumber(newMonsterLevel);
    const hitpoints = parseNumber(newMonsterHitpoints);
    if (!newMonsterName.trim()) {
      return;
    }
    if (!level || !hitpoints) {
      return;
    }
    const bonus = parseNumber(newMonsterBonus);
    const monster: CombatMonster = {
      name: newMonsterName.trim(),
      level: Math.round(level),
      hitpoints: Math.round(hitpoints),
      members: true,
      ...(bonus ? { xp_bonus_multiplier: bonus } : {}),
    };
    setCustomMonsters((prev) => [...prev, monster]);
    setNewMonsterName('');
    setNewMonsterLevel('');
    setNewMonsterHitpoints('');
    setNewMonsterBonus('');
    setIsAddingMonster(false);
  }, [newMonsterBonus, newMonsterHitpoints, newMonsterLevel, newMonsterName]);

  const removeCustomMonster = useCallback((index: number) => {
    setCustomMonsters((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const itemsUsedForAction = useCallback(
    (action: SkillAction, actionsNeeded: number) => {
      if (!action.components || action.components.length === 0) {
        return null;
      }
      return action.components.map((component) => {
        const amount = (component.amount ?? 1) * actionsNeeded;
        return {
          name: component.name,
          amount,
        };
      });
    },
    []
  );

  const monsterImageTargets = useMemo(() => {
    if (calculator.type !== 'combat') {
      return [];
    }
    const names = new Set<string>();
    for (const row of combatRows) {
      if (row.monster.name) {
        names.add(row.monster.name);
      }
    }
    return Array.from(names);
  }, [calculator.type, combatRows]);

  const monsterImageKey = useMemo(
    () =>
      monsterImageTargets
        .map((name) => normalizeWikiKey(name))
        .sort()
        .join('|'),
    [monsterImageTargets]
  );

  useEffect(() => {
    if (monsterImageTargets.length === 0) {
      return;
    }

    let cancelled = false;
    const chunkSize = 50;

    const fetchImages = async () => {
      const nextImages: Record<string, string> = {};
      for (let i = 0; i < monsterImageTargets.length; i += chunkSize) {
        const chunk = monsterImageTargets.slice(i, i + chunkSize);
        const params = new URLSearchParams({
          titles: chunk.join(','),
          size: '48',
        });
        const response = await fetch(
          `/api/wiki/page-images?${params.toString()}`
        );
        if (!response.ok) {
          continue;
        }
        const payload = (await response.json()) as {
          data?: Array<{ title: string; url: string | null }>;
        };
        for (const entry of payload.data ?? []) {
          if (!entry.url) {
            continue;
          }
          nextImages[normalizeWikiKey(entry.title)] = entry.url;
        }
      }

      if (cancelled) {
        return;
      }
      setMonsterImages((prev) => ({ ...prev, ...nextImages }));
    };

    void fetchImages();

    return () => {
      cancelled = true;
    };
  }, [monsterImageKey, monsterImageTargets]);

  return (
    <div className="calc-container">
      {/* Header */}
      <header className="calc-header">
        <div className="calc-header-content">
          <h1>Skill Calculators</h1>
          <p>
            Plan your training with accurate XP calculations, costs, and
            methods.
          </p>
        </div>
        {(activeCharacterName || lookupLabel) && (
          <div className="calc-header-badges">
            {activeCharacterName && (
              <span className="calc-badge">
                <svg
                  fill="none"
                  height="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {activeCharacterName}
              </span>
            )}
            {lookupLabel && (
              <span className="calc-badge accent">
                <svg
                  fill="none"
                  height="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                {lookupLabel}
                {lookupMetaLabel}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Skill Selector */}
      <section className="calc-skills">
        {skillGroups.map((group) => (
          <div key={group.label} className="calc-skill-group">
            <span className="calc-skill-group-label">{group.label}</span>
            <div className="calc-skill-buttons">
              {group.skills.map((skillKey) => (
                <button
                  key={skillKey}
                  className={`calc-skill-btn ${skill === skillKey ? 'active' : ''}`}
                  type="button"
                  onClick={() => handleSkillChange(skillKey)}
                >
                  {SKILL_DISPLAY_NAMES[skillKey]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Main Content Grid */}
      <div className="calc-main">
        {/* Left Column - Setup */}
        <aside className="calc-sidebar">
          {/* Character Lookup Card */}
          <div className="calc-card">
            <div className="calc-card-header">
              <h3>Character lookup</h3>
            </div>
            <div className="calc-card-body">
              <div className="calc-input-group">
                <label>Display name</label>
                <input
                  placeholder="Enter username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="calc-input-group">
                <label>Account type</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="auto">Auto detect</option>
                  <option value="normal">Normal</option>
                  <option value="ironman">Ironman</option>
                  <option value="hardcore-ironman">Hardcore</option>
                  <option value="ultimate-ironman">Ultimate</option>
                </select>
              </div>
              <div className="calc-card-actions">
                <button
                  className="calc-btn"
                  disabled={lookupStatus === 'loading'}
                  type="button"
                  onClick={handleLookup}
                >
                  {lookupStatus === 'loading' ? 'Loading...' : 'Fetch hiscores'}
                </button>
                {activeCharacterName && (
                  <button
                    className="calc-btn ghost"
                    type="button"
                    onClick={handleUseActive}
                  >
                    Use active
                  </button>
                )}
              </div>
              {lookupError && <p className="calc-error">{lookupError}</p>}
            </div>
          </div>

          {/* Level Setup Card */}
          <div className="calc-card">
            <div className="calc-card-header">
              <h3>Level setup</h3>
              <span className="calc-card-tag">
                {SKILL_DISPLAY_NAMES[skill]}
              </span>
            </div>
            <div className="calc-card-body">
              <div className="calc-level-grid">
                <div className="calc-input-group">
                  <label>Current level</label>
                  <input
                    max={MAX_LEVEL}
                    min={1}
                    type="number"
                    value={currentLevel}
                    onChange={(e) => handleCurrentLevelChange(e.target.value)}
                  />
                </div>
                <div className="calc-input-group">
                  <label>Target level</label>
                  <input
                    max={MAX_LEVEL}
                    min={1}
                    type="number"
                    value={targetLevelInput}
                    onChange={(e) => handleTargetLevelChange(e.target.value)}
                  />
                </div>
                <div className="calc-input-group">
                  <label>Current XP</label>
                  <input
                    max={MAX_XP}
                    min={0}
                    type="number"
                    value={currentXp}
                    onChange={(e) => handleCurrentXpChange(e.target.value)}
                  />
                </div>
                <div className="calc-input-group">
                  <label>Target XP</label>
                  <input
                    max={MAX_XP}
                    min={0}
                    type="number"
                    value={targetXp}
                    onChange={(e) => handleTargetXpChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="calc-progress">
                <div className="calc-progress-bar">
                  <div
                    className="calc-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="calc-progress-stats">
                  <span>{formatNumber(currentXp)} XP</span>
                  <span className="calc-progress-remaining">
                    {formatNumber(xpRemaining)} XP to go
                  </span>
                  <span>{formatNumber(targetXp)} XP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skill-specific Controls */}
          {calculator.type === 'skill' && skillData && (
            <>
              {/* Bonuses Card */}
              {skillData.bonuses.length > 0 && (
                <div className="calc-card">
                  <div className="calc-card-header">
                    <h3>XP bonuses</h3>
                  </div>
                  <div className="calc-card-body">
                    <div className="calc-checkbox-list">
                      {skillData.bonuses.map((bonus, index) => (
                        <label
                          key={`${bonus.name}-${index}`}
                          className="calc-checkbox"
                        >
                          <input
                            checked={selectedBonuses.includes(index)}
                            type="checkbox"
                            onChange={() => {
                              setSelectedBonuses((prev) => {
                                const bonusItem = skillData.bonuses[index];
                                if (!bonusItem) return prev;
                                if (prev.includes(index)) {
                                  return prev.filter(
                                    (entry) => entry !== index
                                  );
                                }
                                if (bonusItem.validCategories.length === 0) {
                                  return [...prev, index];
                                }
                                const filtered = prev.filter((entry) => {
                                  const existing = skillData.bonuses[entry];
                                  if (!existing) return false;
                                  if (existing.validCategories.length === 0)
                                    return true;
                                  const overlaps =
                                    existing.validCategories.some(
                                      (categoryId) =>
                                        bonusItem.validCategories.includes(
                                          categoryId
                                        )
                                    );
                                  return !overlaps;
                                });
                                return [...filtered, index];
                              });
                            }}
                          />
                          <span>{bonus.name}</span>
                          <span className="calc-checkbox-bonus">
                            +{Math.round((bonus.bonus - 1) * 100)}%
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Card */}
              <div className="calc-card">
                <div className="calc-card-header">
                  <h3>Filters</h3>
                </div>
                <div className="calc-card-body">
                  <div className="calc-input-group">
                    <label>Search actions</label>
                    <input
                      placeholder="Filter by name..."
                      type="text"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  {categoryOptions.length > 0 && (
                    <div className="calc-input-group">
                      <label>Category</label>
                      <select
                        value={categoryFilter}
                        onChange={(e) =>
                          setCategoryFilter(Number(e.target.value))
                        }
                      >
                        <option value={0}>All categories</option>
                        {categoryOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="calc-input-group">
                    <label>Actions per hour</label>
                    <input
                      min={0}
                      placeholder="For XP/hr calc"
                      type="number"
                      value={actionsPerHourInput}
                      onChange={(e) => setActionsPerHourInput(e.target.value)}
                    />
                  </div>
                  <div className="calc-checkbox-list">
                    {!skillData.members_only && (
                      <label className="calc-checkbox">
                        <input
                          checked={hideMembers}
                          type="checkbox"
                          onChange={(e) => setHideMembers(e.target.checked)}
                        />
                        <span>Hide members-only</span>
                      </label>
                    )}
                    {skillData.profit_loss_settings.real_time_prices && (
                      <label className="calc-checkbox">
                        <input
                          checked={useRealTimePrices}
                          type="checkbox"
                          onChange={(e) =>
                            setUseRealTimePrices(e.target.checked)
                          }
                        />
                        <span>Use real-time prices</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Combat-specific Controls */}
          {calculator.type === 'combat' && combatData && (
            <>
              <div className="calc-card">
                <div className="calc-card-header">
                  <h3>Combat setup</h3>
                </div>
                <div className="calc-card-body">
                  {skill === 'defence' && (
                    <div className="calc-input-group">
                      <label>Combat style</label>
                      <select
                        value={combatStyle}
                        onChange={(e) =>
                          setCombatStyle(
                            e.target.value as 'melee' | 'magic' | 'ranged'
                          )
                        }
                      >
                        <option value="melee">Melee</option>
                        <option value="magic">Magic</option>
                        <option value="ranged">Ranged</option>
                      </select>
                    </div>
                  )}
                  {showControlledToggle && (
                    <label className="calc-checkbox">
                      <input
                        checked={usingControlled}
                        type="checkbox"
                        onChange={(e) => setUsingControlled(e.target.checked)}
                      />
                      <span>Using controlled style</span>
                    </label>
                  )}
                  {skill === 'slayer' && (
                    <p className="calc-note">
                      Slayer XP assumes on-task kills (XP = hitpoints × bonus).
                    </p>
                  )}
                </div>
              </div>

              <div className="calc-card">
                <div className="calc-card-header">
                  <h3>Filters</h3>
                </div>
                <div className="calc-card-body">
                  <div className="calc-input-group">
                    <label>Search monsters</label>
                    <input
                      placeholder="Filter by name..."
                      type="text"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <div className="calc-input-group">
                    <label>Kills per hour</label>
                    <input
                      min={0}
                      placeholder="For XP/hr calc"
                      type="number"
                      value={killsPerHourInput}
                      onChange={(e) => setKillsPerHourInput(e.target.value)}
                    />
                  </div>
                  <label className="calc-checkbox">
                    <input
                      checked={hideMembers}
                      type="checkbox"
                      onChange={(e) => setHideMembers(e.target.checked)}
                    />
                    <span>Hide members-only</span>
                  </label>
                </div>
              </div>

              <div className="calc-card">
                <div className="calc-card-header">
                  <h3>Custom monsters</h3>
                </div>
                <div className="calc-card-body">
                  {!isAddingMonster ? (
                    <button
                      className="calc-btn ghost full-width"
                      type="button"
                      onClick={() => setIsAddingMonster(true)}
                    >
                      + Add custom monster
                    </button>
                  ) : (
                    <div className="calc-monster-form">
                      <div className="calc-input-group">
                        <label>Name</label>
                        <input
                          placeholder="Monster name"
                          type="text"
                          value={newMonsterName}
                          onChange={(e) => setNewMonsterName(e.target.value)}
                        />
                      </div>
                      <div className="calc-level-grid">
                        <div className="calc-input-group">
                          <label>Level</label>
                          <input
                            type="number"
                            value={newMonsterLevel}
                            onChange={(e) => setNewMonsterLevel(e.target.value)}
                          />
                        </div>
                        <div className="calc-input-group">
                          <label>Hitpoints</label>
                          <input
                            type="number"
                            value={newMonsterHitpoints}
                            onChange={(e) =>
                              setNewMonsterHitpoints(e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="calc-input-group">
                        <label>XP bonus multiplier</label>
                        <input
                          placeholder="1.0 (optional)"
                          step="0.1"
                          type="number"
                          value={newMonsterBonus}
                          onChange={(e) => setNewMonsterBonus(e.target.value)}
                        />
                      </div>
                      <div className="calc-card-actions">
                        <button
                          className="calc-btn ghost"
                          type="button"
                          onClick={() => setIsAddingMonster(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="calc-btn"
                          type="button"
                          onClick={handleAddMonster}
                        >
                          Add monster
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Right Column - Results Table */}
        <main className="calc-results">
          {calculatorError && (
            <div className="calc-error-banner">{calculatorError}</div>
          )}

          {loadingCalculator && (
            <div className="calc-loading">
              <div className="calc-spinner" />
              <span>Loading calculator data...</span>
            </div>
          )}

          {/* Skill Actions Table */}
          {calculator.type === 'skill' && skillData && !loadingCalculator && (
            <div className="calc-table-container">
              <table className="calc-table">
                <thead>
                  <tr>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('level')}
                    >
                      Level{' '}
                      {sortBy === 'level' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('name')}
                    >
                      Action{' '}
                      {sortBy === 'name' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('exp')}
                    >
                      XP{' '}
                      {sortBy === 'exp' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('actions')}
                    >
                      Actions{' '}
                      {sortBy === 'actions' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th>XP/hr</th>
                    {skillData.profit_loss_settings.show_components && (
                      <th>Materials</th>
                    )}
                    {skillData.profit_loss_settings.enabled && (
                      <th
                        className="calc-th-sortable"
                        onClick={() => toggleSort('profit')}
                      >
                        Profit{' '}
                        {sortBy === 'profit' && (
                          <span className="calc-sort-icon">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {computedActions.length === 0 ? (
                    <tr>
                      <td
                        className="calc-empty"
                        colSpan={
                          5 +
                          (skillData.profit_loss_settings.show_components
                            ? 1
                            : 0) +
                          (skillData.profit_loss_settings.enabled ? 1 : 0)
                        }
                      >
                        No actions match your filters.
                      </td>
                    </tr>
                  ) : (
                    computedActions.map((entry, index) => {
                      const action = entry.action;
                      const itemsUsed = itemsUsedForAction(
                        action,
                        entry.actionsNeeded
                      );
                      const levelMet = action.level_req <= currentLevel;
                      const xpPerHour =
                        actionsPerHour > 0
                          ? entry.xpPerAction * actionsPerHour
                          : null;
                      const actionImage = resolveActionImage(action.image);
                      const actionHref = buildWikiUrl(action.name);
                      return (
                        <tr
                          key={`${action.name}-${index}`}
                          className={
                            levelMet ? 'calc-row-met' : 'calc-row-unmet'
                          }
                        >
                          <td>
                            <span
                              className={`calc-level-badge ${levelMet ? 'met' : 'unmet'}`}
                            >
                              {action.level_req}
                            </span>
                          </td>
                          <td>
                            <div className="calc-action-cell">
                              <a
                                className="calc-action-link"
                                href={actionHref}
                                rel="noreferrer"
                                target="_blank"
                                title={`Open ${action.name} on the OSRS Wiki`}
                              >
                                {actionImage && (
                                  <img
                                    alt=""
                                    height={24}
                                    loading="lazy"
                                    src={actionImage}
                                    width={24}
                                  />
                                )}
                                <div className="calc-action-info">
                                  <span className="calc-action-name">
                                    {action.name}
                                  </span>
                                  {action.action_members && (
                                    <span className="calc-member-tag">P2P</span>
                                  )}
                                </div>
                              </a>
                            </div>
                          </td>
                          <td className="calc-num">
                            {formatDecimal(entry.xpPerAction)}
                          </td>
                          <td className="calc-num">
                            {formatNumber(entry.actionsNeeded)}
                          </td>
                          <td className="calc-num">
                            {xpPerHour === null
                              ? '-'
                              : formatNumber(Math.round(xpPerHour))}
                          </td>
                          {skillData.profit_loss_settings.show_components && (
                            <td className="calc-materials">
                              {itemsUsed ? (
                                <ul>
                                  {itemsUsed.map((item) => (
                                    <li key={item.name}>
                                      {formatNumber(Math.round(item.amount))}×{' '}
                                      {item.name}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="calc-muted">-</span>
                              )}
                            </td>
                          )}
                          {skillData.profit_loss_settings.enabled && (
                            <td
                              className={`calc-num ${
                                entry.profit === null
                                  ? 'calc-muted'
                                  : entry.profit >= 0
                                    ? 'calc-profit'
                                    : 'calc-loss'
                              }`}
                            >
                              {entry.profit === null
                                ? '-'
                                : formatGp(Math.round(entry.profit))}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Combat Monsters Table */}
          {calculator.type === 'combat' && combatData && !loadingCalculator && (
            <div className="calc-table-container">
              <table className="calc-table">
                <thead>
                  <tr>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('name')}
                    >
                      Monster{' '}
                      {sortBy === 'name' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('level')}
                    >
                      Level{' '}
                      {sortBy === 'level' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('hitpoints')}
                    >
                      HP{' '}
                      {sortBy === 'hitpoints' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th
                      className="calc-th-sortable"
                      onClick={() => toggleSort('actions')}
                    >
                      Kills{' '}
                      {sortBy === 'actions' && (
                        <span className="calc-sort-icon">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th>XP/hr</th>
                  </tr>
                </thead>
                <tbody>
                  {combatRows.length === 0 ? (
                    <tr>
                      <td className="calc-empty" colSpan={5}>
                        No monsters match your filters.
                      </td>
                    </tr>
                  ) : (
                    combatRows.map((entry, index) => {
                      const xpPerHour =
                        killsPerHour > 0
                          ? entry.xpPerKill * killsPerHour
                          : null;
                      const monsterHref = buildWikiUrl(entry.monster.name);
                      const monsterImage =
                        monsterImages[normalizeWikiKey(entry.monster.name)];
                      return (
                        <tr key={`${entry.monster.name}-${index}`}>
                          <td>
                            <div className="calc-action-cell">
                              <a
                                className="calc-action-link"
                                href={monsterHref}
                                rel="noreferrer"
                                target="_blank"
                                title={`Open ${entry.monster.name} on the OSRS Wiki`}
                              >
                                {monsterImage && (
                                  <img
                                    alt=""
                                    height={24}
                                    loading="lazy"
                                    src={monsterImage}
                                    width={24}
                                  />
                                )}
                                <div className="calc-action-info">
                                  <span className="calc-action-name">
                                    {entry.monster.name}
                                  </span>
                                  {entry.monster.members && (
                                    <span className="calc-member-tag">P2P</span>
                                  )}
                                  {entry.monster.xp_bonus_multiplier &&
                                    entry.monster.xp_bonus_multiplier !== 1 && (
                                      <span className="calc-bonus-tag">
                                        +
                                        {formatDecimal(
                                          (entry.monster.xp_bonus_multiplier -
                                            1) *
                                            100
                                        )}
                                        %
                                      </span>
                                    )}
                                </div>
                              </a>
                              {entry.isCustom &&
                                entry.customIndex !== undefined && (
                                  <button
                                    className="calc-remove-btn"
                                    title="Remove"
                                    type="button"
                                    onClick={() =>
                                      removeCustomMonster(entry.customIndex)
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                            </div>
                          </td>
                          <td className="calc-num">{entry.monster.level}</td>
                          <td className="calc-num">
                            {entry.monster.hitpoints}
                          </td>
                          <td className="calc-num">
                            {formatNumber(entry.killsNeeded)}
                          </td>
                          <td className="calc-num">
                            {xpPerHour === null
                              ? '-'
                              : formatNumber(Math.round(xpPerHour))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
