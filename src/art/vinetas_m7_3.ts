import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { Backdrop, VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';
import { rnd, sinGorro, SIRA } from './vinetas_m7';

/**
 * Viñetas de la misión 7 (tercera parte, el viernes largo): la llovizna y el paraguas para dos, el charco, La Espiga,
 * la polera del 14, la loza, las tres cajas, la carta, la salsa en la sala, y lo que faltaba de la despedida.
 * Panel de 220 × 108 px.
 */

const pared = (wall: string, floor: string, floorY = 88): Backdrop => (g, x, y, w, h) => {
  g.fillStyle(hex(wall), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(floor), 1).fillRect(x, y + floorY, w, h - floorY);
};

/** Lluvia que cae por todo el panel. */
export function lluvia(kit: VinetaKit, stage: Layer, n = 36, color = 0xa8c8f0): void {
  const g = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    g.clear().fillStyle(color, 0.7);
    for (let i = 0; i < n; i++) g.fillRect(Math.floor((i * 37 + t * 24) % 220), Math.floor((i * 53 + t * 240) % 108), 1, 4);
  });
}

/** Copa de paraguas vista de lado, con sus varillas: centro (cx), borde inferior en `y`, ancho `w` y alto `h`. */
export function copa(g: G, cx: number, y: number, w: number, h: number, color = '#2a2c38'): void {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI - (i / 20) * Math.PI;
    pts.push({ x: cx + Math.cos(a) * (w / 2), y: y - Math.sin(a) * h });
  }
  g.fillStyle(hex(INK), 1).fillPoints(pts.map((p) => ({ x: p.x, y: p.y - 1 })), true);
  g.fillStyle(hex(color), 1).fillPoints(pts, true);
  g.fillStyle(hex('#4a4c5c'), 1);
  for (let i = -2; i <= 2; i++) g.fillRect(Math.round(cx + (i * w) / 5.4), y - 1, 1, 2);
  g.fillStyle(hex('#8a6a40'), 1).fillRect(Math.round(cx), y - h - 3, 1, 3);
}

/** Los dos caminando bajo un mismo paraguas. Devuelve la capa que se mece y un `update` para el saltito. */
function dosBajoParaguas(kit: VinetaKit, stage: Layer, x: number, floor: number, s = 1, abrir = false): void {
  const me = side(kit, stage, playerLook(), x, floor, { dir: 1, scale: s, eyes: 'open' });
  const her = side(kit, stage, SIRA(), x + 15 * s, floor, { dir: 1, scale: s * 0.92, eyes: 'open' });
  const g = addG(kit, stage);
  const cx = Math.round(x + 18 * s);
  const top = Math.round(floor - 62 * s);
  const draw = (k: number): void => {
    g.clear();
    g.fillStyle(hex('#8a6a40'), 1).fillRect(cx, top - 2, 1, Math.round(34 * s));
    if (k <= 0.05) return;
    copa(g, cx, top, Math.round(66 * s * k), Math.round(20 * s * k));
  };
  draw(1);
  if (abrir) {
    draw(0);
    kit.after(450, () => {
      kit.progress(260, draw, undefined, 'Back.Out');
      popText(kit, stage, cx, top - 14, '¡fop!', '#f8e070', 10, 800);
    });
  }
  let t = 0;
  kit.every(190, () => {
    t++;
    const b = t % 2;
    me.body.setY(Math.round(floor - 56 * s) - b);
    me.arm.setY(Math.round(floor - 56 * s) - b);
    her.body.setY(Math.round(floor - 56 * s * 0.92) - (1 - b));
    her.arm.setY(Math.round(floor - 56 * s * 0.92) - (1 - b));
    g.setY(-b);
  });
}

/** La vereda que pasa detrás mientras caminan, de día gris o de noche, con charcos que brillan. */
function veredaLluvia(kit: VinetaKit, stage: Layer, night: boolean): void {
  const wall = night ? '#232a44' : '#a98470';
  const lit = night ? '#f4d890' : '#cfe0ec';
  const g = addG(kit, stage);
  let off = 0;
  const draw = (): void => {
    g.clear();
    for (let i = -1; i < 7; i++) {
      const bx = i * 40 - (off % 40);
      g.fillStyle(hex(wall), 1).fillRect(bx, 8, 38, 66);
      g.fillStyle(hex(lit), 1).fillRect(bx + 6, 16, 10, 12).fillRect(bx + 22, 16, 10, 12).fillRect(bx + 6, 38, 10, 12).fillRect(bx + 22, 38, 10, 12);
    }
    g.fillStyle(hex(night ? '#2a2c38' : '#8c8c98'), 1).fillRect(0, 74, 220, 34);
    for (let i = -1; i < 7; i++) g.fillStyle(hex(night ? '#5a6894' : '#b4c4d4'), 0.8).fillEllipse(i * 52 + 26 - (off % 52), 96, 30, 5);
  };
  draw();
  kit.every(70, () => {
    off += 1.5;
    draw();
  });
}

const cielo = (night: boolean): Backdrop => (g, x, y, w, h) => g.fillStyle(hex(night ? '#0c1020' : '#7a8ca0'), 1).fillRect(x, y, w, h);

const paraguasAbre: VinetaBuilder = (kit) => {
  const stage = kit.framed(cielo(false));
  veredaLluvia(kit, stage, false);
  dosBajoParaguas(kit, stage, 88, 100, 1, true);
  lluvia(kit, stage);
};

const bajoParaguas: VinetaBuilder = (kit) => {
  const stage = kit.framed(cielo(false));
  veredaLluvia(kit, stage, false);
  dosBajoParaguas(kit, stage, 88, 100);
  lluvia(kit, stage);
  kit.every(1500, () => floatHeart(kit, stage, 106, 34));
};

const paraguasNoche: VinetaBuilder = (kit) => {
  const stage = kit.framed(cielo(true));
  veredaLluvia(kit, stage, true);
  dosBajoParaguas(kit, stage, 88, 100);
  lluvia(kit, stage, 30, 0x8aa8d8);
  kit.every(1500, () => floatHeart(kit, stage, 106, 34));
};

/** El ventanal del piso 8 con los primeros puntitos de la llovizna, y los dos asomados. */
const llovizna: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 92));
  const g = addG(kit, stage);
  outlined(g, [[30, 6, 160, 80, '#7c8ea2']]);
  g.fillStyle(hex('#5c6c7c'), 1).fillTriangle(30, 60, 90, 28, 150, 60);
  g.fillStyle(hex('#4c7050'), 1).fillRect(30, 60, 160, 26);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(109, 6, 2, 80);
  const drops: Array<{ x: number; y: number; v: number }> = [];
  const d = addG(kit, stage);
  kit.every(120, () => {
    if (drops.length < 46) drops.push({ x: 32 + Math.random() * 156, y: 8 + Math.random() * 30, v: Math.random() < 0.3 ? 0.9 : 0 });
    d.clear().fillStyle(0xdcecff, 0.85);
    for (const p of drops) {
      p.y = Math.min(84, p.y + p.v);
      d.fillRect(Math.round(p.x), Math.round(p.y), 1, 2);
    }
  });
  const us = addG(kit, stage);
  bust(us, sinGorro(playerLook()), 88, 82, 2.6, { mouth: 'smile' });
  bust(us, SIRA(), 124, 83, 2.4, { mouth: 'o' });
  kit.after(500, () => popText(kit, stage, 110, 18, 'plic... plic...', '#dcecff', 8, 0));
};

/** El closet y el paraguas negro de doña Mery, colgado entre las poleras. */
const closet: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#8a6444', '#6a4a30', 96));
  const g = addG(kit, stage);
  g.fillStyle(hex('#b8b8c0'), 1).fillRect(10, 16, 200, 2);
  ['#c84848', '#3a3c44', '#2f6fd0', '#e8c070', '#58a048', '#8a6ac0'].forEach((c, i) => {
    const px = 18 + i * 34 + (i > 2 ? 20 : 0);
    g.fillStyle(hex('#b8b8c0'), 1).fillRect(px + 12, 16, 1, 6);
    outlined(g, [[px, 22, 26, 44, c]]);
  });
  if (StoryState.hasFlag('m7_polera')) {
    g.fillStyle(hex('#8a6444'), 1).fillRect(85, 21, 28, 47);
    g.fillStyle(hex('#b8b8c0'), 1).fillRect(96, 16, 1, 8);
  } else stage.add(makeText(kit.scene, 99, 38, '14', { fontSize: '10px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5));
  const umb = addG(kit, stage);
  umb.fillStyle(hex('#2a2c38'), 1).fillTriangle(125, 22, 111, 74, 139, 74);
  umb.fillStyle(hex('#8a6a40'), 1).fillRect(124, 74, 2, 12);
  umb.lineStyle(1, 0x8a6a40, 1).strokeCircle(127, 88, 3);
  if (StoryState.hasItem('paraguas')) kit.every(800, () => sparkle(kit, stage, 118 + Math.random() * 14, 34 + Math.random() * 30));
};

/** ¡SPLASH! El alimentador y el charco más grande de Cañasgordas. */
const charco: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#7a8ca0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#54545f'), 1).fillRect(x, y + 72, w, h - 72);
    g.fillStyle(hex('#b4c4d4'), 0.7).fillEllipse(x + 110, y + 92, 120, 14);
  });
  const bus = addG(kit, stage);
  const me = side(kit, stage, playerLook(), 142, 102, { dir: -1, scale: 0.9, eyes: 'open' });
  side(kit, stage, SIRA(), 160, 102, { dir: -1, scale: 0.84, eyes: 'closed' });
  void me;
  const umb = addG(kit, stage);
  copa(umb, 158, 50, 58, 16);
  umb.fillStyle(hex('#8a6a40'), 1).fillRect(158, 50, 1, 22);
  const water = addG(kit, stage);
  lluvia(kit, stage, 26);
  kit.progress(1300, (k) => {
    const bx = lerp(-150, 90, k);
    bus.clear();
    outlined(bus, [[bx, 24, 130, 60, '#f2f2ee']]);
    bus.fillStyle(hex('#2c9c4c'), 1).fillRect(bx, 66, 130, 8);
    for (let i = 0; i < 4; i++) bus.fillStyle(hex('#8ac0e0'), 1).fillRect(bx + 6 + i * 31, 32, 26, 22);
    bus.fillStyle(hex('#1c1c24'), 1).fillCircle(bx + 28, 88, 8).fillCircle(bx + 102, 88, 8);
  }, () => {
    kit.scene.cameras.main.shake(180, 0.005);
    popText(kit, stage, 110, 18, '¡SPLASH!', '#a8e0ff', 14, 0);
    kit.progress(700, (k) => {
      water.clear().fillStyle(0xa8d8ff, 0.9);
      for (let i = 0; i < 24; i++) {
        const a = -0.2 - (i / 24) * 1.3;
        water.fillRect(Math.round(190 - 40 + Math.cos(a) * k * (60 + rnd(i) * 70)), Math.round(92 + Math.sin(a) * k * (50 + rnd(i + 5) * 60) + k * k * 18), 2, 3);
      }
    });
  });
};

/** La Espiga: el toldo a rayas, la vitrina con pandebonos y los dos refugiados, con la bolsa caliente. */
const panaderia: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e8d8b8', '#8c8c98', 84));
  const g = addG(kit, stage);
  outlined(g, [[20, 26, 104, 58, '#f8ecd0']]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) disc(g, 34 + c * 16, 44 + r * 18, 6, r ? '#e8b868' : '#f0d088');
  g.fillStyle(hex('#a07848'), 1).fillRect(20, 54, 104, 2);
  stage.add(makeText(kit.scene, 72, 28, 'HOY: PAN CHILENO', { fontSize: '6px', fontStyle: '600', color: '#c83c3c' }).setOrigin(0.5, 0));
  for (let i = 0; i < 11; i++) g.fillStyle(hex(i % 2 ? '#f4f0e4' : '#d83c3c'), 1).fillRect(i * 20, 0, 20, 18);
  for (let i = 0; i < 11; i++) g.fillStyle(hex(i % 2 ? '#f4f0e4' : '#d83c3c'), 1).fillTriangle(i * 20, 18, i * 20 + 20, 18, i * 20 + 10, 24);
  side(kit, stage, playerLook(), 136, 102, { dir: 1, scale: 0.92, eyes: 'open' });
  side(kit, stage, SIRA(), 158, 102, { dir: -1, scale: 0.86, eyes: 'open' });
  const bag = addG(kit, stage);
  outlined(bag, [[150, 74, 12, 14, '#c8a878']]);
  kit.every(450, () => {
    const s = addG(kit, stage);
    kit.progress(900, (k) => {
      s.clear().fillStyle(0xffffff, 0.6 * (1 - k)).fillCircle(156 + Math.sin(k * 7) * 2, lerp(74, 56, k), 2);
    }, () => s.destroy());
  });
  // La lluvia cae solo delante del toldo.
  const r = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    r.clear().fillStyle(0xa8c8f0, 0.75);
    for (let i = 0; i < 26; i++) r.fillRect(Math.floor((i * 37 + t * 20) % 220), 26 + Math.floor((i * 53 + t * 240) % 82), 1, 4);
  });
};

/** La boloñesa burbujeando a fuego lento: plop, plop. */
const ollaSalsa: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#b8b0a8', 76));
  const g = addG(kit, stage);
  outlined(g, [[60, 40, 100, 42, '#5a5c68']]);
  g.fillStyle(hex('#b8482c'), 1).fillRect(62, 38, 96, 8);
  flat(g, [[44, 46, 16, 4, '#3a3c44'], [160, 46, 16, 4, '#3a3c44'], [72, 88, 76, 4, '#e8603a']]);
  kit.every(380, () => {
    const b = addG(kit, stage);
    const x = 72 + Math.random() * 76;
    kit.progress(420, (k) => {
      b.clear();
      disc(b, Math.round(x), 40, Math.max(1, lerp(1, 5, k)), '#d8603c');
    }, () => {
      b.destroy();
      popText(kit, stage, x, 28, 'plop', '#fff2d0', 7, 300);
    });
  });
  kit.every(320, () => {
    const s = addG(kit, stage);
    const x = 74 + Math.random() * 70;
    kit.progress(1200, (k) => {
      s.clear().fillStyle(0xffffff, 0.45 * (1 - k)).fillCircle(x + Math.sin(k * 6) * 3, lerp(36, 4, k), 2 + k * 3);
    }, () => s.destroy());
  });
};

/** La olla de doña Mery con el agua hirviendo y el reloj que corre. */
const ollaAgua: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#b8b0a8', 76));
  const g = addG(kit, stage);
  outlined(g, [[56, 34, 84, 50, '#c8ccd4']]);
  g.fillStyle(hex('#9cc8e8'), 1).fillRect(58, 34, 80, 6);
  flat(g, [[72, 88, 52, 4, '#4a8cf0']]);
  stage.add(makeText(kit.scene, 98, 52, 'de doña Mery', { fontSize: '6px', color: INK }).setOrigin(0.5));
  outlined(g, [[160, 14, 46, 22, '#1c1c24']]);
  const t = makeText(kit.scene, 183, 19, '12:50', { fontSize: '10px', fontStyle: '600', color: '#f05a3a' }).setOrigin(0.5, 0);
  stage.add(t);
  let mins = 50;
  kit.every(1400, () => {
    mins = Math.min(57, mins + 1);
    t.setText(`12:${mins}`);
  });
  kit.every(170, () => {
    const b = addG(kit, stage);
    const x = 62 + Math.random() * 72;
    kit.progress(500, (k) => {
      b.clear().fillStyle(0xffffff, 0.8 * (1 - k)).fillCircle(x, lerp(38, 26, k), 2);
    }, () => b.destroy());
  });
};

/** Sira con la polera del 14, que le queda grande. */
const polera: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8c8ec'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle(hex('#c0d8f4'), 1).fillTriangle(x + 110, y + 54, x + 110 + Math.cos(a) * 170, y + 54 + Math.sin(a) * 170, x + 110 + Math.cos(a + 0.26) * 170, y + 54 + Math.sin(a + 0.26) * 170);
    }
  });
  const g = addG(kit, stage);
  const look = lookOf('sira_m7_polera');
  bust(g, look, 110, 40, 4.4, { mouth: 'teeth', eyes: 'open', blush: true });
  g.fillStyle(hex(INK), 1).fillRect(66, 74, 88, 34);
  g.fillStyle(hex('#2f6fd0'), 1).fillRect(68, 76, 84, 32);
  stage.add(makeText(kit.scene, 110, 80, '14', { fontSize: '20px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));
  kit.after(300, () => popText(kit, stage, 110, 8, '«¿Decías?»', '#ffffff', 9, 0));
  kit.every(500, () => floatHeart(kit, stage, 60 + Math.random() * 100, 58));
};

/** Dos platos humeantes con la boloñesa servida. */
const platos: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4f0ea'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 14) g.fillStyle(hex('#e8a0a8'), 1).fillRect(x + i, y + 56, 7, h - 56);
    g.fillStyle(hex('#f8f8f0'), 1).fillRect(x, y + 50, w, 6);
  });
  const g = addG(kit, stage);
  for (const px of [64, 156]) {
    g.fillStyle(hex(INK), 1).fillEllipse(px, 80, 76, 28);
    g.fillStyle(hex('#ffffff'), 1).fillEllipse(px, 79, 72, 25);
    g.fillStyle(hex('#f0dca0'), 1).fillEllipse(px, 77, 46, 16);
    g.fillStyle(hex('#b8482c'), 1).fillEllipse(px, 74, 30, 10);
    g.fillStyle(hex('#3c9050'), 1).fillEllipse(px + 4, 71, 7, 4);
  }
  kit.every(350, () => {
    const s = addG(kit, stage);
    const x = (Math.random() < 0.5 ? 64 : 156) - 10 + Math.random() * 20;
    kit.progress(1100, (k) => {
      s.clear().fillStyle(0xbcbcbc, 0.55 * (1 - k)).fillCircle(x + Math.sin(k * 6) * 3, lerp(66, 26, k), 2 + k * 2);
    }, () => s.destroy());
  });
  kit.every(1200, () => floatHeart(kit, stage, 108, 50));
};

/** Tú lavas, ella seca: y la guerra de espuma. */
const lozaJuntos: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#c8d4dc', 74));
  const g = addG(kit, stage);
  outlined(g, [[56, 74, 108, 34, '#c8ccd4']]);
  g.fillStyle(hex('#9cc8e8'), 1).fillRect(60, 76, 100, 8);
  const faces = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    faces.clear();
    bust(faces, sinGorro(playerLook()), 76, 44, 3, { mouth: 'teeth', eyes: t > 1.4 ? 'closed' : 'open' });
    bust(faces, SIRA(), 146, 45, 2.8, { mouth: 'teeth', eyes: 'squint', blush: true });
    if (t > 0.8) disc(faces, 146, 46, 4, '#ffffff');
    if (t > 1.4) {
      disc(faces, 68, 42, 7, '#ffffff');
      disc(faces, 84, 48, 8, '#ffffff');
      disc(faces, 74, 34, 5, '#ffffff');
    }
  });
  kit.every(140, () => {
    const b = addG(kit, stage);
    const x = 64 + Math.random() * 94;
    kit.progress(900, (k) => {
      b.lineStyle(1, 0xffffff, 0.8 * (1 - k)).clear();
      b.lineStyle(1, 0xffffff, 0.8 * (1 - k)).strokeCircle(x + Math.sin(k * 8) * 3, lerp(76, 40, k), 2 + k * 2);
    }, () => b.destroy());
  });
};

/** Una caja de la mudanza con su cinta y su letrero. */
function caja(g: G, stage: Layer, kit: VinetaKit, x: number, y: number, w: number, h: number, txt: string): void {
  outlined(g, [[x, y, w, h, '#c89c6c']]);
  g.fillStyle(hex('#e8d8a8'), 1).fillRect(x + w / 2 - 3, y, 6, h);
  g.fillStyle(hex('#a07848'), 1).fillRect(x, y + 8, w, 1);
  stage.add(makeText(kit.scene, x + w / 2, y + h / 2 + 2, txt, { fontSize: '8px', fontStyle: '600', color: INK }).setOrigin(0.5));
}

const cajas: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 76));
  const g = addG(kit, stage);
  caja(g, stage, kit, 16, 46, 60, 44, 'MANJAR');
  caja(g, stage, kit, 82, 36, 60, 54, 'VARIOS');
  caja(g, stage, kit, 148, 50, 60, 40, 'NO ABRIR');
  kit.every(900, () => sparkle(kit, stage, 20 + Math.random() * 180, 40 + Math.random() * 30));
};

/** Seis frascos de manjar envueltos en calcetines, y la cucharada de Sira. */
const cajaManjar: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e8d0a4', '#c89c6c', 90));
  const g = addG(kit, stage);
  outlined(g, [[14, 46, 112, 56, '#c89c6c']]);
  for (let i = 0; i < 6; i++) {
    const x = 22 + (i % 3) * 34;
    const y = 54 + Math.floor(i / 3) * 24;
    outlined(g, [[x, y, 24, 20, '#7a4c28']]);
    flat(g, [[x, y, 24, 4, '#f4f0e4'], [x + 3, y + 8, 18, 8, '#e8c858']]);
  }
  const f = addG(kit, stage);
  let t = 0;
  kit.every(100, () => {
    t += 0.1;
    f.clear();
    const shut = Math.sin(t * 1.6) > 0;
    bust(f, SIRA(), 172, 46, 4, { mouth: shut ? 'smile' : 'o', eyes: shut ? 'closed' : 'open', blush: true });
    f.fillStyle(hex('#b8b8c0'), 1).fillRect(186, 52 - (shut ? 2 : 0), 22, 2);
    disc(f, 186, 53, 3, '#a87038');
  });
  kit.after(700, () => popText(kit, stage, 172, 10, '«Es arequipe.»', '#fff2d0', 8, 0));
};

/** La carta de la mamá, doblada, con la letra redonda. */
const carta: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#55453a', '#3a2e26', 96));
  const g = addG(kit, stage);
  outlined(g, [[30, 8, 160, 92, '#faf4e4']]);
  g.fillStyle(hex('#e8dcc0'), 1).fillRect(30, 53, 160, 1);
  const lines = ['Hijo:', 'si estás leyendo esto,', 'ya estás extrañando.', 'Yo también.', 'Come bien. Abrígate.', 'Llama los domingos.', 'Te quiere, tu mamá'];
  lines.forEach((l, i) =>
    kit.after(250 + i * 380, () => stage.add(makeText(kit.scene, 40, 14 + i * 12, l, { fontSize: '8px', color: i === 6 ? '#c83c5c' : '#3a3a5a' }))),
  );
  kit.after(3300, () => {
    const h = addG(kit, stage);
    h.fillStyle(0xe8607a, 1).fillRect(164, 86, 4, 2).fillRect(170, 86, 4, 2).fillRect(164, 88, 10, 2).fillRect(166, 90, 6, 2).fillRect(168, 92, 2, 2);
  });
};

/** El celular dentro del vaso, las trompetas y las notas por todo el depa. */
const salsaIntro: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 84));
  const g = addG(kit, stage);
  outlined(g, [[82, 66, 56, 18, '#a07c50']]);
  outlined(g, [[96, 40, 28, 28, '#c8e4f0']]);
  outlined(g, [[103, 22, 14, 30, '#1c1c24']]);
  g.fillStyle(hex('#48c47c'), 1).fillRect(105, 25, 10, 22);
  const col = ['#e8607a', '#f0c030', '#4a9ad8', '#58b868'];
  kit.every(170, () => floatNote(kit, stage, 90 + Math.random() * 40, 30 + Math.random() * 20, col[Math.floor(Math.random() * 4)]));
  kit.after(400, () => popText(kit, stage, 44, 34, '¡tun!', '#f8e070', 11, 500));
  kit.after(900, () => popText(kit, stage, 176, 42, '¡ta-ká!', '#f8e070', 11, 500));
  kit.every(1000, () => stage.setX(stage.x === kit.panel.x ? kit.panel.x + 1 : kit.panel.x));
};

/** Bailando en la sala con el ventanal gris detrás, un compás de más. */
const salsaFin: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#d8ccbc', '#c89c6c', 92));
  const g = addG(kit, stage);
  outlined(g, [[14, 10, 70, 56, '#8a9cb0']]);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(48, 10, 2, 56);
  const me = side(kit, stage, playerLook(), 98, 104, { dir: 1, scale: 1.05, eyes: 'closed' }, true);
  const her = side(kit, stage, SIRA(), 114, 104, { dir: -1, scale: 0.96, eyes: 'closed' }, true);
  stage.bringToTop(me.arm);
  let t = 0;
  kit.every(200, () => {
    t++;
    const s = t % 2 ? 1 : -1;
    for (const part of [me.body, me.arm, her.body, her.arm]) part.setX(part.x + s);
  });
  kit.every(800, () => floatHeart(kit, stage, 106 + Math.random() * 18, 36));
};

/** Lo que faltaba de la noche: el techito del paradero, el beso del bus y tú solo, mirando el piso 8. */
const paraderoNoche: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0c1020'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a2c38'), 1).fillRect(x, y + 84, w, h - 84);
    g.fillStyle(hex('#f4d890'), 0.25).fillRect(x + 60, y + 90, 100, 2);
  });
  const g = addG(kit, stage);
  outlined(g, [[30, 18, 160, 10, '#3a7a58']]);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(38, 28, 4, 62).fillRect(178, 28, 4, 62);
  outlined(g, [[70, 74, 80, 6, '#8a6a40']]);
  side(kit, stage, playerLook(), 92, 100, { dir: 1, scale: 1, eyes: 'open' });
  side(kit, stage, SIRA(), 108, 100, { dir: -1, scale: 0.92, eyes: 'open' });
  lluvia(kit, stage, 30, 0x8aa8d8);
  kit.every(1200, () => floatHeart(kit, stage, 108, 40));
};

const besoBus: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0c1020'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a2c38'), 1).fillRect(x, y + 88, w, h - 88);
  });
  const bus = addG(kit, stage);
  outlined(bus, [[-20, 14, 120, 74, '#f2f2ee']]);
  bus.fillStyle(hex('#f8e8b0'), 1).fillRect(-14, 22, 80, 36);
  bus.fillStyle(hex('#3a3c44'), 1).fillRect(76, 22, 20, 64);
  bus.fillStyle(hex('#2c9c4c'), 1).fillRect(-20, 74, 76, 8);
  const c = addG(kit, stage);
  bust(c, lookOf('cajera'), 26, 40, 2, { eyes: 'squint', mouth: 'smile' });
  const me = side(kit, stage, playerLook(), 122, 100, { dir: 1, scale: 1, eyes: 'closed' }, true);
  side(kit, stage, SIRA(), 136, 98, { dir: -1, scale: 0.98, eyes: 'closed' }, true);
  stage.bringToTop(me.arm);
  lluvia(kit, stage, 30, 0x8aa8d8);
  kit.every(500, () => floatHeart(kit, stage, 132, 42));
};

const finalVineta: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#10142a'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a2c38'), 1).fillRect(x, y + 90, w, h - 90);
  });
  const t = addG(kit, stage);
  outlined(t, [[120, 0, 84, 92, '#8a5a3c']]);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) t.fillStyle(hex(r === 1 && c === 2 ? '#f8e070' : '#2a3048'), 1).fillRect(128 + c * 19, 8 + r * 14, 12, 8);
  const glow = addG(kit, stage);
  let k = 0;
  kit.every(90, () => {
    k += 0.09;
    glow.clear().fillStyle(0xf8e070, 0.25 + Math.sin(k * 2) * 0.1).fillCircle(172, 26, 14);
  });
  const g = addG(kit, stage);
  const me = playerLook();
  g.fillStyle(hex(INK), 1).fillRect(55, 58, 22, 40);
  g.fillStyle(hex(me.shirt), 1).fillRect(57, 60, 18, 24);
  g.fillStyle(hex(me.pants ?? '#3a4a78'), 1).fillRect(57, 84, 18, 14);
  disc(g, 66, 50, 10, INK);
  disc(g, 66, 50, 9, me.hair);
  lluvia(kit, stage, 26, 0x8aa8d8);
  if (StoryState.hasFlag('m7_bebida_calena')) {
    const b = addG(kit, stage);
    outlined(b, [[166, 28, 4, 8, '#e8b030']]);
  }
  kit.every(1400, () => floatHeart(kit, stage, 66, 36));
};

const lobby: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#efe8dc', '#b8a68c', 84));
  const g = addG(kit, stage);
  outlined(g, [[22, 14, 54, 70, '#8ac0d8']]);
  g.fillStyle(hex('#a8c8d8'), 1).fillRect(26, 18, 46, 24);
  outlined(g, [[120, 60, 80, 26, '#4a7c74']]);
  g.fillStyle(hex('#6a9c92'), 1).fillRect(124, 62, 72, 8);
  side(kit, stage, playerLook(), 80, 104, { dir: 1, scale: 0.9, eyes: 'open' });
  side(kit, stage, SIRA(), 98, 104, { dir: 1, scale: 0.84, eyes: 'open' });
  const bag = addG(kit, stage);
  outlined(bag, [[112, 76, 14, 18, '#ffffff']]);
  bag.fillStyle(hex('#2c9c4c'), 1).fillRect(114, 80, 10, 4);
  const r = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    r.clear().fillStyle(0xa8c8f0, 0.7);
    for (let i = 0; i < 12; i++) r.fillRect(26 + ((i * 17) % 46), 18 + ((i * 29 + Math.floor(t * 160)) % 62), 1, 4);
  });
};

export const M7_VINETAS_3: Record<string, VinetaBuilder> = {
  m7_paraguas_abre: paraguasAbre,
  m7_bajo_paraguas: bajoParaguas,
  m7_paraguas_noche: paraguasNoche,
  m7_llovizna: llovizna,
  m7_closet: closet,
  m7_charco: charco,
  m7_panaderia: panaderia,
  m7_olla_salsa: ollaSalsa,
  m7_olla_agua: ollaAgua,
  m7_polera: polera,
  m7_platos: platos,
  m7_loza_juntos: lozaJuntos,
  m7_cajas: cajas,
  m7_caja_manjar: cajaManjar,
  m7_carta: carta,
  m7_salsa_intro: salsaIntro,
  m7_salsa_fin: salsaFin,
  m7_paradero_noche: paraderoNoche,
  m7_beso_bus: besoBus,
  m7_final: finalVineta,
  m7_lobby: lobby,
};
