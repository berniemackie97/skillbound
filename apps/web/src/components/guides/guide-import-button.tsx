'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type GuideImportButtonProps = {
  characterId: string;
  templateId: string;
};

export function GuideImportButton({
  characterId,
  templateId,
}: GuideImportButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    setStatus('Importing guide…');
    const response = await fetch('/api/guides/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, templateId }),
    });

    if (!response.ok) {
      setStatus(null);
      setError('Import failed. Try again.');
      return;
    }

    setStatus('Guide imported.');
    router.refresh();
  }

  return (
    <div className="guide-import">
      <button className="button" type="button" onClick={handleImport}>
        Import
      </button>
      {status && !error && <span className="status-note">{status}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
