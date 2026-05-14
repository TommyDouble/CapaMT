/**
 * Sidebar.jsx — v3.0 "GridOps"
 * Professional navigation with inline SVG icons.
 * No emoji. Clean, dense, SCADA-inspired.
 */
import React from 'react';
import { getGlobalQueueStats } from '../../engines/queue.js';
import { isSubstationAtRisk } from '../../engines/alerts.js';
import { ThemeToggle } from './ThemeToggle.jsx';
import { ExportImportMenu } from '../shared/ExportImportMenu.jsx';

// ── Inline SVG icons (16×16, stroke-based) ────────────────────────────────────
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  overview:   <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  list:       <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  queue:      <Icon d="M9 5H2v14h20V5h-7M9 5V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 5h6M9 14h6M9 18h6" />,
  projects:   <Icon d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  map:        <Icon d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7zM9 4v13M15 7v13" />,
  log:        <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
};

const NAV_ITEMS = [
  { id: 'overview',        icon: ICONS.overview, label: "Vue d'ensemble" },
  { id: 'list',            icon: ICONS.list,     label: 'Sous-stations' },
  { id: 'file_attente',    icon: ICONS.queue,    label: "File d'attente" },
  { id: 'investissements', icon: ICONS.projects, label: 'Projets réseau' },
  { id: 'carte',           icon: ICONS.map,      label: 'Carte réseau' },
];

export function Sidebar({
  navActive, onNav,
  substations, networkProjects, activityLog,
  onImport, onOpenSaisie, onOpenActivityLog,
}) {
  const allActive = (substations || []).filter(s => s.status !== 'hors_service');
  const queueStats = getGlobalQueueStats(substations || [], networkProjects || []);
  const queueUrgent = queueStats.expired + queueStats.expiringSoon;
  const invAtRisk = allActive.filter(s => isSubstationAtRisk(s, networkProjects || [])).length;

  const getBadge = (id) => {
    if (id === 'file_attente' && queueUrgent > 0)
      return <span className="v3-nav-badge v3-nav-badge--red">{queueUrgent}</span>;
    if (id === 'investissements' && invAtRisk > 0)
      return <span className="v3-nav-badge v3-nav-badge--amber">{invAtRisk}</span>;
    return null;
  };

  return (
    <aside className="v3-sidebar">
      {/* Brand */}
      <div className="v3-sidebar__brand">
        <div className="v3-sidebar__brand-icon">RC</div>
        <div>
          <div className="v3-sidebar__brand-name">RESA Capacité</div>
          <div className="v3-sidebar__brand-sub">Liège · 2026–2035</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="v3-sidebar__nav">
        <div className="v3-sidebar__section">Navigation</div>
        {NAV_ITEMS.map(n => (
          <button key={n.id}
            className={`v3-nav-item ${navActive === n.id ? 'active' : ''}`}
            onClick={() => onNav(n.id)}>
            <span className="v3-nav-icon">{n.icon}</span>
            {n.label}
            {getBadge(n.id)}
          </button>
        ))}

        <div className="v3-sidebar__section">Actions</div>
      </nav>

      {/* CTA */}
      <button className="v3-sidebar__cta" onClick={onOpenSaisie}>
        + Nouvelle demande
      </button>

      {/* Activity log */}
      {activityLog && activityLog.length > 0 && (
        <div style={{ padding: '0 8px 8px' }}>
          <button className="v3-nav-item" onClick={onOpenActivityLog}
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--border-accent)' }}>
            <span className="v3-nav-icon">{ICONS.log}</span>
            Journal
            <span className="v3-nav-badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {activityLog.length}
            </span>
          </button>
        </div>
      )}

      {/* Bottom */}
      <div className="v3-sidebar__bottom">
        <ThemeToggle />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="v3-sidebar__status">
            <span className="v3-sidebar__dot" />
            <span>{allActive.length} SS actives</span>
          </div>
          <ExportImportMenu
            substations={substations}
            onImport={onImport}
            networkProjects={networkProjects}
            activityLog={activityLog}
          />
        </div>
      </div>
    </aside>
  );
}
