'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatGp, parseGp } from '@/lib/trading/ge-service';

interface BankrollData {
  currentBankroll: number;
  initialBankroll: number;
}

interface BankrollCardProps {
  characterId: string;
  bankroll: BankrollData;
  totalProfit?: number;
}

export function BankrollCard({
  characterId,
  bankroll,
  totalProfit = 0,
}: BankrollCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [startingInput, setStartingInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="bankroll-header">
        <h3>Trading Bankroll</h3>
        {!isEditing && (
          <div className="bankroll-actions">
            <button
              className="button ghost small"
              onClick={handleSync}
              disabled={isSyncing}
              title="Recalculate bankroll from trades"
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              className="button ghost small"
              onClick={handleEdit}
            >
              Edit
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
            <div className="bankroll-edit-fields">
              <label className="bankroll-edit-field">
                <span className="field-label">Current Bankroll</span>
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="e.g. 4m, 500k, 1000000"
                  autoFocus
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
                  type="text"
                  value={startingInput}
                  onChange={(e) => setStartingInput(e.target.value)}
                  placeholder="e.g. 4m, 500k, 1000000"
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
                type="submit"
                className="button primary small"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="button ghost small"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
            {error && <div className="bankroll-error">{error}</div>}
            <p className="bankroll-hint">
              Supports: 4m, 1.5k, 500000, or 2,500,000
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
