/**
 * ProjectWizard.jsx — Create/edit wizard for network projects.
 * Extracted from NetworkProjectsPage.
 */
import React, { useState } from 'react';
import { PROJ_STATUSES, YEARS } from '../../../../constants/index.js';
import { statusLabel, uid } from '../../../../utils/format.js';
import { computeEffectsFromBlocks } from '../../../../engines/projectEffects.js';
import { FormRow } from '../../../shared/forms.jsx';
import { ModalShell } from '../../../shared/ModalShell.jsx';
import { RenforcementBlock } from './RenforcementBlock.jsx';
import { CreationBlock } from './CreationBlock.jsx';
import { SuppressionBlock } from './SuppressionBlock.jsx';

export function ProjectWizard({ project, substations, allSubstations, onSave, onClose }) {
  const isNew = !project?.id;

  // Reconstruct blocks from existing effects (edit mode)
  const initialBlocks = () => {
    if (!project?.effects) return [];
    const blocks = [];
    const ssIds = [...new Set((project.effects || []).map(e => e.ssId))];
    ssIds.forEach(ssId => {
      const myEffects = (project.effects || []).filter(e => e.ssId === ssId);
      const createEff = myEffects.find(e => e.action === 'create_ss');
      const decommEff = myEffects.find(e => e.action === 'decommission');
      const modTfoEff = myEffects.find(e => e.action === 'modify_tfo');
      const transferEff = myEffects.find(e => e.action === 'load_transfer');

      if (createEff) {
        const ns = createEff.newSS;
        blocks.push({
          _id: uid(), blockType: 'création', _newSsId: ssId,
          name: ns.name || '', code: ns.code || '', commune: ns.commune || '',
          voltageUpstream: ns.voltageUpstream || '36kV',
          baseLoadInitial: String(ns.baseLoadInitial || 0),
          organicGrowthRate: String(((ns.organicGrowthRate || 0.015) * 100).toFixed(2)),
          tfos: (ns.transformerConfig?.transformers || []).map(t => ({ ...t, power: String(t.power) })),
          coeffN: String(ns.transformerConfig?.coeffN || 0.90),
          coeffN1: String(ns.transformerConfig?.coeffN1 || 1.00),
          loadDelta: String(transferEff?.loadDelta || ''),
        });
      } else if (decommEff) {
        blocks.push({
          _id: uid(), blockType: 'suppression', ssId,
          loadDelta: String(transferEff?.loadDelta || ''),
        });
      } else {
        const origSS = allSubstations.find(s => s.id === ssId);
        const origTfos = origSS?.transformerConfig?.transformers || [];
        let editedTfos = origTfos.map(t => ({ ...t, power: String(t.power) }));
        if (modTfoEff) {
          const rm = new Set(modTfoEff.tfoChanges?.remove || []);
          const mod = Object.fromEntries((modTfoEff.tfoChanges?.modify || []).map(t => [t.id, t]));
          editedTfos = editedTfos.filter(t => !rm.has(t.id)).map(t => mod[t.id] ? { ...mod[t.id], power: String(mod[t.id].power) } : t);
          (modTfoEff.tfoChanges?.add || []).forEach(t => {
            if (!editedTfos.find(x => x.id === t.id)) editedTfos.push({ ...t, power: String(t.power) });
          });
        }
        blocks.push({
          _id: uid(), blockType: 'renforcement', ssId,
          tfos: editedTfos,
          coeffN: String(modTfoEff?.coeffN ?? origSS?.transformerConfig?.coeffN ?? 0.90),
          coeffN1: String(modTfoEff?.coeffN1 ?? origSS?.transformerConfig?.coeffN1 ?? 1.00),
          mtBackupEnabled: modTfoEff?.mtBackup?.enabled ?? origSS?.transformerConfig?.mtBackup?.enabled ?? false,
          mtBackupCapacity: String(modTfoEff?.mtBackup?.capacity ?? origSS?.transformerConfig?.mtBackup?.capacity ?? ''),
          loadDelta: String(transferEff?.loadDelta || ''),
        });
      }
    });
    return blocks;
  };

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: project?.name || '',
    year: project?.year || 2028,
    status: project?.status || 'planifié',
    cost: project?.cost || '',
    notes: project?.notes || '',
  });
  const [blocks, setBlocks] = useState(initialBlocks);

  const setBlock = (_id, updated) => setBlocks(bs => bs.map(b => b._id === _id ? updated : b));
  const removeBlock = (_id) => setBlocks(bs => bs.filter(b => b._id !== _id));

  const addBlock = (type) => {
    const firstSS = substations.filter(s => s.status !== 'hors_service')[0];
    const tfc = firstSS?.transformerConfig;
    if (type === 'renforcement') {
      setBlocks(bs => [...bs, {
        _id: uid(), blockType: 'renforcement',
        ssId: firstSS?.id || '',
        tfos: tfc?.transformers?.map(t => ({ ...t, power: String(t.power) })) || [],
        coeffN: String(tfc?.coeffN || 0.90),
        coeffN1: String(tfc?.coeffN1 || 1.00),
        mtBackupEnabled: tfc?.mtBackup?.enabled || false,
        mtBackupCapacity: String(tfc?.mtBackup?.capacity || ''),
        loadDelta: '',
      }]);
    } else if (type === 'création') {
      setBlocks(bs => [...bs, {
        _id: uid(), blockType: 'création',
        name: '', code: '', commune: '', voltageUpstream: '36kV',
        baseLoadInitial: '0', organicGrowthRate: '1.5',
        tfos: [{ id: 'T1', power: '', role: 'normal' }],
        coeffN: '0.90', coeffN1: '1.00', loadDelta: '',
      }]);
    } else if (type === 'suppression') {
      setBlocks(bs => [...bs, {
        _id: uid(), blockType: 'suppression',
        ssId: firstSS?.id || '',
        loadDelta: '',
      }]);
    }
  };

  const handleSave = () => {
    const effects = computeEffectsFromBlocks(blocks, substations);
    onSave({
      ...(project || {}),
      name: form.name, year: parseInt(form.year), status: form.status,
      cost: form.cost ? parseInt(form.cost) : null, notes: form.notes,
      effects,
    });
  };

  const canSave = form.name?.trim() && form.year >= 2026;
  const activeSubs = substations.filter(s => s.status !== 'hors_service');

  return (
    <ModalShell
      title={isNew ? 'Nouveau projet réseau' : 'Modifier le projet'}
      subtitle={isNew ? 'Définissez les informations et les travaux associés au projet' : form.name}
      onClose={onClose}
      wide
      steps={['1. Infos générales', '2. Travaux & effets réseau']}
      activeStep={step}
      onStepClick={setStep}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Précédent</button>}
            {step < 1 && <button className="btn-primary" onClick={() => setStep(1)}>Suivant →</button>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
            {canSave && (
              <button className="btn-primary"
                style={{ background: 'var(--green)', boxShadow: '0 2px 8px rgba(5,150,105,.2)' }}
                onClick={handleSave}>
                {isNew ? '✓ Créer le projet' : '✓ Enregistrer'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Step 1: General info */}
        {step === 0 && (<>
          <FormRow label="Nom du projet">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex : Renforcement T1+T2 Liège Nord · Création SS Seraing-Ouest"
              className="input-field" />
          </FormRow>
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Année de mise en service">
              <select value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} className="input-field">
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </FormRow>
            <FormRow label="Statut budgétaire">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-field">
                {PROJ_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </FormRow>
          </div>
          <FormRow label="Coût estimé (k€)">
            <input type="number" min="0" value={form.cost}
              onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
              placeholder="Ex: 2500" className="input-field" />
          </FormRow>
          <FormRow label="Notes / justification">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="input-field" style={{ resize: 'vertical' }} />
          </FormRow>

          {/* Blocks summary */}
          {blocks.length > 0 && (
            <div className="wizard-summary-box">
              <p className="wizard-summary-box__title">
                {blocks.length} partie(s) de travaux configurée(s)
              </p>
              <div className="flex flex-wrap gap-2">
                {blocks.map(b => {
                  const label = b.blockType === 'renforcement' ? `${allSubstations.find(s => s.id === b.ssId)?.name || b.ssId}`
                    : b.blockType === 'création' ? `✦ ${b.name || 'Nouvelle SS'}`
                    : `⛔ ${allSubstations.find(s => s.id === b.ssId)?.name || b.ssId}`;
                  return <span key={b._id} className="wizard-summary-box__tag">{label}</span>;
                })}
              </div>
            </div>
          )}
        </>)}

        {/* Step 2: Works */}
        {step === 1 && (<>
          <p className="text-xs text-muted">
            Définissez les travaux à réaliser. Chaque bloc décrit les modifications sur une sous-station.
            Plusieurs blocs peuvent coexister dans un même projet.
          </p>

          {blocks.map(b => (
            b.blockType === 'renforcement' ? (
              <RenforcementBlock key={b._id} block={b}
                substations={activeSubs}
                onChange={updated => setBlock(b._id, updated)}
                onRemove={() => removeBlock(b._id)} />
            ) : b.blockType === 'création' ? (
              <CreationBlock key={b._id} block={b}
                onChange={updated => setBlock(b._id, updated)}
                onRemove={() => removeBlock(b._id)} />
            ) : (
              <SuppressionBlock key={b._id} block={b}
                substations={activeSubs}
                onChange={updated => setBlock(b._id, updated)}
                onRemove={() => removeBlock(b._id)} />
            )
          ))}

          {/* Add block buttons */}
          <div className="wizard-add-section">
            <p className="wizard-add-section__title">Ajouter une partie de travaux :</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => addBlock('renforcement')} className="wizard-add-btn wizard-add-btn--blue">
                + Renforcement SS existante
              </button>
              <button onClick={() => addBlock('création')} className="wizard-add-btn wizard-add-btn--purple">
                + ✦ Création nouvelle SS
              </button>
              <button onClick={() => addBlock('suppression')} className="wizard-add-btn wizard-add-btn--red">
                + ⛔ Suppression SS
              </button>
            </div>
          </div>
        </>)}
      </div>
    </ModalShell>
  );
}
