import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import type { SignCtx } from './SignArt';

/**
 * Carteles de la misión 4 (Cali): la pizarra de Modelación Logística con el grafo de la panadería
 * y el carnet de estudiante de intercambio de la PUCC.
 */

/** Pizarra con la red de reparto: la panadería (D) y cuatro tiendas. `ruta` marca un recorrido en rojo. */
export interface RoutesSign {
  kind: 'rutas';
  ruta?: 'vecino' | 'mala' | 'camiones';
}

/** Carnet de estudiante de intercambio. */
export interface PuccCardSign {
  kind: 'carnet_pucc';
}

/** Diario mural de corcho de los pasillos de la PUCC, con afiches y papelitos. */
export interface PuccMuralSign {
  kind: 'mural_pucc';
}

export type CaliSign = RoutesSign | PuccCardSign | PuccMuralSign;

const NODES: Record<string, { x: number; y: number; label: string }> = {
  D: { x: 34, y: 56, label: 'Panadería' },
  A: { x: 84, y: 22, label: 'A' },
  B: { x: 150, y: 20, label: 'B' },
  C: { x: 188, y: 60, label: 'C' },
  E: { x: 112, y: 86, label: 'E' },
};
/** Distancias en km (las mismas que dicta la profe en el diálogo). */
const EDGES: Array<[string, string, number]> = [
  ['D', 'A', 4],
  ['A', 'B', 3],
  ['B', 'C', 4],
  ['C', 'E', 3],
  ['E', 'D', 5],
  ['D', 'B', 6],
  ['A', 'E', 6],
  ['B', 'E', 7],
];
const ROUTES: Record<NonNullable<RoutesSign['ruta']>, string[][]> = {
  vecino: [['D', 'A', 'B', 'C', 'E', 'D']],
  mala: [['D', 'A', 'E', 'C', 'B', 'D']],
  // Dos camiones de capacidad 2: cada uno sale y vuelve a la panadería.
  camiones: [
    ['D', 'A', 'B', 'D'],
    ['D', 'E', 'C', 'E', 'D'],
  ],
};
const MARKER = 0x2050a8;
const RED = 0xd83030;

export function buildCaliSign(ctx: SignCtx, s: CaliSign): void {
  if (s.kind === 'rutas') buildRoutes(ctx, s);
  else if (s.kind === 'mural_pucc') buildMural(ctx);
  else buildCard(ctx);
}

/** Papel pegado con chinche: fondo, título, líneas y un poquito torcido. */
interface Notice {
  x: number;
  y: number;
  w: number;
  h: number;
  paper: number;
  title: string;
  lines: string[];
  ink: string;
  angle: number;
  pin: number;
  tabs?: boolean;
}

const NOTICES: Notice[] = [
  { x: 8, y: 8, w: 70, h: 44, paper: 0x2050a8, title: 'PARTIDO', lines: ['INTERCAMBIO', 'vs. INGENIERÍA', 'lunes 4:30 p.m.', 'cancha principal'], ink: '#f8f8f0', angle: -3, pin: 0xd83838 },
  { x: 84, y: 6, w: 62, h: 38, paper: 0xf8e070, title: 'SALSA GRATIS', lines: ['Bienestar, 2º piso', 'mar y jue 5 p.m.', '¡sin pareja!'], ink: '#2a2433', angle: 2, pin: 0x2f6fd0 },
  { x: 152, y: 10, w: 60, h: 50, paper: 0xf8f8f0, title: 'SE ARRIENDA', lines: ['pieza en Pance', 'con ventilador', 'y hamaca'], ink: '#2a2433', angle: -2, pin: 0x3c9c48, tabs: true },
  { x: 16, y: 58, w: 64, h: 34, paper: 0xe8f0e0, title: '¿IGUANA?', lines: ['Se busca dueño', 'de iguana verde.', '(Vive en el lago)'], ink: '#2a6a34', angle: 3, pin: 0xf0c030 },
  { x: 88, y: 50, w: 58, h: 42, paper: 0xf4d4c8, title: 'RUTA P27', lines: ['Pance → Calle 18', 'cada 15 min', '(más o menos)'], ink: '#8a2a2a', angle: -1, pin: 0xd83838 },
  { x: 154, y: 66, w: 56, h: 28, paper: 0xfff4c0, title: 'Perdí lápiz', lines: ['rojo, mordido', 'R. C.'], ink: '#c8202c', angle: 4, pin: 0x2f6fd0 },
];

function buildMural(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 220;
  const h = 100;
  root.setPosition((BASE_WIDTH - w) / 2, 6);
  const g = scene.add.graphics();
  // Marco de madera y el corcho con sus pintitas.
  g.fillStyle(0x000000, 0.2).fillRect(2, 3, w, h);
  g.fillStyle(0x7a4c28, 1).fillRect(0, 0, w, h);
  g.fillStyle(0xc8945c, 1).fillRect(4, 4, w - 8, h - 8);
  for (let i = 0; i < 160; i++) g.fillStyle(i % 2 ? 0xb07c48 : 0xd8a870, 1).fillRect(4 + ((i * 37) % (w - 8)), 4 + ((i * 53) % (h - 8)), 1, 1);
  root.add(g);
  for (const n of NOTICES) {
    const c = scene.add.container(n.x + n.w / 2, n.y + n.h / 2).setAngle(n.angle);
    const p = scene.add.graphics();
    p.fillStyle(0x000000, 0.18).fillRect(-n.w / 2 + 2, -n.h / 2 + 2, n.w, n.h);
    p.fillStyle(n.paper, 1).fillRect(-n.w / 2, -n.h / 2, n.w, n.h);
    if (n.tabs) for (let x = -n.w / 2 + 4; x < n.w / 2 - 4; x += 8) p.fillStyle(0xf8f8f0, 1).fillRect(x, n.h / 2 - 1, 5, 8).lineStyle(1, 0xc8c0b0, 1).strokeRect(x, n.h / 2 - 1, 5, 8);
    p.fillStyle(n.pin, 1).fillCircle(0, -n.h / 2 + 3, 2.5);
    c.add(p);
    c.add(ctx.text(0, -n.h / 2 + 7, n.title, { fontFamily: FONT_HUD, fontSize: '8px', color: n.ink }).setOrigin(0.5, 0));
    n.lines.forEach((l, i) => c.add(ctx.text(0, -n.h / 2 + 18 + i * 8, l, { fontSize: '7px', color: n.ink }).setOrigin(0.5, 0)));
    root.add(c);
  }
  playSfx('page');
}

function buildRoutes(ctx: SignCtx, s: RoutesSign): void {
  const { scene, root } = ctx;
  const w = 224;
  const h = 108;
  root.setPosition((BASE_WIDTH - w) / 2, 4);
  const g = scene.add.graphics();
  // Pizarra blanca con marco de aluminio y la bandeja de los plumones.
  g.fillStyle(0x000000, 0.18).fillRect(2, 3, w, h);
  g.fillStyle(0x9aa0aa, 1).fillRect(0, 0, w, h);
  g.fillStyle(0xf8f8f4, 1).fillRect(3, 3, w - 6, h - 9);
  g.fillStyle(0xe8ecf0, 1).fillRect(10, 8, 40, 2).fillRect(150, 90, 50, 2);
  g.fillStyle(0x6a6c78, 1).fillRect(20, h - 6, 60, 3);
  g.fillStyle(0x2050a8, 1).fillRect(26, h - 7, 10, 2);
  g.fillStyle(RED, 1).fillRect(40, h - 7, 10, 2);
  root.add(g);

  const lines = scene.add.graphics();
  lines.lineStyle(1, MARKER, 0.85);
  for (const [a, b, km] of EDGES) {
    const p = NODES[a];
    const q = NODES[b];
    lines.lineBetween(p.x, p.y, q.x, q.y);
    root.add(ctx.text((p.x + q.x) / 2 + 2, (p.y + q.y) / 2 - 7, `${km}`, { fontFamily: FONT_HUD, fontSize: '8px', color: '#2050a8' }));
  }
  root.add(lines);

  // El recorrido en rojo, trazado como si la profe lo estuviera dibujando.
  const route = s.ruta ? ROUTES[s.ruta] : [];
  const red = scene.add.graphics();
  root.add(red);
  const segs = route.flatMap((r) => r.slice(1).map((id, i) => [NODES[r[i]], NODES[id]] as const));
  if (segs.length > 0) {
    const tw = scene.tweens.addCounter({
      from: 0,
      to: segs.length,
      duration: 380 * segs.length,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        red.clear().lineStyle(2, RED, 0.9);
        segs.forEach(([p, q], i) => {
          const k = Phaser.Math.Clamp(v - i, 0, 1);
          if (k > 0) red.lineBetween(p.x, p.y, p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k);
        });
      },
    });
    ctx.track(tw);
    playSfx('page');
  }

  for (const [id, n] of Object.entries(NODES)) {
    const dot = scene.add.graphics();
    const depot = id === 'D';
    dot.fillStyle(depot ? RED : MARKER, 1).fillCircle(n.x, n.y, depot ? 6 : 5);
    dot.fillStyle(0xf8f8f4, 1).fillCircle(n.x, n.y, depot ? 4 : 3);
    root.add(dot);
    root.add(ctx.text(n.x, n.y, depot ? 'D' : id, { fontFamily: FONT_HUD, fontSize: '8px', color: depot ? '#d83030' : '#2050a8' }).setOrigin(0.5));
    if (depot) root.add(ctx.text(n.x, n.y + 9, n.label, { fontSize: '7px', color: '#d83030' }).setOrigin(0.5, 0));
  }
  root.add(ctx.text(w - 8, 6, 'MODELACIÓN LOGÍSTICA', { fontFamily: FONT_HUD, fontSize: '8px', color: '#2a2433' }).setOrigin(1, 0));
  root.add(ctx.text(w - 8, 16, 'distancias en km', { fontSize: '7px', fontStyle: 'italic', color: '#5a5c68' }).setOrigin(1, 0));
  if (s.ruta === 'camiones') root.add(ctx.text(w - 8, h - 20, 'capacidad: 2 pedidos', { fontSize: '7px', color: '#d83030' }).setOrigin(1, 0));
}

function buildCard(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 168;
  const h = 98;
  root.setPosition((BASE_WIDTH - w) / 2, 10);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.2).fillRoundedRect(2, 3, w, h, 6);
  g.fillStyle(0xf8f8f4, 1).fillRoundedRect(0, 0, w, h, 6);
  g.fillStyle(0x2050a8, 1).fillRoundedRect(0, 0, w, 22, { tl: 6, tr: 6, bl: 0, br: 0 });
  g.fillStyle(0xf0c030, 1).fillRect(0, 22, w, 2);
  // Foto: cara pixelada con el jockey.
  g.fillStyle(0xc8d8e8, 1).fillRect(10, 30, 38, 46);
  g.fillStyle(0xf0c8a0, 1).fillRect(19, 42, 20, 18);
  g.fillStyle(0x2f6fd0, 1).fillRect(17, 36, 24, 8);
  g.fillStyle(0x202028, 1).fillRect(24, 49, 2, 2).fillRect(32, 49, 2, 2);
  g.fillStyle(0x2050a8, 1).fillRect(14, 62, 30, 14);
  // Código de barras y el escudo con las palmas.
  for (let x = 58; x < 150; x += 3) g.fillStyle(0x2a2433, 1).fillRect(x, 80, (x * 7) % 3 === 0 ? 2 : 1, 10);
  g.fillStyle(0x3c9c5c, 1).fillTriangle(148, 30, 158, 30, 153, 44);
  root.add(g);
  root.add(ctx.text(w / 2, 6, 'UNIVERSIDAD CRISTIANA-CALEÑA', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));
  const field = (y: number, label: string, value: string): void => {
    root.add(ctx.text(56, y, label, { fontSize: '6px', color: '#7a7488' }));
    root.add(ctx.text(56, y + 6, value, { fontSize: '8px', color: '#2a2433' }));
  };
  field(28, 'NOMBRE', 'FELI P.');
  field(44, 'PROGRAMA', 'Ingeniería · Intercambio');
  field(60, 'PERÍODO', '2026-2 · Pance, Cali');
  playSfx('page');
}
