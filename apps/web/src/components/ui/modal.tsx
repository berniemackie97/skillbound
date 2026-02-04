'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  const portalTargetRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();

  // Initialize portal target synchronously to avoid flickering
  if (portalTargetRef.current === null && typeof document !== 'undefined') {
    portalTargetRef.current = document.body;
  }

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen || !portalTargetRef.current) return;

    const body = document.body;
    const shell = document.querySelector('.shell');
    const currentCount = Number(body.dataset['modalCount'] ?? '0');
    const nextCount = currentCount + 1;
    body.dataset['modalCount'] = String(nextCount);

    if (nextCount === 1) {
      body.dataset['modalOverflow'] = body.style.overflow || '';
      body.style.overflow = 'hidden';
    }

    if (shell) {
      shell.setAttribute('inert', '');
      shell.setAttribute('aria-hidden', 'true');
    }

    return () => {
      const remainingCount = Math.max(
        0,
        Number(body.dataset['modalCount'] ?? '1') - 1
      );
      body.dataset['modalCount'] = String(remainingCount);

      if (remainingCount === 0) {
        body.style.overflow = body.dataset['modalOverflow'] ?? '';
        delete body.dataset['modalOverflow'];
        delete body.dataset['modalCount'];
      }

      if (shell && remainingCount === 0) {
        shell.removeAttribute('inert');
        shell.removeAttribute('aria-hidden');
      }
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen || !portalTargetRef.current) {
    return null;
  }

  const sizeClass = `modal-${size}`;

  const modalContent = (
    <div
      className="modal-backdrop"
      role="button"
      tabIndex={0}
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        aria-describedby={subtitle ? subtitleId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-container ${sizeClass}`}
        role="dialog"
      >
        <button
          aria-label="Close modal"
          className="modal-close"
          type="button"
          onClick={onClose}
        >
          <svg
            fill="none"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="20"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>

        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {subtitle && (
          <p className="modal-subtitle" id={subtitleId}>
            {subtitle}
          </p>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalContent, portalTargetRef.current);
}
