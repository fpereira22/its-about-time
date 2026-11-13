import Phaser from 'phaser';
import type { HumanLook } from './characters';
import { PAL, shade } from './palette';

/**
 * Arte de las viñetas (escenas 2D vistas de lado que se muestran sobre el juego durante un diálogo):
 * personajes de perfil con sus facciones, para los abrazos, y el dibujo del hermano.
 * Todo se dibuja con rectángulos sobre un Graphics, en px de la resolución base (320×180).
 */

/** Plantilla de una figura de perfil a escala 1 (adulto): 20 × 56 px, mirando a la derecha. */
export const FIGURE_W = 20;
export const FIGURE_H = 56;

export interface SideFigureOpts {
  /** 1 = mira a la derecha, -1 = a la izquierda. */
  dir: 1 | -1;
  /** 1 = adulto; el hermano chico es más bajo, el papá un poco más alto. */
  scale: number;
  eyes: 'open' | 'closed';
}

type Part = [x: number, y: number, w: number, h: number, color: string];

const INK = '#2a2433';
const EYE = '#202028';
const TEAR = 0xa8e0ff;

export const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;

/** Dibuja rectángulos de la plantilla (espejados si mira a la izquierda y escalados). */
class FigurePainter {
  constructor(
    private readonly g: Phaser.GameObjects.Graphics,
    private readonly opts: SideFigureOpts,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const s = this.opts.scale;
    const lx = this.opts.dir === 1 ? x : FIGURE_W - x - w;
    const x0 = Math.round(lx * s);
    const y0 = Math.round(y * s);
    const w1 = Math.max(1, Math.round((lx + w) * s) - x0);
    const h1 = Math.max(1, Math.round((y + h) * s) - y0);
    this.g.fillStyle(hex(color), 1).fillRect(x0, y0, w1, h1);
  }

  /** Primero todos los contornos y después los rellenos: las piezas quedan unidas por dentro. */
  parts(list: Part[]): void {
    for (const [x, y, w, h] of list) this.rect(x - 1, y - 1, w + 2, h + 2, INK);
    for (const [x, y, w, h, c] of list) this.rect(x, y, w, h, c);
  }
}

/** Pelo y gorro de perfil: lo que va detrás de la cabeza y lo que va encima. */
function hairParts(look: HumanLook): { back: Part[]; top: Part[] } {
  const hair = look.hair;
  const cap = look.cap ?? PAL.red;
  switch (look.hairStyle ?? 'short') {
    case 'long':
      return { back: [[3, 1, 8, 21, hair]], top: [[4, -1, 14, 5, hair], [15, 3, 3, 2, hair]] };
    case 'bun':
      return { back: [[1, -3, 6, 6, hair]], top: [[4, -1, 14, 5, hair], [4, 2, 6, 7, hair]] };
    case 'cap':
      return { back: [], top: [[4, -1, 14, 5, cap], [16, 3, 7, 2, shade(cap, -0.3)], [4, 4, 4, 5, hair]] };
    case 'bald':
      return { back: [], top: [] };
    case 'fade':
      return { back: [], top: [[4, -1, 14, 4, hair], [4, 2, 3, 4, shade(hair, 0.35)]] };
    case 'mullet':
      return { back: [[2, 4, 6, 16, hair]], top: [[4, -1, 14, 5, hair], [4, 2, 6, 6, hair], [15, 3, 2, 2, hair]] };
    case 'curly':
      // Rulos (misión 9): una nube de pelo más ancha y alta que la cabeza, con volumen atrás.
      return { back: [[0, -2, 10, 20, hair], [-1, 4, 3, 8, hair]], top: [[3, -3, 16, 6, hair], [2, 1, 8, 9, hair], [16, 2, 3, 4, hair], [8, -4, 4, 2, hair]] };
    default:
      return { back: [], top: [[4, -1, 14, 5, hair], [4, 2, 6, 7, hair], [15, 3, 2, 2, hair]] };
  }
}

/** Cuerpo de perfil con sus facciones (todo menos el brazo de adelante, que va aparte). */
export function drawSideBody(g: Phaser.GameObjects.Graphics, look: HumanLook, opts: SideFigureOpts): void {
  const p = new FigurePainter(g, opts);
  const shirtD = shade(look.shirt, -0.22);
  const pantsD = shade(look.pants, -0.2);
  const shoes = look.shoes ?? '#303038';
  const skinD = shade(look.skin, -0.15);
  const extras = look.extras ?? [];
  const hair = hairParts(look);

  const body: Part[] = [];
  if (extras.includes('backpack')) body.push([0, 17, 6, 15, look.accent ?? '#c87830']);
  body.push([6, 37, 5, 15, pantsD], [6, 51, 7, 4, shade(shoes, -0.2)], [10, 37, 5, 15, look.pants], [10, 51, 8, 4, shoes]);
  if (look.build === 'heavy') body.push([4, 16, 15, 22, look.shirt], [17, 22, 3, 12, look.shirt]);
  else body.push([5, 16, 12, 22, look.shirt]);
  body.push([9, 13, 4, 4, skinD]);
  p.parts(body);
  p.rect(5, 16, 2, 22, shirtD);
  p.rect(5, 36, 12, 1, pantsD);
  if (extras.includes('tie')) p.rect(14, 17, 2, 10, look.accent ?? PAL.red);

  p.parts(hair.back);
  p.parts([
    [5, 0, 13, 14, look.skin],
    [4, 2, 15, 10, look.skin],
    [18, 6, 2, 3, look.skin],
  ]);
  p.parts(hair.top);

  // Facciones: oreja, ceja, ojo, mejilla y boca.
  if (look.hairStyle !== 'long') p.rect(9, 6, 2, 3, skinD);
  p.rect(13, 3, 3, 1, look.hairStyle === 'bald' ? skinD : shade(look.hair, -0.25));
  if (opts.eyes === 'open') {
    p.rect(14, 5, 2, 3, EYE);
    p.rect(14, 5, 1, 1, '#ffffff');
  } else {
    // Ojos cerrados con cariño: una curvita hacia arriba.
    p.rect(13, 6, 1, 1, EYE);
    p.rect(14, 5, 1, 1, EYE);
    p.rect(15, 6, 1, 1, EYE);
  }
  p.rect(12, 8, 2, 1, '#f09090');
  p.rect(15, 10, 1, 1, '#8a3a3a');
  p.rect(16, 11, 2, 1, '#8a3a3a');
  if (look.hairStyle === 'bald') p.rect(8, 1, 3, 1, shade(look.skin, 0.3));
  if (extras.includes('unibrow')) p.rect(10, 3, 8, 2, shade(look.hair, -0.1));
  if (extras.includes('beard')) {
    // Barba de candado: patilla, quijada y mentón (la boca queda a la vista).
    p.rect(11, 7, 1, 4, look.hair);
    p.rect(11, 11, 8, 2, look.hair);
    p.rect(17, 9, 2, 2, look.hair);
    p.rect(15, 10, 2, 1, '#e8a0a0');
  } else if (extras.includes('mustache')) {
    p.rect(14, 9, 5, 2, look.hair);
  }
  if (extras.includes('glasses')) {
    p.rect(12, 4, 5, 1, INK);
    p.rect(12, 8, 5, 1, INK);
    p.rect(12, 4, 1, 5, INK);
    p.rect(16, 4, 1, 5, INK);
    p.rect(8, 5, 4, 1, INK);
  }
}

/** Brazo de adelante: colgando, o estirado alrededor de quien abraza (pasa por encima de su espalda). */
export function drawSideArm(g: Phaser.GameObjects.Graphics, look: HumanLook, opts: SideFigureOpts, hug: boolean): void {
  const p = new FigurePainter(g, opts);
  const sleeve = shade(look.shirt, -0.22);
  if (hug) p.parts([[10, 18, 5, 5, sleeve], [14, 19, 14, 4, sleeve], [28, 19, 3, 4, look.skin]]);
  else p.parts([[9, 17, 4, 15, sleeve], [9, 32, 4, 3, look.skin]]);
}

/** Dónde está el ojo de la figura (en px, relativo a su esquina superior izquierda): de ahí caen las lágrimas. */
export function eyeOffset(opts: SideFigureOpts): { x: number; y: number } {
  const lx = opts.dir === 1 ? 14 : FIGURE_W - 16;
  return { x: Math.round((lx + 1) * opts.scale), y: Math.round(7 * opts.scale) };
}

export const TEAR_COLOR = TEAR;

/** Fondo de la viñeta: el hall del aeropuerto de noche (cielo de madera, ventanal y piso brillante). */
export function drawAirportBackdrop(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#f0eee8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#c89a68'), 1).fillRect(x, y, w, 9);
  g.fillStyle(hex('#9a7048'), 1);
  for (let i = x + 2; i < x + w; i += 5) g.fillRect(i, y, 1, 9);
  // Ventanal a la losa: noche, luces de pista y un avión con las luces encendidas.
  g.fillStyle(hex('#8a8e98'), 1).fillRect(x, y + 16, w, 38);
  g.fillStyle(hex('#141c34'), 1).fillRect(x, y + 18, w, 34);
  g.fillStyle(hex('#2a3048'), 1).fillRect(x, y + 44, w, 8);
  for (let i = x + 6; i < x + w; i += 13) g.fillStyle(hex(i % 2 ? '#f0d048' : '#58c8f0'), 1).fillRect(i, y + 47, 1, 1);
  g.fillStyle(hex('#e8ecf0'), 1).fillRect(x + w - 70, y + 34, 34, 5);
  g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + w - 58, y + 37, 14, 3);
  g.fillStyle(hex('#2f6fd0'), 1).fillRect(x + w - 40, y + 28, 4, 8);
  g.fillStyle(hex('#f04848'), 1).fillRect(x + w - 71, y + 35, 1, 1);
  g.fillStyle(hex('#8a8e98'), 1);
  for (let i = x + 24; i < x + w; i += 30) g.fillRect(i, y + 16, 2, 38);
  // Piso pulido con el reflejo del ventanal.
  g.fillStyle(hex('#e4e0d8'), 1).fillRect(x, y + h - 14, w, 14);
  g.fillStyle(hex('#ccc6ba'), 1).fillRect(x, y + h - 14, w, 1);
  g.fillStyle(hex('#f4f2ec'), 1).fillRect(x + 10, y + h - 9, 40, 1).fillRect(x + w - 60, y + h - 6, 30, 1);
}

// ---------------------------------------------------------------------------
// El dibujo del hermano (lápices de colores sobre papel)
// ---------------------------------------------------------------------------

/** Trazo de lápiz grueso entre dos puntos (Bresenham con punta de 2 px). */
function crayon(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, color: string, size = 2): void {
  g.fillStyle(hex(color), 1);
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x, y, size, size);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Círculo relleno de radio `r` (por filas de 1 px). */
export function disc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle(hex(color), 1);
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** Cara de monito: dos puntos y una sonrisa (o boca triste con lágrima). */
function face(g: Phaser.GameObjects.Graphics, cx: number, cy: number, sad = false): void {
  g.fillStyle(hex(INK), 1).fillRect(cx - 2, cy - 1, 1, 1).fillRect(cx + 2, cy - 1, 1, 1);
  if (sad) {
    g.fillRect(cx - 1, cy + 2, 3, 1);
    g.fillStyle(TEAR, 1).fillRect(cx + 2, cy + 1, 1, 2);
  } else {
    g.fillRect(cx - 2, cy + 1, 1, 1).fillRect(cx - 1, cy + 2, 3, 1).fillRect(cx + 2, cy + 1, 1, 1);
  }
}

/** Monito con piernas de palito; devuelve dónde están sus manos (izquierda y derecha). */
function stickPerson(
  g: Phaser.GameObjects.Graphics,
  x: number,
  feetY: number,
  size: number,
  shirt: string,
  opts: { dress?: boolean; sad?: boolean } = {},
): { head: { x: number; y: number }; left: { x: number; y: number }; right: { x: number; y: number }; shoulder: number } {
  const legH = Math.round(size * 0.38);
  const bodyH = Math.round(size * 0.36);
  const r = Math.round(size * 0.12);
  const hipY = feetY - legH;
  const shoulderY = hipY - bodyH;
  crayon(g, x - 2, hipY, x - 4, feetY, INK);
  crayon(g, x + 2, hipY, x + 4, feetY, INK);
  const half = Math.round(size * 0.13);
  if (opts.dress) {
    for (let i = 0; i <= bodyH; i++) {
      const w = Math.round(2 + (i / bodyH) * half * 1.8);
      g.fillStyle(hex(shirt), 1).fillRect(x - w, shoulderY + i, w * 2 + 1, 1);
    }
  } else {
    g.fillStyle(hex(shirt), 1).fillRect(x - half, shoulderY, half * 2 + 1, bodyH);
    g.fillStyle(hex(shade(shirt, -0.25)), 1).fillRect(x - half, shoulderY + bodyH - 2, half * 2 + 1, 2);
  }
  const headY = shoulderY - r - 1;
  disc(g, x, headY, r + 1, INK);
  disc(g, x, headY, r, '#f4cca4');
  face(g, x, headY, opts.sad);
  return {
    head: { x, y: headY },
    left: { x: x - half - 1, y: shoulderY + 3 },
    right: { x: x + half + 1, y: shoulderY + 3 },
    shoulder: shoulderY,
  };
}

/** Dos monitos de la mano: los brazos se juntan a media altura entre ellos. */
function holdHands(g: Phaser.GameObjects.Graphics, a: { x: number; y: number }, b: { x: number; y: number }): void {
  const mx = Math.round((a.x + b.x) / 2);
  const my = Math.max(a.y, b.y) + 6;
  crayon(g, a.x, a.y, mx, my, INK);
  crayon(g, b.x, b.y, mx, my, INK);
  disc(g, mx, my, 2, '#f4cca4');
}

/**
 * El dibujo del hermano: la familia de la mano, un avión, el sol y «VUELVE PRONTO» con la N al revés.
 * (x, y) = esquina superior izquierda del papel; mide `DRAWING_W` × `DRAWING_H`. El texto lo pone la UI.
 */
export const DRAWING_W = 200;
export const DRAWING_H = 106;

export function drawBrotherDrawing(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const W = DRAWING_W;
  const H = DRAWING_H;
  // Papel con sombra, un doblez y dos tiras de cinta adhesiva.
  g.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 4, W, H);
  g.fillStyle(hex('#fbf6e8'), 1).fillRect(x, y, W, H);
  g.fillStyle(hex('#ece4cc'), 1).fillRect(x + W / 2, y, 1, H);
  g.fillStyle(hex('#f0e8b8'), 0.85).fillRect(x + 10, y - 4, 22, 8).fillRect(x + W - 32, y - 4, 22, 8);

  // Cielo rayado con lápiz celeste.
  for (let i = 0; i < 26; i++) {
    const sx = x + 8 + ((i * 37) % (W - 30));
    const sy = y + 6 + ((i * 13) % 26);
    crayon(g, sx, sy, sx + 10, sy - 4, '#9cd0f0', 1);
  }
  // Sol con cara y rayos.
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    crayon(g, x + 22 + Math.cos(ang) * 11, y + 18 + Math.sin(ang) * 11, x + 22 + Math.cos(ang) * 16, y + 18 + Math.sin(ang) * 16, '#f0c030', 1);
  }
  disc(g, x + 22, y + 18, 8, '#f8d848');
  face(g, x + 22, y + 18);
  // Nube.
  for (const [cx, cy, r] of [[96, 15, 6], [104, 12, 7], [112, 16, 5]] as const) disc(g, x + cx, y + cy, r, '#ffffff');
  // Avión con estela punteada.
  for (let i = 0; i < 8; i++) g.fillStyle(hex('#a8b0c0'), 1).fillRect(x + 128 + i * 4, y + 22 + (i % 2), 2, 1);
  g.fillStyle(hex('#9aa0aa'), 1).fillRect(x + 160, y + 14, 30, 7);
  g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + 160, y + 14, 30, 3);
  g.fillStyle(hex('#2f6fd0'), 1).fillRect(x + 160, y + 8, 5, 7).fillRect(x + 172, y + 20, 8, 3);
  for (let i = 0; i < 5; i++) g.fillStyle(hex('#58a8d8'), 1).fillRect(x + 168 + i * 4, y + 16, 2, 2);
  g.fillStyle(hex('#9aa0aa'), 1).fillRect(x + 189, y + 15, 3, 5);

  // Pasto.
  g.fillStyle(hex('#78c060'), 1).fillRect(x + 2, y + 86, W - 4, H - 88);
  for (let i = 4; i < W - 4; i += 4) crayon(g, x + i, y + 86, x + i + 1, y + 82 - (i % 3), '#58a048', 1);

  // La familia: papá, mamá, el hermano ("YO") y tú, de la mano.
  const feet = y + 84;
  const papa = stickPerson(g, x + 46, feet, 60, '#5a8ad8');
  g.fillStyle(hex('#3a3030'), 1).fillRect(papa.head.x - 6, papa.head.y - 8, 13, 3);
  g.fillStyle(hex(INK), 1).fillRect(papa.head.x - 4, papa.head.y - 2, 3, 1).fillRect(papa.head.x + 1, papa.head.y - 2, 3, 1);
  g.fillStyle(hex('#3a3030'), 1).fillRect(papa.head.x - 2, papa.head.y + 4, 5, 1);
  const mama = stickPerson(g, x + 80, feet, 54, '#3cb4a0', { dress: true });
  for (const dx of [-7, 6]) g.fillStyle(hex('#3a2420'), 1).fillRect(mama.head.x + dx, mama.head.y - 5, 2, 16);
  g.fillStyle(hex('#3a2420'), 1).fillRect(mama.head.x - 6, mama.head.y - 8, 13, 3);
  const yo = stickPerson(g, x + 110, feet, 36, '#f0c030', { sad: true });
  g.fillStyle(hex('#d04848'), 1).fillRect(yo.head.x - 5, yo.head.y - 7, 10, 4).fillRect(yo.head.x + 3, yo.head.y - 5, 5, 2);
  const tu = stickPerson(g, x + 142, feet, 54, '#e05050');
  g.fillStyle(hex('#2f6fd0'), 1).fillRect(tu.head.x - 6, tu.head.y - 9, 12, 5).fillRect(tu.head.x + 4, tu.head.y - 6, 6, 2);
  g.fillStyle(hex('#e8a030'), 1).fillRect(tu.right.x + 1, tu.shoulder + 2, 5, 12);
  holdHands(g, papa.right, mama.left);
  holdHands(g, mama.right, yo.left);
  holdHands(g, yo.right, tu.left);
  // Papá y tú hacen chao con la mano libre.
  crayon(g, papa.left.x, papa.left.y, papa.left.x - 8, papa.left.y - 12, INK);
  disc(g, papa.left.x - 8, papa.left.y - 13, 2, '#f4cca4');
  crayon(g, tu.right.x + 6, tu.right.y, tu.right.x + 13, tu.right.y - 12, INK);
  disc(g, tu.right.x + 13, tu.right.y - 13, 2, '#f4cca4');
  // Un corazón rojo entre todos.
  g.fillStyle(hex('#e04860'), 1).fillRect(x + 92, y + 40, 3, 2).fillRect(x + 96, y + 40, 3, 2).fillRect(x + 92, y + 42, 7, 2).fillRect(x + 93, y + 44, 5, 1).fillRect(x + 94, y + 45, 3, 1).fillRect(x + 95, y + 46, 1, 1);
}

/** Posiciones (relativas al papel) de los nombres que el hermano escribió sobre cada uno. */
export const DRAWING_LABELS: Array<{ x: number; y: number; text: string }> = [
  { x: 46, y: 15, text: 'PAPÁ' },
  { x: 80, y: 22, text: 'MAMÁ' },
  { x: 110, y: 40, text: 'YO' },
  { x: 142, y: 22, text: 'TÚ' },
];
