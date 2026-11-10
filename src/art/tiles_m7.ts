import { PAL } from './palette';
import type { Painter } from './Painter';
import type { TileDef } from './tiles';

/**
 * Tiles de la misión 7 («Lluvia en el piso 8»): la cuadra de la Calle 18 frente a la U (la bodega PrecioClub con
 * su techo de paneles solares, la torre del Bobo Unic Living de ladrillo naranjo y blanco, su piscina y los locales
 * de la esquina), el lobby de la residencia, el pasillo y el depa del piso 8, y la Farmadía de la esquina.
 * Cada tile es de 16×16 px y se dibuja con rectángulos (como el resto de src/art/tiles.ts).
 */

function grass(p: Painter): void {
  p.fill(PAL.grass);
  for (const [x, y] of [[2, 3], [10, 2], [6, 8], [12, 11], [2, 12]] as const) p.px(x, y, PAL.grassDark).px(x + 2, y, PAL.grassDark).px(x + 1, y + 1, PAL.grassDark);
}

function sidewalk(p: Painter): void {
  p.fill(PAL.walk);
  p.rect(0, 0, 16, 1, PAL.walkLight).rect(0, 8, 16, 1, PAL.walkLight);
  p.rect(0, 7, 16, 1, PAL.walkDark).rect(0, 15, 16, 1, PAL.walkDark);
  p.rect(3, 0, 1, 7, PAL.walkDark).rect(11, 8, 1, 7, PAL.walkDark);
}

const ESP = {
  wall: '#e8d8b8',
  red: '#d83c3c',
  redDark: '#a82828',
  cream: '#f4f0e4',
  glow: '#f8ecd0',
  shelf: '#a07848',
  bread: '#f0d088',
  breadDark: '#d8a058',
  crumb: '#fff4d8',
  wood: '#8c5a34',
  woodLight: '#b07c4c',
  handle: '#e8c070',
  sign: '#3c8c5c',
  inside: '#ffe6a0',
  insideFloor: '#e0b870',
  counter: '#a07848',
  mat: '#6a4a30',
  matLight: '#a8784c',
};

/** Muro crema de La Espiga con su toldo a rayas rojo y crema, que termina en festón. */
function espigaFront(p: Painter): void {
  p.fill(ESP.wall);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 4, ESP.red).rect(x + 2, 0, 2, 4, ESP.cream);
  for (let x = 0; x < 16; x += 4) p.rect(x, 4, 2, 1, ESP.redDark).rect(x + 2, 4, 2, 1, ESP.cream).px(x + 1, 5, ESP.redDark).px(x + 3, 5, ESP.cream);
}

// ---------------------------------------------------------------------------
// La bodega PrecioClub (techo de paneles solares, como en la foto)
// ---------------------------------------------------------------------------

const BOD = {
  roof: '#c8ccd0',
  roofDark: '#a8aeb4',
  panel: '#2c4a7c',
  panelDark: '#1c3258',
  panelLight: '#5a7cb8',
  wall: '#ece4d4',
  wallDark: '#c8bca4',
  blue: '#1c4c9c',
  yellow: '#f0c830',
};

function solarRoof(p: Painter): void {
  p.fill(BOD.roof);
  // Dos filas de paneles por tile, con su marco y el reflejo del cielo.
  for (const y of [1, 9]) {
    p.rect(1, y, 14, 6, BOD.panelDark).rect(2, y + 1, 12, 4, BOD.panel);
    p.rect(5, y + 1, 1, 4, BOD.panelDark).rect(9, y + 1, 1, 4, BOD.panelDark).rect(2, y + 3, 12, 1, BOD.panelDark);
    p.px(3, y + 1, BOD.panelLight).px(11, y + 4, BOD.panelLight);
  }
}

// ---------------------------------------------------------------------------
// La torre del Bobo Unic Living: ladrillo naranjo con balcones y el ala blanca
// ---------------------------------------------------------------------------

const BOHO = {
  brick: '#d4703c',
  brickDark: '#b0562a',
  brickLight: '#e88c58',
  white: '#f0ece4',
  whiteDark: '#ccc6ba',
  glass: '#5c7c98',
  glassLight: '#a8c4d8',
  rail: '#e8e8e8',
  roof: '#d8d4cc',
  roofDark: '#b4aea4',
  slab: '#8c8478',
};

function brickWall(p: Painter): void {
  p.fill(BOHO.brick);
  for (let y = 1; y < 16; y += 3) {
    p.rect(0, y, 16, 1, BOHO.brickDark);
    for (let x = (y % 2) * 3; x < 16; x += 6) p.px(x, y + 1, BOHO.brickDark);
  }
}

/** Ladrillo con dos ventanas angostas y el balconcito blanco (las fachadas de la foto). */
function brickWindows(p: Painter): void {
  brickWall(p);
  for (const x of [2, 9]) {
    p.rect(x, 2, 5, 9, BOHO.brickDark).rect(x + 1, 3, 3, 7, BOHO.glass).rect(x + 1, 3, 1, 3, BOHO.glassLight);
    p.rect(x - 1, 10, 7, 2, BOHO.white).rect(x - 1, 12, 7, 1, BOHO.whiteDark);
  }
}

function whiteWindows(p: Painter): void {
  p.fill(BOHO.white);
  p.rect(0, 0, 16, 1, BOHO.whiteDark).rect(0, 15, 16, 1, BOHO.whiteDark);
  for (const x of [1, 9]) {
    p.rect(x, 2, 6, 10, BOHO.whiteDark).rect(x + 1, 3, 4, 8, BOHO.glass).rect(x + 1, 3, 1, 4, BOHO.glassLight);
    p.rect(x, 11, 6, 1, BOHO.rail).rect(x, 12, 6, 1, BOHO.slab);
  }
}

function towerRoof(p: Painter): void {
  p.fill(BOHO.roof);
  p.px(3, 4, BOHO.roofDark).px(11, 11, BOHO.roofDark).px(7, 8, BOHO.roofDark);
}

// ---------------------------------------------------------------------------
// Interiores: lobby, pasillo y el depa
// ---------------------------------------------------------------------------

const LOB = {
  stone: '#d8d0c4',
  stoneDark: '#bcb2a4',
  stoneLight: '#ece6dc',
  wood: '#8a5a3a',
  woodDark: '#6a4028',
  wall: '#efe8dc',
  wallDark: '#cfc4b2',
  sofa: '#4a7c74',
  sofaDark: '#345c56',
  sofaLight: '#6a9c92',
};

function lobbyFloor(p: Painter): void {
  p.fill(LOB.stone);
  p.rect(0, 0, 16, 1, LOB.stoneLight).rect(0, 0, 1, 16, LOB.stoneLight).rect(15, 0, 1, 16, LOB.stoneDark).rect(0, 15, 16, 1, LOB.stoneDark);
  p.px(5, 6, LOB.stoneDark).px(11, 10, LOB.stoneLight);
}

const DEPA = {
  floor: '#c89c6c',
  floorDark: '#a87c50',
  floorLight: '#dcb486',
  wall: '#f4f0ea',
  wallDark: '#d8d0c4',
  counter: '#e8e4dc',
  counterDark: '#bcb6aa',
  cabinet: '#5a6c7c',
  cabinetDark: '#3c4c5a',
  sheet: '#f0f2f8',
  sheetDark: '#c8cee0',
  blanket: '#5c7cb8',
  blanketDark: '#425e98',
  blanketLight: '#7c9cd4',
  sofa: '#c8a070',
  sofaDark: '#a07c50',
  sofaLight: '#dcbc90',
  carpet: '#a85a4a',
};

function depaFloor(p: Painter): void {
  p.fill(DEPA.floor);
  // Piso flotante: tablas de 4 px con las juntas corridas.
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y + 3, 16, 1, DEPA.floorDark);
    p.px((y * 5) % 16, y + 1, DEPA.floorDark).px((y * 5 + 8) % 16, y + 2, DEPA.floorDark);
    p.px((y * 3 + 4) % 16, y, DEPA.floorLight);
  }
}

function depaWall(p: Painter): void {
  p.fill(DEPA.wall);
  p.rect(0, 0, 16, 1, DEPA.wallDark).rect(0, 13, 16, 3, '#e4ddd0').rect(0, 13, 16, 1, DEPA.wallDark);
}

function bathFloor(p: Painter): void {
  p.fill('#e4ecf0');
  p.rect(0, 7, 16, 1, '#c4d0d8').rect(7, 0, 1, 16, '#c4d0d8').rect(15, 0, 1, 16, '#c4d0d8').rect(0, 15, 16, 1, '#c4d0d8');
}

function hallFloor(p: Painter): void {
  p.fill('#7c6a8c');
  p.rect(0, 0, 16, 2, '#5c4c6c').rect(0, 14, 16, 2, '#5c4c6c');
  for (let x = 1; x < 16; x += 5) p.px(x, 7, '#9c8aac').px(x + 2, 9, '#9c8aac');
}

function counterTop(p: Painter): void {
  depaFloor(p);
  p.rect(0, 0, 16, 14, DEPA.cabinetDark).rect(0, 0, 16, 6, DEPA.counter).rect(0, 6, 16, 1, DEPA.counterDark);
  p.rect(1, 7, 6, 6, DEPA.cabinet).rect(9, 7, 6, 6, DEPA.cabinet).rect(5, 9, 1, 2, '#c8ccd4').rect(10, 9, 1, 2, '#c8ccd4');
}

/** Cama doble: dos cabeceras (izquierda y derecha) y los pies, con la frazada azul. */
function doubleBed(p: Painter, part: 'i' | 'd' | 'pies_i' | 'pies_d'): void {
  depaFloor(p);
  const left = part === 'i' || part === 'pies_i';
  const x0 = left ? 1 : 0;
  const w = 15;
  if (part === 'i' || part === 'd') {
    p.rect(x0, 0, w, 16, PAL.outline).rect(x0, 0, w, 3, DEPA.cabinetDark);
    p.rect(x0 + (left ? 1 : 0), 3, w - 1, 13, DEPA.sheet);
    p.rect(x0 + 2, 4, 11, 5, '#ffffff').rect(x0 + 2, 8, 11, 1, DEPA.sheetDark);
    p.rect(x0 + (left ? 1 : 0), 11, w - 1, 5, DEPA.blanket).rect(x0 + (left ? 1 : 0), 11, w - 1, 1, DEPA.blanketLight);
  } else {
    p.rect(x0, 0, w, 15, PAL.outline).rect(x0 + (left ? 1 : 0), 0, w - 1, 13, DEPA.blanket);
    p.rect(x0 + (left ? 1 : 0), 4, w - 1, 1, DEPA.blanketDark).rect(x0 + (left ? 1 : 0), 9, w - 1, 1, DEPA.blanketDark);
    p.rect(x0 + (left ? 1 : 0), 12, w - 1, 1, DEPA.blanketLight);
  }
}

// ---------------------------------------------------------------------------
// La Farmadía de la esquina
// ---------------------------------------------------------------------------

const FAR = {
  floor: '#f0f0ec',
  floorDark: '#d8d8d2',
  wall: '#f8f8f4',
  red: '#d83c3c',
  redDark: '#a82828',
  blue: '#2c5cb0',
  shelf: '#c8ccd4',
  shelfDark: '#9ca2ae',
};

function farmaFloor(p: Painter): void {
  p.fill(FAR.floor);
  p.rect(0, 0, 16, 1, FAR.floorDark).rect(0, 0, 1, 16, FAR.floorDark);
  p.px(8, 8, FAR.floorDark);
}

const PRODUCTS = ['#e85a5a', '#5a8ce8', '#f0c830', '#58b868', '#e8e8f0', '#c868c8', '#f08838', '#68c8d8'];

function farmaShelf(p: Painter, seed: number, back: boolean): void {
  farmaFloor(p);
  p.rect(0, back ? 2 : 0, 16, 13, FAR.shelfDark).rect(0, back ? 3 : 1, 16, 11, FAR.shelf);
  for (const y of [3, 8]) {
    p.rect(0, (back ? 2 : 0) + y + 3, 16, 1, FAR.shelfDark);
    for (let x = 1; x < 15; x += 3) {
      const c = PRODUCTS[(x + y + seed) % PRODUCTS.length];
      p.rect(x, (back ? 2 : 0) + y, 2, 3, c).px(x, (back ? 2 : 0) + y, '#ffffff');
    }
  }
}

// ---------------------------------------------------------------------------

export function m7Tiles(): TileDef[] {
  return [
    // --- La cuadra: PrecioClub ---
    { key: 'bodega_techo', solid: true, draw: solarRoof },
    {
      key: 'bodega_borde',
      solid: true,
      draw: (p) => {
        solarRoof(p);
        p.rect(0, 0, 16, 2, '#e8ecf0').rect(0, 2, 16, 1, BOD.roofDark);
      },
    },
    {
      key: 'bodega_muro',
      solid: true,
      draw: (p) => {
        p.fill(BOD.wall);
        p.rect(0, 0, 16, 3, BOD.blue).rect(0, 3, 16, 1, BOD.yellow);
        for (let x = 0; x < 16; x += 4) p.rect(x, 4, 1, 12, BOD.wallDark);
        p.rect(0, 14, 16, 2, BOD.wallDark);
      },
    },
    {
      key: 'bodega_entrada',
      solid: true,
      draw: (p) => {
        p.fill(BOD.wall);
        p.rect(0, 0, 16, 3, BOD.blue).rect(0, 3, 16, 1, BOD.yellow);
        p.rect(1, 5, 14, 11, '#3a3c44').rect(2, 6, 12, 10, '#6a8cac').rect(7, 6, 2, 10, '#3a3c44').rect(3, 7, 3, 3, '#a8c4dc');
      },
    },
    {
      key: 'bodega_totem',
      solid: true,
      draw: (p) => {
        sidewalk(p);
        // El tótem azul de la foto, con su cuadro amarillo arriba.
        p.rect(5, 0, 6, 16, PAL.outline).rect(6, 0, 4, 15, BOD.blue).rect(6, 1, 4, 4, BOD.yellow).rect(7, 2, 2, 2, BOD.blue);
        p.rect(6, 7, 4, 1, '#f8f8f0').rect(6, 10, 4, 1, '#f8f8f0');
      },
    },

    // --- La torre del Bobo Unic Living ---
    { key: 'boho_techo', solid: true, draw: towerRoof },
    {
      key: 'boho_techo_equipo',
      solid: true,
      draw: (p) => {
        towerRoof(p);
        p.rect(3, 4, 10, 8, BOHO.roofDark).rect(3, 3, 10, 8, PAL.metal).rect(4, 4, 8, 1, PAL.metalLight).rect(6, 6, 4, 3, PAL.metalDark);
      },
    },
    {
      key: 'boho_borde',
      solid: true,
      draw: (p) => {
        towerRoof(p);
        p.rect(0, 0, 16, 3, '#ffffff').rect(0, 3, 16, 1, BOHO.roofDark);
      },
    },
    { key: 'boho_ladrillo', solid: true, draw: brickWindows },
    { key: 'boho_blanco', solid: true, draw: whiteWindows },
    {
      key: 'boho_base',
      solid: true,
      draw: (p) => {
        brickWall(p);
        p.rect(0, 0, 16, 2, BOHO.white);
        p.rect(1, 4, 14, 12, PAL.outline).rect(2, 5, 12, 11, BOHO.glass).rect(2, 5, 4, 6, BOHO.glassLight).rect(8, 5, 1, 11, PAL.outline);
      },
    },
    {
      key: 'boho_ojo',
      solid: true,
      draw: (p) => {
        // El podio de ladrillo con la ventana redonda (la de la foto, junto a la calle).
        brickWall(p);
        p.rect(0, 0, 16, 2, BOHO.white);
        p.rect(4, 4, 8, 8, PAL.outline).rect(3, 5, 10, 6, PAL.outline).rect(5, 5, 6, 6, BOHO.glass).rect(4, 6, 8, 4, BOHO.glass);
        p.rect(7, 5, 2, 6, BOHO.white).rect(4, 7, 8, 2, BOHO.white).rect(5, 6, 2, 1, BOHO.glassLight);
      },
    },
    {
      key: 'boho_puerta',
      solid: false,
      draw: (p) => {
        p.fill(LOB.stone);
        p.rect(0, 0, 16, 2, BOHO.white).rect(0, 2, 16, 14, PAL.outline).rect(1, 3, 6, 13, BOHO.glassLight).rect(9, 3, 6, 13, BOHO.glassLight);
        p.rect(1, 3, 2, 6, '#ffffff').rect(6, 9, 1, 3, PAL.metalDark).rect(9, 9, 1, 3, PAL.metalDark);
      },
    },
    {
      key: 'boho_letrero',
      solid: true,
      draw: (p) => {
        brickWall(p);
        p.rect(0, 0, 16, 2, BOHO.white).rect(1, 5, 14, 7, '#2a2433').rect(2, 6, 12, 5, '#f4efe4');
        p.rect(3, 7, 2, 3, BOHO.brick).rect(6, 7, 2, 3, BOHO.brick).rect(9, 7, 4, 1, PAL.outline).rect(9, 9, 4, 1, PAL.outline);
      },
    },
    {
      key: 'muro_ladrillo',
      solid: true,
      draw: (p) => {
        grass(p);
        p.rect(0, 4, 16, 10, BOHO.brickDark).rect(0, 4, 16, 2, BOHO.brickLight).rect(0, 6, 16, 6, BOHO.brick);
        for (let x = 2; x < 16; x += 5) p.rect(x, 7, 1, 4, BOHO.brickDark);
      },
    },
    {
      key: 'jardinera',
      solid: true,
      draw: (p) => {
        p.fill(LOB.stone);
        p.rect(1, 4, 14, 11, '#8a8478').rect(2, 5, 12, 9, '#5a3c28');
        p.rect(2, 2, 5, 6, PAL.leaf).rect(7, 1, 6, 7, PAL.leafLight).rect(4, 6, 8, 4, PAL.leafDark).px(5, 3, PAL.flowerRed).px(11, 4, PAL.flowerYellow);
      },
    },
    {
      key: 'plazoleta',
      solid: false,
      draw: (p) => {
        p.fill(LOB.stone);
        p.rect(0, 0, 8, 8, LOB.stoneLight).rect(8, 8, 8, 8, LOB.stoneLight).rect(7, 0, 1, 16, LOB.stoneDark).rect(0, 7, 16, 1, LOB.stoneDark);
      },
    },
    {
      key: 'reposera',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d0');
        p.rect(3, 1, 10, 14, PAL.outline).rect(4, 2, 8, 12, '#f8f8f0').rect(4, 2, 8, 4, '#e8a838').rect(4, 7, 8, 1, '#c8c0b0');
      },
    },

    // --- La esquina: Farmadía y el local de al lado ---
    {
      key: 'farma_fachada',
      solid: true,
      draw: (p) => {
        p.fill(FAR.wall);
        p.rect(0, 0, 16, 5, FAR.red).rect(0, 5, 16, 1, FAR.redDark).rect(3, 1, 2, 3, '#ffffff').rect(2, 2, 4, 1, '#ffffff');
        p.rect(1, 7, 14, 8, '#3a3c44').rect(2, 8, 12, 7, '#9cc4e0').rect(3, 9, 3, 3, '#d8ecf8');
        p.rect(0, 15, 16, 1, FAR.floorDark);
      },
    },
    {
      key: 'farma_entrada',
      solid: false,
      draw: (p) => {
        sidewalk(p);
        p.rect(0, 0, 16, 5, FAR.red).rect(0, 5, 16, 1, FAR.redDark);
        p.rect(1, 6, 14, 10, '#3a3c44').rect(2, 7, 5, 9, '#c8e4f4').rect(9, 7, 5, 9, '#c8e4f4').rect(2, 7, 2, 4, '#ffffff');
      },
    },
    {
      key: 'local_fachada',
      solid: true,
      draw: (p) => {
        p.fill('#e8d8b8');
        for (let x = 0; x < 16; x += 4) p.rect(x, 1, 2, 4, '#3c8c5c').rect(x + 2, 1, 2, 4, PAL.white);
        p.rect(1, 7, 14, 8, '#7a5c3c').rect(2, 8, 12, 6, PAL.glass).rect(3, 8, 2, 3, PAL.glassLight);
      },
    },
    // La Espiga: toldo a rayas rojo y crema (el de la viñeta), vitrina iluminada con pan y una puerta que se lee como tal.
    {
      key: 'espiga_vitrina',
      solid: true,
      draw: (p) => {
        espigaFront(p);
        p.rect(1, 7, 14, 8, PAL.outline).rect(2, 8, 12, 6, ESP.glow).rect(2, 11, 12, 1, ESP.shelf);
        p.rect(3, 9, 3, 2, ESP.bread).rect(7, 9, 3, 2, ESP.breadDark).rect(11, 9, 2, 2, ESP.bread);
        p.rect(3, 12, 2, 2, ESP.breadDark).rect(6, 12, 3, 2, ESP.bread).rect(10, 12, 3, 2, ESP.breadDark);
        p.px(4, 9, ESP.crumb).px(8, 9, ESP.crumb).px(7, 12, ESP.crumb);
      },
    },
    {
      key: 'espiga_puerta',
      solid: true,
      draw: (p) => {
        espigaFront(p);
        // La puerta abierta: el marco oscuro, el local iluminado por dentro y la hoja de madera abierta hacia un lado,
        // para que se lea como entrada y no como otra vitrina.
        p.rect(2, 5, 12, 11, PAL.outline).rect(3, 6, 10, 10, ESP.inside).rect(3, 13, 10, 3, ESP.insideFloor);
        p.rect(7, 9, 5, 3, ESP.counter).rect(8, 8, 1, 1, ESP.bread).rect(10, 8, 1, 1, ESP.breadDark);
        p.rect(3, 6, 3, 10, ESP.wood).rect(3, 6, 1, 10, ESP.woodLight).rect(5, 10, 1, 2, ESP.handle);
        // El cartelito verde de ABIERTO colgando del marco.
        p.rect(8, 5, 4, 2, ESP.sign).rect(9, 5, 2, 1, '#ffffff');
      },
    },
    {
      // El felpudo frente a la puerta de La Espiga: marca dónde pararse para entrar.
      key: 'espiga_felpudo',
      solid: false,
      draw: (p) => {
        sidewalk(p);
        p.rect(2, 1, 12, 9, PAL.outline).rect(3, 2, 10, 7, ESP.mat).rect(4, 3, 8, 5, ESP.matLight);
        p.rect(5, 4, 1, 3, ESP.mat).rect(7, 4, 2, 3, ESP.mat).rect(10, 4, 1, 3, ESP.mat);
      },
    },

    // --- Lobby ---
    { key: 'lobby_piso', solid: false, draw: lobbyFloor },
    {
      key: 'lobby_alfombra',
      solid: false,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(0, 1, 16, 14, '#3c5c6c').rect(0, 2, 16, 1, '#e8c070').rect(0, 13, 16, 1, '#e8c070');
      },
    },
    {
      key: 'lobby_muro',
      solid: true,
      draw: (p) => {
        p.fill(LOB.wall);
        p.rect(0, 0, 16, 1, LOB.wallDark);
        for (let x = 0; x < 16; x += 4) p.rect(x, 6, 3, 10, LOB.wood).rect(x + 3, 6, 1, 10, LOB.woodDark);
        p.rect(0, 5, 16, 1, LOB.woodDark);
      },
    },
    {
      key: 'lobby_ventanal',
      solid: true,
      draw: (p) => {
        p.fill(LOB.wall);
        p.rect(0, 1, 16, 15, '#3a3c44').rect(1, 2, 14, 13, '#9cc4dc').rect(1, 9, 14, 6, '#78b060').rect(3, 3, 3, 4, '#d8ecf8').rect(8, 2, 1, 13, '#3a3c44');
      },
    },
    {
      key: 'lobby_cuadro',
      solid: true,
      draw: (p) => {
        p.fill(LOB.wall);
        p.rect(0, 0, 16, 1, LOB.wallDark);
        // Letrero de la residencia: B·U·L en ladrillo sobre fondo crema.
        p.rect(1, 3, 14, 10, PAL.outline).rect(2, 4, 12, 8, '#f4efe4');
        p.rect(3, 6, 2, 4, BOHO.brick).rect(7, 6, 2, 4, BOHO.brick).rect(11, 6, 2, 4, BOHO.brick);
      },
    },
    {
      key: 'recepcion',
      solid: true,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(0, 2, 16, 13, LOB.woodDark).rect(0, 2, 16, 4, '#f4efe4').rect(0, 6, 16, 1, LOB.stoneDark).rect(0, 7, 16, 7, LOB.wood);
        p.rect(3, 9, 10, 1, LOB.woodDark).rect(10, 3, 4, 2, '#3a3c44');
      },
    },
    {
      key: 'recepcion_timbre',
      solid: true,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(0, 2, 16, 13, LOB.woodDark).rect(0, 2, 16, 4, '#f4efe4').rect(0, 6, 16, 1, LOB.stoneDark).rect(0, 7, 16, 7, LOB.wood);
        p.rect(6, 2, 4, 3, '#c8a838').rect(7, 1, 2, 1, '#e8c858');
        p.rect(1, 3, 4, 3, '#f8f8f0').rect(2, 4, 2, 1, '#5a8ce8');
      },
    },
    {
      key: 'buzones',
      solid: true,
      draw: (p) => {
        p.fill(LOB.wall);
        p.rect(1, 2, 14, 13, PAL.metalDark);
        for (let y = 3; y < 14; y += 4) for (let x = 2; x < 14; x += 4) p.rect(x, y, 3, 3, PAL.metal).px(x + 1, y + 1, PAL.outline);
      },
    },
    {
      key: 'lobby_sofa',
      solid: true,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(0, 1, 16, 14, LOB.sofaDark).rect(0, 1, 16, 5, LOB.sofa).rect(1, 6, 14, 8, LOB.sofaLight).rect(7, 6, 1, 8, LOB.sofaDark);
      },
    },
    {
      key: 'lobby_planta',
      solid: true,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(4, 10, 8, 5, '#f4efe4').rect(4, 10, 8, 1, '#ffffff');
        p.rect(3, 2, 10, 8, PAL.leaf).rect(5, 0, 6, 4, PAL.leafLight).rect(2, 6, 3, 3, PAL.leafDark).rect(11, 5, 3, 3, PAL.leafDark);
      },
    },
    {
      key: 'lobby_puerta',
      solid: false,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(0, 0, 16, 16, '#3a3c44').rect(1, 1, 6, 15, '#b8d8ec').rect(9, 1, 6, 15, '#b8d8ec').rect(1, 1, 2, 6, '#e8f4fc');
      },
    },
    {
      key: 'lobby_mesa',
      solid: true,
      draw: (p) => {
        lobbyFloor(p);
        p.rect(2, 4, 12, 9, PAL.outline).rect(3, 5, 10, 7, '#c8b090').rect(4, 6, 4, 2, '#e8d4b4');
        p.rect(9, 7, 3, 3, '#5a8ce8').rect(10, 6, 1, 1, '#f8f8f0');
      },
    },
    {
      key: 'escalera_edificio',
      solid: true,
      draw: (p) => {
        p.fill(LOB.wall);
        p.rect(1, 1, 14, 15, '#8a8478');
        for (let y = 2; y < 16; y += 3) p.rect(2, y, 12, 2, '#c8c0b0');
        p.rect(3, 0, 10, 2, '#2c9c4c').rect(5, 0, 1, 1, '#f8f8f0');
      },
    },

    // --- Piso 8: pasillo ---
    { key: 'pasillo_piso', solid: false, draw: hallFloor },
    {
      key: 'pasillo_muro',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d4');
        p.rect(0, 0, 16, 1, '#c8bcaa').rect(0, 12, 16, 4, '#a89c8a').rect(0, 12, 16, 1, '#c8bcaa');
        p.rect(6, 4, 4, 3, '#f8f4c8').rect(7, 7, 2, 1, '#c8bcaa');
      },
    },
    {
      key: 'puerta_depa',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d4');
        p.rect(2, 0, 12, 16, PAL.outline).rect(3, 1, 10, 15, '#7a4c30').rect(4, 2, 8, 6, '#8a5a3a').rect(4, 9, 8, 6, '#8a5a3a');
        p.rect(11, 8, 1, 2, '#e8c858').rect(7, 3, 2, 1, '#e8c858');
      },
    },
    {
      key: 'puerta_805',
      solid: false,
      draw: (p) => {
        hallFloor(p);
        p.rect(2, 0, 12, 4, PAL.outline).rect(3, 0, 10, 3, '#7a4c30').rect(6, 1, 4, 1, '#e8c858');
      },
    },
    {
      key: 'ventana_pasillo',
      solid: true,
      draw: (p) => {
        p.fill('#e8e0d4');
        p.rect(1, 1, 14, 11, '#3a3c44').rect(2, 2, 12, 9, '#88b8e0').rect(2, 7, 12, 4, '#4c8c58').rect(3, 6, 4, 2, '#3c7c58').rect(9, 5, 4, 3, '#3c7c58');
        p.rect(0, 12, 16, 4, '#a89c8a');
      },
    },

    // --- El depa 805 ---
    { key: 'depa_piso', solid: false, draw: depaFloor },
    {
      key: 'depa_alfombra',
      solid: false,
      draw: (p) => {
        depaFloor(p);
        p.rect(0, 1, 16, 14, DEPA.carpet).rect(0, 2, 16, 1, '#e8c070').rect(0, 13, 16, 1, '#e8c070').rect(4, 6, 8, 4, '#c87060');
      },
    },
    { key: 'depa_muro', solid: true, draw: depaWall },
    {
      key: 'depa_ventanal',
      solid: true,
      draw: (p) => {
        // El ventanal del piso 8: los Farallones al fondo y Pance abajo, verde.
        depaWall(p);
        p.rect(0, 1, 16, 13, '#3a3c44').rect(1, 2, 14, 11, '#a8d0ec');
        p.rect(1, 6, 14, 3, '#5a8c78').rect(1, 5, 5, 2, '#6a9c88').rect(8, 4, 6, 3, '#6a9c88').rect(1, 9, 14, 4, '#58a048').rect(3, 10, 3, 2, '#e8e0d0').rect(10, 11, 2, 1, '#d4703c');
        p.rect(8, 2, 1, 11, '#3a3c44').rect(2, 2, 3, 1, '#ffffff');
      },
    },
    {
      key: 'depa_cuadro',
      solid: true,
      draw: (p) => {
        depaWall(p);
        // Un póster de Valparaíso (para no extrañar tanto): cerros de colores.
        p.rect(3, 2, 10, 10, PAL.outline).rect(4, 3, 8, 8, '#88c0e8').rect(4, 8, 8, 3, '#3c6ca8');
        p.rect(4, 6, 2, 2, '#e85a5a').rect(6, 5, 2, 3, '#f0c830').rect(8, 6, 2, 2, '#58b868').rect(10, 5, 2, 3, '#c868c8');
      },
    },
    { key: 'depa_meson', solid: true, draw: counterTop },
    {
      key: 'depa_cocina',
      solid: true,
      draw: (p) => {
        counterTop(p);
        p.rect(1, 0, 14, 6, '#2a2a30');
        for (const x of [4, 11]) p.rect(x - 2, 1, 4, 4, '#3a3a44').rect(x - 1, 2, 2, 2, '#5a5a64');
        p.rect(2, 7, 12, 6, '#3a3a44').rect(3, 8, 10, 4, '#1c1c24').rect(3, 8, 10, 1, '#5a5a64');
      },
    },
    {
      key: 'depa_lavaplatos',
      solid: true,
      draw: (p) => {
        counterTop(p);
        p.rect(3, 1, 10, 4, '#9ca4b0').rect(4, 2, 8, 2, '#c8d0dc').rect(7, 0, 2, 2, PAL.metalDark);
      },
    },
    {
      key: 'depa_refri',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(2, 0, 12, 16, PAL.outline).rect(3, 0, 10, 15, '#e8ecf0').rect(3, 6, 10, 1, '#b8c0c8').rect(11, 2, 1, 3, '#9ca4b0').rect(11, 8, 1, 4, '#9ca4b0');
        p.rect(4, 9, 3, 3, '#f0c830').rect(8, 10, 2, 2, '#e85a5a');
      },
    },
    {
      key: 'depa_mesa',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(1, 2, 14, 12, PAL.outline).rect(2, 3, 12, 10, '#f4f0e8').rect(2, 3, 12, 1, '#ffffff').rect(6, 6, 4, 4, '#d8e8d0').rect(7, 5, 2, 2, '#58a048');
      },
    },
    {
      key: 'depa_silla',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(3, 3, 10, 11, PAL.outline).rect(4, 4, 8, 6, '#3a3c44').rect(4, 10, 8, 3, '#5a5c66');
      },
    },
    {
      key: 'depa_silla_n',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(3, 2, 10, 11, PAL.outline).rect(4, 3, 8, 3, '#5a5c66').rect(4, 6, 8, 6, '#3a3c44');
      },
    },
    {
      key: 'depa_sofa',
      solid: true,
      draw: (p) => {
        // Respaldo abajo: se sientan mirando la tele (arriba).
        depaFloor(p);
        p.rect(0, 2, 16, 14, DEPA.sofaDark).rect(1, 3, 14, 7, DEPA.sofaLight).rect(0, 10, 16, 5, DEPA.sofa).rect(0, 10, 16, 1, DEPA.sofaLight);
        p.rect(7, 3, 1, 7, DEPA.sofaDark);
      },
    },
    {
      key: 'depa_tv',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(0, 9, 16, 6, '#5a3c28').rect(0, 9, 16, 1, '#7a5438');
        p.rect(1, 0, 14, 10, PAL.outline).rect(2, 1, 12, 7, '#1c2440').rect(3, 2, 4, 2, '#2c3c68').rect(7, 8, 2, 1, '#3a3c44');
      },
    },
    { key: 'depa_cama_i', solid: true, draw: (p) => doubleBed(p, 'i') },
    { key: 'depa_cama_d', solid: true, draw: (p) => doubleBed(p, 'd') },
    { key: 'depa_cama_pies_i', solid: true, draw: (p) => doubleBed(p, 'pies_i') },
    { key: 'depa_cama_pies_d', solid: true, draw: (p) => doubleBed(p, 'pies_d') },
    {
      key: 'depa_velador',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(2, 4, 12, 10, '#6a4028').rect(2, 4, 12, 9, '#8a5a3a').rect(3, 8, 10, 1, '#6a4028');
        p.rect(5, 0, 6, 4, '#f4e0a0').rect(7, 4, 2, 2, '#c8a838');
      },
    },
    {
      key: 'depa_closet',
      solid: true,
      draw: (p) => {
        depaWall(p);
        p.rect(1, 0, 14, 16, PAL.outline).rect(2, 1, 6, 15, '#e8dcc8').rect(8, 1, 6, 15, '#e8dcc8').rect(7, 6, 1, 3, '#8a7a64').rect(8, 6, 1, 3, '#8a7a64');
      },
    },
    {
      key: 'depa_estante',
      solid: true,
      draw: (p) => {
        depaWall(p);
        p.rect(1, 1, 14, 14, '#6a4028');
        for (const y of [2, 7]) {
          p.rect(2, y + 4, 12, 1, '#4a2c18');
          for (let x = 2; x < 13; x += 2) p.rect(x, y + 1 - (x % 3 === 0 ? 1 : 0), 2, 3 + (x % 3 === 0 ? 1 : 0), PRODUCTS[(x + y) % PRODUCTS.length]);
        }
      },
    },
    {
      key: 'depa_planta',
      solid: true,
      draw: (p) => {
        depaFloor(p);
        p.rect(5, 10, 6, 5, '#d4703c').rect(5, 10, 6, 1, '#e88c58');
        p.rect(4, 3, 8, 7, PAL.leaf).rect(6, 1, 4, 3, PAL.leafLight).rect(3, 6, 2, 3, PAL.leafDark).rect(11, 5, 2, 3, PAL.leafDark);
      },
    },
    { key: 'depa_bano', solid: false, draw: bathFloor },
    {
      key: 'depa_bano_muro',
      solid: true,
      draw: (p) => {
        p.fill('#dce8ec');
        p.rect(0, 0, 16, 1, '#b8c8d0');
        for (let y = 4; y < 16; y += 4) p.rect(0, y, 16, 1, '#c4d4dc');
        for (let x = 3; x < 16; x += 4) p.rect(x, 0, 1, 16, '#c4d4dc');
      },
    },

    // --- Farmadía por dentro ---
    { key: 'farma_piso', solid: false, draw: farmaFloor },
    {
      key: 'farma_muro',
      solid: true,
      draw: (p) => {
        p.fill(FAR.wall);
        p.rect(0, 0, 16, 1, FAR.floorDark).rect(0, 4, 16, 3, FAR.red).rect(0, 7, 16, 1, FAR.redDark).rect(0, 13, 16, 3, '#e4e4de');
      },
    },
    {
      key: 'farma_letrero',
      solid: true,
      draw: (p) => {
        p.fill(FAR.wall);
        p.rect(0, 0, 16, 1, FAR.floorDark).rect(1, 2, 14, 9, FAR.red).rect(6, 3, 4, 7, '#ffffff').rect(3, 5, 10, 3, '#ffffff').rect(0, 13, 16, 3, '#e4e4de');
      },
    },
    { key: 'farma_estante', solid: true, draw: (p) => farmaShelf(p, 0, false) },
    { key: 'farma_estante_b', solid: true, draw: (p) => farmaShelf(p, 3, true) },
    {
      key: 'farma_nevera',
      solid: true,
      draw: (p) => {
        // La nevera de las bebidas: botellas doradas (La Caleña), negras (Coca-Kola) y rojas (Rojosazón).
        p.fill(FAR.wall);
        p.rect(0, 0, 16, 16, '#3a3c44').rect(1, 1, 14, 14, '#c8e4f0');
        const colors = ['#e8b030', '#3a2418', '#d83c3c'];
        for (const y of [2, 9]) {
          p.rect(1, y + 5, 14, 1, '#8a9ca8');
          for (let i = 0; i < 4; i++) {
            const c = colors[(i + y) % 3];
            p.rect(2 + i * 3, y + 1, 2, 4, c).px(2 + i * 3, y, '#8a9ca8').px(2 + i * 3, y + 2, '#ffffff');
          }
        }
        p.rect(7, 1, 1, 14, '#3a3c44');
      },
    },
    {
      key: 'farma_caja',
      solid: true,
      draw: (p) => {
        farmaFloor(p);
        p.rect(0, 3, 16, 12, '#c8ccd4').rect(0, 3, 16, 4, '#f4f4f0').rect(0, 7, 16, 1, '#9ca2ae');
        p.rect(3, 0, 7, 6, PAL.outline).rect(4, 1, 5, 3, '#3a7c5a').rect(11, 2, 3, 3, '#e85a5a');
      },
    },
    {
      key: 'farma_mostrador',
      solid: true,
      draw: (p) => {
        farmaFloor(p);
        p.rect(0, 3, 16, 12, '#c8ccd4').rect(0, 3, 16, 4, '#f4f4f0').rect(0, 7, 16, 1, '#9ca2ae');
        for (let x = 2; x < 15; x += 4) p.rect(x, 1, 2, 4, PRODUCTS[x % PRODUCTS.length]);
      },
    },
    {
      key: 'farma_puerta',
      solid: false,
      draw: (p) => {
        farmaFloor(p);
        p.rect(0, 0, 16, 16, '#3a3c44').rect(1, 1, 6, 15, '#c8e4f4').rect(9, 1, 6, 15, '#c8e4f4').rect(1, 1, 2, 5, '#ffffff');
      },
    },
  ];
}
