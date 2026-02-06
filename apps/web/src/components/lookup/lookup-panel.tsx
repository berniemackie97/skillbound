import type { ReactNode } from 'react';

import type {
  getOverallSkill,
  getTopActivities,
  getTopSkills,
} from '@/lib/lookup/lookup-data';
import type { ModeValue, LookupResponse } from '@/lib/lookup/lookup-types';

import { LookupForm } from './lookup-form';
import { LookupResult } from './lookup-result';

type LookupPanelProps = {
  username: string;
  mode: ModeValue;
  lookup: LookupResponse | null;
  error: string | null;
  actions?: ReactNode;

  overall: ReturnType<typeof getOverallSkill>;
  skillTiles: ReturnType<typeof getTopSkills>;
  activityTiles: ReturnType<typeof getTopActivities>;
};

export function LookupPanel({
  username,
  mode,
  lookup,
  error,
  actions,
  overall,
  skillTiles,
  activityTiles,
}: LookupPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Character lookup</h2>
          <p>Fetch hiscores data and render a quick character dashboard.</p>
        </div>

        <div className="panel-actions">{actions}</div>
      </div>

      <LookupForm mode={mode} username={username} />

      <div className="result-card">
        {error ? <div className="error">{error}</div> : null}

        {!error && !lookup ? (
          <div className="placeholder">
            Submit a username to load skills and activity data.
          </div>
        ) : null}

        {lookup ? (
          <LookupResult
            activityTiles={activityTiles}
            lookup={lookup}
            overall={overall}
            skillTiles={skillTiles}
          />
        ) : null}
      </div>
    </section>
  );
}
