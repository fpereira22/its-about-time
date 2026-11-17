import type { HumanLook } from './characters';
import { agua, cielo, cordillera, cuerpo, deBano, guadua, helecho, nubes, roca, selva } from './paseo_art';
import { playerLook } from '../systems/PlayerLook';
import type { Backdrop, VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, floatHeart, popText, sparkle, type G, type Layer } from './vinetas_kit';
import { bust, INK, lookOf } from './vinetas_m5';
import { sinGorro } from './vinetas_m7';
import { BACKDROPS, compose, PROPS, type Prop, type Spec } from './vinetas_m8';
import { M11_SPECS } from './vinetas_m11_specs';

/**
 * Viñetas del lunes festivo de la misión 10 (prefijo m11_): La Vorágine y la Chorrera del Indio. Reemplaza los
 * fondos planos del paseo (el pueblo, el pozo, la Chorrera, el sendero, el mirador) por unos con capas, suma fondos
 * nuevos (la playa de piedras, la calle de los puestos, la truchera de don Efraín) y les pone movimiento encima: el
 * agua que corre, la cortina de la Chorrera, la neblina, las hojas que caen y los niños que se tiran del puente.
 * También van las escenas propias de los patitos, la truchera, el barranquero, la perrita canela y el mango biche.
 * Panel de 220 × 108 px.
 */

const W = 220;
const H = 108;

const me = (): HumanLook => sinGorro(playerLook());
const laura = (): HumanLook => lookOf('laura');
const lauraBano = (): HumanLook => lookOf('laura_bano');

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function casas(g: G, x: number, base: number, n: number, gap = 34): void {
  const walls = ['#f4f0e6', '#f8e8a8', '#f4f0e6', '#e8dcc8', '#f8f0e0'];
  const doors = ['#2c9c58', '#c8303c', '#2c64c0', '#e8b828', '#7c3ca8'];
  for (let i = 0; i < n; i++) {
    const hx = x + i * gap;
    g.fillStyle(hex(INK), 1).fillRect(hx - 1, base - 15, 30, 16);
    g.fillStyle(hex(walls[i % 5]), 1).fillRect(hx, base - 14, 28, 14);
    g.fillStyle(hex('#9c4428'), 1).fillTriangle(hx - 4, base - 13, hx + 14, base - 24, hx + 32, base - 13);
    g.fillStyle(hex('#b8542c'), 1).fillRect(hx - 3, base - 15, 34, 2);
    g.fillStyle(hex(doors[i % 5]), 1).fillRect(hx + 3, base - 9, 6, 9).fillRect(hx + 15, base - 10, 9, 5);
    g.fillStyle(hex(INK), 1).fillRect(hx + 19, base - 10, 1, 5);
  }
}

function puente(g: G, x: number, y: number, w: number): void {
  g.fillStyle(hex('#6c6c68'), 1);
  for (let px = x + 12; px < x + w; px += 40) g.fillRect(px, y + 5, 5, 14);
  g.fillStyle(hex('#8c8c88'), 1).fillRect(x, y, w, 6);
  g.fillStyle(hex('#b8b8b0'), 1).fillRect(x, y - 3, w, 3);
  for (let px = x; px < x + w; px += 6) g.fillStyle(hex('#a8a8a0'), 1).fillRect(px, y - 7, 1, 4);
}

function bosqueFondo(g: G, x: number, y: number, w: number, h: number, t = 0): void {
  selva(g, x, w, y + 8, '#2c5a30', 11, 3, t);
  selva(g, x, w, y + 22, '#3c7a3c', 9, 7, t);
  g.fillStyle(hex('#3c7a3c'), 1).fillRect(x, y + 30, w, h - 30);
}

/** Un barranquero (pájaro verde y azul con la cola de péndulo). */
function barranquero(g: G, cx: number, cy: number, swing: number): void {
  g.fillStyle(hex('#2c64c0'), 1).fillRect(cx - 1 + Math.round(swing * 3), cy + 6, 2, 9);
  g.fillStyle(hex('#5ab8c8'), 1).fillRect(cx - 2 + Math.round(swing * 4), cy + 14, 4, 3);
  g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 10, 12);
  g.fillStyle(hex('#4c9c48'), 1).fillEllipse(cx, cy, 8, 10);
  g.fillStyle(hex('#2c64c0'), 1).fillRect(cx - 3, cy - 6, 6, 3);
  g.fillStyle(hex('#1c1418'), 1).fillRect(cx - 4, cy - 3, 8, 2);
  g.fillStyle(hex('#e8c030'), 1).fillRect(cx + 1, cy - 3, 1, 1);
  g.fillStyle(hex('#3a3a30'), 1).fillTriangle(cx + 3, cy - 2, cx + 8, cy - 1, cx + 3, cy);
  g.fillStyle(hex('#c87838'), 1).fillRect(cx - 2, cy + 2, 4, 3);
}

/** La perrita criolla color canela (de frente, sentada). */
function canela(g: G, cx: number, cy: number, s: number, wag: number): void {
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  r(6 + wag, 6, 6, 2, '#b07838');
  r(-7, 2, 14, 12, INK);
  r(-6, 3, 12, 10, '#c89458');
  r(-3, 7, 6, 6, '#f0e0c0');
  r(-6, -9, 12, 11, INK);
  r(-5, -8, 10, 9, '#c89458');
  r(-7, -12, 4, 6, INK);
  r(-6, -11, 2, 5, '#b07838');
  r(3, -9, 5, 3, INK);
  r(4, -8, 4, 2, '#b07838');
  r(-3, -5, 2, 2, '#1c1418');
  r(1, -5, 2, 2, '#1c1418');
  r(-2, -2, 4, 3, '#f0e0c0');
  r(-1, -2, 2, 1, '#1c1418');
  r(-1, 0, 2, 2, '#e86878');
}

// ---------------------------------------------------------------------------
// Fondos (reemplazan los planos del paseo y suman los nuevos)
// ---------------------------------------------------------------------------

const PASEO_BACKDROPS: Record<string, Backdrop> = {
  voragine: (g, x, y, w, h) => {
    cielo(g, x, y, w, 50, '#68a8e0', '#d4ecf6', 7);
    nubes(g, w, 0, y + 10, 3, 0.85);
    cordillera(g, x - 10, w + 20, y + 44, 26, '#7896ac', 2);
    selva(g, x, w, y + 46, '#3c7a40', 8, 4);
    casas(g, x + 8, y + 72, 4, 36);
    for (let i = 0; i < 4; i++) guadua(g, x + 150 + i * 18, y + 74, 30 + (i % 2) * 8, 0);
    puente(g, x + 120, y + 76, 100);
    g.fillStyle(hex('#5aa04a'), 1).fillRect(x, y + 72, w, 8);
    agua(g, x, y + 80, w, 16, 0, '#2f8a9c');
    g.fillStyle(hex('#a8a090'), 1).fillRect(x, y + 94, w, h - 94);
    for (let i = 0; i < 30; i++) g.fillStyle(hex(['#8c8478', '#b8b0a0', '#9c9488'][i % 3]), 1).fillEllipse(x + ((i * 37) % w), y + 97 + ((i * 7) % 10), 6, 3);
  },
  playa_voragine: (g, x, y, w, h) => {
    cielo(g, x, y, w, 46, '#68a8e0', '#d4ecf6', 7);
    nubes(g, w, 3, y + 8, 3, 0.85);
    cordillera(g, x - 10, w + 20, y + 40, 22, '#7896ac', 5);
    selva(g, x, w, y + 44, '#3c7a40', 8, 2);
    casas(g, x + 96, y + 62, 3, 40);
    puente(g, x, y + 58, 90);
    g.fillStyle(hex('#8c9c78'), 1).fillRect(x, y + 62, w, 4);
    agua(g, x, y + 66, w, 22, 0, '#2f8a9c');
    g.fillStyle(hex('#b0a898'), 1).fillRect(x, y + 86, w, h - 86);
    for (let i = 0; i < 44; i++) g.fillStyle(hex(['#8c8478', '#c8c0b0', '#9c9488', '#a8a090'][i % 4]), 1).fillEllipse(x + ((i * 29) % w), y + 89 + ((i * 13) % 18), 7 + (i % 3), 3 + (i % 2));
    g.fillStyle(0xe8f8f4, 0.6).fillRect(x, y + 86, w, 1);
  },
  pueblo_voragine: (g, x, y, w, h) => {
    cielo(g, x, y, w, 40, '#68a8e0', '#d4ecf6', 6);
    cordillera(g, x - 10, w + 20, y + 34, 20, '#7896ac', 8);
    selva(g, x, w, y + 36, '#3c7a40', 8, 6);
    casas(g, x + 2, y + 66, 6, 37);
    // Toldos de los puestos.
    for (const [px, c1, c2] of [[18, '#c8303c', '#f4f0e6'], [92, '#2c9c58', '#f8e070'], [166, '#2c64c0', '#f4f0e6']] as const) {
      for (let i = 0; i < 6; i++) g.fillStyle(hex(i % 2 ? c1 : c2), 1).fillRect(x + px + i * 6, y + 44, 6, 6);
      g.fillStyle(hex('#6a4428'), 1).fillRect(x + px, y + 50, 2, 20).fillRect(x + px + 34, y + 50, 2, 20);
    }
    g.fillStyle(hex('#4a4a54'), 1).fillRect(x, y + 70, w, h - 70);
    for (let i = 0; i < 8; i++) g.fillStyle(hex('#f8f4e0'), 1).fillRect(x + 6 + i * 28, y + 88, 14, 2);
  },
  pozo: (g, x, y, w, h) => {
    cielo(g, x, y, w, 26, '#78b4e4', '#d8eef6', 4);
    g.fillStyle(hex('#4a5248'), 1).fillRect(x, y + 18, w, 60);
    bosqueFondo(g, x, y + 10, w, 50);
    g.fillStyle(hex('#5a5e58'), 1).fillRect(x + 120, y + 30, 26, 44);
    g.fillStyle(hex('#d8eef4'), 0.95).fillRect(x + 128, y + 30, 10, 48);
    agua(g, x, y + 70, w, h - 70, 0, '#1f6a74');
    g.fillStyle(hex('#0c3c54'), 0.4).fillEllipse(x + 110, y + 92, 130, 26);
    roca(g, x + 22, y + 74, 64, 36, '#7c786c');
    roca(g, x + 200, y + 70, 60, 42, '#8c867c');
    for (let i = 0; i < 4; i++) helecho(g, x + 10 + i * 60, y + 64, 0.8, '#4c9c48');
  },
  chorrera: (g, x, y, w, h) => {
    cielo(g, x, y, w, 12, '#8cc4e8', '#e0f0f8', 3);
    selva(g, x, w, y + 6, '#2c5a30', 9, 2);
    g.fillStyle(hex('#26282c'), 1).fillRect(x, y + 12, w, 74);
    for (let i = 0; i < 26; i++) {
      const bx = x + ((i * 53) % w);
      const by = y + 14 + ((i * 37) % 64);
      g.fillStyle(hex(i % 3 ? '#33363b' : '#2c2e33'), 1).fillRect(bx, by, 18 + (i % 4) * 5, 8 + (i % 3) * 3);
      if (i % 4 === 0) g.fillStyle(hex('#3c6a34'), 1).fillRect(bx + 2, by, 9, 2);
    }
    for (let i = 0; i < 4; i++) helecho(g, x + (i < 2 ? 12 + i * 30 : 160 + (i - 2) * 34), y + 30 + (i % 2) * 22, 0.8, '#3c8c3c');
    for (let i = 0; i < 2; i++) g.fillStyle(0xfff8d0, 0.08).fillTriangle(x + 30 + i * 30, y + 12, x + 50 + i * 30, y + 12, x + 90 + i * 40, y + 86);
    for (let yy = y + 12; yy < y + 84; yy += 4) {
      const ww = 38 + (yy - y) * 0.12 + Math.sin(yy * 0.3) * 2;
      g.fillStyle(hex('#dff0f6'), 0.96).fillRect(x + w / 2 - ww / 2, yy, ww, 4);
    }
    const colors = [0xe85a5a, 0xf8a040, 0xf8e070, 0x58c858, 0x4a9ad8];
    colors.forEach((c, i) => {
      g.lineStyle(1, c, 0.22);
      g.beginPath();
      g.arc(x + w / 2 - 30, y + 96, 44 - i * 1.5, Math.PI * 1.05, Math.PI * 1.45, false);
      g.strokePath();
    });
    agua(g, x, y + 82, w, h - 82, 0, '#1f6a80');
    g.fillStyle(0xf4fafc, 0.75).fillEllipse(x + w / 2, y + 84, 96, 9);
  },
  chorrera_bosque: (g, x, y, w, h) => {
    cielo(g, x, y, w, 24, '#9cc8e0', '#d8ecf4', 4);
    bosqueFondo(g, x, y + 6, w, h);
    for (let i = 0; i < 6; i++) guadua(g, x + 8 + i * 40 + (i % 2) * 8, y + 84, 54 + (i % 3) * 8, 0);
    g.fillStyle(hex('#8c6a44'), 1).fillTriangle(x + 80, y + h, x + 150, y + h, x + 112, y + 58);
    g.fillStyle(hex('#a07c54'), 1).fillTriangle(x + 92, y + h, x + 136, y + h, x + 112, y + 62);
    for (let i = 0; i < 5; i++) helecho(g, x + 20 + i * 46, y + h - 4, 1, i % 2 ? '#4c9c48' : '#3c8c3c');
    // El letrero de madera.
    g.fillStyle(hex('#6a4428'), 1).fillRect(x + 172, y + 56, 3, 36);
    g.fillStyle(hex(INK), 1).fillRect(x + 156, y + 52, 40, 11);
    g.fillStyle(hex('#c8a070'), 1).fillRect(x + 157, y + 53, 38, 9);
    g.fillStyle(hex('#6a4428'), 1).fillRect(x + 160, y + 56, 26, 1).fillRect(x + 160, y + 58, 20, 1).fillTriangle(x + 188, y + 55, x + 192, y + 57.5, x + 188, y + 60);
    for (let i = 0; i < 6; i++) g.fillStyle(0xfff8d0, 0.12).fillCircle(x + 20 + i * 36, y + 70 + (i % 3) * 8, 5);
  },
  mirador_pance: (g, x, y, w) => {
    cielo(g, x, y, w, 50, '#5ca0dc', '#e0eef6', 7);
    nubes(g, w, 6, y + 10, 3, 0.85);
    cordillera(g, x - 10, w + 20, y + 40, 28, '#7896ac', 1);
    g.fillStyle(hex('#7cac68'), 1).fillRect(x, y + 38, w, 40);
    g.fillStyle(hex('#e0e8f0'), 0.35).fillRect(x + 130, y + 36, 90, 10);
    for (let i = 0; i < 18; i++) g.fillStyle(hex('#d8d4cc'), 0.8).fillRect(x + 150 + (i % 9) * 7, y + 40 - Math.floor(i / 9) * 4 - (i % 3) * 2, 5, 4 + (i % 3) * 2);
    g.lineStyle(2, hex('#c8e4f0'), 1);
    g.beginPath().moveTo(x, y + 66).lineTo(x + 50, y + 58).lineTo(x + 110, y + 64).lineTo(x + 220, y + 50).strokePath();
    selva(g, x, w, y + 70, '#4c8c40', 9, 5);
    selva(g, x, w, y + 84, '#3c7a3c', 11, 9);
    // La baranda de madera del mirador.
    g.fillStyle(hex('#6a4428'), 1).fillRect(x, y + 92, w, 3).fillRect(x, y + 100, w, 2);
    for (let px = x + 6; px < x + w; px += 26) g.fillStyle(hex('#5a3820'), 1).fillRect(px, y + 90, 3, 18);
  },
  truchera: (g, x, y, w, h) => {
    g.fillStyle(hex('#5a9c4a'), 1).fillRect(x, y, w, h);
    selva(g, x, w, y + 4, '#2c6a34', 10, 4);
    for (let i = 0; i < 6; i++) guadua(g, x + 6 + i * 40, y + 40, 32, 0);
    g.fillStyle(hex(INK), 1).fillRect(x + 172, y + 14, 40, 26);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 173, y + 19, 38, 20);
    g.fillStyle(hex('#9c4428'), 1).fillTriangle(x + 168, y + 20, x + 192, y + 6, x + 216, y + 20);
    g.fillStyle(hex('#2c64c0'), 1).fillRect(x + 192, y + 24, 14, 7);
    g.fillStyle(hex(INK), 1).fillRoundedRect(x + 8, y + 52, 160, 54, 6);
    g.fillStyle(hex('#b8b4a8'), 1).fillRoundedRect(x + 9, y + 53, 158, 52, 5);
    agua(g, x + 14, y + 58, 148, 42, 0, '#2a6a6c', -1, 6);
    for (const [fx, fy] of [[40, 70], [90, 84], [130, 66], [70, 92]] as const) {
      g.fillStyle(hex('#183c3c'), 0.8).fillEllipse(x + fx, y + fy, 14, 4);
      g.fillTriangle(x + fx - 7, y + fy, x + fx - 11, y + fy - 3, x + fx - 11, y + fy + 3);
    }
  },
};
Object.assign(BACKDROPS, PASEO_BACKDROPS);

// ---------------------------------------------------------------------------
// Movimiento encima de los fondos (debajo de los personajes)
// ---------------------------------------------------------------------------

type Anim = (kit: VinetaKit, stage: Layer) => void;

function waterAnim(y0: number, h: number, color = 0xe8f8f4, dir = 1): Anim {
  return (kit, stage) => {
    const g = addG(kit, stage);
    let t = 0;
    kit.every(70, () => {
      t++;
      g.clear();
      for (let r = 0; r < Math.max(1, h / 5); r++) {
        for (let i = 0; i < 7; i++) {
          const px = (((i * 37 + r * 19 + dir * t * (2 + (r % 2))) % (W + 30)) + W + 30) % (W + 30) - 15;
          g.fillStyle(color, 0.55).fillRect(px, y0 + 2 + r * 5, 6 + ((i + r) % 3) * 3, 1);
        }
      }
    });
  };
}

const ANIM: Record<string, Anim> = {
  voragine: (kit, stage) => {
    waterAnim(80, 14)(kit, stage);
    // Un niño que se tira del puente cada tanto.
    const kid = addG(kit, stage);
    let t = 0;
    kit.every(60, () => {
      t = (t + 1) % 70;
      kid.clear();
      if (t < 16) {
        const k = t / 16;
        kid.fillStyle(hex('#d88848'), 1).fillRect(176 + k * 10, 70 + k * k * 18 - Math.sin(k * Math.PI) * 6, 3, 5);
      } else if (t < 26) {
        const k = (t - 16) / 10;
        kid.fillStyle(0xffffff, 1 - k).fillEllipse(187, 88, 6 + k * 12, 2 + k * 3);
      }
    });
  },
  playa_voragine: waterAnim(66, 20),
  pueblo_voragine: (kit, stage) => {
    const g = addG(kit, stage);
    let t = 0;
    kit.every(120, () => {
      t++;
      g.clear();
      for (let i = 0; i < 3; i++) g.fillStyle(0xffffff, 0.25).fillCircle(40 + i * 70, 40 - ((t * 2 + i * 9) % 20), 2 + ((t + i) % 3));
    });
  },
  pozo: waterAnim(72, 34),
  chorrera: (kit, stage) => {
    const g = addG(kit, stage);
    let t = 0;
    kit.every(50, () => {
      t++;
      g.clear();
      for (let i = 0; i < 20; i++) g.fillStyle(i % 3 ? 0xb8dce8 : 0xffffff, 1).fillRect(W / 2 - 18 + ((i * 7) % 36), 12 + ((i * 13 + t * 5) % 72), 1, 6 + (i % 3) * 2);
      for (let i = 0; i < 9; i++) g.fillStyle(0xf4fafc, 0.35).fillCircle(W / 2 - 50 + ((i * 23 + t) % 100), 84 - ((i * 7 + t * 0.8) % 22), 2 + (i % 3));
    });
    waterAnim(86, 20)(kit, stage);
  },
  chorrera_bosque: (kit, stage) => {
    const g = addG(kit, stage);
    let t = 0;
    kit.every(80, () => {
      t++;
      g.clear();
      for (let i = 0; i < 5; i++) {
        const y = ((t * 1.2 + i * 23) % 110) - 4;
        const x = (i * 47 + Math.sin((t + i * 10) / 8) * 8) % W;
        g.fillStyle(i % 2 ? 0x8cbc4c : 0xc8a040, 1).fillRect(x, y, 3, 2);
      }
    });
  },
  mirador_pance: (kit, stage) => {
    const g = addG(kit, stage);
    let t = 0;
    kit.every(90, () => {
      t++;
      g.clear();
      const bx = ((t * 1.5) % (W + 40)) - 20;
      const flap = t % 6 < 3 ? -2 : 1;
      g.lineStyle(1, 0x2a2433, 1).lineBetween(bx - 4, 20 + flap, bx, 22).lineBetween(bx, 22, bx + 4, 20 + flap);
      g.lineBetween(bx + 20, 28 + flap, bx + 23, 30).lineBetween(bx + 23, 30, bx + 26, 28 + flap);
    });
  },
  truchera: waterAnim(58, 40, 0xc8eef0, -1),
};

function framedWith(kit: VinetaKit, b: string): VinetaKit {
  const anim = ANIM[b];
  if (!anim) return kit;
  return {
    ...kit,
    framed: (bd) => {
      const st = kit.framed(bd);
      anim(kit, st);
      return st;
    },
  };
}

function composeAnim(spec: Spec): VinetaBuilder {
  const base = compose(spec);
  return (kit) => base(framedWith(kit, spec.b));
}

// ---------------------------------------------------------------------------
// Objetos nuevos
// ---------------------------------------------------------------------------

const PASEO_PROPS: Record<string, Prop> = {
  cholado: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillRect(cx - 9, cy - 10, 18, 22);
    g.fillStyle(hex('#e8f4f8'), 0.9).fillRect(cx - 8, cy - 9, 16, 20);
    g.fillStyle(hex('#e8603c'), 1).fillRect(cx - 7, cy + 2, 14, 8);
    g.fillStyle(hex('#f8d048'), 1).fillRect(cx - 7, cy - 3, 14, 5);
    g.fillStyle(hex('#f8f4e8'), 1).fillEllipse(cx, cy - 10, 20, 8);
    for (const [px, c] of [[-5, '#c8303c'], [0, '#58b848'], [4, '#7c3ca8']] as const) disc(g, cx + px, cy - 12, 2, c);
    g.fillStyle(hex('#c89048'), 1).fillRect(cx + 3, cy - 18, 3, 8);
  },
  balde: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillRect(cx - 11, cy - 8, 22, 18);
    g.fillStyle(hex('#4a7ad8'), 1).fillRect(cx - 10, cy - 7, 20, 16);
    g.fillStyle(hex('#2a7c94'), 1).fillRect(cx - 9, cy - 6, 18, 4);
    g.lineStyle(1, hex(INK), 1).strokeEllipse(cx, cy - 12, 22, 10);
    for (const dx of [-4, 4]) {
      g.fillStyle(hex('#9cb4a8'), 1).fillEllipse(cx + dx, cy - 8, 10, 4);
      g.fillStyle(hex('#e87878'), 1).fillRect(cx + dx - 3, cy - 8, 6, 1);
    }
  },
  cana: (g, cx, cy) => {
    g.lineStyle(2, hex('#6a4428'), 1).lineBetween(cx - 14, cy + 12, cx + 14, cy - 16);
    g.lineStyle(1, hex('#e8e8e0'), 1).lineBetween(cx + 14, cy - 16, cx + 18, cy + 8);
    disc(g, cx + 18, cy + 9, 2, '#d83c30');
  },
  libro: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillRect(cx - 9, cy - 11, 18, 22);
    g.fillStyle(hex('#2c6a34'), 1).fillRect(cx - 8, cy - 10, 16, 20);
    g.fillStyle(hex('#e8c060'), 1).fillRect(cx - 5, cy - 6, 10, 1).fillRect(cx - 5, cy - 3, 8, 1).fillRect(cx - 5, cy + 5, 10, 1);
  },
};
Object.assign(PROPS, PASEO_PROPS);

// ---------------------------------------------------------------------------
// Escenas propias
// ---------------------------------------------------------------------------

/** Patitos: la piedra que rebota en el río, con sus ondas. */
function patitos(text?: string, cast: 'laura' | 'los_dos' = 'laura'): VinetaBuilder {
  return (kit) => {
    const stage = framedWith(kit, 'playa_voragine').framed(BACKDROPS.playa_voragine);
    const g = addG(kit, stage);
    if (cast === 'los_dos') {
      cuerpo(g, laura(), 40, 52, 1.1, { pose: 'lanza', mouth: 'teeth' });
      cuerpo(g, me(), 74, 50, 1.1, { mouth: 'o' });
    } else cuerpo(g, laura(), 46, 52, 1.1, { pose: 'lanza', mouth: 'teeth' });
    const st = addG(kit, stage);
    const loop = (): void => {
      kit.progress(2200, (k) => {
        st.clear();
        const x = 66 + k * 150;
        const hops = 7;
        const ph = (k * hops) % 1;
        const amp = 10 * (1 - k);
        const y = 76 - Math.sin(ph * Math.PI) * amp;
        st.fillStyle(hex(INK), 1).fillEllipse(x, y, 6, 3);
        st.fillStyle(hex('#9ca4a4'), 1).fillEllipse(x, y - 0.5, 4, 1.5);
        for (let i = 0; i < Math.floor(k * hops); i++) {
          const rx = 66 + ((i + 1) / hops) * 150;
          const age = k - (i + 1) / hops;
          st.lineStyle(1, 0xe8f8f4, Math.max(0, 0.9 - age * 3)).strokeEllipse(rx, 77, 6 + age * 60, 2 + age * 10);
        }
      }, () => kit.after(600, loop));
    };
    loop();
    if (text) kit.after(300, () => popText(kit, stage, W / 2, 6, text, '#fff2a0', 10, 0));
  };
}

const gana: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'playa_voragine').framed(BACKDROPS.playa_voragine);
  const g = addG(kit, stage);
  cuerpo(g, laura(), 70, 46, 1.3, { mouth: 'o', eyes: 'squint' });
  cuerpo(g, me(), 140, 44, 1.3, { pose: 'arriba', mouth: 'grin' });
  kit.every(900, () => sparkle(kit, stage, 140 + Math.random() * 20, 40));
  kit.after(300, () => popText(kit, stage, W / 2, 6, '¡8!', '#fff2a0', 12, 0));
};

const ensenaMano: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'playa_voragine').framed(BACKDROPS.playa_voragine);
  const g = addG(kit, stage);
  // Primer plano: las dos manos y la piedra plana.
  const sk = laura().skin;
  const mk = me().skin;
  g.fillStyle(hex(INK), 1).fillRoundedRect(58, 54, 70, 30, 10);
  g.fillStyle(hex(mk), 1).fillRoundedRect(59, 55, 68, 28, 9);
  for (let i = 0; i < 3; i++) g.fillStyle(hex(mk), 1).fillRoundedRect(122, 58 + i * 8, 22, 7, 3);
  g.fillStyle(hex(INK), 1).fillEllipse(140, 52, 30, 12);
  g.fillStyle(hex('#8c9494'), 1).fillEllipse(140, 51, 27, 9);
  g.fillStyle(hex('#b8c0c0'), 1).fillEllipse(135, 49, 12, 3);
  g.fillStyle(hex(INK), 1).fillRoundedRect(100, 30, 64, 24, 9);
  g.fillStyle(hex(sk), 1).fillRoundedRect(101, 31, 62, 22, 8);
  for (let i = 0; i < 3; i++) g.fillStyle(hex(sk), 1).fillRoundedRect(92 - i * 2, 34 + i * 7, 14, 6, 3);
  kit.every(1100, () => floatHeart(kit, stage, 130 + Math.random() * 20, 30));
};

const truchera: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'truchera').framed(BACKDROPS.truchera);
  const g = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t++;
    g.clear();
    const dip = t % 40 > 34 ? 3 : t % 40 > 30 ? 1 : 0;
    g.lineStyle(1, 0xe8e8e0, 0.9).lineBetween(200, 50, 96, 76 + dip);
    disc(g, 96, 77 + dip, 2, '#f4f0e6');
    g.fillStyle(hex('#d83c30'), 1).fillRect(94, 74 + dip, 4, 2);
    g.lineStyle(1, 0xe8f8f4, 0.6).strokeEllipse(96, 79, 10 + (t % 10), 3);
  });
  const c = addG(kit, stage);
  bust(c, deBano(me()), 196, 66, 2.4, { mouth: 'o' });
  bust(c, lauraBano(), 178, 74, 2.2, { mouth: 'smile', eyes: 'squint' });
  c.lineStyle(2, hex('#6a4428'), 1).lineBetween(184, 92, 202, 48);
};

const balde: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'truchera').framed(BACKDROPS.truchera);
  const g = addG(kit, stage);
  cuerpo(g, lauraBano(), 92, 30, 1.6, { pose: 'arriba', mouth: 'teeth', mojado: true });
  const b = addG(kit, stage);
  kit.progress(700, (k) => {
    b.clear();
    PROPS.balde(b, 92, 22 - k * 6);
  });
  cuerpo(g, lookOf('efren'), 170, 40, 1.2, { mouth: 'grin' });
  kit.every(500, () => sparkle(kit, stage, 70 + Math.random() * 50, 10 + Math.random() * 20));
};

const barranqueroV: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'chorrera_bosque').framed(BACKDROPS.chorrera_bosque);
  const bg = addG(kit, stage);
  bg.lineStyle(3, hex('#5a9c3c'), 1).lineBetween(0, 40, 140, 30);
  const g = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t++;
    g.clear();
    barranquero(g, 110, 22, Math.sin(t / 6));
  });
  kit.after(400, () => popText(kit, stage, W / 2, 80, 'tic... tac...', '#fff2a0', 8, 0));
};

const fotoPajaro: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x, y, w, h);
  });
  const g = addG(kit, stage);
  g.fillStyle(hex('#f8f8f4'), 1).fillRect(40, 6, 140, 96);
  BACKDROPS.chorrera_bosque(g, 46, 12, 128, 72);
  g.fillStyle(0xffffff, 0.35).fillRect(46, 12, 128, 72);
  barranquero(g, 140, 26, 0.6);
  bust(g, lauraBano(), 84, 62, 2.2, { mouth: 'o', eyes: 'open' });
  kit.after(200, () => popText(kit, stage, W / 2, 88, 'Pance · el barranquero (y Laura)', '#2a2433', 7, 0));
  const flash = addG(kit, stage);
  kit.progress(400, (k) => flash.clear().fillStyle(0xffffff, 1 - k).fillRect(0, 0, W, H));
};

const canelaV: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'pueblo_voragine').framed(BACKDROPS.pueblo_voragine);
  const g = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t++;
    g.clear();
    canela(g, W / 2, 72, 3, Math.round(Math.sin(t) * 2));
  });
};

const canelaLaura: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'pueblo_voragine').framed(BACKDROPS.pueblo_voragine);
  const c = addG(kit, stage);
  bust(c, laura(), 80, 58, 3, { mouth: 'teeth', eyes: 'squint' });
  const g = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t++;
    g.clear();
    canela(g, 150, 76, 2.4, Math.round(Math.sin(t) * 2));
  });
  kit.every(1000, () => floatHeart(kit, stage, 150, 40));
};

const mangoCara: VinetaBuilder = (kit) => {
  const stage = framedWith(kit, 'pueblo_voragine').framed(BACKDROPS.pueblo_voragine);
  const g = addG(kit, stage);
  bust(g, laura(), W / 2, 56, 4.2, { mouth: 'o', eyes: 'squint' });
  // Toda la cara arrugada.
  g.fillStyle(hex('#c8a090'), 1).fillRect(W / 2 - 8, 36, 16, 1).fillRect(W / 2 - 6, 39, 12, 1);
  PROPS.mango?.(g, W / 2 + 34, 80);
  const shake = addG(kit, stage);
  kit.every(140, () => {
    shake.clear();
    shake.lineStyle(1, hex(INK), 1);
    for (const s of [-1, 1]) shake.lineBetween(W / 2 + s * 26, 34 + Math.random() * 4, W / 2 + s * 32, 30 + Math.random() * 4);
  });
  kit.after(250, () => popText(kit, stage, W / 2, 6, '¡¡ÁCIDO!!', '#fff2a0', 10, 0));
};

// ---------------------------------------------------------------------------
// Especificaciones nuevas
// ---------------------------------------------------------------------------

const PASEO_SPECS: Record<string, Spec> = {
  m11_p_abuelo: { b: 'pueblo_voragine', c: ['abuelo grin'] },
  m11_p_abuelo_rie: { b: 'pueblo_voragine', c: ['abuelo teeth', 'laura smile'] },
  m11_p_arepa: { b: 'chorrera_bosque', c: ['arepera smile'], p: ['arepa'], fx: 'steam' },
  m11_p_ariana_chol: { b: 'pueblo_voragine', c: ['ariana squint'], p: ['cholado'] },
  m11_p_balde_laura: { b: 'truchera', c: ['laura_bano teeth'], p: ['balde'], fx: 'confetti', t: '¡AUPA!' },
  m11_p_barranquero: { b: 'chorrera_bosque', c: ['mochilera smile'] },
  m11_p_cholado: { b: 'pueblo_voragine', c: ['cholero grin'], p: ['cholado'] },
  m11_p_cholado_dos: { b: 'pueblo_voragine', c: ['laura grin', 'player smile'], p: ['cholado'], fx: 'heart1' },
  m11_p_cholado_todos: { b: 'pueblo_voragine', c: ['danilo teeth', 'mila grin', 'ariana teeth'], fx: 'confetti' },
  m11_p_ciclista: { b: 'voragine', c: ['ciclista grin'] },
  m11_p_clase: { b: 'playa_voragine', c: ['laura teeth'], p: ['piedra_lisa'] },
  m11_p_danilo_mesa: { b: 'kiosko', c: ['danilo grin'] },
  m11_p_efren: { b: 'truchera', c: ['efren smile'], p: ['cana'] },
  m11_p_efren_consejo: { b: 'truchera', c: ['efren closed', 'laura_bano o'] },
  m11_p_ensena: { b: 'playa_voragine', c: ['laura smile'], p: ['piedra_lisa'] },
  m11_p_fio_chol: { b: 'pueblo_voragine', c: ['fiorella teeth'], p: ['cholado'] },
  m11_p_fio_pregunta: { b: 'chorrera_bosque', c: ['fiorella squint', 'mila grin'] },
  m11_p_guia: { b: 'chorrera', c: ['guia_cafe smile'], fx: 'mist' },
  m11_p_guia_cuento: { b: 'chorrera', c: ['guia_cafe closed'], fx: ['mist', 'sparkle'] },
  m11_p_laura_arepa: { b: 'chorrera_bosque', c: ['laura teeth'], p: ['arepa'] },
  m11_p_laura_bici: { b: 'voragine', c: ['laura grin'] },
  m11_p_laura_cana: { b: 'truchera', c: ['laura_bano o'], p: ['cana'] },
  m11_p_laura_cita: { b: 'pueblo_voragine', c: ['laura closed'], p: ['libro'], fx: 'sparkle' },
  m11_p_laura_cuida: { b: 'kiosko', c: ['laura blush', 'player smile'], fx: 'heart1' },
  m11_p_laura_leyenda: { b: 'chorrera', c: ['laura_bano blush', 'player o'], fx: 'mist' },
  m11_p_laura_libro: { b: 'pueblo_voragine', c: ['laura smile'], p: ['libro'] },
  m11_p_laura_lulada: { b: 'chorrera_bosque', c: ['laura_bano blush'], p: ['lulada'] },
  m11_p_laura_pajaro: { b: 'chorrera_bosque', c: ['laura_bano o', 'player smile'], fx: 'sparkle' },
  m11_p_laura_roja: { b: 'chorrera_bosque', c: ['laura_bano blush'], fx: 'sweat' },
  m11_p_laura_volver: { b: 'chorrera', c: ['laura_bano blush', 'player blush'], fx: ['mist', 'heart1'] },
  m11_p_libres: { b: 'voragine', c: ['danilo grin', 'mila smile'] },
  m11_p_lulada: { b: 'chorrera_bosque', c: ['salpiconera grin'], p: ['lulada'] },
  m11_p_mango: { b: 'pueblo_voragine', c: ['vendedor_mango grin'], p: ['mango'] },
  m11_p_mango_laura: { b: 'pueblo_voragine', c: ['laura squint'], p: ['mango'] },
  m11_p_mapocho: { b: 'playa_voragine', c: ['laura o'] },
  m11_p_mila_arepa: { b: 'chorrera_bosque', c: ['mila squint', 'laura grin'] },
  m11_p_mochila: { b: 'playa_voragine', c: ['laura sad', 'player grin'] },
  m11_p_nasa: { b: 'truchera', c: ['efren grin'], p: ['trucha'] },
  m11_p_nino: { b: 'pozo', c: ['nino_piscina teeth'] },
  m11_p_ofelia_trucha: { b: 'kiosko', c: ['ofelia grin'], p: ['trucha'] },
  m11_p_pito: { b: 'voragine', c: ['chofer open'], p: ['willys'], t: '¡PIII!' },
  m11_p_promesa: { b: 'playa_voragine', c: ['laura blush'], fx: 'heart1' },
  m11_p_record: { b: 'playa_voragine', c: ['laura teeth'], t: 'Récord: 7' },
  m11_p_reto: { b: 'playa_voragine', c: ['laura squint', 'player grin'] },
  m11_p_rios: { b: 'playa_voragine', c: ['laura grin'] },
  m11_p_tinto: { b: 'voragine', c: ['senora_tinto smile'], p: ['taza'], fx: 'steam' },
  m11_p_tinto_chofer: { b: 'voragine', c: ['chofer grin'], p: ['taza'] },
};

// Las viñetas por especificación del paseo que ya existían ganan el movimiento de su fondo.
const ANIMATED_OLD = Object.fromEntries(Object.entries(M11_SPECS).filter(([, s]) => s.b in ANIM).map(([id, s]) => [id, composeAnim(s)]));

export const M11_PASEO_VINETAS: Record<string, VinetaBuilder> = {
  ...ANIMATED_OLD,
  ...Object.fromEntries(Object.entries(PASEO_SPECS).map(([id, s]) => [id, composeAnim(s)])),
  m11_p_playa: patitos(),
  m11_p_gana: gana,
  m11_p_ensena_mano: ensenaMano,
  m11_p_truchera: truchera,
  m11_p_balde: balde,
  m11_p_barranquero: barranqueroV,
  m11_p_foto_pajaro: fotoPajaro,
  m11_p_canela: canelaV,
  m11_p_canela_laura: canelaLaura,
  m11_p_mango_cara: mangoCara,
  m11_p_patitos_dos: patitos(undefined, 'los_dos'),
};
