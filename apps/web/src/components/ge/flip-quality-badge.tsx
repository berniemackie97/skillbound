'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Modal } from '@/components/ui/modal';
import {
  FLAG_DESCRIPTIONS,
  GRADE_DESCRIPTIONS,
  type FlipQualityFlag,
  type FlipQualityGrade,
  type FlipQualityScore,
} from '@/lib/trading/flip-scoring';

// ---------------------------------------------------------------------------
// Grade colors
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<FlipQualityGrade, string> = {
  A: 'var(--flip-grade-a, #22c55e)',
  B: 'var(--flip-grade-b, #14b8a6)',
  C: 'var(--flip-grade-c, #eab308)',
  D: 'var(--flip-grade-d, #f97316)',
  F: 'var(--flip-grade-f, #ef4444)',
};

const GRADE_COLORS_SOLID: Record<FlipQualityGrade, string> = {
  A: '#22c55e',
  B: '#14b8a6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

// ---------------------------------------------------------------------------
// Grouped categories — aggregate 9 sub-scores into 3 readable groups
// ---------------------------------------------------------------------------

interface QualityGroup {
  label: string;
  score: number;
  description: string;
}

function computeGroups(
  breakdown: FlipQualityScore['breakdown']
): QualityGroup[] {
  // Market Health: liquidity + staleness + volumeAdequacy + buyPressure
  const marketHealth = Math.round(
    breakdown.liquidity * 0.3 +
      breakdown.staleness * 0.2 +
      breakdown.volumeAdequacy * 0.2 +
      breakdown.buyPressure * 0.3
  );

  // Price Reliability: marginStability + priceConsistency + taxEfficiency
  const priceReliability = Math.round(
    breakdown.marginStability * 0.35 +
      breakdown.priceConsistency * 0.4 +
      breakdown.taxEfficiency * 0.25
  );

  // Trust Score: volumeAnomaly + historicalReliability
  const trustScore = Math.round(
    breakdown.volumeAnomaly * 0.45 + breakdown.historicalReliability * 0.55
  );

  return [
    {
      label: 'Market Health',
      score: marketHealth,
      description: 'Liquidity, freshness & demand',
    },
    {
      label: 'Price Reliability',
      score: priceReliability,
      description: 'Margins, consistency & tax impact',
    },
    {
      label: 'Trust Score',
      score: trustScore,
      description: 'Pattern analysis & historical data',
    },
  ];
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--flip-bar-good, #22c55e)';
  if (score >= 40) return 'var(--flip-bar-ok, #eab308)';
  return 'var(--flip-bar-bad, #ef4444)';
}

// ---------------------------------------------------------------------------
// Flag icons
// ---------------------------------------------------------------------------

const FLAG_ICONS: Record<FlipQualityFlag, string> = {
  'stale-prices': '\u23F0',
  'low-volume': '\uD83D\uDCC9',
  'unstable-margin': '\u26A1',
  'high-tax-impact': '\uD83D\uDCB8',
  'unprofitable-after-tax': '\uD83D\uDEAB',
  'near-alch-floor': '\u2697\uFE0F',
  'thin-market': '\uD83C\uDFDC\uFE0F',
  'volume-spike': '\uD83D\uDCCA',
  'price-divergence': '\u2195\uFE0F',
  'potential-manipulation': '\u26A0\uFE0F',
  'historically-unusual': '\uD83D\uDCDC',
};

// ---------------------------------------------------------------------------
// Touch detection hook
// ---------------------------------------------------------------------------

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isTouch;
}

// ---------------------------------------------------------------------------
// Quality breakdown content (shared between tooltip and modal)
// ---------------------------------------------------------------------------

function QualityBreakdownContent({
  quality,
  gradeColor,
}: {
  quality: FlipQualityScore;
  gradeColor: string;
}) {
  const groups = computeGroups(quality.breakdown);

  return (
    <>
      <div className="quality-tooltip__header">
        <span className="quality-tooltip__grade" style={{ color: gradeColor }}>
          {quality.grade}
        </span>
        <span className="quality-tooltip__score">{quality.score}/100</span>
        <span className="quality-tooltip__desc-inline">
          {GRADE_DESCRIPTIONS[quality.grade]}
        </span>
      </div>

      <div className="quality-tooltip__groups">
        {groups.map((group) => (
          <div key={group.label} className="quality-tooltip__group">
            <div className="quality-tooltip__group-header">
              <span className="quality-tooltip__group-label">
                {group.label}
              </span>
              <span
                className="quality-tooltip__group-score"
                style={{ color: scoreColor(group.score) }}
              >
                {group.score}
              </span>
            </div>
            <div className="quality-tooltip__bar-track">
              <div
                className="quality-tooltip__bar-fill"
                style={{
                  width: `${group.score}%`,
                  backgroundColor: scoreColor(group.score),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {quality.flags.length > 0 && (
        <div className="quality-tooltip__flags">
          {quality.flags.map((flag) => (
            <div key={flag} className="quality-tooltip__flag">
              <span className="quality-tooltip__flag-icon">
                {FLAG_ICONS[flag]}
              </span>
              <span className="quality-tooltip__flag-text">
                {FLAG_DESCRIPTIONS[flag]}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// FlipQualityBadge
// ---------------------------------------------------------------------------

interface FlipQualityBadgeProps {
  quality: FlipQualityScore;
  compact?: boolean;
}

export function FlipQualityBadge({
  quality,
  compact = false,
}: FlipQualityBadgeProps) {
  const gradeColor = GRADE_COLORS[quality.grade];
  const solidColor = GRADE_COLORS_SOLID[quality.grade];
  const badgeRef = useRef<HTMLSpanElement>(null);
  const isTouch = useIsTouchDevice();

  // -- Desktop: hover tooltip --
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);

  // -- Touch: modal --
  const [isModalOpen, setIsModalOpen] = useState(false);

  const computePosition = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipWidth = 260;
    const tooltipHeight = 240;
    const pad = 8;

    let placement: 'above' | 'below' = 'above';
    let top = rect.top - tooltipHeight - pad;

    if (top < pad) {
      placement = 'below';
      top = rect.bottom + pad;
    }

    if (top + tooltipHeight > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - tooltipHeight - pad);
    }

    let left = rect.right - tooltipWidth;
    if (left < pad) {
      left = rect.left;
    }
    if (left + tooltipWidth > window.innerWidth - pad) {
      left = window.innerWidth - tooltipWidth - pad;
    }

    setTooltipPos({ top, left, placement });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isTouch) return;
    setIsHovered(true);
    computePosition();
  }, [computePosition, isTouch]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltipPos(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isTouch) return;
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
    },
    [isTouch]
  );

  // Recompute position on scroll while hovered
  useEffect(() => {
    if (!isHovered) return;
    const handleScroll = () => computePosition();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isHovered, computePosition]);

  return (
    <>
      <span
        ref={badgeRef}
        className={`flip-quality-badge ${compact ? 'flip-quality-badge--compact' : ''}`}
        style={{ '--grade-color': gradeColor } as React.CSSProperties}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="flip-quality-badge__grade">{quality.grade}</span>
      </span>

      {/* Desktop: portal tooltip on hover */}
      {isHovered &&
        tooltipPos &&
        createPortal(
          <div
            className="quality-tooltip quality-tooltip--portal"
            role="tooltip"
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              zIndex: 9999,
              opacity: 1,
              visibility: 'visible',
              pointerEvents: 'none',
            }}
          >
            <QualityBreakdownContent
              gradeColor={solidColor}
              quality={quality}
            />
          </div>,
          document.body
        )}

      {/* Touch: modal on tap */}
      <Modal
        isOpen={isModalOpen}
        size="sm"
        title="Flip Quality"
        onClose={() => setIsModalOpen(false)}
      >
        <div className="quality-modal-content">
          <QualityBreakdownContent gradeColor={solidColor} quality={quality} />
        </div>
      </Modal>
    </>
  );
}
