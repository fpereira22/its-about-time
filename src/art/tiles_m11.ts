import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 10 (prefijo m11_): la Chorrera del Indio (la pared de roca negra y mojada con musgo, la
 * cortina de agua que cae y la espuma del pozo), el paso de piedras planas para cruzar el río, el barro del
 * sendero de la loma, el piso del balcón del 1104 y la bandera de Chile del Al Toque. 16×16 px.
 */

const INK = PAL.outline;
const ROCA = '#2e3034';
const ROCA_CLARA = '#44484e';
const MUSGO = '#3c6a34';
const AGUA = '#2a7c94';
const ESPUMA = '#e8f6f8';

/** La pared de la cascada: roca casi negra, mojada, con musgo y helechos. */
function rocaCascada(p: Painter, seed: number): void {
  p.fill(ROCA);
  p.speckle(seed, 10, ROCA_CLARA).speckle(seed + 3, 6, '#1c1e22');
  p.rect(seed % 9, 2, 5, 2, MUSGO).rect((seed * 3) % 11, 10, 4, 2, MUSGO).px((seed * 5) % 15, 6, '#5a9c4c');
  p.rect(0, 15, 16, 1, '#1c1e22');
}

/** La cortina de agua que cae (vertical). */
function cascada(p: Painter, seed: number): void {
  p.fill('#cfe8f0');
  for (let x = 0; x < 16; x += 3) p.rect(x + (seed % 2), 0, 1, 16, '#a8d4e4');
  p.rect((seed * 5) % 14, (seed * 3) % 12, 2, 4, ESPUMA).rect((seed * 7) % 13, (seed * 11) % 10, 1, 5, '#ffffff');
  p.rect(0, 0, 1, 16, '#8cc0d4').rect(15, 0, 1, 16, '#8cc0d4');
}

/** La espuma blanca donde la Chorrera golpea el pozo. */
function espuma(p: Painter, seed: number): void {
  p.fill(AGUA);
  p.speckle(seed, 26, ESPUMA).speckle(seed + 7, 10, '#ffffff');
  p.rect(2, 5, 12, 6, '#d8eef4').rect(4, 3, 7, 2, ESPUMA);
}

/** Paso de piedras: una laja plana en medio del agua (se camina encima). */
function pasoPiedras(p: Painter, seed: number): void {
  p.fill(AGUA);
  p.speckle(seed, 6, '#246c84');
  p.rect(2, 3, 12, 10, INK).rect(3, 4, 10, 8, '#9c968c').rect(4, 4, 6, 3, '#c8c2b4');
  p.rect(1, 12, 3, 1, ESPUMA).rect(12, 3, 3, 1, ESPUMA);
}

/** Barro del sendero de la loma (mojado, con huellas). */
function barro(p: Painter, seed: number): void {
  p.fill('#7a5a38');
  p.speckle(seed, 10, '#6a4a2c').speckle(seed + 4, 5, '#8c6a44');
  p.rect(4, 4, 2, 3, '#5a3e24').rect(9, 9, 2, 3, '#5a3e24');
}

/** Baldosa del balcón del 1104 (terracota). */
function balcon(p: Painter): void {
  p.fill('#b86a44');
  p.rect(0, 0, 16, 1, '#9c5434').rect(0, 0, 1, 16, '#9c5434').rect(8, 0, 1, 16, '#a85c3c').rect(0, 8, 16, 1, '#a85c3c');
}

/** La bandera de Chile en la pared de madera del Al Toque. */
function banderaChile(p: Painter): void {
  p.fill('#c89c6c');
  p.rect(0, 0, 16, 1, '#b08858');
  p.rect(1, 3, 14, 10, INK).rect(2, 4, 12, 4, '#f4f0e6').rect(2, 8, 12, 4, '#d42c2c').rect(2, 4, 5, 4, '#1c3c9c').px(4, 5, '#f4f0e6');
}

/** Pizarra del menú del Al Toque. */
function menuPato(p: Painter): void {
  p.fill('#c89c6c');
  p.rect(1, 2, 14, 12, INK).rect(2, 3, 12, 10, '#2a3a2c');
  for (let y = 5; y < 12; y += 2) p.rect(3, y, 6 + (y % 3) * 2, 1, '#f4f0e6');
  p.rect(10, 4, 3, 1, '#f8dc68');
}

export function m11Tiles(): TileDef[] {
  return [
    { key: 'roca_cascada', solid: true, draw: (p) => rocaCascada(p, 3) },
    { key: 'roca_cascada_b', solid: true, draw: (p) => rocaCascada(p, 8) },
    { key: 'cascada', solid: true, draw: (p) => cascada(p, 1) },
    { key: 'cascada_b', solid: true, draw: (p) => cascada(p, 4) },
    { key: 'espuma', solid: true, draw: (p) => espuma(p, 5) },
    { key: 'paso_piedras', solid: false, draw: (p) => pasoPiedras(p, 7) },
    { key: 'barro', solid: false, draw: (p) => barro(p, 11) },
    { key: 'balcon_piso', solid: false, draw: balcon },
    { key: 'bandera_chile', solid: true, draw: banderaChile },
    { key: 'menu_pato', solid: true, draw: menuPato },
  ];
}
