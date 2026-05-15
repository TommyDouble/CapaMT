/**
 * services/storage.js
 * Source unique de vérité pour la persistance.
 *
 * Format v12 : { version, savedAt, substations, networkProjects, activityLog }
 * Les sessions pré-v12 sont volontairement ignorées : la refonte repart sur
 * des données d'exemple propres.
 */

import { STORAGE_KEY, YEARS } from '../constants/index.js';
import { normalizeSubstations, normalizeProjects } from '../utils/normalize.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../data/initial.js';
import {
  getWithdrawalRigid,
  getWithdrawalTotal,
  getInjectionRigid,
  getInjectionTotal,
  getDirectCapacityN1AtYear,
  getReverseCapacityN1AtYear,
  getResidualWithdrawalRigid,
  getResidualInjectionRigid,
  getUtilizationWithdrawalRigid,
  getUtilizationInjectionRigid,
} from '../engines/directionalSubstation.js';

const STORAGE_VERSION = 12;

// ── Persistance locale ──────────────────────────────────────────────────────

export function saveState(substations, networkProjects, activityLog) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        substations,
        networkProjects,
        activityLog,
      }),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isQuotaExceededError(error) ? 'quota' : 'unknown',
      error,
    };
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const d = JSON.parse(raw);

    if (!d.version || d.version < STORAGE_VERSION) return null;

    if (d.substations) d.substations = normalizeSubstations(d.substations);
    if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
    if (!d.activityLog) d.activityLog = [];
    return d;
  } catch (_) {
    return null;
  }
}

/**
 * Lit le storage une seule fois et retourne un objet initial complet.
 */
export function hydrateInitialAppState() {
  const saved = loadState();
  return {
    substations: saved?.substations || normalizeSubstations(INITIAL_SUBSTATIONS),
    networkProjects: saved?.networkProjects || normalizeProjects(INITIAL_NETWORK_PROJECTS),
    activityLog: saved?.activityLog || [],
    savedAt: saved?.savedAt || null,
    hasSession: !!saved,
  };
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

// ── Export JSON ─────────────────────────────────────────────────────────────

export function exportJSON(substations, networkProjects = [], activityLog = []) {
  const data = JSON.stringify(
    {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      substations,
      networkProjects,
      activityLog,
    },
    null,
    2,
  );
  _triggerDownload(data, `resa-capacite-${_today()}.json`, 'application/json');
}

// ── Export CSV ──────────────────────────────────────────────────────────────

export function exportCSV(substations, networkProjects = []) {
  _triggerDownload(
    '\uFEFF' + buildCSV(substations, networkProjects),
    `resa-export-${_today()}.csv`,
    'text/csv;charset=utf-8',
  );
}

export function buildCSV(substations, networkProjects = []) {
  const header = [
    'Sous-station',
    'Code',
    'Commune',
    'Cap.N-1 (MVA)',
    'Cap.Inverse.N-1 (MVA)',
    ...YEARS.flatMap((y) => [
      `CapDirN1_${y}`,
      `CapRevN1_${y}`,
      `WRigid_${y}`,
      `WTotal_${y}`,
      `InjRigid_${y}`,
      `InjTotal_${y}`,
      `ResW_${y}`,
      `ResI_${y}`,
      `UtilW_${y}`,
      `UtilI_${y}`,
    ]),
  ].map((value) => escapeCSVValue(value));

  const rows = substations.map((s) => {
    const cols = [
      s.name,
      s.code,
      s.commune,
      getDirectCapacityN1AtYear(s, YEARS[0], networkProjects).toFixed(1),
      getReverseCapacityN1AtYear(s, YEARS[0], networkProjects).toFixed(1),
    ];
    YEARS.forEach((y) => {
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
    return cols
      .map((value, index) => escapeCSVValue(value, { neutralizeFormula: index < 3 }))
      .join(';');
  });

  return [header.join(';'), ...rows].join('\n');
}

export function escapeCSVValue(value, { neutralizeFormula = false } = {}) {
  if (value == null) return '';

  let text = String(value);
  if (neutralizeFormula && /^[=+\-@]/.test(text.trimStart())) text = `'${text}`;

  if (/[;"\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

// ── Import JSON ─────────────────────────────────────────────────────────────

export function importJSONFile(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.substations) throw new Error('Format invalide : propriété substations manquante.');

      if (d.version && d.version > STORAGE_VERSION)
        throw new Error(
          `Format v${d.version} détecté — version postérieure (actuelle : v${STORAGE_VERSION}).`,
        );
      if (!d.version || d.version < STORAGE_VERSION)
        throw new Error(
          'Format pré-v12 non importé automatiquement : repartez des données d’exemple ou exportez au format v12.',
        );

      d.substations = normalizeSubstations(d.substations);
      if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
      if (!d.activityLog) d.activityLog = [];
      onSuccess(d);
    } catch (err) {
      onError(err.message);
    }
  };
  reader.readAsText(file);
}

// ── Helpers privés ──────────────────────────────────────────────────────────

function isQuotaExceededError(error) {
  return (
    error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error?.code === 22 ||
    error?.code === 1014
  );
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
