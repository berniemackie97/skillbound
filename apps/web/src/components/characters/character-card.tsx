'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type CharacterCardProps = {
  character: {
    id: string;
    displayName: string;
    mode: string;
    lastSyncedAt: string | null;
    tags: string[];
    notes: string | null;
    isPublic: boolean;
    archivedAt?: string | null;
  };
  isActive: boolean;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString();
}

export function CharacterCard({ character, isActive }: CharacterCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tagsInput, setTagsInput] = useState(character.tags.join(', '));
  const [notesInput, setNotesInput] = useState(character.notes ?? '');
  const [isPublic, setIsPublic] = useState(character.isPublic);
  const [isArchived, setIsArchived] = useState(Boolean(character.archivedAt));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tagList = useMemo(
    () => character.tags.filter((tag) => tag.trim().length > 0).slice(0, 6),
    [character.tags]
  );

  async function handleSetActive() {
    setError(null);
    setStatus('Setting active…');
    const response = await fetch('/api/characters/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id }),
    });

    if (!response.ok) {
      setStatus(null);
      setError('Unable to set active character.');
      return;
    }

    setStatus('Active character updated.');
    router.refresh();
  }

  async function handleSync() {
    setError(null);
    setStatus('Syncing…');
    const response = await fetch(`/api/characters/${character.id}/sync`, {
      method: 'POST',
    });
    if (!response.ok) {
      setStatus(null);
      setError('Sync failed. Try again soon.');
      return;
    }
    setStatus('Snapshot captured.');
    router.refresh();
  }

  async function handleSave() {
    setError(null);
    setStatus('Saving changes…');
    const response = await fetch(`/api/characters/${character.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: tagsInput,
        notes: notesInput,
        isPublic,
        archived: isArchived,
      }),
    });
    if (!response.ok) {
      setStatus(null);
      setError('Unable to save character updates.');
      return;
    }
    setStatus('Changes saved.');
    setIsEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${character.displayName}? This removes snapshots and overrides.`
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    setStatus('Deleting character…');
    const response = await fetch(`/api/characters/${character.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setStatus(null);
      setError('Delete failed. Try again.');
      return;
    }
    setStatus('Character deleted.');
    router.refresh();
  }

  async function handleArchiveToggle() {
    const nextArchived = !isArchived;
    const confirmed = nextArchived
      ? window.confirm(
          `Archive ${character.displayName}? You can restore it later.`
        )
      : true;
    if (!confirmed) {
      return;
    }
    setError(null);
    setStatus(nextArchived ? 'Archiving…' : 'Restoring…');
    const response = await fetch(`/api/characters/${character.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: nextArchived }),
    });
    if (!response.ok) {
      setStatus(null);
      setError('Update failed. Try again.');
      return;
    }
    setStatus(nextArchived ? 'Character archived.' : 'Character restored.');
    setIsArchived(nextArchived);
    router.refresh();
  }

  return (
    <article className="character-card">
      <div className="character-card-header">
        <div>
          <h3>{character.displayName}</h3>
          <div className="pill-group">
            <span className="pill">{character.mode}</span>
            {isActive && <span className="pill subtle">Active</span>}
            <span className="pill">
              {character.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>
      </div>
      <div className="character-meta">
        <span>Last sync</span>
        <strong>{formatTimestamp(character.lastSyncedAt)}</strong>
      </div>
      {tagList.length > 0 && (
        <div className="character-tags">
          {tagList.map((tag) => (
            <span key={tag} className="pill subtle">
              {tag}
            </span>
          ))}
        </div>
      )}
      {character.notes && <p className="character-notes">{character.notes}</p>}
      <div className="character-actions">
        <button
          className="button ghost"
          type="button"
          onClick={handleSetActive}
          disabled={isActive}
        >
          {isActive ? 'Active' : 'Set active'}
        </button>
        <button className="button" type="button" onClick={handleSync}>
          Sync now
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={() => setIsEditing((value) => !value)}
        >
          {isEditing ? 'Close edit' : 'Edit details'}
        </button>
        <button className="button ghost" type="button" onClick={handleArchiveToggle}>
          {isArchived ? 'Restore' : 'Archive'}
        </button>
        <button className="button danger" type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>

      {isEditing && (
        <div className="character-edit">
          <label>
            <span>Tags (comma separated)</span>
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </label>
          <label>
            <span>Notes</span>
            <textarea
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            <span>Public profile</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isArchived}
              onChange={(event) => setIsArchived(event.target.checked)}
            />
            <span>Archived</span>
          </label>
          <div className="form-actions">
            <button className="button" type="button" onClick={handleSave}>
              Save changes
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setIsEditing(false);
                setTagsInput(character.tags.join(', '));
                setNotesInput(character.notes ?? '');
                setIsPublic(character.isPublic);
                setStatus(null);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && !error && <div className="status-note">{status}</div>}
      {error && <div className="error">{error}</div>}
    </article>
  );
}
