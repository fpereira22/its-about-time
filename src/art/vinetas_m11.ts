import Phaser from 'phaser';
import type { HumanLook } from './characters';
import { playerLook } from '../systems/PlayerLook';
import type { Backdrop, VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { makeText } from '../ui/theme';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';
import { bust, INK, lookOf, type BustOpts } from './vinetas_m5';
import { sinGorro } from './vinetas_m7';
import { BACKDROPS, compose, PROPS, type Prop } from './vinetas_m8';
import { M11_SPECS } from './vinetas_m11_specs';

/**
 * Viñetas de la misión 10 (prefijo m11_: Laura, Sira, La Vorágine). Las por especificación (fondo + bustos +
 * objetos + efecto) están en vinetas_m11_specs.ts, generado junto con los diálogos; aquí van los fondos y objetos
 * nuevos del compositor y las escenas propias: los chats animados, las fotos del celular (Bakio, Gaztelugatxe,
 * Txinparta, Walle...), la noche de luna en el 1104, la nube de Danilo en el balcón, el beso y el final.
 * Panel de 220 × 108 px.
 */

const W = 220;
const H = 108;

const me = (): HumanLook => sinGorro(playerLook());
const laura = (): HumanLook => lookOf('laura');
const sira = (): HumanLook => lookOf('sira_m7');

// ---------------------------------------------------------------------------
// Ayudas de dibujo
// ---------------------------------------------------------------------------

function sky(g: G, x: number, y: number, w: number, h: number, top: string, low: string): void {
  g.fillStyle(hex(top), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(low), 1).fillRect(x, y + h * 0.5, w, h * 0.5);
}

function stars(g: G, x: number, y: number, w: number, h: number, n = 24): void {
  for (let i = 0; i < n; i++) g.fillStyle(0xf8f4ec, 0.7 + (i % 3) * 0.1).fillRect(x + ((i * 53) % w), y + ((i * 29) % h), 1, 1);
}

function cityLights(g: G, x: number, y: number, w: number, h: number, n = 160): void {
  g.fillStyle(hex('#1c2440'), 1).fillRect(x, y, w, h);
  const cs = [0xf8dc68, 0xf8f4ec, 0xe8a040, 0x9cd0f0];
  for (let i = 0; i < n; i++) g.fillStyle(cs[i % 4], 0.85).fillRect(x + ((i * 37) % w), y + 2 + ((i * 13) % Math.max(3, h - 4)), 1, 1);
}

function moon(g: G, cx: number, cy: number, r: number, glow = true): void {
  if (glow) for (let k = 3; k > 0; k--) g.fillStyle(0xe8f0ff, 0.06 * k).fillCircle(cx, cy, r + k * 5);
  g.fillStyle(hex('#f4f0e0'), 1).fillCircle(cx, cy, r);
  g.fillStyle(hex('#dcd8c8'), 1).fillCircle(cx - r * 0.3, cy - r * 0.2, r * 0.22).fillCircle(cx + r * 0.25, cy + r * 0.3, r * 0.16).fillCircle(cx + r * 0.35, cy - r * 0.35, r * 0.1);
}

function hills(g: G, x: number, base: number, w: number, color: string, hgt = 30, n = 4): void {
  for (let i = 0; i < n; i++) {
    const hx = x + (i * w) / (n - 1) - 30;
    g.fillStyle(hex(color), 1).fillTriangle(hx, base, hx + 50, base - hgt + (i % 2) * 8, hx + 110, base);
  }
}

function trees(g: G, x: number, y: number, w: number, n = 10, c = '#2c6a34'): void {
  for (let i = 0; i < n; i++) {
    const tx = x + ((i * 41) % w);
    g.fillStyle(hex(c), 1).fillCircle(tx, y + (i % 3) * 3, 10 + (i % 3) * 2);
    g.fillStyle(hex('#3c8040'), 1).fillCircle(tx - 3, y - 3 + (i % 3) * 3, 5);
  }
}

/** Busto con opciones (atajo). */
function face(g: G, look: HumanLook, cx: number, cy: number, s: number, o: BustOpts = {}): void {
  bust(g, look, Math.round(cx), Math.round(cy), s, o);
}

function txt(kit: VinetaKit, stage: Layer, x: number, y: number, s: string, color: string, size = 6, width = 120, align: 'left' | 'center' = 'left'): Phaser.GameObjects.Text {
  const t = makeText(kit.scene, x, y, s, { fontSize: `${size}px`, color, align, wordWrap: { width } });
  if (align === 'center') t.setOrigin(0.5, 0);
  stage.add(t);
  return t;
}

// ---------------------------------------------------------------------------
// Fondos nuevos del compositor
// ---------------------------------------------------------------------------

const M11_BACKDROPS: Record<string, Backdrop> = {
  aula: (g, x, y, w, h) => {
    g.fillStyle(hex('#e8e4dc'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#f8f8f4'), 1).fillRect(x + 30, y + 8, 160, 52);
    g.lineStyle(1, hex('#2c64c0'), 1);
    for (const [a, b, c, d] of [[50, 20, 90, 40], [90, 40, 140, 22], [90, 40, 130, 52], [140, 22, 170, 40]] as const) g.lineBetween(x + a, y + b, x + c, y + d);
    for (const [cx, cy] of [[50, 20], [90, 40], [140, 22], [130, 52], [170, 40]] as const) disc(g, x + cx, y + cy, 3, '#c8303c');
    g.fillStyle(hex('#8c6a48'), 1).fillRect(x, y + 80, w, h - 80);
    for (let i = 0; i < 5; i++) g.fillStyle(hex('#a8845c'), 1).fillRect(x + 10 + i * 44, y + 84, 34, 6);
  },
  balcon_noche: (g, x, y, w, h) => {
    sky(g, x, y, w, 60, '#0c1430', '#1c2448');
    stars(g, x, y, w, 40);
    moon(g, x + 176, y + 20, 12);
    cityLights(g, x, y + 56, w, 30, 140);
    g.fillStyle(hex('#3a3c48'), 1).fillRect(x, y + 86, w, h - 86);
    g.fillStyle(hex('#9cc8e8'), 0.25).fillRect(x, y + 70, w, 16);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 68, w, 2);
    for (let i = 0; i < w; i += 30) g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + i, y + 68, 2, 18);
  },
  biblioteca: (g, x, y, w, h) => {
    g.fillStyle(hex('#e8dcc4'), 1).fillRect(x, y, w, h);
    const cs = ['#c8303c', '#2c64c0', '#2c9c58', '#e8b828', '#7c3ca8', '#e8742c', '#3a3c48'];
    for (let s = 0; s < 3; s++) {
      g.fillStyle(hex('#8c5a3c'), 1).fillRect(x, y + 10 + s * 22, w, 3);
      for (let i = 0; i < 40; i++) g.fillStyle(hex(cs[(i * 3 + s) % cs.length]), 1).fillRect(x + 2 + i * 5.5, y + 13 + s * 22 - 0, 4, 17 - (i % 3));
    }
    g.fillStyle(hex('#a07c54'), 1).fillRect(x, y + 80, w, h - 80);
    g.fillStyle(hex('#f8e8a8'), 0.2).fillTriangle(x + 60, y, x + 30, y + 80, x + 90, y + 80);
  },
  campus: (g, x, y, w, h) => {
    sky(g, x, y, w, 50, '#7cb8e8', '#c8e4f4');
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 20, y + 22, 70, 36).fillRect(x + 130, y + 18, 80, 40);
    for (let i = 0; i < 6; i++) g.fillStyle(hex('#9cd0f0'), 1).fillRect(x + 26 + i * 11, y + 28, 7, 8).fillRect(x + 136 + i * 12, y + 26, 8, 8);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x, y + 56, w, h - 56);
    g.fillStyle(hex('#3c8cb0'), 1).fillEllipse(x + 110, y + 76, 80, 14);
    trees(g, x + 6, y + 52, w - 12, 6);
    g.fillStyle(hex('#c8b89c'), 1).fillRect(x, y + 92, w, 8);
  },
  cancha_gld: (g, x, y, w, h) => {
    sky(g, x, y, w, 46, '#e8a060', '#f4d0a0');
    for (let i = 0; i < 4; i++) {
      g.fillStyle(hex('#6c6c74'), 1).fillRect(x + 10 + i * 66, y + 4, 3, 50);
      g.fillStyle(hex('#f8f4e0'), 1).fillRect(x + 6 + i * 66, y + 2, 11, 4);
    }
    g.lineStyle(1, hex('#4a4a54'), 0.6);
    for (let i = 0; i < w; i += 6) g.lineBetween(x + i, y + 20, x + i + 6, y + 50);
    g.fillStyle(hex('#3c9c48'), 1).fillRect(x, y + 50, w, h - 50);
    for (let i = 0; i < w; i += 20) g.fillStyle(hex('#48ac54'), 1).fillRect(x + i, y + 50, 10, h - 50);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y + 74, w, 1).fillRect(x + w / 2, y + 50, 1, h - 50);
  },
  carro_noche: (g, x, y, w, h) => {
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#141c34'), 1).fillRect(x + 10, y + 6, w - 20, 42);
    cityLights(g, x + 10, y + 30, w - 20, 18, 70);
    for (const lx of [30, 100, 170]) g.fillStyle(0xf8dc68, 0.8).fillCircle(x + lx, y + 14, 2);
    g.fillStyle(hex('#2a2a34'), 1).fillRect(x, y + 50, w, h - 50);
    g.fillStyle(hex('#3a3a48'), 1).fillRect(x + 6, y + 56, w - 12, 16);
    g.fillStyle(hex('#58d4d0'), 1).fillRect(x + 100, y + 60, 20, 4);
  },
  chorrera: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2c30'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 18; i++) g.fillStyle(hex(i % 2 ? '#3a3c40' : '#2c4a30'), 1).fillRect(x + ((i * 47) % w), y + ((i * 23) % 70), 26, 14);
    g.fillStyle(hex('#e8f4f8'), 0.95).fillRect(x + w / 2 - 18, y, 36, 80);
    for (let i = 0; i < 12; i++) g.fillStyle(hex('#bfe0ec'), 1).fillRect(x + w / 2 - 16 + ((i * 7) % 32), y + ((i * 13) % 76), 2, 8);
    g.fillStyle(hex('#2a7c94'), 1).fillRect(x, y + 80, w, h - 80);
    g.fillStyle(0xffffff, 0.6).fillEllipse(x + w / 2, y + 82, 90, 10);
  },
  chorrera_bosque: (g, x, y, w, h) => {
    sky(g, x, y, w, 40, '#9cc8e0', '#d0e4ec');
    trees(g, x, y + 30, w, 14, '#2c5a30');
    g.fillStyle(hex('#3c6a34'), 1).fillRect(x, y + 40, w, h - 40);
    trees(g, x + 10, y + 50, w - 20, 8, '#3c7c3c');
    g.fillStyle(hex('#8c6a44'), 1).fillTriangle(x + 90, y + h, x + 130, y + h, x + 112, y + 62);
    g.fillStyle(hex('#a07c54'), 1).fillRect(x + 160, y + 58, 4, 30);
    g.fillStyle(hex('#c8a070'), 1).fillRect(x + 148, y + 56, 30, 10);
  },
  cocina_805: (g, x, y, w, h) => {
    g.fillStyle(hex('#3a3448'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#141c34'), 1).fillRect(x + 140, y + 8, 70, 44);
    cityLights(g, x + 140, y + 30, 70, 22, 50);
    g.fillStyle(hex('#5a5468'), 1).fillRect(x, y + 70, w, h - 70);
    g.fillStyle(hex('#8c8494'), 1).fillRect(x, y + 66, w, 6);
    g.fillStyle(0xf8e070, 0.12).fillCircle(x + 60, y + 30, 40);
  },
  colina_noche: (g, x, y, w, h) => {
    sky(g, x, y, w, 50, '#0c1430', '#1c2448');
    stars(g, x, y, w, 30);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 24, y + 22, 30, 28);
    g.fillStyle(hex('#c84c34'), 1).fillTriangle(x + 20, y + 22, x + 39, y + 10, x + 58, y + 22);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 34, y + 2, 10, 20);
    g.fillStyle(hex('#3a2418'), 1).fillRect(x + 34, y + 36, 9, 14);
    cityLights(g, x, y + 54, w, 30, 170);
    for (const fx of [80, 150, 200]) {
      g.fillStyle(hex('#2a2433'), 1).fillRect(x + fx, y + 28, 2, 30);
      g.fillStyle(0xf8dc68, 0.9).fillCircle(x + fx + 1, y + 28, 3);
    }
    g.fillStyle(hex('#5a5048'), 1).fillRect(x, y + 84, w, h - 84);
  },
  farma_noche: (g, x, y, w, h) => {
    sky(g, x, y, w, 30, '#10162c', '#1c2440');
    g.fillStyle(hex('#e8e4dc'), 1).fillRect(x + 6, y + 18, 120, 66);
    g.fillStyle(hex('#c8303c'), 1).fillRect(x + 14, y + 22, 104, 10);
    g.fillStyle(hex('#bfe8f8'), 0.85).fillRect(x + 16, y + 38, 40, 40).fillRect(x + 76, y + 38, 40, 40);
    g.fillStyle(hex('#6a4c38'), 1).fillRect(x + 136, y + 26, 84, 58);
    g.fillStyle(hex('#f8e8a8'), 0.85).fillRect(x + 146, y + 38, 30, 46);
    g.fillStyle(hex('#9c9c98'), 1).fillRect(x, y + 84, w, h - 84);
    g.fillStyle(hex('#e8c030'), 1).fillRect(x, y + 100, w, 2);
  },
  farmacia: (g, x, y, w, h) => {
    g.fillStyle(hex('#f4f4f0'), 1).fillRect(x, y, w, h);
    for (let s = 0; s < 3; s++) {
      g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + 10, y + 12 + s * 20, 90, 2);
      for (let i = 0; i < 14; i++) g.fillStyle(hex(['#c8303c', '#2c64c0', '#2c9c58', '#e8b828'][i % 4]), 1).fillRect(x + 12 + i * 6, y + 4 + s * 20, 4, 8);
    }
    g.fillStyle(hex('#bfe8f8'), 1).fillRect(x + 130, y + 6, 80, 64);
    for (let i = 0; i < 3; i++) g.fillStyle(hex('#8cc0d8'), 1).fillRect(x + 130, y + 26 + i * 20, 80, 2);
    g.fillStyle(hex('#d8d8d0'), 1).fillRect(x, y + 80, w, h - 80);
  },
  itsisi: (g, x, y, w, h) => {
    sky(g, x, y, w, 46, '#7cb8e8', '#c8e4f4');
    g.fillStyle(hex('#b85c3c'), 1).fillRect(x + 10, y + 18, 80, 44);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) g.fillStyle(hex('#9cd0f0'), 1).fillRect(x + 14 + i * 12, y + 22 + r * 10, 8, 6);
    g.fillStyle(hex('#9cc8e0'), 1).fillRect(x + 150, y + 14, 62, 48);
    g.lineStyle(1, hex('#5a6a7c'), 1);
    for (let i = 0; i < 6; i++) g.lineBetween(x + 150 + i * 12, y + 14, x + 150 + i * 12, y + 62);
    // El samán: copa ancha como una sombrilla.
    g.fillStyle(hex('#6a4c30'), 1).fillRect(x + 112, y + 34, 6, 30);
    g.fillStyle(hex('#3c7c3c'), 1).fillEllipse(x + 115, y + 30, 90, 26);
    g.fillStyle(hex('#4c9c48'), 1).fillEllipse(x + 108, y + 26, 60, 14);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x, y + 62, w, h - 62);
    g.fillStyle(hex('#c8783c'), 1).fillRect(x, y + 86, w, 12);
    for (let i = 0; i < w; i += 8) g.fillStyle(hex('#a85c2c'), 1).fillRect(x + i, y + 86, 1, 12);
  },
  living_laura: (g, x, y, w, h) => {
    g.fillStyle(hex('#3a3050'), 1).fillRect(x, y, w, h);
    // La ikurriña en la pared.
    g.fillStyle(hex('#c8303c'), 1).fillRect(x + 20, y + 10, 40, 26);
    g.lineStyle(3, hex('#2c9c58'), 1).lineBetween(x + 20, y + 10, x + 60, y + 36).lineBetween(x + 60, y + 10, x + 20, y + 36);
    g.lineStyle(2, hex('#f4f0e6'), 1).lineBetween(x + 40, y + 10, x + 40, y + 36).lineBetween(x + 20, y + 23, x + 60, y + 23);
    g.fillStyle(hex('#141c34'), 1).fillRect(x + 150, y + 8, 60, 46);
    cityLights(g, x + 150, y + 34, 60, 20, 40);
    g.fillStyle(0x9cd0f0, 0.1).fillRect(x + 70, y + 30, 60, 50);
    g.fillStyle(hex('#5a4c68'), 1).fillRect(x, y + 78, w, h - 78);
    for (let i = 0; i < 5; i++) g.fillStyle(hex(['#c8303c', '#2c64c0', '#e8b828'][i % 3]), 1).fillRect(x + 80 + i * 7, y + 72, 6, 6 - (i % 2));
  },
  mall: (g, x, y, w, h) => {
    g.fillStyle(hex('#e8e4ec'), 1).fillRect(x, y, w, h);
    const cs = ['#e868a8', '#2c64c0', '#e8b828', '#2c9c58'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle(hex(cs[i]), 1).fillRect(x + 6 + i * 54, y + 8, 48, 8);
      g.fillStyle(hex('#bfe0f0'), 1).fillRect(x + 8 + i * 54, y + 18, 44, 36);
    }
    g.fillStyle(hex('#a8a4b0'), 1).fillTriangle(x + 150, y + 80, x + 200, y + 30, x + 210, y + 80);
    g.fillStyle(hex('#d0ccd8'), 1).fillRect(x, y + 80, w, h - 80);
  },
  mirador_pance: (g, x, y, w, h) => {
    sky(g, x, y, w, 40, '#7cb8e8', '#d8ecf4');
    hills(g, x, y + 34, w, '#6c8c9c', 26, 4);
    g.fillStyle(0xffffff, 0.8).fillEllipse(x + 60, y + 12, 40, 7).fillEllipse(x + 170, y + 18, 46, 8);
    g.fillStyle(hex('#7cb85c'), 1).fillRect(x, y + 34, w, h - 34);
    hills(g, x, y + 60, w, '#5a9c48', 20, 5);
    g.lineStyle(2, hex('#c8e4f0'), 1);
    g.beginPath().moveTo(x, y + 80).lineTo(x + 60, y + 72).lineTo(x + 120, y + 78).lineTo(x + 220, y + 66).strokePath();
    g.fillStyle(hex('#3c7c3c'), 1).fillRect(x, y + 88, w, h - 88);
  },
  piscina_gld: (g, x, y, w, h) => {
    sky(g, x, y, w, 30, '#141c34', '#2a3456');
    for (const lx of [20, 110, 200]) g.fillStyle(0xf8f4e0, 1).fillRect(x + lx, y + 4, 10, 3);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 30, w, 10);
    g.fillStyle(hex('#2a8ab8'), 1).fillRect(x, y + 40, w, h - 40);
    for (let i = 0; i < 5; i++) g.fillStyle(hex(i % 2 ? '#e8303c' : '#f4f0e6'), 1).fillRect(x, y + 52 + i * 12, w, 1);
    for (let i = 0; i < 20; i++) g.fillStyle(0xffffff, 0.3).fillRect(x + ((i * 37) % w), y + 44 + ((i * 11) % 60), 6, 1);
  },
  pozo: (g, x, y, w) => {
    sky(g, x, y, w, 30, '#8cc0e0', '#c8e4f0');
    trees(g, x, y + 24, w, 12, '#2c6a34');
    g.fillStyle(hex('#6c6c64'), 1).fillEllipse(x + 30, y + 64, 70, 40).fillEllipse(x + 190, y + 60, 70, 46);
    g.fillStyle(hex('#8c8c84'), 1).fillEllipse(x + 26, y + 56, 50, 16).fillEllipse(x + 194, y + 50, 50, 16);
    g.fillStyle(hex('#1c5a54'), 1).fillEllipse(x + 110, y + 82, 150, 44);
    g.fillStyle(hex('#2a7c74'), 1).fillEllipse(x + 110, y + 78, 110, 26);
    for (let i = 0; i < 10; i++) g.fillStyle(0xe8f8f4, 0.5).fillRect(x + 50 + ((i * 23) % 120), y + 72 + ((i * 7) % 16), 8, 1);
  },
  resto_chileno: (g, x, y, w, h) => {
    g.fillStyle(hex('#c89c6c'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 14) g.fillStyle(hex('#b08858'), 1).fillRect(x + i, y, 1, 70);
    // La bandera de Chile.
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 14, y + 8, 48, 14);
    g.fillStyle(hex('#d42c2c'), 1).fillRect(x + 14, y + 22, 48, 14);
    g.fillStyle(hex('#1c3c9c'), 1).fillRect(x + 14, y + 8, 16, 14);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 21, y + 13, 3, 3);
    g.fillStyle(hex('#2a2a30'), 1).fillRect(x + 150, y + 8, 56, 34);
    g.fillStyle(hex('#3c8c4c'), 1).fillRect(x + 153, y + 11, 50, 28);
    g.fillStyle(hex('#6a4428'), 1).fillRect(x, y + 70, w, h - 70);
    g.fillStyle(hex('#8c5a34'), 1).fillRect(x, y + 66, w, 6);
  },
  salsoteca: (g, x, y, w, h) => {
    g.fillStyle(hex('#1c1024'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 7; i++) {
      disc(g, x + 18 + i * 31, y + 16, 9, '#0c0c10');
      disc(g, x + 18 + i * 31, y + 16, 3, ['#c8303c', '#e8b828', '#2c64c0'][i % 3]);
    }
    for (let i = 0; i < 5; i++) g.fillStyle([0xe868a8, 0x58d4d0, 0xf8dc68][i % 3], 0.14).fillTriangle(x + 30 + i * 44, y, x + i * 44, y + h, x + 60 + i * 44, y + h);
    g.fillStyle(hex('#7c5a3c'), 1).fillRect(x, y + 84, w, h - 84);
  },
  voragine: (g, x, y, w, h) => {
    sky(g, x, y, w, 44, '#7cb8e8', '#c8e4f4');
    hills(g, x, y + 44, w, '#4a7a5c', 36, 4);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x, y + 44, w, h - 44);
    for (const [hx, c] of [[20, '#f4f0e6'], [70, '#f8e8a8'], [150, '#f4f0e6']] as const) {
      g.fillStyle(hex('#b8542c'), 1).fillTriangle(x + hx - 4, y + 52, x + hx + 18, y + 40, x + hx + 40, y + 52);
      g.fillStyle(hex(c), 1).fillRect(x + hx, y + 52, 36, 20);
      g.fillStyle(hex('#2c9c58'), 1).fillRect(x + hx + 4, y + 58, 8, 14);
    }
    g.fillStyle(hex('#2a7c94'), 1).fillRect(x, y + 84, w, 14);
    for (let i = 0; i < 12; i++) g.fillStyle(0xe8f8f4, 0.7).fillRect(x + ((i * 37) % w), y + 86 + ((i * 5) % 10), 8, 1);
    g.fillStyle(hex('#a07c54'), 1).fillRect(x, y + 74, w, 10);
  },
};
Object.assign(BACKDROPS, M11_BACKDROPS);

// ---------------------------------------------------------------------------
// Objetos nuevos del compositor
// ---------------------------------------------------------------------------

const M11_PROPS: Record<string, Prop> = {
  bandeja: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 3, 28, 8, '#c8ccd4']]);
    disc(g, cx - 5, cy - 3, 4, '#f4f0e6');
    disc(g, cx + 6, cy - 3, 3, '#c8783c');
  },
  bufanda: (g, cx, cy) => {
    for (let i = 0; i < 6; i++) flat(g, [[cx - 12 + i * 4, cy - 6, 4, 14, i % 2 ? '#f4f0e6' : '#c8303c']]);
    g.lineStyle(1, hex(INK), 1).strokeRect(cx - 12, cy - 6, 24, 14);
  },
  chorrillana: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 2, 28, 8, '#f4f0e6']]);
    for (let i = 0; i < 8; i++) flat(g, [[cx - 11 + i * 3, cy - 6 + (i % 2) * 2, 2, 6, '#f0c050']]);
    flat(g, [[cx - 6, cy - 4, 6, 3, '#6a3c24'], [cx + 3, cy - 5, 5, 3, '#c8783c']]);
    disc(g, cx, cy - 6, 4, '#f8f4ec');
    disc(g, cx, cy - 6, 2, '#f0c030');
  },
  chulo_azul: (g, cx, cy) => {
    g.fillStyle(hex('#2c64c0'), 1).fillTriangle(cx - 18, cy, cx, cy - 8, cx + 18, cy).fillEllipse(cx, cy + 2, 14, 12);
    disc(g, cx, cy - 8, 4, '#1c3c8c');
    g.fillStyle(hex('#f8e070'), 1).fillTriangle(cx + 3, cy - 8, cx + 8, cy - 7, cx + 3, cy - 6);
  },
  completo: (g, cx, cy) => {
    outlined(g, [[cx - 16, cy - 2, 32, 8, '#e8b870']]);
    flat(g, [[cx - 15, cy - 4, 30, 3, '#c85a3c'], [cx - 14, cy - 7, 28, 4, '#7cb848'], [cx - 12, cy - 9, 24, 2, '#d83c30']]);
    for (let i = 0; i < 6; i++) flat(g, [[cx - 12 + i * 4, cy - 10, 2, 1, '#f8f4ec']]);
  },
  control: (g, cx, cy) => {
    outlined(g, [[cx - 4, cy - 10, 8, 20, '#2a2a34']]);
    disc(g, cx, cy - 6, 2, '#c8303c');
    flat(g, [[cx - 2, cy - 1, 4, 1, '#8c8c94'], [cx - 2, cy + 2, 4, 1, '#8c8c94']]);
  },
  cuaderno: (g, cx, cy) => {
    outlined(g, [[cx - 10, cy - 12, 20, 24, '#2c64c0']]);
    flat(g, [[cx - 8, cy - 8, 14, 2, '#f4f0e6']]);
  },
  entrada: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 6, 28, 12, '#f8dc68']]);
    flat(g, [[cx + 6, cy - 6, 1, 12, INK]]);
  },
  hamburguesa: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy - 4, 30, 14);
    g.fillStyle(hex('#d8a050'), 1).fillEllipse(cx, cy - 5, 28, 12);
    flat(g, [[cx - 14, cy, 28, 3, '#58b848'], [cx - 14, cy + 2, 28, 4, '#6a3c24'], [cx - 13, cy + 1, 26, 2, '#f8d040']]);
    outlined(g, [[cx - 13, cy + 6, 26, 4, '#d8a050']]);
    for (let i = 0; i < 5; i++) flat(g, [[cx - 8 + i * 4, cy - 8, 1, 1, '#f8f4ec']]);
  },
  helado: (g, cx, cy) => {
    g.fillStyle(hex('#d8a050'), 1).fillTriangle(cx - 6, cy - 2, cx + 6, cy - 2, cx, cy + 14);
    disc(g, cx, cy - 6, 7, '#f8e8c8');
    disc(g, cx - 2, cy - 8, 3, '#fff8e8');
  },
  jugo_lulo: (g, cx, cy) => {
    outlined(g, [[cx - 6, cy - 10, 12, 20, '#c8d84c']]);
    flat(g, [[cx - 5, cy - 9, 10, 3, '#e8f0a0'], [cx + 2, cy - 14, 1, 8, '#e8606a']]);
  },
  libro: (g, cx, cy) => {
    outlined(g, [[cx - 11, cy - 14, 22, 28, '#2c6a34']]);
    flat(g, [[cx - 9, cy - 10, 18, 3, '#e8c060'], [cx - 9, cy + 8, 18, 2, '#e8c060'], [cx + 9, cy - 14, 2, 28, '#f4f0e6']]);
  },
  llave: (g, cx, cy) => {
    g.lineStyle(2, hex('#c8a040'), 1).strokeCircle(cx - 6, cy, 4);
    flat(g, [[cx - 2, cy - 1, 12, 2, '#c8a040'], [cx + 6, cy + 1, 2, 3, '#c8a040'], [cx + 2, cy + 1, 2, 2, '#c8a040']]);
    outlined(g, [[cx - 12, cy + 6, 8, 6, '#c8303c']]);
  },
  mandarina: (g, cx, cy) => {
    disc(g, cx, cy, 8, INK);
    disc(g, cx, cy, 7, '#f0882c');
    flat(g, [[cx - 1, cy - 9, 2, 3, '#3c8c3c'], [cx - 3, cy - 3, 2, 2, '#f8b060']]);
  },
  maqueta: (g, cx, cy) => {
    outlined(g, [[cx - 20, cy - 2, 40, 10, '#f4f0e6'], [cx - 14, cy - 12, 28, 10, '#f4f0e6'], [cx - 8, cy - 20, 16, 8, '#f4f0e6']]);
    disc(g, cx, cy - 4, 5, '#5aa04a');
  },
  mochila: (g, cx, cy) => {
    outlined(g, [[cx - 10, cy - 12, 20, 24, '#2c4c8c']]);
    flat(g, [[cx - 7, cy + 2, 14, 7, '#3c5c9c'], [cx - 4, cy - 15, 8, 3, '#2c4c8c']]);
  },
  moneda: (g, cx, cy) => {
    disc(g, cx, cy, 8, INK);
    disc(g, cx, cy, 7, '#e8c040');
    disc(g, cx, cy, 4, '#f8dc68');
  },
  paleta_pinpon: (g, cx, cy) => {
    disc(g, cx - 3, cy - 3, 9, INK);
    disc(g, cx - 3, cy - 3, 8, '#c8303c');
    flat(g, [[cx + 3, cy + 3, 4, 10, '#8c5a34']]);
    disc(g, cx + 12, cy + 6, 2, '#f8f4ec');
  },
  pandebono: (g, cx, cy) => {
    for (const dx of [-9, 0, 9]) {
      disc(g, cx + dx, cy, 6, INK);
      disc(g, cx + dx, cy, 5, '#e8b860');
      disc(g, cx + dx - 1, cy - 2, 2, '#f4d490');
    }
  },
  salchipapa: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 2, 28, 10, '#f4f0e6']]);
    for (let i = 0; i < 9; i++) flat(g, [[cx - 12 + i * 3, cy - 7 + (i % 3), 2, 7, '#f0c050']]);
    for (let i = 0; i < 4; i++) flat(g, [[cx - 10 + i * 6, cy - 4, 4, 3, '#c8583c']]);
    flat(g, [[cx - 12, cy - 9, 24, 1, '#f0a0b0'], [cx - 8, cy - 8, 16, 1, '#f8e070']]);
  },
  salpicon: (g, cx, cy) => {
    outlined(g, [[cx - 7, cy - 8, 14, 18, '#f8c0c8']]);
    for (let i = 0; i < 6; i++) flat(g, [[cx - 5 + (i % 3) * 4, cy - 4 + Math.floor(i / 3) * 6, 3, 3, ['#e8303c', '#f8d040', '#58b848'][i % 3]]]);
    disc(g, cx, cy - 9, 5, '#f8f4ec');
  },
  separador: (g, cx, cy) => {
    outlined(g, [[cx - 4, cy - 16, 8, 32, '#f4e8c8']]);
    disc(g, cx, cy - 8, 3, '#3c8c3c');
    flat(g, [[cx - 1, cy - 6, 2, 5, '#6a4c30'], [cx - 2, cy + 6, 4, 1, INK], [cx - 2, cy + 9, 4, 1, INK]]);
  },
  servilleta: (g, cx, cy) => {
    outlined(g, [[cx - 12, cy - 10, 24, 20, '#f8f8f4']]);
    flat(g, [[cx - 8, cy - 6, 16, 4, '#d42c2c'], [cx - 8, cy - 6, 5, 2, '#1c3c9c'], [cx - 8, cy + 2, 14, 1, '#8c8c94'], [cx - 8, cy + 5, 10, 1, '#8c8c94']]);
  },
  vela: (g, cx, cy) => {
    outlined(g, [[cx - 4, cy - 6, 8, 16, '#f4f0e6']]);
    g.fillStyle(0xf8dc68, 0.25).fillCircle(cx, cy - 11, 9);
    g.fillStyle(hex('#f8a030'), 1).fillEllipse(cx, cy - 10, 4, 7);
    g.fillStyle(hex('#f8f070'), 1).fillEllipse(cx, cy - 9, 2, 4);
  },
};
Object.assign(PROPS, M11_PROPS);

// ---------------------------------------------------------------------------
// Los chats (animados: puntitos de «escribiendo» y después la burbuja)
// ---------------------------------------------------------------------------

/** Una conversación en el celular: `in` = te escriben, `me` = tú. `photo` agrega una foto como primer mensaje. */
function chat(from: string, color: string, msgs: Array<string | [who: 'in' | 'me', text: string]>, photo?: Photo): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = addG(kit, stage);
    outlined(g, [[64, 2, 92, 104, '#1c1c24']]);
    flat(g, [[68, 8, 84, 94, '#e8e0d4'], [98, 4, 24, 2, '#3a3a48']]);
    flat(g, [[68, 8, 84, 13, color]]);
    disc(g, 77, 14, 4, '#f4f0e6');
    disc(g, 77, 14, 3, color);
    txt(kit, stage, 84, 10, from, '#ffffff', 7, 66);
    txt(kit, stage, 84, 17, 'en línea', '#e8f4e8', 4, 60);
    flat(g, [[70, 92, 66, 8, '#f8f8f4']]);
    disc(g, 144, 96, 4, color);
    // Los mensajes van en su propia capa, recortada entre la barra de arriba y la de escribir: si no caben, el chat sube.
    const TOP = 21;
    const BOTTOM = 90;
    const area = clipped(kit, stage, 68, TOP, 84, BOTTOM - TOP);
    const content = kit.scene.add.container(0, 0);
    area.add(content);
    const masks: G[] = [];
    let scroll = 0;
    let cursor = 24;
    const fit = (bottom: number): void => {
      const need = bottom - (BOTTOM - 1);
      if (need <= scroll) return;
      scroll = need;
      kit.tween({ targets: [content, ...masks], y: -scroll, duration: 220, ease: 'Sine.easeOut' });
    };
    let at = 300;
    if (photo) {
      kit.after(at, () => {
        const pg = addG(kit, content);
        outlined(pg, [[71, cursor, 56, 34, '#f8f8f4']]);
        masks.push(drawPhoto(kit, content, photo, 72, cursor + 1, 54, 32));
        fit(cursor + 34);
        cursor += 37;
      });
      at += 700;
    }
    for (const m of msgs) {
      const [who, text] = typeof m === 'string' ? (['in', m] as const) : m;
      const t0 = at;
      at += who === 'in' ? 1000 : 700;
      if (who === 'in') {
        const dots = addG(kit, content).setVisible(false);
        let typing = true;
        kit.after(t0, () => {
          const y = cursor;
          dots.setVisible(true);
          fit(y + 7);
          let k = 0;
          kit.every(150, () => {
            if (!typing) return;
            k++;
            dots.clear().fillStyle(0xffffff, 1).fillRoundedRect(71, y, 18, 7, 3);
            for (let i = 0; i < 3; i++) dots.fillStyle(0x8c8c98, i === k % 3 ? 1 : 0.4).fillCircle(75 + i * 5, y + 3.5, 1.2);
          });
        });
        kit.after(t0 + 550, () => {
          typing = false;
          dots.destroy();
          const t = makeText(kit.scene, 72, cursor, text, { fontSize: '5px', color: INK, backgroundColor: '#ffffff', padding: { x: 2, y: 1 }, wordWrap: { width: 60 } });
          content.add(t);
          sparkle(kit, content, 72 + t.width, cursor);
          fit(cursor + t.height);
          cursor += Math.ceil(t.height) + 3;
        });
      } else {
        kit.after(t0, () => {
          const t = makeText(kit.scene, 148, cursor, `${text} ✓✓`, { fontSize: '5px', color: INK, backgroundColor: '#d8f4c8', padding: { x: 2, y: 1 }, wordWrap: { width: 58 } }).setOrigin(1, 0);
          content.add(t);
          fit(cursor + t.height);
          cursor += Math.ceil(t.height) + 3;
        });
      }
    }
  };
}


const WA = '#3c9c58';
const LAURA_C = '#c8303c';
const SIRA_C = '#3c8c8c';

// ---------------------------------------------------------------------------
// Las fotos del celular
// ---------------------------------------------------------------------------

type Photo = (g: G, x: number, y: number, w: number, h: number, kit: VinetaKit, stage: Layer) => void;

/** Tamaño para el que están pensadas las fotos (la pantalla del celular de lado). */
const PHOTO_W = 160;
const PHOTO_H = 72;

/** Una capa dentro de `parent` que solo se ve en el rectángulo (x, y, w, h) del cuadro de la viñeta. */
function clipped(kit: VinetaKit, parent: Layer, x: number, y: number, w: number, h: number): Layer {
  const layer = kit.scene.add.container(0, 0);
  const m = kit.scene.make.graphics({}, false).fillRect(kit.panel.x + x, kit.panel.y + y, w, h);
  layer.setMask(m.createGeometryMask());
  layer.once('destroy', () => m.destroy());
  parent.add(layer);
  return layer;
}

/**
 * Dibuja una foto (pensada a 160×72) llenando el rectángulo (x, y, w, h): la escala hasta cubrirlo, la centra y
 * recorta lo que sobra, así los cerros, las velas o la lluvia nunca se salen del celular. Devuelve la forma del
 * recorte, por si la foto se mueve (el chat que sube).
 */
function drawPhoto(kit: VinetaKit, parent: Layer, photo: Photo, x: number, y: number, w: number, h: number): G {
  const s = Math.max(w / PHOTO_W, h / PHOTO_H);
  const layer = kit.scene.add.container(x + (w - PHOTO_W * s) / 2, y + (h - PHOTO_H * s) / 2).setScale(s);
  parent.add(layer);
  photo(addG(kit, layer), 0, 0, PHOTO_W, PHOTO_H, kit, layer);
  const m = kit.scene.make.graphics({}, false).fillRect(kit.panel.x + x, kit.panel.y + y, w, h);
  layer.setMask(m.createGeometryMask());
  layer.once('destroy', () => m.destroy());
  return m;
}

/** El celular de lado con una foto a pantalla completa y una línea de texto abajo. */
function foto(draw: Photo, caption: string, bar = '#e868a8'): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = addG(kit, stage);
    outlined(g, [[26, 8, 168, 94, '#1c1c24']]);
    flat(g, [[30, 12, 160, 86, '#f8f8f4'], [190, 48, 2, 14, '#3a3a48']]);
    drawPhoto(kit, stage, draw, 30, 12, PHOTO_W, PHOTO_H);
    const b = addG(kit, stage);
    flat(b, [[30, 84, 160, 14, bar]]);
    txt(kit, stage, 110, 86, caption, '#ffffff', 6, 150, 'center');
    kit.every(1600, () => floatHeart(kit, stage, 60 + Math.random() * 100, 70));
  };
}

/** Walle, de frente, como en su foto: crespo, crema y dorado, con las orejas largas, la placa azul y el arnés. */
function walle(g: G, cx: number, cy: number, s: number, kit?: VinetaKit, stage?: Layer, guilty = false): void {
  const E = (dx: number, dy: number, w: number, h: number, c: string, a = 1): void => {
    g.fillStyle(hex(c), a).fillEllipse(cx + dx * s, cy + dy * s, w * s, h * s);
  };
  const R = (dx: number, dy: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + dx * s), Math.round(cy + dy * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  // El pecho y el arnés de pata de gallo.
  E(0, 26, 40, 26, '#e8d8b8');
  for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) R(-18 + i * 3.6, 30 + j * 2.6, 1.8, 1.3, (i + j) % 2 ? '#1c1c20' : '#c8b898');
  // Las orejas: largas, onduladas y doradas.
  for (const side of [-1, 1]) {
    E(side * 18, 10, 15, 34, '#c89048');
    E(side * 18, 8, 12, 30, '#d8a860');
    for (let k = 0; k < 5; k++) E(side * (16 + (k % 2) * 3), -2 + k * 6, 4, 2.4, '#b8843c');
  }
  // La cabeza crespa.
  E(0, -2, 34, 32, '#efe0c4');
  for (let k = 0; k < 14; k++) E(-13 + ((k * 7) % 27), -14 + ((k * 5) % 22), 5, 4, k % 2 ? '#f8eedc' : '#e0cca4');
  E(0, -14, 26, 10, '#f4e8d0');
  // Ojos, hocico, nariz y la lengua.
  for (const side of [-1, 1]) {
    E(side * 7, -3, 5, 5, '#3a2014');
    R(side * 7 - 1, -5, 1.2, 1.2, '#ffffff');
    if (guilty) R(side * 7 - 3, -7, 6, 1, '#b89c74');
  }
  E(0, 7, 22, 14, '#f4ead6');
  E(0, 3, 8, 5, '#4a2c24');
  if (guilty) R(-4, 10, 8, 1.2, '#2a1418');
  else {
    E(0, 10, 12, 6, '#2a1418');
    E(0, 12, 7, 6, '#e88a98');
  }
  // El collar negro con la hebilla y la placa azul de hueso.
  R(-13, 16, 26, 4, '#1c1c20');
  R(6, 16, 4, 4, '#c8c8d0');
  R(-1, 20, 2, 3, '#c8c8d0');
  E(-5, 25, 4, 4, '#2c64b8');
  E(5, 25, 4, 4, '#2c64b8');
  R(-5, 23.5, 10, 3, '#2c64b8');
  if (kit && stage && s >= 1) {
    const t = makeText(kit.scene, cx, cy + 23 * s - 2, 'WALLE', { fontSize: '4px', color: '#e8e8f0' }).setOrigin(0.5, 0);
    stage.add(t);
  }
}

/** Txinparta: pastora vasca rubia, de lado, corriendo (o dormida) con el pelo largo. */
function txinparta(g: G, cx: number, cy: number, s: number, pose: 'corre' | 'duerme' | 'mojada' = 'corre'): void {
  const E = (dx: number, dy: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillEllipse(cx + dx * s, cy + dy * s, w * s, h * s);
  };
  const fur = pose === 'mojada' ? '#b8843c' : '#d8a858';
  const dark = pose === 'mojada' ? '#946428' : '#b8843c';
  if (pose === 'duerme') {
    E(0, 4, 40, 18, fur);
    E(-16, 0, 16, 14, fur);
    E(-20, -6, 5, 8, dark);
    E(-14, -7, 5, 8, dark);
    E(-22, 3, 6, 4, '#3a2418');
    E(-15, 1, 4, 1.4, '#3a2418');
    E(18, 6, 16, 6, dark);
    return;
  }
  // Cola, cuerpo, patas y cabeza con las orejas de punta.
  E(22, -4, 18, 7, dark);
  E(0, 0, 40, 18, fur);
  E(0, -5, 34, 8, dark);
  for (const [dx, dy] of [[-12, 12], [-6, 10], [8, 12], [14, 10]] as const) E(dx, dy, 4, 10, fur);
  E(-22, -8, 16, 14, fur);
  E(-30, -6, 10, 7, fur);
  E(-34, -6, 3, 3, '#2a1418');
  E(-24, -9, 3, 3, '#2a1418');
  g.fillStyle(hex(dark), 1).fillTriangle(cx - 24 * s, cy - 14 * s, cx - 20 * s, cy - 24 * s, cx - 16 * s, cy - 13 * s);
  g.fillStyle(hex(dark), 1).fillTriangle(cx - 18 * s, cy - 14 * s, cx - 13 * s, cy - 23 * s, cx - 11 * s, cy - 12 * s);
  if (pose === 'corre') g.fillStyle(hex('#8c5a34'), 1).fillRect(cx - 46 * s, cy - 4 * s, 34 * s, 2 * s);
  else for (let i = 0; i < 8; i++) g.fillStyle(0x9cd0f0, 0.9).fillRect(cx + (-20 + i * 6) * s, cy + (14 + (i % 3) * 3) * s, 1, 3);
}

/** La playa de Bakio: olas, arena, los montes verdes con viñas y el cielo gris. */
const bakio: Photo = (g, x, y, w, h) => {
  g.fillStyle(hex('#a8b4bc'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#5a8c5c'), 1).fillTriangle(x - 10, y + 34, x + 50, y + 8, x + 110, y + 34).fillTriangle(x + 70, y + 34, x + 140, y + 12, x + w + 20, y + 34);
  for (let i = 0; i < 8; i++) g.fillStyle(hex('#4a7c4c'), 1).fillRect(x + 20 + i * 16, y + 22 + (i % 2) * 3, 10, 1);
  g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 120, y + 26, 6, 6).fillRect(x + 130, y + 28, 5, 5);
  g.fillStyle(hex('#3c6c8c'), 1).fillRect(x, y + 34, w, 18);
  for (let i = 0; i < 6; i++) g.fillStyle(0xf8f8f4, 0.9).fillRect(x + ((i * 31) % w), y + 40 + (i % 3) * 4, 20, 1);
  g.fillStyle(hex('#e8d4a0'), 1).fillRect(x, y + 52, w, h - 52);
};

const gaztelugatxe: Photo = (g, x, y, w, h) => {
  g.fillStyle(hex('#9cb4c8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#2c5a7c'), 1).fillRect(x, y + 44, w, h - 44);
  for (let i = 0; i < 10; i++) g.fillStyle(0xf8f8f4, 0.8).fillRect(x + ((i * 29) % w), y + 50 + ((i * 7) % 20), 10, 1);
  g.fillStyle(hex('#4a6a4c'), 1).fillTriangle(x + 70, y + 52, x + 110, y + 14, x + 150, y + 52);
  g.fillStyle(hex('#3a5a3c'), 1).fillTriangle(x - 10, y + 52, x + 20, y + 30, x + 50, y + 52);
  // La escalera en zigzag por el puente de piedra.
  g.lineStyle(2, hex('#c8bca8'), 1);
  g.beginPath().moveTo(x + 40, y + 50).lineTo(x + 78, y + 46).lineTo(x + 90, y + 38).lineTo(x + 100, y + 30).lineTo(x + 106, y + 22).strokePath();
  g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 102, y + 10, 14, 8);
  g.fillStyle(hex('#b8542c'), 1).fillTriangle(x + 100, y + 10, x + 109, y + 4, x + 118, y + 10);
};

const santiago: Photo = (g, x, y, w, h) => {
  g.fillStyle(hex('#a8c8e8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#7c7c94'), 1).fillTriangle(x - 10, y + 40, x + 60, y + 6, x + 120, y + 40).fillTriangle(x + 70, y + 40, x + 140, y + 4, x + w + 20, y + 40);
  g.fillStyle(hex('#f8f8f4'), 1).fillTriangle(x + 50, y + 12, x + 60, y + 6, x + 70, y + 12).fillTriangle(x + 130, y + 10, x + 140, y + 4, x + 150, y + 10);
  g.fillStyle(0xc8b8a0, 0.5).fillRect(x, y + 34, w, 10);
  for (let i = 0; i < 16; i++) g.fillStyle(hex(['#5a5a68', '#6c6c7c', '#4a4a58'][i % 3]), 1).fillRect(x + i * 10, y + 40 - (i % 4) * 6, 9, h - 40 + (i % 4) * 6);
  g.fillStyle(hex('#3a4a6c'), 1).fillRect(x + 92, y + 16, 8, h - 16);
};

const bakioInvierno: Photo = (g, x, y, w, h, kit, stage) => {
  g.fillStyle(hex('#7c8894'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#4a5c6c'), 1).fillRect(x, y + 40, w, h - 40);
  for (let i = 0; i < 8; i++) {
    g.fillStyle(hex('#d8d4cc'), 1).fillRect(x + 10 + i * 18, y + 28 - (i % 3) * 3, 14, 12 + (i % 3) * 3);
    g.fillStyle(hex('#8c3c2c'), 1).fillRect(x + 10 + i * 18, y + 26 - (i % 3) * 3, 14, 3);
  }
  disc(g, x + 120, y + 56, 6, '#c8303c');
  g.fillStyle(hex(INK), 1).fillRect(x + 119, y + 56, 2, 12);
  const r = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t++;
    r.clear().fillStyle(0xd8e0e8, 0.7);
    for (let i = 0; i < 30; i++) r.fillRect(x + ((i * 37) % w), y + ((i * 23 + t * 3) % h), 1, 3);
  });
};

const gabarra: Photo = (g, x, y, w, h) => {
  g.fillStyle(hex('#a8c0d8'), 1).fillRect(x, y, w, h);
  for (let i = 0; i < 10; i++) g.fillStyle(hex('#c8c4bc'), 1).fillRect(x + i * 16, y + 8 + (i % 3) * 4, 14, 22);
  g.fillStyle(hex('#4a6c7c'), 1).fillRect(x, y + 34, w, h - 34);
  for (let i = 0; i < 80; i++) g.fillStyle(i % 2 ? 0xc8303c : 0xf4f0e6, 1).fillRect(x + ((i * 7) % w), y + 28 + (i % 3) * 2, 2, 3);
  g.fillStyle(hex('#3c7c4c'), 1).fillRect(x + 40, y + 44, 80, 12);
  for (let i = 0; i < 16; i++) g.fillStyle(i % 2 ? 0xc8303c : 0xf4f0e6, 1).fillRect(x + 44 + i * 5, y + 38, 3, 6);
  g.fillStyle(hex('#f8dc68'), 1).fillRect(x + 78, y + 32, 6, 6);
};

const familia: Photo = (g, x, y, w, h) => {
  g.fillStyle(hex('#a8b4bc'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#e8d4a0'), 1).fillRect(x, y + 50, w, h - 50);
  const ama: HumanLook = { skin: '#f4dccc', hair: '#5a3424', shirt: '#2c64c0', pants: '#2a2a38', hairStyle: 'bun' };
  const aita: HumanLook = { skin: '#e8c8b0', hair: '#8c8c94', shirt: '#2c9c58', pants: '#2a2a38', hairStyle: 'short', extras: ['beard'] };
  const ane: HumanLook = { skin: '#f8e2d4', hair: '#7a4c2c', shirt: '#e8b828', pants: '#2a2a38', hairStyle: 'long', extras: ['freckles'] };
  face(g, aita, x + 34, y + 30, 2.4, { mouth: 'smile' });
  face(g, ama, x + 66, y + 30, 2.4, { mouth: 'grin', eyes: 'squint' });
  face(g, laura(), x + 98, y + 30, 2.4, { mouth: 'teeth' });
  face(g, ane, x + 126, y + 38, 1.8, { mouth: 'open' });
  txinparta(g, x + 140, y + 62, 0.6);
};

const calima: Photo = (g, x, y, w, h, kit, stage) => {
  g.fillStyle(hex('#7cb8e8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#5a8c6c'), 1).fillTriangle(x - 10, y + 30, x + 50, y + 10, x + 110, y + 30).fillTriangle(x + 70, y + 30, x + 140, y + 8, x + w + 10, y + 30);
  g.fillStyle(hex('#1c4c7c'), 1).fillRect(x, y + 30, w, h - 30);
  const sails = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t++;
    sails.clear();
    [0xe8303c, 0xf8d040, 0x58d4d0, 0xe868a8].forEach((c, i) => {
      const sx = x + ((i * 40 + t * (1 + i * 0.3)) % w);
      sails.fillStyle(c, 1).fillTriangle(sx, y + 42 + i * 4, sx + 6, y + 26 + i * 4, sx + 9, y + 42 + i * 4);
    });
  });
};

// ---------------------------------------------------------------------------
// La noche de luna en el 1104 y la cama del 805
// ---------------------------------------------------------------------------

interface BedOpts {
  room: 'luna' | '805';
  /** Distancia entre las dos cabezas. */
  gap: number;
  laura?: BustOpts;
  me?: BustOpts;
  hearts?: boolean;
  /** Laura con la cabeza en tu pecho. */
  pecho?: boolean;
  /** El celular en el velador, prendido. */
  phone?: boolean;
  text?: string;
}

function bed(o: BedOpts): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed((g, x, y, w, h) => {
      const luna = o.room === 'luna';
      g.fillStyle(hex(luna ? '#141c3c' : '#1c1828'), 1).fillRect(x, y, w, h);
      // La ventana: la luna llena (1104) o Cali prendida (805).
      g.fillStyle(hex(luna ? '#1c2a58' : '#141c34'), 1).fillRect(x + 160, y + 6, 54, 40);
      if (luna) {
        moon(g, x + 187, y + 24, 11);
        g.fillStyle(0xd8e4ff, 0.1).fillTriangle(x + 160, y + 6, x + 40, y + h, x + 214, y + h);
      } else cityLights(g, x + 160, y + 26, 54, 20, 50);
      // La cama vista desde arriba: almohadas y la sábana.
      g.fillStyle(hex(luna ? '#c8d4f0' : '#d8d0c4'), 1).fillRect(x + 30, y + 30, 130, 78);
      g.fillStyle(hex(luna ? '#e4ecff' : '#f0e8dc'), 1).fillRoundedRect(x + 46, y + 32, 44, 16, 4).fillRoundedRect(x + 100, y + 32, 44, 16, 4);
      if (!luna) {
        g.fillStyle(hex('#5a4c40'), 1).fillRect(x + 6, y + 50, 20, 30);
        for (let i = 0; i < 14; i++) g.fillStyle(0xf8a040, 0.3).fillRect(x + ((i * 37) % w), y + ((i * 11) % 24), 2, 1);
      }
    });
    const g = addG(kit, stage);
    const cy = 50;
    // Separación entre las caras: con `gap` 0 se tocan (cada cabeza mide ~32 px a escala 2).
    const sep = 34 + o.gap * 1.1;
    const lx = o.pecho ? 106 : 95 + sep / 2;
    const px = o.pecho ? 88 : 95 - sep / 2;
    face(g, me(), px, cy, 2, o.me ?? { mouth: 'smile' });
    face(g, laura(), lx, o.pecho ? cy + 14 : cy + 1, 2, o.laura ?? { mouth: 'smile' });
    // La sábana encima.
    g.fillStyle(hex(o.room === 'luna' ? '#9cb4e8' : '#2f6fd0'), 1).fillRect(30, 76, 130, 32);
    g.fillStyle(hex(o.room === 'luna' ? '#b8c8f0' : '#4a84e0'), 1).fillRect(30, 76, 130, 3);
    // Toda la escena teñida de azul de luna.
    if (o.room === 'luna') g.fillStyle(0x6080d0, 0.16).fillRect(0, 0, W, H);
    if (o.phone) {
      const ph = addG(kit, stage);
      let k = 0;
      kit.every(120, () => {
        k++;
        const a = 0.25 + 0.15 * Math.sin(k / 2);
        ph.clear().fillStyle(0x58a8f8, a).fillCircle(16, 46, 22);
        ph.fillStyle(0x1c1c24, 1).fillRect(10, 42, 12, 7);
        ph.fillStyle(0x9cd8ff, 1).fillRect(11, 43, 10, 5);
      });
    }
    if (o.hearts) kit.every(700, () => floatHeart(kit, stage, 80 + Math.random() * 30, 40));
    if (o.me?.eyes === 'closed' && o.laura?.eyes === 'closed' && !o.hearts) kit.every(1000, () => floatZ(kit, stage, 120, 30));
    if (o.text) kit.after(400, () => popText(kit, stage, W / 2, 10, o.text ?? '', '#dce4f8', 8, 0));
  };
}

const lunaFundido: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#0c1024'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  moon(g, W / 2, H / 2, 26);
  const veil = addG(kit, stage);
  kit.progress(3000, (t) => veil.clear().fillStyle(0x000000, t * 0.9).fillRect(0, 0, W, H));
};

// ---------------------------------------------------------------------------
// Escenas propias
// ---------------------------------------------------------------------------

/** Dos personas de cerca (abrazo, beso), sobre un fondo. */
function pareja(bg: string, a: () => HumanLook, b: () => HumanLook, gap: number, oa: BustOpts, ob: BustOpts, fx: 'hearts' | 'sparkle' | 'none' = 'hearts', text?: string): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS[bg] ?? BACKDROPS.calle);
    const g = addG(kit, stage);
    face(g, a(), W / 2 - (40 + gap) / 2, 58, 3, oa);
    face(g, b(), W / 2 + (40 + gap) / 2, 59, 3, ob);
    if (fx === 'hearts') kit.every(600, () => floatHeart(kit, stage, W / 2 - 10 + Math.random() * 20, 34));
    if (fx === 'sparkle') kit.every(500, () => sparkle(kit, stage, 60 + Math.random() * 100, 20 + Math.random() * 40));
    if (text) kit.after(350, () => popText(kit, stage, W / 2, 10, text, '#fff2a0', 9, 0));
  };
}

const mirilla: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#d8d0c4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#a8a098'), 1).fillRect(x, y + 70, w, h - 70);
  });
  const g = addG(kit, stage);
  face(g, laura(), W / 2, 54, 4.6, { mouth: 'grin' });
  M11_PROPS.pandebono(g, W / 2 + 30, 84);
  g.lineStyle(90, 0x0c0c10, 1).strokeCircle(W / 2, H / 2, 86);
  g.lineStyle(2, 0x5a5a68, 1).strokeCircle(W / 2, H / 2, 41);
};

const separador: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#8c6a48'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < h; i += 12) g.fillStyle(hex('#7a5a3c'), 1).fillRect(x, y + i, w, 1);
  });
  const g = addG(kit, stage);
  outlined(g, [[20, 30, 180, 46, '#f4e8c8']]);
  // El samán a lápiz.
  g.lineStyle(1, hex('#5a5048'), 1).strokeEllipse(54, 46, 50, 16);
  g.lineBetween(54, 52, 54, 68).lineBetween(50, 68, 58, 68);
  for (let i = 0; i < 10; i++) g.lineBetween(34 + i * 4, 44, 36 + i * 4, 48);
  txt(kit, stage, 90, 36, '«Para Laura: que Cali te enrede como la selva al de la novela.»\n— Vale', '#3a2418', 6, 104);
};

const nocturno: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.biblioteca);
  const g = addG(kit, stage);
  outlined(g, [[30, 14, 80, 84, '#f8f0dc'], [110, 14, 80, 84, '#f8f0dc']]);
  flat(g, [[109, 14, 2, 84, '#c8bca0']]);
  txt(kit, stage, 36, 22, 'NOCTURNO\n\nUna noche,\nuna noche toda llena de perfumes, de murmullos y de músicas de alas...', '#3a2418', 6, 70);
  txt(kit, stage, 116, 22, '...una noche\nen que ardían en la sombra nupcial y húmeda las luciérnagas fantásticas...', '#3a2418', 6, 70);
  kit.every(900, () => sparkle(kit, stage, 40 + Math.random() * 140, 20 + Math.random() * 70));
};

/** Una nube de pensamiento a la derecha, con una escena adentro. */
function nube(kit: VinetaKit, stage: Layer, draw: (g: G) => void): void {
  const g = addG(kit, stage);
  g.fillStyle(0xffffff, 0.95);
  for (const [cx, cy, r] of [[150, 50, 34], [120, 46, 22], [180, 40, 22], [150, 24, 22], [176, 66, 20], [124, 68, 18]] as const) g.fillCircle(cx, cy, r);
  g.fillCircle(90, 70, 4).fillCircle(80, 78, 3);
  const inner = addG(kit, stage);
  draw(inner);
}

const maracuyaSira: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.itsisi);
  const g = addG(kit, stage);
  face(g, me(), 50, 62, 3.2, { mouth: 'o' });
  nube(kit, stage, (n) => {
    face(n, sira(), 140, 48, 2.4, { mouth: 'smile', blush: true });
    disc(n, 172, 52, 9, INK);
    disc(n, 172, 52, 8, '#f8c830');
    for (let i = 0; i < 5; i++) n.fillStyle(hex('#3a2418'), 1).fillRect(168 + (i % 3) * 3, 48 + Math.floor(i / 3) * 4, 1, 1);
  });
  txt(kit, stage, 150, 76, '3:12 a. m.', '#8c8c98', 5, 40, 'center');
};

function boton(target: number): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#a0a8b8'), 1).fillRect(x, y, w, h));
    const g = addG(kit, stage);
    outlined(g, [[80, 6, 60, 96, '#c8ccd4']]);
    flat(g, [[86, 10, 48, 14, '#1c1c24']]);
    const pos = (n: number): [number, number] => [n % 2 ? 98 : 122, 92 - Math.floor((n - 1) / 2) * 11];
    const lights = addG(kit, stage);
    const num = txt(kit, stage, 110, 12, '8', '#f84040', 9, 40, 'center');
    for (let n = 1; n <= 12; n++) {
      const [bx, by] = pos(n);
      outlined(g, [[bx - 5, by - 5, 10, 9, '#eceef2']]);
      txt(kit, stage, bx, by - 4, String(n), INK, 5, 12, 'center');
    }
    const light = (n: number): void => {
      const [bx, by] = pos(n);
      lights.fillStyle(0xf8e070, 0.9).fillRect(bx - 4, by - 4, 8, 7);
    };
    if (target === 11) {
      light(11);
      num.setText('11');
      kit.every(800, () => sparkle(kit, stage, 122, 38));
      return;
    }
    // El 8 se apaga y el ascensor sigue subiendo hasta el 11.
    light(11);
    [9, 10, 11].forEach((n, i) => kit.after(700 + i * 700, () => num.setText(String(n))));
    kit.after(2900, () => sparkle(kit, stage, 110, 16));
  };
}

const miradorNoche: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, 40, '#0c1430', '#1c2448');
    stars(g, x, y, w, 30);
    cityLights(g, x, y + 36, w, 50, 300);
    g.fillStyle(hex('#2a3456'), 1).fillTriangle(x + 150, y + 40, x + 180, y + 22, x + 210, y + 40);
    g.fillStyle(0xf8f4e0, 1).fillRect(x + 179, y + 14, 2, 8).fillRect(x + 175, y + 16, 10, 2);
    g.fillStyle(hex('#5a5048'), 1).fillRect(x, y + 86, w, h - 86);
  });
  const g = addG(kit, stage);
  for (const [px, c] of [[60, '#1c1418'], [86, '#1c1418'], [126, '#3a2418'], [150, '#7a4c2c']] as const) {
    g.fillStyle(hex('#0c0c14'), 1).fillCircle(px, 78, 7).fillRect(px - 8, 84, 16, 14);
    g.fillStyle(hex(c), 1).fillCircle(px, 76, 6);
  }
  kit.every(900, () => sparkle(kit, stage, Math.random() * W, 40 + Math.random() * 40));
};

const cabezaHombro: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.colina_noche);
  const g = addG(kit, stage);
  face(g, me(), 96, 58, 3.4, { mouth: 'smile', blush: true });
  const lg = addG(kit, stage, 132, 64);
  bust(lg, laura(), 0, 0, 3.4, { mouth: 'smile', eyes: 'closed' });
  lg.setRotation(-0.32);
  kit.every(1200, () => floatHeart(kit, stage, 114, 34));
};

const sofaPeli: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c1828'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#5a8cc8'), 1).fillRect(x + 60, y + 8, 100, 54);
  });
  const g = addG(kit, stage);
  const tv = addG(kit, stage);
  kit.every(400, () => tv.clear().fillStyle([0x9cd0f0, 0xf8dc68, 0xe8807a][Math.floor(Math.random() * 3)], 0.25).fillRect(60, 8, 100, 54));
  g.fillStyle(hex('#4a3c5a'), 1).fillRoundedRect(36, 70, 148, 38, 6);
  disc(g, 96, 72, 11, '#1c1418');
  disc(g, 122, 73, 11, '#7a4c2c');
  g.fillStyle(hex('#7a4c2c'), 1).fillRect(118, 78, 10, 12);
};

const catalogo: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.living_laura);
  const g = addG(kit, stage);
  outlined(g, [[14, 8, 192, 92, '#141420']]);
  const posters: Array<[string, string, string]> = [
    ['Bajo el puente\nde Deusto', '#e8b828', 'comedia'],
    ['Ocho veranos\nen Mundaka', '#2c64c0', 'drama'],
    ['La gabarra', '#c8303c', 'fútbol'],
  ];
  posters.forEach(([t, c, gen], i) => {
    const px = 24 + i * 62;
    flat(g, [[px, 16, 52, 66, c]]);
    txt(kit, stage, px + 26, 22, t, '#ffffff', 6, 50, 'center');
    txt(kit, stage, px + 26, 70, gen, '#f8f4ec', 5, 50, 'center');
    kit.after(300 + i * 300, () => floatHeart(kit, stage, px + 44, 80));
  });
};

const menuPato: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.resto_chileno);
  const g = addG(kit, stage);
  outlined(g, [[40, 8, 140, 92, '#2a3a2c']]);
  txt(kit, stage, 110, 12, 'AL TOQUE · MENÚ', '#f8dc68', 7, 130, 'center');
  const items = ['Completo italiano ....... 12.000', 'As (con todo) ............ 16.000', 'Churrasco palta .......... 15.000', 'Chorrillana (pa\' 4) ..... 35.000', 'Sopaipillas x3 ............ 6.000', 'Bebida roja de fantasía .. 4.000'];
  items.forEach((it, i) => txt(kit, stage, 48, 26 + i * 11, it, '#f4f0e6', 5, 130));
  M11_PROPS.completo(g, 160, 92);
};

const tiraFotos: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.mall);
  const g = addG(kit, stage);
  outlined(g, [[86, 2, 48, 104, '#f8f8f4']]);
  const opts: Array<[BustOpts, BustOpts]> = [
    [{ mouth: 'grin' }, { mouth: 'teeth' }],
    [{ mouth: 'o' }, { mouth: 'grin', eyes: 'squint' }],
    [{ mouth: 'teeth', eyes: 'squint' }, { mouth: 'open' }],
    [{ mouth: 'smile', eyes: 'closed', blush: true }, { mouth: 'smile', eyes: 'closed', blush: true }],
  ];
  opts.forEach(([a, b], i) => {
    kit.after(i * 600, () => {
      const f = addG(kit, stage);
      f.fillStyle(hex('#d8c8b8'), 1).fillRect(90, 6 + i * 25, 40, 22);
      const gap = i === 3 ? 6 : 14;
      face(f, me(), 110 - gap / 2, 14 + i * 25, 1.2, a);
      face(f, sira(), 110 + gap / 2, 14 + i * 25, 1.2, b);
      const fl = addG(kit, stage);
      kit.progress(250, (t) => fl.clear().fillStyle(0xffffff, 0.8 * (1 - t)).fillRect(0, 0, W, H), () => fl.destroy());
      if (i === 3) kit.every(600, () => floatHeart(kit, stage, 128, 90));
    });
  });
};

const bordilloSira: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.farma_noche);
  const g = addG(kit, stage);
  // El recuerdo del lunes: Laura bailando, apenas un fantasma.
  const ghost = addG(kit, stage);
  bust(ghost, laura(), 170, 54, 2.6, { mouth: 'teeth', eyes: 'closed' });
  ghost.setAlpha(0.22);
  kit.tween({ targets: ghost, alpha: 0.05, yoyo: true, repeat: -1, duration: 1400 });
  face(g, sira(), 70, 60, 3, { mouth: 'smile' });
  face(g, me(), 112, 60, 3, { mouth: 'smile', eyes: 'squint' });
  M11_PROPS.helado(g, 140, 90);
};

const besoEsquina: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.calle_noche);
  const g = addG(kit, stage);
  g.fillStyle(hex(INK), 1).fillRect(170, 10, 3, 98);
  const lamp = addG(kit, stage);
  kit.every(300, () => {
    const on = Math.random() > 0.25;
    lamp.clear();
    if (on) lamp.fillStyle(0xf8dc68, 0.22).fillTriangle(171, 12, 120, 108, 220, 108).fillStyle(0xf8dc68, 1).fillCircle(171, 12, 3);
  });
  face(g, me(), 100, 60, 3.4, { mouth: 'smile', eyes: 'closed' });
  face(g, sira(), 122, 60, 3.4, { mouth: 'smile', eyes: 'closed', blush: true });
  kit.every(700, () => floatHeart(kit, stage, 108 + Math.random() * 8, 30));
};

const insomnio: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#141c34'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#1c2a58'), 1).fillRect(x + 150, y + 8, 60, 40);
    moon(g, x + 180, y + 26, 10);
    g.fillStyle(hex('#3a3448'), 1).fillRect(x + 10, y + 64, 50, 44);
  });
  const g = addG(kit, stage);
  outlined(g, [[20, 52, 10, 26, '#f8f8f4'], [36, 58, 14, 7, '#1c1c24']]);
  g.fillStyle(0x9cd8ff, 0.4).fillCircle(43, 61, 10);
  face(g, me(), 110, 60, 3, { mouth: 'smile', eyes: 'open' });
  kit.every(1500, () => popText(kit, stage, 110, 18, ['Laura...', 'Sira...', '...'][Math.floor(Math.random() * 3)], '#dce4f8', 7, 700));
};

const postit: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8eaee'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 60, w, 2);
  });
  const g = addG(kit, stage);
  outlined(g, [[66, 12, 88, 70, '#f8e070']]);
  txt(kit, stage, 72, 18, 'Si estás leyendo esto, has venido a regar a Begoña.\n\nEskerrik asko, chileno 🌱\n—L', '#3a2418', 6, 76);
  disc(g, 176, 30, 7, '#2c64c0');
  disc(g, 40, 70, 6, '#c8303c');
};

const dibujoAne: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#e8eaee'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  outlined(g, [[30, 6, 160, 98, '#fbfaf4']]);
  txt(kit, stage, 110, 10, 'LAURA ETA TXINPARTA CALIN', '#2c64c0', 7, 150, 'center');
  g.lineStyle(2, hex('#7a4c2c'), 1).strokeCircle(76, 46, 8);
  g.lineBetween(76, 54, 76, 76).lineBetween(76, 62, 66, 68).lineBetween(76, 62, 86, 68).lineBetween(76, 76, 70, 90).lineBetween(76, 76, 82, 90);
  for (let i = 0; i < 4; i++) flat(g, [[68 + i * 4, 56, 4, 4, i % 2 ? '#f4f0e6' : '#c8303c']]);
  g.lineStyle(2, hex('#d8a858'), 1).strokeEllipse(116, 82, 30, 12);
  g.lineBetween(102, 78, 98, 70).lineBetween(106, 76, 104, 70);
  g.lineStyle(3, hex('#8c5a34'), 1).lineBetween(160, 96, 160, 50);
  g.lineStyle(2, hex('#3c9c48'), 1).lineBetween(160, 50, 146, 44).lineBetween(160, 50, 174, 44).lineBetween(160, 50, 150, 60).lineBetween(160, 50, 170, 60);
  g.lineStyle(2, hex('#f8c830'), 1).strokeCircle(180, 22, 8);
};

const chorreraGrande: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.chorrera);
  const fall = addG(kit, stage);
  let t = 0;
  kit.every(50, () => {
    t++;
    fall.clear();
    for (let i = 0; i < 24; i++) fall.fillStyle(0xffffff, 0.8).fillRect(W / 2 - 17 + ((i * 7) % 34), (i * 13 + t * 6) % 80, 1, 6);
    fall.fillStyle(0xffffff, 0.25 + 0.1 * Math.sin(t / 4)).fillEllipse(W / 2, 80, 120, 20);
  });
  const g = addG(kit, stage);
  for (const [px, c] of [[70, '#c8303c'], [80, '#2c64c0'], [150, '#3c9c58']] as const) {
    disc(g, px, 92, 3, c);
    g.fillStyle(hex(c), 1).fillRect(px - 2, 95, 4, 6);
  }
  kit.after(400, () => popText(kit, stage, W / 2, 6, 'Chorrera del Indio', '#fff2a0', 9, 0));
};

const cenaVela: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.depa_noche ?? BACKDROPS.cocina_805);
  const g = addG(kit, stage);
  face(g, me(), 60, 52, 3, { mouth: 'grin' });
  face(g, laura(), 160, 53, 3, { mouth: 'teeth' });
  outlined(g, [[30, 80, 160, 28, '#8c6a48']]);
  M11_PROPS.hamburguesa(g, 70, 84);
  M11_PROPS.hamburguesa(g, 150, 84);
  const flame = addG(kit, stage);
  kit.every(120, () => {
    flame.clear();
    M11_PROPS.vela(flame, 110 + (Math.random() < 0.5 ? 0 : 1), 82);
  });
};

const miradorValle: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.mirador_pance);
  const g = addG(kit, stage);
  for (let i = 0; i < 12; i++) g.fillStyle(hex('#d8d4cc'), 1).fillRect(150 + (i % 6) * 6, 62 - Math.floor(i / 6) * 4, 4, 4);
  kit.every(1200, () => sparkle(kit, stage, 40 + Math.random() * 140, 70));
  kit.after(400, () => popText(kit, stage, W / 2, 6, 'Valle del Pance', '#fff2a0', 9, 0));
};

const balconLuna: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.balcon_noche);
  const g = addG(kit, stage);
  face(g, laura(), 70, 56, 3.2, { mouth: 'smile' });
  face(g, me(), 112, 57, 3.2, { mouth: 'smile' });
  kit.every(900, () => sparkle(kit, stage, 176 + Math.random() * 10, 14 + Math.random() * 10));
};

const lunaGrande: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, h, '#0c1430', '#141c3c');
    stars(g, x, y, w, h, 40);
  });
  const g = addG(kit, stage);
  moon(g, W / 2, 50, 34);
  const glow = addG(kit, stage);
  kit.progress(2500, (t) => glow.clear().fillStyle(0xe8f0ff, 0.12 * t).fillCircle(W / 2, 50, 50));
};

const luzApagada: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0c1024'), 1).fillRect(x, y, w, h);
    g.fillStyle(0xc8d8f8, 0.2).fillRect(x + 120, y + 60, 80, 48);
    g.fillStyle(0xc8d8f8, 0.12).fillTriangle(x + 180, y, x + 120, y + 60, x + 200, y + 60);
  });
  const g = addG(kit, stage);
  for (const [px, c] of [[100, '#1c1418'], [122, '#7a4c2c']] as const) {
    g.fillStyle(hex('#05060c'), 1).fillCircle(px, 64, 9).fillRect(px - 10, 72, 20, 36);
    g.fillStyle(hex(c), 0.5).fillCircle(px, 62, 8);
  }
};

const manoBalcon: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.balcon_noche);
  const g = addG(kit, stage);
  const pl = playerLook();
  outlined(g, [[20, 60, 90, 18, pl.skin], [120, 52, 80, 16, laura().skin]]);
  outlined(g, [[100, 56, 26, 22, laura().skin]]);
  for (let i = 0; i < 4; i++) flat(g, [[108 + i * 4, 52, 3, 8, laura().skin]]);
  flat(g, [[0, 60, 22, 18, pl.shirt], [196, 52, 24, 16, laura().shirt]]);
  kit.every(700, () => floatHeart(kit, stage, 110, 40));
};

const decisionBalcon: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.balcon_noche);
  const g = addG(kit, stage);
  face(g, me(), W / 2, 60, 3.2, { mouth: 'o' });
  const l = addG(kit, stage);
  bust(l, laura(), 40, 34, 1.8, { mouth: 'smile' });
  const s = addG(kit, stage);
  bust(s, sira(), 180, 34, 1.8, { mouth: 'smile' });
  kit.tween({ targets: l, alpha: 0.3, yoyo: true, repeat: -1, duration: 1100 });
  kit.tween({ targets: s, alpha: 0.3, yoyo: true, repeat: -1, duration: 1100, delay: 550 });
};

const dosCaras: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c2a58'), 1).fillRect(x, y, w / 2, h);
    moon(g, x + 30, y + 20, 8);
    g.fillStyle(hex('#1c4c54'), 1).fillRect(x + w / 2, y, w / 2, h);
    for (let i = 0; i < 6; i++) g.fillStyle(0x58d4d0, 0.3).fillRect(x + w / 2 + 6 + i * 16, y + 90, 10, 2);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + w / 2 - 1, y, 2, h);
  });
  const g = addG(kit, stage);
  face(g, laura(), 55, 56, 3.2, { mouth: 'smile', blush: true });
  face(g, sira(), 165, 56, 3.2, { mouth: 'smile', blush: true });
  M11_PROPS.pandebono(g, 26, 92);
  M11_PROPS.bufanda(g, 86, 92);
  PROPS.foto?.(g, 196, 92);
  M11_PROPS.helado(g, 136, 90);
};

const heladoPorDentro: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.balcon_noche);
  const g = addG(kit, stage);
  face(g, me(), W / 2, 50, 3.6, { mouth: 'o', eyes: 'open' });
  kit.every(140, () => {
    const c = addG(kit, stage);
    const x = W / 2 - 18 + Math.random() * 36;
    const col = [0xc8303c, 0xf8dc68, 0x58d4d0, 0xe868a8][Math.floor(Math.random() * 4)];
    kit.progress(700, (t) => c.clear().fillStyle(col, 1 - t).fillRect(x + Math.sin(t * 9) * 6, 96 - t * 20, 2, 2), () => c.destroy());
  });
  kit.after(300, () => popText(kit, stage, W / 2, 6, '¡!', '#fff2a0', 12, 0));
};

const estrellita: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h / 2);
    g.fillStyle(hex('#d42c2c'), 1).fillRect(x, y + h / 2, w, h / 2);
    g.fillStyle(hex('#1c3c9c'), 1).fillRect(x, y, w * 0.36, h / 2);
  });
  const g = addG(kit, stage);
  const cx = W * 0.18;
  const cy = H / 4;
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 6 : 15;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  g.fillStyle(0xf8f8f4, 1).fillPoints(pts, true);
  kit.every(400, () => sparkle(kit, stage, cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30));
};

/** Danilo en el balcón, con la nube de lo que pasó en el lago. */
function nubeDanilo(variant: 1 | 2 | 3 | 4): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.balcon_noche);
    const g = addG(kit, stage);
    face(g, lookOf('danilo'), 46, 62, 3.2, { mouth: variant === 4 ? 'grin' : 'open' });
    nube(kit, stage, (n) => {
      // El muelle del lago Calima, de tarde.
      n.fillStyle(hex('#e8a070'), 1).fillRect(122, 22, 58, 18);
      n.fillStyle(hex('#1c4c7c'), 1).fillRect(122, 40, 58, 22);
      n.fillStyle(hex('#8c6a48'), 1).fillRect(130, 54, 44, 4);
      if (variant === 4) {
        walle(n, 151, 44, 0.7);
        return;
      }
      bust(n, lookOf('danilo'), 138, 46, 1.4, { mouth: 'open' });
      bust(n, laura(), 162, 46, 1.4, variant === 3 ? { mouth: 'teeth', blush: true } : variant === 2 ? { mouth: 'smile', blush: true } : { mouth: 'smile' });
    });
    if (variant === 2) {
      kit.after(500, () => txt(kit, stage, 150, 66, '«...una estrellita en la bandera»', INK, 5, 70, 'center'));
      const fl = addG(kit, stage);
      flat(fl, [[176, 22, 14, 4, '#f4f0e6'], [176, 26, 14, 4, '#d42c2c'], [176, 22, 5, 4, '#1c3c9c']]);
    }
    if (variant === 3) kit.every(500, () => floatHeart(kit, stage, 150 + Math.random() * 20, 36));
  };
}

// ---------------------------------------------------------------------------
// El final en el 805
// ---------------------------------------------------------------------------

const celSiraFinal: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#05060c'), 1).fillRect(x, y, w, h));
  const glow = addG(kit, stage);
  kit.progress(900, (t) => glow.clear().fillStyle(0x58a8f8, 0.25 * t).fillCircle(W / 2, H / 2, 90));
  const g = addG(kit, stage);
  outlined(g, [[76, 4, 68, 100, '#1c1c24']]);
  flat(g, [[80, 10, 60, 88, '#0c1838']]);
  txt(kit, stage, 110, 16, '01:47', '#e8f0ff', 12, 60, 'center');
  txt(kit, stage, 110, 34, 'martes', '#9cb4d8', 5, 60, 'center');
  kit.after(500, () => {
    const n = addG(kit, stage);
    n.fillStyle(0xf4f4f8, 0.95).fillRoundedRect(82, 46, 56, 34, 4);
    disc(n, 89, 53, 4, SIRA_C);
    txt(kit, stage, 95, 49, 'Sira 💙', INK, 5, 40);
    txt(kit, stage, 85, 58, '¿Estás despierto? Mañana te tengo una sorpresa...', INK, 5, 50);
  });
};

const lauraDespierta: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#0c1024'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  face(g, laura(), W / 2, 56, 4, { eyes: 'squint', mouth: 'o' });
  g.fillStyle(0x58a8f8, 0.28).fillRect(0, 0, W, H);
};

const vibra: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0c1024'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#d8d0c4'), 1).fillRoundedRect(x + 50, y + 40, 120, 40, 10);
  });
  const g = addG(kit, stage);
  kit.every(700, () => {
    g.clear().fillStyle(0x58a8f8, 0.3).fillRect(96, 70, 30, 6);
    popText(kit, stage, 70 + Math.random() * 80, 30, 'bzz', '#9cd8ff', 7, 400);
  });
};

const negroFinal: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(0x000000, 1).fillRect(x, y, w, h));
  kit.every(500, () => popText(kit, stage, 30 + Math.random() * 160, 40 + Math.random() * 50, '♪', '#5a5a68', 8, 900));
  kit.after(1500, () => {
    const t = txt(kit, stage, W / 2, 44, 'Continuará...', '#f4f0e6', 12, 200, 'center');
    t.setAlpha(0);
    kit.tween({ targets: t, alpha: 1, duration: 1500 });
  });
};

const flashSira: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#3a2c20'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  outlined(g, [[70, 10, 80, 88, '#e8d8b8']]);
  face(g, me(), 98, 50, 2.6, { mouth: 'smile', eyes: 'closed' });
  face(g, sira(), 122, 50, 2.6, { mouth: 'smile', eyes: 'closed', blush: true });
  g.fillStyle(0x8c6a40, 0.35).fillRect(0, 0, W, H);
  const fl = addG(kit, stage);
  kit.progress(500, (t) => fl.clear().fillStyle(0xffffff, 0.7 * (1 - t)).fillRect(0, 0, W, H));
};

// ---------------------------------------------------------------------------

export const M11_VINETAS: Record<string, VinetaBuilder> = {
  ...Object.fromEntries(Object.entries(M11_SPECS).map(([id, spec]) => [id, compose(spec)])),
  // Chats
  m11_chat_laura_trato: chat('Laura', LAURA_C, ['Jajajaja. Trato.', 'Txinparta dice que acepta las condiciones 🐕']),
  m11_chat_laura_helado: chat('Laura', LAURA_C, ['Chileno.', 'Helado. Farmadía. 10 minutos 🍦', 'No acepto excusas']),
  m11_chat_laura_audio: chat('Laura', LAURA_C, ['🎤 Audio · 0:41', 'perdón por cantar', 'no lo borres. o sí. NO']),
  m11_chat_laura_muelle: chat('Laura', LAURA_C, ['¡Buenos días!', 'No te olvides de Begoña 🌱', 'agua y que le hablen bonito'], calima),
  m11_chat_laura_luna: chat('Laura', LAURA_C, ['La misma luna de anoche', '¿La estás viendo?', 'Me gustaría que estuvieras aquí 🌕'], (g, x, y, w, h) => {
    g.fillStyle(hex('#0c1430'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#1c3c6c'), 1).fillRect(x, y + h * 0.6, w, h * 0.4);
    moon(g, x + w / 2, y + 10, 6, false);
    g.fillStyle(0xf4f0e0, 0.6).fillRect(x + w / 2 - 1, y + h * 0.6, 2, h * 0.4);
  }),
  m11_chat_laura_llegamos: chat('Laura', LAURA_C, ['¡Volvemos!', 'Llegamos a las 7', '¿Nos esperas en mi depa? Tienes la llave 😏']),
  m11_chat_laura_5min: chat('Laura', LAURA_C, ['Ya voy', 'La Chorrera me ha hecho rastas', '5 min']),
  m11_chat_laura_10min: chat('Laura', LAURA_C, ['Vale, 10', 'Me ha llamado ama', 'le he contado TODO el día. Bueno, todo no 😅']),
  m11_chat_sira_cancha: chat('Sira', SIRA_C, ['Te vi jugar desde el segundo piso 👀', 'Corres raro.', 'Pero corres.']),
  m11_chat_sira_maqueta: chat('Sira', SIRA_C, ['¿Se ve recta o estoy loca?', ['me', 'Está perfecta'], 'mentiroso 🙃'], (g, x, y, w, h) => {
    g.fillStyle(hex('#d8d4cc'), 1).fillRect(x, y, w, h);
    M11_PROPS.maqueta(g, x + w / 2, y + h / 2 + 4);
  }),
  m11_chat_sira_mall: chat('Sira', SIRA_C, ['¿Mall?', 'Majo necesita un vestido y Cata opinar de todo', 'Te espero en el Guayacán 🙃']),
  m11_chat_sira_voragine: chat('Sira', SIRA_C, ['¡¿La Vorágine?!', '¡Voy!', 'Llevo bloqueador para todos 🙌']),
  m11_chat_sira_cancela: chat('Sira', SIRA_C, ['Ay no 😭', 'Me salió algo con mi familia', 'No puedo ir. Pásenla rico 💙']),
  m11_chat_danilo_jueves: chat('Danilo', WA, ['Chileno: a las 9 paso por el Bobo con Mila', 'Vamos a San Antonio', 'Laura ya dijo que sí. Vojabés 😎']),
  m11_chat_danilo_1: chat('Danilo', WA, ['Parce.', 'Ve.', 'Hablé con Laura hoy en el lago', 'No sabés lo que dijo de vos 👀']),
  m11_chat_danilo_2: chat('Danilo', WA, ['Chileno.', 'Le pregunté cosas a Laura. Sobre vos.', 'El domingo hablamos 🤐🔥']),
  m11_chat_danilo_txinparta: chat('Danilo', WA, ['Dato:', 'Txinparta significa «chispa»', 'No le digas que te dije 😂']),
  // Fotos
  m11_bakio_postal: foto(bakio, 'Bakio · Bizkaia'),
  m11_gaztelugatxe: foto(gaztelugatxe, 'San Juan de Gaztelugatxe'),
  m11_foto_txinparta: foto((g, x, y, w, h) => {
    bakio(g, x, y, w, h, undefined as unknown as VinetaKit, undefined as unknown as Layer);
    txinparta(g, x + 96, y + 58, 1.2);
  }, 'Txinparta 🐕 ♥'),
  m11_txinparta_zapatillas: foto((g, x, y, w, h) => {
    g.fillStyle(hex('#c8b8a0'), 1).fillRect(x, y, w, h);
    outlined(g, [[x + 50, y + 44, 30, 12, '#f4f0e6'], [x + 84, y + 46, 30, 12, '#f4f0e6']]);
    txinparta(g, x + 80, y + 40, 1.3, 'duerme');
  }, 'Ama: «gaur goizean» 🐾'),
  m11_txinparta_mojada: foto((g, x, y, w, h) => {
    bakio(g, x, y, w, h, undefined as unknown as VinetaKit, undefined as unknown as Layer);
    txinparta(g, x + 90, y + 54, 1.2, 'mojada');
  }, 'Txinpartak muxu bat bidaltzen dizu 🐕'),
  m11_foto_walle: (kit) => foto((g, x, y, w, h, k, st) => {
    g.fillStyle(hex('#fbfbf8'), 1).fillRect(x, y, w, h);
    walle(g, x + w / 2, y + 26, 1.1, k, st);
  }, 'Walle ♥', '#2c64b8')(kit),
  m11_foto_walle_calcetin: (kit) => foto((g, x, y, w, h, k, st) => {
    g.fillStyle(hex('#d8ccbc'), 1).fillRect(x, y, w, h);
    walle(g, x + w / 2 - 20, y + 26, 1.1, k, st, true);
    for (let i = 0; i < 6; i++) flat(g, [[x + 110 + (i % 3) * 8, y + 54 + Math.floor(i / 3) * 6, 6, 3, i % 2 ? '#c8303c' : '#f4f0e6']]);
  }, '«Yo no fui»', '#2c64b8')(kit),
  m11_postal_santiago: foto(santiago, 'Santiago, después de la lluvia', '#2c64c0'),
  m11_bakio_invierno: foto(bakioInvierno, 'Bakio en invierno', '#5a6a7c'),
  m11_familia_laura: foto(familia, 'Ama, aita, Ane, Txinparta y yo'),
  m11_gabarra: foto(gabarra, 'La gabarra del 84 · ¿y la próxima?', '#c8303c'),
  m11_historia_calima: (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = addG(kit, stage);
    outlined(g, [[76, 2, 68, 104, '#1c1c24']]);
    drawPhoto(kit, stage, calima, 80, 6, 60, 96);
    const top = addG(kit, stage);
    flat(top, [[82, 9, 26, 1, '#ffffff'], [110, 9, 26, 1, '#8c8c98']]);
    txt(kit, stage, 84, 12, 'laaurii_14 · 2 h', '#ffffff', 5, 60);
    face(top, laura(), 110, 78, 1.6, { mouth: 'grin', eyes: 'squint' });
    txt(kit, stage, 110, 90, 'aquí sopla 🌬️', '#ffffff', 6, 60, 'center');
  },
  // Escenas
  m11_mirilla: mirilla,
  m11_separador: separador,
  m11_nocturno: nocturno,
  m11_maracuya_sira: maracuyaSira,
  m11_boton_11: boton(8),
  m11_boton_11_on: boton(11),
  m11_mirador_noche: miradorNoche,
  m11_cabeza_hombro: cabezaHombro,
  m11_beso_mejilla: pareja('living_laura', me, laura, 12, { mouth: 'o', blush: true }, { mouth: 'smile', eyes: 'closed' }, 'hearts', 'chuik'),
  m11_sofa_peli: sofaPeli,
  m11_catalogo: catalogo,
  m11_menu_pato: menuPato,
  m11_tira_fotos: tiraFotos,
  m11_bordillo_sira: bordilloSira,
  m11_beso_sira_esquina: besoEsquina,
  m11_sira_beso_pasillo: pareja('piscina_gld', me, () => lookOf('sira_bano'), 10, { mouth: 'o', blush: true }, { mouth: 'smile', eyes: 'closed', blush: true }),
  m11_insomnio: insomnio,
  m11_postit: postit,
  m11_dibujo_ane: dibujoAne,
  m11_abrazo_vuelta: pareja('living_laura', me, laura, 16, { mouth: 'smile', eyes: 'closed' }, { mouth: 'teeth', eyes: 'closed' }),
  m11_chorrera_grande: chorreraGrande,
  m11_cena_vela: cenaVela,
  m11_mirador_valle: miradorValle,
  m11_gabarra_ria: foto(gabarra, 'La gabarra del 84'),
  // Balcón y decisión
  m11_balcon_luna: balconLuna,
  m11_luna_grande: lunaGrande,
  m11_luz_apagada: luzApagada,
  m11_mano_balcon: manoBalcon,
  m11_decision_balcon: decisionBalcon,
  m11_dos_caras: dosCaras,
  m11_helado_por_dentro: heladoPorDentro,
  m11_estrellita: estrellita,
  m11_nube_1: nubeDanilo(1),
  m11_nube_2: nubeDanilo(2),
  m11_nube_3: nubeDanilo(3),
  m11_nube_4: nubeDanilo(4),
  // La luna en el 1104
  m11_cuarto_luna: bed({ room: 'luna', gap: 44 }),
  m11_cuarto_luna_2: bed({ room: 'luna', gap: 30, laura: { mouth: 'smile', blush: true } }),
  m11_cuarto_luna_3: bed({ room: 'luna', gap: 12, laura: { mouth: 'smile' }, me: { mouth: 'smile' } }),
  m11_cuarto_luna_4: bed({ room: 'luna', gap: 6, laura: { mouth: 'smile', eyes: 'closed' } }),
  m11_cuarto_abrazo: bed({ room: 'luna', gap: 0, pecho: true, laura: { mouth: 'smile', eyes: 'closed' }, me: { mouth: 'smile', eyes: 'closed' }, hearts: true }),
  m11_cuarto_susurro: bed({ room: 'luna', gap: 0, laura: { mouth: 'smile', eyes: 'closed' }, me: { mouth: 'o' }, text: '...' }),
  m11_luna_fundido: lunaFundido,
  // El 805
  m11_cama_805: bed({ room: '805', gap: 26 }),
  m11_cara_a_cara: bed({ room: '805', gap: 2, laura: { mouth: 'smile', blush: true }, me: { mouth: 'smile', blush: true } }),
  m11_beso_laura: bed({ room: '805', gap: -14, laura: { mouth: 'smile', eyes: 'closed', blush: true }, me: { mouth: 'smile', eyes: 'closed' }, hearts: true }),
  m11_beso_laura_2: bed({ room: '805', gap: -6, laura: { mouth: 'teeth', eyes: 'squint', blush: true }, me: { mouth: 'grin', eyes: 'squint' }, hearts: true }),
  m11_dormida_pecho: bed({ room: '805', gap: 0, pecho: true, laura: { mouth: 'smile', eyes: 'closed' }, me: { mouth: 'smile', eyes: 'closed' } }),
  m11_cel_velador: bed({ room: '805', gap: 0, pecho: true, laura: { mouth: 'smile', eyes: 'closed' }, me: { mouth: 'o' }, phone: true }),
  m11_cel_sira_final: celSiraFinal,
  m11_laura_despierta: lauraDespierta,
  m11_vibra: vibra,
  m11_negro_final: negroFinal,
  m11_flash_sira: flashSira,
};
