import { beforeEach, describe, expect, it } from 'vitest';
import { DIARY, MINIGAMES, minigameId } from '../src/data/gallery';
import { prettify } from '../src/scenes/GalleryScene';
import { Gallery, parseGallery } from '../src/systems/Gallery';
import { getMission, MISSIONS } from '../src/systems/Mission';

describe('datos de la galería', () => {
  it('cada minijuego apunta a una misión y a una escena registrada, sin repetirse', () => {
    const scenes = new Set(['Futbol', 'Piscina', 'Cinco', 'Natacion', 'Persecucion', 'Cocina', 'Salsa', 'Pool', 'Pinpon', 'Atraccion', 'Parque', 'Cafe', 'Fiesta', 'Rio', 'Paseo']);
    const ids = MINIGAMES.map((g) => minigameId(g.scene, g.data));
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of MINIGAMES) {
      expect(() => getMission(g.mission), g.label).not.toThrow();
      expect(scenes.has(g.scene), `${g.label}: escena ${g.scene}`).toBe(true);
    }
  });

  it('el diario tiene una entrada por misión y ninguna de sobra', () => {
    expect(Object.keys(DIARY).sort()).toEqual(MISSIONS.map((m) => m.id).sort());
  });

  it('el id de un minijuego distingue modo, parte y rival', () => {
    expect(minigameId('Cocina', { part: 1 })).not.toBe(minigameId('Cocina', { part: 2 }));
    expect(minigameId('Pinpon', {})).toBe('Pinpon');
    expect(minigameId('Pinpon', { rival: 'laura' })).toBe('Pinpon:laura');
    expect(minigameId('Paseo', { mode: 'trocha' })).toBe('Paseo:trocha');
  });

  it('prettify deja el id legible', () => {
    expect(prettify('m7_depa_ventana')).toBe('Depa ventana');
    expect(prettify('casa-cocina')).toBe('Casa cocina');
  });
});

describe('Gallery', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Gallery.reload();
  });

  it('anota cada viñeta una sola vez, en orden, y sobrevive a recargar', () => {
    Gallery.seeVineta('a', 'mission02');
    Gallery.seeVineta('b', 'mission03');
    Gallery.seeVineta('a', 'mission04');
    expect(Gallery.vinetas.map((v) => v.id)).toEqual(['a', 'b']);
    Gallery.reload();
    expect(Gallery.vinetas).toEqual([{ id: 'a', mission: 'mission02' }, { id: 'b', mission: 'mission03' }]);
  });

  it('el modo libre y las pruebas no cuentan', () => {
    Gallery.seeVineta('x', 'sandbox');
    Gallery.markPlayed('Pool', 'sandbox');
    expect(Gallery.vinetas).toEqual([]);
    expect(Gallery.hasPlayed('Pool')).toBe(false);
  });

  it('un minijuego terminado queda como jugado', () => {
    Gallery.markPlayed('Pool', 'mission08');
    expect(Gallery.hasPlayed('Pool')).toBe(true);
    expect(Gallery.hasPlayed('Pinpon')).toBe(false);
  });

  it('descarta lo roto', () => {
    expect(parseGallery({ vinetas: [{ id: 'a', mission: 'x' }, { id: 'a' }, null, { id: 3 }], played: ['p', 'p', 4] })).toEqual({
      vinetas: [{ id: 'a', mission: '' }],
      played: ['p'],
    });
  });
});

describe('minijuegos sueltos y la partida', () => {
  it('con noSave los cambios no llegan al guardado, y restaurar deja la partida como estaba', async () => {
    const { StoryState } = await import('../src/systems/StoryState');
    window.localStorage.clear();
    StoryState.newGame('mission07');
    StoryState.setFlag('antes');
    const saved = window.localStorage.getItem('santiago-laberinto:save');
    const before = StoryState.snapshot();
    StoryState.noSave = true;
    StoryState.setFlag('m5_cinco_terminado');
    StoryState.setClock(5000, 5000);
    expect(window.localStorage.getItem('santiago-laberinto:save')).toBe(saved);
    StoryState.restore(before);
    StoryState.noSave = false;
    expect(StoryState.hasFlag('m5_cinco_terminado')).toBe(false);
    expect(StoryState.hasFlag('antes')).toBe(true);
    expect(StoryState.clock).toBe(before.clock);
    expect(window.localStorage.getItem('santiago-laberinto:save')).toBe(saved);
  });
});
