import { EventSystem } from './EventSystem';
import { STORAGE_KEYS } from './storageKeys';

const SETTINGS_KEY = STORAGE_KEYS.settings;
/** Clave antigua de la tecla M (antes de los ajustes): se lee una vez para no perder la preferencia. */
const LEGACY_MUTE_KEY = 'santiago-laberinto:mute';

/** Pasos de los volúmenes: 0 (apagado) a VOLUME_STEPS (el volumen original del juego). */
export const VOLUME_STEPS = 10;

export type TextSpeed = 'lenta' | 'normal' | 'rapida' | 'instantanea';
export const TEXT_SPEEDS: readonly TextSpeed[] = ['lenta', 'normal', 'rapida', 'instantanea'];

/** Letras por segundo de la caja de diálogo (Infinity: aparece todo el texto de una). */
const CHARS_PER_SECOND: Record<TextSpeed, number> = { lenta: 30, normal: 55, rapida: 110, instantanea: Infinity };
const TEXT_SPEED_NAME: Record<TextSpeed, string> = { lenta: 'Lenta', normal: 'Normal', rapida: 'Rápida', instantanea: 'Instantánea' };

/** Acciones cuya tecla principal se puede cambiar (Ajustes → Accesibilidad → Teclas). */
export const REBINDABLE = ['up', 'down', 'left', 'right', 'interact', 'inventory', 'phone', 'toggleView', 'trick'] as const;
export type RebindableAction = (typeof REBINDABLE)[number];
/** Tecla (KeyboardEvent.code) de fábrica de cada acción: lo que vale mientras no se cambie. */
export const DEFAULT_KEYS: Readonly<Record<RebindableAction, string>> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  interact: 'KeyE',
  inventory: 'Tab',
  phone: 'KeyQ',
  toggleView: 'KeyV',
  trick: 'KeyF',
};
/** Teclas que no se pueden asignar: ya tienen otro uso fijo (menú, silencio, pantalla completa, flechas, Enter y Espacio). */
const RESERVED_KEY = /^(Escape|F\d{1,2}|KeyM|KeyP|Arrow(Up|Down|Left|Right)|Enter|NumpadEnter|Space|Backspace|Meta.*|OS.*|Context.*)$/;
const KEY_CODE = /^[A-Za-z][A-Za-z0-9]{1,15}$/;

export function isAssignableKey(code: string): boolean {
  return KEY_CODE.test(code) && !RESERVED_KEY.test(code);
}

export interface SettingsData {
  /** Volumen de la música, 0 a VOLUME_STEPS. */
  music: number;
  /** Volumen de los efectos (y el ambiente: lluvia, viento), 0 a VOLUME_STEPS. */
  sfx: number;
  /** Silencio total (tecla M). */
  muted: boolean;
  textSpeed: TextSpeed;
  /** Reseñas de los jugadores apareciendo en el título. */
  titleReviews: boolean;
  /** Mandar datos de uso anónimos (país, ciudad, tiempo de juego): ver src/systems/UsageStats.ts. */
  usageStats: boolean;
  /** Texto de los diálogos más grande (menos líneas por página). */
  bigText: boolean;
  /** Sin sacudidas de cámara ni destellos de relámpago, y menos lluvia. */
  reduceEffects: boolean;
  /** Tutoriales y "Cómo se juega" de los minijuegos (el Prólogo y cada minijuego la primera vez). */
  tutorials: boolean;
  /** Teclas cambiadas por el jugador; lo que falte usa DEFAULT_KEYS. */
  keys: Partial<Record<RebindableAction, string>>;
}

export const DEFAULT_SETTINGS: Readonly<SettingsData> = { music: VOLUME_STEPS, sfx: VOLUME_STEPS, muted: false, textSpeed: 'normal', titleReviews: true, usageStats: true, bigText: false, reduceEffects: false, tutorials: true, keys: {} };

/** Ajustes guardados → valores válidos (lo que falte o venga roto queda por defecto). */
export function parseSettings(raw: unknown, legacyMuted = false): SettingsData {
  const d = typeof raw === 'object' && raw !== null ? (raw as Partial<Record<keyof SettingsData, unknown>>) : {};
  return {
    music: volume(d.music, DEFAULT_SETTINGS.music),
    sfx: volume(d.sfx, DEFAULT_SETTINGS.sfx),
    muted: typeof d.muted === 'boolean' ? d.muted : legacyMuted,
    textSpeed: TEXT_SPEEDS.includes(d.textSpeed as TextSpeed) ? (d.textSpeed as TextSpeed) : DEFAULT_SETTINGS.textSpeed,
    titleReviews: typeof d.titleReviews === 'boolean' ? d.titleReviews : DEFAULT_SETTINGS.titleReviews,
    usageStats: typeof d.usageStats === 'boolean' ? d.usageStats : DEFAULT_SETTINGS.usageStats,
    bigText: typeof d.bigText === 'boolean' ? d.bigText : DEFAULT_SETTINGS.bigText,
    reduceEffects: typeof d.reduceEffects === 'boolean' ? d.reduceEffects : DEFAULT_SETTINGS.reduceEffects,
    tutorials: typeof d.tutorials === 'boolean' ? d.tutorials : DEFAULT_SETTINGS.tutorials,
    keys: parseKeys(d.keys),
  };
}

/** Teclas guardadas → solo las válidas y sin repetir (dos acciones no comparten tecla). */
function parseKeys(raw: unknown): Partial<Record<RebindableAction, string>> {
  const out: Partial<Record<RebindableAction, string>> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const used = new Set<string>();
  for (const action of REBINDABLE) {
    const code = (raw as Record<string, unknown>)[action];
    if (typeof code !== 'string' || !isAssignableKey(code) || code === DEFAULT_KEYS[action] || used.has(code)) continue;
    used.add(code);
    out[action] = code;
  }
  return out;
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
    if (key === 'keys' ? JSON.stringify(next.keys) === JSON.stringify(this.data.keys) : next[key] === this.data[key]) return;
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

  /** Tecla (code) que dispara `action` ahora mismo. */
  keyFor(action: RebindableAction): string {
    return this.data.keys[action] ?? DEFAULT_KEYS[action];
  }

  /**
   * Asigna `code` a `action`. Si otra acción ya la usaba, se queda con la que tenía esta (intercambio).
   * Devuelve false si la tecla no se puede usar.
   */
  setKey(action: RebindableAction, code: string): boolean {
    if (!isAssignableKey(code)) return false;
    const before = this.keyFor(action);
    const keys: Partial<Record<RebindableAction, string>> = {};
    for (const a of REBINDABLE) keys[a] = this.keyFor(a);
    for (const other of REBINDABLE) if (other !== action && keys[other] === code) keys[other] = before;
    keys[action] = code;
    this.set('keys', keys);
    return true;
  }

  resetKeys(): void {
    this.set('keys', {});
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
