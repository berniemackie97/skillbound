'use client';

import { useEffect, useMemo, useState } from 'react';

type SyncSettings = {
  enabled: boolean;
  intervalHours: number;
};

type BulkSyncResponse = {
  data: {
    attempted: number;
    captured: number;
    failed: number;
    skipped: number;
  };
};

const INTERVAL_OPTIONS = [
  { label: 'Every 6 hours', value: 6 },
  { label: 'Every 12 hours', value: 12 },
  { label: 'Daily', value: 24 },
  { label: 'Every 2 days', value: 48 },
  { label: 'Every 3 days', value: 72 },
];

type CharacterManagementToolsProps = {
  activeLastSyncedAt: string | null;
};

function formatNextSync(
  lastSyncedAt: string | null,
  enabled: boolean,
  intervalHours: number
) {
  if (!enabled) {
    return 'Auto-sync paused';
  }
  if (!lastSyncedAt) {
    return 'Sync on next schedule';
  }
  const next = new Date(lastSyncedAt);
  next.setHours(next.getHours() + intervalHours);
  return next.toLocaleString();
}

export function CharacterManagementTools({
  activeLastSyncedAt,
}: CharacterManagementToolsProps) {
  const [settings, setSettings] = useState<SyncSettings>({
    enabled: true,
    intervalHours: 24,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const response = await fetch('/api/settings/character-sync');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { data?: SyncSettings };
      if (payload.data && isMounted) {
        setSettings(payload.data);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const nextSync = useMemo(
    () =>
      formatNextSync(
        activeLastSyncedAt,
        settings.enabled,
        settings.intervalHours
      ),
    [activeLastSyncedAt, settings.enabled, settings.intervalHours]
  );

  async function handleSaveSettings(next: SyncSettings) {
    setError(null);
    setStatus('Saving sync settings…');
    const response = await fetch('/api/settings/character-sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      setStatus(null);
      setError('Unable to update sync schedule.');
      return;
    }
    setStatus('Sync schedule updated.');
    setSettings(next);
  }

  async function handleBulkSync() {
    setError(null);
    setStatus('Syncing roster…');
    const response = await fetch('/api/characters/bulk-sync', {
      method: 'POST',
    });
    if (!response.ok) {
      setStatus(null);
      setError('Bulk sync failed. Try again.');
      return;
    }
    const payload = (await response.json()) as BulkSyncResponse;
    setStatus(
      `Synced ${payload.data.captured}/${payload.data.attempted} characters.`
    );
  }

  return (
    <div className="stack-card accent management-tools">
      <div className="management-header">
        <div>
          <h3>Management tools</h3>
        </div>
        <button className="button" type="button" onClick={handleBulkSync}>
          Bulk sync now
        </button>
      </div>
      <div className="management-controls">
        <label className="checkbox-row">
          <input
            checked={settings.enabled}
            type="checkbox"
            onChange={(event) =>
              handleSaveSettings({
                ...settings,
                enabled: event.target.checked,
              })
            }
          />
          <span>Enable scheduled syncs</span>
        </label>
        <select
          value={settings.intervalHours}
          onChange={(event) =>
            handleSaveSettings({
              ...settings,
              intervalHours: Number(event.target.value),
            })
          }
        >
          {INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="management-meta">
          <span className="label">Next sync</span>
          <strong>{nextSync}</strong>
        </div>
      </div>
      {status && !error && <div className="status-note">{status}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
