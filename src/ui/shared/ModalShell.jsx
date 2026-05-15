import React, { useEffect } from 'react';

/**
 * Generic centered modal shell.
 * Props:
 *   title       — header title
 *   subtitle    — optional header subtitle
 *   onClose     — called when backdrop or X is clicked
 *   wide        — if true, uses wider variant (780px)
 *   steps       — optional string[] for wizard-style step pills
 *   activeStep  — index of current step (used with steps)
 *   onStepClick — callback(index) when a step pill is clicked
 *   footer      — optional footer content (React node)
 *   children    — body content
 */
export function ModalShell({
  title,
  subtitle,
  onClose,
  wide,
  steps,
  activeStep,
  onStepClick,
  footer,
  children,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="v3-modal-backdrop" onClick={onClose}>
      <div
        className={`v3-modal${wide ? ' v3-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="v3-modal__header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="v3-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Steps indicator (optional — wizard only) */}
        {steps && steps.length > 0 && (
          <div className="v3-modal__steps">
            {steps.map((s, i) => (
              <button
                key={i}
                className={`v3-modal__step${activeStep === i ? ' active' : ''}${activeStep > i ? ' done' : ''}`}
                onClick={() => onStepClick?.(i)}
              >
                {activeStep > i ? '✓ ' : ''}
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="v3-modal__body">{children}</div>

        {/* Footer */}
        {footer && <div className="v3-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
