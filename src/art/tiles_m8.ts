import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 8 («Lo que pasó en Salento»): el pueblo de Salento (calles empedradas, casas de bahareque
 * blancas con puertas, ventanas y balcones de colores, techos de teja, la Plaza de Bolívar con sus palmas de cera,
 * la parroquia, los Willys, los toldos del mercado campesino, la escalera y el mirador del Alto de la Cruz), la casita
 * con camarotes y la mesa de pimpón, la chiva, el bar de billar, la discoteca chiquita y el Parque del Café
 * (cafetales, guaduales, la montaña rusa, el Barco del Café, la Rueda Panorámica, los carros chocones...).
 * Cada tile es de 16×16 px y se dibuja con rectángulos, como el resto de src/art/tiles*.ts.
 */

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

const INK = PAL.outline;

/** Colores de las puertas, ventanas y balcones de Salento. */
export const SAL_COLORS: Record<string, { main: string; dark: string; light: string }> = {
  rojo: { main: '#c8303c', dark: '#8c1c28', light: '#e85a64' },
  azul: { main: '#2c64c0', dark: '#1c3c84', light: '#5a90e8' },
  verde: { main: '#2c9c58', dark: '#1c6a3c', light: '#5cc880' },
  amarillo: { main: '#e8b828', dark: '#a87c14', light: '#f8dc68' },
  naranja: { main: '#e8742c', dark: '#a84c18', light: '#f8a060' },
  morado: { main: '#7c3ca8', dark: '#4c2470', light: '#a86cd0' },
  turquesa: { main: '#1ca8a8', dark: '#147070', light: '#58d4d0' },
};

const SAL = {
  wall: '#f4f0e6',
  wallShade: '#d8d2c4',
  base: '#b8b0a0',
  tile: '#b8542c',
  tileDark: '#8c3a1c',
  tileLight: '#d8744a',
  eave: '#6a4428',
  eaveLight: '#8c5c38',
  stone: '#8c8c8c',
  stoneDark: '#6c6c70',
  stoneLight: '#acacac',
  plaza: '#c8bca8',
  plazaDark: '#a89c88',
  plazaLight: '#e0d6c4',
  pot: '#c0603c',
};

function grass(p: Painter): void {
  p.fill(PAL.grass);
  for (const [x, y] of [[2, 3], [10, 2], [6, 8], [12, 11], [2, 12]] as const) p.px(x, y, PAL.grassDark).px(x + 2, y, PAL.grassDark).px(x + 1, y + 1, PAL.grassDark);
}

/** Calle empedrada de Salento: piedras grises redondeadas. */
function piedra(p: Painter): void {
  p.fill(SAL.stoneDark);
  for (const [x, y, w, h] of [[0, 0, 5, 4], [6, 0, 4, 3], [11, 1, 5, 4], [1, 5, 4, 4], [6, 4, 5, 5], [12, 6, 4, 4], [0, 10, 5, 5], [6, 10, 4, 5], [11, 11, 5, 4]] as const) {
    p.rect(x, y, w, h, SAL.stone).px(x, y, SAL.stoneLight).rect(x, y + h - 1, w, 1, '#7a7a7e');
  }
}

/** Andén angosto de ladrillo y piedra. */
function anden(p: Painter): void {
  p.fill('#c89c78');
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y, 16, 1, '#a87c5c');
    for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < 16; x += 8) p.rect(x, y, 1, 4, '#a87c5c');
  }
  p.rect(0, 15, 16, 1, '#8c6448');
}

function plazaPiso(p: Painter): void {
  p.fill(SAL.plaza);
  for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) {
    p.rect(x, y, 8, 1, SAL.plazaDark).rect(x, y, 1, 8, SAL.plazaDark).px(x + 3, y + 3, SAL.plazaLight).px(x + 5, y + 5, SAL.plazaLight);
  }
}

/** Techo de teja de barro (vista de arriba): hileras de tejas con sombra. */
function teja(p: Painter, alt = false): void {
  p.fill(SAL.tile);
  for (let y = alt ? 2 : 0; y < 16; y += 4) {
    p.rect(0, y + 3, 16, 1, SAL.tileDark);
    for (let x = y % 8 === 0 ? 0 : 2; x < 16; x += 4) p.rect(x, y, 1, 3, SAL.tileLight).rect(x + 3, y, 1, 3, SAL.tileDark);
  }
}

/** Alero: el borde del techo de teja con las vigas de madera asomando (sombra sobre la fachada). */
function alero(p: Painter): void {
  teja(p);
  p.rect(0, 11, 16, 3, SAL.eave).rect(0, 11, 16, 1, SAL.eaveLight).rect(0, 14, 16, 2, '#3a2a20');
  for (let x = 1; x < 16; x += 5) p.rect(x, 14, 2, 2, SAL.eaveLight);
}

/** Muro blanco de bahareque con zócalo. */
function muroBlanco(p: Painter): void {
  p.fill(SAL.wall);
  p.rect(0, 0, 16, 2, SAL.wallShade).rect(0, 13, 16, 3, SAL.base).rect(0, 13, 16, 1, '#9c9484');
}

function fachadaPuerta(p: Painter, c: string): void {
  const k = SAL_COLORS[c];
  muroBlanco(p);
  p.rect(3, 3, 10, 13, INK).rect(4, 4, 8, 12, k.main).rect(4, 4, 8, 1, k.light);
  p.rect(5, 6, 2, 4, k.dark).rect(9, 6, 2, 4, k.dark).rect(5, 11, 2, 4, k.dark).rect(9, 11, 2, 4, k.dark);
  p.rect(7, 4, 2, 12, k.dark).px(10, 10, '#f0d060');
}

function fachadaVentana(p: Painter, c: string): void {
  const k = SAL_COLORS[c];
  muroBlanco(p);
  p.rect(2, 3, 12, 9, INK).rect(3, 4, 10, 7, '#3a3a48').rect(3, 4, 5, 7, k.main).rect(8, 4, 5, 7, k.main);
  p.rect(4, 5, 3, 2, k.light).rect(9, 5, 3, 2, k.light).rect(7, 4, 2, 7, k.dark);
  // Las matas en tarros pintados bajo la ventana.
  p.rect(2, 11, 12, 2, k.dark);
  for (const x of [3, 7, 11]) p.rect(x, 9, 2, 2, PAL.leaf).px(x, 8, PAL.flowerRed);
}

function balcon(p: Painter, c: string): void {
  const k = SAL_COLORS[c];
  muroBlanco(p);
  p.rect(3, 1, 10, 9, INK).rect(4, 2, 8, 8, k.main).rect(7, 2, 2, 8, k.dark);
  // El balcón de madera que sobresale, con sus barrotes.
  p.rect(0, 10, 16, 2, k.dark);
  p.rect(0, 9, 16, 1, k.light);
  for (let x = 1; x < 16; x += 3) p.rect(x, 10, 1, 5, k.main);
  p.rect(0, 14, 16, 2, k.dark);
}

function tiendaArtesanias(p: Painter): void {
  muroBlanco(p);
  p.rect(1, 3, 14, 13, INK).rect(2, 4, 12, 12, '#5a3a24');
  // Sombreros, mochilas y canastos colgados en la puerta abierta.
  p.rect(2, 4, 12, 2, '#e8c070');
  for (const [x, c] of [[3, '#c8303c'], [7, '#2c9c58'], [11, '#e8b828']] as const) p.rect(x, 7, 3, 4, c).rect(x + 1, 6, 1, 1, '#d8b070');
  p.rect(4, 12, 8, 3, '#d8b070').rect(5, 13, 6, 1, '#a87c3c');
}

/** Palma de cera (la palma más alta del mundo, el árbol nacional): tronco gris claro y penacho. */
function palmaCera(p: Painter): void {
  plazaPiso(p);
  p.rect(7, 4, 3, 12, INK).rect(8, 4, 1, 12, '#d8d4cc');
  p.rect(7, 13, 3, 3, SAL.plazaDark);
  for (const [x, y, w] of [[2, 1, 5], [9, 1, 5], [0, 3, 6], [10, 3, 6], [4, 0, 8]] as const) p.rect(x, y, w, 2, PAL.leafDark).rect(x + 1, y, w - 2, 1, PAL.leaf);
  p.rect(6, 2, 5, 3, PAL.leafOutline).rect(7, 2, 3, 2, PAL.leafLight);
}

function jardinPlaza(p: Painter): void {
  p.fill(PAL.grass);
  p.rect(0, 0, 16, 1, SAL.plazaDark).rect(0, 15, 16, 1, SAL.plazaDark);
  for (const [x, y, c] of [[3, 4, PAL.flowerRed], [10, 3, PAL.flowerYellow], [6, 10, '#e868a8'], [12, 11, PAL.flowerRed], [2, 12, PAL.white]] as const) {
    p.px(x, y - 1, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y + 1, c).px(x, y, PAL.yellow);
  }
}

function bancaPlaza(p: Painter): void {
  plazaPiso(p);
  p.rect(1, 5, 14, 7, INK).rect(2, 6, 12, 2, '#8c5a34').rect(2, 9, 12, 2, '#a86c40').rect(3, 12, 2, 3, INK).rect(11, 12, 2, 3, INK);
}

function farolColonial(p: Painter, on: (p: Painter) => void): void {
  on(p);
  p.rect(7, 3, 2, 13, INK).rect(5, 0, 6, 5, INK).rect(6, 1, 4, 3, '#f8e8a8').rect(6, 14, 4, 2, INK);
}

// ---------------------------------------------------------------------------
// La parroquia Nuestra Señora del Carmen (frente a la plaza)
// ---------------------------------------------------------------------------

function iglesiaMuro(p: Painter): void {
  p.fill('#f8f4ec');
  p.rect(0, 0, 16, 2, '#e8c860').rect(0, 13, 16, 3, '#c8c0b0');
  p.rect(5, 4, 6, 8, INK).rect(6, 5, 4, 7, '#7cb8e8').rect(7, 4, 2, 1, INK).rect(7, 5, 2, 7, '#e8c860');
}

function iglesiaPuerta(p: Painter): void {
  p.fill('#f8f4ec');
  p.rect(0, 0, 16, 2, '#e8c860');
  p.rect(2, 2, 12, 14, INK).rect(3, 3, 10, 13, '#6a3a1c').rect(4, 2, 8, 2, INK).rect(7, 3, 2, 13, '#4a2810');
  p.rect(4, 6, 2, 2, '#e8c860').rect(10, 6, 2, 2, '#e8c860');
}

function iglesiaTorre(p: Painter): void {
  p.fill('#f8f4ec');
  p.rect(2, 0, 12, 16, '#e8e2d4').rect(5, 2, 6, 7, INK).rect(6, 3, 4, 6, '#3a3a48').rect(7, 4, 2, 3, '#e8c860');
  p.rect(2, 12, 12, 1, '#e8c860');
}

function iglesiaTecho(p: Painter): void {
  p.fill('#9ca0a8');
  for (let y = 0; y < 16; y += 3) p.rect(0, y, 16, 1, '#7c8088');
  p.rect(7, 0, 2, 16, '#b8bcc4');
}

// ---------------------------------------------------------------------------
// Los Willys de la plaza (el jeep que lleva al valle de Cocora), de lado, en dos tiles
// ---------------------------------------------------------------------------

function willys(p: Painter, half: 0 | 1, color: string, under: (p: Painter) => void): void {
  under(p);
  const r: Rect = (x, y, w, h, c) => {
    const lx = x - half * 16;
    const x0 = Math.max(0, lx);
    const x1 = Math.min(16, lx + w);
    if (x1 > x0) p.rect(x0, y, x1 - x0, h, c);
  };
  r(1, 4, 30, 9, INK);
  r(2, 5, 28, 7, color);
  r(2, 5, 28, 1, '#ffffff55');
  r(17, 1, 12, 5, INK);
  r(18, 2, 10, 3, '#a8d0e8');
  r(22, 2, 1, 3, INK);
  r(0, 7, 3, 3, '#c8c8c8');
  r(29, 8, 3, 3, '#f8e070');
  r(3, 10, 8, 6, INK);
  r(4, 11, 6, 4, '#3a3a40');
  r(21, 10, 8, 6, INK);
  r(22, 11, 6, 4, '#3a3a40');
  r(5, 2, 10, 2, '#5a3a24');
  r(6, 0, 2, 2, '#e8c070');
  r(10, 0, 3, 2, '#2c9c58');
}

// ---------------------------------------------------------------------------
// El mercado campesino (toldos sobre la Calle Real) y la escalera al mirador
// ---------------------------------------------------------------------------

function toldo(p: Painter, c: string): void {
  const k = SAL_COLORS[c];
  p.fill(k.main);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 16, k.light);
  p.rect(0, 13, 16, 3, k.dark);
}

function puesto(p: Painter, kind: 'frutas' | 'queso' | 'cafe' | 'artesania' | 'plantas'): void {
  piedra(p);
  p.rect(0, 2, 16, 12, INK).rect(1, 3, 14, 10, '#a87c4c').rect(1, 3, 14, 1, '#c89c68');
  const goods: Record<string, Array<[number, number, number, number, string]>> = {
    frutas: [[2, 5, 3, 3, '#e8c020'], [6, 5, 3, 3, '#5c1c3c'], [10, 5, 4, 3, '#4c8c2c'], [3, 9, 3, 3, '#e86c1c'], [8, 9, 5, 3, '#c8303c']],
    queso: [[2, 5, 5, 4, '#f8f0c8'], [8, 5, 6, 4, '#f0e0a0'], [3, 10, 10, 2, '#e8e0c8']],
    cafe: [[2, 5, 4, 6, '#8c5a34'], [7, 5, 4, 6, '#6a3c1c'], [12, 5, 3, 6, '#c8a070'], [3, 6, 2, 1, '#f4f0e6'], [8, 6, 2, 1, '#f4f0e6']],
    artesania: [[2, 5, 3, 3, '#c8303c'], [6, 5, 3, 3, '#2c64c0'], [10, 5, 3, 3, '#e8b828'], [3, 9, 10, 3, '#d8b070']],
    plantas: [[2, 6, 3, 5, '#2c9c58'], [6, 5, 4, 6, '#1c6a3c'], [11, 6, 3, 5, '#5cc880'], [3, 10, 2, 2, SAL.pot], [7, 10, 2, 2, SAL.pot], [12, 10, 2, 2, SAL.pot]],
  };
  for (const [x, y, w, h, c] of goods[kind]) p.rect(x, y, w, h, c);
}

function escalera(p: Painter): void {
  p.fill('#b8b0a0');
  for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, '#ece4d4').rect(0, y + 3, 16, 1, '#8c8478');
  p.rect(0, 0, 1, 16, '#6a4428').rect(15, 0, 1, 16, '#6a4428');
}

function miradorPiso(p: Painter): void {
  p.fill('#a07848');
  for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, '#7c5a34');
  p.px(4, 2, '#c09868').px(11, 10, '#c09868');
}

function barandaMadera(p: Painter): void {
  miradorPiso(p);
  p.rect(0, 3, 16, 2, '#4a2c18').rect(0, 9, 16, 2, '#4a2c18');
  for (let x = 1; x < 16; x += 5) p.rect(x, 2, 2, 12, '#5a3a20');
}

/** El valle de Cocora desde el mirador: potreros verdes y palmas de cera altísimas, con neblina. */
function vistaCocora(p: Painter, v: number): void {
  p.fill('#9cc4e0');
  p.rect(0, 6, 16, 10, '#5c9c4c').rect(0, 6, 16, 2, '#8cbcd0');
  p.rect(0, 10, 16, 6, '#4c8c3c');
  const x = 3 + ((v * 5) % 10);
  p.rect(x, 2, 1, 10, '#d8d4cc').rect(x - 2, 1, 5, 2, '#2c6a34');
  p.rect(x + 6 > 15 ? 2 : x + 6, 5, 1, 7, '#d8d4cc');
  p.rect(0, 7, 16, 1, '#ffffff66');
}

function guadua(p: Painter, under: (p: Painter) => void): void {
  under(p);
  for (const [x, c] of [[2, '#7cac3c'], [6, '#5c8c2c'], [10, '#8cbc4c'], [13, '#6c9c34']] as const) {
    p.rect(x, 0, 2, 16, c);
    for (let y = 3; y < 16; y += 5) p.rect(x, y, 2, 1, '#3c5c1c');
  }
  p.rect(0, 0, 16, 3, '#4c8c2c').px(4, 1, '#8cbc4c').px(12, 2, '#8cbc4c');
}

/** Mata de café con sus granos rojos (el cafetal). */
function cafetal(p: Painter): void {
  p.fill('#7a5a34');
  for (const [cx, cy] of [[4, 4], [12, 5], [8, 11], [2, 13], [14, 13]] as const) {
    p.rect(cx - 3, cy - 3, 7, 6, PAL.leafOutline).rect(cx - 2, cy - 3, 5, 5, PAL.leafDark).rect(cx - 1, cy - 2, 3, 2, PAL.leaf);
    p.px(cx + 1, cy, '#d8283c').px(cx - 1, cy + 1, '#d8283c').px(cx, cy + 2, '#e8c020');
  }
}

// ---------------------------------------------------------------------------
// Interior: la casita (camarotes, pimpón, hamaca), la chiva, el bar de billar y la discoteca
// ---------------------------------------------------------------------------

function madera(p: Painter): void {
  p.fill('#a8784c');
  for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, '#8c5c34');
  p.rect(5, 0, 1, 4, '#8c5c34').rect(11, 4, 1, 4, '#8c5c34').rect(3, 8, 1, 4, '#8c5c34').rect(9, 12, 1, 4, '#8c5c34');
}

function terracota(p: Painter): void {
  p.fill('#c8784c');
  for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) p.rect(x, y, 8, 1, '#a85c34').rect(x, y, 1, 8, '#a85c34').px(x + 3, y + 4, '#d8946c');
}

function casaMuro(p: Painter): void {
  p.fill(SAL.wall);
  p.rect(0, 0, 16, 3, '#6a4428').rect(0, 3, 16, 1, '#8c5c38').rect(0, 13, 16, 3, '#2c9c58').rect(0, 13, 16, 1, '#1c6a3c');
}

/** Camarote visto desde arriba: la cama de abajo con almohada; el de arriba se adivina por las tablas. */
function camarote(p: Painter, upper: boolean): void {
  madera(p);
  p.rect(1, 0, 14, 16, INK).rect(2, 1, 12, 15, upper ? '#e85a64' : '#2c64c0');
  p.rect(3, 1, 10, 4, '#f4f0e6').rect(3, 4, 10, 1, '#d8d2c4');
  if (upper) p.rect(1, 0, 14, 2, '#6a4428').rect(1, 0, 2, 16, '#6a4428').rect(13, 0, 2, 16, '#6a4428');
  else p.rect(2, 8, 12, 1, '#1c3c84');
}

function camarotePie(p: Painter, upper: boolean): void {
  madera(p);
  p.rect(1, 0, 14, 14, INK).rect(2, 0, 12, 13, upper ? '#e85a64' : '#2c64c0').rect(2, 4, 12, 1, upper ? '#c8303c' : '#1c3c84');
  p.rect(1, 12, 14, 2, '#6a4428');
  if (upper) for (let y = 2; y < 12; y += 3) p.rect(13, y, 2, 1, '#a87c4c');
}

function pinpon(p: Painter, half: 0 | 1): void {
  terracota(p);
  p.rect(0, 2, 16, 12, INK);
  p.rect(half ? 0 : 1, 3, 15, 10, '#1c6a8c');
  p.rect(half ? 0 : 1, 7, 15, 1, '#f4f0e6').rect(half ? 0 : 1, 3, 15, 1, '#f4f0e6').rect(half ? 0 : 1, 12, 15, 1, '#f4f0e6');
  if (half === 0) p.rect(1, 3, 1, 10, '#f4f0e6');
  else p.rect(14, 3, 1, 10, '#f4f0e6').rect(0, 1, 1, 14, '#e8e8e8').rect(0, 2, 1, 12, INK);
}

function hamaca(p: Painter): void {
  terracota(p);
  p.rect(0, 5, 16, 6, INK).rect(1, 6, 14, 4, '#e8742c');
  for (let x = 2; x < 15; x += 3) p.rect(x, 6, 1, 4, '#f8dc68');
  p.rect(0, 7, 1, 2, '#5a3a20').rect(15, 7, 1, 2, '#5a3a20');
}

function chivaLado(p: Painter): void {
  p.fill('#e8b828');
  p.rect(0, 0, 16, 3, '#c8303c').rect(0, 3, 16, 2, '#2c64c0').rect(0, 12, 16, 4, '#2c9c58');
  p.rect(2, 5, 12, 7, '#9cd0f0').rect(2, 5, 12, 1, '#ffffff');
  p.rect(1, 13, 3, 2, '#f8dc68').rect(6, 13, 3, 2, '#c8303c').rect(11, 13, 3, 2, '#f8dc68');
}

function chivaBanca(p: Painter): void {
  p.fill('#a8784c');
  p.rect(0, 0, 4, 16, INK).rect(1, 0, 2, 16, '#c8303c').rect(4, 2, 10, 12, INK).rect(5, 3, 8, 10, '#e8b828');
  p.rect(5, 3, 8, 2, '#f8dc68');
}

function billar(p: Painter, i: number, j: number): void {
  // Mesa de 3 × 2 tiles (48 × 32 px): banda de madera, paño verde y las seis troneras.
  const r: Rect = (x, y, w, h, c) => {
    const lx = x - i * 16;
    const ly = y - j * 16;
    const x0 = Math.max(0, lx);
    const y0 = Math.max(0, ly);
    const x1 = Math.min(16, lx + w);
    const y1 = Math.min(16, ly + h);
    if (x1 > x0 && y1 > y0) p.rect(x0, y0, x1 - x0, y1 - y0, c);
  };
  r(0, 0, 48, 32, '#3a2418');
  r(1, 2, 46, 28, INK);
  r(2, 3, 44, 26, '#6a3c1c');
  r(5, 6, 38, 20, '#1c7a44');
  r(5, 6, 38, 1, '#2c9c58');
  for (const [x, y] of [[4, 5], [22, 4], [41, 5], [4, 24], [22, 25], [41, 24]] as const) r(x, y, 3, 3, '#0c0c10');
  r(10, 14, 2, 2, '#f4f0e6');
  for (const [x, y, c] of [[32, 15, '#e8b828'], [34, 13, '#2c64c0'], [34, 17, '#c8303c'], [36, 15, '#101014'], [36, 11, '#7c3ca8'], [36, 19, '#e8742c']] as const) r(x, y, 2, 2, c);
}

function barPiso(p: Painter): void {
  p.fill('#5a3a28');
  for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if ((x + y) % 16 === 0) p.rect(x, y, 8, 8, '#4a2c1c');
}

function barra(p: Painter): void {
  p.fill('#5a3a28');
  p.rect(0, 2, 16, 12, INK).rect(0, 3, 16, 10, '#8c5a34').rect(0, 3, 16, 2, '#b07c4c');
  p.rect(3, 6, 2, 4, '#c8a050').rect(9, 5, 2, 5, '#3c7c3c');
}

function estanteBotellas(p: Painter): void {
  p.fill('#3a2418');
  for (const y of [3, 9]) {
    p.rect(0, y + 5, 16, 1, '#8c5a34');
    for (const [x, c] of [[1, '#3c7c3c'], [4, '#c8a050'], [7, '#8c1c28'], [10, '#e8e8e8'], [13, '#3c7c3c']] as const) p.rect(x, y, 2, 5, c).px(x, y - 1, c);
  }
}

function taburete(p: Painter): void {
  barPiso(p);
  p.rect(4, 3, 8, 8, INK).rect(5, 4, 6, 6, '#c8303c').rect(7, 11, 2, 4, INK);
}

function rocola(p: Painter): void {
  p.fill('#3a2418');
  p.rect(2, 0, 12, 16, INK).rect(3, 1, 10, 14, '#c8303c').rect(4, 2, 8, 6, '#f8dc68').rect(5, 3, 6, 4, '#e8742c');
  p.rect(4, 9, 8, 2, '#5cc880').rect(4, 12, 8, 2, '#5a90e8');
}

function discoPiso(p: Painter, v: number): void {
  const cs = ['#7c3ca8', '#2c64c0', '#c8303c', '#1ca8a8'];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    p.rect(x * 8, y * 8, 8, 8, cs[(x + y * 2 + v) % 4]).rect(x * 8, y * 8, 8, 1, '#00000055').rect(x * 8 + 1, y * 8 + 1, 2, 2, '#ffffff44');
  }
}

function discoMuro(p: Painter): void {
  p.fill('#1c1824');
  p.rect(0, 12, 16, 4, '#2a2433');
  for (const [x, y, c] of [[2, 3, '#e868a8'], [9, 5, '#58d4d0'], [13, 2, '#f8dc68']] as const) p.rect(x, y, 2, 2, c);
}

function cabinaDj(p: Painter): void {
  p.fill('#1c1824');
  p.rect(0, 3, 16, 12, INK).rect(1, 4, 14, 10, '#3a3a48').rect(2, 5, 5, 4, '#101014').rect(9, 5, 5, 4, '#101014');
  p.rect(4, 6, 1, 1, '#58d4d0').rect(11, 6, 1, 1, '#e868a8').rect(2, 11, 12, 1, '#5cc880');
}

function parlante(p: Painter): void {
  p.fill('#1c1824');
  p.rect(3, 1, 10, 15, INK).rect(4, 2, 8, 13, '#2a2a34');
  p.rect(5, 3, 6, 5, '#101014').rect(5, 9, 6, 5, '#101014').px(7, 5, '#5a5a68').px(7, 11, '#5a5a68');
}

// ---------------------------------------------------------------------------
// Parque del Café
// ---------------------------------------------------------------------------

function caminoParque(p: Painter): void {
  p.fill('#d8c8a8');
  for (let y = 0; y < 16; y += 5) for (let x = (y % 10) / 2; x < 16; x += 6) p.rect(x, y, 4, 4, '#ccbc9c').px(x + 1, y + 1, '#e8dcc0');
}

function riel(p: Painter, vertical: boolean, under: (p: Painter) => void): void {
  under(p);
  if (vertical) {
    p.rect(4, 0, 2, 16, '#6a6c78').rect(10, 0, 2, 16, '#6a6c78');
    for (let y = 1; y < 16; y += 4) p.rect(3, y, 10, 1, '#c8303c');
    p.rect(7, 0, 2, 16, '#c8303c');
  } else {
    p.rect(0, 4, 16, 2, '#6a6c78').rect(0, 10, 16, 2, '#6a6c78');
    for (let x = 1; x < 16; x += 4) p.rect(x, 3, 1, 10, '#c8303c');
    p.rect(0, 7, 16, 2, '#c8303c');
  }
}

function soporte(p: Painter): void {
  grass(p);
  p.rect(3, 0, 2, 16, '#c8303c').rect(11, 0, 2, 16, '#c8303c');
  for (let y = 0; y < 16; y += 6) p.rect(3, y, 10, 1, '#8c1c28').rect(5, y + 1, 1, 4, '#8c1c28').rect(10, y + 1, 1, 4, '#8c1c28');
}

/** Pieza (i, j) de un dibujo grande: la Rueda Panorámica (3 × 3) o el Barco del Café (3 × 2). */
function bigPiece(p: Painter, i: number, j: number, draw: (r: Rect) => void, under: (p: Painter) => void): void {
  under(p);
  const r: Rect = (x, y, w, h, c) => {
    const lx = x - i * 16;
    const ly = y - j * 16;
    const x0 = Math.max(0, lx);
    const y0 = Math.max(0, ly);
    const x1 = Math.min(16, lx + w);
    const y1 = Math.min(16, ly + h);
    if (x1 > x0 && y1 > y0) p.rect(x0, y0, x1 - x0, y1 - y0, c);
  };
  draw(r);
}

function ruedaDraw(r: Rect): void {
  const cx = 24;
  const cy = 22;
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    for (let k = 3; k < 19; k += 2) r(Math.round(cx + Math.cos(t) * k), Math.round(cy + Math.sin(t) * k), 1, 1, '#d8d8e0');
  }
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    r(Math.round(cx + Math.cos(t) * 19), Math.round(cy + Math.sin(t) * 19), 2, 2, '#e8e8f0');
  }
  const cabin = ['#c8303c', '#2c64c0', '#e8b828', '#2c9c58', '#7c3ca8', '#e8742c', '#1ca8a8', '#e85a64'];
  cabin.forEach((c, a) => {
    const t = (a / 8) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * 19) - 2;
    const y = Math.round(cy + Math.sin(t) * 19);
    r(x - 1, y - 1, 7, 6, INK);
    r(x, y, 5, 4, c);
  });
  r(cx - 2, cy - 2, 5, 5, INK);
  r(cx - 1, cy - 1, 3, 3, '#f8dc68');
  r(cx - 8, cy, 2, 26, '#8c8c98');
  r(cx + 7, cy, 2, 26, '#8c8c98');
  r(cx - 12, 44, 26, 4, '#6a6c78');
}

function barcoDraw(r: Rect): void {
  r(4, 26, 40, 6, '#6a6c78');
  r(10, 2, 2, 26, '#8c8c98');
  r(36, 2, 2, 26, '#8c8c98');
  r(10, 2, 28, 2, '#8c8c98');
  r(23, 2, 2, 12, '#5a5a68');
  r(5, 12, 38, 12, INK);
  r(6, 13, 36, 10, '#8c4c24');
  r(6, 13, 36, 2, '#e8b828');
  r(4, 10, 6, 6, '#8c4c24');
  r(38, 10, 6, 6, '#8c4c24');
  for (let x = 9; x < 40; x += 5) r(x, 17, 3, 3, '#3a2010');
  r(18, 4, 12, 7, '#f4f0e6');
  r(22, 5, 4, 3, '#6a3c1c');
}

function chocones(p: Painter): void {
  p.fill('#5a5a68');
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) p.px(x + 1, y + 1, '#6c6c7c');
}

function chocBorde(p: Painter): void {
  p.fill('#5a5a68');
  p.rect(0, 0, 16, 5, '#e8b828');
  for (let x = 0; x < 16; x += 6) p.rect(x, 0, 3, 5, '#1c1824');
}

function taquilla(p: Painter): void {
  p.fill('#f4f0e6');
  p.rect(0, 0, 16, 4, '#c8303c').rect(0, 4, 16, 1, '#8c1c28');
  p.rect(3, 6, 10, 6, INK).rect(4, 7, 8, 4, '#9cd0f0').rect(2, 12, 12, 2, '#8c5a34');
}

function banderas(p: Painter, v: number): void {
  caminoParque(p);
  const cs = [['#d8283c', '#f4f0e6', '#2c64c0'], ['#e8c020', '#2c64c0', '#d8283c'], ['#74acdf', '#f4f0e6', '#74acdf'], ['#006847', '#f4f0e6', '#ce1126'], ['#c8102e', '#f4f0e6', '#c8102e'], ['#aa151b', '#f1bf00', '#aa151b']];
  const c = cs[v % cs.length];
  p.rect(2, 0, 1, 16, '#c8c8d0');
  p.rect(3, 1, 10, 2, c[0]).rect(3, 3, 10, 2, c[1]).rect(3, 5, 10, 2, c[2]);
}

function showCafe(p: Painter): void {
  p.fill('#8c5a34');
  p.rect(0, 0, 16, 4, '#5a3a20').rect(0, 4, 16, 1, '#e8b828');
  p.rect(2, 6, 12, 10, '#3a2418').rect(3, 7, 10, 8, '#c8303c').rect(7, 7, 2, 8, '#8c1c28');
}

function torreMirador(p: Painter): void {
  grass(p);
  p.rect(3, 0, 10, 16, INK).rect(4, 0, 8, 16, '#e8e2d4');
  for (let y = 2; y < 16; y += 5) p.rect(5, y, 6, 3, '#3a3a48').rect(6, y, 1, 3, '#7cb8e8');
}

function teleferico(p: Painter): void {
  p.fill('#d8c8a8');
  p.rect(0, 0, 16, 5, '#2c64c0').rect(0, 5, 16, 1, '#1c3c84').rect(0, 7, 16, 1, '#3a3a48');
  p.rect(4, 8, 8, 7, INK).rect(5, 9, 6, 5, '#e8b828').rect(6, 10, 4, 2, '#9cd0f0');
}

function rapidos(p: Painter, v: number): void {
  p.fill('#3c8cc8');
  for (let i = 0; i < 6; i++) p.rect((i * 5 + v * 3) % 16, (i * 7) % 16, 4, 1, '#c8e8f8');
  p.rect(0, 0, 2, 16, '#8c7c64').rect(14, 0, 2, 16, '#8c7c64');
}

function trenVia(p: Painter): void {
  caminoParque(p);
  p.rect(0, 4, 16, 1, '#6a6c78').rect(0, 11, 16, 1, '#6a6c78');
  for (let x = 1; x < 16; x += 4) p.rect(x, 3, 2, 10, '#7a5a34');
  p.rect(0, 4, 16, 1, '#8c8c98').rect(0, 11, 16, 1, '#8c8c98');
}

function kioskoComida(p: Painter): void {
  p.fill('#d8c8a8');
  p.rect(0, 0, 16, 5, '#2c9c58').rect(0, 5, 16, 1, '#1c6a3c');
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 5, '#5cc880');
  p.rect(1, 7, 14, 8, '#8c5a34').rect(2, 8, 12, 3, '#f8dc68').rect(4, 9, 3, 1, '#c8303c').rect(9, 9, 3, 1, '#e8742c');
}

function cerca(p: Painter): void {
  grass(p);
  p.rect(0, 6, 16, 2, '#8c5a34').rect(0, 11, 16, 2, '#8c5a34');
  for (let x = 1; x < 16; x += 7) p.rect(x, 3, 2, 12, '#6a3c1c');
}

export function m8Tiles(): TileDef[] {
  const out: TileDef[] = [
    { key: 'piedra', solid: false, draw: piedra },
    { key: 'anden', solid: false, draw: anden },
    { key: 'plaza_piso', solid: false, draw: plazaPiso },
    { key: 'teja', solid: true, draw: (p) => teja(p) },
    { key: 'teja_b', solid: true, draw: (p) => teja(p, true) },
    { key: 'alero', solid: true, draw: alero },
    { key: 'muro_blanco', solid: true, draw: muroBlanco },
    { key: 'tienda_artesanias', solid: true, draw: tiendaArtesanias },
    {
      // Puerta abierta (se puede entrar): el zaguán oscuro con el marco de madera.
      key: 'sal_entrada',
      solid: false,
      draw: (p) => {
        muroBlanco(p);
        p.rect(3, 2, 10, 14, INK).rect(4, 3, 8, 13, '#3a2418').rect(4, 3, 8, 2, '#6a4428').rect(5, 12, 6, 4, '#5a3a28');
      },
    },
    {
      // Vitrina de bar o discoteca, con su aviso de luces.
      key: 'sal_bar',
      solid: true,
      draw: (p) => {
        muroBlanco(p);
        p.rect(1, 2, 14, 11, INK).rect(2, 3, 12, 9, '#2a1c30').rect(3, 4, 10, 2, '#e868a8').rect(4, 8, 2, 3, '#f8dc68').rect(10, 7, 2, 4, '#58d4d0');
      },
    },
    { key: 'palma_cera', solid: true, draw: palmaCera },
    { key: 'jardin_plaza', solid: true, draw: jardinPlaza },
    { key: 'banca_salento', solid: true, draw: bancaPlaza },
    { key: 'farol_colonial', solid: true, draw: (p) => farolColonial(p, plazaPiso) },
    { key: 'farol_anden', solid: true, draw: (p) => farolColonial(p, anden) },
    { key: 'iglesia_muro', solid: true, draw: iglesiaMuro },
    { key: 'iglesia_puerta', solid: true, draw: iglesiaPuerta },
    { key: 'iglesia_torre', solid: true, draw: iglesiaTorre },
    { key: 'iglesia_techo', solid: true, draw: iglesiaTecho },
    { key: 'willys_rojo_a', solid: true, draw: (p) => willys(p, 0, '#c8303c', piedra) },
    { key: 'willys_rojo_b', solid: true, draw: (p) => willys(p, 1, '#c8303c', piedra) },
    { key: 'willys_azul_a', solid: true, draw: (p) => willys(p, 0, '#2c64c0', piedra) },
    { key: 'willys_azul_b', solid: true, draw: (p) => willys(p, 1, '#2c64c0', piedra) },
    { key: 'willys_verde_a', solid: true, draw: (p) => willys(p, 0, '#2c9c58', piedra) },
    { key: 'willys_verde_b', solid: true, draw: (p) => willys(p, 1, '#2c9c58', piedra) },
    { key: 'escalera_mirador', solid: false, draw: escalera },
    {
      // Trocha de tierra entre los potreros.
      key: 'trocha',
      solid: false,
      draw: (p) => {
        p.fill('#b08c5c');
        p.speckle(81, 10, '#9a7648').speckle(17, 6, '#c8a878');
      },
    },
    { key: 'arbol_salento', solid: true, draw: (p) => (grass(p), p.rect(6, 9, 4, 7, INK).rect(7, 9, 2, 7, PAL.trunk), p.rect(1, 0, 14, 11, PAL.leafOutline).rect(2, 1, 12, 9, PAL.leafDark).rect(4, 2, 7, 5, PAL.leaf).px(6, 3, PAL.leafLight)) },
    { key: 'guadua_pasto', solid: true, draw: (p) => guadua(p, grass) },
    { key: 'mirador_piso', solid: false, draw: miradorPiso },
    { key: 'baranda_madera', solid: true, draw: barandaMadera },
    { key: 'vista_cocora', solid: true, draw: (p) => vistaCocora(p, 0) },
    { key: 'vista_cocora_b', solid: true, draw: (p) => vistaCocora(p, 1) },
    { key: 'guadua', solid: true, draw: (p) => guadua(p, grass) },
    { key: 'cafetal', solid: true, draw: cafetal },
    { key: 'puesto_frutas', solid: true, draw: (p) => puesto(p, 'frutas') },
    { key: 'puesto_queso', solid: true, draw: (p) => puesto(p, 'queso') },
    { key: 'puesto_cafe', solid: true, draw: (p) => puesto(p, 'cafe') },
    { key: 'puesto_artesania', solid: true, draw: (p) => puesto(p, 'artesania') },
    { key: 'puesto_plantas', solid: true, draw: (p) => puesto(p, 'plantas') },
    // Interiores
    { key: 'madera', solid: false, draw: madera },
    { key: 'terracota', solid: false, draw: terracota },
    { key: 'casa_muro', solid: true, draw: casaMuro },
    {
      key: 'casa_ventana',
      solid: true,
      draw: (p) => {
        casaMuro(p);
        p.rect(3, 4, 10, 8, INK).rect(4, 5, 8, 6, '#9cd0f0').rect(7, 5, 2, 6, '#2c9c58').rect(4, 5, 8, 1, '#2c9c58');
      },
    },
    {
      key: 'casa_cuadro',
      solid: true,
      draw: (p) => {
        casaMuro(p);
        p.rect(3, 4, 10, 8, '#8c5a34').rect(4, 5, 8, 6, '#5c9c4c').rect(7, 5, 1, 5, '#d8d4cc').rect(5, 5, 5, 1, '#2c6a34');
      },
    },
    {
      key: 'casa_puerta',
      solid: false,
      draw: (p) => {
        madera(p);
        p.rect(2, 0, 12, 16, INK).rect(3, 0, 10, 16, '#c8303c').rect(3, 0, 10, 2, '#e85a64').rect(10, 8, 1, 1, '#f0d060');
      },
    },
    { key: 'camarote', solid: true, draw: (p) => camarote(p, false) },
    { key: 'camarote_alto', solid: true, draw: (p) => camarote(p, true) },
    { key: 'camarote_pie', solid: true, draw: (p) => camarotePie(p, false) },
    { key: 'camarote_alto_pie', solid: true, draw: (p) => camarotePie(p, true) },
    { key: 'pinpon_a', solid: true, draw: (p) => pinpon(p, 0) },
    { key: 'pinpon_b', solid: true, draw: (p) => pinpon(p, 1) },
    { key: 'hamaca', solid: true, draw: hamaca },
    {
      key: 'casa_meson',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d0');
        p.rect(0, 2, 16, 14, INK).rect(0, 3, 16, 12, '#c8a070').rect(0, 3, 16, 3, '#e8dcc0').rect(3, 4, 4, 1, '#8c8c98');
      },
    },
    {
      key: 'casa_estufa',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d0');
        p.rect(0, 2, 16, 14, INK).rect(1, 3, 14, 12, '#d8d8e0').rect(2, 4, 5, 4, '#3a3a48').rect(9, 4, 5, 4, '#3a3a48').rect(3, 5, 3, 2, '#e8742c');
      },
    },
    {
      key: 'casa_nevera',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d0');
        p.rect(2, 0, 12, 16, INK).rect(3, 1, 10, 14, '#f4f4f8').rect(3, 6, 10, 1, '#c8c8d0').rect(11, 3, 1, 2, '#8c8c98').rect(11, 8, 1, 3, '#8c8c98');
      },
    },
    {
      key: 'casa_mesa',
      solid: true,
      draw: (p) => {
        madera(p);
        p.rect(1, 2, 14, 12, INK).rect(2, 3, 12, 10, '#6a3c1c').rect(2, 3, 12, 2, '#8c5a34').rect(6, 6, 4, 3, '#f4f0e6');
      },
    },
    {
      key: 'casa_silla',
      solid: true,
      draw: (p) => {
        madera(p);
        p.rect(3, 2, 10, 4, INK).rect(4, 3, 8, 2, '#5a3a20').rect(3, 6, 10, 7, INK).rect(4, 7, 8, 5, '#8c5a34');
      },
    },
    {
      key: 'casa_ducha',
      solid: true,
      draw: (p) => {
        p.fill('#dceaf0');
        for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x += 5) p.rect(x, y, 4, 4, '#c8dce4');
        p.rect(6, 1, 4, 2, '#8c8c98').rect(7, 3, 2, 1, '#5a5a68');
      },
    },
    {
      key: 'casa_lavamanos',
      solid: true,
      draw: (p) => {
        p.fill('#dceaf0');
        p.rect(3, 4, 10, 8, INK).rect(4, 5, 8, 6, '#f4f4f8').rect(6, 6, 4, 3, '#c8dce4').rect(7, 2, 2, 3, '#8c8c98');
      },
    },
    {
      key: 'matera',
      solid: true,
      draw: (p) => {
        terracota(p);
        p.rect(4, 8, 8, 7, INK).rect(5, 9, 6, 5, SAL.pot);
        p.rect(3, 1, 10, 8, PAL.leafOutline).rect(4, 2, 8, 6, PAL.leaf).px(6, 3, '#e868a8').px(10, 5, PAL.flowerRed);
      },
    },
    { key: 'chiva_lado', solid: true, draw: chivaLado },
    { key: 'chiva_banca', solid: true, draw: chivaBanca },
    {
      key: 'chiva_piso',
      solid: false,
      draw: (p) => {
        madera(p);
        p.rect(0, 0, 16, 1, '#e8b828');
      },
    },
    {
      key: 'chiva_tablero',
      solid: true,
      draw: (p) => {
        p.fill('#c8303c');
        p.rect(1, 1, 14, 14, INK).rect(2, 2, 12, 12, '#9cd0f0').rect(4, 9, 8, 5, '#3a3a48').rect(6, 10, 4, 4, '#101014').px(8, 8, '#e868a8');
      },
    },
    { key: 'bar_piso', solid: false, draw: barPiso },
    { key: 'barra', solid: true, draw: barra },
    { key: 'estante_botellas', solid: true, draw: estanteBotellas },
    { key: 'taburete', solid: true, draw: taburete },
    { key: 'rocola', solid: true, draw: rocola },
    {
      key: 'bar_muro',
      solid: true,
      draw: (p) => {
        p.fill('#8c4c24');
        p.rect(0, 0, 16, 3, '#3a2418').rect(0, 13, 16, 3, '#3a2418');
        p.rect(4, 4, 8, 7, '#e8c070').rect(5, 5, 6, 5, '#1c7a44').px(7, 7, '#f4f0e6');
      },
    },
    { key: 'disco_piso', solid: false, draw: (p) => discoPiso(p, 0) },
    { key: 'disco_piso_b', solid: false, draw: (p) => discoPiso(p, 1) },
    { key: 'disco_muro', solid: true, draw: discoMuro },
    { key: 'cabina_dj', solid: true, draw: cabinaDj },
    { key: 'parlante', solid: true, draw: parlante },
    // Parque del Café
    { key: 'camino_parque', solid: false, draw: caminoParque },
    { key: 'riel_h', solid: true, draw: (p) => riel(p, false, grass) },
    { key: 'riel_v', solid: true, draw: (p) => riel(p, true, grass) },
    { key: 'soporte_krater', solid: true, draw: soporte },
    { key: 'chocones_piso', solid: true, draw: chocones },
    { key: 'chocones_borde', solid: true, draw: chocBorde },
    { key: 'taquilla_parque', solid: true, draw: taquilla },
    { key: 'show_cafe', solid: true, draw: showCafe },
    { key: 'torre_mirador', solid: true, draw: torreMirador },
    { key: 'teleferico', solid: true, draw: teleferico },
    { key: 'rapidos', solid: true, draw: (p) => rapidos(p, 0) },
    { key: 'rapidos_b', solid: true, draw: (p) => rapidos(p, 1) },
    { key: 'tren_via', solid: false, draw: trenVia },
    { key: 'kiosko_comida', solid: true, draw: kioskoComida },
    { key: 'cerca_parque', solid: true, draw: cerca },
    { key: 'guadual', solid: true, draw: (p) => guadua(p, (q) => q.fill('#5a7a3c')) },
  ];
  for (const c of Object.keys(SAL_COLORS)) {
    out.push(
      { key: `sal_puerta_${c}`, solid: true, draw: (p) => fachadaPuerta(p, c) },
      { key: `sal_ventana_${c}`, solid: true, draw: (p) => fachadaVentana(p, c) },
      { key: `sal_balcon_${c}`, solid: true, draw: (p) => balcon(p, c) },
      { key: `toldo_${c}`, solid: true, draw: (p) => toldo(p, c) },
    );
  }
  for (let v = 0; v < 6; v++) out.push({ key: `bandera_${v}`, solid: true, draw: (p) => banderas(p, v) });
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) out.push({ key: `billar_${i}${j}`, solid: true, draw: (p) => billar(p, i, j) });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out.push({ key: `rueda_${i}${j}`, solid: true, draw: (p) => bigPiece(p, i, j, ruedaDraw, grass) });
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) out.push({ key: `barco_${i}${j}`, solid: true, draw: (p) => bigPiece(p, i, j, barcoDraw, caminoParque) });
  return out;
}
