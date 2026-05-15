/**
 * CaseInternalNotes (V2) — Notes internes par demande, éditables en place.
 */
import React, { useState } from 'react';

export function CaseInternalNotes({ req, sub, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(req.internalNotes || '');

  const handleSave = () => {
    if (draft === req.internalNotes) {
      setEditing(false);
      return;
    }
    const reqs = sub.connectionRequests.map((r) =>
      r.id === req.id ? { ...r, internalNotes: draft } : r,
    );
    onUpdate({ ...sub, connectionRequests: reqs });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(req.internalNotes || '');
    setEditing(false);
  };

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.07em',
            color: 'var(--accent)',
          }}
        >
          Notes internes
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-edit-link"
            style={{ fontSize: 11 }}
          >
            {req.internalNotes ? 'Modifier' : '+ Ajouter une note'}
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="input-field"
            style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
            placeholder="Notes internes — visibles uniquement dans ce dossier…"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              style={{ fontSize: 11, padding: '4px 14px' }}
            >
              ✓ Enregistrer
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 14px' }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : req.internalNotes ? (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {req.internalNotes}
        </p>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Aucune note interne.
        </p>
      )}
    </div>
  );
}
