import type { MissionDef } from '../types/mission';
import { Admin } from './Admin';
import { check } from './Conditions';
import { EventSystem } from './EventSystem';
import { currentMission, MISSIONS } from './Mission';
import { ITEMS, StoryState } from './StoryState';

const RECORDS_KEY = 'santiago-laberinto:records';

/** Lo conseguido alguna vez en una misión, sumando todas las partidas. */
interface MissionRecord {
  completed: boolean;
  /** Ids de coleccionables. */
  collectibles: string[];
  /** Flags de secretos. */
  secrets: string[];
  /** Textos de los logros extra (`bonuses`). */
  bonuses: string[];
  /** Ids de finales (`endings`). */
  endings: string[];
}

export interface ProgressEntry {
  name: string;
  found: boolean;
  /** Ícono (objeto de sprites.json), solo coleccionables. */
  icon?: string;
}

export interface MissionProgress {
  mission: MissionDef;
  completed: boolean;
  collectibles: ProgressEntry[];
  secrets: ProgressEntry[];
  bonuses: ProgressEntry[];
  endings: ProgressEntry[];
}

/**
 * Registro de progreso entre partidas (pantalla "Progreso" del título): coleccionables, secretos,
 * logros y finales que se consiguieron alguna vez. Va en su propia clave de localStorage, así que
 * empezar una partida nueva no lo borra.
 */
class RecordsImpl {
  private data: Record<string, MissionRecord> = {};
  private attached = false;

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.data = readRecords();
    // También anota la partida guardada cuando el título la carga (progreso de antes del registro).
    EventSystem.on('state-changed', () => this.sync());
  }

  /** Al completar la misión: logros extra y final (dependen de cómo terminó, no se miran antes). */
  recordCompletion(m: MissionDef = currentMission()): void {
    const r = this.record(m.id);
    r.completed = true;
    for (const b of m.bonuses) if (check(b.if)) add(r.bonuses, b.text);
    const ending = m.endings?.find((e) => check(e.if));
    if (ending) add(r.endings, ending.id);
    this.save();
  }

  /** ¿Se completó alguna vez? */
  isCompleted(id: string): boolean {
    return this.data[id]?.completed === true;
  }

  /** Las misiones se desbloquean en orden: la primera siempre, las demás al completar la anterior (o en modo admin). */
  isUnlocked(m: MissionDef): boolean {
    const i = MISSIONS.indexOf(m);
    return i <= 0 || Admin.active || this.isCompleted(MISSIONS[i - 1].id);
  }

  progress(m: MissionDef): MissionProgress {
    const r = this.record(m.id);
    return {
      mission: m,
      completed: r.completed,
      collectibles: m.collectibles.map((id) => ({
        name: ITEMS[id]?.name ?? id,
        icon: ITEMS[id]?.icon ?? id,
        found: r.collectibles.includes(id),
      })),
      secrets: m.secrets.map((s) => ({ name: s.name, found: r.secrets.includes(s.flag) })),
      bonuses: m.bonuses.map((b) => ({ name: b.text, found: r.bonuses.includes(b.text) })),
      // Sin finales alternativos, el único final es completar la misión.
      endings: m.endings
        ? m.endings.map((e) => ({ name: e.name, found: r.endings.includes(e.id) }))
        : [{ name: 'Final único', found: r.completed }],
    };
  }

  /** Total conseguido / total que existe, en todas las misiones. */
  totals(): { found: number; total: number } {
    let found = 0;
    let total = 0;
    for (const m of MISSIONS) {
      const p = this.progress(m);
      for (const list of [p.collectibles, p.secrets, p.bonuses, p.endings]) {
        total += list.length;
        found += list.filter((e) => e.found).length;
      }
    }
    return { found, total };
  }

  /** Anota lo de la partida en curso que se ve en vivo: coleccionables (aunque después se coman) y secretos. */
  private sync(): void {
    const m = currentMission();
    const r = this.record(m.id);
    let changed = false;
    for (const id of m.collectibles) if (StoryState.hasItem(id)) changed = add(r.collectibles, id) || changed;
    for (const s of m.secrets) if (StoryState.hasFlag(s.flag)) changed = add(r.secrets, s.flag) || changed;
    if (StoryState.hasFlag(`${m.id}_completa`) && !r.completed) changed = r.completed = true;
    if (changed) this.save();
  }

  private record(id: string): MissionRecord {
    this.data[id] ??= { completed: false, collectibles: [], secrets: [], bonuses: [], endings: [] };
    return this.data[id];
  }

  private save(): void {
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento: el registro dura esta sesión.
    }
  }
}

/** Agrega `v` si no estaba. Devuelve true si cambió la lista. */
function add(list: string[], v: string): boolean {
  if (list.includes(v)) return false;
  list.push(v);
  return true;
}

function readRecords(): Record<string, MissionRecord> {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Partial<MissionRecord>>;
    // Completa campos que falten (registros de versiones anteriores).
    return Object.fromEntries(
      Object.entries(data).map(([id, r]) => [
        id,
        {
          completed: r.completed ?? false,
          collectibles: r.collectibles ?? [],
          secrets: r.secrets ?? [],
          bonuses: r.bonuses ?? [],
          endings: r.endings ?? [],
        },
      ]),
    );
  } catch {
    return {};
  }
}

export const Records = new RecordsImpl();
