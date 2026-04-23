/**
 * engines/explanation.js
 * Structures explicatives pour l'interface — modèle directionnel v6.
 *
 * buildCapacityBreakdown    — décomposition capacité directe + inverse
 * buildDirectionalBreakdown — décomposition des deux vues directionnelles
 * buildDecisionExplanation  — explication complète d'une décision GRD
 */

import { safeNum }                    from '../utils/numbers.js';
import { getFoisonnement }             from '../constants/index.js';
import {
  getCapacityAtYear, getCapacityNAtYear,
  getEffectiveTfoConfig, calcCapacityN1, calcCapacityN,
} from './capacity.js';
import {
  getWithdrawalBaseNet, getWithdrawalFirmReservation, getWithdrawalFlexibleReservation,
  getInjectionBaseNet, getInjectionFirmReservation, getInjectionFlexibleReservation,
  getDirectCapacityN1AtYear, getDirectCapacityNAtYear,
  getReverseCapacityN1AtYear, getReverseCapacityNAtYear,
  projectDirectionalComponent,
} from './directionalSubstation.js';
import {
  getEffectiveRigidReservation, getEffectivePilotableReservation,
  getEffectiveInjRigide, getEffectiveInjPilot,
  reqClientPrelevTotal,
} from './requests.js';
import { computeRecommendation } from './recommendation.js';
import { buildDirectionalSnapshot } from './directionalSubstation.js';

// ── buildCapacityBreakdown ──────────────────────────────────────────────────

export function buildCapacityBreakdown(sub, year, projects = []) {
  if (!sub) return null;

  const tfoConfig    = getEffectiveTfoConfig(sub, projects, year);
  const hasTfoConfig = !!tfoConfig && tfoConfig.transformers?.length > 0;
  const capN1        = getCapacityAtYear(sub, year, projects);
  const capN         = getCapacityNAtYear(sub, year, projects);
  const ratio        = safeNum(sub.transformerConfig?.reverseCapacityRatio, 1.0);
  const capRevN1     = capN1 * ratio;
  const capRevN      = capN !== null ? capN * ratio : null;

  const activeStatuses = new Set(['planifié', 'en_cours', 'validé']);
  const appliedProjects = (projects || []).filter(p =>
    activeStatuses.has(p.status) && p.year <= year &&
    (p.effects || []).some(e => e.ssId === sub.id && e.action === 'modify_tfo')
  );
  const capN1WithoutProjects = getCapacityAtYear(sub, year, []);
  const projectContribution  = +(capN1 - capN1WithoutProjects).toFixed(1);

  return {
    capN1: +capN1.toFixed(1),
    capN:  capN !== null ? +capN.toFixed(1) : null,
    capRevN1: +capRevN1.toFixed(1),
    capRevN:  capRevN !== null ? +capRevN.toFixed(1) : null,
    reverseCapacityRatio: ratio,
    source:    hasTfoConfig ? 'transformerConfig' : 'plannableCapacity_fallback',
    transformers: (tfoConfig?.transformers ?? sub.transformerConfig?.transformers ?? []).map(t => ({
      id: t.id, power: safeNum(t.power, 0), role: t.role,
    })),
    coeffN:   safeNum(tfoConfig?.coeffN  ?? sub.transformerConfig?.coeffN,  0.90),
    coeffN1:  safeNum(tfoConfig?.coeffN1 ?? sub.transformerConfig?.coeffN1, 1.00),
    mtBackup: tfoConfig?.mtBackup ?? sub.transformerConfig?.mtBackup ?? { enabled: false, capacity: 0 },
    capN1WithoutProjects: +capN1WithoutProjects.toFixed(1),
    projectContribution,
    appliedProjects: appliedProjects.map(p => ({ id: p.id, name: p.name, year: p.year, status: p.status })),
  };
}

// ── buildDirectionalBreakdown ───────────────────────────────────────────────

/**
 * Décompose les deux vues directionnelles pour une SS et une année.
 * Retourne toutes les composantes, réservations et résultantes.
 */
export function buildDirectionalBreakdown(sub, year, projects = [], excludeId = null) {
  if (!sub) return null;

  const m    = sub.directionalModel;
  const refY = safeNum(m?.referenceYear, 2025);
  const wv   = m?.withdrawalView  || {};
  const iv   = m?.injectionView   || {};

  // Withdrawal components
  const wLoadBT  = projectDirectionalComponent(wv.maxHistoricLoadBT,      wv.growthLoadMaxBT,      refY, year);
  const wLoadMT  = projectDirectionalComponent(wv.maxHistoricLoadMT,      wv.growthLoadMaxMT,      refY, year);
  const wInjBT   = projectDirectionalComponent(wv.minHistoricInjectionBT, wv.growthMinInjectionBT, refY, year);
  const wInjMT   = projectDirectionalComponent(wv.minHistoricInjectionMT, wv.growthMinInjectionMT, refY, year);

  // Injection components
  const iMaxInjBT  = projectDirectionalComponent(iv.maxHistoricInjectionBT, iv.growthMaxInjectionBT, refY, year);
  const iMaxInjMT  = projectDirectionalComponent(iv.maxHistoricInjectionMT, iv.growthMaxInjectionMT, refY, year);
  const iMinLoadBT = projectDirectionalComponent(iv.minHistoricLoadBT,      iv.growthMinLoadBT,      refY, year);
  const iMinLoadMT = projectDirectionalComponent(iv.minHistoricLoadMT,      iv.growthMinLoadMT,      refY, year);

  // Active requests (excluding current form if editing)
  const INACTIVE = new Set(['annulée', 'annulé', 'raccordée', 'raccordé']);
  const activeReqs = (sub.connectionRequests || []).filter(r => {
    if (r.id === excludeId) return false;
    if (INACTIVE.has(r.status) || r.status === 'conditionnel') return false;
    return (r.yearSouhaitee || r.year || 2026) <= year;
  });

  const engagedRequests = activeReqs.map(r => {
    const foison   = getFoisonnement(r, sub);
    const wFirm    = getEffectiveRigidReservation(r)    * foison;
    const wFlex    = getEffectivePilotableReservation(r) * foison;
    const iFirm    = getEffectiveInjRigide(r)           * foison;
    const iFlex    = getEffectiveInjPilot(r)            * foison;
    return {
      id: r.id, name: r.name, refProjet: r.refProjet ?? null,
      status: r.status, yearSouhaitee: r.yearSouhaitee || r.year || 2026,
      wFirmReserved: +wFirm.toFixed(2), wFlexReserved: +wFlex.toFixed(2),
      iFirmReserved: +iFirm.toFixed(2), iFlexReserved: +iFlex.toFixed(2),
    };
  });

  const totalWFirm = engagedRequests.reduce((s, r) => s + r.wFirmReserved, 0);
  const totalWFlex = engagedRequests.reduce((s, r) => s + r.wFlexReserved, 0);
  const totalIFirm = engagedRequests.reduce((s, r) => s + r.iFirmReserved, 0);
  const totalIFlex = engagedRequests.reduce((s, r) => s + r.iFlexReserved, 0);

  // Resultants
  const withdrawalBase  = wLoadBT + wLoadMT - wInjBT - wInjMT;
  const withdrawalRigid = withdrawalBase + totalWFirm;
  const withdrawalTotal = withdrawalRigid + totalWFlex;
  const injectionBase   = -iMaxInjBT - iMaxInjMT + iMinLoadBT + iMinLoadMT;
  const injectionRigid  = injectionBase - totalIFirm;
  const injectionTotal  = injectionRigid - totalIFlex;

  return {
    // Withdrawal components
    wLoadBT: +wLoadBT.toFixed(2), wLoadMT: +wLoadMT.toFixed(2),
    wInjBT:  +wInjBT.toFixed(2),  wInjMT:  +wInjMT.toFixed(2),
    // Injection components
    iMaxInjBT: +iMaxInjBT.toFixed(2), iMaxInjMT: +iMaxInjMT.toFixed(2),
    iMinLoadBT: +iMinLoadBT.toFixed(2), iMinLoadMT: +iMinLoadMT.toFixed(2),
    // Reservations
    totalWFirm: +totalWFirm.toFixed(2), totalWFlex: +totalWFlex.toFixed(2),
    totalIFirm: +totalIFirm.toFixed(2), totalIFlex: +totalIFlex.toFixed(2),
    // Resultants
    withdrawalBase: +withdrawalBase.toFixed(2),
    withdrawalRigid: +withdrawalRigid.toFixed(2),
    withdrawalTotal: +withdrawalTotal.toFixed(2),
    injectionBase: +injectionBase.toFixed(2),
    injectionRigid: +injectionRigid.toFixed(2),
    injectionTotal: +injectionTotal.toFixed(2),
    // Engaged requests
    engagedRequests,
    engagedCount: engagedRequests.length,
  };
}

// ── buildDecisionExplanation ────────────────────────────────────────────────

export function buildDecisionExplanation(sub, form, projects = []) {
  if (!sub || !form) return null;

  const year      = parseInt(form.yearSouhaitee || form.year) || 2026;
  const excludeId = form.id ?? null;

  const rec = computeRecommendation(sub, form, projects);
  if (!rec) return null;

  const capBreakdown  = buildCapacityBreakdown(sub, year, projects);
  const dirBreakdown  = buildDirectionalBreakdown(sub, year, projects, excludeId);
  const assumptions   = buildDirectionalSnapshot(sub, year, 'withdrawal', projects);

  const projectImpact = {
    hasImpact:       capBreakdown.projectContribution !== 0,
    deltaMVA:        capBreakdown.projectContribution,
    appliedProjects: capBreakdown.appliedProjects,
    withoutProjects: capBreakdown.capN1WithoutProjects,
    withProjects:    capBreakdown.capN1,
  };

  const {
    canFullFerme, canPartial, noRigid, residualWithdrawal, residualInjection,
    recFerme, recFlex, recInjFerme, recInjFlex,
    clientFerme, clientFlex, totalPrelev, clientInjF, clientInjFl, totalInj,
    withdrawalBase, committedWFirm, capDirN1, capRevN1,
  } = rec;

  let verdictKey, verdictLabel;
  if      (canFullFerme)                      { verdictKey = 'acceptable';    verdictLabel = 'Capacité suffisante — offre ferme possible'; }
  else if (canPartial)                        { verdictKey = 'partiel';       verdictLabel = 'Capacité rigide partielle — redirection en flexible'; }
  else if (noRigid && totalPrelev > 0)        { verdictKey = 'liste_attente'; verdictLabel = "Aucun résiduel rigide disponible — liste d'attente"; }
  else if (totalPrelev === 0 && totalInj > 0) { verdictKey = 'injection_only';verdictLabel = 'Demande en injection uniquement'; }
  else                                        { verdictKey = 'acceptable';    verdictLabel = 'Capacité suffisante'; }

  const decisionFactors = {
    capacityUsed:      { label: 'Capacité directe N-1',         value: +capDirN1.toFixed(1),           unit: 'MVA', source: capBreakdown.source },
    capacityReverse:   { label: 'Capacité inverse N-1',         value: +capRevN1.toFixed(1),           unit: 'MVA' },
    withdrawalBase:    { label: 'Base nette prélèvement',       value: +withdrawalBase.toFixed(1),     unit: 'MVA' },
    engagedRigid:      { label: 'Réservations prélèvement engagées', value: +committedWFirm.toFixed(1),unit: 'MVA',
                         detail: `${dirBreakdown.engagedCount} demande(s) active(s)` },
    residualWithdrawal:{ label: 'Résiduel prélèvement',         value: +residualWithdrawal.toFixed(1), unit: 'MVA' },
    residualInjection: { label: 'Résiduel injection',           value: +residualInjection.toFixed(1),  unit: 'MVA' },
    clientRequest:     { label: 'Demande client prélèvement',   value: +totalPrelev.toFixed(1),        unit: 'MVA',
                         detail: clientFerme > 0 && clientFlex > 0
                           ? `${clientFerme} ferme + ${clientFlex} flexible`
                           : clientFerme > 0 ? `${clientFerme} ferme` : `${clientFlex} flexible` },
    projectImpact: projectImpact.hasImpact
      ? { label: 'Apport projets réseau', value: projectImpact.deltaMVA, unit: 'MVA',
          detail: projectImpact.appliedProjects.map(p => p.name).join(', ') }
      : null,
  };

  return {
    subId: sub.id, formId: form.id ?? null, year,
    verdictKey, verdictLabel,
    canFullFerme, canPartial, noRigid,
    residual: +residualWithdrawal.toFixed(1),      // backward compat
    residualWithdrawal: +residualWithdrawal.toFixed(1),
    residualInjection:  +residualInjection.toFixed(1),
    recommendation: { ferme: recFerme, flexible: recFlex, injFerme: recInjFerme, injFlex: recInjFlex },
    decisionFactors,
    capBreakdown,
    dirBreakdown,
    projectImpact,
    assumptions,
    engagedSummary: {
      count:      dirBreakdown.engagedCount,
      totalRigid: dirBreakdown.totalWFirm,
      totalPilot: dirBreakdown.totalWFlex,
      requests:   dirBreakdown.engagedRequests,
    },
  };
}
