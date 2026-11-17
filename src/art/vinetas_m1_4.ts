import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { makeText } from '../ui/theme';
import type { HumanLook } from './characters';
import { characterLook } from './SpriteRegistry';
import { drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';
import { addG, flat, floatHeart, INK, lerp, outlined, popText, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas del Prólogo y las misiones 2 a 4 (en pantalla: Prólogo, 1, 2 y 3):
 *  - m1_celular / m1_anden / m1_vagon / m1_micro      el mensaje de mamá, el tren llegando, el vagón y la micro 411
 *  - m2_cena / m2_tren                                la comida con mamá en Paine y el metro con Benja
 *  - llamada_mama                                     el celular sonando con "MAMÁ" (todas las llamadas)
 *  - m3_cena / m3_pdi / m3_avsec / m3_bandeja / m3_furgon   la última cena, migraciones, el control de seguridad,
 *                                                     la bandeja del avión y el furgón entre la caña
 *  - m4_cena_mery / m4_bus_pance / m4_bus_calle / m4_bus_vuelta   la mesa de doña Mery y el bus por Cali
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const W = 220;
const H = 108;

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

function look(who: string): HumanLook {
  return who === 'player' ? playerLook() : (characterLook(who) as HumanLook);
}

interface PersonOpts {
  dir?: 1 | -1;
  scale?: number;
  eyes?: 'open' | 'closed';
  /** Brazo estirado hacia adelante (pasar algo, sostener la bandeja). */
  reach?: boolean;
}

/**
 * Una persona de perfil con los pies en (x, footY): devuelve su contenedor (se puede mover, mecer o saltar).
 * Para sentarla, se baja hasta que la cadera quede tras el asiento y se dibuja el asiento encima.
 */
function person(kit: VinetaKit, layer: Layer, who: string, x: number, footY: number, o: PersonOpts = {}): Layer {
  const scale = o.scale ?? 1;
  const opts: SideFigureOpts = { dir: o.dir ?? 1, scale, eyes: o.eyes ?? 'open' };
  const lk = look(who);
  const c = kit.scene.add.container(Math.round(x), Math.round(footY - FIGURE_H * scale));
  const body = kit.scene.add.graphics();
  const arm = kit.scene.add.graphics();
  drawSideBody(body, lk, opts);
  drawSideArm(arm, lk, opts, o.reach === true);
  c.add([body, arm]);
  layer.add(c);
  return c;
}

/** Contenedor vacío para apilar capas en el escenario. */
function layer(kit: VinetaKit, parent: Layer): Layer {
  const c = kit.scene.add.container(0, 0);
  parent.add(c);
  return c;
}

/** Vapor que sube de un plato o una olla. */
function steam(kit: VinetaKit, parent: Layer, x: number, y: number): void {
  kit.every(520, () => {
    const g = addG(kit, parent, x + Math.floor(Math.random() * 5) - 2, y);
    g.fillStyle(0xffffff, 0.5).fillRect(0, 0, 2, 3);
    kit.progress(1300, (t) => g.setPosition(Math.round(x + Math.sin(t * 7) * 2), Math.round(y - t * 14)).setAlpha(0.55 * (1 - t)), () => g.destroy());
  });
}

/** Algo que se repite sin costura: dibuja el patrón con ancho `W + period` y lo desliza `period` px en loop. */
function scroller(kit: VinetaKit, parent: Layer, period: number, ms: number, draw: (g: G) => void, dir: 1 | -1 = -1): G {
  const g = addG(kit, parent);
  draw(g);
  if (dir === -1) kit.tween({ targets: g, x: -period, duration: ms, repeat: -1 });
  else {
    g.setX(-period);
    kit.tween({ targets: g, x: 0, duration: ms, repeat: -1 });
  }
  return g;
}

/** Baches: todo el contenedor salta un pixel cada tanto. */
function rumble(kit: VinetaKit, target: Layer, every = 1300): void {
  kit.every(every, () => {
    target.setY(target.y + 1);
    kit.after(80, () => target.setY(target.y - 1));
  });
}

// ---------------------------------------------------------------------------
// Prólogo: el mensaje de mamá
// ---------------------------------------------------------------------------

function buildCelular(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w) => {
    // Atardecer sobre Plaza Baquedano: cielo en franjas, edificios y el verde de la plaza.
    const bands = ['#f7c88a', '#f2b27c', '#e89a74', '#cf8478'];
    bands.forEach((c, i) => flat(g, [[x, y + i * 18, w, 19, c]]));
    flat(g, [
      [x + 8, y + 40, 26, 50, '#6a5a78'], [x + 14, y + 28, 14, 14, '#5a4a6a'], [x + 36, y + 52, 20, 40, '#7a6a86'],
      [x + 164, y + 36, 22, 54, '#6a5a78'], [x + 188, y + 48, 24, 44, '#7a6a86'], [x + 172, y + 30, 8, 8, '#5a4a6a'],
      [x, y + 88, w, 20, '#4a7a48'], [x, y + 88, w, 2, '#5a9a58'],
    ]);
    for (const [wx, wy] of [[12, 46], [20, 54], [40, 60], [168, 44], [176, 54], [194, 56], [200, 66]]) flat(g, [[x + wx, y + wy, 2, 3, '#ffe9a8']]);
  });
  const phone = layer(kit, stage);
  const g = addG(kit, phone);
  const px = 78;
  const py = 4;
  outlined(g, [[px, py, 64, 100, '#2a2a38']]);
  flat(g, [[px + 4, py + 8, 56, 84, '#eef3f8'], [px + 4, py + 8, 56, 12, '#3cb4a0'], [px + 26, py + 3, 12, 2, '#14141c']]);
  phone.add(makeText(kit.scene, px + 8, py + 10, 'Mamá', { fontSize: '8px', fontStyle: '600', color: '#ffffff' }));
  const bubble = addG(kit, phone, px + 8, py + 26);
  outlined(bubble, [[0, 0, 46, 30, '#ffffff']]);
  const msg = makeText(kit.scene, px + 11, py + 28, '¿Ya llegaste, mi amor? Avísame', { fontSize: '6px', color: INK, lineSpacing: 1, wordWrap: { width: 42 } });
  phone.add([msg]);
  bubble.setAlpha(0);
  msg.setAlpha(0);
  // Los puntitos de "escribiendo..." y después el mensaje.
  const dots = addG(kit, phone, px + 12, py + 36);
  let n = 0;
  kit.every(200, () => {
    n++;
    dots.clear();
    for (let i = 0; i < 3; i++) flat(dots, [[i * 5, i === n % 3 ? -1 : 0, 3, 3, '#8a8498']]);
  });
  kit.after(1100, () => {
    dots.destroy();
    bubble.setAlpha(1);
    msg.setAlpha(1);
    playSfx('select');
  });
  popText(kit, stage, 36, 24, '¡Bzzzt!', '#fff2a0', 11, 0);
  // Vibra: el celu tiembla y las rayitas lo acompañan.
  const lines = addG(kit, stage);
  let on = false;
  kit.every(90, () => {
    on = !on;
    phone.setX(on ? 1 : -1);
    lines.clear().fillStyle(hex(INK), 1);
    if (on) for (const dy of [-10, 0, 10]) lines.fillRect(px - 8, 52 + dy, 4, 1).fillRect(px + 68, 52 + dy, 4, 1);
  });
}

// ---------------------------------------------------------------------------
// Prólogo: el metro
// ---------------------------------------------------------------------------

function buildAnden(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w) => {
    flat(g, [
      [x, y, w, 12, '#2a2a34'], [x, y + 12, w, 58, '#3a3a48'], [x, y + 70, w, 38, '#b8b4a8'],
      [x, y + 70, w, 2, '#8a8678'], [x, y + 88, w, 2, '#f0c030'], [x, y + 90, w, 1, '#a88820'],
    ]);
    // Letrero de la estación y los pilares.
    flat(g, [[x + 70, y + 4, 80, 10, '#c82838'], [x + 74, y + 6, 72, 6, '#f8f8f8']]);
    for (const px of [10, 112, 205]) flat(g, [[x + px, y + 12, 5, 58, '#6a6a78'], [x + px, y + 12, 1, 58, '#8a8a98']]);
  });
  stage.add(makeText(kit.scene, 110, 5, 'BAQUEDANO', { fontFamily: 'Silkscreen, monospace', fontSize: '6px', color: '#c82838' }).setOrigin(0.5, 0));
  // El tren llega por la derecha y frena justo frente a ti.
  const train = layer(kit, stage);
  const tg = addG(kit, train);
  const body = '#d8d8e0';
  outlined(tg, [[0, 22, 330, 46, body]]);
  flat(tg, [[0, 50, 330, 6, '#c82838'], [0, 22, 330, 2, '#f0f0f8'], [0, 64, 330, 4, '#58586a']]);
  for (let i = 0; i < 6; i++) flat(tg, [[10 + i * 54, 28, 34, 18, '#58708a'], [10 + i * 54, 28, 34, 3, '#7a92ac']]);
  // Faros delanteros.
  flat(tg, [[2, 56, 4, 4, '#fff6c0'], [2, 30, 3, 3, '#fff6c0']]);
  const doors = addG(kit, train);
  const drawDoors = (open: number): void => {
    doors.clear();
    for (const dx of [96, 204]) {
      flat(doors, [[dx, 26, 32, 40, '#1a1a24']]);
      flat(doors, [[dx, 26, 16 - open, 40, '#a8aab8'], [dx + 16 + open, 26, 16 - open, 40, '#a8aab8']]);
      flat(doors, [[dx, 30, 16 - open, 14, '#58708a'], [dx + 16 + open, 30, 16 - open, 14, '#58708a']]);
    }
  };
  drawDoors(0);
  train.setX(W + 20);
  // Luces del túnel que pasan rápido mientras frena.
  const me = person(kit, stage, 'player', 40, 102, { dir: 1 });
  rumble(kit, me, 1700);
  kit.progress(
    2200,
    (t) => train.setX(lerp(W + 20, -72, t)),
    () => {
      playSfx('bus-brake');
      popText(kit, stage, 118, 20, '¡piii, piii!', '#fff2a0', 9, 1400);
      kit.progress(500, (t) => drawDoors(Math.round(t * 12)));
    },
    'Cubic.Out',
  );
  playSfx('bus-pass');
}

/** Pasajeros parados o sentados en el vagón, con el túnel pasando por las ventanas. */
function buildVagon(kit: VinetaKit, seated: string[], playerSits: boolean): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [
      [x, y, w, h, '#dcdcd4'], [x, y, w, 12, '#c4c4bc'], [x, y + 12, w, 2, '#a8a8a0'],
      [x, y + 92, w, 16, '#7a7a82'], [x, y + 92, w, 2, '#5a5a62'],
    ]);
    // Ventanas.
    for (const wx of [8, 82, 156]) flat(g, [[x + wx - 1, y + 17, 58, 38, INK], [x + wx, y + 18, 56, 36, '#10121c']]);
  });
  const tunnel = layer(kit, stage);
  // Las luces del túnel corren por las ventanas (patrón de 74 px = una ventana + su pilar).
  scroller(kit, tunnel, 74, 520, (g) => {
    for (let i = 0; i < 5; i++) {
      flat(g, [[8 + i * 74 + 6, 30, 14, 2, '#f8e8a0'], [8 + i * 74 + 36, 40, 10, 2, '#a8c8f0'], [8 + i * 74 + 22, 24, 5, 1, '#f8e8a0']]);
    }
  });
  // Lo que queda fuera de las ventanas se tapa con el marco (las luces solo se ven dentro).
  const frame = addG(kit, stage);
  for (const [fx, fw] of [[0, 8], [64, 18], [138, 18], [212, 8]]) flat(frame, [[fx, 14, fw, 44, '#dcdcd4']]);
  flat(frame, [[0, 12, W, 2, '#a8a8a0']]);
  // Barra del techo y manijas que se mecen.
  flat(frame, [[0, 12, W, 3, '#b0b0b8'], [0, 12, W, 1, '#e8e8f0']]);
  const straps: G[] = [];
  for (const sx of [30, 100, 170]) {
    const s = addG(kit, stage, sx, 15);
    flat(s, [[0, 0, 1, 14, '#a88830'], [-2, 14, 5, 5, '#e0c050']]);
    straps.push(s);
  }
  kit.every(60, () => straps.forEach((s, i) => s.setX(Math.round([30, 100, 170][i] + Math.sin(Date.now() / 260 + i) * 1.5))));
  // Asiento corrido y pasajeros sentados.
  const crowd = layer(kit, stage);
  // Si vas sentado, te sientas al lado del último pasajero (el banco tapa las piernas de todos).
  const riders = playerSits ? [...seated, 'player'] : seated;
  riders.forEach((who, i) => person(kit, crowd, who, 30 + i * 36, 90, { dir: playerSits || i % 2 === 0 ? 1 : -1, scale: 0.95 }));
  const bench = addG(kit, stage);
  outlined(bench, [[0, 64, W, 28, '#c85a3a']]);
  flat(bench, [[0, 64, W, 3, '#e07a58'], [0, 80, W, 2, '#a04228']]);
  for (const bx of [55, 110, 165]) flat(bench, [[bx, 66, 1, 24, '#a04228']]);
  // Tú: parado agarrado de una manija (o sentado si va a estudiar).
  const players = layer(kit, stage);
  if (playerSits) return;
  // De pie, agarrado de la manija: el vagón lo balancea.
  const me = person(kit, players, 'player', 138, 104, { dir: 1, reach: true });
  kit.every(60, () => me.setRotation(Math.sin(Date.now() / 320) * 0.04));
}

// ---------------------------------------------------------------------------
// Prólogo: la micro
// ---------------------------------------------------------------------------

function buildMicro(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [
      [x, y, w, h, '#9cc8e8'], [x, y + 20, w, 30, '#b8d8f0'],
      [x + 150, y + 26, 60, 48, '#98a0a8'], [x + 160, y + 34, 10, 10, '#c8d4dc'], [x + 176, y + 34, 10, 10, '#c8d4dc'], [x + 192, y + 34, 10, 10, '#c8d4dc'],
      [x, y + 74, w, 34, '#7a7a82'], [x, y + 74, w, 5, '#b8b4a8'], [x, y + 96, w, 12, '#5a5a62'],
    ]);
    // Paradero: poste y cartelito.
    flat(g, [[x + 172, y + 40, 3, 40, '#4a4a56'], [x + 164, y + 36, 20, 12, '#2f6fd0'], [x + 166, y + 38, 16, 8, '#f8f8f8']]);
  });
  stage.add(makeText(kit.scene, 174, 38, '411', { fontSize: '7px', fontStyle: '600', color: '#2f6fd0' }).setOrigin(0.5, 0));
  const bus = layer(kit, stage);
  const bg = addG(kit, bus);
  outlined(bg, [[0, 28, 124, 46, '#f4f4f0'], [0, 60, 124, 14, '#3a9a58']]);
  flat(bg, [[0, 28, 124, 3, '#3a9a58'], [0, 56, 124, 2, '#2a7a40'], [108, 32, 14, 24, '#58708a']]);
  for (let i = 0; i < 4; i++) flat(bg, [[8 + i * 22, 34, 18, 18, '#58708a'], [8 + i * 22, 34, 18, 3, '#7a92ac']]);
  const door = addG(kit, bus);
  const drawDoor = (open: number): void => {
    door.clear();
    flat(door, [[92, 34, 14, 36, '#1a1a24'], [92, 34, 7 - open, 36, '#a8aab8'], [99 + open, 34, 7 - open, 36, '#a8aab8']]);
  };
  drawDoor(0);
  for (const wx of [18, 98]) {
    const w = addG(kit, bus, wx, 74);
    outlined(w, [[-7, -7, 14, 14, '#2a2a34']]);
    flat(w, [[-3, -3, 6, 6, '#9a9aa8']]);
  }
  bus.add(makeText(kit.scene, 106, 30, '411', { fontFamily: 'Silkscreen, monospace', fontSize: '5px', color: '#f0d048', backgroundColor: '#181820' }).setOrigin(1, 0));
  // El chofer mira por la ventana de adelante.
  person(kit, bus, 'chofer', 108, 58, { dir: 1, scale: 0.5 });
  bus.setX(-150);
  const me = person(kit, stage, 'player', 150, 102, { dir: -1 });
  rumble(kit, me, 1900);
  playSfx('bus-pass');
  kit.progress(
    1700,
    (t) => bus.setX(lerp(-150, 30, t)),
    () => {
      playSfx('bus-brake');
      popText(kit, stage, 70, 18, '¡FSSSH!', '#ffffff', 10, 1100);
      kit.after(500, () => {
        playSfx('bus-doors-open');
        kit.progress(400, (t) => drawDoor(Math.round(t * 6)));
      });
    },
    'Cubic.Out',
  );
}

// ---------------------------------------------------------------------------
// Mesas (la comida en Paine, la última cena y la casa de doña Mery)
// ---------------------------------------------------------------------------

interface Diner {
  who: string;
  x: number;
  dir: 1 | -1;
  scale?: number;
  eyes?: 'open' | 'closed';
}

interface DinnerDef {
  wall: string;
  wallD: string;
  floor: string;
  lamp: string;
  cloth: string;
  clothD: string;
  diners: Diner[];
  /** Qué hay en la mesa. */
  food: 'sopa' | 'parrilla' | 'almuerzo';
  /** Ventana con plantas, ventilador de techo y luciérnagas de Pance. */
  tropical?: boolean;
  candle?: boolean;
}

const TABLE = { x: 54, w: 112, y: 62 };

function buildDinner(kit: VinetaKit, def: DinnerDef): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [[x, y, w, h, def.wall], [x, y + 74, w, 34, def.floor], [x, y + 72, w, 3, def.wallD]]);
    if (def.tropical) {
      // Ventana abierta con matas y los Farallones al fondo.
      flat(g, [[x + 10, y + 12, 44, 38, INK], [x + 12, y + 14, 40, 34, '#9cc8e8'], [x + 12, y + 34, 40, 14, '#4a8a58'], [x + 12, y + 26, 18, 10, '#6a9a8a'], [x + 30, y + 22, 22, 14, '#5a8a7a']]);
      flat(g, [[x + 32, y + 14, 1, 34, INK], [x + 12, y + 30, 40, 1, INK]]);
      flat(g, [[x + 176, y + 30, 16, 40, '#3a8a48'], [x + 184, y + 24, 14, 46, '#4aa058'], [x + 172, y + 62, 28, 12, '#a86a40']]);
    } else {
      flat(g, [[x + 14, y + 14, 36, 28, '#1a2236'], [x + 16, y + 16, 32, 24, '#2a3a5a'], [x + 31, y + 16, 2, 24, '#1a2236'], [x + 18, y + 22, 1, 1, '#f8f0c0'], [x + 40, y + 20, 1, 1, '#f8f0c0']]);
      flat(g, [[x + 180, y + 18, 24, 30, '#c8a070'], [x + 182, y + 20, 20, 26, '#e8d0a0']]);
    }
  });
  // Lámpara colgante que se mece apenas.
  const lamp = addG(kit, stage, TABLE.x + TABLE.w / 2, 0);
  flat(lamp, [[0, 0, 1, 20, INK], [-8, 20, 17, 6, def.lamp], [-8, 20, 17, 1, '#fff8d8']]);
  const glow = addG(kit, stage, TABLE.x + TABLE.w / 2, 26);
  glow.fillStyle(hex('#fff2b0'), 0.07).fillRect(-26, 0, 53, 34).fillRect(-14, 34, 29, 10);
  kit.every(80, () => lamp.setX(Math.round(TABLE.x + TABLE.w / 2 + Math.sin(Date.now() / 700) * 1)));
  if (def.tropical) {
    // Ventilador de techo girando.
    const fan = addG(kit, stage, 190, 6);
    let a = false;
    kit.every(110, () => {
      a = !a;
      fan.clear();
      flat(fan, [[-1, 0, 2, 6, INK]]);
      flat(fan, a ? [[-14, 6, 28, 2, '#8a6a48']] : [[-10, 5, 8, 2, '#8a6a48'], [3, 7, 8, 2, '#8a6a48']]);
    });
  }
  // Los comensales van detrás de la mesa; la mesa los tapa de la cintura para abajo.
  const people = layer(kit, stage);
  const list: Layer[] = [];
  const chairs = addG(kit, people);
  for (const d of def.diners) {
    const sc = d.scale ?? 1;
    const foot = TABLE.y + 22 * sc + 12;
    // Silla: el respaldo queda detrás de la espalda y el asiento bajo la cadera.
    const back = d.dir === 1 ? d.x - 2 : d.x + Math.round(19 * sc);
    outlined(chairs, [[back, foot - Math.round(46 * sc), 3, Math.round(44 * sc), '#7a5434'], [Math.min(back, d.x + 1), foot - Math.round(19 * sc), Math.round(19 * sc) + 3, 3, '#8a6240']]);
    const c = person(kit, people, d.who, d.x, foot, { dir: d.dir, scale: sc, eyes: d.eyes ?? 'open' });
    list.push(c);
  }
  const table = addG(kit, stage);
  outlined(table, [[TABLE.x, TABLE.y, TABLE.w, 6, def.cloth]]);
  flat(table, [[TABLE.x, TABLE.y + 6, TABLE.w, 36, def.cloth], [TABLE.x, TABLE.y + 6, TABLE.w, 2, def.clothD]]);
  for (let i = 0; i < TABLE.w; i += 10) flat(table, [[TABLE.x + i, TABLE.y + 8, 5, 34, def.clothD]]);
  const items = addG(kit, stage);
  const mid = TABLE.x + TABLE.w / 2;
  if (def.food === 'parrilla') {
    outlined(items, [[mid - 16, TABLE.y - 3, 32, 4, '#3a3a44']]);
    flat(items, [[mid - 14, TABLE.y - 7, 8, 4, '#a85a38'], [mid - 4, TABLE.y - 8, 9, 5, '#c8703c'], [mid + 6, TABLE.y - 7, 8, 4, '#b8402e'], [mid - 8, TABLE.y - 10, 5, 3, '#e8c060']]);
    steam(kit, stage, mid, TABLE.y - 10);
    steam(kit, stage, mid - 8, TABLE.y - 10);
  } else {
    for (const [dx, c] of [[-30, '#f4f4ec'], [30, '#f4f4ec']] as const) {
      outlined(items, [[mid + dx - 8, TABLE.y - 2, 16, 3, c]]);
      flat(items, [[mid + dx - 5, TABLE.y - 4, 10, 2, def.food === 'sopa' ? '#e8a838' : '#c87040']]);
      steam(kit, stage, mid + dx, TABLE.y - 5);
    }
    outlined(items, [[mid - 5, TABLE.y - 8, 10, 9, '#d8e8f0']]);
    flat(items, [[mid - 4, TABLE.y - 6, 8, 5, '#8ac0e0']]);
  }
  if (def.candle) {
    flat(items, [[mid - 1, TABLE.y - 10, 3, 8, '#f8f0d8'], [mid, TABLE.y - 13, 1, 3, '#f0a030']]);
    kit.every(240, () => {
      const g = addG(kit, stage, mid, TABLE.y - 14);
      g.fillStyle(hex('#ffd060'), 0.8).fillRect(0, 0, 1, 2);
      kit.after(200, () => g.destroy());
    });
  }
  // Las cabezas asienten mientras conversan.
  list.forEach((c, i) => {
    const y0 = c.y;
    kit.every(1600 + i * 330, () => {
      c.setY(y0 + 1);
      kit.after(180, () => c.setY(y0));
    });
  });
  kit.every(2400, () => floatHeart(kit, stage, mid, TABLE.y - 26));
}

const DINNERS: Record<string, DinnerDef> = {
  m2_cena: {
    wall: '#e8d8b8', wallD: '#b8a078', floor: '#9a7a58', lamp: '#f0c860', cloth: '#d86848', clothD: '#b84e30', food: 'sopa',
    diners: [{ who: 'mama', x: 34, dir: 1 }, { who: 'player', x: 158, dir: -1 }],
  },
  m3_cena: {
    wall: '#4a3238', wallD: '#2e1e24', floor: '#3a2a2a', lamp: '#f0a040', cloth: '#f4f0e4', clothD: '#d8d0c0', food: 'parrilla', candle: true,
    diners: [
      { who: 'papa', x: 6, dir: 1, scale: 1.04 },
      { who: 'mama', x: 32, dir: 1, scale: 0.95 },
      { who: 'hermano', x: 138, dir: -1, scale: 0.72 },
      { who: 'player', x: 160, dir: -1 },
    ],
  },
  m4_cena_mery: {
    wall: '#f0d890', wallD: '#c8a850', floor: '#a86a48', lamp: '#f8d870', cloth: '#58b0a0', clothD: '#3a8a7c', food: 'almuerzo', tropical: true,
    diners: [{ who: 'anfitriona', x: 34, dir: 1 }, { who: 'player', x: 158, dir: -1 }],
  },
};

// ---------------------------------------------------------------------------
// La llamada de mamá
// ---------------------------------------------------------------------------

function buildLlamada(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [[x, y, w, h, '#1c2236'], [x, y + 70, w, 38, '#252c44']]);
    for (let i = 0; i < 14; i++) flat(g, [[x + ((i * 47) % w), y + ((i * 29) % 60), 1, 1, '#c8d4f0']]);
  });
  const phone = layer(kit, stage);
  const g = addG(kit, phone);
  const px = 78;
  outlined(g, [[px, 4, 64, 100, '#14141c']]);
  flat(g, [[px + 4, 10, 56, 88, '#2a3a5a'], [px + 26, 6, 12, 2, '#0a0a10']]);
  // Foto de contacto.
  const av = addG(kit, phone, px + 32, 34);
  av.fillStyle(hex('#e8b890'), 1).fillCircle(0, 0, 13);
  av.fillStyle(hex('#3a2420'), 1).fillRect(-13, -12, 26, 9).fillRect(-14, -6, 4, 18).fillRect(10, -6, 4, 18);
  av.fillStyle(hex('#e8b890'), 1).fillRect(-9, -4, 18, 14);
  av.fillStyle(hex('#202028'), 1).fillRect(-5, 0, 2, 2).fillRect(3, 0, 2, 2);
  av.fillStyle(hex('#8a3a3a'), 1).fillRect(-3, 6, 6, 1);
  phone.add(makeText(kit.scene, px + 32, 52, 'MAMÁ', { fontSize: '9px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));
  const status = makeText(kit.scene, px + 32, 65, 'llamando...', { fontSize: '7px', color: '#9fd4ff' }).setOrigin(0.5, 0);
  phone.add(status);
  // Botones.
  const bt = addG(kit, phone);
  bt.fillStyle(hex('#d84848'), 1).fillCircle(px + 18, 84, 7);
  bt.fillStyle(hex('#48c868'), 1).fillCircle(px + 46, 84, 7);
  flat(bt, [[px + 15, 83, 7, 2, '#ffffff'], [px + 44, 81, 4, 6, '#ffffff']]);
  // Ondas de timbre y vibración.
  const waves = addG(kit, stage);
  let k = 0;
  let ringing = true;
  kit.every(260, () => {
    k++;
    phone.setX(ringing && k % 2 ? 1 : 0);
    waves.clear();
    if (!ringing) return;
    waves.lineStyle(1, hex('#9fd4ff'), 1 - (k % 4) * 0.25);
    waves.strokeCircle(px + 32, 34, 18 + (k % 4) * 7);
  });
  kit.after(1500, () => {
    ringing = false;
    waves.clear();
    playSfx('select');
    let secs = 0;
    status.setColor('#7ee8a0');
    const tick = (): void => {
      status.setText(`en llamada · 0:${String(secs).padStart(2, '0')}`);
    };
    tick();
    kit.every(1000, () => {
      secs++;
      tick();
    });
  });
}

// ---------------------------------------------------------------------------
// Última noche en Santiago: migraciones y seguridad
// ---------------------------------------------------------------------------

function buildPdi(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [[x, y, w, h, '#8a98b0'], [x, y + 78, w, 30, '#c8c8c4'], [x, y + 76, w, 2, '#6a7488']]);
    // Cabina de vidrio con la bandera de Chile y el letrero.
    flat(g, [[x + 100, y + 10, 110, 60, '#a8bcd0'], [x + 100, y + 10, 110, 3, '#58708a'], [x + 100, y + 10, 3, 60, '#58708a'], [x + 207, y + 10, 3, 60, '#58708a']]);
    flat(g, [[x + 112, y + 16, 22, 14, '#ffffff'], [x + 112, y + 23, 22, 7, '#d83838'], [x + 112, y + 16, 9, 7, '#2f4a9c']]);
    flat(g, [[x + 10, y + 8, 70, 12, '#2a3450'], [x + 12, y + 10, 66, 8, '#f0c030']]);
  });
  stage.add(makeText(kit.scene, 45, 10, 'MIGRACIÓN · PDI', { fontFamily: 'Silkscreen, monospace', fontSize: '5px', color: '#2a3450' }).setOrigin(0.5, 0));
  const pdi = person(kit, stage, 'pdi', 150, 84, { dir: -1 });
  rumble(kit, pdi, 2300);
  person(kit, stage, 'player', 34, 102, { dir: 1 });
  const counter = addG(kit, stage);
  outlined(counter, [[88, 66, 122, 8, '#7a5a3c']]);
  flat(counter, [[88, 74, 122, 34, '#5a4228'], [88, 66, 122, 2, '#9a7a58']]);
  // El carnet viaja por el mesón y el timbre cae con su marca roja.
  const carnet = addG(kit, stage, 70, 58);
  outlined(carnet, [[0, 0, 22, 14, '#e8f0f8']]);
  flat(carnet, [[2, 2, 7, 8, '#c8a888'], [11, 3, 9, 2, '#6a8aa8'], [11, 7, 9, 2, '#6a8aa8']]);
  kit.progress(900, (t) => carnet.setPosition(lerp(70, 118, t), lerp(58, 59, t)), () => {
    kit.after(500, () => {
      playSfx('select');
      popText(kit, stage, 128, 44, '¡TUC!', '#f8e070', 11, 900);
      const mark = addG(kit, stage, 126, 61);
      mark.fillStyle(hex('#d83838'), 0.8).fillRect(0, 0, 14, 8);
    });
  });
}

function buildAvsec(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [[x, y, w, h, '#b4bcc8'], [x, y + 80, w, 28, '#7a8290'], [x, y + 78, w, 2, '#5a6270']]);
    // Monitor del rayos X con la imagen de adentro.
    flat(g, [[x + 138, y + 12, 52, 36, '#2a2a34'], [x + 140, y + 14, 48, 30, '#0c2a3a'], [x + 156, y + 48, 16, 6, '#3a3a48']]);
  });
  const screen = addG(kit, stage, 140, 14);
  const drawXray = (n: number): void => {
    screen.clear();
    flat(screen, [[8, 14 + (n % 2), 14, 10, '#58c8e8'], [10, 10, 10, 4, '#3898c8'], [26, 8, 8, 16, '#e8c850'], [36, 16, 8, 8, '#e87858']]);
    flat(screen, [[0, (n * 3) % 30, 48, 1, '#58c8e8']]);
  };
  drawXray(0);
  let n = 0;
  kit.every(260, () => drawXray(++n));
  // Cinta y túnel del escáner.
  const belt = addG(kit, stage);
  outlined(belt, [[0, 70, 150, 8, '#3a3a44']]);
  flat(belt, [[0, 72, 150, 2, '#58586a']]);
  for (let i = 0; i < 150; i += 8) flat(belt, [[i, 76, 3, 2, '#2a2a34']]);
  // La bandeja con tu mochila: entra al túnel cada rato.
  const tray = layer(kit, stage);
  const tg = addG(kit, tray);
  outlined(tg, [[0, 62, 26, 8, '#8a98a8']]);
  outlined(tg, [[4, 48, 18, 15, look('player').accent ?? '#c87830']]);
  flat(tg, [[8, 52, 10, 3, '#a05820'], [10, 46, 6, 3, '#6a3a18']]);
  const run = (): void => {
    tray.setX(-30);
    kit.progress(2600, (t) => tray.setX(lerp(-30, 126, t)), () => {
      tray.setX(-200);
      kit.after(500, run);
    });
  };
  run();
  const tunnel = addG(kit, stage);
  outlined(tunnel, [[110, 38, 38, 38, '#4a5260']]);
  flat(tunnel, [[114, 44, 30, 30, '#14181e'], [114, 44, 4, 30, '#2a3038'], [138, 44, 4, 30, '#2a3038']]);
  const me = person(kit, stage, 'player', 14, 104, { dir: 1, scale: 1 });
  rumble(kit, me, 2100);
  const guard = person(kit, stage, 'avsec', 176, 100, { dir: -1 });
  rumble(kit, guard, 1900);
  kit.every(1400, () => {
    popText(kit, stage, 158, 6, '¡bip!', '#a8f0ff', 8, 500);
  });
}

// ---------------------------------------------------------------------------
// El avión y el furgón
// ---------------------------------------------------------------------------

function buildBandeja(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    flat(g, [[x, y, w, h, '#2a3450'], [x, y + 86, w, 22, '#1e2640']]);
    // Ventanilla ovalada con estrellas y la luz del ala.
    flat(g, [[x + 150, y + 12, 44, 52, '#c8ccd8'], [x + 154, y + 16, 36, 44, '#0c1226'], [x + 150, y + 12, 44, 3, '#e8ecf4']]);
    for (let i = 0; i < 8; i++) flat(g, [[x + 156 + ((i * 11) % 30), y + 20 + ((i * 7) % 34), 1, 1, '#f0f4ff']]);
    flat(g, [[x + 154, y + 52, 36, 8, '#4a5266']]);
    // Luz de lectura encima.
    flat(g, [[x + 20, y + 4, 50, 3, '#6a728a']]);
  });
  const wing = addG(kit, stage, 172, 56);
  let b = 0;
  kit.every(450, () => {
    b++;
    wing.clear();
    if (b % 4 < 2) wing.fillStyle(hex('#ff4848'), 1).fillRect(0, 0, 2, 2).fillStyle(hex('#ff4848'), 0.3).fillRect(-2, -2, 6, 6);
  });
  const aux = person(kit, stage, 'auxiliar', 22, 100, { dir: 1, reach: true });
  rumble(kit, aux, 1700);
  // La bandeja en la punta del brazo: vapor del pollo.
  const tr = addG(kit, stage);
  outlined(tr, [[52, 66, 40, 6, '#c8ccd8']]);
  flat(tr, [[56, 62, 14, 5, '#f4f4ec'], [58, 60, 10, 3, '#c87040'], [72, 62, 16, 5, '#e8d890'], [74, 60, 12, 3, '#e8b050']]);
  steam(kit, stage, 63, 58);
  steam(kit, stage, 80, 58);
  const me = person(kit, stage, 'player', 104, 106, { dir: -1 });
  rumble(kit, me, 2000);
  const seat = addG(kit, stage);
  outlined(seat, [[92, 76, 66, 32, '#2f4a8c']]);
  flat(seat, [[92, 76, 66, 3, '#5a78c0'], [92, 100, 66, 2, '#1e3260']]);
}

function buildFurgon(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w) => {
    // Amanecer en el Valle: cielo con sol bajo y el cerro de fondo.
    flat(g, [[x, y, w, 30, '#f8c88a'], [x, y + 30, w, 20, '#f4dca0'], [x, y + 50, w, 58, '#7ab050']]);
    g.fillStyle(hex('#ffe9a8'), 1).fillCircle(x + 160, y + 44, 14);
    flat(g, [[x, y + 40, w, 14, '#8a9ab0'], [x + 20, y + 34, 50, 10, '#8a9ab0'], [x + 110, y + 36, 60, 8, '#98a8bc']]);
  });
  // Dos capas de caña que corren a distinta velocidad.
  const far = layer(kit, stage);
  scroller(kit, far, 36, 1100, (g) => {
    for (let i = 0; i < 9; i++) flat(g, [[i * 36, 52, 26, 18, '#5a9a40'], [i * 36 + 4, 46, 2, 8, '#c8d88a'], [i * 36 + 14, 44, 2, 10, '#c8d88a']]);
  });
  flat(addG(kit, stage), [[0, 70, W, 38, '#4a4a52'], [0, 70, W, 3, '#8a8a92']]);
  const near = layer(kit, stage);
  scroller(kit, near, 24, 420, (g) => {
    for (let i = 0; i < 12; i++) flat(g, [[i * 24, 100, 4, 8, '#e8e8d8']]);
  });
  const caña = layer(kit, stage);
  scroller(kit, caña, 28, 520, (g) => {
    for (let i = 0; i < 9; i++) flat(g, [[i * 28, 56, 16, 20, '#3a8a3a'], [i * 28 + 4, 48, 2, 10, '#d8e8a0'], [i * 28 + 10, 46, 2, 12, '#d8e8a0']]);
  });
  const van = layer(kit, stage);
  const vg = addG(kit, van);
  outlined(vg, [[60, 52, 100, 34, '#f0f0ec']]);
  for (const [wx, wy, ww] of [[62, 56, 22], [88, 56, 22], [114, 56, 22], [142, 56, 14]]) flat(vg, [[wx, wy, ww, 14, '#58708a']]);
  // Adentro: el chofer y tú (de la cintura para abajo los tapa la puerta).
  person(kit, van, 'chofer_furgon', 144, 86, { dir: 1, scale: 0.5 });
  person(kit, van, 'player', 94, 86, { dir: 1, scale: 0.5 });
  const door = addG(kit, van);
  flat(door, [[61, 70, 98, 15, '#f0f0ec'], [61, 70, 98, 6, '#2f6fd0'], [61, 70, 98, 1, '#c8d4e8'], [150, 78, 8, 3, '#f0c030']]);
  door.fillStyle(hex('#9cc8e8'), 0.3).fillRect(62, 56, 94, 14);
  for (const wx of [80, 144]) {
    const w = addG(kit, van, wx, 86);
    outlined(w, [[-6, -6, 12, 12, '#2a2a34']]);
    flat(w, [[-2, -2, 4, 4, '#9a9aa8']]);
  }
  rumble(kit, van, 600);
}

// ---------------------------------------------------------------------------
// El bus por Cali (desde la ventana)
// ---------------------------------------------------------------------------

type BusScene = 'pance' | 'calle' | 'vuelta';

function buildBusCali(kit: VinetaKit, mode: BusScene): void {
  const sky = mode === 'vuelta' ? ['#2a2a5a', '#6a4a7a', '#d8805a'] : mode === 'calle' ? ['#9cc8f0', '#b8d8f4', '#d8ecf8'] : ['#8ac0f0', '#b0d8f4', '#d4ecf8'];
  const stage = kit.framed((g, x, y, w) => {
    flat(g, [[x, y, w, 24, sky[0]], [x, y + 24, w, 18, sky[1]], [x, y + 42, w, 18, sky[2]]]);
    if (mode === 'vuelta') {
      g.fillStyle(hex('#f8d890'), 1).fillCircle(x + 170, y + 56, 12);
      for (let i = 0; i < 12; i++) flat(g, [[x + ((i * 41) % w), y + ((i * 13) % 20), 1, 1, '#f8f0ff']]);
    }
  });
  const far = layer(kit, stage);
  const mid = layer(kit, stage);
  const near = layer(kit, stage);
  if (mode === 'pance') {
    // Los Farallones al fondo, matas al lado y el río Pance brillando.
    scroller(kit, far, 110, 5200, (g) => {
      for (let i = 0; i < 4; i++) {
        flat(g, [[i * 110, 36, 110, 24, '#5a8a98'], [i * 110 + 20, 28, 60, 10, '#6a9aa8'], [i * 110 + 40, 22, 26, 8, '#7aaab8']]);
      }
    });
    scroller(kit, mid, 44, 1500, (g) => {
      for (let i = 0; i < 7; i++) flat(g, [[i * 44, 44, 26, 18, '#3a8a48'], [i * 44 + 6, 38, 14, 8, '#4aa058'], [i * 44 + 12, 62, 3, 6, '#6a4a30']]);
    });
  } else {
    // Cali: casitas de colores y palmeras (de noche, con luces y lluvia fina).
    const palette = mode === 'vuelta' ? ['#4a3a5a', '#5a4a6a', '#3a3050'] : ['#f0a868', '#e86858', '#58b0c8', '#f0d868'];
    scroller(kit, far, 90, 3600, (g) => {
      for (let i = 0; i < 5; i++) flat(g, [[i * 90, 30 + (i % 2) * 6, 38, 34, palette[i % palette.length]], [i * 90 + 40, 38, 30, 26, palette[(i + 2) % palette.length]]]);
    });
    scroller(kit, mid, 60, 1500, (g) => {
      for (let i = 0; i < 6; i++) {
        flat(g, [[i * 60, 46, 36, 20, palette[(i + 1) % palette.length]], [i * 60 + 6, 52, 8, 8, mode === 'vuelta' ? '#ffe9a8' : '#9cc8e8'], [i * 60 + 20, 52, 8, 8, mode === 'vuelta' ? '#ffe9a8' : '#9cc8e8']]);
        flat(g, [[i * 60 + 44, 36, 2, 30, '#6a4a30'], [i * 60 + 38, 32, 14, 4, '#3a8a48'], [i * 60 + 40, 28, 10, 4, '#4aa058']]);
      }
    });
  }
  scroller(kit, near, 30, 520, (g) => {
    for (let i = 0; i < 9; i++) flat(g, [[i * 30, 76, 14, 2, '#e8e8d8']]);
  });
  flat(addG(kit, stage), [[0, 64, W, 44, '#5a5a62'], [0, 64, W, 3, '#9a9aa2']]);
  if (mode === 'vuelta') {
    const rain = addG(kit, stage);
    kit.every(70, () => {
      rain.clear().fillStyle(hex('#cfe0ff'), 0.5);
      for (let i = 0; i < 22; i++) rain.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * 80), 1, 4);
    });
  }
  // Interior del bus: marco de la ventana, el respaldo de adelante y tú mirando por el vidrio.
  const me = person(kit, stage, 'player', 24, 118, { dir: 1, eyes: 'open' });
  rumble(kit, me, 1500);
  const frame = addG(kit, stage);
  const col = '#6a6a78';
  flat(frame, [[0, 0, W, 8, col], [0, 80, W, 28, col], [0, 0, 10, H, col], [W - 10, 0, 10, H, col], [0, 8, W, 1, '#8a8a98']]);
  flat(frame, [[0, 80, W, 3, '#3a3a46'], [100, 8, 4, 72, col]]);
  outlined(frame, [[20, 84, 70, 24, '#2f4a8c']]);
  flat(frame, [[20, 84, 70, 3, '#5a78c0']]);
  // Reflejos del vidrio.
  frame.fillStyle(0xffffff, 0.08);
  for (let i = 0; i < 14; i++) frame.fillRect(120 + i * 2, 12 + i * 3, 8, 3);
  // Cartel "PARADA" parpadeante.
  const sign = makeText(kit.scene, 154, 90, 'PARADA SOLICITADA', { fontFamily: 'Silkscreen, monospace', fontSize: '5px', color: '#f8a040', backgroundColor: '#181820', padding: { x: 2, y: 1 } });
  stage.add(sign);
  kit.every(900, () => sign.setVisible(!sign.visible));
}

// ---------------------------------------------------------------------------

export const M1_4_VINETAS: Record<string, VinetaBuilder> = {
  m1_celular: buildCelular,
  m1_anden: buildAnden,
  m1_vagon: (kit) => buildVagon(kit, ['pasajera', 'estudiante', 'abuelo'], false),
  m1_micro: buildMicro,
  m2_cena: (kit) => buildDinner(kit, DINNERS.m2_cena),
  m2_tren: (kit) => buildVagon(kit, ['benja'], true),
  llamada_mama: buildLlamada,
  m3_cena: (kit) => buildDinner(kit, DINNERS.m3_cena),
  m3_pdi: buildPdi,
  m3_avsec: buildAvsec,
  m3_bandeja: buildBandeja,
  m3_furgon: buildFurgon,
  m4_cena_mery: (kit) => buildDinner(kit, DINNERS.m4_cena_mery),
  m4_bus_pance: (kit) => buildBusCali(kit, 'pance'),
  m4_bus_calle: (kit) => buildBusCali(kit, 'calle'),
  m4_bus_vuelta: (kit) => buildBusCali(kit, 'vuelta'),
};
