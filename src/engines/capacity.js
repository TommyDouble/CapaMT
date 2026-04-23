/**
 * engines/capacity.js
 * Calcul de la capacité électrique des sous-stations.
 *
 * calcCapacityN         — capacité en exploitation normale
 * calcCapacityN1        — capacité après perte du plus gros transformateur
 * getEffectiveTfoConfig — config tfo après effets des projets réseau
 * getCapacityAtYear     — capacité N-1 plannable effective à une année
 * getCapacityNAtYear    — capacité N effective à une année
 * getEffectiveSubstations — liste des SS après create_ss / decommission
 */

import { safeNum } from '../utils/numbers.js';

/** Capacité en exploitation normale : Σ(tfo_normal × coeffN) */
export function calcCapacityN(config) {
  if (!config?.transformers?.length) return null;
  const normals = config.transformers.filter(t => t.role === 'normal');
  if (!normals.length) return 0;
  const coeff = safeNum(config.coeffN, 1.0);
  return +(normals.reduce((s, t) => s + safeNum(t.power, 0), 0) * coeff).toFixed(1);
}

/**
 * Capacité N-1 : après perte du plus gros transformateur normal.
 * = Σ(restants × coeffN1) + maxSecours × coeffN1 + mtBackup
 */
export function calcCapacityN1(config) {
  if (!config?.transformers?.length) return null;
  const normals = config.transformers
    .filter(t => t.role === 'normal')
    .map(t => ({ ...t, power: safeNum(t.power, 0) }));
  const secours = config.transformers
    .filter(t => t.role === 'secours')
    .map(t => ({ ...t, power: safeNum(t.power, 0) }));

  if (!normals.length) return 0;

  const coeff = safeNum(config.coeffN1, 1.0);
  const normalPowers = normals.map(t => t.power);
  const maxNormal = Math.max(...normalPowers);

  // Retire un exemplaire du plus gros normal (N-1)
  const remaining = [...normalPowers];
  remaining.splice(remaining.indexOf(maxNormal), 1);

  const maxSecours = secours.length ? Math.max(...secours.map(t => t.power)) : 0;
  const mtCap = (config.mtBackup?.enabled && safeNum(config.mtBackup?.capacity, 0) > 0)
    ? safeNum(config.mtBackup.capacity, 0) : 0;

  const n1 = remaining.reduce((s, p) => s + p, 0) * coeff
           + maxSecours * coeff
           + mtCap;
  return +n1.toFixed(1);
}

/** Applique les effets modify_tfo des projets actifs sur la config d'une SS. */
export function getEffectiveTfoConfig(sub, projects, year) {
  const base = sub.transformerConfig
    ? { ...sub.transformerConfig, transformers: [...(sub.transformerConfig.transformers || [])] }
    : null;
  if (!base) return null;

  (projects || [])
    .filter(p => p.status !== 'annulé' && p.year <= year)
    .forEach(proj => {
      (proj.effects || []).forEach(eff => {
        if (eff.ssId !== sub.id || eff.action !== 'modify_tfo') return;
        const ch = eff.tfoChanges || {};
        if (ch.remove?.length)
          base.transformers = base.transformers.filter(t => !ch.remove.includes(t.id));
        (ch.add || []).forEach(t => {
          if (!base.transformers.find(x => x.id === t.id)) base.transformers.push({ ...t });
        });
        (ch.modify || []).forEach(m => {
          const idx = base.transformers.findIndex(t => t.id === m.id);
          if (idx >= 0) base.transformers[idx] = { ...base.transformers[idx], ...m };
        });
        if (eff.coeffN  !== undefined) base.coeffN  = eff.coeffN;
        if (eff.coeffN1 !== undefined) base.coeffN1 = eff.coeffN1;
        if (eff.mtBackup !== undefined) base.mtBackup = { ...base.mtBackup, ...eff.mtBackup };
      });
    });

  return base;
}

/** Capacité N-1 plannable effective à une année (avec projets réseau). */
export function getCapacityAtYear(sub, year, projects = []) {
  const tfoConfig = getEffectiveTfoConfig(sub, projects, year);
  if (tfoConfig) {
    const base = calcCapacityN1(tfoConfig);
    return base !== null ? Math.max(0, base) : Math.max(0, sub.plannableCapacity);
  }
  // Fallback : ancienne logique investments[]
  return Math.max(0, sub.plannableCapacity +
    (sub.investments || [])
      .filter(i => i.year <= year && i.status !== 'annulé')
      .reduce((s, i) => s + safeNum(i.capacityAdded, 0), 0)
  );
}

/** Capacité N effective à une année (peut être null si pas de config tfo). */
export function getCapacityNAtYear(sub, year, projects = []) {
  const tfoConfig = getEffectiveTfoConfig(sub, projects, year);
  if (!tfoConfig) return null;
  const n = calcCapacityN(tfoConfig);
  return n !== null ? Math.max(0, n) : null;
}

/**
 * Liste des SS effectives à une année (après create_ss et decommission).
 * Les SS décommissionnées reçoivent status='hors_service'.
 */
export function getEffectiveSubstations(baseSubstations, projects, year) {
  const ssMap = {};
  baseSubstations.forEach(s => { ssMap[s.id] = { ...s }; });

  (projects || [])
    .filter(p => p.status !== 'annulé' && p.year <= year)
    .forEach(proj => {
      (proj.effects || []).forEach(eff => {
        if (eff.action === 'create_ss' && eff.newSS && !ssMap[eff.newSS.id]) {
          ssMap[eff.newSS.id] = {
            ...eff.newSS,
            baseLoad2025:       eff.newSS.baseLoadInitial || 0,
            plannableCapacity:  calcCapacityN1(eff.newSS.transformerConfig) || 0,
            connectionRequests: [],
            investments:        [],
            chargeHistory:      [],
          };
        }
        if (eff.action === 'decommission' && ssMap[eff.ssId]) {
          ssMap[eff.ssId] = { ...ssMap[eff.ssId], status: 'hors_service' };
        }
      });
    });

  return Object.values(ssMap);
}
