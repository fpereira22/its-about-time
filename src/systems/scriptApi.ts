import { RANKING_SCRIPT_URL } from '../config/ranking';

/**
 * Llamadas a la aplicación web de Apps Script (apps-script/Ranking.gs) para el respaldo en la nube y
 * los datos de uso. Va como text/plain: con JSON el navegador haría una consulta previa de CORS que
 * Apps Script no responde.
 */

const TIMEOUT_MS = 15_000;
/** Límite del navegador para un envío con `keepalive` (el que sobrevive al cerrar la pestaña). */
const KEEPALIVE_MAX = 60_000;

export type ScriptReply = { ok: true; [k: string]: unknown } | { ok: false; error: string };

export const scriptConfigured = (): boolean => RANKING_SCRIPT_URL !== '';

/**
 * Manda `body` y devuelve la respuesta. Con `leaving` (la pestaña se está cerrando u ocultando) usa
 * keepalive y no espera la respuesta: el navegador la manda aunque la página ya no exista.
 */
export async function postScript(body: Record<string, unknown>, leaving = false): Promise<ScriptReply> {
  if (!scriptConfigured()) return { ok: false, error: 'not_configured' };
  const text = JSON.stringify(body);
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: text };
  if (leaving) {
    if (text.length > KEEPALIVE_MAX) return { ok: false, error: 'too_big' };
    void fetch(RANKING_SCRIPT_URL, { ...init, keepalive: true }).catch(() => undefined);
    return { ok: true };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RANKING_SCRIPT_URL, { ...init, signal: ctrl.signal });
    const data = (await res.json().catch(() => null)) as ScriptReply | null;
    return data && typeof data === 'object' && 'ok' in data ? data : { ok: false, error: 'bad_reply' };
  } catch {
    return { ok: false, error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Automatizado (Playwright: capturas de las promos y pruebas) o modo admin: no se manda nada. */
export function isAutomated(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}
