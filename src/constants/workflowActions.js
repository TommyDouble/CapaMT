/**
 * constants/workflowActions.js
 *
 * Registre central des codes d'action workflow pour le cycle d'étude.
 * Source de vérité unique pour : libellés UI, mapping source→action, dérivations contextuelles.
 *
 * Pour ajouter un code (ex. DEMANDER_AVIS_PROTECTION pour Icc) :
 *   1) ajouter une entrée dans ACTION_CODES
 *   2) ajouter l'entrée correspondante dans WORKFLOW_ACTIONS (avec fromSource si applicable)
 * Aucun autre fichier à toucher.
 */

export const ACTION_CODES = Object.freeze({
  DEMANDER_CAPAC:           'DEMANDER_CAPAC',
  ENCODER_RETOUR_CAPAC:     'ENCODER_RETOUR_CAPAC',
  COMPLETER_DONNEES_POSTE:  'COMPLETER_DONNEES_POSTE',
  FINALISER_ETUDE_RESEAU:   'FINALISER_ETUDE_RESEAU',
  COMPLETER_DONNEES:        'COMPLETER_DONNEES',
  TRAITER_BLOCAGE:          'TRAITER_BLOCAGE',
});

/**
 * @typedef {Object} WorkflowAction
 * @property {string} code
 * @property {string} label              libellé FR (panneau d'étude, tooltip cockpit)
 * @property {string|null} fromSource    code SOURCE (UPSTREAM/SUBSTATION/NETWORK) qui mène à cette action,
 *                                        ou null si l'action n'est pas dérivée d'une source
 */

/** @type {Readonly<Record<string, WorkflowAction>>} */
export const WORKFLOW_ACTIONS = Object.freeze({
  DEMANDER_CAPAC:          { code: 'DEMANDER_CAPAC',          label: 'Demande CAPAC à effectuer',      fromSource: 'UPSTREAM'   },
  ENCODER_RETOUR_CAPAC:    { code: 'ENCODER_RETOUR_CAPAC',    label: 'Encoder retour CAPAC',           fromSource: null         },
  COMPLETER_DONNEES_POSTE: { code: 'COMPLETER_DONNEES_POSTE', label: 'Compléter local / sous-station', fromSource: 'SUBSTATION' },
  FINALISER_ETUDE_RESEAU:  { code: 'FINALISER_ETUDE_RESEAU',  label: 'Finaliser réseau MT',            fromSource: 'NETWORK'    },
  COMPLETER_DONNEES:       { code: 'COMPLETER_DONNEES',       label: 'Compléter les données',          fromSource: null         },
  TRAITER_BLOCAGE:         { code: 'TRAITER_BLOCAGE',         label: 'Traiter le blocage',             fromSource: null         },
});

const SOURCE_TO_ACTION = Object.fromEntries(
  Object.values(WORKFLOW_ACTIONS)
    .filter(action => action.fromSource)
    .map(action => [action.fromSource, action.code])
);

export function actionForSource(source) {
  return SOURCE_TO_ACTION[source] || ACTION_CODES.COMPLETER_DONNEES;
}

/**
 * Dérivation contextuelle : DEMANDER_CAPAC + capac.status === 'SENT'
 * ⇒ ENCODER_RETOUR_CAPAC (l'action n'est plus "demander" mais "encoder le retour").
 * @param {string} code
 * @param {{ assessment?: { capac?: { status?: string } } }} [ctx]
 */
export function resolveAction(code, ctx = {}) {
  if (code === ACTION_CODES.DEMANDER_CAPAC && ctx.assessment?.capac?.status === 'SENT') {
    return ACTION_CODES.ENCODER_RETOUR_CAPAC;
  }
  return code;
}

export function getActionLabel(code, ctx) {
  const meta = WORKFLOW_ACTIONS[resolveAction(code, ctx)];
  return meta ? meta.label : code;
}

/**
 * Lit la liste des actions en attente sur un assessment.
 * `nextAction` (singulier) en plus du `nextActions` (pluriel) actuel.
 */
export function readNextActions(assessment = {}) {
  if (Array.isArray(assessment.nextActions) && assessment.nextActions.length) {
    return assessment.nextActions;
  }
  return assessment.nextAction ? [assessment.nextAction] : [];
}
