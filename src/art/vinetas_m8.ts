import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { Backdrop, VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, type BustOpts } from './vinetas_m5';
import { sinGorro } from './vinetas_m7';

/**
 * Viñetas de la misión 8 («Lo que pasó en Salento»): un compositor de escenas. Cada viñeta declara un fondo
 * (el bus, la plaza de Salento, la casita, el mercado, el Parque del Café, el bar, la disco...), los que salen
 * (bustos con su cara: sonrisa, risa, ojos cerrados...), los objetos (la oblea, la trucha, el tequila...), un
 * texto que salta y un efecto (corazones, notas, nieve de neblina, lluvia, confeti...). Las escenas clave
 * (la foto del Krater, la Rueda al atardecer, el tequila paso a paso, el Grito, el «¿y si...?» y los celulares)
 * tienen además su dibujo propio. Panel de 220 × 108 px.
 */

const W = 220;
const H = 108;

type Mood = 'smile' | 'open' | 'teeth' | 'grin' | 'o' | 'closed' | 'squint' | 'sleep' | 'sad' | 'blush' | 'cry' | 'green';
type Fx = 'hearts' | 'notes' | 'zzz' | 'sparkle' | 'rain' | 'confetti' | 'stars' | 'mist' | 'steam' | 'snore' | 'lights' | 'sweat' | 'flash' | 'heart1';

interface Spec {
  /** Fondo. */
  b: string;
  /** Quiénes salen: "id ánimo" (ej. "richi grin"); "player" es el jugador. */
  c?: string[];
  /** Objetos al frente. */
  p?: string[];
  /** Texto que salta arriba. */
  t?: string;
  tc?: string;
  fx?: Fx | Fx[];
  /** Escala de los bustos (por defecto 3). */
  s?: number;
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

const night = (): boolean => {
  const m = StoryState.clock % 1440;
  return m >= 19 * 60 || m < 6 * 60;
};

function sky(g: G, x: number, y: number, w: number, h: number, mode: 'dia' | 'tarde' | 'noche' | 'nublado'): void {
  const top = { dia: '#7cb8e8', tarde: '#5a4c8c', noche: '#141c34', nublado: '#8a9cb0' }[mode];
  const low = { dia: '#c8e4f4', tarde: '#e8806a', noche: '#2a3456', nublado: '#c0c8d0' }[mode];
  g.fillStyle(hex(top), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(low), 1).fillRect(x, y + h * 0.45, w, h * 0.55);
  g.fillStyle(hex(shade(low, 0.1)), 1).fillRect(x, y + h * 0.7, w, h * 0.3);
  if (mode === 'noche') for (let i = 0; i < 26; i++) g.fillStyle(0xf8f4ec, 0.8).fillRect(x + ((i * 53) % w), y + ((i * 29) % (h * 0.5)), 1, 1);
}

function mountains(g: G, y: number, color: string, n = 5, hgt = 34): void {
  for (let i = 0; i < n; i++) {
    const x = i * (W / (n - 1)) - 30;
    g.fillStyle(hex(color), 1).fillTriangle(x, y, x + 50, y - hgt + (i % 2) * 10, x + 100, y);
  }
  g.fillStyle(hex(color), 1).fillRect(0, y, W, H - y);
}

/** Fila de casas de Salento: blancas, con puerta y balcón de colores y techo de teja. */
function casas(g: G, base: number, dark = false): void {
  const colors = ['#c8303c', '#2c64c0', '#2c9c58', '#e8b828', '#7c3ca8', '#1ca8a8', '#e8742c'];
  for (let i = 0; i < 6; i++) {
    const x = i * 38 - 6;
    const c = colors[(i * 3) % colors.length];
    g.fillStyle(hex(dark ? '#5a2a18' : '#b8542c'), 1).fillTriangle(x - 4, base - 30, x + 19, base - 44, x + 42, base - 30);
    g.fillStyle(hex(dark ? '#8c8478' : '#f4f0e6'), 1).fillRect(x, base - 30, 38, 30);
    g.fillStyle(hex(c), 1).fillRect(x + 4, base - 16, 9, 16).fillRect(x + 20, base - 26, 13, 9).fillRect(x + 18, base - 17, 17, 2);
    if (dark) g.fillStyle(hex('#f8dc68'), 0.85).fillRect(x + 22, base - 24, 9, 5);
  }
}

const BACKDROPS: Record<string, Backdrop> = {
  bus: (g, x, y, w, h) => {
    g.fillStyle(hex('#3a3c48'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 3; i++) {
      const wx = x + 8 + i * 72;
      g.fillStyle(hex('#9cd0f0'), 1).fillRect(wx, y + 8, 60, 40);
      g.fillStyle(hex('#5c9c4c'), 1).fillRect(wx, y + 34, 60, 14);
      g.fillStyle(hex('#4c8c3c'), 1).fillTriangle(wx, y + 34, wx + 30, y + 20, wx + 60, y + 34);
    }
    g.fillStyle(hex('#c8303c'), 1).fillRect(x, y + 56, w, h - 56);
    g.fillStyle(hex('#a82830'), 1).fillRect(x, y + 56, w, 4);
  },
  terminal: (g, x, y, w, h) => {
    g.fillStyle(hex('#d8d4cc'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8c8478'), 1).fillRect(x, y + 70, w, h - 70);
    g.fillStyle(hex('#2c64c0'), 1).fillRect(x + 10, y + 8, 80, 14);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 14, y + 12, 50, 2).fillRect(x + 14, y + 16, 36, 2);
    g.fillStyle(hex('#3a3c48'), 1).fillRect(x + 120, y + 30, 100, 44);
    g.fillStyle(hex('#9cd0f0'), 1).fillRect(x + 126, y + 36, 88, 16);
  },
  calle: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    casas(g, 80);
    g.fillStyle(hex('#8c8c8c'), 1).fillRect(x, y + 80, w, h - 80);
    for (let i = 0; i < 20; i++) g.fillStyle(hex('#acacac'), 1).fillRect(x + ((i * 37) % w), y + 84 + ((i * 7) % 20), 6, 3);
  },
  calle_noche: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'noche');
    casas(g, 80, true);
    g.fillStyle(hex('#4c4c50'), 1).fillRect(x, y + 80, w, h - 80);
    for (const fx of [30, 110, 190]) {
      g.fillStyle(hex('#2a2433'), 1).fillRect(x + fx, y + 50, 2, 30);
      g.fillStyle(hex('#f8e8a8'), 1).fillRect(x + fx - 2, y + 46, 6, 5);
      g.fillStyle(hex('#f8e8a8'), 0.18).fillCircle(x + fx + 1, y + 49, 9);
    }
  },
  calle_lluvia: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'nublado');
    casas(g, 80);
    g.fillStyle(hex('#6c6c70'), 1).fillRect(x, y + 80, w, h - 80);
    g.fillStyle(hex('#9cb0c8'), 0.5).fillRect(x, y + 92, w, 3);
  },
  plaza: (g, x, y, w, h) => {
    sky(g, x, y, w, h, night() ? 'noche' : 'dia');
    // La parroquia al fondo y las palmas de cera.
    g.fillStyle(hex('#f8f4ec'), 1).fillRect(x + 140, y + 30, 70, 50);
    g.fillStyle(hex('#e8e2d4'), 1).fillRect(x + 140, y + 14, 14, 66).fillRect(x + 196, y + 14, 14, 66);
    g.fillStyle(hex('#6a3a1c'), 1).fillRect(x + 168, y + 54, 14, 26);
    g.fillStyle(hex('#e8c860'), 1).fillRect(x + 140, y + 30, 70, 2);
    for (const px of [24, 96]) {
      g.fillStyle(hex('#d8d4cc'), 1).fillRect(x + px, y + 14, 3, 66);
      g.fillStyle(hex('#2c6a34'), 1).fillEllipse(x + px + 1, y + 14, 34, 10);
      g.fillStyle(hex('#5c9c4c'), 1).fillEllipse(x + px + 1, y + 12, 22, 6);
    }
    g.fillStyle(hex('#c8bca8'), 1).fillRect(x, y + 80, w, h - 80);
    if (night()) for (const fx of [60, 130]) {
      g.fillStyle(hex('#2a2433'), 1).fillRect(x + fx, y + 52, 2, 28);
      g.fillStyle(hex('#f8e8a8'), 1).fillRect(x + fx - 2, y + 48, 6, 5);
      g.fillStyle(hex('#f8e8a8'), 0.18).fillCircle(x + fx + 1, y + 51, 9);
    }
  },
  mercado: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    casas(g, 70);
    const cs = ['#c8303c', '#2c9c58', '#e8b828', '#2c64c0'];
    for (let i = 0; i < 4; i++) {
      const tx = x + i * 56;
      g.fillStyle(hex(cs[i]), 1).fillRect(tx, y + 50, 50, 10);
      for (let k = 0; k < 50; k += 10) g.fillStyle(0xffffff, 0.5).fillRect(tx + k, y + 50, 5, 10);
      g.fillStyle(hex('#a87c4c'), 1).fillRect(tx + 4, y + 74, 42, 14);
      g.fillStyle(hex('#6a4428'), 1).fillRect(tx + 6, y + 60, 2, 14).fillRect(tx + 42, y + 60, 2, 14);
    }
    g.fillStyle(hex('#8c8c8c'), 1).fillRect(x, y + 88, w, h - 88);
  },
  casita: (g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#6a4428'), 1).fillRect(x, y, w, 8).fillRect(x + 60, y, 4, 80).fillRect(x + 156, y, 4, 80);
    g.fillStyle(hex('#2c9c58'), 1).fillRect(x, y + 64, w, 16);
    g.fillStyle(hex('#a8784c'), 1).fillRect(x, y + 80, w, h - 80);
    for (let i = 0; i < w; i += 22) g.fillStyle(hex('#8c5c34'), 1).fillRect(x + i, y + 80, 1, h - 80);
  },
  camarotes: (g, x, y, w, h) => {
    g.fillStyle(hex(night() ? '#1c2034' : '#e8e0d0'), 1).fillRect(x, y, w, h);
    for (const bx of [10, 120]) {
      g.fillStyle(hex('#6a4428'), 1).fillRect(x + bx, y + 6, 4, 100).fillRect(x + bx + 86, y + 6, 4, 100);
      g.fillStyle(hex(night() ? '#3a4a78' : '#e85a64'), 1).fillRect(x + bx + 4, y + 30, 82, 10);
      g.fillStyle(hex(night() ? '#2a3456' : '#2c64c0'), 1).fillRect(x + bx + 4, y + 80, 82, 10);
      g.fillStyle(hex('#6a4428'), 1).fillRect(x + bx, y + 40, 90, 3).fillRect(x + bx, y + 90, 90, 3);
    }
    if (night()) g.fillStyle(hex('#8aa8d8'), 0.15).fillRect(x + 100, y, 20, h);
  },
  cocina: (g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8a070'), 1).fillRect(x, y + 70, w, 10);
    g.fillStyle(hex('#e8dcc0'), 1).fillRect(x, y + 66, w, 4);
    g.fillStyle(hex('#a8784c'), 1).fillRect(x, y + 80, w, h - 80);
    g.fillStyle(hex('#3a3a48'), 1).fillRect(x + 150, y + 54, 40, 12);
  },
  patio: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y + 20, w, 50);
    g.fillStyle(hex('#b8542c'), 1).fillRect(x, y + 14, w, 8);
    g.fillStyle(hex('#c8784c'), 1).fillRect(x, y + 70, w, h - 70);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#a85c34'), 1).fillRect(x + i, y + 70, 1, h - 70);
  },
  mirador: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    mountains(g, y + 62, '#5c9c4c', 5, 30);
    g.fillStyle(hex('#4c8c3c'), 1).fillRect(x, y + 74, w, h - 74);
    for (let i = 0; i < 9; i++) {
      const px = x + 10 + i * 24 + (i % 2) * 6;
      const top = y + 18 + (i % 3) * 8;
      g.fillStyle(hex('#d8d4cc'), 1).fillRect(px, top, 2, 90 - top);
      g.fillStyle(hex('#2c6a34'), 1).fillEllipse(px + 1, top, 14, 5);
    }
    g.fillStyle(0xffffff, 0.35).fillRect(x, y + 56, w, 8);
  },
  chiva: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    mountains(g, y + 70, '#5c9c4c');
    g.fillStyle(hex('#e8b828'), 1).fillRect(x, y, w, 12);
    g.fillStyle(hex('#c8303c'), 1).fillRect(x, y + 12, w, 4);
    for (let i = 0; i < w; i += 44) g.fillStyle(hex('#2c64c0'), 1).fillRect(x + i, y, 6, 90);
    g.fillStyle(hex('#2c9c58'), 1).fillRect(x, y + 88, w, h - 88);
    for (let i = 0; i < w; i += 20) g.fillStyle(hex('#f8dc68'), 1).fillRect(x + i, y + 94, 10, 4);
  },
  chiva_noche: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'noche');
    mountains(g, y + 70, '#1c2a24');
    g.fillStyle(hex('#a87c14'), 1).fillRect(x, y, w, 12);
    for (let i = 0; i < w; i += 44) g.fillStyle(hex('#1c3c84'), 1).fillRect(x + i, y, 6, 90);
    g.fillStyle(hex('#1c6a3c'), 1).fillRect(x, y + 88, w, h - 88);
  },
  parque: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    mountains(g, y + 76, '#5c9c4c');
    // El Krater, la rueda y la torre al fondo.
    g.lineStyle(3, hex('#c8303c'), 1);
    g.beginPath();
    g.moveTo(x, y + 60);
    for (let i = 0; i <= 20; i++) g.lineTo(x + 10 + i * 6, y + 60 - Math.sin(i / 3) * 28);
    g.strokePath();
    g.lineStyle(2, hex('#e8e8f0'), 1).strokeCircle(x + 180, y + 40, 24);
    g.fillStyle(hex('#4c8c3c'), 1).fillRect(x, y + 80, w, h - 80);
    g.fillStyle(hex('#d8c8a8'), 1).fillRect(x, y + 90, w, h - 90);
  },
  parque_tarde: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'tarde');
    mountains(g, y + 76, '#3c5a54');
    g.lineStyle(2, hex('#f8dc68'), 1).strokeCircle(x + 180, y + 40, 24);
    g.fillStyle(hex('#3c6a34'), 1).fillRect(x, y + 80, w, h - 80);
  },
  cafetal: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'dia');
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 12; i++) {
        const cx = x + i * 20 + (r % 2) * 10;
        const cy = y + 46 + r * 16;
        g.fillStyle(hex('#2a6a34'), 1).fillEllipse(cx, cy, 20, 14);
        g.fillStyle(hex('#d8283c'), 1).fillRect(cx - 2, cy, 2, 2).fillRect(cx + 3, cy - 2, 2, 2);
      }
    }
  },
  bar: (g, x, y, w, h) => {
    g.fillStyle(hex('#3a2418'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8c4c24'), 1).fillRect(x, y, w, 60);
    for (let i = 0; i < 9; i++) g.fillStyle(hex(['#3c7c3c', '#c8a050', '#8c1c28', '#e8e8e8'][i % 4]), 1).fillRect(x + 10 + i * 10, y + 20, 5, 14);
    g.fillStyle(hex('#5a3a28'), 1).fillRect(x, y + 34, 100, 3);
    g.fillStyle(hex('#c8303c'), 1).fillRect(x + 180, y + 18, 26, 40);
    g.fillStyle(hex('#f8dc68'), 1).fillRect(x + 184, y + 22, 18, 12);
    g.fillStyle(hex('#1c7a44'), 1).fillRect(x, y + 86, w, h - 86);
    g.fillStyle(hex('#6a3c1c'), 1).fillRect(x, y + 84, w, 3);
    g.fillStyle(hex('#f8e8a8'), 0.18).fillTriangle(x + 110, y, x + 50, y + 90, x + 170, y + 90);
  },
  disco: (g, x, y, w, h) => {
    g.fillStyle(hex('#1c1824'), 1).fillRect(x, y, w, h);
    const cs = ['#7c3ca8', '#2c64c0', '#c8303c', '#1ca8a8'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 11; i++) g.fillStyle(hex(cs[(i + r) % 4]), 1).fillRect(x + i * 20, y + 80 + r * 10, 20, 10);
    disc(g, x + 110, y + 14, 9, '#c8c8d0');
    for (let i = 0; i < 8; i++) g.fillStyle(0xffffff, 1).fillRect(x + 104 + (i % 4) * 3, y + 8 + Math.floor(i / 4) * 6, 2, 2);
  },
  tienda: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'noche');
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y + 20, w, 70);
    g.fillStyle(hex('#3a2418'), 1).fillRect(x + 70, y + 36, 60, 54);
    g.fillStyle(hex('#f8e8a8'), 1).fillRect(x + 74, y + 40, 52, 50);
    for (let i = 0; i < 3; i++) g.fillStyle(hex('#8c5a34'), 1).fillRect(x + 78, y + 50 + i * 12, 44, 2);
    g.fillStyle(hex('#e8e8f0'), 1).fillRect(x + 150, y + 50, 26, 40);
    g.fillStyle(hex('#4c4c50'), 1).fillRect(x, y + 90, w, h - 90);
    for (let i = 0; i < w; i += 14) g.fillStyle(hex(['#f8dc68', '#e868a8', '#58d4d0'][(i / 14) % 3]), 1).fillRect(x + i, y + 22 + Math.round(Math.sin(i / 20) * 3), 2, 2);
  },
  depa: (g, x, y, w, h) => {
    g.fillStyle(hex('#f0ebe2'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7cb8e8'), 1).fillRect(x + 120, y + 10, 90, 60);
    g.fillStyle(hex('#5c6c7c'), 1).fillTriangle(x + 120, y + 60, x + 160, y + 34, x + 210, y + 60);
    g.fillStyle(hex('#3a3c44'), 1).fillRect(x + 164, y + 10, 2, 60);
    g.fillStyle(hex('#425e98'), 1).fillRect(x, y + 78, w, h - 78);
  },
  telefono: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2433'), 1).fillRect(x, y, w, h);
  },
  tejo: (g, x, y, w, h) => {
    g.fillStyle(hex('#5a4a38'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8c8c98'), 1).fillRect(x, y, w, 14);
    g.fillStyle(hex('#6a4428'), 1).fillRect(x + 120, y + 40, 90, 50);
    g.fillStyle(hex('#8c7c64'), 1).fillRect(x + 124, y + 44, 82, 42);
    g.lineStyle(2, hex('#c8c8d0'), 1).strokeCircle(x + 165, y + 65, 7);
    for (const [mx, my] of [[165, 54], [176, 65], [165, 76], [154, 65]]) g.fillStyle(hex('#f4f0e6'), 1).fillTriangle(x + mx - 4, y + my + 3, x + mx + 4, y + my + 3, x + mx, y + my - 4);
  },
  rueda: (g, x, y, w, h) => {
    sky(g, x, y, w, h, 'tarde');
    disc(g, x + 110, y + 70, 16, '#f8dc68');
    mountains(g, y + 76, '#3c3a5c');
    // El marco de la cabina.
    g.fillStyle(hex('#2c64c0'), 1).fillRect(x, y, w, 8).fillRect(x, y, 8, h).fillRect(x + w - 8, y, 8, h).fillRect(x, y + h - 14, w, 14);
  },
  vhs: (g, x, y, w, h) => {
    g.fillStyle(hex('#1c1430'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < h; i += 3) g.fillStyle(0xffffff, 0.04).fillRect(x, y + i, w, 1);
  },
};

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

type Prop = (g: G, cx: number, cy: number) => void;

const PROPS: Record<string, Prop> = {
  oblea: (g, cx, cy) => {
    disc(g, cx, cy, 13, INK);
    disc(g, cx, cy, 12, '#f0dca0');
    disc(g, cx, cy, 9, '#c8884c');
    for (let i = 0; i < 6; i++) g.fillStyle(hex('#5c1c3c'), 1).fillRect(cx - 6 + i * 2, cy - 2 + (i % 2) * 3, 2, 2);
    g.fillStyle(hex('#f8f4ec'), 1).fillRect(cx - 4, cy - 5, 2, 1).fillRect(cx + 3, cy + 3, 2, 1);
  },
  arepa: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 30, 14);
    g.fillStyle(hex('#e8c848'), 1).fillEllipse(cx, cy, 28, 12);
    g.fillStyle(hex('#f8f4ec'), 1).fillEllipse(cx, cy - 2, 16, 5);
  },
  solterita: (g, cx, cy) => {
    outlined(g, [[cx - 10, cy - 4, 20, 8, '#d8a058']]);
    flat(g, [[cx - 8, cy - 7, 16, 3, '#c8884c'], [cx - 7, cy - 9, 14, 2, '#f4f0e6']]);
  },
  taza: (g, cx, cy) => {
    outlined(g, [[cx - 7, cy - 6, 14, 12, '#f4f0e6'], [cx + 7, cy - 3, 3, 5, '#f4f0e6']]);
    flat(g, [[cx - 6, cy - 5, 12, 2, '#3a2010']]);
  },
  granos: (g, cx, cy) => {
    outlined(g, [[cx - 10, cy - 12, 20, 20, '#c8a070']]);
    for (let i = 0; i < 8; i++) g.fillStyle(hex('#3a2010'), 1).fillEllipse(cx - 6 + (i % 4) * 4, cy - 14 + Math.floor(i / 4) * 3, 3, 2);
  },
  trucha: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 44, 14);
    g.fillStyle(hex('#f4f0e6'), 1).fillEllipse(cx, cy, 42, 12);
    g.fillStyle(hex('#a8b8c0'), 1).fillEllipse(cx, cy, 30, 8);
    g.fillStyle(hex('#e8a8a0'), 1).fillEllipse(cx, cy, 22, 4);
    g.fillStyle(hex('#a8b8c0'), 1).fillTriangle(cx + 14, cy, cx + 22, cy - 5, cx + 22, cy + 5);
    g.fillStyle(hex(INK), 1).fillRect(cx - 12, cy - 2, 2, 2);
    g.fillStyle(hex('#e8c848'), 1).fillEllipse(cx - 30, cy, 22, 14);
  },
  empanada: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 26, 14);
    g.fillStyle(hex('#e8a848'), 1).fillEllipse(cx, cy, 24, 12);
    for (let i = 0; i < 6; i++) g.fillStyle(hex('#c8803c'), 1).fillRect(cx - 10 + i * 4, cy - 5, 2, 2);
  },
  tequila: (g, cx, cy) => {
    outlined(g, [[cx - 5, cy - 8, 10, 14, '#f8e8a8']]);
    flat(g, [[cx - 4, cy - 4, 8, 9, '#e8c860'], [cx - 4, cy - 8, 8, 2, '#ffffff']]);
  },
  limon: (g, cx, cy) => {
    disc(g, cx, cy, 6, INK);
    disc(g, cx, cy, 5, '#7cc840');
    disc(g, cx, cy, 3, '#c8f080');
  },
  sal: (g, cx, cy) => {
    outlined(g, [[cx - 4, cy - 8, 8, 14, '#e8e8f0'], [cx - 3, cy - 11, 6, 3, '#8c8c98']]);
  },
  cerveza: (g, cx, cy) => {
    outlined(g, [[cx - 3, cy - 14, 6, 20, '#8c6418'], [cx - 2, cy - 18, 4, 4, '#8c6418']]);
    flat(g, [[cx - 2, cy - 8, 4, 6, '#f4f0e6']]);
  },
  guaro: (g, cx, cy) => {
    for (let i = 0; i < 3; i++) outlined(g, [[cx - 12 + i * 9, cy - 4, 6, 8, '#e8f0f8']]);
  },
  foto: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 10, 28, 22, '#f8f8f0']]);
    flat(g, [[cx - 12, cy - 8, 24, 15, '#7cb8e8'], [cx - 12, cy + 2, 24, 5, '#c8303c']]);
  },
  aji: (g, cx, cy) => {
    outlined(g, [[cx - 6, cy - 10, 12, 16, '#c8303c'], [cx - 4, cy - 13, 8, 3, '#2c9c58']]);
    flat(g, [[cx - 4, cy - 6, 3, 8, '#e85a64']]);
  },
  guitarra: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy + 4, 22, 16);
    g.fillStyle(hex('#c8884c'), 1).fillEllipse(cx, cy + 4, 20, 14);
    disc(g, cx, cy + 3, 3, '#3a2010');
    outlined(g, [[cx - 2, cy - 22, 4, 20, '#6a4428']]);
  },
  paleta: (g, cx, cy) => {
    disc(g, cx, cy - 4, 9, INK);
    disc(g, cx, cy - 4, 8, '#c8303c');
    outlined(g, [[cx - 2, cy + 4, 4, 8, '#c8884c']]);
  },
  mate: (g, cx, cy) => {
    outlined(g, [[cx - 6, cy - 6, 12, 12, '#8c5a34']]);
    flat(g, [[cx - 5, cy - 6, 10, 2, '#5c9c4c'], [cx + 1, cy - 14, 2, 10, '#c8c8d0']]);
  },
  mazorca: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 12, 26);
    g.fillStyle(hex('#f0c830'), 1).fillEllipse(cx, cy, 10, 24);
    for (let i = 0; i < 6; i++) g.fillStyle(hex('#c89818'), 1).fillRect(cx - 4, cy - 9 + i * 3, 8, 1);
  },
  willys: (g, cx, cy) => {
    outlined(g, [[cx - 26, cy - 10, 52, 14, '#c8303c'], [cx - 4, cy - 20, 22, 10, '#9cd0f0']]);
    disc(g, cx - 16, cy + 6, 6, INK);
    disc(g, cx + 16, cy + 6, 6, INK);
    flat(g, [[cx - 24, cy - 24, 18, 4, '#5a3a24']]);
  },
  bandera_mx: (g, cx, cy) => {
    outlined(g, [[cx - 15, cy - 10, 30, 20, '#f4f0e6']]);
    flat(g, [[cx - 15, cy - 10, 10, 20, '#006847'], [cx + 5, cy - 10, 10, 20, '#ce1126'], [cx - 2, cy - 2, 4, 4, '#8c5a34']]);
  },
  bandera_cl: (g, cx, cy) => {
    outlined(g, [[cx - 15, cy - 10, 30, 20, '#f4f0e6']]);
    flat(g, [[cx - 15, cy, 30, 10, '#d8283c'], [cx - 15, cy - 10, 11, 10, '#2c4cb0']]);
    g.fillStyle(0xffffff, 1).fillRect(cx - 10, cy - 6, 2, 2);
  },
  corona: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillRect(cx - 13, cy - 3, 26, 10);
    g.fillStyle(hex('#f8dc68'), 1).fillRect(cx - 12, cy - 2, 24, 8);
    for (const dx of [-12, -4, 4]) g.fillStyle(hex('#f8dc68'), 1).fillTriangle(cx + dx, cy - 2, cx + dx + 8, cy - 2, cx + dx + 4, cy - 10);
  },
  llavero: (g, cx, cy) => {
    g.lineStyle(1, hex('#c8c8d0'), 1).strokeCircle(cx, cy - 12, 4);
    outlined(g, [[cx - 1, cy - 8, 2, 16, '#c8884c']]);
    g.fillStyle(hex('#2c9c58'), 1).fillEllipse(cx, cy - 8, 12, 4);
  },
  sombrero: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 36, 10);
    g.fillStyle(hex('#f4f0e6'), 1).fillEllipse(cx, cy, 34, 8);
    outlined(g, [[cx - 9, cy - 10, 18, 8, '#f4f0e6']]);
    flat(g, [[cx - 9, cy - 4, 18, 2, '#2a2433']]);
  },
  audifonos: (g, cx, cy) => {
    g.lineStyle(2, hex(INK), 1).beginPath().arc(cx, cy, 10, Math.PI, 0).strokePath();
    disc(g, cx - 10, cy + 2, 4, '#c8303c');
    disc(g, cx + 10, cy + 2, 4, '#c8303c');
  },
  cel: (g, cx, cy) => {
    outlined(g, [[cx - 8, cy - 14, 16, 28, '#2a2a34']]);
    flat(g, [[cx - 6, cy - 12, 12, 22, '#9cd0f0']]);
  },
  aguapanela: (g, cx, cy) => {
    outlined(g, [[cx - 8, cy - 8, 16, 14, '#e8742c']]);
    flat(g, [[cx - 7, cy - 7, 14, 3, '#a8601c'], [cx - 3, cy - 6, 6, 2, '#f8f0c8']]);
  },
  uchuva: (g, cx, cy) => {
    for (let i = 0; i < 5; i++) disc(g, cx - 8 + i * 4, cy + (i % 2) * 3, 3, '#f0a020');
  },
  granadilla: (g, cx, cy) => {
    disc(g, cx, cy, 9, INK);
    disc(g, cx, cy, 8, '#e8b828');
    disc(g, cx, cy, 5, '#d8d0a8');
    for (let i = 0; i < 5; i++) g.fillStyle(hex('#3a2a20'), 1).fillRect(cx - 3 + (i % 3) * 2, cy - 2 + Math.floor(i / 3) * 3, 1, 1);
  },
  queso: (g, cx, cy) => {
    outlined(g, [[cx - 12, cy - 6, 24, 12, '#f8f0c8']]);
    flat(g, [[cx - 12, cy - 6, 24, 2, '#e8e0b0']]);
  },
  planta: (g, cx, cy) => {
    outlined(g, [[cx - 6, cy, 12, 10, '#c0603c']]);
    g.fillStyle(hex('#2c9c58'), 1).fillEllipse(cx, cy - 6, 22, 14);
    g.fillStyle(hex('#e868a8'), 1).fillRect(cx - 3, cy - 10, 3, 3).fillRect(cx + 4, cy - 6, 3, 3);
  },
  bola: (g, cx, cy) => {
    disc(g, cx, cy, 6, '#101014');
    disc(g, cx + 12, cy + 2, 6, '#f4f0e6');
    g.fillStyle(0xffffff, 1).fillRect(cx - 2, cy - 2, 4, 3);
  },
  taco: (g, cx, cy) => {
    g.lineStyle(3, hex('#d8a868'), 1).lineBetween(cx - 40, cy + 10, cx + 30, cy - 6);
    g.lineStyle(3, hex('#5a8ad8'), 1).lineBetween(cx + 28, cy - 6, cx + 31, cy - 7);
  },
  tejo: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 20, 10);
    g.fillStyle(hex('#8c8c98'), 1).fillEllipse(cx, cy, 18, 8);
  },
  chocolatina: (g, cx, cy) => outlined(g, [[cx - 10, cy - 5, 20, 10, '#8c4c24']]),
  maleta: (g, cx, cy) => {
    outlined(g, [[cx - 10, cy - 8, 20, 16, '#2c64c0'], [cx - 4, cy - 12, 8, 4, '#1c3c84']]);
  },
};

// ---------------------------------------------------------------------------
// El compositor
// ---------------------------------------------------------------------------

const moodOpts = (m: Mood): BustOpts => {
  switch (m) {
    case 'open':
      return { mouth: 'open' };
    case 'teeth':
      return { mouth: 'teeth' };
    case 'grin':
      return { mouth: 'grin', eyes: 'squint' };
    case 'o':
      return { mouth: 'o' };
    case 'closed':
      return { eyes: 'closed' };
    case 'squint':
      return { eyes: 'squint' };
    case 'sleep':
      return { eyes: 'closed', mouth: 'o' };
    case 'sad':
      return { eyes: 'squint', mouth: 'o', blush: false };
    case 'blush':
      return { mouth: 'smile', blush: true };
    case 'cry':
      return { eyes: 'squint', mouth: 'open' };
    case 'green':
      return { eyes: 'squint', mouth: 'o', blush: false };
    default:
      return { mouth: 'smile' };
  }
};

function lookFor(id: string): HumanLook {
  if (id === 'player') return sinGorro(playerLook());
  return lookOf(id);
}

function drawCast(kit: VinetaKit, stage: Layer, cast: string[], s: number, shift = 0): void {
  const n = cast.length;
  cast.forEach((entry, i) => {
    const [id, moodRaw] = entry.split(' ');
    const mood = (moodRaw ?? 'smile') as Mood;
    const look = lookFor(id);
    const small = look.build === 'small';
    const tall = look.build === 'tall';
    const ss = small ? s * 0.82 : tall ? s * 1.12 : s;
    const cx = Math.round(W / 2 + shift + (i - (n - 1) / 2) * Math.min(56, 190 / Math.max(1, n)));
    const cy = Math.round(62 + (small ? 7 : tall ? -5 : 0));
    const g = addG(kit, stage);
    let l = look;
    if (mood === 'green') l = { ...look, skin: '#b8d8a0' };
    bust(g, l, cx, cy, ss, moodOpts(mood));
    if (mood === 'cry') kit.every(260, () => {
      const t = addG(kit, stage);
      const x = cx + (Math.random() < 0.5 ? -3 : 2) * ss;
      kit.progress(600, (k) => t.clear().fillStyle(0xa8e0ff, 1 - k).fillRect(x, cy + 1 * ss + k * 16, 1, 3), () => t.destroy());
    });
    if (mood === 'blush') g.fillStyle(0xe8607a, 0.5).fillRect(cx - 4 * ss, cy + 1 * ss, 2 * ss, ss).fillRect(cx + 2 * ss, cy + 1 * ss, 2 * ss, ss);
    if (mood === 'sleep') kit.every(900, () => floatZ(kit, stage, cx + 6 * ss, cy - 4 * ss));
    if (mood === 'grin' || mood === 'teeth') kit.every(1400 + i * 200, () => sparkle(kit, stage, cx + 6 * ss, cy - 6 * ss));
  });
}

/** Objetos: abajo al centro si la escena está vacía; si hay gente, en columna al costado derecho (sin tapar a nadie). */
function drawProps(kit: VinetaKit, stage: Layer, props: string[], withCast: boolean): void {
  const g = addG(kit, stage);
  props.forEach((p, i) => {
    const fn = PROPS[p];
    if (!fn) return;
    const n = props.length;
    if (withCast) fn(g, W - 26 - (i % 2) * 34, 88 - Math.floor(i / 2) * 30);
    else fn(g, Math.round(W / 2 + (i - (n - 1) / 2) * 46), 92);
  });
}

function drawFx(kit: VinetaKit, stage: Layer, fx: Fx[]): void {
  for (const f of fx) {
    if (f === 'hearts') kit.every(700, () => floatHeart(kit, stage, 40 + Math.random() * 140, 60));
    else if (f === 'heart1') kit.after(600, () => floatHeart(kit, stage, W / 2, 40));
    else if (f === 'notes') kit.every(500, () => floatNote(kit, stage, 20 + Math.random() * 180, 70, ['#f0d048', '#e868a8', '#58d4d0'][Math.floor(Math.random() * 3)]));
    else if (f === 'zzz') kit.every(800, () => floatZ(kit, stage, 60 + Math.random() * 100, 50));
    else if (f === 'sparkle') kit.every(500, () => sparkle(kit, stage, 20 + Math.random() * 180, 10 + Math.random() * 70));
    else if (f === 'stars') kit.every(300, () => sparkle(kit, stage, Math.random() * W, Math.random() * 40));
    else if (f === 'snore') kit.every(1100, () => popText(kit, stage, 60 + Math.random() * 100, 30, 'RRRonc', '#dce4f8', 7, 500));
    else if (f === 'sweat') kit.every(700, () => {
      const d = addG(kit, stage);
      const x = 60 + Math.random() * 100;
      kit.progress(600, (k) => d.clear().fillStyle(0x9cd0f0, 1 - k).fillRect(x, 30 + k * 16, 2, 3), () => d.destroy());
    });
    else if (f === 'flash') kit.after(300, () => {
      const fl = addG(kit, stage);
      kit.progress(500, (k) => fl.clear().fillStyle(0xffffff, 0.8 * (1 - k)).fillRect(0, 0, W, H), () => fl.destroy());
    });
    else if (f === 'rain') {
      const r = addG(kit, stage);
      let t = 0;
      kit.every(50, () => {
        t += 1;
        r.clear().fillStyle(0xc8dcf0, 0.8);
        for (let i = 0; i < 40; i++) r.fillRect((i * 37) % W, (i * 53 + t * 5) % H, 1, 3);
      });
    } else if (f === 'mist') {
      const m = addG(kit, stage);
      let t = 0;
      kit.every(80, () => {
        t += 0.6;
        m.clear().fillStyle(0xffffff, 0.22);
        for (let i = 0; i < 4; i++) m.fillEllipse(((i * 70 + t) % (W + 80)) - 40, 30 + i * 14, 90, 16);
      });
    } else if (f === 'steam') kit.every(400, () => {
      const s = addG(kit, stage);
      const x = W / 2 - 10 + Math.random() * 20;
      kit.progress(1000, (k) => s.clear().fillStyle(0xffffff, 0.5 * (1 - k)).fillCircle(x + Math.sin(k * 6) * 3, 84 - k * 30, 2 + k * 4), () => s.destroy());
    });
    else if (f === 'confetti') kit.every(90, () => {
      const c = addG(kit, stage);
      const x = Math.random() * W;
      const col = [0xc8303c, 0x2c9c58, 0xf8dc68, 0x2c64c0, 0xe868a8][Math.floor(Math.random() * 5)];
      kit.progress(1300, (k) => c.clear().fillStyle(col, 1).fillRect(x + Math.sin(k * 8) * 4, -4 + k * 116, 2, 3), () => c.destroy());
    });
    else if (f === 'lights') {
      const l = addG(kit, stage);
      let t = 0;
      kit.every(220, () => {
        t++;
        l.clear();
        const cs = [0xe868a8, 0x58d4d0, 0xf8dc68, 0x7c3ca8];
        for (let i = 0; i < 6; i++) l.fillStyle(cs[(i + t) % 4], 0.18).fillTriangle(110, 10, (i * 47 + t * 13) % W, 108, ((i * 47 + t * 13) % W) + 30, 108);
      });
    }
  }
}

function compose(spec: Spec): VinetaBuilder {
  return (kit) => {
    build(kit, spec);
  };
}

function build(kit: VinetaKit, spec: Spec): Layer {
  {
    const bg = BACKDROPS[spec.b] ?? BACKDROPS.calle;
    const stage = kit.framed(bg);
    const fx = spec.fx ? (Array.isArray(spec.fx) ? spec.fx : [spec.fx]) : [];
    if (fx.includes('lights') || fx.includes('mist')) drawFx(kit, stage, fx.filter((f) => f === 'lights' || f === 'mist'));
    const crowded = (spec.c?.length ?? 0) >= 3;
    if (spec.c) drawCast(kit, stage, spec.c, spec.s ?? 3, spec.p ? (crowded ? -22 : -30) : 0);
    if (spec.p) drawProps(kit, stage, spec.p, !!spec.c);
    if (spec.t) kit.after(350, () => popText(kit, stage, W / 2, 12, spec.t ?? '', spec.tc ?? '#fff2a0', 9, 0));
    drawFx(kit, stage, fx.filter((f) => f !== 'lights' && f !== 'mist'));
    return stage;
  }
}

// ---------------------------------------------------------------------------
// Escenas propias
// ---------------------------------------------------------------------------

function label(kit: VinetaKit, stage: Layer, x: number, y: number, text: string, color = INK, size = 7, width = 180): Phaser.GameObjects.Text {
  const t = makeText(kit.scene, x, y, text, { fontSize: `${size}px`, fontStyle: '600', color, align: 'center', wordWrap: { width } }).setOrigin(0.5, 0);
  stage.add(t);
  return t;
}

/** La pantalla del celular con una foto o un chat. */
function phoneFrame(kit: VinetaKit, stage: Layer): G {
  const g = addG(kit, stage);
  outlined(g, [[70, 4, 80, 100, '#1c1c24']]);
  flat(g, [[74, 10, 72, 88, '#f4f0e6'], [100, 6, 20, 2, '#3a3a48']]);
  return g;
}

const fotogramRecuerdo: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#e868a8']]);
  label(kit, stage, 110, 12, 'Fotogram · Recuerdos', '#ffffff', 6, 70);
  // La foto: la plaza de noche, la bandera, los vasitos y una bufanda roja y amarilla.
  flat(g, [[78, 26, 64, 46, '#141c34'], [78, 60, 64, 12, '#5a5048']]);
  for (let i = 0; i < 10; i++) g.fillStyle(0xf8f4ec, 0.8).fillRect(80 + ((i * 17) % 60), 28 + ((i * 7) % 20), 1, 1);
  g.fillStyle(hex('#d8d4cc'), 1).fillRect(132, 34, 2, 30);
  g.fillStyle(hex('#2c6a34'), 1).fillEllipse(133, 34, 16, 5);
  flat(g, [[84, 44, 14, 9, '#006847'], [98, 44, 6, 9, '#f4f0e6'], [104, 44, 6, 9, '#ce1126']]);
  for (const [x, c] of [[90, '#f0c8a0'], [104, '#d8a880'], [118, '#f8e2d4'], [128, '#c89068']] as const) {
    disc(g, x, 58, 4, INK);
    disc(g, x, 58, 3, c);
  }
  flat(g, [[115, 62, 8, 3, '#c8303c'], [115, 65, 8, 2, '#e8b828']]);
  PROPS.tequila(g, 132, 66);
  label(kit, stage, 110, 75, 'Hace 3 semanas · Salento', INK, 6, 72);
  label(kit, stage, 110, 88, '♡ 23  · 7 comentarios', '#8c8c98', 5, 72);
  kit.every(1200, () => floatHeart(kit, stage, 90 + Math.random() * 40, 70));
};

function chatVineta(from: string, color: string, lines: string[]): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = phoneFrame(kit, stage);
    flat(g, [[74, 10, 72, 12, color]]);
    label(kit, stage, 110, 12, from, '#ffffff', 7, 70);
    lines.forEach((ln, i) =>
      kit.after(400 + i * 700, () => {
        const t = makeText(kit.scene, 80, 28 + i * 24, ln, { fontSize: '6px', color: INK, backgroundColor: '#e8e8f0', padding: { x: 2, y: 1 }, wordWrap: { width: 58 } });
        stage.add(t);
      }),
    );
  };
}

/** El panel del ascensor del Bobo, en el presente: el 8 encendido y el 11 justo arriba, apagado. */
const botonOnce: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a0a8b8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#68707e'), 1).fillRect(x, y + 100, w, h - 100);
  });
  const g = addG(kit, stage);
  outlined(g, [[80, 6, 60, 92, '#c8ccd4']]);
  flat(g, [[80, 6, 60, 92, '#c8ccd4'], [84, 10, 52, 84, '#d8dce4']]);
  // Doce botones en dos columnas, del 1 (abajo) al 12 (arriba).
  const pos = (n: number): [number, number] => [n % 2 ? 98 : 122, 84 - Math.floor((n - 1) / 2) * 13];
  for (let n = 1; n <= 12; n++) {
    const [bx, by] = pos(n);
    outlined(g, [[bx - 5, by - 5, 10, 10, n === 8 ? '#f8e070' : '#eceef2']]);
    label(kit, stage, bx, by - 4, String(n), n === 8 ? '#a05a10' : INK, 6, 12);
  }
  const [x11, y11] = pos(11);
  kit.after(900, () => sparkle(kit, stage, x11 + 8, y11 - 8));
  kit.after(1400, () => popText(kit, stage, 172, y11, '11', '#fff2a0', 10, 0));
};

/** La foto del Krater, según cómo saliste (flags `m8_foto_*`). */
const fotoKrater: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#2a2433'), 1).fillRect(x, y, w, h);
  });
  const g = addG(kit, stage);
  outlined(g, [[40, 6, 140, 94, '#f8f8f0']]);
  flat(g, [[46, 12, 128, 72, '#9cd0f0'], [46, 60, 128, 24, '#5c9c4c']]);
  g.lineStyle(3, hex('#c8303c'), 1).lineBetween(46, 40, 174, 76);
  outlined(g, [[78, 50, 64, 16, '#c8303c']]);
  const manos = StoryState.hasFlag('m8_foto_manos');
  const grito = StoryState.hasFlag('m8_foto_grito');
  bust(g, sinGorro(playerLook()), 96, 44, 2.2, manos ? { mouth: 'grin', eyes: 'squint' } : grito ? { mouth: 'open' } : { mouth: 'o', eyes: 'open', blush: false });
  bust(g, lookOf('flor'), 124, 44, 2.2, manos ? { eyes: 'closed', mouth: 'open' } : { mouth: 'teeth', eyes: 'squint' });
  if (manos) flat(g, [[88, 18, 3, 16, '#f0c8a0'], [102, 18, 3, 16, '#f0c8a0']]);
  else if (!grito) flat(g, [[130, 18, 3, 14, '#f4d8c0'], [140, 18, 3, 14, '#f4d8c0']]);
  label(kit, stage, 110, 88, 'KRATER · PARQUE DEL CAFÉ', INK, 6, 130);
  kit.after(200, () => {
    const fl = addG(kit, stage);
    kit.progress(500, (k) => fl.clear().fillStyle(0xffffff, 0.9 * (1 - k)).fillRect(0, 0, W, H), () => fl.destroy());
  });
};

/** Arriba de la Rueda: los dos de espaldas mirando el atardecer (y, si se acercan, más cerca). */
function ruedaScene(close: boolean, renzo = false): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.rueda);
    const g = addG(kit, stage);
    const gap = close ? 15 : 26;
    for (const [cx, look] of [[110 - gap, sinGorro(playerLook())], [110 + gap, lookOf('flor')]] as const) {
      g.fillStyle(hex(INK), 1).fillRect(cx - 9, 70, 18, 24);
      g.fillStyle(hex(look.shirt), 1).fillRect(cx - 8, 71, 16, 23);
      disc(g, cx, 62, 8, INK);
      disc(g, cx, 62, 7, look.hair);
      if (look.hairStyle === 'long') g.fillStyle(hex(look.hair), 1).fillRect(cx - 6, 62, 12, 14);
    }
    if (close) kit.every(900, () => floatHeart(kit, stage, 110, 50));
    if (renzo) kit.after(300, () => popText(kit, stage, 170, 30, '¡¿ESTÁN VIVOS?!', '#fff2a0', 9, 0));
    kit.every(1600, () => sparkle(kit, stage, 110, 70));
  };
}

/** El tequila paso a paso: la mano con sal, el caballito y el limón; marca lo que ya hiciste. */
function tequilaPaso(step: number, ok?: boolean): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.plaza);
    const g = addG(kit, stage);
    flat(g, [[20, 70, 180, 34, '#8c5a34']]);
    const items: Array<[string, Prop, string]> = [['SAL', PROPS.sal, '#e8e8f0'], ['TEQUILA', PROPS.tequila, '#e8c860'], ['LIMÓN', PROPS.limon, '#7cc840']];
    items.forEach(([name, fn], i) => {
      const cx = 55 + i * 55;
      fn(g, cx, 84);
      label(kit, stage, cx, 94, `${i + 1}. ${name}`, '#fff2d0', 6, 50);
      if (i < step) {
        g.lineStyle(2, hex('#5cc880'), 1).lineBetween(cx - 8, 72, cx - 3, 77).lineBetween(cx - 3, 77, cx + 8, 66);
      }
    });
    if (ok === true) {
      kit.after(300, () => popText(kit, stage, 110, 20, '¡ESO, CHILENO!', '#fff2a0', 11, 0));
      drawFx(kit, stage, ['confetti']);
    } else if (ok === false) {
      kit.after(300, () => popText(kit, stage, 110, 20, '*cof cof*', '#ffb0b0', 11, 0));
    } else {
      bust(g, lookOf('laura'), 190, 40, 2.4, { mouth: 'smile', eyes: 'squint' });
      bust(g, lookOf('chuy'), 30, 40, 2.4, { mouth: 'grin', eyes: 'squint' });
    }
  };
}

/** ¡Viva México! El grito en la plaza, con la bandera y el eco en los balcones. */
const grito: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.plaza);
  const g = addG(kit, stage);
  PROPS.bandera_mx(g, 110, 26);
  drawCast(kit, stage, ['ximena open', 'chuy open', 'player open', 'laura grin', 'renata open'], 2.4);
  kit.after(250, () => popText(kit, stage, 110, 6, '¡VIVA MÉXICO!', '#ffffff', 12, 0));
  drawFx(kit, stage, ['confetti', 'notes']);
};

/** El «¿y si...?»: la escena teñida de morado, con líneas de VHS y la etiqueta en la esquina. */
function whatIf(inner: Spec, tag = '¿Y SI...?'): VinetaBuilder {
  return (kit) => {
    const stage = build(kit, inner);
    const g = addG(kit, stage);
    g.fillStyle(0x7c3ca8, 0.22).fillRect(0, 0, W, H);
    let t = 0;
    const lines = addG(kit, stage);
    kit.every(80, () => {
      t++;
      lines.clear();
      for (let i = 0; i < H; i += 4) lines.fillStyle(0xffffff, 0.05).fillRect(0, i, W, 1);
      lines.fillStyle(0xffffff, 0.18).fillRect(0, (t * 7) % H, W, 2);
    });
    label(kit, stage, 186, 4, `▶ ${tag}`, '#f8dc68', 7, 60);
  };
}

/**
 * El teleférico visto desde arriba: el cañón con el río y el bosque de guadua, las dos estaciones, el cable y la
 * cabina amarilla (con su sombra en el bosque) cruzando de un lado al otro. Las otras cabinas pasan al revés.
 */
function teleferico(dir: 1 | -1): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed((g, x, y, w, h) => {
      g.fillStyle(hex('#4c7a34'), 1).fillRect(x, y, w, h);
      // El bosque de guadua: manchas de verde de distintos tonos.
      for (let i = 0; i < 90; i++) {
        const gx = x + ((i * 53) % w);
        const gy = y + ((i * 37) % h);
        g.fillStyle(hex(['#3c6a2c', '#5c8c3c', '#6c9c44'][i % 3]), 1).fillCircle(gx, gy, 5 + (i % 3));
      }
      // El cañón: más oscuro al fondo, con el río serpenteando de arriba abajo.
      g.fillStyle(hex('#2c4a24'), 1).fillEllipse(x + w / 2, y + h / 2, 90, h + 30);
      g.fillStyle(hex('#3a5a2c'), 1).fillEllipse(x + w / 2, y + h / 2, 64, h + 30);
      for (let yy = 0; yy < h; yy += 2) {
        const rx = x + w / 2 + Math.sin(yy / 14) * 10;
        g.fillStyle(hex('#7a6448'), 1).fillRect(rx - 4, y + yy, 8, 2);
        g.fillStyle(hex('#5c8cb8'), 1).fillRect(rx - 2, y + yy, 4, 2);
      }
      // Los techos rojos de las atracciones a lo lejos y el camino.
      flat(g, [[x + 8, y + 70, 14, 10, '#c8303c'], [x + 190, y + 10, 18, 12, '#c8303c'], [x + 182, y + 80, 22, 8, '#e8b828']]);
      g.fillStyle(hex('#d8c8a8'), 1).fillRect(x, y + 92, 40, 4).fillRect(x + 180, y + 30, 40, 4);
      // Las estaciones: techos azules a cada lado.
      outlined(g, [[x + 4, y + 40, 24, 22, '#2c64c0'], [x + 192, y + 40, 24, 22, '#2c64c0']]);
      flat(g, [[x + 6, y + 42, 20, 3, '#5a90e8'], [x + 194, y + 42, 20, 3, '#5a90e8']]);
    });
    const g = addG(kit, stage);
    g.lineStyle(1, hex('#2a2433'), 1).lineBetween(28, 48, 192, 48).lineBetween(28, 54, 192, 54);
    const other = addG(kit, stage);
    const cab = addG(kit, stage);
    const from = dir === 1 ? 28 : 192;
    const to = dir === 1 ? 192 : 28;
    const draw = (t: number): void => {
      const x = lerp(from, to, t);
      // La sombra de la cabina cae sobre el bosque, más abajo y a un lado.
      cab.clear();
      cab.fillStyle(0x000000, 0.25).fillEllipse(x + 6, 74, 16, 7);
      cab.fillStyle(hex('#2a2433'), 1).fillRect(x - 8, 41, 16, 14);
      cab.fillStyle(hex('#e8b828'), 1).fillRect(x - 7, 42, 14, 12);
      cab.fillStyle(hex('#9cd0f0'), 1).fillRect(x - 5, 44, 10, 8);
      // Desde arriba: cuatro cabecitas (tú, Juanpa, Renzo... y el de la cabina de al lado).
      for (const [hx, hy, c] of [[-3, 46, '#3a2418'], [2, 46, '#1c1418'], [-3, 50, '#1c1418'], [2, 50, '#5a3a24']] as const) cab.fillStyle(hex(c), 1).fillRect(x + hx, hy, 3, 3);
      cab.fillStyle(hex('#2a2433'), 1).fillRect(x - 1, 38, 2, 4);
      const ox = lerp(to, from, (t * 1.3) % 1);
      other.clear().fillStyle(hex('#2a2433'), 1).fillRect(ox - 6, 47, 12, 10).fillStyle(hex('#e8742c'), 1).fillRect(ox - 5, 48, 10, 8);
    };
    draw(0);
    kit.progress(9000, (t) => draw(t), () => draw(1), 'Sine.InOut');
    kit.every(1600, () => popText(kit, stage, 60 + Math.random() * 100, 20, 'fiuuu', '#ffffff', 7, 600));
    kit.after(300, () => popText(kit, stage, 110, 96, dir === 1 ? 'Entrada → Plaza principal' : 'Plaza principal → Entrada', '#fff2d0', 7, 0));
  };
}

const vhs: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.vhs);
  const g = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t++;
    g.clear();
    for (let i = 0; i < 6; i++) g.fillStyle(0xffffff, 0.12).fillRect(0, (t * 9 + i * 19) % H, W, 2);
  });
  kit.after(200, () => popText(kit, stage, 110, 40, '◀◀ REBOBINANDO', '#f8dc68', 12, 0));
  label(kit, stage, 110, 70, 'Esa noche, en realidad...', '#dfe6f4', 8, 200);
};

/** El valle de Cocora desde el Alto de la Cruz, con la neblina entrando. */
const vistaCocora: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.mirador);
  drawFx(kit, stage, ['mist']);
  const g = addG(kit, stage);
  flat(g, [[0, 96, W, 4, '#4a2c18'], [0, 102, W, 4, '#4a2c18']]);
  for (let x = 4; x < W; x += 20) flat(g, [[x, 94, 3, 14, '#5a3a20']]);
  kit.after(400, () => popText(kit, stage, 110, 10, 'Valle de Cocora', '#ffffff', 9, 0));
};

const kraterCarro: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => sky(g, x, y, w, h, 'dia'));
  const g = addG(kit, stage);
  g.lineStyle(4, hex('#c8303c'), 1).lineBetween(0, 100, 220, 40);
  outlined(g, [[60, 62, 90, 24, '#c8303c']]);
  flat(g, [[60, 62, 90, 4, '#f8dc68']]);
  bust(g, sinGorro(playerLook()), 88, 50, 2.4, { mouth: 'o', blush: false });
  bust(g, lookOf('flor'), 122, 50, 2.4, { mouth: 'teeth', eyes: 'squint' });
  kit.every(700, () => popText(kit, stage, 40 + Math.random() * 140, 20, 'clac', '#ffffff', 7, 400));
};

// ---------------------------------------------------------------------------
// La tabla de viñetas
// ---------------------------------------------------------------------------

const SPECS: Record<string, Spec> = {
  // El presente
  m8_depa_sabado: { b: 'depa', c: ['player smile'], p: ['cel'], fx: 'sparkle' },
  // El bus
  m8_terminal_cali: { b: 'terminal', c: ['player smile'], p: ['maleta'], t: 'Terminal de Cali · Plataforma 14' },
  m8_danilo_hola: { b: 'bus', c: ['danilo grin'], t: '¡Ah ve!' },
  m8_bus_adentro: { b: 'bus', c: ['nacho grin', 'antoine smile', 'iker teeth', 'renzo smile', 'juanpa grin'], s: 2.4, fx: 'notes' },
  m8_richi_saluda: { b: 'bus', c: ['richi grin'], t: '¡Ve, chileno!', fx: 'sparkle' },
  m8_bus_richi: { b: 'bus', c: ['player smile', 'richi grin'] },
  m8_ventana_cana: { b: 'bus', c: ['player smile'], t: 'Recta Cali–Palmira' },
  m8_richi_achichay: { b: 'calle_noche', c: ['richi open'], t: '¡ACHICHAY!', tc: '#a8e0ff', fx: 'mist' },
  m8_richi_risa: { b: 'bus', c: ['richi grin'], fx: 'sparkle' },
  m8_basilica_buga: { b: 'bus', c: ['player o'], t: 'Buga · La Basílica' },
  m8_vendedor_bus: { b: 'bus', c: ['player smile'], p: ['empanada', 'taza'], t: '¡Pandebono, maní, chicharrón!' },
  m8_empanada_pipian: { b: 'bus', c: ['richi grin', 'player blush'], p: ['empanada'], fx: 'hearts' },
  m8_bus_musica: { b: 'bus', c: ['antoine smile', 'juanpa grin'], p: ['guitarra'], fx: 'notes' },
  m8_audifonos: { b: 'bus', c: ['player closed', 'richi closed'], p: ['audifonos'], fx: 'notes' },
  m8_cordillera: { b: 'bus', c: ['player smile'], fx: 'mist', t: 'Subiendo la cordillera' },
  m8_richi_serio: { b: 'bus', c: ['richi smile', 'player sad'], fx: 'mist' },
  m8_armenia: { b: 'bus', c: ['player smile'], t: 'Armenia' },
  m8_richi_duerme: { b: 'bus', c: ['player blush', 'richi sleep'], fx: 'zzz' },
  m8_danilo_foto: { b: 'bus', c: ['danilo grin'], p: ['cel'], fx: 'flash' },
  m8_tami_saluda: { b: 'bus', c: ['tami blush'], fx: 'heart1' },
  m8_boquia: { b: 'calle_lluvia', c: ['player o'], fx: 'mist', t: 'Boquía · río Quindío' },
  m8_llegada_salento: { b: 'calle_noche', c: ['player o'], fx: ['mist', 'stars'], t: 'Salento' },
  m8_terminal_salento: { b: 'calle_noche', c: ['danilo smile', 'player o', 'tami smile'], fx: 'mist', t: '12 °C' },
  m8_danilo_guia: { b: 'calle', c: ['danilo grin'], t: '¡Todos juntos!' },
  m8_renzo_aji: { b: 'calle', c: ['renzo o'], p: ['aji'], t: '¿Ají?' },
  m8_fila_salento: { b: 'calle_noche', c: ['richi grin', 'juanpa smile', 'player smile', 'renzo smile', 'danilo grin', 'tami smile'], s: 2.2, fx: 'mist' },
  // La casita
  m8_casita_entrada: { b: 'casita', c: ['player o'], p: ['taza'], fx: 'steam' },
  m8_rubiela: { b: 'cocina', c: ['rubiela grin'], p: ['aguapanela'], fx: 'steam' },
  m8_aguapanela: { b: 'cocina', c: ['player blush'], p: ['aguapanela', 'queso'], fx: 'steam' },
  m8_camarotes: { b: 'camarotes', c: ['richi grin', 'juanpa smile', 'renzo smile', 'danilo squint'], s: 2.4 },
  m8_camarotes_noche: { b: 'camarotes', c: ['player squint'], fx: 'zzz' },
  m8_renzo_suena: { b: 'camarotes', c: ['renzo sleep'], p: ['aji'], t: '...rocoto...', tc: '#dce4f8' },
  m8_juanpa_ronca: { b: 'camarotes', c: ['juanpa sleep', 'richi grin'], fx: 'snore' },
  m8_noche_zzz: { b: 'camarotes', c: ['player sleep'], fx: ['zzz', 'stars'] },
  m8_ducha_fria: { b: 'casita', c: ['player open'], t: '¡ACHICHAY!', tc: '#a8e0ff', fx: 'sweat' },
  m8_juanpa: { b: 'calle', c: ['juanpa grin'] },
  m8_juanpa_renzo: { b: 'calle', c: ['juanpa grin', 'player smile', 'renzo smile'] },
  m8_hamaca: { b: 'patio', c: ['player closed'], fx: 'zzz' },
  m8_cuadro_cocora: { b: 'mirador', t: '«aquí me enamoré»', tc: '#fff2d0', fx: 'mist' },
  m8_ventana_tejas: { b: 'calle', fx: 'steam' },
  m8_cocina_casita: { b: 'cocina', p: ['taza', 'taza', 'taza'], t: 'EL QUE LO TERMINA, LO HACE', fx: 'steam' },
  m8_nevera_casita: { b: 'cocina', p: ['queso', 'limon', 'arepa', 'aji'], t: 'RENZO - NO TOCAR' },
  m8_mesa_pinpon: { b: 'patio', p: ['paleta', 'paleta'], t: 'TORNEO DE PIMPÓN' },
  // Salento: la plaza y el mercado
  m8_salento_dia: { b: 'plaza', c: ['juanpa grin', 'player smile', 'renzo smile'], fx: 'sparkle' },
  m8_willys: { b: 'plaza', c: ['don_hernando grin'], p: ['willys'], t: '¡Cocora, Cocora!' },
  m8_willys_colgado: { b: 'mirador', p: ['willys'], c: ['player open'], t: '¡El viento en la cara!' },
  m8_aristobulo: { b: 'plaza', c: ['aristobulo smile'], fx: 'sparkle' },
  m8_palma_cera: { b: 'plaza', t: 'La palma de cera · 60 m', fx: 'sparkle' },
  m8_gringos: { b: 'plaza', c: ['mochilera grin', 'player smile'], t: '¿Ca-chai?' },
  m8_palomas: { b: 'plaza', c: ['nino grin'], t: 'currucucú' },
  m8_iglesia: { b: 'plaza', c: ['renzo closed'], t: 'Parroquia Ntra. Sra. del Carmen' },
  m8_obleas: { b: 'plaza', c: ['obleera grin'], p: ['oblea'] },
  m8_arepa_choclo: { b: 'plaza', c: ['arepera grin'], p: ['arepa'], fx: 'steam' },
  m8_aji_casa: { b: 'plaza', c: ['arepera grin'], p: ['aji', 'arepa'], t: 'Ají de la casa' },
  m8_renzo_llora: { b: 'plaza', c: ['renzo cry'], p: ['aji'], t: '...no pica nada', tc: '#ffb0b0' },
  m8_solteritas: { b: 'plaza', c: ['solteritero grin'], p: ['solterita'] },
  m8_cafe_filtrado: { b: 'casita', c: ['barista smile'], p: ['taza'], fx: 'steam' },
  m8_mercado: { b: 'mercado', c: ['renzo open', 'juanpa smile'], fx: 'sparkle', t: 'Mercado campesino' },
  m8_frutas: { b: 'mercado', c: ['ofelia grin'], p: ['uchuva', 'granadilla'] },
  m8_granadilla: { b: 'mercado', c: ['juanpa o'], p: ['granadilla'] },
  m8_queso: { b: 'mercado', c: ['abelardo smile'], p: ['queso'] },
  m8_cafe_grano: { b: 'mercado', c: ['ramiro smile'], p: ['granos', 'taza'], fx: 'steam' },
  m8_artesanias: { b: 'mercado', c: ['artesana smile'], p: ['sombrero', 'llavero'] },
  m8_sombrero_juanpa: { b: 'mercado', c: ['juanpa grin'], p: ['sombrero'], t: 'Caficultor exitoso' },
  m8_llavero: { b: 'mercado', c: ['player smile'], p: ['llavero'], fx: 'heart1' },
  m8_plantas: { b: 'mercado', c: ['viverista smile'], p: ['planta'] },
  m8_escalera_renzo: { b: 'mirador', c: ['renzo green', 'juanpa smile'], fx: 'sweat', t: '250 escalones' },
  m8_foto_mirador: { b: 'mirador', c: ['juanpa grin', 'renzo sleep'], p: ['sombrero'], fx: 'flash' },
  m8_trucha_local: { b: 'plaza', c: ['leonor grin'], p: ['trucha'] },
  m8_trucha: { b: 'casita', c: ['juanpa grin', 'player smile', 'renzo grin'], p: ['trucha'], s: 2.6, fx: 'steam' },
  m8_charla_mesa: { b: 'casita', c: ['juanpa grin', 'player smile', 'renzo grin'], p: ['taza', 'taza'], s: 2.6 },
  m8_chiva_afuera: { b: 'plaza', c: ['don_jairo_chiva grin'], t: '¡Sale la chiva!' },
  m8_ciclista: { b: 'calle', c: ['ciclista grin'], t: 'Ushuaia → Alaska' },
  m8_paisas: { b: 'plaza', c: ['senora_paisa grin', 'renzo o'] },
  // La chiva y el parque
  m8_chiva_adentro: { b: 'chiva', c: ['danilo grin', 'richi grin', 'juanpa open', 'renzo smile'], s: 2.4, fx: 'notes' },
  m8_chiva_noche: { b: 'chiva_noche', c: ['richi sleep', 'player smile', 'juanpa sleep'], fx: 'stars' },
  m8_tami_chiva: { b: 'chiva', c: ['player blush', 'tami grin'], fx: 'heart1' },
  m8_danilo_chiva: { b: 'chiva', c: ['danilo open'], t: '¡¿CÓMO ESTÁ LA CHIVA?!', fx: 'notes' },
  m8_renzo_mareado: { b: 'chiva', c: ['renzo green'], fx: 'sweat' },
  m8_parque_entrada: { b: 'parque', c: ['juanpa grin', 'player o', 'renzo smile'], t: 'Parque del Café', fx: 'sparkle' },
  m8_argentinas: { b: 'parque', c: ['flor grin', 'meli smile'], p: ['mate'] },
  m8_flor: { b: 'parque', c: ['flor smile'], fx: 'heart1' },
  m8_flor_risa: { b: 'parque', c: ['flor grin', 'player blush'], fx: 'hearts' },
  m8_flor_seria: { b: 'rueda', c: ['flor smile'] },
  m8_meli: { b: 'parque', c: ['meli smile'], p: ['mate'] },
  m8_krater_cartel: { b: 'parque', p: ['foto'], t: 'KRATER · 380 m', tc: '#ffb0b0' },
  m8_barco_cartel: { b: 'parque', c: ['meli o', 'renzo green'], t: 'Barco del Café' },
  m8_chocones_cartel: { b: 'parque', c: ['flor grin', 'juanpa open', 'meli smile'], t: '¡BONK!' },
  m8_rueda_cartel: { b: 'parque_tarde', t: 'Rueda Panorámica', fx: 'sparkle' },
  m8_rueda_cabina: { b: 'rueda', c: ['player smile', 'flor smile'] },
  m8_rueda_vista: { b: 'rueda', fx: 'sparkle', t: 'El Quindío al atardecer' },
  m8_rueda_risa: { b: 'rueda', c: ['player grin', 'flor grin'], fx: 'hearts' },
  m8_parque_atardecer: { b: 'parque_tarde', c: ['flor smile', 'meli smile'] },
  m8_torre_vista: { b: 'mirador', t: 'Torre Mirador', fx: 'mist' },
  m8_cafetal: { b: 'cafetal', c: ['guia_cafe smile'] },
  m8_museo: { b: 'casita', p: ['granos', 'foto'], t: 'Museo del Café' },
  m8_show_cafe: { b: 'parque', c: ['tami grin', 'danilo grin', 'richi grin'], fx: 'notes', t: 'Show del Café' },
  m8_show_baile: { b: 'parque', c: ['player grin'], fx: ['notes', 'confetti'] },
  m8_teleferico: { b: 'mirador', c: ['renzo closed'], fx: 'mist', t: 'Teleférico' },
  m8_rapidos: { b: 'parque', t: 'USTED SE VA A MOJAR', tc: '#a8e0ff' },
  m8_rapidos_moja: { b: 'parque', c: ['player open', 'renzo smile'], fx: 'rain' },
  m8_banderas: { b: 'parque', p: ['bandera_mx', 'bandera_cl'] },
  m8_bandera_chile: { b: 'parque', c: ['player sad'], p: ['bandera_cl'], fx: 'sparkle' },
  m8_tren_cafe: { b: 'parque', c: ['nino grin'], t: '¡Chu-chuuu!' },
  m8_plaza_comidas: { b: 'parque', c: ['renzo grin'], p: ['mazorca'], fx: 'steam' },
  m8_fabulas: { b: 'parque', t: 'Lago de Fábulas' },
  m8_guadual: { b: 'cafetal', fx: 'mist', t: 'El guadual' },
  // Sábado en la noche
  m8_salento_noche: { b: 'calle_noche', c: ['richi open', 'player smile'], fx: ['mist', 'stars'] },
  m8_cena_casita: { b: 'casita', c: ['rubiela grin', 'player smile', 'richi grin', 'tami smile'], s: 2.4, fx: 'steam' },
  m8_ronda_preguntas: { b: 'casita', c: ['danilo squint', 'tami smile'], p: ['aguapanela'] },
  m8_guitarra_antoine: { b: 'casita', c: ['antoine closed', 'tami blush'], p: ['guitarra'], fx: 'notes' },
  // Domingo
  m8_domingo_lluvia: { b: 'casita', c: ['juanpa sleep', 'danilo sleep'], fx: 'rain' },
  m8_salento_lluvia: { b: 'calle_lluvia', c: ['richi grin', 'player smile'], fx: 'rain' },
  m8_tami_paraguas: { b: 'calle_lluvia', c: ['tami blush'], fx: 'rain' },
  m8_tami_tinto: { b: 'calle_lluvia', c: ['player blush', 'tami grin'], p: ['taza', 'taza'], fx: ['rain', 'steam'] },
  m8_corona: { b: 'patio', c: ['player grin', 'rubiela grin'], p: ['corona'], fx: 'confetti' },
  m8_richi_campeon: { b: 'patio', c: ['richi grin'], p: ['corona'], fx: 'confetti' },
  m8_tejo: { b: 'tejo', c: ['juanpa grin'], p: ['tejo', 'cerveza'] },
  m8_tejo_mecha: { b: 'tejo', c: ['player grin', 'efren grin'], t: '¡PUM!', tc: '#ffb070', fx: 'flash' },
  // La noche del domingo
  m8_calle_noche: { b: 'calle_noche', c: ['juanpa sad', 'danilo smile'], t: 'Domingo · todo cerrado' },
  m8_tienda_gladys: { b: 'tienda', c: ['gladys grin'], p: ['cerveza', 'guaro'], fx: 'notes' },
  m8_cerveza: { b: 'tienda', c: ['player smile'], p: ['cerveza'], fx: 'mist' },
  m8_ronda_guaro: { b: 'tienda', c: ['danilo grin', 'player teeth', 'renzo grin', 'tami grin'], p: ['guaro'], s: 2.4, t: '¡Salud!' },
  m8_gladys_baila: { b: 'tienda', c: ['gladys grin', 'player blush'], fx: 'notes' },
  m8_tami_calle: { b: 'tienda', c: ['tami grin'], p: ['cerveza'], fx: ['notes', 'heart1'] },
  m8_tami_baila: { b: 'calle_noche', c: ['player blush', 'tami grin'], fx: ['notes', 'hearts'] },
  m8_renzo_calle: { b: 'tienda', c: ['renzo grin'], fx: 'notes' },
  m8_danilo_calle: { b: 'tienda', c: ['danilo grin'], fx: 'notes' },
  m8_disco_reja: { b: 'calle_noche', t: 'Domingos: a las 10 (si hay gente)' },
  m8_bar_ventana: { b: 'calle_noche', p: ['bola', 'taco'] },
  m8_disco: { b: 'disco', c: ['tami grin', 'juanpa open', 'richi grin', 'renzo smile'], s: 2.4, fx: ['lights', 'notes'] },
  m8_disco_senor: { b: 'disco', c: ['bigote closed'], fx: ['lights', 'notes'] },
  m8_disco_dj: { b: 'disco', c: ['dj squint', 'juanpa o'], fx: 'lights', t: '«No.»' },
  m8_danilo_disco: { b: 'disco', c: ['danilo sad'], fx: 'lights' },
  m8_bar: { b: 'bar', c: ['cantinero smile'], p: ['cerveza', 'cerveza'], fx: 'notes' },
  m8_rocola: { b: 'bar', p: ['cerveza'], fx: 'notes', t: 'Despecho' },
  m8_danilo_pool: { b: 'bar', c: ['danilo grin'], p: ['bola', 'taco'] },
  m8_danilo_serio: { b: 'bar', c: ['danilo smile', 'player sad'] },
  m8_danilo_risa: { b: 'bar', c: ['danilo grin'], p: ['taco'], fx: 'sparkle' },
  m8_danilo_tiza: { b: 'bar', c: ['danilo squint'], p: ['taco'] },
  m8_tami_puerta: { b: 'bar', c: ['tami blush', 'player o'], fx: 'heart1' },
  m8_tami_mejilla: { b: 'calle_noche', c: ['tami smile'], fx: 'heart1' },
  // La plaza
  m8_mexicanos: { b: 'plaza', c: ['ximena grin', 'chuy grin', 'renata smile'], p: ['bandera_mx', 'tequila', 'limon'] },
  m8_chuy: { b: 'plaza', c: ['chuy grin'], p: ['bandera_mx'], t: '¡Órale!' },
  m8_ximena: { b: 'plaza', c: ['ximena grin', 'renata open'], t: '¡Qué padre!' },
  m8_laura: { b: 'plaza', c: ['laura smile'], fx: 'sparkle', t: '¡Kaixo!' },
  m8_laura_risa: { b: 'plaza', c: ['laura grin'], fx: 'sparkle' },
  m8_laura_banca: { b: 'plaza', c: ['player smile', 'laura smile'] },
  m8_laura_sirimiri: { b: 'calle_lluvia', c: ['laura closed'], fx: 'rain', t: 'sirimiri' },
  m8_laura_seria: { b: 'plaza', c: ['laura smile', 'player sad'], fx: 'stars' },
  m8_laura_shot: { b: 'plaza', c: ['laura grin'], p: ['tequila'], t: 'Esto es agüita' },
  m8_laura_palma: { b: 'plaza', c: ['player blush', 'laura smile'], fx: 'stars' },
  m8_laura_destino: { b: 'plaza', c: ['laura grin'], fx: 'heart1', t: 'Que lo decida Cali' },
  m8_laura_agur: { b: 'plaza', c: ['laura smile'], t: 'Agur', fx: 'stars' },
  m8_tequila_mesa: { b: 'plaza', c: ['chuy grin', 'laura squint'], p: ['sal', 'tequila', 'limon'] },
  m8_cuenta: { b: 'plaza', c: ['renata open', 'ximena open', 'chuy open', 'laura grin'], s: 2.4, p: ['bandera_mx'], fx: 'sparkle' },
  m8_grito_ventanas: { b: 'calle_noche', c: ['danilo open'], t: '¡Es cultura, señora!' },
  m8_cantan: { b: 'plaza', c: ['chuy open', 'player open', 'laura open', 'ximena open'], s: 2.4, fx: ['notes', 'confetti'] },
  m8_despedida_plaza: { b: 'plaza', c: ['chuy grin', 'ximena smile'], p: ['bandera_mx'], t: '¡Cachai, carnal!' },
  m8_bus_vuelta: { b: 'bus', c: ['richi sleep', 'player smile', 'juanpa smile', 'renzo grin'], p: ['aji', 'sombrero'], s: 2.4 },
  // El «¿y si...?»: se arma con whatIf más abajo
};

export const M8_VINETAS: Record<string, VinetaBuilder> = {
  ...Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, compose(spec)])),
  m8_fotogram_recuerdo: fotogramRecuerdo,
  m8_cel_sira: chatVineta('Sira', '#e8a0b8', ['buenos días, chileno ☔', '¿dormiste?']),
  m8_cel_sira_tinto: chatVineta('Sira', '#e8a0b8', ['buenos días, chileno ☔', '¿qué haces? 🌧️', '¿vamos por un tinto?']),
  m8_boton_11: botonOnce,
  m8_foto_krater: fotoKrater,
  m8_krater_carro: kraterCarro,
  m8_rueda_atardecer: ruedaScene(false),
  m8_rueda_casi: ruedaScene(true),
  m8_rueda_renzo: ruedaScene(true, true),
  m8_tequila_1: tequilaPaso(0),
  m8_tequila_2: tequilaPaso(1),
  m8_tequila_3: tequilaPaso(2),
  m8_tequila_ok: tequilaPaso(3, true),
  m8_tequila_tos: tequilaPaso(1, false),
  m8_grito: grito,
  m8_vista_cocora: vistaCocora,
  m8_vhs: vhs,
  m8_teleferico_ida: teleferico(1),
  m8_teleferico_vuelta: teleferico(-1),
  m8_whatif_calle: whatIf({ b: 'calle_noche', c: ['player smile', 'tami blush'], fx: 'stars' }),
  m8_whatif_escalera: whatIf({ b: 'calle_noche', c: ['player blush', 'tami blush'], fx: ['stars', 'heart1'] }),
  m8_whatif_beso: whatIf({ b: 'calle_noche', c: ['player closed', 'tami closed'], fx: ['hearts', 'stars'] }),
  m8_whatif_nada: whatIf({ b: 'calle_noche', c: ['player sad', 'tami smile'], fx: 'stars' }),
};
