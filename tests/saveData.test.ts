import { describe, expect, it, vi } from 'vitest';
import { migrateSave, SAVE_VERSION, type SaveData } from '../src/systems/SaveData';
import { StoryState } from '../src/systems/StoryState';

const SAVE_KEY = 'santiago-laberinto:save';

/** Partida como la guardaban las versiones anteriores (v1): sin los campos que se sumaron después. */
function v1Save(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    flags: ['mision1_metro'],
    items: { bip: 1, sopaipilla: 2 },
    money: 2500,
    bip: 700,
    playTimeMs: 61_000,
    objective: 'Llega al Costanera',
    location: { map: 'providencia', spawn: 'inicio' },
    ...extra,
  };
}

describe('migrateSave', () => {
  it('completa con valores por defecto una partida v1 sin los campos nuevos', () => {
    expect(migrateSave(v1Save())).toMatchObject({
      version: SAVE_VERSION,
      flags: ['mision1_metro'],
      money: 2500,
      phone: [],
      mission: 'mission01',
      clock: 0,
      clockMax: 0,
      outfit: null,
      weather: 'despejado',
    });
  });

  it('conserva los campos que una partida v1 sí tenía', () => {
    const phone = [{ id: 'm1', read: true, at: 10 }];
    const save = migrateSave(v1Save({ phone, mission: 'mission04', clock: 500, weather: 'lluvia' }));
    expect(save).toMatchObject({ phone, mission: 'mission04', clock: 500, clockMax: 500, weather: 'lluvia' });
  });

  it('deja pasar una partida de la versión actual sin cambios', () => {
    const current = migrateSave(v1Save()) as SaveData;
    expect(migrateSave(structuredClone(current))).toEqual(current);
  });

  it('rechaza partidas de una versión futura', () => {
    expect(migrateSave({ ...migrateSave(v1Save()), version: SAVE_VERSION + 1 })).toBeNull();
  });

  it.each([
    ['null', null],
    ['un texto', 'hola'],
    ['un arreglo', []],
    ['sin versión', { flags: [] }],
    ['versión 0', { ...v1Save(), version: 0 }],
    ['versión no entera', { ...v1Save(), version: 1.5 }],
    ['flags que no son texto', v1Save({ flags: [1, 2] })],
    ['plata que no es número', v1Save({ money: '3000' })],
    ['ítems con cantidades inválidas', v1Save({ items: { bip: 'uno' } })],
    ['clima desconocido', v1Save({ weather: 'nieve' })],
    ['ubicación rota', v1Save({ location: { map: 'providencia' } })],
  ])('rechaza %s', (_name, raw) => {
    expect(migrateSave(raw)).toBeNull();
  });
});

describe('StoryState', () => {
  it('guarda y restaura la partida, sin las flags temporales', () => {
    StoryState.newGame('mission02', { money: 1234, flags: ['parte'], clock: 600 });
    StoryState.setFlag('visto');
    StoryState.setFlag('_temporal');
    StoryState.receiveMessage('hola');
    const saved = StoryState.snapshot();

    StoryState.newGame('mission01');
    expect(StoryState.hasFlag('visto')).toBe(false);
    expect(StoryState.restore(saved)).toBe(true);
    expect(StoryState.missionId).toBe('mission02');
    expect(StoryState.money).toBe(1234);
    expect(StoryState.clock).toBe(600);
    expect(StoryState.phone.map((p) => p.id)).toEqual(['hola']);
    expect(StoryState.hasFlag('visto')).toBe(true);
    // Las flags con "_" son temporales (puertas abiertas, timbre) y no se guardan.
    expect(StoryState.hasFlag('_temporal')).toBe(false);
  });

  it('carga la partida automática de una versión anterior y la reescribe en la actual', () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(v1Save()));
    expect(StoryState.hasSave()).toBe(true);
    expect(StoryState.load()).toBe(true);
    expect(StoryState.missionId).toBe('mission01');
    expect(StoryState.itemCount('sopaipilla')).toBe(2);
    const stored = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? '{}') as { version: number };
    expect(stored.version).toBe(SAVE_VERSION);
  });

  it('ignora una partida automática corrupta', () => {
    window.localStorage.setItem(SAVE_KEY, '{no es json');
    expect(StoryState.hasSave()).toBe(false);
    expect(StoryState.load()).toBe(false);
  });

  it('cobra solo si alcanza la plata o el saldo', () => {
    StoryState.newGame('mission01', { money: 500 });
    expect(StoryState.spend(800)).toBe(false);
    expect(StoryState.money).toBe(500);
    expect(StoryState.spend(500)).toBe(true);
    expect(StoryState.payBip(1)).toBe(false);
    StoryState.chargeBip(1000);
    expect(StoryState.payBip(760)).toBe(true);
    expect(StoryState.bip).toBe(240);
  });

  it('el reloj de la historia no pasa de su tope', () => {
    StoryState.newGame('mission02');
    StoryState.setClock(100, 102);
    StoryState.tick(60_000); // 15 minutos de juego
    expect(StoryState.clock).toBe(102);
  });
});

describe('SaveSlots', () => {
  it('migra los espacios guardados con una versión anterior y descarta los que no sirven', async () => {
    const slot = { state: v1Save(), pos: { x: 3, y: 4, facing: 'down' }, place: 'Providencia', savedAt: 1 };
    window.localStorage.setItem('santiago-laberinto:slots', JSON.stringify([slot, { state: { version: 99 } }, 'basura']));
    // SaveSlots lee el almacenamiento al importarse: módulos nuevos para este test.
    vi.resetModules();
    const { SaveSlots } = await import('../src/systems/SaveSlots');
    expect(SaveSlots.summary(0)).toMatchObject({ place: 'Providencia', playTime: '01:01' });
    expect(SaveSlots.summary(1)).toBeNull();
    expect(SaveSlots.summary(2)).toBeNull();
  });
});
