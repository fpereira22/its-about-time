import type { Outfit } from '../types/story';

/**
 * Formato de la partida guardada y sus migraciones.
 *
 * Cada vez que cambie la forma de SaveData: sube SAVE_VERSION y agrega en MIGRATIONS el paso
 * desde la versión anterior. Así las partidas viejas (la automática y los espacios de guardado)
 * se actualizan al cargarlas en vez de perderse. Una partida de una versión más nueva que este
 * build (ej. después de volver atrás un deploy) no se carga, pero tampoco se borra hasta que el
 * jugador empiece otra.
 */
export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  flags: string[];
  items: Record<string, number>;
  money: number;
  bip: number;
  playTimeMs: number;
  objective: string;
  location: { map: string; spawn: string } | null;
  /** Mensajes recibidos en el celular. */
  phone: PhoneEntry[];
  /** Misión en curso. */
  mission: string;
  /** Reloj de la historia y su tope (minutos desde el domingo 00:00). */
  clock: number;
  clockMax: number;
  outfit: Outfit | null;
  weather: Weather;
}

export interface PhoneEntry {
  id: string;
  read: boolean;
  /** Tiempo de partida (ms) en que llegó. */
  at: number;
  /** Hora del celular (minutos) en que llegó, en misiones con reloj de la historia. */
  min?: number;
}

/** Clima de la historia (misión 4): lo dibuja src/systems/Weather.ts. */
export type Weather = 'despejado' | 'nublado' | 'lluvia' | 'tormenta';
export const WEATHERS: readonly Weather[] = ['despejado', 'nublado', 'lluvia', 'tormenta'];

type Raw = Record<string, unknown>;

/** Paso de migración desde la versión de la clave a la siguiente. */
const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  // v1 → v2: los campos que se fueron sumando con las misiones (celular, misión, reloj, ropa,
  // clima) eran opcionales para no romper partidas antiguas. Ahora se completan una vez acá.
  1: (d) => ({
    ...d,
    version: 2,
    phone: d.phone ?? [],
    mission: d.mission ?? 'mission01',
    clock: d.clock ?? 0,
    clockMax: d.clockMax ?? d.clock ?? 0,
    outfit: d.outfit ?? null,
    weather: d.weather ?? 'despejado',
  }),
};

/**
 * Lleva una partida guardada (de cualquier versión conocida) al formato actual.
 * Devuelve null si no es una partida, si viene de una versión futura o si quedó con datos inválidos.
 */
export function migrateSave(raw: unknown): SaveData | null {
  if (!isObject(raw)) return null;
  let data: Raw = raw;
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) return null;
  let version: number = data.version;
  while (version < SAVE_VERSION) {
    const step: ((d: Raw) => Raw) | undefined = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    // Cada paso debe avanzar: así un error en MIGRATIONS no deja un ciclo infinito.
    if (typeof data.version !== 'number' || data.version <= version) return null;
    version = data.version;
  }
  return isValidSave(data) ? data : null;
}

/** Revisa la forma de una partida ya migrada (localStorage lo puede editar cualquiera). */
export function isValidSave(d: Raw): d is Raw & SaveData {
  return (
    d.version === SAVE_VERSION &&
    isStringArray(d.flags) &&
    isObject(d.items) &&
    Object.values(d.items).every(isFiniteNumber) &&
    isFiniteNumber(d.money) &&
    isFiniteNumber(d.bip) &&
    isFiniteNumber(d.playTimeMs) &&
    typeof d.objective === 'string' &&
    (d.location === null || (isObject(d.location) && typeof d.location.map === 'string' && typeof d.location.spawn === 'string')) &&
    Array.isArray(d.phone) &&
    d.phone.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.read === 'boolean') &&
    typeof d.mission === 'string' &&
    isFiniteNumber(d.clock) &&
    isFiniteNumber(d.clockMax) &&
    (d.outfit === null || isObject(d.outfit)) &&
    WEATHERS.includes(d.weather as Weather)
  );
}

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
