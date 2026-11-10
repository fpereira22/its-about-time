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
