/**
 * RenforcementBlock.jsx — Project wizard block for substation reinforcement.
 * Extracted from NetworkProjectsPage.
 */
import React from 'react';
import { calcCapacityN1 } from '../../../../engines/capacity.js';
import { f1 } from '../../../../utils/format.js';
import { FormRow } from '../../../shared/forms.jsx';
import { TfoEditorInline } from './TfoEditorInline.jsx';

function calcCapacityN(tc) {
  const normals = tc.transformers.filter(t => t.role !== 'secours');
  return normals.reduce((s, t) => s + t.power, 0) * (tc.coeffN || 0.90);
}

export function RenforcementBlock({ block, substations, onChange, onRemove }) {
  const ss = substations.find(s => s.id === block.ssId);
  const origTfos = ss?.transformerConfig?.transformers || [];

  const getTfoStatus = (t) => {
    const orig = origTfos.find(x => x.id === t.id);
    if (!orig) return 'new';
    if (orig.power !== parseFloat(t.power) || orig.role !== t.role) return 'modified';
    return 'unchanged';
  };

  return (
    <div className="wizard-block wizard-block--renforcement">
      {/* Header */}
      <div className="wizard-block__header wizard-block__header--blue">
        <div className="flex items-center gap-3">
          <span className="wizard-block__title">Renforcement</span>
          <select value={block.ssId}
            onChange={e => {
              const newSS = substations.find(s => s.id === e.target.value);
              const tfc = newSS?.transformerConfig;
              onChange({
                ...block, ssId: e.target.value,
                tfos: tfc?.transformers?.map(t => ({ ...t })) || [],
                coeffN: String(tfc?.coeffN ?? 0.90),
                coeffN1: String(tfc?.coeffN1 ?? 1.00),
                mtBackupEnabled: tfc?.mtBackup?.enabled || false,
                mtBackupCapacity: String(tfc?.mtBackup?.capacity || ''),
                loadDelta: '', decommission: false,
              });
            }}
            className="input-field" style={{ width: 180 }}>
            {substations.filter(s => s.status !== 'hors_service').map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.code}</option>
            ))}
          </select>
        </div>
        <button onClick={onRemove} className="wizard-block__remove">✕</button>
      </div>

      <div className="wizard-block__body space-y-4">
        {/* Transformateurs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-secondary uppercase tracking-wide">Transformateurs après projet</p>
            {origTfos.length > 0 && (
              <button type="button"
                onClick={() => onChange({ ...block, tfos: origTfos.map(t => ({ ...t })) })}
                className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>
                ↺ Réinitialiser
              </button>
            )}
          </div>
          {origTfos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-muted mr-1">Config actuelle :</span>
              {origTfos.map(t => (
                <span key={t.id} className="tfo-badge">
                  {t.id} · {t.power} MVA · {t.role === 'secours' ? 'Secours' : 'Normal'}
                </span>
              ))}
            </div>
          )}
          <TfoEditorInline tfos={block.tfos} onChange={tfos => onChange({ ...block, tfos })} />
          {origTfos.length > 0 && block.tfos.some(t => getTfoStatus(t) !== 'unchanged') && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {block.tfos.map((t, i) => {
                const st = getTfoStatus(t);
                if (st === 'unchanged') return null;
                return (
                  <span key={i} className={`tfo-diff-badge tfo-diff-badge--${st}`}>
                    {st === 'new' ? '✦ Nouveau' : '✎ Modifié'} : {t.id}
                  </span>
                );
              })}
              {origTfos.filter(t => !block.tfos.find(x => x.id === t.id)).map(t => (
                <span key={t.id} className="tfo-diff-badge tfo-diff-badge--removed">
                  ⛔ Retiré : {t.id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Coefficients */}
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Coeff. N après projet" hint="Ex: 0.90">
            <input type="number" step="0.01" min="0.01" max="2"
              value={block.coeffN} onChange={e => onChange({ ...block, coeffN: e.target.value })}
              className="input-field" />
          </FormRow>
          <FormRow label="Coeff. N-1 après projet" hint="Ex: 1.00 · 1.15 = surcharge admise">
            <input type="number" step="0.01" min="0.01" max="2"
              value={block.coeffN1} onChange={e => onChange({ ...block, coeffN1: e.target.value })}
              className="input-field" />
          </FormRow>
        </div>

        {/* MT backup */}
        <div className="wizard-option-box">
          <div className="flex items-center gap-3 mb-2">
            <input type="checkbox" id={`mtb-${block._id}`} checked={!!block.mtBackupEnabled}
              onChange={e => onChange({ ...block, mtBackupEnabled: e.target.checked })}
              style={{ width: 15, height: 15, cursor: 'pointer' }} />
            <label htmlFor={`mtb-${block._id}`} className="text-sm font-semibold text-secondary cursor-pointer">
              Secours réseau MT disponible après projet
            </label>
            {ss?.transformerConfig?.mtBackup?.enabled && !block.mtBackupEnabled && (
              <span className="tfo-diff-badge tfo-diff-badge--modified">
                ⚠ Décommissionnement du secours MT
              </span>
            )}
          </div>
          {block.mtBackupEnabled && (
            <FormRow label="Capacité MT secours (MVA)">
              <input type="number" step="0.5" min="0" value={block.mtBackupCapacity}
                onChange={e => onChange({ ...block, mtBackupCapacity: e.target.value })}
                placeholder="Ex: 10" className="input-field" />
            </FormRow>
          )}
        </div>

        {/* Load transfer */}
        <FormRow label="Transfert de charge (± MVA)" hint="Négatif = charge quittant cette SS · Positif = charge arrivant">
          <input type="number" step="0.5" value={block.loadDelta}
            onChange={e => onChange({ ...block, loadDelta: e.target.value })}
            placeholder="Ex: -8.0 ou +5.0" className="input-field" />
        </FormRow>

        {/* Preview */}
        {block.tfos.filter(t => parseFloat(t.power) > 0).length > 0 && (() => {
          const tc = {
            transformers: block.tfos.map(t => ({ ...t, power: parseFloat(t.power) || 0 })).filter(t => t.power > 0),
            coeffN: parseFloat(block.coeffN) || 0.90,
            coeffN1: parseFloat(block.coeffN1) || 1.00,
            mtBackup: { enabled: !!block.mtBackupEnabled, capacity: parseFloat(block.mtBackupCapacity) || 0 },
          };
          const cN = calcCapacityN(tc);
          const cN1 = calcCapacityN1(tc);
          return (
            <div className="capacity-preview capacity-preview--blue">
              <span className="capacity-preview__label">Capacités résultantes :</span>
              <span className="capacity-preview__value">N = {f1(cN)} MVA</span>
              <span className="capacity-preview__value">N-1 = {f1(cN1)} MVA</span>
              {ss && <span className="text-xs text-gray-400">(actuel : N-1 = {f1(ss.plannableCapacity)} MVA)</span>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
