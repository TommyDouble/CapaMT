/**
 * TfoEditorInline.jsx — Transformer editor for project wizard blocks.
 * Extracted from NetworkProjectsPage to keep file sizes manageable.
 */
import React from 'react';

export function TfoEditorInline({ tfos, onChange }) {
  const addRow = () => {
    const nextId = `T${tfos.length + 1}`;
    onChange([...tfos, { id: nextId, power: '', role: 'normal' }]);
  };
  const removeRow = (i) => onChange(tfos.filter((_, j) => j !== i));
  const setField = (i, k, v) => {
    const next = [...tfos];
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {tfos.map((t, i) => (
        <div key={i} className="tfo-editor-row">
          <div style={{ flex: '0 0 70px' }}>
            <label className="block text-xs text-muted mb-0.5">ID</label>
            <input value={t.id} onChange={e => setField(i, 'id', e.target.value)}
              className="input-field text-xs mono" placeholder="T1" />
          </div>
          <div style={{ flex: '0 0 90px' }}>
            <label className="block text-xs text-muted mb-0.5">Puissance (MVA)</label>
            <input type="number" step="0.5" min="0" value={t.power}
              onChange={e => setField(i, 'power', e.target.value)}
              className="input-field text-xs mono" placeholder="40" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="block text-xs text-muted mb-0.5">Rôle</label>
            <select value={t.role} onChange={e => setField(i, 'role', e.target.value)} className="input-field text-xs">
              <option value="normal">Exploitation normale</option>
              <option value="secours">Secours uniquement</option>
            </select>
          </div>
          {tfos.length > 1 && (
            <button type="button" onClick={() => removeRow(i)}
              className="tfo-remove-btn" title="Supprimer ce transformateur">✕</button>
          )}
        </div>
      ))}
      {tfos.length < 3 && (
        <button type="button" onClick={addRow} className="tfo-add-btn">
          + Ajouter un transformateur
        </button>
      )}
    </div>
  );
}
