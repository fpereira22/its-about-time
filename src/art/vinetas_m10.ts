import { playerLook } from '../systems/PlayerLook';
import type { Backdrop, VinetaBuilder } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, INK, lookOf } from './vinetas_m5';
import { sinGorro } from './vinetas_m7';
import { BACKDROPS, chatVineta, compose, label, phoneFrame, PROPS, type Prop, type Spec } from './vinetas_m8';

/**
 * Viñetas de la misión 10 («Río abajo»): el domingo en el río Pance con Danilo. Usa el compositor de la misión 8
 * (fondo + bustos + objetos + efecto) con fondos nuevos —el depa de mañana y de tarde, el sótano del Bobo, el carro
 * de Danilo por dentro, la Vía a Pance, el río con su playa llena, el chorro, el puente colgante, el kiosko de doña
 * Nelly y el atardecer— y escenas propias: los mensajes de Danilo, el citófono, el botón «S» del ascensor, el mapa
 * de los puentes, la historia de Fotogram, la respuesta de laaurii_14, los borradores y el corazoncito.
 * Panel de 220 × 108 px.
 */

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

function cieloDia(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#7cb8e8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y + h * 0.35, w, h * 0.65);
  g.fillStyle(0xffffff, 0.9).fillEllipse(x + 40, y + 14, 34, 8).fillEllipse(x + 160, y + 20, 40, 9);
}

/** Los Farallones de Cali al fondo, con nubes enganchadas. */
function farallones(g: G, x: number, base: number, w: number, color = '#5a7a8c'): void {
  g.fillStyle(hex(color), 1).fillTriangle(x - 20, base, x + 50, base - 34, x + 120, base).fillTriangle(x + 80, base, x + 160, base - 42, x + w + 20, base);
  g.fillStyle(0xffffff, 0.75).fillEllipse(x + 150, base - 36, 36, 7).fillEllipse(x + 52, base - 28, 26, 5);
}

function guaduas(g: G, x: number, y: number, w: number, h: number, n = 9): void {
  for (let i = 0; i < n; i++) {
    const gx = x + ((i * 47) % w);
    g.fillStyle(hex('#7cbc4c'), 1).fillRect(gx, y, 3, h);
    for (let k = 6; k < h; k += 9) g.fillStyle(hex('#5a9c3c'), 1).fillRect(gx, y + k, 3, 1);
    g.fillStyle(hex('#5aa04a'), 1).fillEllipse(gx + 1, y, 16, 6);
  }
}

/** El río Pance: agua verde-turquesa, piedras y espuma. */
function rioAgua(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#2a7c94'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#3c9cac'), 1).fillRect(x, y, w, Math.min(10, h));
  for (let i = 0; i < 26; i++) g.fillStyle(hex('#e8f8f4'), 0.75).fillRect(x + ((i * 37) % w), y + 3 + ((i * 13) % Math.max(4, h - 6)), 8, 1);
  for (const [px, r] of [[30, 7], [96, 9], [170, 6], [204, 8]] as const) {
    g.fillStyle(hex(INK), 1).fillCircle(x + px, y + h * 0.55, r + 1);
    g.fillStyle(hex('#9c968c'), 1).fillCircle(x + px, y + h * 0.55, r);
    g.fillStyle(hex('#c8c2b4'), 1).fillCircle(x + px - r / 3, y + h * 0.55 - r / 3, r / 2.5);
  }
}

const M10_BACKDROPS: Record<string, Backdrop> = {
  depa_dia: (g, x, y, w, h) => {
    g.fillStyle(hex('#e8dcc8'), 1).fillRect(x, y, w, h);
    // El ventanal con el sol de frente y los cerros.
    g.fillStyle(hex('#a8d4f0'), 1).fillRect(x + 100, y + 8, 110, 66);
    farallones(g, x + 100, y + 60, 110, '#6c8c9c');
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x + 100, y + 60, 110, 14);
    disc(g, x + 128, y + 24, 9, '#f8e070');
    g.fillStyle(0xf8e070, 0.18).fillRect(x + 40, y + 74, 120, h - 74);
    g.fillStyle(hex('#3a3c44'), 1).fillRect(x + 154, y + 8, 2, 66).fillRect(x + 100, y + 8, 110, 2);
    g.fillStyle(hex('#3a4a78'), 1).fillRect(x, y + 80, w, h - 80);
  },
  depa_tarde: (g, x, y, w, h) => {
    g.fillStyle(hex('#a8a0a0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7c8494'), 1).fillRect(x + 100, y + 8, 110, 66);
    for (let i = 0; i < 30; i++) g.fillStyle(hex('#c8d0dc'), 0.7).fillRect(x + 102 + ((i * 29) % 106), y + 10 + ((i * 17) % 60), 1, 4);
    g.fillStyle(hex('#3a3c44'), 1).fillRect(x + 154, y + 8, 2, 66).fillRect(x + 100, y + 8, 110, 2);
    g.fillStyle(hex('#4a4a68'), 1).fillRect(x, y + 80, w, h - 80);
  },
  sotano: (g, x, y, w, h) => {
    g.fillStyle(hex('#5c6068'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y, w, 40);
    g.fillStyle(hex('#a85838'), 1).fillRect(x, y + 10, w, 3);
    for (const lx of [30, 110, 190]) {
      g.fillStyle(hex('#f8f4e0'), 1).fillRect(x + lx, y + 2, 24, 3);
      g.fillStyle(0xf8f4e0, 0.12).fillTriangle(x + lx - 10, y + 40, x + lx + 12, y + 4, x + lx + 34, y + 40);
    }
    g.fillStyle(hex('#8c9098'), 1).fillRect(x + 60, y + 14, 12, h - 14);
    g.fillStyle(hex('#e8c030'), 1).fillRect(x + 60, y + 84, 12, 4).fillRect(x + 60, y + 92, 12, 4);
    g.fillStyle(hex('#e8c030'), 1).fillRect(x, y + 100, w, 2);
  },
  carro_dia: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2a30'), 1).fillRect(x, y, w, h);
    // El parabrisas: la Vía a Pance con guaduas y cerros.
    cieloDia(g, x + 10, y + 6, w - 20, 42);
    farallones(g, x + 10, y + 46, w - 20);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x + 10, y + 40, w - 20, 8);
    guaduas(g, x + 14, y + 22, w - 30, 26, 6);
    g.fillStyle(hex('#4a4a54'), 1).fillTriangle(x + 90, y + 48, x + 110, y + 38, x + 130, y + 48);
    // Tablero, el pino de olor y el rosario.
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x, y + 50, w, h - 50);
    g.fillStyle(hex('#4a4a5c'), 1).fillRect(x + 6, y + 56, w - 12, 18);
    g.fillStyle(hex('#3c9c58'), 1).fillTriangle(x + 104, y + 20, x + 110, y + 8, x + 116, y + 20);
    g.fillStyle(hex('#8c6a44'), 1).fillRect(x + 109, y + 2, 1, 6);
  },
  carro_tarde: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2a30'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#5a4c8c'), 1).fillRect(x + 10, y + 6, w - 20, 42);
    g.fillStyle(hex('#e8806a'), 1).fillRect(x + 10, y + 22, w - 20, 26);
    g.fillStyle(hex('#f8c070'), 1).fillRect(x + 10, y + 36, w - 20, 8);
    disc(g, x + 150, y + 40, 8, '#f8e070');
    farallones(g, x + 10, y + 46, w - 20, '#3a3c5c');
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x, y + 50, w, h - 50);
    g.fillStyle(hex('#4a4a5c'), 1).fillRect(x + 6, y + 56, w - 12, 18);
  },
  via_pance: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 60);
    farallones(g, x, y + 56, w);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x, y + 54, w, h - 54);
    guaduas(g, x + 4, y + 30, w - 10, 36, 10);
    // La vía y la cicloruta.
    g.fillStyle(hex('#4a4a54'), 1).fillRect(x, y + 78, w, 18);
    g.fillStyle(hex('#f8f4e0'), 1).fillRect(x + 10, y + 86, 16, 2).fillRect(x + 60, y + 86, 16, 2).fillRect(x + 110, y + 86, 16, 2).fillRect(x + 160, y + 86, 16, 2);
    g.fillStyle(hex('#c84848'), 1).fillRect(x, y + 96, w, 4);
  },
  parqueadero_rio: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 50);
    g.fillStyle(hex('#3c8040'), 1).fillRect(x, y + 30, w, 24);
    guaduas(g, x, y + 24, w, 30, 8);
    g.fillStyle(hex('#a07c54'), 1).fillRect(x, y + 54, w, h - 54);
    for (let i = 0; i < 30; i++) g.fillStyle(hex('#8c6a44'), 1).fillRect(x + ((i * 53) % w), y + 58 + ((i * 7) % 46), 2, 2);
    for (const [cx, c] of [[20, '#c8303c'], [190, '#e8e8e0']] as const) {
      g.fillStyle(hex(INK), 1).fillRect(x + cx - 16, y + 60, 36, 18);
      g.fillStyle(hex(c), 1).fillRect(x + cx - 15, y + 61, 34, 16);
    }
  },
  rio_pance: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 46);
    g.fillStyle(hex('#3c8040'), 1).fillRect(x, y + 26, w, 30);
    guaduas(g, x, y + 20, w, 34, 9);
    g.fillStyle(hex('#b8ae9c'), 1).fillRect(x, y + 54, w, 8);
    rioAgua(g, x, y + 60, w, h - 60);
  },
  rio_gente: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 40);
    g.fillStyle(hex('#3c8040'), 1).fillRect(x, y + 22, w, 22);
    // Toldos azules, una olla en leña y un parlante.
    for (const tx of [10, 80, 150]) {
      g.fillStyle(hex('#3c78c8'), 1).fillTriangle(x + tx, y + 40, x + tx + 30, y + 26, x + tx + 60, y + 40);
      g.fillStyle(hex('#2c5ca8'), 1).fillRect(x + tx + 4, y + 40, 2, 14).fillRect(x + tx + 54, y + 40, 2, 14);
    }
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x + 104, y + 46, 16, 10);
    g.fillStyle(hex('#e8742c'), 1).fillRect(x + 104, y + 56, 16, 3);
    for (let i = 0; i < 3; i++) g.fillStyle(0xd8d8e0, 0.7).fillCircle(x + 108 + i * 4, y + 40 - i * 5, 3);
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x + 30, y + 44, 10, 14);
    g.fillStyle(hex('#b8ae9c'), 1).fillRect(x, y + 56, w, 10);
    rioAgua(g, x, y + 64, w, h - 64);
  },
  chorro_bd: (g, x, y, w, h) => {
    g.fillStyle(hex('#2c6a34'), 1).fillRect(x, y, w, h);
    guaduas(g, x, y, w, 60, 8);
    g.fillStyle(hex('#6c665e'), 1).fillRect(x + 60, y + 6, 100, 22);
    g.fillStyle(hex('#9c968c'), 1).fillRect(x + 60, y + 6, 100, 16);
    g.fillStyle(hex('#e8f8f4'), 0.95).fillRect(x + 100, y + 22, 20, h - 22);
    for (let k = 26; k < h; k += 10) g.fillStyle(hex('#b8e4e4'), 1).fillRect(x + 104, y + k, 2, 5).fillRect(x + 114, y + k + 4, 2, 5);
    g.fillStyle(hex('#3c9cac'), 1).fillRect(x, y + 88, w, h - 88);
    g.fillStyle(hex('#e8f8f4'), 0.8).fillEllipse(x + 110, y + 90, 60, 8);
  },
  puente_col: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 44);
    farallones(g, x, y + 40, w, '#6c8c9c');
    g.fillStyle(hex('#3c8040'), 1).fillRect(x, y + 34, w, 24);
    guaduas(g, x, y + 28, w, 30, 9);
    rioAgua(g, x, y + 70, w, h - 70);
    // El puente colgante de lado: cables en curva y tablas.
    for (let i = 0; i <= 22; i++) {
      const px = x + i * 10;
      const sag = Math.sin((i / 22) * Math.PI) * 8;
      g.fillStyle(hex('#8c9098'), 1).fillRect(px, y + 48 + sag, 1, 14);
      g.fillStyle(hex('#b08a5c'), 1).fillRect(px, y + 62 + sag, 9, 3);
      g.fillStyle(hex('#c8ccd4'), 1).fillRect(px, y + 47 + sag, 10, 1);
    }
  },
  kiosko: (g, x, y, w, h) => {
    cieloDia(g, x, y, w, 40);
    g.fillStyle(hex('#3c8040'), 1).fillRect(x, y + 26, w, 30);
    guaduas(g, x + 150, y + 20, 70, 40, 4);
    // El techo de paja, el fogón de leña con la olla y la mesa de tablones.
    g.fillStyle(hex('#c8a050'), 1).fillTriangle(x - 10, y + 30, x + 80, y + 2, x + 170, y + 30);
    for (let i = 0; i < 16; i++) g.fillStyle(hex('#a07c3c'), 1).fillRect(x + i * 10, y + 22 + (i % 2), 1, 8);
    g.fillStyle(hex('#7a5432'), 1).fillRect(x + 6, y + 30, 4, 50).fillRect(x + 150, y + 30, 4, 50);
    g.fillStyle(hex('#8c5a3c'), 1).fillRect(x + 20, y + 58, 40, 20);
    g.fillStyle(hex('#e8742c'), 1).fillRect(x + 28, y + 70, 24, 5);
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x + 26, y + 46, 28, 14);
    for (let i = 0; i < 3; i++) g.fillStyle(0xd8d8e0, 0.6).fillCircle(x + 34 + i * 6, y + 40 - i * 5, 3);
    g.fillStyle(hex('#a07448'), 1).fillRect(x, y + 84, w, h - 84);
  },
  atardecer_rio: (g, x, y, w, h) => {
    g.fillStyle(hex('#5a4c8c'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#e8806a'), 1).fillRect(x, y + 20, w, 30);
    g.fillStyle(hex('#f8c070'), 1).fillRect(x, y + 40, w, 12);
    farallones(g, x, y + 52, w, '#3a3c5c');
    g.fillStyle(hex('#2c4a34'), 1).fillRect(x, y + 50, w, 20);
    rioAgua(g, x, y + 70, w, h - 70);
    g.fillStyle(0xf8c070, 0.25).fillRect(x, y + 70, w, h - 70);
  },
};
Object.assign(BACKDROPS, M10_BACKDROPS);

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

const M10_PROPS: Record<string, Prop> = {
  toalla: (g, cx, cy) => {
    outlined(g, [[cx - 16, cy - 10, 32, 20, '#e8742c']]);
    flat(g, [[cx - 16, cy - 4, 32, 4, '#f4f0e6'], [cx - 16, cy + 3, 32, 4, '#2f6fd0']]);
  },
  bloqueador: (g, cx, cy) => {
    outlined(g, [[cx - 4, cy - 16, 8, 5, '#f4f0e6'], [cx - 8, cy - 11, 16, 24, '#f8c838']]);
    flat(g, [[cx - 6, cy - 5, 12, 8, '#f4f0e6'], [cx - 2, cy - 3, 4, 4, '#e8742c']]);
  },
  pantaloneta: (g, cx, cy) => {
    outlined(g, [[cx - 12, cy - 10, 24, 8, '#2f6fd0'], [cx - 12, cy - 2, 10, 12, '#2f6fd0'], [cx + 2, cy - 2, 10, 12, '#2f6fd0']]);
    flat(g, [[cx - 12, cy - 10, 24, 2, '#f4f0e6']]);
  },
  neumatico: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 40, 18);
    g.fillStyle(hex('#3a3a44'), 1).fillEllipse(cx, cy, 38, 16);
    g.fillStyle(hex('#2a7c94'), 1).fillEllipse(cx, cy, 16, 6);
    g.fillStyle(hex('#c8303c'), 1).fillRect(cx + 10, cy - 6, 5, 3);
  },
  sancocho: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 40, 16);
    g.fillStyle(hex('#d8d8e0'), 1).fillEllipse(cx, cy, 38, 14);
    g.fillStyle(hex('#e8c030'), 1).fillEllipse(cx, cy - 1, 32, 10);
    g.fillStyle(hex('#f8e070'), 1).fillRect(cx - 12, cy - 4, 10, 4);
    g.fillStyle(hex('#3c8c3c'), 1).fillRect(cx + 4, cy - 3, 2, 1).fillRect(cx - 2, cy, 2, 1).fillRect(cx + 8, cy + 1, 2, 1);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(cx + 2, cy - 5, 6, 3);
    for (let i = 0; i < 3; i++) g.fillStyle(0xd8d8e0, 0.6).fillCircle(cx - 6 + i * 6, cy - 12 - i * 3, 2);
  },
  fiambre: (g, cx, cy) => {
    outlined(g, [[cx - 16, cy - 8, 32, 16, '#3c8c3c']]);
    flat(g, [[cx - 16, cy - 1, 32, 1, '#2c6a2c'], [cx - 8, cy - 6, 14, 6, '#f8f4ec'], [cx + 2, cy - 5, 6, 4, '#e8c030'], [cx - 6, cy + 1, 10, 4, '#c8884c']]);
  },
  lulada: (g, cx, cy) => {
    outlined(g, [[cx - 7, cy - 12, 14, 22, '#f4f8f4']]);
    flat(g, [[cx - 6, cy - 7, 12, 16, '#e8c030'], [cx - 6, cy - 7, 12, 2, '#f8e070'], [cx + 3, cy - 18, 2, 10, '#e85a64']]);
    g.fillStyle(hex('#3c8c3c'), 1).fillRect(cx - 3, cy - 2, 2, 2).fillRect(cx + 2, cy + 3, 2, 2);
  },
  piedra_lisa: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 28, 16);
    g.fillStyle(hex('#8c968c'), 1).fillEllipse(cx, cy, 26, 14);
    g.fillStyle(hex('#b8c4b8'), 1).fillEllipse(cx - 4, cy - 2, 12, 5);
  },
  pluma: (g, cx, cy) => {
    for (let i = 0; i < 12; i++) g.fillStyle(hex(i < 8 ? '#2c9cc8' : '#58d4d0'), 1).fillRect(cx - 14 + i * 2, cy + 10 - i * 2, 3, 3);
    g.fillStyle(hex('#1c1c24'), 1).fillRect(cx + 8, cy - 16, 5, 5);
    g.fillStyle(hex('#5a3a20'), 1).fillRect(cx - 16, cy + 11, 3, 3);
  },
  mango: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 24, 14);
    g.fillStyle(hex('#8cc468'), 1).fillEllipse(cx, cy, 22, 12);
    g.fillStyle(hex('#f8f4ec'), 1).fillRect(cx - 4, cy - 3, 2, 1).fillRect(cx + 3, cy, 2, 1);
  },
  llaves: (g, cx, cy) => {
    g.lineStyle(2, hex('#c8ccd4'), 1).strokeCircle(cx - 6, cy - 4, 5);
    outlined(g, [[cx - 2, cy - 2, 16, 3, '#c8ccd4'], [cx - 14, cy + 2, 8, 10, '#1c1c24']]);
  },
  gafas: (g, cx, cy) => {
    outlined(g, [[cx - 14, cy - 4, 12, 8, '#1c1c24'], [cx + 2, cy - 4, 12, 8, '#1c1c24'], [cx - 2, cy - 3, 4, 2, '#1c1c24']]);
    flat(g, [[cx - 12, cy - 3, 4, 2, '#5a6a84'], [cx + 4, cy - 3, 4, 2, '#5a6a84']]);
  },
};
Object.assign(PROPS, M10_PROPS);

// ---------------------------------------------------------------------------
// Escenas propias
// ---------------------------------------------------------------------------

const VERDE_WA = '#3c9c58';

/** El citófono del depa sonando, con su lucecita. */
const citofono: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.depa_dia);
  const g = addG(kit, stage);
  outlined(g, [[30, 18, 40, 70, '#e8e4dc']]);
  flat(g, [[36, 24, 28, 16, '#3a3a44'], [40, 46, 20, 30, '#c8c4bc'], [44, 80, 12, 4, '#a8a49c']]);
  const led = addG(kit, stage);
  kit.every(300, () => {
    led.clear().fillStyle(hex(Math.random() < 0.5 ? '#58f0a0' : '#2a8a5a'), 1).fillRect(46, 28, 8, 8);
  });
  kit.every(700, () => popText(kit, stage, 50 + Math.random() * 20, 10, '¡riiing!', '#f8e070', 8, 600));
  bust(addG(kit, stage), sinGorro(playerLook()), 150, 62, 3, { mouth: 'o' });
};

/** La botonera del ascensor del Bobo: abajo del 1, la «S» del sótano. */
const botonS: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a0a8b8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#68707e'), 1).fillRect(x, y + 100, w, h - 100);
  });
  const g = addG(kit, stage);
  outlined(g, [[80, 6, 60, 96, '#c8ccd4']]);
  flat(g, [[84, 10, 52, 88, '#d8dce4']]);
  for (let n = 1; n <= 12; n++) {
    const bx = n % 2 ? 98 : 122;
    const by = 72 - Math.floor((n - 1) / 2) * 11;
    outlined(g, [[bx - 4, by - 4, 8, 8, n === 8 ? '#f8e070' : '#eceef2']]);
    label(kit, stage, bx, by - 3, String(n), INK, 5, 10);
  }
  const s = addG(kit, stage);
  kit.every(500, () => {
    const on = Math.floor(Date.now() / 500) % 2 === 0;
    s.clear();
    outlined(s, [[104, 82, 12, 12, on ? '#e8c030' : '#eceef2']]);
  });
  label(kit, stage, 110, 84, 'S', INK, 7, 12);
};

/** El mapa de los puentes del Pance, dibujado por Danilo en el aire. */
const puentesMapa: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#e8e0cc'), 1).fillRect(x, y + h - 10, w, 10);
  });
  const g = addG(kit, stage);
  // El río (de izquierda a derecha, bajando de los Farallones) y la vía arriba.
  for (let i = 0; i < 44; i++) {
    const px = 8 + i * 4.8;
    const py = 66 + Math.sin(i / 5) * 9;
    g.fillStyle(hex('#3c9cac'), 1).fillRect(px, py, 6, 7);
  }
  for (let i = 0; i < 44; i++) g.fillStyle(hex('#4a4a54'), 1).fillRect(8 + i * 4.8, 30 + Math.sin(i / 7) * 5, 5, 3);
  const bridges: Array<[number, string, string]> = [
    [24, '1', 'La Vorágine'],
    [76, '2', ''],
    [130, '3', 'todo Cali'],
    [184, '4', '¡acá!'],
  ];
  bridges.forEach(([bx, n, txt], i) => {
    kit.after(300 + i * 400, () => {
      const b = addG(kit, stage);
      const py = 66 + Math.sin((bx - 8) / 4.8 / 5) * 9;
      outlined(b, [[bx - 2, py - 6, 5, 20, i === 3 ? '#e8c030' : '#b08a5c']]);
      popText(kit, stage, bx, py - 18, n, i === 3 ? '#c8303c' : INK, 9, 0);
      if (txt) label(kit, stage, bx, py + 16, txt, i === 3 ? '#c8303c' : '#5a5a68', 5, 50);
      if (i === 3) sparkle(kit, stage, bx + 6, py - 10);
    });
  });
  label(kit, stage, 110, 4, 'Río Pance', INK, 7, 100);
};

/** La galería del celular: cuatro fotos del puente. */
const galeria: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#2a2a34']]);
  label(kit, stage, 110, 12, 'Galería · Hoy', '#ffffff', 6, 70);
  const tiles: Array<[string, string]> = [
    ['#2a7c94', '#e8f8f4'],
    ['#7cb8e8', '#5a7a8c'],
    ['#3c8040', '#2c9cc8'],
    ['#7cb8e8', '#b08a5c'],
  ];
  tiles.forEach(([a, b], i) => {
    kit.after(200 + i * 250, () => {
      const t = addG(kit, stage);
      const tx = 78 + (i % 2) * 33;
      const ty = 26 + Math.floor(i / 2) * 36;
      flat(t, [[tx, ty, 31, 34, a], [tx + 4, ty + 18, 23, 6, b]]);
      if (i === 3) bust(t, lookOf('danilo_bano'), tx + 15, ty + 12, 0.9, { mouth: 'open', eyes: 'squint' });
    });
  });
};

/** Fotogram: crear la historia (el circulito con el +). */
const fotogramHistoria: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#e868a8']]);
  label(kit, stage, 110, 12, 'Fotogram', '#ffffff', 7, 70);
  const av = addG(kit, stage);
  for (let i = 0; i < 4; i++) {
    disc(av, 86 + i * 17, 34, 7, i === 0 ? '#e868a8' : '#c8c8d0');
    disc(av, 86 + i * 17, 34, 6, ['#f4f0e6', '#5a90e8', '#2c9c58', '#e8607a'][i]);
  }
  bust(av, sinGorro(playerLook()), 86, 34, 0.6, { mouth: 'smile' });
  flat(av, [[90, 37, 5, 5, '#2f6fd0']]);
  label(kit, stage, 86, 43, 'Tu historia', INK, 4, 30);
  flat(g, [[78, 52, 64, 40, '#2a7c94'], [92, 52, 36, 40, '#3c9cac']]);
  kit.every(900, () => sparkle(kit, stage, 90 + Math.random() * 40, 60));
};

/** La historia subida: el río, el sticker y el texto. */
function historia(vistas: number, laura: boolean): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = phoneFrame(kit, stage);
    flat(g, [[74, 10, 72, 88, '#2a7c94'], [90, 10, 40, 88, '#3c9cac'], [74, 10, 72, 2, '#ffffff']]);
    for (let i = 0; i < 10; i++) g.fillStyle(0xe8f8f4, 0.9).fillRect(92 + ((i * 13) % 34), 16 + ((i * 17) % 70), 6, 1);
    outlined(g, [[80, 20, 40, 9, '#fbf6ee']]);
    label(kit, stage, 100, 21, 'Río Pance', '#e8742c', 5, 40);
    label(kit, stage, 110, 62, 'domingo de río', '#ffffff', 7, 70);
    if (vistas > 0) {
      const v = addG(kit, stage);
      flat(v, [[74, 84, 72, 14, '#0c1020']]);
      const t = label(kit, stage, 110, 87, 'Visto por 0', '#ffffff', 6, 70);
      let n = 0;
      kit.every(120, () => {
        if (n < vistas) n++;
        t.setText(`Visto por ${n}`);
      });
    }
    if (laura) {
      kit.after(700, () => {
        const b = addG(kit, stage);
        outlined(b, [[150, 40, 64, 30, '#ffffff']]);
        disc(b, 162, 55, 8, '#c8303c');
        bust(b, lookOf('laura'), 162, 54, 0.9, { mouth: 'smile' });
        label(kit, stage, 190, 48, 'laaurii_14', INK, 6, 40);
        label(kit, stage, 190, 58, 'vio tu historia', '#5a5a68', 5, 40);
        sparkle(kit, stage, 208, 40);
      });
    }
  };
}

/** El DM de laaurii_14: «Tío, qué máquina...». */
function lauraDm(withReply: 'nada' | 'escribiendo' | 'enviado' | 'puntitos' | 'like' | 'borrador'): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.telefono);
    const g = phoneFrame(kit, stage);
    flat(g, [[74, 10, 72, 14, '#f4f0e6'], [74, 23, 72, 1, '#d8d8e0']]);
    const av = addG(kit, stage);
    disc(av, 82, 17, 5, '#c8303c');
    bust(av, lookOf('laura'), 82, 16, 0.55, { mouth: 'smile' });
    label(kit, stage, 108, 13, 'laaurii_14', INK, 6, 40);
    // La historia respondida (chiquita) y su mensaje.
    flat(g, [[124, 27, 16, 20, '#3c9cac']]);
    label(kit, stage, 101, 29, 'Respondió a tu historia', '#8c8c98', 4, 44);
    const m = addG(kit, stage);
    outlined(m, [[77, 40, 50, 22, '#e8e8f0']]);
    label(kit, stage, 102, 41, 'Tío, qué máquina. ¿No dormiste después de la fiesta y ahora en el río?', INK, 4, 48);
    if (withReply === 'escribiendo' || withReply === 'borrador') {
      const r = addG(kit, stage);
      outlined(r, [[78, 84, 64, 10, '#ffffff']]);
      const t = label(kit, stage, 110, 86, '', INK, 5, 60);
      const full = withReply === 'borrador' ? 'Dormir es para los débiles' : 'Así somos los...';
      let i = 0;
      kit.every(90, () => {
        if (withReply === 'borrador' && i > full.length + 10) {
          i = 0;
          popText(kit, stage, 132, 74, 'borrar', '#e85a64', 6, 500);
        }
        i++;
        t.setText(full.slice(0, Math.min(full.length, i)) + (i % 6 < 3 ? '|' : ''));
      });
    }
    if (withReply === 'enviado' || withReply === 'puntitos' || withReply === 'like') {
      const r = addG(kit, stage);
      outlined(r, [[93, 66, 50, 14, '#2f6fd0']]);
      label(kit, stage, 118, 67, 'Así somos los hombres buenos 😏', '#ffffff', 4, 48);
    }
    if (withReply === 'puntitos') {
      const p = addG(kit, stage);
      let k = 0;
      kit.every(250, () => {
        k++;
        p.clear();
        outlined(p, [[78, 84, 22, 9, '#e8e8f0']]);
        for (let i = 0; i < 3; i++) disc(p, 84 + i * 5, 88 - (k % 3 === i ? 1 : 0), 1.5, '#8c8c98');
      });
    }
    if (withReply === 'like') {
      kit.after(500, () => {
        const h = addG(kit, stage);
        outlined(h, [[134, 74, 12, 10, '#ffffff']]);
        disc(h, 138, 78, 2.5, '#e84868');
        disc(h, 142, 78, 2.5, '#e84868');
        h.fillStyle(hex('#e84868'), 1).fillTriangle(135, 79, 145, 79, 140, 84);
        floatHeart(kit, stage, 140, 72);
        sparkle(kit, stage, 146, 70);
      });
      kit.every(1000, () => floatHeart(kit, stage, 120 + Math.random() * 30, 70));
    }
  };
}

/** El celular boca abajo sobre la mesa de tablones, vibrando. */
const celBocaAbajo: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.kiosko);
  const g = addG(kit, stage, 0, 0);
  outlined(g, [[90, 82, 40, 16, '#1c1c24']]);
  flat(g, [[94, 85, 8, 8, '#3a3a44']]);
  kit.every(900, () => {
    popText(kit, stage, 80, 76, 'bzz', '#f8e070', 6, 400);
    popText(kit, stage, 140, 76, 'bzz', '#f8e070', 6, 400);
  });
  PROPS.sancocho(addG(kit, stage), 50, 90);
};

/** Dormido por fin, con la lluvia en el ventanal. */
const dormido: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.depa_tarde);
  const g = addG(kit, stage);
  outlined(g, [[30, 70, 160, 30, '#e8e4dc']]);
  flat(g, [[30, 70, 40, 14, '#f4f0e6']]);
  bust(g, sinGorro(playerLook()), 56, 66, 2.4, { eyes: 'closed', mouth: 'smile' });
  outlined(g, [[70, 76, 120, 18, '#2f6fd0']]);
  kit.every(900, () => floatZ(kit, stage, 70 + Math.random() * 20, 44));
  kit.every(140, () => {
    const d = addG(kit, stage);
    const x = 102 + Math.random() * 106;
    kit.progress(500, (k) => d.clear().fillStyle(0xc8d0dc, 0.8).fillRect(x, 10 + k * 60, 1, 4), () => d.destroy());
  });
};

// ---------------------------------------------------------------------------
// Viñetas por especificación
// ---------------------------------------------------------------------------

const SPECS: Record<string, Spec> = {
  m10_depa_manana: { b: 'depa_dia', c: ['player squint'], fx: 'sparkle' },
  m10_sofa_ojeras: { b: 'depa_dia', c: ['player sleep'], p: ['cel'], t: '0 horas de sueño' },
  m10_cel_sonrisa: { b: 'depa_dia', c: ['player blush'], p: ['cel'], fx: 'heart1' },
  m10_closet: { b: 'depa_dia', c: ['player smile'], p: ['pantaloneta'] },
  m10_pantaloneta: { b: 'depa_dia', c: ['player grin'], p: ['pantaloneta', 'gafas'], fx: 'sparkle' },
  m10_toalla: { b: 'depa_dia', c: ['player smile'], p: ['toalla'] },
  m10_bloqueador: { b: 'depa_dia', c: ['player smile'], p: ['bloqueador'], t: 'Factor 50' },
  m10_espejo: { b: 'depa_dia', c: ['player squint'], p: ['toalla', 'bloqueador'], fx: 'sweat' },
  m10_sotano: { b: 'sotano', fx: 'mist' },
  m10_sotano_danilo: { b: 'sotano', c: ['danilo smile'], p: ['llaves'] },
  m10_danilo_gafas: { b: 'sotano', c: ['danilo grin'], p: ['gafas'], t: '¡Ah ve!' },
  m10_danilo_risa_sotano: { b: 'sotano', c: ['player squint', 'danilo grin'], fx: 'sparkle' },
  m10_carro_adentro: { b: 'carro_dia', c: ['player smile', 'danilo smile'] },
  m10_carro_sale: { b: 'carro_dia', c: ['player squint', 'danilo grin'], p: ['gafas'], fx: 'sparkle' },
  m10_carro_radio: { b: 'carro_dia', c: ['player smile', 'danilo grin'], fx: 'notes' },
  m10_carro_salsa: { b: 'carro_dia', c: ['player open', 'danilo open'], fx: ['notes', 'confetti'], t: '¡Súbele!' },
  m10_carro_charla: { b: 'carro_dia', c: ['player blush', 'danilo squint'] },
  m10_danilo_shock: { b: 'carro_dia', c: ['danilo o'], fx: 'flash', t: '¿¡QUÉ!?' },
  m10_danilo_risa: { b: 'rio_pance', c: ['danilo grin'], fx: 'sparkle' },
  m10_danilo_cejas: { b: 'rio_pance', c: ['danilo squint'], t: 'Vojabés' },
  m10_via_pance: { b: 'via_pance', fx: 'sparkle' },
  m10_danilo_nostalgia: { b: 'via_pance', c: ['danilo smile'], p: ['neumatico'] },
  m10_via_llena: { b: 'via_pance', c: ['vendedor_mango grin'], p: ['mango', 'neumatico'] },
  m10_cuidador: { b: 'parqueadero_rio', c: ['cuidador grin'], t: '¡Dele, dele, dele!' },
  m10_carro_atardecer: { b: 'carro_tarde', c: ['player smile', 'danilo smile'], fx: 'notes' },
  m10_danilo_serio: { b: 'atardecer_rio', c: ['danilo smile'] },
  m10_carro_dormido: { b: 'carro_tarde', c: ['player sleep', 'danilo smile'] },
  m10_abrazo_danilo: { b: 'sotano', c: ['player grin', 'danilo grin'], fx: 'heart1' },
  m10_pance_llegada: { b: 'parqueadero_rio', c: ['player smile', 'danilo grin'], fx: 'sparkle' },
  m10_danilo_brazos: { b: 'rio_pance', c: ['danilo_bano grin'], fx: 'sparkle' },
  m10_playa_llena: { b: 'rio_gente', fx: 'notes' },
  m10_senora_olla: { b: 'rio_gente', c: ['senora grin'], p: ['sancocho'], t: '¡Coma, mijo!' },
  m10_danilo_bano: { b: 'rio_gente', c: ['danilo_bano grin'], t: 'Piñas' },
  m10_chorro_lejos: { b: 'chorro_bd', c: ['danilo_bano squint'], fx: 'mist' },
  m10_chorro: { b: 'chorro_bd', c: ['player o'], fx: 'mist' },
  m10_chorro_despierto: { b: 'chorro_bd', c: ['player teeth'], fx: ['mist', 'sparkle'], t: '¡DESPIERTO!' },
  m10_neumaticos: { b: 'rio_pance', c: ['mono grin'], p: ['neumatico'] },
  m10_mono: { b: 'rio_pance', c: ['mono grin'], p: ['neumatico'], t: '¡Neumáticos!' },
  m10_neumatico_rio: { b: 'rio_pance', c: ['player grin'], p: ['neumatico'], fx: 'sparkle' },
  m10_danilo_neumatico: { b: 'rio_pance', c: ['danilo_bano open'], p: ['neumatico'], fx: 'notes' },
  m10_neumatico_llegada: { b: 'puente_col', c: ['player grin', 'danilo_bano grin'], p: ['neumatico'] },
  m10_puente_lejos: { b: 'puente_col', fx: 'sparkle', t: 'Puente 4' },
  m10_puente_tablas: { b: 'puente_col', c: ['player o'], fx: 'sweat' },
  m10_puente_vista: { b: 'puente_col', c: ['player smile', 'danilo_bano smile'], fx: 'sparkle' },
  m10_barranquero: { b: 'puente_col', c: ['danilo_bano open'], p: ['pluma'], t: '¡Barranquero!' },
  m10_barranquero_vuela: { b: 'rio_pance', p: ['pluma'], fx: 'sparkle' },
  m10_pluma: { b: 'puente_col', p: ['pluma'], fx: 'sparkle' },
  m10_piedra_lisa: { b: 'rio_pance', p: ['piedra_lisa'], fx: 'sparkle' },
  m10_piedra_sentados: { b: 'rio_pance', c: ['player smile', 'danilo_bano smile'] },
  m10_danilo_pelado: { b: 'rio_pance', c: ['nino_piscina grin'], p: ['neumatico'], t: 'Danilo, 12 años' },
  m10_nelly: { b: 'kiosko', c: ['nelly smile'] },
  m10_nelly_danilo: { b: 'kiosko', c: ['nelly grin', 'danilo_bano grin'], fx: 'heart1', t: '¡Danilito!' },
  m10_nelly_menu: { b: 'kiosko', c: ['nelly smile'], p: ['sancocho', 'fiambre'] },
  m10_nelly_risa: { b: 'kiosko', c: ['nelly grin'], fx: 'hearts' },
  m10_sancocho: { b: 'kiosko', p: ['sancocho'], fx: 'steam' },
  m10_fiambre: { b: 'kiosko', p: ['fiambre'], fx: 'steam' },
  m10_lulada: { b: 'kiosko', p: ['lulada'], fx: 'sparkle' },
  m10_mesa_kiosko: { b: 'kiosko', c: ['player smile', 'danilo_bano smile'], p: ['sancocho', 'lulada'] },
  m10_comiendo: { b: 'kiosko', c: ['player teeth', 'danilo_bano grin'], p: ['sancocho'], fx: 'steam' },
  m10_danilo_lleno: { b: 'kiosko', c: ['danilo_bano sleep'], fx: 'zzz' },
  m10_sonrisa_cel: { b: 'kiosko', c: ['player blush'], p: ['cel'], fx: 'heart1' },
  m10_danilo_sabe: { b: 'kiosko', c: ['danilo_bano squint', 'player blush'], fx: 'heart1' },
  m10_sendero_subida: { b: 'atardecer_rio', c: ['player smile', 'danilo smile'], p: ['neumatico', 'toalla'] },
  m10_cama_final: { b: 'depa_tarde', c: ['player sleep'], p: ['cel'], fx: 'rain' },
  m10_depa_tarde: { b: 'depa_tarde', fx: 'rain' },
  m10_mango: { b: 'rio_gente', c: ['vendedor_mango grin'], p: ['mango'], t: '¡Mango biche!' },
  m10_parlante: { b: 'rio_gente', c: ['abuelo_domino grin'], fx: 'notes', t: '¡Salsa de la de antes!' },
  m10_nino: { b: 'rio_pance', c: ['nino_piscina open'], fx: 'sweat' },
};

export const M10_VINETAS: Record<string, VinetaBuilder> = {
  ...Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, compose(spec)])),
  m10_wa_danilo_1: chatVineta('Danilo', VERDE_WA, ['Ah ve, chileno. ¿Vivo?', 'Voy pa\' Pance, al río 🌊', 'Solo vos y yo. Paso en 20.']),
  m10_wa_danilo_ok: chatVineta('Danilo', VERDE_WA, ['Paso en 20', 'Pantaloneta, toalla y bloqueador', '🌊🌊🌊']),
  m10_wa_danilo_2: chatVineta('Danilo', VERDE_WA, ['Sótano.', 'Puesto de visitantes.', 'Bajá ya 🚗']),
  m10_wa_danilo_3: chatVineta('Danilo', VERDE_WA, ['Llegué.', 'Gracias por el domingo, parce.', 'Dormí. Orden psicológica 😂']),
  m10_citofono: citofono,
  m10_boton_s: botonS,
  m10_puentes_mapa: puentesMapa,
  m10_galeria: galeria,
  m10_fotogram_historia: fotogramHistoria,
  m10_historia_subida: historia(0, false),
  m10_historia_vistas: historia(14, false),
  m10_historia_laura: historia(23, true),
  m10_laura_dm: lauraDm('nada'),
  m10_laura_responder: lauraDm('escribiendo'),
  m10_borrador: lauraDm('borrador'),
  m10_respuesta_enviada: lauraDm('enviado'),
  m10_puntitos: lauraDm('puntitos'),
  m10_laura_like: lauraDm('like'),
  m10_cel_boca_abajo: celBocaAbajo,
  m10_dormido: dormido,
};
