import Phaser from 'phaser';
import { FONT_TEXT, getZoom } from '../config/display';

export const THEME = {
  panel: 0xfbf7ee,
  panelEdge: 0x2a2433,
  panelInner: 0xe9e2d2,
  ink: '#2a2433',
  inkMuted: '#7a7488',
  accent: 0x2f6fd0,
  accentCss: '#2f6fd0',
  dark: 0x1a2236,
  darkCss: '#1a2236',
  white: '#ffffff',
};

/** Color del puesto 1, 2 y 3 en los rankings (oro, plata y bronce que se leen sobre el panel claro). */
export const MEDAL_CSS = ['#c8901c', '#8a8498', '#a8643a'];

/**
 * Pixelify Sans une "fi" y "fl" en una ligadura que a tamaño chico se lee como una "A" ("final" → "Anal").
 * Un separador invisible (U+200C) entre las dos letras la evita.
 */
export function noLigatures(text: string): string {
  return text.replace(/f(?=[il])/g, 'f‌');
}

/** Texto con la resolución del zoom actual (nítido a cualquier escala), sin las ligaduras de la fuente. */
export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, noLigatures(text), { fontFamily: FONT_TEXT, fontSize: '10px', color: '#ffffff', ...style }).setResolution(getZoom());
  const setText = t.setText.bind(t);
  t.setText = (value: string | string[]) => setText(Array.isArray(value) ? value.map(noLigatures) : noLigatures(value));
  return t;
}

export interface PanelOptions {
  radius?: number;
  fill?: number;
  edge?: number;
  shadow?: boolean;
  /** Opacidad del panel (< 1 para paneles translúcidos del HUD). */
  alpha?: number;
}

/** Panel redondeado con borde fino y sombra suave en capas. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {},
): void {
  const r = opts.radius ?? 6;
  if (opts.shadow !== false) {
    g.fillStyle(0x000000, 0.08).fillRoundedRect(x - 1, y + 1, w + 2, h + 3, r + 1);
    g.fillStyle(0x000000, 0.14).fillRoundedRect(x, y + 2, w, h, r);
  }
  const alpha = opts.alpha ?? 1;
  if (alpha < 1) {
    // Translúcido: el borde va como trazo para que no se vea a través del relleno.
    g.fillStyle(opts.fill ?? THEME.panel, alpha).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(1, opts.edge ?? THEME.panelEdge, alpha).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    return;
  }
  g.fillStyle(opts.edge ?? THEME.panelEdge, 1).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(opts.fill ?? THEME.panel, 1).fillRoundedRect(x + 1, y + 1, w - 2, h - 2, r - 1);
}

/** Recorta un texto con "..." hasta que mida como máximo `maxWidth` px. */
export function fitText(text: Phaser.GameObjects.Text, value: string, maxWidth: number): void {
  text.setText(value);
  if (text.width <= maxWidth) return;
  let chars = Array.from(value);
  while (chars.length > 1 && text.width > maxWidth) {
    chars = chars.slice(0, -1);
    text.setText(chars.join('').trimEnd() + '...');
  }
}

/** Triángulo pequeño (indicador de "continuar" o cursor de opciones). */
export function drawTriangle(
  g: Phaser.GameObjects.Graphics,
  dir: 'down' | 'right',
  color: number,
  size = 3,
): void {
  g.fillStyle(color, 1);
  if (dir === 'down') g.fillTriangle(-size, -size / 2, size, -size / 2, 0, size);
  else g.fillTriangle(-size / 2, -size, -size / 2, size, size, 0);
}
