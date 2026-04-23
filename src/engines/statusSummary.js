/**
 * engines/statusSummary.js
 *
 * Couche de lecture métier au-dessus des statuts techniques existants.
 * Les statuts techniques (en_étude, étudiée, conditionnel, raccordée…)
 * restent inchangés dans le storage et les moteurs.
 *
 * Ce module les traduit en phases métier lisibles et en contexte narratif.
 *
 * Aucune dépendance React.
 */

/**
 * Phases métier dans l'ordre du cycle de vie.
 * Un statut technique peut appartenir à une seule phase.
 */
export const REQUEST_PHASES = {
  deposee:       { label: 'Déposée',        color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', order: 1 },
  analysee:      { label: 'Analysée',       color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', order: 2 },
  conditionnelle:{ label: 'Conditionnelle', color: '#92400e', bg: '#fffbeb', border: '#fde68a', order: 3 },
  acceptable:    { label: 'Acceptable',     color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', order: 4 },
  raccordee:     { label: 'Raccordée',      color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', order: 5 },
  integree:      { label: 'Intégrée à la base', color: '#4c1d95', bg: '#f5f3ff', border: '#c4b5fd', order: 6 },
  annulee:       { label: 'Annulée',        color: '#ef4444', bg: '#fef2f2', border: '#fecaca', order: 0, strike: true },
};

/** Mapping statut technique → phase métier */
const STATUS_TO_PHASE = {
  'en_étude':     'deposee',
  'étudiée':      'analysee',
  'conditionnel': 'conditionnelle',
  'raccordée':    'raccordee',
  'raccordé':     'raccordee',
  'annulée':      'annulee',
  'annulé':       'annulee',
};

/**
 * Résumé métier d'une demande de raccordement.
 *
 * @param {object} req - Demande de raccordement
 * @returns {RequestStatusSummary}
 */
export function buildRequestStatusSummary(req) {
  if (!req) return null;

  const status = req.status || 'en_étude';

  // Déterminer la phase métier
  let phaseKey = STATUS_TO_PHASE[status] ?? 'deposee';

  // Raffinement : une demande étudiée avec décision GRD acceptable → phase 'acceptable'
  if (phaseKey === 'analysee' && req.grd?.decisionGRD === 'acceptable') {
    phaseKey = 'acceptable';
  }

  // Raffinement : une demande raccordée dont la charge a été intégrée → phase 'integree'
  if (phaseKey === 'raccordee') {
    const hasHistory = (req.chargeHistoryId || req.integreeEnBase);
    if (hasHistory) phaseKey = 'integree';
  }

  const phase = REQUEST_PHASES[phaseKey];

  // Description contextuelle selon la phase
  const descriptions = {
    deposee:        'La demande a été reçue. L\'étude de raccordement n\'a pas encore débuté.',
    analysee:       'L\'étude est réalisée. Les paramètres GRD ont été définis.',
    conditionnelle: 'Le raccordement est conditionnel à un investissement réseau.',
    acceptable:     'La capacité est disponible. La convention peut être proposée.',
    raccordee:      'La convention est signée. Le client est raccordé.',
    integree:       'La charge est intégrée dans la baseline de la sous-station.',
    annulee:        'La demande a été annulée. La réservation est libérée.',
  };

  // Prochaine étape attendue
  const nextSteps = {
    deposee:        'Lancer l\'étude de raccordement.',
    analysee:       req.grd?.decisionGRD === 'liste_attente'
                      ? 'Demande en liste d\'attente — surveiller l\'évolution du résiduel.'
                      : 'Proposer la convention de raccordement.',
    conditionnelle: 'Valider le projet réseau associé avant de poursuivre.',
    acceptable:     'Envoyer la convention et saisir la date de signature.',
    raccordee:      'Confirmer la mise en service et intégrer la charge à la baseline.',
    integree:       null,
    annulee:        null,
  };

  return {
    // Technique
    statusTechnique: status,
    hasGrd:          !!req.grd,
    decisionGRD:     req.grd?.decisionGRD ?? null,
    // Métier
    phaseKey,
    phaseLabel:      phase.label,
    phaseColor:      phase.color,
    phaseBg:         phase.bg,
    phaseBorder:     phase.border,
    phaseOrder:      phase.order,
    strike:          !!phase.strike,
    // Narratif
    description:     descriptions[phaseKey],
    nextStep:        nextSteps[phaseKey] ?? null,
    // Dates clés disponibles
    dateDepot:       req.dateDepot   ?? null,
    dateOffre:       req.dateOffre   ?? null,
    dateMES:         req.dateMES     ?? null,
    raccordementDate: req.raccordementDate ?? null,
  };
}

/**
 * Résumé agrégé des phases pour une liste de demandes.
 * Utile pour les badges de synthèse en tête de page.
 *
 * @param {object[]} requests
 * @returns {{ byPhase: object, total: number }}
 */
export function buildQueuePhaseSummary(requests) {
  const byPhase = Object.fromEntries(
    Object.keys(REQUEST_PHASES).map(k => [k, 0])
  );
  let total = 0;
  (requests || []).forEach(req => {
    const s = buildRequestStatusSummary(req);
    if (s) { byPhase[s.phaseKey] = (byPhase[s.phaseKey] || 0) + 1; total++; }
  });
  return { byPhase, total };
}
