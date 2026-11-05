import { BUILDING_STYLES, PAL, shade, type BuildingStyle } from './palette';
import { Painter } from './Painter';
import { m5Tiles } from './tiles_m5';
import { m6Tiles } from './tiles_m6';

export interface TileDef {
  key: string;
  solid: boolean;
  draw: (p: Painter) => void;
}

// ---------------------------------------------------------------------------
// Fondos reutilizables
// ---------------------------------------------------------------------------

function grass(p: Painter): void {
  p.fill(PAL.grass);
  const tufts: Array<[number, number]> = [
    [2, 3],
    [10, 2],
    [6, 8],
    [12, 11],
    [2, 12],
  ];
  for (const [x, y] of tufts) {
    p.px(x, y, PAL.grassDark).px(x + 2, y, PAL.grassDark).px(x + 1, y + 1, PAL.grassDark);
    p.px(x + 1, y, PAL.grassLight);
  }
}

function sidewalk(p: Painter): void {
  p.fill(PAL.walk);
  p.rect(0, 0, 16, 1, PAL.walkLight).rect(0, 8, 16, 1, PAL.walkLight);
  p.rect(0, 7, 16, 1, PAL.walkDark).rect(0, 15, 16, 1, PAL.walkDark);
  p.rect(3, 0, 1, 7, PAL.walkDark).rect(11, 8, 1, 7, PAL.walkDark);
}

function cobble(p: Painter): void {
  p.fill(PAL.cobble);
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y + 3, 16, 1, PAL.cobbleDark);
    const off = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = off; x < 16; x += 8) p.rect(x, y, 1, 3, PAL.cobbleDark);
    p.rect(0, y, 16, 1, PAL.cobbleLight);
  }
}

function bench(p: Painter): void {
  p.rect(2, 4, 12, 3, PAL.wood).rect(2, 4, 12, 1, '#c89060');
  p.rect(2, 8, 12, 3, PAL.wood).rect(2, 10, 12, 1, PAL.woodDark);
  p.rect(3, 11, 1, 3, PAL.metalDark).rect(12, 11, 1, 3, PAL.metalDark);
}

function road(p: Painter): void {
  p.fill(PAL.road);
  p.speckle(17, 8, PAL.roadDark);
  p.speckle(91, 5, PAL.roadLight);
}

// --- Costanera (mall) ---
const MALL = {
  floor: '#ece6dc',
  floorDark: '#ddd4c6',
  floorLight: '#f8f4ec',
  wall: '#f4f1ea',
  wallDark: '#c9c1b2',
  trim: '#8a96a8',
  void: '#2a3040',
};

function mallFloor(p: Painter): void {
  p.fill(MALL.floor);
  p.rect(0, 15, 16, 1, MALL.floorDark).rect(15, 0, 1, 16, MALL.floorDark);
  p.px(4, 5, MALL.floorLight).px(5, 6, MALL.floorLight).px(11, 10, MALL.floorDark).px(12, 11, MALL.floorDark);
}

const SHOP_COLORS = ['#d8232a', '#2f6fd0', '#3cb46c', '#e8a030', '#9c5cc8'];

function mallShop(p: Painter, awning: string): void {
  p.fill(MALL.wall);
  p.rect(0, 0, 16, 3, awning).rect(0, 3, 16, 1, 'rgba(0,0,0,0.25)');
  p.rect(1, 5, 14, 10, MALL.trim).rect(2, 6, 12, 8, PAL.glass);
  p.rect(3, 7, 3, 4, PAL.glassLight).rect(8, 10, 5, 3, 'rgba(255,255,255,0.35)');
  p.rect(0, 15, 16, 1, MALL.wallDark);
}

function escalator(p: Painter, up: boolean): void {
  mallFloor(p);
  p.rect(2, 0, 12, 16, '#5a5c68');
  for (let y = 1; y < 16; y += 3) p.rect(3, y, 10, 2, '#9aa0ac');
  p.rect(1, 0, 1, 16, PAL.metalDark).rect(14, 0, 1, 16, PAL.metalDark);
  const c = up ? PAL.green : PAL.yellow;
  if (up) p.rect(7, 3, 2, 8, c).rect(5, 5, 6, 2, c).rect(6, 4, 4, 1, c);
  else p.rect(7, 4, 2, 8, c).rect(5, 9, 6, 2, c).rect(6, 11, 4, 1, c);
}

// --- Casa (misión 2) ---
const HOME = {
  wood: '#c8925a',
  woodDark: '#a87440',
  woodLight: '#dcaa72',
  wall: '#efe2c4',
  wallDark: '#cdb994',
  wallPattern: '#e2d2ae',
  base: '#8a5c38',
  tile: '#e4ecef',
  tileDark: '#c4d0d6',
};

function homeFloor(p: Painter): void {
  p.fill(HOME.wood);
  for (const y of [3, 7, 11, 15]) p.rect(0, y, 16, 1, HOME.woodDark);
  p.rect(5, 0, 1, 3, HOME.woodDark).rect(12, 4, 1, 3, HOME.woodDark).rect(3, 8, 1, 3, HOME.woodDark).rect(10, 12, 1, 3, HOME.woodDark);
  p.rect(1, 1, 3, 1, HOME.woodLight).rect(8, 9, 4, 1, HOME.woodLight);
}

function homeTile(p: Painter): void {
  p.fill(HOME.tile);
  p.rect(0, 7, 16, 1, HOME.tileDark).rect(0, 15, 16, 1, HOME.tileDark).rect(7, 0, 1, 16, HOME.tileDark).rect(15, 0, 1, 16, HOME.tileDark);
}

function homeWall(p: Painter): void {
  p.fill(HOME.wall);
  for (let x = 1; x < 16; x += 4) p.rect(x, 2, 1, 10, HOME.wallPattern);
  p.rect(0, 0, 16, 1, HOME.wallDark).rect(0, 12, 16, 4, HOME.base).rect(0, 12, 16, 1, '#a87448');
}

/** Mesa de madera vista desde arriba (con mantel). */
function homeTable(p: Painter, base: (p: Painter) => void): void {
  base(p);
  p.rect(0, 2, 16, 12, HOME.woodDark).rect(0, 2, 16, 11, '#b07848');
  p.rect(2, 3, 12, 9, '#f4f0e4').rect(2, 11, 12, 1, '#d8d0bc');
}

/** Silla con respaldo abajo (se sienta mirando hacia la mesa de arriba). */
function chair(p: Painter, base: (p: Painter) => void): void {
  base(p);
  p.rect(3, 2, 10, 9, HOME.woodDark).rect(3, 2, 10, 8, '#b88050').rect(4, 3, 8, 1, HOME.woodLight);
  p.rect(2, 10, 12, 4, HOME.woodDark).rect(3, 10, 10, 2, '#9a6838');
}

function bed(p: Painter, part: 'cabecera' | 'pies'): void {
  homeFloor(p);
  if (part === 'cabecera') {
    p.rect(1, 0, 14, 16, HOME.woodDark).rect(2, 1, 12, 15, '#3c6cb8');
    p.rect(2, 1, 12, 7, '#f4f4f0').rect(3, 2, 10, 5, '#ffffff').rect(2, 7, 12, 1, '#d8d8d0');
    p.rect(2, 9, 12, 1, '#5a8ad8').rect(2, 12, 12, 1, '#2f5aa0');
  } else {
    p.rect(1, 0, 14, 14, HOME.woodDark).rect(2, 0, 12, 13, '#3c6cb8');
    p.rect(2, 3, 12, 1, '#5a8ad8').rect(2, 8, 12, 1, '#2f5aa0').rect(1, 13, 14, 2, '#7a4c30');
  }
}

function sinkCounter(p: Painter, dishes: boolean): void {
  homeTile(p);
  p.rect(0, 2, 16, 12, '#8a8e98').rect(0, 2, 16, 11, '#b8bcc6').rect(0, 2, 16, 1, '#d8dce4');
  p.rect(3, 4, 10, 7, '#7a808c').rect(4, 5, 8, 5, '#9aa4b0');
  p.rect(7, 2, 2, 3, PAL.metalDark);
  if (dishes) p.rect(4, 6, 5, 3, '#f4f4f0').rect(7, 5, 4, 3, '#e8e4d8').rect(5, 7, 2, 1, '#c8a060');
}
// --- Universidad (misión 2) ---
const UNI = {
  floor: '#dfe2e6',
  floorDark: '#c6cad2',
  floorLight: '#eef0f3',
  wall: '#f2f0ea',
  wallDark: '#c8c4ba',
  stripe: '#7a2a3c',
  door: '#8a5a3a',
  doorDark: '#6a4028',
};

function uniFloor(p: Painter): void {
  p.fill(UNI.floor);
  p.rect(0, 0, 16, 1, UNI.floorLight).rect(0, 15, 16, 1, UNI.floorDark).rect(15, 0, 1, 16, UNI.floorDark);
  p.px(4, 6, UNI.floorLight).px(11, 11, UNI.floorDark);
}

function uniWall(p: Painter): void {
  p.fill(UNI.wall);
  p.rect(0, 0, 16, 2, UNI.wallDark).rect(0, 8, 16, 2, UNI.stripe).rect(0, 14, 16, 2, '#9a968c');
}

// --- Misión 3: restorán, auto, aeropuertos, avión y furgón ---
const RESTO = { a: '#e8d8b8', b: '#c86848', wall: '#f4e8cc', wood: '#8a5430', woodDark: '#6a3c20', cloth: '#d84848' };

function restoFloor(p: Painter): void {
  // Baldosa de greda en damero.
  p.fill(RESTO.a).rect(0, 0, 8, 8, RESTO.b).rect(8, 8, 8, 8, RESTO.b);
  p.rect(0, 15, 16, 1, '#b89878').rect(15, 0, 1, 16, '#b89878');
}

function restoWall(p: Painter): void {
  p.fill(RESTO.wall);
  p.rect(0, 0, 16, 1, '#d8c8a8').rect(0, 9, 16, 7, RESTO.wood).rect(0, 9, 16, 1, '#a86c40');
  for (let x = 1; x < 16; x += 4) p.rect(x, 10, 1, 6, RESTO.woodDark);
}

/** Mesa con mantel cuadrillé rojo y blanco. */
function restoTable(p: Painter): void {
  restoFloor(p);
  p.rect(0, 2, 16, 12, RESTO.woodDark).rect(0, 2, 16, 11, '#f4f0e4');
  for (let y = 2; y < 13; y += 4) for (let x = 0; x < 16; x += 4) p.rect(x + ((y / 2) % 4 === 1 ? 2 : 0), y, 2, 2, RESTO.cloth);
  p.rect(0, 12, 16, 1, '#c8c0b0');
}

/** Silla del restorán: respaldo abajo (mira hacia la mesa de arriba) o arriba (mira hacia abajo). */
function restoChair(p: Painter, back: 'bottom' | 'top'): void {
  restoFloor(p);
  const by = back === 'bottom' ? 10 : 1;
  const sy = back === 'bottom' ? 2 : 6;
  p.rect(3, sy, 10, 8, RESTO.woodDark).rect(3, sy, 10, 7, '#a86c40').rect(4, sy + 1, 8, 1, '#c88c58');
  p.rect(2, by, 12, 4, RESTO.woodDark).rect(3, by, 10, 2, '#8a5430');
}

const AERO = {
  floor: '#e4e0d8',
  floorDark: '#ccc6ba',
  floorLight: '#f4f2ec',
  wall: '#f0eee8',
  wood: '#c89a68',
  woodDark: '#9a7048',
  night: '#141c34',
  carpet: '#5a6478',
  carpetDark: '#4a5266',
};

function aeroFloor(p: Painter): void {
  // Losas grandes de piedra pulida con un brillo.
  p.fill(AERO.floor);
  p.rect(0, 15, 16, 1, AERO.floorDark).rect(15, 0, 1, 16, AERO.floorDark);
  p.rect(2, 2, 5, 1, AERO.floorLight).rect(2, 3, 2, 1, AERO.floorLight).px(11, 9, AERO.floorLight);
}

function aeroCarpet(p: Painter): void {
  p.fill(AERO.carpet);
  for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) p.px(x, y, AERO.carpetDark);
}

/** Muro del terminal: cielo de listones de madera arriba (como el del T2) y zócalo gris. */
function aeroWall(p: Painter): void {
  p.fill(AERO.wall);
  p.rect(0, 0, 16, 4, AERO.wood);
  for (let x = 1; x < 16; x += 3) p.rect(x, 0, 1, 4, AERO.woodDark);
  p.rect(0, 13, 16, 3, '#8a8e98').rect(0, 13, 16, 1, '#a8acb6');
}

/** Ventanal a la losa de noche: luces de pista y, a veces, la cola de un avión. */
function aeroWindow(p: Painter, plane: boolean): void {
  p.fill(AERO.night);
  p.rect(0, 9, 16, 4, '#2a3048').px(2, 11, '#f0d048').px(9, 11, '#58c8f0').px(14, 11, '#f0d048');
  p.px(4, 2, '#c8d0f0').px(12, 4, '#8890b8');
  if (plane) p.rect(5, 2, 4, 8, '#e8ecf0').rect(5, 2, 4, 3, '#2f6fd0').rect(9, 7, 3, 2, '#c8ccd4').px(6, 3, '#f0d048');
  p.rect(0, 0, 16, 1, PAL.metalDark).rect(7, 0, 1, 13, PAL.metalDark);
  p.rect(0, 13, 16, 3, '#8a8e98').rect(0, 13, 16, 1, '#a8acb6');
}

function seatAero(p: Painter, back: 'top' | 'bottom'): void {
  aeroCarpet(p);
  const by = back === 'top' ? 1 : 11;
  const sy = back === 'top' ? 5 : 3;
  p.rect(1, sy, 14, 8, '#1e2028').rect(1, sy, 14, 7, '#34363e').rect(2, sy + 1, 12, 1, '#4a4c56');
  p.rect(1, by, 14, 4, '#1e2028').rect(1, by, 14, 3, '#34363e');
  p.rect(0, sy - 1, 1, 10, PAL.metalLight).rect(15, sy - 1, 1, 10, PAL.metalLight);
}

/** Asiento del avión (o del auto, o del furgón): mira hacia adelante, a la izquierda (respaldo a la derecha). */
function forwardSeat(p: Painter, base: (p: Painter) => void, seat: string, dark: string, light: string, headrest?: string): void {
  base(p);
  p.rect(1, 3, 11, 10, dark).rect(1, 3, 11, 9, seat).rect(2, 4, 9, 1, light);
  p.rect(11, 1, 4, 14, dark).rect(11, 1, 3, 13, seat).rect(12, 2, 1, 11, light);
  if (headrest) p.rect(11, 5, 3, 6, headrest);
}

const PLANE = { floor: '#4a5a8a', floorDark: '#3a4872', wall: '#eceef2', wallDark: '#c8ccd4', seat: '#2f4a8c', seatDark: '#1e3060', seatLight: '#4a6ab8' };

function planeFloor(p: Painter): void {
  p.fill(PLANE.floor);
  for (let y = 2; y < 16; y += 5) p.rect(0, y, 16, 1, PLANE.floorDark);
  p.px(4, 4, '#5a6a9c').px(11, 12, '#5a6a9c');
}

function planeWall(p: Painter, window: boolean): void {
  p.fill(PLANE.wall);
  p.rect(0, 0, 16, 2, PLANE.wallDark).rect(0, 14, 16, 2, PLANE.wallDark);
  if (!window) return;
  // Ventanilla ovalada con el cielo de noche.
  p.rect(5, 3, 6, 10, '#9aa0aa').rect(6, 4, 4, 8, '#18203c').rect(5, 4, 1, 8, '#9aa0aa').rect(10, 4, 1, 8, '#9aa0aa');
  p.px(7, 6, '#e8ecf8').px(8, 9, '#8890c0');
}

const VAN = { floor: '#5c5e66', seat: '#5a6070', seatDark: '#3c404c', seatLight: '#7a8090' };

function floor(p: Painter): void {
  p.fill(PAL.floor);
  p.rect(0, 7, 16, 1, PAL.floorDark).rect(0, 15, 16, 1, PAL.floorDark);
  p.rect(7, 0, 1, 16, PAL.floorDark).rect(15, 0, 1, 16, PAL.floorDark);
}

function trainFloor(p: Painter): void {
  p.fill(PAL.trainFloor);
  for (let y = 1; y < 16; y += 4) p.rect(0, y, 16, 1, PAL.trainFloorDark);
}

function busFloor(p: Painter): void {
  p.fill(PAL.busFloor);
  for (let x = 1; x < 16; x += 3) p.rect(x, 0, 1, 16, PAL.busFloorDark);
}

/** Asiento rojo del vagón, con respaldo contra la pared de arriba o de abajo. */
function metroSeat(p: Painter, back: 'top' | 'bottom'): void {
  trainFloor(p);
  const by = back === 'top' ? 1 : 11;
  const sy = back === 'top' ? 5 : 3;
  p.rect(1, sy, 14, 8, PAL.seatMetroDark).rect(1, sy, 14, 7, PAL.seatMetro).rect(2, sy + 1, 12, 1, PAL.seatMetroLight);
  p.rect(7, sy, 1, 7, PAL.seatMetroDark);
  p.rect(1, by, 14, 4, PAL.seatMetroDark).rect(1, by, 14, 3, PAL.seatMetro);
  p.rect(0, sy, 1, 8, PAL.metal).rect(15, sy, 1, 8, PAL.metal);
}

// --- Interior del tren EFE (misión 2) ---
const EFE = { floor: '#6c7078', floorDark: '#5c6068', seat: '#2f4a7c', seatDark: '#1e3058', seatLight: '#4a6aa8', wall: '#eef0f2', wallDark: '#c4c8cf', red: '#d8232a' };

function efeFloor(p: Painter): void {
  p.fill(EFE.floor);
  for (let x = 2; x < 16; x += 5) p.rect(x, 0, 1, 16, EFE.floorDark);
}

/** Asiento azul del tren EFE, con respaldo contra la pared de arriba o de abajo. */
function efeSeat(p: Painter, back: 'top' | 'bottom'): void {
  efeFloor(p);
  const by = back === 'top' ? 1 : 11;
  const sy = back === 'top' ? 5 : 3;
  p.rect(1, sy, 14, 8, EFE.seatDark).rect(1, sy, 14, 7, EFE.seat).rect(2, sy + 1, 12, 1, EFE.seatLight);
  for (let x = 3; x < 14; x += 3) p.px(x, sy + 4, EFE.seatLight);
  p.rect(7, sy, 1, 7, EFE.seatDark);
  p.rect(1, by, 14, 4, EFE.seatDark).rect(1, by, 14, 3, EFE.seat).rect(1, by, 14, 1, EFE.red);
  p.rect(0, sy, 1, 8, PAL.metal).rect(15, sy, 1, 8, PAL.metal);
}

/** Mural de la Línea 1 en el muro de la estación: franja roja con estaciones blancas. */
function mural(p: Painter, part: 'ini' | 'mid' | 'fin'): void {
  p.fill(PAL.wallIn);
  p.rect(0, 0, 16, 2, PAL.wallInDark).rect(0, 14, 16, 2, '#9890a0');
  p.rect(0, 2, 16, 11, PAL.white).rect(0, 2, 16, 1, PAL.wallInDark).rect(0, 12, 16, 1, PAL.wallInDark);
  const x0 = part === 'ini' ? 4 : 0;
  const x1 = part === 'fin' ? 12 : 16;
  p.rect(x0, 9, x1 - x0, 2, PAL.metroRed);
  for (const x of [3, 8, 13]) {
    if (x < x0 - 1 || x > x1) continue;
    p.rect(x - 1, 8, 3, 4, PAL.metroRed).rect(x, 9, 1, 2, PAL.white);
    p.rect(x, 4, 1, 1, PAL.wallInDark).rect(x + 1, 3, 1, 1, PAL.wallInDark);
  }
  if (part === 'ini') p.rect(0, 2, 1, 11, PAL.wallInDark).rect(2, 8, 3, 4, '#1aa35a').rect(3, 9, 1, 2, PAL.white);
  if (part === 'fin') p.rect(15, 2, 1, 11, PAL.wallInDark);
}

function tree(p: Painter): void {
  // Sombra en el suelo
  p.rect(3, 12, 11, 3, 'rgba(0,0,0,0.18)');
  p.rect(7, 11, 2, 4, PAL.trunk);
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 6.5);
      if (d > 6.6) continue;
      let c: string = PAL.leaf;
      if (d > 5.7) c = PAL.leafOutline;
      else if ((x - 5) ** 2 + (y - 3.5) ** 2 < 6) c = PAL.leafLight;
      else if (x + y > 16) c = PAL.leafDark;
      p.px(x, y, c);
    }
  }
  p.pixels(
    [
      [9, 4],
      [4, 8],
      [10, 9],
    ],
    PAL.leafDark,
  );
}

function stairs(p: Painter, base: string, light: string, dark: string): void {
  p.rect(2, 2, 12, 14, base);
  for (let y = 4; y < 16; y += 3) {
    p.rect(2, y, 12, 1, light);
    p.rect(2, y + 1, 12, 1, dark);
  }
  p.rect(1, 1, 1, 15, PAL.metalDark).rect(14, 1, 1, 15, PAL.metalDark);
  p.rect(1, 0, 14, 2, PAL.metal);
}

// ---------------------------------------------------------------------------
// Edificios (autotile): techo, borde superior, fachada alta y fachada a nivel de calle
// ---------------------------------------------------------------------------

function roof(p: Painter, s: BuildingStyle): void {
  p.fill(s.roof);
  p.px(3, 4, s.roofDark).px(11, 10, s.roofDark).px(12, 3, s.roofLight).px(5, 12, s.roofLight);
}

/** Techo con equipo de aire acondicionado. */
function roofUnit(p: Painter, s: BuildingStyle): void {
  roof(p, s);
  p.rect(4, 5, 8, 6, s.roofDark).rect(4, 4, 8, 6, PAL.metal).rect(5, 5, 6, 1, PAL.metalLight);
  p.rect(6, 6, 4, 2, PAL.metalDark);
}

/** Techo con claraboya. */
function roofSkylight(p: Painter, s: BuildingStyle): void {
  roof(p, s);
  p.rect(3, 3, 10, 10, s.roofDark).rect(4, 4, 8, 8, PAL.glassDark).rect(5, 5, 3, 3, PAL.glass);
}

function roofEdge(p: Painter, s: BuildingStyle): void {
  roof(p, s);
  p.rect(0, 0, 16, 2, s.roofLight).rect(0, 2, 16, 1, s.roofDark);
}

function windows(p: Painter, s: BuildingStyle, y: number): void {
  for (const x of [2, 9]) {
    p.rect(x, y, 5, 7, s.wallDark);
    p.rect(x + 1, y + 1, 3, 5, PAL.glass);
    p.rect(x + 1, y + 1, 1, 2, PAL.glassLight);
    p.rect(x, y + 7, 5, 1, s.wallLight);
  }
}

/** Ladrillo a la vista: hiladas con la junta un poco más oscura (edificios de la PUCC). */
function brickCourses(p: Painter, s: BuildingStyle): void {
  const joint = shade(s.wall, -0.12);
  for (let y = 2; y < 16; y += 3) {
    p.rect(0, y, 16, 1, joint);
    for (let x = (y % 2) * 3; x < 16; x += 6) p.px(x, y + 1, joint);
  }
}

function facadeUpper(p: Painter, s: BuildingStyle, glassy: boolean): void {
  p.fill(s.wall);
  if (s === BUILDING_STYLES.pucc) brickCourses(p, s);
  if (glassy) {
    p.rect(0, 0, 16, 16, s.wall);
    p.rect(0, 0, 1, 16, s.wallDark).rect(8, 0, 1, 16, s.wallDark);
    p.rect(0, 7, 16, 1, s.wallDark).rect(0, 15, 16, 1, s.wallDark);
    p.rect(2, 1, 2, 2, s.wallLight).rect(10, 9, 2, 2, s.wallLight);
    return;
  }
  p.rect(0, 0, 16, 1, s.wallDark);
  windows(p, s, 4);
}

function facadeStreet(p: Painter, s: BuildingStyle, glassy: boolean): void {
  facadeUpper(p, s, glassy);
  if (!glassy) p.rect(0, 0, 16, 2, s.roofDark);
  p.rect(0, 14, 16, 2, s.wallDark);
}

function shopFront(p: Painter, s: BuildingStyle): void {
  p.fill(s.wall);
  for (let x = 0; x < 16; x += 4) {
    p.rect(x, 1, 2, 4, s.awning).rect(x + 2, 1, 2, 4, PAL.white);
  }
  p.rect(0, 5, 16, 1, 'rgba(0,0,0,0.25)');
  p.rect(1, 7, 14, 7, s.wallDark);
  p.rect(2, 8, 12, 5, PAL.glass);
  p.rect(3, 8, 2, 3, PAL.glassLight);
  p.rect(0, 14, 16, 2, s.wallDark);
}

// ---------------------------------------------------------------------------
// Misión 4 (Cali): campus de la PUCC, casa de doña Mery, cafetería, bus y rooftop
// ---------------------------------------------------------------------------

const CALI = {
  pitch: '#5aac4a',
  pitchLight: '#66ba54',
  chalk: '#f0f0e8',
  terracotta: '#c8704c',
  terracottaDark: '#a8583a',
  terracottaLight: '#dc8c64',
  wall: '#f4f0e6',
  wallDark: '#d0c8b8',
  band: '#4aa0b8',
  bandDark: '#3a8098',
  blue: '#2050a8',
  blueLight: '#3c70c8',
  deck: '#9a6a48',
  deckDark: '#7a5034',
  deckLight: '#b4825c',
  night: '#1a1e30',
  terrazzo: '#d8d2c6',
};

function pitch(p: Painter): void {
  p.fill(CALI.pitch).rect(0, 0, 16, 8, CALI.pitchLight);
  p.px(3, 3, PAL.grassDark).px(11, 12, PAL.grassDark).px(7, 10, '#78c868');
}

function caliFloor(p: Painter): void {
  // Baldosa de greda, como en las casas de Pance.
  p.fill(CALI.terracotta);
  p.rect(0, 7, 16, 1, CALI.terracottaDark).rect(0, 15, 16, 1, CALI.terracottaDark);
  p.rect(7, 0, 1, 16, CALI.terracottaDark).rect(15, 0, 1, 16, CALI.terracottaDark);
  p.rect(1, 1, 3, 1, CALI.terracottaLight).rect(9, 9, 3, 1, CALI.terracottaLight);
}

function caliWall(p: Painter): void {
  // Muro blanco con el zócalo pintado de azul verdoso.
  p.fill(CALI.wall);
  p.rect(0, 0, 16, 1, CALI.wallDark).rect(0, 10, 16, 6, CALI.band).rect(0, 10, 16, 1, '#78c0d0').rect(0, 15, 16, 1, CALI.bandDark);
}

function puccWall(p: Painter): void {
  // Pasillos de la PUCC: muro crema con la franja azul de la universidad.
  p.fill(UNI.wall);
  p.rect(0, 0, 16, 2, UNI.wallDark).rect(0, 8, 16, 2, CALI.blue).rect(0, 14, 16, 2, '#9a968c');
}

function cafeFloor(p: Painter): void {
  p.fill(CALI.terrazzo).speckle(61, 9, '#bab2a4').speckle(17, 6, '#ece8e0').speckle(83, 3, '#c87858');
  p.rect(0, 15, 16, 1, '#c4bcae');
}

function deck(p: Painter): void {
  p.fill(CALI.deck);
  for (const y of [3, 7, 11, 15]) p.rect(0, y, 16, 1, CALI.deckDark);
  p.rect(4, 0, 1, 3, CALI.deckDark).rect(11, 4, 1, 3, CALI.deckDark).rect(2, 8, 1, 3, CALI.deckDark).rect(9, 12, 1, 3, CALI.deckDark);
  p.rect(6, 1, 4, 1, CALI.deckLight).rect(1, 9, 5, 1, CALI.deckLight);
}

/** La ciudad de noche vista desde arriba: techos oscuros, calles con faroles y ventanas encendidas. */
function cityBelow(p: Painter): void {
  p.fill(CALI.night);
  p.rect(0, 9, 16, 2, '#2a2a3c').rect(5, 0, 2, 16, '#2a2a3c');
  p.rect(1, 1, 3, 6, '#232638').rect(9, 2, 5, 5, '#202434').rect(9, 12, 6, 3, '#232638');
  p.px(2, 2, '#f0c060').px(11, 3, '#f8e0a0').px(13, 13, '#f0c060').px(10, 5, '#a8c8f0');
  p.px(6, 4, '#f0a040').px(6, 12, '#f0a040').px(1, 10, '#f0a040').px(13, 10, '#f0a040');
}

function caliTiles(): TileDef[] {
  const goal = (p: Painter, north: boolean, side: 'i' | 'd'): void => {
    pitch(p);
    // Arco visto desde arriba: la red atrás (gris) y el travesaño blanco hacia la cancha.
    const net = north ? [0, 9] : [7, 16];
    p.rect(0, net[0], 16, net[1] - net[0], '#c8ccd0');
    for (let x = 1; x < 16; x += 2) p.rect(x, net[0], 1, net[1] - net[0], '#e8ecf0');
    for (let y = net[0] + 1; y < net[1]; y += 2) p.rect(0, y, 16, 1, '#a8aeb6');
    p.rect(0, north ? 9 : 6, 16, 2, CALI.chalk);
    const px = side === 'i' ? 0 : 14;
    p.rect(px, north ? 0 : 6, 2, 10, CALI.chalk);
  };
  const parkedCar = (p: Painter, body: string, roofC: string): void => {
    road(p);
    p.rect(0, 0, 1, 16, PAL.lineWhite);
    p.rect(3, 1, 10, 14, PAL.outline).rect(4, 1, 8, 14, body).rect(5, 4, 6, 7, roofC);
    p.rect(5, 3, 6, 1, '#5a7898').rect(5, 11, 6, 1, '#5a7898').rect(4, 1, 2, 1, '#f8f0c0').rect(10, 1, 2, 1, '#f8f0c0');
  };
  const wallWith = (base: (p: Painter) => void, draw: (p: Painter) => void) => (p: Painter) => (base(p), draw(p));
  const railH = (p: Painter): void => {
    deck(p);
    p.rect(0, 8, 16, 8, CALI.night).px(3, 12, '#f0c060').px(12, 14, '#f0a040');
    p.rect(0, 6, 16, 3, 'rgba(170,220,240,0.55)').rect(0, 6, 16, 1, PAL.metalLight).rect(1, 6, 1, 3, PAL.metalDark).rect(9, 6, 1, 3, PAL.metalDark);
  };
  const railV = (p: Painter, west: boolean): void => {
    deck(p);
    const x0 = west ? 0 : 9;
    p.rect(x0, 0, 7, 16, CALI.night).px(x0 + 2, 4, '#f0c060').px(x0 + 4, 11, '#f0a040');
    const gx = west ? 7 : 6;
    p.rect(gx, 0, 3, 16, 'rgba(170,220,240,0.55)').rect(west ? gx + 2 : gx, 0, 1, 16, PAL.metalLight).rect(gx, 2, 3, 1, PAL.metalDark).rect(gx, 10, 3, 1, PAL.metalDark);
  };

  return [
    // --- Campus ---
    {
      key: 'caseta',
      solid: true,
      draw: (p) => {
        // Caseta del vigilante de la portería.
        sidewalk(p);
        p.rect(1, 1, 14, 14, '#2a3a5c').rect(2, 2, 12, 4, CALI.blue).rect(2, 6, 12, 8, '#e8e4dc');
        p.rect(3, 7, 10, 4, 'rgba(160,210,240,0.85)').rect(4, 8, 3, 2, PAL.glassLight).rect(2, 12, 12, 2, '#c8c4bc');
      },
    },
    { key: 'parqueadero', solid: false, draw: (p) => (road(p), p.rect(0, 0, 1, 16, PAL.lineWhite)) },
    { key: 'parqueadero_auto', solid: true, draw: (p) => parkedCar(p, '#c84848', '#a83838') },
    { key: 'parqueadero_auto_b', solid: true, draw: (p) => parkedCar(p, '#e8e8e4', '#c8c8c4') },
    { key: 'cancha', solid: false, draw: pitch },
    { key: 'cancha_linea_h', solid: false, draw: (p) => (pitch(p), p.rect(0, 7, 16, 2, CALI.chalk)) },
    { key: 'cancha_linea_v', solid: false, draw: (p) => (pitch(p), p.rect(7, 0, 2, 16, CALI.chalk)) },
    {
      key: 'cancha_centro',
      solid: false,
      draw: (p) => {
        pitch(p);
        p.rect(0, 7, 16, 2, CALI.chalk).rect(14, 5, 2, 6, CALI.chalk).rect(15, 3, 1, 2, CALI.chalk).rect(15, 11, 1, 2, CALI.chalk);
      },
    },
    { key: 'arco_n_i', solid: true, draw: (p) => goal(p, true, 'i') },
    { key: 'arco_n_d', solid: true, draw: (p) => goal(p, true, 'd') },
    { key: 'arco_s_i', solid: true, draw: (p) => goal(p, false, 'i') },
    { key: 'arco_s_d', solid: true, draw: (p) => goal(p, false, 'd') },
    {
      key: 'cancha_tenis',
      solid: false,
      draw: (p) => p.fill('#3c7c9c').rect(0, 0, 16, 1, CALI.chalk).rect(0, 0, 1, 16, CALI.chalk).speckle(5, 6, '#4a8cac'),
    },
    { key: 'arena', solid: false, draw: (p) => p.fill('#e8d498').speckle(19, 12, '#d0b878').speckle(29, 8, '#f8ecc0') },
    {
      key: 'piscina',
      solid: true,
      draw: (p) => {
        p.fill('#58b8e8').rect(7, 0, 2, 16, '#2a6ab0').rect(7, 3, 2, 1, '#f0d048').rect(7, 11, 2, 1, '#f0d048');
        p.rect(2, 4, 3, 1, '#a8e0f8').rect(10, 10, 4, 1, '#a8e0f8').rect(11, 2, 2, 1, '#88d0f0');
      },
    },
    {
      key: 'cancha_dura',
      solid: false,
      draw: (p) => p.fill('#c87850').rect(0, 0, 16, 1, CALI.chalk).speckle(13, 10, '#b86840').speckle(31, 5, '#d88c64'),
    },
    {
      key: 'farol_plaza',
      solid: true,
      draw: (p) => {
        cobble(p);
        p.rect(5, 13, 6, 2, 'rgba(0,0,0,0.2)').rect(7, 3, 2, 11, PAL.metalDark).rect(7, 3, 1, 11, PAL.metal);
        p.rect(5, 0, 6, 3, PAL.outline).rect(6, 1, 4, 2, PAL.flowerYellow);
      },
    },
    {
      key: 'pileta',
      solid: true,
      draw: (p) => {
        cobble(p);
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
            if (d < 7.5) p.px(x, y, d > 6.2 ? '#d8d2c6' : d > 2.2 ? PAL.water : '#e8e4dc');
          }
        }
        p.rect(4, 5, 3, 1, PAL.waterLight).rect(10, 10, 2, 1, PAL.waterLight).rect(7, 6, 2, 2, '#c8e8f8');
      },
    },
    {
      key: 'p_letrero',
      solid: true,
      draw: (p) => {
        // Letrero de piedra de la universidad junto a la portería.
        grass(p);
        p.rect(0, 4, 16, 9, '#8a8478').rect(0, 4, 16, 1, '#b4ac9c').rect(1, 6, 14, 2, CALI.blue).rect(2, 9, 12, 1, '#e8e4dc');
      },
    },

    // --- Casa de doña Mery (Pance) ---
    { key: 'cali_piso', solid: false, draw: caliFloor },
    { key: 'cali_muro', solid: true, draw: caliWall },
    {
      key: 'cali_ventana',
      solid: true,
      draw: wallWith(caliWall, (p) => {
        // Ventana con reja de hierro y el verde del patio afuera.
        p.rect(2, 1, 12, 11, '#6a5040').rect(3, 2, 10, 9, '#9cd0e8').rect(3, 6, 10, 5, '#48a058').rect(5, 5, 4, 2, '#3c8c48');
        for (let x = 4; x < 13; x += 3) p.rect(x, 2, 1, 9, '#2a2433');
        p.rect(3, 6, 10, 1, '#2a2433');
      }),
    },
    {
      key: 'cali_cuadro',
      solid: true,
      draw: wallWith(caliWall, (p) => {
        // Un cuadro de los Farallones al atardecer.
        p.rect(3, 1, 10, 8, '#8a5a30').rect(4, 2, 8, 6, '#f0b070').rect(4, 5, 8, 3, '#3c7c58').rect(6, 4, 3, 1, '#3c7c58').rect(9, 2, 2, 2, '#f8e070');
      }),
    },
    {
      key: 'cali_puerta',
      solid: false,
      draw: wallWith(caliWall, (p) => {
        p.rect(2, 0, 12, 16, '#5a3c28').rect(3, 1, 10, 15, '#8a5a38').rect(4, 2, 8, 5, '#9a6a44').rect(4, 9, 8, 5, '#9a6a44').rect(11, 8, 1, 2, PAL.yellow);
      }),
    },
    {
      key: 'ventilador',
      solid: true,
      draw: (p) => {
        caliFloor(p);
        p.rect(6, 12, 4, 3, '#3a3c44').rect(7, 7, 2, 6, PAL.metalDark);
        for (let y = 0; y < 9; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 4) < 4.6) p.px(x, y, (x + y) % 2 ? '#e8ecf0' : '#9aa0aa');
        p.rect(7, 3, 2, 2, '#4aa0b8');
      },
    },
    {
      key: 'hamaca',
      solid: true,
      draw: (p) => {
        caliFloor(p);
        const colors = ['#d84848', '#f0c030', '#3c9c5c', '#2f6fd0'];
        for (let i = 0; i < 12; i++) p.rect(2 + i, 3 + Math.round(Math.sin((i / 11) * Math.PI) * 6), 1, 4, colors[i % 4]);
        p.px(1, 4, '#7a5030').px(14, 4, '#7a5030');
      },
    },
    {
      key: 'matera',
      solid: true,
      draw: (p) => {
        caliFloor(p);
        p.rect(4, 10, 8, 5, '#b85838').rect(4, 10, 8, 1, '#d8784c');
        p.rect(3, 3, 10, 7, PAL.leaf).rect(5, 1, 6, 3, PAL.leafLight).rect(2, 6, 3, 3, PAL.leafDark).rect(11, 5, 3, 3, PAL.leafDark).px(7, 4, PAL.flowerRed);
      },
    },

    // --- Pasillos y salas de la PUCC ---
    { key: 'p_muro', solid: true, draw: puccWall },
    {
      key: 'p_ventana',
      solid: true,
      draw: wallWith(puccWall, (p) => {
        // Afuera: palmas, samanes y el cerro.
        p.rect(1, 1, 14, 12, '#8a8e98').rect(2, 2, 12, 10, '#a8d8f0').rect(2, 6, 12, 2, '#5a9c80').rect(2, 8, 12, 4, '#58a848');
        p.rect(4, 4, 1, 6, '#8a6a40').rect(3, 3, 3, 1, PAL.leaf).rect(10, 5, 3, 3, PAL.leafDark).rect(7, 2, 2, 10, '#8a8e98');
      }),
    },
    {
      key: 'p_puerta',
      solid: true,
      draw: wallWith(puccWall, (p) => {
        p.rect(2, 1, 12, 15, '#2a3c68').rect(3, 2, 10, 14, '#3c5a98').rect(5, 3, 6, 4, '#c8e0f0').rect(5, 3, 2, 2, '#e8f8ff').rect(11, 9, 1, 2, PAL.yellow);
      }),
    },
    {
      key: 'p_puerta_abierta',
      solid: false,
      draw: wallWith(puccWall, (p) => p.rect(2, 1, 12, 15, '#2a3c68').rect(3, 2, 10, 14, '#3a3440').rect(3, 12, 10, 4, UNI.floorDark)),
    },
    {
      key: 'p_cartel',
      solid: true,
      draw: wallWith(puccWall, (p) => {
        p.rect(1, 2, 14, 10, '#c8a070').rect(2, 3, 12, 8, '#e8d4b0');
        p.rect(3, 4, 4, 3, '#a8d8f0').rect(8, 4, 5, 2, '#f8f070').rect(4, 8, 6, 2, '#b8e8a8').rect(11, 7, 2, 3, '#f8a8a8');
      }),
    },
    {
      key: 'p_pizarra',
      solid: true,
      draw: wallWith(puccWall, (p) => {
        p.rect(0, 1, 16, 12, '#6a6c78').rect(0, 2, 16, 10, '#f8f8f4');
        // Un grafo de rutas: nodos y aristas.
        p.rect(3, 4, 2, 2, CALI.blue).rect(11, 5, 2, 2, '#c83838').rect(6, 9, 2, 2, CALI.blue).rect(5, 5, 6, 1, '#2a2433').rect(5, 6, 1, 3, '#2a2433').rect(8, 8, 3, 1, '#2a2433');
        p.rect(0, 12, 16, 1, '#8a8c98');
      }),
    },

    // --- Cafetería Central ---
    { key: 'cafe_piso', solid: false, draw: cafeFloor },
    {
      key: 'cafe_muro',
      solid: true,
      draw: (p) => {
        p.fill(BUILDING_STYLES.pucc.wall);
        brickCourses(p, BUILDING_STYLES.pucc);
        p.rect(0, 0, 16, 2, BUILDING_STYLES.pucc.wallDark).rect(0, 13, 16, 3, '#7a5a40').rect(0, 13, 16, 1, '#9a7454');
      },
    },
    {
      key: 'cafe_menu',
      solid: true,
      draw: (p) => {
        p.fill(BUILDING_STYLES.pucc.wall);
        brickCourses(p, BUILDING_STYLES.pucc);
        p.rect(1, 1, 14, 11, '#5a3c28').rect(2, 2, 12, 9, '#2c4a38');
        for (const y of [3, 5, 7, 9]) p.rect(3, y, 6, 1, '#e8e4dc').rect(11, y, 2, 1, '#f0d048');
      },
    },
    {
      key: 'cafe_mostrador',
      solid: true,
      draw: (p) => {
        // Vitrina con pandebonos, buñuelos y empanadas.
        cafeFloor(p);
        p.rect(0, 2, 16, 12, '#6a4428').rect(0, 2, 16, 7, 'rgba(200,230,245,0.9)').rect(0, 2, 16, 1, PAL.metalLight);
        p.rect(2, 4, 3, 3, '#e8c070').rect(3, 4, 1, 1, '#f8e0a0').rect(7, 5, 3, 2, '#c87830').rect(12, 4, 3, 3, '#e0a848');
        p.rect(0, 9, 16, 5, '#8a5a38').rect(0, 9, 16, 1, '#a87444');
      },
    },
    {
      key: 'cafe_caja',
      solid: true,
      draw: (p) => {
        cafeFloor(p);
        p.rect(0, 2, 16, 12, '#6a4428').rect(0, 2, 16, 7, '#d8d0c0').rect(4, 2, 8, 5, '#2a2c34').rect(5, 3, 6, 2, '#58c8a8');
        p.rect(0, 9, 16, 5, '#8a5a38').rect(0, 9, 16, 1, '#a87444');
      },
    },
    {
      key: 'mesa_cafe',
      solid: true,
      draw: (p) => {
        cafeFloor(p);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
          if (d < 7) p.px(x, y, d > 6 ? '#8a8e98' : '#e8ecf0');
        }
        p.rect(5, 6, 3, 3, '#f4f4f0').rect(6, 7, 1, 1, '#c87830').rect(9, 8, 2, 3, '#f0b040');
      },
    },
    { key: 'silla_cafe', solid: true, draw: (p) => chair(p, cafeFloor) },

    // --- Bus a Pance ---
    {
      key: 'bus_ventana',
      solid: true,
      draw: (p) => {
        // Calle 18: palmas, edificios bajos y los Farallones al fondo.
        p.fill('#e8ecf0');
        p.rect(1, 2, 14, 9, '#a8dcf8').rect(1, 4, 14, 3, '#5a9c88').rect(1, 7, 14, 4, '#9a9c9c');
        p.rect(2, 7, 4, 3, '#e8d8c0').rect(9, 6, 5, 4, '#c87858').rect(7, 3, 1, 7, '#8a6a40').rect(5, 3, 5, 1, PAL.leaf);
        p.rect(0, 12, 16, 4, PAL.busFloor);
      },
    },

    // --- Rooftop ---
    { key: 'deck', solid: false, draw: deck },
    { key: 'baranda_vidrio', solid: true, draw: railH },
    { key: 'baranda_vidrio_o', solid: true, draw: (p) => railV(p, true) },
    { key: 'baranda_vidrio_e', solid: true, draw: (p) => railV(p, false) },
    { key: 'vista_ciudad', solid: true, draw: cityBelow },
    {
      key: 'terraza_muro',
      solid: true,
      draw: (p) => p.fill('#c8c4bc').rect(0, 0, 16, 2, '#a8a49c').rect(0, 13, 16, 3, '#8a867e').rect(0, 13, 16, 1, '#b4b0a8'),
    },
    {
      key: 'terraza_puerta',
      solid: false,
      draw: (p) => {
        p.fill('#c8c4bc').rect(0, 0, 16, 2, '#a8a49c');
        p.rect(2, 1, 12, 15, '#3a3c44').rect(3, 2, 10, 14, 'rgba(200,220,240,0.85)').rect(7, 2, 2, 14, '#3a3c44').rect(4, 3, 2, 5, '#f0f4f8');
      },
    },
    {
      key: 'parrilla',
      solid: true,
      draw: (p) => {
        deck(p);
        p.rect(2, 3, 12, 10, '#2a2c34').rect(3, 4, 10, 8, '#3a3c44');
        for (let x = 4; x < 12; x += 2) p.rect(x, 5, 1, 6, '#6a6c78');
        p.rect(4, 6, 3, 2, '#c84830').rect(8, 8, 3, 2, '#d8a058').rect(3, 13, 1, 2, PAL.metalDark).rect(12, 13, 1, 2, PAL.metalDark);
      },
    },
    {
      key: 'mesa_terraza',
      solid: true,
      draw: (p) => {
        // Mesa con aborrajados, empanadas, ají y unas cervezas.
        deck(p);
        p.rect(0, 2, 16, 12, '#5a3c28').rect(0, 2, 16, 11, '#f0ece0');
        p.rect(2, 4, 4, 3, '#e8a040').rect(3, 4, 2, 1, '#f8c870').rect(8, 4, 5, 2, '#d89838').rect(9, 8, 2, 3, '#58a048');
        p.rect(3, 9, 1, 3, '#c8a040').rect(5, 9, 1, 3, '#c8a040').rect(13, 8, 1, 3, '#c8a040').rect(12, 11, 3, 1, '#d84848');
      },
    },
    {
      key: 'silla_terraza',
      solid: true,
      draw: (p) => {
        deck(p);
        p.rect(3, 2, 10, 9, '#2a2c34').rect(3, 2, 10, 8, '#e8e4dc').rect(4, 3, 8, 1, '#ffffff');
        p.rect(2, 10, 12, 4, '#2a2c34').rect(3, 10, 10, 2, '#4a4c56');
      },
    },
    {
      key: 'nevera_portatil',
      solid: true,
      draw: (p) => (deck(p), p.rect(3, 4, 10, 10, '#2a2433'), p.rect(4, 5, 8, 8, '#2f6fd0'), p.rect(4, 5, 8, 3, '#f0f0e8'), p.rect(7, 3, 2, 2, '#9aa0aa')),
    },
    {
      key: 'planta_terraza',
      solid: true,
      draw: (p) => {
        deck(p);
        p.rect(4, 10, 8, 5, '#3a3c44').rect(4, 10, 8, 1, '#5a5c66');
        p.rect(3, 3, 10, 7, PAL.leaf).rect(5, 1, 6, 3, PAL.leafLight).rect(2, 6, 3, 3, PAL.leafDark).rect(11, 5, 3, 3, PAL.leafDark);
      },
    },
    {
      key: 'sofa_terraza',
      solid: true,
      draw: (p) => (deck(p), p.rect(0, 2, 16, 12, '#4a4c56'), p.rect(0, 2, 16, 4, '#6a6c78'), p.rect(1, 6, 14, 7, '#d8d0c0'), p.rect(7, 6, 1, 7, '#b8b0a0'), p.rect(3, 7, 3, 3, '#d84848')),
    },
  ];
}

function buildingTiles(): TileDef[] {
  const out: TileDef[] = [];
  for (const [name, s] of Object.entries(BUILDING_STYLES)) {
    const glassy = name === 'vidrio';
    out.push(
      { key: `${name}_techo`, solid: true, draw: (p) => roof(p, s) },
      { key: `${name}_techo_equipo`, solid: true, draw: (p) => roofUnit(p, s) },
      { key: `${name}_techo_claraboya`, solid: true, draw: (p) => roofSkylight(p, s) },
      { key: `${name}_borde`, solid: true, draw: (p) => roofEdge(p, s) },
      { key: `${name}_fachada_alta`, solid: true, draw: (p) => facadeUpper(p, s, glassy) },
      { key: `${name}_fachada`, solid: true, draw: (p) => facadeStreet(p, s, glassy) },
      { key: `${name}_vitrina`, solid: true, draw: (p) => (glassy ? facadeStreet(p, s, true) : shopFront(p, s)) },
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Catálogo de tiles. El índice en este arreglo es el índice del tileset.
// ---------------------------------------------------------------------------

export const TILE_DEFS: TileDef[] = [
  { key: 'vacio', solid: true, draw: (p) => p.fill(PAL.black) },

  // --- Exterior ---
  { key: 'pasto', solid: false, draw: grass },
  {
    key: 'pasto_flor',
    solid: false,
    draw: (p) => {
      grass(p);
      for (const [x, y, c] of [
        [4, 5, PAL.flowerRed],
        [11, 10, PAL.flowerYellow],
        [9, 3, PAL.white],
      ] as const) {
        p.px(x, y - 1, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y + 1, c).px(x, y, PAL.yellow);
      }
    },
  },
  { key: 'vereda', solid: false, draw: sidewalk },
  { key: 'adoquin', solid: false, draw: cobble },
  { key: 'calle', solid: false, draw: road },
  { key: 'calle_linea_h', solid: false, draw: (p) => (road(p), p.rect(3, 7, 10, 2, PAL.lineYellow)) },
  { key: 'calle_linea_v', solid: false, draw: (p) => (road(p), p.rect(7, 3, 2, 10, PAL.lineYellow)) },
  {
    key: 'cebra_h',
    solid: false,
    draw: (p) => (road(p), p.rect(1, 0, 14, 4, PAL.lineWhite), p.rect(1, 8, 14, 4, PAL.lineWhite)),
  },
  {
    key: 'cebra_v',
    solid: false,
    draw: (p) => (road(p), p.rect(0, 1, 4, 14, PAL.lineWhite), p.rect(8, 1, 4, 14, PAL.lineWhite)),
  },
  { key: 'arbol', solid: true, draw: (p) => (grass(p), tree(p)) },
  {
    key: 'arbol_vereda',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      p.rect(4, 10, 8, 6, PAL.trunk).rect(5, 11, 6, 4, '#5a3c24');
      tree(p);
    },
  },
  { key: 'banca', solid: true, draw: (p) => (sidewalk(p), bench(p)) },
  { key: 'banca_plaza', solid: true, draw: (p) => (cobble(p), bench(p)) },
  { key: 'arbol_plaza', solid: true, draw: (p) => (cobble(p), p.rect(4, 10, 8, 6, PAL.cobbleDark), tree(p)) },
  {
    key: 'farol',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      p.rect(5, 13, 6, 2, 'rgba(0,0,0,0.2)');
      p.rect(7, 3, 2, 11, PAL.metalDark).rect(7, 3, 1, 11, PAL.metal);
      p.rect(5, 0, 6, 3, PAL.outline).rect(6, 1, 4, 2, PAL.flowerYellow);
    },
  },
  {
    key: 'basurero',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      p.rect(4, 4, 8, 10, PAL.green).rect(4, 4, 8, 2, '#68c878').rect(5, 7, 1, 6, '#388848');
      p.rect(4, 14, 8, 1, 'rgba(0,0,0,0.25)');
    },
  },
  {
    key: 'metro',
    solid: false,
    draw: (p) => {
      sidewalk(p);
      stairs(p, '#4a4858', '#6a6878', '#3a3846');
    },
  },
  {
    key: 'metro_cerrado',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      stairs(p, '#4a4858', '#6a6878', '#3a3846');
      p.rect(1, 6, 14, 4, PAL.yellow);
      for (let x = 1; x < 15; x += 4) p.rect(x, 6, 2, 4, PAL.black);
      p.rect(2, 10, 1, 4, PAL.metalDark).rect(13, 10, 1, 4, PAL.metalDark);
    },
  },
  {
    key: 'agua',
    solid: true,
    draw: (p) => {
      p.fill(PAL.water);
      p.rect(2, 4, 4, 1, PAL.waterLight).rect(9, 9, 4, 1, PAL.waterLight).rect(4, 13, 3, 1, PAL.waterLight);
      p.rect(11, 2, 3, 1, PAL.waterDark).rect(1, 9, 3, 1, PAL.waterDark);
    },
  },
  {
    key: 'baranda',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      p.rect(0, 6, 16, 2, PAL.metal).rect(0, 6, 16, 1, PAL.metalLight);
      p.rect(1, 6, 2, 7, PAL.metalDark).rect(9, 6, 2, 7, PAL.metalDark);
    },
  },
  {
    key: 'puerta',
    solid: false,
    draw: (p) => {
      p.fill(BUILDING_STYLES.vidrio.wallDark);
      p.rect(0, 0, 16, 2, BUILDING_STYLES.vidrio.roofDark);
      p.rect(2, 3, 12, 13, PAL.glass).rect(7, 3, 2, 13, PAL.metalDark);
      p.rect(3, 4, 2, 5, PAL.glassLight).rect(10, 4, 2, 5, PAL.glassLight);
    },
  },

  // --- Interior: estación ---
  { key: 'piso', solid: false, draw: floor },
  {
    key: 'piso_linea',
    solid: false,
    draw: (p) => {
      p.fill(PAL.yellow);
      for (let y = 1; y < 16; y += 3) for (let x = 1; x < 16; x += 3) p.px(x, y, PAL.yellowDark);
    },
  },
  {
    key: 'muro',
    solid: true,
    draw: (p) => {
      p.fill(PAL.wallIn);
      p.rect(0, 0, 16, 2, PAL.wallInDark);
      p.rect(0, 5, 16, 1, PAL.wallInDark).rect(7, 2, 1, 3, PAL.wallInDark);
      p.rect(0, 8, 16, 3, PAL.metroRed).rect(0, 8, 16, 1, PAL.metroRedLight);
      p.rect(0, 14, 16, 2, '#9890a0');
    },
  },
  { key: 'mural_ini', solid: true, draw: (p) => mural(p, 'ini') },
  { key: 'mural_linea', solid: true, draw: (p) => mural(p, 'mid') },
  { key: 'mural_fin', solid: true, draw: (p) => mural(p, 'fin') },
  {
    key: 'puerta_anden',
    solid: true,
    draw: (p) => {
      p.fill(PAL.yellow);
      for (let x = 1; x < 16; x += 3) p.px(x, 14, PAL.yellowDark);
      p.rect(0, 2, 16, 10, PAL.glass).rect(0, 2, 16, 10, 'rgba(255,255,255,0.25)');
      p.rect(0, 1, 16, 2, PAL.metalDark).rect(0, 11, 16, 2, PAL.metalDark);
      p.rect(0, 1, 1, 12, PAL.metal).rect(15, 1, 1, 12, PAL.metal).rect(7, 3, 2, 8, PAL.metal);
      p.rect(2, 4, 2, 4, PAL.glassLight).rect(10, 4, 2, 4, PAL.glassLight);
      p.rect(3, 1, 3, 1, PAL.metroRed).rect(10, 1, 3, 1, PAL.metroRed);
    },
  },
  {
    key: 'muro_techo',
    solid: true,
    draw: (p) => p.fill(PAL.wallTop).rect(0, 14, 16, 2, PAL.wallTopLight),
  },
  {
    key: 'via',
    solid: true,
    draw: (p) => {
      p.fill(PAL.gravel);
      p.speckle(5, 10, PAL.gravelLight);
      for (let x = 1; x < 16; x += 4) p.rect(x, 2, 2, 12, '#6a5040');
      p.rect(0, 4, 16, 2, PAL.rail).rect(0, 10, 16, 2, PAL.rail);
    },
  },
  {
    key: 'torniquete',
    solid: true,
    draw: (p) => {
      floor(p);
      p.rect(2, 2, 12, 12, PAL.metalDark).rect(2, 2, 12, 10, PAL.metal).rect(3, 3, 10, 2, PAL.metalLight);
      p.rect(6, 6, 4, 3, PAL.outline).rect(7, 7, 2, 1, PAL.green);
    },
  },
  {
    key: 'escalera',
    solid: false,
    draw: (p) => (floor(p), stairs(p, '#8a8898', '#c0c0cc', '#5a5868')),
  },

  // --- Interior: vagón ---
  { key: 'vagon_piso', solid: false, draw: trainFloor },
  { key: 'vagon_asiento', solid: true, draw: (p) => metroSeat(p, 'top') },
  { key: 'vagon_asiento_s', solid: true, draw: (p) => metroSeat(p, 'bottom') },
  {
    key: 'vagon_ventana',
    solid: true,
    draw: (p) => {
      p.fill(PAL.trainWall);
      p.rect(1, 2, 14, 9, PAL.trainWallDark).rect(2, 3, 12, 7, PAL.tunnel).rect(3, 4, 3, 1, '#3c3c50');
      p.rect(0, 12, 16, 1, PAL.metroRed);
      p.rect(0, 13, 16, 3, PAL.trainWallDark);
    },
  },
  {
    key: 'vagon_muro',
    solid: true,
    draw: (p) => p.fill(PAL.trainWall).rect(0, 13, 16, 3, PAL.trainWallDark).rect(0, 6, 16, 2, PAL.metroRed),
  },
  {
    key: 'vagon_puerta',
    solid: true,
    draw: (p) => {
      // Vano de la puerta (andén visto desde el vagón); las hojas animadas van encima.
      p.fill(PAL.metroRed);
      p.rect(0, 0, 1, 16, PAL.metroRedDark).rect(15, 0, 1, 16, PAL.metroRedDark);
      p.rect(1, 0, 14, 16, PAL.floor).rect(1, 0, 14, 5, '#b8bcc8').rect(1, 11, 14, 2, PAL.yellow);
    },
  },
  {
    key: 'barra',
    solid: true,
    draw: (p) => {
      trainFloor(p);
      p.rect(5, 12, 6, 2, 'rgba(0,0,0,0.2)');
      p.rect(7, 0, 2, 14, PAL.metalLight).rect(8, 0, 1, 14, PAL.metal);
    },
  },

  // --- Interior: tren EFE ---
  { key: 'efe_piso', solid: false, draw: efeFloor },
  { key: 'efe_asiento', solid: true, draw: (p) => efeSeat(p, 'top') },
  { key: 'efe_asiento_s', solid: true, draw: (p) => efeSeat(p, 'bottom') },
  {
    key: 'efe_ventana',
    solid: true,
    draw: (p) => {
      // Ventana grande: cielo de la mañana y campo del valle central.
      p.fill(EFE.wall);
      p.rect(1, 1, 14, 10, '#1e2128').rect(2, 2, 12, 8, PAL.sky).rect(2, 6, 12, 4, '#78a858').rect(2, 5, 5, 1, '#8a9cb0').rect(9, 4, 5, 2, '#8a9cb0');
      p.rect(3, 8, 3, 1, '#5a8a48').rect(10, 9, 2, 1, '#5a8a48');
      p.rect(0, 12, 16, 1, EFE.red).rect(0, 13, 16, 3, EFE.wallDark);
    },
  },
  {
    key: 'efe_puerta',
    solid: true,
    draw: (p) => {
      // Vano de la puerta (andén visto desde el tren); las hojas animadas van encima.
      p.fill(EFE.red);
      p.rect(0, 0, 1, 16, '#9c1a1f').rect(15, 0, 1, 16, '#9c1a1f');
      p.rect(1, 0, 14, 16, PAL.floor).rect(1, 0, 14, 5, '#b8bcc8').rect(1, 11, 14, 2, PAL.yellow);
    },
  },
  {
    key: 'efe_barra',
    solid: true,
    draw: (p) => {
      efeFloor(p);
      p.rect(5, 12, 6, 2, 'rgba(0,0,0,0.2)');
      p.rect(7, 0, 2, 14, PAL.yellow).rect(8, 0, 1, 14, PAL.yellowDark);
    },
  },

  // --- Interior: micro ---
  { key: 'micro_piso', solid: false, draw: busFloor },
  {
    key: 'micro_asiento',
    solid: true,
    draw: (p) => {
      // Mira hacia adelante (a la izquierda, donde va el chofer): respaldo a la derecha.
      busFloor(p);
      p.rect(1, 3, 11, 10, PAL.seatRedDark).rect(1, 3, 11, 9, PAL.seatRed).rect(2, 4, 9, 1, PAL.seatRedLight);
      p.rect(11, 1, 4, 14, PAL.seatRedDark).rect(11, 1, 3, 13, PAL.seatRed).rect(12, 2, 1, 11, PAL.seatRedLight);
    },
  },
  {
    key: 'micro_ventana',
    solid: true,
    draw: (p) => {
      p.fill(PAL.white);
      p.rect(1, 2, 14, 9, PAL.sky).rect(1, 7, 4, 4, '#b8a898').rect(6, 5, 5, 6, '#a8b0c0').rect(12, 8, 3, 3, '#88a868');
      p.rect(0, 12, 16, 4, PAL.red);
    },
  },
  {
    key: 'micro_puerta',
    solid: true,
    draw: (p) => {
      // Vano de la puerta (vereda vista desde la micro); las hojas animadas van encima.
      p.fill(PAL.red);
      p.rect(1, 0, 14, 16, PAL.walk).rect(1, 0, 14, 6, PAL.sky).rect(1, 11, 14, 1, PAL.walkDark);
    },
  },
  {
    key: 'micro_tablero',
    solid: true,
    draw: (p) => {
      p.fill(PAL.wallTop);
      p.rect(2, 2, 12, 6, PAL.sky).rect(1, 10, 14, 4, PAL.outline).rect(5, 11, 6, 2, PAL.green);
    },
  },

  // --- Interior del Costanera ---
  { key: 'mall_piso', solid: false, draw: mallFloor },
  {
    key: 'mall_piso_b',
    solid: false,
    draw: (p) => (mallFloor(p), p.rect(0, 6, 16, 4, MALL.floorDark), p.rect(0, 7, 16, 2, '#c8a878')),
  },
  {
    key: 'mall_muro',
    solid: true,
    draw: (p) => p.fill(MALL.wall).rect(0, 0, 16, 2, MALL.wallDark).rect(0, 12, 16, 4, MALL.trim).rect(0, 12, 16, 1, '#b8c0cc'),
  },
  ...SHOP_COLORS.map((c, i) => ({ key: `tienda_${i}`, solid: true, draw: (p: Painter) => mallShop(p, c) })),
  {
    key: 'atrio',
    solid: true,
    draw: (p) => {
      p.fill(MALL.void);
      p.rect(0, 0, 16, 5, '#3a4258').rect(2, 7, 5, 3, '#4a5470').rect(9, 11, 5, 3, '#4a5470');
      p.px(4, 13, '#c8d0e0').px(12, 4, '#c8d0e0');
    },
  },
  {
    key: 'baranda_mall',
    solid: true,
    draw: (p) => {
      mallFloor(p);
      p.rect(0, 5, 16, 8, 'rgba(160,210,240,0.55)').rect(0, 4, 16, 2, PAL.metalLight).rect(0, 12, 16, 1, PAL.metalDark);
      p.rect(1, 6, 1, 6, PAL.metal).rect(9, 6, 1, 6, PAL.metal);
    },
  },
  { key: 'escalera_sube', solid: false, draw: (p) => escalator(p, true) },
  { key: 'escalera_baja', solid: false, draw: (p) => escalator(p, false) },
  {
    key: 'ascensor',
    solid: true,
    draw: (p) => {
      p.fill(MALL.wall).rect(0, 12, 16, 4, MALL.trim);
      p.rect(1, 1, 14, 15, PAL.metalDark).rect(2, 2, 12, 14, PAL.metal).rect(7, 2, 2, 14, PAL.metalDark);
      p.rect(3, 3, 3, 1, PAL.metalLight).rect(10, 3, 3, 1, PAL.metalLight);
    },
  },
  {
    key: 'planta',
    solid: true,
    draw: (p) => {
      mallFloor(p);
      p.rect(4, 10, 8, 5, '#b86c3c').rect(4, 10, 8, 1, '#d88c5c');
      p.rect(3, 3, 10, 7, PAL.leaf).rect(5, 1, 6, 3, PAL.leafLight).rect(2, 6, 3, 3, PAL.leafDark).rect(11, 5, 3, 3, PAL.leafDark);
    },
  },
  {
    key: 'banca_mall',
    solid: true,
    draw: (p) => (mallFloor(p), p.rect(1, 5, 14, 6, '#8a6a4a'), p.rect(1, 5, 14, 2, '#a8865e'), p.rect(2, 11, 2, 3, PAL.metalDark), p.rect(12, 11, 2, 3, PAL.metalDark)),
  },
  {
    key: 'mesa',
    solid: true,
    draw: (p) => {
      mallFloor(p);
      p.rect(3, 3, 10, 9, '#f8f8f0').rect(3, 11, 10, 1, '#c8c8c0');
      p.rect(1, 6, 2, 4, PAL.red).rect(13, 6, 2, 4, PAL.red);
      p.rect(6, 5, 3, 3, PAL.orange).rect(9, 7, 2, 2, PAL.yellow);
    },
  },
  {
    key: 'estante',
    solid: true,
    draw: (p) => {
      p.fill('#6a5a4a');
      for (const y of [1, 6, 11]) {
        p.rect(1, y, 14, 4, '#8a7a6a');
        p.rect(2, y, 3, 3, PAL.red).rect(6, y, 2, 3, PAL.yellow).rect(9, y, 3, 3, PAL.green).rect(13, y, 1, 3, PAL.glass);
      }
    },
  },
  {
    key: 'caja',
    solid: true,
    draw: (p) => (mallFloor(p), p.rect(1, 4, 14, 10, '#4a4c58'), p.rect(1, 4, 14, 2, '#6a6c78'), p.rect(9, 1, 5, 4, PAL.tunnel), p.rect(10, 2, 3, 2, '#58c8a8')),
  },
  {
    key: 'meson',
    solid: true,
    draw: (p) => (mallFloor(p), p.rect(0, 4, 16, 10, '#2f6fd0'), p.rect(0, 4, 16, 2, '#5a8ae0'), p.rect(5, 8, 6, 3, PAL.white)),
  },
  {
    key: 'pantalla_cine',
    solid: true,
    draw: (p) => p.fill('#1a1420').rect(0, 2, 16, 10, '#d8d0c0').rect(0, 12, 16, 4, '#7a1a2a').rect(2, 4, 12, 6, '#f8f0e0'),
  },


  // --- Casa (misión 2) ---
  { key: 'casa_piso', solid: false, draw: homeFloor },
  { key: 'casa_baldosa', solid: false, draw: homeTile },
  { key: 'casa_muro', solid: true, draw: homeWall },
  {
    key: 'casa_ventana',
    solid: true,
    draw: (p) => {
      homeWall(p);
      p.rect(3, 2, 10, 9, HOME.base).rect(4, 3, 8, 7, '#2a3c68').rect(4, 3, 3, 2, '#3c5488').rect(8, 3, 1, 7, HOME.base);
      p.rect(2, 2, 2, 10, '#c85848').rect(12, 2, 2, 10, '#c85848');
    },
  },
  {
    key: 'casa_escalera',
    solid: false,
    draw: (p) => (homeFloor(p), stairs(p, HOME.woodDark, HOME.woodLight, '#7a4c30')),
  },
  {
    key: 'puerta_casa',
    solid: false,
    draw: (p) => {
      homeWall(p);
      p.rect(2, 0, 12, 16, HOME.base).rect(3, 1, 10, 15, '#9a6838').rect(4, 2, 8, 5, '#a87444').rect(4, 9, 8, 5, '#a87444');
      p.rect(11, 8, 1, 2, PAL.yellow);
    },
  },
  { key: 'mesa_comedor', solid: true, draw: (p) => homeTable(p, homeFloor) },
  { key: 'silla', solid: true, draw: (p) => chair(p, homeFloor) },
  { key: 'cama', solid: true, draw: (p) => bed(p, 'cabecera') },
  { key: 'cama_pies', solid: true, draw: (p) => bed(p, 'pies') },
  {
    key: 'velador',
    solid: true,
    draw: (p) => {
      homeFloor(p);
      p.rect(2, 3, 12, 11, HOME.woodDark).rect(2, 3, 12, 10, '#b07848').rect(3, 8, 10, 1, HOME.woodDark).rect(7, 10, 2, 1, PAL.yellow);
      p.rect(4, 0, 6, 5, PAL.outline).rect(5, 1, 4, 3, '#1c1c28').rect(5, 2, 1, 1, '#ff5a4a').rect(7, 2, 1, 1, '#ff5a4a');
    },
  },
  {
    key: 'ropero',
    solid: true,
    draw: (p) => {
      p.fill(HOME.base);
      p.rect(1, 0, 14, 16, '#7a4c30').rect(2, 1, 5, 14, '#a87444').rect(9, 1, 5, 14, '#a87444');
      p.rect(7, 1, 2, 14, '#6a4028').rect(6, 7, 1, 2, PAL.yellow).rect(9, 7, 1, 2, PAL.yellow);
    },
  },
  {
    key: 'escritorio_casa',
    solid: true,
    draw: (p) => {
      homeFloor(p);
      p.rect(0, 2, 16, 11, HOME.woodDark).rect(0, 2, 16, 10, '#b88050');
      p.rect(2, 3, 7, 5, '#2a2a34').rect(3, 4, 5, 3, '#58a8d8').rect(10, 5, 4, 5, '#f4f0e4').rect(11, 6, 2, 1, '#8a8a96');
    },
  },
  {
    key: 'cocina',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(0, 1, 16, 14, '#3a3a44').rect(1, 2, 14, 12, '#e8e8e4');
      for (const [x, y] of [[4, 5], [11, 5], [4, 10], [11, 10]] as const) p.rect(x - 2, y - 2, 4, 4, '#2a2a30').rect(x - 1, y - 1, 2, 2, '#5a5a64');
    },
  },
  { key: 'lavaplatos', solid: true, draw: (p) => sinkCounter(p, false) },
  { key: 'lavaplatos_sucio', solid: true, draw: (p) => sinkCounter(p, true) },
  {
    key: 'mueble_cocina',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(0, 2, 16, 12, '#7a4c30').rect(0, 2, 16, 4, '#d8d0c0').rect(0, 6, 16, 8, '#a87444').rect(7, 6, 1, 8, '#7a4c30');
      p.rect(3, 9, 2, 1, PAL.metalLight).rect(10, 9, 2, 1, PAL.metalLight);
    },
  },
  {
    key: 'refri',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(2, 0, 12, 16, '#9aa0aa').rect(3, 1, 10, 14, '#f4f6f8').rect(3, 6, 10, 1, '#c8ccd4');
      p.rect(11, 2, 1, 3, PAL.metalDark).rect(11, 8, 1, 4, PAL.metalDark).rect(5, 9, 3, 3, PAL.yellow).rect(6, 10, 1, 1, PAL.red);
    },
  },
  {
    key: 'sofa',
    solid: true,
    draw: (p) => {
      homeFloor(p);
      p.rect(0, 3, 16, 12, '#5a3c6c').rect(0, 3, 16, 5, '#7a5a8c').rect(1, 8, 14, 6, '#8a6a9c').rect(7, 8, 1, 6, '#6a4c7c');
    },
  },
  {
    key: 'tele',
    solid: true,
    draw: (p) => {
      homeWall(p);
      p.rect(1, 3, 14, 9, PAL.outline).rect(2, 4, 12, 7, '#283858').rect(3, 5, 4, 2, '#3c5488').rect(5, 12, 6, 4, HOME.woodDark);
    },
  },
  {
    key: 'alfombra',
    solid: false,
    draw: (p) => (homeFloor(p), p.rect(0, 1, 16, 14, '#b84848'), p.rect(0, 3, 16, 1, '#e8c060'), p.rect(0, 12, 16, 1, '#e8c060'), p.rect(5, 6, 6, 4, '#d86868')),
  },
  {
    key: 'ducha',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(1, 1, 14, 14, '#b8c8d0').rect(2, 2, 12, 12, '#d8e8f0').rect(7, 7, 2, 2, PAL.metalDark);
      p.rect(2, 2, 12, 1, PAL.metal).rect(1, 1, 1, 14, 'rgba(160,210,240,0.7)');
      for (const [x, y] of [[4, 5], [10, 4], [5, 11], [11, 10]] as const) p.px(x, y, '#a8c8e0');
    },
  },
  {
    key: 'wc',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(4, 1, 8, 4, '#d8dce0').rect(4, 1, 8, 1, '#f8f8f8');
      p.rect(3, 5, 10, 10, '#c8ccd0').rect(4, 6, 8, 8, '#f8f8f8').rect(5, 7, 6, 6, '#c8e4f0');
    },
  },
  {
    key: 'lavamanos',
    solid: true,
    draw: (p) => {
      homeTile(p);
      p.rect(3, 0, 10, 4, '#9cc8e8').rect(4, 0, 3, 2, '#d8f0ff');
      p.rect(2, 5, 12, 8, '#c8ccd0').rect(3, 6, 10, 6, '#f8f8f8').rect(5, 7, 6, 4, '#d8e8f0').rect(7, 5, 2, 2, PAL.metalDark);
    },
  },

  // --- Estación de trenes y exteriores (misión 2) ---
  {
    key: 'muro_tren',
    solid: true,
    draw: (p) => {
      p.fill('#efe6d2');
      p.rect(0, 0, 16, 2, '#c8b898').rect(0, 5, 16, 1, '#c8b898');
      p.rect(0, 8, 16, 3, '#d8232a').rect(0, 8, 16, 1, '#ee5a5f').rect(0, 11, 16, 1, '#1e2128');
      p.rect(0, 14, 16, 2, '#9a8c78');
    },
  },
  {
    key: 'reja',
    solid: true,
    draw: (p) => {
      sidewalk(p);
      p.rect(0, 4, 16, 1, '#3a3a44').rect(0, 12, 16, 1, '#3a3a44');
      for (let x = 1; x < 16; x += 3) p.rect(x, 2, 1, 12, '#4a4a54');
    },
  },
  {
    key: 'tierra',
    solid: false,
    draw: (p) => (p.fill('#c8a878'), p.speckle(23, 10, '#b09060'), p.speckle(47, 6, '#dcc094')),
  },

  // --- Universidad (misión 2) ---
  { key: 'u_piso', solid: false, draw: uniFloor },
  { key: 'u_muro', solid: true, draw: uniWall },
  {
    key: 'u_ventana',
    solid: true,
    draw: (p) => {
      uniWall(p);
      p.rect(1, 1, 14, 12, '#8a8e98').rect(2, 2, 12, 10, PAL.sky).rect(2, 8, 12, 4, '#b8c8b0').rect(7, 2, 2, 10, '#8a8e98').rect(3, 3, 3, 2, '#d8f0ff');
    },
  },
  {
    key: 'u_puerta',
    solid: true,
    draw: (p) => {
      uniWall(p);
      p.rect(2, 1, 12, 15, UNI.doorDark).rect(3, 2, 10, 14, UNI.door).rect(5, 3, 6, 4, '#c8e0f0').rect(5, 3, 2, 2, '#e8f8ff');
      p.rect(11, 9, 1, 2, PAL.yellow);
    },
  },
  {
    key: 'u_puerta_abierta',
    solid: false,
    draw: (p) => {
      uniWall(p);
      p.rect(2, 1, 12, 15, UNI.doorDark).rect(3, 2, 10, 14, '#3a3440').rect(3, 12, 10, 4, UNI.floorDark);
    },
  },
  {
    key: 'pizarra',
    solid: true,
    draw: (p) => {
      uniWall(p);
      p.rect(0, 1, 16, 12, '#6a6c78').rect(0, 2, 16, 10, '#f8f8f4');
      p.rect(2, 4, 6, 1, '#3c6cd0').rect(2, 6, 9, 1, '#2a2433').rect(2, 8, 5, 1, '#c83838').rect(9, 9, 5, 1, '#2a2433');
      p.rect(0, 12, 16, 1, '#8a8c98');
    },
  },
  {
    key: 'pupitre',
    solid: true,
    draw: (p) => {
      uniFloor(p);
      p.rect(1, 1, 14, 6, '#6a4c30').rect(1, 1, 14, 5, '#c8a070').rect(2, 2, 12, 1, '#dcb888');
      p.rect(4, 8, 8, 6, '#3a3a48').rect(4, 8, 8, 5, '#5a5a6c').rect(3, 13, 1, 2, PAL.metalDark).rect(12, 13, 1, 2, PAL.metalDark);
    },
  },
  {
    key: 'escritorio',
    solid: true,
    draw: (p) => {
      uniFloor(p);
      p.rect(0, 2, 16, 11, '#4a3020').rect(0, 2, 16, 10, '#7a5030').rect(0, 2, 16, 1, '#9a6c48');
      p.rect(2, 4, 5, 4, '#2a2a34').rect(3, 5, 3, 2, '#58a8d8').rect(9, 4, 5, 6, '#f4f0e4').rect(10, 5, 3, 1, '#8a8a96').rect(10, 7, 2, 1, '#8a8a96');
    },
  },
  {
    key: 'librero',
    solid: true,
    draw: (p) => {
      p.fill('#4a3020');
      for (const y of [1, 6, 11]) {
        p.rect(1, y, 14, 4, '#6a4428');
        const colors = ['#7a2a3c', '#2f5fb0', '#3c8c5c', '#c8a040', '#2a2433', '#a84838'];
        for (let x = 1, i = y; x < 14; x += 2, i++) p.rect(x, y, 2, 4, colors[i % colors.length]);
      }
    },
  },
  {
    key: 'u_cartel',
    solid: true,
    draw: (p) => {
      uniWall(p);
      p.rect(1, 2, 14, 10, '#c8a070').rect(2, 3, 12, 8, '#e8d4b0');
      p.rect(3, 4, 4, 3, '#f8f070').rect(8, 4, 5, 2, '#a8d8f0').rect(4, 8, 6, 2, '#f8a8a8').rect(11, 7, 2, 3, '#b8e8a8');
    },
  },

  // --- Restorán de Paine (misión 3) ---
  { key: 'resto_piso', solid: false, draw: restoFloor },
  { key: 'resto_muro', solid: true, draw: restoWall },
  {
    key: 'resto_cuadro',
    solid: true,
    draw: (p) => {
      // Cuadro de una sandía: Paine, capital de la sandía.
      restoWall(p);
      p.rect(3, 1, 10, 7, RESTO.woodDark).rect(4, 2, 8, 5, '#f8f0d8');
      p.rect(5, 3, 6, 3, '#3c8c3c').rect(6, 3, 4, 2, '#e85050').px(7, 4, '#2a2433').px(9, 3, '#2a2433');
    },
  },
  {
    key: 'resto_ventana',
    solid: true,
    draw: (p) => {
      restoWall(p);
      p.rect(3, 1, 10, 8, RESTO.woodDark).rect(4, 2, 8, 6, '#1c2440').px(6, 3, '#f0d048').px(10, 5, '#c8d0f0');
    },
  },
  { key: 'mesa_resto', solid: true, draw: restoTable },
  { key: 'silla_resto', solid: true, draw: (p) => restoChair(p, 'bottom') },
  { key: 'silla_resto_n', solid: true, draw: (p) => restoChair(p, 'top') },
  {
    key: 'resto_meson',
    solid: true,
    draw: (p) => {
      restoFloor(p);
      p.rect(0, 2, 16, 12, RESTO.woodDark).rect(0, 2, 16, 4, '#d8c8a8').rect(0, 6, 16, 7, '#a86c40');
      p.rect(3, 0, 2, 4, '#3c8c3c').rect(10, 0, 3, 4, '#a83838').rect(10, 0, 3, 1, '#f0e0c0');
    },
  },

  // --- Auto de la familia (misión 3) ---
  { key: 'auto_piso', solid: false, draw: (p) => p.fill('#2e3038').speckle(5, 8, '#3a3c46') },
  { key: 'auto_asiento', solid: true, draw: (p) => forwardSeat(p, (q) => q.fill('#2e3038'), '#4a4c56', '#2a2c34', '#62646e', '#3a3c46') },
  {
    key: 'auto_ventana',
    solid: true,
    draw: (p) => {
      // Ventana de noche en la carretera: luces de la ruta pasando.
      p.fill('#8a8e98').rect(0, 2, 16, 11, '#3a3e48').rect(1, 3, 14, 9, '#141a30');
      p.rect(1, 9, 14, 3, '#20242c').rect(2, 10, 3, 1, '#f0d048').rect(9, 10, 3, 1, '#f0d048').px(13, 4, '#c8d0f0').px(5, 5, '#f0a050');
    },
  },
  {
    key: 'auto_tablero',
    solid: true,
    draw: (p) => {
      p.fill('#1e2028').rect(0, 0, 6, 16, '#141a30').rect(1, 6, 3, 2, '#f0d048');
      p.rect(6, 1, 9, 14, '#2a2c34').rect(8, 4, 5, 3, '#58c8a8').rect(9, 9, 3, 3, '#e86050').px(10, 10, '#f8f8f0');
    },
  },
  { key: 'auto_carroceria', solid: true, draw: (p) => p.fill('#5a6070').rect(0, 0, 16, 2, '#7a8090').rect(0, 14, 16, 2, '#3c404c') },

  // --- Aeropuertos (misión 3) ---
  { key: 'aero_piso', solid: false, draw: aeroFloor },
  { key: 'aero_alfombra', solid: false, draw: aeroCarpet },
  {
    key: 'aero_guia',
    solid: false,
    draw: (p) => (aeroFloor(p), p.rect(0, 6, 16, 4, '#f0c030'), p.rect(0, 7, 16, 2, '#f8d860')),
  },
  { key: 'aero_muro', solid: true, draw: aeroWall },
  { key: 'aero_ventanal', solid: true, draw: (p) => aeroWindow(p, false) },
  { key: 'aero_ventanal_avion', solid: true, draw: (p) => aeroWindow(p, true) },
  {
    key: 'aero_pantalla',
    solid: true,
    draw: (p) => {
      // Pantalla de vuelos: filas amarillas y blancas sobre azul oscuro.
      aeroWall(p);
      p.rect(1, 4, 14, 9, '#1a1c24').rect(2, 5, 12, 7, '#14286a');
      for (const y of [6, 8, 10]) p.rect(3, y, 4, 1, '#f0d048').rect(8, y, 5, 1, '#e8ecf8');
    },
  },
  {
    key: 'aero_mural',
    solid: true,
    draw: (p) => {
      // Mural del desierto de Atacama (espigón D).
      aeroWall(p);
      p.rect(0, 4, 16, 9, '#f0a868').rect(0, 4, 16, 3, '#88b8e0').rect(0, 9, 16, 4, '#d88850');
      p.rect(2, 6, 5, 3, '#c87848').rect(9, 5, 6, 4, '#b86c40').px(12, 5, '#f8f8f0');
    },
  },
  {
    key: 'aero_meson',
    solid: true,
    draw: (p) => {
      // Counter de check-in: cubierta clara, frente de madera y pantallita.
      aeroFloor(p);
      p.rect(0, 3, 16, 11, AERO.woodDark).rect(0, 3, 16, 4, '#f4f2ec').rect(0, 7, 16, 6, AERO.wood);
      p.rect(9, 0, 5, 4, '#2a2c34').rect(10, 1, 3, 2, '#58a8d8');
    },
  },
  {
    key: 'aero_cinta',
    solid: true,
    draw: (p) => {
      aeroFloor(p);
      p.rect(0, 4, 16, 9, '#3a3c44').rect(0, 5, 16, 7, '#52545e');
      for (let x = 1; x < 16; x += 3) p.rect(x, 5, 1, 7, '#3a3c44');
    },
  },
  {
    key: 'aero_balanza',
    solid: true,
    draw: (p) => (aeroFloor(p), p.rect(1, 3, 14, 11, '#8a8e98'), p.rect(2, 4, 12, 8, PAL.metalLight), p.rect(5, 12, 6, 2, '#1a1c24'), p.rect(6, 12, 4, 1, '#58c858')),
  },
  {
    key: 'aero_valla',
    solid: true,
    draw: (p) => {
      // Fila con postes y cinta retráctil.
      aeroFloor(p);
      p.rect(1, 3, 2, 11, PAL.metalDark).rect(13, 3, 2, 11, PAL.metalDark).rect(1, 3, 2, 1, PAL.metalLight).rect(13, 3, 2, 1, PAL.metalLight);
      p.rect(3, 5, 10, 2, '#2f4a8c');
    },
  },
  { key: 'aero_asiento', solid: true, draw: (p) => seatAero(p, 'top') },
  { key: 'aero_asiento_s', solid: true, draw: (p) => seatAero(p, 'bottom') },
  {
    key: 'aero_caseta',
    solid: true,
    draw: (p) => {
      // Caseta de control de pasaportes, con vidrio.
      aeroFloor(p);
      p.rect(1, 1, 14, 14, '#2a3a5c').rect(2, 2, 12, 6, 'rgba(160,210,240,0.8)').rect(2, 9, 12, 5, '#3c5080').rect(5, 9, 6, 1, '#f0d048');
    },
  },
  {
    key: 'aero_rayos',
    solid: true,
    draw: (p) => {
      // Máquina de rayos X con la cinta asomando.
      aeroFloor(p);
      p.rect(0, 5, 16, 6, '#3a3c44');
      p.rect(3, 1, 10, 14, '#9aa0aa').rect(4, 2, 8, 12, '#c8ccd4').rect(5, 6, 6, 4, '#1a1c24').px(7, 3, '#e86050');
    },
  },
  {
    key: 'aero_arco',
    solid: false,
    draw: (p) => {
      // Arco detector de metales (se pasa caminando).
      aeroFloor(p);
      p.rect(1, 0, 2, 16, '#9aa0aa').rect(13, 0, 2, 16, '#9aa0aa').rect(1, 0, 14, 2, '#9aa0aa').px(8, 1, '#58c858');
    },
  },
  {
    key: 'aero_estante',
    solid: true,
    draw: (p) => {
      // Duty free: perfumes, chocolates y pisco.
      aeroFloor(p);
      p.rect(0, 1, 16, 14, '#3a2c3c');
      for (const y of [2, 7, 12]) p.rect(1, y + 3, 14, 1, '#f0e0c0');
      p.rect(2, 3, 2, 2, '#e888c8').rect(5, 2, 2, 3, '#c8a040').rect(9, 3, 3, 2, '#58c8f0').rect(13, 2, 1, 3, '#e8ecf8');
      p.rect(2, 7, 4, 3, '#7a4428').rect(7, 8, 3, 2, '#d84848').rect(11, 7, 3, 3, '#f0d048');
      p.rect(2, 12, 1, 3, '#a8c8a0').rect(4, 12, 1, 3, '#a8c8a0').rect(8, 12, 2, 3, '#c89060').rect(12, 12, 2, 3, '#f0e0c0');
    },
  },
  {
    key: 'aero_kiosko',
    solid: true,
    draw: (p) => (aeroFloor(p), p.rect(4, 1, 8, 14, '#2a2c34'), p.rect(5, 2, 6, 5, '#58a8d8'), p.rect(6, 9, 4, 1, '#f0d048'), p.rect(5, 14, 6, 1, '#1a1c24')),
  },
  {
    key: 'aero_planta',
    solid: true,
    draw: (p) => {
      aeroFloor(p);
      p.rect(4, 10, 8, 5, '#6a6c78').rect(4, 10, 8, 1, '#8a8c98');
      p.rect(3, 3, 10, 7, PAL.leaf).rect(5, 1, 6, 3, PAL.leafLight).rect(2, 6, 3, 3, PAL.leafDark).rect(11, 5, 3, 3, PAL.leafDark);
    },
  },
  {
    key: 'cinta_maletas',
    solid: true,
    draw: (p) => {
      // Cinta de equipaje con maletas dando vueltas.
      aeroFloor(p);
      p.rect(0, 2, 16, 12, '#2a2c34').rect(0, 3, 16, 10, '#44464e');
      p.rect(1, 4, 6, 5, '#2f4a8c').rect(9, 6, 5, 6, '#c84848').rect(9, 6, 5, 1, '#e86868').rect(3, 4, 2, 1, '#9aa0aa');
    },
  },
  {
    key: 'pista',
    solid: true,
    draw: (p) => p.fill('#22242c').speckle(31, 10, '#2c2e38').speckle(7, 4, '#1a1c22'),
  },
  { key: 'manga_piso', solid: false, draw: (p) => p.fill('#6a6c78').rect(0, 0, 16, 1, '#5a5c66').rect(0, 8, 16, 1, '#5a5c66') },
  {
    key: 'manga_muro',
    solid: true,
    draw: (p) => p.fill('#c8ccd4').rect(1, 0, 3, 16, '#9aa0aa').rect(12, 0, 3, 16, '#9aa0aa').rect(5, 3, 6, 4, '#18203c'),
  },

  // --- Avión (misión 3) ---
  { key: 'avion_piso', solid: false, draw: planeFloor },
  { key: 'avion_asiento', solid: true, draw: (p) => forwardSeat(p, planeFloor, PLANE.seat, PLANE.seatDark, PLANE.seatLight, '#e8ecf0') },
  { key: 'avion_asiento_premium', solid: true, draw: (p) => forwardSeat(p, planeFloor, '#8a2a3c', '#5a1a28', '#b84a5c', '#f0e8d8') },
  { key: 'avion_ventana', solid: true, draw: (p) => planeWall(p, true) },
  { key: 'avion_muro', solid: true, draw: (p) => planeWall(p, false) },
  {
    key: 'avion_galley',
    solid: true,
    draw: (p) => {
      planeFloor(p);
      p.rect(0, 1, 16, 14, '#9aa0aa').rect(1, 2, 6, 12, '#c8ccd4').rect(9, 2, 6, 12, '#c8ccd4').rect(5, 7, 1, 2, '#3a3c44').rect(10, 7, 1, 2, '#3a3c44');
    },
  },
  {
    key: 'avion_bano',
    solid: true,
    draw: (p) => (planeWall(p, false), p.rect(3, 2, 10, 12, '#c8ccd4'), p.rect(4, 3, 8, 10, '#dcdfe4'), p.rect(6, 5, 4, 2, '#d84848'), p.rect(10, 8, 1, 2, PAL.metalDark)),
  },
  {
    key: 'avion_puerta',
    solid: false,
    draw: (p) => (p.fill('#9aa0aa'), p.rect(2, 0, 12, 16, '#dcdfe4'), p.rect(3, 1, 10, 14, '#6a6c78'), p.rect(5, 4, 6, 3, '#18203c')),
  },

  // --- Furgón y Cali (misión 3) ---
  { key: 'furgon_asiento', solid: true, draw: (p) => forwardSeat(p, busFloor, VAN.seat, VAN.seatDark, VAN.seatLight) },
  {
    key: 'furgon_ventana',
    solid: true,
    draw: (p) => {
      // Ventana de día: cañaduzales del Valle del Cauca y los cerros al fondo.
      p.fill('#e8ecf0');
      p.rect(1, 2, 14, 9, '#a8dcf8').rect(1, 5, 14, 2, '#5a8a9c').rect(1, 7, 14, 4, '#58a848');
      for (let x = 2; x < 15; x += 3) p.rect(x, 6, 1, 3, '#78c858');
      p.rect(0, 12, 16, 4, VAN.floor);
    },
  },
  {
    key: 'cerro',
    solid: true,
    draw: (p) => {
      // Los Farallones: cerros verdes con niebla arriba.
      p.fill('#3c7c58');
      p.rect(0, 0, 16, 4, '#a8c8c8').rect(0, 4, 16, 2, '#6a9c88');
      p.speckle(13, 12, '#2c6448').speckle(41, 6, '#58a070');
    },
  },
  {
    key: 'palmera',
    solid: true,
    draw: (p) => {
      grass(p);
      p.rect(4, 13, 9, 2, 'rgba(0,0,0,0.18)').rect(7, 5, 2, 10, '#8a6a40').rect(7, 7, 2, 1, '#6a4c2c').rect(7, 10, 2, 1, '#6a4c2c');
      p.rect(2, 2, 12, 2, PAL.leaf).rect(1, 4, 3, 2, PAL.leafDark).rect(12, 4, 3, 2, PAL.leafDark).rect(5, 0, 6, 3, PAL.leafLight).rect(7, 4, 2, 2, '#c89040');
    },
  },
  {
    key: 'cana',
    solid: true,
    draw: (p) => {
      grass(p);
      for (let x = 1; x < 16; x += 3) p.rect(x, 2, 1, 13, '#78a848').px(x + 1, 3, '#a8d878').px(x - 1, 7, '#a8d878');
    },
  },

  ...caliTiles(),
  ...m5Tiles(),
  ...m6Tiles(),
  ...buildingTiles(),
];

export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILE_DEFS.map((t, i) => [t.key, i]));
