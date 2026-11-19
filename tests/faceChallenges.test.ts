import { describe, expect, it } from 'vitest';
import {
  advanceHold,
  challengeById,
  FACE_CHALLENGES,
  HEAD_RANGE,
  headToPaddle,
  HOLD_MS,
  PASS_SCORE,
  pickChallenges,
  rebaseCenter,
  ROUND_MS,
  roundPoints,
  smashEdge,
  SMASH_CLOSE,
  SMASH_OPEN,
  verdict,
  type Shapes,
} from '../src/systems/faceChallenges';

const neutral: Shapes = { mouthSmileLeft: 0.02, mouthSmileRight: 0.02, jawOpen: 0.03, browInnerUp: 0.05, mouthPucker: 0.04, eyeBlinkLeft: 0.08, eyeBlinkRight: 0.08 };
const score = (id: Parameters<typeof challengeById>[0], s: Shapes): number => challengeById(id).score(s);

describe('retos de caras', () => {
  it('cada reto da entre 0 y 1 con cualquier cara, incluso sin datos', () => {
    for (const c of FACE_CHALLENGES) {
      for (const s of [{}, neutral, { jawOpen: 5, mouthSmileLeft: -2, cheekPuff: 9 }]) {
        const n = c.score(s);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('una cara neutra no pasa ninguna cara con gesto, pero sí la de póker', () => {
    for (const c of FACE_CHALLENGES) {
      if (c.id === 'poker') expect(c.score(neutral)).toBeGreaterThanOrEqual(PASS_SCORE);
      else expect(c.score(neutral)).toBeLessThan(PASS_SCORE);
    }
  });

  it('cada gesto marcado pasa su reto', () => {
    expect(score('sonrisa', { mouthSmileLeft: 0.7, mouthSmileRight: 0.65 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('boca', { jawOpen: 0.6 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('cejas', { browInnerUp: 0.7, browOuterUpLeft: 0.7, browOuterUpRight: 0.7 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('besito', { mouthPucker: 0.7 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('mejillas', { cheekPuff: 0.5 })).toBeGreaterThanOrEqual(PASS_SCORE);
  });

  it('el guiño vale con cualquiera de los dos ojos, pero no con un parpadeo de los dos', () => {
    expect(score('guino', { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.05 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('guino', { eyeBlinkLeft: 0.05, eyeBlinkRight: 0.9 })).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(score('guino', { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 })).toBeLessThan(PASS_SCORE);
  });

  it('el besito no cuenta si además sonríes, y la cara de póker se arruina con cualquier gesto', () => {
    expect(score('besito', { mouthPucker: 0.6, mouthSmileLeft: 0.8, mouthSmileRight: 0.8 })).toBeLessThan(PASS_SCORE);
    expect(score('poker', { ...neutral, mouthSmileLeft: 0.4, mouthSmileRight: 0.4 })).toBeLessThan(PASS_SCORE);
    expect(score('poker', { ...neutral, jawOpen: 0.4 })).toBeLessThan(PASS_SCORE);
  });

  it('los ids son únicos y cada reto tiene textos y blendshapes que mirar', () => {
    expect(new Set(FACE_CHALLENGES.map((c) => c.id)).size).toBe(FACE_CHALLENGES.length);
    for (const c of FACE_CHALLENGES) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
      expect(c.keys.length).toBeGreaterThan(0);
      expect(c.holdMs).toBeGreaterThan(0);
    }
  });
});

describe('advanceHold', () => {
  it('suma mientras se hace la cara y se detiene en lo que pide el reto', () => {
    let held = 0;
    for (let i = 0; i < 100; i++) held = advanceHold(held, 1, 50, HOLD_MS);
    expect(held).toBe(HOLD_MS);
  });

  it('si se pierde la cara baja al doble de rápido y nunca pasa de cero', () => {
    expect(advanceHold(400, 0.2, 100, HOLD_MS)).toBe(200);
    expect(advanceHold(100, 0.2, 100, HOLD_MS)).toBe(0);
  });

  it('un puntaje justo en el mínimo cuenta', () => {
    expect(advanceHold(0, PASS_SCORE, 100, HOLD_MS)).toBe(100);
  });
});

describe('puntos y veredicto', () => {
  it('hacer la cara vale 100 y la rapidez suma hasta 100 más', () => {
    expect(roundPoints(0)).toBe(100);
    expect(roundPoints(ROUND_MS)).toBe(200);
    expect(roundPoints(ROUND_MS / 2)).toBe(150);
    expect(roundPoints(-500)).toBe(100);
  });

  it('el veredicto sube con los puntos', () => {
    const texts = [0, 400, 900, 1300].map((p) => verdict(p, 7));
    expect(new Set(texts).size).toBe(4);
  });
});

describe('pickChallenges', () => {
  it('da retos distintos, tantos como se piden (hasta los que hay)', () => {
    const picked = pickChallenges(7);
    expect(new Set(picked.map((c) => c.id)).size).toBe(7);
    expect(pickChallenges(99)).toHaveLength(FACE_CHALLENGES.length);
    expect(pickChallenges(3)).toHaveLength(3);
  });

  it('con el mismo azar da el mismo orden', () => {
    const rng = (): number => 0.3;
    expect(pickChallenges(7, rng).map((c) => c.id)).toEqual(pickChallenges(7, rng).map((c) => c.id));
  });
});

describe('control con la cabeza', () => {
  it('con la cabeza en el centro la paleta va al medio de la mesa', () => {
    expect(headToPaddle(0.5, 0.5, 100, 200)).toBe(150);
    expect(headToPaddle(0.62, 0.62, 100, 200)).toBe(150);
  });

  it('mover la cabeza hacia tu derecha mueve la paleta a la derecha, hasta el borde y sin pasarse', () => {
    expect(headToPaddle(0.5 + HEAD_RANGE / 2, 0.5, 100, 200)).toBeCloseTo(175);
    expect(headToPaddle(0.5 + HEAD_RANGE, 0.5, 100, 200)).toBe(200);
    expect(headToPaddle(0.5 - HEAD_RANGE, 0.5, 100, 200)).toBe(100);
    expect(headToPaddle(1.5, 0.5, 100, 200)).toBe(200);
    expect(headToPaddle(-1, 0.5, 100, 200)).toBe(100);
  });

  it('el remate con la boca dispara una vez y exige cerrarla para repetir', () => {
    let state = smashEdge(0.1, false);
    expect(state).toEqual({ open: false, fired: false });
    state = smashEdge(SMASH_OPEN, state.open);
    expect(state).toEqual({ open: true, fired: true });
    state = smashEdge(0.9, state.open);
    expect(state.fired).toBe(false);
    state = smashEdge((SMASH_OPEN + SMASH_CLOSE) / 2, state.open);
    expect(state.open).toBe(true);
    state = smashEdge(SMASH_CLOSE, state.open);
    expect(state).toEqual({ open: false, fired: false });
    expect(smashEdge(0.8, state.open).fired).toBe(true);
  });
});

describe('rebaseCenter', () => {
  it('deja a la cabeza actual justo donde está la paleta (sin salto al soltar el teclado)', () => {
    for (const [headX, paddleX] of [[0.5, 160], [0.4, 120], [0.62, 200], [0.3, 100]] as const) {
      const center = rebaseCenter(headX, paddleX, 100, 200);
      expect(headToPaddle(headX, center, 100, 200)).toBeCloseTo(Math.min(200, Math.max(100, paddleX)), 5);
    }
  });
});
