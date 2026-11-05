import { playSfx } from '../audio/sfx';
import { formatClock, clockMinutes } from '../systems/Mission';
import { PHONE } from '../systems/Phone';
import { playerLook } from '../systems/PlayerLook';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { makeText, THEME } from '../ui/theme';
import { shade } from './palette';
import { disc, drawSideArm, drawSideBody, hex, type SideFigureOpts } from './vinetas';
import { addG, clockDigits, clockWidth, drawShakeLines, flat, floatZ, INK, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas de la pieza (misiones 2 y 3):
 *  - dormir         te acuestas con la alarma puesta; en el globo del sueño, una mochila que no cierra
 *  - despertador    ¡PIRIRIRÍ! el despertador se sacude en el velador y marca la hora real del reloj
 *  - pesadilla      10:47 en rojo, y el celular se llena de mensajes de la U
 *  - maleta / maleta_optima   te sientas encima de la maleta, rebotas, corre el cierre y... ¡click!
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const WOOD = '#a87048';
const WOOD_D = '#7a4c30';
const RED_ON = '#f04838';
const RED_OFF = '#3a1c1c';

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

/** La pieza a las 7 de la mañana: persiana con rayitas de luz, muro en penumbra y el velador. */
function drawMananaBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#4a4866'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#55526e'), 1);
  for (let i = x + 6; i < x + w; i += 12) g.fillRect(i, y, 1, h - 30);
  // Persiana: la luz se cuela entre las láminas.
  outlined(g, [[x + 150, y + 6, 56, 50, '#6a6478']]);
  for (let ly = y + 8; ly < y + 54; ly += 5) g.fillStyle(hex('#f0d8a0'), 1).fillRect(x + 151, ly, 54, 1);
  g.fillStyle(hex('#f0d8a0'), 0.12).fillRect(x + 120, y + 56, 90, 22);
  // Velador.
  g.fillStyle(hex(WOOD), 1).fillRect(x, y + 78, w, h - 78);
  g.fillStyle(hex('#c08858'), 1).fillRect(x, y + 78, w, 2);
  g.fillStyle(hex(WOOD_D), 1).fillRect(x, y + 86, w, 1).fillRect(x + 40, y + 92, 30, 2);
  // Un vaso de agua y un libro.
  outlined(g, [[x + 22, y + 66, 7, 12, '#c8e4f0']]);
  g.fillStyle(hex('#88b8d8'), 1).fillRect(x + 22, y + 71, 7, 7);
  outlined(g, [[x + 170, y + 73, 30, 5, '#d85050']]);
  g.fillStyle(hex('#f4f0e0'), 1).fillRect(x + 171, y + 74, 28, 1);
}

/** La pieza a las 10:47: demasiada luz. La persiana arriba y el sol entrando de lleno. */
function drawTardeBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#f4e6c0'), 1).fillRect(x, y, w, h);
  outlined(g, [[x + 64, y + 6, 40, 40, '#9cd8f8']]);
  disc(g, x + 94, y + 14, 5, '#fff4b0');
  g.fillStyle(hex('#f4f0e8'), 1).fillRect(x + 83, y + 6, 2, 40).fillRect(x + 64, y + 25, 40, 2);
  // Rayos de sol en diagonal.
  g.fillStyle(hex('#fff8d8'), 0.55);
  for (let i = 0; i < 26; i++) g.fillRect(x + 60 - i * 2, y + 46 + i, 46, 1);
  g.fillStyle(hex(WOOD), 1).fillRect(x, y + 82, w, h - 82);
  g.fillStyle(hex('#c08858'), 1).fillRect(x, y + 82, w, 2);
  g.fillStyle(hex(WOOD_D), 1).fillRect(x, y + 90, w, 1);
}

/** La pieza de noche: muro azul, ventana con luna y la cama. */
function drawNocheBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#1e2440'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#232a4a'), 1);
  for (let i = x + 6; i < x + w; i += 12) g.fillRect(i, y, 1, h);
  outlined(g, [[x + 74, y + 8, 30, 26, '#3a4268']]);
  g.fillStyle(hex('#0e1430'), 1).fillRect(x + 76, y + 10, 26, 22);
  disc(g, x + 95, y + 17, 3, '#f4ecc0');
  g.fillStyle(hex('#0e1430'), 1).fillRect(x + 94, y + 14, 3, 3);
  g.fillStyle(hex('#3a4268'), 1).fillRect(x + 88, y + 10, 1, 22).fillRect(x + 76, y + 21, 26, 1);
  g.fillStyle(hex('#3a3050'), 1).fillRect(x, y + 96, w, h - 96);
  // Cama: respaldo, colchón y sábana.
  outlined(g, [
    [x + 22, y + 52, 6, 46, '#6a4630'],
    [x + 28, y + 76, 128, 16, '#e8e4f0'],
    [x + 152, y + 70, 5, 28, '#6a4630'],
  ]);
  g.fillStyle(hex('#c8c4d8'), 1).fillRect(x + 28, y + 88, 124, 4);
  // Velador con el despertador (alarma puesta: la campanita encendida).
  outlined(g, [[x + 172, y + 74, 34, 24, '#5a3c28']]);
  g.fillStyle(hex('#3a2818'), 1).fillRect(x + 174, y + 84, 30, 1);
}

// ---------------------------------------------------------------------------
// Despertador
// ---------------------------------------------------------------------------

/** El despertador digital (cuerpo + pantalla), con la hora en 7 segmentos. Origen = esquina superior izquierda. */
function drawAlarmClock(g: G, hhmm: string, colon: boolean, size: 'big' | 'small', lit = true): { w: number; h: number } {
  g.clear();
  const big = size === 'big';
  const dw = big ? 12 : 9;
  const dh = big ? 20 : 15;
  const t = big ? 3 : 2;
  const digits = clockWidth(dw, t);
  const w = digits + (big ? 20 : 14);
  const h = dh + (big ? 18 : 14);
  outlined(g, [
    [2, h - 2, 6, 3, '#202028'],
    [w - 8, h - 2, 6, 3, '#202028'],
    [0, 0, w, h, '#3a3a48'],
  ]);
  g.fillStyle(hex('#4a4a5a'), 1).fillRect(0, 0, w, 2);
  g.fillStyle(hex('#1a1416'), 1).fillRect(5, 5, w - 10, h - 10);
  clockDigits(g, Math.round((w - digits) / 2), Math.round((h - dh) / 2), hhmm, lit ? RED_ON : RED_OFF, RED_OFF, colon && lit, dw, dh, t);
  // La campanita de la alarma (encendida) y el botón de posponer arriba.
  g.fillStyle(hex(RED_ON), 1).fillRect(7, 7, 3, 2).fillRect(6, 9, 5, 1);
  outlined(g, [[Math.round(w / 2) - 8, -3, 16, 2, '#6a6a7a']]);
  return { w, h };
}

/** ¡PIRIRIRÍ! El despertador da saltitos sobre el velador, con la hora que marca el reloj de la historia. */
const despertador: VinetaBuilder = (kit) => {
  const stage = kit.framed(drawMananaBackdrop);
  const hhmm = formatClock(clockMinutes());
  const clock = addG(kit, stage);
  const { w, h } = drawAlarmClock(clock, hhmm, true, 'big');
  const home = { x: Math.round((kit.panel.w - w) / 2), y: 78 - h - 1 };
  clock.setPosition(home.x, home.y);
  const lines = addG(kit, stage);
  const fx = kit.scene.add.container(0, 0);
  stage.add(fx);

  // Suena a ráfagas: 8 cuadros sacudiéndose y 5 quieto (los dos puntos parpadean).
  let f = 0;
  kit.every(60, () => {
    const ringing = f % 13 < 8;
    const dx = ringing ? (f % 2 ? 2 : -2) : 0;
    const dy = ringing && f % 4 === 0 ? -2 : 0;
    clock.setPosition(home.x + dx, home.y + dy);
    drawShakeLines(lines, home.x, home.y, w, h, ringing && f % 2 === 0, '#f0d8a0');
    if (f % 13 === 0) {
      const left = (f / 13) % 2 === 0;
      popText(kit, fx, left ? home.x - 16 : home.x + w + 16, home.y - 6, left ? '¡PIRI!' : '¡RIRÍ!', '#f8e070', 8, 420);
    }
    if (f % 8 === 0) drawAlarmClock(clock, hhmm, f % 16 === 0, 'big');
    f++;
  });
};

// ---------------------------------------------------------------------------
// Pesadilla
// ---------------------------------------------------------------------------

/** Los mensajes que revientan el celular: quién lo manda y qué dice. */
const NIGHTMARE_MSGS: Array<{ from: string; text: string }> = [
  { from: 'benja', text: '¿Dónde estai?' },
  { from: 'u', text: 'Empezó la prueba' },
  { from: 'benja', text: 'El Cuervo preguntó por ti' },
  { from: 'benja', text: 'Te van a poner un 1,0' },
];

/** Los mensajes empiezan a llegar cuando ya leíste la hora (la caja de diálogo va primero con el reloj). */
const MSG_START = 2000;
const MSG_EVERY = 800;
const PHONE_BOX = { x: 116, y: 3, w: 96, h: 102 };
const SCREEN = { x: PHONE_BOX.x + 4, y: PHONE_BOX.y + 10, w: PHONE_BOX.w - 8, h: PHONE_BOX.h - 20 };

function drawPhone(g: G): void {
  const { x, y, w, h } = PHONE_BOX;
  g.fillStyle(hex(INK), 1).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 8);
  g.fillStyle(hex('#30343e'), 1).fillRoundedRect(x, y, w, h, 7);
  g.fillStyle(hex('#3a5078'), 1).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
  g.fillStyle(hex('#46608c'), 1);
  for (let i = 0; i < 6; i++) g.fillRect(SCREEN.x, SCREEN.y + 30 + i * 9, SCREEN.w, 4);
  g.fillStyle(hex('#1a1c24'), 1).fillRect(x + w / 2 - 8, y + 4, 16, 2);
  g.fillStyle(hex('#5a5e6a'), 1).fillRect(x + w / 2 - 6, y + h - 6, 12, 2);
}

/** Globo de notificación (como el de src/ui/PhoneToast.ts, en chico). Devuelve el contenedor y su alto. */
function bubble(kit: VinetaKit, msg: { from: string; text: string }): { box: Layer; h: number } {
  const { scene } = kit;
  const contact = PHONE.contacts[msg.from];
  const color = hex(contact?.color ?? '#888888');
  const w = SCREEN.w - 6;
  const body = makeText(scene, 16, 9, msg.text, { fontSize: '7px', color: '#e8ecf8', wordWrap: { width: w - 19 } });
  const name = makeText(scene, 16, 1, contact?.name ?? msg.from, { fontSize: '6px', fontStyle: '600', color: '#9aa6c8' });
  const h = Math.round(body.height) + 11;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25).fillRoundedRect(1, 2, w, h, 4);
  g.fillStyle(THEME.dark, 0.96).fillRoundedRect(0, 0, w, h, 4);
  g.fillStyle(color, 1).fillRect(0, 2, 2, h - 4);
  g.fillStyle(color, 1).fillCircle(9, 9, 5);
  const initial = makeText(scene, 9, 9, (contact?.name ?? '?').charAt(0), { fontSize: '7px', fontStyle: '600' }).setOrigin(0.5);
  return { box: scene.add.container(0, 0, [g, initial, name, body]), h };
}

/** ¡¿LAS DIEZ CUARENTA Y SIETE?! El despertador en rojo y el celular que se llena de mensajes. */
const pesadilla: VinetaBuilder = (kit) => {
  const { scene } = kit;
  const stage = kit.framed(drawTardeBackdrop);
  const hhmm = formatClock(clockMinutes());
  const clock = addG(kit, stage);
  const { w, h } = drawAlarmClock(clock, hhmm, true, 'small');
  const home = { x: 20, y: 82 - h - 1 };
  clock.setPosition(home.x, home.y);
  const fx = scene.add.container(0, 0);
  stage.add(fx);
  // La hora parpadea en rojo; el reloj tirita.
  let f = 0;
  kit.every(200, () => {
    f++;
    clock.setX(home.x + (f % 2 ? 1 : 0));
    drawAlarmClock(clock, hhmm, true, 'small', f % 4 !== 0);
  });
  kit.after(250, () => popText(kit, fx, home.x + Math.round(w / 2), home.y - 10, '¡¿?!', '#f04838', 12, 0));

  // El celular, con la hora arriba y los mensajes que caen uno tras otro (el último queda arriba).
  const phone = scene.add.container(0, 0);
  stage.add(phone);
  const pg = scene.add.graphics();
  drawPhone(pg);
  phone.add(pg);
  phone.add(makeText(scene, SCREEN.x + SCREEN.w / 2, SCREEN.y + 2, hhmm, { fontSize: '7px', fontStyle: '600', color: '#ffb0a8' }).setOrigin(0.5, 0));
  const list = scene.add.container(0, 0);
  phone.add(list);
  const shown: Array<{ box: Layer; h: number }> = [];
  const TOP = SCREEN.y + 12;

  NIGHTMARE_MSGS.forEach((msg, i) => {
    kit.after(MSG_START + i * MSG_EVERY, () => {
      const b = bubble(kit, msg);
      b.box.setPosition(SCREEN.x + 3, TOP - 8).setAlpha(0);
      list.add(b.box);
      shown.unshift(b);
      // Los de abajo se corren; el nuevo cae desde arriba.
      let y = TOP;
      for (const s of shown) {
        const to = y;
        if (s !== b) kit.tween({ targets: s.box, y: to, duration: 200, onUpdate: () => s.box.setY(Math.round(s.box.y)) });
        y += s.h + 3;
        if (to + s.h > SCREEN.y + SCREEN.h) s.box.setVisible(false);
      }
      kit.tween({ targets: b.box, y: TOP, alpha: 1, duration: 260, ease: 'Back.Out', onUpdate: () => b.box.setY(Math.round(b.box.y)) });
      playSfx('notify');
      // El celular vibra.
      kit.progress(260, (t) => phone.setX(t < 1 ? (Math.floor(t * 12) % 2 ? 1 : -1) : 0), () => phone.setX(0));
    });
  });
  // Y siguen llegando: el globito rojo de los no leídos.
  kit.after(MSG_START + NIGHTMARE_MSGS.length * MSG_EVERY, () => {
    const badge = addG(kit, phone, PHONE_BOX.x + PHONE_BOX.w - 6, PHONE_BOX.y - 2);
    disc(badge, 0, 0, 7, INK);
    disc(badge, 0, 0, 6, '#e83838');
    const n = makeText(scene, PHONE_BOX.x + PHONE_BOX.w - 6, PHONE_BOX.y - 2, '27', { fontSize: '7px', fontStyle: '600' }).setOrigin(0.5);
    phone.add(n);
    let count = 27;
    kit.every(380, () => {
      count += 1 + Math.floor(Math.random() * 3);
      n.setText(count > 99 ? '99+' : String(count));
      playSfx('notify');
      kit.progress(160, (t) => phone.setX(t < 1 ? (Math.floor(t * 8) % 2 ? 1 : -1) : 0), () => phone.setX(0));
    });
  });
};

// ---------------------------------------------------------------------------
// Dormir: la mochila que no cierra
// ---------------------------------------------------------------------------

/** Mochila de frente (en el sueño). `gap` = cuánto se abre (0 = cerrada); `zip` = hasta dónde llegó el cierre (0..1). */
function drawBackpack(g: G, gap: number, zip: number): void {
  g.clear();
  // Lo que se sale por arriba: polerón, un calcetín y un cuaderno.
  if (gap > 0) {
    outlined(g, [
      [4, -gap - 3, 8, gap + 4, '#e05050'],
      [13, -gap - 1, 5, gap + 2, '#f4f0e0'],
      [19, -gap - 4, 6, gap + 5, '#5a8ad8'],
    ]);
    flat(g, [[13, -gap - 1, 5, 1, '#d85050']]);
  }
  outlined(g, [
    [0, 0, 28, 6, '#e8a030'],
    [0, 7 - (gap > 0 ? 1 : 0), 28, 22, '#e8a030'],
    [5, 16, 18, 9, '#d08820'],
  ]);
  flat(g, [[0, 0, 28, 1, '#f4c060'], [2, 7, 24, 1, '#b07018']]);
  // El cierre: dientes hasta donde llegó el carro.
  const end = Math.round(1 + 26 * zip);
  for (let i = 1; i < end; i += 2) flat(g, [[i, 6, 1, 1, '#c8ccd4']]);
  outlined(g, [[end, 5, 2, 4, '#c8ccd4']]);
}

/** Te acuestas con la alarma a las 7:00. Respiras despacio y sueñas con una mochila que no cierra. */
const dormir: VinetaBuilder = (kit) => {
  const { scene } = kit;
  const stage = kit.framed(drawNocheBackdrop);
  const look = playerLook();
  // El despertador del velador, con la alarma puesta.
  const clock = addG(kit, stage, 176, 62);
  outlined(clock, [[0, 0, 26, 12, '#3a3a48']]);
  clock.fillStyle(hex('#101418'), 1).fillRect(2, 2, 22, 8);
  clockDigits(clock, 3, 3, formatClock(clockMinutes()), '#58e078', '#18301c', true, 4, 6, 1);
  clock.fillStyle(hex('#58e078'), 1).fillRect(22, 2, 1, 1);

  // Acostado de espaldas: la figura de perfil girada (mira hacia arriba) con la almohada y la frazada.
  const pillow = addG(kit, stage);
  outlined(pillow, [[30, 70, 22, 7, '#f4f4fc']]);
  const sleeper = scene.add.container(42, 79);
  const body = scene.add.graphics();
  drawSideBody(body, look, { dir: 1, scale: 1, eyes: 'closed' });
  sleeper.add(body);
  sleeper.setRotation(-Math.PI / 2);
  stage.add(sleeper);
  const blanket = addG(kit, stage);
  const drawBlanket = (up: number): void => {
    blanket.clear();
    outlined(blanket, [[56, 59 - up, 98, 19 + up, '#5a8ad0']]);
    flat(blanket, [[56, 59 - up, 98, 3, '#f4f0e8'], [64, 66 - up, 80, 1, '#4a78b8'], [70, 72, 70, 1, '#4a78b8']]);
  };
  drawBlanket(0);
  // Respira: la frazada sube y baja.
  let breath = 0;
  kit.every(900, () => {
    breath = 1 - breath;
    drawBlanket(breath);
  });
  const fx = scene.add.container(0, 0);
  stage.add(fx);
  kit.every(800, () => floatZ(kit, fx, 66, 50));

  // El globo del sueño: burbujitas que crecen hasta la nube grande.
  const cloud = addG(kit, stage);
  const CLOUD = { x: 120, y: 6, w: 74, h: 50 };
  const puffs: Array<[number, number, number]> = [
    [80, 54, 2],
    [92, 48, 3],
    [106, 40, 4],
  ];
  puffs.forEach(([px, py, r], i) =>
    kit.after(200 + i * 180, () => {
      disc(cloud, px, py, r + 1, INK);
      disc(cloud, px, py, r, '#eef0fa');
    }),
  );
  const dream = scene.add.container(0, 0).setVisible(false);
  stage.add(dream);
  const bag = scene.add.graphics({ x: CLOUD.x + 23, y: CLOUD.y + 16 });
  kit.after(760, () => {
    const c = cloud;
    for (const [dx, dy, r] of [[12, 16, 12], [30, 10, 14], [50, 12, 13], [62, 24, 12], [44, 34, 13], [20, 34, 12], [10, 26, 10]] as const) {
      disc(c, CLOUD.x + dx, CLOUD.y + dy, r + 1, INK);
    }
    for (const [dx, dy, r] of [[12, 16, 12], [30, 10, 14], [50, 12, 13], [62, 24, 12], [44, 34, 13], [20, 34, 12], [10, 26, 10]] as const) {
      disc(c, CLOUD.x + dx, CLOUD.y + dy, r, '#eef0fa');
    }
    c.fillStyle(hex('#eef0fa'), 1).fillRect(CLOUD.x + 10, CLOUD.y + 14, 54, 20);
    dream.add(bag);
    dream.setVisible(true);
    loopBag();
  });
  // El cierre avanza... y ¡paf! se abre de nuevo. Una y otra vez.
  const loopBag = (): void => {
    kit.progress(
      1300,
      (t) => drawBackpack(bag, lerp(5, 1, t), t * 0.85),
      () => {
        kit.after(160, () => {
          drawBackpack(bag, 7, 0);
          playSfx('bump');
          for (const d of [-1, 1]) {
            const p = scene.add.rectangle(bag.x + 14 + d * 6, bag.y - 6, 2, 2, hex(d < 0 ? '#e05050' : '#5a8ad8')).setOrigin(0);
            dream.add(p);
            const x0 = p.x;
            const y0 = p.y;
            kit.progress(420, (t) => p.setPosition(Math.round(x0 + d * 8 * t), Math.round(y0 - Math.sin(t * Math.PI) * 6 + 4 * t)), () => p.destroy());
          }
          kit.after(500, loopBag);
        });
      },
    );
  };
};

// ---------------------------------------------------------------------------
// Maleta
// ---------------------------------------------------------------------------

const BAG = { x: 64, w: 76, base: 13, lid: 11 };
const FLOOR = 98;
const BAG_COLORS = { body: '#2f4a8c', band: '#4a6ab8', stripe: '#1e3060', tag: '#f0d048' };
const ROPA = ['#e05050', '#f0d048', '#58b070', '#f4f0e0', '#5a8ad8'];

/** La pieza de Paine de día: papel mural, ventana, la cama a un lado y el piso de madera. */
function drawPiezaBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#dce4c8'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#cbd6b4'), 1);
  for (let i = x + 3; i < x + w; i += 9) for (let j = y + 4 + ((i / 9) % 2) * 4; j < y + 80; j += 8) g.fillRect(i, j, 2, 2);
  outlined(g, [[x + 152, y + 10, 46, 38, '#f4f0e6']]);
  g.fillStyle(hex('#a8d8f4'), 1).fillRect(x + 154, y + 12, 42, 34);
  g.fillStyle(hex('#88c070'), 1).fillRect(x + 154, y + 38, 42, 8);
  g.fillStyle(hex('#6a7aa0'), 1).fillRect(x + 160, y + 32, 12, 6).fillRect(x + 176, y + 30, 14, 8);
  g.fillStyle(hex('#ffffff'), 1).fillRect(x + 163, y + 32, 5, 1).fillRect(x + 180, y + 30, 6, 1);
  g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 174, y + 12, 2, 34).fillRect(x + 154, y + 28, 42, 2);
  // Un póster en la pared y la cama a la izquierda.
  outlined(g, [[x + 98, y + 12, 22, 28, '#2f6fd0']]);
  g.fillStyle(hex('#f0d048'), 1).fillRect(x + 102, y + 18, 14, 3);
  g.fillStyle(hex('#f4f0e0'), 1).fillRect(x + 102, y + 24, 10, 1).fillRect(x + 102, y + 27, 12, 1);
  outlined(g, [[x - 2, y + 66, 44, 22, '#e86a6a'], [x - 2, y + 58, 4, 40, '#7a4c30']]);
  g.fillStyle(hex('#c84a4a'), 1).fillRect(x, y + 80, 42, 8);
  // Piso.
  g.fillStyle(hex('#b07a4a'), 1).fillRect(x, y + 80 + 18, w, h - 98);
  g.fillStyle(hex('#c08a58'), 1).fillRect(x, y + 98, w, 1);
  g.fillStyle(hex('#8a5a38'), 1);
  for (let i = x + 8; i < x + w; i += 22) g.fillRect(i, y + 99, 1, h - 99);
}

/**
 * La maleta acostada, de lado: base, tapa y (si aún no cierra) la ropa que asoma entre ambas.
 * `gap` = separación entre tapa y base; `zip` = hasta dónde corrió el cierre (0..1).
 */
function drawSuitcase(g: G, gap: number, zip: number): number {
  g.clear();
  const { x, w } = BAG;
  const baseTop = FLOOR - BAG.base;
  const lidTop = baseTop - gap - BAG.lid;
  // La ropa que se arranca por el borde (más abultada mientras más abierta).
  if (gap > 0) {
    for (let i = 0; i < 9; i++) {
      const cx = x + 3 + i * 8;
      const bulge = (i * 5) % 3;
      g.fillStyle(hex(INK), 1).fillRect(cx - 1, baseTop - gap - 1, 9, gap + 2);
      g.fillStyle(hex(ROPA[i % ROPA.length]), 1).fillRect(cx, baseTop - gap - (bulge > 0 && gap > 2 ? 1 : 0), 7, gap + 1);
    }
    // Una manga colgando por delante.
    if (gap > 2) outlined(g, [[x + w - 18, baseTop - 1, 5, 6, '#e05050']]);
  }
  outlined(g, [
    [x, baseTop, w, BAG.base, BAG_COLORS.body],
    [x, lidTop, w, BAG.lid, BAG_COLORS.body],
    [x + 6, FLOOR, 4, 1, '#202028'],
    [x + w - 10, FLOOR, 4, 1, '#202028'],
  ]);
  flat(g, [
    [x, lidTop, w, 2, BAG_COLORS.band],
    [x, baseTop + BAG.base - 3, w, 3, BAG_COLORS.stripe],
    [x + 28, lidTop + 4, 18, 2, BAG_COLORS.stripe],
    [x + 2, baseTop + 3, 3, 4, BAG_COLORS.tag],
  ]);
  // El cierre: la costura y los dientes hasta donde llegó el carro.
  const seam = baseTop - Math.ceil(gap / 2);
  const end = Math.round(x + 2 + (w - 4) * zip);
  g.fillStyle(hex('#1a2448'), 1).fillRect(x, seam, w, 1);
  g.fillStyle(hex('#c8ccd4'), 1);
  for (let i = x + 2; i < end; i += 2) g.fillRect(i, seam, 1, 1);
  if (zip > 0 && zip < 1) outlined(g, [[end, seam - 1, 2, 3, '#e8ecf0'], [end + 2, seam, 3, 1, '#a8b0bc']]);
  return lidTop;
}

/** Las piernas de alguien sentado de perfil (mirando a la derecha): muslo hacia adelante y la pantorrilla colgando. */
function drawSitLegs(g: G, pants: string, shoes: string, swing: number): void {
  g.clear();
  outlined(g, [
    [0, 0, 22, 5, pants],
    [17 + swing, 4, 5, 13, pants],
    [17 + swing, 16, 8, 4, shoes],
  ]);
  flat(g, [[0, 4, 22, 1, shade(pants, -0.2)]]);
}

/** Te sientas encima de la maleta: rebotas, la tapa baja, corre el cierre y... ¡click! (`optimal`: 23,0 kg exactos). */
function buildMaleta(kit: VinetaKit, optimal: boolean): void {
  const { scene } = kit;
  const stage = kit.framed(drawPiezaBackdrop);
  const look = playerLook();
  const opts: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
  const FIG_X = 116;
  // De atrás hacia adelante: el cuerpo, la maleta (tapa las piernas paradas), las piernas sentadas y el brazo.
  const body = addG(kit, stage);
  drawSideBody(body, look, opts);
  const bag = addG(kit, stage);
  const legs = addG(kit, stage);
  const arm = addG(kit, stage);
  drawSideArm(arm, look, opts, false);
  const fx = scene.add.container(0, 0);
  stage.add(fx);
  const shoes = look.shoes ?? '#303038';

  let gap = 8;
  let zip = 0;
  let swing = 0;
  /**
   * Coloca todo según la tapa. En el salto la tapa sube contigo (la ropa empuja), así la maleta siempre tapa
   * las piernas paradas de la figura; `press` = cuánto se aplasta en el golpe.
   */
  const layout = (jump: number, press: number): void => {
    const lidTop = drawSuitcase(bag, Math.max(0, gap + jump - press), zip);
    const top = lidTop - 37;
    body.setPosition(FIG_X, top);
    arm.setPosition(FIG_X, top);
    legs.setPosition(FIG_X + 6, top + 33);
    drawSitLegs(legs, look.pants, shoes, swing);
  };
  layout(0, 0);

  // Tres botes: cada uno baja la tapa un poco y escupe un pedacito de ropa por los lados.
  const GAPS = [5, 2, 0];
  const bounce = (i: number): void => {
    if (i >= GAPS.length) {
      kit.after(200, zipUp);
      return;
    }
    kit.progress(
      420,
      (t) => {
        swing = t < 0.5 ? 1 : 0;
        layout(Math.round(Math.sin(t * Math.PI) * 6), 0);
      },
      () => {
        gap = GAPS[i];
        swing = 0;
        layout(0, 1);
        playSfx('bump');
        for (const d of [-1, 1]) {
          const px = d < 0 ? BAG.x - 2 : BAG.x + BAG.w + 1;
          const p = scene.add.rectangle(px, FLOOR - BAG.base - 2, 2, 2, hex(ROPA[(i * 2 + (d > 0 ? 1 : 0)) % ROPA.length])).setOrigin(0);
          fx.add(p);
          kit.progress(380, (t) => p.setPosition(Math.round(px + d * 10 * t), Math.round(FLOOR - BAG.base - 2 - Math.sin(t * Math.PI) * 8 + 10 * t * t)), () => p.destroy());
        }
        kit.after(90, () => layout(0, 0));
        kit.after(260, () => bounce(i + 1));
      },
    );
  };
  kit.after(350, () => bounce(0));

  // El cierre corre de punta a punta; al final, ¡click!
  const zipUp = (): void => {
    kit.progress(
      1100,
      (t) => {
        zip = t;
        layout(0, 0);
      },
      () => {
        zip = 1;
        layout(0, 0);
        playSfx('click');
        popText(kit, fx, BAG.x + BAG.w - 4, FLOOR - BAG.base - 22, '¡click!', '#ffffff', 9, 0);
        sparkle(kit, fx, BAG.x + BAG.w - 2, FLOOR - BAG.base - 2);
        // Satisfecho: ojitos cerrados.
        opts.eyes = 'closed';
        body.clear();
        drawSideBody(body, look, opts);
        if (optimal) kit.after(450, () => showWeight(kit, fx));
      },
      'Sine.InOut',
    );
  };
}

/** La etiqueta de la balanza con los 23,0 kilos exactos, con brillitos. */
function showWeight(kit: VinetaKit, fx: Layer): void {
  const tag = kit.scene.add.container(BAG.x + 16, 34);
  const g = kit.scene.add.graphics();
  outlined(g, [[-24, -8, 48, 16, '#f4f0e0']]);
  g.fillStyle(hex('#58b070'), 1).fillRect(-24, -8, 48, 2);
  tag.add(g);
  tag.add(makeText(kit.scene, 0, 1, '23,0 kg', { fontSize: '9px', fontStyle: '600', color: INK }).setOrigin(0.5));
  fx.add(tag);
  tag.setScale(0.2);
  kit.tween({ targets: tag, scale: 1, duration: 260, ease: 'Back.Out' });
  const spots = [[-26, -10], [24, -6], [-8, 10], [20, 9]];
  let i = 0;
  kit.every(300, () => {
    const [dx, dy] = spots[i++ % spots.length];
    sparkle(kit, fx, tag.x + dx, tag.y + dy);
  });
}

/** Viñetas de la pieza, para el registro de src/ui/Vineta.ts. */
export const PIEZA_VINETAS: Record<string, VinetaBuilder> = {
  dormir,
  despertador,
  pesadilla,
  maleta: (kit) => buildMaleta(kit, false),
  maleta_optima: (kit) => buildMaleta(kit, true),
};
