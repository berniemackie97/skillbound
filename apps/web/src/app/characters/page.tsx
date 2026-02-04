import type { CharacterSnapshot } from '@skillbound/database';
import {
  characterSnapshots,
  desc,
  eq,
  userCharacters,
} from '@skillbound/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CharacterCard } from '@/components/characters/character-card';
import { CharacterHubActions } from '@/components/characters/character-hub-actions';
import { CharacterManagementTools } from '@/components/characters/character-management-tools';
import { MilestoneList } from '@/components/characters/milestone-list';
import { ProgressionChart } from '@/components/characters/progression-chart';
import { SkillGainsChart } from '@/components/characters/skill-gains-chart';
import { WeeklyGainsChart } from '@/components/characters/weekly-gains-chart';
import { CompareSandbox } from '@/components/compare/compare-sandbox';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';
import { getCharacterStateSummary } from '@/lib/character/character-state-service';
import { getDbClient } from '@/lib/db';

export default async function CharactersPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login?redirect=/characters');
  }

  const savedCharacters = await getUserCharacters(sessionUser.id, {
    includeArchived: true,
  });
  const activeSelection = await getActiveCharacter(sessionUser.id);
  const activeCharacterId = activeSelection?.character?.id ?? null;

  const db = getDbClient();
  let recentSnapshots: CharacterSnapshot[] = [];
  let pulseSnapshots: CharacterSnapshot[] = [];
  const stateSummary = activeCharacterId
    ? await getCharacterStateSummary(activeCharacterId)
    : null;
  if (activeCharacterId) {
    const [row] = await db
      .select({ profileId: userCharacters.profileId })
      .from(userCharacters)
      .where(eq(userCharacters.id, activeCharacterId))
      .limit(1);

    if (row?.profileId) {
      recentSnapshots = await db
        .select()
        .from(characterSnapshots)
        .where(eq(characterSnapshots.profileId, row.profileId))
        .orderBy(desc(characterSnapshots.capturedAt))
        .limit(3);

      pulseSnapshots = await db
        .select()
        .from(characterSnapshots)
        .where(eq(characterSnapshots.profileId, row.profileId))
        .orderBy(desc(characterSnapshots.capturedAt))
        .limit(60);
    }
  }

  const latestSnapshot = pulseSnapshots[0] ?? null;
  const previousSnapshot = findPreviousSnapshotWithChange(pulseSnapshots);
  const activeCharacterName =
    activeSelection?.character?.displayName ?? 'No active character';

  const snapshotsAscending = [...pulseSnapshots].reverse();

  const snapshotDelta =
    latestSnapshot && previousSnapshot
      ? {
          totalXp: latestSnapshot.totalXp - previousSnapshot.totalXp,
          totalLevel: latestSnapshot.totalLevel - previousSnapshot.totalLevel,
          combatLevel:
            latestSnapshot.combatLevel - previousSnapshot.combatLevel,
        }
      : null;

  const skillGains =
    latestSnapshot && previousSnapshot
      ? latestSnapshot.skills
          .map((skill) => {
            const previousSkill = previousSnapshot.skills.find(
              (entry) => entry.name === skill.name
            );
            const deltaXp = skill.xp - (previousSkill?.xp ?? 0);
            const deltaLevel = skill.level - (previousSkill?.level ?? 0);
            return {
              name: skill.name,
              deltaXp,
              deltaLevel,
            };
          })
          .filter((entry) => entry.deltaXp > 0 || entry.deltaLevel > 0)
          .sort((a, b) => b.deltaXp - a.deltaXp)
          .slice(0, 6)
      : [];

  const activitySnapshots = snapshotsAscending.filter(
    (snapshot) =>
      snapshot.activities && Object.keys(snapshot.activities).length > 0
  );
  const activitySeries = buildActivitySeries(activitySnapshots);
  const milestoneSnapshots = recentSnapshots.filter(
    (snapshot) => snapshot.isMilestone
  );
  const milestoneItems = milestoneSnapshots.map((snapshot) => ({
    id: snapshot.id,
    label: formatMilestone(snapshot),
    capturedAt: snapshot.capturedAt.toLocaleString(),
    dataSource: snapshot.dataSource,
    totalLevel: snapshot.totalLevel,
    totalXp: snapshot.totalXp,
    combatLevel: snapshot.combatLevel,
    milestoneType: snapshot.milestoneType ?? null,
    milestoneData: snapshot.milestoneData ?? null,
  }));

  const [activeCharacters, archivedCharacters] = splitArchived(savedCharacters);
  const weeklySummary = buildWeeklyGainsSummary(pulseSnapshots);
  const recentUpdates = stateSummary?.recentUpdates ?? [];
  const recentHighlights = recentUpdates.slice(0, 6).map(formatStateUpdate);

  return (
    <>
      <section className="panel">
        <div className="character-hub-hero">
          <div className="hero-copy">
            <h2>Character Hub</h2>
            <p>
              A single command center for snapshots, progression, recent activity,
              and everything you track.
            </p>
            <CharacterHubActions activeCharacterId={activeCharacterId} />
          </div>
          <div className="hero-active-card">
            <div>
              <span className="label">Active character</span>
              <h3>{activeCharacterName}</h3>
              <p className="muted">
                {latestSnapshot
                  ? `Last snapshot ${latestSnapshot.capturedAt.toLocaleString()}`
                  : 'No snapshots captured yet.'}
              </p>
            </div>
            <div className="hero-quick-stats">
              <div>
                <span>Total level</span>
                <strong>{latestSnapshot?.totalLevel ?? '—'}</strong>
              </div>
              <div>
                <span>Total XP</span>
                <strong>{latestSnapshot?.totalXp ?? '—'}</strong>
              </div>
              <div>
                <span>Combat</span>
                <strong>{latestSnapshot?.combatLevel ?? '—'}</strong>
              </div>
            </div>
            <div className="hero-links">
              <Link href="/progression">Open progression</Link>
              <Link href="/trading?tab=tracker">Trade tracker</Link>
              <Link href="/guides">Guides</Link>
            </div>
          </div>
        </div>
        <div className="hero-kpis">
          <div className="stat-chip">
            <span>Quests completed</span>
            <strong>{stateSummary?.questsCompleted ?? '—'}</strong>
          </div>
          <div className="stat-chip">
            <span>Diaries complete</span>
            <strong>{stateSummary?.diariesCompleted ?? '—'}</strong>
          </div>
          <div className="stat-chip">
            <span>Unlocks obtained</span>
            <strong>{stateSummary?.unlocksObtained ?? '—'}</strong>
          </div>
          <div className="stat-chip">
            <span>Weekly XP</span>
            <strong>
              {weeklySummary
                ? formatDelta(weeklySummary.totalXpDelta)
                : '—'}
            </strong>
          </div>
        </div>
        <div className="panel-grid">
          <CharacterManagementTools
            activeLastSyncedAt={
              latestSnapshot ? latestSnapshot.capturedAt.toISOString() : null
            }
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Saved characters</h2>
            <p>Manage tracked characters, sync snapshots, and set focus.</p>
          </div>
        </div>
        {activeCharacters.length === 0 && (
          <div className="placeholder">
            No saved characters yet. Run a lookup to add one.
          </div>
        )}
        {activeCharacters.length > 0 && (
          <div className="character-grid">
            {activeCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                isActive={activeCharacterId === character.id}
                character={{
                  id: character.id,
                  displayName: character.displayName,
                  mode: character.mode,
                  lastSyncedAt: character.lastSyncedAt
                    ? character.lastSyncedAt.toISOString()
                    : null,
                  tags: character.tags ?? [],
                  notes: character.notes ?? null,
                  isPublic: character.isPublic,
                  archivedAt: character.archivedAt
                    ? character.archivedAt.toISOString()
                    : null,
                }}
              />
            ))}
          </div>
        )}
        {archivedCharacters.length > 0 && (
          <div className="archived-roster">
            <h3>Archived</h3>
            <div className="character-grid compact">
              {archivedCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  isActive={activeCharacterId === character.id}
                  character={{
                    id: character.id,
                    displayName: character.displayName,
                    mode: character.mode,
                    lastSyncedAt: character.lastSyncedAt
                      ? character.lastSyncedAt.toISOString()
                      : null,
                    tags: character.tags ?? [],
                    notes: character.notes ?? null,
                    isPublic: character.isPublic,
                    archivedAt: character.archivedAt
                      ? character.archivedAt.toISOString()
                      : null,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Snapshots & activity</h2>
            <p>Quick reads on progression, gains, and recent activity.</p>
          </div>
        </div>
        <div className="panel-grid">
          <div className="stack-card">
            <h3>Snapshot deltas</h3>
            {snapshotDelta ? (
              <div className="metric-list">
                <div className="metric-row">
                  <span>Total XP</span>
                  <strong>
                    {snapshotDelta.totalXp >= 0 ? '+' : ''}
                    {snapshotDelta.totalXp.toLocaleString()}
                  </strong>
                </div>
                <div className="metric-row">
                  <span>Total level</span>
                  <strong>
                    {snapshotDelta.totalLevel >= 0 ? '+' : ''}
                    {snapshotDelta.totalLevel}
                  </strong>
                </div>
                <div className="metric-row">
                  <span>Combat level</span>
                  <strong>
                    {snapshotDelta.combatLevel >= 0 ? '+' : ''}
                    {snapshotDelta.combatLevel}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="muted">Capture another snapshot to see deltas.</p>
            )}
          </div>
          <div className="stack-card wide">
            <h3>Progression trendlines</h3>
            {snapshotsAscending.length > 1 ? (
              <ProgressionChart
                data={snapshotsAscending.map((snapshot) => ({
                  timestamp: snapshot.capturedAt.toISOString(),
                  totalXp: snapshot.totalXp,
                  totalLevel: snapshot.totalLevel,
                  combatLevel: snapshot.combatLevel,
                }))}
              />
            ) : (
              <p className="muted">Capture more snapshots to build a trend.</p>
            )}
          </div>
          <div className="stack-card wide">
            <h3>Weekly gains breakdown</h3>
            {weeklySummary ? (
              <>
                <div className="metric-list compact">
                  <div className="metric-row">
                    <span>Total XP</span>
                    <strong>{formatDelta(weeklySummary.totalXpDelta)}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Total level</span>
                    <strong>{formatDelta(weeklySummary.totalLevelDelta)}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Combat</span>
                    <strong>{formatDelta(weeklySummary.combatLevelDelta)}</strong>
                  </div>
                </div>
                <WeeklyGainsChart gains={weeklySummary.topSkillGains} maxItems={8} />
              </>
            ) : (
              <p className="muted">Capture a full week of snapshots to see gains.</p>
            )}
          </div>
          <div className="stack-card">
            <h3>Top skill gains</h3>
            {skillGains.length > 0 ? (
              <SkillGainsChart gains={skillGains} maxItems={6} />
            ) : (
              <p className="muted">No skill gains detected yet.</p>
            )}
          </div>
          <div className="stack-card">
            <h3>Recent activity feed</h3>
            {recentHighlights.length > 0 ? (
              <ul className="activity-feed">
                {recentHighlights.map((update) => (
                  <li key={update.id}>
                    <span>{update.label}</span>
                    <small>{update.timestamp}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No recent updates captured yet.</p>
            )}
          </div>
          <div className="stack-card">
            <h3>Activity pulse</h3>
            {activitySeries.length > 0 ? (
              <div className="activity-grid">
                {activitySeries.map((activity) => (
                  <div key={activity.name} className="activity-card">
                    <div className="activity-header">
                      <span>{activity.name}</span>
                      <strong>+{activity.delta.toLocaleString()}</strong>
                    </div>
                    <div className="sparkline">
                      <svg aria-hidden="true" role="img" viewBox="0 0 180 64">
                        <polyline
                          className="sparkline-line"
                          points={buildSparklinePoints(activity.values, 180, 64)}
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No activity data available yet.</p>
            )}
          </div>
          <div className="stack-card">
            <h3>Recent milestones</h3>
            <MilestoneList milestones={milestoneItems} />
          </div>
          <div className="stack-card">
            <h3>Guides & overlays</h3>
            <p className="muted">
              Attach guides and requirement overlays to your active character.
            </p>
            <div className="inline-actions">
              <Link className="button ghost small" href="/guides">
                Manage guides
              </Link>
              <Link className="button ghost small" href="/requirements">
                Requirements
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Compare & insights</h2>
            <p>Review deltas, compare rosters, and spot trends faster.</p>
          </div>
        </div>
        <CompareSandbox
          activeCharacterId={activeCharacterId}
          characters={activeCharacters.map((character) => ({
            id: character.id,
            displayName: character.displayName,
            mode: character.mode,
            lastSyncedAt: character.lastSyncedAt
              ? character.lastSyncedAt.toISOString()
              : null,
          }))}
        />
      </section>
    </>
  );
}

function buildSparklinePoints(
  values: number[],
  width: number,
  height: number
) {
  if (values.length === 0) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * step;
      const normalized = (value - min) / range;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function findPreviousSnapshotWithChange(
  snapshotsDesc: CharacterSnapshot[]
): CharacterSnapshot | null {
  if (snapshotsDesc.length < 2) {
    return null;
  }

  const latest = snapshotsDesc[0];
  if (!latest) {
    return null;
  }

  for (let index = 1; index < snapshotsDesc.length; index += 1) {
    const candidate = snapshotsDesc[index];
    if (!candidate) {
      continue;
    }
    if (
      candidate.totalXp !== latest.totalXp ||
      candidate.totalLevel !== latest.totalLevel ||
      candidate.combatLevel !== latest.combatLevel
    ) {
      return candidate;
    }
  }

  return snapshotsDesc[1] ?? null;
}

function buildActivitySeries(
  snapshots: CharacterSnapshot[]
): Array<{
  name: string;
  values: number[];
  delta: number;
}> {
  if (snapshots.length === 0) {
    return [];
  }

  const activityNames = new Set<string>();
  for (const snapshot of snapshots) {
    for (const name of Object.keys(snapshot.activities ?? {})) {
      activityNames.add(name);
    }
  }

  const series = Array.from(activityNames).map((name) => {
    const values = snapshots.map((snapshot) => {
      const value = snapshot.activities?.[name];
      return typeof value === 'number' ? value : 0;
    });
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const delta = last - first;
    return { name, values, delta };
  });

  return series
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);
}

function formatMilestone(snapshot: CharacterSnapshot) {
  if (!snapshot.milestoneType) {
    return 'Milestone';
  }

  if (snapshot.milestoneType === 'level_up') {
    const skill = snapshot.milestoneData?.skill ?? 'Skill';
    const level = snapshot.milestoneData?.level ?? '';
    return `Level ${level} ${skill}`.trim();
  }

  if (snapshot.milestoneType === 'boss_pb') {
    const boss = snapshot.milestoneData?.boss ?? 'Boss';
    const time = snapshot.milestoneData?.time;
    const timeLabel = typeof time === 'number' ? ` (${time} ms)` : '';
    return `PB ${boss}${timeLabel}`;
  }

  if (snapshot.milestoneType === 'quest_complete') {
    const quest = snapshot.milestoneData?.quest ?? 'Quest';
    return `Quest complete: ${quest}`;
  }

  return snapshot.milestoneType.replace(/_/g, ' ');
}

function splitArchived<T extends { archivedAt: Date | null }>(
  characters: T[]
): [T[], T[]] {
  const active: T[] = [];
  const archived: T[] = [];

  for (const character of characters) {
    if (character.archivedAt) {
      archived.push(character);
    } else {
      active.push(character);
    }
  }

  return [active, archived];
}

function buildWeeklyGainsSummary(snapshotsDesc: CharacterSnapshot[]) {
  if (snapshotsDesc.length < 2) {
    return null;
  }

  const latest = snapshotsDesc[0];
  if (!latest) {
    return null;
  }

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const latestTime = latest.capturedAt.getTime();
  const baseline = snapshotsDesc.find((snapshot) => {
    const diff = latestTime - snapshot.capturedAt.getTime();
    return diff >= oneWeekMs;
  });

  if (!baseline) {
    return null;
  }

  const skillDeltas = latest.skills.map((skill) => {
    const previous = baseline.skills.find((entry) => entry.name === skill.name);
    return {
      name: skill.name,
      deltaXp: skill.xp - (previous?.xp ?? 0),
      deltaLevel: skill.level - (previous?.level ?? 0),
    };
  });

  const topSkillGains = skillDeltas
    .filter((entry) => entry.deltaXp > 0 || entry.deltaLevel > 0)
    .sort((a, b) => b.deltaXp - a.deltaXp)
    .slice(0, 5);

  return {
    totalXpDelta: latest.totalXp - baseline.totalXp,
    totalLevelDelta: latest.totalLevel - baseline.totalLevel,
    combatLevelDelta: latest.combatLevel - baseline.combatLevel,
    topSkillGains,
  };
}

function formatDelta(value: number) {
  if (Number.isNaN(value)) {
    return '—';
  }

  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString()}`;
}

function formatStateUpdate(state: {
  id: string;
  domain: string;
  key: string;
  value: unknown;
  updatedAt: Date;
}) {
  const value = state.value as Record<string, unknown>;
  let label = `${state.domain.replace(/_/g, ' ')} • ${state.key}`;

  if (state.domain === 'quest') {
    const completed = Boolean(value['completed']);
    label = `${completed ? 'Quest complete' : 'Quest updated'} • ${state.key}`;
  } else if (state.domain === 'diary') {
    const completed = Boolean(value['completed']);
    label = `${completed ? 'Diary complete' : 'Diary updated'} • ${state.key}`;
  } else if (state.domain === 'combat_achievement') {
    const completed = Boolean(value['completed']);
    label = `${
      completed ? 'Combat achievement complete' : 'Combat achievement'
    } • ${state.key}`;
  } else if (state.domain === 'milestone') {
    label = `Milestone • ${state.key}`;
  }

  return {
    id: state.id,
    label,
    timestamp: state.updatedAt.toLocaleString(),
  };
}
