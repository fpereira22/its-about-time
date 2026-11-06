import Phaser from 'phaser';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, lerp, outlined, popText, seg7, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';
import { backView, rnd, SIRA, sinGorro } from './vinetas_m7';

/**
 * Viñetas de la misión 7 (segunda parte, el viernes): los golpes en la puerta, el abrazo, los ingredientes,
 * la nevera vacía, el choque en la Farmadía, las tres gaseosas (y la cara de Sira si eliges la suya), las amigas
 * mudas del lobby, el ascensor, el brindis, la peli del cometa, la cama, el beso, la lluvia, dormidos y el paradero.
 * Panel de 220 × 108 px.
 */

/** Color de la gaseosa que eligieron (flags `m7_bebida_*`). */
function drinkColor(): string {
  if (StoryState.hasFlag('m7_bebida_calena')) return '#e8b030';
  if (StoryState.hasFlag('m7_bebida_rojo')) return '#d83c3c';
  return '#3a2418';
}

/** Botella grande (de 1,5 litros) con su etiqueta, de `h` px de alto, con la base en (x, y). */
function bottle(g: G, x: number, y: number, liquid: string, label: string, cap: string, h = 54): void {
  outlined(g, [
    [x - 2, y - h, 5, 5, cap],
    [x - 4, y - h + 5, 9, 8, liquid],
    [x - 8, y - h + 13, 17, h - 13, liquid],
  ]);
  flat(g, [
    [x - 8, y - h + 24, 17, 14, label],
    [x - 6, y - h + 14, 2, 8, '#ffffff'],
  ]);
}

/** Una ventana con la lluvia que cae (líneas diagonales que se mueven). */
function rainWindow(kit: Parameters<VinetaBuilder>[0], layer: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, night: boolean): void {
  const g = addG(kit, layer);
  outlined(g, [[x, y, w, h, night ? '#141c34' : '#8a9cb0']]);
  g.fillStyle(hex(night ? '#2a3458' : '#a8b8c8'), 1).fillRect(x + w / 2 - 1, y, 2, h);
  const drops = addG(kit, layer);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    drops.clear();
    for (let i = 0; i < 18; i++) {
      const dx = x + 2 + ((i * 13 + t * 20) % (w - 4));
      const dy = y + 2 + ((i * 29 + t * 90) % (h - 8));
      drops.fillStyle(0xc8e4ff, 0.7).fillRect(Math.round(dx), Math.round(dy), 1, 4);
    }
  });
}

// ---------------------------------------------------------------------------
// La puerta, el abrazo y los ingredientes
// ---------------------------------------------------------------------------

/** TOC TOC: la puerta del 805 y, por el ojo mágico, Sira con la bolsa del mercado. */
const tocToc: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c89c6c'), 1).fillRect(x, y + 96, w, h - 96);
  });
  const door = addG(kit, stage);
  outlined(door, [[60, 4, 100, 100, '#7a4c30']]);
  flat(door, [[66, 10, 88, 40, '#8a5a3a'], [66, 56, 88, 44, '#8a5a3a'], [146, 54, 4, 8, '#e8c858'], [104, 8, 12, 4, '#e8c858']]);
  door.fillStyle(hex('#2a2433'), 1).fillRect(106, 9, 8, 2);
  // El ojo mágico: un círculo que se agranda con la cara de Sira deformada (ojo de pez).
  const eye = addG(kit, stage);
  kit.after(1100, () => {
    kit.progress(500, (k) => {
      eye.clear();
      const r = lerp(3, 34, k);
      disc(eye, 110, 44, r + 2, INK);
      disc(eye, 110, 44, r, '#a8d0ec');
      if (k > 0.6) {
        bust(eye, SIRA(), 110, 44, 4.2, { mouth: 'teeth', eyes: 'open' });
        eye.fillStyle(hex('#e8dcc0'), 1).fillRect(124, 54, 14, 14);
        eye.fillStyle(hex('#d83c3c'), 1).fillCircle(128, 54, 3);
        eye.fillStyle(hex('#58a048'), 1).fillRect(133, 49, 3, 6);
      }
    });
  });
  kit.after(100, () => popText(kit, stage, 36, 30, 'TOC', '#2a2433', 10, 900));
  kit.after(350, () => popText(kit, stage, 186, 44, 'TOC', '#2a2433', 10, 900));
  kit.after(600, () => popText(kit, stage, 40, 70, 'TOC', '#2a2433', 10, 900));
};

/** El abrazo en la puerta (la bolsa del mercado en el suelo y un tomate que se escapa rodando). */
const abrazo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7c6a8c'), 1).fillRect(x + 150, y, w - 150, h);
    g.fillStyle(hex('#7a4c30'), 1).fillRect(x + 146, y, 6, h);
    g.fillStyle(hex('#c89c6c'), 1).fillRect(x, y + 98, w, h - 98);
  });
  const me = side(kit, stage, playerLook(), 96, 100, { dir: 1, scale: 1, eyes: 'closed' }, true);
  const her = side(kit, stage, SIRA(), 112, 100, { dir: -1, scale: 0.92, eyes: 'closed' }, true);
  stage.bringToTop(me.arm);
  void her;
  const bag = addG(kit, stage);
  outlined(bag, [[132, 84, 18, 16, '#e8dcc0']]);
  bag.fillStyle(hex('#58a048'), 1).fillRect(136, 78, 2, 8).fillRect(142, 80, 4, 6);
  bag.fillStyle(hex('#e88838'), 1).fillRect(139, 76, 2, 9);
  const tomato = addG(kit, stage);
  kit.progress(2400, (k) => {
    tomato.clear();
    disc(tomato, lerp(150, 200, k), 96, 3, '#d83c3c');
  });
  kit.every(600, () => floatHeart(kit, stage, 104 + Math.random() * 8, 42));
};

/** Lo que trajo Sira para la salsa, en el mesón. */
const ingredientes: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e4ecf0'), 1).fillRect(x, y, w, 70);
    for (let i = 0; i < w; i += 10) g.fillStyle(hex('#c8d4dc'), 1).fillRect(x + i, y, 1, 70);
    g.fillStyle(hex('#e8e4dc'), 1).fillRect(x, y + 70, w, h - 70);
  });
  const g = addG(kit, stage);
  const items: Array<[number, string, (g: G, x: number) => void]> = [
    [24, 'tomates', (gg, x) => [0, 8, 4].forEach((d, i) => disc(gg, x + d - 4, 62 - i * 6, 6, '#d83c3c'))],
    [56, 'zanahorias', (gg, x) => [0, 4].forEach((d) => gg.fillStyle(hex('#e88838'), 1).fillRect(x - 8 + d, 54 - d, 18, 4))],
    [88, 'cebolla', (gg, x) => (disc(gg, x, 58, 8, '#d0a8cc'), gg.fillStyle(hex('#a87c48'), 1).fillRect(x - 1, 47, 2, 4))],
    [118, 'ajo', (gg, x) => disc(gg, x, 62, 5, '#f4f0e4')],
    [150, 'carne molida', (gg, x) => (outlined(gg, [[x - 12, 52, 24, 14, '#f8f8f0']]), gg.fillStyle(hex('#c84848'), 1).fillRect(x - 10, 54, 20, 10))],
    [186, 'laurel y albahaca', (gg, x) => [0, 6, 12].forEach((d) => gg.fillStyle(hex('#3c9050'), 1).fillEllipse(x - 6 + d, 58 - (d % 4), 6, 10))],
  ];
  items.forEach(([x, name, draw], i) => {
    kit.after(i * 280, () => {
      draw(g, x);
      stage.add(makeText(kit.scene, x, 76, name, { fontSize: '6px', color: INK, align: 'center', wordWrap: { width: 44 } }).setOrigin(0.5, 0));
      sparkle(kit, stage, x + 6, 44);
    });
  });
  stage.add(makeText(kit.scene, 110, 6, '«La boloñesa de mi abuela. Secreta.»', { fontSize: '7px', fontStyle: '600', color: INK }).setOrigin(0.5, 0));
};

/** La nevera del chileno: agua de la llave, medio limón, salsa de tomate y una cubeta de hielo vacía. */
const nevera: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  outlined(g, [[56, 2, 108, 104, '#e8ecf0']]);
  g.fillStyle(hex('#f8fcff'), 1).fillRect(60, 6, 100, 96);
  for (const y of [34, 64]) g.fillStyle(hex('#c8d4dc'), 1).fillRect(60, y, 100, 2);
  disc(g, 80, 28, 6, '#c8d848');
  g.fillStyle(hex('#f8fcff'), 1).fillRect(74, 22, 6, 12);
  outlined(g, [[110, 44, 8, 18, '#d83c3c'], [126, 90, 26, 8, '#c8e4f0'], [70, 50, 12, 12, '#a8c8e8']]);
  stage.add(makeText(kit.scene, 76, 52, 'agua', { fontSize: '5px', color: INK }));
  const light = addG(kit, stage);
  light.fillStyle(0xfff8d0, 0.25).fillTriangle(110, 6, 40, 108, 180, 108);
  kit.after(500, () => popText(kit, stage, 110, 18, 'eco... eco...', '#5a6c7c', 8, 0));
};

// ---------------------------------------------------------------------------
// La Farmadía
// ---------------------------------------------------------------------------

/** El choque en el pasillo angosto: se dan vuelta al mismo tiempo y quedan nariz con nariz. */
const choque: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0f0ec'), 1).fillRect(x, y, w, h);
    for (const sx of [0, 170]) {
      g.fillStyle(hex('#9ca2ae'), 1).fillRect(x + sx, y, 50, h);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) g.fillStyle(hex(['#e85a5a', '#5a8ce8', '#f0c830', '#58b868', '#c868c8'][(r + c) % 5]), 1).fillRect(x + sx + 3 + c * 6, y + 6 + r * 20, 4, 10);
    }
  });
  const g = addG(kit, stage);
  const me = playerLook();
  const her = SIRA();
  const profile = (x: number, dir: 1 | -1, look: HumanLook, s: number, eyes: boolean, blush: boolean): void => {
    const r = (dx: number, dy: number, w: number, h: number, c: string): void => {
      const xx = dir === 1 ? x + dx * s : x - (dx + w) * s;
      g.fillStyle(hex(c), 1).fillRect(Math.round(xx), Math.round(24 + dy * s), Math.ceil(w * s), Math.ceil(h * s));
    };
    r(-1, -1, 16, 20, INK);
    r(0, 0, 14, 18, look.skin);
    r(14, 7, 2, 3, look.skin);
    r(0, -2, 13, 6, look.hair);
    if (look.hairStyle === 'long') r(-2, 0, 6, 26, look.hair);
    else r(-1, 0, 4, 10, look.hair);
    r(10, 5, 2, eyes ? 2 : 0.6, '#202028');
    r(12, 13, 3, 1, '#c86868');
    if (blush) r(6, 10, 4, 3, '#f08890');
    r(1, 18, 10, 12, look.shirt);
  };
  let k = 0;
  kit.every(50, () => {
    k = Math.min(1, k + 0.06);
    g.clear();
    const gap = lerp(60, 3, k);
    profile(110 - gap - 14 * 2.6, 1, me, 2.6, true, k >= 1);
    profile(110 + gap + 14 * 2.4, -1, her, 2.4, true, k >= 1);
  });
  kit.after(800, () => {
    popText(kit, stage, 110, 14, '¡ay!', '#e85a5a', 10, 1000);
    // Lo que se cayó de los estantes.
    for (let i = 0; i < 4; i++) {
      const box = addG(kit, stage);
      const bx = 70 + i * 26;
      kit.progress(700, (t) => {
        box.clear();
        box.fillStyle(hex(['#5a8ce8', '#f0c830', '#58b868', '#e85a5a'][i]), 1).fillRect(bx, lerp(10, 96, t), 6, 8);
      });
    }
  });
  kit.after(1700, () => floatHeart(kit, stage, 108, 30));
  kit.after(2300, () => floatHeart(kit, stage, 112, 30));
};

/** La nevera de las bebidas: La Caleña (dorada), Coca-Kola y Rojosazón. */
const bebidas: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#3a3c44'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8e4f0'), 1).fillRect(x + 6, y + 4, w - 12, h - 8);
    g.fillStyle(hex('#8a9ca8'), 1).fillRect(x + 6, y + 80, w - 12, 3);
  });
  const g = addG(kit, stage);
  const list: Array<[number, string, string, string, string]> = [
    [52, '#e8b030', '#d83c3c', '#d83c3c', 'LA CALEÑA'],
    [110, '#3a2418', '#d83c3c', '#d83c3c', 'COCA-KOLA'],
    [168, '#d83c3c', '#f8f8f0', '#2c9c4c', 'ROJOSAZÓN'],
  ];
  for (const [x, liquid, label, cap, name] of list) {
    bottle(g, x, 80, liquid, label, cap);
    stage.add(makeText(kit.scene, x, 86, name, { fontSize: '6px', fontStyle: '600', color: INK }).setOrigin(0.5, 0));
  }
  // Una palmita en la etiqueta de La Caleña y burbujas que suben en las tres.
  g.fillStyle(hex('#58a048'), 1).fillRect(51, 50, 2, 6).fillRect(48, 49, 8, 2);
  g.fillStyle(hex('#3a2418'), 1).fillRect(103, 52, 14, 2);
  disc(g, 168, 52, 3, '#d83c3c');
  kit.every(160, () => {
    const x = list[Math.floor(Math.random() * 3)][0] - 4 + Math.random() * 8;
    const b = addG(kit, stage);
    kit.progress(900, (t) => {
      b.clear();
      b.fillStyle(0xffffff, 0.7 * (1 - t)).fillCircle(x, lerp(76, 40, t), 1);
    }, () => b.destroy());
  });
  // El frío de la nevera.
  kit.every(700, () => sparkle(kit, stage, 20 + Math.random() * 180, 10 + Math.random() * 20));
};

/** «¡¿Cómo supiste?!»: La Caleña es su favorita (desde chiquita). */
const calena: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f8d880'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle(hex('#fce8a8'), 1).fillTriangle(x + 110, y + 54, x + 110 + Math.cos(a) * 160, y + 54 + Math.sin(a) * 160, x + 110 + Math.cos(a + 0.25) * 160, y + 54 + Math.sin(a + 0.25) * 160);
    }
  });
  const face = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    face.clear();
    const s = 4 + Math.sin(t * 6) * 0.15;
    bust(face, SIRA(), 96, 54, s, { mouth: t < 1.4 ? 'o' : 'teeth', eyes: t < 1.4 ? 'open' : 'squint' });
  });
  const b = addG(kit, stage);
  bottle(b, 160, 96, '#e8b030', '#d83c3c', '#d83c3c', 66);
  b.fillStyle(hex('#58a048'), 1).fillRect(159, 54, 2, 6).fillRect(156, 53, 8, 2);
  kit.after(200, () => popText(kit, stage, 100, 10, '¡¿CÓMO SUPISTE?!', '#d83c3c', 10, 0));
  kit.every(300, () => sparkle(kit, stage, 130 + Math.random() * 60, 20 + Math.random() * 60));
  kit.every(700, () => floatHeart(kit, stage, 70 + Math.random() * 50, 40));
};

/** Las amigas de Feli en el sofá del lobby: no dicen nada. Nada. Solo miran. */
const amigas: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#efe8dc'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#4a7c74'), 1).fillRect(x + 10, y + 70, w - 20, 38);
    g.fillStyle(hex('#6a9c92'), 1).fillRect(x + 14, y + 74, w - 28, 10);
  });
  const g = addG(kit, stage);
  const cast: Array<[HumanLook, number]> = [
    [lookOf('valentina'), 50],
    [lookOf('isa'), 110],
    [lookOf('pao'), 170],
  ];
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    g.clear();
    // Los ojos los siguen de izquierda a derecha (ustedes cruzan el lobby).
    const look = Math.round(Math.sin(Math.min(t, 3) / 3 * Math.PI - Math.PI / 2) * 1.5);
    for (const [l, cx] of cast) {
      bust(g, l, cx, 56, 3.6, { mouth: 'o', eyes: 'open', blush: true });
      g.fillStyle(hex('#ffffff'), 1).fillRect(cx - 9, 53, 5, 4).fillRect(cx + 4, 53, 5, 4);
      g.fillStyle(hex('#202028'), 1).fillRect(cx - 7 + look, 54, 2, 2).fillRect(cx + 6 + look, 54, 2, 2);
    }
    // A Isa se le cae el celular.
    const fall = Math.min(1, Math.max(0, (t - 1.2) / 0.6));
    g.fillStyle(hex(INK), 1).fillRect(126, lerp(76, 100, fall), 8, 12);
    g.fillStyle(hex('#5a8ce8'), 1).fillRect(127, lerp(77, 101, fall), 6, 9);
  });
  kit.after(400, () => popText(kit, stage, 50, 14, '...', INK, 12, 0));
  kit.after(800, () => popText(kit, stage, 110, 14, '...', INK, 12, 0));
  kit.after(1200, () => popText(kit, stage, 170, 14, '...', INK, 12, 0));
};

/** El ascensor: el indicador que baja de a un piso, el espejo y los dos, cada vez menos lejos. */
const ascensor: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a0a8b8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8d0dc'), 1).fillRect(x + 20, y + 10, 70, 90);
    g.fillStyle(hex('#d8e0ea'), 1).fillRect(x + 24, y + 14, 62, 82);
    g.fillStyle(hex('#68707e'), 1).fillRect(x, y + 100, w, h - 100);
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x + 150, y + 6, 40, 24);
  });
  const display = addG(kit, stage);
  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  let i = 0;
  const show = (): void => {
    display.clear();
    const f = floors[Math.min(i, floors.length - 1)];
    if (f === 0) {
      display.fillStyle(hex('#f05a3a'), 1).fillRect(160, 10, 2, 14).fillRect(160, 22, 8, 2);
    } else seg7(display, 160, 10, f, '#f05a3a', '#3a2020', 8, 14, 2);
    const up = i >= 8;
    display.fillStyle(hex('#f05a3a'), 1).fillTriangle(178, up ? 22 : 12, 186, up ? 22 : 12, 182, up ? 12 : 22);
  };
  show();
  kit.every(420, () => {
    if (i < floors.length - 1) {
      i++;
      show();
      if (floors[i] === 0) popText(kit, stage, 170, 40, '¡ding!', '#f8e070', 8, 700);
    }
  });
  // Los dos de lado; en el espejo, el reflejo.
  const me = side(kit, stage, playerLook(), 112, 100, { dir: 1, scale: 0.9, eyes: 'open' });
  const her = side(kit, stage, SIRA(), 158, 100, { dir: -1, scale: 0.84, eyes: 'open' });
  const mirror = addG(kit, stage);
  mirror.fillStyle(0xffffff, 0.25).fillRect(30, 30, 50, 60);
  bust(mirror, playerLook(), 44, 54, 2, { mouth: 'smile' });
  bust(mirror, SIRA(), 64, 56, 1.8, { mouth: 'smile' });
  kit.progress(6000, (k) => {
    me.body.setX(lerp(112, 124, k));
    me.arm.setX(lerp(112, 124, k));
    her.body.setX(lerp(158, 144, k));
    her.arm.setX(lerp(158, 144, k));
  });
  kit.every(500, () => floatNote(kit, stage, 196, 50, '#ffffff'));
};

// ---------------------------------------------------------------------------
// La comida, la peli y la cama
// ---------------------------------------------------------------------------

/** ¡Salud! Los dos vasos con la gaseosa que eligieron, sobre los platos de boloñesa. */
const brindis: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#f8f8f0'), 1).fillRect(x, y + 70, w, h - 70);
    for (let i = 0; i < w; i += 14) g.fillStyle(hex('#e8a0a8'), 1).fillRect(x + i, y + 70, 7, h - 70);
  });
  const plates = addG(kit, stage);
  for (const px of [60, 160]) {
    plates.fillStyle(hex(INK), 1).fillEllipse(px, 90, 70, 22);
    plates.fillStyle(hex('#ffffff'), 1).fillEllipse(px, 89, 66, 19);
    plates.fillStyle(hex('#f0dca0'), 1).fillEllipse(px, 88, 40, 12);
    plates.fillStyle(hex('#b8482c'), 1).fillEllipse(px, 86, 26, 8);
    plates.fillStyle(hex('#3c9050'), 1).fillEllipse(px + 3, 84, 6, 3);
  }
  const glasses = addG(kit, stage);
  const c = drinkColor();
  kit.progress(700, (k) => {
    glasses.clear();
    for (const [x0, x1, dir] of [[70, 100, 1], [150, 120, -1]] as const) {
      const x = lerp(x0, x1, k);
      const tilt = Math.round(k * 3) * dir;
      glasses.fillStyle(hex(INK), 1).fillRect(x - 9 + tilt, 30, 18, 34);
      glasses.fillStyle(hex('#e8f4fc'), 1).fillRect(x - 8 + tilt, 31, 16, 32);
      glasses.fillStyle(hex(c), 1).fillRect(x - 8 + tilt, 40, 16, 23);
      glasses.fillStyle(0xffffff, 0.6).fillRect(x - 6 + tilt, 34, 2, 26);
    }
  }, () => {
    popText(kit, stage, 110, 16, '¡Salud!', '#e85a7a', 10, 0);
    for (let i = 0; i < 6; i++) sparkle(kit, stage, 100 + Math.random() * 20, 24 + Math.random() * 10);
  });
  kit.every(1200, () => floatHeart(kit, stage, 110, 60));
};

/** La peli del cometa: en la tele, el cielo partido en dos con el cometa; ellos, de espaldas en el sofá. */
const peli: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#0c1020'), 1).fillRect(x, y, w, h));
  const tv = addG(kit, stage);
  outlined(tv, [[40, 4, 140, 72, '#1c1c24']]);
  const screen = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    screen.clear();
    // Dos cielos: el atardecer de él (izquierda) y la noche de ella (derecha).
    screen.fillStyle(hex('#f0a070'), 1).fillRect(44, 8, 66, 64);
    screen.fillStyle(hex('#e87a8a'), 1).fillRect(44, 8, 66, 22);
    screen.fillStyle(hex('#1c2c6c'), 1).fillRect(110, 8, 66, 64);
    for (let i = 0; i < 14; i++) screen.fillStyle(0xffffff, 0.8).fillRect(112 + Math.floor(rnd(i) * 62), 10 + Math.floor(rnd(i + 30) * 40), 1, 1);
    // El cometa que cruza los dos cielos, con su estela partida.
    const k = (t * 0.12) % 1;
    const cx = lerp(52, 168, k);
    const cy = lerp(14, 50, k);
    screen.lineStyle(2, 0xffffff, 0.9).lineBetween(cx, cy, cx - 22, cy - 8);
    screen.lineStyle(1, 0x9cd8ff, 0.8).lineBetween(cx, cy, cx - 26, cy - 3);
    disc(screen, Math.round(cx), Math.round(cy), 2, '#ffffff');
    // El cordón rojo (el hilo del destino).
    screen.lineStyle(1, 0xe83c4c, 1).lineBetween(60, 64, 160, 64 + Math.round(Math.sin(t * 2) * 3));
    screen.fillStyle(hex('#3a5a3a'), 1).fillRect(44, 66, 132, 6);
  });
  stage.add(makeText(kit.scene, 110, 74, '«Tu nombre bajo el cometa»', { fontSize: '6px', color: '#c8d4f0' }).setOrigin(0.5, 0));
  // El sofá y los dos de espaldas, ella con la cabeza en tu hombro.
  const sofa = addG(kit, stage);
  sofa.fillStyle(hex('#a07c50'), 1).fillRect(50, 92, 120, 16);
  sofa.fillStyle(hex('#c8a070'), 1).fillRect(50, 88, 120, 6);
  const backs = addG(kit, stage);
  backView(backs, 100, 118, playerLook(), 1);
  backView(backs, 120, 118, SIRA(), 0.92, -4);
  if (StoryState.hasItem('crispetas') || StoryState.hasFlag('m7_crispetas_comidas')) {
    const pop = addG(kit, stage);
    pop.fillStyle(hex('#f8f8f0'), 1).fillRect(132, 82, 12, 14);
    pop.fillStyle(hex('#d83c3c'), 1).fillRect(132, 82, 3, 14).fillRect(138, 82, 3, 14);
    for (let i = 0; i < 6; i++) disc(pop, 133 + (i % 3) * 4, 80 - Math.floor(i / 3) * 3, 2, '#fff4c8');
  }
  kit.every(1600, () => floatHeart(kit, stage, 112, 62));
};

/** Acostados, frente a frente, mientras afuera se nubla. */
const cama: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#2c3048'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#425e98'), 1).fillRect(x, y + 72, w, h - 72);
    g.fillStyle(hex('#f0f2f8'), 1).fillRect(x + 40, y + 58, 140, 16);
  });
  rainWindow(kit, stage, 150, 6, 60, 40, false);
  const g = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    g.clear();
    // Las dos caras de lado sobre la almohada, mirándose.
    bust(g, sinGorro(playerLook()), 84, 58, 3.2, { mouth: 'smile', eyes: Math.sin(t * 2) > 0.95 ? 'closed' : 'open' });
    bust(g, SIRA(), 136, 59, 3, { mouth: Math.sin(t) > 0.3 ? 'teeth' : 'smile', eyes: Math.sin(t * 2 + 1) > 0.95 ? 'closed' : 'open' });
    g.fillStyle(hex('#5c7cb8'), 1).fillRect(40, 76, 140, 32);
    g.fillStyle(hex('#7c9cd4'), 1).fillRect(40, 76, 140, 3);
  });
  kit.every(900, () => floatHeart(kit, stage, 110, 46));
};

/** El beso: las dos caras de perfil se juntan, cierran los ojos... y afuera se larga la lluvia. */
const beso: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c2034'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#425e98'), 1).fillRect(x, y + 84, w, h - 84);
  });
  rainWindow(kit, stage, 6, 6, 70, 54, false);
  rainWindow(kit, stage, 144, 6, 70, 54, false);
  const g = addG(kit, stage);
  const me = sinGorro(playerLook());
  const her = SIRA();
  const profile = (x: number, dir: 1 | -1, look: HumanLook, s: number, eyes: boolean): void => {
    const r = (dx: number, dy: number, w: number, h: number, c: string): void => {
      const xx = dir === 1 ? x + dx * s : x - (dx + w) * s;
      g.fillStyle(hex(c), 1).fillRect(Math.round(xx), Math.round(28 + dy * s), Math.ceil(w * s), Math.ceil(h * s));
    };
    r(-1, -1, 16, 20, INK);
    r(0, 0, 14, 18, look.skin);
    r(14, 7, 2, 3, look.skin);
    r(0, -2, 13, 6, look.hair);
    if (look.hairStyle === 'long') r(-2, 0, 6, 26, look.hair);
    else r(-1, 0, 4, 10, look.hair);
    r(10, 5, 2, eyes ? 2 : 0.6, '#202028');
    r(12, 13, 3, 1, '#c86868');
    r(6, 10, 4, 3, '#f0a0a8');
    r(1, 18, 10, 10, look.shirt);
  };
  let d = 0;
  let kissed = false;
  kit.every(60, () => {
    d = Math.min(1, d + 0.012);
    g.clear();
    const gap = lerp(30, 0, d);
    profile(110 - gap - 15 * 3, 1, me, 3, d < 0.7);
    profile(110 + gap + 15 * 2.8, -1, her, 2.8, d < 0.6);
    if (d >= 1 && !kissed) {
      kissed = true;
      // El corazón que explota.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const h = addG(kit, stage, 110, 40);
        kit.progress(1100, (k) => {
          h.clear();
          h.fillStyle(0xf05a7a, 1 - k).fillRect(Math.round(Math.cos(a) * k * 40), Math.round(Math.sin(a) * k * 30), 3, 3);
        }, () => h.destroy());
      }
      popText(kit, stage, 110, 12, '♥', '#ff6a8a', 14, 0);
    }
  });
  kit.after(5200, () => kit.every(500, () => floatHeart(kit, stage, 100 + Math.random() * 20, 36)));
};

/** Pasan las horas: dormidos abrazados, la lluvia en el ventanal y el reloj del velador que avanza. */
const dormidos: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#10142a'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2c3c6c'), 1).fillRect(x, y + 70, w, h - 70);
  });
  rainWindow(kit, stage, 20, 6, 110, 52, true);
  const g = addG(kit, stage);
  bust(g, sinGorro(playerLook()), 92, 64, 3, { eyes: 'closed', mouth: 'smile' });
  bust(g, SIRA(), 112, 66, 2.8, { eyes: 'closed', mouth: 'smile' });
  g.fillStyle(hex('#425e98'), 1).fillRect(40, 76, 150, 32);
  g.fillStyle(hex('#5c7cb8'), 1).fillRect(40, 76, 150, 3);
  // El brazo de él por encima de ella.
  g.fillStyle(hex(INK), 1).fillRect(96, 74, 30, 6);
  g.fillStyle(hex(playerLook().shirt), 1).fillRect(97, 75, 28, 4);
  // El reloj digital del velador.
  const clock = addG(kit, stage);
  const times = ['17:40', '18:15', '18:52', '19:30', '20:05', '20:35'];
  let i = 0;
  const show = (): void => {
    clock.clear();
    clock.fillStyle(hex('#1c1c24'), 1).fillRect(160, 26, 52, 22);
    const [hh, mm] = times[i].split(':');
    const digits = (hh + mm).split('').map(Number);
    digits.forEach((dg, k) => seg7(clock, 163 + k * 12 + (k >= 2 ? 3 : 0), 30, dg, '#f05a3a', '#3a2020', 8, 14, 2));
    clock.fillStyle(hex('#f05a3a'), 1).fillRect(186, 34, 2, 2).fillRect(186, 40, 2, 2);
  };
  show();
  kit.every(800, () => {
    if (i < times.length - 1) {
      i++;
      show();
    }
  });
  kit.every(700, () => floatZ(kit, stage, 104, 50));
};

/** El paradero de noche: llovizna, el bus iluminado y Sira en la ventana, despidiéndose con las dos manos. */
const paradero: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0c1020'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a2c38'), 1).fillRect(x, y + 84, w, h - 84);
    for (let i = 0; i < 12; i++) g.fillStyle(0xf8d070, 0.25).fillRect(x + i * 20, y + 90, 8, 1);
  });
  const bus = addG(kit, stage);
  outlined(bus, [[20, 20, 180, 66, '#f2f2ee']]);
  bus.fillStyle(hex('#2c9c4c'), 1).fillRect(20, 70, 180, 8);
  for (let i = 0; i < 4; i++) bus.fillStyle(hex('#f8e8b0'), 1).fillRect(28 + i * 44, 28, 36, 30);
  const her = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    her.clear();
    bust(her, SIRA(), 98, 46, 2.6, { mouth: 'smile' });
    // Las dos manos que saludan.
    const wv = Math.round(Math.sin(t * 6) * 2);
    her.fillStyle(hex(SIRA().skin), 1).fillRect(80 + wv, 36, 4, 6).fillRect(112 - wv, 36, 4, 6);
    // El vidrio empañado y un corazón dibujado con el dedo.
    her.fillStyle(0xffffff, 0.18).fillRect(72, 28, 36, 30);
    her.lineStyle(1, 0xffffff, 0.8).strokeCircle(126, 40, 3).strokeCircle(132, 40, 3);
    her.lineBetween(123, 41, 129, 49).lineBetween(135, 41, 129, 49);
  });
  const rain = addG(kit, stage);
  kit.every(60, () => {
    rain.clear();
    for (let i = 0; i < 40; i++) rain.fillStyle(0xa8c8f0, 0.6).fillRect(Math.floor(rnd(i + t) * 220), Math.floor(rnd(i * 3 + t) * 108), 1, 4);
  });
  kit.every(1300, () => floatHeart(kit, stage, 126, 30));
};

/** El vecino del 807: mullet, barba, bata y una taza. «¿Ustedes también escucharon un pavo real?» */
const vecino: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#7c6a8c'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7a4c30'), 1).fillRect(x + 70, y, 80, h);
    g.fillStyle(hex('#3a2418'), 1).fillRect(x + 76, y + 6, 68, h - 6);
  });
  const g = addG(kit, stage);
  bust(g, lookOf('vecino_807'), 110, 52, 4, { mouth: 'o', eyes: 'squint' });
  outlined(g, [[140, 70, 12, 14, '#f8f8f0']]);
  g.fillStyle(hex('#5a3020'), 1).fillRect(142, 72, 8, 3);
  stage.add(makeText(kit.scene, 110, 6, '807', { fontSize: '7px', color: '#e8c858' }).setOrigin(0.5, 0));
  kit.after(300, () => popText(kit, stage, 50, 30, '¿...?', '#ffffff', 9, 0));
};

export const M7_VINETAS_2: Record<string, VinetaBuilder> = {
  m7_toc_toc: tocToc,
  m7_abrazo: abrazo,
  m7_ingredientes: ingredientes,
  m7_nevera: nevera,
  m7_choque: choque,
  m7_bebidas: bebidas,
  m7_calena: calena,
  m7_amigas: amigas,
  m7_ascensor: ascensor,
  m7_brindis: brindis,
  m7_peli: peli,
  m7_cama: cama,
  m7_beso: beso,
  m7_dormidos: dormidos,
  m7_paradero: paradero,
  m7_vecino: vecino,
};
