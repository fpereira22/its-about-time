import { PAL, shade } from './palette';
import { PixelGrid } from './Painter';
import type { Direction } from '../types/map';

/**
 * Personajes procedurales de 16×16.
 *
 * Layout de la hoja (igual al que se espera de Aseprite): 3 columnas × 4 filas.
 *   columnas: 0 = quieto, 1 = paso A, 2 = paso B
 *   filas:    0 = abajo, 1 = izquierda, 2 = derecha, 3 = arriba
 */
export const SHEET_COLS = 3;
export const SHEET_ROWS = 4;
export const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export function frameIndex(dir: Direction, step: 0 | 1 | 2): number {
  return DIR_ROW[dir] * SHEET_COLS + step;
}

export interface HumanLook {
  body?: 'human';
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes?: string;
  /** `fade`: degradado (costados rapados); `mullet`: corto adelante y largo atrás. */
  hairStyle?: 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'fade' | 'mullet';
  cap?: string;
  /** Contextura: "heavy" ensancha el torso; "small" lo hace más bajito (Richi) y "tall", más alto (Juanpa), misión 8. */
  build?: 'normal' | 'heavy' | 'small' | 'tall';
  /** Barba, bigote y monoceja (misión 5: el barbero y Grover); pecas (misión 8). */
  extras?: Array<'tie' | 'glasses' | 'backpack' | 'beard' | 'mustache' | 'unibrow' | 'freckles'>;
  accent?: string;
}

export interface DogLook {
  body: 'dog';
  fur: string;
  spot?: string;
}

/** Pavo real (los del campus de la PUCC, misión 4). `fan`: con la cola abierta. */
export interface PeacockLook {
  body: 'peacock';
  fan?: boolean;
}

export type CharacterLook = HumanLook | DogLook | PeacockLook;

// Plantillas. o=contorno h=pelo s=piel e=ojo c=polera C=polera sombra p=pantalón b=zapato
const HEAD_DOWN = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohssssssho...',
  '...ossessesso...',
  '...osssssssso...',
  '....osssssso....',
];
const HEAD_UP = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '....ohhhhhho....',
];
const HEAD_LEFT = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...osshhhhhho...',
  '...osesshhhho...',
  '...osssssshho...',
  '....osssssso....',
];
const BODY_FRONT = ['....occcccco....', '..osccccccccso..', '..osCccccccCso..', '...oppppppppo...'];
const BODY_SIDE = ['....occcccco....', '....occsccco....', '....occsCCCo....', '....oppppppo....'];
const BODY_FRONT_HEAVY = ['...occcccccco...', '.osccccccccccso.', '.osCccccccccCso.', '..oppppppppppo..'];
const BODY_SIDE_HEAVY = ['...occcccccco...', '...occcscccco...', '...occcsCCCCo...', '...oppppppppo...'];

const LEGS_FRONT: [string[], string[], string[]] = [
  ['....oppooppo....', '....oppooppo....', '....obboobbo....'],
  ['....oppooppo....', '....oppoobbo....', '....obbo........'],
  ['....oppooppo....', '....obbooppo....', '........obbo....'],
];
const LEGS_SIDE: [string[], string[], string[]] = [
  ['.....oppppo.....', '.....oppppo.....', '....obbbbbo.....'],
  ['....oppoppo.....', '...oppo.oppo....', '...obbo.obbo....'],
  ['.....oppppo.....', '....oppoppo.....', '....obbobbo.....'],
];

type Grid = string[][];

function toGrid(rows: string[]): Grid {
  return rows.map((r) => r.split(''));
}

function put(g: Grid, x: number, y: number, ch: string): void {
  if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
}

function humanFrame(dir: 'down' | 'up' | 'left', step: 0 | 1 | 2, look: HumanLook): PixelGrid {
  const head = dir === 'down' ? HEAD_DOWN : dir === 'up' ? HEAD_UP : HEAD_LEFT;
  const heavy = look.build === 'heavy';
  const body = dir === 'left' ? (heavy ? BODY_SIDE_HEAVY : BODY_SIDE) : heavy ? BODY_FRONT_HEAVY : BODY_FRONT;
  const legs = dir === 'left' ? LEGS_SIDE[step] : LEGS_FRONT[step];
  // Bajito: dos filas menos de torso y pantalón, y todo baja dos píxeles (los pies siguen en el suelo).
  const small = look.build === 'small';
  // Alto: la cabeza sube un píxel (la fila vacía de arriba) y el torso crece una fila.
  const tall = look.build === 'tall';
  const parts = small
    ? [...head, body[0], body[2], body[3], legs[1], legs[2]]
    : tall
      ? [...head.slice(1), body[0], body[1], body[1], body[2], body[3], ...legs]
      : [...head, ...body, ...legs];
  const g = toGrid(parts);

  const style = look.hairStyle ?? 'short';
  if (style === 'long') {
    if (dir === 'down') {
      for (const y of [6, 7]) (put(g, 4, y, 'h'), put(g, 11, y, 'h'));
      for (const y of [8, 9]) (put(g, 3, y, 'o'), put(g, 4, y, 'h'), put(g, 11, y, 'h'), put(g, 12, y, 'o'));
    } else if (dir === 'up') {
      for (const y of [8, 9, 10]) {
        put(g, 3, y, 'o');
        for (let x = 4; x <= 11; x++) put(g, x, y, 'h');
        put(g, 12, y, 'o');
      }
    } else {
      put(g, 9, 8, 'h');
      put(g, 10, 8, 'h');
      put(g, 10, 9, 'h');
      put(g, 11, 9, 'o');
    }
  } else if (style === 'bun') {
    for (let x = 6; x <= 9; x++) put(g, x, 0, 'o');
    put(g, 5, 1, 'o');
    put(g, 10, 1, 'o');
    for (let x = 6; x <= 9; x++) put(g, x, 1, 'h');
  } else if (style === 'fade') {
    // Degradado: los costados y la nuca rapados (se ve la piel a través del pelo cortito).
    const rows = dir === 'down' ? [5, 6] : dir === 'up' ? [6, 7, 8] : [5, 6, 7];
    for (const y of rows) for (let x = 0; x < 16; x++) if (g[y][x] === 'h') g[y][x] = 'f';
    if (dir === 'left') for (let x = 6; x < 16; x++) if (g[4][x] === 'h') g[4][x] = 'f';
  } else if (style === 'mullet') {
    // Corto arriba y largo atrás: la melena asoma por la nuca hasta los hombros.
    if (dir === 'down') {
      for (const y of [8, 9]) (put(g, 3, y, 'o'), put(g, 4, y, 'h'), put(g, 11, y, 'h'), put(g, 12, y, 'o'));
    } else if (dir === 'up') {
      for (const y of [8, 9, 10, 11]) {
        put(g, 4, y, 'o');
        for (let x = 5; x <= 10; x++) put(g, x, y, 'h');
        put(g, 11, y, 'o');
      }
    } else {
      for (const [x, y] of [[10, 8], [11, 8], [10, 9], [11, 9], [11, 10]] as const) put(g, x, y, 'h');
      put(g, 12, 9, 'o');
      put(g, 12, 10, 'o');
    }
  } else if (style === 'bald') {
    for (let y = 1; y <= 8; y++) for (let x = 0; x < 16; x++) if (g[y][x] === 'h') g[y][x] = 's';
    put(g, dir === 'left' ? 5 : 6, 2, 'w');
  } else if (style === 'cap') {
    for (let y = 1; y <= 3; y++) for (let x = 0; x < 16; x++) if (g[y][x] === 'h') g[y][x] = 'a';
    for (let x = 0; x < 16; x++) if (g[4][x] === 'h') g[4][x] = 'A';
    if (dir === 'left') (put(g, 2, 4, 'A'), put(g, 2, 3, 'o'), put(g, 1, 4, 'o'), put(g, 2, 5, 'o'));
  }

  const extras = look.extras ?? [];
  if (extras.includes('glasses')) {
    if (dir === 'down') ['e', 'g', 'e', 'e', 'g', 'e'].forEach((ch, i) => put(g, 5 + i, 6, ch));
    else if (dir === 'left') ['e', 'g', 'e'].forEach((ch, i) => put(g, 4 + i, 6, ch));
  }
  if (extras.includes('unibrow')) {
    // Una sola ceja, gruesa, de lado a lado.
    if (dir === 'down') for (let x = 5; x <= 10; x++) put(g, x, 5, 'h');
    else if (dir === 'left') for (let x = 3; x <= 6; x++) put(g, x, 5, 'h');
  }
  if (extras.includes('beard')) {
    if (dir === 'down') {
      for (let x = 4; x <= 11; x++) put(g, x, 7, 'h');
      for (let x = 5; x <= 10; x++) put(g, x, 8, 'h');
      put(g, 7, 7, 'm');
      put(g, 8, 7, 'm');
    } else if (dir === 'left') {
      for (let x = 3; x <= 8; x++) put(g, x, 7, 'h');
      for (let x = 4; x <= 9; x++) put(g, x, 8, 'h');
      put(g, 3, 7, 'm');
    }
  } else if (extras.includes('mustache')) {
    if (dir === 'down') for (let x = 6; x <= 9; x++) put(g, x, 7, 'h');
    else if (dir === 'left') (put(g, 3, 7, 'h'), put(g, 4, 7, 'h'));
  }
  if (extras.includes('tie') && dir === 'down') {
    put(g, 7, 9, 'w');
    put(g, 8, 9, 'w');
    put(g, 7, 10, 't');
    put(g, 8, 10, 't');
    put(g, 7, 11, 't');
  }
  if (extras.includes('backpack')) {
    if (dir === 'up') for (let y = 9; y <= 12; y++) for (let x = 5; x <= 10; x++) put(g, x, y, y === 9 ? 'K' : 'k');
    else if (dir === 'left') for (let y = 9; y <= 11; y++) (put(g, 11, y, 'k'), put(g, 12, y, 'o'));
  }

  if (extras.includes('freckles')) {
    if (dir === 'down') (put(g, 4, 7, 'F'), put(g, 5, 7, 'F'), put(g, 10, 7, 'F'), put(g, 11, 7, 'F'));
    else if (dir === 'left') (put(g, 4, 7, 'F'), put(g, 6, 7, 'F'));
  }
  if (small) g.unshift('................'.split(''), '................'.split(''));

  const shirtShade = shade(look.shirt, -0.22);
  const cap = look.cap ?? PAL.red;
  return PixelGrid.fromTemplate(
    g.map((r) => r.join('')),
    {
      o: PAL.outline,
      h: look.hair,
      s: look.skin,
      e: '#202028',
      c: look.shirt,
      C: shirtShade,
      p: look.pants,
      b: look.shoes ?? '#303038',
      a: cap,
      A: shade(cap, -0.3),
      g: PAL.glassLight,
      f: mix(look.hair, look.skin, 0.55),
      m: '#8a3a3a',
      F: shade(look.skin, -0.22),
      w: PAL.white,
      t: look.accent ?? PAL.red,
      k: look.accent ?? '#c87830',
      K: shade(look.accent ?? '#c87830', 0.25),
    },
  );
}

/** Mezcla dos colores hex (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((sh) => Math.round(((ca >> sh) & 255) * (1 - t) + ((cb >> sh) & 255) * t));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function dogFrame(dir: 'down' | 'up' | 'left', step: 0 | 1 | 2, look: DogLook): PixelGrid {
  const g = new PixelGrid();
  const fur = look.fur;
  const dark = shade(fur, -0.25);
  const light = shade(fur, 0.25);
  const spot = look.spot ?? dark;
  const legShift = step === 1 ? 1 : step === 2 ? -1 : 0;
  if (dir === 'left') {
    g.rect(5, 8, 8, 4, fur).rect(6, 8, 6, 1, light).rect(8, 9, 3, 2, spot);
    g.rect(1, 5, 5, 5, fur).rect(2, 5, 3, 1, light);
    g.rect(3, 3, 2, 3, dark);
    g.set(2, 7, '#202028').set(0, 8, '#202028').set(1, 8, fur);
    g.rect(13, 5, 1, 4, fur).set(14, 4, fur);
    g.rect(6 + legShift, 12, 1, 3, dark).rect(8 - legShift, 12, 1, 3, fur);
    g.rect(10 + legShift, 12, 1, 3, dark).rect(12 - legShift, 12, 1, 3, fur);
  } else if (dir === 'down') {
    g.rect(5, 9, 6, 4, fur).rect(7, 10, 2, 2, spot);
    g.rect(4, 3, 8, 6, fur).rect(5, 3, 6, 1, light);
    g.rect(3, 2, 2, 4, dark).rect(11, 2, 2, 4, dark);
    g.set(6, 5, '#202028').set(9, 5, '#202028').rect(7, 7, 2, 1, '#202028');
    g.rect(5, 13, 1, 2, dark).rect(10, 13, 1, 2, dark);
    if (step !== 0) g.set(step === 1 ? 5 : 10, 14, null);
  } else {
    g.rect(5, 5, 6, 9, fur).rect(6, 8, 4, 3, spot);
    g.rect(5, 2, 6, 4, fur).rect(4, 1, 2, 3, dark).rect(10, 1, 2, 3, dark);
    g.rect(7, 13, 2, 2, fur).set(7 + (step === 2 ? 1 : 0), 15, light);
    g.rect(5, 14, 1, 1, dark).rect(10, 14, 1, 1, dark);
  }
  return g.outline(PAL.outline);
}

const PEA = {
  blue: '#2a5cc8',
  blueLight: '#5aa0f0',
  teal: '#1c8a8a',
  green: '#3c9c48',
  greenDark: '#2a6a34',
  gold: '#e0b840',
  eye: '#1c2a8a',
  beak: '#d8c8a0',
  legs: '#8a8a94',
};

/** Las "ocelos" de la cola: punto dorado con centro azul oscuro. */
function ocellus(g: PixelGrid, x: number, y: number): void {
  g.set(x, y, PEA.gold).set(x + 1, y, PEA.gold).set(x, y + 1, PEA.eye).set(x + 1, y + 1, PEA.gold);
}

function peacockFrame(dir: 'down' | 'up' | 'left', step: 0 | 1 | 2, fan: boolean): PixelGrid {
  const g = new PixelGrid();
  const legShift = step === 1 ? 1 : step === 2 ? -1 : 0;
  if (fan) {
    // La cola abierta como abanico detrás del cuerpo, con dos anillos de ocelos.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 11);
        if (d < 8.2 && y < 11) g.set(x, y, d > 6.5 ? PEA.greenDark : PEA.green);
      }
    }
    for (const [x, y] of [[2, 6], [4, 3], [7, 2], [10, 3], [12, 6]] as const) ocellus(g, x, y);
    for (const [x, y] of [[5, 6], [9, 6]] as const) ocellus(g, x, y);
  }
  if (dir === 'left' && !fan) {
    g.rect(9, 8, 6, 3, PEA.green).rect(10, 11, 5, 1, PEA.greenDark);
    ocellus(g, 11, 8);
    ocellus(g, 13, 9);
    g.rect(4, 8, 6, 4, PEA.teal).rect(5, 7, 4, 1, PEA.teal).rect(5, 8, 2, 1, PEA.blueLight);
    g.rect(3, 5, 2, 4, PEA.blue).rect(2, 2, 3, 3, PEA.blue).set(3, 3, '#202028').set(1, 3, PEA.beak).set(3, 0, PEA.blue).set(4, 1, PEA.blue);
    g.rect(6 + legShift, 12, 1, 3, PEA.legs).rect(8 - legShift, 12, 1, 3, PEA.legs);
    return g.outline(PAL.outline);
  }
  if (dir === 'up' && !fan) {
    g.rect(5, 9, 7, 6, PEA.green).rect(6, 15, 5, 1, PEA.greenDark);
    ocellus(g, 6, 10);
    ocellus(g, 9, 12);
    g.rect(5, 6, 7, 4, PEA.teal).rect(7, 3, 3, 4, PEA.blue).rect(7, 1, 3, 3, PEA.blue).set(7, 0, PEA.blue).set(9, 0, PEA.blue);
    return g.outline(PAL.outline);
  }
  // De frente (o con la cola abierta, que siempre se muestra de frente).
  if (!fan) g.rect(3, 9, 2, 4, PEA.green).rect(12, 9, 2, 4, PEA.green);
  g.rect(5, 8, 7, 5, PEA.teal).rect(6, 7, 5, 1, PEA.teal).rect(7, 9, 3, 2, PEA.blueLight);
  g.rect(7, 4, 3, 4, PEA.blue).rect(7, 2, 3, 3, PEA.blue).set(7, 3, '#202028').set(9, 3, '#202028').set(8, 4, PEA.beak);
  g.set(7, 0, PEA.blue).set(8, 1, PEA.blue).set(9, 0, PEA.blue);
  g.rect(7, 13, 1, 2 + (legShift > 0 ? 0 : 1), PEA.legs).rect(9, 13, 1, 2 + (legShift < 0 ? 0 : 1), PEA.legs);
  return g.outline(PAL.outline);
}

/** Dibuja la hoja completa (48×64) de un personaje en el contexto dado. */
export function drawCharacterSheet(ctx: CanvasRenderingContext2D, look: CharacterLook): void {
  const dirs: Array<'down' | 'left' | 'up'> = ['down', 'left', 'up'];
  for (const dir of dirs) {
    for (const step of [0, 1, 2] as const) {
      const frame =
        look.body === 'dog' ? dogFrame(dir, step, look) : look.body === 'peacock' ? peacockFrame(dir, step, look.fan === true) : humanFrame(dir, step, look);
      frame.draw(ctx, step * 16, DIR_ROW[dir] * 16);
      if (dir === 'left') frame.mirrored().draw(ctx, step * 16, DIR_ROW.right * 16);
    }
  }
}
