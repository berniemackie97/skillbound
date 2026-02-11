'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  FLAG_DESCRIPTIONS,
  GRADE_DESCRIPTIONS,
  type FlipQualityFlag,
  type FlipQualityGrade,
  type FlipQualityScore,
} from '@/lib/trading/flip-scoring';

import { Modal } from '@/components/ui/modal';

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

// Solid opaque colors for tooltip text
const GRADE_COLORS_SOLID: Record<FlipQualityGrade, string> = {
  A: '#22c55e',
  B: '#14b8a6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

// ---------------------------------------------------------------------------
// Breakdown bar labels
// ---------------------------------------------------------------------------

const BREAKDOWN_LABELS: Record<keyof FlipQualityScore['breakdown'], string> = {
  liquidity: 'Liquidity',
  staleness: 'Freshness',
  marginStability: 'Stability',
  volumeAdequacy: 'Volume',
  buyPressure: 'Buy Pressure',
  taxEfficiency: 'Tax Efficiency',
};

// ---------------------------------------------------------------------------
// Flag icons
// ---------------------------------------------------------------------------

const FLAG_ICONS: Record<FlipQualityFlag, string> = {
  'stale-prices': '⏰',
  'low-volume': '📉',
  'unstable-margin': '⚡',
  'high-tax-impact': '💸',
  'thin-market': '🏜️',
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
  return (
    <>
      <div className="quality-tooltip__header">
        <span
          className="quality-tooltip__grade"
          style={{ color: gradeColor }}
        >
          Grade {quality.grade}
        </span>
        <span className="quality-tooltip__score">
          {quality.score}/100
        </span>
      </div>

      <p className="quality-tooltip__desc">
        {GRADE_DESCRIPTIONS[quality.grade]}
      </p>

      <div className="quality-tooltip__bars">
        {(
          Object.entries(BREAKDOWN_LABELS) as Array<
            [keyof FlipQualityScore['breakdown'], string]
          >
        ).map(([key, label]) => {
          const value = quality.breakdown[key];
          return (
            <div key={key} className="quality-tooltip__bar-row">
              <span className="quality-tooltip__bar-label">
                {label}
              </span>
              <div className="quality-tooltip__bar-track">
                <div
                  className="quality-tooltip__bar-fill"
                  style={{
                    width: `${value}%`,
                    backgroundColor:
                      value >= 70
                        ? 'var(--flip-bar-good, #22c55e)'
                        : value >= 40
                          ? 'var(--flip-bar-ok, #eab308)'
                          : 'var(--flip-bar-bad, #ef4444)',
                  }}
                />
              </div>
              <span className="quality-tooltip__bar-value">
                {value}
              </span>
            </div>
          );
        })}
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
    const tooltipWidth = 280;
    const tooltipHeight = 320;
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
              quality={quality}
              gradeColor={solidColor}
            />
          </div>,
          document.body
        )}

      {/* Touch: modal on tap — uses the app's Modal component which handles
          scroll lock, portal, and viewport positioning correctly */}
      <Modal
        isOpen={isModalOpen}
        size="sm"
        title="Flip Quality"
        onClose={() => setIsModalOpen(false)}
      >
        <div className="quality-modal-content">
          <QualityBreakdownContent
            quality={quality}
            gradeColor={solidColor}
          />
        </div>
      </Modal>
    </>
  );
}
