import React, { useState } from 'react';
import { ModalShell } from '../../shared/ModalShell.jsx';
import { SubstationSelector } from '../../shared/SubstationSelector.jsx';
import { CustomerRequestForm } from '../requests/components/RequestWorkflowPanels.jsx';

export function SaisieModal({ show, onClose, substations, onSubmit }) {
  const [subId, setSubId] = useState('');
  if (!show) return null;

  const sub = substations.find((s) => s.id === subId) || null;

  const handleSave = (data) => {
    onSubmit({ subId, entryType: 'demande', data });
    onClose();
  };

  return (
    <ModalShell
      title="Nouvelle demande"
      subtitle="Sélectionnez une sous-station puis complétez le formulaire"
      onClose={onClose}
      wide
    >
      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Sous-station concernée
        </p>
        <SubstationSelector substations={substations} value={subId} onChange={setSubId} />
      </div>
      {sub ? (
        <CustomerRequestForm req={null} sub={sub} onSave={handleSave} onClose={onClose} />
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          Sélectionnez une sous-station pour afficher le formulaire.
        </div>
      )}
    </ModalShell>
  );
}
