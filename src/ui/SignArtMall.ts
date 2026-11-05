import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { StoryState } from '../systems/StoryState';
import type { SignCtx } from './SignArt';
import { drawPanel } from './theme';

/**
 * Carteles del Costanera Center (y alrededores): el afiche de cine en su caja de luz, la botonera del
 * ascensor, la huella del kiosco fantasma en la vereda y el menú de la confitería del cine.
 */

/** Afiche "Santiago Laberinto 2" en caja de luz con bombillitas. */
export interface CinePosterSign {
  kind: 'afiche_cine';
}

/** Botonera de acero del ascensor del mall (con el misterioso botón 61). */
export interface ElevatorSign {
  kind: 'botonera';
}

/** Vista desde arriba de la vereda donde estaba el kiosco. */
export interface KioskSign {
  kind: 'kiosco';
}

/** Menú iluminado de la confitería del cine. */
export interface ConcessionSign {
  kind: 'confiteria';
}

export type MallSign = CinePosterSign | ElevatorSign | KioskSign | ConcessionSign;

/** Colores del quiltro (los mismos de src/art/vinetas_calle.ts). */
const FUR = 0xc89458;
const FUR_D = 0x9a6a38;
const SPOT = 0xf0e0c0;
const PATCH = 0x7a4c28;
const INK = 0x2a2433;

type Style = Phaser.Types.GameObjects.Text.TextStyle;
/** [x, y, ancho, alto, color] en px. */
type Px = [number, number, number, number, number];

export function buildMallSign(ctx: SignCtx, s: MallSign): void {
  switch (s.kind) {
    case 'afiche_cine':
      buildCinePoster(ctx);
      playSfx('click');
      break;
    case 'botonera':
      buildElevatorPanel(ctx);
      break;
    case 'kiosco':
      buildKioskPrint(ctx);
      break;
    case 'confiteria':
      buildConcession(ctx);
      playSfx('click');
      break;
  }
}

/** Texto que achica la letra hasta caber en `maxW` (mínimo 4 px). */
function fitText(ctx: SignCtx, x: number, y: number, str: string, maxW: number, size: number, style: Style): Phaser.GameObjects.Text {
  for (let s = size; ; s--) {
    const t = ctx.text(x, y, str, { ...style, fontSize: `${s}px` });
    if (t.width <= maxW || s <= 4) return t;
    t.destroy();
  }
}

/** Piezas con contorno de 1 px: primero todos los contornos, después los rellenos. */
function outlined(g: Phaser.GameObjects.Graphics, parts: Px[]): void {
  g.fillStyle(INK, 1);
  for (const [x, y, w, h] of parts) g.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of parts) g.fillStyle(c, 1).fillRect(x, y, w, h);
}

/** Flechita en cualquier dirección (grados, 0 = derecha). */
function arrow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, deg: number, color: number): void {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  g.lineStyle(1, color, 1).lineBetween(cx - dx * 4, cy - dy * 4, cx + dx * 2, cy + dy * 2);
  g.fillStyle(color, 1).fillTriangle(cx + dx * 6, cy + dy * 6, cx + dx * 2 - dy * 3, cy + dy * 2 + dx * 3, cx + dx * 2 + dy * 3, cy + dy * 2 - dx * 3);
}

// ---------------------------------------------------------------------------
// Afiche de cine: «Santiago Laberinto 2: Perdidos en Maipú»
// ---------------------------------------------------------------------------

/** Vertical y angosto: cabe entre el HUD y la caja de diálogo (y 2 → 120). */
function buildCinePoster(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 104;
  const h = 118;
  root.setPosition((BASE_WIDTH - w) / 2, 2);
  const g = scene.add.graphics();
  // Caja de luz: marco de aluminio oscuro y el vidrio iluminado por detrás.
  drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0x2a2a34, edge: 0x0e0e12 });
  g.fillStyle(0x44444f, 1).fillRect(3, 1, w - 6, 1);
  const px = 8;
  const py = 7;
  const pw = w - 16;
  const ph = h - 14;
  g.fillStyle(0xfff0c0, 0.25).fillRect(px - 3, py - 3, pw + 6, ph + 6);
  g.fillStyle(0xfff0c0, 0.45).fillRect(px - 1, py - 1, pw + 2, ph + 2);
  root.add(g);

  // Bombillitas alrededor del marco, en orden de recorrido (arriba, derecha, abajo, izquierda).
  const bulbs: [number, number][] = [];
  for (let x = 4; x <= w - 4; x += 8) bulbs.push([x, 3]);
  for (let y = 11; y <= h - 11; y += 8) bulbs.push([w - 4, y]);
  for (let x = w - 4; x >= 4; x -= 8) bulbs.push([x, h - 4]);
  for (let y = h - 11; y >= 11; y -= 8) bulbs.push([4, y]);
  const bulbG = scene.add.graphics();
  root.add(bulbG);

  const poster = scene.add.container(px, py);
  root.add(poster);
  const pg = scene.add.graphics();
  poster.add(pg);
  // Cielo de noche que se pone morado hacia el horizonte.
  for (let y = 0; y < ph; y += 2) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x100c30),
      Phaser.Display.Color.ValueToColor(0x6a2458),
      66,
      Math.min(y, 66),
    );
    pg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, y, pw, 2);
  }
  // Estrellas (pseudoaleatorias, siempre iguales).
  for (let i = 0; i < 16; i++) pg.fillStyle(0xffffff, i % 3 ? 0.5 : 0.9).fillRect((i * 37 + 5) % pw, 36 + ((i * 23) % 16), 1, 1);

  // Título con sombra, estilo póster de película.
  const shadow = { offsetX: 1, offsetY: 1, color: '#1a0610', fill: true };
  poster.add(ctx.text(pw / 2, 3, 'SANTIAGO', { fontFamily: FONT_HUD, fontSize: '6px', color: '#f8e8b0', shadow }).setOrigin(0.5, 0));
  const title = fitText(ctx, pw / 2 - 6, 8, 'LABERINTO', 70, 16, {
    fontStyle: '700',
    color: '#f8d040',
    stroke: '#8a1c20',
    strokeThickness: 2,
    shadow,
  }).setOrigin(0.5, 0);
  poster.add(title);
  // El "2" en un círculo rojo, pegado al título.
  const bx = Math.min(pw - 7, Math.round(pw / 2 - 6 + title.width / 2 + 5));
  pg.fillStyle(0xffffff, 1).fillCircle(bx, 17, 7);
  pg.fillStyle(0xc8202c, 1).fillCircle(bx, 17, 6);
  poster.add(ctx.text(bx + 1, 13, '2', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));
  poster.add(fitText(ctx, pw / 2, 27, 'PERDIDOS EN MAIPÚ', pw - 6, 7, { fontStyle: '700', color: '#ffffff', shadow }).setOrigin(0.5, 0));

  // Edificios recortados contra el cielo, con alguna ventana encendida.
  const blocks: [number, number, number][] = [
    [0, 56, 9],
    [9, 51, 8],
    [17, 58, 9],
    [26, 53, 7],
    [33, 60, 10],
    [43, 55, 8],
    [51, 49, 9],
    [60, 57, 8],
  ];
  for (const [bx0, top, bw] of blocks) {
    pg.fillStyle(0x2c2258, 1).fillRect(bx0, top, bw, 66 - top);
    for (let wy = top + 2; wy < 64; wy += 3) if ((bx0 + wy) % 4 === 0) pg.fillStyle(0xf0c870, 0.7).fillRect(bx0 + 2, wy, 1, 1);
  }
  // La Torre Costanera: alta, angostándose, con su corona de vigas.
  const tx = pw - 12;
  pg.fillStyle(0x40388a, 1).fillPoints(
    [
      { x: tx - 6, y: 66 },
      { x: tx + 6, y: 66 },
      { x: tx + 3, y: 39 },
      { x: tx - 3, y: 39 },
    ],
    true,
  );
  pg.fillStyle(0x8a80c8, 0.55);
  for (let y = 42; y < 65; y += 3) {
    const half = Math.round(3 + ((y - 39) / 27) * 3) - 1;
    pg.fillRect(tx - half, y, half * 2, 1);
  }
  pg.lineStyle(1, 0x6a60b0, 1).lineBetween(tx - 3, 39, tx - 2, 34).lineBetween(tx + 3, 39, tx + 2, 34).lineBetween(tx - 2, 36, tx + 2, 37);
  pg.lineBetween(tx, 34, tx, 31);
  // Luz roja de balizamiento en la punta (parpadea con las bombillas).
  const beacon = scene.add.graphics();
  beacon.fillStyle(0xff3030, 1).fillRect(tx, 30, 1, 1);
  beacon.fillStyle(0xff3030, 0.35).fillCircle(tx + 0.5, 30.5, 2);
  poster.add(beacon);

  // El suelo: un laberinto de calles visto medio desde arriba.
  pg.fillStyle(0x1a1430, 1).fillRect(0, 66, pw, 13);
  pg.fillStyle(0x6a5aa0, 1);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 15; c++) {
      const x = c * 6;
      const y = 67 + r * 4;
      if ((r * 7 + c * 3) % 4 < 2) pg.fillRect(x, y, 6, 1);
      if ((r * 5 + c * 11) % 3 === 0) pg.fillRect(x, y, 1, 4);
    }
  }

  // El protagonista, perdido detrás de un mapa enorme.
  outlined(pg, [
    [18, 70, 3, 8, 0x283868],
    [23, 70, 3, 8, 0x283868],
    [16, 60, 12, 10, 0x3a78c0],
    [18, 49, 8, 8, 0xe8b890],
  ]);
  pg.fillStyle(0x3a2418, 1).fillRect(17, 48, 10, 3).fillRect(17, 48, 2, 5);
  pg.fillStyle(INK, 1).fillRect(20, 54, 1, 1).fillRect(24, 54, 1, 1);
  pg.fillStyle(0x1a1a20, 1).fillRect(17, 77, 4, 1).fillRect(23, 77, 4, 1);
  // El mapa: más grande que él, con pliegues, calles y una ruta que da vueltas.
  outlined(pg, [[5, 56, 34, 12, 0xf2ead0]]);
  pg.fillStyle(0xd4c8a4, 1).fillRect(13, 56, 1, 12).fillRect(22, 56, 1, 12).fillRect(30, 56, 1, 12);
  pg.lineStyle(1, 0xa09c90, 1).lineBetween(6, 60, 38, 60).lineBetween(6, 64, 38, 63).lineBetween(10, 57, 11, 67).lineBetween(26, 57, 27, 67);
  pg.lineStyle(1, 0xd02838, 1).beginPath();
  pg.moveTo(7, 66);
  pg.lineTo(11, 62).lineTo(17, 65).lineTo(20, 58).lineTo(26, 61).lineTo(24, 66).lineTo(33, 64).lineTo(36, 58);
  pg.strokePath();
  pg.fillStyle(0xd02838, 1).fillRect(35, 57, 3, 1).fillRect(36, 56, 1, 3);
  outlined(pg, [
    [3, 60, 2, 3, 0xe8b890],
    [39, 60, 2, 3, 0xe8b890],
  ]);

  // Flechas en todas direcciones: dos juegos que se alternan y lo marean.
  const arrowsA = scene.add.graphics();
  const arrowsB = scene.add.graphics();
  for (const [ax, ay, deg, c] of [
    [8, 43, -135, 0xf8d040],
    [22, 40, -90, 0xffffff],
    [36, 43, -45, 0xf8d040],
    [4, 51, 180, 0xff6a50],
    [44, 51, 0, 0xffffff],
  ] as const) arrow(arrowsA, ax, ay, deg, c);
  for (const [ax, ay, deg, c] of [
    [8, 43, 45, 0xff6a50],
    [22, 40, 90, 0xf8d040],
    [36, 43, 135, 0xffffff],
    [4, 51, 0, 0xf8d040],
    [44, 51, 180, 0xff6a50],
  ] as const) arrow(arrowsB, ax, ay, deg, c);
  arrowsB.setAlpha(0);
  const qmark = ctx.text(29, 41, '?', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff', shadow });
  poster.add([arrowsA, arrowsB, qmark]);
  ctx.track(scene.tweens.add({ targets: arrowsA, alpha: 0, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  ctx.track(scene.tweens.add({ targets: arrowsB, alpha: 1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  ctx.track(scene.tweens.add({ targets: qmark, y: 39, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));

  // El quiltro de invitado especial, mirando al protagonista (la plantilla de la misión 1, a 1 px).
  const dog = scene.add.graphics();
  outlined(dog, [
    [9, 10, 2, 6, FUR_D],
    [13, 10, 2, 6, FUR_D],
    [5, 10, 3, 6, FUR],
    [15, 10, 3, 6, FUR],
    [4, 4, 15, 7, FUR],
    [16, 3, 4, 5, FUR],
    [17, 0, 8, 7, FUR],
    [24, 3, 4, 3, FUR],
  ]);
  for (const [x, y, pw2, ph2, c] of [
    [8, 4, 5, 3, PATCH],
    [6, 9, 10, 2, SPOT],
    [17, 6, 2, 4, SPOT],
    [24, 4, 3, 2, SPOT],
    [15, 14, 3, 2, SPOT],
  ] as Px[]) dog.fillStyle(c, 1).fillRect(x, y, pw2, ph2);
  outlined(dog, [[18, 0, 3, 5, PATCH]]);
  dog.fillStyle(INK, 1).fillRect(22, 2, 1, 1).fillRect(27, 3, 1, 1);
  const tail = scene.add.graphics();
  const drawTail = (up: boolean): void => {
    tail.clear();
    outlined(tail, up ? [[1, 1, 1, 2, FUR], [2, 2, 1, 2, FUR], [3, 3, 2, 2, FUR]] : [[0, 4, 5, 2, FUR]]);
  };
  drawTail(true);
  poster.add(scene.add.container(71, 62, [tail, dog]).setScale(-1, 1));
  // Estrellita de "participación especial" sobre el quiltro.
  const star: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 1.5 : 4;
    star.push({ x: 50 + Math.cos(a) * r, y: 56 + Math.sin(a) * r });
  }
  pg.fillStyle(0xf8d040, 1).fillPoints(star, true);

  // PRÓXIMAMENTE, la banda de clasificación y los créditos chiquitos.
  pg.fillStyle(0xb01c28, 1).fillRect(0, 79, pw, 11);
  pg.fillStyle(0xf8d040, 1).fillRect(0, 79, pw, 1).fillRect(0, 89, pw, 1);
  poster.add(ctx.text(pw / 2, 80, 'PRÓXIMAMENTE', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));
  pg.fillStyle(0x0c0a1c, 1).fillRect(0, 90, pw, ph - 90);
  pg.fillStyle(0xffffff, 1).fillRect(3, 91, 14, 7);
  pg.fillStyle(0x0c0a1c, 1).fillRect(4, 92, 12, 5);
  pg.fillStyle(0xffffff, 1).fillRect(5, 93, 10, 3);
  poster.add(ctx.text(10, 91, 'TE', { fontFamily: FONT_HUD, fontSize: '6px', color: '#0c0a1c' }).setOrigin(0.5, 0));
  pg.lineStyle(1, 0xffffff, 0.8).strokeRect(19.5, 91.5, pw - 22, 6);
  poster.add(fitText(ctx, 21, 91, 'TODO ESPECTADOR', pw - 26, 5, { fontStyle: '600', color: '#e8e0f0' }));
  poster.add(fitText(ctx, pw / 2, 97, 'DIR. FELI P. · CON EL QUILTRO', pw - 4, 5, { color: '#a8a0c0' }).setOrigin(0.5, 0));

  // Brillo que barre el vidrio de la caja de luz (filas recortadas al afiche, sin máscara).
  const sheen = scene.add.graphics();
  poster.add(sheen);
  const drawSheen = (sx: number): void => {
    sheen.clear();
    for (let y = 0; y < ph; y += 2) {
      const x0 = Math.round(sx - y * 0.5);
      for (const [off, bw, a] of [
        [0, 9, 0.12],
        [12, 3, 0.1],
      ]) {
        const a0 = Math.max(0, x0 + off);
        const a1 = Math.min(pw, x0 + off + bw);
        if (a1 > a0) sheen.fillStyle(0xffffff, a).fillRect(a0, y, a1 - a0, 2);
      }
    }
  };
  const glass = { x: -20 };
  drawSheen(glass.x);
  ctx.track(
    scene.tweens.add({
      targets: glass,
      x: pw + 70,
      delay: 400,
      duration: 1300,
      repeatDelay: 2400,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: () => drawSheen(glass.x),
    }),
  );

  // Bombillas en secuencia (de a una de cada tres), la baliza de la torre y la cola del quiltro.
  let last = -1;
  const drawBulbs = (phase: number): void => {
    bulbG.clear();
    bulbs.forEach(([x, y], i) => {
      const lit = i % 3 === phase;
      bulbG.fillStyle(0x15151a, 1).fillCircle(x, y, 2);
      if (lit) bulbG.fillStyle(0xfff0a0, 0.35).fillCircle(x, y, 3.5);
      bulbG.fillStyle(lit ? 0xfff6c8 : 0x9a8448, 1).fillCircle(x, y, 1.5);
    });
    beacon.setAlpha(phase === 0 ? 1 : 0.15);
    drawTail(phase !== 1);
  };
  drawBulbs(0);
  const chase = { t: 0 };
  ctx.track(
    scene.tweens.add({
      targets: chase,
      t: 3,
      duration: 720,
      repeat: -1,
      onUpdate: () => {
        const phase = Math.floor(chase.t) % 3;
        if (phase !== last) drawBulbs((last = phase));
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Botonera del ascensor
// ---------------------------------------------------------------------------

/** Angosta y a la izquierda: las opciones de pisos salen a la derecha, sobre la caja de diálogo. */
function buildElevatorPanel(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 72;
  const h = 114;
  root.setPosition(52, 4);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0xc4c8d0, edge: 0x5a5e68 });
  // Acero cepillado: rayitas verticales claras y oscuras.
  for (let x = 3; x < w - 3; x += 2) g.fillStyle(x % 4 === 1 ? 0xffffff : 0x8a8e98, 0.12).fillRect(x, 2, 1, h - 4);
  g.fillStyle(0x8a8e98, 1);
  for (const [sx, sy] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) g.fillCircle(sx, sy, 1.5);
  root.add(g);

  // Pantallita LED con el piso actual y la flecha.
  const loc = StoryState.location?.map ?? '';
  const m = /^costanera_(m?)(\d+)$/.exec(loc);
  const floor = m ? `${m[1] ? '-' : ''}${m[2]}` : '';
  g.fillStyle(0x3a3e48, 1).fillRect(9, 7, w - 18, 17);
  g.fillStyle(0x0e0a0a, 1).fillRect(10, 8, w - 20, 15);
  root.add(ctx.text(w / 2 + 6, 9, floor || '--', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ff4030' }).setOrigin(0.5, 0));
  const updown = scene.add.graphics();
  updown.fillStyle(0xff4030, 1).fillTriangle(15, 14, 21, 14, 18, 10);
  updown.fillStyle(0xff4030, 0.3).fillTriangle(15, 16, 21, 16, 18, 20);
  root.add(updown);
  ctx.track(scene.tweens.add({ targets: updown, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 }));
  root.add(fitText(ctx, w / 2, 25, 'MÁX. 13 PERS. · 1000 KG', w - 8, 5, { fontStyle: '600', color: '#3a3e48' }).setOrigin(0.5, 0));

  // Botones redondos con su número y el Braille al lado.
  const button = (cx: number, cy: number, label: string, lit = false): void => {
    g.fillStyle(0x6a6e78, 1).fillCircle(cx, cy, 6);
    g.fillStyle(lit ? 0xffd070 : 0xe8eaee, 1).fillCircle(cx, cy, 5);
    g.fillStyle(0xffffff, 0.6).fillCircle(cx - 1.5, cy - 1.5, 1.5);
    g.fillStyle(0x3a3e48, 1);
    for (let k = 0; k < 3; k++) if ((label.charCodeAt(0) + k) % 2 === 0 || k === 1) g.fillRect(cx - 10, cy - 3 + k * 2, 1, 1);
    root.add(ctx.text(cx, cy - 3, label, { fontFamily: FONT_HUD, fontSize: '6px', color: '#2a2433' }).setOrigin(0.5, 0));
  };
  const rows = [
    ['5', '6'],
    ['3', '4'],
    ['1', '2'],
  ];
  rows.forEach((row, r) => row.forEach((label, c) => button(24 + c * 26, 40 + r * 14, label, label === floor)));
  button(24, 82, '-1', floor === '-1');
  // Alarma: campanita amarilla.
  g.fillStyle(0x6a6e78, 1).fillCircle(50, 82, 6);
  g.fillStyle(0xf0c030, 1).fillCircle(50, 82, 5);
  g.fillStyle(0x2a2433, 1).fillRect(48, 79, 4, 4).fillRect(47, 83, 6, 1).fillRect(49, 84, 2, 1);
  // Abrir y cerrar puertas.
  for (const [cx, open] of [[24, true], [50, false]] as const) {
    g.fillStyle(0x6a6e78, 1).fillCircle(cx, 96, 6);
    g.fillStyle(0xe8eaee, 1).fillCircle(cx, 96, 5);
    g.fillStyle(0x2a2433, 1).fillRect(cx, 93, 1, 7);
    if (open) g.fillTriangle(cx - 1, 96, cx - 4, 94, cx - 4, 98).fillTriangle(cx + 2, 96, cx + 5, 94, cx + 5, 98);
    else g.fillTriangle(cx - 4, 96, cx - 1, 94, cx - 1, 98).fillTriangle(cx + 5, 96, cx + 2, 94, cx + 2, 98);
  }
  // El botón 61, solito abajo, con un brillo que nadie sabe de dónde viene.
  g.fillStyle(0x6a6e78, 1).fillRoundedRect(28, 104, 16, 8, 2);
  g.fillStyle(0xd8dce4, 1).fillRoundedRect(29, 105, 14, 6, 2);
  root.add(ctx.text(36, 104, '61', { fontFamily: FONT_HUD, fontSize: '6px', color: '#7a2a8a' }).setOrigin(0.5, 0));
  const glow = scene.add.graphics();
  glow.lineStyle(1, 0xc070f0, 1).strokeRoundedRect(26.5, 102.5, 19, 11, 3);
  glow.setAlpha(0);
  root.add(glow);
  ctx.track(scene.tweens.add({ targets: glow, alpha: 0.9, duration: 900, delay: 600, yoyo: true, repeat: -1, repeatDelay: 1400, ease: 'Sine.InOut' }));
}

// ---------------------------------------------------------------------------
// La huella del kiosco fantasma
// ---------------------------------------------------------------------------

function buildKioskPrint(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 176;
  const h = 92;
  root.setPosition((BASE_WIDTH - w) / 2, 12);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0xa8a49c, edge: 0x4a4844 });
  // Baldosas de 12 px con fragüe oscuro y cada una de un gris un poquito distinto.
  const tile = 12;
  const x0 = 2;
  const y0 = 2;
  const floorH = h - 15;
  for (let ty = 0; ty * tile < floorH; ty++) {
    for (let tx = 0; tx * tile < w - 4; tx++) {
      const shade = [0xa8a49c, 0x9e9a92, 0xb0aca4][(tx * 5 + ty * 3) % 3];
      const tw = Math.min(tile - 1, w - 4 - tx * tile);
      const th = Math.min(tile - 1, floorH - ty * tile);
      g.fillStyle(shade, 1).fillRect(x0 + tx * tile, y0 + ty * tile, tw, th);
    }
  }
  // Manchas de mugre de años de veredas.
  g.fillStyle(0x5a564e, 0.25).fillEllipse(24, 18, 18, 8).fillEllipse(150, 60, 22, 10).fillEllipse(40, 70, 14, 6);
  g.fillStyle(0x2a2826, 0.35).fillCircle(140, 20, 1.5).fillCircle(30, 50, 1).fillCircle(160, 34, 1);
  // Solera y un pedazo de calle abajo.
  g.fillStyle(0x8a8a90, 1).fillRect(2, h - 13, w - 4, 3);
  g.fillStyle(0x3a3a42, 1).fillRect(2, h - 10, w - 4, 8);
  g.fillStyle(0xe8d048, 1);
  for (let x = 8; x < w - 8; x += 16) g.fillRect(x, h - 6, 8, 1);
  root.add(g);

  // El cuadrado limpio donde estaba el kiosco (justo cinco por cuatro baldosas).
  const kx = x0 + 4 * tile;
  const ky = y0 + tile;
  const kw = 6 * tile - 1;
  const kh = 4 * tile - 1;
  const clean = scene.add.graphics();
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 6; tx++) clean.fillStyle(0xd0ccc4, 1).fillRect(kx + tx * tile, ky + ty * tile, tile - 1, tile - 1);
  clean.lineStyle(1, 0x6a665e, 0.6).strokeRect(kx - 0.5, ky - 0.5, kw + 1, kh + 1);
  clean.lineStyle(2, 0x6a665e, 0.2).strokeRect(kx - 2, ky - 2, kw + 4, kh + 4);
  // Las cuatro marcas de tornillos, con su aureola de óxido.
  for (const [sx, sy] of [[kx + 4, ky + 4], [kx + kw - 5, ky + 4], [kx + 4, ky + kh - 5], [kx + kw - 5, ky + kh - 5]]) {
    clean.fillStyle(0x8a5a2b, 0.45).fillCircle(sx, sy, 3);
    clean.fillStyle(0x2a2826, 1).fillCircle(sx, sy, 1.5);
  }
  // El chicle de menta de 1998, aplastado entre dos baldosas.
  const gx = kx + 3 * tile - 1;
  const gy = ky + 2 * tile + 3;
  clean.fillStyle(0x6aa888, 1).fillEllipse(gx, gy, 9, 6).fillCircle(gx + 4, gy + 2, 2);
  clean.fillStyle(0x9ad8b0, 1).fillEllipse(gx, gy - 0.5, 7, 4);
  clean.fillStyle(0xd8f4e0, 1).fillRect(gx - 2, gy - 2, 2, 1);
  root.add(clean);

  // El fantasma del kiosco: su silueta punteada aparece y se va (techito a rayas incluido).
  const ghost = scene.add.graphics();
  ghost.fillStyle(0xffffff, 1);
  for (let x = kx - 4; x <= kx + kw + 4; x += 3) ghost.fillRect(x, ky - 4, 1, 1).fillRect(x, ky + kh + 3, 1, 1);
  for (let y = ky - 4; y <= ky + kh + 3; y += 3) ghost.fillRect(kx - 4, y, 1, 1).fillRect(kx + kw + 4, y, 1, 1);
  for (let x = kx - 2; x < kx + kw + 2; x += 8) ghost.fillStyle(0xc8202c, 1).fillRect(x, ky - 2, 4, 3);
  ghost.setAlpha(0);
  root.add(ghost);
  ctx.track(scene.tweens.add({ targets: ghost, alpha: 0.35, duration: 1400, delay: 500, yoyo: true, repeat: -1, repeatDelay: 600, ease: 'Sine.InOut' }));

  // Destello del chicle (sigue brillando después de tantos años).
  const spark = scene.add.graphics();
  spark.fillStyle(0xffffff, 1).fillRect(-3, 0, 7, 1).fillRect(0, -3, 1, 7);
  const sparkC = scene.add.container(gx + 3, gy - 4, [spark]).setScale(0);
  root.add(sparkC);
  ctx.track(scene.tweens.add({ targets: sparkC, scale: 1, angle: 45, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1800, delay: 900 }));

  // Una hoja seca que tiembla con el viento.
  const leaf = scene.add.graphics();
  leaf.fillStyle(0xb8782c, 1).fillEllipse(0, 0, 8, 4);
  leaf.lineStyle(1, 0x7a4c18, 1).lineBetween(-4, 0, 5, 0);
  const leafC = scene.add.container(148, 22, [leaf]).setAngle(-20);
  root.add(leafC);
  ctx.track(scene.tweens.add({ targets: leafC, angle: 5, x: 151, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
}

// ---------------------------------------------------------------------------
// Menú de la confitería del cine
// ---------------------------------------------------------------------------

function buildConcession(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 232;
  const h = 84;
  root.setPosition((BASE_WIDTH - w) / 2, 4);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0x141418, edge: 0x050507 });
  g.fillStyle(0xb01c28, 1).fillRect(3, 3, w - 6, 12);
  g.fillStyle(0xf8d040, 1).fillRect(3, 15, w - 6, 1);
  root.add(g);
  root.add(ctx.text(w / 2, 5, 'CONFITERÍA · FUNCIÓN 19:00', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));

  const items = [
    { name: 'CABRITAS', size: 'GRANDE', price: '$6.990' },
    { name: 'BEBIDA', size: 'GRANDE', price: '$4.990' },
    { name: 'BUTACA', size: 'CHICA', price: '$5.500' },
  ];
  const cw = 70;
  const gap = (w - 6 - cw * 3) / 4;
  items.forEach((it, i) => {
    const cx0 = Math.round(3 + gap + i * (cw + gap));
    // Panel iluminado por detrás.
    g.fillStyle(0x2a2a34, 1).fillRect(cx0, 19, cw, 61);
    g.fillStyle(0xfff0c0, 0.12).fillRect(cx0, 19, cw, 30);
    root.add(ctx.text(cx0 + cw / 2, 52, it.name, { fontSize: '8px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5, 0));
    root.add(ctx.text(cx0 + cw / 2, 62, it.size, { fontFamily: FONT_HUD, fontSize: '6px', color: '#f8d040' }).setOrigin(0.5, 0));
    root.add(ctx.text(cx0 + cw / 2, 69, it.price, { fontSize: '8px', fontStyle: '600', color: '#f0a8a8' }).setOrigin(0.5, 0));
  });
  const c0 = Math.round(3 + gap) + cw / 2;
  const c1 = Math.round(3 + gap * 2 + cw) + cw / 2;
  const c2 = Math.round(3 + gap * 3 + cw * 2) + cw / 2;

  // Balde de cabritas a rayas rojas y blancas, rebalsado.
  g.fillStyle(0xfff4d8, 1).fillCircle(c0 - 9, 25, 5).fillCircle(c0 - 2, 23, 6).fillCircle(c0 + 6, 24, 5).fillCircle(c0 + 11, 27, 4).fillCircle(c0 - 13, 28, 4);
  g.fillStyle(0xf0d070, 1).fillCircle(c0 - 4, 26, 2).fillCircle(c0 + 5, 27, 2).fillCircle(c0 - 10, 29, 1.5);
  for (let k = 0; k < 6; k++) {
    g.fillStyle(k % 2 ? 0xffffff : 0xd02028, 1).fillPoints(
      [
        { x: c0 - 15 + k * 5, y: 29 },
        { x: c0 - 10 + k * 5, y: 29 },
        { x: c0 - 9 + k * 4, y: 49 },
        { x: c0 - 12 + k * 4, y: 49 },
      ],
      true,
    );
  }
  g.fillStyle(0xd02028, 1).fillRect(c0 - 15, 29, 30, 2);
  // Cabritas que saltan del balde.
  [-6, 3, 9].forEach((dx, k) => {
    const pop = scene.add.graphics();
    pop.fillStyle(0xfff4d8, 1).fillRect(0, 0, 2, 2);
    pop.setPosition(c0 + dx, 22);
    root.add(pop);
    ctx.track(scene.tweens.add({ targets: pop, y: 16 - k, duration: 260, yoyo: true, repeat: -1, repeatDelay: 700 + k * 230, delay: k * 380, ease: 'Quad.Out' }));
  });

  // Vaso gigante de bebida, con tapa y bombilla.
  g.fillStyle(0xd02028, 1).fillPoints(
    [
      { x: c1 - 11, y: 25 },
      { x: c1 + 11, y: 25 },
      { x: c1 + 8, y: 49 },
      { x: c1 - 8, y: 49 },
    ],
    true,
  );
  g.fillStyle(0xffffff, 1).fillRect(c1 - 9, 34, 18, 4);
  g.fillStyle(0xe8e8ec, 1).fillRect(c1 - 12, 23, 24, 3);
  g.fillStyle(0xf8d040, 1).fillRect(c1 + 2, 14, 2, 10).fillRect(c1 + 2, 14, 5, 2);
  g.fillStyle(0xffffff, 0.3).fillRect(c1 - 8, 27, 2, 18);

  // La butaca: chiquitita en medio del panel, con su "(tamaño real)".
  g.fillStyle(0x8a1820, 1).fillRect(c2 - 4, 37, 8, 6);
  g.fillStyle(0xb02028, 1).fillRect(c2 - 4, 42, 8, 3);
  g.fillStyle(0x3a3a42, 1).fillRect(c2 - 5, 39, 1, 7).fillRect(c2 + 4, 39, 1, 7);
  root.add(ctx.text(c2, 26, '(tamaño real)', { fontSize: '5px', fontStyle: 'italic', color: '#a8a8b4' }).setOrigin(0.5, 0));
  const arrowG = scene.add.graphics();
  arrow(arrowG, c2, 33, 90, 0xa8a8b4);
  root.add(arrowG);
  ctx.track(scene.tweens.add({ targets: arrowG, y: 1, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
}
