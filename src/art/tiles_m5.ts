import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 5 (un martes en Cali): la Barbería 360 (Ciudad Pacífica), el barrio de la ruta
 * a pie desde la U (Carrera 121 / Carrera 120), el Centro Deportivo de la PUCC (el «GLD», con la piscina) y la hamburguesería de Pance.
 * Cada tile es de 16×16 px y se dibuja con rectángulos (como el resto de src/art/tiles.ts).
 */

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

function grass(p: Painter): void {
  p.fill(PAL.grass);
  for (const [x, y] of [[2, 3], [10, 2], [6, 8], [12, 11], [2, 12]] as const) p.rect(x, y, 1, 2, PAL.grassDark).px(x + 1, y + 1, PAL.grassDark);
  p.px(8, 13, PAL.grassLight).px(13, 6, PAL.grassLight);
}

const BARBER = {
  black: '#1c1c24',
  white: '#ecebe4',
  wall: '#262838',
  wallDark: '#1a1b28',
  trim: '#d8a838',
  trimDark: '#a07820',
  neon: '#38e0d8',
  neonPink: '#f05aa0',
  leather: '#b02838',
  leatherDark: '#7c1828',
  chrome: '#c8ccd4',
  chromeDark: '#7c808c',
};

function checker(p: Painter): void {
  p.fill(BARBER.white);
  p.rect(0, 0, 8, 8, BARBER.black).rect(8, 8, 8, 8, BARBER.black);
  p.px(2, 10, '#d4d2ca').px(12, 3, '#34343e');
}

function barberWall(p: Painter): void {
  p.fill(BARBER.wall);
  p.rect(0, 0, 16, 1, BARBER.wallDark).rect(0, 11, 16, 1, BARBER.trim).rect(0, 12, 16, 4, '#30324a').rect(0, 15, 16, 1, BARBER.wallDark);
  // Rayitas de papel mural.
  for (let x = 2; x < 16; x += 5) p.rect(x, 1, 1, 10, '#2c2e42');
}

const POOL = {
  water: '#2a9ad8',
  waterDeep: '#1c78c0',
  waterLight: '#6cc8f0',
  shine: '#b8ecff',
  line: '#123c78',
  deck: '#d8d4c8',
  deckDark: '#b8b2a4',
  deckLight: '#ece8e0',
  tile: '#f4f2ea',
  wet: '#c4c8c4',
};

function poolWater(p: Painter, deep = false): void {
  p.fill(deep ? POOL.waterDeep : POOL.water);
  // Destellos de la luz en el fondo (cáusticas).
  p.rect(2, 3, 4, 1, POOL.waterLight).rect(9, 9, 5, 1, POOL.waterLight).rect(11, 2, 2, 1, POOL.shine).rect(4, 12, 3, 1, POOL.waterLight);
  p.px(6, 6, POOL.shine).px(14, 13, POOL.shine);
}

function poolDeck(p: Painter): void {
  p.fill(POOL.deck);
  p.rect(0, 7, 16, 1, POOL.deckDark).rect(0, 15, 16, 1, POOL.deckDark).rect(7, 0, 1, 7, POOL.deckDark).rect(15, 8, 1, 7, POOL.deckDark);
  p.rect(1, 1, 3, 1, POOL.deckLight).rect(9, 9, 3, 1, POOL.deckLight);
}

const BURGER = {
  wood: '#6a4228',
  woodDark: '#4c2c18',
  woodLight: '#8a5a38',
  brick: '#a8503a',
  brickDark: '#7c3424',
  mortar: '#c8a890',
  table: '#a87040',
  tableDark: '#7c4c28',
  tableLight: '#c8905c',
};

function burgerFloor(p: Painter): void {
  // Tablas anchas de madera clara, con la veta y los clavos (que no se confunda con el ladrillo del muro).
  p.fill('#b07a4a');
  p.rect(0, 7, 16, 1, '#8a5a34').rect(0, 15, 16, 1, '#8a5a34');
  p.rect(10, 0, 1, 7, '#8a5a34').rect(4, 8, 1, 7, '#8a5a34');
  p.rect(1, 2, 6, 1, '#c08a58').rect(12, 4, 3, 1, '#c08a58').rect(6, 11, 7, 1, '#c08a58');
  p.px(2, 5, '#6a4228').px(13, 13, '#6a4228');
}

function brickWall(p: Painter): void {
  p.fill(BURGER.mortar);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let x = -4; x < 16; x += 8) p.rect(x + off, row * 4, 7, 3, row % 2 ? BURGER.brick : BURGER.brickDark);
  }
  p.rect(0, 14, 16, 2, '#4c2c18');
}

/** Bombillos de una guirnalda colgando arriba del muro. */
function bulbs(p: Painter): void {
  p.rect(0, 1, 16, 1, '#3a3028');
  for (const x of [2, 7, 12]) p.rect(x, 2, 2, 2, '#f8d878').px(x, 2, '#fff4c0');
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export function m5Tiles(): TileDef[] {
  return [
    // --- Barbería 360 ---
    { key: 'barber_piso', solid: false, draw: checker },
    { key: 'barber_muro', solid: true, draw: barberWall },
    {
      key: 'barber_espejo',
      solid: true,
      draw: (p) => {
        barberWall(p);
        // Espejo con marco dorado y bombillos de camerino.
        p.rect(2, 1, 12, 10, BARBER.trim).rect(3, 2, 10, 8, '#a8c8d8').rect(4, 3, 3, 1, '#e0f0f8').rect(9, 6, 2, 1, '#e0f0f8');
        for (const [x, y] of [[1, 1], [14, 1], [1, 5], [14, 5], [1, 9], [14, 9]] as const) p.rect(x, y, 1, 1, '#fff2b0');
      },
    },
    {
      key: 'barber_silla',
      solid: true,
      draw: (p) => {
        checker(p);
        // Sillón de barbero de cuero rojo mirando al espejo (arriba): apoyapiés cromado adelante,
        // el asiento al medio y el respaldo alto abajo, con su base de bomba hidráulica.
        p.rect(4, 0, 8, 2, BARBER.chromeDark).rect(5, 0, 6, 1, BARBER.chrome);
        p.rect(3, 3, 10, 12, PAL.outline).rect(4, 4, 8, 6, BARBER.leather).rect(4, 10, 8, 4, BARBER.leatherDark);
        p.rect(2, 5, 2, 5, BARBER.chrome).rect(12, 5, 2, 5, BARBER.chrome).rect(5, 5, 1, 4, '#d04858').rect(6, 14, 4, 2, BARBER.chrome);
      },
    },
    {
      key: 'barber_mostrador',
      solid: true,
      draw: (p) => {
        checker(p);
        p.rect(0, 2, 16, 12, PAL.outline).rect(0, 3, 16, 10, '#3a3c54').rect(0, 3, 16, 2, BARBER.trim);
        // Caja registradora y un frasco de dulces.
        p.rect(2, 0, 6, 4, '#4a4c5c').rect(3, 1, 4, 1, '#58e078');
        p.rect(11, 0, 3, 4, '#c8e8f0').px(12, 1, '#e84868').px(12, 2, '#f0c030');
      },
    },
    {
      key: 'barber_estante',
      solid: true,
      draw: (p) => {
        barberWall(p);
        p.rect(1, 3, 14, 1, BARBER.trimDark).rect(1, 8, 14, 1, BARBER.trimDark);
        // Ceras, lociones y una botella de colonia de tamaño sospechoso.
        p.rect(2, 1, 2, 2, '#e8b030').rect(5, 0, 2, 3, '#3c8ce0').rect(8, 1, 3, 2, '#e0e0e8').rect(12, 0, 2, 3, '#58c070');
        p.rect(2, 5, 3, 3, '#202028').rect(6, 6, 2, 2, '#e85a5a').rect(9, 4, 2, 4, '#c89048').rect(12, 5, 2, 3, '#a060d0');
      },
    },
    {
      key: 'barber_sofa',
      solid: true,
      draw: (p) => {
        checker(p);
        p.rect(0, 2, 16, 12, PAL.outline).rect(0, 3, 16, 3, '#4a3c34').rect(0, 6, 16, 6, '#6a5446').rect(7, 6, 1, 6, '#4a3c34');
        p.rect(1, 7, 5, 1, '#7c6656').rect(9, 7, 5, 1, '#7c6656');
      },
    },
    {
      key: 'barber_poster',
      solid: true,
      draw: (p) => {
        barberWall(p);
        // Mapamundi con alfileres: «Fredy en el mundo».
        p.rect(1, 1, 14, 9, '#e8dcb8').rect(2, 2, 12, 7, '#7ab8d8');
        p.rect(3, 3, 3, 3, '#6aa858').rect(4, 6, 2, 2, '#6aa858').rect(8, 2, 2, 3, '#6aa858').rect(9, 5, 2, 3, '#6aa858').rect(11, 3, 2, 2, '#6aa858');
        p.px(4, 4, '#e83838').px(5, 7, '#e83838').px(9, 3, '#e83838').px(10, 6, '#e83838').px(12, 4, '#e83838');
      },
    },
    {
      key: 'barber_fotos',
      solid: true,
      draw: (p) => {
        barberWall(p);
        p.rect(1, 2, 6, 5, BARBER.trim).rect(2, 3, 4, 3, '#f0a868').px(3, 4, '#3a2418').px(4, 4, '#3a2418');
        p.rect(9, 1, 6, 6, BARBER.trim).rect(10, 2, 4, 4, '#8ab8e0').rect(11, 3, 2, 3, '#3a2418');
        p.rect(4, 8, 5, 3, BARBER.trim).rect(5, 9, 3, 1, '#e8e0d0');
      },
    },
    {
      key: 'barber_parlante',
      solid: true,
      draw: (p) => {
        checker(p);
        p.rect(3, 0, 10, 15, PAL.outline).rect(4, 1, 8, 13, '#30303c');
        p.rect(5, 2, 6, 5, '#18181e').rect(6, 3, 4, 3, '#50505c').rect(7, 4, 2, 1, '#18181e');
        p.rect(5, 8, 6, 5, '#18181e').rect(6, 9, 4, 3, '#50505c').rect(7, 10, 2, 1, '#18181e');
        p.px(11, 1, BARBER.neon);
      },
    },
    {
      key: 'barber_tv',
      solid: true,
      draw: (p) => {
        barberWall(p);
        p.rect(1, 1, 14, 9, '#101014').rect(2, 2, 12, 7, '#3aa848').rect(2, 5, 12, 1, '#e8f0e8').rect(7, 2, 1, 7, '#e8f0e8');
        p.px(5, 3, '#e84040').px(10, 6, '#f8f8f8').px(9, 4, '#3060d0');
      },
    },
    {
      key: 'barber_neon',
      solid: true,
      draw: (p) => {
        barberWall(p);
        // «360» en neón celeste con un círculo rosado.
        p.rect(1, 2, 14, 8, '#14141e');
        for (const [x, w] of [[3, 3], [7, 3], [11, 3]] as const) p.rect(x, 3, w, 1, BARBER.neon).rect(x, 6, w, 1, BARBER.neon).rect(x, 8, w, 1, BARBER.neon);
        p.rect(5, 3, 1, 6, BARBER.neon).rect(7, 3, 1, 6, BARBER.neon).rect(11, 3, 1, 6, BARBER.neon).rect(13, 3, 1, 6, BARBER.neon).rect(9, 6, 1, 3, BARBER.neon);
        p.px(14, 2, BARBER.neonPink).px(15, 3, BARBER.neonPink);
      },
    },
    {
      key: 'barber_vitrina',
      solid: true,
      draw: (p) => {
        barberWall(p);
        p.rect(1, 1, 14, 10, '#88a8c0').rect(2, 2, 12, 8, '#a8c8dc').rect(3, 3, 2, 5, '#c8e0ec');
        p.rect(1, 6, 14, 1, '#d8a838');
      },
    },
    {
      key: 'barber_puerta',
      solid: false,
      draw: (p) => {
        checker(p);
        p.rect(0, 0, 16, 3, '#d8a838').rect(2, 0, 12, 2, '#88a8c0');
      },
    },
    {
      key: 'barber_planta',
      solid: true,
      draw: (p) => {
        checker(p);
        p.rect(5, 10, 6, 5, '#c8704c').rect(5, 10, 6, 1, '#dc8c64');
        p.rect(3, 3, 4, 7, '#2a8a3c').rect(9, 2, 4, 8, '#3c9c48').rect(6, 0, 4, 10, '#4cae58').rect(7, 1, 1, 8, '#2a6a34');
      },
    },
    {
      key: 'barber_lavacabezas',
      solid: true,
      draw: (p) => {
        checker(p);
        p.rect(1, 1, 14, 12, PAL.outline).rect(2, 2, 12, 10, '#f0f0f0').rect(4, 4, 8, 6, '#c8d8e0').rect(7, 6, 2, 2, '#7c808c');
        p.rect(12, 0, 2, 3, BARBER.chrome);
      },
    },

    // --- Barrio: ruta a pie de la U a Ciudad Pacífica ---
    {
      key: 'separador',
      solid: false,
      draw: (p) => {
        grass(p);
        p.rect(0, 0, 1, 16, '#d8d4c8').rect(15, 0, 1, 16, '#d8d4c8');
      },
    },
    {
      key: 'autocine_pantalla',
      solid: true,
      draw: (p) => {
        grass(p);
        p.rect(0, 1, 16, 12, '#4a4c56').rect(0, 2, 16, 10, '#f4f4f0').rect(0, 12, 16, 1, '#6a6c78');
        p.rect(2, 14, 1, 2, '#4a4c56').rect(13, 14, 1, 2, '#4a4c56');
      },
    },
    {
      key: 'autocine_parqueo',
      solid: false,
      draw: (p) => {
        p.fill('#8a8478').speckle(12, 9, '#7a7468').speckle(31, 5, '#9a9488');
        p.rect(0, 15, 16, 1, '#f0f0e8');
      },
    },
    {
      key: 'reja_verde',
      solid: true,
      draw: (p) => {
        grass(p);
        p.rect(0, 5, 16, 1, '#2a5a3c').rect(0, 12, 16, 1, '#2a5a3c');
        for (let x = 1; x < 16; x += 3) p.rect(x, 3, 1, 11, '#2a5a3c').px(x, 2, '#3c7c50');
      },
    },
    {
      key: 'garza',
      solid: true,
      draw: (p) => {
        // Agua del lago El Retiro con una garza blanca parada en una pata.
        p.fill(PAL.water).rect(2, 13, 6, 1, PAL.waterLight).rect(10, 4, 4, 1, PAL.waterLight);
        p.rect(7, 4, 4, 5, '#f8f8f4').rect(10, 1, 2, 4, '#f8f8f4').rect(12, 2, 2, 1, '#e8c048').rect(8, 9, 1, 4, '#3a3a40').px(11, 2, '#202028');
      },
    },
    {
      key: 'mural_barrio',
      solid: true,
      draw: (p) => {
        p.fill('#f0d070');
        // Mural de una mujer con flores en el pelo y una palma.
        p.rect(0, 10, 16, 6, '#3c9c8c').rect(2, 2, 6, 8, '#c86a3c').rect(3, 3, 4, 3, '#2a1c18').px(4, 5, '#f8f8f0').px(6, 5, '#f8f8f0');
        p.rect(1, 1, 2, 2, '#e84868').rect(6, 1, 2, 2, '#f08838').rect(11, 3, 1, 10, '#6a4a30').rect(9, 2, 6, 2, '#3c9c48');
      },
    },
    {
      key: 'adoquin_rojo',
      solid: false,
      draw: (p) => {
        p.fill('#b86848');
        for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) p.rect(x, y, 7, 3, '#c87858');
        p.rect(0, 3, 16, 1, '#985038').rect(0, 11, 16, 1, '#985038');
      },
    },

    // --- La piscina (Centro Deportivo de la PUCC) ---
    { key: 'piso_piscina', solid: false, draw: poolDeck },
    {
      key: 'piso_mojado',
      solid: false,
      draw: (p) => {
        poolDeck(p);
        p.rect(3, 4, 5, 2, POOL.wet).rect(9, 11, 4, 2, POOL.wet).px(5, 4, '#e0f0f8');
      },
    },
    { key: 'agua_piscina', solid: true, draw: (p) => poolWater(p) },
    {
      key: 'agua_linea',
      solid: true,
      draw: (p) => {
        poolWater(p);
        // La línea negra del fondo que guía a los nadadores (de oriente a poniente).
        p.rect(0, 7, 16, 2, POOL.line);
      },
    },
    {
      key: 'agua_corchera',
      solid: true,
      draw: (p) => {
        poolWater(p);
        // Corchera: flotadores rojos, blancos y azules ensartados.
        for (let x = 0; x < 16; x += 4) p.rect(x, 6, 4, 4, PAL.outline).rect(x, 7, 3, 2, x % 8 ? '#f4f4f0' : '#d83838');
        p.rect(0, 8, 16, 1, '#2050a8');
      },
    },
    { key: 'agua_fosa', solid: true, draw: (p) => poolWater(p, true) },
    {
      key: 'borde_piscina',
      solid: false,
      draw: (p) => {
        poolDeck(p);
        p.rect(0, 12, 16, 4, POOL.tile).rect(0, 12, 16, 1, '#ffffff').rect(0, 15, 16, 1, '#8ab8c8');
        for (let x = 3; x < 16; x += 4) p.px(x, 14, '#c8d0d0');
      },
    },
    {
      key: 'borde_piscina_s',
      solid: false,
      draw: (p) => {
        poolDeck(p);
        p.rect(0, 0, 16, 4, POOL.tile).rect(0, 3, 16, 1, '#ffffff').rect(0, 0, 16, 1, '#8ab8c8');
      },
    },
    {
      key: 'partidor',
      solid: true,
      draw: (p) => {
        poolDeck(p);
        // Partidor (banco de salida) con su número.
        p.rect(3, 3, 10, 10, PAL.outline).rect(4, 4, 8, 8, '#f4f4f0').rect(4, 10, 8, 2, '#2050a8').rect(7, 5, 2, 4, '#202028');
      },
    },
    {
      key: 'trampolin',
      solid: true,
      draw: (p) => {
        poolDeck(p);
        p.rect(5, 0, 6, 16, PAL.outline).rect(6, 0, 4, 16, '#f0f0e8').rect(6, 0, 4, 2, '#3c8ce0').rect(6, 13, 4, 3, '#a8acb4');
      },
    },
    {
      key: 'gradas',
      solid: true,
      draw: (p) => {
        p.fill('#a8a49a');
        for (const y of [0, 5, 10]) p.rect(0, y, 16, 4, '#c8c4b8').rect(0, y + 3, 16, 1, '#8a867c');
        p.rect(2, 1, 4, 2, '#2050a8').rect(10, 6, 4, 2, '#d84848');
      },
    },
    {
      key: 'locker',
      solid: true,
      draw: (p) => {
        p.fill('#3a6ab0');
        p.rect(0, 0, 16, 1, '#2a4c80').rect(7, 0, 2, 16, '#2a4c80').rect(0, 15, 16, 1, '#203a60');
        for (const x of [2, 10]) p.rect(x, 3, 4, 1, '#2a4c80').rect(x, 5, 4, 1, '#2a4c80').px(x + 3, 9, '#e8e8f0');
      },
    },
    {
      key: 'banca_camerino',
      solid: true,
      draw: (p) => {
        p.fill('#c8ccd0').rect(0, 7, 16, 1, '#aeb2b8');
        p.rect(0, 4, 16, 7, PAL.outline).rect(0, 5, 16, 5, '#b4825c').rect(0, 5, 16, 1, '#c89a70');
      },
    },
    {
      key: 'piso_camerino',
      solid: false,
      draw: (p) => {
        p.fill('#c8ccd0');
        p.rect(0, 7, 16, 1, '#aeb2b8').rect(0, 15, 16, 1, '#aeb2b8').rect(7, 0, 1, 16, '#aeb2b8').rect(15, 0, 1, 16, '#aeb2b8');
        p.px(3, 3, '#e0f0f8').px(11, 12, '#e0f0f8');
      },
    },
    {
      key: 'ducha_piscina',
      solid: true,
      draw: (p) => {
        poolDeck(p);
        p.rect(7, 2, 2, 13, '#a8acb4').rect(4, 1, 8, 2, '#c8ccd4').rect(5, 3, 1, 3, '#88d0f0').rect(8, 3, 1, 4, '#88d0f0').rect(10, 3, 1, 2, '#88d0f0');
      },
    },
    {
      key: 'taquilla',
      solid: true,
      draw: (p) => {
        p.fill('#e8e4d8');
        p.rect(0, 0, 16, 3, '#2050a8').rect(2, 4, 12, 7, PAL.outline).rect(3, 5, 10, 5, '#a8c8dc').rect(3, 10, 10, 2, '#8a867c');
        p.rect(0, 13, 16, 3, '#c8c4b8');
      },
    },
    {
      key: 'reflector',
      solid: true,
      draw: (p) => {
        poolDeck(p);
        p.rect(7, 4, 2, 12, '#7c808c').rect(4, 0, 8, 4, PAL.outline).rect(5, 1, 6, 2, '#fff6c8');
      },
    },

    // --- Centro Deportivo de la PUCC (el «GLD»): coliseo de carpa, canchas y la piscina ---
    {
      key: 'carpa',
      solid: true,
      draw: (p) => {
        // Techo de lona blanca tensada en picos: cada paño tiene su lado al sol y su lado a la sombra,
        // con la costura en la diagonal (desde arriba se ven los pliegues como dientes de sierra).
        p.fill('#fbfaf6');
        for (let y = 0; y < 16; y++) {
          const k = y % 8;
          p.rect(8 - k, y, k, 1, '#e2ded6').rect(16 - k, y, k, 1, '#e2ded6');
          p.px(8 - k, y, '#c8c2b8').px(Math.min(15, 16 - k), y, '#c8c2b8');
        }
        p.rect(0, 7, 16, 1, '#d4cfc6').rect(0, 15, 16, 1, '#d4cfc6');
      },
    },
    {
      key: 'carpa_borde',
      solid: true,
      draw: (p) => {
        // El alero de la carpa: la lona baja en ondas y abajo, a la sombra, el muro del coliseo.
        p.fill('#a89c8c').rect(0, 10, 16, 6, '#8a7e70').rect(2, 12, 3, 3, '#6a6058').rect(10, 12, 3, 3, '#6a6058');
        for (let x = 0; x < 16; x += 8) p.rect(x, 0, 8, 6, '#f4f2ec').rect(x + 1, 6, 6, 2, '#e8e4dc').rect(x + 2, 8, 4, 1, '#d8d4cc');
      },
    },
    {
      key: 'mastil',
      solid: true,
      draw: (p) => {
        // Mástil de luz que atraviesa la carpa, con su reflector arriba.
        p.fill('#f4f2ec').rect(0, 5, 16, 1, '#d8d4cc').rect(0, 11, 16, 1, '#d8d4cc');
        p.rect(6, 0, 4, 16, '#2a2433').rect(7, 0, 2, 16, '#e8e8f0').rect(4, 0, 8, 4, '#2a2433').rect(5, 1, 6, 2, '#fff6c8');
        p.rect(4, 12, 8, 2, '#c8ccd4');
      },
    },
    {
      key: 'basket_verde',
      solid: false,
      draw: (p) => p.fill('#5aa878').speckle(7, 6, '#4e9a6c').speckle(23, 4, '#66b484'),
    },
    {
      key: 'basket_azul',
      solid: false,
      draw: (p) => p.fill('#3c9ad0').speckle(9, 6, '#348cc0').speckle(41, 4, '#4aa8dc'),
    },
    {
      key: 'basket_amarillo',
      solid: false,
      draw: (p) => p.fill('#e8c870').speckle(11, 6, '#dcb858').speckle(3, 4, '#f0d488'),
    },
    {
      key: 'basket_linea_h',
      solid: false,
      draw: (p) => p.fill('#5aa878').rect(0, 7, 16, 2, '#f4f4ee'),
    },
    {
      key: 'basket_linea_v',
      solid: false,
      draw: (p) => p.fill('#5aa878').rect(7, 0, 2, 16, '#f4f4ee'),
    },
    {
      key: 'basket_aro',
      solid: true,
      draw: (p) => {
        // El tablero visto desde arriba: el poste, la tabla blanca y el aro naranjo.
        p.fill('#5aa878');
        p.rect(6, 0, 4, 5, '#2a2433').rect(7, 0, 2, 4, '#3060c0');
        p.rect(2, 5, 12, 3, '#2a2433').rect(3, 5, 10, 2, '#f4f4ee');
        p.rect(5, 8, 6, 5, '#2a2433').rect(6, 9, 4, 3, '#5aa878').rect(5, 8, 6, 1, '#e86a30').rect(5, 12, 6, 1, '#e86a30').rect(5, 8, 1, 5, '#e86a30').rect(10, 8, 1, 5, '#e86a30');
      },
    },
    {
      key: 'tenis_rosa',
      solid: false,
      draw: (p) => p.fill('#c86a6a').speckle(17, 7, '#b85a5a').speckle(5, 5, '#d88080'),
    },
    {
      key: 'tenis_red',
      solid: true,
      draw: (p) => p.fill('#3c7c9c').rect(7, 0, 2, 16, '#f4f4ee').rect(7, 0, 2, 2, '#2a2433').rect(7, 14, 2, 2, '#2a2433'),
    },
    {
      key: 'sombrilla',
      solid: true,
      draw: (p) => {
        poolDeck(p);
        // Sombrilla azul de la piscina, vista desde arriba (gajos y la punta).
        p.rect(1, 1, 14, 14, '#2a2433').rect(2, 2, 12, 12, '#2f7fd8');
        p.rect(2, 7, 12, 2, '#2468b8').rect(7, 2, 2, 12, '#2468b8').rect(4, 4, 3, 3, '#4a98e8').px(8, 8, '#f4f4ee');
      },
    },
    {
      key: 'gradas_techo',
      solid: true,
      draw: (p) => {
        // Gradas con techito azul (como las de las canchas).
        p.fill('#2a2433').rect(0, 1, 16, 9, '#2f6fd0').rect(0, 1, 16, 2, '#4a8ae8').rect(0, 9, 16, 1, '#1e4c98');
        p.rect(0, 10, 16, 6, '#a8a49a').rect(0, 12, 16, 1, '#c8c4b8').rect(0, 14, 16, 1, '#c8c4b8');
      },
    },
    {
      key: 'reflector_cancha',
      solid: true,
      draw: (p) => p.fill('#5aa878').rect(7, 3, 2, 13, '#8a8e98').rect(4, 0, 8, 4, '#2a2433').rect(5, 1, 6, 2, '#fff6c8'),
    },

    // --- Pance Burger ---
    { key: 'burger_piso', solid: false, draw: burgerFloor },
    { key: 'burger_muro', solid: true, draw: (p) => (brickWall(p), bulbs(p)) },
    {
      key: 'burger_neon',
      solid: true,
      draw: (p) => {
        brickWall(p);
        // Hamburguesa de neón: pan naranjo, carne y lechuga.
        p.rect(3, 3, 10, 3, '#f8a838').rect(4, 2, 8, 1, '#f8a838').rect(3, 6, 10, 1, '#58e070').rect(3, 7, 10, 2, '#e85a48').rect(3, 9, 10, 2, '#f8a838');
        p.px(6, 3, '#fff4c0').px(9, 4, '#fff4c0');
      },
    },
    {
      key: 'burger_menu',
      solid: true,
      draw: (p) => {
        brickWall(p);
        p.rect(1, 1, 14, 11, '#6a4228').rect(2, 2, 12, 9, '#2a2c2a');
        for (const y of [3, 5, 7, 9]) p.rect(3, y, 6, 1, '#e8e8e0').rect(11, y, 2, 1, '#f0c030');
      },
    },
    {
      key: 'burger_barra',
      solid: true,
      draw: (p) => {
        burgerFloor(p);
        p.rect(0, 1, 16, 13, PAL.outline).rect(0, 2, 16, 11, '#4c2c18').rect(0, 2, 16, 3, '#d8c8a8').rect(0, 2, 16, 1, '#f0e4c8');
        p.rect(2, 7, 2, 4, '#6a4228').rect(12, 7, 2, 4, '#6a4228');
      },
    },
    {
      key: 'burger_plancha',
      solid: true,
      draw: (p) => {
        brickWall(p);
        p.rect(1, 6, 14, 8, PAL.outline).rect(2, 7, 12, 6, '#3a3a40').rect(2, 7, 12, 1, '#5a5a64');
        // Tres carnes en la plancha y llamitas abajo.
        p.rect(3, 8, 3, 2, '#7a3a20').rect(7, 9, 3, 2, '#7a3a20').rect(11, 8, 2, 2, '#7a3a20');
        p.px(4, 12, '#f8a838').px(8, 12, '#f05a30').px(12, 12, '#f8a838');
        p.rect(4, 2, 1, 3, 'rgba(240,240,240,0.5)').rect(9, 1, 1, 4, 'rgba(240,240,240,0.5)');
      },
    },
    {
      key: 'burger_mesa',
      solid: true,
      draw: (p) => {
        burgerFloor(p);
        p.rect(0, 1, 16, 14, PAL.outline).rect(0, 2, 16, 12, BURGER.table).rect(0, 2, 16, 1, BURGER.tableLight).rect(0, 13, 16, 1, BURGER.tableDark);
        p.rect(0, 7, 16, 1, BURGER.tableDark);
      },
    },
    {
      key: 'burger_banca',
      solid: true,
      draw: (p) => {
        burgerFloor(p);
        p.rect(0, 4, 16, 8, PAL.outline).rect(0, 5, 16, 6, '#8a5a38').rect(0, 5, 16, 1, '#a8744c');
      },
    },
    {
      key: 'burger_banca_n',
      solid: true,
      draw: (p) => {
        burgerFloor(p);
        p.rect(0, 4, 16, 8, PAL.outline).rect(0, 5, 16, 6, '#8a5a38').rect(0, 10, 16, 1, '#6a4228');
      },
    },
    {
      key: 'burger_ventana',
      solid: true,
      draw: (p) => {
        brickWall(p);
        p.rect(2, 2, 12, 9, '#4c2c18').rect(3, 3, 10, 7, '#1a2040').px(5, 5, '#f8e0a0').px(10, 7, '#f0c060').px(8, 4, '#ffffff');
      },
    },
    {
      key: 'burger_puerta',
      solid: false,
      draw: (p) => {
        burgerFloor(p);
        p.rect(0, 0, 16, 3, '#4c2c18').rect(2, 0, 12, 2, '#1a2040');
      },
    },
  ];
}
