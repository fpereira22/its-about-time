import { CHANGELOG } from '../data/changelog';
import { Admin } from './Admin';
import { packText, parseUserAgent } from './cloudCodec';
import { currentMission } from './Mission';
import { Ranking } from './Ranking';
import { isAutomated, postScript, scriptConfigured, type ScriptReply } from './scriptApi';
import { StoryState } from './StoryState';

/**
 * Reporte de problemas (Ajustes → Reportar un problema, hoja privada `bug_reports` del Apps Script).
 *
 * Manda lo que el jugador escribe más el contexto que ayuda a repetir el fallo: versión del juego, equipo,
 * misión y lugar, los últimos errores de la consola y (si lo acepta) su partida para abrirla igual.
 * Sin Apps Script o sin internet, el reporte se puede copiar y mandar a mano.
 */

export const BUG_TEXT_MAX = 600;
const ERRORS_KEPT = 6;
const ERROR_CHARS = 240;

const errors: string[] = [];

/** Guarda los últimos errores de la página para adjuntarlos a un reporte (una sola vez al arrancar). */
export function attachErrorLog(): void {
  const keep = (text: string): void => {
    errors.push(text.replace(/\s+/g, ' ').slice(0, ERROR_CHARS));
    if (errors.length > ERRORS_KEPT) errors.shift();
  };
  window.addEventListener('error', (e) => keep(`${e.message} @${(e.filename ?? '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => keep(`promesa: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`));
}

/** Contexto legible del reporte (también es lo que se copia si no hay conexión). */
export function reportContext(): Record<string, string> {
  const d = parseUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  const loc = StoryState.location;
  return {
    version: CHANGELOG[0]?.id ?? '?',
    equipo: `${d.kind} · ${d.os} · ${d.browser}`,
    pantalla: `${window.innerWidth}x${window.innerHeight}`,
    mision: currentMission().id,
    lugar: loc ? `${loc.map}/${loc.spawn}` : 'sin lugar guardado',
    minutos: String(Math.round(StoryState.playTimeMs / 60_000)),
    errores: errors.length ? errors.join(' | ') : 'ninguno',
  };
}

/** El reporte como texto plano, para copiarlo. */
export function reportAsText(text: string): string {
  const lines = Object.entries(reportContext()).map(([k, v]) => `${k}: ${v}`);
  return `${text.trim()}\n\n---\n${lines.join('\n')}`;
}

export const canSendReports = (): boolean => scriptConfigured() && !Admin.active && !isAutomated();

/** Manda el reporte. `withSave`: adjunta la partida actual (comprimida). */
export async function sendBugReport(text: string, withSave: boolean): Promise<ScriptReply> {
  const message = text.trim().slice(0, BUG_TEXT_MAX);
  if (message.length < 5) return { ok: false, error: 'Cuéntanos un poco más qué pasó.' };
  if (!canSendReports()) return { ok: false, error: 'No hay conexión con el servidor. Copia el reporte y mándalo a mano.' };
  let save = '';
  if (withSave) {
    try {
      save = await packText(JSON.stringify(StoryState.snapshot()));
    } catch {
      save = '';
    }
  }
  const r = await postScript({ action: 'bug', key: Ranking.secretKey, text: message, context: reportContext(), save });
  if (r.ok) return r;
  const reasons: Record<string, string> = {
    too_fast: 'Espera un momento antes de mandar otro reporte.',
    offline: 'Sin internet. Copia el reporte y mándalo a mano.',
    bad_request: 'El servidor todavía no acepta reportes (falta actualizarlo).',
  };
  return { ok: false, error: reasons[r.error] ?? 'No se pudo enviar. Copia el reporte y mándalo a mano.' };
}
