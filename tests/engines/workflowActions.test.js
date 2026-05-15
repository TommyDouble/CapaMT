import { describe, it, expect } from 'vitest';
import {
  ACTION_CODES,
  WORKFLOW_ACTIONS,
  actionForSource,
  resolveAction,
  getActionLabel,
  readNextActions,
} from '../../src/constants/workflowActions.js';

describe('workflowActions registry', () => {
  describe('actionForSource', () => {
    it('mappe UPSTREAM → DEMANDER_CAPAC', () => {
      expect(actionForSource('UPSTREAM')).toBe(ACTION_CODES.DEMANDER_CAPAC);
    });

    it('mappe SUBSTATION → COMPLETER_DONNEES_POSTE', () => {
      expect(actionForSource('SUBSTATION')).toBe(ACTION_CODES.COMPLETER_DONNEES_POSTE);
    });

    it('mappe NETWORK → FINALISER_ETUDE_RESEAU', () => {
      expect(actionForSource('NETWORK')).toBe(ACTION_CODES.FINALISER_ETUDE_RESEAU);
    });

    it('retombe sur COMPLETER_DONNEES pour une source inconnue', () => {
      expect(actionForSource('UNKNOWN')).toBe(ACTION_CODES.COMPLETER_DONNEES);
      expect(actionForSource(undefined)).toBe(ACTION_CODES.COMPLETER_DONNEES);
    });
  });

  describe('resolveAction', () => {
    it('retourne le code tel quel par défaut', () => {
      expect(resolveAction(ACTION_CODES.DEMANDER_CAPAC)).toBe(ACTION_CODES.DEMANDER_CAPAC);
      expect(resolveAction(ACTION_CODES.TRAITER_BLOCAGE)).toBe(ACTION_CODES.TRAITER_BLOCAGE);
    });

    it("dérive DEMANDER_CAPAC en ENCODER_RETOUR_CAPAC quand capac.status === 'SENT'", () => {
      const ctx = { assessment: { capac: { status: 'SENT' } } };
      expect(resolveAction(ACTION_CODES.DEMANDER_CAPAC, ctx)).toBe(
        ACTION_CODES.ENCODER_RETOUR_CAPAC,
      );
    });

    it('ne dérive pas DEMANDER_CAPAC quand capac.status est différent', () => {
      const ctx = { assessment: { capac: { status: 'RECEIVED' } } };
      expect(resolveAction(ACTION_CODES.DEMANDER_CAPAC, ctx)).toBe(ACTION_CODES.DEMANDER_CAPAC);
    });

    it("ne dérive pas les autres codes même si capac.status === 'SENT'", () => {
      const ctx = { assessment: { capac: { status: 'SENT' } } };
      expect(resolveAction(ACTION_CODES.COMPLETER_DONNEES_POSTE, ctx)).toBe(
        ACTION_CODES.COMPLETER_DONNEES_POSTE,
      );
    });
  });

  describe('getActionLabel', () => {
    it('retourne le libellé FR du code', () => {
      expect(getActionLabel(ACTION_CODES.DEMANDER_CAPAC)).toBe('Demande CAPAC à effectuer');
      expect(getActionLabel(ACTION_CODES.TRAITER_BLOCAGE)).toBe('Traiter le blocage');
    });

    it('applique la dérivation contextuelle DEMANDER_CAPAC + SENT', () => {
      const ctx = { assessment: { capac: { status: 'SENT' } } };
      expect(getActionLabel(ACTION_CODES.DEMANDER_CAPAC, ctx)).toBe('Encoder retour CAPAC');
    });

    it('retourne le code brut pour un code inconnu', () => {
      expect(getActionLabel('CODE_INCONNU')).toBe('CODE_INCONNU');
    });
  });

  describe('readNextActions', () => {
    it('lit le tableau pluriel quand présent et non vide', () => {
      expect(readNextActions({ nextActions: ['A', 'B'] })).toEqual(['A', 'B']);
    });

    it('retombe sur le scalaire singulier quand le tableau est absent ou vide', () => {
      expect(readNextActions({ nextAction: 'A' })).toEqual(['A']);
      expect(readNextActions({ nextActions: [], nextAction: 'A' })).toEqual(['A']);
    });

    it('retourne un tableau vide quand rien n’est défini', () => {
      expect(readNextActions({})).toEqual([]);
      expect(readNextActions()).toEqual([]);
    });
  });

  describe('cohérence du registre', () => {
    it('tous les codes ACTION_CODES ont une entrée dans WORKFLOW_ACTIONS', () => {
      for (const code of Object.values(ACTION_CODES)) {
        expect(WORKFLOW_ACTIONS[code]).toBeDefined();
        expect(WORKFLOW_ACTIONS[code].code).toBe(code);
      }
    });

    it('chaque fromSource est unique parmi les actions', () => {
      const sources = Object.values(WORKFLOW_ACTIONS)
        .map((a) => a.fromSource)
        .filter(Boolean);
      expect(new Set(sources).size).toBe(sources.length);
    });
  });
});
