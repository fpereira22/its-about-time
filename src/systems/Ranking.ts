import { RANKING_SCRIPT_URL, rankingCsvUrl } from '../config/ranking';
import { Admin } from './Admin';
import { MISSIONS } from './Mission';
import { Records } from './Records';

const PLAYER_KEY = 'santiago-laberinto:ranking-player';
const CACHE_KEY = 'santiago-laberinto:ranking-cache';
/** Cada cuánto se vuelve a pedir la planilla (al volver al título, por ejemplo). */
const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const COMMENT_MAX = 280;
export const TOP_COUNT = 10;

/** Una fila de `players_info`. */
export interface PlayerRow {
  id: string;
  name: string;
  /** Todo lo conseguido en Progreso (coleccionables, secretos, logros y finales). */
  score: number;
  missions: number;
  total: number;
  /** ISO. Desempata: quien llegó antes al puntaje queda arriba. */
  updated: string;
}

/** Una fila de `comments`. */
export interface CommentRow {
  date: string;
  id: string;
  name: string;
  stars: number;
  comment: string;
}

export interface RankingSnapshot {
  players: PlayerRow[];
  comments: CommentRow[];
  /** Cuándo se leyó la planilla (ms); 0 si nunca se pudo. */
  fetchedAt: number;
  /** La última lectura falló (sin internet): se muestra lo guardado. */
  offline: boolean;
}

/** Identidad del jugador en este navegador. Sin login: una llave al azar que nunca sale publicada. */
interface PlayerStore {
  /** Secreta. La planilla guarda solo un hash (`id`), así nadie puede escribir por otro. */
  key: string;
  /** Lo devuelve el Apps Script la primera vez. */
  id?: string;
  name?: string;
  /** Lo último que se publicó (para no reenviar lo mismo y mostrarlo antes de que la planilla se actualice). */
  sent?: PlayerRow;
  /** El último voto enviado (mismo motivo). */
  vote?: CommentRow;
  /** Nombre que dio en el saludo del comienzo: rellena el formulario de votos (no se publica solo). */
  draftName?: string;
  /** Ya se le preguntó el nombre (lo haya dado o no). */
  askedName?: boolean;
  /** "¿Estás disfrutando el juego?": cuántas veces se preguntó y con cuántas misiones completadas. */
  enjoy?: EnjoyState;
}

export interface EnjoyState {
  asks: number;
  /** Misiones completadas la última vez que se preguntó. */
  lastAt: number;
  /** Eligió "No volver a preguntar". */
  never?: boolean;
}

/** Primera pregunta al completar esta cantidad de misiones (el prólogo cuenta). */
export const ENJOY_FIRST_AT = 2;
/** Después, cada cuántas misiones más. */
export const ENJOY_EVERY = 3;
/** Nunca más de esto. */
export const ENJOY_MAX_ASKS = 3;

export interface MyScore {
  score: number;
  missions: number;
  total: number;
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------- funciones puras (con tests)

/** CSV de Google Sheets → filas. Respeta comillas, "" escapadas y saltos de línea dentro de una celda. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Filas con encabezado → objetos por nombre de columna (en minúsculas), así el orden de columnas no importa. */
function byHeader(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const int = (v: string | undefined): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Quita el apóstrofo con que el Apps Script neutraliza fórmulas (=, +, -, @ al comienzo). */
const unescapeCell = (v: string): string => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);

export function parsePlayers(csv: string): PlayerRow[] {
  return byHeader(parseCsv(csv))
    .map((r) => ({
      id: r.id ?? '',
      name: unescapeCell(r.nombre ?? ''),
      score: int(r.puntaje),
      missions: int(r.misiones),
      total: int(r.total),
      updated: r.actualizado ?? '',
    }))
    .filter((p) => p.id !== '' && p.name !== '');
}

export function parseComments(csv: string): CommentRow[] {
  return byHeader(parseCsv(csv))
    .map((r) => ({
      date: r.fecha ?? '',
      id: r.id ?? '',
      name: unescapeCell(r.nombre ?? ''),
      stars: Math.min(5, int(r.estrellas)),
      comment: unescapeCell(r.comentario ?? ''),
    }))
    .filter((c) => c.id !== '' && c.stars > 0);
}

/** Los mejores `n`: más puntaje, después más misiones, después quien llegó antes. */
export function topPlayers(players: PlayerRow[], n = TOP_COUNT): PlayerRow[] {
  return [...players]
    .sort((a, b) => b.score - a.score || b.missions - a.missions || a.updated.localeCompare(b.updated))
    .slice(0, n);
}

/** Promedio de estrellas contando solo el último voto de cada jugador. */
export function averageRating(comments: CommentRow[]): { avg: number; votes: number } {
  const last = new Map<string, CommentRow>();
  for (const c of comments) {
    const prev = last.get(c.id);
    if (!prev || c.date >= prev.date) last.set(c.id, c);
  }
  const votes = last.size;
  if (votes === 0) return { avg: 0, votes: 0 };
  let sum = 0;
  for (const c of last.values()) sum += c.stars;
  return { avg: sum / votes, votes };
}

/** Comentarios con texto, del más nuevo al más viejo. */
export function latestComments(comments: CommentRow[]): CommentRow[] {
  return comments.filter((c) => c.comment !== '').sort((a, b) => b.date.localeCompare(a.date));
}

/** Nombre limpio (espacios colapsados) o un mensaje de error para el jugador. */
export function checkName(raw: string): { name: string } | { error: string } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN) return { error: `El nombre necesita al menos ${NAME_MIN} letras.` };
  if (name.length > NAME_MAX) return { error: `Máximo ${NAME_MAX} caracteres.` };
  if (!/^[\p{L}\p{N} ._\-]+$/u.test(name)) return { error: 'Solo letras, números, espacios y . _ -' };
  return { name };
}

/** "★★★★☆" */
export function starsText(n: number): string {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** ¿Toca preguntar si está disfrutando el juego? Nunca si ya votó o pidió que no. */
export function shouldAskEnjoy(state: EnjoyState | undefined, completed: number, voted: boolean): boolean {
  if (voted || state?.never) return false;
  if (!state || state.asks === 0) return completed >= ENJOY_FIRST_AT;
  return state.asks < ENJOY_MAX_ASKS && completed >= state.lastAt + ENJOY_EVERY;
}

// ---------------------------------------------------------------- estado y red

class RankingImpl {
  private store: PlayerStore = readStore();
  private snapshot: RankingSnapshot = readCache();
  private inflight: Promise<RankingSnapshot> | null = null;

  /** Se puede votar / publicar (hay Apps Script configurado). */
  get canSubmit(): boolean {
    return RANKING_SCRIPT_URL !== '';
  }

  get playerName(): string | undefined {
    return this.store.name;
  }

  get playerId(): string | undefined {
    return this.store.id;
  }

  /** El nombre con que rellenar el formulario: el publicado o, si no, el que dio en el saludo. */
  get suggestedName(): string | undefined {
    return this.store.name ?? this.store.draftName;
  }

  /** Primera vez: todavía no se le ha preguntado el nombre. */
  get needsName(): boolean {
    return !this.store.name && !this.store.draftName && !this.store.askedName;
  }

  /** Guarda (solo en este navegador) el nombre del saludo. Vacío = "ahora no". */
  setDraftName(raw: string): SubmitResult {
    this.store.askedName = true;
    if (raw.trim() !== '') {
      const checked = checkName(raw);
      if ('error' in checked) return { ok: false, error: checked.error };
      this.store.draftName = checked.name;
    }
    writeStore(this.store);
    return { ok: true };
  }

  /** Ya votó desde este navegador (o su voto está en la planilla). */
  get hasVoted(): boolean {
    const id = this.store.id;
    return !!this.store.vote || (!!id && this.snapshot.comments.some((c) => c.id === id));
  }

  /** ¿Preguntar ahora si está disfrutando el juego? (al completar una misión). */
  shouldAskEnjoy(): boolean {
    return this.canSubmit && shouldAskEnjoy(this.store.enjoy, this.myScore().missions, this.hasVoted);
  }

  /** Anota que se le preguntó (al mostrar la pregunta). */
  markEnjoyAsked(): void {
    this.store.enjoy = { ...this.store.enjoy, asks: (this.store.enjoy?.asks ?? 0) + 1, lastAt: this.myScore().missions };
    writeStore(this.store);
  }

  /** "No volver a preguntar". */
  neverAskEnjoy(): void {
    this.store.enjoy = { asks: this.store.enjoy?.asks ?? 0, lastAt: this.store.enjoy?.lastAt ?? 0, never: true };
    writeStore(this.store);
  }

  /** Lo último que se tiene (puede estar vacío o viejo), sin pedir nada. */
  get cached(): RankingSnapshot {
    return this.withMine(this.snapshot);
  }

  /** El puntaje local, igual que en la pantalla de Progreso. */
  myScore(): MyScore {
    const { found, total } = Records.totals();
    return { score: found, missions: MISSIONS.filter((m) => Records.isCompleted(m.id)).length, total };
  }

  /** Lee la planilla publicada. Sin `force` reusa la lectura si tiene menos de un minuto. */
  load(force = false): Promise<RankingSnapshot> {
    if (!force && Date.now() - this.snapshot.fetchedAt < REFRESH_MS) return Promise.resolve(this.cached);
    this.inflight ??= Promise.all([fetchText(rankingCsvUrl('players')), fetchText(rankingCsvUrl('comments'))])
      .then(([p, c]) => {
        this.snapshot = { players: parsePlayers(p), comments: parseComments(c), fetchedAt: Date.now(), offline: false };
        writeCache(this.snapshot);
        return this.cached;
      })
      .catch(() => {
        this.snapshot = { ...this.snapshot, offline: true };
        return this.cached;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  /**
   * Publica el puntaje si el jugador ya tiene nombre y subió desde la última vez. Se llama al
   * completar una misión y al volver al título. En modo admin no (todo está desbloqueado).
   */
  syncScore(): void {
    if (!this.canSubmit || !this.store.name || Admin.active) return;
    const mine = this.myScore();
    const sent = this.store.sent;
    if (sent && sent.score >= mine.score && sent.missions >= mine.missions && sent.total === mine.total) return;
    void this.post({ action: 'score', name: this.store.name, ...mine }).catch(() => undefined);
  }

  /**
   * Formulario de votos: nombre (obligatorio), estrellas y comentario (opcionales: sin ellos solo
   * entra al ranking). Siempre publica el puntaje actual.
   */
  async submit(rawName: string, stars: number, rawComment: string): Promise<SubmitResult> {
    if (!this.canSubmit) return { ok: false, error: 'El ranking todavía no está conectado.' };
    const checked = checkName(rawName);
    if ('error' in checked) return { ok: false, error: checked.error };
    const comment = rawComment.replace(/\s+/g, ' ').trim().slice(0, COMMENT_MAX);
    if (comment !== '' && stars < 1) return { ok: false, error: 'Elige las estrellas para comentar.' };
    const vote = stars >= 1 ? { stars: Math.min(5, Math.round(stars)), comment } : null;
    try {
      await this.post({ action: vote ? 'vote' : 'score', name: checked.name, ...this.myScore(), ...(vote ?? {}) });
      if (vote && this.store.id) {
        this.store.vote = { date: new Date().toISOString(), id: this.store.id, name: checked.name, ...vote };
        writeStore(this.store);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'No se pudo enviar.' };
    }
  }

  private async post(body: Record<string, unknown>): Promise<void> {
    // text/plain: Apps Script no responde la consulta previa de CORS (preflight) que pediría JSON.
    const res = await withTimeout(
      fetch(RANKING_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, key: this.store.key }),
      }),
    ).catch(() => {
      throw new Error('Sin conexión. Intenta de nuevo.');
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
    if (!data?.ok || !data.id) throw new Error(serverError(data?.error));
    const mine = this.myScore();
    this.store.id = data.id;
    this.store.name = String(body.name);
    this.store.sent = { id: data.id, name: this.store.name, ...mine, updated: new Date().toISOString() };
    writeStore(this.store);
  }

  /**
   * La planilla publicada tarda unos minutos en actualizarse: mientras tanto se muestra lo que este
   * jugador acaba de enviar (su fila y su voto) en lugar de lo viejo.
   */
  private withMine(s: RankingSnapshot): RankingSnapshot {
    const { sent, vote } = this.store;
    let players = s.players;
    let comments = s.comments;
    if (sent) {
      const row = players.find((p) => p.id === sent.id);
      if (!row || row.score < sent.score || row.name !== sent.name) {
        players = [...players.filter((p) => p.id !== sent.id), { ...sent, updated: row?.updated ?? sent.updated }];
      }
    }
    if (vote && !comments.some((c) => c.id === vote.id && c.stars === vote.stars && c.comment === vote.comment)) {
      comments = [...comments, vote];
    }
    return { ...s, players, comments };
  }
}

function serverError(code: string | undefined): string {
  switch (code) {
    case 'name_taken':
      return 'Ese nombre ya lo usa otro jugador.';
    case 'bad_name':
      return 'Ese nombre no sirve. Prueba otro.';
    case 'too_fast':
      return 'Espera un poco antes de volver a enviar.';
    default:
      return 'No se pudo enviar. Intenta más tarde.';
  }
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await withTimeout(fetch(url, { cache: 'no-store' }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readStore(): PlayerStore {
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    const data = raw ? (JSON.parse(raw) as Partial<PlayerStore>) : null;
    if (data && typeof data.key === 'string' && data.key.length >= 16) return data as PlayerStore;
  } catch {
    // Sigue con una identidad nueva.
  }
  const store = { key: randomKey() };
  writeStore(store);
  return store;
}

function writeStore(store: PlayerStore): void {
  try {
    window.localStorage.setItem(PLAYER_KEY, JSON.stringify(store));
  } catch {
    // Sin almacenamiento: la identidad dura esta sesión.
  }
}

function readCache(): RankingSnapshot {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const data = raw ? (JSON.parse(raw) as Partial<RankingSnapshot>) : null;
    if (data && Array.isArray(data.players) && Array.isArray(data.comments)) {
      // fetchedAt 0: lo guardado se muestra al tiro, pero igual se vuelve a pedir.
      return { players: data.players, comments: data.comments, fetchedAt: 0, offline: false };
    }
  } catch {
    // Nada guardado.
  }
  return { players: [], comments: [], fetchedAt: 0, offline: false };
}

function writeCache(s: RankingSnapshot): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ players: s.players, comments: s.comments }));
  } catch {
    // Sin almacenamiento.
  }
}

export const Ranking = new RankingImpl();
