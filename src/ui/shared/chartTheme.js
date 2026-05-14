/**
 * chartTheme.js
 * Reads CSS custom properties at render time to produce theme-aware
 * Chart.js configuration values. Used by EvolutionTab,
 * and ProjectBudgetChart — all of which need to react to light/dark toggle.
 *
 * Pure utility — no state, no side-effects.
 */

/** Read a CSS var from :root / html element. Falls back to provided default. */
function cssVar(name, fallback = '') {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function getChartTheme() {
  return {
    grid:        cssVar('--chart-grid',   'rgba(0,0,0,.04)'),
    text:        cssVar('--chart-text',   '#8a82a0'),
    accent:      cssVar('--accent',       '#7c3aed'),
    accentLight: cssVar('--accent-light', '#a78bfa'),
    green:       cssVar('--green',        '#059669'),
    red:         cssVar('--red',          '#dc2626'),
    amber:       cssVar('--amber',        '#d97706'),
    bgRaised:    cssVar('--bg-raised',    '#fff'),
    textPrimary: cssVar('--text-primary', '#1a1230'),
    textSecondary: cssVar('--text-secondary', '#4a4162'),
    textMuted:   cssVar('--text-muted',   '#8a82a0'),
    border:      cssVar('--border',       '#e8e2f0'),
    fontMono:    cssVar('--font-mono',    "'JetBrains Mono', monospace"),
    fontSans:    cssVar('--font-sans',    "'Outfit', sans-serif"),
  };
}
