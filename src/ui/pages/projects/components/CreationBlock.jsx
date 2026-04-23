/**
 * CreationBlock.jsx — Project wizard block for new substation creation.
 * Extracted from NetworkProjectsPage.
 */
import React from 'react';
import { UPSTREAM_LEVELS } from '../../../../constants/index.js';
import { calcCapacityN1 } from '../../../../engines/capacity.js';
import { f1 } from '../../../../utils/format.js';
import { FormRow } from '../../../shared/forms.jsx';
import { TfoEditorInline } from './TfoEditorInline.jsx';

function calcCapacityN(tc) {
  const normals = tc.transformers.filter(t => t.role !== 'secours');
  return normals.reduce((s, t) => s + t.power, 0) * (tc.coeffN || 0.90);
}

export function CreationBlock({ block, onChange, onRemove }) {
  return (
    <div className="wizard-block wizard-block--creation">
      <div className="wizard-block__header wizard-block__header--purple">
        <span className="wizard-block__title">✦ Création d'une nouvelle sous-station</span>
        <button onClick={onRemove} className="wizard-block__remove">✕</button>
      </div>
      <div className="wizard-block__body space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Nom de la SS">
            <input value={block.name} onChange={e => onChange({ ...block, name: e.target.value })}
              placeholder="Ex: Seraing-Ouest" className="input-field" />
          </FormRow>
          <FormRow label="Code réseau">
            <input value={block.code} onChange={e => onChange({ ...block, code: e.target.value })}
              placeholder="Ex: 36N_SER_OUEST" className="input-field" />
          </FormRow>
          <FormRow label="Commune">
            <input value={block.commune} onChange={e => onChange({ ...block, commune: e.target.value })}
              className="input-field" />
          </FormRow>
          <FormRow label="Alimentation amont">
            <select value={block.voltageUpstream} onChange={e => onChange({ ...block, voltageUpstream: e.target.value })} className="input-field">
              {UPSTREAM_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </FormRow>
          <FormRow label="Charge initiale (MVA)" hint="Avant transferts de charge">
            <input type="number" step="0.1" value={block.baseLoadInitial}
              onChange={e => onChange({ ...block, baseLoadInitial: e.target.value })}
              placeholder="Ex: 0" className="input-field" />
          </FormRow>
          <FormRow label="Croissance organique (%/an)">
            <input type="number" step="0.1" value={block.organicGrowthRate}
              onChange={e => onChange({ ...block, organicGrowthRate: e.target.value })}
              placeholder="Ex: 1.5" className="input-field" />
          </FormRow>
        </div>

        <div>
          <p className="text-xs font-bold text-secondary uppercase tracking-wide mb-2">Transformateurs à l'ouverture</p>
          <TfoEditorInline tfos={block.tfos} onChange={tfos => onChange({ ...block, tfos })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Coeff. N" hint="Ex: 0.90">
            <input type="number" step="0.01" min="0.01" max="2"
              value={block.coeffN} onChange={e => onChange({ ...block, coeffN: e.target.value })} className="input-field" />
          </FormRow>
          <FormRow label="Coeff. N-1" hint="Ex: 1.00">
            <input type="number" step="0.01" min="0.01" max="2"
              value={block.coeffN1} onChange={e => onChange({ ...block, coeffN1: e.target.value })} className="input-field" />
          </FormRow>
        </div>

        <FormRow label="Charge reçue par transfert (± MVA)" hint="Positif = charge arrivant depuis une autre SS">
          <input type="number" step="0.5" value={block.loadDelta}
            onChange={e => onChange({ ...block, loadDelta: e.target.value })}
            placeholder="Ex: +10.0" className="input-field" />
        </FormRow>

        {block.tfos.filter(t => parseFloat(t.power) > 0).length > 0 && (() => {
          const tc = {
            transformers: block.tfos.map(t => ({ ...t, power: parseFloat(t.power) || 0 })).filter(t => t.power > 0),
            coeffN: parseFloat(block.coeffN) || 0.90, coeffN1: parseFloat(block.coeffN1) || 1.00,
            mtBackup: { enabled: false, capacity: 0 },
          };
          const cN = calcCapacityN(tc), cN1 = calcCapacityN1(tc);
          return (
            <div className="capacity-preview capacity-preview--purple">
              <span className="capacity-preview__label">Capacités à l'ouverture :</span>
              <span className="capacity-preview__value">N = {f1(cN)} MVA</span>
              <span className="capacity-preview__value">N-1 = {f1(cN1)} MVA</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
