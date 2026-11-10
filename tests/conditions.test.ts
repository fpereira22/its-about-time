import { beforeEach, describe, expect, it } from 'vitest';
import { check } from '../src/systems/Conditions';
import { StoryState } from '../src/systems/StoryState';

describe('check (condiciones de la historia)', () => {
  beforeEach(() => {
    StoryState.newGame('mission03', { money: 2000, flags: ['a', 'b'] });
    StoryState.addItem('sopaipilla');
    StoryState.chargeBip(500);
    StoryState.location = { map: 'paine', spawn: 'inicio' };
  });

  it('sin condición es verdadera', () => {
    expect(check(undefined)).toBe(true);
    expect(check(null)).toBe(true);
    expect(check({})).toBe(true);
  });

  it('flags: todas deben estar (flag) y ninguna (notFlag)', () => {
    expect(check({ flag: 'a' })).toBe(true);
    expect(check({ flag: ['a', 'b'] })).toBe(true);
    expect(check({ flag: ['a', 'c'] })).toBe(false);
    expect(check({ notFlag: 'c' })).toBe(true);
    expect(check({ notFlag: ['c', 'b'] })).toBe(false);
  });

  it('ítems, plata y saldo', () => {
    expect(check({ hasItem: 'sopaipilla' })).toBe(true);
    expect(check({ hasItem: 'empanada' })).toBe(false);
    expect(check({ notItem: 'empanada' })).toBe(true);
    expect(check({ minMoney: 2000 })).toBe(true);
    expect(check({ minMoney: 2001 })).toBe(false);
    expect(check({ minBip: 500 })).toBe(true);
    expect(check({ minBip: 501 })).toBe(false);
  });

  it('misión y mapa actuales', () => {
    expect(check({ mission: 'mission03' })).toBe(true);
    expect(check({ mission: ['mission01', 'mission03'] })).toBe(true);
    expect(check({ mission: 'mission04' })).toBe(false);
    expect(check({ map: 'paine' })).toBe(true);
    expect(check({ map: ['providencia'] })).toBe(false);
  });

  it('combina con all, any y not', () => {
    expect(check({ any: [{ flag: 'x' }, { flag: 'a' }] })).toBe(true);
    expect(check({ any: [{ flag: 'x' }, { flag: 'y' }] })).toBe(false);
    expect(check({ all: [{ flag: 'a' }, { minMoney: 100 }] })).toBe(true);
    expect(check({ all: [{ flag: 'a' }, { minMoney: 9999 }] })).toBe(false);
    expect(check({ not: { flag: 'x' } })).toBe(true);
    expect(check({ flag: 'a', not: { any: [{ flag: 'b' }] } })).toBe(false);
  });
});
