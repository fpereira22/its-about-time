import { beforeEach, describe, expect, it } from 'vitest';
import { Chemistry, levelFlag, levelFor, MAX_LEVEL, parseChemistry } from '../src/systems/Chemistry';
import { StoryState } from '../src/systems/StoryState';

describe('Chemistry', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Chemistry.reload();
    StoryState.newGame('mission06');
  });

  it('parte en nivel 1 y sube de a uno con cada misión llena, hasta el tope', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(2)).toBe(3);
    expect(levelFor(99)).toBe(MAX_LEVEL);
  });

  it('llenar el medidor sube el nivel una sola vez por misión', () => {
    expect(Chemistry.reachFull('sira', 'mission06', false)).toBe(true);
    expect(Chemistry.level('sira')).toBe(2);
    expect(Chemistry.reachFull('sira', 'mission06', false)).toBe(false);
    expect(Chemistry.level('sira')).toBe(2);
    expect(Chemistry.level('laura')).toBe(1);
    Chemistry.reachFull('sira', 'mission07', false);
    expect(Chemistry.level('sira')).toBe(3);
  });

  it('deja el nivel como flags para los diálogos', () => {
    Chemistry.reachFull('laura', 'mission08', false);
    expect(StoryState.hasFlag(levelFlag('laura', 2))).toBe(true);
    expect(StoryState.hasFlag(levelFlag('laura', 3))).toBe(false);
    expect(StoryState.hasFlag(levelFlag('sira', 2))).toBe(false);
  });

  it('el nivel sobrevive a una partida nueva (las flags se vuelven a poner)', () => {
    Chemistry.reachFull('sira', 'mission06', false);
    StoryState.newGame('mission07');
    expect(StoryState.hasFlag(levelFlag('sira', 2))).toBe(false);
    Chemistry.syncFlags();
    expect(StoryState.hasFlag(levelFlag('sira', 2))).toBe(true);
  });

  it('se guarda y se lee, y lo roto no estorba', () => {
    Chemistry.reachFull('sira', 'mission06', false);
    Chemistry.reload();
    expect(Chemistry.level('sira')).toBe(2);
    expect(parseChemistry({ sira: ['mission06', 'mission06', 7, 'otra'], laura: 'x' })).toEqual({ sira: ['mission06'], laura: [] });
  });
});
