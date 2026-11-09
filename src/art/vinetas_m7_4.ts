import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { Backdrop, VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, lerp, outlined, popText, sparkle, type Layer } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';
import { sinGorro, SIRA } from './vinetas_m7';
import { lluvia } from './vinetas_m7_3';

/**
 * Viñetas de la misión 7 (cuarta parte): las gráficas de lo que se mira y se toca. El depa, el pasillo del piso 8,
 * el lobby, la Calle 18, la Farmadía, la U y las llamadas. Así ningún diálogo queda sin dibujo.
 * Panel de 220 × 108 px.
 */

const pared = (wall: string, floor: string, floorY = 88): Backdrop => (g, x, y, w, h) => {
  g.fillStyle(hex(wall), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(floor), 1).fillRect(x, y + floorY, w, h - floorY);
};

/** ¿Ya está lloviendo en la historia? */
const estaLloviendo = (): boolean => StoryState.weather === 'lluvia' || StoryState.weather === 'tormenta';

function label(kit: VinetaKit, stage: Layer, x: number, y: number, text: string, color: string = INK, size = 7, width = 180): void {
  stage.add(makeText(kit.scene, x, y, text, { fontSize: `${size}px`, fontStyle: '600', color, align: 'center', wordWrap: { width } }).setOrigin(0.5, 0));
}

// ---------------------------------------------------------------------------
// El depa
// ---------------------------------------------------------------------------

/** Lo que te mandó doña Mery: la olla, tres arepas congeladas y la bendición. */
const ollaMery: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f3e4c8', '#b98a5c', 84));
  const g = addG(kit, stage);
  outlined(g, [[28, 44, 76, 42, '#8a8c98'], [18, 52, 10, 5, '#3a3c44'], [104, 52, 10, 5, '#3a3c44'], [40, 36, 52, 8, '#9c9ea8']]);
  [0, 1, 2].forEach((i) => {
    disc(g, 146 + i * 22, 74, 12, INK);
    disc(g, 146 + i * 22, 74, 11, '#f0dca0');
    g.fillStyle(0xcce8ff, 0.8).fillRect(140 + i * 22, 70, 5, 2);
  });
  label(kit, stage, 110, 8, '«Coma bien, mijo.»', '#7a4c30', 9);
  kit.every(900, () => floatHeart(kit, stage, 60 + Math.random() * 120, 40));
};

/** Despierta: la luz de lado, la almohada marcada en la cara y el celular. */
const despertar: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#dfe7ef'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#fff4c8'), 0.75).fillTriangle(x + 220, y, x + 40, y + 108, x + 220, y + 108);
    g.fillStyle(hex('#425e98'), 1).fillRect(x, y + 74, w, h - 74);
  });
  const g = addG(kit, stage);
  flat(g, [[46, 64, 128, 14, '#f0f2f8']]);
  bust(g, sinGorro(playerLook()), 110, 56, 3.4, { mouth: 'smile', eyes: 'squint', messy: true });
  g.fillStyle(hex('#d88a8a'), 1).fillRect(122, 52, 6, 1).fillRect(122, 56, 8, 1).fillRect(123, 60, 6, 1);
  g.fillStyle(hex('#5c7cb8'), 1).fillRect(30, 80, 160, 28);
  kit.after(500, () => popText(kit, stage, 180, 34, 'bzz bzz', '#fff2a0', 8, 0));
  kit.every(1500, () => sparkle(kit, stage, 180, 50));
};

/** El depa antes de ordenar: ropa, loza y cajas por todos lados. */
const desorden: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 76));
  const g = addG(kit, stage);
  outlined(g, [[12, 50, 40, 36, '#c89c6c'], [54, 58, 34, 28, '#b98c5c']]);
  label(kit, stage, 32, 62, 'MANJAR', INK, 6, 40);
  outlined(g, [[140, 66, 62, 18, '#c8ccd4']]);
  for (let i = 0; i < 4; i++) disc(g, 150 + i * 13, 64 - (i % 2) * 3, 6, '#f8f8f0');
  flat(g, [[100, 92, 26, 6, '#2050a8'], [118, 86, 18, 5, '#3a3c44'], [78, 98, 12, 3, '#e8e8e0'], [128, 98, 10, 3, '#c84848']]);
  label(kit, stage, 110, 8, '12:58 – 90 min = pánico', '#c83c5c', 9);
  kit.every(1100, () => floatZ(kit, stage, 110, 40, '#8a6444'));
};

const loza: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#c8d4dc', 76));
  const g = addG(kit, stage);
  outlined(g, [[40, 54, 140, 40, '#c8ccd4']]);
  g.fillStyle(hex('#a8b0bc'), 1).fillRect(46, 60, 128, 22);
  disc(g, 90, 72, 16, INK);
  disc(g, 90, 72, 15, '#f8f8f0');
  g.fillStyle(hex('#3a2c20'), 1).fillEllipse(90, 72, 18, 8);
  outlined(g, [[120, 58, 22, 22, '#6a6c78']]);
  g.fillStyle(hex('#e8c060'), 1).fillRect(124, 62, 14, 5);
  outlined(g, [[106, 24, 8, 28, '#b8bcc8']]);
  const d = addG(kit, stage);
  kit.progress(1400, (k) => {
    d.clear();
    d.fillStyle(0x9cc8e8, 1).fillRect(109, lerp(52, 76, k % 1), 2, 4);
  });
  kit.every(1600, () => popText(kit, stage, 160, 40, 'plic', '#dcecff', 8, 400));
};

const meson: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#e0d8c8', 70));
  const g = addG(kit, stage);
  outlined(g, [[38, 54, 74, 20, '#c8a070']]);
  outlined(g, [[66, 38, 6, 18, '#b8bcc8'], [66, 56, 6, 10, '#3a3c44']]);
  outlined(g, [[128, 38, 18, 34, '#e8e8f0'], [156, 28, 14, 44, '#b89838']]);
  label(kit, stage, 137, 50, 'sal', INK, 6, 18);
  label(kit, stage, 163, 46, 'ace.', INK, 6, 14);
  outlined(g, [[178, 44, 30, 28, '#f4e8c8']]);
  label(kit, stage, 193, 54, 'fideos', '#7a4c30', 5, 28);
  kit.every(1200, () => sparkle(kit, stage, 70, 42));
};

const ropa: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 60));
  const g = addG(kit, stage);
  g.fillStyle(hex(INK), 1).fillRect(46, 72, 62, 22);
  g.fillStyle(hex('#2050a8'), 1).fillRect(48, 74, 58, 18);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(112, 80, 54, 14);
  g.fillStyle(hex('#e8e8e0'), 1).fillRect(20, 82, 18, 8);
  g.fillStyle(hex('#c84848'), 1).fillRect(172, 78, 18, 8);
  g.fillStyle(hex('#f0f0e4'), 1).fillRect(148, 62, 44, 8);
  label(kit, stage, 110, 8, 'Inventario del piso', '#7a4c30', 9);
  label(kit, stage, 29, 92, 'par A', INK, 6, 30);
  label(kit, stage, 181, 88, 'par Z', INK, 6, 30);
  kit.every(900, () => sparkle(kit, stage, 40 + Math.random() * 140, 72 + Math.random() * 20));
};

const ducha: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#c8dce4', '#a8c0cc', 92));
  const g = addG(kit, stage);
  outlined(g, [[100, 8, 20, 8, '#b8bcc8'], [116, 14, 4, 18, '#b8bcc8'], [92, 30, 36, 5, '#8a8c98']]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) g.fillStyle(hex('#dceaf0'), 1).fillRect(10 + c * 26, 12 + r * 22, 24, 20);
  const r = addG(kit, stage);
  let t = 0;
  kit.every(50, () => {
    t += 0.05;
    r.clear().fillStyle(0x9ccce8, 0.9);
    for (let i = 0; i < 26; i++) r.fillRect(94 + (i % 9) * 4, 36 + ((i * 17 + Math.floor(t * 200)) % 56), 1, 4);
  });
  kit.every(280, () => {
    const s = addG(kit, stage);
    const x = 70 + Math.random() * 80;
    kit.progress(1000, (k) => {
      s.clear().fillStyle(0xffffff, 0.5 * (1 - k)).fillCircle(x, lerp(90, 40, k), 3 + k * 5);
    }, () => s.destroy());
  });
  kit.after(500, () => popText(kit, stage, 110, 14, '¡CALIENTE!', '#fff2a0', 10, 0));
};

const wc: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#d8e4e8', '#bccccc', 90));
  const g = addG(kit, stage);
  outlined(g, [[56, 18, 108, 66, '#ffffff']]);
  label(kit, stage, 110, 24, 'POR FAVOR', '#c83c3c', 9);
  label(kit, stage, 110, 40, 'no botar el papel al inodoro', INK, 8, 96);
  label(kit, stage, 110, 66, '(Bobo Unic Living)', '#6a6c78', 6, 100);
  kit.after(800, () => popText(kit, stage, 190, 54, '¿?', '#fff2a0', 10, 0));
};

const perfume: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#dfe7ef', '#bccccc', 90));
  const g = addG(kit, stage);
  outlined(g, [[96, 44, 34, 46, '#e8c858'], [104, 28, 18, 16, '#3a3c44'], [108, 18, 10, 10, '#b8bcc8']]);
  g.fillStyle(hex('#f8e8a8'), 1).fillRect(100, 48, 6, 36);
  label(kit, stage, 113, 62, 'Eau', INK, 7, 28);
  kit.every(300, () => {
    const p = addG(kit, stage);
    const a = -0.9 + Math.random() * 0.5;
    kit.progress(800, (k) => {
      p.clear().fillStyle(0xe8d8ff, 0.8 * (1 - k)).fillCircle(120 + Math.cos(a) * k * 80, 22 + Math.sin(a) * k * 60, 1 + k * 2);
    }, () => p.destroy());
  });
  kit.after(500, () => popText(kit, stage, 56, 30, '«Para ocasiones especiales»', '#fff2d0', 7, 0));
};

/** El ventanal: sol, nublado, llovizna o aguacero de noche, según cómo vaya el día. */
const ventana: VinetaBuilder = (kit) => {
  const noche = StoryState.hasFlag('m7_noche');
  const llueve = estaLloviendo();
  const nublado = StoryState.weather === 'nublado';
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 96));
  const g = addG(kit, stage);
  outlined(g, [[24, 6, 172, 88, noche ? '#141c34' : llueve || nublado ? '#8a9cb0' : '#7cb8e8']]);
  g.fillStyle(hex(noche ? '#22283f' : '#5c6c7c'), 1).fillTriangle(24, 66, 90, 30, 156, 66);
  g.fillStyle(hex(noche ? '#2a3040' : '#4c7050'), 1).fillRect(24, 66, 172, 28);
  g.fillStyle(hex('#c8ccd0'), 1).fillRect(36, 72, 86, 14);
  for (let i = 0; i < 9; i++) g.fillStyle(hex('#2c4a7c'), 1).fillRect(38 + i * 9, 74, 7, 10);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(109, 6, 2, 88);
  if (noche) for (let i = 0; i < 26; i++) g.fillStyle(0xf8e0a0, 0.8).fillRect(28 + ((i * 41) % 164), 60 + ((i * 23) % 30), 1, 1);
  if (llueve) lluvia(kit, stage, 30, noche ? 0x8aa8d8 : 0xdcecff);
  else if (nublado) {
    const c = addG(kit, stage);
    let t = 0;
    kit.every(90, () => {
      t += 0.5;
      c.clear().fillStyle(0xc8d0d8, 0.9);
      for (let i = 0; i < 4; i++) c.fillEllipse(30 + ((i * 60 + t) % 160), 18 + i * 5, 50, 12);
    });
  } else {
    disc(g, 170, 22, 9, '#f8e070');
    kit.every(1000, () => sparkle(kit, stage, 170, 22));
  }
};

const poster: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 100));
  const g = addG(kit, stage);
  outlined(g, [[46, 6, 128, 92, '#7cb8e8']]);
  g.fillStyle(hex('#4a7ca8'), 1).fillRect(48, 76, 124, 20);
  const casas: Array<[number, number, string]> = [[52, 52, '#e85a5a'], [68, 44, '#f0c830'], [84, 54, '#58b868'], [100, 40, '#e8903c'], [116, 50, '#5a8ce8'], [132, 46, '#c868c8'], [148, 56, '#f0f0e4']];
  for (const [x, y, c] of casas) outlined(g, [[x, y, 14, 76 - y, c]]);
  label(kit, stage, 110, 10, 'VALPARAÍSO', '#ffffff', 10);
  kit.every(1200, () => floatHeart(kit, stage, 60 + Math.random() * 100, 38));
};

const estante: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#c8a078', '#8a6444', 96));
  const g = addG(kit, stage);
  for (const y of [38, 76]) g.fillStyle(hex('#7a4c30'), 1).fillRect(10, y, 200, 4);
  outlined(g, [[20, 8, 30, 30, '#3a5a8a']]);
  label(kit, stage, 35, 16, 'Optim.', '#ffffff', 6, 28);
  flat(g, [[70, 14, 2, 24, '#8a6a40'], [72, 14, 18, 6, '#d83c3c'], [72, 20, 18, 6, '#ffffff'], [72, 14, 6, 6, '#2f6fd0']]);
  outlined(g, [[120, 48, 40, 26, '#ffffff']]);
  label(kit, stage, 140, 52, 'PUCC', '#2f6fd0', 8, 38);
  outlined(g, [[40, 44, 28, 32, '#7a4c28'], [40, 44, 28, 6, '#f4f0e4']]);
  label(kit, stage, 54, 56, '½', '#f8e070', 10, 20);
  kit.every(1000, () => sparkle(kit, stage, 80, 30));
};

const sabila: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0ebe2', '#c89c6c', 92));
  const g = addG(kit, stage);
  outlined(g, [[86, 66, 48, 28, '#c8704c']]);
  g.fillStyle(hex('#58a048'), 1);
  for (const [dx, h] of [[-30, 34], [-18, 48], [0, 56], [18, 48], [30, 34]] as const) g.fillTriangle(110 + dx - 6, 66, 110 + dx * 1.5, 66 - h, 110 + dx + 6, 66);
  label(kit, stage, 110, 6, '«Si se pone amarilla, me llama.»', '#3c7038', 8);
  kit.every(1100, () => sparkle(kit, stage, 90 + Math.random() * 40, 30 + Math.random() * 30));
};

const velador: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#1c2238', '#3a3048', 88));
  const g = addG(kit, stage);
  outlined(g, [[36, 58, 148, 40, '#8a6444']]);
  outlined(g, [[46, 40, 42, 18, '#1c1c24']]);
  const t = makeText(kit.scene, 67, 44, '', { fontSize: '10px', fontStyle: '600', color: '#f05a3a' }).setOrigin(0.5, 0);
  stage.add(t);
  const tick = (): void => {
    const m = Math.floor(StoryState.clock % 1440);
    t.setText(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  };
  tick();
  kit.every(1000, tick);
  outlined(g, [[104, 16, 66, 42, '#f8f4ec']]);
  g.fillStyle(hex('#b4c8dc'), 1).fillRect(108, 20, 58, 34);
  const f = addG(kit, stage);
  bust(f, lookOf('mama'), 120, 36, 1.3, { mouth: 'smile' });
  bust(f, lookOf('papa'), 136, 34, 1.4, { mouth: 'smile' });
  bust(f, lookOf('hermano'), 154, 40, 1.1, { eyes: 'closed', mouth: 'teeth' });
};

const cineflix: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#101018'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  label(kit, stage, 110, 6, 'CineFlix', '#e85a5a', 12);
  label(kit, stage, 110, 22, 'Perfil: «Andrés (ya no vive aquí)»', '#9c9ca8', 6);
  const films: Array<[number, string, string]> = [[12, '#2c3c7c', 'Tu nombre bajo el cometa'], [80, '#a83c28', 'Rápidos y Furiosos 23: Furia en Marte'], [148, '#c8dce8', 'La vida secreta de los pingüinos']];
  for (const [x, c, t] of films) {
    outlined(g, [[x, 34, 60, 66, c]]);
    label(kit, stage, x + 30, 66, t, x === 148 ? INK : '#ffffff', 6, 54);
  }
  const star = addG(kit, stage);
  star.fillStyle(0xffffff, 1).fillRect(40, 44, 3, 3);
  star.lineStyle(1, 0xffffff, 0.7).lineBetween(41, 45, 24, 40);
  disc(g, 110, 50, 8, '#c84828');
  disc(g, 178, 50, 8, '#2a2433');
  disc(g, 178, 52, 5, '#ffffff');
  let sel = 0;
  const cursor = addG(kit, stage);
  const draw = (): void => {
    cursor.clear().lineStyle(2, 0xf8e070, 1).strokeRect(11 + sel * 68, 33, 62, 68);
  };
  draw();
  kit.every(900, () => {
    sel = (sel + 1) % 3;
    draw();
  });
};

const siraChef: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#e0d8c8', 84));
  const g = addG(kit, stage);
  let t = 0;
  kit.every(100, () => {
    t += 0.1;
    g.clear();
    bust(g, SIRA(), 110, 46, 4.2, { mouth: Math.sin(t * 2) > 0 ? 'teeth' : 'smile', eyes: 'open' });
    g.fillStyle(hex('#f8f8f0'), 1).fillRect(84, 86, 52, 22);
    g.fillStyle(hex('#c84848'), 1).fillRect(84, 86, 52, 3);
    outlined(g, [[150, Math.round(40 + Math.sin(t * 3) * 3), 5, 34, '#a07848']]);
  });
  label(kit, stage, 110, 6, '«La receta de mi abuela no se negocia.»', '#7a4c30', 8);
};

const bostezo: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#3c4258', '#a07c50', 84));
  const g = addG(kit, stage);
  let t = 0;
  kit.every(120, () => {
    t += 0.12;
    g.clear();
    const y1 = Math.sin(t) > 0;
    bust(g, sinGorro(playerLook()), 78, 54, 3.3, { mouth: y1 ? 'o' : 'smile', eyes: y1 ? 'closed' : 'squint' });
    bust(g, SIRA(), 142, 56, 3.1, { mouth: y1 ? 'smile' : 'o', eyes: y1 ? 'squint' : 'closed' });
  });
  kit.every(800, () => floatZ(kit, stage, 110, 40));
  label(kit, stage, 110, 6, '3:12 pasa la cuenta', '#dce4f8', 9);
};

const confesion: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#1c2034'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  let t = 0;
  kit.every(100, () => {
    t += 0.1;
    g.clear();
    bust(g, SIRA(), 110, 52, 6, { mouth: t > 3 ? 'smile' : 'o', eyes: Math.sin(t * 1.2) > 0.96 ? 'closed' : 'open', blush: true });
    g.fillStyle(0xffffff, 0.7).fillRect(92, 44, 3, 2).fillRect(120, 44, 3, 2);
  });
  kit.every(480, () => {
    const h = addG(kit, stage);
    kit.progress(420, (k) => {
      h.clear().fillStyle(0xe8607a, 1 - k).fillCircle(36, 54, 6 + k * 12);
    }, () => h.destroy());
  });
  label(kit, stage, 36, 80, 'tum', '#ffc0cc', 7, 40);
};

const zapatos: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#1c2238', '#2c3c6c', 72));
  const g = addG(kit, stage);
  outlined(g, [[62, 80, 40, 16, '#f4efe4'], [118, 80, 40, 16, '#f4efe4']]);
  g.fillStyle(hex('#c84848'), 1).fillRect(66, 86, 30, 2).fillRect(122, 86, 30, 2);
  const ar = addG(kit, stage);
  let t = 0;
  kit.every(400, () => {
    t++;
    const flip = t % 4 < 2;
    ar.clear().fillStyle(0xf8e070, 1);
    if (flip) ar.fillTriangle(70, 66, 88, 66, 70, 74).fillTriangle(146, 66, 128, 66, 146, 74);
    else ar.fillTriangle(88, 66, 70, 66, 88, 74).fillTriangle(128, 66, 146, 66, 128, 74);
  });
  outlined(addG(kit, stage), [[160, 14, 46, 22, '#1c1c24']]);
  label(kit, stage, 183, 19, '20:35', '#f05a3a', 11, 46);
  kit.after(200, () => popText(kit, stage, 80, 24, '¡¿LAS OCHO Y MEDIA?!', '#ffb0b0', 9, 0));
  lluvia(kit, stage, 16, 0x8aa8d8);
};

// ---------------------------------------------------------------------------
// El pasillo del piso 8, el ascensor y el lobby
// ---------------------------------------------------------------------------

function puerta(kit: VinetaKit, num: string): Layer {
  const stage = kit.framed(pared('#7c6a8c', '#5a4c68', 96));
  const g = addG(kit, stage);
  outlined(g, [[66, 6, 88, 90, '#7a4c30']]);
  flat(g, [[72, 12, 76, 36, '#8a5a3a'], [72, 54, 76, 36, '#8a5a3a'], [140, 52, 4, 8, '#e8c858']]);
  label(kit, stage, 110, 16, num, '#e8c858', 12, 60);
  return stage;
}

const puerta801: VinetaBuilder = (kit) => {
  const stage = puerta(kit, '801');
  kit.every(200, () => floatNote(kit, stage, 40 + Math.random() * 140, 90));
  kit.every(400, () => stage.setX(stage.x === kit.panel.x ? kit.panel.x + 1 : kit.panel.x));
  kit.after(200, () => popText(kit, stage, 110, 66, 'PUM PUM PUM', '#fff2a0', 10, 0));
};

const puerta803: VinetaBuilder = (kit) => {
  const stage = puerta(kit, '803');
  const g = addG(kit, stage);
  disc(g, 110, 72, 12, INK);
  disc(g, 110, 72, 11, '#f0dca0');
  kit.every(280, () => {
    const s = addG(kit, stage);
    const x = 90 + Math.random() * 40;
    kit.progress(1100, (k) => {
      s.clear().fillStyle(0xf0dca0, 0.6 * (1 - k)).fillCircle(x + Math.sin(k * 6) * 4, lerp(62, 26, k), 2 + k * 3);
    }, () => s.destroy());
  });
};

const puerta809: VinetaBuilder = (kit) => {
  const stage = puerta(kit, '809');
  const g = addG(kit, stage);
  outlined(g, [[82, 40, 56, 44, '#fbf6d8']]);
  label(kit, stage, 110, 44, 'NO MOLESTAR', '#c83c3c', 7, 54);
  label(kit, stage, 110, 54, 'TESIS.', INK, 8, 54);
  label(kit, stage, 110, 68, 'si es domicilio, sí molestar', '#6a6c78', 5, 52);
};

const boton: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#a0a8b8', '#68707e', 96));
  const g = addG(kit, stage);
  outlined(g, [[54, 8, 112, 92, '#c8d0dc']]);
  outlined(g, [[86, 18, 48, 22, '#1c1c24']]);
  const piso = StoryState.location?.map === 'bobo_lobby' ? 'L' : '8';
  label(kit, stage, 110, 21, piso, '#f05a3a', 14, 40);
  [0, 1].forEach((i) => {
    disc(g, 96 + i * 28, 66, 10, INK);
    disc(g, 96 + i * 28, 66, 9, i === 0 ? '#e8e8f0' : '#f8e070');
  });
  label(kit, stage, 96, 61, '▼', INK, 8, 16);
  label(kit, stage, 124, 61, '▲', INK, 8, 16);
  label(kit, stage, 110, 84, 'Máx. 8 personas', INK, 6, 100);
  g.fillStyle(hex('#e8b8c8'), 0.8).fillEllipse(150, 94, 18, 6);
  kit.every(1400, () => floatNote(kit, stage, 180, 60, '#ffffff'));
};

const escalera: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#b8bcc8'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  for (let i = 0; i < 9; i++) outlined(g, [[20 + i * 20, 92 - i * 10, 22, 8 + i * 10, '#8a8c98']]);
  outlined(g, [[172, 8, 40, 20, '#4ac47c']]);
  label(kit, stage, 192, 12, 'SALIDA', '#ffffff', 7, 38);
  label(kit, stage, 60, 8, '8 pisos. Ni loco.', '#3a3c44', 9, 110);
};

const buzones: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#9c8a70', '#6a5a48', 96));
  const g = addG(kit, stage);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const on = r === 1 && c === 2;
    outlined(g, [[20 + c * 38, 8 + r * 30, 34, 26, on ? '#e8c858' : '#b8bcc8']]);
    g.fillStyle(hex('#3a3c44'), 1).fillRect(26 + c * 38, 18 + r * 30, 22, 2);
    if (on) label(kit, stage, 37 + c * 38, 11 + r * 30, '805', INK, 7, 30);
  }
  kit.every(900, () => sparkle(kit, stage, 110, 50));
};

const notaAmigas: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#4a7c74', '#3a5a54', 92));
  const g = addG(kit, stage);
  outlined(g, [[40, 10, 140, 86, '#fbf6d8']]);
  label(kit, stage, 110, 16, 'VALE + ISA + PAO', '#c83c5c', 9, 130);
  label(kit, stage, 110, 34, '¡¡¡¿¿¿SIRA???!!!', '#c83c5c', 12, 130);
  label(kit, stage, 110, 58, 'Nos debes un café.', INK, 8, 130);
  label(kit, stage, 110, 70, 'Y una explicación.', INK, 8, 130);
  label(kit, stage, 110, 82, 'Y un café.', INK, 8, 130);
};

// ---------------------------------------------------------------------------
// La Calle 18 y la U
// ---------------------------------------------------------------------------

const calleDia: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#54545f'), 1).fillRect(x, y + 70, w, 24);
    g.fillStyle(hex('#c8c4b8'), 1).fillRect(x, y + 94, w, 14);
    for (let i = 0; i < 8; i++) g.fillStyle(hex('#f8f8f0'), 1).fillRect(x + i * 30, y + 80, 16, 2);
  });
  const g = addG(kit, stage);
  outlined(g, [[14, 18, 16, 52, '#2c5cc8'], [160, 22, 48, 48, '#8a5a3c']]);
  label(kit, stage, 22, 26, 'PC', '#ffffff', 7, 14);
  label(kit, stage, 184, 40, 'U', '#ffffff', 16, 40);
  disc(g, 200, 14, 8, '#f8e070');
  const bus = addG(kit, stage);
  kit.progress(4200, (k) => {
    bus.clear();
    const x = lerp(240, -80, k);
    outlined(bus, [[x, 50, 70, 26, '#f2f2ee']]);
    bus.fillStyle(hex('#2c9c4c'), 1).fillRect(x, 68, 70, 4);
    for (let i = 0; i < 4; i++) bus.fillStyle(hex('#8ac0e0'), 1).fillRect(x + 4 + i * 16, 54, 13, 10);
  });
};

const campus: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7cc070'), 1).fillRect(x, y + 66, w, h - 66);
    g.fillStyle(hex('#d8c8a4'), 1).fillRect(x, y + 84, w, 12);
  });
  const g = addG(kit, stage);
  for (const x of [34, 176]) {
    g.fillStyle(hex('#7a5a3c'), 1).fillRect(x - 3, 44, 7, 26);
    disc(g, x, 34, 22, '#4c9050');
  }
  outlined(g, [[84, 28, 56, 40, '#f0e0c0']]);
  label(kit, stage, 112, 34, 'PUCC', '#7a4c30', 9, 52);
  const pavo = addG(kit, stage);
  ['#2c7cb8', '#3c9c6c', '#2c5ca8', '#3c9c6c', '#2c7cb8'].forEach((c, i) => {
    const a = -2.5 + i * 0.45;
    pavo.lineStyle(3, hex(c), 1).lineBetween(154, 82, 154 + Math.cos(a) * 18, 82 + Math.sin(a) * 18);
  });
  pavo.fillStyle(hex('#2c4c98'), 1).fillRect(151, 74, 6, 12);
  disc(pavo, 154, 72, 3, '#2c4c98');
  kit.every(1300, () => sparkle(kit, stage, 154, 66));
};

const efrain: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#d8c8a4'), 1).fillRect(x, y + 86, w, h - 86);
  });
  const g = addG(kit, stage);
  outlined(g, [[112, 50, 84, 40, '#f4f0e4']]);
  g.fillStyle(hex('#e85a7a'), 1).fillRect(112, 62, 84, 8);
  label(kit, stage, 154, 52, 'HELADOS', '#c83c5c', 8, 80);
  disc(g, 130, 94, 7, '#3a3c44');
  disc(g, 178, 94, 7, '#3a3c44');
  const f = addG(kit, stage);
  let t = 0;
  kit.every(120, () => {
    t += 0.12;
    f.clear();
    bust(f, lookOf('heladero'), 60, 50, 3.8, { mouth: Math.sin(t * 3) > 0 ? 'teeth' : 'smile', eyes: 'squint' });
  });
  ['#c8d848', '#8a2c5c', '#f4f0e4', '#c8884c'].forEach((c, i) => {
    disc(g, 124 + i * 20, 42, 9, INK);
    disc(g, 124 + i * 20, 42, 8, c);
  });
  kit.every(800, () => sparkle(kit, stage, 124 + Math.random() * 60, 34));
};

const lasDeTaller: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7cc070'), 1).fillRect(x, y + 76, w, h - 76);
  });
  const g = addG(kit, stage);
  let t = 0;
  kit.every(110, () => {
    t += 0.11;
    g.clear();
    bust(g, lookOf('majo'), 44, 56, 3.4, { mouth: Math.sin(t * 5) > 0 ? 'teeth' : 'open', eyes: 'open' });
    bust(g, SIRA(), 110, 54, 3.6, { mouth: 'smile', eyes: 'open', blush: true });
    bust(g, lookOf('cata'), 176, 57, 3.3, { mouth: 'smile', eyes: 'squint' });
    g.fillStyle(hex('#f8f4ec'), 1).fillRect(166, 84, 24, 16);
  });
  kit.after(400, () => popText(kit, stage, 44, 16, 'bla bla bla', '#fff2d0', 8, 0));
  kit.after(900, () => popText(kit, stage, 110, 12, '¡MAJO!', '#ffc0cc', 9, 0));
};

const croquera: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#7cc070', '#6aa862', 96));
  const g = addG(kit, stage);
  outlined(g, [[40, 8, 140, 92, '#fbf6e8']]);
  g.fillStyle(hex('#c8c0a8'), 1).fillRect(108, 8, 2, 92);
  const draw = addG(kit, stage);
  kit.progress(1800, (k) => {
    draw.clear().fillStyle(hex('#3a3a5a'), 1);
    const n = Math.floor(k * 40);
    for (let i = 0; i < n; i++) {
      const a = (i / 12) * Math.PI * 2;
      draw.fillRect(Math.round(70 + Math.cos(a) * 12), Math.round(42 + Math.sin(a) * 12), 1, 1);
      if (i > 12) draw.fillRect(Math.round(132 + Math.cos(a) * 10), Math.round(44 + Math.sin(a) * 10), 1, 1);
    }
  }, () => {
    const h = addG(kit, stage);
    h.fillStyle(0xe8607a, 1).fillRect(96, 30, 5, 2).fillRect(104, 30, 5, 2).fillRect(96, 32, 13, 3).fillRect(98, 35, 9, 2).fillRect(101, 37, 3, 2);
  });
};

const pavo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7cc070'), 1).fillRect(x, y + 80, w, h - 80);
  });
  const g = addG(kit, stage);
  let t = 0;
  const palette = ['#2c7cb8', '#3c9c6c', '#2c5ca8', '#58b868', '#2c7cb8'];
  kit.every(90, () => {
    t += 0.09;
    g.clear();
    const wob = Math.sin(t * 2) * 0.04;
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI + (i / 14) * Math.PI + wob;
      g.lineStyle(6, hex(palette[i % 5]), 1).lineBetween(110, 86, 110 + Math.cos(a) * 62, 86 + Math.sin(a) * 62);
      disc(g, Math.round(110 + Math.cos(a) * 62), Math.round(86 + Math.sin(a) * 62), 4, '#e8c030');
      disc(g, Math.round(110 + Math.cos(a) * 62), Math.round(86 + Math.sin(a) * 62), 2, '#2c4c98');
    }
    outlined(g, [[104, 66, 12, 26, '#2c4c98']]);
    disc(g, 110, 60, 6, '#2c4c98');
    g.fillStyle(0xffffff, 1).fillRect(112, 58, 2, 2);
    g.fillStyle(hex('#e8c030'), 1).fillRect(116, 60, 4, 2);
  });
};

const porteria: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8c4b8'), 1).fillRect(x, y + 88, w, h - 88);
  });
  const g = addG(kit, stage);
  outlined(g, [[24, 28, 62, 60, '#f0e0c0'], [18, 22, 74, 8, '#a83c28']]);
  outlined(g, [[32, 40, 46, 22, '#8ac0d8']]);
  label(kit, stage, 55, 68, 'PORTERÍA', '#7a4c30', 7, 60);
  side(kit, stage, SIRA(), 106, 104, { dir: -1, scale: 1, eyes: 'open' });
  const p = addG(kit, stage);
  outlined(p, [[102, 60, 4, 8, '#1c1c24']]);
  kit.every(1100, () => floatHeart(kit, stage, 116, 40));
};

const precioclub: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(StoryState.hasFlag('m7_noche') ? '#141c34' : '#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8c8c98'), 1).fillRect(x, y + 90, w, h - 90);
  });
  const g = addG(kit, stage);
  outlined(g, [[8, 44, 150, 46, '#d8d8e0']]);
  outlined(g, [[66, 62, 34, 28, '#6a7c8c']]);
  outlined(g, [[172, 8, 30, 82, '#2c5cc8']]);
  label(kit, stage, 83, 49, 'PRECIOCLUB', '#2c5cc8', 9, 140);
  label(kit, stage, 187, 16, 'P', '#ffffff', 16, 28);
  label(kit, stage, 187, 46, 'OFER\nTAS', '#f8e070', 7, 28);
  outlined(g, [[120, 66, 32, 24, '#f4f0e4']]);
  label(kit, stage, 136, 72, '48 rollos', INK, 5, 30);
};

const letreroBobo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#a86a4c'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 12; c++) g.fillStyle(hex('#945c40'), 1).fillRect(c * 20 + (r % 2) * 10, r * 16, 18, 14);
  outlined(g, [[28, 26, 164, 56, '#f8f4e8']]);
  label(kit, stage, 110, 32, 'BOBO', '#c8603c', 18, 150);
  label(kit, stage, 110, 56, 'UNIC LIVING', '#3a3a48', 11, 150);
  label(kit, stage, 110, 71, 'Vive, estudia, conecta', '#7a7a88', 6, 150);
  kit.every(1000, () => sparkle(kit, stage, 40 + Math.random() * 140, 32));
};

const ojo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#a86a4c'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  disc(g, 110, 54, 48, INK);
  disc(g, 110, 54, 45, '#c8e0ec');
  flat(g, [[78, 60, 64, 8, '#8a8c98'], [84, 68, 6, 18, '#3a3c44'], [132, 68, 6, 18, '#3a3c44']]);
  bust(g, lookOf('universitario'), 110, 52, 1.6, { eyes: 'closed', mouth: 'o' });
  kit.every(700, () => floatZ(kit, stage, 120, 44, '#ffffff'));
};

const paraderoTecho: VinetaBuilder = (kit) => {
  const noche = StoryState.hasFlag('m7_noche');
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(noche ? '#0c1020' : estaLloviendo() ? '#8a9cb0' : '#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex(noche ? '#2a2c38' : '#8c8c98'), 1).fillRect(x, y + 82, w, h - 82);
  });
  const g = addG(kit, stage);
  outlined(g, [[30, 14, 160, 10, '#3a7a58']]);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(38, 24, 4, 60).fillRect(178, 24, 4, 60);
  outlined(g, [[62, 68, 96, 6, '#8a6a40']]);
  outlined(g, [[186, 30, 22, 30, '#f4f0e4']]);
  label(kit, stage, 197, 38, 'N ↑', INK, 8, 20);
  if (noche || estaLloviendo()) lluvia(kit, stage, 26, noche ? 0x8aa8d8 : 0xa8c8f0);
};

const piscina: VinetaBuilder = (kit) => {
  const noche = StoryState.hasFlag('m7_noche');
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(noche ? '#10142a' : '#bfe2f4'), 1).fillRect(x, y, w, 46);
    g.fillStyle(hex('#d8d4c8'), 1).fillRect(x, y + 46, w, h - 46);
  });
  const g = addG(kit, stage);
  outlined(g, [[16, 58, 188, 44, noche ? '#2a4c7c' : '#58b4e8']]);
  outlined(g, [[166, 26, 8, 32, '#8a6a40']]);
  g.fillStyle(hex('#e85a5a'), 1).fillTriangle(146, 32, 194, 32, 170, 18);
  const w = addG(kit, stage);
  let t = 0;
  kit.every(100, () => {
    t += 0.1;
    w.clear().fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 12; i++) w.fillRect(22 + ((i * 29 + Math.floor(t * 14)) % 176), 62 + ((i * 7) % 36), 8, 1);
  });
  if (noche) lluvia(kit, stage, 22, 0x8aa8d8);
  else bust(addG(kit, stage), lookOf('universitaria'), 56, 44, 2, { mouth: 'teeth', eyes: 'squint' });
};

const torre: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#8a9cb0'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  outlined(g, [[56, 0, 108, 108, '#a86a4c']]);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) g.fillStyle(hex(r === 3 && c === 3 ? '#f8e070' : '#5a6c84'), 1).fillRect(66 + c * 20, 6 + r * 12, 12, 8);
  const a = addG(kit, stage);
  let t = 0;
  kit.every(100, () => {
    t += 0.1;
    a.clear();
    a.fillStyle(0xf8e070, 0.3 + Math.sin(t * 2) * 0.15).fillCircle(132, 46, 12);
  });
  label(kit, stage, 132, 22, '805 ↓', '#ffffff', 8, 40);
  lluvia(kit, stage, 26);
};

// ---------------------------------------------------------------------------
// La Farmadía
// ---------------------------------------------------------------------------

const farmadia: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(estaLloviendo() ? '#7a8ca0' : '#bfe2f4'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8c8c98'), 1).fillRect(x, y + 92, w, h - 92);
  });
  const g = addG(kit, stage);
  outlined(g, [[14, 16, 192, 76, '#f4f8f4']]);
  outlined(g, [[14, 16, 192, 16, '#2c9c5c']]);
  outlined(g, [[90, 40, 40, 52, '#a8d8ec']]);
  label(kit, stage, 110, 18, 'FARMADÍA 24H', '#ffffff', 10);
  outlined(g, [[24, 40, 54, 30, '#c8e4f0'], [142, 40, 54, 30, '#c8e4f0']]);
  flat(g, [[46, 46, 10, 18, '#58c878'], [42, 51, 18, 8, '#58c878']]);
  label(kit, stage, 169, 48, 'OFERTA 2×1', '#c83c3c', 6, 50);
  if (estaLloviendo()) lluvia(kit, stage, 26);
};

const cajaFarma: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0f4f0', '#d8d8d0', 80));
  const g = addG(kit, stage);
  outlined(g, [[100, 56, 104, 30, '#2c9c5c'], [120, 34, 40, 22, '#3a3c44']]);
  g.fillStyle(hex('#48c47c'), 1).fillRect(124, 38, 32, 14);
  const f = addG(kit, stage);
  let t = 0;
  kit.every(120, () => {
    t += 0.12;
    f.clear();
    bust(f, lookOf('cajera_farma'), 56, 52, 3.8, { mouth: 'smile', eyes: Math.sin(t * 2) > 0.92 ? 'closed' : 'open' });
  });
  outlined(g, [[172, 40, 26, 16, '#f8f8f0']]);
  g.fillStyle(hex('#2c9c5c'), 1).fillRect(176, 44, 18, 3);
  kit.after(300, () => popText(kit, stage, 140, 16, '¿Bolsa? ¿Puntos? ¿Recarga?', '#fff2d0', 8, 0));
};

const crispetas: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0f4f0', '#d8d8d0', 90));
  const g = addG(kit, stage);
  outlined(g, [[74, 22, 72, 68, '#e85a5a']]);
  for (let i = 0; i < 4; i++) g.fillStyle(hex('#f8f8f0'), 1).fillRect(78 + i * 18, 22, 8, 68);
  label(kit, stage, 110, 46, 'CRISPETAS', INK, 8, 68);
  label(kit, stage, 110, 62, 'sabor mantequilla', INK, 6, 68);
  kit.every(450, () => {
    const p = addG(kit, stage);
    const x = 84 + Math.random() * 52;
    kit.progress(650, (k) => {
      p.clear();
      disc(p, Math.round(x + (x - 110) * k * 0.6), Math.round(22 - Math.sin(k * Math.PI) * 18 + k * 8), 3, '#fff4c8');
    }, () => p.destroy());
  });
};

const crispetasMicro: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#e4ecf0', '#c8d4dc', 92));
  const g = addG(kit, stage);
  outlined(g, [[50, 22, 124, 70, '#3a3c44']]);
  outlined(g, [[58, 30, 80, 54, '#f8e8a8']]);
  outlined(g, [[144, 34, 22, 24, '#1c1c24']]);
  label(kit, stage, 155, 40, '1:42', '#48c47c', 8, 20);
  const bag = addG(kit, stage);
  let t = 0;
  kit.every(140, () => {
    t += 0.14;
    bag.clear();
    const s = Math.min(1, t / 3);
    outlined(bag, [[98 - Math.round(s * 18), 56 - Math.round(s * 16), 22 + Math.round(s * 36), 26 + Math.round(s * 14), '#f4f0e4']]);
  });
  const hits = ['plop', 'plopplop', 'pop', 'PLOP'];
  let i = 0;
  kit.every(360, () => {
    popText(kit, stage, 60 + Math.random() * 110, 14 + Math.random() * 12, hits[i % 4], '#fff2a0', 7, 240);
    i++;
  });
};

const chocolatina: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0f4f0', '#d8d8d0', 90));
  const g = addG(kit, stage);
  outlined(g, [[46, 38, 128, 34, '#7a4c28']]);
  outlined(g, [[46, 38, 44, 34, '#c8a040']]);
  label(kit, stage, 68, 48, 'con maní', '#fff2d0', 7, 42);
  for (let i = 0; i < 3; i++) g.fillStyle(hex('#5a3418'), 1).fillRect(100 + i * 25, 42, 20, 26);
  kit.every(700, () => sparkle(kit, stage, 100 + Math.random() * 70, 44));
  label(kit, stage, 110, 80, '«La mitad grande es mía.»', '#7a4c30', 8);
};

const estanteFarma: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#f0f4f0', '#d8d8d0', 96));
  const g = addG(kit, stage);
  for (const y of [34, 66, 96]) g.fillStyle(hex('#9ca2ae'), 1).fillRect(12, y, 196, 3);
  const c = ['#e85a5a', '#5a8ce8', '#f0c830', '#58b868', '#c868c8', '#e8903c'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 11; i++) outlined(g, [[16 + i * 18, 14 + r * 32, 13, 20, c[(i + r * 2) % 6]]]);
  kit.every(800, () => sparkle(kit, stage, 20 + Math.random() * 180, 14 + Math.random() * 70));
};

// ---------------------------------------------------------------------------
// Otros
// ---------------------------------------------------------------------------

const busCorazones: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#5a4c8c'), 1).fillRect(x, y, w, 40);
    g.fillStyle(hex('#e8806a'), 1).fillRect(x, y + 40, w, 26);
    g.fillStyle(hex('#54545f'), 1).fillRect(x, y + 88, w, h - 88);
  });
  const bus = addG(kit, stage);
  outlined(bus, [[30, 16, 160, 72, '#f2f2ee']]);
  bus.fillStyle(hex('#2c9c4c'), 1).fillRect(30, 72, 160, 8);
  for (let i = 0; i < 4; i++) bus.fillStyle(hex('#f8e8b0'), 1).fillRect(38 + i * 38, 24, 32, 32);
  const her = addG(kit, stage);
  bust(her, SIRA(), 92, 44, 2.6, { mouth: 'smile', eyes: 'open' });
  her.fillStyle(0xe8607a, 1).fillRect(106, 30, 5, 2).fillRect(114, 30, 5, 2).fillRect(106, 32, 13, 3).fillRect(108, 35, 9, 2).fillRect(112, 37, 3, 2);
  kit.every(700, () => floatHeart(kit, stage, 108, 26));
};

const dormir: VinetaBuilder = (kit) => {
  const stage = kit.framed(pared('#10142a', '#2c3c6c', 72));
  const g = addG(kit, stage);
  flat(g, [[56, 54, 108, 16, '#f0f2f8']]);
  bust(g, sinGorro(playerLook()), 110, 56, 3, { eyes: 'closed', mouth: 'smile' });
  g.fillStyle(hex('#425e98'), 1).fillRect(36, 76, 148, 32);
  outlined(g, [[100, 78, 22, 12, '#1c1c24']]);
  const l = addG(kit, stage);
  kit.every(220, () => {
    l.clear().fillStyle(0x7cc8f8, 0.4 + Math.random() * 0.15).fillRect(102, 80, 18, 8);
  });
  kit.every(800, () => floatZ(kit, stage, 124, 42));
};

const llorando: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#10142a'), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  bust(g, sinGorro(playerLook()), 72, 52, 3.6, { mouth: 'o', eyes: 'squint' });
  bust(g, SIRA(), 148, 54, 3.4, { mouth: 'o', eyes: 'squint', blush: true });
  kit.every(170, () => {
    const d = addG(kit, stage);
    const left = Math.random() < 0.5;
    const x = (left ? 60 : 136) + (Math.random() < 0.5 ? 0 : 22);
    kit.progress(700, (k) => {
      d.clear().fillStyle(0xa8e0ff, 1 - k).fillRect(x, lerp(52, 92, k), 2, 3);
    }, () => d.destroy());
  });
  label(kit, stage, 72, 92, '«Es el perfume»', '#c8d4f0', 7, 90);
  label(kit, stage, 148, 92, '«Es la cebolla»', '#c8d4f0', 7, 90);
};

function llamada(kit: VinetaKit, look: ReturnType<typeof playerLook>, name: string, bg: string): void {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex(bg), 1).fillRect(x, y, w, h));
  const g = addG(kit, stage);
  outlined(g, [[66, 2, 88, 104, '#1c1c24']]);
  g.fillStyle(hex('#2e7a54'), 1).fillRect(70, 6, 80, 96);
  bust(g, look, 110, 46, 3.2, { mouth: 'teeth', eyes: 'open' });
  label(kit, stage, 110, 12, name, '#ffffff', 9, 78);
  g.fillStyle(hex('#e85a5a'), 1).fillCircle(110, 92, 7);
  kit.every(450, () => {
    const r = addG(kit, stage);
    kit.progress(700, (k) => {
      r.clear().lineStyle(1, 0xffffff, 1 - k).strokeCircle(110, 46, 18 + k * 20);
    }, () => r.destroy());
  });
}

const llamadaGrover: VinetaBuilder = (kit) => llamada(kit, lookOf('grover'), 'Grover', '#c8a040');
const llamadaMery: VinetaBuilder = (kit) => llamada(kit, { ...lookOf('senora'), hair: '#b8b8c0', hairStyle: 'bun' }, 'Doña Mery', '#e8b0b8');

export const M7_VINETAS_4: Record<string, VinetaBuilder> = {
  m7_olla_mery: ollaMery,
  m7_despertar: despertar,
  m7_desorden: desorden,
  m7_loza: loza,
  m7_meson: meson,
  m7_ropa: ropa,
  m7_ducha: ducha,
  m7_wc: wc,
  m7_perfume: perfume,
  m7_ventana: ventana,
  m7_poster: poster,
  m7_estante: estante,
  m7_sabila: sabila,
  m7_velador: velador,
  m7_cineflix: cineflix,
  m7_sira_chef: siraChef,
  m7_bostezo: bostezo,
  m7_confesion: confesion,
  m7_zapatos: zapatos,
  m7_puerta_801: puerta801,
  m7_puerta_803: puerta803,
  m7_puerta_809: puerta809,
  m7_boton: boton,
  m7_escalera: escalera,
  m7_buzones: buzones,
  m7_nota_amigas: notaAmigas,
  m7_calle_dia: calleDia,
  m7_campus: campus,
  m7_efrain: efrain,
  m7_las_de_taller: lasDeTaller,
  m7_croquera: croquera,
  m7_pavo: pavo,
  m7_porteria: porteria,
  m7_precioclub: precioclub,
  m7_letrero_bobo: letreroBobo,
  m7_ojo: ojo,
  m7_paradero_techo: paraderoTecho,
  m7_piscina: piscina,
  m7_torre: torre,
  m7_farmadia: farmadia,
  m7_caja_farma: cajaFarma,
  m7_crispetas: crispetas,
  m7_crispetas_micro: crispetasMicro,
  m7_chocolatina: chocolatina,
  m7_estante_farma: estanteFarma,
  m7_bus_corazones: busCorazones,
  m7_dormir: dormir,
  m7_llorando: llorando,
  m7_llamada_grover: llamadaGrover,
  m7_llamada_mery: llamadaMery,
};
