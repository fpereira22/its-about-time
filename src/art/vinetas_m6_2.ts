import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';
import { groverFace } from './vinetas_m5_2';

/**
 * Viñetas de la misión 6 (segunda parte, la noche): los helados de corazón, el regalo, el apagón en la colina,
 * el cuentero del Buziraco y el susto, el mirador con Cali que se vuelve a prender, el «casi», la videollamada de
 * Grover, los fuegos artificiales y las buenas noches. Panel de 220 × 108 px.
 */

const SIRA = (): HumanLook => lookOf('sira_feria');

/** Número pseudoaleatorio estable (0..1) para repartir las luces de la ciudad sin que formen diagonales. */
const rnd = (n: number): number => {
  const s = Math.sin(n * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
};

/** Copa de helado en forma de corazón, con sus corazoncitos de chocolate. */
function heartCup(g: G, cx: number, cy: number, color: string): void {
  g.fillStyle(hex(INK), 1).fillCircle(cx - 8, cy - 4, 10).fillCircle(cx + 8, cy - 4, 10).fillTriangle(cx - 18, cy - 1, cx + 18, cy - 1, cx, cy + 20);
  g.fillStyle(hex(color), 1).fillCircle(cx - 8, cy - 4, 9).fillCircle(cx + 8, cy - 4, 9).fillTriangle(cx - 16, cy - 1, cx + 16, cy - 1, cx, cy + 18);
  g.fillStyle(0xffffff, 0.5).fillCircle(cx - 11, cy - 8, 3);
  for (const [dx, dy] of [[-6, -6], [5, -2], [0, 6]] as const) {
    g.fillStyle(hex('#5a2a18'), 1).fillRect(cx + dx, cy + dy, 2, 1).fillRect(cx + dx + 3, cy + dy, 2, 1).fillRect(cx + dx, cy + dy + 1, 5, 1).fillRect(cx + dx + 1, cy + dy + 2, 3, 1).fillRect(cx + dx + 2, cy + dy + 3, 1, 1);
  }
  g.fillStyle(hex('#e8e8f0'), 1).fillRect(cx - 4, cy + 20, 8, 3).fillRect(cx - 1, cy + 18, 2, 3);
}

function myFlavor(): string {
  if (StoryState.hasFlag('m6_mio_mora')) return '#7c2c5c';
  if (StoryState.hasFlag('m6_mio_guanabana')) return '#f4f0e0';
  if (StoryState.hasFlag('m6_mio_chonta')) return '#e87838';
  return '#e8e070';
}

/** Los helados de corazón en la mesa de la ventana; las cucharas se cruzan. */
const helados: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f4b8c8'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 8) g.fillStyle(hex('#f8cad6'), 1).fillRect(x + i, y, 4, 60);
    g.fillStyle(hex('#a8e0cc'), 1).fillRect(x, y + 74, w, h - 74);
    g.fillStyle(hex('#3a1c2c'), 1).fillRect(x + 142, y + 8, 70, 22);
  });
  const neon = addG(kit, stage);
  kit.every(400, () => {
    neon.clear();
    const on = Math.random() > 0.08;
    neon.fillStyle(hex(on ? '#ff6a9a' : '#7a3a5a'), 1).fillCircle(152, 16, 4).fillCircle(160, 16, 4).fillTriangle(148, 18, 164, 18, 156, 26);
  });
  stage.add(makeText(kit.scene, 168, 14, 'CORAZONES', { fontSize: '5px', color: '#ffd0e0' }));
  const g = addG(kit, stage);
  heartCup(g, 76, 66, myFlavor());
  heartCup(g, 144, 66, '#f8b830');
  const spoons = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    spoons.clear();
    const k = (Math.sin(t * 1.4) + 1) / 2;
    // Tu cuchara va al helado de ella y la de ella al tuyo, y se cruzan al medio.
    const a = lerp(84, 136, k);
    const b = lerp(136, 84, k);
    spoons.fillStyle(hex('#c8ccd4'), 1).fillRect(a, 40 - Math.round(Math.sin(k * Math.PI) * 10), 14, 2).fillEllipse(a + 15, 41 - Math.round(Math.sin(k * Math.PI) * 10), 5, 4);
    spoons.fillStyle(hex('#c8ccd4'), 1).fillRect(b - 14, 46 - Math.round(Math.sin(k * Math.PI) * 8), 14, 2).fillEllipse(b - 15, 47 - Math.round(Math.sin(k * Math.PI) * 8), 5, 4);
  });
  if (StoryState.hasFlag('m6_helado_acertado')) kit.after(400, () => popText(kit, stage, 144, 34, '¡MARACUYÁ!', '#ffffff', 9, 0));
  kit.every(1100, () => floatHeart(kit, stage, 104 + Math.random() * 12, 36));
};

/** El regalo: Sira lo recibe a la luz rosada del neón. */
const regalo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#3a1c2c'), 1).fillRect(x, y, w, h);
    g.fillStyle(0xff6a9a, 0.15).fillCircle(x + 110, y + 40, 90);
  });
  const face = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    face.clear();
    bust(face, SIRA(), 70, 58, 4, { mouth: Math.sin(t * 2) > 0.4 ? 'teeth' : 'smile', eyes: Math.sin(t * 3) > 0.92 ? 'closed' : 'open' });
  });
  const item = addG(kit, stage);
  const what = StoryState.hasFlag('m6_q_regalo_hecho')
    ? 'separador'
    : StoryState.hasFlag('m6_q_regalo_piedra')
      ? 'piedra'
      : StoryState.hasFlag('m6_q_regalo_maria')
        ? 'maria'
        : StoryState.hasFlag('m6_q_bombombun')
          ? 'bombombun'
          : 'qvlm';
  if (what === 'separador') {
    outlined(item, [[140, 22, 20, 62, '#fbf6ea']]);
    disc(item, 150, 48, 7, '#f0c030');
    item.fillStyle(hex('#58a048'), 1).fillRect(149, 55, 1, 14);
    item.fillStyle(hex('#c83c3c'), 1).fillRect(148, 14, 4, 9);
  } else if (what === 'piedra') {
    disc(item, 150, 54, 16, '#3c78c8');
    item.fillStyle(hex('#f0c030'), 1).fillRect(144, 52, 10, 5).fillTriangle(154, 54, 160, 49, 160, 59);
  } else if (what === 'bombombun') {
    item.fillStyle(hex('#f8f8f0'), 1).fillRect(149, 54, 2, 24);
    disc(item, 150, 48, 9, '#e84868');
  } else {
    outlined(item, [[130, 24, 40, 56, what === 'maria' ? '#9c3c5c' : '#f0c030']]);
    stage.add(makeText(kit.scene, 150, 36, what === 'maria' ? 'MARÍA' : '¡QUE VIVA\nLA MÚSICA!', { fontSize: '6px', fontStyle: '700', color: INK, align: 'center' }).setOrigin(0.5, 0));
  }
  kit.every(500, () => sparkle(kit, stage, 130 + Math.random() * 40, 20 + Math.random() * 60));
  kit.every(900, () => floatHeart(kit, stage, 96, 30));
};

// ---------------------------------------------------------------------------
// La colina de noche
// ---------------------------------------------------------------------------

function nightHill(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#04050c'), 1).fillRect(x, y, w, h);
  for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.3 + (i % 3) * 0.2).fillRect(x + ((i * 53) % w), y + ((i * 29) % 50), 1, 1);
  g.fillStyle(hex('#0c1018'), 1).fillTriangle(x, y + h, x + 60, y + 60, x + 160, y + h);
}

/** El apagón en la escalinata: la linterna del celular y Sira agarrada de tu brazo. */
const apagon: VinetaBuilder = (kit) => {
  const stage = kit.framed(nightHill);
  const light = addG(kit, stage);
  const steps = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    light.clear();
    const sway = Math.sin(t * 2) * 10;
    light.fillStyle(0xfff6c8, 0.16).fillTriangle(98, 52, 160 + sway, 108, 40 + sway, 108);
    light.fillStyle(0xfff6c8, 0.1).fillTriangle(98, 52, 190 + sway, 108, 10 + sway, 108);
    steps.clear();
    for (let i = 0; i < 4; i++) {
      const sy = 80 + i * 8;
      steps.fillStyle(0xa8a090, 0.4 + i * 0.12).fillRect(60 + sway * 0.4, sy, 90, 3);
    }
    // Los ojos del gato, entre las matas.
    if (Math.sin(t * 0.8) > 0.5) light.fillStyle(0xd8f048, 1).fillRect(184, 70, 2, 1).fillRect(189, 70, 2, 1);
  });
  // Los dos, apenas iluminados por la pantalla del celular.
  const faces = addG(kit, stage);
  kit.every(100, () => {
    faces.clear();
    bust(faces, playerLook(), 86, 40, 2.6, { mouth: 'o' });
    bust(faces, SIRA(), 112, 44, 2.3, { mouth: 'o', eyes: 'squint' });
    faces.fillStyle(0x04050c, 0.45).fillRect(60, 14, 80, 50);
    faces.fillStyle(hex('#bfe0ff'), 1).fillRect(97, 50, 5, 8);
  });
  kit.after(300, () => popText(kit, stage, 110, 8, '¡¿SE FUE LA LUZ?!', '#ffffff', 9, 0));
};

/** Los cuenteros con velas y, sobre los cerros, la sombra con cachos del Buziraco. */
const buziraco: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#08070e'), 1).fillRect(x, y, w, h);
    // El Cerro de las Tres Cruces al fondo.
    g.fillStyle(hex('#141420'), 1).fillTriangle(x + 120, y + 60, x + 175, y + 22, x + 230, y + 60);
    for (const cx of [165, 175, 185]) g.fillStyle(hex('#c8c8d8'), 1).fillRect(x + cx, y + 14, 2, 10).fillRect(x + cx - 3, y + 17, 8, 2);
  });
  const shadow = addG(kit, stage);
  const candles = addG(kit, stage);
  const teller = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    // La sombra del diablo, que aparece y se va.
    shadow.clear();
    const a = Math.max(0, Math.sin(t * 0.7)) * 0.35;
    shadow.fillStyle(0x5a1414, a).fillCircle(176, 34, 16).fillTriangle(164, 22, 160, 6, 170, 20).fillTriangle(188, 22, 192, 6, 182, 20);
    shadow.fillStyle(0xf86a3a, a * 2).fillRect(170, 32, 3, 2).fillRect(180, 32, 3, 2);
    candles.clear();
    for (let i = 0; i < 9; i++) {
      const cx = 18 + i * 22;
      const cy = 92 - (i % 2) * 6;
      candles.fillStyle(hex('#f4f0e0'), 1).fillRect(cx, cy, 3, 8);
      const fl = Math.sin(t * 9 + i) * 1;
      candles.fillStyle(0xffd070, 1).fillEllipse(cx + 1.5 + fl * 0.3, cy - 2, 3, 5);
      candles.fillStyle(0xffd070, 0.12).fillCircle(cx + 1, cy, 9);
    }
    teller.clear();
    // El cuentero, con la cara iluminada desde abajo.
    bust(teller, lookOf('cuentero'), 60, 52, 3.4, { mouth: Math.floor(t * 4) % 2 ? 'open' : 'smile' });
    teller.fillStyle(0xffd070, 0.18).fillRect(44, 56, 32, 10);
    teller.fillStyle(0x08070e, 0.35).fillRect(44, 34, 32, 14);
  });
  kit.every(1200, () => popText(kit, stage, 110, 70, '...shhh...', '#a8a0c0', 7, 800));
};

/** ¡BU! Sira salta a tus brazos. */
const susto: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#08070e'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 9; i++) g.fillStyle(0xffd070, 0.8).fillRect(x + 16 + i * 22, y + 92 - (i % 2) * 6, 2, 3);
  });
  const me = side(kit, stage, playerLook(), 92, 100, { dir: 1, scale: 1, eyes: 'open' }, true);
  const her = side(kit, stage, SIRA(), 104, 100, { dir: -1, scale: 0.84, eyes: 'closed' }, true);
  kit.progress(260, (q) => {
    her.body.setY(lerp(0, -16, q));
    her.arm.setY(lerp(0, -16, q));
    her.body.setX(lerp(124, 104, q));
    her.arm.setX(lerp(124, 104, q));
  }, undefined, 'Back.Out');
  me.body.setY(0);
  popText(kit, stage, 110, 12, '¡¡BUUU!!', '#f86a3a', 16, 700);
  kit.after(700, () => popText(kit, stage, 150, 30, '¡AAAH!', '#ffffff', 10, 900));
  kit.after(1600, () => kit.every(800, () => floatHeart(kit, stage, 100 + Math.random() * 10, 30)));
};

/** El mirador: Cali se vuelve a prender, barrio por barrio, y los dos de espaldas en la baranda. */
const mirador: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#06081a'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 50; i++) g.fillStyle(0xffffff, 0.3 + (i % 4) * 0.15).fillRect(x + ((i * 47) % w), y + ((i * 13) % 34), 1, 1);
    g.fillStyle(hex('#0e1428'), 1).fillRect(x, y + 36, w, h - 36);
  });
  // Las luces de la ciudad, que se van prendiendo.
  const lights: Array<{ x: number; y: number; c: number; on: number }> = [];
  for (let i = 0; i < 170; i++) {
    const x = Math.floor(rnd(i) * 220);
    const y = 40 + Math.floor(rnd(i + 500) * 42) + Math.round(((x - 110) / 110) ** 2 * 6);
    lights.push({ x, y, c: [0xf0c060, 0xf8e0a0, 0xf0a040, 0xa8c8f0, 0xf8f0d0][i % 5], on: Math.abs(x - 60) * 12 + (i % 7) * 40 });
  }
  const city = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 60;
    city.clear();
    for (const l of lights) {
      if (t < l.on) continue;
      const blink = Math.random() < 0.02 ? 0.4 : 1;
      city.fillStyle(l.c, blink).fillRect(l.x, l.y, 1, 1);
      city.fillStyle(l.c, 0.15 * blink).fillRect(l.x - 1, l.y - 1, 3, 3);
    }
    // Las avenidas como ríos amarillos.
    if (t > 1200) city.fillStyle(0xf0c060, 0.5).fillRect(0, 70, Math.min(220, (t - 1200) / 4), 1);
    if (t > 1600) city.fillStyle(0xf0c060, 0.5).fillRect(40, 58, Math.min(160, (t - 1600) / 5), 1);
  });
  // La baranda y los dos de espaldas.
  const rail = addG(kit, stage);
  rail.fillStyle(hex('#2a2433'), 1).fillRect(0, 86, 220, 3);
  for (let x = 4; x < 220; x += 14) rail.fillRect(x, 86, 2, 22);
  const backs = addG(kit, stage);
  for (const [bx, look, s] of [[92, playerLook(), 1], [114, SIRA(), 0.84]] as const) {
    const hh = Math.round(16 * s);
    backs.fillStyle(hex(INK), 1).fillRect(bx - 1, 108 - hh - 30, 14, 30 + hh);
    backs.fillStyle(hex(look.shirt), 1).fillRect(bx, 108 - hh - 12, 12, hh + 12);
    backs.fillStyle(hex(look.hair), 1).fillRect(bx + 1, 108 - hh - 28, 10, look.hairStyle === 'long' ? 22 : 10);
  }
  kit.after(2600, () => popText(kit, stage, 110, 20, 'Wow...', '#ffffff', 9, 0));
};

/** El «casi»: las dos caras de perfil, cada vez más cerca, y el corazón a mil. */
const casi: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#06081a'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 70; i++) g.fillStyle([0xf0c060, 0xf8e0a0, 0xa8c8f0][i % 3], 0.6).fillRect(x + Math.floor(rnd(i) * w), y + 70 + Math.floor(rnd(i + 300) * 38), 1, 1);
  });
  const g = addG(kit, stage);
  const me = playerLook();
  const her = SIRA();
  const profile = (x: number, dir: 1 | -1, look: HumanLook, s: number, eyes: boolean): void => {
    const r = (dx: number, dy: number, w: number, h: number, c: string): void => {
      const xx = dir === 1 ? x + dx * s : x - (dx + w) * s;
      g.fillStyle(hex(c), 1).fillRect(Math.round(xx), Math.round(30 + dy * s), Math.ceil(w * s), Math.ceil(h * s));
    };
    r(-1, -1, 16, 20, INK);
    r(0, 0, 14, 18, look.skin);
    r(14, 7, 2, 3, look.skin);
    r(0, -2, 13, 6, look.hair);
    if (look.hairStyle === 'long') r(-2, 0, 6, 26, look.hair);
    else r(-1, 0, 4, 10, look.hair);
    r(10, 5, 2, eyes ? 2 : 0.6, '#202028');
    r(12, 13, 3, 1, '#c86868');
    r(6, 10, 3, 2, '#f0a0a8');
    r(1, 18, 10, 8, look.shirt);
  };
  let d = 0;
  kit.every(60, () => {
    d = Math.min(1, d + 0.008);
    g.clear();
    const gap = lerp(40, 14, d);
    profile(110 - gap - 14, 1, me, 3, true);
    profile(110 + gap + 14, -1, her, 2.7, d < 0.8);
  });
  const heart = addG(kit, stage);
  let beat = 0;
  kit.every(380, () => {
    beat++;
    heart.clear();
    const s = beat % 2 ? 3 : 2;
    heart.fillStyle(0xf05a7a, 1).fillRect(104 - s, 10, 4 * s / 2, s).fillRect(108, 10, 4 * s / 2, s).fillRect(104 - s, 10 + s, 6 + s * 2, s).fillRect(106 - s / 2, 10 + s * 2, 4 + s, s);
  });
  kit.after(800, () => popText(kit, stage, 150, 12, 'ba-dum', '#f05a7a', 7, 0));
};

/** La videollamada de Grover en el peor momento posible. */
const groverCasi: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#06081a'), 1).fillRect(x, y, w, h));
  const phone = addG(kit, stage);
  outlined(phone, [[70, 2, 80, 104, '#1c1c24']]);
  flat(phone, [[74, 8, 72, 86, '#2c9c4c'], [100, 4, 20, 2, '#3a3a44']]);
  const face = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    face.clear();
    const shake = Math.sin(t * 40) * 1.5;
    face.setX(shake);
    phone.setX(shake);
    groverFace(face, 110, 50, 3, t, false);
  });
  stage.add(makeText(kit.scene, 110, 86, 'Grover · videollamada', { fontSize: '6px', color: '#ffffff' }).setOrigin(0.5, 0));
  kit.every(300, () => floatNote(kit, stage, 60 + Math.random() * 10, 50, '#f0c030'));
  kit.every(300, () => floatNote(kit, stage, 160 + Math.random() * 10, 50, '#f0c030'));
  kit.after(200, () => popText(kit, stage, 40, 20, '¡RING!', '#f8e070', 10, 0));
  kit.after(500, () => popText(kit, stage, 180, 20, '¡RING!', '#f8e070', 10, 0));
};

/** Fuegos artificiales sobre Siloé, vistos desde la colina. */
const fuegos: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#06081a'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 90; i++) g.fillStyle([0xf0c060, 0xf8e0a0, 0xa8c8f0][i % 3], 0.6).fillRect(x + Math.floor(rnd(i + 40) * w), y + 70 + Math.floor(rnd(i + 700) * 38), 1, 1);
  });
  const burst = (bx: number, by: number, color: number): void => {
    const g = addG(kit, stage, bx, by);
    kit.progress(1100, (q) => {
      g.clear();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = q * 22;
        g.fillStyle(color, 1 - q).fillRect(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r + q * q * 8), 2, 2);
      }
    }, () => g.destroy());
  };
  const colors = [0x58e070, 0xf05a5a, 0xf0c040, 0x7cb8f8, 0xf8a0d0];
  let k = 0;
  kit.every(600, () => {
    k++;
    burst(30 + ((k * 61) % 160), 20 + ((k * 17) % 30), colors[k % colors.length]);
  });
  // Los dos, de espaldas, abajo.
  const backs = addG(kit, stage);
  for (const [bx, look, s] of [[94, playerLook(), 1], [112, SIRA(), 0.84]] as const) {
    const hh = Math.round(14 * s);
    backs.fillStyle(hex(INK), 1).fillRect(bx - 1, 108 - hh - 26, 14, 26 + hh);
    backs.fillStyle(hex(look.shirt), 1).fillRect(bx, 108 - hh - 10, 12, hh + 10);
    backs.fillStyle(hex(look.hair), 1).fillRect(bx + 1, 108 - hh - 24, 10, look.hairStyle === 'long' ? 20 : 9);
  }
  kit.every(1500, () => floatHeart(kit, stage, 108, 60));
};

/** Buenas noches: la foto de los dos en el mirador, en el celular, a oscuras. */
const buenasNoches: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1a1e30'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#5a3a30'), 1).fillRect(x + 10, y + 78, 140, 10);
    g.fillStyle(hex('#9cc0e8'), 1).fillRect(x + 14, y + 66, 130, 14);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 16, y + 62, 26, 10);
  });
  const face = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    face.clear();
    bust(face, playerLook(), 40, 58, 2.4, { mouth: 'teeth', eyes: Math.sin(t) > 0.85 ? 'closed' : 'open' });
    face.fillStyle(0xbfe0ff, 0.22).fillTriangle(60, 50, 40, 40, 40, 72);
  });
  const ph = addG(kit, stage);
  outlined(ph, [[120, 8, 70, 92, '#1c1c24']]);
  flat(ph, [[124, 14, 62, 76, '#06081a']]);
  for (let i = 0; i < 30; i++) ph.fillStyle([0xf0c060, 0xf8e0a0, 0xa8c8f0][i % 3], 0.8).fillRect(126 + ((i * 13) % 58), 56 + ((i * 7) % 30), 1, 1);
  ph.fillStyle(0x58e070, 1).fillRect(140, 24, 2, 2).fillRect(136, 28, 2, 2).fillRect(144, 28, 2, 2);
  ph.fillStyle(0xf05a5a, 1).fillRect(168, 30, 2, 2).fillRect(164, 34, 2, 2).fillRect(172, 34, 2, 2);
  bust(ph, playerLook(), 146, 66, 1.6, { mouth: 'grin' });
  bust(ph, SIRA(), 164, 67, 1.4, { mouth: 'teeth' });
  kit.every(1100, () => floatHeart(kit, stage, 60, 40));
};

export const M6_VINETAS_2: Record<string, VinetaBuilder> = {
  m6_helados: helados,
  m6_regalo: regalo,
  m6_apagon: apagon,
  m6_buziraco: buziraco,
  m6_susto: susto,
  m6_mirador: mirador,
  m6_casi: casi,
  m6_grover_casi: groverCasi,
  m6_fuegos: fuegos,
  m6_buenas_noches: buenasNoches,
};
