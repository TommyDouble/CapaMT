/**
 * GrdResponseSection.jsx — GRD response form section.
 * Extracted from EditRequestPanel.
 */
import React from 'react';
import { DECISION_CONFIG } from '../../../../constants/index.js';
import { f1 } from '../../../../utils/format.js';
import { FormRow, Section } from '../../../shared/forms.jsx';
import { DecisionExplanationBlock } from './DecisionExplanationBlock.jsx';

export function GrdResponseSection({
  sub, form, projects,
  hasGrd, grdForm, setGrd, enableGrd, set,
  clientPrelevTotal, clientInjTotal,
  grdPrelevTotal, grdInjTotal,
  grdPrelevOk, grdInjOk,
  grdPrelevDelta, grdInjDelta,
  errors,
}) {
  return (
    <Section title="Réponse GRD" badge={hasGrd ? 'Étude finalisée' : 'Non étudiée'}
      color={hasGrd ? '#065f46' : 'var(--text-muted)'} defaultOpen={hasGrd}>
      <div className="space-y-4">
        <DecisionExplanationBlock
          sub={sub} form={form} projects={projects}
          grdForm={hasGrd ? grdForm : null}
          onApply={(recFerme, recFlex, recInjF, recInjFl) => {
            setGrd('prelevFerme', String(recFerme));
            setGrd('prelevFlexible', String(recFlex));
            setGrd('injFerme', String(recInjF));
            setGrd('injFlexible', String(recInjFl));
            if (!hasGrd) {
              enableGrd();
              if (!form.dateOffre) set('dateOffre', new Date().toISOString().slice(0, 10));
            }
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={enableGrd}
            style={{
              background: hasGrd ? '#f0fdf4' : 'var(--slate)',
              color: hasGrd ? '#065f46' : 'var(--text-muted)',
              border: `1.5px solid ${hasGrd ? '#a7f3d0' : 'var(--border)'}`,
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700, transition: 'all .15s',
            }}>
            {hasGrd ? '✓ Étude finalisée — modifier' : '+ Saisir la réponse GRD'}
          </button>
          {hasGrd && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Passage automatique en statut "Étudiée" à l'enregistrement
            </span>
          )}
        </div>

        {hasGrd && (<>
          {/* Withdrawal powers */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#dc2626', marginBottom: 8 }}>
              Puissance accordée — Prélèvements
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ borderLeft: '3px solid #dc2626', paddingLeft: 10 }}>
                <FormRow label="Ferme accordé (MVA)">
                  <input type="number" step=".1" min="0"
                    max={parseFloat(form.client?.prelevFerme) || 999}
                    value={grdForm.prelevFerme}
                    onChange={e => setGrd('prelevFerme', e.target.value)} className="input-field" />
                </FormRow>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                  Max : {(parseFloat(form.client?.prelevFerme) || 0).toFixed(1)} MVA (demande ferme)
                </p>
              </div>
              <div style={{ borderLeft: '3px solid #f97316', paddingLeft: 10 }}>
                <FormRow label="Flexible accordé (MVA)">
                  <input type="number" step=".1" min="0" value={grdForm.prelevFlexible}
                    onChange={e => setGrd('prelevFlexible', e.target.value)} className="input-field" />
                </FormRow>
              </div>
            </div>
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: grdPrelevOk ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${grdPrelevOk ? '#a7f3d0' : '#fca5a5'}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: grdPrelevOk ? '#065f46' : '#dc2626' }}>
                {grdPrelevOk
                  ? `✓ Total GRD = ${grdPrelevTotal.toFixed(1)} MVA = total client`
                  : `⚠ Total GRD (${grdPrelevTotal.toFixed(1)}) ${grdPrelevDelta > 0 ? '+' : ''}${grdPrelevDelta.toFixed(1)} vs client (${clientPrelevTotal.toFixed(1)})`}
              </p>
              {errors.grdPrelev && <p className="form-error">{errors.grdPrelev}</p>}
            </div>
          </div>

          {/* Injection powers */}
          {clientInjTotal > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#059669', marginBottom: 8 }}>
                Puissance accordée — Injections
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ borderLeft: '3px solid #10b981', paddingLeft: 10 }}>
                  <FormRow label="Injection garantie (MVA)">
                    <input type="number" step=".1" min="0" value={grdForm.injFerme}
                      onChange={e => setGrd('injFerme', e.target.value)} className="input-field" />
                  </FormRow>
                </div>
                <div style={{ borderLeft: '3px solid #34d399', paddingLeft: 10 }}>
                  <FormRow label="Injection curtailable (MVA)">
                    <input type="number" step=".1" min="0" value={grdForm.injFlexible}
                      onChange={e => setGrd('injFlexible', e.target.value)} className="input-field" />
                  </FormRow>
                </div>
              </div>
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: grdInjOk ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${grdInjOk ? '#a7f3d0' : '#fca5a5'}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: grdInjOk ? '#065f46' : '#dc2626' }}>
                  {grdInjOk
                    ? `✓ Total injection GRD = ${grdInjTotal.toFixed(1)} MVA = total client`
                    : `⚠ Total injection GRD (${grdInjTotal.toFixed(1)}) vs client (${clientInjTotal.toFixed(1)})`}
                </p>
                {errors.grdInj && <p className="form-error">{errors.grdInj}</p>}
              </div>
            </div>
          )}

          {/* Decision */}
          <FormRow label="Décision GRD">
            <select value={grdForm.decisionGRD} onChange={e => setGrd('decisionGRD', e.target.value)} className="input-field">
              {Object.entries(DECISION_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.icon} {c.label}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Note de décision">
            <textarea value={grdForm.noteDecision || ''} onChange={e => setGrd('noteDecision', e.target.value)}
              rows={2} className="input-field" style={{ resize: 'vertical' }} />
          </FormRow>
        </>)}
      </div>
    </Section>
  );
}
