/**
 * Los sonidos de emoción de las viñetas (src/art/vinetas_sonido.ts): que la tabla nombre viñetas y efectos que
 * existen (un id con typo se quedaría mudo sin avisar) y que el sonido sacado de un Spec elija bien.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SFX } from '../src/audio/sfxDefs';
import { cuesFromSpec, MOODS, VINETA_CUES } from '../src/art/vinetas_sonido';
import { Content } from '../src/systems/Content';
import { vinetaIds } from '../src/ui/Vineta';

beforeAll(async () => {
  await Content.load();
});

/** Un AudioContext de mentira: cualquier método o propiedad devuelve otro proxy (así se ejecuta el código del sintetizador). */
function fakeAudio(): unknown {
  const handler: ProxyHandler<() => void> = {
    get: (_t, key) => (key === 'sampleRate' ? 44100 : key === Symbol.toPrimitive ? () => 0 : fake()),
    set: () => true,
    apply: () => fake(),
  };
  const fake = (): unknown => new Proxy(() => undefined, handler);
  return fake();
}

describe('sonidos de las viñetas', () => {
  it('los efectos nuevos se sintetizan sin errores', () => {
    const names = ['amor', 'ternura', 'chispa', 'suspiro', 'llanto', 'triste', 'susto', 'suspenso', 'escalofrio', 'sorpresa', 'risa'] as const;
    const ctx = fakeAudio() as AudioContext;
    for (const name of names) expect(() => SFX[name](ctx, 0, ctx.destination), name).not.toThrow();
  });

  it('cada viñeta de la tabla existe', () => {
    const ids = new Set(vinetaIds());
    const missing = Object.keys(VINETA_CUES).filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('cada efecto de la tabla está definido y los tiempos son válidos', () => {
    const bad: string[] = [];
    const tables = { ...VINETA_CUES, ...MOODS };
    for (const [id, cues] of Object.entries(tables)) {
      for (const [ms, sfx] of cues) {
        if (!(sfx in SFX)) bad.push(`${id}: sfx "${sfx}" no existe`);
        if (!(ms >= 0 && ms < 6000)) bad.push(`${id}: ${ms} ms fuera de rango`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('el sonido de un Spec sale de lo que muestra', () => {
    expect(cuesFromSpec({ c: ['player closed', 'laura closed'], fx: ['hearts', 'stars'] })).toBe(MOODS.beso);
    expect(cuesFromSpec({ c: ['player cry'] })).toBe(MOODS.llanto);
    expect(cuesFromSpec({ c: ['player smile'], fx: 'hearts' })).toBe(MOODS.amor);
    expect(cuesFromSpec({ c: ['player blush', 'laura blush'], fx: 'heart1' })).toBe(MOODS.chispa);
    expect(cuesFromSpec({ c: ['juanpa open'], fx: 'sweat' })).toBe(MOODS.nervios);
    expect(cuesFromSpec({ c: ['juanpa snore'], fx: 'zzz' })).toBe(MOODS.suspiro);
    expect(cuesFromSpec({ c: ['player smile'] })).toBeUndefined();
    // Dos con los ojos cerrados pero sin corazones no es un beso.
    expect(cuesFromSpec({ c: ['a closed', 'b closed'] })).toBeUndefined();
  });
});
