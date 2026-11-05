import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';

/**
 * Viñetas de la casa de Paine (misión 2): recoger la loza del comedor y lavarla.
 *  - loza_mesa      la mesa con la loza sucia (y una mosca dando vueltas a la olla)
 *  - loza_recoger   llegas de perfil, apilas todo en los brazos y te lo llevas en equilibrio
 *  - loza_llave     abres la llave: corre el agua, se llena el lavaplatos, detergente y espuma
 *  - loza_lavar     platos y vasos: esponja, se van las manchas, brillito y al escurridor
 *  - loza_olla      la olla del arroz: lado verde de la esponja contra el pegado del fondo
 *  - loza_estilando la llave cerrada, el agua se va y todo gotea en el escurridor
 *  - loza_guardar   secas con el paño y guardas todo en el mueble
 * El lavaplatos se ve en primera persona (las manos entran desde abajo); el comedor, de lado.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

type G = Phaser.GameObjects.Graphics;
type Layer = Phaser.GameObjects.Container;
type Part = [x: number, y: number, w: number, h: number, color: string];
type Kind = 'plate' | 'glass' | 'pot';
interface Pt {
  x: number;
  y: number;
}

const INK = '#2a2433';
const PLATE = '#f4f2ea';
const PLATE_D = '#d8d2c2';
const PLATE_WELL = '#e8e4d8';
const GLASS = '#d8eef8';
const GLASS_L = '#eef8fc';
const JUICE = '#e8a040';
const RICE = '#f4eedc';
const PEGADO = '#c8914a';
const PEGADO_D = '#9a6430';
const SALSA = '#c85830';
const LETTUCE = '#6aa040';
const METAL = '#a8b0bc';
const METAL_D = '#6c7480';
const METAL_L = '#d4dae2';
const HANDLE = '#303038';
const WATER = '#5a8ab8';
const FOAM = '#f4f8fc';
const DROP = '#a8e0ff';

// ---------------------------------------------------------------------------
// Ayudas de dibujo
// ---------------------------------------------------------------------------

/** Rectángulos con contorno: primero todos los contornos y después los rellenos (piezas unidas por dentro). */
function outlined(g: G, parts: Part[], ox = 0, oy = 0): void {
  g.fillStyle(hex(INK), 1);
  for (const [x, y, w, h] of parts) g.fillRect(ox + x - 1, oy + y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(ox + x, oy + y, w, h);
}

/** Rectángulos sin contorno (detalles). */
function flat(g: G, parts: Part[], ox = 0, oy = 0): void {
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(ox + x, oy + y, w, h);
}

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

// ---------------------------------------------------------------------------
// La loza de lado (sobre la mesa, apilada, en el mueble). Origen = esquina inferior izquierda.
// ---------------------------------------------------------------------------

/** Plato de lado (14 × 3), con restos de comida si está sucio. */
function drawPlateSide(g: G, dirty: boolean): void {
  outlined(g, [
    [0, -3, 14, 1, PLATE],
    [2, -2, 10, 1, PLATE_D],
    [3, -1, 8, 1, PLATE_D],
  ]);
  if (dirty) flat(g, [[2, -4, 4, 1, RICE], [7, -4, 3, 1, SALSA], [11, -4, 1, 1, LETTUCE]]);
}

/** Vaso de lado (5 × 8), con el fondito de jugo si está sucio. */
function drawGlassSide(g: G, dirty: boolean): void {
  outlined(g, [[0, -8, 5, 8, GLASS]]);
  if (dirty) flat(g, [[0, -2, 5, 2, JUICE]]);
  flat(g, [[1, -7, 1, 4, '#ffffff']]);
}

/** Olla de lado (16 × 11 + asas). Sucia: granos en el borde y la cuchara de palo adentro. Boca abajo: estilando. */
function drawPotSide(g: G, dirty: boolean, upsideDown = false): void {
  if (dirty) outlined(g, [[11, -16, 2, 6, '#a87048']]);
  const rimY = upsideDown ? 0 : -11;
  outlined(g, [
    [0, -10, 16, 10, METAL],
    [-1, rimY, 18, 1, METAL_L],
    [-3, -8, 3, 2, HANDLE],
    [16, -8, 3, 2, HANDLE],
  ]);
  flat(g, [[0, upsideDown ? -10 : -3, 16, 3, METAL_D], [2, -9, 1, 6, METAL_L]]);
  if (dirty) flat(g, [[3, -12, 1, 1, RICE], [7, -12, 2, 1, RICE], [14, -12, 1, 1, RICE]]);
}

function drawSide(g: G, kind: Kind, dirty: boolean, upsideDown = false): void {
  if (kind === 'plate') drawPlateSide(g, dirty);
  else if (kind === 'glass') drawGlassSide(g, dirty);
  else drawPotSide(g, dirty, upsideDown);
}

// ---------------------------------------------------------------------------
// La loza en la mano, vista desde arriba (en el lavaplatos). Origen = centro.
// ---------------------------------------------------------------------------

/** Manchas de cada cosa, en el orden en que se van con la esponja. */
const SPOTS: Record<Kind, Part[]> = {
  plate: [
    [-5, -3, 4, 2, SALSA],
    [1, -6, 3, 2, '#e0c890'],
    [3, 1, 4, 2, SALSA],
    [-3, 3, 3, 2, LETTUCE],
    [-9, 1, 2, 2, '#a86838'],
    [6, -3, 2, 3, '#e0c890'],
  ],
  glass: [
    [-5, 4, 10, 4, JUICE],
    [-3, -4, 2, 2, '#b8c4b0'],
    [1, -1, 2, 2, '#b8c4b0'],
    [1, -8, 3, 1, '#d89090'],
  ],
  pot: [
    [-8, -8, 3, 1, RICE],
    [4, -8, 4, 1, RICE],
    [-11, -5, 5, 2, PEGADO],
    [2, -5, 5, 2, PEGADO],
    [-5, -4, 6, 3, PEGADO_D],
    [7, -4, 4, 3, PEGADO_D],
    [-1, -6, 3, 1, PEGADO],
  ],
};

/** Medio ancho de cada cosa vista desde arriba (para tomarla del borde). */
const HALF_W: Record<Kind, number> = { plate: 13, glass: 6, pot: 20 };

/**
 * Dibuja una cosa vista desde arriba con las primeras `spots` manchas (o gotas de agua si `wet`).
 * Sin manchas, brilla.
 */
function drawFace(g: G, kind: Kind, spots: number, wet = false): void {
  g.clear();
  if (kind === 'plate') {
    disc(g, 0, 0, 13, INK);
    disc(g, 0, 0, 12, PLATE);
    disc(g, 0, 0, 8, PLATE_D);
    disc(g, 0, 0, 7, PLATE_WELL);
  } else if (kind === 'glass') {
    outlined(g, [[-5, -8, 10, 17, GLASS]]);
    flat(g, [[-5, -8, 10, 2, GLASS_L], [-4, 7, 8, 2, '#c4e0ee']]);
  } else {
    outlined(g, [
      [-20, -1, 4, 3, HANDLE],
      [16, -1, 4, 3, HANDLE],
      [-16, -11, 32, 22, METAL],
    ]);
    flat(g, [
      [-16, -11, 32, 2, METAL_L],
      [-14, -9, 28, 8, '#5a6270'],
      [-12, -5, 24, 4, '#6c7482'],
      [-16, 8, 32, 3, METAL_D],
      [-13, 2, 2, 5, METAL_L],
    ]);
  }
  const list = SPOTS[kind].slice(0, spots);
  if (wet) for (const [x, y] of list) flat(g, [[x + 1, y, 1, 2, DROP]]);
  else flat(g, list);
  if (spots > 0) return;
  // Limpio: reflejos.
  if (kind === 'plate') flat(g, [[-7, -9, 4, 1, '#ffffff'], [-9, -7, 1, 4, '#ffffff']]);
  else if (kind === 'glass') flat(g, [[-3, -6, 1, 11, '#ffffff'], [-1, -6, 1, 3, '#ffffff']]);
  else flat(g, [[-11, -8, 5, 1, '#9aa2b0'], [-13, 2, 2, 7, '#eef2f6'], [10, 3, 1, 4, METAL_L]]);
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

/** El comedor de la casa de Paine de noche: papel mural, ventana, cuadro de la cordillera, reloj (21:00) y parquet. */
function drawComedorBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  const floorY = y + h - 14;
  g.fillStyle(hex('#e6d6b4'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#dccaa4'), 1);
  for (let i = x + 4; i < x + w; i += 8) g.fillRect(i, y, 1, floorY - 16 - y);
  // Friso de madera.
  g.fillStyle(hex('#b88a5c'), 1).fillRect(x, floorY - 16, w, 16);
  g.fillStyle(hex('#8a6038'), 1).fillRect(x, floorY - 17, w, 1).fillRect(x, floorY - 1, w, 1);
  // Ventana de noche: el cerro y las lucecitas de Paine.
  outlined(g, [[x + 14, y + 12, 42, 36, '#f0ece0']]);
  g.fillStyle(hex('#1c2440'), 1).fillRect(x + 16, y + 14, 38, 32);
  disc(g, x + 46, y + 21, 3, '#f4ecc0');
  g.fillStyle(hex('#121830'), 1).fillRect(x + 16, y + 38, 38, 8).fillRect(x + 22, y + 34, 14, 4).fillRect(x + 26, y + 31, 6, 3);
  g.fillStyle(hex('#f0d048'), 1).fillRect(x + 19, y + 43, 1, 1).fillRect(x + 31, y + 42, 1, 1).fillRect(x + 44, y + 44, 1, 1).fillRect(x + 50, y + 41, 1, 1);
  g.fillStyle(hex('#f0ece0'), 1).fillRect(x + 34, y + 14, 2, 32).fillRect(x + 16, y + 29, 38, 2);
  g.fillStyle(hex('#c85848'), 1).fillRect(x + 10, y + 10, 6, 40).fillRect(x + 54, y + 10, 6, 40);
  g.fillStyle(hex('#a84038'), 1).fillRect(x + 12, y + 10, 1, 40).fillRect(x + 57, y + 10, 1, 40);
  // Cuadro de la cordillera.
  outlined(g, [[x + 120, y + 12, 32, 22, '#8a5a38']]);
  g.fillStyle(hex('#9cd0f0'), 1).fillRect(x + 122, y + 14, 28, 18);
  g.fillStyle(hex('#6a7aa0'), 1).fillRect(x + 122, y + 26, 28, 6).fillRect(x + 126, y + 22, 8, 4).fillRect(x + 138, y + 20, 8, 6);
  g.fillStyle(hex('#ffffff'), 1).fillRect(x + 128, y + 22, 4, 1).fillRect(x + 140, y + 20, 4, 1);
  g.fillStyle(hex('#78c060'), 1).fillRect(x + 122, y + 30, 28, 2);
  // Reloj de pared: las nueve.
  disc(g, x + 186, y + 22, 8, INK);
  disc(g, x + 186, y + 22, 7, '#f8f8f0');
  g.fillStyle(hex(INK), 1).fillRect(x + 186, y + 16, 1, 6).fillRect(x + 182, y + 22, 5, 1);
  g.fillStyle(hex('#d04848'), 1).fillRect(x + 186, y + 22, 1, 1);
  // Parquet.
  g.fillStyle(hex('#a87048'), 1).fillRect(x, floorY, w, y + h - floorY);
  g.fillStyle(hex('#8a5a38'), 1).fillRect(x, floorY + 6, w, 1);
  for (let i = x + 5; i < x + w; i += 14) g.fillRect(i, floorY, 1, 6).fillRect(i + 7, floorY + 7, 1, 7);
}

/** Mesa del comedor de lado, con mantel a cuadros. La cubierta queda en y = TABLE.y. */
const TABLE = { x: 104, y: 74, w: 96 };
const FLOOR_Y = 102;

function drawTable(g: G): void {
  const { x, y, w } = TABLE;
  outlined(g, [
    [x + 4, y + 4, 3, FLOOR_Y - y - 4, '#7a4c30'],
    [x + w - 7, y + 4, 3, FLOOR_Y - y - 4, '#7a4c30'],
    [x, y, w, 6, '#f4f0e8'],
  ]);
  g.fillStyle(hex('#d85050'), 1);
  for (let i = x; i < x + w; i += 4) g.fillRect(i, y + ((i / 4) % 2 ? 2 : 0), 2, 2).fillRect(i + 2, y + ((i / 4) % 2 ? 0 : 2), 2, 2);
  g.fillRect(x, y + 4, w, 2);
}

/**
 * La cocina en primera persona: muebles arriba, cerámica, la ventana de noche, el mesón de granito,
 * la llave y la cubeta del lavaplatos (el agua, la loza y las manos van encima).
 */
const BASIN = { x: 65, y: 61, w: 90, h: 43 };
const BASIN_BOTTOM = BASIN.y + BASIN.h;
const WATER_FULL = 80;
/** Por donde cae el chorro (2 px de ancho). */
const NOZZLE = { x: 119, y: 33 };

function drawCocinaBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  // Cerámica blanca con una franja azul.
  g.fillStyle(hex('#eef0ea'), 1).fillRect(x, y, w, 54);
  g.fillStyle(hex('#cdd6d0'), 1);
  for (let ty = y + 14; ty < y + 54; ty += 7) g.fillRect(x, ty, w, 1);
  for (let ty = y + 14, row = 0; ty < y + 54; ty += 7, row++) {
    for (let tx = x + (row % 2) * 3; tx < x + w; tx += 7) g.fillRect(tx, ty, 1, 7);
  }
  g.fillStyle(hex('#5a8ad0'), 1).fillRect(x, y + 42, w, 3);
  // Muebles de arriba.
  g.fillStyle(hex('#c89a68'), 1).fillRect(x, y, w, 14);
  g.fillStyle(hex('#9a7048'), 1).fillRect(x, y + 13, w, 1);
  for (let i = x + 36; i < x + w; i += 37) g.fillRect(i, y, 1, 13);
  g.fillStyle(hex('#e8d0a8'), 1);
  for (let i = x + 32; i < x + w; i += 37) g.fillRect(i, y + 9, 2, 2).fillRect(i + 7, y + 9, 2, 2);
  // Ventana de noche sobre el lavaplatos.
  outlined(g, [[x + 84, y + 18, 52, 26, '#f4f4ee']]);
  g.fillStyle(hex('#1c2440'), 1).fillRect(x + 86, y + 20, 48, 22);
  disc(g, x + 94, y + 26, 2, '#f4ecc0');
  g.fillStyle(hex('#121830'), 1).fillRect(x + 86, y + 36, 48, 6).fillRect(x + 118, y + 32, 14, 4);
  g.fillStyle(hex('#f0d048'), 1).fillRect(x + 90, y + 39, 1, 1).fillRect(x + 101, y + 38, 1, 1).fillRect(x + 128, y + 40, 1, 1);
  g.fillStyle(hex('#f4f4ee'), 1).fillRect(x + 109, y + 20, 2, 22);
  // Mesón de granito.
  g.fillStyle(hex('#6e6a62'), 1).fillRect(x, y + 52, w, 2);
  g.fillStyle(hex('#a29c90'), 1).fillRect(x, y + 54, w, h - 54);
  for (let i = 0; i < 120; i++) {
    const sx = x + ((i * 73) % w);
    const sy = y + 55 + ((i * 29) % (h - 56));
    g.fillStyle(hex(i % 3 ? '#8a847a' : '#bab4a8'), 1).fillRect(sx, sy, 1, 1);
  }
  // Cubeta de acero: borde, pared del fondo (se ve la hondura) y el desagüe.
  g.fillStyle(hex(INK), 1).fillRect(x + BASIN.x - 4, y + BASIN.y - 4, BASIN.w + 8, BASIN.h + 6);
  g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + BASIN.x - 3, y + BASIN.y - 3, BASIN.w + 6, BASIN.h + 4);
  g.fillStyle(hex('#7c8492'), 1).fillRect(x + BASIN.x, y + BASIN.y, BASIN.w, BASIN.h);
  g.fillStyle(hex('#5c6470'), 1).fillRect(x + BASIN.x, y + BASIN.y, BASIN.w, 6);
  g.fillStyle(hex('#8c94a2'), 1).fillRect(x + BASIN.x, y + BASIN.y + 6, 2, BASIN.h - 6).fillRect(x + BASIN.x + BASIN.w - 2, y + BASIN.y + 6, 2, BASIN.h - 6);
  disc(g, x + 110, y + 97, 3, '#4a505c');
  g.fillStyle(hex('#9aa0aa'), 1).fillRect(x + 108, y + 97, 5, 1).fillRect(x + 110, y + 95, 1, 5);
  // La llave (monomando): base, cuello y la curva con el pico sobre la cubeta.
  outlined(g, [
    [x + 106, y + 48, 10, 6, METAL],
    [x + 109, y + 28, 4, 21, METAL],
    [x + 109, y + 25, 13, 4, METAL],
    [x + 118, y + 29, 4, 4, METAL],
  ]);
  g.fillStyle(hex(METAL_L), 1).fillRect(x + 110, y + 29, 1, 18).fillRect(x + 110, y + 26, 10, 1).fillRect(x + 107, y + 49, 8, 1);
  // Detergente (de limón).
  outlined(g, [
    [x + 166, y + 32, 4, 3, '#f0f0f0'],
    [x + 164, y + 35, 8, 19, '#3cb878'],
  ]);
  g.fillStyle(hex('#f8f8f0'), 1).fillRect(x + 165, y + 41, 6, 7);
  disc(g, x + 168, y + 44, 1, '#f0d048');
  g.fillStyle(hex('#68d098'), 1).fillRect(x + 165, y + 36, 1, 16);
}

/** Palanca de la llave: abajo (cerrada) o levantada (abierta). */
function drawLever(g: G, open: boolean): void {
  g.clear();
  if (open) outlined(g, [[101, 41, 2, 7, METAL_L], [99, 39, 5, 2, '#e8ecf0']]);
  else outlined(g, [[97, 48, 9, 2, METAL_L], [95, 47, 2, 3, '#e8ecf0']]);
}

// ---------------------------------------------------------------------------
// Escurridor y mueble
// ---------------------------------------------------------------------------

const RACK = { x: 168, y: 66, w: 46 };
/** Lo que va en el escurridor (centros): dos platos parados y dos vasos boca abajo. */
const RACK_SLOTS: Array<Pt & { kind: Kind }> = [
  { kind: 'plate', x: 178, y: 82 },
  { kind: 'plate', x: 190, y: 82 },
  { kind: 'glass', x: 201, y: 84 },
  { kind: 'glass', x: 209, y: 84 },
];

function drawRackBack(g: G): void {
  outlined(g, [[RACK.x, 96, RACK.w, 4, '#c8ccd4']]);
  g.fillStyle(hex('#9aa0aa'), 1).fillRect(RACK.x, 72, RACK.w, 1).fillRect(RACK.x, 72, 2, 24).fillRect(RACK.x + RACK.w - 2, 72, 2, 24);
  g.fillStyle(hex('#b0b6c0'), 1);
  for (let i = RACK.x + 6; i < RACK.x + RACK.w - 2; i += 6) g.fillRect(i, 73, 1, 23);
  g.fillStyle(hex('#e4e8ee'), 1).fillRect(RACK.x + 1, 97, RACK.w - 2, 1);
}

/** Alambres de adelante (van encima de la loza que está estilando). */
function drawRackFront(g: G): void {
  g.fillStyle(hex('#8a909a'), 1).fillRect(RACK.x, 87, RACK.w, 1).fillRect(RACK.x, 93, RACK.w, 1);
  g.fillStyle(hex('#e4e8ee'), 1).fillRect(RACK.x, 86, RACK.w, 1).fillRect(RACK.x, 92, RACK.w, 1);
  for (let i = RACK.x + 3; i < RACK.x + RACK.w; i += 6) g.fillRect(i, 86, 1, 10);
}

/** Una cosa limpia en el escurridor: plato parado o vaso boca abajo. Origen = centro del espacio. */
function drawRackItem(g: G, kind: Kind): void {
  if (kind === 'plate') {
    disc(g, 0, 0, 9, INK);
    disc(g, 0, 0, 8, PLATE);
    disc(g, 0, 0, 5, PLATE_WELL);
    flat(g, [[-5, -6, 3, 1, '#ffffff']]);
  } else {
    outlined(g, [[-3, -5, 6, 10, GLASS]]);
    flat(g, [[-3, 4, 6, 1, GLASS_L], [-2, -4, 1, 7, '#ffffff']]);
  }
}

/** Mueble de arriba abierto, a la izquierda: repisa para los vasos y abajo los platos y la olla. */
const CUPBOARD = { x: 6, y: 0, w: 54, h: 49 };
/** Dónde queda guardada cada cosa (de lado; esquina inferior izquierda). */
const SHELF: Array<Pt & { kind: Kind }> = [
  { kind: 'plate', x: 12, y: 46 },
  { kind: 'plate', x: 12, y: 44 },
  { kind: 'glass', x: 15, y: 23 },
  { kind: 'glass', x: 23, y: 23 },
  { kind: 'pot', x: 36, y: 46 },
];

function drawCupboard(g: G): void {
  const { x, y, w, h } = CUPBOARD;
  outlined(g, [[x, y, w, h, '#c89a68']]);
  g.fillStyle(hex('#6a4628'), 1).fillRect(x + 3, y + 2, w - 6, h - 5);
  g.fillStyle(hex('#5a3a20'), 1).fillRect(x + 3, y + 2, w - 6, 3);
  outlined(g, [[x + 3, 23, w - 6, 2, '#a87048']]);
}

/** Puerta del mueble: `t` = 0 abierta (de canto, a la izquierda) … 1 cerrada. */
function drawCupboardDoor(g: G, t: number): void {
  g.clear();
  const left = lerp(CUPBOARD.x - 5, CUPBOARD.x, t);
  const right = lerp(CUPBOARD.x, CUPBOARD.x + CUPBOARD.w, t);
  outlined(g, [[left, CUPBOARD.y, right - left, CUPBOARD.h, '#d8aa78']]);
  if (right - left > 12) {
    g.fillStyle(hex('#b88a58'), 1).fillRect(left + 3, 4, right - left - 6, 1).fillRect(left + 3, CUPBOARD.h - 5, right - left - 6, 1);
    g.fillStyle(hex('#f0d8a8'), 1).fillRect(right - 6, 22, 2, 4);
  }
}

// ---------------------------------------------------------------------------
// Manos (primera persona: entran desde abajo con la manga)
// ---------------------------------------------------------------------------

type Tool = 'grip' | 'sponge' | 'scour' | 'pano' | 'none';

/** Mano con antebrazo. Origen = centro de la mano. `grip` toma el borde de algo con el pulgar encima. */
function drawHand(g: G, look: HumanLook, tool: Tool): void {
  g.clear();
  if (tool === 'sponge') outlined(g, [[-6, -8, 12, 6, '#f0d048']]);
  if (tool === 'scour') outlined(g, [[-6, -8, 12, 6, '#48a858']]);
  if (tool === 'pano') {
    outlined(g, [[-8, -10, 16, 9, '#f4f0e8']]);
    g.fillStyle(hex('#d85050'), 1);
    for (let i = 0; i < 4; i++) g.fillRect(-8 + i * 4, -10 + (i % 2) * 3, 2, 3).fillRect(-6 + i * 4, -7 + (i % 2) * 3, 2, 3);
  }
  const parts: Part[] = [
    [-4, 3, 8, 60, look.shirt],
    [-3, -3, 6, 6, look.skin],
  ];
  if (tool === 'grip') parts.push([3, -4, 3, 3, look.skin]);
  outlined(g, parts);
  flat(g, [[-4, 3, 8, 2, shade(look.shirt, -0.22)], [-3, 2, 6, 1, shade(look.skin, -0.15)]]);
}

// ---------------------------------------------------------------------------
// Efectos chicos
// ---------------------------------------------------------------------------

/** Brillito de cuatro puntas que crece y se apaga. */
function sparkle(kit: VinetaKit, layer: Layer, x: number, y: number): void {
  const g = kit.scene.add.graphics({ x, y });
  layer.add(g);
  [1, 2, 3, 2, 1].forEach((s, i) =>
    kit.after(i * 70, () => {
      g.clear().fillStyle(0xffffff, 1).fillRect(-s, 0, s * 2 + 1, 1).fillRect(0, -s, 1, s * 2 + 1);
      g.fillStyle(hex('#fff2a0'), 1).fillRect(0, 0, 1, 1);
    }),
  );
  kit.after(5 * 70, () => g.destroy());
}

/** Pedacito que sale volando y cae (espuma, pegado, gotas). */
function particle(kit: VinetaKit, layer: Layer, x: number, y: number, color: string, dx: number, rise: number, fall: number, ms = 420): void {
  const p = kit.scene.add.rectangle(x, y, 1, 1, hex(color)).setOrigin(0);
  layer.add(p);
  kit.progress(
    ms,
    (t) => p.setPosition(Math.round(x + dx * t), Math.round(y - Math.sin(t * Math.PI) * rise + fall * t * t)).setAlpha(1 - t * 0.6),
    () => p.destroy(),
  );
}

/** Gota que cae derecho y se desvanece. */
function drip(kit: VinetaKit, layer: Layer, x: number, y: number, dist: number): void {
  const d = kit.scene.add.rectangle(x, y, 1, 2, hex(DROP)).setOrigin(0);
  layer.add(d);
  kit.progress(dist * 45, (t) => d.setPosition(x, Math.round(y + dist * t * t)).setAlpha(1 - t * 0.5), () => d.destroy());
}

/** Lleva un objeto de donde está a `to` en un arco de `height` px. */
function hop(kit: VinetaKit, obj: G, to: Pt, ms: number, height: number, done?: () => void): void {
  const from = { x: obj.x, y: obj.y };
  kit.progress(ms, (t) => obj.setPosition(lerp(from.x, to.x, t), Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * height)), done);
}

/** Mosca que zumba alrededor de `center()` (sigue a la olla si la mueven). */
function fly(kit: VinetaKit, layer: Layer, center: () => Pt): void {
  const g = kit.scene.add.graphics();
  layer.add(g);
  let f = 0;
  kit.every(60, () => {
    f++;
    const c = center();
    const x = Math.round(c.x + Math.cos(f * 0.35) * 7 + Math.sin(f * 0.9));
    const y = Math.round(c.y + Math.sin(f * 0.7) * 3);
    g.clear().fillStyle(hex(INK), 1).fillRect(x, y, 2, 1);
    g.fillStyle(0xd0e0f0, 1).fillRect(x + (f % 2), y - 1, 1, 1);
  });
}

// ---------------------------------------------------------------------------
// Comedor: la mesa con la loza sucia
// ---------------------------------------------------------------------------

/** La loza sobre la mesa (esquina inferior izquierda) y dónde queda apilada en tus brazos. */
const TABLE_ITEMS: Array<{ kind: Kind; at: Pt; stack: Pt }> = [
  { kind: 'plate', at: { x: 112, y: TABLE.y }, stack: { x: 89, y: 64 } },
  { kind: 'plate', at: { x: 161, y: TABLE.y }, stack: { x: 89, y: 62 } },
  { kind: 'glass', at: { x: 129, y: TABLE.y }, stack: { x: 91, y: 59 } },
  { kind: 'glass', at: { x: 180, y: TABLE.y }, stack: { x: 97, y: 59 } },
  { kind: 'pot', at: { x: 139, y: TABLE.y }, stack: { x: 89, y: 51 } },
];
const PLAYER_X = 76;

function buildTable(kit: VinetaKit): { stage: Layer; people: Layer; items: G[] } {
  const stage = kit.framed(drawComedorBackdrop);
  const table = kit.scene.add.graphics();
  drawTable(table);
  const people = kit.scene.add.container(0, 0);
  stage.add([table, people]);
  const items = TABLE_ITEMS.map((it) => {
    const g = kit.scene.add.graphics({ x: it.at.x, y: it.at.y });
    drawSide(g, it.kind, true);
    stage.add(g);
    return g;
  });
  const pot = items[4];
  const fx = kit.scene.add.container(0, 0);
  stage.add(fx);
  fly(kit, fx, () => ({ x: pot.x + 8, y: pot.y - 20 }));
  return { stage, people, items };
}

/** La mesa con la loza sucia, y una mosca interesada en la olla. */
const lozaMesa: VinetaBuilder = (kit) => {
  buildTable(kit);
};

/** Llegas de perfil, apilas la loza en los brazos (la olla arriba de todo) y te la llevas en equilibrio. */
const lozaRecoger: VinetaBuilder = (kit) => {
  const { scene } = kit;
  const { people, items } = buildTable(kit);
  const look = playerLook();
  const opts: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
  const top = FLOOR_Y - FIGURE_H;
  const body = scene.add.graphics({ x: PLAYER_X - 110, y: top });
  const arm = scene.add.graphics({ x: PLAYER_X - 110, y: top });
  drawSideBody(body, look, opts);
  drawSideArm(arm, look, opts, false);
  people.add([body, arm]);
  // La loza va encima del brazo: se pasa al frente.
  for (const it of items) people.add(it);

  kit.progress(
    900,
    (t) => {
      const x = lerp(PLAYER_X - 110, PLAYER_X, t);
      const bob = Math.floor(t * 8) % 2;
      body.setPosition(x, top - bob);
      arm.setPosition(x, top - bob);
    },
    () => {
      arm.clear();
      drawSideArm(arm, look, opts, true);
      TABLE_ITEMS.forEach((it, i) =>
        kit.after(200 + i * 420, () => hop(kit, items[i], it.stack, 380, 12, () => playSfx('click'))),
      );
      kit.after(200 + TABLE_ITEMS.length * 420 + 350, walkOut);
    },
    'Sine.Out',
  );

  // Se va caminando con todo; lo de arriba se tambalea.
  const walkOut = (): void => {
    const all = [body, arm, ...items];
    const base = all.map((o) => ({ x: o.x, y: o.y }));
    kit.progress(1400, (t) => {
      const dx = Math.round(t * 160);
      const bob = Math.floor(t * 12) % 2;
      all.forEach((o, i) => {
        const wobble = i >= 4 ? Math.round(Math.sin(t * 22 + i) * (i === 6 ? 1.4 : 0.8)) : 0;
        o.setPosition(base[i].x + dx + wobble, base[i].y - bob);
      });
    });
  };
};

// ---------------------------------------------------------------------------
// Lavaplatos
// ---------------------------------------------------------------------------

/** Dónde se sostiene la loza para lavarla: bajo el chorro. */
const HOLD = { x: 112, y: 66 };
/** Cuánto más abajo de lo sostenido va la mano de la esponja (la esponja queda sobre las manchas). */
const TOOL_DY: Record<Kind, number> = { plate: 6, glass: 5, pot: 3 };

/** La loza sucia en el mesón, a la izquierda (de lado; esquina inferior izquierda). */
const PILE: Array<Pt & { kind: Kind }> = [
  { kind: 'pot', x: 14, y: 76 },
  { kind: 'plate', x: 34, y: 86 },
  { kind: 'plate', x: 34, y: 84 },
  { kind: 'glass', x: 16, y: 96 },
  { kind: 'glass', x: 24, y: 96 },
];

interface SinkOpts {
  /** Altura del agua (BASIN_BOTTOM = vacío). */
  level: number;
  /** Cuánta espuma (0..1). */
  foam: number;
  tap: boolean;
  /** Índices de PILE que están sucios en el mesón. */
  pile: number[];
  /** Cuántos espacios del escurridor están ocupados. */
  rack: number;
  /** La olla limpia, boca abajo en el mesón. */
  potOnCounter?: boolean;
  cupboard?: boolean;
}

interface Sink {
  look: HumanLook;
  level: number;
  foam: number;
  tap: boolean;
  /** Dónde corta el chorro cuando hay algo bajo la llave (null = cae al agua). */
  hitY: number | null;
  pile: Map<number, G>;
  rack: Map<number, G>;
  counterPot: G | null;
  rackLayer: Layer;
  shelfLayer: Layer;
  held: Layer;
  hands: Layer;
  fxBack: Layer;
  fx: Layer;
  door: G | null;
  setWater(level: number, foam: number): void;
  setTap(open: boolean): void;
}

function drawWater(g: G, level: number, foam: number): void {
  g.clear();
  if (level >= BASIN_BOTTOM) return;
  g.fillStyle(hex(WATER), 0.8).fillRect(BASIN.x, level, BASIN.w, BASIN_BOTTOM - level);
  g.fillStyle(hex('#8ab8e0'), 1).fillRect(BASIN.x, level, BASIN.w, 1);
  g.fillStyle(hex('#a8d0f0'), 0.8);
  for (let i = 0; i < 4; i++) {
    const ry = level + 4 + i * 6;
    if (ry < BASIN_BOTTOM - 1) g.fillRect(BASIN.x + 8 + ((i * 23) % 60), ry, 10, 1);
  }
  const n = Math.round(foam * 16);
  for (let i = 0; i < n; i++) {
    const fx = BASIN.x + 4 + ((i * 37) % (BASIN.w - 8));
    disc(g, fx, level + ((i * 5) % 4), 2 + (i % 2), i % 3 ? FOAM : '#dcecf6');
  }
}

function drawStream(g: G, toY: number, frame: number): void {
  g.clear();
  const len = toY - NOZZLE.y;
  if (len <= 0) return;
  g.fillStyle(hex('#a8d8f8'), 0.85).fillRect(NOZZLE.x, NOZZLE.y, 2, len);
  g.fillStyle(0xffffff, 0.9);
  for (let y = NOZZLE.y + ((frame * 3) % 7); y < toY; y += 7) g.fillRect(NOZZLE.x + (y % 2), y, 1, 2);
  g.fillStyle(hex('#d8f0ff'), 1).fillRect(NOZZLE.x - 2 + (frame % 2), toY - 1, 5, 1);
}

/** Arma el lavaplatos con sus capas (de atrás hacia adelante) y deja corriendo el chorro y las burbujas. */
function buildSink(kit: VinetaKit, o: SinkOpts): Sink {
  const { scene } = kit;
  const stage = kit.framed(drawCocinaBackdrop);
  const layer = (): Layer => {
    const c = scene.add.container(0, 0);
    stage.add(c);
    return c;
  };
  const add = (g: G, to: Layer, x = 0, y = 0): G => {
    g.setPosition(x, y);
    to.add(g);
    return g;
  };

  const water = scene.add.graphics();
  stage.add(water);
  const fxBack = layer();
  const lever = scene.add.graphics();
  stage.add(lever);

  let door: G | null = null;
  const furniture = layer();
  const shelfLayer = layer();
  if (o.cupboard) {
    const cb = scene.add.graphics();
    drawCupboard(cb);
    furniture.add(cb);
    door = scene.add.graphics();
    drawCupboardDoor(door, 0);
    stage.add(door);
  }

  const pileLayer = layer();
  const pile = new Map<number, G>();
  for (const i of o.pile) {
    const g = add(scene.add.graphics(), pileLayer, PILE[i].x, PILE[i].y);
    drawSide(g, PILE[i].kind, true);
    pile.set(i, g);
  }
  let counterPot: G | null = null;
  if (o.potOnCounter) {
    counterPot = add(scene.add.graphics(), pileLayer, PILE[0].x, PILE[0].y);
    drawPotSide(counterPot, false, true);
  }

  const rackBack = scene.add.graphics();
  drawRackBack(rackBack);
  stage.add(rackBack);
  const rackLayer = layer();
  const rack = new Map<number, G>();
  for (let i = 0; i < o.rack; i++) {
    const g = add(scene.add.graphics(), rackLayer, RACK_SLOTS[i].x, RACK_SLOTS[i].y);
    drawRackItem(g, RACK_SLOTS[i].kind);
    rack.set(i, g);
  }
  const rackFront = scene.add.graphics();
  drawRackFront(rackFront);
  stage.add(rackFront);

  const held = layer();
  const stream = scene.add.graphics();
  stage.add(stream);
  const hands = layer();
  const fx = layer();

  const sink: Sink = {
    look: playerLook(),
    level: o.level,
    foam: o.foam,
    tap: o.tap,
    hitY: null,
    pile,
    rack,
    counterPot,
    rackLayer,
    shelfLayer,
    held,
    hands,
    fxBack,
    fx,
    door,
    setWater(level, foam) {
      sink.level = level;
      sink.foam = foam;
      drawWater(water, level, foam);
    },
    setTap(open) {
      sink.tap = open;
      drawLever(lever, open);
    },
  };
  sink.setWater(o.level, o.foam);
  sink.setTap(o.tap);

  // El chorro: tiembla, salpica y cae al agua (o sobre lo que se esté lavando).
  let frame = 0;
  kit.every(70, () => {
    frame++;
    if (!sink.tap) {
      stream.clear();
      return;
    }
    const to = sink.hitY ?? Math.min(sink.level, BASIN_BOTTOM - 4);
    drawStream(stream, to, frame);
    if (frame % 2) particle(kit, fx, NOZZLE.x + (frame % 4 < 2 ? -1 : 2), to - 1, DROP, frame % 4 < 2 ? -5 : 5, 4, 3, 300);
  });
  // Burbujas que suben desde la espuma y revientan.
  kit.every(190, () => {
    if (sink.foam < 0.3 || sink.level >= BASIN_BOTTOM) return;
    const bx = BASIN.x + 4 + Math.floor(Math.random() * (BASIN.w - 8));
    const by = sink.level + Math.floor(Math.random() * 4);
    const b = scene.add.graphics({ x: bx, y: by });
    b.fillStyle(0xffffff, 1).fillRect(1, 0, 1, 1).fillRect(0, 1, 1, 1).fillRect(2, 1, 1, 1).fillRect(1, 2, 1, 1);
    b.fillStyle(hex('#cfe8f4'), 1).fillRect(1, 1, 1, 1);
    fxBack.add(b);
    const rise = 8 + Math.floor(Math.random() * 10);
    kit.progress(900 + rise * 20, (t) => b.setPosition(bx + Math.round(Math.sin(t * 9 + bx)), Math.round(by - rise * t)), () => {
      particle(kit, fxBack, b.x, b.y, FOAM, -2, 1, 1, 160);
      particle(kit, fxBack, b.x + 2, b.y, FOAM, 2, 1, 1, 160);
      b.destroy();
    });
  });
  return sink;
}

interface Hands {
  grip: G;
  tool: G;
}

/** Las dos manos suben desde abajo: la izquierda sostiene, la derecha trae la esponja (o el paño). */
function raiseHands(kit: VinetaKit, sink: Sink, tool: Tool): Hands {
  const grip = kit.scene.add.graphics({ x: HOLD.x - 14, y: 140 });
  const t = kit.scene.add.graphics({ x: HOLD.x + 6, y: 150 });
  drawHand(grip, sink.look, 'grip');
  drawHand(t, sink.look, tool);
  sink.hands.add([grip, t]);
  kit.tween({ targets: grip, y: HOLD.y + 4, duration: 320, ease: 'Sine.Out', onUpdate: () => grip.setY(Math.round(grip.y)) });
  kit.tween({ targets: t, y: HOLD.y + 8, duration: 380, ease: 'Sine.Out', onUpdate: () => t.setY(Math.round(t.y)) });
  return { grip, tool: t };
}

interface Job {
  kind: Kind;
  /** Centro de donde sale (su gráfico se borra al tomarlo). */
  from: Pt;
  source?: G | null;
  /** 'dirt' = manchas (lavar), 'wet' = gotas (secar). */
  mode: 'dirt' | 'wet';
  /** Cómo se mueve la mano: en círculos, restregando fuerte o pasando el paño. */
  motion: 'circle' | 'scrub' | 'wipe';
  ms: number;
  /** Centro de adonde va al terminar; `place` lo dibuja ahí. Sin `to`, se queda en las manos brillando. */
  to?: Pt;
  place?: () => void;
}

/** Toma una cosa, la lava (o la seca) bajo la llave, brilla y la deja en su lugar. */
function processItem(kit: VinetaKit, sink: Sink, hands: Hands, job: Job, done: () => void): void {
  const { scene } = kit;
  const total = SPOTS[job.kind].length;
  const hold = { x: HOLD.x, y: HOLD.y + (job.kind === 'pot' ? 2 : 0) };
  job.source?.destroy();
  const item = scene.add.graphics({ x: job.from.x, y: job.from.y });
  drawFace(item, job.kind, total, job.mode === 'wet');
  sink.held.add(item);
  const gripX = hold.x - HALF_W[job.kind] + 1;
  kit.tween({ targets: hands.grip, x: gripX, duration: 300, onUpdate: () => hands.grip.setX(Math.round(hands.grip.x)) });

  hop(kit, item, hold, 360, 10, () => {
    if (sink.tap) sink.hitY = hold.y - 3;
    let left = total;
    const turns = job.motion === 'scrub' ? 7 : 3;
    kit.progress(job.ms, (t) => {
      const a = t * Math.PI * 2 * turns;
      const dx = job.motion === 'wipe' ? Math.sin(a) * 7 : Math.cos(a) * (job.motion === 'scrub' ? 7 : 5);
      const dy = job.motion === 'wipe' ? 0 : Math.sin(a) * 3;
      hands.tool.setPosition(Math.round(hold.x + 2 + dx), Math.round(hold.y + TOOL_DY[job.kind] + dy));
      // Restregando fuerte la olla: todo tiembla.
      const shake = job.motion === 'scrub' ? (Math.floor(t * 40) % 2) : 0;
      item.setPosition(hold.x + shake, hold.y);
      hands.grip.setPosition(gripX + shake, hold.y + 4);
      const now = Math.ceil(total * (1 - t) - 0.001);
      if (now >= left) return;
      left = now;
      drawFace(item, job.kind, left, job.mode === 'wet');
      const sx = hold.x + 2 + Math.round(dx);
      const sy = hold.y + 1;
      if (job.mode === 'wet') {
        drip(kit, sink.fx, item.x - 3 + (left % 3) * 3, item.y + 8, 18);
      } else if (job.kind === 'pot') {
        // El pegado sale volando en pedacitos.
        for (const d of [-6, -2, 4]) particle(kit, sink.fx, sx, sy, d < 0 ? PEGADO : PEGADO_D, d, 6, 14, 480);
        playSfx('click');
      } else {
        particle(kit, sink.fx, sx - 3, sy - 4, FOAM, -3, 6, 0, 360);
        particle(kit, sink.fx, sx + 3, sy - 4, FOAM, 3, 7, 0, 360);
      }
    }, () => {
      hands.tool.setPosition(hold.x + 6, hold.y + 8);
      sparkle(kit, sink.fx, hold.x - 6, hold.y - 6);
      kit.after(120, () => sparkle(kit, sink.fx, hold.x + 5, hold.y - 1));
      playSfx('select');
      if (!job.to) {
        done();
        return;
      }
      kit.after(320, () => {
        sink.hitY = null;
        hop(kit, item, job.to as Pt, 360, 12, () => {
          item.destroy();
          job.place?.();
          playSfx('click');
          done();
        });
      });
    });
  });
}

/** Encadena trabajos uno tras otro y al final llama `done`. */
function runJobs(kit: VinetaKit, sink: Sink, hands: Hands, jobs: Job[], done?: () => void): void {
  const step = (i: number): void => {
    if (i >= jobs.length) {
      done?.();
      return;
    }
    processItem(kit, sink, hands, jobs[i], () => kit.after(150, () => step(i + 1)));
  };
  kit.after(380, () => step(0));
}

const ALL_PILE = [0, 1, 2, 3, 4];

/** Centro aproximado de algo dibujado de lado (para tomarlo de ahí). */
function sideCenter(p: Pt, kind: Kind): Pt {
  return kind === 'plate' ? { x: p.x + 7, y: p.y - 2 } : kind === 'glass' ? { x: p.x + 2, y: p.y - 4 } : { x: p.x + 8, y: p.y - 5 };
}

/** Abres la llave: el agua corre y llena la cubeta, un chorrito de detergente y aparece la espuma. */
const lozaLlave: VinetaBuilder = (kit) => {
  const sink = buildSink(kit, { level: BASIN_BOTTOM, foam: 0, tap: false, pile: ALL_PILE, rack: 0 });
  const hand = kit.scene.add.graphics({ x: 100, y: 150 });
  drawHand(hand, sink.look, 'none');
  sink.hands.add(hand);
  kit.tween({ targets: hand, y: 52, duration: 380, ease: 'Sine.Out', onUpdate: () => hand.setY(Math.round(hand.y)) });
  kit.after(460, () => {
    sink.setTap(true);
    playSfx('click');
    kit.tween({ targets: hand, y: 46, duration: 120, yoyo: true, onUpdate: () => hand.setY(Math.round(hand.y)) });
  });
  kit.after(800, () => kit.tween({ targets: hand, y: 150, duration: 400, ease: 'Sine.In', onUpdate: () => hand.setY(Math.round(hand.y)) }));
  kit.after(520, () =>
    kit.progress(2800, (t) => sink.setWater(lerp(BASIN_BOTTOM, WATER_FULL, t), Math.max(0, (t - 0.3) / 0.7)), undefined, 'Sine.Out'),
  );
  // Un chorrito de detergente desde la botella.
  for (let i = 0; i < 4; i++) {
    kit.after(1200 + i * 90, () => {
      const d = kit.scene.add.rectangle(168, 31, 1, 2, hex('#3cb878')).setOrigin(0);
      sink.fx.add(d);
      kit.progress(520, (t) => d.setPosition(lerp(168, 132 + i * 2, t), Math.round(31 - Math.sin(t * Math.PI) * 10 + (sink.level - 31) * t)), () => d.destroy());
    });
  }
};

/** Platos y vasos: a la esponja, se van las manchas, brillito y al escurridor. */
const lozaLavar: VinetaBuilder = (kit) => {
  const sink = buildSink(kit, { level: WATER_FULL, foam: 1, tap: true, pile: ALL_PILE, rack: 0 });
  const hands = raiseHands(kit, sink, 'sponge');
  const order = [2, 1, 4, 3];
  const jobs: Job[] = order.map((pi, slot) => ({
    kind: PILE[pi].kind,
    from: sideCenter(PILE[pi], PILE[pi].kind),
    source: sink.pile.get(pi),
    mode: 'dirt',
    motion: 'circle',
    ms: PILE[pi].kind === 'plate' ? 900 : 700,
    to: RACK_SLOTS[slot],
    place: () => {
      const g = kit.scene.add.graphics({ x: RACK_SLOTS[slot].x, y: RACK_SLOTS[slot].y });
      drawRackItem(g, RACK_SLOTS[slot].kind);
      sink.rackLayer.add(g);
      sink.rack.set(slot, g);
    },
  }));
  runJobs(kit, sink, hands, jobs);
};

/** La olla del arroz: el lado verde de la esponja contra el pegado del fondo, hasta que brilla. */
const lozaOlla: VinetaBuilder = (kit) => {
  const sink = buildSink(kit, { level: WATER_FULL, foam: 0.8, tap: true, pile: [0], rack: 4 });
  const hands = raiseHands(kit, sink, 'scour');
  const job: Job = {
    kind: 'pot',
    from: sideCenter(PILE[0], 'pot'),
    source: sink.pile.get(0),
    mode: 'dirt',
    motion: 'scrub',
    ms: 2600,
  };
  runJobs(kit, sink, hands, [job], () => {
    // Quedó brillante: brillitos que se repiten sobre la olla.
    const spots: Pt[] = [{ x: HOLD.x - 10, y: HOLD.y - 6 }, { x: HOLD.x + 9, y: HOLD.y + 6 }, { x: HOLD.x - 2, y: HOLD.y + 10 }];
    let i = 0;
    kit.every(420, () => {
      const p = spots[i++ % spots.length];
      sparkle(kit, sink.fx, p.x, p.y);
    });
  });
};

/** Llave cerrada: el agua se va por el desagüe y la loza gotea en el escurridor. */
const lozaEstilando: VinetaBuilder = (kit) => {
  const sink = buildSink(kit, { level: WATER_FULL, foam: 0.6, tap: false, pile: [], rack: 4, potOnCounter: true });
  kit.progress(2200, (t) => sink.setWater(lerp(WATER_FULL, BASIN_BOTTOM, t), 0.6 * (1 - t)), undefined, 'Sine.In');
  const drips: Pt[] = [
    { x: 178, y: 91 },
    { x: 190, y: 91 },
    { x: 201, y: 89 },
    { x: 209, y: 89 },
    { x: 20, y: 77 },
    { x: 26, y: 77 },
  ];
  const shines: Pt[] = [
    { x: 174, y: 76 },
    { x: 186, y: 77 },
    { x: 200, y: 80 },
    { x: 208, y: 81 },
    { x: 18, y: 68 },
  ];
  let n = 0;
  kit.every(240, () => {
    const p = drips[(n * 5) % drips.length];
    n++;
    drip(kit, sink.fx, p.x, p.y, p.y > 85 ? 6 : 10);
  });
  kit.every(650, () => {
    const p = shines[n % shines.length];
    sparkle(kit, sink.fx, p.x, p.y);
  });
};

/** Secas con el paño cada cosa del escurridor y la guardas en el mueble; al final cierras la puerta. */
const lozaGuardar: VinetaBuilder = (kit) => {
  const sink = buildSink(kit, { level: BASIN_BOTTOM, foam: 0, tap: false, pile: [], rack: 4, potOnCounter: true, cupboard: true });
  const hands = raiseHands(kit, sink, 'pano');
  const store = (i: number, kind: Kind): Job['place'] => () => {
    const g = kit.scene.add.graphics({ x: SHELF[i].x, y: SHELF[i].y });
    drawSide(g, kind, false);
    sink.shelfLayer.add(g);
  };
  const jobs: Job[] = RACK_SLOTS.map((s, i) => ({
    kind: s.kind,
    from: s,
    source: sink.rack.get(i),
    mode: 'wet',
    motion: 'wipe',
    ms: 700,
    to: sideCenter(SHELF[i], s.kind),
    place: store(i, s.kind),
  }));
  jobs.push({
    kind: 'pot',
    from: sideCenter(PILE[0], 'pot'),
    source: sink.counterPot,
    mode: 'wet',
    motion: 'wipe',
    ms: 900,
    to: sideCenter(SHELF[4], 'pot'),
    place: store(4, 'pot'),
  });
  runJobs(kit, sink, hands, jobs, () => {
    const door = sink.door;
    if (!door) return;
    kit.after(250, () => kit.progress(380, (t) => drawCupboardDoor(door, t), () => playSfx('click'), 'Sine.In'));
  });
};

/** Viñetas de la casa, para el registro de src/ui/Vineta.ts. */
export const CASA_VINETAS: Record<string, VinetaBuilder> = {
  loza_mesa: lozaMesa,
  loza_recoger: lozaRecoger,
  loza_llave: lozaLlave,
  loza_lavar: lozaLavar,
  loza_olla: lozaOlla,
  loza_estilando: lozaEstilando,
  loza_guardar: lozaGuardar,
};
