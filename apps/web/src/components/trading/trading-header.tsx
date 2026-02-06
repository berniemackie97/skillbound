import Link from 'next/link';

type TradingHeaderProps = {
  activeTab: 'exchange' | 'tracker';
  showLoginBadge?: boolean;
};

export function TradingHeader({
  activeTab,
  showLoginBadge = false,
}: TradingHeaderProps) {
  return (
    <section className="page-header trading-header">
      <div className="header-content">
        <h1>GE Exchange</h1>
        <p className="subtitle">
          Live Grand Exchange prices powered by RuneLite crowdsourced data
        </p>
      </div>

      <nav aria-label="Trading sections" className="trading-tabs">
        <Link
          aria-current={activeTab === 'exchange' ? 'page' : undefined}
          className={`tab-btn ${activeTab === 'exchange' ? 'active' : ''}`}
          href="/trading"
        >
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M3 3h18v18H3z" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          GE Exchange
        </Link>

        <Link
          aria-current={activeTab === 'tracker' ? 'page' : undefined}
          className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
          href="/trading/tracker"
        >
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          My Trades
          {showLoginBadge && <span className="login-badge">Login</span>}
        </Link>
      </nav>
    </section>
  );
}
