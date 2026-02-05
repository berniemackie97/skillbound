'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Modal } from '@/components/ui/modal';

type Trade = {
  id: string;
  characterId: string;
  characterName?: string | null;
  itemId: number;
  itemName: string;
  tradeType: 'buy' | 'sell';
  quantity: number;
  pricePerItem: number;
  totalValue: number;
  tradedAt: string;
  profitPerItem: number | null;
  totalProfit: number | null;
  notes: string | null;
};

type TradeListProps = {
  characterId: string;
  trades: Trade[];
  total: number;
  currentPage: number;
  pageSize: number;
};

type ModalMode = 'view' | 'edit';

interface DeleteImpact {
  trade: {
    id: string;
    itemName: string;
    tradeType: 'buy' | 'sell';
    quantity: number;
    totalValue: number;
  };
  affectedSells: Array<{
    id: string;
    quantity: number;
    tradedAt: string;
    totalValue: number;
  }>;
  matchedBuy: {
    id: string;
    quantity: number;
    tradedAt: string;
  } | null;
  warningMessage: string | null;
}

function formatGp(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}b`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateForInput(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().slice(0, 16);
}

interface TradeDetailViewProps {
  trade: Trade;
  characterId: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function TradeDetailView({
  trade,
  characterId,
  onEdit,
  onDelete,
  isDeleting,
}: TradeDetailViewProps) {
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch delete impact when user clicks delete for buys
  async function handleDeleteClick() {
    if (trade.tradeType === 'buy') {
      setLoadingImpact(true);
      try {
        const response = await fetch(
          `/api/characters/${trade.characterId || characterId}/trades/${trade.id}?includeDeleteImpact=true`
        );
        if (response.ok) {
          const data = await response.json();
          setDeleteImpact(data.deleteImpact);
        }
      } catch {
        // If we can't fetch impact, proceed anyway
      } finally {
        setLoadingImpact(false);
      }
      setShowDeleteConfirm(true);
    } else {
      // For sells, just confirm directly
      setShowDeleteConfirm(true);
    }
  }

  function handleConfirmDelete() {
    onDelete();
  }

  function handleCancelDelete() {
    setShowDeleteConfirm(false);
    setDeleteImpact(null);
  }

  if (showDeleteConfirm) {
    return (
      <div className="trade-delete-confirm">
        <div className="delete-confirm-icon">⚠️</div>
        <h3>Delete this trade?</h3>

        <div className="delete-confirm-trade">
          <span className={`trade-type-badge ${trade.tradeType}`}>
            {trade.tradeType.toUpperCase()}
          </span>
          <span className="trade-item-name">{trade.itemName}</span>
          <span className="trade-qty">×{trade.quantity.toLocaleString()}</span>
        </div>

        {deleteImpact?.warningMessage && (
          <div className="delete-warning">
            <strong>Warning:</strong> {deleteImpact.warningMessage}
          </div>
        )}

        {deleteImpact?.affectedSells &&
          deleteImpact.affectedSells.length > 0 && (
            <div className="affected-trades">
              <p className="affected-label">Sells that will be affected:</p>
              <ul>
                {deleteImpact.affectedSells.slice(0, 5).map((sell) => (
                  <li key={sell.id}>
                    {formatDate(sell.tradedAt)} —{' '}
                    {sell.quantity.toLocaleString()} items (
                    {formatGp(sell.totalValue)} GP)
                  </li>
                ))}
                {deleteImpact.affectedSells.length > 5 && (
                  <li className="more">
                    +{deleteImpact.affectedSells.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

        <div className="delete-confirm-actions">
          <button
            className="button ghost"
            disabled={isDeleting}
            type="button"
            onClick={handleCancelDelete}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={isDeleting || loadingImpact}
            type="button"
            onClick={handleConfirmDelete}
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trade-detail-view">
      <div className="trade-detail-header">
        <span className={`trade-type-badge large ${trade.tradeType}`}>
          {trade.tradeType.toUpperCase()}
        </span>
        <span className="trade-detail-item-name">{trade.itemName}</span>
      </div>

      <div className="trade-detail-grid">
        <div className="trade-detail-row">
          <span className="label">Quantity</span>
          <span className="value">{trade.quantity.toLocaleString()}</span>
        </div>
        <div className="trade-detail-row">
          <span className="label">Price per Item</span>
          <span className="value">{formatGp(trade.pricePerItem)} GP</span>
        </div>
        <div className="trade-detail-row highlight">
          <span className="label">Total Value</span>
          <span
            className={`value ${trade.tradeType === 'buy' ? 'cost' : 'revenue'}`}
          >
            {formatGp(trade.totalValue)} GP
          </span>
        </div>
        {trade.tradeType === 'sell' && (
          <div className="trade-detail-row highlight">
            <span className="label">Profit</span>
            <span
              className={`value ${
                trade.totalProfit !== null
                  ? trade.totalProfit >= 0
                    ? 'profit-positive'
                    : 'profit-negative'
                  : 'profit-none'
              }`}
            >
              {trade.totalProfit !== null
                ? `${trade.totalProfit >= 0 ? '+' : ''}${formatGp(trade.totalProfit)} GP`
                : 'No matching buy'}
            </span>
          </div>
        )}
        <div className="trade-detail-row">
          <span className="label">Date & Time</span>
          <span className="value">
            {formatDate(trade.tradedAt)} at {formatTime(trade.tradedAt)}
          </span>
        </div>
        {trade.characterName && (
          <div className="trade-detail-row">
            <span className="label">Character</span>
            <span className="value">{trade.characterName}</span>
          </div>
        )}
        {trade.notes && (
          <div className="trade-detail-row notes">
            <span className="label">Notes</span>
            <span className="value">{trade.notes}</span>
          </div>
        )}
      </div>

      <div className="trade-detail-actions">
        <button
          className="button danger-outline"
          disabled={isDeleting || loadingImpact}
          type="button"
          onClick={handleDeleteClick}
        >
          {loadingImpact ? 'Loading...' : 'Delete Trade'}
        </button>
        <button className="button primary" type="button" onClick={onEdit}>
          Edit Trade
        </button>
      </div>
    </div>
  );
}

interface EditFormProps {
  trade: Trade;
  characterId: string;
  onSave: () => void;
  onCancel: () => void;
}

function EditTradeForm({
  trade,
  characterId,
  onSave,
  onCancel,
}: EditFormProps) {
  const [quantity, setQuantity] = useState(String(trade.quantity));
  const [pricePerItem, setPricePerItem] = useState(String(trade.pricePerItem));
  const [tradedAt, setTradedAt] = useState(formatDateForInput(trade.tradedAt));
  const [notes, setNotes] = useState(trade.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsedQuantity = parseInt(quantity, 10);
    const parsedPrice = parseInt(pricePerItem, 10);

    if (!parsedQuantity || parsedQuantity <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/characters/${trade.characterId || characterId}/trades/${trade.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: parsedQuantity,
            pricePerItem: parsedPrice,
            tradedAt: new Date(tradedAt).toISOString(),
            notes: notes.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'Failed to update trade.');
        return;
      }

      onSave();
    } catch {
      setError('Failed to update trade. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const totalValue =
    (parseInt(quantity, 10) || 0) * (parseInt(pricePerItem, 10) || 0);

  return (
    <div className="trade-edit-form">
      <div className="trade-edit-item-info">
        <span className={`trade-type-badge ${trade.tradeType}`}>
          {trade.tradeType.toUpperCase()}
        </span>
        <span className="trade-edit-item-name">{trade.itemName}</span>
      </div>

      <div className="form-row">
        <label className="form-field">
          <span>Quantity</span>
          <input
            required
            min="1"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Price per item (GP)</span>
          <input
            required
            min="0"
            type="number"
            value={pricePerItem}
            onChange={(e) => setPricePerItem(e.target.value)}
          />
        </label>
      </div>

      <div className="trade-edit-total">
        <span>Total Value:</span>
        <strong className={trade.tradeType === 'buy' ? 'cost' : 'revenue'}>
          {formatGp(totalValue)} GP
        </strong>
      </div>

      <label className="form-field">
        <span>Trade Date & Time</span>
        <input
          type="datetime-local"
          value={tradedAt}
          onChange={(e) => setTradedAt(e.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Notes (optional)</span>
        <input
          placeholder="Any notes about this trade..."
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && <div className="error">{error}</div>}

      <div className="trade-edit-actions">
        <button
          className="button ghost"
          disabled={isSaving}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button primary"
          disabled={isSaving}
          type="button"
          onClick={handleSave}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export function TradeList({
  characterId,
  trades,
  total,
  currentPage,
  pageSize,
}: TradeListProps) {
  const router = useRouter();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('view');
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);
  const showCharacter = trades.some((trade) => trade.characterName);

  function handleRowClick(trade: Trade) {
    setSelectedTrade(trade);
    setModalMode('view');
  }

  function handleCloseModal() {
    setSelectedTrade(null);
    setModalMode('view');
  }

  async function handleDelete() {
    if (!selectedTrade) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/characters/${selectedTrade.characterId || characterId}/trades/${selectedTrade.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        handleCloseModal();
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function handlePageChange(newPage: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(newPage));
    router.push(url.toString());
  }

  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <p>No trades recorded yet.</p>
        <p className="text-muted">
          Start by recording your first buy or sell trade above.
        </p>
      </div>
    );
  }

  return (
    <div className="trade-list">
      {/* Desktop Table View */}
      <div className="trade-table-container">
        <table className="trade-table clickable">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-item">Item</th>
              <th className="col-type">Type</th>
              <th className="col-qty">Qty</th>
              <th className="col-price">Price/ea</th>
              <th className="col-total">Total</th>
              <th className="col-profit">Profit</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className={trade.tradeType}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(trade)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(trade);
                  }
                }}
              >
                <td className="col-date">
                  <div className="date-cell">
                    <span className="date-main">
                      {formatDate(trade.tradedAt)}
                    </span>
                    <span className="date-time">
                      {formatTime(trade.tradedAt)}
                    </span>
                  </div>
                </td>
                <td className="col-item">
                  <div className="item-cell">
                    <span className="item-name">{trade.itemName}</span>
                    {showCharacter && trade.characterName && (
                      <span className="item-char">{trade.characterName}</span>
                    )}
                  </div>
                </td>
                <td className="col-type">
                  <span className={`trade-type-badge ${trade.tradeType}`}>
                    {trade.tradeType.toUpperCase()}
                  </span>
                </td>
                <td className="col-qty">{trade.quantity.toLocaleString()}</td>
                <td className="col-price">{formatGp(trade.pricePerItem)}</td>
                <td className="col-total">{formatGp(trade.totalValue)}</td>
                <td className="col-profit">
                  {trade.tradeType === 'sell' && trade.totalProfit !== null ? (
                    <span
                      className={
                        trade.totalProfit >= 0
                          ? 'profit-positive'
                          : 'profit-negative'
                      }
                    >
                      {trade.totalProfit >= 0 ? '+' : ''}
                      {formatGp(trade.totalProfit)}
                    </span>
                  ) : trade.tradeType === 'buy' ? (
                    <span className="profit-pending">—</span>
                  ) : (
                    <span className="profit-none">No match</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="trade-cards">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className={`trade-card ${trade.tradeType}`}
            role="button"
            tabIndex={0}
            onClick={() => handleRowClick(trade)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(trade);
              }
            }}
          >
            <div className="trade-card-header">
              <div className="trade-card-item">
                <span className="item-name">{trade.itemName}</span>
                {showCharacter && trade.characterName && (
                  <span className="item-char">{trade.characterName}</span>
                )}
              </div>
              <span className={`trade-type-badge ${trade.tradeType}`}>
                {trade.tradeType.toUpperCase()}
              </span>
            </div>
            <div className="trade-card-body">
              <div className="trade-card-row">
                <span className="label">Quantity</span>
                <span className="value">{trade.quantity.toLocaleString()}</span>
              </div>
              <div className="trade-card-row">
                <span className="label">Price/ea</span>
                <span className="value">{formatGp(trade.pricePerItem)}</span>
              </div>
              <div className="trade-card-row">
                <span className="label">Total</span>
                <span className="value total">
                  {formatGp(trade.totalValue)}
                </span>
              </div>
              {trade.tradeType === 'sell' && (
                <div className="trade-card-row">
                  <span className="label">Profit</span>
                  <span
                    className={`value ${
                      trade.totalProfit !== null
                        ? trade.totalProfit >= 0
                          ? 'profit-positive'
                          : 'profit-negative'
                        : 'profit-none'
                    }`}
                  >
                    {trade.totalProfit !== null
                      ? `${trade.totalProfit >= 0 ? '+' : ''}${formatGp(trade.totalProfit)}`
                      : 'No match'}
                  </span>
                </div>
              )}
            </div>
            <div className="trade-card-footer">
              <span className="trade-date">
                {formatDate(trade.tradedAt)} at {formatTime(trade.tradedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="button ghost small"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="button ghost small"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Trade Detail/Edit Modal */}
      <Modal
        isOpen={selectedTrade !== null}
        size="md"
        title={modalMode === 'view' ? 'Trade Details' : 'Edit Trade'}
        onClose={handleCloseModal}
      >
        {selectedTrade && modalMode === 'view' && (
          <TradeDetailView
            characterId={characterId}
            isDeleting={isDeleting}
            trade={selectedTrade}
            onDelete={handleDelete}
            onEdit={() => setModalMode('edit')}
          />
        )}
        {selectedTrade && modalMode === 'edit' && (
          <EditTradeForm
            characterId={characterId}
            trade={selectedTrade}
            onCancel={() => setModalMode('view')}
            onSave={() => {
              handleCloseModal();
              router.refresh();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
