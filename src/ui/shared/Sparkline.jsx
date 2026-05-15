import React from 'react';

/**
 * Sparkline — lightweight inline SVG sparkline.
 * Used in OverviewPage KPI cards and SaturationMatrix residual column.
 *
 * Props:
 *   values  — number[]
 *   width   — canvas width px (default 80)
 *   height  — canvas height px (default 28)
 *   color   — stroke color (default auto: red if min < 0, else accent)
 *   threshold — optional y-value to draw a dashed reference line (e.g. 0)
 *   title   — optional tooltip text
 */
export function Sparkline({ values = [], width = 80, height = 28, color, threshold, title }) {
  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const autoColor = min < 0 ? '#ef4444' : 'var(--accent)';
  const stroke = color || autoColor;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Position of threshold line (e.g. y=0)
  let thresholdY = null;
  if (threshold !== undefined && threshold >= min && threshold <= max) {
    thresholdY = (pad + h - ((threshold - min) / range) * h).toFixed(1);
  }

  // First point where value crosses threshold
  const crossIdx = threshold !== undefined ? values.findIndex((v) => v <= threshold) : -1;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      {title && <title>{title}</title>}
      {/* Threshold line */}
      {thresholdY !== null && (
        <line
          x1={pad}
          y1={thresholdY}
          x2={width - pad}
          y2={thresholdY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="3,2"
          opacity="0.5"
        />
      )}
      {/* Sparkline */}
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Dot at crossing point */}
      {crossIdx >= 0 && (
        <circle
          cx={pad + (crossIdx / Math.max(values.length - 1, 1)) * w}
          cy={pad + h - ((values[crossIdx] - min) / range) * h}
          r="3"
          fill="#ef4444"
        />
      )}
    </svg>
  );
}
