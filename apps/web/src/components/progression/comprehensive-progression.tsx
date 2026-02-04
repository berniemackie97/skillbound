'use client';

import type { CombatAchievement, Diary, DiaryTask, DiaryTier, Quest } from '@skillbound/content';
import type { RequirementResult, RequirementStatus } from '@skillbound/domain';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

import { RequirementList, statusClass } from '../requirements/requirements-ui';

type ProgressionData = {
  bosses: Array<{
    id: string;
    bossName: string;
    killcount: number;
    personalBest: number | null;
  }>;
  requirements?: RequirementsData | null;
  activities?: Record<string, number> | null;
  gear: Array<{
    id: string;
    gameStage: 'early' | 'mid' | 'late' | 'end' | 'specialized';
    slot: string;
    itemName: string;
    source: string;
    obtained: boolean;
    priority: number;
  }>;
  milestones: Array<{
    id: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'elite' | 'master';
    name: string;
    description: string | null;
    achieved: boolean;
  }>;
};

type QuestResult = {
  quest: Quest;
  completionStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
    status: RequirementStatus;
  };
};

type DiaryTaskResult = {
  task: DiaryTask;
  completionStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
    status: RequirementStatus;
  };
};

type DiaryTierResult = {
  tier: DiaryTier;
  completionStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
    status: RequirementStatus;
  };
  tasks: DiaryTaskResult[];
};

type DiaryResult = {
  diary: Diary;
  tiers: DiaryTierResult[];
};

type CombatAchievementResult = {
  achievement: CombatAchievement;
  completionStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
    status: RequirementStatus;
  };
};

type RequirementsData = {
  quests: QuestResult[];
  diaries: DiaryResult[];
  combat: CombatAchievementResult[];
};

type Props = {
  characterId?: string;
  profileId?: string;
  characterName: string;
  readOnly?: boolean;
};

type LocalProgressState = {
  gear: Record<string, boolean>;
  milestones: Record<string, boolean>;
  bosses: Record<string, number>;
  quests: Record<string, RequirementStatus>;
};

const emptyLocalProgress: LocalProgressState = {
  gear: {},
  milestones: {},
  bosses: {},
  quests: {},
};

export function ComprehensiveProgression({
  characterId,
  profileId,
  characterName,
  readOnly,
}: Props) {
  const [data, setData] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<
    | 'bosses'
    | 'gear'
    | 'milestones'
    | 'quests'
    | 'achievements'
    | 'clues'
    | 'pvp'
  >(
    initialTab === 'quests'
      ? 'quests'
      : initialTab === 'achievements'
        ? 'achievements'
        : initialTab === 'clues'
            ? 'clues'
            : initialTab === 'pvp'
              ? 'pvp'
              : initialTab === 'requirements'
                ? 'quests'
                : 'bosses'
  );
  const [requirementsData, setRequirementsData] =
    useState<RequirementsData | null>(null);
  const [requirementsError, setRequirementsError] = useState<string | null>(
    null
  );
  const [questSearch, setQuestSearch] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [combatSearch, setCombatSearch] = useState('');
  const [questUpdating, setQuestUpdating] = useState<Set<string>>(
    () => new Set()
  );

  const isReadOnly = readOnly ?? !characterId;
  const targetId = characterId ?? profileId ?? null;
  const localStorageKey = targetId ? `progression:local:${targetId}` : null;
  const [_localProgress, setLocalProgress] =
    useState<LocalProgressState>(emptyLocalProgress);

  const activityMap = data?.activities ?? null;

  function readLocalProgress(): LocalProgressState {
    if (!localStorageKey || typeof window === 'undefined') {
      return emptyLocalProgress;
    }
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (!raw) {
        return emptyLocalProgress;
      }
      const parsed = JSON.parse(raw) as LocalProgressState;
      return {
        gear: parsed.gear ?? {},
        milestones: parsed.milestones ?? {},
        bosses: parsed.bosses ?? {},
        quests: parsed.quests ?? {},
      };
    } catch {
      return emptyLocalProgress;
    }
  }

  function writeLocalProgress(next: LocalProgressState) {
    if (!localStorageKey || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(localStorageKey, JSON.stringify(next));
  }

  function updateLocalProgress(update: Partial<LocalProgressState>) {
    setLocalProgress((prev) => {
      const next: LocalProgressState = {
        gear: { ...prev.gear, ...(update.gear ?? {}) },
        milestones: { ...prev.milestones, ...(update.milestones ?? {}) },
        bosses: { ...prev.bosses, ...(update.bosses ?? {}) },
        quests: { ...prev.quests, ...(update.quests ?? {}) },
      };
      writeLocalProgress(next);
      return next;
    });
  }

  function applyLocalProgress(
    base: ProgressionData,
    local: LocalProgressState
  ): ProgressionData {
    return {
      ...base,
      gear: base.gear.map((item) =>
        item.id in local.gear
          ? { ...item, obtained: Boolean(local.gear[item.id]) }
          : item
      ),
      milestones: base.milestones.map((item) =>
        item.id in local.milestones
          ? { ...item, achieved: Boolean(local.milestones[item.id]) }
          : item
      ),
      bosses: base.bosses.map((boss) =>
        boss.bossName in local.bosses
          ? { ...boss, killcount: local.bosses[boss.bossName] ?? 0 }
          : boss
      ),
    };
  }

  function applyLocalQuestStatus(
    base: RequirementsData | null,
    local: LocalProgressState
  ): RequirementsData | null {
    if (!base) {
      return base;
    }
    return {
      ...base,
      quests: base.quests.map((quest) => {
        const localStatus = local.quests[quest.quest.id];
        return localStatus !== undefined
          ? { ...quest, completionStatus: localStatus }
          : quest;
      }),
    };
  }

  // Load all progression data
  useEffect(() => {
    async function loadData() {
      try {
        // Check if data exists
        if (!targetId) {
          throw new Error('Select a character or fetch a player first.');
        }

        const url = characterId
          ? `/api/progression/comprehensive?characterId=${targetId}`
          : `/api/progression/public?profileId=${targetId}`;

        const response = await fetch(url);

        if (!response.ok) throw new Error('Failed to load progression data');

        const result = (await response.json()) as {
          data: ProgressionData;
          meta: {
            bossCount: number;
            gearCount: number;
            milestoneCount: number;
            requirementsError?: string | null;
          };
        };

        const localOverrides = isReadOnly ? readLocalProgress() : null;
        if (localOverrides) {
          setLocalProgress(localOverrides);
        }

        // If no data, auto-initialize
        if (
          !isReadOnly &&
          result.meta.bossCount === 0 &&
          result.meta.gearCount === 0 &&
          result.meta.milestoneCount === 0
        ) {
          await initializeData();
        } else {
          const mergedData = localOverrides
            ? applyLocalProgress(result.data, localOverrides)
            : result.data;
          const mergedRequirements = localOverrides
            ? applyLocalQuestStatus(result.data.requirements ?? null, localOverrides)
            : result.data.requirements ?? null;

          setData(mergedData);
          setRequirementsData(mergedRequirements);
          setRequirementsError(result.meta.requirementsError ?? null);
          setLoading(false);
        }
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : 'Unknown error');
        setLoading(false);
      }
    }

    async function initializeData() {
      try {
        if (isReadOnly || !characterId) {
          return;
        }

        const response = await fetch('/api/progression/initialize-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId }),
        });

        if (!response.ok) throw new Error('Failed to initialize');

        // Reload data
        const dataResponse = await fetch(
          `/api/progression/comprehensive?characterId=${characterId}`
        );
        const result = (await dataResponse.json()) as {
          data: ProgressionData;
          meta?: { requirementsError?: string | null };
        };
        setData(result.data);
        setRequirementsData(result.data.requirements ?? null);
        setRequirementsError(result.meta?.requirementsError ?? null);
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [characterId, profileId, isReadOnly, targetId]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'quests') {
      setActiveTab('quests');
    } else if (tab === 'achievements') {
      setActiveTab('achievements');
    } else if (tab === 'clues') {
      setActiveTab('clues');
    } else if (tab === 'pvp') {
      setActiveTab('pvp');
    } else if (tab === 'requirements') {
      setActiveTab('quests');
    }

    const req = searchParams.get('req');
    if (req === 'diaries' || req === 'combat') {
      setActiveTab('achievements');
    } else if (req === 'quests') {
      setActiveTab('quests');
    }
  }, [searchParams]);

  async function toggleGear(id: string, currentState: boolean) {
    if (!data) return;
    const optimistic = {
      ...data,
      gear: data.gear.map((item) =>
        item.id === id ? { ...item, obtained: !currentState } : item
      ),
    };
    setData(optimistic);

    if (isReadOnly) {
      updateLocalProgress({ gear: { [id]: !currentState } });
      return;
    }

    try {
      await fetch('/api/progression/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          type: 'gear',
          id,
          data: { obtained: !currentState },
        }),
      });
    } catch (_err) {
      setData(data); // Revert
      setError('Failed to update gear');
    }
  }

  async function toggleMilestone(id: string, currentState: boolean) {
    if (!data) return;

    const optimistic = {
      ...data,
      milestones: data.milestones.map((item) =>
        item.id === id ? { ...item, achieved: !currentState } : item
      ),
    };
    setData(optimistic);

    if (isReadOnly) {
      updateLocalProgress({ milestones: { [id]: !currentState } });
      return;
    }

    try {
      await fetch('/api/progression/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          type: 'milestone',
          id,
          data: { achieved: !currentState },
        }),
      });
    } catch (_err) {
      setData(data); // Revert
      setError('Failed to update milestone');
    }
  }

  async function updateBossKC(bossName: string, newKC: number) {
    if (!data) return;

    const optimistic = {
      ...data,
      bosses: data.bosses.map((boss) =>
        boss.bossName === bossName ? { ...boss, killcount: newKC } : boss
      ),
    };
    setData(optimistic);

    if (isReadOnly) {
      updateLocalProgress({ bosses: { [bossName]: newKC } });
      return;
    }

    try {
      await fetch('/api/progression/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          type: 'boss',
          bossName,
          data: { killcount: newKC },
        }),
      });
    } catch (_err) {
      setData(data); // Revert
      setError('Failed to update boss KC');
    }
  }

  const cycleQuestStatus = (status: RequirementStatus): RequirementStatus => {
    if (status === 'MET') return 'NOT_MET';
    if (status === 'NOT_MET') return 'UNKNOWN';
    return 'MET';
  };

  const summarizeStatus = (statuses: RequirementStatus[]): RequirementStatus => {
    if (statuses.length === 0) return 'UNKNOWN';
    if (statuses.every((status) => status === 'MET')) return 'MET';
    const hasMet = statuses.some((status) => status === 'MET');
    const hasNotMet = statuses.some((status) => status === 'NOT_MET');
    if (hasMet && hasNotMet) return 'IN_PROGRESS';
    if (hasNotMet) return 'NOT_MET';
    return 'UNKNOWN';
  };

  async function toggleQuestStatus(
    questId: string,
    currentStatus: RequirementStatus
  ) {
    if (!requirementsData) return;

    const nextStatus = cycleQuestStatus(currentStatus);

    setQuestUpdating((prev) => {
      const next = new Set(prev);
      next.add(questId);
      return next;
    });

    setRequirementsData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quests: prev.quests.map((quest) =>
          quest.quest.id === questId
            ? { ...quest, completionStatus: nextStatus }
            : quest
        ),
      };
    });

    if (isReadOnly) {
      updateLocalProgress({ quests: { [questId]: nextStatus } });
      setQuestUpdating((prev) => {
        const next = new Set(prev);
        next.delete(questId);
        return next;
      });
      return;
    }

    try {
      const response = await fetch(`/api/characters/${characterId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quest_complete',
          key: questId,
          value:
            nextStatus === 'MET'
              ? 'true'
              : nextStatus === 'NOT_MET'
                ? 'false'
                : 'null',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save override');
      }
    } catch (_err) {
      setRequirementsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quests: prev.quests.map((quest) =>
            quest.quest.id === questId
              ? { ...quest, completionStatus: currentStatus }
              : quest
          ),
        };
      });
      setRequirementsError('Failed to update quest override.');
    } finally {
      setQuestUpdating((prev) => {
        const next = new Set(prev);
        next.delete(questId);
        return next;
      });
    }
  }

  const bossCategories = useMemo(() => {
    if (!data) return {};

    return {
      'Slayer': data.bosses.filter((b) => ['Abyssal Sire', 'Alchemical Hydra', 'Cerberus', 'Kraken', 'Thermonuclear Smoke Devil', 'Grotesque Guardians'].includes(b.bossName)),
      'God Wars': data.bosses.filter((b) => ['Commander Zilyana', 'General Graardor', 'Kree\'arra', 'K\'ril Tsutsaroth', 'Nex'].includes(b.bossName)),
      'Wilderness': data.bosses.filter((b) => ['Callisto', 'Calvar\'ion', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy Archaeologist', 'Scorpia', 'Spindel', 'Venenatis', 'Vet\'ion', 'Artio'].includes(b.bossName)),
      'Raids': data.bosses.filter((b) => b.bossName.includes('Chambers') || b.bossName.includes('Theatre') || b.bossName.includes('Tombs')),
      'Other': data.bosses.filter((b) => !['Slayer', 'God Wars', 'Wilderness', 'Raids'].some(cat =>
        data.bosses.filter((boss) => {
          if (cat === 'Slayer') return ['Abyssal Sire', 'Alchemical Hydra', 'Cerberus', 'Kraken', 'Thermonuclear Smoke Devil', 'Grotesque Guardians'].includes(boss.bossName);
          if (cat === 'God Wars') return ['Commander Zilyana', 'General Graardor', 'Kree\'arra', 'K\'ril Tsutsaroth', 'Nex'].includes(boss.bossName);
          if (cat === 'Wilderness') return ['Callisto', 'Calvar\'ion', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy Archaeologist', 'Scorpia', 'Spindel', 'Venenatis', 'Vet\'ion', 'Artio'].includes(boss.bossName);
          if (cat === 'Raids') return boss.bossName.includes('Chambers') || boss.bossName.includes('Theatre') || boss.bossName.includes('Tombs');
          return false;
        }).includes(b)
      )),
    };
  }, [data]);

  const questSummary = useMemo(() => {
    if (!requirementsData) {
      return { total: 0, complete: 0 };
    }
    const total = requirementsData.quests.length;
    const complete = requirementsData.quests.filter(
      (quest) => quest.completionStatus === 'MET'
    ).length;
    return { total, complete };
  }, [requirementsData]);

  const diarySummary = useMemo(() => {
    if (!requirementsData) {
      return { total: 0, complete: 0 };
    }
    const totals = requirementsData.diaries.reduce(
      (acc, diary) => {
        acc.total += diary.tiers.length;
        acc.complete += diary.tiers.filter(
          (tier) => tier.completionStatus === 'MET'
        ).length;
        return acc;
      },
      { total: 0, complete: 0 }
    );
    return totals;
  }, [requirementsData]);

  const combatSummary = useMemo(() => {
    if (!requirementsData) {
      return { total: 0, complete: 0 };
    }
    const total = requirementsData.combat.length;
    const complete = requirementsData.combat.filter(
      (achievement) => achievement.completionStatus === 'MET'
    ).length;
    return { total, complete };
  }, [requirementsData]);

  const achievementsSummary = useMemo(() => {
    return {
      total: diarySummary.total + combatSummary.total,
      complete: diarySummary.complete + combatSummary.complete,
    };
  }, [diarySummary, combatSummary]);

  const clueActivities = useMemo(
    () => [
      { key: 'clue_scrolls_all', label: 'All clues' },
      { key: 'clue_scrolls_beginner', label: 'Beginner' },
      { key: 'clue_scrolls_easy', label: 'Easy' },
      { key: 'clue_scrolls_medium', label: 'Medium' },
      { key: 'clue_scrolls_hard', label: 'Hard' },
      { key: 'clue_scrolls_elite', label: 'Elite' },
      { key: 'clue_scrolls_master', label: 'Master' },
    ],
    []
  );

  const pvpActivities = useMemo(
    () => [
      { key: 'deadman_points', label: 'Deadman points' },
      { key: 'bounty_hunter_hunter', label: 'Bounty hunter - Hunter' },
      { key: 'bounty_hunter_rogue', label: 'Bounty hunter - Rogue' },
      { key: 'bounty_hunter_legacy_hunter', label: 'Bounty hunter (legacy) - Hunter' },
      { key: 'bounty_hunter_legacy_rogue', label: 'Bounty hunter (legacy) - Rogue' },
      { key: 'lms_rank', label: 'Last Man Standing' },
      { key: 'pvp_arena_rank', label: 'PvP Arena' },
    ],
    []
  );

  const clueTotal = useMemo(() => {
    if (!activityMap) return 0;
    const allClues = activityMap['clue_scrolls_all'];
    if (typeof allClues === 'number') {
      return allClues;
    }
    return clueActivities
      .filter((item) => item.key !== 'clue_scrolls_all')
      .reduce((sum, item) => sum + (activityMap[item.key] ?? 0), 0);
  }, [activityMap, clueActivities]);

  const pvpTotal = useMemo(() => {
    if (!activityMap) return 0;
    const totalKeys = pvpActivities
      .filter((item) => item.key !== 'pvp_arena_rank')
      .map((item) => item.key);
    return totalKeys.reduce((sum, key) => sum + (activityMap[key] ?? 0), 0);
  }, [activityMap, pvpActivities]);

  const activityAchievements = useMemo(
    () => [
      { id: 'collections_500', label: '500 Collections Logged', target: 500 },
      { id: 'collections_700', label: '700 Collections Logged', target: 700 },
      { id: 'collections_900', label: '900 Collections Logged', target: 900 },
      { id: 'collections_1000', label: '1k Collections Logged', target: 1000 },
      { id: 'collections_1100', label: '1.1k Collections Logged', target: 1100 },
    ],
    []
  );

  const filteredQuests = useMemo(() => {
    if (!requirementsData) return [];
    const query = questSearch.trim().toLowerCase();
    if (!query) return requirementsData.quests;
    return requirementsData.quests.filter((quest) =>
      quest.quest.name.toLowerCase().includes(query)
    );
  }, [requirementsData, questSearch]);

  const filteredDiaries = useMemo(() => {
    if (!requirementsData) return [];
    const query = diarySearch.trim().toLowerCase();
    if (!query) return requirementsData.diaries;
    return requirementsData.diaries.filter((entry) =>
      `${entry.diary.name} ${entry.diary.region ?? ''}`
        .toLowerCase()
        .includes(query)
    );
  }, [requirementsData, diarySearch]);

  const filteredCombat = useMemo(() => {
    if (!requirementsData) return [];
    const query = combatSearch.trim().toLowerCase();
    if (!query) return requirementsData.combat;
    return requirementsData.combat.filter((entry) =>
      `${entry.achievement.name} ${entry.achievement.tier}`
        .toLowerCase()
        .includes(query)
    );
  }, [requirementsData, combatSearch]);

  const combatByTier = useMemo(() => {
    return filteredCombat.reduce<Record<string, CombatAchievementResult[]>>(
      (acc, entry) => {
        const tier = entry.achievement.tier || 'Other';
        if (!acc[tier]) {
          acc[tier] = [];
        }
        acc[tier].push(entry);
        return acc;
      },
      {}
    );
  }, [filteredCombat]);

  if (loading) {
    return <div className="progression-loading">Loading progression data...</div>;
  }

  if (error) {
    return <div className="progression-error">{error}</div>;
  }

  if (!data) {
    return <div className="progression-error">No data available</div>;
  }

  return (
    <div className="comprehensive-progression">
      <div className="progression-header">
        <div>
          <h2>{characterName} - Progression Tracker</h2>
          <p className="text-muted">
            Track bosses, gear, milestones, quests, and achievements
          </p>
        </div>
      </div>

      {isReadOnly && (
        <div className="callout">
          <h4>Guest mode</h4>
          <p>
            Changes are saved locally in this browser. Sign in to sync progress
            across devices.
          </p>
        </div>
      )}

      <div className="progression-tabs">
        <button
          className={`tab ${activeTab === 'bosses' ? 'active' : ''}`}
          onClick={() => setActiveTab('bosses')}
        >
          Bosses ({data.bosses.filter((b) => b.killcount > 0).length}/{data.bosses.length})
        </button>
        <button
          className={`tab ${activeTab === 'gear' ? 'active' : ''}`}
          onClick={() => setActiveTab('gear')}
        >
          Gear ({data.gear.filter((g) => g.obtained).length}/{data.gear.length})
        </button>
        <button
          className={`tab ${activeTab === 'milestones' ? 'active' : ''}`}
          onClick={() => setActiveTab('milestones')}
        >
          Milestones ({data.milestones.filter((m) => m.achieved).length}/{data.milestones.length})
        </button>
        <button
          className={`tab ${activeTab === 'quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('quests')}
        >
          Quests ({questSummary.complete}/{questSummary.total})
        </button>
        <button
          className={`tab ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements ({achievementsSummary.complete}/{achievementsSummary.total})
        </button>
        <button
          className={`tab ${activeTab === 'clues' ? 'active' : ''}`}
          onClick={() => setActiveTab('clues')}
        >
          Clues ({formatNumber(clueTotal)})
        </button>
        <button
          className={`tab ${activeTab === 'pvp' ? 'active' : ''}`}
          onClick={() => setActiveTab('pvp')}
        >
          PvP ({formatNumber(pvpTotal)})
        </button>
      </div>

      {activeTab === 'bosses' && (
        <div className="bosses-section">
          {Object.entries(bossCategories).map(([category, bosses]) => (
            bosses.length > 0 && (
              <div key={category} className="boss-category">
                <h3>{category}</h3>
                <div className="boss-grid">
                  {bosses.map((boss) => (
                    <div key={boss.id} className="boss-item">
                      <div className="boss-name">{boss.bossName}</div>
                      <div className="boss-kc">
                        <label>KC:</label>
                        <input
                          className="kc-input"
                          min="0"
                          type="number"
                          value={boss.killcount}
                          onChange={(e) => updateBossKC(boss.bossName, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {activeTab === 'gear' && (
        <div className="gear-section">
          {(['early', 'mid', 'late', 'end', 'specialized'] as const).map((stage) => {
            const stageGear = data.gear.filter((g) => g.gameStage === stage);
            if (stageGear.length === 0) return null;

            return (
              <div key={stage} className="gear-stage">
                <h3>{stage.charAt(0).toUpperCase() + stage.slice(1)} Game</h3>
                <div className="gear-list">
                  {stageGear.map((item) => (
                    <div key={item.id} className={`gear-item ${item.obtained ? 'obtained' : ''}`}>
                      <label className="gear-checkbox">
                        <input
                          checked={item.obtained}
                          type="checkbox"
                          onChange={() => toggleGear(item.id, item.obtained)}
                        />
                        <div className="gear-content">
                          <div className="gear-name">{item.itemName}</div>
                          <div className="gear-source">{item.source}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="milestones-section">
          {(['easy', 'medium', 'hard', 'elite', 'master'] as const).map((difficulty) => {
            const difficultyMilestones = data.milestones.filter((m) => m.difficulty === difficulty);
            if (difficultyMilestones.length === 0) return null;

            return (
              <div key={difficulty} className="milestone-difficulty">
                <h3>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</h3>
                <div className="milestone-list">
                  {difficultyMilestones.map((item) => (
                    <div key={item.id} className={`milestone-item ${item.achieved ? 'achieved' : ''}`}>
                      <label className="milestone-checkbox">
                        <input
                          checked={item.achieved}
                          type="checkbox"
                          onChange={() => toggleMilestone(item.id, item.achieved)}
                        />
                        <div className="milestone-content">
                          <div className="milestone-name">{item.name}</div>
                          {item.description && (
                            <div className="milestone-description">{item.description}</div>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'quests' && (
        <div className="requirements-section">
          <div className="requirements-summary">
            <div className="requirements-card">
              <span className="label">Quests</span>
              <strong>
                {questSummary.complete}/{questSummary.total}
              </strong>
              <span className="muted">complete</span>
            </div>
          </div>

          <div className="requirements-controls">
            <div className="requirements-search">
              <input
                placeholder="Search quests"
                value={questSearch}
                onChange={(event) => setQuestSearch(event.target.value)}
              />
            </div>
          </div>

          {requirementsError && (
            <div className="requirements-error">{requirementsError}</div>
          )}

          {requirementsData && (
            <div className="requirements-stack">
              {filteredQuests.length === 0 && (
                <div className="muted">No quests match your search.</div>
              )}
              {filteredQuests.map((item, index) => {
                const isUpdating = questUpdating.has(item.quest.id);
                return (
                  <details key={item.quest.id} className="requirement-card" open={index < 4}>
                    <summary>
                      <div className="requirement-summary">
                        <strong>{item.quest.name}</strong>
                        {item.quest.difficulty && (
                          <span className="muted">{item.quest.difficulty}</span>
                        )}
                      </div>
                      <button
                        className={`${statusClass(item.completionStatus)} clickable requirement-status-button ${isUpdating ? 'updating' : ''}`}
                        disabled={isUpdating}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void toggleQuestStatus(item.quest.id, item.completionStatus);
                        }}
                      >
                        {item.completionStatus}
                      </button>
                    </summary>
                    <div className="requirement-card-body">
                      <RequirementList items={item.requirements.required} />
                      {item.requirements.optional.length > 0 && (
                        <>
                          <div className="label">Optional</div>
                          <RequirementList items={item.requirements.optional} />
                        </>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="requirements-section">
          <div className="requirements-summary">
            <div className="requirements-card">
              <span className="label">Diary tiers</span>
              <strong>
                {diarySummary.complete}/{diarySummary.total}
              </strong>
              <span className="muted">tiers done</span>
            </div>
            <div className="requirements-card">
              <span className="label">Combat</span>
              <strong>
                {combatSummary.complete}/{combatSummary.total}
              </strong>
              <span className="muted">tasks done</span>
            </div>
          </div>

          {requirementsError && (
            <div className="requirements-error">{requirementsError}</div>
          )}

          {requirementsData && (
            <div className="achievements-grid">
              <section className="achievement-panel">
                <div className="achievement-panel-header">
                  <div>
                    <h3>Achievement diaries</h3>
                    <p className="muted">Track regional tiers and tasks.</p>
                  </div>
                  <input
                    placeholder="Search diaries"
                    value={diarySearch}
                    onChange={(event) => setDiarySearch(event.target.value)}
                  />
                </div>
                <div className="requirements-stack">
                  {filteredDiaries.length === 0 && (
                    <div className="muted">No diaries match your search.</div>
                  )}
                  {filteredDiaries.map((entry, index) => {
                    const status = summarizeStatus(
                      entry.tiers.flatMap((tier) =>
                        tier.tasks.map((task) => task.completionStatus)
                      )
                    );

                    return (
                      <details key={entry.diary.id} className="requirement-card" open={index < 2}>
                        <summary>
                          <div className="requirement-summary">
                            <strong>{entry.diary.name}</strong>
                            <span className="muted">{entry.diary.region}</span>
                          </div>
                          <span className={statusClass(status)}>
                            {status}
                          </span>
                        </summary>
                        <div className="requirement-card-body">
                          {entry.tiers.map((tier) => {
                            const tierStatus = summarizeStatus(
                              tier.tasks.map((task) => task.completionStatus)
                            );
                            return (
                            <details
                              key={`${entry.diary.id}-${tier.tier.tier}`}
                              className="requirement-subcard"
                            >
                              <summary>
                                <div className="requirement-summary">
                                  <strong>{tier.tier.name ?? tier.tier.tier}</strong>
                                  <span className="muted">{tier.tasks.length} tasks</span>
                                </div>
                                <span className={statusClass(tierStatus)}>
                                  {tierStatus}
                                </span>
                              </summary>
                              <div className="requirement-card-body">
                                <RequirementList items={tier.requirements.required} />
                                {tier.requirements.optional.length > 0 && (
                                  <>
                                    <div className="label">Optional</div>
                                    <RequirementList items={tier.requirements.optional} />
                                  </>
                                )}
                                <div className="requirement-task-list">
                                  {tier.tasks.map((task) => (
                                    <div key={task.task.id} className="requirement-task">
                                      <div className="requirement-task-header">
                                        <span>{task.task.description}</span>
                                        <span className={statusClass(task.completionStatus)}>
                                          {task.completionStatus}
                                        </span>
                                      </div>
                                      <RequirementList items={task.requirements.required} />
                                      {task.requirements.optional.length > 0 && (
                                        <>
                                          <div className="label">Optional</div>
                                          <RequirementList items={task.requirements.optional} />
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </details>
                          );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>

              <section className="achievement-panel">
                <div className="achievement-panel-header">
                  <div>
                    <h3>Combat achievements</h3>
                    <p className="muted">Track tiers and boss tasks.</p>
                  </div>
                  <input
                    placeholder="Search combat achievements"
                    value={combatSearch}
                    onChange={(event) => setCombatSearch(event.target.value)}
                  />
                </div>
                <div className="requirements-stack">
                  {filteredCombat.length === 0 && (
                    <div className="muted">No combat achievements match your search.</div>
                  )}
                  {Object.entries(combatByTier).map(([tier, items], index) => {
                    const status = summarizeStatus(
                      items.map((item) => item.completionStatus)
                    );

                    return (
                      <details key={tier} className="requirement-card" open={index < 2}>
                        <summary>
                          <div className="requirement-summary">
                            <strong>{tier}</strong>
                            <span className="muted">{items.length} tasks</span>
                          </div>
                          <span className={statusClass(status)}>
                            {status}
                          </span>
                        </summary>
                        <div className="requirement-card-body">
                          <div className="requirement-task-list">
                            {items.map((item) => (
                              <div key={item.achievement.id} className="requirement-task">
                                <div className="requirement-task-header">
                                  <span>{item.achievement.name}</span>
                                  <span className={statusClass(item.completionStatus)}>
                                    {item.completionStatus}
                                  </span>
                                </div>
                                {item.achievement.description && (
                                  <p className="muted">{item.achievement.description}</p>
                                )}
                                <RequirementList items={item.requirements.required} />
                                {item.requirements.optional.length > 0 && (
                                  <>
                                    <div className="label">Optional</div>
                                    <RequirementList items={item.requirements.optional} />
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {activityMap && (
            <div className="achievement-panel">
              <div className="achievement-panel-header">
                <div>
                  <h3>Skillbound achievements</h3>
                  <p className="muted">Progress milestones powered by your activity stats.</p>
                </div>
              </div>
              <div className="requirements-stack">
                {activityAchievements.map((achievement) => {
                  const current = activityMap['collections_logged'] ?? 0;
                  const progress = Math.min(100, (current / achievement.target) * 100);
                  const remaining = Math.max(achievement.target - current, 0);
                  const completed = current >= achievement.target;

                  return (
                    <div key={achievement.id} className="requirement-card">
                      <div className="requirement-card-body">
                        <div className="achievement-row">
                          <div>
                            <strong>{achievement.label}</strong>
                            <span className="muted">
                              {completed
                                ? 'Completed'
                                : `${formatNumber(remaining)} left`}
                            </span>
                          </div>
                          <span className={`status-pill ${completed ? 'met' : 'unknown'}`}>
                            {formatNumber(current)} / {formatNumber(achievement.target)}
                          </span>
                        </div>
                        <div className="achievement-progress">
                          <div style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clues' && (
        <div className="requirements-section">
          <div className="requirements-summary">
            <div className="requirements-card">
              <span className="label">Clue scrolls</span>
              <strong>{formatNumber(clueTotal)}</strong>
              <span className="muted">total completed</span>
            </div>
          </div>
          <div className="requirements-stack">
          {clueActivities.map((item) => (
            <div key={item.key} className="requirement-card">
              <div className="requirement-card-body">
                <div className="requirement-task-header">
                  <span>{item.label}</span>
                  <span className="status-pill met">
                    {formatNumber(activityMap?.[item.key] ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
            {!activityMap && (
              <div className="requirements-error">
                No activity data available yet. Sync your character to load
                clue scroll counts.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pvp' && (
        <div className="requirements-section">
          <div className="requirements-summary">
            <div className="requirements-card">
              <span className="label">PvP points</span>
              <strong>{formatNumber(pvpTotal)}</strong>
              <span className="muted">excluding PvP Arena rank</span>
            </div>
          </div>
          <div className="requirements-stack">
            {pvpActivities.map((item) => (
              <div key={item.key} className="requirement-card">
                <div className="requirement-card-body">
                  <div className="requirement-task-header">
                    <span>{item.label}</span>
                    <span className="status-pill met">
                      {formatNumber(activityMap?.[item.key] ?? 0)}
                    </span>
                  </div>
                  {item.key === 'pvp_arena_rank' && (
                    <span className="muted">
                      PvP Arena rank is not included in total points.
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!activityMap && (
              <div className="requirements-error">
                No activity data available yet. Sync your character to load PvP
                stats.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
