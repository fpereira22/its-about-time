import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 9 (la fiesta en la casa de Tami, arriba de Cristo Rey): el deck del patio con la pérgola de
 * madera y sus postes, la mesa de beer pong con los vasos rojos, la mesa del cacho, el monte del cerro de noche y la
 * carretera destapada que sube a Cristo Rey. Cada tile es de 16×16 px, como el resto de src/art/tiles*.ts.
 */

const INK = PAL.outline;
const DECK = '#a87c54';
const DECK_DARK = '#86603c';
const BEAM = '#5a3a20';
const BEAM_LIGHT = '#7a5432';

function deck(p: Painter): void {
  p.fill(DECK);
  for (const y of [3, 7, 11, 15]) p.rect(0, y, 16, 1, DECK_DARK);
  p.rect(5, 0, 1, 3, DECK_DARK).rect(12, 4, 1, 3, DECK_DARK).rect(3, 8, 1, 3, DECK_DARK).rect(10, 12, 1, 3, DECK_DARK);
}

/** El deck bajo la pérgola: las vigas hacen sombra en franjas. */
function pergola(p: Painter): void {
  deck(p);
  p.rect(0, 0, 16, 2, 'rgba(20,16,30,0.35)').rect(0, 8, 16, 2, 'rgba(20,16,30,0.35)');
  p.rect(7, 0, 2, 16, 'rgba(20,16,30,0.25)');
}

/** Un poste de la pérgola sobre el deck, con la viga arriba y una guirnalda. */
function pergolaPoste(p: Painter): void {
  pergola(p);
  p.rect(5, 1, 6, 15, INK).rect(6, 1, 4, 14, BEAM).rect(6, 1, 1, 14, BEAM_LIGHT);
  p.rect(0, 0, 16, 3, INK).rect(0, 0, 16, 2, BEAM).rect(0, 0, 16, 1, BEAM_LIGHT);
  for (const [x, c] of [[1, '#f8dc68'], [13, '#e868a8']] as const) p.rect(x, 4, 2, 2, c);
}

/** La mesa de beer pong (dos tiles a lo ancho): azul, con los triángulos de vasos rojos en cada punta. */
function beerpong(p: Painter, half: 0 | 1): void {
  deck(p);
  p.rect(0, 3, 16, 10, INK).rect(half === 0 ? 1 : 0, 4, 15, 8, '#2c64c0').rect(half === 0 ? 1 : 0, 4, 15, 1, '#5a90e8');
  if (half === 0) p.rect(15, 4, 1, 8, '#f4f0e6');
  const cups: Array<[number, number]> = half === 0 ? [[2, 5], [2, 9], [5, 7]] : [[11, 7], [14, 5], [14, 9]];
  for (const [x, y] of cups) p.rect(x - 1, y - 1, 3, 3, INK).px(x, y, '#d8283c');
  p.rect(half === 0 ? 2 : 3, 13, 2, 3, INK).rect(half === 0 ? 12 : 11, 13, 2, 3, INK);
}

/** La mesa del cacho: madera con un cubilete de cuero y dos dados. */
function mesaCacho(p: Painter): void {
  deck(p);
  p.rect(1, 2, 14, 11, INK).rect(2, 3, 12, 9, '#8c5a34').rect(2, 3, 12, 1, '#a87444');
  p.rect(4, 4, 4, 5, INK).rect(5, 5, 2, 3, '#5a2a18');
  p.rect(9, 7, 3, 3, '#f8f4ec').px(10, 8, INK).rect(11, 4, 2, 2, '#f8f4ec');
  p.rect(2, 13, 2, 3, INK).rect(12, 13, 2, 3, INK);
}

/** El monte del cerro de noche: árboles oscuros y pasto alto. */
function monte(p: Painter): void {
  p.fill('#1c3a24');
  p.rect(0, 0, 9, 9, '#14301c').rect(7, 6, 9, 10, '#14301c');
  p.rect(1, 1, 6, 5, '#28502e').rect(9, 8, 5, 5, '#28502e').px(3, 2, '#3c6a3c').px(11, 9, '#3c6a3c');
}

/** La carretera destapada que sube a Cristo Rey (tierra con piedritas). */
function trocha(p: Painter): void {
  p.fill('#8c7454');
  p.speckle(19, 10, '#6c5a40').speckle(7, 6, '#a89070');
  p.rect(0, 7, 16, 1, '#7c6648');
}

/** El portón de la casa de Tami: reja negra con una lucecita. */
function porton(p: Painter): void {
  p.fill('#8c7454');
  p.rect(0, 2, 16, 13, INK);
  for (let x = 1; x < 16; x += 3) p.rect(x, 3, 2, 11, '#3a3a44');
  p.rect(0, 2, 16, 2, '#4a4a54').rect(7, 5, 2, 2, '#f8dc68');
}

export function m9Tiles(): TileDef[] {
  return [
    { key: 'deck_tami', solid: false, draw: deck },
    { key: 'pergola', solid: false, draw: pergola },
    { key: 'pergola_poste', solid: true, draw: pergolaPoste },
    { key: 'beerpong_a', solid: true, draw: (p) => beerpong(p, 0) },
    { key: 'beerpong_b', solid: true, draw: (p) => beerpong(p, 1) },
    { key: 'mesa_cacho', solid: true, draw: mesaCacho },
    { key: 'monte', solid: true, draw: monte },
    { key: 'trocha_cristo', solid: false, draw: trocha },
    { key: 'porton', solid: false, draw: porton },
  ];
}
