'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatGp, parseGp } from '@/lib/trading/ge-service';

interface BankrollData {
  currentBankroll: number;
  initialBankroll: number;
}

interface BankrollCardProps {
  characterId: string;
  bankroll: BankrollData;
  totalProfit?: number;
  hideTitle?: boolean;
}

export function BankrollCard({
  characterId,
  bankroll,
  totalProfit = 0,
  hideTitle = false,
}: BankrollCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [startingInput, setStartingInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [fundsInput, setFundsInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);
  const fundsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      currentInputRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && isAddingFunds) {
      fundsInputRef.current?.focus();
    }
  }, [isAddingFunds, isEditing]);

  // Calculate ROI based on total profit vs initial bankroll
  const roi =
    bankroll.initialBankroll > 0
      ? (totalProfit / bankroll.initialBankroll) * 100
      : 0;

  function handleEdit() {
    // Pre-fill with current values
    setCurrentInput(String(bankroll.currentBankroll));
    setStartingInput(String(bankroll.initialBankroll));
    setIsEditing(true);
    setError(null);
  }

  async function handleAddFunds(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const deltaValue = parseGp(fundsInput);
    if (deltaValue === null || deltaValue <= 0) {
      setError('Enter a positive amount to add.');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/bankroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: deltaValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to add funds');
      }

      setFundsInput('');
      setIsAddingFunds(false);
      router.refresh();
    } catch {
      setError('Failed to add funds');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Parse inputs with GP suffix support
    const currentValue = parseGp(currentInput);
    const startingValue = parseGp(startingInput);

    if (currentValue === null) {
      setError('Invalid current bankroll. Try: 4m, 500k, or 1000000');
      return;
    }

    if (startingValue === null) {
      setError('Invalid starting bankroll. Try: 4m, 500k, or 1000000');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/bankroll`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentBankroll: currentValue,
          initialBankroll: startingValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update bankroll');
      }

      setIsEditing(false);
      setCurrentInput('');
      setStartingInput('');
      router.refresh();
    } catch {
      setError('Failed to update bankroll');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setCurrentInput('');
    setStartingInput('');
    setError(null);
  }

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/bankroll`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync bankroll');
      }

      router.refresh();
    } catch {
      setError('Failed to sync bankroll');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="bankroll-card">
      <div className={`bankroll-header ${hideTitle ? 'no-title' : ''}`}>
        {!hideTitle && <h3>Trading Bankroll</h3>}
        {!isEditing && (
          <div className="bankroll-actions">
            <button
              className="button ghost small"
              disabled={isSyncing}
              title="Recalculate bankroll from trades"
              onClick={handleSync}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button className="button ghost small" onClick={handleEdit}>
              Edit
            </button>
            <button
              className="button ghost small"
              onClick={() => {
                setIsAddingFunds((prev) => !prev);
                setError(null);
              }}
            >
              {isAddingFunds ? 'Close' : 'Add Funds'}
            </button>
          </div>
        )}
      </div>

      <div className="bankroll-content">
        {!isEditing ? (
          <div className="bankroll-stats">
            <div className="bankroll-stat">
              <span className="bankroll-stat-label">Current</span>
              <span className="bankroll-stat-value">
                {formatGp(bankroll.currentBankroll)}
              </span>
            </div>
            <div className="bankroll-stat">
              <span className="bankroll-stat-label">Starting</span>
              <span className="bankroll-stat-value">
                {formatGp(bankroll.initialBankroll)}
              </span>
            </div>
            <div className="bankroll-stat">
              <span className="bankroll-stat-label">Total Profit</span>
              <span
                className={`bankroll-stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}
              >
                {totalProfit >= 0 ? '+' : ''}
                {formatGp(totalProfit)}
              </span>
            </div>
            <div className="bankroll-stat">
              <span className="bankroll-stat-label">ROI</span>
              <span
                className={`bankroll-stat-value ${roi >= 0 ? 'positive' : 'negative'}`}
              >
                {roi >= 0 ? '+' : ''}
                {roi.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <form className="bankroll-edit-form" onSubmit={handleSubmit}>
            <div className="bankroll-edit-warning">
              <svg
                fill="none"
                height="16"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
              <div className="warning-text">
                <strong>Affects profit &amp; ROI calculations</strong>
                <span>
                  To add funds without affecting calculations, use{' '}
                  <em>Add Funds</em> instead.
                </span>
              </div>
            </div>
            <div className="bankroll-edit-fields">
              <label className="bankroll-edit-field">
                <span className="field-label">Current Bankroll</span>
                <input
                  ref={currentInputRef}
                  placeholder="e.g. 4m, 500k, 1000000"
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                />
                {currentInput && parseGp(currentInput) !== null && (
                  <span className="field-preview">
                    = {formatGp(parseGp(currentInput))} GP
                  </span>
                )}
              </label>
              <label className="bankroll-edit-field">
                <span className="field-label">Starting Bankroll</span>
                <input
                  placeholder="e.g. 4m, 500k, 1000000"
                  type="text"
                  value={startingInput}
                  onChange={(e) => setStartingInput(e.target.value)}
                />
                {startingInput && parseGp(startingInput) !== null && (
                  <span className="field-preview">
                    = {formatGp(parseGp(startingInput))} GP
                  </span>
                )}
              </label>
            </div>
            <div className="bankroll-edit-actions">
              <button
                className="button primary small"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                className="button ghost small"
                disabled={isSubmitting}
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
            <p className="bankroll-hint">
              Supports: 4m, 1.5k, 500000, or 2,500,000
            </p>
          </form>
        )}

        {!isEditing && isAddingFunds && (
          <form className="bankroll-add-funds-form" onSubmit={handleAddFunds}>
            <div className="add-funds-info">
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="14"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>
                Adds to your bankroll without affecting ROI calculations.
              </span>
            </div>
            <label className="add-funds-field">
              <span className="field-label">Amount to Add</span>
              <div className="add-funds-input-row">
                <input
                  ref={fundsInputRef}
                  placeholder="e.g. 2m, 500k"
                  type="text"
                  value={fundsInput}
                  onChange={(e) => setFundsInput(e.target.value)}
                />
                <button
                  className="button primary small"
                  disabled={isAdding}
                  type="submit"
                >
                  {isAdding ? 'Adding...' : 'Add Funds'}
                </button>
              </div>
              {fundsInput && parseGp(fundsInput) !== null && (
                <span className="field-preview">
                  = {formatGp(parseGp(fundsInput))} GP
                </span>
              )}
            </label>
          </form>
        )}

        {error && <div className="bankroll-error">{error}</div>}
      </div>
    </div>
  );
}
