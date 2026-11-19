import { describe, expect, it, vi } from 'vitest';
import { EventSystem } from '../src/systems/EventSystem';
import { DEFAULT_SETTINGS, parseSettings, Settings, VOLUME_STEPS } from '../src/systems/Settings';

describe('parseSettings', () => {
  it('sin nada guardado usa los valores por defecto', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('recorta los volúmenes al rango y los redondea', () => {
    expect(parseSettings({ music: 42, sfx: -3 })).toMatchObject({ music: VOLUME_STEPS, sfx: 0 });
    expect(parseSettings({ music: 4.6 })).toMatchObject({ music: 5 });
  });

  it('ignora valores rotos', () => {
    expect(parseSettings({ music: 'fuerte', muted: 'si', textSpeed: 'turbo' })).toEqual(DEFAULT_SETTINGS);
  });

  it('respeta el silencio de la tecla M de antes de los ajustes', () => {
    expect(parseSettings(null, true).muted).toBe(true);
    expect(parseSettings({ muted: false }, true).muted).toBe(false);
  });

  it('las reseñas del título vienen visibles y se pueden ocultar', () => {
    expect(parseSettings(null).titleReviews).toBe(true);
    expect(parseSettings({ titleReviews: false }).titleReviews).toBe(false);
    expect(parseSettings({ titleReviews: 'no' }).titleReviews).toBe(true);
  });
});

describe('Settings', () => {
  it('lee el silencio guardado con la clave antigua', () => {
    window.localStorage.setItem('santiago-laberinto:mute', '1');
    Settings.reload();
    expect(Settings.get('muted')).toBe(true);
  });

  it('guarda cada cambio y avisa con settings-changed', () => {
    Settings.reload();
    const changed = vi.fn();
    const off = EventSystem.on('settings-changed', changed);
    Settings.set('music', 3);
    Settings.set('music', 3); // sin cambio: no avisa de nuevo
    off();
    expect(changed).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(window.localStorage.getItem('santiago-laberinto:settings') ?? '{}') as { music: number };
    expect(stored.music).toBe(3);
    expect(Settings.musicGain()).toBeCloseTo(0.3);
  });

  it('no deja salir los volúmenes del rango', () => {
    Settings.reload();
    Settings.set('sfx', VOLUME_STEPS + 5);
    expect(Settings.get('sfx')).toBe(VOLUME_STEPS);
    Settings.set('sfx', -1);
    expect(Settings.get('sfx')).toBe(0);
  });

  it('la velocidad instantánea muestra el texto de una', () => {
    Settings.reload();
    expect(Settings.charsPerSecond()).toBe(55);
    Settings.set('textSpeed', 'instantanea');
    expect(Settings.charsPerSecond()).toBe(Infinity);
    expect(Settings.textSpeedName()).toBe('Instantánea');
  });
});

describe('accesibilidad y teclas', () => {
  it('por defecto: texto normal, efectos completos, tutoriales y teclas de fábrica', () => {
    const d = parseSettings(null);
    expect(d).toMatchObject({ bigText: false, reduceEffects: false, tutorials: true, keys: {} });
  });

  it('descarta teclas inválidas, reservadas, repetidas o iguales a la de fábrica', () => {
    const d = parseSettings({ keys: { up: 'KeyI', down: 'Escape', left: 'KeyI', right: 'KeyD', interact: 'F5', phone: 'KeyP', bogus: 'KeyZ' } });
    expect(d.keys).toEqual({ up: 'KeyI' });
  });

  it('asignar una tecla usada por otra acción las intercambia', () => {
    Settings.reload();
    Settings.resetKeys();
    expect(Settings.setKey('interact', 'KeyQ')).toBe(true);
    expect(Settings.keyFor('interact')).toBe('KeyQ');
    expect(Settings.keyFor('phone')).toBe('KeyE');
    Settings.resetKeys();
    expect(Settings.keyFor('phone')).toBe('KeyQ');
  });

  it('no deja asignar teclas reservadas (Esc, M, P, Enter...)', () => {
    Settings.resetKeys();
    for (const code of ['Escape', 'KeyM', 'KeyP', 'Enter', 'Space', 'F2', 'ArrowUp']) expect(Settings.setKey('up', code)).toBe(false);
    expect(Settings.keyFor('up')).toBe('KeyW');
  });
});
