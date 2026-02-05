import { formatNumber } from '@/lib/format/format-number';
import type {
  getOverallSkill,
  getTopActivities,
  getTopSkills,
} from '@/lib/lookup/lookup-data';
import type { LookupResponse } from '@/lib/lookup/lookup-types';

export function LookupResult({
  lookup,
  overall,
  skillTiles,
  activityTiles,
}: {
  lookup: LookupResponse;
  overall: ReturnType<typeof getOverallSkill>;
  skillTiles: ReturnType<typeof getTopSkills>;
  activityTiles: ReturnType<typeof getTopActivities>;
}) {
  return (
    <div className="result-grid">
      <div className="result-summary">
        <div>
          <span className="label">Player</span>
          <h3>{lookup.data.displayName}</h3>
        </div>

        <div className="pill-group">
          <span className="pill">{lookup.data.mode}</span>
          <span className="pill">{lookup.meta.cached ? 'cached' : 'live'}</span>
        </div>

        <div className="stat-row">
          <div>
            <span>Total level</span>
            <strong>{overall?.level ?? '-'}</strong>
          </div>
          <div>
            <span>Total XP</span>
            <strong>{overall ? formatNumber(overall.xp) : '-'}</strong>
          </div>
          <div>
            <span>Captured</span>
            <strong>{new Date(lookup.data.capturedAt).toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="result-list">
        <h4>Top skills</h4>
        <ul>
          {skillTiles.slice(0, 6).map((skill) => (
            <li key={skill.key}>
              <span>{skill.name}</span>
              <span>{formatNumber(skill.level)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="result-list">
        <h4>Top activities</h4>
        <ul>
          {activityTiles.map((activity) => (
            <li key={activity.key}>
              <span>{activity.name}</span>
              <span>{formatNumber(activity.score)}</span>
            </li>
          ))}
          {activityTiles.length === 0 ? (
            <li className="muted">No tracked activity scores yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
