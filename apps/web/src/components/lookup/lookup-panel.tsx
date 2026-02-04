import { getSessionUser } from '@/lib/auth/auth-helpers';

import { LookupForm } from './lookup-form';
import { LookupResult } from './lookup-result';
import type { ModeValue, LookupResponse } from '@/lib/lookup/lookup-types';
import type { getOverallSkill, getTopActivities, getTopSkills } from '@/lib/lookup/lookup-data';

type LookupPanelProps = {
  username: string;
  mode: ModeValue;
  lookup: LookupResponse | null;
  error: string | null;

  sessionUser: Awaited<ReturnType<typeof getSessionUser>>;
  isSaved: boolean;

  overall: ReturnType<typeof getOverallSkill>;
  skillTiles: ReturnType<typeof getTopSkills>;
  activityTiles: ReturnType<typeof getTopActivities>;
};

export function LookupPanel({
  username,
  mode,
  lookup,
  error,
  sessionUser,
  isSaved,
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

        <div className="panel-actions">
          <a
            className="chip"
            href="/api/characters/lookup"
            target="_blank"
            rel="noreferrer"
          >
            Endpoint
          </a>

          {lookup && sessionUser ? (
            isSaved ? (
              <span className="pill subtle">Saved</span>
            ) : (
              <form method="post" action="/api/characters">
                <input
                  type="hidden"
                  name="displayName"
                  value={lookup.data.displayName}
                />
                <input type="hidden" name="mode" value={lookup.data.mode} />
                <button className="button" type="submit">
                  Save character
                </button>
              </form>
            )
          ) : null}

          {lookup && !sessionUser ? (
            <a className="button ghost" href="/login">
              Sign in to save
            </a>
          ) : null}
        </div>
      </div>

      <LookupForm username={username} mode={mode} />

      <div className="result-card">
        {error ? <div className="error">{error}</div> : null}

        {!error && !lookup ? (
          <div className="placeholder">
            Submit a username to load skills and activity data.
          </div>
        ) : null}

        {lookup ? (
          <LookupResult
            lookup={lookup}
            overall={overall}
            skillTiles={skillTiles}
            activityTiles={activityTiles}
          />
        ) : null}
      </div>
    </section>
  );
}