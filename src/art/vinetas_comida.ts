import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { makeText } from '../ui/theme';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, drawShakeLines, flat, floatHeart, INK, lerp, outlined, popText, sparkle, type G, type Layer, type Part } from './vinetas_kit';

/**
 * Viñetas de la comida callejera de Providencia (misión 1):
 *  - compra_sopaipilla   la paila burbujeando, la sopaipilla sale dorada con la espumadera y le ponen pebre
 *  - compra_completo     se arma el italiano capa por capa: pan, vienesa, tomate, palta y la mayo que se chorrea
 *  - compra_empanada     la empanada de pino sale del horno de barro en la pala, humeante
 *  - compra_mote         el vaso se llena de jugo, caen el mote, los dos huesillos y la cuchara
 *  - comer_<comida>      primer plano: la comida en tu mano pierde mordiscos uno a uno (¡ñam!)
 *  - comer_<comida>_quiltro  el quiltro se asoma con cara de traición y se lleva el último pedacito
 * Los vendedores salen de frente detrás del carrito y mueven la boca mientras hablan.
 * Los mordiscos se recortan fila por fila: cada pieza se dibuja solo hasta el borde de la mordida.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const FLAG_QUILTRO = 'quiltro_sigue';

// Masa frita, pan, rellenos.
const DOUGH = '#e8a840';
const DOUGH_D = '#c47a28';
const DOUGH_IN = '#f8e0a8';
const OIL = '#d8a030';
const OIL_L = '#f0c860';
const PEBRE = ['#d84030', '#3c9a3c', '#f4f0e0'];
const BUN = '#e8b878';
const BUN_D = '#c88a48';
const BUN_IN = '#f8e8c8';
const VIENESA = '#c0503a';
const VIENESA_IN = '#e88a6a';
const TOMATE = '#e04838';
const TOMATE_L = '#f07060';
const PALTA = '#9ccc50';
const PALTA_D = '#78a838';
const MAYO = '#fbf6e2';
const MAYO_D = '#e8e0c0';
const MASA = '#d89a48';
const MASA_D = '#b07030';
const MASA_L = '#f0c070';
const PINO = '#7a4024';
const JUGO = '#d08a3a';
const JUGO_L = '#e8b060';
const MOTE = '#f0e0a0';
const MOTE_D = '#d8c078';
const HUESILLO = '#c86a28';
const HUESILLO_L = '#e89040';
const VIDRIO = '#e4f2f8';
const METAL = '#b8c0cc';
const METAL_D = '#7a828e';
const WOOD = '#8a6038';
const PLATE = '#f4f2ea';
// El quiltro (los mismos colores que en vinetas_calle.ts).
const S = 2;
const FUR = '#c89458';
const FUR_D = '#9a6a38';
const SPOT = '#f0e0c0';
const PATCH = '#7a4c28';

// ---------------------------------------------------------------------------
// Formas recortables: piezas con contorno que se dibujan solo hasta el borde de la mordida
// ---------------------------------------------------------------------------

/** Pieza con un color "de adentro" opcional: lo que se ve en el borde mordido (miga, pino). */
type FPart = [x: number, y: number, w: number, h: number, color: string, inside?: string];
interface Shape {
  /** Con contorno (primero todos los contornos, después los rellenos). */
  parts: FPart[];
  /** Detalles sin contorno, encima. */
  details: FPart[];
}
/** Borde derecho de lo que queda en cada fila (exclusivo). */
type Edge = (y: number) => number;
const WHOLE: Edge = () => Infinity;

/** Filas de una elipse (cada una es una pieza de 1 px de alto). */
function ellipseRows(cx: number, cy: number, rx: number, ry: number, color: string, inside?: string): FPart[] {
  const rows: FPart[] = [];
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
    rows.push([cx - half, cy + dy, half * 2 + 1, 1, color, inside]);
  }
  return rows;
}

/** Rellena una pieza recortada al borde; si quedó mordida, pinta su color de adentro junto al borde. */
function fillClipped(g: G, [x, y, w, h, c, inside]: FPart, edge: Edge): void {
  for (let yy = y; yy < y + h; yy++) {
    const e = edge(yy);
    const x1 = Math.min(x + w, e);
    if (x1 <= x) continue;
    g.fillStyle(hex(c), 1).fillRect(x, yy, x1 - x, 1);
    if (inside && e < x + w) {
      const s = Math.max(x, x1 - 3);
      g.fillStyle(hex(inside), 1).fillRect(s, yy, x1 - s, 1);
    }
  }
}

/** Dibuja una forma recortada: el contorno sigue también la marca de los dientes. */
function drawShape(g: G, s: Shape, edge: Edge = WHOLE): void {
  g.fillStyle(hex(INK), 1);
  for (const [x, y, w, h] of s.parts) {
    for (let yy = y - 1; yy <= y + h; yy++) {
      const x1 = Math.min(x + w + 1, edge(yy) + 1);
      if (x1 > x - 1) g.fillRect(x - 1, yy, x1 - x + 1, 1);
    }
  }
  for (const p of s.parts) fillClipped(g, p, edge);
  for (const p of s.details) fillClipped(g, [p[0], p[1], p[2], p[3], p[4]], edge);
}

/**
 * Borde de una mordida que llega hasta `cut` (lo más hondo, a la altura `cy`): un arco de radio `r`
 * con dientecitos. Infinity = entera; -Infinity = no queda nada.
 */
function biteEdge(cut: number, cy: number, r: number): Edge {
  if (cut === Infinity) return WHOLE;
  if (cut === -Infinity) return () => -Infinity;
  return (y) => {
    const dy = y - cy;
    if (Math.abs(dy) >= r) return cut + r;
    const teeth = Math.floor((dy + r) / 3) % 2;
    return Math.round(cut + r - Math.sqrt(r * r - dy * dy)) + teeth;
  };
}

// ---------------------------------------------------------------------------
// La comida. Origen = centro (la sopaipilla y la empanada vistas un poco desde arriba; el completo de lado).
// ---------------------------------------------------------------------------

/** Tonos de la sopaipilla friéndose: [masa, borde]. De cruda a dorada. */
const SOP_TONES: Array<[string, string]> = [
  ['#f4e4b8', '#e8cc90'],
  ['#f0cc80', '#d8a050'],
  [DOUGH, DOUGH_D],
];
/** Pedacitos de pebre (fracciones del radio + color): tomate, cilantro y cebolla. */
const PEBRE_BITS: Array<[number, number, number]> = Array.from({ length: 16 }, (_, i): [number, number, number] => [((i * 37) % 11) / 10 - 0.5, ((i * 53) % 7) / 6 - 0.5, i % 3]);

/** Sopaipilla redonda (elipse `rx` × `ry`), con pintitas tostadas, los hoyitos del tenedor y `pebre` (0..1). */
function sopaipillaShape(rx: number, ry: number, pebre: number, tone = 2): Shape {
  const [body, rim] = SOP_TONES[tone];
  const at = (fx: number, fy: number): [number, number] => [Math.round(fx * rx), Math.round(fy * ry)];
  const details: FPart[] = [];
  if (tone === 2) {
    for (const [fx, fy] of [[-0.55, -0.2], [0.45, 0.35], [0.15, -0.55], [-0.25, 0.5]]) details.push([...at(fx, fy), 2, 1, DOUGH_D]);
  }
  for (const fx of [-0.3, 0, 0.3]) details.push([...at(fx, 0.1), 1, 1, '#b06a20']);
  const big = rx >= 18 ? 2 : 1;
  for (const [fx, fy, ci] of PEBRE_BITS.slice(0, Math.round(pebre * PEBRE_BITS.length))) {
    details.push([Math.round(fx * rx * 1.1), Math.round(fy * ry) - 1, big, 1, PEBRE[ci]]);
  }
  return {
    parts: [...ellipseRows(0, 0, rx, ry, rim, DOUGH_IN), ...ellipseRows(0, -1, rx - 2, Math.max(1, ry - 2), body, DOUGH_IN)],
    details,
  };
}

interface CompletoState {
  /** 0 = nada, 1 = el pan, 2 = con vienesa. */
  layers: number;
  tomatoes: number;
  /** Cuánto de la palta y la mayo ya está puesto (de izquierda a derecha, 0..1). */
  palta: number;
  mayo: number;
}
const TOMATO_X = [-31, -23, -15, -7, 1, 9, 17, 25];

/** El italiano de lado: pan, vienesa que se asoma por las puntas, cubitos de tomate, palta y mayo. */
function completoShape(c: CompletoState): Shape {
  const parts: FPart[] = [];
  const details: FPart[] = [];
  if (c.layers >= 2) {
    parts.push([-38, -3, 76, 5, VIENESA, VIENESA_IN]);
    details.push([-36, -2, 72, 1, '#e07858']);
  }
  if (c.layers >= 1) {
    parts.push([-36, 1, 72, 7, BUN, BUN_IN], [-34, 0, 68, 9, BUN, BUN_IN]);
    details.push([-34, 7, 68, 2, BUN_D], [-34, 0, 68, 1, '#f4d8a8']);
  }
  for (const x of TOMATO_X.slice(0, c.tomatoes)) {
    parts.push([x, -6, 5, 3, TOMATE]);
    details.push([x, -6, 2, 1, TOMATE_L]);
  }
  const pw = Math.round(66 * c.palta);
  if (pw > 0) {
    parts.push([-33, -10, pw, 4, PALTA]);
    for (let x = -31; x + 5 <= -33 + pw; x += 9) parts.push([x, -11, 5, 1, PALTA]);
    for (let x = -30; x + 2 <= -33 + pw; x += 7) details.push([x, -8, 2, 1, PALTA_D]);
  }
  const mw = Math.round(62 * c.mayo);
  if (mw > 0) {
    parts.push([-31, -13, mw, 3, MAYO]);
    for (let x = -29; x + 6 <= -31 + mw; x += 10) parts.push([x, -14, 6, 1, MAYO]);
    details.push([-31, -11, mw, 1, MAYO_D]);
  }
  return { parts, details };
}

/** Empanada de pino: media luna de `hw` de medio ancho (de `top` a `bot`), con el repulgue trenzado en la orilla. */
function empanadaShape(hw: number, top: number, bot: number): Shape {
  const parts: FPart[] = [];
  const details: FPart[] = [];
  const span = bot - top + 0.5;
  for (let y = top; y <= bot; y++) {
    const t = (bot - y) / span;
    const half = Math.round(hw * Math.sqrt(1 - t * t));
    parts.push([-half, y, half * 2 + 1, 1, MASA, PINO]);
    // El repulgue: una trenza clarita/oscura siguiendo la orilla curva.
    if (y < bot - 1 && half > 2) {
      const c = y % 2 ? MASA_L : MASA_D;
      details.push([-half + 1, y, 2, 1, c], [half - 2, y, 2, 1, y % 2 ? MASA_D : MASA_L]);
    }
  }
  // Brillo del huevo arriba, base tostada y unas pintitas.
  details.push([-Math.round(hw * 0.35), top + 3, Math.round(hw * 0.4), 1, MASA_L], [-Math.round(hw * 0.25), top + 4, Math.round(hw * 0.2), 1, MASA_L]);
  details.push([-hw + 2, bot - 1, hw * 2 - 3, 2, MASA_D]);
  for (const fx of [-0.5, 0.1, 0.45]) details.push([Math.round(fx * hw), Math.round((top + bot) / 2) + (fx > 0 ? 1 : -1), 2, 1, MASA_D]);
  return { parts, details };
}

/** Vaso de mote con huesillo (de plástico, más ancho arriba). Origen = centro de abajo. */
const VASO = { h: 44, top: 14, bot: 11 };
interface VasoState {
  /** Nivel del jugo (0..1). */
  juice: number;
  /** Alto de la capa de mote (px). */
  mote: number;
  huesillos: number;
}
/** Dónde quedan los huesillos sobre el mote (x, y sobre la capa). */
const HUESILLO_AT = [
  { x: -4, dy: 6 },
  { x: 5, dy: 10 },
];

const vasoHalf = (r: number): number => Math.round(VASO.bot + ((VASO.top - VASO.bot) * r) / VASO.h);
const juiceTop = (s: VasoState): number => Math.max(s.mote, Math.round(s.juice * (VASO.h - 3)));

function drawHuesillo(g: G, x: number, y: number): void {
  disc(g, x, y, 5, INK);
  disc(g, x, y, 4, HUESILLO);
  flat(g, [[x - 2, y - 2, 2, 1, HUESILLO_L], [x - 3, y - 1, 1, 1, HUESILLO_L]]);
}

function drawVaso(g: G, s: VasoState): void {
  g.clear();
  const { h } = VASO;
  const top = juiceTop(s);
  g.fillStyle(hex(INK), 1);
  for (let r = -1; r < h; r++) {
    const hw = vasoHalf(Math.max(0, r));
    g.fillRect(-hw - 1, -1 - r, hw * 2 + 2, 1);
  }
  for (let r = 0; r < h; r++) {
    const hw = vasoHalf(r);
    const y = -1 - r;
    const c = r < s.mote ? MOTE : r < top ? (r === top - 1 ? JUGO_L : JUGO) : VIDRIO;
    g.fillStyle(hex(c), 1).fillRect(-hw, y, hw * 2, 1);
    // Granitos de mote.
    if (r < s.mote) for (let x = -hw + ((r * 3) % 4); x < hw; x += 4) g.fillStyle(hex(MOTE_D), 1).fillRect(x, y, 1, 1);
    // Reflejo del plástico.
    if (r > 2 && r < h - 3) g.fillStyle(hex(c === VIDRIO ? '#ffffff' : '#f0c890'), 1).fillRect(-hw + 2, y, 1, 1);
  }
  g.fillStyle(hex('#f8fcff'), 1).fillRect(-VASO.top, -h, VASO.top * 2, 1);
  HUESILLO_AT.slice(0, s.huesillos).forEach((p) => drawHuesillo(g, p.x, -1 - s.mote - p.dy));
}

/** Cuchara larga (la del mote): origen = la paleta; el mango sube en diagonal a la derecha. */
function drawCuchara(g: G, full: boolean): void {
  g.clear();
  for (let i = 0; i < 54; i++) {
    const x = 2 + Math.floor(i / 6);
    g.fillStyle(hex(INK), 1).fillRect(x - 1, -2 - i, 4, 1);
  }
  for (let i = 0; i < 54; i++) g.fillStyle(hex(METAL), 1).fillRect(2 + Math.floor(i / 6), -2 - i, 2, 1);
  drawShape(g, { parts: ellipseRows(0, 0, 3, 1, METAL), details: full ? [[-2, -1, 1, 1, MOTE], [0, -2, 2, 1, MOTE], [1, -1, 1, 1, MOTE_D]] : [] });
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

/** Av. Providencia detrás del puesto: cielo, una fachada con ventanas y la vereda. */
function drawCalleBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#e6d2b0'), 1).fillRect(x, y + 8, w, 66);
  g.fillStyle(hex('#c8b090'), 1).fillRect(x, y + 8, w, 3).fillRect(x, y + 34, w, 2);
  for (let wx = x + 8; wx < x + w; wx += 28) {
    for (const wy of [y + 15, y + 40]) {
      g.fillStyle(hex('#f4ecd8'), 1).fillRect(wx - 1, wy - 1, 16, 16);
      g.fillStyle(hex('#5a7a9a'), 1).fillRect(wx, wy, 14, 14);
      g.fillStyle(hex('#7a9aba'), 1).fillRect(wx + 1, wy + 1, 3, 6);
      g.fillStyle(hex('#f4ecd8'), 1).fillRect(wx + 6, wy, 2, 14);
    }
  }
  g.fillStyle(hex('#c8c4bc'), 1).fillRect(x, y + 74, w, h - 74);
  g.fillStyle(hex('#a8a49c'), 1).fillRect(x, y + 74, w, 1);
  for (let i = x + 10; i < x + w; i += 24) g.fillRect(i, y + 74, 1, h - 74);
}

/** Primer plano en la plaza: cielo, edificios lejanos, árboles y la vereda (suave, para que resalte la comida). */
function drawPlazaBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#b8dcf4'), 1).fillRect(x, y, w, h);
  const blocks: Array<[number, number, number]> = [[0, 30, 34], [30, 18, 26], [58, 38, 30], [92, 10, 22], [118, 26, 36], [158, 34, 24], [184, 16, 36]];
  for (const [bx, by, bw] of blocks) {
    g.fillStyle(hex('#cfd8e6'), 1).fillRect(x + bx, y + by, bw, 70 - by);
    g.fillStyle(hex('#e2e8f2'), 1);
    for (let wy = by + 4; wy < 64; wy += 7) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) g.fillRect(x + wx, y + wy, 3, 3);
  }
  for (const [tx, r] of [[18, 16], [202, 18], [150, 12]]) {
    disc(g, x + tx, y + 60, r, '#78b868');
    disc(g, x + tx - 3, y + 56, r - 5, '#8ac878');
  }
  g.fillStyle(hex('#a8d08a'), 1).fillRect(x, y + 70, w, 10);
  g.fillStyle(hex('#d8d4cc'), 1).fillRect(x, y + 80, w, h - 80);
  g.fillStyle(hex('#bcb8b0'), 1).fillRect(x, y + 80, w, 1);
  for (let i = x + 14; i < x + w; i += 30) g.fillRect(i, y + 80, 1, h - 80);
}

// ---------------------------------------------------------------------------
// Vendedores (de frente, detrás del carrito) y el carrito
// ---------------------------------------------------------------------------

interface Vendor {
  skin: string;
  hair: string;
  shirt: string;
  apron?: string;
  hat: 'panuelo' | 'gorro' | 'jockey' | 'mono';
  hatColor?: string;
  mustache?: boolean;
}

const TIA: Vendor = { skin: '#e8b890', hair: '#4a3020', shirt: '#7a5aa8', apron: '#f4f0e8', hat: 'panuelo', hatColor: '#d84848' };
const LUCHO: Vendor = { skin: '#d8a070', hair: '#3a2a20', shirt: '#f4f4f0', apron: '#d84040', hat: 'gorro', mustache: true };
const JUANA: Vendor = { skin: '#c89068', hair: '#d0d0d4', shirt: '#4a8a58', apron: '#f0e0b0', hat: 'mono' };
const MOTERO: Vendor = { skin: '#d8a878', hair: '#2a2020', shirt: '#3c6cd0', hat: 'jockey', hatColor: '#f0c030' };

/** Esquina superior izquierda de la cabeza del vendedor. */
const VENDOR = { x: 22, y: 27 };

/** Vendedor de la cintura para arriba (el carrito tapa el resto). Origen = esquina de la cabeza. */
function drawVendor(g: G, v: Vendor, talking: boolean, blink: boolean): void {
  g.clear();
  const hatC = v.hatColor ?? v.hair;
  const parts: Part[] = [
    [-3, 15, 4, 24, v.shirt],
    [24, 15, 4, 24, v.shirt],
    [0, 13, 25, 30, v.shirt],
    [6, 0, 13, 13, v.skin],
  ];
  if (v.hat === 'panuelo') parts.push([5, -2, 15, 5, hatC], [19, 1, 3, 3, hatC]);
  else if (v.hat === 'gorro') parts.push([6, -7, 13, 6, '#f8f8f4'], [5, -2, 15, 3, '#f8f8f4']);
  else if (v.hat === 'jockey') parts.push([5, -2, 15, 4, hatC], [12, 1, 10, 2, shade(hatC, -0.2)]);
  else parts.push([9, -5, 7, 4, v.hair], [5, -2, 15, 4, v.hair], [5, 1, 2, 5, v.hair], [18, 1, 2, 5, v.hair]);
  outlined(g, parts);
  if (v.hat === 'panuelo') flat(g, [[7, -1, 1, 1, '#f4f0e8'], [11, 0, 1, 1, '#f4f0e8'], [15, -1, 1, 1, '#f4f0e8'], [6, 2, 1, 4, v.hair], [18, 2, 1, 4, v.hair]]);
  if (v.hat === 'gorro') flat(g, [[5, -2, 15, 1, '#d8d8d0'], [6, 1, 1, 4, v.hair], [18, 1, 1, 4, v.hair]]);
  if (v.hat === 'jockey') flat(g, [[6, 2, 1, 4, v.hair]]);
  if (v.apron) {
    flat(g, [[4, 20, 17, 23, v.apron], [5, 13, 2, 7, v.apron], [18, 13, 2, 7, v.apron], [4, 20, 17, 1, shade(v.apron, -0.15)]]);
  } else {
    flat(g, [[10, 13, 5, 2, shade(v.shirt, -0.22)]]);
  }
  // Cara: ojos (o párpados), mejillas, bigote y la boca que habla.
  flat(g, blink ? [[8, 6, 2, 1, INK], [15, 6, 2, 1, INK]] : [[8, 5, 2, 2, INK], [15, 5, 2, 2, INK]]);
  flat(g, [[7, 8, 1, 1, '#f09090'], [17, 8, 1, 1, '#f09090']]);
  const my = v.mustache ? 10 : 9;
  if (v.mustache) flat(g, [[9, 8, 7, 1, v.hair], [8, 9, 2, 1, v.hair], [15, 9, 2, 1, v.hair]]);
  flat(g, talking ? [[11, my, 4, 2, '#7a2a2a']] : [[11, my + 1, 4, 1, INK]]);
}

/** Pone al vendedor detrás del carrito: habla (mueve la boca) los primeros segundos y pestañea de vez en cuando. */
function addVendor(kit: VinetaKit, layer: Layer, v: Vendor): void {
  const g = addG(kit, layer, VENDOR.x, VENDOR.y);
  let talking = false;
  let blink = false;
  let ms = 0;
  const redraw = (): void => drawVendor(g, v, talking, blink);
  redraw();
  kit.every(140, () => {
    ms += 140;
    // Frases de ~0,8 s con pausitas, durante unos 3 s.
    const next = ms < 3200 && ms % 1120 < 840 ? !talking : false;
    if (next === talking) return;
    talking = next;
    redraw();
  });
  kit.every(2300, () => {
    blink = true;
    redraw();
    kit.after(130, () => {
      blink = false;
      redraw();
    });
  });
}

interface CartStyle {
  body: string;
  trim: string;
  sign: string;
  awning?: [string, string];
  /** Ancho del carrito (por defecto, todo el panel). */
  x0?: number;
  x1?: number;
}

/** Cubierta de madera (y = 62), el frente pintado con su letrero y, si tiene, el toldo a rayas con sus palos. */
function addCart(kit: VinetaKit, layer: Layer, c: CartStyle): void {
  const g = addG(kit, layer);
  const x0 = c.x0 ?? 6;
  const x1 = c.x1 ?? 214;
  if (c.awning) {
    outlined(g, [[x0 + 2, 9, 2, 53, '#8a8a90'], [x1 - 4, 9, 2, 53, '#8a8a90'], [x0 - 4, 0, x1 - x0 + 8, 8, c.awning[1]]]);
    for (let i = 0, sx = x0 - 4; sx < x1 + 4; i++, sx += 10) {
      const col = c.awning[i % 2];
      g.fillStyle(hex(col), 1).fillRect(sx, 0, Math.min(10, x1 + 4 - sx), 8);
      // Festón del borde.
      g.fillStyle(hex(INK), 1).fillRect(sx + 1, 8, 8, 3);
      g.fillStyle(hex(col), 1).fillRect(sx + 2, 8, 6, 2);
    }
  }
  outlined(g, [
    [x0, 62, x1 - x0, 4, '#c8a070'],
    [x0 + 4, 66, x1 - x0 - 8, 44, c.body],
  ]);
  flat(g, [
    [x0, 62, x1 - x0, 1, '#e0c090'],
    [x0 + 4, 69, x1 - x0 - 8, 2, c.trim],
    [x0 + 4, 100, x1 - x0 - 8, 2, c.trim],
  ]);
  layer.add(
    makeText(kit.scene, Math.round((x0 + x1) / 2), 85, c.sign, { fontSize: '8px', fontStyle: '600', color: '#ffffff', stroke: INK, strokeThickness: 2 }).setOrigin(0.5),
  );
}

function layerAt(kit: VinetaKit, parent: Layer, x = 0, y = 0): Layer {
  const c = kit.scene.add.container(x, y);
  parent.add(c);
  return c;
}

// ---------------------------------------------------------------------------
// Efectos chicos
// ---------------------------------------------------------------------------

/** Hilito de vapor (o humo): sube serpenteando y se desvanece. */
function steam(kit: VinetaKit, layer: Layer, x: number, y: number, rise = 16, color = 0xffffff): void {
  const s = kit.scene.add.rectangle(x, y, 1, 3, color, 0.85).setOrigin(0);
  layer.add(s);
  const phase = Math.random() * 6;
  kit.progress(1000, (t) => s.setPosition(Math.round(x + Math.sin(phase + t * 7) * 2), Math.round(y - rise * t)).setAlpha(0.85 * (1 - t)), () => s.destroy());
}

/** Pedacito que sale volando y cae (migas, gotas, pebre). */
function particle(kit: VinetaKit, layer: Layer, x: number, y: number, color: string, dx: number, rise: number, fall: number, ms = 420): void {
  const p = kit.scene.add.rectangle(x, y, 1, 1, hex(color)).setOrigin(0);
  layer.add(p);
  kit.progress(ms, (t) => p.setPosition(Math.round(x + dx * t), Math.round(y - Math.sin(t * Math.PI) * rise + fall * t * t)).setAlpha(1 - t * 0.5), () => p.destroy());
}

/** Migas que caen del mordisco. */
function crumbs(kit: VinetaKit, layer: Layer, x: number, y: number, colors: string[]): void {
  [-5, -1, 3, 6].forEach((dx, i) => particle(kit, layer, x, y + (i % 2), colors[i % colors.length], dx, 4 + i, 26, 520));
}

/** Gota de condensación que aparece en el vaso y resbala un poco. */
function condensation(kit: VinetaKit, layer: Layer, x: number, y: number): void {
  const d = kit.scene.add.rectangle(x, y, 1, 2, 0xffffff, 0.9).setOrigin(0);
  layer.add(d);
  const slide = 4 + Math.floor(Math.random() * 6);
  kit.progress(1300, (t) => d.setPosition(x, Math.round(y + slide * t * t)).setAlpha(t < 0.7 ? 0.9 : (1 - t) * 3), () => d.destroy());
}

/** Punto al azar dentro del vaso (relativo a su base), sobre el plástico. */
function onVaso(): { x: number; y: number } {
  const r = 6 + Math.floor(Math.random() * (VASO.h - 12));
  const hw = vasoHalf(r) - 2;
  return { x: Math.round(-hw + Math.random() * hw * 2), y: -1 - r };
}

// ---------------------------------------------------------------------------
// Compra: la tía de las sopaipillas
// ---------------------------------------------------------------------------

const PAILA = { x: 100, y: 57 };
/** Dónde queda la sopaipilla: sobre la servilleta, a la derecha. */
const SOP_AT = { x: 177, y: 56 };

/** La paila de aceite en el carrito: la sopaipilla se fríe, sale dorada con la espumadera y le ponen pebre. */
const compraSopaipilla: VinetaBuilder = (kit) => {
  const stage = kit.framed(drawCalleBackdrop);
  addVendor(kit, stage, TIA);
  addCart(kit, stage, { body: '#f4ecd8', trim: '#d84848', sign: 'SOPAIPILLAS $500', awning: ['#d84848', '#f4f0e8'] });

  // Servilleta y la paila (aceite dorado con un brillo).
  const props = addG(kit, stage);
  outlined(props, [[160, 60, 34, 2, '#f8f8f4'], [PAILA.x - 27, PAILA.y, 54, 6, '#4a4a52'], [PAILA.x - 23, PAILA.y + 6, 46, 2, '#4a4a52']]);
  drawShape(props, {
    parts: ellipseRows(PAILA.x, PAILA.y, 28, 6, '#3a3a42'),
    details: [...ellipseRows(PAILA.x, PAILA.y, 25, 4, OIL), [PAILA.x - 16, PAILA.y - 3, 9, 1, OIL_L], [PAILA.x + 8, PAILA.y + 2, 6, 1, OIL_L]],
  });
  const sop = addG(kit, stage, PAILA.x - 4, PAILA.y);
  const tool = addG(kit, stage, PAILA.x - 4, -60);
  const fx = layerAt(kit, stage);

  // Se fríe: de cruda a dorada.
  let tone = 0;
  const drawFrying = (): void => {
    sop.clear();
    drawShape(sop, sopaipillaShape(10, 3, 0, tone));
  };
  drawFrying();
  kit.after(550, () => {
    tone = 1;
    drawFrying();
  });
  kit.after(1100, () => {
    tone = 2;
    drawFrying();
  });

  // Burbujas en el aceite (muchas mientras se fríe) y vapor que sube de la paila.
  let frying = true;
  let n = 0;
  kit.every(70, () => {
    if (!frying && n++ % 3) return;
    const bx = PAILA.x + Math.round((Math.random() * 2 - 1) * 22);
    const by = PAILA.y + Math.round((Math.random() * 2 - 1) * 3);
    const b = addG(kit, fx, bx, by);
    b.fillStyle(hex(OIL_L), 1).fillRect(1, 0, 1, 1).fillRect(0, 1, 1, 1).fillRect(2, 1, 1, 1).fillRect(1, 2, 1, 1);
    kit.after(220, () => b.destroy());
  });
  kit.every(380, () => steam(kit, fx, PAILA.x - 20 + Math.floor(Math.random() * 40), PAILA.y - 6));

  // La espumadera baja, saca la sopaipilla y la deja en la servilleta, estilando aceite.
  drawShape(tool, {
    parts: [[-1, -44, 2, 40, WOOD], ...ellipseRows(0, 0, 8, 2, METAL)],
    details: [[-4, 0, 1, 1, METAL_D], [0, 0, 1, 1, METAL_D], [4, 0, 1, 1, METAL_D], [-2, -1, 1, 1, METAL_D], [2, -1, 1, 1, METAL_D]],
  });
  kit.after(1500, () => kit.progress(300, (t) => tool.setY(lerp(-60, PAILA.y + 1, t)), undefined, 'Sine.Out'));
  kit.after(1850, () => {
    frying = false;
    const from = { x: PAILA.x - 4, y: PAILA.y };
    kit.progress(
      650,
      (t) => {
        const x = lerp(from.x, SOP_AT.x, t);
        const y = Math.round(from.y + (SOP_AT.y - 1 - from.y) * t - Math.sin(t * Math.PI) * 22);
        tool.setPosition(x, y + 1);
        sop.setPosition(x, y - 2);
      },
      () => {
        sop.clear().setPosition(SOP_AT.x, SOP_AT.y);
        drawShape(sop, sopaipillaShape(13, 5, 0));
        playSfx('bump');
        kit.progress(300, (t) => tool.setY(lerp(SOP_AT.y, -60, t)), undefined, 'Sine.In');
      },
      'Sine.InOut',
    );
    for (let i = 0; i < 3; i++) kit.after(60 + i * 90, () => particle(kit, fx, tool.x - 2 + i * 2, tool.y + 2, OIL, 0, 0, 14, 380));
  });

  // Dos cucharadas de pebre desde arriba.
  const spoon = addG(kit, stage, SOP_AT.x, -40);
  const drawSpoon = (full: boolean): void => {
    spoon.clear();
    drawShape(spoon, {
      parts: [[2, -40, 2, 38, '#a8b0bc'], ...ellipseRows(0, 0, 5, 2, '#c8d0d8')],
      details: full ? [[-3, -1, 2, 1, PEBRE[0]], [0, -2, 2, 1, PEBRE[1]], [2, -1, 1, 1, PEBRE[2]], [-1, 0, 2, 1, PEBRE[0]]] : [],
    });
  };
  [2900, 3550].forEach((at, i) => {
    kit.after(at, () => {
      drawSpoon(true);
      kit.progress(240, (t) => spoon.setY(lerp(-40, SOP_AT.y - 11, t)), () => {
        drawSpoon(false);
        playSfx('click');
        [-4, -1, 2, 4, 0].forEach((dx, k) => particle(kit, fx, SOP_AT.x + dx, SOP_AT.y - 9, PEBRE[k % 3], dx, 1, 7, 260));
        kit.after(260, () => {
          sop.clear();
          drawShape(sop, sopaipillaShape(13, 5, (i + 1) / 2));
          kit.progress(240, (t) => spoon.setY(lerp(SOP_AT.y - 11, -40, t)));
        });
      });
    });
  });

  // Lista: brilla y echa vapor.
  kit.after(4200, () => {
    sparkle(kit, fx, SOP_AT.x - 8, SOP_AT.y - 6);
    kit.after(150, () => sparkle(kit, fx, SOP_AT.x + 9, SOP_AT.y - 3));
    kit.every(300, () => steam(kit, fx, SOP_AT.x - 8 + Math.floor(Math.random() * 16), SOP_AT.y - 5));
  });
};

// ---------------------------------------------------------------------------
// Compra: Don Lucho y el italiano
// ---------------------------------------------------------------------------

const COMPLETO_AT = { x: 140, y: 51 };

/** Se arma el completo capa por capa en el plato; al final la mayo se chorrea por la punta. */
const compraCompleto: VinetaBuilder = (kit) => {
  const stage = kit.framed(drawCalleBackdrop);
  addVendor(kit, stage, LUCHO);
  addCart(kit, stage, { body: '#f0c030', trim: '#d84040', sign: 'COMPLETOS', awning: ['#d84040', '#f0c030'] });
  const plate = addG(kit, stage);
  outlined(plate, [[88, 60, 104, 2, PLATE]]);
  flat(plate, [[94, 62, 92, 1, '#d8d2c2']]);
  const blobs = addG(kit, stage);

  const C = COMPLETO_AT;
  const st: CompletoState = { layers: 0, tomatoes: 0, palta: 0, mayo: 0 };
  const comp = addG(kit, stage, C.x, C.y);
  const redraw = (): void => {
    comp.clear();
    drawShape(comp, completoShape(st));
  };
  const tools = layerAt(kit, stage);
  const fx = layerAt(kit, stage);

  /** Algo que cae desde arriba hasta `y` y al llegar se suma al completo. */
  const drop = (shape: Shape, x: number, y: number, ms: number, land: () => void): void => {
    const g = addG(kit, tools, x, y - 70);
    drawShape(g, shape);
    kit.progress(ms, (t) => g.setY(lerp(y - 70, y, t)), () => {
      g.destroy();
      land();
      redraw();
    }, 'Quad.In');
  };

  // 1. El pan. 2. La vienesa.
  kit.after(250, () =>
    drop(completoShape({ layers: 1, tomatoes: 0, palta: 0, mayo: 0 }), C.x, C.y, 320, () => {
      st.layers = 1;
      playSfx('bump');
    }),
  );
  kit.after(800, () =>
    drop({ parts: [[-38, -3, 76, 5, VIENESA]], details: [[-36, -2, 72, 1, '#e07858']] }, C.x, C.y, 300, () => {
      st.layers = 2;
      playSfx('bump');
    }),
  );
  // 3. Los cubitos de tomate, uno por uno.
  TOMATO_X.forEach((tx, i) =>
    kit.after(1300 + i * 110, () =>
      drop({ parts: [[0, 0, 5, 3, TOMATE]], details: [[0, 0, 2, 1, TOMATE_L]] }, C.x + tx, C.y - 6, 180, () => {
        st.tomatoes = i + 1;
        if (i % 2 === 0) playSfx('click');
      }),
    ),
  );
  // 4. La palta, con cuchara, de una punta a la otra. 5. La mayo casera, con la botella.
  const spread = (at: number, draw: (g: G) => void, y: number, set: (t: number) => void): void => {
    kit.after(at, () => {
      const g = addG(kit, tools, C.x - 34, y);
      draw(g);
      kit.progress(700, (t) => {
        set(t);
        g.setX(lerp(C.x - 34, C.x + 32, t));
        redraw();
      }, () => g.destroy());
    });
  };
  spread(2400, (g) => {
    outlined(g, [[-6, -3, 9, 3, '#c8d0d8'], [3, -4, 14, 2, '#a8b0bc']]);
    flat(g, [[-5, -4, 7, 2, PALTA]]);
  }, C.y - 13, (t) => (st.palta = t));
  spread(3200, (g) => {
    outlined(g, [[-4, -22, 9, 14, '#f8f4e0'], [-2, -8, 5, 3, '#d84040'], [-1, -5, 3, 2, '#d84040']]);
    flat(g, [[-3, -18, 7, 5, '#f0d048'], [-3, -21, 1, 10, '#ffffff']]);
  }, C.y - 13, (t) => (st.mayo = t));

  // 6. ¡Se chorrea! Una gota de mayo crece en la punta y cae al plato (y vuelve a pasar).
  let blobW = 0;
  const drip = (first: boolean): void => {
    const x = C.x + 29;
    const g = addG(kit, fx, x, C.y - 11);
    kit.progress(450, (t) => {
      g.clear().fillStyle(hex(MAYO), 1).fillRect(0, 0, 2, 1 + Math.round(t * 6));
    }, () => {
      kit.progress(220, (t) => g.setY(lerp(C.y - 5, C.y + 7, t)), () => {
        g.destroy();
        blobW = Math.min(blobW + 2, 8);
        blobs.clear().fillStyle(hex(INK), 1).fillRect(x - blobW / 2 - 1, 58, blobW + 4, 3);
        blobs.fillStyle(hex(MAYO), 1).fillRect(x - blobW / 2, 59, blobW + 2, 1);
        playSfx('bump');
        if (first) popText(kit, fx, x + 10, C.y - 18, '¡plop!', '#ffffff', 8, 600);
      }, 'Quad.In');
    });
  };
  kit.after(4050, () => {
    drip(true);
    sparkle(kit, fx, C.x - 20, C.y - 16);
    kit.every(1800, () => drip(false));
  });
};

// ---------------------------------------------------------------------------
// Compra: Doña Juana y el horno de barro
// ---------------------------------------------------------------------------

const HORNO = { x: 181, y: 66 };
const EMP_AT = { x: 102, y: 54 };

/** Horno de barro (de frente): base de piedra, la cúpula de adobe, la chimenea y la boca oscura. */
function drawHorno(g: G): void {
  const { x, y } = HORNO;
  outlined(g, [[x - 36, y, 72, 44, '#9a8a7a']]);
  g.fillStyle(hex('#7a6a5c'), 1);
  for (let row = 0; row < 5; row++) {
    g.fillRect(x - 36, y + 4 + row * 8, 72, 1);
    for (let i = (row % 2) * 6; i < 72; i += 12) g.fillRect(x - 36 + i, y + 4 + row * 8, 1, 8);
  }
  const dome = ellipseRows(x, y, 34, 46, '#c87a4a').filter((p) => p[1] < y);
  drawShape(g, {
    parts: [[x + 14, y - 50, 7, 10, '#a85a38'], ...dome],
    details: [
      ...ellipseRows(x, y, 19, 17, INK).filter((p) => p[1] < y),
      ...ellipseRows(x, y, 18, 16, '#2a1a18').filter((p) => p[1] < y),
      [x - 22, y - 34, 8, 1, '#e09868'],
      [x - 26, y - 28, 5, 1, '#e09868'],
      [x + 22, y - 20, 1, 6, '#a85a38'],
      [x - 28, y - 12, 1, 5, '#a85a38'],
    ],
  });
}

/** La empanada sale del horno en la pala, Doña Juana la desliza al plato y queda humeando. */
const compraEmpanada: VinetaBuilder = (kit) => {
  const stage = kit.framed(drawCalleBackdrop);
  addVendor(kit, stage, JUANA);
  addCart(kit, stage, { body: '#f4f0e8', trim: '#d85050', sign: 'EMPANADAS', x0: 6, x1: 144 });
  const horno = addG(kit, stage);
  drawHorno(horno);
  const plate = addG(kit, stage);
  outlined(plate, [[EMP_AT.x - 22, 60, 44, 2, PLATE]]);

  // Las brasas del horno: llamitas que tiemblan.
  const fire = addG(kit, stage);
  kit.every(120, () => {
    fire.clear();
    for (let i = 0; i < 6; i++) {
      const fx0 = HORNO.x - 14 + i * 5;
      const fh = 3 + Math.floor(Math.random() * 5);
      fire.fillStyle(hex('#f08030'), 1).fillRect(fx0, HORNO.y - fh, 4, fh);
      fire.fillStyle(hex('#f8c040'), 1).fillRect(fx0 + 1, HORNO.y - fh + 2, 2, Math.max(1, fh - 2));
    }
    fire.fillStyle(hex('#fff0a0'), 1).fillRect(HORNO.x - 6, HORNO.y - 2, 12, 2);
  });

  const emp = addG(kit, stage, HORNO.x, EMP_AT.y);
  drawShape(emp, empanadaShape(16, -9, 5));
  const pala = addG(kit, stage, HORNO.x, EMP_AT.y + 7);
  outlined(pala, [[-86, 0, 70, 2, WOOD], [-17, -1, 34, 3, '#c89a60']]);
  const fx = layerAt(kit, stage);
  // Humo de la chimenea.
  kit.every(520, () => steam(kit, fx, HORNO.x + 16 + Math.floor(Math.random() * 3), HORNO.y - 52, 22, 0xc8c8c8));

  // La pala sale con la empanada, se la pasa al plato y Doña Juana la retira de un tirón.
  kit.after(500, () =>
    kit.progress(900, (t) => {
      const x = lerp(HORNO.x, EMP_AT.x, t);
      emp.setX(x);
      pala.setX(x);
    }, () => {
      playSfx('bump');
      kit.progress(220, (t) => pala.setX(lerp(EMP_AT.x, EMP_AT.x - 90, t)).setAlpha(1 - t), undefined, 'Quad.In');
      emp.setY(EMP_AT.y - 1);
      kit.after(220, () => emp.setY(EMP_AT.y));
    }, 'Sine.InOut'),
  );
  // Humeante, con el brillo del huevo batido.
  kit.every(170, () => {
    if (emp.x > EMP_AT.x + 30) return;
    steam(kit, fx, emp.x - 10 + Math.floor(Math.random() * 20), EMP_AT.y - 10, 18);
  });
  kit.after(1700, () => {
    sparkle(kit, fx, EMP_AT.x - 6, EMP_AT.y - 7);
    kit.after(160, () => sparkle(kit, fx, EMP_AT.x + 8, EMP_AT.y - 4));
  });
  kit.after(2300, () => popText(kit, fx, EMP_AT.x, EMP_AT.y - 24, '¡recién salidita!', '#ffffff', 8, 900));
};

// ---------------------------------------------------------------------------
// Compra: mote con huesillo
// ---------------------------------------------------------------------------

const VASO_AT = { x: 134, y: 62 };

/** El vaso se llena de jugo, caen tres cucharadas de mote, los dos huesillos y la cuchara; suda de heladito. */
const compraMote: VinetaBuilder = (kit) => {
  const stage = kit.framed(drawCalleBackdrop);
  addVendor(kit, stage, MOTERO);
  addCart(kit, stage, { body: '#f4f8fc', trim: '#3c6cd0', sign: 'MOTE CON HUESILLO', awning: ['#3c6cd0', '#f4f8fc'] });

  // El bidón de jugo con huesillos flotando y la fuente de mote.
  const props = addG(kit, stage);
  outlined(props, [[176, 22, 30, 40, VIDRIO], [185, 17, 12, 4, '#3c6cd0'], [171, 54, 5, 3, '#3c6cd0']]);
  flat(props, [[177, 30, 28, 32, JUGO], [177, 30, 28, 1, JUGO_L], [178, 24, 1, 36, '#ffffff']]);
  for (const [hx, hy] of [[185, 40], [197, 47], [189, 55]]) drawHuesillo(props, hx, hy);
  outlined(props, [[68, 54, 34, 8, '#e8e8f0']]);
  flat(props, [[70, 54, 30, 2, MOTE], [72, 55, 1, 1, MOTE_D], [78, 54, 1, 1, MOTE_D], [86, 55, 1, 1, MOTE_D], [94, 54, 1, 1, MOTE_D]]);

  const s: VasoState = { juice: 0, mote: 0, huesillos: 0 };
  const vaso = addG(kit, stage, VASO_AT.x, VASO_AT.y);
  drawVaso(vaso, s);
  const tools = layerAt(kit, stage);
  const fx = layerAt(kit, stage);
  const surfaceY = (): number => VASO_AT.y - 1 - juiceTop(s);

  // 1. El cucharón vierte el jugo: sube el nivel.
  const ladle = addG(kit, tools, VASO_AT.x + 3, -20);
  outlined(ladle, [[-7, -2, 12, 5, METAL], [4, -16, 2, 15, METAL_D]]);
  flat(ladle, [[-6, -2, 10, 1, JUGO]]);
  const stream = addG(kit, tools);
  kit.after(200, () => kit.progress(250, (t) => ladle.setY(lerp(-20, 6, t))));
  kit.after(500, () =>
    kit.progress(1300, (t) => {
      s.juice = 0.6 * t;
      drawVaso(vaso, s);
      const top = 10;
      stream.clear().fillStyle(hex(JUGO), 1).fillRect(VASO_AT.x, top, 2, surfaceY() - top);
      stream.fillStyle(hex(JUGO_L), 1).fillRect(VASO_AT.x - 2 + (Math.floor(t * 20) % 2), surfaceY() - 1, 6, 1);
    }, () => {
      stream.clear();
      kit.progress(250, (t) => ladle.setY(lerp(6, -30, t)));
    }),
  );

  // 2. Tres cucharadas de mote: los granos caen y se van al fondo.
  const spoon = addG(kit, tools, VASO_AT.x, -30);
  [2000, 2500, 3000].forEach((at) =>
    kit.after(at, () => {
      spoon.clear();
      drawShape(spoon, { parts: [[2, -26, 2, 24, METAL_D], ...ellipseRows(0, 0, 5, 2, METAL)], details: [[-3, -2, 6, 2, MOTE], [-1, -3, 2, 1, MOTE_D]] });
      kit.progress(200, (t) => spoon.setY(lerp(-30, 12, t)), () => {
        spoon.clear();
        drawShape(spoon, { parts: [[2, -26, 2, 24, METAL_D], ...ellipseRows(0, 0, 5, 2, METAL)], details: [] });
        [-4, -2, 0, 2, 4, 1].forEach((dx, k) => {
          const p = kit.scene.add.rectangle(VASO_AT.x + dx, 14, 1, 1, hex(MOTE)).setOrigin(0);
          fx.add(p);
          const to = VASO_AT.y - 2 - s.mote - (k % 3);
          kit.progress(320 + k * 30, (t) => p.setY(Math.round(14 + (to - 14) * t * t)), () => p.destroy());
        });
        kit.after(380, () => {
          s.mote += 4;
          s.juice += 0.06;
          drawVaso(vaso, s);
          playSfx('click');
        });
        kit.after(200, () => kit.progress(200, (t) => spoon.setY(lerp(12, -30, t))));
      });
    }),
  );

  // 3. Los dos huesillos: ¡plop! y salpica.
  HUESILLO_AT.forEach((h, i) =>
    kit.after(3700 + i * 450, () => {
      const g = addG(kit, fx, VASO_AT.x + h.x, -8);
      drawHuesillo(g, 0, 0);
      const surf = surfaceY();
      kit.progress(300, (t) => g.setY(lerp(-8, surf, t)), () => {
        for (const dx of [-5, -2, 2, 5]) particle(kit, fx, VASO_AT.x + h.x + dx, surf - 1, JUGO_L, dx, 6, 4, 320);
        playSfx('bump');
        if (i === 0) popText(kit, fx, VASO_AT.x - 26, VASO_AT.y - 46, '¡plop!', '#ffffff', 8, 600);
        const rest = VASO_AT.y - 1 - s.mote - h.dy;
        kit.progress(260, (t) => g.setY(lerp(surf, rest, t)), () => {
          g.destroy();
          s.huesillos = i + 1;
          drawVaso(vaso, s);
        });
      }, 'Quad.In');
    }),
  );

  // 4. La cuchara larga adentro. 5. Gotitas de condensación: heladito.
  const cuchara = addG(kit, fx, VASO_AT.x + 1, -60);
  drawCuchara(cuchara, false);
  kit.after(4800, () => kit.progress(320, (t) => cuchara.setY(lerp(-60, VASO_AT.y - 8, t)), () => playSfx('click'), 'Sine.Out'));
  kit.after(5200, () => {
    popText(kit, fx, VASO_AT.x - 30, VASO_AT.y - 40, '¡heladito!', '#a8e0ff', 8, 900);
    kit.every(280, () => {
      const p = onVaso();
      condensation(kit, fx, VASO_AT.x + p.x, VASO_AT.y + p.y);
    });
  });
};

// ---------------------------------------------------------------------------
// El quiltro de frente (asomándose desde abajo a la derecha)
// ---------------------------------------------------------------------------

type DogMood = 'calm' | 'sad' | 'happy' | 'sneeze';
interface DogPose {
  /** Hacia dónde mira (-1 izquierda, 0 al frente). */
  look: number;
  mood: DogMood;
  open: boolean;
  /** Orejas levantadas un poquito (al mover la cabeza). */
  ear: number;
}

/** Pinta piezas en unidades de S px con contorno de 1 px. */
function dogUnits(g: G, parts: Part[], outline = true): void {
  if (outline) {
    g.fillStyle(hex(INK), 1);
    for (const [x, y, w, h] of parts) g.fillRect(x * S - 1, y * S - 1, w * S + 2, h * S + 2);
  }
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(x * S, y * S, w * S, h * S);
}

/** Cara del quiltro de frente (32 × 34): orejas caídas, mancha en la frente, hocico clarito. Origen = esquina. */
function drawDogFace(g: G, p: DogPose): void {
  g.clear();
  dogUnits(g, [
    [3, 10, 10, 7, FUR],
    [2, 0, 12, 10, FUR],
    [0, 2 - p.ear, 3, 7, PATCH],
    [13, 2 - p.ear, 3, 7, FUR_D],
  ]);
  dogUnits(g, [[5, 6, 6, 4, SPOT], [6, 11, 4, 6, SPOT], [3, 1, 3, 2, PATCH]], false);
  const ink = (x: number, y: number, w = 1, h = 1): void => {
    g.fillStyle(hex(INK), 1).fillRect(x, y, w, h);
  };
  const lx = p.look;
  if (p.mood === 'happy') {
    for (const ex of [9, 20]) {
      ink(ex, 8);
      ink(ex + 1, 7);
      ink(ex + 2, 8);
    }
  } else if (p.mood === 'sneeze') {
    ink(9, 7, 3, 1);
    ink(20, 7, 3, 1);
  } else {
    // Ojos grandes y brillosos (más todavía si está triste).
    for (const ex of [9, 20]) {
      ink(ex + lx, 6, 3, 3);
      g.fillStyle(0xffffff, 1).fillRect(ex + lx + 1, 6, 1, 1);
      if (p.mood === 'sad') g.fillStyle(0xffffff, 1).fillRect(ex + lx, 8, 1, 1);
    }
    if (p.mood === 'sad') {
      // Cejas de cara de traición: la punta de adentro levantada.
      ink(8, 4, 2, 1);
      ink(10, 3, 2, 1);
      ink(20, 3, 2, 1);
      ink(22, 4, 2, 1);
    }
  }
  ink(14, 12, 4, 2);
  g.fillStyle(0xffffff, 1).fillRect(15, 12, 1, 1);
  if (p.open || p.mood === 'sneeze') {
    g.fillStyle(hex('#6a2a2a'), 1).fillRect(12, 15, 8, 4);
    g.fillStyle(hex('#e86878'), 1).fillRect(14, 17, 4, 2);
  } else {
    ink(15, 14, 2, 2);
    ink(12, 16, 3, 1);
    ink(17, 16, 3, 1);
    if (p.mood === 'happy') g.fillStyle(hex('#e86878'), 1).fillRect(14, 17, 4, 4);
  }
}

const DOG_X = 172;
/** Asomado (se le ven la cara y el cuello) y levantado (pidiendo). */
const DOG_PEEK = 78;
const DOG_UP = 66;
/** El hocico, relativo a la esquina de la cara. */
const DOG_MOUTH = { x: 16, y: 17 };

interface Dog {
  g: G;
  pose: DogPose;
  redraw(): void;
}

/** El quiltro se asoma desde abajo hasta `y`. */
function addDog(kit: VinetaKit, layer: Layer, y: number, mood: DogMood = 'calm'): Dog {
  const g = addG(kit, layer, DOG_X, 108);
  const pose: DogPose = { look: -1, mood, open: false, ear: 0 };
  const redraw = (): void => drawDogFace(g, pose);
  redraw();
  kit.progress(320, (t) => g.setY(lerp(108, y, t)), undefined, 'Sine.Out');
  return { g, pose, redraw };
}

/** Feliz: ojitos cerrados, lengua afuera, orejas que se mueven, saltitos y corazoncitos. */
function happyDog(kit: VinetaKit, dog: Dog, fx: Layer): void {
  dog.pose.mood = 'happy';
  dog.pose.open = false;
  dog.redraw();
  playSfx('dog');
  kit.every(200, () => {
    dog.pose.ear = 1 - dog.pose.ear;
    dog.redraw();
  });
  kit.every(380, () => floatHeart(kit, fx, DOG_X + 10 + Math.floor(Math.random() * 12), dog.g.y - 4));
  const y0 = dog.g.y;
  kit.every(1400, () => kit.progress(260, (t) => dog.g.setY(y0 - Math.round(Math.sin(t * Math.PI) * 3))));
}

/** Mastica: abre y cierra el hocico unas veces y llama `done`. */
function chew(kit: VinetaKit, dog: Dog, times: number, done: () => void): void {
  for (let i = 0; i < times; i++) {
    kit.after(i * 140, () => {
      dog.pose.open = i % 2 === 0;
      dog.redraw();
    });
  }
  kit.after(times * 140, () => {
    dog.pose.open = false;
    dog.redraw();
    done();
  });
}

// ---------------------------------------------------------------------------
// Comer: primer plano con la comida en la mano
// ---------------------------------------------------------------------------

type MealId = 'sopaipilla' | 'completo' | 'empanada';

interface Meal {
  shape: Shape;
  /** Centro vertical y radio de la marca de los dientes. */
  cy: number;
  r: number;
  /** Dónde queda lo más hondo de cada mascada (de derecha a izquierda; -Infinity = no queda nada). */
  cuts: number[];
  /** La última mascada si está el quiltro: le queda un pedacito. */
  leftover: number;
  /** Borde izquierdo (de ahí se toma). */
  left: number;
  crumbs: string[];
}

const MEALS: Record<MealId, Meal> = {
  sopaipilla: { shape: sopaipillaShape(22, 15, 1), cy: -1, r: 17, cuts: [9, -5, -Infinity], leftover: -13, left: -22, crumbs: [DOUGH, DOUGH_D, PEBRE[0]] },
  completo: {
    shape: completoShape({ layers: 2, tomatoes: 8, palta: 1, mayo: 1 }),
    cy: -3,
    r: 14,
    cuts: [16, -6, -Infinity],
    leftover: -24,
    left: -38,
    crumbs: [BUN, PALTA, TOMATE],
  },
  empanada: { shape: empanadaShape(28, -16, 9), cy: -4, r: 15, cuts: [12, -6, -Infinity], leftover: -17, left: -28, crumbs: [MASA, MASA_D, PINO] },
};

const FOOD = { x: 104, y: 52 };

/** Tu mano con la manga, tomando algo desde abajo (el pulgar encima). Origen = centro de la mano. */
function drawHand(g: G, look: HumanLook): void {
  g.clear();
  outlined(g, [
    [-4, 4, 9, 60, look.shirt],
    [-4, -3, 8, 8, look.skin],
    [3, -5, 3, 4, look.skin],
  ]);
  flat(g, [[-4, 4, 9, 2, shade(look.shirt, -0.22)], [-3, 4, 6, 1, shade(look.skin, -0.15)]]);
}

interface Hold {
  stage: Layer;
  held: Layer;
  food: G;
  fx: Layer;
  dog: Dog | null;
}

/** Arma el primer plano: el quiltro (si se asoma) atrás, la comida con tu mano y una capa de efectos encima. */
function holdMeal(kit: VinetaKit, meal: Meal, edge: Edge, dog: 'no' | 'peek' | 'sad'): Hold {
  const stage = kit.framed(drawPlazaBackdrop);
  const d = dog === 'no' ? null : addDog(kit, stage, DOG_PEEK, dog === 'sad' ? 'sad' : 'calm');
  const held = layerAt(kit, stage, FOOD.x, FOOD.y);
  const food = addG(kit, held);
  drawShape(food, meal.shape, edge);
  drawHand(addG(kit, held, meal.left + 3, 2), playerLook());
  return { stage, held, food, fx: layerAt(kit, stage), dog: d };
}

/** Te comes la comida en tres mascadas (¡ñam!). Si el quiltro te sigue, se asoma y mira cada mordisco. */
function buildComer(kit: VinetaKit, id: MealId): void {
  const meal = MEALS[id];
  const watching = StoryState.hasFlag(FLAG_QUILTRO);
  const { held, food, fx, dog } = holdMeal(kit, meal, WHOLE, watching ? 'peek' : 'no');
  const cuts = watching ? [...meal.cuts.slice(0, -1), meal.leftover] : meal.cuts;
  let cut = Infinity;
  /** Dónde está el mordisco ahora (px de pantalla). */
  const biteX = (): number => FOOD.x + (cut === Infinity ? meal.left + 40 : cut === -Infinity ? meal.left + 6 : cut + 2);

  const bite = (c: number, i: number): void => {
    kit.progress(260, (t) => held.setY(FOOD.y - Math.round(Math.sin(t * Math.PI) * 6)));
    kit.after(130, () => {
      cut = c;
      food.clear();
      drawShape(food, meal.shape, biteEdge(c, meal.cy, meal.r));
      playSfx('eat');
      const bx = biteX();
      crumbs(kit, fx, bx, FOOD.y + meal.cy, meal.crumbs);
      popText(kit, fx, Math.min(bx + 16, 196), FOOD.y - 28, '¡ñam!', '#ffffff', 8, 500);
      // La empanada: ¡el cuesco de la aceituna! Casi se va una muela.
      if (id === 'empanada' && i === 1) {
        popText(kit, fx, bx - 4, FOOD.y - 40, '¡crac!', '#f0e060', 9, 600);
        particle(kit, fx, bx, FOOD.y + meal.cy - 2, '#e8dcb8', 14, 14, 30, 600);
        kit.progress(300, (t) => held.setX(FOOD.x + (t < 1 ? (Math.floor(t * 12) % 2 ? 1 : -1) : 0)));
        playSfx('bump');
      }
      if (dog) {
        dog.pose.ear = 1;
        dog.redraw();
        kit.after(160, () => {
          dog.pose.ear = 0;
          dog.redraw();
        });
      }
    });
  };
  cuts.forEach((c, i) => kit.after(500 + i * 1000, () => bite(c, i)));

  // Lo que pasa mientras queda algo: la empanada humea y la mayo del completo se chorrea.
  const alive = (): boolean => cut !== -Infinity && !(watching && cut === meal.leftover);
  if (id === 'empanada') {
    kit.every(220, () => {
      if (!alive()) return;
      steam(kit, fx, biteX() - 6 - Math.floor(Math.random() * 20), FOOD.y - 14, 18);
    });
  }
  if (id === 'completo') {
    kit.every(650, () => {
      if (!alive()) return;
      const x = Math.min(biteX(), FOOD.x + 30) - 4 - Math.floor(Math.random() * 6);
      const d = kit.scene.add.rectangle(x, FOOD.y + 9, 2, 2, hex(MAYO)).setOrigin(0);
      fx.add(d);
      kit.progress(600, (t) => d.setPosition(x, Math.round(FOOD.y + 9 + 50 * t * t)).setSize(2, 2 + Math.round(t * 2)), () => d.destroy());
    });
  }

  const end = 500 + cuts.length * 1000;
  if (dog) {
    // El último pedacito queda en tu mano... y el quiltro lo mira con cara de traición.
    kit.after(end - 300, () => {
      dog.pose.mood = 'sad';
      dog.redraw();
      kit.progress(240, (t) => dog.g.setY(lerp(DOG_PEEK, DOG_UP + 4, t)));
    });
  } else {
    kit.after(end, () => {
      for (let i = 0; i < 3; i++) kit.after(i * 260, () => floatHeart(kit, fx, FOOD.x - 10 + i * 10, FOOD.y - 14));
    });
  }
}

/** El quiltro se lleva el último pedacito: se lo pasas (sopaipilla, empanada) o se te cae la vienesa (completo). */
function buildQuiltroCome(kit: VinetaKit, id: MealId): void {
  const meal = MEALS[id];
  const { held, food, fx, dog } = holdMeal(kit, meal, biteEdge(meal.leftover, meal.cy, meal.r), 'sad');
  if (!dog) return;
  kit.after(350, () => kit.progress(240, (t) => dog.g.setY(lerp(DOG_PEEK, DOG_UP, t))));
  const mouth = { x: DOG_X + DOG_MOUTH.x, y: DOG_UP + DOG_MOUTH.y };

  if (id === 'completo') {
    // ¡Ups! Se te cae la vienesa del pedazo que queda y el quiltro la caza en el aire.
    const from = { x: FOOD.x + meal.leftover - 4, y: FOOD.y - 3 };
    const chunk = addG(kit, fx, from.x, from.y);
    outlined(chunk, [[0, 0, 9, 4, VIENESA]]);
    flat(chunk, [[0, 0, 9, 1, '#e07858']]);
    chunk.setVisible(false);
    kit.after(900, () => {
      chunk.setVisible(true);
      popText(kit, fx, from.x, from.y - 14, '¡ups!', '#ffffff', 8, 500);
      dog.pose.mood = 'calm';
      dog.pose.open = true;
      dog.redraw();
      kit.progress(240, (t) => dog.g.setY(lerp(DOG_UP, DOG_UP - 6, t)));
      kit.progress(
        520,
        (t) => chunk.setPosition(lerp(from.x, mouth.x - 4, t), Math.round(from.y + (mouth.y - 8 - from.y) * t * t - Math.sin(t * Math.PI) * 8)),
        () => {
          chunk.destroy();
          playSfx('eat');
          popText(kit, fx, mouth.x, DOG_UP - 18, '¡ñam!', '#ffffff', 8, 500);
          kit.progress(240, (t) => dog.g.setY(lerp(DOG_UP - 6, DOG_UP, t)));
          chew(kit, dog, 4, () => happyDog(kit, dog, fx));
          // Y tú te comes el resto: trabajo en equipo.
          kit.after(700, () => {
            kit.progress(260, (t) => held.setY(FOOD.y - Math.round(Math.sin(t * Math.PI) * 6)));
            kit.after(130, () => {
              food.clear();
              playSfx('eat');
              crumbs(kit, fx, FOOD.x + meal.left + 6, FOOD.y + meal.cy, meal.crumbs);
              popText(kit, fx, FOOD.x - 20, FOOD.y - 28, '¡ñam!', '#ffffff', 8, 500);
            });
          });
        },
      );
    });
    return;
  }

  // Le acercas el pedacito al hocico... ¡y se lo lleva de un tarascón!
  const to = { x: mouth.x - 4 - meal.leftover, y: mouth.y - meal.cy };
  kit.after(1000, () =>
    kit.progress(450, (t) => held.setPosition(lerp(FOOD.x, to.x, t), lerp(FOOD.y, to.y, t)), undefined, 'Sine.Out'),
  );
  kit.after(1250, () => {
    dog.pose.mood = 'calm';
    dog.pose.open = true;
    dog.redraw();
  });
  kit.after(1500, () => {
    food.clear();
    playSfx('eat');
    crumbs(kit, fx, mouth.x, mouth.y, meal.crumbs);
    popText(kit, fx, mouth.x - 6, DOG_UP - 16, '¡ñam!', '#ffffff', 8, 500);
    kit.progress(400, (t) => held.setPosition(lerp(to.x, FOOD.x, t), lerp(to.y, FOOD.y, t)), undefined, 'Sine.InOut');
    chew(kit, dog, 4, () => happyDog(kit, dog, fx));
  });
}

// ---------------------------------------------------------------------------
// Comer: el mote con huesillo
// ---------------------------------------------------------------------------

const MOTE_HOLD = { x: 104, y: 86 };

/** El vaso en tu mano, con la cuchara y gotitas de condensación. */
function holdVaso(kit: VinetaKit, s: VasoState, dog: 'no' | 'peek' | 'sad'): Hold & { cuchara: G } {
  const stage = kit.framed(drawPlazaBackdrop);
  const d = dog === 'no' ? null : addDog(kit, stage, DOG_PEEK, dog === 'sad' ? 'sad' : 'calm');
  const held = layerAt(kit, stage, MOTE_HOLD.x, MOTE_HOLD.y);
  const food = addG(kit, held);
  drawVaso(food, s);
  const cuchara = addG(kit, held, 2, -8);
  drawCuchara(cuchara, false);
  drawHand(addG(kit, held, -VASO.bot - 2, -20), playerLook());
  kit.every(320, () => {
    const p = onVaso();
    condensation(kit, held, p.x, p.y);
  });
  return { stage, held, food, fx: layerAt(kit, stage), dog: d, cuchara };
}

/** Te lo tomas de un viaje: dos sorbos, dos cucharadas de mote... ¡cerebro congelado! Los huesillos quedan. */
const comerMote: VinetaBuilder = (kit) => {
  const watching = StoryState.hasFlag(FLAG_QUILTRO);
  const s: VasoState = { juice: 0.8, mote: 12, huesillos: 2 };
  const { held, food, fx, dog, cuchara } = holdVaso(kit, s, watching ? 'peek' : 'no');
  const Y = MOTE_HOLD.y;

  const sip = (at: number, j1: number): void =>
    kit.after(at, () => {
      const j0 = s.juice;
      playSfx('eat');
      popText(kit, fx, MOTE_HOLD.x + 34, Y - 54, '¡glu, glu!', '#ffffff', 8, 500);
      kit.progress(600, (t) => {
        held.setY(Y - Math.round(Math.sin(t * Math.PI) * 8));
        s.juice = j0 + (j1 - j0) * t;
        drawVaso(food, s);
      });
    });
  const scoop = (at: number, m1: number): void =>
    kit.after(at, () => {
      // La cuchara sube cargada de mote hasta la boca y vuelve vacía.
      drawCuchara(cuchara, true);
      s.mote = m1;
      s.juice = Math.max(0, s.juice - 0.05);
      drawVaso(food, s);
      kit.progress(560, (t) => cuchara.setY(-8 - Math.round(Math.sin(t * Math.PI) * 90)));
      kit.after(280, () => {
        drawCuchara(cuchara, false);
        playSfx('eat');
        popText(kit, fx, MOTE_HOLD.x + 30, Y - 60, '¡ñam!', '#ffffff', 8, 500);
      });
    });
  sip(400, 0.45);
  sip(1400, 0.12);
  scoop(2400, 6);
  scoop(3200, 0);

  // ¡Cerebro congelado!
  kit.after(4000, () => {
    popText(kit, fx, MOTE_HOLD.x, Y - 64, '¡brrr!', '#a8e0ff', 10, 900);
    playSfx('cancel');
    const lines = addG(kit, fx);
    let on = true;
    kit.every(90, () => {
      drawShakeLines(lines, MOTE_HOLD.x - VASO.top, Y - VASO.h, VASO.top * 2, VASO.h, on, '#5a8ab8');
      on = !on;
    });
    kit.after(800, () => lines.destroy());
    if (dog) {
      dog.pose.mood = 'sad';
      dog.redraw();
    }
  });
};

/** El quiltro olfatea el vaso vacío... ¡achís! No es fan del mote. */
const quiltroMote: VinetaBuilder = (kit) => {
  const s: VasoState = { juice: 0, mote: 0, huesillos: 2 };
  const { held, fx, dog } = holdVaso(kit, s, 'sad');
  if (!dog) return;
  // El quiltro se acerca y le acercas el vaso al hocico (el vaso queda delante de su pecho).
  const sniffX = DOG_X - 16;
  const sniffY = 62;
  const to = { x: sniffX + DOG_MOUTH.x, y: sniffY + 18 + VASO.h };
  kit.after(300, () => {
    dog.pose.mood = 'calm';
    dog.pose.look = 0;
    dog.redraw();
    kit.progress(400, (t) => dog.g.setPosition(lerp(DOG_X, sniffX, t), lerp(DOG_PEEK, sniffY, t)), undefined, 'Sine.Out');
    kit.progress(450, (t) => held.setPosition(lerp(MOTE_HOLD.x, to.x, t), lerp(MOTE_HOLD.y, to.y, t)), undefined, 'Sine.Out');
  });
  // Snif, snif: el hocico tiembla.
  [900, 1250].forEach((at) =>
    kit.after(at, () => {
      popText(kit, fx, sniffX + 38, sniffY + 8, 'snif', '#ffffff', 7, 300);
      kit.progress(200, (t) => dog.g.setY(sniffY - (Math.floor(t * 6) % 2)));
    }),
  );
  // ¡Achís!
  kit.after(1800, () => {
    dog.pose.mood = 'sneeze';
    dog.redraw();
    playSfx('bump');
    popText(kit, fx, sniffX + 16, sniffY - 12, '¡achís!', '#ffffff', 10, 800);
    kit.progress(300, (t) => dog.g.setY(sniffY - Math.round(Math.sin(t * Math.PI) * 5)));
    for (const dx of [-8, -4, 0, 4, 8]) particle(kit, fx, sniffX + 16, sniffY + 14, '#e8f4ff', dx, 3, 12, 420);
    kit.progress(300, (t) => held.setX(to.x + (t < 1 ? (Math.floor(t * 10) % 2 ? 2 : -2) : 0)));
  });
  // Se aleja sacudiendo la cabeza; el vaso vuelve.
  kit.after(2400, () => {
    dog.pose.mood = 'calm';
    dog.pose.look = -1;
    kit.progress(450, (t) => held.setPosition(lerp(to.x, MOTE_HOLD.x, t), lerp(to.y, MOTE_HOLD.y, t)), undefined, 'Sine.InOut');
    kit.progress(400, (t) => dog.g.setPosition(lerp(sniffX, DOG_X, t), lerp(sniffY, DOG_UP + 4, t)));
    for (let i = 0; i < 6; i++) {
      kit.after(450 + i * 90, () => {
        dog.pose.ear = i % 2;
        dog.g.setX(DOG_X + (i % 2 ? 1 : -1));
        dog.redraw();
      });
    }
    kit.after(450 + 6 * 90, () => {
      dog.pose.ear = 0;
      dog.g.setX(DOG_X);
      dog.redraw();
    });
  });
};

/** Viñetas de la comida callejera, para el registro de src/ui/Vineta.ts. */
export const COMIDA_VINETAS: Record<string, VinetaBuilder> = {
  compra_sopaipilla: compraSopaipilla,
  compra_completo: compraCompleto,
  compra_empanada: compraEmpanada,
  compra_mote: compraMote,
  comer_sopaipilla: (kit) => buildComer(kit, 'sopaipilla'),
  comer_completo: (kit) => buildComer(kit, 'completo'),
  comer_empanada: (kit) => buildComer(kit, 'empanada'),
  comer_mote: comerMote,
  comer_sopaipilla_quiltro: (kit) => buildQuiltroCome(kit, 'sopaipilla'),
  comer_completo_quiltro: (kit) => buildQuiltroCome(kit, 'completo'),
  comer_empanada_quiltro: (kit) => buildQuiltroCome(kit, 'empanada'),
  comer_mote_quiltro: quiltroMote,
};
