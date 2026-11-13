import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 10 («Río abajo»): el sótano del Bobo Unic Living (concreto, líneas amarillas, columnas con
 * franjas y los carros parqueados vistos desde arriba, entre ellos el carrito gris de Danilo) y el río Pance a la
 * altura del Ecoparque (agua clarita y fría sobre piedras, la corriente blanca, las playitas de piedra, el chorro
 * donde la gente se «ducha», el bosque de día, los puentes —el colgante de madera y cables— y los kioskos de
 * sancocho con su fogón de leña). Cada tile es de 16×16 px, como el resto de src/art/tiles*.ts.
 */

const INK = PAL.outline;

// ---------------------------------------------------------------------------
// El sótano del Bobo
// ---------------------------------------------------------------------------

const CONCRETO = '#5c6068';
const CONCRETO_OSCURO = '#4c5058';
const AMARILLO = '#e8c030';

function concreto(p: Painter): void {
  p.fill(CONCRETO);
  p.speckle(41, 9, CONCRETO_OSCURO).speckle(13, 5, '#6c7078');
}

function sotanoPiso(p: Painter): void {
  concreto(p);
  // Una mancha de aceite.
  p.rect(9, 10, 4, 2, '#44464e').px(10, 12, '#44464e');
}

/** Piso con la línea amarilla que separa dos puestos (va de arriba abajo, en el borde izquierdo). */
function sotanoLinea(p: Painter): void {
  concreto(p);
  p.rect(0, 0, 2, 16, AMARILLO);
}

/** Línea amarilla horizontal (el fondo de los puestos). */
function sotanoLineaH(p: Painter): void {
  concreto(p);
  p.rect(0, 14, 16, 2, AMARILLO);
}

/** Flecha blanca pintada en el piso (hacia la rampa, a la derecha). */
function sotanoFlecha(p: Painter): void {
  concreto(p);
  p.rect(3, 7, 7, 2, '#e8e8e0');
  p.pixels([[10, 5], [11, 6], [12, 7], [12, 8], [11, 9], [10, 10], [10, 6], [11, 7], [11, 8], [10, 9], [10, 7], [10, 8]], '#e8e8e0');
}

/** La rampa de salida: concreto estriado. */
function sotanoRampa(p: Painter): void {
  p.fill('#686c74');
  for (let y = 1; y < 16; y += 3) p.rect(0, y, 16, 1, '#50545c');
  p.rect(0, 0, 1, 16, AMARILLO).rect(15, 0, 1, 16, AMARILLO);
}

/** Columna de concreto con franjas amarillas y negras abajo (para que nadie la raspe... y todos la raspan). */
function sotanoColumna(p: Painter): void {
  concreto(p);
  p.rect(2, 0, 12, 16, INK).rect(3, 0, 10, 15, '#8c9098').rect(3, 0, 2, 15, '#a0a4ac');
  for (let i = 0; i < 4; i++) p.rect(3 + i * 3, 10, 2, 5, i % 2 ? '#1c1c24' : AMARILLO);
  p.rect(6, 4, 4, 2, '#e8e8e0');
}

/** El muro del sótano con un tubo y una luz de emergencia. */
function sotanoMuro(p: Painter): void {
  p.fill('#7c8088');
  p.rect(0, 12, 16, 4, '#5c6068').rect(0, 11, 16, 1, INK);
  p.rect(0, 3, 16, 3, '#a85838').rect(0, 3, 16, 1, '#c87850');
  p.rect(6, 7, 4, 2, '#f8e070');
}

/** Un carro parqueado visto desde arriba, en dos tiles (a = trompa arriba, b = cola abajo). */
function carroTop(p: Painter, color: string, dark: string, half: 'a' | 'b', withCanoa = false): void {
  concreto(p);
  if (half === 'a') {
    p.rect(2, 2, 12, 14, INK).rect(3, 3, 10, 13, color);
    p.rect(3, 3, 10, 2, dark).px(3, 3, '#f8f4ec').px(12, 3, '#f8f4ec');
    // El parabrisas y el techo.
    p.rect(4, 8, 8, 4, '#4a6a84').rect(4, 8, 8, 1, '#7c9cb4').rect(4, 12, 8, 4, dark);
    p.rect(1, 6, 1, 3, INK).rect(14, 6, 1, 3, INK);
  } else {
    p.rect(2, 0, 12, 14, INK).rect(3, 0, 10, 13, color);
    p.rect(4, 0, 8, 3, dark).rect(4, 3, 8, 4, '#4a6a84').rect(4, 3, 8, 1, '#7c9cb4');
    p.rect(3, 11, 10, 2, dark).px(3, 12, '#e84040').px(12, 12, '#e84040');
    p.rect(1, 7, 1, 3, INK).rect(14, 7, 1, 3, INK);
    if (withCanoa) p.rect(5, 8, 6, 2, '#2f6fd0').rect(5, 8, 2, 2, '#e8c030').rect(9, 8, 2, 2, '#c8303c');
  }
}

// ---------------------------------------------------------------------------
// El río Pance
// ---------------------------------------------------------------------------

const AGUA = '#3c9cac';
const AGUA_HONDA = '#2a7c94';
const AGUA_CLARA = '#7cc8c8';
const ESPUMA = '#e8f8f4';
const PIEDRA = '#9c968c';
const PIEDRA_OSCURA = '#6c665e';
const PIEDRA_CLARA = '#c8c2b4';

function ondas(p: Painter, seed: number, color: string): void {
  const s = seed % 7;
  p.rect((1 + s) % 12, 3, 4, 1, color).rect((8 + s * 2) % 12, 8, 3, 1, color).rect((4 + s * 3) % 12, 13, 4, 1, color);
}

/** El agua honda del medio: verde turquesa, fría, con ondas. No se camina (te lleva la corriente). */
function rioHondo(p: Painter, seed: number): void {
  p.fill(AGUA_HONDA);
  p.speckle(seed, 6, '#246c84');
  ondas(p, seed, '#5ab4c0');
}

/** La orilla bajita: se ven las piedritas del fondo. Se camina (con el agua a los tobillos). */
function rioBajo(p: Painter, seed: number): void {
  p.fill(AGUA);
  p.speckle(seed, 10, '#8c8a7c').speckle(seed + 9, 6, '#6c7c74');
  ondas(p, seed, AGUA_CLARA);
}

/** La corriente blanca entre las piedras. */
function rioCorriente(p: Painter, seed: number): void {
  rioHondo(p, seed);
  p.rect(1, 2, 6, 2, ESPUMA).rect(8, 6, 7, 2, ESPUMA).rect(3, 11, 5, 2, ESPUMA).rect(11, 13, 4, 1, ESPUMA);
  p.px(7, 3, '#b8e4e4').px(14, 7, '#b8e4e4');
}

/** Una piedra grande en medio del agua, con espuma alrededor. */
function rioPiedra(p: Painter, seed: number): void {
  rioHondo(p, seed);
  p.rect(2, 3, 12, 11, INK).rect(3, 4, 10, 9, PIEDRA).rect(4, 4, 6, 3, PIEDRA_CLARA).rect(3, 11, 10, 2, PIEDRA_OSCURA);
  p.rect(1, 13, 14, 2, ESPUMA).px(0, 9, ESPUMA).px(15, 8, ESPUMA);
}

/** La playita de piedras redondas de la orilla. */
function playaPiedras(p: Painter, seed: number): void {
  p.fill('#b8ae9c');
  const stones: Array<[number, number, number]> = [
    [1, 1, 3], [6, 2, 4], [12, 1, 3], [3, 6, 4], [9, 7, 3], [13, 6, 2], [1, 11, 3], [6, 12, 4], [12, 11, 3],
  ];
  stones.forEach(([x, y, w], i) => {
    const c = (i + seed) % 3 === 0 ? PIEDRA_CLARA : (i + seed) % 3 === 1 ? PIEDRA : '#a8a090';
    p.rect(x, y, w, w - 1, c).rect(x, y + w - 1, w, 1, PIEDRA_OSCURA);
  });
}

/** Un piedrón en la playa (para sentarse encima, o para tropezarse). */
function piedraGrande(p: Painter): void {
  playaPiedras(p, 3);
  p.rect(1, 2, 14, 13, INK).rect(2, 3, 12, 11, PIEDRA).rect(3, 3, 7, 4, PIEDRA_CLARA).rect(2, 12, 12, 2, PIEDRA_OSCURA);
  p.px(10, 8, PIEDRA_OSCURA).px(5, 9, PIEDRA_OSCURA);
}

/** El chorro: el agua cae de una laja de piedra. La gente se para abajo a «ducharse». */
function chorro(p: Painter): void {
  rioBajo(p, 5);
  p.rect(0, 0, 16, 6, INK).rect(0, 0, 16, 5, PIEDRA).rect(0, 0, 16, 2, PIEDRA_CLARA);
  p.rect(5, 5, 6, 9, ESPUMA).rect(6, 5, 1, 9, '#b8e4e4').rect(9, 6, 1, 8, '#b8e4e4');
  p.rect(3, 13, 10, 3, ESPUMA).px(2, 14, ESPUMA).px(13, 14, ESPUMA);
}

/** El bosque de las orillas, de día: guaduas, yarumos y sombra. */
function bosque(p: Painter, seed: number): void {
  p.fill('#2c6a34');
  p.rect(0, 0, 9, 8, '#3c8040').rect(7, 7, 9, 9, '#3c8040');
  p.rect(1, 1, 6, 4, '#5a9c4c').rect(9, 9, 5, 4, '#5a9c4c');
  p.px(3, 2, '#8cc468').px(11, 10, '#8cc468').px(seed % 14, 14, '#1c4a24');
  p.rect(13, 1, 2, 2, '#c8e0a0');
}

function pastoRio(p: Painter, seed: number): void {
  p.fill('#5aa04a');
  p.speckle(seed, 8, '#4a8c3c').speckle(seed + 5, 4, '#7cbc5c');
  if (seed % 2) p.px(4, 11, '#f8dc68').px(12, 4, '#e868a8');
}

/** Sendero de tierra entre el pasto (mojado de tanta gente que sube y baja del río). */
function sendero(p: Painter): void {
  p.fill('#a07c54');
  p.speckle(23, 8, '#8c6a44').speckle(5, 5, '#b89068');
}

/** El puente colgante (va de norte a sur): tablas, los cables de los costados y las tablas que faltan. */
function puenteColgante(p: Painter, seed: number): void {
  rioHondo(p, seed);
  p.rect(2, 0, 12, 16, INK);
  for (let y = 0; y < 16; y += 3) p.rect(3, y, 10, 2, (y + seed) % 9 === 0 ? '#8c6a44' : '#b08a5c').rect(3, y + 2, 10, 1, '#5a3a20');
  if (seed % 3 === 0) p.rect(3, 6, 10, 2, AGUA_HONDA);
  p.rect(1, 0, 1, 16, '#c8ccd4').rect(14, 0, 1, 16, '#c8ccd4');
  p.rect(0, 4, 2, 1, '#8c9098').rect(14, 11, 2, 1, '#8c9098');
}

/** Las torres de los extremos del puente colgante: dos troncos con los cables amarrados. */
function puenteTorre(p: Painter): void {
  playaPiedras(p, 1);
  p.rect(1, 0, 4, 16, INK).rect(2, 0, 2, 15, '#7a5432');
  p.rect(11, 0, 4, 16, INK).rect(12, 0, 2, 15, '#7a5432');
  p.rect(3, 2, 10, 1, '#c8ccd4').rect(3, 4, 10, 1, '#8c9098');
}

/** El puente de madera del Ecoparque (el de todo el mundo, firme y con baranda). */
function puenteMadera(p: Painter): void {
  p.fill('#9c7448');
  for (let y = 0; y < 16; y += 4) p.rect(0, y + 3, 16, 1, '#7a5432');
  p.rect(0, 0, 2, 16, '#5a3a20').rect(14, 0, 2, 16, '#5a3a20');
}

/** El puente de concreto de la trocha (el de los carros del Ecoparque). */
function puenteConcreto(p: Painter): void {
  p.fill('#a8a8a0');
  p.speckle(17, 6, '#909088');
  p.rect(0, 0, 2, 16, '#787870').rect(14, 0, 2, 16, '#787870');
}

/** Kiosko de techo de paja con su mostrador (el de doña Rubiela no: el de doña Fanny). */
function kiosko(p: Painter): void {
  pastoRio(p, 2);
  p.rect(0, 0, 16, 9, INK).rect(1, 0, 14, 8, '#c8a050');
  for (let x = 1; x < 15; x += 3) p.rect(x, 1, 1, 7, '#a07c3c');
  p.rect(1, 9, 14, 6, INK).rect(2, 9, 12, 5, '#8c5a34').rect(2, 9, 12, 1, '#a87444');
}

/** Fogón de leña con la olla de sancocho humeando. */
function fogon(p: Painter): void {
  sendero(p);
  p.rect(1, 8, 14, 7, INK).rect(2, 9, 12, 5, '#8c5a3c').rect(4, 12, 8, 2, '#e8742c').px(6, 12, '#f8dc68').px(9, 13, '#f8dc68');
  p.rect(3, 2, 10, 7, INK).rect(4, 3, 8, 5, '#3a3a44').rect(4, 3, 8, 1, '#686874');
  p.px(6, 0, '#d8d8e0').px(8, 1, '#d8d8e0').px(10, 0, '#d8d8e0');
}

/** Mesa rústica de tablones. */
function mesaMadera(p: Painter): void {
  pastoRio(p, 3);
  p.rect(1, 3, 14, 9, INK).rect(2, 4, 12, 7, '#a07448').rect(2, 7, 12, 1, '#7a5432');
  p.rect(2, 12, 2, 3, INK).rect(12, 12, 2, 3, INK);
}

/** Tronco caído que hace de banca. */
function tronco(p: Painter): void {
  pastoRio(p, 1);
  p.rect(0, 5, 16, 7, INK).rect(0, 6, 16, 5, '#7a5432').rect(0, 6, 16, 1, '#9c7448');
  p.rect(13, 6, 3, 5, '#c8a070').px(14, 8, '#7a5432');
}

/** Letrero de madera del Ecoparque (el texto lo pone el mapa con un label). */
function letreroRio(p: Painter): void {
  pastoRio(p, 4);
  p.rect(1, 2, 14, 8, INK).rect(2, 3, 12, 6, '#7a5432').rect(3, 4, 10, 1, '#c8a070').rect(3, 6, 8, 1, '#c8a070');
  p.rect(7, 10, 2, 6, INK);
}

/** La torre de avistamiento (de madera, con escalera). */
function torreAvistamiento(p: Painter): void {
  pastoRio(p, 5);
  p.rect(1, 0, 14, 16, INK).rect(2, 1, 12, 5, '#8c5a34').rect(2, 1, 12, 1, '#a87444');
  p.rect(3, 6, 2, 10, '#7a5432').rect(11, 6, 2, 10, '#7a5432');
  for (let y = 7; y < 16; y += 3) p.rect(5, y, 6, 1, '#a07448');
}

/** La talanquera de la entrada del Ecoparque (franjas rojas y blancas). */
function talanquera(p: Painter): void {
  sendero(p);
  p.rect(0, 6, 16, 4, INK);
  for (let x = 0; x < 16; x += 4) p.rect(x, 7, 2, 2, '#c8303c').rect(x + 2, 7, 2, 2, '#f4f0e6');
}

export function m10Tiles(): TileDef[] {
  return [
    { key: 'sotano_piso', solid: false, draw: sotanoPiso },
    { key: 'sotano_linea', solid: false, draw: sotanoLinea },
    { key: 'sotano_linea_h', solid: false, draw: sotanoLineaH },
    { key: 'sotano_flecha', solid: false, draw: sotanoFlecha },
    { key: 'sotano_rampa', solid: false, draw: sotanoRampa },
    { key: 'sotano_columna', solid: true, draw: sotanoColumna },
    { key: 'sotano_muro', solid: true, draw: sotanoMuro },
    { key: 'carro_rojo_a', solid: true, draw: (p) => carroTop(p, '#c8303c', '#8c1c28', 'a') },
    { key: 'carro_rojo_b', solid: true, draw: (p) => carroTop(p, '#c8303c', '#8c1c28', 'b') },
    { key: 'carro_blanco_a', solid: true, draw: (p) => carroTop(p, '#e8e8e0', '#b8b8b0', 'a') },
    { key: 'carro_blanco_b', solid: true, draw: (p) => carroTop(p, '#e8e8e0', '#b8b8b0', 'b') },
    { key: 'carro_azul_a', solid: true, draw: (p) => carroTop(p, '#2c64c0', '#1c4488', 'a') },
    { key: 'carro_azul_b', solid: true, draw: (p) => carroTop(p, '#2c64c0', '#1c4488', 'b') },
    { key: 'carro_danilo_a', solid: true, draw: (p) => carroTop(p, '#8c9098', '#686c74', 'a') },
    { key: 'carro_danilo_b', solid: true, draw: (p) => carroTop(p, '#8c9098', '#686c74', 'b', true) },
    { key: 'rio_hondo', solid: true, draw: (p) => rioHondo(p, 3) },
    { key: 'rio_hondo_b', solid: true, draw: (p) => rioHondo(p, 11) },
    { key: 'rio_bajo', solid: false, draw: (p) => rioBajo(p, 4) },
    { key: 'rio_bajo_b', solid: false, draw: (p) => rioBajo(p, 17) },
    { key: 'rio_corriente', solid: true, draw: (p) => rioCorriente(p, 6) },
    { key: 'rio_piedra', solid: true, draw: (p) => rioPiedra(p, 8) },
    { key: 'playa_piedras', solid: false, draw: (p) => playaPiedras(p, 0) },
    { key: 'playa_piedras_b', solid: false, draw: (p) => playaPiedras(p, 1) },
    { key: 'piedra_grande', solid: true, draw: piedraGrande },
    { key: 'chorro', solid: true, draw: chorro },
    { key: 'bosque_pance', solid: true, draw: (p) => bosque(p, 3) },
    { key: 'bosque_pance_b', solid: true, draw: (p) => bosque(p, 9) },
    { key: 'pasto_rio', solid: false, draw: (p) => pastoRio(p, 2) },
    { key: 'pasto_rio_b', solid: false, draw: (p) => pastoRio(p, 7) },
    { key: 'sendero_rio', solid: false, draw: sendero },
    { key: 'puente_colgante', solid: false, draw: (p) => puenteColgante(p, 1) },
    { key: 'puente_colgante_b', solid: false, draw: (p) => puenteColgante(p, 3) },
    { key: 'puente_torre', solid: true, draw: puenteTorre },
    { key: 'puente_madera_rio', solid: false, draw: puenteMadera },
    { key: 'puente_concreto', solid: false, draw: puenteConcreto },
    { key: 'kiosko_pance', solid: true, draw: kiosko },
    { key: 'fogon_lena', solid: true, draw: fogon },
    { key: 'mesa_madera', solid: true, draw: mesaMadera },
    { key: 'tronco_banca', solid: true, draw: tronco },
    { key: 'letrero_rio', solid: true, draw: letreroRio },
    { key: 'torre_avistamiento', solid: true, draw: torreAvistamiento },
    { key: 'talanquera', solid: true, draw: talanquera },
  ];
}
