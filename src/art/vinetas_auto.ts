import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { characterLook } from './SpriteRegistry';
import { drawSideArm, drawSideBody, hex, type SideFigureOpts } from './vinetas';
import { addG, floatZ, lerp, outlined, popText, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas del auto camino al aeropuerto (misión 3), de noche, vistas desde afuera por la ventana de atrás:
 *  - auto_dormido     tu hermano se durmió con la cabeza en tu hombro (Zzz y una gotita de baba);
 *                     afuera pasan los focos de la carretera y tu mamá tararea adelante
 *  - auto_avion       por el cielo baja un avión, lento como una estrella
 *  - auto_despierta   tu hermano despierta de golpe y apunta al avión
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

/** Hueco de la ventana (lo de afuera del auto lo tapa la carrocería). */
const WIN = { x: 14, y: 12, w: 192, h: 62 };
/** Donde se apoyan las caderas (el asiento queda bajo la puerta). */
const SEAT_Y = 82;
const PLAYER_X = 92;
const BRO = { scale: 0.72, x: 108, lean: -0.36 };
const CAR = '#5a6070';
const CAR_L = '#7a8090';
const CAR_D = '#3c404c';

/** El interior a oscuras y, por la ventana del otro lado, la noche con los cerros. */
function drawCarBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#121a30'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#18223c'), 1).fillRect(x, y + 34, w, 20);
  g.fillStyle(hex('#e8e8f0'), 1);
  for (let i = 0; i < 18; i++) g.fillRect(x + ((i * 53) % w), y + 14 + ((i * 17) % 22), 1, 1);
  // Cerros oscuros al otro lado de la carretera.
  g.fillStyle(hex('#0c1222'), 1);
  for (let i = 0; i < w; i += 2) g.fillRect(x + i, y + 50 - Math.round(Math.abs(Math.sin(i / 23)) * 6 + Math.sin(i / 7) * 2), 2, 20);
  // El asiento de atrás (respaldo) y los cinturones.
  outlined(g, [[x + 40, y + 46, 130, 40, '#3a3444']]);
  g.fillStyle(hex('#2e2a38'), 1).fillRect(x + 40, y + 46, 130, 2);
  g.fillStyle(hex('#4a4456'), 1).fillRect(x + 80, y + 48, 1, 38).fillRect(x + 126, y + 48, 1, 38);
}

/** La carrocería por encima de todo: techo, pilares, la puerta con su manilla y el reflejo del vidrio. */
function drawCarBody(g: G): void {
  const right = WIN.x + WIN.w;
  const bottom = WIN.y + WIN.h;
  g.fillStyle(hex(CAR), 1).fillRect(0, 0, 220, WIN.y).fillRect(0, bottom, 220, 108 - bottom);
  g.fillRect(0, WIN.y, WIN.x, WIN.h).fillRect(right, WIN.y, 220 - right, WIN.h);
  // Esquinas redondeadas del vidrio.
  g.fillRect(WIN.x, WIN.y, 3, 1).fillRect(WIN.x, WIN.y, 1, 3).fillRect(right - 3, WIN.y, 3, 1).fillRect(right - 1, WIN.y, 1, 3);
  // Burlete negro alrededor del vidrio.
  g.fillStyle(hex('#1a1a20'), 1).fillRect(WIN.x - 2, bottom, WIN.w + 4, 2).fillRect(WIN.x - 2, WIN.y - 2, WIN.w + 4, 2);
  g.fillRect(WIN.x - 2, WIN.y, 2, WIN.h).fillRect(right, WIN.y, 2, WIN.h);
  g.fillStyle(hex(CAR_L), 1).fillRect(0, 3, 220, 1).fillRect(0, bottom + 6, 220, 1);
  g.fillStyle(hex(CAR_D), 1).fillRect(0, bottom + 22, 220, 1).fillRect(118, bottom + 2, 1, 32);
  // Manilla.
  outlined(g, [[96, bottom + 10, 14, 3, '#a8b0bc']]);
  // Reflejo en el vidrio.
  g.fillStyle(0xffffff, 0.07);
  for (let i = 0; i < 20; i++) g.fillRect(150 + i, WIN.y + 4 + i * 2, 10, 2);
  for (let i = 0; i < 14; i++) g.fillRect(40 + i, WIN.y + 30 + i * 2, 5, 2);
}

/** Nota musical de pixel (el tarareo de tu mamá), que sube y se desvanece. */
function floatNote(kit: VinetaKit, layer: Layer, x: number, y: number): void {
  const n = addG(kit, layer, x, y);
  n.fillStyle(hex('#f0d890'), 1).fillRect(0, 4, 3, 2).fillRect(2, 0, 1, 5).fillRect(3, 0, 2, 1).fillRect(4, 1, 1, 1);
  kit.progress(1500, (t) => n.setPosition(Math.round(x - t * 10), Math.round(y - t * 10 + Math.sin(t * 8) * 2)).setAlpha(1 - t), () => n.destroy());
}

type Mode = 'dormido' | 'avion' | 'despierta';

function buildCar(kit: VinetaKit, mode: Mode): void {
  const { scene } = kit;
  const stage = kit.framed(drawCarBackdrop);
  // Afuera: los focos de la carretera pasan hacia atrás (el auto va a la derecha).
  const road = scene.add.container(0, 0);
  const sky = scene.add.container(0, 0);
  stage.add([sky, road]);
  const lamp = (): void => {
    const g = addG(kit, road, 230, 0);
    g.fillStyle(hex('#3a3e4a'), 1).fillRect(0, 14, 1, 40).fillRect(0, 14, 6, 1);
    g.fillStyle(hex('#f0a040'), 0.25).fillRect(2, 15, 7, 5);
    g.fillStyle(hex('#ffd890'), 1).fillRect(4, 15, 3, 1);
    kit.progress(1100, (t) => g.setX(lerp(230, -20, t)), () => g.destroy());
  };
  lamp();
  kit.every(900, lamp);
  // Autos que vienen por la otra pista: dos focos blancos chicos y rápidos.
  kit.every(2300, () => {
    const g = addG(kit, road, -10, 56);
    g.fillStyle(hex('#fff8e0'), 1).fillRect(0, 0, 2, 1).fillRect(6, 0, 2, 1);
    kit.progress(800, (t) => g.setX(lerp(-10, 230, t)), () => g.destroy());
  });

  // Los dos sentados: tú (más lejos de la ventana) y tu hermano adelante, apoyado en tu hombro.
  const look = playerLook();
  const broLook = characterLook('hermano') as HumanLook;
  const people = scene.add.container(0, 0);
  stage.add(people);
  const me: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
  const myTop = SEAT_Y - 37;
  const myBody = addG(kit, people, PLAYER_X, myTop);
  drawSideBody(myBody, look, me);
  const myArm = addG(kit, people, PLAYER_X, myTop);
  drawSideArm(myArm, look, me, false);

  // El hermano va en un contenedor que gira desde la cadera para apoyarse en ti.
  const bro: SideFigureOpts = { dir: 1, scale: BRO.scale, eyes: mode === 'despierta' ? 'open' : 'closed' };
  const hipY = Math.round(37 * BRO.scale);
  const pivotX = Math.round(8 * BRO.scale);
  const broC = scene.add.container(BRO.x + pivotX, SEAT_Y);
  const broBody = scene.add.graphics({ x: -pivotX, y: -hipY });
  const broArm = scene.add.graphics({ x: -pivotX, y: -hipY });
  drawSideBody(broBody, broLook, bro);
  drawSideArm(broArm, broLook, bro, mode === 'despierta');
  const drool = scene.add.graphics();
  broC.add([broBody, drool, broArm]);
  people.add(broC);
  const fx = scene.add.container(0, 0);
  stage.add(fx);

  const car = addG(kit, stage);
  drawCarBody(car);
  // Los baches: todo salta un pixel de vez en cuando.
  kit.every(1700, () => {
    people.setY(-1);
    kit.after(90, () => people.setY(0));
  });

  if (mode !== 'despierta') {
    broC.setRotation(BRO.lean);
    // La gotita de baba: crece desde la comisura, cuelga y se recoge.
    const mouth = { x: -pivotX + Math.round(16 * BRO.scale), y: -hipY + Math.round(12 * BRO.scale) };
    let len = 0;
    kit.every(260, () => {
      len = (len + 1) % 6;
      const l = len <= 3 ? len : 6 - len;
      drool.clear();
      if (l > 0) drool.fillStyle(hex('#a8e0ff'), 1).fillRect(mouth.x, mouth.y, 1, l).fillRect(mouth.x, mouth.y + l, 1, 1);
    });
    // Zzz sobre la cabeza (que quedó cerca de tu hombro).
    kit.every(850, () => floatZ(kit, fx, BRO.x + 2, SEAT_Y - 28));
  }
  if (mode === 'dormido') {
    kit.every(700, () => floatNote(kit, fx, 200, 30 + Math.floor(Math.random() * 10)));
    return;
  }

  // El avión: una lucecita blanca que baja lenta, con la baliza roja parpadeando.
  const plane = addG(kit, sky);
  const from = mode === 'avion' ? { x: 196, y: 16 } : { x: 120, y: 30 };
  const to = mode === 'avion' ? { x: 120, y: 30 } : { x: 30, y: 46 };
  let blink = 0;
  kit.every(120, () => {
    blink++;
    plane.clear();
    plane.fillStyle(0xfff8e0, 0.25).fillRect(-2, -1, 5, 3).fillRect(-1, -2, 3, 5);
    plane.fillStyle(0xffffff, 1).fillRect(0, 0, 1, 1);
    if (blink % 2) plane.fillStyle(0xffffff, 0.7).fillRect(-3, 0, 7, 1).fillRect(0, -3, 1, 7);
    if (blink % 6 < 2) plane.fillStyle(0xf04848, 1).fillRect(3, 1, 1, 1);
  });
  kit.progress(mode === 'avion' ? 7000 : 9000, (t) => plane.setPosition(lerp(from.x, to.x, t), lerp(from.y, to.y, t)));

  if (mode === 'despierta') {
    // Despierta de un salto: "!" y saltitos en el asiento, apuntando por la ventana.
    popText(kit, fx, BRO.x + 8, SEAT_Y - 42, '¡!', '#f8e070', 10, 0);
    playSfx('select');
    kit.every(260, () => {
      broC.setY(broC.y === SEAT_Y ? SEAT_Y - 2 : SEAT_Y);
    });
  }
}

/** Viñetas del auto, para el registro de src/ui/Vineta.ts. */
export const AUTO_VINETAS: Record<string, VinetaBuilder> = {
  auto_dormido: (kit) => buildCar(kit, 'dormido'),
  auto_avion: (kit) => buildCar(kit, 'avion'),
  auto_despierta: (kit) => buildCar(kit, 'despierta'),
};
