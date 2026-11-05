import { playSfx } from '../audio/sfx';
import { FONT_HUD } from '../config/display';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { characterLook } from './SpriteRegistry';
import { disc, drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';
import { addG, flat, floatHeart, floatZ, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';

/**
 * Más viñetas de la misión 4: la casa de doña Mery (el cuadro, la hamaca, la ducha fría, la ventana con el
 * bichofué, el ventilador, la nevera, lavarse los dientes, el reloj de pulsera y la mochila), comer en Cali
 * (buñuelo, pandebono, empanada, tinto, lulada, cholado y aborrajado), los recuerdos del viaje, la selfie
 * del grupo de intercambio, el pavo real, la iguana del lago y la capilla.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const W = 220;
const H = 108;
const INK = '#2a2433';

function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const lookOf = (id: string): HumanLook => (characterLook(id) as HumanLook | undefined) ?? playerLook();

/** Muro de la casa: blanco con el zócalo azul verdoso. */
function caliWallBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#f4f0e6'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#4aa0b8'), 1).fillRect(x, y + h - 26, w, 26);
  g.fillStyle(hex('#78c0d0'), 1).fillRect(x, y + h - 26, w, 2);
}

/**
 * Busto de frente (cara, pelo y hombros) a escala `s`, con el centro de la cara en (cx, cy).
 * Para la selfie, el espejo y la ducha.
 */
function drawBust(g: G, look: HumanLook, cx: number, cy: number, s: number, mouth: 'smile' | 'open' | 'teeth' = 'smile'): void {
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  // Hombros y cuello.
  r(-8, 7, 16, 6, INK);
  r(-7, 8, 14, 5, look.shirt);
  r(-2, 5, 4, 3, shade(look.skin, -0.12));
  // Pelo de atrás (largo).
  if (look.hairStyle === 'long') r(-6, -4, 12, 11, look.hair);
  // Cara.
  r(-5, -5, 10, 11, INK);
  r(-4, -4, 8, 9, look.skin);
  // Pelo o jockey arriba.
  if (look.hairStyle === 'cap') {
    r(-5, -6, 10, 4, INK);
    r(-4, -5, 8, 3, look.cap ?? '#2f6fd0');
    r(-5, -3, 10, 1, shade(look.cap ?? '#2f6fd0', -0.3));
  } else if (look.hairStyle !== 'bald') {
    r(-5, -6, 10, 4, INK);
    r(-4, -5, 8, 3, look.hair);
    if (look.hairStyle === 'bun') r(-2, -8, 4, 3, look.hair);
  }
  // Ojos, mejillas y boca.
  r(-2.5, -0.5, 1, 1.5, '#202028');
  r(1.5, -0.5, 1, 1.5, '#202028');
  if (look.extras?.includes('glasses')) {
    r(-3.5, -1.5, 3, 3, '#c8e4f8');
    r(0.5, -1.5, 3, 3, '#c8e4f8');
    r(-2.5, -0.5, 1, 1.5, '#202028');
    r(1.5, -0.5, 1, 1.5, '#202028');
  }
  r(-3.5, 1.5, 1, 1, '#e8a0a0');
  r(2.5, 1.5, 1, 1, '#e8a0a0');
  if (mouth === 'open') r(-1, 2.5, 2, 2, '#7a2a2a');
  else if (mouth === 'teeth') r(-1.5, 2.5, 3, 1.5, '#f8f8f0');
  else r(-1.5, 3, 3, 1, '#7a2a2a');
}

// ---------------------------------------------------------------------------
// La casa de doña Mery
// ---------------------------------------------------------------------------

/** El cuadro de los Farallones: el sol baja y una nube se engancha en la punta. */
const casaCuadro: VinetaBuilder = (kit) => {
  const stage = kit.framed(caliWallBackdrop);
  const F = { x: 46, y: 10, w: 128, h: 80 };
  const frame = addG(kit, stage);
  outlined(frame, [[F.x - 6, F.y - 6, F.w + 12, F.h + 12, '#7a4c28']]);
  flat(frame, [
    [F.x - 4, F.y - 4, F.w + 8, 2, '#a87444'],
    [F.x - 4, F.y - 4, 2, F.h + 8, '#a87444'],
  ]);
  const paint = addG(kit, stage);
  const cloud = addG(kit, stage);
  let ms = 0;
  const draw = (): void => {
    paint.clear();
    const bands = ['#f8c070', '#f4a068', '#e8806a', '#c86a7a'];
    bands.forEach((c, i) => paint.fillStyle(hex(c), 1).fillRect(F.x, F.y + i * 10, F.w, 10));
    paint.fillStyle(hex('#a85a78'), 1).fillRect(F.x, F.y + 40, F.w, F.h - 40);
    // El sol que se va poniendo detrás de los cerros.
    const sunY = F.y + 30 + Math.min(18, ms / 400);
    disc(paint, F.x + 84, Math.round(sunY), 9, '#f8e8a0');
    // Los Farallones: tres capas de cerros.
    paint.fillStyle(hex('#5a6a88'), 1).fillTriangle(F.x, F.y + 52, F.x + 50, F.y + 18, F.x + 100, F.y + 52);
    paint.fillStyle(hex('#3c5a5a'), 1).fillTriangle(F.x + 40, F.y + 56, F.x + 96, F.y + 26, F.x + F.w, F.y + 50).fillRect(F.x + 96, F.y + 50, F.w - 96, 6);
    paint.fillStyle(hex('#2a4c40'), 1).fillRect(F.x, F.y + 54, F.w, F.h - 54);
    // El río Pance brillando y unas palmas.
    paint.fillStyle(hex('#f0b080'), 1).fillRect(F.x + 10, F.y + 66, 70, 2).fillRect(F.x + 30, F.y + 70, 60, 1);
    for (const px of [14, 110]) {
      paint.fillStyle(hex('#1c3828'), 1).fillRect(F.x + px, F.y + 44, 2, 22);
      paint.fillRect(F.x + px - 6, F.y + 42, 14, 3).fillRect(F.x + px - 8, F.y + 45, 4, 2).fillRect(F.x + px + 6, F.y + 45, 4, 2);
    }
    // Un par de pájaros (pinceladas en V).
    for (const [bx, by] of [[30, 16], [40, 12]]) paint.fillStyle(hex('#5a3c48'), 1).fillRect(F.x + bx, F.y + by, 2, 1).fillRect(F.x + bx + 3, F.y + by, 2, 1).fillRect(F.x + bx + 2, F.y + by + 1, 1, 1);
    cloud.clear();
    const cx = F.x + 40 + ((ms / 90) % 40);
    cloud.fillStyle(0xfff4ec, 0.85).fillEllipse(cx, F.y + 20, 22, 5).fillEllipse(cx + 8, F.y + 18, 12, 5);
  };
  draw();
  kit.every(80, () => {
    ms += 80;
    draw();
  });
  // El reflejo del vidrio que cruza el cuadro.
  const shine = addG(kit, stage);
  kit.every(2600, () => {
    kit.progress(700, (t) => {
      shine.clear().fillStyle(0xffffff, 0.22);
      const x = F.x - 20 + t * (F.w + 40);
      for (let i = 0; i < 14; i++) shine.fillRect(Math.round(x + i), F.y + i * 6, 6, 6);
    }, () => shine.clear());
  });
  stage.add(makeText(kit.scene, F.x + F.w - 4, F.y + F.h + 2, 'Pance, 1998', { fontSize: '7px', fontStyle: 'italic', color: '#5a5c68' }).setOrigin(1, 0));
};

/** La hamaca: te subes y te meces con los ojos cerrados. Zzz. */
const casaHamaca: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    caliWallBackdrop(g, x, y, w, h);
    // Una mata de plátano asomada y el piso de greda.
    g.fillStyle(hex('#3c9c48'), 1).fillEllipse(x + 196, y + 20, 40, 16).fillEllipse(x + 206, y + 38, 30, 12);
    g.fillStyle(hex('#2a6a34'), 1).fillRect(x + 200, y + 20, 2, 60);
    g.fillStyle(hex('#c8704c'), 1).fillRect(x, y + 92, w, 16);
  });
  const hooks = addG(kit, stage);
  outlined(hooks, [
    [26, 18, 6, 6, '#6a6c78'],
    [188, 18, 6, 6, '#6a6c78'],
  ]);
  const ham = addG(kit, stage);
  const sleeper = kit.scene.add.container(0, 0);
  stage.add(sleeper);
  const look = playerLook();
  const body = kit.scene.add.graphics();
  drawSideBody(body, { ...look, extras: [] }, { dir: 1, scale: 0.8, eyes: 'closed' });
  // Acostado: la figura girada 90° (cabeza a la izquierda).
  body.setRotation(-Math.PI / 2).setPosition(-24, 6);
  sleeper.add(body);
  const colors = ['#d84848', '#f0c030', '#3c9c48', '#2f6fd0'];
  let t = 0;
  kit.every(50, () => {
    t += 0.05;
    const sway = Math.sin(t * 2.2) * 6;
    ham.clear();
    // Las cuerdas y la tela de rayas, colgando en curva.
    ham.lineStyle(1, hex('#8a6a40'), 1).lineBetween(29, 24, 60 + sway, 58).lineBetween(191, 24, 160 + sway, 58);
    for (let x = 60; x <= 160; x++) {
      const k = (x - 60) / 100;
      const y = 58 + Math.sin(k * Math.PI) * 18;
      ham.fillStyle(hex(colors[Math.floor((x - 60) / 6) % 4]), 1).fillRect(Math.round(x + sway), Math.round(y), 1, 6);
    }
    sleeper.setPosition(Math.round(110 + sway), 70);
  });
  kit.every(900, () => floatZ(kit, stage, 96 + Math.round(Math.sin(t * 2.2) * 6), 52));
};

/** La ducha fría: el agua cae, tiritas, castañeteas los dientes y gritas. */
const casaDucha: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#d8e8f0'), 1).fillRect(x, y, w, h);
    for (let yy = 0; yy < h; yy += 12) g.fillStyle(hex('#b8ccd8'), 1).fillRect(x, y + yy, w, 1);
    for (let xx = 0; xx < w; xx += 12) g.fillStyle(hex('#b8ccd8'), 1).fillRect(x + xx, y, 1, h);
    // La regadera (un tubo y una flor de metal) y la perilla, una sola.
    g.fillStyle(hex('#8a909c'), 1).fillRect(x + 108, y, 4, 12).fillRect(x + 98, y + 12, 24, 4);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x + 100, y + 13, 20, 2);
    g.fillStyle(hex('#6a6c78'), 1).fillRect(x + 176, y + 50, 10, 10);
  });
  const look = { ...playerLook(), shirt: playerLook().skin };
  const person = kit.scene.add.container(110, 74);
  stage.add(person);
  const bust = kit.scene.add.graphics();
  person.add(bust);
  drawBust(bust, { ...look, hairStyle: 'short' }, 0, 0, 3, 'teeth');
  const water = addG(kit, stage);
  let ms = 0;
  kit.every(40, () => {
    ms += 40;
    water.clear().fillStyle(0xa8d8ff, 0.9);
    for (let i = 0; i < 40; i++) {
      const x = 100 + Math.round(rand(i) * 20) + Math.round((rand(i + 50) - 0.5) * ((ms / 40 + i * 3) % 30));
      const y = 16 + ((ms * 0.25 + i * 13) % 80);
      water.fillRect(x, Math.round(y), 1, 3);
    }
    // Tiritando.
    person.setX(110 + (Math.floor(ms / 60) % 2 ? 1 : -1));
  });
  // Frío: rayitas azules y un velo azul que late.
  const chill = kit.scene.add.rectangle(0, 0, W, H, 0x6aa8e8).setAlpha(0).setOrigin(0);
  stage.add(chill);
  kit.tween({ targets: chill, alpha: 0.18, duration: 500, yoyo: true, repeat: -1 });
  kit.after(500, () => {
    playSfx('ducha');
    popText(kit, stage, 60, 30, '¡AAAH!', '#2f6fd0', 13, 0);
  });
  kit.after(1600, () => popText(kit, stage, 160, 40, 'brrr', '#5a8ab8', 9, 0));
};

/** Por la ventana: el patio, los Farallones y el bichofué que grita su nombre. */
const casaVentana: VinetaBuilder = (kit) => {
  const raining = StoryState.weather === 'lluvia' || StoryState.weather === 'tormenta';
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(raining ? '#8a96a8' : '#9cd0f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex(raining ? '#5a6a74' : '#5a9c80'), 1).fillTriangle(x - 10, y + 70, x + 70, y + 22, x + 150, y + 70).fillTriangle(x + 90, y + 70, x + 170, y + 30, x + 240, y + 70);
    g.fillStyle(hex(raining ? '#d8dce4' : '#f4f8fc'), 1).fillEllipse(x + 70, y + 26, 40, 8).fillEllipse(x + 168, y + 32, 34, 7);
    g.fillStyle(hex(raining ? '#3c6a48' : '#48a058'), 1).fillRect(x, y + 70, w, h - 70);
  });
  const leaves = addG(kit, stage);
  const bird = kit.scene.add.container(150, 64);
  stage.add(bird);
  const bg = kit.scene.add.graphics();
  bird.add(bg);
  // El bichofué: barriga amarilla, cabeza con antifaz blanco y negro, pico negro.
  outlined(bg, [
    [-5, -4, 10, 7, '#8a6a40'],
    [-4, 0, 8, 4, '#f8d838'],
    [3, -7, 6, 5, '#2a2433'],
    [4, -6, 4, 1, '#f8f8f0'],
    [9, -5, 3, 1, '#2a2433'],
  ]);
  const wire = addG(kit, stage);
  wire.fillStyle(hex('#3a3c44'), 1).fillRect(0, 68, W, 1);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    leaves.clear();
    // Hojas de la mata de plátano que se mecen con el viento.
    for (let i = 0; i < 4; i++) {
      const sway = Math.round(Math.sin(t * 1.4 + i) * 3);
      leaves.fillStyle(hex(i % 2 ? '#3c9c48' : '#2a7a3c'), 1).fillEllipse(24 + i * 14 + sway, 84 - i * 8, 26, 9);
    }
    if (raining) {
      leaves.fillStyle(0xd8e4f4, 0.7);
      for (let i = 0; i < 40; i++) leaves.fillRect(Math.round((rand(i) * 240 + t * 60) % 240) - 10, Math.round((rand(i + 9) * 120 + t * 160) % 120) - 8, 1, 4);
    }
  });
  if (!raining) {
    // El bichofué salta en el cable, grita y se va volando.
    kit.after(600, () => kit.progress(300, (k) => bird.setY(64 - Math.round(Math.sin(k * Math.PI) * 4))));
    kit.after(1200, () => popText(kit, stage, 160, 44, '¡bichofué!', '#f8d838', 10, 1400));
    kit.after(2900, () => kit.progress(1200, (k) => bird.setPosition(lerp(150, 250, k), Math.round(64 - k * 50 - Math.sin(k * 20) * 3))));
  } else bird.setVisible(false);
  // Los barrotes de la reja, delante de todo.
  const bars = addG(kit, stage);
  bars.fillStyle(hex(INK), 1);
  for (let x = 20; x < W; x += 30) bars.fillRect(x, 0, 3, H);
  bars.fillRect(0, 50, W, 3);
};

/** El ventilador de pie, girando sin parar. */
const casaVentilador: VinetaBuilder = (kit) => {
  const stage = kit.framed(caliWallBackdrop);
  const fan = addG(kit, stage);
  const air = addG(kit, stage);
  let a = 0;
  kit.every(40, () => {
    a += 0.55;
    fan.clear();
    outlined(fan, [
      [106, 70, 8, 30, '#6a6c78'],
      [92, 98, 36, 6, '#3a3c44'],
    ]);
    disc(fan, 110, 46, 30, INK);
    disc(fan, 110, 46, 29, '#c8ccd4');
    for (let i = 0; i < 3; i++) {
      const ang = a + (i * Math.PI * 2) / 3;
      fan.fillStyle(hex('#4aa0b8'), 1).fillEllipse(110 + Math.cos(ang) * 14, 46 + Math.sin(ang) * 14, 20, 12);
    }
    disc(fan, 110, 46, 5, '#2a2c34');
    // La rejilla de adelante.
    fan.lineStyle(1, hex('#8a909c'), 0.8);
    for (let r = 10; r < 30; r += 6) fan.strokeCircle(110, 46, r);
    air.clear().fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 6; i++) {
      const k = (a * 6 + i * 23) % 70;
      air.fillRect(Math.round(146 + k), 30 + i * 7, 8, 1);
    }
  });
};

/** La nevera abierta: frutas, el queso, la botella «del perro» y (en la tarde) la lulada con tu nombre. */
const casaNevera: VinetaBuilder = (kit) => {
  const tarde = StoryState.hasFlag('volvio_casa');
  const stage = kit.framed((g, x, y, w, h) => {
    caliWallBackdrop(g, x, y, w, h);
    g.fillStyle(hex(INK), 1).fillRect(x + 54, y + 2, 112, h);
    g.fillStyle(hex('#f4f8fc'), 1).fillRect(x + 56, y + 4, 108, h);
    g.fillStyle(hex('#e4ecf4'), 1).fillRect(x + 60, y + 8, 100, h);
    for (const sy of [36, 66]) g.fillStyle(hex('#c8d4e0'), 1).fillRect(x + 60, y + sy, 100, 2);
    g.fillStyle(hex('#fff8d8'), 1).fillRect(x + 100, y + 8, 20, 3);
  });
  const g = addG(kit, stage);
  // Repisa de arriba: lulos y maracuyás.
  for (let i = 0; i < 5; i++) {
    disc(g, 70 + i * 9, 30, 4, INK);
    disc(g, 70 + i * 9, 30, 3, '#f0a030');
    g.fillStyle(hex('#3c7c38'), 1).fillRect(70 + i * 9, 26, 1, 2);
  }
  for (let i = 0; i < 3; i++) {
    g.fillStyle(hex(INK), 1).fillEllipse(124 + i * 11, 30, 11, 9);
    g.fillStyle(hex('#e8d040'), 1).fillEllipse(124 + i * 11, 30, 9, 7);
  }
  // Repisa del medio: el queso blanco enorme y los mangos.
  outlined(g, [[66, 50, 34, 14, '#f8f4e0']]);
  flat(g, [[66, 50, 34, 3, '#fffcf0']]);
  for (let i = 0; i < 3; i++) {
    g.fillStyle(hex(INK), 1).fillEllipse(116 + i * 13, 58, 12, 10);
    g.fillStyle(hex(i % 2 ? '#e8a030' : '#d86838'), 1).fillEllipse(116 + i * 13, 58, 10, 8);
  }
  // Abajo: la botella de agua «NO TOMAR, ES DEL PERRO».
  outlined(g, [[70, 72, 12, 30, '#c8e4f8'], [73, 68, 6, 4, '#2f6fd0']]);
  outlined(g, [[66, 84, 20, 8, '#f8f8f0']]);
  stage.add(makeText(kit.scene, 76, 85, 'DEL PERRO', { fontFamily: FONT_HUD, fontSize: '5px', color: '#d83838' }).setOrigin(0.5, 0));
  if (tarde) {
    // La lulada tapada con un platito y una cinta con tu nombre.
    outlined(g, [[120, 74, 16, 26, '#e0eef4']]);
    flat(g, [[122, 80, 12, 18, '#c8c840'], [118, 72, 20, 3, '#f4f2ea'], [121, 88, 14, 4, '#f8f4e0']]);
    stage.add(makeText(kit.scene, 128, 88, 'FELI', { fontFamily: FONT_HUD, fontSize: '5px', color: '#2a48a0' }).setOrigin(0.5, 0));
    kit.after(500, () => sparkle(kit, stage, 132, 74));
  }
  // El frío que sale.
  kit.every(260, () => {
    const p = addG(kit, stage, 70 + Math.round(Math.random() * 80), 100);
    p.fillStyle(0xffffff, 0.5).fillRect(0, 0, 3, 1);
    kit.progress(1000, (t) => p.setPosition(p.x + Math.round(Math.sin(t * 6)), Math.round(100 + t * 10)).setAlpha(0.5 * (1 - t)), () => p.destroy());
  });
};

/** En el espejo: te lavas los dientes con agua fría. Espuma. */
const casaDientes: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e4ecef'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex(INK), 1).fillRect(x + 54, y + 4, 112, 100);
    g.fillStyle(hex('#bcd8e8'), 1).fillRect(x + 56, y + 6, 108, 96);
    g.fillStyle(hex('#d8ecf8'), 1).fillRect(x + 60, y + 10, 20, 4).fillRect(x + 60, y + 16, 8, 3);
  });
  const look = playerLook();
  const bust = addG(kit, stage);
  drawBust(bust, look, 110, 54, 4, 'teeth');
  const brush = addG(kit, stage);
  const foam = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 1;
    const bx = 104 + (t % 2 ? 6 : -2);
    brush.clear();
    outlined(brush, [[bx, 66, 26, 3, '#2f6fd0'], [bx - 3, 64, 4, 4, '#f8f8f0']]);
    if (t % 4 === 0) {
      foam.fillStyle(0xffffff, 1).fillCircle(102 + Math.random() * 16, 68 + Math.random() * 4, 1 + Math.random() * 1.5);
    }
  });
  kit.after(600, () => popText(kit, stage, 168, 30, 'chiqui-chiqui', '#ffffff', 8, 0));
};

/** El reloj de pulsera: marca la hora de Chile (o la de Cali), o se atrasa dos horas girando la perilla. */
function relojPulsera(mode: 'chile' | 'cali' | 'atrasar'): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed((g, x, y, w, h) => {
      g.fillStyle(hex('#d8c8b0'), 1).fillRect(x, y, w, h);
      g.fillStyle(hex('#c8b498'), 1).fillRect(x, y + 70, w, 38);
    });
    const look = playerLook();
    const arm = addG(kit, stage);
    // El brazo cruzando la viñeta y la correa de cuero.
    outlined(arm, [[0, 44, 220, 26, look.skin]]);
    flat(arm, [[0, 44, 220, 3, shade(look.skin, 0.12)], [0, 66, 220, 4, shade(look.skin, -0.12)]]);
    outlined(arm, [[92, 38, 36, 38, '#5a3c28']]);
    disc(arm, 110, 57, 21, INK);
    disc(arm, 110, 57, 20, '#c8ccd4');
    disc(arm, 110, 57, 17, '#f8f4e8');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      arm.fillStyle(hex(INK), 1).fillRect(Math.round(110 + Math.cos(a) * 14), Math.round(57 + Math.sin(a) * 14), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    }
    outlined(arm, [[130, 54, 4, 6, '#a8b0bc']]);
    const hands = addG(kit, stage);
    const now = StoryState.clock;
    const drawAt = (minutes: number): void => {
      hands.clear();
      const m = minutes % 60;
      const h = (minutes / 60) % 12;
      const am = (m / 60) * Math.PI * 2 - Math.PI / 2;
      const ah = (h / 12) * Math.PI * 2 - Math.PI / 2;
      hands.lineStyle(2, hex(INK), 1).lineBetween(110, 57, 110 + Math.cos(ah) * 9, 57 + Math.sin(ah) * 9);
      hands.lineStyle(1, hex(INK), 1).lineBetween(110, 57, 110 + Math.cos(am) * 14, 57 + Math.sin(am) * 14);
      disc(hands, 110, 57, 1, '#d83838');
    };
    const label = (text: string): void => {
      stage.add(makeText(kit.scene, 110, 88, text, { fontFamily: FONT_HUD, fontSize: '8px', color: '#5a3c28' }).setOrigin(0.5, 0));
    };
    if (mode === 'chile') {
      drawAt(now + 120);
      label('HORA DE CHILE');
    } else if (mode === 'cali') {
      drawAt(now);
      label('HORA DE CALI');
    } else {
      drawAt(now + 120);
      kit.after(500, () => {
        playSfx('click');
        kit.progress(1600, (t) => drawAt(now + 120 * (1 - t)), () => {
          label('¡HORA DE CALI!');
          sparkle(kit, stage, 128, 40);
        }, 'Sine.InOut');
      });
    }
  };
}

/** La mochila abierta: van saltando el cuaderno, el estuche, el cargador y el mapa de Cali. */
const casaMochila: VinetaBuilder = (kit) => {
  const stage = kit.framed(caliWallBackdrop);
  const bag = addG(kit, stage);
  outlined(bag, [
    [80, 46, 60, 52, '#e8a030'],
    [84, 40, 52, 10, '#c88828'],
    [96, 66, 28, 18, '#d89028'],
  ]);
  flat(bag, [[80, 46, 60, 3, '#f0b850'], [104, 70, 12, 2, '#a8b0bc']]);
  const items: Array<[string, string, number]> = [
    ['cuaderno', '#2f6fd0', 40],
    ['estuche', '#d84848', 80],
    ['cargador', '#2a2c34', 140],
    ['mapa', '#f0e0b0', 180],
  ];
  items.forEach(([name, color, tx], i) =>
    kit.after(300 + i * 450, () => {
      const it = addG(kit, stage, 110, 44);
      outlined(it, [[-8, -6, 16, 12, color]]);
      if (name === 'mapa') flat(it, [[-6, -4, 5, 8, '#68a858'], [0, -2, 6, 1, '#d84848']]);
      if (name === 'cuaderno') flat(it, [[-6, -2, 12, 1, '#f8f8f0'], [-6, 1, 10, 1, '#f8f8f0']]);
      playSfx('page');
      kit.progress(420, (t) => it.setPosition(lerp(110, tx, t), Math.round(44 - Math.sin(t * Math.PI) * 30 + t * 34)));
      kit.after(440, () => stage.add(makeText(kit.scene, tx, 92, name, { fontSize: '7px', color: '#2a2433' }).setOrigin(0.5, 0)));
    }),
  );
};

// ---------------------------------------------------------------------------
// Comer en Cali
// ---------------------------------------------------------------------------

type Food = 'bunuelo' | 'pandebono' | 'empanada' | 'aborrajado' | 'tinto' | 'lulada' | 'cholado';

/** Color de cada píxel de la comida (o null), centrada en (0, 0). */
function foodPixel(food: Food, x: number, y: number): string | null {
  switch (food) {
    case 'bunuelo': {
      const d = Math.hypot(x, y);
      if (d > 14) return null;
      if (d > 13) return INK;
      return (x * 7 + y * 3) % 9 === 0 ? '#b87828' : d < 6 && x < 0 && y < 0 ? '#f0c060' : '#d89840';
    }
    case 'pandebono': {
      const d = Math.hypot(x / 1.25, y);
      if (d > 11) return null;
      if (d > 10) return INK;
      return y < -4 ? '#f0d070' : (x * 5 + y * 7) % 11 === 0 ? '#d8a848' : '#f4e0a0';
    }
    case 'empanada': {
      if (y > 6 || y < -10) return null;
      const half = Math.sqrt(Math.max(0, 1 - ((y + 2) / 9) ** 2)) * 22;
      if (Math.abs(x) > half + (y > 0 ? 0 : 0)) return null;
      if (Math.abs(x) > half - 1 || y === 6 || y === -10) return INK;
      return y > 2 ? '#c87830' : (x + y) % 5 === 0 ? '#c88a30' : '#e8a840';
    }
    case 'aborrajado': {
      const d = Math.hypot(x / 1.6, y);
      if (d > 11) return null;
      if (d > 10) return INK;
      if (Math.abs(y) < 2 && Math.abs(x) < 10) return '#f8f0c8';
      return (x * 3 + y * 5) % 7 === 0 ? '#b86820' : '#d88830';
    }
    default:
      return null;
  }
}

/** Dibuja la comida mordida: lo que queda a la derecha de `cut` se fue (con el borde de los dientes). */
function drawFood(g: G, food: Food, cut: number): void {
  g.clear();
  for (let y = -16; y <= 16; y++) {
    for (let x = -24; x <= 24; x++) {
      const c = foodPixel(food, x, y);
      if (!c) continue;
      const edge = cut + Math.round(Math.sin(y * 0.9) * 2);
      if (x > edge) continue;
      g.fillStyle(hex(x === edge ? INK : c), 1).fillRect(x, y, 1, 1);
    }
  }
}

/** Mesa de la cafetería (o del comedor) con la ventana atrás. */
function cafeBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  const rain = StoryState.hasFlag('comio_u') && !StoryState.hasFlag('tormenta_vista');
  g.fillStyle(hex('#c0684a'), 1).fillRect(x, y, w, h);
  for (let yy = 2; yy < 70; yy += 4) g.fillStyle(hex('#a85a3c'), 1).fillRect(x, y + yy, w, 1);
  g.fillStyle(hex(INK), 1).fillRect(x + 140, y + 8, 64, 44);
  g.fillStyle(hex(rain ? '#7a8898' : '#a8d8f0'), 1).fillRect(x + 142, y + 10, 60, 40);
  g.fillStyle(hex('#3c9c48'), 1).fillRect(x + 142, y + 38, 60, 12);
  g.fillStyle(hex('#2c4a38'), 1).fillRect(x + 14, y + 8, 50, 30);
  for (const yy of [14, 20, 26, 32]) g.fillStyle(hex('#e8e4dc'), 1).fillRect(x + 18, y + yy, 26, 2).fillStyle(hex('#f0d048'), 1).fillRect(x + 50, y + yy, 8, 2);
  g.fillStyle(hex('#e8ecf0'), 1).fillRect(x, y + 74, w, h - 74);
  g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 74, w, 2);
}

/** La mano con la manga, desde abajo. */
function hand(g: G, look: HumanLook): void {
  outlined(g, [
    [-4, 4, 9, 60, look.shirt],
    [-4, -3, 8, 8, look.skin],
    [3, -5, 3, 4, look.skin],
  ]);
}

/** Comida que se come en tres mascadas. */
function comer(food: Food): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(cafeBackdrop);
    // La comida y la mano van al doble de tamaño (pixel art escalado entero).
    const held = kit.scene.add.container(104, 52).setScale(2);
    stage.add(held);
    const g = kit.scene.add.graphics();
    held.add(g);
    const h = kit.scene.add.graphics({ x: -14, y: 6 });
    hand(h, playerLook());
    held.add(h);
    let cut = 24;
    drawFood(g, food, cut);
    const cuts = [10, -4, -30];
    const fx = kit.scene.add.container(0, 0);
    stage.add(fx);
    // Humito si está caliente.
    if (food !== 'aborrajado') {
      kit.every(260, () => {
        if (cut < -20) return;
        const s = addG(kit, fx, 90 + Math.round(Math.random() * 28), 22);
        s.fillStyle(0xffffff, 0.6).fillRect(0, 0, 1, 3);
        kit.progress(900, (t) => s.setPosition(s.x + Math.round(Math.sin(t * 7)), Math.round(22 - t * 16)).setAlpha(0.6 * (1 - t)), () => s.destroy());
      });
    }
    cuts.forEach((c, i) =>
      kit.after(500 + i * 950, () => {
        kit.progress(260, (t) => held.setY(52 - Math.round(Math.sin(t * Math.PI) * 8)));
        kit.after(130, () => {
          cut = c;
          drawFood(g, food, cut);
          playSfx('eat');
          popText(kit, fx, 104 + c * 2 + 22, 22, '¡ñam!', '#ffffff', 9, 500);
          for (let k = 0; k < 4; k++) {
            const cr = addG(kit, fx, 104 + c * 2 + Math.round(Math.random() * 10), 52);
            cr.fillStyle(hex(k % 2 ? '#d89840' : '#f0c060'), 1).fillRect(0, 0, 1, 1);
            kit.progress(500, (t) => cr.setPosition(cr.x + (k - 1.5) * t * 4, Math.round(56 + t * t * 40)), () => cr.destroy());
          }
        });
      }),
    );
    kit.after(500 + cuts.length * 950, () => {
      for (let i = 0; i < 3; i++) kit.after(i * 260, () => floatHeart(kit, fx, 90 + i * 12, 40));
    });
  };
}

/** Bebidas (tinto, lulada) y el cholado: sorbos o cucharadas, y el vaso se va vaciando. */
function tomar(food: 'tinto' | 'lulada' | 'cholado'): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(cafeBackdrop);
    const held = kit.scene.add.container(108, food === 'lulada' ? 100 : 94).setScale(food === 'lulada' ? 1.5 : 2);
    stage.add(held);
    const cup = kit.scene.add.graphics();
    held.add(cup);
    const h = kit.scene.add.graphics({ x: -18, y: -14 });
    hand(h, playerLook());
    held.add(h);
    const tall = food === 'lulada' ? 40 : food === 'cholado' ? 30 : 16;
    const wide = food === 'tinto' ? 9 : 12;
    let level = 1;
    const draw = (): void => {
      cup.clear();
      outlined(cup, [[-wide, -tall, wide * 2, tall, food === 'tinto' ? '#f8f8f0' : '#e0eef4']]);
      const liq = food === 'tinto' ? '#4a2818' : food === 'lulada' ? '#c8c840' : '#f4f0f8';
      const lh = Math.round((tall - 3) * level);
      if (lh > 0) cup.fillStyle(hex(liq), 1).fillRect(-wide + 1, -lh - 1, wide * 2 - 2, lh);
      if (food === 'lulada') for (let i = 0; i < 6; i++) if ((tall - 3) * level > i * 6) cup.fillStyle(hex('#4a8a38'), 1).fillRect(-wide + 3 + ((i * 5) % 18), -4 - i * 6, 2, 2);
      if (food === 'cholado' && level > 0.2) {
        // Las frutas, la lechera y la galleta encima.
        cup.fillStyle(hex('#e86878'), 1).fillRect(-wide + 2, -10, 6, 4).fillStyle(hex('#f8e070'), 1).fillRect(-wide + 10, -12, 8, 4);
        cup.fillStyle(hex('#f8f4e0'), 1).fillEllipse(0, -lh - 2, wide * 2, 6);
        cup.fillStyle(hex('#c88848'), 1).fillRect(-3, -lh - 8, 7, 4);
      }
      if (food === 'lulada') cup.fillStyle(hex('#e84848'), 1).fillRect(4, -tall - 10, 2, 14);
    };
    draw();
    const fx = kit.scene.add.container(0, 0);
    stage.add(fx);
    if (food === 'tinto') {
      kit.every(240, () => {
        if (level <= 0) return;
        const s = addG(kit, fx, 104 + Math.round(Math.random() * 8), 64);
        s.fillStyle(0xffffff, 0.6).fillRect(0, 0, 1, 3);
        kit.progress(900, (t) => s.setPosition(s.x + Math.round(Math.sin(t * 7)), Math.round(64 - t * 16)).setAlpha(0.6 * (1 - t)), () => s.destroy());
      });
    }
    [0.6, 0.25, 0].forEach((to, i) =>
      kit.after(500 + i * 950, () => {
        const from = level;
        playSfx('eat');
        popText(kit, fx, 150, 40, food === 'cholado' ? '¡ñam!' : '¡glu!', '#ffffff', 8, 500);
        kit.progress(520, (t) => {
          held.setY((food === 'lulada' ? 100 : 94) - Math.round(Math.sin(t * Math.PI) * 10));
          level = from + (to - from) * t;
          draw();
        });
      }),
    );
    if (food === 'lulada' || food === 'cholado') {
      kit.after(3500, () => popText(kit, fx, 108, 30, food === 'lulada' ? '¡ácida!' : '¡brrr!', '#a8e0ff', 10, 900));
    }
  };
}

// ---------------------------------------------------------------------------
// Recuerdos del viaje, la selfie, el pavo real, la iguana y la capilla
// ---------------------------------------------------------------------------

/** En el avión, Luz Dary te enseña a hablar caleño. */
const recuerdoVecina: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eceef2'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 86, w, 22);
    g.fillStyle(hex('#9aa0aa'), 1).fillEllipse(x + 30, y + 40, 26, 36);
    g.fillStyle(hex('#a8d8f8'), 1).fillEllipse(x + 30, y + 40, 20, 30);
    g.fillStyle(hex('#f4f8fc'), 1).fillEllipse(x + 30, y + 46, 16, 6);
    for (const sx of [70, 150]) g.fillStyle(hex('#2f4a8c'), 1).fillRect(x + sx, y + 30, 14, 60).fillStyle(hex('#1e3060'), 1).fillRect(x + sx, y + 30, 14, 4);
  });
  const opts: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
  const me = addG(kit, stage, 90, 98 - FIGURE_H);
  drawSideBody(me, { ...playerLook(), extras: [] }, opts);
  const luz = addG(kit, stage, 118, 98 - FIGURE_H);
  drawSideBody(luz, lookOf('calena'), { dir: -1, scale: 0.95, eyes: 'open' });
  drawSideArm(addG(kit, stage, 118, 98 - FIGURE_H), lookOf('calena'), { dir: -1, scale: 0.95, eyes: 'open' }, false);
  const bubble = (x: number, y: number, text: string, color: string): void => {
    const g = addG(kit, stage);
    const t = makeText(kit.scene, x, y, text, { fontSize: '8px', color: INK }).setOrigin(0.5);
    g.fillStyle(0xffffff, 1).fillRoundedRect(x - t.width / 2 - 4, y - 7, t.width + 8, 14, 4);
    g.fillStyle(hex(color), 1).fillTriangle(x - 2, y + 7, x + 4, y + 7, x, y + 12);
    stage.add(t);
  };
  kit.after(300, () => bubble(80, 22, '¿Cachai?', '#ffffff'));
  kit.after(1300, () => {
    const x = addG(kit, stage);
    x.lineStyle(2, hex('#d83838'), 1).lineBetween(60, 16, 100, 28);
    playSfx('error');
  });
  kit.after(2000, () => bubble(156, 22, '¡¿Sí o qué?!', '#ffffff'));
  kit.after(2600, () => sparkle(kit, stage, 180, 12));
};

/** Rayos X de la aduana: la marraqueta con palta, en rojo. */
const recuerdoMarraqueta: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1a1c24'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#14286a'), 1).fillRect(x + 20, y + 8, w - 40, h - 26);
  });
  const g = addG(kit, stage);
  // La mochila (contorno verde de rayos X) con el cuaderno y la marraqueta.
  g.lineStyle(1, hex('#58e0a8'), 1).strokeRect(60, 20, 100, 60).strokeRect(70, 30, 30, 40).strokeRect(110, 50, 20, 12);
  const bread = addG(kit, stage);
  let on = true;
  kit.every(350, () => {
    on = !on;
    bread.clear().fillStyle(hex(on ? '#e84848' : '#a83030'), 1).fillEllipse(124, 36, 30, 16);
    bread.fillStyle(hex('#9ccc50'), 1).fillEllipse(124, 36, 18, 5);
  });
  const t = makeText(kit.scene, 110, H - 12, 'PRODUCTO VEGETAL · ¿DECLARA?', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' }).setOrigin(0.5);
  stage.add(t);
  kit.every(500, () => t.setVisible(!t.visible));
  kit.after(400, () => playSfx('bip'));
};

/** La selfie del grupo de intercambio en la Plaza Central: ¡whisky! */
const reunionSelfie: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#9cd0f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c0684a'), 1).fillRect(x, y + 30, w, 30);
    for (let xx = 6; xx < w; xx += 16) g.fillStyle(hex('#5a7898'), 1).fillRect(x + xx, y + 36, 8, 8);
    g.fillStyle(hex('#3c9050'), 1).fillEllipse(x + 30, y + 30, 40, 26).fillEllipse(x + 190, y + 28, 44, 28);
    g.fillStyle(hex('#c89878'), 1).fillRect(x, y + 60, w, h - 60);
  });
  const back = ['alvaro', 'iker', 'pau', 'sergio', 'antoine', 'lucas'];
  const front = ['mathieu', 'hugo', 'player', 'nacho', 'diego', 'monica'];
  const g = addG(kit, stage);
  back.forEach((id, i) => drawBust(g, lookOf(id), 30 + i * 32, 56, 2.2));
  front.forEach((id, i) => drawBust(g, id === 'player' ? playerLook() : lookOf(id), 22 + i * 35, 80, 2.6));
  // Banderitas de papel colgando: España, Francia, Perú y Chile.
  const flag = (x: number, draw: (f: G) => void): void => {
    const f = addG(kit, stage, x, 6);
    f.fillStyle(hex(INK), 1).fillRect(-1, -1, 14, 11);
    draw(f);
  };
  flag(14, (f) => f.fillStyle(hex('#c83838'), 1).fillRect(0, 0, 12, 9).fillStyle(hex('#f0c030'), 1).fillRect(0, 2, 12, 5));
  flag(70, (f) => f.fillStyle(hex('#2050a8'), 1).fillRect(0, 0, 4, 9).fillStyle(hex('#f8f8f0'), 1).fillRect(4, 0, 4, 9).fillStyle(hex('#c83838'), 1).fillRect(8, 0, 4, 9));
  flag(136, (f) => f.fillStyle(hex('#c83838'), 1).fillRect(0, 0, 4, 9).fillStyle(hex('#f8f8f0'), 1).fillRect(4, 0, 4, 9).fillStyle(hex('#c83838'), 1).fillRect(8, 0, 4, 9));
  flag(194, (f) => f.fillStyle(hex('#f8f8f0'), 1).fillRect(0, 0, 12, 5).fillStyle(hex('#c83838'), 1).fillRect(0, 5, 12, 4).fillStyle(hex('#2050a8'), 1).fillRect(0, 0, 4, 5).fillStyle(hex('#f8f8f0'), 1).fillRect(1, 1, 1, 1));
  const cord = addG(kit, stage);
  cord.lineStyle(1, hex(INK), 0.6).lineBetween(0, 5, W, 5);
  kit.after(1500, () => {
    playSfx('camera');
    const flash = kit.scene.add.rectangle(0, 0, W, H, 0xffffff).setAlpha(0.9).setOrigin(0);
    stage.add(flash);
    kit.tween({ targets: flash, alpha: 0, duration: 450 });
    popText(kit, stage, 110, 14, '¡WHISKY!', '#f8e070', 12, 0);
  });
};

/** El pavo real del campus abre la cola y grita. */
const pavoReal: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8d8f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#3c9050'), 1).fillEllipse(x + 30, y + 40, 60, 40).fillEllipse(x + 200, y + 36, 60, 44);
    g.fillStyle(hex('#5aac4a'), 1).fillRect(x, y + 80, w, h - 80);
  });
  const fan = addG(kit, stage);
  const bird = addG(kit, stage);
  const cx = 110;
  const by = 80;
  const drawFan = (k: number): void => {
    fan.clear();
    if (k <= 0) {
      // Cola cerrada, arrastrando hacia la izquierda.
      fan.fillStyle(hex('#2a6a34'), 1).fillTriangle(cx - 6, by - 10, cx - 60, by + 2, cx - 6, by - 2);
      for (let i = 0; i < 4; i++) disc(fan, cx - 20 - i * 10, by - 4, 2, '#e0b840');
      return;
    }
    const r = 10 + 44 * k;
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.02) {
      for (let rr = 6; rr < r; rr += 2) {
        fan.fillStyle(hex(rr > r - 4 ? '#2a6a34' : '#3c9c48'), 1).fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(by - 10 + Math.sin(a) * rr), 2, 2);
      }
    }
    // Ocelos en dos anillos.
    for (const ring of [0.55, 0.85]) {
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const ex = Math.round(cx + Math.cos(a) * r * ring);
        const ey = Math.round(by - 10 + Math.sin(a) * r * ring);
        disc(fan, ex, ey, 3, '#e0b840');
        disc(fan, ex, ey, 1, '#1c2a8a');
      }
    }
  };
  drawFan(0);
  // El cuerpo azul eléctrico, el cuello largo y la crestita.
  outlined(bird, [
    [cx - 8, by - 16, 16, 14, '#1c8a8a'],
    [cx, by - 38, 6, 24, '#2a5cc8'],
    [cx - 1, by - 44, 9, 8, '#2a5cc8'],
    [cx - 4, by - 2, 2, 10, '#8a8a94'],
    [cx + 3, by - 2, 2, 10, '#8a8a94'],
  ]);
  flat(bird, [
    [cx + 8, by - 41, 3, 2, '#d8c8a0'],
    [cx + 4, by - 42, 2, 2, '#f8f8f0'],
    [cx + 5, by - 42, 1, 1, '#202028'],
    [cx - 1, by - 50, 1, 5, '#2a5cc8'],
    [cx + 2, by - 51, 1, 6, '#2a5cc8'],
    [cx + 5, by - 50, 1, 5, '#2a5cc8'],
    [cx - 6, by - 14, 6, 4, '#5aa0f0'],
  ]);
  stage.bringToTop(bird);
  kit.after(700, () => {
    playSfx('pavo');
    popText(kit, stage, 170, 24, '¡MIÁAAU!', '#f8e070', 11, 1200);
    kit.progress(700, (t) => drawFan(t), () => {
      kit.every(180, () => sparkle(kit, stage, cx - 40 + Math.round(Math.random() * 80), by - 50 + Math.round(Math.random() * 30)));
    }, 'Back.Out');
  });
};

/** La iguana del lago asiente con la cabeza: así saludan. */
const iguana: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#a8d8f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#4a7cc8'), 1).fillRect(x, y + 60, w, h - 60);
    g.fillStyle(hex('#7cacec'), 1).fillRect(x + 20, y + 70, 40, 2).fillRect(x + 140, y + 84, 50, 2);
    g.fillStyle(hex('#8a8478'), 1).fillEllipse(x + 110, y + 82, 150, 40);
    g.fillStyle(hex('#a8a090'), 1).fillEllipse(x + 100, y + 74, 120, 16);
  });
  const body = addG(kit, stage);
  outlined(body, [
    [60, 58, 70, 14, '#58a048'],
    [20, 66, 42, 4, '#58a048'],
    [70, 72, 4, 8, '#3c7c38'],
    [116, 72, 4, 8, '#3c7c38'],
  ]);
  for (let x = 64; x < 128; x += 6) body.fillStyle(hex('#3c7c38'), 1).fillTriangle(x, 58, x + 3, 52, x + 6, 58);
  for (let x = 22; x < 60; x += 6) body.fillStyle(hex('#3c7c38'), 1).fillRect(x, 66, 3, 4);
  const head = kit.scene.add.container(130, 60);
  stage.add(head);
  const hg = kit.scene.add.graphics();
  head.add(hg);
  outlined(hg, [
    [0, -6, 22, 12, '#68b058'],
    [4, 4, 10, 6, '#c8b048'],
  ]);
  flat(hg, [[14, -3, 2, 2, '#202028'], [6, 6, 4, 3, '#e8d070']]);
  [0, 1, 2].forEach((i) => kit.after(600 + i * 500, () => kit.progress(400, (t) => head.setY(60 + Math.round(Math.sin(t * Math.PI) * 5)))));
  kit.after(2200, () => popText(kit, stage, 150, 30, '(asiente)', '#ffffff', 8, 900));
};

/** La capilla: bancas de madera, un vitral y velas que titilan. */
const capilla: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#efe6d2'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8a6a48'), 1).fillRect(x, y + 84, w, h - 84);
  });
  const g = addG(kit, stage);
  // El vitral de colores con su arco.
  const cols = ['#d84848', '#2f6fd0', '#f0c030', '#3c9c48', '#9c6cb8'];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) g.fillStyle(hex(cols[(i + j) % 5]), 1).fillRect(92 + i * 6, 10 + j * 6, 6, 6);
  g.fillStyle(hex(INK), 1);
  for (let i = 0; i <= 6; i++) g.fillRect(92 + i * 6, 10, 1, 48);
  for (let j = 0; j <= 8; j++) g.fillRect(92, 10 + j * 6, 36, 1);
  // Las bancas.
  for (let i = 0; i < 3; i++) outlined(g, [[20 + i * 64, 76, 50, 6, '#7a4c28'], [24 + i * 64, 82, 4, 14, '#5a3c20'], [62 + i * 64, 82, 4, 14, '#5a3c20']]);
  // Rayos de luz que bajan del vitral.
  const light = addG(kit, stage);
  light.fillStyle(0xfff4c0, 0.18).fillTriangle(92, 58, 128, 58, 150, 100).fillTriangle(92, 58, 70, 100, 150, 100);
  const flames = addG(kit, stage);
  kit.every(120, () => {
    flames.clear();
    for (const cx of [40, 180]) {
      outlined(flames, [[cx - 2, 60, 4, 14, '#f8f4e8']]);
      const f = Math.random() < 0.5 ? 0 : 1;
      flames.fillStyle(hex('#f0c030'), 1).fillRect(cx - 1, 54 + f, 3, 5 - f).fillStyle(hex('#f8f0a0'), 1).fillRect(cx, 56, 1, 2);
    }
  });
};

export const CALI_VINETAS_2: Record<string, VinetaBuilder> = {
  casa_cuadro: casaCuadro,
  casa_hamaca: casaHamaca,
  casa_ducha: casaDucha,
  casa_ventana: casaVentana,
  casa_ventilador: casaVentilador,
  casa_nevera: casaNevera,
  casa_dientes: casaDientes,
  casa_mochila: casaMochila,
  reloj_chile: relojPulsera('chile'),
  reloj_cali: relojPulsera('cali'),
  reloj_atrasar: relojPulsera('atrasar'),
  comer_bunuelo: comer('bunuelo'),
  comer_pandebono: comer('pandebono'),
  comer_empanada_valluna: comer('empanada'),
  comer_aborrajado: comer('aborrajado'),
  tomar_tinto: tomar('tinto'),
  tomar_lulada: tomar('lulada'),
  comer_cholado: tomar('cholado'),
  recuerdo_vecina: recuerdoVecina,
  recuerdo_marraqueta: recuerdoMarraqueta,
  reunion_selfie: reunionSelfie,
  pavo_real: pavoReal,
  iguana: iguana,
  capilla: capilla,
};
