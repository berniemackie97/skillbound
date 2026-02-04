'use client';

import type { HiscoresResponse } from '@skillbound/hiscores';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ComprehensiveProgression } from '@/components/progression/comprehensive-progression';

type LookupResponse = {
  data: HiscoresResponse;
  meta?: {
    profileId?: string | null;
    mode?: string;
    dataSource?: string;
    dataSourceWarning?: string | null;
  };
};

type ProgressionBrowserProps = {
  initialUsername?: string;
  initialMode?: string;
  signedIn?: boolean;
  hasActiveCharacter?: boolean;
};

const MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'ironman', label: 'Ironman' },
  { value: 'hardcore-ironman', label: 'Hardcore' },
  { value: 'ultimate-ironman', label: 'Ultimate' },
];

export function ProgressionBrowser({
  initialUsername,
  initialMode,
  signedIn,
  hasActiveCharacter,
}: ProgressionBrowserProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername ?? '');
  const [mode, setMode] = useState(initialMode ?? 'auto');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Progression');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = useCallback(
    async (overrideUsername?: string, overrideMode?: string) => {
      const resolvedUsername = (overrideUsername ?? username).trim();
      const resolvedMode = overrideMode ?? mode;
      if (!resolvedUsername) {
        setError('Enter a username to fetch progression.');
        return;
      }

      setError(null);
      setStatus('Fetching player data…');
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/characters/lookup?username=${encodeURIComponent(resolvedUsername)}&mode=${encodeURIComponent(
            resolvedMode
          )}`
        );

        if (!response.ok) {
          throw new Error('Lookup failed. Try another name.');
        }

        const payload = (await response.json()) as LookupResponse;
        const nextProfileId = payload.meta?.profileId ?? null;
        if (!nextProfileId) {
          throw new Error('Unable to resolve a profile for that player.');
        }

        setProfileId(nextProfileId);
        setDisplayName(payload.data.displayName ?? resolvedUsername);
        setStatus(null);

        const query = new URLSearchParams();
        query.set('username', resolvedUsername);
        query.set('mode', resolvedMode);
        router.replace(`/progression?${query.toString()}`);
      } catch (err) {
        setStatus(null);
        setError(err instanceof Error ? err.message : 'Lookup failed.');
      } finally {
        setIsLoading(false);
      }
    },
    [mode, router, username]
  );

  useEffect(() => {
    if (initialUsername) {
      void handleLookup(initialUsername, initialMode ?? 'auto');
    }
  }, [handleLookup, initialMode, initialUsername]);

  return (
    <div className="progression-container">
      <div className="progression-header">
        <div>
          <h2>Progression Tracker</h2>
          <p className="text-muted">
            Browse progression for any OSRS account. Sign in to save and edit.
          </p>
        </div>
        <div className="progression-filters">
          <input
            className="search-input"
            placeholder="Search player"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <select
            className="filter-select"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="button"
            disabled={isLoading}
            onClick={() => handleLookup()}
          >
            {isLoading ? 'Fetching…' : 'Fetch player'}
          </button>
        </div>
      </div>

      <div className="callout">
        <h4>Guest mode enabled</h4>
        <p>
          You can edit progression in this session. Changes are saved locally
          in your browser unless you sign in to sync across devices.
        </p>
      </div>

      {signedIn && !hasActiveCharacter && (
        <div className="callout">
          <h4>No active character</h4>
          <p>
            Choose a saved character from the dropdown to enable editing and
            progress tracking.
          </p>
        </div>
      )}

      {error && <div className="progression-error">{error}</div>}
      {status && <div className="status-note">{status}</div>}

      {profileId ? (
        <ComprehensiveProgression
          readOnly
          characterName={displayName}
          profileId={profileId}
        />
      ) : (
        <div className="progression-empty">
          <h3>Search for a player</h3>
          <p>Enter a username above to load progression data.</p>
        </div>
      )}
    </div>
  );
}
