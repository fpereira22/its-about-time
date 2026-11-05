import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';
import { addG, floatHeart, INK, lerp, popText, type G, type Part } from './vinetas_kit';

/**
 * Viñetas de la calle en Providencia (misión 1):
 *  - quiltro_hueso       el quiltro se come el hueso en dos mordiscos y mueve la cola con corazoncitos
 *  - quiltro_sopaipilla  lo mismo, con media sopaipilla
 * El quiltro se dibuja con una plantilla de "pixeles gordos" (cada unidad = S px) y contorno de 1 px.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

/** Tamaño de la unidad de la plantilla del perro (px). */
const S = 2;
const FUR = '#c89458';
const FUR_D = '#9a6a38';
const SPOT = '#f0e0c0';
const PATCH = '#7a4c28';
const FLOOR_Y = 98;
const DOG = { x: 40, w: 29, h: 16 };
const DOG_Y = FLOOR_Y - DOG.h * S;

// ---------------------------------------------------------------------------
// El quiltro de perfil (mirando a la derecha)
// ---------------------------------------------------------------------------

type Tail = 'up' | 'mid' | 'down';
interface DogPose {
  /** Cabeza agachada (comiendo) o arriba. */
  down: boolean;
  /** Hocico abierto (mordisco). */
  open: boolean;
  tail: Tail;
  /** Ojitos cerrados de felicidad y la lengua afuera. */
  happy: boolean;
}

const TAILS: Record<Tail, Part[]> = {
  up: [[1, 1, 1, 2, FUR], [2, 2, 1, 2, FUR], [3, 3, 2, 2, FUR]],
  mid: [[0, 4, 5, 2, FUR]],
  down: [[3, 5, 2, 2, FUR], [2, 7, 1, 2, FUR], [1, 8, 1, 2, FUR]],
};

/** Pinta piezas de la plantilla (en unidades) con contorno de 1 px: primero los contornos, después los rellenos. */
function dogParts(g: G, parts: Part[], outline = true): void {
  if (outline) {
    g.fillStyle(hex(INK), 1);
    for (const [x, y, w, h] of parts) g.fillRect(x * S - 1, y * S - 1, w * S + 2, h * S + 2);
  }
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(x * S, y * S, w * S, h * S);
}

/** El quiltro: café con una mancha oscura en el lomo, guata y pecho clarito, orejas caídas. Origen = esquina superior izquierda. */
function drawDog(g: G, p: DogPose): void {
  g.clear();
  // Cabeza arriba o agachada (comiendo): se mueve todo lo de la cabeza.
  const hx = p.down ? 1 : 0;
  const hy = p.down ? 5 : 0;
  const head: Part[] = [
    [17 + hx, 0 + hy, 8, 7, FUR],
    [24 + hx, 3 + hy, 4, 3, FUR],
  ];
  const jaw: Part[] = p.open ? [[23 + hx, 7 + hy, 4, 1, FUR]] : [];
  dogParts(g, [
    ...TAILS[p.tail],
    // Patas de atrás (la del otro lado, más oscura) y de adelante.
    [9, 10, 2, 6, FUR_D],
    [13, 10, 2, 6, FUR_D],
    [5, 10, 3, 6, FUR],
    [15, 10, 3, 6, FUR],
    [4, 4, 15, 7, FUR],
    [16, 3 + (p.down ? 2 : 0), 4, 5, FUR],
    ...head,
    ...jaw,
  ]);
  dogParts(
    g,
    [
      // Mancha del lomo, guata y pecho clarito, el hocico claro.
      [8, 4, 5, 3, PATCH],
      [6, 9, 10, 2, SPOT],
      [17, 6, 2, 4, SPOT],
      [24 + hx, 4 + hy, 3, 2, SPOT],
      // Patitas blancas adelante.
      [15, 14, 3, 2, SPOT],
    ],
    false,
  );
  // Oreja caída (va encima de la cabeza).
  dogParts(g, [[18 + hx, 0 + hy, 3, 5, PATCH]]);
  // Ojo, nariz y boca.
  const ink = (x: number, y: number, w = 1, h = 1): void => {
    g.fillStyle(hex(INK), 1).fillRect(x, y, w, h);
  };
  const ex = (22 + hx) * S;
  const ey = (2 + hy) * S;
  if (p.happy) {
    ink(ex - 1, ey + 1);
    ink(ex, ey);
    ink(ex + 1, ey + 1);
  } else {
    ink(ex, ey, 2, 2);
    g.fillStyle(0xffffff, 1).fillRect(ex, ey, 1, 1);
  }
  ink((27 + hx) * S, (3 + hy) * S, 3, 2);
  if (p.open) {
    g.fillStyle(hex('#6a2a2a'), 1).fillRect((23 + hx) * S, (6 + hy) * S, 4 * S, S);
  } else {
    ink((24 + hx) * S + 1, (6 + hy) * S - 1, 5, 1);
  }
  if (p.happy) g.fillStyle(hex('#e86878'), 1).fillRect((25 + hx) * S, (6 + hy) * S, 3, 4);
}

// ---------------------------------------------------------------------------
// La comida (de lado, en pixeles gordos). Origen = centro abajo.
// ---------------------------------------------------------------------------

type Food = 'hueso' | 'sopaipilla';

/** Lo que queda de la comida: 2 = entera, 1 = mordida, 0 = nada. */
function drawFood(g: G, food: Food, left: number): void {
  g.clear();
  if (left <= 0) return;
  if (food === 'hueso') {
    const parts: Part[] = left === 2 ? [[-4, -2, 8, 1, '#f4f0e0'], [-5, -3, 2, 3, '#f4f0e0'], [3, -3, 2, 3, '#f4f0e0']] : [[-1, -2, 2, 1, '#f4f0e0'], [1, -3, 2, 3, '#f4f0e0']];
    dogParts(g, parts);
    g.fillStyle(hex('#d8d0b8'), 1).fillRect(-8, -2, left === 2 ? 16 : 6, 1);
  } else {
    // Media sopaipilla: un semicírculo dorado con pintitas tostadas.
    const parts: Part[] = left === 2 ? [[-4, -2, 7, 2, '#e8a840'], [-3, -3, 5, 1, '#e8a840']] : [[-1, -2, 4, 2, '#e8a840']];
    dogParts(g, parts);
    g.fillStyle(hex('#b87020'), 1).fillRect(-4, -3, 1, 1).fillRect(2, -4, 1, 1).fillRect(left === 2 ? -6 : 0, -2, 1, 1);
  }
}

/** La vereda de Providencia: muro de ladrillo con reja, un árbol y la vereda de pastelones. */
function drawVeredaBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
  // Árbol del fondo.
  g.fillStyle(hex('#5a9a48'), 1).fillRect(x + 150, y + 4, 40, 26).fillRect(x + 146, y + 10, 48, 16);
  g.fillStyle(hex('#4a8a3a'), 1).fillRect(x + 154, y + 20, 30, 6);
  g.fillStyle(hex('#6a4a30'), 1).fillRect(x + 167, y + 28, 5, 30);
  // Muro de ladrillo con reja negra encima.
  g.fillStyle(hex('#c87858'), 1).fillRect(x, y + 50, w, 30);
  g.fillStyle(hex('#a85a40'), 1);
  for (let row = 0; row < 6; row++) {
    g.fillRect(x, y + 50 + row * 5, w, 1);
    for (let i = (row % 2) * 6; i < w; i += 12) g.fillRect(x + i, y + 50 + row * 5, 1, 5);
  }
  g.fillStyle(hex('#2a2a30'), 1).fillRect(x, y + 30, w, 2).fillRect(x, y + 48, w, 2);
  for (let i = x + 3; i < x + w; i += 6) g.fillRect(i, y + 30, 1, 20);
  // Vereda de pastelones y la solera.
  g.fillStyle(hex('#c8c4bc'), 1).fillRect(x, y + 80, w, h - 80);
  g.fillStyle(hex('#a8a49c'), 1).fillRect(x, y + 80, w, 1);
  for (let i = x + 10; i < x + w; i += 24) g.fillRect(i, y + 80, 1, h - 80);
  g.fillStyle(hex('#b4b0a8'), 1).fillRect(x, y + 92, w, 1);
}

/** Le das la comida al quiltro: cae frente a su hocico, se la come en dos mordiscos y mueve la cola feliz. */
function buildQuiltro(kit: VinetaKit, food: Food): void {
  const { scene } = kit;
  const stage = kit.framed(drawVeredaBackdrop);
  const pose: DogPose = { down: false, open: false, tail: 'mid', happy: false };
  const dog = addG(kit, stage, DOG.x, DOG_Y);
  drawDog(dog, pose);

  // Tú, de pie a la derecha, mirando al quiltro.
  const look = playerLook();
  const me: SideFigureOpts = { dir: -1, scale: 1, eyes: 'open' };
  const meX = 150;
  const meTop = FLOOR_Y - FIGURE_H;
  const body = addG(kit, stage, meX, meTop);
  drawSideBody(body, look, me);
  const arm = addG(kit, stage, meX, meTop);
  drawSideArm(arm, look, me, false);

  const meal = addG(kit, stage);
  const fx = scene.add.container(0, 0);
  stage.add(fx);

  // Mientras espera, mueve la cola despacito.
  let wag = 0;
  let wagMs = 260;
  let since = 0;
  kit.every(40, () => {
    since += 40;
    if (since < wagMs) return;
    since = 0;
    wag++;
    pose.tail = (['up', 'mid', 'down', 'mid'] as Tail[])[wag % 4];
    drawDog(dog, pose);
  });

  // La comida sale de tu mano y cae en un arco frente al hocico.
  const from = { x: meX + 8, y: meTop + 34 };
  const to = { x: DOG.x + 31 * S, y: FLOOR_Y };
  drawFood(meal, food, 2);
  meal.setPosition(from.x, from.y);
  kit.after(300, () =>
    kit.progress(
      520,
      (t) => meal.setPosition(lerp(from.x, to.x, t), Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 16)),
      () => {
        playSfx('bump');
        kit.after(250, eat);
      },
    ),
  );

  // Dos mordiscos: agacha la cabeza, ¡ñam!, mastica; ¡ñam!, y se acabó.
  const crumbs = (): void => {
    for (const d of [-4, 3, 6]) {
      const p = scene.add.rectangle(to.x, to.y - 4, 1, 1, hex(food === 'hueso' ? '#f4f0e0' : '#e8a840')).setOrigin(0);
      fx.add(p);
      kit.progress(380, (t) => p.setPosition(Math.round(to.x + d * t), Math.round(to.y - 4 - Math.sin(t * Math.PI) * 5 + 4 * t)), () => p.destroy());
    }
  };
  const bite = (left: number, at: number): void => {
    kit.after(at, () => {
      pose.down = true;
      pose.open = true;
      drawDog(dog, pose);
    });
    kit.after(at + 160, () => {
      pose.open = false;
      drawDog(dog, pose);
      drawFood(meal, food, left);
      playSfx('eat');
      crumbs();
      popText(kit, fx, to.x - 2, to.y - 30, '¡ñam!', '#ffffff', 8, 500);
    });
    // Mastica con la cabeza arriba.
    for (let i = 0; i < 4; i++) {
      kit.after(at + 360 + i * 140, () => {
        pose.down = false;
        pose.open = i % 2 === 0;
        drawDog(dog, pose);
      });
    }
  };
  const eat = (): void => {
    bite(1, 0);
    bite(0, 1050);
    kit.after(2100, () => {
      // ¡Feliz! La cola a toda velocidad, la lengua afuera y corazoncitos.
      pose.down = false;
      pose.open = false;
      pose.happy = true;
      wagMs = 80;
      playSfx('dog');
      kit.every(380, () => floatHeart(kit, fx, DOG.x + 38 + Math.floor(Math.random() * 14), DOG_Y - 4));
      kit.every(1400, () => {
        // Un saltito de alegría.
        kit.progress(260, (t) => dog.setY(DOG_Y - Math.round(Math.sin(t * Math.PI) * 3)));
      });
    });
  };
}

/** Viñetas de la calle, para el registro de src/ui/Vineta.ts. */
export const CALLE_VINETAS: Record<string, VinetaBuilder> = {
  quiltro_hueso: (kit) => buildQuiltro(kit, 'hueso'),
  quiltro_sopaipilla: (kit) => buildQuiltro(kit, 'sopaipilla'),
};
