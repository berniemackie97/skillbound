import { formatNumber } from '@/lib/format/format-number';
import type { getTopActivities } from '@/lib/lookup/lookup-data';

export function ActivityTilesPanel({
  activities,
}: {
  activities: ReturnType<typeof getTopActivities>;
}) {
  const hasActivities = activities.length > 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Activity highlights</h2>
          <p>Most active bosses, minigames, and leaderboard categories.</p>
        </div>
      </div>

      <div className="tile-grid">
        {activities.map((activity) => (
          <div key={activity.key} className="skill-tile">
            <div className="skill-header">
              <span>{activity.name}</span>
              <span className="pill subtle">
                {formatNumber(activity.score)}
              </span>
            </div>

            <div className="skill-meta">
              <span>Rank</span>
              <strong>{formatNumber(activity.rank)}</strong>
            </div>
          </div>
        ))}

        {!hasActivities ? (
          <div className="skill-tile muted">
            No activity scores with non-zero values.
          </div>
        ) : null}
      </div>
    </section>
  );
}
