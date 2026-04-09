'use client';

import { useEffect, useState } from 'react';

type Alert = {
  id: string;
  itemName: string;
  alertType: string;
  title: string;
  message: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AlertsCard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/alerts')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setAlerts(json.data.alerts ?? []);
          setUnreadCount(json.data.unreadCount ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkAllRead() {
    await fetch('/api/ge/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setAlerts([]);
    setUnreadCount(0);
  }

  if (loading) {
    return (
      <div className="tool-card">
        <div className="tool-card-header">
          <div className="tool-card-icon gold">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Price Alerts</div>
          </div>
        </div>
        <div className="tool-card-body">
          <div className="tool-skeleton tool-skeleton-line" />
          <div className="tool-skeleton tool-skeleton-line medium" />
        </div>
      </div>
    );
  }

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="tool-card-icon gold">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Price Alerts</div>
          <div className="tool-card-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            className="button small ghost"
            style={{ marginLeft: 'auto', fontSize: '0.72rem' }}
            type="button"
            onClick={handleMarkAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="tool-card-body">
        {alerts.length === 0 ? (
          <div className="tool-card-empty">
            No unread alerts. Set thresholds on your watch items to get
            notified.
          </div>
        ) : (
          <div className="alert-list">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.alertType}`}>
                <div className="alert-item-content">
                  <div className="alert-item-title">{alert.title}</div>
                  <div className="alert-item-message">{alert.message}</div>
                </div>
                <span className="alert-item-time">
                  {timeAgo(alert.createdAt)}
                </span>
              </div>
            ))}
            {alerts.length > 5 && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  padding: '4px 0',
                }}
              >
                +{alerts.length - 5} more alerts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
