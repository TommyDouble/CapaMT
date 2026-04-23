/**
 * Topbar.jsx — v3.0 "GridOps"
 * Shows current view, breadcrumb navigation, and model context.
 */
import React from 'react';

const VIEW_LABELS = {
  overview:        "Vue d'ensemble",
  list:            'Sous-stations',
  file_attente:    "File d'attente",
  investissements: 'Projets réseau',
  detail:          null,
};

export function Topbar({ view, detailName, onBack }) {
  const isDetail = view === 'detail';
  const label = isDetail ? detailName : (VIEW_LABELS[view] || view);

  return (
    <header className="v3-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="v3-breadcrumb">
          {isDetail && (
            <>
              <button className="v3-breadcrumb__parent" onClick={onBack}>
                Sous-stations
              </button>
              <span className="v3-breadcrumb__sep">/</span>
            </>
          )}
          <span>{label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)', letterSpacing: '.04em',
          background: 'var(--bg-muted)', padding: '3px 8px', borderRadius: 4,
          border: '1px solid var(--border)',
        }}>
          DIRECTIONNEL N-1
        </span>
      </div>
    </header>
  );
}
