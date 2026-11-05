import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 6 («Letras sobre el río»): la estación Universidades y el carril del bus troncal,
 * el articulado por dentro, el Bulevar del Río con los toldos de la feria del libro, el río Cali y sus puentes,
 * La Ermita, la Colina de San Antonio con su capilla y la heladería de los corazones.
 * Cada tile es de 16×16 px y se dibuja con rectángulos (como el resto de src/art/tiles.ts).
 */

function grass(p: Painter, base: string = PAL.grass): void {
  p.fill(base);
  for (const [x, y] of [[2, 3], [10, 2], [6, 8], [12, 11], [2, 12]] as const) p.rect(x, y, 1, 2, PAL.grassDark).px(x + 1, y + 1, PAL.grassDark);
  p.px(8, 13, PAL.grassLight).px(13, 6, PAL.grassLight);
}

// ---------------------------------------------------------------------------
// Estaciones y carril exclusivo del bus troncal
// ---------------------------------------------------------------------------

const ST = {
  floor: '#d6d8dc',
  floorDark: '#b8bcc4',
  floorLight: '#eceef0',
  tactile: '#f0c830',
  tactileDark: '#c89c18',
  glass: '#9cc8e4',
  glassDark: '#5c8cb0',
  glassLight: '#d8f0fc',
  frame: '#3c8c5c',
  frameDark: '#24603c',
  roof: '#e8eae8',
  roofDark: '#b4b8b8',
  lane: '#9c4a40',
  laneDark: '#843c34',
  laneLight: '#b45e52',
};

function stationFloor(p: Painter): void {
  p.fill(ST.floor);
  for (let i = 0; i < 16; i += 8) p.rect(i, 0, 1, 16, ST.floorDark).rect(0, i, 16, 1, ST.floorDark);
  p.px(4, 4, ST.floorLight).px(12, 12, ST.floorLight);
}

function busLane(p: Painter): void {
  p.fill(ST.lane);
  p.speckle(23, 10, ST.laneDark);
  p.speckle(57, 6, ST.laneLight);
}

const FERIA = {
  pave: '#d8c8b0',
  paveDark: '#bca88c',
  paveLight: '#ece0cc',
  bike: '#c0584c',
  bikeDark: '#9c4038',
};

function bulevar(p: Painter): void {
  // Losetas grandes claras con una cenefa de ladrillo: el Bulevar del Río.
  p.fill(FERIA.pave);
  p.rect(0, 0, 16, 1, FERIA.paveDark).rect(0, 0, 1, 16, FERIA.paveDark);
  p.rect(1, 1, 7, 7, FERIA.paveLight).rect(9, 9, 6, 6, FERIA.paveLight);
  p.px(11, 3, FERIA.paveDark).px(4, 12, FERIA.paveDark);
}

/** Lona de toldo vista desde arriba, a franjas, con la caída del borde abajo. */
function toldo(p: Painter, a: string, b: string): void {
  p.fill(a);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 13, b);
  p.rect(0, 0, 16, 1, '#ffffff');
  p.rect(0, 12, 16, 1, 'rgba(0,0,0,0.25)');
  // Faldón ondulado.
  for (let x = 0; x < 16; x += 4) p.rect(x, 13, 3, 2, x % 8 === 0 ? a : b).px(x + 1, 15, x % 8 === 0 ? a : b);
}

const BOOK_COLORS = ['#c83c3c', '#2f6fd0', '#3cae5c', '#f0c030', '#9c5cc8', '#e87838', '#f4f0e6', '#2a2433'];

function bookRow(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
  for (let i = 0; i < w; i++) {
    const c = BOOK_COLORS[(i * 7 + seed * 3) % BOOK_COLORS.length];
    const top = (i + seed) % 3 === 0 ? 1 : 0;
    p.rect(x + i, y + top, 1, h - top, c);
  }
}

const RIO = {
  water: '#5a8c8c',
  waterDark: '#467474',
  waterLight: '#84b4ac',
  foam: '#d4ece4',
  rock: '#8a8478',
  rockDark: '#6a645a',
  brick: '#b4604a',
  brickDark: '#8a4434',
  brickLight: '#d07a60',
};

function river(p: Painter, seed: number): void {
  p.fill(RIO.water);
  p.speckle(seed, 9, RIO.waterDark);
  p.rect(2, 4, 4, 1, RIO.waterLight).rect(9, 9, 5, 1, RIO.waterLight).rect(5, 13, 3, 1, RIO.waterLight);
  p.px(3, 4, RIO.foam).px(12, 9, RIO.foam);
}

function brickDeck(p: Painter): void {
  p.fill(RIO.brick);
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y + 3, 16, 1, RIO.brickDark);
    for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) p.rect(x, y, 1, 3, RIO.brickDark);
  }
  p.px(3, 1, RIO.brickLight).px(11, 9, RIO.brickLight);
}

// ---------------------------------------------------------------------------
// La Ermita (neogótica, blanca y gris)
// ---------------------------------------------------------------------------

const ERM = {
  wall: '#f2f0ea',
  wallDark: '#c8c4bc',
  wallShade: '#dcd8d0',
  roof: '#7c8494',
  roofDark: '#5c6474',
  roofLight: '#9ca4b4',
  glass: '#5a6cb8',
  glassRed: '#c84c5c',
  glassGold: '#f0c048',
  door: '#5a3a28',
  doorDark: '#3c2418',
  stone: '#cfc8bc',
  stoneDark: '#b0a898',
};

function ermitaWall(p: Painter): void {
  p.fill(ERM.wall);
  p.rect(0, 0, 1, 16, ERM.wallShade).rect(15, 0, 1, 16, ERM.wallDark);
  p.rect(0, 15, 16, 1, ERM.wallDark);
}

function pointedWindow(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x, y + 2, w, h - 2, ERM.glass).rect(x + 1, y + 1, w - 2, 1, ERM.glass).px(x + Math.floor(w / 2), y, ERM.glass);
  p.rect(x + Math.floor(w / 2), y + 2, 1, h - 2, ERM.wallDark);
  p.px(x + 1, y + 3, ERM.glassRed).px(x + w - 2, y + 5, ERM.glassGold);
}

// ---------------------------------------------------------------------------
// Colina de San Antonio
// ---------------------------------------------------------------------------

const SA = {
  brick: '#b8583c',
  brickDark: '#8c3c28',
  wall: '#f6f0e2',
  wallDark: '#d4c8b0',
  roof: '#b85838',
  roofDark: '#8c3c24',
  roofLight: '#d8784c',
  stone: '#a8a090',
  stoneDark: '#827a6c',
  stoneLight: '#c8c0b0',
  wood: '#6a4228',
  iron: '#2a2433',
  lamp: '#fff0b0',
};

function stoneWall(p: Painter): void {
  p.fill(SA.stone);
  for (let y = 0; y < 16; y += 5) {
    p.rect(0, y + 4, 16, 1, SA.stoneDark);
    for (let x = (y / 5) % 2 ? 3 : 7; x < 16; x += 8) p.rect(x, y, 1, 4, SA.stoneDark);
  }
  p.px(2, 1, SA.stoneLight).px(10, 6, SA.stoneLight).px(5, 11, SA.stoneLight);
}

// ---------------------------------------------------------------------------
// Heladería
// ---------------------------------------------------------------------------

const HEL = {
  pink: '#f4b8c8',
  pinkDark: '#e08aa4',
  white: '#fbf6f2',
  red: '#e04868',
  mint: '#a8e0cc',
  wood: '#b07c50',
  woodDark: '#82583a',
  chrome: '#c8ccd4',
};

function heladeriaFloor(p: Painter): void {
  p.fill(HEL.white);
  p.rect(0, 0, 8, 8, HEL.pink).rect(8, 8, 8, 8, HEL.pink);
}

function heart(p: Painter, x: number, y: number, c: string): void {
  p.rect(x, y, 2, 1, c).rect(x + 3, y, 2, 1, c).rect(x, y + 1, 5, 1, c).rect(x + 1, y + 2, 3, 1, c).px(x + 2, y + 3, c);
}

function heladeriaWall(p: Painter): void {
  p.fill(HEL.pink);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 11, '#f8cad6');
  p.rect(0, 11, 16, 1, HEL.red).rect(0, 12, 16, 4, HEL.white).rect(0, 15, 16, 1, HEL.pinkDark);
}

// ---------------------------------------------------------------------------
// El articulado (bus troncal) por dentro
// ---------------------------------------------------------------------------

const ART = {
  floor: '#7c8088',
  floorDark: '#6a6e76',
  wall: '#eef0f0',
  wallDark: '#c4c8cc',
  seat: '#2c8c5c',
  seatDark: '#1c6040',
  seatLight: '#48b07c',
  bellows: '#3a3c44',
  bellowsLight: '#5a5c66',
  glass: '#8cb8d8',
  glassDark: '#5c88a8',
};

function artFloor(p: Painter): void {
  p.fill(ART.floor);
  for (let x = 1; x < 16; x += 3) p.rect(x, 0, 1, 16, ART.floorDark);
}

function artSeat(p: Painter, backTop: boolean): void {
  artFloor(p);
  if (backTop) {
    p.rect(2, 0, 12, 5, ART.seatDark).rect(3, 1, 10, 3, ART.seat).rect(2, 5, 12, 7, ART.seat).rect(3, 6, 10, 1, ART.seatLight);
    p.rect(2, 12, 12, 1, ART.seatDark);
  } else {
    p.rect(2, 3, 12, 7, ART.seat).rect(3, 4, 10, 1, ART.seatLight).rect(2, 10, 12, 6, ART.seatDark).rect(3, 11, 10, 3, ART.seat);
  }
}

export function m6Tiles(): TileDef[] {
  return [
    // --- Carril exclusivo y estaciones del bus troncal ---
    { key: 'mio_carril', solid: false, draw: busLane },
    { key: 'mio_carril_linea', solid: false, draw: (p) => (busLane(p), p.rect(2, 7, 6, 2, PAL.lineWhite).rect(10, 7, 4, 2, PAL.lineWhite)) },
    { key: 'mio_carril_linea_v', solid: false, draw: (p) => (busLane(p), p.rect(7, 2, 2, 6, PAL.lineWhite).rect(7, 10, 2, 4, PAL.lineWhite)) },
    { key: 'estacion_piso', solid: false, draw: stationFloor },
    {
      key: 'estacion_borde',
      solid: false,
      draw: (p) => {
        stationFloor(p);
        // Franja podotáctil amarilla (con sus puntitos) a lo largo del borde del andén.
        p.rect(0, 5, 16, 6, ST.tactile);
        for (let x = 1; x < 16; x += 3) p.px(x, 6, ST.tactileDark).px(x + 1, 9, ST.tactileDark);
      },
    },
    {
      key: 'estacion_vidrio',
      solid: true,
      draw: (p) => {
        stationFloor(p);
        p.rect(0, 5, 16, 6, ST.glass).rect(0, 5, 16, 1, ST.glassLight).rect(0, 10, 16, 1, ST.glassDark);
        p.rect(0, 4, 16, 1, ST.frame).rect(0, 11, 16, 1, ST.frame).rect(0, 4, 1, 8, ST.frame).rect(15, 4, 1, 8, ST.frameDark);
        p.rect(3, 6, 3, 1, '#ffffff');
      },
    },
    {
      key: 'estacion_puerta',
      solid: true,
      draw: (p) => {
        stationFloor(p);
        // Puerta corrediza de vidrio del andén (verde, con su letrero de "no apoyarse").
        p.rect(0, 3, 16, 10, ST.frameDark).rect(1, 4, 6, 8, ST.glass).rect(9, 4, 6, 8, ST.glass);
        p.rect(7, 4, 2, 8, ST.frame).rect(2, 5, 2, 1, '#ffffff').rect(10, 5, 2, 1, '#ffffff');
        p.rect(3, 9, 2, 1, PAL.yellow).rect(11, 9, 2, 1, PAL.yellow);
      },
    },
    {
      key: 'estacion_techo',
      solid: true,
      draw: (p) => {
        // Techo de lámina de la estación: canaletas, el borde verde y la sombra abajo.
        p.fill(ST.roof);
        for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 12, ST.roofDark);
        p.rect(0, 12, 16, 2, ST.frame).rect(0, 14, 16, 2, 'rgba(0,0,0,0.25)');
      },
    },
    {
      key: 'taquilla_estacion',
      solid: true,
      draw: (p) => {
        stationFloor(p);
        p.rect(1, 1, 14, 13, ST.frameDark).rect(2, 2, 12, 6, ST.glass).rect(3, 3, 3, 1, '#ffffff');
        p.rect(2, 9, 12, 4, '#e8e8e4').rect(5, 10, 6, 1, '#3a3a44').rect(0, 14, 16, 2, 'rgba(0,0,0,0.2)');
        p.rect(6, 11, 4, 1, PAL.yellow);
      },
    },
    {
      key: 'recargadora',
      solid: true,
      draw: (p) => {
        stationFloor(p);
        // Máquina de recarga de la tarjeta: pantalla azul y ranura.
        p.rect(4, 1, 8, 14, '#2a2a34').rect(5, 2, 6, 5, '#3c8cd8').rect(6, 3, 3, 1, '#c8ecff');
        p.rect(6, 9, 4, 1, PAL.yellow).rect(6, 11, 4, 2, '#5a5a66');
      },
    },

    // --- El Bulevar del Río y la feria del libro ---
    { key: 'bulevar', solid: false, draw: bulevar },
    {
      key: 'cicloruta',
      solid: false,
      draw: (p) => {
        p.fill(FERIA.bike);
        p.speckle(33, 8, FERIA.bikeDark);
        p.rect(0, 0, 16, 1, '#e8e0d0').rect(0, 15, 16, 1, '#e8e0d0');
        p.rect(4, 7, 3, 1, '#f4e8dc').rect(10, 7, 3, 1, '#f4e8dc');
      },
    },
    { key: 'toldo_blanco', solid: true, draw: (p) => toldo(p, '#f4f2ec', '#d8d6d0') },
    { key: 'toldo_rojo', solid: true, draw: (p) => toldo(p, '#e05a4c', '#f4f2ec') },
    { key: 'toldo_azul', solid: true, draw: (p) => toldo(p, '#3c78c8', '#f4f2ec') },
    { key: 'toldo_amarillo', solid: true, draw: (p) => toldo(p, '#f0c040', '#f4f2ec') },
    { key: 'toldo_verde', solid: true, draw: (p) => toldo(p, '#48a868', '#f4f2ec') },
    {
      key: 'puesto_libros',
      solid: true,
      draw: (p) => {
        bulevar(p);
        // Mesón de tablas con libros de canto y otros abiertos encima.
        p.rect(0, 2, 16, 12, PAL.outline).rect(0, 3, 16, 10, PAL.wood).rect(0, 3, 16, 1, '#c89060');
        bookRow(p, 1, 4, 7, 5, 1);
        p.rect(9, 5, 6, 4, '#f4f0e6').rect(12, 5, 1, 4, '#c8c0b0').rect(10, 6, 2, 1, '#8a8478').rect(13, 7, 1, 1, '#8a8478');
        p.rect(0, 13, 16, 1, PAL.woodDark).rect(1, 14, 1, 2, PAL.woodDark).rect(14, 14, 1, 2, PAL.woodDark);
      },
    },
    {
      key: 'libros_caja',
      solid: true,
      draw: (p) => {
        bulevar(p);
        // Huacal de madera lleno de libros viejos (los de a $5.000).
        p.rect(2, 3, 12, 11, PAL.outline).rect(3, 4, 10, 9, '#c89058').rect(3, 8, 10, 1, '#9a6a3c');
        bookRow(p, 4, 4, 8, 4, 5);
        p.rect(5, 10, 6, 2, '#f8f4e8').rect(6, 10, 4, 1, PAL.red);
      },
    },
    {
      key: 'estante_feria',
      solid: true,
      draw: (p) => {
        bulevar(p);
        p.rect(1, 0, 14, 15, PAL.outline).rect(2, 1, 12, 13, PAL.woodDark);
        for (let y = 1; y < 13; y += 4) bookRow(p, 2, y, 12, 3, y);
        for (let y = 4; y < 14; y += 4) p.rect(2, y, 12, 1, PAL.wood);
      },
    },
    {
      key: 'maquina_escribir',
      solid: true,
      draw: (p) => {
        bulevar(p);
        // La mesita del poeta: máquina de escribir verde y una hoja asomando.
        p.rect(2, 4, 12, 10, PAL.woodDark).rect(2, 4, 12, 1, PAL.wood);
        p.rect(4, 6, 8, 6, '#3c7c5c').rect(5, 7, 6, 2, '#2a2433').rect(6, 2, 4, 5, '#fbf8ee').rect(7, 3, 2, 1, '#8a8478');
        for (let x = 5; x < 11; x += 2) p.px(x, 10, '#e8e8e0');
      },
    },
    { key: 'rio', solid: true, draw: (p) => river(p, 7) },
    { key: 'rio_b', solid: true, draw: (p) => river(p, 29) },
    {
      key: 'rio_orilla',
      solid: true,
      draw: (p) => {
        river(p, 51);
        p.rect(0, 0, 16, 5, RIO.rock).rect(0, 4, 16, 1, RIO.rockDark).rect(3, 5, 4, 2, RIO.rock).rect(10, 5, 3, 1, RIO.rock);
        p.px(5, 1, '#a8a294').px(12, 2, '#a8a294').rect(0, 7, 16, 1, RIO.foam);
      },
    },
    {
      key: 'rio_orilla_s',
      solid: true,
      draw: (p) => {
        river(p, 73);
        p.rect(0, 11, 16, 5, RIO.rock).rect(0, 11, 16, 1, RIO.rockDark).rect(4, 9, 4, 2, RIO.rock).rect(11, 10, 3, 1, RIO.rock);
        p.rect(0, 8, 16, 1, RIO.foam).px(6, 13, '#a8a294');
      },
    },
    { key: 'puente_ladrillo', solid: false, draw: brickDeck },
    {
      key: 'puente_muro',
      solid: true,
      draw: (p) => {
        // Pretil de ladrillo del Puente Ortiz (de 1845): una columna con su remate claro.
        brickDeck(p);
        p.rect(4, 0, 8, 16, RIO.brickDark).rect(5, 0, 6, 16, RIO.brick).rect(5, 0, 6, 1, '#e8c8a8');
        for (let y = 2; y < 16; y += 4) p.rect(5, y, 6, 1, RIO.brickDark);
      },
    },
    {
      key: 'puente_piso',
      solid: false,
      draw: (p) => {
        p.fill('#a89a84');
        for (let y = 0; y < 16; y += 3) p.rect(0, y, 16, 1, '#8a7c66');
        p.px(4, 1, '#c4b8a0').px(11, 7, '#c4b8a0');
      },
    },
    {
      key: 'puente_reja',
      solid: true,
      draw: (p) => {
        river(p, 91);
        p.rect(6, 0, 4, 16, '#5a5e6a').rect(7, 0, 2, 16, '#a0a8b8');
        for (let y = 1; y < 16; y += 3) p.rect(5, y, 6, 1, '#3c404a');
      },
    },

    // --- La Ermita ---
    {
      key: 'ermita_aguja',
      solid: true,
      draw: (p) => {
        p.fill(ERM.stone).rect(0, 8, 16, 1, ERM.stoneDark).rect(8, 8, 1, 8, ERM.stoneDark);
        // La punta de una torre: aguja gris con su cruz.
        p.rect(7, 0, 2, 3, ERM.roofDark).rect(6, 1, 4, 1, ERM.roofDark);
        p.rect(6, 3, 4, 4, ERM.roof).rect(5, 7, 6, 4, ERM.roof).rect(4, 11, 8, 5, ERM.roof);
        p.rect(6, 3, 1, 13, ERM.roofLight).rect(11, 11, 1, 5, ERM.roofDark);
      },
    },
    {
      key: 'ermita_torre',
      solid: true,
      draw: (p) => {
        p.fill(ERM.roof);
        p.rect(2, 0, 12, 16, ERM.wall).rect(2, 0, 1, 16, ERM.wallShade).rect(13, 0, 1, 16, ERM.wallDark);
        pointedWindow(p, 6, 3, 4, 9);
        p.rect(2, 14, 12, 2, ERM.wallDark);
      },
    },
    {
      key: 'ermita_techo',
      solid: true,
      draw: (p) => {
        p.fill(ERM.roof);
        for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, ERM.roofDark);
        p.rect(0, 0, 16, 1, ERM.roofLight).rect(0, 15, 16, 1, ERM.roofDark);
        p.rect(7, 0, 2, 16, ERM.roofLight);
      },
    },
    {
      key: 'ermita_muro',
      solid: true,
      draw: (p) => {
        ermitaWall(p);
        pointedWindow(p, 5, 3, 6, 10);
      },
    },
    {
      key: 'ermita_roseton',
      solid: true,
      draw: (p) => {
        ermitaWall(p);
        // Rosetón: círculo de vitral con radios.
        p.rect(4, 2, 8, 10, ERM.wallDark).rect(3, 4, 10, 6, ERM.wallDark);
        p.rect(5, 3, 6, 8, ERM.glass).rect(4, 5, 8, 4, ERM.glass);
        p.rect(7, 3, 2, 8, ERM.glassGold).rect(4, 6, 8, 2, ERM.glassGold).px(5, 4, ERM.glassRed).px(10, 9, ERM.glassRed);
        p.rect(7, 6, 2, 2, '#ffffff');
      },
    },
    {
      key: 'ermita_puerta',
      solid: true,
      draw: (p) => {
        ermitaWall(p);
        // Portón en ojiva de madera con herrajes.
        p.rect(2, 4, 12, 12, ERM.wallDark).rect(3, 5, 10, 11, ERM.door).rect(4, 4, 8, 1, ERM.door).rect(6, 3, 4, 1, ERM.door);
        p.rect(7, 5, 2, 11, ERM.doorDark).rect(5, 9, 1, 1, PAL.yellow).rect(10, 9, 1, 1, PAL.yellow);
      },
    },
    {
      key: 'ermita_atrio',
      solid: false,
      draw: (p) => {
        p.fill(ERM.stone);
        p.rect(0, 0, 16, 1, ERM.stoneDark).rect(0, 8, 16, 1, ERM.stoneDark).rect(0, 0, 1, 8, ERM.stoneDark).rect(8, 8, 1, 8, ERM.stoneDark);
        p.px(4, 4, '#e0dad0').px(12, 12, '#e0dad0');
      },
    },

    // --- Colina de San Antonio ---
    { key: 'ladera', solid: false, draw: (p) => grass(p, '#5ea050') },
    {
      key: 'escalera_piedra',
      solid: false,
      draw: (p) => {
        p.fill(SA.stoneLight);
        for (let y = 0; y < 16; y += 4) p.rect(0, y + 3, 16, 1, SA.stoneDark).rect(0, y, 16, 1, '#ddd6c8');
        p.rect(0, 0, 1, 16, SA.stoneDark).rect(15, 0, 1, 16, SA.stoneDark);
      },
    },
    { key: 'muro_piedra', solid: true, draw: stoneWall },
    {
      key: 'mirador_baranda',
      solid: true,
      draw: (p) => {
        p.fill(SA.stoneLight);
        p.rect(0, 9, 16, 7, SA.stone).rect(0, 9, 16, 1, '#e4ddd0');
        for (let x = 1; x < 16; x += 4) p.rect(x, 2, 2, 7, SA.iron);
        p.rect(0, 1, 16, 2, SA.iron).rect(0, 1, 16, 1, '#5a5468');
      },
    },
    {
      key: 'grada_piedra',
      solid: true,
      draw: (p) => {
        grass(p, '#5ea050');
        p.rect(0, 3, 16, 10, SA.stoneDark).rect(0, 3, 16, 8, SA.stone).rect(0, 3, 16, 1, SA.stoneLight);
      },
    },
    {
      key: 'farol_colonial',
      solid: true,
      draw: (p) => {
        p.fill(SA.stoneLight);
        p.rect(0, 0, 16, 1, SA.stone);
        p.rect(7, 6, 2, 10, SA.iron).rect(5, 15, 6, 1, SA.iron);
        p.rect(5, 1, 6, 6, SA.iron).rect(6, 2, 4, 4, SA.lamp).rect(4, 0, 8, 1, SA.iron);
      },
    },
    {
      key: 'capilla_techo',
      solid: true,
      draw: (p) => {
        p.fill(SA.roof);
        for (let y = 1; y < 16; y += 3) p.rect(0, y, 16, 1, SA.roofDark);
        for (let x = 2; x < 16; x += 5) p.rect(x, 0, 1, 16, SA.roofLight);
      },
    },
    {
      key: 'capilla_torre',
      solid: true,
      draw: (p) => {
        // Espadaña de ladrillo con la campana colgando en su arco.
        p.fill(SA.roof);
        p.rect(2, 0, 12, 16, SA.brickDark).rect(3, 0, 10, 16, SA.brick);
        p.rect(5, 3, 6, 7, '#2a1c18').rect(6, 2, 4, 1, '#2a1c18');
        p.rect(7, 5, 2, 3, PAL.yellowDark).rect(6, 7, 4, 1, PAL.yellow);
        for (let y = 11; y < 16; y += 2) p.rect(3, y, 10, 1, SA.brickDark);
      },
    },
    {
      key: 'capilla_muro',
      solid: true,
      draw: (p) => {
        p.fill(SA.wall);
        p.rect(0, 0, 16, 2, SA.brick).rect(0, 14, 16, 2, SA.brick).rect(0, 2, 2, 12, SA.brick).rect(14, 2, 2, 12, SA.brick);
        p.rect(6, 5, 4, 5, SA.wood).rect(6, 4, 4, 1, SA.brickDark);
      },
    },
    {
      key: 'capilla_puerta',
      solid: true,
      draw: (p) => {
        p.fill(SA.wall);
        p.rect(0, 0, 16, 2, SA.brick).rect(0, 2, 2, 14, SA.brick).rect(14, 2, 2, 14, SA.brick);
        p.rect(4, 4, 8, 12, SA.brickDark).rect(5, 5, 6, 11, SA.wood).rect(6, 4, 4, 1, SA.wood).rect(8, 5, 1, 11, '#4a2c18');
      },
    },
    {
      key: 'teatrino',
      solid: true,
      draw: (p) => {
        // La tarima de los cuenteros: tablas, una silla y un parlante viejo.
        p.fill('#8a6040');
        for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, '#6a4428');
        p.rect(5, 4, 6, 6, '#c89060').rect(5, 3, 6, 1, '#e0a878').rect(12, 2, 3, 6, '#2a2433').rect(13, 3, 1, 1, '#a0a8b8');
      },
    },

    // --- Heladería Corazones ---
    { key: 'helado_piso', solid: false, draw: heladeriaFloor },
    { key: 'helado_muro', solid: true, draw: (p) => (heladeriaWall(p), heart(p, 5, 4, HEL.red)) },
    {
      key: 'helado_ventana',
      solid: true,
      draw: (p) => {
        heladeriaWall(p);
        p.rect(2, 1, 12, 9, '#ffffff').rect(3, 2, 10, 7, '#a8d4f0').rect(4, 3, 3, 1, '#e0f4ff');
      },
    },
    {
      key: 'helado_letrero',
      solid: true,
      draw: (p) => {
        heladeriaWall(p);
        // El corazón de neón: «CORAZONES».
        p.rect(1, 1, 14, 9, '#3a1c2c');
        heart(p, 3, 3, '#ff6a9a');
        heart(p, 8, 3, '#ff9ac0');
        p.rect(3, 8, 10, 1, '#ffd0e0');
      },
    },
    {
      key: 'helado_vitrina',
      solid: true,
      draw: (p) => {
        heladeriaFloor(p);
        // Congelador con las cubetas de colores (lulo, mora, maracuyá, guanábana...).
        p.rect(0, 2, 16, 13, PAL.outline).rect(1, 3, 14, 11, HEL.chrome).rect(1, 3, 14, 1, '#e8ecf0');
        const flavors = ['#f0d048', '#7c2c5c', '#f8b830', '#f4f0e0', '#b8d848', '#e85a7a'];
        flavors.forEach((c, i) => p.rect(2 + (i % 3) * 4, 5 + Math.floor(i / 3) * 4, 3, 3, c));
      },
    },
    {
      key: 'helado_mostrador',
      solid: true,
      draw: (p) => {
        heladeriaFloor(p);
        p.rect(0, 3, 16, 12, PAL.outline).rect(0, 4, 16, 10, HEL.white).rect(0, 4, 16, 2, HEL.red);
        heart(p, 5, 8, HEL.pinkDark);
        p.rect(12, 1, 3, 4, '#c8a060').rect(12, 0, 3, 1, '#e8c890');
      },
    },
    {
      key: 'helado_mesa',
      solid: true,
      draw: (p) => {
        heladeriaFloor(p);
        p.rect(2, 3, 12, 10, HEL.chrome).rect(3, 2, 10, 12, HEL.chrome).rect(3, 3, 10, 10, HEL.mint).rect(4, 4, 4, 1, '#d4f4e8');
        p.rect(6, 6, 3, 4, '#f8e8d0').rect(7, 5, 2, 1, '#ff9ac0');
      },
    },
    {
      key: 'helado_silla',
      solid: true,
      draw: (p) => {
        heladeriaFloor(p);
        p.rect(3, 4, 10, 10, HEL.woodDark).rect(4, 5, 8, 7, HEL.red).rect(4, 5, 8, 1, '#f07890');
      },
    },
    {
      key: 'helado_silla_n',
      solid: true,
      draw: (p) => {
        heladeriaFloor(p);
        p.rect(3, 2, 10, 10, HEL.woodDark).rect(4, 4, 8, 7, HEL.red).rect(4, 10, 8, 1, '#a83050');
      },
    },
    {
      key: 'helado_puerta',
      solid: false,
      draw: (p) => {
        heladeriaFloor(p);
        p.rect(0, 0, 16, 2, HEL.woodDark).rect(2, 2, 12, 14, 'rgba(168,212,240,0.55)').rect(2, 2, 1, 14, HEL.woodDark).rect(13, 2, 1, 14, HEL.woodDark);
      },
    },

    // --- El articulado por dentro ---
    { key: 'art_piso', solid: false, draw: artFloor },
    { key: 'art_asiento', solid: true, draw: (p) => artSeat(p, true) },
    { key: 'art_asiento_s', solid: true, draw: (p) => artSeat(p, false) },
    {
      key: 'art_ventana',
      solid: true,
      draw: (p) => {
        p.fill(ART.wall);
        p.rect(0, 2, 16, 10, ART.glassDark).rect(1, 3, 14, 8, ART.glass).rect(2, 4, 5, 1, '#d8ecf8');
        p.rect(0, 12, 16, 1, ART.wallDark).rect(0, 14, 16, 2, '#2c8c5c');
      },
    },
    {
      key: 'art_puerta',
      solid: true,
      draw: (p) => {
        artFloor(p);
        p.rect(0, 0, 16, 16, '#3a3c44');
        p.rect(0, 0, 16, 2, '#2c8c5c');
      },
    },
    {
      key: 'art_fuelle',
      solid: false,
      draw: (p) => {
        // La «rótula» del articulado: el piso giratorio y el acordeón de goma a los lados.
        p.fill(ART.floorDark);
        p.rect(2, 0, 12, 16, '#8a8e96');
        for (let y = 0; y < 16; y += 2) p.rect(0, y, 2, 1, ART.bellowsLight).rect(14, y, 2, 1, ART.bellowsLight);
        p.rect(0, 0, 2, 16, ART.bellows).rect(14, 0, 2, 16, ART.bellows);
        p.rect(7, 2, 2, 12, '#6a6e76');
      },
    },
    {
      key: 'art_barra',
      solid: true,
      draw: (p) => {
        artFloor(p);
        p.rect(6, 6, 4, 4, '#2a2433').rect(7, 7, 2, 2, '#f0c030');
      },
    },
  ];
}
