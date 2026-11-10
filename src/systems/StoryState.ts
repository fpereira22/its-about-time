import itemsData from '../data/items.json';
import type { ItemDef, Outfit } from '../types/story';
import { EventSystem } from './EventSystem';
import { migrateSave, SAVE_VERSION, type PhoneEntry, type SaveData, type Weather } from './SaveData';

export const ITEMS = itemsData as Record<string, ItemDef>;

const SAVE_KEY = 'santiago-laberinto:save';

export { WEATHERS, type PhoneEntry, type SaveData, type Weather } from './SaveData';

export const START_MONEY = 3000;

/** Minutos de juego que avanza el reloj de la historia por cada minuto real (ms reales por minuto de juego). */
export const MS_PER_CLOCK_MINUTE = 4000;

/**
 * Estado de la partida: flags de historia, inventario, plata, saldo Bip! y reloj.
 * Se guarda en localStorage; si el navegador lo bloquea, el juego sigue funcionando sin guardar.
 */
class StoryStateImpl {
  private flags = new Set<string>();
  private items = new Map<string, number>();
  money = START_MONEY;
  bip = 0;
  playTimeMs = 0;
  objective = '';
  location: SaveData['location'] = null;
  /** Bandeja de entrada del celular, en orden de llegada. */
  phone: PhoneEntry[] = [];
  /** Reloj detenido (diálogos de menú, pantalla final). */
  clockPaused = false;
  /** Id de la misión en curso (src/data/missions). */
  missionId = 'mission01';
  /** Reloj de la historia en minutos desde el domingo 00:00 (solo misiones con `clock`). */
  clock = 0;
  /** El reloj de la historia avanza solo hasta aquí (ej. no pasa de las 7:14 antes del tren). */
  clockMax = 0;
  /** Ropa elegida; null = la de siempre. Cada partida nueva parte con la ropa por defecto. */
  outfit: Outfit | null = null;
  weather: Weather = 'despejado';

  newGame(missionId = 'mission01', opts: { money?: number; flags?: string[]; clock?: number; weather?: Weather } = {}): void {
    this.flags.clear();
    this.items.clear();
    // Se parte con la tarjeta Bip! (sin saldo).
    this.items.set('bip', 1);
    for (const f of opts.flags ?? []) this.flags.add(f);
    this.money = opts.money ?? START_MONEY;
    this.bip = 0;
    this.playTimeMs = 0;
    this.objective = '';
    this.location = null;
    this.phone = [];
    this.clockPaused = false;
    this.missionId = missionId;
    this.clock = opts.clock ?? 0;
    this.clockMax = this.clock;
    this.outfit = null;
    this.weather = opts.weather ?? 'despejado';
    this.changed();
  }

  // --- Flags ---
  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  setFlag(flag: string, value = true): void {
    if (value === this.flags.has(flag)) return;
    if (value) this.flags.add(flag);
    else this.flags.delete(flag);
    this.changed();
  }

  allFlags(): string[] {
    return [...this.flags].sort();
  }

  // --- Inventario ---
  itemCount(id: string): number {
    return this.items.get(id) ?? 0;
  }

  hasItem(id: string): boolean {
    return this.itemCount(id) > 0;
  }

  addItem(id: string, qty = 1): void {
    if (!ITEMS[id]) console.warn(`Ítem "${id}" no está definido en items.json`);
    this.items.set(id, this.itemCount(id) + qty);
    this.changed();
  }

  removeItem(id: string, qty = 1): boolean {
    const have = this.itemCount(id);
    if (have < qty) return false;
    if (have === qty) this.items.delete(id);
    else this.items.set(id, have - qty);
    this.changed();
    return true;
  }

  inventory(): Array<{ id: string; qty: number; def: ItemDef }> {
    return [...this.items.entries()]
      .filter(([id]) => ITEMS[id])
      .map(([id, qty]) => ({ id, qty, def: ITEMS[id] }));
  }

  collectibles(): string[] {
    return Object.keys(ITEMS).filter((id) => ITEMS[id].collectible && this.hasItem(id));
  }

  // --- Plata y Bip! ---
  addMoney(amount: number): void {
    this.money += amount;
    this.changed();
  }

  /** Cobra plata en efectivo. Devuelve false (sin cobrar) si no alcanza. */
  spend(amount: number): boolean {
    if (this.money < amount) return false;
    this.money -= amount;
    this.changed();
    return true;
  }

  chargeBip(amount: number): void {
    this.bip += amount;
    this.changed();
  }

  payBip(amount: number): boolean {
    if (this.bip < amount) return false;
    this.bip -= amount;
    this.changed();
    return true;
  }

  // --- Celular ---
  receiveMessage(id: string, min?: number): void {
    this.phone.push({ id, read: false, at: Math.round(this.playTimeMs), min });
    this.changed();
  }

  markRead(ids: string[]): void {
    let changed = false;
    for (const m of this.phone) {
      if (!m.read && ids.includes(m.id)) {
        m.read = true;
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  unreadCount(): number {
    return this.phone.filter((m) => !m.read).length;
  }

  setObjective(text: string): void {
    this.objective = text;
    EventSystem.emit('objective-changed', text);
    this.save();
  }

  /** Penalización de tiempo (ej. te pasaste de estación). */
  addTime(ms: number): void {
    this.playTimeMs += ms;
  }

  tick(deltaMs: number): void {
    if (this.clockPaused) return;
    this.playTimeMs += deltaMs;
    if (this.clock < this.clockMax) this.clock = Math.min(this.clockMax, this.clock + deltaMs / MS_PER_CLOCK_MINUTE);
  }

  /** Fija el reloj de la historia (y su tope). El tope nunca queda antes de la hora. */
  setClock(minutes: number, max?: number): void {
    this.clock = minutes;
    this.clockMax = Math.max(minutes, max ?? minutes);
    this.changed();
  }

  setOutfit(outfit: Outfit | null): void {
    this.outfit = outfit;
    this.changed();
  }

  setWeather(weather: Weather): void {
    if (weather === this.weather) return;
    this.weather = weather;
    EventSystem.emit('weather', weather);
    this.changed();
  }

  // --- Guardado ---
  hasSave(): boolean {
    return readStorage() !== null;
  }

  /** Copia de todo el estado guardable (la partida automática y los espacios de guardado). */
  snapshot(): SaveData {
    return {
      version: SAVE_VERSION,
      // Las flags que empiezan con "_" son temporales (puertas abiertas, timbre) y no se guardan.
      flags: [...this.flags].filter((f) => !f.startsWith('_')),
      items: Object.fromEntries(this.items),
      money: this.money,
      bip: this.bip,
      playTimeMs: Math.round(this.playTimeMs),
      objective: this.objective,
      location: this.location,
      phone: this.phone.map((p) => ({ ...p })),
      mission: this.missionId,
      clock: Math.round(this.clock * 100) / 100,
      clockMax: this.clockMax,
      outfit: this.outfit,
      weather: this.weather,
    };
  }

  save(): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot()));
    } catch {
      // Almacenamiento bloqueado o lleno: se juega sin guardar.
    }
  }

  load(): boolean {
    const data = readStorage();
    return data !== null && this.restore(data);
  }

  /**
   * Reemplaza la partida en curso por `data` (y la deja como partida automática). Las partidas de
   * versiones anteriores se migran (ver SaveData.ts); devuelve false si no se puede usar.
   */
  restore(raw: SaveData): boolean {
    const data = migrateSave(raw);
    if (!data) return false;
    this.flags = new Set(data.flags);
    this.items = new Map(Object.entries(data.items));
    this.money = data.money;
    this.bip = data.bip;
    this.playTimeMs = data.playTimeMs;
    this.objective = data.objective;
    this.location = data.location;
    this.phone = data.phone.map((p) => ({ ...p }));
    this.missionId = data.mission;
    this.clock = data.clock;
    this.clockMax = data.clockMax;
    this.outfit = data.outfit;
    this.weather = data.weather;
    this.clockPaused = false;
    this.changed();
    return true;
  }

  clearSave(): void {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Sin acceso al almacenamiento: no hay nada que borrar.
    }
  }

  private changed(): void {
    EventSystem.emit('state-changed');
    this.save();
  }
}

function readStorage(): SaveData | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? migrateSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export const StoryState = new StoryStateImpl();

/** $3.000 al estilo chileno. */
export function formatMoney(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CL');
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
