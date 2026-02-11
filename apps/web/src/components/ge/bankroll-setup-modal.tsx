'use client';

import { useCallback, useRef, useState } from 'react';

import { parseGp, formatGp } from '@/lib/trading/ge-service';

interface BankrollSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  activeCharacterId: string | null;
}

export function BankrollSetupModal({
  isOpen,
  onClose,
  onSubmit,
  activeCharacterId,
}: BankrollSetupModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    const parsed = parseGp(inputValue);
    if (parsed === null || parsed <= 0) {
      setError('Enter a valid GP amount (e.g. 5m, 500k, 10000)');
      return;
    }

    if (!activeCharacterId) {
      setError('No active character selected. Go to Settings to select one.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/characters/${activeCharacterId}/bankroll`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentBankroll: parsed,
            initialBankroll: parsed,
          }),
        }
      );

      if (!response.ok) {
        setError('Failed to set bankroll. Please try again.');
        return;
      }

      onSubmit(parsed);
      setInputValue('');
      setError(null);
      localStorage.setItem('bankroll-updated', String(Date.now()));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, activeCharacterId, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void handleSubmit();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  if (!isOpen) return null;

  const parsedPreview = parseGp(inputValue);

  return (
    <div className="bankroll-modal-overlay" onClick={onClose}>
      <div
        className="bankroll-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bankroll-modal-title"
      >
        <button
          className="bankroll-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <h2 id="bankroll-modal-title" className="bankroll-modal__title">
          How much GP are you working with?
        </h2>

        <p className="bankroll-modal__subtitle">
          Set your trading bankroll to get personalized flip recommendations
          tailored to what you can afford.
        </p>

        <div className="bankroll-modal__input-group">
          <input
            ref={inputRef}
            type="text"
            className="bankroll-modal__input"
            placeholder="e.g. 5m, 500k, 10000"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {parsedPreview !== null && parsedPreview > 0 && (
            <span className="bankroll-modal__preview">
              {formatGp(parsedPreview)} GP
            </span>
          )}
        </div>

        {error && <p className="bankroll-modal__error">{error}</p>}

        {!activeCharacterId && (
          <p className="bankroll-modal__warning">
            You need an active character selected. Visit{' '}
            <a href="/settings" className="bankroll-modal__link">
              Settings
            </a>{' '}
            to choose one.
          </p>
        )}

        <div className="bankroll-modal__actions">
          <button
            className="bankroll-modal__btn bankroll-modal__btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bankroll-modal__btn bankroll-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting ||
              !activeCharacterId ||
              parsedPreview === null ||
              parsedPreview <= 0
            }
          >
            {isSubmitting ? 'Setting...' : 'Set Bankroll'}
          </button>
        </div>
      </div>
    </div>
  );
}
