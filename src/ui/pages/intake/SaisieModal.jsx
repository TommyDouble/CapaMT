import React from 'react';
import { ModalShell } from '../../shared/ModalShell.jsx';
import { SaisiePage } from './SaisiePage.jsx';

/**
 * SaisieModal — renders the saisie form inside a centered modal.
 * Reuses SaisiePage with inModal=true to skip page title and ActivityLog.
 */
export function SaisieModal({ show, onClose, substations, activityLog,
  onSubmit, onLogDelete, onNavigate, onGoToProjects }) {
  if (!show) return null;

  const handleNavigate = (...args) => { onClose(); onNavigate?.(...args); };
  const handleGoToProjects = () => { onClose(); onGoToProjects?.(); };

  return (
    <ModalShell title="Nouvelle demande" subtitle="Encodez une demande de raccordement avec aperçu d'impact immédiat"
      onClose={onClose} wide>
      <SaisiePage
        inModal
        substations={substations}
        activityLog={[]}
        
        onSubmit={(...args) => { onSubmit(...args); onClose(); }}
        onLogDelete={onLogDelete}
        onNavigate={handleNavigate}
        onGoToProjects={handleGoToProjects}
      />
    </ModalShell>
  );
}
