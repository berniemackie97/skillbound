interface ExchangeTopbarProps {
  searchFilter: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ExchangeTopbar({
  searchFilter,
  onSearchChange,
  onSearchSubmit,
  currentPage,
  totalPages,
  onPageChange,
}: ExchangeTopbarProps) {
  return (
    <div className="exchange-topbar">
      <div className="table-search topbar-search">
        <svg
          className="search-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="table-search-input"
          placeholder="Search items..."
          type="text"
          value={searchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
        />
      </div>
      <div className="top-pagination">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const pageNum = i + 1;
          return (
            <button
              key={pageNum}
              className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
        {totalPages > 5 && (
          <>
            <span className="page-ellipsis">...</span>
            <span className="page-total">{totalPages}</span>
          </>
        )}
        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
