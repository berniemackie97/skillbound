'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal';

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [tagsInput, setTagsInput] = useState(character.tags.join(', '));
  const [notesInput, setNotesInput] = useState(character.notes ?? '');
  const [isPublic, setIsPublic] = useState(character.isPublic);
  const [isArchived, setIsArchived] = useState(Boolean(character.archivedAt));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTagsInput(character.tags.join(', '));
    setNotesInput(character.notes ?? '');
    setIsPublic(character.isPublic);
    setIsArchived(Boolean(character.archivedAt));
  }, [
    character.archivedAt,
    character.isPublic,
    character.notes,
    character.tags,
  ]);

  const tagList = useMemo(
    () => character.tags.filter((tag) => tag.trim().length > 0).slice(0, 6),
    [character.tags]
  );

  const resetEditState = () => {
    setTagsInput(character.tags.join(', '));
    setNotesInput(character.notes ?? '');
    setIsPublic(character.isPublic);
  };

  const openEditModal = () => {
    resetEditState();
    setError(null);
    setStatus(null);
    setIsEditOpen(true);
  };

  const openArchiveModal = () => {
    setError(null);
    setStatus(null);
    setIsArchiveOpen(true);
  };

  const openDeleteModal = () => {
    setError(null);
    setStatus(null);
    setIsDeleteOpen(true);
  };

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

  async function handleSave(): Promise<boolean> {
    setError(null);
    setStatus('Saving changes…');
    setIsWorking(true);
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
      setIsWorking(false);
      return false;
    }
    setStatus('Changes saved.');
    setIsWorking(false);
    setIsEditOpen(false);
    router.refresh();
    return true;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setStatus('Deleting character…');
    setIsWorking(true);
    const response = await fetch(`/api/characters/${character.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setStatus(null);
      setError('Delete failed. Try again.');
      setIsWorking(false);
      return false;
    }
    setStatus('Character deleted.');
    setIsWorking(false);
    setIsDeleteOpen(false);
    router.refresh();
    return true;
  }

  async function handleArchive(nextArchived: boolean): Promise<boolean> {
    setError(null);
    setStatus(nextArchived ? 'Archiving…' : 'Restoring…');
    setIsWorking(true);
    const response = await fetch(`/api/characters/${character.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: nextArchived }),
    });
    if (!response.ok) {
      setStatus(null);
      setError('Update failed. Try again.');
      setIsWorking(false);
      return false;
    }
    setStatus(nextArchived ? 'Character archived.' : 'Character restored.');
    setIsArchived(nextArchived);
    setIsWorking(false);
    setIsArchiveOpen(false);
    router.refresh();
    return true;
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
          disabled={isActive}
          type="button"
          onClick={handleSetActive}
        >
          {isActive ? 'Active' : 'Set active'}
        </button>
        <button className="button" type="button" onClick={handleSync}>
          Sync now
        </button>
        <button className="button ghost" type="button" onClick={openEditModal}>
          Edit details
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={openArchiveModal}
        >
          {isArchived ? 'Restore' : 'Archive'}
        </button>
        <button
          className="button danger"
          type="button"
          onClick={openDeleteModal}
        >
          Delete
        </button>
      </div>

      <Modal
        isOpen={isEditOpen}
        size="md"
        title={`Edit ${character.displayName}`}
        footer={
          <div className="form-actions">
            <button
              className="modal-btn primary"
              disabled={isWorking}
              type="button"
              onClick={handleSave}
            >
              {isWorking ? 'Saving…' : 'Save changes'}
            </button>
            <button
              className="modal-btn ghost"
              disabled={isWorking}
              type="button"
              onClick={() => {
                setIsEditOpen(false);
                resetEditState();
                setStatus(null);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        }
        onClose={() => setIsEditOpen(false)}
      >
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
              checked={isPublic}
              type="checkbox"
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            <span>Public profile</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={isArchiveOpen}
        size="sm"
        subtitle={character.displayName}
        title={isArchived ? 'Restore character' : 'Archive character'}
        footer={
          <div className="form-actions">
            <button
              className="modal-btn primary"
              disabled={isWorking}
              type="button"
              onClick={() => handleArchive(!isArchived)}
            >
              {isWorking
                ? isArchived
                  ? 'Restoring…'
                  : 'Archiving…'
                : isArchived
                  ? 'Restore'
                  : 'Archive'}
            </button>
            <button
              className="modal-btn ghost"
              disabled={isWorking}
              type="button"
              onClick={() => setIsArchiveOpen(false)}
            >
              Cancel
            </button>
          </div>
        }
        onClose={() => setIsArchiveOpen(false)}
      >
        <p className="modal-description">
          {isArchived
            ? 'Restore this character to include it in your active roster again.'
            : 'Archived characters stay saved but are hidden from your active list.'}
        </p>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        size="sm"
        subtitle={character.displayName}
        title="Delete character"
        footer={
          <div className="form-actions">
            <button
              className="modal-btn danger"
              disabled={isWorking}
              type="button"
              onClick={handleDelete}
            >
              {isWorking ? 'Deleting…' : 'Delete'}
            </button>
            <button
              className="modal-btn ghost"
              disabled={isWorking}
              type="button"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </button>
          </div>
        }
        onClose={() => setIsDeleteOpen(false)}
      >
        <p className="modal-description">
          This removes snapshots and overrides for this character. This action
          cannot be undone.
        </p>
      </Modal>

      {status && !error && <div className="status-note">{status}</div>}
      {error && <div className="error">{error}</div>}
    </article>
  );
}
