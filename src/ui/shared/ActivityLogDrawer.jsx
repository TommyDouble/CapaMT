import React from 'react';
import { ActivityLog } from '../pages/intake/SaisiePage.jsx';

/**
 * Slide-in drawer for the activity log.
 * Triggered by the sidebar badge.
 */
export function ActivityLogDrawer({ show, onClose, activityLog, onLogDelete, onNavigate }) {
  if (!show) return null;

  const handleNavigate = (...args) => { onClose(); onNavigate?.(...args); };

  return (
    <>
      <div className="v3-drawer-backdrop" onClick={onClose} />
      <div className="v3-drawer">
        <div className="v3-drawer__header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Journal de session
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {activityLog.length} saisie(s) · la suppression retire l'entrée du réseau
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div className="v3-drawer__body">
          {activityLog.length > 0 ? (
            <ActivityLog log={activityLog} onDelete={onLogDelete} onNavigate={handleNavigate} />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucune saisie dans cette session.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
