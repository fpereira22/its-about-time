import { PAL, shade } from './palette';
import type { DoorStyleId } from './doors';
import { Painter } from './Painter';

export interface VehicleArt {
  w: number;
  h: number;
  draw: (p: Painter) => void;
  /** Puertas corredizas animadas (coordenadas dentro de la textura). La textura dibuja el interior detrás. */
  doors?: { style: DoorStyleId; rects: Array<{ x: number; y: number; w: number; h: number }> };
  /** Se dibuja espejado (mira a la izquierda: va hacia el poniente). Las puertas ya vienen espejadas. */
  mirror?: boolean;
  /** Se dibuja dado vuelta de arriba abajo (visto desde arriba, va hacia el norte). */
  flipY?: boolean;
}

/** Interior que se ve cuando se abre una puerta. */
function doorway(p: Painter, x: number, y: number, w: number, h: number, seat: string): void {
  p.rect(x, y, w, h, '#2e3040').rect(x, y, w, 2, '#f4f0d8');
  p.rect(x + 1, y + h - 7, w - 2, 4, seat).rect(x, y + h - 2, w, 2, '#5a5c68');
}

const BUS_DOOR = { x: 32, y: 5, w: 8, h: 13 };
/** Puerta central de cada carro del tren (relativa al carro). */
const TRAIN_DOOR = { x: 25, y: 6, w: 10, h: 22 };
const CAR_W = 64;

function bus(p: Painter, full: boolean, stripe: string = PAL.red, roof = '#d8dce0'): void {
  // Vista lateral-cenital, el frente mira a la derecha (viaja al oriente).
  p.rect(1, 20, 46, 2, 'rgba(0,0,0,0.25)');
  p.rect(0, 2, 48, 18, PAL.outline);
  p.rect(1, 3, 46, 16, '#f2f2ee');
  p.rect(1, 3, 46, 3, roof);
  p.rect(1, 14, 46, 3, stripe);
  for (let x = 4; x < 30; x += 7) {
    p.rect(x, 7, 6, 6, PAL.tunnel).rect(x, 7, 6, 1, '#3c4c68');
    if (full) {
      p.rect(x + 1, 9, 4, 4, '#d8a078').rect(x + 1, 9, 4, 2, x % 2 ? '#2a2020' : '#5a3828');
    }
  }
  doorway(p, BUS_DOOR.x, BUS_DOOR.y, BUS_DOOR.w, BUS_DOOR.h, PAL.seatRed);
  p.rect(41, 6, 6, 8, PAL.glass).rect(42, 7, 2, 3, PAL.glassLight);
  p.rect(43, 3, 4, 2, PAL.yellow);
  p.rect(6, 17, 7, 4, PAL.outline).rect(8, 18, 3, 2, PAL.metalDark);
  p.rect(34, 17, 7, 4, PAL.outline).rect(36, 18, 3, 2, PAL.metalDark);
}

/** Bus visto desde arriba, con el frente hacia abajo: techo blanco, aire acondicionado y la franja verde. */
function busTop(p: Painter): void {
  p.rect(2, 2, 20, 48, 'rgba(0,0,0,0.22)');
  p.rect(0, 0, 20, 48, PAL.outline);
  p.rect(1, 1, 18, 46, '#f2f2ee');
  p.rect(1, 1, 2, 46, '#2c9c4c').rect(17, 1, 2, 46, '#2c9c4c');
  p.rect(5, 10, 10, 12, '#c8ccd4').rect(6, 11, 8, 10, '#a8b0bc').rect(7, 13, 6, 1, '#8a909c').rect(7, 16, 6, 1, '#8a909c');
  p.rect(5, 28, 10, 6, '#d8dce0').rect(6, 29, 8, 4, '#9cd8a8');
  p.rect(2, 41, 16, 6, PAL.glass).rect(3, 42, 5, 2, PAL.glassLight);
  p.rect(1, 47, 3, 1, '#fff6a0').rect(16, 47, 3, 1, '#fff6a0');
  p.rect(5, 2, 10, 2, '#d8dce0');
}

/** Puertas del articulado (misión 6), del lado del andén: dos en el primer cuerpo y una en el segundo. */
const ART_DOORS = [
  { x: 14, y: 5, w: 9, h: 14 },
  { x: 38, y: 5, w: 9, h: 14 },
  { x: 80, y: 5, w: 9, h: 14 },
];

/** El bus troncal articulado: dos cuerpos unidos por el fuelle, verde y blanco, el frente a la derecha. */
function articulado(p: Painter): void {
  p.rect(2, 22, 108, 2, 'rgba(0,0,0,0.25)');
  for (const [x0, w] of [[0, 54], [60, 52]] as const) {
    p.rect(x0, 1, w, 21, PAL.outline);
    p.rect(x0 + 1, 2, w - 2, 19, '#f2f2ee');
    p.rect(x0 + 1, 2, w - 2, 3, '#d8dce0');
    p.rect(x0 + 1, 15, w - 2, 4, '#2c8c5c');
    p.rect(x0 + 1, 14, w - 2, 1, '#48b07c');
    for (let x = x0 + 4; x < x0 + w - 6; x += 8) p.rect(x, 7, 6, 6, PAL.tunnel).rect(x, 7, 6, 1, '#3c4c68');
  }
  // Fuelle (acordeón) entre los dos cuerpos.
  p.rect(54, 3, 6, 17, '#2a2c34');
  for (let y = 4; y < 19; y += 2) p.rect(54, y, 6, 1, '#4a4c56');
  for (const d of ART_DOORS) doorway(p, d.x, d.y, d.w, d.h, '#2c8c5c');
  // Parabrisas, letrero de ruta y faroles.
  p.rect(104, 5, 7, 10, PAL.glass).rect(105, 6, 2, 4, PAL.glassLight);
  p.rect(92, 2, 18, 3, '#1c1c24').rect(93, 3, 10, 1, '#f0a030');
  p.rect(109, 16, 2, 2, '#fff6a0');
  for (const x of [8, 44, 70, 98]) p.rect(x, 18, 8, 5, PAL.outline).rect(x + 2, 19, 4, 3, PAL.metalDark);
}

function carSedan(p: Painter, body: string, roof?: string, isTaxi = false): void {
  p.rect(1, 12, 26, 2, 'rgba(0,0,0,0.25)');
  p.rect(0, 3, 28, 9, PAL.outline);
  p.rect(1, 6, 26, 6, body);
  p.rect(1, 11, 26, 1, shade(body, -0.25));
  const rColor = roof ?? body;
  p.rect(6, 2, 14, 5, PAL.outline);
  p.rect(7, 3, 12, 4, rColor);
  p.rect(7, 3, 12, 1, shade(rColor, 0.2));
  p.rect(16, 4, 3, 3, PAL.glass).rect(17, 4, 1, 2, PAL.glassLight);
  p.rect(7, 4, 2, 3, PAL.glass);
  p.rect(10, 4, 5, 3, PAL.glass).rect(12, 4, 1, 3, PAL.outline);
  p.rect(26, 7, 2, 2, '#fff6a0');
  p.rect(0, 7, 2, 2, '#ef4444');
  p.rect(26, 9, 2, 2, PAL.metalDark);
  p.rect(0, 9, 2, 2, PAL.metalDark);
  p.rect(4, 10, 5, 4, PAL.outline).rect(5, 11, 3, 2, PAL.metalDark).rect(6, 11, 1, 2, PAL.metalLight);
  p.rect(19, 10, 5, 4, PAL.outline).rect(20, 11, 3, 2, PAL.metalDark).rect(21, 11, 1, 2, PAL.metalLight);
  if (isTaxi) {
    p.rect(11, 0, 5, 2, '#f0c828').rect(12, 0, 3, 1, PAL.outline);
  }
}

function carHatchback(p: Painter, body: string): void {
  p.rect(1, 12, 22, 2, 'rgba(0,0,0,0.25)');
  p.rect(0, 3, 24, 9, PAL.outline);
  p.rect(1, 6, 22, 6, body);
  p.rect(1, 11, 22, 1, shade(body, -0.25));
  p.rect(4, 2, 14, 5, PAL.outline);
  p.rect(5, 3, 12, 4, body);
  p.rect(5, 3, 12, 1, shade(body, 0.2));
  p.rect(14, 4, 3, 3, PAL.glass).rect(15, 4, 1, 2, PAL.glassLight);
  p.rect(5, 4, 2, 3, PAL.glass);
  p.rect(8, 4, 5, 3, PAL.glass);
  p.rect(22, 7, 2, 2, '#fff6a0');
  p.rect(0, 7, 2, 2, '#ef4444');
  p.rect(3, 10, 5, 4, PAL.outline).rect(4, 11, 3, 2, PAL.metalDark);
  p.rect(16, 10, 5, 4, PAL.outline).rect(17, 11, 3, 2, PAL.metalDark);
}

function van(p: Painter): void {
  p.rect(1, 14, 30, 2, 'rgba(0,0,0,0.25)');
  p.rect(0, 1, 32, 14, PAL.outline);
  p.rect(1, 2, 30, 13, '#f1f5f9');
  p.rect(1, 2, 30, 2, '#e2e8f0');
  p.rect(1, 13, 30, 1, '#cbd5e1');
  p.rect(22, 3, 6, 5, PAL.glass).rect(24, 4, 2, 3, PAL.glassLight);
  p.rect(16, 3, 5, 5, PAL.glass).rect(15, 3, 1, 10, '#cbd5e1');
  p.rect(8, 5, 1, 7, '#94a3b8');
  p.rect(30, 8, 2, 3, '#fff6a0');
  p.rect(0, 8, 2, 3, '#ef4444');
  p.rect(5, 12, 6, 4, PAL.outline).rect(6, 13, 4, 2, PAL.metalDark);
  p.rect(21, 12, 6, 4, PAL.outline).rect(22, 13, 4, 2, PAL.metalDark);
}

/** Tren de 4 carros del metro (franja roja de la Línea 1). */
function train(p: Painter, stripe: string = PAL.metroRed, stripeLight: string = PAL.metroRedLight): void {
  for (let c = 0; c < 4; c++) {
    const x = c * CAR_W;
    p.rect(x + 1, 1, CAR_W - 2, 30, PAL.outline);
    p.rect(x + 2, 2, CAR_W - 4, 28, '#f2f3f5');
    p.rect(x + 2, 2, CAR_W - 4, 4, '#d4d7dd');
    p.rect(x + 2, 22, CAR_W - 4, 4, stripe).rect(x + 2, 22, CAR_W - 4, 1, stripeLight);
    for (const dx of [8, 42]) {
      p.rect(x + dx, 9, 14, 9, PAL.tunnel).rect(x + dx, 9, 14, 2, '#3c4c68').rect(x + dx + 2, 12, 3, 1, '#4c5c78');
    }
    doorway(p, x + TRAIN_DOOR.x, TRAIN_DOOR.y, TRAIN_DOOR.w, TRAIN_DOOR.h, PAL.seatMetro);
  }
  p.rect(249, 7, 6, 12, PAL.tunnel).rect(250, 8, 3, 3, PAL.glass).rect(1, 7, 6, 12, PAL.tunnel).rect(3, 8, 3, 3, PAL.glass);
  p.rect(251, 23, 3, 2, PAL.yellow).rect(2, 23, 3, 2, PAL.yellow);
}

/**
 * Tren de cercanías de EFE (Rancagua – Estación Central): unidades de dos coches, carrocería blanca,
 * franja negra continua en las ventanas, faldón rojo y frente negro con focos. Sin logos.
 */
function trainEfe(p: Painter): void {
  for (let c = 0; c < 4; c++) {
    const x = c * CAR_W;
    p.rect(x + 1, 1, CAR_W - 2, 30, PAL.outline);
    p.rect(x + 2, 2, CAR_W - 4, 28, '#f4f5f7');
    p.rect(x + 2, 2, CAR_W - 4, 3, '#c8ccd4').rect(x + 2, 5, CAR_W - 4, 1, '#e0e3e8');
    // Franja negra de ventanas, de punta a punta.
    p.rect(x + 2, 8, CAR_W - 4, 11, '#1e2128').rect(x + 2, 8, CAR_W - 4, 1, '#3a3e48');
    for (const dx of [6, 42]) p.rect(x + dx, 10, 14, 7, '#2e3a50').rect(x + dx + 1, 11, 4, 2, '#4a5a78');
    // Faldón rojo con filete gris.
    p.rect(x + 2, 23, CAR_W - 4, 4, '#d8232a').rect(x + 2, 22, CAR_W - 4, 1, '#9aa0aa').rect(x + 2, 27, CAR_W - 4, 1, '#9c1a1f');
    doorway(p, x + TRAIN_DOOR.x, TRAIN_DOOR.y, TRAIN_DOOR.w, TRAIN_DOOR.h, '#3c4a6c');
    // Unión entre coches.
    if (c > 0) p.rect(x, 6, 2, 20, '#5a5e68');
  }
  // Frentes negros con focos.
  for (const fx of [1, 247]) {
    p.rect(fx, 4, 8, 22, '#1a1c22').rect(fx + (fx === 1 ? 2 : 1), 7, 5, 8, '#2e3a50');
    p.rect(fx + (fx === 1 ? 1 : 5), 20, 2, 2, '#fff6a0');
  }
}


/**
 * El carro de Grover (misión 5): un cacharro de los noventa color mostaza con una puerta gris de otro
 * carro, óxido, un parachoques amarrado con alambre, la tricolor boliviana en el vidrio de atrás y una
 * llama de peluche en el tablero. Mira a la derecha.
 */
function groverCar(p: Painter): void {
  const body = '#c8a038';
  p.rect(1, 13, 28, 2, 'rgba(0,0,0,0.25)');
  p.rect(0, 4, 30, 9, PAL.outline);
  p.rect(1, 7, 28, 5, body).rect(1, 11, 28, 1, shade(body, -0.3));
  // Techo redondo y bajito.
  p.rect(6, 1, 15, 7, PAL.outline).rect(7, 2, 13, 5, body).rect(7, 2, 13, 1, shade(body, 0.25));
  // Ventanas; en la de atrás, la tricolor (rojo, amarillo, verde) y en el tablero la llama.
  p.rect(8, 3, 4, 3, PAL.glass).rect(13, 3, 6, 3, PAL.glass).rect(17, 3, 1, 2, PAL.glassLight);
  p.rect(8, 3, 1, 3, '#d83838').rect(9, 3, 1, 3, '#f0c030').rect(10, 3, 1, 3, '#2c9c4c');
  p.rect(18, 4, 2, 2, '#f4f0e6').px(19, 3, '#f4f0e6');
  // La puerta gris (de otro carro) y manchas de óxido.
  p.rect(13, 7, 6, 4, '#8a8e98').rect(13, 7, 6, 1, '#a8acb4').px(17, 9, PAL.outline);
  p.rect(3, 9, 2, 1, '#8a5428').rect(24, 8, 1, 2, '#8a5428').px(26, 10, '#8a5428');
  // Focos (uno quemado), parachoques con alambre y el tubo de escape humeando.
  p.rect(28, 7, 2, 2, '#fff6a0').rect(0, 7, 2, 2, '#7a2a2a');
  p.rect(27, 11, 3, 1, '#a8acb4').rect(26, 10, 1, 2, '#e0e0e0');
  p.rect(0, 11, 2, 1, '#5a5c64');
  // Ruedas (una con tapa, la otra no).
  p.rect(4, 10, 6, 5, PAL.outline).rect(5, 11, 4, 3, PAL.metalDark).rect(6, 12, 2, 1, PAL.metalLight);
  p.rect(20, 10, 6, 5, PAL.outline).rect(21, 11, 4, 3, '#2a2a30');
}

/** Sprites grandes (varios tiles) que se mueven en eventos y en el tráfico de la ciudad. */
export const VEHICLE_ART: Record<string, VehicleArt> = {
  micro: { w: 48, h: 22, draw: (p) => bus(p, false), doors: { style: 'bus', rects: [BUS_DOOR] } },
  micro_llena: { w: 48, h: 22, draw: (p) => bus(p, true), doors: { style: 'bus', rects: [BUS_DOOR] } },
  /** Bus alimentador de Cali (misión 4): blanco con franja verde. */
  bus_cali: { w: 48, h: 22, draw: (p) => bus(p, false, '#2c9c4c', '#9cd8a8'), doors: { style: 'bus', rects: [BUS_DOOR] } },
  /** El mismo, yendo hacia el poniente (por la pista norte de la calle de Pance). */
  bus_cali_izq: {
    w: 48,
    h: 22,
    mirror: true,
    draw: (p) => bus(p, false, '#2c9c4c', '#9cd8a8'),
    doors: { style: 'bus', rects: [{ ...BUS_DOOR, x: 48 - BUS_DOOR.x - BUS_DOOR.w }] },
  },
  /** El mismo visto desde arriba, bajando por la Calle 18 (el frente abajo). */
  bus_cali_v: { w: 22, h: 50, draw: busTop },
  /** Misión 7: el mismo subiendo por la Calle 18 hacia el norte (el frente arriba), por la pista oriente. */
  bus_cali_v_n: { w: 22, h: 50, flipY: true, draw: busTop },
  /** Misión 6: el bus troncal articulado (T31), hacia el oriente y hacia el poniente. */
  articulado: { w: 112, h: 24, draw: articulado, doors: { style: 'bus', rects: ART_DOORS } },
  articulado_izq: {
    w: 112,
    h: 24,
    mirror: true,
    draw: articulado,
    doors: { style: 'bus', rects: ART_DOORS.map((d) => ({ ...d, x: 112 - d.x - d.w })) },
  },
  tren: {
    w: 256,
    h: 32,
    draw: (p) => train(p),
    doors: { style: 'tren', rects: [0, 1, 2, 3].map((c) => ({ ...TRAIN_DOOR, x: c * CAR_W + TRAIN_DOOR.x })) },
  },
  /** Tren de cercanías EFE (Rancagua – Estación Central). */
  tren_efe: {
    w: 256,
    h: 32,
    draw: trainEfe,
    doors: { style: 'tren_efe', rects: [0, 1, 2, 3].map((c) => ({ ...TRAIN_DOOR, x: c * CAR_W + TRAIN_DOOR.x })) },
  },
  taxi: { w: 28, h: 14, draw: (p) => carSedan(p, '#1e1e24', '#f0c828', true) },
  /** Taxi amarillo de Cali (misión 4). */
  taxi_cali: { w: 28, h: 14, draw: (p) => carSedan(p, '#f0c828', '#f0c828', true) },
  sedan_blanco: { w: 28, h: 14, draw: (p) => carSedan(p, '#f8fafc') },
  sedan_rojo: { w: 28, h: 14, draw: (p) => carSedan(p, '#dc2626') },
  sedan_azul: { w: 28, h: 14, draw: (p) => carSedan(p, '#2563eb') },
  sedan_gris: { w: 28, h: 14, draw: (p) => carSedan(p, '#475569') },
  hatchback_verde: { w: 24, h: 14, draw: (p) => carHatchback(p, '#10b981') },
  hatchback_naranjo: { w: 24, h: 14, draw: (p) => carHatchback(p, '#ea580c') },
  furgon: { w: 32, h: 16, draw: van },
  /** El cacharro de Grover (misión 5), hacia el oriente y hacia el poniente. */
  carro_grover: { w: 30, h: 16, draw: groverCar },
  carro_grover_izq: { w: 30, h: 16, mirror: true, draw: groverCar },
};
