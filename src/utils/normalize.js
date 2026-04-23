/**
 * utils/normalize.js
 * Normalisation et migration des données persistées.
 * v6 : migration automatique vers le modèle directionnel.
 */

import { safeNum } from './numbers.js';

const STATUS_NORMALIZE = {
  'Planifié': 'planifié', 'En cours': 'en_cours', 'Validé': 'validé',
  'Annulé': 'annulée', 'annulé': 'annulée',
  'Engagé': 'étudiée', 'engagé': 'étudiée',
  'En étude': 'en_étude',
  'Conditionnel': 'conditionnel', 'conditionnel': 'conditionnel',
  'Raccordé': 'raccordée', 'raccordé': 'raccordée',
};

export const normalizeStatus = s => STATUS_NORMALIZE[s] || s;

// ── Migration vers le modèle directionnel ──────────────────────────────────

/**
 * Construit un directionalModel minimal à partir des champs legacy.
 * Règle spec §5.3 :
 *   withdrawalView.maxHistoricLoadBT = baseLoad2025
 *   tous les autres champs = 0
 *   growthLoadMaxBT = growthLoadMaxMT = organicGrowthRate
 */
function migrateDirectionalModel(sub) {
  const base = safeNum(sub.baseLoad2025, 0);
  const rate = safeNum(sub.organicGrowthRate, 0.02);
  return {
    referenceYear: 2025,
    _migratedFrom: 'legacy',
    withdrawalView: {
      maxHistoricLoadBT:      base,
      maxHistoricLoadMT:      0,
      minHistoricInjectionBT: 0,
      minHistoricInjectionMT: 0,
      growthLoadMaxBT:        rate,
      growthLoadMaxMT:        rate,
      growthMinInjectionBT:   0,
      growthMinInjectionMT:   0,
    },
    injectionView: {
      maxHistoricInjectionBT: 0,
      maxHistoricInjectionMT: 0,
      minHistoricLoadBT:      0,
      minHistoricLoadMT:      0,
      growthMaxInjectionBT:   0,
      growthMaxInjectionMT:   0,
      growthMinLoadBT:        0,
      growthMinLoadMT:        0,
    },
  };
}

/** Normalise un bloc directionalModel existant (protège les valeurs numériques). */
function normalizeDirectionalModel(dm) {
  if (!dm) return null;
  const wv = dm.withdrawalView || {};
  const iv = dm.injectionView  || {};
  return {
    referenceYear: safeNum(dm.referenceYear, 2025),
    withdrawalView: {
      maxHistoricLoadBT:      safeNum(wv.maxHistoricLoadBT, 0),
      maxHistoricLoadMT:      safeNum(wv.maxHistoricLoadMT, 0),
      minHistoricInjectionBT: safeNum(wv.minHistoricInjectionBT, 0),
      minHistoricInjectionMT: safeNum(wv.minHistoricInjectionMT, 0),
      growthLoadMaxBT:        safeNum(wv.growthLoadMaxBT, 0),
      growthLoadMaxMT:        safeNum(wv.growthLoadMaxMT, 0),
      growthMinInjectionBT:   safeNum(wv.growthMinInjectionBT, 0),
      growthMinInjectionMT:   safeNum(wv.growthMinInjectionMT, 0),
    },
    injectionView: {
      maxHistoricInjectionBT: safeNum(iv.maxHistoricInjectionBT, 0),
      maxHistoricInjectionMT: safeNum(iv.maxHistoricInjectionMT, 0),
      minHistoricLoadBT:      safeNum(iv.minHistoricLoadBT, 0),
      minHistoricLoadMT:      safeNum(iv.minHistoricLoadMT, 0),
      growthMaxInjectionBT:   safeNum(iv.growthMaxInjectionBT, 0),
      growthMaxInjectionMT:   safeNum(iv.growthMaxInjectionMT, 0),
      growthMinLoadBT:        safeNum(iv.growthMinLoadBT, 0),
      growthMinLoadMT:        safeNum(iv.growthMinLoadMT, 0),
    },
  };
}

// ── Export principal ────────────────────────────────────────────────────────

export function normalizeSubstations(subs) {
  return (subs || []).map(sub => {
    // Directional model : migrate or normalize
    const isMigrated = !sub.directionalModel;
    const directionalModel = isMigrated
      ? migrateDirectionalModel(sub)
      : normalizeDirectionalModel(sub.directionalModel);

    // reverseCapacityRatio in transformerConfig
    const transformerConfig = sub.transformerConfig ? {
      ...sub.transformerConfig,
      reverseCapacityRatio: safeNum(sub.transformerConfig.reverseCapacityRatio, 1.0),
    } : sub.transformerConfig;

    return {
      ...sub,
      // Core fields
      baseLoad2025:      safeNum(sub.baseLoad2025, 0),
      organicGrowthRate: safeNum(sub.organicGrowthRate, 0.02),
      plannableCapacity: safeNum(sub.plannableCapacity, 0),
      // Directional model
      directionalModel,
      _directionalMigrated: isMigrated || undefined,
      // Infra
      transformerConfig,
      chargeHistory:     Array.isArray(sub.chargeHistory) ? sub.chargeHistory : [],
      foisonnement:      sub.foisonnement || {},
      investments: (sub.investments || []).map(inv => ({
        ...inv,
        status: normalizeStatus(inv.status),
      })),
      connectionRequests: (sub.connectionRequests || []).map(req => ({
        ...req,
        status:            normalizeStatus(req.status),
        yearSouhaitee:     safeNum(req.yearSouhaitee || req.year, 2026),
        year:              safeNum(req.year || req.yearSouhaitee, 2026),
        reservationMonths: safeNum(req.reservationMonths, 18),
        // Migration ancien format → client/grd
        client: req.client || {
          prelevFerme:       safeNum(req.powerRigid, 0) + safeNum(req.powerPilotable, 0),
          prelevFlexible:    0,
          injFerme:          safeNum(req.injectionRigide, 0),
          injFlexible:       safeNum(req.injectionPilotable, 0),
          detailInjection:   [],
          detailPrelevement: [],
        },
      })),
    };
  });
}

export function normalizeProjects(projects) {
  return (projects || []).map(p => ({ ...p, status: normalizeStatus(p.status) }));
}
