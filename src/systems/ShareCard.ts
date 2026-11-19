import { MISSIONS } from './Mission';
import { Ranking, topPlayers } from './Ranking';
import { StoryState } from './StoryState';

/**
 * Tarjeta para compartir en redes (y LinkedIn): una imagen 1200x627 con el look del juego y un texto
 * listo para pegar. Todo se dibuja en un canvas del navegador: no sale ningún dato del dispositivo.
 */

export interface ShareStats {
  name: string;
  score: number;
  total: number;
  missions: number;
  missionTotal: number;
  /** Puesto en el Top del ranking (solo si la planilla lo conoce y el jugador está publicado). */
  rank: number | null;
  hours: string;
  /** Misión recién completada (al compartir desde el resumen), o null. */
  mission: string | null;
}

export const SHARE_W = 1200;
export const SHARE_H = 627;

/** Horas de juego como "3 h 20 min" o "45 min". */
export function formatPlayTime(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function buildShareStats(mission: string | null = null): ShareStats {
  const mine = Ranking.myScore();
  const id = Ranking.playerId;
  let rank: number | null = null;
  if (id) {
    const all = topPlayers(Ranking.cached.players, Number.MAX_SAFE_INTEGER);
    const i = all.findIndex((p) => p.id === id);
    if (i >= 0) rank = i + 1;
  }
  return {
    name: Ranking.playerName ?? Ranking.suggestedName ?? 'Jugador',
    score: mine.score,
    total: mine.total,
    missions: mine.missions,
    missionTotal: MISSIONS.length,
    rank,
    hours: formatPlayTime(StoryState.playTimeMs),
    mission,
  };
}

/** Dirección del juego para el enlace (donde esté publicado). */
export function gameUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Texto para pegar junto a la imagen. */
export function shareText(s: ShareStats): string {
  const lines = [s.mission ? `Terminé «${s.mission}» en It's About Time, un juego de aventura en pixel art ambientado en Chile y Colombia.` : `Estoy jugando It's About Time, un juego de aventura en pixel art ambientado en Chile y Colombia.`];
  lines.push(`${s.score}/${s.total} en mi progreso, ${s.missions} de ${s.missionTotal} misiones${s.rank ? ` y puesto #${s.rank} en el ranking` : ''}.`);
  lines.push('Pruébalo y cuéntame cuánto sacas:');
  return lines.join('\n');
}

const INK = '#14182a';
const PANEL = '#fbf7ee';
const ACCENT = '#e0a020';

/** Dibuja la tarjeta. Espera las tipografías del juego para que se vea como en pantalla. */
export async function renderShareImage(s: ShareStats): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('48px "Silkscreen"'), document.fonts.load('600 40px "Pixelify Sans"'), document.fonts.load('32px "Pixelify Sans"')]);
  } catch {
    // Sin las fuentes del juego cae a monospace.
  }
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('canvas');
  c.imageSmoothingEnabled = false;

  // Cielo del atardecer: franjas duras, como el juego.
  const bands = ['#1c2a48', '#273a62', '#3a4a7c', '#5a5a92', '#8a6a9c', '#c47a8a', '#e89a7a'];
  const bandH = Math.ceil(SHARE_H / bands.length);
  bands.forEach((b, i) => {
    c.fillStyle = b;
    c.fillRect(0, i * bandH, SHARE_W, bandH);
  });
  // Estrellas de pixeles (siempre las mismas: nada al azar, la imagen sale igual cada vez).
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i++) {
    const x = (i * 337) % SHARE_W;
    const y = (i * 151) % 300;
    c.globalAlpha = 0.25 + ((i * 7) % 5) / 8;
    c.fillRect(x, y, 4, 4);
  }
  c.globalAlpha = 1;
  // Ciudad de siluetas abajo.
  c.fillStyle = INK;
  let x = 0;
  for (let i = 0; x < SHARE_W; i++) {
    const w = 48 + ((i * 53) % 4) * 24;
    const h = 60 + ((i * 97) % 6) * 22;
    c.fillRect(x, SHARE_H - h, w, h);
    x += w;
  }
  c.fillStyle = '#f0d048';
  for (let i = 0; i < 60; i++) c.fillRect(((i * 211) % (SHARE_W - 16)) + 8, SHARE_H - 20 - ((i * 37) % 90), 8, 8);

  // Tarjeta central.
  const px = 90;
  const py = 70;
  const pw = SHARE_W - px * 2;
  const ph = 450;
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(px + 8, py + 10, pw, ph);
  c.fillStyle = PANEL;
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = INK;
  c.lineWidth = 8;
  c.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

  c.textBaseline = 'top';
  c.fillStyle = ACCENT;
  c.font = '32px "Silkscreen", monospace';
  c.fillText(s.mission ? 'MISIÓN COMPLETADA' : 'MI PROGRESO', px + 40, py + 36);
  c.fillStyle = INK;
  c.font = '600 76px "Pixelify Sans", monospace';
  c.fillText("It's About Time", px + 40, py + 80);
  c.fillStyle = '#5a5470';
  c.font = '32px "Pixelify Sans", monospace';
  c.fillText(s.mission ? clip(c, s.mission, pw - 80) : 'Aventura en pixel art · Chile y Colombia', px + 40, py + 176);

  // Cifras.
  const stats: Array<[string, string]> = [
    ['PROGRESO', `${s.score}/${s.total}`],
    ['MISIONES', `${s.missions}/${s.missionTotal}`],
    [s.rank ? 'RANKING' : 'JUGADO', s.rank ? `#${s.rank}` : s.hours],
  ];
  const colW = (pw - 80) / stats.length;
  stats.forEach(([label, value], i) => {
    const cx = px + 40 + i * colW;
    c.fillStyle = '#e9e2d2';
    c.fillRect(cx, py + 240, colW - 24, 130);
    c.fillStyle = '#7a7488';
    c.font = '24px "Silkscreen", monospace';
    c.fillText(label, cx + 20, py + 256);
    c.fillStyle = INK;
    c.font = '600 64px "Pixelify Sans", monospace';
    c.fillText(value, cx + 20, py + 296);
  });
  c.fillStyle = '#5a5470';
  c.font = '30px "Pixelify Sans", monospace';
  c.fillText(`${clip(c, s.name, 560)} · ${s.hours} jugadas`, px + 40, py + 392);

  // Pie.
  c.fillStyle = '#ffffff';
  c.font = '30px "Silkscreen", monospace';
  c.textAlign = 'center';
  c.fillText(new URL(gameUrl()).host.toUpperCase(), SHARE_W / 2, py + ph + 40);
  c.textAlign = 'left';

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/** Recorta con «…» para que `text` quepa en `max` px. */
function clip(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

