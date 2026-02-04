'use client';

import {
  calculateXpToLevel,
  getLevelForXp,
  getXpForLevel,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  type SkillName,
} from '@skillbound/domain';
import type { HiscoresResponse } from '@skillbound/hiscores';
import { useCallback, useMemo, useState } from 'react';

type SkillSnapshot = {
  name: string;
  level: number;
  xp: number;
};

type LookupMeta = {
  cached?: boolean;
  mode?: string;
};

type SkillKey = (typeof SKILLS)[number];

type SkillXpCalculatorProps = {
  activeCharacterName?: string | null;
  snapshotSkills?: SkillSnapshot[] | null;
  initialSkill: SkillKey;
  initialMode: string;
  initialUsername: string;
  initialCurrentLevel: string;
  initialCurrentXp: string;
  initialTargetLevel: string;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function parseNumber(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeGetXpForLevel(level: number | null) {
  if (level === null) {
    return null;
  }
  try {
    return getXpForLevel(level);
  } catch {
    return null;
  }
}

function safeGetLevelForXp(xp: number | null) {
  if (xp === null) {
    return null;
  }
  try {
    return getLevelForXp(xp);
  } catch {
    return null;
  }
}

function getSkillEntryFromLookup(
  lookup: HiscoresResponse | null,
  skill: SkillKey
) {
  if (!lookup) {
    return null;
  }
  return lookup.skills.find((entry) => entry.key === skill) ?? null;
}

export default function SkillXpCalculator({
  activeCharacterName,
  snapshotSkills,
  initialSkill,
  initialMode,
  initialUsername,
  initialCurrentLevel,
  initialCurrentXp,
  initialTargetLevel,
}: SkillXpCalculatorProps) {
  const [skill, setSkill] = useState<SkillKey>(initialSkill);
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState(initialUsername);
  const [currentLevel, setCurrentLevel] = useState(initialCurrentLevel);
  const [currentXp, setCurrentXp] = useState(initialCurrentXp);
  const [targetLevel, setTargetLevel] = useState(initialTargetLevel);
  const [lookupData, setLookupData] = useState<HiscoresResponse | null>(null);
  const [lookupMeta, setLookupMeta] = useState<LookupMeta | null>(null);
  const [lookupStatus, setLookupStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const snapshotSkillMap = useMemo(() => {
    const map = new Map<SkillKey, SkillSnapshot>();
    if (!snapshotSkills) {
      return map;
    }
    for (const entry of snapshotSkills) {
      if (SKILLS.includes(entry.name as SkillKey)) {
        map.set(entry.name as SkillKey, entry);
      }
    }
    return map;
  }, [snapshotSkills]);

  const applySkillSnapshot = useCallback(
    (skillKey: SkillKey) => {
      const entry = snapshotSkillMap.get(skillKey);
      if (!entry) {
        return false;
      }
      setCurrentLevel(String(entry.level));
      setCurrentXp(String(entry.xp));
      return true;
    },
    [snapshotSkillMap]
  );

  const applyLookupSkill = useCallback(
    (skillKey: SkillKey, lookup: HiscoresResponse | null) => {
      const entry = getSkillEntryFromLookup(lookup, skillKey);
      if (!entry) {
        return false;
      }
      setCurrentLevel(String(entry.level));
      setCurrentXp(String(entry.xp));
      return true;
    },
    []
  );

  const handleSkillChange = (nextSkill: SkillKey) => {
    setSkill(nextSkill);
    if (lookupData && applyLookupSkill(nextSkill, lookupData)) {
      return;
    }
    applySkillSnapshot(nextSkill);
  };

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

  const parsedCurrentLevel = parseNumber(currentLevel);
  const parsedCurrentXp = parseNumber(currentXp);
  const parsedTargetLevel = parseNumber(targetLevel);
  const fallbackXpFromLevel = safeGetXpForLevel(parsedCurrentLevel);

  const resolvedCurrentXp = parsedCurrentXp ?? fallbackXpFromLevel;
  const resolvedCurrentLevel =
    safeGetLevelForXp(resolvedCurrentXp) ?? parsedCurrentLevel;

  const result = useMemo(() => {
    if (resolvedCurrentXp === null || parsedTargetLevel === null) {
      return null;
    }
    try {
      return calculateXpToLevel(resolvedCurrentXp, parsedTargetLevel);
    } catch {
      return null;
    }
  }, [parsedTargetLevel, resolvedCurrentXp]);

  const lookupLabel = lookupData?.displayName ?? lookupData?.username ?? '';
  const lookupMetaLabel = lookupMeta?.mode ? ` (${lookupMeta.mode})` : '';
  const lookupStatusLabel =
    lookupStatus === 'loading'
      ? 'Loading lookup…'
      : lookupStatus === 'success'
        ? `Lookup ready${lookupLabel ? `: ${lookupLabel}${lookupMetaLabel}` : ''}`
        : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Skill XP calculator</h2>
          <p>Per-skill planning with canonical XP tables.</p>
        </div>
        <div className="panel-actions">
          {activeCharacterName && (
            <span className="pill subtle">Active: {activeCharacterName}</span>
          )}
          {lookupLabel && (
            <span className="pill">
              Lookup: {lookupLabel}
              {lookupMetaLabel}
            </span>
          )}
        </div>
      </div>
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Username</span>
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          <span>Mode</span>
          <select
            name="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="auto">Auto detect</option>
            <option value="normal">Normal</option>
            <option value="ironman">Ironman</option>
            <option value="hardcore-ironman">Hardcore</option>
            <option value="ultimate-ironman">Ultimate</option>
          </select>
        </label>
        <label>
          <span>Skill</span>
          <select
            name="skill"
            value={skill}
            onChange={(event) =>
              handleSkillChange(event.target.value as SkillKey)
            }
          >
            {SKILLS.map((skillKey) => (
              <option key={skillKey} value={skillKey}>
                {SKILL_DISPLAY_NAMES[skillKey as SkillName]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Current level</span>
          <input
            name="currentLevel"
            value={currentLevel}
            onChange={(event) => setCurrentLevel(event.target.value)}
          />
        </label>
        <label>
          <span>Current XP</span>
          <input
            name="currentXp"
            value={currentXp}
            onChange={(event) => setCurrentXp(event.target.value)}
          />
        </label>
        <label>
          <span>Target level</span>
          <input
            name="targetLevel"
            value={targetLevel}
            onChange={(event) => setTargetLevel(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button
            className="button ghost"
            type="button"
            onClick={handleLookup}
            disabled={lookupStatus === 'loading'}
          >
            {lookupStatus === 'loading' ? 'Looking up…' : 'Lookup'}
          </button>
          {activeCharacterName && (
            <button
              className="button ghost"
              type="button"
              onClick={handleUseActive}
            >
              Use active character
            </button>
          )}
          <button className="button" type="submit">
            Calculate
          </button>
        </div>
      </form>

      {lookupStatusLabel && !lookupError && (
        <div className="status-note">{lookupStatusLabel}</div>
      )}

      <div className="result-card">
        {lookupError && <div className="error">{lookupError}</div>}
        {!result && (
          <div className="placeholder">Enter levels to calculate XP.</div>
        )}
        {result && (
          <div className="result-grid">
            <div className="result-summary">
              <div>
                <span className="label">Skill</span>
                <h3>{SKILL_DISPLAY_NAMES[skill]}</h3>
              </div>
              <div className="stat-row">
                <div>
                  <span>Current level</span>
                  <strong>
                    {resolvedCurrentLevel !== null
                      ? formatNumber(resolvedCurrentLevel)
                      : '-'}
                  </strong>
                </div>
                <div>
                  <span>Current XP</span>
                  <strong>
                    {resolvedCurrentXp !== null
                      ? formatNumber(resolvedCurrentXp)
                      : '-'}
                  </strong>
                </div>
                <div>
                  <span>XP remaining</span>
                  <strong>{formatNumber(result.xpRemaining)}</strong>
                </div>
                <div>
                  <span>Levels to go</span>
                  <strong>{formatNumber(result.levelsRemaining)}</strong>
                </div>
                <div>
                  <span>Progress</span>
                  <strong>{result.progressPercentage.toFixed(1)}%</strong>
                </div>
              </div>
            </div>
            <div className="stack-card">
              <h3>Method planning</h3>
              <p className="muted">
                Method datasets will plug into this panel (e.g. bones, runes,
                and skilling methods per skill). This will mirror the wiki-style
                calculator view.
              </p>
            </div>
            <div className="stack-card">
              <h3>Next steps</h3>
              <ul>
                <li>Attach content bundle method data per skill.</li>
                <li>Stack action plans with modifiers.</li>
                <li>Surface time-to-goal estimates.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
