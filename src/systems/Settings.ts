import { EventSystem } from './EventSystem';

const SETTINGS_KEY = 'santiago-laberinto:settings';
/** Clave antigua de la tecla M (antes de los ajustes): se lee una vez para no perder la preferencia. */
const LEGACY_MUTE_KEY = 'santiago-laberinto:mute';

/** Pasos de los volúmenes: 0 (apagado) a VOLUME_STEPS (el volumen original del juego). */
export const VOLUME_STEPS = 10;

export type TextSpeed = 'lenta' | 'normal' | 'rapida' | 'instantanea';
export const TEXT_SPEEDS: readonly TextSpeed[] = ['lenta', 'normal', 'rapida', 'instantanea'];

/** Letras por segundo de la caja de diálogo (Infinity: aparece todo el texto de una). */
const CHARS_PER_SECOND: Record<TextSpeed, number> = { lenta: 30, normal: 55, rapida: 110, instantanea: Infinity };
const TEXT_SPEED_NAME: Record<TextSpeed, string> = { lenta: 'Lenta', normal: 'Normal', rapida: 'Rápida', instantanea: 'Instantánea' };

export interface SettingsData {
  /** Volumen de la música, 0 a VOLUME_STEPS. */
  music: number;
  /** Volumen de los efectos (y el ambiente: lluvia, viento), 0 a VOLUME_STEPS. */
  sfx: number;
  /** Silencio total (tecla M). */
  muted: boolean;
  textSpeed: TextSpeed;
}

export const DEFAULT_SETTINGS: Readonly<SettingsData> = { music: VOLUME_STEPS, sfx: VOLUME_STEPS, muted: false, textSpeed: 'normal' };

/** Ajustes guardados → valores válidos (lo que falte o venga roto queda por defecto). */
export function parseSettings(raw: unknown, legacyMuted = false): SettingsData {
  const d = typeof raw === 'object' && raw !== null ? (raw as Partial<Record<keyof SettingsData, unknown>>) : {};
  return {
    music: volume(d.music, DEFAULT_SETTINGS.music),
    sfx: volume(d.sfx, DEFAULT_SETTINGS.sfx),
    muted: typeof d.muted === 'boolean' ? d.muted : legacyMuted,
    textSpeed: TEXT_SPEEDS.includes(d.textSpeed as TextSpeed) ? (d.textSpeed as TextSpeed) : DEFAULT_SETTINGS.textSpeed,
  };
}

function volume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(VOLUME_STEPS, Math.round(v))) : fallback;
}

/**
 * Preferencias del jugador (menú Ajustes del título y de la pausa): volumen de música y efectos,
 * silencio y velocidad del texto. Se guardan en este navegador, aparte de la partida, y avisan
 * con el evento 'settings-changed' (lo escucha AudioManager).
 */
class SettingsImpl {
  private data: SettingsData = readSettings();

  get<K extends keyof SettingsData>(key: K): SettingsData[K] {
    return this.data[key];
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    const next = parseSettings({ ...this.data, [key]: value });
    if (next[key] === this.data[key]) return;
    this.data = next;
    this.save();
    EventSystem.emit('settings-changed');
  }

  /** Volumen de la música como factor 0..1 (sin contar el silencio). */
  musicGain(): number {
    return this.data.music / VOLUME_STEPS;
  }

  sfxGain(): number {
    return this.data.sfx / VOLUME_STEPS;
  }

  charsPerSecond(): number {
    return CHARS_PER_SECOND[this.data.textSpeed];
  }

  textSpeedName(speed: TextSpeed = this.data.textSpeed): string {
    return TEXT_SPEED_NAME[speed];
  }

  /** Vuelve a leer lo guardado (los tests parten de cero). */
  reload(): void {
    this.data = readSettings();
  }

  private save(): void {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento: los ajustes duran esta sesión.
    }
  }
}

function readSettings(): SettingsData {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const legacyMuted = window.localStorage.getItem(LEGACY_MUTE_KEY) === '1';
    return parseSettings(raw ? JSON.parse(raw) : null, legacyMuted);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const Settings = new SettingsImpl();
