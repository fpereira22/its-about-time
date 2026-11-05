import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas del vuelo a Cali (misión 3), vistas por la ventanilla del 18A:
 *  - vuelo_despegue    Santiago de noche, un mar de lucecitas naranjas que se aleja y se inclina al subir
 *  - vuelo_cordillera  los Andes a la luz de la luna: picos nevados que brillan y una nube que pasa
 *  - vuelo_aterrizaje  ¡pum! las ruedas tocan la pista de Cali entre palmeras... y los aplausos
 * El paisaje se dibuja en el hueco de la ventanilla; la pared de la cabina va encima y lo recorta.
 * El avión va hacia la izquierda (ventana del lado izquierdo): el paisaje corre hacia la derecha.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

/** Ventanilla: centro, medio ancho y medio alto del vidrio; el marco plástico es un poco más grande. */
const WIN = { cx: 110, cy: 54, rx: 32, ry: 43 };
const BEZEL = { rx: 40, ry: 51 };
/** Caja del vidrio (lo que hay que pintar del paisaje). */
const VIEW = { x: WIN.cx - WIN.rx, y: WIN.cy - WIN.ry, w: WIN.rx * 2 + 1, h: WIN.ry * 2 + 1 };
const BOTTOM = VIEW.y + VIEW.h;
const FRAME_MS = 50;

/** Medio ancho de una ventanilla (superelipse: un rectángulo bien redondeado) a `dy` px del centro; -1 = fuera. */
function halfWidth(dy: number, rx: number, ry: number): number {
  const k = Math.abs(dy) / ry;
  if (k > 1) return -1;
  return Math.round(rx * Math.pow(1 - Math.pow(k, 3), 1 / 3));
}

/** La pared de la cabina con el hueco de la ventanilla, el marco y la persiana subida. Va encima del paisaje. */
function drawCabinWall(g: G, night: boolean): void {
  const wall = night ? '#c8c4bc' : '#ece8e0';
  const wallD = shade(wall, -0.08);
  const bezel = night ? '#a8a49c' : '#d4d0c8';
  for (let y = 0; y < 108; y++) {
    const dy = y - WIN.cy;
    const outer = halfWidth(dy, BEZEL.rx, BEZEL.ry);
    const inner = halfWidth(dy, WIN.rx, WIN.ry);
    const ox = outer < 0 ? 220 : WIN.cx - outer;
    // Pared (con un leve degradé hacia abajo).
    g.fillStyle(hex(y > 80 ? wallD : wall), 1);
    if (outer < 0) {
      g.fillRect(0, y, 220, 1);
      continue;
    }
    g.fillRect(0, y, ox, 1).fillRect(WIN.cx + outer + 1, y, 220 - (WIN.cx + outer + 1), 1);
    // Marco plástico, con su borde oscuro y el bisel de adentro.
    g.fillStyle(hex(bezel), 1);
    if (inner < 0) g.fillRect(ox, y, outer * 2 + 1, 1);
    else g.fillRect(ox, y, outer - inner, 1).fillRect(WIN.cx + inner + 1, y, outer - inner, 1);
    g.fillStyle(hex('#6a665e'), 1).fillRect(ox, y, 1, 1).fillRect(WIN.cx + outer, y, 1, 1);
    if (inner >= 0) g.fillStyle(hex(shade(bezel, -0.25)), 1).fillRect(WIN.cx - inner - 1, y, 1, 1).fillRect(WIN.cx + inner + 1, y, 1, 1);
  }
  g.fillStyle(hex('#6a665e'), 1).fillRect(WIN.cx - 10, WIN.cy - BEZEL.ry - 1, 21, 1).fillRect(WIN.cx - 10, WIN.cy + BEZEL.ry + 1, 21, 1);
  // La persiana subida: asoma arriba del vidrio, con su manilla.
  for (let y = VIEW.y; y < VIEW.y + 7; y++) {
    const inner = halfWidth(y - WIN.cy, WIN.rx, WIN.ry);
    if (inner >= 0) g.fillStyle(hex('#f4f2ec'), 1).fillRect(WIN.cx - inner, y, inner * 2 + 1, 1);
  }
  g.fillStyle(hex('#b8b4ac'), 1).fillRect(WIN.cx - 20, VIEW.y + 7, 41, 1);
  g.fillStyle(hex('#8a867e'), 1).fillRect(WIN.cx - 4, VIEW.y + 5, 9, 2);
  // Reflejo en el vidrio.
  g.fillStyle(0xffffff, night ? 0.06 : 0.12);
  for (let i = 0; i < 16; i++) g.fillRect(WIN.cx - 18 + i, VIEW.y + 16 + i * 2, 4, 2);
}

/** El ala (se ve abajo del vidrio): del fuselaje hacia atrás. `day` = de día, gris claro con los spoilers arriba. */
function drawWing(g: G, day: boolean, blink: boolean, spoilers = false): void {
  const top = BOTTOM - 16;
  for (let y = top; y < BOTTOM; y++) {
    const x0 = WIN.cx - 30 + (y - top) * 2;
    g.fillStyle(hex(day ? '#c8ccd4' : '#262a36'), 1).fillRect(x0, y, WIN.cx + 40 - x0, 1);
  }
  g.fillStyle(hex(day ? '#e8ecf0' : '#363a48'), 1);
  for (let x = WIN.cx - 30; x < WIN.cx + 40; x++) g.fillRect(x, top, 1, 1);
  if (spoilers) g.fillStyle(hex('#a8b0bc'), 1).fillRect(WIN.cx - 12, top - 3, 10, 3).fillRect(WIN.cx + 2, top - 2, 10, 2);
  // Luz de navegación roja en la punta (ala izquierda) que parpadea.
  if (blink) {
    g.fillStyle(0xff4848, 0.35).fillRect(WIN.cx - 33, top - 2, 5, 5);
    g.fillStyle(0xff6060, 1).fillRect(WIN.cx - 31, top, 1, 1);
  }
}

/** Arma la ventanilla: un Graphics para el paisaje (se repinta cada cuadro) y la pared encima. */
function buildWindow(kit: VinetaKit, night: boolean): { stage: Layer; view: G; behind: Layer; front: Layer } {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex(night ? '#c8c4bc' : '#ece8e0'), 1).fillRect(x, y, w, h));
  const view = addG(kit, stage);
  // Lo que va "afuera" (recortado por la pared) y lo que va en la cabina, delante de todo.
  const behind = kit.scene.add.container(0, 0);
  stage.add(behind);
  const wall = addG(kit, stage);
  drawCabinWall(wall, night);
  const front = kit.scene.add.container(0, 0);
  stage.add(front);
  return { stage, view, behind, front };
}

/** Números "aleatorios" fijos (para que el paisaje no cambie al repintarlo). */
function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

// ---------------------------------------------------------------------------
// Despegue: Santiago de noche
// ---------------------------------------------------------------------------

const CITY = Array.from({ length: 190 }, (_, i) => ({
  u: rand(i) * 120,
  v: 0.04 + rand(i + 500) * 0.96,
  c: rand(i + 900) < 0.78 ? '#f0a040' : rand(i + 1300) < 0.6 ? '#f8d070' : '#f0f0e0',
  tw: rand(i + 1700) < 0.15,
}));

/** Las turbinas rugen y el avión sube: la ciudad se inclina, se aleja y se achica bajo el ala. */
const vueloDespegue: VinetaBuilder = (kit) => {
  const { view } = buildWindow(kit, true);
  let ms = 0;
  const CLIMB_MS = 6000;
  kit.every(FRAME_MS, () => {
    ms += FRAME_MS;
    const t = Math.min(1, ms / CLIMB_MS);
    const e = 1 - Math.pow(1 - t, 3);
    // Primero la nariz arriba (el horizonte baja en la ventana) y después se nivela, ya alto.
    const horizon = t < 0.25 ? lerp(52, 76, t / 0.25) : lerp(76, 42, (t - 0.25) / 0.75);
    const alt = 0.25 + 0.75 * e;
    const tilt = 0.28 * (1 - e) + 0.06;
    view.clear();
    view.fillStyle(hex('#141c3c'), 1).fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    view.fillStyle(hex('#1e2650'), 1).fillRect(VIEW.x, horizon - 14, VIEW.w, 8);
    view.fillStyle(hex('#3a2c50'), 1).fillRect(VIEW.x, horizon - 6, VIEW.w, 6);
    for (let i = 0; i < 8; i++) view.fillStyle(0xe8e8f0, 1).fillRect(VIEW.x + Math.round(rand(i + 40) * VIEW.w), VIEW.y + 9 + Math.round(rand(i + 80) * 20), 1, 1);
    // El suelo, inclinado (un ala más abajo que la otra).
    for (let x = VIEW.x; x < VIEW.x + VIEW.w; x++) {
      const y = Math.round(horizon + (x - WIN.cx) * tilt);
      view.fillStyle(hex('#0a0e1c'), 1).fillRect(x, y, 1, BOTTOM - y);
    }
    // Las lucecitas: las de cerca corren más rápido; a más altura, todo se achica y se junta.
    const span = BOTTOM - horizon;
    for (let i = 0; i < CITY.length; i++) {
      const p = CITY[i];
      const speed = (30 * (0.2 + p.v)) / alt;
      const x = VIEW.x - 10 + mod(p.u * (VIEW.w + 20) / 120 + (ms / 1000) * speed, VIEW.w + 20);
      const y = horizon + 1 + Math.pow(p.v, 1.8 - alt * 0.6) * span * (0.55 + 0.45 * (1 - e));
      const sx = Math.round(x);
      const sy = Math.round(y + (x - WIN.cx) * tilt);
      if (sy >= BOTTOM || sy <= horizon) continue;
      if (p.tw && (Math.floor(ms / 150) + i) % 3 === 0) continue;
      const big = p.v > 0.75 && alt < 0.55;
      view.fillStyle(hex(p.c), 1).fillRect(sx, sy, big ? 2 : 1, 1);
    }
    drawWing(view, false, Math.floor(ms / 450) % 3 === 0);
  });
};

// ---------------------------------------------------------------------------
// La cordillera de noche
// ---------------------------------------------------------------------------

interface Peak {
  u: number;
  h: number;
}
const FAR: Peak[] = Array.from({ length: 9 }, (_, i) => ({ u: i * 22 + rand(i) * 10, h: 22 + rand(i + 20) * 20 }));
const NEAR: Peak[] = Array.from({ length: 6 }, (_, i) => ({ u: i * 34 + rand(i + 40) * 12, h: 12 + rand(i + 60) * 14 }));
const RANGE_W = 200;

/** Altura de una cordillera (picos en punta con el borde serruchado) en la posición `u`. */
function ridge(peaks: Peak[], u: number, slope: number): number {
  let best = 0;
  for (const p of peaks) {
    for (const off of [-RANGE_W, 0, RANGE_W]) {
      const d = Math.abs(u - (p.u + off));
      best = Math.max(best, p.h - d * slope);
    }
  }
  return Math.max(0, best + Math.sin(u * 1.7) * 0.8);
}

/** Pinta una cordillera columna por columna, con la nieve arriba (iluminada o en sombra según la ladera). */
function drawRange(g: G, peaks: Peak[], base: number, scroll: number, slope: number, rock: string, snowLine: number, snowTops: Array<{ x: number; y: number }>): void {
  for (let x = VIEW.x; x < VIEW.x + VIEW.w; x++) {
    const u = mod(x - scroll, RANGE_W);
    const h = ridge(peaks, u, slope);
    const top = Math.round(base - h);
    g.fillStyle(hex(rock), 1).fillRect(x, top, 1, BOTTOM - top);
    const snow = Math.round(h - snowLine);
    if (snow > 0) {
      const lit = ridge(peaks, u - 1, slope) < h;
      g.fillStyle(hex(lit ? '#f4f6fc' : '#b8c4e0'), 1).fillRect(x, top, 1, Math.min(snow, 8));
      if (snow > 3) g.fillStyle(hex(lit ? '#dce4f4' : '#9aa8c8'), 1).fillRect(x, top + Math.min(snow, 8), 1, 2);
      snowTops.push({ x, y: top });
    }
  }
}

/** Los Andes a la luz de la luna, pasando despacio, con una nube que cruza por delante. */
const vueloCordillera: VinetaBuilder = (kit) => {
  const { view, behind } = buildWindow(kit, true);
  let ms = 0;
  let tops: Array<{ x: number; y: number }> = [];
  kit.every(FRAME_MS, () => {
    ms += FRAME_MS;
    const s = ms / 1000;
    view.clear();
    view.fillStyle(hex('#141a40'), 1).fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    view.fillStyle(hex('#1c2450'), 1).fillRect(VIEW.x, VIEW.y + 44, VIEW.w, VIEW.h - 44);
    for (let i = 0; i < 12; i++) {
      if ((Math.floor(ms / 300) + i) % 7 === 0) continue;
      view.fillStyle(0xe8e8f0, 1).fillRect(VIEW.x + Math.round(rand(i + 100) * VIEW.w), VIEW.y + 9 + Math.round(rand(i + 140) * 30), 1, 1);
    }
    disc(view, WIN.cx + 12, VIEW.y + 20, 5, '#f4ecc0');
    view.fillStyle(hex('#e0d8a8'), 1).fillRect(WIN.cx + 10, VIEW.y + 18, 2, 2).fillRect(WIN.cx + 14, VIEW.y + 22, 1, 1);
    tops = [];
    drawRange(view, FAR, VIEW.y + 74, Math.round(s * 3), 0.9, '#4a5888', 20, tops);
    drawRange(view, NEAR, VIEW.y + 88, Math.round(s * 7), 1.1, '#2c3660', 14, tops);
    // La nube: pasa por delante de los cerros cada tanto.
    const cx = Math.round(VIEW.x - 30 + mod(s * 9, VIEW.w + 70));
    for (const [dx, dy, r] of [[0, 2, 5], [7, 0, 6], [14, 2, 5], [20, 3, 4]] as const) disc(view, cx + dx, VIEW.y + 64 + dy, r, '#aeb8d8');
    view.fillStyle(hex('#c8d0e8'), 1).fillRect(cx, VIEW.y + 60, 18, 1);
    drawWing(view, false, Math.floor(ms / 450) % 3 === 0);
  });
  // Brillitos de azúcar flor sobre la nieve.
  kit.every(280, () => {
    if (tops.length === 0) return;
    const p = tops[Math.floor(Math.random() * tops.length)];
    if (p.y < BOTTOM - 18) sparkle(kit, behind, p.x, p.y + 1);
  });
};

// ---------------------------------------------------------------------------
// Aterrizaje en Cali
// ---------------------------------------------------------------------------

/** Palmera de lado: tronco curvo y las hojas abiertas. Origen = base del tronco. */
function drawPalm(g: G, x: number, y: number, h: number): void {
  g.fillStyle(hex('#7a5a38'), 1);
  for (let i = 0; i < h; i++) g.fillRect(x + Math.round(Math.sin((i / h) * 1.4) * 2), y - i, 2, 1);
  const tx = x + 3;
  const ty = y - h;
  g.fillStyle(hex('#3a8a3a'), 1);
  for (const [dx, dy] of [[-6, 2], [6, 2], [-4, -2], [5, -2], [0, -3]] as const) {
    for (let i = 0; i <= 4; i++) g.fillRect(tx + Math.round((dx * i) / 4), ty + Math.round((dy * i) / 4 + (i * i) / 6), 2, 1);
  }
  g.fillStyle(hex('#5a3a20'), 1).fillRect(tx - 1, ty, 2, 2);
}

/** Manos que aplauden (vistas desde atrás, con la manga). `x` = centro entre las manos, `y` = las palmas. */
function drawClap(g: G, look: HumanLook, x: number, y: number, apart: number): void {
  g.clear();
  for (const side of [-1, 1]) {
    const hx = x + side * apart - (side < 0 ? 5 : 0);
    outlined(g, [
      [hx, y + 6, 5, 40, look.shirt],
      [hx, y, 5, 7, look.skin],
    ]);
    g.fillStyle(hex(shade(look.shirt, -0.22)), 1).fillRect(hx, y + 6, 5, 2);
  }
}

/** Pasajeros que también aplauden (las mangas de otros colores). */
const OTHERS: Array<{ x: number; look: HumanLook }> = [
  { x: 30, look: { skin: '#c8956a', hair: '#000', shirt: '#e8a030', pants: '#000' } },
  { x: 190, look: { skin: '#f0c8a0', hair: '#000', shirt: '#3cb4a0', pants: '#000' } },
];

/** ¡Pum! Tocan la pista: todo salta, la pista corre y va frenando entre palmeras, y la gente aplaude. */
const vueloAterrizaje: VinetaBuilder = (kit) => {
  const { stage, view, front } = buildWindow(kit, false);
  const y0 = stage.y;
  // El golpe de las ruedas.
  [3, -2, 2, -1, 1, 0].forEach((d, i) => kit.after(i * 60, () => stage.setY(y0 + d)));
  playSfx('bump');
  popText(kit, front, WIN.cx - 40, 20, '¡PUM!', '#ffffff', 11, 1100);

  let ms = 0;
  let near = 0;
  let mid = 0;
  const STOP_MS = 4200;
  kit.every(FRAME_MS, () => {
    ms += FRAME_MS;
    const t = Math.min(1, ms / STOP_MS);
    const speed = 170 * Math.pow(1 - t, 2) + 12;
    near += (speed * FRAME_MS) / 1000;
    mid += (speed * 0.4 * FRAME_MS) / 1000;
    view.clear();
    // Cielo de la mañana y los cerros de Cali al fondo.
    view.fillStyle(hex('#8cc8f0'), 1).fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    view.fillStyle(hex('#b8e0f4'), 1).fillRect(VIEW.x, VIEW.y + 38, VIEW.w, 12);
    disc(view, WIN.cx - 14, VIEW.y + 26, 5, '#fff4c0');
    for (let x = VIEW.x; x < VIEW.x + VIEW.w; x++) {
      const top = Math.round(VIEW.y + 44 - Math.abs(Math.sin((x + 30) / 17)) * 7 - Math.sin(x / 5) * 1.2);
      view.fillStyle(hex('#7a98b8'), 1).fillRect(x, top, 1, 10);
    }
    // Cañaverales verdes y las palmeras pasando.
    view.fillStyle(hex('#6aa850'), 1).fillRect(VIEW.x, VIEW.y + 52, VIEW.w, VIEW.h - 52);
    view.fillStyle(hex('#5a9840'), 1);
    for (let i = 0; i < 4; i++) view.fillRect(VIEW.x, VIEW.y + 55 + i * 4, VIEW.w, 1);
    for (let i = 0; i < 4; i++) {
      const px = Math.round(VIEW.x - 12 + mod(i * 26 + mid, VIEW.w + 24));
      drawPalm(view, px, VIEW.y + 60 + (i % 2) * 2, 12 + (i % 3) * 2);
    }
    // La pista: el asfalto y las franjas blancas que pasan (borrosas cuando va rápido).
    const runway = VIEW.y + 66;
    view.fillStyle(hex('#5a5e66'), 1).fillRect(VIEW.x, runway, VIEW.w, BOTTOM - runway);
    view.fillStyle(hex('#f0f0e8'), 1).fillRect(VIEW.x, runway, VIEW.w, 1);
    const dash = Math.max(6, Math.min(20, Math.round(speed / 8)));
    for (let k = -1; k < 4; k++) {
      const dx = Math.round(VIEW.x + mod(k * 28 + near, VIEW.w + 28) - 14);
      view.fillStyle(hex('#f4f4ec'), 1).fillRect(dx, runway + 8, dash, 2);
      view.fillStyle(hex('#f0d048'), 1).fillRect(Math.round(VIEW.x + mod(k * 28 + near * 0.8, VIEW.w + 28) - 14), runway + 2, 2, 1);
    }
    drawWing(view, true, false, t < 0.8);
  });

  // Los aplausos: tus manos al centro y las de otros pasajeros a los lados.
  const look = playerLook();
  const clappers = [{ x: WIN.cx, look }, ...OTHERS].map((c, i) => ({ ...c, g: addG(kit, front), phase: i * 2 }));
  kit.after(1700, () => {
    let f = 0;
    kit.every(90, () => {
      f++;
      for (const c of clappers) {
        const k = (f + c.phase) % 4;
        const apart = [6, 3, 1, 3][k];
        const rise = Math.min(10, f * 2);
        const y = 108 - rise - (c.x === WIN.cx ? 4 : 0);
        drawClap(c.g, c.look, c.x, y, apart);
        if (k === 2) {
          // ¡Plap!: rayitas que saltan donde chocan las palmas.
          c.g.fillStyle(hex('#ffffff'), 1).fillRect(c.x - 5, y - 4, 2, 1).fillRect(c.x - 1, y - 6, 1, 2).fillRect(c.x + 4, y - 4, 2, 1);
        }
      }
    });
    popText(kit, front, WIN.cx, 14, '¡Bravo!', '#f8e070', 9, 1400);
  });
};

/** Viñetas del vuelo, para el registro de src/ui/Vineta.ts. */
export const VUELO_VINETAS: Record<string, VinetaBuilder> = {
  vuelo_despegue: vueloDespegue,
  vuelo_cordillera: vueloCordillera,
  vuelo_aterrizaje: vueloAterrizaje,
};
