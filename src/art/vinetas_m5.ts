import { playSfx } from '../audio/sfx';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { characterLook } from './SpriteRegistry';
import { disc, drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';
import { addG, flat, floatHeart, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas de la misión 5 (primera parte): el pelo en la mañana, estudiar en la biblioteca y el ruteo de las
 * panaderías, la ruta a pie (el chance, el loro, el mango biche y el salpicón) y la Barbería 360 (Fredy, el
 * mapamundi, las fotos «de viaje», la máquina, las tijeras y el espejo). Panel de 220 × 108 px.
 */

export const W = 220;
export const H = 108;
export const INK = '#2a2433';

export const lookOf = (id: string): HumanLook => (characterLook(id) as HumanLook | undefined) ?? playerLook();

export interface BustOpts {
  mouth?: 'smile' | 'open' | 'teeth' | 'grin' | 'o';
  eyes?: 'open' | 'closed' | 'squint';
  /** Pelo despeinado (un nido). */
  messy?: boolean;
  blush?: boolean;
}

/**
 * Busto de frente (cara, pelo y hombros) a escala `s`, con el centro de la cara en (cx, cy).
 * Entiende todos los peinados (también el degradado, el mullet y la cabeza rapada) y la barba, el bigote y la monoceja.
 */
export function bust(g: G, look: HumanLook, cx: number, cy: number, s: number, o: BustOpts = {}): void {
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  const style = look.hairStyle ?? 'short';
  const extras = look.extras ?? [];
  const heavy = look.build === 'heavy';
  // Hombros y cuello.
  r(heavy ? -11 : -8, 7, heavy ? 22 : 16, 6, INK);
  r(heavy ? -10 : -7, 8, heavy ? 20 : 14, 5, look.shirt);
  r(-2, 5, 4, 3, shade(look.skin, -0.12));
  // Pelo de atrás (largo o mullet).
  if (style === 'long') r(-6, -4, 12, 11, look.hair);
  if (style === 'mullet') r(-6, 0, 12, 9, look.hair);
  // Cara.
  r(-5, -5, 10, 11, INK);
  r(-4, -4, 8, 9, look.skin);
  // Orejas.
  r(-5.5, -1, 1.5, 3, look.skin);
  r(4, -1, 1.5, 3, look.skin);
  // Pelo o jockey.
  if (style === 'cap') {
    r(-5, -6, 10, 4, INK);
    r(-4, -5, 8, 3, look.cap ?? '#2f6fd0');
    r(-5, -3, 10, 1, shade(look.cap ?? '#2f6fd0', -0.3));
  } else if (style === 'bald') {
    r(-2, -4, 2, 1, shade(look.skin, 0.35));
  } else if (style === 'fade') {
    r(-5, -6, 10, 3, INK);
    r(-4, -5, 8, 2, look.hair);
    r(-4.5, -3, 1, 3, shade(look.hair, 0.4));
    r(3.5, -3, 1, 3, shade(look.hair, 0.4));
  } else {
    r(-5, -6, 10, 4, INK);
    r(-4, -5, 8, 3, look.hair);
    if (style === 'bun') r(-2, -8, 4, 3, look.hair);
    if (style === 'mullet') r(-5, -3, 1, 4, look.hair), r(4, -3, 1, 4, look.hair);
  }
  if (o.messy) {
    // El nido: mechones parados para todos lados.
    for (const [x, y, w, h] of [[-6, -8, 2, 3], [-3, -9, 1, 4], [0, -10, 2, 4], [3, -8, 2, 3], [5, -6, 2, 2], [-7, -5, 2, 2]] as const) r(x, y, w, h, look.hair);
  }
  // Ojos.
  const eyes = o.eyes ?? 'open';
  if (eyes === 'open') {
    r(-2.5, -0.5, 1, 1.5, '#202028');
    r(1.5, -0.5, 1, 1.5, '#202028');
  } else if (eyes === 'closed') {
    r(-3, 0.5, 2, 0.6, '#202028');
    r(1, 0.5, 2, 0.6, '#202028');
  } else {
    r(-3, 0, 2, 0.8, '#202028');
    r(1, 0, 2, 0.8, '#202028');
    r(-3, -1, 1, 0.6, '#202028');
    r(2, -1, 1, 0.6, '#202028');
  }
  if (extras.includes('unibrow')) r(-3.5, -2, 7, 1, look.hair);
  if (extras.includes('glasses')) {
    g.lineStyle(Math.max(1, s * 0.5), hex(INK), 1);
    g.strokeRect(Math.round(cx - 3.8 * s), Math.round(cy - 1.6 * s), Math.round(3 * s), Math.round(3 * s));
    g.strokeRect(Math.round(cx + 0.8 * s), Math.round(cy - 1.6 * s), Math.round(3 * s), Math.round(3 * s));
  }
  if (o.blush !== false) {
    r(-3.5, 1.5, 1, 1, '#e8a0a0');
    r(2.5, 1.5, 1, 1, '#e8a0a0');
  }
  if (extras.includes('beard')) {
    r(-4, 1.5, 8, 4, look.hair);
    r(-3, 5, 6, 1.5, look.hair);
  }
  if (extras.includes('mustache')) r(-2, 2, 4, 1, look.hair);
  const mouth = o.mouth ?? 'smile';
  if (mouth === 'open') r(-1, 2.5, 2, 2, '#7a2a2a');
  else if (mouth === 'teeth') r(-1.5, 2.5, 3, 1.5, '#f8f8f0');
  else if (mouth === 'grin') r(-2, 3, 4, 1, '#7a2a2a'), r(-1.5, 2.5, 3, 0.7, '#f8f8f0');
  else if (mouth === 'o') r(-0.7, 2.7, 1.4, 1.4, '#7a2a2a');
  else r(-1.5, 3, 3, 1, '#7a2a2a');
}

/** Figura de perfil en una capa (cuerpo + brazo). */
export function side(kit: VinetaKit, layer: Layer, look: HumanLook, x: number, floor: number, opts: SideFigureOpts, hug = false): { body: G; arm: G } {
  const top = Math.round(floor - FIGURE_H * opts.scale);
  const body = addG(kit, layer, x, top);
  const arm = addG(kit, layer, x, top);
  drawSideBody(body, look, opts);
  drawSideArm(arm, look, opts, hug);
  return { body, arm };
}

/** Nota musical que sube (la salsa que suena de fondo). */
export function floatNote(kit: VinetaKit, layer: Layer, x: number, y: number, color = '#f0d048'): void {
  const n = addG(kit, layer, x, y);
  n.fillStyle(hex(color), 1).fillRect(0, 3, 3, 2).fillRect(2, -3, 1, 6).fillRect(3, -3, 2, 1);
  kit.progress(1500, (t) => n.setPosition(Math.round(x + Math.sin(t * 7) * 3), Math.round(y - t * 22)).setAlpha(1 - t), () => n.destroy());
}

function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// La mañana: el nido en la cabeza
// ---------------------------------------------------------------------------

const espejoPelo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#4aa0b8'), 1).fillRect(x, y + h - 22, w, 22);
  });
  const frame = addG(kit, stage);
  frame.fillStyle(hex('#7a4c28'), 1).fillEllipse(110, 52, 104, 98);
  frame.fillStyle(hex('#c8dce4'), 1).fillEllipse(110, 52, 92, 86);
  frame.fillStyle(hex('#e4f0f4'), 1).fillRect(80, 22, 8, 2).fillRect(76, 26, 4, 2);
  const face = addG(kit, stage);
  const look = { ...playerLook(), hairStyle: StoryState.hasFlag('m5_corte') ? playerLook().hairStyle : ('short' as const) };
  const messy = !StoryState.hasFlag('m5_corte');
  bust(face, look, 110, 58, 4, { messy, mouth: messy ? 'o' : 'smile' });
  if (!messy) return;
  // El pajarito que vive en el nido.
  const bird = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    const hop = Math.max(0, Math.sin(t * 3)) * 4;
    bird.clear();
    bird.fillStyle(hex(INK), 1).fillRect(103, Math.round(10 - hop), 9, 7);
    bird.fillStyle(hex('#e8b030'), 1).fillRect(104, Math.round(11 - hop), 7, 5);
    bird.fillStyle(hex('#202028'), 1).fillRect(109, Math.round(12 - hop), 1, 1);
    bird.fillStyle(hex('#e86838'), 1).fillRect(111, Math.round(13 - hop), 2, 1);
  });
  kit.every(1300, () => popText(kit, stage, 128, 10, '¡pío!', '#e8b030', 8, 700));
};

// ---------------------------------------------------------------------------
// Estudiar: la mesa de la biblioteca y el ruteo de las panaderías
// ---------------------------------------------------------------------------

const estudio: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8e2d0'), 1).fillRect(x, y, w, h);
    // Estantes de libros al fondo.
    for (let row = 0; row < 3; row++) {
      g.fillStyle(hex('#8a5a38'), 1).fillRect(x, y + 6 + row * 18, 110, 2);
      for (let i = 0; i < 20; i++) g.fillStyle(hex(['#c84848', '#3c70c8', '#48a858', '#e8b030', '#8a5ac8'][(i + row) % 5]), 1).fillRect(x + 2 + i * 5, y + 8 + row * 18 - (i % 3), 4, 10 + (i % 3));
    }
    // La mesa.
    g.fillStyle(hex('#a87040'), 1).fillRect(x, y + 70, w, h - 70);
    g.fillStyle(hex('#c8905c'), 1).fillRect(x, y + 70, w, 2);
  });
  // La ventana con el sol que avanza.
  const win = addG(kit, stage);
  const clock = addG(kit, stage);
  const pen = addG(kit, stage);
  const cup = addG(kit, stage);
  outlined(cup, [[176, 58, 12, 14, '#f4f4f0']]);
  flat(cup, [[178, 60, 8, 3, '#5a3020']]);
  let ms = 0;
  kit.every(50, () => {
    ms += 50;
    const k = Math.min(1, ms / 6000);
    win.clear();
    win.fillStyle(hex('#7a4c28'), 1).fillRect(124, 6, 50, 40);
    win.fillStyle(hex('#a8d8f0'), 1).fillRect(127, 9, 44, 34);
    disc(win, lerp(132, 166, k), lerp(34, 14, Math.sin(k * Math.PI)) + 0, 4, '#f8e070');
    win.fillStyle(hex('#3c9c48'), 1).fillRect(127, 36, 44, 7);
    // El reloj de pared: las manecillas giran rápido (las horas pasan).
    clock.clear();
    disc(clock, 196, 20, 13, INK);
    disc(clock, 196, 20, 11, '#f8f6ee');
    const am = (ms / 300) % (Math.PI * 2);
    const ah = (ms / 3600) % (Math.PI * 2);
    clock.lineStyle(1, hex(INK), 1).lineBetween(196, 20, 196 + Math.sin(am) * 9, 20 - Math.cos(am) * 9);
    clock.lineStyle(2, hex('#c84848'), 1).lineBetween(196, 20, 196 + Math.sin(ah) * 6, 20 - Math.cos(ah) * 6);
    // El cuaderno se va llenando de líneas.
    pen.clear();
    outlined(pen, [[40, 64, 70, 36, '#f8f8f0'], [112, 64, 50, 36, '#f8f8f0']]);
    pen.fillStyle(hex('#c8c8d0'), 1).fillRect(110, 64, 2, 36);
    const lines = Math.floor(ms / 250);
    for (let i = 0; i < Math.min(lines, 14); i++) {
      const col = i < 7 ? 44 : 116;
      const row = i % 7;
      pen.fillStyle(hex('#3c4c88'), 1).fillRect(col, 68 + row * 4, 10 + rand(i) * 30, 1);
    }
    // La mano con el lápiz.
    const px = lines < 7 ? 54 + ((ms / 4) % 30) : 126 + ((ms / 4) % 30);
    const py = 68 + (Math.min(lines, 13) % 7) * 4;
    pen.fillStyle(hex(playerLook().skin), 1).fillRect(px, py - 2, 6, 5);
    pen.fillStyle(hex('#f0c030'), 1).fillRect(px - 4, py - 6, 2, 8);
    // Vapor del tinto.
    cup.clear();
    outlined(cup, [[176, 58, 12, 14, '#f4f4f0']]);
    flat(cup, [[178, 60, 8, 3, '#5a3020']]);
    cup.fillStyle(0xffffff, 0.5).fillRect(180 + Math.round(Math.sin(ms / 200) * 2), 50, 1, 6).fillRect(184 + Math.round(Math.cos(ms / 240) * 2), 48, 1, 7);
  });
};

/** El ruteo: la panadería al centro, cuatro clientes y dos viajes que se dibujan (con el camioncito). */
const ruteo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f2ea'), 1).fillRect(x, y, w, h);
    for (let gx = 0; gx < w; gx += 10) g.fillStyle(hex('#e2dccc'), 1).fillRect(x + gx, y, 1, h);
    for (let gy = 0; gy < h; gy += 10) g.fillStyle(hex('#e2dccc'), 1).fillRect(x, y + gy, w, 1);
  });
  const P = { x: 100, y: 56 };
  const nodes: Record<string, { x: number; y: number; d: string; q: number }> = {
    A: { x: 40, y: 24, d: '4 km', q: 12 },
    B: { x: 66, y: 82, d: '2 km', q: 10 },
    C: { x: 168, y: 20, d: '7 km', q: 9 },
    D: { x: 176, y: 84, d: '5 km', q: 8 },
  };
  const base = addG(kit, stage);
  const routes = addG(kit, stage);
  const truck = addG(kit, stage);
  const draw = (): void => {
    base.clear();
    for (const n of Object.values(nodes)) base.lineStyle(1, hex('#c8c0b0'), 1).lineBetween(P.x, P.y, n.x, n.y);
    outlined(base, [[P.x - 8, P.y - 6, 16, 12, '#e8b030']]);
    base.fillStyle(hex('#c84848'), 1).fillTriangle(P.x - 9, P.y - 6, P.x + 9, P.y - 6, P.x, P.y - 13);
    for (const n of Object.values(nodes)) {
      disc(base, n.x, n.y, 7, INK);
      disc(base, n.x, n.y, 6, '#ffffff');
    }
  };
  draw();
  stage.add(makeText(kit.scene, P.x, P.y + 12, 'Panadería', { fontSize: '7px', color: INK }).setOrigin(0.5, 0));
  for (const [k, n] of Object.entries(nodes)) {
    stage.add(makeText(kit.scene, n.x, n.y, k, { fontSize: '8px', fontStyle: '600', color: INK }).setOrigin(0.5));
    stage.add(makeText(kit.scene, (n.x + P.x) / 2, (n.y + P.y) / 2 - 6, n.d, { fontSize: '7px', color: '#7a7488' }).setOrigin(0.5));
    stage.add(makeText(kit.scene, n.x, n.y + 8, `${n.q} bolsas`, { fontSize: '6px', color: '#7a5030' }).setOrigin(0.5, 0));
  }
  // Los dos viajes: P → B → A → P (22 bolsas) y P → C → D → P (17 bolsas).
  const trips = [
    { pts: [P, nodes.B, nodes.A, P], color: '#2f6fd0', label: 'Viaje 1: 22 / 30' },
    { pts: [P, nodes.C, nodes.D, P], color: '#3cae5c', label: 'Viaje 2: 17 / 30' },
  ];
  let trip = 0;
  const run = (): void => {
    const tr = trips[trip % 2];
    const pts = tr.pts;
    popText(kit, stage, 110, 100, tr.label, tr.color, 8, 2600);
    kit.progress(
      2600,
      (t) => {
        const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
        const local = t * (pts.length - 1) - seg;
        const a = pts[seg];
        const b = pts[seg + 1];
        const x = lerp(a.x, b.x, local);
        const y = lerp(a.y, b.y, local);
        routes.lineStyle(2, hex(tr.color), 1).lineBetween(a.x, a.y, x, y);
        for (let i = 0; i < seg; i++) routes.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        truck.clear();
        outlined(truck, [[x - 5, y - 4, 10, 6, '#f4f4f0'], [x + 3, y - 3, 3, 5, '#c84848']]);
        truck.fillStyle(hex(INK), 1).fillRect(x - 4, y + 2, 2, 2).fillRect(x + 2, y + 2, 2, 2);
      },
      () => {
        trip++;
        if (trip % 2 === 0) routes.clear();
        kit.after(300, run);
      },
    );
  };
  run();
};

// ---------------------------------------------------------------------------
// La ruta: el chance, el loro, el mango biche y el salpicón
// ---------------------------------------------------------------------------

function streetBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#9cd8f0'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#f0c868'), 1).fillRect(x, y + 30, w, 50);
  for (let i = 0; i < 6; i++) g.fillStyle(hex('#c89a40'), 1).fillRect(x + 12 + i * 36, y + 40, 18, 22);
  g.fillStyle(hex('#b85838'), 1).fillRect(x, y + 26, w, 6);
  g.fillStyle(hex('#c8c4b8'), 1).fillRect(x, y + 80, w, h - 80);
  g.fillStyle(hex('#a8a49a'), 1).fillRect(x, y + 80, w, 2);
}

const chance: VinetaBuilder = (kit) => {
  const stage = kit.framed(streetBackdrop);
  const won = StoryState.hasFlag('secreto_chance');
  const num = StoryState.hasFlag('m5_chance_360') ? '360' : StoryState.hasFlag('m5_chance_777') ? '777' : StoryState.hasFlag('m5_chance_023') ? '023' : '???';
  const ticket = addG(kit, stage);
  outlined(ticket, [[50, 18, 120, 72, '#f8f4e0']]);
  flat(ticket, [
    [50, 18, 120, 14, '#2c9c4c'],
    [56, 40, 108, 30, '#ffffff'],
    [50, 84, 120, 6, '#e8e0c0'],
  ]);
  for (let x = 54; x < 168; x += 6) ticket.fillStyle(hex('#c8c0a0'), 1).fillRect(x, 86, 3, 2);
  stage.add(makeText(kit.scene, 110, 25, 'CHANCE · SORTEO 3:00 P.M.', { fontSize: '8px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5));
  const big = makeText(kit.scene, 110, 55, num, { fontSize: '22px', fontStyle: '700', color: INK }).setOrigin(0.5);
  stage.add(big);
  stage.add(makeText(kit.scene, 110, 76, 'Valor: $2.000 · ¡Suerte!', { fontSize: '7px', color: '#7a7488' }).setOrigin(0.5));
  if (won) {
    big.setColor('#c84848');
    kit.every(160, () => sparkle(kit, stage, 60 + Math.random() * 100, 30 + Math.random() * 50));
    popText(kit, stage, 110, 10, '¡GANADOR! +$20.000', '#f0c030', 11, 0);
    kit.after(100, () => playSfx('coin'));
  } else {
    let k = 0;
    kit.every(400, () => {
      k++;
      big.setScale(k % 2 ? 1.08 : 1);
    });
  }
};

const loro: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0d070'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#3c9c8c'), 1).fillRect(x, y + h - 20, w, 20);
  });
  const cage = addG(kit, stage);
  const bird = addG(kit, stage);
  const chileno = StoryState.hasFlag('secreto_loro');
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    const open = Math.sin(t * 9) > 0;
    cage.clear();
    for (let x = 60; x <= 120; x += 6) cage.fillStyle(hex('#d8a838'), 1).fillRect(x, 14, 2, 80);
    cage.fillStyle(hex('#d8a838'), 1).fillRect(58, 12, 66, 3).fillRect(58, 92, 66, 4).fillRect(88, 4, 4, 9);
    bird.clear();
    const by = 40 + Math.round(Math.sin(t * 4) * 2);
    outlined(bird, [
      [80, by + 10, 20, 28, '#3cb048'],
      [84, by, 16, 16, '#3cb048'],
      [76, by + 36, 8, 18, '#e84838'],
    ]);
    flat(bird, [
      [92, by + 4, 3, 3, '#ffffff'],
      [93, by + 5, 2, 2, '#202028'],
      [99, by + 6, 6, open ? 3 : 4, '#f0c030'],
      [99, by + 10, 5, open ? 3 : 1, '#c89020'],
      [80, by + 22, 6, 12, '#2a8a3c'],
    ]);
  });
  const text = chileno ? '¡AL TIRO, PO!' : StoryState.hasFlag('m5_loro_2') ? '¡QUÉ CHIMBA!' : '¡FREDY DEBE PLATA!';
  const say = (): void => {
    popText(kit, stage, 160, 30, text, '#ffffff', 9, 1000);
    for (let i = 0; i < 3; i++) {
      const f = addG(kit, stage, 100, 50);
      f.fillStyle(hex('#3cb048'), 1).fillRect(0, 0, 3, 2);
      const dx = (Math.random() - 0.5) * 60;
      kit.progress(1200, (q) => f.setPosition(Math.round(100 + dx * q), Math.round(50 + q * 40 + Math.sin(q * 9) * 3)).setAlpha(1 - q), () => f.destroy());
    }
  };
  say();
  kit.every(1500, say);
};

/** Comer algo ácido: la cara se arruga, un ojo se cierra y cae una lágrima. */
const mango: VinetaBuilder = (kit) => {
  const stage = kit.framed(streetBackdrop);
  const face = addG(kit, stage);
  const bag = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    const sour = Math.sin(t * 2) > 0.2;
    face.clear();
    bust(face, playerLook(), 80, 56, 4, { eyes: sour ? 'squint' : 'open', mouth: sour ? 'o' : 'teeth' });
    bag.clear();
    outlined(bag, [[132, 40, 30, 46, '#e8f0f4']]);
    for (const [x, y] of [[136, 46], [146, 52], [138, 62], [150, 68], [140, 76]] as const) flat(bag, [[x, y, 8, 6, '#9cd048'], [x, y, 3, 2, '#c8e878']]);
    flat(bag, [[144, 34, 1, 12, '#e8d8b0'], [152, 32, 1, 14, '#e8d8b0']]);
    bag.fillStyle(0xffffff, 1).fillRect(140 + Math.round(Math.sin(t * 5) * 6), 44, 1, 1).fillRect(152, 58 + Math.round(Math.cos(t * 4) * 4), 1, 1);
  });
  kit.every(900, () => popText(kit, stage, 80, 14, ['¡Ácido!', '¡Uff!', 'Más...'][Math.floor(Math.random() * 3)], '#f0c030', 9, 700));
};

const salpicon: VinetaBuilder = (kit) => {
  const stage = kit.framed(streetBackdrop);
  const cup = addG(kit, stage);
  const fruits = ['#f0c030', '#68b848', '#f8a838', '#f8f0e0', '#a050c0', '#e84848'];
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    cup.clear();
    outlined(cup, [[86, 24, 48, 68, '#e8f0f4']]);
    cup.fillStyle(hex('#e84868'), 1).fillRect(88, 36, 44, 54);
    cup.fillStyle(hex('#f08898'), 1).fillRect(88, 36, 44, 3);
    for (let i = 0; i < 14; i++) {
      const fx = 90 + ((i * 13 + Math.round(Math.sin(t + i) * 2)) % 38);
      const fy = 40 + ((i * 7 + Math.round(t * 6)) % 46);
      cup.fillStyle(hex(fruits[i % fruits.length]), 1).fillRect(fx, fy, 5, 4);
    }
    cup.fillStyle(hex('#f4f4f0'), 1).fillRect(122, 6, 3, 34);
  });
  kit.every(700, () => sparkle(kit, stage, 90 + Math.random() * 40, 30 + Math.random() * 20));
};

// ---------------------------------------------------------------------------
// La Barbería 360
// ---------------------------------------------------------------------------

function barberBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#262838'), 1).fillRect(x, y, w, h);
  for (let i = 0; i < w; i += 12) g.fillStyle(hex('#2c2e42'), 1).fillRect(x + i, y, 2, h);
  g.fillStyle(hex('#d8a838'), 1).fillRect(x, y + h - 26, w, 2);
  // Piso de ajedrez.
  for (let i = 0; i < w; i += 8) for (let j = h - 24; j < h; j += 8) g.fillStyle(hex(((i + j) / 8) % 2 ? '#1c1c24' : '#ecebe4'), 1).fillRect(x + i, y + j, 8, 8);
}

/** El poste de barbería girando. */
function pole(kit: VinetaKit, layer: Layer, x: number, y: number, h: number): void {
  const g = addG(kit, layer);
  let off = 0;
  kit.every(70, () => {
    off = (off + 1) % 9;
    g.clear();
    g.fillStyle(hex('#d8a838'), 1).fillRect(x - 1, y - 4, 10, 4).fillRect(x - 1, y + h, 10, 4);
    for (let j = 0; j < h; j++) {
      const k = (j + off) % 9;
      g.fillStyle(hex(k < 3 ? '#d83838' : k < 6 ? '#f4f4f0' : '#2f5fb0'), 1).fillRect(x, y + j, 8, 1);
    }
    g.fillStyle(0xffffff, 0.35).fillRect(x + 1, y, 2, h);
  });
}

const fredy: VinetaBuilder = (kit) => {
  const stage = kit.framed(barberBackdrop);
  // Los espejos con bombillos detrás.
  const back = addG(kit, stage);
  for (const mx of [16, 160]) {
    outlined(back, [[mx, 8, 44, 50, '#d8a838']]);
    flat(back, [[mx + 3, 11, 38, 44, '#5a7088']]);
    for (let k = 0; k < 4; k++) back.fillStyle(hex('#fff2b0'), 1).fillRect(mx - 2, 12 + k * 12, 2, 2).fillRect(mx + 44, 12 + k * 12, 2, 2);
  }
  pole(kit, stage, 200, 20, 50);
  // Detrás de Fredy, el espejo grande con bombillos (así se le ve bien la silueta).
  outlined(back, [[66, 2, 88, 74, '#d8a838']]);
  flat(back, [[69, 5, 82, 68, '#a8c8d8'], [74, 10, 6, 40, '#c8e0ec']]);
  for (let k = 0; k < 6; k++) back.fillStyle(hex('#fff2b0'), 1).fillRect(63, 6 + k * 12, 2, 2).fillRect(155, 6 + k * 12, 2, 2);
  const look = lookOf('fredy');
  const face = addG(kit, stage);
  const chain = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    face.clear();
    const talk = Math.floor(t * 8) % 3;
    bust(face, look, 110, 52, 5, { mouth: talk === 0 ? 'grin' : talk === 1 ? 'open' : 'teeth' });
    // Brillo de la cabeza rapada.
    face.fillStyle(0xffffff, 0.5).fillRect(100, 26, 8, 2).fillRect(98, 28, 3, 2);
    chain.clear();
    for (let i = 0; i < 9; i++) chain.fillStyle(hex(i % 2 ? '#f0c030' : '#c89a20'), 1).fillRect(96 + i * 3, 92 + Math.round(Math.sin(i / 2.6) * 3), 3, 2);
  });
  kit.every(450, () => floatNote(kit, stage, 40 + Math.random() * 140, 90, ['#f0d048', '#38e0d8', '#f05aa0'][Math.floor(Math.random() * 3)]));
};

/** El mapamundi con alfileres: la ruta de Fredy por el mundo se dibuja tramo a tramo (y un avioncito). */
const mapamundi: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8dcb8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7ab8d8'), 1).fillRect(x + 6, y + 6, w - 12, h - 12);
    const land = '#6aa858';
    // Continentes, a mano alzada (bloques).
    const blobs: Array<[number, number, number, number]> = [
      [24, 14, 30, 22], [36, 34, 12, 12], [44, 46, 18, 30], [52, 72, 8, 14],
      [96, 14, 22, 16], [96, 32, 26, 40], [120, 16, 50, 24], [146, 40, 14, 12], [168, 62, 22, 14], [70, 96, 90, 6],
    ];
    for (const [bx, by, bw, bh] of blobs) g.fillStyle(hex(land), 1).fillRect(x + bx, y + by, bw, bh);
  });
  const pins: Array<{ x: number; y: number; n: string }> = [
    { x: 50, y: 50, n: 'Cali' },
    { x: 56, y: 76, n: 'Antofagasta' },
    { x: 54, y: 84, n: 'Santiago' },
    { x: 44, y: 44, n: 'Panamá' },
    { x: 100, y: 22, n: 'Madrid' },
    { x: 140, y: 34, n: 'Dubái' },
    { x: 116, y: 100, n: '¿Antártida?' },
  ];
  const lines = addG(kit, stage);
  const plane = addG(kit, stage);
  for (const p of pins) {
    const g = addG(kit, stage);
    disc(g, p.x, p.y, 2, '#e83838');
    g.fillStyle(hex(INK), 1).fillRect(p.x, p.y + 2, 1, 3);
  }
  let i = 0;
  const leg = (): void => {
    if (i >= pins.length - 1) {
      i = 0;
      lines.clear();
    }
    const a = pins[i];
    const b = pins[i + 1];
    popText(kit, stage, b.x, b.y - 8, b.n, '#ffffff', 7, 900);
    kit.progress(
      900,
      (t) => {
        const x = lerp(a.x, b.x, t);
        const y = lerp(a.y, b.y, t) - Math.round(Math.sin(t * Math.PI) * 8);
        lines.fillStyle(hex('#c83838'), 1).fillRect(x, y, 1, 1);
        plane.clear().fillStyle(0xffffff, 1).fillRect(x - 2, y, 5, 1).fillRect(x, y - 1, 1, 3);
      },
      () => {
        i++;
        kit.after(250, leg);
      },
    );
  };
  leg();
  stage.add(makeText(kit.scene, 200, 98, 'FREDY EN EL MUNDO', { fontSize: '7px', fontStyle: '600', color: INK }).setOrigin(1, 0.5));
};

/** Las fotos «de viaje»: la Torre Eiffel, las Torres del Paine y Dubái... con el mismo fondo de cartón. */
const fotos: VinetaBuilder = (kit) => {
  const stage = kit.framed(barberBackdrop);
  const look = lookOf('fredy');
  const scenes = [
    { x: 8, label: 'PARÍS', draw: (g: G, x: number) => {
      g.fillStyle(hex('#8a7a68'), 1).fillTriangle(x + 30, 10, x + 20, 58, x + 40, 58);
      g.fillStyle(hex('#a8d8f0'), 1).fillTriangle(x + 30, 30, x + 25, 58, x + 35, 58);
      g.fillStyle(hex('#8a7a68'), 1).fillRect(x + 22, 36, 16, 2);
    } },
    { x: 78, label: 'TORRES DEL PAINE', draw: (g: G, x: number) => {
      for (const [dx, hh] of [[12, 36], [24, 44], [36, 34]] as const) g.fillStyle(hex('#5a6070'), 1).fillRect(x + dx, 58 - hh, 8, hh);
      g.fillStyle(hex('#f4f4f8'), 1).fillRect(x + 24, 14, 8, 4);
    } },
    { x: 148, label: 'DUBÁI', draw: (g: G, x: number) => {
      g.fillStyle(hex('#6a7a98'), 1).fillRect(x + 28, 8, 4, 50).fillRect(x + 12, 36, 8, 22).fillRect(x + 40, 30, 8, 28);
      // Detrás: el letrero de la panadería de Palmira (la prueba del delito).
      g.fillStyle(hex('#e8b030'), 1).fillRect(x + 4, 50, 22, 6);
    } },
  ];
  for (const sc of scenes) {
    const g = addG(kit, stage);
    outlined(g, [[sc.x, 6, 64, 70, '#d8a838']]);
    flat(g, [[sc.x + 3, 9, 58, 60, '#a8d8f0']]);
    // El cartón: borde gris y la pata que lo sostiene.
    sc.draw(g, sc.x + 2);
    g.fillStyle(hex('#b8a888'), 1).fillRect(sc.x + 3, 60, 58, 9);
    g.fillStyle(hex('#8a7a68'), 1).fillRect(sc.x + 50, 9, 1, 51);
    const fig = side(kit, stage, look, sc.x + 22, 74, { dir: 1, scale: 0.62, eyes: 'open' });
    fig.arm.setVisible(false);
    // Pulgar arriba.
    g.fillStyle(hex(look.skin), 1).fillRect(sc.x + 38, 48, 3, 4).fillRect(sc.x + 39, 45, 2, 3);
    stage.add(makeText(kit.scene, sc.x + 32, 84, sc.label, { fontSize: '7px', fontStyle: '600', color: '#f0d048' }).setOrigin(0.5, 0));
  }
  const flash = addG(kit, stage);
  kit.every(1800, () => {
    kit.progress(300, (t) => flash.clear().fillStyle(0xffffff, (1 - t) * 0.6).fillRect(0, 0, W, H), () => flash.clear());
  });
  popText(kit, stage, 182, 98, '«Cartón importado»', '#e8e8f0', 7, 0);
};

/**
 * El corte, de lado: tú en el sillón con la capa y Fredy detrás con la máquina (zumbido y mechones que caen)
 * o con las tijeras, contando su vida (globitos con un avión, la Torre Eiffel y un camello).
 */
function corte(mode: 'maquina' | 'tijera'): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(barberBackdrop);
    const back = addG(kit, stage);
    outlined(back, [[150, 6, 60, 60, '#d8a838']]);
    flat(back, [[153, 9, 54, 54, '#5a7088']]);
    pole(kit, stage, 8, 14, 50);
    // El sillón.
    const chair = addG(kit, stage);
    outlined(chair, [[70, 46, 34, 22, '#b02838'], [64, 66, 46, 6, '#7c1828'], [84, 72, 6, 12, '#c8ccd4'], [74, 84, 26, 3, '#7c808c']]);
    const me = playerLook();
    const look = StoryState.hasFlag('m5_corte') ? me : { ...me, hairStyle: me.hairStyle === 'cap' ? ('short' as const) : me.hairStyle };
    const you = side(kit, stage, { ...look, shirt: '#f4f4f0', extras: [] }, 74, 82, { dir: 1, scale: 0.9, eyes: mode === 'maquina' ? 'closed' : 'open' });
    you.arm.setVisible(false);
    // La capa: rayas blancas y negras, del cuello a las rodillas.
    const cape = addG(kit, stage);
    outlined(cape, [[72, 46, 26, 30, '#ecebe4']]);
    for (let y = 48; y < 76; y += 4) cape.fillStyle(hex('#1c1c24'), 1).fillRect(72, y, 26, 1);
    const fredyFig = side(kit, stage, lookOf('fredy'), 48, 88, { dir: 1, scale: 1.12, eyes: 'open' });
    const tool = addG(kit, stage);
    const hair = addG(kit, stage);
    const bits: Array<{ x: number; y: number; vy: number }> = [];
    let t = 0;
    kit.every(50, () => {
      t += 0.05;
      const bob = Math.sin(t * (mode === 'maquina' ? 22 : 9));
      tool.clear();
      fredyFig.arm.setPosition(48 + Math.round(bob * 2), fredyFig.arm.y);
      if (mode === 'maquina') {
        outlined(tool, [[72 + Math.round(bob * 2), 30 + Math.round(Math.sin(t * 3) * 6), 10, 5, '#6a6c78']]);
        if (Math.random() < 0.6) bits.push({ x: 76 + Math.random() * 10, y: 34, vy: 0 });
      } else {
        const open = Math.sin(t * 12) > 0;
        const sx = 76;
        const sy = 26 + Math.round(Math.sin(t * 2) * 4);
        tool.lineStyle(1, hex('#c8ccd4'), 1).lineBetween(sx, sy, sx + 10, sy + (open ? -3 : 0)).lineBetween(sx, sy, sx + 10, sy + (open ? 3 : 0));
        tool.fillStyle(hex(INK), 1).fillRect(sx - 3, sy - 1, 3, 3);
        if (!open && Math.random() < 0.5) bits.push({ x: 82 + Math.random() * 6, y: sy, vy: 0 });
      }
      hair.clear();
      for (const b of bits) {
        b.vy += 0.15;
        b.y += b.vy;
        b.x += Math.sin(b.y / 4) * 0.4;
        hair.fillStyle(hex(me.hair), 1).fillRect(Math.round(b.x), Math.round(b.y), 1, 2);
      }
      while (bits.length > 0 && bits[0].y > 96) bits.shift();
    });
    if (mode === 'maquina') kit.every(700, () => popText(kit, stage, 100, 18, 'bzzzz', '#c8ccd4', 8, 500));
    else {
      const icons = ['avión', 'Eiffel', 'camello', 'Chile', 'salsa'];
      let k = 0;
      kit.every(1100, () => {
        const word = icons[k++ % icons.length];
        popText(kit, stage, 30 + (k % 2) * 14, 16, `«...${word}...»`, '#ffffff', 7, 900);
      });
      kit.every(600, () => popText(kit, stage, 96, 20, 'snip', '#c8ccd4', 7, 400));
    }
    kit.every(500, () => floatNote(kit, stage, 130 + Math.random() * 70, 88));
  };
}

/** El espejo: el corte nuevo, de frente, con Fredy mostrando la nuca con el espejito de mano. 360 grados. */
const corteEspejo: VinetaBuilder = (kit) => {
  const stage = kit.framed(barberBackdrop);
  const mirror = addG(kit, stage);
  outlined(mirror, [[50, 4, 120, 82, '#d8a838']]);
  flat(mirror, [[54, 8, 112, 74, '#9cb8c8']]);
  for (let k = 0; k < 6; k++) mirror.fillStyle(hex('#fff2b0'), 1).fillRect(46, 10 + k * 13, 3, 3).fillRect(171, 10 + k * 13, 3, 3);
  const face = addG(kit, stage);
  const hand = addG(kit, stage);
  const look = playerLook();
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    face.clear();
    bust(face, look, 110, 46, 4.5, { mouth: Math.sin(t * 2) > 0.6 ? 'teeth' : 'smile' });
    face.fillStyle(0xffffff, 0.2).fillRect(60, 12, 6, 30).fillRect(68, 12, 2, 30);
    // El espejito de mano, de lado a lado: muestra la nuca.
    hand.clear();
    const hx = 150 + Math.round(Math.sin(t) * 6);
    outlined(hand, [[hx, 50, 18, 22, '#1c1c24']]);
    flat(hand, [[hx + 2, 52, 14, 18, '#9cb8c8'], [hx + 6, 72, 6, 14, lookOf('fredy').skin]]);
    hand.fillStyle(hex(look.hair), 1).fillRect(hx + 4, 56, 10, look.hairStyle === 'bald' ? 0 : 6);
  });
  kit.every(260, () => sparkle(kit, stage, 70 + Math.random() * 80, 14 + Math.random() * 50));
  popText(kit, stage, 110, 98, '¡360° DE PERFECCIÓN!', '#38e0d8', 9, 0);
  kit.after(200, () => floatHeart(kit, stage, 150, 30));
};

export const M5_VINETAS: Record<string, VinetaBuilder> = {
  m5_espejo_pelo: espejoPelo,
  m5_estudio: estudio,
  m5_ruteo: ruteo,
  m5_chance: chance,
  m5_loro: loro,
  m5_mango: mango,
  m5_salpicon: salpicon,
  m5_fredy: fredy,
  m5_mapamundi: mapamundi,
  m5_fotos: fotos,
  m5_corte_maquina: corte('maquina'),
  m5_corte_tijera: corte('tijera'),
  m5_corte_espejo: corteEspejo,
};
