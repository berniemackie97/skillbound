'use client';

import type { ProgressDiff } from '@skillbound/domain';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CompareEntry = {
  character: {
    id: string;
    displayName: string;
    mode: string;
  };
  progress: {
    totalLevel: number;
    totalXp: number;
    combatLevel: number;
  };
  capturedAt: string;
};

type CompareResponse = {
  data: {
    entries: CompareEntry[];
    diff: ProgressDiff | null;
  };
};

type CompareSandboxProps = {
  characters?: Array<{
    id: string;
    displayName: string;
    mode: string;
    lastSyncedAt: string | null;
  }>;
  activeCharacterId?: string | null;
};

export function CompareSandbox({
  characters = [],
  activeCharacterId = null,
}: CompareSandboxProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [diff, setDiff] = useState<ProgressDiff | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleQuickCompare = useCallback(() => {
    const sorted = [...characters].sort((a, b) => {
      const aTime = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
      const bTime = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
      return bTime - aTime;
    });

    const picks: string[] = [];
    if (activeCharacterId) {
      picks.push(activeCharacterId);
    }

    for (const character of sorted) {
      if (picks.length >= 4) {
        break;
      }
      if (!picks.includes(character.id)) {
        picks.push(character.id);
      }
    }

    setSelectedIds(picks);
  }, [activeCharacterId, characters]);

  useEffect(() => {
    if (selectedIds.length === 0 && characters.length > 0) {
      handleQuickCompare();
    }
  }, [characters.length, handleQuickCompare, selectedIds.length]);

  if (characters.length === 0) {
    return (
      <div className="compare-sandbox">
        <p className="muted">
          No saved characters yet. Run a lookup to build a roster.
        </p>
      </div>
    );
  }

  async function handleCompare() {
    if (selectedIds.length < 2) {
      setError('Select at least two characters.');
      setEntries([]);
      setDiff(null);
      return;
    }

    setError(null);
    setStatus('Loading comparison…');

    const response = await fetch(
      `/api/compare?characterIds=${encodeURIComponent(selectedIds.join(','))}`
    );

    if (!response.ok) {
      setStatus(null);
      setError('Comparison failed. Check the ids and try again.');
      setEntries([]);
      return;
    }

    const payload = (await response.json()) as CompareResponse;
    setEntries(payload.data.entries ?? []);
    setDiff(payload.data.diff ?? null);
    setStatus(null);
  }

  function toggleCharacter(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function selectAll() {
    setSelectedIds(characters.map((character) => character.id));
  }

  const diffSkills = diff
    ? Object.entries(diff.skillDeltas)
        .map(([name, delta]) => ({
          name,
          levelDelta: delta.levelDelta,
          xpDelta: delta.xpDelta,
        }))
        .filter((entry) => entry.levelDelta !== 0 || entry.xpDelta !== 0)
        .sort((a, b) => b.xpDelta - a.xpDelta)
        .slice(0, 6)
    : [];

  const diffActivities = diff
    ? Object.entries(diff.activityDeltas)
        .map(([name, delta]) => ({ name, delta }))
        .filter((entry) => entry.delta !== 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 6)
    : [];

  return (
    <div className="compare-sandbox">
      <div className="compare-controls">
        <div className="compare-picker">
          <span className="label">Select characters</span>
          <div className="compare-chips">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                className={`chip ${
                  selectedSet.has(character.id) ? 'active' : ''
                }`}
                onClick={() => toggleCharacter(character.id)}
              >
                {character.displayName}
                <span className="muted">{character.mode}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="compare-actions">
          <button className="chip" type="button" onClick={handleQuickCompare}>
            Quick compare
          </button>
          <button className="chip" type="button" onClick={selectAll}>
            Select all
          </button>
          <button className="chip" type="button" onClick={clearSelection}>
            Clear
          </button>
        </div>
        <button
          className="button"
          disabled={selectedIds.length < 2}
          type="button"
          onClick={handleCompare}
        >
          Compare now
        </button>
      </div>
      {status && !error && <div className="status-note">{status}</div>}
      {error && <div className="error">{error}</div>}
      {entries.length > 0 && (
        <div className="compare-results">
          <div className="compare-table">
            <div className="compare-row header">
              <span>Character</span>
              <span>Total level</span>
              <span>Total XP</span>
              <span>Combat</span>
              <span>Captured</span>
            </div>
            {entries.map((entry) => (
              <div key={entry.character.id} className="compare-row">
                <span>{entry.character.displayName}</span>
                <span>{entry.progress.totalLevel}</span>
                <span>{entry.progress.totalXp.toLocaleString()}</span>
                <span>{entry.progress.combatLevel}</span>
                <span>{new Date(entry.capturedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {diff && (
            <div className="compare-diff">
              <div className="stack-card">
                <h3>Diff highlights</h3>
                <div className="metric-list">
                  <div className="metric-row">
                    <span>Total XP</span>
                    <strong>
                      {diff.totalXpDelta >= 0 ? '+' : ''}
                      {diff.totalXpDelta.toLocaleString()}
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span>Total level</span>
                    <strong>
                      {diff.totalLevelDelta >= 0 ? '+' : ''}
                      {diff.totalLevelDelta}
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span>Combat level</span>
                    <strong>
                      {diff.combatLevelDelta >= 0 ? '+' : ''}
                      {diff.combatLevelDelta}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="stack-card">
                <h3>Top skill gains</h3>
                {diffSkills.length > 0 ? (
                  <ul>
                    {diffSkills.map((skill) => (
                      <li key={skill.name} className="metric-row">
                        <span>{skill.name}</span>
                        <strong>
                          {skill.xpDelta >= 0 ? '+' : ''}
                          {skill.xpDelta.toLocaleString()} xp
                          {skill.levelDelta !== 0
                            ? ` (${skill.levelDelta >= 0 ? '+' : ''}${skill.levelDelta} lv)`
                            : ''}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No skill deltas found.</p>
                )}
              </div>
              <div className="stack-card">
                <h3>Activity deltas</h3>
                {diffActivities.length > 0 ? (
                  <ul>
                    {diffActivities.map((activity) => (
                      <li key={activity.name} className="metric-row">
                        <span>{activity.name}</span>
                        <strong>
                          {activity.delta >= 0 ? '+' : ''}
                          {activity.delta.toLocaleString()}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No activity deltas found.</p>
                )}
              </div>
            </div>
          )}
          <p className="muted compare-note">
            Tip: Use the API for full diff details when comparing two
            characters.
          </p>
        </div>
      )}
    </div>
  );
}
