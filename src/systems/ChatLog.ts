import type { PhoneEntry } from './SaveData';
import { STORAGE_KEYS } from './storageKeys';

/**
 * Historial del chat entre misiones.
 *
 * El celular (StoryState.phone) arranca vacío en cada misión. Para que las conversaciones no se pierdan,
 * cada mensaje que llega también se anota aquí, por misión, en una clave aparte que sobrevive a las
 * partidas nuevas (como el Progreso). La app Mensajes muestra primero lo de las misiones anteriores,
 * con una línea que separa cada misión, y después lo de la misión en curso.
 *
 * Solo se guarda lo que hace falta para volver a dibujar el mensaje: el id (el texto sale de phone.json),
 * cuándo llegó y la hora del celular.
 */

/** Misiones que son recuerdos de otra época: Salento y la fiesta. */
const FLASHBACKS = ['mission08', 'mission09'];

/** Mensajes por misión, en orden de llegada. */
type Log = Record<string, PhoneEntry[]>;

/** Lo guardado → solo entradas válidas (lo roto se descarta, sin repetir ids dentro de una misión). */
export function parseChatLog(raw: unknown): Log {
  const out: Log = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [mission, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^mission\d+$/.test(mission) || !Array.isArray(list)) continue;
    const seen = new Set<string>();
    const entries: PhoneEntry[] = [];
    for (const e of list as Array<Partial<PhoneEntry> | null>) {
      if (!e || typeof e.id !== 'string' || seen.has(e.id) || typeof e.at !== 'number') continue;
      seen.add(e.id);
      entries.push({ id: e.id, read: true, at: e.at, ...(typeof e.min === 'number' ? { min: e.min } : {}) });
    }
    if (entries.length > 0) out[mission] = entries;
  }
  return out;
}

class ChatLogImpl {
  private log: Log = read();

  /** Anota un mensaje de la misión `mission` (si ya estaba, no lo repite). */
  record(mission: string, entry: PhoneEntry): void {
    if (!/^mission\d+$/.test(mission)) return;
    const list = (this.log[mission] ??= []);
    if (list.some((e) => e.id === entry.id)) return;
    list.push({ id: entry.id, read: true, at: entry.at, ...(entry.min !== undefined ? { min: entry.min } : {}) });
    this.save();
  }

  /** Anota varios (la partida cargada puede traer mensajes de antes de este historial). */
  recordAll(mission: string, entries: readonly PhoneEntry[]): void {
    if (!/^mission\d+$/.test(mission)) return;
    let changed = false;
    const list = (this.log[mission] ??= []);
    for (const entry of entries) {
      if (list.some((e) => e.id === entry.id)) continue;
      list.push({ id: entry.id, read: true, at: entry.at, ...(entry.min !== undefined ? { min: entry.min } : {}) });
      changed = true;
    }
    if (changed) this.save();
    else if (list.length === 0) delete this.log[mission];
  }

  /**
   * Lo de las misiones anteriores a `current` (por número), de la más vieja a la más nueva. Los recuerdos (misiones 8
   * y 9, que cuentan algo de semanas atrás) no ven el chat de las demás misiones ni lo aportan a ellas: así el
   * celular no muestra mensajes de algo que en la historia todavía no pasó (o ya pasó).
   */
  before(current: string, order: readonly string[]): Array<{ mission: string; entries: PhoneEntry[] }> {
    if (FLASHBACKS.includes(current)) return [];
    const here = order.indexOf(current);
    return order
      .slice(0, Math.max(0, here))
      .filter((m) => !FLASHBACKS.includes(m) && (this.log[m]?.length ?? 0) > 0)
      .map((mission) => ({ mission, entries: this.log[mission] }));
  }

  reload(): void {
    this.log = read();
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.chatlog, JSON.stringify(this.log));
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
  }
}

function read(): Log {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.chatlog);
    return parseChatLog(raw ? JSON.parse(raw) : null);
  } catch {
    return {};
  }
}

export const ChatLog = new ChatLogImpl();
