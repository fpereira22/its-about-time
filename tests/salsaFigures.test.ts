import { describe, expect, it } from 'vitest';
import { BAR, BASICS, FAST, FIGURES, TURNS, legend, mix, routine, type FigureId } from '../src/systems/salsaFigures';

const IDS = Object.keys(FIGURES) as FigureId[];

describe('figuras de salsa', () => {
  it('cada figura cabe en un compás, en orden y con al menos medio tiempo entre pasos', () => {
    for (const id of IDS) {
      const beats = FIGURES[id].notes.map(([b]) => b);
      expect(beats[0]).toBe(0);
      expect(Math.max(...beats)).toBeLessThan(BAR);
      for (let i = 1; i < beats.length; i++) expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('routine pone cada figura en su compás y anota dónde empieza', () => {
    const c = routine('basico', 'cambio', 'giro');
    expect(c.figs).toEqual([
      { beat: 0, id: 'basico' },
      { beat: 8, id: 'cambio' },
      { beat: 16, id: 'giro' },
    ]);
    expect(c.notes.filter(([, k]) => k === 'up')).toEqual([[12, 'up']]);
    expect(c.notes.filter(([, k]) => k === 'down')).toEqual([[20, 'down']]);
  });

  it('mix respeta las fijas y nunca repite la misma figura dos veces seguidas', () => {
    for (let n = 0; n < 200; n++) {
      const c = mix(['cambio', 'giro'], ['vuelta', 'giro', 'cortados'], 4);
      const ids = c.figs.map((f) => f.id);
      expect(ids.slice(0, 2)).toEqual(['cambio', 'giro']);
      expect(ids).toHaveLength(6);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });

  it('las rondas traen las figuras nuevas y la leyenda dice solo las teclas que se usan', () => {
    expect(legend(BASICS().notes, false)).toBe('A / D: pasos');
    const turns = TURNS();
    expect(turns.figs.map((f) => f.id)).toContain('cambio');
    expect(legend(turns.notes, false)).toBe('A / D: pasos · E: vuelta · W: cambio');
    const fast = FAST();
    expect(fast.figs.map((f) => f.id)).toContain('giro');
    expect(legend(fast.notes, true)).toContain('S: giro');
  });
});
