/**
 * Las figuras del baile de salsa (SalsaScene) y cómo se mezclan en una coreografía. Sin Phaser, para poder probarlas.
 *
 * Cada figura dura un compás de 8 tiempos (pasos en 1-2-3 y 5-6-7; el 4 y el 8 se descansan):
 *  - basico / lateral: el paso de siempre, empezando con un pie o con el otro.
 *  - vuelta / doble: ella gira bajo tu brazo (E), una vez o dos seguidas.
 *  - cambio: cambio de lugar agarrados de la mano (W): cada uno pasa al lado del otro.
 *  - giro: giramos los dos juntos, agarrados de las manos, una vuelta entera (S).
 *  - cortados: pasos rápidos a medio tiempo, a lo caleño.
 *  - zapateo: un paso en cada tiempo (el huaylas de Renzo).
 */

export type Step = 'left' | 'right' | 'interact' | 'up' | 'down';
export type FigureId = 'basico' | 'lateral' | 'vuelta' | 'doble' | 'cambio' | 'giro' | 'cortados' | 'zapateo';

/** Una coreografía: los pasos (tiempo, tecla) y dónde empieza cada figura (para anunciarla en la cinta). */
export interface Choreo {
  notes: Array<[number, Step]>;
  figs: Array<{ beat: number; id: FigureId }>;
}

export const BAR = 8;

export const FIGURES: Record<FigureId, { name: string; cue: string; notes: Array<[number, Step]> }> = {
  basico: { name: 'Básico', cue: '', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'right'], [5, 'left'], [6, 'right']] },
  lateral: { name: 'Lateral (con el otro pie)', cue: '', notes: [[0, 'right'], [1, 'left'], [2, 'right'], [4, 'left'], [5, 'right'], [6, 'left']] },
  vuelta: { name: 'La vuelta', cue: 'E', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'interact'], [5, 'left'], [6, 'right']] },
  doble: { name: 'Doble vuelta', cue: 'E', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'interact'], [6, 'interact']] },
  cambio: { name: 'Cambio de lugar', cue: 'W', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'up'], [5, 'left'], [6, 'right']] },
  giro: { name: 'Giramos juntos', cue: 'S', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'down']] },
  cortados: {
    name: 'Pasos cortados',
    cue: '',
    notes: [[0, 'left'], [1, 'right'], [2, 'left'], [2.5, 'right'], [3, 'left'], [4, 'right'], [5, 'left'], [5.5, 'right'], [6, 'left']],
  },
  zapateo: { name: 'Zapateo', cue: '', notes: [[0, 'left'], [1, 'right'], [2, 'left'], [3, 'right'], [4, 'left'], [5, 'right'], [6, 'left'], [7, 'right']] },
};

/** Una coreografía con las figuras en ese orden. */
export const routine = (...ids: FigureId[]): Choreo => ({
  notes: ids.flatMap((id, b) => FIGURES[id].notes.map(([beat, key]): [number, Step] => [beat + b * BAR, key])),
  figs: ids.map((id, b) => ({ beat: b * BAR, id })),
});

/**
 * Las figuras fijas al principio y después `extra` al azar del montón, sin repetir la misma dos veces seguidas.
 * `rand` es inyectable para probarlo.
 */
export const mix = (fixed: FigureId[], pool: FigureId[], extra: number, rand: () => number = Math.random): Choreo => {
  const ids = [...fixed];
  for (let i = 0; i < extra; i++) {
    const options = pool.filter((id) => id !== ids[ids.length - 1]);
    ids.push(options[Math.floor(rand() * options.length)]);
  }
  return routine(...ids);
};

/** Las tres rondas de siempre, con figuras que se van sumando. */
export const BASICS = (): Choreo => routine('basico', 'basico', 'lateral', 'basico');
export const TURNS = (): Choreo => mix(['basico', 'vuelta', 'cambio'], ['vuelta', 'doble', 'cambio'], 1);
export const FAST = (): Choreo => mix(['cambio', 'giro'], ['vuelta', 'doble', 'giro', 'cortados', 'cambio'], 3);

export const KEY_LABEL: Record<Step, string> = { left: 'A', right: 'D', interact: 'E', up: 'W', down: 'S' };
export const PRESS_KEYS: Step[] = ['left', 'right', 'interact', 'up', 'down'];
/** Lo que significa cada tecla, para la leyenda que arma sola cada ronda (según las figuras que trae). */
const KEY_MEANING: Record<Step, string> = {
  left: 'A / D: pasos',
  right: '',
  interact: 'E: vuelta',
  up: 'W: cambio',
  down: 'S: giro de a dos',
};
const KEY_SHORT: Record<Step, string> = { left: 'A / D', right: '', interact: 'E: vuelta', up: 'W: cambio', down: 'S: giro' };

/** «A / D: pasos · E: la vuelta...» solo con las teclas que esa ronda usa. */
export function legend(notes: Array<[number, Step]>, short: boolean): string {
  const used = new Set(notes.map(([, k]) => k));
  const table = short ? KEY_SHORT : KEY_MEANING;
  return PRESS_KEYS.filter((k) => used.has(k) && table[k]).map((k) => table[k]).join(' · ');
}
