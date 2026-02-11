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

type Mode = 'view' | 'edit' | 'add-funds';

export function BankrollCard({
  characterId,
  bankroll,
  totalProfit = 0,
  hideTitle = false,
}: BankrollCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('view');
  const [currentInput, setCurrentInput] = useState('');
  const [startingInput, setStartingInput] = useState('');
  const [fundsInput, setFundsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);
  const fundsInputRef = useRef<HTMLInputElement>(null);

  // Listen for bankroll changes from other tabs via localStorage storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== 'bankroll-updated') return;
      router.refresh();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  // Focus appropriate input when switching modes
  useEffect(() => {
    if (mode === 'edit') {
      currentInputRef.current?.focus();
    } else if (mode === 'add-funds') {
      fundsInputRef.current?.focus();
    }
  }, [mode]);

  // Derived values
  const roi =
    bankroll.initialBankroll > 0
      ? (totalProfit / bankroll.initialBankroll) * 100
      : 0;

  const hasBankroll =
    bankroll.currentBankroll > 0 || bankroll.initialBankroll > 0;

  // --- Handlers ---

  function openEdit() {
    setCurrentInput(
      bankroll.currentBankroll > 0 ? String(bankroll.currentBankroll) : ''
    );
    setStartingInput(
      bankroll.initialBankroll > 0 ? String(bankroll.initialBankroll) : ''
    );
    setError(null);
    setMode('edit');
  }

  function openAddFunds() {
    setFundsInput('');
    setError(null);
    setMode('add-funds');
  }

  function cancel() {
    setMode('view');
    setError(null);
  }

  /** Notify other tabs that bankroll changed */
  function notifyOtherTabs() {
    localStorage.setItem('bankroll-updated', String(Date.now()));
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let currentValue = parseGp(currentInput);
    let startingValue = parseGp(startingInput);

    // Allow empty fields — treat them as unchanged from existing value OR 0
    if (currentInput.trim() === '') currentValue = bankroll.currentBankroll;
    if (startingInput.trim() === '') startingValue = bankroll.initialBankroll;

    if (currentValue === null) {
      setError('Invalid current bankroll. Try: 4m, 500k, or 1000000');
      return;
    }
    if (startingValue === null) {
      setError('Invalid starting bankroll. Try: 4m, 500k, or 1000000');
      return;
    }

    // First-time setup sync:
    // If user set starting but left current at 0 → match current to starting
    if (currentValue === 0 && startingValue > 0) {
      currentValue = startingValue;
    }
    // If user set current but left starting at 0 → match starting to current
    if (startingValue === 0 && currentValue > 0) {
      startingValue = currentValue;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/bankroll`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentBankroll: currentValue,
            initialBankroll: startingValue,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update bankroll');
      }

      setMode('view');
      notifyOtherTabs();
      router.refresh();
    } catch {
      setError('Failed to update bankroll. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddFundsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const deltaValue = parseGp(fundsInput);
    if (deltaValue === null || deltaValue <= 0) {
      setError('Enter a positive amount. Try: 2m, 500k, etc.');
      return;
    }

    setIsSubmitting(true);
    try {
      // If starting bankroll is 0, this is first-time setup:
      // set both starting and current to the added amount
      if (bankroll.initialBankroll === 0 && bankroll.currentBankroll === 0) {
        const response = await fetch(
          `/api/characters/${characterId}/bankroll`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentBankroll: deltaValue,
              initialBankroll: deltaValue,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to set bankroll');
      } else if (bankroll.initialBankroll === 0) {
        // Starting is 0 but current has a value — also set starting
        const response = await fetch(
          `/api/characters/${characterId}/bankroll`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentBankroll: bankroll.currentBankroll + deltaValue,
              initialBankroll: bankroll.currentBankroll + deltaValue,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to set bankroll');
      } else {
        // Normal add funds: only adjust current via PATCH
        const response = await fetch(
          `/api/characters/${characterId}/bankroll`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta: deltaValue }),
          }
        );
        if (!response.ok) throw new Error('Failed to add funds');
      }

      setMode('view');
      notifyOtherTabs();
      router.refresh();
    } catch {
      setError('Failed to add funds. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Render ---

  return (
    <div className="bankroll-card">
      {/* Header */}
      <div className={`bankroll-header ${hideTitle ? 'no-title' : ''}`}>
        {!hideTitle && <h3>Trading Bankroll</h3>}
        {mode === 'view' && (
          <div className="bankroll-actions">
            <button
              className="button ghost small"
              type="button"
              onClick={openEdit}
            >
              {hasBankroll ? 'Edit' : 'Set Up'}
            </button>
            {hasBankroll && (
              <button
                className="button ghost small"
                type="button"
                onClick={openAddFunds}
              >
                Add Funds
              </button>
            )}
          </div>
        )}
        {mode !== 'view' && (
          <button
            className="button ghost small"
            type="button"
            onClick={cancel}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bankroll-content">
        {mode === 'view' && (
          <>
            {hasBankroll ? (
              <div className="bankroll-stats">
                <div className="bankroll-stat bankroll-stat--primary">
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
              <div className="bankroll-empty">
                <p className="bankroll-empty__text">
                  No bankroll set. Click <strong>Set Up</strong> above to get
                  started with trade tracking.
                </p>
              </div>
            )}
          </>
        )}

        {mode === 'edit' && (
          <form className="bankroll-edit-form" onSubmit={handleEditSubmit}>
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
                    = {formatGp(parseGp(currentInput)!)} GP
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
                    = {formatGp(parseGp(startingInput)!)} GP
                  </span>
                )}
              </label>
            </div>

            <p className="bankroll-hint">
              Leave a field empty to keep its current value. If one is 0 and
              the other is set, both will match automatically.
            </p>

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
                onClick={cancel}
              >
                Cancel
              </button>
            </div>

            <p className="bankroll-hint">
              Supports: 4m, 1.5k, 500000, or 2,500,000
            </p>
          </form>
        )}

        {mode === 'add-funds' && (
          <form
            className="bankroll-add-funds-inline"
            onSubmit={handleAddFundsSubmit}
          >
            <div className="add-funds-info-inline">
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
                {bankroll.initialBankroll === 0
                  ? 'This will set your starting bankroll too since none is configured yet.'
                  : 'Adds to your current bankroll without affecting ROI calculations.'}
              </span>
            </div>

            <label className="bankroll-edit-field">
              <span className="field-label">Amount to Add</span>
              <div className="bankroll-add-funds-row">
                <input
                  ref={fundsInputRef}
                  placeholder="e.g. 2m, 500k"
                  type="text"
                  value={fundsInput}
                  onChange={(e) => setFundsInput(e.target.value)}
                />
                <button
                  className="button primary small"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
              {fundsInput && parseGp(fundsInput) !== null && (
                <span className="field-preview">
                  = {formatGp(parseGp(fundsInput)!)} GP
                </span>
              )}
            </label>

            <button
              className="button ghost small"
              disabled={isSubmitting}
              type="button"
              onClick={cancel}
            >
              Cancel
            </button>
          </form>
        )}

        {error && <div className="bankroll-error">{error}</div>}
      </div>
    </div>
  );
}
