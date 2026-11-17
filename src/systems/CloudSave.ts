import { Admin } from './Admin';
import { hashText, keyToCode, codeToKey, MAX_CELL, packText, partAction, parseUserAgent, unpackText, type Hashes } from './cloudCodec';
import { Ranking } from './Ranking';
import { isAutomated, postScript, scriptConfigured } from './scriptApi';
import { STORAGE_KEYS } from './storageKeys';
import { StoryState } from './StoryState';

/**
 * Respaldo en la nube (hoja `player_data`, ver docs/ranking.md).
 *
 * El juego sigue guardando todo en localStorage como siempre; esto copia esas claves a la planilla en
 * segundo plano, sin avisar. El progreso va en "partes" (la partida, los espacios, Progreso...) y solo
 * se sube la que cambió desde la última vez; al abrir el juego se pregunta solo por los hashes y se
 * baja únicamente la parte que otro dispositivo cambió.
 *
 * Identidad: la misma llave secreta del ranking. El "código de jugador" (Ajustes) es esa llave
 * escrita en 26 letras: al usarlo en otro dispositivo, ese dispositivo pasa a ser el mismo jugador.
 */

interface Part {
  /** Columna de la planilla. */
  name: string;
  read(): string;
  write(text: string): void;
  /** No hay nada guardado (un dispositivo recién llegado). */
  empty(text: string): boolean;
}

/** Una parte hecha de claves de localStorage: {clave: valor tal cual (o null)}. */
function storagePart(name: string, keys: string[]): Part {
  return {
    name,
    read: () => JSON.stringify(Object.fromEntries(keys.map((k) => [k, getItem(k)]))),
    write: (text) => {
      const data = JSON.parse(text) as Record<string, unknown>;
      for (const k of keys) {
        const v = data[k];
        if (typeof v === 'string') setItem(k, v);
        else removeItem(k);
      }
    },
    empty: (text) => Object.values(JSON.parse(text) as Record<string, unknown>).every((v) => v === null),
  };
}

const PARTS: Part[] = [
  storagePart('partida', [STORAGE_KEYS.save]),
  storagePart('espacios', [STORAGE_KEYS.slots]),
  storagePart('progreso', [STORAGE_KEYS.records, STORAGE_KEYS.konami, STORAGE_KEYS.snakeBest]),
  storagePart('stats', [STORAGE_KEYS.skills]),
  storagePart('ajustes', [STORAGE_KEYS.settings]),
  {
    name: 'jugador',
    read: () => Ranking.profileForCloud(),
    write: (text) => Ranking.restoreProfile(text),
    empty: (text) => text === '{}',
  },
];

/** Cada cuánto se revisa si algo cambió. */
const TICK_MS = 60_000;
/** Mínimo entre subidas normales (lo urgente, como completar una misión, no espera). */
const UPLOAD_EVERY_MS = 3 * 60_000;
/** Lo urgente se sube a los pocos segundos (por si viene más de un cambio junto). */
const SOON_MS = 3_000;

interface CloudState {
  /** Hash de cada parte la última vez que acá y la nube quedaron iguales. */
  synced: Hashes;
  /** Revisión de la fila en la planilla (sube con cada guardado). */
  rev: number;
  /** Último respaldo que se confirmó (ms). */
  at: number;
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

class CloudSaveImpl {
  private state: CloudState = readState();
  private started = false;
  /** Ya se comparó con la nube en esta sesión (antes no se sube nada, para no pisar otro dispositivo). */
  private checked = false;
  private busy = false;
  private stopped = false;
  private lastUpload = 0;
  private soonTimer = 0;
  private canReload: () => boolean = () => false;

  /** Respaldo automático activo (no en modo admin ni en el navegador automatizado). */
  get enabled(): boolean {
    return scriptConfigured() && !Admin.active && !isAutomated();
  }

  /** Código de jugador para recuperar el progreso en otro dispositivo. */
  get code(): string {
    return keyToCode(Ranking.secretKey);
  }

  /** Cuándo se confirmó el último respaldo (ms), 0 si nunca. */
  get lastBackupAt(): number {
    return this.state.at;
  }

  /**
   * Arranca el respaldo: compara con la nube y después revisa cada minuto. `canReload` dice si se
   * puede recargar la página para traer lo que otro dispositivo guardó (solo en el título).
   */
  start(opts: { canReload: () => boolean }): void {
    if (this.started || !this.enabled) return;
    this.started = true;
    this.canReload = opts.canReload;
    void this.check();
    window.setInterval(() => void this.tick(), TICK_MS);
    const leaving = (): void => void this.flush(true);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && leaving());
    window.addEventListener('pagehide', leaving);
  }

  /** Subir pronto (al completar una misión o guardar en un espacio). */
  soon(): void {
    if (!this.started) return;
    window.clearTimeout(this.soonTimer);
    this.soonTimer = window.setTimeout(() => void this.flush(false, true), SOON_MS);
  }

  /**
   * Trae el progreso del código `raw` y reemplaza el de este dispositivo. Si sale bien hay que
   * recargar la página (lo hace quien llama, después de avisar).
   */
  async restoreFromCode(raw: string): Promise<RestoreResult> {
    const key = codeToKey(raw);
    if (!key) return { ok: false, error: 'Ese código no es válido: son 26 letras y números.' };
    if (key === Ranking.secretKey) return { ok: false, error: 'Ese es el código de este dispositivo.' };
    if (!scriptConfigured()) return { ok: false, error: 'La nube todavía no está conectada.' };
    const r = await postScript({ action: 'load', key, parts: PARTS.map((p) => p.name) });
    if (!r.ok) return { ok: false, error: r.error === 'offline' ? 'Sin conexión. Intenta de nuevo.' : 'No se pudo leer. Intenta más tarde.' };
    if (!r.found) return { ok: false, error: 'No hay progreso guardado con ese código.' };
    const packed = (r.parts ?? {}) as Record<string, string>;
    const texts: Record<string, string> = {};
    try {
      for (const p of PARTS) if (typeof packed[p.name] === 'string' && packed[p.name] !== '') texts[p.name] = await unpackText(packed[p.name]);
    } catch {
      return { ok: false, error: 'El respaldo no se pudo leer en este navegador.' };
    }
    this.stopped = true;
    for (const p of PARTS) {
      if (p.name === 'jugador') continue;
      if (texts[p.name] !== undefined) p.write(texts[p.name]);
      else p.write(JSON.stringify({}));
    }
    Ranking.adoptIdentity(key, texts.jugador ?? null);
    this.state = { synced: { ...((r.hashes ?? {}) as Hashes) }, rev: Number(r.rev) || 0, at: Date.now() };
    writeState(this.state);
    return { ok: true };
  }

  private async tick(): Promise<void> {
    if (!this.checked) return this.check();
    if (Date.now() - this.lastUpload >= UPLOAD_EVERY_MS) await this.flush();
  }

  /** Compara con la nube: baja lo que otro dispositivo cambió (si se puede recargar) y sube lo de acá. */
  private async check(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const r = await postScript({ action: 'load', key: Ranking.secretKey, parts: [] });
      if (!r.ok) return;
      const remote = (r.found ? r.hashes : {}) as Hashes;
      const pulls: Part[] = [];
      for (const p of PARTS) {
        const text = p.read();
        const local = hashText(text);
        const action = partAction(local, remote[p.name], this.state.synced[p.name], p.empty(text));
        if (action === 'same') this.state.synced[p.name] = local;
        else if (action === 'pull') pulls.push(p);
      }
      if (pulls.length > 0 && this.canReload() && (await this.pull(pulls))) {
        window.location.reload();
        return;
      }
      writeState(this.state);
      this.checked = true;
    } finally {
      this.busy = false;
    }
    await this.flush();
  }

  /** Baja `parts`, las escribe en localStorage y anota que quedaron iguales. */
  private async pull(parts: Part[]): Promise<boolean> {
    const r = await postScript({ action: 'load', key: Ranking.secretKey, parts: parts.map((p) => p.name) });
    if (!r.ok || !r.found) return false;
    const packed = (r.parts ?? {}) as Record<string, string>;
    const hashes = (r.hashes ?? {}) as Hashes;
    try {
      const texts = await Promise.all(parts.map((p) => unpackText(packed[p.name] ?? '')));
      if (!this.canReload()) return false; // empezó a jugar mientras llegaba
      parts.forEach((p, i) => {
        p.write(texts[i]);
        this.state.synced[p.name] = hashes[p.name];
      });
    } catch {
      return false;
    }
    this.state.rev = Number(r.rev) || this.state.rev;
    writeState(this.state);
    return true;
  }

  /** Sube las partes que cambiaron desde la última vez. `leaving`: la pestaña se cierra u oculta. */
  private async flush(leaving = false, urgent = false): Promise<void> {
    if (!this.checked || this.busy || this.stopped) return;
    if (!leaving && !urgent && Date.now() - this.lastUpload < UPLOAD_EVERY_MS) return;
    const changed = PARTS.map((p) => ({ p, text: p.read() }))
      .map((x) => ({ ...x, hash: hashText(x.text) }))
      .filter((x) => x.hash !== this.state.synced[x.p.name] && !(this.state.synced[x.p.name] === undefined && x.p.empty(x.text)));
    if (changed.length === 0) return;
    this.busy = true;
    try {
      const parts: Record<string, string> = {};
      const hashes: Hashes = {};
      for (const c of changed) {
        const packed = await packText(c.text);
        if (packed.length > MAX_CELL) continue; // no entra en una celda: se queda solo acá
        parts[c.p.name] = packed;
        hashes[c.p.name] = c.hash;
      }
      if (Object.keys(parts).length === 0) return;
      this.lastUpload = Date.now();
      const r = await postScript({ action: 'save', key: Ranking.secretKey, parts, hashes, summary: summary(), device: deviceLabel() }, leaving);
      // Al salir no se espera la respuesta: la próxima vez que abra se verá que quedaron iguales.
      if (!r.ok || leaving) return;
      Object.assign(this.state.synced, hashes);
      this.state.rev = Number(r.rev) || this.state.rev;
      this.state.at = Date.now();
      writeState(this.state);
    } finally {
      this.busy = false;
    }
  }
}

/** Lo legible de la fila (para mirar la planilla sin descomprimir nada). */
function summary(): Record<string, unknown> {
  const mine = Ranking.myScore();
  return {
    name: Ranking.playerName ?? Ranking.suggestedName ?? '',
    mission: StoryState.missionId,
    missions: mine.missions,
    score: mine.score,
    playMin: Math.round(StoryState.playTimeMs / 60_000),
  };
}

function deviceLabel(): string {
  const d = parseUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  return `${d.os} · ${d.browser}`;
}

function getItem(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function setItem(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // Lleno o bloqueado.
  }
}

function removeItem(k: string): void {
  try {
    window.localStorage.removeItem(k);
  } catch {
    // Bloqueado.
  }
}

function readState(): CloudState {
  try {
    const data = JSON.parse(getItem(STORAGE_KEYS.cloud) ?? 'null') as Partial<CloudState> | null;
    if (data && typeof data.synced === 'object' && data.synced) {
      return { synced: data.synced, rev: Number(data.rev) || 0, at: Number(data.at) || 0 };
    }
  } catch {
    // Nada guardado.
  }
  return { synced: {}, rev: 0, at: 0 };
}

function writeState(s: CloudState): void {
  setItem(STORAGE_KEYS.cloud, JSON.stringify(s));
}

export const CloudSave = new CloudSaveImpl();
