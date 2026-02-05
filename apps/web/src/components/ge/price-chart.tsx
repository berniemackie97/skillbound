'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatGp,
  getItemIconUrl,
  type ChartPeriod,
} from '@/lib/trading/ge-service';

interface PricePoint {
  timestamp: string;
  buyPrice: number | null;
  sellPrice: number | null;
  volume: number | null;
}

interface TimeseriesResponse {
  data?: {
    timeseries?: {
      points?: PricePoint[];
    };
  };
}

export interface PriceChartProps {
  itemId: number;
  itemName: string;
  itemIcon: string;
  initialPeriod?: ChartPeriod;
  showVolume?: boolean;
  /** Hide the item name/icon header (useful when embedded in a row that already shows the item) */
  compact?: boolean;
}

interface HoverData {
  point: PricePoint;
  index: number;
  x: number;
  y: number;
}

const PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
];

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatVolume = (vol: number): string => {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString();
};

export function PriceChart({
  itemId,
  itemName,
  itemIcon,
  initialPeriod = 'live',
  showVolume = true,
  compact = false,
}: PriceChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod);
  const [data, setData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const priceChartRef = useRef<SVGSVGElement>(null);

  // Fetch timeseries data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/ge/items/${itemId}?includeTimeseries=true&period=${period}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch price data');
      }
      const json = (await response.json()) as TimeseriesResponse;
      setData(json.data?.timeseries?.points ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [itemId, period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Calculate chart dimensions
  const chartWidth = 900;
  const chartHeight = 320;
  const volumeHeight = 100;
  const padding = { top: 24, right: 70, bottom: 36, left: 70 };

  // Get min/max values for scaling
  const priceData = data.filter(
    (p) => p.buyPrice !== null || p.sellPrice !== null
  );
  const volumeData = data.filter((p) => p.volume !== null && p.volume > 0);

  const minPrice = Math.min(
    ...priceData.map((p) =>
      Math.min(p.buyPrice ?? Infinity, p.sellPrice ?? Infinity)
    )
  );
  const maxPrice = Math.max(
    ...priceData.map((p) =>
      Math.max(p.buyPrice ?? -Infinity, p.sellPrice ?? -Infinity)
    )
  );
  const maxVolume = Math.max(...volumeData.map((p) => p.volume ?? 0));
  const totalVolume = volumeData.reduce((sum, p) => sum + (p.volume ?? 0), 0);

  // Calculate stats
  const latestPoint = data[data.length - 1];
  const firstPoint = data[0];
  const priceChange =
    latestPoint && firstPoint && latestPoint.buyPrice && firstPoint.buyPrice
      ? latestPoint.buyPrice - firstPoint.buyPrice
      : 0;
  const priceChangePercent =
    firstPoint?.buyPrice && priceChange
      ? (priceChange / firstPoint.buyPrice) * 100
      : 0;

  // Scale functions
  const priceRange = maxPrice - minPrice || 1;
  const pricePadding = priceRange * 0.1;

  const scaleX = (index: number) =>
    padding.left +
    (index / (data.length - 1 || 1)) *
      (chartWidth - padding.left - padding.right);

  const scaleY = (price: number) =>
    padding.top +
    ((maxPrice + pricePadding - price) / (priceRange + pricePadding * 2)) *
      (chartHeight - padding.top - padding.bottom);

  const scaleVolumeY = (volume: number) =>
    volumeHeight - 20 - (volume / (maxVolume || 1)) * (volumeHeight - 40);

  // Generate smooth path data
  const generatePath = (accessor: (p: PricePoint) => number | null): string => {
    let path = '';
    let started = false;
    data.forEach((point, i) => {
      const value = accessor(point);
      if (value !== null) {
        const x = scaleX(i);
        const y = scaleY(value);
        if (!started) {
          path += `M ${x} ${y}`;
          started = true;
        } else {
          path += ` L ${x} ${y}`;
        }
      }
    });
    return path;
  };

  // Generate area path for gradient fill
  const generateAreaPath = (
    accessor: (p: PricePoint) => number | null
  ): string => {
    const linePath = generatePath(accessor);
    if (!linePath) return '';

    const validPoints = data
      .map((p, i) => ({ value: accessor(p), index: i }))
      .filter((p) => p.value !== null);

    if (validPoints.length < 2) return '';

    const firstIndex = validPoints[0]!.index;
    const lastIndex = validPoints[validPoints.length - 1]!.index;
    const bottomY = chartHeight - padding.bottom;

    return `${linePath} L ${scaleX(lastIndex)} ${bottomY} L ${scaleX(firstIndex)} ${bottomY} Z`;
  };

  const buyPath = generatePath((p) => p.buyPrice);
  const sellPath = generatePath((p) => p.sellPrice);
  const buyAreaPath = generateAreaPath((p) => p.buyPrice);
  const sellAreaPath = generateAreaPath((p) => p.sellPrice);

  // Format time label
  const formatTimeLabel = (timestamp: string): string => {
    const date = new Date(timestamp);
    switch (period) {
      case 'live':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      case '1w':
      case '1m':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      default:
        return date.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
    }
  };

  // Format full timestamp for tooltip
  const formatFullTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Generate Y-axis labels
  const yAxisLabels = [];
  const numLabels = 5;
  for (let i = 0; i < numLabels; i++) {
    const price =
      minPrice -
      pricePadding +
      ((priceRange + pricePadding * 2) * i) / (numLabels - 1);
    yAxisLabels.push({
      price: maxPrice + pricePadding - (price - (minPrice - pricePadding)),
      y:
        padding.top +
        ((chartHeight - padding.top - padding.bottom) * i) / (numLabels - 1),
    });
  }

  // Generate X-axis labels
  const xAxisLabels = [];
  const numXLabels = Math.min(8, data.length);
  for (let i = 0; i < numXLabels; i++) {
    const index = Math.floor((i / (numXLabels - 1 || 1)) * (data.length - 1));
    const point = data[index];
    if (point) {
      xAxisLabels.push({
        label: formatTimeLabel(point.timestamp),
        x: scaleX(index),
      });
    }
  }

  // Volume Y-axis labels
  const volumeYLabels = [
    { value: maxVolume, y: 20 },
    { value: maxVolume / 2, y: (volumeHeight - 20) / 2 + 10 },
    { value: 0, y: volumeHeight - 20 },
  ];

  // Mouse handling
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!priceChartRef.current || data.length === 0) return;

      const svg = priceChartRef.current;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * chartWidth;

      // Find nearest data point
      const chartArea = chartWidth - padding.left - padding.right;
      const relativeX = x - padding.left;
      const index = Math.round((relativeX / chartArea) * (data.length - 1));
      const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
      const point = data[clampedIndex];

      if (point) {
        const pointX = scaleX(clampedIndex);
        const pointY = point.buyPrice
          ? scaleY(point.buyPrice)
          : chartHeight / 2;
        setHoverData({ point, index: clampedIndex, x: pointX, y: pointY });
      }
    },
    [data, chartWidth, padding, scaleX, scaleY, chartHeight]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverData(null);
  }, []);

  return (
    <div className={`price-chart ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="chart-header">
        {!compact && (
          <div className="chart-item-info">
            <img
              alt=""
              className="item-icon"
              height={32}
              src={getItemIconUrl(itemIcon)}
              width={32}
            />
            <div className="item-details">
              <span className="item-name">{itemName}</span>
              {latestPoint?.buyPrice && (
                <span className="current-price">
                  {formatGp(latestPoint.buyPrice)} gp
                </span>
              )}
            </div>
          </div>
        )}

        <div className="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`period-btn ${period === p.value ? 'active' : ''}`}
              type="button"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="chart-stats">
            <div
              className={`stat-change ${priceChange >= 0 ? 'positive' : 'negative'}`}
            >
              <span className="change-icon">
                {priceChange >= 0 ? '▲' : '▼'}
              </span>
              <span className="change-value">
                {formatGp(Math.abs(priceChange))}
              </span>
              <span className="change-percent">
                ({priceChangePercent >= 0 ? '+' : ''}
                {priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {!isLoading && !error && data.length > 0 && (
        <div className="chart-stats-bar">
          <div className="stat-item">
            <span className="stat-label">High</span>
            <span className="stat-value">{formatGp(maxPrice)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Low</span>
            <span className="stat-value">{formatGp(minPrice)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Spread</span>
            <span className="stat-value">{formatGp(maxPrice - minPrice)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{formatVolume(totalVolume)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Data Points</span>
            <span className="stat-value">{data.length}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="chart-loading">
          <span className="loading-spinner" />
          Loading chart data...
        </div>
      )}

      {error && <div className="chart-error">Error: {error}</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="chart-empty">
          No price data available for this period
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <div className="chart-body">
          {/* Price Chart */}
          <div className="chart-container">
            <svg
              ref={priceChartRef}
              className="price-svg"
              preserveAspectRatio="xMidYMid meet"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
            >
              <defs>
                {/* Gradient fills */}
                <linearGradient
                  id="buyGradient"
                  x1="0%"
                  x2="0%"
                  y1="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--color-success)"
                    stopOpacity="0.3"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-success)"
                    stopOpacity="0.02"
                  />
                </linearGradient>
                <linearGradient
                  id="sellGradient"
                  x1="0%"
                  x2="0%"
                  y1="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--color-error)"
                    stopOpacity="0.2"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-error)"
                    stopOpacity="0.02"
                  />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <g className="grid-lines">
                {yAxisLabels.map((label, i) => (
                  <line
                    key={i}
                    opacity="0.4"
                    stroke="var(--border)"
                    strokeDasharray="2,4"
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={label.y}
                    y2={label.y}
                  />
                ))}
                {xAxisLabels.map((label, i) => (
                  <line
                    key={i}
                    opacity="0.2"
                    stroke="var(--border)"
                    strokeDasharray="2,4"
                    x1={label.x}
                    x2={label.x}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                  />
                ))}
              </g>

              {/* Area fills */}
              <path
                className="buy-area"
                d={buyAreaPath}
                fill="url(#buyGradient)"
              />
              <path
                className="sell-area"
                d={sellAreaPath}
                fill="url(#sellGradient)"
              />

              {/* Price lines */}
              <path
                className="buy-line"
                d={buyPath}
                fill="none"
                stroke="var(--color-success)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <path
                className="sell-line"
                d={sellPath}
                fill="none"
                stroke="var(--color-error)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />

              {/* Y-axis labels */}
              <g className="y-axis">
                {yAxisLabels.map((label, i) => (
                  <text
                    key={i}
                    fill="var(--text-muted)"
                    fontSize="11"
                    fontWeight="500"
                    textAnchor="end"
                    x={padding.left - 12}
                    y={label.y + 4}
                  >
                    {formatNumber(label.price)}
                  </text>
                ))}
              </g>

              {/* X-axis labels */}
              <g className="x-axis">
                {xAxisLabels.map((label, i) => (
                  <text
                    key={i}
                    fill="var(--text-muted)"
                    fontSize="11"
                    fontWeight="500"
                    textAnchor="middle"
                    x={label.x}
                    y={chartHeight - 10}
                  >
                    {label.label}
                  </text>
                ))}
              </g>

              {/* Crosshair and hover indicator */}
              {hoverData && (
                <g className="hover-elements">
                  {/* Vertical line */}
                  <line
                    opacity="0.7"
                    stroke="var(--accent)"
                    strokeDasharray="4,4"
                    strokeWidth="1"
                    x1={hoverData.x}
                    x2={hoverData.x}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                  />
                  {/* Horizontal line at buy price */}
                  {hoverData.point.buyPrice && (
                    <line
                      opacity="0.5"
                      stroke="var(--color-success)"
                      strokeDasharray="4,4"
                      strokeWidth="1"
                      x1={padding.left}
                      x2={chartWidth - padding.right}
                      y1={scaleY(hoverData.point.buyPrice)}
                      y2={scaleY(hoverData.point.buyPrice)}
                    />
                  )}
                  {/* Data point highlights */}
                  {hoverData.point.buyPrice && (
                    <circle
                      cx={hoverData.x}
                      cy={scaleY(hoverData.point.buyPrice)}
                      fill="var(--color-success)"
                      r="6"
                      stroke="var(--bg)"
                      strokeWidth="2"
                    />
                  )}
                  {hoverData.point.sellPrice && (
                    <circle
                      cx={hoverData.x}
                      cy={scaleY(hoverData.point.sellPrice)}
                      fill="var(--color-error)"
                      r="6"
                      stroke="var(--bg)"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}

              {/* Invisible hover area */}
              <rect
                fill="transparent"
                height={chartHeight - padding.top - padding.bottom}
                width={chartWidth - padding.left - padding.right}
                x={padding.left}
                y={padding.top}
              />
            </svg>

            {/* Tooltip */}
            {hoverData && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(hoverData.x / chartWidth) * 100}%`,
                  top: '10px',
                }}
              >
                <div className="tooltip-time">
                  {formatFullTimestamp(hoverData.point.timestamp)}
                </div>
                <div className="tooltip-prices">
                  {hoverData.point.buyPrice !== null && (
                    <div className="tooltip-row buy">
                      <span className="tooltip-label">Buy:</span>
                      <span className="tooltip-value">
                        {formatGp(hoverData.point.buyPrice)} gp
                      </span>
                    </div>
                  )}
                  {hoverData.point.sellPrice !== null && (
                    <div className="tooltip-row sell">
                      <span className="tooltip-label">Sell:</span>
                      <span className="tooltip-value">
                        {formatGp(hoverData.point.sellPrice)} gp
                      </span>
                    </div>
                  )}
                  {hoverData.point.buyPrice !== null &&
                    hoverData.point.sellPrice !== null && (
                      <div className="tooltip-row margin">
                        <span className="tooltip-label">Margin:</span>
                        <span className="tooltip-value">
                          {formatGp(
                            hoverData.point.buyPrice - hoverData.point.sellPrice
                          )}{' '}
                          gp
                        </span>
                      </div>
                    )}
                  {hoverData.point.volume !== null &&
                    hoverData.point.volume > 0 && (
                      <div className="tooltip-row volume">
                        <span className="tooltip-label">Volume:</span>
                        <span className="tooltip-value">
                          {hoverData.point.volume.toLocaleString()}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="chart-legend">
              <span className="legend-item buy">
                <span className="legend-line" />
                Buy Price
              </span>
              <span className="legend-item sell">
                <span className="legend-line" />
                Sell Price
              </span>
            </div>
          </div>

          {/* Volume chart */}
          {showVolume && volumeData.length > 0 && (
            <div className="volume-chart-container">
              <div className="volume-header">
                <span className="volume-title">Volume</span>
                <span className="volume-total">
                  Total: {formatVolume(totalVolume)}
                </span>
              </div>
              <svg
                className="volume-svg"
                preserveAspectRatio="xMidYMid meet"
                viewBox={`0 0 ${chartWidth} ${volumeHeight}`}
              >
                {/* Volume Y-axis grid */}
                {volumeYLabels.map((label, i) => (
                  <g key={i}>
                    <line
                      opacity="0.3"
                      stroke="var(--border)"
                      strokeDasharray="2,4"
                      x1={padding.left}
                      x2={chartWidth - padding.right}
                      y1={label.y}
                      y2={label.y}
                    />
                    <text
                      fill="var(--text-muted)"
                      fontSize="10"
                      textAnchor="end"
                      x={padding.left - 12}
                      y={label.y + 4}
                    >
                      {formatVolume(label.value)}
                    </text>
                  </g>
                ))}

                <g className="volume-bars">
                  {data.map((point, i) => {
                    if (point.volume === null || point.volume <= 0) return null;
                    const barWidth = Math.max(
                      3,
                      (chartWidth - padding.left - padding.right) /
                        data.length -
                        2
                    );
                    const x = scaleX(i) - barWidth / 2;
                    const height =
                      volumeHeight - 20 - scaleVolumeY(point.volume);
                    const y = volumeHeight - 20 - height;

                    // Color based on price movement
                    const prevPoint = data[i - 1];
                    const buyPrice = point.buyPrice ?? 0;
                    const prevBuyPrice = prevPoint?.buyPrice ?? buyPrice;
                    const isUp = buyPrice >= prevBuyPrice;
                    const isHovered = hoverData?.index === i;

                    return (
                      <rect
                        key={i}
                        height={height}
                        opacity={isHovered ? 1 : 0.6}
                        rx="1"
                        width={barWidth}
                        x={x}
                        y={y}
                        fill={
                          isUp ? 'var(--color-success)' : 'var(--color-error)'
                        }
                      />
                    );
                  })}
                </g>

                {/* Hover indicator line */}
                {hoverData && (
                  <line
                    opacity="0.7"
                    stroke="var(--accent)"
                    strokeDasharray="4,4"
                    strokeWidth="1"
                    x1={hoverData.x}
                    x2={hoverData.x}
                    y1={10}
                    y2={volumeHeight - 20}
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
