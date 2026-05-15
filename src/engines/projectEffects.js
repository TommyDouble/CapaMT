/**
 * engines/projectEffects.js
 *
 * Transforme les blocs du wizard de projet réseau en effets métier
 * (modify_tfo, load_transfer, create_ss, decommission).
 *
 * Fonction pure — aucune dépendance React.
 * Appelée par ProjectWizard au moment de la sauvegarde d'un projet.
 */

import { safeNum } from '../utils/numbers.js';
import { uid } from '../utils/format.js';
import { normalizeCoordinates } from '../utils/coordinates.js';

/**
 * @param {object[]} blocks       - Blocs du wizard (renforcement | création | suppression)
 * @param {object[]} substations  - Liste des SS de base (pour calculer les deltas tfo)
 * @returns {object[]}            - Tableau d'effets projet
 */
export function computeEffectsFromBlocks(blocks, substations) {
  const effects = [];

  blocks.forEach((block) => {
    // ── Renforcement d'une SS existante ─────────────────────────
    if (block.blockType === 'renforcement') {
      const origSS = substations.find((s) => s.id === block.ssId);
      const origTfos = origSS?.transformerConfig?.transformers || [];
      const editedTfos = block.tfos
        .map((t) => ({ id: t.id, power: safeNum(t.power, 0), role: t.role }))
        .filter((t) => t.power > 0);

      const origMap = Object.fromEntries(origTfos.map((t) => [t.id, t]));
      const editMap = Object.fromEntries(editedTfos.map((t) => [t.id, t]));

      const toRemove = origTfos.filter((t) => !editMap[t.id]).map((t) => t.id);
      const toAdd = editedTfos.filter((t) => !origMap[t.id]);
      const toModify = editedTfos.filter((t) => {
        const o = origMap[t.id];
        return o && (o.power !== t.power || o.role !== t.role);
      });

      const origTfc = origSS?.transformerConfig || {};
      const tfoChanged = toRemove.length || toAdd.length || toModify.length;
      const coeffChanged =
        String(origTfc.coeffN) !== block.coeffN || String(origTfc.coeffN1) !== block.coeffN1;
      const mtChanged =
        (origTfc.mtBackup?.enabled || false) !== !!block.mtBackupEnabled ||
        String(origTfc.mtBackup?.capacity || 0) !== String(block.mtBackupCapacity || 0);

      if (tfoChanged || coeffChanged || mtChanged) {
        effects.push({
          ssId: block.ssId,
          action: 'modify_tfo',
          tfoChanges: { remove: toRemove, add: toAdd, modify: toModify },
          coeffN: safeNum(block.coeffN, 0.9),
          coeffN1: safeNum(block.coeffN1, 1.0),
          mtBackup: {
            enabled: !!block.mtBackupEnabled,
            capacity: safeNum(block.mtBackupCapacity, 0),
          },
        });
      }

      if (block.loadDelta && safeNum(block.loadDelta, 0) !== 0) {
        effects.push({
          ssId: block.ssId,
          action: 'load_transfer',
          loadDelta: safeNum(block.loadDelta, 0),
        });
      }
    }

    // ── Création d'une nouvelle SS ───────────────────────────────
    if (block.blockType === 'création') {
      const tfos = block.tfos
        .map((t) => ({ id: t.id, power: safeNum(t.power, 0), role: t.role }))
        .filter((t) => t.power > 0);

      const tc = {
        transformers: tfos,
        coeffN: safeNum(block.coeffN, 0.9),
        coeffN1: safeNum(block.coeffN1, 1.0),
        mtBackup: { enabled: false, capacity: 0 },
        reverseCapacityRatio: safeNum(block.reverseCapacityRatio, 1.0),
      };

      const newId = block._newSsId || `ss-new-${uid().slice(0, 6)}`;
      const initialLoad = safeNum(block.initialLoadMva, 0);
      const growthRate = safeNum(block.growthRatePct, 1.5) / 100;
      const coordinates = normalizeCoordinates(block.coordinates, 'project');

      effects.push({
        ssId: newId,
        action: 'create_ss',
        newSS: {
          id: newId,
          name: block.name || 'Nouvelle SS',
          code: block.code || '',
          commune: block.commune || '',
          voltageLevel: `${block.voltageUpstream || '36kV'}/10 kV`,
          voltageUpstream: block.voltageUpstream || '36kV',
          coordinates,
          transformerConfig: tc,
          directionalModel: {
            referenceYear: 2025,
            withdrawalView: {
              maxHistoricLoadBT: initialLoad,
              maxHistoricLoadMT: 0,
              minHistoricInjectionBT: 0,
              minHistoricInjectionMT: 0,
              growthLoadMaxBT: growthRate,
              growthLoadMaxMT: growthRate,
              growthMinInjectionBT: 0,
              growthMinInjectionMT: 0,
            },
            injectionView: {
              maxHistoricInjectionBT: 0,
              maxHistoricInjectionMT: 0,
              minHistoricLoadBT: 0,
              minHistoricLoadMT: 0,
              growthMaxInjectionBT: 0,
              growthMaxInjectionMT: 0,
              growthMinLoadBT: 0,
              growthMinLoadMT: 0,
            },
          },
          foisonnement: {},
          connectionRequests: [],
          status: 'actif',
          notes: '',
        },
      });

      if (block.loadDelta && safeNum(block.loadDelta, 0) !== 0) {
        effects.push({
          ssId: newId,
          action: 'load_transfer',
          loadDelta: safeNum(block.loadDelta, 0),
        });
      }
    }

    // ── Suppression / décommissionnement ────────────────────────
    if (block.blockType === 'suppression') {
      if (block.loadDelta && safeNum(block.loadDelta, 0) !== 0) {
        effects.push({
          ssId: block.ssId,
          action: 'load_transfer',
          loadDelta: safeNum(block.loadDelta, 0),
        });
      }
      effects.push({ ssId: block.ssId, action: 'decommission' });
    }
  });

  return effects;
}
