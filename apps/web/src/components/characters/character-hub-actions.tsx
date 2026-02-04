'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CharacterHubActionsProps = {
  activeCharacterId: string | null;
};

export function CharacterHubActions({
  activeCharacterId,
}: CharacterHubActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    if (!activeCharacterId) {
      setError('Select an active character before syncing.');
      setStatus(null);
      return;
    }

    setError(null);
    setStatus('Syncing snapshot…');

    const response = await fetch(`/api/characters/${activeCharacterId}/sync`, {
      method: 'POST',
    });

    if (!response.ok) {
      setStatus(null);
      setError('Sync failed. Try again in a moment.');
      return;
    }

    setStatus('Snapshot captured.');
    router.refresh();
  }

  return (
    <div className="hero-actions-wrap">
      <div className="hero-actions">
        <Link className="button" href="/lookup">
          New lookup
        </Link>
        <button className="button ghost" type="button" onClick={handleSync}>
          Sync snapshots
        </button>
        <Link className="button ghost" href="/compare">
          Compare characters
        </Link>
      </div>
      {status && !error && <div className="status-note">{status}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
