import { describe, it, expect } from 'vitest';
import { safeNum, safeDiv } from '../../src/utils/numbers.js';

describe('safeNum', () => {
  it('retourne la valeur pour un nombre valide', () => expect(safeNum(3.14, 0)).toBeCloseTo(3.14));
  it('retourne la valeur pour une string valide', () => expect(safeNum('42', 0)).toBe(42));
  it('retourne 0 (zéro) même si fallback défini', () => expect(safeNum(0, 99)).toBe(0));
  it('fallback sur NaN', () => expect(safeNum(NaN, 5)).toBe(5));
  it('fallback sur undefined', () => expect(safeNum(undefined, 7)).toBe(7));
  it('fallback sur string non numérique', () => expect(safeNum('abc', 3)).toBe(3));
  it('fallback sur null', () => expect(safeNum(null, 2)).toBe(2));
  it('accepte les négatifs', () => expect(safeNum(-5, 0)).toBe(-5));
});

describe('safeDiv', () => {
  it('division normale', () => expect(safeDiv(10, 2, 0)).toBe(5));
  it('fallback sur diviseur = 0', () => expect(safeDiv(10, 0, 99)).toBe(99));
  it('fallback sur diviseur = NaN', () => expect(safeDiv(10, NaN, 99)).toBe(99));
  it('fallback sur diviseur = Infinity', () => expect(safeDiv(10, Infinity, 0)).toBe(0));
  it('fallback par défaut = 0', () => expect(safeDiv(10, 0)).toBe(0));
  it('résultat exact', () => expect(safeDiv(1, 3, 0)).toBeCloseTo(0.333));
});
