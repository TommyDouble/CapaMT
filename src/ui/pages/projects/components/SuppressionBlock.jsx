/**
 * SuppressionBlock.jsx — Project wizard block for substation decommissioning.
 * Extracted from NetworkProjectsPage.
 */
import React from 'react';
import { FormRow } from '../../../shared/forms.jsx';

export function SuppressionBlock({ block, substations, onChange, onRemove }) {
  const ss = substations.find(s => s.id === block.ssId);
  return (
    <div className="wizard-block wizard-block--suppression">
      <div className="wizard-block__header wizard-block__header--red">
        <span className="wizard-block__title">⛔ Suppression / Décommissionnement</span>
        <button onClick={onRemove} className="wizard-block__remove">✕</button>
      </div>
      <div className="wizard-block__body space-y-4">
        <FormRow label="Sous-station à décommissionner">
          <select value={block.ssId} onChange={e => onChange({ ...block, ssId: e.target.value })} className="input-field">
            {substations.filter(s => s.status !== 'hors_service').map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.code}</option>
            ))}
          </select>
        </FormRow>
        {ss && (
          <div className="wizard-option-box">
            <p className="text-xs text-muted mb-1">Config actuelle de <strong>{ss.name}</strong> :</p>
            <div className="flex flex-wrap gap-2">
              {(ss.transformerConfig?.transformers || []).map(t => (
                <span key={t.id} className="tfo-badge">
                  {t.id} · {t.power} MVA · {t.role === 'secours' ? 'Secours' : 'Normal'}
                </span>
              ))}
            </div>
          </div>
        )}
        <FormRow label="Charge transférée vers une autre SS (± MVA)" hint="Saisir la valeur négative ici (charge sortant de cette SS)">
          <input type="number" step="0.5" value={block.loadDelta}
            onChange={e => onChange({ ...block, loadDelta: e.target.value })}
            placeholder="Ex: -11.5" className="input-field" />
        </FormRow>
        <div className="alert-box alert-box--danger">
          <p className="text-xs text-red-700 font-semibold">
            ⚠ Cette SS sera marquée <strong>hors service</strong> à la MES du projet.
            Elle reste visible en lecture seule avec un marqueur visuel.
            Ses demandes de raccordement devront être réaffectées manuellement.
          </p>
        </div>
      </div>
    </div>
  );
}
