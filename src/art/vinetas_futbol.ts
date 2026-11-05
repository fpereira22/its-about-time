import { playSfx } from '../audio/sfx';
import { FONT_HUD } from '../config/display';
import { Dialogue } from '../systems/DialogueManager';
import { playerLook } from '../systems/PlayerLook';
import { makeText } from '../ui/theme';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { characterLook } from './SpriteRegistry';
import { disc, drawSideBody, FIGURE_H, FIGURE_W, hex, type SideFigureOpts } from './vinetas';
import { addG, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas del partido de la misión 4. Durante el partido (las muestra FutbolScene): tu gol, tu hat-trick
 * y tu autogol. Después (en los diálogos): el festejo del equipo, en andas tras un hat-trick, la figura
 * del partido y la burla cariñosa del autogol.
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const W = 220;
const H = 108;
const INK = '#2a2433';
const BLUE = '#2050a8';
const GREEN = '#2c9c4c';
const GROUND = 96;

function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Tú, con la polera azul de la U y short blanco. */
const me = (): HumanLook => ({ ...playerLook(), shirt: BLUE, pants: '#f0f0e8', extras: [] });
const mate = (id: string): HumanLook => ({ ...((characterLook(id) as HumanLook | undefined) ?? me()), extras: [] });

/** La cancha de noche-tarde: tribuna con gente, el pasto con franjas y la línea. */
function pitchBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#f4c494'), 1).fillRect(x, y, w, 30);
  g.fillStyle(hex('#8a8e98'), 1).fillRect(x, y + 30, w, 26);
  for (let i = 0; i < 70; i++) {
    const cx = x + ((i * 37) % w);
    const cy = y + 33 + (i % 3) * 7;
    g.fillStyle(hex(['#2050a8', '#e85878', '#f0c030', '#2c9c4c', '#f8f8f0', '#e88838'][i % 6]), 1).fillRect(cx, cy + 3, 4, 4);
    g.fillStyle(hex('#c89070'), 1).fillRect(cx + 1, cy, 2, 3);
  }
  for (let xx = 0; xx < w; xx += 24) g.fillStyle(hex(xx % 48 ? '#5aac4a' : '#66ba54'), 1).fillRect(x + xx, y + 56, 24, h - 56);
  g.fillStyle(hex('#f0f0e8'), 1).fillRect(x, y + GROUND + 2, w, 1);
}

/** Un brazo levantado (celebración) en coordenadas de la figura, espejado si mira a la izquierda. */
function armUp(g: G, look: HumanLook, opts: SideFigureOpts, x0: number, tilt = 0): void {
  const s = opts.scale;
  const fx = (x: number, w: number): number => Math.round((opts.dir === 1 ? x : FIGURE_W - x - w) * s);
  const sleeve = shade(look.shirt, -0.22);
  const parts: Array<[number, number, number, number, string]> = [
    [x0 + tilt, -2, 4, 19, sleeve],
    [x0 + tilt * 2, -5, 4, 3, look.skin],
  ];
  g.fillStyle(hex(INK), 1);
  for (const [x, y, w, h] of parts) g.fillRect(fx(x - 1, w + 2), Math.round((y - 1) * s), Math.round((w + 2) * s), Math.round((h + 2) * s));
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(fx(x, w), Math.round(y * s), Math.round(w * s), Math.round(h * s));
}

/** Figura de perfil con los dos brazos arriba, saltando. Devuelve el contenedor para moverlo. */
function cheering(kit: VinetaKit, layer: Layer, look: HumanLook, x: number, dir: 1 | -1, jump = true, phase = 0, scale = 1): Layer {
  const c = kit.scene.add.container(x, GROUND - FIGURE_H * scale);
  layer.add(c);
  const opts: SideFigureOpts = { dir, scale, eyes: 'closed' };
  // Los brazos van detrás de la cabeza (de perfil, se ven asomando arriba).
  const arms = kit.scene.add.graphics();
  armUp(arms, look, opts, 4, -1);
  armUp(arms, look, opts, 8, 0);
  const body = kit.scene.add.graphics();
  drawSideBody(body, look, opts);
  c.add([arms, body]);
  if (jump) {
    const y0 = c.y;
    kit.every(40, () => c.setY(Math.round(y0 - Math.abs(Math.sin(kit.scene.time.now / 160 + phase)) * 8)));
  }
  return c;
}

/** Papelitos de colores que caen. */
function confetti(kit: VinetaKit, layer: Layer, every = 60): void {
  const colors = [0x2050a8, 0xf0c030, 0xe85878, 0xf8f8f0, 0x3c9c48];
  kit.every(every, () => {
    const x = Math.round(Math.random() * W);
    const p = kit.scene.add.rectangle(x, -4, 2, 2, colors[Math.floor(Math.random() * colors.length)]).setOrigin(0);
    layer.add(p);
    kit.progress(1400 + Math.random() * 600, (t) => p.setPosition(Math.round(x + Math.sin(t * 9 + x) * 4), Math.round(-4 + t * (H + 8))), () => p.destroy());
  });
}

/** El arco con la red; `ball` mete la pelota adentro (la red se infla). */
function goalNet(kit: VinetaKit, layer: Layer, x: number, ball: boolean): G {
  const g = addG(kit, layer);
  const draw = (bulge: number): void => {
    g.clear();
    g.fillStyle(0xe8ecf0, 0.45).fillRect(x, 50, 40, GROUND - 50);
    g.lineStyle(1, hex('#c8ccd4'), 0.9);
    for (let i = 0; i <= 8; i++) g.lineBetween(x + i * 5 + (i > 4 ? bulge : 0), 50, x + i * 5 + (i > 4 ? bulge : 0), GROUND);
    for (let j = 0; j <= 9; j++) g.lineBetween(x, 50 + j * 5, x + 40 + bulge, 50 + j * 5);
    g.fillStyle(hex('#f8f8f0'), 1).fillRect(x - 2, 48, 3, GROUND - 48).fillRect(x - 2, 48, 44, 3);
    if (ball) {
      disc(g, x + 28 + bulge, GROUND - 6, 5, INK);
      disc(g, x + 28 + bulge, GROUND - 6, 4, '#f8f8f0');
      g.fillStyle(hex(INK), 1).fillRect(x + 27 + bulge, GROUND - 7, 2, 2);
    }
  };
  draw(0);
  if (ball) kit.progress(500, (t) => draw(Math.round(Math.sin(t * Math.PI) * 6)));
  return g;
}

// ---------------------------------------------------------------------------
// Durante el partido
// ---------------------------------------------------------------------------

/** ¡Tu gol! Llegas deslizándote de rodillas con los brazos arriba y te caen encima Álvaro y Nacho. */
const futbolGol: VinetaBuilder = (kit) => {
  const stage = kit.framed(pitchBackdrop);
  goalNet(kit, stage, 176, true);
  const fx = kit.scene.add.container(0, 0);
  stage.add(fx);
  const runner = cheering(kit, stage, me(), -30, 1, false);
  kit.progress(800, (t) => runner.setX(lerp(-30, 96, 1 - Math.pow(1 - t, 3))), () => {
    // Pasto que salta al deslizarse.
    for (let i = 0; i < 8; i++) {
      const p = addG(kit, fx, 112, GROUND);
      p.fillStyle(0x3c8c3c, 1).fillRect(0, 0, 2, 1);
      kit.progress(500, (t) => p.setPosition(112 + i * 2 - 8 + t * (i - 4) * 4, Math.round(GROUND - Math.sin(t * Math.PI) * 10)), () => p.destroy());
    }
  });
  kit.after(900, () => {
    cheering(kit, stage, mate('alvaro_u'), 40, 1, true, 0.4);
    cheering(kit, stage, mate('nacho_u'), 140, -1, true, 1.1);
    confetti(kit, fx);
  });
  kit.after(300, () => popText(kit, fx, 110, 24, '¡GOOOOL!', '#f8e070', 14, 0));
};

/** ¡Hat-trick! Tres dedos arriba y la tribuna tira sombreros vueltiaos. */
const futbolHattrick: VinetaBuilder = (kit) => {
  const stage = kit.framed(pitchBackdrop);
  const fx = kit.scene.add.container(0, 0);
  const star = cheering(kit, stage, me(), 98, 1, true);
  stage.add(fx);
  // Los tres dedos (encima de la mano de adelante).
  const fingers = addG(kit, star);
  fingers.fillStyle(hex(INK), 1).fillRect(8, -11, 5, 7);
  fingers.fillStyle(hex(me().skin), 1).fillRect(9, -10, 1, 5).fillRect(10, -11, 1, 6).fillRect(11, -10, 1, 5);
  kit.every(140, () => {
    // Sombreros que vuelan desde la tribuna.
    const x = Math.round(Math.random() * W);
    const hat = addG(kit, fx, x, 40);
    outlined(hat, [[-6, 0, 12, 2, '#f4ecd0'], [-3, -3, 6, 3, '#f4ecd0']]);
    hat.fillStyle(hex(INK), 1).fillRect(-3, -1, 6, 1);
    const dx = (Math.random() - 0.5) * 60;
    kit.progress(1100, (t) => hat.setPosition(Math.round(x + dx * t), Math.round(40 - Math.sin(t * Math.PI) * 30 + t * 50)).setAngle(t * 360), () => hat.destroy());
  });
  confetti(kit, fx, 50);
  popText(kit, fx, 110, 20, '¡HAT-TRICK!', '#f8e070', 14, 0);
  kit.after(600, () => playSfx('gol'));
};

/** Autogol: la pelota entra en nuestro arco, Mathieu en el suelo y tú con las manos en la cabeza. */
const futbolAutogol: VinetaBuilder = (kit) => {
  const stage = kit.framed(pitchBackdrop);
  goalNet(kit, stage, 10, true);
  // Mathieu, el arquero, boca abajo en el pasto.
  const gk = addG(kit, stage);
  outlined(gk, [
    [56, GROUND - 8, 34, 8, '#e88838'],
    [88, GROUND - 9, 10, 9, mate('mathieu').skin],
    [40, GROUND - 6, 16, 6, '#2a2a34'],
  ]);
  gk.fillStyle(hex(mate('mathieu').hair), 1).fillRect(94, GROUND - 9, 4, 3);
  // Tú: de perfil, con las manos en la cabeza y una gota de sudor.
  const look = me();
  const c = kit.scene.add.container(140, GROUND - FIGURE_H);
  stage.add(c);
  const body = kit.scene.add.graphics();
  drawSideBody(body, look, { dir: -1, scale: 1, eyes: 'closed' });
  const hands = kit.scene.add.graphics();
  outlined(hands, [
    [6, 8, 4, 12, shade(look.shirt, -0.22)],
    [4, 2, 6, 6, look.skin],
  ]);
  c.add([body, hands]);
  kit.every(1200, () => {
    const d = addG(kit, stage, 152, GROUND - FIGURE_H + 4);
    d.fillStyle(0xa8e0ff, 1).fillRect(0, 0, 2, 3);
    kit.progress(700, (t) => d.setPosition(152, Math.round(GROUND - FIGURE_H + 4 + t * 10)).setAlpha(1 - t), () => d.destroy());
  });
  kit.after(300, () => {
    popText(kit, stage, 110, 22, '¡AUTOGOL!', '#e85040', 13, 0);
    playSfx('error');
  });
  kit.after(1200, () => popText(kit, stage, 72, 52, 'pardon...', '#ffffff', 8, 0));
};

// ---------------------------------------------------------------------------
// Después del partido
// ---------------------------------------------------------------------------

/** El equipo entero saltando abrazado, con el marcador en la pizarra. */
const caliFestejo: VinetaBuilder = (kit) => {
  const stage = kit.framed(pitchBackdrop);
  const team = ['alvaro_u', 'iker_u', 'pau_u', 'player', 'nacho_u', 'diego_u', 'hugo_u'];
  team.forEach((id, i) => cheering(kit, stage, id === 'player' ? me() : mate(id), 8 + i * 30, i < 3 ? 1 : -1, true, i * 0.7));
  const fx = kit.scene.add.container(0, 0);
  stage.add(fx);
  confetti(kit, fx, 40);
  // La pizarra del marcador.
  const board = addG(kit, stage);
  outlined(board, [[70, 4, 80, 18, '#1a2236']]);
  board.fillStyle(hex(BLUE), 1).fillRect(74, 8, 6, 10);
  board.fillStyle(hex(GREEN), 1).fillRect(140, 8, 6, 10);
  stage.add(makeText(kit.scene, 110, 13, `INT ${Dialogue.vars.get('marcador') ?? ''} ING`, { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' }).setOrigin(0.5));
};

/** Hat-trick: te llevan en andas Álvaro y Nacho, y la tribuna aplaude. */
const caliHombros: VinetaBuilder = (kit) => {
  const stage = kit.framed(pitchBackdrop);
  const carriers = kit.scene.add.container(0, 0);
  stage.add(carriers);
  const a = cheering(kit, carriers, mate('alvaro_u'), 78, 1, false);
  const b = cheering(kit, carriers, mate('nacho_u'), 112, -1, false);
  const rider = cheering(kit, stage, me(), 96, 1, false);
  rider.setY(GROUND - FIGURE_H * 2 + 18);
  const y0 = [a.y, b.y, rider.y];
  kit.every(40, () => {
    const k = Math.round(Math.abs(Math.sin(kit.scene.time.now / 220)) * 4);
    a.setY(y0[0] - k);
    b.setY(y0[1] - k);
    rider.setY(y0[2] - k);
  });
  const fx = kit.scene.add.container(0, 0);
  stage.add(fx);
  confetti(kit, fx, 50);
  kit.after(300, () => popText(kit, fx, 110, 18, '¡EN ANDAS!', '#f8e070', 12, 0));
};

/** La figura del partido: una tarjeta con tu cara, los goles y estrellas. */
const caliFigura: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1a2236'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 40; i++) g.fillStyle(0xf8e070, 0.5).fillRect(x + Math.round(rand(i) * w), y + Math.round(rand(i + 40) * h), 1, 1);
  });
  const card = kit.scene.add.container(110, 160);
  stage.add(card);
  const g = kit.scene.add.graphics();
  card.add(g);
  g.fillStyle(hex('#c89820'), 1).fillRoundedRect(-44, -48, 88, 96, 6);
  g.fillStyle(hex('#f0d060'), 1).fillRoundedRect(-41, -45, 82, 90, 5);
  g.fillStyle(hex(BLUE), 1).fillRect(-41, -45, 82, 16);
  // Tu cara.
  const look = me();
  g.fillStyle(hex(INK), 1).fillRect(-12, -24, 24, 26);
  g.fillStyle(hex(look.skin), 1).fillRect(-10, -22, 20, 22);
  g.fillStyle(hex(look.hairStyle === 'cap' ? (look.cap ?? BLUE) : look.hair), 1).fillRect(-10, -22, 20, 6);
  g.fillStyle(hex('#202028'), 1).fillRect(-5, -12, 2, 3).fillRect(3, -12, 2, 3).fillRect(-3, -5, 6, 1);
  card.add(makeText(kit.scene, 0, -37, 'FIGURA DEL PARTIDO', { fontFamily: FONT_HUD, fontSize: '7px', color: '#f8f8f0' }).setOrigin(0.5));
  card.add(makeText(kit.scene, 0, 8, `${Dialogue.vars.get('goles') ?? '?'} GOLES`, { fontFamily: FONT_HUD, fontSize: '10px', color: INK }).setOrigin(0.5));
  card.add(makeText(kit.scene, 0, 24, 'Intercambio FC · #14', { fontSize: '8px', color: INK }).setOrigin(0.5));
  kit.tween({ targets: card, y: 56, duration: 600, ease: 'Back.Out', onUpdate: () => card.setY(Math.round(card.y)) });
  kit.after(700, () => {
    playSfx('item');
    for (let i = 0; i < 6; i++) kit.after(i * 150, () => sparkle(kit, stage, 70 + Math.round(rand(i + 3) * 80), 14 + Math.round(rand(i + 9) * 80)));
  });
};

export const FUTBOL_VINETAS: Record<string, VinetaBuilder> = {
  futbol_gol: futbolGol,
  futbol_hattrick: futbolHattrick,
  futbol_autogol: futbolAutogol,
  cali_festejo: caliFestejo,
  cali_hombros: caliHombros,
  cali_figura: caliFigura,
};
