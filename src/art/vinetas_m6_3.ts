import type { HumanLook } from './characters';
import { playerLook } from '../systems/PlayerLook';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, floatHeart, flat, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';

/**
 * Viñetas de la misión 6 (tercera parte): lo que faltaba entre medio. El jueves al llegar a la piscina,
 * el sueño del viernes, el separador terminado, todo el viaje Pance → centro (el P47 por Pance y
 * Cañasgordas, la estación Universidades, el T31 llegando, el tirón, los hinchas, la abuelita, la Torre
 * de Cali) y la noche (San Antonio, el gato del apagón, los dos taxis, el taxista y el porche de Pance).
 * Panel de 220 × 108.
 */

const SIRA = (): HumanLook => lookOf('sira_feria');
const rnd = (i: number): number => {
  const s = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// Ventana de bus: el paisaje corre por detrás y el bus lo tapa por delante
// ---------------------------------------------------------------------------

const WIN = { x: 12, y: 10, w: 196, h: 56 } as const;

/** El interior del bus alrededor de la ventana (se dibuja encima del paisaje). */
function busFrame(g: G, wall = '#eef0f0', stripe = '#e8903c'): void {
  g.fillStyle(hex(wall), 1);
  g.fillRect(0, 0, 220, WIN.y).fillRect(0, WIN.y + WIN.h, 220, 108 - WIN.y - WIN.h);
  g.fillRect(0, 0, WIN.x, 108).fillRect(WIN.x + WIN.w, 0, 220 - WIN.x - WIN.w, 108);
  g.fillStyle(hex('#5a5e68'), 1).fillRect(WIN.x - 2, WIN.y - 2, WIN.w + 4, 2).fillRect(WIN.x - 2, WIN.y + WIN.h, WIN.w + 4, 3);
  g.fillRect(WIN.x - 2, WIN.y, 2, WIN.h).fillRect(WIN.x + WIN.w, WIN.y, 2, WIN.h).fillRect(110, WIN.y, 3, WIN.h);
  g.fillStyle(hex(stripe), 1).fillRect(0, WIN.y + WIN.h + 6, 220, 3);
  // Respaldos de los asientos.
  for (const sx of [20, 120]) outlined(g, [[sx, 82, 70, 26, '#3a5a8c'], [sx + 4, 86, 62, 4, '#4a6a9c']]);
  // El reflejo en el vidrio.
  g.fillStyle(0xffffff, 0.18).fillTriangle(WIN.x + 6, WIN.y + WIN.h, WIN.x + 30, WIN.y, WIN.x + 40, WIN.y);
  g.fillStyle(0xffffff, 0.18).fillTriangle(WIN.x + 120, WIN.y + WIN.h, WIN.x + 144, WIN.y, WIN.x + 150, WIN.y);
}

/** Cielo de tarde, con los Farallones al fondo. */
function sky(g: G, farallones = true): void {
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  g.fillStyle(hex('#cfe8f8'), 1).fillRect(WIN.x, WIN.y, WIN.w, 14);
  if (!farallones) return;
  g.fillStyle(hex('#7c9cb0'), 1);
  for (let i = 0; i < 8; i++) g.fillTriangle(WIN.x - 10 + i * 30, WIN.y + 40, WIN.x + 10 + i * 30, WIN.y + 18 + (i % 3) * 5, WIN.x + 34 + i * 30, WIN.y + 40);
}

// ---------------------------------------------------------------------------
// El jueves y el viernes
// ---------------------------------------------------------------------------

/** La piscina del GLD de noche: los reflectores se prenden uno por uno; al fondo, Sira te hace señas con los dos brazos. */
const piscinaNoche: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#101a30'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 20; i++) g.fillStyle(0xffffff, 0.5).fillRect(x + ((i * 47) % w), y + ((i * 13) % 26), 1, 1);
    g.fillStyle(hex('#cfc9be'), 1).fillRect(x, y + 50, w, 6);
    g.fillStyle(hex('#1c5c98'), 1).fillRect(x, y + 56, w, h - 56);
    // Corcheras.
    for (let j = 0; j < 4; j++) for (let i = 0; i < w; i += 6) g.fillStyle(hex(i % 12 ? '#e84848' : '#f8f8f0'), 1).fillRect(x + i, y + 66 + j * 11, 4, 2);
  });
  // Los cuatro reflectores (postes) y su luz.
  const poles = addG(kit, stage);
  const lights = addG(kit, stage);
  const on = [false, false, false, false];
  const px = [20, 80, 140, 200];
  for (const x of px) outlined(poles, [[x - 1, 6, 2, 44, '#5a5e68'], [x - 6, 2, 12, 5, '#3a3e48']]);
  const draw = (): void => {
    lights.clear();
    px.forEach((x, i) => {
      if (!on[i]) return;
      lights.fillStyle(0xfff6c8, 1).fillRect(x - 5, 3, 10, 3);
      lights.fillStyle(0xfff6c8, 0.12).fillTriangle(x - 5, 6, x + 5, 6, x + 22, 108).fillTriangle(x - 5, 6, x - 22, 108, x + 5, 6);
      lights.fillStyle(0x8cd0f8, 0.35).fillRect(x - 14, 58, 28, 50);
    });
  };
  px.forEach((_, i) =>
    kit.after(300 + i * 450, () => {
      on[i] = true;
      draw();
      popText(kit, stage, px[i], 14, 'clac', '#fff6c8', 6, 400);
    }),
  );
  // Sira, chiquitita, al fondo en el borde: los dos brazos arriba, de lado a lado.
  const sira = addG(kit, stage);
  const look = lookOf('sira_bano');
  let t = 0;
  kit.every(140, () => {
    t++;
    sira.clear();
    const sx = 168;
    flat(sira, [[sx, 32, 6, 12, look.shirt], [sx, 44, 2, 6, look.skin], [sx + 4, 44, 2, 6, look.skin], [sx, 26, 6, 6, look.skin], [sx, 25, 6, 3, '#2c8c8c']]);
    const up = t % 2 === 0;
    sira.fillStyle(hex(look.skin), 1).fillRect(up ? sx - 4 : sx - 2, 18, 2, 14).fillRect(up ? sx + 6 : sx + 8, 18, 2, 14);
  });
  side(kit, stage, { ...playerLook(), shirt: playerLook().skin }, 34, 56, { dir: 1, scale: 0.9, eyes: 'open' });
  kit.after(2300, () => popText(kit, stage, 168, 10, '¡AQUÍ!', '#8cf0d8', 8, 0));
  kit.every(1800, () => floatHeart(kit, stage, 50, 18));
};

/** El sueño del viernes: nadas en el río Cali y un pez te recuerda respirar. Después, la hoja del calendario. */
const sueno: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c4a78'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a5c8c'), 1).fillRect(x, y, w, 20);
    g.fillStyle(hex('#6a5a3a'), 1).fillRect(x, y + 96, w, 12);
    for (let i = 0; i < w; i += 9) g.fillStyle(hex('#3a7a48'), 1).fillRect(x + i, y + 84 + (i % 3) * 3, 2, 14);
  });
  const g = addG(kit, stage);
  const fish = addG(kit, stage);
  const me = playerLook();
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    g.clear();
    // Tú, nadando crol (de lado).
    const bx = 70;
    const by = 46 + Math.round(Math.sin(t * 2) * 2);
    g.fillStyle(hex(me.skin), 1).fillRect(bx, by, 40, 5);
    g.fillStyle(hex('#2f6fd0'), 1).fillRect(bx + 6, by - 1, 10, 7);
    g.fillStyle(hex(me.skin), 1).fillRect(bx - 16, by + Math.round(Math.sin(t * 12) * 2), 16, 2).fillRect(bx - 16, by + 3 - Math.round(Math.sin(t * 12) * 2), 16, 2);
    g.fillStyle(hex(me.skin), 1).fillRect(bx + 40, by - 3, 8, 8);
    g.fillStyle(hex(me.hair), 1).fillRect(bx + 40, by - 4, 8, 3);
    const arm = Math.sin(t * 5);
    g.fillStyle(hex(me.skin), 1).fillRect(bx + 30 + Math.round(arm * 12), by - 6 + Math.round(Math.abs(arm) * 3), 14, 2);
    // Los peces (uno con cara de profe).
    fish.clear();
    for (let i = 0; i < 4; i++) {
      const fx = (150 + i * 30 - t * 14 * (1 + i * 0.2) + 400) % 260 - 20;
      const fy = 30 + i * 14;
      const c = ['#f0a030', '#e8607a', '#f0d048', '#8cd0f8'][i];
      fish.fillStyle(hex(c), 1).fillEllipse(fx, fy, 10, 5).fillTriangle(fx + 4, fy, fx + 9, fy - 3, fx + 9, fy + 3);
      fish.fillStyle(hex(INK), 1).fillRect(Math.round(fx) - 3, fy - 1, 1, 1);
    }
  });
  kit.every(300, () => {
    const b = addG(kit, stage, 118 + Math.random() * 6, 44);
    b.lineStyle(1, 0xcfe8f8, 0.8).strokeCircle(0, 0, 1 + Math.random() * 1.5);
    kit.progress(1200, (q) => b.setY(44 - q * 40).setAlpha(1 - q), () => b.destroy());
  });
  kit.after(600, () => popText(kit, stage, 110, 18, '¡Respira cada tres!', '#f0d048', 8, 1600));
  // Se despierta: la hoja del calendario.
  kit.after(2600, () => {
    const cal = addG(kit, stage);
    outlined(cal, [[146, 14, 66, 76, '#fbf6ea'], [146, 14, 66, 18, '#c84848']]);
    const day = makeText(kit.scene, 179, 16, 'VIERNES', { fontSize: '8px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0);
    const num = makeText(kit.scene, 179, 44, 'clases', { fontSize: '9px', color: INK }).setOrigin(0.5, 0);
    stage.add([day, num]);
    cal.setAlpha(0);
    day.setAlpha(0);
    num.setAlpha(0);
    kit.tween({ targets: [cal, day, num], alpha: 1, duration: 300 });
    kit.after(1200, () => {
      day.setText('SÁBADO');
      num.setText('4:00 · La Ermita').setFontSize(7).setColor('#c84848');
      sparkle(kit, stage, 206, 18);
      floatHeart(kit, stage, 179, 78);
    });
  });
};

/** El separador terminado: la flor prensada, la cinta roja y el huequito hecho con un clavo. */
const separadorListo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a87048'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < h; i += 9) g.fillStyle(hex('#986038'), 1).fillRect(x, y + i, w, 1);
  });
  const g = addG(kit, stage);
  outlined(g, [[96, 10, 28, 88, '#fbf6ea']]);
  g.fillStyle(hex('#a87048'), 1).fillCircle(110, 18, 2);
  // La flor de guayacán prensada.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillStyle(hex('#f0c030'), 1).fillEllipse(110 + Math.cos(a) * 5, 48 + Math.sin(a) * 5, 8, 6);
  }
  g.fillStyle(hex('#c89820'), 1).fillCircle(110, 48, 2);
  g.fillStyle(hex('#58a048'), 1).fillRect(110, 54, 1, 26).fillRect(106, 64, 4, 2);
  // La cinta roja que cuelga y se mece.
  const rib = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    rib.clear();
    rib.lineStyle(2, 0xd83838, 1);
    rib.beginPath();
    rib.moveTo(110, 18);
    for (let i = 1; i <= 8; i++) rib.lineTo(110 + Math.sin(t * 2 + i * 0.6) * i * 0.8 - i * 2, 18 - i * 2 + i * i * 0.3);
    rib.strokePath();
  });
  kit.every(500, () => sparkle(kit, stage, 96 + Math.random() * 28, 14 + Math.random() * 80));
  kit.after(700, () => popText(kit, stage, 172, 30, 'Lo hice yo.', '#ffffff', 9, 0));
  kit.after(1500, () => popText(kit, stage, 172, 46, '(quedó... quedó)', '#f8e070', 7, 0));
};

// ---------------------------------------------------------------------------
// El P47
// ---------------------------------------------------------------------------

/** El P47 bajando por Pance: guaduales, fincas y un ciclista de lycra que va más rápido que el bus. */
const p47Pance: VinetaBuilder = (kit) => {
  const stage = kit.framed(() => undefined);
  const land = addG(kit, stage);
  const front = addG(kit, stage);
  busFrame(front);
  let t = 0;
  kit.every(50, () => {
    t += 1;
    land.clear();
    sky(land);
    land.fillStyle(hex('#6aa850'), 1).fillRect(WIN.x, WIN.y + 38, WIN.w, 18);
    // Fincas (lento).
    for (let i = 0; i < 4; i++) {
      const x = WIN.x + ((i * 70 - t * 0.8) % 280 + 280) % 280 - 40;
      outlined(land, [[x, WIN.y + 30, 22, 12, '#f4ecd8']]);
      land.fillStyle(hex('#c86848'), 1).fillTriangle(x - 3, WIN.y + 30, x + 11, WIN.y + 22, x + 25, WIN.y + 30);
      land.fillStyle(hex('#5a3a28'), 1).fillRect(x + 9, WIN.y + 35, 4, 7);
    }
    // El ciclista (va adelantando al bus).
    const cx = WIN.x + ((t * 0.6) % 240) - 20;
    const cy = WIN.y + 46;
    land.lineStyle(1, 0x2a2433, 1).strokeCircle(cx, cy + 4, 3).strokeCircle(cx + 10, cy + 4, 3);
    land.fillStyle(hex('#e8303c'), 1).fillRect(cx + 2, cy - 6, 6, 6);
    land.fillStyle(hex('#f0d048'), 1).fillRect(cx + 4, cy - 10, 5, 4);
    land.fillStyle(hex('#2a2433'), 1).fillRect(cx + 3, cy, 2, 4).fillRect(cx + 7, cy, 2, 4);
    // Guaduas (rápido, adelante).
    for (let i = 0; i < 6; i++) {
      const x = WIN.x + ((i * 45 - t * 3.2) % 270 + 270) % 270 - 30;
      for (let k = 0; k < 4; k++) {
        land.fillStyle(hex(k % 2 ? '#7cb848' : '#5a9a38'), 1).fillRect(x + k * 4, WIN.y + 2, 2, 54);
        land.fillStyle(hex('#3a6a28'), 1).fillRect(x + k * 4, WIN.y + 14 + k * 7, 2, 1);
      }
      land.fillStyle(hex('#6aa850'), 1).fillEllipse(x + 6, WIN.y + 4, 22, 10);
    }
  });
  kit.after(900, () => popText(kit, stage, 110, 76, 'El aire huele a río', '#ffffff', 8, 0));
};

/** Av. Cañasgordas: el semáforo, el señor de los mangos con sal y el frenazo. */
const mangoSemaforo: VinetaBuilder = (kit) => {
  const stage = kit.framed(() => undefined);
  const land = addG(kit, stage);
  const vendor = side(kit, stage, lookOf('vendedor_mango'), 120, WIN.y + WIN.h + 2, { dir: -1, scale: 0.8, eyes: 'open' });
  const cart = addG(kit, stage);
  const light = addG(kit, stage);
  const front = addG(kit, stage);
  busFrame(front);
  let off = 0;
  let speed = 0;
  let phase: 'green' | 'red' = 'red';
  let t = 0;
  const drawLand = (): void => {
    land.clear();
    sky(land, false);
    // Conjuntos con portería y árboles enormes.
    for (let i = 0; i < 4; i++) {
      const x = WIN.x + ((i * 64 - off) % 256 + 256) % 256 - 30;
      outlined(land, [[x, WIN.y + 14, 40, 34, '#e8dcc8']]);
      for (let k = 0; k < 3; k++) land.fillStyle(hex('#8cb8d8'), 1).fillRect(x + 4 + k * 12, WIN.y + 18, 8, 6).fillRect(x + 4 + k * 12, WIN.y + 30, 8, 6);
      land.fillStyle(hex('#3a7a3a'), 1).fillCircle(x + 52, WIN.y + 18, 14);
      land.fillStyle(hex('#5a3a28'), 1).fillRect(x + 50, WIN.y + 28, 4, 22);
    }
    land.fillStyle(hex('#9a9aa4'), 1).fillRect(WIN.x, WIN.y + 48, WIN.w, 8);
  };
  kit.every(50, () => {
    t += 50;
    if (phase === 'red' && t > 1800) (phase = 'green'), (t = 0);
    if (phase === 'green' && t > 1600) {
      phase = 'red';
      t = 0;
      // ¡Frenazo! Todo el bus se sacude.
      kit.progress(260, (q) => stage.setX(kit.panel.x + Math.round(Math.sin(q * 20) * (1 - q) * 3)));
      popText(kit, stage, 60, 74, '¡FRENAZO!', '#c83c3c', 9, 700);
    }
    speed = phase === 'green' ? Math.min(3, speed + 0.25) : Math.max(0, speed - 0.6);
    off += speed;
    drawLand();
    const vx = 120 - off;
    vendor.body.setX(Math.round(((vx % 300) + 300) % 300 - 40));
    vendor.arm.setX(vendor.body.x);
    cart.clear();
    const cx = vendor.body.x + 18;
    outlined(cart, [[cx, WIN.y + 34, 26, 14, '#3c78c8']]);
    for (let i = 0; i < 4; i++) disc(cart, cx + 4 + i * 6, WIN.y + 32, 3, i % 2 ? '#f0c030' : '#8ac048');
    light.clear();
    outlined(light, [[184, WIN.y + 4, 10, 26, '#2a2a34']]);
    disc(light, 189, WIN.y + 10, 3, phase === 'red' ? '#f03c3c' : '#4a2a2a');
    disc(light, 189, WIN.y + 24, 3, phase === 'green' ? '#48d878' : '#2a4a34');
    light.fillStyle(hex('#5a5e68'), 1).fillRect(188, WIN.y + 31, 2, 25);
  });
  kit.after(500, () => popText(kit, stage, 150, 76, '¡Mango con sal!', '#ffffff', 8, 1200));
};

/** El P47 llega a la Av. Carrera 100: el techo larguísimo de lámina con el letrero UNIVERSIDADES. */
const estacionUniv: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7c9cb0'), 1).fillTriangle(x, y + 50, x + 60, y + 24, x + 120, y + 50).fillTriangle(x + 90, y + 50, x + 170, y + 20, x + 230, y + 50);
    g.fillStyle(hex('#8a8e98'), 1).fillRect(x, y + 70, w, h - 70);
    for (let i = 0; i < w; i += 20) g.fillStyle(hex('#f8f8f0'), 1).fillRect(x + i, y + 88, 10, 2);
    // La estación: andén, columnas y el techo largo.
    g.fillStyle(hex('#cfc8bc'), 1).fillRect(x + 10, y + 62, 200, 8);
    for (let i = 0; i < 6; i++) g.fillStyle(hex('#5a5e68'), 1).fillRect(x + 14 + i * 38, y + 34, 3, 28);
    g.fillStyle(hex(INK), 1).fillRect(x + 4, y + 28, 212, 8);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + 5, y + 29, 210, 6);
    for (let i = 0; i < 210; i += 6) g.fillStyle(hex('#a8acb4'), 1).fillRect(x + 5 + i, y + 29, 1, 6);
    // Puertas de vidrio del andén.
    for (let i = 0; i < 5; i++) g.fillStyle(hex('#8cc8d8'), 0.8).fillRect(x + 22 + i * 38, y + 44, 22, 18);
  });
  const sign = addG(kit, stage);
  outlined(sign, [[60, 12, 100, 14, '#2c8c5c']]);
  stage.add(makeText(kit.scene, 110, 14, 'UNIVERSIDADES', { fontSize: '9px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));
  // El P47 (alimentador, naranjo) entra y frena.
  const bus = addG(kit, stage);
  outlined(bus, [[0, 0, 70, 22, '#e8903c'], [4, 4, 52, 8, '#8cc8e8'], [60, 4, 8, 14, '#8cc8e8']]);
  bus.fillStyle(hex(INK), 1).fillCircle(14, 23, 4).fillCircle(54, 23, 4);
  const lbl = makeText(kit.scene, 0, 0, 'P47', { fontSize: '6px', fontStyle: '600', color: '#ffffff' });
  stage.add(lbl);
  kit.progress(
    1800,
    (q) => {
      const x = lerp(-80, 120, q);
      bus.setPosition(x, 70);
      lbl.setPosition(x + 6, 84);
    },
    () => popText(kit, stage, 150, 58, 'pssshh', '#ffffff', 7, 900),
    'Cubic.Out',
  );
};

// ---------------------------------------------------------------------------
// El T31
// ---------------------------------------------------------------------------

/** Llega el T31: verde y blanco, con el fuelle de acordeón; las puertas se abren y la gente sale y entra. */
const t31Llega: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#dfe4e8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8a8e98'), 1).fillRect(x, y + 74, w, h - 74);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y, w, 8);
  });
  const bus = addG(kit, stage);
  const draw = (open: boolean): void => {
    bus.clear();
    for (const [bx, bw] of [[0, 104], [112, 104]] as const) {
      outlined(bus, [[bx, 18, bw, 54, '#f4f4ee'], [bx, 58, bw, 14, '#2c8c5c'], [bx + 4, 24, bw - 8, 18, '#5a7a8c']]);
      // Puertas.
      for (const dx of [20, 70]) {
        if (open) bus.fillStyle(hex('#2a2a34'), 1).fillRect(bx + dx, 30, 16, 42);
        else outlined(bus, [[bx + dx, 30, 7, 42, '#a8c8d8'], [bx + dx + 9, 30, 7, 42, '#a8c8d8']]);
      }
    }
    // El fuelle.
    for (let i = 0; i < 4; i++) bus.fillStyle(hex(i % 2 ? '#3a3a44' : '#5a5a66'), 1).fillRect(104 + i * 2, 22, 2, 48);
    bus.fillStyle(hex('#2c8c5c'), 1).fillRect(8, 20, 26, 4);
  };
  draw(false);
  const tag = makeText(kit.scene, 0, 0, 'T31', { fontSize: '7px', fontStyle: '600', color: '#ffffff' });
  stage.add(tag);
  kit.progress(
    1500,
    (q) => {
      const x = lerp(240, 2, q);
      bus.setX(x);
      tag.setPosition(x + 10, 60);
    },
    () => {
      draw(true);
      popText(kit, stage, 110, 10, '¡PSSSHH!', '#ffffff', 9, 900);
      // La ola de gente: salen unos, entran otros.
      for (let i = 0; i < 6; i++) {
        const out = i % 2 === 0;
        const p = addG(kit, stage);
        const c = ['#e84868', '#3c78c8', '#f0c030', '#48a868', '#a868c8', '#e8903c'][i];
        flat(p, [[0, 0, 6, 6, '#c8946c'], [-1, 6, 8, 12, c], [0, 18, 2, 6, INK], [4, 18, 2, 6, INK]]);
        const door = [22, 72, 134, 184][i % 4] + 4;
        p.setPosition(door, out ? 48 : 96);
        kit.after(200 + i * 220, () => kit.progress(700, (q) => p.setPosition(door + (out ? q * 8 : 0), out ? lerp(48, 90, q) : lerp(96, 48, q)).setAlpha(out ? 1 : 1 - q * 0.7)));
      }
    },
    'Cubic.Out',
  );
};

/** El tirón: el articulado arranca y todos se van para atrás; tú te agarras de la mochila de un desconocido. */
const tiron: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eef0f0'), 1).fillRect(x, y, w, h);
    for (let i = 8; i < w; i += 36) g.fillStyle(hex('#a8c8d8'), 1).fillRect(x + i, y + 10, 28, 24);
    g.fillStyle(hex('#5a5e68'), 1).fillRect(x, y + 8, w, 2);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y + 94, w, h - 94);
    g.fillStyle(hex('#2c8c5c'), 1).fillRect(x, y + 36, w, 3);
  });
  const people = [
    { look: lookOf('senora'), x: 30, s: 0.95 },
    { look: lookOf('estudiante'), x: 70, s: 1 },
    { look: playerLook(), x: 104, s: 1 },
    { look: lookOf('pasajero'), x: 140, s: 1.05 },
    { look: lookOf('pasajera'), x: 176, s: 0.9 },
  ];
  const figs = people.map((p) => ({ ...p, f: side(kit, stage, p.look, p.x, 98, { dir: 1, scale: p.s, eyes: 'open' }) }));
  // La mochila del desconocido (el de adelante).
  const bag = addG(kit, stage);
  outlined(bag, [[0, 0, 10, 14, '#3c78c8']]);
  const hand = addG(kit, stage);
  const bar = addG(kit, stage);
  bar.fillStyle(hex('#c8ccd4'), 1).fillRect(0, 12, 220, 2);
  kit.progress(
    900,
    (q) => {
      // Se van para atrás (a la izquierda) y vuelven.
      const lean = Math.sin(q * Math.PI) * 10;
      for (const p of figs) {
        p.f.body.setX(Math.round(p.x - lean * p.s));
        p.f.arm.setX(Math.round(p.x - lean * p.s));
      }
      bag.setPosition(Math.round(140 - lean) - 6, 52);
      hand.clear();
      hand.fillStyle(hex(playerLook().skin), 1).fillRect(Math.round(104 - lean * 1) + 16, 58, Math.round(140 - lean - 6 - (104 - lean + 16)) + 2, 3);
    },
    () => popText(kit, stage, 140, 24, '«Tranquilo, parce»', '#ffffff', 8, 0),
    'Sine.InOut',
  );
  kit.after(100, () => popText(kit, stage, 50, 24, '¡UY!', '#c83c3c', 9, 700));
};

/** Estación Estadio: los hinchas de rojo cantando y la mitad de la empanada que llega a tus manos. */
const hinchas: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eef0f0'), 1).fillRect(x, y, w, h);
    for (let i = 8; i < w; i += 36) g.fillStyle(hex('#a8c8d8'), 1).fillRect(x + i, y + 10, 28, 24);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y + 94, w, h - 94);
    // Banderas por la ventana.
    g.fillStyle(hex('#c81e2c'), 1).fillRect(x + 50, y + 14, 14, 10).fillRect(x + 158, y + 16, 14, 10);
  });
  const red = (i: number): HumanLook => ({ ...lookOf(i % 2 ? 'estudiante' : 'pasajero'), shirt: '#c81e2c' });
  const fans = [0, 1, 2].map((i) => side(kit, stage, red(i), 20 + i * 30, 98, { dir: 1, scale: 1, eyes: 'closed' }));
  side(kit, stage, playerLook(), 170, 98, { dir: -1, scale: 1, eyes: 'open' });
  let t = 0;
  kit.every(200, () => {
    t++;
    fans.forEach((f, i) => {
      const y = (t + i) % 2 ? -2 : 0;
      f.body.setY(f.body.y + 0 * y);
      f.body.y = Math.round(98 - 56) + y;
      f.arm.y = Math.round(98 - 56) + y - ((t + i) % 2 ? 3 : 0);
    });
  });
  kit.every(380, () => floatNote(kit, stage, 30 + Math.random() * 60, 36, '#ffffff'));
  kit.after(300, () => popText(kit, stage, 60, 20, '♪ ¡Oé, oé, oé! ♪', '#c81e2c', 8, 1300));
  // La empanada viaja de mano en mano hasta ti.
  const emp = addG(kit, stage);
  emp.fillStyle(hex('#d89838'), 1).fillEllipse(0, 0, 12, 7);
  emp.fillStyle(hex('#b87828'), 1).fillRect(-5, 0, 10, 1);
  emp.setPosition(84, 70).setAlpha(0);
  kit.after(1500, () => {
    emp.setAlpha(1);
    kit.progress(1100, (q) => emp.setPosition(lerp(84, 168, q), 70 - Math.round(Math.sin(q * Math.PI) * 18)), () => {
      popText(kit, stage, 168, 50, '¿Media?', '#ffffff', 8, 0);
      kit.after(700, () => popText(kit, stage, 160, 30, 'Cali.', '#c81e2c', 10, 0));
    }, 'Sine.InOut');
  });
};

/** La abuelita de Santa Librada: «Ahí me casé yo, en el 72. Llovió». El recuerdo, en una nube. */
const abuelita: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eef0f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y + 94, w, h - 94);
  });
  const face = addG(kit, stage);
  let t = 0;
  kit.every(110, () => {
    t++;
    face.clear();
    bust(face, lookOf('transeunte_abuelita'), 48, 60, 3.6, { mouth: t % 4 < 2 ? 'smile' : 'open', eyes: t % 30 === 0 ? 'closed' : 'open' });
  });
  // La nube del recuerdo.
  const cloud = addG(kit, stage);
  cloud.fillStyle(0xffffff, 1).fillCircle(84, 64, 3).fillCircle(92, 54, 5);
  cloud.fillStyle(0xffffff, 1).fillRoundedRect(100, 8, 112, 84, 14);
  const mem = addG(kit, stage);
  // La Ermita en sepia y los novios.
  mem.fillStyle(hex('#d8c8a8'), 1).fillRect(108, 14, 96, 72);
  mem.fillStyle(hex('#f2ece0'), 1).fillRect(138, 40, 36, 34);
  for (const [sx, sh] of [[138, 26], [168, 26], [152, 38]] as const) {
    mem.fillStyle(hex('#f2ece0'), 1).fillRect(sx, 74 - sh, 6, sh);
    mem.fillStyle(hex('#8a7c68'), 1).fillTriangle(sx - 1, 74 - sh, sx + 3, 74 - sh - 12, sx + 7, 74 - sh);
  }
  mem.fillStyle(hex('#a89878'), 1).fillRect(108, 74, 96, 12);
  // Ella de blanco, él de negro, bajo un paraguas.
  flat(mem, [[124, 60, 6, 16, '#fbf6ea'], [125, 55, 4, 5, '#c8946c'], [133, 60, 6, 16, '#3a3a44'], [134, 55, 4, 5, '#c8946c']]);
  mem.fillStyle(hex('#3a3a44'), 1).fillTriangle(118, 54, 131, 44, 144, 54);
  const rain = addG(kit, stage);
  kit.every(60, () => {
    rain.clear();
    for (let i = 0; i < 26; i++) {
      const rx = 110 + ((i * 37 + Date.now() / 20) % 92);
      const ry = 16 + ((i * 23 + Date.now() / 6) % 66);
      rain.fillStyle(0x6a7c98, 0.7).fillRect(Math.round(rx), Math.round(ry), 1, 3);
    }
  });
  stage.add(makeText(kit.scene, 200, 76, '1972', { fontSize: '7px', fontStyle: '600', color: '#6a5a3a' }).setOrigin(1, 0));
  kit.after(1200, () => popText(kit, stage, 156, 98, '«Fue lo más bonito»', '#ffffff', 8, 0));
  kit.every(1500, () => floatHeart(kit, stage, 128, 50));
};

/** Torre de Cali: por la ventana del T31 se ve la torre del hotel, altísima, y entre los edificios, el río. */
const torreCali: VinetaBuilder = (kit) => {
  const stage = kit.framed(() => undefined);
  const city = addG(kit, stage);
  const front = addG(kit, stage);
  busFrame(front, '#eef0f0', '#2c8c5c');
  // La cámara mira hacia arriba: la torre baja por la ventana.
  kit.progress(
    2200,
    (q) => {
      city.clear();
      sky(city, false);
      // La torre (alta, con franjas de ventanas) va apareciendo de abajo hacia arriba mientras el bus frena.
      const tx = 124;
      const top = Math.round(WIN.y + 46 - q * 70);
      city.fillStyle(hex(INK), 1).fillRect(tx - 1, top - 1, 42, 140);
      city.fillStyle(hex('#d8d4cc'), 1).fillRect(tx, top, 40, 140);
      for (let r = 0; r < 34; r++) city.fillStyle(hex(r % 2 ? '#7c9cb0' : '#5a7a8c'), 1).fillRect(tx + 3, top + 5 + r * 4, 34, 2);
      city.fillStyle(hex('#c83c3c'), 1).fillRect(tx + 19, top - 9, 2, 9);
      // El río brillando y los edificios bajos (delante de la torre).
      city.fillStyle(hex('#4a9ad8'), 1).fillRect(WIN.x, WIN.y + 50, WIN.w, 6);
      for (let i = 0; i < 9; i++) {
        const bx = WIN.x + i * 24;
        const bh = 12 + ((i * 7) % 12);
        if (bx > tx - 20 && bx < tx + 40) continue;
        city.fillStyle(hex(i % 2 ? '#c8bca8' : '#b4aca0'), 1).fillRect(bx, WIN.y + 50 - bh, 18, bh);
        city.fillStyle(hex('#8cb8d8'), 1).fillRect(bx + 3, WIN.y + 54 - bh, 4, 3).fillRect(bx + 11, WIN.y + 54 - bh, 4, 3);
      }
    },
    () => {
      popText(kit, stage, 70, 30, 'TORRE DE CALI', '#ffffff', 9, 0);
      kit.every(500, () => sparkle(kit, stage, WIN.x + Math.random() * WIN.w, WIN.y + 50));
    },
    'Sine.Out',
  );
};

// ---------------------------------------------------------------------------
// La noche
// ---------------------------------------------------------------------------

/** San Antonio: casitas de teja con puertas de colores, la calle de ladrillo que sube y la capilla arriba. */
const sanAntonio: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0b878'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#f8d8a0'), 1).fillRect(x, y, w, 20);
    // La colina con la capilla.
    g.fillStyle(hex('#6a9a48'), 1).fillTriangle(x + 110, y + 60, x + 175, y + 14, x + 240, y + 60);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 166, y + 10, 18, 12);
    g.fillStyle(hex('#b85838'), 1).fillRect(x + 170, y + 2, 6, 8).fillTriangle(x + 164, y + 10, x + 175, y + 4, x + 186, y + 10);
    // Calle de ladrillo en subida.
    g.fillStyle(hex('#b86848'), 1).fillTriangle(x, y + h, x + w, y + 86, x + w, y + h);
    g.fillStyle(hex('#b86848'), 1).fillRect(x, y + 98, w, 10);
    // Casitas de un piso.
    const doors = ['#3c78c8', '#48a868', '#e85a8c', '#f0c030', '#3c78c8'];
    for (let i = 0; i < 5; i++) {
      const hx = x + 4 + i * 44;
      const base = y + 98 - i * 2;
      g.fillStyle(hex(i % 2 ? '#f4ecd8' : '#f8e4c8'), 1).fillRect(hx, base - 34, 40, 34);
      g.fillStyle(hex('#b85838'), 1).fillRect(hx - 3, base - 40, 46, 7);
      g.fillStyle(hex(doors[i]), 1).fillRect(hx + 6, base - 22, 10, 22);
      g.fillStyle(hex('#8a5430'), 1).fillRect(hx + 24, base - 26, 10, 10);
    }
  });
  side(kit, stage, playerLook(), 116, 102, { dir: 1, scale: 0.9, eyes: 'open' });
  const her = side(kit, stage, SIRA(), 140, 100, { dir: -1, scale: 0.76, eyes: 'open' });
  kit.every(300, () => her.arm.setY(her.arm.y === her.body.y ? her.body.y - 3 : her.body.y));
  kit.every(500, () => floatNote(kit, stage, 20 + Math.random() * 20, 60, '#5a3a28'));
  kit.every(700, () => {
    // Vapor de café saliendo de una puerta.
    const s = addG(kit, stage, 62 + Math.random() * 6, 70);
    s.fillStyle(0xffffff, 0.5).fillRect(0, 0, 1, 5);
    kit.progress(1100, (q) => s.setY(70 - q * 22).setAlpha(0.6 - q * 0.6), () => s.destroy());
  });
  kit.after(800, () => popText(kit, stage, 70, 20, 'Huele a café y a pan', '#ffffff', 8, 0));
};

/** El gato negro del apagón: dos puntitos brillantes entre las matas... ¡MIAAAU! */
const gato: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0a0c16'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 30; i++) g.fillStyle(0xffffff, 0.6).fillRect(x + ((i * 53) % w), y + ((i * 19) % 30), 1, 1);
    for (let i = 0; i < w; i += 14) g.fillStyle(hex('#14202a'), 1).fillCircle(x + i, y + 74 + (i % 3) * 4, 16);
    g.fillStyle(hex('#1a1c28'), 1).fillRect(x, y + 92, w, h - 92);
  });
  // La luz de la linterna del celular.
  const beam = addG(kit, stage);
  beam.fillStyle(0xfff6c8, 0.12).fillTriangle(30, 96, 200, 50, 200, 108);
  const eyes = addG(kit, stage);
  let blink = 0;
  kit.every(120, () => {
    blink++;
    eyes.clear();
    if (blink > 18) return;
    if (blink % 9 !== 0) eyes.fillStyle(0xd8f048, 1).fillRect(120, 72, 3, 2).fillRect(128, 72, 3, 2);
  });
  kit.after(2200, () => {
    const cat = addG(kit, stage);
    cat.fillStyle(0x08080c, 1).fillEllipse(0, 0, 22, 10).fillCircle(10, -5, 5).fillTriangle(7, -9, 9, -14, 11, -9).fillTriangle(11, -9, 13, -14, 15, -9);
    cat.fillStyle(0xd8f048, 1).fillRect(10, -6, 2, 1).fillRect(13, -6, 2, 1);
    cat.lineStyle(2, 0x08080c, 1).lineBetween(-10, 0, -16, -8);
    kit.progress(800, (q) => cat.setPosition(lerp(124, 220, q), 76 - Math.round(Math.sin(q * Math.PI) * 50)), () => cat.destroy());
    popText(kit, stage, 110, 30, '¡MIAAAAU!', '#d8f048', 12, 1000);
    kit.after(500, () => {
      popText(kit, stage, 70, 54, '¡AAAAH!', '#ff9cb4', 10, 0);
      kit.progress(300, (q) => stage.setX(kit.panel.x + Math.round(Math.sin(q * 24) * (1 - q) * 3)));
    });
  });
};

/** La despedida en la Calle 2: dos taxis. El de Sira dobla la esquina; ella te hace señas con las dos manos. */
const dosTaxis: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1c2238'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 16; i++) g.fillStyle(0xffffff, 0.5).fillRect(x + ((i * 61) % w), y + ((i * 17) % 30), 1, 1);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(hex('#2a3048'), 1).fillRect(x + i * 46, y + 30, 40, 44);
      g.fillStyle(hex('#f8d070'), 0.8).fillRect(x + i * 46 + 8, y + 40, 8, 8);
    }
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x, y + 74, w, h - 74);
    // Faroles amarillos.
    for (const fx of [30, 140]) {
      g.fillStyle(hex('#5a5e68'), 1).fillRect(x + fx, y + 30, 2, 44);
      g.fillStyle(hex('#f8d070'), 1).fillRect(x + fx - 3, y + 26, 8, 5);
      g.fillStyle(0xf8d070, 0.12).fillCircle(x + fx + 1, y + 30, 22);
    }
  });
  const taxi = (g: G, label: boolean): void => {
    outlined(g, [[0, 8, 56, 16, '#f0c818'], [10, 0, 34, 10, '#f0c818'], [13, 2, 13, 7, '#5a7a8c'], [28, 2, 13, 7, '#5a7a8c']]);
    g.fillStyle(hex(INK), 1).fillCircle(12, 25, 4).fillCircle(44, 25, 4);
    if (label) g.fillStyle(hex('#2a2433'), 1).fillRect(20, 14, 16, 3);
  };
  const mine = addG(kit, stage, 20, 70);
  taxi(mine, true);
  side(kit, stage, playerLook(), 84, 100, { dir: 1, scale: 0.8, eyes: 'open' });
  const hers = addG(kit, stage, 120, 70);
  taxi(hers, false);
  // Sira asomada por la ventana: las dos manos.
  const hand = addG(kit, stage);
  const look = SIRA();
  let t = 0;
  kit.every(140, () => {
    t++;
    hand.clear();
    const hx = hers.x + 28;
    hand.fillStyle(hex(look.skin), 1).fillRect(hx + 2, 72, 6, 6);
    hand.fillStyle(hex(look.hair), 1).fillRect(hx + 1, 70, 8, 3);
    const up = t % 2 === 0;
    hand.fillStyle(hex(look.skin), 1).fillRect(up ? hx - 3 : hx - 1, 62, 2, 10).fillRect(up ? hx + 11 : hx + 9, 62, 2, 10);
  });
  kit.after(1000, () => kit.progress(2600, (q) => hers.setX(lerp(120, 250, q * q)), undefined));
  kit.after(400, () => popText(kit, stage, 150, 18, '¡Chao, chileno!', '#ff9cb4', 9, 0));
  kit.every(900, () => floatHeart(kit, stage, 96, 50));
};

/** El taxista te mira por el espejo: «¿Viene de una cita, joven?». Afuera pasan los postes de luz. */
const taxista: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#141826'), 1).fillRect(x, y, w, h));
  const lights = addG(kit, stage);
  let t = 0;
  kit.every(50, () => {
    t += 1;
    lights.clear();
    for (let i = 0; i < 4; i++) {
      const lx = ((i * 70 - t * 6) % 280 + 280) % 280 - 30;
      lights.fillStyle(0xf8b848, 0.5).fillRect(lx, 10, 22, 2);
      lights.fillStyle(0xf8b848, 0.15).fillRect(lx - 6, 6, 34, 10);
    }
  });
  // Tú, en el asiento de atrás, sonriendo como un tonto.
  const me = addG(kit, stage);
  bust(me, playerLook(), 64, 70, 3.6, { mouth: 'grin', blush: true });
  // El espejo retrovisor con los ojos del taxista.
  const mirror = addG(kit, stage);
  const drv = lookOf('abuelo');
  let b = 0;
  kit.every(120, () => {
    b++;
    mirror.clear();
    outlined(mirror, [[120, 14, 80, 22, '#2a2a34']]);
    mirror.fillStyle(hex(drv.skin), 1).fillRect(122, 16, 76, 18);
    mirror.fillStyle(hex(drv.hair), 1).fillRect(132, 18, 14, 2).fillRect(172, 18, 14, 2);
    const look = b % 25 < 2 ? 0 : 1;
    mirror.fillStyle(hex('#202028'), 1).fillRect(136 + look * 2, 23, 5, 4 * look + 1).fillRect(176 + look * 2, 23, 5, 4 * look + 1);
    mirror.fillStyle(hex('#5a5e68'), 1).fillRect(158, 6, 3, 8);
  });
  kit.after(700, () => popText(kit, stage, 160, 50, '¿Viene de una cita?', '#f8d070', 8, 0));
  kit.after(1700, () => popText(kit, stage, 160, 66, 'Se le nota', '#ffffff', 8, 0));
  kit.every(1300, () => floatHeart(kit, stage, 74, 46));
};

/** Pance de noche: la luz del porche de doña Mery prendida, las luciérnagas, el sapo y los grillos. */
const porche: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0e1424'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.4 + rnd(i) * 0.5).fillRect(x + Math.round(rnd(i + 3) * w), y + Math.round(rnd(i + 9) * 40), 1, 1);
    g.fillStyle(hex('#1a2a20'), 1).fillTriangle(x - 20, y + 60, x + 50, y + 24, x + 120, y + 60);
    g.fillStyle(hex('#1a2a20'), 1).fillRect(x, y + 60, w, h - 60);
    // La casa con el porche.
    g.fillStyle(hex('#3a3428'), 1).fillRect(x + 90, y + 46, 100, 46);
    g.fillStyle(hex('#5a2a20'), 1).fillTriangle(x + 82, y + 48, x + 140, y + 22, x + 198, y + 48);
    g.fillStyle(hex('#f8d070'), 0.9).fillRect(x + 104, y + 56, 14, 12).fillRect(x + 160, y + 56, 14, 12);
    g.fillStyle(hex('#5a3a28'), 1).fillRect(x + 132, y + 62, 16, 30);
    g.fillStyle(hex('#4a4438'), 1).fillRect(x + 84, y + 92, 112, 4);
  });
  // El bombillo del porche, con su cono de luz que tiembla.
  const glow = addG(kit, stage);
  kit.every(90, () => {
    glow.clear();
    const a = 0.16 + Math.random() * 0.04;
    glow.fillStyle(0xf8d070, a).fillTriangle(140, 50, 108, 96, 172, 96);
    glow.fillStyle(0xfff2b0, 1).fillCircle(140, 52, 2.5);
  });
  // Polillas alrededor del bombillo.
  const moths = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.1;
    moths.clear();
    for (let i = 0; i < 3; i++) moths.fillStyle(0xe8e0d0, 1).fillRect(Math.round(140 + Math.cos(t * (2 + i) + i) * (6 + i * 3)), Math.round(52 + Math.sin(t * (3 - i) + i) * 5), 1, 1);
  });
  // El sapo en la escalera.
  const frog = addG(kit, stage);
  outlined(frog, [[122, 86, 10, 6, '#5a7a38']]);
  frog.fillStyle(hex('#f0d048'), 1).fillRect(123, 85, 2, 2).fillRect(129, 85, 2, 2);
  // Luciérnagas.
  kit.every(260, () => {
    const fx = 10 + Math.random() * 80;
    const fy = 50 + Math.random() * 50;
    const f = addG(kit, stage, fx, fy);
    f.fillStyle(0xd8f070, 1).fillRect(0, 0, 2, 2);
    f.fillStyle(0xd8f070, 0.3).fillCircle(1, 1, 3);
    kit.progress(1400, (q) => f.setPosition(fx + Math.sin(q * 6) * 4, fy - q * 8).setAlpha(Math.sin(q * Math.PI)), () => f.destroy());
  });
  kit.every(1100, () => popText(kit, stage, 20 + Math.random() * 60, 70 + Math.random() * 20, Math.random() < 0.5 ? 'cri cri' : 'croac', '#a8c8a0', 6, 600));
};

export const M6_VINETAS_3: Record<string, VinetaBuilder> = {
  m6_piscina_noche: piscinaNoche,
  m6_sueno: sueno,
  m6_separador_listo: separadorListo,
  m6_p47_pance: p47Pance,
  m6_mango: mangoSemaforo,
  m6_estacion_univ: estacionUniv,
  m6_t31_llega: t31Llega,
  m6_tiron: tiron,
  m6_hinchas: hinchas,
  m6_abuelita: abuelita,
  m6_torre_cali: torreCali,
  m6_san_antonio: sanAntonio,
  m6_gato: gato,
  m6_dos_taxis: dosTaxis,
  m6_taxista: taxista,
  m6_porche: porche,
};
