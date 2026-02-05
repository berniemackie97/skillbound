'use client';

import { useState } from 'react';

import { Modal } from '@/components/ui/modal';

import { BankrollCard } from './bankroll-card';
import { TradeForm } from './trade-form';

type BankrollData = {
  currentBankroll: number;
  initialBankroll: number;
};

type TradingMobileActionsProps = {
  characterId: string;
  bankroll: BankrollData;
  totalProfit: number;
  availableBankroll: number;
  scope: 'character' | 'all';
  preselectedItemId?: number;
};

type MobileAction = 'trade' | 'bankroll' | null;

export function TradingMobileActions({
  characterId,
  bankroll,
  totalProfit,
  availableBankroll,
  scope,
  preselectedItemId,
}: TradingMobileActionsProps) {
  const [activeAction, setActiveAction] = useState<MobileAction>(null);

  return (
    <div className="tracker-card mobile-actions-card">
      <div className="tracker-card-header">
        <div className="card-title-stack">
          <h3>Quick actions</h3>
          <span className="card-subtitle">
            Record trades or manage your trading bankroll.
          </span>
        </div>
        {scope === 'all' && (
          <span className="card-badge">Using active character</span>
        )}
      </div>
      <div className="mobile-actions">
        <button
          className="button"
          type="button"
          onClick={() => setActiveAction('trade')}
        >
          Record trade
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={() => setActiveAction('bankroll')}
        >
          Trading bankroll
        </button>
      </div>

      <Modal
        isOpen={activeAction === 'trade'}
        size="lg"
        title="Record trade"
        subtitle={
          scope === 'all'
            ? 'Trades will be recorded against your active character.'
            : 'Log a buy or sell trade for your selected character.'
        }
        onClose={() => setActiveAction(null)}
      >
        <TradeForm
          availableBankroll={availableBankroll}
          characterId={characterId}
          {...(preselectedItemId !== undefined && { preselectedItemId })}
          onSuccess={() => setActiveAction(null)}
        />
      </Modal>

      <Modal
        isOpen={activeAction === 'bankroll'}
        size="lg"
        subtitle="Edit, sync, or add funds to keep your trade budget accurate."
        title="Trading bankroll"
        onClose={() => setActiveAction(null)}
      >
        <BankrollCard
          hideTitle
          bankroll={bankroll}
          characterId={characterId}
          totalProfit={totalProfit}
        />
      </Modal>
    </div>
  );
}
