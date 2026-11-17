import { GEO_URL } from '../config/ranking';
import { Admin } from './Admin';
import { parseUserAgent, trafficSource } from './cloudCodec';
import { EventSystem } from './EventSystem';
import { Ranking } from './Ranking';
import { isAutomated, postScript, scriptConfigured } from './scriptApi';
import { Settings } from './Settings';
import { STORAGE_KEYS } from './storageKeys';
import { StoryState } from './StoryState';

/**
 * Datos de uso (hoja `metadata_local`, ver docs/ranking.md): una fila por sesión con de dónde se
 * conecta (país, región y ciudad aproximados; de la IP solo un hash que calcula el Apps Script),
 * cuándo (hora y día del jugador), en qué equipo, de dónde llegó y cuánto jugó.
 *
 * Se apaga en Ajustes → "Datos de uso", en modo admin y en el navegador automatizado.
 */

/** Cada cuánto se actualiza la fila de la sesión mientras se juega. */
const HEARTBEAT_MS = 3 * 60_000;
/** Cada cuánto se suma el tiempo. */
const STEP_MS = 5_000;
/** Sin tocar nada por más de esto, el tiempo deja de contar como "jugando". */
const IDLE_MS = 90_000;
/** Oculta por más de esto (otra pestaña, celular bloqueado): al volver empieza otra sesión. */
const NEW_SESSION_AFTER_MS = 30 * 60_000;
const GEO_TIMEOUT_MS = 4_000;

/**
 * La sesión en curso vive también en sessionStorage (dura lo que la pestaña): así recargar la página
 * (o la recarga del respaldo en la nube) sigue la misma sesión en vez de contar una nueva.
 */
const SESSION_KEY = 'santiago-laberinto:usage-session';

interface StoredSession {
  id: string;
  visibleMs: number;
  playingMs: number;
  visit: number;
  opened: boolean;
  seenAt: number;
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

interface Geo {
  ip: string;
  city: string;
  region: string;
  country: string;
}

class UsageStatsImpl {
  private started = false;
  private session = '';
  private visibleMs = 0;
  private playingMs = 0;
  private lastStep = 0;
  private lastInput = 0;
  private hiddenAt = 0;
  private sentAt = 0;
  /** Ya se mandó la fila de esta sesión (los envíos siguientes solo actualizan los números). */
  private opened = false;
  /** Número de sesión de este navegador (1 = jugador nuevo). */
  private visit = 0;
  private geo: Promise<Geo | null> | null = null;
  private inGame: () => boolean = () => false;

  get enabled(): boolean {
    return scriptConfigured() && !Admin.active && !isAutomated() && Settings.get('usageStats');
  }

  /** `inGame`: el jugador está en un mapa o minijuego (no en el título ni en los menús). */
  start(opts: { inGame: () => boolean }): void {
    if (this.started) return;
    this.started = true;
    this.inGame = opts.inGame;
    const input = (): void => void (this.lastInput = Date.now());
    for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, input, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => void this.send(true));
    window.setInterval(() => this.step(), STEP_MS);
    // Si lo apagan en Ajustes se deja de mandar; si lo prenden, empieza una sesión nueva.
    EventSystem.on('settings-changed', () => {
      if (this.enabled && !this.session) this.begin(false);
      else if (!this.enabled) this.session = '';
    });
    if (this.enabled) this.begin(true);
  }

  /** Empieza una sesión, o con `resume` sigue la de esta pestaña si se vio hace poco (una recarga). */
  private begin(resume: boolean): void {
    const prev = resume ? readSession() : null;
    this.lastStep = Date.now();
    this.lastInput = Date.now();
    this.sentAt = 0;
    if (prev && Date.now() - prev.seenAt < NEW_SESSION_AFTER_MS) {
      this.session = prev.id;
      this.visibleMs = prev.visibleMs;
      this.playingMs = prev.playingMs;
      this.visit = prev.visit;
      this.opened = prev.opened;
      // Ya existe la fila: basta con el próximo latido.
      if (this.opened) {
        this.sentAt = Date.now();
        return;
      }
    } else {
      this.session = randomHex(8);
      this.visibleMs = 0;
      this.playingMs = 0;
      this.visit = bumpVisits();
      this.opened = false;
    }
    this.geo ??= fetchGeo();
    void this.send();
  }

  private remember(): void {
    if (!this.session) return;
    const s: StoredSession = {
      id: this.session,
      visibleMs: this.visibleMs,
      playingMs: this.playingMs,
      visit: this.visit,
      opened: this.opened,
      seenAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      // Sin almacenamiento: una recarga cuenta como sesión nueva.
    }
  }

  private step(): void {
    const now = Date.now();
    const dt = Math.min(now - this.lastStep, STEP_MS * 2);
    this.lastStep = now;
    if (!this.session || document.visibilityState !== 'visible') return;
    this.visibleMs += dt;
    if (now - this.lastInput < IDLE_MS && this.inGame()) this.playingMs += dt;
    this.remember();
    if (now - this.sentAt >= HEARTBEAT_MS) void this.send();
  }

  private onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = Date.now();
      this.remember();
      void this.send(true);
      return;
    }
    this.lastStep = Date.now();
    if (this.session && this.hiddenAt && Date.now() - this.hiddenAt > NEW_SESSION_AFTER_MS) this.begin(false);
  }

  /** Crea o actualiza la fila de la sesión. `leaving`: sin esperar respuesta (la pestaña se va). */
  private async send(leaving = false): Promise<void> {
    if (!this.session || !this.enabled) return;
    if (leaving && !this.opened) return; // todavía no existe la fila
    this.sentAt = Date.now();
    const mine = Ranking.myScore();
    const body: Record<string, unknown> = {
      action: 'session',
      key: Ranking.secretKey,
      session: this.session,
      minutes: round1(this.visibleMs / 60_000),
      playing: round1(this.playingMs / 60_000),
      mission: StoryState.missionId,
      missions: mine.missions,
      score: mine.score,
    };
    if (!this.opened) {
      const geo = await this.geo;
      Object.assign(body, sessionInfo(geo), { visit: this.visit });
    }
    const r = await postScript(body, leaving);
    if (r.ok && !this.opened) {
      this.opened = true;
      this.remember();
    }
  }
}

function readSession(): StoredSession | null {
  try {
    const s = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? 'null') as StoredSession | null;
    return s && /^[0-9a-f]{16}$/.test(s.id) ? s : null;
  } catch {
    return null;
  }
}

/** Lo que no cambia durante la sesión (va solo en el primer envío). */
function sessionInfo(geo: Geo | null): Record<string, unknown> {
  const now = new Date();
  const device = parseUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    localDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    localHour: now.getHours(),
    weekday: DAYS[now.getDay()],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    language: navigator.language ?? '',
    device: device.kind,
    os: device.os,
    browser: device.browser,
    screen: `${window.screen.width}x${window.screen.height}`,
    pwa: standalone,
    source: trafficSource(window.location.search, document.referrer, window.location.hostname),
    country: geo?.country ?? '',
    region: geo?.region ?? '',
    city: geo?.city ?? '',
    // Solo para que el Apps Script calcule el hash: la IP no se guarda.
    ip: geo?.ip ?? '',
  };
}

/** Cuántas sesiones lleva este navegador (la primera = jugador nuevo). */
function bumpVisits(): number {
  let visits = 0;
  try {
    visits = Number((JSON.parse(window.localStorage.getItem(STORAGE_KEYS.usage) ?? '{}') as { visits?: number }).visits) || 0;
  } catch {
    // Sin almacenamiento.
  }
  visits += 1;
  try {
    window.localStorage.setItem(STORAGE_KEYS.usage, JSON.stringify({ visits }));
  } catch {
    // Sin almacenamiento.
  }
  return visits;
}

async function fetchGeo(): Promise<Geo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
  try {
    const res = await fetch(GEO_URL, { signal: ctrl.signal, cache: 'no-store' });
    const d = (await res.json()) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    return { ip: str(d.ip), city: str(d.city), region: str(d.region), country: str(d.country_code) || str(d.country) };
  } catch {
    // Bloqueado (algunos bloqueadores de anuncios lo frenan) o sin red: va sin ubicación.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const pad = (n: number): string => String(n).padStart(2, '0');
const round1 = (n: number): number => Math.round(n * 10) / 10;

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export const UsageStats = new UsageStatsImpl();
