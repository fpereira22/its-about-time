import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';

/**
 * Viñetas de la misión 7 (primera parte): la mudanza al piso 8, Wilmer el de la recepción, los helados del martes
 * con Majo y Cata, el miércoles (las amigas que se escapan), el jueves en la U (la maqueta, el almuerzo, la selfie
 * con el pavo real, el lago al atardecer y el grito del pavo) y el chat hasta las 3 de la mañana.
 * Panel de 220 × 108 px.
 */

export const SIRA = (): HumanLook => lookOf(StoryState.hasFlag('m7_polera') ? 'sira_m7_polera' : 'sira_m7');

/** Número pseudoaleatorio estable (0..1). */
export const rnd = (n: number): number => {
  const s = Math.sin(n * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
};

/** El jugador sin el jockey (en la cama, en la almohada, dormido). */
export function sinGorro(look: HumanLook): HumanLook {
  return look.hairStyle === 'cap' ? { ...look, hairStyle: 'short' } : look;
}

/**
 * Alguien visto de espaldas (sentado mirando el lago, o en el sofá frente a la tele): hombros con la polera,
 * cabeza redonda con el pelo y, si es largo, el pelo cayendo sobre la espalda. `lean` inclina la cabeza hacia un lado.
 */
export function backView(g: G, cx: number, base: number, look: HumanLook, s = 1, lean = 0): void {
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + x * s), Math.round(base + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  const style = look.hairStyle ?? 'short';
  // Hombros y espalda.
  r(-9, -17, 18, 17, INK);
  r(-8, -16, 16, 16, look.shirt);
  r(-8, -16, 16, 2, shade(look.shirt, 0.15));
  // Cuello y cabeza.
  const hx = lean;
  r(-2 + hx, -20, 4, 4, shade(look.skin, -0.1));
  disc(g, Math.round(cx + hx * s), Math.round(base - 27 * s), Math.round(7 * s) + 1, INK);
  disc(g, Math.round(cx + hx * s), Math.round(base - 27 * s), Math.round(7 * s), style === 'bald' ? look.skin : look.hair);
  if (style === 'cap') {
    disc(g, Math.round(cx + hx * s), Math.round(base - 29 * s), Math.round(6 * s), look.cap ?? '#2f6fd0');
  }
  if (style === 'long') r(-6 + hx, -27, 12, 16, look.hair);
  if (style === 'bun') disc(g, Math.round(cx + hx * s), Math.round(base - 35 * s), Math.round(3 * s), look.hair);
  // Las orejas asomando.
  r(-8 + hx, -28, 1, 3, look.skin);
  r(7 + hx, -28, 1, 3, look.skin);
}

/** Cono de helado (bola de `color`) con la punta en (x, y). */
export function cone(g: G, x: number, y: number, color: string, s = 1): void {
  g.fillStyle(hex(INK), 1).fillTriangle(x - 5 * s - 1, y - 12 * s - 1, x + 5 * s + 1, y - 12 * s - 1, x, y + 1);
  g.fillStyle(hex('#d8a058'), 1).fillTriangle(x - 5 * s, y - 12 * s, x + 5 * s, y - 12 * s, x, y);
  g.fillStyle(hex('#a87838'), 1).fillRect(x - 2 * s, y - 9 * s, 1, 1).fillRect(x + s, y - 6 * s, 1, 1);
  disc(g, Math.round(x), Math.round(y - 15 * s), Math.round(5 * s) + 1, INK);
  disc(g, Math.round(x), Math.round(y - 15 * s), Math.round(5 * s), color);
  g.fillStyle(0xffffff, 0.5).fillRect(x - 2 * s, y - 18 * s, 2, 1);
}

/** Sabor del helado que pediste (flags `m7_sabor_*`). */
function mySabor(): string {
  if (StoryState.hasFlag('m7_sabor_lulo')) return '#c8d848';
  if (StoryState.hasFlag('m7_sabor_mora')) return '#8a2c5c';
  if (StoryState.hasFlag('m7_sabor_coco')) return '#f4f0e4';
  return '#c8884c';
}

/** Cielo de Cali a la hora que diga `k` (0 = mediodía, 1 = atardecer naranjo y morado). */
function sky(g: G, x: number, y: number, w: number, h: number, k: number): void {
  const top = k > 0.5 ? '#5a4c8c' : '#7cb8e8';
  const mid = k > 0.5 ? '#e8806a' : '#a8d4f0';
  const low = k > 0.5 ? '#f8c070' : '#d8ecf8';
  g.fillStyle(hex(top), 1).fillRect(x, y, w, h * 0.35);
  g.fillStyle(hex(mid), 1).fillRect(x, y + h * 0.35, w, h * 0.3);
  g.fillStyle(hex(low), 1).fillRect(x, y + h * 0.65, w, h * 0.35);
}

/** Los Farallones de fondo (cerros azulados), con la línea de base en `base`. */
function farallones(g: G, x: number, w: number, base: number, color = '#5a7c8c'): void {
  g.fillStyle(hex(color), 1);
  g.fillTriangle(x, base, x + w * 0.22, base - 30, x + w * 0.45, base);
  g.fillTriangle(x + w * 0.3, base, x + w * 0.55, base - 38, x + w * 0.8, base);
  g.fillTriangle(x + w * 0.62, base, x + w * 0.85, base - 26, x + w, base);
}

// ---------------------------------------------------------------------------
// El depa y la recepción
// ---------------------------------------------------------------------------

/** La mudanza: el ventanal del piso 8, los Farallones, el techo de paneles del PrecioClub y las cajas. */
const mudanza: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c89c6c'), 1).fillRect(x, y + 88, w, h - 88);
  });
  const win = addG(kit, stage);
  outlined(win, [[20, 6, 120, 74, '#3a3c44']]);
  sky(win, 22, 8, 116, 70, 0);
  farallones(win, 22, 116, 48);
  win.fillStyle(hex('#58a048'), 1).fillRect(22, 48, 116, 30);
  // El techo de paneles solares de la bodega, abajo, y la Calle 18.
  win.fillStyle(hex('#c8ccd0'), 1).fillRect(30, 58, 70, 16);
  for (let i = 0; i < 8; i++) win.fillStyle(hex('#2c4a7c'), 1).fillRect(32 + i * 8, 60, 6, 5).fillRect(32 + i * 8, 67, 6, 5);
  win.fillStyle(hex('#5c5c6c'), 1).fillRect(104, 48, 8, 30);
  win.fillStyle(hex('#3a3c44'), 1).fillRect(79, 6, 2, 74);
  // Las nubes que pasan.
  const clouds = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    clouds.clear();
    for (const [cx, cy] of [[30, 16], [90, 22]] as const) {
      const xx = 22 + ((cx + t * 6) % 116);
      clouds.fillStyle(0xffffff, 0.9).fillEllipse(xx, cy, 18, 6).fillEllipse(xx + 6, cy - 2, 10, 6);
    }
  });
  // Las cajas de la mudanza.
  const box = addG(kit, stage);
  outlined(box, [[150, 62, 32, 26, '#c8a070'], [158, 44, 26, 20, '#d8b080'], [186, 70, 26, 18, '#c8a070']]);
  flat(box, [[150, 72, 32, 2, '#a87c50'], [158, 52, 26, 2, '#a87c50'], [186, 77, 26, 2, '#a87c50']]);
  stage.add(makeText(kit.scene, 166, 64, 'COCINA', { fontSize: '5px', color: INK }).setOrigin(0.5, 0));
  stage.add(makeText(kit.scene, 171, 46, 'LIBROS', { fontSize: '5px', color: INK }).setOrigin(0.5, 0));
  stage.add(makeText(kit.scene, 199, 72, 'MANJAR', { fontSize: '5px', color: '#c83c3c' }).setOrigin(0.5, 0));
  stage.add(makeText(kit.scene, 80, 92, 'Depa 805 · piso 8', { fontSize: '7px', color: INK }).setOrigin(0.5, 0));
  kit.every(900, () => sparkle(kit, stage, 26 + Math.random() * 100, 10 + Math.random() * 30));
};

/** Wilmer, el de la recepción: lentes de sol en la cabeza, bigote, corbata y siempre cantando. */
const wilmer: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#efe8dc'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#8a5a3a'), 1).fillRect(x + i, y + 40, 12, h - 40);
    g.fillStyle(hex('#6a4028'), 1).fillRect(x, y + 84, w, h - 84);
    g.fillStyle(hex('#f4efe4'), 1).fillRect(x, y + 80, w, 6);
  });
  const face = addG(kit, stage);
  const look = lookOf('wilmer');
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    face.clear();
    const sway = Math.round(Math.sin(t * 2.4) * 3);
    face.setX(sway);
    bust(face, look, 110, 44, 4, { mouth: Math.sin(t * 6) > 0 ? 'open' : 'grin', eyes: 'squint' });
    // Los lentes de sol, subidos en la cabeza.
    face.fillStyle(hex(INK), 1).fillRect(94, 14, 32, 5);
    face.fillStyle(hex('#3c5c8c'), 1).fillRect(96, 15, 12, 3).fillRect(112, 15, 12, 3);
  });
  kit.every(380, () => floatNote(kit, stage, 150 + Math.random() * 20, 40, '#e85a7a'));
  kit.every(520, () => floatNote(kit, stage, 50 + Math.random() * 20, 44, '#3c8c5c'));
  stage.add(makeText(kit.scene, 110, 98, 'WILMER · RECEPCIÓN', { fontSize: '6px', color: '#f8f0d0' }).setOrigin(0.5, 0));
  kit.after(300, () => popText(kit, stage, 40, 18, '¡Buenaaas!', '#e85a7a', 8, 0));
};

// ---------------------------------------------------------------------------
// Los helados del martes y el miércoles
// ---------------------------------------------------------------------------

/** Los cuatro con sus conos en la Plaza Central: Majo y Cata no les quitan los ojos de encima. */
const helado: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, 50, 0);
    g.fillStyle(hex('#c89878'), 1).fillRect(x, y + 50, w, h - 50);
    for (let i = 0; i < w; i += 12) g.fillStyle(hex('#a87858'), 1).fillRect(x + i, y + 50, 1, h - 50);
    g.fillStyle(hex('#3c9050'), 1).fillEllipse(x + 30, y + 46, 50, 22).fillEllipse(x + 190, y + 44, 60, 26);
  });
  const g = addG(kit, stage);
  const cast: Array<[string, HumanLook, number]> = [
    ['majo', lookOf('majo'), 30],
    ['sira', SIRA(), 82],
    ['yo', playerLook(), 136],
    ['cata', lookOf('cata'), 190],
  ];
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    g.clear();
    for (const [who, look, cx] of cast) {
      const teasing = who === 'majo' || who === 'cata';
      bust(g, look, cx, 54, 3, {
        mouth: teasing ? (Math.sin(t * 3 + cx) > 0 ? 'grin' : 'teeth') : 'smile',
        eyes: teasing && Math.sin(t * 2 + cx) > 0.6 ? 'squint' : 'open',
      });
      const flavor = who === 'yo' ? mySabor() : who === 'sira' ? '#f0e070' : who === 'majo' ? '#e8a0b8' : '#5a3020';
      cone(g, cx + 14, 98, flavor, 0.9);
    }
  });
  kit.every(1200, () => floatHeart(kit, stage, 108 + Math.random() * 6, 30));
  kit.after(600, () => popText(kit, stage, 30, 14, 'uyyy', '#e8b030', 8, 1400));
  kit.after(1500, () => popText(kit, stage, 190, 14, 'ajá...', '#a83c3c', 8, 1400));
};

/** Miércoles: otra vez helado. Las amigas «se acuerdan» de algo y se escapan detrás de los arbustos. */
const helado2: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, 56, 0.3);
    g.fillStyle(hex('#78c060'), 1).fillRect(x, y + 56, w, h - 56);
    g.fillStyle(hex('#3c9050'), 1).fillEllipse(x + 180, y + 66, 70, 30);
  });
  // La banca de los dos.
  const bench = addG(kit, stage);
  outlined(bench, [[40, 84, 90, 5, '#a87048'], [44, 89, 4, 14, '#7a4c30'], [122, 89, 4, 14, '#7a4c30']]);
  const me = side(kit, stage, playerLook(), 62, 98, { dir: 1, scale: 0.9, eyes: 'open' });
  const her = side(kit, stage, SIRA(), 84, 98, { dir: -1, scale: 0.84, eyes: 'open' });
  void me;
  void her;
  const cones = addG(kit, stage);
  cone(cones, 82, 66, mySabor(), 0.7);
  cone(cones, 90, 68, '#f0e070', 0.7);
  // Majo y Cata asomadas tras el arbusto, escapándose.
  const spies = addG(kit, stage);
  kit.progress(4200, (k) => {
    spies.clear();
    const dx = lerp(0, 50, k);
    bust(spies, lookOf('majo'), 164 + dx, 62, 2, { mouth: 'grin', eyes: 'squint' });
    bust(spies, lookOf('cata'), 186 + dx, 64, 2, { mouth: 'smile', eyes: 'squint' });
    spies.fillStyle(hex('#3c9050'), 1).fillEllipse(180, 76, 70, 22);
  });
  stage.add(makeText(kit.scene, 6, 4, 'Miércoles', { fontSize: '7px', fontStyle: '600', color: '#ffffff', stroke: INK, strokeThickness: 2 }));
  kit.after(700, () => popText(kit, stage, 186, 40, '¡shhh!', '#ffffff', 8, 1800));
  kit.every(1300, () => floatHeart(kit, stage, 82, 50));
};

// ---------------------------------------------------------------------------
// El jueves en la U
// ---------------------------------------------------------------------------

/** La maqueta de Sira: un mirador de palitos sobre el río Pance, con gente chiquitita (y una banderita chilena). */
const maqueta: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8e0d0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#b8aa90'), 1).fillRect(x, y + 92, w, h - 92);
  });
  const g = addG(kit, stage);
  // La base de cartón con curvas de nivel.
  outlined(g, [[16, 40, 188, 52, '#e8d8b0']]);
  for (let i = 0; i < 4; i++) g.fillStyle(hex('#d8c898'), 1).fillRect(16, 44 + i * 6, 70 - i * 12, 4);
  // El río Pance (de cartulina azul) y sus piedras.
  g.fillStyle(hex('#6aa8d8'), 1).fillRect(16, 72, 188, 10);
  g.fillStyle(hex('#8cc0e8'), 1).fillRect(16, 74, 188, 2);
  for (let i = 0; i < 9; i++) disc(g, 24 + i * 21, 80, 2, '#a8a8a0');
  // El mirador de palitos de balso.
  g.fillStyle(hex('#a87048'), 1);
  for (const px of [92, 104, 116, 128]) g.fillRect(px, 46, 2, 28);
  g.fillRect(88, 46, 46, 3).fillRect(88, 58, 46, 2).fillRect(80, 40, 62, 3);
  for (let i = 0; i < 6; i++) g.fillRect(84 + i * 10, 34, 1, 6);
  // Arbolitos de esponja.
  for (const [tx, ty] of [[30, 52], [50, 56], [160, 50], [180, 54], [196, 46]] as const) disc(g, tx, ty, 6, '#58a048'), disc(g, tx - 2, ty - 2, 3, '#78c060');
  // La gente chiquitita: dos sentados en el mirador... y la banderita.
  const people = addG(kit, stage);
  people.fillStyle(hex(INK), 1).fillRect(106, 52, 2, 5).fillRect(111, 52, 2, 5);
  people.fillStyle(hex('#e8a0b8'), 1).fillRect(106, 50, 2, 2);
  people.fillStyle(hex('#2050a8'), 1).fillRect(111, 50, 2, 2);
  const flag = addG(kit, stage);
  flag.fillStyle(hex('#5a5a64'), 1).fillRect(140, 28, 1, 14);
  flag.fillStyle(hex('#2c5cb0'), 1).fillRect(141, 28, 3, 3);
  flag.fillStyle(hex('#f8f8f0'), 1).fillRect(144, 28, 5, 3).fillRect(142, 29, 1, 1);
  flag.fillStyle(hex('#d83c3c'), 1).fillRect(141, 31, 8, 3);
  stage.add(makeText(kit.scene, 110, 94, 'MIRADOR DEL RÍO PANCE · Taller 5 · S. Martínez', { fontSize: '5px', color: INK }).setOrigin(0.5, 0));
  if (StoryState.hasFlag('secreto_banderita')) {
    kit.every(500, () => sparkle(kit, stage, 140 + Math.random() * 10, 24 + Math.random() * 10));
    kit.after(400, () => popText(kit, stage, 160, 18, '¿y esto?', '#d83c3c', 7, 0));
  }
  kit.every(1500, () => floatHeart(kit, stage, 109, 44));
};

/** El almuerzo en la Cafetería Central: arroz, fríjoles, carne y patacones. Ella te roba uno. */
const almuerzo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0e8d8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#a87048'), 1).fillRect(x, y + 58, w, h - 58);
    g.fillStyle(hex('#c8905c'), 1).fillRect(x, y + 58, w, 2);
  });
  const tray = addG(kit, stage);
  outlined(tray, [[40, 62, 140, 40, '#e8604a']]);
  disc(tray, 80, 80, 16, INK);
  disc(tray, 80, 80, 15, '#f8f8f0');
  disc(tray, 74, 78, 7, '#f4f0e0');
  disc(tray, 86, 82, 6, '#7a3a28');
  disc(tray, 140, 80, 16, INK);
  disc(tray, 140, 80, 15, '#f8f8f0');
  tray.fillStyle(hex('#8a4a28'), 1).fillRect(130, 76, 14, 8);
  // Los patacones: uno se va volando a la boca de Sira.
  const pat = addG(kit, stage);
  let n = 3;
  const drawPats = (): void => {
    pat.clear();
    for (let i = 0; i < n; i++) disc(pat, 108 + i * 10, 72 + (i % 2) * 6, 4, '#e8c050');
  };
  drawPats();
  const fork = addG(kit, stage);
  const steal = (): void => {
    if (n <= 0) return;
    kit.progress(900, (k) => {
      fork.clear();
      const fx = lerp(220, 108 + (n - 1) * 10, k < 0.5 ? k * 2 : 1);
      const fy = k < 0.5 ? 72 : lerp(72, 10, (k - 0.5) * 2);
      fork.fillStyle(hex('#c8ccd4'), 1).fillRect(fx, fy, 30, 2).fillRect(fx - 3, fy - 2, 4, 1).fillRect(fx - 3, fy + 3, 4, 1);
      if (k > 0.5) disc(fork, fx - 2, fy + 1, 4, '#e8c050');
    }, () => {
      fork.clear();
      n--;
      drawPats();
      popText(kit, stage, 190, 20, '¡ñam!', '#e85a7a', 8, 900);
    });
  };
  kit.after(700, steal);
  kit.after(2600, steal);
  stage.add(makeText(kit.scene, 6, 4, 'Cafetería Central · almuerzo ejecutivo', { fontSize: '6px', color: INK }));
};

/** La selfie con el pavo real (abrió la cola justo a tiempo). */
const selfie: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#1c1c24'), 1).fillRect(x, y, w, h));
  const phone = addG(kit, stage);
  outlined(phone, [[38, 4, 144, 100, '#2a2a30']]);
  phone.fillStyle(hex('#78c060'), 1).fillRect(42, 8, 136, 92);
  // La cola del pavo real, abierta en abanico detrás.
  const tail = addG(kit, stage);
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    const ex = 110 + Math.cos(a) * 60;
    const ey = 78 + Math.sin(a) * 58;
    tail.lineStyle(4, hex('#2c8c5c'), 1).lineBetween(110, 78, ex, ey);
    disc(tail, Math.round(ex), Math.round(ey), 5, '#2c6c9c');
    disc(tail, Math.round(ex), Math.round(ey), 2, '#f0c830');
  }
  disc(tail, 110, 62, 5, '#2c6cc8');
  tail.fillStyle(hex('#f0c830'), 1).fillRect(114, 62, 4, 2);
  const faces = addG(kit, stage);
  bust(faces, playerLook(), 82, 74, 3, { mouth: 'grin' });
  bust(faces, SIRA(), 138, 74, 3, { mouth: 'teeth', eyes: 'squint' });
  stage.add(makeText(kit.scene, 110, 90, '● REC  1/250', { fontSize: '5px', color: '#ffffff' }).setOrigin(0.5, 0));
  const flash = addG(kit, stage);
  kit.after(900, () => {
    flash.fillStyle(0xffffff, 1).fillRect(42, 8, 136, 92);
    kit.tween({ targets: flash, alpha: 0, duration: 400 });
    popText(kit, stage, 110, 20, '¡click!', '#ffffff', 9, 0);
  });
};

/** El lago al atardecer: los dos sentados en el pasto, el sol que baja y las tortugas. */
const lago: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, 60, 1);
    farallones(g, x, w, y + 58, '#4a3c6c');
    g.fillStyle(hex('#3c5c8c'), 1).fillRect(x, y + 58, w, 30);
    g.fillStyle(hex('#58a048'), 1).fillRect(x, y + 86, w, h - 86);
  });
  const sun = addG(kit, stage);
  const water = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    const sy = 30 + Math.min(24, t * 1.2);
    sun.clear();
    disc(sun, 150, Math.round(sy), 10, '#f8d070');
    sun.fillStyle(hex('#3c5c8c'), 1).fillRect(130, 58, 40, 20);
    water.clear();
    for (let i = 0; i < 6; i++) water.fillStyle(0xf8d070, 0.6).fillRect(140 + Math.round(Math.sin(t * 2 + i) * 4), 62 + i * 4, 20 - i * 3, 1);
    // Las tortugas que sacan la cabeza.
    const up = Math.sin(t * 1.3) > 0.3;
    water.fillStyle(hex('#3c6c3c'), 1).fillEllipse(60, 72, 12, 5);
    if (up) water.fillStyle(hex('#5a8c4a'), 1).fillRect(66, 69, 3, 3);
  });
  // Los dos de espaldas, sentados en el pasto, cada vez más juntos (ella apoya la cabeza al final).
  const backs = addG(kit, stage);
  let d = 0;
  kit.every(70, () => {
    d = Math.min(1, d + 0.01);
    backs.clear();
    const gap = lerp(30, 17, d);
    backView(backs, 100 - gap / 2, 108, playerLook(), 1.15);
    backView(backs, 100 + gap / 2, 108, SIRA(), 1.05, d >= 1 ? -3 : 0);
  });
  kit.every(1400, () => floatHeart(kit, stage, 108, 64));
};

/** ¡AAAÓ! El pavo real grita justo detrás de ellos. */
const pavoGrito: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    sky(g, x, y, w, h, 1);
    g.fillStyle(hex('#58a048'), 1).fillRect(x, y + 80, w, h - 80);
  });
  const p = addG(kit, stage);
  let t = 0;
  kit.every(50, () => {
    t += 0.05;
    p.clear();
    const shake = Math.round(Math.sin(t * 60) * 2);
    p.setX(shake);
    // El pavo real gigante, con el cuello estirado y el pico abierto.
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      p.lineStyle(3, hex('#2c8c5c'), 1).lineBetween(110, 92, 110 + Math.cos(a) * 56, 92 + Math.sin(a) * 50);
      disc(p, Math.round(110 + Math.cos(a) * 56), Math.round(92 + Math.sin(a) * 50), 4, '#2c6c9c');
    }
    p.fillStyle(hex('#2c6cc8'), 1).fillRect(106, 40, 8, 40);
    disc(p, 110, 36, 8, '#2c6cc8');
    p.fillStyle(hex('#f0c830'), 1).fillTriangle(117, 34, 128, 30, 117, 38);
    p.fillStyle(hex('#7a2a2a'), 1).fillTriangle(117, 38, 128, 42, 117, 40);
    p.fillStyle(hex('#ffffff'), 1).fillRect(112, 33, 2, 2);
    for (let i = 0; i < 3; i++) p.fillStyle(hex('#2c6cc8'), 1).fillRect(106 + i * 3, 22, 1, 6);
  });
  kit.after(100, () => popText(kit, stage, 168, 26, '¡¡AAAÓ!!', '#ffffff', 11, 0));
  // Los dos, del susto, agarrados.
  const us = addG(kit, stage);
  bust(us, playerLook(), 34, 82, 2.4, { mouth: 'o' });
  bust(us, SIRA(), 54, 84, 2.2, { mouth: 'o', eyes: 'closed' });
};

export const M7_VINETAS: Record<string, VinetaBuilder> = {
  m7_mudanza: mudanza,
  m7_wilmer: wilmer,
  m7_helado: helado,
  m7_helado_2: helado2,
  m7_maqueta: maqueta,
  m7_almuerzo: almuerzo,
  m7_selfie: selfie,
  m7_lago: lago,
  m7_pavo_grito: pavoGrito,
};
