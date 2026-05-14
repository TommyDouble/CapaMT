/**
 * services/storage.js
 * Source unique de vérité pour la persistance.
 *
 * Format v11 : { version, savedAt, substations, networkProjects, activityLog }
 * Les sessions pré-v11 sont volontairement ignorées : la refonte repart sur
 * des données d'exemple propres.
 */

import { STORAGE_KEY, YEARS } from '../constants/index.js';
import { normalizeSubstations, normalizeProjects } from '../utils/normalize.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../data/initial.js';
import {
  getWithdrawalRigid, getWithdrawalTotal,
  getInjectionRigid, getInjectionTotal,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
  getResidualWithdrawalRigid, getResidualInjectionRigid,
  getUtilizationWithdrawalRigid, getUtilizationInjectionRigid,
} from '../engines/directionalSubstation.js';
import { getCapacityAtYear } from '../engines/capacity.js';

const STORAGE_VERSION = 11;

// ── Persistance locale ──────────────────────────────────────────────────────

export function saveState(substations, networkProjects, activityLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      substations,
      networkProjects,
      activityLog,
    }));
  } catch (_) {}
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const d = JSON.parse(raw);

    if (!d.version || d.version < STORAGE_VERSION) return null;

    if (d.substations)     d.substations    = normalizeSubstations(d.substations);
    if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
    if (!d.activityLog)    d.activityLog     = [];
    return d;
  } catch (_) { return null; }
}

/**
 * Lit le storage une seule fois et retourne un objet initial complet.
 */
export function hydrateInitialAppState() {
  const saved = loadState();
  return {
    substations:     saved?.substations     || normalizeSubstations(INITIAL_SUBSTATIONS),
    networkProjects: saved?.networkProjects  || normalizeProjects(INITIAL_NETWORK_PROJECTS),
    activityLog:     saved?.activityLog     || [],
    savedAt:         saved?.savedAt         || null,
    hasSession:      !!saved,
  };
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ── Export JSON ─────────────────────────────────────────────────────────────

export function exportJSON(substations, networkProjects = [], activityLog = []) {
  const data = JSON.stringify({
    version:    STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    substations,
    networkProjects,
    activityLog,
  }, null, 2);
  _triggerDownload(data, `resa-capacite-${_today()}.json`, 'application/json');
}

// ── Export CSV ──────────────────────────────────────────────────────────────

export function exportCSV(substations, networkProjects = []) {
  const header = [
    'Sous-station', 'Code', 'Commune', 'Cap.N-1 (MVA)', 'Cap.Inverse.N-1 (MVA)',
    ...YEARS.flatMap(y => [
      `CapDirN1_${y}`, `CapRevN1_${y}`,
      `WRigid_${y}`, `WTotal_${y}`,
      `InjRigid_${y}`, `InjTotal_${y}`,
      `ResW_${y}`, `ResI_${y}`,
      `UtilW_${y}`, `UtilI_${y}`,
    ]),
  ].join(';');

  const rows = substations.map(s => {
    const cols = [
      s.name, s.code, s.commune,
      getDirectCapacityN1AtYear(s, YEARS[0], networkProjects).toFixed(1),
      getReverseCapacityN1AtYear(s, YEARS[0], networkProjects).toFixed(1),
    ];
    YEARS.forEach(y => {
      cols.push(
        getDirectCapacityN1AtYear(s, y, networkProjects).toFixed(2),
        getReverseCapacityN1AtYear(s, y, networkProjects).toFixed(2),
        getWithdrawalRigid(s, y, false, networkProjects).toFixed(2),
        getWithdrawalTotal(s, y, false, networkProjects).toFixed(2),
        getInjectionRigid(s, y, false, networkProjects).toFixed(2),
        getInjectionTotal(s, y, false, networkProjects).toFixed(2),
        getResidualWithdrawalRigid(s, y, networkProjects).toFixed(2),
        getResidualInjectionRigid(s, y, networkProjects).toFixed(2),
        (getUtilizationWithdrawalRigid(s, y, networkProjects) * 100).toFixed(1) + '%',
        (getUtilizationInjectionRigid(s, y, networkProjects) * 100).toFixed(1) + '%',
      );
    });
    return cols.join(';');
  });

  _triggerDownload(
    '\uFEFF' + [header, ...rows].join('\n'),
    `resa-export-${_today()}.csv`,
    'text/csv;charset=utf-8'
  );
}

// ── Import JSON ─────────────────────────────────────────────────────────────

export function importJSONFile(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.substations)
        throw new Error('Format invalide : propriété substations manquante.');

      if (d.version && d.version > STORAGE_VERSION)
        throw new Error(
          `Format v${d.version} détecté — version postérieure (actuelle : v${STORAGE_VERSION}).`
        );
      if (!d.version || d.version < STORAGE_VERSION)
        throw new Error('Format pré-v11 non importé automatiquement : repartez des données d’exemple ou exportez au format v11.');

      d.substations     = normalizeSubstations(d.substations);
      if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
      if (!d.activityLog) d.activityLog = [];
      onSuccess(d);
    } catch (err) { onError(err.message); }
  };
  reader.readAsText(file);
}

// ── Helpers privés ──────────────────────────────────────────────────────────

function _today() { return new Date().toISOString().slice(0, 10); }

function _triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
